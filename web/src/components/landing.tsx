import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {routing} from '../i18n/routing';
import {appOrigin, publicIndexing, publicUrl, type LandingExam} from '../lib/hosts';
import {guideChapters} from '../content/guide';
import {PublicShell, StructuredData} from './public-shell';

const landingUrl = (host: string, locale: string) => publicUrl(host, `/${locale}`);

export async function landingMetadata(locale: string, host: string): Promise<Metadata> {
  const t = await getTranslations({locale, namespace: 'Landing'});
  return {
    title: {absolute: t('metaTitle')},
    description: t('metaDescription'),
    alternates: {
      canonical: landingUrl(host, locale),
      languages: {...Object.fromEntries(routing.locales.map(l => [l, landingUrl(host, l)])), 'x-default': landingUrl(host, routing.defaultLocale)},
    },
    robots: publicIndexing() ? {index: true, follow: true} : {index: false, follow: false},
  };
}

/** The exam landing shown at /{locale} of its own host (ielts.mnemonicwords.app); links lead to the application host. */
export async function Landing({locale, exam, host}: {locale: string; exam: LandingExam; host: string}) {
  const t = await getTranslations({locale, namespace: 'Landing'});
  const app = appOrigin();
  const utm = (place: string) => new URLSearchParams({exam, utm_source: `${exam}_landing`, utm_medium: 'landing', utm_campaign: place}).toString();
  const register = (place: string) => `${app}/${locale}/register?${utm(place)}`;
  const tasks = ['task2', 'chart', 'letter', 'simulation'] as const;
  const steps = ['write', 'feedback', 'improve'] as const;
  const after = ['rewrite', 'practice', 'vocabulary', 'progress', 'languages', 'privacy'] as const;
  const free = ['feedbacks', 'drafts', 'practice', 'history'] as const;
  const faq = ['official', 'accuracy', 'variants', 'tasks', 'computer', 'price', 'languages', 'training'] as const;
  const chapters = guideChapters(locale).slice(0, 6);

  return <PublicShell locale={locale}>
    <StructuredData data={{'@context': 'https://schema.org', '@graph': [
      {'@type': 'WebSite', name: 'GoNative Exams', url: publicUrl(host, `/${locale}`), inLanguage: locale},
      {'@type': 'FAQPage', mainEntity: faq.map(q => ({'@type': 'Question', name: t(`faq.${q}.q`), acceptedAnswer: {'@type': 'Answer', text: t(`faq.${q}.a`)}}))},
    ]}}/>
    <section className="landing-hero">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p className="lead">{t('lead')}</p>
      <div className="actions">
        <a className="button primary" href={register('hero')}>{t('cta')}</a>
        <a className="button" href="#example">{t('seeExample')}</a>
      </div>
      <p className="hint">{t('ctaNote')}</p>
    </section>

    <section aria-labelledby="tasks-title" className="landing-section">
      <h2 id="tasks-title">{t('tasksTitle')}</h2>
      <ul className="landing-tasks">
        {tasks.map(task => <li key={task}><h3>{t(`tasks.${task}.title`)}</h3><p>{t(`tasks.${task}.text`)}</p></li>)}
      </ul>
    </section>

    <section aria-labelledby="how-title" className="landing-section">
      <h2 id="how-title">{t('howTitle')}</h2>
      <ol className="landing-steps">
        {steps.map((step, i) => <li key={step}><span className="step-number">{i + 1}</span><h3>{t(`steps.${step}.title`)}</h3><p>{t(`steps.${step}.text`)}</p></li>)}
      </ol>
    </section>

    <section id="example" aria-labelledby="example-title" className="landing-section">
      <h2 id="example-title">{t('exampleTitle')}</h2>
      <p className="hint">{t('exampleNote')}</p>
      <div className="landing-example">
        <div className="essay-marked" lang="en">
          Nowadays many <mark className="hl error">city centres is</mark> full of cars, and <mark className="hl weakness">the children</mark> cannot walk to school alone.{' '}
          <mark className="hl strength">On the one hand,</mark> banning cars would make streets safer.
        </div>
        <div className="finding error">
          <div className="finding-head"><span className="badge error">{t('sample.kind')}</span><span className="finding-skill">{t('sample.skill')}</span></div>
          <p className="quote" lang="en">“city centres is” <span aria-hidden="true">→</span> <span className="suggestion">city centres are</span></p>
          <p>{t('sample.explanation')}</p>
        </div>
        <div className="criterion">
          <div className="criterion-head">
            <h3>Grammatical Range and Accuracy</h3>
            <p className="range"><span className="range-value">≈ 5–6</span><span className="range-note">{t('approximate')}</span></p>
          </div>
          <p>{t('sample.summary')}</p>
        </div>
      </div>
      <p><a className="button" href={`/${locale}/examples`}>{t('examplesLink')}</a></p>
    </section>

    <section aria-labelledby="after-title" className="landing-section">
      <h2 id="after-title">{t('afterTitle')}</h2>
      <ul className="landing-features">
        {after.map(f => <li key={f}><h3>{t(`after.${f}.title`)}</h3><p>{t(`after.${f}.text`)}</p></li>)}
      </ul>
    </section>

    <section aria-labelledby="honest-title" className="landing-section landing-honest">
      <h2 id="honest-title">{t('honestTitle')}</h2>
      <p>{t('honestText')}</p>
    </section>

    {chapters.length > 0 && <section aria-labelledby="guide-title" className="landing-section landing-guide">
      <h2 id="guide-title">{t('guideTitle')}</h2>
      <p>{t('guideText')}</p>
      <ul>{chapters.map(({entry, chapter}) => <li key={entry.slug}><a href={`/${locale}/guide/${entry.slug}`}>{chapter.title}</a></li>)}</ul>
      <a className="button" href={`/${locale}/guide`}>{t('guideLink')}</a>
    </section>}

    <section aria-labelledby="free-title" className="landing-section landing-free">
      <h2 id="free-title">{t('freeTitle')}</h2>
      <ul>{free.map(f => <li key={f}>{t(`freeItems.${f}`)}</li>)}</ul>
      <a className="button primary" href={register('free')}>{t('cta')}</a>
    </section>

    <section aria-labelledby="faq-title" className="landing-section">
      <h2 id="faq-title">{t('faqTitle')}</h2>
      <div className="faq">
        {faq.map(q => <details key={q}><summary>{t(`faq.${q}.q`)}</summary><p>{t(`faq.${q}.a`)}</p></details>)}
      </div>
    </section>

    <section className="landing-hero landing-final">
      <h2>{t('finalTitle')}</h2>
      <a className="button primary" href={register('final')}>{t('cta')}</a>
    </section>
  </PublicShell>;
}
