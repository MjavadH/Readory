import type { Metadata } from 'next';
import { Vazirmatn } from 'next/font/google';
import '@/styles/globals.css';
import { ToastProvider } from '@/providers/toast-provider';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import { getLocale, getMessages } from 'next-intl/server';
import { getDirection, getLocaleConfig } from '@/i18n/locales';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  title: 'Readory',
  description: 'Your favorite book library',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const localeInfo = getLocaleConfig(locale);
  return (
    <html lang={localeInfo.locale} dir={getDirection(localeInfo.code)} suppressHydrationWarning>
      <body className={`${vazirmatn.className} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
