'use client';
import {useTranslations} from 'next-intl';
import {useState} from 'react';
import {Link} from '../i18n/navigation';
import type {Plan, Recommendation} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {PracticeButton} from './practice-button';

/**
 * P4.5: what to do next, from the learner's own feedback (ranked by the backend, at most four). Each step links to the
 * place where it is done; "Done" and "Hide" close it for good.
 */
export function NextSteps({initial}: {initial: Recommendation[]}) {
  const t = useTranslations('NextSteps');
  const r = useTranslations('Result');
  const [steps, setSteps] = useState(initial);
  const [error, setError] = useState('');
  const skillName = (skill: string | null) => (skill && r.has(`skills.${skill}`) ? r(`skills.${skill}`) : skill ?? '');

  async function close(uuid: string, action: 'done' | 'dismiss') {
    setError('');
    const result = await bff(`recommendations/${uuid}/${action}`, {body: {}});
    if (!result.ok) {
      setError(t('unavailable'));
      return;
    }
    setSteps(previous => previous.filter(s => s.uuid !== uuid));
  }

  const target = (s: Recommendation) => {
    if (s.kind === 'rewrite' && s.attempt) return `/ielts/writing/${s.attempt}#rewrite`;
    if (s.kind === 'vocabulary_list' && s.attempt) return `/ielts/writing/${s.attempt}#words`;
    return '/ielts/writing/new';
  };
  const text = (s: Recommendation) => {
    switch (s.kind) {
      case 'rewrite': return t('rewrite', {count: s.finding_ids.length});
      case 'vocabulary_list': return t('vocabulary', {count: s.words ?? 0});
      case 'practice': return t('practice', {skill: skillName(s.skill)});
      case 'new_essay': return s.practice_task?.topic ? t('newEssayTopic', {skill: skillName(s.skill), topic: s.practice_task.topic}) : t('newEssay', {skill: skillName(s.skill)});
      default: return t('reassess');
    }
  };

  return <section aria-labelledby="steps-title" className="next-steps">
    <h2 id="steps-title">{t('title')}</h2>
    {steps.length === 0 ? <p className="empty">{t('none')}</p> : <ol className="steps">
      {steps.map(s => <li key={s.uuid} className={`step ${s.kind}`}>
        <p>{text(s)}</p>
        <div className="step-actions">
          {s.kind === 'practice' && s.skill
            ? <PracticeButton skill={s.skill} attempt={s.attempt} className="button primary" label={t('open.practice')}/>
            : <Link className="button primary" href={target(s)}>{t(`open.${s.kind}`)}</Link>}
          <button type="button" className="text-button" onClick={() => void close(s.uuid, 'done')}>{t('done')}</button>
          <button type="button" className="text-button" onClick={() => void close(s.uuid, 'dismiss')}>{t('dismiss')}</button>
        </div>
      </li>)}
    </ol>}
    {error && <p className="feedback error" role="alert">{error}</p>}
  </section>;
}

/** P4.6: this week's plan, by code from the exam date, weekly minutes and the skill profile. */
export function WeekPlan({plan, weekLabel}: {plan: Plan; weekLabel: string}) {
  const t = useTranslations('NextSteps');
  const r = useTranslations('Result');
  const skillName = (skill: string) => (r.has(`skills.${skill}`) ? r(`skills.${skill}`) : skill);
  return <section aria-labelledby="plan-title" className="week-plan">
    <h2 id="plan-title">{t('planTitle', {week: weekLabel})}</h2>
    {plan.weeks_to_exam !== null && <p className="hint">{t('weeksToExam', {count: plan.weeks_to_exam})}</p>}
    <ul>
      <li>{plan.timed ? t('essaysTimed', {count: plan.essays}) : t('essays', {count: plan.essays})}</li>
      <li>{t('fixOwn')}</li>
      {plan.practice_sessions > 0 && <li>{t('practicePlan', {count: plan.practice_sessions, minutes: plan.practice_minutes, skills: plan.practice_skills.map(skillName).join(', ')})}</li>}
      {plan.daily_words && <li>{t('dailyWords')}</li>}
      <li>{t('reassessEvery', {count: plan.reassess_every_weeks})}</li>
    </ul>
    {plan.focus_skills.length > 0 && <p>{t('focus', {skills: plan.focus_skills.map(skillName).join(', ')})}</p>}
    {plan.weeks_to_exam === null && <p className="hint">{t('setDate')} <Link href="/settings">{t('settingsLink')}</Link></p>}
  </section>;
}
