import { describe, expect, it } from "vitest"
import { correctionSchema, employeeSchema, leaveSchema, loginSchema, positionSchema, reviewSchema } from "./schemas"

/** Pesan pertama per field, sama seperti yang ditampilkan form */
function fieldErrors(r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  const out: Record<string, string> = {}
  for (const i of r.error?.issues ?? []) out[i.path.join(".")] ??= i.message
  return out
}

/* Aturan di sini harus sama dengan backend (libs/common/src/schemas) agar error muncul sebelum request dikirim */
describe("schema form (selaras dengan backend)", () => {
  it("login: email atau NIP wajib, password wajib", () => {
    expect(loginSchema.safeParse({ identifier: " 20260045 ", password: "x" }).success).toBe(true)
    expect(fieldErrors(loginSchema.safeParse({ identifier: " ", password: "" }))).toEqual({
      identifier: "Email atau NIP wajib diisi",
      password: "Password wajib diisi",
    })
  })

  const employee = {
    nip: "20260045", fullName: "Dewi Lestari", email: "dewi@dexa.local", departmentId: "1", positionId: "3",
    phone: "", joinDate: "2026-11-01", role: "EMPLOYEE" as const, isActive: true,
  }

  it("karyawan: NIP angka minimal 8 digit, tanpa field password", () => {
    expect(employeeSchema.safeParse(employee).success).toBe(true)
    expect(fieldErrors(employeeSchema.safeParse({ ...employee, nip: "2026045" }))).toEqual({ nip: "NIP minimal 8 digit" })
    expect(fieldErrors(employeeSchema.safeParse({ ...employee, nip: "EMP-0045" }))).toEqual({ nip: "NIP hanya boleh berisi angka" })
  })

  it("karyawan: departemen & jabatan wajib dipilih", () => {
    expect(fieldErrors(employeeSchema.safeParse({ ...employee, departmentId: "", positionId: "" }))).toEqual({
      departmentId: "Departemen wajib dipilih",
      positionId: "Jabatan wajib dipilih",
    })
  })

  it("nomor HP format Indonesia atau kosong", () => {
    expect(employeeSchema.safeParse({ ...employee, phone: "081234567890" }).success).toBe(true)
    expect(fieldErrors(employeeSchema.safeParse({ ...employee, phone: "12345" }))).toHaveProperty("phone")
  })

  it("nama jabatan minimal 2 karakter", () => {
    expect(fieldErrors(positionSchema.safeParse({ name: "A" }))).toEqual({ name: "Nama jabatan minimal 2 karakter" })
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
