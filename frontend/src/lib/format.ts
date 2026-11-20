import { format, formatDistanceToNow, parseISO } from "date-fns"
import { id } from "date-fns/locale"

const toDate = (v: string | Date) => (typeof v === "string" ? parseISO(v) : v)

export const fmtDate = (v: string | Date) => format(toDate(v), "d MMM yyyy", { locale: id })
export const fmtDateLong = (v: string | Date) => format(toDate(v), "EEEE, d MMMM yyyy", { locale: id })
export const fmtTime = (v: string | Date) => format(toDate(v), "HH:mm", { locale: id })
export const fmtDateTime = (v: string | Date) => format(toDate(v), "d MMM yyyy, HH:mm", { locale: id })
export const fmtRelative = (v: string | Date) => formatDistanceToNow(toDate(v), { addSuffix: true, locale: id })
export const toISODate = (d: Date) => format(d, "yyyy-MM-dd")

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

/** Durasi kerja antara check-in & check-out */
export function workDuration(from: string, to: string) {
  const mins = Math.max(0, Math.round((toDate(to).getTime() - toDate(from).getTime()) / 60000))
  return `${Math.floor(mins / 60)}j ${mins % 60}m`
}
