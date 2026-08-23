import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isSupportedLocale } from '@/i18n/locales';

export default getRequestConfig(async (params) => {
  const store = await cookies();
  const requestedLocale = params.locale || store.get('locale')?.value;
  const locale = isSupportedLocale(requestedLocale) ? requestedLocale : defaultLocale;
  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
