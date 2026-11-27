import {headers} from 'next/headers';
import {landingExamFor} from './hosts';

/** The landing host of this request, or null on the application host (public pages exist only on landing hosts). */
export async function publicHost() {
  const host = ((await headers()).get('host') ?? '').toLowerCase();
  const exam = landingExamFor(host);
  return exam ? {exam, host} : null;
}
