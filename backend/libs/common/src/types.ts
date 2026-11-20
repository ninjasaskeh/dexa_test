import { Role } from './constants';

export interface JwtPayload {
  sub: number; // user id
  email: string;
  role: Role;
}

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

/** HRD yang memproses pengajuan (cuti/izin/sakit, koreksi absen) */
export interface Reviewer {
  userId: number;
  /** null bila akun HRD tidak punya profil karyawan */
  employeeId: number | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

/** Tanggal lokal (zona waktu server) dalam format YYYY-MM-DD */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> Date lokal jam 00:00 (tanpa geser zona waktu) */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "YYYY-MM-DD" + "HH:mm" -> Date lokal */
export function localDateTime(date: string, time: string): Date {
  const [h, min] = time.split(':').map(Number);
  const d = parseLocalDate(date);
  d.setHours(h, min, 0, 0);
  return d;
}

export function addDays(date: string, n: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + n);
  return localDate(d);
}

/** Semua tanggal dari `from` sampai `to` (inklusif) */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Hari ISO: 1 = Senin ... 7 = Minggu */
export function isoWeekday(date: string): number {
  return parseLocalDate(date).getDay() || 7;
}

/** "HH:mm" atau "HH:mm:ss" -> menit sejak 00:00 */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
