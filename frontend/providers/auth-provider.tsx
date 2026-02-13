"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"

export type Permission =
  | "MANAGE_BOOKS"
  | "MANAGE_USERS"
  | "MANAGE_FINANCE"
  | "MANAGE_MEDIA"
  | "MANAGE_STAFF"

interface User {
  id: number
  username: string
  role?: "ADMIN"
  permissions?: Permission[]
}

interface AuthContextType {
  user: User | null
  loading: boolean
}

type ProfileResponse = {
  id?: number
  userId?: number
  username: string
  roleName?: "ADMIN"
  permissions?: Permission[]
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiClient.get<ProfileResponse>("/auth/profile")
        const normalizedId = data.id ?? data.userId

        if (data.roleName === "ADMIN" && normalizedId) {
          setUser({
            id: normalizedId,
            username: data.username,
            role: "ADMIN",
            permissions: data.permissions || [],
          })
          return
        }

        setUser(null)
      } catch (error) {
        console.error("Auth Error:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    void fetchProfile()
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
