import assert from 'node:assert/strict';
import {test} from 'node:test';
import {countWords, normalizeResponse} from '../src/index.js';

test('normalization unifies line endings, trailing spaces and composition', () => {
  assert.equal(normalizeResponse('  Café \r\nline two  \r\n'), 'Café\nline two');
});

test('word count: compounds and contractions once, punctuation-only tokens never', () => {
  assert.equal(countWords("It's a well-known fact — 25 % of people agree."), 8);
  assert.equal(countWords(''), 0);
  assert.equal(countWords('Привет,   мир!\nЭто тест.'), 4);
});
