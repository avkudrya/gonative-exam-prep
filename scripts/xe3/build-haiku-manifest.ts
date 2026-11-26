/**
 * XE-3.1 (docs/phase-4/P4.11-xe3-explanations.md): XE-2's Haiku request builder for the XE-3 items (WG's repaired items and the XE-1
 * items whose gap may also stay empty). The same model, effort and chunks by topic; the gap_fill view carries `empty_ok` (XE-2.2b);
 * max_tokens per request is 2 000 + 2 500 per item (XE-1 / XE-2 measured at most 2 000 per item, 643 requests), at most 32 000.
 * No pilot: a small run with the settings of the reviewed XE-2.1. #422 (teacher typo) is fixed without AI. Sends nothing.
 *
 * usage: node --import tsx scripts/xe3/build-haiku-manifest.ts
 * in:  tmp/xe3/{items,topics,inventory}.json, docs/phase-4/xe3/scope.json, scripts/xe3/prompts/haiku-review.md
 * out: tmp/xe3/haiku-requests.jsonl (bank content, not in Git), docs/phase-4/xe3/haiku-manifest.json
 */
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const MODEL = 'claude-haiku-5-5';
const CHUNK = 20;
const MAX_TOKENS = 32000;
const capOf = (n: number) => Math.min(MAX_TOKENS, 2000 + 2500 * n);
const EFFORT = 'high';
// Batches: 50 % of the list price ($0.10 / $0.50 per MTok for prompts up to 100K tokens).
const PRICE = {input: 0.05, output: 0.25};
// Planning only; the exact input comes from count_tokens before submission.
const CHARS_PER_TOKEN = 3;
const EXPECTED_OUTPUT_PER_ITEM = 700; // ~250 visible (en + ru + uk + JSON) + thinking at high effort

type Payload = Record<string, any>;
type Item = {id: number; type: string; cefr: string; topic: string; payload: Payload; provenance: string; explanations?: Record<string, {text: string; provenance: string}>};

const NOTHING = '(nothing: the gap stays empty)';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const typo = new Set<number>(read('docs/phase-4/xe3/scope.json').typo_fix.map((t: any) => t.id));
const items: Item[] = read('tmp/xe3/items.json').items.filter((i: Item) => !typo.has(i.id));
const topics = new Map<string, any>(read('tmp/xe3/topics.json').topics.map((t: any) => [t.slug, t]));
const inventory = new Map<number, any>(read('tmp/xe3/inventory.json').items.map((r: any) => [r.id, r]));
const prompt = readFileSync('scripts/xe3/prompts/haiku-review.md', 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** The item as the model sees it: the task, the choices, the key — never the internal option ids. */
function view(item: Item) {
  const p = item.payload;
  const inv = inventory.get(item.id);
  const teacher = item.explanations?.ru?.provenance === 'imported:mnemonic' ? item.explanations.ru.text : null;
  const base = {id: item.id, type: item.type, cefr: item.cefr};
  const extra = {draft: inv?.draft ?? null, ru_original: teacher};
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
    required: ['id', 'key_ok', 'verdict', 'reason', 'ru_original', 'en', 'ru', 'uk'],
    properties: {
      id: {type: 'integer'},
      key_ok: {type: 'boolean'},
      verdict: {type: 'string', enum: ['ok', 'fixed', 'written', 'reject']},
      reason: {type: 'string'},
      ru_original: {type: 'string', enum: ['ok', 'wrong', 'none']},
      en: {type: 'string'}, ru: {type: 'string'}, uk: {type: 'string'},
    },
  }}},
};

const byId = new Map<number, Item>(items.map(i => [i.id, i]));
const byTopic = new Map<string, Item[]>();
for (const item of [...items].sort((a, b) => a.id - b.id)) {
  byTopic.set(item.topic, [...(byTopic.get(item.topic) ?? []), item]);
}

const lines: string[] = [];
const requests: {custom_id: string; topic: string; items: number[]; max_tokens: number; approx_input_tokens: number}[] = [];
for (const [slug, group] of [...byTopic.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const topic = topics.get(slug);
  if (!topic?.spec) throw new Error(`no specification for ${slug}`);
  const spec = `Topic: ${slug} (CEFR ${topic.cefr.join('-')}), specification version ${topic.spec.version}:\n${JSON.stringify(topic.spec.spec)}`;
  for (let i = 0; i < group.length; i += CHUNK) {
    const chunk = group.slice(i, i + CHUNK);
    const custom_id = `xe3h-${slug}-${String(i / CHUNK + 1).padStart(2, '0')}`.slice(0, 64);
    const body = `Items (${chunk.length}):\n${JSON.stringify(chunk.map(view))}`;
    const params = {
      model: MODEL, max_tokens: capOf(chunk.length), thinking: {type: 'adaptive'},
      output_config: {effort: EFFORT, format: {type: 'json_schema', schema}},
      system: prompt,
      messages: [{role: 'user', content: [{type: 'text', text: spec}, {type: 'text', text: body}]}],
    };
    const line = JSON.stringify({custom_id, params});
    lines.push(line);
    requests.push({custom_id, topic: slug, items: chunk.map(x => x.id), max_tokens: capOf(chunk.length), approx_input_tokens: Math.ceil((prompt.length + spec.length + body.length + JSON.stringify(schema).length) / CHARS_PER_TOKEN)});
  }
}

const jsonl = lines.join('\n') + '\n';
writeFileSync('tmp/xe3/haiku-requests.jsonl', jsonl);
const approxIn = requests.reduce((s, r) => s + r.approx_input_tokens, 0);
const usd = (tokens: number, price: number) => Math.round(tokens / 1e6 * price * 1e4) / 1e4;
const expectedOut = items.length * EXPECTED_OUTPUT_PER_ITEM;
const worstOut = requests.reduce((s, r) => s + r.max_tokens, 0);
const manifest = {
  format: 'xe3-haiku-manifest/1', step: 'XE-3.1', model: MODEL, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: 'per request',
  no_pilot: true,
  chunk: CHUNK, prompt_sha256: sha(prompt), requests_sha256: sha(jsonl), requests_file: 'tmp/xe3/haiku-requests.jsonl',
  scope: {items: items.length, requests: requests.length, topics: byTopic.size,
    with_draft: items.filter(i => inventory.get(i.id)?.draft).length, empty_ok: items.filter(i => i.type === 'gap_fill' && i.payload.gaps.some((g: any) => g.allow_empty && g.accepted.length)).length, teacher_ru: items.filter(i => i.explanations?.ru?.provenance === 'imported:mnemonic').length},
  price_usd_per_mtok: PRICE,
  estimate: {
    note: 'Input approximated at 3 characters per token; replaced by count_tokens before the owner is asked.',
    approx_input_tokens: approxIn, expected_output_tokens: expectedOut, worst_output_tokens: worstOut,
    expected_usd: +(usd(approxIn, PRICE.input) + usd(expectedOut, PRICE.output)).toFixed(4),
    worst_usd: +(usd(approxIn, PRICE.input) + usd(worstOut, PRICE.output)).toFixed(4),
  },
  requests,
};
mkdirSync('docs/phase-4/xe3', {recursive: true});
writeFileSync('docs/phase-4/xe3/haiku-manifest.json', JSON.stringify(manifest, null, 1) + '\n');

console.log(JSON.stringify({...manifest, requests: `${requests.length} (see the file)`}, null, 1));
