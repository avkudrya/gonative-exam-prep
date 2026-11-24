// Test harness: a fake Exams API (no MultiAdmin, no AI, no network) and the built Next app on a free port.
// Run `npm run build` first; tests use the production build, as deploy does.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';

export async function freePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const {port} = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return port;
}

/** `handler(req, body)` returns `{status?, body?, headers?}`; every call is recorded. */
export async function startMock(t, handler) {
  const calls = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const call = {method: req.method, path: req.url.replace(/^\/api\/exam\//, ''), headers: req.headers, body: raw ? JSON.parse(raw) : undefined};
    calls.push(call);
    const out = (await handler(call)) ?? {status: 404, body: {error: {code: 'not_found'}}};
    res.statusCode = out.status ?? 200;
    for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
    if (out.status === 204) return res.end();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(out.body ?? {}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return {calls, url: `http://127.0.0.1:${server.address().port}/api/exam`};
}

export async function startApp(t, apiUrl, env = {}) {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, ['../node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: new URL('../', import.meta.url),
    env: {...process.env, NEXT_TELEMETRY_DISABLED: '1', EXAMS_API_URL: apiUrl, EXAMS_WEB_ORIGIN: origin,
      ...Object.fromEntries(Object.entries(env).map(([k, v]) => [k, String(v).replace('PORT', String(port))]))},
  });
  let output = '';
  app.stdout.on('data', d => output += d);
  app.stderr.on('data', d => output += d);
  t.after(() => app.kill('SIGTERM'));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(output)), 30000);
    const ready = () => { if (output.includes('Ready')) { clearTimeout(timer); resolve(); } };
    app.stdout.on('data', ready);
    app.once('exit', code => { clearTimeout(timer); reject(new Error(`next exited ${code}: ${output}`)); });
  });
  return {origin, output: () => output};
}

export const json = (status, body, headers) => ({status, body, headers});
export const problem = (status, code, extra = {}) => ({status, body: {error: {code, ...extra}}});

export const TERMS = '2026-11-23';
export const profileFixture = (over = {}) => ({
  interface_locale: 'en', target_exam_key: null, target_result: null, exam_date: null, weekly_minutes: null,
  feedback_language: 'en', translation_language: null, age_confirmed: true, terms_accepted: true, terms_version: TERMS,
  onboarding_complete: true, ...over,
});
const writing = assessable => ({key: 'writing', official_name: 'Writing', tasks: [
  {key: 'task-1', official_name: 'Task 1', time_minutes: 20, min_words: 150, assessable: false, criteria: []},
  {key: 'task-2', official_name: 'Task 2', time_minutes: 40, min_words: 250, assessable, criteria: assessable ? [
    {key: 'task_response', official_name: 'Task Response', scale: {kind: 'band', min: 0, max: 9, step: 1, approximate: {step: 0.5, minWidth: 1}}},
  ] : []},
]});
export const catalogFixture = {exams: [
  {exam_key: 'ielts-academic', provider_key: 'ielts', official_name: 'IELTS Academic', learning_language: 'en', version: '2026-11', sections: [writing(true)]},
  {exam_key: 'ielts-general-training', provider_key: 'ielts', official_name: 'IELTS General Training', learning_language: 'en', version: '2026-11', sections: [writing(true)]},
]};
