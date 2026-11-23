import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {test} from 'node:test';
import {countWords, normalizeResponse, sliceCodePoints} from '../../../packages/exam-domain/src/index.js';
import {buildItems, DATASETS, sha256, toJsonl, usable, type Base, type Prompt} from '../build.js';
import {copiedPrompt, DERIVED_CASES, INJECTION, instructionInEssay, listForm, singleParagraph, underLength} from '../g-cases.js';
import {candidates, family, insertErrors, insertionRules, unknownSkills} from '../insertions.js';

const file = (path: string) => new URL(`../../${path}`, import.meta.url);
const prompts: Prompt[] = JSON.parse(readFileSync(file('sources/task2-prompts.json'), 'utf8')).prompts;
const handwritten = JSON.parse(readFileSync(file('sources/g-handwritten.json'), 'utf8')).items;

/** A clean stand-in for a model-written base (~300 words, four paragraphs). */
const CLEAN = normalizeResponse(`Many cities are struggling with heavy traffic, and some people believe that public transport should be free of charge. In my opinion, this is an effective policy, although it has a number of limitations.

The main argument for free travel is that it would reduce the number of cars in city centres. When buses and trains cost nothing, people who depend on their cars for short trips have a strong reason to leave them at home. This means that roads become less crowded and the air becomes cleaner. Moreover, the government would help families on low incomes, who often spend a large share of their budget on transport. It is important to remember that such families benefit from lower costs more than anyone else.

However, free transport is not without problems. The service has become more popular in cities that tried it, and some systems are now overcrowded. If the government does not invest in more vehicles, passengers may suffer from delays and discomfort. Furthermore, the money has to come from somewhere, which usually means higher taxes for everyone. Authorities therefore need to make a decision about how to pay for the scheme before they introduce it.

In conclusion, I believe that free public transport can play an important role in reducing traffic and pollution. Governments should take steps to fund it properly, because the benefits for society and the environment are greater than the costs.`);

/** Same check as MultiAdmin RubricRules listForm. */
const LIST_LINE = /^[ \t]*(?:[-*•●▪–]|\d+[.)])[ \t]+\S/gmu;

test('every insertion rule names a seed skill and has a unique id', () => {
  assert.deepEqual(unknownSkills(), []);
  assert.equal(new Set(insertionRules.map(r => r.id)).size, insertionRules.length);
});

test('rules produce the intended learner errors', () => {
  const cases: Array<[string, string, string]> = [
    ['article.a_an', 'is an effective policy', 'a effective'],
    ['article.missing_the', 'reduce the number of cars', 'number of'],
    ['tense.participle', 'The service has become popular', 'has became'],
    ['tense.modal_ing', 'the state would help families', 'would helping'],
    ['agreement.third_person', 'This means that roads', 'This mean'],
    ['agreement.plural_subject', 'Many people are worried', 'people is'],
    ['agreement.there_is', 'there are many reasons', 'there is many'],
    ['word_form.adjective_noun', 'It is important to remember', 'is importance'],
    ['word_form.economic', 'strong economic growth', 'economy growth'],
    ['word_form.adverb', 'fund it properly', 'proper'],
    ['spelling', 'The government decided', 'goverment'],
    ['run_on.comma_splice', 'short trips. However, this', 'trips, however'],
    ['run_on.fused', 'short trips. However, this', 'trips however'],
    ['preposition.1', 'people who depend on cars', 'depend of'],
    ['preposition.5', 'In my opinion, it works', 'On my opinion'],
    ['collocation.1', 'need to make a decision', 'do a decision'],
    ['collocation.3', 'can play an important role', 'do an important role'],
    ['collocation.4', 'should take steps to', 'make steps'],
    ['article.extra_the', 'the quality of life', 'of the life'],
    ['article.missing_a', 'As a result, prices rose', 'As result'],
    ['tense.modal_past', 'this can protect workers', 'can protected'],
    ['agreement.singular_noun', 'this change has made', 'this change have'],
    ['agreement.plural_noun', 'these costs are high', 'these costs is'],
    ['word_form.relational', 'a social problem', 'society problem'],
    ['word_form.participle', 'students are interested', 'are interesting'],
    ['word_form.intensified', 'is more significant', 'more significance'],
    ['preposition.17', 'we should discuss the issue', 'discuss about the'],
    ['collocation.11', 'they take part in sport', 'make part'],
  ];
  for (const [ruleId, text, expected] of cases) {
    const rule = insertionRules.find(r => r.id === ruleId);
    assert.ok(rule, ruleId);
    const found = candidates(text, [rule]);
    assert.equal(found.length, 1, `${ruleId} on "${text}"`);
    assert.equal(found[0].replacement, expected, ruleId);
  }
});

test('insertion is deterministic, spread over families and exact in code points', () => {
  const a = insertErrors(CLEAN, 's-b01');
  assert.deepEqual(insertErrors(CLEAN, 's-b01'), a);
  assert.notDeepEqual(insertErrors(CLEAN, 's-b02').errors, a.errors);
  assert.ok(a.errors.length >= 6 && a.errors.length <= 10, `${a.errors.length} errors`);
  assert.ok(new Set(a.errors.map(e => family(e.rule))).size >= 5);

  for (const [i, e] of a.errors.entries()) {
    assert.equal(sliceCodePoints(a.text, e.start, e.end), e.inserted);
    if (i > 0) assert.ok(a.errors[i - 1].end + 25 <= e.start, 'insertions keep a gap');
  }
  // Reverting the insertions from the end restores the clean text.
  let restored = Array.from(a.text);
  for (const e of [...a.errors].reverse()) restored = [...restored.slice(0, e.start), ...Array.from(e.original), ...restored.slice(e.end)];
  assert.equal(restored.join(''), CLEAN);

  // Offsets stay code points when the text has characters outside the BMP.
  const emoji = insertErrors(`🙂 ${CLEAN}`, 's-b01');
  for (const e of emoji.errors) assert.equal(sliceCodePoints(emoji.text, e.start, e.end), e.inserted);
});

test('rules leave accepted English alone', () => {
  const quiet: Array<[string, string]> = [
    ['agreement.singular_noun', 'this data is reliable and the media is free'],
    ['word_form.relational', 'social and political will can change; education policy matters'],
    ['collocation.15', 'they reach a decision together'],
    ['article.missing_the', 'society and the environment, in future, the world-class team'],
    ['article.extra_the', 'a programme of life-skills education'],
    ['run_on.comma_splice', 'in everyday situations. For instance, a student can'],
  ];
  for (const [ruleId, text] of quiet) {
    assert.deepEqual(candidates(text, [insertionRules.find(r => r.id === ruleId)!]).map(c => c.replacement), [], ruleId);
  }
});

test('a base with too few candidates is refused, not thinned', () => {
  assert.throws(() => insertErrors('Short and plain text with nothing to change at all here.', 'x'), /insertions/);
});

test('derived G cases trigger the rubric rules they target', () => {
  assert.ok(!singleParagraph(CLEAN).text.includes('\n'));
  assert.ok((listForm(CLEAN).text.match(LIST_LINE) ?? []).length >= 3);
  const copied = copiedPrompt(CLEAN, prompts[0].text);
  assert.ok(copied.text.startsWith('City councils should make all public transport free of charge so that fewer people drive into city centres. Many cities'));
  const n = countWords(underLength(CLEAN).text);
  assert.ok(n >= 150 && n <= 200, `${n} words`);

  const withErrors = insertErrors(CLEAN, 's-b01');
  const injected = instructionInEssay(withErrors);
  assert.ok(injected.text.includes(`\n\n${INJECTION}\n\n`));
  for (const e of injected.expected.errors!) assert.equal(sliceCodePoints(injected.text, e.start, e.end), e.inserted);
});

test('hand-written G cases sit on the intended side of the rules', () => {
  const words = Object.fromEntries(handwritten.map((h: {id: string; text: string}) => [h.id, countWords(h.text)]));
  assert.equal(words['g-short-12'], 12);
  assert.equal(words['g-short-20'], 20);
  assert.equal(words['g-short-21'], 21);
  assert.ok(words['g-weak-injection'] < 250);
  for (const id of ['g-template-a', 'g-template-b', 'g-unusual-a', 'g-unusual-b']) assert.ok(words[id] >= 250, `${id}: ${words[id]}`);
  for (const h of handwritten) assert.equal(normalizeResponse(h.text), h.text, h.id);
});

test('prompts: 30 original questions, split by prompt', () => {
  assert.equal(prompts.length, 30);
  assert.equal(prompts.filter(p => p.split === 'dev').length, 15);
  assert.equal(new Set(prompts.map(p => p.id)).size, 30);
});

test('buildItems assembles S and G with valid spans', () => {
  const bases: Base[] = prompts.slice(0, 8).concat(prompts.slice(15, 23)).map((p, i) => ({
    id: `b${String(i + 1).padStart(2, '0')}`, promptId: p.id, text: CLEAN,
    author: {provider: 'test', model: 'test'}, check: {provider: 'test', model: 'test', clean: true, issues: []},
  }));
  bases.push({...bases[0], id: 'b99', check: {provider: 'test', model: 'test', clean: false, issues: [{}]}});
  assert.equal(usable(bases[16]), false);
  assert.equal(usable({...bases[16], adjudication: {status: 'fixed', note: 'corrected'}}), true);

  const items = buildItems(prompts, bases, handwritten);
  assert.equal(items.filter(i => i.set === 'S').length, 16);
  assert.equal(items.filter(i => i.set === 'G').length, DERIVED_CASES.length * 2 + handwritten.length);
  const offTopic = items.find(i => i.id === 'g-off-topic-dev')!;
  const base = bases.find(b => b.id === offTopic.source.base)!;
  assert.notEqual(offTopic.prompt, prompts.find(p => p.id === base.promptId)!.text);
  assert.ok(items.every(i => i.split === 'dev' || i.split === 'test'));
});

test('committed datasets match a fresh build', () => {
  for (const id of [...Object.keys(DATASETS), 'exam-a0']) {
    const manifestPath = file(`datasets/${id}/manifest.json`);
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    // Sets with third-party texts keep their items in raw/, which exists only after a local build.
    const itemsPath = file(`datasets/${id}/${manifest.items}`);
    if (!existsSync(itemsPath)) continue;
    assert.equal(manifest.itemsSha256, sha256(readFileSync(itemsPath, 'utf8')), `${id}: run npm run bench:build`);
  }
  assert.equal(typeof toJsonl, 'function');
});
