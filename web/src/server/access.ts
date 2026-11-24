import 'server-only';
import {redirect} from '../i18n/navigation';
import {currentIdentity} from './session';

/**
 * Guard of a signed-in page: without a session → sign-in with this page as the return path.
 * `unavailable` means the backend could not be reached; the page shows a notice instead of data.
 */
export async function requireAccount(locale: string, returnTo: string) {
  let identity;
  try {
    identity = await currentIdentity();
  } catch {
    return {identity: null, unavailable: true as const};
  }
  if (!identity) return redirect({href: {pathname: '/login', query: {next: returnTo}}, locale});
  return {identity, unavailable: false as const};
}
