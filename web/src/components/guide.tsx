import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {chapterLocales, guideChapter, guideChapters} from '../content/guide';
import type {Block, Chapter, GuideEntry, Inline} from '../content/guide/types';
import {routing} from '../i18n/routing';
import {appOrigin, publicIndexing, publicUrl} from '../lib/hosts';
import {PublicShell, StructuredData} from './public-shell';

const robots = () => (publicIndexing() ? {index: true, follow: true} : {index: false, follow: false});

/** hreflang alternates for the languages a page exists in; x-default is English when it exists. */
function alternates(host: string, path: (locale: string) => string, locales: readonly string[], locale: string): Metadata['alternates'] {
  const languages: Record<string, string> = Object.fromEntries(locales.map(l => [l, publicUrl(host, path(l))]));
  if (locales.includes(routing.defaultLocale)) languages['x-default'] = publicUrl(host, path(routing.defaultLocale));
  return {canonical: publicUrl(host, path(locale)), languages};
}

const hubLocales = () => routing.locales.filter(l => guideChapters(l).length > 0);

export async function guideHubMetadata(locale: string, host: string): Promise<Metadata> {
  const t = await getTranslations({locale, namespace: 'Guide'});
  return {title: {absolute: t('metaTitle')}, description: t('metaDescription'), robots: robots(),
    alternates: alternates(host, l => `/${l}/guide`, hubLocales(), locale)};
}

export async function chapterMetadata(locale: string, host: string, slug: string): Promise<Metadata> {
  const found = guideChapter(slug, locale);
  if (!found) return {};
  return {title: {absolute: `${found.chapter.title} · GoNative Exams`}, description: found.chapter.description, robots: robots(),
    alternates: alternates(host, l => `/${l}/guide/${slug}`, chapterLocales(slug), locale),
    openGraph: {type: 'article', title: found.chapter.title, description: found.chapter.description, url: publicUrl(host, `/${locale}/guide/${slug}`)}};
}

/** **bold** and [label](href); a guide link to a chapter not written in this language stays plain text. */
function InlineText({text, locale}: {text: Inline; locale: string}) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return <>{parts.map((part, i) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (!link) return part;
    const [, label, href] = link;
    if (href.startsWith('https://')) return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{label}</a>;
    const chapter = /^\/guide\/([a-z0-9-]+)$/.exec(href);
    if (chapter && !guideChapter(chapter[1], locale)) return label;
    return <a key={i} href={`/${locale}${href}`}>{label}</a>;
  })}</>;
}

function BlockView({block, locale}: {block: Block; locale: string}) {
  const text = (value: Inline) => <InlineText text={value} locale={locale}/>;
  if ('p' in block) return <p>{text(block.p)}</p>;
  if ('ul' in block) return <ul>{block.ul.map(item => <li key={item}>{text(item)}</li>)}</ul>;
  if ('ol' in block) return <ol>{block.ol.map(item => <li key={item}>{text(item)}</li>)}</ol>;
  if ('tip' in block) return <p className="guide-tip">{text(block.tip)}</p>;
  if ('note' in block) return <p className="guide-note">{text(block.note)}</p>;
  return <div className="guide-table"><table>
    <thead><tr>{block.table.head.map((cell, i) => <th key={i} scope="col">{text(cell)}</th>)}</tr></thead>
    <tbody>{block.table.rows.map((row, r) => <tr key={r}>{row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{text(cell)}</th> : <td key={i}>{text(cell)}</td>))}</tr>)}</tbody>
  </table></div>;
}

function registerUrl(locale: string, campaign: string) {
  return `${appOrigin()}/${locale}/register?${new URLSearchParams({exam: 'ielts', utm_source: 'ielts_guide', utm_medium: 'guide', utm_campaign: campaign})}`;
}

export async function GuideHub({locale, host}: {locale: string; host: string}) {
  const t = await getTranslations({locale, namespace: 'Guide'});
  const chapters = guideChapters(locale);
  return <PublicShell locale={locale} className="guide">
    <StructuredData data={{'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      {'@type': 'ListItem', position: 1, name: t('home'), item: publicUrl(host, `/${locale}`)},
      {'@type': 'ListItem', position: 2, name: t('title'), item: publicUrl(host, `/${locale}/guide`)},
    ]}}/>
    <section className="landing-hero guide-hero">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p className="lead">{t('intro')}</p>
    </section>
    <section className="landing-section" aria-labelledby="guide-chapters">
      <h2 id="guide-chapters">{t('chapters')}</h2>
      <ol className="guide-chapters">
        {chapters.map(({entry, chapter}) => <li key={entry.slug}>
          <h3><a href={`/${locale}/guide/${entry.slug}`}>{chapter.title}</a></h3>
          <p>{chapter.description}</p>
        </li>)}
      </ol>
    </section>
  </PublicShell>;
}

export async function GuideChapter({locale, host, entry, chapter}: {locale: string; host: string; entry: GuideEntry; chapter: Chapter}) {
  const t = await getTranslations({locale, namespace: 'Guide'});
  const url = publicUrl(host, `/${locale}/guide/${entry.slug}`);
  const checked = new Intl.DateTimeFormat(locale, {dateStyle: 'long', timeZone: 'UTC'}).format(new Date(`${chapter.checked}T00:00:00Z`));
  const related = entry.related.flatMap(slug => {
    const found = guideChapter(slug, locale);
    return found ? [{slug, title: found.chapter.title}] : [];
  });
  return <PublicShell locale={locale} className="guide">
    <StructuredData data={{'@context': 'https://schema.org', '@graph': [
      {'@type': 'Article', headline: chapter.title, description: chapter.description, inLanguage: locale, dateModified: chapter.checked,
        author: {'@type': 'Organization', name: 'GoNative Exams'}, publisher: {'@type': 'Organization', name: 'GoNative Exams'}, mainEntityOfPage: url},
      {'@type': 'BreadcrumbList', itemListElement: [
        {'@type': 'ListItem', position: 1, name: t('home'), item: publicUrl(host, `/${locale}`)},
        {'@type': 'ListItem', position: 2, name: t('title'), item: publicUrl(host, `/${locale}/guide`)},
        {'@type': 'ListItem', position: 3, name: chapter.title, item: url},
      ]},
    ]}}/>
    <article className="guide-chapter">
      <nav className="guide-crumbs" aria-label={t('breadcrumbs')}>
        <a href={`/${locale}`}>{t('home')}</a> <span aria-hidden="true">/</span> <a href={`/${locale}/guide`}>{t('title')}</a>
      </nav>
      <h1>{chapter.title}</h1>
      <p className="guide-byline">{t('byline')} · {t('checked', {date: checked})}</p>
      <p className="lead"><InlineText text={chapter.lead} locale={locale}/></p>
      <nav className="guide-contents" aria-labelledby="guide-contents-title">
        <h2 id="guide-contents-title">{t('contents')}</h2>
        <ol>{chapter.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
      </nav>
      {chapter.sections.map(section => <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="guide-section">
        <h2 id={`${section.id}-title`}>{section.title}</h2>
        {section.blocks.map((block, i) => <BlockView key={i} block={block} locale={locale}/>)}
      </section>)}
      {entry.practice
        ? <aside className="guide-practice" aria-labelledby="guide-practice-title">
          <h2 id="guide-practice-title">{t(`practice.${entry.practice}.title`)}</h2>
          <p>{t(`practice.${entry.practice}.text`)}</p>
          <a className="button primary" href={registerUrl(locale, entry.slug)}>{t('practiceCta')}</a>
        </aside>
        : <p className="guide-note">{t('noTrainer')}</p>}
      <section className="guide-sources" aria-labelledby="guide-sources-title">
        <h2 id="guide-sources-title">{t('sources')}</h2>
        <ul>{chapter.sources.map(s => <li key={s.href}><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul>
      </section>
      {related.length > 0 && <nav className="guide-related" aria-labelledby="guide-related-title">
        <h2 id="guide-related-title">{t('related')}</h2>
        <ul>{related.map(r => <li key={r.slug}><a href={`/${locale}/guide/${r.slug}`}>{r.title}</a></li>)}</ul>
      </nav>}
    </article>
  </PublicShell>;
}
