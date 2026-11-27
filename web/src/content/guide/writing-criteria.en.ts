import type {Chapter} from './types';

// In our own words (no descriptor text: docs/phase-0/D1-ielts-writing-spec.md, «Правовой момент»). Limiters: D1 table.
const chapter: Chapter = {
  title: 'IELTS Writing assessment criteria explained',
  description: 'The four IELTS Writing criteria in plain words — Task Achievement or Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy — and what keeps a band down.',
  lead: 'Both Writing tasks are marked on four criteria of equal weight; the task score is their average, and Task 2 counts twice as much as Task 1. Knowing what each criterion looks at tells you where your effort pays off.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'overview',
      title: 'The four criteria at a glance',
      blocks: [
        {table: {
          head: ['Criterion', 'The question it answers'],
          rows: [
            ['Task Achievement (Task 1) / Task Response (Task 2)', 'Did you do what the task asked, fully and with relevant, developed content?'],
            ['Coherence and Cohesion', 'Can the reader follow your text from start to finish?'],
            ['Lexical Resource', 'How wide and how precise is your vocabulary?'],
            ['Grammatical Range and Accuracy', 'How varied and how correct are your sentences?'],
          ],
        }},
        {p: 'The official band descriptors describe each criterion band by band. Below is what they mean in practice, in our own words.'},
      ],
    },
    {
      id: 'task',
      title: 'Task Achievement and Task Response',
      blocks: [
        {p: '**Task 2:** answer every part of the question, take a position where the question asks for one and keep it consistent, and develop your main ideas with explanation and examples. Ideas that are listed but not extended stay in the middle bands.'},
        {p: '**Academic Task 1:** a clear [overview](/guide/academic-task-1) of the main trends, well-chosen key features and accurate figures. **General Training Task 1:** all three points covered and developed, with a tone that suits the reader.'},
        {p: 'What keeps this criterion low:'},
        {ul: [
          'leaving out a main part of the question (for "discuss both views", discussing only one) — the score stays around band 5;',
          'in a letter, a missing point or a tone that does not suit the reader — around band 4;',
          'an inappropriate format, such as notes, a list, or a letter written as an essay — around band 4;',
          'writing that is unrelated to the task — the lowest bands.',
        ]},
      ],
    },
    {
      id: 'coherence',
      title: 'Coherence and Cohesion',
      blocks: [
        {p: 'This criterion looks at how your ideas progress, how you use paragraphs and how sentences connect: linking words, pronouns, and words that refer back ("this problem", "such measures").'},
        {ul: [
          'One clear purpose per paragraph. In Task 2, inadequate or missing paragraphing holds the score at around band 5.',
          'Linking words should show real logic. "However" between two sentences that agree is an error; starting every sentence with "Moreover" is mechanical.',
          'Simple linkers used correctly are fine — you are not scored on how unusual they are.',
          'Reference must be clear: the reader should always know what "it" or "this" refers to.',
        ]},
      ],
    },
    {
      id: 'lexical',
      title: 'Lexical Resource',
      blocks: [
        {p: 'Range and precision of vocabulary: the right word in the right combination, correct word forms and spelling, and a style that suits the task.'},
        {ul: [
          'Precise, natural collocations ("heavy traffic", "a significant increase") show range better than rare words used slightly wrongly.',
          'You do not need idioms. In the descriptors, "idiomatic" means natural word use, which precise academic wording already shows.',
          'Repeating the same word in every sentence limits the score; paraphrasing the task wording shows flexibility.',
          'Spelling and word-form mistakes count here ("economical growth" instead of "economic growth").',
        ]},
      ],
    },
    {
      id: 'grammar',
      title: 'Grammatical Range and Accuracy',
      blocks: [
        {p: 'Two things together: a mix of sentence structures, and how many of your sentences are free of errors.'},
        {ul: [
          'If almost all your sentences are simple and subordinate clauses are rare, the score stays around band 4 however correct they are.',
          'Complex sentences full of errors do not help either. Aim for variety you can control: relative clauses, conditionals, passives, and clauses with because, although or when.',
          'Frequent small errors add up: articles, agreement, verb forms, prepositions, punctuation between sentences.',
          'A very short response may not give enough evidence of sentence control.',
        ]},
      ],
    },
    {
      id: 'scores',
      title: 'How the criteria become a score',
      blocks: [
        {p: 'Each criterion gets a band; the task score is their average, and Task 2 counts twice as much as Task 1 in the Writing band. This is why a weak criterion matters: one criterion at 5 pulls a task with three criteria at 7 down noticeably.'},
        {tip: 'Find your weakest criterion and work on it first. Our feedback shows a range for each criterion, and your progress page shows which criterion holds you back across essays.'},
        {note: 'Our ranges are approximate practice estimates, not official scores. Only an official IELTS test gives you an official result.'},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Writing band descriptors (official PDF)', href: 'https://ielts.org/cdn/ielts-downloadable-assets/ielts-guidance-and-support/ielts-guides/ielts-writing-band-descriptors.pdf'},
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
    {label: 'Writing test preparation resources', href: 'https://ielts.org/take-a-test/preparation-resources/writing-test-resources'},
  ],
};

export default chapter;
