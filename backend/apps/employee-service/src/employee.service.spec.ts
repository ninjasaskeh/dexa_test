import { Role } from '@app/common';
import { fakeClient, memRepo, rpcErrorOf } from '../../../test/helpers';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { Department, Position } from './organization.entity';
import { OrganizationService } from './organization.service';

const dto = {
  nip: '20260045', fullName: 'Dewi Lestari', departmentId: 1, positionId: 11, phone: null,
  joinDate: '2026-11-01', email: 'dewi@dexa.local', role: Role.EMPLOYEE,
};

function setup(employees: Partial<Employee>[] = []) {
  const departments = memRepo<Department>([
    { id: 1, name: 'IT', isActive: true },
    { id: 2, name: 'Finance', isActive: true },
    { id: 3, name: 'Lama', isActive: false },
  ]);
  const positions = memRepo<Position>([
    { id: 11, departmentId: 1, name: 'QA Engineer', isActive: true },
    { id: 12, departmentId: 1, name: 'Tester', isActive: false },
    { id: 21, departmentId: 2, name: 'Accountant', isActive: true },
  ]);
  const repo = memRepo<Employee>(employees);
  // query karyawan + join departemen/jabatan: cukup untuk getOrFail(id)
  (repo as any).createQueryBuilder = () => {
    let id: number;
    const qb: any = {
      leftJoinAndSelect: () => qb,
      where: (_: string, p: { id: number }) => ((id = p.id), qb),
      getOne: async () => {
        const e = repo.rows.find((r) => r.id === id);
        return e && { ...e, department: departments.rows.find((d) => d.id === e.departmentId), position: positions.rows.find((p) => p.id === e.positionId) };
      },
    };
    return qb;
  };
  (departments as any).manager = { transaction: (cb: (m: unknown) => unknown) => cb({ delete: (entity: unknown, w: any) => (entity === Position ? positions : departments).delete(w) }) };
  const auth = fakeClient({
    'auth.create_user': ({ email, role, mustChangePassword }) => ({ id: 50, email, role, mustChangePassword }),
    'auth.delete_user': () => ({ deleted: true }),
    'auth.find_users': ({ ids }) => ids.map((id: number) => ({ id, email: 'dewi@dexa.local', role: 'EMPLOYEE', isActive: true, lastLoginAt: null, mustChangePassword: true })),
  });
  const org = new OrganizationService(departments as any, positions as any, repo as any);
  return { service: new EmployeeService(repo as any, auth, org), org, repo, auth, departments, positions };
}

describe('EmployeeService.create (tulis lintas service dengan kompensasi)', () => {
  it('membuat akun dengan password awal = NIP dan wajib ganti, lalu profil karyawan', async () => {
    const { service, auth, repo } = setup();
    const res = await service.create(dto);
    expect(auth.calls[0]).toEqual({ pattern: 'auth.create_user', data: { email: 'dewi@dexa.local', password: '20260045', role: 'EMPLOYEE', mustChangePassword: true } });
    expect(repo.rows[0]).toMatchObject({ userId: 50, nip: '20260045', departmentId: 1, positionId: 11, isActive: true });
    expect(res).toMatchObject({ fullName: 'Dewi Lestari', department: 'IT', position: 'QA Engineer', email: 'dewi@dexa.local', mustChangePassword: true });
  });

  it('bila simpan profil gagal, akun login yang baru dibuat dihapus lagi', async () => {
    const { service, auth, repo } = setup();
    repo.save.mockRejectedValueOnce(new Error('ER_DATA_TOO_LONG'));
    await expect(service.create(dto)).rejects.toThrow('ER_DATA_TOO_LONG');
    expect(auth.calls.map((c) => c.pattern)).toEqual(['auth.create_user', 'auth.delete_user']);
    expect(auth.calls[1].data).toEqual({ id: 50 });
  });

  it('NIP ganda ditolak sebelum membuat akun (409)', async () => {
    const { service, auth } = setup([{ id: 1, nip: '20260045', userId: 1, departmentId: 1, positionId: 11 }]);
    expect(await rpcErrorOf(service.create(dto))).toEqual({ statusCode: 409, message: 'NIP 20260045 sudah dipakai karyawan lain' });
    expect(auth.send).not.toHaveBeenCalled();
  });

  it.each([
    ['jabatan dari departemen lain', { positionId: 21 }, 'Jabatan Accountant bukan bagian dari departemen IT'],
    ['jabatan nonaktif', { positionId: 12 }, 'Jabatan tidak ditemukan atau sudah nonaktif'],
    ['departemen nonaktif', { departmentId: 3 }, 'Departemen tidak ditemukan atau sudah nonaktif'],
  ])('menolak %s (400)', async (_label, patch, message) => {
    const { service, auth } = setup();
    expect(await rpcErrorOf(service.create({ ...dto, ...patch }))).toEqual({ statusCode: 400, message });
    expect(auth.send).not.toHaveBeenCalled();
  });
});

describe('EmployeeService.update', () => {
  const existing: Partial<Employee> = { id: 1, userId: 50, nip: '20260045', fullName: 'Dewi', departmentId: 3, positionId: 12, joinDate: '2026-01-01', isActive: true };

  it('karyawan lama tetap boleh di departemen/jabatan nonaktif selama tidak dipindah', async () => {
    const { service } = setup([existing]);
    await expect(service.update(1, { fullName: 'Dewi Lestari', departmentId: 3, positionId: 12 })).resolves.toMatchObject({ fullName: 'Dewi Lestari' });
    expect((await rpcErrorOf(service.update(1, { departmentId: 1, positionId: 12 }))).statusCode).toBe(400);
  });
});

describe('OrganizationService', () => {
  it('nama departemen unik, nama jabatan unik per departemen', async () => {
    const { org } = setup();
    expect((await rpcErrorOf(org.createDepartment({ name: 'IT' }))).statusCode).toBe(409);
    expect((await rpcErrorOf(org.createPosition({ departmentId: 1, name: 'QA Engineer' }))).statusCode).toBe(409);
    await expect(org.createPosition({ departmentId: 2, name: 'QA Engineer' })).resolves.toMatchObject({ departmentId: 2 });
    expect((await rpcErrorOf(org.createPosition({ departmentId: 3, name: 'Baru' }))).message).toBe('Departemen sudah nonaktif');
  });

  it('departemen/jabatan yang dipakai karyawan tidak bisa dihapus (409), yang kosong terhapus beserta jabatannya', async () => {
    const { org, departments, positions } = setup([{ id: 1, nip: '20260045', userId: 50, departmentId: 1, positionId: 11 }]);
    expect((await rpcErrorOf(org.deleteDepartment(1))).statusCode).toBe(409);
    expect((await rpcErrorOf(org.deletePosition(11))).statusCode).toBe(409);
    await expect(org.deleteDepartment(2)).resolves.toEqual({ deleted: true });
    expect(departments.rows.map((d) => d.id)).toEqual([1, 3]);
    expect(positions.rows.some((p) => p.departmentId === 2)).toBe(false);
  });
});
