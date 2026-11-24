'use client';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {localDraftKey} from '../lib/draft-sync';

type TimerState = {endsAt: number | null; left: number};

/** Optional exam timer. It never blocks writing; it survives a reload and is removed with the draft. */
export function EssayTimer({uuid, minutes}: {uuid: string; minutes: number}) {
  const t = useTranslations('Editor');
  const key = `${localDraftKey(uuid)}:timer`;
  const full = minutes * 60000;
  const [timer, setTimer] = useState<TimerState>({endsAt: null, left: full});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as TimerState | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && typeof saved.left === 'number') setTimer(saved);
    } catch {
      // No saved timer.
    }
  }, [key]);

  useEffect(() => {
    if (!timer.endsAt) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [timer.endsAt]);

  const update = (next: TimerState) => {
    setTimer(next);
    setNow(Date.now());
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The timer works for this page only.
    }
  };
  const left = Math.max(0, timer.endsAt ? timer.endsAt - now : timer.left);
  const running = timer.endsAt !== null && left > 0;
  const label = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;

  return <div className={`timer ${left === 0 ? 'done' : ''}`} role="timer" aria-label={t('timer')}>
    <span className="timer-value" aria-live={left === 0 ? 'polite' : 'off'}>{left === 0 ? t('timeUp') : label}</span>
    {running
      ? <button type="button" onClick={() => update({endsAt: null, left})}>{t('pause')}</button>
      : left > 0 && <button type="button" onClick={() => update({endsAt: Date.now() + left, left})}>{t(left === full ? 'startTimer' : 'resume')}</button>}
    {left !== full && <button type="button" onClick={() => update({endsAt: null, left: full})}>{t('reset')}</button>}
  </div>;
}
