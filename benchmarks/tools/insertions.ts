/*
 * Error insertion for benchmark set S (docs/phase-0/E-benchmark-plan.md §2): a clean base
 * essay gets 6–10 typical learner errors inserted by rules, and every inserted error is
 * recorded with its span in Unicode code points of the final text (packages/exam-domain
 * src/text.ts), the same unit the assessor reports findings in.
 *
 * Each rule is a regular expression over the clean text and a replacement. The span covers
 * the whole match (the changed words plus the context word that makes them wrong), so a
 * finding that quotes the error from either side overlaps it.
 */

import {codePointLength, seedSkills, type SkillKey} from '../../packages/exam-domain/src/index.js';

export type Severity = 'minor' | 'moderate' | 'major';

export interface InsertionRule {
  id: string;
  skill: SkillKey;
  severity: Severity;
  pattern: RegExp;
  replace: (match: RegExpExecArray) => string;
}

export interface InsertedError {
  start: number;
  end: number;
  skill: SkillKey;
  severity: Severity;
  rule: string;
  original: string;
  inserted: string;
}

interface Candidate {
  rule: InsertionRule;
  index: number;
  length: number;
  original: string;
  replacement: string;
}

/** Keeps the capitalisation of the first letter of the original match. */
function keepCase(original: string, replacement: string): string {
  return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

function fromMap(map: Record<string, string>): (word: string) => string {
  return word => {
    const lower = word.toLowerCase();
    const to = map[lower];
    if (to === undefined) throw new Error(`no mapping for ${word}`);
    return keepCase(word, to);
  };
}

function words(map: Record<string, string>): string {
  return Object.keys(map).join('|');
}

const PAST_SIMPLE: Record<string, string> = {
  become: 'became', taken: 'took', grown: 'grew', given: 'gave', chosen: 'chose', written: 'wrote', begun: 'began',
  seen: 'saw', known: 'knew', driven: 'drove', eaten: 'ate', fallen: 'fell', risen: 'rose', spoken: 'spoke',
  shown: 'showed', gone: 'went', done: 'did',
};
const ING: Record<string, string> = {
  help: 'helping', make: 'making', reduce: 'reducing', improve: 'improving', provide: 'providing', create: 'creating',
  lead: 'leading', allow: 'allowing', encourage: 'encouraging', become: 'becoming', give: 'giving', take: 'taking',
  increase: 'increasing', protect: 'protecting', offer: 'offering',
};
const THIRD_PERSON: Record<string, string> = {
  means: 'mean', makes: 'make', helps: 'help', leads: 'lead', allows: 'allow', gives: 'give', provides: 'provide',
  requires: 'require', depends: 'depend', shows: 'show', causes: 'cause', reduces: 'reduce', creates: 'create',
  becomes: 'become', seems: 'seem', remains: 'remain', offers: 'offer', needs: 'need', takes: 'take', has: 'have',
  does: 'do', is: 'are', encourages: 'encourage', affects: 'affect', costs: 'cost',
};
const PLURAL_VERB: Record<string, string> = {are: 'is', have: 'has', were: 'was', do: 'does'};
const PREPOSITIONS: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/\b(depend(?:s|ed|ing)?|rel(?:y|ies|ied|ying)) on\b/gi, m => `${m[1]} of`],
  [/\b(interested) in\b/gi, m => `${m[1]} on`],
  [/\b(focus(?:es|ed|ing)?) on\b/gi, m => `${m[1]} in`],
  [/\b(responsible) for\b/gi, m => `${m[1]} of`],
  [/\b(in) (my (?:view|opinion))\b/gi, m => `${keepCase(m[1], 'on')} ${m[2]}`],
  [/\b(result(?:s|ed)?) in\b/gi, m => `${m[1]} to`],
  [/\b(aware) of\b/gi, m => `${m[1]} about`],
  [/\b(contribut(?:e|es|ed|ing)) to\b/gi, m => `${m[1]} in`],
  [/\b(benefit(?:s|ed|ing)?) from\b/gi, m => `${m[1]} of`],
  [/\b(suffer(?:s|ed|ing)?) from\b/gi, m => `${m[1]} of`],
  [/\b(invest(?:s|ed|ing)?) in\b/gi, m => `${m[1]} on`],
  [/\b(similar) to\b/gi, m => `${m[1]} with`],
  [/\b(concerned) about\b/gi, m => `${m[1]} of`],
  [/\b(at) (the same time)\b/gi, m => `${keepCase(m[1], 'in')} ${m[2]}`],
  [/\b(on) (the other hand)\b/gi, m => `${keepCase(m[1], 'in')} ${m[2]}`],
  [/\b(according) to\b/gi, m => `${m[1]} of`],
  // Verbs that take a direct object get a preposition: "discuss about", "reach to".
  [/\b(discuss(?:es|ed|ing)?|emphasi[sz](?:e|es|ed|ing)|consider(?:s|ed|ing)?) (the|these|this|their|whether|how|its)\b/gi, m => `${m[1]} about ${m[2]}`],
  [/\b(reach(?:es|ed|ing)?|enter(?:s|ed|ing)?|attend(?:s|ed|ing)?|approach(?:es|ed|ing)?) (the|a|an|their|this|its|school|university|work)\b/gi, m => `${m[1]} to ${m[2]}`],
  [/\b(on) (the internet|social media|weekends?)\b/gi, m => `${keepCase(m[1], 'in')} ${m[2]}`],
  [/\b(capable|instead) of\b/gi, m => `${m[1]} ${m[1].toLowerCase() === 'capable' ? 'to' : 'from'}`],
  [/\b(lead(?:s|ing)?|led) to\b/gi, m => `${m[1]} at`],
  [/\b(spend(?:s|ing)?|spent) (\w+ )?(money|time|hours|billions|millions) on\b/gi, m => `${m[1]} ${m[2] ?? ''}${m[3]} in`],
];
const COLLOCATIONS: Array<[RegExp, (m: RegExpExecArray) => string]> = [
  [/\b(make|makes|making|made) (a |an |the |their |better |important |informed )?(decisions?|mistakes?|efforts?|progress|contributions?)\b/gi,
    m => `${keepCase(m[1], {make: 'do', makes: 'does', making: 'doing', made: 'did'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3]}`],
  [/\b(do|does|doing|did) (more |regular |some |any |serious )?(research|exercise|harm|damage|business)\b/gi,
    m => `${keepCase(m[1], {do: 'make', does: 'makes', doing: 'making', did: 'made'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3]}`],
  [/\b(play|plays|playing|played) (a|an) ((?:\w+ )?role)\b/gi,
    m => `${keepCase(m[1], {play: 'do', plays: 'does', playing: 'doing', played: 'did'}[m[1].toLowerCase()]!)} ${m[2]} ${m[3]}`],
  [/\b(take|takes|taking|took) (steps|measures|action)\b/gi,
    m => `${keepCase(m[1], {take: 'make', takes: 'makes', taking: 'making', took: 'made'}[m[1].toLowerCase()]!)} ${m[2]}`],
  [/\b(pay|pays|paying|paid) (more |closer |close )?attention\b/gi,
    m => `${keepCase(m[1], {pay: 'make', pays: 'makes', paying: 'making', paid: 'made'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}attention`],
  [/\b(heavy) (traffic|rain)\b/gi, m => `${keepCase(m[1], 'strong')} ${m[2]}`],
  [/\b(commit|commits|committing|committed) (a )?(crimes?)\b/gi,
    m => `${keepCase(m[1], {commit: 'do', commits: 'does', committing: 'doing', committed: 'did'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3]}`],
  [/\b(high) (prices?|costs?)\b/gi, m => `${keepCase(m[1], 'expensive')} ${m[2]}`],
  [/\b(gain|gains|gaining|gained) (\w+ )?(experience)\b/gi,
    m => `${keepCase(m[1], {gain: 'earn', gains: 'earns', gaining: 'earning', gained: 'earned'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3]}`],
  [/\b(take|takes|taking|took) care of\b/gi,
    m => `${keepCase(m[1], {take: 'make', takes: 'makes', taking: 'making', took: 'made'}[m[1].toLowerCase()]!)} care of`],
  [/\b(take|takes|taking|took) (advantage|place|part|responsibility)\b/gi,
    m => `${keepCase(m[1], {take: 'make', takes: 'makes', taking: 'making', took: 'made'}[m[1].toLowerCase()]!)} ${m[2]}`],
  [/\b(make|makes|making|made) (a |an |the )?(\w+ )?(difference|sense|use of)\b/gi,
    m => `${keepCase(m[1], {make: 'do', makes: 'does', making: 'doing', made: 'did'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3] ?? ''}${m[4]}`],
  [/\b(have|has|had|having) (a|an) (\w+ )?(impact|effect|influence) on\b/gi,
    m => `${keepCase(m[1], {have: 'give', has: 'gives', had: 'gave', having: 'giving'}[m[1].toLowerCase()]!)} ${m[2]} ${m[3] ?? ''}${m[4]} on`],
  [/\b(raise|raises|raised|raising) (awareness|concerns?)\b/gi,
    m => `${keepCase(m[1], {raise: 'rise', raises: 'rises', raised: 'rose', raising: 'rising'}[m[1].toLowerCase()]!)} ${m[2]}`],
  [/\b(reach|reaches|reached|reaching) (a |an )?(\w+ )?(conclusion)\b/gi,
    m => `${keepCase(m[1], {reach: 'make', reaches: 'makes', reached: 'made', reaching: 'making'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3] ?? ''}${m[4]}`],
  [/\b(meet|meets|met|meeting) (the |their |its )?(needs|demand|requirements|expectations)\b/gi,
    m => `${keepCase(m[1], {meet: 'reach', meets: 'reaches', met: 'reached', meeting: 'reaching'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3]}`],
  [/\b(pose|poses|posed|posing) (a |an |the )?(\w+ )?(threat|risk|challenge)\b/gi,
    m => `${keepCase(m[1], {pose: 'do', poses: 'does', posed: 'did', posing: 'doing'}[m[1].toLowerCase()]!)} ${m[2] ?? ''}${m[3] ?? ''}${m[4]}`],
];
/** Regular verbs common in Task 2 essays; their -ing and -ed forms are built by rule. */
const VERBS = ['reduce', 'improve', 'provide', 'create', 'encourage', 'allow', 'help', 'increase', 'protect', 'offer', 'invest',
  'support', 'ensure', 'require', 'change', 'develop', 'prevent', 'remain', 'affect', 'receive', 'use', 'need', 'learn',
  'work', 'focus', 'produce', 'promote', 'limit', 'struggle', 'benefit', 'contribute', 'expect', 'gain', 'lose', 'face',
  'harm', 'damage', 'raise', 'lower', 'strengthen', 'weaken', 'replace', 'earn', 'save', 'spend', 'buy', 'pay'];
const IRREGULAR_PAST: Record<string, string> = {lose: 'lost', spend: 'spent', buy: 'bought', pay: 'paid'};
const ingForm = (v: string) => v.endsWith('e') && v !== 'see' ? `${v.slice(0, -1)}ing` : `${v}ing`;
const edForm = (v: string) => IRREGULAR_PAST[v] ?? (v.endsWith('e') ? `${v}d` : `${v}ed`);
for (const v of VERBS) ING[v] ??= ingForm(v);
const PAST_FOR_BASE: Record<string, string> = Object.fromEntries(VERBS.map(v => [v, edForm(v)]));
/** Relational adjectives replaced by their noun ("social problems" → "society problems"). */
const NOUN_FOR_RELATIONAL: Record<string, string> = {
  // Only pairs where the noun cannot stand as a modifier; "education policy" or "science research" are fine English.
  social: 'society', financial: 'finance', political: 'politics', national: 'nation', emotional: 'emotion',
  medical: 'medicine', professional: 'profession', traditional: 'tradition', academic: 'academy',
}
/** -ed / -ing participle adjectives swapped ("students are interested" → "students are interesting"). */
const PARTICIPLE_SWAP: Record<string, string> = {
  interested: 'interesting', bored: 'boring', excited: 'exciting', satisfied: 'satisfying', frustrated: 'frustrating',
  confused: 'confusing', worried: 'worrying', overwhelmed: 'overwhelming', motivated: 'motivating',
  interesting: 'interested', boring: 'bored', exciting: 'excited', confusing: 'confused', frustrating: 'frustrated',
};
const NOUN_FOR_ADJ: Record<string, string> = {
  important: 'importance', beneficial: 'benefit', necessary: 'necessity', successful: 'success', harmful: 'harm',
  dangerous: 'danger', responsible: 'responsibility', possible: 'possibility', difficult: 'difficulty',
  healthy: 'health', expensive: 'expense', convenient: 'convenience', efficient: 'efficiency', independent: 'independence',
  creative: 'creativity', flexible: 'flexibility', valuable: 'value', essential: 'essence', productive: 'productivity',
  significant: 'significance', affordable: 'affordability', reliable: 'reliability',
};
const ADJ_FOR_ADV: Record<string, string> = {
  effectively: 'effective', significantly: 'significant', easily: 'easy', quickly: 'quick', properly: 'proper',
  seriously: 'serious', directly: 'direct', heavily: 'heavy', greatly: 'great', dramatically: 'dramatic',
  increasingly: 'increasing', regularly: 'regular', particularly: 'particular', largely: 'large', highly: 'high',
  completely: 'complete', relatively: 'relative', simply: 'simple', entirely: 'entire', genuinely: 'genuine',
  economically: 'economic', financially: 'financial', socially: 'social', widely: 'wide',
  constantly: 'constant', equally: 'equal', fully: 'full', truly: 'true', rapidly: 'rapid', steadily: 'steady',
};
const VERB_FOR_NOUN: Record<string, string> = {
  development: 'develop', improvement: 'improve', reduction: 'reduce', production: 'produce', pollution: 'pollute',
  protection: 'protect', creation: 'create', decision: 'decide', introduction: 'introduce', education: 'educate',
};
const MISSPELLINGS: Record<string, string> = {
  government: 'goverment', governments: 'goverments', environment: 'enviroment', environmental: 'enviromental',
  necessary: 'neccessary', believe: 'beleive', because: 'becuase', their: 'thier', development: 'developement',
  successful: 'succesful', different: 'diffrent', opportunity: 'oportunity', opportunities: 'oportunities',
  recommend: 'reccomend', especially: 'especialy', responsible: 'responsable', knowledge: 'knowlege',
  society: 'sociaty', which: 'wich', business: 'buisness', definitely: 'definately', beginning: 'begining',
  separate: 'seperate', receive: 'recieve', achieve: 'acheive', community: 'comunity', communities: 'comunities',
  technology: 'tecnology', independent: 'independant', experience: 'experiance', although: 'althought',
  convenient: 'convinient', advertisement: 'advertisment', advertisements: 'advertisments', future: 'futur',
};
/** Common sentence openers: joining two sentences before them makes a comma splice or a fused sentence. */
const OPENERS = 'This|These|It|They|However|Moreover|Furthermore|Many|Some|Such|There|People|We|Therefore|'
  + 'Consequently|Another|Finally|Thus|Similarly|Most|Instead|Without|Even';
// Not "For example", "For instance", "In addition", "As a result": after a comma they read as a parenthetical
// attached to the previous clause, and proofreaders disagree whether the result is an error (A0, 2026-11-23).

function lowerOpener(word: string): string {
  return word === 'I' ? word : word.charAt(0).toLowerCase() + word.slice(1);
}

function rules(): InsertionRule[] {
  const list: InsertionRule[] = [
    {id: 'article.a_an', skill: 'grammar.articles', severity: 'minor',
      pattern: /\b(an) ([aeiou]\w+)/gi, replace: m => `${keepCase(m[1], 'a')} ${m[2]}`},
    {id: 'article.missing_the', skill: 'grammar.articles', severity: 'moderate',
      // Not after and/or: "society and environment" can read as an acceptable coordinated pair.
      // No "future": "in future" is correct British English.
      pattern: /(?<!\b(?:and|or) )\b(the) (same|majority of|internet|environment|world|number of|rest of)\b(?!-)/gi,
      replace: m => keepCase(m[1], m[2])},
    {id: 'tense.participle', skill: 'grammar.verb_tenses', severity: 'moderate',
      pattern: new RegExp(`\\b(has|have|had) (${words(PAST_SIMPLE)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(PAST_SIMPLE)(m[2])}`},
    {id: 'tense.modal_ing', skill: 'grammar.verb_tenses', severity: 'moderate',
      pattern: new RegExp(`\\b(can|could|should|must|will|would|may|might) (${words(ING)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(ING)(m[2])}`},
    {id: 'agreement.third_person', skill: 'grammar.subject_verb_agreement', severity: 'moderate',
      pattern: new RegExp(`\\b(it|this|that|he|she|everyone|nobody|society) (${words(THIRD_PERSON)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(THIRD_PERSON)(m[2])}`},
    {id: 'agreement.plural_subject', skill: 'grammar.subject_verb_agreement', severity: 'moderate',
      pattern: new RegExp(`\\b(people|children|students|they|governments|companies|families|parents|workers|employees) (${words(PLURAL_VERB)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(PLURAL_VERB)(m[2])}`},
    {id: 'agreement.there_is', skill: 'grammar.subject_verb_agreement', severity: 'moderate',
      pattern: /\b(there) are (many|several|a number of|numerous|some|a few|two|three)\b/gi,
      replace: m => `${m[1]} is ${m[2]}`},
    {id: 'word_form.adjective_noun', skill: 'vocabulary.word_formation', severity: 'moderate',
      pattern: new RegExp(`\\b(is|are|was|were|be|become|becomes|been) (${words(NOUN_FOR_ADJ)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(NOUN_FOR_ADJ)(m[2])}`},
    {id: 'word_form.economic', skill: 'vocabulary.word_formation', severity: 'moderate',
      // Not "environmental": "environment protection" and similar compounds are accepted English.
      pattern: /\b(economic) (growth|development|benefits?|problems?|damage|issues?|impact|costs?)\b/gi,
      replace: m => `${keepCase(m[1], 'economy')} ${m[2]}`},
    {id: 'word_form.adverb', skill: 'vocabulary.word_formation', severity: 'minor',
      pattern: new RegExp(`\\b(${words(ADJ_FOR_ADV)})\\b`, 'gi'), replace: m => fromMap(ADJ_FOR_ADV)(m[1])},
    {id: 'word_form.verb_noun', skill: 'vocabulary.word_formation', severity: 'moderate',
      pattern: new RegExp(`\\b(the|a|this|their) (${words(VERB_FOR_NOUN)}) of\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(VERB_FOR_NOUN)(m[2])} of`},
    {id: 'spelling', skill: 'mechanics.spelling', severity: 'minor',
      pattern: new RegExp(`\\b(${words(MISSPELLINGS)})\\b`, 'gi'), replace: m => fromMap(MISSPELLINGS)(m[1])},
    {id: 'run_on.comma_splice', skill: 'grammar.sentence_structure', severity: 'moderate',
      pattern: new RegExp(`([a-z]{2,})\\. (${OPENERS})\\b`, 'g'), replace: m => `${m[1]}, ${lowerOpener(m[2])}`},
    {id: 'run_on.fused', skill: 'grammar.sentence_structure', severity: 'moderate',
      pattern: new RegExp(`([a-z]{2,})\\. (${OPENERS})\\b`, 'g'), replace: m => `${m[1]} ${lowerOpener(m[2])}`},
  ];
  list.push(
    {id: 'article.extra_the', skill: 'grammar.articles', severity: 'minor',
      pattern: /\b(in|of|for|on|to|about|with|into|through) (society|nature|education|technology|health|life|research|employment|history|politics)\b(?![-\w]| of)/gi,
      replace: m => `${m[1]} the ${m[2]}`},
    {id: 'article.missing_a', skill: 'grammar.articles', severity: 'moderate',
      pattern: /\b(is|was|as|provides|offers|creates|becomes|represents|remains) (a|an) ([a-z]+)\b/gi,
      replace: m => `${m[1]} ${m[3]}`},
    {id: 'tense.modal_past', skill: 'grammar.verb_tenses', severity: 'moderate',
      pattern: new RegExp(`\\b(can|could|should|must|will|would|may|might|cannot) (${words(PAST_FOR_BASE)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(PAST_FOR_BASE)(m[2])}`},
    {id: 'agreement.singular_noun', skill: 'grammar.subject_verb_agreement', severity: 'moderate',
      // Collective nouns take either verb form, so they are left alone.
      pattern: /\b(this|that|each|every|one) (?!(?:data|media|staff|police|majority|minority|number|government|team|public|family|class|committee|youth|population)\b)([a-z]+[^s\W]) (is|has|was|does)\b/gi,
      replace: m => `${m[1]} ${m[2]} ${({is: 'are', has: 'have', was: 'were', does: 'do'} as Record<string, string>)[m[3].toLowerCase()]}`},
    {id: 'agreement.plural_noun', skill: 'grammar.subject_verb_agreement', severity: 'moderate',
      pattern: /\b(many|most|some|these|those|such|all|other) ([a-z]+s) (are|have|were|do)\b/gi,
      replace: m => `${m[1]} ${m[2]} ${fromMap(PLURAL_VERB)(m[3])}`},
    {id: 'word_form.relational', skill: 'vocabulary.word_formation', severity: 'moderate',
      pattern: new RegExp(`\\b(${words(NOUN_FOR_RELATIONAL)}) (?!(?:and|or|but|to|in|of|as|is|are|was|were|than|for|will|can|could|should|may|might|must|would|has|have|had)\\b)([a-z]{3,})\\b`, 'gi'),
      replace: m => `${fromMap(NOUN_FOR_RELATIONAL)(m[1])} ${m[2]}`},
    {id: 'word_form.participle', skill: 'vocabulary.word_formation', severity: 'moderate',
      pattern: new RegExp(`\\b(is|are|was|were|feel|feels|felt|become|becomes|became|get|gets|seem|seems|very|more|less) (${words(PARTICIPLE_SWAP)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(PARTICIPLE_SWAP)(m[2])}`},
    {id: 'word_form.intensified', skill: 'vocabulary.word_formation', severity: 'moderate',
      pattern: new RegExp(`\\b(very|more|most|extremely|highly|less|so|too) (${words(NOUN_FOR_ADJ)})\\b`, 'gi'),
      replace: m => `${m[1]} ${fromMap(NOUN_FOR_ADJ)(m[2])}`},
  );
  PREPOSITIONS.forEach(([pattern, replace], i) =>
    list.push({id: `preposition.${i + 1}`, skill: 'grammar.prepositions', severity: 'minor', pattern, replace}));
  COLLOCATIONS.forEach(([pattern, replace], i) =>
    list.push({id: `collocation.${i + 1}`, skill: 'vocabulary.collocations', severity: 'moderate', pattern, replace}));

  return list;
}

export const insertionRules: readonly InsertionRule[] = rules();

/** The error family a rule belongs to (`preposition.3` → `preposition`); selection spreads errors across families. */
export function family(ruleId: string): string {
  return ruleId.split('.')[0];
}

/** Deterministic PRNG (mulberry32) seeded from a string, so a dataset rebuild gives the same insertions. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

export function candidates(text: string, ruleList: readonly InsertionRule[] = insertionRules): Candidate[] {
  const found: Candidate[] = [];
  for (const rule of ruleList) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
      const replacement = rule.replace(m);
      if (replacement !== m[0]) {
        found.push({rule, index: m.index, length: m[0].length, original: m[0], replacement});
      }
    }
  }

  return found;
}

export interface InsertOptions {
  /** Inclusive range of errors to insert. */
  min?: number;
  max?: number;
  /** At least this many error families (articles, tenses, agreement, …) per essay. */
  minFamilies?: number;
  /** Characters of untouched text between two insertions, so one finding cannot cover two errors. */
  gap?: number;
}

/**
 * Inserts errors into a clean essay. Throws when the essay offers too few distinct
 * candidates: such a base is replaced rather than given a thinner error set.
 */
export function insertErrors(text: string, seed: string, options: InsertOptions = {}): {text: string; errors: InsertedError[]} {
  const {min = 6, max = 10, minFamilies = 5, gap = 25} = options;
  const random = seededRandom(seed);
  const target = min + Math.floor(random() * (max - min + 1));

  const byFamily = new Map<string, Candidate[]>();
  for (const c of shuffle(candidates(text), random)) {
    const key = family(c.rule.id);
    byFamily.set(key, [...(byFamily.get(key) ?? []), c]);
  }
  const chosen: Candidate[] = [];
  const free = (c: Candidate) => chosen.every(o => c.index + c.length + gap <= o.index || o.index + o.length + gap <= c.index);
  // Round-robin over families in random order: every family gets a turn before any gets a second error.
  const families = shuffle([...byFamily.keys()].sort(), random);
  for (let progress = true; chosen.length < target && progress;) {
    progress = false;
    for (const key of families) {
      if (chosen.length >= target) break;
      const pool = byFamily.get(key)!;
      const pick = pool.findIndex(free);
      if (pick >= 0) {
        chosen.push(pool.splice(pick, 1)[0]);
        progress = true;
      }
    }
  }
  const familiesUsed = new Set(chosen.map(c => family(c.rule.id))).size;
  if (chosen.length < min || familiesUsed < minFamilies) {
    throw new Error(`only ${chosen.length} insertions in ${familiesUsed} families available (need ${min} in ${minFamilies})`);
  }

  chosen.sort((a, b) => a.index - b.index);
  let out = '';
  let cursor = 0;
  const errors: InsertedError[] = [];
  for (const c of chosen) {
    out += text.slice(cursor, c.index);
    const start = codePointLength(out);
    out += c.replacement;
    errors.push({start, end: start + codePointLength(c.replacement), skill: c.rule.skill, severity: c.rule.severity,
      rule: c.rule.id, original: c.original, inserted: c.replacement});
    cursor = c.index + c.length;
  }
  out += text.slice(cursor);

  return {text: out, errors};
}

/** Guard used by tests: every rule names a seed skill the assessor can report. */
export function unknownSkills(): string[] {
  return insertionRules.filter(r => !seedSkills.includes(r.skill)).map(r => r.id);
}
