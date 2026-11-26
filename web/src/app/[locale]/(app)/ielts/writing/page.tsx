import type {Metadata} from 'next';
import {getFormatter, getTranslations, setRequestLocale} from 'next-intl/server';
import {AttemptList} from '../../../../../components/attempt-list';
import {Unavailable} from '../../../../../components/unavailable';
import {Link} from '../../../../../i18n/navigation';
import {requireMember} from '../../../../../server/access';
import {assessableExams, currentEntitlements, recentAttempts} from '../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Writing'}))('title')};
}

export default async function WritingHome({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/writing');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let data;
  try {
    data = await Promise.all([currentEntitlements(), recentAttempts(5), assessableExams().catch(() => [])]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  const [entitlements, recent, exams] = data;
  // P5.12: the full test shows only when the backend can run it for an exam.
  const simulation = exams.some(exam => exam.simulation);
  const t = await getTranslations({locale, namespace: 'Writing'});
  const format = await getFormatter({locale});
  const {limit, remaining} = entitlements.assessments;
  const resets = format.dateTime(new Date(`${entitlements.period.end}T00:00:00Z`), {day: 'numeric', month: 'long', timeZone: 'UTC'});
  return <section className="page writing-home">
    <div className="writing-hero">
      <div>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className="lead">{t('lead')}</p>
      </div>
      <div className="actions">
        <Link className="button primary" href="/ielts/writing/new">{t('newEssay')}</Link>
        {simulation && <Link className="button" href="/ielts/writing/simulation" title={t('simulationHint')}>{t('simulation')}</Link>}
      </div>
    </div>
    <div className="quota" role="status">
      <strong>{t('quota', {remaining, limit})}</strong>
      <span>{remaining > 0 ? t('quotaResets', {date: resets}) : t('quotaEmpty', {date: resets})}</span>
    </div>
    <section aria-labelledby="recent-title" className="recent">
      <h2 id="recent-title">{t('recent')}</h2>
      {recent.attempts.length ? <AttemptList attempts={recent.attempts} locale={locale}/> : <p className="empty">{t('noEssays')}</p>}
      {recent.total > recent.attempts.length && <p className="more"><Link href="/ielts/writing/history">{t('allEssays', {count: recent.total})}</Link></p>}
    </section>
  </section>;
}
