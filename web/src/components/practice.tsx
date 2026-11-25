'use client';
import {useTranslations} from 'next-intl';
import {Fragment, useState} from 'react';
import {Link} from '../i18n/navigation';
import type {PracticeAnswer, PracticeQuestion, PracticeResult, PracticeSession} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {PracticeButton} from './practice-button';

type Shown = Omit<PracticeResult, 'session'>;
type Draft = {selected: string[]; gaps: Record<string, string>; tokens: string[]};

const emptyDraft = (): Draft => ({selected: [], gaps: {}, tokens: []});
const gapPattern = /\{\{([0-9a-f]{24})\}\}/g;

/** The learner's draft as the API answer, or null while it is incomplete. */
function answerOf(q: PracticeQuestion, d: Draft): PracticeAnswer | null {
  if (q.type === 'multiple_choice') return d.selected.length ? {selected: d.selected} : null;
  if (q.type === 'ordering') return d.tokens.length === q.tokens.length ? {tokens: d.tokens} : null;
  const gaps = Object.fromEntries(q.targets.map(target => [target.id, (d.gaps[target.id] ?? '').trim()]).filter(([, v]) => v !== ''));
  return Object.keys(gaps).length === q.targets.length ? {gaps} : null;
}

/** The draft back from a stored answer, so a reload shows what the learner chose. */
function draftOf(answer: PracticeAnswer | null | undefined): Draft {
  if (!answer) return emptyDraft();
  if ('selected' in answer) return {...emptyDraft(), selected: answer.selected};
  if ('tokens' in answer) return {...emptyDraft(), tokens: answer.tokens};
  return {...emptyDraft(), gaps: answer.gaps};
}

/**
 * P4.8: one question at a time. The server checks every answer; only then the correct answer and the explanation from
 * the checked bank appear (the sense card of a collocation, or the item's approved explanation).
 */
export function Practice({initial, skillName}: {initial: PracticeSession; skillName: string}) {
  const t = useTranslations('Practice');
  const [session, setSession] = useState(initial);
  const [results, setResults] = useState<Record<string, Shown>>(() => Object.fromEntries(initial.questions.filter(q => q.result).map(q => [q.question.id, q.result!])));
  const firstOpen = initial.questions.findIndex(q => !q.result);
  const [index, setIndex] = useState(initial.status === 'open' && firstOpen >= 0 ? firstOpen : initial.questions.length);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(initial.questions.map(q => [q.question.id, draftOf(q.result?.answer)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const total = session.questions.length;
  // The last answer finishes the session on the server; its verdict still shows before the summary.
  const done = index >= total;
  const question = done ? null : session.questions[index].question;
  const shown = question ? results[question.id] : undefined;
  const draft = question ? drafts[question.id] : emptyDraft();
  const setDraft = (change: (d: Draft) => Draft) => question && setDrafts(all => ({...all, [question.id]: change(all[question.id])}));

  async function check() {
    if (!question) return;
    const answer = answerOf(question, draft);
    if (!answer) {
      setError(t('errors.incomplete'));
      return;
    }
    setBusy(true);
    setError('');
    const response = await bff<{result: PracticeResult}>(`practice/${session.uuid}/answers/${question.id}`, {body: {answer}});
    setBusy(false);
    if (!response.ok) {
      setError(response.error === 'exams_practice_closed' ? t('errors.closed') : response.error === 'exams_answer_invalid' || response.error === 'exams_answer_required'
        ? t('errors.incomplete') : t('errors.generic'));
      return;
    }
    const {session: counts, ...result} = response.data.result;
    setResults(all => ({...all, [question.id]: result}));
    setSession(s => ({...s, ...counts}));
  }

  async function finish() {
    setBusy(true);
    const response = await bff<{session: PracticeSession}>(`practice/${session.uuid}/finish`, {body: {}});
    setBusy(false);
    if (response.ok) setSession(response.data.session);
    setIndex(total);
  }

  if (done) {
    return <section className="practice-summary" aria-labelledby="practice-summary-title">
      <h2 id="practice-summary-title">{session.status === 'abandoned' ? t('abandoned') : t('summaryTitle', {correct: session.correct, total: session.answered || total})}</h2>
      <p className="hint">{t('summaryNote')}</p>
      <ol className="practice-review">
        {session.questions.map(({question: q}, i) => {
          const r = results[q.id];
          return <li key={q.id} className={r ? `answered ${r.state}` : 'skipped'}>
            <span className="badge">{i + 1}</span> {r ? t(`states.${r.state}`) : t('skipped')}
            {r?.targets.some(target => target.correct_answer) && <span className="hint"> · {r.targets.map(target => target.correct_answer).filter(Boolean).join(', ')}</span>}
          </li>;
        })}
      </ol>
      <div className="practice-actions">
        <PracticeButton skill={session.skill_key} className="button primary" label={t('again')}/>
        <Link className="button" href="/ielts/progress">{t('toProgress')}</Link>
      </div>
    </section>;
  }

  const q = question!;
  return <section className="practice" aria-labelledby="practice-question">
    <div className="practice-head">
      <p className="eyebrow">{skillName}</p>
      <p className="hint" aria-live="polite">{t('progress', {n: index + 1, total})}{session.answered > 0 && <> · {t('score', {correct: session.correct, answered: session.answered})}</>}</p>
    </div>
    <div className="practice-card">
      <h2 id="practice-question" className="sr-only">{t('question', {n: index + 1})}</h2>
      <Question q={q} draft={draft} setDraft={setDraft} result={shown}/>
      {shown && <Verdict result={shown}/>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      <div className="practice-actions">
        {!shown
          ? <button type="button" className="button primary" onClick={() => void check()} disabled={busy} aria-busy={busy}>{t('check')}</button>
          : <button type="button" className="button primary" onClick={() => { setError(''); setIndex(i => i + 1); }} autoFocus>{index + 1 < total ? t('next') : t('finish')}</button>}
        {!shown && session.answered > 0 && <button type="button" className="text-button" onClick={() => void finish()} disabled={busy}>{t('finishEarly')}</button>}
      </div>
    </div>
  </section>;
}

function Question({q, draft, setDraft, result}: {q: PracticeQuestion; draft: Draft; setDraft: (change: (d: Draft) => Draft) => void; result?: Shown}) {
  const t = useTranslations('Practice');
  const locked = Boolean(result);
  const stateOf = (id: string) => result?.targets.find(target => target.id === id)?.state;
  // After the check: the right option in green, a wrong choice in red (not the accent of a plain choice).
  const right = new Set((result?.targets ?? []).flatMap(target => (target.correct_answer ?? '').split(' / ')).filter(Boolean));
  const mark = (text: string, chosen: boolean) => (!result ? '' : right.has(text) ? ' right' : chosen ? ' wrong' : '');

  if (q.type === 'multiple_choice') {
    const multi = Boolean(q.multi_select);
    return <fieldset className="practice-choices" disabled={locked}>
      <legend className="practice-text" lang="en">{q.text}</legend>
      <p className="hint">{multi ? t('chooseAll') : t('chooseOne')}</p>
      {q.options.map(option => <label key={option.id} className={`option${mark(option.text, draft.selected.includes(option.id))}`}>
        <input type={multi ? 'checkbox' : 'radio'} name={`q-${q.id}`} checked={draft.selected.includes(option.id)}
          onChange={() => setDraft(d => ({...d, selected: multi ? (d.selected.includes(option.id) ? d.selected.filter(x => x !== option.id) : [...d.selected, option.id]) : [option.id]}))}/>
        <span lang="en">{option.text}</span>
      </label>)}
    </fieldset>;
  }

  if (q.type === 'ordering') {
    const placed = draft.tokens.map(id => q.tokens.find(token => token.id === id)!).filter(Boolean);
    const free = q.tokens.filter(token => !draft.tokens.includes(token.id));
    return <div className="practice-order">
      <p className="hint">{t('orderHint')}</p>
      <p className="order-line" aria-label={t('orderLine')} lang="en">
        {placed.length === 0 ? <span className="hint">{t('orderEmpty')}</span> : placed.map(token =>
          <button key={token.id} type="button" className="token placed" disabled={locked} onClick={() => setDraft(d => ({...d, tokens: d.tokens.filter(x => x !== token.id)}))}
            aria-label={t('removeToken', {word: token.text})}>{token.text}</button>)}
      </p>
      <p className="order-pool" lang="en">{free.map(token =>
        <button key={token.id} type="button" className="token" disabled={locked} onClick={() => setDraft(d => ({...d, tokens: [...d.tokens, token.id]}))}>{token.text}</button>)}</p>
      {!locked && placed.length > 0 && <button type="button" className="text-button" onClick={() => setDraft(d => ({...d, tokens: []}))}>{t('orderReset')}</button>}
    </div>;
  }

  // gap_choice and gap_fill: the sentence with its gaps; choices below each gap, typed answers inline.
  const parts = q.text.split(gapPattern);
  const number = (id: string) => q.targets.findIndex(target => target.id === id) + 1;
  const many = q.targets.length > 1;
  return <div className="practice-gaps">
    <p className="practice-text" lang="en">{parts.map((part, i) => {
      if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
      const target = q.targets.find(x => x.id === part);
      if (!target) return <Fragment key={i}>___</Fragment>;
      const value = draft.gaps[target.id] ?? '';
      const state = stateOf(target.id);
      if (q.type === 'gap_fill') {
        return <input key={i} className={`gap-input${state ? ` ${state}` : ''}`} value={value} disabled={locked} maxLength={100} autoComplete="off" spellCheck={false}
          aria-label={many ? t('gap', {n: number(target.id)}) : t('gapOne')} size={Math.max(6, value.length + 1)}
          onChange={e => { const v = e.target.value; setDraft(d => ({...d, gaps: {...d.gaps, [target.id]: v}})); }}/>;
      }
      const chosen = target.options?.find(o => o.id === value)?.text;
      return <span key={i} className={`gap-slot${state ? ` ${state}` : ''}`}>{many && <sup>{number(target.id)}</sup>}{chosen ?? '_____'}</span>;
    })}</p>
    {q.type === 'gap_choice' && q.targets.map(target => <fieldset key={target.id} className="practice-choices" disabled={locked}>
      <legend className="hint">{many ? t('gap', {n: number(target.id)}) : t('chooseGap')}</legend>
      {(target.options ?? []).map(option => <label key={option.id} className={`option${mark(option.text, draft.gaps[target.id] === option.id)}`}>
        <input type="radio" name={`q-${q.id}-${target.id}`} checked={draft.gaps[target.id] === option.id}
          onChange={() => setDraft(d => ({...d, gaps: {...d.gaps, [target.id]: option.id}}))}/>
        <span lang="en">{option.text}</span>
      </label>)}
    </fieldset>)}
  </div>;
}

function Verdict({result}: {result: Shown}) {
  const t = useTranslations('Practice');
  const answers = result.targets.map(target => target.correct_answer).filter((a): a is string => Boolean(a));
  const f = result.feedback;
  return <div className={`practice-verdict ${result.state}`} role="status">
    <p className="verdict-title">{t(`states.${result.state}`)}</p>
    {result.state !== 'correct' && answers.length > 0 && <p>{t('correctAnswer')} <strong lang="en">{answers.join(' · ')}</strong></p>}
    {f?.sense && <div className="sense-card">
      <p><strong lang="en">{f.sense.phrase}</strong> — <span lang="en">{f.sense.definition}</span></p>
      {f.sense.translation && <p>{t('translation')} {f.sense.translation}</p>}
    </div>}
    {f?.explanation && <p lang={f.explanation.language}>{f.explanation.text}</p>}
    {f?.topic && <p className="hint">{t('topic', {topic: f.topic})}</p>}
  </div>;
}
