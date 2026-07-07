"use client"

import React, { useState, useEffect } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import {BrandLogo} from "@/components/brand-logo";
import {ThemeSwitcher} from "@/components/theme-switcher";
import {useTranslations} from "next-intl";
import {LanguageSwitcher} from "@/components/language-switcher";
import {useLocaleInfo} from "@/hooks/use-locale-info";

interface CurrentUser {
  userId: number
  username: string
  roleName?: "ADMIN"
}

export function AdminSidebar() {
  const t = useTranslations('AdminPage.Sidebar');
  const g = useTranslations('General');
  const pathname = usePathname()
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const {isRTL} = useLocaleInfo()

  const { has, loading, isSuperAdmin } = usePermission()

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const data = await apiClient.get<CurrentUser>("/auth/profile")
        if (data && data.userId) {
          setCurrentUser(data)
        }
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
        { label: t("Dashboard"), icon: LayoutDashboard, path: "/admin" }
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

  const onConfirmLogout = async () => {
    try {
      await logout()
    } finally {
      setIsLogoutDialogOpen(false)
      setIsMobileOpen(false)
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

  return (
      <>
        <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 right-4 z-60 md:hidden bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 border shadow-sm hover:shadow-md transition-all"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {isMobileOpen && (
            <div
                className="fixed inset-0 bg-black/60 z-45 md:hidden backdrop-blur-sm"
                onClick={() => setIsMobileOpen(false)}
            />
        )}

        <aside
            className={cn(
                "bg-linear-to-b from-sidebar via-sidebar to-sidebar/95 border-r border-sidebar-border flex flex-col h-screen transition-all duration-300 shadow-lg",
                // Desktop behavior
                "md:sticky md:top-0",
                isCollapsed ? "md:w-16" : "md:w-64",
                // Mobile behavior
                "fixed top-0 left-0 bottom-0 z-50 w-72",
                isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            )}
        >
          {/* Header */}
          <div className="p-6 border-b border-sidebar-border/50 flex items-center justify-center bg-linear-to-r from-primary/5 to-transparent">
            {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex gap-2 items-center">
                    <BrandLogo priority className="h-8 w-8" />
                    <Link href="/" className="hover:opacity-80 transition-opacity">
                      <h1 className="text-xl font-bold bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate">
                        {g("Readory")}
                      </h1>
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 truncate font-medium">{t("ManagementPortal")}</p>
                </div>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex shrink-0 hover:bg-sidebar-accent"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform rtl:rotate-180 duration-300", isCollapsed && "ltr:rotate-180 rtl:rotate-0")} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {sidebarData.map((section) => {
              const visibleItems = section.items.filter((item) => item.show !== false)

              if (visibleItems.length === 0) return null

              return (
                  <div key={section.title} className="mb-6">
                    {!isCollapsed && (
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                          {section.title}
                        </h2>
                    )}
                    <ul className="space-y-1">
                      {visibleItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.path

                        return (
                            <li key={item.path}>
                              <Link
                                  href={item.path}
                                  onClick={() => {
                                    setIsMobileOpen(false)
                                  }}
                                  className={cn(
                                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                      isActive
                                          ? "bg-linear-to-r from-primary/15 to-primary/5 text-primary border-s-2 border-primary shadow-sm"
                                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 rtl:hover:-translate-x-1 hover:translate-x-1",
                                      isCollapsed && "justify-center",
                                  )}
                                  title={isCollapsed ? item.label : undefined}
                              >
                                <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                                {!isCollapsed && <span>{item.label}</span>}
                              </Link>
                            </li>
                        )
                      })}
                    </ul>
                  </div>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border/50 space-y-2 bg-linear-to-t from-sidebar-accent/20 to-transparent">
            {currentUser && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            "w-full hover:bg-sidebar-accent transition-all duration-200",
                            isCollapsed ? "h-10 w-10 p-0" : "h-auto py-2 px-3",
                        )}
                    >
                      {isCollapsed ? (
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-linear-to-br from-primary to-primary/70 text-primary-foreground text-xs font-semibold">
                              {currentUser.username.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                      ) : (
                          <div className="flex items-center gap-3 w-full">
                            <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                              <AvatarFallback className="bg-linear-to-br from-primary to-primary/70 text-primary-foreground text-xs font-semibold">
                                {currentUser.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 ltr:text-left rtl:text-right">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                                  {currentUser.username}
                                </p>
                                {isSuperAdmin && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{getAdminTitle()}</p>
                            </div>
                          </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" className="w-56">
                    <div className="px-2 py-1.5 mb-1">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-linear-to-br from-primary to-primary/70 text-primary-foreground text-sm font-semibold">
                            {currentUser.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold truncate">{currentUser.username}</p>
                            {isSuperAdmin && <Crown className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                          </div>
                          <Badge variant="secondary" className="text-xs mt-0.5">
                            {getAdminTitle()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <ThemeSwitcher variant="sidebar" />
                    <LanguageSwitcher variant="sidebar" />
                    <DropdownMenuItem
                        dir={isRTL ? "rtl" : "ltr"}
                        onClick={() => setIsLogoutDialogOpen(true)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 me-2" />
                      {g("Logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
          </div>
          <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("LogoutTitle")}</AlertDialogTitle>
                <AlertDialogDescription className="rtl:text-right">
                  {t("LogoutDescription")}
                </AlertDialogDescription>
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
        </aside>
      </>
  )
}
