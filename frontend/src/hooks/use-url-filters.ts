import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import type { AttendanceFilters } from "@/hooks/queries"
import { useDebounce } from "@/hooks/use-debounce"

type Primitive = string | number | undefined
type Rule = readonly (string | number)[] | RegExp

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export const MONTH_RE = /^\d{4}-\d{2}$/
export const PAGE_LIMITS = [10, 20, 50] as const

/**
 * Filter, pencarian, dan paginasi disimpan di query string URL agar bisa di-refresh, dibagikan, dan
 * kembali lewat tombol back. `defaults` wajib mencantumkan SEMUA key (pakai `undefined` untuk yang opsional)
 * dan harus stabil (konstanta modul / useMemo). Nilai yang sama dengan default tidak ditulis ke URL.
 * Nilai URL yang tidak valid (angka bukan bilangan bulat positif, di luar `rules`) diabaikan dan memakai default.
 * Param lain di URL (misalnya `tab`) tidak disentuh.
 */
export function useUrlFilters<T extends { [K in keyof T]: Primitive }>(
  defaults: T,
  rules?: { [K in keyof T]?: Rule },
) {
  const [params, setParams] = useSearchParams()

  const values = useMemo(() => {
    const out = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T & string)[]) {
      const raw = params.get(key)
      if (raw === null || raw === "") continue
      const parsed: string | number = typeof defaults[key] === "number" ? Number(raw) : raw
      if (typeof parsed === "number" && !(Number.isInteger(parsed) && parsed > 0)) continue
      const rule = rules?.[key]
      if (rule instanceof RegExp ? !rule.test(raw) : rule && !rule.includes(parsed)) continue
      out[key] = parsed as T[typeof key]
    }
    return out
  }, [params, defaults, rules])

  const patch = useCallback(
    (p: Partial<T>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(p) as [keyof T & string, Primitive][]) {
            if (v === undefined || v === "" || v === defaults[k]) next.delete(k)
            else next.set(k, String(v))
          }
          return next
        },
        { replace: true },
      ),
    [setParams, defaults],
  )

  return [values, patch] as const
}

/**
 * Teks kotak pencarian: langsung berubah saat diketik, lalu ditulis ke URL setelah jeda (debounce).
 * Bila nilai di URL berubah dari luar (back/forward, link), teks ikut diperbarui.
 */
export function useSearchInput(value: string | undefined, commit: (v: string | undefined) => void) {
  const [text, setText] = useState(value ?? "")
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    if (value !== (text.trim() || undefined)) setText(value ?? "")
  }

  const next = useDebounce(text).trim() || undefined
  const latest = useRef({ value, commit })
  useEffect(() => {
    latest.current = { value, commit }
  })
  // hanya bereaksi pada hasil debounce yang baru, supaya navigasi back tidak ditimpa nilai lama
  useEffect(() => {
    if (next !== latest.current.value) latest.current.commit(next)
  }, [next])

  return [text, setText] as const
}

/** Default & aturan filter absensi (Monitoring dan Riwayat) */
export const ATTENDANCE_FILTER_DEFAULTS: AttendanceFilters = { page: 1, limit: 10, from: undefined, to: undefined, type: undefined, search: undefined }
export const ATTENDANCE_FILTER_RULES = { limit: PAGE_LIMITS, from: DATE_RE, to: DATE_RE, type: ["CHECK_IN", "CHECK_OUT"] }
