'use client';
import {highlightSegments, normalizeResponse} from '@gonative/exam-domain';
import {useLocale, useTranslations} from 'next-intl';
import {useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import {useRouter} from '../i18n/navigation';
import type {Assessment, Attempt, ResultFinding, RewriteCheck, RewriteChecks} from '../lib/api/schemas';
import {reportKinds} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {taskGenre} from '../lib/writing';
import {EssayWords} from './essay-words';
import {PracticeButton} from './practice-button';

type Result = NonNullable<Assessment['result']>;
const kindOrder = {error: 0, weakness: 1, suggestion: 2, strength: 3} as const;
/** CSS class of a kind: `.suggestion` already styles corrected wording, so the optional kind is `.optional`. */
const kindClass = (kind: keyof typeof kindOrder) => (kind === 'suggestion' ? 'optional' : kind);
// Task 1 is assessed on Task Achievement, Task 2 on Task Response; the other three are shared.
const criterionOrder = ['task_achievement', 'task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range_accuracy'];

/** 6 → "6", 5.5 → "5.5": ranges are shown as they come, never rounded into something more precise. */
const band = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

export function ResultView({attempt, assessment, practiceSkills = [], rewriteChecks, example = false}: {attempt: Attempt; assessment: Assessment & {result: Result}; practiceSkills?: string[];
  rewriteChecks?: RewriteChecks;
  /** P6.5: a public example on the landing host — the same feedback, without anything that calls the API. */
  example?: boolean}) {
  const t = useTranslations('Result');
  const result = assessment.result;
  const language = assessment.feedback_language;
  // The backend assessed the normalized text; finding offsets point into it.
  const text = useMemo(() => normalizeResponse(attempt.response_text), [attempt.response_text]);
  const findings = useMemo(() => [...result.findings].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || (a.span?.start ?? 1e9) - (b.span?.start ?? 1e9)), [result.findings]);
  const {segments, skipped} = useMemo(() => highlightSegments(text, findings.filter(f => f.span).map(f => ({id: f.id, start: f.span!.start, end: f.span!.end, quote: f.quote}))), [text, findings]);
  const placed = useMemo(() => new Set(segments.flatMap(s => s.ids)), [segments]);
  const byId = useMemo(() => new Map(findings.map(f => [f.id, f])), [findings]);
  // One repeated mistake = one card (the first place) listing every place; each place keeps its own highlight.
  const places = useMemo(() => {
    const groups = new Map<string, ResultFinding[]>();
    for (const f of findings) if (f.pattern) groups.set(f.pattern, [...(groups.get(f.pattern) ?? []), f]);
    return groups;
  }, [findings]);
  const cards = useMemo(() => findings.filter(f => !f.pattern || places.get(f.pattern)![0].id === f.id), [findings, places]);
  const groupOf = (f: ResultFinding) => (f.pattern ? places.get(f.pattern)! : [f]);
  const under = (f: ResultFinding, criterion: string) => f.criterion_key === criterion || Boolean(f.also_criteria?.includes(criterion));
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [reportFor, setReportFor] = useState<string | null | undefined>(undefined);
  const listRef = useRef<HTMLOListElement>(null);
  const essayRef = useRef<HTMLDivElement>(null);
  const criteria = [...result.criteria].sort((a, b) => criterionOrder.indexOf(a.criterion_key) - criterionOrder.indexOf(b.criterion_key));
  const shown = cards.filter(f => filter === 'all' || (filter === 'strength' ? f.kind === 'strength' : f.kind !== 'strength' && under(f, filter)));
  const fixes = result.top_fixes.map(id => byId.get(id)).filter((f): f is ResultFinding => Boolean(f));
  // Grouped by skill when the backend sends it; older backends send only top_fixes.
  const fixSkills = (result.top_skills ?? [])
    .map(g => ({...g, examples: g.finding_ids.map(id => byId.get(id)).filter((f): f is ResultFinding => Boolean(f))}))
    .filter(g => g.examples.length > 0);
  // Task 1 uses the same task skills, named for describing data (a report) or for a letter (purpose, points, all the task).
  const genre = taskGenre(attempt.exam_key, attempt.task_key);
  const genreSkills = {essay: null, report: 'skillsReport', letter: 'skillsLetter'}[genre];
  const skillName = (skill: string) => (genreSkills && t.has(`${genreSkills}.${skill}`) ? t(`${genreSkills}.${skill}`)
    : t.has(`skills.${skill}`) ? t(`skills.${skill}`) : skill);

  function select(id: string, from: 'essay' | 'list') {
    setSelected(id);
    if (from === 'essay') {
      setFilter('all');
      requestAnimationFrame(() => listRef.current?.querySelector(`[data-finding~="${CSS.escape(id)}"]`)?.scrollIntoView({block: 'nearest', behavior: 'smooth'}));
    } else {
      requestAnimationFrame(() => essayRef.current?.querySelector(`[data-ids~="${CSS.escape(id)}"]`)?.scrollIntoView({block: 'center', behavior: 'smooth'}));
    }
  }

  const strongest = (ids: string[]) => ids.map(id => byId.get(id)!).sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind])[0];

  return <div className="result">
    {!example && <LinkedPracticeResults key={attempt.uuid} attempt={attempt.uuid}/>}
    <p className="score-note">{t('scoreNote')}</p>
    {result.status === 'partial' && <p className="feedback error" role="status">{t('partial')}</p>}

    <section aria-labelledby="criteria-title">
      <h2 id="criteria-title">{t('criteriaTitle')}</h2>
      <ul className="criteria">
        {criteria.map(c => {
          const count = cards.filter(f => under(f, c.criterion_key) && f.kind !== 'strength').length;
          return <li key={c.criterion_key} className="criterion">
            <div className="criterion-head">
              <h3>{t.has(`criteria.${c.criterion_key}`) ? t(`criteria.${c.criterion_key}`) : c.criterion_key}</h3>
              {c.estimate ? <p className="range">
                <span className="range-value" aria-label={t('rangeLabel', {low: band(c.estimate.low), high: band(c.estimate.high)})}>≈ {band(c.estimate.low)}–{band(c.estimate.high)}</span>
                <span className="range-note">{c.estimate.precision === 'approximate' ? t('approximate') : t('calibrated')}</span>
              </p> : <p className="range muted">{t('noRange')}</p>}
            </div>
            {c.summary && <p lang={language}>{c.summary}</p>}
            {c.confidence === 'low' && <p className="hint">{t('lowConfidence')}</p>}
            {count > 0 && <button type="button" className="text-button" onClick={() => setFilter(c.criterion_key)}>{t('showFindings', {count})}</button>}
          </li>;
        })}
      </ul>
    </section>

    {fixSkills.length > 0 ? <section aria-labelledby="fixes-title" className="fixes">
      <h2 id="fixes-title">{t('fixesTitle')}</h2>
      <ol>
        {fixSkills.map(g => <li key={g.skill} className="fix-skill">
          <h3>{skillName(g.skill)}{g.places > 1 && <span className="places-count"> · {t('places', {count: g.places})}</span>}</h3>
          <ul className="fix-examples">
            {g.examples.map(f => <li key={f.id}>
              {f.quote && <span className="quote" lang="en">“{f.quote}”</span>}
              {f.suggestion && <> <span aria-hidden="true">→</span> <span className="suggestion" lang="en">{f.suggestion}</span></>}
              {placed.has(f.id) && <> <button type="button" className="text-button" onClick={() => select(f.id, 'list')}>{t('showInEssay')}</button></>}
              {/* Every example keeps its own explanation (owner test 05): a group never shows only the first one. */}
              <p lang={language}>{f.explanation}</p>
            </li>)}
          </ul>
          {!example && practiceSkills.includes(g.skill) && <PracticeButton skill={g.skill} attempt={attempt.uuid}/>}
        </li>)}
      </ol>
    </section> : fixes.length > 0 && <section aria-labelledby="fixes-title" className="fixes">
      <h2 id="fixes-title">{t('fixesTitle')}</h2>
      <ol>
        {fixes.map(f => <li key={f.id}>
          {f.quote && <span className="quote" lang="en">“{f.quote}”</span>}
          {f.suggestion && <> <span aria-hidden="true">→</span> <span className="suggestion" lang="en">{f.suggestion}</span></>}
          {groupOf(f).length > 1 && <span className="places-count"> · {t('places', {count: groupOf(f).length})}</span>}
          <p lang={language}>{f.explanation}</p>
          {placed.has(f.id) && <button type="button" className="text-button" onClick={() => select(f.id, 'list')}>{t('showInEssay')}</button>}
        </li>)}
      </ol>
    </section>}

    <div className="review">
      <section aria-labelledby="essay-title" className="review-essay">
        <h2 id="essay-title">{t({essay: 'essayTitle', report: 'reportTitle', letter: 'letterTitle'}[genre])}</h2>
        <p className="legend"><span className="hl error">{t('kinds.error')}</span> <span className="hl weakness">{t('kinds.weakness')}</span> <span className="hl optional">{t('kinds.suggestion')}</span> <span className="hl strength">{t('kinds.strength')}</span></p>
        <div className="essay-marked" lang="en" ref={essayRef}>
          {segments.map(segment => {
            if (!segment.ids.length) return <span key={segment.start}>{segment.text}</span>;
            const top = strongest(segment.ids);
            const active = selected !== null && segment.ids.includes(selected);
            const pick = () => select(segment.ids.includes(selected ?? '') && segment.ids.length > 1
              ? segment.ids[(segment.ids.indexOf(selected!) + 1) % segment.ids.length] : top.id, 'essay');
            return <mark key={segment.start} className={`hl ${kindClass(top.kind)}${active ? ' active' : ''}`} data-ids={segment.ids.join(' ')}
              tabIndex={0} role="button" aria-label={t('findingAt', {kind: t(`kinds.${top.kind}`), text: segment.text})}
              onClick={pick} onKeyDown={(event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } }}>{segment.text}</mark>;
          })}
        </div>
      </section>

      <section aria-labelledby="findings-title" className="review-findings">
        <h2 id="findings-title">{t('findingsTitle', {count: cards.length})}</h2>
        <div className="chips" role="group" aria-label={t('filterLabel')}>
          {['all', ...criteria.map(c => c.criterion_key), 'strength'].map(value => <button key={value} type="button" aria-pressed={filter === value}
            onClick={() => setFilter(value)}>{value === 'all' ? t('filterAll') : value === 'strength' ? t('filterStrengths') : t(`criteriaShort.${value}`)}</button>)}
        </div>
        {shown.length === 0 ? <p className="empty">{t('noFindings')}</p> : <ol className="findings" ref={listRef}>
          {shown.map(f => {
            const group = groupOf(f);
            const active = group.some(g => g.id === selected);
            return <li key={f.id} data-finding={group.map(g => g.id).join(' ')} className={`finding ${kindClass(f.kind)}${active ? ' active' : ''}`} aria-current={active ? 'true' : undefined}>
            <div className="finding-head">
              <span className={`badge ${kindClass(f.kind)}`}>{t(`kinds.${f.kind}`)}</span>
              <span className="finding-skill">{skillName(f.skill)}</span>
              {[f.criterion_key, ...(f.also_criteria ?? [])].filter((c): c is string => Boolean(c)).map(c => <span key={c} className="finding-criterion">{t(`criteriaShort.${c}`)}</span>)}
            </div>
            {f.quote && <p className="quote" lang="en">“{f.quote}”{f.suggestion && <> <span aria-hidden="true">→</span> <span className="suggestion">{f.suggestion}</span></>}</p>}
            {!f.quote && f.suggestion && <p className="suggestion" lang="en">{f.suggestion}</p>}
            <p lang={language}>{f.explanation}</p>
            {group.length > 1 && <div className="places">
              <p className="hint">{t('places', {count: group.length})}</p>
              <ol>{group.map(g => <li key={g.id}>
                <span className="quote" lang="en">“{g.quote}”</span>
                {g.suggestion && <> <span aria-hidden="true">→</span> <span className="suggestion" lang="en">{g.suggestion}</span></>}
                {placed.has(g.id) && g.id !== f.id && <> <button type="button" className="text-button" onClick={() => select(g.id, 'list')}>{t('showInEssay')}</button></>}
              </li>)}</ol>
            </div>}
            <div className="finding-actions">
              {placed.has(f.id) ? <button type="button" className="text-button" onClick={() => select(f.id, 'list')}>{t('showInEssay')}</button>
                : f.span && skipped.includes(f.id) ? <span className="hint">{t('notPlaced')}</span> : null}
              {!example && <button type="button" className="text-button" onClick={() => setReportFor(f.id)}>{t('reportThis')}</button>}
            </div>
            {reportFor === f.id && <ReportForm uuid={attempt.uuid} findingId={f.id} onClose={() => setReportFor(undefined)}/>}
          </li>;
          })}
        </ol>}
      </section>
    </div>

    {!example && <>
      <SelfCheck cards={cards} language={language} uuid={attempt.uuid} checks={rewriteChecks?.enabled ? rewriteChecks : undefined}/>

      <EssayWords uuid={attempt.uuid}/>

      <section className="result-actions" aria-label={t('actionsLabel')}>
        <Rewrite attempt={attempt}/>
        <button type="button" className="button" onClick={() => setReportFor(null)}>{t('reportGeneral')}</button>
      </section>
    </>}
    {reportFor === null && <ReportForm uuid={attempt.uuid} findingId={null} onClose={() => setReportFor(undefined)}/>}
  </div>;
}

const severityOrder = {major: 0, moderate: 1, minor: 2} as const;

/**
 * P4.5 "rewrite your own sentences": the clearest errors (with a correction), the most serious first. The learner
 * writes the sentence again, then opens the correction to compare. P4.14: with AI checks on, the learner may type the
 * sentence and have it checked; the text goes to the backend for this one check and is not stored.
 */
function SelfCheck({cards, language, uuid, checks}: {cards: ResultFinding[]; language: string; uuid: string; checks?: RewriteChecks}) {
  const t = useTranslations('Result');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [remaining, setRemaining] = useState(checks?.remaining ?? 0);
  const items = cards.filter(f => f.kind === 'error' && f.quote && f.suggestion)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 5);
  if (items.length === 0) return null;
  return <section id="rewrite" aria-labelledby="rewrite-title" className="self-check">
    <h2 id="rewrite-title">{t('selfCheckTitle')}</h2>
    <p className="hint">{checks ? t('selfCheckIntroAi') : t('selfCheckIntro')}</p>
    <ol>
      {items.map(f => <li key={f.id}>
        <p className="quote" lang="en">“{f.quote}”</p>
        {checks && <RewriteField uuid={uuid} findingId={f.id} language={language} remaining={remaining} onUsed={setRemaining}/>}
        {open.has(f.id) ? <>
          <p><span className="suggestion" lang="en">{f.suggestion}</span></p>
          <p lang={language}>{f.explanation}</p>
        </> : <button type="button" className="text-button" onClick={() => setOpen(new Set([...open, f.id]))}>{t('selfCheckShow')}</button>}
      </li>)}
    </ol>
    {checks && <p className="hint">{t('selfCheckRemaining', {count: remaining})}</p>}
  </section>;
}

/** P4.14: one sentence typed by the learner and its AI check: "correct" or "not quite yet" with one sentence why. */
function RewriteField({uuid, findingId, language, remaining, onUsed}: {uuid: string; findingId: string; language: string; remaining: number;
  onUsed: (remaining: number) => void}) {
  const t = useTranslations('Result');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<RewriteCheck | null>(null);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError('');
    const result = await bff<{check: RewriteCheck}>(`attempts/${uuid}/rewrite-check`, {body: {finding_id: findingId, text: text.trim()}});
    setBusy(false);
    if (!result.ok) {
      setCheck(null);
      setError(result.error === 'exams_rewrite_checks_exhausted' || result.error === 'exams_monthly_ai_budget_exhausted' ? t('selfCheckExhausted')
        : result.error === 'exams_requests_rate_limited' ? t('selfCheckRate') : t('selfCheckFailed'));
      if (result.error === 'exams_rewrite_checks_exhausted') onUsed(0);
      return;
    }
    setCheck(result.data.check);
    onUsed(result.data.check.checks.remaining);
  }
  return <form className="rewrite-check" onSubmit={e => void submit(e)}>
    <label className="sr-only" htmlFor={`rewrite-${findingId}`}>{t('selfCheckLabel')}</label>
    <textarea id={`rewrite-${findingId}`} lang="en" rows={2} maxLength={400} value={text} placeholder={t('selfCheckPlaceholder')}
      onChange={e => { setText(e.target.value); setCheck(null); }}/>
    <button type="submit" className="button" disabled={busy || !text.trim() || remaining < 1}>{busy ? t('selfCheckChecking') : t('selfCheckCheck')}</button>
    {check && <p className={`feedback ${check.verdict === 'correct' ? 'ok' : 'error'}`} role="status">
      <strong>{check.verdict === 'correct' ? t('selfCheckCorrect') : t('selfCheckNotYet')}</strong>{' '}
      <span lang={language}>{check.explanation}</span>
    </p>}
    {error && <p className="feedback error" role="alert">{error}</p>}
  </form>;
}

function Rewrite({attempt}: {attempt: Attempt}) {
  const t = useTranslations('Result');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setBusy(true);
    setError('');
    const result = await bff<{attempt: Attempt}>('attempts', {body: {exam_key: attempt.exam_key, from_attempt: attempt.uuid}});
    if (!result.ok) {
      setBusy(false);
      setError(result.error === 'exams_draft_limit' ? t('draftLimit') : t('unavailable'));
      return;
    }
    router.push(`/ielts/writing/${result.data.attempt.uuid}`);
  }
  return <>
    <button type="button" className="button primary" disabled={busy} onClick={() => void start()}>{t('rewrite')}</button>
    {error && <p className="feedback error" role="alert">{error}</p>}
  </>;
}

function ReportForm({uuid, findingId, onClose}: {uuid: string; findingId: string | null; onClose: () => void}) {
  const t = useTranslations('Report');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get('message') ?? '').trim();
    setBusy(true);
    setError('');
    const result = await bff(`attempts/${uuid}/reports`, {body: {
      kind: String(form.get('kind')),
      ...(findingId ? {finding_id: findingId} : {}),
      ...(message ? {message} : {}),
      allow_text_access: form.get('allow') === 'on',
    }});
    setBusy(false);
    if (!result.ok) {
      setError(['exams_report_limit', 'exams_nothing_to_report', 'exams_unknown_finding'].includes(result.error) ? result.error : 'unavailable');
      return;
    }
    setSent(true);
  }
  if (sent) return <div className="report" role="status"><p>{t('thanks')}</p><button type="button" className="text-button" onClick={onClose}>{t('close')}</button></div>;
  const kinds = findingId ? reportKinds.filter(k => k !== 'missing_error' && k !== 'wrong_score') : reportKinds;
  return <form className="report" onSubmit={submit} aria-label={t('title')}>
    <h3>{findingId ? t('titleFinding') : t('title')}</h3>
    <div className="field">
      <label htmlFor={`kind-${findingId ?? 'all'}`}>{t('kind')}</label>
      <select id={`kind-${findingId ?? 'all'}`} name="kind" defaultValue={kinds[0]}>
        {kinds.map(kind => <option key={kind} value={kind}>{t(`kinds.${kind}`)}</option>)}
      </select>
    </div>
    <div className="field">
      <label htmlFor={`message-${findingId ?? 'all'}`}>{t('message')}</label>
      <textarea id={`message-${findingId ?? 'all'}`} name="message" rows={3} maxLength={1000}/>
    </div>
    <label className="check"><input type="checkbox" name="allow"/><span>{t('allow')}</span></label>
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    <div className="actions">
      <button className="button primary" disabled={busy}>{t('send')}</button>
      <button type="button" className="button" onClick={onClose}>{t('cancel')}</button>
    </div>
  </form>;
}


function LinkedPracticeResults({attempt}: {attempt: string}) {
  const locale = useLocale();
  const [results, setResults] = useState<{size: number; answered: number; percent: number | null}[]>([]);
  useEffect(() => {
    let active = true;
    void bff<{results: typeof results}>(`attempts/${attempt}/grammar-practice`).then(result => {
      if (active && result.ok) setResults(result.data.results);
    });
    return () => { active = false; };
  }, [attempt]);
  if (!results.length) return null;
  const format = new Intl.NumberFormat(locale, {style: 'percent', maximumFractionDigits: 1});
  return <section aria-labelledby="linked-practice">
    <h2 id="linked-practice">Grammar Practice</h2>
    <ul>{results.map((result, index) => <li key={index}>
      {result.answered}/{result.size}{result.percent !== null && <> · {format.format(result.percent / 100)}</>}
    </li>)}</ul>
  </section>;
}
