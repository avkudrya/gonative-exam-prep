import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ListeningReview, ListeningRunner} from '../../../../../../components/listening';
import {Unavailable} from '../../../../../../components/unavailable';
import {redirect} from '../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../server/access';
import {listeningAttempt} from '../../../../../../server/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Listening'}))('title')};
}

/** One Listening attempt: listening and answering, then the review. */
export default async function ListeningAttemptPage({params}: {params: Promise<{locale: string; uuid: string}>}) {
  const {locale, uuid: raw} = await params;
  setRequestLocale(locale);
  if (!uuidPattern.test(raw)) notFound();
  const uuid = raw.toLowerCase();
  const member = await requireMember(locale, `/ielts/listening/${uuid}`);
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let attempt;
  try {
    attempt = await listeningAttempt(uuid);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!attempt) notFound();
  if (attempt.status === 'abandoned') return redirect({href: '/ielts/listening', locale});
  if (attempt.status === 'started') return <ListeningRunner key={attempt.uuid} attempt={attempt}/>;
  const language = member.profile.feedback_language ?? (locale === 'ru' || locale === 'uk' ? locale : 'en');
  return <ListeningReview attempt={attempt} language={language}/>;
}
