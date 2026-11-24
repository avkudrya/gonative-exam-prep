import type {AttemptSummary} from './api/schemas';

/** Status shown to the person: a draft, waiting for feedback, feedback ready, or a problem. */
export function attemptState(attempt: Pick<AttemptSummary, 'status'>): 'draft' | 'assessing' | 'ready' | 'partial' | 'failed' {
  if (attempt.status === 'draft') return 'draft';
  if (attempt.status === 'assessed') return 'ready';
  if (attempt.status === 'partial') return 'partial';
  if (attempt.status === 'failed') return 'failed';
  return 'assessing';
}
