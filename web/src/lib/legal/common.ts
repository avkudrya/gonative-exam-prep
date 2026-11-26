// Operator details are the same as for GoNative Worksheets (one operator for the GoNative products).
export const OPERATOR = 'Oleksii Kudria';
export const OPERATOR_ADDRESS = 'Pr. da Táta, 5, 2655-074 Carvoeira, Portugal';
/** Support and privacy contact of Exams. TODO(owner): confirm the mailbox exists before P3.8. */
export const SUPPORT_EMAIL = 'exams@mnemonicwords.app';
export const GONATIVE_PRIVACY = 'https://gonativeweb.mnemonicwords.app/privacy';
export const GONATIVE_TERMS = 'https://gonativeweb.mnemonicwords.app/terms';
export const GOOGLE_PRIVACY = 'https://policies.google.com/privacy';
export const ANTHROPIC_PRIVACY = 'https://www.anthropic.com/legal/privacy';
/** Anthropic API data retention, as read for C2 §4.1 (2026-11-23). */
export const ANTHROPIC_RETENTION = 'https://platform.claude.com/docs/en/build-with-claude/api-and-data-retention';
export const CNPD_COMPLAINTS = 'https://www.cnpd.pt/cidadaos/participacoes/';

/**
 * Version of the Exams Terms and Privacy Policy. It must equal MultiAdmin `exam.terms_version`:
 * the welcome page accepts only this version, so a person always accepts the text they were shown.
 */
// Must equal MultiAdmin config exam.terms_version. 2026-11-26: the AI check in «Fix it yourself» (P4.14).
export const TERMS_VERSION = '2026-11-26';

export type LegalSection = {
  id: string;
  title: string;
  body?: string[];
  items?: string[];
  links?: {label: string; href: string}[];
};

export type LegalDocument = {
  title: string;
  version: string;
  intro: string;
  summary: string[];
  sections: LegalSection[];
};
