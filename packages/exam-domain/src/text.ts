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

export type HighlightSegment = {text: string; start: number; end: number; ids: string[]};

/**
 * Splits a text into consecutive segments at every span boundary, so overlapping findings can be
 * highlighted together. Offsets are code points of `text` (the normalized response). A span that
 * is empty, out of range or whose `quote` does not equal its slice is left out and reported in
 * `skipped`: the UI then shows that finding without a highlight rather than marking the wrong words.
 */
export function highlightSegments(
  text: string,
  spans: {id: string; start: number; end: number; quote?: string}[],
): {segments: HighlightSegment[]; skipped: string[]} {
  const chars = Array.from(text);
  const valid: {id: string; start: number; end: number}[] = [];
  const skipped: string[] = [];
  for (const span of spans) {
    const ok = Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= chars.length
      && (span.quote === undefined || chars.slice(span.start, span.end).join('') === span.quote);
    if (ok) valid.push(span);
    else skipped.push(span.id);
  }
  const cuts = [...new Set([0, chars.length, ...valid.flatMap(s => [s.start, s.end])])].sort((a, b) => a - b);
  const segments: HighlightSegment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [start, end] = [cuts[i], cuts[i + 1]];
    if (start === end) continue;
    segments.push({text: chars.slice(start, end).join(''), start, end, ids: valid.filter(s => s.start <= start && s.end >= end).map(s => s.id)});
  }
  return {segments, skipped};
}
