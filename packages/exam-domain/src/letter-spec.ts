import {z} from 'zod';

/*
 * IELTS General Training Writing Task 1 as data (docs/phase-5/P5-plan.md §3): a situation, the person the letter goes to,
 * three points the letter must cover and the tone the situation calls for. The instruction the learner reads is composed from
 * it by code (letterInstruction), so the three points the assessor checks are exactly the ones the learner saw.
 */

export const LETTER_TONES = ['formal', 'semi_formal', 'informal'] as const;
export const LETTER_PURPOSES = ['complaint', 'request', 'application', 'apology', 'thanks', 'invitation', 'advice', 'suggestion',
  'news', 'explanation'] as const;

/** The opening the instruction gives: an unknown reader is addressed formally; a known one by name, chosen by the writer. */
export const FORMAL_OPENING = 'Dear Sir or Madam,';
export const NAMED_OPENING = 'Dear …,';

const point = z.string().trim().min(8).max(120);

export const letterSpec = z.object({
  format: z.literal('letter-spec/1'),
  tone: z.enum(LETTER_TONES),
  purpose: z.enum(LETTER_PURPOSES),
  /** The situation, one or two sentences in the second person ("You recently …"). */
  situation: z.string().trim().min(30).max(300),
  /** Who the letter goes to, as it follows "Write a letter to": "the manager of the hotel", "a friend". */
  recipient: z.string().trim().min(3).max(80),
  /** The three points the letter must cover, each a verb phrase in the imperative ("explain why …"). */
  points: z.tuple([point, point, point]),
  opening: z.enum([FORMAL_OPENING, NAMED_OPENING]),
});

export type LetterSpec = z.infer<typeof letterSpec>;
export type LetterTone = LetterSpec['tone'];

const LEAD = /^(describe|explain|say|ask|give|suggest|tell|thank|apologi[sz]e|invite|offer|remind|mention|request|propose|outline|recommend|inform)\b/i;

/** Problems that make the task unfit for the library. Empty when it is fine. */
export function checkLetterSpec(spec: LetterSpec): string[] {
  const problems: string[] = [];
  if ((spec.tone === 'formal') !== (spec.opening === FORMAL_OPENING)) {
    problems.push(`opening "${spec.opening}" does not fit a ${spec.tone} letter`);
  }
  if (!/\b(you|your)\b/i.test(spec.situation) || !/^[A-Z]/.test(spec.situation) || !/\.$/.test(spec.situation)) {
    problems.push('situation: addressed to the learner (you), full sentences');
  }
  if (/^(a|an|the|your)\s/i.test(spec.recipient) === false) problems.push('recipient: starts with a, an, the or your');
  if (/[.!?]$/.test(spec.recipient)) problems.push('recipient: a noun phrase without final punctuation');
  spec.points.forEach((p, i) => {
    if (!LEAD.test(p)) problems.push(`point ${i + 1}: starts with an instruction verb (describe, explain, say …)`);
    if (/[.;]$/.test(p)) problems.push(`point ${i + 1}: no final punctuation`);
  });
  const lower = spec.points.map(p => p.toLowerCase());
  if (new Set(lower).size !== 3) problems.push('points repeat');

  return problems;
}

/** The instruction the learner reads (plain text, one point per line). */
export function letterInstruction(spec: LetterSpec): string {
  return [
    spec.situation,
    '',
    `Write a letter to ${spec.recipient}. In your letter:`,
    ...spec.points.map(p => `• ${p}`),
    '',
    'Write at least 150 words. You do not need to include any addresses.',
    `Begin your letter with: ${spec.opening}`,
  ].join('\n');
}
