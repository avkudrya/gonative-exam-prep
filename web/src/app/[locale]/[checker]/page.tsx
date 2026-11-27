import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {CheckerPage, checkerMetadata} from '../../../components/checker';
import {checkerBySlug} from '../../../content/checkers';
import {publicHost} from '../../../lib/public-host';

// Only the checker pages (P6.5) on the landing host; any other path here is not found.
export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string; checker: string}>}): Promise<Metadata> {
  const {locale, checker} = await params;
  const site = await publicHost();
  const found = checkerBySlug(checker);
  return site && found ? checkerMetadata(locale, site.host, found) : {};
}

export default async function CheckerRoute({params}: {params: Promise<{locale: string; checker: string}>}) {
  const {locale, checker} = await params;
  setRequestLocale(locale);
  const site = await publicHost();
  const found = site?.exam === 'ielts' ? checkerBySlug(checker) : null;
  if (!site || !found) notFound();
  return <CheckerPage locale={locale} host={site.host} checker={found}/>;
}
