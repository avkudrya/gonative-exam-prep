import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {checkLetterSpec, letterInstruction, letterSpec, type LetterSpec} from '../src/index.js';

const formal: LetterSpec = {
  format: 'letter-spec/1', tone: 'formal', purpose: 'complaint',
  situation: 'You stayed at a hotel last month, and the hotel charged your card twice.',
  recipient: 'the manager of the hotel',
  points: ['give details of your stay', 'explain the problem with the payment', 'say what you want the hotel to do'],
  opening: 'Dear Sir or Madam,',
};

test('letter-spec: a well-formed task has no problems and composes the instruction from its parts', () => {
  assert.deepEqual(checkLetterSpec(letterSpec.parse(formal)), []);
  assert.equal(letterInstruction(formal), [
    'You stayed at a hotel last month, and the hotel charged your card twice.',
    '',
    'Write a letter to the manager of the hotel. In your letter:',
    '• give details of your stay',
    '• explain the problem with the payment',
    '• say what you want the hotel to do',
    '',
    'Write at least 150 words. You do not need to include any addresses.',
    'Begin your letter with: Dear Sir or Madam,',
  ].join('\n'));
});

test('letter-spec: the opening fits the tone, points are instructions, three distinct points', () => {
  assert.match(checkLetterSpec({...formal, opening: 'Dear …,'}).join('\n'), /does not fit a formal letter/);
  assert.match(checkLetterSpec({...formal, tone: 'informal'}).join('\n'), /does not fit a informal letter/);
  assert.match(checkLetterSpec({...formal, points: ['the stay', formal.points[1], formal.points[2]]}).join('\n'), /point 1/);
  assert.match(checkLetterSpec({...formal, points: [formal.points[0], formal.points[0], formal.points[2]]}).join('\n'), /repeat/);
  assert.equal(letterSpec.safeParse({...formal, points: formal.points.slice(0, 2)}).success, false);
  assert.match(checkLetterSpec({...formal, recipient: 'hotel manager'}).join('\n'), /recipient/);
});

test('letter-spec: the 24 own GT tasks are valid, 8 per tone', () => {
  const source = JSON.parse(readFileSync(new URL('../../../benchmarks/sources/task1-general-letters.json', import.meta.url), 'utf8')) as {items: {spec: unknown}[]};
  const specs = source.items.map(i => letterSpec.parse(i.spec));
  assert.equal(specs.length, 24);
  assert.deepEqual(specs.flatMap(checkLetterSpec), []);
  for (const tone of ['formal', 'semi_formal', 'informal']) assert.equal(specs.filter(s => s.tone === tone).length, 8);
});
