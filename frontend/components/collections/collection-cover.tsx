import Image from "next/image";
import { cn } from "@/lib/utils";
import { getBookCoverThumbnailUrl } from "@/lib/media";
import type { BookCardData } from "@/lib/types";

type CollectionCoverProps = {
    books: BookCardData[];
    className?: string;
}

export function CollectionCover({ books, className }: CollectionCoverProps) {
    const covers = books.slice(0, 4);

    return (
        <div className={cn("grid grid-cols-2 overflow-hidden rounded-3xl bg-muted aspect-square", className)}>
            {Array.from({ length: 4 }).map((_, index) => {
                const book = covers[index];
                return (
                    <div key={index} className="relative bg-muted">
                        {book?.coverImage ? (
                            <Image
                                src={getBookCoverThumbnailUrl(book.coverImage)}
                                alt={book.title}
                                fill
                                sizes="160px"
                                className="object-cover"
                            />
                        ) : (
                            <div className="h-full w-full bg-gradient-to-br from-primary/20 to-muted" />
                        )}
                    </div>
                )
            })}
        </div>
    )
}
