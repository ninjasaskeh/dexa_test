import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import request from 'supertest';
import { ATTENDANCE_SERVICE, AUTH_SERVICE, EMPLOYEE_SERVICE, LEAVE_SERVICE, REDIS } from '@app/common';
import { AppModule } from '../apps/api-gateway/src/app.module';
import { FakeRedis, fakeClient } from './helpers';

/**
 * Test end-to-end API gateway lewat HTTP. Microservice TCP dan Redis diganti versi palsu,
 * jadi yang diuji adalah lapisan HTTP: auth guard, role, validasi Zod, upload foto, limit login, CSV.
 */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
const UPLOAD_ROOT = process.env.UPLOAD_DIR!;

const users: Record<string, { id: number; email: string; role: string }> = {
  'token-hr': { id: 1, email: 'hr@dexa.local', role: 'HR_ADMIN' },
  'token-budi': { id: 2, email: 'budi@dexa.local', role: 'EMPLOYEE' },
  'token-rina': { id: 3, email: 'rina@dexa.local', role: 'EMPLOYEE' },
};
const employeeOfUser: Record<number, number> = { 1: 10, 2: 20, 3: 30 };

describe('API gateway (e2e)', () => {
  let app: INestApplication;
  const redis = new FakeRedis();
  const auth = fakeClient({
    'auth.verify': ({ token }) => {
      if (!users[token]) throw { statusCode: 401, message: 'Sesi tidak valid atau sudah berakhir' };
      return users[token];
    },
    'auth.login': ({ email, password }) => {
      if (password !== 'Benar123!') throw { statusCode: 401, message: 'Email atau password salah' };
      return { accessToken: 'token-budi', user: { id: 2, email, role: 'EMPLOYEE' } };
    },
  });
  const employees = fakeClient({
    'employee.find_by_user': ({ userId }) => ({ id: employeeOfUser[userId], userId }),
    'employee.find_all': (q) => ({ data: [], meta: { ...q, total: 0, totalPages: 1 } }),
    'employee.create': (dto) => ({ id: 99, ...dto, password: undefined }),
  });
  const attendance = fakeClient({
    'attendance.submit': (d) => ({ id: 1, ...d, isLate: false }),
    'attendance.find_one': ({ id }) => {
      if (id === 404) throw { statusCode: 404, message: 'Data absensi tidak ditemukan' };
      return { id, employeeId: 20, photoPath: 'attendance/2026-11/foto-budi.jpg' };
    },
    'attendance.export': () => [
      { attendanceDate: '2026-11-20', recordedAt: '2026-11-20T01:05:00.000Z', type: 'CHECK_IN', isLate: false, notes: '=cmd|calc', correctionId: null,
        employee: { id: 20, employeeCode: 'EMP-001', fullName: 'Budi Santoso', department: 'IT', position: 'Engineer' } },
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
      const res = await api().post('/api/employees').set(as('token-hr')).send({ employeeCode: 'x', email: 'salah' }).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Validasi gagal' });
      expect(res.body.errors).toMatchObject({ employeeCode: 'Kode karyawan minimal 3 karakter', email: 'Format email tidak valid' });
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
      const res = await api().post('/api/auth/login').send({ email: 'Budi@Dexa.local', password: 'Benar123!' }).expect(200);
      expect(res.body).toMatchObject({ accessToken: 'token-budi', user: { id: 2, employee: { id: 20 } } });
    });

    it('percobaan ke-6 setelah 5 kali salah: 429, walau password benar', async () => {
      for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ email: 'budi@dexa.local', password: 'salah' }).expect(401);
      const res = await api().post('/api/auth/login').send({ email: 'budi@dexa.local', password: 'Benar123!' }).expect(429);
      expect(res.body.message).toMatch(/Coba lagi dalam 15 menit/);
    });

    it('Redis mati: login tetap jalan (fail-open)', async () => {
      redis.down = true;
      try {
        await api().post('/api/auth/login').send({ email: 'budi@dexa.local', password: 'Benar123!' }).expect(200);
      } finally {
        redis.down = false;
      }
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
      expect(header).toBe('Tanggal,Jam,Kode Karyawan,Nama,Departemen,Jabatan,Tipe,Status,Catatan,Sumber');
      expect(line).toBe("2026-11-20,08:05,EMP-001,Budi Santoso,IT,Engineer,Check-in,Tepat waktu,'=cmd|calc,Foto");
    });

    it('karyawan tidak boleh export: 403', async () => {
      await api().get('/api/attendance/export').set(as('token-budi')).expect(403);
    });
  });
});
