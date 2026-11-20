import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

const bool = { to: (v?: boolean) => (v === undefined ? v : v ? 1 : 0), from: (v: number) => !!v };

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ length: 80, unique: true })
  name: string;

  /** false = tidak bisa dipilih untuk karyawan baru; karyawan lama tetap di departemen ini */
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1, transformer: bool })
  isActive: boolean;

  @OneToMany(() => Position, (p) => p.department)
  positions: Position[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Jabatan selalu milik satu departemen */
@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @Column({ name: 'department_id', unsigned: true })
  departmentId: number;

  @ManyToOne(() => Department, (d) => d.positions)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ length: 80 })
  name: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1, transformer: bool })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
