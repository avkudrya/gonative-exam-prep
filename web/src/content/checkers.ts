/**
 * P6.5: pages for the searches people actually make — a Task 2 checker, an Academic Task 1 checker, a letter checker.
 * Each shows what is checked, an example and a few of our own library tasks (packages/exam-domain/library), never
 * thin generated text. Tasks are shown in English, as in the test.
 */
import type {ChartSpec} from '@gonative/exam-domain';
import academic from '../../../packages/exam-domain/library/ielts-writing-task-1-academic.v1.json';
import general from '../../../packages/exam-domain/library/ielts-writing-task-1-general.v1.json';
import task2 from '../../../packages/exam-domain/library/ielts-writing-task-2.v1.json';

export type CheckerSlug = 'ielts-writing-task-2-checker' | 'ielts-academic-task-1-checker' | 'ielts-general-training-letter-checker';
export type CheckerTask = {ref: string; text: string; chart?: ChartSpec};
export type Checker = {slug: CheckerSlug; example: string; guide: string; tasks: CheckerTask[]};

type LibraryTask = {ref: string; text: string; stimulus?: unknown};
const pick = (library: {tasks: LibraryTask[]}, refs: string[]): CheckerTask[] => refs.map(ref => {
  const task = library.tasks.find(t => t.ref === ref);
  if (!task) throw new Error(`No library task ${ref}`);
  const stimulus = task.stimulus as {format?: string} | undefined;
  return {ref, text: task.text, ...(stimulus?.format === 'chart-spec/1' ? {chart: stimulus as ChartSpec} : {})};
});

export const checkers: Checker[] = [
  {slug: 'ielts-writing-task-2-checker', example: 'task-2-discussion-essay', guide: 'writing-task-2',
    tasks: pick(task2, ['gonative-bench:p01', 'gonative-bench:p07', 'gonative-bench:p03', 'gonative-bench:p14'])},
  {slug: 'ielts-academic-task-1-checker', example: 'academic-task-1-line-graph', guide: 'academic-task-1',
    tasks: pick(academic, ['gonative-t1a:t1a-01', 'gonative-t1a:t1a-08', 'gonative-t1a:t1a-13', 'gonative-t1a:t1a-19'])},
  {slug: 'ielts-general-training-letter-checker', example: 'general-training-formal-letter', guide: 'general-training-letter',
    tasks: pick(general, ['gonative-t1g:gt1-01', 'gonative-t1g:gt1-10', 'gonative-t1g:gt1-19', 'gonative-t1g:gt1-05'])},
];

export const checkerBySlug = (slug: string) => checkers.find(c => c.slug === slug) ?? null;
