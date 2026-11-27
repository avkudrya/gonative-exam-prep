import {getTranslations} from 'next-intl/server';
import {Link} from '../i18n/navigation';
import {homePath} from '../lib/return-path';
import {AccountMenu} from './account-menu';
import {LanguageSwitch} from './language-switch';
import {MemberNav} from './member-nav';
import {ThemeSwitch} from './theme-switch';

export async function SiteShell({children, locale, email, reading = false}: {children: React.ReactNode; locale: string; email?: string; reading?: boolean}) {
  const t = await getTranslations({locale, namespace: 'Shell'});
  const member = email !== undefined;
  return <div className={member ? 'site member' : 'site guest'}>
    <a className="skip" href="#main">{t('skip')}</a>
    <header className="header">
      <Link href={member ? homePath : '/login'} className="brand">GoNative <strong>Exams</strong></Link>
      {member && <MemberNav reading={reading}/>}
      <div className="header-tools">
        {member ? <AccountMenu email={email}/> : <LanguageSwitch/>}
      </div>
    </header>
    <main id="main">{children}</main>
    <footer className="footer">
      <div className="footer-main">
        <nav className="footer-links" aria-label={t('legalLinks')}>
          <Link href="/terms">{t('terms')}</Link>
          <Link href="/privacy">{t('privacy')}</Link>
        </nav>
        <p className="disclaimer">{t('disclaimer')}</p>
      </div>
      <div className="footer-tools">
        {member && <LanguageSwitch/>}
        <ThemeSwitch/>
      </div>
    </footer>
  </div>;
}
