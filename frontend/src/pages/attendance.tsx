import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Link } from "react-router"
import { toast } from "sonner"
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { IconArrowRight, IconCheck, IconLock, IconLogin2, IconLogout2 } from "@tabler/icons-react"

import { useAuth } from "@/components/auth-provider"
import { LEAVE_LABEL, PunctualityBadge } from "@/components/attendance-badge"
import { FormField } from "@/components/form-field"
import { LiveClock } from "@/components/live-clock"
import { PhotoCapture } from "@/components/photo-capture"
import { PhotoThumb } from "@/components/photo-preview-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useMyAttendance, useSubmitAttendance, useTodayAttendance } from "@/hooks/queries"
import { hhmmToMinutes, useServerClock } from "@/hooks/use-server-clock"
import { getErrorMessage, getFieldErrors } from "@/lib/api"
import { fmtTime, toISODate, workDuration } from "@/lib/format"
import { attendanceSchema, type AttendanceValues } from "@/lib/schemas"
import { cn } from "@/lib/utils"
import type { Attendance, TodayAttendance } from "@/types"

type Step = "CHECK_IN" | "CHECK_OUT"

/** "2j 15m" dari selisih menit */
const fmtMinutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`)

/** Kalimat status yang menjelaskan apa yang harus dilakukan sekarang (dihitung dari jam server) */
function StatusLine({ t }: { t: TodayAttendance }) {
  const now = useServerClock(t.clockOffset)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const start = hhmmToMinutes(t.workStartTime)

  let text: string
  if (t.leave && !t.checkIn) text = `Anda tercatat ${LEAVE_LABEL[t.leave.type].toLowerCase()} hari ini (sudah disetujui HRD), jadi tidak perlu absen.`
  else if (!t.isWorkDay && !t.checkIn) text = `Hari ini ${t.holidayName ? `libur: ${t.holidayName}` : "bukan hari kerja"}. Absen tetap bisa dilakukan bila Anda bekerja.`
  else if (t.checkIn && t.checkOut) text = `Selesai. Total ${workDuration(t.checkIn.recordedAt, t.checkOut.recordedAt)} kerja hari ini.`
  else if (t.closed) text = `Absensi hari ini sudah ditutup pukul ${t.checkOutMaxTime}.`
  else if (t.checkIn) {
    const worked = Math.max(0, Math.round((now.getTime() - parseISO(t.checkIn.recordedAt).getTime()) / 60000))
    text = `Masuk pukul ${fmtTime(t.checkIn.recordedAt)}, sudah ${fmtMinutes(worked)} bekerja. Check-out paling lambat ${t.checkOutMaxTime}.`
  } else if (nowMin <= start) text = `Jam masuk ${t.workStartTime}, ${fmtMinutes(start - nowMin)} lagi.`
  else text = `Sudah lewat jam masuk ${t.workStartTime}. Check-in sekarang tercatat terlambat.`

  return <p className="text-muted-foreground max-w-md text-sm leading-relaxed">{text}</p>
}

/** Langkah check-in → check-out dengan jam yang tercatat */
function Stepper({ t }: { t: TodayAttendance }) {
  const steps: { label: string; record: Attendance | null }[] = [
    { label: "Check-in", record: t.checkIn },
    { label: "Check-out", record: t.checkOut },
  ]
  const current = !t.checkIn ? 0 : !t.checkOut ? 1 : 2
  return (
    <ol className="grid grid-cols-2 gap-2 sm:min-w-80">
      {steps.map((s, i) => {
        const done = !!s.record
        const active = i === current && !t.closed
        return (
          <li
            key={s.label}
            className={cn(
              "rounded-lg border px-3 py-2.5",
              done ? "bg-card" : active ? "border-primary/40 bg-primary/5" : "bg-muted/40 border-dashed",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs font-medium">{s.label}</span>
              {done ? (
                <span className="bg-success/15 text-success flex size-4 items-center justify-center rounded-full"><IconCheck className="size-3" strokeWidth={3} /></span>
              ) : active ? (
                <span className="bg-primary size-2 animate-pulse rounded-full" />
              ) : null}
            </div>
            <p className={cn("mt-1 text-xl font-semibold tabular-nums", !done && "text-muted-foreground/60")}>
              {s.record ? fmtTime(s.record.recordedAt) : "--:--"}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

/** Rekap minggu berjalan (Sen–Min): jam masuk, pulang, durasi per hari */
function WeekCard({ today }: { today: string }) {
  const base = parseISO(today)
  const monday = startOfWeek(base, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const q = useMyAttendance({ page: 1, limit: 14, from: toISODate(days[0]), to: toISODate(days[6]) })
  const byDay = new Map<string, { in?: Attendance; out?: Attendance }>()
  for (const a of q.data?.data ?? []) {
    const d = byDay.get(a.attendanceDate) ?? {}
    if (a.type === "CHECK_IN") d.in = a
    else d.out = a
    byDay.set(a.attendanceDate, d)
  }
  const present = [...byDay.values()].filter((d) => d.in).length

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Minggu ini</CardTitle>
        <CardDescription>{present} hari hadir · {format(days[0], "d MMM", { locale: localeId })} – {format(days[6], "d MMM", { locale: localeId })}</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        {q.isLoading ? (
          <div className="space-y-2 px-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <ul className="text-sm">
            <li aria-hidden className="text-muted-foreground grid grid-cols-[3.5rem_1fr_1fr_4rem] gap-2 px-3 pb-1 text-xs">
              <span>Hari</span><span>Masuk</span><span>Pulang</span><span className="text-right">Durasi</span>
            </li>
            {days.map((d) => {
              const key = toISODate(d)
              const rec = byDay.get(key)
              const isToday = isSameDay(d, base)
              const future = d > base
              const weekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <li key={key} className={cn("grid grid-cols-[3.5rem_1fr_1fr_4rem] items-center gap-2 rounded-md px-3 py-2", isToday && "bg-muted")}>
                  <span className={cn("font-medium", (future || weekend) && !rec && "text-muted-foreground")}>
                    {format(d, "EEE", { locale: localeId })} <span className="text-muted-foreground font-normal tabular-nums">{format(d, "d")}</span>
                  </span>
                  <span className={cn("tabular-nums", rec?.in?.isLate && "text-warning-foreground font-medium")}>
                    {rec?.in ? fmtTime(rec.in.recordedAt) : <span className="text-muted-foreground/50">—</span>}
                  </span>
                  <span className="tabular-nums">{rec?.out ? fmtTime(rec.out.recordedAt) : <span className="text-muted-foreground/50">—</span>}</span>
                  <span className="text-muted-foreground text-right text-xs tabular-nums">
                    {rec?.in && rec.out ? workDuration(rec.in.recordedAt, rec.out.recordedAt) : ""}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-muted-foreground mt-2 px-3 text-xs">Jam masuk berwarna oranye = terlambat.</p>
      </CardContent>
      <CardFooter>
        <Button variant="link" className="h-auto px-0" asChild>
          <Link to="/riwayat">Semua riwayat <IconArrowRight /></Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

/** Ringkasan saat check-in & check-out hari ini sudah lengkap */
function DoneCard({ t }: { t: TodayAttendance }) {
  const items = [t.checkIn, t.checkOut].filter(Boolean) as Attendance[]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Absensi hari ini lengkap</CardTitle>
        <CardDescription>Terima kasih. Data Anda sudah diterima HRD.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
            <PhotoThumb attendance={a} title={a.type === "CHECK_IN" ? "Check-in" : "Check-out"} size="lg" />
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{a.type === "CHECK_IN" ? "Check-in" : "Check-out"}</p>
              <p className="text-lg font-semibold tabular-nums">{fmtTime(a.recordedAt)}</p>
              {a.type === "CHECK_IN" && <PunctualityBadge late={a.isLate} />}
              {a.notes && <p className="text-muted-foreground mt-1 truncate text-xs">{a.notes}</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** Form foto + catatan untuk langkah yang sedang berjalan */
function CaptureCard({ step, t }: { step: Step; t: TodayAttendance }) {
  const submit = useSubmitAttendance()
  const now = useServerClock(t.clockOffset)
  const form = useForm<AttendanceValues>({ resolver: zodResolver(attendanceSchema), defaultValues: { notes: "" } })
  const isIn = step === "CHECK_IN"

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const res = await submit.mutateAsync({ type: step, photo: v.photo, notes: v.notes?.trim() || undefined })
      form.reset({ notes: "" })
      toast.success(isIn ? "Check-in tercatat" : "Check-out tercatat", {
        description: `Pukul ${fmtTime(res.recordedAt)}${res.isLate ? " · terlambat" : ""}`,
      })
    } catch (e) {
      const fe = getFieldErrors(e)
      if (fe.photo) form.setError("photo", { message: fe.photo })
      toast.error("Absen gagal", { description: getErrorMessage(e) })
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isIn ? "Foto check-in" : "Foto check-out"}</CardTitle>
        <CardDescription>Ambil foto di tempat Anda bekerja hari ini. Jam dicatat oleh server saat dikirim.</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="attendance-form" onSubmit={onSubmit} className="space-y-4">
          <Controller
            control={form.control}
            name="photo"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <PhotoCapture value={field.value ?? null} onChange={(f) => field.onChange(f ?? undefined)} invalid={fieldState.invalid} disabled={submit.isPending} />
                {fieldState.error && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <FormField control={form.control} name="notes" label="Catatan" description="Opsional, misalnya pekerjaan utama hari ini.">
            {(field) => <Textarea {...field} value={field.value ?? ""} placeholder="Menyusun laporan stok bulanan" rows={2} maxLength={255} />}
          </FormField>
        </form>
      </CardContent>
      <CardFooter className="border-t">
        <Button type="submit" form="attendance-form" size="lg" className="w-full sm:w-auto" disabled={submit.isPending}>
          {submit.isPending ? <Spinner /> : isIn ? <IconLogin2 /> : <IconLogout2 />}
          {isIn ? "Kirim check-in" : "Kirim check-out"}
          <span className="tabular-nums opacity-70">· {format(now, "HH:mm")}</span>
        </Button>
      </CardFooter>
    </Card>
  )
}

export default function AttendancePage() {
  const { user } = useAuth()
  const today = useTodayAttendance()

  if (!user?.employee) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Profil karyawan belum tersedia</EmptyTitle>
          <EmptyDescription>Akun Anda belum terhubung ke data karyawan. Hubungi Admin HRD.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const t = today.data
  const pending: Step | null = !t ? null : !t.checkIn ? "CHECK_IN" : !t.checkOut ? "CHECK_OUT" : null
  const firstName = user.employee.fullName.split(" ")[0]

  return (
    <>
      {/* Kartu waktu: jam server, status, dan langkah hari ini */}
      <Card className="overflow-hidden py-0">
        <div className="flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {firstName} <span className="text-muted-foreground font-normal">· {user.employee.position}, {user.employee.department}</span>
            </p>
            {t ? <LiveClock offset={t.clockOffset} /> : <Skeleton className="h-16 w-56" />}
            {t ? <StatusLine t={t} /> : <Skeleton className="h-4 w-72" />}
          </div>
          {t ? <Stepper t={t} /> : <Skeleton className="h-20 w-80" />}
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {today.isLoading || !t ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : pending && t.closed ? (
            <Card>
              <CardContent>
                <Empty className="py-10">
                  <EmptyHeader>
                    <span className="bg-muted mb-2 flex size-10 items-center justify-center rounded-full"><IconLock className="size-5" /></span>
                    <EmptyTitle>Absensi hari ini sudah ditutup</EmptyTitle>
                    <EmptyDescription>
                      Batas absen pukul {t.checkOutMaxTime}. {pending === "CHECK_OUT" ? "Anda belum check-out hari ini." : "Anda belum check-in hari ini."} Bila tadi Anda bekerja, ajukan koreksi absen ke Admin HRD.
                    </EmptyDescription>
                  </EmptyHeader>
                  <Button variant="outline" asChild>
                    <Link to={`/pengajuan?tab=koreksi&date=${t.date}&type=${pending}`}>Ajukan koreksi <IconArrowRight /></Link>
                  </Button>
                </Empty>
              </CardContent>
            </Card>
          ) : pending ? (
            <CaptureCard key={pending} step={pending} t={t} />
          ) : (
            <DoneCard t={t} />
          )}
        </div>
        {t ? <WeekCard today={t.date} /> : <Skeleton className="h-80 w-full rounded-xl" />}
      </div>
    </>
  )
}
