import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {problem, startApp, startMock} from './harness.mjs';

const hosts = {EXAMS_LANDING_HOSTS: 'ielts.localhost=ielts', EXAMS_WEB_ORIGIN: 'http://exams.localhost:PORT', EXAMS_LANDING_ORIGIN: 'http://ielts.localhost:PORT'};
const pages = ['ielts-writing-task-2-checker', 'ielts-academic-task-1-checker', 'ielts-general-training-letter-checker'];

test('Checker pages (P6.5): one page per search, with our tasks, an example and questions', {timeout: 180000}, async t => {
  const api = await startMock(t, () => problem(404, 'not_found'));
  const {origin: bind} = await startApp(t, api.url, hosts);
  const port = new URL(bind).port;
  const landing = `http://ielts.localhost:${port}`;
  const app = `http://exams.localhost:${port}`;
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage({locale: 'en-GB'});
  const probe = await browser.newPage();
  const status = async url => (await probe.goto(url)).status();

  for (const slug of pages) {
    for (const locale of ['en', 'ru', 'uk']) {
      const response = await page.goto(`${landing}/${locale}/${slug}`);
      assert.equal(response.status(), 200, `${locale}/${slug}`);
      assert.match(response.headers()['x-robots-tag'], /noindex/);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${landing}/${locale}/${slug}`);
      assert.equal(await page.locator('.checker-tasks > li').count(), 4, `${slug}: four tasks`);
      const example = await page.getByRole('link', {name: {en: 'Open the example', ru: 'Открыть пример', uk: 'Відкрити приклад'}[locale]}).getAttribute('href');
      assert.equal(await status(`${landing}${example}`), 200, `${slug}: the example exists`);
      // The guide chapter is linked only in the languages it is written in: no link to a missing page.
      const guide = page.locator('.checker-guide a');
      if (locale === 'en') assert.equal(await status(`${landing}${await guide.getAttribute('href')}`), 200, `${slug}: guide link`);
      else assert.equal(await guide.count(), 0, `${slug}: no guide link in ${locale} yet`);
      const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
      assert.deepEqual(ld['@graph'].map(n => n['@type']), ['WebPage', 'FAQPage']);
    }
  }
  // The Academic page draws its charts from the library data.
  await page.goto(`${landing}/en/ielts-academic-task-1-checker`);
  assert.equal(await page.locator('.checker-tasks .chart-view').count(), 4);
  const cta = new URL(await page.getByRole('link', {name: 'Write this task'}).first().getAttribute('href'));
  assert.equal(cta.origin, app);
  assert.equal(cta.searchParams.get('utm_source'), 'ielts_checker');
  // The landing's task cards lead to the checker pages; unknown paths stay not found; the application host redirects.
  await page.goto(`${landing}/en`);
  assert.equal(await page.getByRole('link', {name: 'Task 2 essays'}).getAttribute('href'), '/en/ielts-writing-task-2-checker');
  assert.equal((await page.goto(`${landing}/en/ielts-speaking-checker`)).url(), `${app}/en/ielts-speaking-checker`);
  await page.goto(`${app}/en/ielts-writing-task-2-checker`);
  assert.equal(page.url(), `${landing}/en/ielts-writing-task-2-checker`);
  const phone = await browser.newPage({viewport: {width: 320, height: 700}});
  await phone.goto(`${landing}/en/ielts-academic-task-1-checker`);
  await phone.locator('h1').waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'fits 320 px');
});
