import React from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ContributorRole, CONTRIBUTOR_ROLE_VALUES } from "@shared/contributor-metadata";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ContributorsSearchInput } from "./contributors-search-input";

export type BookContributorEntry = {
    contributorId: number;
    role: ContributorRole;
    name?: string;
};

export function ContributorsField({
                                 value,
                                 onChange,
                                 isRTL,
                                 t,
                             }: {
    value: BookContributorEntry[];
    onChange: (next: BookContributorEntry[]) => void;
    isRTL: boolean;
    t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
    const patchRow = (index: number, patch: Partial<BookContributorEntry>) => {
        const next = value.map((row, i) => (i === index ? { ...row, ...patch } : row));
        onChange(next);
    };

    const removeRow = (index: number) => {
        onChange(value.filter((_, i) => i !== index));
    };

    const addRow = () => {
        onChange([...value, { contributorId: 0, role: ContributorRole.AUTHOR }]);
    };

    const lastRow = value[value.length - 1];
    const canAdd = !lastRow || lastRow.contributorId > 0;

    return (
        <div className="space-y-3">
            <AnimatePresence initial={false}>
                {value.map((row, index) => {
                    const otherIds = value
                        .filter((_, i) => i !== index)
                        .map((r) => r.contributorId)
                        .filter((id) => id > 0);

                    const selectedValue =
                        row.contributorId > 0
                            ? { id: row.contributorId, name: row.name ?? "" }
                            : null;

                    return (
                        <motion.div
                            key={`contributor-row-${index}`}
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
                        >
                            <ContributorsSearchInput
                                value={selectedValue}
                                onChange={(next) =>
                                    patchRow(index, {
                                        contributorId: next?.id ?? 0,
                                        name: next?.name,
                                    })
                                }
                                excludeIds={otherIds}
                                isRTL={isRTL}
                                t={t}
                            />

                            <Select
                                dir={isRTL ? "rtl" : "ltr"}
                                value={row.role}
                                onValueChange={(v) =>
                                    patchRow(index, { role: v as ContributorRole })
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                    {CONTRIBUTOR_ROLE_VALUES.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {t(`ContributorRole_${role}`)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex justify-end sm:block">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeRow(index)}
                                    aria-label={t("RemoveContributor")}
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {value.length === 0 && (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>{t("NoContributorsYet")}</span>
                </div>
            )}

            <div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={addRow}
                    disabled={!canAdd}
                    className="w-full sm:w-auto"
                >
                    <Plus className="me-2 h-4 w-4" />
                    {t("AddContributor")}
                </Button>
            </div>
        </div>
    );
}