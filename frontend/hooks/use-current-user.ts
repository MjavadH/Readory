import * as React from 'react';

import { apiClient } from '@/lib/api-client';

export type Permission =
  | 'MANAGE_BOOKS'
  | 'MANAGE_USERS'
  | 'MANAGE_FINANCE'
  | 'MANAGE_STAFF'
  | 'MANAGE_NOTIFICATIONS';

export type CurrentUser = {
  id: number;
  userId: number;
  email: string;
  username: string;
  walletBalance: number;
  avatarKey?: string | null;
  roleName?: 'ADMIN';
  role?: 'ADMIN';
  permissions?: Permission[];
};

type Status = 'loading' | 'authenticated' | 'unauthenticated';

type State = {
  user: CurrentUser | null;
  status: Status;
};

let state: State = { user: null, status: 'loading' };
let inflight: Promise<CurrentUser | null> | null = null;
let hasFetched = false;
const listeners = new Set<() => void>();

const emit = (next: State) => {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
};

const fetchProfile = (force = false): Promise<CurrentUser | null> => {
  if (inflight && !force) return inflight;
  if (hasFetched && !force) return Promise.resolve(state.user);

  inflight = apiClient
    .get<CurrentUser>('/auth/profile', { authRequired: true })
    .then((user) => {
      hasFetched = true;
      const normalizedUser = user
        ? {
            ...user,
            id: user.id ?? user.userId,
            userId: user.userId ?? user.id,
            role: user.roleName,
          }
        : null;
      emit({ user: normalizedUser, status: 'authenticated' });
      return normalizedUser;
    })
    .catch(() => {
      hasFetched = true;
      emit({ user: null, status: 'unauthenticated' });
      return null;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => state;

const serverSnapshot: State = { user: null, status: 'loading' };
const getServerSnapshot = (): State => serverSnapshot;

export function useCurrentUser() {
  const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  React.useEffect(() => {
    void fetchProfile();

    const handleSessionExpired = () => {
      hasFetched = true;
      emit({ user: null, status: 'unauthenticated' });
    };

    window.addEventListener('auth-session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth-session-expired', handleSessionExpired);
    };
  }, []);

  const refresh = React.useCallback(() => fetchProfile(true), []);

  const clear = React.useCallback(() => {
    hasFetched = true;
    emit({ user: null, status: 'unauthenticated' });
  }, []);

  return {
    user: snapshot.user,
    status: snapshot.status,
    isLoading: snapshot.status === 'loading',
    isAuthenticated: snapshot.status === 'authenticated',
    isAdmin: snapshot.user?.roleName === 'ADMIN',
    isSuperAdmin: snapshot.user?.id === 1,
    hasPermission: (permission: Permission | Permission[]) => {
      if (snapshot.user?.roleName !== 'ADMIN') return false;
      if (snapshot.user.id === 1) return true;
      const required = Array.isArray(permission) ? permission : [permission];
      return required.some((p) => Boolean(snapshot.user?.permissions?.includes(p)));
    },
    refresh,
    clear,
  };
}
