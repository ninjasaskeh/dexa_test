import 'dotenv/config';
import { bootstrapTcpService } from '@app/common';
import { LeaveModule } from './leave.module';

bootstrapTcpService(LeaveModule, 'LeaveService', 'LEAVE_SERVICE_HOST', 'LEAVE_SERVICE_PORT', 4004);
