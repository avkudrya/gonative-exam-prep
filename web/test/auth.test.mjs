import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {json, problem, profileFixture, startApp, startMock} from './harness.mjs';

const TOKEN = '9|browser-session-fixture';
const PROOF = 'a'.repeat(64);

test('Auth pages: sign-in with return path, errors, join hint, proofs, sign-out, cleanup, 320 px', {timeout: 180000}, async t => {
  const state = {active: false, cleanup: false, proofs: [], googleError: null};
  const identity = () => ({user: {email: 'learner@example.test', name: null, has_password: true}, account_state: state.cleanup ? 'cleanup_pending' : 'active'});
  const api = await startMock(t, ({path, headers, body}) => {
    if (path === 'auth/login') {
      if (body.email === 'gonative@example.test') return problem(403, 'exams_profile_required', {fields: {credentials: ['exams_profile_required']}});
      if (body.password !== 'correct-password') return problem(401, 'invalid_credentials');
      state.active = true;
      return json(200, {...identity(), session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    }
    if (path === 'auth/google') {
      if (state.googleError) return problem(422, 'validation_failed', {fields: {credentials: [state.googleError]}});
      state.active = true;
      return json(200, {...identity(), session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    }
    if (path === 'auth/activate') { state.proofs.push(body.token); return json(200, {status: 'verified'}); }
    if (path === 'auth/register') return json(202, {status: 'verification_required'});
    if (headers.authorization !== `Bearer ${TOKEN}` || !state.active) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, identity());
    if (path === 'profile') return json(200, {profile: profileFixture()});
    if (path === 'auth/logout') { state.active = false; return {status: 204}; }
    return problem(404, 'not_found');
  });
  const {origin, output} = await startApp(t, api.url, {EXAMS_GOOGLE_CLIENT_ID: 'fixture-google-client'});
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage();
  // A stand-in for Google Identity Services: no real Google call, no credentials.
  await page.route('https://accounts.google.com/**', route => route.fulfill({contentType: 'text/javascript', body: `window.google={accounts:{id:{
    initialize:function(o){window.__googleSignIn=o.callback;},
    renderButton:function(el,o){window.__googleText=o.text;var b=document.createElement('button');b.type='button';b.textContent='Google (test)';b.onclick=function(){window.__googleSignIn({credential:'fixture-id-token'});};el.appendChild(b);}}}};`}));

  // Guests are sent to sign-in with the page as the return path.
  let r = await fetch(`${origin}/en/ielts/writing`, {redirect: 'manual'});
  assert.match(r.headers.get('location'), /\/en\/login\?next=%2Fielts%2Fwriting$/);
  r = await fetch(`${origin}/en`, {redirect: 'manual'});
  assert.match(r.headers.get('location'), /\/en\/login$/);
  r = await fetch(`${origin}/en/login`);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);

  await page.goto(`${origin}/en/ielts/writing`);
  await page.waitForURL(/\/en\/login\?next=/);
  await page.getByRole('heading', {name: 'Sign in to GoNative Exams'}).waitFor();
  await page.waitForFunction(() => window.__googleText === 'signin_with');

  // Wrong password: a clear message, the typed email stays.
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('wrong');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.getByRole('alert').filter({hasText: 'Incorrect email or password.'}).waitFor();
  assert.equal(await page.getByLabel('Email').inputValue(), 'learner@example.test');

  // A GoNative account without Exams is pointed to "join".
  await page.getByLabel('Email').fill('gonative@example.test');
  await page.getByRole('button', {name: 'Sign in'}).click();
  const alert = page.getByRole('alert').filter({hasText: 'not connected to Exams'});
  await alert.waitFor();
  assert.equal(await alert.getByRole('link').getAttribute('href'), '/en/join');

  // Show/hide password.
  await page.getByRole('button', {name: 'Show'}).click();
  assert.equal(await page.getByLabel('Password', {exact: true}).getAttribute('type'), 'text');
  await page.getByRole('button', {name: 'Hide'}).click();

  // Success returns to the requested page; the session cookie is invisible to scripts.
  await page.getByLabel('Email').fill('learner@example.test');
  await page.getByLabel('Password', {exact: true}).fill('correct-password');
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);
  await page.getByRole('heading', {name: 'Writing'}).waitFor();
  assert.equal(await page.evaluate(() => document.cookie.includes('exams')), false);
  const cookies = await page.context().cookies();
  assert.ok(cookies.some(c => c.name === '__Host-exams' && c.httpOnly));

  // Account menu: Escape closes it, sign-out ends the session.
  await page.getByRole('button', {name: 'Account menu'}).click();
  await page.getByText('learner@example.test').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('navigation', {name: 'Account menu'}).count(), 0);
  await page.getByRole('button', {name: 'Account menu'}).click();
  await page.getByRole('button', {name: 'Sign out'}).click();
  await page.waitForURL(/\/en\/login\?signed=out/);
  await page.getByRole('status').filter({hasText: 'You have signed out.'}).waitFor();
  assert.equal((await page.context().cookies()).some(c => c.name === '__Host-exams'), false);

  // Google: a missing account points to registration; success signs in.
  state.googleError = 'account_not_found';
  await page.goto(`${origin}/en/login`);
  await page.getByRole('button', {name: 'Google (test)'}).click();
  await page.getByRole('alert').filter({hasText: 'no GoNative account'}).getByRole('link', {name: 'Create an account'}).waitFor();
  state.googleError = null;
  await page.getByRole('button', {name: 'Google (test)'}).click();
  await page.waitForURL(`${origin}/en/ielts/writing`);
  assert.equal(api.calls.filter(c => c.path === 'auth/google').at(-1).body.create_account, false);

  // Data cleanup in progress replaces every member page with a notice.
  state.cleanup = true;
  await page.reload();
  await page.getByRole('heading', {name: 'Your Exams data is being deleted'}).waitFor();
  state.cleanup = false;

  // Activation proof: scrubbed from the address bar, kept across a language switch.
  const guest = await browser.newPage();
  await guest.goto(`${origin}/en/activate?token=${PROOF}`);
  await guest.getByRole('button', {name: 'Confirm email'}).waitFor();
  await guest.waitForFunction(() => !location.search.includes('token'));
  await guest.getByRole('link', {name: 'RU'}).click();
  await guest.waitForURL(`${origin}/ru/activate`);
  await guest.getByRole('button', {name: 'Подтвердить email'}).click();
  await guest.getByRole('status').filter({hasText: 'Email подтверждён'}).waitFor();
  assert.deepEqual(state.proofs, [PROOF]);
  await guest.goto(`${origin}/en/activate`);
  await guest.getByRole('alert').filter({hasText: 'The link is incomplete'}).waitFor();
  assert.equal(await guest.getByRole('button', {name: 'Confirm email'}).isDisabled(), true);

  // Registration: 16+ notice, confirmation mismatch blocked in the browser, success message.
  await guest.goto(`${origin}/en/register`);
  await guest.getByText('for people aged 16 and over').waitFor();
  await guest.getByLabel('Email').fill('new@example.test');
  await guest.getByLabel('Password', {exact: true}).fill('long-enough-1');
  await guest.getByLabel('Repeat password').fill('long-enough-2');
  const registers = api.calls.filter(c => c.path === 'auth/register').length;
  await guest.getByRole('button', {name: 'Create account'}).click();
  assert.equal(api.calls.filter(c => c.path === 'auth/register').length, registers);
  await guest.getByLabel('Repeat password').fill('long-enough-1');
  await guest.getByRole('button', {name: 'Create account'}).click();
  await guest.getByRole('status').filter({hasText: 'we sent a confirmation link'}).waitFor();
  assert.equal(api.calls.filter(c => c.path === 'auth/register').at(-1).body.locale, 'en');

  // 320 px: no horizontal scrolling on the sign-in page, in light and dark themes.
  const phone = await browser.newPage({viewport: {width: 320, height: 640}});
  for (const scheme of ['light', 'dark']) {
    await phone.emulateMedia({colorScheme: scheme});
    await phone.goto(`${origin}/ru/login`);
    await phone.getByRole('heading', {name: 'Вход в GoNative Exams'}).waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.dataset.theme), scheme);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow in ${scheme}`);
  }

  // The server log never contains the session token.
  assert.equal(output().includes(TOKEN), false);
});
