 import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { UserHeader } from "@/components/header/user-header";
import { UserFooter } from "@/components/user-footer";
 import { ThemeProvider } from "@/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Readory",
    description: "Your favorite book library",
};

export default function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            <UserHeader />

            <main className="min-h-screen">
                {children}
            </main>
            <UserFooter />
        </ThemeProvider>
        </body>
        </html>
    );
}