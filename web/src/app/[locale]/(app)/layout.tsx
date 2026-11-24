import {getTranslations, setRequestLocale} from 'next-intl/server';
import {SiteShell} from '../../../components/site-shell';
import {currentIdentity} from '../../../server/session';

// Signed-in area: every page checks its own session (`requireAccount`) with its own return path;
// the layout only draws the member shell and the notices that replace any page.
export const dynamic = 'force-dynamic';

export default async function AppLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations({locale, namespace: 'App'});
  let identity = null;
  let unavailable = false;
  try {
    identity = await currentIdentity();
  } catch {
    unavailable = true;
  }
  if (unavailable) {
    return <SiteShell locale={locale}><section className="notice-page" role="alert"><h1>{t('unavailableTitle')}</h1><p>{t('unavailableBody')}</p></section></SiteShell>;
  }
  if (identity?.account_state === 'cleanup_pending') {
    return <SiteShell locale={locale} email={identity.user.email}>
      <section className="notice-page" role="status"><h1>{t('cleanupTitle')}</h1><p>{t('cleanupBody')}</p></section>
    </SiteShell>;
  }
  return <SiteShell locale={locale} email={identity?.user.email}>{children}</SiteShell>;
}
