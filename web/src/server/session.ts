import 'server-only';
import {cookies} from 'next/headers';
import {cache} from 'react';
import {entitlementsSchema, identitySchema, profileSchema} from '../lib/api/schemas';
import {backend, BackendError, cookieName} from './upstream';

/** Server components read the session from the httpOnly cookie; `null` means "not signed in". */
export async function sessionToken() {
  return (await cookies()).get(cookieName)?.value ?? null;
}

/** Deduplicated per request: the layout and the page both ask. */
export const currentIdentity = cache(async () => {
  const token = await sessionToken();
  if (!token) return null;
  try {
    return identitySchema.parse(await backend('auth/me', 'GET', undefined, token));
  } catch (error) {
    if (error instanceof BackendError && error.status === 401) return null;
    throw error;
  }
});

export async function currentProfile() {
  const token = await sessionToken();
  const result = await backend('profile', 'GET', undefined, token ?? undefined) as {profile: unknown};
  return profileSchema.parse(result.profile);
}

export async function currentEntitlements() {
  const token = await sessionToken();
  return entitlementsSchema.parse(await backend('entitlements', 'GET', undefined, token ?? undefined));
}
