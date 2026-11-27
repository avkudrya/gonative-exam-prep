import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ExamplePage, exampleMetadata} from '../../../../components/examples';
import {exampleBySlug} from '../../../../content/examples';
import {publicHost} from '../../../../lib/public-host';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string; slug: string}>}): Promise<Metadata> {
  const {locale, slug} = await params;
  const site = await publicHost();
  return site ? exampleMetadata(locale, site.host, slug) : {};
}

export default async function ExampleRoute({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const site = await publicHost();
  const example = site?.exam === 'ielts' ? exampleBySlug(slug) : null;
  if (!site || !example) notFound();
  return <ExamplePage locale={locale} host={site.host} example={example} leftOut={example.leftOut}/>;
}
