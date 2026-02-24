import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

// Pre-defined color variants to ensure Tailwind generates the classes
const colorVariants = {
    blue: {
        card: "from-blue-500/5 to-blue-500/10",
        iconBg: "bg-blue-500/10 ring-blue-500/20",
        icon: "text-blue-600 dark:text-blue-500",
    },
    emerald: {
        card: "from-emerald-500/5 to-emerald-500/10",
        iconBg: "bg-emerald-500/10 ring-emerald-500/20",
        icon: "text-emerald-600 dark:text-emerald-500",
    },
    amber: {
        card: "from-amber-500/5 to-amber-500/10",
        iconBg: "bg-amber-500/10 ring-amber-500/20",
        icon: "text-amber-600 dark:text-amber-500",
    },
    red: {
        card: "from-red-500/5 to-red-500/10",
        iconBg: "bg-red-500/10 ring-red-500/20",
        icon: "text-red-600 dark:text-red-500",
    },
    green: {
        card: "from-green-500/5 to-green-500/10",
        iconBg: "bg-green-500/10 ring-green-500/20",
        icon: "text-green-600 dark:text-green-500",
    },
    violet: {
        card: "from-violet-500/5 to-violet-500/10",
        iconBg: "bg-violet-500/10 ring-violet-500/20",
        icon: "text-violet-600 dark:text-violet-500",
    },
};

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    color?: keyof typeof colorVariants;
    className?: string;
    indicator?: React.ReactNode;
    animationDelay?: number;
}

export function StatCard({title, value, icon: Icon, color = "blue", className, indicator, animationDelay = 0}: StatCardProps) {
    const styles = colorVariants[color] || colorVariants.blue;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: animationDelay, duration: 0.35 }}
            >
            <Card className={cn("border-border/50 bg-linear-to-br", styles.card, className)}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex items-center gap-4">
                        <div
                            className={cn(
                                "flex size-12 items-center justify-center rounded-xl ring-1",
                                styles.iconBg
                            )}
                        >
                            <Icon className={cn("size-6", styles.icon)} />
                        </div>
                        <div>
                            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                                {title}
                            </p>
                            <p className="text-xl sm:text-2xl font-bold">{value}</p>
                        </div>
                    </div>
                    {indicator && <div>{indicator}</div>}
                </CardContent>
            </Card>
        </motion.div>
    );
}
