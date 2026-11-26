/**
 * XE-2.2 (docs/phase-4/P4.10-xe2-explanations.md): the Opus review of every wave-2 item (owner: Haiku + Opus on all). Sends nothing.
 * Settings as XE-1.2b (the XE-1 Opus run on all remaining items): medium effort, max_tokens 12 000, 20 items per request by topic.
 * `why` tells Opus what the first pass left open (reject, teacher, rewrite, missing) or `check` for a clean result.
 * Pilot: the first request holding each new type (error_correction, transformation, word_forms), read by hand before the full run.
 *
 * `rest` (XE-2.2b, opus2): the items without an Opus result — the ones Opus skipped and the items held back because a gap may also stay
 * empty (WG 2026-11-26: the first views did not show `allow_empty` next to an answer; they now carry `empty_ok`). 10 items per request.
 *
 * usage: node --import tsx scripts/xe2/build-opus-manifest.ts [rest]
 * in:  tmp/xe2/haiku-requests.jsonl, tmp/xe2/haiku-checked.json, tmp/xe2/topics.json, scripts/xe2/prompts/opus-review.md
 * out: tmp/xe2/opus-requests.jsonl, tmp/xe2/opus-pilot-requests.jsonl, docs/phase-4/xe2/opus-manifest.json, opus-pilot-manifest.json
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const MODEL = 'claude-opus-5-5';
const CHUNK = process.argv[2] === 'rest' ? 10 : 20;
const MAX_TOKENS = 12000;
const REST = process.argv[2] === 'rest';
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
const prompt = readFileSync('scripts/xe2/prompts/opus-review.md', 'utf8');
const topics = new Map<string, any>(read('tmp/xe2/topics.json').topics.map((t: any) => [t.slug, t]));
const checked = new Map<number, any>(read('tmp/xe2/haiku-checked.json').items.map((r: any) => [r.id, r]));
const raw = new Map<number, any>(read('tmp/xe2/items.json').items.map((i: any) => [i.id, i]));

// The item views the first pass saw, with their topic.
const views = new Map<number, {topic: string; view: any}>();
for (const line of readFileSync('tmp/xe2/haiku-requests.jsonl', 'utf8').trim().split('\n')) {
  const r = JSON.parse(line);
  const topic = r.custom_id.replace(/^xe2h-/, '').replace(/-\d+$/, '');
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
  if (REST && item.type === 'gap_fill') {
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

const scope = REST ? read('docs/phase-4/xe2/wg-handoff.json').not_reviewed_yet.map((r: any) => r.id as number) : [...views.keys()];
const byTopic = new Map<string, number[]>();
for (const id of [...scope].sort((a, b) => a - b)) {
  const t = views.get(id)!.topic;
  byTopic.set(t, [...(byTopic.get(t) ?? []), id]);
}
const lines: string[] = [];
const requests: {custom_id: string; topic: string; items: number[]; types: string[]; why: Record<string, number>; approx_input_tokens: number}[] = [];
for (const [slug, ids] of [...byTopic.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const topic = topics.get(slug);
  const spec = `Topic: ${slug} (CEFR ${topic.cefr.join('-')}), specification version ${topic.spec.version}:\n${JSON.stringify(topic.spec.spec)}`;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const custom_id = `${REST ? 'xe2p' : 'xe2o'}-${slug}-${String(i / CHUNK + 1).padStart(2, '0')}`.slice(0, 64);
    const body = `Items (${chunk.length}):\n${JSON.stringify(chunk.map(opusView))}`;
    const params = {model: MODEL, max_tokens: MAX_TOKENS, thinking: {type: 'adaptive'}, output_config: {effort: EFFORT, format: {type: 'json_schema', schema}},
      system: prompt, messages: [{role: 'user', content: [{type: 'text', text: spec}, {type: 'text', text: body}]}]};
    lines.push(JSON.stringify({custom_id, params}));
    const tally: Record<string, number> = {};
    for (const id of chunk) for (const w of why(id)) tally[w] = (tally[w] ?? 0) + 1;
    requests.push({custom_id, topic: slug, items: chunk, types: [...new Set(chunk.map(id => views.get(id)!.view.type as string))].sort(), why: tally,
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
    format: 'xe2-opus-manifest/1', step, model: MODEL, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: MAX_TOKENS, chunk: CHUNK,
    prompt_sha256: sha(prompt), requests_sha256: sha(jsonl), requests_file: file, ...extra,
    scope: {items, requests: reqs.length, why: whyAll},
    price_usd_per_mtok: PRICE,
    estimate: {note: 'Input approximated at 3 characters per token; replaced by count_tokens before the owner is asked.', approx_input_tokens: approxIn,
      expected_output_tokens: items * EXPECTED_OUTPUT_PER_ITEM, worst_output_tokens: reqs.length * MAX_TOKENS,
      expected_usd: +(usd(approxIn, PRICE.input) + usd(items * EXPECTED_OUTPUT_PER_ITEM, PRICE.output)).toFixed(4),
      worst_usd: +(usd(approxIn, PRICE.input) + usd(reqs.length * MAX_TOKENS, PRICE.output)).toFixed(4)},
    requests: reqs,
  };
}

if (REST) {
  // No pilot: the same settings as the reviewed XE-2.2 run.
  const rest = manifestOf('XE-2.2b', 'tmp/xe2/opus2-requests.jsonl', lines, requests, {no_pilot: true, after: 'XE-2.2 (opus-manifest.json)'});
  writeFileSync('docs/phase-4/xe2/opus2-manifest.json', JSON.stringify(rest, null, 1) + '\n');
  console.log(JSON.stringify({rest: {...rest, requests: rest.requests.length}}, null, 1));
  process.exit(0);
}
const full = manifestOf('XE-2.2', 'tmp/xe2/opus-requests.jsonl', lines, requests);
writeFileSync('docs/phase-4/xe2/opus-manifest.json', JSON.stringify(full, null, 1) + '\n');
const pilotIds = [...new Set(['error_correction', 'transformation', 'word_forms'].map(t => requests.find(r => r.types.includes(t))!.custom_id))];
const pilot = manifestOf('XE-2.2 pilot', 'tmp/xe2/opus-pilot-requests.jsonl', lines.filter(l => pilotIds.includes(JSON.parse(l).custom_id)),
  requests.filter(r => pilotIds.includes(r.custom_id)), {part_of: full.requests_sha256});
writeFileSync('docs/phase-4/xe2/opus-pilot-manifest.json', JSON.stringify(pilot, null, 1) + '\n');
console.log(JSON.stringify({full: {...full, requests: full.requests.length}, pilot: {...pilot, requests: pilotIds}}, null, 1));
