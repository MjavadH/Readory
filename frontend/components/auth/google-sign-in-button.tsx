'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';

type RoleName = 'ADMIN' | 'USER';

type GoogleAuthResponse = {
  user?: { roleName?: RoleName };
  created?: boolean;
};

function GoogleSignInButtonInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  return (
    <div className="flex justify-center">
      <GoogleLogin
        width="360"
        theme="outline"
        shape="pill"
        text="continue_with"
        onSuccess={async ({ credential }) => {
          if (!credential) {
            toast.error('Google did not return a credential.', 'Google sign-in failed');
            return;
          }
          try {
            const data = await apiClient.post<GoogleAuthResponse>('/auth/google', { credential });
            toast.success(
              data.created ? 'Your Readory account is ready.' : 'Welcome back to Readory.',
              'Signed in with Google',
            );
            const redirectTo = searchParams.get('next');
            router.push(redirectTo || (data.user?.roleName === 'ADMIN' ? '/admin' : '/'));
            router.refresh();
          } catch (error) {
            toast.error(
              getApiErrorMessage(error, 'Google sign-in failed.'),
              'Google sign-in failed',
            );
          }
        }}
        onError={() => {
          toast.error('Please try again or use email sign-in.', 'Google sign-in failed');
        }}
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
