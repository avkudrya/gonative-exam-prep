import {test} from 'node:test';
import assert from 'node:assert/strict';
import {highlightSegments} from '../src/index.js';

test('segments cover the whole text in order, overlaps carry every finding id', () => {
  const text = 'I has a apple pie.';
  const {segments, skipped} = highlightSegments(text, [
    {id: 'f1', start: 2, end: 5, quote: 'has'},
    {id: 'f2', start: 6, end: 13, quote: 'a apple'},
    {id: 'f3', start: 8, end: 17, quote: 'apple pie'},
  ]);
  assert.deepEqual(skipped, []);
  assert.equal(segments.map(s => s.text).join(''), text);
  assert.deepEqual(segments.map(s => [s.text, s.ids]), [
    ['I ', []], ['has', ['f1']], [' ', []], ['a ', ['f2']], ['apple', ['f2', 'f3']], [' pie', ['f3']], ['.', []],
  ]);
});

test('offsets are code points: emoji and Cyrillic do not shift highlights', () => {
  const text = '😀 Ты has 2 cat.';
  const {segments, skipped} = highlightSegments(text, [{id: 'f', start: 5, end: 8, quote: 'has'}]);
  assert.deepEqual(skipped, []);
  assert.deepEqual(segments.find(s => s.ids.length)?.text, 'has');
});

test('a span that does not quote the text, is empty or out of range is skipped, not misplaced', () => {
  const {segments, skipped} = highlightSegments('Short text.', [
    {id: 'wrong-quote', start: 0, end: 5, quote: 'Other'},
    {id: 'empty', start: 3, end: 3},
    {id: 'outside', start: 5, end: 99},
    {id: 'ok', start: 6, end: 10, quote: 'text'},
  ]);
  assert.deepEqual(skipped, ['wrong-quote', 'empty', 'outside']);
  assert.deepEqual(segments.filter(s => s.ids.length).map(s => s.text), ['text']);
});
