'use client';
import {useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {Assessment, Attempt, FeedbackLanguage, RewriteChecks} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {ResultView} from './result';
import {SubmitDialog} from './submit-dialog';
import {ChartView} from './chart-view';
import {taskRules} from '../lib/writing';

const POLL_MS = 2500;
/** After this long the page stops polling and says the result will appear later. */
const PATIENCE_MS = 5 * 60000;

/** A submitted essay: waiting for the assessment, its failure, or the feedback. */
export function AssessmentView({attempt, assessment, examName, remaining, limit, feedbackLanguage, practiceSkills = [], rewriteChecks}: {
  attempt: Attempt; assessment: Assessment | null; examName: string; remaining: number; limit: number; feedbackLanguage: FeedbackLanguage;
  /** P4.8: skills the bank can train; their fix groups get a practice button. */
  practiceSkills?: string[];
  /** P4.14: AI checks in «Fix it yourself» (off or absent: the self-check stays as it was). */
  rewriteChecks?: RewriteChecks;
}) {
  const t = useTranslations('Assessment');
  const waiting = !assessment || assessment.status === 'queued' || assessment.status === 'running';
  const result = assessment && (assessment.status === 'assessed' || assessment.status === 'partial') ? assessment.result : null;

  return <section className="page result-page">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <header className="result-head">
      <p className="eyebrow">{examName} · {attempt.task_key === 'task-1' ? 'Writing Task 1' : 'Writing Task 2'}</p>
      <h1>{attempt.topic ?? t('ownTask')}</h1>
    </header>
    {/* A report is checked against its data: the chart and its table stay at hand next to the feedback. */}
    {attempt.prompt.stimulus && <details className="task-details">
      <summary>{t('showTask')}</summary>
      <p className="prompt-text">{attempt.prompt.text}</p>
      <ChartView spec={attempt.prompt.stimulus}/>
    </details>}
    {waiting ? <Waiting uuid={attempt.uuid} since={assessment?.created_at ?? attempt.submitted_at}/>
      : assessment && result ? <ResultView attempt={attempt} assessment={{...assessment, result}} practiceSkills={practiceSkills} rewriteChecks={rewriteChecks}/>
      : <div className="notice-block" role="alert">
        <h2>{t('failedTitle')}</h2>
        <p>{t('failedBody')}</p>
        <SubmitDialog uuid={attempt.uuid} words={attempt.word_count ?? 0} minWords={taskRules(attempt.task_key).minWords} remaining={remaining} limit={limit}
          feedbackLanguage={feedbackLanguage} label={t('retry')}/>
        <details className="essay-details"><summary>{t('showEssay')}</summary>
          <div className="essay-readonly" lang="en">{attempt.response_text}</div>
        </details>
      </div>}
  </section>;
}

function Waiting({uuid, since}: {uuid: string; since: string | null}) {
  const t = useTranslations('Assessment');
  const router = useRouter();
  const started = since ? Date.parse(since) : NaN;
  const [now, setNow] = useState(() => Date.now());
  const [base] = useState(() => (Number.isNaN(started) ? Date.now() : started));
  const elapsed = Math.max(0, now - base);
  const patient = elapsed < PATIENCE_MS;

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!patient) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const result = await bff<{assessment: Assessment}>(`attempts/${uuid}/assessment`);
      if (stop) return;
      if (result.ok && !['queued', 'running'].includes(result.data.assessment.status)) {
        router.refresh();
        return;
      }
      timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [uuid, router, patient]);

  const seconds = Math.floor(elapsed / 1000);
  return <div className="waiting" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true"/>
    <div>
      <h2>{patient ? t('waitingTitle') : t('slowTitle')}</h2>
      <p>{patient ? t('waitingBody') : t('slowBody')}</p>
      <p className="hint">{t('elapsed', {seconds})}</p>
    </div>
  </div>;
}
