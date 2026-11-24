import type {Metadata} from 'next';
import {getFormatter, getTranslations, setRequestLocale} from 'next-intl/server';
import {HistoryList} from '../../../../../../components/history-list';
import {Unavailable} from '../../../../../../components/unavailable';
import {Link} from '../../../../../../i18n/navigation';
import {requireMember} from '../../../../../../server/access';
import {attemptsPage} from '../../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'History'}))('title')};
}

export default async function History({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{page?: string | string[]}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const requested = Number((await searchParams).page);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= 100000 ? requested : 1;
  const member = await requireMember(locale, '/ielts/writing/history');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let data;
  try {
    data = await attemptsPage(page);
  } catch {
    return <Unavailable locale={locale}/>;
  }
  const t = await getTranslations({locale, namespace: 'History'});
  const format = await getFormatter({locale});
  const pages = Math.max(1, Math.ceil(data.total / data.perPage));
  const items = data.attempts.map(a => ({...a, when: (a.updated_at ?? a.created_at) ? format.dateTime(new Date((a.updated_at ?? a.created_at)!), {day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : ''}));
  return <section className="page history">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <div className="writing-hero">
      <div><h1>{t('title')}</h1><p className="lead">{t('lead', {count: data.total})}</p></div>
      <Link className="button primary" href="/ielts/writing/new">{t('newEssay')}</Link>
    </div>
    {items.length ? <HistoryList items={items}/> : <p className="empty">{t('empty')}</p>}
    {pages > 1 && <nav className="pagination" aria-label={t('pages')}>
      {page > 1 && <Link href={{pathname: '/ielts/writing/history', query: {page: page - 1}}}>{t('previous')}</Link>}
      <span>{t('pageOf', {page, pages})}</span>
      {page < pages && <Link href={{pathname: '/ielts/writing/history', query: {page: page + 1}}}>{t('next')}</Link>}
    </nav>}
  </section>;
}
