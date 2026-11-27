/**
 * P6.5: real feedback on our own sample answers, exported from MultiAdmin (`exam:examples:export`) through the same
 * mapping, curation and presented ranges as a learner's feedback. Two cards were left out as feedback defects
 * (docs/phase-6/P6-plan.md, P6.5); each file names them in `left_out`.
 */
import {assessmentResultSchema, type Assessment, type AssessmentResult, type Attempt} from '../../lib/api/schemas';
import gt1Formal from './ex-gt1-formal.json';
import gt1Informal from './ex-gt1-informal.json';
import t1aLine from './ex-t1a-line.json';
import t2Discussion from './ex-t2-discussion.json';
import t2Opinion from './ex-t2-opinion.json';
import t2Problem from './ex-t2-problem.json';

export type ExampleKind = 'task2' | 'academic-task-1' | 'letter';

type Exported = typeof t2Opinion;

export type Example = {slug: string; id: string; kind: ExampleKind; leftOut: number; attempt: Attempt; assessment: Assessment & {result: AssessmentResult}};

function example(slug: string, kind: ExampleKind, data: Exported): Example {
  // Parsed at build time: a malformed export fails the build, not the page.
  const result = assessmentResultSchema.parse(data.assessment.result);
  const attempt = {
    uuid: data.id, exam_key: data.exam_key, section_key: 'writing', task_key: data.task_key, status: 'submitted', topic: null,
    word_count: data.word_count, prompt: data.prompt, response_text: data.response_text, assessments: [],
  } as unknown as Attempt;
  const assessment = {uuid: data.id, status: 'assessed', feedback_language: data.assessment.feedback_language, created_at: null, finished_at: null, result} as Assessment & {result: AssessmentResult};
  return {slug, id: data.id, kind, leftOut: data.left_out.length, attempt, assessment};
}

/** In the order they are listed. */
export const examples: Example[] = [
  example('task-2-opinion-essay', 'task2', t2Opinion),
  example('task-2-discussion-essay', 'task2', t2Discussion as Exported),
  example('task-2-problem-solution-essay', 'task2', t2Problem as Exported),
  example('academic-task-1-line-graph', 'academic-task-1', t1aLine as unknown as Exported),
  example('general-training-formal-letter', 'letter', gt1Formal as unknown as Exported),
  example('general-training-informal-letter', 'letter', gt1Informal as unknown as Exported),
];

export const exampleBySlug = (slug: string) => examples.find(e => e.slug === slug) ?? null;
