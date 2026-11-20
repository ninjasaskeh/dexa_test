import {
  BadRequestException, Body, Controller, Get, Inject, NotFoundException, Param, Post, Query, Res, UploadedFile, UseFilters, UseInterceptors,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ATTENDANCE_SERVICE, AttendanceQuery, AttendanceType, AuthUser, EMPLOYEE_SERVICE, EmployeeLite, PATTERNS, RecapQuery, Role,
  SubmitAttendanceDto, ZodValidationPipe, attendanceQuerySchema, idParamSchema, recapQuerySchema, sendRpc, submitAttendanceSchema,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { sendCsv } from '../common/csv';
import { employeeIdOf } from '../common/employee';
import { UPLOAD_ROOT, UploadTooLargeFilter, assertRealImage } from './upload.config';

interface AttendanceRow {
  attendanceDate: string;
  recordedAt: string;
  type: AttendanceType;
  isLate: boolean;
  notes: string | null;
  correctionId: number | null;
  employee: EmployeeLite | null;
}

interface RecapRow {
  employee: EmployeeLite;
  workDays: number;
  present: number;
  late: number;
  noCheckOut: number;
  leave: { CUTI: number; IZIN: number; SAKIT: number };
  absent: number;
  extraDays: number;
  workMinutes: number;
}

/** Jam lokal gateway (TZ sama dengan service) */
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

@Controller('attendance')
export class AttendanceController {
  constructor(
    @Inject(ATTENDANCE_SERVICE) private readonly attendance: ClientProxy,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
  ) {}

  /** Karyawan absen (check-in / check-out) dengan foto bukti WFH */
  @Post()
  @UseFilters(UploadTooLargeFilter)
  @UseInterceptors(FileInterceptor('photo'))
  async submit(
    @CurrentUser() user: AuthUser,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    if (!photo) throw new BadRequestException({ statusCode: 400, message: 'Validasi gagal', errors: { photo: 'Foto bukti WFH wajib diunggah' } });
    const photoPath = path.relative(UPLOAD_ROOT, photo.path).split(path.sep).join('/');
    try {
      // validasi di dalam try agar foto dihapus bila body tidak valid
      await assertRealImage(photo.path, photo.mimetype);
      const dto: SubmitAttendanceDto = new ZodValidationPipe(submitAttendanceSchema).transform(body);
      const employeeId = await employeeIdOf(this.employees, user);
      return await sendRpc(this.attendance, PATTERNS.ATTENDANCE.SUBMIT, { employeeId, ...dto, photoPath });
    } catch (e) {
      await fs.unlink(photo.path).catch(() => undefined); // jangan simpan foto yatim
      throw e;
    }
  }

  @Get('today')
  async today(@CurrentUser() user: AuthUser) {
    return sendRpc(this.attendance, PATTERNS.ATTENDANCE.TODAY, { employeeId: await employeeIdOf(this.employees, user) });
  }

  @Get('me')
  async myHistory(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(attendanceQuerySchema)) query: AttendanceQuery) {
    return sendRpc(this.attendance, PATTERNS.ATTENDANCE.MY_HISTORY, { employeeId: await employeeIdOf(this.employees, user), query });
  }

  /** Monitoring HRD (view only) */
  @Roles(Role.HR_ADMIN)
  @Get()
  findAll(@Query(new ZodValidationPipe(attendanceQuerySchema)) query: AttendanceQuery) {
    return sendRpc(this.attendance, PATTERNS.ATTENDANCE.FIND_ALL, query);
  }

  /** Export CSV dengan filter yang sama seperti monitoring (tanpa paginasi) */
  @Roles(Role.HR_ADMIN)
  @Get('export')
  async export(@Query(new ZodValidationPipe(attendanceQuerySchema)) query: AttendanceQuery, @Res() res: Response) {
    const rows = await sendRpc<AttendanceRow[]>(this.attendance, PATTERNS.ATTENDANCE.EXPORT, query);
    const range = query.from ? `${query.from}_${query.to ?? query.from}` : 'semua';
    sendCsv(
      res,
      `absensi_${range}.csv`,
      ['Tanggal', 'Jam', 'Kode Karyawan', 'Nama', 'Departemen', 'Jabatan', 'Tipe', 'Status', 'Catatan', 'Sumber'],
      rows.map((a) => [
        a.attendanceDate, hhmm(a.recordedAt), a.employee?.employeeCode, a.employee?.fullName, a.employee?.department, a.employee?.position,
        a.type === AttendanceType.CHECK_IN ? 'Check-in' : 'Check-out',
        a.type === AttendanceType.CHECK_IN ? (a.isLate ? 'Terlambat' : 'Tepat waktu') : '',
        a.notes, a.correctionId ? 'Koreksi HRD' : 'Foto',
      ]),
    );
  }

  @Roles(Role.HR_ADMIN)
  @Get('summary')
  summary() {
    return sendRpc(this.attendance, PATTERNS.ATTENDANCE.SUMMARY, {});
  }

  /** Rekap bulanan per karyawan aktif (default: bulan berjalan menurut jam server) */
  @Roles(Role.HR_ADMIN)
  @Get('recap')
  recap(@Query(new ZodValidationPipe(recapQuerySchema)) query: RecapQuery) {
    return sendRpc(this.attendance, PATTERNS.ATTENDANCE.RECAP, query);
  }

  @Roles(Role.HR_ADMIN)
  @Get('recap/export')
  async recapExport(@Query(new ZodValidationPipe(recapQuerySchema)) query: RecapQuery, @Res() res: Response) {
    const recap = await sendRpc<{ month: string; data: RecapRow[] }>(this.attendance, PATTERNS.ATTENDANCE.RECAP, query);
    sendCsv(
      res,
      `rekap_absensi_${recap.month}.csv`,
      ['Kode Karyawan', 'Nama', 'Departemen', 'Jabatan', 'Hari Kerja', 'Hadir', 'Terlambat', 'Tanpa Check-out', 'Cuti', 'Izin', 'Sakit', 'Alpa', 'Masuk di Hari Libur', 'Total Jam Kerja', 'Kehadiran (%)'],
      recap.data.map((r) => [
        r.employee.employeeCode, r.employee.fullName, r.employee.department, r.employee.position,
        r.workDays, r.present, r.late, r.noCheckOut, r.leave.CUTI, r.leave.IZIN, r.leave.SAKIT, r.absent, r.extraDays,
        (r.workMinutes / 60).toFixed(1), r.workDays ? Math.round((r.present / r.workDays) * 100) : '',
      ]),
    );
  }

  /** Foto bukti: hanya pemilik absen atau HRD. Path file tidak pernah dikirim ke client. */
  @Get(':id/photo')
  async photo(@CurrentUser() user: AuthUser, @Param('id', new ZodValidationPipe(idParamSchema)) id: number, @Res() res: Response) {
    const a = await sendRpc<{ employeeId: number; photoPath: string | null }>(this.attendance, PATTERNS.ATTENDANCE.FIND_ONE, { id });
    // 404 (bukan 403) agar karyawan lain tidak bisa menebak id absen yang ada
    if (user.role !== Role.HR_ADMIN && a.employeeId !== (await employeeIdOf(this.employees, user))) throw new NotFoundException('Foto tidak ditemukan');
    if (!a.photoPath) throw new NotFoundException('Absen ini dibuat dari koreksi dan tidak memiliki foto');
    const file = path.resolve(UPLOAD_ROOT, a.photoPath);
    if (!file.startsWith(UPLOAD_ROOT + path.sep)) throw new NotFoundException('Foto tidak ditemukan');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: 'File foto tidak ditemukan' });
    });
  }
}
