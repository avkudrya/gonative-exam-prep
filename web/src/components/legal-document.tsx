import {getTranslations} from 'next-intl/server';
import {Link} from '../i18n/navigation';
import type {LegalDocument} from '../lib/legal/common';

export async function LegalDocumentView({document, locale, kind}: {document: LegalDocument; locale: string; kind: 'terms' | 'privacy'}) {
  const t = await getTranslations({locale, namespace: 'Legal'});
  return <div className="legal">
    <nav className="legal-tabs" aria-label={t('documents')}>
      <Link href="/terms" aria-current={kind === 'terms' ? 'page' : undefined}>{t('terms')}</Link>
      <Link href="/privacy" aria-current={kind === 'privacy' ? 'page' : undefined}>{t('privacy')}</Link>
    </nav>
    <h1 id="legal-title">{document.title}</h1>
    <p className="legal-version">{document.version}</p>
    <p className="legal-intro">{document.intro}</p>
    <section className="legal-summary" aria-labelledby="legal-summary-title">
      <h2 id="legal-summary-title">{t('summary')}</h2>
      <ul>{document.summary.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
    <nav className="legal-contents" aria-label={t('contents')}>
      <ol>{document.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
    </nav>
    {document.sections.map(section => <section id={section.id} key={section.id} aria-labelledby={`${section.id}-title`} className="legal-section">
      <h2 id={`${section.id}-title`}>{section.title}</h2>
      {section.body?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {section.items && <ul>{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
      {section.links && <p className="legal-links">{section.links.map(link => link.href.startsWith('/')
        ? <Link key={link.href} href={link.href}>{link.label}</Link>
        : <a key={link.href} href={link.href} target={link.href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">{link.label}</a>)}</p>}
    </section>)}
  </div>;
}
