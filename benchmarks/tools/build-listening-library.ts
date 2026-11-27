/**
 * P7.10: the Listening library (packages/exam-domain/library/ielts-listening.v*.json) from the tests of the content rounds.
 *
 *   npm run bench:listening-library            rebuild the library files
 *   npm run bench:listening-library -- --check fail if a file differs from a fresh build
 *
 * Source: benchmarks/runs/<round>/tests/*.json and report.json (exam:listening:pilot). The audio is not in the library: each
 * part names its file in S3 by content, exam/listening/<sha256>.mp3, with the hash, size and length the recording check
 * measured; exam:listening:upload puts the local files there (after the owner's «да» on the list), exam:import-listening
 * refuses a part whose file is missing. One library serves Academic and General Training (the Listening test is the same).
 * A test is served only when "published"; "review" only with EXAM_LISTENING_DRAFTS. A content change is a new version.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkListeningTest, type ListeningPart, type ListeningTest} from '../../packages/exam-domain/src/index.js';

type Status = 'review' | 'published' | 'retired';
type Version = {version: string; run: string; note?: string; tests: {key: string; status: Status}[]};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PREFIX = 'exam/listening/';
const PILOT = 'benchmarks/runs/exam-listening-pilot-1';
const title = (key: string) => `Listening practice test ${key.replace(/^l/, '')}`;
// 2026-11-27: the owner listened to the whole pilot («послушал, всё ок»); Claude reviewed the 80 questions (P7.9 §3–4).
const VERSIONS: Version[] = [
  {version: 'v1', run: PILOT, note: 'The two pilot tests (P7.9), reviewed in full and listened to by the owner.',
    tests: [{key: 'l1', status: 'published'}, {key: 'l2', status: 'published'}]},
];

type Audio = {file: string; sha256: string; bytes: number; durationMs: number};
type Report = {id: string; tests: {id: string; file: string}[]; soundCheck?: Audio & {text: string; voice: {provider: string; voice: string}}};
const s3 = (sha256: string) => `${PREFIX}${sha256}.mp3`;

function part(p: ListeningPart & {meta?: {topic: string}}): ListeningPart & {topic: string} {
  const {meta, ...rest} = p;
  if (!rest.audio) throw new Error(`${rest.title}: no audio`);
  return {
    ...rest,
    topic: meta?.topic ?? rest.title,
    // What the voice was given stays in the round's files: the product needs only what was said.
    turns: rest.turns.map(({say: _say, ...t}) => t),
    audio: {...rest.audio, file: s3(rest.audio.sha256)},
  };
}

const check = process.argv.includes('--check');
let stale = false;
for (const v of VERSIONS) {
  const report = JSON.parse(readFileSync(join(root, v.run, 'report.json'), 'utf8')) as Report;
  if (!report.soundCheck) throw new Error(`${v.run}: no sound check`);
  const tests = v.tests.map(entry => {
    const source = report.tests.find(t => t.id === entry.key);
    if (!source) throw new Error(`${entry.key}: not in ${v.run}`);
    const test = JSON.parse(readFileSync(join(root, v.run, source.file), 'utf8')) as ListeningTest;
    const parts = test.parts.map(p => part(p as ListeningPart & {meta?: {topic: string}}));
    const problems = checkListeningTest({...test, parts});
    if (problems.length) throw new Error(`${entry.key}: ${problems.join('; ')}`);
    return {key: entry.key, status: entry.status, title: title(entry.key), parts};
  });
  const sound = report.soundCheck;
  const library = {
    libraryKey: 'ielts-listening',
    version: v.version,
    about: 'Original IELTS-style Listening practice tests written for GoNative Exam Prep by AI (not official IELTS material), each question checked by code, by two blind solvers and by a third controller model; recorded with synthetic voices and checked by transcription.',
    ...(v.note ? {note: v.note} : {}),
    examKeys: ['ielts-academic', 'ielts-general-training'],
    sectionKey: 'listening',
    origin: 'generated',
    pipeline: {round: report.id, report: `${v.run}/report.json`},
    soundCheck: {text: sound.text, file: s3(sound.sha256), sha256: sound.sha256, bytes: sound.bytes, durationMs: sound.durationMs},
    tests,
  };
  const out = `packages/exam-domain/library/ielts-listening.${v.version}.json`;
  const text = `${JSON.stringify(library, null, 2)}\n`;
  if (check) {
    let current = '';
    try { current = readFileSync(join(root, out), 'utf8'); } catch { /* missing */ }
    if (current !== text) {
      console.error(`${out} is stale: run npm run bench:listening-library`);
      stale = true;
    }
  } else {
    writeFileSync(join(root, out), text);
    console.log(`${out}: ${tests.map(t => `${t.key} ${t.status}`).join(', ')}; audio ${tests.flatMap(t => t.parts).length + 1} files`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log('Listening libraries are current');
}
