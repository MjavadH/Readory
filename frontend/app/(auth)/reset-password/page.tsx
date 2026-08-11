'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { useToast } from '@/providers/toast-provider';
import { BrandLogo } from '@/components/brand-logo';

const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: 'Password must be at least 8 characters long.' })
      .max(128, { message: 'Password is too long.' }),
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type ResetFormValues = z.infer<typeof resetSchema>;

const panel = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

function scorePassword(value: string) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^a-zA-Z0-9]/.test(value)) score++;
  return Math.min(score, 4);
}

export default function ResetPasswordPage() {
  const t = useTranslations('Auth');
  const g = useTranslations('General');
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const token = searchParams.get('token') ?? '';
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const password = form.watch('newPassword');
  const strength = useMemo(() => scorePassword(password), [password]);
  const strengthLabels = [
    t('StrengthWeak'),
    t('StrengthFair'),
    t('StrengthGood'),
    t('StrengthStrong'),
  ];

  useEffect(() => {
    if (!isDone) return;
    if (countdown <= 0) {
      router.replace('/login');
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [isDone, countdown, router]);

  const onSubmit = async (values: ResetFormValues) => {
    if (isLoading || !token) return;
    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword: values.newPassword,
      });
      form.reset();
      setIsDone(true);
      toast.success(t('PasswordUpdated'), t('AllSet'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('ErrorResetPassword')), t('ResetPasswordFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-muted/20 to-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="text-center mb-6 sm:mb-8"
        >
          <Link href="/">
            <div className="inline-flex items-center justify-center">
              <BrandLogo priority className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{g('Readory')}</h1>
          </Link>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {t('ResetYourPassword')}
          </p>
        </motion.div>

        <Card className="border-2 overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl sm:text-2xl">{t('NewPassword')}</CardTitle>
            <CardDescription>
              {!token
                ? t('InvalidResetLink')
                : isDone
                  ? t('PasswordUpdatedDescription')
                  : t('NewPasswordHint')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait" initial={false}>
              {!token && (
                <motion.div key="no-token" {...panel} className="text-center">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                  >
                    <ShieldAlert className="h-7 w-7" />
                  </motion.div>
                  <p className="mt-4 text-sm text-muted-foreground">{t('RequestNewLinkHint')}</p>
                  <Button asChild className="mt-6 w-full" size="lg">
                    <Link href="/login">{t('BackToSignIn')}</Link>
                  </Button>
                </motion.div>
              )}

              {token && !isDone && (
                <motion.div key="form" {...panel}>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('NewPassword')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder={t('EnterPassword')}
                                  disabled={isLoading}
                                  autoComplete="new-password"
                                  className="ps-10 pe-10"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword((v) => !v)}
                                  aria-label={showPassword ? t('HidePassword') : t('ShowPassword')}
                                  className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {password.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex gap-1.5">
                            {[0, 1, 2, 3].map((i) => (
                              <motion.span
                                key={i}
                                initial={false}
                                animate={{ opacity: i < strength ? 1 : 0.25 }}
                                transition={{ duration: 0.2 }}
                                className={`h-1.5 flex-1 rounded-full ${
                                  strength <= 1
                                    ? 'bg-destructive'
                                    : strength === 2
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                }`}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t('PasswordStrength')}: {strengthLabels[Math.max(strength - 1, 0)]}
                          </p>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('ConfirmPassword')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <ShieldCheck className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  placeholder={t('ConfirmPassword')}
                                  disabled={isLoading}
                                  autoComplete="new-password"
                                  className="ps-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                        {t('UpdatePassword')}
                      </Button>
                    </form>
                  </Form>

                  <Button variant="ghost" className="mt-4 w-full" asChild>
                    <Link href="/login">
                      <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                      {t('BackToSignIn')}
                    </Link>
                  </Button>
                </motion.div>
              )}

              {token && isDone && (
                <motion.div key="done" {...panel} className="text-center">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="h-7 w-7" />
                  </motion.div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t('RedirectingIn', { Seconds: countdown })}
                  </p>
                  <Button asChild className="mt-6 w-full" size="lg">
                    <Link href="/login">{t('SignIn')}</Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
