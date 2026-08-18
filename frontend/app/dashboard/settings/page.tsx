'use client';

import { useEffect, useState } from 'react';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { UserProfile } from '@/lib/types';
import {
  Settings,
  User,
  Mail,
  Lock,
  Shield,
  Check,
  AlertTriangle,
  Loader2,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/providers/toast-provider';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/providers/auth-provider';
import ProfileCard from '@/components/dashboard/ProfileCard';
import { Switch } from '@/components/ui/switch';
import ConnectedDevices from '@/components/dashboard/ConnectedDevices';
import Link from 'next/link';

type ProfileVisibilitySettings = {
  showMemberSince: boolean;
  showFavorites: boolean;
  showRecentRatings: boolean;
  showRecentlyReading: boolean;
};

const defaultVisibilitySettings: ProfileVisibilitySettings = {
  showMemberSince: true,
  showFavorites: false,
  showRecentRatings: false,
  showRecentlyReading: false,
};

export default function SettingsPage() {
  const t = useTranslations('UserDashboard');
  const toast = useToast();
  const auth = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [visibilitySettings, setVisibilitySettings] =
    useState<ProfileVisibilitySettings>(defaultVisibilitySettings);
  const [initialVisibilitySettings, setInitialVisibilitySettings] =
    useState<ProfileVisibilitySettings>(defaultVisibilitySettings);

  // Form states
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await apiClient.get<UserProfile>('/auth/profile');
        setProfile(res);
        setUsername(res.username);
        const publicProfile = await apiClient.get<{
          viewer: { settings?: ProfileVisibilitySettings };
        }>(`/public/profiles/${encodeURIComponent(res.username)}`);

        const loadedSettings = publicProfile.viewer.settings ?? defaultVisibilitySettings;
        setVisibilitySettings(loadedSettings);
        setInitialVisibilitySettings(loadedSettings);
      } catch {
        setError(t('FailedLoadProfile'));
      } finally {
        setLoading(false);
      }
    }
    void fetchProfile();
  }, [t]);

  const validateAvatarFile = async (file: File) => {
    if (!['image/jpeg', 'image/webp'].includes(file.type)) return t('AvatarInvalidType');
    if (file.size >= 5 * 1024 * 1024) return t('AvatarInvalidSize');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = url;
      });
      if (img.naturalWidth > 1024 || img.naturalHeight > 1024) return t('AvatarInvalidDimensions');
    } catch {
      return t('AvatarInvalidImage');
    } finally {
      URL.revokeObjectURL(url);
    }
    return null;
  };

  const handleAvatarSelected = async (file?: File) => {
    setAvatarError(null);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    if (!file) return;
    const validationError = await validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || avatarUploading) return;
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', avatarFile);
      const res = await apiClient.post<{ user: UserProfile }>('/users/me/avatar', form);
      setProfile((current) => (current ? { ...current, ...res.user } : res.user));
      await auth.refresh();
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      toast.success(t('AvatarUpdated'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('AvatarUpdateFailed')));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch('/users/profile', { username });
      toast.success(t('ProfileUpdated'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('FailedUpdateProfile')));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVisibility = async () => {
    const changedSettings = Object.entries(visibilitySettings).reduce((acc, [key, value]) => {
      if (value !== initialVisibilitySettings[key as keyof ProfileVisibilitySettings]) {
        acc[key as keyof ProfileVisibilitySettings] = value;
      }
      return acc;
    }, {} as Partial<ProfileVisibilitySettings>);

    if (Object.keys(changedSettings).length === 0) {
      toast.success(t('ProfileVisibilityUpdated'));
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch('/users/profile', changedSettings);
      setInitialVisibilitySettings(visibilitySettings);
      toast.success(t('ProfileVisibilityUpdated'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('FailedUpdateProfileVisibility')));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('PasswordsNotMatch'));
      return;
    }
    setSaving(true);
    try {
      await apiClient.patch('/users/profile', {
        username,
        currentPassword,
        newPassword,
      });
      toast.success(t('PasswordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('FailedChangePassword')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-12 pb-24 animate-pulse">
        {/* Header */}
        <section className="px-2">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-2xl">
                <div className="w-8 h-8 bg-muted-foreground/20 rounded-md" />
              </div>
              <div className="h-10 w-72 bg-muted rounded-xl" />
            </div>
            <div className="h-5 w-96 bg-muted rounded-lg ms-16" />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Forms */}
          <div className="lg:col-span-8 space-y-10">
            {/* Profile Form Skeleton */}
            <section className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5 space-y-8">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-muted rounded-2xl">
                  <div className="w-6 h-6 bg-muted-foreground/20 rounded-md" />
                </div>
                <div className="h-6 w-48 bg-muted rounded-lg" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-4 w-32 bg-muted rounded-lg" />
                    <div className="h-16 w-full bg-muted rounded-2xl" />
                    <div className="h-3 w-40 bg-muted rounded-lg" />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <div className="h-16 w-44 bg-muted rounded-2xl" />
              </div>
            </section>

            {/* Password Form Skeleton */}
            <section className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5 space-y-8">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-muted rounded-2xl">
                  <div className="w-6 h-6 bg-muted-foreground/20 rounded-md" />
                </div>
                <div className="h-6 w-56 bg-muted rounded-lg" />
              </div>

              <div className="space-y-6 max-w-md">
                <div className="space-y-3">
                  <div className="h-4 w-40 bg-muted rounded-lg" />
                  <div className="h-16 w-full bg-muted rounded-2xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-4 w-40 bg-muted rounded-lg" />
                    <div className="h-16 w-full bg-muted rounded-2xl" />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <div className="h-16 w-52 bg-muted rounded-2xl" />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
        <div className="p-4 bg-destructive/10 rounded-full">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">{t('SomethingWentWrong')}</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
        >
          {t('TryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-24">
      <section className="px-2">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Settings className="w-8 h-8 text-primary" />
            </div>
            {t('AccountSettings')}
          </h1>
          <p className="text-muted-foreground font-medium text-lg ms-16">
            {t('ManagePersonalInformation')}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <ProfileCard
            profile={profile}
            avatarPreview={avatarPreview}
            avatarFile={avatarFile}
            avatarError={avatarError}
            avatarUploading={avatarUploading}
            onSelect={handleAvatarSelected}
            onUpload={handleAvatarUpload}
            onClear={() => void handleAvatarSelected(undefined)}
          />
        </div>

        <div className="lg:col-span-8 space-y-10">
          {/* Profile Form */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 bg-primary/10 rounded-2xl">
                <User className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t('PublicProfile')}</h2>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ms-1">
                    {t('Username')}
                  </label>
                  <div className="relative group">
                    <User className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full ps-12 pe-4 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                      placeholder={t('YourUniqueUsername')}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium ms-1">
                    {t('PublicDisplayName')}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ms-1 flex items-center gap-2">
                    {t('EmailAddress')}
                    <Lock className="w-3 h-3 text-muted-foreground/50" />
                  </label>
                  <div className="relative group opacity-60 cursor-not-allowed">
                    <Mail className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      type="email"
                      value={profile?.email}
                      disabled
                      className="w-full ps-12 pe-4 py-4 bg-muted border border-border rounded-2xl cursor-not-allowed font-bold"
                    />
                  </div>
                  <p className="text-xs text-amber-600 font-bold flex items-center gap-1 ms-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t('EmailCannotChanged')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving || username === profile?.username}
                  className="flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all text-lg group"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  )}
                  {t('SaveChanges')}
                </button>
              </div>
            </form>
          </motion.section>
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 bg-primary/10 rounded-2xl">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t('PublicProfileVisibility')}</h2>
            </div>

            <div className="space-y-5">
              {(
                [
                  'showMemberSince',
                  'showFavorites',
                  'showRecentRatings',
                  'showRecentlyReading',
                ] as const
              ).map((key) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <span className="font-bold text-foreground">{t(`ProfileVisibility.${key}`)}</span>
                  <Switch
                    checked={visibilitySettings[key]}
                    onCheckedChange={(checked) =>
                      setVisibilitySettings((current) => ({ ...current, [key]: checked }))
                    }
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-8">
              {profile?.username && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto"
                >
                  <Link
                    href={`/u/${profile.username}`}
                    className="flex w-full sm:w-auto items-center justify-center gap-2 px-8 py-4 bg-muted/50 text-foreground border border-border rounded-2xl font-bold hover:bg-muted hover:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all text-base sm:text-lg group"
                  >
                    <ExternalLink className="w-5 h-5 text-primary group-hover:-translate-y-0.5 transition-transform rtl:-scale-x-100" />
                    {t('ViewPublicProfile')}
                  </Link>
                </motion.div>
              )}

              <motion.button
                type="button"
                disabled={saving}
                onClick={handleUpdateVisibility}
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: saving ? 1 : 0.95 }}
                className="flex w-full sm:w-auto items-center justify-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-base sm:text-lg group"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                )}
                {t('SaveVisibility')}
              </motion.button>
            </div>
          </motion.section>

          <ConnectedDevices />

          {/* Password Form */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-[2.5rem] p-10 shadow-xl shadow-black/5"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-2.5 bg-primary/10 rounded-2xl">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t('SecurityPassword')}</h2>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-8">
              <div className="space-y-3 max-w-md">
                <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ms-1">
                  {t('CurrentPassword')}
                </label>
                <div className="relative group">
                  <Lock className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full ps-12 pe-12 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-xl transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Eye className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ms-1">
                    {t('NewPassword')}
                  </label>
                  <div className="relative group">
                    <Shield className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full ps-12 pe-4 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                      placeholder={t('MinCharacters')}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground ms-1">
                    {t('ConfirmNewPassword')}
                  </label>
                  <div className="relative group">
                    <Check className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full ps-12 pe-4 py-4 bg-muted/50 border border-border rounded-2xl focus:bg-card focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none font-bold"
                      placeholder={t('RepeatNewPassword')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving || !newPassword || newPassword !== confirmPassword}
                  className="flex items-center gap-2 px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all text-lg group"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Lock className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  )}
                  {t('UpdatePassword')}
                </button>
              </div>
            </form>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
