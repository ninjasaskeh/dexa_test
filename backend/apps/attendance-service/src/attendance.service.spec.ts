import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttendanceType, EMPLOYEE_SERVICE, LEAVE_SERVICE, LeaveType } from '@app/common';
import { FakeRedis, fakeClient, fakeConfig, fakeQb, memRepo, restoreTime, rpcErrorOf, setNow } from '../../../test/helpers';
import { Attendance } from './attendance.entity';
import { AttendanceService } from './attendance.service';
import { CalendarService } from './calendar.service';
import { Holiday } from './holiday.entity';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const row = (id: number, employeeId: number, date: string, type: AttendanceType, hhmm: string) =>
  ({ id, employeeId, attendanceDate: date, type, recordedAt: at(date, hhmm), photoPath: `attendance/2026-11/${id}.jpg`, notes: null, correctionId: null });

const emp = (id: number, joinDate: string, department = 'IT') =>
  ({ id, nip: `2026000${id}`, fullName: `Karyawan ${id}`, department, position: 'Staff', joinDate });

async function setup(opts: { rows?: any[]; holidays?: any[]; employees?: any[]; leaves?: any[]; leaveDown?: boolean } = {}) {
  const repo = memRepo<Attendance>(opts.rows ?? []);
  const holidays = memRepo<Holiday>(opts.holidays ?? []);
  const employees = fakeClient({
    'employee.active_lite': () => opts.employees ?? [],
    'employee.find_by_ids': ({ ids }) => (opts.employees ?? []).filter((e) => ids.includes(e.id)),
  });
  const leaves = fakeClient({
    'leave.approved_in_range': ({ employeeIds }) => {
      if (opts.leaveDown) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      return (opts.leaves ?? []).filter((l) => !employeeIds || employeeIds.includes(l.employeeId));
    },
  });
  const moduleRef = await Test.createTestingModule({
    providers: [
      AttendanceService,
      { provide: CalendarService, useValue: new CalendarService(holidays as any, fakeConfig({ WORK_START_TIME: '09:00', CHECK_OUT_MAX_TIME: '22:00' }), new FakeRedis() as any) },
      { provide: getRepositoryToken(Attendance), useValue: repo },
      { provide: EMPLOYEE_SERVICE, useValue: employees },
      { provide: LEAVE_SERVICE, useValue: leaves },
    ],
  }).compile();
  return { service: moduleRef.get(AttendanceService), repo };
}

afterEach(restoreTime);

describe('AttendanceService.submit (check-in / check-out)', () => {
  const photo = { photoPath: 'attendance/2026-11/a.jpg' };

  it('check-in setelah jam masuk tercatat terlambat, tanggal & jam dari server', async () => {
    setNow('2026-11-20 09:01');
    const { service, repo } = await setup();
    const res = await service.submit({ employeeId: 1, type: AttendanceType.CHECK_IN, notes: 'Mulai kerja', ...photo });
    expect(res).toMatchObject({ employeeId: 1, attendanceDate: '2026-11-20', isLate: true, notes: 'Mulai kerja' });
    expect(repo.rows[0].recordedAt).toEqual(at('2026-11-20', '09:01'));
  });

  it('check-in tepat di menit jam masuk (09:00:59) belum terlambat', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-11-20T09:00:59+07:00'));
    const { service } = await setup();
    await expect(service.submit({ employeeId: 1, type: AttendanceType.CHECK_IN, ...photo })).resolves.toMatchObject({ isLate: false });
  });

  it('menolak check-in kedua di hari yang sama (409)', async () => {
    setNow('2026-11-20 10:00');
    const { service } = await setup({ rows: [row(1, 1, '2026-11-20', AttendanceType.CHECK_IN, '08:00')] });
    await expect(rpcErrorOf(service.submit({ employeeId: 1, type: AttendanceType.CHECK_IN, ...photo }))).resolves.toEqual({
      statusCode: 409, message: 'Anda sudah check-in hari ini',
    });
  });

  it('menolak check-out sebelum check-in (400)', async () => {
    setNow('2026-11-20 17:00');
    const { service } = await setup();
    expect((await rpcErrorOf(service.submit({ employeeId: 1, type: AttendanceType.CHECK_OUT, ...photo }))).statusCode).toBe(400);
  });

  it('check-in kemarin tidak membuka check-out hari ini', async () => {
    setNow('2026-11-20 17:00');
    const { service } = await setup({ rows: [row(1, 1, '2026-11-19', AttendanceType.CHECK_IN, '08:00')] });
    expect((await rpcErrorOf(service.submit({ employeeId: 1, type: AttendanceType.CHECK_OUT, ...photo }))).statusCode).toBe(400);
  });

  it('menolak absen setelah CHECK_OUT_MAX_TIME agar hari tidak menyeberang tengah malam', async () => {
    setNow('2026-11-20 22:01');
    const { service } = await setup({ rows: [row(1, 1, '2026-11-20', AttendanceType.CHECK_IN, '08:00')] });
    await expect(rpcErrorOf(service.submit({ employeeId: 1, type: AttendanceType.CHECK_OUT, ...photo }))).resolves.toEqual({
      statusCode: 400, message: 'Absensi hari ini sudah ditutup (batas pukul 22:00)',
    });
  });

  it('check-out berhasil setelah check-in', async () => {
    setNow('2026-11-20 17:05');
    const { service, repo } = await setup({ rows: [row(1, 1, '2026-11-20', AttendanceType.CHECK_IN, '08:00')] });
    await expect(service.submit({ employeeId: 1, type: AttendanceType.CHECK_OUT, ...photo })).resolves.toMatchObject({ type: 'CHECK_OUT', isLate: false });
    expect(repo.rows).toHaveLength(2);
  });
});

describe('AttendanceService.today', () => {
  it('tetap jalan walau leave-service mati, dan memberi status hari libur', async () => {
    setNow('2026-11-21 10:00'); // Sabtu
    const { service } = await setup({ leaveDown: true });
    await expect(service.today(1)).resolves.toMatchObject({ date: '2026-11-21', isWorkDay: false, leave: null, closed: false, checkIn: null });
  });

  it('menandai closed setelah jam batas', async () => {
    setNow('2026-11-20 22:30');
    const { service } = await setup();
    expect((await service.today(1)).closed).toBe(true);
  });
});

describe('AttendanceService.recap (rekap bulanan)', () => {
  // Kamis 2026-11-20 jam 10:00. Libur 18 Nov (Rabu).
  const holidays = [{ id: 1, date: '2026-11-18', name: 'Libur Uji', source: 'MANUAL', isActive: true }];

  it('menghitung hadir, terlambat, tanpa check-out, cuti, alpa, dan jam kerja per karyawan', async () => {
    setNow('2026-11-20 10:00');
    const { service } = await setup({
      holidays,
      employees: [emp(1, '2026-11-16'), emp(2, '2026-11-01'), emp(3, '2026-11-20')],
      rows: [
        row(1, 1, '2026-11-16', AttendanceType.CHECK_IN, '08:50'),
        row(2, 1, '2026-11-16', AttendanceType.CHECK_OUT, '16:50'), // 8 jam
        row(3, 1, '2026-11-17', AttendanceType.CHECK_IN, '09:15'), // terlambat, lupa check-out
        row(4, 1, '2026-11-18', AttendanceType.CHECK_IN, '10:00'), // masuk di hari libur
        row(5, 3, '2026-11-20', AttendanceType.CHECK_IN, '08:30'), // hari ini sudah check-in
      ],
      leaves: [{ id: 1, employeeId: 1, type: LeaveType.SAKIT, startDate: '2026-11-19', endDate: '2026-11-19' }],
    });
    const r = await service.recap();
    expect(r).toMatchObject({ month: '2026-11', from: '2026-11-01', to: '2026-11-20', holidays: [{ date: '2026-11-18', name: 'Libur Uji' }] });
    // 1–20 Nov: 14 hari Senin–Jumat, dikurangi libur 18 Nov
    expect(r.workDays).toBe(14);

    const byId = new Map(r.data.map((d) => [d.employee.id, d]));
    // gabung 16 Nov: 16, 17, 19 dihitung; 18 libur; 20 (hari ini) belum check-in jadi belum dihitung.
    // Tanpa check-out: 17 Nov dan 18 Nov (masuk di hari libur juga harus check-out)
    expect(byId.get(1)).toMatchObject({
      workDays: 3, present: 2, late: 1, noCheckOut: 2, leave: { CUTI: 0, IZIN: 0, SAKIT: 1 }, absent: 0, extraDays: 1, workMinutes: 480,
    });
    // gabung 1 Nov, tidak pernah absen: 13 hari kerja sampai kemarin, semuanya alpa
    expect(byId.get(2)).toMatchObject({ workDays: 13, present: 0, absent: 13 });
    // gabung hari ini dan sudah check-in: hari ini ikut dihitung
    expect(byId.get(3)).toMatchObject({ workDays: 1, present: 1, absent: 0, late: 0 });
    expect(byId.get(1)!.employee).not.toHaveProperty('joinDate');
  });

  it('bulan lalu dihitung penuh sampai akhir bulan', async () => {
    setNow('2026-11-20 10:00');
    const { service } = await setup({ employees: [emp(1, '2026-01-01')] });
    const r = await service.recap('2026-10');
    expect([r.from, r.to, r.workDays, r.data[0].absent]).toEqual(['2026-10-01', '2026-10-31', 22, 22]);
  });

  it('menolak bulan yang belum berjalan', async () => {
    setNow('2026-11-20 10:00');
    const { service } = await setup();
    expect((await rpcErrorOf(service.recap('2026-12'))).statusCode).toBe(400);
  });
});

describe('AttendanceService.summary (dashboard HRD)', () => {
  it('memisahkan yang hadir, cuti, dan belum check-in', async () => {
    setNow('2026-11-20 10:00');
    const { service, repo } = await setup({
      employees: [emp(1, '2026-01-01', 'IT'), emp(2, '2026-01-01', 'IT'), emp(3, '2026-01-01', 'Finance')],
      rows: [row(1, 1, '2026-11-20', AttendanceType.CHECK_IN, '09:30')],
      leaves: [{ id: 1, employeeId: 2, type: LeaveType.CUTI, startDate: '2026-11-20', endDate: '2026-11-21' }],
    });
    (repo as any).createQueryBuilder = () => fakeQb({ getRawMany: [{ date: '2026-11-20', checkIn: '1', checkOut: '0', late: '1' }] });
    const s = await service.summary();
    expect(s).toMatchObject({ activeEmployees: 3, presentToday: 1, lateToday: 1, onTimeToday: 0, isWorkDay: true });
    expect(s.onLeave.map((e) => [e.id, e.leaveType])).toEqual([[2, 'CUTI']]);
    expect(s.notCheckedIn.map((e) => e.id)).toEqual([3]);
    expect(s.departments).toEqual([{ department: 'IT', total: 2, present: 1 }, { department: 'Finance', total: 1, present: 0 }]);
    expect(s.trend).toHaveLength(7);
    expect(s.trend.at(-1)).toMatchObject({ date: '2026-11-20', checkIn: 1, late: 1, onTime: 0 });
  });

  it('di hari libur tidak ada yang dianggap belum check-in', async () => {
    setNow('2026-11-22 10:00'); // Minggu
    const { service, repo } = await setup({ employees: [emp(1, '2026-01-01')] });
    (repo as any).createQueryBuilder = () => fakeQb({ getRawMany: [] });
    const s = await service.summary();
    expect([s.isWorkDay, s.notCheckedIn]).toEqual([false, []]);
  });
});
