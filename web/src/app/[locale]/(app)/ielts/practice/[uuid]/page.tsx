import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {Practice} from '../../../../../../components/practice';
import {Unavailable} from '../../../../../../components/unavailable';
import {Link} from '../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../server/access';
import {currentPractice} from '../../../../../../server/session';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Practice'}))('pageTitle')};
}

/** P4.8: a practice session from the Edu bank, one question at a time. */
export default async function PracticePage({params}: {params: Promise<{locale: string; uuid: string}>}) {
  const {locale, uuid: raw} = await params;
  setRequestLocale(locale);
  if (!uuidPattern.test(raw)) notFound();
  const uuid = raw.toLowerCase();
  const member = await requireMember(locale, `/ielts/practice/${uuid}`);
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let session;
  try {
    session = await currentPractice(uuid);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!session) notFound();
  const t = await getTranslations({locale, namespace: 'Practice'});
  const r = await getTranslations({locale, namespace: 'Result'});
  const skillName = r.has(`skills.${session.skill_key}`) ? r(`skills.${session.skill_key}`) : session.skill_key;
  return <section className="page practice-page">
    <Link className="back" href="/ielts/progress">{t('back')}</Link>
    <h1>{t('title', {skill: skillName})}</h1>
    <p className="hint">{t('intro')}</p>
    <Practice initial={session} skillName={skillName}/>
  </section>;
}
