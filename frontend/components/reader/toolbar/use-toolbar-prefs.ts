'use client';

import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PREFS, PREFS_STORAGE_KEY, type ToolbarPrefs } from './types';

function readStoredPrefs(): ToolbarPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<ToolbarPrefs>;
    return {
      brightness: parsed.brightness ?? DEFAULT_PREFS.brightness,
      fullscreen: parsed.fullscreen ?? DEFAULT_PREFS.fullscreen,
      readMode: parsed.readMode ?? DEFAULT_PREFS.readMode,
      chapters: parsed.chapters ?? DEFAULT_PREFS.chapters,
      zoom: parsed.zoom ?? DEFAULT_PREFS.zoom,
      typography: parsed.typography ?? DEFAULT_PREFS.typography,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useToolbarPrefs() {
  const [prefs, setPrefs] = useState<ToolbarPrefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  // Read after mount so SSR markup and first client render match.
  useEffect(() => {
    const timer = setTimeout(() => {
      setPrefs(readStoredPrefs());
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage can be unavailable (private mode / quota) */
    }
  }, [prefs, hydrated]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFS_STORAGE_KEY) setPrefs(readStoredPrefs());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(
    (key: keyof ToolbarPrefs) => setPrefs((p) => ({ ...p, [key]: !p[key] })),
    [],
  );
  const reset = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  return { prefs, toggle, reset };
}
