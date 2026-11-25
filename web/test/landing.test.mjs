import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {json, problem, startApp, startMock} from './harness.mjs';

test('Hosts: the IELTS landing on its own host, everything else on the application host', {timeout: 180000}, async t => {
  const api = await startMock(t, ({path}) => (path === 'catalog' ? json(200, {exams: []}) : problem(404, 'not_found')));
  // As in production, the application and the landing have their own hostnames (Chrome resolves *.localhost
  // to this machine). Next would turn a redirect to its own bind address into a relative one.
  const {origin: bind} = await startApp(t, api.url, {EXAMS_LANDING_HOSTS: 'ielts.localhost=ielts', EXAMS_WEB_ORIGIN: 'http://exams.localhost:PORT'});
  const port = new URL(bind).port;
  const origin = `http://exams.localhost:${port}`;
  const landing = `http://ielts.localhost:${port}`;
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage({locale: 'en-GB'});

  // The landing host's root picks a language and shows the landing, closed to indexing.
  let response = await page.goto(`${landing}/`);
  assert.equal(page.url(), `${landing}/en`);
  assert.match(response.headers()['x-robots-tag'], /noindex/);
  await page.getByRole('heading', {level: 1, name: 'Practise IELTS essays with feedback on your own sentences'}).waitFor();
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${landing}/en`);
  assert.equal(await page.locator('link[rel="alternate"][hreflang="ru"]').getAttribute('href'), `${landing}/ru`);
  assert.equal(await page.locator('link[rel="alternate"][hreflang="uk"]').getAttribute('href'), `${landing}/uk`);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');

  // Honest wording: the sample range is labelled approximate; no promise of an official or exact score.
  assert.equal(await page.locator('.landing-example .range-note').textContent(), 'approximate');
  assert.doesNotMatch(await page.locator('main').textContent(), /exact (band|score) calculator|guarantee/i);
  await page.getByText('not an official score').waitFor();

  // Calls to action lead to registration on the application host, with the exam and UTM labels.
  const cta = new URL(await page.getByRole('link', {name: 'Start for free'}).first().getAttribute('href'));
  assert.equal(cta.origin, origin);
  assert.equal(cta.pathname, '/en/register');
  assert.deepEqual(Object.fromEntries(cta.searchParams), {exam: 'ielts', utm_source: 'ielts_landing', utm_medium: 'landing', utm_campaign: 'hero'});
  assert.equal(await page.getByRole('link', {name: 'Privacy Policy'}).getAttribute('href'), `${origin}/en/privacy`);
  await page.getByRole('link', {name: 'Start for free'}).first().click();
  await page.waitForURL(`${origin}/en/register?**`);
  await page.getByRole('heading', {name: 'Create an account'}).waitFor();

  // Russian landing; the language switch stays on the landing host.
  await page.goto(`${landing}/en`);
  await page.getByRole('link', {name: 'RU'}).click();
  await page.waitForURL(`${landing}/ru`);
  await page.getByRole('heading', {level: 1, name: 'Тренируйте эссе IELTS с разбором ваших собственных предложений'}).waitFor();
  // Ukrainian landing (owner 2026-11-25), labelled UA in the switch.
  await page.getByRole('link', {name: 'UA'}).click();
  await page.waitForURL(`${landing}/uk`);
  await page.getByRole('heading', {level: 1, name: 'Тренуйте есе IELTS із розбором ваших власних речень'}).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'uk');

  // Any other path on the landing host goes to the application host; the BFF does not answer there.
  response = await page.goto(`${landing}/ru/login?next=%2Fielts%2Fwriting`);
  assert.equal(page.url(), `${origin}/ru/login?next=%2Fielts%2Fwriting`);
  response = await page.goto(`${landing}/api/bff/catalog`);
  assert.equal(response.status(), 404);
  response = await page.goto(`${origin}/api/bff/catalog`);
  assert.equal(response.status(), 200);

  // The landing route does not exist on the application host.
  response = await page.goto(`${origin}/en/landing/ielts`);
  assert.equal(response.status(), 404);
  response = await page.goto(`${origin}/en`);
  assert.equal(page.url(), `${origin}/en/login`);

  // 320 px, dark: the landing fits.
  const phone = await browser.newPage({viewport: {width: 320, height: 700}, colorScheme: 'dark'});
  for (const locale of ['ru', 'uk']) {
    await phone.goto(`${landing}/${locale}`);
    await phone.locator('h1').waitFor();
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${locale} fits 320 px`);
  }
});
