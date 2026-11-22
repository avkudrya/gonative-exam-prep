import {z} from 'zod';

/*
 * Skill taxonomy keys (draft, Phase 0 F). Keys are language-neutral `domain.skill`
 * paths; a language may add its own leaves (`grammar.cases` for German) without
 * touching the rest. Skills are generic language abilities, kept apart from exam
 * criteria: one finding names a skill and, optionally, the criterion it affected.
 */

export const skillDomains = [
  'grammar', 'vocabulary', 'coherence', 'task', 'register', 'mechanics',
  'reading', 'listening', 'speaking', 'pronunciation',
] as const;

export const skillKey = z.string().regex(
  new RegExp(`^(?:${skillDomains.join('|')})(?:\\.[a-z0-9_]+)+$`),
  'skill key: <domain>.<skill>',
);
export type SkillKey = z.infer<typeof skillKey>;

/** Seed leaves for the IELTS Writing proof of concept; the full taxonomy comes from Phase 0 F. */
export const seedSkills: readonly SkillKey[] = [
  'grammar.articles',
  'grammar.verb_tenses',
  'grammar.subject_verb_agreement',
  'grammar.sentence_structure',
  'grammar.prepositions',
  'vocabulary.range',
  'vocabulary.collocations',
  'vocabulary.word_choice',
  'vocabulary.word_formation',
  'vocabulary.repetition',
  'coherence.paragraphing',
  'coherence.cohesive_devices',
  'coherence.progression',
  'task.position_clarity',
  'task.idea_development',
  'task.requirement_coverage',
  'register.formality',
  'mechanics.spelling',
  'mechanics.punctuation',
];
