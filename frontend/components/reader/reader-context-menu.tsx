"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Contrast, Maximize, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAction: (action: string) => void;
}

const MENU_MARGIN = 8;

export function ReaderContextMenu({ x, y, onClose, onAction }: ContextMenuProps) {
    const t = useTranslations("Books");
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: x, top: y });

    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el) return;

        const { width, height } = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = x;
        let top = y;

        if (left + width + MENU_MARGIN > vw) left = Math.max(MENU_MARGIN, x - width);
        if (top + height + MENU_MARGIN > vh) top = Math.max(MENU_MARGIN, y - height);

        left = Math.min(Math.max(MENU_MARGIN, left), vw - width - MENU_MARGIN);
        top = Math.min(Math.max(MENU_MARGIN, top), vh - height - MENU_MARGIN);

        setPos({ left, top });
    }, [x, y]);

    return (
        <>
            {/* Backdrop to close menu on click outside */}
            <div
                className="fixed inset-0 z-100"
                onClick={onClose}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onClose();
                }}
            />

            <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.12 }}
                role="menu"
                className="toolbar-glass fixed z-101 min-w-44 overflow-hidden rounded-2xl border border-border p-1.5 shadow-2xl ring-1 ring-border/60"
                style={{ top: pos.top, left: pos.left }}
            >
                <ContextItem
                    icon={<Maximize className="h-4 w-4" />}
                    label={t("Fullscreen")}
                    onClick={() => onAction("fullscreen")}
                />
                <ContextItem
                    icon={<RefreshCcw className="h-4 w-4" />}
                    label={t("ReloadPage")}
                    onClick={() => onAction("reload")}
                />
                <div className="my-1 h-px bg-border/60" />
                <ContextItem
                    icon={<Contrast className="h-4 w-4" />}
                    label={t("Contrast")}
                    onClick={() => onAction("contrast")}
                />
            </motion.div>
        </>
    );
}

function ContextItem({
                         icon,
                         label,
                         onClick,
                     }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            role="menuitem"
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
        >
            <span className="shrink-0 text-muted-foreground">{icon}</span>
            {label}
        </button>
    );
}
