import type {Metadata} from 'next';
import {Unavailable} from '../../../../components/unavailable';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {DeletionSettings, PasswordSettings, PreferenceSettings} from '../../../../components/settings';
import {Link} from '../../../../i18n/navigation';
import {SUPPORT_EMAIL} from '../../../../lib/legal/common';
import {requireMember} from '../../../../server/access';
import {assessableExams} from '../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Settings'}))('title')};
}

export default async function Settings({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/settings');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  const t = await getTranslations({locale, namespace: 'Settings'});
  const exams = await assessableExams().catch(() => []);
  const hasPassword = member.identity.user.has_password;
  return <section className="page settings">
    <h1>{t('title')}</h1>
    <p className="account-line">{t('signedInAs', {email: member.identity.user.email})}</p>
    <PreferenceSettings profile={member.profile} exams={exams}/>
    {hasPassword ? <PasswordSettings/> : <section className="card" aria-labelledby="password-title">
      <h2 id="password-title">{t('password.title')}</h2>
      <p className="hint">{t('password.google')}</p>
    </section>}
    <section className="card" aria-labelledby="documents-title">
      <h2 id="documents-title">{t('documents.title')}</h2>
      <p>{t('documents.accepted', {version: member.profile.terms_version})}</p>
      <p className="links"><Link href="/terms">{t('documents.terms')}</Link> <Link href="/privacy">{t('documents.privacy')}</Link></p>
    </section>
    <DeletionSettings hasPassword={hasPassword} supportEmail={SUPPORT_EMAIL}/>
  </section>;
}
