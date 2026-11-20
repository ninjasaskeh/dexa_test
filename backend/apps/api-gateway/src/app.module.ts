import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MulterModule } from '@nestjs/platform-express';
import { ATTENDANCE_SERVICE, AUTH_SERVICE, AppConfigModule, EMPLOYEE_SERVICE, LEAVE_SERVICE, RedisModule, registerServiceClients } from '@app/common';
import { AttendanceController } from './attendance/attendance.controller';
import { multerOptions } from './attendance/upload.config';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { LoginLimiter } from './auth/login-limiter';
import { EmployeesController } from './employees/employees.controller';
import { HealthController } from './health.controller';
import { CorrectionsController } from './requests/corrections.controller';
import { HolidaysController } from './requests/holidays.controller';
import { LeaveController } from './requests/leave.controller';

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    registerServiceClients(AUTH_SERVICE, EMPLOYEE_SERVICE, ATTENDANCE_SERVICE, LEAVE_SERVICE),
    MulterModule.registerAsync({ useFactory: multerOptions }),
  ],
  controllers: [HealthController, AuthController, EmployeesController, AttendanceController, HolidaysController, LeaveController, CorrectionsController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }, LoginLimiter],
})
export class AppModule {}
