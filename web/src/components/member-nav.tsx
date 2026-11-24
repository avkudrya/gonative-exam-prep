'use client';
import {useTranslations} from 'next-intl';
import {Link, usePathname} from '../i18n/navigation';

const items = [
  {href: '/ielts/writing', key: 'writing', match: (p: string) => p.startsWith('/ielts/writing')},
  {href: '/ielts/progress', key: 'progress', match: (p: string) => p.startsWith('/ielts/progress')},
  {href: '/ielts/results', key: 'results', match: (p: string) => p.startsWith('/ielts/results')},
] as const;

export function MemberNav() {
  const t = useTranslations('Shell');
  const pathname = usePathname();
  return <nav className="member-nav" aria-label={t('sections')}>
    {items.map(item => <Link key={item.key} href={item.href} aria-current={item.match(pathname) ? 'page' : undefined}>{t(`nav.${item.key}`)}</Link>)}
  </nav>;
}
