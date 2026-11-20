import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  AttendanceQuery, AttendanceType, EMPLOYEE_SERVICE, EmployeeLite, LEAVE_SERVICE, LeaveType, PATTERNS,
  eachDate, hhmmToMinutes, localDate, paginate, rpcError, sendRpc, withEmployees,
} from '@app/common';
import { Attendance } from './attendance.entity';
import { CalendarService } from './calendar.service';

type ActiveEmployee = EmployeeLite & { joinDate: string };
interface LeaveLite { id: number; employeeId: number; type: LeaveType; startDate: string; endDate: string }

/** Batas jumlah baris sekali export CSV */
export const EXPORT_MAX_ROWS = 10_000;

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance) private readonly repo: Repository<Attendance>,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
    @Inject(LEAVE_SERVICE) private readonly leaves: ClientProxy,
    private readonly calendar: CalendarService,
  ) {}

  /** true bila jam server sudah melewati CHECK_OUT_MAX_TIME */
  private isClosed(now = new Date()) {
    return minutesOf(now) > hhmmToMinutes(this.calendar.checkOutMaxTime);
  }

  /** Check-in setelah WORK_START_TIME dianggap terlambat */
  private decorate(a: Attendance) {
    const isLate = a.type === AttendanceType.CHECK_IN && minutesOf(new Date(a.recordedAt)) > hhmmToMinutes(this.calendar.workStartTime);
    return { ...a, isLate };
  }

  /** Cuti/izin/sakit yang sudah disetujui dan beririsan dengan [from, to] (dari leave-service) */
  private approvedLeaves(from: string, to: string, employeeIds?: number[]) {
    return sendRpc<LeaveLite[]>(this.leaves, PATTERNS.LEAVE.APPROVED_IN_RANGE, { from, to, employeeIds });
  }

  private activeEmployees() {
    return sendRpc<ActiveEmployee[]>(this.employees, PATTERNS.EMPLOYEE.ACTIVE_LITE, {});
  }

  async submit(data: { employeeId: number; type: AttendanceType; notes?: string; photoPath: string }) {
    const today = localDate();
    const existing = await this.repo.findBy({ employeeId: data.employeeId, attendanceDate: today });
    const has = (t: AttendanceType) => existing.some((a) => a.type === t);

    if (has(data.type)) {
      rpcError(HttpStatus.CONFLICT, data.type === AttendanceType.CHECK_IN ? 'Anda sudah check-in hari ini' : 'Anda sudah check-out hari ini');
    }
    if (this.isClosed()) {
      rpcError(HttpStatus.BAD_REQUEST, `Absensi hari ini sudah ditutup (batas pukul ${this.calendar.checkOutMaxTime})`);
    }
    if (data.type === AttendanceType.CHECK_OUT && !has(AttendanceType.CHECK_IN)) {
      rpcError(HttpStatus.BAD_REQUEST, 'Silakan check-in terlebih dahulu sebelum check-out');
    }
    const saved = await this.repo.save(this.repo.create({
      employeeId: data.employeeId, type: data.type, attendanceDate: today, recordedAt: new Date(), photoPath: data.photoPath, notes: data.notes || null,
    }));
    return this.decorate(saved);
  }

  async today(employeeId: number) {
    const date = localDate();
    const [rows, day, leaves] = await Promise.all([
      this.repo.findBy({ employeeId, attendanceDate: date }),
      this.calendar.day(date),
      // halaman absen tetap jalan walau leave-service sedang mati
      this.approvedLeaves(date, date, [employeeId]).catch(() => [] as LeaveLite[]),
    ]);
    const find = (t: AttendanceType) => rows.find((r) => r.type === t);
    const ci = find(AttendanceType.CHECK_IN);
    const co = find(AttendanceType.CHECK_OUT);
    const leave = leaves[0];
    return {
      date,
      now: new Date().toISOString(),
      workStartTime: this.calendar.workStartTime,
      checkOutMaxTime: this.calendar.checkOutMaxTime,
      closed: this.isClosed(),
      isWorkDay: day.isWorkDay,
      holidayName: day.holidayName,
      leave: leave ? { id: leave.id, type: leave.type, startDate: leave.startDate, endDate: leave.endDate } : null,
      checkIn: ci ? this.decorate(ci) : null,
      checkOut: co ? this.decorate(co) : null,
    };
  }

  /** Dipakai gateway untuk cek kepemilikan sebelum mengirim file foto */
  async findOne(id: number) {
    const a = await this.repo.findOneBy({ id });
    if (!a) rpcError(HttpStatus.NOT_FOUND, 'Data absensi tidak ditemukan');
    return { id: a.id, employeeId: a.employeeId, photoPath: a.photoPath };
  }

  private baseQuery(q: AttendanceQuery) {
    const qb = this.repo.createQueryBuilder('a')
      .orderBy('a.recorded_at', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    if (q.from) qb.andWhere('a.attendance_date >= :from', { from: q.from });
    if (q.to) qb.andWhere('a.attendance_date <= :to', { to: q.to });
    if (q.type) qb.andWhere('a.type = :type', { type: q.type });
    if (q.employeeId) qb.andWhere('a.employee_id = :eid', { eid: q.employeeId });
    return qb;
  }

  async myHistory(employeeId: number, q: AttendanceQuery) {
    const [rows, total] = await this.baseQuery({ ...q, employeeId }).getManyAndCount();
    return paginate(rows.map((r) => this.decorate(r)), total, q.page, q.limit);
  }

  /** Untuk HRD: semua absensi + data karyawan dari employee-service */
  async findAll(q: AttendanceQuery) {
    const qb = this.baseQuery(q);
    if (q.search) {
      const ids = await sendRpc<number[]>(this.employees, PATTERNS.EMPLOYEE.SEARCH_IDS, { search: q.search });
      if (!ids.length) return paginate([], 0, q.page, q.limit);
      qb.andWhere('a.employee_id IN (:...ids)', { ids });
    }
    const [rows, total] = await qb.getManyAndCount();
    return paginate(await withEmployees(this.employees, rows.map((r) => this.decorate(r))), total, q.page, q.limit);
  }

  /** Semua baris sesuai filter monitoring (tanpa paginasi) untuk export CSV */
  async export(q: AttendanceQuery) {
    const res = await this.findAll({ ...q, page: 1, limit: EXPORT_MAX_ROWS });
    if (res.meta.total > EXPORT_MAX_ROWS) {
      rpcError(HttpStatus.BAD_REQUEST, `Data terlalu banyak untuk diekspor (${res.meta.total} baris, maksimal ${EXPORT_MAX_ROWS}). Persempit rentang tanggal.`);
    }
    return res.data;
  }

  /** Ringkasan dashboard HRD: kehadiran hari ini per karyawan & departemen + tren 7 hari */
  async summary() {
    const today = localDate();
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const startDate = localDate(start);

    const [todayRows, active, cal, leaves] = await Promise.all([
      this.repo.findBy({ attendanceDate: today }),
      this.activeEmployees(),
      this.calendar.range(startDate, today),
      this.approvedLeaves(today, today),
    ]);
    const day = cal.get(today)!;
    const checkIns = todayRows.filter((r) => r.type === AttendanceType.CHECK_IN).map((r) => this.decorate(r));
    const presentIds = new Set(checkIns.map((c) => c.employeeId));
    const lateIds = new Set(checkIns.filter((c) => c.isLate).map((c) => c.employeeId));
    const leaveByEmployee = new Map(leaves.map((l) => [l.employeeId, l.type]));

    const departments = new Map<string, { department: string; total: number; present: number }>();
    for (const e of active) {
      const d = departments.get(e.department) ?? { department: e.department, total: 0, present: 0 };
      d.total += 1;
      if (presentIds.has(e.id)) d.present += 1;
      departments.set(e.department, d);
    }
    const lite = ({ id, nip, fullName, department, position }: ActiveEmployee): EmployeeLite => ({ id, nip, fullName, department, position });
    const onLeave = active
      .filter((e) => leaveByEmployee.has(e.id) && !presentIds.has(e.id))
      .map((e) => ({ ...lite(e), leaveType: leaveByEmployee.get(e.id)! }));
    // di luar hari kerja tidak ada yang "belum check-in"
    const notCheckedIn = day.isWorkDay ? active.filter((e) => !presentIds.has(e.id) && !leaveByEmployee.has(e.id)).map(lite) : [];
    const presentActive = active.filter((e) => presentIds.has(e.id)).length;
    const lateActive = active.filter((e) => lateIds.has(e.id)).length;

    const raw = await this.repo.createQueryBuilder('a')
      .select('a.attendance_date', 'date')
      .addSelect("SUM(a.type = 'CHECK_IN')", 'checkIn')
      .addSelect("SUM(a.type = 'CHECK_OUT')", 'checkOut')
      // sama dengan aturan isLate: terlambat bila menit check-in > menit WORK_START_TIME
      .addSelect("SUM(a.type = 'CHECK_IN' AND TIME(a.recorded_at) > :lateAfter)", 'late')
      .where('a.attendance_date >= :start', { start: startDate })
      .setParameter('lateAfter', `${this.calendar.workStartTime}:59`)
      .groupBy('a.attendance_date')
      .getRawMany<{ date: string | Date; checkIn: string; checkOut: string; late: string }>();
    const byDate = new Map(raw.map((r) => [typeof r.date === 'string' ? r.date.slice(0, 10) : localDate(r.date), r]));

    const trend = [...cal.values()].map((c) => {
      const r = byDate.get(c.date);
      const checkIn = Number(r?.checkIn ?? 0);
      const late = Number(r?.late ?? 0);
      return { date: c.date, isWorkDay: c.isWorkDay, holidayName: c.holidayName, checkIn, checkOut: Number(r?.checkOut ?? 0), late, onTime: checkIn - late };
    });

    return {
      date: today,
      workStartTime: this.calendar.workStartTime,
      checkOutMaxTime: this.calendar.checkOutMaxTime,
      now: new Date().toISOString(),
      isWorkDay: day.isWorkDay,
      holidayName: day.holidayName,
      activeEmployees: active.length,
      presentToday: presentActive,
      onTimeToday: presentActive - lateActive,
      notCheckedIn,
      onLeave,
      departments: [...departments.values()].sort((a, b) => b.total - a.total || a.department.localeCompare(b.department)),
      checkedInToday: checkIns.length,
      checkedOutToday: todayRows.filter((r) => r.type === AttendanceType.CHECK_OUT).length,
      lateToday: lateActive,
      trend,
    };
  }

  /**
   * Rekap bulanan per karyawan aktif: hari kerja, hadir, terlambat, tanpa check-out, cuti/izin/sakit, alpa.
   * Dihitung sampai hari ini (jam server). Hari ini baru dihitung bila karyawan sudah check-in atau sedang cuti.
   */
  async recap(month?: string) {
    const today = localDate();
    const m = month ?? today.slice(0, 7);
    if (m > today.slice(0, 7)) rpcError(HttpStatus.BAD_REQUEST, 'Rekap hanya tersedia untuk bulan yang sudah berjalan');
    const [y, mo] = m.split('-').map(Number);
    const from = `${m}-01`;
    const monthEnd = localDate(new Date(y, mo, 0));
    const to = monthEnd < today ? monthEnd : today;

    const [active, rows, cal, leaves] = await Promise.all([
      this.activeEmployees(),
      this.repo.findBy({ attendanceDate: Between(from, to) }),
      this.calendar.range(from, to),
      this.approvedLeaves(from, to),
    ]);

    const records = new Map<number, Map<string, { in?: Attendance; out?: Attendance }>>();
    for (const r of rows) {
      const byDay = records.get(r.employeeId) ?? new Map<string, { in?: Attendance; out?: Attendance }>();
      const d = byDay.get(r.attendanceDate) ?? {};
      if (r.type === AttendanceType.CHECK_IN) d.in = r;
      else d.out = r;
      byDay.set(r.attendanceDate, d);
      records.set(r.employeeId, byDay);
    }
    const leaveDays = new Map<number, Map<string, LeaveType>>();
    for (const l of leaves) {
      const byDay = leaveDays.get(l.employeeId) ?? new Map<string, LeaveType>();
      for (const d of eachDate(l.startDate > from ? l.startDate : from, l.endDate < to ? l.endDate : to)) byDay.set(d, l.type);
      leaveDays.set(l.employeeId, byDay);
    }

    const days = [...cal.values()];
    const data = active.map((e) => {
      const mine = records.get(e.id);
      const myLeave = leaveDays.get(e.id);
      const s = { workDays: 0, present: 0, late: 0, noCheckOut: 0, leave: { CUTI: 0, IZIN: 0, SAKIT: 0 } as Record<LeaveType, number>, absent: 0, extraDays: 0, workMinutes: 0 };
      for (const day of days) {
        if (day.date < e.joinDate) continue;
        const rec = mine?.get(day.date);
        const leave = myLeave?.get(day.date);
        if (rec?.in && rec.out) s.workMinutes += Math.max(0, Math.round((new Date(rec.out.recordedAt).getTime() - new Date(rec.in.recordedAt).getTime()) / 60000));
        if (rec?.in && !rec.out && day.date < today) s.noCheckOut += 1;
        if (!day.isWorkDay) {
          if (rec?.in) s.extraDays += 1;
          continue;
        }
        if (day.date === today && !rec?.in && !leave) continue;
        s.workDays += 1;
        if (rec?.in) {
          s.present += 1;
          if (this.decorate(rec.in).isLate) s.late += 1;
        } else if (leave) s.leave[leave] += 1;
        else s.absent += 1;
      }
      const { joinDate: _joinDate, ...employee } = e;
      return { employee, ...s };
    });

    return {
      month: m,
      from,
      to,
      today,
      workStartTime: this.calendar.workStartTime,
      workDays: days.filter((d) => d.isWorkDay).length,
      holidays: days.filter((d) => d.holidayName).map((d) => ({ date: d.date, name: d.holidayName! })),
      data,
    };
  }
}
