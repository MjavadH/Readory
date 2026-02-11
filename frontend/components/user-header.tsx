"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Search,
  User,
  LayoutDashboard,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,} from "@/components/ui/dropdown-menu"
import {Sheet, SheetContent, SheetTitle,} from "@/components/ui/sheet"
import {AppIcon} from "@/components/AppIcon";
import { isIconKey, type IconKey } from "@readory/shared";
import { apiClient } from "@/lib/api-client"

type RoleName = "USER" | "ADMIN"
type Profile = { userId: number; username: string; roleName: RoleName }
type Genre = { name: string; slug: string }
type BookType = {name: string; slug: string; iconKey: IconKey;}

function initialsFromUsername(username: string) {
  const safe = (username || "").trim()
  if (!safe) return "U"
  return safe.slice(0, 2).toUpperCase()
}

/* Theme Toggle (Desktop) */
function ThemeToggleDesktop() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-9 w-9" />

  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Toggle theme">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => setTheme("light")} className={cn(theme === "light" && "bg-accent")}>
            <Sun className="mr-2 h-4 w-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")} className={cn(theme === "dark" && "bg-accent")}>
            <Moon className="mr-2 h-4 w-4" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")} className={cn(theme === "system" && "bg-accent")}>
            <Monitor className="mr-2 h-4 w-4" /> System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  )
}

/* Theme Picker (Mobile) */
function ThemePickerMobile() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "Auto" },
  ] as const

  return (
      <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
        {options.map((opt) => {
          const Icon = opt.icon
          const active = theme === opt.value
          return (
              <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                      active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                  )}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
          )
        })}
      </div>
  )
}

/* Desktop Mega-dropdown */
function NavDropdown({label, icon: Icon, href, children, isActive,}: {
  label: string
  icon: IconKey
  href: string
  children: React.ReactNode
  isActive?: boolean
}) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enter = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }
  const leave = () => {
    timer.current = setTimeout(() => setOpen(false), 150)
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
      <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
        <Link
            href={href}
            className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
        >
          <AppIcon name={Icon} className="h-4 w-4" />
          {label}
        </Link>

        <div
            className={cn(
                "absolute top-full left-0 pt-2 transition-all duration-200 origin-top-left",
                open
                    ? "opacity-100 scale-100 pointer-events-auto"
                    : "opacity-0 scale-95 pointer-events-none"
            )}
        >
          {children}
        </div>
      </div>
  )
}

/* Mobile Section */
function MobileSection({title, children,}: {
  title: string
  children: React.ReactNode
}) {
  return (
      <div className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          {title}
        </p>
        {children}
      </div>
  )
}

/* Mobile Nav Link */
function MobileNavLink({href, icon: Icon, label, onClick, badge, active,}: {
  href: string
  icon: IconKey
  label: string
  onClick?: () => void
  badge?: string
  active?: boolean
}) {
  return (
      <Link
          href={href}
          onClick={onClick}
          className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
              active
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-accent"
          )}
      >
        <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            active ? "bg-primary/20" : "bg-muted"
        )}>
          <AppIcon name={Icon} className="h-4 w-4" />
        </div>
        <span className="flex-1">{label}</span>
        {badge && (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {badge}
        </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </Link>
  )
}

/* Main Header */
export function UserHeader() {
  const router = useRouter()
  const pathname = usePathname()

  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [genres, setGenres] = useState<Genre[]>([])
  const [genresLoading, setGenresLoading] = useState(true)
  const [bookType, setBookType] = useState<BookType[]>([])
  const [bookTypeLoading, setBookTypeLoading] = useState(true)

  /* scroll listener */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* close on navigate */
  useEffect(() => {
    setMobileOpen(false)
    setMobileSearchOpen(false)
  }, [pathname])

  /* lock body scroll when mobile menu is open */
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileOpen])

  /* load profile */
  useEffect(() => {
    const ac = new AbortController()
    const loadProfile = async () => {
      setProfileLoading(true)
      try {
        const data = await apiClient.get<Profile>("/auth/profile", { signal: ac.signal })
        if (!data?.userId) { setProfile(null); return }
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

  /* load genres */
  useEffect(() => {
    const ac = new AbortController()
    const loadGenres = async () => {
      setGenresLoading(true)
      try {
        const data = await apiClient.get<any[]>("/genres/featured", { signal: ac.signal }).catch(() => [])
        setGenres(
            (Array.isArray(data) ? data : []).map((g: any) => ({
              name: String(g.name),
              slug: String(g.slug),
            }))
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

  /* load BookType */
  useEffect(() => {
    const ac = new AbortController()
    const loadBookType = async () => {
      setBookTypeLoading(true)
      try {
        const data = await apiClient.get<any[]>("/public/book-types", { signal: ac.signal }).catch(() => [])
        setBookType(
            (Array.isArray(data) ? data : []).map((b: any) => ({
              name: String(b.name),
              slug: String(b.slug),
              iconKey: isIconKey(b.iconKey) ? b.iconKey : "bookOpen",
            }))
        )
      } catch {
        setBookType([])
      } finally {
        setBookTypeLoading(false)
      }
    }
    void loadBookType()
    return () => ac.abort()
  }, [])

  const authenticated = !!profile
  const isAdmin = profile?.roleName === "ADMIN"
  const topGenres = useMemo(() => genres.slice(0, 12), [genres])

  const closeMobile = useCallback(() => setMobileOpen(false), [])

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSearchResults(value.trim().length > 0)
  }

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout")
    } finally {
      setProfile(null)
      router.replace("/")
      router.refresh()
    }
  }

  const submitSearch = () => {
    if (!searchQuery.trim()) return
    router.push(`/books?q=${encodeURIComponent(searchQuery.trim())}`)
    setShowSearchResults(false)
    setMobileSearchOpen(false)
  }

  return (
      <>
        <header
            className={cn(
                "sticky top-0 z-50 w-full transition-all duration-300",
                isScrolled
                    ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
                    : "bg-background/95 backdrop-blur-sm border-b border-transparent"
            )}
        >
          <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform duration-200 group-hover:scale-105">
                <AppIcon name={"bookOpen"} className="h-5 w-5" />
              </div>
              <span className="font-bold text-lg tracking-tight hidden sm:block">Readory</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              <NavDropdown
                  label="Books"
                  icon={"bookOpen"}
                  href="/books"
                  isActive={pathname.startsWith("/books")}
              >
                <div className="w-80 rounded-xl border bg-popover p-4 shadow-xl">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Browse by Type
                  </p>
                  {bookTypeLoading ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                  ) : bookType.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No book type yet.</p>
                  ) : (
                      <div className="grid grid-cols-2 gap-1">
                        {bookType.map((b) => (
                            <Link
                                key={b.slug}
                                href={`/${b.slug}`}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <AppIcon name={b.iconKey as any} className="h-4 w-4 text-muted-foreground" />
                              </div>
                              {b.name}
                            </Link>
                        ))}
                      </div>
                  )}
                </div>
              </NavDropdown>

              <NavDropdown
                  label="Genres"
                  icon={"library"}
                  href="/genres"
                  isActive={pathname.startsWith("/genres")}
              >
                <div className="w-96 rounded-xl border bg-popover p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Featured Genres
                    </p>
                    <Link href="/genres" className="text-xs font-medium text-primary hover:underline">
                      View all
                    </Link>
                  </div>
                  {genresLoading ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
                        ))}
                      </div>
                  ) : topGenres.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">No genres yet.</p>
                  ) : (
                      <div className="grid grid-cols-2 gap-1">
                        {topGenres.map((g) => (
                            <Link
                                key={g.slug}
                                href={`/genres/${g.slug}`}
                                className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                            >
                              {g.name}
                            </Link>
                        ))}
                      </div>
                  )}
                </div>
              </NavDropdown>
            </nav>

            {/* Desktop Search */}
            <div className="hidden md:flex flex-1 max-w-md relative">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Search books..."
                    className="pl-10 bg-muted/40 border-transparent focus:border-border focus:bg-background transition-colors rounded-xl h-10"
                    value={searchQuery}
                    onChange={onSearchChange}
                    onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                    onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                    onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                />
              </div>

              <div
                  className={cn(
                      "absolute top-full left-0 right-0 mt-2 rounded-xl border bg-popover shadow-xl p-3 transition-all duration-200 origin-top",
                      showSearchResults
                          ? "opacity-100 scale-100 pointer-events-auto"
                          : "opacity-0 scale-95 pointer-events-none"
                  )}
              >
                <button
                    type="button"
                    className="w-full text-left text-sm p-2.5 rounded-lg hover:bg-accent flex items-center gap-2 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={submitSearch}
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Search for &ldquo;{searchQuery.trim()}&rdquo;
                </button>
              </div>
            </div>

            {/* Desktop Right Side */}
            <div className="flex items-center gap-1">
              {/* Mobile search toggle */}
              <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9"
                  onClick={() => setMobileSearchOpen((v) => !v)}
                  aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>

              {/* Desktop theme toggle */}
              <div className="hidden lg:block">
                <ThemeToggleDesktop />
              </div>

              {/* Desktop User Menu */}
              {!profileLoading && (
                  <div className="hidden lg:block">
                    {authenticated ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="Account">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {initialsFromUsername(profile?.username ?? "")}
                                </AvatarFallback>
                              </Avatar>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
                            <DropdownMenuLabel className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                                    {initialsFromUsername(profile?.username ?? "")}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold truncate">{profile?.username}</span>
                                  <span className="text-xs text-muted-foreground capitalize">{profile?.roleName.toLowerCase()}</span>
                                </div>
                              </div>
                            </DropdownMenuLabel>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => router.push("/dashboard")} className="rounded-lg px-3 py-2">
                              <LayoutDashboard className="h-4 w-4 mr-2" />
                              Dashboard
                            </DropdownMenuItem>

                            {isAdmin && (
                                <DropdownMenuItem onClick={() => router.push("/admin")} className="rounded-lg px-3 py-2">
                                  <AppIcon name={"shield"} className="h-4 w-4 mr-2" />
                                  Admin Panel
                                </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="rounded-lg px-3 py-2 text-destructive focus:text-destructive"
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Log out
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button
                            size="sm"
                            className="rounded-xl gap-2 px-4"
                            onClick={() => router.push("/login")}
                        >
                          <User className="h-4 w-4" />
                          Sign in
                        </Button>
                    )}
                  </div>
              )}

              {/* Mobile Hamburger */}
              <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-9 w-9"
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label="Menu"
              >
                <div className="flex flex-col items-center justify-center gap-[5px] w-5">
                <span className={cn(
                    "block h-[2px] w-full rounded-full bg-foreground transition-all duration-300 origin-center",
                    mobileOpen && "translate-y-[7px] rotate-45"
                )} />
                  <span className={cn(
                      "block h-[2px] w-full rounded-full bg-foreground transition-all duration-300",
                      mobileOpen && "opacity-0 scale-x-0"
                  )} />
                  <span className={cn(
                      "block h-[2px] w-full rounded-full bg-foreground transition-all duration-300 origin-center",
                      mobileOpen && "-translate-y-[7px] -rotate-45"
                  )} />
                </div>
              </Button>
            </div>
          </div>

          {/* Mobile Search Bar */}
          <div
              className={cn(
                  "md:hidden overflow-hidden transition-all duration-300",
                  mobileSearchOpen ? "max-h-20 border-t border-border/50" : "max-h-0"
              )}
          >
            <div className="container mx-auto px-4 py-3">
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      autoFocus={mobileSearchOpen}
                      type="search"
                      placeholder="Search books..."
                      className="pl-10 rounded-xl h-10"
                      value={searchQuery}
                      onChange={onSearchChange}
                      onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setMobileSearchOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {searchQuery.trim() && (
                  <Button
                      variant="ghost"
                      className="mt-1.5 w-full justify-start gap-2 rounded-xl text-sm"
                      onClick={submitSearch}
                  >
                    <Search className="h-4 w-4" />
                    Search for &ldquo;{searchQuery.trim()}&rdquo;
                  </Button>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Menu (Sheet) */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0 flex flex-col [&>button]:hidden">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

            {/* Profile Area */}
            <div className="p-5 pb-4">
              {authenticated && profile ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary/10 text-primary text-base font-bold">
                        {initialsFromUsername(profile.username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold truncate">{profile.username}</p>
                      <p className="text-xs text-muted-foreground capitalize">{profile.roleName.toLowerCase()}</p>
                    </div>
                  </div>
              ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Welcome</p>
                      <p className="text-xs text-muted-foreground">Sign in to your account</p>
                    </div>
                  </div>
              )}
            </div>

            <Separator />

            {/* Scrollable Nav */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
              {/* Main Nav */}
              <MobileSection title="Navigate">
                <MobileNavLink
                    href="/"
                    icon={"home"}
                    label="Home"
                    onClick={closeMobile}
                    active={pathname === "/"}
                />
                <MobileNavLink
                    href="/books"
                    icon={"bookOpen"}
                    label="All Books"
                    onClick={closeMobile}
                    active={pathname === "/books"}
                />
                <MobileNavLink
                    href="/genres"
                    icon={"library"}
                    label="Genres"
                    onClick={closeMobile}
                    active={pathname === "/genres"}
                />
              </MobileSection>

              {/* Content Types */}
              {!bookTypeLoading && bookType.length > 0 && (
                  <MobileSection title="Browse by Type">
                    <div className="flex flex-wrap gap-2 px-1">
                      {bookType.map((b) => (
                          <MobileNavLink
                              key={b.name}
                              href={`/${b.slug}`}
                              icon={b.iconKey as IconKey}
                              label={b.name}
                              onClick={closeMobile}
                              active={pathname === `/${b.slug}`}
                          />
                      ))}
                    </div>
                  </MobileSection>
              )}

              {/* Genres */}
              {!genresLoading && topGenres.length > 0 && (
                  <MobileSection title="Popular Genres">
                    <div className="flex flex-wrap gap-2 px-1">
                      {topGenres.map((g) => (
                          <Link
                              key={g.slug}
                              href={`/genres/${g.slug}`}
                              onClick={closeMobile}
                              className={cn(
                                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95",
                                  pathname === `/genres/${g.slug}`
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/50 text-foreground border-border hover:bg-accent"
                              )}
                          >
                            {g.name}
                          </Link>
                      ))}
                    </div>
                  </MobileSection>
              )}

              {/* Account */}
              {authenticated && (
                  <MobileSection title="Account">
                    <MobileNavLink
                        href="/dashboard"
                        icon={"layoutDashboard"}
                        label="Dashboard"
                        onClick={closeMobile}
                        active={pathname === "/dashboard"}
                    />
                    {isAdmin && (
                        <MobileNavLink
                            href="/admin"
                            icon={"shield"}
                            label="Admin Panel"
                            onClick={closeMobile}
                            badge="ADMIN"
                            active={pathname.startsWith("/admin")}
                        />
                    )}
                  </MobileSection>
              )}

              {/* Theme */}
              <MobileSection title="Appearance">
                <ThemePickerMobile />
              </MobileSection>
            </div>

            {/* Bottom CTA */}
            <div className="p-4 border-t border-border/50">
              {authenticated ? (
                  <Button
                      variant="outline"
                      className="w-full justify-center gap-2 rounded-xl h-11 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 bg-transparent"
                      onClick={() => {
                        closeMobile()
                        void handleLogout()
                      }}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
              ) : (
                  <Button
                      className="w-full justify-center gap-2 rounded-xl h-11"
                      onClick={() => {
                        closeMobile()
                        router.push("/login")
                      }}
                  >
                    <User className="h-4 w-4" />
                    Sign in
                  </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
  )
}
