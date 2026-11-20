import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateLeaveDto, EMPLOYEE_SERVICE, LeaveType, PATTERNS, RequestQuery, RequestStatus, ReviewRequestDto, Reviewer,
  addDays, localDate, paginate, rpcError, sendRpc, withEmployees,
} from '@app/common';
import { LeaveRequest } from './leave.entity';

/** Izin & sakit boleh diajukan menyusul paling lambat N hari setelah tanggal mulai */
export const LEAVE_BACKDATE_DAYS = 7;

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest) private readonly repo: Repository<LeaveRequest>,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
  ) {}

  private async getOrFail(id: number) {
    const l = await this.repo.findOneBy({ id });
    if (!l) rpcError(HttpStatus.NOT_FOUND, 'Pengajuan tidak ditemukan');
    return l;
  }

  async create(employeeId: number, dto: CreateLeaveDto) {
    const today = localDate();
    if (dto.type === LeaveType.CUTI && dto.startDate < today) {
      rpcError(HttpStatus.BAD_REQUEST, 'Cuti harus diajukan sebelum tanggal mulai');
    }
    if (dto.startDate < addDays(today, -LEAVE_BACKDATE_DAYS)) {
      rpcError(HttpStatus.BAD_REQUEST, `Izin/sakit paling lambat diajukan ${LEAVE_BACKDATE_DAYS} hari setelah tanggal mulai`);
    }
    const overlap = await this.repo.createQueryBuilder('l')
      .where('l.employee_id = :employeeId', { employeeId })
      .andWhere('l.status IN (:...active)', { active: [RequestStatus.PENDING, RequestStatus.APPROVED] })
      .andWhere('l.start_date <= :end AND l.end_date >= :start', { start: dto.startDate, end: dto.endDate })
      .getExists();
    if (overlap) rpcError(HttpStatus.CONFLICT, 'Sudah ada pengajuan lain (menunggu/disetujui) di rentang tanggal ini');

    return this.repo.save(this.repo.create({
      employeeId, type: dto.type, startDate: dto.startDate, endDate: dto.endDate, reason: dto.reason, status: RequestStatus.PENDING,
    }));
  }

  async myList(employeeId: number, q: RequestQuery) {
    const [rows, total] = await this.repo.findAndCount({
      where: { employeeId, ...(q.status && { status: q.status }) },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return paginate(rows, total, q.page, q.limit);
  }

  /** Untuk HRD: semua pengajuan + data karyawan */
  async findAll(q: RequestQuery) {
    const qb = this.repo.createQueryBuilder('l')
      .orderBy('l.created_at', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.status) qb.andWhere('l.status = :status', { status: q.status });
    if (q.search) {
      const ids = await sendRpc<number[]>(this.employees, PATTERNS.EMPLOYEE.SEARCH_IDS, { search: q.search });
      if (!ids.length) return paginate([], 0, q.page, q.limit);
      qb.andWhere('l.employee_id IN (:...ids)', { ids });
    }
    const [rows, total] = await qb.getManyAndCount();
    return paginate(await withEmployees(this.employees, rows), total, q.page, q.limit);
  }

  async cancel(employeeId: number, id: number) {
    const l = await this.getOrFail(id);
    if (l.employeeId !== employeeId) rpcError(HttpStatus.NOT_FOUND, 'Pengajuan tidak ditemukan');
    const res = await this.repo.update({ id, status: RequestStatus.PENDING }, { status: RequestStatus.CANCELLED });
    if (!res.affected) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses dan tidak bisa dibatalkan');
    return this.getOrFail(id);
  }

  async review(id: number, reviewer: Reviewer, dto: ReviewRequestDto) {
    const l = await this.getOrFail(id);
    if (l.status !== RequestStatus.PENDING) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses');
    if (reviewer.employeeId === l.employeeId) rpcError(HttpStatus.FORBIDDEN, 'Anda tidak dapat memproses pengajuan Anda sendiri');
    // update bersyarat: dua HRD yang memproses bersamaan tidak saling menimpa
    const res = await this.repo.update(
      { id, status: RequestStatus.PENDING },
      { status: dto.status, reviewedBy: reviewer.userId, reviewedAt: new Date(), reviewNote: dto.note || null },
    );
    if (!res.affected) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses');
    return this.getOrFail(id);
  }

  /** Cuti/izin/sakit yang disetujui dan beririsan dengan [from, to]; dipakai attendance-service */
  approvedInRange(from: string, to: string, employeeIds?: number[]) {
    if (employeeIds && !employeeIds.length) return [];
    return this.repo.createQueryBuilder('l')
      .select(['l.id', 'l.employeeId', 'l.type', 'l.startDate', 'l.endDate'])
      .where('l.status = :status', { status: RequestStatus.APPROVED })
      .andWhere('l.start_date <= :to AND l.end_date >= :from', { from, to })
      .andWhere(employeeIds ? 'l.employee_id IN (:...employeeIds)' : '1=1', { employeeIds })
      .getMany();
  }
}
