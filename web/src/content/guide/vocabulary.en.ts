import type {Chapter} from './types';

// Our advice; facts (spelling counts in Reading answers) from docs/phase-6/P6.1-ielts-facts.md.
const chapter: Chapter = {
  title: 'IELTS vocabulary: how to learn words that raise your score',
  description: 'How to build IELTS vocabulary that works in Writing and Speaking: collocations, topic words, paraphrasing, word forms and spelling — and why rare words and idioms are not the goal.',
  lead: 'Vocabulary matters in every part of IELTS: you need it to understand Reading and Listening, and it is a quarter of your score in Writing and Speaking. But the goal is not to know the most unusual words; it is to use the right word, in the right combination, correctly.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'what',
      title: 'What "good vocabulary" means in IELTS',
      blocks: [
        {ul: [
          '**Precision:** the word that says exactly what you mean ("a slight fall", not "a small change down").',
          '**Collocation:** words that naturally go together ("make a decision", "a heavy burden", "raise awareness").',
          '**Flexibility:** saying the same idea in different ways, so you do not repeat the task wording or your own words.',
          '**Accuracy:** correct word forms and spelling.',
        ]},
        {p: 'Rare words used slightly wrongly cost more than simple words used precisely. You do not need idioms: in the assessment criteria, "idiomatic" means natural word use, not sayings like "a piece of cake".'},
      ],
    },
    {
      id: 'collocations',
      title: 'Learn words in combinations',
      blocks: [
        {p: 'Never learn a word on its own. When you meet a useful word, write down the phrase it came in and one more example:'},
        {table: {
          head: ['Instead of learning…', 'Learn'],
          rows: [
            ['impact', 'have a significant impact **on** something; the environmental impact **of** tourism'],
            ['demand', 'a growing demand **for** housing; meet the demand'],
            ['issue', 'address an issue; a pressing issue'],
            ['access', 'have access **to** healthcare; improve access'],
          ],
        }},
        {p: 'Prepositions are part of the combination: most collocation mistakes in essays are the wrong preposition, not the wrong noun.'},
      ],
    },
    {
      id: 'topics',
      title: 'Topic vocabulary',
      blocks: [
        {p: 'Task 2 and Speaking Part 3 return to a set of familiar topics: education, work, technology, environment, health, cities and transport, crime, media, family, globalisation. For each topic, build a small set of words you can actually use:'},
        {ul: [
          '10–15 key nouns and verbs with their collocations;',
          '3–4 ways to express cause and effect in that topic ("leads to", "is largely due to");',
          'one or two concrete examples you could use in an essay.',
        ]},
        {tip: 'Learn topic words by writing: a short paragraph on the topic uses the new words in context and shows you which ones you cannot use yet.'},
      ],
    },
    {
      id: 'paraphrase',
      title: 'Paraphrasing',
      blocks: [
        {p: 'Paraphrasing helps in two places. In Writing, copied task wording does not count towards your word total and shows little range. In Reading and Listening, the answer is usually phrased differently from the question.'},
        {table: {
          head: ['Technique', 'Example'],
          rows: [
            ['Synonym', 'people who live in cities → urban residents'],
            ['Different word form', 'the population grew rapidly → there was rapid population growth'],
            ['Different structure', 'many people believe that… → it is widely believed that…'],
          ],
        }},
        {p: 'Check that the paraphrase keeps the meaning: "most people" is not "all people", and "some experts claim" is not "it is proven".'},
      ],
    },
    {
      id: 'accuracy',
      title: 'Word forms and spelling',
      blocks: [
        {ul: [
          'Learn the family of a word together: economy, economic, economical, economist — they are not interchangeable.',
          'Spelling counts: in Reading answers a misspelt word loses the mark, and frequent spelling errors lower your Writing score.',
          'Keep a list of words you misspell and test yourself on them weekly.',
        ]},
      ],
    },
    {
      id: 'routine',
      title: 'A routine that works',
      blocks: [
        {ol: [
          'Collect: from your reading, listening and the feedback on your essays.',
          'Record: the phrase, a translation if it helps, and one example sentence of your own.',
          'Review with spaced repetition — short sessions most days beat a long session once a week.',
          'Use: put new words into your next essay or Speaking practice on purpose.',
        ]},
        {p: 'Our feedback picks useful vocabulary from your corrections, and you can turn it into word lists to study in GoNative.'},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Writing band descriptors (official PDF)', href: 'https://ielts.org/cdn/ielts-downloadable-assets/ielts-guidance-and-support/ielts-guides/ielts-writing-band-descriptors.pdf'},
    {label: 'IELTS General Training Reading format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-reading'},
  ],
};

export default chapter;
