import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  /** Relasi ke users (dimiliki auth-service) */
  @Column({ name: 'user_id', unsigned: true, unique: true })
  userId: number;

  @Column({ name: 'employee_code', length: 20, unique: true })
  employeeCode: string;

  @Column({ name: 'full_name', length: 120 })
  fullName: string;

  @Column({ length: 80 })
  position: string;

  @Column({ length: 80 })
  department: string;

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
