import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule, DatabaseModule, EMPLOYEE_SERVICE, registerServiceClients } from '@app/common';
import { LeaveController } from './leave.controller';
import { LeaveRequest } from './leave.entity';
import { LeaveService } from './leave.service';

@Module({
  imports: [AppConfigModule, DatabaseModule.forRoot([LeaveRequest]), TypeOrmModule.forFeature([LeaveRequest]), registerServiceClients(EMPLOYEE_SERVICE)],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
