import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {GuideHub, guideHubMetadata} from '../../../components/guide';
import {guideChapters} from '../../../content/guide';
import {publicHost} from '../../../lib/public-host';

// The canonical URL depends on the landing host, so the page is rendered per request; it calls no backend.
export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const site = await publicHost();
  return site && guideChapters(locale).length ? guideHubMetadata(locale, site.host) : {};
}

export default async function GuidePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const site = await publicHost();
  if (!site || site.exam !== 'ielts' || !guideChapters(locale).length) notFound();
  return <GuideHub locale={locale} host={site.host}/>;
}
