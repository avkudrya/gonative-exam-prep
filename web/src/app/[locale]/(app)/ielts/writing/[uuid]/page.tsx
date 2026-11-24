import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {attemptState} from '../../../../../../components/attempt-list';
import {EssayEditor} from '../../../../../../components/essay-editor';
import {Unavailable} from '../../../../../../components/unavailable';
import {Link} from '../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../server/access';
import {assessableExams, currentAttempt} from '../../../../../../server/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Editor'}))('title')};
}

export default async function AttemptPage({params}: {params: Promise<{locale: string; uuid: string}>}) {
  const {locale, uuid} = await params;
  setRequestLocale(locale);
  if (!uuidPattern.test(uuid)) notFound();
  const member = await requireMember(locale, `/ielts/writing/${uuid.toLowerCase()}`);
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let attempt;
  try {
    attempt = await currentAttempt(uuid.toLowerCase());
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!attempt) notFound();
  const exams = await assessableExams().catch(() => []);
  const examName = exams.find(exam => exam.key === attempt.exam_key)?.name ?? attempt.exam_key;
  if (attempt.status === 'draft') return <EssayEditor key={attempt.uuid} attempt={attempt} examName={examName}/>;
  // Submitted essays: the waiting screen and the feedback arrive in P3.4.
  const t = await getTranslations({locale, namespace: 'Writing'});
  const state = attemptState(attempt);
  return <section className="page editor">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <h1>{attempt.topic ?? t('ownTask')}</h1>
    <p><span className={`badge ${state}`}>{t(`states.${state}`)}</span></p>
    <p className="prompt-text">{attempt.prompt.text}</p>
    <div className="essay-readonly" lang="en">{attempt.response_text}</div>
  </section>;
}
