"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type SessionResponse = {
  chapterId: number;
  bookId: number;
  chapterIndex: number;
  contentType: "images" | "text" | null;
  pageCount: number;
  contentVersion: number;
  resume: { lastPage: number; percent: number } | null;
  sessionToken: string;
};

type Manifest = {
  version: 1;
  format: "images" | "text";
  pageCount: number;
  pages: Array<{ key: string; w?: number; h?: number; sha256?: string }>;
};

export default function ChapterPage() {
  const params = useParams<{ type: string; id: string; index: string }>();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const indexParam = Array.isArray(params.index) ? params.index[0] : params.index;
  const typeSlug = Array.isArray(params.type) ? params.type[0] : params.type;

  const bookId = Number(idParam);
  const chapterIndex = Number(indexParam);
  const backUrl = useMemo(() => `/${encodeURIComponent(typeSlug)}/${bookId}`, [typeSlug, bookId]);

  const [session, setSession] = useState<SessionResponse | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [textHtml, setTextHtml] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const pageRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    if (!Number.isInteger(bookId) || !Number.isInteger(chapterIndex) || bookId <= 0 || chapterIndex <= 0) {
      setError("Invalid chapter link");
      return;
    }

    apiClient
      .post<SessionResponse, { bookId: number; chapterIndex: number }>("/reader/session", { bookId, chapterIndex })
      .then(async (s) => {
        setSession(s);
        if (s.contentType === "images") {
          const m = await apiClient.get<Manifest>("/reader/manifest", { query: { token: s.sessionToken } });
          setManifest(m);
        }
        if (s.contentType === "text") {
          const t = await apiClient.get<{ html: string }>("/reader/text", { query: { token: s.sessionToken } });
          setTextHtml(t.html);
        }
      })
      .catch((e) => setError(getApiErrorMessage(e, "Unable to open chapter")));
  }, [bookId, chapterIndex]);

  useEffect(() => {
    if (!session || !manifest || manifest.format !== "images") return;

    const draw = async () => {
      for (let i = 0; i < manifest.pageCount; i++) {
        const canvas = pageRefs.current[i];
        if (!canvas) continue;
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/reader/page?token=${encodeURIComponent(session.sessionToken)}&p=${i + 1}`, {
            credentials: "include",
            cache: "no-store",
          });
          if (!res.ok) continue;
          const blob = await res.blob();
          const bitmap = await createImageBitmap(blob);
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.drawImage(bitmap, 0, 0);
        } catch {
          // page-level retry is omitted in MVP
        }
      }
    };

    void draw();
  }, [manifest, session]);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => {
      const y = window.scrollY;
      const page = Math.max(1, Math.min(session.pageCount || 1, Math.floor(y / 900) + 1));
      apiClient.post("/reader/progress", { chapterId: session.chapterId, lastPage: page }).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [session]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-10 space-y-4">
        <p className="text-destructive">{error}</p>
        <Link className="text-sm underline" href={backUrl}>
          Back to book page
        </Link>
      </div>
    );
  }

  if (!session) return <div className="container mx-auto px-4 py-10">Loading chapter...</div>;

  if (session.contentType === "text") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: textHtml }} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {Array.from({ length: manifest?.pageCount ?? 0 }).map((_, idx) => (
        <canvas key={idx} ref={(el) => (pageRefs.current[idx] = el)} className="w-full rounded border bg-muted" />
      ))}
    </div>
  );
}
