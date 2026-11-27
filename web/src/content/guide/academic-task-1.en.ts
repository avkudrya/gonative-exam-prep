import type {Chapter} from './types';

// Facts: docs/phase-0/D1-ielts-writing-spec.md, docs/phase-6/P6.1-ielts-facts.md. The overview definition matches our
// Academic Task 1 feedback (exam-t1-6, docs/phase-5/P5.13-precision-round.md §4).
const chapter: Chapter = {
  title: 'IELTS Academic Writing Task 1: how to describe charts, tables and diagrams',
  description: 'How to write an IELTS Academic Task 1 report: the overview, choosing key features, comparing figures accurately, and the language of trends — in 20 minutes and at least 150 words.',
  lead: 'Academic Task 1 asks you to describe visual information in your own words: a chart, a table, a diagram, a process or a map. It is a report, not an essay — the skill is choosing what matters and saying it accurately.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'task',
      title: 'What the task asks for',
      blocks: [
        {ul: [
          'At least **150 words** in about **20 minutes**, in an academic or neutral style.',
          'The visual can be a line or bar chart, a pie chart, a table, a diagram of a process, a map, or a combination of two.',
          'You describe and compare what the data shows. You do not explain causes or give opinions — nothing in the visual tells you why the numbers changed.',
          'Task 1 counts half as much as Task 2 in your Writing score, so do not let it eat into Task 2 time.',
        ]},
      ],
    },
    {
      id: 'overview',
      title: 'The overview: the sentence that matters most',
      blocks: [
        {p: 'An **overview** sums up the main trends, differences or the overall picture **in one place**, in one or two sentences — usually right after the introduction or at the end. Without a clear overview, Task Achievement is unlikely to go above band 5, however accurate your figures are.'},
        {p: 'What is **not** an overview:'},
        {ul: [
          'The introduction that only restates what the chart shows ("The graph shows the number of commuters by car, bus and bicycle from 2000 to 2020").',
          'The trend of each category stated at the start of its own paragraph, followed by details. Even if all the trends are there, the reader has to assemble the big picture alone.',
          'A list of the highest and lowest numbers without saying what they add up to.',
        ]},
        {p: 'Example on our own line chart of commuters in a city:'},
        {note: '**Overview:** Overall, car use declined over the period while bus travel rose steadily, so that buses had overtaken cars by the end; cycling remained by far the least common way to travel.'},
        {p: 'No numbers are needed in the overview: it states the shape of the data. The figures come in the body.'},
      ],
    },
    {
      id: 'key-features',
      title: 'Choosing key features',
      blocks: [
        {p: 'A report that lists every number (a "data dump") is scored low even when every figure is right. Select:'},
        {ul: [
          'the highest and lowest values and where they occur;',
          'the biggest changes and turning points (a peak, a fall, a point where two lines cross);',
          'clear comparisons between categories;',
          'anything that does not follow the general pattern.',
        ]},
        {p: 'Group information instead of going item by item: two categories that behave the same way can share a sentence. Support every key feature with a figure from the visual.'},
      ],
    },
    {
      id: 'accuracy',
      title: 'Figures and comparisons must be accurate',
      blocks: [
        {ul: [
          'Quote figures as they appear, with units ("450 thousand commuters", "35%").',
          'Approximations are fine when they are true: "almost twice as many" is right for 180 against 95, but not for 180 against 150.',
          'Do not invent data the visual does not show — no years in between, no causes, no forecasts unless the chart itself has a forecast.',
          'Watch the time: past tenses for past data; a future form only for projections that are on the chart.',
        ]},
        {tip: 'Before you start writing, spend two minutes reading the visual: title, units, time period, categories. Most factual mistakes come from misreading the units.'},
      ],
    },
    {
      id: 'structure',
      title: 'A simple structure that works',
      blocks: [
        {table: {
          head: ['Part', 'Content', 'Length'],
          rows: [
            ['Introduction', 'What the visual shows, in your own words', '1 sentence'],
            ['Overview', 'The main trends or differences in one place', '1–2 sentences'],
            ['Body 1', 'The first group of key features with figures', '3–4 sentences'],
            ['Body 2', 'The second group of key features with figures', '3–4 sentences'],
          ],
        }},
        {p: 'A conclusion is not required: the overview does its job. For a process diagram, describe the stages in order and use the passive where the agent does not matter ("the leaves are dried"). For maps, compare the before and after: what was built, removed or moved.'},
      ],
    },
    {
      id: 'language',
      title: 'Language of trends and comparisons',
      blocks: [
        {table: {
          head: ['Purpose', 'Useful language'],
          rows: [
            ['Change', 'rise, increase, grow, fall, decline, drop; a sharp rise, a gradual decline'],
            ['No change', 'remain stable, stay at, level off, plateau'],
            ['Peak and low', 'reach a peak of, peak at, hit a low of'],
            ['Comparison', 'twice as many as, slightly more than, by far the largest, the second highest'],
            ['Proportion', 'a third of, the majority of, just under half'],
          ],
        }},
        {p: 'Vary your structures — a verb in one sentence ("car use fell"), a noun in the next ("there was a fall in car use") — but never at the cost of accuracy.'},
      ],
    },
    {
      id: 'mistakes',
      title: 'Mistakes that cost the most',
      blocks: [
        {ol: [
          'No overview, or an overview hidden across the body paragraphs.',
          'Listing every value instead of selecting.',
          'Explaining causes or giving opinions.',
          'Wrong figures or comparisons that the data does not support.',
          'Copying the task wording: copied words are not counted towards your total.',
        ]},
      ],
    },
  ],
  sources: [
    {label: 'IELTS Academic Writing format', href: 'https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing'},
    {label: 'Writing test preparation resources', href: 'https://ielts.org/take-a-test/preparation-resources/writing-test-resources'},
    {label: 'IELTS scoring in detail', href: 'https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail'},
  ],
};

export default chapter;
