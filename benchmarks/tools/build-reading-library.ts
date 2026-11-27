/**
 * P7.4–P7.5: the Reading libraries (packages/exam-domain/library/ielts-reading-{academic,general-training}.v*.json) from the
 * tests of the content rounds.
 *
 *   npm run bench:reading-library            rebuild the library files
 *   npm run bench:reading-library -- --check fail if a file differs from a fresh build
 *
 * Source: benchmarks/runs/<round>/tests/*.json (exam:reading:pilot): the P7.3 pilot, the P7.5 Academic and GT rounds. A test is served to learners only when
 * its status is "published"; "review" tests are visible only with EXAM_READING_DRAFTS; "retired" ones are no longer started.
 * The status is set here and is not part of a test's content hash in MultiAdmin, so a status change keeps the version.
 * A content change is a new version with the corrections listed below (docs/phase-7/P7.4-reading-product.md §5, P7.5 §5).
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReadingTest, type ReadingSection, type ReadingTest} from '../../packages/exam-domain/src/index.js';

type Status = 'review' | 'published' | 'retired';
/** A literal replacement in one section (text, prompts, options, evidence, explanations); `count` guards against a silent miss. */
type Correction = {section: number; from: string; to: string; count: number};
type Version = {library: keyof typeof LIBRARIES; version: string; run: string; note?: string; tests: {key: string; status: Status; corrections?: Correction[]}[]};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LIBRARIES = {
  'ielts-reading-academic': {examKey: 'ielts-academic', name: 'Academic'},
  'ielts-reading-general-training': {examKey: 'ielts-general-training', name: 'General Training'},
} as const;
const PILOT = 'benchmarks/runs/exam-reading-pilot-1';
const title = (key: string) => {
  const [, kind, n] = /^(academic|gt)-(\d+)$/.exec(key) ?? [];
  return kind ? `${kind === 'gt' ? 'General Training' : 'Academic'} Reading practice test ${n}` : key;
};
// 2026-11-27, review by Claude (the owner delegated it): no key errors in 80 questions; in academic-2 two different people were
// both called Marta Lindqvist (sections 1 and 3), and the ru/uk explanations of section 3 made her a man.
const LINDQVIST: Correction[] = [
  {section: 3, from: 'Marta Lindqvist', to: 'Hana Okoro', count: 1},
  {section: 3, from: "Lindqvist's", to: "Okoro's", count: 3},
  {section: 3, from: 'Lindqvist', to: 'Okoro', count: 1},
  {section: 3, from: 'Линдквиста', to: 'Окоро', count: 1},
  {section: 3, from: 'Ліндквіста', to: 'Окоро', count: 1},
];
// 2026-11-27, review of the GT pilot (P7.5 §5): the correct option of question 26 was far longer than the others and copied
// the passage; it is cut to their length (the question stays answerable: only the end of shifts is in the passage).
const GT1_Q26: Correction[] = [
  {section: 2, from: 'Most back strains happened near the end of shifts, when staff were tired and in a hurry.', to: 'Most back strains happened near the end of shifts.', count: 1},
];
// 2026-11-27, full review of the P7.5 rounds (P7.5 §6): no key errors in 680 questions. Three answers a careful reader could
// defend besides the key are made unambiguous, and one name used in both libraries is changed.
const ACADEMIC4_ENDING: Correction[] = [ // Q35: ending G was also true of the hand note-takers
  {section: 3, from: 'gave better explanations of the ideas in their own words.', to: 'remembered more facts than the other group.', count: 1},
  {section: 3, from: 'It was the handwriting group, not the laptop group, that explained ideas better, so the ending about better explanations is wrong.',
    to: 'Neither group remembered more facts than the other, so the ending about remembering more facts is wrong.', count: 1},
  {section: 3, from: 'Лучше объясняли идеи те, кто писал от руки, а не те, кто работал на ноутбуках, поэтому окончание про более удачные объяснения неверно.',
    to: 'Ни одна из групп не запомнила больше фактов, чем другая, поэтому окончание о том, что группа запомнила больше фактов, неверно.', count: 1},
  {section: 3, from: 'Краще пояснювали ідеї ті, хто писав від руки, а не ті, хто працював на ноутбуках, тому закінчення про кращі пояснення неправильне.',
    to: "Жодна з груп не запам'ятала більше фактів, ніж інша, тому закінчення про те, що група запам'ятала більше фактів, неправильне.", count: 1},
];
const ACADEMIC8_Q25: Correction[] = [ // option B could be read as Okoye's finding too
  {section: 2, from: 'showed the founders had misjudged their workers.', to: 'led the library to stop buying history and science.', count: 1},
];
const GT4_OWNER: Correction[] = [ // the same name as the digital-learning adviser of academic-4 (the rounds ran side by side)
  {section: 1, from: 'Ruth Calloway', to: 'Morwenna Pascoe', count: 1},
];
const GT7_Q22: Correction[] = [ // 'mainly' left room for NOT GIVEN; 'only' is plainly contradicted
  {section: 2, from: 'the job description is mainly useful when writing the job advertisement.', to: 'the job description is useful only when writing the job advertisement.', count: 1},
  {section: 2, from: 'so it is not mainly for the advertisement.', to: 'so it is not useful only for the advertisement.', count: 1},
  {section: 2, from: 'поэтому оно нужно не в основном для объявления.', to: 'поэтому оно нужно не только для объявления.', count: 1},
  {section: 2, from: 'тож він потрібен не переважно для оголошення.', to: 'тож він потрібен не лише для оголошення.', count: 1},
];
const ACADEMIC_2 = 'benchmarks/runs/exam-reading-academic-2';
const GT_1 = 'benchmarks/runs/exam-reading-gt-1';
const range = (prefix: string, from: number, to: number) => Array.from({length: to - from + 1}, (_, i) => `${prefix}-${from + i}`);
const FIXES: Record<string, Correction[]> = {'academic-4': ACADEMIC4_ENDING, 'academic-8': ACADEMIC8_Q25, 'gt-1': GT1_Q26, 'gt-4': GT4_OWNER, 'gt-7': GT7_Q22};
const published = (keys: string[]) => keys.map(key => ({key, status: 'published' as const, ...(FIXES[key] ? {corrections: FIXES[key]} : {})}));
const VERSIONS: Version[] = [
  {library: 'ielts-reading-academic', version: 'v1', run: PILOT, tests: [{key: 'academic-1', status: 'published'}, {key: 'academic-2', status: 'retired'}]},
  {library: 'ielts-reading-academic', version: 'v2', run: PILOT,
    note: 'academic-2 of v1 with the attention researcher of passage 3 renamed (the same name was used for another person in passage 1).',
    tests: [{key: 'academic-2', status: 'published', corrections: LINDQVIST}]},
  {library: 'ielts-reading-academic', version: 'v3', run: ACADEMIC_2, note: 'Eight new tests (P7.5, prompts rd-3), reviewed in full.',
    tests: published(range('academic', 3, 10))},
  {library: 'ielts-reading-general-training', version: 'v1', run: GT_1, note: 'Ten General Training tests (P7.5: gt-1 on prompts rd-2, the rest on rd-3), reviewed in full.',
    tests: published(range('gt', 1, 10))},
];

type Report = {id: string; prompts: string; tests: {id: string; file: string; prompts?: string}[]};
const rounds = new Map<string, {report: Report; tests: Map<string, ReadingTest>}>();
function round(run: string) {
  let r = rounds.get(run);
  if (!r) {
    const report = JSON.parse(readFileSync(join(root, run, 'report.json'), 'utf8')) as Report;
    r = {report, tests: new Map(report.tests.map(entry => [entry.id, JSON.parse(readFileSync(join(root, run, entry.file), 'utf8')) as ReadingTest]))};
    rounds.set(run, r);
  }
  return r;
}

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
  const lib = LIBRARIES[v.library];
  const {report, tests: source} = round(v.run);
  const tests = v.tests.map(entry => {
    const test = source.get(entry.key);
    if (!test) throw new Error(`${entry.key}: not in ${v.run}`);
    if (test.exam !== lib.examKey) throw new Error(`${entry.key}: exam ${test.exam}, the library is ${lib.examKey}`);
    const sections = (test.sections as (ReadingSection & {meta?: {topic: string}})[]).map(({meta, ...section}, i) => {
      const own = (entry.corrections ?? []).filter(c => c.section === i + 1);
      return {topic: meta?.topic ?? section.title, ...(own.length ? correct(section, own) : section)};
    });
    const problems = checkReadingTest({...test, sections});
    if (problems.length) throw new Error(`${entry.key}: ${problems.join('; ')}`);
    return {key: entry.key, status: entry.status, title: title(entry.key), sections};
  });
  const prompts = [...new Set(v.tests.map(entry => report.tests.find(t => t.id === entry.key)?.prompts ?? report.prompts))].join(', ');
  const library = {
    libraryKey: v.library,
    version: v.version,
    about: `Original IELTS-style ${lib.name} Reading practice tests written for GoNative Exam Prep by AI (not official IELTS material), each question checked by code, by two blind solvers and by a third controller model.`,
    ...(v.note ? {note: v.note} : {}),
    examKey: lib.examKey,
    sectionKey: 'reading',
    origin: 'generated',
    pipeline: {round: report.id, prompts, report: `${v.run}/report.json`},
    tests,
  };
  const out = `packages/exam-domain/library/${v.library}.${v.version}.json`;
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
