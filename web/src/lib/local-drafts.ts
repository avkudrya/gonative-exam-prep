/** Browser copies of drafts (P3.3) live under this prefix and are removed on sign-out and data deletion. */
export const localDraftPrefix = 'exams:draft:';

export function clearLocalDrafts() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(localDraftPrefix)) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing was stored.
  }
}
