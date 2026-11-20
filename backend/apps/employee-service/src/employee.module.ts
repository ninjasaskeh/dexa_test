import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_SERVICE, AppConfigModule, DatabaseModule, registerServiceClients } from '@app/common';
import { EmployeeController } from './employee.controller';
import { Employee } from './employee.entity';
import { EmployeeService } from './employee.service';
import { Department, Position } from './organization.entity';
import { OrganizationService } from './organization.service';

@Module({
  imports: [AppConfigModule, DatabaseModule.forRoot([Employee, Department, Position]), TypeOrmModule.forFeature([Employee, Department, Position]), registerServiceClients(AUTH_SERVICE)],
  controllers: [EmployeeController],
  providers: [EmployeeService, OrganizationService],
})
export class EmployeeModule {}
