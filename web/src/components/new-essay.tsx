'use client';
import {useTranslations} from 'next-intl';
import {useState, type FormEvent} from 'react';
import {Link, useRouter} from '../i18n/navigation';
import type {Attempt, PracticeTask} from '../lib/api/schemas';
import {bff} from '../lib/bff-client';
import {chartTypes, CUSTOM_PROMPT, customPromptProblem, taskTypes, type WritingTask} from '../lib/writing';
import {ChartView} from './chart-view';

const knownErrors = new Set(['exams_draft_limit', 'exams_custom_prompt_invalid', 'exams_custom_prompt_unavailable', 'exams_practice_task_unavailable', 'exams_task_unavailable', 'rate_limited', 'exams_rate_limited', 'unauthenticated']);

export function NewEssay({exams, exam, task: taskKey, taskKeys, tasks}: {
  exams: {key: string; name: string}[]; exam: string; task: WritingTask; taskKeys: WritingTask[]; tasks: PracticeTask[];
}) {
  const t = useTranslations('NewEssay');
  const router = useRouter();
  const report = taskKey === 'task-1';
  const [mode, setMode] = useState<'library' | 'own'>('library');
  const [type, setType] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [promptProblem, setPromptProblem] = useState<string | null>(null);
  const shown = type === 'all' ? tasks : tasks.filter(task => task.task_type === type);
  const known: readonly string[] = report ? chartTypes : taskTypes;
  const types = known.filter(value => tasks.some(task => task.task_type === value));

  async function create(source: {practice_task: string} | {custom_prompt: string}, key: string) {
    setBusy(key);
    setError('');
    const result = await bff<{attempt: Attempt}>('attempts', {body: {exam_key: exam, ...(report ? {task_key: taskKey} : {}), ...source}});
    if (!result.ok) {
      setBusy(null);
      setError(knownErrors.has(result.error) ? result.error : 'unavailable');
      return;
    }
    router.push(`/ielts/writing/${result.data.attempt.uuid}`);
  }

  function submitOwn(event: FormEvent) {
    event.preventDefault();
    const problem = customPromptProblem(prompt);
    setPromptProblem(problem);
    if (!problem) void create({custom_prompt: prompt}, 'own');
  }

  return <section className="page new-essay">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <h1>{t('title')}</h1>
    <nav className="segmented" aria-label={t('examLabel')}>
      {exams.map(item => <Link key={item.key} href={{pathname: '/ielts/writing/new', query: {exam: item.key, task: taskKey}}}
        aria-current={item.key === exam ? 'page' : undefined} replace>{item.name}</Link>)}
    </nav>
    {taskKeys.length > 1 && <nav className="segmented" aria-label={t('taskLabel')}>
      {taskKeys.map(key => <Link key={key} href={{pathname: '/ielts/writing/new', query: {exam, task: key}}}
        aria-current={key === taskKey ? 'page' : undefined} replace>{t(`tasks.${key}`)}</Link>)}
    </nav>}
    {/* A Task 1 visual has data that an own task cannot carry: only library tasks. */}
    {!report && <div className="tabs" role="tablist" aria-label={t('sourceLabel')}>
      {(['library', 'own'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={mode === value}
        id={`tab-${value}`} aria-controls={`panel-${value}`} onClick={() => setMode(value)}>{t(`modes.${value}`)}</button>)}
    </div>}
    {error && <p className="feedback error" role="alert">{t(`errors.${error}`)}</p>}
    {mode === 'library' || report ? <div id="panel-library" role={report ? undefined : 'tabpanel'} aria-labelledby={report ? undefined : 'tab-library'}>
      <p className="hint">{t(report ? 'libraryHintReport' : 'libraryHint')}</p>
      {types.length > 1 && <div className="chips" role="group" aria-label={t('typeLabel')}>
        {(['all', ...types] as const).map(value => <button key={value} type="button" aria-pressed={type === value}
          onClick={() => setType(value)}>{t(`types.${value}`)}</button>)}
      </div>}
      {shown.length ? <ul className={`tasks${report ? ' chart-tasks' : ''}`}>
        {shown.map(task => <li key={task.uuid} className="task">
          <div className="task-head">
            <span className="badge">{t(`types.${known.includes(task.task_type) ? task.task_type : report ? 'otherReport' : 'other'}`)}</span>
            <span className="task-topic">{task.topic}</span>
          </div>
          {task.prompt.stimulus && <ChartView spec={task.prompt.stimulus} compact/>}
          <p className="task-prompt">{task.prompt.text}</p>
          <button type="button" className="button" disabled={busy !== null}
            onClick={() => void create({practice_task: task.uuid}, task.uuid)}>
            {busy === task.uuid ? t('creating') : t(report ? 'writeReport' : 'write')}
          </button>
        </li>)}
      </ul> : <p className="empty">{t(report ? 'noTasksReport' : 'noTasks')}</p>}
    </div> : <form id="panel-own" role="tabpanel" aria-labelledby="tab-own" onSubmit={submitOwn} className="own-task">
      <div className="field">
        <label htmlFor="own-prompt">{t('ownLabel')}</label>
        <textarea id="own-prompt" rows={6} value={prompt} maxLength={CUSTOM_PROMPT.max + 200} lang="en" spellCheck={false}
          aria-describedby="own-hint" aria-invalid={promptProblem ? true : undefined}
          onChange={event => { setPrompt(event.target.value); setPromptProblem(null); }}/>
        <p className="hint" id="own-hint">{t('ownHint', {min: CUSTOM_PROMPT.min, max: CUSTOM_PROMPT.max})}</p>
      </div>
      {promptProblem && <p className="feedback error" role="alert">{t(`promptProblems.${promptProblem}`)}</p>}
      <button className="button primary" disabled={busy !== null}>{busy === 'own' ? t('creating') : t('startOwn')}</button>
    </form>}
  </section>;
}
