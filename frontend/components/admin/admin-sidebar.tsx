"use client"

import React, { useState, useEffect, useRef } from "react"
import { usePermission } from "@/hooks/use-permission"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  BookOpen,
  Tag,
  ImageIcon,
  Users,
  Banknote,
  Lock,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  X,
  Crown,
  SquareLibrary,
  LayoutDashboard,
  UserRoundPen,
  ClipboardList,
  CalendarClock,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { logout } from "@/lib/logout"
import { apiClient } from "@/lib/api-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer"
import { BrandLogo } from "@/components/brand-logo"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useTranslations } from "next-intl"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useLocaleInfo } from "@/hooks/use-locale-info"

const COLLAPSED_KEY = "admin-sidebar-collapsed"

interface CurrentUser {
  userId: number
  username: string
  roleName?: "ADMIN"
}

export function AdminSidebar() {
  const t = useTranslations("AdminPage.Sidebar")
  const g = useTranslations("General")
  const pathname = usePathname()
  const router = useRouter()
  const { isRTL } = useLocaleInfo()

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [collapsedReady, setCollapsedReady] = useState(false)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)

  const { has, loading, isSuperAdmin } = usePermission()

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY)
      if (stored !== null) setIsCollapsed(stored === "true")
    } catch {}
    setCollapsedReady(true)
  }, [])

  const handleToggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next))
    } catch {}
  }

  const prevPathRef = useRef(pathname)
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      setIsMobileDrawerOpen(false)
      prevPathRef.current = pathname
    }
  }, [pathname])

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const data = await apiClient.get<CurrentUser>("/auth/profile")
        if (data && data.userId) setCurrentUser(data)
      } catch (err) {
        console.error("Error fetching current user", err)
      }
    }
    void fetchCurrentUser()
  }, [])

  const sidebarData = [
    {
      title: t("Main"),
      items: [
        { label: t("Home"), icon: Home, path: "/" },
        { label: t("Dashboard"), icon: LayoutDashboard, path: "/admin" },
      ],
    },
    {
      title: t("Catalog"),
      items: [
        { label: t("Books"), icon: BookOpen, path: "/admin/books", show: has("MANAGE_BOOKS") },
        { label: t("Contributors"), icon: UserRoundPen, path: "/admin/contributors", show: has("MANAGE_BOOKS") },
        { label: t("Genres"), icon: Tag, path: "/admin/genres", show: has("MANAGE_BOOKS") },
        { label: t("BooksType"), icon: SquareLibrary, path: "/admin/books-type", show: has("MANAGE_BOOKS") },
        { label: t("MediaLibrary"), icon: ImageIcon, path: "/admin/media", show: has("MANAGE_BOOKS") },
        { label: t("ScheduledPublishing"), icon: CalendarClock, path: "/admin/scheduled-publications", show: has("MANAGE_BOOKS") },
      ],
    },
    {
      title: t("Customers"),
      items: [
        {
          label: t("UsersManagement"),
          icon: Users,
          path: "/admin/users",
          show: has(["MANAGE_USERS", "MANAGE_FINANCE", "MANAGE_STAFF"]),
        },
      ],
    },
    {
      title: t("Finance"),
      items: [{ label: t("AllTransactions"), icon: Banknote, path: "/admin/transactions", show: has("MANAGE_FINANCE") }],
    },
    {
      title: t("System"),
      items: [
        { label: t("AdminStaff"), icon: Lock, path: "/admin/staff", show: has("MANAGE_STAFF") },
        { label: t("AuditLog"), icon: ClipboardList, path: "/admin/audit-log", show: has("MANAGE_STAFF") },
        { label: t("Settings"), icon: Settings, path: "/admin/settings" },
      ],
    },
  ]

  const allVisibleItems = sidebarData.flatMap((s) => s.items.filter((i) => i.show !== false))
  const bottomBarItems = allVisibleItems.slice(0, 3)

  const onConfirmLogout = async () => {
    try {
      await logout()
    } finally {
      setIsLogoutDialogOpen(false)
      setIsMobileDrawerOpen(false)
      router.replace("/login")
      router.refresh()
    }
  }

  const getAdminTitle = () => {
    if (isSuperAdmin) return t("SuperAdmin")
    if (has("MANAGE_STAFF")) return t("StaffManager")
    if (has("MANAGE_FINANCE")) return t("FinanceManager")
    if (has("MANAGE_BOOKS")) return t("ContentManager")
    if (has("MANAGE_USERS")) return t("UserManager")
    return t("Administrator")
  }

  if (loading) return null

  const UserCard = ({ compact = false }: { compact?: boolean }) => {
    if (!currentUser) return null
    return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
                type="button"
                className={cn(
                    "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    "transition-colors duration-200 hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    compact && "justify-center px-0",
                )}
            >
              <Avatar className={cn("shrink-0 ring-2 ring-border", compact ? "h-8 w-8" : "h-9 w-9")}>
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {!compact && (
                  <div className="flex min-w-0 flex-1 flex-col ltr:text-left rtl:text-right">
                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-sidebar-foreground">
                  {currentUser.username}
                  {isSuperAdmin && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                </span>
                    <span className="truncate text-xs text-muted-foreground">{getAdminTitle()}</span>
                  </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={isRTL ? "start" : "end"} sideOffset={8} className="w-60 p-2">
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-accent/40 px-3 py-2.5">
              <Avatar className="h-10 w-10 ring-2 ring-border">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{currentUser.username}</span>
                  {isSuperAdmin && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                </div>
                <Badge variant="secondary" className="mt-0.5 w-fit text-xs">
                  {getAdminTitle()}
                </Badge>
              </div>
            </div>

            <ThemeSwitcher variant="sidebar" />
            <LanguageSwitcher variant="sidebar" />

            <div className="my-1 h-px bg-border" />

            <DropdownMenuItem
                dir={isRTL ? "rtl" : "ltr"}
                onClick={() => setIsLogoutDialogOpen(true)}
                className="cursor-pointer gap-2 rounded-lg text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {g("Logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
    )
  }

  const NavList = ({ collapsed = false }: { collapsed?: boolean }) => (
      <nav className="flex-1 overflow-y-auto px-2 py-3 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
        {sidebarData.map((section) => {
          const visibleItems = section.items.filter((item) => item.show !== false)
          if (visibleItems.length === 0) return null

          return (
              <div key={section.title} className="mb-4">
                {!collapsed && (
                    <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                      {section.title}
                    </p>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.path

                    return (
                        <li key={item.path}>
                          <Link
                              href={item.path}
                              onClick={() => setIsMobileDrawerOpen(false)}
                              title={collapsed ? item.label : undefined}
                              className={cn(
                                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                                  isActive
                                      ? "bg-primary/10 text-primary font-semibold"
                                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground font-medium",
                                  collapsed && "justify-center",
                              )}
                          >
                            {isActive && !collapsed && (
                                <span className="absolute inset-y-2 inset-s-0 w-0.75 rounded-full bg-primary" />
                            )}
                            <Icon
                                className={cn(
                                    "h-4.5 w-4.5 shrink-0",
                                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                                )}
                            />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                            {isActive && collapsed && (
                                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                            )}
                          </Link>
                        </li>
                    )
                  })}
                </ul>
              </div>
          )
        })}
      </nav>
  )

  const SidebarBrand = ({ collapsed = false }: { collapsed?: boolean }) => (
      <div
          className={cn(
              "flex h-16 shrink-0 items-center border-b border-sidebar-border/60 px-4",
              collapsed ? "justify-center" : "justify-between gap-3",
          )}
      >
        {collapsed ? (
            <BrandLogo priority className="h-7 w-7 shrink-0" />
        ) : (
            <Link href="/" className="flex min-w-0 items-center gap-2.5 hover:opacity-80 transition-opacity">
              <BrandLogo priority className="h-7 w-7 shrink-0" />
              <span className="truncate text-base font-bold tracking-tight text-sidebar-foreground">
            {g("Readory")}
          </span>
            </Link>
        )}
        <button
            type="button"
            onClick={handleToggleCollapse}
            aria-label="Toggle sidebar"
            className={cn(
                "hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground",
                "transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
        >
          {isRTL ? (
              <ChevronRight
                  className={cn("h-4 w-4 transition-transform duration-300", collapsed ? "rotate-180" : "rotate-0")}
              />
          ) : (
              <ChevronLeft
                  className={cn("h-4 w-4 transition-transform duration-300", collapsed ? "rotate-180" : "rotate-0")}
              />
          )}
        </button>
      </div>
  )

  return (
      <>
        {/* MOBILE: Floating bottom bar */}
        <nav
            aria-label="Mobile quick navigation"
            className={cn(
                "fixed bottom-4 inset-x-4 z-40 md:hidden",
                "flex items-center justify-around",
                "rounded-2xl bg-background/90 backdrop-blur-sm supports-backdrop-filter:bg-background/70 border border-border/60 shadow-lg shadow-black/10 px-2 py-1.5",
            )}
        >
          {bottomBarItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path
            return (
                <Link
                    key={item.path}
                    href={item.path}
                    aria-label={item.label}
                    className={cn(
                        "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors duration-150",
                        isActive
                            ? "text-primary"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                  <span className="text-[10px] font-medium leading-none">{item.label}</span>
                  {isActive && (
                      <span className="absolute -bottom-0.5 left-1/2 h-0.75 w-4 -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </Link>
            )
          })}

          <button
              type="button"
              aria-label="Open full menu"
              aria-expanded={isMobileDrawerOpen}
              onClick={() => setIsMobileDrawerOpen((v) => !v)}
              className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors duration-150",
                  isMobileDrawerOpen ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
          >
            <div className="relative h-5 w-5">
              <Menu
                  className={cn(
                      "absolute inset-0 h-5 w-5 transition-all duration-200",
                      isMobileDrawerOpen ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0",
                  )}
              />
              <X
                  className={cn(
                      "absolute inset-0 h-5 w-5 transition-all duration-200",
                      isMobileDrawerOpen ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90",
                  )}
              />
            </div>
            <span className="text-[10px] font-medium leading-none">{t("More")}</span>
          </button>
        </nav>

        {/* MOBILE: Backdrop */}
        <div
            aria-hidden="true"
            onClick={() => setIsMobileDrawerOpen(false)}
            className={cn(
                "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden",
                "transition-opacity duration-300",
                isMobileDrawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
            )}
        />

        {/* Implement mobile full-screen Drawer */}
        <Drawer open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
          <DrawerContent className="flex flex-col bg-sidebar md:hidden h-[95dvh] rounded-t-2xl border-sidebar-border">
            {/* Screen reader title for accessibility compliance */}
            <DrawerTitle className="sr-only">{g("Readory")} Navigation</DrawerTitle>

            {/* Drawer header */}
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-4 border-b border-sidebar-border/60">
              <Link href="/" className="flex items-center gap-2.5" onClick={() => setIsMobileDrawerOpen(false)}>
                <BrandLogo priority className="h-7 w-7" />
                <span className="text-base font-bold tracking-tight text-sidebar-foreground">{g("Readory")}</span>
              </Link>
              <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  aria-label="Close menu"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable nav */}
            <div className="flex-1 overflow-y-auto px-4 py-3 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
              {sidebarData.map((section) => {
                const visibleItems = section.items.filter((i) => i.show !== false)
                if (visibleItems.length === 0) return null
                return (
                    <div key={section.title} className="mb-4">
                      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                        {section.title}
                      </p>
                      <ul className="space-y-0.5">
                        {visibleItems.map((item) => {
                          const Icon = item.icon
                          const isActive = pathname === item.path
                          return (
                              <li key={item.path}>
                                <Link
                                    href={item.path}
                                    onClick={() => setIsMobileDrawerOpen(false)}
                                    className={cn(
                                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150",
                                        isActive
                                            ? "bg-primary/10 text-primary font-semibold"
                                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground font-medium",
                                    )}
                                >
                                  {isActive && (
                                      <span className="absolute inset-y-2 inset-s-0 w-0.75 rounded-full bg-primary" />
                                  )}
                                  <Icon
                                      className={cn(
                                          "h-4.5 w-4.5 shrink-0",
                                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                                      )}
                                  />
                                  <span className="truncate">{item.label}</span>
                                </Link>
                              </li>
                          )
                        })}
                      </ul>
                    </div>
                )
              })}
            </div>

            {/* Drawer footer */}
            <div className="shrink-0 border-t border-sidebar-border/60 px-4 py-4 space-y-3 pb-[env(safe-area-inset-bottom,1rem)]">
              <ThemeSwitcher variant="mobile" />

              {currentUser && (
                  <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-9 w-9 ring-2 ring-border shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {currentUser.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      {currentUser.username}
                      {isSuperAdmin && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                    </span>
                        <span className="truncate text-xs text-muted-foreground">{getAdminTitle()}</span>
                      </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setIsMobileDrawerOpen(false); setIsLogoutDialogOpen(true) }}
                        aria-label={g("Logout")}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* DESKTOP: Collapsible sticky sidebar */}
        <aside
            aria-label="Desktop navigation"
            className={cn(
                "sticky top-0 hidden h-screen flex-col bg-sidebar border-e border-sidebar-border md:flex overflow-hidden",
                "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                collapsedReady ? (isCollapsed ? "w-17" : "w-64") : "w-64",
            )}
        >
          <SidebarBrand collapsed={isCollapsed} />
          <NavList collapsed={isCollapsed} />
          <div
              className={cn(
                  "shrink-0 border-t border-sidebar-border/60 p-3",
                  isCollapsed && "flex items-center justify-center",
              )}
          >
            <UserCard compact={isCollapsed} />
          </div>
        </aside>

        {/* Logout confirmation */}
        <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("LogoutTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="rtl:text-right">{t("LogoutDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{g("Cancel")}</AlertDialogCancel>
              <AlertDialogAction
                  onClick={onConfirmLogout}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {g("Logout")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
  )
}
