
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReactNode } from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastProvider } from "@/providers/toast-provider";
import {Inter} from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
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
        </body>
        </html>
    );
}
