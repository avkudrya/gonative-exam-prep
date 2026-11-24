// A synthetic essay and its feedback, shaped like the Exams API (ExamPresenter). Our own text, no user data.
export const ESSAY = [
  'Nowadays many city centres is full of cars, and some people think they should be banned completely.',
  'In this essay I will discuss both views and give my own opinion.',
  '',
  'On the one hand, cars make the air dirty and the streets dangerous. For example, in my city the children can not walk to school alone because of the traffic. Banning cars would make centres more pleasant for people who walk or ride a bicycle.',
  '',
  'On the other hand, many people depend on there cars, especially older people and those who live far from public transport. Shops in the centre may also lose customers.',
  '',
  'In conclusion, I believe cars should be limited but not banned completely, because a ban would be unfair for some groups.',
].join('\n');

const at = (quote, from = 0) => {
  const start = ESSAY.indexOf(quote, from);
  if (start < 0) throw new Error(`quote not in essay: ${quote}`);
  return {start, end: start + quote.length};
};

export const FINDINGS = [
  // The same error was also reported under Vocabulary; the backend shows it once (also_criteria).
  {id: 'f1', kind: 'error', skill: 'grammar.subject_verb_agreement', criterion_key: 'grammatical_range_accuracy', also_criteria: ['lexical_resource'], severity: 'moderate', quote: 'city centres is', suggestion: 'city centres are', explanation: 'The subject “city centres” is plural, so the verb must be “are”.'},
  {id: 'f2', kind: 'error', skill: 'vocabulary.word_choice', criterion_key: 'lexical_resource', severity: 'major', quote: 'there cars', suggestion: 'their cars', explanation: '“There” is a place word; the possessive is “their”.'},
  {id: 'f3', kind: 'error', skill: 'mechanics.spelling', criterion_key: 'grammatical_range_accuracy', severity: 'minor', quote: 'can not', suggestion: 'cannot', explanation: '“Cannot” is normally written as one word.'},
  {id: 'f4', kind: 'weakness', skill: 'task.idea_development', criterion_key: 'task_response', severity: 'moderate', quote: 'Shops in the centre may also lose customers.', explanation: 'This idea is stated but not explained or supported with an example.'},
  {id: 'f5', kind: 'weakness', skill: 'grammar.articles', criterion_key: 'grammatical_range_accuracy', severity: 'minor', quote: 'the children', suggestion: 'children', explanation: 'Children in general take no article.'},
  {id: 'f6', kind: 'strength', skill: 'coherence.cohesive_devices', criterion_key: 'coherence_cohesion', severity: 'minor', quote: 'On the one hand,', explanation: 'Clear signposting guides the reader through both views.'},
  {id: 'f7', kind: 'weakness', skill: 'vocabulary.range', criterion_key: 'lexical_resource', severity: 'minor', explanation: 'Vocabulary is mostly simple and some words repeat (“cars”, “centre”).'},
  // One repeated mistake in two places (a shared pattern): one card listing both places.
  {id: 'f8', kind: 'error', skill: 'vocabulary.collocations', criterion_key: 'lexical_resource', pattern: 'p-f8', severity: 'minor', quote: 'banned completely', suggestion: 'banned outright', explanation: '“Banned outright” is the natural collocation.'},
  {id: 'f9', kind: 'error', skill: 'vocabulary.collocations', criterion_key: 'lexical_resource', pattern: 'p-f8', severity: 'minor', quote: 'banned completely', suggestion: 'banned outright', explanation: '“Banned outright” is the natural collocation.', second: true},
].map(({second, ...f}) => (f.quote ? {...f, span: at(f.quote, second ? at(f.quote).end : 0)} : f));

const range = (low, high) => ({precision: 'approximate', low, high});
export const RESULT = {
  status: 'complete', calibration: 'uncalibrated', word_count: 168,
  criteria: [
    {criterion_key: 'task_response', estimate: range(5.5, 6.5), confidence: 'medium', summary: 'Both views are presented and the opinion is clear, but the second view is underdeveloped.', finding_ids: ['f4']},
    {criterion_key: 'coherence_cohesion', estimate: range(6, 7), confidence: 'medium', summary: 'Well organised paragraphs with clear linking between the main parts.', finding_ids: ['f6']},
    {criterion_key: 'lexical_resource', estimate: range(5, 6), confidence: 'medium', summary: 'Adequate vocabulary for the task, with a few word choice errors and repetition.', finding_ids: ['f1', 'f2', 'f7', 'f8', 'f9']},
    {criterion_key: 'grammatical_range_accuracy', estimate: range(5, 6), confidence: 'low', summary: 'Mostly simple sentences; agreement and article errors are noticeable.', finding_ids: ['f1', 'f3', 'f5']},
  ],
  findings: FINDINGS,
  top_fixes: ['f2', 'f1', 'f4', 'f3'],
};
