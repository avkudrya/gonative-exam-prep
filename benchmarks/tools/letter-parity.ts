/**
 * P5.10: the parity fixture of the letter check (letterFacts) for its PHP port in MultiAdmin (LetterFacts). Cases: every
 * base letter and every exam-gt1-v1 item with its tone, plus every opening × closing × tone of a short synthetic letter.
 *
 * usage: node --import tsx benchmarks/tools/letter-parity.ts <MultiAdmin>/tests/fixtures/exam/letter-facts-parity.json
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {letterFacts, LETTER_TONES, normalizeResponse} from '../../packages/exam-domain/src/index.js';

const out = process.argv[2];
if (!out) throw new Error('usage: letter-parity.ts <fixture path>');
const items = readFileSync('benchmarks/datasets/exam-gt1-v1/items.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const cases: {text: string; tone: (typeof LETTER_TONES)[number]}[] = items.map(i => ({text: i.text, tone: i.stimulus.tone}));
const openings = ['Dear Sir or Madam,', 'Dear Sir/Madam,', 'To whom it may concern,', 'Dear Mr. Patel,', 'Dear Ms Lee,', 'Dear Dr. Ortiz,',
  'Dear Sam,', 'Dear Ólafur,', 'Dear Sirius,', 'Hi Sam,', 'Hello there,', 'Hey!', 'Good morning,', 'Dear manager,', 'Dear Hiring Manager,', 'Sam,', ''];
const closings = ['Yours faithfully,', 'Faithfully yours,', 'Yours sincerely,', 'Sincerely,', 'Yours truly,', 'Kind regards,', 'Best regards,', 'Regards,',
  'Best wishes,', 'All the best,', 'Best,', 'Warmly,', 'Love,', 'Lots of love,', 'Cheers,', 'Take care,', 'See you soon,', 'Yours,', 'xx',
  'Best of all, the weather was great.', 'Thank you for your help.', ''];
const body = 'I am writing about the problem I mentioned.\n\nIt has not been solved, and I would like it fixed soon.';
for (const o of openings) for (const c of closings) for (const tone of LETTER_TONES) {
  cases.push({text: normalizeResponse([o, body, c, 'Anna'].filter(Boolean).join('\n\n')), tone});
}
const fixture = {about: 'letterFacts (TypeScript) on every exam-gt1-v1 item and synthetic openings and closings; the PHP port must agree', cases: cases.map(c => ({...c, facts: letterFacts(c.text, c.tone)}))};
writeFileSync(out, JSON.stringify(fixture) + '\n');
console.log(`${fixture.cases.length} cases`);
