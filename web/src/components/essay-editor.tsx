'use client';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {Attempt} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {forgetLocalDraft, useDraftSync} from '../lib/draft-sync';
import {MAX_ESSAY_CHARS, TASK2_MIN_WORDS, TASK2_MINUTES, wordsIn} from '../lib/writing';
import {EssayTimer} from './essay-timer';
import {SubmitDialog} from './submit-dialog';

export function EssayEditor({attempt, examName, remaining, limit, feedbackLanguage}: {
  attempt: Attempt; examName: string; remaining: number; limit: number; feedbackLanguage: 'en' | 'ru';
}) {
  const t = useTranslations('Editor');
  const router = useRouter();
  const draft = useDraftSync(attempt.uuid, attempt.response_text, attempt.revision);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const words = wordsIn(draft.text);
  const chars = Array.from(draft.text).length;

  async function remove() {
    setDeleting(true);
    setDeleteError('');
    const result = await bff(`attempts/${attempt.uuid}`, {method: 'DELETE'});
    if (!result.ok && result.status !== 404) {
      setDeleting(false);
      setDeleteError(t('deleteFailed'));
      return;
    }
    forgetLocalDraft(attempt.uuid);
    router.replace('/ielts/writing');
    router.refresh();
  }

  return <section className="page editor">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <article className="prompt-card" aria-labelledby="prompt-title">
      <div className="prompt-meta">
        <span>{examName} · {t('task')}</span>
        {attempt.source === 'library' ? <span className="badge">{t('unofficial')}</span> : <span className="badge">{t('ownTask')}</span>}
      </div>
      <h1 id="prompt-title" className="prompt-title">{attempt.topic ?? t('ownTask')}</h1>
      <p className="prompt-text">{attempt.prompt.text}</p>
      <p className="hint">{t('instructions', {minutes: TASK2_MINUTES, words: TASK2_MIN_WORDS})}</p>
    </article>

    <div className="editor-bar">
      <span className="word-count" aria-live="polite">{t('wordCount', {count: words})}</span>
      <EssayTimer uuid={attempt.uuid} minutes={TASK2_MINUTES}/>
      <span className={`sync ${draft.state}`} role="status">{t(`sync.${draft.state}`)}</span>
    </div>

    {draft.conflict && <div className="conflict" role="alert">
      <p>{t('conflict.body')}</p>
      <div className="actions">
        <button type="button" className="button" onClick={() => draft.resolveConflict('mine')}>{t('conflict.mine')}</button>
        <button type="button" className="button" onClick={() => draft.resolveConflict('theirs')}>{t('conflict.theirs')}</button>
      </div>
    </div>}
    {draft.state === 'expired' && <p className="feedback error" role="alert">
      {t('expired')} <Link href={{pathname: '/login', query: {next: `/ielts/writing/${attempt.uuid}`}}}>{t('signInAgain')}</Link>
    </p>}
    {draft.state === 'locked' && <p className="feedback error" role="alert">
      {t('locked')} <button type="button" className="text-button" onClick={() => router.refresh()}>{t('reload')}</button>
    </p>}

    <label className="sr-only" htmlFor="essay">{t('essayLabel')}</label>
    <textarea id="essay" className="essay" value={draft.text} lang="en" spellCheck={false} autoCorrect="off" autoCapitalize="sentences"
      readOnly={draft.state === 'locked' || draft.state === 'expired'} placeholder={t('placeholder')}
      onChange={event => draft.setText(event.target.value)} aria-describedby="essay-hint"/>
    <p className="hint" id="essay-hint">
      {words < TASK2_MIN_WORDS ? t('underMinimum', {words: TASK2_MIN_WORDS}) : t('overMinimum')}
      {chars > MAX_ESSAY_CHARS && <> {t('tooLong', {max: MAX_ESSAY_CHARS})}</>}
    </p>

    <div className="editor-actions">
      <SubmitDialog uuid={attempt.uuid} words={words} remaining={remaining} limit={limit} feedbackLanguage={feedbackLanguage}
        beforeSubmit={draft.saveNow}/>
      {confirmDelete ? <div className="confirm" role="group" aria-label={t('deleteDraft')}>
        <span>{t('deleteConfirm')}</span>
        <button type="button" className="button danger" disabled={deleting} onClick={() => void remove()}>{t('deleteYes')}</button>
        <button type="button" className="button" onClick={() => setConfirmDelete(false)}>{t('cancel')}</button>
      </div> : <button type="button" className="text-button danger-text" onClick={() => setConfirmDelete(true)}>{t('deleteDraft')}</button>}
      {deleteError && <p className="feedback error" role="alert">{deleteError}</p>}
    </div>
  </section>;
}
