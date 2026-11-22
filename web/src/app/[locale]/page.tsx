import {useTranslations} from 'next-intl';
import {setRequestLocale} from 'next-intl/server';
import {use} from 'react';
import {Link} from '../../i18n/navigation';
import {interfaceLocales} from '../../i18n/locales';

// Pre-launch placeholder. The Writing Checker UI starts in Phase 3, after the
// assessment proof of concept (Phase 1) shows what feedback can honestly be promised.
export default function Home({params}: {params: Promise<{locale: string}>}) {
  const {locale} = use(params);
  setRequestLocale(locale);
  const t = useTranslations('Home');
  const shell = useTranslations('Shell');
  const steps = ['assess', 'analyse', 'practise', 'reassess'] as const;

  return (
    <>
      <header className="header">
        <span className="brand">{shell('brand')}</span>
        <nav className="languages" aria-label={shell('language')}>
          {interfaceLocales.map(l => (
            <Link key={l.code} href="/" locale={l.code} aria-current={l.code === locale ? 'true' : undefined}>{l.shortName}</Link>
          ))}
        </nav>
      </header>
      <main>
        <section className="hero">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p>{t('lead')}</p>
        </section>
        <ol className="steps">
          {steps.map((step, i) => (
            <li key={step}>
              <span className="step-number">{i + 1}</span>
              <h2>{t(`steps.${step}.title`)}</h2>
              <p>{t(`steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
        <p className="notice">{t('status')}</p>
      </main>
      <footer>{shell('disclaimer')}</footer>
    </>
  );
}
