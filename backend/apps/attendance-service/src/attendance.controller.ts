import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AttendanceQuery, AttendanceType, CreateCorrectionDto, CreateHolidayDto, PATTERNS, RequestQuery, ReviewRequestDto, Reviewer,
} from '@app/common';
import { AttendanceService } from './attendance.service';
import { CalendarService } from './calendar.service';
import { CorrectionService } from './correction.service';

@Controller()
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly calendar: CalendarService,
    private readonly corrections: CorrectionService,
  ) {}

  @MessagePattern(PATTERNS.ATTENDANCE.SUBMIT)
  submit(@Payload() data: { employeeId: number; type: AttendanceType; notes?: string; photoPath: string }) {
    return this.service.submit(data);
  }

  @MessagePattern(PATTERNS.ATTENDANCE.TODAY)
  today(@Payload() data: { employeeId: number }) {
    return this.service.today(data.employeeId);
  }

  @MessagePattern(PATTERNS.ATTENDANCE.MY_HISTORY)
  myHistory(@Payload() data: { employeeId: number; query: AttendanceQuery }) {
    return this.service.myHistory(data.employeeId, data.query);
  }

  @MessagePattern(PATTERNS.ATTENDANCE.FIND_ALL)
  findAll(@Payload() query: AttendanceQuery) {
    return this.service.findAll(query);
  }

  @MessagePattern(PATTERNS.ATTENDANCE.FIND_ONE)
  findOne(@Payload() data: { id: number }) {
    return this.service.findOne(data.id);
  }

  @MessagePattern(PATTERNS.ATTENDANCE.EXPORT)
  export(@Payload() query: AttendanceQuery) {
    return this.service.export(query);
  }

  @MessagePattern(PATTERNS.ATTENDANCE.SUMMARY)
  summary() {
    return this.service.summary();
  }

  @MessagePattern(PATTERNS.ATTENDANCE.RECAP)
  recap(@Payload() data: { month?: string }) {
    return this.service.recap(data.month);
  }

  /* ---------- Hari libur ---------- */
  @MessagePattern(PATTERNS.HOLIDAY.LIST)
  holidays(@Payload() data: { year?: number }) {
    return this.calendar.list(data.year);
  }

  @MessagePattern(PATTERNS.HOLIDAY.CREATE)
  createHoliday(@Payload() dto: CreateHolidayDto) {
    return this.calendar.create(dto);
  }

  @MessagePattern(PATTERNS.HOLIDAY.DELETE)
  deleteHoliday(@Payload() data: { id: number }) {
    return this.calendar.remove(data.id);
  }

  @MessagePattern(PATTERNS.HOLIDAY.SET_ACTIVE)
  setHolidayActive(@Payload() data: { id: number; isActive: boolean }) {
    return this.calendar.setActive(data.id, data.isActive);
  }

  @MessagePattern(PATTERNS.HOLIDAY.SYNC)
  syncHolidays() {
    return this.calendar.sync();
  }

  /* ---------- Koreksi absen ---------- */
  @MessagePattern(PATTERNS.CORRECTION.CREATE)
  createCorrection(@Payload() data: { employeeId: number; dto: CreateCorrectionDto }) {
    return this.corrections.create(data.employeeId, data.dto);
  }

  @MessagePattern(PATTERNS.CORRECTION.MY_LIST)
  myCorrections(@Payload() data: { employeeId: number; query: RequestQuery }) {
    return this.corrections.myList(data.employeeId, data.query);
  }

  @MessagePattern(PATTERNS.CORRECTION.FIND_ALL)
  allCorrections(@Payload() query: RequestQuery) {
    return this.corrections.findAll(query);
  }

  @MessagePattern(PATTERNS.CORRECTION.CANCEL)
  cancelCorrection(@Payload() data: { employeeId: number; id: number }) {
    return this.corrections.cancel(data.employeeId, data.id);
  }

  @MessagePattern(PATTERNS.CORRECTION.REVIEW)
  reviewCorrection(@Payload() data: { id: number; reviewer: Reviewer; dto: ReviewRequestDto }) {
    return this.corrections.review(data.id, data.reviewer, data.dto);
  }
}
