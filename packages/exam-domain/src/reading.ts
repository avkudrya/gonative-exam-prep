/*
 * IELTS Reading (Phase 7, docs/phase-7/P7.1-reading-design.md): the format both versions share, the content schema of a
 * test, form checks run by code before any model solves the questions, and the raw-score → approximate band mapping.
 *
 * Facts are those of docs/phase-6/P6.1-ielts-facts.md §3 and §6 (checked 2026-11-27 against ielts.org). Offsets and
 * quotes are matched in the NFC text; a quote must occur in the passage exactly as written.
 */
import {countWords} from './text.js';

export type ReadingExam = 'ielts-academic' | 'ielts-general-training';

export type ReadingQuestionType =
  | 'multiple_choice' | 'multiple_choice_multi' | 'true_false_not_given' | 'yes_no_not_given'
  | 'matching_headings' | 'matching_information' | 'matching_features' | 'matching_sentence_endings'
  | 'sentence_completion' | 'summary_completion' | 'note_completion' | 'table_completion' | 'flow_chart_completion'
  | 'short_answer';

/** P6.1 §3. Diagram label completion is left out of the pilot (it needs a drawing; P7.1 §1). */
export const READING_FORMAT = {
  'ielts-academic': {
    sections: 3, questions: 40, minutes: 60, words: {min: 2150, max: 2750},
    types: ['multiple_choice', 'multiple_choice_multi', 'true_false_not_given', 'yes_no_not_given', 'matching_headings', 'matching_information',
      'matching_features', 'matching_sentence_endings', 'sentence_completion', 'summary_completion', 'note_completion', 'table_completion',
      'flow_chart_completion', 'short_answer'] as ReadingQuestionType[],
  },
  'ielts-general-training': {
    sections: 3, questions: 40, minutes: 60, words: {min: 2150, max: 2375},
    // P6.1 §3: no Yes/No/Not Given, no separate matching sentence endings in General Training.
    types: ['multiple_choice', 'multiple_choice_multi', 'true_false_not_given', 'matching_headings', 'matching_information', 'matching_features',
      'sentence_completion', 'summary_completion', 'note_completion', 'table_completion', 'flow_chart_completion', 'short_answer'] as ReadingQuestionType[],
  },
} as const;

/** Official approximate thresholds (ielts.org «IELTS scoring in detail», P6.1 §6): correct answers out of 40 → band. */
export const READING_THRESHOLDS: Record<ReadingExam, {band: number; raw: number}[]> = {
  'ielts-academic': [{band: 5, raw: 16}, {band: 6, raw: 23}, {band: 7, raw: 30}, {band: 8, raw: 35}],
  'ielts-general-training': [{band: 4, raw: 15}, {band: 5, raw: 23}, {band: 6, raw: 30}, {band: 7, raw: 35}],
};

export const READING_THRESHOLD_SOURCE = 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail';

const CHOICE_TYPES = ['multiple_choice', 'true_false_not_given', 'yes_no_not_given'] as const;
const MATCHING_TYPES = ['matching_headings', 'matching_information', 'matching_features', 'matching_sentence_endings'] as const;
const COMPLETION_TYPES = ['sentence_completion', 'summary_completion', 'note_completion', 'table_completion', 'flow_chart_completion', 'short_answer'] as const;
/** Types whose questions follow the order of the passage in the test. */
const IN_ORDER: ReadingQuestionType[] = ['true_false_not_given', 'yes_no_not_given', 'sentence_completion', 'short_answer', 'multiple_choice'];

export const TRUE_FALSE_NOT_GIVEN = [{id: 'T', text: 'TRUE'}, {id: 'F', text: 'FALSE'}, {id: 'NG', text: 'NOT GIVEN'}];
export const YES_NO_NOT_GIVEN = [{id: 'Y', text: 'YES'}, {id: 'N', text: 'NO'}, {id: 'NG', text: 'NOT GIVEN'}];

export type Explanations = {en: string; ru?: string; uk?: string};
export type Option = {id: string; text: string};

/** One numbered question (one mark), or several numbers for «choose TWO» (one mark per correct letter). */
export type ReadingQuestion = {
  numbers: number[];
  prompt: string;
  /** Option ids (choice and matching types) or accepted answers (completion types; the first is the canonical one). */
  answer: string[];
  /** Words of the passage that give the answer; absent only for NOT GIVEN, whose explanation says why the text is silent. */
  evidence?: string;
  explanation: Explanations;
};

export type ReadingGroup = {
  type: ReadingQuestionType;
  instruction: string;
  /** Choice and matching types; TRUE/FALSE/NOT GIVEN and YES/NO/NOT GIVEN use the fixed lists above. */
  options?: Option[];
  /** Matching: whether an option may be used more than once (the instruction says so). */
  reuse?: boolean;
  /** Completion: the word limit of the instruction; `number` when "and/or a number" is allowed. */
  limit?: {words: number; number: boolean};
  questions: ReadingQuestion[];
};

export type ReadingSection = {title: string; text: string; groups: ReadingGroup[]};
export type ReadingTest = {id: string; exam: ReadingExam; sections: ReadingSection[]};

const normalize = (text: string) => text.normalize('NFC').replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
/** How quotes and answers are matched against a text: NFC, straight apostrophes, plain hyphens, lower case. */
export const matchFold = (text: string) => normalize(text).toLowerCase();
const fold = matchFold;
const optionsOf = (group: ReadingGroup): Option[] =>
  group.type === 'true_false_not_given' ? TRUE_FALSE_NOT_GIVEN : group.type === 'yes_no_not_given' ? YES_NO_NOT_GIVEN : group.options ?? [];

/** Words of an answer as IELTS counts them: a hyphenated word is one word; a number is not a word when numbers are allowed. */
export function answerWords(answer: string, numberAllowed: boolean): {words: number; numbers: number} {
  const tokens = normalize(answer).trim().split(/\s+/u).filter(Boolean);
  const numbers = tokens.filter(t => /^[\d.,%£$€]+$/u.test(t)).length;
  return numberAllowed ? {words: tokens.length - numbers, numbers} : {words: tokens.length, numbers: 0};
}

/** Problems of one section's form, found by code: the questions must be answerable from this text as written. */
export function checkReadingSection(section: ReadingSection, exam: ReadingExam): string[] {
  const problems: string[] = [];
  const text = fold(section.text);
  const allowed = READING_FORMAT[exam].types;
  for (const [g, group] of section.groups.entries()) {
    const at = `group ${g + 1} (${group.type})`;
    if (!allowed.includes(group.type)) problems.push(`${at}: not a ${exam} question type`);
    if (!group.instruction.trim()) problems.push(`${at}: no instruction`);
    const options = optionsOf(group);
    const ids = options.map(o => o.id);
    if (new Set(ids).size !== ids.length) problems.push(`${at}: repeated option ids`);
    if (new Set(options.map(o => fold(o.text))).size !== options.length) problems.push(`${at}: repeated option texts`);
    const choice = (CHOICE_TYPES as readonly string[]).includes(group.type) || group.type === 'multiple_choice_multi';
    const matching = (MATCHING_TYPES as readonly string[]).includes(group.type);
    const completion = (COMPLETION_TYPES as readonly string[]).includes(group.type);
    if ((choice || matching) && options.length < 2) problems.push(`${at}: needs options`);
    if (completion && !group.limit) problems.push(`${at}: no word limit`);
    if (matching && !group.reuse) {
      const used = group.questions.flatMap(q => q.answer);
      if (new Set(used).size !== used.length) problems.push(`${at}: an option is used twice but reuse is not allowed`);
      if (options.length < group.questions.length) problems.push(`${at}: fewer options than questions`);
    }
    if (group.type === 'matching_headings' && options.length <= group.questions.length) problems.push(`${at}: headings need more options than paragraphs`);
    let last = -1;
    for (const q of group.questions) {
      const where = `${at}, question ${q.numbers.join('-')}`;
      const multi = group.type === 'multiple_choice_multi';
      if (multi ? q.numbers.length < 2 || q.answer.length !== q.numbers.length : q.numbers.length !== 1) problems.push(`${where}: numbers and answers do not match`);
      if (!q.answer.length || q.answer.some(a => !a.trim())) problems.push(`${where}: no answer`);
      if ((choice || matching) && q.answer.some(a => !ids.includes(a))) problems.push(`${where}: answer is not an option`);
      if (multi && new Set(q.answer).size !== q.answer.length) problems.push(`${where}: repeated answer`);
      if (!q.explanation.en.trim()) problems.push(`${where}: no explanation`);
      const notGiven = q.answer.length === 1 && q.answer[0] === 'NG' && (group.type === 'true_false_not_given' || group.type === 'yes_no_not_given');
      if (!notGiven && !q.evidence) problems.push(`${where}: no evidence`);
      if (q.evidence && !text.includes(fold(q.evidence))) problems.push(`${where}: evidence is not in the text`);
      if (completion) {
        for (const answer of q.answer) {
          const {words, numbers} = answerWords(answer, group.limit?.number ?? false);
          if (words > (group.limit?.words ?? 0) || (numbers > 1)) problems.push(`${where}: "${answer}" is over the word limit`);
        }
        // Completion answers are copied from the text (P7.1 §4 step 3); the canonical one must be there word for word.
        if (q.answer[0] && !text.includes(fold(q.answer[0]))) problems.push(`${where}: answer "${q.answer[0]}" is not in the text`);
      }
      if (IN_ORDER.includes(group.type) && q.evidence) {
        const position = text.indexOf(fold(q.evidence));
        if (position >= 0 && position < last) problems.push(`${where}: out of the text's order`);
        if (position >= 0) last = position;
      }
    }
  }
  return problems;
}

/** Problems of a whole test: three sections, 40 consecutive questions, the length of the texts. */
export function checkReadingTest(test: ReadingTest): string[] {
  const format = READING_FORMAT[test.exam];
  const problems = test.sections.flatMap((s, i) => checkReadingSection(s, test.exam).map(p => `section ${i + 1}: ${p}`));
  if (test.sections.length !== format.sections) problems.push(`${test.sections.length} sections, not ${format.sections}`);
  const numbers = test.sections.flatMap(s => s.groups.flatMap(g => g.questions.flatMap(q => q.numbers)));
  const expected = Array.from({length: format.questions}, (_, i) => i + 1);
  if (numbers.join(',') !== expected.join(',')) problems.push(`questions must be numbered 1-${format.questions} in order`);
  const words = test.sections.reduce((n, s) => n + countWords(s.text), 0);
  if (words < format.words.min || words > format.words.max) problems.push(`${words} words in the texts, not ${format.words.min}-${format.words.max}`);
  return problems;
}

/**
 * Raw score → an uncalibrated estimate for presentEstimate (ADR-003). The official table gives only approximate
 * thresholds; halfway between two of them counts as the half band. Below the lowest threshold there is no number.
 */
export function readingEstimate(raw: number, exam: ReadingExam): {low: number; high: number} | null {
  return bandFromRaw(raw, READING_THRESHOLDS[exam]);
}

/** Raw score out of 40 → estimate by a table of official approximate thresholds (Reading and Listening, P7.6 §9). */
export function bandFromRaw(raw: number, steps: {band: number; raw: number}[]): {low: number; high: number} | null {
  if (!Number.isInteger(raw) || raw < 0 || raw > 40) throw new RangeError(`raw score ${raw}`);
  const reached = steps.filter(s => raw >= s.raw).pop();
  if (!reached) return null;
  const next = steps.find(s => s.raw > reached.raw);
  if (!next) return {low: reached.band, high: Math.min(9, reached.band + 1)};
  const band = raw >= (reached.raw + next.raw) / 2 ? reached.band + 0.5 : reached.band;
  return {low: band, high: band};
}
