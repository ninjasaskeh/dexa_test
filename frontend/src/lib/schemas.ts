import { z } from "zod"

/* Schema Zod di frontend, selaras dengan validasi backend (libs/common/src/schemas) */

/** Trim dulu baru validasi format, sama seperti backend */
const emailField = z.string().trim().pipe(z.email("Format email tidak valid"))

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password wajib diisi"),
})
export type LoginValues = z.infer<typeof loginSchema>

const passwordRule = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Z]/, "Password harus mengandung huruf besar")
  .regex(/[0-9]/, "Password harus mengandung angka")

const baseEmployee = {
  employeeCode: z.string().trim().min(3, "Kode karyawan minimal 3 karakter").max(20).regex(/^[A-Za-z0-9-]+$/, "Hanya huruf, angka, dan tanda -"),
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
  email: emailField,
  position: z.string().trim().min(2, "Jabatan wajib diisi").max(80),
  department: z.string().trim().min(2, "Departemen wajib diisi").max(80),
  phone: z.union([z.literal(""), z.string().regex(/^(\+62|0)8[0-9]{7,12}$/, "Nomor HP tidak valid (contoh: 081234567890)")]),
  joinDate: z.string().min(1, "Tanggal bergabung wajib diisi"),
  role: z.enum(["EMPLOYEE", "HR_ADMIN"]),
  isActive: z.boolean(),
}

export const createEmployeeSchema = z.object({ ...baseEmployee, password: passwordRule })
export const updateEmployeeSchema = z.object({
  ...baseEmployee,
  password: z.union([z.literal(""), passwordRule]),
})
export type EmployeeFormValues = z.infer<typeof updateEmployeeSchema>

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
  name: z.string().trim().min(3, "Nama hari libur minimal 3 karakter").max(120),
})
export type HolidayValues = z.infer<typeof holidaySchema>
