import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

// The legal texts are TypeScript modules; read them as text to check structure and wording without a build step.
const source = name => readFileSync(new URL(`../src/lib/legal/${name}.ts`, import.meta.url), 'utf8');
const ids = (text, start, end) => [...text.slice(text.indexOf(start), end ? text.indexOf(end) : undefined).matchAll(/\{id: '([a-z-]+)'/g)].map(m => m[1]);

test('privacy and terms: the same sections in en, ru and uk, honest score wording, AI provider named', () => {
  for (const name of ['privacy', 'terms']) {
    const text = source(name);
    const en = ids(text, 'const en', 'const ru');
    const ru = ids(text, 'const ru', 'const uk');
    const uk = ids(text, 'const uk');
    assert.ok(en.length >= 8, `${name}: sections`);
    assert.deepEqual(ru, en, `${name}: en and ru sections differ`);
    assert.deepEqual(uk, en, `${name}: en and uk sections differ`);
    assert.doesNotMatch(text, /your (exact )?IELTS score|official (score|result)s? (is|are) shown|точн\w* балл IELTS/i);
  }
  const privacy = source('privacy');
  assert.match(privacy, /Anthropic/);
  assert.match(privacy, /not used to train|не используются/);
  assert.match(privacy, /не використовуються/);
  assert.match(source('terms'), /16/);
});

test('the Terms version matches MultiAdmin exam.terms_version (when MultiAdmin is checked out next to this repo)', t => {
  const config = new URL('../../../../MultiVerse/MultiAdmin/config/exam.php', import.meta.url);
  if (!existsSync(config)) return t.skip('MultiAdmin is not available here');
  const backend = /'terms_version' => '([^']+)'/.exec(readFileSync(config, 'utf8'))?.[1];
  const web = /TERMS_VERSION = '([^']+)'/.exec(source('common'))?.[1];
  assert.equal(web, backend);
});
