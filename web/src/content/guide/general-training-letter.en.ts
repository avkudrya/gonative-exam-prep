import type {Chapter} from './types';

// Facts: docs/phase-0/D1-ielts-writing-spec.md (GT Task 1: a letter with three points, personal / semi-formal / formal style,
// no addresses; the limiters for a missing point and an inappropriate tone). Advice matches exam-gt1-2.
const chapter: Chapter = {
  title: 'IELTS General Training Writing Task 1: how to write the letter',
  description: 'Formal, semi-formal and personal letters for IELTS General Training Task 1: the three bullet points, the right tone, openings and closings, and a 20-minute plan.',
  lead: 'In General Training Task 1 you write a letter for an everyday situation: to a friend, a landlord, a manager or a company. The task gives you three points to cover and a reader to write for — get both right and the rest is language.',
  checked: '2026-11-27',
  sections: [
    {
      id: 'task',
      title: 'What the task asks for',
      blocks: [
        {ul: [
          'At least **150 words** in about **20 minutes**.',
          'A situation and **three bullet points** that your letter must cover.',
          'A style that suits the reader: personal, semi-formal or formal.',
          'No addresses are needed: start with the greeting.',
        ]},
        {p: 'Two things limit your Task Achievement score whatever the quality of your English: **leaving out one of the three points**, and a **tone that does not suit the reader**. Both can hold the score at band 4 — so check them first.'},
      ],
    },
    {
      id: 'tone',
      title: 'Choose the tone from the reader',
      blocks: [
        {p: 'The task tells you who you are writing to; the tone follows from that relationship, not from the topic.'},
        {table: {
          head: ['Reader', 'Tone', 'Opening', 'Closing'],
          rows: [
            ['A friend or relative', 'Personal, warm', 'Dear Anna, / Hi Tom,', 'Best wishes, / Love, / See you soon,'],
            ['Someone you know in a formal role (a manager, a neighbour, a landlord)', 'Semi-formal, polite', 'Dear Mr Hughes, / Dear Ms Patel,', 'Kind regards, / Best regards,'],
            ['A company or official you do not know', 'Formal', 'Dear Sir or Madam,', 'Yours faithfully, (British) / Sincerely, (American)'],
          ],
        }},
        {p: 'Both British and American conventions are correct; just keep the opening and closing consistent. In a personal letter, "I", contractions ("I\'m", "can\'t"), phrasal verbs and everyday phrases are natural, not a weakness. In a formal letter, avoid slang and keep requests polite ("I would be grateful if…").'},
      ],
    },
    {
      id: 'points',
      title: 'Cover all three points — and develop them',
      blocks: [
        {p: 'Plan one paragraph per point, in the order the task gives them. For each point add a detail, a reason or an example, so it does not read like an answer to a form.'},
        {p: 'Example task (our own): you bought a coffee machine online and it stopped working. Write to the shop. In your letter: describe the problem; explain what you have already tried; say what you want the shop to do.'},
        {note: '**Too thin:** The machine is broken. I tried to fix it. Please give me a new one.'},
        {note: '**Developed:** Three weeks after delivery, the machine stopped heating water: the light turns on, but the coffee comes out cold. I followed the troubleshooting steps in the manual and descaled the machine twice, but nothing changed. As it is still under guarantee, I would be grateful if you could replace it or arrange a repair at no cost.'},
      ],
    },
    {
      id: 'structure',
      title: 'Structure and timing',
      blocks: [
        {table: {
          head: ['Part', 'Content'],
          rows: [
            ['Greeting', 'Matches the reader (see the table above)'],
            ['Opening line', 'Why you are writing — one sentence'],
            ['Body', 'One paragraph for each of the three points'],
            ['Closing line', 'What happens next ("I look forward to hearing from you", "Can\'t wait to see you")'],
            ['Sign-off', 'Matches the greeting, then your name'],
          ],
        }},
        {p: 'Timing: 3 minutes to read the task and plan the three paragraphs, 14 minutes to write, 3 minutes to check that every point is covered and the tone holds throughout.'},
      ],
    },
    {
      id: 'mistakes',
      title: 'Common mistakes',
      blocks: [
        {ol: [
          'Missing or barely touching one of the three points.',
          'Mixing tones: a formal opening and a chatty body, or "Dear Sir or Madam" with "Love,".',
          'A long introduction about yourself that the task did not ask for.',
          'Memorised phrases that do not fit the situation — examiners notice them.',
          'Writing a list instead of connected paragraphs.',
        ]},
      ],
    },
  ],
  sources: [
    {label: 'IELTS General Training Writing format', href: 'https://ielts.org/take-a-test/test-types/ielts-general-training-test/ielts-general-training-format-writing'},
    {label: 'Writing test preparation resources', href: 'https://ielts.org/take-a-test/preparation-resources/writing-test-resources'},
  ],
};

export default chapter;
