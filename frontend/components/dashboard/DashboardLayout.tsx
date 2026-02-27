
"use client";

import { Sidebar } from "./Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import {ReactNode, useEffect} from "react";
import { Search, Menu } from "lucide-react";
import { useState } from "react";
import {apiClient} from "@/lib/api-client";
import {UserProfile} from "@/lib/types";

interface DashboardLayoutProps {
    children: ReactNode;
}

function initialsFromUsername(username: string) {
    const safe = (username || "").trim()
    if (!safe) return "U"
    return safe.slice(0, 2).toUpperCase()
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [profileLoading, setProfileLoading] = useState(true)

    useEffect(() => {
        const ac = new AbortController()
        const loadProfile = async () => {
            setProfileLoading(true)
            try {
                const data = await apiClient.get<UserProfile>("/auth/profile", { signal: ac.signal })
                if (!data.username) { setProfile(null); return }
                setProfile(data)
            } catch {
                setProfile(null)
            } finally {
                setProfileLoading(false)
            }
        }
        void loadProfile()
        return () => ac.abort()
    }, [])

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex">
                <Sidebar />
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
                {/* Header */}
                <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden p-2 hover:bg-muted rounded-lg"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="relative group max-w-md hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search your library..."
                                className="pl-10 pr-4 py-2.5 bg-muted border border-transparent rounded-2xl w-full focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex">
                            {!profileLoading ? (
                                <span className="text-sm font-semibold tracking-tight">
                                    {profile?.username}
                                </span>
                            ) : (
                                <div className="bg-muted h-5 rounded-xl w-32 animate-pulse" />
                            )}
                        </div>
                        <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-primary to-primary-foreground/30 flex items-center justify-center border-2 border-background shadow-lg overflow-hidden ring-4 ring-primary/5">
                            <p className="text-sm text-center text-muted">
                                {initialsFromUsername(profile?.username || "")}
                            </p>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 bg-background custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="max-w-[1400px] mx-auto"
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-card z-50 transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <Sidebar />
            </div>
        </div>
    );
}
