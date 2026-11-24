import type {Metadata} from 'next';
import {Unavailable} from '../../../../components/unavailable';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {WelcomeForm} from '../../../../components/welcome-form';
import {redirect} from '../../../../i18n/navigation';
import {TERMS_VERSION} from '../../../../lib/legal/common';
import {homePath, safeReturnPath} from '../../../../lib/return-path';
import {requireAccount} from '../../../../server/access';
import {assessableExams, currentProfile} from '../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Welcome'}))('title')};
}

export default async function Welcome({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{next?: string | string[]}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const next = safeReturnPath(typeof query.next === 'string' ? query.next : null) ?? homePath;
  const account = await requireAccount(locale, '/welcome');
  if (account.unavailable) return <Unavailable locale={locale}/>;
  let profile;
  try {
    profile = await currentProfile();
  } catch {
    return <Unavailable locale={locale}/>;
  }
  const exams = await assessableExams().catch(() => []);
  if (profile.onboarding_complete) return redirect({href: next, locale});
  // The text shown must be the version the backend accepts; otherwise wait for both to match.
  const termsReady = profile.terms_version === TERMS_VERSION;
  return <WelcomeForm profile={profile} exams={exams} next={next} termsReady={termsReady}/>;
}
