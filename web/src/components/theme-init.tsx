'use client';
import {useSyncExternalStore} from 'react';
import {themeInitScript} from '../lib/theme';

const subscribe = () => () => {};

/** The blocking bootstrap lives in the server HTML only; client navigations never add a script. */
export function ThemeInit() {
  const initialDocument = useSyncExternalStore(subscribe, () => false, () => true);
  return initialDocument ? <script dangerouslySetInnerHTML={{__html: themeInitScript}}/> : null;
}
