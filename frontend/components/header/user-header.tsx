'use client';

import { type IconKey, isIconKey } from '@readory/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronRight, LayoutDashboard, LogOut, Search, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { BrandLogo } from '@/components/brand-logo';
import { GenreCarousel } from '@/components/header/genre-carousel';
import { LiveSearchResults } from '@/components/header/live-search-results';
import { TypeCarousel } from '@/components/header/type-carousel';
import { WalletCard } from '@/components/header/wallet-card';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useLiveSearch } from '@/hooks/use-live-search';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import { apiClient } from '@/lib/api-client';
import { getAvatarUrl } from '@/lib/media';
import type { BookGenre } from '@/lib/types';
import { cn } from '@/lib/utils';

type BookType = { name: string; slug: string; iconKey: IconKey };

function initialsFromUsername(username: string) {
  const safe = (username || '').trim();
  if (!safe) return 'U';
  return safe.slice(0, 2).toUpperCase();
}

/* Desktop dropdown */
function NavDropdown({
  label,
  icon: Icon,
  href,
  children,
  isActive,
}: {
  label: string;
  icon: IconKey;
  href: string;
  children: React.ReactNode;
  isActive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = () => {
    timer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <Link
        href={href}
        className={cn(
          'group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <AppIcon name={Icon} className="h-4 w-4" />
        {label}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 opacity-60 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        {isActive && (
          <motion.span
            layoutId="nav-active-underline"
            className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          />
        )}
      </Link>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute top-full z-50 pt-3 ltr:left-0 rtl:right-0"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Mobile Section */
function MobileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

/* Mobile Nav Link */
function MobileNavLink({
  href,
  icon: Icon,
  label,
  onClick,
  badge,
  active,
}: {
  href: string;
  icon: IconKey;
  label: string;
  onClick?: () => void;
  badge?: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98]',
        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
          active ? 'bg-primary/20' : 'bg-muted',
        )}
      >
        <AppIcon name={Icon} className="h-4 w-4" />
      </div>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {badge}
        </span>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 rtl:rotate-180" />
    </Link>
  );
}

/* Main Header */
export function UserHeader() {
  const t = useTranslations('UserHeader');
  const g = useTranslations('General');
  const router = useRouter();
  const pathname = usePathname();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const {
    results: searchResults,
    isLoading: searchLoading,
    error: searchError,
  } = useLiveSearch(searchQuery);

  const { isRTL } = useLocaleInfo();

  /* current user */
  const {
    user,
    isLoading: userLoading,
    isAuthenticated: authenticated,
    isAdmin,
    clear,
  } = useCurrentUser();

  const [genres, setGenres] = useState<BookGenre[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);
  const [bookType, setBookType] = useState<BookType[]>([]);
  const [bookTypeLoading, setBookTypeLoading] = useState(true);

  /* scroll listener */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* lock body scroll when mobile menu is open */
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  /* load genres */
  useEffect(() => {
    const ac = new AbortController();
    const loadGenres = async () => {
      setGenresLoading(true);
      try {
        const data = await apiClient
          .get<BookGenre[]>('/genres/featured', { signal: ac.signal })
          .catch(() => []);
        setGenres(
          (Array.isArray(data) ? data : []).map((g) => ({
            name: String(g.name),
            slug: String(g.slug),
            iconKey: g.iconKey,
          })),
        );
      } catch {
        setGenres([]);
      } finally {
        setGenresLoading(false);
      }
    };
    void loadGenres();
    return () => ac.abort();
  }, []);

  /* load BookType */
  useEffect(() => {
    const ac = new AbortController();
    const loadBookType = async () => {
      setBookTypeLoading(true);
      try {
        const data = await apiClient
          .get<BookType[]>('/public/book-types', { signal: ac.signal })
          .catch(() => []);
        setBookType(
          (Array.isArray(data) ? data : []).map((b) => ({
            name: String(b.name),
            slug: String(b.slug),
            iconKey: isIconKey(b.iconKey) ? b.iconKey : 'bookOpen',
          })),
        );
      } catch {
        setBookType([]);
      } finally {
        setBookTypeLoading(false);
      }
    };
    void loadBookType();
    return () => ac.abort();
  }, []);

  const topGenres = useMemo(() => genres.slice(0, 12), [genres]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowSearchResults(value.trim().length > 0);
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clear();
      router.replace('/');
      router.refresh();
    }
  };

  const submitSearch = () => {
    if (!searchQuery.trim()) return;
    router.push(`/books?q=${encodeURIComponent(searchQuery.trim())}`);
    setShowSearchResults(false);
    setMobileSearchOpen(false);
  };

  const handleSignIn = useCallback(() => {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    router.push(`/login?next=${encodeURIComponent(next)}`);
  }, [router]);

  const closeSearch = useCallback(() => {
    setShowSearchResults(false);
    setMobileSearchOpen(false);
    setSearchQuery('');
  }, []);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full transition-all duration-300',
          isScrolled
            ? 'border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-xl'
            : 'border-b border-transparent bg-background/95 backdrop-blur-sm',
        )}
      >
        <div className="container mx-auto flex h-16 items-center gap-3 px-4">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <BrandLogo priority className="h-8 w-auto" />
            <span className="text-lg font-bold tracking-tight">{g('Readory')}</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-0.5 lg:flex">
            <NavDropdown
              label={t('Books')}
              icon="bookOpen"
              href="/books"
              isActive={pathname.startsWith('/books')}
            >
              <div className="w-104 rounded-2xl border border-border bg-popover p-4 shadow-xl shadow-black/5">
                <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('BrowseByType')}
                </p>
                {bookTypeLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : bookType.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {t('NoBookType')}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {bookType.map((b) => (
                      <Link
                        key={b.slug}
                        href={`/${b.slug}`}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <AppIcon name={b.iconKey} className="h-4 w-4" />
                        </div>
                        <span className="truncate">{b.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </NavDropdown>

            <NavDropdown
              label={t('Genres')}
              icon="library"
              href="/genres"
              isActive={pathname.startsWith('/genres')}
            >
              <div className="w-md rounded-2xl border border-border bg-popover p-4 shadow-xl shadow-black/5">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('FeaturedGenres')}
                  </p>
                  <Link href="/genres" className="text-xs font-medium text-primary hover:underline">
                    {t('ViewAll')}
                  </Link>
                </div>
                {genresLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : topGenres.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t('NoGenres')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {topGenres.map((gn) => (
                      <Link
                        key={gn.slug}
                        href={`/genres/${gn.slug}`}
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                          <AppIcon name={gn.iconKey as IconKey} className="h-4 w-4" />
                        </div>
                        <span className="truncate">{gn.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </NavDropdown>

            <Link
              href="/collections"
              className={cn(
                'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                pathname.startsWith('/collections')
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <AppIcon name="collections" className="h-4 w-4" />
              {t('Collections')}
              {pathname.startsWith('/collections') && (
                <motion.span
                  layoutId="nav-active-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
            </Link>
          </nav>

          {/* Desktop Search */}
          <div className="relative mx-2 hidden max-w-xl flex-1 md:flex">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3.5 rtl:right-3.5" />
              <Input
                type="search"
                placeholder={t('SearchBooks')}
                className={cn(
                  'h-10 rounded-xl border-transparent bg-muted/50 ps-10 pe-12 transition-all duration-200',
                  'focus-visible:border-border focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20',
                )}
                value={searchQuery}
                onChange={onSearchChange}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setShowSearchResults(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSearchResults(false), 150);
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              />
            </div>

            <AnimatePresence>
              {showSearchResults && searchQuery.trim().length > 0 && (
                <LiveSearchResults
                  query={searchQuery}
                  results={searchResults}
                  isLoading={searchLoading}
                  error={searchError}
                  onSubmit={submitSearch}
                  onSelect={closeSearch}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Right Side */}
          <div className="ms-auto flex items-center gap-1">
            {/* Mobile search toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 md:hidden"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={t('SearchBooks')}
            >
              <Search className="h-5 w-5" />
            </Button>

            <div className="hidden items-center gap-1 lg:flex">
              <LanguageSwitcher />
              <ThemeSwitcher />
              {authenticated && <NotificationBell />}

              <div className="mx-1 w-0.5 h-7 rounded-full self-center bg-muted" />

              {/* Desktop User Menu */}
              {userLoading ? (
                <div className="h-9 w-9 animate-pulse rounded-xl bg-muted" />
              ) : authenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      className="flex items-center gap-2 rounded-xl p-1 pe-2.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('Account')}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(user.avatarKey)} alt={user.username ?? ''} />
                        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                          {initialsFromUsername(user.username ?? '')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden max-w-24 truncate text-sm font-medium xl:block">
                        {user.username}
                      </span>
                      <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground xl:block" />
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align={isRTL ? 'start' : 'end'}
                    sideOffset={10}
                    className="w-64 rounded-2xl p-1.5"
                  >
                    <DropdownMenuLabel className="p-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={getAvatarUrl(user.avatarKey)}
                            alt={user.username ?? ''}
                          />
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
                      </div>
                      <div className="mt-3">
                        <WalletCard balance={user.walletBalance ?? 0} isLoading={userLoading} />
                      </div>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => router.push('/dashboard')}
                      className="rounded-lg px-2.5 py-2"
                    >
                      <LayoutDashboard className="h-4 w-4 me-2" />
                      {t('Dashboard')}
                    </DropdownMenuItem>

                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => router.push('/admin')}
                        className="rounded-lg px-2.5 py-2"
                      >
                        <AppIcon name="shield" className="h-4 w-4 me-2" />
                        {t('AdminPanel')}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="rounded-lg px-2.5 py-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 me-2" />
                      {g('Logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" className="ms-1 gap-2 rounded-xl px-4" onClick={handleSignIn}>
                  <User className="h-4 w-4" />
                  {t('SignIn')}
                </Button>
              )}
            </div>

            {/* Mobile Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={t('NavigationMenu')}
            >
              <div className="flex w-5 flex-col items-center justify-center gap-1.25">
                <span
                  className={cn(
                    'block h-0.5 w-full origin-center rounded-full bg-foreground transition-all duration-300',
                    mobileOpen && 'translate-y-1.75 rotate-45',
                  )}
                />
                <span
                  className={cn(
                    'block h-0.5 w-full rounded-full bg-foreground transition-all duration-300',
                    mobileOpen && 'scale-x-0 opacity-0',
                  )}
                />
                <span
                  className={cn(
                    'block h-0.5 w-full origin-center rounded-full bg-foreground transition-all duration-300',
                    mobileOpen && '-translate-y-1.75 -rotate-45',
                  )}
                />
              </div>
            </Button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300 md:hidden',
            mobileSearchOpen ? 'max-h-[80vh] border-t border-border/50' : 'max-h-0',
          )}
        >
          <div className="container mx-auto px-4 py-3">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
                <Input
                  autoFocus={mobileSearchOpen}
                  type="search"
                  placeholder={t('SearchBooks')}
                  className="h-10 rounded-xl ps-10"
                  value={searchQuery}
                  onChange={onSearchChange}
                  onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setMobileSearchOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <AnimatePresence>
              {searchQuery.trim().length > 0 && (
                <LiveSearchResults
                  inline
                  query={searchQuery}
                  results={searchResults}
                  isLoading={searchLoading}
                  error={searchError}
                  onSubmit={submitSearch}
                  onSelect={closeSearch}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Mobile Menu (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-[85vw] max-w-sm flex-col p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">{t('NavigationMenu')}</SheetTitle>

          {/* Profile Area */}
          <div className="space-y-4 p-5 pb-4">
            {authenticated && user ? (
              <div className="space-y-4">
                {/* Profile Header */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={getAvatarUrl(user.avatarKey)} alt={user.username ?? ''} />
                    <AvatarFallback className="bg-primary/10 text-base font-bold text-primary">
                      {initialsFromUsername(user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{user.username}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                {/* Wallet */}
                <WalletCard balance={user.walletBalance ?? 0} isLoading={userLoading} />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-base font-semibold">{t('Welcome')}</p>
                  <p className="text-xs text-muted-foreground">{t('SignInToAccount')}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Scrollable Nav */}
          <div className="scrollbar-hide flex-1 space-y-6 overflow-y-auto px-4 py-4">
            {/* Account */}
            {authenticated && (
              <MobileSection title={t('Account')}>
                <MobileNavLink
                  href="/dashboard"
                  icon="layoutDashboard"
                  label={t('Dashboard')}
                  onClick={closeMobile}
                  active={pathname === '/dashboard'}
                />
                {isAdmin && (
                  <MobileNavLink
                    href="/admin"
                    icon="shield"
                    label={t('AdminPanel')}
                    onClick={closeMobile}
                    badge={t('Admin')}
                    active={pathname.startsWith('/admin')}
                  />
                )}
              </MobileSection>
            )}

            {/* Main Nav */}
            <MobileSection title={t('Navigate')}>
              <MobileNavLink
                href="/"
                icon="home"
                label={t('Home')}
                onClick={closeMobile}
                active={pathname === '/'}
              />
              <MobileNavLink
                href="/books"
                icon="bookOpen"
                label={t('AllBooks')}
                onClick={closeMobile}
                active={pathname === '/books'}
              />
              <MobileNavLink
                href="/notifications"
                icon="notifications"
                label={t('Notifications')}
                onClick={closeMobile}
                active={pathname === '/notifications'}
              />
              <MobileNavLink
                href="/collections"
                icon="collections"
                label={t('Collections')}
                onClick={closeMobile}
                active={pathname === '/collections'}
              />
              <MobileNavLink
                href="/genres"
                icon="library"
                label={t('Genres')}
                onClick={closeMobile}
                active={pathname === '/genres'}
              />
            </MobileSection>

            {/* Content Types */}
            {bookType.length > 0 && (
              <MobileSection title={t('BrowseByType')}>
                <TypeCarousel
                  types={bookType}
                  isLoading={bookTypeLoading}
                  activePath={pathname}
                  onItemClick={closeMobile}
                />
              </MobileSection>
            )}

            {/* Genres */}
            {topGenres.length > 0 && (
              <MobileSection title={t('PopularGenres')}>
                <GenreCarousel
                  genres={topGenres}
                  isLoading={genresLoading}
                  activePath={pathname}
                  onItemClick={closeMobile}
                  onViewAll={() => {
                    closeMobile();
                    router.push('/genres');
                  }}
                />
              </MobileSection>
            )}

            {/* Theme */}
            <MobileSection title={t('Appearance')}>
              <ThemeSwitcher variant="mobile" />
            </MobileSection>
            <MobileSection title={t('Language')}>
              <LanguageSwitcher variant="mobile" />
            </MobileSection>
          </div>

          {/* Bottom CTA */}
          <div className="border-t border-border/50 p-4">
            {authenticated ? (
              <Button
                variant="outline"
                className="h-11 w-full justify-center gap-2 rounded-xl border-destructive/20 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  closeMobile();
                  void handleLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                {g('Logout')}
              </Button>
            ) : (
              <Button
                className="h-11 w-full justify-center gap-2 rounded-xl"
                onClick={() => {
                  closeMobile();
                  handleSignIn();
                }}
              >
                <User className="h-4 w-4" />
                {t('SignIn')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
