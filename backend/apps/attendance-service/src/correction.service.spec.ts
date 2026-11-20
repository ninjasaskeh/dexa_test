import { AttendanceType, RequestStatus } from '@app/common';
import { FakeRedis, fakeClient, fakeConfig, memRepo, restoreTime, rpcErrorOf, setNow } from '../../../test/helpers';
import { Attendance } from './attendance.entity';
import { CalendarService } from './calendar.service';
import { AttendanceCorrection } from './correction.entity';
import { CorrectionService } from './correction.service';

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const att = (id: number, date: string, type: AttendanceType, hhmm: string, employeeId = 1) =>
  ({ id, employeeId, attendanceDate: date, type, recordedAt: at(date, hhmm), photoPath: 'x.jpg', notes: null, correctionId: null });
const pending = (id: number, date: string, type: AttendanceType, time: string, employeeId = 1) =>
  ({ id, employeeId, attendanceDate: date, type, requestedTime: `${time}:00`, originalRecordedAt: null, reason: 'Lupa absen', status: RequestStatus.PENDING });

function setup(opts: { attendances?: any[]; corrections?: any[] } = {}) {
  const corrections = memRepo<AttendanceCorrection>(opts.corrections ?? []);
  const attendances = memRepo<Attendance>(opts.attendances ?? []);
  const repoOf = (entity: unknown) => (entity === Attendance ? attendances : corrections);
  // transaksi: EntityManager palsu yang meneruskan ke repo di memori
  const manager = {
    find: jest.fn((entity: unknown, opts: any) => repoOf(entity).find(opts)),
    update: jest.fn((entity: unknown, crit: any, patch: any) => repoOf(entity).update(crit, patch)),
    insert: jest.fn((entity: unknown, data: any) => repoOf(entity).insert(data)),
  };
  (corrections as any).manager = { transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)) };
  const calendar = new CalendarService(memRepo() as any, fakeConfig({ CHECK_OUT_MAX_TIME: '22:00' }), new FakeRedis() as any);
  const service = new CorrectionService(corrections as any, attendances as any, fakeClient() as any, calendar);
  return { service, corrections, attendances, manager };
}

const hr = { userId: 99, employeeId: 5 };

beforeEach(() => setNow('2026-11-20 10:00'));
afterEach(restoreTime);

describe('CorrectionService.create', () => {
  const dto = (p: Partial<{ date: string; type: AttendanceType; time: string }>) =>
    ({ date: '2026-11-19', type: AttendanceType.CHECK_OUT, time: '17:00', reason: 'Lupa check-out', ...p });

  it.each([
    ['tanggal di masa depan', dto({ date: '2026-11-21' }), 'Tanggal koreksi tidak boleh melewati hari ini'],
    ['lebih dari 30 hari lalu', dto({ date: '2026-10-20', type: AttendanceType.CHECK_IN, time: '08:00' }), 'Koreksi hanya bisa diajukan untuk 30 hari terakhir'],
    ['jam melewati batas harian', dto({ time: '22:30' }), 'Jam absen tidak boleh melewati batas 22:00'],
    ['jam hari ini yang belum terlewati', dto({ date: '2026-11-20', type: AttendanceType.CHECK_IN, time: '10:30' }), 'Jam koreksi belum terlewati'],
    ['check-out tanpa check-in', dto({}), 'Belum ada check-in pada tanggal ini. Ajukan koreksi check-in terlebih dahulu.'],
  ])('menolak %s', async (_label, input, message) => {
    const { service } = setup();
    await expect(rpcErrorOf(service.create(1, input))).resolves.toEqual({ statusCode: 400, message });
  });

  it('tepat 30 hari lalu masih boleh', async () => {
    const { service } = setup();
    await expect(service.create(1, dto({ date: '2026-10-21', type: AttendanceType.CHECK_IN, time: '08:00' }))).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('jam check-out harus setelah check-in yang tercatat', async () => {
    const { service } = setup({ attendances: [att(1, '2026-11-19', AttendanceType.CHECK_IN, '08:30')] });
    expect((await rpcErrorOf(service.create(1, dto({ time: '08:30' })))).message).toBe('Jam check-out harus setelah jam check-in');
  });

  it('jam check-in harus sebelum check-out yang tercatat', async () => {
    const { service } = setup({
      attendances: [att(1, '2026-11-19', AttendanceType.CHECK_IN, '08:30'), att(2, '2026-11-19', AttendanceType.CHECK_OUT, '17:00')],
    });
    expect((await rpcErrorOf(service.create(1, dto({ type: AttendanceType.CHECK_IN, time: '17:30' })))).message).toBe('Jam check-in harus sebelum jam check-out');
  });

  it('check-out boleh diajukan bila koreksi check-in masih menunggu', async () => {
    const { service } = setup({ corrections: [pending(1, '2026-11-19', AttendanceType.CHECK_IN, '08:00')] });
    await expect(service.create(1, dto({ time: '17:00' }))).resolves.toMatchObject({ type: 'CHECK_OUT', requestedTime: '17:00' });
  });

  it('menolak pengajuan ganda yang masih menunggu (409)', async () => {
    const { service } = setup({ corrections: [pending(1, '2026-11-19', AttendanceType.CHECK_IN, '08:00')] });
    expect((await rpcErrorOf(service.create(1, dto({ type: AttendanceType.CHECK_IN, time: '08:10' })))).statusCode).toBe(409);
  });

  it('menolak jam yang sama dengan yang sudah tercatat', async () => {
    const { service } = setup({ attendances: [att(1, '2026-11-19', AttendanceType.CHECK_IN, '08:30')] });
    expect((await rpcErrorOf(service.create(1, dto({ type: AttendanceType.CHECK_IN, time: '08:30' })))).message).toBe('Jam koreksi sama dengan jam yang sudah tercatat');
  });

  it('menyimpan jam lama dan mengembalikan jam dalam format HH:mm', async () => {
    const { service, corrections } = setup({ attendances: [att(1, '2026-11-19', AttendanceType.CHECK_IN, '09:40')] });
    const res = await service.create(1, dto({ type: AttendanceType.CHECK_IN, time: '08:55' }));
    expect(res).toMatchObject({ requestedTime: '08:55', originalRecordedAt: at('2026-11-19', '09:40'), status: 'PENDING' });
    expect(corrections.rows[0].requestedTime).toBe('08:55:00');
  });
});

describe('CorrectionService.review', () => {
  it('menyetujui koreksi check-in yang belum ada: membuat absen tanpa foto dan menautkan correction_id', async () => {
    const { service, attendances } = setup({ corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_IN, '08:05')] });
    const res = await service.review(7, hr, { status: RequestStatus.APPROVED });
    expect(res).toMatchObject({ status: 'APPROVED', reviewedBy: 99, requestedTime: '08:05' });
    expect(attendances.rows).toEqual([
      expect.objectContaining({ employeeId: 1, type: 'CHECK_IN', attendanceDate: '2026-11-19', recordedAt: at('2026-11-19', '08:05'), photoPath: null, correctionId: 7 }),
    ]);
  });

  it('menyetujui koreksi jam yang sudah ada: mengubah jam dan mencatat jam lama', async () => {
    const { service, attendances, corrections } = setup({
      attendances: [att(3, '2026-11-19', AttendanceType.CHECK_IN, '08:00'), att(4, '2026-11-19', AttendanceType.CHECK_OUT, '12:00')],
      corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_OUT, '17:10')],
    });
    await service.review(7, hr, { status: RequestStatus.APPROVED, note: 'OK' });
    expect(attendances.rows.find((a) => a.id === 4)).toMatchObject({ recordedAt: at('2026-11-19', '17:10'), correctionId: 7, photoPath: 'x.jpg' });
    expect(corrections.rows[0]).toMatchObject({ originalRecordedAt: at('2026-11-19', '12:00'), reviewNote: 'OK' });
  });

  it('check-out tidak bisa disetujui sebelum check-in-nya ada', async () => {
    const { service, attendances } = setup({ corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_OUT, '17:00')] });
    expect((await rpcErrorOf(service.review(7, hr, { status: RequestStatus.APPROVED }))).statusCode).toBe(400);
    expect(attendances.rows).toHaveLength(0);
  });

  it('penolakan tidak menyentuh data absen', async () => {
    const { service, manager } = setup({ corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_IN, '08:00')] });
    await expect(service.review(7, hr, { status: RequestStatus.REJECTED, note: 'Tidak sesuai' })).resolves.toMatchObject({ status: 'REJECTED', reviewNote: 'Tidak sesuai' });
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('HRD tidak bisa memproses pengajuannya sendiri (403)', async () => {
    const { service } = setup({ corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_IN, '08:00', 5)] });
    expect((await rpcErrorOf(service.review(7, hr, { status: RequestStatus.APPROVED }))).statusCode).toBe(403);
  });

  it('pengajuan yang sudah diproses tidak bisa diproses lagi (409)', async () => {
    const { service } = setup({ corrections: [{ ...pending(7, '2026-11-19', AttendanceType.CHECK_IN, '08:00'), status: RequestStatus.CANCELLED }] });
    expect((await rpcErrorOf(service.review(7, hr, { status: RequestStatus.APPROVED }))).statusCode).toBe(409);
  });

  it('dua HRD bersamaan: update bersyarat yang kalah mendapat 409', async () => {
    const { service, corrections } = setup({ corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_IN, '08:00')] });
    // HRD lain menolak tepat setelah pengajuan dibaca
    corrections.findOneBy.mockImplementationOnce(async () => ({ ...corrections.rows[0] }));
    corrections.rows[0].status = RequestStatus.REJECTED;
    expect((await rpcErrorOf(service.review(7, hr, { status: RequestStatus.REJECTED, note: 'x' }))).statusCode).toBe(409);
  });
});

describe('CorrectionService.cancel', () => {
  it('hanya pemilik yang bisa membatalkan (lainnya 404)', async () => {
    const { service } = setup({ corrections: [pending(7, '2026-11-19', AttendanceType.CHECK_IN, '08:00')] });
    expect((await rpcErrorOf(service.cancel(2, 7))).statusCode).toBe(404);
    await expect(service.cancel(1, 7)).resolves.toMatchObject({ status: 'CANCELLED' });
    expect((await rpcErrorOf(service.cancel(1, 7))).statusCode).toBe(409);
  });
});
