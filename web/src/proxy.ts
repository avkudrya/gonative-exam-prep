import createMiddleware from 'next-intl/middleware';
import {NextResponse, type NextRequest} from 'next/server';
import {routing} from './i18n/routing';
import {appOrigin, landingExamFor, LANDING_HEADER} from './lib/hosts';

const internationalize = createMiddleware(routing);
const localeRoot = new RegExp(`^/(${routing.locales.join('|')})/?$`);
const landingPath = /^\/[a-z]{2}\/landing\/([a-z]+)\/?$/;

function closed(response: NextResponse) {
  // Closed to crawlers on every host until the owner opens launch indexing (K §3.9).
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

/**
 * ADR-001: this app serves exams.mnemonicwords.app (the application) and the landing hosts
 * (ielts.mnemonicwords.app). A landing host shows its landing at /{locale}; any other path is
 * sent to the same path on the application host, where accounts and sessions live.
 *
 * The landing is an internal rewrite to /{locale}/landing/{exam}, marked with a request header.
 * Next runs the proxy again for the rewritten path (with an internal host), so that pass is
 * recognised by the header; without it the landing path does not exist.
 */
export default function proxy(request: NextRequest) {
  const {pathname, search} = request.nextUrl;
  const internal = landingPath.exec(pathname);
  if (internal) {
    if (request.headers.get(LANDING_HEADER) === internal[1]) return closed(NextResponse.next());
    const url = request.nextUrl.clone();
    url.pathname = '/en/landing-not-found';
    return closed(NextResponse.rewrite(url, {status: 404}));
  }
  const exam = landingExamFor(request.headers.get('host'));
  if (exam) {
    const root = localeRoot.exec(pathname);
    if (root) {
      const url = request.nextUrl.clone();
      url.pathname = `/${root[1]}/landing/${exam}`;
      const headers = new Headers(request.headers);
      headers.set(LANDING_HEADER, exam);
      return closed(NextResponse.rewrite(url, {request: {headers}}));
    }
    if (pathname !== '/') return closed(NextResponse.redirect(`${appOrigin()}${pathname}${search}`, 308));
  }
  return closed(internationalize(request));
}

export const config = {matcher: '/((?!api|_next|.*\\..*).*)'};
