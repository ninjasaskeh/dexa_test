import { describe, expect, it } from "vitest"
import { correctionSchema, createEmployeeSchema, leaveSchema, loginSchema, reviewSchema, updateEmployeeSchema } from "./schemas"

/** Pesan pertama per field, sama seperti yang ditampilkan form */
function fieldErrors(r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string> = {}
  for (const i of r.error?.issues ?? []) out[i.path.join(".")] ??= i.message
  return out
}

/* Aturan di sini harus sama dengan backend (libs/common/src/schemas) agar error muncul sebelum request dikirim */
describe("schema form (selaras dengan backend)", () => {
  it("login: email di-trim, password wajib", () => {
    expect(loginSchema.safeParse({ email: " budi@dexa.local ", password: "x" }).success).toBe(true)
    expect(fieldErrors(loginSchema.safeParse({ email: "budi", password: "" }))).toEqual({
      email: "Format email tidak valid",
      password: "Password wajib diisi",
    })
  })

  const employee = {
    employeeCode: "EMP-010", fullName: "Dewi Lestari", email: "dewi@dexa.local", position: "Analyst", department: "Finance",
    phone: "", joinDate: "2026-11-01", role: "EMPLOYEE" as const, isActive: true,
  }

  it("karyawan baru wajib password kuat, edit boleh kosong", () => {
    expect(fieldErrors(createEmployeeSchema.safeParse({ ...employee, password: "lemah" }))).toHaveProperty("password", "Password minimal 8 karakter")
    expect(createEmployeeSchema.safeParse({ ...employee, password: "Rahasia123" }).success).toBe(true)
    expect(updateEmployeeSchema.safeParse({ ...employee, password: "" }).success).toBe(true)
  })

  it("nomor HP format Indonesia atau kosong", () => {
    expect(createEmployeeSchema.safeParse({ ...employee, password: "Rahasia123", phone: "081234567890" }).success).toBe(true)
    expect(fieldErrors(createEmployeeSchema.safeParse({ ...employee, password: "Rahasia123", phone: "12345" }))).toHaveProperty("phone")
  })

  it("cuti: selesai tidak sebelum mulai, maksimal 31 hari", () => {
    const base = { type: "CUTI" as const, reason: "Acara keluarga" }
    expect(fieldErrors(leaveSchema.safeParse({ ...base, startDate: "2026-11-10", endDate: "2026-11-09" }))).toHaveProperty("endDate")
    expect(leaveSchema.safeParse({ ...base, startDate: "2026-11-01", endDate: "2026-12-01" }).success).toBe(true)
    expect(leaveSchema.safeParse({ ...base, startDate: "2026-11-01", endDate: "2026-12-02" }).success).toBe(false)
  })

  it("koreksi: jam HH:mm 24 jam dan alasan minimal 5 karakter", () => {
    const base = { date: "2026-11-19", type: "CHECK_OUT" as const }
    expect(correctionSchema.safeParse({ ...base, time: "17:05", reason: "Lupa check-out" }).success).toBe(true)
    expect(fieldErrors(correctionSchema.safeParse({ ...base, time: "25:00", reason: "lupa" }))).toEqual({
      time: "Format jam harus HH:mm",
      reason: "Alasan minimal 5 karakter",
    })
  })

  it("review: tolak wajib beralasan", () => {
    expect(reviewSchema.safeParse({ status: "APPROVED", note: "" }).success).toBe(true)
    expect(fieldErrors(reviewSchema.safeParse({ status: "REJECTED", note: " " }))).toEqual({ note: "Alasan penolakan wajib diisi" })
  })
})
