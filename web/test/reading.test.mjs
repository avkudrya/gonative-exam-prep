import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

// P7.4: IELTS Reading — choose a test or a passage, answer beside the passage with a timer and autosave, submit, the review.
const TOKEN = '41|reading-session-fixture';
const library = JSON.parse(readFileSync(new URL('../../packages/exam-domain/library/ielts-reading-academic.v1.json', import.meta.url), 'utf8'));
const source = library.tests[0];
const TEST = {uuid: randomUUID(), title: source.title};
const FIXED = {true_false_not_given: [{id: 'T', text: 'TRUE'}, {id: 'F', text: 'FALSE'}, {id: 'NG', text: 'NOT GIVEN'}],
  yes_no_not_given: [{id: 'Y', text: 'YES'}, {id: 'N', text: 'NO'}, {id: 'NG', text: 'NOT GIVEN'}]};
const sections = source.sections.map((s, i) => ({position: i + 1, title: s.title, text: s.text, groups: s.groups}));
const numbers = s => s.groups.flatMap(g => g.questions.flatMap(q => q.numbers));
const publicGroup = g => ({type: g.type, instruction: g.instruction, options: FIXED[g.type] ?? g.options, ...(g.limit ? {limit: g.limit} : {}),
  questions: g.questions.map(q => ({numbers: q.numbers, prompt: q.prompt}))});

test('Reading: a passage on a soft timer with autosave and the review; a full test with its approximate band', {timeout: 240000}, async t => {
  const now = () => new Date().toISOString();
  const state = {attempt: null, saves: [], done: []};
  const view = () => {
    const a = state.attempt;
    const mine = a.mode === 'test' ? sections : sections.filter(s => s.position === a.section);
    const base = {uuid: a.uuid, status: a.status, mode: a.mode, section: a.section, timer_mode: a.timer_mode, duration_seconds: a.mode === 'test' ? 3600 : 1200,
      test: {uuid: TEST.uuid, title: TEST.title, exam_key: 'ielts-academic'}, started_at: a.started_at, deadline_at: a.deadline_at, submitted_at: a.submitted_at, server_time: now()};
    if (a.status !== 'submitted') return {...base, sections: mine.map(s => ({...s, groups: s.groups.map(publicGroup)})), answers: a.answers, revision: a.revision};
    const rows = [];
    for (const s of mine) for (const g of s.groups) for (const q of g.questions) q.numbers.forEach((n, i) => {
      const key = g.type === 'multiple_choice_multi' ? q.answer[i] : q.answer[0];
      const given = a.answers[n] ?? null;
      rows.push({number: n, given, correct: given !== null && q.answer.some(x => x.toLowerCase() === given.toLowerCase()) && (g.type !== 'multiple_choice_multi' || q.answer.includes(given)), expected: key});
    });
    const correct = rows.filter(r => r.correct).length;
    const types = {};
    for (const s of mine) for (const g of s.groups) for (const q of g.questions) for (const n of q.numbers) {
      types[g.type] ??= {type: g.type, correct: 0, total: 0};
      types[g.type].total += 1;
      types[g.type].correct += rows.find(r => r.number === n).correct ? 1 : 0;
    }
    return {...base, sections: mine, answers: a.answers, revision: a.revision,
      result: {correct, total: rows.length, questions: rows, by_type: Object.values(types)},
      estimate: a.mode === 'test' && correct >= 35 ? {precision: 'approximate', low: 8, high: 9} : null};
  };
  const summary = () => ({...view(), sections: undefined, answers: undefined, revision: undefined, result: undefined,
    correct: state.attempt.status === 'submitted' ? view().result.correct : null, total: state.attempt.status === 'submitted' ? view().result.total : null,
    estimate: state.attempt.status === 'submitted' ? view().estimate : null});
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-academic', feedback_language: 'ru'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1,
      reading_tests: {enabled: true, limit: 2, used: state.done.length, remaining: 2 - state.done.length}});
    if (path.startsWith('attempts?')) return json(200, {attempts: [], page: 1, per_page: 5, total: 0});
    if (path === 'reading' && method === 'GET') {
      const open = state.attempt?.status === 'started';
      return json(200, {enabled: true, usage: {enabled: true, limit: 2, used: state.done.length + (open ? 1 : 0), remaining: 2 - state.done.length - (open ? 1 : 0)},
        tests: [{uuid: TEST.uuid, exam_key: 'ielts-academic', title: TEST.title, review: true,
          sections: sections.map(s => ({position: s.position, title: s.title, topic: s.title, words: 850, questions: numbers(s).length, numbers: [Math.min(...numbers(s)), Math.max(...numbers(s))]}))}],
        open: open ? summary() : null, attempts: state.attempt?.status === 'submitted' ? [summary()] : []});
    }
    if (path === 'reading/attempts' && method === 'POST') {
      assert.equal(body.test, TEST.uuid);
      state.attempt = {uuid: randomUUID(), status: 'started', mode: body.mode, section: body.section ?? null, timer_mode: body.timer_mode, answers: {}, revision: 0,
        started_at: now(), deadline_at: new Date(Date.now() + (body.mode === 'test' ? 3600e3 : 1200e3)).toISOString(), submitted_at: null};
      return json(201, {attempt: view()});
    }
    const m = /^reading\/attempts\/([0-9a-f-]{36})(?:\/(answers|submit|abandon))?$/.exec(path);
    if (m && state.attempt?.uuid === m[1]) {
      const a = state.attempt;
      if (m[2] === 'answers') {
        state.saves.push(body.answers);
        a.answers = Object.fromEntries(Object.entries(body.answers).filter(([, v]) => v));
        a.revision += 1;
        return json(200, {revision: a.revision, server_time: now()});
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
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await (await browser.newContext({viewport: {width: 1280, height: 900}})).newPage();

  await page.goto(`${origin}/en/login`);
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('correct-password');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);

  // The member menu shows Reading while it is on.
  await page.getByRole('navigation', {name: 'Sections'}).getByRole('link', {name: 'Reading'}).click();
  await page.waitForURL(`${origin}/en/ielts/reading`);
  await page.getByRole('heading', {name: TEST.title}).waitFor();
  await page.getByText('In review').waitFor();
  await page.getByText('Free plan: 2 of 2 Reading tests left this month', {exact: false}).waitFor();

  // Passage 1 alone, soft timer.
  await page.getByRole('button', {name: 'This passage · 20 min'}).first().click();
  await page.waitForURL(/\/en\/ielts\/reading\/[0-9a-f-]{36}$/);
  assert.equal(state.attempt.mode, 'section');
  assert.equal(state.attempt.section, 1);
  assert.equal(state.attempt.timer_mode, 'soft');
  assert.match(await page.getByRole('timer').innerText(), /^(19:5\d|20:00) left$/);
  await page.getByRole('heading', {name: sections[0].title}).waitFor();

  // Answer as the key says, except question 2; one gap typed; question 3 flagged.
  const g0 = sections[0].groups[0];
  const label = id => FIXED[g0.type].find(o => o.id === id).text;
  for (const q of g0.questions) {
    const n = q.numbers[0];
    const want = n === 2 ? (q.answer[0] === 'T' ? 'F' : 'T') : q.answer[0];
    await page.locator(`#q-${n}`).getByLabel(label(want), {exact: true}).check();
  }
  const gapGroup = sections[0].groups.find(g => g.limit);
  const gap = gapGroup.questions[0];
  await page.getByRole('textbox', {name: `Question ${gap.numbers[0]}`}).fill(gap.answer[0]);
  await page.locator('#q-3').getByRole('button', {name: 'Review later'}).click();
  await page.locator('nav[aria-label="Questions"] button.flagged', {hasText: '3'}).waitFor();
  await page.getByText('Saved', {exact: true}).waitFor({timeout: 10000});
  await page.waitForFunction(() => document.querySelector('.save-state')?.textContent === 'Saved');
  await new Promise(r => setTimeout(r, 1800));
  assert.ok(state.saves.length >= 1, 'answers autosaved');
  assert.equal(state.saves.at(-1)[String(gap.numbers[0])], gap.answer[0]);

  // Highlight a phrase in the passage.
  await page.locator('.reading-passage p[data-p="0"]').evaluate(p => {
    const node = p.firstChild;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(node, 10);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await page.getByRole('button', {name: 'Highlight selection'}).click();
  assert.equal(await page.locator('.reading-passage mark').count(), 1);

  await page.getByRole('button', {name: 'Submit answers'}).click();
  const dialog = page.getByRole('dialog', {name: 'Submit your answers?'});
  await dialog.getByText(`You have answered ${g0.questions.length + 1} of 13 questions.`).waitFor();
  await dialog.getByText('1 question is marked for review.').waitFor();
  await dialog.getByRole('button', {name: 'Submit', exact: true}).click();

  // The review: raw score, no band for a passage, by type, explanations in the learner's language (ru), the evidence lit.
  await page.getByRole('heading', {name: 'Your result'}).waitFor();
  await page.getByText(`${g0.questions.length} / 13`).waitFor();
  await page.getByText('One passage alone has no band', {exact: false}).waitFor();
  await page.getByRole('table', {name: 'By question type'}).getByText('True / False / Not Given').waitFor();
  const q1 = g0.questions[0];
  await page.locator('#q-1').getByText(q1.explanation.ru).waitFor();
  await page.locator('#q-2').getByText('correct:', {exact: false}).waitFor();
  // Option answers by their words, not their ids.
  await page.locator('#q-1').getByText(`Your answer: ${label(q1.answer[0])}`).waitFor();
  await page.locator('#q-1').getByRole('button', {name: 'Show in the passage'}).click();
  await page.locator('mark.evidence').waitFor();
  assert.equal((await page.locator('mark.evidence').innerText()).toLowerCase(), q1.evidence.toLowerCase());

  // A full test: three passages behind tabs, every answer as the key, the approximate band.
  await page.getByRole('link', {name: 'Another test'}).click();
  await page.waitForURL(`${origin}/en/ielts/reading`);
  await page.getByText('Your recent attempts').waitFor();
  await page.getByRole('button', {name: 'Full test · 60 min'}).click();
  await page.waitForURL(/\/en\/ielts\/reading\/[0-9a-f-]{36}$/);
  assert.equal(state.attempt.mode, 'test');
  await page.getByRole('button', {name: 'Passage 3'}).click();
  await page.getByRole('heading', {name: sections[2].title}).waitFor();
  const all = {};
  for (const s of sections) for (const g of s.groups) for (const q of g.questions) q.numbers.forEach((n, i) => { all[n] = g.type === 'multiple_choice_multi' ? q.answer[i] : q.answer[0]; });
  // The answers go with the submit (the mock marks them as the backend would).
  await page.evaluate(([uuid, answers]) => localStorage.setItem(`reading:${uuid}:answers`, JSON.stringify(answers)), [state.attempt.uuid, all]);
  await page.reload();
  await page.locator('nav[aria-label="Questions"] button.answered').nth(39).waitFor({timeout: 10000});
  await page.getByRole('button', {name: 'Submit answers'}).click();
  await page.getByRole('dialog', {name: 'Submit your answers?'}).getByText('You have answered 40 of 40 questions.').waitFor();
  await page.getByRole('dialog').getByRole('button', {name: 'Submit', exact: true}).click();
  await page.getByText('40 / 40').waitFor();
  await page.getByText('≈ 8–9').waitFor();
  await page.getByText('approximate band', {exact: true}).waitFor();

  // Phone: the passage and the questions behind tabs.
  await page.setViewportSize({width: 390, height: 800});
  await page.getByRole('tab', {name: 'Passage'}).click();
  assert.equal(await page.locator('.reading-questions').isVisible(), false);
  await page.getByRole('tab', {name: 'Questions'}).click();
  assert.equal(await page.locator('.reading-passage').isVisible(), false);
});
