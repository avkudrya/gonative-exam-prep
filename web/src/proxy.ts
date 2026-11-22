import createMiddleware from 'next-intl/middleware';
import type {NextRequest} from 'next/server';
import {routing} from './i18n/routing';

const internationalize = createMiddleware(routing);

// ADR-001: this one app serves exams.mnemonicwords.app (the application) and the exam
// landing hosts (ielts.mnemonicwords.app). The Host → landing routing goes here with the
// first landing page; until then every host gets the same pages.
export default function proxy(request: NextRequest) {
  const response = internationalize(request);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {matcher: '/((?!api|_next|.*\\..*).*)'};
