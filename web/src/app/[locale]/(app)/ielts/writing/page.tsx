import type {Metadata} from 'next';
import {getFormatter, getTranslations, setRequestLocale} from 'next-intl/server';
import {AttemptList} from '../../../../../components/attempt-list';
import {Unavailable} from '../../../../../components/unavailable';
import {Link} from '../../../../../i18n/navigation';
import {requireMember} from '../../../../../server/access';
import {currentEntitlements, recentAttempts} from '../../../../../server/session';

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
    data = await Promise.all([currentEntitlements(), recentAttempts(5)]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  const [entitlements, recent] = data;
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
      <Link className="button primary" href="/ielts/writing/new">{t('newEssay')}</Link>
    </div>
    <div className="quota" role="status">
      <strong>{t('quota', {remaining, limit})}</strong>
      <span>{remaining > 0 ? t('quotaResets', {date: resets}) : t('quotaEmpty', {date: resets})}</span>
    </div>
    <section aria-labelledby="recent-title" className="recent">
      <h2 id="recent-title">{t('recent')}</h2>
      {recent.attempts.length ? <AttemptList attempts={recent.attempts} locale={locale}/> : <p className="empty">{t('noEssays')}</p>}
    </section>
  </section>;
}
