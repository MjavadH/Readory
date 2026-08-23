'use client';

import { useLocale } from 'next-intl';
import {
  getDirection,
  isRTL as getIsRTL,
  getLocaleConfig,
  type LocaleConfig,
  type LocaleDirection,
  type SupportedLocale,
} from '@/i18n/locales';

export type LocaleInfo = {
  locale: SupportedLocale;
  localeInfo: LocaleConfig;
  isRTL: boolean;
  direction: LocaleDirection;
};

export function useLocaleInfo(): LocaleInfo {
  const locale = useLocale();
  const localeInfo = getLocaleConfig(locale);

  return {
    locale: localeInfo.code,
    localeInfo,
    isRTL: getIsRTL(localeInfo.code),
    direction: getDirection(localeInfo.code),
  };
}
