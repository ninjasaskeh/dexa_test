import 'dotenv/config';
import { bootstrapTcpService } from '@app/common';
import { EmployeeModule } from './employee.module';

bootstrapTcpService(EmployeeModule, 'EmployeeService', 'EMPLOYEE_SERVICE_HOST', 'EMPLOYEE_SERVICE_PORT', 4002);
