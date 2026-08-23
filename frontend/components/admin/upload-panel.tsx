'use client';

import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import type * as React from 'react';
import { FileUploadPicker } from '@/components/admin/file-upload-picker';
import { UploadProgressBar } from '@/components/admin/upload-progress-bar';
import { cn } from '@/lib/utils';

export type UploadPanelProps = {
  /** Visual kind forwarded to the picker */
  kind?: 'image' | 'file';
  description: string;
  accept: string;
  multiple?: boolean;
  maxFiles?: number;

  files: File[];
  onFilesChange: (files: File[]) => void;

  isAllowedFile?: (file: File) => boolean;
  blockedErrorText?: string;
  maxFilesErrorText?: (max: number) => string;
  dropTitleIdle?: string;
  helperText?: string;
  allowAddMore?: boolean;

  uploading?: boolean;
  disabled?: boolean;
  progress?: number;
  progressLabel?: string;

  error?: string | null;
  onErrorChange?: (error: string | null) => void;

  /** Non-blocking hint rendered above the actions (e.g. "append disabled") */
  notice?: React.ReactNode;
  /** Action buttons for this panel */
  actions: React.ReactNode;
  className?: string;
};

/**
 * Shared shell for every upload flow (images / text / pdf).
 * Keeps picker + progress + error + actions consistent across tabs.
 */
export function UploadPanel({
  kind = 'file',
  description,
  accept,
  multiple = false,
  maxFiles,
  files,
  onFilesChange,
  isAllowedFile,
  blockedErrorText,
  maxFilesErrorText,
  dropTitleIdle,
  helperText,
  allowAddMore = false,
  uploading = false,
  disabled = false,
  progress = 0,
  progressLabel,
  error = null,
  onErrorChange,
  notice,
  actions,
  className,
}: UploadPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn('space-y-4', className)}
    >
      <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>

      <FileUploadPicker
        kind={kind}
        files={files}
        onFilesChange={onFilesChange}
        accept={accept}
        multiple={multiple}
        maxFiles={maxFiles}
        disabled={disabled || uploading}
        uploading={uploading}
        allowAddMore={allowAddMore}
        isAllowedFile={isAllowedFile}
        blockedErrorText={blockedErrorText}
        maxFilesErrorText={maxFilesErrorText}
        dropTitleIdle={dropTitleIdle}
        helperText={helperText}
        error={error}
        onErrorChange={onErrorChange}
      />

      {uploading && (
        <div className="space-y-1.5">
          <UploadProgressBar value={progress} />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{progressLabel}</span>
            <span className="tabular-nums font-mono">{progress}%</span>
          </div>
        </div>
      )}

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </motion.p>
      )}

      {notice}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>
    </motion.div>
  );
}
