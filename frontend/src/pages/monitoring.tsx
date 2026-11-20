import { IconEye } from "@tabler/icons-react"
import { AttendanceFiltersBar } from "@/components/attendance-filters"
import { AttendanceTypeBadge, CorrectedBadge, PunctualityBadge } from "@/components/attendance-badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { EmployeeCell } from "@/components/employee-cell"
import { ExportMenu } from "@/components/export-menu"
import { PageHeader } from "@/components/page-header"
import { PhotoThumb } from "@/components/photo-preview-dialog"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAllAttendance } from "@/hooks/queries"
import { ATTENDANCE_FILTER_DEFAULTS, ATTENDANCE_FILTER_RULES, useSearchInput, useUrlFilters } from "@/hooks/use-url-filters"
import { fmtDate, fmtTime } from "@/lib/format"
import { rowNo } from "@/lib/utils"

const COLS = 7

/** Monitoring absensi seluruh karyawan (view only untuk HRD) */
export default function MonitoringPage() {
  const [filters, patch] = useUrlFilters(ATTENDANCE_FILTER_DEFAULTS, ATTENDANCE_FILTER_RULES)
  const [search, setSearch] = useSearchInput(filters.search, (s) => patch({ search: s, page: 1 }))
  const q = useAllAttendance(filters)
  const { page: _page, limit: _limit, ...exportParams } = filters

  return (
    <>
      <PageHeader
        title="Monitoring Absensi"
        description="Seluruh catatan absensi WFH karyawan beserta foto bukti kehadiran."
        actions={
          <>
            <Badge variant="secondary" className="gap-1"><IconEye /> Mode lihat saja</Badge>
            {/* export semua baris sesuai filter aktif (bukan hanya halaman ini) */}
            <ExportMenu url="/attendance/export" params={exportParams} fallbackName="absensi" disabled={q.data?.meta.total === 0} />
          </>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <AttendanceFiltersBar value={filters} onChange={patch} searchValue={search} onSearchChange={setSearch} />
          <div className="border-y">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Status / Catatan</TableHead>
                  <TableHead className="w-16 text-center">Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={COLS} />
                ) : q.isError ? (
                  <TableMessage cols={COLS} error title="Gagal memuat data" onRetry={() => q.refetch()} />
                ) : q.data?.data.length === 0 ? (
                  <TableMessage cols={COLS} title="Tidak ada data absensi" description="Coba ubah kata kunci atau rentang tanggal." />
                ) : (
                  q.data?.data.map((a, i) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground w-12 text-center tabular-nums">{rowNo(i, q.data?.meta)}</TableCell>
                      <TableCell>
                        <EmployeeCell name={a.employee?.fullName ?? "(karyawan dihapus)"} subtitle={a.employee ? `${a.employee.nip} · ${a.employee.department}` : undefined} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{fmtDate(a.attendanceDate)}</TableCell>
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
                      <TableCell><div className="flex justify-center"><PhotoThumb attendance={a} title={a.employee?.fullName} /></div></TableCell>
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
