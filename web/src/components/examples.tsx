import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {exampleBySlug, examples, type Example} from '../content/examples';
import {routing} from '../i18n/routing';
import {appOrigin, publicIndexing, publicUrl} from '../lib/hosts';
import {ChartView} from './chart-view';
import {PublicShell, StructuredData} from './public-shell';
import {ResultView} from './result';

const robots = () => (publicIndexing() ? {index: true, follow: true} : {index: false, follow: false});

function alternates(host: string, path: (locale: string) => string, locale: string): Metadata['alternates'] {
  return {canonical: publicUrl(host, path(locale)), languages: {
    ...Object.fromEntries(routing.locales.map(l => [l, publicUrl(host, path(l))])), 'x-default': publicUrl(host, path(routing.defaultLocale)),
  }};
}

export async function examplesMetadata(locale: string, host: string): Promise<Metadata> {
  const t = await getTranslations({locale, namespace: 'Examples'});
  return {title: {absolute: t('metaTitle')}, description: t('metaDescription'), robots: robots(), alternates: alternates(host, l => `/${l}/examples`, locale)};
}

export async function exampleMetadata(locale: string, host: string, slug: string): Promise<Metadata> {
  const example = exampleBySlug(slug);
  if (!example) return {};
  const t = await getTranslations({locale, namespace: 'Examples'});
  return {title: {absolute: `${t(`items.${slug}.title`)} · GoNative Exams`}, description: t(`items.${slug}.description`), robots: robots(),
    alternates: alternates(host, l => `/${l}/examples/${slug}`, locale)};
}

const register = (locale: string, campaign: string) => `${appOrigin()}/${locale}/register?${new URLSearchParams({exam: 'ielts', utm_source: 'ielts_examples', utm_medium: 'examples', utm_campaign: campaign})}`;

export async function ExamplesHub({locale, host}: {locale: string; host: string}) {
  const t = await getTranslations({locale, namespace: 'Examples'});
  return <PublicShell locale={locale} className="examples">
    <StructuredData data={{'@context': 'https://schema.org', '@type': 'ItemList', itemListElement: examples.map((e, i) => ({
      '@type': 'ListItem', position: i + 1, name: t(`items.${e.slug}.title`), url: publicUrl(host, `/${locale}/examples/${e.slug}`)}))}}/>
    <section className="landing-hero guide-hero">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p className="lead">{t('intro')}</p>
    </section>
    <section className="landing-section">
      <ul className="landing-tasks examples-list">
        {examples.map(e => <li key={e.slug}>
          <p className="eyebrow">{t(`kinds.${e.kind}`)}</p>
          <h2><a href={`/${locale}/examples/${e.slug}`}>{t(`items.${e.slug}.title`)}</a></h2>
          <p>{t(`items.${e.slug}.description`)}</p>
        </li>)}
      </ul>
    </section>
  </PublicShell>;
}

export async function ExamplePage({locale, host, example, leftOut}: {locale: string; host: string; example: Example; leftOut: number}) {
  const t = await getTranslations({locale, namespace: 'Examples'});
  const g = await getTranslations({locale, namespace: 'Guide'});
  const title = t(`items.${example.slug}.title`);
  const stimulus = example.attempt.prompt.stimulus;
  return <PublicShell locale={locale} className="examples">
    <StructuredData data={{'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      {'@type': 'ListItem', position: 1, name: g('home'), item: publicUrl(host, `/${locale}`)},
      {'@type': 'ListItem', position: 2, name: t('nav'), item: publicUrl(host, `/${locale}/examples`)},
      {'@type': 'ListItem', position: 3, name: title, item: publicUrl(host, `/${locale}/examples/${example.slug}`)},
    ]}}/>
    <div className="example-page">
      <nav className="guide-crumbs" aria-label={g('breadcrumbs')}>
        <a href={`/${locale}`}>{g('home')}</a> <span aria-hidden="true">/</span> <a href={`/${locale}/examples`}>{t('nav')}</a>
      </nav>
      <p className="eyebrow">{t(`kinds.${example.kind}`)}</p>
      <h1>{title}</h1>
      <p className="lead">{t(`items.${example.slug}.description`)}</p>
      <p className="guide-note">{t('note')}{leftOut > 0 && <> {t('leftOut', {count: leftOut})}</>}{locale !== 'en' && <> {t('language')}</>}</p>
      <details className="task-details" open>
        <summary>{t('taskTitle')}</summary>
        <p className="prompt-text" lang="en">{example.attempt.prompt.text}</p>
        {stimulus?.format === 'chart-spec/1' && <ChartView spec={stimulus}/>}
      </details>
      <ResultView attempt={example.attempt} assessment={example.assessment} example/>
      <aside className="guide-practice">
        <h2>{t('ctaTitle')}</h2>
        <p>{t('ctaText')}</p>
        <a className="button primary" href={register(locale, example.slug)}>{t('cta')}</a>
        <p><a href={`/${locale}/examples`}>{t('all')}</a></p>
      </aside>
    </div>
  </PublicShell>;
}
