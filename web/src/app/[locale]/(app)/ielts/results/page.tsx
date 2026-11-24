import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {ReportedResults} from '../../../../../components/reported-results';
import {Unavailable} from '../../../../../components/unavailable';
import {Link} from '../../../../../i18n/navigation';
import {requireMember} from '../../../../../server/access';
import {assessableExams, currentReportedResults} from '../../../../../server/session';

/** The backend accepts a test date that is not in the future and less than three years old. */
function resultDateBounds() {
  const now = Date.now();
  return {today: new Date(now).toISOString().slice(0, 10), earliest: new Date(now - (3 * 365 - 1) * 86400000).toISOString().slice(0, 10)};
}

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Results'}))('title')};
}

/** "I took the exam" (ADR-003): self-reported official results with a separate, revocable calibration consent. */
export default async function Results({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/results');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let results, exams;
  try {
    [results, exams] = await Promise.all([currentReportedResults(), assessableExams()]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  const t = await getTranslations({locale, namespace: 'Results'});
  return <section className="page results">
    <Link className="back" href="/ielts/progress">{t('back')}</Link>
    <h1>{t('title')}</h1>
    <p className="lead">{t('lead')}</p>
    <ReportedResults results={results} exams={exams} defaultExam={member.profile.target_exam_key ?? exams[0]?.key ?? ''}
      {...resultDateBounds()}/>
  </section>;
}
