/**
 * P6.5: exam-examples-v1 — our own sample answers whose feedback is published as examples on the landing host.
 *
 *   npm run bench:examples              build benchmarks/datasets/exam-examples-v1/items-{t2,t1a,gt1}.jsonl
 *   npm run bench:examples -- --check   fail if the files on disk differ from a fresh build
 *
 * Source: benchmarks/sources/examples-v1.json (texts written in the session, no user data). The items have no expected
 * findings: the run only produces the feedback shown on the example pages.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPrecision} from './build-precision.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = JSON.parse(readFileSync(join(root, 'benchmarks/sources/examples-v1.json'), 'utf8'));
const built = buildPrecision(source);
const check = process.argv.includes('--check');
let stale = false;
for (const [task, items] of Object.entries(built)) {
  const path = join(root, `benchmarks/datasets/exam-examples-v1/items-${task}.jsonl`);
  const jsonl = items.map(item => JSON.stringify({...item, set: 'E', source: {written: 'session', purpose: 'P6.5 public examples', level: source.levels[(item as {id: string}).id]}})).join('\n') + '\n';
  console.log(`exam-examples-v1 ${task}: ${items.length} items`);
  if ((existsSync(path) ? readFileSync(path, 'utf8') : null) === jsonl) continue;
  if (check) { console.error(`out of date: ${path}`); stale = true; continue; }
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, jsonl);
}
if (stale) process.exit(1);
