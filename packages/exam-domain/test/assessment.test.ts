import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  assessmentResult, checkAssessmentIntegrity, checkFindingSpans, findTask, presentEstimate,
  type AssessmentResult,
} from '../src/index.js';
import {ieltsAcademic} from './fixtures/ielts-academic.js';

const text = 'Government should invest in education. It is very important.';
const rubric = findTask(ieltsAcademic.versions[0], 'writing', 'task-2')!.rubric;
const uncalibrated = {status: 'uncalibrated'} as const;

function sample(): AssessmentResult {
  return {
    schemaVersion: 1,
    exam: {examKey: 'ielts-academic', examVersion: 'draft-1', sectionKey: 'writing', taskKey: 'task-2', rubricKey: rubric.key, rubricVersion: rubric.version},
    pipelineVersion: 'poc-0',
    feedbackLanguage: 'ru',
    response: {wordCount: 10, wordCountRule: 'whitespace-v1', textSha256: 'a'.repeat(64)},
    status: 'complete',
    criteria: rubric.criteria.map(c => ({
      criterionKey: c.key,
      estimate: {low: 5, high: 6, calibration: uncalibrated},
      confidence: 'low' as const,
      summary: 'Short summary.',
      findingIds: c.key === 'grammatical_range_accuracy' ? ['f1'] : [],
    })),
    findings: [{
      id: 'f1', kind: 'error', skill: 'grammar.articles', criterionKey: 'grammatical_range_accuracy', severity: 'minor',
      span: {start: 0, end: 37}, quote: 'Government should invest in education',
      suggestion: 'The government should invest in education', explanation: 'The government as an institution.',
    }],
  };
}

test('a consistent result passes the schema and integrity checks', () => {
  const result = assessmentResult.parse(sample());
  assert.deepEqual(checkAssessmentIntegrity(result, rubric, text), []);
});

test('a span that does not quote the text is caught', () => {
  const result = sample();
  result.findings[0].span = {start: 1, end: 38};
  assert.match(checkAssessmentIntegrity(result, rubric, text)[0].message, /quote does not match/);
});

test('spans count code points, so emoji and Cyrillic do not shift offsets', () => {
  const ru = '😀 Привет мир';
  assert.deepEqual(checkFindingSpans(ru, [{id: 'x', kind: 'error', skill: 'mechanics.spelling', severity: 'minor', span: {start: 2, end: 8}, quote: 'Привет', explanation: 'e'}]), []);
});

test('a missing or repeated criterion is caught', () => {
  const result = sample();
  result.criteria.pop();
  result.criteria.push({...result.criteria[0]});
  const messages = checkAssessmentIntegrity(result, rubric, text).map(p => p.path);
  assert.ok(messages.includes('criteria.task_response'));
  assert.ok(messages.includes('criteria.grammatical_range_accuracy'));
});

test('estimates off the criterion scale and unknown references are caught', () => {
  const result = sample();
  result.criteria[0].estimate = {low: 5.5, high: 6, calibration: uncalibrated};
  result.criteria[1].findingIds = ['ghost'];
  const paths = checkAssessmentIntegrity(result, rubric, text).map(p => p.path);
  assert.ok(paths.includes('criteria.task_response.estimate'));
  assert.ok(paths.includes('criteria.coherence_cohesion.findingIds'));
});

test('schema rejects a span without a quote and an inverted range', () => {
  const noQuote = sample();
  delete noQuote.findings[0].quote;
  assert.throws(() => assessmentResult.parse(noQuote), /span and quote/);
  const inverted = sample();
  inverted.criteria[0].estimate = {low: 7, high: 6, calibration: uncalibrated};
  assert.throws(() => assessmentResult.parse(inverted), /low must not exceed high/);
});

test('uncalibrated estimates are shown only as coarse approximate ranges', () => {
  const scale = rubric.criteria[0].scale;
  const approx = (low: number, high: number) => presentEstimate({low, high, calibration: uncalibrated}, scale);
  assert.deepEqual(approx(6, 6), {precision: 'approximate', low: 5.5, high: 6.5});
  assert.deepEqual(approx(5, 6), {precision: 'approximate', low: 5, high: 6});
  assert.deepEqual(approx(9, 9), {precision: 'approximate', low: 8, high: 9});
  assert.deepEqual(approx(0, 0), {precision: 'approximate', low: 0, high: 1});
});

test('calibrated ranges pass through; no config or no estimate means no number', () => {
  const scale = rubric.criteria[0].scale;
  assert.deepEqual(presentEstimate({low: 6, high: 6, calibration: {status: 'calibrated', calibrationId: 'cal-1'}}, scale), {precision: 'calibrated', low: 6, high: 6});
  assert.equal(presentEstimate(null, scale), null);
  assert.equal(presentEstimate({low: 6, high: 6, calibration: uncalibrated}, {kind: 'band', min: 0, max: 9, step: 1}), null);
  assert.equal(presentEstimate({low: 6, high: 6, calibration: uncalibrated}, {kind: 'descriptive'}), null);
});
