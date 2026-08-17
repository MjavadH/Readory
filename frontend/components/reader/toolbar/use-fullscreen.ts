'use client';

import { useCallback, useEffect, useState } from 'react';

export function useFullscreen(target?: HTMLElement | null) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const el = target ?? document.documentElement;
      if (el?.requestFullscreen) await el.requestFullscreen();
    } catch {
      /* fullscreen can be blocked by the browser */
    }
  }, [target]);

  return { isFullscreen, toggleFullscreen };
}
