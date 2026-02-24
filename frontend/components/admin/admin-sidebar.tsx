"use client"

import React, { useState, useEffect } from "react"
import { usePermission } from "@/hooks/use-permission"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
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
  Sun,
  Moon,
  Monitor,
  Crown,
  SquareLibrary,
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

interface CurrentUser {
  userId: number
  username: string
  roleName?: "ADMIN"
}

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)

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

  useEffect(() => {
    setMounted(true)
  }, [])

  const sidebarData = [
    {
      title: "Main",
      items: [{ label: "Dashboard", icon: Home, path: "/admin" }],
    },
    {
      title: "Catalog",
      items: [
        { label: "Books", icon: BookOpen, path: "/admin/books", show: has("MANAGE_BOOKS") },
        { label: "Genres", icon: Tag, path: "/admin/genres", show: has("MANAGE_BOOKS") },
        { label: "Books Type", icon: SquareLibrary, path: "/admin/books-type", show: has("MANAGE_BOOKS") },
        { label: "Media Library", icon: ImageIcon, path: "/admin/media", show: has("MANAGE_MEDIA") },
      ],
    },
    {
      title: "Customers",
      items: [
        {
          label: "Users Management",
          icon: Users,
          path: "/admin/users",
          show: has(["MANAGE_USERS", "MANAGE_FINANCE", "MANAGE_STAFF"]),
        },
      ],
    },
    {
      title: "Finance",
      items: [{ label: "All Transactions", icon: Banknote, path: "/admin/transactions", show: has("MANAGE_FINANCE") }],
    },
    {
      title: "System",
      items: [
        { label: "Admin Staff", icon: Lock, path: "/admin/staff", show: has("MANAGE_STAFF") },
        { label: "Settings", icon: Settings, path: "/admin/settings" },
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
    if (isSuperAdmin) return "Super Admin"
    if (has("MANAGE_STAFF")) return "Staff Manager"
    if (has("MANAGE_FINANCE")) return "Finance Manager"
    if (has("MANAGE_BOOKS")) return "Content Manager"
    if (has("MANAGE_USERS")) return "User Manager"
    return "Administrator"
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
                        Readory
                      </h1>
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 truncate font-medium">Management Portal</p>
                </div>
            )}
            <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex shrink-0 hover:bg-sidebar-accent"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300", isCollapsed && "rotate-180")} />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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
                                          ? "bg-linear-to-r from-primary/15 to-primary/5 text-primary border-l-2 border-primary shadow-sm"
                                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:translate-x-1",
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
            {mounted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size={isCollapsed ? "icon" : "default"}
                        className={cn("w-full hover:bg-sidebar-accent", isCollapsed ? "justify-center" : "justify-start")}
                        title={isCollapsed ? "Change theme" : undefined}
                    >
                      {theme === "light" ? (
                          <Sun className="h-4 w-4 shrink-0" />
                      ) : theme === "dark" ? (
                          <Moon className="h-4 w-4 shrink-0" />
                      ) : (
                          <Monitor className="h-4 w-4 shrink-0" />
                      )}
                      {!isCollapsed && <span className="ml-2">Theme</span>}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
                      <Sun className="h-4 w-4 mr-2" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
                      <Moon className="h-4 w-4 mr-2" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
                      <Monitor className="h-4 w-4 mr-2" />
                      System
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}

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
                            <div className="flex-1 min-w-0 text-left">
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
                    <DropdownMenuItem
                        onClick={() => setIsLogoutDialogOpen(true)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}
          </div>
          <AlertDialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  You are about to sign out of your admin account. You will need to login again to access the dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={onConfirmLogout}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Log out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </aside>
      </>
  )
}
