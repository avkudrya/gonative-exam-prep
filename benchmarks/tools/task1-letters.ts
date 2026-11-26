/**
 * P5.7 (docs/phase-5/P5-plan.md §3): checks the own General Training Task 1 letter tasks
 * (benchmarks/sources/task1-general-letters.json) and balance (8 per tone, distinct situations).
 * --review-input <dir> writes the second-vendor review input there (a reviewed input is never rewritten).
 *
 * usage: node --import tsx benchmarks/tools/task1-letters.ts [--review-input <dir>]
 */
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {checkLetterSpec, letterInstruction, letterSpec, LETTER_TONES, type LetterSpec} from '../../packages/exam-domain/src/index.js';

type Item = {id: string; topic: string; spec: LetterSpec};
const source = JSON.parse(readFileSync('benchmarks/sources/task1-general-letters.json', 'utf8')) as {items: Item[]};
const problems: string[] = [];
for (const item of source.items) {
  const parsed = letterSpec.safeParse(item.spec);
  if (!parsed.success) problems.push(`${item.id}: ${parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  else problems.push(...checkLetterSpec(parsed.data).map(p => `${item.id}: ${p}`));
}
const ids = source.items.map(i => i.id);
if (new Set(ids).size !== ids.length) problems.push('duplicate ids');
for (const tone of LETTER_TONES) {
  const n = source.items.filter(i => i.spec.tone === tone).length;
  if (n !== 8) problems.push(`${tone}: ${n} tasks, expected 8`);
}
if (problems.length) throw new Error(problems.join('\n'));

const purposes = Object.entries(source.items.reduce<Record<string, number>>((m, i) => ({...m, [i.spec.purpose]: (m[i.spec.purpose] ?? 0) + 1}), {}));
const topics = Object.entries(source.items.reduce<Record<string, number>>((m, i) => ({...m, [i.topic]: (m[i.topic] ?? 0) + 1}), {}));
console.log(`${source.items.length} tasks ok; purposes ${purposes.map(([k, v]) => `${k} ${v}`).join(', ')}; topics ${topics.map(([k, v]) => `${k} ${v}`).join(', ')}`);

const at = process.argv.indexOf('--review-input');
if (at > 0) {
  const file = `${process.argv[at + 1]}/input.json`;
  if (existsSync(file)) throw new Error(`${file} exists; a reviewed input is never rewritten`);
  const input = {items: source.items.map(i => ({id: i.id, tone: i.spec.tone, purpose: i.spec.purpose, topic: i.topic,
    instruction: letterInstruction(i.spec)}))};
  writeFileSync(file, JSON.stringify(input, null, 1) + '\n');
  console.log(`wrote ${file}`);
}

// --library: the product library from the source and the second-vendor review (every task approved or revised as reviewed).
if (process.argv.includes('--library')) {
  const {createHash} = await import('node:crypto');
  const reviewDir = 'benchmarks/task-review/task1-general.v1';
  const response = JSON.parse(readFileSync(`${reviewDir}/response.json`, 'utf8')) as {items: {id: string; verdict: string; [k: string]: unknown}[]};
  const receipt = JSON.parse(readFileSync(`${reviewDir}/receipt.json`, 'utf8'));
  const reviews = new Map(response.items.map(r => [r.id, r]));
  const sourceFile = 'benchmarks/sources/task1-general-letters.json';
  const library = {
    libraryKey: 'ielts-writing-task-1-general', version: 'v1', status: 'approved',
    about: 'Original IELTS-style General Training Writing Task 1 practice tasks (letters) written by GoNative (not official IELTS material). Reviewed by a second vendor before use.',
    sectionKey: 'writing', taskKey: 'task-1', rubricKey: 'ielts-writing-task-1', examKeys: ['ielts-general-training'], origin: 'curated',
    source: {file: sourceFile, sha256: createHash('sha256').update(readFileSync(sourceFile)).digest('hex')},
    review: {model: receipt.model, promptVersion: 'task-review-1', date: receipt.date.slice(0, 10), aiUsageEventId: receipt.aiUsageEventId,
      costUsd: receipt.costUsd, revisionsApplied: [] as string[]},
    tasks: source.items.map(i => {
      const r = reviews.get(i.id);
      if (!r || r.verdict === 'reject') throw new Error(`${i.id}: not approved by the review`);
      if (r.verdict === 'revise') throw new Error(`${i.id}: revise — apply the revision to the source and list it in revisionsApplied`);
      const {id: _id, revisedSituation: _s, revisedPoints: _p, ...review} = r;
      return {ref: `gonative-t1g:${i.id}`, type: i.spec.tone, purpose: i.spec.purpose, topic: i.topic, difficulty: r.difficulty,
        text: letterInstruction(i.spec), stimulus: i.spec, review};
    }),
  };
  writeFileSync('packages/exam-domain/library/ielts-writing-task-1-general.v1.json', JSON.stringify(library, null, 1) + '\n');
  console.log(`library: ${library.tasks.length} tasks`);
}
