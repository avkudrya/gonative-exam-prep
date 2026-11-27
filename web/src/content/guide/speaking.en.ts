import type {Chapter} from './types';

// Facts: docs/phase-6/P6.1-ielts-facts.md §5 (checked 2026-11-27). Strategies are our advice.
const chapter: Chapter = {
  title: 'IELTS Speaking: the three parts and how to prepare',
  description: 'How the IELTS Speaking test works — three parts in 11–14 minutes with an examiner — what is assessed, and how to prepare for fluent, developed answers without memorising.',
  lead: 'Speaking is a conversation with an examiner in three parts, 11 to 14 minutes in total. It is recorded and assessed on four equal criteria. You cannot prepare the answers, but you can prepare how you answer.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'parts',
      title: 'The three parts',
      blocks: [
        {table: {
          head: ['Part', 'Length', 'What happens', 'How to answer'],
          rows: [
            ['1', '4–5 minutes', 'Questions about familiar topics: home, work or study, everyday life', 'Two or three sentences: answer, then add a reason or an example'],
            ['2', '3–4 minutes', 'A task card; one minute to prepare, then speak for up to two minutes', 'Use the whole two minutes; follow the points on the card'],
            ['3', '4–5 minutes', 'A discussion of broader questions connected with the Part 2 topic', 'Give opinions, compare, speculate; develop each answer'],
          ],
        }},
        {p: 'At a test centre the conversation is face to face, and you get a pencil and paper for Part 2 notes. In IELTS Online it takes place by video call.'},
      ],
    },
    {
      id: 'criteria',
      title: 'What is assessed',
      blocks: [
        {ul: [
          '**Fluency and Coherence:** speaking at length without long pauses, with ideas that connect.',
          '**Lexical Resource:** range and precision of vocabulary, and the ability to paraphrase when you lack a word.',
          '**Grammatical Range and Accuracy:** a mix of structures, used correctly.',
          '**Pronunciation:** how easy you are to understand — clear sounds, word stress and intonation, not a "native" accent.',
        ]},
      ],
    },
    {
      id: 'part2',
      title: 'Part 2: using the minute and the two minutes',
      blocks: [
        {ol: [
          'In the minute: write 4–6 key words, one for each point on the card plus one example or story. Not sentences.',
          'Start straight away with the main point; do not repeat the card.',
          'Tell it as a small story: when, where, what happened, how you felt, why it matters.',
          'If you finish early, add detail to the last point. The examiner will stop you when the time is up.',
        ]},
      ],
    },
    {
      id: 'tips',
      title: 'Habits that help',
      blocks: [
        {ul: [
          '**Develop, do not just answer:** "Yes, I do" is a dead end; "Yes, mostly at weekends, because…" gives the examiner something to assess.',
          '**Do not memorise answers.** Recited answers sound unnatural and often do not fit the exact question.',
          '**Fill thinking time naturally:** "That\'s an interesting question — I suppose…" is better than silence.',
          '**Paraphrase when a word is missing:** "the thing you use to…" keeps you fluent.',
          '**Ask for a repeat if needed:** "Could you repeat the question, please?" is acceptable.',
        ]},
      ],
    },
    {
      id: 'practice',
      title: 'How to practise',
      blocks: [
        {ol: [
          'Record yourself answering Part 1 questions and a Part 2 card with a timer.',
          'Listen back for long pauses, repeated words and mistakes you make every time.',
          'Practise Part 3 by discussing topic questions with a partner or aloud on your own, always giving reasons and examples.',
          'Use the vocabulary from your Writing topics: the themes overlap with Part 3.',
        ]},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Academic Speaking format', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking'},
    {label: 'IELTS General Training Speaking format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-speaking'},
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
  ],
};

export default chapter;
