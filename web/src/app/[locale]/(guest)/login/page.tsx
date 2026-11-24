import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {AuthForm, type AuthNotice} from '../../../../components/auth-form';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Auth'}))('titles.login')};
}

const notices: Record<string, AuthNotice> = {
  'password:changed': 'password_changed',
  'data:deleted': 'data_deleted',
  'account:closed': 'account_closed',
  'signed:out': 'signed_out',
};

export default async function Page({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const query = await searchParams;
  const notice = Object.entries(query).map(([key, value]) => notices[`${key}:${value}`]).find(Boolean);
  return <AuthForm mode="login" googleClientId={process.env.EXAMS_GOOGLE_CLIENT_ID || undefined} notice={notice}/>;
}
