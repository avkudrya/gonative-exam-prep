import {getTranslations} from 'next-intl/server';
import {appOrigin} from '../lib/hosts';
import {LanguageSwitch} from './language-switch';
import {ThemeSwitch} from './theme-switch';

/** Header and footer of the public pages on a landing host: the landing and the guide (P6.2). */
export async function PublicShell({locale, children, className}: {locale: string; children: React.ReactNode; className?: string}) {
  const t = await getTranslations({locale, namespace: 'Landing'});
  const g = await getTranslations({locale, namespace: 'Guide'});
  const e = await getTranslations({locale, namespace: 'Examples'});
  const app = appOrigin();
  return <div className={`site landing${className ? ` ${className}` : ''}`}>
    <a className="skip" href="#main">{t('skip')}</a>
    <header className="header">
      <a className="brand" href={`/${locale}`}>GoNative <strong>Exams</strong> <span className="brand-exam">IELTS</span></a>
      <div className="header-tools">
        <a className="text-link" href={`/${locale}/guide`}>{g('nav')}</a>
        <a className="text-link" href={`/${locale}/examples`}>{e('nav')}</a>
        <LanguageSwitch/>
        <a className="text-link" href={`${app}/${locale}/login`}>{t('signIn')}</a>
      </div>
    </header>
    <main id="main">{children}</main>
    <footer className="footer">
      <div className="footer-main">
        <nav className="footer-links" aria-label={t('legal')}>
          <a href={`/${locale}/guide`}>{g('nav')}</a>
          <a href={`/${locale}/examples`}>{e('nav')}</a>
          <a href={`${app}/${locale}/terms`}>{t('terms')}</a>
          <a href={`${app}/${locale}/privacy`}>{t('privacy')}</a>
        </nav>
        <p className="disclaimer">{t('disclaimer')}</p>
      </div>
      <div className="footer-tools"><ThemeSwitch/></div>
    </footer>
  </div>;
}

/** JSON-LD for search engines; the data is ours, never user input. */
export function StructuredData({data}: {data: object}) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data).replace(/</g, '\\u003c')}}/>;
}
