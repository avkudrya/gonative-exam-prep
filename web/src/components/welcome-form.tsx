'use client';
import {useLocale, useTranslations} from 'next-intl';
import {useState, type FormEvent} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import {feedbackLanguages, type Profile} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {TERMS_VERSION} from '../lib/legal/common';

export function WelcomeForm({profile, exams, next, termsReady}: {
  profile: Profile; exams: {key: string; name: string}[]; next: string; termsReady: boolean;
}) {
  const t = useTranslations('Welcome');
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const exam = String(form.get('exam') ?? '');
    setBusy(true);
    setError('');
    const result = await bff('profile', {method: 'PUT', body: {
      accept_terms: true,
      terms_version: TERMS_VERSION,
      confirm_age_16: true,
      feedback_language: String(form.get('feedback_language')),
      interface_locale: locale,
      ...(exam ? {target_exam_key: exam} : {}),
    }});
    if (!result.ok) {
      setBusy(false);
      setError(result.error === 'terms_version_changed' ? 'terms_changed' : 'save_failed');
      if (result.error === 'terms_version_changed') router.refresh();
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return <section className="panel-page">
    <div className="panel">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p className="lead">{t('lead')}</p>
      {!termsReady ? <p className="feedback error" role="alert">{t('termsUpdating')}</p> : <form onSubmit={submit} aria-busy={busy}>
        <fieldset className="choice">
          <legend>{t('feedbackLanguage')}</legend>
          <p className="hint">{t('feedbackHint')}</p>
          {feedbackLanguages.map(code => <label key={code} className="option">
            <input type="radio" name="feedback_language" value={code} defaultChecked={(profile.feedback_language ?? locale) === code} required/>
            <span>{t(`languages.${code}`)}</span>
          </label>)}
        </fieldset>
        {exams.length > 0 && <fieldset className="choice">
          <legend>{t('exam')}</legend>
          <p className="hint">{t('examHint')}</p>
          {exams.map(exam => <label key={exam.key} className="option">
            <input type="radio" name="exam" value={exam.key} defaultChecked={profile.target_exam_key === exam.key}/>
            <span>{exam.name}</span>
          </label>)}
        </fieldset>}
        <div className="consents">
          <label className="check">
            <input type="checkbox" name="age" required/>
            <span>{t('age')}</span>
          </label>
          <label className="check">
            <input type="checkbox" name="terms" required/>
            <span>{t.rich('terms', {
              terms: chunks => <Link href="/terms" target="_blank">{chunks}</Link>,
              privacy: chunks => <Link href="/privacy" target="_blank">{chunks}</Link>,
            })}</span>
          </label>
          <p className="hint">{t('aiNotice')}</p>
        </div>
        {error && <p className="feedback error" role="alert">{t(error)}</p>}
        <button className="button primary" disabled={busy}>{busy ? t('saving') : t('start')}</button>
      </form>}
    </div>
  </section>;
}
