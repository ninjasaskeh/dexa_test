import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  AUTH_SERVICE, AuthUser, CreateEmployeeDto, ListEmployeeQuery, PATTERNS, UpdateEmployeeDto, paginate, rpcError, sendRpc,
} from '@app/common';
import { Employee } from './employee.entity';
import { OrganizationService } from './organization.service';

type UserInfo = AuthUser & { isActive: boolean; lastLoginAt: string | null };

/** Karyawan dengan nama departemen & jabatan (bentuk yang dipakai service lain dan frontend) */
export type EmployeeView = Omit<Employee, 'department' | 'position'> & { department: string; position: string };

const flatten = (e: Employee): EmployeeView => ({ ...e, department: e.department?.name ?? '', position: e.position?.name ?? '' });

@Injectable()
export class EmployeeService {
  constructor(
    @InjectRepository(Employee) private readonly repo: Repository<Employee>,
    @Inject(AUTH_SERVICE) private readonly auth: ClientProxy,
    private readonly org: OrganizationService,
  ) {}

  /** Query karyawan beserta departemen & jabatannya */
  private query(): SelectQueryBuilder<Employee> {
    return this.repo.createQueryBuilder('e').leftJoinAndSelect('e.department', 'd').leftJoinAndSelect('e.position', 'p');
  }

  /** Gabungkan data akun (email, role, status password) dari auth-service */
  private async withUsers(list: EmployeeView[]) {
    const users = await sendRpc<UserInfo[]>(this.auth, PATTERNS.AUTH.FIND_USERS, { ids: list.map((e) => e.userId) });
    const map = new Map(users.map((u) => [u.id, u]));
    return list.map((e) => {
      const u = map.get(e.userId);
      return { ...e, email: u?.email ?? null, role: u?.role ?? null, lastLoginAt: u?.lastLoginAt ?? null, mustChangePassword: u?.mustChangePassword ?? false };
    });
  }

  private async getOrFail(id: number) {
    const emp = await this.query().where('e.id = :id', { id }).getOne();
    if (!emp) rpcError(HttpStatus.NOT_FOUND, 'Karyawan tidak ditemukan');
    return emp;
  }

  private async assertNipFree(nip: string, exceptId?: number) {
    const other = await this.repo.findOneBy({ nip });
    if (other && other.id !== exceptId) rpcError(HttpStatus.CONFLICT, `NIP ${nip} sudah dipakai karyawan lain`);
  }

  async create(dto: CreateEmployeeDto) {
    await this.assertNipFree(dto.nip);
    await this.org.assertAssignable(dto.departmentId, dto.positionId);
    // 1. akun login di auth-service; password awal = NIP dan wajib diganti saat login pertama
    const user = await sendRpc<AuthUser>(this.auth, PATTERNS.AUTH.CREATE_USER, {
      email: dto.email, password: dto.nip, role: dto.role, mustChangePassword: true,
    });
    // 2. profil karyawan; jika gagal, batalkan akun (kompensasi)
    try {
      const emp = await this.repo.save(this.repo.create({
        userId: user.id, nip: dto.nip, fullName: dto.fullName, departmentId: dto.departmentId, positionId: dto.positionId,
        phone: dto.phone ?? null, joinDate: dto.joinDate, isActive: true,
      }));
      return this.findOne(emp.id);
    } catch (e) {
      await sendRpc(this.auth, PATTERNS.AUTH.DELETE_USER, { id: user.id }).catch(() => undefined);
      throw e;
    }
  }

  /** Filter pencarian nama / NIP / jabatan */
  private searchFilter(search: string) {
    return new Brackets((w) => {
      w.where('e.full_name LIKE :s', { s: `%${search}%` })
        .orWhere('e.nip LIKE :s')
        .orWhere('p.name LIKE :s');
    });
  }

  async findAll(q: ListEmployeeQuery) {
    // skip/take + join: TypeORM butuh nama properti (createdAt), bukan nama kolom
    const qb = this.query().orderBy('e.createdAt', 'DESC').addOrderBy('e.id', 'DESC').skip((q.page - 1) * q.limit).take(q.limit);
    if (q.search) qb.andWhere(this.searchFilter(q.search));
    if (q.departmentId) qb.andWhere('e.department_id = :d', { d: q.departmentId });
    if (q.status !== 'all') qb.andWhere('e.is_active = :a', { a: q.status === 'active' ? 1 : 0 });
    const [rows, total] = await qb.getManyAndCount();
    return paginate(await this.withUsers(rows.map(flatten)), total, q.page, q.limit);
  }

  /** Semua karyawan aktif (data ringkas) untuk dashboard & rekap */
  async activeLite() {
    const rows = await this.query().where('e.is_active = 1').orderBy('e.full_name', 'ASC').getMany();
    return rows.map((e) => ({ id: e.id, nip: e.nip, fullName: e.fullName, department: e.department.name, position: e.position.name, joinDate: e.joinDate }));
  }

  /** Semua id karyawan yang cocok dengan pencarian (tanpa batas jumlah), untuk filter absensi */
  async searchIds(search: string): Promise<number[]> {
    const rows = await this.repo.createQueryBuilder('e').leftJoin('e.position', 'p').select('e.id', 'id').where(this.searchFilter(search)).getRawMany<{ id: number }>();
    return rows.map((r) => Number(r.id));
  }

  async findOne(id: number) {
    return (await this.withUsers([flatten(await this.getOrFail(id))]))[0];
  }

  async findByUser(userId: number) {
    const emp = await this.query().where('e.user_id = :userId', { userId }).getOne();
    if (!emp) rpcError(HttpStatus.NOT_FOUND, 'Profil karyawan untuk akun ini belum dibuat');
    return flatten(emp);
  }

  /** Untuk login dengan NIP: kembalikan userId (404 bila tidak ada) */
  async findByNip(nip: string) {
    const emp = await this.repo.findOneBy({ nip });
    if (!emp) rpcError(HttpStatus.NOT_FOUND, 'NIP tidak ditemukan');
    return { id: emp.id, userId: emp.userId };
  }

  async findByIds(ids: number[]) {
    return ids.length ? (await this.query().where({ id: In(ids) }).getMany()).map(flatten) : [];
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const emp = await this.getOrFail(id);
    if (dto.nip && dto.nip !== emp.nip) await this.assertNipFree(dto.nip, id);
    // validasi departemen/jabatan hanya bila diubah: karyawan lama boleh tetap di departemen yang sudah dinonaktifkan
    if (dto.departmentId !== undefined || dto.positionId !== undefined) {
      const departmentId = dto.departmentId ?? emp.departmentId;
      const positionId = dto.positionId ?? emp.positionId;
      if (departmentId !== emp.departmentId || positionId !== emp.positionId) await this.org.assertAssignable(departmentId, positionId);
    }
    // field akun -> auth-service
    if (dto.email || dto.role || dto.isActive !== undefined) {
      await sendRpc(this.auth, PATTERNS.AUTH.UPDATE_USER, { id: emp.userId, email: dto.email, role: dto.role, isActive: dto.isActive });
    }
    const patch: Partial<Employee> = {};
    for (const k of ['nip', 'fullName', 'departmentId', 'positionId', 'joinDate', 'isActive'] as const) {
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
      .innerJoin('e.department', 'd')
      .select('d.name', 'department')
      .addSelect('COUNT(*)', 'count')
      .where('e.is_active = 1')
      .groupBy('d.id')
      .orderBy('count', 'DESC')
      .getRawMany<{ department: string; count: string }>();
    return { total, active, inactive: total - active, byDepartment: byDepartment.map((d) => ({ department: d.department, count: Number(d.count) })) };
  }
}
