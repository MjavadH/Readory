'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { safeRedirect } from '@/lib/auth/safe-redirect';

type PendingGoogleLink = { credential: string; nonce: string; email?: string; next?: string };

export default function LinkGooglePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [pending, setPending] = useState<PendingGoogleLink | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('readory_google_link');
      if (!raw) return router.replace('/login');
      setPending(JSON.parse(raw));
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pending || loading) return;
    setLoading(true);
    try {
      const data = await apiClient.post<{ user?: { roleName?: 'ADMIN' | 'USER' } }>(
        '/auth/google/link',
        {
          credential: pending.credential,
          nonce: pending.nonce,
          password,
        },
      );
      sessionStorage.removeItem('readory_google_link');
      toast.success('You can use Google to sign in from now on.', 'Google connected');
      router.push(
        safeRedirect(
          searchParams.get('next') ?? pending.next,
          data.user?.roleName === 'ADMIN' ? '/admin' : '/',
        ),
      );
      router.refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Incorrect password.'), 'Could not connect Google');
    } finally {
      setLoading(false);
    }
  };

  if (!pending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-muted/20 to-background px-4 py-8">
      <Card className="w-full max-w-md border-2">
        <CardHeader>
          <CardTitle>Connect Google to your Readory account</CardTitle>
          <CardDescription>
            This email already has a Readory account. Enter your Readory password to securely
            continue with Google.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{pending.email}</span>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                type="password"
                autoComplete="current-password"
                placeholder="Readory password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || password.length < 8}>
              {loading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}Continue
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            <Link className="text-primary hover:underline" href="/login">
              Back to sign in
            </Link>
            <Link className="text-primary hover:underline" href="/login">
              Forgot password?
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
