import * as React from "react"

import { apiClient } from "@/lib/api-client"

export type CurrentUser = {
    id: number
    userId: number
    email: string
    username: string
    walletBalance: number
    roleName?: "ADMIN"
    permissions?: string[]
}

type Status = "loading" | "authenticated" | "unauthenticated"

type State = {
    user: CurrentUser | null
    status: Status
}

let state: State = { user: null, status: "loading" }
let inflight: Promise<CurrentUser | null> | null = null
let hasFetched = false
const listeners = new Set<() => void>()

const emit = (next: State) => {
    state = next
    listeners.forEach((listener) => listener())
}

const fetchProfile = (force = false): Promise<CurrentUser | null> => {
    if (inflight && !force) return inflight
    if (hasFetched && !force) return Promise.resolve(state.user)

    inflight = apiClient
        .get<CurrentUser>("/auth/profile")
        .then((user) => {
            hasFetched = true
            emit({ user, status: "authenticated" })
            return user
        })
        .catch(() => {
            hasFetched = true
            emit({ user: null, status: "unauthenticated" })
            return null
        })
        .finally(() => {
            inflight = null
        })

    return inflight
}

const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

const getSnapshot = () => state

const serverSnapshot: State = { user: null, status: "loading" }
const getServerSnapshot = (): State => serverSnapshot

export function useCurrentUser() {
    const snapshot = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

    React.useEffect(() => {
        void fetchProfile()
    }, [])

    const refresh = React.useCallback(() => fetchProfile(true), [])

    const clear = React.useCallback(() => {
        hasFetched = true
        emit({ user: null, status: "unauthenticated" })
    }, [])

    return {
        user: snapshot.user,
        status: snapshot.status,
        isLoading: snapshot.status === "loading",
        isAuthenticated: snapshot.status === "authenticated",
        isAdmin: snapshot.user?.roleName === "ADMIN",
        hasPermission: (permission: string) =>
            snapshot.user?.roleName === "ADMIN" &&
            Boolean(snapshot.user?.permissions?.includes(permission)),
        refresh,
        clear,
    }
}
