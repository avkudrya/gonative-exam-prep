'use client';
import {useTranslations} from 'next-intl';
import type {Theme} from '../lib/theme';
import {useTheme} from './theme-provider';

export function ThemeSwitch() {
  const t = useTranslations('Shell');
  const {theme, setTheme} = useTheme();
  return <label className="theme-switch">
    <span>{t('theme')}</span>
    <select value={theme} onChange={event => setTheme(event.target.value as Theme)}>
      {(['system', 'light', 'dark'] as const).map(value => <option key={value} value={value}>{t(`themes.${value}`)}</option>)}
    </select>
  </label>;
}
