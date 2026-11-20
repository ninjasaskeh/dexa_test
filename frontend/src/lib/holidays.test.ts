import { describe, expect, it } from "vitest"
import type { Holiday } from "@/types"
import { holidayKind, isoWeekday, monthDates, shiftMonth, summarize } from "./holidays"

const h = (date: string, p: Partial<Holiday> = {}): Holiday => ({ id: 1, date, name: "Libur", type: "HOLIDAY", source: "SYNC", isActive: true, ...p })

describe("helper kalender hari libur", () => {
  it("monthDates mengikuti jumlah hari tiap bulan, termasuk kabisat", () => {
    expect(monthDates(2026, 1)).toHaveLength(28)
    expect(monthDates(2028, 1).at(-1)).toBe("2028-02-29")
    expect(monthDates(2026, 10)[0]).toBe("2026-11-01")
  })

  it("shiftMonth melewati batas tahun", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01")
    expect(shiftMonth("2026-01", -1)).toBe("2025-12")
  })

  it("isoWeekday: Senin = 1, Minggu = 7", () => {
    expect(isoWeekday("2026-11-16")).toBe(1)
    expect(isoWeekday("2026-11-22")).toBe(7)
  })

  it("kategori: disembunyikan > manual (perusahaan) > cuti bersama > libur nasional", () => {
    expect(holidayKind(h("2026-01-01"))).toBe("national")
    expect(holidayKind(h("2026-01-01", { type: "LEAVE" }))).toBe("leave")
    expect(holidayKind(h("2026-01-01", { source: "MANUAL", type: "LEAVE" }))).toBe("company")
    expect(holidayKind(h("2026-01-01", { isActive: false }))).toBe("hidden")
  })

  it("summarize: libur aktif di hari kerja mengurangi hari kerja, yang disembunyikan tidak", () => {
    const holidays = new Map([
      ["2026-12-24", h("2026-12-24", { type: "LEAVE" })],
      ["2026-12-25", h("2026-12-25")],
      ["2026-12-09", h("2026-12-09", { isActive: false })],
      ["2026-12-27", h("2026-12-27", { source: "MANUAL" })], // Minggu: tetap bukan hari kerja
    ])
    // Desember 2026: 23 hari Senin–Jumat, dikurangi 24 & 25
    expect(summarize(monthDates(2026, 11), [1, 2, 3, 4, 5], holidays)).toEqual({ workDays: 21, national: 1, leave: 1, company: 1, hidden: 1 })
  })
})
