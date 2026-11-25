'use client';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import type {Vocabulary, VocabularyList} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';

/**
 * P4.4: words from the feedback's vocabulary corrections, ready for a GoNative list. The backend picks them
 * from GoNative's dictionary without AI; the learner can untick words, then the list is created once.
 */
export function EssayWords({uuid}: {uuid: string}) {
  const t = useTranslations('Words');
  const [data, setData] = useState<Vocabulary | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void bff<Vocabulary>(`attempts/${uuid}/vocabulary`).then(result => {
      if (!live || !result.ok) return;
      setData(result.data);
      setChosen(new Set(result.data.words.map(w => w.dictionary_id)));
    });
    return () => { live = false; };
  }, [uuid]);

  if (!data || (data.words.length === 0 && !data.list)) return null;

  async function create() {
    if (!data) return;
    setBusy(true);
    setError('');
    const ids = data.words.map(w => w.dictionary_id).filter(id => chosen.has(id));
    const result = await bff<VocabularyList>(`attempts/${uuid}/vocabulary/list`, {
      body: {dictionary_ids: ids.length === data.words.length ? null : ids},
    });
    setBusy(false);
    if (!result.ok) {
      setError(t('unavailable'));
      return;
    }
    if (!result.data.list) setError(t('quotaFull'));
    setData({...data, list: result.data.list, quota: result.data.quota});
  }

  const toggle = (id: number) => setChosen(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const {quota, list} = data;
  const full = quota.remaining === 0;

  return <section id="words" aria-labelledby="words-title" className="essay-words">
    <h2 id="words-title">{t('title')}</h2>
    {list ? <div role="status">
      <p>{t('created', {name: list.name, count: list.words})}</p>
      <a className="button primary" href={list.url} target="_blank" rel="noopener noreferrer">{t('open')}</a>
    </div> : <>
      <p className="hint">{t('intro')}</p>
      <ul className="word-choices">
        {data.words.map(w => <li key={w.dictionary_id}>
          <label className="check">
            <input type="checkbox" checked={chosen.has(w.dictionary_id)} onChange={() => toggle(w.dictionary_id)}/>
            <span><span lang="en" className="word">{w.word}</span>{w.translation && <span className="translation"> — {w.translation}</span>}</span>
          </label>
        </li>)}
      </ul>
      {quota.tier === 'free' && quota.remaining !== null && <p className="hint">{full ? t('quotaFull') : t('quotaLeft', {count: quota.remaining})}</p>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      <button type="button" className="button primary" disabled={busy || full || chosen.size === 0} onClick={() => void create()}>
        {t('add', {count: chosen.size})}
      </button>
    </>}
  </section>;
}
