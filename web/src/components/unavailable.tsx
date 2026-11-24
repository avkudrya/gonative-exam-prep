import {getTranslations} from 'next-intl/server';

/** Shown instead of a member page when the backend cannot be reached. */
export async function Unavailable({locale}: {locale: string}) {
  const t = await getTranslations({locale, namespace: 'App'});
  return <section className="notice-page" role="alert"><h1>{t('unavailableTitle')}</h1><p>{t('unavailableBody')}</p></section>;
}
