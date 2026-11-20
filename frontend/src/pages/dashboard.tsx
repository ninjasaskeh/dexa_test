import { Link } from "react-router"
import { IconArrowRight, IconCalendarOff, IconChecks } from "@tabler/icons-react"
import { AttendanceChart } from "@/components/blocks/attendance-chart"
import { AttendanceTypeBadge, LeaveTypeBadge, PunctualityBadge } from "@/components/attendance-badge"
import { EmployeeCell } from "@/components/employee-cell"
import { PageHeader } from "@/components/page-header"
import { PhotoThumb } from "@/components/photo-preview-dialog"
import { Progress } from "@/components/progress"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAllAttendance, useAttendanceSummary } from "@/hooks/queries"
import { fmtDateLong, fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AttendanceSummary } from "@/types"

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

/** Satu baris angka utama: hadir, tepat waktu, terlambat, belum check-in */
function KpiStrip({ s }: { s?: AttendanceSummary }) {
  const items = [
    { label: "Hadir", value: s?.presentToday, hint: s ? `dari ${s.activeEmployees} karyawan aktif` : "", bar: s ? pct(s.presentToday, s.activeEmployees) : 0 },
    { label: "Tepat waktu", value: s?.onTimeToday, hint: s ? `${pct(s.onTimeToday, s.presentToday)}% dari yang hadir` : "" },
    { label: "Terlambat", value: s?.lateToday, hint: s ? `check-in setelah ${s.workStartTime}` : "", tone: "warning" as const },
    {
      label: "Belum check-in",
      value: s?.notCheckedIn.length,
      hint: s ? (s.isWorkDay ? `${s.onLeave.length} cuti/izin/sakit · batas absen ${s.checkOutMaxTime}` : "bukan hari kerja") : "",
      tone: "primary" as const,
    },
  ]
  return (
    <Card className="py-0">
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <div key={it.label} className={cn("space-y-1.5 p-5", i % 2 === 1 && "border-l", i >= 2 && "border-t lg:border-t-0", i === 2 && "lg:border-l")}>
            <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
              {it.tone && <span className={cn("size-1.5 rounded-full", it.tone === "warning" ? "bg-warning" : "bg-primary")} />}
              {it.label}
            </dt>
            <dd className="text-3xl font-semibold tabular-nums">{s ? it.value : <Skeleton className="h-9 w-14" />}</dd>
            <dd className="text-muted-foreground text-xs">{it.hint}</dd>
            {it.bar !== undefined && s && <Progress value={it.bar} className="mt-2" />}
          </div>
        ))}
      </dl>
    </Card>
  )
}

/** Daftar karyawan aktif yang belum check-in hari ini, plus yang sedang cuti/izin/sakit */
function NotCheckedInCard({ s, loading }: { s?: AttendanceSummary; loading: boolean }) {
  const list = s?.notCheckedIn ?? []
  const onLeave = s?.onLeave ?? []
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Belum check-in</CardTitle>
        <CardDescription>{s ? (s.isWorkDay ? `${list.length} karyawan` : s.holidayName ?? "Akhir pekan") : "Memuat…"}</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {loading ? (
          <div className="space-y-2 px-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : s && !s.isWorkDay ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <IconCalendarOff className="text-muted-foreground size-6" />
            <p className="text-sm font-medium">Hari ini bukan hari kerja</p>
            <p className="text-muted-foreground text-xs">{s.holidayName ? `Libur: ${s.holidayName}` : "Karyawan tidak wajib absen."}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <IconChecks className="text-success size-6" />
            <p className="text-sm font-medium">Semua karyawan aktif sudah check-in</p>
          </div>
        ) : (
          <ul className="max-h-[248px] overflow-y-auto">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/60">
                <EmployeeCell name={e.fullName} subtitle={`${e.position} · ${e.department}`} />
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{e.nip}</span>
              </li>
            ))}
          </ul>
        )}
        {onLeave.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground px-3 pb-1 text-xs font-medium">Cuti / izin / sakit hari ini</p>
            <ul>
              {onLeave.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 rounded-md px-3 py-2">
                  <EmployeeCell name={e.fullName} subtitle={e.department} />
                  <LeaveTypeBadge type={e.leaveType} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Kehadiran per departemen hari ini */
function DepartmentsCard({ s }: { s?: AttendanceSummary }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Per departemen</CardTitle>
        <CardDescription>Kehadiran dibandingkan jumlah karyawan aktif</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!s && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-8" />)}
        {s?.departments.map((d) => (
          <div key={d.department} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{d.department}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                <span className="text-foreground font-medium">{d.present}</span> / {d.total}
              </span>
            </div>
            <Progress value={pct(d.present, d.total)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const summary = useAttendanceSummary()
  const s = summary.data
  // tanggal "hari ini" mengikuti jam server, bukan jam browser
  const today = s?.date
  const latest = useAllAttendance({ page: 1, limit: 8, from: today, to: today }, { enabled: !!today })

  return (
    <>
      <PageHeader
        title="Kehadiran hari ini"
        description={s ? `${fmtDateLong(s.date)} · ${s.isWorkDay ? `Jam masuk ${s.workStartTime}` : s.holidayName ? `Hari libur: ${s.holidayName}` : "Bukan hari kerja"}` : "Memuat data…"}
        actions={
          <Button variant="outline" asChild>
            <Link to="/monitoring">Monitoring absensi <IconArrowRight /></Link>
          </Button>
        }
      />

      <KpiStrip s={s} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <AttendanceChart data={s?.trend} loading={summary.isLoading} />
        <NotCheckedInCard s={s} loading={summary.isLoading} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Aktivitas hari ini</CardTitle>
            <CardDescription>Absensi terbaru hari ini</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/monitoring">Lihat semua</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-2">
            {(!today || latest.isLoading) && <div className="space-y-2 px-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>}
            {latest.data?.data.length === 0 && <p className="text-muted-foreground px-3 py-10 text-center text-sm">Belum ada absen hari ini.</p>}
            <ul>
              {latest.data?.data.map((a) => (
                <li key={a.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/60">
                  <span className="text-sm font-medium tabular-nums">{fmtTime(a.recordedAt)}</span>
                  <EmployeeCell name={a.employee?.fullName ?? "-"} subtitle={a.employee?.department} />
                  <div className="hidden items-center gap-1.5 sm:flex">
                    <AttendanceTypeBadge type={a.type} />
                    {a.type === "CHECK_IN" && <PunctualityBadge late={a.isLate} />}
                  </div>
                  <PhotoThumb attendance={a} title={a.employee?.fullName} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <DepartmentsCard s={s} />
      </div>
    </>
  )
}
