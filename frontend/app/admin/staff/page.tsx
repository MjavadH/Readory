'use client';

import type React from 'react';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  UserPlus,
  Edit,
  Trash2,
  Search,
  BookOpen,
  Users,
  DollarSign,
  UserCog,
  Crown,
  Check,
} from 'lucide-react';
import { useToast } from '@/providers/toast-provider';
import { apiClient, getApiErrorMessage } from '@/lib/api-client';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

type Permission =
  'MANAGE_BOOKS' | 'MANAGE_USERS' | 'MANAGE_FINANCE' | 'MANAGE_STAFF' | 'MANAGE_NOTIFICATIONS';

interface StaffMember {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN';
  permissions: Permission[];
  status: 'ACTIVE' | 'BANNED';
}

interface SearchUser {
  id: number;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export default function AdminStaff() {
  const t = useTranslations('AdminPage.StaffManagement');
  const g = useTranslations('General');
  const toast = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Dialog states
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [isEditPermissionsOpen, setIsEditPermissionsOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  // Alert dialog states
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [staffToRemove, setStaffToRemove] = useState<StaffMember | null>(null);

  // PERMISSIONS META
  const PERMISSIONS_META: Record<
    Permission,
    { label: string; description: string; icon: React.ElementType; color: string }
  > = {
    MANAGE_BOOKS: {
      label: t('ManageBooks'),
      description: t('ManageBooksDescription'),
      icon: BookOpen,
      color: 'text-blue-600 dark:text-blue-500',
    },
    MANAGE_USERS: {
      label: t('ManageUsers'),
      description: t('ManageUsersDescription'),
      icon: Users,
      color: 'text-green-600 dark:text-green-500',
    },
    MANAGE_FINANCE: {
      label: t('ManageFinance'),
      description: t('ManageFinanceDescription'),
      icon: DollarSign,
      color: 'text-yellow-600 dark:text-yellow-500',
    },
    MANAGE_STAFF: {
      label: t('ManageStaff'),
      description: t('ManageStaffDescription'),
      icon: UserCog,
      color: 'text-red-600 dark:text-red-500',
    },
    MANAGE_NOTIFICATIONS: {
      label: 'Manage notifications',
      description: 'Create broadcasts and review notification delivery status.',
      icon: UserCog,
      color: 'text-purple-600 dark:text-purple-500',
    },
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ data: StaffMember[] }>('/users', {
        query: { role: 'ADMIN', page: 1, limit: 50 },
      });
      if (data && Array.isArray(data.data)) {
        setStaff(data.data);
      }
    } catch (err) {
      console.error('Error fetching staff', err);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await apiClient.get<{ data: SearchUser[] }>('/users', {
        query: { search: query },
      });
      if (data && Array.isArray(data.data)) {
        const nonAdminUsers = data.data.filter((user: SearchUser) => user.role !== 'ADMIN');
        setSearchResults(nonAdminUsers);
      }
    } catch (err) {
      console.error('Error searching users', err);
    } finally {
      setIsSearching(false);
    }
  };

  const promoteToAdmin = async (userId: number) => {
    setIsSubmitting(true);
    try {
      await apiClient.patch(`/users/${userId}/role`, { role: 'ADMIN' });
      toast.success(t('UserPromoted'));

      setIsAddStaffOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      void fetchStaff();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePermissions = async () => {
    if (!selectedStaff) return;
    setIsSubmitting(true);

    try {
      await apiClient.patch(`/users/${selectedStaff.id}/permissions`, {
        permissions: selectedPermissions,
      });
      toast.success(t('PermissionsUpdated'));
      setIsEditPermissionsOpen(false);
      setSelectedStaff(null);
      setSelectedPermissions([]);
      void fetchStaff();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const demoteStaff = async () => {
    if (!staffToRemove) return;
    setIsSubmitting(true);

    try {
      await apiClient.patch(`/users/${staffToRemove.id}/role`, { role: 'USER' });
      toast.success(t('AdminRemoved', { AdminUsername: staffToRemove.username }));

      setIsRemoveDialogOpen(false);
      setStaffToRemove(null);
      void fetchStaff();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditPermissions = (staffMember: StaffMember) => {
    setSelectedStaff(staffMember);
    setSelectedPermissions(staffMember.permissions);
    setIsEditPermissionsOpen(true);
  };

  const togglePermission = (permission: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission],
    );
  };

  const isSuperAdmin = (staffMember: StaffMember) => staffMember.id === 1;

  useEffect(() => {
    void fetchStaff();
    apiClient
      .get<{ id?: number; userId?: number }>('/auth/profile')
      .then((data) => setCurrentUserId(data.id || data.userId || null));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 p-3 md:p-0">
              <div className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-48 rounded-md bg-muted animate-pulse" />
            </div>
            <Button disabled={true} className="gap-2 w-full sm:w-auto">
              <UserPlus className="size-4" />
              {t('AddStaff')}
            </Button>
          </div>
          <div className="animate-pulse space-y-4">
            <div className="h-96 bg-muted rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-muted/30 via-background to-muted/20 pb-20 sm:pb-0">
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-400 mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <Button onClick={() => setIsAddStaffOpen(true)} className="gap-2 w-full sm:w-auto">
            <UserPlus className="size-4" />
            {t('AddStaff')}
          </Button>
        </div>

        {/* Staff Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="size-5" />
              {t('AdminStaff')} ({staff.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="min-w-62.5">{t('StaffMember')}</TableHead>
                    <TableHead className="min-w-75">{t('Permissions')}</TableHead>
                    <TableHead className="w-25">{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Shield className="size-8 mb-2 opacity-50" />
                          <p className="text-sm">{t('NoStaffFound')}</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    staff.map((member) => (
                      <TableRow key={member.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-10 ring-2 ring-border/50">
                              <AvatarFallback
                                className={
                                  isSuperAdmin(member)
                                    ? 'bg-linear-to-br from-amber-500/20 to-orange-500/20 text-foreground font-semibold'
                                    : 'bg-linear-to-br from-blue-500/20 to-violet-500/20 text-foreground font-semibold'
                                }
                              >
                                {member.username.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{member.username}</span>
                                {isSuperAdmin(member) && (
                                  <Crown className="size-4 text-amber-600 dark:text-amber-500 shrink-0" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground truncate">
                                {member.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {isSuperAdmin(member) ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-500"
                            >
                              <Crown className="size-3 me-1" />
                              {t('FullAccess')}
                            </Badge>
                          ) : member.permissions.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {t('NoPermissionsAssigned')}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(member.permissions || []).map((permission) => {
                                const meta = PERMISSIONS_META[permission];
                                const Icon = meta.icon;
                                return (
                                  <Badge
                                    key={permission}
                                    variant="outline"
                                    className="text-xs border-border/50 bg-muted/30"
                                  >
                                    <Icon className={`size-3 me-1 ${meta.color}`} />
                                    {meta.label}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() => openEditPermissions(member)}
                              disabled={
                                isSuperAdmin(member) ||
                                member.id === currentUserId ||
                                (currentUserId !== 1 && member.permissions.includes('MANAGE_STAFF'))
                              }
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 hover:bg-red-500/10 hover:text-red-600"
                              onClick={() => {
                                setStaffToRemove(member);
                                setIsRemoveDialogOpen(true);
                              }}
                              disabled={
                                isSuperAdmin(member) ||
                                member.id === currentUserId ||
                                (currentUserId !== 1 && member.permissions.includes('MANAGE_STAFF'))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Staff Dialog */}
        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('AddStaffMember')}</DialogTitle>
              <DialogDescription>{t('AddStaffMemberDescription')}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="relative">
                <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t('SearchUsers')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-10"
                />
              </div>

              {isSearching ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {t('Searching')}
                </div>
              ) : searchQuery && searchResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {t('NoUsersFound')}
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => promoteToAdmin(user.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar className="size-9 ring-2 ring-border/50">
                          <AvatarFallback className="bg-linear-to-br from-blue-500/20 to-violet-500/20 text-foreground font-semibold text-sm">
                            {user.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate text-sm">{user.username}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 bg-transparent"
                        onClick={() => promoteToAdmin(user.id)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <span className="animate-spin me-2">⏳</span>
                        ) : (
                          <UserPlus className="size-4 me-1" />
                        )}
                        {g('Add')}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  {t('TypingToSearch')}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Permissions Dialog */}
        <Dialog open={isEditPermissionsOpen} onOpenChange={setIsEditPermissionsOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('EditPermissions')}</DialogTitle>
              <DialogDescription>
                {selectedStaff &&
                  t('EditPermissionsDescription', { AdminUsername: selectedStaff.username })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {(Object.keys(PERMISSIONS_META) as Permission[]).map((permission) => {
                const meta = PERMISSIONS_META[permission];
                const Icon = meta.icon;
                const isChecked = selectedPermissions.includes(permission);

                const isDisabled = permission === 'MANAGE_STAFF' && currentUserId !== 1;

                return (
                  <div
                    key={permission}
                    className={`flex items-start gap-3 p-3 rounded-lg border border-border/50 transition-colors ${
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed bg-muted'
                        : 'hover:bg-muted/30 cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && togglePermission(permission)}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => togglePermission(permission)}
                      disabled={isDisabled}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`size-4 ${meta.color}`} />
                        <span className="font-medium text-sm">{meta.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsEditPermissionsOpen(false)}>
                {g('Cancel')}
              </Button>
              <Button onClick={updatePermissions} disabled={isSubmitting}>
                {isSubmitting ? (
                  g('Saving')
                ) : (
                  <>
                    <Check className="size-4" />
                    {g('Save')}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Remove Staff Confirmation Dialog */}
        <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('RemoveStaffMember')}</AlertDialogTitle>
              <AlertDialogDescription className="rtl:text-right">
                {staffToRemove?.username &&
                  t('RemoveStaffMemberDescription', { AdminUsername: staffToRemove?.username })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStaffToRemove(null)}>
                {g('Cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void demoteStaff();
                }}
                className="bg-red-600 hover:bg-red-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? g('Removing') : t('RemoveStaff')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
