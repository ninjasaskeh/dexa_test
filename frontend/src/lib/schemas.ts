import { z } from "zod"

/* Schema Zod di frontend, selaras dengan validasi backend (libs/common/src/schemas) */

/** Trim dulu baru validasi format, sama seperti backend */
const emailField = z.string().trim().pipe(z.email("Format email tidak valid"))

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email atau NIP wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
})
export type LoginValues = z.infer<typeof loginSchema>

const passwordRule = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Z]/, "Password harus mengandung huruf besar")
  .regex(/[0-9]/, "Password harus mengandung angka")

/** Sama dengan backend: NIP diisi HRD dan menjadi password awal karyawan */
const nipField = z
  .string()
  .trim()
  .regex(/^\d+$/, "NIP hanya boleh berisi angka")
  .min(8, "NIP minimal 8 digit")
  .max(20, "NIP maksimal 20 digit")

/** Departemen & jabatan dipilih lewat Select (nilai string id) */
export const employeeSchema = z.object({
  nip: nipField,
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
  email: emailField,
  departmentId: z.string().min(1, "Departemen wajib dipilih"),
  positionId: z.string().min(1, "Jabatan wajib dipilih"),
  phone: z.union([z.literal(""), z.string().regex(/^(\+62|0)8[0-9]{7,12}$/, "Nomor HP tidak valid (contoh: 081234567890)")]),
  joinDate: z.string().min(1, "Tanggal bergabung wajib diisi"),
  role: z.enum(["EMPLOYEE", "HR_ADMIN"]),
  isActive: z.boolean(),
})
export type EmployeeFormValues = z.infer<typeof employeeSchema>

const orgName = (label: string) => z.string().trim().min(2, `Nama ${label} minimal 2 karakter`).max(80, `Nama ${label} maksimal 80 karakter`)
export const departmentSchema = z.object({ name: orgName("departemen") })
export const positionSchema = z.object({ name: orgName("jabatan") })
export type OrgNameValues = z.infer<typeof departmentSchema>

export const attendanceSchema = z.object({
  photo: z
    .instanceof(File, { message: "Foto bukti WFH wajib diambil/diunggah" })
    .refine((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type), "Foto harus berformat JPG, PNG, atau WEBP")
    .refine((f) => f.size <= 5 * 1024 * 1024, "Ukuran foto maksimal 5 MB"),
  notes: z.string().max(255, "Catatan maksimal 255 karakter").optional(),
})
export type AttendanceValues = z.infer<typeof attendanceSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password lama wajib diisi"),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi password tidak sama" })
  .refine((v) => v.currentPassword !== v.newPassword, { path: ["newPassword"], message: "Password baru harus berbeda dari password lama" })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

const reason = z.string().trim().min(5, "Alasan minimal 5 karakter").max(255, "Alasan maksimal 255 karakter")
const LEAVE_MAX_DAYS = 31

export const leaveSchema = z
  .object({
    type: z.enum(["CUTI", "IZIN", "SAKIT"]),
    startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
    endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
    reason,
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, { path: ["endDate"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai" })
  .refine((v) => !v.startDate || !v.endDate || (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000 < LEAVE_MAX_DAYS, {
    path: ["endDate"],
    message: `Maksimal ${LEAVE_MAX_DAYS} hari per pengajuan`,
  })
export type LeaveValues = z.infer<typeof leaveSchema>

export const correctionSchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  type: z.enum(["CHECK_IN", "CHECK_OUT"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:mm"),
  reason,
})
export type CorrectionValues = z.infer<typeof correctionSchema>

export const reviewSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    note: z.string().trim().max(255, "Catatan maksimal 255 karakter"),
  })
  .refine((v) => v.status !== "REJECTED" || !!v.note, { path: ["note"], message: "Alasan penolakan wajib diisi" })
export type ReviewValues = z.infer<typeof reviewSchema>

export const holidaySchema = z.object({
  date: z.string().min(1, "Tanggal wajib diisi"),
  type: z.enum(["HOLIDAY", "LEAVE"]),
  name: z.string().trim().min(3, "Nama hari libur minimal 3 karakter").max(120),
})
export type HolidayValues = z.infer<typeof holidaySchema>
