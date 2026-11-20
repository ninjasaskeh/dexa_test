import { Link } from "react-router"
import { IconPencil } from "@tabler/icons-react"
import { AttendanceFiltersBar } from "@/components/attendance-filters"
import { AttendanceTypeBadge, CorrectedBadge, PunctualityBadge } from "@/components/attendance-badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { PageHeader } from "@/components/page-header"
import { PhotoThumb } from "@/components/photo-preview-dialog"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMyAttendance } from "@/hooks/queries"
import { ATTENDANCE_FILTER_DEFAULTS, ATTENDANCE_FILTER_RULES, useUrlFilters } from "@/hooks/use-url-filters"
import { fmtDateLong, fmtTime } from "@/lib/format"
import { rowNo } from "@/lib/utils"

const COLS = 6

export default function HistoryPage() {
  const [filters, patch] = useUrlFilters(ATTENDANCE_FILTER_DEFAULTS, ATTENDANCE_FILTER_RULES)
  const q = useMyAttendance(filters)

  return (
    <>
      <PageHeader
        title="Riwayat Absensi"
        description="Catatan check-in dan check-out WFH Anda."
        actions={<Button variant="outline" asChild><Link to="/requests?tab=corrections"><IconPencil /> Ajukan koreksi</Link></Button>}
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <AttendanceFiltersBar value={filters} onChange={patch} />
          <div className="border-y">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead className="w-16">Foto</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={COLS} />
                ) : q.isError ? (
                  <TableMessage cols={COLS} error title="Gagal memuat data" onRetry={() => q.refetch()} />
                ) : q.data?.data.length === 0 ? (
                  <TableMessage cols={COLS} title="Belum ada riwayat" description="Coba ubah filter atau lakukan absen terlebih dahulu." />
                ) : (
                  q.data?.data.map((a, i) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground w-12 text-center tabular-nums">{rowNo(i, q.data?.meta)}</TableCell>
                      <TableCell><PhotoThumb attendance={a} /></TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{fmtDateLong(a.attendanceDate)}</TableCell>
                      <TableCell className="font-medium tabular-nums">{fmtTime(a.recordedAt)}</TableCell>
                      <TableCell><AttendanceTypeBadge type={a.type} /></TableCell>
                      <TableCell className="max-w-64">
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex flex-wrap gap-1">
                            {a.type === "CHECK_IN" && <PunctualityBadge late={a.isLate} />}
                            {a.correctionId && <CorrectedBadge />}
                          </div>
                          {a.notes && <span className="text-muted-foreground truncate text-sm">{a.notes}</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination className="px-5 py-3" meta={q.data?.meta} onPageChange={(page) => patch({ page })} onLimitChange={(limit) => patch({ limit, page: 1 })} />
        </CardContent>
      </Card>
    </>
  )
}
