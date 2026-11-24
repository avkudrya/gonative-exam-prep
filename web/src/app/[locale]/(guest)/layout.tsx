import {setRequestLocale} from 'next-intl/server';
import {SiteShell} from '../../../components/site-shell';

// Sign-in pages read deployment configuration (Google client) at request time.
export const dynamic = 'force-dynamic';

export default async function GuestLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  return <SiteShell locale={locale}>{children}</SiteShell>;
}
