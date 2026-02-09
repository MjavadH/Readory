"use client"

import React, { useState } from "react"
import { iconRegistry, IconKey } from "@/lib/iconRegistry"
import { AppIcon } from "@/components/AppIcon"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {Palette, Search} from "lucide-react"

interface IconPickerProps {
    value?: string | null
    onChange: (key: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")

    const iconKeys = Object.keys(iconRegistry) as IconKey[]

    // Filter icons based on search input
    const filteredIcons = iconKeys.filter((key) =>
        key.toLowerCase().includes(search.toLowerCase())
    )

    const handleSelect = (key: string) => {
        onChange(key)
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                    <Palette className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Select Icon</DialogTitle>
                </DialogHeader>
                <div className="relative my-2">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search icons..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto p-1">
                    {filteredIcons.map((key) => (
                        <Button
                            key={key}
                            variant={value === key ? "default" : "outline"}
                            className="h-12 w-full"
                            onClick={() => handleSelect(key)}
                        >
                            <AppIcon name={key} className="h-6 w-6" />
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}