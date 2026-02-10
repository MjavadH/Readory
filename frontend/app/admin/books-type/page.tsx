"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCorners,
    defaultDropAnimationSideEffects,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { apiClient } from "@/lib/api-client"
import type { BookType } from "@/lib/types"
import type { IconKey } from "@shared/icon-keys"

import { AppIcon } from "@/components/AppIcon"
import { IconPicker } from "@/components/icon-picker"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { GripVertical, Loader2, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react"

function SortableTypeItem({
                              item,
                              isActiveList,
                              onDelete,
                              onEdit,
                              onUpdateIcon,
                          }: {
    item: BookType
    isActiveList: boolean
    onDelete: (t: BookType) => void
    onEdit: (t: BookType) => void
    onUpdateIcon: (id: number, iconKey: IconKey | null) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id.toString(),
        data: { type: "BookType", item },
    })

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
        group relative flex items-center gap-3 rounded-xl border p-4 transition-all touch-none
        ${isActiveList ? "bg-card border-border/40 hover:border-border hover:shadow-sm" : "bg-muted/20 border-border/30"}
        ${isDragging ? "shadow-2xl ring-2 ring-primary scale-[1.02]" : ""}
      `}
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1">
                <GripVertical className="h-5 w-5" />
            </div>

            {isActiveList && (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {item.sortOrder + 1}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <AppIcon name={item.iconKey as IconKey | null} className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h3 className="font-semibold truncate text-sm text-foreground">{item.name}</h3>
                    {!item.isActive && <Badge variant="secondary" className="h-5 px-2 text-[10px]">Inactive</Badge>}
                </div>

                <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground/80 truncate">{item.slug}</code>
                </div>
            </div>

            <IconPicker value={item.iconKey as IconKey | null} onChange={(k) => onUpdateIcon(item.id, k)} />

            <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all shrink-0"
                onClick={() => onEdit(item)}
            >
                <Pencil className="h-4 w-4" />
            </Button>

            <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                onClick={() => onDelete(item)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    )
}

function DroppableContainer({
                                id,
                                items,
                                children,
                                className,
                            }: {
    id: string
    items: string[]
    children: React.ReactNode
    className?: string
}) {
    const { setNodeRef } = useDroppable({ id })
    return (
        <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
            <div ref={setNodeRef} className={className}>
                {children}
            </div>
        </SortableContext>
    )
}

export default function AdminBookTypesPage() {
    const [types, setTypes] = useState<BookType[]>([])
    const [name, setName] = useState("")
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [typeToDelete, setTypeToDelete] = useState<BookType | null>(null)
    const [activeItem, setActiveItem] = useState<BookType | null>(null)

    // edit dialog
    const [editOpen, setEditOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<BookType | null>(null)
    const [editName, setEditName] = useState("")
    const [editSlug, setEditSlug] = useState("")
    const [savingEdit, setSavingEdit] = useState(false)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const load = async () => {
        const data = await apiClient.get<BookType[]>("/book-types").catch(() => [])
        if (Array.isArray(data)) {
            setTypes(
                data.map((t: any) => ({
                    ...t,
                    isActive: Boolean(t.isActive),
                    sortOrder: Number(t.sortOrder) || 0,
                    iconKey: (t.iconKey ?? null) as IconKey | null,
                })),
            )
        }
    }

    useEffect(() => {
        void load()
    }, [])

    const activeTypes = useMemo(
        () => types.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        [types],
    )

    const inactiveTypes = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return types
            .filter((t) => !t.isActive)
            .filter((t) => (q ? t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) : true))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [types, searchQuery])

    const activeIds = useMemo(() => activeTypes.map((t) => t.id.toString()), [activeTypes])
    const inactiveIds = useMemo(() => inactiveTypes.map((t) => t.id.toString()), [inactiveTypes])

    const create = async () => {
        const v = name.trim()
        if (!v) return
        setLoadingCreate(true)
        try {
            await apiClient.post("/book-types", { name: v })
            setName("")
            await load()
        } catch (e: any) {
            alert(e?.message || "Failed to create")
        } finally {
            setLoadingCreate(false)
        }
    }

    const updateIcon = async (id: number, iconKey: IconKey | null) => {
        setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, iconKey } : t)))
        try {
            await apiClient.patch(`/book-types/${id}`, { iconKey })
        } catch (e) {
            console.error("Failed to save icon:", e)
            // optional: reload to revert
            void load()
        }
    }

    const openEdit = (t: BookType) => {
        setEditTarget(t)
        setEditName(t.name)
        setEditSlug(t.slug)
        setEditOpen(true)
    }

    const saveEdit = async () => {
        if (!editTarget) return
        const n = editName.trim()
        const s = editSlug.trim()
        if (!n || !s) return

        setSavingEdit(true)
        try {
            const updated = await apiClient.patch<BookType>(`/book-types/${editTarget.id}`, { name: n, slug: s })
            setTypes((prev) =>
                prev.map((t) =>
                    t.id === editTarget.id
                        ? { ...t, name: updated.name, slug: updated.slug }
                        : t,
                ),
            )
            setEditOpen(false)
            setEditTarget(null)
        } catch (e: any) {
            alert(e?.message || "Failed to update")
        } finally {
            setSavingEdit(false)
        }
    }

    const handleDeleteClick = (t: BookType) => {
        setTypeToDelete(t)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!typeToDelete) return
        try {
            const res = await apiClient.delete<{ id: number; deleted: boolean; deactivated: boolean }>(`/book-types/${typeToDelete.id}`)
            if (res?.deleted) {
                setTypes((prev) => prev.filter((t) => t.id !== typeToDelete.id))
            } else if (res?.deactivated) {
                setTypes((prev) => prev.map((t) => (t.id === typeToDelete.id ? { ...t, isActive: false, sortOrder: 0 } : t)))
            } else {
                // fallback: reload
                await load()
            }
        } catch (e: any) {
            alert(e?.message || "Failed to delete")
        } finally {
            setDeleteDialogOpen(false)
            setTypeToDelete(null)
        }
    }

    const saveActiveOrder = async (items: BookType[]) => {
        // optimistic already applied; persist in parallel
        await Promise.all(
            items.map((t, idx) => apiClient.patch(`/book-types/${t.id}`, { isActive: true, sortOrder: idx })),
        ).catch((e) => {
            console.error(e)
            void load()
        })
    }

    const onDragStart = (event: DragStartEvent) => {
        const current = types.find((t) => t.id.toString() === event.active.id)
        if (current) setActiveItem(current)
    }

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id.toString()
        const overId = over.id.toString()

        const activeItem = types.find((t) => t.id.toString() === activeId)
        if (!activeItem) return

        const isOverActive = overId === "active-container" || activeIds.includes(overId)
        const isOverInactive = overId === "inactive-container" || inactiveIds.includes(overId)

        if (activeItem.isActive && isOverInactive) {
            setTypes((prev) => prev.map((t) => (t.id === activeItem.id ? { ...t, isActive: false, sortOrder: 0 } : t)))
        } else if (!activeItem.isActive && isOverActive) {
            setTypes((prev) =>
                prev.map((t) => (t.id === activeItem.id ? { ...t, isActive: true, sortOrder: activeTypes.length } : t)),
            )
        }
    }

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        const initial = activeItem
        setActiveItem(null)
        if (!over || !initial) return

        const activeId = active.id.toString()
        const overId = over.id.toString()

        const droppedInInactive = overId === "inactive-container" || inactiveIds.includes(overId)
        const droppedInActive = overId === "active-container" || activeIds.includes(overId)

        if (initial.isActive && droppedInInactive) {
            setTypes((prev) => prev.map((t) => (t.id.toString() === activeId ? { ...t, isActive: false, sortOrder: 0 } : t)))
            apiClient.patch(`/book-types/${activeId}`, { isActive: false, sortOrder: 0 }).catch(console.error)
            return
        }

        if (droppedInActive) {
            const oldIndex = activeTypes.findIndex((t) => t.id.toString() === activeId)
            const newIndex = activeTypes.findIndex((t) => t.id.toString() === overId)

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const reordered = arrayMove(activeTypes, oldIndex, newIndex)

                setTypes((prev) => {
                    const next = [...prev]
                    reordered.forEach((t, idx) => {
                        const found = next.find((x) => x.id === t.id)
                        if (found) {
                            found.isActive = true
                            found.sortOrder = idx
                        }
                    })
                    return next
                })

                void saveActiveOrder(reordered)
            } else if (!initial.isActive) {
                // was inactive → activated; persist full order
                void saveActiveOrder(activeTypes)
            }
        }
    }

    return (
        <div className="min-h-screen bg-linear-to-b from-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Book Types Management</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Create and organize book types. Drag between lists to activate/deactivate, and reorder active types.
                    </p>
                </div>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={onDragStart}
                    onDragOver={onDragOver}
                    onDragEnd={onDragEnd}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Left: Inactive types */}
                        <div className="lg:col-span-7 space-y-6">
                            <Card className="border-border/40 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <div className="h-8 w-1 bg-linear-to-b from-primary to-primary/60 rounded-full" />
                                        Inactive Types
                                    </CardTitle>
                                    <CardDescription>Create new types or drag them to Active list</CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter type name..."
                                            onKeyDown={(e) => e.key === "Enter" && create()}
                                            className="flex-1"
                                        />
                                        <Button onClick={create} disabled={loadingCreate || !name.trim()} className="sm:w-auto w-full gap-2">
                                            {loadingCreate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            Create Type
                                        </Button>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search inactive types..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>

                                    <div className="bg-linear-to-br from-muted/30 to-muted/10 rounded-xl p-3 border border-border/40 min-h-[450px]">
                                        <DroppableContainer id="inactive-container" items={inactiveIds} className="space-y-2 min-h-[426px]">
                                            {inactiveTypes.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-xl bg-background/50 backdrop-blur-sm p-8">
                                                    <Tag className="h-12 w-12 mb-3 opacity-20" />
                                                    <p className="font-medium">{searchQuery ? "No matches found" : "No inactive types"}</p>
                                                </div>
                                            ) : (
                                                inactiveTypes.map((t) => (
                                                    <SortableTypeItem
                                                        key={t.id}
                                                        item={t}
                                                        isActiveList={false}
                                                        onDelete={handleDeleteClick}
                                                        onEdit={openEdit}
                                                        onUpdateIcon={updateIcon}
                                                    />
                                                ))
                                            )}
                                        </DroppableContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right: Active types */}
                        <div className="lg:col-span-5 space-y-6">
                            <Card className="border-primary/30 shadow-lg bg-linear-to-br from-card via-card to-primary/5">
                                <CardHeader className="border-b border-primary/20 pt-4">
                                    <CardTitle className="text-xl">Active Types</CardTitle>
                                    <CardDescription className="text-xs mt-0.5">
                                        {activeTypes.length} active
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="pt-6">
                                    <div className="min-h-[500px]">
                                        <DroppableContainer id="active-container" items={activeIds} className="space-y-2 min-h-[500px]">
                                            {activeTypes.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-[480px] text-muted-foreground text-sm border-2 border-dashed border-primary/30 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-8">
                                                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                                        <Tag className="h-8 w-8 text-primary/60" />
                                                    </div>
                                                    <p className="font-medium text-center">Drag types here to activate</p>
                                                </div>
                                            ) : (
                                                activeTypes.map((t) => (
                                                    <SortableTypeItem
                                                        key={t.id}
                                                        item={t}
                                                        isActiveList={true}
                                                        onDelete={handleDeleteClick}
                                                        onEdit={openEdit}
                                                        onUpdateIcon={updateIcon}
                                                    />
                                                ))
                                            )}
                                        </DroppableContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
                        {activeItem ? (
                            <div className="opacity-95 rotate-1 cursor-grabbing w-full max-w-[360px]">
                                <div className="flex items-center gap-3 rounded-xl border-2 bg-card p-4 shadow-2xl ring-4 ring-primary/30">
                                    <GripVertical className="h-5 w-5 text-primary" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <AppIcon name={activeItem.iconKey as IconKey | null} className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="font-semibold truncate text-sm">{activeItem.name}</h3>
                                        </div>
                                        <code className="text-xs text-muted-foreground truncate block">{activeItem.slug}</code>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">
                                        {activeItem.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {/* Delete confirm */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Book Type</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete <strong>{typeToDelete?.name}</strong>? If this type is used by books, it will be deactivated instead.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Edit dialog */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>Edit Book Type</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Type name" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Slug</label>
                                <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="kebab-case slug" />
                                <p className="text-xs text-muted-foreground">Used in URLs and filters. Must be kebab-case.</p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setEditOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={saveEdit} disabled={savingEdit || !editName.trim() || !editSlug.trim()}>
                                    {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Save
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}