import {getFormatter, getTranslations} from 'next-intl/server';
import {Link} from '../i18n/navigation';
import type {AttemptSummary} from '../lib/api/schemas';
import {attemptState} from '../lib/attempt-state';

export {attemptState};

export async function AttemptList({attempts, locale}: {attempts: AttemptSummary[]; locale: string}) {
  const t = await getTranslations({locale, namespace: 'Writing'});
  const format = await getFormatter({locale});
  return <ul className="attempts">
    {attempts.map(attempt => {
      const state = attemptState(attempt);
      const when = attempt.updated_at ?? attempt.created_at;
      return <li key={attempt.uuid}>
        <Link href={`/ielts/writing/${attempt.uuid}`} className="attempt">
          <span className="attempt-title">{attempt.topic ?? t('ownTask')}</span>
          <span className="attempt-meta">
            <span className={`badge ${state}`}>{t(`states.${state}`)}</span>
            <span>{t('words', {count: attempt.word_count ?? 0})}</span>
            {when && <time dateTime={when}>{format.dateTime(new Date(when), {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}</time>}
          </span>
        </Link>
      </li>;
    })}
  </ul>;
}
