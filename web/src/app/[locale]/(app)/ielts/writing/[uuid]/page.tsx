import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AssessmentView} from '../../../../../../components/assessment-view';
import {EssayEditor} from '../../../../../../components/essay-editor';
import {Unavailable} from '../../../../../../components/unavailable';
import {requireMember} from '../../../../../../server/access';
import {assessableExams, currentAssessment, currentAttempt, currentEntitlements} from '../../../../../../server/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Editor'}))('title')};
}

/** One essay: the editor while it is a draft, then the waiting screen and the feedback. */
export default async function AttemptPage({params}: {params: Promise<{locale: string; uuid: string}>}) {
  const {locale, uuid: raw} = await params;
  setRequestLocale(locale);
  if (!uuidPattern.test(raw)) notFound();
  const uuid = raw.toLowerCase();
  const member = await requireMember(locale, `/ielts/writing/${uuid}`);
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let attempt, entitlements;
  try {
    [attempt, entitlements] = await Promise.all([currentAttempt(uuid), currentEntitlements()]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!attempt) notFound();
  const exams = await assessableExams().catch(() => []);
  const examName = exams.find(exam => exam.key === attempt.exam_key)?.name ?? attempt.exam_key;
  const quota = {remaining: entitlements.assessments.remaining, limit: entitlements.assessments.limit};
  const feedbackLanguage = member.profile.feedback_language ?? (locale === 'ru' || locale === 'uk' ? locale : 'en');
  if (attempt.status === 'draft') {
    return <EssayEditor key={attempt.uuid} attempt={attempt} examName={examName} feedbackLanguage={feedbackLanguage} {...quota}/>;
  }
  let assessment;
  try {
    assessment = attempt.assessment ? await currentAssessment(uuid) : null;
  } catch {
    return <Unavailable locale={locale}/>;
  }
  return <AssessmentView key={`${attempt.uuid}:${assessment?.uuid ?? ''}:${assessment?.status ?? ''}`} attempt={attempt} assessment={assessment}
    examName={examName} feedbackLanguage={feedbackLanguage} {...quota}/>;
}
