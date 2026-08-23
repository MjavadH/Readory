'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  MonitorSmartphone,
  Smartphone,
  Laptop,
  Monitor,
  Globe,
  Loader2,
  LogOut,
  ShieldCheck,
  Trash2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { formatUpdateTime } from '@/lib/time';

export type DeviceSession = {
  id: string;
  deviceOs: string | null;
  deviceBrowser: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  isCurrentDevice: boolean;
};

function DeviceIcon({ os }: { os: string | null }) {
  const className = 'w-5 h-5 md:w-6 md:h-6 text-primary';
  if (os === 'Android' || os === 'iOS') return <Smartphone className={className} />;
  if (os === 'macOS') return <Laptop className={className} />;
  if (os === 'Windows' || os === 'Linux') return <Monitor className={className} />;
  return <Globe className={className} />;
}

export default function ConnectedDevices() {
  const t = useTranslations('UserDashboard');
  const ti = useTranslations('Time');
  const toast = useToast();
  const router = useRouter();

  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<DeviceSession[]>('/auth/sessions');
      setSessions(res);
    } catch (err) {
      setError(getApiErrorMessage(err, t('Devices.LoadFailed')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    void apiClient
      .get<DeviceSession[]>('/auth/sessions')
      .then((res) => {
        if (cancelled) return;
        setError(null);
        setSessions(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, t('Devices.LoadFailed')));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleRevoke = async (session: DeviceSession) => {
    if (revokingId || revokingAll) return;
    setRevokingId(session.id);
    try {
      await apiClient.delete(`/auth/sessions/${encodeURIComponent(session.id)}`);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      toast.success(t('Devices.RevokedOne'));
      if (session.isCurrentDevice) router.replace('/');
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('Devices.RevokeFailed')));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    if (revokingAll || revokingId) return;
    setRevokingAll(true);
    try {
      await apiClient.delete('/auth/sessions/others');
      setSessions((current) => current.filter((item) => item.isCurrentDevice));
      toast.success(t('Devices.RevokedAll'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('Devices.RevokeFailed')));
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessionsCount = sessions.filter((session) => !session.isCurrentDevice).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card border border-border rounded-3xl md:rounded-[2.5rem] p-5 sm:p-7 md:p-10 shadow-xl shadow-black/5"
    >
      {/* Header */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 mb-6 md:mb-8 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <div className="p-2.5 bg-primary/10 rounded-2xl shrink-0">
            <MonitorSmartphone className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl md:text-2xl font-bold tracking-tight">
              {t('Devices.Title')}
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">
              {t('Devices.Subtitle')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadSessions();
          }}
          aria-label={t('Devices.Refresh')}
          className="shrink-0 p-3 rounded-2xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 md:h-20 rounded-2xl bg-muted" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm font-bold text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadSessions();
            }}
            className="px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
          >
            {t('TryAgain')}
          </button>
        </div>
      )}

      {/* List */}
      {!loading && !error && sessions.length > 0 && (
        <ul className="space-y-3 md:space-y-4">
          <AnimatePresence initial={false}>
            {sessions.map((session, index) => {
              const busy = revokingId === session.id || (revokingAll && !session.isCurrentDevice);
              return (
                <motion.li
                  key={session.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
                  className={`overflow-hidden rounded-2xl border p-4 md:p-5 transition-colors ${
                    session.isCurrentDevice
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-muted/30 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-start gap-3 md:gap-4">
                      <div className="p-2.5 rounded-2xl bg-primary/10 shrink-0">
                        <DeviceIcon os={session.deviceOs} />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-foreground truncate">
                            {session.deviceBrowser || t('Devices.UnknownBrowser')}
                            {' · '}
                            {session.deviceOs || t('Devices.UnknownOs')}
                          </span>
                          {session.isCurrentDevice && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
                              <ShieldCheck className="w-3 h-3" />
                              {t('Devices.CurrentDevice')}
                            </span>
                          )}
                        </div>

                        <p className="text-xs md:text-sm text-muted-foreground font-medium break-all">
                          {t('Devices.IpAddress')}: {session.ipAddress || '—'}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground font-medium">
                          {t('Devices.LastActive')}: {formatUpdateTime(session.lastActiveAt, ti)}
                        </p>
                        <p className="text-[11px] md:text-xs text-muted-foreground/80 font-medium">
                          {t('Devices.SignedInAt')}: {formatUpdateTime(session.createdAt, ti)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRevoke(session)}
                      className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 font-bold text-sm text-destructive hover:bg-destructive/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : session.isCurrentDevice ? (
                        <LogOut className="w-4 h-4" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {session.isCurrentDevice ? t('Devices.SignOut') : t('Devices.Revoke')}
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {/* Revoke all */}
      {!loading && !error && otherSessionsCount > 0 && (
        <div className="mt-6 md:mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {t('Devices.RevokeAllHint', { count: otherSessionsCount })}
          </p>
          <button
            type="button"
            disabled={revokingAll}
            onClick={() => void handleRevokeAll()}
            className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-2xl bg-destructive px-6 py-3.5 font-bold text-destructive-foreground shadow-lg shadow-destructive/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
          >
            {revokingAll ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
            {t('Devices.RevokeAll')}
          </button>
        </div>
      )}
    </motion.section>
  );
}
