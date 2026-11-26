/*
 * Builds the Academic Task 1 benchmark dataset exam-t1a-v1 (docs/phase-5/P5-plan.md §2.4, P5.4): sets S-T1 (clean
 * bases with inserted language errors), G-T1 (limiter and code cases derived from the bases) and N-T1 (the clean bases
 * themselves: nothing to find). No API calls here.
 *
 *   npm run bench:t1            write items.jsonl
 *   npm run bench:t1 -- --check fail if the file on disk differs from a fresh build
 *
 * Inputs (all synthetic, committed): the Task 1 library (our tasks, invented data), benchmarks/sources/t1a-bases.jsonl
 * (bases written and cross-checked by benchmarks/t1-bases/run.php, adjudicated by hand) and, for the "essay instead of a
 * report" case, the clean Task 2 bases of benchmarks/sources/s-bases.jsonl.
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  chartTable, checkNumbers, codePointLength, countWords, formatNumber, normalizeResponse, sliceCodePoints,
  type Chart, type ChartSpec,
} from '../../packages/exam-domain/src/index.js';
import {usable, type Base} from './build.js';
import {listForm, paragraphs, sentences, type Expected} from './g-cases.js';
import {insertErrors, insertionRules, reportInsertionRules} from './insertions.js';

export interface Task { ref: string; type: string; topic: string; difficulty: string; text: string; stimulus: ChartSpec }
export interface T1Base extends Omit<Base, 'promptId'> { taskId: string }
export type T1Expected = Expected & {
  /** Figures the code check must report as not supported by the data (G-T1 numbers_changed), or none at all (S, N). */
  numbers?: {unmatched: Array<{start: number; end: number; text: string}>};
};
export interface T1Item {
  id: string; set: 'S' | 'G' | 'N'; split: 'dev' | 'test'; examKey: string; taskKey: 'task-1'; taskRef: string;
  prompt: string; stimulus: ChartSpec; text: string; expected: T1Expected; source: Record<string, string>;
}

const EXAM_KEY = 'ielts-academic';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Split by task, so no task is in both: within each type, half of the tasks each, and the six tasks with a second base
 * (written by the other vendor) three in each split. 12 tasks and 15 bases per split.
 */
export const SPLIT: Record<string, 'dev' | 'test'> = {
  't1a-01': 'dev', 't1a-03': 'dev', 't1a-05': 'dev', 't1a-02': 'test', 't1a-04': 'test', 't1a-06': 'test',
  't1a-07': 'dev', 't1a-09': 'dev', 't1a-11': 'dev', 't1a-08': 'test', 't1a-10': 'test', 't1a-12': 'test',
  't1a-14': 'dev', 't1a-16': 'dev', 't1a-13': 'test', 't1a-15': 'test',
  't1a-17': 'dev', 't1a-24': 'dev', 't1a-18': 'test', 't1a-23': 'test',
  't1a-19': 'dev', 't1a-21': 'dev', 't1a-20': 'test', 't1a-22': 'test',
};

/** Reports are about half as long as essays: proportionally fewer inserted errors than Task 2 (6–10 in 5 families). */
const T1_INSERTIONS = {min: 4, max: 6, minFamilies: 3, rules: [...insertionRules, ...reportInsertionRules]};

/** Bands for a response that has nothing to do with the visual: the ta.cap.unrelated limiter and its CC and LR caps. */
const UNRELATED: T1Expected['bands'] = {task_achievement: {max: 1}, coherence_cohesion: {max: 2}, lexical_resource: {max: 4}, task: {max: 4.5}};

export const G_CASES = [
  'no_overview', 'numbers_changed', 'data_dump', 'opinion', 'under_length', 'essay_instead', 'other_chart', 'copied_prompt', 'list_form',
] as const;
type GCase = typeof G_CASES[number];
type Derived = {text: string; expected: T1Expected; source: Record<string, string>; task?: Task};

const taskId = (task: Task) => task.ref.split(':')[1];
const words = (text: string) => countWords(text);

/** The paragraph that sums up the whole picture: the second one, opening with "Overall" (checked, not guessed). */
function overviewIndex(text: string): number {
  const ps = paragraphs(text);
  if (!/^(overall|in general|in summary)\b/i.test(ps[1] ?? '')) throw new Error(`no overview paragraph: ${ps[1]?.slice(0, 60)}`);

  return 1;
}

/** Without its overview: TA is capped at 5 (ta.cap.no_overview). */
export function noOverview(text: string): Derived {
  const ps = paragraphs(text);
  const at = overviewIndex(text);
  const out = ps.filter((_, i) => i !== at).join('\n\n');
  if (words(out) < 150) throw new Error(`no_overview left ${words(out)} words`);

  return {text: out, expected: {early: null, bands: {task_achievement: {max: 5}}}, source: {case: 'no_overview'}};
}

/**
 * Three figures read off the chart replaced with values the data does not support. The code check must find all three;
 * reporting them wrongly breaks ta8.figures_accurate, so TA stays below 8.
 */
export function numbersChanged(text: string, spec: ChartSpec, count = 3): Derived {
  const ps = paragraphs(text);
  const bodyStart = codePointLength(ps.slice(0, 2).join('\n\n')) + 2;
  const mentions = checkNumbers(text, spec).filter(m => m.status === 'matched' && !m.approximate && m.start >= bodyStart);
  if (mentions.length < count * 2) throw new Error(`only ${mentions.length} figures in the body`);
  // Spread over the body; change from the end so earlier offsets stay valid while editing.
  const picked = Array.from({length: count}, (_, i) => mentions[Math.floor(((i + 0.5) * mentions.length) / count)]).reverse();
  let out = text;
  for (const m of picked) {
    const digits = m.text.match(/[\d,]+(?:\.\d+)?/)!;
    const decimals = digits[0].split('.')[1]?.length ?? 0;
    const n = Number(digits[0].replace(/,/g, ''));
    const replacement = [1.3, 0.7, 1.5, 0.5, 1.8].map(f => Number((n * f).toFixed(decimals))).find(v => {
      if (v === n || v <= 0) return false;
      const candidate = sliceCodePoints(out, 0, m.start) + m.text.replace(digits[0], formatNumber(v)) + sliceCodePoints(out, m.end, codePointLength(out));
      return checkNumbers(candidate, spec).some(x => x.start === m.start && x.status === 'unmatched');
    });
    if (replacement === undefined) throw new Error(`no unsupported replacement for "${m.text}"`);
    out = sliceCodePoints(out, 0, m.start) + m.text.replace(digits[0], formatNumber(replacement)) + sliceCodePoints(out, m.end, codePointLength(out));
  }
  const unmatched = checkNumbers(out, spec).filter(m => m.status === 'unmatched').map(m => ({start: m.start, end: m.end, text: m.text}));
  if (unmatched.length !== count) throw new Error(`numbers_changed: ${unmatched.length} unmatched, expected ${count}`);

  return {text: out, expected: {early: null, numbers: {unmatched}, bands: {task_achievement: {max: 7}}}, source: {case: 'numbers_changed'}};
}

/** Every value recounted one by one, no overview and no comparison: TA is capped at 5 (ta.cap.no_overview). */
export function dataDump(task: Task): Derived {
  const lines = (c: Chart): string[] => {
    const t = chartTable(c);
    const unit = t.caption.match(/\(([^)]+)\)$/)?.[1];
    return t.rows.map(([label, ...cells]) => cells.map((v, k) => {
      const head = t.head[k + 1];
      const value = unit && unit !== '%' && !v.endsWith('%') ? `${v} ${unit}` : v;
      return c.kind === 'pie' ? `The share of ${label} was ${value}.` : `In ${head}, the figure for ${label} was ${value}.`;
    }).join(' '));
  };
  const intro = `The ${task.stimulus.charts.length > 1 ? 'charts show' : task.type === 'table' ? 'table shows' : 'chart shows'} the figures given in the task.`;
  const out = [intro, ...task.stimulus.charts.flatMap(lines)].join('\n\n');
  if (words(out) < 150) throw new Error(`data_dump of ${task.ref} has ${words(out)} words`);

  return {text: out, expected: {early: null, bands: {task_achievement: {max: 5}}}, source: {case: 'data_dump', author: 'code'}};
}

export const OPINION = 'In my opinion, these changes are mainly the result of government policy and of new attitudes among ordinary people. '
  + 'I believe this trend is positive, and I am sure it will continue over the next ten years, because people today care much more about cost and '
  + 'convenience than they did in the past. Governments should therefore invest more money in this area, and schools should teach young people why '
  + 'it matters. Personally, I would also like to see much stronger rules, since leaving such choices to individuals has clearly not worked well enough.';

/** Introduction, overview and one body paragraph, then a paragraph of opinions and causes as long: ta7.data_only fails. */
export function opinion(text: string): Derived {
  const ps = paragraphs(text);
  overviewIndex(text);
  const out = [...ps.slice(0, 3), OPINION].join('\n\n');

  return {text: out, expected: {early: null, bands: {task_achievement: {max: 6}}}, source: {case: 'opinion'}};
}

/** Introduction, overview and the start of the body: 100–140 words, under the 150 the task asks for. */
export function underLengthT1(text: string, min = 100, max = 140): Derived {
  const ps = paragraphs(text);
  const head = ps.slice(0, 2).join('\n\n');
  const kept: string[] = [];
  for (const s of ps.slice(2).flatMap(sentences)) {
    if (words(head) + words(kept.join(' ')) >= min) break;
    kept.push(s);
  }
  const out = [head, ...(kept.length ? [kept.join(' ')] : [])].join('\n\n');
  if (words(out) < min || words(out) > max) throw new Error(`under_length produced ${words(out)} words`);

  return {text: out, expected: {early: null, flags: {underLength: true}}, source: {case: 'under_length'}};
}

/** The task's first sentence copied at the start: those words are not the writer's. */
export function copiedPromptT1(text: string, prompt: string): Derived {
  const [first, ...rest] = paragraphs(text);

  return {text: [`${sentences(prompt)[0]} ${first}`, ...rest].join('\n\n'), expected: {early: null, flags: {copiedPrompt: true}}, source: {case: 'copied_prompt'}};
}

export function buildT1Items(tasks: Task[], bases: T1Base[], essays: Base[]): T1Item[] {
  const byId = new Map(tasks.map(t => [taskId(t), t]));
  const task = (id: string) => {
    const t = byId.get(id);
    if (!t) throw new Error(`unknown task ${id}`);
    return t;
  };
  for (const t of tasks) if (!SPLIT[taskId(t)]) throw new Error(`task ${t.ref} has no split`);
  const items: T1Item[] = [];
  const item = (id: string, set: T1Item['set'], t: Task, text: string, expected: T1Expected, source: Record<string, string>): T1Item => ({
    id, set, split: SPLIT[taskId(t)], examKey: EXAM_KEY, taskKey: 'task-1', taskRef: t.ref, prompt: t.text, stimulus: t.stimulus,
    text: normalizeResponse(text), expected, source,
  });
  const clean = bases.filter(usable).map(b => ({...b, text: normalizeResponse(b.text)})).sort((a, b) => a.id.localeCompare(b.id));

  for (const base of clean) {
    const t = task(base.taskId);
    const none = {unmatched: []};
    items.push(item(`n-t1-${base.id}`, 'N', t, base.text, {errors: [], numbers: none}, {base: base.id, author: base.author.model}));
    const inserted = insertErrors(base.text, `s-t1-${base.id}`, T1_INSERTIONS);
    items.push(item(`s-t1-${base.id}`, 'S', t, inserted.text, {errors: inserted.errors, numbers: none}, {base: base.id, author: base.author.model}));
  }

  const otherTopic = (t: Task, split: 'dev' | 'test') => {
    // A task of the same split on another topic and of another type: nothing in the report relates to it.
    const pool = tasks.filter(o => SPLIT[taskId(o)] === split && o.topic !== t.topic && o.type !== t.type).sort((a, b) => a.ref.localeCompare(b.ref));
    return pool[(tasks.indexOf(t) * 5) % pool.length];
  };
  for (const split of ['dev', 'test'] as const) {
    const pool = clean.filter(b => SPLIT[b.taskId] === split);
    const essayPool = essays.filter(usable).sort((a, b) => a.id.localeCompare(b.id));
    G_CASES.forEach((gCase: GCase, i) => {
      // Spread the cases over the split; when a transform does not fit a base (too short to lose its overview), take the next.
      for (let k = 0; k < pool.length; k++) {
        const base = pool[(Math.floor((i * pool.length) / G_CASES.length) + k) % pool.length];
        const t = task(base.taskId);
        let d: Derived;
        try {
          d = derive(gCase, base, t, split, essayPool, otherTopic);
        } catch (e) {
          if (k === pool.length - 1) throw e;
          continue;
        }
        const target = d.task ?? t;
        items.push(item(`g-t1-${gCase.replace(/_/g, '-')}-${split}`, 'G', target, d.text, d.expected,
          {...(d.source.author === 'code' ? {} : {base: d.source.base ?? base.id}), ...d.source}));
        break;
      }
    });
  }

  for (const it of items) validateT1(it);
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) throw new Error(`duplicate item ${it.id}`);
    ids.add(it.id);
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}

function derive(gCase: GCase, base: T1Base, t: Task, split: 'dev' | 'test', essays: Base[], otherTopic: (t: Task, split: 'dev' | 'test') => Task): Derived {
  switch (gCase) {
    case 'no_overview': return noOverview(base.text);
    case 'numbers_changed': return numbersChanged(base.text, t.stimulus);
    case 'data_dump': return {...dataDump(t), task: t};
    case 'opinion': return opinion(base.text);
    case 'under_length': return underLengthT1(base.text);
    case 'copied_prompt': return copiedPromptT1(base.text, t.text);
    case 'list_form': {
      const d = listForm(base.text);
      return {text: d.text, expected: {early: null, flags: {listForm: true}, bands: {task_achievement: {max: 4}}}, source: {case: 'list_form'}};
    }
    case 'essay_instead': {
      // A Task 2 essay of our own, one per split, sent as the report: not a report and not about the visual.
      const essay = essays[split === 'dev' ? 0 : Math.floor(essays.length / 2)];
      return {text: normalizeResponse(essay.text), expected: {early: null, bands: UNRELATED}, source: {case: 'essay_instead', base: essay.id, author: essay.author.model}};
    }
    case 'other_chart': {
      const other = otherTopic(t, split);
      return {text: base.text, task: other, expected: {early: null, bands: UNRELATED}, source: {case: 'other_chart', writtenFor: t.ref}};
    }
  }
}

/** Every inserted error is where its span says; expected figures are where theirs say; the code check agrees. */
export function validateT1(it: T1Item): void {
  if (normalizeResponse(it.text) !== it.text) throw new Error(`${it.id}: text is not normalized`);
  const length = codePointLength(it.text);
  for (const e of it.expected.errors ?? []) {
    if (e.start < 0 || e.end > length || e.start >= e.end) throw new Error(`${it.id}: span ${e.start}-${e.end} out of the text`);
    if (e.inserted !== undefined && sliceCodePoints(it.text, e.start, e.end) !== e.inserted) throw new Error(`${it.id}: span ${e.start}-${e.end} does not hold "${e.inserted}"`);
  }
  if (it.expected.numbers) {
    const found = checkNumbers(it.text, it.stimulus).filter(m => m.status === 'unmatched').map(m => ({start: m.start, end: m.end, text: m.text}));
    if (JSON.stringify(found) !== JSON.stringify(it.expected.numbers.unmatched)) {
      throw new Error(`${it.id}: the code check finds ${JSON.stringify(found)}, expected ${JSON.stringify(it.expected.numbers.unmatched)}`);
    }
  }
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as T);
}

export function readT1Inputs(): {tasks: Task[]; bases: T1Base[]; essays: Base[]} {
  const library = JSON.parse(readFileSync(join(root, 'packages/exam-domain/library/ielts-writing-task-1-academic.v1.json'), 'utf8'));
  return {
    tasks: library.tasks,
    bases: readJsonl<T1Base>(join(root, 'benchmarks/sources/t1a-bases.jsonl')),
    essays: readJsonl<Base>(join(root, 'benchmarks/sources/s-bases.jsonl')),
  };
}

function main(check: boolean): void {
  const {tasks, bases, essays} = readT1Inputs();
  const items = buildT1Items(tasks, bases, essays);
  const path = join(root, 'benchmarks/datasets/exam-t1a-v1/items.jsonl');
  const jsonl = items.map(i => JSON.stringify(i)).join('\n') + '\n';
  const count = (set: string, split: string) => items.filter(i => i.set === set && i.split === split).length;
  const errors = items.reduce((n, i) => n + (i.expected.errors?.length ?? 0), 0);
  console.log(`exam-t1a-v1: ${items.length} items (S dev/test ${count('S', 'dev')}/${count('S', 'test')}, G ${count('G', 'dev')}/${count('G', 'test')}, N ${count('N', 'dev')}/${count('N', 'test')}), ${errors} inserted errors`);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === jsonl) return;
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
