import createMiddleware from 'next-intl/middleware';
import {NextResponse, type NextRequest} from 'next/server';
import {routing} from './i18n/routing';
import {appOrigin, landingExamFor} from './lib/hosts';

const internationalize = createMiddleware(routing);
const localeRoot = new RegExp(`^/(${routing.locales.join('|')})/?$`);

function closed(response: NextResponse) {
  // Closed to crawlers on every host until the owner opens launch indexing (K §3.9).
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

/**
 * ADR-001: this app serves exams.mnemonicwords.app (the application) and the landing hosts
 * (ielts.mnemonicwords.app). A landing host shows its landing at /{locale} (the root page picks it by host);
 * any other path is sent to the same path on the application host, where accounts and sessions live.
 * No rewrites here: Next treats a rewrite to its own bind address as an external request.
 */
export default function proxy(request: NextRequest) {
  const {pathname, search} = request.nextUrl;
  if (landingExamFor(request.headers.get('host')) && pathname !== '/' && !localeRoot.test(pathname)) {
    return closed(NextResponse.redirect(`${appOrigin()}${pathname}${search}`, 308));
  }
  return closed(internationalize(request));
}

export const config = {matcher: '/((?!api|_next|.*\\..*).*)'};
