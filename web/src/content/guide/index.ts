import type {InterfaceLocale} from '../../i18n/locales';
import ieltsFormatEn from './ielts-format.en';
import type {Chapter, GuideEntry} from './types';

/** The IELTS guide in reading order (docs/phase-6/P6-plan.md, P6.4). A chapter appears once it is written. */
export const guide: GuideEntry[] = [
  {slug: 'ielts-format', practice: 'simulation', related: ['study-plan', 'writing-task-2', 'writing-criteria'], locales: {en: ieltsFormatEn}},
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
