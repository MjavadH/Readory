"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {useTranslations} from "next-intl";
import {useLocaleInfo} from "@/hooks/use-locale-info";

type ThemeVariant = "desktop" | "mobile" | "sidebar"

interface ThemeSwitcherProps {
    variant?: ThemeVariant
}

export function ThemeSwitcher({variant = "desktop"}: ThemeSwitcherProps) {
    const t = useTranslations('General');
    const { theme, setTheme } = useTheme()
    const { isRTL } = useLocaleInfo()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => setMounted(true), [])
    if (!mounted) return null

    const options = [
        { value: "light", icon: Sun, label: t("Light") },
        { value: "dark", icon: Moon, label: t("Dark") },
        { value: "system", icon: Monitor, label: t("System") },
    ] as const

    // Mobile Segmented Variant
    if (variant === "mobile") {
        return (
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                {options.map((opt) => {
                    const Icon = opt.icon
                    const active = theme === opt.value
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTheme(opt.value)}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                                active
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        )
    }

    //Sidebar Variant
    if (variant === "sidebar") {
        const CurrentIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor

        return (
            <DropdownMenu dir={isRTL ? "rtl" : "ltr"}>
                <DropdownMenuTrigger dir={isRTL ? "rtl" : "ltr"} asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-full justify-between gap-2 px-2 text-sm font-medium hover:bg-accent"
                        title={t("Theme")}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <CurrentIcon className="h-4 w-4 shrink-0 opacity-70" />
                            <span className="truncate">{t("Theme")}</span>
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" sideOffset={8} className="grid w-56 gap-1 grid-cols-2 p-1">
                    {options.map((opt) => {
                        const Icon = opt.icon
                        const active = theme === opt.value
                        return (
                            <DropdownMenuItem
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className={cn(
                                    "cursor-pointer last:col-span-2 rounded-md text-sm justify-center",
                                    active && "bg-accent font-semibold"
                                )}
                            >
                                <Icon className="h-4 w-4 opacity-80" />
                                {opt.label}
                            </DropdownMenuItem>
                        )
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    // Default Variant
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative h-9 w-9"
                    aria-label="Toggle theme"
                >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? "start" : "end"} className="grid w-56 gap-1 grid-cols-2 p-1">
                {options.map((opt) => {
                    const Icon = opt.icon
                    return (
                        <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setTheme(opt.value)}
                            className={cn(
                                "cursor-pointer last:col-span-2 rounded-md text-sm justify-center",
                                theme === opt.value && "bg-accent")}
                        >
                            <Icon className="me-2 h-4 w-4 opacity-80" />
                            {opt.label}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}