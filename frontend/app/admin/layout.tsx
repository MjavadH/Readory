import { Vazirmatn } from 'next/font/google';
import { getLocale, getMessages } from 'next-intl/server';
import { AdminLayoutClient } from './AdminLayoutClient';
import '@/styles/globals.css';
import { getDirection, getLocaleConfig } from '@/i18n/locales';

const vazirmatn = Vazirmatn({
  subsets: ['latin', 'arabic'],
  variable: '--font-vazirmatn',
});
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const localeInfo = getLocaleConfig(locale);

  return (
    <html lang={localeInfo.locale} dir={getDirection(localeInfo.code)} suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans`}>
        <AdminLayoutClient locale={locale} messages={messages}>
          {children}
        </AdminLayoutClient>
      </body>
    </html>
  );
}
