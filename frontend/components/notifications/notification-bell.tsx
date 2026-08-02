/* eslint-disable react-hooks/set-state-in-effect */
"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { apiClient } from "@/lib/api-client"
import type { NotificationApiItem } from "@readory/shared"
export function NotificationBell() {
  const [items, setItems] = useState<NotificationApiItem[]>([]); const [count, setCount] = useState(0)
  const refresh = async () => { const [list, unread] = await Promise.all([apiClient.get<{ items: NotificationApiItem[] }>("/notifications", { query: { limit: 5 }, cache: "no-store" }), apiClient.get<{ unreadCount: number }>("/notifications/unread-count", { cache: "no-store" })]); setItems(list.items); setCount(unread.unreadCount) }
  useEffect(() => { void refresh().catch(() => undefined) }, [])
  const markAll = async () => { await apiClient.patch("/notifications/read", {}); await refresh() }
  return <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications"><Bell className="h-5 w-5" />{count > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{Math.min(count, 99)}</span>}</Button></PopoverTrigger><PopoverContent align="end" className="w-86 p-0"><div className="flex items-center justify-between border-b p-3"><p className="font-semibold">Notifications</p><Button variant="ghost" size="sm" onClick={markAll} className="gap-1"><CheckCheck className="h-4 w-4" /> Mark all</Button></div><div className="max-h-96 overflow-y-auto p-2">{items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</p> : items.map((n) => <Link key={n.id} href={n.actionUrl || "/notifications"} className="block rounded-xl p-3 hover:bg-accent"><div className="flex gap-2"><span className={n.readAt ? "mt-1 h-2 w-2 rounded-full bg-muted" : "mt-1 h-2 w-2 rounded-full bg-primary"} /><div><p className="text-sm font-medium">{n.title}</p><p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p></div></div></Link>)}</div><Link href="/notifications" className="block border-t p-3 text-center text-sm font-medium text-primary">View all notifications</Link></PopoverContent></Popover>
}
