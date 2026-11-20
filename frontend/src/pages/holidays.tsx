import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import {
  IconCalendarMonth, IconChevronLeft, IconChevronRight, IconEye, IconEyeOff, IconLayoutGrid, IconPlus, IconRefresh, IconTrash,
} from "@tabler/icons-react"
import { DatePicker } from "@/components/date-picker"
import { FormField } from "@/components/form-field"
import { HolidayLegend, HolidayList, KindDot, MonthCalendar, MonthView } from "@/components/holiday-calendar"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCreateHoliday, useDeleteHoliday, useHolidays, useRestoreHoliday, useSyncHolidays } from "@/hooks/queries"
import { MONTH_RE, useUrlFilters } from "@/hooks/use-url-filters"
import { getErrorMessage, getFieldErrors } from "@/lib/api"
import { KIND_LABEL, holidayKind, isoWeekday, monthDates, shiftMonth, summarize } from "@/lib/holidays"
import { fmtDateLong, fmtRelative } from "@/lib/format"
import { holidaySchema, type HolidayValues } from "@/lib/schemas"
import type { Holiday } from "@/types"


/** `?view=year&year=2027` untuk setahun, `?month=2026-12` untuk satu bulan (default: bulan ini) */
const DEFAULTS: { view: string; month?: string; year?: string } = { view: "month", month: undefined, year: undefined }
const RULES = { view: ["month", "year"], month: MONTH_RE, year: /^\d{4}$/ }

const monthTitle = (ym: string) => format(new Date(`${ym}-01T00:00:00`), "MMMM yyyy", { locale: id })
const daysUntil = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

/** HRD: kalender hari libur nasional, cuti bersama, dan libur perusahaan (tampilan bulan atau setahun) */
export default function HolidaysPage() {
  const [filters, patch] = useUrlFilters(DEFAULTS, RULES)
  const isYear = filters.view === "year"
  // tahun yang diminta ke server: dari ?year (tampilan tahun) atau dari ?month; kosong = tahun berjalan
  const requested = isYear ? filters.year : filters.month?.slice(0, 4)
  const q = useHolidays(requested ? Number(requested) : undefined)
  const sync = useSyncHolidays()
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const today = q.data?.today
  const currentMonth = today?.slice(0, 7)
  const month = filters.month ?? currentMonth
  const year = isYear ? q.data?.year : month ? Number(month.slice(0, 4)) : undefined
  const [mYear, mIndex] = month ? [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1] : [0, 0]
  // data tahun sebelumnya masih tampil selama tahun baru dimuat
  const ready = !!q.data && (isYear || q.data.year === mYear)

  const byDate = useMemo(() => new Map((q.data?.data ?? []).map((h) => [h.date, h])), [q.data])
  const dates = useMemo(() => {
    if (!q.data) return []
    if (isYear) return Array.from({ length: 12 }, (_, m) => monthDates(q.data.year, m)).flat()
    return month ? monthDates(mYear, mIndex) : []
  }, [q.data, isYear, month, mYear, mIndex])
  const stats = useMemo(() => (q.data ? summarize(dates, q.data.workDays, byDate) : null), [q.data, dates, byDate])
  const monthHolidays = useMemo(() => dates.flatMap((d) => (byDate.has(d) ? [byDate.get(d)!] : [])), [dates, byDate])
  const upcoming = useMemo(
    () => (today ? (q.data?.data ?? []).filter((h) => h.isActive && h.date > today).slice(0, 3) : []),
    [q.data, today],
  )

  const goMonth = (m: string) => patch({ month: m === currentMonth ? undefined : m })
  const setView = (v: string) => {
    if (!v || v === filters.view) return
    if (v === "year") patch({ view: "year", year: year && String(year) !== currentMonth?.slice(0, 4) ? String(year) : undefined, month: undefined })
    else patch({ view: undefined, year: undefined, month: year && String(year) !== currentMonth?.slice(0, 4) ? `${year}-01` : undefined })
  }
  const openMonth = (m: number) => q.data && patch({ view: undefined, year: undefined, month: `${q.data.year}-${String(m + 1).padStart(2, "0")}` })
  const isCurrentPeriod = isYear ? year === Number(today?.slice(0, 4)) : month === currentMonth

  const doSync = async () => {
    try {
      const r = await sync.mutateAsync()
      toast.success("Sinkron selesai", { description: `${r.added} baru, ${r.updated} diperbarui, ${r.removed} dihapus · tahun ${r.years.join(", ")}` })
    } catch (e) {
      toast.error("Sinkron gagal", { description: getErrorMessage(e) })
    }
  }

  const syncInfo = q.data?.sync
  return (
    <>
      <PageHeader
        title="Hari Libur"
        description="Kalender libur nasional, cuti bersama, dan libur perusahaan yang tidak dihitung sebagai hari kerja."
        actions={
          <>
            {syncInfo?.enabled && (
              <Button variant="outline" onClick={doSync} disabled={sync.isPending}>
                {sync.isPending ? <Spinner /> : <IconRefresh />} Sinkronkan
              </Button>
            )}
            <Button onClick={() => setAdding(true)} disabled={!q.data}><IconPlus /> Tambah libur</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant="ghost" size="icon" className="size-8" disabled={!q.data}
              aria-label={isYear ? "Tahun sebelumnya" : "Bulan sebelumnya"}
              onClick={() => (isYear ? year && patch({ year: String(year - 1) }) : month && goMonth(shiftMonth(month, -1)))}
            >
              <IconChevronLeft />
            </Button>
            <span className="min-w-36 text-center text-sm font-semibold capitalize tabular-nums">
              {!q.data ? "…" : isYear ? year : month && monthTitle(month)}
            </span>
            <Button
              variant="ghost" size="icon" className="size-8" disabled={!q.data}
              aria-label={isYear ? "Tahun berikutnya" : "Bulan berikutnya"}
              onClick={() => (isYear ? year && patch({ year: String(year + 1) }) : month && goMonth(shiftMonth(month, 1)))}
            >
              <IconChevronRight />
            </Button>
          </div>
          {q.data && !isCurrentPeriod && (
            <Button variant="outline" size="sm" onClick={() => patch(isYear ? { year: undefined } : { month: undefined })}>
              {isYear ? "Tahun ini" : "Bulan ini"}
            </Button>
          )}
          {q.isFetching && q.data && <Spinner className="text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {syncInfo?.enabled && syncInfo.last && (
            <p
              className={syncInfo.last.ok ? "text-muted-foreground text-xs" : "text-destructive text-xs"}
              title={syncInfo.last.ok ? `Sumber: ${syncInfo.url}` : syncInfo.last.message ?? undefined}
            >
              {syncInfo.last.ok ? `Data libur resmi diperbarui ${fmtRelative(syncInfo.last.at)}` : `Pembaruan data libur gagal ${fmtRelative(syncInfo.last.at)}`}
            </p>
          )}
        <ToggleGroup type="single" variant="outline" value={filters.view} onValueChange={setView} aria-label="Tampilan kalender">
          <ToggleGroupItem value="month" className="gap-1.5 px-3"><IconCalendarMonth /> Bulan</ToggleGroupItem>
          <ToggleGroupItem value="year" className="gap-1.5 px-3"><IconLayoutGrid /> Setahun</ToggleGroupItem>
        </ToggleGroup>
        </div>
      </div>

      <Card className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            { label: isYear ? "Hari kerja setahun" : "Hari kerja", value: stats?.workDays },
            { label: KIND_LABEL.national, value: stats?.national, kind: "national" as const },
            { label: KIND_LABEL.leave, value: stats?.leave, kind: "leave" as const },
            { label: KIND_LABEL.company, value: stats?.company, kind: "company" as const },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <dt className="text-muted-foreground flex items-center gap-1.5">{s.kind && <KindDot kind={s.kind} />}{s.label}</dt>
              <dd className="font-semibold tabular-nums">{ready ? s.value : "–"}</dd>
            </div>
          ))}
        </dl>
        <HolidayLegend />
      </Card>

      {q.isError ? (
        <Card className="items-center gap-3 py-10 text-center">
          <p className="font-medium">Gagal memuat hari libur</p>
          <p className="text-muted-foreground text-sm">{getErrorMessage(q.error)}</p>
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>Coba lagi</Button>
        </Card>
      ) : isYear ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {q.data && today
            ? Array.from({ length: 12 }, (_, m) => (
                <MonthCalendar
                  key={m} year={q.data.year} month={m} holidays={byDate} workDays={q.data.workDays} today={today}
                  onSelect={setSelected} onOpenMonth={() => openMonth(m)}
                />
              ))
            : Array.from({ length: 12 }, (_, m) => <Skeleton key={m} className="h-72 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {ready && today ? (
            <MonthView year={mYear} month={mIndex} holidays={byDate} workDays={q.data!.workDays} today={today} onSelect={setSelected} />
          ) : (
            <Skeleton className="h-[36rem] rounded-xl" />
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Card className="gap-3 py-4">
              <CardHeader className="px-4"><CardTitle className="text-sm capitalize">Libur {month ? format(new Date(`${month}-01T00:00:00`), "MMMM", { locale: id }) : ""}</CardTitle></CardHeader>
              <CardContent className="px-2.5">
                {!ready ? (
                  <Skeleton className="mx-1.5 h-16" />
                ) : monthHolidays.length ? (
                  <HolidayList items={monthHolidays} onSelect={setSelected} />
                ) : (
                  <p className="text-muted-foreground px-1.5 text-xs">Tidak ada libur di bulan ini.</p>
                )}
              </CardContent>
            </Card>
            {upcoming.length > 0 && today && (
              <Card className="gap-3 py-4">
                <CardHeader className="px-4"><CardTitle className="text-sm">Libur berikutnya</CardTitle></CardHeader>
                <CardContent className="space-y-2 px-2.5">
                  <HolidayList items={upcoming} onSelect={(d) => { goMonth(d.slice(0, 7)); setSelected(d) }} showMonth />
                  <p className="text-muted-foreground px-1.5 text-xs">{daysUntil(today, upcoming[0].date)} hari lagi menuju {upcoming[0].name}.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {q.data && (
        <HolidayDialog
          open={!!selected || adding}
          date={selected}
          holiday={selected ? byDate.get(selected) ?? null : null}
          workDays={q.data.workDays}
          onOpenChange={(o) => {
            if (!o) {
              setSelected(null)
              setAdding(false)
            }
          }}
          onAdded={(date) => {
            if (isYear) patch({ year: date.slice(0, 4) === today?.slice(0, 4) ? undefined : date.slice(0, 4) })
            else goMonth(date.slice(0, 7))
          }}
        />
      )}
    </>
  )
}

/**
 * Detail satu tanggal. Tanggal yang sudah libur: info + sembunyikan / tampilkan / hapus.
 * Tanggal biasa (atau tombol "Tambah libur"): form tambah libur.
 */
function HolidayDialog({ open, date, holiday, workDays, onOpenChange, onAdded }: {
  open: boolean
  date: string | null
  holiday: Holiday | null
  workDays: number[]
  onOpenChange: (open: boolean) => void
  onAdded: (date: string) => void
}) {
  const create = useCreateHoliday()
  const remove = useDeleteHoliday()
  const restore = useRestoreHoliday()
  const form = useForm<HolidayValues>({ resolver: zodResolver(holidaySchema), defaultValues: { date: "", type: "HOLIDAY", name: "" } })
  useEffect(() => {
    if (open) form.reset({ date: date ?? "", type: "HOLIDAY", name: "" })
  }, [open, date, form])

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync(v)
      toast.success("Hari libur ditambahkan", { description: `${fmtDateLong(v.date)} · ${v.name}` })
      onAdded(v.date)
      onOpenChange(false)
    } catch (e) {
      Object.entries(getFieldErrors(e)).forEach(([k, m]) => form.setError(k as keyof HolidayValues, { message: m }))
      const msg = getErrorMessage(e)
      if (/tanggal/i.test(msg)) form.setError("date", { message: msg })
      toast.error("Gagal menambahkan", { description: msg })
    }
  })

  const doRemove = async (h: Holiday) => {
    try {
      const res = await remove.mutateAsync(h.id)
      toast.success(res.hidden ? "Hari libur disembunyikan" : "Hari libur dihapus", { description: h.name })
      onOpenChange(false)
    } catch (e) {
      toast.error("Gagal menghapus", { description: getErrorMessage(e) })
    }
  }

  const doRestore = async (h: Holiday) => {
    try {
      await restore.mutateAsync(h.id)
      toast.success("Hari libur ditampilkan lagi", { description: h.name })
      onOpenChange(false)
    } catch (e) {
      toast.error("Gagal menampilkan", { description: getErrorMessage(e) })
    }
  }

  const offDay = date ? !workDays.includes(isoWeekday(date)) : false
  const kind = holiday && holidayKind(holiday)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {holiday && kind ? (
          <>
            <DialogHeader>
              <DialogTitle>{holiday.name}</DialogTitle>
              <DialogDescription>{fmtDateLong(holiday.date)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-medium"><KindDot kind={kind} /> {KIND_LABEL[kind]}</p>
              <p className="text-muted-foreground">
                {holiday.source === "SYNC" ? "Bersumber dari data libur resmi pemerintah. " : "Ditambahkan oleh Admin HRD. "}
                {holiday.isActive
                  ? offDay
                    ? "Tanggal ini memang bukan hari kerja."
                    : "Tidak dihitung sebagai hari kerja; karyawan yang tidak hadir tidak tercatat alpa."
                  : "Libur ini dinonaktifkan sehingga tanggal tersebut dihitung sebagai hari kerja."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
              {holiday.source === "MANUAL" ? (
                <Button variant="destructive" onClick={() => doRemove(holiday)} disabled={remove.isPending}>
                  {remove.isPending ? <Spinner /> : <IconTrash />} Hapus
                </Button>
              ) : holiday.isActive ? (
                <Button onClick={() => doRemove(holiday)} disabled={remove.isPending}>
                  {remove.isPending ? <Spinner /> : <IconEyeOff />} Jadikan hari kerja
                </Button>
              ) : (
                <Button onClick={() => doRestore(holiday)} disabled={restore.isPending}>
                  {restore.isPending ? <Spinner /> : <IconEye />} Tampilkan lagi
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{date ? fmtDateLong(date) : "Tambah hari libur"}</DialogTitle>
              <DialogDescription>
                {date
                  ? offDay
                    ? "Tanggal ini bukan hari kerja. Libur tetap dapat ditambahkan bila diperlukan."
                    : "Tandai tanggal ini sebagai libur perusahaan atau cuti bersama."
                  : "Tambahkan libur perusahaan atau tanggal yang belum tersedia di data libur resmi."}
              </DialogDescription>
            </DialogHeader>
            <form id="holiday-form" onSubmit={onSubmit} noValidate>
              <FieldGroup className="gap-5">
                {!date && <FormField control={form.control} name="date" label="Tanggal">{(f) => <DatePicker {...f} withYearSelect />}</FormField>}
                <FormField control={form.control} name="type" label="Jenis">
                  {({ value, onChange, id }) => (
                    <Select value={value} onValueChange={onChange}>
                      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOLIDAY">Libur</SelectItem>
                        <SelectItem value="LEAVE">Cuti bersama</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField control={form.control} name="name" label="Keterangan">
                  {(f) => <Input {...f} placeholder="Ulang tahun perusahaan" maxLength={120} />}
                </FormField>
              </FieldGroup>
            </form>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" form="holiday-form" disabled={create.isPending}>{create.isPending ? <Spinner /> : <IconPlus />} Tambah libur</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
