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
  searchParams: Promise<{exam?: string | string[]; task?: string | string[]}>;
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
  const query = await searchParams;
  const exam = exams.find(e => e.key === query.exam) ?? exams.find(e => e.key === member.profile.target_exam_key) ?? exams[0];
  // Task 1 only where the backend assesses it (Academic, EXAM_TASK1_ENABLED); otherwise Task 2.
  const task = exam.tasks.find(t => t === query.task) ?? 'task-2';
  let tasks: PracticeTask[];
  try {
    tasks = await practiceTasks(exam.key, task);
  } catch {
    tasks = [];
  }
  return <NewEssay exams={exams} exam={exam.key} task={task} taskKeys={exam.tasks} tasks={tasks}/>;
}
