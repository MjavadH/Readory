'use client';

import React, { useEffect, useState } from 'react';
import {notFound, useRouter} from 'next/navigation';
import { AdminSidebar } from "@/components/admin-sidebar";
import { Loader2 } from "lucide-react";
import { Inter } from "next/font/google";
import "../globals.css";
import { AuthProvider, useAuth } from "@/providers/auth-provider";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <AuthProvider>
                <AdminContent>{children}</AdminContent>
                <Toaster />
            </AuthProvider>
        </ThemeProvider>
        </body>
        </html>
    );
}