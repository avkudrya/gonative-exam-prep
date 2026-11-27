import type {MetadataRoute} from 'next';
import {headers} from 'next/headers';
import {landingExamFor, publicIndexing, publicUrl} from '../lib/hosts';

export const dynamic = 'force-dynamic';

// Per host (P6.2): a landing host opens to crawlers once the owner sets EXAMS_PUBLIC_INDEXING=open (P6.7);
// the application host never does.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') ?? '').toLowerCase();
  if (publicIndexing() && landingExamFor(host)) {
    return {rules: {userAgent: '*', allow: '/'}, sitemap: publicUrl(host, '/sitemap.xml')};
  }
  return {rules: {userAgent: '*', disallow: '/'}};
}
