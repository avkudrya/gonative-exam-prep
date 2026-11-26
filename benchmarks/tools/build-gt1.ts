/*
 * Builds the General Training Task 1 benchmark dataset exam-gt1-v1 (docs/phase-5/P5-plan.md §3, P5.9): sets S-GT1 (clean
 * base letters with inserted language errors), G-GT1 (limiter and code cases derived from the bases or written by hand)
 * and N-GT1 (the clean bases themselves: nothing to find). No API calls here.
 *
 *   npm run bench:gt1            write items.jsonl
 *   npm run bench:gt1 -- --check fail if the file on disk differs from a fresh build
 *
 * Inputs (all synthetic, committed): the GT Task 1 library (our tasks), benchmarks/sources/gt1-bases.jsonl (bases written and
 * cross-checked by benchmarks/gt1-bases/run.php, adjudicated by hand) and, for the "essay instead of a letter" case, the
 * clean Task 2 bases of benchmarks/sources/s-bases.jsonl.
 */

import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {codePointLength, countWords, letterFacts, normalizeResponse, sliceCodePoints, type LetterMismatch, type LetterSpec} from '../../packages/exam-domain/src/index.js';
import {usable, type Base} from './build.js';
import {listForm, paragraphs, sentences, type Expected} from './g-cases.js';
import {insertErrors, insertionRules, letterInsertionRules} from './insertions.js';

export interface LetterTask { ref: string; type: string; purpose: string; topic: string; difficulty: string; text: string; stimulus: LetterSpec }
export interface GT1Base extends Omit<Base, 'promptId'> { taskId: string }
export type GT1Expected = Expected & {
  /** What the code check of the opening and closing must report (letterFacts mismatches). */
  letter?: {mismatches: LetterMismatch[]};
};
export interface GT1Item {
  id: string; set: 'S' | 'G' | 'N'; split: 'dev' | 'test'; examKey: string; taskKey: 'task-1'; taskRef: string;
  prompt: string; stimulus: LetterSpec; text: string; expected: GT1Expected; source: Record<string, string>;
}

const EXAM_KEY = 'ielts-general-training';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Split by task, so no task is in both: four tasks of each tone per split, and the six tasks with a second base (by the
 * other vendor) one per tone in each split. 12 tasks and 15 bases per split.
 */
export const GT1_SPLIT: Record<string, 'dev' | 'test'> = {
  'gt1-01': 'dev', 'gt1-03': 'dev', 'gt1-05': 'dev', 'gt1-07': 'dev', 'gt1-02': 'test', 'gt1-04': 'test', 'gt1-06': 'test', 'gt1-08': 'test',
  'gt1-09': 'dev', 'gt1-11': 'dev', 'gt1-13': 'dev', 'gt1-15': 'dev', 'gt1-10': 'test', 'gt1-12': 'test', 'gt1-14': 'test', 'gt1-16': 'test',
  'gt1-17': 'dev', 'gt1-19': 'dev', 'gt1-21': 'dev', 'gt1-23': 'dev', 'gt1-18': 'test', 'gt1-20': 'test', 'gt1-22': 'test', 'gt1-24': 'test',
};

/** Letters are about as long as reports: as many inserted errors as Task 1 Academic (4–6 in 3 families). */
const GT1_INSERTIONS = {min: 4, max: 6, minFamilies: 3, rules: [...insertionRules, ...letterInsertionRules]};

/** Bands for a response that has nothing to do with the task: ta.cap.unrelated and its CC and LR caps. */
const UNRELATED: GT1Expected['bands'] = {task_achievement: {max: 1}, coherence_cohesion: {max: 2}, lexical_resource: {max: 4}, task: {max: 4.5}};

export const GT1_G_CASES = [
  'missing_point', 'wrong_tone', 'wrong_pair', 'essay_instead', 'other_task', 'under_length', 'list_form', 'copied_prompt',
] as const;
type GCase = typeof GT1_G_CASES[number];
type Derived = {text: string; expected: GT1Expected; source: Record<string, string>; task?: LetterTask};

/** missing_point: the body paragraph that covers one point is dropped (chosen by hand; the rest stays over 150 words). */
export const MISSING_POINT: Record<'dev' | 'test', {base: string; starts: string; point: number}> = {
  dev: {base: 'gb05', starts: 'You can reach me by telephone', point: 3},
  test: {base: 'gb26', starts: 'I have used the park for more than ten years', point: 1},
};

/**
 * wrong_tone: written by hand for this set — every point covered and the purpose clear, but the register is wrong for the reader
 * throughout (ta.cap.wrong_tone, TA at most 4). Language otherwise correct for its register.
 */
export const WRONG_TONE: Record<'dev' | 'test', {taskId: string; text: string}> = {
  dev: {taskId: 'gt1-07', text: [
    'Hi guys,',
    "Hope you're all doing great! I stayed at your hotel for three nights last month, from the 14th to the 17th, in one of the double rooms on the fourth floor. Honestly, I loved it. The bed was super comfy, the breakfast was amazing and the staff were really friendly.",
    "Anyway, here's the thing. When I got home and checked my banking app, I saw that you'd taken the money for the room twice! It was the same amount both times, $426, and both payments went through on the 17th. That's pretty annoying, to be honest, because it's a lot of cash to have stuck somewhere, and I've got bills to pay.",
    "So could you sort it out and send the extra $426 back to my card as soon as you can? A quick email to say it's done would be great too. Thanks a million, and I'd totally come back again!",
    'Cheers,',
    'Dan',
  ].join('\n\n')},
  test: {taskId: 'gt1-18', text: [
    'Dear Sir or Madam,',
    'I am writing to formally express my regret regarding my absence from your birthday celebration, which took place on Saturday. Owing to an unforeseen requirement to cover an evening shift at my place of employment, I was unable to attend the event as planned, for which I sincerely apologize.',
    'I would be grateful if you could provide me with information concerning the proceedings of the party, including the approximate number of attendees and whether the arrangements proved satisfactory. I would also appreciate being informed whether the gift presented to you by your sister met with your approval.',
    'In order to compensate for my absence, I would like to propose a meeting on Friday evening at a restaurant of your choosing, where the occasion could be marked appropriately. Kindly confirm at your earliest convenience whether this arrangement is acceptable to you.',
    'I look forward to receiving your reply.',
    'Yours faithfully,',
    'Mia Thompson',
  ].join('\n\n')},
};

/** A closing that does not suit the tone of the task (and, after a greeting by name, "Yours faithfully" breaks the pair). */
const WRONG_CLOSING: Record<LetterSpec['tone'], string> = {formal: 'Love,', semi_formal: 'Yours faithfully,', informal: 'Yours faithfully,'};

const taskId = (task: LetterTask) => task.ref.split(':')[1];
const words = (text: string) => countWords(text);

/** The closing formula line (letterFacts found it) replaced, the name kept. */
export function wrongPair(text: string, tone: LetterSpec['tone']): Derived {
  const facts = letterFacts(text, tone);
  if (!facts.closing) throw new Error('wrong_pair: no closing to replace');
  const at = text.lastIndexOf(facts.closing.line);
  const out = text.slice(0, at) + WRONG_CLOSING[tone] + text.slice(at + facts.closing.line.length);
  const mismatches = letterFacts(out, tone).mismatches;
  if (!mismatches.includes('closing_tone')) throw new Error(`wrong_pair: ${JSON.stringify(mismatches)}`);
  // One format lapse in an otherwise good letter: not band 9 (ta9 lapses), not a cap.
  return {text: out, expected: {early: null, letter: {mismatches}, bands: {task_achievement: {max: 8}}}, source: {case: 'wrong_pair', closing: WRONG_CLOSING[tone]}};
}

/** The opening line, then the body cut to 100–140 words in all, then the closing and the name: under the 150 asked for. */
export function underLengthLetter(text: string, min = 100, max = 140): Derived {
  const ps = paragraphs(text);
  const tail = ps.slice(-2);
  const kept: string[] = [];
  for (const s of ps.slice(1, -2).flatMap(sentences)) {
    if (words([ps[0], ...kept, ...tail].join(' ')) >= min) break;
    kept.push(s);
  }
  const out = [ps[0], kept.join(' '), ...tail].join('\n\n');
  if (words(out) < min || words(out) > max) throw new Error(`under_length produced ${words(out)} words`);

  return {text: out, expected: {early: null, flags: {underLength: true}}, source: {case: 'under_length'}};
}

/** The task's first sentence copied at the start of the body (after the opening line): those words are not the writer's. */
export function copiedPromptLetter(text: string, prompt: string): Derived {
  const [opening, first, ...rest] = paragraphs(text);

  return {text: [opening, `${sentences(prompt.split('\n')[0])[0]} ${first}`, ...rest].join('\n\n'), expected: {early: null, flags: {copiedPrompt: true}},
    source: {case: 'copied_prompt'}};
}

export function buildGT1Items(tasks: LetterTask[], bases: GT1Base[], essays: Base[]): GT1Item[] {
  const byId = new Map(tasks.map(t => [taskId(t), t]));
  const task = (id: string) => {
    const t = byId.get(id);
    if (!t) throw new Error(`unknown task ${id}`);
    return t;
  };
  for (const t of tasks) if (!GT1_SPLIT[taskId(t)]) throw new Error(`task ${t.ref} has no split`);
  const items: GT1Item[] = [];
  const item = (id: string, set: GT1Item['set'], t: LetterTask, text: string, expected: GT1Expected, source: Record<string, string>): GT1Item => ({
    id, set, split: GT1_SPLIT[taskId(t)], examKey: EXAM_KEY, taskKey: 'task-1', taskRef: t.ref, prompt: t.text, stimulus: t.stimulus,
    text: normalizeResponse(text), expected, source,
  });
  const clean = bases.filter(usable).map(b => ({...b, text: normalizeResponse(b.text)})).sort((a, b) => a.id.localeCompare(b.id));
  const byBase = new Map(clean.map(b => [b.id, b]));

  for (const base of clean) {
    const t = task(base.taskId);
    const ok = {mismatches: []};
    items.push(item(`n-gt1-${base.id}`, 'N', t, base.text, {errors: [], letter: ok}, {base: base.id, author: base.author.model}));
    const inserted = insertErrors(base.text, `s-gt1-${base.id}`, GT1_INSERTIONS);
    items.push(item(`s-gt1-${base.id}`, 'S', t, inserted.text, {errors: inserted.errors, letter: ok}, {base: base.id, author: base.author.model}));
  }

  const otherTask = (t: LetterTask, split: 'dev' | 'test') => {
    // A task of the same split with another topic and tone: nothing in the letter relates to it.
    const pool = tasks.filter(o => GT1_SPLIT[taskId(o)] === split && o.topic !== t.topic && o.type !== t.type).sort((a, b) => a.ref.localeCompare(b.ref));
    return pool[(tasks.indexOf(t) * 5) % pool.length];
  };
  const essayPool = essays.filter(usable).sort((a, b) => a.id.localeCompare(b.id));
  for (const split of ['dev', 'test'] as const) {
    const pool = clean.filter(b => GT1_SPLIT[b.taskId] === split);
    GT1_G_CASES.forEach((gCase: GCase, i) => {
      const id = `g-gt1-${gCase.replace(/_/g, '-')}-${split}`;
      if (gCase === 'missing_point') {
        const m = MISSING_POINT[split];
        const base = byBase.get(m.base);
        if (!base || GT1_SPLIT[base.taskId] !== split) throw new Error(`missing_point base ${m.base} is not a ${split} base`);
        const ps = paragraphs(base.text);
        const out = ps.filter(p => !p.startsWith(m.starts)).join('\n\n');
        if (paragraphs(out).length !== ps.length - 1 || words(out) < 150) throw new Error(`missing_point ${m.base}: ${words(out)} words`);
        items.push(item(id, 'G', task(base.taskId), out, {early: null, letter: {mismatches: []}, bands: {task_achievement: {max: 4}}},
          {case: gCase, base: base.id, point: String(m.point)}));
        return;
      }
      if (gCase === 'wrong_tone') {
        const w = WRONG_TONE[split];
        const t = task(w.taskId);
        if (GT1_SPLIT[w.taskId] !== split) throw new Error(`wrong_tone task ${w.taskId} is not in ${split}`);
        const mismatches = letterFacts(normalizeResponse(w.text), t.stimulus.tone).mismatches;
        items.push(item(id, 'G', t, w.text, {early: null, letter: {mismatches}, bands: {task_achievement: {max: 4}}}, {case: gCase, author: 'hand'}));
        return;
      }
      // Spread the other cases over the split; when a transform does not fit a base, take the next. wrong_pair: a formal
      // letter closing with "Love," in dev, a semi-formal one with "Yours faithfully" after a greeting by name in test.
      const cases = gCase === 'wrong_pair' ? pool.filter(b => task(b.taskId).stimulus.tone === (split === 'dev' ? 'formal' : 'semi_formal')) : pool;
      for (let k = 0; k < cases.length; k++) {
        const base = cases[(Math.floor((i * cases.length) / GT1_G_CASES.length) + k) % cases.length];
        const t = task(base.taskId);
        let d: Derived;
        try {
          d = derive(gCase, base, t, split, essayPool, otherTask);
        } catch (e) {
          if (k === cases.length - 1) throw e;
          continue;
        }
        items.push(item(id, 'G', d.task ?? t, d.text, d.expected, {base: d.source.base ?? base.id, ...d.source}));
        break;
      }
    });
  }

  for (const it of items) validateGT1(it);
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) throw new Error(`duplicate item ${it.id}`);
    ids.add(it.id);
  }

  return items.sort((a, b) => a.id.localeCompare(b.id));
}

function derive(gCase: GCase, base: GT1Base, t: LetterTask, split: 'dev' | 'test', essays: Base[], otherTask: (t: LetterTask, split: 'dev' | 'test') => LetterTask): Derived {
  switch (gCase) {
    case 'wrong_pair': return wrongPair(base.text, t.stimulus.tone);
    case 'under_length': return underLengthLetter(base.text);
    case 'copied_prompt': return copiedPromptLetter(base.text, t.text);
    case 'list_form': {
      const d = listForm(base.text);
      return {text: d.text, expected: {early: null, flags: {listForm: true}, bands: {task_achievement: {max: 4}}}, source: {case: 'list_form'}};
    }
    case 'essay_instead': {
      // A Task 2 essay of our own, one per split, sent as the letter: not a letter and not about the situation.
      const essay = essays[split === 'dev' ? 1 : Math.floor(essays.length / 2) + 1];
      return {text: normalizeResponse(essay.text), expected: {early: null, bands: UNRELATED}, source: {case: 'essay_instead', base: essay.id, author: essay.author.model}};
    }
    case 'other_task': {
      const other = otherTask(t, split);
      return {text: base.text, task: other, expected: {early: null, bands: UNRELATED}, source: {case: 'other_task', writtenFor: t.ref}};
    }
    default: throw new Error(`case ${gCase} is built in place`);
  }
}

/** Every inserted error is where its span says; the code check of the opening and closing agrees with the expectation. */
export function validateGT1(it: GT1Item): void {
  if (normalizeResponse(it.text) !== it.text) throw new Error(`${it.id}: text is not normalized`);
  const length = codePointLength(it.text);
  for (const e of it.expected.errors ?? []) {
    if (e.start < 0 || e.end > length || e.start >= e.end) throw new Error(`${it.id}: span ${e.start}-${e.end} out of the text`);
    if (e.inserted !== undefined && sliceCodePoints(it.text, e.start, e.end) !== e.inserted) throw new Error(`${it.id}: span ${e.start}-${e.end} does not hold "${e.inserted}"`);
  }
  if (it.expected.letter) {
    const found = letterFacts(it.text, it.stimulus.tone).mismatches;
    if (JSON.stringify(found) !== JSON.stringify(it.expected.letter.mismatches)) {
      throw new Error(`${it.id}: the code check finds ${JSON.stringify(found)}, expected ${JSON.stringify(it.expected.letter.mismatches)}`);
    }
  }
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as T);
}

export function readGT1Inputs(): {tasks: LetterTask[]; bases: GT1Base[]; essays: Base[]} {
  const library = JSON.parse(readFileSync(join(root, 'packages/exam-domain/library/ielts-writing-task-1-general.v1.json'), 'utf8'));
  return {
    tasks: library.tasks,
    bases: readJsonl<GT1Base>(join(root, 'benchmarks/sources/gt1-bases.jsonl')),
    essays: readJsonl<Base>(join(root, 'benchmarks/sources/s-bases.jsonl')),
  };
}

function main(check: boolean): void {
  const {tasks, bases, essays} = readGT1Inputs();
  const items = buildGT1Items(tasks, bases, essays);
  const path = join(root, 'benchmarks/datasets/exam-gt1-v1/items.jsonl');
  const jsonl = items.map(i => JSON.stringify(i)).join('\n') + '\n';
  const count = (set: string, split: string) => items.filter(i => i.set === set && i.split === split).length;
  const errors = items.reduce((n, i) => n + (i.expected.errors?.length ?? 0), 0);
  console.log(`exam-gt1-v1: ${items.length} items (S dev/test ${count('S', 'dev')}/${count('S', 'test')}, G ${count('G', 'dev')}/${count('G', 'test')}, N ${count('N', 'dev')}/${count('N', 'test')}), ${errors} inserted errors`);
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
