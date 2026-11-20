import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthUser, JwtPayload, LoginDto, Role, rpcError } from '@app/common';
import { User } from './user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  private toAuthUser(u: User): AuthUser {
    return { id: u.id, email: u.email, role: u.role };
  }

  private findWithPassword(where: Partial<User>) {
    return this.users.createQueryBuilder('u').addSelect('u.passwordHash').where(where).getOne();
  }

  async login({ email, password }: LoginDto) {
    const user = await this.findWithPassword({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      rpcError(HttpStatus.UNAUTHORIZED, 'Email atau password salah');
    }
    if (!user.isActive) rpcError(HttpStatus.FORBIDDEN, 'Akun Anda dinonaktifkan. Hubungi HRD.');

    await this.users.update(user.id, { lastLoginAt: new Date() });
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload), user: this.toAuthUser(user) };
  }

  /** Dipanggil gateway di setiap request terproteksi */
  async verify(token: string): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      rpcError(HttpStatus.UNAUTHORIZED, 'Sesi tidak valid atau sudah berakhir');
    }
    const user = await this.users.findOneBy({ id: payload.sub });
    if (!user || !user.isActive) rpcError(HttpStatus.UNAUTHORIZED, 'Akun tidak aktif');
    return this.toAuthUser(user);
  }

  async createUser(data: { email: string; password: string; role: Role }) {
    if (await this.users.existsBy({ email: data.email })) rpcError(HttpStatus.CONFLICT, 'Email sudah terdaftar');
    const user = await this.users.save(
      this.users.create({ email: data.email, role: data.role, passwordHash: await bcrypt.hash(data.password, 10) }),
    );
    return this.toAuthUser(user);
  }

  async updateUser(data: { id: number; email?: string; password?: string; role?: Role; isActive?: boolean }) {
    const user = await this.users.findOneBy({ id: data.id });
    if (!user) rpcError(HttpStatus.NOT_FOUND, 'User tidak ditemukan');
    if (data.email && data.email !== user.email && (await this.users.existsBy({ email: data.email }))) {
      rpcError(HttpStatus.CONFLICT, 'Email sudah terdaftar');
    }
    const patch: Partial<User> = {};
    if (data.email) patch.email = data.email;
    if (data.role) patch.role = data.role;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.password) patch.passwordHash = await bcrypt.hash(data.password, 10);
    if (Object.keys(patch).length) await this.users.update(user.id, patch);
    return this.toAuthUser({ ...user, ...patch } as User);
  }

  async deleteUser(id: number) {
    await this.users.delete(id);
    return { deleted: true };
  }

  async changePassword(data: { userId: number; currentPassword: string; newPassword: string }) {
    const user = await this.findWithPassword({ id: data.userId });
    if (!user) rpcError(HttpStatus.NOT_FOUND, 'User tidak ditemukan');
    if (!(await bcrypt.compare(data.currentPassword, user.passwordHash))) {
      rpcError(HttpStatus.BAD_REQUEST, 'Password lama salah');
    }
    await this.users.update(user.id, { passwordHash: await bcrypt.hash(data.newPassword, 10) });
    return { success: true };
  }

  async findUsers(ids: number[]) {
    if (!ids.length) return [];
    return (await this.users.findBy({ id: In(ids) })).map((u) => ({ ...this.toAuthUser(u), isActive: u.isActive, lastLoginAt: u.lastLoginAt }));
  }
}
