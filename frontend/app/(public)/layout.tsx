import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { UserHeader } from "@/components/user-header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Readory",
    description: "Your favorite book library",
};

export default function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en">
        <body className={inter.className}>
        <UserHeader />

        <main className="min-h-screen">
            {children}
        </main>

        </body>
        </html>
    );
}