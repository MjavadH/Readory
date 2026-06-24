"use client"

import type { MouseEvent, RefObject } from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {useTranslations} from "next-intl";

type PaginationScrollTarget = RefObject<HTMLElement | null> | string

type AdminPaginationProps = {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  itemLabel: string
  onPageChange: (page: number) => void
  canGoPrevious?: boolean
  canGoNext?: boolean
  scrollTarget?: PaginationScrollTarget
  scrollBehavior?: ScrollBehavior
}

const PAGE_WINDOW = 1

function getPaginationItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const items: Array<number | "ellipsis"> = [1]
  const start = Math.max(2, currentPage - PAGE_WINDOW)
  const end = Math.min(totalPages - 1, currentPage + PAGE_WINDOW)

  if (start > 2) {
    items.push("ellipsis")
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page)
  }

  if (end < totalPages - 1) {
    items.push("ellipsis")
  }

  items.push(totalPages)
  return items
}

export function AppPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
  canGoPrevious,
  canGoNext,
  scrollTarget,
  scrollBehavior = "smooth",
}: AdminPaginationProps) {
  if (totalPages <= 1) {
    return null
  }
  const t = useTranslations('General');
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages)
  const rangeStart = (safeCurrentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(safeCurrentPage * pageSize, totalItems)
  const pageItems = getPaginationItems(safeCurrentPage, totalPages)

  const previousEnabled = canGoPrevious ?? safeCurrentPage > 1
  const nextEnabled = canGoNext ?? safeCurrentPage < totalPages

  const scrollToTarget = () => {
    if (!scrollTarget || typeof window === "undefined") return

    window.requestAnimationFrame(() => {
      const target =
          typeof scrollTarget === "string"
              ? document.getElementById(scrollTarget)
              : scrollTarget.current

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      target?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : scrollBehavior,
        block: "start",
      })
    })
  }

  const handlePageClick = (event: MouseEvent<HTMLAnchorElement>, page: number, enabled = true) => {
    event.preventDefault()
    if (!enabled || page === safeCurrentPage) return
    onPageChange(page)
    scrollToTarget()
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-xs sm:text-sm text-muted-foreground">
        {t("AdminPaginationDescription", {RangeStart: rangeStart, RangeEnd: rangeEnd, TotalItems: totalItems, ItemLabel: itemLabel})}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(event) => handlePageClick(event, safeCurrentPage - 1, previousEnabled)}
              className={!previousEnabled ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>

          {pageItems.map((page, index) => (
            <PaginationItem key={`${page}-${index}`}>
              {page === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  isActive={page === safeCurrentPage}
                  onClick={(event) => handlePageClick(event, page)}
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(event) => handlePageClick(event, safeCurrentPage + 1, nextEnabled)}
              className={!nextEnabled ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
