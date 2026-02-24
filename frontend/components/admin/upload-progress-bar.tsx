import { motion } from "framer-motion";

export function UploadProgressBar({ value }: { value: number }) {
    const clamped = Math.max(0, Math.min(100, value));
    return (
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-primary to-primary/70"
                initial={{ width: 0 }}
                animate={{ width: `${clamped}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            />
            <div className="absolute inset-0 rounded-full bg-linear-to-r from-transparent via-white/10 to-transparent animate-shimmer bg-size-[200%_100%]" />
        </div>
    );
}
