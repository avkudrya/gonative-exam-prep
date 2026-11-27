import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {GuideChapter, chapterMetadata} from '../../../../components/guide';
import {guideChapter} from '../../../../content/guide';
import {publicHost} from '../../../../lib/public-host';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string; slug: string}>}): Promise<Metadata> {
  const {locale, slug} = await params;
  const site = await publicHost();
  return site ? chapterMetadata(locale, site.host, slug) : {};
}

export default async function ChapterPage({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const site = await publicHost();
  const found = site?.exam === 'ielts' ? guideChapter(slug, locale) : null;
  if (!site || !found) notFound();
  return <GuideChapter locale={locale} host={site.host} entry={found.entry} chapter={found.chapter}/>;
}
