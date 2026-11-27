'use client';
import {renderMapSvg, type MapSpec} from '@gonative/exam-domain';
import {useFormatter, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {FeedbackLanguage, ListeningAttempt, ListeningGroup, ListeningIndex, ListeningPart, ListeningSummary, ReadingGroup} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {band, GroupHead, minutes, optionText, Prompt, QuestionInput, readStored, useLocal} from './reading';

/*
 * P7.10 (docs/phase-7/P7.6-listening-design.md §10): IELTS Listening as on the computer-delivered test.
 * - Strict: the recording plays once on the server's schedule, without pause or rewind; after a reload it continues where it
 *   would be now. Each file loads before its part starts. A part's answers close after its checking pause.
 * - Soft (practice): pause, 10 seconds back and a slower speed, all in the browser.
 * - The questions beside the player, a question map with "review later" flags, autosave as in Reading.
 * - The review: score, the approximate band after a full strict test, by part and by type, every question with its key and
 *   explanation, "Listen to this place" from the start of the turn where the answer is heard, and the transcript.
 */

type Answers = Record<string, string>;
type Question = ListeningGroup['questions'][number];

const SAVE_MS = 1500;
const GRACE_MS = 30000; // exam.listening.grace_seconds
const DRIFT_S = 1.5;
const SPEEDS = [0.85, 0.9, 1] as const;
const startErrors = new Set(['exams_listening_unavailable', 'exams_listening_quota_exhausted', 'exams_listening_test_unknown', 'exams_rate_limited', 'rate_limited', 'unauthenticated', 'offline']);
const submitErrors = new Set(['exams_listening_not_open', 'exams_listening_unavailable', 'exams_rate_limited', 'rate_limited', 'unauthenticated', 'offline']);
const numbersOf = (parts: ListeningPart[]) => parts.flatMap(p => p.groups.flatMap(g => g.questions.flatMap(q => q.numbers)));
const roughMinutes = (ms: number) => Math.max(1, Math.round(ms / 60000));

/** The letters of a map are its options; the other groups as they are. */
function inputGroup(group: ListeningGroup): ReadingGroup {
  if (group.type !== 'map_labelling' || !group.figure) return group as ReadingGroup;
  const letters = ((group.figure as MapSpec).features ?? []).map(f => f.letter).filter((l): l is string => !!l).sort();
  return {...group, type: 'matching_features', options: letters.map(l => ({id: l, text: l}))} as ReadingGroup;
}

function MapFigure({figure}: {figure: unknown}) {
  const t = useTranslations('Listening');
  const svg = useMemo(() => {
    try {
      return renderMapSvg(figure as MapSpec);
    } catch {
      return '';
    }
  }, [figure]);
  return svg ? <figure className="listening-map" aria-label={t('mapLabel')} dangerouslySetInnerHTML={{__html: svg}}/> : null;
}

function Group({group, children}: {group: ListeningGroup; children: React.ReactNode}) {
  return <section className="reading-group">
    <GroupHead group={group as ReadingGroup}/>
    {group.title && <p className="listening-group-title">{group.title}</p>}
    {group.figure && <MapFigure figure={group.figure}/>}
    {children}
  </section>;
}

/** The tests, the sound check, the month's count and the recent attempts. */
export function ListeningHome({index}: {index: ListeningIndex}) {
  const t = useTranslations('Listening');
  const format = useFormatter();
  const router = useRouter();
  const [timer, setTimer] = useState<'strict' | 'soft'>('strict');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const exhausted = index.usage.remaining === 0;

  async function start(test: string, mode: 'test' | 'part', part?: number) {
    setBusy(`${test}:${part ?? 0}`);
    setError('');
    const result = await bff<{attempt: ListeningAttempt}>('listening/attempts', {body: {test, mode, ...(part ? {part} : {}), timer_mode: timer}});
    if (!result.ok) {
      setBusy(null);
      setError(startErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    router.push(`/ielts/listening/${result.data.attempt.uuid}`);
  }

  return <section className="page reading-home listening-home">
    <h1>{t('title')}</h1>
    <p className="lead">{t('lead')}</p>
    <ul className="facts">
      <li>{t('factFormat')}</li>
      <li>{t('factModes')}</li>
      <li>{t('factBand')}</li>
    </ul>
    {index.sound_check && <section className="listening-sound-check" aria-labelledby="listening-sound">
      <h2 id="listening-sound">{t('soundCheckTitle')}</h2>
      <p>{t('soundCheckBody')}</p>
      <audio controls preload="none" src={index.sound_check.url}/>
    </section>}
    <p className="hint" role="status">{index.usage.limit === null ? t('usageUnlimited') : t('usage', {remaining: index.usage.remaining ?? 0, limit: index.usage.limit})}</p>
    <fieldset className="choice">
      <legend>{t('mode')}</legend>
      <label><input type="radio" name="mode" value="strict" checked={timer === 'strict'} onChange={() => setTimer('strict')}/> {t('modeStrict')}</label>
      <label><input type="radio" name="mode" value="soft" checked={timer === 'soft'} onChange={() => setTimer('soft')}/> {t('modeSoft')}</label>
    </fieldset>
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    {index.tests.length === 0 && <p>{t('noTests')}</p>}
    <ul className="reading-tests">
      {index.tests.map(test => <li key={test.uuid} className="reading-test">
        <div className="reading-test-head">
          <h2>{test.title}</h2>
          {test.review && <span className="badge">{t('reviewBadge')}</span>}
        </div>
        <button type="button" className="button primary" disabled={busy !== null || exhausted} onClick={() => void start(test.uuid, 'test')}>
          {busy === `${test.uuid}:0` ? t('starting') : t('startTest', {minutes: roughMinutes(test.parts.reduce((s, p) => s + p.duration_ms, 0))})}
        </button>
        <ol className="reading-parts">
          {test.parts.map(p => <li key={p.position}>
            <span><strong>{t('part', {n: p.position})}</strong> {p.topic} <span className="muted">· {t('questionsRange', {from: p.numbers[0], to: p.numbers[1]})}</span></span>
            <button type="button" className="button" disabled={busy !== null || exhausted} onClick={() => void start(test.uuid, 'part', p.position)}>
              {busy === `${test.uuid}:${p.position}` ? t('starting') : t('startPart', {minutes: roughMinutes(p.duration_ms)})}
            </button>
          </li>)}
        </ol>
      </li>)}
    </ul>
    {index.attempts.length > 0 && <section aria-labelledby="listening-past" className="recent">
      <h2 id="listening-past">{t('pastTitle')}</h2>
      <ul className="attempts">
        {index.attempts.map(a => <li key={a.uuid}>
          <Link href={`/ielts/listening/${a.uuid}`}>
            <span>{a.test.title}{a.mode === 'part' ? ` · ${t('part', {n: a.part ?? 0})}` : ''} · {a.submitted_at ? format.dateTime(new Date(a.submitted_at), {day: 'numeric', month: 'short'}) : ''}</span>
            <span>{scoreLine(a)}</span>
          </Link>
        </li>)}
      </ul>
    </section>}
    <p className="hint">{t('synthetic')}</p>
    <p className="hint">{t('disclaimer')}</p>
  </section>;
}

function scoreLine(a: ListeningSummary) {
  if (a.correct === null || a.total === null) return '';
  return `${a.correct}/${a.total}${a.estimate ? ` · ≈ ${band(a.estimate.low)}–${band(a.estimate.high)}` : ''}`;
}

/** Practice player: pause, 10 seconds back, a slower speed. */
function SoftPlayer({part}: {part: ListeningPart}) {
  const t = useTranslations('Listening');
  const audio = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState<number>(1);
  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed, part.audio?.url]);
  if (!part.audio) return <p className="hint">{t('audioUnavailable')}</p>;
  return <div className="listening-player">
    <audio ref={audio} controls preload="auto" src={part.audio.url} aria-label={t('recording', {n: part.position})}/>
    <div className="listening-controls">
      <button type="button" className="button" onClick={() => { if (audio.current) audio.current.currentTime = Math.max(0, audio.current.currentTime - 10); }}>{t('back10')}</button>
      <label>{t('speed')} <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>
        {SPEEDS.map(s => <option key={s} value={s}>{s === 1 ? t('speedNormal') : `${s}×`}</option>)}
      </select></label>
    </div>
  </div>;
}

/**
 * Strict player: one hidden element per part; the one whose time it is plays from where the schedule is now. A browser may
 * refuse to play without a click (after a reload): then a button continues at the right moment.
 */
function StrictPlayer({parts, now, onBlocked}: {parts: ListeningPart[]; now: number; onBlocked: (blocked: boolean) => void}) {
  const t = useTranslations('Listening');
  const refs = useRef<Record<number, HTMLAudioElement | null>>({});
  const [volume, setVolume] = useState(1);
  const [blocked, setBlocked] = useState(false);

  const sync = useCallback(() => {
    for (const p of parts) {
      const el = refs.current[p.position];
      if (!el || !p.starts_at || !p.ends_at) continue;
      const starts = Date.parse(p.starts_at);
      const ends = Date.parse(p.ends_at);
      if (now < starts || now >= ends) {
        if (!el.paused) el.pause();
        continue;
      }
      const at = (now - starts) / 1000;
      if (Math.abs(el.currentTime - at) > DRIFT_S) el.currentTime = at;
      if (el.paused) {
        el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
      }
    }
  }, [parts, now]);

  useEffect(() => { sync(); }, [sync]);
  useEffect(() => { onBlocked(blocked); }, [blocked, onBlocked]);
  useEffect(() => {
    for (const el of Object.values(refs.current)) if (el) el.volume = volume;
  }, [volume, parts]);

  return <div className="listening-player strict">
    {parts.map(p => p.audio ? <audio key={p.position} ref={el => { refs.current[p.position] = el; }} preload="auto" src={p.audio.url}/> : null)}
    <label className="listening-volume">{t('volume')} <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))}/></label>
    {blocked && <button type="button" className="button primary" onClick={() => { setBlocked(false); sync(); }}>{t('continueListening')}</button>}
  </div>;
}

/** Answering: the player, the questions, the question map, autosave and the submit. */
export function ListeningRunner({attempt: initial}: {attempt: ListeningAttempt}) {
  const t = useTranslations('Listening');
  const router = useRouter();
  const [attempt, setAttempt] = useState(initial);
  const parts = useMemo(() => attempt.parts ?? [], [attempt.parts]);
  const answersKey = `listening:${attempt.uuid}:answers`;
  const [answers, setAnswers] = useState<Answers>(initial.answers ?? {});
  const [flags, setFlags] = useLocal<number[]>(`listening:${attempt.uuid}:flags`, []);
  const [chosen, setChosen] = useState<number | null>(null);
  const [saved, setSaved] = useState<'saved' | 'saving' | 'error'>('saved');
  const [offset] = useState(() => Date.parse(initial.server_time) - Date.now());
  const [clock, setClock] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitted = useRef(false);
  const strict = attempt.timer_mode === 'strict';
  const now = clock + offset;
  const numbers = useMemo(() => numbersOf(parts), [parts]);
  const answered = numbers.filter(n => answers[n]?.trim()).length;

  // Strict: which part is on now (or next), and whether the recording has not started yet.
  const scheduled = strict ? parts.findIndex(p => p.ends_at && now < Date.parse(p.ends_at)) : -1;
  const live = strict && scheduled >= 0 ? parts[scheduled] : null;
  const waiting = live?.starts_at ? Math.max(0, Date.parse(live.starts_at) - now) : 0;
  const deadline = attempt.deadline_at ? Date.parse(attempt.deadline_at) : 0;
  const index = chosen ?? (strict ? Math.max(0, scheduled) : 0);
  const part = parts[Math.min(index, parts.length - 1)];
  const closed = (p: ListeningPart) => strict && !!p.ends_at && now > Date.parse(p.ends_at) + GRACE_MS;

  useEffect(() => {
    const tick = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  // Strict: the link of the next part comes from the server shortly before it starts.
  const missing = strict && parts.some(p => !p.audio && p.starts_at && Date.parse(p.starts_at) - now < 100000 && p.ends_at && now < Date.parse(p.ends_at));
  useEffect(() => {
    if (!missing) return;
    const poll = setTimeout(async () => {
      const result = await bff<{attempt: ListeningAttempt}>(`listening/attempts/${attempt.uuid}`);
      if (result.ok) setAttempt(a => ({...result.data.attempt, answers: a.answers}));
    }, 3000);
    return () => clearTimeout(poll);
  }, [missing, attempt.uuid, clock]);

  const save = useCallback(async (next: Answers) => {
    setSaved('saving');
    const result = await bff(`listening/attempts/${attempt.uuid}/answers`, {method: 'PUT', body: {answers: next}});
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
    if (stored && JSON.stringify(stored) !== JSON.stringify(initial.answers ?? {})) {
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

  function go(n: number) {
    const target = parts.findIndex(p => p.groups.some(g => g.questions.some(q => q.numbers.includes(n))));
    if (target >= 0) setChosen(target);
    setTimeout(() => document.getElementById(`q-${n}`)?.scrollIntoView({block: 'center', behavior: 'smooth'}), 50);
  }

  const submit = useCallback(async () => {
    setBusy(true);
    setError('');
    if (timer.current) clearTimeout(timer.current);
    const result = await bff<{attempt: ListeningAttempt}>(`listening/attempts/${attempt.uuid}/submit`, {method: 'POST', body: {answers}});
    if (!result.ok) {
      setBusy(false);
      setError(submitErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    for (const k of ['answers', 'flags']) {
      try { window.localStorage.removeItem(`listening:${attempt.uuid}:${k}`); } catch { /* ignore */ }
    }
    dialog.current?.close();
    router.refresh();
  }, [answers, attempt.uuid, router]);

  // Strict: after the last checking pause the answers are submitted as they are (once).
  useEffect(() => {
    if (strict && deadline > 0 && now > deadline + 2000 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
  }, [strict, deadline, now, submit]);

  async function abandon() {
    if (!window.confirm(t('leaveConfirm'))) return;
    const result = await bff(`listening/attempts/${attempt.uuid}/abandon`, {method: 'POST', body: {}});
    if (result.ok) router.push('/ielts/listening');
    else setError('unavailable');
  }

  if (!part) return null;
  const status = !strict ? t('practice')
    : live === null ? t('finished')
      : waiting > 0 ? t('startsIn', {n: live.position, time: minutes(waiting)})
        : t('playing', {n: live.position, time: minutes(Date.parse(live.ends_at ?? '') - now)});
  return <section className="page reading-runner listening-runner">
    <header className="reading-bar">
      <div>
        <p className="eyebrow">{attempt.test.title}{attempt.mode === 'part' ? ` · ${t('part', {n: attempt.part ?? 0})}` : ''} · {strict ? t('modeStrictShort') : t('modeSoftShort')}</p>
        <p className="reading-timer" role="timer" aria-live="off">{status}</p>
      </div>
      <p className={`save-state ${saved}`} role="status">{t(`saved.${saved}`)}</p>
      <div className="actions">
        <button type="button" className="button primary" disabled={busy} onClick={() => dialog.current?.showModal()}>{t('submit')}</button>
        <button type="button" className="text-button" disabled={busy} onClick={() => void abandon()}>{t('leave')}</button>
      </div>
    </header>
    {strict ? <StrictPlayer parts={parts} now={now} onBlocked={setBlocked}/> : <SoftPlayer part={part}/>}
    {strict && blocked && <p className="hint" role="status">{t('blockedHint')}</p>}
    {parts.length > 1 && <nav className="reading-parts-tabs" aria-label={t('parts')}>
      {parts.map((p, i) => <button key={p.position} type="button" aria-current={i === index ? 'true' : undefined} onClick={() => setChosen(i)}>
        {t('part', {n: p.position})}{closed(p) ? ` · ${t('closed')}` : ''}</button>)}
    </nav>}
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    <div className="reading-questions listening-questions">
      <p className="listening-context">{part.context}</p>
      {closed(part) && <p className="hint" role="status">{t('closedHint')}</p>}
      {part.groups.map((group, gi) => <Group key={gi} group={group}>
        {group.questions.map(q => {
          const n = q.numbers[0];
          const flagged = flags.includes(n);
          const g = inputGroup(group);
          return <div key={n} id={`q-${n}`} className={`reading-question${flagged ? ' flagged' : ''}`}>
            <p className="reading-number">{q.numbers.join('–')}</p>
            <div>
              <Prompt group={g} question={q as ReadingGroup['questions'][number]}
                input={<QuestionInput group={g} question={q as ReadingGroup['questions'][number]} answers={answers} set={set} disabled={closed(part)}/>}/>
              <button type="button" className="text-button flag" aria-pressed={flagged}
                onClick={() => setFlags(flagged ? flags.filter(f => f !== n) : [...flags, n])}>{flagged ? t('unflag') : t('flag')}</button>
            </div>
          </div>;
        })}
      </Group>)}
    </div>
    <nav className="reading-map" aria-label={t('map')}>
      {numbers.map(n => <button key={n} type="button" onClick={() => go(n)}
        className={[answers[n]?.trim() ? 'answered' : '', flags.includes(n) ? 'flagged' : ''].join(' ')}
        aria-label={t('mapItem', {n, state: answers[n]?.trim() ? t('answered') : t('unanswered')})}>{n}</button>)}
    </nav>
    <dialog ref={dialog} className="dialog" aria-labelledby="listening-submit-title">
      <h2 id="listening-submit-title">{t('submitTitle')}</h2>
      <p>{t('submitBody', {answered, total: numbers.length})}</p>
      {strict && live !== null && <p>{t('submitEarly')}</p>}
      {flags.length > 0 && <p>{t('submitFlags', {count: flags.length})}</p>}
      <div className="actions">
        <button type="button" className="button primary" disabled={busy} onClick={() => void submit()}>{busy ? t('submitting') : t('submitConfirm')}</button>
        <button type="button" className="button" disabled={busy} onClick={() => dialog.current?.close()}>{t('keepWorking')}</button>
      </div>
    </dialog>
    <p className="hint">{t('synthetic')}</p>
  </section>;
}

/** After the submit: score, band, by part and by type, every question with its key and explanation, the transcript and replay. */
export function ListeningReview({attempt, language}: {attempt: ListeningAttempt; language: FeedbackLanguage}) {
  const t = useTranslations('Listening');
  const parts = attempt.parts ?? [];
  const result = attempt.result;
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const rows = useMemo(() => new Map((result?.questions ?? []).map(r => [r.number, r])), [result]);
  const part = parts[index];

  function listen(q: Question) {
    const heard = q.heard;
    if (!heard || heard.start_ms === null || !audio.current) return;
    audio.current.currentTime = heard.start_ms / 1000;
    void audio.current.play().catch(() => undefined);
    setTurn(heard.turn);
    setTimeout(() => document.getElementById(`turn-${heard.turn}`)?.scrollIntoView({block: 'center', behavior: 'smooth'}), 50);
  }

  if (!result || !part) return null;
  const strictFull = attempt.mode === 'test' && attempt.timer_mode === 'strict';
  return <section className="page reading-review listening-review">
    <Link className="back" href="/ielts/listening">{t('back')}</Link>
    <p className="eyebrow">{attempt.test.title}{attempt.mode === 'part' ? ` · ${t('part', {n: attempt.part ?? 0})}` : ''} · {attempt.timer_mode === 'strict' ? t('modeStrictShort') : t('modeSoftShort')}</p>
    <h1>{t('reviewTitle')}</h1>
    <div className="reading-score" role="status">
      <p className="range"><span className="range-value">{t('score', {correct: result.correct, total: result.total})}</span><span className="range-note">{t('scoreNote')}</span></p>
      {strictFull && (attempt.estimate
        ? <p className="range"><span className="range-value" aria-label={t('rangeLabel', {low: band(attempt.estimate.low), high: band(attempt.estimate.high)})}>
          ≈ {band(attempt.estimate.low)}–{band(attempt.estimate.high)}</span>
          <span className="range-note">{attempt.estimate.precision === 'approximate' ? t('approximate') : t('calibrated')}</span></p>
        : <p>{t('belowThreshold')}</p>)}
      {!strictFull && <p className="hint">{attempt.mode === 'part' ? t('partNoBand') : t('softNoBand')}</p>}
    </div>
    {result.by_part.length > 1 && <table className="reading-types">
      <caption>{t('byPart')}</caption>
      <thead><tr><th scope="col">{t('partColumn')}</th><th scope="col">{t('correctColumn')}</th></tr></thead>
      <tbody>{result.by_part.map(x => <tr key={x.part}><td>{t('part', {n: x.part})}</td><td>{x.correct} / {x.total}</td></tr>)}</tbody>
    </table>}
    <table className="reading-types">
      <caption>{t('byType')}</caption>
      <thead><tr><th scope="col">{t('typeColumn')}</th><th scope="col">{t('correctColumn')}</th></tr></thead>
      <tbody>{result.by_type.map(x => <tr key={x.type}><td>{t.has(`types.${x.type}`) ? t(`types.${x.type}`) : x.type}</td><td>{x.correct} / {x.total}</td></tr>)}</tbody>
    </table>
    <p className="hint">{t('bandNote')}</p>
    {parts.length > 1 && <nav className="reading-parts-tabs" aria-label={t('parts')}>
      {parts.map((p, i) => <button key={p.position} type="button" aria-current={i === index ? 'true' : undefined} onClick={() => { setIndex(i); setTurn(null); }}>{t('part', {n: p.position})}</button>)}
    </nav>}
    {part.audio ? <div className="listening-player">
      <audio key={part.position} ref={audio} controls preload="metadata" src={part.audio.url} aria-label={t('recording', {n: part.position})}/>
    </div> : <p className="hint">{t('audioUnavailable')}</p>}
    <div className="reading-columns listening-columns">
      <article className="reading-passage listening-transcript" aria-label={t('transcript')}>
        <h2>{t('transcript')}</h2>
        {(part.turns ?? []).map((x, i) => <p key={i} id={`turn-${i}`} className={turn === i ? 'active' : undefined}>
          <strong>{x.speaker}:</strong> {x.text}
        </p>)}
      </article>
      <div className="reading-questions">
        {part.groups.map((group, gi) => <Group key={gi} group={group}>
          {group.questions.map(q => {
            const n = q.numbers[0];
            const right = q.numbers.every(x => rows.get(x)?.correct);
            const given = q.numbers.map(x => rows.get(x)?.given).filter(Boolean) as string[];
            const g = inputGroup(group);
            const explanation = q.explanation?.[language] ?? q.explanation?.en;
            return <div key={n} id={`q-${n}`} className={`reading-question ${right ? 'right' : 'wrong'}`}>
              <p className="reading-number">{q.numbers.join('–')}</p>
              <div>
                <p className="reading-prompt">{q.prompt}</p>
                {group.type === 'multiple_choice' || group.type === 'multiple_choice_multi'
                  ? <ul className="reading-choices">{group.options?.map(o => <li key={o.id}><strong>{o.id}</strong> {o.text}</li>)}</ul> : null}
                <p className="reading-answer">
                  <span className={right ? 'ok' : 'no'}>{right ? '✓' : '✗'}</span> {t('yourAnswer')}: <strong>{given.length ? given.map(x => optionText(g, x)).join(', ') : t('noAnswer')}</strong>
                  {!right && <> · {t('correctAnswer')}: <strong>{(q.answer ?? []).map(a => optionText(g, a)).join(group.type === 'multiple_choice_multi' ? ', ' : ' / ')}</strong></>}
                </p>
                {explanation && <p className="reading-explanation">{explanation}</p>}
                {q.heard && q.heard.start_ms !== null && part.audio && <button type="button" className="text-button" onClick={() => listen(q)}>{t('listenHere')}</button>}
              </div>
            </div>;
          })}
        </Group>)}
      </div>
    </div>
    <p className="hint">{t('synthetic')}</p>
    <p className="hint">{t('disclaimer')}</p>
    <div className="actions"><Link className="button" href="/ielts/listening">{t('again')}</Link></div>
  </section>;
}
