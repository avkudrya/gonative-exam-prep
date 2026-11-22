import {defineRouting} from 'next-intl/routing';
import {interfaceLocales} from './locales';

export const routing = defineRouting({
  locales: interfaceLocales.map(locale => locale.code),
  defaultLocale: 'en',
  localePrefix: 'always',
  localeDetection: true,
  localeCookie: {name: 'NEXT_LOCALE', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365},
  // Public pages will declare their own canonical/hreflang URLs (Phase 6).
  alternateLinks: false,
});
