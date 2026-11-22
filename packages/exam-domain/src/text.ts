/*
 * Response text helpers shared by the web editor and the benchmark tooling.
 *
 * Offsets are Unicode code points of the NORMALIZED text, never UTF-16 units: PHP
 * (mb_substr) and JavaScript must agree on every finding span, and code points are the
 * unit both can compute. The backend stores the normalized text it assessed.
 */

/** NFC, LF line endings, no trailing spaces on lines, no surrounding blank space. */
export function normalizeResponse(text: string): string {
  return text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

export function codePointLength(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function sliceCodePoints(text: string, start: number, end: number): string {
  return Array.from(text).slice(start, end).join('');
}

/**
 * Provisional rule `whitespace-v1`: a word is a whitespace-separated token containing a
 * letter or digit; hyphenated compounds and contractions count once. The official exam
 * counting conventions are checked in Phase 0 (P0.3) and may replace it with a new rule
 * id; stored attempts keep the rule they were counted with.
 */
export const WORD_COUNT_RULE = 'whitespace-v1';

export function countWords(text: string): number {
  return text.split(/\s+/u).filter(token => /[\p{L}\p{N}]/u.test(token)).length;
}
