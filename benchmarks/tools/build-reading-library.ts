/**
 * P7.4: the Reading library (packages/exam-domain/library/ielts-reading-academic.v1.json) from the tests of a content round.
 *
 *   npm run bench:reading-library            rebuild the library file
 *   npm run bench:reading-library -- --check fail if the file differs from a fresh build
 *
 * Source: benchmarks/runs/exam-reading-pilot-1/tests/*.json (exam:reading:pilot, P7.3). A test is served to learners only when
 * its status is "published"; "review" tests wait for the owner's reading (P7.1 §4 step 6) and are visible only with
 * EXAM_READING_DRAFTS. The status is set here, in STATUS, and is not part of a test's content hash in MultiAdmin.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReadingTest, type ReadingSection, type ReadingTest} from '../../packages/exam-domain/src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN = 'benchmarks/runs/exam-reading-pilot-1';
const OUT = 'packages/exam-domain/library/ielts-reading-academic.v1.json';
/** Owner decision per test; "review" until the owner has read it. */
const STATUS: Record<string, 'review' | 'published' | 'retired'> = {'academic-1': 'review', 'academic-2': 'review'};
const TITLES: Record<string, string> = {'academic-1': 'Academic Reading practice test 1', 'academic-2': 'Academic Reading practice test 2'};

const report = JSON.parse(readFileSync(join(root, RUN, 'report.json'), 'utf8')) as {id: string; prompts: string; tests: {id: string; file: string}[]};
const tests = report.tests.map(entry => {
  const test = JSON.parse(readFileSync(join(root, RUN, entry.file), 'utf8')) as ReadingTest;
  const problems = checkReadingTest(test);
  if (problems.length) throw new Error(`${test.id}: ${problems.join('; ')}`);
  if (!STATUS[test.id]) throw new Error(`${test.id}: no status`);
  return {
    key: test.id,
    status: STATUS[test.id],
    title: TITLES[test.id] ?? test.id,
    sections: (test.sections as (ReadingSection & {meta?: {topic: string}})[]).map(({meta, ...section}) => ({topic: meta?.topic ?? section.title, ...section})),
  };
});
const library = {
  libraryKey: 'ielts-reading-academic',
  version: 'v1',
  about: 'Original IELTS-style Academic Reading practice tests written for GoNative Exam Prep by AI (not official IELTS material), each question checked by code, by two blind solvers and by a third controller model.',
  examKey: 'ielts-academic',
  sectionKey: 'reading',
  origin: 'generated',
  pipeline: {round: report.id, prompts: report.prompts, report: `${RUN}/report.json`},
  tests,
};
const text = `${JSON.stringify(library, null, 2)}\n`;
const path = join(root, OUT);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== text) {
    console.error(`${OUT} is stale: run npm run bench:reading-library`);
    process.exit(1);
  }
  console.log(`${OUT} is current`);
} else {
  writeFileSync(path, text);
  console.log(`${OUT}: ${tests.length} tests (${tests.map(t => `${t.key} ${t.status}`).join(', ')})`);
}
