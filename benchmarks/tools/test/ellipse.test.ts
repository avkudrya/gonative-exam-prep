import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseCsv, promptFor, sample, toItem, TRAITS} from '../ellipse.js';

const essay = (n: number) => Array.from({length: n}, (_, i) => `word${i}`).join(' ');

test('CSV: quoted commas, doubled quotes and newlines inside fields', () => {
  const rows = parseCsv('﻿id,full_text,Overall\r\n1,"Hello, ""world""\nsecond line",3\n2,plain,2.5\n');
  assert.deepEqual(rows, [{id: '1', full_text: 'Hello, "world"\nsecond line', Overall: '3'}, {id: '2', full_text: 'plain', Overall: '2.5'}]);
});

test('H1 sample is deterministic, within the word range and spread over the scale', () => {
  const rows = Array.from({length: 60}, (_, i) => ({
    text_id_kaggle: `T${String(i).padStart(3, '0')}`, full_text: essay(i % 10 === 0 ? 100 : 250), prompt: 'Distance learning',
    ...Object.fromEntries(TRAITS.map(t => [t, String(2 + (i % 4) * 0.5)])),
  }));
  const a = sample(rows, 20, 'h1-dev', {min: 200, max: 500});
  assert.deepEqual(sample(rows, 20, 'h1-dev', {min: 200, max: 500}), a);
  assert.equal(a.length, 20);
  assert.ok(a.every(r => r.full_text.split(' ').length === 250), 'short essays are left out');
  assert.equal(new Set(a.map(r => r.Overall)).size, 4);
  assert.throws(() => sample(rows, 100, 'h1-dev', {min: 200, max: 500}), /eligible/);

  const item = toItem(a[0], 'dev');
  assert.equal(item.set, 'H1');
  assert.equal(item.prompt, promptFor('Distance learning'));
  assert.deepEqual(Object.keys(item.expected.traits!), TRAITS.map(t => t.toLowerCase()));
});
