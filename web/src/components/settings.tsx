'use client';
import {useLocale, useTranslations} from 'next-intl';
import {useState, type FormEvent} from 'react';
import {useRouter} from '../i18n/navigation';
import {interfaceLocales} from '../i18n/locales';
import {feedbackLanguages, type Profile} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {clearLocalDrafts} from '../lib/local-drafts';

type Status = {kind: 'saved' | 'error'; message: string} | null;

function StatusLine({status}: {status: Status}) {
  if (!status) return null;
  return status.kind === 'saved'
    ? <p className="feedback ok" role="status">{status.message}</p>
    : <p className="feedback error" role="alert">{status.message}</p>;
}

export function PreferenceSettings({profile, exams}: {profile: Profile; exams: {key: string; name: string}[]}) {
  const t = useTranslations('Settings');
  const locale = useLocale();
  const router = useRouter();
  const initial = {interface_locale: locale, feedback_language: profile.feedback_language ?? locale, target_exam_key: profile.target_exam_key ?? ''};
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const changed = (Object.keys(values) as (keyof typeof values)[]).filter(key => values[key] !== saved[key]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!changed.length) return;
    setBusy(true);
    setStatus(null);
    const body = Object.fromEntries(changed.map(key => [key, key === 'target_exam_key' && !values[key] ? null : values[key]]));
    const result = await bff('profile', {method: 'PUT', body});
    setBusy(false);
    if (!result.ok) {
      setStatus({kind: 'error', message: t('saveFailed')});
      return;
    }
    setSaved(values);
    if (values.interface_locale !== locale) {
      router.replace('/settings', {locale: values.interface_locale});
      return;
    }
    setStatus({kind: 'saved', message: t('saved')});
    router.refresh();
  }

  const set = (key: keyof typeof values) => (event: {target: {value: string}}) => {
    setValues({...values, [key]: event.target.value});
    setStatus(null);
  };

  return <section className="card" aria-labelledby="preferences-title">
    <h2 id="preferences-title">{t('preferences.title')}</h2>
    <form onSubmit={submit} aria-busy={busy}>
      <div className="field">
        <label htmlFor="interface-locale">{t('preferences.interface')}</label>
        <select id="interface-locale" value={values.interface_locale} onChange={set('interface_locale')}>
          {interfaceLocales.map(l => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="feedback-language">{t('preferences.feedback')}</label>
        <select id="feedback-language" value={values.feedback_language} onChange={set('feedback_language')}>
          {feedbackLanguages.map(code => <option key={code} value={code}>{t(`preferences.languages.${code}`)}</option>)}
        </select>
        <p className="hint">{t('preferences.feedbackHint')}</p>
      </div>
      {exams.length > 0 && <div className="field">
        <label htmlFor="target-exam">{t('preferences.exam')}</label>
        <select id="target-exam" value={values.target_exam_key} onChange={set('target_exam_key')}>
          <option value="">{t('preferences.noExam')}</option>
          {exams.map(exam => <option key={exam.key} value={exam.key}>{exam.name}</option>)}
        </select>
      </div>}
      <StatusLine status={status}/>
      <button className="button primary" disabled={busy || !changed.length}>{t('save')}</button>
    </form>
  </section>;
}

const passwordErrors = new Set(['invalid_current_password', 'password_unchanged', 'password_too_long', 'rate_limited', 'exams_rate_limited']);

export function PasswordSettings() {
  const t = useTranslations('Settings');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setStatus(null);
    const result = await bff('auth/password', {body: {
      current_password: String(form.get('current_password')),
      password: String(form.get('password')),
      password_confirmation: String(form.get('password_confirmation')),
    }});
    setBusy(false);
    if (!result.ok) {
      setStatus({kind: 'error', message: t(`errors.${passwordErrors.has(result.error) ? result.error : 'unavailable'}`)});
      return;
    }
    // Every session ends with a password change; sign in again with the new one.
    router.replace({pathname: '/login', query: {password: 'changed'}});
    router.refresh();
  }

  return <section className="card" aria-labelledby="password-title">
    <h2 id="password-title">{t('password.title')}</h2>
    <p className="hint">{t('password.hint')}</p>
    <form onSubmit={submit} aria-busy={busy} onInput={event => {
      const form = event.currentTarget;
      const password = form.elements.namedItem('password') as HTMLInputElement;
      const confirmation = form.elements.namedItem('password_confirmation') as HTMLInputElement;
      confirmation.setCustomValidity(!confirmation.value || confirmation.value === password.value ? '' : t('password.mismatch'));
    }}>
      <div className="field">
        <label htmlFor="current-password">{t('password.current')}</label>
        <input id="current-password" name="current_password" type="password" autoComplete="current-password" required maxLength={255}/>
      </div>
      <div className="field">
        <label htmlFor="new-password">{t('password.new')}</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72}/>
      </div>
      <div className="field">
        <label htmlFor="new-password-confirmation">{t('password.confirmation')}</label>
        <input id="new-password-confirmation" name="password_confirmation" type="password" autoComplete="new-password" required minLength={10} maxLength={72}/>
      </div>
      <StatusLine status={status}/>
      <button className="button" disabled={busy}>{t('password.submit')}</button>
    </form>
  </section>;
}

function DeletionForm({kind}: {kind: 'data' | 'account'}) {
  const t = useTranslations('Settings');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password'));
    setBusy(true);
    setStatus(null);
    const result = kind === 'data'
      ? await bff('data', {method: 'DELETE', body: {confirm: 'exams', password}})
      : await bff('account', {method: 'DELETE', body: {confirm: 'all_products', password}});
    if (!result.ok) {
      setBusy(false);
      const known = ['invalid_current_password', 'reauthentication_required', 'exams_assessment_in_progress', 'rate_limited', 'exams_rate_limited'];
      setStatus({kind: 'error', message: t(`errors.${known.includes(result.error) ? result.error : 'unavailable'}`)});
      return;
    }
    clearLocalDrafts();
    router.replace({pathname: '/login', query: kind === 'data' ? {data: 'deleted'} : {account: 'closed'}});
    router.refresh();
  }

  return <form className="danger-form" onSubmit={submit} aria-busy={busy}>
    <label className="check">
      <input type="checkbox" required/>
      <span>{t(`${kind}.confirm`)}</span>
    </label>
    <div className="field">
      <label htmlFor={`${kind}-password`}>{t('password.current')}</label>
      <input id={`${kind}-password`} name="password" type="password" autoComplete="current-password" required maxLength={255}/>
    </div>
    <StatusLine status={status}/>
    <button className="button danger" disabled={busy}>{t(`${kind}.submit`)}</button>
  </form>;
}

export function DeletionSettings({hasPassword, supportEmail}: {hasPassword: boolean; supportEmail: string}) {
  const t = useTranslations('Settings');
  return <>
    {(['data', 'account'] as const).map(kind => <section key={kind} className="card danger-zone" aria-labelledby={`${kind}-title`}>
      <h2 id={`${kind}-title`}>{t(`${kind}.title`)}</h2>
      <p>{t(`${kind}.body`)}</p>
      {hasPassword ? <details>
        <summary>{t(`${kind}.open`)}</summary>
        <DeletionForm kind={kind}/>
      </details> : <p className="hint">{t('noPassword', {email: supportEmail})}</p>}
    </section>)}
  </>;
}
