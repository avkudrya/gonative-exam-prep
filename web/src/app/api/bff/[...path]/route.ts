import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {identitySchema} from '../../../../lib/api/schemas';
import {requestKeyPattern, resolve, sessionPaths} from '../../../../server/bff-routes';
import {trustedRequestOrigin} from '../../../../server/request-origin';
import {landingExamFor} from '../../../../lib/hosts';
import {backend, BackendError, cookieName} from '../../../../server/upstream';

/*
 * Browser → BFF → MultiAdmin `api/exam/*`. The session token stays in an httpOnly cookie of this host;
 * responses carry only the projections listed in `bff-routes.ts`. Nothing here logs request or
 * response bodies: essays are personal data (AGENTS.md rule 4).
 */

const cookieOptions = {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/'};
const MAX_SESSION_DAYS = 30;

function reply(data: unknown, status = 200) {
  return NextResponse.json(data, {status, headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}});
}

function clearSession(response: NextResponse) {
  response.cookies.set(cookieName, '', {...cookieOptions, maxAge: 0});
  return response;
}

/** A generic code for errors without a safe backend reason. */
function genericError(status: number) {
  switch (status) {
    case 401: return 'unauthenticated';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 409: return 'conflict';
    case 413: return 'too_large';
    case 422: return 'invalid_input';
    case 429: return 'rate_limited';
    default: return 'unavailable';
  }
}

async function readBody(req: NextRequest, limit: number) {
  const reader = req.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handle(req: NextRequest, {params}: {params: Promise<{path: string[]}>}) {
  // Landing hosts have no accounts: the BFF answers only on the application host.
  if (landingExamFor(req.headers.get('host'))) return reply({error: 'not_found'}, 404);
  const path = (await params).path.join('/');
  const route = resolve(path, req.method, req.nextUrl.searchParams);
  if (!route) return reply({error: 'not_found'}, 404);

  const writing = route.input !== undefined || req.method !== 'GET';
  if (writing) {
    // Next may normalize the dev URL to localhost even when the browser opened 127.0.0.1.
    const host = req.headers.get('host');
    const requestOrigin = host ? `${req.nextUrl.protocol}//${host}` : req.nextUrl.origin;
    if (!trustedRequestOrigin(req.headers.get('origin'), requestOrigin) || req.headers.get('sec-fetch-site') === 'cross-site') {
      return reply({error: 'forbidden'}, 403);
    }
  }
  const token = req.cookies.get(cookieName)?.value;
  if (route.authenticated && !token) return reply({error: 'unauthenticated'}, 401);
  const key = req.headers.get('idempotency-key');
  if (route.requestKey && (!key || !requestKeyPattern.test(key))) return reply({error: 'invalid_input'}, 422);

  let data: unknown;
  if (route.input) {
    if (!req.headers.get('content-type')?.startsWith('application/json')) return reply({error: 'invalid_input'}, 415);
    const body = await readBody(req, route.maxBody ?? 16384);
    if (body === null) return reply({error: 'too_large'}, 413);
    try {
      data = route.input.parse(JSON.parse(body || '{}'));
    } catch {
      return reply({error: 'invalid_input'}, 422);
    }
  }

  try {
    const result = await backend(route.upstream, req.method, data, route.authenticated ? token : undefined, {
      maxBytes: route.maxBytes,
      timeoutMs: route.timeoutMs,
      headers: route.requestKey && key ? {'Idempotency-Key': key} : undefined,
    });
    if (sessionPaths.has(path)) {
      const session = z.object({
        session_token: z.string().min(1).max(3000).regex(/^[\x21-\x7e]+$/),
        expires_at: z.string().datetime({offset: true}),
      }).parse(result);
      const expires = new Date(Math.min(Date.parse(session.expires_at), Date.now() + MAX_SESSION_DAYS * 86400000));
      if (expires.getTime() <= Date.now()) throw new BackendError(502);
      const response = reply(identitySchema.parse(result));
      response.cookies.set(cookieName, session.session_token, {...cookieOptions, expires});
      return response;
    }
    if (path === 'auth/logout') return clearSession(reply({status: 'signed_out'}));
    if (path === 'auth/password') {
      z.object({status: z.literal('password_changed')}).parse(result);
      return clearSession(reply({status: 'password_changed'}));
    }
    if (path === 'account') return clearSession(reply({status: 'account_closed'}, 202));
    // The Exams membership is gone with the data: the next visit starts from sign-in.
    if (path === 'data') return clearSession(reply({status: 'exams_data_deleted'}));
    const output = route.output(result);
    return reply(output.data, output.status);
  } catch (error) {
    const status = error instanceof BackendError ? error.status : 502;
    const reason = error instanceof BackendError ? error.reason : undefined;
    const retryAfter = error instanceof BackendError ? error.retryAfter : undefined;
    const shown = [401, 403, 404, 409, 413, 422, 429].includes(status) ? status : 503;
    const response = reply({error: reason ?? genericError(status), ...(retryAfter ? {retry_after: retryAfter} : {})}, shown);
    if (status === 401 && route.authenticated) clearSession(response);
    return response;
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
