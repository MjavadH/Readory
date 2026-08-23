import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import '@/styles/globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { GoogleOneTap } from '@/components/auth/google-one-tap';
import { UserHeader } from '@/components/header/user-header';
import { UserFooter } from '@/components/user-footer';
import { getDirection, getLocaleConfig } from '@/i18n/locales';
import { GoogleAuthProvider } from '@/providers/google-auth-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  title: 'Readory',
  description: 'Your favorite book library',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
            <UserHeader />

            <main className="min-h-screen">
              <ToastProvider>
                <GoogleAuthProvider>
                  <GoogleOneTap />
                  {children}
                </GoogleAuthProvider>
              </ToastProvider>
            </main>
            <UserFooter />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
