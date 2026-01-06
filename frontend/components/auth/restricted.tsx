"use client"

import { usePermission } from "@/hooks/use-permission"
import { Permission } from "@/providers/auth-provider"

interface RestrictedProps {
    to: Permission | Permission[]
    children: React.ReactNode
    fallback?: React.ReactNode
}

export function Restricted({ to, children, fallback = null }: RestrictedProps) {
    const { has } = usePermission()

    if (has(to)) {
        return <>{children}</>
    }

    return <>{fallback}</>
}