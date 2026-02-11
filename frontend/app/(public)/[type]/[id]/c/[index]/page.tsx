"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChapterData = {
  id: number;
  bookId: number;
  title: string;
  index: number;
  contentPath: string | null;
  updatedAt: string;
  isFree: boolean;
  price: number | null;
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export default function ChapterPage() {
  const params = useParams<{ type: string; id: string; index: string }>();

  const typeSlug = Array.isArray(params.type) ? params.type[0] : params.type;
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const indexParam = Array.isArray(params.index) ? params.index[0] : params.index;

  const bookId = Number(idParam);
  const chapterIndex = Number(indexParam);

  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isInvalidLink = !Number.isInteger(bookId) || !Number.isInteger(chapterIndex) || bookId <= 0 || chapterIndex <= 0;

  useEffect(() => {
    if (isInvalidLink) return;

    apiClient
      .get<ChapterData>(`/books/${bookId}/chapters/index/${chapterIndex}/access`)
      .then(setChapter)
      .catch((loadError) => {
        setError(getApiErrorMessage(loadError, "Unable to access this chapter. Purchase or login may be required."));
      })
      .finally(() => setLoading(false));
  }, [bookId, chapterIndex, isInvalidLink]);

  const backUrl = useMemo(() => `/${encodeURIComponent(typeSlug)}/${bookId}`, [typeSlug, bookId]);

  if (isInvalidLink) {
    return (
      <div className="container mx-auto px-4 py-10 space-y-4">
        <p className="text-destructive">Invalid chapter link.</p>
        <Link className="text-sm underline" href={backUrl}>
          Back to book page
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-10">Loading chapter...</div>;
  }

  if (!chapter) {
    return (
      <div className="container mx-auto px-4 py-10 space-y-4">
        <p className="text-destructive">{error ?? "Chapter unavailable."}</p>
        <Link className="text-sm underline" href={backUrl}>
          Back to book page
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            Chapter {chapter.index}: {chapter.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Updated: {formatDateTime(chapter.updatedAt)}</p>
          <p className="text-sm text-muted-foreground">
            Access: {chapter.isFree ? "Free chapter" : "Purchased chapter"}
          </p>
          <div className="rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">
            {chapter.contentPath
              ? `Chapter content path: ${chapter.contentPath}`
              : "No content path has been configured yet for this chapter."}
          </div>
          <Link className="text-sm underline" href={backUrl}>
            Back to book page
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
