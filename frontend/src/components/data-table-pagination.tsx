import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Paginated } from "@/types"

interface Props {
  className?: string
  meta?: Paginated<unknown>["meta"]
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

/** Pagination server-side untuk tabel */
export function DataTablePagination({ className, meta, onPageChange, onLimitChange }: Props) {
  if (!meta) return null
  const { page, limit, total, totalPages } = meta
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return (
    <div className={cn("flex flex-col-reverse items-center justify-between gap-3 sm:flex-row", className)}>
      <p className="text-muted-foreground text-sm">
        Menampilkan <span className="text-foreground font-medium">{from}–{to}</span> dari{" "}
        <span className="text-foreground font-medium">{total}</span> data
      </p>
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-sm">Baris</span>
          <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
            <SelectTrigger size="sm" className="w-18">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 50].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm font-medium">Hal. {page} / {totalPages}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" className="hidden lg:flex" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="Halaman pertama"><IconChevronsLeft /></Button>
          <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Sebelumnya"><IconChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Berikutnya"><IconChevronRight /></Button>
          <Button variant="outline" size="icon-sm" className="hidden lg:flex" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Halaman terakhir"><IconChevronsRight /></Button>
        </div>
      </div>
    </div>
  )
}
