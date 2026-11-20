import {
  attendanceQuerySchema, changePasswordSchema, createCorrectionSchema, createEmployeeSchema, createLeaveSchema, loginSchema,
  recapQuerySchema, reviewRequestSchema, updateEmployeeSchema,
} from './index';

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]));

describe('schema validasi (dipakai gateway, disalin di frontend)', () => {
  it('login: email dirapikan sebelum divalidasi', () => {
    const r = loginSchema.safeParse({ email: '  Budi@Dexa.LOCAL ', password: 'x' });
    expect(r.success && r.data.email).toBe('budi@dexa.local');
    expect(issues(loginSchema.safeParse({ email: 'bukan-email', password: '' }))).toEqual({
      email: 'Format email tidak valid',
      password: 'Password wajib diisi',
    });
  });

  it('password baru: minimal 8 karakter, huruf besar, angka, dan beda dari yang lama', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'Lama1234', newPassword: 'abcdefgh' }).success).toBe(false);
    expect(issues(changePasswordSchema.safeParse({ currentPassword: 'Sama1234', newPassword: 'Sama1234' }))).toEqual({
      newPassword: 'Password baru harus berbeda dari password lama',
    });
    expect(changePasswordSchema.safeParse({ currentPassword: 'Lama1234', newPassword: 'Baru12345' }).success).toBe(true);
  });

  const employee = {
    employeeCode: 'emp-010', fullName: 'Dewi Lestari', position: 'Analyst', department: 'Finance',
    joinDate: '2026-11-01', email: 'dewi@dexa.local', password: 'Rahasia123',
  };

  it('karyawan baru: kode jadi huruf besar, role default EMPLOYEE, HP kosong jadi null', () => {
    const r = createEmployeeSchema.safeParse({ ...employee, phone: '' });
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.employeeCode, r.data.role, r.data.phone]).toEqual(['EMP-010', 'EMPLOYEE', null]);
  });

  it('karyawan baru: nomor HP harus format Indonesia', () => {
    expect(issues(createEmployeeSchema.safeParse({ ...employee, phone: '12345' }))).toHaveProperty('phone');
    expect(createEmployeeSchema.safeParse({ ...employee, phone: '+6281234567890' }).success).toBe(true);
  });

  it('update karyawan: body kosong ditolak, password kosong diabaikan', () => {
    expect(updateEmployeeSchema.safeParse({}).success).toBe(false);
    const r = updateEmployeeSchema.safeParse({ fullName: 'Dewi L', password: '' });
    expect(r.success && r.data.password).toBeUndefined();
  });

  it('filter absensi: tanggal akhir tidak boleh sebelum tanggal awal, limit maks 100', () => {
    expect(issues(attendanceQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-01' }))).toEqual({ to: 'Tanggal akhir harus setelah tanggal awal' });
    expect(attendanceQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(attendanceQuerySchema.parse({ page: '2' })).toMatchObject({ page: 2, limit: 10 });
  });

  it('rekap: bulan harus YYYY-MM yang valid', () => {
    expect(recapQuerySchema.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(recapQuerySchema.safeParse({ month: '2026-11' }).success).toBe(true);
  });

  it('cuti: tanggal selesai >= mulai dan maksimal 31 hari', () => {
    const base = { type: 'CUTI', reason: 'Acara keluarga' };
    expect(issues(createLeaveSchema.safeParse({ ...base, startDate: '2026-11-10', endDate: '2026-11-09' }))).toHaveProperty('endDate');
    expect(createLeaveSchema.safeParse({ ...base, startDate: '2026-11-01', endDate: '2026-12-01' }).success).toBe(true); // 31 hari
    expect(createLeaveSchema.safeParse({ ...base, startDate: '2026-11-01', endDate: '2026-12-02' }).success).toBe(false); // 32 hari
    expect(createLeaveSchema.safeParse({ ...base, type: 'LIBUR', startDate: '2026-11-01', endDate: '2026-11-01' }).success).toBe(false);
  });

  it('koreksi: jam harus HH:mm 24 jam', () => {
    const base = { date: '2026-11-19', type: 'CHECK_OUT', reason: 'Lupa check-out' };
    expect(createCorrectionSchema.safeParse({ ...base, time: '17:05' }).success).toBe(true);
    expect(createCorrectionSchema.safeParse({ ...base, time: '24:00' }).success).toBe(false);
    expect(createCorrectionSchema.safeParse({ ...base, time: '7:05' }).success).toBe(false);
  });

  it('review: penolakan wajib menyertakan alasan, persetujuan tidak', () => {
    expect(reviewRequestSchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
    expect(issues(reviewRequestSchema.safeParse({ status: 'REJECTED', note: '  ' }))).toHaveProperty('note');
    expect(reviewRequestSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });
});
