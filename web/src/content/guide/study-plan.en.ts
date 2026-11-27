import type {Chapter} from './types';

// Facts: docs/phase-6/P6.1-ielts-facts.md (checked 2026-11-27). The plans are our advice, not official guidance.
const chapter: Chapter = {
  title: 'IELTS study plan: how to prepare in 4, 8 or 12 weeks',
  description: 'Find your starting level, set a target for each part, and follow a weekly plan for 4, 8 or 12 weeks of IELTS preparation — with extra focus on Writing.',
  lead: 'Good preparation is not about how many hours you spend; it is about spending them on what holds your score back. This chapter shows how to find your starting point, set realistic targets and organise your weeks.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'start',
      title: 'Step 1: find your starting point',
      blocks: [
        {p: 'Before you plan anything, take one honest measurement of each part under exam conditions:'},
        {ul: [
          '**Listening and Reading:** do one official sample test with a timer and count your correct answers out of 40. As a rough guide, about 23 correct answers correspond to band 6 and about 30 to band 7 (General Training Reading needs more — about 30 for band 6). See [how scores work](/guide/ielts-format).',
          '**Writing:** write Task 1 and Task 2 in 60 minutes, typed, without a dictionary. Get feedback on both — this is exactly what our full Writing test does.',
          '**Speaking:** record yourself answering a few Part 1 questions and speaking for two minutes on a Part 2 topic after one minute of preparation. Listen back: where do you stop, repeat or run out of words?',
        ]},
        {tip: 'Do not prepare for the diagnosis. Its job is to show where you are today, not to look good.'},
      ],
    },
    {
      id: 'targets',
      title: 'Step 2: set a target for each part',
      blocks: [
        {p: 'Check what your university, employer or immigration programme needs. Many ask for a minimum in each part as well as an overall band, and Writing is often the part that falls short. Then compare your diagnosis with the requirement:'},
        {table: {
          head: ['Gap to the target', 'What it usually means'],
          rows: [
            ['0–0.5 band', 'Mostly technique and timing: practise the test format until it feels routine.'],
            ['1 band', 'Technique plus targeted language work on your most frequent mistakes.'],
            ['1.5 bands or more', 'A language gap: you need general English practice as well as test practice. Plan more weeks, or plan to sit the test later.'],
          ],
        }},
        {note: 'These are rules of thumb from our experience, not official figures. Progress varies a lot between learners.'},
      ],
    },
    {
      id: 'week',
      title: 'Step 3: build a typical week',
      blocks: [
        {p: 'Whatever the length of your plan, a good week has the same shape: practice under test conditions, careful review, and work on your weak points. An example for about 8–10 hours a week:'},
        {table: {
          head: ['Day', 'Focus', 'Time'],
          rows: [
            ['Mon', 'Writing Task 2 (40 minutes, timed) + review the feedback', '1 h 15 min'],
            ['Tue', 'Reading: one section timed + check every wrong answer', '1 h'],
            ['Wed', 'Writing Task 1 (20 minutes) + rewrite the weakest paragraph', '1 h'],
            ['Thu', 'Listening: two parts + read the transcript of what you missed', '1 h'],
            ['Fri', 'Speaking: record Part 2 and Part 3 answers; vocabulary from the week', '1 h'],
            ['Sat', 'One full section under exam conditions (alternate Listening, Reading, Writing)', '1 h 30 min'],
            ['Sun', 'Review your mistake log; light reading or listening for pleasure', '1 h'],
          ],
        }},
        {p: 'Two things make the difference. First, **review takes as long as practice**: a task without review teaches you very little. Second, keep a **mistake log** — every error you repeat, with the correct version. Once a week, reread it.'},
      ],
    },
    {
      id: 'plans',
      title: 'Step 4: choose a plan length',
      blocks: [
        {p: '**4 weeks** — for learners close to their target who need technique and confidence:'},
        {ol: [
          'Week 1: diagnosis; learn the format of every part; first full Writing test with feedback.',
          'Week 2: daily timed practice of your weakest part; two Writing tasks with feedback, each followed by a rewrite.',
          'Week 3: mixed practice; one complete Listening–Reading–Writing run without breaks, as on the test day.',
          'Week 4: one more full run early in the week, then lighter practice; no new material in the last two days.',
        ]},
        {p: '**8 weeks** — the most common case, a gap of about one band:'},
        {ol: [
          'Weeks 1–2: diagnosis, format, and the basics of each Writing task: [Task 2](/guide/writing-task-2), [Academic Task 1](/guide/academic-task-1) or the [letter](/guide/general-training-letter).',
          'Weeks 3–5: targeted work on your three most frequent mistakes; two Writing tasks a week with feedback; vocabulary by topic.',
          'Weeks 6–7: full sections under exam conditions; a full Writing test each week; Speaking with recordings.',
          'Week 8: one full run of the written parts, a review of your mistake log, rest before the test.',
        ]},
        {p: '**12 weeks** — for a gap of 1.5 bands or more: spend the first four weeks mostly on general English (reading articles, listening to podcasts, writing short paragraphs with feedback, grammar practice on your weak points), then follow the 8-week plan.'},
      ],
    },
    {
      id: 'writing',
      title: 'Why Writing deserves extra time',
      blocks: [
        {ul: [
          'It is the part where candidates most often fall short of their target, and the one you cannot check yourself with an answer key.',
          'Task 2 counts twice as much as Task 1, so improving your essays moves your Writing band the most.',
          'Progress is visible: if you fix the same three mistakes in every essay, the improvement shows quickly.',
        ]},
        {p: 'A reliable routine: write a task under time, read the feedback, rewrite the sentences that were marked, and write the next task on a similar topic within a few days. Repeating the cycle on fresh tasks is what turns feedback into a higher band.'},
      ],
    },
    {
      id: 'mocks',
      title: 'Mock tests and the last week',
      blocks: [
        {ul: [
          'Use the official sample tests and, if a participating centre is near you, the free IELTS Trial Test for Listening, Reading and Writing.',
          'IELTS is taken on computer now: do at least some practice typed on screen, especially Writing.',
          'In the last week, do not start new material. Repeat formats you know, sleep well and check the test-day rules in the [test format chapter](/guide/ielts-format).',
        ]},
      ],
    },
  ],
  sources: [
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
    {label: 'Official sample test questions', href: 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions'},
    {label: 'IELTS Trial Test', href: 'https://ielts.org/take-a-test/preparation-resources/ielts-trial-test'},
    {label: 'IELTS preparation resources', href: 'https://ielts.org/take-a-test/preparation-resources'},
  ],
};

export default chapter;
