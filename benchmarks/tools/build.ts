/*
 * Builds the synthetic benchmark datasets (sets S and G) in the format of
 * docs/phase-1/P1.3-exam-bench.md §3 and refreshes the SHA-256 pins of their manifests.
 *
 *   npm run bench:build            write items.jsonl and update manifest hashes
 *   npm run bench:build -- --check fail if anything on disk differs from a fresh build
 *
 * Inputs (all synthetic, committed): benchmarks/sources/task2-prompts.json,
 * g-handwritten.json and s-bases.jsonl (clean bases written and cross-checked by
 * benchmarks/s-bases/run.php). No API calls here.
 */

import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {codePointLength, normalizeResponse, sliceCodePoints} from '../../packages/exam-domain/src/index.js';
import {
  copiedPrompt, DERIVED_CASES, instructionInEssay, listForm, offTopic, singleParagraph, underLength,
  type Derived, type Expected,
} from './g-cases.js';
import {insertErrors} from './insertions.js';

export interface Prompt { id: string; split: 'dev' | 'test'; type: string; topic: string; text: string }
export interface Base {
  id: string; promptId: string; text: string;
  author: {provider: string; model: string};
  check?: {provider: string; model: string; clean: boolean; issues: unknown[]};
  adjudication?: {status: 'accepted' | 'fixed' | 'rejected'; note: string};
}
export interface Item {
  id: string; set: 'S' | 'G' | 'R' | 'H1' | 'H2'; split: 'dev' | 'test'; examKey: string; prompt: string; text: string;
  expected: Expected; source: Record<string, string>;
}

const EXAM_KEY = 'ielts-academic';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sources = join(root, 'benchmarks/sources');

/** Bases usable for S: cross-checked clean, or adjudicated by the owner's reviewer. */
export function usable(base: Base): boolean {
  if (base.adjudication) return base.adjudication.status !== 'rejected';

  return base.check?.clean === true;
}

function derive(caseKey: typeof DERIVED_CASES[number], base: Base, prompts: Map<string, Prompt>, sItem: Item): Derived {
  const prompt = prompts.get(base.promptId)!;
  switch (caseKey) {
    case 'single_paragraph': return singleParagraph(base.text);
    case 'list_form': return listForm(base.text);
    case 'copied_prompt': return copiedPrompt(base.text, prompt.text);
    case 'under_length': return underLength(base.text);
    case 'instruction_in_essay': return instructionInEssay({text: sItem.text, errors: sItem.expected.errors as never});
    case 'off_topic': {
      // Same split, different topic: the first such prompt seven places further on.
      const pool = [...prompts.values()].filter(p => p.split === prompt.split);
      const at = pool.findIndex(p => p.id === prompt.id);
      for (let k = 7; k < 7 + pool.length; k++) {
        const other = pool[(at + k) % pool.length];
        if (other.topic !== prompt.topic) return offTopic(base.text, other.id);
      }
      throw new Error(`no off-topic prompt for ${base.id}`);
    }
  }
}

export function buildItems(prompts: Prompt[], bases: Base[], handwritten: Array<Omit<Item, 'set' | 'examKey' | 'prompt' | 'source'> & {promptId: string; case: string}>): Item[] {
  const byId = new Map(prompts.map(p => [p.id, p]));
  const items: Item[] = [];
  const prompt = (id: string) => {
    const p = byId.get(id);
    if (!p) throw new Error(`unknown prompt ${id}`);

    return p;
  };

  const sByBase = new Map<string, Item>();
  for (const base of bases.filter(usable).sort((a, b) => a.id.localeCompare(b.id))) {
    const p = prompt(base.promptId);
    const inserted = insertErrors(normalizeResponse(base.text), `s-${base.id}`);
    const item: Item = {id: `s-${base.id}`, set: 'S', split: p.split, examKey: EXAM_KEY, prompt: p.text, text: inserted.text,
      expected: {errors: inserted.errors}, source: {base: base.id, author: base.author.model}};
    items.push(item);
    sByBase.set(base.id, item);
  }

  for (const split of ['dev', 'test'] as const) {
    const pool = bases.filter(usable).filter(b => prompt(b.promptId).split === split).sort((a, b) => a.id.localeCompare(b.id));
    if (pool.length < DERIVED_CASES.length) continue;
    DERIVED_CASES.forEach((caseKey, i) => {
      // Spread transforms over the split instead of always using its first bases.
      const base = pool[Math.floor((i * pool.length) / DERIVED_CASES.length)];
      const d = derive(caseKey, {...base, text: normalizeResponse(base.text)}, byId, sByBase.get(base.id)!);
      items.push({id: `g-${caseKey.replace(/_/g, '-')}-${split}`, set: 'G', split, examKey: EXAM_KEY,
        prompt: prompt(d.promptId ?? base.promptId).text, text: normalizeResponse(d.text), expected: d.expected,
        source: {base: base.id, case: d.case}});
    });
  }

  for (const h of handwritten) {
    items.push({id: h.id, set: 'G', split: h.split, examKey: EXAM_KEY, prompt: prompt(h.promptId).text, text: normalizeResponse(h.text),
      expected: h.expected, source: {case: h.case, author: 'handwritten'}});
  }

  for (const item of items) validate(item);
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`duplicate item ${item.id}`);
    ids.add(item.id);
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}

/** Same checks as MultiAdmin EssayDataset, plus: every inserted error is where its span says. */
export function validate(item: Item): void {
  if (normalizeResponse(item.text) !== item.text) throw new Error(`${item.id}: text is not normalized`);
  const length = codePointLength(item.text);
  for (const e of item.expected.errors ?? []) {
    if (e.start < 0 || e.end > length || e.start >= e.end) throw new Error(`${item.id}: span ${e.start}-${e.end} out of the text`);
    if (e.inserted !== undefined && sliceCodePoints(item.text, e.start, e.end) !== e.inserted) {
      throw new Error(`${item.id}: span ${e.start}-${e.end} does not hold "${e.inserted}"`);
    }
  }
}

export function toJsonl(items: Item[]): string {
  return items.map(i => JSON.stringify(i)).join('\n') + '\n';
}

export const sha256 = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');

/**
 * The dev split of S and G plus the first 30 H1 dev essays in selection order (stratified, so the
 * first 30 still span the scale). Needs the local H1 build.
 */
const dev = (items: Item[], h1: Item[]): Item[] => h1.length === 0 ? [] : [
  ...items.filter(i => i.split === 'dev' && (i.set === 'S' || i.set === 'G')),
  ...h1.filter(i => i.split === 'dev').slice(0, 30),
];

/**
 * Datasets built from the items: id → which items. A dataset that has been run is frozen and
 * leaves this list, keeping the items it was run on: exam-a0 (token measurement) and exam-a-dev-1
 * (stage A, P1.7), both run 2026-11-23.
 */
export const DATASETS: Record<string, (items: Item[], h1: Item[]) => Item[]> = {
  // Written only once the bases exist: G without S would freeze a partial dataset.
  'exam-sg-v1': items => items.some(i => i.set === 'S') ? items : [],
  // Stage B (E §4): the same dev items as stage A, guide v2 (limiters applied by code).
  'exam-b-dev-1': dev,
};

/** H1 items from the local ELLIPSE build, in the stratified selection order of source.json. */
function readH1(): Item[] {
  const dir = join(root, 'benchmarks/datasets/exam-h1-v1');
  const items = readJsonl<Item>(join(dir, 'raw/items.jsonl'));
  if (items.length === 0) return [];
  const source = JSON.parse(readFileSync(join(dir, 'source.json'), 'utf8'));
  if (sha256(toJsonl(items)) !== source.itemsSha256) throw new Error('exam-h1-v1/raw/items.jsonl differs from source.json: rerun npm run bench:h1');
  const order = new Map<string, number>([...source.selection.ids.dev, ...source.selection.ids.test].map((id: string, i: number) => [`h1-${id}`, i]));

  return [...items].sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];

  return readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as T);
}

function main(check: boolean): void {
  const prompts: Prompt[] = JSON.parse(readFileSync(join(sources, 'task2-prompts.json'), 'utf8')).prompts;
  const bases = readJsonl<Base>(join(sources, 's-bases.jsonl'));
  const handwritten = JSON.parse(readFileSync(join(sources, 'g-handwritten.json'), 'utf8')).items;
  const items = buildItems(prompts, bases, handwritten);
  const h1 = readH1();
  const drift: string[] = [];

  for (const [id, select] of Object.entries(DATASETS)) {
    const chosen = select(items, h1);
    if (chosen.length === 0) {
      console.log(`${id}: skipped (usable bases: ${bases.filter(usable).length}, local H1 items: ${h1.length})`);
      continue;
    }
    const dir = join(root, 'benchmarks/datasets', id);
    const jsonl = toJsonl(chosen);
    // Third-party texts (H1) stay in the gitignored raw/ folder; our synthetic sets are committed.
    const itemsPath = join(dir, chosen.some(i => i.set === 'H1') ? 'raw/items.jsonl' : 'items.jsonl');
    if ((existsSync(itemsPath) ? readFileSync(itemsPath, 'utf8') : null) !== jsonl) {
      drift.push(itemsPath);
      if (!check) {
        mkdirSync(dirname(itemsPath), {recursive: true});
        writeFileSync(itemsPath, jsonl);
      }
    }
    const manifestPath = join(dir, 'manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const pins = {guideSha256: sha256(readFileSync(resolve(dir, manifest.guide))), itemsSha256: sha256(jsonl)};
      if (manifest.guideSha256 !== pins.guideSha256 || manifest.itemsSha256 !== pins.itemsSha256) {
        drift.push(manifestPath);
        if (!check) writeFileSync(manifestPath, JSON.stringify({...manifest, ...pins}, null, 2) + '\n');
      }
    }
    const count = (set: string, split: string) => chosen.filter(i => i.set === set && i.split === split).length;
    const errors = chosen.reduce((n, i) => n + (i.expected.errors?.length ?? 0), 0);
    console.log(`${id}: ${chosen.length} items (S dev/test ${count('S', 'dev')}/${count('S', 'test')}, G ${count('G', 'dev')}/${count('G', 'test')}, H1 ${count('H1', 'dev')}/${count('H1', 'test')}), ${errors} inserted errors`);
  }

  if (check && drift.length) {
    console.error(`out of date: ${drift.join(', ')}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.includes('--check'));
}
