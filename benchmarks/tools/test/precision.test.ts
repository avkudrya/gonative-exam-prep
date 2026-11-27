import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {sliceCodePoints} from '../../../packages/exam-domain/src/index.js';
import {buildPrecision, type Probe} from '../build-precision.js';

// Round 5: exam-precision-v1 — probes of accepted variants and real mistakes.
const source = JSON.parse(readFileSync(new URL('../../sources/precision-v1.json', import.meta.url), 'utf8'));
const built = buildPrecision(source);

test('the committed exam-precision-v1 is a fresh build', () => {
  for (const [task, items] of Object.entries(built)) {
    const onDisk = readFileSync(new URL(`../../datasets/exam-precision-v1/items-${task}.jsonl`, import.meta.url), 'utf8');
    assert.equal(onDisk, items.map(i => JSON.stringify(i)).join('\n') + '\n', 'run npm run bench:precision');
  }
});

test('every probe holds its quote inside its sentence; an error has accepted sentences that differ from the original', () => {
  const byId = new Map(source.items.map((i: {id: string; probes: {id: string; quote: string; sentence: string}[]}) => [i.id, i]));
  let valid = 0;
  let errors = 0;
  for (const items of Object.values(built)) {
    for (const item of items as {id: string; text: string; expected: {probes: Probe[]; errors: {probe: string}[]}}[]) {
      const src = byId.get(item.id) as {probes: {id: string; quote: string; sentence: string}[]};
      for (const p of item.expected.probes) {
        const s = src.probes.find(x => x.id === p.id)!;
        assert.equal(sliceCodePoints(item.text, p.start, p.end), s.quote, `${item.id}/${p.id}`);
        assert.equal(sliceCodePoints(item.text, p.sentence.start, p.sentence.end), s.sentence, `${item.id}/${p.id}`);
        assert.ok(p.sentence.start <= p.start && p.end <= p.sentence.end);
        if (p.kind === 'error') {
          errors++;
          assert.ok(p.accepted?.length && !p.accepted.includes(s.sentence), `${item.id}/${p.id}`);
        } else {
          valid++;
        }
      }
      assert.deepEqual(item.expected.errors.map(e => e.probe), item.expected.probes.filter(p => p.kind === 'error').map(p => p.id));
    }
  }
  assert.deepEqual([valid, errors], [29, 30]);
});
