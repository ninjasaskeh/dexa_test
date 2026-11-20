import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { LeaveType, RequestStatus } from '@app/common';

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** Relasi ke employees (dimiliki employee-service) */
  @Column({ name: 'employee_id', unsigned: true })
  employeeId: number;

  @Column({ type: 'enum', enum: LeaveType })
  type: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ length: 255 })
  reason: string;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  /** users.id HRD yang memproses */
  @Column({ name: 'reviewed_by', type: 'int', unsigned: true, nullable: true })
  reviewedBy: number | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_note', type: 'varchar', length: 255, nullable: true })
  reviewNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
