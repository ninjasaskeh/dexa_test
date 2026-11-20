import { ClientsModule, Transport } from '@nestjs/microservices';
import { ATTENDANCE_SERVICE, AUTH_SERVICE, EMPLOYEE_SERVICE, LEAVE_SERVICE } from './constants';

const defs = {
  [AUTH_SERVICE]: ['AUTH_SERVICE_HOST', 'AUTH_SERVICE_PORT', 4001],
  [EMPLOYEE_SERVICE]: ['EMPLOYEE_SERVICE_HOST', 'EMPLOYEE_SERVICE_PORT', 4002],
  [ATTENDANCE_SERVICE]: ['ATTENDANCE_SERVICE_HOST', 'ATTENDANCE_SERVICE_PORT', 4003],
  [LEAVE_SERVICE]: ['LEAVE_SERVICE_HOST', 'LEAVE_SERVICE_PORT', 4004],
} as const;

type ServiceName = keyof typeof defs;

/** Daftarkan TCP client untuk microservice lain */
export function registerServiceClients(...names: ServiceName[]) {
  return ClientsModule.registerAsync(
    names.map((name) => ({
      name,
      useFactory: () => {
        const [hostEnv, portEnv, port] = defs[name];
        return {
          transport: Transport.TCP as const,
          options: { host: process.env[hostEnv] ?? '127.0.0.1', port: Number(process.env[portEnv] ?? port) },
        };
      },
    })),
  );
}
