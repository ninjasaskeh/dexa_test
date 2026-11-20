import 'dotenv/config';
import { bootstrapTcpService } from '@app/common';
import { AuthModule } from './auth.module';

bootstrapTcpService(AuthModule, 'AuthService', 'AUTH_SERVICE_HOST', 'AUTH_SERVICE_PORT', 4001);
