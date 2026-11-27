import type {InterfaceLocale} from '../../i18n/locales';
import academicTask1En from './academic-task-1.en';
import commonWritingMistakesEn from './common-writing-mistakes.en';
import generalTrainingLetterEn from './general-training-letter.en';
import ieltsFormatEn from './ielts-format.en';
import studyPlanEn from './study-plan.en';
import writingCriteriaEn from './writing-criteria.en';
import writingTask2En from './writing-task-2.en';
import type {Chapter, GuideEntry} from './types';

/** The IELTS guide in reading order (docs/phase-6/P6-plan.md, P6.4). A chapter appears once it is written. */
export const guide: GuideEntry[] = [
  {slug: 'ielts-format', practice: 'simulation', related: ['study-plan', 'writing-task-2', 'writing-criteria'], locales: {en: ieltsFormatEn}},
  {slug: 'study-plan', practice: 'simulation', related: ['ielts-format', 'writing-task-2', 'common-writing-mistakes'], locales: {en: studyPlanEn}},
  {slug: 'writing-task-2', practice: 'task2', related: ['writing-criteria', 'common-writing-mistakes', 'academic-task-1'], locales: {en: writingTask2En}},
  {slug: 'academic-task-1', practice: 'academic-task-1', related: ['writing-task-2', 'writing-criteria', 'common-writing-mistakes'], locales: {en: academicTask1En}},
  {slug: 'general-training-letter', practice: 'letter', related: ['writing-task-2', 'writing-criteria', 'common-writing-mistakes'], locales: {en: generalTrainingLetterEn}},
  {slug: 'writing-criteria', practice: 'task2', related: ['writing-task-2', 'academic-task-1', 'common-writing-mistakes'], locales: {en: writingCriteriaEn}},
  {slug: 'common-writing-mistakes', practice: 'rewrite', related: ['writing-criteria', 'writing-task-2', 'study-plan'], locales: {en: commonWritingMistakesEn}},
];

export function guideChapter(slug: string, locale: string): {entry: GuideEntry; chapter: Chapter} | null {
  const entry = guide.find(e => e.slug === slug);
  const chapter = entry?.locales[locale as InterfaceLocale];
  return entry && chapter ? {entry, chapter} : null;
}

/** Chapters written in this language, in reading order. */
export function guideChapters(locale: string) {
  return guide.flatMap(entry => {
    const chapter = entry.locales[locale as InterfaceLocale];
    return chapter ? [{entry, chapter}] : [];
  });
}

/** The languages a chapter is written in (for hreflang and the sitemap). */
export function chapterLocales(slug: string): InterfaceLocale[] {
  const entry = guide.find(e => e.slug === slug);
  return entry ? (Object.keys(entry.locales) as InterfaceLocale[]) : [];
}
