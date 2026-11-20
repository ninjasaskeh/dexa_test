import { LeaveType, RequestStatus } from '@app/common';
import { fakeClient, fakeQb, memRepo, restoreTime, rpcErrorOf, setNow } from '../../../test/helpers';
import { LeaveRequest } from './leave.entity';
import { LeaveService } from './leave.service';

const leave = (id: number, p: Partial<LeaveRequest> = {}) =>
  ({ id, employeeId: 1, type: LeaveType.CUTI, startDate: '2026-11-26', endDate: '2026-11-27', reason: 'Acara keluarga', status: RequestStatus.PENDING, ...p });

function setup(rows: Partial<LeaveRequest>[] = [], overlap = false) {
  const repo = memRepo<LeaveRequest>(rows);
  (repo as any).createQueryBuilder = jest.fn(() => fakeQb({ getExists: overlap, getMany: [] }));
  return { service: new LeaveService(repo as any, fakeClient() as any), repo };
}

const hr = { userId: 99, employeeId: 5 };
const dto = (p: Partial<{ type: LeaveType; startDate: string; endDate: string }>) =>
  ({ type: LeaveType.CUTI, startDate: '2026-11-26', endDate: '2026-11-27', reason: 'Acara keluarga', ...p });

beforeEach(() => setNow('2026-11-20 10:00'));
afterEach(restoreTime);

describe('LeaveService.create', () => {
  it('cuti harus diajukan sebelum tanggal mulai', async () => {
    const { service } = setup();
    expect(await rpcErrorOf(service.create(1, dto({ startDate: '2026-11-19', endDate: '2026-11-19' })))).toEqual({
      statusCode: 400, message: 'Cuti harus diajukan sebelum tanggal mulai',
    });
    await expect(service.create(1, dto({ startDate: '2026-11-20', endDate: '2026-11-20' }))).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('izin/sakit boleh menyusul paling lambat 7 hari', async () => {
    const { service } = setup();
    await expect(service.create(1, dto({ type: LeaveType.SAKIT, startDate: '2026-11-13', endDate: '2026-11-13' }))).resolves.toMatchObject({ type: 'SAKIT' });
    expect((await rpcErrorOf(service.create(1, dto({ type: LeaveType.IZIN, startDate: '2026-11-12', endDate: '2026-11-12' })))).statusCode).toBe(400);
  });

  it('menolak rentang yang bertabrakan dengan pengajuan aktif (409)', async () => {
    const { service, repo } = setup([], true);
    expect((await rpcErrorOf(service.create(1, dto({})))).statusCode).toBe(409);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('LeaveService.review & cancel', () => {
  it('HRD menyetujui pengajuan karyawan lain', async () => {
    const { service } = setup([leave(1)]);
    await expect(service.review(1, hr, { status: RequestStatus.APPROVED })).resolves.toMatchObject({ status: 'APPROVED', reviewedBy: 99, reviewNote: null });
  });

  it('HRD tidak bisa memproses pengajuannya sendiri (403)', async () => {
    const { service } = setup([leave(1, { employeeId: 5 })]);
    expect((await rpcErrorOf(service.review(1, hr, { status: RequestStatus.APPROVED }))).statusCode).toBe(403);
  });

  it('pengajuan yang sudah diproses tidak bisa diproses atau dibatalkan lagi (409)', async () => {
    const { service } = setup([leave(1, { status: RequestStatus.APPROVED })]);
    expect((await rpcErrorOf(service.review(1, hr, { status: RequestStatus.REJECTED, note: 'x' }))).statusCode).toBe(409);
    expect((await rpcErrorOf(service.cancel(1, 1))).statusCode).toBe(409);
  });

  it('karyawan lain tidak bisa membatalkan, dan tidak tahu pengajuannya ada (404)', async () => {
    const { service } = setup([leave(1)]);
    expect((await rpcErrorOf(service.cancel(2, 1))).statusCode).toBe(404);
    await expect(service.cancel(1, 1)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('id tidak ada menjadi 404', async () => {
    const { service } = setup();
    expect((await rpcErrorOf(service.review(42, hr, { status: RequestStatus.APPROVED }))).statusCode).toBe(404);
  });
});

describe('LeaveService.approvedInRange', () => {
  it('daftar karyawan kosong langsung mengembalikan [] tanpa query', async () => {
    const { service, repo } = setup();
    expect(await service.approvedInRange('2026-11-01', '2026-11-30', [])).toEqual([]);
    expect((repo as any).createQueryBuilder).not.toHaveBeenCalled();
  });
});
