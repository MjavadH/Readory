"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
  Library,
  Menu,
  Search,
  User,
  X,
  LayoutDashboard,
  LogOut,
  Shield,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type RoleName = "USER" | "ADMIN"
type Profile = { userId: number; username: string; roleName: RoleName }
type Genre = { name: string; slug: string }

const CONTENT_TYPES = [
  { name: "Manga", path: "/books/manga" },
  { name: "Manhwa", path: "/books/manhwa" },
  { name: "Comic", path: "/books/comic" },
  { name: "Novel", path: "/books/novel" },
  { name: "Light Novel", path: "/books/light-novel" },
] as const

function initialsFromUsername(username: string) {
  const safe = (username || "").trim()
  if (!safe) return "U"
  return safe.slice(0, 2).toUpperCase()
}

export function UserHeader() {
  const router = useRouter()
  const pathname = usePathname()

  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showBooksMenu, setShowBooksMenu] = useState(false)
  const [showGenresMenu, setShowGenresMenu] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [genres, setGenres] = useState<Genre[]>([])
  const [genresLoading, setGenresLoading] = useState(true)

  const booksMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const genresMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setIsMobileMenuOpen(false)
    setMobileSearchOpen(false)
    setShowBooksMenu(false)
    setShowGenresMenu(false)
  }, [pathname])

  useEffect(() => {
    const ac = new AbortController()

    const loadProfile = async () => {
      setProfileLoading(true)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/profile`, {
          credentials: "include",
          signal: ac.signal,
        })
        if (!res.ok) {
          setProfile(null)
          return
        }
        const data = (await res.json()) as Profile
        if (!data?.userId) {
          setProfile(null)
          return
        }
        setProfile(data)
      } catch {
        setProfile(null)
      } finally {
        setProfileLoading(false)
      }
    }

    void loadProfile()
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const ac = new AbortController()

    const loadGenres = async () => {
      setGenresLoading(true)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/genres/featured`, {
          credentials: "include",
          signal: ac.signal,
        })
        const data = await res.json().catch(() => [])
        const list = Array.isArray(data) ? data : []

        setGenres(
            list
                .map((g: any) => ({ id: Number(g.id), name: String(g.name), slug: String(g.slug) }))
        )
      } catch {
        setGenres([])
      } finally {
        setGenresLoading(false)
      }
    }

    void loadGenres()
    return () => ac.abort()
  }, [])

  useEffect(() => {
    return () => {
      if (booksMenuTimerRef.current) clearTimeout(booksMenuTimerRef.current)
      if (genresMenuTimerRef.current) clearTimeout(genresMenuTimerRef.current)
    }
  }, [])

  const authenticated = !!profile
  const isAdmin = profile?.roleName === "ADMIN"

  const handleBooksMenuEnter = () => {
    if (booksMenuTimerRef.current) clearTimeout(booksMenuTimerRef.current)
    setShowBooksMenu(true)
  }
  const handleBooksMenuLeave = () => {
    booksMenuTimerRef.current = setTimeout(() => setShowBooksMenu(false), 120)
  }

  const handleGenresMenuEnter = () => {
    if (genresMenuTimerRef.current) clearTimeout(genresMenuTimerRef.current)
    setShowGenresMenu(true)
  }
  const handleGenresMenuLeave = () => {
    genresMenuTimerRef.current = setTimeout(() => setShowGenresMenu(false), 120)
  }

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSearchResults(value.trim().length > 0)
  }

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
    } finally {
      setProfile(null)
      router.replace("/")
      router.refresh()
    }
  }

  const topGenres = useMemo(() => genres.slice(0, 12), [genres])

  return (
      <header
          className={cn(
              "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
              isScrolled ? "h-14 shadow-md" : "h-16",
          )}
      >
        <div className="container mx-auto px-4 h-full flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl sm:inline">Readory</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-6">
            <div className="relative" onMouseEnter={handleBooksMenuEnter} onMouseLeave={handleBooksMenuLeave}>
              <Link
                  href="/books"
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors py-2"
              >
                <BookOpen className="h-4 w-4" />
                Books
              </Link>

              {showBooksMenu && (
                  <div className="absolute top-full left-0 pt-2">
                    <div className="w-80 bg-background border rounded-lg shadow-xl p-6 animate-in fade-in slide-in-from-top-2">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-4">Browse by Type</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {CONTENT_TYPES.map((c) => (
                            <Link
                                key={c.name}
                                href={c.path}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                            >
                              <span className="text-sm font-medium">{c.name}</span>
                            </Link>
                        ))}
                      </div>
                    </div>
                  </div>
              )}
            </div>

            <div className="relative" onMouseEnter={handleGenresMenuEnter} onMouseLeave={handleGenresMenuLeave}>
              <Link
                  href="/genres"
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors py-2"
              >
                <Library className="h-4 w-4" />
                Genres
              </Link>

              {showGenresMenu && (
                  <div className="absolute top-full left-0 pt-2">
                    <div className="w-[22rem] bg-background border rounded-lg shadow-xl p-4 animate-in fade-in slide-in-from-top-2">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-3">Featured Genres</h3>

                      {genresLoading ? (
                          <div className="text-sm text-muted-foreground p-2">Loading…</div>
                      ) : topGenres.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-2">No genres yet.</div>
                      ) : (
                          <div className="grid grid-cols-2 gap-2">
                            {topGenres.map((g) => (
                                <Link
                                    key={g.slug}
                                    href={`/genres/${g.slug}`}
                                    className="p-2 rounded-md hover:bg-accent text-sm transition-colors"
                                >
                                  {g.name}
                                </Link>
                            ))}
                          </div>
                      )}
                    </div>
                  </div>
              )}
            </div>
          </nav>

          <div className="hidden md:flex flex-1 max-w-md relative">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                  type="search"
                  placeholder="Search books..."
                  className="pl-10 bg-muted/40"
                  value={searchQuery}
                  onChange={onSearchChange}
                  onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
              />
            </div>

            {showSearchResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-xl p-4 animate-in fade-in slide-in-from-top-2">
                  <p className="text-sm text-muted-foreground mb-2">Search</p>
                  <button
                      type="button"
                      className="w-full text-left text-sm p-2 rounded-md hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)}
                  >
                    View results for “{searchQuery.trim()}”
                  </button>
                </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileSearchOpen((v) => !v)}
                aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>

            {profileLoading ? null : authenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="hidden lg:flex" aria-label="Account">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initialsFromUsername(profile?.username ?? "")}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-2">
                      <div className="text-sm font-medium truncate">{profile?.username}</div>
                    </div>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      Dashboard
                    </DropdownMenuItem>

                    {isAdmin && (
                        <DropdownMenuItem onClick={() => router.push("/admin")}>
                          <Shield className="h-4 w-4 mr-2" />
                          Admin Panel
                        </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button
                    variant="default"
                    size="sm"
                    className="hidden lg:flex gap-2"
                    onClick={() => router.push("/login")}
                >
                  <User className="h-4 w-4" />
                  Login
                </Button>
            )}

            <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileMenuOpen((v) => !v)}
                aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileSearchOpen && (
            <div className="md:hidden border-t bg-background">
              <div className="container mx-auto px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      autoFocus
                      type="search"
                      placeholder="Search books..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={onSearchChange}
                  />
                </div>
                {searchQuery.trim() && (
                    <Button
                        variant="ghost"
                        className="mt-2 w-full justify-start"
                        onClick={() => router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)}
                    >
                      View results for “{searchQuery.trim()}”
                    </Button>
                )}
              </div>
            </div>
        )}

        {isMobileMenuOpen && (
            <div className="lg:hidden border-t bg-background animate-in slide-in-from-top-2">
              <div className="container mx-auto px-4 py-4 space-y-4">
                <div>
                  <Link
                      href="/books"
                      className="text-sm font-semibold mb-2 flex items-center gap-2 hover:text-primary"
                      onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Books
                  </Link>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {CONTENT_TYPES.map((c) => (
                        <Link
                            key={c.name}
                            href={c.path}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-accent text-sm"
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {c.name}
                        </Link>
                    ))}
                  </div>
                </div>

                <div>
                  <Link
                      href="/genres"
                      className="text-sm font-semibold mb-2 flex items-center gap-2 hover:text-primary"
                      onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Library className="h-4 w-4" />
                    Genres
                  </Link>
                  {genresLoading ? (
                      <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {topGenres.slice(0, 8).map((g) => (
                            <Link
                                key={g.slug}
                                href={`/genres/${g.slug}`}
                                className="p-2 rounded-md hover:bg-accent text-sm"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                              {g.name}
                            </Link>
                        ))}
                      </div>
                  )}
                </div>

                {authenticated ? (
                    <div className="space-y-2">
                      <Button
                          variant="outline"
                          className="w-full justify-start gap-2 bg-transparent"
                          onClick={() => {
                            router.push("/dashboard")
                            setIsMobileMenuOpen(false)
                          }}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                      </Button>

                      {isAdmin && (
                          <Button
                              variant="outline"
                              className="w-full justify-start gap-2 bg-transparent"
                              onClick={() => {
                                router.push("/admin")
                                setIsMobileMenuOpen(false)
                              }}
                          >
                            <Shield className="h-4 w-4" />
                            Admin Panel
                          </Button>
                      )}

                      <Button
                          variant="destructive"
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            setIsMobileMenuOpen(false)
                            void handleLogout()
                          }}
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                ) : (
                    <Button
                        variant="default"
                        className="w-full gap-2"
                        onClick={() => {
                          router.push("/login")
                          setIsMobileMenuOpen(false)
                        }}
                    >
                      <User className="h-4 w-4" />
                      Login / Register
                    </Button>
                )}
              </div>
            </div>
        )}
      </header>
  )
}