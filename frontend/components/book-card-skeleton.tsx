import { cn } from "@/lib/utils";

interface BookCardSkeletonProps {
    className?: string;
}

export function BookCardSkeleton({ className }: BookCardSkeletonProps) {
    return (
        <div className={cn("flex flex-col", className)} aria-hidden="true">
            {/* Cover placeholder */}
            <div className="aspect-[2/3] w-full animate-pulse rounded-lg bg-muted" />
            {/* Text placeholders */}
            <div className="flex flex-col gap-1.5 px-0.5 pt-2.5">
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                <div className="flex gap-1.5 pt-0.5">
                    <div className="h-3 w-8 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-12 animate-pulse rounded-full bg-muted" />
                </div>
            </div>
        </div>
    );
}
