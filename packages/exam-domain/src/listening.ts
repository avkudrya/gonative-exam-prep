/*
 * IELTS Listening (Phase 7, docs/phase-7/P7.6-listening-design.md): the format, the content schema of a test (parts made of
 * the turns of a recording), the form checks run by code before any model solves the questions or any voice is paid for,
 * the checks of an assembled recording, and the raw-score → approximate band mapping.
 *
 * Listening is the same in IELTS Academic and General Training (P6.1 §1), so there is one library and no exam choice.
 * Facts are those of P6.1 §2 and §6 (checked 2026-11-27). Values marked "ours" are product choices, not exam rules.
 * MultiAdmin's ListeningForm is the PHP twin of checkListeningPart and checkListeningAudio (shared fixture).
 */
import {countWords} from './text.js';
import {answerWords, bandFromRaw, matchFold as fold, type Explanations, type Option} from './reading.js';
import {checkMapSpec, mapSpec, type MapSpec} from './map-spec.js';

export type ListeningQuestionType =
  | 'multiple_choice' | 'multiple_choice_multi' | 'matching_features' | 'map_labelling'
  | 'form_completion' | 'note_completion' | 'table_completion' | 'flow_chart_completion' | 'sentence_completion' | 'short_answer';

export type Accent = 'british' | 'australian' | 'north_american' | 'new_zealand';

export const LISTENING_FORMAT = {
  parts: 4,
  questionsPerPart: 10,
  questions: 40,
  minutes: 30,
  /** P6.1 §2: two speakers; one main speaker; two main speakers, perhaps a tutor; one speaker. */
  speakers: [{min: 2, max: 2}, {min: 1, max: 2}, {min: 2, max: 3}, {min: 1, max: 1}],
  /** Ours (P7.6 §2, no official length): words spoken in one part, without the narrator. */
  words: {min: 500, max: 1000},
  /** Ours (P7.6 §3): words spoken between the evidence of two consecutive questions, so that an answer can be typed. */
  gapWords: 15,
  /** Ours (P7.6 §3): the same in the assembled recording; 15 words take about five seconds. */
  gapMs: 5000,
  /** Ours (P7.6 §5.4, owner 2026-11-27): time to read a block of questions before it, and to check a part at its end. */
  readMs: 30000,
  checkMs: 30000,
  types: ['multiple_choice', 'multiple_choice_multi', 'matching_features', 'map_labelling', 'form_completion', 'note_completion',
    'table_completion', 'flow_chart_completion', 'sentence_completion', 'short_answer'] as ListeningQuestionType[],
} as const;

/** P6.1 §6: Listening uses the same approximate thresholds as Academic Reading. */
export const LISTENING_THRESHOLDS = [{band: 5, raw: 16}, {band: 6, raw: 23}, {band: 7, raw: 30}, {band: 8, raw: 35}];

export function listeningEstimate(raw: number): {low: number; high: number} | null {
  return bandFromRaw(raw, LISTENING_THRESHOLDS);
}

const CHOICE: ListeningQuestionType[] = ['multiple_choice', 'multiple_choice_multi'];
const MATCHING: ListeningQuestionType[] = ['matching_features', 'map_labelling'];
const COMPLETION: ListeningQuestionType[] = ['form_completion', 'note_completion', 'table_completion', 'flow_chart_completion', 'sentence_completion', 'short_answer'];

export type Speaker = {id: string; name: string; gender: 'female' | 'male'; accent: Accent; role: string};

/** One turn of the recording: `text` is the transcript the learner reads after the test; `say`, when present, is what the voice is given (P7.6 §5.3). */
export type Turn = {speaker: string; text: string; say?: string};

export type ListeningQuestion = {
  numbers: number[];
  prompt: string;
  /** Option ids (choice, matching, map letters) or accepted answers (completion; the first is the canonical one). */
  answer: string[];
  /** Words of one turn that give the answer; every Listening question has one. */
  evidence: string;
  explanation: Explanations;
};

export type ListeningGroup = {
  type: ListeningQuestionType;
  instruction: string;
  /** Heading of a form, notes, table or flow chart. */
  title?: string;
  options?: Option[];
  reuse?: boolean;
  limit?: {words: number; number: boolean};
  /** map_labelling: the plan or map; its letters are the options. */
  figure?: MapSpec;
  questions: ListeningQuestion[];
};

/** One recorded segment of an assembled part (P7.6 §5.4): times in milliseconds from the start of the part's file. */
export type AudioSegment =
  | {kind: 'narrator'; startMs: number; endMs: number; text: string}
  | {kind: 'pause'; startMs: number; endMs: number; purpose: 'read' | 'check'; questions?: [number, number]}
  | {kind: 'turn'; startMs: number; endMs: number; turn: number};

export type PartAudio = {
  file: string;
  sha256: string;
  bytes: number;
  durationMs: number;
  /** Who voiced whom: speaker id (and `narrator`) → provider and voice. */
  voices: Record<string, {provider: string; voice: string}>;
  segments: AudioSegment[];
};

export type ListeningPart = {
  title: string;
  /** What the narrator says before the part, in our words (P7.6 §5.4). */
  context: string;
  speakers: Speaker[];
  turns: Turn[];
  groups: ListeningGroup[];
  audio?: PartAudio;
};

export type ListeningTest = {id: string; parts: ListeningPart[]};

const options = (group: ListeningGroup): Option[] =>
  group.type === 'map_labelling' && group.figure
    ? group.figure.features.flatMap(f => f.letter ? [{id: f.letter, text: f.letter}] : []).sort((a, b) => a.id.localeCompare(b.id))
    : group.options ?? [];

/**
 * Blocks of questions, each with its own reading pause ("look at questions 15 to 17"): runs of consecutive groups of the
 * same type. A multiple-choice block is several one-question groups, as in Reading.
 */
export function listeningBlocks(part: ListeningPart): {type: ListeningQuestionType; from: number; to: number; groups: number[]}[] {
  const blocks: {type: ListeningQuestionType; from: number; to: number; groups: number[]}[] = [];
  part.groups.forEach((g, i) => {
    const first = g.questions[0]?.numbers[0] ?? 0;
    const last = g.questions.at(-1)?.numbers.at(-1) ?? 0;
    const current = blocks.at(-1);
    if (current && current.type === g.type) Object.assign(current, {to: last, groups: [...current.groups, i]});
    else blocks.push({type: g.type, from: first, to: last, groups: [i]});
  });
  return blocks;
}

/** Where a quote is heard: the turn, the code-point offsets in that turn, and the number of words spoken before it. */
export type Heard = {turn: number; start: number; end: number; wordsBefore: number};

/**
 * The first place at or after `from` where `quote` is said, in the folded turns. Offsets are UTF-16 here and code points in
 * PHP; they are only compared with each other, and shares of a turn are taken in code points on both sides.
 */
export function findHeard(turns: Turn[], quote: string, from: {turn: number; end: number} = {turn: 0, end: 0}): Heard | null {
  const q = fold(quote).trim();
  if (!q) return null;
  let words = turns.slice(0, from.turn).reduce((n, t) => n + countWords(t.text), 0);
  for (let i = from.turn; i < turns.length; i++) {
    const text = fold(turns[i].text);
    const at = text.indexOf(q, i === from.turn ? from.end : 0);
    if (at >= 0) return {turn: i, start: at, end: at + q.length, wordsBefore: words + countWords(text.slice(0, at))};
    words += countWords(turns[i].text);
  }
  return null;
}

/** Problems of one part's form: the questions must be answerable from what is said, in order, with time to write. */
export function checkListeningPart(part: ListeningPart, index: number): string[] {
  const problems: string[] = [];
  const range = LISTENING_FORMAT.speakers[index];
  const ids = part.speakers.map(s => s.id);
  if (!part.title.trim() || !part.context.trim()) problems.push('no title or narrator context');
  if (range && (ids.length < range.min || ids.length > range.max)) problems.push(`${ids.length} speakers, part ${index + 1} has ${range.min === range.max ? range.min : `${range.min}-${range.max}`}`);
  if (new Set(ids).size !== ids.length || ids.includes('narrator')) problems.push('speaker ids must be unique and not "narrator"');
  const names = part.speakers.map(s => fold(s.name));
  if (new Set(names).size !== names.length) problems.push('two speakers have the same name');
  for (const t of part.turns.keys()) {
    if (!ids.includes(part.turns[t].speaker)) problems.push(`turn ${t + 1}: unknown speaker "${part.turns[t].speaker}"`);
    if (!part.turns[t].text.trim() || part.turns[t].say?.trim() === '') problems.push(`turn ${t + 1}: empty`);
  }
  for (const s of part.speakers) if (!part.turns.some(t => t.speaker === s.id)) problems.push(`speaker ${s.id} never speaks`);
  const words = part.turns.reduce((n, t) => n + countWords(t.text), 0);
  if (words < LISTENING_FORMAT.words.min || words > LISTENING_FORMAT.words.max) problems.push(`${words} words spoken, not ${LISTENING_FORMAT.words.min}-${LISTENING_FORMAT.words.max}`);

  // Every Listening question follows the order of the recording, with time to write between two answers.
  let last: Heard | null = null;
  let lastNumber = 0;
  const blockStarts = new Set(listeningBlocks(part).slice(1).map(b => b.groups[0]));
  for (const [g, group] of part.groups.entries()) {
    // The reading pause of a new block goes between two turns: the block may not begin in the turn that ends the last one.
    const blockStart = blockStarts.has(g) ? last?.turn ?? null : null;
    const at = `group ${g + 1} (${group.type})`;
    if (!LISTENING_FORMAT.types.includes(group.type)) problems.push(`${at}: not a Listening question type`);
    if (!group.instruction.trim()) problems.push(`${at}: no instruction`);
    const opts = options(group);
    const optionIds = opts.map(o => o.id);
    const choice = CHOICE.includes(group.type);
    const matching = MATCHING.includes(group.type);
    const completion = COMPLETION.includes(group.type);
    if (group.type === 'map_labelling') {
      if (!group.figure) problems.push(`${at}: no map`);
      else {
        const parsed = mapSpec.safeParse(group.figure);
        problems.push(...checkMapSpec(group.figure).map(p => `${at}, map: ${p}`));
        if (parsed.success && opts.length <= group.questions.length) problems.push(`${at}: the map needs more letters than questions`);
      }
      if (group.options) problems.push(`${at}: map options come from the map's letters`);
    }
    if (new Set(optionIds).size !== optionIds.length) problems.push(`${at}: repeated option ids`);
    if (new Set(opts.map(o => fold(o.text))).size !== opts.length) problems.push(`${at}: repeated option texts`);
    if ((choice || matching) && opts.length < 2) problems.push(`${at}: needs options`);
    if (completion && !group.limit) problems.push(`${at}: no word limit`);
    if (matching && !group.reuse) {
      const used = group.questions.flatMap(q => q.answer);
      if (new Set(used).size !== used.length) problems.push(`${at}: an option is used twice but reuse is not allowed`);
      if (opts.length < group.questions.length) problems.push(`${at}: fewer options than questions`);
    }
    for (const q of group.questions) {
      const where = `${at}, question ${q.numbers.join('-')}`;
      const multi = group.type === 'multiple_choice_multi';
      if (multi ? q.numbers.length < 2 || q.answer.length !== q.numbers.length : q.numbers.length !== 1) problems.push(`${where}: numbers and answers do not match`);
      if (q.numbers[0] !== lastNumber + 1 && lastNumber > 0) problems.push(`${where}: numbers are not consecutive`);
      lastNumber = q.numbers[q.numbers.length - 1] ?? lastNumber;
      if (!q.answer.length || q.answer.some(a => !a.trim())) problems.push(`${where}: no answer`);
      if ((choice || matching) && q.answer.some(a => !optionIds.includes(a))) problems.push(`${where}: answer is not an option`);
      if (multi && new Set(q.answer).size !== q.answer.length) problems.push(`${where}: repeated answer`);
      if (!q.explanation.en.trim()) problems.push(`${where}: no explanation`);
      if (completion) {
        for (const answer of q.answer) {
          const counted = answerWords(answer, group.limit?.number ?? false);
          if (counted.words > (group.limit?.words ?? 0) || counted.numbers > 1) problems.push(`${where}: "${answer}" is over the word limit`);
        }
        if (q.answer[0] && q.evidence && !fold(q.evidence).includes(fold(q.answer[0]))) problems.push(`${where}: answer "${q.answer[0]}" is not in its evidence`);
      }
      if (!q.evidence?.trim()) {
        problems.push(`${where}: no evidence`);
        continue;
      }
      const heard = findHeard(part.turns, q.evidence, last ? {turn: last.turn, end: last.end} : undefined);
      if (!heard) {
        problems.push(findHeard(part.turns, q.evidence) ? `${where}: out of the recording's order` : `${where}: evidence is not in the recording`);
        continue;
      }
      if (blockStart !== null && q === group.questions[0] && heard.turn === blockStart) problems.push(`${where}: a new block begins in the turn where the previous block ends`);
      if (last) {
        const lastWords = last.wordsBefore + countWords(fold(part.turns[last.turn].text).slice(last.start, last.end));
        if (heard.wordsBefore - lastWords < LISTENING_FORMAT.gapWords) problems.push(`${where}: fewer than ${LISTENING_FORMAT.gapWords} words after the previous answer`);
      }
      last = heard;
    }
  }
  return problems;
}

/**
 * Problems of an assembled part (P7.6 §5.4, §8): the segments run end to end from 0, every turn is heard once and in order,
 * each block of questions (listeningBlocks) has its reading pause, the part ends with the checking pause, and two answers are at least
 * `gapMs` apart. The position of a quote inside a turn is estimated by its share of the turn's characters.
 */
export function checkListeningAudio(part: ListeningPart): string[] {
  const audio = part.audio;
  if (!audio) return ['no audio'];
  const problems: string[] = [];
  let at = 0;
  for (const [i, s] of audio.segments.entries()) {
    if (s.startMs !== at || s.endMs <= s.startMs) problems.push(`segment ${i + 1}: does not follow the previous one`);
    at = s.endMs;
  }
  if (at !== audio.durationMs) problems.push(`segments end at ${at} ms, the file at ${audio.durationMs} ms`);
  const turns = audio.segments.flatMap(s => s.kind === 'turn' ? [s] : []);
  if (turns.map(s => s.turn).join(',') !== part.turns.map((_, i) => i).join(',')) problems.push('turns are missing, repeated or out of order');
  for (const s of turns) {
    const speaker = part.turns[s.turn]?.speaker;
    if (speaker && !audio.voices[speaker]) problems.push(`turn ${s.turn + 1}: speaker ${speaker} has no voice`);
  }
  if (!audio.voices.narrator) problems.push('the narrator has no voice');
  const reads = audio.segments.flatMap(s => s.kind === 'pause' && s.purpose === 'read' ? [s.questions?.join('-')] : []);
  const blocks = listeningBlocks(part).map(b => `${b.from}-${b.to}`);
  if (reads.join(',') !== blocks.join(',')) problems.push(`reading pauses ${reads.join(', ') || 'none'}, blocks ${blocks.join(', ')}`);
  const end = audio.segments.at(-1);
  if (!(end?.kind === 'pause' && end.purpose === 'check')) problems.push('the part does not end with the checking pause');

  const time = new Map(turns.map(s => [s.turn, s]));
  let last: number | null = null;
  let from: {turn: number; end: number} | undefined;
  for (const q of part.groups.flatMap(g => g.questions)) {
    const heard = findHeard(part.turns, q.evidence, from);
    const seg = heard && time.get(heard.turn);
    if (!heard || !seg) continue;
    from = {turn: heard.turn, end: heard.end};
    // Shares in code points, as in PHP.
    const text = fold(part.turns[heard.turn].text);
    const length = Math.max(1, [...text].length);
    const startMs = seg.startMs + (seg.endMs - seg.startMs) * [...text.slice(0, heard.start)].length / length;
    const endMs = seg.startMs + (seg.endMs - seg.startMs) * [...text.slice(0, heard.end)].length / length;
    if (last !== null && startMs - last < LISTENING_FORMAT.gapMs) problems.push(`question ${q.numbers.join('-')}: ${Math.round(startMs - last)} ms after the previous answer`);
    last = endMs;
  }
  return problems;
}

/** Problems of a whole test: four parts of ten questions, numbered 1-40, a mix of accents. */
export function checkListeningTest(test: ListeningTest): string[] {
  const f = LISTENING_FORMAT;
  const problems = test.parts.flatMap((p, i) => checkListeningPart(p, i).map(x => `part ${i + 1}: ${x}`));
  if (test.parts.length !== f.parts) problems.push(`${test.parts.length} parts, not ${f.parts}`);
  test.parts.forEach((p, i) => {
    const numbers = p.groups.flatMap(g => g.questions.flatMap(q => q.numbers));
    const expected = Array.from({length: f.questionsPerPart}, (_, k) => i * f.questionsPerPart + k + 1);
    if (numbers.join(',') !== expected.join(',')) problems.push(`part ${i + 1}: questions must be ${expected[0]}-${expected.at(-1)}`);
    if (p.audio) problems.push(...checkListeningAudio(p).map(x => `part ${i + 1}, audio: ${x}`));
  });
  const accents = new Set(test.parts.flatMap(p => p.speakers.map(s => s.accent)));
  if (test.parts.length === f.parts && accents.size < 2) problems.push('all speakers have the same accent');
  return problems;
}
