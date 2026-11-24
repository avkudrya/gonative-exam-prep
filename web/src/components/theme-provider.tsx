'use client';
import {createContext, useContext, useEffect, useSyncExternalStore, type ReactNode} from 'react';
import {themeKey, type Theme} from '../lib/theme';

const changed = 'exams-theme-change';
let fallback: Theme = 'system';
const valid = (value: string | null): value is Theme => value === 'light' || value === 'dark' || value === 'system';

function snapshot(): Theme {
  try {
    const value = localStorage.getItem(themeKey);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(changed, callback);
    window.removeEventListener('storage', callback);
  };
}

function setTheme(theme: Theme) {
  fallback = theme;
  try {
    localStorage.setItem(themeKey, theme);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  window.dispatchEvent(new Event(changed));
}

const ThemeContext = createContext<{theme: Theme; setTheme: (theme: Theme) => void}>({theme: 'system', setTheme});

export function ThemeProvider({children}: {children: ReactNode}) {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'system' as Theme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <ThemeContext.Provider value={{theme, setTheme}}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
