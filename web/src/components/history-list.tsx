'use client';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {AttemptSummary} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {forgetLocalDraft} from '../lib/draft-sync';
import {attemptState} from '../lib/attempt-state';

/** All essays, newest first; each can be opened or deleted permanently (K: history). */
export function HistoryList({items}: {items: (AttemptSummary & {when: string})[]}) {
  const t = useTranslations('History');
  const w = useTranslations('Writing');
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{uuid: string; code: string} | null>(null);

  async function remove(uuid: string) {
    setBusy(true);
    setError(null);
    const result = await bff(`attempts/${uuid}`, {method: 'DELETE'});
    setBusy(false);
    if (!result.ok && result.status !== 404) {
      setError({uuid, code: result.error === 'exams_attempt_assessing' ? 'assessing' : 'failed'});
      return;
    }
    forgetLocalDraft(uuid);
    setConfirming(null);
    router.refresh();
  }

  return <ul className="attempts history-list">
    {items.map(item => {
      const state = attemptState(item);
      return <li key={item.uuid} className="history-item">
        <Link href={`/ielts/writing/${item.uuid}`} className="attempt">
          <span className="attempt-title">{item.topic ?? w('ownTask')}</span>
          <span className="attempt-meta">
            <span className={`badge ${state}`}>{w(`states.${state}`)}</span>
            <span>{w('words', {count: item.word_count ?? 0})}</span>
            <span>{item.when}</span>
          </span>
        </Link>
        {confirming === item.uuid ? <div className="confirm" role="group" aria-label={t('deleteLabel')}>
          <span>{t('deleteConfirm')}</span>
          <button type="button" className="button danger" disabled={busy} onClick={() => void remove(item.uuid)}>{t('delete')}</button>
          <button type="button" className="button" onClick={() => setConfirming(null)}>{t('cancel')}</button>
        </div> : <button type="button" className="text-button danger-text" aria-label={t('deleteNamed', {title: item.topic ?? w('ownTask')})}
          onClick={() => { setConfirming(item.uuid); setError(null); }}>{t('delete')}</button>}
        {error?.uuid === item.uuid && <p className="feedback error" role="alert">{t(`errors.${error.code}`)}</p>}
      </li>;
    })}
  </ul>;
}
