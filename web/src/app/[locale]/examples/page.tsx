import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ExamplesHub, examplesMetadata} from '../../../components/examples';
import {publicHost} from '../../../lib/public-host';

export const dynamic = 'force-dynamic';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const site = await publicHost();
  return site ? examplesMetadata(locale, site.host) : {};
}

export default async function ExamplesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const site = await publicHost();
  if (!site || site.exam !== 'ielts') notFound();
  return <ExamplesHub locale={locale} host={site.host}/>;
}
