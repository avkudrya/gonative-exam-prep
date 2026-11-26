/**
 * XE-5 (docs/phase-4/P4.13-xe5-explanations.md): Opus 5.5 writes and checks the explanations of the 74 sentence-punctuation items
 * worksheet-generator inserted on 2026-11-26 (bank-ai/pb1; no explanation rows). One step, Opus only — the decider of every earlier
 * wave; a Haiku draft would save little on 74 items. XE-3.2 / XE-4 settings (medium effort, 20 items per request by topic, max_tokens
 * 1 500 + 600 per item, at most 12 000). No pilot. Sends nothing.
 *
 * usage: node --import tsx scripts/xe5/build-opus-manifest.ts
 * in:    tmp/xe5/{items,topics}.json (SELECT-only export), scripts/xe5/prompts/opus-review.md
 * out:   tmp/xe5/opus-requests.jsonl (bank content, not in Git), docs/phase-4/xe5/opus-manifest.json
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
const EXPECTED_OUTPUT_PER_ITEM = 500;
// Opus writes all three texts for every item (XE-4 fixes: ≈ 500 output tokens per item with thinking).
type Payload = Record<string, any>;
type Item = {id: number; type: string; cefr: string; topic: string; payload: Payload; content_hash: string; provenance: string;
  explanations?: Record<string, {text: string; provenance: string}>};

const NOTHING = '(nothing: the gap stays empty)';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const exported = read('tmp/xe5/items.json');
const items: Item[] = exported.items;
if (items.some(i => Object.keys(i.explanations ?? {}).length)) throw new Error('an item already has explanation rows');
const topics = new Map<string, any>(read('tmp/xe5/topics.json').topics.map((t: any) => [t.slug, t]));
const prompt = readFileSync('scripts/xe5/prompts/opus-review.md', 'utf8');

/** The item as the model sees it: the task, the choices, the key — never the internal option ids. */
function view(item: Item) {
  const p = item.payload;
  const base = {id: item.id, type: item.type, cefr: item.cefr};
  const extra = {};
  switch (item.type) {
    case 'multiple_choice': {
      const texts = new Map<string, string>(p.options.map((o: any) => [o.id, o.text]));
      // Imported items may have no question: the options are whole phrases or sentences to choose between.
      return {...base, task: p.stem ?? 'Choose the correct option.', options: p.options.map((o: any) => o.text), multi_select: Boolean(p.multi_select),
        key: p.correct.map((c: string) => texts.get(c)), ...extra};
    }
    case 'gap_choice':
      return {...base, task: p.text, options: p.gaps.map((g: any) => ({gap: g.id, options: g.options})), key: p.gaps.map((g: any) => ({gap: g.id, answer: g.correct})), ...extra};
    case 'gap_fill':
      // A gap that must stay empty (zero article, no 'to') has no accepted text: say so instead of an empty answer.
      // `empty_ok`: the gap has an answer and may also stay empty (the word is optional).
      return {...base, task: p.text, key: p.gaps.map((g: any) => (g.accepted.length
        ? {gap: g.id, answer: g.accepted[0], accepted: g.accepted.slice(1), ...(g.allow_empty ? {empty_ok: true} : {})}
        : {gap: g.id, answer: NOTHING, accepted: []})), ...extra};
    case 'ordering':
      return {...base, task: 'Put the words in order.', options: p.tokens, key: p.accepted[0], accepted: p.accepted.slice(1), ...extra};
    case 'error_correction': {
      const [e] = p.errors;
      return {...base, task: p.text, mistake: p.text.slice(e.span[0], e.span[1]), key: e.corrections[0], accepted: e.corrections.slice(1), ...extra};
    }
    case 'transformation':
      return {...base, task: p.source, instruction: String(p.task).replace(/_/g, ' '), constraint: p.constraint, key: p.accepted[0], accepted: p.accepted.slice(1), ...extra};
    case 'word_forms':
      return {...base, task: `Give the forms of '${p.base}': ${p.fields.map((f: any) => f.key.replace(/_/g, ' ')).join(', ')}.`, base: p.base,
        key: p.fields.map((f: any) => ({form: f.key.replace(/_/g, ' '), answer: f.accepted[0], accepted: f.accepted.slice(1)})), ...extra};
    default:
      throw new Error(`unexpected type ${item.type}`);
  }
}

const schema = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: {results: {type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['id', 'key_ok', 'key_reason', 'accepted_missing', 'action', 'problem', 'en', 'ru', 'uk'],
    properties: {
      id: {type: 'integer'},
      key_ok: {type: 'boolean'},
      key_reason: {type: 'string'},
      accepted_missing: {type: 'array', items: {type: 'string'}},
      action: {type: 'string', enum: ['write', 'reject']},
      problem: {type: 'string'},
      en: {type: 'string'}, ru: {type: 'string'}, uk: {type: 'string'},
    },
  }}},
};

const byTopic = new Map<string, Item[]>();
for (const item of [...items].sort((a, b) => a.id - b.id)) byTopic.set(item.topic, [...(byTopic.get(item.topic) ?? []), item]);
const lines: string[] = [];
const requests: {custom_id: string; topic: string; items: number[]; types: string[]; why: Record<string, number>; max_tokens: number; approx_input_tokens: number}[] = [];
for (const [slug, group] of [...byTopic.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const topic = topics.get(slug);
  if (!topic?.spec) throw new Error(`no specification for ${slug}`);
  const spec = `Topic: ${slug} (CEFR ${topic.cefr.join('-')}), specification version ${topic.spec.version}:\n${JSON.stringify(topic.spec.spec)}`;
  for (let i = 0; i < group.length; i += CHUNK) {
    const chunk = group.slice(i, i + CHUNK);
    const custom_id = `xe5o-${slug}-${String(i / CHUNK + 1).padStart(2, '0')}`.slice(0, 64);
    const body = `Items (${chunk.length}):\n${JSON.stringify(chunk.map(view))}`;
    const params = {model: MODEL, max_tokens: capOf(chunk.length), thinking: {type: 'adaptive'}, output_config: {effort: EFFORT, format: {type: 'json_schema', schema}},
      system: prompt, messages: [{role: 'user', content: [{type: 'text', text: spec}, {type: 'text', text: body}]}]};
    lines.push(JSON.stringify({custom_id, params}));
    const tally: Record<string, number> = {};
    for (const x of chunk) tally[x.type] = (tally[x.type] ?? 0) + 1;
    requests.push({custom_id, topic: slug, items: chunk.map(x => x.id), types: [...new Set(chunk.map(x => x.type))].sort(), why: tally, max_tokens: capOf(chunk.length),
      approx_input_tokens: Math.ceil((prompt.length + spec.length + body.length + JSON.stringify(schema).length) / CHARS_PER_TOKEN)});
  }
}

const jsonl = lines.join('\n') + '\n';
writeFileSync('tmp/xe5/opus-requests.jsonl', jsonl);
const n = requests.reduce((s, r) => s + r.items.length, 0);
const approxIn = requests.reduce((s, r) => s + r.approx_input_tokens, 0);
const worstOut = requests.reduce((s, r) => s + r.max_tokens, 0);
const usd = (tokens: number, price: number) => tokens / 1e6 * price;
const whyAll: Record<string, number> = {};
for (const r of requests) for (const [k, v] of Object.entries(r.why)) whyAll[k] = (whyAll[k] ?? 0) + v;
const manifest = {
  format: 'xe5-opus-manifest/1', step: 'XE-5 (Opus writes and checks)', model: MODEL, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: 'per request', chunk: CHUNK,
  no_pilot: true, export: {exported_at: exported.exported_at},
  prompt_sha256: sha(prompt), requests_sha256: sha(jsonl), requests_file: 'tmp/xe5/opus-requests.jsonl',
  scope: {items: n, requests: requests.length, why: whyAll},
  price_usd_per_mtok: PRICE,
  estimate: {note: 'Input approximated at 3 characters per token; replaced by count_tokens before the owner is asked.', approx_input_tokens: approxIn,
    expected_output_tokens: n * EXPECTED_OUTPUT_PER_ITEM, worst_output_tokens: worstOut,
    expected_usd: +(usd(approxIn, PRICE.input) + usd(n * EXPECTED_OUTPUT_PER_ITEM, PRICE.output)).toFixed(4),
    worst_usd: +(usd(approxIn, PRICE.input) + usd(worstOut, PRICE.output)).toFixed(4)},
  requests,
};
writeFileSync('docs/phase-4/xe5/opus-manifest.json', JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({...manifest, requests: requests.length}, null, 1));
