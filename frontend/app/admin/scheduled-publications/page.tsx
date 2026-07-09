"use client"

import React, { useEffect, useMemo, useState } from "react"
import {BookOpen, CalendarClock, Check, FileText, Loader2, Pencil, Send, X} from "lucide-react"
import { apiClient, getApiErrorMessage } from "@/lib/api-client"
import { useToast } from "@/providers/toast-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BookPicker } from "@/components/admin/book-picker"
import type { BookCardData } from "@/lib/types"
import { ChapterPicker, type ChapterItemData } from "@/components/admin/chapter-picker"
import {useTranslations} from "next-intl";
import {motion} from "framer-motion";

type TargetType = "BOOK" | "Chapter"

type Schedule = {
  id: number
  targetType: TargetType
  targetId: number
  targetName: string
  publishAt: string
  status: string
  retryCount: number
  maxRetries: number
  lastAttemptAt?: string | null
  error?: string | null
}

type BookData = {
  books: BookCardData[]
  hasMore: boolean
  stats: {
    total: number
    Published: number
    Drafts: number
  }
  page: number
  limit: number
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 16)
}

export default function ScheduledPublicationsPage() {
  const t = useTranslations("AdminPage.ScheduledPublications")
  const toast = useToast()
  const [items, setItems] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ targetType: "BOOK" as TargetType, targetId: "", publishAt: "", maxRetries: "3" })
  const formatter = useMemo(() => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), [])

  // Book Picker
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [draftBooks, setDraftBooks] = useState<BookCardData[]>([])
  const [bookSearch, setBookSearch] = useState("")
  const [bookPage, setBookPage] = useState(1)
  const [bookTotalItems, setBookTotalItems] = useState(0)
  const [bookTotalPages, setBookTotalPages] = useState(1)
  const [isFetchingBooks, setIsFetchingBooks] = useState(false)
  const limit = 12

  // Chapter Picker
  const [isBookForChapter, setIsBookForChapter] = useState(false)
  const [selectedBookForChapterId, setSelectedBookForChapterId] = useState<number | null>(null)

  const [isChapterPickerOpen, setIsChapterPickerOpen] = useState(false)
  const [draftChapters, setDraftChapters] = useState<ChapterItemData[]>([])
  const [chapterSearch, setChapterSearch] = useState("")
  const [chapterPage, setChapterPage] = useState(1)
  const [chapterTotalItems, setChapterTotalItems] = useState(0)
  const [chapterTotalPages, setChapterTotalPages] = useState(1)
  const [isFetchingChapters, setIsFetchingChapters] = useState(false)

  useEffect(() => {
    if (!isChapterPickerOpen || !selectedBookForChapterId) return

    const fetchChapters = async () => {
      setIsFetchingChapters(true)
      try {
        const res: any = await apiClient.get(`/books/${selectedBookForChapterId}/chapters/admin?publishStatus=DRAFT&page=${chapterPage}&limit=50&q=${chapterSearch}`)
        const data = res.data || res

        setDraftChapters(data.items || [])
        setChapterTotalItems(data.pagination?.total || 0)
        setChapterTotalPages(data.pagination?.totalPages || 1)
      } catch (e) {
        toast.error(getApiErrorMessage(e, "Failed to load chapters"))
      } finally {
        setIsFetchingChapters(false)
      }
    }

    const timer = setTimeout(fetchChapters, 300)
    return () => clearTimeout(timer)
  }, [isChapterPickerOpen, chapterPage, chapterSearch, selectedBookForChapterId])

  useEffect(() => {
    if (!isPickerOpen) return

    const fetchBooks = async () => {
      setIsFetchingBooks(true)
      try {
        const statusFilter = isBookForChapter ? "published" : "draft"
        const res = await apiClient.get<BookData>(`/books/allBooks?status=${statusFilter}&page=${bookPage}&limit=${limit}&q=${bookSearch}`)

        setDraftBooks(res.books)
        const total = isBookForChapter ? res.stats.Published : res.stats.Drafts
        setBookTotalItems(total)
        setBookTotalPages(Math.ceil(total / limit))
      } catch (e) {
        toast.error(getApiErrorMessage(e, "Failed to load books"))
      } finally {
        setIsFetchingBooks(false)
      }
    }

    const timer = setTimeout(fetchBooks, 300)
    return () => clearTimeout(timer)
  }, [isPickerOpen, bookPage, bookSearch, isBookForChapter])

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<{ data: Schedule[] }>("/scheduled-publications")
      setItems(res.data)
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Failed to load schedules"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const reset = () => { setEditingId(null); setForm({ targetType: "BOOK", targetId: "", publishAt: "", maxRetries: "3" }) }
  const submit = async () => {
    setSaving(true)
    try {
      const body = { ...form, targetId: Number(form.targetId), publishAt: new Date(form.publishAt).toISOString(), maxRetries: Number(form.maxRetries) }
      if (editingId) await apiClient.patch(`/scheduled-publications/${editingId}`, body)
      else await apiClient.post("/scheduled-publications", body)
      toast.success(editingId ? "Schedule updated" : "Schedule created")
      reset(); await load()
    } catch (e) { toast.error(getApiErrorMessage(e, "Schedule save failed")) } finally { setSaving(false) }
  }

  const action = async (id: number, path: "cancel" | "publish-now") => {
    try { await apiClient.post(`/scheduled-publications/${id}/${path}`); toast.success(path === "cancel" ? "Schedule cancelled" : "Published immediately"); await load() }
    catch (e) { toast.error(getApiErrorMessage(e, "Action failed")) }
  }

  return <div className="space-y-6 p-4 md:p-8">
    <div><h1 className="flex items-center gap-2 text-3xl font-bold"><CalendarClock className="h-7 w-7" /> Scheduled Publishing</h1><p className="text-muted-foreground">Schedule books and chapters by local time; the server stores UTC and publishes from the background worker.</p></div>
    <Card><CardHeader><CardTitle>{editingId ? "Edit schedule time" : "Create schedule"}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-5">
      <div>
        <Label>Type</Label>
        <Select
            value={form.targetType}
            onValueChange={(v) => {
              setForm({ ...form, targetType: v as TargetType, targetId: "" })
              setSelectedBookForChapterId(null)
            }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="BOOK">Book</SelectItem><SelectItem value="Chapter">Chapter</SelectItem></SelectContent>
        </Select>
      </div>

      <div>
        <Label>Content ID</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input disabled={!!editingId} value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} />
          {!editingId && form.targetType === "BOOK" && (
              <Button type="button" variant="outline" size="icon" onClick={() => { setIsBookForChapter(false); setIsPickerOpen(true); }}>
                <BookOpen className="h-4 w-4" />
              </Button>
          )}

          {!editingId && form.targetType === "Chapter" && (
              <>
                <Button
                    type="button"
                    variant={selectedBookForChapterId ? "default" : "outline"}
                    size="icon"
                    onClick={() => { setIsBookForChapter(true); setIsPickerOpen(true); }}
                >
                  <BookOpen className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={!selectedBookForChapterId}
                    onClick={() => setIsChapterPickerOpen(true)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              </>
          )}
        </div>
      </div>

      <div><Label>Publish Date</Label><Input type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} /></div>
      <div><Label>Max retries</Label><Input type="number" min={0} max={10} value={form.maxRetries} onChange={(e) => setForm({ ...form, maxRetries: e.target.value })} /></div>
      <div className="flex items-end gap-2"><Button onClick={submit} disabled={saving || !form.targetId || !form.publishAt}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</Button>{editingId && <Button variant="outline" onClick={reset}>Cancel edit</Button>}</div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Management</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Content</TableHead><TableHead>Type</TableHead><TableHead>Publish Date</TableHead><TableHead>Status</TableHead><TableHead>Retry</TableHead><TableHead>Error</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow> : items.map((item) => <TableRow key={item.id}>
          <TableCell>{item.targetName} <span className="text-muted-foreground">#{item.targetId}</span></TableCell><TableCell>{item.targetType === "BOOK" ? "Book" : "Chapter"}</TableCell><TableCell>{formatter.format(new Date(item.publishAt))}</TableCell><TableCell><Badge variant={item.status === "Pending" ? "secondary" : item.status === "FAILED" ? "destructive" : "outline"}>{item.status}</Badge></TableCell><TableCell>{item.retryCount}/{item.maxRetries}<br /><span className="text-xs text-muted-foreground">{item.lastAttemptAt ? formatter.format(new Date(item.lastAttemptAt)) : "No attempts"}</span></TableCell><TableCell className="max-w-xs truncate">{item.error || "—"}</TableCell><TableCell className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setForm({ targetType: item.targetType, targetId: String(item.targetId), publishAt: toLocalInput(item.publishAt), maxRetries: String(item.maxRetries) }) }} disabled={item.status !== "Pending"}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => action(item.id, "publish-now")} disabled={item.status !== "Pending"}><Send className="h-4 w-4" /></Button><Button size="sm" variant="destructive" onClick={() => action(item.id, "cancel")} disabled={!['Pending','FAILED'].includes(item.status)}><X className="h-4 w-4" /></Button></TableCell>
        </TableRow>)}
      </TableBody></Table>
    </CardContent></Card>

    {/* Book Picker */}
    <BookPicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        books={draftBooks}
        value={isBookForChapter ? selectedBookForChapterId : (Number(form.targetId) || null)}
        onSelect={(book) => {
          if (book) {
            if (isBookForChapter) {
              setSelectedBookForChapterId(book.id)
              setForm({ ...form, targetId: "" })
            } else {
              setForm({ ...form, targetId: String(book.id) })
            }
          }
        }}
        isLoading={isFetchingBooks}
        title={isBookForChapter ? "Select Book for Chapters" : "Select Book for Publishing"}
        searchQuery={bookSearch}
        onSearchChange={(q) => { setBookSearch(q); setBookPage(1) }}
        page={bookPage}
        onPageChange={setBookPage}
        totalItems={bookTotalItems}
        totalPages={bookTotalPages}
        limit={limit}
    />

    {/* Chapter Picker */}
    <ChapterPicker
        open={isChapterPickerOpen}
        onOpenChange={setIsChapterPickerOpen}
        chapters={draftChapters}
        value={Number(form.targetId) || null}
        onSelect={(chapter) => {
          if (chapter) {
            setForm({ ...form, targetId: String(chapter.id) })
          }
        }}
        isLoading={isFetchingChapters}
        searchQuery={chapterSearch}
        onSearchChange={(q) => { setChapterSearch(q); setChapterPage(1) }}
        page={chapterPage}
        onPageChange={setChapterPage}
        totalItems={chapterTotalItems}
        totalPages={chapterTotalPages}
    />
  </div>
}
