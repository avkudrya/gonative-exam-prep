/*
 * Builds the fully labelled sets:
 *  - D (dense-error essays, owner test 03, 2026-11-24) from benchmarks/sources/d-dense.txt: every mistake is labelled
 *    inline as {wrong=>right|skill|severity}, so recall, precision and own-card recall are measured on every sentence;
 *  - N (essays without mistakes, owner tests 04 and 05, 2026-11-25): the 20 clean dev bases of set S before any
 *    insertion, plus benchmarks/sources/n-owner.txt. Every error finding on them is a false one, except the few real
 *    slips left in a base, which are labelled (RESIDUAL).
 *
 *   npm run bench:dense             write benchmarks/datasets/exam-{d,n}-v1/items.jsonl
 *   npm run bench:dense -- --check  fail if a file on disk differs from a fresh build
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {codePointLength, normalizeResponse} from '../../packages/exam-domain/src/index.js';
import {sha256, toJsonl, usable, validate, type Base, type Item, type Prompt} from './build.js';

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

/** Real slips in clean S bases, found by assessments (P3.9 §5.4): labelled so N counts only invented errors. */
export const RESIDUAL: Record<string, Array<{wrong: string; right: string; skill: string}>> = {
  b15: [{wrong: 'thier', right: 'their', skill: 'mechanics.spelling'}],
};

export function buildClean(bases: Base[], owner: string, prompts: Prompt[]): Item[] {
  const byId = new Map(prompts.map(p => [p.id, p]));
  const items: Item[] = bases.filter(b => usable(b) && byId.get(b.promptId)?.split === 'dev').map(b => {
    const text = normalizeResponse(b.text);
    const errors = (RESIDUAL[b.id] ?? []).map(r => {
      const at = text.indexOf(r.wrong);
      if (at < 0) throw new Error(`n-${b.id}: residual "${r.wrong}" not in the base`);
      const start = codePointLength(text.slice(0, at));
      return {start, end: start + codePointLength(r.wrong), skill: r.skill, severity: 'minor', rule: 'residual', original: r.right, inserted: r.wrong};
    });
    const item = {id: `n-${b.id}`, set: 'N', split: 'dev', examKey: 'ielts-academic', prompt: byId.get(b.promptId)!.text, text,
      expected: {errors}, source: {base: b.id, author: b.author.model}} as unknown as Item;
    validate(item);
    return item;
  });

  return [...items, ...buildDense(owner, prompts, 'N')];
}

export function buildDense(source: string, prompts: Prompt[], set: 'D' | 'N' = 'D'): Item[] {
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
      id: set === 'D' ? `d-${id.slice(1)}` : `n-${id}`, set, split: 'dev', examKey: 'ielts-academic', prompt: prompt.text, text,
      expected: {errors} as Item['expected'],
      source: origin ? {origin, permission: set === 'D' ? 'owner 2026-11-24' : 'owner 2026-11-25'} : {author: 'claude-opus-5-5', promptId},
    };
    validate(item);
    items.push(item);
  }

  return items;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function main(check: boolean): void {
  const read = (path: string) => readFileSync(join(root, path), 'utf8');
  const prompts: Prompt[] = JSON.parse(read('benchmarks/sources/task2-prompts.json')).prompts;
  const bases: Base[] = read('benchmarks/sources/s-bases.jsonl').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  let stale = false;
  for (const [id, items] of [
    ['exam-d-v1', buildDense(read('benchmarks/sources/d-dense.txt'), prompts)],
    ['exam-n-v1', buildClean(bases, read('benchmarks/sources/n-owner.txt'), prompts)],
  ] as const) {
    const path = join(root, `benchmarks/datasets/${id}/items.jsonl`);
    const jsonl = toJsonl(items);
    const errors = items.reduce((n, i) => n + (i.expected.errors?.length ?? 0), 0);
    console.log(`${id}: ${items.length} items, ${errors} labelled errors, sha256 ${sha256(jsonl)}`);
    if ((existsSync(path) ? readFileSync(path, 'utf8') : null) === jsonl) continue;
    stale = true;
    if (!check) {
      mkdirSync(dirname(path), {recursive: true});
      writeFileSync(path, jsonl);
    }
  }
  if (check && stale) {
    console.error('out of date: run npm run bench:dense');
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.includes('--check'));
}
