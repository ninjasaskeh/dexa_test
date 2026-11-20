import { z } from 'zod';

/** Trim & lowercase dulu, baru validasi format (agar " Budi@Dexa.local " tetap valid) */
export const emailField = z.string('Email wajib diisi').trim().toLowerCase().pipe(z.email('Format email tidak valid'));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password wajib diisi'),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const passwordRule = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
  .regex(/[0-9]/, 'Password harus mengandung angka');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password lama wajib diisi'),
    newPassword: passwordRule,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Password baru harus berbeda dari password lama',
  });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
