import type {Chapter} from './types';

// Facts: docs/phase-0/D1-ielts-writing-spec.md and docs/phase-6/P6.1-ielts-facts.md. The advice matches how our feedback
// judges Task 2 (exam-p1-7: position only when asked, the exact proposition, accepted variants are not errors).
const chapter: Chapter = {
  title: 'IELTS Writing Task 2: how to write a high-scoring essay',
  description: 'Question types, a 5-minute plan, a clear position, paragraphs that develop ideas, and timing for IELTS Writing Task 2 — with examples on our own sample essay.',
  lead: 'Task 2 counts twice as much as Task 1 in your Writing score, so it deserves most of your practice. This chapter explains what the task asks for, how to plan in five minutes and how to build paragraphs that an examiner can follow.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'task',
      title: 'What the task asks for',
      blocks: [
        {p: 'You write an essay of **at least 250 words** in about **40 minutes**, responding to a point of view, an argument or a problem. You must write connected text in full sentences: notes and bullet points are penalised, and so is writing that does not relate to the topic. Writing more than 250 words is not penalised, but a very long essay leaves no time to check it.'},
        {p: 'Your essay is assessed on four criteria of equal weight: Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. The [criteria chapter](/guide/writing-criteria) explains each one.'},
      ],
    },
    {
      id: 'types',
      title: 'Read the question exactly',
      blocks: [
        {p: 'Most Task 2 questions fall into a few types. Each asks for something different, and answering a different question is the most expensive mistake in Task 2.'},
        {table: {
          head: ['Type', 'Typical wording', 'What you must do'],
          rows: [
            ['Opinion', 'To what extent do you agree or disagree?', 'Give your position clearly and keep it the same from the introduction to the conclusion.'],
            ['Discussion', 'Discuss both views and give your own opinion.', 'Develop **both** views, then state your own. Covering only one side limits your Task Response score.'],
            ['Advantages and disadvantages', 'Do the advantages outweigh the disadvantages?', 'Weigh both sides and say which is stronger.'],
            ['Problem and solution', 'What are the causes? What can be done?', 'Answer each question; an opinion is not required unless asked.'],
            ['Two-part question', 'Why is this happening? Is it positive or negative?', 'Answer both questions, each with its own development.'],
          ],
        }},
        {tip: 'Underline the exact proposition. "Cash should be abolished" is not the same as "electronic payments are useful": the benefits of an activity are not the benefits of making it compulsory. Judge the statement you were given.'},
        {p: 'You only need a personal opinion where the question asks for one. A qualified position ("I agree, but only for city centres") is perfectly acceptable when it answers the question; a clear position is not the same as an extreme one.'},
      ],
    },
    {
      id: 'plan',
      title: 'A plan in five minutes',
      blocks: [
        {p: 'Five minutes of planning saves you from the two most common Task 2 problems: ideas that run out halfway, and paragraphs that repeat each other.'},
        {ol: [
          'Decide your answer to the question in one sentence. This becomes your thesis.',
          'Choose two main ideas (three only if they come quickly). For a discussion essay, one idea for each view.',
          'For each idea, note **why** it is true and one concrete example or consequence.',
          'Check the plan against the question once more: does every paragraph answer it?',
        ]},
        {p: 'A typical structure is an introduction, two or three body paragraphs and a short conclusion. It is a convention, not a rule — what matters is that each paragraph has one clear purpose.'},
      ],
    },
    {
      id: 'paragraphs',
      title: 'Body paragraphs that develop ideas',
      blocks: [
        {p: 'Examiners reward ideas that are extended and supported, not lists of reasons. A useful pattern for each body paragraph: **point → explanation → example → link back** to the question.'},
        {p: 'Compare two versions of the same paragraph from our own sample essay on banning cars from city centres:'},
        {note: '**Weaker:** Banning cars is good for safety. Also it reduces pollution. Also people will walk more, which is healthy. Therefore cars should be banned.'},
        {note: '**Stronger:** The strongest argument for a ban is safety. In streets without cars, children can walk to school on their own, and the most serious accidents in city centres involve vehicles rather than cyclists or pedestrians. When cars were removed from the central square of our sample city, parents began letting younger children travel alone. For this reason, a ban would change daily life far more than a speed limit could.'},
        {p: 'The first version names three ideas and develops none. The second takes one idea and explains it, gives an example and connects it back to the position. Paragraphs like the second are what moves Task Response and Coherence upwards.'},
      ],
    },
    {
      id: 'intro-conclusion',
      title: 'Introduction and conclusion',
      blocks: [
        {ul: [
          '**Introduction:** paraphrase the topic in a sentence and state your position or what the essay will do. Two or three sentences are enough; do not copy the question — copied words are not counted.',
          '**Conclusion:** restate your position in new words and summarise the main reasons. Do not add a new argument here.',
        ]},
      ],
    },
    {
      id: 'language',
      title: 'Language: accuracy first',
      blocks: [
        {ul: [
          'Clear, accurate sentences beat ambitious ones full of mistakes. Use complex sentences where they help the meaning, not to show off.',
          'You do not need rare words or idioms. Precise, natural word combinations ("a serious accident", "reduce traffic") show vocabulary range.',
          'Simple linking words (but, so, also, however) are fine. Problems start when linkers are mechanical, overused or wrong for the logic.',
          'Avoid repeating the same key word in every sentence; use a synonym or a pronoun when the meaning stays clear.',
        ]},
        {p: 'See [common Writing mistakes](/guide/common-writing-mistakes) for the errors we see most often and how to fix them.'},
      ],
    },
    {
      id: 'timing',
      title: 'Timing your 40 minutes',
      blocks: [
        {table: {
          head: ['Minutes', 'What to do'],
          rows: [
            ['0–5', 'Read the question twice, decide your position, plan two or three paragraphs.'],
            ['5–35', 'Write: introduction, body paragraphs, conclusion.'],
            ['35–40', 'Check: verb forms, agreement, articles, spelling, and whether every paragraph answers the question.'],
          ],
        }},
        {tip: 'Many candidates write Task 2 first, because it counts more. Whichever order you choose, practise it so it feels automatic on the day.'},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Academic Writing format', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing'},
    {label: 'IELTS General Training Writing format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-writing'},
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
    {label: 'Writing test preparation resources', href: 'https://ielts.org/take-a-test/preparation-resources/writing-test-resources'},
  ],
};

export default chapter;
