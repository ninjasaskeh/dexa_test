import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@app/common';
import { fakeQb, memRepo, rpcErrorOf } from '../../../test/helpers';
import { AuthService } from './auth.service';
import { User } from './user.entity';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'rahasia-test', signOptions: { expiresIn: '1h' } });
  let users: ReturnType<typeof memRepo<User>>;
  let service: AuthService;

  beforeEach(async () => {
    const hash = await bcrypt.hash('Karyawan123!', 4);
    users = memRepo<User>([
      { id: 1, email: 'budi@dexa.local', role: Role.EMPLOYEE, passwordHash: hash, isActive: true },
      { id: 2, email: 'lama@dexa.local', role: Role.EMPLOYEE, passwordHash: hash, isActive: false },
    ]);
    // login membaca passwordHash lewat query builder (kolom select: false)
    (users as any).createQueryBuilder = () => {
      let where: any = {};
      const qb = fakeQb();
      qb.where = jest.fn((w: any) => ((where = w), qb));
      qb.getOne = jest.fn(async () => users.rows.find((u) => Object.entries(where).every(([k, v]) => u[k] === v)) ?? null);
      return qb;
    };
    service = new AuthService(users as any, jwt);
  });

  it('login berhasil mengembalikan JWT berisi id & role, dan mencatat login terakhir', async () => {
    const res = await service.login({ email: 'budi@dexa.local', password: 'Karyawan123!' });
    expect(res.user).toEqual({ id: 1, email: 'budi@dexa.local', role: 'EMPLOYEE' });
    expect(await jwt.verifyAsync(res.accessToken)).toMatchObject({ sub: 1, role: 'EMPLOYEE' });
    expect(users.rows[0].lastLoginAt).toBeInstanceOf(Date);
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  it('password salah dan email tidak dikenal memberi pesan yang sama (401)', async () => {
    const wrong = await rpcErrorOf(service.login({ email: 'budi@dexa.local', password: 'salah' }));
    const unknown = await rpcErrorOf(service.login({ email: 'siapa@dexa.local', password: 'salah' }));
    expect(wrong).toEqual({ statusCode: 401, message: 'Email atau password salah' });
    expect(unknown).toEqual(wrong);
  });

  it('akun nonaktif tidak bisa login (403)', async () => {
    expect((await rpcErrorOf(service.login({ email: 'lama@dexa.local', password: 'Karyawan123!' }))).statusCode).toBe(403);
  });

  it('verify menolak token palsu dan token milik akun yang sudah dinonaktifkan', async () => {
    expect((await rpcErrorOf(service.verify('bukan.token.jwt'))).statusCode).toBe(401);
    const forged = await new JwtService({ secret: 'secret-lain' }).signAsync({ sub: 1, email: 'budi@dexa.local', role: 'HR_ADMIN' });
    expect((await rpcErrorOf(service.verify(forged))).statusCode).toBe(401);
    const { accessToken } = await service.login({ email: 'budi@dexa.local', password: 'Karyawan123!' });
    users.rows[0].isActive = false;
    expect((await rpcErrorOf(service.verify(accessToken))).statusCode).toBe(401);
  });

  it('role diambil dari database, bukan dari isi token', async () => {
    const { accessToken } = await service.login({ email: 'budi@dexa.local', password: 'Karyawan123!' });
    users.rows[0].role = Role.HR_ADMIN;
    await expect(service.verify(accessToken)).resolves.toMatchObject({ role: 'HR_ADMIN' });
  });

  it('createUser menyimpan hash bcrypt dan menolak email ganda (409)', async () => {
    await service.createUser({ email: 'baru@dexa.local', password: 'Rahasia123', role: Role.EMPLOYEE });
    const saved = users.rows.find((u) => u.email === 'baru@dexa.local')!;
    expect(saved.passwordHash).not.toBe('Rahasia123');
    expect(await bcrypt.compare('Rahasia123', saved.passwordHash)).toBe(true);
    expect((await rpcErrorOf(service.createUser({ email: 'budi@dexa.local', password: 'x', role: Role.EMPLOYEE }))).statusCode).toBe(409);
  });

  it('ganti password memeriksa password lama', async () => {
    expect((await rpcErrorOf(service.changePassword({ userId: 1, currentPassword: 'salah', newPassword: 'Baru12345' }))).statusCode).toBe(400);
    await service.changePassword({ userId: 1, currentPassword: 'Karyawan123!', newPassword: 'Baru12345' });
    await expect(service.login({ email: 'budi@dexa.local', password: 'Baru12345' })).resolves.toBeDefined();
  });
});
