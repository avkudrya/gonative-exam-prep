'use client';
import {useLocale, useTranslations} from 'next-intl';
import {useRef, useState} from 'react';
import {useRouter} from '../i18n/navigation';
import type {PracticeSession} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';

/** An explicit click resolves the owned recommendation before leaving Exams. */
export function PracticeButton({skill, attempt, recommendation, className = 'button', label}: {skill: string; attempt?: string | null; recommendation?: string; className?: string; label?: string}) {
  const t = useTranslations('Practice');
  const router = useRouter();
  const locale = useLocale();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const result = await bff<{session: PracticeSession} | {grammar_practice: {reference: string | null}}>('practice', {body: {skill_key: skill, ...(attempt ? {attempt_uuid: attempt} : {}), ...(recommendation ? {recommendation_uuid: recommendation} : {})}});
    if (!result.ok) {
      pending.current = false;
      setBusy(false);
      setError(result.error === 'exams_practice_daily_limit' ? t('errors.daily')
        : result.error === 'exams_practice_unavailable' || result.error === 'exams_practice_skill_unavailable' ? t('errors.bank') : t('errors.generic'));
      return;
    }
    if ('grammar_practice' in result.data) {
      const reference = result.data.grammar_practice.reference;
      const suffix = reference ? `/from-exams/${reference}` : '';
      window.location.assign(`https://grammar-practice.mnemonicwords.app/${locale === 'ru' || locale === 'uk' ? locale : 'en'}/self-practice${suffix}`);
      return;
    }
    router.push(`/ielts/practice/${result.data.session.uuid}`);
  }

  return <span className="practice-start">
    <button type="button" className={className} onClick={() => void start()} disabled={busy} aria-busy={busy}>{busy ? t('starting') : label ?? t('start')}</button>
    {error && <span className="feedback error" role="alert">{error}</span>}
  </span>;
}
