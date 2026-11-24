import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

const TOKEN = '41|progress-session-fixture';
const range = (low, high) => ({precision: 'approximate', low, high});

test('History, progress and official results', {timeout: 240000}, async t => {
  const attempts = Array.from({length: 23}, (_, i) => ({uuid: randomUUID(), exam_key: 'ielts-academic', exam_version: '2026-11', section_key: 'writing', task_key: 'task-2',
    source: i % 2 ? 'custom' : 'library', topic: i % 2 ? null : `Topic ${i + 1}`, status: i === 0 ? 'assessing' : i % 3 ? 'assessed' : 'draft', revision: 1, word_count: 250 + i,
    word_count_rule: 'whitespace-v1', submitted_at: null, created_at: '2026-11-20T10:00:00+00:00', updated_at: '2026-11-24T10:00:00+00:00', assessment: null}));
  const state = {attempts, deletes: [], skills: null, results: [], writes: []};
  const trend = [
    {assessment: randomUUID(), finished_at: '2026-11-10T10:00:00+00:00', criteria: [{criterion_key: 'task_response', estimate: range(5, 6)}, {criterion_key: 'coherence_cohesion', estimate: range(5.5, 6.5)}, {criterion_key: 'lexical_resource', estimate: range(5, 6)}, {criterion_key: 'grammatical_range_accuracy', estimate: null}]},
    {assessment: randomUUID(), finished_at: '2026-11-20T10:00:00+00:00', criteria: [{criterion_key: 'task_response', estimate: range(6, 7)}, {criterion_key: 'coherence_cohesion', estimate: range(6, 7)}, {criterion_key: 'lexical_resource', estimate: range(5.5, 6.5)}, {criterion_key: 'grammatical_range_accuracy', estimate: range(5, 6)}]},
  ];
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-general-training'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path.startsWith('attempts?')) {
      const q = new URLSearchParams(path.split('?')[1]);
      const page = Number(q.get('page') ?? 1), per = Number(q.get('per_page') ?? 20);
      return json(200, {attempts: state.attempts.slice((page - 1) * per, page * per), page, per_page: per, total: state.attempts.length});
    }
    const del = /^attempts\/([0-9a-f-]{36})$/.exec(path);
    if (del && method === 'DELETE') {
      const a = state.attempts.find(x => x.uuid === del[1]);
      if (a.status === 'assessing') return problem(409, 'exams_attempt_assessing');
      state.deletes.push(a.uuid);
      state.attempts = state.attempts.filter(x => x !== a);
      return {status: 204};
    }
    if (path === 'skills') return json(200, state.skills ?? {skills: [], criteria_trend: []});
    if (path === 'reported-results' && method === 'GET') return json(200, {reported_results: state.results});
    if (path === 'reported-results' && method === 'POST') {
      state.writes.push(body);
      if (![...Array(19).keys()].map(i => i / 2).includes(body.sections.writing)) return problem(422, 'validation_failed', {fields: {sections: ['exams_section_not_on_scale']}});
      const r = {uuid: randomUUID(), exam_key: body.exam_key, exam_version: '2026-11', test_date: body.test_date, source: 'self_reported', sections: body.sections,
        calibration_consent: !!body.calibration_consent, consent_changed_at: null};
      state.results.unshift(r);
      return json(201, {reported_result: r});
    }
    const rr = /^reported-results\/([0-9a-f-]{36})(\/comparison)?$/.exec(path);
    const result = rr && state.results.find(x => x.uuid === rr[1]);
    if (result && rr[2]) return json(200, {reported_result: result, window_days: 60, assessments: [{assessment: trend[1].assessment, finished_at: trend[1].finished_at, criteria: trend[1].criteria}]});
    if (result && method === 'PUT') { state.writes.push(body); Object.assign(result, body); return json(200, {reported_result: result}); }
    if (result && method === 'DELETE') { state.results = state.results.filter(x => x !== result); return {status: 204}; }
    return problem(404, 'not_found');
  });
  const {origin} = await startApp(t, api.url);
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  await page.goto(`${origin}/en/login`);
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('correct-password');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);

  // Navigation marks the current section; home links to the full history.
  const nav = page.getByRole('navigation', {name: 'Sections'});
  assert.equal(await nav.getByRole('link', {name: 'Writing'}).getAttribute('aria-current'), 'page');
  await page.getByRole('link', {name: 'All essays (23)'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing/history`);
  await page.getByText('23 essays, newest first.').waitFor();
  assert.equal(await page.locator('.history-item').count(), 20);
  await page.getByRole('link', {name: 'Older →'}).click();
  await page.waitForURL(/history\?page=2/);
  assert.equal(await page.locator('.history-item').count(), 3);
  await page.getByText('Page 2 of 2').waitFor();

  // Delete from the history: an essay being assessed is refused; another is deleted after confirming.
  await page.goto(`${origin}/en/ielts/writing/history`);
  await page.getByRole('button', {name: 'Delete “Topic 1”'}).click();
  await page.getByRole('group', {name: 'Delete essay'}).getByRole('button', {name: 'Delete'}).click();
  await page.getByRole('alert').filter({hasText: 'being assessed'}).waitFor();
  assert.equal(state.deletes.length, 0);
  await page.getByRole('button', {name: 'Cancel'}).click();
  await page.getByRole('button', {name: 'Delete “Topic 3”'}).click();
  await page.getByRole('group', {name: 'Delete essay'}).getByRole('button', {name: 'Delete'}).click();
  await page.getByText('22 essays, newest first.').waitFor();
  assert.deepEqual(state.deletes, [attempts[2].uuid]);

  // Progress without assessed essays.
  await nav.getByRole('link', {name: 'Progress'}).click();
  await page.waitForURL(`${origin}/en/ielts/progress`);
  assert.equal(await nav.getByRole('link', {name: 'Progress'}).getAttribute('aria-current'), 'page');
  await page.getByText('Your progress appears here after your first assessed essay.').waitFor();

  // With data: ranges as bars (never points), a table, and frequent problems per 100 words.
  state.skills = {criteria_trend: trend, skills: [
    {skill_key: 'grammar.articles', status: 'focus', per_100_words: 1.4, trend: 'improving', confidence: 'medium', observations: 6},
    {skill_key: 'vocabulary.collocations', status: 'watch', per_100_words: 0.5, trend: 'worsening', confidence: 'low', observations: 2},
    {skill_key: 'mechanics.spelling', status: 'ok', per_100_words: 0.1, trend: 'stable', confidence: 'medium', observations: 1},
  ]};
  await page.reload();
  await page.getByText('Based on your last 2 assessed essays.', {exact: false}).waitFor();
  assert.equal(await page.locator('.range-chart').count(), 4);
  assert.equal(await page.locator('.trend-card').first().locator('rect.bar').count(), 2);
  assert.equal(await page.locator('.trend-card').nth(3).locator('rect.bar').count(), 1, 'a missing estimate draws no bar');
  assert.deepEqual(await page.locator('.trend-card .range-value').allTextContents(), ['≈ 6–7', '≈ 6–7', '≈ 5.5–6.5', '≈ 5–6']);
  await page.getByText('Show as a table').click();
  assert.deepEqual(await page.locator('.trend-table tbody tr').nth(0).locator('td').allTextContents(), ['5–6', '5.5–6.5', '5–6', '—']);
  const skills = page.locator('.skill');
  assert.equal(await skills.count(), 2, 'skills without a problem are not listed');
  assert.match(await skills.nth(0).textContent(), /Articles.*Work on this.*1\.4 per 100 words.*improving/);
  assert.match(await skills.nth(1).textContent(), /Collocations.*Keep an eye on.*more frequent.*based on few essays/);

  // Official result: added with a separate consent, compared, consent withdrawn, deleted.
  await page.getByRole('link', {name: 'Took the exam? Enter your official result'}).click();
  await page.waitForURL(`${origin}/en/ielts/results`);
  assert.equal(await page.getByLabel('Exam').inputValue(), 'ielts-general-training');
  assert.equal(await page.getByRole('checkbox', {name: /Also let GoNative use this result/}).isChecked(), false);
  await page.getByLabel('Test date').fill('2026-11-21');
  await page.getByLabel('Writing score').selectOption('6.5');
  await page.getByRole('button', {name: 'Save result'}).click();
  await page.getByText('Writing 6.5').waitFor();
  assert.deepEqual(state.writes.at(-1), {exam_key: 'ielts-general-training', test_date: '2026-11-21', sections: {writing: 6.5}, calibration_consent: false});
  await page.getByText('Visible only to you.', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'Compare with my estimates'}).click();
  await page.getByRole('heading', {name: 'Our estimates in the 60 days before the exam'}).waitFor();
  assert.deepEqual(await page.locator('.comparison tbody td').allTextContents(), ['6–7', '6–7', '5.5–6.5', '5–6']);
  await page.getByRole('button', {name: 'Allow use for checking estimates'}).click();
  await page.getByText('Used anonymously, in aggregate').waitFor();
  assert.deepEqual(state.writes.at(-1), {calibration_consent: true});
  await page.getByRole('button', {name: 'Withdraw consent'}).click();
  await page.getByText('Visible only to you.', {exact: true}).waitFor();
  assert.deepEqual(state.writes.at(-1), {calibration_consent: false});
  await page.locator('.reported-item').getByRole('button', {name: 'Delete'}).click();
  await page.locator('.reported-item').getByRole('button', {name: 'Delete'}).last().click();
  await page.getByRole('heading', {name: 'Your results'}).waitFor({state: 'detached'});
  assert.equal(state.results.length, 0);

  // 320 px, Russian, dark: progress and results fit; navigation wraps under the brand.
  const phone = await browser.newPage({viewport: {width: 320, height: 700}, colorScheme: 'dark'});
  await phone.context().addCookies(await page.context().cookies());
  for (const path of ['/ru/ielts/progress', '/ru/ielts/results', '/ru/ielts/writing/history']) {
    await phone.goto(origin + path);
    await phone.locator('h1').waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow on ${path}`);
  }
});
