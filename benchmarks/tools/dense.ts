/*
 * Builds set D (dense-error essays, owner test 03, 2026-11-24) from benchmarks/sources/d-dense.txt:
 * every mistake is labelled inline as {wrong=>right|skill|severity}, so the item's expected errors cover
 * the whole text and recall, precision and own-card recall are measured on every sentence.
 *
 *   npm run bench:dense             write benchmarks/datasets/exam-d-v1/items.jsonl
 *   npm run bench:dense -- --check  fail if the file on disk differs from a fresh build
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {codePointLength, normalizeResponse} from '../../packages/exam-domain/src/index.js';
import {sha256, toJsonl, validate, type Item, type Prompt} from './build.js';

export const SKILLS: Record<string, string> = {
  sva: 'grammar.subject_verb_agreement', vf: 'grammar.verb_tenses', tense: 'grammar.verb_tenses', art: 'grammar.articles',
  prep: 'grammar.prepositions', ss: 'grammar.sentence_structure', sp: 'mechanics.spelling', punc: 'mechanics.punctuation',
  wf: 'vocabulary.word_formation', wc: 'vocabulary.word_choice', col: 'vocabulary.collocations',
};
export const SEVERITIES: Record<string, string> = {n: 'minor', m: 'moderate', M: 'major'};

const MARK = /\{([^{}=]+)=>([^{}|]*)\|([a-z]+)\|([nmM])\}/gu;

/** One marked-up essay → its text and labels (code-point spans of the wrong words). */
export function parseMarked(id: string, marked: string): {text: string; errors: NonNullable<Item['expected']['errors']>} {
  let text = '';
  let last = 0;
  const errors: NonNullable<Item['expected']['errors']> = [];
  for (const m of marked.matchAll(MARK)) {
    const [whole, wrong, right, skill, severity] = m;
    if (!SKILLS[skill]) throw new Error(`${id}: unknown skill code ${skill}`);
    text += marked.slice(last, m.index);
    const start = codePointLength(text);
    text += wrong;
    errors.push({start, end: start + codePointLength(wrong), skill: SKILLS[skill], severity: SEVERITIES[severity] as never,
      rule: `dense.${skill}`, original: right, inserted: wrong} as never);
    last = m.index! + whole.length;
  }
  text += marked.slice(last);
  if (/[{}]/u.test(text)) throw new Error(`${id}: unparsed markup left in the text`);

  return {text, errors};
}

export function buildDense(source: string, prompts: Prompt[]): Item[] {
  const byId = new Map(prompts.map(p => [p.id, p]));
  const body = source.split('\n').filter(l => !l.startsWith('#')).join('\n');
  const items: Item[] = [];
  for (const block of body.split(/^=== /mu).slice(1)) {
    const [head, ...lines] = block.split('\n');
    const [id, promptId, origin, pin] = head.trim().split(/\s+/u);
    const prompt = byId.get(promptId);
    if (!prompt) throw new Error(`${id}: unknown prompt ${promptId}`);
    const {text, errors} = parseMarked(id, lines.join('\n').trim());
    if (normalizeResponse(text) !== text) throw new Error(`${id}: text is not normalized`);
    if (pin && `sha256=${sha256(text)}` !== pin) throw new Error(`${id}: text differs from the pinned ${pin}`);
    const item: Item = {
      id: `d-${id.slice(1)}`, set: 'D', split: 'dev', examKey: 'ielts-academic', prompt: prompt.text, text,
      expected: {errors} as Item['expected'],
      source: origin ? {origin, permission: 'owner 2026-11-24'} : {author: 'claude-opus-5-5', promptId},
    };
    validate(item);
    items.push(item);
  }

  return items;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function main(check: boolean): void {
  const prompts: Prompt[] = JSON.parse(readFileSync(join(root, 'benchmarks/sources/task2-prompts.json'), 'utf8')).prompts;
  const items = buildDense(readFileSync(join(root, 'benchmarks/sources/d-dense.txt'), 'utf8'), prompts);
  const path = join(root, 'benchmarks/datasets/exam-d-v1/items.jsonl');
  const jsonl = toJsonl(items);
  const errors = items.reduce((n, i) => n + (i.expected.errors?.length ?? 0), 0);
  console.log(`exam-d-v1: ${items.length} items, ${errors} labelled errors, sha256 ${sha256(jsonl)}`);
  if ((existsSync(path) ? readFileSync(path, 'utf8') : null) === jsonl) return;
  if (check) {
    console.error(`out of date: ${path}`);
    process.exit(1);
  }
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, jsonl);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.includes('--check'));
}
