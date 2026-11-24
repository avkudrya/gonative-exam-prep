import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {problem, startApp, startMock} from './harness.mjs';

// deployment/check-web.sh against this production build with the production host settings: the same check
// deploy.sh runs on the candidate before switching. It never reaches the backend.
const check = (origin, buildId) => spawnSync('bash', [new URL('../../deployment/check-web.sh', import.meta.url).pathname, origin, buildId], {encoding: 'utf8'});
const production = {SITE_ORIGIN: 'https://exams.mnemonicwords.app', EXAMS_WEB_ORIGIN: 'https://exams.mnemonicwords.app', EXAMS_LANDING_HOSTS: 'ielts.mnemonicwords.app=ielts'};

test('Release check passes on this build and refuses a wrong build or origin', {timeout: 120000}, async t => {
  const calls = [];
  const api = await startMock(t, ({path}) => { calls.push(path); return problem(503, 'unavailable'); });
  const buildId = readFileSync(new URL('../.next/BUILD_ID', import.meta.url), 'utf8').trim();
  const {origin} = await startApp(t, api.url, production);

  const ok = check(origin, buildId);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(calls, [], 'the check does not call the backend');

  const stale = check(origin, 'previous-build');
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /not the expected build/);

  const misconfigured = await startApp(t, api.url, {...production, EXAMS_WEB_ORIGIN: 'https://exams.example.test'});
  const wrong = check(misconfigured.origin, buildId);
  assert.notEqual(wrong.status, 0, 'a wrong EXAMS_WEB_ORIGIN is caught');
  // The landing links and the BFF origin check both depend on it; the landing check comes first.
  assert.match(wrong.stderr, /registration on the application host|does not accept its own origin/);
});
