import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { IconChevronLeft, IconChevronRight, IconEye, IconEyeOff, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react"
import { FormField } from "@/components/form-field"
import { PageHeader } from "@/components/page-header"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCreateHoliday, useDeleteHoliday, useHolidays, useRestoreHoliday, useSyncHolidays } from "@/hooks/queries"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { getErrorMessage, getFieldErrors } from "@/lib/api"
import { fmtDateLong, fmtRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { holidaySchema, type HolidayValues } from "@/lib/schemas"
import type { Holiday } from "@/types"

const DEFAULTS: { year?: string } = { year: undefined }
const RULES = { year: /^\d{4}$/ }

const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

/** [1,2,3,4,5] -> "Senin–Jumat"; selain rentang berurutan ditulis satu per satu */
function workDaysLabel(days: number[]) {
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1)
  if (consecutive && days.length > 2) return `${DAY_NAMES[days[0] - 1]}–${DAY_NAMES[days[days.length - 1] - 1]}`
  return days.map((d) => DAY_NAMES[d - 1]).join(", ")
}

/** HRD: kelola hari libur nasional / perusahaan yang dikecualikan dari hari kerja */
export default function HolidaysPage() {
  const [filters, patch] = useUrlFilters(DEFAULTS, RULES)
  const year = filters.year ? Number(filters.year) : undefined
  const setYear = (n: number) => patch({ year: String(n) })
  const q = useHolidays(year)
  const create = useCreateHoliday()
  const remove = useDeleteHoliday()
  const restore = useRestoreHoliday()
  const sync = useSyncHolidays()
  const [confirm, setConfirm] = useState<Holiday | null>(null)
  const form = useForm<HolidayValues>({ resolver: zodResolver(holidaySchema), defaultValues: { date: "", name: "" } })
  const y = q.data?.year

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync(v)
      toast.success("Hari libur ditambahkan", { description: `${fmtDateLong(v.date)} · ${v.name}` })
      form.reset({ date: "", name: "" })
      const added = Number(v.date.slice(0, 4))
      if (added !== y) setYear(added)
    } catch (e) {
      Object.entries(getFieldErrors(e)).forEach(([k, m]) => form.setError(k as keyof HolidayValues, { message: m }))
      const msg = getErrorMessage(e)
      if (/tanggal/i.test(msg)) form.setError("date", { message: msg })
      toast.error("Gagal menambahkan", { description: msg })
    }
  })

  const doSync = async () => {
    try {
      const r = await sync.mutateAsync()
      toast.success("Sinkron selesai", { description: `${r.added} baru, ${r.updated} diperbarui, ${r.removed} dihapus · tahun ${r.years.join(", ")}` })
    } catch (e) {
      toast.error("Sinkron gagal", { description: getErrorMessage(e) })
    }
  }

  const doRestore = async (h: Holiday) => {
    try {
      await restore.mutateAsync(h.id)
      toast.success("Hari libur ditampilkan lagi", { description: h.name })
    } catch (e) {
      toast.error("Gagal menampilkan", { description: getErrorMessage(e) })
    }
  }

  const doRemove = async (h: Holiday) => {
    try {
      const res = await remove.mutateAsync(h.id)
      toast.success(res.hidden ? "Hari libur disembunyikan" : "Hari libur dihapus", { description: h.name })
    } catch (e) {
      toast.error("Gagal menghapus", { description: getErrorMessage(e) })
    } finally {
      setConfirm(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Hari Libur"
        description={
          q.data ? (
            <>
              <p>Hari kerja mingguan: {workDaysLabel(q.data.workDays)} (diatur lewat WORK_DAYS di server). Tanggal di sini tidak dihitung sebagai hari kerja.</p>
              <p className="mt-1">
                {!q.data.sync.enabled
                  ? "Sinkron otomatis nonaktif (HOLIDAY_SYNC_URL kosong)."
                  : !q.data.sync.last
                    ? "Libur nasional & cuti bersama disinkronkan otomatis tiap 24 jam."
                    : q.data.sync.last.ok
                      ? `Libur nasional & cuti bersama disinkronkan otomatis, terakhir ${fmtRelative(q.data.sync.last.at)}.`
                      : <span className="text-destructive">Sinkron terakhir gagal ({fmtRelative(q.data.sync.last.at)}): {q.data.sync.last.message}</span>}
              </p>
            </>
          ) : "Memuat data…"
        }
        actions={
          <>
          {q.data?.sync.enabled && (
            <Button variant="outline" onClick={doSync} disabled={sync.isPending}>
              {sync.isPending ? <Spinner /> : <IconRefresh />} Sinkronkan sekarang
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Tahun sebelumnya" disabled={!y} onClick={() => y && setYear(y - 1)}><IconChevronLeft /></Button>
            <span className="min-w-14 text-center text-sm font-medium tabular-nums">{y ?? "…"}</span>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Tahun berikutnya" disabled={!y} onClick={() => y && setYear(y + 1)}><IconChevronRight /></Button>
          </div>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={4} />
                ) : q.isError ? (
                  <TableMessage cols={4} error title="Gagal memuat data" onRetry={() => q.refetch()} />
                ) : q.data?.data.length === 0 ? (
                  <TableMessage cols={4} title={`Belum ada hari libur ${y ?? ""}`} description={q.data?.sync.enabled ? "Sumber online belum punya data tahun ini. Tambahkan manual lewat form di samping." : "Tambahkan libur nasional dan cuti bersama lewat form di samping."} />
                ) : (
                  q.data?.data.map((h) => (
                    <TableRow key={h.id} className={cn(!h.isActive && "text-muted-foreground")}>
                      <TableCell className={cn("font-medium whitespace-nowrap", !h.isActive && "line-through")}>{fmtDateLong(h.date)}</TableCell>
                      <TableCell>
                        {h.name}
                        {!h.isActive && <span className="ml-2 text-xs">(disembunyikan, dihitung hari kerja)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{h.source === "SYNC" ? "Otomatis" : "Manual"}</TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {h.source === "MANUAL" ? (
                              <Button variant="ghost" size="icon" aria-label={`Hapus ${h.name}`} onClick={() => setConfirm(h)}><IconTrash /></Button>
                            ) : h.isActive ? (
                              <Button variant="ghost" size="icon" aria-label={`Sembunyikan ${h.name}`} onClick={() => setConfirm(h)}><IconEyeOff /></Button>
                            ) : (
                              <Button variant="ghost" size="icon" aria-label={`Tampilkan ${h.name}`} disabled={restore.isPending} onClick={() => doRestore(h)}><IconEye /></Button>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>{h.source === "MANUAL" ? "Hapus" : h.isActive ? "Sembunyikan (jadi hari kerja)" : "Tampilkan lagi"}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tambah hari libur</CardTitle>
            <CardDescription>Untuk libur perusahaan atau tanggal yang belum ada di sumber online. Rekap & dashboard langsung mengikuti.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <FormField control={form.control} name="date" label="Tanggal">{(f) => <Input {...f} type="date" />}</FormField>
              <FormField control={form.control} name="name" label="Keterangan">{(f) => <Input {...f} placeholder="Hari Raya Natal" maxLength={120} />}</FormField>
              <Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? <Spinner /> : <IconPlus />} Tambah</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.source === "SYNC" ? "Sembunyikan hari libur?" : "Hapus hari libur?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && `${fmtDateLong(confirm.date)} (${confirm.name}) akan kembali dihitung sebagai hari kerja bila jatuh di hari kerja mingguan.`}
              {confirm?.source === "SYNC" && " Libur ini berasal dari sinkron otomatis, jadi hanya disembunyikan dan bisa ditampilkan lagi kapan saja."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirm) doRemove(confirm) }} disabled={remove.isPending}>{confirm?.source === "SYNC" ? "Sembunyikan" : "Hapus"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
