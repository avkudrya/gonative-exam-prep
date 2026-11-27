import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ReadingHome} from '../../../../../components/reading';
import {Unavailable} from '../../../../../components/unavailable';
import {redirect} from '../../../../../i18n/navigation';
import {requireMember} from '../../../../../server/access';
import {readingIndex} from '../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Reading'}))('title')};
}

/** P7.4: IELTS Reading — continue the open attempt, or choose a test or one of its sections; the recent attempts below. */
export default async function ReadingPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/reading');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let index;
  try {
    index = await readingIndex();
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!index.enabled) notFound();
  if (index.open) return redirect({href: `/ielts/reading/${index.open.uuid}`, locale});
  return <ReadingHome index={index}/>;
}
