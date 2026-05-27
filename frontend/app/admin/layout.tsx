import { getMessages, getLocale } from 'next-intl/server';
import { AdminLayoutClient } from './AdminLayoutClient';
import { Vazirmatn } from 'next/font/google'
import "@/styles/globals.css";

const vazirmatn = Vazirmatn({
    subsets: ['latin', 'arabic'],
    variable: '--font-vazirmatn',
})
export default async function AdminLayout({children}: { children: React.ReactNode; }) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
        <body className={`${vazirmatn.variable} font-sans`}>
        <AdminLayoutClient locale={locale} messages={messages}>
            {children}
        </AdminLayoutClient>
        </body>
        </html>
    );
}