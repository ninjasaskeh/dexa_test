import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Role } from '@app/common';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ length: 120, unique: true })
  email: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1, transformer: { to: (v?: boolean) => (v === undefined ? v : v ? 1 : 0), from: (v: number) => !!v } })
  isActive: boolean;

  /** true = akun baru, password masih NIP; karyawan wajib menggantinya */
  @Column({ name: 'must_change_password', type: 'tinyint', width: 1, default: 0, transformer: { to: (v?: boolean) => (v === undefined ? v : v ? 1 : 0), from: (v: number) => !!v } })
  mustChangePassword: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
