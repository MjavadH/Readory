import { motion } from "framer-motion";
import { Contrast, Maximize, RefreshCcw } from "lucide-react";
interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onAction: (action: string) => void;
}

export function ReaderContextMenu({ x, y, onClose, onAction }: ContextMenuProps) {
    return (
        <>
            {/* Backdrop to close menu on click outside */}
            <div className="fixed inset-0 z-100" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="fixed z-101 min-w-40 overflow-hidden rounded-xl border border-border bg-background/95 p-1 shadow-2xl backdrop-blur-md"
                style={{ top: y, left: x }}
            >
                <ContextItem icon={<Maximize size={16} />} label="Full Screen" onClick={() => onAction('fullscreen')} />
                <ContextItem icon={<RefreshCcw size={16} />} label="Reload Page" onClick={() => onAction('reload')} />
                <div className="my-1 h-px bg-border/50" />
                <ContextItem icon={<Contrast size={16} />} label='Contrast' onClick={() => onAction('contrast')}/>
            </motion.div>
        </>
    );
}

function ContextItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
        >
            {icon}
            {label}
        </button>
    );
}