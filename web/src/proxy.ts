import createMiddleware from 'next-intl/middleware';
import {NextResponse, type NextRequest} from 'next/server';
import {routing} from './i18n/routing';
import {appOrigin, isGuidePath, isPublicPath, landingExamFor, landingOrigin, publicIndexing} from './lib/hosts';

const internationalize = createMiddleware(routing);

function closed(response: NextResponse) {
  // Closed to crawlers: the application host always, the landing hosts until the owner opens indexing (P6.7).
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

/**
 * ADR-001: this app serves exams.mnemonicwords.app (the application) and the landing hosts
 * (ielts.mnemonicwords.app). A landing host serves its public pages — the landing at /{locale} (the root page picks
 * it by host) and the guide (P6.2); any other path is sent to the same path on the application host, where accounts
 * and sessions live. The guide asked on the application host goes to the landing host.
 * No rewrites here: Next treats a rewrite to its own bind address as an external request.
 */
export default function proxy(request: NextRequest) {
  const {pathname, search} = request.nextUrl;
  const exam = landingExamFor(request.headers.get('host'));
  if (exam) {
    if (!isPublicPath(pathname)) return closed(NextResponse.redirect(`${appOrigin()}${pathname}${search}`, 308));
    const response = internationalize(request);
    return publicIndexing() ? response : closed(response);
  }
  if (isGuidePath(pathname)) return closed(NextResponse.redirect(`${landingOrigin()}${pathname}${search}`, 308));
  return closed(internationalize(request));
}

export const config = {matcher: '/((?!api|_next|.*\\..*).*)'};
