import { Role } from '@app/common';
import { fakeClient, memRepo, rpcErrorOf } from '../../../test/helpers';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';

const dto = {
  employeeCode: 'EMP-010', fullName: 'Dewi Lestari', position: 'Analyst', department: 'Finance', phone: null,
  joinDate: '2026-11-01', email: 'dewi@dexa.local', password: 'Rahasia123', role: Role.EMPLOYEE,
};

function setup(rows: Partial<Employee>[] = []) {
  const repo = memRepo<Employee>(rows);
  const auth = fakeClient({
    'auth.create_user': ({ email, role }) => ({ id: 50, email, role }),
    'auth.delete_user': () => ({ deleted: true }),
    'auth.find_users': ({ ids }) => ids.map((id: number) => ({ id, email: 'dewi@dexa.local', role: 'EMPLOYEE', isActive: true, lastLoginAt: null })),
  });
  return { service: new EmployeeService(repo as any, auth), repo, auth };
}

describe('EmployeeService.create (tulis lintas service dengan kompensasi)', () => {
  it('membuat akun login di auth-service lalu profil karyawan', async () => {
    const { service, auth, repo } = setup();
    const res = await service.create(dto);
    expect(auth.calls.map((c) => c.pattern)).toEqual(['auth.create_user', 'auth.find_users']);
    expect(auth.calls[0].data).toEqual({ email: 'dewi@dexa.local', password: 'Rahasia123', role: 'EMPLOYEE' });
    expect(repo.rows[0]).toMatchObject({ userId: 50, employeeCode: 'EMP-010', isActive: true });
    expect(res).toMatchObject({ fullName: 'Dewi Lestari', email: 'dewi@dexa.local', role: 'EMPLOYEE' });
  });

  it('bila simpan profil gagal, akun login yang baru dibuat dihapus lagi', async () => {
    const { service, auth, repo } = setup();
    repo.save.mockRejectedValueOnce(new Error('ER_DATA_TOO_LONG'));
    await expect(service.create(dto)).rejects.toThrow('ER_DATA_TOO_LONG');
    expect(auth.calls.map((c) => c.pattern)).toEqual(['auth.create_user', 'auth.delete_user']);
    expect(auth.calls[1].data).toEqual({ id: 50 });
  });

  it('kode karyawan ganda ditolak sebelum membuat akun (409)', async () => {
    const { service, auth } = setup([{ id: 1, employeeCode: 'EMP-010', userId: 1 }]);
    expect((await rpcErrorOf(service.create(dto))).statusCode).toBe(409);
    expect(auth.send).not.toHaveBeenCalled();
  });
});
