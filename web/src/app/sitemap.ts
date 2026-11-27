import type {MetadataRoute} from 'next';
import {headers} from 'next/headers';
import {examples} from '../content/examples';
import {chapterLocales, guide, guideChapters} from '../content/guide';
import {routing} from '../i18n/routing';
import {landingExamFor, publicIndexing, publicUrl} from '../lib/hosts';

export const dynamic = 'force-dynamic';

/** The public pages of a landing host with their language versions; empty elsewhere and while indexing is closed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = ((await headers()).get('host') ?? '').toLowerCase();
  if (!publicIndexing() || !landingExamFor(host)) return [];
  const page = (path: (locale: string) => string, locales: readonly string[], lastModified?: string) => locales.map(locale => ({
    url: publicUrl(host, path(locale)),
    ...(lastModified ? {lastModified} : {}),
    alternates: {languages: Object.fromEntries(locales.map(l => [l, publicUrl(host, path(l))]))},
  }));
  const hub = routing.locales.filter(l => guideChapters(l).length > 0);
  return [
    ...page(l => `/${l}`, routing.locales),
    ...page(l => `/${l}/guide`, hub),
    ...guide.flatMap(entry => {
      const locales = chapterLocales(entry.slug);
      return locales.length ? page(l => `/${l}/guide/${entry.slug}`, locales, Object.values(entry.locales)[0]?.checked) : [];
    }),
    ...page(l => `/${l}/examples`, routing.locales),
    ...examples.flatMap(e => page(l => `/${l}/examples/${e.slug}`, routing.locales)),
  ];
}
