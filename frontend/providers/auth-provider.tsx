"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type Permission =
    | "MANAGE_BOOKS"
    | "MANAGE_USERS"
    | "MANAGE_FINANCE"
    | "MANAGE_MEDIA"
    | "MANAGE_STAFF"

interface User {
    id: number
    username: string
    role: string
    permissions: Permission[]
}

interface AuthContextType {
    user: User | null
    loading: boolean
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
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/profile`, {
                    credentials: "include",
                })
                if (res.ok) {
                    const data = await res.json()

                    const normalizedUser = {
                        ...data,
                        id: data.id || data.userId,
                        permissions: data.permissions || []
                    }
                    if (normalizedUser.role === 'ADMIN' || data.roleName === 'ADMIN') {
                        setUser(normalizedUser)
                    } else {
                        setUser(null)
                    }
                }
            } catch (error) {
                console.error("Auth Error:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)