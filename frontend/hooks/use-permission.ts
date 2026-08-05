import { useAuth } from '@/providers/auth-provider';

export function usePermission() {
  const { user, loading, hasPermission, isSuperAdmin } = useAuth();

  return {
    has: hasPermission,
    user,
    loading,
    isSuperAdmin,
  };
}
