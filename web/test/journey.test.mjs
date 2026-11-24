import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock, TERMS} from './harness.mjs';
import {ESSAY, RESULT} from './result-fixture.mjs';

/*
 * K §3 criterion 1 end to end: a new person comes from the ielts. landing, registers on exams., confirms the
 * email, sets up, picks a task, writes (a reload keeps the text), gets feedback, finds it in the history and
 * deletes it. Once in English on a desktop in the light theme, once in Russian on a 320 px phone in the dark
 * theme; every page of the path is checked for horizontal overflow, and every page at 768 px.
 */
const TASKS = [{uuid: randomUUID(), topic: 'City transport', task_type: 'discussion', difficulty: 'standard', official: false,
  prompt: {text: 'Some say cities should ban cars from the centre, others disagree. Discuss both views and give your opinion.'}}];

function backend() {
  const state = {users: new Map(), sessions: new Map(), attempts: new Map(), proofs: new Map(), polls: 0};
  const userOf = headers => state.sessions.get((headers.authorization ?? '').replace('Bearer ', ''));
  const summary = a => ({uuid: a.uuid, exam_key: a.exam_key, exam_version: '2026-11', section_key: 'writing', task_key: 'task-2', source: 'library', topic: 'City transport',
    status: a.status, revision: a.revision, word_count: a.text.split(/\s+/).filter(Boolean).length, word_count_rule: 'whitespace-v1', submitted_at: null,
    created_at: '2026-11-24T10:00:00+00:00', updated_at: '2026-11-24T10:05:00+00:00', assessment: a.assessment && {uuid: a.assessment.uuid, status: a.assessment.status}});
  const handler = ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/register') {
      const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
      state.users.set(body.email, {email: body.email, password: body.password, verified: false, profile: null, locale: body.locale});
      state.proofs.set(token, body.email);
      state.lastProof = token;
      return json(202, {status: 'verification_required'});
    }
    if (path === 'auth/activate') {
      const email = state.proofs.get(body.token);
      if (!email) return problem(422, 'validation_failed', {fields: {token: ['invalid_verification']}});
      state.users.get(email).verified = true;
      state.users.get(email).profile = profileFixture({onboarding_complete: false, age_confirmed: false, terms_accepted: false, interface_locale: state.users.get(email).locale, feedback_language: state.users.get(email).locale});
      return json(200, {status: 'verified'});
    }
    if (path === 'auth/login') {
      const user = state.users.get(body.email);
      if (!user || user.password !== body.password) return problem(401, 'invalid_credentials');
      if (!user.verified) return problem(403, 'validation_failed', {fields: {account: ['email_verification_required']}});
      const token = `${state.sessions.size + 1}|${randomUUID()}`;
      state.sessions.set(token, user);
      return json(200, {user: {email: user.email, name: null, has_password: true}, account_state: 'active', session_token: token, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    }
    const user = userOf(headers);
    if (!user) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: user.email, name: null, has_password: true}, account_state: 'active'});
    if (path === 'auth/logout') return {status: 204};
    if (path === 'profile' && method === 'GET') return json(200, {profile: user.profile});
    if (path === 'profile' && method === 'PUT') {
      if (body.accept_terms && body.terms_version !== TERMS) return problem(409, 'terms_version_changed');
      const p = user.profile;
      Object.assign(p, Object.fromEntries(Object.entries(body).filter(([k]) => ['interface_locale', 'feedback_language', 'target_exam_key'].includes(k))));
      if (body.confirm_age_16) p.age_confirmed = true;
      if (body.accept_terms) p.terms_accepted = true;
      p.onboarding_complete = p.age_confirmed && p.terms_accepted;
      return json(200, {profile: p});
    }
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 0, pending: 0, remaining: 2}, concurrent: 1});
    if (path.startsWith('tasks?')) return json(200, {tasks: TASKS});
    const mine = [...state.attempts.values()].filter(a => a.owner === user);
    if (path.startsWith('attempts?')) return json(200, {attempts: mine.map(summary), page: 1, per_page: 20, total: mine.length});
    if (path === 'attempts' && method === 'POST') {
      const a = {uuid: randomUUID(), owner: user, exam_key: body.exam_key, text: '', revision: 0, status: 'draft', assessment: null};
      state.attempts.set(a.uuid, a);
      return json(201, {attempt: {...summary(a), prompt: TASKS[0].prompt, response_text: a.text, assessments: []}});
    }
    const m = /^attempts\/([0-9a-f-]{36})(?:\/(draft|submit|assessment))?$/.exec(path);
    const a = m && state.attempts.get(m[1]);
    if (!a || a.owner !== user) return problem(404, 'not_found');
    if (!m[2] && method === 'GET') return json(200, {attempt: {...summary(a), prompt: TASKS[0].prompt, response_text: a.text, assessments: []}});
    if (!m[2] && method === 'DELETE') { state.attempts.delete(a.uuid); return {status: 204}; }
    if (m[2] === 'draft') {
      if (body.expected_revision !== a.revision) return problem(409, 'exams_revision_conflict');
      a.text = body.response_text; a.revision++;
      return json(200, {attempt: summary(a)});
    }
    if (m[2] === 'submit') {
      a.status = 'submitted'; a.assessment = {uuid: randomUUID(), status: 'queued'}; state.polls = 0;
      return json(202, {attempt: summary(a), assessment: {...a.assessment, feedback_language: user.profile.feedback_language, created_at: new Date().toISOString(), finished_at: null, result: null}, reused: false});
    }
    if (m[2] === 'assessment') {
      if (++state.polls >= 2) { a.assessment.status = 'assessed'; a.status = 'assessed'; }
      return json(200, {assessment: {...a.assessment, feedback_language: user.profile.feedback_language, created_at: new Date().toISOString(), finished_at: null,
        result: a.status === 'assessed' ? {...RESULT, findings: RESULT.findings} : null}});
    }
    return problem(404, 'not_found');
  };
  return {state, handler};
}

const fits = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const run of [
  {locale: 'en', viewport: {width: 1440, height: 900}, scheme: 'light'},
  {locale: 'ru', viewport: {width: 320, height: 720}, scheme: 'dark'},
]) {
  test(`Journey ${run.locale}, ${run.viewport.width} px, ${run.scheme}: landing → register → feedback → history`, {timeout: 240000}, async t => {
    const {state, handler} = backend();
    const api = await startMock(t, handler);
    const {origin: bind} = await startApp(t, api.url, {EXAMS_LANDING_HOSTS: 'ielts.localhost=ielts', EXAMS_WEB_ORIGIN: 'http://exams.localhost:PORT'});
    const port = new URL(bind).port;
    const app = `http://exams.localhost:${port}`;
    const browser = await chromium.launch({headless: true});
    t.after(() => browser.close());
    const context = await browser.newContext({viewport: run.viewport, colorScheme: run.scheme, locale: run.locale === 'ru' ? 'ru-RU' : 'en-GB'});
    const page = await context.newPage();
    page.on('dialog', d => void d.accept());
    const L = run.locale === 'ru'
      ? {start: 'Начать бесплатно', register: 'Создать аккаунт', confirm: 'Подтвердить email', login: 'Войти', email: 'Email', password: 'Пароль', repeat: 'Повторите пароль',
        age: 'Мне есть 16 лет.', terms: /Принимаю/, save: 'Сохранить и начать', newEssay: 'Новое эссе', write: 'Писать это эссе', essay: 'Ваше эссе', saved: /^Сохранено$/,
        feedback: 'Получить разбор', send: 'Отправить на разбор', criteria: 'Критерии', approx: 'ориентировочно', all: 'Все эссе', del: 'Удалить', explanations: 'Русский'}
      : {start: 'Start for free', register: 'Create account', confirm: 'Confirm email', login: 'Sign in', email: 'Email', password: 'Password', repeat: 'Repeat password',
        age: 'I am 16 or older.', terms: /I accept the Terms of Use/, save: 'Save and start', newEssay: 'New essay', write: 'Write this essay', essay: 'Your essay', saved: /^Saved$/,
        feedback: 'Get feedback', send: 'Send for feedback', criteria: 'Criteria', approx: 'approximate', all: 'All essays', del: 'Delete', explanations: 'English'};
    const checked = [];
    const check = async label => { checked.push(label); assert.equal(await fits(page), true, `${label}: horizontal overflow`); };

    // 1. Landing on ielts. → registration on exams.
    await page.goto(`http://ielts.localhost:${port}/${run.locale}`);
    await check('landing');
    await page.getByRole('link', {name: L.start}).first().click();
    await page.waitForURL(`${app}/${run.locale}/register?**`);
    await check('register');
    await page.getByLabel(L.email).fill('new.learner@example.test');
    await page.getByLabel(L.password, {exact: true}).fill('journey-password-1');
    await page.getByLabel(L.repeat).fill('journey-password-1');
    await page.getByRole('button', {name: L.register}).click();
    await page.locator('.auth-done').waitFor();
    assert.equal([...state.users.values()][0].locale, run.locale);

    // 2. The emailed link confirms the account.
    await page.goto(`${app}/${run.locale}/activate?token=${state.lastProof}`);
    await page.getByRole('button', {name: L.confirm}).click();
    await page.locator('.auth-done').waitFor();
    await check('activate');

    // 3. Sign in → welcome (16+, Terms) → Writing.
    await page.locator('.auth-done').getByRole('link', {name: L.login}).click();
    await page.getByLabel(L.email).fill('new.learner@example.test');
    await page.getByLabel(L.password, {exact: true}).fill('journey-password-1');
    await page.getByRole('button', {name: L.login}).click();
    await page.waitForURL(`${app}/${run.locale}/welcome**`);
    await check('welcome');
    assert.equal(await page.getByLabel(L.explanations).isChecked(), true, 'explanations default to the interface language');
    await page.getByLabel('IELTS Academic').check();
    await page.getByLabel(L.age).check();
    await page.getByRole('checkbox', {name: L.terms}).check();
    await page.getByRole('button', {name: L.save}).click();
    await page.waitForURL(`${app}/${run.locale}/ielts/writing`);
    await check('writing home');

    // 4. Task → essay; a reload keeps the text.
    await page.getByRole('link', {name: L.newEssay}).first().click();
    await check('new essay');
    await page.getByRole('button', {name: L.write}).click();
    await page.waitForURL(/\/ielts\/writing\/[0-9a-f-]{36}$/);
    await page.getByLabel(L.essay).fill(ESSAY);
    await page.locator('.sync').filter({hasText: L.saved}).waitFor({timeout: 15000});
    await page.reload();
    assert.equal(await page.getByLabel(L.essay).inputValue(), ESSAY);
    await check('editor');

    // 5. Feedback: approximate ranges with their label, highlighted essay.
    await page.getByRole('button', {name: L.feedback}).click();
    await page.getByRole('dialog').getByRole('button', {name: L.send}).click();
    await page.getByRole('heading', {name: L.criteria}).waitFor({timeout: 20000});
    assert.equal(await page.locator('.range-note').count(), 4);
    for (const note of await page.locator('.range-note').allTextContents()) assert.equal(note, L.approx);
    assert.ok(await page.locator('mark.hl').count() >= 5);
    await check('feedback');

    // 6. History → delete.
    await page.goto(`${app}/${run.locale}/ielts/writing/history`);
    await check('history');
    await page.locator('.history-item').getByRole('button', {name: new RegExp(L.del)}).click();
    await page.getByRole('group').getByRole('button', {name: L.del}).click();
    await page.locator('.history-item').waitFor({state: 'detached'});
    assert.equal(state.attempts.size, 0);

    // 7. The remaining member pages fit too.
    for (const path of ['ielts/progress', 'ielts/results', 'settings', 'privacy', 'terms']) {
      await page.goto(`${app}/${run.locale}/${path}`);
      await page.locator('h1').waitFor();
      await check(path);
    }

    // 8. Every page also fits a 768 px tablet.
    await page.setViewportSize({width: 768, height: 1000});
    for (const path of ['ielts/writing', 'ielts/writing/new', 'ielts/progress', 'ielts/results', 'settings']) {
      await page.goto(`${app}/${run.locale}/${path}`);
      await page.locator('h1').waitFor();
      await check(`768 ${path}`);
    }
    assert.ok(checked.length >= 18);
  });
}
