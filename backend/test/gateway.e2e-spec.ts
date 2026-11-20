import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { ATTENDANCE_SERVICE, AUTH_SERVICE, EMPLOYEE_SERVICE, LEAVE_SERVICE, REDIS } from '@app/common';
import { AppModule } from '../apps/api-gateway/src/app.module';
import { FakeRedis, fakeClient } from './helpers';

/**
 * Test end-to-end API gateway lewat HTTP. Microservice TCP dan Redis diganti versi palsu,
 * jadi yang diuji adalah lapisan HTTP: auth guard, role, validasi Zod, upload foto, limit login, CSV.
 */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
const UPLOAD_ROOT = process.env.UPLOAD_DIR!;

const users: Record<string, { id: number; email: string; role: string; mustChangePassword: boolean }> = {
  'token-hr': { id: 1, email: 'hr@dexa.local', role: 'HR_ADMIN', mustChangePassword: false },
  'token-budi': { id: 2, email: 'budi@dexa.local', role: 'EMPLOYEE', mustChangePassword: false },
  'token-rina': { id: 3, email: 'rina@dexa.local', role: 'EMPLOYEE', mustChangePassword: false },
  // akun baru: password masih NIP
  'token-dewi': { id: 4, email: 'dewi@dexa.local', role: 'EMPLOYEE', mustChangePassword: true },
};
const employeeOfUser: Record<number, number> = { 1: 10, 2: 20, 3: 30, 4: 40 };

describe('API gateway (e2e)', () => {
  let app: INestApplication;
  const redis = new FakeRedis();
  const auth = fakeClient({
    'auth.verify': ({ token }) => {
      if (!users[token]) throw { statusCode: 401, message: 'Sesi tidak valid atau sudah berakhir' };
      return users[token];
    },
    'auth.login': ({ email, userId, password }) => {
      if (password !== 'Benar123!' || (!email && userId !== 2)) throw { statusCode: 401, message: 'Email/NIP atau password salah' };
      return { accessToken: 'token-budi', user: { id: 2, email: 'budi@dexa.local', role: 'EMPLOYEE', mustChangePassword: false } };
    },
  });
  const employees = fakeClient({
    'employee.find_by_user': ({ userId }) => ({ id: employeeOfUser[userId], userId }),
    'employee.find_by_nip': ({ nip }) => {
      if (nip !== '20260002') throw { statusCode: 404, message: 'NIP tidak ditemukan' };
      return { id: 20, userId: 2 };
    },
    'employee.find_one': ({ id }) => ({ id, userId: id === 10 ? 1 : 2, nip: '20260002' }),
    'employee.find_all': (q) => ({ data: [], meta: { ...q, total: 0, totalPages: 1 } }),
    'position.list': (q) => [{ id: 1, name: 'QA Engineer', departmentId: q.departmentId ?? 1, department: 'IT' }],
    'employee.create': (dto) => ({ id: 99, ...dto, password: undefined }),
  });
  const attendance = fakeClient({
    'attendance.submit': (d) => ({ id: 1, ...d, isLate: false }),
    'attendance.today': ({ employeeId }) => ({ employeeId, checkIn: null, checkOut: null }),
    'attendance.find_one': ({ id }) => {
      if (id === 404) throw { statusCode: 404, message: 'Data absensi tidak ditemukan' };
      return { id, employeeId: 20, photoPath: 'attendance/2026-11/foto-budi.jpg' };
    },
    'attendance.export': () => [
      { attendanceDate: '2026-11-20', recordedAt: '2026-11-20T01:05:00.000Z', type: 'CHECK_IN', isLate: false, notes: '=cmd|calc', correctionId: null,
        employee: { id: 20, nip: '20260002', fullName: 'Budi Santoso', department: 'IT', position: 'Engineer' } },
    ],
  });
  const leave = fakeClient({ 'leave.review': (d) => ({ id: d.id, status: d.dto.status, reviewer: d.reviewer }) });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_SERVICE).useValue(auth)
      .overrideProvider(EMPLOYEE_SERVICE).useValue(employees)
      .overrideProvider(ATTENDANCE_SERVICE).useValue(attendance)
      .overrideProvider(LEAVE_SERVICE).useValue(leave)
      .overrideProvider(REDIS).useValue(redis)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    fs.mkdirSync(path.join(UPLOAD_ROOT, 'attendance/2026-11'), { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_ROOT, 'attendance/2026-11/foto-budi.jpg'), JPEG);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(UPLOAD_ROOT, { recursive: true, force: true });
  });

  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const uploaded = () => fs.readdirSync(path.join(UPLOAD_ROOT, 'attendance'), { recursive: true }).filter((f) => String(f).endsWith('.jpg') && !String(f).includes('foto-budi'));

  describe('auth guard & role', () => {
    it('tanpa token: 401', async () => {
      const res = await api().get('/api/employees').expect(401);
      expect(res.body.message).toBe('Silakan login terlebih dahulu');
    });

    it('token tidak valid: 401 dari auth-service', async () => {
      await api().get('/api/employees').set(as('palsu')).expect(401);
    });

    it('karyawan membuka endpoint HRD: 403', async () => {
      await api().get('/api/employees').set(as('token-budi')).expect(403);
      await api().get('/api/attendance').set(as('token-budi')).expect(403);
    });

    it('HRD boleh, query divalidasi dan diubah tipenya sebelum dikirim ke service', async () => {
      await api().get('/api/employees?page=2&limit=5').set(as('token-hr')).expect(200);
      expect(employees.calls.at(-1)).toEqual({ pattern: 'employee.find_all', data: { page: 2, limit: 5, status: 'all' } });
    });
  });

  describe('validasi Zod', () => {
    it('error per field dengan format { statusCode, message, errors }', async () => {
      const res = await api().post('/api/employees').set(as('token-hr')).send({ nip: '123', email: 'salah' }).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Validasi gagal' });
      expect(res.body.errors).toMatchObject({ nip: 'NIP minimal 8 digit', email: 'Format email tidak valid', departmentId: 'Departemen wajib dipilih' });
    });

    it('daftar jabatan: filter departmentId divalidasi lalu diteruskan sebagai angka', async () => {
      const res = await api().get('/api/positions?departmentId=3').set(as('token-hr')).expect(200);
      expect(res.body[0]).toMatchObject({ departmentId: 3 });
      const bad = await api().get('/api/positions?departmentId=abc').set(as('token-hr')).expect(400);
      expect(bad.body.errors).toEqual({ departmentId: 'Departemen tidak valid' });
      await api().get('/api/positions').set(as('token-budi')).expect(403);
    });

    it('param id harus angka positif', async () => {
      await api().get('/api/employees/abc').set(as('token-hr')).expect(400);
    });

    it('penolakan pengajuan wajib beralasan; reviewer dikirim ke service', async () => {
      const bad = await api().patch('/api/leave/5/review').set(as('token-hr')).send({ status: 'REJECTED' }).expect(400);
      expect(bad.body.errors).toEqual({ note: 'Alasan penolakan wajib diisi' });
      const ok = await api().patch('/api/leave/5/review').set(as('token-hr')).send({ status: 'APPROVED' }).expect(200);
      expect(ok.body).toEqual({ id: 5, status: 'APPROVED', reviewer: { userId: 1, employeeId: 10 } });
    });
  });

  describe('login & pembatasan percobaan', () => {
    beforeEach(() => redis.store.clear());

    it('login berhasil menyertakan profil karyawan', async () => {
      const res = await api().post('/api/auth/login').send({ identifier: 'Budi@Dexa.local', password: 'Benar123!' }).expect(200);
      expect(res.body).toMatchObject({ accessToken: 'token-budi', user: { id: 2, employee: { id: 20 } } });
    });

    it('login dengan NIP; NIP tak dikenal = 401, bukan 404', async () => {
      await api().post('/api/auth/login').send({ identifier: '20260002', password: 'Benar123!' }).expect(200);
      const res = await api().post('/api/auth/login').send({ identifier: '20269999', password: 'Benar123!' }).expect(401);
      expect(res.body.message).toBe('Email/NIP atau password salah');
    });

    it('percobaan ke-6 setelah 5 kali salah: 429, walau password benar', async () => {
      for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ identifier: 'budi@dexa.local', password: 'salah' }).expect(401);
      const res = await api().post('/api/auth/login').send({ identifier: 'budi@dexa.local', password: 'Benar123!' }).expect(429);
      expect(res.body.message).toMatch(/Coba lagi dalam 15 menit/);
    });

    it('Redis mati: login tetap jalan (fail-open)', async () => {
      redis.down = true;
      try {
        await api().post('/api/auth/login').send({ identifier: 'budi@dexa.local', password: 'Benar123!' }).expect(200);
      } finally {
        redis.down = false;
      }
    });
  });

  describe('akun baru (password masih NIP)', () => {
    it('tetap bisa memakai aplikasi; status ganti password hanya jadi peringatan di frontend', async () => {
      await api().get('/api/attendance/today').set(as('token-dewi')).expect(200);
      auth.handlers['auth.change_password'] = () => ({ success: true });
      await api().patch('/api/auth/password').set(as('token-dewi')).send({ currentPassword: '20260045', newPassword: 'Rahasia123' }).expect(200);
    });
  });

  describe('absen dengan foto', () => {
    it('tanpa foto: 400 di field photo', async () => {
      const res = await api().post('/api/attendance').set(as('token-budi')).field('type', 'CHECK_IN').expect(400);
      expect(res.body.errors).toEqual({ photo: 'Foto bukti WFH wajib diunggah' });
    });

    it('file bukan gambar ditolak dan tidak tertinggal di disk', async () => {
      const before = uploaded().length;
      await api().post('/api/attendance').set(as('token-budi')).field('type', 'CHECK_IN')
        .attach('photo', Buffer.from('<?php system($_GET[1]); ?>'), { filename: 'foto.jpg', contentType: 'image/jpeg' }).expect(400);
      expect(uploaded().length).toBe(before);
    });

    it('tipe absen salah: 400 dan foto dihapus lagi', async () => {
      const before = uploaded().length;
      const res = await api().post('/api/attendance').set(as('token-budi')).field('type', 'ISTIRAHAT')
        .attach('photo', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' }).expect(400);
      expect(res.body.errors).toHaveProperty('type');
      expect(uploaded().length).toBe(before);
    });

    it('berhasil: foto disimpan, service menerima employeeId dari token dan path relatif', async () => {
      const res = await api().post('/api/attendance').set(as('token-budi')).field('type', 'CHECK_IN').field('notes', 'Mulai kerja')
        .attach('photo', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' }).expect(201);
      expect(res.body).toMatchObject({ employeeId: 20, type: 'CHECK_IN', notes: 'Mulai kerja' });
      expect(res.body.photoPath).toMatch(/^attendance\/\d{4}-\d{2}\/[0-9a-f-]{36}\.jpg$/);
      expect(fs.existsSync(path.join(UPLOAD_ROOT, res.body.photoPath))).toBe(true);
    });
  });

  describe('foto bukti hanya untuk pemilik & HRD', () => {
    it('pemilik dan HRD mendapat file gambar', async () => {
      const own = await api().get('/api/attendance/1/photo').set(as('token-budi')).expect(200);
      expect(own.headers['content-type']).toBe('image/jpeg');
      expect(own.headers['cache-control']).toBe('private, max-age=86400');
      await api().get('/api/attendance/1/photo').set(as('token-hr')).expect(200);
    });

    it('karyawan lain mendapat 404 (bukan 403) agar id tidak bisa ditebak', async () => {
      await api().get('/api/attendance/1/photo').set(as('token-rina')).expect(404);
    });

    it('tanpa token: 401; folder upload tidak disajikan statis', async () => {
      await api().get('/api/attendance/1/photo').expect(401);
      await api().get('/uploads/attendance/2026-11/foto-budi.jpg').expect(404);
    });

    it('id tidak ada: 404 dari attendance-service', async () => {
      await api().get('/api/attendance/404/photo').set(as('token-hr')).expect(404);
    });
  });

  describe('export CSV', () => {
    it('HRD mendapat CSV dengan nama file sesuai filter dan formula di-escape', async () => {
      const res = await api().get('/api/attendance/export?from=2026-11-01&to=2026-11-30').set(as('token-hr')).expect(200);
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(res.headers['content-disposition']).toBe('attachment; filename="absensi_2026-11-01_2026-11-30.csv"');
      const [header, line] = res.text.replace('﻿', '').split('\r\n');
      expect(header).toBe('No,Tanggal,Jam,NIP,Nama,Departemen,Jabatan,Tipe,Status,Catatan,Sumber');
      expect(line).toBe("1,2026-11-20,08:05,20260002,Budi Santoso,IT,Engineer,Check-in,Tepat waktu,'=cmd|calc,Foto");
    });

    it('format=xlsx menghasilkan file Excel: judul, header, angka & tanggal asli, teks berawalan = tetap teks', async () => {
      const res = await api().get('/api/attendance/export?format=xlsx&from=2026-11-01&to=2026-11-30').set(as('token-hr'))
        .buffer(true).parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c: Buffer) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); })
        .expect(200);
      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toBe('attachment; filename="absensi_2026-11-01_2026-11-30.xlsx"');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);
      const ws = wb.worksheets[0];
      expect(ws.getCell('A1').value).toBe('Absensi WFH Karyawan · 01/11/2026 – 30/11/2026');
      expect(ws.getRow(3).getCell(1).value).toBe('No');
      expect(ws.getCell('A4').value).toBe(1);
      expect(ws.getCell('B4').value).toEqual(new Date('2026-11-20T00:00:00Z'));
      expect(ws.getCell('J4').value).toBe('=cmd|calc'); // disimpan sebagai teks, bukan formula
      expect(ws.getCell('J4').formula).toBeUndefined();
    });

    it('format tidak dikenal: 400 di field format', async () => {
      const res = await api().get('/api/attendance/export?format=pdf').set(as('token-hr')).expect(400);
      expect(res.body.errors).toEqual({ format: 'Format export harus csv atau xlsx' });
    });

    it('karyawan tidak boleh export: 403', async () => {
      await api().get('/api/attendance/export').set(as('token-budi')).expect(403);
    });
  });
});
