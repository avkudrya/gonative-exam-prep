import type {Metadata} from 'next';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {LanguageSwitch} from '../../../../components/language-switch';
import {ThemeSwitch} from '../../../../components/theme-switch';
import {routing} from '../../../../i18n/routing';
import {appOrigin, LANDING_HEADER, landingExamFor} from '../../../../lib/hosts';

// The landing exists only behind its own host (proxy.ts rewrites ielts.…/{locale} here).
export const dynamic = 'force-dynamic';

/** The public landing host, when this request came through its rewrite (proxy.ts); otherwise null. */
async function landingHost(exam: string) {
  const all = await headers();
  if (all.get(LANDING_HEADER) !== exam) return null;
  const host = (all.get('x-forwarded-host') ?? all.get('host') ?? '').toLowerCase();
  return landingExamFor(host) === exam ? host : null;
}

export async function generateMetadata({params}: {params: Promise<{locale: string; exam: string}>}): Promise<Metadata> {
  const {locale, exam} = await params;
  const host = await landingHost(exam);
  if (!host) return {};
  const t = await getTranslations({locale, namespace: 'Landing'});
  // Local development hosts (*.localhost) run over plain HTTP; real landing hosts over HTTPS.
  const hostname = host.replace(/:\d+$/, '');
  const scheme = hostname === 'localhost' || hostname.endsWith('.localhost') ? 'http' : 'https';
  const url = (l: string) => `${scheme}://${host}/${l}`;
  return {
    title: {absolute: t('metaTitle')},
    description: t('metaDescription'),
    alternates: {canonical: url(locale), languages: {...Object.fromEntries(routing.locales.map(l => [l, url(l)])), 'x-default': url(routing.defaultLocale)}},
    robots: {index: false, follow: false},
  };
}

export default async function Landing({params}: {params: Promise<{locale: string; exam: string}>}) {
  const {locale, exam} = await params;
  setRequestLocale(locale);
  if (!(await landingHost(exam))) notFound();
  const t = await getTranslations({locale, namespace: 'Landing'});
  const app = appOrigin();
  const utm = (place: string) => new URLSearchParams({exam, utm_source: `${exam}_landing`, utm_medium: 'landing', utm_campaign: place}).toString();
  const register = (place: string) => `${app}/${locale}/register?${utm(place)}`;
  const steps = ['write', 'feedback', 'improve'] as const;
  const features = ['criteria', 'highlights', 'language', 'progress', 'tasks', 'privacy'] as const;
  const faq = ['official', 'accuracy', 'training', 'price', 'languages', 'variants'] as const;

  return <div className="site landing">
    <a className="skip" href="#main">{t('skip')}</a>
    <header className="header">
      <span className="brand">GoNative <strong>Exams</strong> <span className="brand-exam">IELTS</span></span>
      <div className="header-tools">
        <LanguageSwitch/>
        <a className="text-link" href={`${app}/${locale}/login`}>{t('signIn')}</a>
      </div>
    </header>
    <main id="main">
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
      </section>

      <section aria-labelledby="features-title" className="landing-section">
        <h2 id="features-title">{t('featuresTitle')}</h2>
        <ul className="landing-features">
          {features.map(f => <li key={f}><h3>{t(`features.${f}.title`)}</h3><p>{t(`features.${f}.text`)}</p></li>)}
        </ul>
      </section>

      <section aria-labelledby="honest-title" className="landing-section landing-honest">
        <h2 id="honest-title">{t('honestTitle')}</h2>
        <p>{t('honestText')}</p>
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
    </main>
    <footer className="footer">
      <div className="footer-main">
        <nav className="footer-links" aria-label={t('legal')}>
          <a href={`${app}/${locale}/terms`}>{t('terms')}</a>
          <a href={`${app}/${locale}/privacy`}>{t('privacy')}</a>
        </nav>
        <p className="disclaimer">{t('disclaimer')}</p>
      </div>
      <div className="footer-tools"><ThemeSwitch/></div>
    </footer>
  </div>;
}
