import assert from 'node:assert/strict';
import {test} from 'node:test';
import {letterFacts} from '../src/index.js';

const body = 'I am writing about my order.\n\nThe machine arrived late and damaged.';
const letter = (open: string, close: string, name = 'Anna Kowalska') => `${open}\n\n${body}\n\n${close}\n${name}`;

test('letter facts: a formal letter to an unknown reader closes with faithfully or sincerely (British and American usage)', () => {
  assert.deepEqual(letterFacts(letter('Dear Sir or Madam,', 'Yours faithfully,'), 'formal').mismatches, []);
  assert.deepEqual(letterFacts(letter('Dear Sir/Madam,', 'Sincerely,'), 'formal').mismatches, []);
  assert.deepEqual(letterFacts(letter('To whom it may concern,', 'Kind regards,'), 'formal').mismatches, []);
  const f = letterFacts(letter('Dear Sir or Madam,', 'Love,'), 'formal');
  assert.deepEqual([f.opening?.kind, f.closing?.kind, f.mismatches], ['unknown_reader', 'informal', ['closing_tone']]);
  assert.deepEqual(letterFacts(letter('Hi there,', 'Cheers,'), 'formal').mismatches, ['opening_tone', 'closing_tone']);
});

test('letter facts: semi-formal and informal letters greet by name; faithfully does not follow a name', () => {
  assert.deepEqual(letterFacts(letter('Dear Mr Patel,', 'Yours sincerely,'), 'semi_formal').mismatches, []);
  assert.deepEqual(letterFacts(letter('Dear Mr Patel,', 'Yours faithfully,'), 'semi_formal').mismatches, ['closing_tone', 'opening_closing_pair']);
  assert.deepEqual(letterFacts(letter('Dear Sir or Madam,', 'Best regards,'), 'semi_formal').mismatches, ['opening_tone']);
  assert.deepEqual(letterFacts(letter('Dear Sam,', 'Best wishes,', 'Ola'), 'informal').mismatches, []);
  assert.deepEqual(letterFacts(letter('Hi Sam,', 'See you soon,', 'Ola'), 'informal').mismatches, []);
  assert.deepEqual(letterFacts(letter('Dear Sam,', 'Yours sincerely,', 'Ola'), 'informal').mismatches, ['closing_tone']);
  assert.deepEqual(letterFacts(letter('Dear Sir or Madam,', 'Love,', 'Ola'), 'informal').mismatches, ['opening_tone']);
});

test('letter facts: a missing opening or closing is a fact; a closing on the name line and a closing on one line are found', () => {
  assert.deepEqual(letterFacts(body, 'informal').mismatches, ['no_opening', 'no_closing']);
  assert.equal(letterFacts(`Dear Sam,\n\n${body}\n\nBest wishes, Ola`, 'informal').closing?.kind, 'best_wishes');
  assert.equal(letterFacts(`Dear Sarah,\n\n${body}\n\nLots of love\nOla`, 'informal').opening?.kind, 'first_name');
  assert.equal(letterFacts(`Dear Sam,\n\n${body}\n\nBest,\nOla`, 'informal').closing?.kind, 'best_wishes');
  assert.equal(letterFacts(`Dear Sam,\n\n${body}\n\nBest of all, the weather was great.`, 'informal').closing, null, 'a sentence starting with Best is not a closing');
  assert.equal(letterFacts(`Dear Sirius,\n\n${body}\n\nLove,\nOla`, 'informal').opening?.kind, 'first_name');
});
