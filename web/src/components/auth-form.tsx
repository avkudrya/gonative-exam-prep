'use client';
import {useLocale, useTranslations} from 'next-intl';
import Script from 'next/script';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import {beforeLocaleChange, takeTransferredProof, transferProof} from '../lib/auth-proof-memory';
import {homePath, safeReturnPath} from '../lib/return-path';

export type AuthMode = 'login' | 'join' | 'register' | 'forgot' | 'reset' | 'activate' | 'resend';
export type AuthNotice = 'password_changed' | 'data_deleted' | 'account_closed' | 'signed_out';

type GoogleAPI = {accounts: {id: {
  initialize: (options: {client_id: string; callback: (response: {credential: string}) => void; auto_select: boolean}) => void;
  renderButton: (element: HTMLElement, options: {type: string; theme: string; text: string; locale: string}) => void;
}}};

/** Errors the form explains in its own words; anything else is "temporarily unavailable". */
const knownErrors = new Set([
  'invalid_credentials', 'email_verification_required', 'registration_required', 'account_unavailable',
  'exams_profile_required', 'account_exists_sign_in', 'account_not_found', 'invalid_google_identity', 'identity_conflict',
  'verification_unavailable', 'invalid_verification', 'invalid_password_reset', 'password_too_long',
  'rate_limited', 'exams_rate_limited', 'invalid_input', 'unauthenticated',
]);
/** Where an error sends the person next. */
const nextStep: Record<string, 'join' | 'register' | 'login' | 'resend' | 'forgot'> = {
  exams_profile_required: 'join',
  account_exists_sign_in: 'join',
  account_not_found: 'register',
  email_verification_required: 'resend',
  invalid_verification: 'resend',
  invalid_password_reset: 'forgot',
};
const stepLink = {join: '/join', register: '/register', login: '/login', resend: '/resend-verification', forgot: '/forgot-password'} as const;

export function AuthForm({mode, googleClientId, notice}: {mode: AuthMode; googleClientId?: string; notice?: AuthNotice}) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const googleElement = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [token, setToken] = useState('');
  const [proofReady, setProofReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const newPassword = mode === 'register' || mode === 'reset';
  const usesProof = mode === 'activate' || mode === 'reset';

  // Read the one-time proof and the return path in the browser only, then scrub the proof from history.
  useEffect(() => {
    const url = new URL(location.href);
    /* eslint-disable react-hooks/set-state-in-effect */
    setReturnTo(safeReturnPath(url.searchParams.get('next')));
    if (!usesProof) return;
    const proof = url.searchParams.get('token') ?? takeTransferredProof(mode);
    setToken(proof);
    setProofReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    url.searchParams.delete('token');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    const transfer = () => transferProof(mode, proof);
    window.addEventListener(beforeLocaleChange, transfer);
    return () => window.removeEventListener(beforeLocaleChange, transfer);
  }, [mode, usesProof]);

  async function send(path: string, data: unknown) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/bff/auth/${path}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
      const result = await response.json().catch(() => ({})) as {error?: string; status?: string};
      if (!response.ok) {
        setError(result.error && knownErrors.has(result.error) ? result.error : 'unavailable');
        return;
      }
      if (path === 'login' || path === 'join' || path === 'google') {
        router.replace(returnTo ?? homePath);
        router.refresh();
        return;
      }
      setDone(result.status ?? 'ok');
    } catch {
      setError('unavailable');
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('password_confirmation') ?? '');
    const payload = {
      login: {email, password},
      join: {email, password, locale},
      register: {email, password, password_confirmation: confirmation, locale},
      forgot: {email},
      reset: {token, password, password_confirmation: confirmation},
      activate: {token},
      resend: {email, password},
    }[mode];
    void send(mode, payload);
  }

  function initializeGoogle() {
    const google = (window as Window & {google?: GoogleAPI}).google;
    if (!google || !googleElement.current || !googleClientId) return;
    const creates = mode === 'register' || mode === 'join';
    google.accounts.id.initialize({
      client_id: googleClientId,
      auto_select: false,
      callback: ({credential}) => void send('google', {id_token: credential, create_account: creates, locale}),
    });
    google.accounts.id.renderButton(googleElement.current, {type: 'standard', theme: 'outline', text: creates ? 'signup_with' : 'signin_with', locale});
  }

  const step = error ? nextStep[error] : undefined;
  const loginHref = returnTo ? {pathname: '/login', query: {next: returnTo}} : '/login';

  return <section className="auth">
    <div className="auth-card">
      <h1>{t(`headings.${mode}`)}</h1>
      {mode !== 'login' && <p className="auth-intro">{t(`descriptions.${mode}`)}</p>}
      {notice && !error && <p className="auth-notice" role="status">{t(`notices.${notice}`)}</p>}
      {done ? <div className="auth-done" role="status" aria-live="polite">
        <p>{t(`results.${done}`)}</p>
        <Link className="button" href={loginHref}>{t('titles.login')}</Link>
        {(mode === 'register' || mode === 'resend') && <Link className="text-link" href="/resend-verification">{t('resendLink')}</Link>}
      </div> : <>
        <form onSubmit={submit} aria-busy={busy} onInput={event => {
          if (!newPassword) return;
          const form = event.currentTarget;
          const password = form.elements.namedItem('password') as HTMLInputElement;
          const confirmation = form.elements.namedItem('password_confirmation') as HTMLInputElement;
          confirmation.setCustomValidity(!confirmation.value || confirmation.value === password.value ? '' : t('passwordMismatch'));
        }}>
          {!usesProof && <div className="field">
            <label htmlFor="auth-email">{t('email')}</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={255} readOnly={busy}/>
          </div>}
          {mode !== 'activate' && mode !== 'forgot' && <div className="field">
            <div className="field-row">
              <label htmlFor="auth-password">{t(mode === 'reset' ? 'newPassword' : 'password')}</label>
              {mode === 'login' && <Link className="text-link" href="/forgot-password">{t('titles.forgot')}</Link>}
            </div>
            <div className="password-input">
              <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete={newPassword ? 'new-password' : 'current-password'} required minLength={newPassword ? 10 : 1}
                maxLength={newPassword ? 72 : 255} readOnly={busy} aria-describedby={newPassword ? 'password-hint' : undefined}/>
              <button type="button" className="password-toggle" aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}>{t(showPassword ? 'hidePassword' : 'showPassword')}</button>
            </div>
            {newPassword && <p className="hint" id="password-hint">{t('passwordHint')}</p>}
          </div>}
          {newPassword && <div className="field">
            <label htmlFor="auth-confirmation">{t('confirmation')}</label>
            <input id="auth-confirmation" name="password_confirmation" type={showPassword ? 'text' : 'password'}
              autoComplete="new-password" required minLength={10} maxLength={72} readOnly={busy}/>
          </div>}
          {mode === 'register' && <p className="hint">{t('ageNotice')}</p>}
          {usesProof && proofReady && !token && <p className="feedback error" role="alert">{t('missingToken')}</p>}
          {error && <p className="feedback error" role="alert">
            {t(`errors.${error}`)}
            {step && <> <Link href={step === 'login' ? loginHref : stepLink[step]}>{t(`steps.${step}`)}</Link></>}
          </p>}
          <button className="button primary" disabled={busy || (usesProof && !token)}>
            {busy ? t('busy') : t(`titles.${mode}`)}
          </button>
        </form>
        {googleClientId && (mode === 'login' || mode === 'join' || mode === 'register') && <div className="auth-google">
          <div className="divider"><span>{t('or')}</span></div>
          <Script src={`https://accounts.google.com/gsi/client?hl=${locale}`} onReady={initializeGoogle}/>
          <div className="google-button" ref={googleElement} aria-busy={busy} style={{pointerEvents: busy ? 'none' : undefined}}/>
        </div>}
      </>}
      <nav className="auth-links" aria-label={t('helpLabel')}>
        {mode === 'login' ? <>
          <p>{t('noAccount')} <Link href="/register">{t('titles.register')}</Link></p>
          <p>{t('haveGoNative')} <Link href="/join">{t('titles.join')}</Link></p>
          <Link className="text-link" href="/resend-verification">{t('resendLink')}</Link>
        </> : <>
          <p>{t('haveAccount')} <Link href={loginHref}>{t('titles.login')}</Link></p>
          {mode === 'register' && <p>{t('haveGoNative')} <Link href="/join">{t('titles.join')}</Link></p>}
          {mode === 'reset' && proofReady && !token && <Link className="text-link" href="/forgot-password">{t('newResetLink')}</Link>}
          {mode === 'activate' && proofReady && !token && <Link className="text-link" href="/resend-verification">{t('resendLink')}</Link>}
        </>}
      </nav>
    </div>
  </section>;
}
