import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

// P5.6: Academic Task 1 — offered only where the backend assesses it, library tasks with their chart, 20 minutes / 150 words.
const TOKEN = '21|task1-session-fixture';
const library = JSON.parse(readFileSync(new URL('../../packages/exam-domain/library/ielts-writing-task-1-academic.v1.json', import.meta.url), 'utf8'));
const chart = (ref) => {
  const t = library.tasks.find(x => x.ref === ref);
  return {uuid: randomUUID(), topic: t.topic, task_type: t.type, difficulty: t.difficulty, prompt: {text: t.text, stimulus: t.stimulus}, official: false};
};
const CHARTS = [chart('gonative-t1a:t1a-01'), chart('gonative-t1a:t1a-13'), chart('gonative-t1a:t1a-19')];
const ESSAYS = [{uuid: randomUUID(), topic: 'Remote work', task_type: 'opinion', difficulty: 'standard', prompt: {text: 'Some people think working from home is better for everyone. To what extent do you agree or disagree?'}, official: false}];
// Task 1 assessable for Academic only (the backend flag EXAM_TASK1_ENABLED).
const catalog = structuredClone(catalogFixture);
catalog.exams[0].sections[0].tasks[0].assessable = true;

test('Task 1: chart tasks for Academic only, the chart and its table, report editor with Task 1 conditions', {timeout: 180000}, async t => {
  const state = {attempts: new Map(), creates: [], taskQueries: []};
  const full = a => ({uuid: a.uuid, exam_key: a.exam_key, exam_version: '2026-11', section_key: 'writing', task_key: a.task_key, source: 'library',
    topic: a.topic, status: 'draft', revision: 0, word_count: 0, word_count_rule: 'whitespace-v1', submitted_at: null,
    created_at: '2026-11-26T10:00:00+00:00', updated_at: '2026-11-26T10:00:00+00:00', assessment: null, prompt: a.prompt, response_text: '', assessments: []});
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalog);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-academic'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path.startsWith('tasks?')) {
      const q = new URLSearchParams(path.slice(6));
      state.taskQueries.push(Object.fromEntries(q));
      return json(200, {tasks: q.get('task') === 'task-1' ? CHARTS : ESSAYS});
    }
    if (path.startsWith('attempts?')) return json(200, {attempts: [], page: 1, per_page: 5, total: 0});
    if (path === 'attempts' && method === 'POST') {
      state.creates.push(body);
      const practice = CHARTS.find(x => x.uuid === body.practice_task);
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

  // Academic offers Task 1 and Task 2; Task 2 is the default and stays as it was.
  await page.goto(`${origin}/en/ielts/writing/new`);
  await page.getByRole('link', {name: 'Task 1: chart'}).waitFor();
  assert.equal(await page.getByRole('link', {name: 'Task 2: essay'}).getAttribute('aria-current'), 'page');
  await page.getByRole('tab', {name: 'My own task'}).waitFor();

  // Task 1: only library tasks, each with its chart; chart types as filters.
  await page.getByRole('link', {name: 'Task 1: chart'}).click();
  await page.waitForURL(/task=task-1/);
  assert.equal(await page.locator('.task').count(), 3);
  assert.equal(await page.getByRole('tab', {name: 'My own task'}).count(), 0, 'no own task for a chart task');
  assert.equal(await page.locator('.task .chart-svg svg').count(), 2, 'line and pie are drawn');
  assert.equal(await page.locator('.task .chart-table').count(), 1, 'the table task shows its table');
  await page.getByText('describe a chart or a table in at least 150 words', {exact: false}).waitFor();
  await page.getByRole('button', {name: 'Pie chart'}).click();
  assert.equal(await page.locator('.task').count(), 1);
  await page.getByRole('button', {name: 'All'}).click();
  assert.deepEqual(state.taskQueries.at(-1), {exam: 'ielts-academic', task: 'task-1'});

  // General Training: no Task 1 (a letter, later).
  await page.getByRole('link', {name: 'IELTS General Training'}).click();
  await page.waitForURL(/exam=ielts-general-training/);
  assert.equal(await page.getByRole('link', {name: 'Task 1: chart'}).count(), 0);
  assert.deepEqual(state.taskQueries.at(-1), {exam: 'ielts-general-training', task: 'task-2'});

  // Start a report on the line graph: the editor shows the chart, its table on request and the Task 1 conditions.
  await page.goto(`${origin}/en/ielts/writing/new?exam=ielts-academic&task=task-1`);
  await page.getByRole('button', {name: 'Write this report'}).first().click();
  await page.waitForURL(/\/en\/ielts\/writing\/[0-9a-f-]{36}$/);
  assert.deepEqual(state.creates.at(-1), {exam_key: 'ielts-academic', task_key: 'task-1', practice_task: CHARTS[0].uuid});
  await page.getByText('Writing Task 1', {exact: false}).first().waitFor();
  await page.getByText('Exam conditions: 20 minutes, at least 150 words.').waitFor();
  await page.getByRole('button', {name: 'Start 20-minute timer'}).waitFor();
  await page.locator('.prompt-card .chart-svg svg[role="img"]').waitFor();
  assert.equal(await page.locator('.prompt-card .chart-table').count(), 0);
  await page.getByRole('button', {name: 'Show the data as a table'}).click();
  const table = page.locator('.prompt-card .chart-table');
  await table.waitFor();
  assert.equal(await table.locator('tbody tr').count(), 3, 'car, bus and bicycle');
  assert.equal(await table.locator('caption').innerText(), 'Commuters by mode of transport, 2000–2020 (thousand)');
  await page.getByText('The data is invented for practice.').waitFor();
  await page.getByRole('textbox', {name: 'Your report'}).fill('The line graph shows commuters.');
  await page.getByText('IELTS asks for at least 150 words. The count is approximate.').waitFor();
});
