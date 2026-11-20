import { Global, Inject, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Token injeksi klien Redis: `@Inject(REDIS) redis: Redis` */
export const REDIS = 'REDIS';

@Injectable()
class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}

/**
 * Koneksi Redis bersama (REDIS_URL). Perintah gagal cepat saat Redis mati (tanpa antrean offline),
 * supaya pemanggil bisa memilih fallback daripada menunggu. ioredis tetap mencoba konek ulang di belakang.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const url = config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379');
        const redis = new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 3000 });
        let lastLog = 0;
        redis.on('error', (e: Error) => {
          // ioredis memancarkan error di tiap percobaan konek ulang; cukup catat sekali per menit
          if (Date.now() - lastLog > 60_000) {
            lastLog = Date.now();
            logger.warn(`Redis tidak tersedia (${url}): ${e.message}`);
          }
        });
        redis.on('ready', () => logger.log(`Terhubung ke ${url}`));
        return redis;
      },
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
