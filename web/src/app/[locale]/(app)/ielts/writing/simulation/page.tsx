import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SimulationStart} from '../../../../../../components/simulation';
import {Unavailable} from '../../../../../../components/unavailable';
import {redirect} from '../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../server/access';
import {assessableExams, writingSessions} from '../../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Simulation'}))('title')};
}

/** P5.12: the full Writing test — continue the open one, or choose the exam and start; the recent ones below. */
export default async function SimulationHome({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/writing/simulation');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let data;
  try {
    data = await Promise.all([writingSessions(), assessableExams()]);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  const [sessions, exams] = data;
  if (sessions.open) return redirect({href: `/ielts/writing/simulation/${sessions.open.uuid}`, locale});
  const available = exams.filter(exam => exam.simulation);
  if (!sessions.enabled || available.length === 0) notFound();
  return <SimulationStart exams={available.map(({key, name}) => ({key, name}))} defaultExam={member.profile.target_exam_key} sessions={sessions.sessions}/>;
}
