import { useMemo, useState } from "react"
import { toast } from "sonner"
import { addMonths, format, parseISO } from "date-fns"
import { id } from "date-fns/locale"
import { IconChevronLeft, IconChevronRight, IconDownload, IconSearch } from "@tabler/icons-react"
import { EmployeeCell } from "@/components/employee-cell"
import { PageHeader } from "@/components/page-header"
import { Progress } from "@/components/progress"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useMonthlyRecap } from "@/hooks/queries"
import { downloadFile, getErrorMessage } from "@/lib/api"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { RecapRow } from "@/types"

const COLS = 11
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)
const monthLabel = (m: string) => format(parseISO(`${m}-01`), "MMMM yyyy", { locale: id })
const shiftMonth = (m: string, n: number) => format(addMonths(parseISO(`${m}-01`), n), "yyyy-MM")
const hours = (min: number) => `${Math.floor(min / 60)}j ${String(min % 60).padStart(2, "0")}m`

/** Angka 0 dibuat samar agar angka yang penting lebih terlihat */
function Num({ n, tone }: { n: number; tone?: "warning" | "primary" }) {
  return (
    <span className={cn("tabular-nums", n === 0 ? "text-muted-foreground/50" : tone === "warning" ? "text-warning-foreground font-medium" : tone === "primary" ? "text-primary font-semibold" : "")}>
      {n}
    </span>
  )
}

export default function RecapPage() {
  const [month, setMonth] = useState<string>()
  const q = useMonthlyRecap(month)
  const r = q.data
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("all")
  const [exporting, setExporting] = useState(false)

  const departments = useMemo(() => [...new Set(r?.data.map((d) => d.employee.department))].sort(), [r])
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (r?.data ?? [])
      .filter((d) => department === "all" || d.employee.department === department)
      .filter((d) => !s || [d.employee.fullName, d.employee.employeeCode, d.employee.position].some((v) => v.toLowerCase().includes(s)))
      .sort((a, b) => b.absent - a.absent || a.employee.fullName.localeCompare(b.employee.fullName))
  }, [r, search, department])

  const totals = rows.reduce(
    (t, d: RecapRow) => ({ workDays: t.workDays + d.workDays, present: t.present + d.present, late: t.late + d.late, absent: t.absent + d.absent }),
    { workDays: 0, present: 0, late: 0, absent: 0 },
  )
  const current = r?.today.slice(0, 7)

  const exportCsv = async () => {
    if (!r) return
    setExporting(true)
    try {
      await downloadFile("/attendance/recap/export", { month: r.month }, `rekap_absensi_${r.month}.csv`)
    } catch (e) {
      toast.error("Export gagal", { description: getErrorMessage(e) })
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Rekap Bulanan"
        description={r ? `Kehadiran karyawan aktif ${fmtDate(r.from)} – ${fmtDate(r.to)} · jam masuk ${r.workStartTime}` : "Memuat data…"}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button variant="ghost" size="icon" className="size-8" aria-label="Bulan sebelumnya" disabled={!r} onClick={() => r && setMonth(shiftMonth(r.month, -1))}>
                <IconChevronLeft />
              </Button>
              <span className="min-w-32 text-center text-sm font-medium capitalize">{r ? monthLabel(r.month) : "…"}</span>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Bulan berikutnya" disabled={!r || r.month === current} onClick={() => r && setMonth(shiftMonth(r.month, 1))}>
                <IconChevronRight />
              </Button>
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!r || exporting}>
              {exporting ? <Spinner /> : <IconDownload />} Export CSV
            </Button>
          </>
        }
      />

      <Card className="py-0">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Hari kerja", value: r?.workDays, hint: r ? (r.holidays.length ? `${r.holidays.length} tanggal libur nasional / cuti bersama` : "tanpa libur nasional") : "" },
            { label: "Kehadiran rata-rata", value: r ? `${pct(totals.present, totals.workDays)}%` : undefined, hint: `${totals.present} dari ${totals.workDays} hari-orang`, bar: pct(totals.present, totals.workDays) },
            { label: "Terlambat", value: totals.late, hint: "total check-in terlambat", tone: "warning" as const },
            { label: "Alpa", value: totals.absent, hint: "hari kerja tanpa absen & tanpa cuti", tone: "primary" as const },
          ].map((it, i) => (
            <div key={it.label} className={cn("space-y-1.5 p-5", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i === 2 && "lg:border-l")}>
              <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
                {it.tone && <span className={cn("size-1.5 rounded-full", it.tone === "warning" ? "bg-warning" : "bg-primary")} />}
                {it.label}
              </dt>
              <dd className="text-3xl font-semibold tabular-nums">{r ? it.value : <Skeleton className="h-9 w-14" />}</dd>
              <dd className="text-muted-foreground text-xs">{it.hint}</dd>
              {it.bar !== undefined && r && <Progress value={it.bar} className="mt-2" />}
            </div>
          ))}
        </dl>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative sm:w-64">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / kode / jabatan…" className="pl-8" />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua departemen</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {r && r.holidays.length > 0 && (
              <p className="text-muted-foreground text-xs sm:ml-auto">
                Libur: {r.holidays.map((h) => `${format(parseISO(h.date), "d MMM", { locale: id })} (${h.name})`).join(", ")}
              </p>
            )}
          </div>
          <div className="border-y">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead className="text-right">Hari kerja</TableHead>
                  <TableHead className="text-right">Hadir</TableHead>
                  <TableHead className="text-right">Terlambat</TableHead>
                  <TableHead className="text-right">Tanpa check-out</TableHead>
                  <TableHead className="text-right">Cuti</TableHead>
                  <TableHead className="text-right">Izin</TableHead>
                  <TableHead className="text-right">Sakit</TableHead>
                  <TableHead className="text-right">Alpa</TableHead>
                  <TableHead className="text-right">Jam kerja</TableHead>
                  <TableHead className="w-32">Kehadiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={COLS} />
                ) : q.isError ? (
                  <TableMessage cols={COLS} error title="Gagal memuat rekap" description={getErrorMessage(q.error)} onRetry={() => q.refetch()} />
                ) : rows.length === 0 ? (
                  <TableMessage cols={COLS} title="Tidak ada karyawan" description="Coba ubah kata kunci atau departemen." />
                ) : (
                  rows.map((d) => (
                    <TableRow key={d.employee.id}>
                      <TableCell><EmployeeCell name={d.employee.fullName} subtitle={`${d.employee.employeeCode} · ${d.employee.department}`} /></TableCell>
                      <TableCell className="text-right"><Num n={d.workDays} /></TableCell>
                      <TableCell className="text-right"><Num n={d.present} /></TableCell>
                      <TableCell className="text-right"><Num n={d.late} tone="warning" /></TableCell>
                      <TableCell className="text-right"><Num n={d.noCheckOut} tone="warning" /></TableCell>
                      <TableCell className="text-right"><Num n={d.leave.CUTI} /></TableCell>
                      <TableCell className="text-right"><Num n={d.leave.IZIN} /></TableCell>
                      <TableCell className="text-right"><Num n={d.leave.SAKIT} /></TableCell>
                      <TableCell className="text-right"><Num n={d.absent} tone="primary" /></TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap tabular-nums">{d.workMinutes ? hours(d.workMinutes) : <span className="text-muted-foreground/50">—</span>}</TableCell>
                      <TableCell>
                        {d.workDays ? (
                          <div className="flex items-center gap-2">
                            <Progress value={pct(d.present, d.workDays)} className="w-16" />
                            <span className="text-muted-foreground text-xs tabular-nums">{pct(d.present, d.workDays)}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                        {d.extraDays > 0 && <p className="text-muted-foreground mt-1 text-xs">+{d.extraDays} hari libur</p>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground px-5 py-3 text-xs leading-relaxed">
            Hari kerja dihitung sejak tanggal bergabung, sampai hari ini menurut jam server. Hari ini baru dihitung setelah karyawan check-in atau bila sedang cuti.
            Alpa = hari kerja tanpa check-in dan tanpa cuti/izin/sakit yang disetujui.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
