/**
 * The IELTS preparation guide (Phase 6, P6.4): chapters are data in the repository, one file per chapter and language,
 * written in our own words from the checked facts of docs/phase-6/P6.1-ielts-facts.md.
 *
 * Inline text supports **bold** and [label](href): an href starting with "/" is a guide or landing path on the landing
 * host ("/guide/study-plan"), an https href is an external source and opens in a new tab.
 */
import type {InterfaceLocale} from '../../i18n/locales';

export type Inline = string;

export type Block =
  | {p: Inline}
  | {ul: Inline[]}
  | {ol: Inline[]}
  | {table: {head: Inline[]; rows: Inline[][]}}
  | {tip: Inline}
  | {note: Inline};

export type GuideSection = {id: string; title: string; blocks: Block[]};

/** Where a chapter sends the reader to practise; null for parts of the test we do not train yet. */
export type Practice = 'task2' | 'academic-task-1' | 'letter' | 'simulation' | 'rewrite' | 'vocabulary' | null;

export type Chapter = {
  title: string;
  /** Meta description and the line on the guide's contents page. */
  description: string;
  lead: Inline;
  /** ISO date the facts were last checked against the official pages. */
  checked: string;
  sections: GuideSection[];
  sources: {label: string; href: string}[];
};

export type GuideEntry = {
  slug: string;
  practice: Practice;
  /** Chapters linked at the end, by slug. */
  related: string[];
  /** A chapter is shown in a language only when it is written in that language. */
  locales: Partial<Record<InterfaceLocale, Chapter>>;
};
