import type {Chapter} from './types';

// Facts: docs/phase-6/P6.1-ielts-facts.md §2 (checked 2026-11-27). Strategies are our advice.
const chapter: Chapter = {
  title: 'IELTS Listening: format and strategies',
  description: 'IELTS Listening explained — four parts, 40 questions, each recording heard once — with strategies for reading ahead, spelling, numbers, maps and multiple choice.',
  lead: 'Listening is the same in Academic and General Training: four recordings, forty questions, about thirty minutes, and you hear each recording only once. Success depends on reading ahead and staying with the audio even when you miss an answer.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'format',
      title: 'The format',
      blocks: [
        {ul: [
          'Four parts with ten questions each; one mark for each correct answer.',
          'The first two parts are set in everyday social situations; the last two in education and training contexts, the fourth being a talk on an academic subject.',
          'Question types: multiple choice, matching, labelling a plan, map or diagram, completing a form, notes, a table or a flow chart, completing sentences, and short answers.',
          'On computer you type your answers on screen as you listen.',
        ]},
      ],
    },
    {
      id: 'ahead',
      title: 'Read ahead',
      blocks: [
        {p: 'Whenever you have a moment before a part starts, read its questions and decide what you are listening for:'},
        {ul: [
          'the type of answer — a name, a number, a date, a noun, a plural;',
          'the key words, and how they might be paraphrased in the recording;',
          'for maps and diagrams: the orientation, and where the speaker will probably start.',
        ]},
        {tip: 'The recording rarely uses the exact words of the question. If the question says "cost", listen for "price", "fee" or "pay".'},
      ],
    },
    {
      id: 'during',
      title: 'While you listen',
      blocks: [
        {ul: [
          'Answers come in the order of the questions. If you hear the answer to question 5, question 4 has passed — let it go.',
          'Speakers often correct themselves ("on Tuesday — sorry, Wednesday"). Wait for the final version.',
          'In multiple choice, several options are usually mentioned; only one matches exactly what is asked.',
          'Write numbers as figures; check units and currency.',
        ]},
      ],
    },
    {
      id: 'answers',
      title: 'Spelling and word limits',
      blocks: [
        {p: 'Answers must be spelled correctly and must keep to the word limit in the instruction. Names in Part 1 are often spelled out letter by letter — practise the English alphabet and numbers until they are automatic, especially letters that are easy to confuse.'},
      ],
    },
    {
      id: 'practice',
      title: 'How to practise',
      blocks: [
        {ol: [
          'Do one part at a time under test conditions: one listening, no pauses.',
          'Check your answers, then listen again with the transcript and find exactly where you lost each mark.',
          'Train with everyday English audio between tests: podcasts, lectures and interviews in different accents.',
          'Build up to full tests of four parts without stopping.',
        ]},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Academic Listening format', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-listening'},
    {label: 'IELTS General Training Listening format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-listening'},
    {label: 'Official sample test questions', href: 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions'},
  ],
};

export default chapter;
