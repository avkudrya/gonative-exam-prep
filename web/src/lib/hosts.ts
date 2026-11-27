/*
 * One app, several hosts (ADR-001): the application host (`exams.`) and exam landing hosts (`ielts.`).
 * `EXAMS_LANDING_HOSTS` maps a landing hostname to its exam: "ielts.mnemonicwords.app=ielts".
 * Landing hosts serve only their landing page; everything else goes to the application host.
 */
const DEFAULT_LANDINGS = 'ielts.mnemonicwords.app=ielts';
export const landingExams = ['ielts'] as const;
export type LandingExam = typeof landingExams[number];

function landingMap(): Map<string, LandingExam> {
  const map = new Map<string, LandingExam>();
  for (const pair of (process.env.EXAMS_LANDING_HOSTS ?? DEFAULT_LANDINGS).split(',')) {
    const [host, exam] = pair.split('=').map(part => part.trim().toLowerCase());
    if (host && (landingExams as readonly string[]).includes(exam)) map.set(host, exam as LandingExam);
  }
  return map;
}

/** The exam whose landing this host serves, or null for the application host. */
export function landingExamFor(hostHeader: string | null | undefined): LandingExam | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.toLowerCase().replace(/:\d+$/, '');
  return landingMap().get(hostname) ?? null;
}

/** Where sign-in and registration live (absolute, so links leave the landing host). */
export function appOrigin() {
  return (process.env.EXAMS_WEB_ORIGIN ?? 'https://exams.mnemonicwords.app').replace(/\/$/, '');
}

/**
 * Public pages of a landing host (Phase 6, P6.2): the landing at /{locale}, the preparation guide at
 * /{locale}/guide and /{locale}/guide/{chapter}, example feedback at /{locale}/examples and /{locale}/examples/{id}, and the checker pages (P6.5). Everything else on a landing host belongs to the application host.
 */
const CHECKERS = 'ielts-writing-task-2-checker|ielts-academic-task-1-checker|ielts-general-training-letter-checker';
const PUBLIC_PATH = new RegExp(`^/(?:[a-z]{2}(?:/(?:(?:guide|examples)(?:/[a-z0-9-]+)?|${CHECKERS}))?)?/?$`);
export function isPublicPath(pathname: string) {
  return PUBLIC_PATH.test(pathname);
}

/** A guide or example path (P6.4, P6.5), which lives only on the landing host. */
export function isGuidePath(pathname: string) {
  return new RegExp(`^/[a-z]{2}/(?:(?:guide|examples)(?:/|$)|(?:${CHECKERS})/?$)`).test(pathname);
}

/**
 * Whether the public pages of the landing hosts may be indexed. Off unless EXAMS_PUBLIC_INDEXING=open: the owner
 * opens it after proofreading (P6.7). The application host and private pages stay closed either way.
 */
export function publicIndexing() {
  return process.env.EXAMS_PUBLIC_INDEXING === 'open';
}

/** Where the exam's public pages live, for links from the application host. */
export function landingOrigin(exam: LandingExam = 'ielts') {
  const configured = process.env.EXAMS_LANDING_ORIGIN;
  if (configured) return configured.replace(/\/$/, '');
  for (const [host, hostExam] of landingMap()) if (hostExam === exam) return `https://${host}`;
  return 'https://ielts.mnemonicwords.app';
}

/** The public URL of a path on a landing host (no port in production; *.localhost runs over plain HTTP in tests). */
export function publicUrl(host: string, path: string) {
  const hostname = host.replace(/:\d+$/, '');
  const scheme = hostname === 'localhost' || hostname.endsWith('.localhost') ? 'http' : 'https';
  return `${scheme}://${host}${path}`;
}
