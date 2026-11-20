import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AttendanceType } from '@app/common';

@Entity('attendances')
export class Attendance {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** Relasi ke employees (dimiliki employee-service) */
  @Column({ name: 'employee_id', unsigned: true })
  employeeId: number;

  @Column({ type: 'enum', enum: AttendanceType })
  type: AttendanceType;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'recorded_at', type: 'datetime' })
  recordedAt: Date;

  /** null bila absen dibuat dari koreksi yang disetujui */
  @Column({ name: 'photo_path', type: 'varchar', length: 255, nullable: true })
  photoPath: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  /** id attendance_corrections bila jam absen ini hasil koreksi */
  @Column({ name: 'correction_id', type: 'int', unsigned: true, nullable: true })
  correctionId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
