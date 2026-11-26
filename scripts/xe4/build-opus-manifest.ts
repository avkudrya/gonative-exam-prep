/**
 * XE-4 (docs/phase-4/P4.12-xe4-explanations.md): the Opus re-review of the explanations WG's bank revision rv1 hides. rv1 gives
 * modal-ability-permission and modal-verbs a new spec version (the explanation fingerprint includes the topic's latest servable spec),
 * edits one option of three items and relabels 23 (cefr only). One step, Opus only: every item of the 539 already has en / ru / uk texts
 * reviewed against the previous spec, so Opus keeps them or writes new ones; the three edited items have no texts, so Opus writes them.
 * XE-3.2's settings (medium effort, 20 items per request by topic, max_tokens 1 500 + 600 per item, at most 12 000). No pilot.
 *
 * Built before rv1 is applied: the production export (tmp/xe4/items.json, topics.json) plus rv1's after state from its pinned bundle —
 * the edited payloads and hashes, the new cefr, and the new specs in the view ReferenceBuilder::spec() gives. That expected after state is
 * written to tmp/xe4/after-{items,topics}.json; check-after.py compares it with an export taken after rv1 before anything is sent.
 * Sends nothing.
 *
 * usage: node --import tsx scripts/xe4/build-opus-manifest.ts <multiadmin>
 * out:   tmp/xe4/opus-requests.jsonl, tmp/xe4/after-{items,topics}.json (bank content, not in Git), docs/phase-4/xe4/opus-manifest.json
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
// XE-1.2b measured ≈ 231 output tokens per item at these settings; XE-3.2 (fix rate 32 %) about the same.
const EXPECTED_OUTPUT_PER_ITEM = 260;
const RV1_SHA = 'd3e711987cf0a1610dc207271983be0081185e3a206b11160b52e99033b92ea6';
// ReferenceBuilder::SPEC_REVIEW_ONLY and ::GROUNDING.
const REVIEW_ONLY = ['format', 'coverage_notes', 'terminology'];
const GROUNDING = ['source_quote', 'added'];

type Payload = Record<string, any>;
type Item = {id: number; type: string; cefr: string; topic: string; payload: Payload; content_hash: string; provenance: string;
  explanations?: Record<string, {text: string; provenance: string}>};

const NOTHING = '(nothing: the gap stays empty)';
const ma = (process.argv[2] ?? '').replace(/\/$/, '');
if (!ma) throw new Error('usage: build-opus-manifest.ts <multiadmin>');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const rv1Raw = readFileSync(`${ma}/resources/data/edu/bank-revision-v1.json`, 'utf8');
if (sha(rv1Raw) !== RV1_SHA) throw new Error('rv1 bundle differs from its pin');
const rv1 = JSON.parse(rv1Raw);
const scope = read('docs/phase-4/xe4/scope.json');
if (scope.rv1_bundle_sha256 !== RV1_SHA) throw new Error('scope is for another rv1 bundle');
const exported = read('tmp/xe4/items.json');
const prompt = readFileSync('scripts/xe4/prompts/opus-review.md', 'utf8');

// rv1's after state.
const updates = new Map<number, any>(rv1.item_updates.map((u: any) => [u.id, u]));
const relabels = new Map<number, string>(rv1.item_relabels.map((r: any) => [r.id, r.cefr_after]));
const edited = new Set<number>(scope.edited.map((e: any) => e.id));
const items: Item[] = exported.items.map((i: Item) => {
  const u = updates.get(i.id);
  if (u && i.content_hash !== u.before_hash && i.content_hash !== u.after_hash) throw new Error(`unexpected hash ${i.id}`);
  return {...i, ...(u ? {payload: u.after_payload, content_hash: u.after_hash} : {}), ...(relabels.has(i.id) ? {cefr: relabels.get(i.id)!} : {})};
});
const strip = (spec: Record<string, any>) => Object.fromEntries(Object.entries(spec).filter(([k]) => !REVIEW_ONLY.includes(k)).map(([k, v]) =>
  [k, Array.isArray(v) ? v.map(e => (e && typeof e === 'object' && !Array.isArray(e) ? Object.fromEntries(Object.entries(e).filter(([f]) => !GROUNDING.includes(f))) : e)) : v]));
const specUpdates = new Map<string, any>(rv1.spec_updates.map((s: any) => [s.slug, s]));
const topicList = read('tmp/xe4/topics.json').topics.map((t: any) => {
  const s = specUpdates.get(t.slug);
  if (!s) return t;
  if (t.spec?.version !== s.before_version && t.spec?.version !== s.before_version + 1) throw new Error(`unexpected spec version ${t.slug}`);
  return {...t, spec: {version: s.before_version + 1, spec: strip(s.after_spec)}, change_note: s.reason};
});
const topics = new Map<string, any>(topicList.map((t: any) => [t.slug, t]));
writeFileSync('tmp/xe4/after-items.json', JSON.stringify({format: 'xe4-after-items/1', rv1_bundle_sha256: RV1_SHA, items}, null, 1));
writeFileSync('tmp/xe4/after-topics.json', JSON.stringify({format: 'xe4-after-topics/1', rv1_bundle_sha256: RV1_SHA, topics: topicList}, null, 1));

/** The item as the model sees it: the task, the choices, the key — never the internal option ids. */
function view(item: Item) {
  const p = item.payload;
  const ex = item.explanations ?? {};
  const teacher = ex.ru?.provenance === 'imported:mnemonic' ? ex.ru.text : null;
  const base = {id: item.id, type: item.type, cefr: item.cefr};
  const current = ex.en && ex.ru && ex.uk ? {en: ex.en.text, ru: ex.ru.text, uk: ex.uk.text} : null;
  const extra = {teacher_ru: teacher, current, why: edited.has(item.id) ? 'item_changed' : 'spec_changed'};
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
    required: ['id', 'key_ok', 'key_reason', 'accepted_missing', 'action', 'teacher_ru_ok', 'current_correct', 'problem', 'en', 'ru', 'uk'],
    properties: {
      id: {type: 'integer'},
      key_ok: {type: 'boolean'},
      key_reason: {type: 'string'},
      accepted_missing: {type: 'array', items: {type: 'string'}},
      action: {type: 'string', enum: ['keep', 'fix', 'reject']},
      teacher_ru_ok: {type: 'string', enum: ['ok', 'wrong', 'none']},
      current_correct: {type: 'boolean'},
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
  const note = topic.change_note ? `What changed in this version: ${topic.change_note}` : 'This specification did not change; the items were edited.';
  const spec = `Topic: ${slug} (CEFR ${topic.cefr.join('-')}), specification version ${topic.spec.version}:\n${JSON.stringify(topic.spec.spec)}\n\n${note}`;
  for (let i = 0; i < group.length; i += CHUNK) {
    const chunk = group.slice(i, i + CHUNK);
    const custom_id = `xe4o-${slug}-${String(i / CHUNK + 1).padStart(2, '0')}`.slice(0, 64);
    const body = `Items (${chunk.length}):\n${JSON.stringify(chunk.map(view))}`;
    const params = {model: MODEL, max_tokens: capOf(chunk.length), thinking: {type: 'adaptive'}, output_config: {effort: EFFORT, format: {type: 'json_schema', schema}},
      system: prompt, messages: [{role: 'user', content: [{type: 'text', text: spec}, {type: 'text', text: body}]}]};
    lines.push(JSON.stringify({custom_id, params}));
    const tally: Record<string, number> = {};
    for (const x of chunk) { const w = edited.has(x.id) ? 'item_changed' : 'spec_changed'; tally[w] = (tally[w] ?? 0) + 1; }
    requests.push({custom_id, topic: slug, items: chunk.map(x => x.id), types: [...new Set(chunk.map(x => x.type))].sort(), why: tally, max_tokens: capOf(chunk.length),
      approx_input_tokens: Math.ceil((prompt.length + spec.length + body.length + JSON.stringify(schema).length) / CHARS_PER_TOKEN)});
  }
}

const jsonl = lines.join('\n') + '\n';
writeFileSync('tmp/xe4/opus-requests.jsonl', jsonl);
const n = requests.reduce((s, r) => s + r.items.length, 0);
const approxIn = requests.reduce((s, r) => s + r.approx_input_tokens, 0);
const worstOut = requests.reduce((s, r) => s + r.max_tokens, 0);
const usd = (tokens: number, price: number) => tokens / 1e6 * price;
const whyAll: Record<string, number> = {};
for (const r of requests) for (const [k, v] of Object.entries(r.why)) whyAll[k] = (whyAll[k] ?? 0) + v;
const manifest = {
  format: 'xe4-opus-manifest/1', step: 'XE-4 (Opus re-review)', model: MODEL, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: 'per request', chunk: CHUNK,
  no_pilot: true, rv1_bundle_sha256: RV1_SHA, export: {exported_at: exported.exported_at, edited_state: exported.edited_state, spec_versions_now: exported.spec_versions_now},
  prompt_sha256: sha(prompt), requests_sha256: sha(jsonl), requests_file: 'tmp/xe4/opus-requests.jsonl',
  scope: {items: n, requests: requests.length, why: whyAll},
  price_usd_per_mtok: PRICE,
  estimate: {note: 'Input approximated at 3 characters per token; replaced by count_tokens before the owner is asked.', approx_input_tokens: approxIn,
    expected_output_tokens: n * EXPECTED_OUTPUT_PER_ITEM, worst_output_tokens: worstOut,
    expected_usd: +(usd(approxIn, PRICE.input) + usd(n * EXPECTED_OUTPUT_PER_ITEM, PRICE.output)).toFixed(4),
    worst_usd: +(usd(approxIn, PRICE.input) + usd(worstOut, PRICE.output)).toFixed(4)},
  requests,
};
writeFileSync('docs/phase-4/xe4/opus-manifest.json', JSON.stringify(manifest, null, 1) + '\n');
console.log(JSON.stringify({...manifest, requests: requests.length}, null, 1));
