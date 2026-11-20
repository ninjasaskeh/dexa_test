import { HttpStatus, Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { Between, In, Repository } from 'typeorm';
import { CreateHolidayDto, REDIS, eachDate, isoWeekday, localDate, rpcError } from '@app/common';
import { Holiday } from './holiday.entity';

const DEFAULT_SYNC_URL = 'https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/holidays.json';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Hasil sinkron terakhir, dibaca semua instance attendance-service */
const KEY_LAST = 'holidays:sync:last';
/** Kunci agar hanya satu instance yang sinkron pada satu waktu */
const KEY_LOCK = 'holidays:sync:lock';
const LOCK_TTL_SEC = 120;
/** Hapus kunci hanya bila masih milik pemanggil (tidak menghapus kunci instance lain) */
const RELEASE_LOCK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export interface SyncResult {
  at: string;
  ok: boolean;
  added: number;
  updated: number;
  removed: number;
  years: string[];
  message: string | null;
}

/**
 * Ambil daftar { date, name } dari feed APIHariLibur_V2: { "YYYY-MM-DD": { "summary": "..." }, "info": {...} }.
 * Kunci selain tanggal (mis. "info") diabaikan; summary berupa array digabung dengan " / ".
 */
function parseFeed(body: unknown): { date: string; name: string }[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('format data tidak dikenali');
  const out: { date: string; name: string }[] = [];
  for (const [date, v] of Object.entries(body as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) continue;
    const summary = (v as { summary?: unknown } | null)?.summary;
    const name = (Array.isArray(summary) ? summary.filter((s) => typeof s === 'string').join(' / ') : typeof summary === 'string' ? summary : '').trim();
    if (name) out.push({ date, name: name.slice(0, 120) });
  }
  return out;
}

export interface CalendarDay {
  date: string;
  isWorkDay: boolean;
  holidayName: string | null;
}

/**
 * Aturan jam kerja & kalender kerja: WORK_START_TIME, CHECK_OUT_MAX_TIME, WORK_DAYS, tabel holidays.
 * Libur nasional & cuti bersama disinkronkan dari HOLIDAY_SYNC_URL saat start dan tiap 24 jam.
 */
@Injectable()
export class CalendarService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('HolidaySync');
  private timer?: NodeJS.Timeout;
  private running: Promise<SyncResult> | null = null;
  /** Cadangan bila Redis mati: hasil sinkron terakhir instance ini saja */
  private last: SyncResult | null = null;

  constructor(
    @InjectRepository(Holiday) private readonly holidays: Repository<Holiday>,
    private readonly config: ConfigService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private async saveLast(result: SyncResult) {
    this.last = result;
    await this.redis.set(KEY_LAST, JSON.stringify(result)).catch(() => undefined);
  }

  private async lastResult(): Promise<SyncResult | null> {
    const raw = await this.redis.get(KEY_LAST).catch(() => null);
    return raw ? (JSON.parse(raw) as SyncResult) : this.last;
  }

  /** URL feed; string kosong di .env = sinkron dimatikan */
  private get syncUrl(): string {
    return (this.config.get<string>('HOLIDAY_SYNC_URL') ?? DEFAULT_SYNC_URL).trim();
  }

  onApplicationBootstrap() {
    if (!this.syncUrl) return;
    const background = () => this.sync().catch(() => undefined); // error sudah dicatat di sync()
    background();
    this.timer = setInterval(background, SYNC_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  /** Sinkronkan libur dari feed. Pemanggilan bersamaan memakai proses yang sama. */
  sync(): Promise<SyncResult> {
    const url = this.syncUrl;
    if (!url) rpcError(HttpStatus.BAD_REQUEST, 'Sinkronisasi hari libur dinonaktifkan (HOLIDAY_SYNC_URL kosong)');
    this.running ??= this.runSync(url).finally(() => (this.running = null));
    return this.running;
  }

  private async runSync(url: string): Promise<SyncResult> {
    const token = randomUUID();
    // null = kunci dipegang instance lain; bila Redis mati, sinkron tetap jalan tanpa kunci
    const locked = await this.redis.set(KEY_LOCK, token, 'EX', LOCK_TTL_SEC, 'NX').catch(() => 'NO_REDIS');
    if (locked === null) rpcError(HttpStatus.CONFLICT, 'Sinkron hari libur sedang berjalan, coba lagi sebentar');
    try {
      return await this.syncFrom(url);
    } finally {
      if (locked === 'OK') await this.redis.eval(RELEASE_LOCK, 1, KEY_LOCK, token).catch(() => undefined);
    }
  }

  private async syncFrom(url: string): Promise<SyncResult> {
    const at = new Date().toISOString();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const feed = parseFeed(await res.json());
      if (!feed.length) throw new Error('data kosong');
      const years = [...new Set(feed.map((f) => f.date.slice(0, 4)))].sort();
      const feedDates = new Set(feed.map((f) => f.date));

      const result = await this.holidays.manager.transaction(async (m) => {
        const repo = m.getRepository(Holiday);
        const existing = (await repo.findBy({ date: Between(`${years[0]}-01-01`, `${years[years.length - 1]}-12-31`) }))
          .filter((h) => years.includes(h.date.slice(0, 4)));
        const byDate = new Map(existing.map((h) => [h.date, h]));
        let added = 0;
        let updated = 0;
        for (const f of feed) {
          const h = byDate.get(f.date);
          if (!h) {
            await repo.insert({ date: f.date, name: f.name, source: 'SYNC', isActive: true });
            added += 1;
          } else if (h.source === 'SYNC' && h.name !== f.name) {
            // status disembunyikan tetap dipertahankan; libur MANUAL tidak pernah disentuh
            await repo.update(h.id, { name: f.name });
            updated += 1;
          }
        }
        // libur hasil sinkron yang sudah tidak ada di feed (mis. cuti bersama dibatalkan pemerintah)
        const stale = existing.filter((h) => h.source === 'SYNC' && !feedDates.has(h.date));
        if (stale.length) await repo.delete({ id: In(stale.map((h) => h.id)) });
        return { added, updated, removed: stale.length };
      });

      const ok: SyncResult = { at, ok: true, ...result, years, message: null };
      await this.saveLast(ok);
      this.logger.log(`Sinkron ${years.join(', ')}: +${result.added} baru, ${result.updated} diperbarui, ${result.removed} dihapus`);
      return ok;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await this.saveLast({ at, ok: false, added: 0, updated: 0, removed: 0, years: [], message });
      this.logger.warn(`Sinkron hari libur gagal (${url}): ${message}`);
      rpcError(HttpStatus.BAD_GATEWAY, `Gagal sinkron hari libur: ${message}`);
    }
  }

  get workStartTime() {
    return this.config.get<string>('WORK_START_TIME', '09:00');
  }

  /** Batas akhir absen harian. Lewat jam ini check-in & check-out ditolak, jadi absen tidak menyeberang tengah malam. */
  get checkOutMaxTime() {
    return this.config.get<string>('CHECK_OUT_MAX_TIME', '22:00');
  }

  /** Hari kerja mingguan dari WORK_DAYS (1 = Senin ... 7 = Minggu), default Senin–Jumat */
  get workDays(): number[] {
    const days = this.config
      .get<string>('WORK_DAYS', '1,2,3,4,5')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
    return days.length ? [...new Set(days)].sort() : [1, 2, 3, 4, 5];
  }

  /** Status tiap tanggal di [from, to]: hari kerja atau bukan, plus nama hari libur */
  async range(from: string, to: string): Promise<Map<string, CalendarDay>> {
    const rows = await this.holidays.findBy({ date: Between(from, to), isActive: true });
    const names = new Map(rows.map((h) => [h.date, h.name]));
    const workDays = this.workDays;
    return new Map(
      eachDate(from, to).map((date) => {
        const holidayName = names.get(date) ?? null;
        return [date, { date, isWorkDay: workDays.includes(isoWeekday(date)) && !holidayName, holidayName }];
      }),
    );
  }

  async day(date: string): Promise<CalendarDay> {
    return (await this.range(date, date)).get(date)!;
  }

  async list(year?: number) {
    const y = year ?? Number(localDate().slice(0, 4));
    // termasuk yang disembunyikan, agar HRD bisa menampilkannya lagi
    const data = await this.holidays.find({ where: { date: Between(`${y}-01-01`, `${y}-12-31`) }, order: { date: 'ASC' } });
    return { year: y, workDays: this.workDays, sync: { enabled: !!this.syncUrl, url: this.syncUrl || null, last: await this.lastResult() }, data };
  }

  async create(dto: CreateHolidayDto) {
    const existing = await this.holidays.findOneBy({ date: dto.date });
    if (existing) rpcError(HttpStatus.CONFLICT, `Tanggal ini sudah terdaftar sebagai hari libur (${existing.name})`);
    return this.holidays.save(this.holidays.create({ date: dto.date, name: dto.name, source: 'MANUAL', isActive: true }));
  }

  private async getOrFail(id: number) {
    const h = await this.holidays.findOneBy({ id });
    if (!h) rpcError(HttpStatus.NOT_FOUND, 'Hari libur tidak ditemukan');
    return h;
  }

  /** MANUAL dihapus permanen; SYNC hanya disembunyikan agar tidak muncul lagi saat sinkron berikutnya */
  async remove(id: number) {
    const h = await this.getOrFail(id);
    if (h.source === 'SYNC') {
      await this.holidays.update(id, { isActive: false });
      return { deleted: false, hidden: true };
    }
    await this.holidays.delete(id);
    return { deleted: true, hidden: false };
  }

  /** Tampilkan lagi / sembunyikan libur */
  async setActive(id: number, isActive: boolean) {
    await this.getOrFail(id);
    await this.holidays.update(id, { isActive });
    return this.getOrFail(id);
  }
}
