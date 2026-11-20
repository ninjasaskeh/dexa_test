import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AttendanceType, CreateCorrectionDto, EMPLOYEE_SERVICE, PATTERNS, RequestQuery, RequestStatus, ReviewRequestDto, Reviewer,
  addDays, hhmmToMinutes, localDate, localDateTime, paginate, rpcError, sendRpc, withEmployees,
} from '@app/common';
import { Attendance } from './attendance.entity';
import { CalendarService } from './calendar.service';
import { AttendanceCorrection } from './correction.entity';

/** Koreksi hanya untuk absen N hari terakhir */
export const CORRECTION_MAX_DAYS = 30;

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

@Injectable()
export class CorrectionService {
  constructor(
    @InjectRepository(AttendanceCorrection) private readonly repo: Repository<AttendanceCorrection>,
    @InjectRepository(Attendance) private readonly attendances: Repository<Attendance>,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
    private readonly calendar: CalendarService,
  ) {}

  /** requestedTime dikirim sebagai "HH:mm" */
  private toDto(c: AttendanceCorrection) {
    return { ...c, requestedTime: c.requestedTime.slice(0, 5) };
  }

  private async getOrFail(id: number) {
    const c = await this.repo.findOneBy({ id });
    if (!c) rpcError(HttpStatus.NOT_FOUND, 'Pengajuan koreksi tidak ditemukan');
    return c;
  }

  /** Check-in harus sebelum check-out pada tanggal yang sama */
  private assertOrder(type: AttendanceType, minutes: number, checkIn: number | null, checkOut: number | null) {
    if (type === AttendanceType.CHECK_OUT) {
      if (checkIn === null) rpcError(HttpStatus.BAD_REQUEST, 'Belum ada check-in pada tanggal ini. Ajukan koreksi check-in terlebih dahulu.');
      if (minutes <= checkIn) rpcError(HttpStatus.BAD_REQUEST, 'Jam check-out harus setelah jam check-in');
    } else if (checkOut !== null && minutes >= checkOut) {
      rpcError(HttpStatus.BAD_REQUEST, 'Jam check-in harus sebelum jam check-out');
    }
  }

  async create(employeeId: number, dto: CreateCorrectionDto) {
    const today = localDate();
    if (dto.date > today) rpcError(HttpStatus.BAD_REQUEST, 'Tanggal koreksi tidak boleh melewati hari ini');
    if (dto.date < addDays(today, -CORRECTION_MAX_DAYS)) {
      rpcError(HttpStatus.BAD_REQUEST, `Koreksi hanya bisa diajukan untuk ${CORRECTION_MAX_DAYS} hari terakhir`);
    }
    const minutes = hhmmToMinutes(dto.time);
    if (minutes > hhmmToMinutes(this.calendar.checkOutMaxTime)) {
      rpcError(HttpStatus.BAD_REQUEST, `Jam absen tidak boleh melewati batas ${this.calendar.checkOutMaxTime}`);
    }
    if (dto.date === today && minutes > minutesOf(new Date())) rpcError(HttpStatus.BAD_REQUEST, 'Jam koreksi belum terlewati');

    const [day, pending] = await Promise.all([
      this.attendances.findBy({ employeeId, attendanceDate: dto.date }),
      this.repo.findBy({ employeeId, attendanceDate: dto.date, status: RequestStatus.PENDING }),
    ]);
    if (pending.some((p) => p.type === dto.type)) {
      rpcError(HttpStatus.CONFLICT, 'Masih ada koreksi yang menunggu persetujuan untuk tanggal dan tipe ini');
    }
    const existing = day.find((a) => a.type === dto.type);
    if (existing && minutesOf(existing.recordedAt) === minutes) rpcError(HttpStatus.BAD_REQUEST, 'Jam koreksi sama dengan jam yang sudah tercatat');

    // check-out boleh diajukan bersamaan dengan koreksi check-in yang masih menunggu
    const ci = day.find((a) => a.type === AttendanceType.CHECK_IN);
    const co = day.find((a) => a.type === AttendanceType.CHECK_OUT);
    const pendingCi = pending.find((p) => p.type === AttendanceType.CHECK_IN);
    const pendingCo = pending.find((p) => p.type === AttendanceType.CHECK_OUT);
    this.assertOrder(
      dto.type,
      minutes,
      pendingCi ? hhmmToMinutes(pendingCi.requestedTime) : ci ? minutesOf(ci.recordedAt) : null,
      pendingCo ? hhmmToMinutes(pendingCo.requestedTime) : co ? minutesOf(co.recordedAt) : null,
    );

    const saved = await this.repo.save(this.repo.create({
      employeeId, attendanceDate: dto.date, type: dto.type, requestedTime: `${dto.time}:00`,
      originalRecordedAt: existing?.recordedAt ?? null, reason: dto.reason, status: RequestStatus.PENDING,
    }));
    return this.toDto(saved);
  }

  async myList(employeeId: number, q: RequestQuery) {
    const [rows, total] = await this.repo.findAndCount({
      where: { employeeId, ...(q.status && { status: q.status }) },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    });
    return paginate(rows.map((r) => this.toDto(r)), total, q.page, q.limit);
  }

  /** Untuk HRD: semua pengajuan koreksi + data karyawan */
  async findAll(q: RequestQuery) {
    const qb = this.repo.createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.status) qb.andWhere('c.status = :status', { status: q.status });
    if (q.search) {
      const ids = await sendRpc<number[]>(this.employees, PATTERNS.EMPLOYEE.SEARCH_IDS, { search: q.search });
      if (!ids.length) return paginate([], 0, q.page, q.limit);
      qb.andWhere('c.employee_id IN (:...ids)', { ids });
    }
    const [rows, total] = await qb.getManyAndCount();
    return paginate(await withEmployees(this.employees, rows.map((r) => this.toDto(r))), total, q.page, q.limit);
  }

  async cancel(employeeId: number, id: number) {
    const c = await this.getOrFail(id);
    if (c.employeeId !== employeeId) rpcError(HttpStatus.NOT_FOUND, 'Pengajuan koreksi tidak ditemukan');
    const res = await this.repo.update({ id, status: RequestStatus.PENDING }, { status: RequestStatus.CANCELLED });
    if (!res.affected) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses dan tidak bisa dibatalkan');
    return this.toDto(await this.getOrFail(id));
  }

  /**
   * HRD menyetujui / menolak. Bila disetujui, jam absen dibuat atau diubah dalam satu transaksi
   * dan attendances.correction_id menunjuk ke pengajuan ini.
   */
  async review(id: number, reviewer: Reviewer, dto: ReviewRequestDto) {
    const c = await this.getOrFail(id);
    if (c.status !== RequestStatus.PENDING) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses');
    if (reviewer.employeeId === c.employeeId) rpcError(HttpStatus.FORBIDDEN, 'Anda tidak dapat memproses pengajuan Anda sendiri');
    const decision = { status: dto.status, reviewedBy: reviewer.userId, reviewedAt: new Date(), reviewNote: dto.note || null };

    if (dto.status === RequestStatus.REJECTED) {
      const res = await this.repo.update({ id, status: RequestStatus.PENDING }, decision);
      if (!res.affected) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses');
      return this.toDto(await this.getOrFail(id));
    }

    await this.repo.manager.transaction(async (m) => {
      const day = await m.find(Attendance, {
        where: { employeeId: c.employeeId, attendanceDate: c.attendanceDate },
        lock: { mode: 'pessimistic_write' },
      });
      const ci = day.find((a) => a.type === AttendanceType.CHECK_IN);
      const co = day.find((a) => a.type === AttendanceType.CHECK_OUT);
      const minutes = hhmmToMinutes(c.requestedTime);
      if (c.type === AttendanceType.CHECK_OUT && !ci) {
        rpcError(HttpStatus.BAD_REQUEST, 'Check-in tanggal ini belum ada. Setujui koreksi check-in terlebih dahulu.');
      }
      this.assertOrder(c.type, minutes, ci ? minutesOf(ci.recordedAt) : null, co ? minutesOf(co.recordedAt) : null);

      const existing = c.type === AttendanceType.CHECK_IN ? ci : co;
      const recordedAt = localDateTime(c.attendanceDate, c.requestedTime.slice(0, 5));
      if (existing) await m.update(Attendance, existing.id, { recordedAt, correctionId: c.id });
      else {
        await m.insert(Attendance, {
          employeeId: c.employeeId, type: c.type, attendanceDate: c.attendanceDate, recordedAt, photoPath: null, notes: null, correctionId: c.id,
        });
      }
      // jam lama diambil ulang saat disetujui: bisa berubah sejak pengajuan dibuat
      const res = await m.update(AttendanceCorrection, { id, status: RequestStatus.PENDING }, { ...decision, originalRecordedAt: existing?.recordedAt ?? null });
      if (!res.affected) rpcError(HttpStatus.CONFLICT, 'Pengajuan ini sudah diproses');
    });
    return this.toDto(await this.getOrFail(id));
  }
}
