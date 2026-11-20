import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateEmployeeDto, ListEmployeeQuery, PATTERNS, UpdateEmployeeDto } from '@app/common';
import { EmployeeService } from './employee.service';

@Controller()
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}

  @MessagePattern(PATTERNS.EMPLOYEE.CREATE)
  create(@Payload() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @MessagePattern(PATTERNS.EMPLOYEE.FIND_ALL)
  findAll(@Payload() query: ListEmployeeQuery) {
    return this.service.findAll(query);
  }

  @MessagePattern(PATTERNS.EMPLOYEE.FIND_ONE)
  findOne(@Payload() data: { id: number }) {
    return this.service.findOne(data.id);
  }

  @MessagePattern(PATTERNS.EMPLOYEE.FIND_BY_USER)
  findByUser(@Payload() data: { userId: number }) {
    return this.service.findByUser(data.userId);
  }

  @MessagePattern(PATTERNS.EMPLOYEE.FIND_BY_IDS)
  findByIds(@Payload() data: { ids: number[] }) {
    return this.service.findByIds(data.ids ?? []);
  }

  @MessagePattern(PATTERNS.EMPLOYEE.ACTIVE_LITE)
  activeLite() {
    return this.service.activeLite();
  }

  @MessagePattern(PATTERNS.EMPLOYEE.SEARCH_IDS)
  searchIds(@Payload() data: { search: string }) {
    return this.service.searchIds(data.search ?? '');
  }

  @MessagePattern(PATTERNS.EMPLOYEE.UPDATE)
  update(@Payload() data: { id: number; dto: UpdateEmployeeDto }) {
    return this.service.update(data.id, data.dto);
  }

  @MessagePattern(PATTERNS.EMPLOYEE.STATS)
  stats() {
    return this.service.stats();
  }
}
