import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule, DatabaseModule, EMPLOYEE_SERVICE, LEAVE_SERVICE, RedisModule, registerServiceClients } from '@app/common';
import { AttendanceController } from './attendance.controller';
import { Attendance } from './attendance.entity';
import { AttendanceService } from './attendance.service';
import { CalendarService } from './calendar.service';
import { AttendanceCorrection } from './correction.entity';
import { CorrectionService } from './correction.service';
import { Holiday } from './holiday.entity';

const entities = [Attendance, AttendanceCorrection, Holiday];

@Module({
  imports: [AppConfigModule, RedisModule, DatabaseModule.forRoot(entities), TypeOrmModule.forFeature(entities), registerServiceClients(EMPLOYEE_SERVICE, LEAVE_SERVICE)],
  controllers: [AttendanceController],
  providers: [AttendanceService, CalendarService, CorrectionService],
})
export class AttendanceModule {}
