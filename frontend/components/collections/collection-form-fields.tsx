import * as React from "react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { COLLECTION_SLUG_REGEX, type CollectionFormState, type CollectionVisibility } from "@/lib/collection-types"

export type CollectionFormFieldsProps = {
    value: CollectionFormState
    onChange: (next: CollectionFormState) => void
    isSystem?: boolean
    disableSlug?: boolean
}

export function CollectionFormFields({
                                         value,
                                         onChange,
                                         isSystem = false,
                                         disableSlug = false,
                                     }: CollectionFormFieldsProps) {
    const t = useTranslations("Collections")

    const patch = (partial: Partial<CollectionFormState>) => onChange({ ...value, ...partial })

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label htmlFor="collection-title" className="text-xs font-medium">
                    {t("Form.Title")}
                </Label>
                <Input
                    id="collection-title"
                    dir="auto"
                    value={value.title}
                    maxLength={160}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder={t("Form.TitlePlaceholder")}
                    className="text-start"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="collection-slug" className="text-xs font-medium">
                    {t("Form.Slug")}
                </Label>
                <Input
                    id="collection-slug"
                    dir="ltr"
                    value={value.slug}
                    maxLength={240}
                    disabled={disableSlug}
                    required={!disableSlug}
                    pattern={COLLECTION_SLUG_REGEX.source}
                    onChange={(e) => patch({ slug: e.target.value })}
                    placeholder={t("Form.SlugPlaceholder")}
                    className="text-start font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">{t("Form.SlugHint")}</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="collection-description" className="text-xs font-medium">
                    {t("Form.Description")}
                </Label>
                <Textarea
                    id="collection-description"
                    dir="auto"
                    rows={4}
                    maxLength={2000}
                    value={value.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder={t("Form.DescriptionPlaceholder")}
                    className="resize-none text-start"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs font-medium">{t("Form.Visibility")}</Label>
                <Select
                    value={value.visibility}
                    onValueChange={(v) => patch({ visibility: v as CollectionVisibility })}
                >
                    <SelectTrigger className="w-full text-start">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="PUBLIC">{t("Visibility.PUBLIC")}</SelectItem>
                        <SelectItem value="UNLISTED">{t("Visibility.UNLISTED")}</SelectItem>
                        <SelectItem value="PRIVATE">{t("Visibility.PRIVATE")}</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                    {t(`Form.VisibilityHint_${value.visibility}` as never)}
                </p>
            </div>

            {/* Only system collections can be featured or indexed by search engines. */}
            {isSystem ? (
                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                    <ToggleRow
                        label={t("Form.Featured")}
                        hint={t("Form.FeaturedHint")}
                        checked={value.featured}
                        onCheckedChange={(featured) => patch({ featured })}
                    />
                    <ToggleRow
                        label={t("Form.AllowIndexing")}
                        hint={t("Form.AllowIndexingHint")}
                        checked={value.allowIndexing}
                        disabled={value.visibility !== "PUBLIC"}
                        onCheckedChange={(allowIndexing) => patch({ allowIndexing })}
                    />
                </div>
            ) : null}
        </div>
    )
}

function ToggleRow({
                       label,
                       hint,
                       checked,
                       disabled,
                       onCheckedChange,
                   }: {
    label: string
    hint: string
    checked: boolean
    disabled?: boolean
    onCheckedChange: (checked: boolean) => void
}) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-0.5 text-start">
                <p className="text-sm font-medium leading-none">{label}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
            </div>
            <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
        </div>
    )
}
