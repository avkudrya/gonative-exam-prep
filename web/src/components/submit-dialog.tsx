'use client';
import type {FeedbackLanguage} from '../lib/api/schemas';
import {useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import {bff} from '../lib/bff-client';
import {forgetLocalDraft} from '../lib/draft-sync';
import {TASK2_MIN_WORDS} from '../lib/writing';

/** Rule-decided results (≤ 20 words, another language) are free; below this the dialog says so. */
const RULE_WORDS = 20;
const knownErrors = new Set([
  'exams_monthly_quota_exhausted', 'exams_monthly_ai_budget_exhausted', 'exams_concurrency_limit', 'exams_assessment_unavailable',
  'exams_assessment_not_active', 'exams_unavailable', 'exams_response_empty', 'exams_attempt_not_submittable', 'exams_onboarding_required',
  'request_key_conflict', 'rate_limited', 'exams_rate_limited', 'exams_requests_rate_limited', 'not_saved', 'unauthenticated', 'offline',
]);

function newRequestKey() {
  const random = crypto.getRandomValues(new Uint8Array(12));
  return `submit-${Array.from(random, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * "Get feedback": confirms what will be spent, saves the draft first, then submits once.
 * The request key is fixed while the dialog is open, so a retried click never queues a second assessment.
 */
export function SubmitDialog({uuid, words, remaining, limit, feedbackLanguage, beforeSubmit, label}: {
  uuid: string; words: number; remaining: number; limit: number; feedbackLanguage: FeedbackLanguage;
  /** Saves the draft; resolves to false when the text could not be saved. */
  beforeSubmit?: () => Promise<boolean>;
  label?: string;
}) {
  const t = useTranslations('Submit');
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAfter, setRetryAfter] = useState<number | undefined>();

  useEffect(() => {
    const element = dialog.current;
    const reset = () => { if (!busy) setError(''); };
    element?.addEventListener('close', reset);
    return () => element?.removeEventListener('close', reset);
  }, [busy]);

  function open() {
    key.current = newRequestKey();
    setError('');
    dialog.current?.showModal();
  }

  async function submit() {
    setBusy(true);
    setError('');
    if (beforeSubmit && !(await beforeSubmit())) {
      setBusy(false);
      setError('not_saved');
      return;
    }
    const result = await bff(`attempts/${uuid}/submit`, {method: 'POST', body: {}, idempotencyKey: key.current});
    if (!result.ok) {
      setBusy(false);
      setRetryAfter(result.retryAfter);
      setError(knownErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    forgetLocalDraft(uuid);
    dialog.current?.close();
    router.refresh();
  }

  const free = words <= RULE_WORDS;
  const noQuota = remaining <= 0 && !free;

  return <>
    <button type="button" className="button primary" onClick={open}>{label ?? t('open')}</button>
    <dialog ref={dialog} className="dialog" aria-labelledby="submit-title">
      <h2 id="submit-title">{t('title')}</h2>
      <ul className="facts">
        <li>{t('words', {count: words})}{words < TASK2_MIN_WORDS && !free && <> — {t('underMinimum', {min: TASK2_MIN_WORDS})}</>}</li>
        <li>{free ? t('freeShort') : noQuota ? t('noQuota') : t('quota', {remaining, limit})}</li>
        <li>{t('language', {language: t(`languages.${feedbackLanguage}`)})} <Link href="/settings">{t('change')}</Link></li>
        <li>{t('frozen')}</li>
        <li>{t('ai')}</li>
      </ul>
      {error && <p className="feedback error" role="alert">
        {t(`errors.${error}`, {minutes: retryAfter ? Math.max(1, Math.ceil(retryAfter / 60)) : 1})}
        {error === 'unauthenticated' && <> <Link href={{pathname: '/login', query: {next: `/ielts/writing/${uuid}`}}}>{t('signIn')}</Link></>}
      </p>}
      <div className="actions">
        <button type="button" className="button primary" disabled={busy || noQuota} onClick={() => void submit()}>{busy ? t('sending') : t('confirm')}</button>
        <button type="button" className="button" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancel')}</button>
      </div>
    </dialog>
  </>;
}
