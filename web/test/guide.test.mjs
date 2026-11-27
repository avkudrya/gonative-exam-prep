import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {chromium} from 'playwright';
import {json, problem, startApp, startMock} from './harness.mjs';

const hosts = {EXAMS_LANDING_HOSTS: 'ielts.localhost=ielts', EXAMS_WEB_ORIGIN: 'http://exams.localhost:PORT', EXAMS_LANDING_ORIGIN: 'http://ielts.localhost:PORT'};

test('Guide (P6.2): chapters on the landing host, closed to indexing until the owner opens it', {timeout: 180000}, async t => {
  const api = await startMock(t, ({path}) => (path === 'catalog' ? json(200, {exams: []}) : problem(404, 'not_found')));
  const {origin: bind} = await startApp(t, api.url, hosts);
  const port = new URL(bind).port;
  const app = `http://exams.localhost:${port}`;
  const landing = `http://ielts.localhost:${port}`;
  const browser = await chromium.launch({headless: true});
  t.after(() => browser.close());
  const page = await browser.newPage({locale: 'en-GB'});

  // The contents page lists the written chapters; the chapter renders with its sections, sources and a call to practise.
  let response = await page.goto(`${landing}/en/guide`);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['x-robots-tag'], /noindex/);
  await page.getByRole('heading', {level: 1, name: 'How to prepare for IELTS'}).waitFor();
  await page.getByRole('link', {name: /IELTS test format/}).click();
  await page.waitForURL(`${landing}/en/guide/ielts-format`);
  await page.getByRole('heading', {level: 1, name: /IELTS test format/}).waitFor();
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `${landing}/en/guide/ielts-format`);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
  // Only the languages the chapter is written in are announced.
  assert.equal(await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href'), `${landing}/en/guide/ielts-format`);
  assert.equal(await page.locator('link[rel="alternate"][hreflang="ru"]').count(), 0);
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
  assert.equal(ld['@graph'][0]['@type'], 'Article');
  assert.equal(ld['@graph'][0].dateModified, '2026-11-27');
  await page.getByText('Facts checked against official IELTS pages on November 27, 2026').waitFor();
  assert.ok(await page.locator('.guide-sources a[href^="https://ielts.org/"]').count() >= 5, 'official sources are linked');
  const cta = new URL(await page.locator('.guide-practice a.button').getAttribute('href'));
  assert.equal(cta.origin, app);
  assert.deepEqual(Object.fromEntries(cta.searchParams), {exam: 'ielts', utm_source: 'ielts_guide', utm_medium: 'guide', utm_campaign: 'ielts-format'});
  assert.doesNotMatch(await page.locator('main').textContent(), /guarantee|your (exact )?IELTS score/i);

  // Every chapter listed on the contents page opens, and every guide link inside it leads to a chapter that exists.
  await page.goto(`${landing}/en/guide`);
  const chapters = await page.locator('.guide-chapters a').evaluateAll(links => links.map(a => a.getAttribute('href')));
  assert.ok(chapters.length >= 7, `${chapters.length} chapters`);
  const linked = new Set();
  for (const href of chapters) {
    assert.equal((await page.goto(`${landing}${href}`)).status(), 200, href);
    for (const target of await page.locator('main a[href*="/guide/"]').evaluateAll(links => links.map(a => a.getAttribute('href')))) linked.add(target);
    assert.equal(await page.locator('.guide-practice a.button, .guide-note').count() > 0, true, `${href} ends with practice or a note`);
  }
  for (const href of linked) assert.ok(chapters.includes(href), `${href} is linked but not a chapter`);

  // A language the chapter is not written in, an unknown chapter: not found.
  assert.equal((await page.goto(`${landing}/ru/guide/ielts-format`)).status(), 404);
  assert.equal((await page.goto(`${landing}/en/guide/no-such-chapter`)).status(), 404);
  // The guide lives on the landing host: the application host sends it there.
  await page.goto(`${app}/en/guide/ielts-format`);
  assert.equal(page.url(), `${landing}/en/guide/ielts-format`);
  // Robots and the sitemap stay closed.
  response = await page.goto(`${landing}/robots.txt`);
  assert.match(await response.text(), /Disallow: \//);
  response = await page.goto(`${landing}/sitemap.xml`);
  assert.doesNotMatch(await response.text(), /<loc>/);

  // 320 px: tables scroll inside their box, the page does not.
  const phone = await browser.newPage({viewport: {width: 320, height: 700}, colorScheme: 'dark'});
  await phone.goto(`${landing}/en/guide/ielts-format`);
  await phone.locator('h1').waitFor();
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the chapter fits 320 px');
});

test('Indexing open (P6.7): only the landing host\'s public pages', {timeout: 180000}, async t => {
  const api = await startMock(t, () => problem(404, 'not_found'));
  const {origin: bind} = await startApp(t, api.url, {...hosts, EXAMS_PUBLIC_INDEXING: 'open'});
  const port = new URL(bind).port;
  const landing = `http://ielts.localhost:${port}`;
  const app = `http://exams.localhost:${port}`;
  // fetch() cannot set Host; a plain request can, as nginx does.
  const get = (url, host) => new Promise((resolve, reject) => {
    const req = httpRequest(url, {headers: {host}}, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => resolve({status: res.statusCode, headers: {get: name => res.headers[name] ?? null}, text: async () => body}));
    });
    req.on('error', reject);
    req.end();
  });

  for (const path of ['/en', '/ru', '/en/guide', '/en/guide/ielts-format']) {
    const response = await get(`${bind}${path}`, `ielts.localhost:${port}`);
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-robots-tag'), null, `${path} has no noindex header`);
    const html = await response.text();
    assert.match(html, /<meta name="robots" content="index, follow"/, `${path} allows indexing`);
  }
  let robots = await (await get(`${bind}/robots.txt`, `ielts.localhost:${port}`)).text();
  assert.match(robots, /Allow: \//);
  assert.match(robots, new RegExp(`Sitemap: ${landing}/sitemap.xml`));
  const sitemap = await (await get(`${bind}/sitemap.xml`, `ielts.localhost:${port}`)).text();
  for (const loc of ['/en', '/ru', '/uk', '/en/guide', '/en/guide/ielts-format']) assert.match(sitemap, new RegExp(`<loc>${landing}${loc}</loc>`), loc);
  assert.doesNotMatch(sitemap, /\/ru\/guide/, 'no Russian guide until it is written');

  // The application host and private paths stay closed.
  for (const path of ['/en/login', '/en/privacy']) {
    const response = await get(`${bind}${path}`, `exams.localhost:${port}`);
    assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/, path);
  }
  robots = await (await get(`${bind}/robots.txt`, `exams.localhost:${port}`)).text();
  assert.match(robots, /Disallow: \//);
  assert.doesNotMatch(await (await get(`${bind}/sitemap.xml`, `exams.localhost:${port}`)).text(), /<loc>/);
  const bff = await get(`${bind}/api/bff/catalog`, `exams.localhost:${port}`);
  assert.match(bff.headers.get('x-robots-tag') ?? '', /noindex/);
  // Other paths on the landing host still go to the application host.
  const other = await get(`${bind}/en/login`, `ielts.localhost:${port}`);
  assert.equal(other.status, 308);
  assert.equal(other.headers.get('location'), `${app}/en/login`);
});
