import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export type SiteBreadcrumbItem = {
  label: string;
  href?: string;
  icon?: ReactNode;
};

type SiteBreadcrumbProps = {
  items: SiteBreadcrumbItem[];
};

const HOME_ITEM = { label: 'Home', href: '/' } as const;

export function Breadcrumb({ items }: SiteBreadcrumbProps) {
  const breadcrumbItems: SiteBreadcrumbItem[] = [HOME_ITEM, ...items];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto rounded-full border border-border bg-background/70 px-2 py-1.5 text-sm shadow-sm backdrop-blur-md scrollbar-none sm:gap-1.5 sm:px-3">
          {breadcrumbItems.map((item, index) => {
            const isHome = index === 0;
            const isCurrentPage = index === breadcrumbItems.length - 1;

            return (
              <li key={`${item.href ?? 'current'}-${item.label}`} className="contents">
                {index > 0 ? (
                  <ChevronRight
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 rtl:rotate-180"
                  />
                ) : null}

                {item.href && !isCurrentPage ? (
                  <Link
                    href={item.href}
                    className={
                      isHome
                        ? 'flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                        : 'flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary transition-colors hover:bg-primary/15'
                    }
                  >
                    {isHome ? <Home className="h-3.5 w-3.5" aria-hidden /> : item.icon}
                    <span className={isHome ? 'hidden sm:inline' : undefined}>{item.label}</span>
                    {isHome ? <span className="sr-only sm:hidden">Home</span> : null}
                  </Link>
                ) : (
                  <span
                    aria-current={isCurrentPage ? 'page' : undefined}
                    className="block min-w-0 truncate px-2.5 py-1 font-semibold text-foreground"
                  >
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

export function buildBreadcrumbJsonLd(
  items: Array<Pick<SiteBreadcrumbItem, 'label' | 'href'>>,
  toAbsoluteUrl: (path: string) => string,
) {
  const breadcrumbItems: Array<Pick<SiteBreadcrumbItem, 'label' | 'href'>> = [HOME_ITEM, ...items];

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: toAbsoluteUrl(item.href ?? ''),
    })),
  };
}
