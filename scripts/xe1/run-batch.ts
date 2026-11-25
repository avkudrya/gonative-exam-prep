/**
 * XE-1 batch runner (docs/phase-4/P4.9-xe1-explanations.md). One frozen request file per step, one submission, no retries.
 *
 *   count  — exact input tokens of every request (count_tokens, free) → docs/phase-4/xe1/<step>-count.json
 *   submit — only with docs/phase-4/xe1/<step>-authorization.json (the owner's "yes" with a dollar limit, bound to the request file's
 *            SHA-256); the worst case (exact input + max_tokens of every request) must fit the limit. An exclusive fence file is written
 *            before the paid call, so a second submit is impossible; the SDK's retries are off.
 *   poll   — the batch status
 *   fetch  — results → tmp/xe1/<step>-results.jsonl, actual cost from usage → docs/phase-4/xe1/<step>-costs.json
 *
 * usage: node --import tsx scripts/xe1/run-batch.ts <mode> <step>      (step: haiku-pilot | haiku | opus-pilot | opus)
 * The API key is read from MultiAdmin's .env (CLAUDE_API_KEY or ANTHROPIC_API_KEY) and never printed.
 */
import Anthropic from '@anthropic-ai/sdk';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const MULTIADMIN_ENV = '/Users/avkudrya/Documents/Projects/My/MultiVerse/MultiAdmin/.env';
const [mode, step] = process.argv.slice(2);
const STEPS = ['haiku-pilot', 'haiku', 'opus-pilot', 'opus'];
if (!['count', 'submit', 'poll', 'fetch'].includes(mode) || !STEPS.includes(step)) {
  throw new Error(`usage: run-batch.ts count|submit|poll|fetch ${STEPS.join('|')}`);
}
const family = step.replace(/-pilot$/, '');
const isPilot = step !== family;
const DOCS = 'docs/phase-4/xe1';
const manifestPath = `${DOCS}/${step}-manifest.json`;
const countPath = `${DOCS}/${step}-count.json`;
// One owner authorization per family covers its pilot and full run under one limit; the pilot's spend counts against it.
// `pilot_only: true` authorizes the pilot alone.
const authPath = `${DOCS}/${family}-authorization.json`;
const fencePath = `${DOCS}/${step}-submission.json`;
const costsPath = `${DOCS}/${step}-costs.json`;
const resultsPath = `tmp/xe1/${step}-results.jsonl`;

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const manifest = read(manifestPath);
const raw = readFileSync(manifest.requests_file, 'utf8');
if (sha(raw) !== manifest.requests_sha256) throw new Error('request file does not match the manifest');
const requests = raw.trim().split('\n').map(line => JSON.parse(line));
const price = manifest.price_usd_per_mtok as {input: number; output: number};
const usd = (input: number, output: number) => (input * price.input + output * price.output) / 1e6;

function apiKey(): string {
  const names = ['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY'];
  for (const line of readFileSync(MULTIADMIN_ENV, 'utf8').split('\n')) {
    const m = line.match(/^(?:export\s+)?([A-Z_]+)\s*=\s*(.*)$/);
    if (m && names.includes(m[1])) {
      const v = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (v && !/[\r\n]/.test(v)) return v;
    }
  }
  throw new Error('no Anthropic key in MultiAdmin .env');
}
const client = new Anthropic({apiKey: apiKey(), maxRetries: 0, timeout: 120_000});

async function count() {
  const out: Record<string, number> = {};
  for (const r of requests) {
    const {model, system, messages, thinking, output_config} = r.params;
    out[r.custom_id] = (await client.messages.countTokens({model, system, messages, thinking, output_config} as any)).input_tokens;
  }
  const input = Object.values(out).reduce((a, b) => a + b, 0);
  const worstOut = requests.length * manifest.max_tokens;
  const expectedOut = manifest.estimate.expected_output_tokens;
  const result = {requests_sha256: manifest.requests_sha256, input_tokens: input, expected_usd: +usd(input, expectedOut).toFixed(4),
    worst_usd: +usd(input, worstOut).toFixed(4), per_request: out};
  writeFileSync(countPath, JSON.stringify(result, null, 1) + '\n');
  console.log(JSON.stringify({...result, per_request: `${requests.length} requests`}, null, 1));
}

async function submit() {
  const auth = read(authPath);
  const full = isPilot ? manifest.part_of : manifest.requests_sha256;
  if (auth.requests_sha256 !== full) throw new Error('the authorization is for another request file');
  let pilotSpent = 0;
  if (!isPilot) {
    if (auth.pilot_only === true) throw new Error('the authorization covers the pilot only');
    if (read(`${DOCS}/${family}-pilot-submission.json`).status !== 'ended_reconciled') throw new Error('pilot not reconciled');
    if (auth.pilot_checked !== true) throw new Error('pilot not checked: set pilot_checked after reading its results');
    pilotSpent = Number(read(`${DOCS}/${family}-pilot-costs.json`).actual_usd);
  }
  const counted = read(countPath);
  if (counted.requests_sha256 !== manifest.requests_sha256) throw new Error('count is for another request file');
  if (pilotSpent + counted.worst_usd > Number(auth.limit_usd)) {
    throw new Error(`pilot $${pilotSpent} + worst case $${counted.worst_usd} exceeds the limit $${auth.limit_usd}`);
  }
  // Exclusive fence: fails if a submission was ever started for this step.
  writeFileSync(fencePath, JSON.stringify({status: 'submitting_no_retry', requests_sha256: manifest.requests_sha256, started_at: new Date().toISOString(),
    reserved_usd: counted.worst_usd}, null, 1) + '\n', {flag: 'wx'});
  const batch = await client.messages.batches.create({requests});
  writeFileSync(fencePath, JSON.stringify({status: 'submitted', batch_id: batch.id, requests_sha256: manifest.requests_sha256,
    submitted_at: new Date().toISOString(), reserved_usd: counted.worst_usd}, null, 1) + '\n');
  console.log(JSON.stringify({batch_id: batch.id, status: batch.processing_status}, null, 1));
}

async function poll() {
  const fence = read(fencePath);
  const batch = await client.messages.batches.retrieve(fence.batch_id);
  console.log(JSON.stringify({batch_id: batch.id, status: batch.processing_status, counts: batch.request_counts}, null, 1));
}

async function fetchResults() {
  const fence = read(fencePath);
  const batch = await client.messages.batches.retrieve(fence.batch_id);
  if (batch.processing_status !== 'ended') throw new Error(`batch is ${batch.processing_status}`);
  const lines: string[] = [];
  const tally = {input: 0, output: 0, cache_read: 0, cache_write: 0, succeeded: 0, other: 0, stop_reasons: {} as Record<string, number>};
  for await (const r of await client.messages.batches.results(fence.batch_id)) {
    lines.push(JSON.stringify(r));
    if (r.result.type === 'succeeded') {
      const m = r.result.message;
      tally.succeeded++;
      tally.input += m.usage.input_tokens;
      tally.output += m.usage.output_tokens;
      tally.cache_read += m.usage.cache_read_input_tokens ?? 0;
      tally.cache_write += m.usage.cache_creation_input_tokens ?? 0;
      tally.stop_reasons[m.stop_reason ?? 'null'] = (tally.stop_reasons[m.stop_reason ?? 'null'] ?? 0) + 1;
    } else {
      tally.other++;
    }
  }
  writeFileSync(resultsPath, lines.join('\n') + '\n');
  const actual = +usd(tally.input + tally.cache_read * 0.1 + tally.cache_write * 1.25, tally.output).toFixed(6);
  writeFileSync(costsPath, JSON.stringify({batch_id: fence.batch_id, requests_sha256: manifest.requests_sha256, ...tally, actual_usd: actual}, null, 1) + '\n');
  writeFileSync(fencePath, JSON.stringify({...fence, status: 'ended_reconciled', actual_usd: actual, reserved_usd: 0}, null, 1) + '\n');
  console.log(JSON.stringify({...tally, actual_usd: actual}, null, 1));
}

await ({count, submit, poll, fetch: fetchResults} as Record<string, () => Promise<void>>)[mode]();
