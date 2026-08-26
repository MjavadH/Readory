'use client';

import { Check, ChevronDown, Languages } from 'lucide-react';
import Image from 'next/image';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocaleInfo } from '@/hooks/use-locale-info';
import { getSupportedLocales, type SupportedLocale } from '@/i18n/locales';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'default' | 'mobile' | 'sidebar';
}

export function LanguageSwitcher({ variant = 'default' }: LanguageSwitcherProps) {
  const { locale: currentLocale, localeInfo: currentLanguage } = useLocaleInfo();
  const supportedLocales = getSupportedLocales();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (newLocale: SupportedLocale) => {
    if (newLocale === currentLocale) return;

    startTransition(() => {
      // biome-ignore lint/suspicious/noDocumentCookie: Direct cookie write required to persist locale before page reload
      document.cookie = `locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      window.location.reload();
    });
  };

  if (variant === 'mobile') {
    return (
      <div className="flex flex-col gap-2 py-2">
        {supportedLocales.map((lang) => (
          <button
            type="button"
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isPending}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 relative overflow-hidden group',
              currentLocale === lang.code
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-foreground hover:bg-accent/50 active:bg-accent',
              isPending && 'opacity-50 cursor-not-allowed',
            )}
          >
            {/* Background glow effect */}
            {currentLocale === lang.code && (
              <div className="absolute inset-0 bg-linear-to-r from-primary/0 via-primary/20 to-primary/0 animate-pulse" />
            )}

            <div
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200',
                currentLocale === lang.code ? 'bg-primary-foreground/20 shadow-sm' : 'bg-accent/50',
              )}
            >
              <Image
                src={lang.flag}
                alt={lang.nativeName}
                width={24}
                height={18}
                className="rounded-sm object-cover w-6 h-4.5"
              />
            </div>

            <div className="relative flex-1 text-start">
              <div className="font-semibold">{lang.name}</div>
              <div
                className={cn(
                  'text-xs',
                  currentLocale === lang.code
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground',
                )}
              >
                {lang.nativeName}
              </div>
            </div>

            {currentLocale === lang.code && (
              <div className="relative">
                <Check className="h-5 w-5" />
              </div>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger dir={currentLanguage.isRTL ? 'rtl' : 'ltr'} asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-full justify-between gap-2 px-2 text-sm font-medium hover:bg-accent"
            title={currentLanguage.nativeName}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Languages className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">{currentLanguage.nativeName}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={8}
          className="grid w-56 grid-cols-2 gap-1 p-1.5"
        >
          {supportedLocales.map((lang) => {
            const active = currentLocale === lang.code;
            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                  active && 'bg-accent font-semibold',
                  supportedLocales.length % 2 && 'last:col-span-2',
                )}
              >
                <Image
                  src={lang.flag}
                  alt={lang.nativeName}
                  width={16}
                  height={12}
                  className="rounded-[2px] object-cover w-6 h-4.5"
                />
                <span className="truncate">{lang.nativeName}</span>
                {active && <Check className="ms-auto h-3 w-3" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default dropdown variant
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 relative h-10"
          disabled={isPending}
          aria-label="Change language"
        >
          <div className="flex items-center gap-2">
            {currentLanguage && (
              <Image
                src={currentLanguage.flag}
                alt={currentLanguage.nativeName}
                width={18}
                height={13}
                className="rounded-sm object-cover w-6 h-4.5"
              />
            )}
            <span className="hidden sm:inline text-sm font-medium">
              {currentLanguage?.name || 'Language'}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 opacity-50 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={currentLanguage.isRTL ? 'start' : 'end'}
        className="w-56 rounded-lg p-1"
      >
        {supportedLocales.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isPending}
            className={cn(
              'rounded-md px-3 py-2.5 cursor-pointer flex items-center gap-3 transition-all duration-150 relative group',
              currentLocale === lang.code ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50',
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                currentLocale === lang.code
                  ? 'bg-primary/15'
                  : 'bg-accent/30 group-hover:bg-accent/50',
              )}
            >
              <Image
                src={lang.flag}
                alt={lang.nativeName}
                width={20}
                height={15}
                className="rounded-sm object-cover w-6 h-4.5"
              />
            </div>

            <div className="flex-1">
              <div className="font-medium text-sm">{lang.name}</div>
              <div className="text-xs text-muted-foreground">{lang.nativeName}</div>
            </div>

            {currentLocale === lang.code && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
