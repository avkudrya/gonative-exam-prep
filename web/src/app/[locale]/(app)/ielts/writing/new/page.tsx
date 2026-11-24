import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {NewEssay} from '../../../../../../components/new-essay';
import type {PracticeTask} from '../../../../../../lib/api/schemas';
import {Unavailable} from '../../../../../../components/unavailable';
import {requireMember} from '../../../../../../server/access';
import {assessableExams, practiceTasks} from '../../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'NewEssay'}))('title')};
}

export default async function NewEssayPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{exam?: string | string[]}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/writing/new');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let exams;
  try {
    exams = await assessableExams();
  } catch {
    return <Unavailable locale={locale}/>;
  }
  if (!exams.length) return <Unavailable locale={locale}/>;
  const requested = (await searchParams).exam;
  const exam = exams.find(e => e.key === requested)?.key ?? exams.find(e => e.key === member.profile.target_exam_key)?.key ?? exams[0].key;
  let tasks: PracticeTask[];
  try {
    tasks = await practiceTasks(exam);
  } catch {
    tasks = [];
  }
  return <NewEssay exams={exams} exam={exam} tasks={tasks}/>;
}
