"use client";

import { Globe, Link2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { CollectionVisibility } from "@/lib/collection-types";

const config: Record<
    CollectionVisibility,
    { icon: typeof Globe; className: string }
> = {
    PUBLIC: {
        icon: Globe,
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    UNLISTED: {
        icon: Link2,
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    PRIVATE: {
        icon: Lock,
        className: "bg-muted text-muted-foreground",
    },
};

export function CollectionVisibilityBadge({
    visibility,
    className,
    iconOnly = false,
}: {
    visibility: CollectionVisibility;
    className?: string;
    iconOnly?: boolean;
}) {
    const t = useTranslations("Collections");
    const { icon: Icon, className: tone } = config[visibility];
    const label = t(`Visibility.${visibility}` as never);

    return (
        <span
            title={iconOnly ? label : undefined}
            className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
                tone,
                className,
            )}
        >
            <Icon aria-hidden className="size-3.5" />
            {iconOnly ? <span className="sr-only">{label}</span> : label}
        </span>
    );
}
