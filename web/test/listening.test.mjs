import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

// P7.10: IELTS Listening — the sound check, one part in exam mode on the server's schedule (autosave, the automatic submit at
// the end), the review with the transcript and "Listen to this place"; a full test in practice mode with the map of part 2.
const TOKEN = '41|listening-session-fixture';
const library = JSON.parse(readFileSync(new URL('../../packages/exam-domain/library/ielts-listening.v1.json', import.meta.url), 'utf8'));
const source = library.tests[0];
const TEST = {uuid: randomUUID(), title: source.title};
const PART_MS = 8000; // the mock's schedule: short parts, so the test sees a part start, play and close
const LEAD_MS = 3000;

/** A silent mono WAV: the browser plays it like the real recordings. */
function wav(seconds) {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8); head.write('fmt ', 12);
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const publicGroup = g => ({type: g.type, instruction: g.instruction, ...(g.title ? {title: g.title} : {}), ...(g.options ? {options: g.options} : {}),
  ...(g.figure ? {figure: g.figure} : {}), ...(g.limit ? {limit: g.limit} : {}), questions: g.questions.map(q => ({numbers: q.numbers, prompt: q.prompt}))});
const key = (g, q, i) => g.type === 'multiple_choice_multi' ? q.answer[i] : q.answer[0];

test('Listening: one part in exam mode on the schedule with the automatic submit and the review; a full practice test with the map', {timeout: 240000}, async t => {
  const audio = createServer((req, res) => {
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'none');
    res.end(wav(10));
  });
  await new Promise(resolve => audio.listen(0, '127.0.0.1', resolve));
  t.after(() => audio.close());
  const audioUrl = name => `http://127.0.0.1:${audio.address().port}/exam/listening/${name}.wav`;

  const now = () => new Date().toISOString();
  const state = {attempt: null, saves: [], done: []};
  const view = () => {
    const a = state.attempt;
    const mine = source.parts.map((p, i) => ({p, position: i + 1})).filter(x => a.mode === 'test' || x.position === a.part);
    let at = Date.parse(a.started_at);
    const parts = mine.map(({p, position}) => {
      const starts = a.timer_mode === 'strict' ? new Date(at).toISOString() : null;
      at += PART_MS;
      const ends = a.timer_mode === 'strict' ? new Date(at).toISOString() : null;
      const base = {position, title: p.title, context: p.context, duration_ms: a.timer_mode === 'strict' ? PART_MS : p.audio.durationMs, starts_at: starts, ends_at: ends,
        closed: false, audio: {url: audioUrl(`p${position}`), expires_at: new Date(Date.now() + 3600e3).toISOString()}};
      if (a.status !== 'submitted') return {...base, groups: p.groups.map(publicGroup)};
      const startsOf = Object.fromEntries(p.audio.segments.filter(s => s.kind === 'turn').map(s => [s.turn, s.startMs]));
      const names = Object.fromEntries(p.speakers.map(s => [s.id, s.name]));
      const lower = p.turns.map(x => x.text.toLowerCase());
      return {...base, speakers: p.speakers.map(s => ({id: s.id, name: s.name})),
        turns: p.turns.map((x, i) => ({speaker: names[x.speaker], text: x.text, start_ms: startsOf[i] ?? null})),
        groups: p.groups.map(g => ({...g, questions: g.questions.map(q => {
          const turn = lower.findIndex(text => text.includes(q.evidence.toLowerCase().slice(0, 30)));
          return {...q, heard: turn >= 0 ? {turn, start_ms: startsOf[turn]} : null};
        })}))};
    });
    const base = {uuid: a.uuid, status: a.status, mode: a.mode, part: a.part, timer_mode: a.timer_mode, duration_ms: parts.reduce((s, p) => s + p.duration_ms, 0),
      test: {uuid: TEST.uuid, title: TEST.title}, started_at: a.started_at, deadline_at: a.timer_mode === 'strict' ? new Date(at).toISOString() : null,
      submitted_at: a.submitted_at, server_time: now()};
    if (a.status !== 'submitted') return {...base, parts, answers: a.answers, revision: a.revision};
    const rows = [];
    for (const {p} of mine) for (const g of p.groups) for (const q of g.questions) q.numbers.forEach((n, i) => {
      const given = a.answers[n] ?? null;
      const ok = given !== null && (g.type === 'multiple_choice_multi' ? q.answer.includes(given) : q.answer.some(x => x.toLowerCase() === given.trim().toLowerCase()));
      rows.push({number: n, given, correct: ok, expected: key(g, q, i)});
    });
    const correct = rows.filter(r => r.correct).length;
    const types = {};
    for (const {p} of mine) for (const g of p.groups) for (const q of g.questions) for (const n of q.numbers) {
      types[g.type] ??= {type: g.type, correct: 0, total: 0};
      types[g.type].total += 1;
      types[g.type].correct += rows.find(r => r.number === n).correct ? 1 : 0;
    }
    const byPart = mine.map(({p, position}) => {
      const ns = p.groups.flatMap(g => g.questions.flatMap(q => q.numbers));
      return {part: position, total: ns.length, correct: rows.filter(r => ns.includes(r.number) && r.correct).length};
    });
    return {...base, parts, answers: a.answers, revision: a.revision, result: {correct, total: rows.length, questions: rows, by_type: Object.values(types), by_part: byPart},
      estimate: a.mode === 'test' && a.timer_mode === 'strict' && correct >= 35 ? {precision: 'approximate', low: 8, high: 9} : null};
  };
  const summary = () => {
    const v = view();
    return {uuid: v.uuid, status: v.status, mode: v.mode, part: v.part, timer_mode: v.timer_mode, duration_ms: v.duration_ms, test: v.test, started_at: v.started_at,
      deadline_at: v.deadline_at, submitted_at: v.submitted_at, server_time: v.server_time,
      correct: v.result?.correct ?? null, total: v.result?.total ?? null, estimate: v.estimate ?? null};
  };
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-academic', feedback_language: 'ru'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1,
      listening_tests: {enabled: true, limit: 2, used: state.done.length, remaining: 2 - state.done.length}});
    if (path.startsWith('attempts?')) return json(200, {attempts: [], page: 1, per_page: 5, total: 0});
    if (path === 'listening' && method === 'GET') {
      const open = state.attempt?.status === 'started';
      return json(200, {enabled: true, usage: {enabled: true, limit: null, used: state.done.length, remaining: null},
        tests: [{uuid: TEST.uuid, title: TEST.title, review: false, parts: source.parts.map((p, i) => ({position: i + 1, title: p.title, topic: p.topic, questions: 10,
          numbers: [i * 10 + 1, i * 10 + 10], duration_ms: p.audio.durationMs}))}],
        sound_check: {text: library.soundCheck.text, duration_ms: library.soundCheck.durationMs, url: audioUrl('sound-check')},
        open: open ? summary() : null, attempts: state.attempt?.status === 'submitted' ? [summary()] : []});
    }
    if (path === 'listening/attempts' && method === 'POST') {
      assert.equal(body.test, TEST.uuid);
      state.attempt = {uuid: randomUUID(), status: 'started', mode: body.mode, part: body.part ?? null, timer_mode: body.timer_mode, answers: {}, revision: 0,
        started_at: new Date(Date.now() + (body.timer_mode === 'strict' ? LEAD_MS : 0)).toISOString(), submitted_at: null};
      return json(201, {attempt: view()});
    }
    const m = /^listening\/attempts\/([0-9a-f-]{36})(?:\/(answers|submit|abandon))?$/.exec(path);
    if (m && state.attempt?.uuid === m[1]) {
      const a = state.attempt;
      if (m[2] === 'answers') {
        state.saves.push(body.answers);
        a.answers = Object.fromEntries(Object.entries(body.answers).filter(([, v]) => v));
        a.revision += 1;
        return json(200, {revision: a.revision, answers: a.answers, server_time: now()});
      }
      if (m[2] === 'submit') {
        if (body.answers) a.answers = Object.fromEntries(Object.entries(body.answers).filter(([, v]) => v));
        a.status = 'submitted';
        a.submitted_at = now();
        state.done.push(a.uuid);
      }
      return json(200, {attempt: view()});
    }
    return problem(404, 'not_found');
  });
  const {origin} = await startApp(t, api.url);
  const browser = await chromium.launch({headless: true, args: ['--autoplay-policy=no-user-gesture-required']});
  t.after(() => browser.close());
  const page = await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage();

  await page.goto(`${origin}/en/login`);
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('correct-password');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);

  // The member menu shows Listening while it is on; the page offers the sound check and says the voices are synthetic.
  await page.getByRole('navigation', {name: 'Sections'}).getByRole('link', {name: 'Listening'}).click();
  await page.waitForURL(`${origin}/en/ielts/listening`);
  await page.getByRole('heading', {name: TEST.title}).waitFor();
  await page.getByRole('heading', {name: 'Sound check'}).waitFor();
  assert.equal(await page.locator('.listening-sound-check audio').getAttribute('src'), audioUrl('sound-check'));
  await page.getByText('The recordings are voiced by speech synthesis.').waitFor();
  await page.getByText('Your plan has no limit on Listening tests.').waitFor();
  assert.equal(await page.getByRole('radio', {name: /^Exam/}).isChecked(), true, 'exam mode by default');

  // Part 1 alone in exam mode: a short wait, then the recording plays on the schedule.
  await page.getByRole('button', {name: /^This part · about \d+ min$/}).first().click();
  await page.waitForURL(/\/en\/ielts\/listening\/[0-9a-f-]{36}$/);
  assert.deepEqual([state.attempt.mode, state.attempt.part, state.attempt.timer_mode], ['part', 1, 'strict']);
  assert.match(await page.getByRole('timer').innerText(), /^Part 1 starts in 0:0\d$/);
  await page.getByRole('timer').filter({hasText: /^Part 1 · 0:0\d left$/}).waitFor({timeout: 10000});
  await page.waitForFunction(() => { const a = document.querySelector('.listening-player audio'); return a && !a.paused && a.currentTime > 0; }, null, {timeout: 10000});
  assert.equal(await page.locator('.listening-player audio[controls]').count(), 0, 'no controls in exam mode');

  // Answer the form as the key says, except question 2; autosave.
  const form = source.parts[0].groups[0];
  for (const q of form.questions) {
    const n = q.numbers[0];
    await page.getByRole('textbox', {name: `Question ${n}`, exact: true}).fill(n === 2 ? '12th' : q.answer[0]);
  }
  await page.locator('#q-3').getByRole('button', {name: 'Review later'}).click();
  await page.waitForFunction(() => document.querySelector('.save-state')?.textContent === 'Saved');
  await new Promise(r => setTimeout(r, 1800));
  assert.equal(state.saves.at(-1)['1'], form.questions[0].answer[0]);

  // The recording ends: the answers are submitted by themselves and the review opens.
  await page.getByRole('heading', {name: 'Your result'}).waitFor({timeout: 20000});
  assert.equal(state.attempt.status, 'submitted');
  await page.getByText(`${form.questions.length - 1} / 10`).waitFor();
  await page.getByText('One part alone has no band', {exact: false}).waitFor();
  await page.getByRole('table', {name: 'By question type'}).getByText('Form completion').waitFor();
  await page.locator('#q-1').getByText(form.questions[0].explanation.ru).waitFor();
  await page.locator('#q-2').getByText('correct:', {exact: false}).waitFor();
  await page.getByRole('heading', {name: 'Transcript'}).waitFor();
  await page.locator('.listening-transcript').getByText(source.parts[0].turns[0].text).waitFor();
  // "Listen to this place" lights the turn where the answer is heard and plays from it.
  await page.locator('#q-1').getByRole('button', {name: 'Listen to this place'}).click();
  await page.locator('.listening-transcript p.active').waitFor();
  assert.match(await page.locator('.listening-transcript p.active').innerText(), /B-R-E-R-E-T-O-N/);
  assert.equal(await page.locator('.listening-player audio[controls]').count(), 1, 'the review can be listened to again');

  // A full test in practice mode: tabs of four parts, the map of part 2 drawn from its spec, the player with its controls.
  await page.getByRole('link', {name: 'Another test'}).click();
  await page.waitForURL(`${origin}/en/ielts/listening`);
  await page.getByText('Your recent attempts').waitFor();
  await page.getByRole('radio', {name: /^Practice/}).check();
  await page.getByRole('button', {name: /^Full test · about \d+ min$/}).click();
  await page.waitForURL(/\/en\/ielts\/listening\/[0-9a-f-]{36}$/);
  assert.deepEqual([state.attempt.mode, state.attempt.timer_mode], ['test', 'soft']);
  await page.getByRole('button', {name: '10 s back'}).waitFor();
  await page.getByLabel('Speed').selectOption('0.85');
  assert.equal(await page.locator('.listening-player audio').evaluate(a => a.playbackRate), 0.85);
  await page.getByRole('button', {name: 'Part 2', exact: true}).click();
  await page.locator('.listening-map svg').waitFor();
  const map = source.parts[1].groups[0];
  assert.equal(map.type, 'map_labelling');
  const letters = await page.getByRole('combobox', {name: 'Question 11', exact: true}).locator('option').allInnerTexts();
  assert.deepEqual(letters.slice(1), map.figure.features.map(f => f.letter).filter(Boolean).sort());
  const all = {};
  for (const p of source.parts) for (const g of p.groups) for (const q of g.questions) q.numbers.forEach((n, i) => { all[n] = key(g, q, i); });
  await page.evaluate(([uuid, answers]) => localStorage.setItem(`listening:${uuid}:answers`, JSON.stringify(answers)), [state.attempt.uuid, all]);
  await page.reload();
  await page.locator('nav[aria-label="Questions"] button.answered').nth(39).waitFor({timeout: 10000});
  await page.getByRole('button', {name: 'Submit answers'}).click();
  await page.getByRole('dialog', {name: 'Submit your answers?'}).getByText('You have answered 40 of 40 questions.').waitFor();
  await page.getByRole('dialog').getByRole('button', {name: 'Submit', exact: true}).click();
  await page.getByText('40 / 40').waitFor();
  await page.getByText('In practice mode we show the score only', {exact: false}).waitFor();
  assert.equal(await page.getByText('≈ 8–9').count(), 0, 'no band in practice mode');
  await page.getByRole('table', {name: 'By part'}).getByText('10 / 10').first().waitFor();
});
