import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = locale => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
const keys = (value, prefix = '') => typeof value === 'object' && value !== null
  ? Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
  : [prefix];

test('en and ru messages have the same keys and no empty strings', () => {
  const en = load('en');
  const ru = load('ru');
  assert.deepEqual(keys(ru).sort(), keys(en).sort());
  for (const [locale, messages] of [['en', en], ['ru', ru]]) {
    for (const key of keys(messages)) {
      const value = key.split('.').reduce((v, k) => v[k], messages);
      assert.ok(typeof value === 'string' && value.trim(), `${locale}: ${key} is empty`);
    }
  }
});

test('no message claims an official or exact IELTS score (ADR-003)', () => {
  for (const locale of ['en', 'ru']) {
    const text = JSON.stringify(load(locale));
    assert.doesNotMatch(text, /official (score|band|result)s? (is|are)|your (exact )?IELTS score|точн\w* балл|официальн\w* оценк/i);
  }
});
