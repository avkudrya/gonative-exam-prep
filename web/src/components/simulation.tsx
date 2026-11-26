'use client';
import {useFormatter, useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {Attempt, FeedbackLanguage, WritingSession} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {forgetLocalDraft, useDraftSync} from '../lib/draft-sync';
import {MAX_ESSAY_CHARS, taskGenre, taskRules, wordsIn} from '../lib/writing';
import {ChartView} from './chart-view';

/*
 * P5.12: full Writing simulation (owner decisions 2026-11-26): a random pair of library tasks with one swap, both tasks on one
 * 60-minute timer — soft by default (warns, lets the learner finish), strict on request (submits at the end) — one submit, then a
 * summary with the Writing range and links to the two ordinary feedback pages.
 */

const band = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const POLL_MS = 5000;
const startErrors = new Set(['exams_simulation_unavailable', 'exams_simulation_task_unavailable', 'exams_draft_limit', 'exams_rate_limited', 'rate_limited', 'unauthenticated', 'offline']);
const submitErrors = new Set(['exams_monthly_quota_exhausted', 'exams_monthly_ai_budget_exhausted', 'exams_concurrency_limit', 'exams_assessment_unavailable',
  'exams_response_empty', 'exams_requests_rate_limited', 'exams_rate_limited', 'rate_limited', 'not_saved', 'unauthenticated', 'offline']);

function requestKey() {
  const random = crypto.getRandomValues(new Uint8Array(12));
  return `simulation-${Array.from(random, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Choose the exam and start; the recent simulations below. */
export function SimulationStart({exams, defaultExam, sessions}: {
  exams: {key: string; name: string}[]; defaultExam: string | null; sessions: WritingSession[];
}) {
  const t = useTranslations('Simulation');
  const format = useFormatter();
  const router = useRouter();
  const [exam, setExam] = useState(exams.find(e => e.key === defaultExam)?.key ?? exams[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = (key: string) => exams.find(e => e.key === key)?.name ?? key;

  async function create() {
    setBusy(true);
    setError('');
    const result = await bff<{session: WritingSession}>('writing-sessions', {body: {exam_key: exam}});
    if (!result.ok) {
      setBusy(false);
      setError(startErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    router.push(`/ielts/writing/simulation/${result.data.session.uuid}`);
  }

  return <section className="page simulation">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <h1>{t('title')}</h1>
    <p className="lead">{t('lead')}</p>
    <ul className="facts">
      <li>{t('factTasks')}</li>
      <li>{t('factTimer')}</li>
      <li>{t('factQuota')}</li>
      <li>{t('factEstimate')}</li>
    </ul>
    {exams.length > 1 && <fieldset className="choice">
      <legend>{t('exam')}</legend>
      {exams.map(e => <label key={e.key}><input type="radio" name="exam" value={e.key} checked={exam === e.key} onChange={() => setExam(e.key)}/> {e.name}</label>)}
    </fieldset>}
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    <div className="actions">
      <button type="button" className="button primary" disabled={busy || !exam} onClick={() => void create()}>{busy ? t('preparing') : t('choosePair')}</button>
    </div>
    {sessions.length > 0 && <section aria-labelledby="past-title" className="recent">
      <h2 id="past-title">{t('pastTitle')}</h2>
      <ul className="attempts">
        {sessions.map(s => <li key={s.uuid}>
          <Link href={`/ielts/writing/simulation/${s.uuid}`}>
            <span>{name(s.exam_key)} · {s.submitted_at ? format.dateTime(new Date(s.submitted_at), {day: 'numeric', month: 'short', year: 'numeric'}) : ''}</span>
            <span>{s.summary?.writing ? `≈ ${band(s.summary.writing.low)}–${band(s.summary.writing.high)}` : t(`summaryStatus.${s.summary?.status ?? 'pending'}`)}</span>
          </Link>
        </li>)}
      </ul>
    </section>}
  </section>;
}

function TaskPrompt({task, examKey, examName}: {task: WritingSession['tasks'][number]; examKey: string; examName: string}) {
  const t = useTranslations('Simulation');
  const genre = taskGenre(examKey, task.task_key);
  const {minutes, minWords} = taskRules(task.task_key);
  const practice = task.practice_task;
  return <article className="prompt-card">
    <div className="prompt-meta">
      <span>{examName} · {t(`taskLabel.${genre}`)}</span>
      <span className="badge">{t('unofficial')}</span>
    </div>
    <h2 className="prompt-title">{practice?.topic ?? t('taskMissing')}</h2>
    {practice && <p className="prompt-text task-prompt">{practice.prompt.text}</p>}
    {practice?.prompt.stimulus?.format === 'chart-spec/1' && <ChartView spec={practice.prompt.stimulus}/>}
    <p className="hint">{t('taskRules', {minutes: task.time_minutes ?? minutes, words: minWords})}</p>
  </article>;
}

/** The pair before the start: one swap, the timer mode, the start. */
export function SimulationReady({session, examName}: {session: WritingSession; examName: string}) {
  const t = useTranslations('Simulation');
  const router = useRouter();
  const [mode, setMode] = useState<'soft' | 'strict'>('soft');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function act(action: 'swap' | 'start' | 'abandon') {
    setBusy(action);
    setError('');
    const result = await bff<{session: WritingSession}>(`writing-sessions/${session.uuid}/${action}`, {body: action === 'start' ? {timer_mode: mode} : {}});
    if (!result.ok) {
      setBusy(null);
      setError(startErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    if (action === 'abandon') {
      router.push('/ielts/writing/simulation');
      return;
    }
    setBusy(null);
    router.refresh();
  }

  return <section className="page simulation">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <h1>{t('readyTitle')}</h1>
    <p className="lead">{t('readyLead', {minutes: Math.round(session.duration_seconds / 60)})}</p>
    {session.tasks.map(task => <TaskPrompt key={task.task_key} task={task} examKey={session.exam_key} examName={examName}/>)}
    <fieldset className="choice">
      <legend>{t('timerMode')}</legend>
      <label><input type="radio" name="timer" value="soft" checked={mode === 'soft'} onChange={() => setMode('soft')}/> {t('timerSoft')}</label>
      <label><input type="radio" name="timer" value="strict" checked={mode === 'strict'} onChange={() => setMode('strict')}/> {t('timerStrict')}</label>
    </fieldset>
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    <div className="actions">
      <button type="button" className="button primary" disabled={busy !== null} onClick={() => void act('start')}>{busy === 'start' ? t('starting') : t('start')}</button>
      {session.swaps_left > 0 && <button type="button" className="button" disabled={busy !== null} onClick={() => void act('swap')}>{t('swap')}</button>}
      <button type="button" className="text-button" disabled={busy !== null} onClick={() => void act('abandon')}>{t('leave')}</button>
    </div>
    {session.swaps_left === 0 && <p className="hint">{t('swapUsed')}</p>}
  </section>;
}

/** Both answers on one timer. Drafts save as in the ordinary editor; the submit sends both once. */
export function SimulationWriter({session, attempts, examName, remaining, limit, feedbackLanguage}: {
  session: WritingSession; attempts: [Attempt, Attempt]; examName: string; remaining: number; limit: number; feedbackLanguage: FeedbackLanguage;
}) {
  const t = useTranslations('Simulation');
  const e = useTranslations('Editor');
  const router = useRouter();
  const drafts = [useDraftSync(attempts[0].uuid, attempts[0].response_text, attempts[0].revision),
    useDraftSync(attempts[1].uuid, attempts[1].response_text, attempts[1].revision)];
  const [active, setActive] = useState(0);
  // The deadline is the server's; the offset corrects the device clock.
  const [offset] = useState(() => Date.parse(session.server_time) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef('');
  const autoSubmitted = useRef(false);
  // A started session always has a deadline; without one the time counts as up.
  const deadline = session.deadline_at ? Date.parse(session.deadline_at) : 0;
  const left = Math.max(0, deadline - (now + offset));
  const strict = session.timer_mode === 'strict';
  const words = drafts.map(d => wordsIn(d.text));
  const written = words.filter(w => w > 0).length;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  async function submit() {
    if (!key.current) key.current = requestKey();
    setBusy(true);
    setError('');
    const saved = await Promise.all(drafts.map(d => d.saveNow()));
    if (saved.includes(false) && !strict) {
      setBusy(false);
      setError('not_saved');
      return;
    }
    const result = await bff<{session: WritingSession}>(`writing-sessions/${session.uuid}/submit`, {method: 'POST', body: {}, idempotencyKey: key.current});
    if (!result.ok) {
      setBusy(false);
      setError(submitErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    attempts.forEach(a => forgetLocalDraft(a.uuid));
    dialog.current?.close();
    router.refresh();
  }

  // Strict mode: at the end the answers are submitted as they are (once).
  useEffect(() => {
    if (strict && left === 0 && !autoSubmitted.current && written > 0) {
      autoSubmitted.current = true;
      void submit();
    }
  });

  const minutesLeft = Math.floor(left / 60000);
  const clock = `${String(minutesLeft).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  const task = session.tasks[active];
  const draft = drafts[active];
  const genre = taskGenre(session.exam_key, task.task_key);
  const {minWords} = taskRules(task.task_key);
  const locked = draft.state === 'locked' || draft.state === 'expired' || (strict && left === 0);

  return <section className="page editor simulation">
    <div className="simulation-bar">
      <div className={`timer ${left === 0 ? 'done' : left < 5 * 60000 ? 'soon' : ''}`} role="timer" aria-label={t('timeLeft')}>
        <span className="timer-value" aria-live={left === 0 || minutesLeft === 5 ? 'polite' : 'off'}>{left === 0 ? t('timeUp') : clock}</span>
      </div>
      <span className="hint">{strict ? t('timerStrictShort') : t('timerSoftShort')}</span>
    </div>
    {left === 0 && !strict && <p className="feedback" role="status">{t('timeUpSoft')}</p>}
    <div className="tabs" role="tablist" aria-label={t('tasks')}>
      {session.tasks.map((x, i) => <button key={x.task_key} type="button" role="tab" aria-selected={active === i} onClick={() => setActive(i)}>
        {t(`taskLabel.${taskGenre(session.exam_key, x.task_key)}`)} · {t('words', {count: words[i]})} · {e(`sync.${drafts[i].state}`)}
      </button>)}
    </div>
    <TaskPrompt task={task} examKey={session.exam_key} examName={examName}/>
    {draft.conflict && <div className="conflict" role="alert">
      <p>{e('conflict.body')}</p>
      <div className="actions">
        <button type="button" className="button" onClick={() => draft.resolveConflict('mine')}>{e('conflict.mine')}</button>
        <button type="button" className="button" onClick={() => draft.resolveConflict('theirs')}>{e('conflict.theirs')}</button>
      </div>
    </div>}
    <label className="sr-only" htmlFor={`answer-${active}`}>{e({essay: 'essayLabel', report: 'reportLabel', letter: 'letterLabel'}[genre])}</label>
    <textarea key={active} id={`answer-${active}`} className="essay" value={draft.text} lang="en" spellCheck={false} autoCorrect="off" autoCapitalize="sentences"
      readOnly={locked} placeholder={e({essay: 'placeholder', report: 'placeholderReport', letter: 'placeholderLetter'}[genre])}
      onChange={event => draft.setText(event.target.value)}/>
    <p className="hint">
      {words[active] < minWords ? e('underMinimum', {words: minWords}) : e('overMinimum')}
      {Array.from(draft.text).length > MAX_ESSAY_CHARS && <> {e('tooLong', {max: MAX_ESSAY_CHARS})}</>}
    </p>
    {/* The automatic submit of a strict session reports here; a manual one in the dialog. */}
    {error && strict && left === 0 && <p className="feedback error" role="alert">{t(`errors.${error}`)}
      {' '}<button type="button" className="text-button" disabled={busy} onClick={() => void submit()}>{t('retry')}</button></p>}
    <div className="editor-actions">
      <button type="button" className="button primary" disabled={busy || written === 0} onClick={() => { key.current = requestKey(); setError(''); dialog.current?.showModal(); }}>
        {busy ? t('sending') : t('submit')}
      </button>
    </div>
    <dialog ref={dialog} className="dialog" aria-labelledby="simulation-submit-title">
      <h2 id="simulation-submit-title">{t('submitTitle')}</h2>
      <ul className="facts">
        {session.tasks.map((x, i) => <li key={x.task_key}>{t(`taskLabel.${taskGenre(session.exam_key, x.task_key)}`)}: {t('words', {count: words[i]})}
          {words[i] === 0 ? <> — {t('notWritten')}</> : words[i] < taskRules(x.task_key).minWords && <> — {t('underMinimum', {min: taskRules(x.task_key).minWords})}</>}</li>)}
        <li>{t('submitQuota', {count: written, remaining, limit})}</li>
        <li>{t('submitLanguage', {language: t(`languages.${feedbackLanguage}`)})}</li>
        <li>{t('submitFrozen')}</li>
      </ul>
      {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
      <div className="actions">
        <button type="button" className="button primary" disabled={busy || remaining < written} onClick={() => void submit()}>{busy ? t('sending') : t('confirm')}</button>
        <button type="button" className="button" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancel')}</button>
      </div>
    </dialog>
  </section>;
}

/** After the submit: the Writing range once both feedback pages are ready, each task's range and its feedback. */
export function SimulationSummary({session, examName}: {session: WritingSession; examName: string}) {
  const t = useTranslations('Simulation');
  const router = useRouter();
  const summary = session.summary;
  const pending = summary?.status === 'pending';

  useEffect(() => {
    if (!pending) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const result = await bff<{session: WritingSession}>(`writing-sessions/${session.uuid}`);
      if (stop) return;
      if (result.ok && result.data.session.summary?.status !== 'pending') {
        router.refresh();
        return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [pending, session.uuid, router]);

  const range = (estimate: {low: number; high: number} | null) => estimate ? `≈ ${band(estimate.low)}–${band(estimate.high)}` : null;
  return <section className="page simulation">
    <Link className="back" href="/ielts/writing/simulation">{t('backToSimulations')}</Link>
    <p className="eyebrow">{examName}</p>
    <h1>{t('summaryTitle')}</h1>
    <div className="simulation-score" role="status" aria-live="polite">
      {summary?.writing ? <>
        <p className="range"><span className="range-value" aria-label={t('rangeLabel', {low: band(summary.writing.low), high: band(summary.writing.high)})}>{range(summary.writing)}</span>
          <span className="range-note">{summary.writing.precision === 'approximate' ? t('approximate') : t('calibrated')}</span></p>
        <p className="hint">{t('weights')}</p>
      </> : <p>{t(`summaryStatus.${summary?.status ?? 'pending'}`)}</p>}
      {pending && <span className="spinner" aria-hidden="true"/>}
    </div>
    <ul className="simulation-tasks">
      {(summary?.tasks ?? []).map((x, i) => <li key={x.task_key}>
        <h2>{t(`taskLabel.${taskGenre(session.exam_key, x.task_key)}`)}</h2>
        <p className="prompt-title">{session.tasks[i]?.practice_task?.topic}</p>
        <p className="range">{range(x.estimate) ?? t(`taskStatus.${['queued', 'running'].includes(x.status) ? 'pending' : x.status === 'not_submitted' ? 'not_submitted'
          : ['assessed', 'partial'].includes(x.status) ? 'no_range' : 'failed'}`)}</p>
        {x.attempt && <Link className="button" href={`/ielts/writing/${x.attempt}`}>{t('openFeedback')}</Link>}
      </li>)}
    </ul>
    <p className="hint">{t('disclaimer')}</p>
    <div className="actions"><Link className="button" href="/ielts/writing/simulation">{t('again')}</Link></div>
  </section>;
}
