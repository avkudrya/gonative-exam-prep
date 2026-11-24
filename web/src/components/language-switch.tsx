'use client';
import {useLocale, useTranslations} from 'next-intl';
import {interfaceLocales} from '../i18n/locales';
import {Link, usePathname} from '../i18n/navigation';
import {beforeLocaleChange} from '../lib/auth-proof-memory';

export function LanguageSwitch() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('Shell');
  return <nav className="language-switch" aria-label={t('language')}>
    {interfaceLocales.map(l => <Link
      key={l.code}
      href={pathname}
      locale={l.code}
      lang={l.code}
      aria-current={l.code === locale ? 'true' : undefined}
      title={l.nativeName}
      onClick={() => window.dispatchEvent(new Event(beforeLocaleChange))}
    >{l.shortName}</Link>)}
  </nav>;
}
