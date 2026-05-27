"use client"

import { useState, useTransition } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import irFlag from "../public/flags/fa.svg"
import enFlag from "../public/flags/en.svg"
import Image from "next/image"

const languages = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "fa", name: "فارسی", nativeName: "Persian" },
]

const flagMap: Record<string, string> = {
    en: enFlag,
    fa: irFlag,
}

interface LanguageSwitcherProps {
    variant?: "default" | "mobile" | "inline"
}

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null
    return null
}

export function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
    const currentLocale = getCookie("locale") || "en"
    const [isPending, startTransition] = useTransition()
    const [isOpen, setIsOpen] = useState(false)
    const currentLanguage = languages.find((lang) => lang.code === currentLocale)

    const handleLanguageChange = (newLocale: string) => {
        if (newLocale === currentLocale) return

        startTransition(() => {
            document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`
            window.location.reload()
        })
    }

    if (variant === "mobile") {
        return (
            <div className="flex flex-col gap-2 py-2">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        disabled={isPending}
                        className={cn(
                            "w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden group",
                            currentLocale === lang.code
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "text-foreground hover:bg-accent/50 active:bg-accent",
                            isPending && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {/* Background glow effect */}
                        {currentLocale === lang.code && (
                            <div className="absolute inset-0 bg-linear-to-r from-primary/0 via-primary/20 to-primary/0 animate-pulse" />
                        )}

                        <div className={cn(
                            "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                            currentLocale === lang.code
                                ? "bg-primary-foreground/20 shadow-sm"
                                : "bg-accent/50"
                        )}>
                            <Image
                                src={flagMap[lang.code]}
                                alt={lang.nativeName}
                                style={{ width: '24px', height: '18px', objectFit: 'cover' }}
                                className="rounded-sm"
                            />
                        </div>

                        <div className="relative flex-1 text-start">
                            <div className="font-semibold">{lang.name}</div>
                            <div className={cn(
                                "text-xs",
                                currentLocale === lang.code
                                    ? "text-primary-foreground/70"
                                    : "text-muted-foreground"
                            )}>
                                {lang.nativeName}
                            </div>
                        </div>

                        {currentLocale === lang.code && (
                            <div className="relative">
                                <Check className="h-5 w-5" />
                            </div>
                        )}
                    </button>
                ))}
            </div>
        )
    }

    if (variant === "inline") {
        return (
            <div className="flex items-center gap-2 p-1 rounded-lg bg-accent/50 border border-border">
                {languages.map((lang) => (
                    <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        disabled={isPending}
                        className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                            currentLocale === lang.code
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-foreground hover:bg-background/50",
                            isPending && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Image
                            src={flagMap[lang.code]}
                            alt={lang.nativeName}
                            style={{ width: '16px', height: '12px', objectFit: 'cover' }}
                            className="rounded-sm"
                        />
                        <span>{lang.code.toUpperCase()}</span>
                    </button>
                ))}
            </div>
        )
    }

    // Default dropdown variant
    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 relative h-10"
                    disabled={isPending}
                    aria-label="Change language"
                >
                    <div className="flex items-center gap-2">
                        {currentLanguage && (
                            <Image
                                src={flagMap[currentLanguage.code]}
                                alt={currentLanguage.nativeName}
                                style={{ width: '18px', height: '13px', objectFit: 'cover' }}
                                className="rounded-sm"
                            />
                        )}
                        <span className="hidden sm:inline text-sm font-medium">
                            {currentLanguage?.name || "Language"}
                        </span>
                    </div>
                    <ChevronDown className={cn(
                        "h-4 w-4 opacity-50 transition-transform duration-200",
                        isOpen && "rotate-180"
                    )} />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 rounded-lg p-1">
                {languages.map((lang) => (
                    <DropdownMenuItem
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        disabled={isPending}
                        className={cn(
                            "rounded-md px-3 py-2.5 cursor-pointer flex items-center gap-3 transition-all duration-150 relative group",
                            currentLocale === lang.code
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-accent/50"
                        )}
                    >
                        <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                            currentLocale === lang.code
                                ? "bg-primary/15"
                                : "bg-accent/30 group-hover:bg-accent/50"
                        )}>
                            <Image
                                src={flagMap[lang.code]}
                                alt={lang.nativeName}
                                style={{ width: '20px', height: '15px', objectFit: 'cover' }}
                                className="rounded-sm"
                            />
                        </div>

                        <div className="flex-1">
                            <div className="font-medium text-sm">{lang.name}</div>
                            <div className="text-xs text-muted-foreground">{lang.nativeName}</div>
                        </div>

                        {currentLocale === lang.code && (
                            <Check className="h-4 w-4 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
