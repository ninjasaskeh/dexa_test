import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AttendanceType, RequestStatus } from '@app/common';

/** Pengajuan koreksi jam absen; sekaligus jejak audit perubahan jam absen */
@Entity('attendance_corrections')
export class AttendanceCorrection {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'employee_id', unsigned: true })
  employeeId: number;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ type: 'enum', enum: AttendanceType })
  type: AttendanceType;

  /** "HH:mm:ss" */
  @Column({ name: 'requested_time', type: 'time' })
  requestedTime: string;

  /** Jam yang tercatat sebelum koreksi (null bila sebelumnya tidak ada absen) */
  @Column({ name: 'original_recorded_at', type: 'datetime', nullable: true })
  originalRecordedAt: Date | null;

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
