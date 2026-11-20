import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  AUTH_SERVICE, AuthUser, CreateEmployeeDto, ListEmployeeQuery, PATTERNS, UpdateEmployeeDto, paginate, rpcError, sendRpc,
} from '@app/common';
import { Employee } from './employee.entity';

type UserInfo = AuthUser & { isActive: boolean; lastLoginAt: string | null };

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    @Inject(AUTH_SERVICE) private readonly auth: ClientProxy,
  ) {}

  /** Gabungkan data akun (email, role) dari auth-service */
  private async withUsers(list: Employee[]) {
    const users = await sendRpc<UserInfo[]>(this.auth, PATTERNS.AUTH.FIND_USERS, { ids: list.map((e) => e.userId) });
    const map = new Map(users.map((u) => [u.id, u]));
    return list.map((e) => ({ ...e, email: map.get(e.userId)?.email ?? null, role: map.get(e.userId)?.role ?? null, lastLoginAt: map.get(e.userId)?.lastLoginAt ?? null }));
  }

  private async getOrFail(id: number) {
    const emp = await this.repo.findOneBy({ id });
    if (!emp) rpcError(HttpStatus.NOT_FOUND, 'Karyawan tidak ditemukan');
    return emp;
  }

  async create(dto: CreateEmployeeDto) {
    if (await this.repo.existsBy({ employeeCode: dto.employeeCode })) {
      rpcError(HttpStatus.CONFLICT, `Kode karyawan ${dto.employeeCode} sudah dipakai`);
    }
    // 1. buat akun login di auth-service
    const user = await sendRpc<AuthUser>(this.auth, PATTERNS.AUTH.CREATE_USER, { email: dto.email, password: dto.password, role: dto.role });
    // 2. simpan profil karyawan; jika gagal, batalkan akun (kompensasi)
    try {
      const emp = await this.repo.save(this.repo.create({
        userId: user.id, employeeCode: dto.employeeCode, fullName: dto.fullName, position: dto.position,
        department: dto.department, phone: dto.phone ?? null, joinDate: dto.joinDate, isActive: true,
      }));
      return (await this.withUsers([emp]))[0];
    } catch (e) {
      await sendRpc(this.auth, PATTERNS.AUTH.DELETE_USER, { id: user.id }).catch(() => undefined);
      throw e;
    }
  }

  /** Filter pencarian nama / kode / jabatan */
  private searchFilter(search: string) {
    return new Brackets((w) => {
      w.where('e.full_name LIKE :s', { s: `%${search}%` })
        .orWhere('e.employee_code LIKE :s')
        .orWhere('e.position LIKE :s');
    });
  }

  async findAll(q: ListEmployeeQuery) {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.created_at', 'DESC').addOrderBy('e.id', 'DESC').skip((q.page - 1) * q.limit).take(q.limit);
    if (q.search) qb.andWhere(this.searchFilter(q.search));
    if (q.department) qb.andWhere('e.department = :d', { d: q.department });
    if (q.status !== 'all') qb.andWhere('e.is_active = :a', { a: q.status === 'active' ? 1 : 0 });
    const [rows, total] = await qb.getManyAndCount();
    return paginate(await this.withUsers(rows), total, q.page, q.limit);
  }

  /** Semua karyawan aktif (data ringkas) untuk rekap kehadiran harian */
  activeLite() {
    return this.repo.find({
      select: { id: true, employeeCode: true, fullName: true, department: true, position: true, joinDate: true },
      where: { isActive: true },
      order: { fullName: 'ASC' },
    });
  }

  /** Semua id karyawan yang cocok dengan pencarian (tanpa batas jumlah), untuk filter absensi */
  async searchIds(search: string): Promise<number[]> {
    const rows = await this.repo.createQueryBuilder('e').select('e.id', 'id').where(this.searchFilter(search)).getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  async findOne(id: number) {
    return (await this.withUsers([await this.getOrFail(id)]))[0];
  }

  async findByUser(userId: number) {
    const emp = await this.repo.findOneBy({ userId });
    if (!emp) rpcError(HttpStatus.NOT_FOUND, 'Profil karyawan untuk akun ini belum dibuat');
    return emp;
  }

  findByIds(ids: number[]) {
    return ids.length ? this.repo.findBy({ id: In(ids) }) : [];
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const emp = await this.getOrFail(id);
    if (dto.employeeCode && dto.employeeCode !== emp.employeeCode && (await this.repo.existsBy({ employeeCode: dto.employeeCode }))) {
      rpcError(HttpStatus.CONFLICT, `Kode karyawan ${dto.employeeCode} sudah dipakai`);
    }
    // field akun -> auth-service
    if (dto.email || dto.password || dto.role || dto.isActive !== undefined) {
      await sendRpc(this.auth, PATTERNS.AUTH.UPDATE_USER, { id: emp.userId, email: dto.email, password: dto.password, role: dto.role, isActive: dto.isActive });
    }
    const patch: Partial<Employee> = {};
    for (const k of ['employeeCode', 'fullName', 'position', 'department', 'joinDate', 'isActive'] as const) {
      if (dto[k] !== undefined) (patch as any)[k] = dto[k];
    }
    if ('phone' in dto) patch.phone = dto.phone ?? null;
    if (Object.keys(patch).length) await this.repo.update(id, patch);
    return this.findOne(id);
  }

  async stats() {
    const total = await this.repo.count();
    const active = await this.repo.countBy({ isActive: true });
    const byDepartment = await this.repo
      .createQueryBuilder('e')
      .select('e.department', 'department')
      .addSelect('COUNT(*)', 'count')
      .where('e.is_active = 1')
      .groupBy('e.department')
      .orderBy('count', 'DESC')
      .getRawMany<{ department: string; count: string }>();
    // semua departemen (termasuk yang karyawannya nonaktif) untuk filter & form
    const departments = (await this.repo.createQueryBuilder('e').select('DISTINCT e.department', 'department').orderBy('department').getRawMany<{ department: string }>())
      .map((d) => d.department);
    return { total, active, inactive: total - active, departments, byDepartment: byDepartment.map((d) => ({ department: d.department, count: Number(d.count) })) };
  }
}
