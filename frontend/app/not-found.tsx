import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import '@/styles/globals.css';
import { UserHeader } from '@/components/header/user-header';
import { UserFooter } from '@/components/user-footer';
import { ThemeProvider } from '@/providers/theme-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getDirection, getLocaleConfig } from '@/i18n/locales';
import { NotFoundContent } from '@/components/not-found-content';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  title: 'Page Not Found | Readory',
  description: 'The requested page could not be found.',
};

// Global 404 error page component
export default async function NotFound() {
  const locale = await getLocale();
  const messages = await getMessages();
  const localeInfo = getLocaleConfig(locale);

  return (
    <html lang={localeInfo.locale} dir={getDirection(localeInfo.code)} suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans`} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <UserHeader />

            <main className="min-h-screen">
              <NotFoundContent />
            </main>
            <UserFooter />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
