
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReactNode } from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { Vazirmatn} from "next/font/google";
import "@/styles/globals.css";
import {getLocale, getMessages} from "next-intl/server";
import {NextIntlClientProvider} from "next-intl";

const vazirmatn = Vazirmatn({
    subsets: ['latin', 'arabic'],
    variable: '--font-vazirmatn',
})

export default async function Layout({ children }: { children: ReactNode }) {
    const locale = await getLocale();
    const messages = await getMessages();
    return (
        <html lang={locale} suppressHydrationWarning>
        <body className={`${vazirmatn.variable} font-sans`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <ToastProvider>
                    <DashboardLayout>
                        {children}
                    </DashboardLayout>
                </ToastProvider>
            </ThemeProvider>
        </NextIntlClientProvider>
        </body>
        </html>
    );
}
