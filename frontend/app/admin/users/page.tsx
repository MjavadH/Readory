'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppPagination } from '@/components/app-pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Users,
  UserPlus,
  Activity,
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
} from 'lucide-react';
import { useToast } from '@/providers/toast-provider';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { StatCard } from '@/components/admin/stat-card';
import { motion } from 'framer-motion';
import { usePermission } from '@/hooks/use-permission';
import { useTranslations } from 'next-intl';
import { getAvatarUrl } from '@/lib/media';

interface Transaction {
  id: number;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  reference?: string | null;
  createdAt: string;
}

interface AccessRecord {
  id: number;
  chapterId: number;
  chapterTitle: string;
  bookTitle: string;
  purchasedAt: string;
  price: number;
}

interface User {
  id: number;
  email: string;
  username: string;
  role: { id: number; name: 'ADMIN' | 'USER' } | 'ADMIN' | 'USER';
  lastLogin?: string;
  joinedAt: string;
  balance: number;
  status: 'ACTIVE' | 'BANNED';
  avatarKey: string;
}

interface UserDetails extends User {
  wallet: {
    balance: number;
    transactions: Transaction[];
  };
  accessRecords: AccessRecord[];
  lastLoginAt?: string;
  createdAt: string;
}

interface UserStats {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
}

const getRoleName = (role: User['role']): 'ADMIN' | 'USER' => {
  if (typeof role === 'string') return role;
  return role.name;
};

const isAdminRole = (role: User['role']): boolean => {
  if (typeof role === 'string') return role === 'ADMIN';
  return role.name === 'ADMIN';
};

export default function AdminUsers() {
  const t = useTranslations('AdminPage.UserManagement');
  const g = useTranslations('General');
  const { has } = usePermission();
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalListUsers, setTotalListUsers] = useState(0);
  const [stats, setStats] = useState<UserStats>({ totalUsers: 0, newUsers: 0, activeUsers: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const paginationScrollRef = useRef<HTMLDivElement>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const ITEMS_PER_PAGE = 20;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        apiClient.get<{ data: User[]; total: number }>('/users', {
          query: { page: currentPage, limit: ITEMS_PER_PAGE, search: searchQuery },
        }),
        apiClient.get<UserStats>('/users/stats'),
      ]);

      if (usersData && Array.isArray(usersData.data)) {
        setUsers(usersData.data);
        setTotalListUsers(usersData.total);
      }

      if (statsData) {
        setStats(statsData);
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err), t('ErrorFetchingData'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: number) => {
    setIsLoadingDetails(true);
    try {
      const data = await apiClient.get<UserDetails>(`/users/${userId}`);
      setSelectedUser(data);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err), t('ErrorFetchingUserDetails'));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const updateUserRole = async (userId: number, newRole: 'ADMIN' | 'USER') => {
    try {
      await apiClient.patch(`/users/${userId}/role`, { role: newRole });
      fetchData();
      if (selectedUser) {
        fetchUserDetails(userId);
      }
    } catch (err: any) {
      toast.error(getApiErrorMessage(err), t('ErrorUpdatingRole'));
    }
  };

  const handleBalanceAdjustment = async (type: 'increase' | 'decrease') => {
    if (!selectedUser || !adjustAmount) return;

    const amount = Number.parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('EnterValidNumber'), t('InvalidInput'));
      return;
    }

    try {
      const endpoint = type === 'increase' ? 'credit' : 'debit';

      await apiClient.post(`/users/${selectedUser.id}/balance/${endpoint}`, { amount });
      setAdjustAmount('');
      fetchUserDetails(selectedUser.id);
      fetchData();
      toast.success(t('WalletBalanceUpdated'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('NetworkError')));
    }
  };

  useEffect(() => {
    apiClient.get<{ id: number }>('/auth/profile').then((data) => {
      setCurrentUserId(data.id);
    });

    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [currentPage, searchQuery]);

  const handleRowClick = (user: User) => {
    setIsDetailsOpen(true);
    fetchUserDetails(user.id);
  };

  const toggleBanStatus = async (userId: number, currentStatus: string) => {
    const isBanned = currentStatus !== 'BANNED';
    try {
      await apiClient.patch(`/users/${userId}/ban`, { isBanned });
      fetchData();
      if (selectedUser?.id === userId) fetchUserDetails(userId);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const totalPages = Math.ceil(totalListUsers / ITEMS_PER_PAGE);

  const totalDeposits =
    selectedUser?.wallet.transactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0) || 0;

  const totalSpent =
    selectedUser?.wallet.transactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + t.amount, 0) || 0;

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
          <div className="space-y-2 p-3 md:p-0">
            <div className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded-md bg-muted animate-pulse" />
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <motion.div
          className="space-y-1 p-3 md:p-0"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t('Title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('Description')}</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            index={0}
            title={t('TotalUsers')}
            value={(stats?.totalUsers || 0).toLocaleString()}
            icon={Users}
            accent="primary"
          />
          <StatCard
            index={1}
            title={t('ActiveUsers')}
            value={(stats?.activeUsers || 0).toLocaleString()}
            icon={Activity}
            accent="emerald"
          />
          <StatCard
            index={2}
            title={t('NewUsers')}
            value={(stats?.newUsers || 0).toLocaleString()}
            icon={UserPlus}
            accent="amber"
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('SearchByEmailOrUsername')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="ps-10"
          />
        </div>

        {/* Users Table */}
        <Card ref={paginationScrollRef} className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="min-w-62.5 rtl:text-right">{t('UserInfo')}</TableHead>
                    <TableHead className="min-w-25 rtl:text-right">{t('Status')}</TableHead>
                    <TableHead className="min-w-25 rtl:text-right">{t('Role')}</TableHead>
                    <TableHead className="ltr:text-right min-w-30 rtl:text-left">
                      {t('Balance')}
                    </TableHead>
                    <TableHead className="min-w-30 rtl:text-right">{t('Joined')}</TableHead>
                    <TableHead className="w-15 rtl:text-right">{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Search className="size-8 mb-2 opacity-50" />
                          <p className="text-sm">{t('NoUsersFound')}</p>
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
                              <AvatarImage
                                src={getAvatarUrl(user.avatarKey)}
                                alt={user.username ?? ''}
                              />
                              <AvatarFallback className="bg-linear-to-br from-blue-500/20 to-violet-500/20 text-foreground font-semibold text-sm">
                                {user.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{user.username}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={user.status === 'ACTIVE' ? 'default' : 'destructive'}
                            className={
                              user.status === 'ACTIVE'
                                ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20'
                                : ''
                            }
                          >
                            {user.status === 'ACTIVE' ? (
                              <CheckCircle2 className="size-3 me-1" />
                            ) : (
                              <Ban className="size-3 me-1" />
                            )}
                            {user.status}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isAdminRole(user.role)
                                ? 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400'
                                : 'border-border/50'
                            }
                          >
                            {isAdminRole(user.role) && <Shield className="size-3 me-1" />}
                            {getRoleName(user.role)}
                          </Badge>
                        </TableCell>

                        <TableCell className="ltr:text-right rtl:text-left">
                          <span className="font-semibold text-base">
                            {g('CurrencySymbols')}{' '}
                            {user.balance.toLocaleString(g('locale'), {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(user.joinedAt).toLocaleDateString(g('locale'), {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
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
                                <Users className="size-4 me-2" />
                                {t('ViewDetails')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  updateUserRole(user.id, isAdminRole(user.role) ? 'USER' : 'ADMIN')
                                }
                              >
                                <Shield className="size-4 me-2" />
                                {isAdminRole(user.role) ? t('RemoveAdmin') : t('MakeAdmin')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleBanStatus(user.id, user.status)}
                                disabled={user.id === currentUserId}
                                className={
                                  user.status === 'BANNED' ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                <Ban className="size-4 me-2" />
                                {user.status === 'BANNED' ? t('UnbanUser') : t('BanUser')}
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

        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalListUsers}
          pageSize={ITEMS_PER_PAGE}
          itemLabel={t('users')}
          onPageChange={setCurrentPage}
          canGoPrevious={currentPage > 1}
          canGoNext={currentPage < totalPages}
          scrollTarget={paginationScrollRef}
        />

        {/* User Details Dialog */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
            {isLoadingDetails || !selectedUser ? (
              <div className="py-12 space-y-4">
                <DialogTitle className="sr-only">{t('LoadingUserDetails')}</DialogTitle>
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
                      <AvatarImage
                        src={getAvatarUrl(selectedUser.avatarKey)}
                        alt={selectedUser.username ?? ''}
                      />
                      <AvatarFallback className="bg-linear-to-br from-blue-500/20 to-violet-500/20 text-foreground font-bold text-xl">
                        {selectedUser.username.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-xl sm:text-2xl">
                        {selectedUser.username}
                      </DialogTitle>
                      <DialogDescription className="text-sm sm:text-base">
                        {selectedUser.email}
                      </DialogDescription>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge
                          variant={selectedUser.status === 'ACTIVE' ? 'default' : 'destructive'}
                          className={
                            selectedUser.status === 'ACTIVE'
                              ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20'
                              : ''
                          }
                        >
                          {selectedUser.status}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            isAdminRole(selectedUser.role)
                              ? 'border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400'
                              : ''
                          }
                        >
                          {getRoleName(selectedUser.role)}
                        </Badge>
                      </div>
                    </div>
                    {has('MANAGE_USERS') ? (
                      <Button
                        variant={selectedUser.status === 'BANNED' ? 'default' : 'destructive'}
                        size="sm"
                        onClick={() => toggleBanStatus(selectedUser.id, selectedUser.status)}
                      >
                        <Ban className="size-4 me-2" />
                        {selectedUser.status === 'BANNED' ? t('Unban') : t('BanUser')}
                      </Button>
                    ) : null}
                  </div>
                </DialogHeader>

                <div className="space-y-6 mt-6">
                  {/* Wallet Card */}
                  <Card className="border-border/50 bg-linear-to-br from-green-500/5 to-green-500/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Wallet className="size-5 text-green-600 dark:text-green-500" />
                        {t('Wallet')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {t('CurrentBalance')}
                          </p>
                          <p className="text-2xl font-bold">
                            {g('CurrencySymbols')}
                            {selectedUser.wallet.balance.toLocaleString(g('locale'), {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {t('TotalDeposits')}
                          </p>
                          <p className="text-xl font-semibold text-green-600 dark:text-green-500">
                            +{g('CurrencySymbols')}
                            {totalDeposits.toLocaleString(g('locale'), {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {t('TotalSpent')}
                          </p>
                          <p className="text-xl font-semibold text-red-600 dark:text-red-500">
                            -{g('CurrencySymbols')}
                            {totalSpent.toLocaleString(g('locale'), {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>
                      </div>
                      {has('MANAGE_FINANCE') ? (
                        <div className="border-t border-border/50 pt-4">
                          <p className="text-sm font-medium mb-3">{t('ManuallyAdjustBalance')}</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                              type="number"
                              placeholder={t('Amount')}
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              className="flex-1"
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBalanceAdjustment('increase')}
                                className="flex-1 sm:flex-none border-green-500/30 hover:bg-green-500/10"
                              >
                                <Plus className="size-4 me-1" />
                                {t('Add')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleBalanceAdjustment('decrease')}
                                className="flex-1 sm:flex-none border-red-500/30 hover:bg-red-500/10"
                              >
                                <Minus className="size-4 me-1" />
                                {t('Deduct')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {selectedUser.wallet.transactions.length > 0 && (
                        <div className="border-t border-border/50 pt-4">
                          <p className="text-sm font-medium mb-3">{t('RecentTransactions')}</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {selectedUser.wallet.transactions.slice(0, 10).map((transaction) => (
                              <div
                                key={transaction.id}
                                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {transaction.type === 'CREDIT' ? (
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
                                        transaction.type === 'CREDIT'
                                          ? 'text-green-600 dark:text-green-500'
                                          : 'text-red-600 dark:text-red-500'
                                      }`}
                                    >
                                      {transaction.type === 'CREDIT' ? '+' : '-'}
                                      {g('CurrencySymbols')}
                                      {transaction.amount.toLocaleString(g('locale'), {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(transaction.createdAt).toLocaleString(g('locale'), {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
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
                  <Card className="border-border/50 bg-linear-to-br from-blue-500/5 to-blue-500/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <BookOpen className="size-5 text-blue-600 dark:text-blue-500" />
                        {t('PurchasedChapter')} ({selectedUser.accessRecords.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedUser.accessRecords.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="size-12 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">{t('NoBooksPurchased')}</p>
                        </div>
                      ) : (
                        <div className="space-y-2 grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                          {selectedUser.accessRecords.map((chapter) => (
                            <div
                              key={chapter.id}
                              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-background/50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{chapter.bookTitle}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {chapter.chapterTitle}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t('Purchased')}{' '}
                                  {new Date(chapter.purchasedAt).toLocaleDateString(g('locale'), {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-semibold text-sm">
                                  {g('CurrencySymbols')}
                                  {(chapter.price || 0).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Activity History Card */}
                  <Card className="border-border/50 bg-linear-to-br from-violet-500/5 to-violet-500/10">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="size-5 text-violet-600 dark:text-violet-500" />
                        {t('ActivityHistory')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {t('LastLogin')}
                          </p>
                          <p className="text-sm font-medium">
                            {selectedUser.lastLoginAt
                              ? new Date(selectedUser.lastLoginAt).toLocaleString(g('locale'), {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : t('NeverLoggedIn')}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">
                            {t('MemberSince')}
                          </p>
                          <p className="text-sm font-medium">
                            {new Date(selectedUser.createdAt).toLocaleString(g('locale'), {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
