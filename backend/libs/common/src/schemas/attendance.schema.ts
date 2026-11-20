import { z } from 'zod';
import { AttendanceType } from '../constants';

export const submitAttendanceSchema = z.object({
  type: z.enum(AttendanceType, 'Tipe absen harus CHECK_IN atau CHECK_OUT'),
  notes: z.string().trim().max(255, 'Catatan maksimal 255 karakter').optional(),
});
export type SubmitAttendanceDto = z.infer<typeof submitAttendanceSchema>;

const dateString = z.iso.date('Format tanggal harus YYYY-MM-DD');

export const attendanceQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    from: dateString.optional(),
    to: dateString.optional(),
    employeeId: z.coerce.number().int().positive().optional(),
    type: z.enum(AttendanceType).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { path: ['to'], message: 'Tanggal akhir harus setelah tanggal awal' });
export type AttendanceQuery = z.infer<typeof attendanceQuerySchema>;

export const recapQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format bulan harus YYYY-MM').optional(),
});
export type RecapQuery = z.infer<typeof recapQuerySchema>;

export const holidayQuerySchema = z.object({
  year: z.coerce.number('Tahun tidak valid').int().min(2000).max(2100).optional(),
});
export type HolidayQuery = z.infer<typeof holidayQuerySchema>;

export const createHolidaySchema = z.object({
  date: dateString,
  name: z.string('Nama hari libur wajib diisi').trim().min(3, 'Nama hari libur minimal 3 karakter').max(120),
});
export type CreateHolidayDto = z.infer<typeof createHolidaySchema>;

export const updateHolidaySchema = z.object({
  isActive: z.boolean('isActive harus boolean'),
});
export type UpdateHolidayDto = z.infer<typeof updateHolidaySchema>;
