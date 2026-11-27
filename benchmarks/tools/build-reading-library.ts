/**
 * P7.4: the Reading libraries (packages/exam-domain/library/ielts-reading-academic.v*.json) from the tests of a content round.
 *
 *   npm run bench:reading-library            rebuild the library files
 *   npm run bench:reading-library -- --check fail if a file differs from a fresh build
 *
 * Source: benchmarks/runs/exam-reading-pilot-1/tests/*.json (exam:reading:pilot, P7.3). A test is served to learners only when
 * its status is "published"; "review" tests are visible only with EXAM_READING_DRAFTS; "retired" ones are no longer started.
 * The status is set here and is not part of a test's content hash in MultiAdmin, so a status change keeps the version.
 * A content change is a new version with the corrections listed below (docs/phase-7/P7.4-reading-product.md §5).
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReadingTest, type ReadingSection, type ReadingTest} from '../../packages/exam-domain/src/index.js';

type Status = 'review' | 'published' | 'retired';
/** A literal replacement in one section (text, prompts, options, evidence, explanations); `count` guards against a silent miss. */
type Correction = {section: number; from: string; to: string; count: number};
type Version = {version: string; note?: string; tests: {key: string; status: Status; corrections?: Correction[]}[]};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN = 'benchmarks/runs/exam-reading-pilot-1';
const TITLES: Record<string, string> = {'academic-1': 'Academic Reading practice test 1', 'academic-2': 'Academic Reading practice test 2'};
// 2026-11-27, review by Claude (the owner delegated it): no key errors in 80 questions; in academic-2 two different people were
// both called Marta Lindqvist (sections 1 and 3), and the ru/uk explanations of section 3 made her a man.
const LINDQVIST: Correction[] = [
  {section: 3, from: 'Marta Lindqvist', to: 'Hana Okoro', count: 1},
  {section: 3, from: "Lindqvist's", to: "Okoro's", count: 3},
  {section: 3, from: 'Lindqvist', to: 'Okoro', count: 1},
  {section: 3, from: 'Линдквиста', to: 'Окоро', count: 1},
  {section: 3, from: 'Ліндквіста', to: 'Окоро', count: 1},
];
const VERSIONS: Version[] = [
  {version: 'v1', tests: [{key: 'academic-1', status: 'published'}, {key: 'academic-2', status: 'retired'}]},
  {version: 'v2', note: 'academic-2 of v1 with the attention researcher of passage 3 renamed (the same name was used for another person in passage 1).',
    tests: [{key: 'academic-2', status: 'published', corrections: LINDQVIST}]},
];

const report = JSON.parse(readFileSync(join(root, RUN, 'report.json'), 'utf8')) as {id: string; prompts: string; tests: {id: string; file: string}[]};
const source = new Map(report.tests.map(entry => [entry.id, JSON.parse(readFileSync(join(root, RUN, entry.file), 'utf8')) as ReadingTest]));

function correct(section: ReadingSection, corrections: Correction[]): ReadingSection {
  let json = JSON.stringify(section);
  for (const c of corrections) {
    const found = json.split(c.from).length - 1;
    if (found !== c.count) throw new Error(`correction "${c.from}": found ${found} times, expected ${c.count}`);
    json = json.split(c.from).join(c.to);
  }
  return JSON.parse(json) as ReadingSection;
}

const check = process.argv.includes('--check');
let stale = false;
for (const v of VERSIONS) {
  const tests = v.tests.map(entry => {
    const test = source.get(entry.key);
    if (!test) throw new Error(`${entry.key}: not in ${RUN}`);
    const sections = (test.sections as (ReadingSection & {meta?: {topic: string}})[]).map(({meta, ...section}, i) => {
      const own = (entry.corrections ?? []).filter(c => c.section === i + 1);
      return {topic: meta?.topic ?? section.title, ...(own.length ? correct(section, own) : section)};
    });
    const problems = checkReadingTest({...test, sections});
    if (problems.length) throw new Error(`${entry.key}: ${problems.join('; ')}`);
    return {key: entry.key, status: entry.status, title: TITLES[entry.key] ?? entry.key, sections};
  });
  const library = {
    libraryKey: 'ielts-reading-academic',
    version: v.version,
    about: 'Original IELTS-style Academic Reading practice tests written for GoNative Exam Prep by AI (not official IELTS material), each question checked by code, by two blind solvers and by a third controller model.',
    ...(v.note ? {note: v.note} : {}),
    examKey: 'ielts-academic',
    sectionKey: 'reading',
    origin: 'generated',
    pipeline: {round: report.id, prompts: report.prompts, report: `${RUN}/report.json`},
    tests,
  };
  const out = `packages/exam-domain/library/ielts-reading-academic.${v.version}.json`;
  const text = `${JSON.stringify(library, null, 2)}\n`;
  if (check) {
    let current = '';
    try { current = readFileSync(join(root, out), 'utf8'); } catch { /* missing */ }
    if (current !== text) {
      console.error(`${out} is stale: run npm run bench:reading-library`);
      stale = true;
    }
  } else {
    writeFileSync(join(root, out), text);
    console.log(`${out}: ${tests.map(t => `${t.key} ${t.status}`).join(', ')}`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log('Reading libraries are current');
}
