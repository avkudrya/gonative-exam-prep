/**
 * P4.14 measurement (docs/phase-4/P4.14-rewrite-check.md §3): the rewrite check on benchmarks/datasets/exam-rewrite-v1 (60 synthetic
 * cases from the Phase 1 S set, labels by construction). One request per case, exactly as the product will send it (system prompt
 * benchmarks/rewrite-check/system.txt, structured output), for Haiku 5.5 and Sonnet 5.5 through Batches. Sends nothing.
 *
 * usage: node --import tsx benchmarks/rewrite-check/build-manifest.ts
 * out:   tmp/rw1/{haiku,sonnet}-requests.jsonl, docs/phase-4/rw1/{haiku,sonnet}-manifest.json
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const MODELS = {
  // Batches: 50 % of the list price.
  haiku: {model: 'claude-haiku-5-5', price: {input: 0.05, output: 0.25}},
  sonnet: {model: 'claude-sonnet-5-5', price: {input: 1, output: 5}},
} as const;
const EFFORT = 'low';
const MAX_TOKENS = 1500;
const EXPECTED_OUTPUT = 250;
const CHARS_PER_TOKEN = 3;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const system = readFileSync('benchmarks/rewrite-check/system.txt', 'utf8');
const cases = readFileSync('benchmarks/datasets/exam-rewrite-v1/items.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l));
const schema = {
  type: 'object', additionalProperties: false, required: ['verdict', 'explanation', 'new_error_quote'],
  properties: {verdict: {type: 'string', enum: ['correct', 'error_remains', 'new_error']}, explanation: {type: 'string'}, new_error_quote: {type: 'string'}},
};

for (const [step, {model, price}] of Object.entries(MODELS)) {
  const lines = cases.map(c => {
    const user = JSON.stringify({original: c.quote, correction: c.suggestion, error: c.explanation, rewrite: c.rewrite, language: c.language});
    return JSON.stringify({custom_id: `rw1-${step}-${c.id}`, params: {model, max_tokens: MAX_TOKENS, thinking: {type: 'adaptive'},
      output_config: {effort: EFFORT, format: {type: 'json_schema', schema}}, system, messages: [{role: 'user', content: user}]}});
  });
  const jsonl = lines.join('\n') + '\n';
  const file = `tmp/rw1/${step}-requests.jsonl`;
  writeFileSync(file, jsonl);
  const approxIn = Math.ceil(lines.reduce((s, l) => s + l.length, 0) / CHARS_PER_TOKEN);
  const worstOut = cases.length * MAX_TOKENS;
  const usd = (i: number, o: number) => +((i * price.input + o * price.output) / 1e6).toFixed(4);
  writeFileSync(`docs/phase-4/rw1/${step}-manifest.json`, JSON.stringify({
    format: 'rw1-manifest/1', step: `P4.14 measurement (${step})`, model, batches: true, thinking: 'adaptive', effort: EFFORT, max_tokens: MAX_TOKENS,
    no_pilot: true, dataset: 'benchmarks/datasets/exam-rewrite-v1', dataset_sha256: sha(readFileSync('benchmarks/datasets/exam-rewrite-v1/items.jsonl', 'utf8')),
    prompt_sha256: sha(system), requests_sha256: sha(jsonl), requests_file: file, scope: {cases: cases.length},
    price_usd_per_mtok: price,
    estimate: {approx_input_tokens: approxIn, expected_output_tokens: cases.length * EXPECTED_OUTPUT, worst_output_tokens: worstOut,
      expected_usd: usd(approxIn, cases.length * EXPECTED_OUTPUT), worst_usd: usd(approxIn, worstOut)},
  }, null, 1) + '\n');
  console.log(step, sha(jsonl).slice(0, 8));
}
