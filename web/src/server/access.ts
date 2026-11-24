import 'server-only';
import {redirect} from '../i18n/navigation';
import type {Identity, Profile} from '../lib/api/schemas';
import {currentIdentity, currentProfile} from './session';

type Unavailable = {identity: null; profile: null; unavailable: true};

/**
 * Guard of a signed-in page: without a session → sign-in with this page as the return path.
 * `unavailable` means the backend could not be reached; the page shows a notice instead of data.
 */
export async function requireAccount(locale: string, returnTo: string): Promise<{identity: Identity; unavailable: false} | Unavailable> {
  let identity;
  try {
    identity = await currentIdentity();
  } catch {
    return {identity: null, profile: null, unavailable: true};
  }
  if (!identity) return redirect({href: {pathname: '/login', query: {next: returnTo}}, locale});
  return {identity, unavailable: false};
}

/**
 * Guard of the Exams pages: a member who has not accepted the current Terms, confirmed 16+ or
 * chosen a feedback language is sent to /welcome first, and comes back here afterwards.
 */
export async function requireMember(locale: string, returnTo: string): Promise<{identity: Identity; profile: Profile; unavailable: false} | Unavailable> {
  const account = await requireAccount(locale, returnTo);
  if (account.unavailable) return account;
  let profile;
  try {
    profile = await currentProfile();
  } catch {
    return {identity: null, profile: null, unavailable: true};
  }
  if (!profile.onboarding_complete) return redirect({href: {pathname: '/welcome', query: {next: returnTo}}, locale});
  return {identity: account.identity, profile, unavailable: false};
}
