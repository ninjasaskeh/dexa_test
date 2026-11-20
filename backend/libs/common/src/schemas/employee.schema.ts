import { z } from 'zod';
import { Role } from '../constants';
import { emailField } from './auth.schema';

const dateString = z.iso.date('Format tanggal harus YYYY-MM-DD');

/**
 * NIP diisi HRD: angka saja, minimal 8 digit (mis. 20260045 = tahun + urutan, atau 26110045 = tahun + bulan + urutan).
 * Dipakai juga sebagai password awal karyawan.
 */
export const nipField = z
  .string('NIP wajib diisi')
  .trim()
  .regex(/^\d+$/, 'NIP hanya boleh berisi angka')
  .min(8, 'NIP minimal 8 digit')
  .max(20, 'NIP maksimal 20 digit');

const idField = (label: string) => z.coerce.number(`${label} wajib dipilih`).int(`${label} wajib dipilih`).positive(`${label} wajib dipilih`);

const employeeBase = {
  nip: nipField,
  fullName: z.string().trim().min(3, 'Nama minimal 3 karakter').max(120),
  departmentId: idField('Departemen'),
  positionId: idField('Jabatan'),
  phone: z
    .union([z.literal('').transform(() => null), z.string().trim().regex(/^(\+62|0)8[0-9]{7,12}$/, 'Nomor HP tidak valid (contoh: 081234567890)')])
    .nullable()
    .optional(),
  joinDate: dateString,
};

/** Password tidak diisi HRD: password awal = NIP, karyawan wajib menggantinya saat login pertama */
export const createEmployeeSchema = z.object({
  ...employeeBase,
  email: emailField,
  role: z.enum(Role).default(Role.EMPLOYEE),
});
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    ...employeeBase,
    email: emailField,
    role: z.enum(Role),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada data yang diubah');
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;

export const listEmployeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(100).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});
export type ListEmployeeQuery = z.infer<typeof listEmployeeQuerySchema>;

export const idParamSchema = z.coerce.number('ID tidak valid').int('ID tidak valid').positive('ID tidak valid');

const orgName = (label: string) => z.string(`Nama ${label} wajib diisi`).trim().min(2, `Nama ${label} minimal 2 karakter`).max(80, `Nama ${label} maksimal 80 karakter`);

export const createDepartmentSchema = z.object({ name: orgName('departemen') });
export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z
  .object({ name: orgName('departemen'), isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada data yang diubah');
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;

export const positionQuerySchema = z.object({ departmentId: z.coerce.number('Departemen tidak valid').int('Departemen tidak valid').positive('Departemen tidak valid').optional() });
export type PositionQuery = z.infer<typeof positionQuerySchema>;

export const createPositionSchema = z.object({ departmentId: idField('Departemen'), name: orgName('jabatan') });
export type CreatePositionDto = z.infer<typeof createPositionSchema>;

export const updatePositionSchema = z
  .object({ name: orgName('jabatan'), isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Tidak ada data yang diubah');
export type UpdatePositionDto = z.infer<typeof updatePositionSchema>;
