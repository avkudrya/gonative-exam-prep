import type {Chapter} from './types';

// Facts: docs/phase-6/P6.1-ielts-facts.md (checked 2026-11-27). Writing facts: docs/phase-0/D1-ielts-writing-spec.md.
const chapter: Chapter = {
  title: 'IELTS test format: Academic and General Training explained',
  description: 'What is in each part of IELTS, how long it takes, how the overall band is calculated and which version to choose — Academic or General Training.',
  lead: 'Before you plan your preparation, know exactly what you are preparing for. This chapter covers the two versions of IELTS, the four parts of the test, timing, how scores work and the ways you can take the test today.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'versions',
      title: 'Academic or General Training?',
      blocks: [
        {p: 'IELTS comes in two versions. They share two parts and differ in two, so choose before you start practising: the Reading texts and the first Writing task are not the same.'},
        {table: {
          head: ['', 'IELTS Academic', 'IELTS General Training'],
          rows: [
            ['Usually needed for', 'Undergraduate and postgraduate study; professional registration, for example for doctors and nurses', 'Moving to an English-speaking country (such as Australia, Canada, New Zealand or the UK); work, training or study below degree level'],
            ['Listening', 'Same in both versions', 'Same in both versions'],
            ['Speaking', 'Same in both versions', 'Same in both versions'],
            ['Reading', 'Three longer texts from books, journals, magazines, newspapers and online sources', 'Three sections of increasing difficulty: everyday texts, work-related texts, one longer text'],
            ['Writing Task 1', 'Describe a chart, table, diagram, process or map', 'Write a letter for a given situation'],
            ['Writing Task 2', 'An essay on an argument, problem or point of view', 'An essay on a topic of general interest'],
          ],
        }},
        {tip: 'The organisation you are applying to decides which version and which score you need. Check its requirements first; do not guess.'},
      ],
    },
    {
      id: 'parts',
      title: 'The four parts at a glance',
      blocks: [
        {table: {
          head: ['Part', 'Time', 'What you do'],
          rows: [
            ['Listening', 'About 30 minutes', '4 recordings, 40 questions; you hear each recording once'],
            ['Reading', '60 minutes', '3 sections, 40 questions'],
            ['Writing', '60 minutes', '2 tasks: Task 1 (at least 150 words) and Task 2 (at least 250 words)'],
            ['Speaking', '11–14 minutes', 'A three-part conversation with an examiner'],
          ],
        }},
        {p: 'Listening, Reading and Writing are taken in one session of about 2 hours 40 minutes, **with no breaks between the parts**. Speaking is a separate session with an examiner. Build your stamina for a long session: practise at least some full Listening–Reading–Writing runs without stopping.'},
      ],
    },
    {
      id: 'listening',
      title: 'Listening',
      blocks: [
        {p: 'There are four parts with ten questions each. You hear every recording only once, so you need to read the questions before the audio reaches them and keep up when you miss an answer.'},
        {p: 'Question types include multiple choice, matching, labelling a plan, map or diagram, completing a form, notes, a table or a flow chart, completing sentences and short answers. Each correct answer earns one mark.'},
        {tip: 'Missing one answer is normal. Let it go at once and listen for the next question; trying to recover it usually costs two more.'},
      ],
    },
    {
      id: 'reading',
      title: 'Reading',
      blocks: [
        {p: 'You get 60 minutes for three sections and 40 questions; there is no extra time for transferring answers. The texts are long — between about 2,150 and 2,750 words in total for Academic — so time management matters as much as understanding.'},
        {ul: [
          '**Academic:** texts on topics of general interest for students, taken from books, journals, magazines, newspapers and online sources. Question types include True / False / Not Given, Yes / No / Not Given, matching headings, matching sentence endings, summary and table completion, diagram labelling and short answers.',
          '**General Training:** three sections that get harder — everyday texts first, then work-related texts, then one longer text. The question types are similar, without Yes / No / Not Given.',
        ]},
        {p: 'Spelling and grammar count in your answers: a correct idea with a misspelt word loses the mark. Numbers can be written as figures or words.'},
      ],
    },
    {
      id: 'writing',
      title: 'Writing',
      blocks: [
        {p: 'Writing has two tasks in 60 minutes. The official advice is about 20 minutes for Task 1 and 40 for Task 2, and for a good reason: **Task 2 counts twice as much as Task 1** in your Writing score.'},
        {ul: [
          'Task 1 needs at least 150 words, Task 2 at least 250. Writing more is not penalised, but it takes time from the other task and from checking.',
          'A very short answer may not give the examiner enough evidence for the higher bands.',
          'Write connected text in full sentences: notes and bullet points are penalised, and so is writing that does not relate to the topic.',
          'Both tasks are marked on four criteria of equal weight: Task Achievement (Task 1) or Task Response (Task 2), Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy.',
        ]},
        {p: 'Writing is where most candidates can gain the most with focused practice. The next chapters cover [Task 2 essays](/guide/writing-task-2), [Academic Task 1](/guide/academic-task-1), [General Training letters](/guide/general-training-letter) and [the four criteria](/guide/writing-criteria) in detail.'},
      ],
    },
    {
      id: 'speaking',
      title: 'Speaking',
      blocks: [
        {p: 'Speaking is a recorded conversation with an examiner, face to face at a test centre (by video call in IELTS Online). It has three parts:'},
        {ol: [
          '**Part 1 (4–5 minutes):** questions about familiar topics.',
          '**Part 2 (3–4 minutes):** you get a task card and one minute to prepare, then speak for up to two minutes. At a test centre you are given a pencil and paper for notes.',
          '**Part 3 (4–5 minutes):** a deeper discussion connected with the Part 2 topic.',
        ]},
        {p: 'You are assessed on fluency and coherence, vocabulary, grammatical range and accuracy, and pronunciation — four criteria of equal weight.'},
      ],
    },
    {
      id: 'scores',
      title: 'How scores work',
      blocks: [
        {p: 'Each part gets a band from 0 to 9, in whole or half bands. Your **overall band** is the average of the four, rounded to the nearest half band. An average ending in .25 is rounded up to the next half band, and one ending in .75 up to the next whole band.'},
        {table: {
          head: ['Listening', 'Reading', 'Writing', 'Speaking', 'Average', 'Overall band'],
          rows: [
            ['6.5', '6.5', '5.0', '7.0', '6.25', '6.5'],
            ['4.0', '3.5', '4.0', '4.0', '3.875', '4.0'],
            ['6.5', '6.5', '5.5', '6.0', '6.125', '6.0'],
          ],
        }},
        {p: 'In Listening and Reading your mark out of 40 is converted to a band. The exact conversion varies slightly between test versions; as a rough guide, about 23 correct answers correspond to band 6 and about 30 to band 7 in Listening and Academic Reading. General Training Reading needs more correct answers for the same band: about 30 for band 6.'},
        {note: 'The examples and figures above come from the official scoring page. Your real result depends on the test version you take.'},
        {p: 'Many organisations need a minimum in each part as well as an overall band. A weak Writing score can hold you back even when the average is high — another reason to practise it seriously. Results are usually considered valid for two years.'},
      ],
    },
    {
      id: 'ways',
      title: 'Ways to take IELTS today',
      blocks: [
        {p: '**IELTS is moving fully to computer.** From mid-2026 the paper-based test is no longer offered; the timing of the change differs from country to country. What this means for you:'},
        {ul: [
          '**IELTS on computer at a test centre:** Listening, Reading and Writing on screen, Speaking face to face. Results are usually ready in 1–5 days.',
          '**Writing on Paper:** in some countries you take the test on computer but write the Writing part by hand. The tasks, timing and marking are the same.',
          '**IELTS Online:** Academic only, from home, for test takers aged 18 and over, with Speaking by video call. It is not accepted for immigration or professional registration.',
          '**IELTS for UK visas (UKVI):** taken at an official test centre, fully on computer.',
        ]},
        {p: 'If you took the full test on computer, in many centres you can retake one part — Listening, Reading, Writing or Speaking — within 60 days instead of the whole test (One Skill Retake).'},
        {tip: 'Since the test is on computer, practise typing your answers. Typing an essay under time pressure is a skill of its own; our full Writing test runs both tasks on one 60-minute timer for exactly this reason.'},
      ],
    },
    {
      id: 'test-day',
      title: 'On the test day',
      blocks: [
        {ul: [
          'Bring **the same identity document** you used to book the test — without it you will not be allowed to take the test.',
          'Personal belongings stay outside the room; phones and other devices are switched off. Watches are not allowed — there is a clock in the room.',
          'No food in the room; water is allowed in a clear bottle.',
          'Leave home early, and go to the toilet before you enter: the written session has no breaks.',
        ]},
        {p: 'The full list of rules is in the terms you accept when you book. Read it in advance rather than on the day.'},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Academic test format', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test'},
    {label: 'IELTS General Training test format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test'},
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
    {label: 'Ways to take IELTS', href: 'https://ielts.org/take-a-test/why-choose-ielts/ways-to-take-ielts'},
    {label: 'Updates to IELTS test delivery', href: 'https://ielts.org/news-and-insights/updates-to-ielts-test-delivery'},
    {label: 'One Skill Retake', href: 'https://ielts.org/take-a-test/booking-your-test/one-skill-retake'},
    {label: 'What to expect on test day', href: 'https://ielts.org/take-a-test/preparation-resources/on-test-day'},
  ],
};

export default chapter;
