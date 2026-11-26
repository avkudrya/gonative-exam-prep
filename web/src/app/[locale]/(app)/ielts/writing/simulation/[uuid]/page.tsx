import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SimulationReady, SimulationSummary, SimulationWriter} from '../../../../../../../components/simulation';
import {Unavailable} from '../../../../../../../components/unavailable';
import {redirect} from '../../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../../server/access';
import {assessableExams, currentAttempt, currentEntitlements, writingSession} from '../../../../../../../server/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Simulation'}))('title')};
}

/** One Writing simulation: the pair before the start, both answers on the timer, then the summary. */
export default async function SimulationPage({params}: {params: Promise<{locale: string; uuid: string}>}) {
  const {locale, uuid: raw} = await params;
  setRequestLocale(locale);
  if (!uuidPattern.test(raw)) notFound();
  const uuid = raw.toLowerCase();
  const member = await requireMember(locale, `/ielts/writing/simulation/${uuid}`);
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let session, exams;
  try {
    [session, exams] = await Promise.all([writingSession(uuid), assessableExams().catch(() => [])]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!session) notFound();
  if (session.status === 'abandoned') return redirect({href: '/ielts/writing/simulation', locale});
  const examName = exams.find(exam => exam.key === session.exam_key)?.name ?? session.exam_key;
  if (session.status === 'ready') return <SimulationReady key={`${session.uuid}:${session.swaps_left}`} session={session} examName={examName}/>;
  if (session.status === 'submitted') return <SimulationSummary key={session.summary?.status} session={session} examName={examName}/>;
  const uuids = session.tasks.map(task => task.attempt?.uuid);
  if (!uuids[0] || !uuids[1]) return <Unavailable locale={locale}/>;
  let attempts, entitlements;
  try {
    [attempts, entitlements] = await Promise.all([Promise.all(uuids.map(u => currentAttempt(u!))), currentEntitlements()]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!attempts[0] || !attempts[1]) return <Unavailable locale={locale}/>;
  const feedbackLanguage = member.profile.feedback_language ?? (locale === 'ru' || locale === 'uk' ? locale : 'en');
  return <SimulationWriter session={session} attempts={[attempts[0], attempts[1]]} examName={examName} feedbackLanguage={feedbackLanguage}
    remaining={entitlements.assessments.remaining} limit={entitlements.assessments.limit}/>;
}
