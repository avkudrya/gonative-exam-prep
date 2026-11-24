import type {Metadata} from 'next';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {ThemeInit} from '../../components/theme-init';
import {ThemeProvider} from '../../components/theme-provider';
import {routing} from '../../i18n/routing';
import {siteOrigin} from '../../lib/site';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/cyrillic-400.css';
import '@fontsource/noto-sans/cyrillic-600.css';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map(locale => ({locale}));
}

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'Shell'});
  return {
    metadataBase: new URL(siteOrigin),
    title: {default: t('brand'), template: `%s · ${t('brand')}`},
    description: t('description'),
    robots: {index: false, follow: false},
  };
}

export default async function Layout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <html lang={locale} suppressHydrationWarning>
    <head><ThemeInit/></head>
    <body>
      <NextIntlClientProvider><ThemeProvider>{children}</ThemeProvider></NextIntlClientProvider>
    </body>
  </html>;
}
