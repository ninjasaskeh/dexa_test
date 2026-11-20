import { describe, expect, it } from "vitest"
import { fmtDate, fmtDateLong, fmtTime, initials, workDuration } from "./format"

describe("format tampilan", () => {
  it("tanggal & jam dalam bahasa Indonesia, zona waktu WIB", () => {
    expect(fmtDate("2026-11-20")).toBe("20 Nov 2026")
    expect(fmtDateLong("2026-11-20")).toBe("Jumat, 20 November 2026")
    expect(fmtTime("2026-11-20T01:05:00.000Z")).toBe("08:05")
  })

  it("inisial maksimal dua huruf", () => {
    expect(initials("budi santoso wijaya")).toBe("BS")
    expect(initials("  Rina  ")).toBe("R")
  })

  it("durasi kerja tidak pernah negatif", () => {
    expect(workDuration("2026-11-20T08:47:00+07:00", "2026-11-20T16:55:00+07:00")).toBe("8j 8m")
    expect(workDuration("2026-11-20T17:00:00+07:00", "2026-11-20T08:00:00+07:00")).toBe("0j 0m")
  })
})
