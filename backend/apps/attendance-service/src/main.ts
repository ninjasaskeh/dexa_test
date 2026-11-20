import 'dotenv/config';
import { bootstrapTcpService } from '@app/common';
import { AttendanceModule } from './attendance.module';

bootstrapTcpService(AttendanceModule, 'AttendanceService', 'ATTENDANCE_SERVICE_HOST', 'ATTENDANCE_SERVICE_PORT', 4003);
