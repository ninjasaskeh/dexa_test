import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { HolidayType } from '@app/common';

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'holiday_date', type: 'date', unique: true })
  date: string;

  @Column({ length: 120 })
  name: string;

  /** HOLIDAY = libur nasional / perusahaan, LEAVE = cuti bersama. Keduanya tidak dihitung hari kerja. */
  @Column({ type: 'enum', enum: ['HOLIDAY', 'LEAVE'], default: 'HOLIDAY' })
  type: HolidayType;

  /** SYNC = dari HOLIDAY_SYNC_URL, MANUAL = ditambah HRD */
  @Column({ type: 'enum', enum: ['MANUAL', 'SYNC'], default: 'MANUAL' })
  source: 'MANUAL' | 'SYNC';

  /** false = disembunyikan HRD (hanya untuk SYNC), tidak dihitung sebagai libur */
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1, transformer: { to: (v?: boolean) => (v === undefined ? v : v ? 1 : 0), from: (v: number) => !!v } })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
