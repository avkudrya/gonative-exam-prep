import type {Chapter} from './types';

// Facts: docs/phase-6/P6.1-ielts-facts.md §3 (checked 2026-11-27). Strategies are our advice.
const chapter: Chapter = {
  title: 'IELTS Reading: question types and strategies',
  description: 'How IELTS Academic and General Training Reading work — 3 sections, 40 questions, 60 minutes — and strategies for True/False/Not Given, matching headings, completion tasks and timing.',
  lead: 'Reading gives you 60 minutes for 40 questions and long texts, with no extra time to transfer answers. Most candidates who lose marks do not lack understanding — they run out of time or misread what a question asks.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'format',
      title: 'The format',
      blocks: [
        {table: {
          head: ['', 'Academic', 'General Training'],
          rows: [
            ['Sections', '3 longer texts, about 2,150–2,750 words in total', '3 sections of increasing difficulty, about 2,150–2,375 words'],
            ['Texts', 'Books, journals, magazines, newspapers, online sources; topics of general interest for students', 'Everyday texts, work-related texts, then one longer text'],
            ['Questions and time', '40 questions, 60 minutes, transfer included', '40 questions, 60 minutes, transfer included'],
          ],
        }},
        {p: 'Each correct answer is worth one mark. Spelling and grammar count in your answers; numbers can be written as figures or words; a hyphenated word counts as one word. General Training needs more correct answers than Academic for the same band (see [how scores work](/guide/ielts-format)).'},
      ],
    },
    {
      id: 'tfng',
      title: 'True / False / Not Given and Yes / No / Not Given',
      blocks: [
        {p: 'True / False / Not Given asks about **information** in the text; Yes / No / Not Given (Academic only) asks about the **writer\'s views or claims**. The logic is the same:'},
        {ul: [
          '**True / Yes:** the text says the same thing, usually in different words.',
          '**False / No:** the text says the opposite.',
          '**Not Given:** the text does not say — you cannot confirm or contradict it from the text alone.',
        ]},
        {tip: 'Judge only by the text, never by what you know about the topic. Watch qualifiers: "some", "most", "always", "may" often decide between False and Not Given.'},
      ],
    },
    {
      id: 'headings',
      title: 'Matching headings and matching information',
      blocks: [
        {ul: [
          '**Headings:** a heading sums up the main idea of the whole paragraph, not one detail in it. Read the first and last sentences first, then check the middle.',
          '**Matching information:** you look for a specific detail in "which paragraph contains…". The answer can be anywhere in a paragraph, and some paragraphs may be used more than once.',
          'Cross out options as you use them, but be ready to reconsider if an early choice blocks a later one.',
        ]},
      ],
    },
    {
      id: 'completion',
      title: 'Completion and short answers',
      blocks: [
        {ul: [
          'Read the word limit in the instruction and keep to it: an answer over the limit is wrong.',
          'Predict the type of word (a number, a noun, a plural) before you search.',
          'Copy the words from the text exactly; check spelling and singular or plural.',
          'In summaries the questions usually follow the order of the text — use that to locate the next answer.',
        ]},
      ],
    },
    {
      id: 'time',
      title: 'Managing 60 minutes',
      blocks: [
        {table: {
          head: ['Section', 'Suggested time'],
          rows: [
            ['1', 'about 17 minutes'],
            ['2', 'about 20 minutes'],
            ['3 (hardest)', 'about 23 minutes'],
          ],
        }},
        {ul: [
          'Skim the text in 2–3 minutes for its structure, then read the questions and scan for the answers.',
          'Do not stay on one question: move on and come back if time remains.',
          'Do not leave answers blank: marks are given for correct answers, so a reasoned guess costs you nothing.',
        ]},
        {note: 'The time split is our suggestion, not an official rule.'},
      ],
    },
    {
      id: 'practice',
      title: 'How to practise',
      blocks: [
        {ol: [
          'Do one section at a time with a timer.',
          'Check every wrong answer and find the exact words in the text that give the right one. Note why you missed it: vocabulary, a qualifier, timing.',
          'Read widely between tests — articles on science, society and work — to build speed and vocabulary.',
        ]},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Academic Reading format', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-reading'},
    {label: 'IELTS General Training Reading format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-reading'},
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
    {label: 'Official sample test questions', href: 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions'},
  ],
};

export default chapter;
