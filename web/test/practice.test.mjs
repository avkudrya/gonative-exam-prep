import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';
import {ESSAY, RESULT} from './result-fixture.mjs';

const TOKEN = '51|practice-session-fixture';
const id = () => randomBytes(12).toString('hex');

/** Four questions of the four supported types, with keys known only to the mock (as the backend keeps them). */
function makeSession(skill) {
  const q = [];
  const mc = {id: id(), type: 'multiple_choice', text: '___ a threat (to be a possible danger)', targets: [{id: id(), label: ''}], options: [], tokens: [], multi_select: false};
  mc.options = [{id: id(), text: 'make'}, {id: id(), text: 'pose'}, {id: id(), text: 'do'}];
  q.push({question: mc, key: {right: mc.options[1].id, answer: 'pose'}, sense: {phrase: 'to pose a threat', definition: 'to be a possible danger', translation: 'представлять угрозу'}});
  const gapId = id();
  const gc = {id: id(), type: 'gap_choice', text: `Researchers {{${gapId}}} a conclusion from the data.`, targets: [{id: gapId, label: '1', hint: null, options: [{id: id(), text: 'drew'}, {id: id(), text: 'made'}]}], options: [], tokens: []};
  q.push({question: gc, key: {right: gc.targets[0].options[0].id, answer: 'drew'}, sense: {phrase: 'to draw a conclusion', definition: 'to decide something is true', translation: null}});
  const fillId = id();
  const gf = {id: id(), type: 'gap_fill', text: `The plan had a significant {{${fillId}}} on the city.`, targets: [{id: fillId, label: '1', hint: null}], options: [], tokens: []};
  q.push({question: gf, key: {right: 'impact', answer: 'impact'}, sense: null});
  const words = ['Governments', 'should', 'tackle', 'poverty'].map(text => ({id: id(), text}));
  const or = {id: id(), type: 'ordering', text: '', targets: [{id: id(), label: ''}], options: [], tokens: [words[2], words[0], words[3], words[1]]};
  q.push({question: or, key: {right: words.map(w => w.id), answer: 'Governments should tackle poverty'}, sense: null});
  return {uuid: randomUUID(), skill_key: skill, level: 'B2', status: 'open', total: q.length, answered: 0, correct: 0, entries: q, results: {}};
}

const viewOf = s => ({uuid: s.uuid, skill_key: s.skill_key, level: s.level, status: s.status, total: s.total, answered: s.answered, correct: s.correct,
  questions: s.entries.map(e => ({question: e.question, result: s.results[e.question.id] ?? null}))});

function check(entry, answer) {
  const q = entry.question;
  let right;
  if (q.type === 'multiple_choice') right = answer.selected?.[0] === entry.key.right;
  else if (q.type === 'gap_choice') right = answer.gaps?.[q.targets[0].id] === entry.key.right;
  else if (q.type === 'gap_fill') right = answer.gaps?.[q.targets[0].id]?.toLowerCase() === entry.key.right;
  else right = JSON.stringify(answer.tokens) === JSON.stringify(entry.key.right);
  return {state: right ? 'correct' : 'incorrect', credit: [right ? 1 : 0, 1], answer,
    targets: q.targets.map(target => ({id: target.id, state: right ? 'correct' : 'incorrect', correct_answer: entry.key.answer})),
    feedback: {topic: 'Argument and evidence', sense: entry.sense, explanation: null}};
}

test('Practice from the bank: start from next steps and feedback, one question at a time, summary, BFF limits, phone', {timeout: 240000}, async t => {
  const attempt = randomUUID();
  const state = {sessions: new Map(), starts: [], answers: [], steps: [], daily: false};
  const step = {uuid: randomUUID(), kind: 'practice', status: 'open', skill: 'vocabulary.collocations', attempt, practice_task: null, finding_ids: [], words: null, created_at: null};
  state.steps = [step, {...step, uuid: randomUUID(), kind: 'future_kind'}];
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-academic'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path === 'skills') return json(200, {skills: [{skill_key: 'vocabulary.collocations', status: 'focus', per_100_words: 1.5, trend: 'stable', confidence: 'medium', observations: 3,
      practice: {answered: 12, correct: 9, percent: 75, last_at: '2026-11-25T10:00:00+00:00'}}], criteria_trend: [{assessment: randomUUID(), finished_at: '2026-11-24T10:00:00+00:00', criteria: []}]});
    if (path === 'recommendations') return json(200, {recommendations: state.steps});
    if (path === 'plan') return json(200, {plan: {version: 1, week_start: '2026-11-23', weeks_to_exam: null, essays: 1, timed: false, reassess_every_weeks: 2, daily_words: true,
      focus_skills: ['vocabulary.collocations'], practice_skills: ['vocabulary.collocations'], practice_sessions: 2, practice_minutes: 10}});
    if (path === 'practice/skills') return json(200, {skills: ['vocabulary.collocations']});
    if (path === 'practice' && method === 'POST') {
      state.starts.push(body);
      if (state.daily) return problem(429, 'exams_practice_daily_limit', {retry_after: 3600});
      const s = makeSession(body.skill_key);
      state.sessions.set(s.uuid, s);
      return json(201, {session: viewOf(s)});
    }
    const p = /^practice\/([0-9a-f-]{36})(?:\/(finish|answers\/([0-9a-f]{24})))?$/.exec(path);
    if (p) {
      const s = state.sessions.get(p[1]);
      if (!s) return problem(404, 'not_found');
      if (!p[2]) return json(200, {session: viewOf(s)});
      if (p[2] === 'finish') { s.status = 'finished'; return json(200, {session: viewOf(s)}); }
      const entry = s.entries.find(e => e.question.id === p[3]);
      state.answers.push(body.answer);
      const result = s.results[entry.question.id] ?? check(entry, body.answer);
      s.results[entry.question.id] = result;
      s.answered = Object.keys(s.results).length;
      s.correct = Object.values(s.results).filter(r => r.state === 'correct').length;
      if (s.answered === s.total) s.status = 'finished';
      return json(201, {result: {...result, session: {status: s.status, answered: s.answered, correct: s.correct, total: s.total}}});
    }
    if (path === `attempts/${attempt}`) return json(200, {attempt: {uuid: attempt, exam_key: 'ielts-academic', exam_version: '2026-11', section_key: 'writing', task_key: 'task-2', source: 'library',
      topic: 'City transport', status: 'assessed', revision: 2, word_count: 168, word_count_rule: 'whitespace-v1', submitted_at: '2026-11-24T10:30:00+00:00',
      created_at: '2026-11-24T10:00:00+00:00', updated_at: '2026-11-24T10:30:00+00:00', assessment: {uuid: attempt, status: 'assessed'}, prompt: {text: 'Cars in city centres.'}, response_text: ESSAY, assessments: []}});
    if (path === `attempts/${attempt}/assessment`) return json(200, {assessment: {uuid: attempt, status: 'assessed', feedback_language: 'en', created_at: null, finished_at: null, result: RESULT}});
    if (path === `attempts/${attempt}/vocabulary`) return json(200, {words: [], list: null, quota: {tier: 'free', limit: 100, remaining: 100}});
    if (path === `attempts/${attempt}/reports`) return json(200, {reports: []});
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

  // Progress: the practice step (a kind the site does not know is left out), the share next to the essay rate, the week.
  await page.goto(`${origin}/en/ielts/progress`);
  await page.getByText('Practise Collocations: 10 short questions from the bank.', {exact: false}).waitFor();
  assert.equal(await page.locator('.next-steps .step').count(), 1, 'the unknown kind is dropped, the rest stays');
  await page.getByText('In practice: 75% correct (12 answers in 30 days).').waitFor();
  await page.getByText('2 short practice sessions (10 min each): Collocations.').waitFor();
  assert.equal(state.starts.length, 0, 'nothing starts on render or prefetch');

  await page.locator('.next-steps').getByRole('button', {name: 'Start'}).click();
  await page.waitForURL(/\/en\/ielts\/practice\/[0-9a-f-]{36}$/);
  assert.deepEqual(state.starts[0], {skill_key: 'vocabulary.collocations', attempt_uuid: attempt});
  await page.getByRole('heading', {name: 'Practice: Collocations'}).waitFor();
  await page.getByText('Question 1 of 4').waitFor();

  // Multiple choice, wrong: the verdict, the correct answer and the sense card with its translation.
  await page.getByRole('button', {name: 'Check'}).click();
  await page.getByText('Answer the question first.').waitFor();
  assert.equal(state.answers.length, 0, 'an empty answer never leaves the browser');
  await page.getByLabel('make').check();
  await page.getByRole('button', {name: 'Check'}).click();
  await page.getByText('Not quite').waitFor();
  await page.getByText('pose', {exact: true}).first().waitFor();
  await page.locator('.sense-card').getByText('to be a possible danger').waitFor();
  await page.getByText('Translation: представлять угрозу').waitFor();
  assert.equal(await page.getByLabel('pose').isDisabled(), true, 'locked after the check');
  assert.deepEqual(await page.locator('.practice-choices .option').evaluateAll(els => els.map(e => e.className)), ['option wrong', 'option right', 'option'],
    'the wrong choice in red, the right option in green');

  // Gap choice, right.
  await page.getByRole('button', {name: 'Next'}).click();
  await page.getByText('Question 2 of 4').waitFor();
  await page.getByLabel('drew').check();
  await page.getByRole('button', {name: 'Check'}).click();
  await page.getByText('Correct', {exact: true}).waitFor();

  // Gap fill: typed inline.
  await page.getByRole('button', {name: 'Next'}).click();
  await page.getByLabel('Gap').fill('impact');
  await page.getByRole('button', {name: 'Check'}).click();
  await page.getByText('Correct', {exact: true}).waitFor();

  // Ordering: tap the words; a placed word can be taken back.
  await page.getByRole('button', {name: 'Next'}).click();
  for (const word of ['Governments', 'tackle']) await page.locator('.order-pool').getByRole('button', {name: word}).click();
  await page.getByRole('button', {name: 'Remove “tackle”'}).click();
  for (const word of ['should', 'tackle', 'poverty']) await page.locator('.order-pool').getByRole('button', {name: word}).click();
  await page.getByRole('button', {name: 'Check'}).click();
  await page.getByText('Correct', {exact: true}).waitFor();
  await page.getByRole('button', {name: 'See the result'}).click();
  await page.getByRole('heading', {name: '3 of 4 correct'}).waitFor();
  assert.deepEqual(state.answers.map(a => Object.keys(a)[0]), ['selected', 'gaps', 'gaps', 'tokens']);

  // A reload keeps the answers and the summary.
  await page.reload();
  await page.getByRole('heading', {name: '3 of 4 correct'}).waitFor();

  // From the feedback: the practice button next to the skill the bank can train, and the daily limit message.
  await page.goto(`${origin}/en/ielts/writing/${attempt}`);
  const group = page.locator('.fix-skill', {hasText: 'Collocations'});
  await group.getByRole('button', {name: 'Practise: 10 questions'}).waitFor();
  assert.equal(await page.locator('.fix-skill', {hasText: 'Word choice'}).getByRole('button', {name: 'Practise: 10 questions'}).count(), 0, 'only skills the bank trains');
  state.daily = true;
  await group.getByRole('button', {name: 'Practise: 10 questions'}).click();
  await group.getByText('That is enough for today').waitFor();

  // BFF: only the allowlisted shapes reach the backend.
  const session = [...state.sessions.values()][0];
  const before = state.answers.length;
  const send = (path, data) => page.evaluate(async ([p, d]) => (await fetch(`/api/bff/${p}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d)})).status, [path, data]);
  const qid = session.entries[0].question.id;
  assert.equal(await send(`practice/${session.uuid}/answers/${qid}`, {answer: {selected: ['not-an-id']}}), 422);
  assert.equal(await send(`practice/${session.uuid}/answers/${qid}`, {answer: {selected: [qid]}, extra: 1}), 422);
  assert.equal(await send(`practice/${session.uuid}/answers/${qid}`, {answer: {text: 'free text'}}), 422);
  assert.equal(await send(`practice/${session.uuid}/answers/nothex`, {answer: {selected: [qid]}}), 404);
  assert.equal(await send('practice', {skill_key: 'Robert"); drop', attempt_uuid: attempt}), 422);
  assert.equal(state.answers.length, before);

  // Russian on a phone, both themes: no horizontal scroll on the practice page.
  const phone = await browser.newPage({viewport: {width: 320, height: 640}});
  await phone.context().addCookies(await page.context().cookies());
  const fresh = makeSession('vocabulary.collocations');
  state.sessions.set(fresh.uuid, fresh);
  for (const scheme of ['light', 'dark']) {
    await phone.emulateMedia({colorScheme: scheme});
    await phone.goto(`${origin}/ru/ielts/practice/${fresh.uuid}`);
    await phone.getByText('Задание 1 из 4').waitFor();
    await phone.getByRole('button', {name: 'Проверить'}).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow in ${scheme}`);
  }
});
