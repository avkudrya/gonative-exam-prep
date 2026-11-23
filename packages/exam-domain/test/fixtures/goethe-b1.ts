import type {Exam, ExamProvider} from '../../src/index.js';

/*
 * ARCHITECTURE FIXTURE, NOT PRODUCT DATA. Shows that a German exam with three short
 * writing tasks, point scoring and German terminology fits the same model as IELTS.
 * The task structure and point values are illustrative and unverified; real Goethe
 * configuration is out of scope until Phase 8.
 */

export const goetheProvider: ExamProvider = {key: 'goethe', officialName: 'Goethe-Institut', website: 'https://www.goethe.de/'};

const sources = [{url: 'https://www.goethe.de/de/spr/prf/gzb1.html', title: 'Goethe-Zertifikat B1'}];
const points = {kind: 'points', max: 5} as const;

export const goetheB1: Exam = {
  key: 'goethe-b1',
  providerKey: 'goethe',
  learningLanguage: 'de',
  officialName: 'Goethe-Zertifikat B1',
  versions: [{
    version: 'illustrative',
    status: 'draft',
    verifiedAt: null,
    sources,
    sections: [{
      key: 'schreiben',
      skill: 'writing',
      officialName: 'Schreiben',
      timeMinutes: 60,
      tasks: [
        {key: 'aufgabe-1', officialName: 'Aufgabe 1', responseGenre: 'email', stimuli: ['text_prompt'], words: {target: 80}, rubricKey: 'goethe-b1-schreiben'},
        {key: 'aufgabe-2', officialName: 'Aufgabe 2', responseGenre: 'forum_post', stimuli: ['text_prompt'], words: {target: 80}, rubricKey: 'goethe-b1-schreiben'},
        {key: 'aufgabe-3', officialName: 'Aufgabe 3', responseGenre: 'email', stimuli: ['text_prompt'], words: {target: 40}, rubricKey: 'goethe-b1-schreiben'},
      ],
      aggregation: {kind: 'sum', scaleTo: 100},
      scale: {kind: 'points', max: 100},
    }],
    rubrics: [{
      key: 'goethe-b1-schreiben',
      version: 'illustrative',
      officialName: 'Bewertungskriterien Schreiben',
      sources,
      criteria: [
        {key: 'erfuellung', officialName: 'Erfüllung der Aufgabenstellung', scale: points},
        {key: 'kohaerenz', officialName: 'Kohärenz', scale: points},
        {key: 'wortschatz', officialName: 'Wortschatz', scale: points},
        {key: 'strukturen', officialName: 'Strukturen', scale: points},
      ],
      aggregation: {kind: 'sum'},
      scale: {kind: 'points', max: 20},
    }],
  }],
};
