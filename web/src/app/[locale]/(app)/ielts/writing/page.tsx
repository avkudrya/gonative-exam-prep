import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {requireAccount} from '../../../../../server/access';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Writing'}))('title')};
}

// Writing home. Tasks, drafts and quota arrive in P3.3.
export default async function WritingHome({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const {identity} = await requireAccount(locale, '/ielts/writing');
  if (!identity) return null;
  const t = await getTranslations({locale, namespace: 'Writing'});
  return <section className="page">
    <p className="eyebrow">{t('eyebrow')}</p>
    <h1>{t('title')}</h1>
    <p>{t('soon')}</p>
  </section>;
}
