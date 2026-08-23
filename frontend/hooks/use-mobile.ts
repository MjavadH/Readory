import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

function subscribeToMediaQuery(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', onStoreChange);

  return () => mql.removeEventListener('change', onStoreChange);
}

function getClientSnapshot() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
}

function getServerSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribeToMediaQuery, getClientSnapshot, getServerSnapshot);
}
