import type {Chapter} from './types';

// Examples are our own sentences. The mistake classes are those our benchmark sets insert and our feedback reports most
// often; the "not a mistake" list matches the round 5 precision rules (exam-p1-7, docs/phase-5/P5.13-precision-round.md).
const chapter: Chapter = {
  title: 'Common IELTS Writing mistakes and how to fix them',
  description: 'The grammar and vocabulary mistakes that cost IELTS Writing candidates the most — articles, agreement, verb forms, collocations, sentence boundaries — with corrections, plus constructions that are not mistakes.',
  lead: 'Most candidates do not make many different mistakes; they make the same few again and again. Find yours, learn the correct pattern and check for it in every task — this is one of the fastest ways to raise Lexical Resource and Grammatical Range and Accuracy.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'grammar',
      title: 'Grammar mistakes',
      blocks: [
        {table: {
          head: ['Mistake', 'Wrong', 'Right'],
          rows: [
            ['Subject–verb agreement', 'Many city centres **is** full of cars.', 'Many city centres **are** full of cars.'],
            ['Articles', 'Government should invest in **the** public transport.', '**The** government should invest in public transport.'],
            ['Countable and uncountable', 'Students need **an advice** and **many informations**.', 'Students need **advice** and **a lot of information**.'],
            ['Verb form after a modal', 'People should **to use** buses.', 'People should **use** buses.'],
            ['Tense in Task 1', 'In 2005 car use **reaches** its peak.', 'In 2005 car use **reached** its peak.'],
            ['Sentence boundaries', 'Cars are expensive, many people cannot afford them.', 'Cars are expensive, **so** many people cannot afford them. / Cars are expensive**;** many people…'],
            ['Word order in indirect questions', 'I wonder **why do people** prefer cars.', 'I wonder **why people prefer** cars.'],
          ],
        }},
      ],
    },
    {
      id: 'vocabulary',
      title: 'Vocabulary mistakes',
      blocks: [
        {table: {
          head: ['Mistake', 'Wrong', 'Right'],
          rows: [
            ['Collocation', '**do** a mistake, **make** research', '**make** a mistake, **do** research'],
            ['Word form', '**economical** growth, a **succeed** plan', '**economic** growth, a **successful** plan'],
            ['Wrong word', 'The number of cars **raised**.', 'The number of cars **rose**.'],
            ['Register', 'Loads of people think this is a bad idea. (in an essay)', 'Many people believe this is a poor idea.'],
            ['Repetition', 'Traffic is a problem. Traffic causes pollution. Traffic…', 'Traffic is a problem. **It** causes pollution, and **congestion**…'],
          ],
        }},
      ],
    },
    {
      id: 'linking',
      title: 'Linking and organisation',
      blocks: [
        {ul: [
          '**Linker with the wrong logic:** "Buses are cheap. **However**, they are convenient." — both sentences are positive; use "**Moreover**" or just "They are also convenient."',
          '**Mechanical linking:** starting every sentence with "Firstly", "Secondly", "Moreover", "Furthermore". Vary it, and let some sentences connect through their content.',
          '**Unclear reference:** "This shows that it is important." — what is "this" and what is "it"? Name it: "This rise in car use shows…"',
          '**One-sentence paragraphs** in Task 2, or one huge paragraph with no breaks.',
        ]},
      ],
    },
    {
      id: 'not-mistakes',
      title: 'Things that are not mistakes',
      blocks: [
        {p: 'Some learners lose time "correcting" English that was fine. Standard English accepts all of these:'},
        {ul: [
          '"I **recommend you to** book early" and "I recommend **booking** early" — both are used.',
          '"They **spend** a lot of time **on** studying" and "spend a lot of time studying".',
          '"I **am working** during the day" for a current, temporary situation.',
          '"Tell me when the course **will** start" — in a reported question, will is correct; it is time clauses ("when the course starts, I will…") that take the present.',
          '"How many students **are** in the class?" — a question about the subject needs no inversion.',
          'Simple linkers such as but, so and also, used correctly.',
          'In a personal letter: "I", contractions and phrasal verbs.',
        ]},
        {p: 'When a construction is accepted, a different one is not automatically "better". Spend your effort on real errors first.'},
      ],
    },
    {
      id: 'method',
      title: 'How to get rid of your own mistakes',
      blocks: [
        {ol: [
          'After each piece of feedback, write down every mistake with its correction in a mistake log.',
          'Group them: which three types come back most often? Those are your priorities.',
          'Rewrite the marked sentences yourself before looking at the correction again — active fixing sticks better than reading.',
          'In the last 3–5 minutes of every task, check specifically for your three types.',
          'After a few tasks, check the log: the types that disappeared can come off the list.',
        ]},
        {tip: 'Our feedback marks each mistake in your text, and "Fix it yourself" checks your rewritten sentence straight away; your progress page shows which mistakes are becoming rarer.'},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Writing band descriptors (official PDF)', href: 'https://ielts.org/cdn/ielts-downloadable-assets/ielts-guidance-and-support/ielts-guides/ielts-writing-band-descriptors.pdf'},
    {label: 'Writing test preparation resources', href: 'https://ielts.org/take-a-test/preparation-resources/writing-test-resources'},
  ],
};

export default chapter;
