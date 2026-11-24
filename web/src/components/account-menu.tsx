'use client';
import {useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import {useRouter} from '../i18n/navigation';

export function AccountMenu({email}: {email: string}) {
  const t = useTranslations('Shell');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  async function signOut() {
    setBusy(true);
    try {
      await fetch('/api/bff/auth/logout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
    } finally {
      // Local drafts belong to this browser session only (P3.3 clears them here too).
      router.replace({pathname: '/login', query: {signed: 'out'}});
      router.refresh();
    }
  }

  return <div className="account-menu" ref={root}>
    <button ref={button} type="button" className="account-button" aria-expanded={open} aria-haspopup="true"
      aria-label={t('accountMenu')} onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span>
    </button>
    {open && <nav className="account-panel" aria-label={t('accountMenu')}>
      <p className="account-email">{email}</p>
      <button type="button" className="menu-item" disabled={busy} onClick={() => void signOut()}>{t('signOut')}</button>
    </nav>}
  </div>;
}
