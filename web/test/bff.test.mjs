import {test} from 'node:test';
import assert from 'node:assert/strict';
import {json, problem, startApp, startMock} from './harness.mjs';

const TOKEN = '7|private-session-fixture';
const ESSAY = 'Private essay sentence that must never be reflected by the BFF.';
const ATTEMPT = '0b7f3a52-6a4e-4f7e-9d43-2f1f3b0a9c11';
const identity = {user: {email: 'learner@example.test', name: null, has_password: true, private: 'hidden'}, account_state: 'active'};
const summary = {
  uuid: ATTEMPT, exam_key: 'ielts-academic', exam_version: '2026-11', section_key: 'writing', task_key: 'task-2', source: 'custom',
  topic: null, status: 'draft', revision: 3, word_count: 11, word_count_rule: 'whitespace-v1', submitted_at: null,
  created_at: '2026-11-24T10:00:00+00:00', updated_at: '2026-11-24T10:01:00+00:00', assessment: null, cost_usd: 0.05,
};

test('BFF: allowlist, CSRF, session cookie, error projection, no essay or token reflection', {timeout: 120000}, async t => {
  let state = {active: true, failure: null};
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (state.failure) return state.failure;
    const authed = headers.authorization === `Bearer ${TOKEN}` && state.active;
    if (path === 'auth/login') {
      if (body.password !== 'correct-password') return problem(401, 'invalid_credentials', {fields: {credentials: ['invalid_credentials']}});
      return json(200, {...identity, session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    }
    if (path === 'auth/register') return json(202, {status: 'verification_required', echo: body.email, session_token: TOKEN});
    if (!authed) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, identity);
    if (path === 'auth/logout') { state.active = false; return {status: 204}; }
    if (path === `attempts/${ATTEMPT}/draft` && method === 'PUT') {
      if (body.expected_revision !== 3) return problem(409, 'exams_revision_conflict', {response_text: body.response_text, current: ESSAY});
      return json(200, {attempt: {...summary, revision: 4}});
    }
    if (path === `attempts/${ATTEMPT}/submit`) return json(202, {attempt: summary, assessment: {uuid: ATTEMPT, status: 'queued', feedback_language: 'en', created_at: null, finished_at: null, result: null}, reused: false});
    if (path === `attempts/${ATTEMPT}/vocabulary/list`) return json(201, {list: {lesson_id: 2, name: 'IELTS', words: 1, url: 'javascript:alert(1)'}, quota: {tier: 'free', limit: 100, remaining: 99}});
    if (path === `attempts/${ATTEMPT}/rewrite-check`) return json(200, {check: {verdict: 'correct', explanation: 'Now it is right.', new_error_quote: null, checks: {limit: 20, used: 1, remaining: 19}}});
    if (path === `attempts/${ATTEMPT}/vocabulary`) return json(200, {words: [], list: {lesson_id: 2, name: 'IELTS', words: 1, url: 'https://gonative.example.test/courses/1/2'}, quota: {tier: 'exams', limit: null, remaining: null}});
    if (path.startsWith('attempts?') || path === 'attempts') return json(200, {attempts: [summary], page: 1, per_page: 20, total: 1});
    return problem(404, 'not_found');
  });
  const {origin} = await startApp(t, api.url);
  const send = (path, method, data, headers = {}) => fetch(`${origin}/api/bff/${path}`, {
    method, headers: {Origin: origin, 'Content-Type': 'application/json', ...headers}, body: data === undefined ? undefined : JSON.stringify(data),
  });
  const calls = () => api.calls.length;

  // Allowlist and input validation happen before the backend is called.
  for (const [path, method] of [['anything', 'GET'], ['admin/exams', 'GET'], ['attempts?page=1&page=2', 'GET'], ['attempts?evil=1', 'GET'],
    ['attempts/not-a-uuid', 'GET'], [`attempts/${ATTEMPT}/cost`, 'GET'], ['catalog', 'POST'], ['auth/login', 'GET']]) {
    const r = await send(path, method, method === 'GET' ? undefined : {});
    assert.equal(r.status, 404, `${method} ${path}`);
  }
  let r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'x', userId: 1});
  assert.equal(r.status, 422);
  r = await send('auth/register', 'POST', {email: 'learner@example.test', password: 'long-enough-1', password_confirmation: 'different-1', locale: 'en'});
  assert.equal(r.status, 422);
  r = await send('auth/login', 'POST', {email: 'x'.repeat(17000), password: 'x'});
  assert.equal(r.status, 413);
  assert.equal(calls(), 0);

  // CSRF: a foreign or missing Origin, or a cross-site fetch, never reaches the backend.
  for (const headers of [{Origin: 'https://evil.test'}, {Origin: ''}, {'Sec-Fetch-Site': 'cross-site'}]) {
    r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'correct-password'}, headers);
    assert.equal(r.status, 403);
  }
  r = await fetch(`${origin}/api/bff/auth/login`, {method: 'POST', headers: {Origin: origin, 'Content-Type': 'text/plain'}, body: '{}'});
  assert.equal(r.status, 415);
  assert.equal(calls(), 0);

  // Errors: only safe codes, never upstream text.
  r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'wrong'});
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), {error: 'invalid_credentials'});
  state.failure = {status: 500, body: {message: TOKEN, sql: 'select secret'}};
  r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'correct-password'});
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), {error: 'unavailable'});
  state.failure = problem(422, 'validation_failed', {fields: {email: ['private detail']}});
  r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'correct-password'});
  assert.deepEqual(await r.json(), {error: 'invalid_input'});
  state.failure = problem(429, 'exams_rate_limited', {retry_after: 42});
  r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'correct-password'});
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), {error: 'exams_rate_limited', retry_after: 42});
  state.failure = null;

  // Confirmations return only the fixed status.
  r = await send('auth/register', 'POST', {email: 'learner@example.test', password: 'long-enough-1', password_confirmation: 'long-enough-1', locale: 'ru'});
  assert.equal(r.status, 202);
  assert.deepEqual(await r.json(), {status: 'verification_required'});
  assert.deepEqual(api.calls.at(-1).body, {email: 'learner@example.test', password: 'long-enough-1', locale: 'ru'});

  // Sign-in: token only in an httpOnly host cookie, never in the body.
  r = await send('auth/login', 'POST', {email: 'learner@example.test', password: 'correct-password'});
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.equal(text.includes(TOKEN), false);
  assert.deepEqual(JSON.parse(text), {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
  const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /^__Host-exams=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Domain=/i);
  const Cookie = cookie.split(';')[0];
  assert.equal(r.headers.get('cache-control'), 'private, no-store');

  r = await fetch(`${origin}/api/bff/auth/me`);
  assert.equal(r.status, 401);
  r = await fetch(`${origin}/api/bff/auth/me`, {headers: {Cookie}});
  assert.equal(r.status, 200);
  assert.equal(api.calls.at(-1).headers.authorization, `Bearer ${TOKEN}`);
  r = await fetch(`${origin}/api/bff/attempts?page=2`, {headers: {Cookie}});
  assert.equal(r.status, 200);
  const list = await r.json();
  assert.equal(api.calls.at(-1).path, 'attempts?page=2');
  assert.equal(list.attempts[0].cost_usd, undefined, 'unlisted fields are dropped');

  // Drafts: the essay goes up, but never comes back in an error.
  r = await send(`attempts/${ATTEMPT}/draft`, 'PUT', {expected_revision: 2, response_text: ESSAY}, {Cookie});
  assert.equal(r.status, 409);
  const conflict = await r.text();
  assert.deepEqual(JSON.parse(conflict), {error: 'exams_revision_conflict'});
  assert.equal(conflict.includes('Private essay'), false);
  r = await send(`attempts/${ATTEMPT}/draft`, 'PUT', {expected_revision: 3, response_text: ESSAY}, {Cookie});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).attempt.revision, 4);
  r = await send(`attempts/${ATTEMPT}/draft`, 'PUT', {expected_revision: 3, response_text: 'x'.repeat(40001)}, {Cookie});
  assert.equal(r.status, 422);
  const before = calls();
  r = await send(`attempts/${ATTEMPT}/draft`, 'PUT', {expected_revision: 3, response_text: '\u{1F600}'.repeat(60000)}, {Cookie});
  assert.equal(r.status, 413);
  assert.equal(calls(), before);

  // Submit needs an idempotency key, which is forwarded.
  r = await send(`attempts/${ATTEMPT}/submit`, 'POST', {}, {Cookie});
  assert.equal(r.status, 422);
  assert.equal(calls(), before);
  r = await send(`attempts/${ATTEMPT}/submit`, 'POST', {}, {Cookie, 'Idempotency-Key': 'submit-0001'});
  assert.equal(r.status, 202);
  assert.equal(api.calls.at(-1).headers['idempotency-key'], 'submit-0001');

  // P4.4: a list of words takes only dictionary ids (or null for all); a link out of GoNative must be https.
  const beforeWords = calls();
  for (const bad of [{dictionary_ids: 'all'}, {dictionary_ids: [0]}, {dictionary_ids: [1], words: ['x']}, {}]) {
    r = await send(`attempts/${ATTEMPT}/vocabulary/list`, 'POST', bad, {Cookie});
    assert.equal(r.status, 422);
  }
  assert.equal(calls(), beforeWords);
  r = await send(`attempts/${ATTEMPT}/vocabulary/list`, 'POST', {dictionary_ids: null}, {Cookie});
  assert.equal(r.status, 503, 'a javascript: link from upstream is not passed on');
  r = await send(`attempts/${ATTEMPT}/vocabulary`, 'GET', undefined, {Cookie});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).list.url, 'https://gonative.example.test/courses/1/2');

  // P4.14: a rewrite check takes one finding id and one sentence up to 400 characters; nothing else reaches the backend.
  const beforeChecks = calls();
  for (const bad of [{finding_id: 'f1'}, {finding_id: '../f1', text: 'x'}, {finding_id: 'f1', text: ''}, {finding_id: 'f1', text: 'a'.repeat(401)},
    {finding_id: 'f1', text: 'ok', extra: 1}]) {
    r = await send(`attempts/${ATTEMPT}/rewrite-check`, 'POST', bad, {Cookie});
    assert.equal(r.status, 422);
  }
  assert.equal(calls(), beforeChecks);
  r = await send(`attempts/${ATTEMPT}/rewrite-check`, 'POST', {finding_id: 'f1', text: 'More people use buses.'}, {Cookie});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).check.verdict, 'correct');

  // Sign-out clears the cookie; an expired session clears it too.
  r = await send('auth/logout', 'POST', {}, {Cookie});
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);
  r = await fetch(`${origin}/api/bff/auth/me`, {headers: {Cookie}});
  assert.equal(r.status, 401);
  assert.deepEqual(await r.json(), {error: 'unauthenticated'});
  assert.match(r.headers.get('set-cookie'), /Max-Age=0/);

  // No request reached the backend with a body field outside the allowlist.
  for (const call of api.calls) assert.equal(call.body?.userId, undefined);
});
