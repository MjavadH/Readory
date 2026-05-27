import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "@/styles/globals.css";
import { UserHeader } from "@/components/header/user-header";
import { UserFooter } from "@/components/user-footer";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import {NextIntlClientProvider} from "next-intl";
import {getLocale, getMessages} from "next-intl/server";

 const vazirmatn = Vazirmatn({
     subsets: ['latin', 'arabic'],
     variable: '--font-vazirmatn',
 })

export const metadata: Metadata = {
    title: "Readory",
    description: "Your favorite book library",
};

export default async function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
        <body className={`${vazirmatn.className} font-sans`}>
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
                        {children}
                    </ToastProvider>
                </main>
                <UserFooter />
            </ThemeProvider>
        </NextIntlClientProvider>
        </body>
        </html>
    );
}