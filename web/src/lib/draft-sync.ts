'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {Attempt, AttemptSummary} from './api/schemas';
import {bff} from './bff-client';
import {localDraftPrefix} from './local-drafts';

/*
 * Draft autosave (K §3.2: a closed tab or a reload never loses text).
 * - Every change goes to a browser copy at once (`exams:draft:<uuid>`), removed on submit, deletion and sign-out.
 * - The server copy is saved after a short pause in typing, with the revision it was based on; the backend
 *   rejects a stale revision, so two tabs never overwrite each other silently.
 * - Without a connection the editor keeps working and retries; `beforeunload` warns while anything is unsaved.
 */

export type SyncState = 'saved' | 'pending' | 'saving' | 'offline' | 'conflict' | 'expired' | 'locked' | 'too_long';
export type Conflict = {serverText: string; serverRevision: number};

const IDLE_MS = 1500;
const MAX_WAIT_MS = 10000;
const RETRY_MS = [3000, 6000, 12000, 30000];

export const localDraftKey = (uuid: string) => `${localDraftPrefix}${uuid}`;

type LocalCopy = {text: string; base: number};

function readLocal(uuid: string): LocalCopy | null {
  try {
    const value = JSON.parse(localStorage.getItem(localDraftKey(uuid)) ?? 'null') as LocalCopy | null;
    return value && typeof value.text === 'string' && Number.isInteger(value.base) ? value : null;
  } catch {
    return null;
  }
}

function writeLocal(uuid: string, copy: LocalCopy) {
  try {
    localStorage.setItem(localDraftKey(uuid), JSON.stringify(copy));
  } catch {
    // Storage full or disabled: the server copy still protects the text.
  }
}

export function forgetLocalDraft(uuid: string) {
  try {
    for (const key of Object.keys(localStorage)) if (key === localDraftKey(uuid) || key.startsWith(`${localDraftKey(uuid)}:`)) localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}

export function useDraftSync(uuid: string, initialText: string, initialRevision: number) {
  const [text, setTextState] = useState(initialText);
  const [state, setState] = useState<SyncState>('saved');
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const textRef = useRef(initialText);
  const savedRef = useRef(initialText);
  const revisionRef = useRef(initialRevision);
  const inFlight = useRef<Promise<void> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPending = useRef<number | null>(null);
  const retries = useRef(0);
  const stopped = useRef(false);
  // `save` re-runs itself (retries, text typed while saving) through this ref.
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const clearTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };

  const save = useCallback(async (): Promise<void> => {
    clearTimer();
    if (stopped.current) return;
    if (inFlight.current) {
      await inFlight.current;
      if (textRef.current !== savedRef.current) return saveRef.current();
      return;
    }
    const sending = textRef.current;
    if (sending === savedRef.current) {
      setState('saved');
      firstPending.current = null;
      return;
    }
    setState('saving');
    const run = (async () => {
      const result = await bff<{attempt: AttemptSummary}>(`attempts/${uuid}/draft`, {method: 'PUT', body: {expected_revision: revisionRef.current, response_text: sending}});
      if (result.ok) {
        retries.current = 0;
        revisionRef.current = result.data.attempt.revision;
        savedRef.current = sending;
        writeLocal(uuid, {text: textRef.current, base: revisionRef.current});
        if (textRef.current === sending) {
          firstPending.current = null;
          setState('saved');
        } else {
          // Typed while saving: save the rest after the next pause.
          setState('pending');
          idleTimer.current ??= setTimeout(() => void saveRef.current(), IDLE_MS);
        }
        return;
      }
      if (result.error === 'exams_revision_conflict') {
        const fresh = await bff<{attempt: Attempt}>(`attempts/${uuid}`);
        if (fresh.ok) {
          setConflict({serverText: fresh.data.attempt.response_text, serverRevision: fresh.data.attempt.revision});
          setState('conflict');
          stopped.current = true;
          return;
        }
      }
      if (result.error === 'exams_attempt_not_editable') {
        stopped.current = true;
        setState('locked');
        return;
      }
      if (result.error === 'unauthenticated' || result.status === 401) {
        stopped.current = true;
        setState('expired');
        return;
      }
      if (result.error === 'exams_response_too_long') {
        setState('too_long');
        return;
      }
      // Network, rate limit or a temporary backend failure: keep the text, retry later.
      setState('offline');
      const delay = RETRY_MS[Math.min(retries.current, RETRY_MS.length - 1)];
      retries.current++;
      idleTimer.current = setTimeout(() => void saveRef.current(), result.retryAfter ? result.retryAfter * 1000 : delay);
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, [uuid]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const schedule = useCallback(() => {
    const now = Date.now();
    firstPending.current ??= now;
    clearTimer();
    const wait = Math.max(0, Math.min(IDLE_MS, firstPending.current + MAX_WAIT_MS - now));
    idleTimer.current = setTimeout(() => void save(), wait);
  }, [save]);

  const setText = useCallback((value: string) => {
    textRef.current = value;
    setTextState(value);
    writeLocal(uuid, {text: value, base: revisionRef.current});
    if (stopped.current) return;
    setState(current => (current === 'offline' ? 'offline' : 'pending'));
    schedule();
  }, [schedule, uuid]);

  /** Keep this browser's text (overwrites the newer server copy) or take the server's. */
  const resolveConflict = useCallback((choice: 'mine' | 'theirs') => {
    if (!conflict) return;
    revisionRef.current = conflict.serverRevision;
    stopped.current = false;
    setConflict(null);
    if (choice === 'theirs') {
      textRef.current = conflict.serverText;
      savedRef.current = conflict.serverText;
      setTextState(conflict.serverText);
      writeLocal(uuid, {text: conflict.serverText, base: conflict.serverRevision});
      setState('saved');
      return;
    }
    savedRef.current = conflict.serverText;
    writeLocal(uuid, {text: textRef.current, base: conflict.serverRevision});
    void save();
  }, [conflict, save, uuid]);

  // On open: a newer browser copy (unsaved edits) is restored; one based on an older revision is a conflict.
  useEffect(() => {
    const local = readLocal(uuid);
    if (!local || local.text === initialText) {
      writeLocal(uuid, {text: initialText, base: initialRevision});
      return;
    }
    textRef.current = local.text;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTextState(local.text);
    if (local.base === initialRevision) {
      setState('pending');
      void save();
    } else {
      stopped.current = true;
      setConflict({serverText: initialText, serverRevision: initialRevision});
      setState('conflict');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const online = () => {
      retries.current = 0;
      if (!stopped.current && textRef.current !== savedRef.current) void save();
    };
    const leave = (event: BeforeUnloadEvent) => {
      if (textRef.current !== savedRef.current) event.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('beforeunload', leave);
      clearTimer();
    };
  }, [save]);

  /** Saves now and tells whether the server has exactly this text (needed before submitting). */
  const saveNow = useCallback(async () => {
    if (stopped.current) return false;
    await save();
    return !stopped.current && textRef.current === savedRef.current;
  }, [save]);

  return {text, setText, state, conflict, resolveConflict, saveNow};
}
