import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import type Redis from 'ioredis';
import { ATTENDANCE_SERVICE, AUTH_SERVICE, EMPLOYEE_SERVICE, LEAVE_SERVICE, REDIS } from '@app/common';
import { Public } from './auth/auth.decorators';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(EMPLOYEE_SERVICE) private readonly employee: ClientProxy,
    @Inject(ATTENDANCE_SERVICE) private readonly attendance: ClientProxy,
    @Inject(LEAVE_SERVICE) private readonly leave: ClientProxy,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Cek koneksi TCP ke tiap microservice dan koneksi Redis */
  @Public()
  @Get()
  async check() {
    const ping = (c: ClientProxy) => c.connect().then(() => 'up').catch(() => 'down');
    const [auth, employee, attendance, leave, redis] = await Promise.all([
      ping(this.auth), ping(this.employee), ping(this.attendance), ping(this.leave),
      this.redis.ping().then(() => 'up').catch(() => 'down'),
    ]);
    return { gateway: 'up', auth, employee, attendance, leave, redis };
  }
}
