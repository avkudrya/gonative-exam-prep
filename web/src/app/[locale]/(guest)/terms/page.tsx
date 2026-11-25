import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {LegalDocumentView} from '../../../../components/legal-document';
import {terms} from '../../../../lib/legal/terms';

const pick = (locale: string) => terms[locale === 'ru' || locale === 'uk' ? locale : 'en'];

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: pick(locale).title, description: pick(locale).intro};
}

export default async function Page({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={pick(locale)} locale={locale} kind="terms"/>;
}
