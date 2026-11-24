import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock, TERMS} from './harness.mjs';

const TOKEN = '11|account-session-fixture';

test('Welcome, settings, deletion and legal pages', {timeout: 180000}, async t => {
  const state = {active: true, hasPassword: true, profile: profileFixture({age_confirmed: false, terms_accepted: false, onboarding_complete: false, feedback_language: 'en'}), writes: [], termsVersion: TERMS, deleted: []};
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') {
      state.active = true;
      return json(200, {user: {email: 'learner@example.test', name: null, has_password: state.hasPassword}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    }
    if (headers.authorization !== `Bearer ${TOKEN}` || !state.active) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: state.hasPassword}, account_state: 'active'});
    if (path === 'profile' && method === 'GET') return json(200, {profile: {...state.profile, terms_version: state.termsVersion}});
    if (path === 'profile' && method === 'PUT') {
      state.writes.push(body);
      if (body.accept_terms && body.terms_version !== state.termsVersion) return problem(409, 'terms_version_changed');
      const next = {...state.profile};
      for (const key of ['interface_locale', 'feedback_language', 'target_exam_key']) if (key in body) next[key] = body[key];
      if (body.confirm_age_16) next.age_confirmed = true;
      if (body.accept_terms) next.terms_accepted = true;
      next.onboarding_complete = next.age_confirmed && next.terms_accepted;
      state.profile = next;
      return json(200, {profile: next});
    }
    if (path === 'auth/password') {
      if (body.current_password !== 'old-password-1') return problem(422, 'validation_failed', {fields: {current_password: ['invalid_current_password']}});
      state.active = false;
      return json(200, {status: 'password_changed'});
    }
    if (path === 'data' && method === 'DELETE') {
      if (body.password !== 'old-password-1') return problem(422, 'validation_failed', {fields: {password: ['invalid_current_password']}});
      state.deleted.push(body);
      state.active = false;
      return {status: 204};
    }
    return problem(404, 'not_found');
  });
  const {origin} = await startApp(t, api.url);
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage();
  const signIn = async (next = '') => {
    await page.goto(`${origin}/en/login${next}`);
    await page.getByLabel('Email').fill('learner@example.test');
    await page.getByLabel('Password', {exact: true}).fill('old-password-1');
    await page.getByRole('button', {name: 'Sign in'}).click();
  };

  // Legal pages are public, in both languages, with the version the backend accepts.
  for (const [path, heading, version] of [['/en/privacy', 'GoNative Exams Privacy Policy', `Version ${TERMS}`], ['/ru/terms', 'Условия использования GoNative Exams', `Редакция ${TERMS}`]]) {
    await page.goto(origin + path);
    await page.getByRole('heading', {level: 1, name: heading}).waitFor();
    await page.getByText(version, {exact: true}).waitFor();
  }
  await page.goto(`${origin}/en/privacy`);
  await page.getByRole('heading', {name: 'Automated feedback and AI'}).waitFor();
  await page.getByRole('contentinfo').getByRole('link', {name: 'Terms of Use'}).click();
  await page.waitForURL(`${origin}/en/terms`);

  // A member who has not finished setup is sent to Welcome, then back to the requested page.
  await signIn('?next=%2Fsettings');
  await page.waitForURL(/\/en\/welcome\?next=%2Fsettings/);
  await page.getByRole('heading', {name: 'Set up GoNative Exams'}).waitFor();
  assert.equal(await page.getByLabel('English').isChecked(), true);
  // Required confirmations block the request.
  await page.getByRole('button', {name: 'Save and start'}).click();
  assert.equal(state.writes.length, 0);
  await page.getByLabel('Russian').check();
  await page.getByLabel('IELTS General Training').check();
  await page.getByLabel('I am 16 or older.').check();
  await page.getByRole('checkbox', {name: /I accept the Terms of Use/}).check();
  // The Terms changed between showing and saving: nothing is accepted.
  state.termsVersion = '2026-12-01';
  await page.getByRole('button', {name: 'Save and start'}).click();
  await page.getByRole('alert').filter({hasText: /Terms (have just changed|are being updated)/}).waitFor();
  assert.equal(state.profile.terms_accepted, false);
  state.termsVersion = TERMS;
  await page.reload();
  await page.getByLabel('I am 16 or older.').check();
  await page.getByRole('checkbox', {name: /I accept the Terms of Use/}).check();
  await page.getByLabel('Russian').check();
  await page.getByLabel('IELTS General Training').check();
  await page.getByRole('button', {name: 'Save and start'}).click();
  await page.waitForURL(`${origin}/en/settings`);
  assert.deepEqual(state.writes.at(-1), {accept_terms: true, terms_version: TERMS, confirm_age_16: true, feedback_language: 'ru', interface_locale: 'en', target_exam_key: 'ielts-general-training'});
  // Done: Welcome is skipped from now on.
  await page.goto(`${origin}/en/welcome`);
  await page.waitForURL(`${origin}/en/ielts/writing`);

  // Settings: only changed fields are saved; the interface language switches the URL.
  await page.goto(`${origin}/en/settings`);
  const save = page.getByRole('button', {name: 'Save changes'});
  assert.equal(await save.isDisabled(), true);
  assert.equal(await page.getByLabel('Language of explanations').inputValue(), 'ru');
  await page.getByLabel('Language of explanations').selectOption('en');
  await save.click();
  await page.getByRole('status').filter({hasText: 'Changes saved.'}).waitFor();
  assert.deepEqual(state.writes.at(-1), {feedback_language: 'en'});
  await page.getByLabel('Exam you are preparing for').selectOption('');
  await page.getByRole('combobox', {name: 'Interface language'}).selectOption('ru');
  await save.click();
  await page.waitForURL(`${origin}/ru/settings`);
  assert.deepEqual(state.writes.at(-1), {interface_locale: 'ru', target_exam_key: null});
  await page.getByRole('heading', {level: 1, name: 'Настройки'}).waitFor();
  await page.getByRole('link', {name: 'EN'}).click();
  await page.waitForURL(`${origin}/en/settings`);

  // Password change: a wrong current password is explained; success ends the session.
  await page.getByLabel('Current password', {exact: true}).first().fill('wrong');
  await page.getByLabel('New password', {exact: true}).fill('new-password-1');
  await page.getByLabel('Repeat new password').fill('new-password-1');
  await page.getByRole('button', {name: 'Change password'}).click();
  await page.getByRole('alert').filter({hasText: 'The current password is incorrect.'}).waitFor();
  await page.getByLabel('Current password', {exact: true}).first().fill('old-password-1');
  await page.getByRole('button', {name: 'Change password'}).click();
  await page.waitForURL(/\/en\/login\?password=changed/);
  await page.getByRole('status').filter({hasText: 'Your password has been changed.'}).waitFor();

  // Deleting Exams data: confirmation, password check, local drafts removed, signed out.
  await signIn();
  await page.waitForURL(`${origin}/en/ielts/writing`);
  await page.evaluate(() => { localStorage.setItem('exams:draft:x', 'private'); localStorage.setItem('exams-theme', 'dark'); });
  await page.goto(`${origin}/en/settings`);
  await page.getByText('Delete my Exams data…').click();
  const dataSection = page.getByRole('region', {name: 'Delete Exams data'});
  await dataSection.getByLabel('Current password').fill('wrong');
  await dataSection.getByRole('button', {name: 'Delete Exams data'}).click();
  assert.equal(state.deleted.length, 0, 'the confirmation checkbox is required');
  await dataSection.getByRole('checkbox').check();
  await dataSection.getByRole('button', {name: 'Delete Exams data'}).click();
  await dataSection.getByRole('alert').filter({hasText: 'The current password is incorrect.'}).waitFor();
  await dataSection.getByLabel('Current password').fill('old-password-1');
  await dataSection.getByRole('button', {name: 'Delete Exams data'}).click();
  await page.waitForURL(/\/en\/login\?data=deleted/);
  await page.getByRole('status').filter({hasText: 'Your Exams data has been deleted.'}).waitFor();
  assert.deepEqual(state.deleted, [{confirm: 'exams', password: 'old-password-1'}]);
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('exams:draft:x'), localStorage.getItem('exams-theme')]), [null, 'dark']);
  assert.equal((await page.context().cookies()).some(c => c.name === '__Host-exams'), false);

  // Google-only accounts have no password forms; deletion points to support.
  state.hasPassword = false;
  await signIn();
  await page.waitForURL(`${origin}/en/ielts/writing`);
  await page.goto(`${origin}/en/settings`);
  await page.getByText('You sign in with Google').waitFor();
  assert.equal(await page.getByRole('button', {name: 'Change password'}).count(), 0);
  assert.equal(await page.getByText(/write to exams@mnemonicwords\.app/).count(), 2);

  // 320 px, dark: settings and the privacy policy fit the screen.
  const phone = await browser.newPage({viewport: {width: 320, height: 640}, colorScheme: 'dark'});
  await phone.context().addCookies((await page.context().cookies()).map(c => ({...c})));
  for (const path of ['/ru/settings', '/ru/privacy']) {
    await phone.goto(origin + path);
    await phone.locator('h1').waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow on ${path}`);
  }
});
