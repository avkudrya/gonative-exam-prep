/**
 * CSRF check of BFF writes: the browser's Origin must be this site's origin (`EXAMS_WEB_ORIGIN`).
 * Outside production, without the variable, the request's own origin is trusted, and
 * localhost/127.0.0.1 are interchangeable only on the same port.
 */
export function trustedRequestOrigin(origin: string | null | undefined, requestOrigin: string) {
  const configured = process.env.EXAMS_WEB_ORIGIN ?? (process.env.NODE_ENV === 'production' ? '' : requestOrigin);
  if (!origin || !configured) return false;
  if (origin === configured) return true;
  try {
    const expected = new URL(configured);
    const request = new URL(requestOrigin);
    const loopback = (url: URL) => url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
      && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
    return loopback(expected) && loopback(request) && expected.port === request.port && origin === request.origin;
  } catch {
    return false;
  }
}
