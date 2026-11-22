// Interface languages (spec §17). Add one only when its messages are fully translated.
// Exam/learning language, feedback language and translation language are separate
// settings of the user profile, not interface locales.
export const interfaceLocales = [
  {code: 'en', nativeName: 'English', shortName: 'EN'},
  {code: 'ru', nativeName: 'Русский', shortName: 'RU'},
] as const;

export type InterfaceLocale = typeof interfaceLocales[number]['code'];
