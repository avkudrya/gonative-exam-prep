import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {AuthForm} from '../../../../components/auth-form';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Auth'}))('titles.join')};
}

export default function Page() {
  return <AuthForm mode="join" googleClientId={process.env.EXAMS_GOOGLE_CLIENT_ID || undefined}/>;
}
