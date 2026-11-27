import {getTranslations, setRequestLocale} from 'next-intl/server';
import {SiteShell} from '../../../components/site-shell';
import {currentEntitlements, currentIdentity} from '../../../server/session';

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
  // P7.4, P7.10: the Reading and Listening links only while they are on (an older backend or an error: no link).
  const entitlements = identity ? await currentEntitlements().catch(() => null) : null;
  const reading = entitlements?.reading_tests?.enabled === true;
  const listening = entitlements?.listening_tests?.enabled === true;
  return <SiteShell locale={locale} email={identity?.user.email} reading={reading} listening={listening}>{children}</SiteShell>;
}
