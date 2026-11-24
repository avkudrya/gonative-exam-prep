'use client';
import {useFormatter, useTranslations} from 'next-intl';
import {useState, type FormEvent} from 'react';
import {useRouter} from '../i18n/navigation';
import type {Comparison, ReportedResult} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';

/** IELTS Writing section scale of the verified catalog: 0–9 in half bands. */
const WRITING_SCORES = Array.from({length: 19}, (_, i) => i / 2);
const criteria = ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range_accuracy'];
const band = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));
const knownErrors = new Set(['exams_section_not_on_scale', 'exams_reported_results_limit', 'exams_exam_unavailable', 'invalid_input', 'rate_limited', 'exams_rate_limited']);

export function ReportedResults({results, exams, defaultExam, today, earliest}: {
  results: ReportedResult[]; exams: {key: string; name: string}[]; defaultExam: string;
  /** Date bounds of the backend rule (not in the future, within three years), computed on the server. */
  today: string; earliest: string;
}) {
  const t = useTranslations('Results');
  const format = useFormatter();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const examName = (key: string) => exams.find(e => e.key === key)?.name ?? key;

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setSaved(false);
    const result = await bff('reported-results', {body: {
      exam_key: String(form.get('exam')),
      test_date: String(form.get('date')),
      sections: {writing: Number(form.get('writing'))},
      calibration_consent: form.get('consent') === 'on',
    }});
    setBusy(false);
    if (!result.ok) {
      setError(knownErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    (event.target as HTMLFormElement).reset();
    setSaved(true);
    router.refresh();
  }

  return <>
    {results.length > 0 && <section aria-labelledby="saved-title">
      <h2 id="saved-title">{t('savedTitle')}</h2>
      <ul className="reported">
        {results.map(result => <ResultItem key={result.uuid} result={result} name={examName(result.exam_key)}
          date={format.dateTime(new Date(`${result.test_date}T00:00:00Z`), {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'})}/>)}
      </ul>
    </section>}
    <section aria-labelledby="add-title" className="card">
      <h2 id="add-title">{t('addTitle')}</h2>
      <form onSubmit={add} aria-busy={busy}>
        <div className="field">
          <label htmlFor="result-exam">{t('exam')}</label>
          <select id="result-exam" name="exam" defaultValue={defaultExam} required>
            {exams.map(exam => <option key={exam.key} value={exam.key}>{exam.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="result-date">{t('date')}</label>
          <input id="result-date" name="date" type="date" required min={earliest} max={today}/>
        </div>
        <div className="field">
          <label htmlFor="result-writing">{t('writing')}</label>
          <select id="result-writing" name="writing" required defaultValue="">
            <option value="" disabled>{t('choose')}</option>
            {WRITING_SCORES.map(score => <option key={score} value={score}>{band(score)}</option>)}
          </select>
          <p className="hint">{t('writingHint')}</p>
        </div>
        <label className="check consent">
          <input type="checkbox" name="consent"/>
          <span>{t('consent')}</span>
        </label>
        <p className="hint">{t('consentHint')}</p>
        {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
        {saved && <p className="feedback ok" role="status">{t('added')}</p>}
        <button className="button primary" disabled={busy}>{t('add')}</button>
      </form>
    </section>
  </>;
}

function ResultItem({result, name, date}: {result: ReportedResult; name: string; date: string}) {
  const t = useTranslations('Results');
  const r = useTranslations('Result');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function call(action: () => Promise<{ok: boolean}>) {
    setBusy(true);
    setError('');
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(t('errors.unavailable'));
    return result.ok;
  }

  const toggle = () => call(() => bff(`reported-results/${result.uuid}`, {method: 'PUT', body: {calibration_consent: !result.calibration_consent}}))
    .then(ok => ok && router.refresh());
  const remove = () => call(() => bff(`reported-results/${result.uuid}`, {method: 'DELETE'})).then(ok => ok && router.refresh());
  const compare = async () => {
    setBusy(true);
    const response = await bff<Comparison>(`reported-results/${result.uuid}/comparison`);
    setBusy(false);
    if (response.ok) setComparison(response.data);
    else setError(t('errors.unavailable'));
  };

  return <li className="card reported-item">
    <div className="reported-head">
      <div>
        <h3>{name}</h3>
        <p className="hint">{date}</p>
      </div>
      <p className="official">{t('writingScore', {score: band(result.sections.writing ?? NaN)})}</p>
    </div>
    <p className="hint">{result.calibration_consent ? t('consentOn') : t('consentOff')}</p>
    <div className="actions">
      <button type="button" className="text-button" disabled={busy} onClick={() => void compare()}>{t('compare')}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => void toggle()}>{result.calibration_consent ? t('withdraw') : t('allow')}</button>
      {confirming ? <span className="confirm">
        <span>{t('deleteConfirm')}</span>
        <button type="button" className="button danger" disabled={busy} onClick={() => void remove()}>{t('delete')}</button>
        <button type="button" className="button" onClick={() => setConfirming(false)}>{t('cancel')}</button>
      </span> : <button type="button" className="text-button danger-text" onClick={() => setConfirming(true)}>{t('delete')}</button>}
    </div>
    {error && <p className="feedback error" role="alert">{error}</p>}
    {comparison && <div className="comparison" aria-live="polite">
      <h4>{t('comparisonTitle', {days: comparison.window_days})}</h4>
      {comparison.assessments.length === 0 ? <p className="hint">{t('noEstimates', {days: comparison.window_days})}</p> : <>
        <div className="table-wrap"><table>
          <thead><tr><th scope="col">{t('essay')}</th>{criteria.map(key => <th key={key} scope="col">{r(`criteriaShort.${key}`)}</th>)}</tr></thead>
          <tbody>{comparison.assessments.map((a, i) => {
            const ranges = Object.fromEntries(a.criteria.map(c => [c.criterion_key, c.estimate]));
            return <tr key={a.assessment}><th scope="row">{i + 1}</th>{criteria.map(key => {
              const range = ranges[key];
              return <td key={key}>{range ? `${band(range.low)}–${band(range.high)}` : '—'}</td>;
            })}</tr>;
          })}</tbody>
        </table></div>
        <p className="hint">{t('comparisonNote')}</p>
      </>}
    </div>}
  </li>;
}
