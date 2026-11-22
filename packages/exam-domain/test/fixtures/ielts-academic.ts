import type {Exam, ExamProvider, Rubric} from '../../src/index.js';

/*
 * ARCHITECTURE FIXTURE, NOT PRODUCT DATA. Figures follow the project spec (§6) and are
 * status `draft`: they are verified against the official IELTS pages in task P0.3
 * before any version is marked `verified` in the backend.
 */

export const ieltsProvider: ExamProvider = {key: 'ielts', officialName: 'IELTS', website: 'https://ielts.org/'};

const sources = [
  {url: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing', title: 'IELTS Academic format – Writing'},
  {url: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail', title: 'IELTS scoring in detail'},
];

// Uncalibrated estimates show as ranges on a half-band grid, at least one band wide (ADR-003).
const approximate = {step: 0.5, minWidth: 1} as const;
const band = {kind: 'band', min: 0, max: 9, step: 1, approximate} as const;
const equal = (keys: string[]) => ({kind: 'weighted_mean', weights: Object.fromEntries(keys.map(k => [k, 1]))}) as const;

const writingRubric = (task: 1 | 2): Rubric => {
  const first = task === 1
    ? {key: 'task_achievement', officialName: 'Task Achievement', scale: band}
    : {key: 'task_response', officialName: 'Task Response', scale: band};
  const criteria = [
    first,
    {key: 'coherence_cohesion', officialName: 'Coherence and Cohesion', scale: band},
    {key: 'lexical_resource', officialName: 'Lexical Resource', scale: band},
    {key: 'grammatical_range_accuracy', officialName: 'Grammatical Range and Accuracy', scale: band},
  ];
  return {
    key: `ielts-writing-task-${task}`,
    version: 'draft-1',
    officialName: `IELTS Writing Task ${task} band descriptors`,
    sources,
    criteria,
    aggregation: equal(criteria.map(c => c.key)),
    scale: {kind: 'band', min: 0, max: 9, step: 0.5},
  };
};

export const ieltsAcademic: Exam = {
  key: 'ielts-academic',
  providerKey: 'ielts',
  learningLanguage: 'en',
  officialName: 'IELTS Academic',
  versions: [{
    version: 'draft-1',
    status: 'draft',
    verifiedAt: null,
    sources,
    sections: [{
      key: 'writing',
      skill: 'writing',
      officialName: 'Writing',
      timeMinutes: 60,
      tasks: [
        {key: 'task-1', officialName: 'Writing Task 1', responseGenre: 'report', stimulus: 'structured_data', timeMinutes: 20, words: {min: 150}, rubricKey: 'ielts-writing-task-1'},
        {key: 'task-2', officialName: 'Writing Task 2', responseGenre: 'essay', stimulus: 'text_prompt', timeMinutes: 40, words: {min: 250}, rubricKey: 'ielts-writing-task-2'},
      ],
      // Task 2 counts twice as much as Task 1 (spec §6.1, to be verified).
      aggregation: {kind: 'weighted_mean', weights: {'task-1': 1, 'task-2': 2}, rounding: {step: 0.5, mode: 'nearest'}},
      scale: {kind: 'band', min: 0, max: 9, step: 0.5},
    }],
    rubrics: [writingRubric(1), writingRubric(2)],
  }],
};
