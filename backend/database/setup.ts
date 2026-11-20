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
  const hasConstraint = async (table: string, name: string) => {
    const [rows] = await conn.query<any[]>(
      'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      [db, table, name],
    );
    return rows.length > 0;
  };
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
  if (!(await hasColumn('holidays', 'type'))) {
    await conn.query("ALTER TABLE holidays ADD COLUMN type ENUM('HOLIDAY','LEAVE') NOT NULL DEFAULT 'HOLIDAY' AFTER name");
    await conn.query("UPDATE holidays SET type = 'LEAVE' WHERE name LIKE '%cuti bersama%'");
    console.log('✔ Migrasi: kolom holidays.type ditambahkan');
  }
  if (!(await hasColumn('users', 'must_change_password'))) {
    await conn.query('ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
    console.log('✔ Migrasi: kolom users.must_change_password ditambahkan');
  }
  // departemen & jabatan teks bebas -> tabel departments & positions
  if (await hasColumn('employees', 'department')) {
    await conn.query('INSERT IGNORE INTO departments (name) SELECT DISTINCT TRIM(department) FROM employees');
    await conn.query(
      `INSERT IGNORE INTO positions (department_id, name)
       SELECT DISTINCT d.id, TRIM(e.position) FROM employees e JOIN departments d ON d.name = TRIM(e.department)`,
    );
    await conn.query('ALTER TABLE employees ADD COLUMN department_id INT UNSIGNED NULL AFTER full_name, ADD COLUMN position_id INT UNSIGNED NULL AFTER department_id');
    await conn.query(
      `UPDATE employees e
       JOIN departments d ON d.name = TRIM(e.department)
       JOIN positions p ON p.department_id = d.id AND p.name = TRIM(e.position)
       SET e.department_id = d.id, e.position_id = p.id`,
    );
    await conn.query(
      `ALTER TABLE employees
       DROP INDEX idx_employees_department, DROP COLUMN department, DROP COLUMN position,
       MODIFY department_id INT UNSIGNED NOT NULL, MODIFY position_id INT UNSIGNED NOT NULL,
       ADD KEY idx_employees_department (department_id),
       ADD CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments (id)`,
    );
    console.log('✔ Migrasi: departemen & jabatan dipindah ke tabel departments & positions');
  }
  // jabatan karyawan wajib milik departemennya, ditegakkan database lewat composite FK
  if (!(await hasConstraint('employees', 'fk_employees_position_department'))) {
    if (!(await hasConstraint('positions', 'uq_positions_id_department'))) {
      await conn.query('ALTER TABLE positions ADD UNIQUE KEY uq_positions_id_department (id, department_id)');
    }
    if (await hasConstraint('employees', 'fk_employees_position')) await conn.query('ALTER TABLE employees DROP FOREIGN KEY fk_employees_position');
    await conn.query(
      'ALTER TABLE employees ADD CONSTRAINT fk_employees_position_department FOREIGN KEY (position_id, department_id) REFERENCES positions (id, department_id)',
    );
    console.log('✔ Migrasi: composite FK employees(position_id, department_id) -> positions(id, department_id)');
  }
  // kode karyawan -> NIP (nilainya tetap, hanya nama kolom)
  if (await hasColumn('employees', 'employee_code')) {
    await conn.query('ALTER TABLE employees RENAME COLUMN employee_code TO nip, RENAME INDEX uq_employees_code TO uq_employees_nip');
    console.log('✔ Migrasi: kolom employees.employee_code diganti nama menjadi nip');
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

  // departemen & jabatan contoh (dilewati bila sudah ada)
  const structure: Record<string, string[]> = {
    'Human Resources': ['HR Manager', 'HR Staff'],
    IT: ['Software Engineer', 'QA Engineer', 'IT Support'],
    Finance: ['Finance Staff', 'Accountant'],
  };
  for (const [dept, positions] of Object.entries(structure)) {
    await conn.query('INSERT IGNORE INTO departments (name) VALUES (?)', [dept]);
    const [[d]] = await conn.query<any[]>('SELECT id FROM departments WHERE name = ?', [dept]);
    for (const p of positions) await conn.query('INSERT IGNORE INTO positions (department_id, name) VALUES (?, ?)', [d.id, p]);
  }

  // akun demo mengikuti aturan yang sama dengan karyawan baru: password awal = NIP, wajib diganti saat login pertama
  const seedUsers = [
    { email: 'hr@dexa.local', role: 'HR_ADMIN', employee: { nip: '20260001', name: 'Sari Wulandari', position: 'HR Manager', department: 'Human Resources', phone: '081200000001' } },
    { email: 'budi@dexa.local', role: 'EMPLOYEE', employee: { nip: '20260002', name: 'Budi Santoso', position: 'Software Engineer', department: 'IT', phone: '081200000002' } },
    { email: 'rina@dexa.local', role: 'EMPLOYEE', employee: { nip: '20260003', name: 'Rina Putri', position: 'Finance Staff', department: 'Finance', phone: '081200000003' } },
  ];

  for (const u of seedUsers) {
    const [rows] = await conn.query<any[]>('SELECT id FROM users WHERE email = ?', [u.email]);
    if (rows.length) { console.log(`• ${u.email} sudah ada, dilewati`); continue; }
    const { nip } = u.employee;
    const hash = await bcrypt.hash(nip, 10);
    const [res] = await conn.query<any>(
      'INSERT INTO users (email, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)',
      [u.email, hash, u.role],
    );
    const [[pos]] = await conn.query<any[]>(
      'SELECT p.id, p.department_id FROM positions p JOIN departments d ON d.id = p.department_id WHERE d.name = ? AND p.name = ?',
      [u.employee.department, u.employee.position],
    );
    await conn.query(
      'INSERT INTO employees (user_id, nip, full_name, department_id, position_id, phone, join_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE())',
      [res.insertId, nip, u.employee.name, pos.department_id, pos.id, u.employee.phone],
    );
    console.log(`✔ ${u.role.padEnd(8)} ${u.email} · NIP ${nip} · password awal ${nip} (wajib diganti saat login pertama)`);
  }
  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
