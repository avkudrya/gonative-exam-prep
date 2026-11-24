import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {catalogFixture, json, problem, profileFixture, startApp, startMock} from './harness.mjs';
import {ESSAY, FINDINGS, RESULT} from './result-fixture.mjs';

const TOKEN = '31|result-session-fixture';
const PROMPT = 'Some say cities should ban cars from the centre, others disagree. Discuss both views and give your opinion.';

test('Feedback: submit, waiting, result with highlights, reports, rewrite, failure, quota, partial', {timeout: 240000}, async t => {
  const state = {attempts: new Map(), remaining: 2, submits: [], reports: [], creates: [], polls: 0, outcome: 'assessed', submitError: null, failPut: false};
  const make = (over = {}) => {
    const a = {uuid: randomUUID(), status: 'draft', revision: 1, response_text: ESSAY, assessment: null, result: null, from: null, ...over};
    state.attempts.set(a.uuid, a);
    return a;
  };
  const summary = a => ({uuid: a.uuid, exam_key: 'ielts-academic', exam_version: '2026-11', section_key: 'writing', task_key: 'task-2', source: 'library',
    topic: 'City transport', status: a.status, revision: a.revision, word_count: 168, word_count_rule: 'whitespace-v1', submitted_at: a.status === 'draft' ? null : '2026-11-24T10:30:00+00:00',
    created_at: '2026-11-24T10:00:00+00:00', updated_at: '2026-11-24T10:30:00+00:00', assessment: a.assessment && {uuid: a.assessment.uuid, status: a.assessment.status}});
  const assessment = a => ({...a.assessment, feedback_language: 'en', created_at: new Date().toISOString(), finished_at: null, result: a.result});
  const api = await startMock(t, ({method, path, headers, body}) => {
    if (path === 'catalog') return json(200, catalogFixture);
    if (path === 'auth/login') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active', session_token: TOKEN, expires_at: new Date(Date.now() + 3600e3).toISOString()});
    if (headers.authorization !== `Bearer ${TOKEN}`) return problem(401, 'exams_unauthenticated');
    if (path === 'auth/me') return json(200, {user: {email: 'learner@example.test', name: null, has_password: true}, account_state: 'active'});
    if (path === 'profile') return json(200, {profile: profileFixture({target_exam_key: 'ielts-academic'})});
    if (path === 'entitlements') return json(200, {plan: 'free', period: {start: '2026-11-01', end: '2026-12-01'}, assessments: {limit: 2, used: 2 - state.remaining, pending: 0, remaining: state.remaining}, concurrent: 1});
    if (path === 'attempts' && method === 'POST') {
      state.creates.push(body);
      const a = make({response_text: ESSAY, revision: 0, from: body.from_attempt});
      return json(201, {attempt: {...summary(a), prompt: {text: PROMPT}, response_text: a.response_text, assessments: []}});
    }
    const m = /^attempts\/([0-9a-f-]{36})(?:\/(draft|submit|assessment|reports))?$/.exec(path);
    const a = m && state.attempts.get(m[1]);
    if (!a) return problem(404, 'not_found');
    const action = m[2];
    if (!action && method === 'GET') return json(200, {attempt: {...summary(a), prompt: {text: PROMPT}, response_text: a.response_text, assessments: []}});
    if (action === 'draft') {
      if (state.failPut) return {status: 503, body: {}};
      a.response_text = body.response_text; a.revision++;
      return json(200, {attempt: summary(a)});
    }
    if (action === 'submit') {
      state.submits.push({uuid: a.uuid, key: headers['idempotency-key']});
      if (state.submitError) return state.submitError;
      a.status = 'submitted';
      a.assessment = {uuid: randomUUID(), status: 'queued'};
      state.polls = 0;
      state.remaining = Math.max(0, state.remaining - 1);
      return json(202, {attempt: summary(a), assessment: assessment(a), reused: false});
    }
    if (action === 'assessment') {
      if (!a.assessment) return problem(404, 'not_found');
      if (a.assessment.status === 'queued' || a.assessment.status === 'running') {
        state.polls++;
        a.assessment.status = 'running';
        if (state.polls >= 2) {
          a.assessment.status = state.outcome;
          a.status = state.outcome === 'failed' ? 'failed' : state.outcome;
          a.result = state.outcome === 'failed' ? null : a.resultOverride ?? RESULT;
          if (state.outcome === 'failed') state.remaining++;
        }
      }
      return json(200, {assessment: assessment(a)});
    }
    if (action === 'reports' && method === 'POST') {
      state.reports.push(body);
      return json(201, {report: {uuid: randomUUID(), kind: body.kind, finding_id: body.finding_id ?? null, status: 'open', text_access_allowed: !!body.allow_text_access, created_at: null}});
    }
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

  // The draft cannot be saved: nothing is submitted.
  const draft = make();
  await page.goto(`${origin}/en/ielts/writing/${draft.uuid}`);
  state.failPut = true;
  await page.getByLabel('Your essay').evaluate(el => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.getByLabel('Your essay').pressSequentially(' Extra.');
  await page.getByRole('button', {name: 'Get feedback'}).click();
  const dialog = page.getByRole('dialog', {name: 'Send this essay for feedback?'});
  await dialog.getByText('Uses 1 of your 2 remaining free feedbacks').waitFor();
  await dialog.getByText('Anthropic').waitFor();
  await dialog.getByRole('button', {name: 'Send for feedback'}).click();
  await dialog.getByRole('alert').filter({hasText: 'could not be saved'}).waitFor({timeout: 20000});
  assert.equal(state.submits.length, 0);

  // Saved, submitted once with a request key, then the waiting screen turns into the result.
  state.failPut = false;
  await dialog.getByRole('button', {name: 'Send for feedback'}).click();
  await page.getByRole('heading', {name: 'Assessing your essay…'}).waitFor({timeout: 20000});
  assert.equal(state.submits.length, 1);
  assert.match(state.submits[0].key, /^submit-[0-9a-f]{24}$/);
  assert.equal(draft.response_text.endsWith(' Extra.'), true);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), `exams:draft:${draft.uuid}`), null);
  await page.getByRole('heading', {name: 'Criteria'}).waitFor({timeout: 20000});

  // ADR-003: every number is a range with "approximate" next to it, under a note that it is not official.
  await page.getByText('not official results').first().waitFor();
  const ranges = await page.locator('.range').evaluateAll(nodes => nodes.map(n => n.textContent));
  assert.deepEqual(ranges, ['≈ 5.5–6.5approximate', '≈ 6–7approximate', '≈ 5–6approximate', '≈ 5–6approximate']);
  assert.doesNotMatch(await page.locator('main').textContent(), /your (IELTS )?score|official (score|band)/i);
  await page.getByText('Low confidence').waitFor();

  // Top fixes grouped by skill in the given order, with readable names and the number of places.
  assert.deepEqual(await page.locator('.fix-skill h3').allTextContents(), ['Word choice', 'Subject–verb agreement', 'Collocations · 2 places', 'Developing ideas']);
  assert.deepEqual(await page.locator('.fixes .suggestion').allTextContents(), ['their cars', 'city centres are', 'banned outright']);
  await page.locator('.finding-skill').filter({hasText: 'Subject–verb agreement'}).waitFor();
  assert.equal(await page.locator('.finding-skill').filter({hasText: '.'}).count(), 0);

  // Highlights mark exactly the quoted words; essay ↔ comments are linked both ways.
  for (const f of FINDINGS.filter(f => f.span)) assert.equal(await page.locator(`mark[data-ids~="${f.id}"]`).textContent(), f.quote);
  assert.equal(await page.locator('.essay-marked').textContent(), draft.response_text);
  await page.locator('mark[data-ids~="f2"]').click();
  assert.equal(await page.locator('[data-finding="f2"]').getAttribute('aria-current'), 'true');
  await page.locator('[data-finding="f1"]').getByRole('button', {name: 'Show in essay'}).click();
  assert.match(await page.locator('mark[data-ids~="f1"]').getAttribute('class'), /active/);
  await page.locator('mark[data-ids~="f6"]').press('Enter');
  assert.equal(await page.locator('[data-finding="f6"]').getAttribute('aria-current'), 'true');

  // One error reported under two criteria is one card with both; a repeated mistake is one card listing its places,
  // and each place keeps its own highlight.
  await page.getByRole('heading', {name: 'Comments (9)'}).waitFor();
  assert.equal(await page.locator('[data-finding="f10"] .badge').textContent(), 'Optional improvement');
  assert.match(await page.locator('[data-finding="f10"]').getAttribute('class'), /\boptional\b/);
  assert.equal(await page.locator('mark[data-ids~="f10"]').getAttribute('class'), 'hl optional');
  assert.deepEqual(await page.locator('[data-finding="f1"] .finding-criterion').allTextContents(), ['Grammar', 'Vocabulary']);
  const repeated = page.locator('[data-finding="f8 f9"]');
  assert.equal(await page.locator('[data-finding~="f9"]').count(), 1);
  assert.equal(await repeated.locator('.places .hint').textContent(), '2 places');
  assert.equal(await repeated.locator('.places li').count(), 2);
  await page.locator('mark[data-ids~="f9"]').click();
  assert.equal(await repeated.getAttribute('aria-current'), 'true');
  await repeated.locator('.places li').nth(1).getByRole('button', {name: 'Show in essay'}).waitFor();

  // Filters.
  await page.getByRole('group', {name: 'Filter comments'}).getByRole('button', {name: 'Grammar'}).click();
  assert.equal(await page.locator('.finding').count(), 3);
  await page.getByRole('button', {name: 'Strengths'}).click();
  assert.equal(await page.locator('.finding').count(), 1);
  await page.getByRole('button', {name: '5 comments'}).click();
  assert.equal(await page.locator('.finding').count(), 5, 'Vocabulary: its own two, the shared error, the repeated mistake and the optional improvement');
  await page.getByRole('button', {name: 'All', exact: true}).click();

  // Reports: on one comment, and on the whole feedback.
  await page.locator('[data-finding="f1"]').getByRole('button', {name: 'Report'}).click();
  const form = page.getByRole('form', {name: 'Report a problem with this feedback'}).first();
  await form.getByLabel('Details (optional)').fill('This is correct in my variety of English.');
  await form.getByLabel(/Allow an administrator/).check();
  await form.getByRole('button', {name: 'Send report'}).click();
  await page.getByText('Thank you. We will review the report.').waitFor();
  assert.deepEqual(state.reports.at(-1), {kind: 'wrong_finding', finding_id: 'f1', message: 'This is correct in my variety of English.', allow_text_access: true});
  await page.getByRole('button', {name: 'Report a problem with this feedback'}).click();
  const general = page.locator('form.report');
  await general.getByLabel('What is wrong?').selectOption('wrong_score');
  await general.getByRole('button', {name: 'Send report'}).click();
  await page.getByText('Thank you. We will review the report.').last().waitFor();
  assert.deepEqual(state.reports.at(-1), {kind: 'wrong_score', allow_text_access: false});

  // A new version starts from this essay.
  await page.getByRole('button', {name: 'Write a new version'}).click();
  await page.waitForURL(url => url.pathname.startsWith('/en/ielts/writing/') && !url.pathname.endsWith(draft.uuid));
  assert.deepEqual(state.creates.at(-1), {exam_key: 'ielts-academic', from_attempt: draft.uuid});
  await page.getByLabel('Your essay').waitFor();

  // A failed assessment is not counted and can be retried with a new request key.
  state.outcome = 'failed';
  const failing = make();
  await page.goto(`${origin}/en/ielts/writing/${failing.uuid}`);
  await page.getByRole('button', {name: 'Get feedback'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Send for feedback'}).click();
  await page.getByRole('heading', {name: 'We could not assess this essay'}).waitFor({timeout: 20000});
  await page.getByText('was not counted').waitFor();
  state.outcome = 'assessed';
  await page.getByRole('button', {name: 'Try again'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Send for feedback'}).click();
  await page.getByRole('heading', {name: 'Criteria'}).waitFor({timeout: 20000});
  const retries = state.submits.filter(s => s.uuid === failing.uuid);
  assert.equal(retries.length, 2);
  assert.notEqual(retries[0].key, retries[1].key);

  // No free feedback left: the dialog says so and cannot send; a backend refusal is explained.
  state.remaining = 0;
  const later = make();
  await page.goto(`${origin}/en/ielts/writing/${later.uuid}`);
  await page.getByRole('button', {name: 'Get feedback'}).click();
  await page.getByRole('dialog').getByText('No free feedbacks left this month.').waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('button', {name: 'Send for feedback'}).isDisabled(), true);
  state.remaining = 1;
  state.submitError = problem(429, 'exams_monthly_quota_exhausted', {retry_after: 3600});
  await page.reload();
  await page.getByRole('button', {name: 'Get feedback'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Send for feedback'}).click();
  await page.getByRole('dialog').getByRole('alert').filter({hasText: 'No free feedbacks left this month.'}).waitFor();
  state.submitError = null;

  // Partial result with a misplaced quote: the criterion says "not assessed", the comment is shown without a highlight.
  const misplaced = FINDINGS.map(f => (f.id === 'f3' ? {...f, span: {start: f.span.start + 1, end: f.span.end + 1}} : f));
  const partial = make({status: 'partial', assessment: {uuid: randomUUID(), status: 'partial'},
    result: {...RESULT, status: 'partial', findings: misplaced, criteria: RESULT.criteria.map(c => (c.criterion_key === 'task_response' ? {...c, estimate: null, summary: 'This criterion could not be assessed this time.'} : c))}});
  await page.goto(`${origin}/en/ielts/writing/${partial.uuid}`);
  await page.getByText('Some criteria could not be assessed this time.').waitFor();
  await page.getByText('Not assessed').waitFor();
  assert.equal(await page.locator('mark[data-ids~="f3"]').count(), 0);
  await page.locator('[data-finding="f3"]').getByText('Could not be marked in the text.').waitFor();

  // 320 px, dark, Russian: the result fits; ranges keep their "approximate" label.
  const phone = await browser.newPage({viewport: {width: 320, height: 700}, colorScheme: 'dark'});
  await phone.context().addCookies(await page.context().cookies());
  await phone.goto(`${origin}/ru/ielts/writing/${draft.uuid}`);
  await phone.getByRole('heading', {name: 'Критерии'}).waitFor();
  assert.equal(await phone.locator('.range-note').first().textContent(), 'ориентировочно');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});
