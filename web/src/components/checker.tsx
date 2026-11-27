import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import type {Checker} from '../content/checkers';
import {guideChapter} from '../content/guide';
import {routing} from '../i18n/routing';
import {appOrigin, publicIndexing, publicUrl} from '../lib/hosts';
import {ChartView} from './chart-view';
import {PublicShell, StructuredData} from './public-shell';

export async function checkerMetadata(locale: string, host: string, checker: Checker): Promise<Metadata> {
  const t = await getTranslations({locale, namespace: 'Checkers'});
  const url = (l: string) => publicUrl(host, `/${l}/${checker.slug}`);
  return {
    title: {absolute: t(`pages.${checker.slug}.metaTitle`)},
    description: t(`pages.${checker.slug}.metaDescription`),
    robots: publicIndexing() ? {index: true, follow: true} : {index: false, follow: false},
    alternates: {canonical: url(locale), languages: {...Object.fromEntries(routing.locales.map(l => [l, url(l)])), 'x-default': url(routing.defaultLocale)}},
  };
}

/** A page for one search ("IELTS Writing Task 2 checker"): what is checked, an example, our tasks, questions. */
export async function CheckerPage({locale, host, checker}: {locale: string; host: string; checker: Checker}) {
  const t = await getTranslations({locale, namespace: 'Checkers'});
  const page = `pages.${checker.slug}`;
  const checks = Object.keys(t.raw(`${page}.checks`) as Record<string, string>);
  const faq = Object.keys(t.raw(`${page}.faq`) as Record<string, unknown>);
  const register = (campaign: string) => `${appOrigin()}/${locale}/register?${new URLSearchParams({exam: 'ielts', utm_source: 'ielts_checker', utm_medium: checker.slug, utm_campaign: campaign})}`;

  return <PublicShell locale={locale} className="checker">
    <StructuredData data={{'@context': 'https://schema.org', '@graph': [
      {'@type': 'WebPage', name: t(`${page}.title`), description: t(`${page}.metaDescription`), url: publicUrl(host, `/${locale}/${checker.slug}`), inLanguage: locale},
      {'@type': 'FAQPage', mainEntity: faq.map(q => ({'@type': 'Question', name: t(`${page}.faq.${q}.q`), acceptedAnswer: {'@type': 'Answer', text: t(`${page}.faq.${q}.a`)}}))},
    ]}}/>
    <section className="landing-hero">
      <p className="eyebrow">{t(`${page}.eyebrow`)}</p>
      <h1>{t(`${page}.title`)}</h1>
      <p className="lead">{t(`${page}.lead`)}</p>
      <div className="actions">
        <a className="button primary" href={register('hero')}>{t('cta')}</a>
        <a className="button" href={`/${locale}/examples/${checker.example}`}>{t('exampleLink')}</a>
      </div>
      <p className="hint">{t('ctaNote')}</p>
    </section>

    <section className="landing-section" aria-labelledby="checks-title">
      <h2 id="checks-title">{t('checksTitle')}</h2>
      <ul className="landing-tasks">{checks.map(c => <li key={c}><p>{t(`${page}.checks.${c}`)}</p></li>)}</ul>
    </section>

    <section className="landing-section" aria-labelledby="tasks-title">
      <h2 id="tasks-title">{t('tasksTitle')}</h2>
      <p className="hint">{t('tasksNote')}</p>
      <ol className="checker-tasks">
        {checker.tasks.map(task => <li key={task.ref}>
          <p className="prompt-text" lang="en">{task.text}</p>
          {task.chart && <ChartView spec={task.chart} compact/>}
          <a className="button" href={register(task.ref.split(':')[1])}>{t('writeThis')}</a>
        </li>)}
      </ol>
      {guideChapter(checker.guide, locale) && <p className="checker-guide"><a href={`/${locale}/guide/${checker.guide}`}>{t('guideLink')}</a></p>}
    </section>

    <section className="landing-section" aria-labelledby="faq-title">
      <h2 id="faq-title">{t('faqTitle')}</h2>
      <div className="faq">{faq.map(q => <details key={q}><summary>{t(`${page}.faq.${q}.q`)}</summary><p>{t(`${page}.faq.${q}.a`)}</p></details>)}</div>
    </section>

    <section className="landing-hero landing-final">
      <h2>{t('ctaTitle')}</h2>
      <a className="button primary" href={register('final')}>{t('cta')}</a>
    </section>
  </PublicShell>;
}
