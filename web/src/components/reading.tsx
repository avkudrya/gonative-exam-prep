'use client';
import {useFormatter, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {FeedbackLanguage, ReadingAttempt, ReadingGroup, ReadingIndex, ReadingSummary} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';

/*
 * P7.4 (docs/phase-7/P7.1-reading-design.md §7): IELTS Reading as on the computer-delivered test — the passage on the left, the
 * questions on the right (tabs on a phone), a timer (soft or strict), highlighting in the passage, a question map with
 * "review later" flags, autosave. After the submit: the raw score, the approximate band of a full test, every question with the
 * learner's answer, the key, the evidence lit in the passage and the explanation in the learner's language.
 */

type Answers = Record<string, string>;
type Section = NonNullable<ReadingAttempt['sections']>[number];
type Question = ReadingGroup['questions'][number];

const SAVE_MS = 1500;
const OPTION_TYPES = new Set(['true_false_not_given', 'yes_no_not_given', 'multiple_choice']);
const LIST_TYPES = new Set(['matching_headings', 'matching_information', 'matching_features', 'matching_sentence_endings']);
const startErrors = new Set(['exams_reading_unavailable', 'exams_reading_quota_exhausted', 'exams_reading_test_unknown', 'exams_rate_limited', 'rate_limited', 'unauthenticated', 'offline']);
const submitErrors = new Set(['exams_reading_not_open', 'exams_reading_unavailable', 'exams_rate_limited', 'rate_limited', 'unauthenticated', 'offline']);
const band = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const paragraphsOf = (text: string) => text.split(/\n{2,}/);
const numbersOf = (sections: Section[]) => sections.flatMap(s => s.groups.flatMap(g => g.questions.flatMap(q => q.numbers)));

function minutes(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** State kept in this browser too; read after the first render, so the server and the client draw the same page. */
function readStored<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const stored = readStored<T>(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setValue(stored);
  }, [key]);
  const set = useCallback((v: T) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, JSON.stringify(v));
    } catch { /* storage full or off: the server copy stays */ }
  }, [key]);
  return [value, set];
}

/** The tests, the month's count and the recent attempts. */
/** P7.5: with tests of both IELTS Reading exams the learner picks one, starting from the target exam of the profile. */
export function ReadingHome({index, defaultExam}: {index: ReadingIndex; defaultExam: string | null}) {
  const t = useTranslations('Reading');
  const exams = [...new Set(index.tests.map(test => test.exam_key))];
  const [exam, setExam] = useState(exams.find(e => e === defaultExam) ?? exams[0] ?? '');
  const tests = index.tests.filter(test => test.exam_key === exam);
  const format = useFormatter();
  const router = useRouter();
  const [timer, setTimer] = useState<'soft' | 'strict'>('soft');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const exhausted = index.usage.remaining === 0;

  async function start(test: string, mode: 'test' | 'section', section?: number) {
    setBusy(`${test}:${section ?? 0}`);
    setError('');
    const result = await bff<{attempt: ReadingAttempt}>('reading/attempts', {body: {test, mode, ...(section ? {section} : {}), timer_mode: timer}});
    if (!result.ok) {
      setBusy(null);
      setError(startErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    router.push(`/ielts/reading/${result.data.attempt.uuid}`);
  }

  return <section className="page reading-home">
    <h1>{t('title')}</h1>
    <p className="lead">{t('lead')}</p>
    <ul className="facts">
      <li>{t('factFormat')}</li>
      <li>{t('factMarking')}</li>
      <li>{t('factBand')}</li>
    </ul>
    <p className="hint" role="status">{index.usage.limit === null ? t('usageUnlimited') : t('usage', {remaining: index.usage.remaining ?? 0, limit: index.usage.limit})}</p>
    <fieldset className="choice">
      <legend>{t('timerMode')}</legend>
      <label><input type="radio" name="timer" value="soft" checked={timer === 'soft'} onChange={() => setTimer('soft')}/> {t('timerSoft')}</label>
      <label><input type="radio" name="timer" value="strict" checked={timer === 'strict'} onChange={() => setTimer('strict')}/> {t('timerStrict')}</label>
    </fieldset>
    {exams.length > 1 && <fieldset className="choice">
      <legend>{t('exam')}</legend>
      {exams.map(e => <label key={e}><input type="radio" name="exam" value={e} checked={exam === e} onChange={() => setExam(e)}/> {t.has(`exams.${e}`) ? t(`exams.${e}`) : e}</label>)}
    </fieldset>}
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    {tests.length === 0 && <p>{t('noTests')}</p>}
    <ul className="reading-tests">
      {tests.map(test => <li key={test.uuid} className="reading-test">
        <div className="reading-test-head">
          <h2>{test.title}</h2>
          {test.review && <span className="badge">{t('reviewBadge')}</span>}
        </div>
        <button type="button" className="button primary" disabled={busy !== null || exhausted} onClick={() => void start(test.uuid, 'test')}>
          {busy === `${test.uuid}:0` ? t('starting') : t('startTest')}
        </button>
        <ol className="reading-parts">
          {test.sections.map(s => <li key={s.position}>
            <span><strong>{t('part', {n: s.position})}</strong> {s.title} <span className="muted">· {t('questionsRange', {from: s.numbers[0], to: s.numbers[1]})}</span></span>
            <button type="button" className="button" disabled={busy !== null || exhausted} onClick={() => void start(test.uuid, 'section', s.position)}>
              {busy === `${test.uuid}:${s.position}` ? t('starting') : t('startSection')}
            </button>
          </li>)}
        </ol>
      </li>)}
    </ul>
    {index.attempts.length > 0 && <section aria-labelledby="reading-past" className="recent">
      <h2 id="reading-past">{t('pastTitle')}</h2>
      <ul className="attempts">
        {index.attempts.map(a => <li key={a.uuid}>
          <Link href={`/ielts/reading/${a.uuid}`}>
            <span>{a.test.title}{a.mode === 'section' ? ` · ${t('part', {n: a.section ?? 0})}` : ''} · {a.submitted_at ? format.dateTime(new Date(a.submitted_at), {day: 'numeric', month: 'short'}) : ''}</span>
            <span>{scoreLine(a)}</span>
          </Link>
        </li>)}
      </ul>
    </section>}
    <p className="hint">{t('disclaimer')}</p>
  </section>;
}

function scoreLine(a: ReadingSummary) {
  if (a.correct === null || a.total === null) return '';
  return `${a.correct}/${a.total}${a.estimate ? ` · ≈ ${band(a.estimate.low)}–${band(a.estimate.high)}` : ''}`;
}

/** A paragraph with the learner's highlights and, in the review, the evidence of the chosen question. */
function Paragraph({text, index, marks, evidence}: {text: string; index: number; marks: [number, number][]; evidence?: string | null}) {
  const ranges: {start: number; end: number; kind: 'mark' | 'evidence'}[] = marks.map(([start, end]) => ({start, end, kind: 'mark'}));
  if (evidence) {
    const at = text.toLowerCase().indexOf(evidence.toLowerCase());
    if (at >= 0) ranges.push({start: at, end: at + evidence.length, kind: 'evidence'});
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [i, r] of ranges.entries()) {
    const start = Math.max(at, r.start);
    if (start >= r.end) continue;
    if (start > at) parts.push(text.slice(at, start));
    parts.push(r.kind === 'evidence' ? <mark key={i} className="evidence" id="reading-evidence">{text.slice(start, r.end)}</mark> : <mark key={i}>{text.slice(start, r.end)}</mark>);
    at = r.end;
  }
  parts.push(text.slice(at));
  return <p data-p={index}>{parts}</p>;
}

function Passage({section, marks, onMark, evidence}: {
  section: Section; marks: Record<number, [number, number][]>; onMark?: (paragraph: number, range: [number, number] | null) => void; evidence?: string | null;
}) {
  const t = useTranslations('Reading');
  const box = useRef<HTMLDivElement>(null);
  const [title, ...paragraphs] = paragraphsOf(section.text);

  function highlight() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !box.current || !onMark) return;
    const range = selection.getRangeAt(0);
    const p = (range.startContainer.parentElement?.closest('[data-p]') ?? null) as HTMLElement | null;
    const q = (range.endContainer.parentElement?.closest('[data-p]') ?? null) as HTMLElement | null;
    if (!p || p !== q || !box.current.contains(p)) return;
    const before = document.createRange();
    before.selectNodeContents(p);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + range.toString().length;
    if (end > start) onMark(Number(p.dataset.p), [start, end]);
    selection.removeAllRanges();
  }

  return <article className="reading-passage" aria-label={t('passage')}>
    {onMark && <div className="reading-tools">
      <button type="button" className="text-button" onMouseDown={e => e.preventDefault()} onClick={highlight}>{t('highlight')}</button>
      <button type="button" className="text-button" onClick={() => onMark(-1, null)}>{t('clearHighlights')}</button>
    </div>}
    <div ref={box}>
      <h2>{title}</h2>
      {paragraphs.map((text, i) => <Paragraph key={i} text={text} index={i} marks={marks[i] ?? []} evidence={evidence}/>)}
    </div>
  </article>;
}

/** TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN: fixed options that the stored groups do not repeat. */
const FIXED_OPTIONS: Record<string, {id: string; text: string}[]> = {
  true_false_not_given: [{id: 'T', text: 'TRUE'}, {id: 'F', text: 'FALSE'}, {id: 'NG', text: 'NOT GIVEN'}],
  yes_no_not_given: [{id: 'Y', text: 'YES'}, {id: 'N', text: 'NO'}, {id: 'NG', text: 'NOT GIVEN'}],
};

function optionText(group: ReadingGroup, id: string | null | undefined) {
  if (!id) return '';
  const option = (group.options ?? FIXED_OPTIONS[group.type])?.find(o => o.id === id);
  return option ? (OPTION_TYPES.has(group.type) && group.type !== 'multiple_choice' ? option.text : `${option.id}. ${option.text}`) : id;
}

function GroupHead({group}: {group: ReadingGroup}) {
  const t = useTranslations('Reading');
  return <>
    <p className="reading-instruction">{group.instruction}</p>
    {LIST_TYPES.has(group.type) && group.options && <div className="reading-list" aria-label={t('optionsList')}>
      <ul>{group.options.map(o => <li key={o.id}><strong>{o.id}</strong> {o.text}</li>)}</ul>
    </div>}
  </>;
}

/** The input of one question while answering. */
function QuestionInput({group, question, answers, set}: {group: ReadingGroup; question: Question; answers: Answers; set: (n: number, v: string) => void}) {
  const t = useTranslations('Reading');
  const n = question.numbers[0];
  const name = `q-${n}`;
  if (group.type === 'multiple_choice_multi') {
    const chosen = question.numbers.map(x => answers[x]).filter(Boolean);
    const toggle = (id: string) => {
      const next = chosen.includes(id) ? chosen.filter(c => c !== id) : chosen.length < question.numbers.length ? [...chosen, id] : chosen;
      const sorted = [...next].sort();
      question.numbers.forEach((x, i) => set(x, sorted[i] ?? ''));
    };
    return <fieldset className="reading-options">
      <legend className="sr-only">{t('chooseTwo')}</legend>
      {group.options?.map(o => <label key={o.id}><input type="checkbox" checked={chosen.includes(o.id)} onChange={() => toggle(o.id)}/> <strong>{o.id}</strong> {o.text}</label>)}
    </fieldset>;
  }
  if (OPTION_TYPES.has(group.type)) {
    return <fieldset className="reading-options">
      <legend className="sr-only">{t('question', {n})}</legend>
      {group.options?.map(o => <label key={o.id}>
        <input type="radio" name={name} value={o.id} checked={answers[n] === o.id} onChange={() => set(n, o.id)}/> {group.type === 'multiple_choice' ? <><strong>{o.id}</strong> {o.text}</> : o.text}
      </label>)}
    </fieldset>;
  }
  if (LIST_TYPES.has(group.type)) {
    return <select aria-label={t('question', {n})} value={answers[n] ?? ''} onChange={e => set(n, e.target.value)}>
      <option value="">—</option>
      {group.options?.map(o => <option key={o.id} value={o.id}>{o.id}</option>)}
    </select>;
  }
  return <input type="text" className="reading-gap" aria-label={t('question', {n})} maxLength={120} autoComplete="off" spellCheck={false}
    value={answers[n] ?? ''} onChange={e => set(n, e.target.value)}/>;
}

/** A completion prompt with the input in place of its gap; other prompts above their input. */
function Prompt({group, question, input}: {group: ReadingGroup; question: Question; input: React.ReactNode}) {
  const gap = /_{3,}/;
  if (gap.test(question.prompt) && !OPTION_TYPES.has(group.type) && !LIST_TYPES.has(group.type)) {
    const [before, after] = question.prompt.split(gap);
    return <p className="reading-prompt">{before}{input}{after}</p>;
  }
  return <><p className="reading-prompt">{question.prompt}</p>{input}</>;
}

/** Answering: the passage, the questions, the timer, the question map, autosave and the submit. */
export function ReadingRunner({attempt}: {attempt: ReadingAttempt}) {
  const t = useTranslations('Reading');
  const router = useRouter();
  const sections = useMemo(() => attempt.sections ?? [], [attempt.sections]);
  const answersKey = `reading:${attempt.uuid}:answers`;
  const [answers, setAnswers] = useState<Answers>(attempt.answers ?? {});
  const [flags, setFlags] = useLocal<number[]>(`reading:${attempt.uuid}:flags`, []);
  const [marks, setMarks] = useLocal<Record<number, Record<number, [number, number][]>>>(`reading:${attempt.uuid}:marks`, {});
  const [part, setPart] = useState(0);
  const [view, setView] = useState<'text' | 'questions'>('text');
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [offset] = useState(() => Date.parse(attempt.server_time) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitted = useRef(false);
  const deadline = attempt.deadline_at ? Date.parse(attempt.deadline_at) : 0;
  const left = Math.max(0, deadline - (now + offset));
  const strict = attempt.timer_mode === 'strict';
  const numbers = useMemo(() => numbersOf(sections), [sections]);
  const answered = numbers.filter(n => answers[n]?.trim()).length;
  const section = sections[part];

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const save = useCallback(async (next: Answers) => {
    setSaved('saving');
    const result = await bff(`reading/attempts/${attempt.uuid}/answers`, {method: 'PUT', body: {answers: next}});
    setSaved(result.ok ? 'saved' : 'error');
    return result.ok;
  }, [attempt.uuid]);

  function setAnswersLocal(next: Answers) {
    setAnswers(next);
    try { window.localStorage.setItem(answersKey, JSON.stringify(next)); } catch { /* the server copy stays */ }
  }

  // On open: answers typed here but not saved (offline, a closed tab) are restored and saved.
  useEffect(() => {
    const stored = readStored<Answers>(answersKey);
    if (stored && JSON.stringify(stored) !== JSON.stringify(attempt.answers ?? {})) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers(stored);
      void save(stored);
    }
  }, [answersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(n: number, value: string) {
    const next = {...answers};
    if (value.trim()) next[n] = value;
    else delete next[n];
    setAnswersLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), SAVE_MS);
  }

  function mark(paragraph: number, range: [number, number] | null) {
    const mine = {...(marks[part] ?? {})};
    if (range === null) {
      setMarks({...marks, [part]: {}});
      return;
    }
    mine[paragraph] = [...(mine[paragraph] ?? []), range];
    setMarks({...marks, [part]: mine});
  }

  function go(n: number) {
    const target = sections.findIndex(s => s.groups.some(g => g.questions.some(q => q.numbers.includes(n))));
    if (target >= 0) setPart(target);
    setView('questions');
    setTimeout(() => document.getElementById(`q-${n}`)?.scrollIntoView({block: 'center', behavior: 'smooth'}), 50);
  }

  const submit = useCallback(async () => {
    setBusy(true);
    setError('');
    if (timer.current) clearTimeout(timer.current);
    const result = await bff<{attempt: ReadingAttempt}>(`reading/attempts/${attempt.uuid}/submit`, {method: 'POST', body: {answers}});
    if (!result.ok) {
      setBusy(false);
      setError(submitErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    for (const k of ['answers', 'flags', 'marks']) {
      try { window.localStorage.removeItem(`reading:${attempt.uuid}:${k}`); } catch { /* ignore */ }
    }
    dialog.current?.close();
    router.refresh();
  }, [answers, attempt.uuid, router]);

  // Strict mode: at the end the answers are submitted as they are (once).
  useEffect(() => {
    if (strict && left === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [strict, left, submit]);

  async function abandon() {
    if (!window.confirm(t('leaveConfirm'))) return;
    const result = await bff(`reading/attempts/${attempt.uuid}/abandon`, {method: 'POST', body: {}});
    if (result.ok) router.push('/ielts/reading');
    else setError('unavailable');
  }

  if (!section) return null;
  return <section className="page reading-runner">
    <header className="reading-bar">
      <div>
        <p className="eyebrow">{attempt.test.title}{attempt.mode === 'section' ? ` · ${t('part', {n: attempt.section ?? 0})}` : ''}</p>
        <p className={`reading-timer${left < 5 * 60 * 1000 ? ' warn' : ''}`} role="timer" aria-live="off">
          {left > 0 ? t('timeLeft', {time: minutes(left)}) : strict ? t('timeUpStrict') : t('timeUpSoft')}
        </p>
      </div>
      <p className={`save-state ${saved}`} role="status">{t(`saved.${saved}`)}</p>
      <div className="actions">
        <button type="button" className="button primary" disabled={busy} onClick={() => dialog.current?.showModal()}>{t('submit')}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => void abandon()}>{t('leave')}</button>
      </div>
    </header>
    {sections.length > 1 && <nav className="reading-parts-tabs" aria-label={t('parts')}>
      {sections.map((s, i) => <button key={s.position} type="button" aria-current={i === part ? 'true' : undefined} onClick={() => setPart(i)}>{t('part', {n: s.position})}</button>)}
    </nav>}
    <div className="reading-view-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={view === 'text'} onClick={() => setView('text')}>{t('tabText')}</button>
      <button type="button" role="tab" aria-selected={view === 'questions'} onClick={() => setView('questions')}>{t('tabQuestions')}</button>
    </div>
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    <div className={`reading-columns show-${view}`}>
      <Passage section={section} marks={marks[part] ?? {}} onMark={mark}/>
      <div className="reading-questions">
        {section.groups.map((group, gi) => <section key={gi} className="reading-group">
          <GroupHead group={group}/>
          {group.questions.map(q => {
            const n = q.numbers[0];
            const flagged = flags.includes(n);
            return <div key={n} id={`q-${n}`} className={`reading-question${flagged ? ' flagged' : ''}`}>
              <p className="reading-number">{q.numbers.join('–')}</p>
              <div>
                <Prompt group={group} question={q} input={<QuestionInput group={group} question={q} answers={answers} set={set}/>}/>
                <button type="button" className="text-button flag" aria-pressed={flagged}
                  onClick={() => setFlags(flagged ? flags.filter(f => f !== n) : [...flags, n])}>{flagged ? t('unflag') : t('flag')}</button>
              </div>
            </div>;
          })}
        </section>)}
      </div>
    </div>
    <nav className="reading-map" aria-label={t('map')}>
      {numbers.map(n => <button key={n} type="button" onClick={() => go(n)}
        className={[answers[n]?.trim() ? 'answered' : '', flags.includes(n) ? 'flagged' : ''].join(' ')}
        aria-label={t('mapItem', {n, state: answers[n]?.trim() ? t('answered') : t('unanswered')})}>{n}</button>)}
    </nav>
    <dialog ref={dialog} className="dialog" aria-labelledby="reading-submit-title">
      <h2 id="reading-submit-title">{t('submitTitle')}</h2>
      <p>{t('submitBody', {answered, total: numbers.length})}</p>
      {flags.length > 0 && <p>{t('submitFlags', {count: flags.length})}</p>}
      <div className="actions">
        <button type="button" className="button primary" disabled={busy} onClick={() => void submit()}>{busy ? t('submitting') : t('submitConfirm')}</button>
        <button type="button" className="button" disabled={busy} onClick={() => dialog.current?.close()}>{t('keepWorking')}</button>
      </div>
    </dialog>
  </section>;
}

/** After the submit: score, band, results by type, every question with its key, evidence and explanation. */
export function ReadingReview({attempt, language}: {attempt: ReadingAttempt; language: FeedbackLanguage}) {
  const t = useTranslations('Reading');
  const sections = attempt.sections ?? [];
  const result = attempt.result;
  const [part, setPart] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<'text' | 'questions'>('questions');
  const rows = useMemo(() => new Map((result?.questions ?? []).map(r => [r.number, r])), [result]);
  const section = sections[part];
  const activeEvidence = useMemo(() => {
    for (const g of section?.groups ?? []) for (const q of g.questions) if (active !== null && q.numbers.includes(active)) return q.evidence ?? null;
    return null;
  }, [section, active]);

  function show(n: number) {
    setActive(n);
    setView('text');
    setTimeout(() => document.getElementById('reading-evidence')?.scrollIntoView({block: 'center', behavior: 'smooth'}), 50);
  }

  if (!result || !section) return null;
  return <section className="page reading-review">
    <Link className="back" href="/ielts/reading">{t('back')}</Link>
    <p className="eyebrow">{attempt.test.title}{attempt.mode === 'section' ? ` · ${t('part', {n: attempt.section ?? 0})}` : ''}</p>
    <h1>{t('reviewTitle')}</h1>
    <div className="reading-score" role="status">
      <p className="range"><span className="range-value">{t('score', {correct: result.correct, total: result.total})}</span><span className="range-note">{t('scoreNote')}</span></p>
      {attempt.mode === 'test' && (attempt.estimate
        ? <p className="range"><span className="range-value" aria-label={t('rangeLabel', {low: band(attempt.estimate.low), high: band(attempt.estimate.high)})}>
          ≈ {band(attempt.estimate.low)}–{band(attempt.estimate.high)}</span>
          <span className="range-note">{attempt.estimate.precision === 'approximate' ? t('approximate') : t('calibrated')}</span></p>
        : <p>{t('belowThreshold')}</p>)}
      {attempt.mode === 'section' && <p className="hint">{t('sectionNoBand')}</p>}
    </div>
    <table className="reading-types">
      <caption>{t('byType')}</caption>
      <thead><tr><th scope="col">{t('typeColumn')}</th><th scope="col">{t('correctColumn')}</th></tr></thead>
      <tbody>{result.by_type.map(x => <tr key={x.type}><td>{t(`types.${x.type}`)}</td><td>{x.correct} / {x.total}</td></tr>)}</tbody>
    </table>
    <p className="hint">{t('bandNote')} <Link href="/guide/reading" locale="en">{t('guideLink')}</Link></p>
    {sections.length > 1 && <nav className="reading-parts-tabs" aria-label={t('parts')}>
      {sections.map((s, i) => <button key={s.position} type="button" aria-current={i === part ? 'true' : undefined} onClick={() => { setPart(i); setActive(null); }}>{t('part', {n: s.position})}</button>)}
    </nav>}
    <div className="reading-view-tabs" role="tablist">
      <button type="button" role="tab" aria-selected={view === 'text'} onClick={() => setView('text')}>{t('tabText')}</button>
      <button type="button" role="tab" aria-selected={view === 'questions'} onClick={() => setView('questions')}>{t('tabQuestions')}</button>
    </div>
    <div className={`reading-columns show-${view}`}>
      <Passage section={section} marks={{}} evidence={activeEvidence}/>
      <div className="reading-questions">
        {section.groups.map((group, gi) => <section key={gi} className="reading-group">
          <GroupHead group={group}/>
          {group.questions.map(q => {
            const n = q.numbers[0];
            const marks = q.numbers.map(x => rows.get(x));
            const right = marks.every(m => m?.correct);
            const given = q.numbers.map(x => rows.get(x)?.given).filter(Boolean) as string[];
            const explanation = q.explanation?.[language] ?? q.explanation?.en;
            return <div key={n} id={`q-${n}`} className={`reading-question ${right ? 'right' : 'wrong'}${active === n ? ' active' : ''}`}>
              <p className="reading-number">{q.numbers.join('–')}</p>
              <div>
                <p className="reading-prompt">{q.prompt}</p>
                {group.type === 'multiple_choice' || group.type === 'multiple_choice_multi'
                  ? <ul className="reading-choices">{group.options?.map(o => <li key={o.id}><strong>{o.id}</strong> {o.text}</li>)}</ul> : null}
                <p className="reading-answer">
                  <span className={right ? 'ok' : 'no'}>{right ? '✓' : '✗'}</span> {t('yourAnswer')}: <strong>{given.length ? given.map(g => optionText(group, g)).join(', ') : t('noAnswer')}</strong>
                  {!right && <> · {t('correctAnswer')}: <strong>{(q.answer ?? []).map(a => optionText(group, a)).join(group.type === 'multiple_choice_multi' ? ', ' : ' / ')}</strong></>}
                </p>
                {explanation && <p className="reading-explanation">{explanation}</p>}
                {q.evidence && <button type="button" className="text-button" onClick={() => show(n)}>{t('showInText')}</button>}
              </div>
            </div>;
          })}
        </section>)}
      </div>
    </div>
    <p className="hint">{t('disclaimer')}</p>
    <div className="actions"><Link className="button" href="/ielts/reading">{t('again')}</Link></div>
  </section>;
}
