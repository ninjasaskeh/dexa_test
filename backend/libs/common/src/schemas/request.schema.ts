import { z } from 'zod';
import { AttendanceType, LeaveType, RequestStatus } from '../constants';

const dateString = z.iso.date('Format tanggal harus YYYY-MM-DD');
const reason = z.string('Alasan wajib diisi').trim().min(5, 'Alasan minimal 5 karakter').max(255, 'Alasan maksimal 255 karakter');

/** Maksimal rentang satu pengajuan cuti/izin/sakit */
export const LEAVE_MAX_DAYS = 31;

export const createLeaveSchema = z
  .object({
    type: z.enum(LeaveType, 'Jenis pengajuan harus CUTI, IZIN, atau SAKIT'),
    startDate: dateString,
    endDate: dateString,
    reason,
  })
  .refine((v) => v.startDate <= v.endDate, { path: ['endDate'], message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' })
  .refine((v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86_400_000 < LEAVE_MAX_DAYS, {
    path: ['endDate'],
    message: `Maksimal ${LEAVE_MAX_DAYS} hari per pengajuan`,
  });
export type CreateLeaveDto = z.infer<typeof createLeaveSchema>;

export const createCorrectionSchema = z.object({
  date: dateString,
  type: z.enum(AttendanceType, 'Tipe absen harus CHECK_IN atau CHECK_OUT'),
  time: z.string('Jam wajib diisi').regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format jam harus HH:mm'),
  reason,
});
export type CreateCorrectionDto = z.infer<typeof createCorrectionSchema>;

export const reviewRequestSchema = z
  .object({
    status: z.enum([RequestStatus.APPROVED, RequestStatus.REJECTED], 'Keputusan harus APPROVED atau REJECTED'),
    note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').optional(),
  })
  .refine((v) => v.status !== RequestStatus.REJECTED || !!v.note, { path: ['note'], message: 'Alasan penolakan wajib diisi' });
export type ReviewRequestDto = z.infer<typeof reviewRequestSchema>;

export const requestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(RequestStatus).optional(),
  search: z.string().trim().max(100).optional(),
});
export type RequestQuery = z.infer<typeof requestQuerySchema>;
