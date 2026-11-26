import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

// P5.11: General Training Task 1 — a letter task from the library (tone filters, the three points), letter editor, no chart.
const TOKEN = '21|letter-session-fixture';
const library = JSON.parse(readFileSync(new URL('../../packages/exam-domain/library/ielts-writing-task-1-general.v1.json', import.meta.url), 'utf8'));
const letter = (ref) => {
  const t = library.tasks.find(x => x.ref === ref);
  return {uuid: randomUUID(), topic: t.topic, task_type: t.type, difficulty: t.difficulty, prompt: {text: t.text, stimulus: t.stimulus}, official: false};
};
const LETTERS = [letter('gonative-t1g:gt1-01'), letter('gonative-t1g:gt1-09'), letter('gonative-t1g:gt1-17')];
// Task 1 assessable for General Training only (the backend flag EXAM_GT_TASK1_ENABLED).
const catalog = structuredClone(catalogFixture);
catalog.exams[1].sections[0].tasks[0].assessable = true;

test('GT Task 1: letter tasks with tone filters and their points, letter editor with Task 1 conditions', {timeout: 180000}, async t => {
  const state = {attempts: new Map(), creates: []};
  const full = a => ({uuid: a.uuid, exam_key: a.exam_key, exam_version: '2026-11', section_key: 'writing', task_key: a.task_key, source: 'library',
    topic: a.topic, status: 'draft', revision: 0, word_count: 0, word_count_rule: 'whitespace-v1', submitted_at: null,
    created_at: '2026-11-26T10:00:00+00:00', updated_at: '2026-11-26T10:00:00+00:00', assessment: null, prompt: a.prompt, response_text: '', assessments: []});
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalog);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-general-training'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path.startsWith('tasks?')) return json(200, {tasks: new URLSearchParams(path.slice(6)).get('task') === 'task-1' ? LETTERS : []});
    if (path.startsWith('attempts?')) return json(200, {attempts: [], page: 1, per_page: 5, total: 0});
    if (path === 'attempts' && method === 'POST') {
      state.creates.push(body);
      const practice = LETTERS.find(x => x.uuid === body.practice_task);
      const a = {uuid: randomUUID(), exam_key: body.exam_key, task_key: body.task_key ?? 'task-2', topic: practice.topic, prompt: practice.prompt};
      state.attempts.set(a.uuid, a);
      return json(201, {attempt: full(a)});
    }
    const m = /^attempts\/([0-9a-f-]{36})$/.exec(path);
    const a = m && state.attempts.get(m[1]);
    if (a && method === 'GET') return json(200, {attempt: full(a)});
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

  await page.goto(`${origin}/en/ielts/writing/new?exam=ielts-general-training&task=task-1`);
  await page.getByRole('link', {name: 'Task 1: letter'}).waitFor();
  assert.equal(await page.locator('.task').count(), 3);
  assert.equal(await page.locator('.task .chart-svg, .task .chart-table').count(), 0, 'a letter has no chart');
  assert.equal(await page.getByRole('tab', {name: 'My own task'}).count(), 0, 'no own task for a letter');
  await page.getByText('write a letter that covers all three points', {exact: false}).waitFor();
  await page.getByRole('button', {name: 'Semi-formal'}).click();
  assert.equal(await page.locator('.task').count(), 1);
  await page.getByRole('button', {name: 'All'}).click();

  // The formal complaint: the editor shows the situation and the three points; Task 1 conditions; no chart.
  await page.getByRole('button', {name: 'Write this letter'}).first().click();
  await page.waitForURL(/\/en\/ielts\/writing\/[0-9a-f-]{36}$/);
  assert.deepEqual(state.creates.at(-1), {exam_key: 'ielts-general-training', task_key: 'task-1', practice_task: LETTERS[0].uuid});
  await page.getByText('• give details of your order').waitFor();
  await page.getByText('Begin your letter with: Dear Sir or Madam,').waitFor();
  assert.equal(await page.getByRole('button', {name: 'Show the data as a table'}).count(), 0);
  await page.getByRole('textbox', {name: 'Your letter'}).fill('Dear Sir or Madam,\n\nI am writing about my order.');
  await page.getByText('IELTS asks for at least 150 words. The count is approximate.').waitFor();
});
