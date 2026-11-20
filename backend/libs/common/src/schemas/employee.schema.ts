import { z } from 'zod';
import { Role } from '../constants';
import { emailField, passwordRule } from './auth.schema';

const dateString = z.iso.date('Format tanggal harus YYYY-MM-DD');

const employeeBase = {
  employeeCode: z.string().trim().min(3, 'Kode karyawan minimal 3 karakter').max(20).regex(/^[A-Z0-9-]+$/i, 'Hanya huruf, angka, dan tanda -').transform((s) => s.toUpperCase()),
  fullName: z.string().trim().min(3, 'Nama minimal 3 karakter').max(120),
  position: z.string().trim().min(2, 'Jabatan wajib diisi').max(80),
  department: z.string().trim().min(2, 'Departemen wajib diisi').max(80),
  phone: z
    .union([z.literal('').transform(() => null), z.string().trim().regex(/^(\+62|0)8[0-9]{7,12}$/, 'Nomor HP tidak valid (contoh: 081234567890)')])
    .nullable()
    .optional(),
  joinDate: dateString,
};

export const createEmployeeSchema = z.object({
  ...employeeBase,
  email: emailField,
  password: passwordRule,
  role: z.enum(Role).default(Role.EMPLOYEE),
});
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    ...employeeBase,
    email: emailField,
    password: passwordRule.optional().or(z.literal('').transform(() => undefined)),
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
  department: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
});
export type ListEmployeeQuery = z.infer<typeof listEmployeeQuerySchema>;

export const idParamSchema = z.coerce.number('ID tidak valid').int('ID tidak valid').positive('ID tidak valid');
