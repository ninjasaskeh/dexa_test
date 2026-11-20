import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ATTENDANCE_SERVICE, CreateHolidayDto, HolidayQuery, PATTERNS, Role, UpdateHolidayDto, ZodValidationPipe,
  createHolidaySchema, holidayQuerySchema, idParamSchema, sendRpc, updateHolidaySchema,
} from '@app/common';
import { Roles } from '../auth/auth.decorators';

/** Hari libur dikelola HRD; semua user yang login boleh melihat */
@Controller('holidays')
export class HolidaysController {
  constructor(@Inject(ATTENDANCE_SERVICE) private readonly attendance: ClientProxy) {}

  @Get()
  list(@Query(new ZodValidationPipe(holidayQuerySchema)) query: HolidayQuery) {
    return sendRpc(this.attendance, PATTERNS.HOLIDAY.LIST, query);
  }

  @Roles(Role.HR_ADMIN)
  @Post()
  create(@Body(new ZodValidationPipe(createHolidaySchema)) dto: CreateHolidayDto) {
    return sendRpc(this.attendance, PATTERNS.HOLIDAY.CREATE, dto);
  }

  /** Ambil ulang libur nasional & cuti bersama dari HOLIDAY_SYNC_URL */
  @Roles(Role.HR_ADMIN)
  @Post('sync')
  @HttpCode(200)
  sync() {
    return sendRpc(this.attendance, PATTERNS.HOLIDAY.SYNC, {});
  }

  /** { isActive: true } menampilkan lagi libur sinkron yang disembunyikan */
  @Roles(Role.HR_ADMIN)
  @Patch(':id')
  update(@Param('id', new ZodValidationPipe(idParamSchema)) id: number, @Body(new ZodValidationPipe(updateHolidaySchema)) dto: UpdateHolidayDto) {
    return sendRpc(this.attendance, PATTERNS.HOLIDAY.SET_ACTIVE, { id, isActive: dto.isActive });
  }

  /** Libur MANUAL dihapus, libur hasil sinkron disembunyikan */
  @Roles(Role.HR_ADMIN)
  @Delete(':id')
  remove(@Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    return sendRpc(this.attendance, PATTERNS.HOLIDAY.DELETE, { id });
  }
}
