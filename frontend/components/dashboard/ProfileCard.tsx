import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Upload, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { UserProfile } from '@/lib/types';
import { getAvatarUrl } from '@/lib/media';

const ACCEPTED = ['image/jpeg', 'image/webp'];

function initialsFromUsername(username: string) {
  const safe = (username || '').trim();
  if (!safe) return 'U';
  return safe.slice(0, 2).toUpperCase();
}

type Props = {
  profile: UserProfile | null;
  avatarPreview: string | null;
  avatarFile: File | null;
  avatarError: string | null;
  avatarUploading: boolean;
  onSelect: (file?: File) => void | Promise<void>;
  onUpload: () => void | Promise<void>;
  onClear: () => void;
};

export default function ProfileCard({
  profile,
  avatarPreview,
  avatarFile,
  avatarError,
  avatarUploading,
  onSelect,
  onUpload,
  onClear,
}: Props) {
  const t = useTranslations('UserDashboard');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (avatarUploading) return;
    inputRef.current?.click();
  };

  useEffect(() => {
    if (!avatarFile && inputRef.current) inputRef.current.value = '';
  }, [avatarFile]);

  const avatarSrc = avatarPreview || getAvatarUrl(profile?.avatarKey);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-lg shadow-black/5 sm:p-7 lg:sticky lg:top-6 dark:shadow-black/30"
    >
      <div className="pointer-events-none absolute top-0 ltr:right-0 rtl:left-0 p-5 opacity-[0.06]">
        <ShieldCheck className="h-20 w-20" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-6 sm:text-start lg:flex-col lg:text-center">
        {/* Avatar + camera trigger */}
        <div className="shrink-0">
          <motion.button
            type="button"
            onClick={openPicker}
            aria-label={t('UploadAvatar')}
            whileHover={{ scale: avatarUploading ? 1 : 1.02 }}
            whileTap={{ scale: avatarUploading ? 1 : 0.98 }}
            transition={{ duration: 0.15 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void onSelect(e.dataTransfer.files?.[0]);
            }}
            className={`group relative block h-24 w-24 rounded-3xl outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:h-28 sm:w-28 ${
              avatarUploading ? 'cursor-wait' : 'cursor-pointer'
            }`}
          >
            <span
              className={`flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border-4 border-background bg-gradient-to-tr from-primary/80 to-primary/30 ring-4 transition-colors ${
                dragging ? 'ring-primary/50' : 'ring-primary/10'
              }`}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={t('CurrentAvatar')}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary-foreground sm:text-3xl">
                  {initialsFromUsername(profile?.username || '')}
                </span>
              )}
            </span>

            {/* hover/focus overlay */}
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-3xl bg-foreground/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera className="h-6 w-6 text-background" />
            </span>

            {/* camera badge next to the image */}
            <span className="absolute -bottom-1 ltr:-right-1 rtl:-left-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md">
              {avatarUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </span>
          </motion.button>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            disabled={avatarUploading}
            onChange={(e) => void onSelect(e.target.files?.[0])}
            className="sr-only"
          />
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
            {profile?.username}
          </h2>
          <p className="truncate text-sm font-medium text-muted-foreground">{profile?.email}</p>
        </div>
      </div>

      {/* Pending file / error / actions */}
      <AnimatePresence initial={false}>
        {avatarError ? (
          <motion.div
            key="err"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="mt-5 flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-start">{avatarError}</span>
            </p>
          </motion.div>
        ) : null}

        {avatarFile ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-3 rounded-2xl border border-border bg-muted/50 p-3">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-start text-xs font-bold">
                  {avatarFile.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(avatarFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={avatarUploading}
                  className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                disabled={avatarUploading}
                onClick={() => void onUpload()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {avatarUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {t('UploadAvatar')}
              </motion.button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

export { ACCEPTED, initialsFromUsername };
