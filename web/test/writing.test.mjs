import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';

const TOKEN = '21|writing-session-fixture';
const task = (topic, type, text) => ({uuid: randomUUID(), topic, task_type: type, difficulty: 'standard', prompt: {text}, official: false});
const TASKS = [
  task('Remote work', 'opinion', 'Some people think working from home is better for everyone. To what extent do you agree or disagree?'),
  task('City transport', 'discussion', 'Some say cities should ban cars from the centre, others disagree. Discuss both views and give your opinion.'),
  task('Fast food', 'opinion', 'Fast food should be taxed more heavily. To what extent do you agree or disagree?'),
];

test('Writing: tasks, own task, editor autosave, offline, restore, conflict, timer, delete', {timeout: 240000}, async t => {
  const state = {attempts: new Map(), fail: false, puts: [], deletes: [], creates: []};
  const summary = a => ({uuid: a.uuid, exam_key: a.exam_key, exam_version: '2026-11', section_key: 'writing', task_key: 'task-2', source: a.source,
    topic: a.topic, status: a.status, revision: a.revision, word_count: a.response_text.split(/\s+/).filter(Boolean).length, word_count_rule: 'whitespace-v1',
    submitted_at: null, created_at: '2026-11-24T10:00:00+00:00', updated_at: '2026-11-24T10:05:00+00:00', assessment: null});
  const full = a => ({...summary(a), prompt: {text: a.prompt}, response_text: a.response_text, assessments: []});
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-academic'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path.startsWith('tasks?')) return json(200, {tasks: TASKS});
    if (path.startsWith('attempts?')) return json(200, {attempts: [...state.attempts.values()].reverse().map(summary), page: 1, per_page: 5, total: state.attempts.size});
    if (path === 'attempts' && method === 'POST') {
      state.creates.push(body);
      const practice = TASKS.find(x => x.uuid === body.practice_task);
      const a = {uuid: randomUUID(), exam_key: body.exam_key, source: practice ? 'library' : 'custom', topic: practice?.topic ?? null,
        prompt: practice?.prompt.text ?? body.custom_prompt, response_text: '', revision: 0, status: 'draft'};
      state.attempts.set(a.uuid, a);
      return json(201, {attempt: full(a)});
    }
    const m = /^attempts\/([0-9a-f-]{36})(\/draft)?$/.exec(path);
    const a = m && state.attempts.get(m[1]);
    if (!a) return problem(404, 'not_found');
    if (m[2] && method === 'PUT') {
      state.puts.push(body);
      if (state.fail) return {status: 503, body: {error: {code: 'exams_internal_error'}}};
      if (a.status !== 'draft') return problem(409, 'exams_attempt_not_editable');
      if (body.expected_revision !== a.revision) return problem(409, 'exams_revision_conflict', {current_revision: a.revision});
      a.response_text = body.response_text;
      a.revision++;
      return json(200, {attempt: summary(a)});
    }
    if (method === 'GET') return json(200, {attempt: full(a)});
    if (method === 'DELETE') { state.deletes.push(a.uuid); state.attempts.delete(a.uuid); return {status: 204}; }
    return problem(404, 'not_found');
  });
  const {origin} = await startApp(t, api.url);
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('dialog', dialog => void dialog.accept());
  const essay = () => page.getByLabel('Your essay');
  const status = text => page.locator('.sync').filter({hasText: text === 'Saved' ? /^Saved$/ : text}).waitFor({timeout: 15000});
  const typeAtEnd = async text => {
    await essay().evaluate(el => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
    await essay().pressSequentially(text);
  };
  const local = uuid => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), `exams:draft:${uuid}`);

  await page.goto(`${origin}/en/login`);
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('correct-password');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);
  await page.getByText('2 of 2 free feedbacks left this month').waitFor();
  await page.getByText('No essays yet.').waitFor();

  // Library: filter by type, start an essay on a practice task.
  await page.getByRole('link', {name: 'New essay'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing/new`);
  assert.equal(await page.locator('.task').count(), 3);
  assert.equal(await page.getByRole('link', {name: 'IELTS Academic'}).getAttribute('aria-current'), 'page');
  await page.getByRole('button', {name: 'Discussion'}).click();
  assert.equal(await page.locator('.task').count(), 1);
  await page.getByRole('button', {name: 'Write this essay'}).click();
  await page.waitForURL(/\/en\/ielts\/writing\/[0-9a-f-]{36}$/);
  const uuid = page.url().split('/').pop();
  assert.deepEqual(state.creates.at(-1), {exam_key: 'ielts-academic', practice_task: TASKS[1].uuid});
  await page.getByText('Practice task, not official').waitFor();
  await page.getByText(TASKS[1].prompt.text).waitFor();

  // Typing: approximate word count, then a server save with the expected revision.
  await essay().fill('Cars make city centres noisy and dangerous for people who walk.');
  await page.getByText('≈ 11 words').waitFor();
  await status('Saved');
  assert.deepEqual(state.puts.at(-1), {expected_revision: 0, response_text: 'Cars make city centres noisy and dangerous for people who walk.'});
  assert.equal((await local(uuid)).base, 1);
  assert.equal(await essay().getAttribute('spellcheck'), 'false');

  // Reload keeps the text (from the server).
  await page.reload();
  assert.equal(await essay().inputValue(), 'Cars make city centres noisy and dangerous for people who walk.');

  // No connection: the text stays, the page warns before leaving, saving resumes when back online.
  state.fail = true;
  await typeAtEnd(' However, banning them is hard.');
  await status('No connection');
  assert.equal((await local(uuid)).text.endsWith('banning them is hard.'), true);
  assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(e); return e.defaultPrevented; }), true);

  // A reload while offline restores the unsaved browser copy and saves it once the backend is back.
  await page.reload();
  assert.equal((await essay().inputValue()).endsWith('banning them is hard.'), true);
  state.fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await status('Saved');
  assert.equal(state.attempts.get(uuid).response_text.endsWith('banning them is hard.'), true);
  assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(e); return e.defaultPrevented; }), false);

  // Another tab saved a newer version: the person chooses; nothing is overwritten silently.
  const theirs = state.attempts.get(uuid);
  theirs.response_text = 'Text written in another tab.';
  theirs.revision++;
  await typeAtEnd(' Mine.');
  await page.getByRole('alert').filter({hasText: 'changed in another tab'}).waitFor({timeout: 15000});
  assert.equal(state.attempts.get(uuid).response_text, 'Text written in another tab.');
  await page.getByRole('button', {name: 'Keep this version'}).click();
  await status('Saved');
  assert.equal(state.attempts.get(uuid).response_text.endsWith('Mine.'), true);
  // And the other choice takes the saved version.
  theirs.response_text = 'Second version from elsewhere.';
  theirs.revision++;
  await typeAtEnd(' Again.');
  await page.getByRole('button', {name: 'Use the saved version'}).click({timeout: 15000});
  assert.equal(await essay().inputValue(), 'Second version from elsewhere.');
  await status('Saved');

  // Optional timer: starts at 40 minutes, pauses and resets; it never blocks writing.
  await page.getByRole('button', {name: 'Start 40-minute timer'}).click();
  assert.match(await page.locator('.timer-value').textContent(), /^(40:00|39:5\d)$/);
  await page.waitForTimeout(1200);
  await page.getByRole('button', {name: 'Pause'}).click();
  assert.match(await page.locator('.timer-value').textContent(), /^39:5\d$/);
  await page.getByRole('button', {name: 'Reset'}).click();
  assert.equal(await page.locator('.timer-value').textContent(), '40:00');

  // Home lists the draft.
  await page.goto(`${origin}/en/ielts/writing`);
  await page.getByRole('link', {name: /City transport/}).getByText('Draft').waitFor();

  // Own task: checked in the browser first, then created.
  await page.goto(`${origin}/en/ielts/writing/new?exam=ielts-general-training`);
  await page.getByRole('tab', {name: 'My own task'}).click();
  await page.getByLabel('Task text in English').fill('Too short');
  const creates = state.creates.length;
  await page.getByRole('button', {name: 'Start writing'}).click();
  await page.getByRole('alert').filter({hasText: 'The task is too short.'}).waitFor();
  await page.getByLabel('Task text in English').fill('Эссе о городах и транспорте в будущем мире');
  await page.getByRole('button', {name: 'Start writing'}).click();
  await page.getByRole('alert').filter({hasText: 'Write the task in English.'}).waitFor();
  assert.equal(state.creates.length, creates);
  const own = 'Some people believe that children should learn to cook at school. Do you agree or disagree?';
  await page.getByLabel('Task text in English').fill(own);
  await page.getByRole('button', {name: 'Start writing'}).click();
  await page.waitForURL(/\/en\/ielts\/writing\/[0-9a-f-]{36}$/);
  assert.deepEqual(state.creates.at(-1), {exam_key: 'ielts-general-training', custom_prompt: own});
  await page.getByRole('heading', {name: 'Own task'}).waitFor();

  // Deleting a draft removes it and its browser copy.
  await page.goto(`${origin}/en/ielts/writing/${uuid}`);
  await page.getByRole('button', {name: 'Delete draft'}).click();
  await page.getByRole('button', {name: 'Delete', exact: true}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);
  assert.deepEqual(state.deletes, [uuid]);
  assert.equal(await local(uuid), null);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), `exams:draft:${uuid}:timer`), null);

  // A submitted essay is read-only here (its feedback page is P3.4); an unknown one is 404.
  const done = {uuid: randomUUID(), exam_key: 'ielts-academic', source: 'custom', topic: null, prompt: own, response_text: 'Submitted text.', revision: 3, status: 'assessed'};
  state.attempts.set(done.uuid, done);
  await page.goto(`${origin}/en/ielts/writing/${done.uuid}`);
  await page.getByText('Feedback ready').waitFor();
  assert.equal(await page.getByLabel('Your essay').count(), 0);
  const missing = await page.goto(`${origin}/en/ielts/writing/${randomUUID()}`);
  assert.equal(missing.status(), 404);

  // 320 px, dark theme: the editor fits the screen.
  const phone = await context.newPage();
  await phone.setViewportSize({width: 320, height: 700});
  await phone.emulateMedia({colorScheme: 'dark'});
  const draft = [...state.attempts.values()].find(x => x.status === 'draft');
  await phone.goto(`${origin}/ru/ielts/writing/${draft.uuid}`);
  await phone.getByLabel('Ваше эссе').waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});
