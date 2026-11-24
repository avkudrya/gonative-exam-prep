import {countWords, normalizeResponse} from '@gonative/exam-domain';

/** IELTS Writing Task 2: 40 minutes, at least 250 words (verified catalog). */
export const TASK2_MINUTES = 40;
export const TASK2_MIN_WORDS = 250;
/** Backend limits: essay text (code points) and own task text (characters, words). */
export const MAX_ESSAY_CHARS = 20000;
export const CUSTOM_PROMPT = {min: 20, max: 600, minWords: 4};

/** Same rule as the backend (`whitespace-v1` on the normalized text). */
export function wordsIn(text: string) {
  return countWords(normalizeResponse(text));
}

/** A quick client check mirroring `ExamAttempts::customPrompt`; the backend has the final word. */
export function customPromptProblem(raw: string): 'short' | 'long' | 'words' | 'english' | null {
  const text = normalizeResponse(raw);
  const length = Array.from(text).length;
  if (length < CUSTOM_PROMPT.min) return 'short';
  if (length > CUSTOM_PROMPT.max) return 'long';
  if (countWords(text) < CUSTOM_PROMPT.minWords) return 'words';
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  if (!letters || latin / letters < 0.9) return 'english';
  return null;
}

export const taskTypes = ['opinion', 'discussion', 'advantages', 'problem_solution', 'two_part'] as const;
