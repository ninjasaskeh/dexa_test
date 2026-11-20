import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthUser, CreateLeaveDto, EMPLOYEE_SERVICE, LEAVE_SERVICE, PATTERNS, RequestQuery, ReviewRequestDto, Role, ZodValidationPipe,
  createLeaveSchema, idParamSchema, requestQuerySchema, reviewRequestSchema, sendRpc,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { employeeIdOf, reviewerOf } from '../common/employee';

/** Pengajuan cuti / izin / sakit */
@Controller('leave')
export class LeaveController {
  constructor(
    @Inject(LEAVE_SERVICE) private readonly leave: ClientProxy,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createLeaveSchema)) dto: CreateLeaveDto) {
    return sendRpc(this.leave, PATTERNS.LEAVE.CREATE, { employeeId: await employeeIdOf(this.employees, user), dto });
  }

  @Get('me')
  async mine(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(requestQuerySchema)) query: RequestQuery) {
    return sendRpc(this.leave, PATTERNS.LEAVE.MY_LIST, { employeeId: await employeeIdOf(this.employees, user), query });
  }

  @Patch(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    return sendRpc(this.leave, PATTERNS.LEAVE.CANCEL, { employeeId: await employeeIdOf(this.employees, user), id });
  }

  @Roles(Role.HR_ADMIN)
  @Get()
  findAll(@Query(new ZodValidationPipe(requestQuerySchema)) query: RequestQuery) {
    return sendRpc(this.leave, PATTERNS.LEAVE.FIND_ALL, query);
  }

  @Roles(Role.HR_ADMIN)
  @Patch(':id/review')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: number,
    @Body(new ZodValidationPipe(reviewRequestSchema)) dto: ReviewRequestDto,
  ) {
    return sendRpc(this.leave, PATTERNS.LEAVE.REVIEW, { id, reviewer: await reviewerOf(this.employees, user), dto });
  }
}
