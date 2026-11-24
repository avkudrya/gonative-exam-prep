import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {sliceCodePoints} from '../../../packages/exam-domain/src/index.js';
import {sha256, toJsonl, type Prompt} from '../build.js';
import {buildDense, parseMarked} from '../dense.js';

const file = (path: string) => new URL(`../../${path}`, import.meta.url);

test('markup becomes the learner text with every wrong span labelled', () => {
  const {text, errors} = parseMarked('x', 'People {dont=>don\'t|punc|n} read {a news=>the news|art|m}.\n\nMy friend {he=>|ss|m} reads.');
  assert.equal(text, 'People dont read a news.\n\nMy friend he reads.');
  assert.deepEqual(errors.map(e => [sliceCodePoints(text, e.start, e.end), e.original, e.skill, e.severity]), [
    ['dont', "don't", 'mechanics.punctuation', 'minor'],
    ['a news', 'the news', 'grammar.articles', 'moderate'],
    ['he', '', 'grammar.sentence_structure', 'moderate'],
  ]);
  assert.throws(() => parseMarked('x', 'A {b=>c|zz|n}'), /unknown skill/);
  assert.throws(() => parseMarked('x', 'A {b=>c|art}'), /unparsed markup/);
});

test('set D is built from its source, the owner essay matches its production hash', () => {
  const prompts: Prompt[] = JSON.parse(readFileSync(file('sources/task2-prompts.json'), 'utf8')).prompts;
  const items = buildDense(readFileSync(file('sources/d-dense.txt'), 'utf8'), prompts);
  assert.equal(items.length, 10);
  assert.ok(items.every(i => i.set === 'D' && i.split === 'dev' && (i.expected.errors?.length ?? 0) >= 15));
  assert.equal(items.find(i => i.id === 'd-10')?.source.origin, 'owner-test-03');
  assert.equal(readFileSync(file('datasets/exam-d-v1/items.jsonl'), 'utf8'), toJsonl(items), 'run npm run bench:dense');
  assert.match(sha256(toJsonl(items)), /^[0-9a-f]{64}$/);
});
