"use client"

import React, { useEffect, useState } from "react"
import { Restricted } from "@/components/auth/restricted"
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Users,
  UserPlus,
  Activity,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Wallet,
  BookOpen,
  Clock,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Shield,
  Ban,
  CheckCircle2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Transaction {
  id: number
  amount: number
  type: "CREDIT" | "DEBIT"
  reference?: string | null
  createdAt: string
}

interface AccessRecord {
  id: number
  chapterId: number
  chapterTitle: string
  bookTitle: string
  purchasedAt: string
  price: number
}

interface User {
  id: number
  email: string
  username: string
  role: { id: number; name: "ADMIN" | "USER" } | "ADMIN" | "USER"
  lastLogin?: string
  joinedAt: string
  balance: number
  status: "ACTIVE" | "BANNED"
}

interface UserDetails extends User {
  wallet: {
    balance: number
    transactions: Transaction[]
  }
  accessRecords: AccessRecord[]
  lastLoginAt?: string
  createdAt: string
}

interface UserStats {
  totalUsers: number
  newUsers: number
  activeUsers: number
}

const getRoleName = (role: User["role"]): "ADMIN" | "USER" => {
  if (typeof role === "string") return role
  return role.name
}

const isAdminRole = (role: User["role"]): boolean => {
  if (typeof role === "string") return role === "ADMIN"
  return role.name === "ADMIN"
}

export default function AdminUsers() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [totalListUsers, setTotalListUsers] = useState(0)
  const [stats, setStats] = useState<UserStats>({ totalUsers: 0, newUsers: 0, activeUsers: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const ITEMS_PER_PAGE = 20

  const fetchData = async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        search: searchQuery,
      })

      const [usersRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users?${queryParams}`, {
          credentials: "include",
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/stats`, {
          credentials: "include",
        }),
      ])

      const usersData = await usersRes.json()
      const statsData = await statsRes.json()

      if (usersData && Array.isArray(usersData.data)) {
        setUsers(usersData.data)
        setTotalListUsers(usersData.total)
      }

      if (statsData) {
        setStats(statsData)
      }
    } catch (err: any) {
      toast({ title: "Error fetching data", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetails = async (userId: number) => {
    setIsLoadingDetails(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/${userId}`, {
        credentials: "include",
      })
      const data = await res.json()
      setSelectedUser(data)
    } catch (err: any) {
      toast({ title: "Error fetching user details", description: err.message, variant: "destructive" })
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const updateUserRole = async (userId: number, newRole: "ADMIN" | "USER") => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      })
      fetchData()
      if (selectedUser) {
        fetchUserDetails(userId)
      }
    } catch (err: any) {
      toast({ title: "Error updating role", description: err.message, variant: "destructive" })
    }
  }

  const handleBalanceAdjustment = async (type: "increase" | "decrease") => {
    if (!selectedUser || !adjustAmount) return

    const amount = Number.parseFloat(adjustAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a valid positive number", variant: "destructive" })
      return;
    }

    try {
      const endpoint = type === "increase" ? "credit" : "debit";

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/${selectedUser.id}/balance/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
        credentials: "include",
      });

      if (res.ok) {
        setAdjustAmount("");
        fetchUserDetails(selectedUser.id);
        fetchData();
        toast({ title: "Success", description: "Wallet balance updated." })
      } else {
        const errorData = await res.json();
        toast({ title: "Failed", description: errorData.message || "Operation failed", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error", variant: "destructive" })
    }
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE}/auth/profile`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          setCurrentUserId(data.id)
        })

    const timer = setTimeout(() => {
      fetchData()
    }, 300)
    return () => clearTimeout(timer)
  }, [currentPage, searchQuery])

  const handleRowClick = (user: User) => {
    setIsDetailsOpen(true)
    fetchUserDetails(user.id)
  }

  const toggleBanStatus = async (userId: number, currentStatus: string) => {
    const isBanned = currentStatus !== "BANNED";
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/users/${userId}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned }),
        credentials: "include",
      });

      if (res.ok) {
        fetchData();
        if (selectedUser?.id === userId) fetchUserDetails(userId);
      }
    } catch(err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    }
  }

  const totalPages = Math.ceil(totalListUsers / ITEMS_PER_PAGE)

  const totalDeposits =
      selectedUser?.wallet.transactions.filter((t) => t.type === "CREDIT").reduce((sum, t) => sum + t.amount, 0) || 0

  const totalSpent =
      selectedUser?.wallet.transactions.filter((t) => t.type === "DEBIT").reduce((sum, t) => sum + t.amount, 0) || 0

  if (loading && users.length === 0) {
    return (
        <div className="p-4 sm:p-6 space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Manage user accounts, roles, and wallet balances
            </p>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
              <div className="h-32 bg-muted rounded-xl" />
            </div>
            <div className="h-10 bg-muted rounded-xl" />
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
    )
  }

  return (
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Manage user accounts, roles, and wallet balances
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-border/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                <Users className="size-6 text-blue-600 dark:text-blue-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Total Users</p>
                <p className="text-xl sm:text-2xl font-bold">{(stats?.totalUsers || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-gradient-to-br from-green-500/5 to-green-500/10">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/10 ring-1 ring-green-500/20">
                <Activity className="size-6 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">Active (30 Days)</p>
                <p className="text-xl sm:text-2xl font-bold">{(stats?.activeUsers || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-gradient-to-br from-violet-500/5 to-violet-500/10 sm:col-span-2 lg:col-span-1">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex size-12 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <UserPlus className="size-6 text-violet-600 dark:text-violet-500" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">New (7 Days)</p>
                <p className="text-xl sm:text-2xl font-bold">{(stats?.newUsers || 0).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
              placeholder="Search by email or username..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
          />
        </div>

        {/* Users Table */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="min-w-[250px]">User Info</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Role</TableHead>
                    <TableHead className="text-right min-w-[120px]">Balance</TableHead>
                    <TableHead className="min-w-[120px]">Joined</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Search className="size-8 mb-2 opacity-50" />
                            <p className="text-sm">No users found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                  ) : (
                      users.map((user) => (
                          <TableRow
                              key={user.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleRowClick(user)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="size-9 ring-2 ring-border/50">
                                  <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-foreground font-semibold text-sm">
                                    {user.username.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate">{user.username}</span>
                                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge
                                  variant={user.status === "ACTIVE" ? "default" : "destructive"}
                                  className={
                                    user.status === "ACTIVE"
                                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20"
                                        : ""
                                  }
                              >
                                {user.status === "ACTIVE" ? (
                                    <CheckCircle2 className="size-3 mr-1" />
                                ) : (
                                    <Ban className="size-3 mr-1" />
                                )}
                                {user.status}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <Badge
                                  variant="outline"
                                  className={
                                    isAdminRole(user.role)
                                        ? "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400"
                                        : "border-border/50"
                                  }
                              >
                                {isAdminRole(user.role) && <Shield className="size-3 mr-1" />}
                                {getRoleName(user.role)}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right">
                        <span className="font-semibold text-base">
                          $
                          {user.balance.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                            </TableCell>

                            <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(user.joinedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                            </TableCell>

                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <MoreVertical className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => handleRowClick(user)}>
                                    <Users className="size-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                      onClick={() => updateUserRole(user.id, isAdminRole(user.role) ? "USER" : "ADMIN")}
                                  >
                                    <Shield className="size-4 mr-2" />
                                    {isAdminRole(user.role) ? "Remove Admin" : "Make Admin"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                      onClick={() => toggleBanStatus(user.id, user.status)}
                                      disabled={user.id === currentUserId}
                                      className={user.status === "BANNED" ? "text-green-600" : "text-red-600"}
                                  >
                                    <Ban className="size-4 mr-2" />
                                    {user.status === "BANNED" ? "Unban User" : "Ban User"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalListUsers)}{" "}
                of {totalListUsers} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4 mr-1" />
                  Previous
                </Button>
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                        <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-9"
                        >
                          {pageNum}
                        </Button>
                    )
                  })}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              </div>
            </div>
        )}

        {/* User Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
            {isLoadingDetails || !selectedUser ? (
                <div className="py-12 space-y-4">
                  <DialogTitle className="sr-only">Loading User Details</DialogTitle>
                  <div className="animate-pulse space-y-4">
                    <div className="h-20 bg-muted rounded" />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="h-32 bg-muted rounded" />
                      <div className="h-32 bg-muted rounded" />
                    </div>
                    <div className="h-64 bg-muted rounded" />
                  </div>
                </div>
            ) : (
                <>
                  <DialogHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <Avatar className="size-16 ring-2 ring-border">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-foreground font-bold text-xl">
                          {selectedUser.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <DialogTitle className="text-xl sm:text-2xl">{selectedUser.username}</DialogTitle>
                        <DialogDescription className="text-sm sm:text-base">{selectedUser.email}</DialogDescription>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge
                              variant={selectedUser.status === "ACTIVE" ? "default" : "destructive"}
                              className={
                                selectedUser.status === "ACTIVE"
                                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                                    : ""
                              }
                          >
                            {selectedUser.status}
                          </Badge>
                          <Badge
                              variant="outline"
                              className={
                                isAdminRole(selectedUser.role)
                                    ? "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400"
                                    : ""
                              }
                          >
                            {getRoleName(selectedUser.role)}
                          </Badge>
                        </div>
                      </div>
                      <Restricted to="MANAGE_USERS">
                        <Button
                            variant={selectedUser.status === "BANNED" ? "default" : "destructive"}
                            size="sm"
                            onClick={() => toggleBanStatus(selectedUser.id, selectedUser.status)}
                        >
                          <Ban className="size-4 mr-2" />
                          {selectedUser.status === "BANNED" ? "Unban" : "Ban User"}
                        </Button>
                      </Restricted>
                    </div>
                  </DialogHeader>

                  <div className="space-y-6 mt-6">
                    {/* Wallet Card */}
                    <Card className="border-border/50 bg-gradient-to-br from-green-500/5 to-green-500/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Wallet className="size-5 text-green-600 dark:text-green-500" />
                          Wallet
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Current Balance</p>
                            <p className="text-2xl font-bold">
                              $
                              {selectedUser.wallet.balance.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Total Deposits</p>
                            <p className="text-xl font-semibold text-green-600 dark:text-green-500">
                              +$
                              {totalDeposits.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Total Spent</p>
                            <p className="text-xl font-semibold text-red-600 dark:text-red-500">
                              -$
                              {totalSpent.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>

                        <Restricted to="MANAGE_FINANCE">
                            <div className="border-t border-border/50 pt-4">
                              <p className="text-sm font-medium mb-3">Manually Adjust Balance</p>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={adjustAmount}
                                    onChange={(e) => setAdjustAmount(e.target.value)}
                                    className="flex-1"
                                />
                                <div className="flex gap-2">
                                  <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleBalanceAdjustment("increase")}
                                      className="flex-1 sm:flex-none border-green-500/30 hover:bg-green-500/10"
                                  >
                                    <Plus className="size-4 mr-1" />
                                    Add
                                  </Button>
                                  <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleBalanceAdjustment("decrease")}
                                      className="flex-1 sm:flex-none border-red-500/30 hover:bg-red-500/10"
                                  >
                                    <Minus className="size-4 mr-1" />
                                    Deduct
                                  </Button>
                                </div>
                              </div>
                            </div>
                        </Restricted>

                        {selectedUser.wallet.transactions.length > 0 && (
                            <div className="border-t border-border/50 pt-4">
                              <p className="text-sm font-medium mb-3">Recent Transactions</p>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedUser.wallet.transactions.slice(0, 10).map((transaction) => (
                                    <div
                                        key={transaction.id}
                                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
                                    >
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        {transaction.type === "CREDIT" ? (
                                            <div className="flex size-8 items-center justify-center rounded-full bg-green-500/10 shrink-0">
                                              <TrendingUp className="size-4 text-green-600 dark:text-green-500" />
                                            </div>
                                        ) : (
                                            <div className="flex size-8 items-center justify-center rounded-full bg-red-500/10 shrink-0">
                                              <TrendingDown className="size-4 text-red-600 dark:text-red-500" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p
                                              className={`text-sm font-medium ${
                                                  transaction.type === "CREDIT"
                                                      ? "text-green-600 dark:text-green-500"
                                                      : "text-red-600 dark:text-red-500"
                                              }`}
                                          >
                                            {transaction.type === "CREDIT" ? "+" : "-"}$
                                            {transaction.amount.toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {new Date(transaction.createdAt).toLocaleString("en-US", {
                                              month: "short",
                                              day: "numeric",
                                              year: "numeric",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </p>
                                        </div>
                                      </div>
                                      {transaction.reference && (
                                          <Badge variant="outline" className="text-xs shrink-0">
                                            {transaction.reference}
                                          </Badge>
                                      )}
                                    </div>
                                ))}
                              </div>
                            </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Library Card */}
                    <Card className="border-border/50 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <BookOpen className="size-5 text-blue-600 dark:text-blue-500" />
                          Purchased Chapter ({selectedUser.accessRecords.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedUser.accessRecords.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <BookOpen className="size-12 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">No books purchased yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {selectedUser.accessRecords.map((chapter) => (
                                  <div
                                      key={chapter.id}
                                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/50"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium truncate">{chapter.chapterTitle}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Purchased{" "}
                                        {new Date(chapter.purchasedAt).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="font-semibold text-sm">${(chapter.price || 0).toFixed(2)}</p>
                                    </div>
                                  </div>
                              ))}
                            </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Activity History Card */}
                    <Card className="border-border/50 bg-gradient-to-br from-violet-500/5 to-violet-500/10">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Clock className="size-5 text-violet-600 dark:text-violet-500" />
                          Activity History
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Last Login</p>
                            <p className="text-sm font-medium">
                              {selectedUser.lastLoginAt
                                  ? new Date(selectedUser.lastLoginAt).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                  : "Never logged in"}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">Member Since</p>
                            <p className="text-sm font-medium">
                              {new Date(selectedUser.createdAt).toLocaleString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>

                        {selectedUser.accessRecords.length > 0 && (
                            <div className="border-t border-border/50 pt-4">
                              <p className="text-sm font-medium mb-3">Chapter Purchase History</p>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedUser.accessRecords.map((record) => (
                                    <div
                                        key={record.id}
                                        className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/50"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{record.chapterTitle}</p>
                                        <p className="text-xs text-muted-foreground truncate">{record.bookTitle}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(record.purchasedAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })}
                                        </p>
                                      </div>
                                      <div className="shrink-0">
                                        <p className="font-semibold text-sm">${(record.price || 0).toFixed(2)}</p>
                                      </div>
                                    </div>
                                ))}
                              </div>
                            </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
            )}
          </DialogContent>
        </Dialog>
      </div>
  )
}
