export async function logout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
    })
}
