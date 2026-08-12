'use client';

import { useCallback, useRef } from 'react';
import { useGoogleOneTapLogin } from '@react-oauth/google';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { useCurrentUser } from '@/hooks/use-current-user';
import { createGoogleNonce } from '@/lib/auth/safe-redirect';

type GoogleAuthResponse = { created?: boolean; requiresLink?: boolean; email?: string };

function GoogleOneTapInner() {
  const { isAuthenticated, isLoading, refresh } = useCurrentUser();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nonce = useRef(createGoogleNonce()).current;

  const refreshSamePage = useCallback(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();
  }, [pathname, router, searchParams]);

  useGoogleOneTapLogin({
    nonce,
    onSuccess: async ({ credential }) => {
      if (!credential) return;
      try {
        const data = await apiClient.post<GoogleAuthResponse>('/auth/google', {
          credential,
          nonce,
        });
        if (data.requiresLink) return;
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
    cancel_on_tap_outside: true,
    disabled: isLoading || isAuthenticated,
    auto_select: false,
  });

  return null;
}

export function GoogleOneTap() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || clientId.includes('your_client_id_here')) return null;
  return <GoogleOneTapInner />;
}
