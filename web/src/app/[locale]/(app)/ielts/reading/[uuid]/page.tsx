import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ReadingReview, ReadingRunner} from '../../../../../../components/reading';
import {Unavailable} from '../../../../../../components/unavailable';
import {redirect} from '../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../server/access';
import {readingAttempt} from '../../../../../../server/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Reading'}))('title')};
}

/** One Reading attempt: answering on the timer, then the review. */
export default async function ReadingAttemptPage({params}: {params: Promise<{locale: string; uuid: string}>}) {
  const {locale, uuid: raw} = await params;
  setRequestLocale(locale);
  if (!uuidPattern.test(raw)) notFound();
  const uuid = raw.toLowerCase();
  const member = await requireMember(locale, `/ielts/reading/${uuid}`);
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let attempt;
  try {
    attempt = await readingAttempt(uuid);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!attempt) notFound();
  if (attempt.status === 'abandoned') return redirect({href: '/ielts/reading', locale});
  if (attempt.status === 'started') return <ReadingRunner key={attempt.uuid} attempt={attempt}/>;
  const language = member.profile.feedback_language ?? (locale === 'ru' || locale === 'uk' ? locale : 'en');
  return <ReadingReview attempt={attempt} language={language}/>;
}
