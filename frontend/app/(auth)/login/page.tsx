'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, KeyRound, Loader2, Lock, Mail, MailCheck, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { safeRedirect } from '@/lib/auth/safe-redirect';
import { useToast } from '@/providers/toast-provider';

type RoleName = 'ADMIN' | 'USER';

type ProfileResponse = {
  roleName?: RoleName;
};

const authSchema = z.object({
  email: z.string().min(1, { message: 'Email or Username is required' }),
  username: z.string().optional(),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
});

const otpSchema = z.object({
  otp: z
    .string()
    .length(6, { message: 'OTP must be 6 digits' })
    .regex(/^\d{6}$/, { message: 'OTP must be numeric' }),
});

const forgotSchema = z.object({
  email: z
    .string()
    .email({ message: 'Please provide a valid email address.' })
    .regex(/^[a-zA-Z0-9.]+@gmail\.com$/, { message: 'Email must be a valid Gmail address.' }),
});

type AuthFormValues = z.infer<typeof authSchema>;
type OTPFormValues = z.infer<typeof otpSchema>;
type ForgotFormValues = z.infer<typeof forgotSchema>;
type ViewMode = 'login' | 'register' | 'otp' | 'forgot' | 'forgot-sent';

const panel = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

export default function AuthPage() {
  const t = useTranslations('Auth');
  const g = useTranslations('General');
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<ViewMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const authForm = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: '', username: '', password: '' },
  });

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const forgotForm = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    const checkSession = async () => {
      try {
        const profile = await apiClient.get<ProfileResponse>('/auth/profile');
        router.replace(profile.roleName === 'ADMIN' ? '/admin' : '/');
      } catch {
        setIsCheckingSession(false);
      }
    };
    void checkSession();
  }, [router]);

  const handleLogin = async (values: AuthFormValues) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post<{ user?: { roleName?: RoleName } }>('/auth/login', {
        identifier: values.email.trim(),
        password: values.password,
      });

      const redirectTo = new URLSearchParams(window.location.search).get('next');
      router.push(safeRedirect(redirectTo, data.user?.roleName === 'ADMIN' ? '/admin' : '/'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('ErrorLogin')), t('LoginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (values: AuthFormValues) => {
    if (!values.username || values.username.length < 3) {
      authForm.setError('username', { message: t('UsernameChars') });
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/register', {
        email: values.email.trim(),
        username: values.username.trim(),
        password: values.password,
      });

      setRegisteredEmail(values.email.trim());
      setMode('otp');
      authForm.reset();
      toast.info(t('EnterOTP'), t('VerificationSent'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('ErrorRegistration')), t('RegistrationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerify = async (values: OTPFormValues) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const data = await apiClient.post<{ user?: { roleName?: RoleName } }>('/auth/verify-otp', {
        email: registeredEmail,
        otp: values.otp,
      });
      toast.success(t('AccountActive'), t('Verified'));
      const redirectTo = new URLSearchParams(window.location.search).get('next');
      router.push(safeRedirect(redirectTo, data.user?.roleName === 'ADMIN' ? '/admin' : '/'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('ErrorVerification')), t('VerificationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (values: ForgotFormValues) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: values.email.trim() });
      setResetEmail(values.email.trim());
      setMode('forgot-sent');
      forgotForm.reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('ErrorForgotPassword')), t('ForgotPasswordFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    setMode('login');
    authForm.reset();
    otpForm.reset();
    forgotForm.reset();
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const subtitle =
    mode === 'login'
      ? t('SignInEmailUsername')
      : mode === 'register'
        ? t('CreateAccount')
        : mode === 'otp'
          ? t('VerifyEmail')
          : t('ResetYourPassword');

  const title =
    mode === 'login'
      ? t('SignIn')
      : mode === 'register'
        ? t('Register')
        : mode === 'otp'
          ? t('OTP')
          : t('ForgotPassword');

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
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">{subtitle}</p>
        </motion.div>

        <Card className="border-2 overflow-hidden">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl sm:text-2xl">{title}</CardTitle>
            <CardDescription>
              {mode === 'otp' && t('EnterCode', { Email: registeredEmail })}
              {mode === 'forgot' && t('ForgotPasswordHint')}
              {mode === 'forgot-sent' && t('ResetLinkSentTo', { Email: resetEmail })}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait" initial={false}>
              {(mode === 'login' || mode === 'register') && (
                <motion.div key={mode} {...panel}>
                  <Form {...authForm}>
                    <form
                      onSubmit={authForm.handleSubmit(
                        mode === 'login' ? handleLogin : handleRegister,
                      )}
                      className="space-y-4"
                    >
                      {mode === 'register' && (
                        <FormField
                          control={authForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Username')}</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder={t('Username')}
                                    disabled={isLoading}
                                    className="ps-10"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={authForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {mode === 'login' ? t('EmailUsername') : t('EmailAddress')}
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder={
                                    mode === 'login' ? t('EmailUsername') : t('ExampleEmail')
                                  }
                                  disabled={isLoading}
                                  className="ps-10"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={authForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between gap-2">
                              <FormLabel>{t('Password')}</FormLabel>
                              {mode === 'login' && (
                                <button
                                  type="button"
                                  onClick={() => setMode('forgot')}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  {t('ForgotPasswordQuestion')}
                                </button>
                              )}
                            </div>
                            <FormControl>
                              <div className="relative">
                                <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder={t('EnterPassword')}
                                  type="password"
                                  disabled={isLoading}
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
                        {mode === 'login' ? t('SignIn') : t('Register')}
                      </Button>
                    </form>
                  </Form>

                  <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <span>{t('or')}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <GoogleSignInButton />

                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    {mode === 'login' ? t('NoAccount') : t('HaveAccount')}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        authForm.reset();
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      {mode === 'login' ? t('Register') : t('SignIn')}
                    </button>
                  </div>
                </motion.div>
              )}

              {mode === 'otp' && (
                <motion.div key="otp" {...panel}>
                  <Form {...otpForm}>
                    <form onSubmit={otpForm.handleSubmit(handleOTPVerify)} className="space-y-6">
                      <FormField
                        control={otpForm.control}
                        name="otp"
                        render={({ field }) => (
                          <FormItem className="flex flex-col items-center">
                            <FormControl>
                              <div dir="ltr">
                                <InputOTP maxLength={6} disabled={isLoading} {...field}>
                                  <InputOTPGroup>
                                    {[0, 1, 2, 3, 4, 5].map((i) => (
                                      <InputOTPSlot key={i} index={i} />
                                    ))}
                                  </InputOTPGroup>
                                </InputOTP>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                        {t('Verify')}
                      </Button>
                    </form>
                  </Form>

                  <Button variant="ghost" className="mt-4 w-full" onClick={goToLogin}>
                    <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                    {t('BackToSignIn')}
                  </Button>
                </motion.div>
              )}

              {mode === 'forgot' && (
                <motion.div key="forgot" {...panel}>
                  <Form {...forgotForm}>
                    <form
                      onSubmit={forgotForm.handleSubmit(handleForgotPassword)}
                      className="space-y-4"
                    >
                      <FormField
                        control={forgotForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('EmailAddress')}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder={t('ExampleEmail')}
                                  disabled={isLoading}
                                  className="ps-10"
                                  inputMode="email"
                                  autoComplete="email"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="me-2 h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="me-2 h-4 w-4" />
                        )}
                        {t('SendResetLink')}
                      </Button>
                    </form>
                  </Form>

                  <Button variant="ghost" className="mt-4 w-full" onClick={goToLogin}>
                    <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                    {t('BackToSignIn')}
                  </Button>
                </motion.div>
              )}

              {mode === 'forgot-sent' && (
                <motion.div key="forgot-sent" {...panel} className="text-center">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
                  >
                    <MailCheck className="h-7 w-7" />
                  </motion.div>
                  <p className="mt-4 text-sm text-muted-foreground">{t('CheckInboxHint')}</p>
                  <Button variant="ghost" className="mt-6 w-full" onClick={goToLogin}>
                    <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
                    {t('BackToSignIn')}
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
