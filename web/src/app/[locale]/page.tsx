import type {Metadata} from 'next';
import {setRequestLocale} from 'next-intl/server';
import {headers} from 'next/headers';
import {Landing, landingMetadata} from '../../components/landing';
import {redirect} from '../../i18n/navigation';
import {landingExamFor} from '../../lib/hosts';
import {homePath} from '../../lib/return-path';
import {currentIdentity} from '../../server/session';

// One root, two hosts (ADR-001): on a landing host (ielts.) it is the exam landing; on the application host
// members go to Writing and guests sign in. Chosen here rather than by a proxy rewrite: Next treats a rewrite
// to its own bind address as an external request, which breaks behind nginx (X-Forwarded-Proto: https).
export const dynamic = 'force-dynamic';

async function landingRequest() {
  const host = ((await headers()).get('host') ?? '').toLowerCase();
  const exam = landingExamFor(host);
  return exam ? {exam, host} : null;
}

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const landing = await landingRequest();
  return landing ? landingMetadata(locale, landing.host) : {};
}

export default async function Root({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const landing = await landingRequest();
  if (landing) return <Landing locale={locale} exam={landing.exam}/>;
  let signedIn = false;
  try {
    signedIn = (await currentIdentity()) !== null;
  } catch {
    signedIn = false;
  }
  return redirect({href: signedIn ? homePath : '/login', locale});
}
