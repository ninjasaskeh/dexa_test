import type { Holiday } from "@/types"

export type HolidayKind = "national" | "leave" | "company" | "hidden"

/** Kategori tampilan: libur nasional, cuti bersama, libur perusahaan (manual), atau disembunyikan */
export function holidayKind(h: Holiday): HolidayKind {
  if (!h.isActive) return "hidden"
  if (h.source === "MANUAL") return "company"
  return h.type === "LEAVE" ? "leave" : "national"
}

export const KIND_LABEL: Record<HolidayKind, string> = {
  national: "Libur nasional",
  leave: "Cuti bersama",
  company: "Libur perusahaan",
  hidden: "Disembunyikan (hari kerja)",
}

/** Hari ISO (1 = Senin ... 7 = Minggu) dari "YYYY-MM-DD" tanpa geser zona waktu */
export function isoWeekday(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d).getDay() || 7
}

const pad = (n: number) => String(n).padStart(2, "0")

/** Semua tanggal "YYYY-MM-DD" dalam satu bulan (month 0 = Januari) */
export function monthDates(year: number, month: number) {
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)
}

/** "YYYY-MM" digeser n bulan */
export function shiftMonth(ym: string, n: number) {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Ringkasan untuk rentang tanggal: jumlah hari kerja dan libur per kategori */
export function summarize(dates: string[], workDays: number[], holidays: Map<string, Holiday>) {
  const s = { workDays: 0, national: 0, leave: 0, company: 0, hidden: 0 }
  for (const d of dates) {
    const h = holidays.get(d)
    if (h) s[holidayKind(h)] += 1
    if (workDays.includes(isoWeekday(d)) && !h?.isActive) s.workDays += 1
  }
  return s
}
