/**
 * Membuat tabel (database/schema.sql) dan mengisi data awal.
 * Jalankan: npm run db:setup
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { Connection, createConnection } from 'mysql2/promise';

/**
 * Migrasi kecil untuk database yang dibuat dengan versi schema.sql lama
 * (CREATE TABLE IF NOT EXISTS tidak mengubah tabel yang sudah ada). Aman dijalankan berulang.
 */
async function migrate(conn: Connection, db: string) {
  const hasColumn = async (table: string, column: string) => {
    const [rows] = await conn.query<any[]>(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [db, table, column],
    );
    return rows.length > 0;
  };
  // absen hasil koreksi tidak punya foto
  await conn.query('ALTER TABLE attendances MODIFY photo_path VARCHAR(255) NULL');
  if (!(await hasColumn('attendances', 'correction_id'))) {
    await conn.query('ALTER TABLE attendances ADD COLUMN correction_id INT UNSIGNED NULL AFTER notes');
    console.log('✔ Migrasi: kolom attendances.correction_id ditambahkan');
  }
  if (!(await hasColumn('holidays', 'source'))) {
    await conn.query("ALTER TABLE holidays ADD COLUMN source ENUM('MANUAL','SYNC') NOT NULL DEFAULT 'MANUAL' AFTER name, ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER source");
    console.log('✔ Migrasi: kolom holidays.source & holidays.is_active ditambahkan');
  }
}

async function main() {
  const conn = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    multipleStatements: true,
  });
  const db = process.env.DB_NAME ?? 'dexa_wfh';
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${db}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  await migrate(conn, db);
  console.log('✔ Skema tabel siap');

  const seedUsers = [
    { email: 'hr@dexa.local', password: 'Admin123!', role: 'HR_ADMIN', employee: { code: 'HR-001', name: 'Sari Wulandari', position: 'HR Manager', department: 'Human Resources', phone: '081200000001' } },
    { email: 'budi@dexa.local', password: 'Karyawan123!', role: 'EMPLOYEE', employee: { code: 'EMP-001', name: 'Budi Santoso', position: 'Software Engineer', department: 'IT', phone: '081200000002' } },
    { email: 'rina@dexa.local', password: 'Karyawan123!', role: 'EMPLOYEE', employee: { code: 'EMP-002', name: 'Rina Putri', position: 'Finance Staff', department: 'Finance', phone: '081200000003' } },
  ];

  for (const u of seedUsers) {
    const [rows] = await conn.query<any[]>('SELECT id FROM users WHERE email = ?', [u.email]);
    if (rows.length) { console.log(`• ${u.email} sudah ada, dilewati`); continue; }
    const hash = await bcrypt.hash(u.password, 10);
    const [res] = await conn.query<any>('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)', [u.email, hash, u.role]);
    await conn.query(
      'INSERT INTO employees (user_id, employee_code, full_name, position, department, phone, join_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE())',
      [res.insertId, u.employee.code, u.employee.name, u.employee.position, u.employee.department, u.employee.phone],
    );
    console.log(`✔ ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
  }
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
