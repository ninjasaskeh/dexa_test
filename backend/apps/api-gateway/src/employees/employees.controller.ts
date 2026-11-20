import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthUser, CreateEmployeeDto, EMPLOYEE_SERVICE, ListEmployeeQuery, PATTERNS, Role, UpdateEmployeeDto, ZodValidationPipe,
  createEmployeeSchema, idParamSchema, listEmployeeQuerySchema, sendRpc, updateEmployeeSchema,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';

/** Master data karyawan - khusus HRD */
@Roles(Role.HR_ADMIN)
@Controller('employees')
export class EmployeesController {
  constructor(@Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy) {}

  /** Cegah HRD mengunci dirinya sendiri (menonaktifkan akun / menurunkan role sendiri) */
  private async preventSelfLockout(user: AuthUser, id: number, dto: { isActive?: boolean; role?: Role }) {
    const deactivate = dto.isActive === false;
    const demote = dto.role !== undefined && dto.role !== Role.HR_ADMIN;
    if (!deactivate && !demote) return;
    const target = await sendRpc<{ userId: number }>(this.employees, PATTERNS.EMPLOYEE.FIND_ONE, { id });
    if (target.userId !== user.id) return;
    const errors: Record<string, string> = {};
    if (deactivate) errors.isActive = 'Anda tidak dapat menonaktifkan akun Anda sendiri';
    if (demote) errors.role = 'Anda tidak dapat menurunkan hak akses akun Anda sendiri';
    throw new BadRequestException({ statusCode: 400, message: Object.values(errors)[0], errors });
  }

  @Get()
  findAll(@Query(new ZodValidationPipe(listEmployeeQuerySchema)) query: ListEmployeeQuery) {
    return sendRpc(this.employees, PATTERNS.EMPLOYEE.FIND_ALL, query);
  }

  @Get('stats')
  stats() {
    return sendRpc(this.employees, PATTERNS.EMPLOYEE.STATS, {});
  }

  @Get(':id')
  findOne(@Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    return sendRpc(this.employees, PATTERNS.EMPLOYEE.FIND_ONE, { id });
  }

  @Post()
  create(@Body(new ZodValidationPipe(createEmployeeSchema)) dto: CreateEmployeeDto) {
    return sendRpc(this.employees, PATTERNS.EMPLOYEE.CREATE, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: number,
    @Body(new ZodValidationPipe(updateEmployeeSchema)) dto: UpdateEmployeeDto,
  ) {
    await this.preventSelfLockout(user, id, dto);
    return sendRpc(this.employees, PATTERNS.EMPLOYEE.UPDATE, { id, dto });
  }

  /** Soft delete: menonaktifkan karyawan & akun loginnya (riwayat absensi tetap tersimpan) */
  @Delete(':id')
  async deactivate(@CurrentUser() user: AuthUser, @Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    await this.preventSelfLockout(user, id, { isActive: false });
    return sendRpc(this.employees, PATTERNS.EMPLOYEE.UPDATE, { id, dto: { isActive: false } });
  }
}
