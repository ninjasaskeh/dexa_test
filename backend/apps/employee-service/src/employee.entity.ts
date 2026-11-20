import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Department, Position } from './organization.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** Relasi ke users (dimiliki auth-service) */
  @Column({ name: 'user_id', unsigned: true, unique: true })
  userId: number;

  /** Diisi HRD, unik; password awal akun = NIP */
  @Column({ length: 20, unique: true })
  nip: string;

  @Column({ name: 'full_name', length: 120 })
  fullName: string;

  @Column({ name: 'department_id', unsigned: true })
  departmentId: number;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'position_id', unsigned: true })
  positionId: number;

  @ManyToOne(() => Position)
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'join_date', type: 'date' })
  joinDate: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1, transformer: { to: (v?: boolean) => (v === undefined ? v : v ? 1 : 0), from: (v: number) => !!v } })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
