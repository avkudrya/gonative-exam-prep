/**
 * XE-3.2 (docs/phase-4/P4.11-xe3-explanations.md): the Opus review of every XE-3 item, after Haiku (XE-3.1). XE-2.2's settings — medium
 * effort, 20 items per request by topic, `why` from the first pass — with the gap_fill view carrying `empty_ok` for every gap that has an
 * answer and may also stay empty, and max_tokens per request 1 500 + 600 per item, at most 12 000 (XE-1 / XE-2 measured at most
 * 500 per item + 236 over 673 requests). No pilot: the settings of the reviewed XE-2.2. Sends nothing.
 *
 * usage: node --import tsx scripts/xe3/build-opus-manifest.ts
 * in:  tmp/xe3/haiku-requests.jsonl, tmp/xe3/haiku-checked.json, tmp/xe3/{items,topics}.json, scripts/xe3/prompts/opus-review.md
 * out: tmp/xe3/opus-requests.jsonl, docs/phase-4/xe3/opus-manifest.json
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const MODEL = 'claude-opus-5-5';
const CHUNK = 20;
const MAX_TOKENS = 12000;
const capOf = (n: number) => Math.min(MAX_TOKENS, 1500 + 600 * n);
const EFFORT = 'medium';
// Batches: 50 % of the list price ($4 / $20 per MTok).
const PRICE = {input: 2, output: 10};
const CHARS_PER_TOKEN = 3;
// XE-1.2b measured ≈ 231 output tokens per item at these settings (at most 8 411 per request).
const EXPECTED_OUTPUT_PER_ITEM = 260;
const FIX_FLAGS = new Set(['en_key_not_named', 'ru_empty', 'ru_too_long', 'uk_too_long', 'en_too_long', 'en_empty', 'uk_empty',
  'written_despite_draft', 'uk_looks_russian', 'en_has_cyrillic', 'ru_not_cyrillic', 'key_not_ok_but_explained', 'reject_with_text', 'ok_without_draft']);

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const prompt = readFileSync('scripts/xe3/prompts/opus-review.md', 'utf8');
const topics = new Map<string, any>(read('tmp/xe3/topics.json').topics.map((t: any) => [t.slug, t]));
const checked = new Map<number, any>(read('tmp/xe3/haiku-checked.json').items.map((r: any) => [r.id, r]));
const raw = new Map<number, any>(read('tmp/xe3/items.json').items.map((i: any) => [i.id, i]));

// The item views the first pass saw, with their topic.
const views = new Map<number, {topic: string; view: any}>();
for (const line of readFileSync('tmp/xe3/haiku-requests.jsonl', 'utf8').trim().split('\n')) {
  const r = JSON.parse(line);
  const topic = r.custom_id.replace(/^xe3h-/, '').replace(/-\d+$/, '');
  for (const v of JSON.parse(r.params.messages[0].content[1].text.split('\n').slice(1).join('\n'))) views.set(v.id, {topic, view: v});
}

function why(id: number): string[] {
  const c = checked.get(id);
  if (!c) return ['missing'];
  const out: string[] = [];
  if (c.verdict === 'reject') out.push('reject');
  if (c.ru_original === 'wrong' || c.flags.includes('teacher_ru_not_judged')) out.push('teacher');
  if (c.flags.some((f: string) => FIX_FLAGS.has(f))) out.push('rewrite');
  return out.length ? out : ['check'];
}

function opusView(id: number) {
  const {view} = views.get(id)!;
  const {draft, ru_original, ...task} = view;
  const item = raw.get(id);
  if (item.type === 'gap_fill') {
    task.key = task.key.map((k: any, n: number) => (item.payload.gaps[n]?.allow_empty && item.payload.gaps[n]?.accepted.length ? {...k, empty_ok: true} : k));
  }
  const c = checked.get(id);
  return {...task, teacher_ru: ru_original, why: why(id),
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

const scope = [...views.keys()];
const byTopic = new Map<string, number[]>();
for (const id of [...scope].sort((a, b) => a - b)) {
  const t = views.get(id)!.topic;
  byTopic.set(t, [...(byTopic.get(t) ?? []), id]);
}
const lines: string[] = [];
const requests: {custom_id: string; topic: string; items: number[]; types: string[]; why: Record<string, number>; max_tokens: number; approx_input_tokens: number}[] = [];
for (const [slug, ids] of [...byTopic.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const topic = topics.get(slug);
  const spec = `Topic: ${slug} (CEFR ${topic.cefr.join('-')}), specification version ${topic.spec.version}:\n${JSON.stringify(topic.spec.spec)}`;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const custom_id = `xe3o-${slug}-${String(i / CHUNK + 1).padStart(2, '0')}`.slice(0, 64);
    const body = `Items (${chunk.length}):\n${JSON.stringify(chunk.map(opusView))}`;
    const params = {model: MODEL, max_tokens: capOf(chunk.length), thinking: {type: 'adaptive'}, output_config: {effort: EFFORT, format: {type: 'json_schema', schema}},
      system: prompt, messages: [{role: 'user', content: [{type: 'text', text: spec}, {type: 'text', text: body}]}]};
    lines.push(JSON.stringify({custom_id, params}));
    const tally: Record<string, number> = {};
    for (const id of chunk) for (const w of why(id)) tally[w] = (tally[w] ?? 0) + 1;
    requests.push({custom_id, topic: slug, items: chunk, max_tokens: capOf(chunk.length), types: [...new Set(chunk.map(id => views.get(id)!.view.type as string))].sort(), why: tally,
      approx_input_tokens: Math.ceil((prompt.length + spec.length + body.length + JSON.stringify(schema).length) / CHARS_PER_TOKEN)});
  }
}

const usd = (tokens: number, price: number) => tokens / 1e6 * price;
function manifestOf(step: string, file: string, reqLines: string[], reqs: typeof requests, extra: object = {}) {
  const jsonl = reqLines.join('\n') + '\n';
  writeFileSync(file, jsonl);
  const items = reqs.reduce((s, r) => s + r.items.length, 0);
  const approxIn = reqs.reduce((s, r) => s + r.approx_input_tokens, 0);
  const whyAll: Record<string, number> = {};
  for (const r of reqs) for (const [k, v] of Object.entries(r.why)) whyAll[k] = (whyAll[k] ?? 0) + v;
  return {
    format: 'xe3-opus-manifest/1', step, model: MODEL, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: 'per request', chunk: CHUNK,
    prompt_sha256: sha(prompt), requests_sha256: sha(jsonl), requests_file: file, ...extra,
    scope: {items, requests: reqs.length, why: whyAll},
    price_usd_per_mtok: PRICE,
    estimate: {note: 'Input approximated at 3 characters per token; replaced by count_tokens before the owner is asked.', approx_input_tokens: approxIn,
      expected_output_tokens: items * EXPECTED_OUTPUT_PER_ITEM, worst_output_tokens: reqs.reduce((s, r) => s + r.max_tokens, 0),
      expected_usd: +(usd(approxIn, PRICE.input) + usd(items * EXPECTED_OUTPUT_PER_ITEM, PRICE.output)).toFixed(4),
      worst_usd: +(usd(approxIn, PRICE.input) + usd(reqs.reduce((s, r) => s + r.max_tokens, 0), PRICE.output)).toFixed(4)},
    requests: reqs,
  };
}

const full = manifestOf('XE-3.2', 'tmp/xe3/opus-requests.jsonl', lines, requests, {no_pilot: true, after: 'XE-3.1 (haiku-manifest.json)'});
writeFileSync('docs/phase-4/xe3/opus-manifest.json', JSON.stringify(full, null, 1) + '\n');
console.log(JSON.stringify({...full, requests: full.requests.length}, null, 1));
