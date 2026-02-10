"use client"

import type React from "react"

import { useEffect, useState, useMemo } from "react"
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    type DragStartEvent,
    type DragOverEvent,
    type DragEndEvent,
    useDroppable,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
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
import { Trash2, Plus, Search, Sparkles, GripVertical, Book, Loader2, Tag } from "lucide-react"
import {AppIcon} from "@/components/AppIcon";
import type { IconKey } from "@readory/shared";
import { IconPicker } from "@/components/icon-picker";
import { apiClient } from "@/lib/api-client"

type Genre = {
    id: number
    name: string
    slug: string
    iconKey?: IconKey
    createdAt?: string
    isFeatured: boolean
    featuredOrder: number
    _count?: {
        books: number
    }
}


function SortableGenreItem({
                               genre,
                               isFeaturedList,
                               onDelete,
                               onUpdateIcon,
                           }: {
    genre: Genre
    isFeaturedList: boolean
    onDelete: (g: Genre) => void
    onUpdateIcon: (id: number, iconKey: IconKey) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: genre.id.toString(),
        data: {
            type: "Genre",
            genre,
        },
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
                ${
                isFeaturedList
                    ? "bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 border-blue-500/30 shadow-sm hover:shadow-md hover:border-blue-500/50"
                    : "bg-card border-border/40 hover:border-border hover:shadow-sm"
            }
                ${isDragging ? "shadow-2xl ring-2 ring-blue-500 scale-105" : ""}
            `}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
            >
                <GripVertical className="h-5 w-5" />
            </div>

            {isFeaturedList && (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-bold text-white shadow-sm shrink-0">
                    {genre.featuredOrder + 1}
                </div>
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <AppIcon name={genre.iconKey as IconKey} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <h3 className="font-semibold truncate text-sm text-foreground">{genre.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground/80 truncate">{genre.slug}</code>
                    <Badge variant="secondary" className="h-5 px-2 text-[10px] gap-1 shrink-0">
                        <Book className="h-3 w-3" />
                        {genre._count?.books || 0}
                    </Badge>
                </div>
            </div>

            <IconPicker
                value={genre.iconKey as IconKey}
                onChange={(key: any) => onUpdateIcon(genre.id, key)}
            />
            <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                onClick={() => onDelete(genre)}
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

export default function AdminGenres() {
    const [genres, setGenres] = useState<Genre[]>([])
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [genreToDelete, setGenreToDelete] = useState<Genre | null>(null)
    const [activeGenre, setActiveGenre] = useState<Genre | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const load = async () => {
        const data = await apiClient.get<Genre[]>("/genres").catch(() => [])
        if (Array.isArray(data)) {
            setGenres(
                data.map((g: any) => ({
                    ...g,
                    isFeatured: Boolean(g.isFeatured),
                    featuredOrder: Number(g.featuredOrder) || 0,
                })),
            )
        }
    }

    useEffect(() => {
        load()
    }, [])

    const create = async () => {
        const v = name.trim()
        if (!v) return
        setLoading(true)
        try {
            await apiClient.post("/genres", { name: v })
            setName("")
            await load()
        } catch (error: any) {
            alert(error?.message || "Failed to create")
        } finally {
            setLoading(false)
        }
    }

    const updateGenreIcon = async (id: number, iconKey: IconKey) => {
        setGenres(prev => prev.map(g => g.id === id ? { ...g, iconKey } : g))

        try {
            await apiClient.patch(`/genres/${id}`, { iconKey })
        } catch (error) {
            console.error("Failed to save icon:", error)
        }
    };

    const handleDeleteClick = (genre: Genre) => {
        setGenreToDelete(genre)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!genreToDelete) return
        try {
            await apiClient.delete(`/genres/${genreToDelete.id}`)
            setGenres((prev) => prev.filter((g) => g.id !== genreToDelete.id))
        } catch (error: any) {
            alert(error?.message || "Failed to delete")
        } finally {
            setDeleteDialogOpen(false)
            setGenreToDelete(null)
        }
    }

    const featuredGenres = useMemo(
        () => genres.filter((g) => g.isFeatured).sort((a, b) => a.featuredOrder - b.featuredOrder),
        [genres],
    )

    const unfeaturedGenres = useMemo(
        () => genres.filter((g) => !g.isFeatured && g.name.toLowerCase().includes(searchQuery.toLowerCase())),
        [genres, searchQuery],
    )

    const featuredIds = useMemo(() => featuredGenres.map((g) => g.id.toString()), [featuredGenres])
    const unfeaturedIds = useMemo(() => unfeaturedGenres.map((g) => g.id.toString()), [unfeaturedGenres])

    const onDragStart = (event: DragStartEvent) => {
        const current = genres.find((g) => g.id.toString() === event.active.id)
        if (current) {
            setActiveGenre(current)
        }
    }

    const onDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id.toString()
        const overId = over.id.toString()

        const activeItem = genres.find((g) => g.id.toString() === activeId)
        if (!activeItem) return

        const isOverFeaturedList = overId === "featured-container" || featuredGenres.some((g) => g.id.toString() === overId)
        const isOverUnfeaturedList =
            overId === "unfeatured-container" || unfeaturedGenres.some((g) => g.id.toString() === overId)

        if (activeItem.isFeatured && isOverUnfeaturedList) {
            setGenres((prev) => prev.map((g) => (g.id === activeItem.id ? { ...g, isFeatured: false, featuredOrder: 0 } : g)))
        } else if (!activeItem.isFeatured && isOverFeaturedList) {
            setGenres((prev) =>
                prev.map((g) =>
                    g.id === activeItem.id ? { ...g, isFeatured: true, featuredOrder: featuredGenres.length } : g,
                ),
            )
        }
    }

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        const initialGenre = activeGenre
        setActiveGenre(null)

        if (!over || !initialGenre) return

        const activeId = active.id.toString()
        const overId = over.id.toString()

        const isDroppedInUnfeatured = overId === "unfeatured-container" || unfeaturedIds.includes(overId)
        const isDroppedInFeatured = overId === "featured-container" || featuredIds.includes(overId)

        if (initialGenre.isFeatured && isDroppedInUnfeatured) {
            setGenres((prev) =>
                prev.map((g) => (g.id.toString() === activeId ? { ...g, isFeatured: false, featuredOrder: 0 } : g)),
            )

            apiClient.patch(`/genres/${activeId}`, { isFeatured: false, featuredOrder: 0 }).catch(console.error)

            return
        }

        if (isDroppedInFeatured) {
            const oldIndex = featuredGenres.findIndex((g) => g.id.toString() === activeId)
            const newIndex = featuredGenres.findIndex((g) => g.id.toString() === overId)

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const reordered = arrayMove(featuredGenres, oldIndex, newIndex)

                setGenres((prev) => {
                    const next = [...prev]
                    reordered.forEach((g, index) => {
                        const found = next.find((x) => x.id === g.id)
                        if (found) found.featuredOrder = index
                    })
                    return next
                })

                saveOrder(reordered)
            } else if (!initialGenre.isFeatured) {
                saveOrder(featuredGenres)
            }
        }
    }

    const saveOrder = async (items: Genre[]) => {
        const updates = items.map((g, index) => {
            return apiClient.patch(`/genres/${g.id}`, {
                isFeatured: true,
                featuredOrder: index,
            })
        })
        await Promise.all(updates).catch(console.error)
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        Genres Management
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
                        Organize your content by dragging genres between lists to feature them on the homepage
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
                        {/* Left Column: Unfeatured List */}
                        <div className="lg:col-span-7 space-y-6">
                            <Card className="border-border/40 shadow-sm">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-xl flex items-center gap-2">
                                        <div className="h-8 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
                                        Available Genres
                                    </CardTitle>
                                    <CardDescription>Create new genres or drag them to the featured list</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter genre name..."
                                            onKeyDown={(e) => e.key === "Enter" && create()}
                                            className="flex-1"
                                        />
                                        <Button onClick={create} disabled={loading || !name.trim()} className="sm:w-auto w-full gap-2">
                                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            Create Genre
                                        </Button>
                                    </div>

                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search available genres..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>

                                    <div className="bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-3 border border-border/40 min-h-[450px]">
                                        <DroppableContainer
                                            id="unfeatured-container"
                                            items={unfeaturedIds}
                                            className="space-y-2 min-h-[426px]"
                                        >
                                            {unfeaturedGenres.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-xl bg-background/50 backdrop-blur-sm p-8">
                                                    <Tag className="h-12 w-12 mb-3 opacity-20" />
                                                    <p className="font-medium">{searchQuery ? "No matches found" : "No available genres"}</p>
                                                    {!searchQuery && <p className="text-xs mt-1 opacity-60">Create your first genre above</p>}
                                                </div>
                                            ) : (
                                                unfeaturedGenres.map((genre) => (
                                                    <SortableGenreItem
                                                        key={genre.id}
                                                        genre={genre}
                                                        isFeaturedList={false}
                                                        onDelete={handleDeleteClick}
                                                        onUpdateIcon={updateGenreIcon}
                                                    />
                                                ))
                                            )}
                                        </DroppableContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column: Featured List */}
                        <div className="lg:col-span-5 space-y-6">
                            <Card className="border-blue-500/30 shadow-lg bg-gradient-to-br from-card via-card to-blue-500/5">
                                <CardHeader className="bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 border-b border-blue-500/20 pt-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-md">
                                            <Sparkles className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                                Featured Genres
                                            </CardTitle>
                                            <CardDescription className="text-xs mt-0.5">
                                                {featuredGenres.length} {featuredGenres.length === 1 ? "genre" : "genres"} featured
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="min-h-[500px]">
                                        <DroppableContainer id="featured-container" items={featuredIds} className="space-y-2 min-h-[500px]">
                                            {featuredGenres.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-[480px] text-muted-foreground text-sm border-2 border-dashed border-blue-500/30 rounded-xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 backdrop-blur-sm p-8">
                                                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                                                        <Sparkles className="h-8 w-8 text-blue-500/60" />
                                                    </div>
                                                    <p className="font-medium text-center">Drag genres here to feature</p>
                                                    <p className="text-xs mt-1 opacity-60 text-center max-w-[200px]">
                                                        Featured genres appear on your homepage
                                                    </p>
                                                </div>
                                            ) : (
                                                featuredGenres.map((genre) => (
                                                    <SortableGenreItem
                                                        key={genre.id}
                                                        genre={genre}
                                                        isFeaturedList={true}
                                                        onDelete={handleDeleteClick}
                                                        onUpdateIcon={updateGenreIcon}
                                                    />
                                                ))
                                            )}
                                        </DroppableContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <DragOverlay
                        dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}
                    >
                        {activeGenre ? (
                            <div className="opacity-95 rotate-2 cursor-grabbing w-full max-w-[350px]">
                                <div className="flex items-center gap-3 rounded-xl border-2 bg-card p-4 shadow-2xl ring-4 ring-blue-500/50 backdrop-blur-sm">
                                    <GripVertical className="h-5 w-5 text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                            <h3 className="font-semibold truncate text-sm">{activeGenre.name}</h3>
                                        </div>
                                        <code className="text-xs text-muted-foreground truncate block">{activeGenre.slug}</code>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">
                                        {activeGenre._count?.books || 0}
                                    </Badge>
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Genre</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete <strong>{genreToDelete?.name}</strong>? This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDeleteConfirm}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    )
}
