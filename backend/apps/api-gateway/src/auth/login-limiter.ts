import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '@app/common';

/**
 * Membatasi login gagal per email dan per IP. Hitungan disimpan di Redis (fixed window dengan TTL),
 * jadi berlaku sama untuk semua instance gateway dan tidak hilang saat gateway restart.
 * Bila Redis mati, login tetap dilayani tanpa pembatasan (fail-open) dan peringatan dicatat di log.
 */
@Injectable()
export class LoginLimiter {
  private readonly logger = new Logger('LoginLimiter');
  private readonly maxPerEmail = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
  /** Satu IP bisa dipakai banyak karyawan (NAT kantor), jadi batasnya lebih longgar */
  private readonly maxPerIp = this.maxPerEmail * 4;
  private readonly windowSec = Number(process.env.LOGIN_LOCK_MINUTES ?? 15) * 60;
  private lastWarn = 0;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private keys(ip: string, email: string): [string, number][] {
    return [[`login:fail:email:${email}`, this.maxPerEmail], [`login:fail:ip:${ip}`, this.maxPerIp]];
  }

  private warn(e: unknown) {
    if (Date.now() - this.lastWarn < 60_000) return;
    this.lastWarn = Date.now();
    this.logger.warn(`Pembatasan login dilewati karena Redis tidak tersedia: ${e instanceof Error ? e.message : e}`);
  }

  /** Lempar 429 bila email atau IP ini sudah melewati batas */
  async assertAllowed(ip: string, email: string) {
    const entries = this.keys(ip, email);
    let counts: (string | null)[];
    try {
      counts = await this.redis.mget(...entries.map(([k]) => k));
    } catch (e) {
      this.warn(e);
      return;
    }
    for (let i = 0; i < entries.length; i++) {
      const [key, max] = entries[i];
      if (Number(counts[i] ?? 0) < max) continue;
      const ttl = await this.redis.ttl(key).catch(() => this.windowSec);
      const minutes = Math.max(1, Math.ceil((ttl > 0 ? ttl : this.windowSec) / 60));
      throw new HttpException(
        { statusCode: HttpStatus.TOO_MANY_REQUESTS, message: `Terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(ip: string, email: string) {
    const tx = this.redis.multi();
    for (const [key] of this.keys(ip, email)) {
      // TTL hanya dipasang saat percobaan gagal pertama; INCR mempertahankan TTL yang ada
      tx.set(key, 0, 'EX', this.windowSec, 'NX').incr(key);
    }
    await tx.exec().catch((e) => this.warn(e));
  }

  /** Login berhasil: hapus hitungan gagal untuk email ini (hitungan IP tetap) */
  async reset(email: string) {
    await this.redis.del(`login:fail:email:${email}`).catch((e) => this.warn(e));
  }
}
