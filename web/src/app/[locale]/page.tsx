import {setRequestLocale} from 'next-intl/server';
import {redirect} from '../../i18n/navigation';
import {homePath} from '../../lib/return-path';
import {currentIdentity} from '../../server/session';

// The application host has no page of its own at the root: members go to Writing, guests sign in.
// The public IELTS landing is a separate host (P3.6).
export const dynamic = 'force-dynamic';

export default async function Root({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  let signedIn = false;
  try {
    signedIn = (await currentIdentity()) !== null;
  } catch {
    signedIn = false;
  }
  return redirect({href: signedIn ? homePath : '/login', locale});
}
