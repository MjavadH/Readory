'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { createGoogleNonce, safeRedirect } from '@/lib/auth/safe-redirect';

type RoleName = 'ADMIN' | 'USER';

type GoogleAuthResponse = {
  user?: { roleName?: RoleName };
  created?: boolean;
  requiresLink?: boolean;
  email?: string;
};

function GoogleSignInButtonInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [nonce] = useState(() => createGoogleNonce());

  return (
    <div className="flex justify-center">
      <GoogleLogin
        width="360"
        theme="outline"
        shape="pill"
        text="continue_with"
        nonce={nonce}
        onSuccess={async ({ credential }) => {
          if (!credential) {
            toast.error('Google did not return a credential.', 'Google sign-in failed');
            return;
          }
          try {
            const data = await apiClient.post<GoogleAuthResponse>('/auth/google', {
              credential,
              nonce,
            });
            const next = safeRedirect(
              searchParams.get('next'),
              data.user?.roleName === 'ADMIN' ? '/admin' : '/',
            );
            if (data.requiresLink) {
              sessionStorage.setItem(
                'readory_google_link',
                JSON.stringify({ credential, nonce, email: data.email, next }),
              );
              router.push(`/link-google?next=${encodeURIComponent(next)}`);
              return;
            }
            toast.success(
              data.created ? 'Your Readory account is ready.' : 'Welcome back to Readory.',
              'Signed in with Google',
            );
            router.push(next);
            router.refresh();
          } catch (error) {
            toast.error(
              getApiErrorMessage(error, 'Google sign-in failed.'),
              'Google sign-in failed',
            );
          }
        }}
        onError={() =>
          toast.error('Please try again or use email sign-in.', 'Google sign-in failed')
        }
        useOneTap={false}
      />
    </div>
  );
}

export function GoogleSignInButton() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || clientId.includes('your_client_id_here')) return null;
  return <GoogleSignInButtonInner />;
}
