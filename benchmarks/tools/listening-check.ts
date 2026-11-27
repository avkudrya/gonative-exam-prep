/*
 * P7.9: the TS form and recording checks (exam-domain checkListeningTest) over the tests of a Listening round written by
 * MultiAdmin's exam:listening:pilot, so that both twins are seen to agree on real content, and the audio files of the
 * report are there with the hashes the tests name. Each map is drawn by exam-domain (renderMapSvg) into <dir>/maps/ for the
 * owner's review: the picture the learner will see.
 *
 *   npm run bench:listening-check -- benchmarks/runs/exam-listening-pilot-1
 */
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {checkListeningTest, describeMap, renderMapSvg, type ListeningTest} from '../../packages/exam-domain/src/index.js';

const dir = process.argv[2];
if (!dir) throw new Error('usage: listening-check <run directory>');
let failed = 0;
for (const file of readdirSync(join(dir, 'tests')).filter(f => f.endsWith('.json')).sort()) {
  const test = JSON.parse(readFileSync(join(dir, 'tests', file), 'utf8')) as ListeningTest;
  const problems = checkListeningTest(test);
  for (const [i, part] of test.parts.entries()) {
    const audio = part.audio;
    if (!audio) continue;
    const path = join(dir, audio.file);
    if (!existsSync(path)) problems.push(`part ${i + 1}: ${audio.file} is missing`);
    else if (createHash('sha256').update(readFileSync(path)).digest('hex') !== audio.sha256) problems.push(`part ${i + 1}: ${audio.file} does not match its hash`);
    // The map description the solvers read is the one exam-domain gives; the picture is drawn by the same spec.
    for (const [gi, g] of part.groups.entries()) {
      if (!g.figure) continue;
      describeMap(g.figure);
      mkdirSync(join(dir, 'maps'), {recursive: true});
      writeFileSync(join(dir, 'maps', `${test.id}-p${i + 1}-g${gi + 1}.svg`), renderMapSvg(g.figure));
    }
  }
  const questions = test.parts.flatMap(p => p.groups.flatMap(g => g.questions.flatMap(q => q.numbers))).length;
  console.log(`${file}: ${questions} questions, ${problems.length ? problems.join('; ') : 'no problems'}`);
  if (problems.length) failed++;
}
process.exitCode = failed ? 1 : 0;
