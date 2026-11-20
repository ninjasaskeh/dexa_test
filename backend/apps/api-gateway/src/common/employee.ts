import { ClientProxy } from '@nestjs/microservices';
import { AuthUser, PATTERNS, Reviewer, sendRpc } from '@app/common';

/** id karyawan milik user yang login (404 bila akun belum punya profil karyawan) */
export async function employeeIdOf(employees: ClientProxy, user: AuthUser): Promise<number> {
  const emp = await sendRpc<{ id: number }>(employees, PATTERNS.EMPLOYEE.FIND_BY_USER, { userId: user.id });
  return emp.id;
}

/** HRD yang memproses pengajuan; employeeId dipakai untuk menolak persetujuan atas pengajuan sendiri */
export async function reviewerOf(employees: ClientProxy, user: AuthUser): Promise<Reviewer> {
  const employeeId = await employeeIdOf(employees, user).catch(() => null);
  return { userId: user.id, employeeId };
}
