/**
 * P5.2 (docs/phase-5/P5-plan.md §2.2): checks the own Academic Task 1 tasks (benchmarks/sources/task1-academic-charts.json).
 * --review-input <dir> writes a second-vendor review input there — each task's instruction, its data as tables and the
 * code-computed facts (task1-academic.v1/input.json is the one reviewed; a reviewed input is never rewritten).
 * --html <dir> writes charts.html with every chart drawn.
 *
 * usage: node --import tsx benchmarks/tools/task1-charts.ts [--review-input <dir>] [--html <dir>]
 */
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {chartFacts, chartTable, checkChartSpec, renderChartSvg, type ChartSpec} from '../../packages/exam-domain/src/index.js';

type Item = {id: string; type: string; topic: string; instruction: string; spec: ChartSpec};
const source = JSON.parse(readFileSync('benchmarks/sources/task1-academic-charts.json', 'utf8')) as {items: Item[]};
const problems = source.items.flatMap(i => checkChartSpec(i.spec).map(p => `${i.id} ${p}`));
const words = source.items.filter(i => !/Write at least 150 words\.$/.test(i.instruction)).map(i => i.id);
if (problems.length || words.length) throw new Error([...problems, ...words.map(id => `${id}: instruction without the length`)].join('\n'));

const input = {items: source.items.map(i => ({id: i.id, type: i.type, topic: i.topic, instruction: i.instruction,
  charts: i.spec.charts.map(c => ({kind: c.kind, table: chartTable(c), facts: chartFacts(c).map(f => f.text)}))}))};
const json = JSON.stringify(input, null, 1) + '\n';
const arg = (name: string) => (process.argv.indexOf(name) > 0 ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const reviewDir = arg('--review-input');
if (reviewDir) {
  if (existsSync(`${reviewDir}/response.json`)) throw new Error('that review already has a response: a new review needs a new directory');
  writeFileSync(`${reviewDir}/input.json`, json);
}
console.log(JSON.stringify({items: input.items.length, charts: input.items.reduce((n, i) => n + i.charts.length, 0),
  sha256: createHash('sha256').update(json).digest('hex')}));

const out = arg('--html');
if (out) {
  const cell = (i: Item) => `<section style="break-inside:avoid;margin:0 0 24px"><h3 style="font:600 14px system-ui">${i.id} · ${i.type}</h3>`
    + `<p style="font:13px system-ui;max-width:640px">${i.instruction}</p>`
    + i.spec.charts.map(c => renderChartSvg(c) ?? `<table border="1" style="font:13px system-ui;border-collapse:collapse"><caption>${chartTable(c).caption}</caption>`
      + `<tr>${chartTable(c).head.map(h => `<th>${h}</th>`).join('')}</tr>${chartTable(c).rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table>`).join('')
    + '</section>';
  writeFileSync(`${out}/task1-charts.html`, `<html><body style="margin:16px;color:#1f2937;background:#fff">${source.items.map(cell).join('')}</body></html>`);
}
