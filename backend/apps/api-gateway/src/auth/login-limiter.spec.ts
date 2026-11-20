import { HttpException } from '@nestjs/common';
import { FakeRedis, restoreTime, setNow } from '../../../../test/helpers';
import { LoginLimiter } from './login-limiter';

async function statusOf(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    return (e as HttpException).getStatus();
  }
}

describe('LoginLimiter (Redis)', () => {
  let redis: FakeRedis;
  let limiter: LoginLimiter;
  const ip = '10.0.0.1';
  const email = 'budi@dexa.local';

  beforeEach(() => {
    redis = new FakeRedis();
    limiter = new LoginLimiter(redis as any);
  });
  afterEach(restoreTime);

  const fail = async (n: number, e = email, from = ip) => {
    for (let i = 0; i < n; i++) await limiter.recordFailure(from, e);
  };

  it('memblokir email setelah 5 kali gagal, dengan sisa waktu dalam menit', async () => {
    await fail(4);
    expect(await statusOf(limiter.assertAllowed(ip, email))).toBe(200);
    await fail(1);
    await expect(limiter.assertAllowed('10.9.9.9', email)).rejects.toMatchObject({
      response: { statusCode: 429, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
    });
    expect(await redis.ttl(`login:fail:email:${email}`)).toBe(900);
  });

  it('TTL tidak diperpanjang oleh percobaan gagal berikutnya (fixed window)', async () => {
    setNow('2026-11-20 10:00');
    await fail(1);
    setNow('2026-11-20 10:10');
    await fail(1);
    expect(await redis.ttl(`login:fail:email:${email}`)).toBe(300);
    setNow('2026-11-20 10:15');
    expect(await redis.get(`login:fail:email:${email}`)).toBeNull();
  });

  it('login berhasil menghapus hitungan email, hitungan IP tetap', async () => {
    await fail(4);
    await limiter.reset(email);
    expect(await redis.get(`login:fail:email:${email}`)).toBeNull();
    expect(await redis.get(`login:fail:ip:${ip}`)).toBe('4');
  });

  it('satu IP dibatasi 4x lebih longgar (20) untuk banyak email', async () => {
    for (let i = 0; i < 20; i++) await limiter.recordFailure(ip, `orang${i}@dexa.local`);
    expect(await statusOf(limiter.assertAllowed(ip, 'baru@dexa.local'))).toBe(429);
    expect(await statusOf(limiter.assertAllowed('10.0.0.2', 'baru@dexa.local'))).toBe(200);
  });

  it('fail-open: Redis mati tidak membuat login error', async () => {
    redis.down = true;
    await expect(limiter.recordFailure(ip, email)).resolves.toBeUndefined();
    await expect(limiter.assertAllowed(ip, email)).resolves.toBeUndefined();
    await expect(limiter.reset(email)).resolves.toBeUndefined();
  });
});
