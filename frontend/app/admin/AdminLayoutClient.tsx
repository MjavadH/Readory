'use client';

import { notFound } from 'next/navigation';
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';

function AdminContent({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return notFound();
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <AdminSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto bg-muted/20">
                    {children}
                </main>
            </div>
        </div>
    );
}

export function AdminLayoutClient({children, locale, messages,}: {
    children: React.ReactNode;
    locale: string;
    messages: AbstractIntlMessages;
}) {
    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <AuthProvider>
                    <AdminContent>
                        <ToastProvider>
                            {children}
                        </ToastProvider>
                    </AdminContent>
                </AuthProvider>
            </ThemeProvider>
        </NextIntlClientProvider>
    );
}