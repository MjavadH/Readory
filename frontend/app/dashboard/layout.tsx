import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ReactNode } from 'react';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import { Vazirmatn } from 'next/font/google';
import '@/styles/globals.css';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getDirection, getLocaleConfig } from '@/i18n/locales';
import { AuthProvider } from '@/providers/auth-provider';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});

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
