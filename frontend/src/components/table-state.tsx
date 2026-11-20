import type { ReactNode } from "react"
import { IconDatabaseOff, IconAlertTriangle } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { TableCell, TableRow } from "@/components/ui/table"

/** Baris skeleton saat data tabel sedang dimuat */
export function TableSkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return Array.from({ length: rows }, (_, r) => (
    <TableRow key={r}>
      {Array.from({ length: cols }, (_, c) => (
        <TableCell key={c}><Skeleton className="h-5 w-full max-w-40" /></TableCell>
      ))}
    </TableRow>
  ))
}

/** State kosong / error di dalam tabel */
export function TableMessage({ cols, error, title, description, action, onRetry }: {
  cols: number; error?: boolean; title: string; description?: string; action?: ReactNode; onRetry?: () => void
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cols}>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">{error ? <IconAlertTriangle /> : <IconDatabaseOff />}</EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
            {description && <EmptyDescription>{description}</EmptyDescription>}
          </EmptyHeader>
          {(action || onRetry) && (
            <EmptyContent>{action ?? <Button variant="outline" size="sm" onClick={onRetry}>Coba lagi</Button>}</EmptyContent>
          )}
        </Empty>
      </TableCell>
    </TableRow>
  )
}
