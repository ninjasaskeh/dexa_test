import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CreateDepartmentDto, CreatePositionDto, EMPLOYEE_SERVICE, PATTERNS, PositionQuery, Role, UpdateDepartmentDto, UpdatePositionDto, ZodValidationPipe,
  createDepartmentSchema, createPositionSchema, idParamSchema, positionQuerySchema, sendRpc, updateDepartmentSchema, updatePositionSchema,
} from '@app/common';
import { Roles } from '../auth/auth.decorators';

/** Master departemen & jabatan - khusus HRD */
@Roles(Role.HR_ADMIN)
@Controller()
export class OrganizationController {
  constructor(@Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy) {}

  /** Semua departemen beserta jabatan dan jumlah karyawan aktif */
  @Get('departments')
  list() {
    return sendRpc(this.employees, PATTERNS.DEPARTMENT.LIST, {});
  }

  @Post('departments')
  createDepartment(@Body(new ZodValidationPipe(createDepartmentSchema)) dto: CreateDepartmentDto) {
    return sendRpc(this.employees, PATTERNS.DEPARTMENT.CREATE, dto);
  }

  @Patch('departments/:id')
  updateDepartment(@Param('id', new ZodValidationPipe(idParamSchema)) id: number, @Body(new ZodValidationPipe(updateDepartmentSchema)) dto: UpdateDepartmentDto) {
    return sendRpc(this.employees, PATTERNS.DEPARTMENT.UPDATE, { id, dto });
  }

  /** Hanya bila belum dipakai karyawan; selain itu nonaktifkan lewat PATCH { isActive: false } */
  @Delete('departments/:id')
  deleteDepartment(@Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    return sendRpc(this.employees, PATTERNS.DEPARTMENT.DELETE, { id });
  }

  /** Semua jabatan beserta departemennya (opsional difilter `departmentId`) */
  @Get('positions')
  listPositions(@Query(new ZodValidationPipe(positionQuerySchema)) query: PositionQuery) {
    return sendRpc(this.employees, PATTERNS.POSITION.LIST, query);
  }

  @Post('positions')
  createPosition(@Body(new ZodValidationPipe(createPositionSchema)) dto: CreatePositionDto) {
    return sendRpc(this.employees, PATTERNS.POSITION.CREATE, dto);
  }

  @Patch('positions/:id')
  updatePosition(@Param('id', new ZodValidationPipe(idParamSchema)) id: number, @Body(new ZodValidationPipe(updatePositionSchema)) dto: UpdatePositionDto) {
    return sendRpc(this.employees, PATTERNS.POSITION.UPDATE, { id, dto });
  }

  @Delete('positions/:id')
  deletePosition(@Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    return sendRpc(this.employees, PATTERNS.POSITION.DELETE, { id });
  }
}
