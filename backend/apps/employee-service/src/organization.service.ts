import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDepartmentDto, CreatePositionDto, PositionQuery, UpdateDepartmentDto, UpdatePositionDto, rpcError } from '@app/common';
import { Employee } from './employee.entity';
import { Department, Position } from './organization.entity';

/** Master departemen & jabatan (dimiliki employee-service) */
@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    @InjectRepository(Position) private readonly positions: Repository<Position>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
  ) {}

  /** Jumlah karyawan per kolom (department_id / position_id), termasuk yang nonaktif */
  private async countBy(column: 'department_id' | 'position_id') {
    const rows = await this.employees
      .createQueryBuilder('e')
      .select(`e.${column}`, 'id')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(e.is_active = 1)', 'active')
      .groupBy(`e.${column}`)
      .getRawMany<{ id: number; total: string; active: string }>();
    return new Map(rows.map((r) => [Number(r.id), { total: Number(r.total), active: Number(r.active ?? 0) }]));
  }

  /** Semua departemen beserta jabatannya dan jumlah karyawan aktif */
  async list() {
    const [depts, byDept, byPos] = await Promise.all([
      this.departments.find({ relations: { positions: true }, order: { name: 'ASC', positions: { name: 'ASC' } } }),
      this.countBy('department_id'),
      this.countBy('position_id'),
    ]);
    return depts.map((d) => ({
      id: d.id,
      name: d.name,
      isActive: d.isActive,
      employeeCount: byDept.get(d.id)?.active ?? 0,
      positions: d.positions.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive, employeeCount: byPos.get(p.id)?.active ?? 0 })),
    }));
  }

  /** Semua jabatan (datar) beserta nama departemen dan jumlah karyawan aktif */
  async listPositions(q: PositionQuery = {}) {
    const [rows, byPos] = await Promise.all([
      this.positions.find({
        where: q.departmentId ? { departmentId: q.departmentId } : {},
        relations: { department: true },
        order: { department: { name: 'ASC' }, name: 'ASC' },
      }),
      this.countBy('position_id'),
    ]);
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      isActive: p.isActive,
      departmentId: p.departmentId,
      department: p.department.name,
      departmentActive: p.department.isActive,
      employeeCount: byPos.get(p.id)?.active ?? 0,
    }));
  }

  private async getDepartment(id: number) {
    const d = await this.departments.findOneBy({ id });
    if (!d) rpcError(HttpStatus.NOT_FOUND, 'Departemen tidak ditemukan');
    return d;
  }

  private async getPosition(id: number) {
    const p = await this.positions.findOneBy({ id });
    if (!p) rpcError(HttpStatus.NOT_FOUND, 'Jabatan tidak ditemukan');
    return p;
  }

  private async assertDepartmentNameFree(name: string, exceptId?: number) {
    const other = await this.departments.findOneBy({ name });
    if (other && other.id !== exceptId) rpcError(HttpStatus.CONFLICT, `Departemen "${name}" sudah ada`);
  }

  private async assertPositionNameFree(departmentId: number, name: string, exceptId?: number) {
    const other = await this.positions.findOneBy({ departmentId, name });
    if (other && other.id !== exceptId) rpcError(HttpStatus.CONFLICT, `Jabatan "${name}" sudah ada di departemen ini`);
  }

  /** Dipakai saat tambah/ubah karyawan: departemen & jabatan harus aktif dan jabatan milik departemen tsb */
  async assertAssignable(departmentId: number, positionId: number) {
    const [d, p] = await Promise.all([this.departments.findOneBy({ id: departmentId }), this.positions.findOneBy({ id: positionId })]);
    if (!d || !d.isActive) rpcError(HttpStatus.BAD_REQUEST, 'Departemen tidak ditemukan atau sudah nonaktif');
    if (!p || !p.isActive) rpcError(HttpStatus.BAD_REQUEST, 'Jabatan tidak ditemukan atau sudah nonaktif');
    if (p.departmentId !== d.id) rpcError(HttpStatus.BAD_REQUEST, `Jabatan ${p.name} bukan bagian dari departemen ${d.name}`);
  }

  async createDepartment(dto: CreateDepartmentDto) {
    await this.assertDepartmentNameFree(dto.name);
    return this.departments.save(this.departments.create({ name: dto.name, isActive: true }));
  }

  async updateDepartment(id: number, dto: UpdateDepartmentDto) {
    await this.getDepartment(id);
    if (dto.name) await this.assertDepartmentNameFree(dto.name, id);
    await this.departments.update(id, dto);
    return this.getDepartment(id);
  }

  /** Hanya departemen tanpa karyawan (aktif maupun nonaktif) yang bisa dihapus; jabatannya ikut terhapus */
  async deleteDepartment(id: number) {
    await this.getDepartment(id);
    if (await this.employees.existsBy({ departmentId: id })) {
      rpcError(HttpStatus.CONFLICT, 'Departemen masih dipakai karyawan. Nonaktifkan saja agar tidak bisa dipilih lagi.');
    }
    await this.departments.manager.transaction(async (m) => {
      await m.delete(Position, { departmentId: id });
      await m.delete(Department, { id });
    });
    return { deleted: true };
  }

  async createPosition(dto: CreatePositionDto) {
    const d = await this.getDepartment(dto.departmentId);
    if (!d.isActive) rpcError(HttpStatus.BAD_REQUEST, 'Departemen sudah nonaktif');
    await this.assertPositionNameFree(dto.departmentId, dto.name);
    return this.positions.save(this.positions.create({ departmentId: dto.departmentId, name: dto.name, isActive: true }));
  }

  async updatePosition(id: number, dto: UpdatePositionDto) {
    const p = await this.getPosition(id);
    if (dto.name) await this.assertPositionNameFree(p.departmentId, dto.name, id);
    await this.positions.update(id, dto);
    return this.getPosition(id);
  }

  async deletePosition(id: number) {
    await this.getPosition(id);
    if (await this.employees.existsBy({ positionId: id })) {
      rpcError(HttpStatus.CONFLICT, 'Jabatan masih dipakai karyawan. Nonaktifkan saja agar tidak bisa dipilih lagi.');
    }
    await this.positions.delete(id);
    return { deleted: true };
  }
}
