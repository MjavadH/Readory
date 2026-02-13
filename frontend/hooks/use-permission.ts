import { useAuth, Permission } from "@/providers/auth-provider"

export function usePermission() {
    const { user, loading } = useAuth()

    const has = (requiredPermission: Permission | Permission[]): boolean => {
        if (loading || !user) return false
        if (user.id === 1) return true
        const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]
        return required.some(p => (user.permissions || []).includes(p))
    }

    return {
        has,
        user,
        loading,
        isSuperAdmin: user?.id === 1
    }
}