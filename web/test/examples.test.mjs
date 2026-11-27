import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {problem, startApp, startMock} from './harness.mjs';

const hosts = {EXAMS_LANDING_HOSTS: 'ielts.localhost=ielts', EXAMS_WEB_ORIGIN: 'http://exams.localhost:PORT', EXAMS_LANDING_ORIGIN: 'http://ielts.localhost:PORT'};

test('Feedback examples (P6.5): real feedback on our samples, read-only, on the landing host', {timeout: 180000}, async t => {
  const calls = [];
  const api = await startMock(t, ({path}) => { calls.push(path); return problem(404, 'not_found'); });
  const {origin: bind} = await startApp(t, api.url, hosts);
  const port = new URL(bind).port;
  const landing = `http://ielts.localhost:${port}`;
  const app = `http://exams.localhost:${port}`;
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage({locale: 'en-GB'});
  const bff = [];
  page.on('request', request => { if (request.url().includes('/api/bff/')) bff.push(request.url()); });

  let response = await page.goto(`${landing}/en/examples`);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['x-robots-tag'], /noindex/);
  const links = await page.locator('.examples-list a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  assert.equal(links.length, 6);

  for (const href of links) {
    response = await page.goto(`${landing}${href}`);
    assert.equal(response.status(), 200, href);
    await page.locator('.criteria .range-value').first().waitFor();
    // Ranges are shown as approximate, never as a single band.
    for (const note of await page.locator('.criteria .range-note').allTextContents()) assert.equal(note, 'approximate');
    assert.ok(await page.locator('.essay-marked mark').count() > 0, `${href} marks the text`);
    // Read-only: no report, rewrite or practice controls.
    assert.equal(await page.getByRole('button', {name: /Report|Write a new version/i}).count(), 0, `${href} has no actions`);
    assert.equal(await page.locator('.result-actions').count(), 0);
  }
  // The chart of the Academic example is drawn from its data; the left-out comments are disclosed.
  await page.goto(`${landing}/en/examples/academic-task-1-line-graph`);
  assert.ok(await page.locator('.chart-view svg').count() > 0);
  await page.getByText('We left out 1 comment from this feedback that we found to be wrong.').waitFor();
  // Clicking a highlight selects its card.
  await page.locator('.essay-marked mark').first().click();
  await page.locator('.finding.active').first().waitFor();
  assert.deepEqual(bff, [], 'the example pages never call the API');
  assert.deepEqual(calls, []);

  // Russian page: interface in Russian, a note that the explanations here are in English.
  await page.goto(`${landing}/ru/examples/task-2-opinion-essay`);
  await page.getByText('Объяснения в этом примере на английском.', {exact: false}).waitFor();

  // Only on the landing host; unknown example: not found.
  await page.goto(`${app}/en/examples/task-2-opinion-essay`);
  assert.equal(page.url(), `${landing}/en/examples/task-2-opinion-essay`);
  assert.equal((await page.goto(`${landing}/en/examples/nope`)).status(), 404);

  // The landing links to the examples; 320 px fits.
  await page.goto(`${landing}/en`);
  assert.equal(await page.getByRole('link', {name: 'See full feedback examples'}).getAttribute('href'), '/en/examples');
  const phone = await browser.newPage({viewport: {width: 320, height: 700}});
  await phone.goto(`${landing}/en/examples/academic-task-1-line-graph`);
  await phone.locator('h1').waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'fits 320 px');
});
