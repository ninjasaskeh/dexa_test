import { useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { differenceInCalendarDays, parseISO } from "date-fns"
import { IconCheck, IconSearch, IconX } from "@tabler/icons-react"
import { AttendanceTypeBadge, LeaveTypeBadge, RequestStatusBadge } from "@/components/attendance-badge"
import { DataTablePagination } from "@/components/data-table-pagination"
import { EmployeeCell } from "@/components/employee-cell"
import { ReviewDialog } from "@/components/request-dialogs"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCancelRequest, useRequests, type RequestFilters, type RequestKind } from "@/hooks/queries"
import { PAGE_LIMITS, useSearchInput, useUrlFilters } from "@/hooks/use-url-filters"
import { getErrorMessage } from "@/lib/api"
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format"
import type { CorrectionRequest, LeaveRequest, RequestStatus } from "@/types"

type Item = LeaveRequest | CorrectionRequest
type ReviewTarget = { id: number; decision: "APPROVED" | "REJECTED"; title: string; summary: string }

const STATUS_OPTIONS: { value: RequestStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua status" },
  { value: "PENDING", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "CANCELLED", label: "Dibatalkan" },
]

const STATUS_RULES = { limit: PAGE_LIMITS, status: STATUS_OPTIONS.map((o) => o.value) }

const leaveRange = (l: LeaveRequest) => (l.startDate === l.endDate ? fmtDate(l.startDate) : `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`)
const leaveDays = (l: LeaveRequest) => differenceInCalendarDays(parseISO(l.endDate), parseISO(l.startDate)) + 1

/** Ringkasan satu baris untuk dialog konfirmasi */
function describe(kind: RequestKind, it: Item) {
  if (kind === "leave") {
    const l = it as LeaveRequest
    return `${{ CUTI: "Cuti", IZIN: "Izin", SAKIT: "Sakit" }[l.type]} ${leaveRange(l)} (${leaveDays(l)} hari)`
  }
  const c = it as CorrectionRequest
  return `${c.type === "CHECK_IN" ? "Check-in" : "Check-out"} ${fmtDate(c.attendanceDate)} pukul ${c.requestedTime}`
}

/**
 * Tabel pengajuan (cuti/izin/sakit atau koreksi absen) dengan filter status & paginasi.
 * scope "me": pengajuan sendiri + tombol batalkan. scope "all": semua karyawan (HRD) + setujui/tolak.
 */
export function RequestsPanel({ kind, scope, defaultStatus = "all", toolbar }: {
  kind: RequestKind
  scope: "me" | "all"
  defaultStatus?: RequestStatus | "all"
  toolbar?: ReactNode
}) {
  const isHr = scope === "all"
  const defaults = useMemo<RequestFilters>(() => ({ page: 1, limit: 10, status: defaultStatus, search: undefined }), [defaultStatus])
  const [filters, patch] = useUrlFilters(defaults, STATUS_RULES)
  const [search, setSearch] = useSearchInput(filters.search, (s) => patch({ search: s, page: 1 }))
  const q = useRequests(kind, scope, filters)
  const cancel = useCancelRequest(kind)
  const [confirmCancel, setConfirmCancel] = useState<Item | null>(null)
  const [review, setReview] = useState<ReviewTarget | null>(null)

  const doCancel = async (it: Item) => {
    try {
      await cancel.mutateAsync(it.id)
      toast.success("Pengajuan dibatalkan")
    } catch (e) {
      toast.error("Gagal membatalkan", { description: getErrorMessage(e) })
    } finally {
      setConfirmCancel(null)
    }
  }

  const headers = [
    ...(isHr ? ["Karyawan"] : []),
    ...(kind === "leave" ? ["Jenis", "Tanggal"] : ["Tanggal", "Tipe", "Jam"]),
    "Alasan", "Status", "",
  ]
  const cols = headers.length

  return (
    <>
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        {isHr && (
          <div className="relative sm:w-64">
            <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / kode / jabatan…" className="pl-8" />
          </div>
        )}
        <Select value={filters.status ?? "all"} onValueChange={(v) => patch({ status: v as RequestStatus | "all", page: 1 })}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {toolbar && <div className="sm:ml-auto">{toolbar}</div>}
      </div>
      <div className="border-y">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              <TableSkeletonRows cols={cols} />
            ) : q.isError ? (
              <TableMessage cols={cols} error title="Gagal memuat data" onRetry={() => q.refetch()} />
            ) : q.data?.data.length === 0 ? (
              <TableMessage cols={cols} title="Belum ada pengajuan" description={filters.status && filters.status !== "all" ? "Coba ubah filter status." : undefined} />
            ) : (
              q.data?.data.map((it) => {
                const title = it.employee?.fullName ?? "Pengajuan"
                return (
                  <TableRow key={it.id}>
                    {isHr && (
                      <TableCell>
                        <EmployeeCell name={it.employee?.fullName ?? "(karyawan dihapus)"} subtitle={it.employee ? `${it.employee.employeeCode} · ${it.employee.department}` : undefined} />
                      </TableCell>
                    )}
                    {kind === "leave" ? (
                      <>
                        <TableCell><LeaveTypeBadge type={(it as LeaveRequest).type} /></TableCell>
                        <TableCell className="whitespace-nowrap">
                          <p className="font-medium">{leaveRange(it as LeaveRequest)}</p>
                          <p className="text-muted-foreground text-xs">{leaveDays(it as LeaveRequest)} hari kalender</p>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium whitespace-nowrap">{fmtDate((it as CorrectionRequest).attendanceDate)}</TableCell>
                        <TableCell><AttendanceTypeBadge type={(it as CorrectionRequest).type} /></TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          <span className="text-muted-foreground">
                            {(it as CorrectionRequest).originalRecordedAt ? fmtTime((it as CorrectionRequest).originalRecordedAt!) : "—"}
                          </span>
                          {" → "}
                          <span className="font-medium">{(it as CorrectionRequest).requestedTime}</span>
                        </TableCell>
                      </>
                    )}
                    <TableCell className="max-w-64">
                      <p className="truncate text-sm" title={it.reason}>{it.reason}</p>
                      <p className="text-muted-foreground text-xs whitespace-nowrap">Diajukan {fmtDateTime(it.createdAt)}</p>
                    </TableCell>
                    <TableCell className="max-w-56">
                      <div className="flex flex-col items-start gap-1">
                        <RequestStatusBadge status={it.status} />
                        {it.reviewNote && <span className="text-muted-foreground truncate text-xs" title={it.reviewNote}>{it.reviewNote}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {it.status === "PENDING" && !isHr && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(it)}>Batalkan</Button>
                      )}
                      {it.status === "PENDING" && isHr && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setReview({ id: it.id, decision: "REJECTED", title, summary: describe(kind, it) })}>
                            <IconX /> Tolak
                          </Button>
                          <Button size="sm" onClick={() => setReview({ id: it.id, decision: "APPROVED", title, summary: describe(kind, it) })}>
                            <IconCheck /> Setujui
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination className="px-5 py-3" meta={q.data?.meta} onPageChange={(page) => patch({ page })} onLimitChange={(limit) => patch({ limit, page: 1 })} />

      <ReviewDialog kind={kind} target={review} onOpenChange={(o) => !o && setReview(null)} />
      <AlertDialog open={!!confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan pengajuan?</AlertDialogTitle>
            <AlertDialogDescription>{confirmCancel && describe(kind, confirmCancel)}. Pengajuan yang dibatalkan tidak bisa diaktifkan lagi.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirmCancel) doCancel(confirmCancel) }} disabled={cancel.isPending}>
              Batalkan pengajuan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
