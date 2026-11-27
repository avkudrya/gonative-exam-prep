import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ListeningHome} from '../../../../../components/listening';
import {Unavailable} from '../../../../../components/unavailable';
import {redirect} from '../../../../../i18n/navigation';
import {requireMember} from '../../../../../server/access';
import {listeningIndex} from '../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Listening'}))('title')};
}

/** P7.10: IELTS Listening — continue the open attempt, or choose a test or one of its parts; the sound check and recent attempts. */
export default async function ListeningPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/listening');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let index;
  try {
    index = await listeningIndex();
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!index.enabled) notFound();
  if (index.open) return redirect({href: `/ielts/listening/${index.open.uuid}`, locale});
  return <ListeningHome index={index}/>;
}
