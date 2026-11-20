import { useEffect, useState } from "react"
import { toast } from "sonner"
import { IconDownload, IconEye } from "@tabler/icons-react"
import { AttendanceFiltersBar } from "@/components/attendance-filters"
import { AttendanceTypeBadge, CorrectedBadge, PunctualityBadge } from "@/components/attendance-badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { EmployeeCell } from "@/components/employee-cell"
import { PageHeader } from "@/components/page-header"
import { PhotoThumb } from "@/components/photo-preview-dialog"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAllAttendance, type AttendanceFilters } from "@/hooks/queries"
import { useDebounce } from "@/hooks/use-debounce"
import { downloadFile, getErrorMessage } from "@/lib/api"
import { fmtDate, fmtTime } from "@/lib/format"

const COLS = 6

/** Monitoring absensi seluruh karyawan (view only untuk HRD) */
export default function MonitoringPage() {
  const [filters, setFilters] = useState<AttendanceFilters>({ page: 1, limit: 10 })
  const [search, setSearch] = useState("")
  const debounced = useDebounce(search)
  useEffect(() => setFilters((f) => ({ ...f, search: debounced || undefined, page: 1 })), [debounced])
  const q = useAllAttendance(filters)
  const patch = (p: Partial<AttendanceFilters>) => setFilters((f) => ({ ...f, ...p }))
  const [exporting, setExporting] = useState(false)

  /** Export semua baris sesuai filter aktif (bukan hanya halaman ini) */
  const exportCsv = async () => {
    const { page: _page, limit: _limit, ...params } = filters
    setExporting(true)
    try {
      await downloadFile("/attendance/export", params, "absensi.csv")
    } catch (e) {
      toast.error("Export gagal", { description: getErrorMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Monitoring Absensi"
        description="Pantau absensi WFH yang telah disubmit oleh karyawan."
        actions={
          <>
            <Badge variant="secondary" className="gap-1"><IconEye /> Mode lihat saja</Badge>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || q.data?.meta.total === 0}>
              {exporting ? <Spinner /> : <IconDownload />} Export CSV
            </Button>
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
                  q.data?.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <EmployeeCell name={a.employee?.fullName ?? "(karyawan dihapus)"} subtitle={a.employee ? `${a.employee.employeeCode} · ${a.employee.department}` : undefined} />
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
