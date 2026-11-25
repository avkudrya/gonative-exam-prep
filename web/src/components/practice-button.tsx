'use client';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import {useRouter} from '../i18n/navigation';
import type {PracticeSession} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';

/**
 * P4.8: starts (or reopens) a practice session of one skill and opens it. A button, not a link: starting a session is a
 * write, so a prefetch must never create one.
 */
export function PracticeButton({skill, attempt, className = 'button', label}: {skill: string; attempt?: string | null; className?: string; label?: string}) {
  const t = useTranslations('Practice');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    const result = await bff<{session: PracticeSession}>('practice', {body: {skill_key: skill, ...(attempt ? {attempt_uuid: attempt} : {})}});
    if (!result.ok) {
      setBusy(false);
      setError(result.error === 'exams_practice_daily_limit' ? t('errors.daily')
        : result.error === 'exams_practice_unavailable' || result.error === 'exams_practice_skill_unavailable' ? t('errors.bank') : t('errors.generic'));
      return;
    }
    router.push(`/ielts/practice/${result.data.session.uuid}`);
  }

  return <span className="practice-start">
    <button type="button" className={className} onClick={() => void start()} disabled={busy} aria-busy={busy}>{busy ? t('starting') : label ?? t('start')}</button>
    {error && <span className="feedback error" role="alert">{error}</span>}
  </span>;
}
