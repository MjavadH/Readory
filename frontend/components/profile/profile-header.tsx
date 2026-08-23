'use client';

import { motion } from 'framer-motion';
import { CalendarDays, UserRound } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { getAvatarUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

type ProfileHeaderProps = {
  username: string;
  avatarKey?: string | null;
  memberSince?: string | null;
  className?: string;
};

export function ProfileHeader({ username, avatarKey, memberSince, className }: ProfileHeaderProps) {
  const t = useTranslations('PublicProfile');
  const format = useFormatter();
  const avatarUrl = getAvatarUrl(avatarKey) ?? null;

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm sm:rounded-[2rem]',
        className,
      )}
    >
      {/* Cover */}
      <div className="relative h-28 overflow-hidden sm:h-40 lg:h-48">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            aria-hidden
            fill
            priority
            sizes="100vw"
            className="scale-125 object-cover opacity-40 blur-2xl saturate-150"
          />
        ) : null}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-br from-primary/25 via-secondary/25 to-muted"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.28),transparent_55%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.08),transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-card via-card/50 to-transparent"
        />
      </div>

      {/* Identity */}
      <div className="relative px-4 pb-5 sm:px-7 sm:pb-7">
        <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3 sm:gap-4">
            <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-muted shadow-lg sm:size-28 sm:rounded-3xl">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={username}
                  width={128}
                  height={128}
                  className="size-full object-cover"
                />
              ) : (
                <UserRound aria-hidden className="size-9 text-muted-foreground sm:size-12" />
              )}
            </div>

            <div className="min-w-0 pb-1 sm:pb-2">
              <h1 className="truncate text-xl font-black tracking-tight text-foreground sm:text-3xl">
                @{username}
              </h1>
              {memberSince ? (
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                  <CalendarDays aria-hidden className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate">
                    {t('MemberSince', {
                      date: format.dateTime(new Date(memberSince), {
                        year: 'numeric',
                        month: 'long',
                      }),
                    })}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
