/*
 * An activation or reset token is scrubbed from the URL as soon as the page reads it. A language
 * switch must not lose it: it moves once, in browser memory only (no URL, cookie or storage).
 */
export const beforeLocaleChange = 'exams:before-locale-change';
type ProofMode = 'activate' | 'reset';
let pending: {mode: ProofMode; token: string; expires: number} | undefined;

export function transferProof(mode: ProofMode, token: string) {
  if (!token) return;
  const saved = {mode, token, expires: Date.now() + 30000};
  pending = saved;
  setTimeout(() => {
    if (pending === saved) pending = undefined;
  }, 30000);
}

export function takeTransferredProof(mode: ProofMode) {
  const saved = pending;
  pending = undefined;
  return saved?.mode === mode && saved.expires > Date.now() ? saved.token : '';
}
