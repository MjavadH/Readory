"use client"

import React, { createContext, useContext } from "react"
import { CurrentUser, Permission, useCurrentUser } from "@/hooks/use-current-user"

interface AuthContextType {
  user: CurrentUser | null
  loading: boolean
  status: "loading" | "authenticated" | "unauthenticated"
  isAuthenticated: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  hasPermission: (permission: Permission | Permission[]) => boolean
  refresh: () => Promise<CurrentUser | null>
  clear: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  status: "loading",
  isAuthenticated: false,
  isAdmin: false,
  isSuperAdmin: false,
  hasPermission: () => false,
  refresh: async () => null,
  clear: () => undefined,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser()
  const value = React.useMemo<AuthContextType>(() => ({
    user: currentUser.user,
    loading: currentUser.isLoading,
    status: currentUser.status,
    isAuthenticated: currentUser.isAuthenticated,
    isAdmin: currentUser.isAdmin,
    isSuperAdmin: currentUser.isSuperAdmin,
    hasPermission: currentUser.hasPermission,
    refresh: currentUser.refresh,
    clear: currentUser.clear,
  }), [currentUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export type { CurrentUser, Permission }
