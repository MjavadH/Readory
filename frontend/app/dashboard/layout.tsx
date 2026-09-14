import { Vazirmatn } from 'next/font/google';
import type { ReactNode } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import '@/styles/globals.css';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { getDirection, getLocaleConfig } from '@/i18n/locales';
import { AuthProvider } from '@/providers/auth-provider';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});

// Block search engine indexing for user dashboard
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Layout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const localeInfo = getLocaleConfig(locale);
  return (
    <html lang={localeInfo.locale} dir={getDirection(localeInfo.code)} suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <ToastProvider>
                <DashboardLayout>{children}</DashboardLayout>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
