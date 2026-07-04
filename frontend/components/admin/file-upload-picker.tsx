import * as React from "react";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, ImageIcon, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {useTranslations} from "next-intl";

type FileUploadPickerProps = {
    kind?: "image" | "file";
    files: File[];
    onFilesChange: (files: File[]) => void;

    accept: string;
    multiple?: boolean;

    maxFiles?: number;
    isAllowedFile?: (file: File) => boolean;

    disabled?: boolean;

    // UI states controlled by parent
    uploading?: boolean;
    success?: boolean;

    // error handling
    error?: string | null;
    onErrorChange?: (err: string | null) => void;

    // copy
    dropTitleIdle?: string;
    dropTitleActive?: string;
    helperText?: string;
    browseLabel?: string;

    // selection validation messages
    blockedErrorText?: string; // e.g. "Only JPG/JPEG/WebP are allowed"
    maxFilesErrorText?: (max: number) => string;

    // behavior
    allowAddMore?: boolean; // show “Browse more” even when files already selected

    // custom actions slot
    actions?: React.ReactNode;

    className?: string;
};

function Translate(key: string){
    const t = useTranslations('AdminPage.MediaLibrary');
    return t(key)
}

function fileKey(f: File) {
    return `${f.name}::${f.size}::${f.lastModified}`;
}

export function FileUploadPicker({
                                     kind = "file",
                                     files,
                                     onFilesChange,
                                     accept,
                                     multiple = false,
                                     maxFiles,
                                     isAllowedFile = () => true,
                                     disabled = false,
                                     uploading = false,
                                     success = false,
                                     error = null,
                                     onErrorChange,
                                     dropTitleIdle = Translate("DragDropYourFiles"),
                                     dropTitleActive = Translate("DropFileHere"),
                                     helperText = "",
                                     browseLabel = Translate("BrowseFiles"),
                                     blockedErrorText = "Some files are not allowed",
                                     maxFilesErrorText = (m) => `Maximum ${m} files`,
                                     allowAddMore = false,
                                     actions,
                                     className,
                                 }: FileUploadPickerProps) {
    const t = useTranslations('AdminPage.MediaLibrary');
    const inputId = useId();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const totalSize = useMemo(
        () => files.reduce((acc, f) => acc + (f.size || 0), 0),
        [files]
    );

    const setErr = (msg: string | null) => {
        onErrorChange?.(msg);
    };

    const applyIncoming = (incoming: File[]) => {
        if (disabled || uploading) return;

        let next = incoming;

        // if single file mode, keep only first
        if (!multiple) next = next.slice(0, 1);

        const allowed = next.filter(isAllowedFile);
        const blockedCount = next.length - allowed.length;

        let finalFiles = allowed;
        let err: string | null = null;

        if (blockedCount > 0) err = blockedErrorText;

        if (typeof maxFiles === "number" && maxFiles > 0 && allowed.length > maxFiles) {
            finalFiles = allowed.slice(0, maxFiles);
            err = maxFilesErrorText(maxFiles);
        }

        if (!finalFiles.length) {
            err = err ?? "Please select valid files";
        }

        onFilesChange(finalFiles);
        setErr(err);

        // allow selecting same file again
        if (inputRef.current) inputRef.current.value = "";
    };

    const removeFile = (f: File) => {
        const k = fileKey(f);
        const next = files.filter((x) => fileKey(x) !== k);
        onFilesChange(next);
        if (next.length === 0) setErr(null);
    };

    const clearAll = () => {
        onFilesChange([]);
        setErr(null);
    };

    const Icon = kind === "image" ? ImageIcon : FileText;

    return (
        <div className={cn("space-y-4", className)}>
            {files.length === 0 ? (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (disabled || uploading) return;
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (disabled || uploading) return;
                        applyIncoming(Array.from(e.dataTransfer.files ?? []));
                    }}
                    className={cn(
                        "relative border-2 border-dashed rounded-xl p-8 md:p-12 text-center transition-all duration-300",
                        isDragging
                            ? "border-primary bg-primary/10 scale-[1.02] shadow-lg"
                            : "border-border hover:border-primary/50 hover:bg-muted/30",
                        (disabled || uploading) && "opacity-60 pointer-events-none"
                    )}
                >
                    <div className="flex flex-col items-center gap-4">
                        <div
                            className={cn(
                                "flex size-16 md:size-20 items-center justify-center rounded-full transition-all duration-300",
                                isDragging
                                    ? "bg-primary/20 ring-4 ring-primary/30 scale-110"
                                    : "bg-muted ring-2 ring-border"
                            )}
                        >
                            <Upload className={cn("size-8 md:size-10 transition-colors",
                                    isDragging ? "text-primary" : "text-muted-foreground"
                            )}
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="text-base md:text-lg font-semibold">
                                {isDragging ? dropTitleActive : dropTitleIdle}
                            </p>
                            {helperText ? (
                                <p className="text-sm text-muted-foreground">{helperText}</p>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t("Or")}</p>
                            )}
                        </div>

                        <input
                            ref={inputRef}
                            id={inputId}
                            type="file"
                            accept={accept}
                            multiple={multiple}
                            disabled={disabled || uploading}
                            onChange={(e) => applyIncoming(Array.from(e.target.files ?? []))}
                            className="hidden"
                        />

                        <label htmlFor={inputId}>
                            <Button variant="default" size="lg" className="cursor-pointer" asChild>
                                <span>
                                    <Icon className="size-4 me-2" />
                                    {browseLabel}
                                </span>
                            </Button>
                        </label>
                    </div>

                    {error && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
                            <AlertCircle className="size-4" />
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className={cn(
                        "relative overflow-hidden rounded-xl border-2 transition-all duration-300",
                        success
                            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                            : "border-border bg-muted/30",
                        uploading && "animate-pulse",
                        (disabled || uploading) && "opacity-95"
                    )}
                >
                    <div className="flex items-start gap-4 p-4">
                        <div
                            className={cn(
                                "relative flex size-16 items-center justify-center rounded-lg ring-2 transition-all shrink-0",
                                success
                                    ? "bg-green-100 dark:bg-green-900/30 ring-green-500"
                                    : "bg-primary/10 ring-primary/30"
                            )}
                        >
                            {success ? (
                                <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
                            ) : uploading ? (
                                <Loader2 className="size-8 text-primary animate-spin" />
                            ) : (
                                <Icon className="size-8 text-primary" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{t("NFilesSelected", {NFiles: files.length})}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                ~{(totalSize / 1024).toFixed(1)} KB
                                {uploading && t("Uploading")}
                                {success && t("UploadComplete")}
                            </p>

                            <div className="mt-3 grid gap-2">
                                {files.slice(0, 6).map((f) => (
                                    <div key={fileKey(f)} className="flex items-center justify-between gap-2 text-xs">
                                        <span className="truncate">{f.name}</span>
                                        {!uploading && !success && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => removeFile(f)}
                                            >
                                                <X className="size-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                {files.length > 6 && (
                                    <p className="text-xs text-muted-foreground">+{files.length - 6} {t("More")}</p>
                                )}
                            </div>

                            {error && (
                                <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
                                    <AlertCircle className="size-4 shrink-0" />
                                    <span className="text-xs">{error}</span>
                                </div>
                            )}

                            {(allowAddMore || actions) && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {allowAddMore && !uploading && !success && (
                                        <>
                                            <input
                                                ref={inputRef}
                                                id={inputId}
                                                type="file"
                                                accept={accept}
                                                multiple={multiple}
                                                disabled={disabled || uploading}
                                                onChange={(e) => applyIncoming(Array.from(e.target.files ?? []))}
                                                className="hidden"
                                            />
                                            <label htmlFor={inputId}>
                                                <Button variant="outline" size="sm" asChild>
                                                    <span>
                                                        <Upload className="size-4 me-2" />
                                                        {t("BrowseMore")}
                                                    </span>
                                                </Button>
                                            </label>
                                        </>
                                    )}
                                    {actions}
                                </div>
                            )}
                        </div>

                        {!uploading && !success && (
                            <Button variant="ghost" size="icon" onClick={clearAll} className="shrink-0">
                                <X className="size-4" />
                            </Button>
                        )}
                    </div>

                    {uploading && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
                            <div className="h-full bg-primary animate-pulse w-full" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}