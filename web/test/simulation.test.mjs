import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

// P5.12: the full Writing test — a pair of library tasks, one swap, both answers on one timer, one submit, the Writing summary.
const TOKEN = '31|simulation-session-fixture';
const GT = 'ielts-general-training';
const letters = JSON.parse(readFileSync(new URL('../../packages/exam-domain/library/ielts-writing-task-1-general.v1.json', import.meta.url), 'utf8'));
const letter = ref => {
  const t = letters.tasks.find(x => x.ref === ref);
  return {uuid: randomUUID(), topic: t.topic, task_type: t.type, difficulty: t.difficulty, prompt: {text: t.text, stimulus: t.stimulus}, official: false};
};
const essay = topic => ({uuid: randomUUID(), topic, task_type: 'opinion', difficulty: null,
  prompt: {text: `Some people think ${topic.toLowerCase()} should be free. To what extent do you agree or disagree?`}, official: false});
const PAIRS = [[letter('gonative-t1g:gt1-01'), essay('Public transport')], [letter('gonative-t1g:gt1-17'), essay('City parks')]];
const catalog = structuredClone(catalogFixture);
catalog.exams[1].sections[0].tasks[0].assessable = true;
catalog.exams[1].sections[0].simulation = true;
catalog.exams[1].sections[0].time_minutes = 60;

test('full Writing test: pair, swap, strict timer choice, both answers, one submit, Writing range', {timeout: 180000}, async t => {
  const now = () => new Date().toISOString();
  const state = {session: null, attempts: new Map(), submits: [], drafts: []};
  const summaryOf = a => ({uuid: a.uuid, exam_key: GT, exam_version: '2026-11', section_key: 'writing', task_key: a.task_key, source: 'library', topic: a.topic,
    status: a.status, revision: a.revision, word_count: 0, word_count_rule: 'whitespace-v1', submitted_at: null, created_at: now(), updated_at: now(),
    assessment: a.assessment});
  const view = () => {
    const s = state.session;
    const pair = PAIRS[s.swaps];
    return {uuid: s.uuid, exam_key: GT, section_key: 'writing', status: s.status, timer_mode: s.timer_mode, duration_seconds: 3600,
      swaps_left: s.status === 'ready' ? 1 - s.swaps : 0, started_at: s.started_at, deadline_at: s.deadline_at, submitted_at: s.submitted_at, server_time: now(),
      tasks: ['task-1', 'task-2'].map((key, i) => ({task_key: key, practice_task: pair[i], time_minutes: [20, 40][i],
        attempt: s.attempts[i] ? summaryOf(state.attempts.get(s.attempts[i])) : null})),
      summary: s.status !== 'submitted' ? null : s.done
        ? {status: 'complete', calibration: 'uncalibrated', weights: {'task-1': 1, 'task-2': 2}, writing: {precision: 'approximate', low: 6, high: 7.5},
          tasks: [{task_key: 'task-1', status: 'assessed', attempt: s.attempts[0], estimate: {precision: 'approximate', low: 5.5, high: 6.5}},
            {task_key: 'task-2', status: 'assessed', attempt: s.attempts[1], estimate: {precision: 'approximate', low: 6.5, high: 7.5}}]}
        : {status: 'pending', calibration: 'uncalibrated', weights: {'task-1': 1, 'task-2': 2}, writing: null,
          tasks: s.attempts.map((u, i) => ({task_key: `task-${i + 1}`, status: 'queued', attempt: u, estimate: null}))}};
  };
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalog);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: GT})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path.startsWith('attempts?')) return json(200, {attempts: [], page: 1, per_page: 5, total: 0});
    if (path === 'writing-sessions' && method === 'GET') {
      const open = state.session && ['ready', 'started'].includes(state.session.status);
      return json(200, {enabled: true, open: open ? view() : null, sessions: state.session?.status === 'submitted' ? [view()] : []});
    }
    if (path === 'writing-sessions' && method === 'POST') {
      assert.deepEqual(body, {exam_key: GT});
      state.session = {uuid: randomUUID(), status: 'ready', swaps: 0, timer_mode: null, started_at: null, deadline_at: null, submitted_at: null, attempts: [], done: false};
      return json(201, {session: view()});
    }
    const m = /^writing-sessions\/([0-9a-f-]{36})(?:\/(swap|start|submit|abandon))?$/.exec(path);
    if (m && state.session?.uuid === m[1]) {
      const s = state.session;
      if (m[2] === 'swap') s.swaps = 1;
      if (m[2] === 'start') {
        s.status = 'started';
        s.timer_mode = body.timer_mode;
        s.started_at = now();
        s.deadline_at = new Date(Date.now() + 3600e3).toISOString();
        s.attempts = PAIRS[s.swaps].map((task, i) => {
          const a = {uuid: randomUUID(), task_key: `task-${i + 1}`, topic: task.topic, prompt: task.prompt, status: 'draft', revision: 0, text: '', assessment: null};
          state.attempts.set(a.uuid, a);
          return a.uuid;
        });
      }
      if (m[2] === 'submit') {
        state.submits.push(headers['idempotency-key']);
        s.status = 'submitted';
        s.submitted_at = now();
        for (const u of s.attempts) Object.assign(state.attempts.get(u), {status: 'submitted', assessment: {uuid: randomUUID(), status: 'queued'}});
        return json(202, {session: view()});
      }
      return json(200, {session: view()});
    }
    const d = /^attempts\/([0-9a-f-]{36})(\/draft)?$/.exec(path);
    const a = d && state.attempts.get(d[1]);
    if (a && d[2] && method === 'PUT') {
      state.drafts.push({task: a.task_key, text: body.response_text});
      a.text = body.response_text;
      a.revision += 1;
      return json(200, {attempt: summaryOf(a)});
    }
    if (a && method === 'GET') return json(200, {attempt: {...summaryOf(a), prompt: a.prompt, response_text: a.text, assessments: []}});
    return problem(404, 'not_found');
  });
  const {origin} = await startApp(t, api.url);
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await (await browser.newContext()).newPage();

  await page.goto(`${origin}/en/login`);
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('correct-password');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);

  // Writing home offers the full test when the backend can run it.
  await page.getByRole('link', {name: 'Full Writing test'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing/simulation`);
  await page.getByText('counts Task 2 twice as much as Task 1', {exact: false}).waitFor();
  await page.getByRole('button', {name: 'Choose my tasks'}).click();
  await page.waitForURL(/\/en\/ielts\/writing\/simulation\/[0-9a-f-]{36}$/);

  // The pair: a letter and an essay; one swap.
  await page.getByRole('heading', {name: PAIRS[0][0].topic}).waitFor();
  await page.getByRole('heading', {name: 'Public transport'}).waitFor();
  await page.getByText('Task 1: letter', {exact: false}).first().waitFor();
  await page.getByRole('button', {name: 'Other tasks'}).click();
  await page.getByRole('heading', {name: 'City parks'}).waitFor();
  await page.getByText('You have already swapped the tasks once.').waitFor();
  assert.equal(await page.getByRole('button', {name: 'Other tasks'}).count(), 0);

  await page.getByLabel('Strict (exam mode)', {exact: false}).check();
  await page.getByRole('button', {name: 'Start the test'}).click();
  await page.getByRole('timer', {name: 'Time left'}).waitFor();
  assert.equal(state.session.timer_mode, 'strict');
  assert.match(await page.getByRole('timer').innerText(), /^(59:5\d|60:00)$/);
  await page.getByText('Strict timer: answers are submitted at 00:00').waitFor();

  // Both answers, one tab each; drafts save as in the ordinary editor.
  await page.getByRole('textbox', {name: 'Your letter'}).fill('Dear Mr Patel,\n\nThank you for the lovely dinner.');
  await page.getByRole('tab', {name: /Task 2: essay/}).click();
  await page.getByRole('textbox', {name: 'Your essay'}).fill('Parks should be free because everyone needs green space.');
  await page.getByRole('tab', {name: /Task 1: letter/}).click();
  assert.equal(await page.getByRole('textbox', {name: 'Your letter'}).inputValue(), 'Dear Mr Patel,\n\nThank you for the lovely dinner.');

  await page.getByRole('button', {name: 'Submit both tasks'}).click();
  const dialog = page.getByRole('dialog', {name: 'Submit your answers?'});
  await dialog.getByText('Uses 2 feedbacks of your quota (2 of 2 left).').waitFor();
  await dialog.getByText('fewer than 150 words', {exact: false}).waitFor();
  await dialog.getByRole('button', {name: 'Submit', exact: true}).click();

  // The summary waits for both, then shows the Writing range and links to each feedback.
  await page.getByText('We are checking both answers.', {exact: false}).waitFor();
  assert.equal(state.submits.length, 1);
  assert.match(state.submits[0], /^simulation-[0-9a-f]{24}$/);
  assert.deepEqual([...new Set(state.drafts.map(x => x.task))].sort(), ['task-1', 'task-2'], 'both drafts saved before the submit');
  state.session.done = true;
  await page.getByText('≈ 6–7.5').waitFor({timeout: 20000});
  await page.getByText('Task 2 counts twice as much as Task 1. This is not an official IELTS score.').waitFor();
  await page.getByText('≈ 5.5–6.5').waitFor();
  assert.equal(await page.getByRole('link', {name: 'Open feedback'}).count(), 2);
  assert.equal(await page.getByRole('link', {name: 'Open feedback'}).first().getAttribute('href'), `/en/ielts/writing/${state.session.attempts[0]}`);
});
