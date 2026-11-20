import { format } from "date-fns"
import { id } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { KIND_LABEL, holidayKind, isoWeekday, monthDates, type HolidayKind } from "@/lib/holidays"
import type { Holiday } from "@/types"

const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]

/** Warna sel tanggal kecil (tampilan tahun) per kategori, token CSS saja */
const KIND_CELL: Record<HolidayKind, string> = {
  national: "bg-primary text-primary-foreground font-semibold hover:bg-primary/90",
  leave: "bg-warning/20 text-warning-foreground font-semibold hover:bg-warning/30",
  company: "bg-primary/10 text-primary font-semibold ring-1 ring-inset ring-primary/40 hover:bg-primary/15",
  hidden: "text-muted-foreground line-through border border-dashed border-muted-foreground/40 hover:bg-muted",
}

/** Label nama libur di dalam sel besar (tampilan bulan) */
const KIND_CHIP: Record<HolidayKind, string> = {
  national: "bg-primary text-primary-foreground",
  leave: "bg-warning/20 text-warning-foreground",
  company: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/40",
  hidden: "text-muted-foreground line-through border border-dashed border-muted-foreground/40",
}

const KIND_DOT: Record<HolidayKind, string> = {
  national: "bg-primary",
  leave: "bg-warning",
  company: "bg-primary/15 ring-1 ring-inset ring-primary/50",
  hidden: "border border-dashed border-muted-foreground/60",
}

const monthName = (year: number, month: number, pattern = "MMMM") => format(new Date(year, month), pattern, { locale: id })
const dayLabel = (date: string, h?: Holiday) => `${format(new Date(`${date}T00:00:00`), "EEEE, d MMMM yyyy", { locale: id })}${h ? ` · ${h.name}` : ""}`

export function KindDot({ kind, className }: { kind: HolidayKind; className?: string }) {
  return <span className={cn("inline-block size-2.5 shrink-0 rounded-full", KIND_DOT[kind], className)} aria-hidden />
}

/** Keterangan warna kalender. `extended` = ikut tampilkan warna libur nasional/cuti bersama/perusahaan. */
export function HolidayLegend({ className, extended = false }: { className?: string; extended?: boolean }) {
  return (
    <ul className={cn("text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs", className)}>
      {(extended ? (Object.keys(KIND_LABEL) as HolidayKind[]) : (["hidden"] as const)).map((k) => (
        <li key={k} className="flex items-center gap-1.5"><KindDot kind={k} /> {KIND_LABEL[k]}</li>
      ))}
      <li className="flex items-center gap-1.5"><span className="text-primary/80 text-[0.7rem] font-semibold">12</span> Bukan hari kerja</li>
      <li className="flex items-center gap-1.5"><span className="ring-ring size-2.5 rounded-full ring-2" aria-hidden /> Hari ini</li>
    </ul>
  )
}

/** Daftar libur (klik untuk membuka detail) */
export function HolidayList({ items, onSelect, showMonth = false, className }: {
  items: Holiday[]
  onSelect: (date: string) => void
  /** tampilkan "24 Des" alih-alih "24" */
  showMonth?: boolean
  className?: string
}) {
  return (
    <ul className={cn("space-y-1", className)}>
      {items.map((h) => (
        <li key={h.id}>
          <button type="button" onClick={() => onSelect(h.date)} className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs">
            <KindDot kind={holidayKind(h)} className="mt-1" />
            <span className={cn("shrink-0 font-semibold tabular-nums", showMonth ? "w-12" : "w-5")}>
              {showMonth ? format(new Date(`${h.date}T00:00:00`), "d MMM", { locale: id }) : Number(h.date.slice(8))}
            </span>
            <span className={cn("min-w-0", !h.isActive && "text-muted-foreground line-through")}>{h.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

interface MonthProps {
  year: number
  /** 0 = Januari */
  month: number
  /** semua libur tahun ini per tanggal, termasuk yang disembunyikan */
  holidays: Map<string, Holiday>
  /** hari kerja mingguan, 1 = Senin ... 7 = Minggu */
  workDays: number[]
  /** tanggal hari ini menurut server */
  today: string
  onSelect: (date: string) => void
}

/**
 * Bulan ringkas untuk tampilan setahun: grid Senin–Minggu, tanggal libur berwarna,
 * daftar libur di bawahnya. Judul bulan bisa diklik untuk membuka tampilan bulan.
 */
export function MonthCalendar({ year, month, holidays, workDays, today, onSelect, onOpenMonth }: MonthProps & { onOpenMonth?: () => void }) {
  const days = monthDates(year, month)
  const leading = isoWeekday(days[0]) - 1
  const list = days.flatMap((d) => (holidays.has(d) ? [holidays.get(d)!] : []))
  const isCurrent = today.slice(0, 7) === days[0].slice(0, 7)

  return (
    <section className={cn("bg-card flex flex-col rounded-xl border p-4", isCurrent && "border-primary/40")} aria-label={monthName(year, month, "MMMM yyyy")}>
      <h3 className="mb-3 flex items-baseline justify-between text-sm font-semibold capitalize">
        {onOpenMonth ? (
          <button type="button" onClick={onOpenMonth} className="hover:text-primary capitalize underline-offset-4 hover:underline" title="Buka tampilan bulan">
            {monthName(year, month)}
          </button>
        ) : monthName(year, month)}
        {isCurrent && <span className="text-primary text-xs font-medium normal-case">Bulan ini</span>}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid">
        {WEEKDAYS.map((w, i) => (
          <div key={w} role="columnheader" title={w} className={cn("pb-1 text-[0.7rem] font-medium", workDays.includes(i + 1) ? "text-muted-foreground" : "text-primary/80")}>
            {w.slice(0, 3)}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => <div key={`x${i}`} aria-hidden />)}
        {days.map((date) => {
          const h = holidays.get(date)
          const kind = h && holidayKind(h)
          const offDay = !workDays.includes(isoWeekday(date))
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              title={dayLabel(date, h)}
              aria-label={dayLabel(date, h)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-colors outline-none",
                "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                kind ? KIND_CELL[kind] : offDay ? "text-primary/80 hover:bg-muted" : "hover:bg-muted",
                date === today && "ring-ring ring-offset-card ring-2 ring-offset-1",
              )}
            >
              {Number(date.slice(8))}
            </button>
          )
        })}
      </div>
      {list.length > 0 && <HolidayList items={list} onSelect={onSelect} className="mt-3 border-t pt-3" />}
    </section>
  )
}

/**
 * Satu bulan dalam ukuran besar seperti kalender dinding: tiap sel memuat nomor tanggal dan nama libur.
 * Tanggal dari bulan sebelum/sesudah ditampilkan samar untuk melengkapi minggu.
 */
export function MonthView({ year, month, holidays, workDays, today, onSelect }: MonthProps) {
  const days = monthDates(year, month)
  const leading = isoWeekday(days[0]) - 1
  const trailing = (7 - ((leading + days.length) % 7)) % 7
  const before = leading ? monthDates(month === 0 ? year - 1 : year, (month + 11) % 12).slice(-leading) : []
  const after = Array.from({ length: trailing }, (_, i) => i + 1)

  return (
    <div className="bg-card overflow-hidden rounded-xl border" role="grid" aria-label={monthName(year, month, "MMMM yyyy")}>
      <div className="bg-muted/40 grid grid-cols-7 border-b" role="row">
        {WEEKDAYS.map((w, i) => (
          <div key={w} role="columnheader" className={cn("px-2 py-2 text-center text-xs font-medium sm:text-left", workDays.includes(i + 1) ? "text-muted-foreground" : "text-primary/80")}>
            <span className="sm:hidden">{w.slice(0, 3)}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>
      <div className="-mb-px grid grid-cols-7">
        {before.map((d) => <OutsideCell key={d} day={Number(d.slice(8))} />)}
        {days.map((date) => {
          const h = holidays.get(date)
          const kind = h && holidayKind(h)
          const offDay = !workDays.includes(isoWeekday(date))
          const isToday = date === today
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              title={dayLabel(date, h)}
              aria-label={dayLabel(date, h)}
              className={cn(
                "group flex min-h-16 flex-col items-center gap-1 border-r border-b p-1 text-left transition-colors outline-none sm:min-h-28 sm:items-stretch sm:p-2 [&:nth-child(7n)]:border-r-0",
                "hover:bg-muted/60 focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset",
                offDay && "bg-muted/30",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums",
                  (offDay || (h?.isActive ?? false)) && "text-primary font-semibold",
                  isToday && "bg-primary text-primary-foreground font-semibold",
                )}
              >
                {Number(date.slice(8))}
              </span>
              {h && kind && (
                <>
                  <KindDot kind={kind} className="sm:hidden" />
                  <span className={cn("hidden rounded px-1.5 py-1 text-[0.7rem] leading-tight font-medium sm:line-clamp-2", KIND_CHIP[kind])}>{h.name}</span>
                </>
              )}
              {isToday && <span className="text-primary hidden text-[0.7rem] font-medium sm:block">Hari ini</span>}
            </button>
          )
        })}
        {after.map((d) => <OutsideCell key={`n${d}`} day={d} />)}
      </div>
    </div>
  )
}

function OutsideCell({ day }: { day: number }) {
  return (
    <div aria-hidden className="text-muted-foreground/40 flex min-h-16 justify-center border-r border-b p-1 text-sm tabular-nums sm:min-h-28 sm:justify-start sm:p-2 [&:nth-child(7n)]:border-r-0">
      <span className="flex size-7 items-center justify-center">{day}</span>
    </div>
  )
}
