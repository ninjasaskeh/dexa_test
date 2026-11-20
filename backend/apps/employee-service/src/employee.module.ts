import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_SERVICE, AppConfigModule, DatabaseModule, registerServiceClients } from '@app/common';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';

@Module({
  imports: [AppConfigModule, DatabaseModule.forRoot([Employee]), TypeOrmModule.forFeature([Employee]), registerServiceClients(AUTH_SERVICE)],
  controllers: [EmployeeController],
  providers: [EmployeeService],
})
export class EmployeeModule {}
