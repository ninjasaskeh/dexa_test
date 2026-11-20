import { ClientProxy } from '@nestjs/microservices';
import { PATTERNS } from './constants';
import { sendRpc } from './rpc';

/** Data karyawan ringkas yang ditempelkan ke data milik service lain */
export interface EmployeeLite {
  id: number;
  employeeCode: string;
  fullName: string;
  department: string;
  position: string;
}

/** Tempelkan `employee` (dari employee-service) ke tiap baris yang punya `employeeId` */
export async function withEmployees<T extends { employeeId: number }>(client: ClientProxy, rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.employeeId))];
  const emps = ids.length ? await sendRpc<EmployeeLite[]>(client, PATTERNS.EMPLOYEE.FIND_BY_IDS, { ids }) : [];
  const map = new Map(emps.map((e) => [e.id, e]));
  return rows.map((r) => {
    const e = map.get(r.employeeId);
    const employee: EmployeeLite | null = e
      ? { id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, department: e.department, position: e.position }
      : null;
    return { ...r, employee };
  });
}
