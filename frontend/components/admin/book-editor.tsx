import { getBookCoverThumbnailUrl } from "@/lib/media"
import type React from "react";
import Image from "next/image";
import {
    BookOpen,
    Calendar,
    Check,
    Eye,
    ImageIcon,
    Languages,
    LayoutGrid,
    LucideBookOpenText,
    Hash,
    Sparkles,
    Tag,
    Type,
    User,
    BookText,
} from "lucide-react";
import { AGE_RATING_VALUES, BOOK_STATUS_VALUES, BookStatus, type AgeRating } from "@readory/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type OptionItem = { id: number; name: string };

export type BookEditorValue = {
    title?: string;
    originalTitle?: string | null;
    alternativeTitles?: string[];
    author?: string | null;
    description?: string | null;
    coverImage?: string;
    isFeatured?: boolean;
    isPublished?: boolean;
    status?: BookStatus;
    ageRating?: AgeRating | null;
    publicationYear?: number | null;
    translators?: string[];
    typeId?: number;
    genreIds?: number[];
};

type BookEditorStat = {
    icon: React.ReactNode;
    label: string;
    value: string;
    hint?: string;
    small?: boolean;
};

export function BookEditor({
                               value,
                               onChange,
                               types,
                               genres,
                               isRTL,
                               t,
                               onSelectCover,
                               coverAlt,
                           }: {
    value: BookEditorValue;
    onChange: (value: BookEditorValue) => void;
    types: OptionItem[];
    genres: OptionItem[];
    isRTL: boolean;
    t: (key: string, values?: Record<string, string | number | Date>) => string;
    onSelectCover: () => void;
    coverAlt: string;
    stats?: BookEditorStat[];
}) {
    const coverUrl = value.coverImage ? getBookCoverThumbnailUrl(value.coverImage) : '/placeholder.svg';

    return (
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[240px_1fr]">
            <div className="mx-auto w-40 self-start sm:w-52 lg:sticky lg:top-20 lg:w-full">
                <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted shadow-xl ring-1 ring-black/5 dark:ring-white/5">
                    <div className="aspect-2/3 w-full">
                        <Image
                            src={coverUrl}
                            alt={coverAlt}
                            width={480}
                            height={720}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 640px) 70vw, 240px"
                            priority
                        />
                    </div>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={onSelectCover}
                >
                    <ImageIcon className="me-2 h-4 w-4" />
                    {t("BookSelectCover")}
                </Button>
            </div>

            <div className="min-w-0">
                <div className="space-y-0 divide-y divide-border/60">
                    <EditSection
                        icon={<Eye className="h-4 w-4" />}
                        title={t("DisplaySettings")}
                    >
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <ToggleRow
                                icon={<Eye className="h-4 w-4 text-muted-foreground" />}
                                label={t("Publish")}
                                description={t("MarkPublished")}
                                checked={value.isPublished ?? false}
                                onCheckedChange={(checked) =>
                                    onChange({ ...value, isPublished: checked })
                                }
                                activeColor="emerald"
                            />
                            <ToggleRow
                                icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
                                label={t("Featured")}
                                description={t("MarkFeatured")}
                                checked={value.isFeatured ?? false}
                                onCheckedChange={(checked) =>
                                    onChange({ ...value, isFeatured: checked })
                                }
                                activeColor="amber"
                            />
                        </div>
                    </EditSection>

                    <EditSection
                        icon={<BookOpen className="h-4 w-4" />}
                        title={t("BasicInfo")}
                    >
                        <div className="space-y-4">
                            <EditField label={t("BookTitle")} required>
                                <div className="relative">
                                    <BookText className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={value.title || ''}
                                        onChange={(e) => onChange({ ...value, title: e.target.value })}
                                        className="h-11 ps-9 text-base font-medium"
                                        placeholder={t("BookTitlePlaceholder")}
                                    />
                                </div>
                            </EditField>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <EditField label={t("OriginalTitle")}>
                                    <div className="relative">
                                        <Type className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={value.originalTitle || ''}
                                            onChange={(e) => onChange({ ...value, originalTitle: e.target.value })}
                                            placeholder={t("OriginalTitlePlaceholder")}
                                            className="ps-9"
                                        />
                                    </div>
                                </EditField>
                                <EditField label={t("BookAuthorPlaceholder")}>
                                    <div className="relative">
                                        <User className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={value.author || ''}
                                            onChange={(e) => onChange({ ...value, author: e.target.value })}
                                            className="ps-9"
                                            placeholder={t("BookAuthorPlaceholder")}
                                        />
                                    </div>
                                </EditField>
                            </div>

                            <EditField label={t("AlternativeTitles")}>
                                <div className="relative">
                                    <Hash className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={(value.alternativeTitles || []).join(',')}
                                        onChange={(e) => onChange({ ...value, alternativeTitles: e.target.value.split(',')})}
                                        className="ps-9"
                                        placeholder={t("AlternativeTitlesPlaceholder")}
                                    />
                                </div>
                            </EditField>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <EditField label={t("Translators")}>
                                    <div className="relative">
                                        <Languages className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={(value.translators || []).join(',')}
                                            onChange={(e) => onChange({ ...value, translators: e.target.value.split(',')})}
                                            className="ps-9"
                                            placeholder={t("TranslatorsPlaceholder")}
                                        />
                                    </div>
                                </EditField>
                                <EditField label={t("PublicationYear")}>
                                    <div className="relative">
                                        <Calendar className="pointer-events-none absolute inset-s-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={value.publicationYear ?? ''}
                                            onChange={(e) => onChange({ ...value, publicationYear: e.target.value ? Number(e.target.value) : null })}
                                            className="ps-9"
                                            placeholder={t("PublicationYearPlaceholder")}
                                        />
                                    </div>
                                </EditField>
                            </div>
                        </div>
                    </EditSection>

                    <EditSection
                        icon={<LayoutGrid className="h-4 w-4" />}
                        title={t("Classification")}
                    >
                        <div className="grid gap-4 sm:grid-cols-3">
                            <EditField required label={t("BookType")}>
                                <div className="relative">
                                    <Select
                                        dir={isRTL ? "rtl" : "ltr"}
                                        value={`${value.typeId}` || ''}
                                        onValueChange={(e) => onChange({ ...value, typeId: Number(e) })}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent position="popper">
                                            {types.map((tp) => (
                                                <SelectItem key={tp.id} value={`${tp.id}`}>{tp.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </EditField>

                            <EditField label={t("BookStatus")}>
                                <Select
                                    dir={isRTL ? "rtl" : "ltr"}
                                    value={value.status || BookStatus.Upcoming}
                                    onValueChange={(status) => onChange({ ...value, status: status as BookStatus })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                        {BOOK_STATUS_VALUES.map((status: string) => (
                                            <SelectItem key={status} value={status}>{t(`BookStatus_${status}`)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </EditField>

                            <EditField label={t("AgeRating")}>
                                <Select
                                    dir={isRTL ? "rtl" : "ltr"}
                                    value={value.ageRating || ''}
                                    onValueChange={(ageRating) => onChange({ ...value, ageRating: ageRating !== "None" ? ageRating as AgeRating: null })}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={t("SelectAgeRating")} />
                                    </SelectTrigger>
                                    <SelectContent position="popper">
                                        <SelectItem value="None">{t("None")}</SelectItem>
                                        <SelectSeparator />
                                        <SelectGroup>
                                            {AGE_RATING_VALUES.map((ageRating: string) => (
                                                <SelectItem key={ageRating} value={ageRating}>{t(`AgeRating_${ageRating}`)}</SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </EditField>
                        </div>
                    </EditSection>

                    <EditSection
                        icon={<Tag className="h-4 w-4" />}
                        title={t("BookGenres")}
                    >
                        <div className="flex flex-wrap gap-2">
                            {genres.map((gn) => {
                                const isSelected = value.genreIds?.includes(gn.id);
                                return (
                                    <button
                                        key={gn.id}
                                        type="button"
                                        onClick={() => {
                                            const current = value.genreIds || [];
                                            const next = isSelected
                                                ? current.filter(id => id !== gn.id)
                                                : [...current, gn.id];
                                            onChange({ ...value, genreIds: next });
                                        }}
                                        className={[
                                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                            isSelected
                                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                                : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-accent",
                                        ].join(' ')}
                                    >
                                        {isSelected && <Check className="h-3 w-3" />}
                                        {gn.name}
                                    </button>
                                );
                            })}
                        </div>
                    </EditSection>

                    <EditSection
                        icon={<LucideBookOpenText className="h-4 w-4" />}
                        title={t("BookDescription")}
                    >
                        <Textarea
                            value={value.description || ''}
                            onChange={(e) =>
                                onChange({ ...value, description: e.target.value })
                            }
                            placeholder={t("BookDescriptionPlaceholder")}
                            rows={5}
                            className="resize-none"
                        />
                    </EditSection>
                </div>
            </div>
        </div>
    );
}

function EditSection({
                         icon,
                         title,
                         children,
                     }: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="py-5 first:pt-0">
            <div className="mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {icon}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {title}
                </span>
            </div>
            {children}
        </div>
    );
}

function EditField({
                       label,
                       required,
                       children,
                   }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
                {label}
                {required && <span className="ms-0.5 text-destructive">*</span>}
            </Label>
            {children}
        </div>
    );
}

function ToggleRow({
                       icon,
                       label,
                       description,
                       checked,
                       onCheckedChange,
                       activeColor,
                   }: {
    icon: React.ReactNode;
    label: string;
    description: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    activeColor?: "emerald" | "amber";
}) {
    const activeRing =
        activeColor === "emerald"
            ? "data-[active=true]:border-emerald-500/40 data-[active=true]:bg-emerald-500/5"
            : activeColor === "amber"
                ? "data-[active=true]:border-amber-500/40 data-[active=true]:bg-amber-500/5"
                : "";

    return (
        <label
            data-active={checked}
            className={[
                "flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 transition-all duration-150 hover:border-border",
                activeRing,
            ].join(' ')}
        >
            <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-muted-foreground">{icon}</span>
                <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{description}</p>
                </div>
            </div>
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
            />
        </label>
    );
}
