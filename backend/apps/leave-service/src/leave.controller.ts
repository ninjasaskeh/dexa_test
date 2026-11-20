import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateLeaveDto, PATTERNS, RequestQuery, ReviewRequestDto, Reviewer } from '@app/common';
import { LeaveService } from './leave.service';

@Controller()
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @MessagePattern(PATTERNS.LEAVE.CREATE)
  create(@Payload() data: { employeeId: number; dto: CreateLeaveDto }) {
    return this.service.create(data.employeeId, data.dto);
  }

  @MessagePattern(PATTERNS.LEAVE.MY_LIST)
  myList(@Payload() data: { employeeId: number; query: RequestQuery }) {
    return this.service.myList(data.employeeId, data.query);
  }

  @MessagePattern(PATTERNS.LEAVE.FIND_ALL)
  findAll(@Payload() query: RequestQuery) {
    return this.service.findAll(query);
  }

  @MessagePattern(PATTERNS.LEAVE.CANCEL)
  cancel(@Payload() data: { employeeId: number; id: number }) {
    return this.service.cancel(data.employeeId, data.id);
  }

  @MessagePattern(PATTERNS.LEAVE.REVIEW)
  review(@Payload() data: { id: number; reviewer: Reviewer; dto: ReviewRequestDto }) {
    return this.service.review(data.id, data.reviewer, data.dto);
  }

  @MessagePattern(PATTERNS.LEAVE.APPROVED_IN_RANGE)
  approvedInRange(@Payload() data: { from: string; to: string; employeeIds?: number[] }) {
    return this.service.approvedInRange(data.from, data.to, data.employeeIds);
  }
}
