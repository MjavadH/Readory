'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { useCurrentUser } from '@/hooks/use-current-user';
import { createGoogleNonce } from '@/lib/auth/safe-redirect';

type GoogleAuthResponse = {
  created?: boolean;
  requiresLink?: boolean;
  email?: string;
};

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  cancel_on_tap_outside?: boolean;
  auto_select?: boolean;
  context?: 'signin' | 'signup' | 'use';
};

type GoogleAccountsId = {
  initialize: (config: GoogleIdConfiguration) => void;
  prompt: () => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

function GoogleOneTapInner({ clientId }: { clientId: string }) {
  const { isAuthenticated, isLoading, refresh } = useCurrentUser();

  const toast = useToast();
  const router = useRouter();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [nonce] = useState(() => createGoogleNonce());
  const initializedRef = useRef(false);

  const refreshSamePage = useCallback(() => {
    const qs = searchParams.toString();

    router.replace(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }, [pathname, router, searchParams]);

  const handleCredential = useCallback(
    async ({ credential }: GoogleCredentialResponse) => {
      if (!credential) {
        toast.error('Google did not return a credential.', 'Google sign-in failed');
        return;
      }

      try {
        const data = await apiClient.post<GoogleAuthResponse>('/auth/google', {
          credential,
          nonce,
        });

        if (data.requiresLink) {
          return;
        }

        toast.success(
          data.created ? 'Your Readory account is ready.' : 'Welcome back to Readory.',
          'Signed in with Google',
        );

        await refresh();
        refreshSamePage();
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'Google sign-in failed.'), 'Google sign-in failed');
      }
    },
    [nonce, refresh, refreshSamePage, toast],
  );

  useEffect(() => {
    if (isLoading || isAuthenticated) {
      return;
    }

    if (initializedRef.current) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const initializeGoogleOneTap = () => {
      if (cancelled) {
        return;
      }

      const googleId = window.google?.accounts?.id;

      if (!googleId) {
        retryTimer = setTimeout(initializeGoogleOneTap, 100);
        return;
      }

      if (initializedRef.current) {
        return;
      }

      initializedRef.current = true;

      googleId.initialize({
        client_id: clientId,
        nonce,
        callback: handleCredential,
        cancel_on_tap_outside: true,
        auto_select: false,
        context: 'signin',
      });

      googleId.prompt();
    };

    initializeGoogleOneTap();

    return () => {
      cancelled = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      window.google?.accounts?.id?.cancel();
    };
  }, [clientId, handleCredential, isAuthenticated, isLoading, nonce]);

  return null;
}

export function GoogleOneTap() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId || clientId.includes('your_client_id_here')) {
    return null;
  }

  return <GoogleOneTapInner clientId={clientId} />;
}
