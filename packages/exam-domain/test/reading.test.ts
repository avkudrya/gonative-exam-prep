import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerWords, checkReadingSection, checkReadingTest, presentEstimate, readingEstimate, type ReadingSection, type ReadingTest} from '../src/index.js';

// Our own short passage (written for the tests) with every main question type; shared with MultiAdmin's ReadingAnswers tests.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/reading-section.json', import.meta.url), 'utf8')) as {section: ReadingSection};
const section = (): ReadingSection => structuredClone(fixture.section);

test('a well-formed section has no problems', () => {
  assert.deepEqual(checkReadingSection(section(), 'ielts-academic'), []);
});

test('form checks find what makes a question unanswerable or unfair', () => {
  const cases: [string, (s: ReadingSection) => void, RegExp][] = [
    ['evidence not in the text', s => { s.groups[1].questions[0].evidence = 'councils pay for every hive'; }, /evidence is not in the text/],
    ['no evidence for a TRUE', s => { delete s.groups[1].questions[0].evidence; }, /no evidence/],
    ['completion answer not in the text', s => { s.groups[3].questions[1].answer = ['solitary bees']; }, /is not in the text/],
    ['completion answer over the limit', s => { s.groups[3].questions[1].answer = ['wild bees', 'the wild bees of cities']; }, /over the word limit/],
    ['answer not an option', s => { s.groups[0].questions[0].answer = ['iv']; }, /not an option/],
    ['headings without spare options', s => { s.groups[0].options = s.groups[0].options!.slice(0, 2); }, /more options than paragraphs/],
    ['statements out of the text order', s => { s.groups[1].questions.reverse(); }, /out of the text's order/],
    ['choose TWO with one answer', s => { s.groups[4].questions[0].answer = ['A']; }, /numbers and answers do not match/],
    ['no word limit', s => { delete s.groups[3].limit; }, /no word limit/],
    ['missing explanation', s => { s.groups[2].questions[0].explanation = {en: ' '}; }, /no explanation/],
  ];
  for (const [name, change, expected] of cases) {
    const s = section();
    change(s);
    assert.match(checkReadingSection(s, 'ielts-academic').join('\n'), expected, name);
  }
  // Yes/No/Not Given exists only in Academic.
  assert.match(checkReadingSection(section(), 'ielts-general-training').join('\n'), /not a ielts-general-training question type/);
});

test('answer words as IELTS counts them', () => {
  assert.deepEqual(answerWords('wild bees', false), {words: 2, numbers: 0});
  assert.deepEqual(answerWords('check-in desk', false), {words: 2, numbers: 0});
  assert.deepEqual(answerWords('20% more', true), {words: 1, numbers: 1});
  assert.deepEqual(answerWords('20% more', false), {words: 2, numbers: 0});
});

test('a test has three sections, questions 1-40 in order and texts of the official length', () => {
  const s = section();
  const test1: ReadingTest = {id: 't', exam: 'ielts-academic', sections: [s, s, s]};
  const problems = checkReadingTest(test1).join('\n');
  assert.match(problems, /numbered 1-40/);
  assert.match(problems, /words in the texts, not 2150-2750/);
  assert.match(checkReadingTest({...test1, sections: [s]}).join('\n'), /1 sections, not 3/);
});

test('the shared estimate cases equal readingEstimate (MultiAdmin ReadingScore uses the same file)', () => {
  const shared = JSON.parse(readFileSync(new URL('./fixtures/reading-estimate.json', import.meta.url), 'utf8')) as {cases: {exam: 'ielts-academic' | 'ielts-general-training'; raw: number; expected: unknown}[]};
  assert.equal(shared.cases.length, 82);
  for (const c of shared.cases) assert.deepEqual(readingEstimate(c.raw, c.exam), c.expected, `${c.exam} ${c.raw}`);
});

test('raw score to an approximate band: official thresholds, half bands between them, no number below the lowest', () => {
  assert.equal(readingEstimate(15, 'ielts-academic'), null);
  assert.deepEqual(readingEstimate(16, 'ielts-academic'), {low: 5, high: 5});
  assert.deepEqual(readingEstimate(20, 'ielts-academic'), {low: 5.5, high: 5.5});
  assert.deepEqual(readingEstimate(23, 'ielts-academic'), {low: 6, high: 6});
  assert.deepEqual(readingEstimate(30, 'ielts-academic'), {low: 7, high: 7});
  assert.deepEqual(readingEstimate(40, 'ielts-academic'), {low: 8, high: 9});
  // General Training needs more correct answers for the same band.
  assert.deepEqual(readingEstimate(30, 'ielts-general-training'), {low: 6, high: 6});
  assert.throws(() => readingEstimate(41, 'ielts-academic'), RangeError);
  // Shown only through presentEstimate: an approximate range at least one band wide.
  const scale = {kind: 'band' as const, min: 0, max: 9, step: 0.5, approximate: {step: 0.5, minWidth: 1}};
  const shown = presentEstimate({...readingEstimate(23, 'ielts-academic')!, calibration: {status: 'uncalibrated'}} as never, scale);
  assert.deepEqual(shown, {precision: 'approximate', low: 5.5, high: 6.5});
});

test('the Reading libraries: every test passes the form checks, 40 questions, a known status, explanations in en, ru and uk', () => {
  type Library = {version: string; examKey: 'ielts-academic'; tests: {key: string; status: string; sections: ReadingSection[]}[]};
  const libraries = ['v1', 'v2'].map(v => JSON.parse(readFileSync(new URL(`../library/ielts-reading-academic.${v}.json`, import.meta.url), 'utf8')) as Library);
  // v2 replaces academic-2 of v1 (the same name was used for two people, review 2026-11-27); one published copy of each test.
  const published = libraries.flatMap(l => l.tests.filter(t => t.status === 'published').map(t => t.key));
  assert.deepEqual(published.sort(), ['academic-1', 'academic-2']);
  for (const t of libraries.flatMap(l => l.tests)) {
    assert.deepEqual(checkReadingTest({id: t.key, exam: "ielts-academic", sections: t.sections}), [], t.key);
    assert.ok(['review', 'published', 'retired'].includes(t.status), t.key);
    for (const s of t.sections) for (const g of s.groups) for (const q of g.questions) {
      for (const lang of ['en', 'ru', 'uk'] as const) assert.ok(q.explanation[lang]?.trim(), `${t.key} ${q.numbers.join('-')} ${lang}`);
    }
  }
});
