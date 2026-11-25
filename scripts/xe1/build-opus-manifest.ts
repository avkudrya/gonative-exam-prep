/**
 * XE-1.2 (docs/phase-4/P4.9-xe1-explanations.md): the Opus review of wave 1. Sends nothing.
 * Every item the first pass could not settle (rejects, teacher texts judged wrong or not judged, texts failing our checks, items
 * without a result) plus a stratified sample of clean results, which measures the first pass's error rate.
 *
 * usage: node --import tsx scripts/xe1/build-opus-manifest.ts
 * in:  tmp/xe1/haiku-requests.jsonl, tmp/xe1/haiku-checked.json, tmp/xe1/topics.json, scripts/xe1/prompts/opus-review.md
 * out: tmp/xe1/opus-requests.jsonl, tmp/xe1/opus-pilot-requests.jsonl, docs/phase-4/xe1/opus-manifest.json, opus-pilot-manifest.json
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const MODEL = 'claude-opus-5-5';
const CHUNK = 20;
const MAX_TOKENS = 16000;
const EFFORT = 'medium';
const SAMPLE_TARGET = 700;
// Batches: 50 % of the list price ($4 / $20 per MTok).
const PRICE = {input: 2, output: 10};
const CHARS_PER_TOKEN = 3;
const EXPECTED_OUTPUT_PER_ITEM = 500; // planning only; calibrated by the pilot
const FIX_FLAGS = new Set(['en_key_not_named', 'ru_empty', 'ru_too_long', 'uk_too_long', 'en_too_long', 'en_empty', 'uk_empty',
  'written_despite_draft', 'uk_looks_russian', 'en_has_cyrillic', 'ru_not_cyrillic', 'key_not_ok_but_explained', 'reject_with_text', 'ok_without_draft']);

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const prompt = readFileSync('scripts/xe1/prompts/opus-review.md', 'utf8');
const topics = new Map<string, any>(read('tmp/xe1/topics.json').topics.map((t: any) => [t.slug, t]));
const checked = new Map<number, any>(read('tmp/xe1/haiku-checked.json').items.map((r: any) => [r.id, r]));

// The item views the first pass saw, with their topic.
const views = new Map<number, {topic: string; view: any}>();
for (const line of readFileSync('tmp/xe1/haiku-requests.jsonl', 'utf8').trim().split('\n')) {
  const r = JSON.parse(line);
  const topic = r.custom_id.replace(/^xe1h-/, '').replace(/-\d+$/, '');
  for (const v of JSON.parse(r.params.messages[0].content[1].text.split('\n').slice(1).join('\n'))) views.set(v.id, {topic, view: v});
}

function why(id: number): string[] {
  const c = checked.get(id);
  if (!c) return ['missing'];
  const out: string[] = [];
  if (c.verdict === 'reject') out.push('reject');
  if (c.ru_original === 'wrong' || c.flags.includes('teacher_ru_not_judged')) out.push('teacher');
  if (c.flags.some((f: string) => FIX_FLAGS.has(f))) out.push('rewrite');
  return out;
}

const selected = new Map<number, string[]>();
for (const id of views.keys()) {
  const w = why(id);
  if (w.length) selected.set(id, w);
}
// Stratified sample of clean results: per topic and type, in a fixed pseudo-random order (sha256 of the id).
const clean = [...views.keys()].filter(id => !selected.has(id));
const rate = SAMPLE_TARGET / clean.length;
const cells = new Map<string, number[]>();
for (const id of clean) {
  const key = `${views.get(id)!.topic}|${views.get(id)!.view.type}`;
  cells.set(key, [...(cells.get(key) ?? []), id]);
}
for (const ids of cells.values()) {
  const take = Math.max(1, Math.round(ids.length * rate));
  for (const id of [...ids].sort((a, b) => sha(String(a)).localeCompare(sha(String(b)))).slice(0, take)) selected.set(id, ['sample']);
}

function opusView(id: number, reasons: string[]) {
  const {view} = views.get(id)!;
  const {draft, ru_original, ...task} = view;
  const c = checked.get(id);
  return {...task, teacher_ru: ru_original, why: reasons,
    first: c ? {key_ok: c.key_ok, verdict: c.verdict, reason: c.reason, teacher_ru: c.ru_original, en: c.en, ru: c.ru, uk: c.uk} : null};
}

const schema = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: {results: {type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['id', 'key_ok', 'key_reason', 'accepted_missing', 'action', 'teacher_ru_ok', 'first_correct', 'problem', 'en', 'ru', 'uk'],
    properties: {
      id: {type: 'integer'},
      key_ok: {type: 'boolean'},
      key_reason: {type: 'string'},
      accepted_missing: {type: 'array', items: {type: 'string'}},
      action: {type: 'string', enum: ['keep', 'fix', 'reject']},
      teacher_ru_ok: {type: 'string', enum: ['ok', 'wrong', 'none']},
      first_correct: {type: 'boolean'},
      problem: {type: 'string'},
      en: {type: 'string'}, ru: {type: 'string'}, uk: {type: 'string'},
    },
  }}},
};

const byTopic = new Map<string, number[]>();
for (const id of [...selected.keys()].sort((a, b) => a - b)) {
  const t = views.get(id)!.topic;
  byTopic.set(t, [...(byTopic.get(t) ?? []), id]);
}
const lines: string[] = [];
const requests: {custom_id: string; topic: string; items: number[]; why: Record<string, number>; approx_input_tokens: number}[] = [];
for (const [slug, ids] of [...byTopic.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const topic = topics.get(slug);
  const spec = `Topic: ${slug} (CEFR ${topic.cefr.join('-')}), specification version ${topic.spec.version}:\n${JSON.stringify(topic.spec.spec)}`;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const custom_id = `xe1o-${slug}-${String(i / CHUNK + 1).padStart(2, '0')}`.slice(0, 64);
    const body = `Items (${chunk.length}):\n${JSON.stringify(chunk.map(id => opusView(id, selected.get(id)!)))}`;
    const params = {model: MODEL, max_tokens: MAX_TOKENS, thinking: {type: 'adaptive'}, output_config: {effort: EFFORT, format: {type: 'json_schema', schema}},
      system: prompt, messages: [{role: 'user', content: [{type: 'text', text: spec}, {type: 'text', text: body}]}]};
    lines.push(JSON.stringify({custom_id, params}));
    const tally: Record<string, number> = {};
    for (const id of chunk) for (const w of selected.get(id)!) tally[w] = (tally[w] ?? 0) + 1;
    requests.push({custom_id, topic: slug, items: chunk, why: tally, approx_input_tokens: Math.ceil((prompt.length + spec.length + body.length + JSON.stringify(schema).length) / CHARS_PER_TOKEN)});
  }
}

const usd = (tokens: number, price: number) => tokens / 1e6 * price;
function manifestOf(step: string, file: string, reqLines: string[], reqs: typeof requests, extra: object = {}) {
  const jsonl = reqLines.join('\n') + '\n';
  writeFileSync(file, jsonl);
  const items = reqs.reduce((s, r) => s + r.items.length, 0);
  const approxIn = reqs.reduce((s, r) => s + r.approx_input_tokens, 0);
  const why: Record<string, number> = {};
  for (const r of reqs) for (const [k, v] of Object.entries(r.why)) why[k] = (why[k] ?? 0) + v;
  return {
    format: 'xe1-opus-manifest/1', step, model: MODEL, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: MAX_TOKENS, chunk: CHUNK,
    prompt_sha256: sha(prompt), requests_sha256: sha(jsonl), requests_file: file, ...extra,
    scope: {items, requests: reqs.length, why, sample_of_clean: `${SAMPLE_TARGET} target of ${clean.length}`},
    price_usd_per_mtok: PRICE,
    estimate: {note: 'Input approximated at 3 characters per token; replaced by count_tokens before submission.', approx_input_tokens: approxIn,
      expected_output_tokens: items * EXPECTED_OUTPUT_PER_ITEM, worst_output_tokens: reqs.length * MAX_TOKENS,
      expected_usd: +(usd(approxIn, PRICE.input) + usd(items * EXPECTED_OUTPUT_PER_ITEM, PRICE.output)).toFixed(4),
      worst_usd: +(usd(approxIn, PRICE.input) + usd(reqs.length * MAX_TOKENS, PRICE.output)).toFixed(4)},
    requests: reqs,
  };
}

const full = manifestOf('XE-1.2', 'tmp/xe1/opus-requests.jsonl', lines, requests);
writeFileSync('docs/phase-4/xe1/opus-manifest.json', JSON.stringify(full, null, 1) + '\n');
// Pilot: the two requests with the most rejects and teacher texts, read by hand before the full run (same limit).
const pilotIds = [...requests].sort((a, b) => ((b.why.reject ?? 0) + (b.why.teacher ?? 0)) - ((a.why.reject ?? 0) + (a.why.teacher ?? 0))).slice(0, 2).map(r => r.custom_id);
const pilot = manifestOf('XE-1.2 pilot', 'tmp/xe1/opus-pilot-requests.jsonl', lines.filter(l => pilotIds.includes(JSON.parse(l).custom_id)),
  requests.filter(r => pilotIds.includes(r.custom_id)), {part_of: full.requests_sha256});
writeFileSync('docs/phase-4/xe1/opus-pilot-manifest.json', JSON.stringify(pilot, null, 1) + '\n');
console.log(JSON.stringify({full: {...full, requests: full.requests.length}, pilot: {...pilot, requests: pilotIds}}, null, 1));
