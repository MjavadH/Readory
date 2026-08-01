
"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {
    LayoutDashboard,
    Library,
    History,
    Settings,
    LogOut,
    BookHeart,
    BookOpenText,
    LucideHome,
    Grid2X2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {apiClient} from "@/lib/api-client";
import {BrandLogo} from "@/components/brand-logo";
import React from "react";
import {useTranslations} from "next-intl";

export function Sidebar() {
    const t = useTranslations('UserDashboard');
    const g = useTranslations('General');
    const pathname = usePathname();
    const router = useRouter()

    const navItems = [
        { name: t("Home"), href: "/", icon: LucideHome },
        { name: t("Overview"), href: "/dashboard", icon: LayoutDashboard },
        { name: t("Library"), href: "/dashboard/library", icon: Library },
        { name: t("ReadingProgress"), href: "/dashboard/reading_progress", icon: BookOpenText },
        { name: t("Favorites"), href: "/dashboard/favorites", icon: BookHeart },
        { name: t("Collections"), href: "/dashboard/collections", icon: Grid2X2 },
        { name: t("History"), href: "/dashboard/history", icon: History },
        { name: t("Settings"), href: "/dashboard/settings", icon: Settings },
    ];

    const handleLogout = async () => {
        try {
            await apiClient.post("/auth/logout")
        } finally {
            router.replace("/")
            router.refresh()
        }
    }

    return (
        <div className="flex flex-col h-full bg-card border-r border-border w-64">
            <div className="p-6 flex gap-2 items-center">
                <BrandLogo priority className="h-10 w-10" />
                <Link href="/" className="hover:opacity-80 transition-opacity">
                    <h1 className="text-2xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
                        {g("Readory")}
                    </h1>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group",
                                isActive
                                    ? "text-primary bg-primary/10 font-medium"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
                            <span>{item.name}</span>
                            {isActive && (
                                <motion.div
                                    className="absolute ltr:left-0 rtl:right-0 w-1 h-6 bg-primary rounded-r-full"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    <span>{g("Logout")}</span>
                </button>
            </div>
        </div>
    );
}
