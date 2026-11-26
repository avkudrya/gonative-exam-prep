import type {LetterTone} from './letter-spec.js';

/*
 * Code facts about a General Training Task 1 letter (docs/phase-5/P5-plan.md §3): the opening and closing lines and whether they
 * suit the tone the task calls for and each other. Facts for the assessor, not a band: a conventional formula is neither a
 * strength nor evidence of range, and British and American conventions are both accepted ("Sincerely" closes a formal letter
 * in American usage). Only clear mismatches are flagged: "Love" to a company, "Yours faithfully" to a friend, "Dear Sir or
 * Madam" to someone the writer knows. Ported to PHP (MultiAdmin LetterChecks) with the same rules.
 */

export type OpeningKind = 'unknown_reader' | 'title_name' | 'first_name' | 'casual' | 'other';
export type ClosingKind = 'faithfully' | 'sincerely' | 'regards' | 'best_wishes' | 'informal' | 'other';

export type LetterFacts = {
  opening: {line: string; kind: OpeningKind} | null;
  closing: {line: string; kind: ClosingKind} | null;
  /** Problems a reader would notice; empty when the opening and closing suit the tone and each other. */
  mismatches: LetterMismatch[];
};
export type LetterMismatch = 'no_opening' | 'no_closing' | 'opening_tone' | 'closing_tone' | 'opening_closing_pair';

const OPENING = /^(dear|hi|hello|hey|to whom it may concern|good (morning|afternoon|evening))\b/i;
const UNKNOWN_READER = /^(dear\s+(sir\s*(or|\/)\s*madam|madam\s*(or|\/)\s*sir|sir|madam|sirs|(the\s+)?(hiring|customer services?|lost property)\b.*|manager|editor|team)|to whom it may concern)\b/i;
const TITLE_NAME = /^dear\s+(mr|mrs|ms|miss|dr|prof(essor)?|mx)\.?\s+\p{L}/iu;
const CASUAL = /^(hi|hello|hey)\b/i;

const CLOSINGS: [ClosingKind, RegExp][] = [
  ['faithfully', /^(yours\s+faithfully|faithfully(\s+yours)?)\b/i],
  ['sincerely', /^(yours\s+sincerely|sincerely(\s+yours)?|yours\s+truly|respectfully(\s+yours)?|yours\s+respectfully)\b/i],
  ['regards', /^((with\s+)?(kind|best|warm|warmest)\s+regards|regards)\b/i],
  ['best_wishes', /^((with\s+)?(best|warm|warmest|kind)\s+wishes|all\s+the\s+best|best(?=\s*,?\s*$)|warmly(?=\s*,?\s*$))/i],
  ['informal', /^(love|lots\s+of\s+love|much\s+love|all\s+my\s+love|with\s+love|cheers|take\s+care|see\s+you(\s+soon)?|speak\s+soon|talk\s+soon|hugs|bye|xx+|your\s+friend|yours(?=\s*,?\s*$)|missing\s+you|until\s+next\s+time|write\s+soon)\b/i],
];

const lines = (text: string) => text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

/** The opening is the first line if it greets the reader; the closing is the last formula line within the last three lines. */
export function letterFacts(response: string, tone: LetterTone): LetterFacts {
  const all = lines(response);
  const first = all[0] ?? '';
  const opening = OPENING.test(first) ? {line: first, kind: openingKind(first)} : null;
  let closing: LetterFacts['closing'] = null;
  for (const line of all.slice(Math.max(1, all.length - 3)).reverse()) {
    const kind = CLOSINGS.find(([, re]) => re.test(line))?.[0];
    if (kind && line.length <= 40) { closing = {line, kind}; break; }
  }

  const mismatches: LetterMismatch[] = [];
  if (!opening) mismatches.push('no_opening');
  if (!closing) mismatches.push('no_closing');
  if (opening && !openingFits(opening.kind, tone)) mismatches.push('opening_tone');
  if (closing && !closingFits(closing.kind, tone)) mismatches.push('closing_tone');
  // British convention: "Yours faithfully" closes a letter to an unnamed reader, so it does not follow a greeting by name.
  if (opening && closing && closing.kind === 'faithfully' && opening.kind !== 'unknown_reader') mismatches.push('opening_closing_pair');

  return {opening, closing, mismatches};
}

function openingKind(line: string): OpeningKind {
  if (UNKNOWN_READER.test(line)) return 'unknown_reader';
  if (TITLE_NAME.test(line)) return 'title_name';
  if (CASUAL.test(line)) return 'casual';
  if (/^[Dd]ear\s+\p{Lu}\p{L}*/u.test(line)) return 'first_name';
  return 'other';
}

function openingFits(kind: OpeningKind, tone: LetterTone): boolean {
  if (tone === 'formal') return kind === 'unknown_reader' || kind === 'title_name';
  if (tone === 'semi_formal') return kind === 'title_name' || kind === 'first_name';
  return kind === 'first_name' || kind === 'casual';
}

function closingFits(kind: ClosingKind, tone: LetterTone): boolean {
  if (tone === 'formal') return kind === 'faithfully' || kind === 'sincerely' || kind === 'regards';
  if (tone === 'semi_formal') return kind !== 'faithfully' && kind !== 'informal';
  return kind !== 'faithfully' && kind !== 'sincerely';
}
