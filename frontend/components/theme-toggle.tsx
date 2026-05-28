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

type ThemeVariant = "desktop" | "mobile" | "sidebar"

interface ThemeSwitcherProps {
    variant?: ThemeVariant
    isCollapsed?: boolean
}

export function ThemeSwitcher({variant = "desktop", isCollapsed = false,}: ThemeSwitcherProps) {
    const t = useTranslations('General');
    const { theme, setTheme } = useTheme()
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
        const CurrentIcon =
            theme === "light" ? Sun : theme === "dark" ? Moon : Monitor

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size={isCollapsed ? "icon" : "default"}
                        className={cn(
                            "w-full hover:bg-sidebar-accent",
                            isCollapsed ? "justify-center" : "justify-start"
                        )}
                        title={isCollapsed ? "Change theme" : undefined}
                    >
                        <CurrentIcon className="h-4 w-4 shrink-0" />
                        {!isCollapsed && <span className="ml-2">{t("Theme")}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-40">
                    {options.map((opt) => {
                        const Icon = opt.icon
                        return (
                            <DropdownMenuItem
                                key={opt.value}
                                onClick={() => setTheme(opt.value)}
                                className="cursor-pointer"
                            >
                                <Icon className="me-2 h-4 w-4" />
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
            <DropdownMenuContent align="end" className="w-36">
                {options.map((opt) => {
                    const Icon = opt.icon
                    return (
                        <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setTheme(opt.value)}
                            className={cn(theme === opt.value && "bg-accent")}
                        >
                            <Icon className="me-2 h-4 w-4" />
                            {opt.label}
                        </DropdownMenuItem>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}