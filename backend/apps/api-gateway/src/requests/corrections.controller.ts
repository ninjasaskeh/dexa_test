import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ATTENDANCE_SERVICE, AuthUser, CreateCorrectionDto, EMPLOYEE_SERVICE, PATTERNS, RequestQuery, ReviewRequestDto, Role, ZodValidationPipe,
  createCorrectionSchema, idParamSchema, requestQuerySchema, reviewRequestSchema, sendRpc,
} from '@app/common';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { employeeIdOf, reviewerOf } from '../common/employee';

/** Pengajuan koreksi jam absen (lupa check-in / check-out) */
@Controller('corrections')
export class CorrectionsController {
  constructor(
    @Inject(ATTENDANCE_SERVICE) private readonly attendance: ClientProxy,
    @Inject(EMPLOYEE_SERVICE) private readonly employees: ClientProxy,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodValidationPipe(createCorrectionSchema)) dto: CreateCorrectionDto) {
    return sendRpc(this.attendance, PATTERNS.CORRECTION.CREATE, { employeeId: await employeeIdOf(this.employees, user), dto });
  }

  @Get('me')
  async mine(@CurrentUser() user: AuthUser, @Query(new ZodValidationPipe(requestQuerySchema)) query: RequestQuery) {
    return sendRpc(this.attendance, PATTERNS.CORRECTION.MY_LIST, { employeeId: await employeeIdOf(this.employees, user), query });
  }

  @Patch(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id', new ZodValidationPipe(idParamSchema)) id: number) {
    return sendRpc(this.attendance, PATTERNS.CORRECTION.CANCEL, { employeeId: await employeeIdOf(this.employees, user), id });
  }

  @Roles(Role.HR_ADMIN)
  @Get()
  findAll(@Query(new ZodValidationPipe(requestQuerySchema)) query: RequestQuery) {
    return sendRpc(this.attendance, PATTERNS.CORRECTION.FIND_ALL, query);
  }

  @Roles(Role.HR_ADMIN)
  @Patch(':id/review')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodValidationPipe(idParamSchema)) id: number,
    @Body(new ZodValidationPipe(reviewRequestSchema)) dto: ReviewRequestDto,
  ) {
    return sendRpc(this.attendance, PATTERNS.CORRECTION.REVIEW, { id, reviewer: await reviewerOf(this.employees, user), dto });
  }
}
