import {readdirSync, readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  checkListeningAudio, checkListeningPart, checkListeningTest, checkMapSpec, compass, describeMap, findHeard, LISTENING_FORMAT,
  listeningBlocks, listeningEstimate, readingEstimate, renderMapSvg, type ListeningPart, type MapSpec,
} from '../src/index.js';

// Our own part 2 (written for the tests) with a map, multiple choice and notes, and a fake assembled recording; shared with
// MultiAdmin's ListeningForm tests.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/listening-part.json', import.meta.url), 'utf8')) as {part: ListeningPart; index: number; mapDescription: string};
const part = (): ListeningPart => structuredClone(fixture.part);
const map = (): MapSpec => structuredClone(fixture.part.groups[0].figure!);

test('the shared part is well formed, and so is its recording', () => {
  assert.deepEqual(checkListeningPart(part(), fixture.index), []);
  assert.deepEqual(checkListeningAudio(part()), []);
  assert.deepEqual(listeningBlocks(part()).map(b => [b.type, b.from, b.to]), [['map_labelling', 11, 14], ['multiple_choice', 15, 17], ['note_completion', 18, 20]]);
});

test('form checks find what makes a Listening question unanswerable or unfair', () => {
  const cases: [string, (p: ListeningPart) => void, RegExp][] = [
    ['evidence not said', p => { p.groups[1].questions[0].evidence = 'come every Saturday without fail'; }, /evidence is not in the recording/],
    ['questions out of order', p => { p.groups[0].questions.reverse(); }, /out of the recording's order/],
    ['answers too close', p => { p.groups[4].questions[1].evidence = 'because some of the ground is very uneven'; p.groups[4].questions[1].answer = ['uneven']; }, /fewer than 15 words after the previous answer/],
    ['completion answer not in its evidence', p => { p.groups[4].questions[0].answer = ['shoes']; }, /is not in its evidence/],
    ['over the word limit', p => { p.groups[4].questions[0].answer = ['boots', 'strong boots']; }, /over the word limit/],
    ['map letter that is not on the map', p => { p.groups[0].questions[0].answer = ['F']; }, /not an option/],
    ['map with as many letters as questions', p => { p.groups[0].figure!.features = p.groups[0].figure!.features.filter(f => f.letter !== 'A').map(f => f.letter ? {...f, letter: String.fromCharCode(f.letter.charCodeAt(0) - 1)} : f); p.groups[0].questions.forEach(q => { q.answer = [String.fromCharCode(q.answer[0].charCodeAt(0) - 1)]; }); }, /more letters than questions/],
    ['options given for a map', p => { p.groups[0].options = [{id: 'A', text: 'A'}]; }, /come from the map's letters/],
    ['unknown speaker', p => { p.turns[2].speaker = 'guest'; }, /unknown speaker "guest"/],
    ['too many speakers for part 2', p => { p.speakers.push({id: 'a', name: 'A B', gender: 'male', accent: 'british', role: 'x'}, {id: 'b', name: 'C D', gender: 'male', accent: 'british', role: 'y'}); }, /3 speakers, part 2 has 1-2/],
    ['too short', p => { p.turns = p.turns.slice(0, 2); }, /words spoken, not 500-1000/],
    ['a new block in the turn that ends the last', p => { p.groups[0].questions[3].evidence = "What we do ask is that you let us know by Thursday evening"; }, /out of the recording's order|new block begins/],
    ['empty say', p => { p.turns[0].say = ' '; }, /turn 1: empty/],
    ['no word limit', p => { delete p.groups[4].limit; }, /no word limit/],
  ];
  for (const [name, change, expected] of cases) {
    const p = part();
    change(p);
    assert.match(checkListeningPart(p, fixture.index).join('\n'), expected, name);
  }
});

test('a new block may not begin in the turn where the previous block ends', () => {
  const p = part();
  // Question 15's evidence moves into turn 4, where question 14 is answered.
  p.turns[3].text += ' Please let us know by Thursday evening if you are coming on the Saturday, and remember that we meet every week, all year round.';
  p.groups[1].questions[0].evidence = 'Please let us know by Thursday evening if you are coming on the Saturday';
  assert.match(checkListeningPart(p, fixture.index).join('\n'), /new block begins in the turn where the previous block ends/);
});

test('findHeard finds a quote in order and counts the words before it', () => {
  const turns = [{speaker: 'a', text: 'One two three.'}, {speaker: 'b', text: 'Four five, four five six.'}];
  assert.deepEqual(findHeard(turns, 'four five'), {turn: 1, start: 0, end: 9, wordsBefore: 3});
  assert.deepEqual(findHeard(turns, 'four five', {turn: 1, end: 9}), {turn: 1, start: 11, end: 20, wordsBefore: 5});
  assert.equal(findHeard(turns, 'one', {turn: 1, end: 0}), null);
});

test('audio checks: end to end segments, every turn once, reading pauses per block, a checking pause, time between answers', () => {
  const cases: [string, (p: ListeningPart) => void, RegExp][] = [
    ['a gap in the segments', p => { p.audio!.segments[1].startMs += 10; }, /does not follow the previous one/],
    ['a turn twice', p => { const t = p.audio!.segments.find(s => s.kind === 'turn' && s.turn === 3)!; Object.assign(t, {turn: 2}); }, /missing, repeated or out of order/],
    ['no voice for the narrator', p => { delete p.audio!.voices.narrator; }, /narrator has no voice/],
    ['no checking pause', p => { const s = p.audio!.segments; s.pop(); p.audio!.durationMs = s.at(-1)!.endMs; }, /does not end with the checking pause/],
    ['a missing reading pause', p => { const s = p.audio!.segments.find(x => x.kind === 'pause' && x.questions?.[0] === 15)!; Object.assign(s, {purpose: 'check', questions: undefined}); }, /reading pauses 11-14, 18-20, blocks 11-14, 15-17, 18-20/],
    ['answers squeezed together', p => { const t = p.audio!.segments.find(s => s.kind === 'turn' && s.turn === 6)!; const shift = t.endMs - t.startMs - 4000; t.endMs -= shift; p.audio!.segments.slice(p.audio!.segments.indexOf(t) + 1).forEach(s => { s.startMs -= shift; s.endMs -= shift; }); p.audio!.durationMs -= shift; }, /ms after the previous answer/],
  ];
  for (const [name, change, expected] of cases) {
    const p = part();
    change(p);
    assert.match(checkListeningAudio(p).join('\n'), expected, name);
  }
  assert.deepEqual(checkListeningAudio({...part(), audio: undefined}), ['no audio']);
});

test('a test has four parts of ten questions numbered 1-40 and more than one accent', () => {
  const p = part();
  const problems = checkListeningTest({id: 't', parts: [p, p, p, p]}).join('\n');
  assert.match(problems, /part 1: questions must be 1-10/);
  assert.match(problems, /part 1: 1 speakers, part 1 has 2/);
  assert.match(problems, /all speakers have the same accent/);
  assert.match(checkListeningTest({id: 't', parts: [p]}).join('\n'), /1 parts, not 4/);
});

test('Listening bands use the Academic Reading thresholds (P6.1 §6)', () => {
  for (let raw = 0; raw <= 40; raw++) assert.deepEqual(listeningEstimate(raw), readingEstimate(raw, 'ielts-academic'), `raw ${raw}`);
  assert.equal(listeningEstimate(15), null);
  assert.deepEqual(listeningEstimate(30), {low: 7, high: 7});
  assert.equal(LISTENING_FORMAT.questions, LISTENING_FORMAT.parts * LISTENING_FORMAT.questionsPerPart);
});

test('a map is checked, described and drawn by code', () => {
  assert.deepEqual(checkMapSpec(map()), []);
  // The same text as MultiAdmin's ListeningMap::describe.
  assert.equal(describeMap(map()), fixture.mapDescription);
  const cases: [string, (m: MapSpec) => void, RegExp][] = [
    ['overlap', m => { m.features[1].x = 1; }, /overlaps/],
    ['outside', m => { m.features[0].x = 11; }, /outside the grid/],
    ['letter and label', m => { m.features[0].label = 'Shed'; }, /needs a label or a letter, not both/],
    ['letters not A-E', m => { m.features[0].letter = 'F'; }, /letters must be A-E/],
    ['a name twice', m => { m.features[5].label = 'lake'; }, /a name is used twice/],
    ['a diagonal path', m => { m.paths[0].points[1] = [5, 5]; }, /not straight/],
    ['too few letters', m => { m.features = m.features.filter(f => !f.letter || f.letter < 'C'); }, /fewer than 3 letters/],
    ['not a map', m => { (m as {format: string}).format = 'chart-spec/1'; }, /format/],
  ];
  for (const [name, change, expected] of cases) {
    const m = map();
    change(m);
    assert.match(checkMapSpec(m).join('\n'), expected, name);
  }
  const svg = renderMapSvg(map());
  assert.equal(svg, renderMapSvg(map()));
  assert.match(svg, /^<svg [^>]*role="img"/);
  for (const letter of 'ABCDE') assert.match(svg, new RegExp(`>${letter}</text>`));
  assert.match(svg, />Visitor centre<\/text>|>Visitor<\/text>/);
  const evil = map();
  evil.title = '<script>"x"</script>';
  assert.doesNotMatch(renderMapSvg(evil), /<script>/);
});

test('compass points: north is up, and halves round the same way as in PHP', () => {
  assert.equal(compass(0, 0, 0, -1), 'north');
  assert.equal(compass(0, 0, 1, 0), 'east');
  assert.equal(compass(0, 0, 1, 1), 'south-east');
  assert.equal(compass(0, 0, -1, 0), 'west');
  assert.equal(compass(4, 8, 1, 1), 'north-west');
  // Exactly between two points (22.5°) goes to the counter-clockwise one, on both sides.
  const half = Math.tan(Math.PI / 8);
  assert.equal(compass(0, 0, 1, -half), compass(0, 0, 1, -half));
});

test('the Listening library: every test passes the checks, every question is explained in three languages, audio named by content', () => {
  const dir = new URL('../library/', import.meta.url);
  const files = readdirSync(dir).filter(f => /^ielts-listening\.v\d+\.json$/.test(f));
  assert.ok(files.length >= 1);
  for (const file of files) {
    const l = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    assert.deepEqual([l.libraryKey, l.sectionKey, l.examKeys], ['ielts-listening', 'listening', ['ielts-academic', 'ielts-general-training']], file);
    const named = (a: {file: string; sha256: string; bytes: number; durationMs: number}) => {
      assert.equal(a.file, `exam/listening/${a.sha256}.mp3`, file);
      assert.ok(/^[0-9a-f]{64}$/.test(a.sha256) && a.bytes > 0 && a.durationMs > 0, file);
    };
    named(l.soundCheck);
    assert.ok(l.soundCheck.text.trim(), 'sound check text');
    for (const t of l.tests) {
      assert.ok(['review', 'published', 'retired'].includes(t.status), t.key);
      assert.deepEqual(checkListeningTest({id: t.key, parts: t.parts}), [], `${file} ${t.key}`);
      for (const p of t.parts) {
        named(p.audio);
        assert.ok(p.turns.every((turn: {say?: string}) => turn.say === undefined), 'no text for the voice in the product');
        for (const g of p.groups) for (const q of g.questions) {
          for (const lang of ['en', 'ru', 'uk']) assert.ok(q.explanation[lang]?.trim(), `${t.key} ${q.numbers.join('-')} ${lang}`);
        }
      }
    }
  }
});
