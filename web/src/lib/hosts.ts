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
