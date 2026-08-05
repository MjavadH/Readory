export const locales = [
  {
    code: 'en',
    locale: 'en-US',
    name: 'English',
    nativeName: 'English',
    isRTL: false,
    flag: '/flags/en.svg',
  },
  {
    code: 'fa',
    locale: 'fa-IR',
    name: 'Persian',
    nativeName: 'فارسی',
    isRTL: true,
    flag: '/flags/fa.svg',
  },
] as const;

export type LocaleConfig = (typeof locales)[number];
export type SupportedLocale = LocaleConfig['code'];
export type LocaleDirection = 'ltr' | 'rtl';

export const defaultLocale = locales[0].code satisfies SupportedLocale;

const localeConfigByCode = new Map<string, LocaleConfig>(
  locales.map((locale) => [locale.code, locale]),
);

export function getSupportedLocales(): readonly LocaleConfig[] {
  return locales;
}

export function isSupportedLocale(locale: string | null | undefined): locale is SupportedLocale {
  return typeof locale === 'string' && localeConfigByCode.has(locale);
}

export function getLocaleConfig(locale: string | null | undefined): LocaleConfig {
  if (isSupportedLocale(locale)) {
    return localeConfigByCode.get(locale)!;
  }

  return localeConfigByCode.get(defaultLocale)!;
}

export function isRTL(locale: string | null | undefined): boolean {
  return getLocaleConfig(locale).isRTL;
}

export function getDirection(locale: string | null | undefined): LocaleDirection {
  return isRTL(locale) ? 'rtl' : 'ltr';
}
