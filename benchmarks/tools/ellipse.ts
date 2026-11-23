/*
 * Benchmark set H1 from the ELLIPSE corpus (Crossley et al., 2023; CC BY 4.0,
 * https://github.com/scrosseye/ELLIPSE-Corpus): rank agreement of our CC / LR / GRA with
 * human analytic scores (docs/phase-0/E-benchmark-plan.md §2).
 *
 *   npm run bench:h1 -- <source dir>   source dir holds train.csv and test/ELLIPSE_Final_github_test.csv
 *
 * Third-party texts stay in benchmarks/datasets/exam-h1-v1/raw/ (gitignored). Committed:
 * source.json with the licence, source hashes, the selected text ids and the items hash, so
 * anyone with the corpus rebuilds the same items.
 *
 * ELLIPSE gives a topic label, not the task wording; the item prompt is a neutral question
 * on that topic. H1 compares CC, LR and GRA only (traitMap), so Task Response is not scored.
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {countWords, normalizeResponse} from '../../packages/exam-domain/src/index.js';
import {sha256, toJsonl, type Item} from './build.js';
import {seededRandom} from './insertions.js';

export const TRAITS = ['Overall', 'Cohesion', 'Syntax', 'Vocabulary', 'Phraseology', 'Grammar', 'Conventions'] as const;

/** RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(content: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (quoted) {
      if (c === '"' && content[i + 1] === '"') { field += '"'; i++; } else if (c === '"') { quoted = false; } else { field += c; }
    } else if (c === '"') { quoted = true; } else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && content[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.length > 1 || r[0] !== '');

  return body.map(r => Object.fromEntries(header.map((h, i) => [h.replace(/^﻿/, ''), r[i] ?? ''])));
}

export function promptFor(topic: string): string {
  return `Write an essay giving and supporting your opinion on the following topic: ${topic}.`;
}

/**
 * Deterministic sample stratified by the overall score: rows are grouped by score, and
 * groups are drawn from in turn, so the sample spans the scale instead of its crowded middle.
 */
export function sample(rows: Array<Record<string, string>>, n: number, seed: string, words: {min: number; max: number}): Array<Record<string, string>> {
  const random = seededRandom(seed);
  const eligible = rows.filter(r => {
    const w = countWords(normalizeResponse(r.full_text));
    return w >= words.min && w <= words.max && TRAITS.every(t => r[t] !== '' && Number.isFinite(Number(r[t])));
  }).sort((a, b) => a.text_id_kaggle.localeCompare(b.text_id_kaggle));
  const groups = new Map<string, Array<Record<string, string>>>();
  for (const r of eligible) groups.set(r.Overall, [...(groups.get(r.Overall) ?? []), r]);
  for (const [k, g] of groups) {
    for (let i = g.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [g[i], g[j]] = [g[j], g[i]];
    }
    groups.set(k, g);
  }
  const keys = [...groups.keys()].sort((a, b) => Number(a) - Number(b));
  const out: Array<Record<string, string>> = [];
  while (out.length < n && keys.some(k => groups.get(k)!.length)) {
    for (const k of keys) {
      if (out.length >= n) break;
      const next = groups.get(k)!.shift();
      if (next) out.push(next);
    }
  }
  if (out.length < n) throw new Error(`only ${out.length} eligible essays for ${n}`);

  return out;
}

export function toItem(row: Record<string, string>, split: 'dev' | 'test'): Item {
  return {
    id: `h1-${row.text_id_kaggle}`, set: 'H1', split, examKey: 'ielts-academic', prompt: promptFor(row.prompt),
    text: normalizeResponse(row.full_text),
    expected: {traits: Object.fromEntries(TRAITS.map(t => [t.toLowerCase(), Number(row[t])]))},
    source: {corpus: 'ELLIPSE', textId: row.text_id_kaggle, topic: row.prompt},
  };
}

const SIZES = {dev: 50, test: 100};
const WORDS = {min: 200, max: 500};

function main(sourceDir: string): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const dir = join(root, 'benchmarks/datasets/exam-h1-v1');
  const files = {dev: join(sourceDir, 'train.csv'), test: join(sourceDir, 'test/ELLIPSE_Final_github_test.csv')};
  const items: Item[] = [];
  const selection: Record<string, string[]> = {};
  for (const split of ['dev', 'test'] as const) {
    if (!existsSync(files[split])) throw new Error(`missing ${files[split]}`);
    const rows = parseCsv(readFileSync(files[split], 'utf8'));
    const chosen = sample(rows, SIZES[split], `h1-${split}`, WORDS);
    selection[split] = chosen.map(r => r.text_id_kaggle);
    items.push(...chosen.map(r => toItem(r, split)));
  }
  items.sort((a, b) => a.split.localeCompare(b.split) || a.id.localeCompare(b.id));
  const jsonl = toJsonl(items);
  mkdirSync(join(dir, 'raw'), {recursive: true});
  writeFileSync(join(dir, 'raw/items.jsonl'), jsonl);
  writeFileSync(join(dir, 'source.json'), JSON.stringify({
    set: 'H1',
    corpus: 'ELLIPSE (English Language Learner Insight, Proficiency and Skills Evaluation)',
    url: 'https://github.com/scrosseye/ELLIPSE-Corpus',
    license: 'CC BY 4.0',
    attribution: 'Crossley, S. A., Tian, Y., Baffour, P., Franklin, A., Kim, Y., Morris, W., Benner, B., Picou, A., & Boser, U. (2023). '
      + 'Measuring second language proficiency using the English Language Learner Insight, Proficiency and Skills Evaluation (ELLIPSE) Corpus. '
      + 'International Journal of Learner Corpus Research, 9(2), 248-269.',
    allowed: 'Use, including commercial, with attribution. Texts are kept out of the repository (benchmarks/README.md) and never used for model training.',
    sources: {dev: {file: 'ELLIPSE_Final_github_train.csv', sha256: sha256(readFileSync(files.dev))},
      test: {file: 'ELLIPSE_Final_github_test.csv (from ELLIPSE_Final_github_test.zip)', sha256: sha256(readFileSync(files.test))}},
    selection: {sizes: SIZES, words: WORDS, rule: 'stratified by Overall, seeded h1-<split>', ids: selection},
    prompt: promptFor('<topic>'),
    traits: TRAITS.map(t => t.toLowerCase()),
    items: 'raw/items.jsonl',
    itemsSha256: sha256(jsonl),
  }, null, 2) + '\n');
  const words = items.map(i => countWords(i.text));
  console.log(`H1: ${items.length} items (dev ${SIZES.dev}, test ${SIZES.test}); words ${Math.min(...words)}–${Math.max(...words)}, mean ${Math.round(words.reduce((a, b) => a + b, 0) / words.length)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  if (!source) {
    console.error('usage: npm run bench:h1 -- <ELLIPSE source dir>');
    process.exit(2);
  }
  main(resolve(source));
}
