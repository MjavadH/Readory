'use client';

import { Loader2, Menu } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/media';
import { useAuth } from '@/providers/auth-provider';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    redirect('/login');
  }

  function initialsFromUsername(username: string) {
    const safe = (username || '').trim();
    if (!safe) return 'U';
    return safe.slice(0, 2).toUpperCase();
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden relative">
        {/* Header */}
        <header className="h-18 border-b border-border flex items-center justify-between px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="md:hidden p-2 hover:bg-muted rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link href={`/u/${user.username}`} className="hidden md:flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={getAvatarUrl(user.avatarKey)} alt={user.username ?? ''} />
                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                  {initialsFromUsername(user.username ?? '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{user.username}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 bg-background custom-scrollbar">
          {children}
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 bg-black/50 z-50 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-card z-50 transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Sidebar />
      </div>
    </div>
  );
}
