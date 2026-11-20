import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateDepartmentDto, CreateEmployeeDto, CreatePositionDto, ListEmployeeQuery, PATTERNS, PositionQuery, UpdateDepartmentDto, UpdateEmployeeDto, UpdatePositionDto,
} from '@app/common';
import { EmployeeService } from './employee.service';
import { OrganizationService } from './organization.service';

@Controller()
export class EmployeeController {
  constructor(
    private readonly service: EmployeeService,
    private readonly org: OrganizationService,
  ) {}

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

  @MessagePattern(PATTERNS.EMPLOYEE.FIND_BY_NIP)
  findByNip(@Payload() data: { nip: string }) {
    return this.service.findByNip(data.nip);
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

  @MessagePattern(PATTERNS.DEPARTMENT.LIST)
  listDepartments() {
    return this.org.list();
  }

  @MessagePattern(PATTERNS.DEPARTMENT.CREATE)
  createDepartment(@Payload() dto: CreateDepartmentDto) {
    return this.org.createDepartment(dto);
  }

  @MessagePattern(PATTERNS.DEPARTMENT.UPDATE)
  updateDepartment(@Payload() data: { id: number; dto: UpdateDepartmentDto }) {
    return this.org.updateDepartment(data.id, data.dto);
  }

  @MessagePattern(PATTERNS.DEPARTMENT.DELETE)
  deleteDepartment(@Payload() data: { id: number }) {
    return this.org.deleteDepartment(data.id);
  }

  @MessagePattern(PATTERNS.POSITION.LIST)
  listPositions(@Payload() q: PositionQuery) {
    return this.org.listPositions(q);
  }

  @MessagePattern(PATTERNS.POSITION.CREATE)
  createPosition(@Payload() dto: CreatePositionDto) {
    return this.org.createPosition(dto);
  }

  @MessagePattern(PATTERNS.POSITION.UPDATE)
  updatePosition(@Payload() data: { id: number; dto: UpdatePositionDto }) {
    return this.org.updatePosition(data.id, data.dto);
  }

  @MessagePattern(PATTERNS.POSITION.DELETE)
  deletePosition(@Payload() data: { id: number }) {
    return this.org.deletePosition(data.id);
  }
}
