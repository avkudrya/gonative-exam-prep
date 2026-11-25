import type {Metadata} from 'next';
import {getFormatter, getTranslations, setRequestLocale} from 'next-intl/server';
import {NextSteps, WeekPlan} from '../../../../../components/next-steps';
import {RangeChart} from '../../../../../components/range-chart';
import {Unavailable} from '../../../../../components/unavailable';
import {Link} from '../../../../../i18n/navigation';
import {requireMember} from '../../../../../server/access';
import {currentPlan, currentRecommendations, currentSkills} from '../../../../../server/session';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  return {title: (await getTranslations({locale, namespace: 'Progress'}))('title')};
}

const criteria = ['task_response', 'coherence_cohesion', 'lexical_resource', 'grammatical_range_accuracy'];
const band = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Progress (K): the criteria trend as approximate ranges and the most frequent problems by skill. */
export default async function Progress({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const member = await requireMember(locale, '/ielts/progress');
  if (member.unavailable) return <Unavailable locale={locale}/>;
  let data;
  try {
    data = await currentSkills();
  } catch {
    return <Unavailable locale={locale}/>;
  }
  // Next steps and the week are extras: the page stands without them if they cannot be loaded.
  const [steps, plan] = await Promise.all([currentRecommendations().catch(() => null), currentPlan().catch(() => null)]);
  const t = await getTranslations({locale, namespace: 'Progress'});
  const r = await getTranslations({locale, namespace: 'Result'});
  const format = await getFormatter({locale});
  const essays = data.criteria_trend.map(entry => ({
    label: entry.finished_at ? format.dateTime(new Date(entry.finished_at), {day: 'numeric', month: 'short'}) : '—',
    ranges: Object.fromEntries(entry.criteria.map(c => [c.criterion_key, c.estimate])),
  }));
  const issues = data.skills.filter(s => s.status !== 'ok');
  const skillName = (key: string) => (r.has(`skills.${key}`) ? r(`skills.${key}`) : key);

  return <section className="page progress">
    <Link className="back" href="/ielts/writing">{t('back')}</Link>
    <h1>{t('title')}</h1>
    {essays.length === 0 ? <div className="notice-block">
      <p>{t('empty')}</p>
      <Link className="button primary" href="/ielts/writing/new">{t('start')}</Link>
    </div> : <>
      {steps && <NextSteps initial={steps}/>}
      {plan && <WeekPlan plan={plan} weekLabel={format.dateTime(new Date(`${plan.week_start}T00:00:00Z`), {day: 'numeric', month: 'long', timeZone: 'UTC'})}/>}
      <p className="score-note">{t('note', {count: essays.length})}</p>
      <section aria-labelledby="trend-title">
        <h2 id="trend-title">{t('trendTitle')}</h2>
        <ul className="trend">
          {criteria.map(key => {
            const points = essays.map(e => ({label: e.label, range: e.ranges[key] ?? null}));
            const last = [...points].reverse().find(p => p.range)?.range;
            return <li key={key} className="trend-card">
              <h3>{r(`criteria.${key}`)}</h3>
              {last && <p className="range"><span className="range-value">≈ {band(last.low)}–{band(last.high)}</span><span className="range-note">{t('latest')}</span></p>}
              <RangeChart points={points} label={t('chartLabel', {criterion: r(`criteriaShort.${key}`)})}/>
            </li>;
          })}
        </ul>
        <details className="trend-table">
          <summary>{t('showTable')}</summary>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">{t('tableCaption')}</caption>
              <thead><tr><th scope="col">{t('essay')}</th>{criteria.map(key => <th key={key} scope="col">{r(`criteriaShort.${key}`)}</th>)}</tr></thead>
              <tbody>{essays.map((e, i) => <tr key={i}><th scope="row">{e.label}</th>{criteria.map(key => {
                const range = e.ranges[key];
                return <td key={key}>{range ? `${band(range.low)}–${band(range.high)}` : '—'}</td>;
              })}</tr>)}</tbody>
            </table>
          </div>
        </details>
      </section>
      <section aria-labelledby="skills-title">
        <h2 id="skills-title">{t('skillsTitle')}</h2>
        <p className="hint">{t('skillsHint')}</p>
        {issues.length === 0 ? <p className="empty">{t('noIssues')}</p> : <ul className="skills">
          {issues.map(skill => <li key={skill.skill_key} className={`skill ${skill.status}`}>
            <div className="skill-head">
              <span className="skill-name">{skillName(skill.skill_key)}</span>
              <span className={`badge ${skill.status === 'focus' ? 'error' : 'weakness'}`}>{t(`status.${skill.status}`)}</span>
            </div>
            <p>{t('rate', {rate: skill.per_100_words.toFixed(1)})}
              {skill.trend && <> · <span className={`trend-word ${skill.trend}`}>{t(`trends.${skill.trend}`)}</span></>}
              {skill.confidence === 'low' && <> · <span className="hint">{t('fewEssays')}</span></>}
            </p>
          </li>)}
        </ul>}
      </section>
    </>}
    <p className="progress-links"><Link href="/ielts/results">{t('resultsLink')}</Link></p>
  </section>;
}
