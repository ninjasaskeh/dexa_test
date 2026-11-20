import { FakeRedis, fakeConfig, memRepo, restoreTime, rpcErrorOf, setNow } from '../../../test/helpers';
import { CalendarService } from './calendar.service';
import { Holiday } from './holiday.entity';

const FEED = 'https://contoh.test/holidays.json';

function setup(opts: { holidays?: Partial<Holiday>[]; env?: Record<string, string>; redis?: FakeRedis } = {}) {
  const holidays = memRepo<Holiday>(opts.holidays ?? []);
  // sinkron berjalan di dalam transaksi; repo transaksi = repo yang sama
  (holidays as any).manager = { transaction: (cb: (m: unknown) => unknown) => cb({ getRepository: () => holidays }) };
  const redis = opts.redis ?? new FakeRedis();
  const service = new CalendarService(holidays as any, fakeConfig({ HOLIDAY_SYNC_URL: FEED, ...opts.env }), redis as any);
  return { service, holidays, redis };
}

function mockFeed(body: unknown, status = 200) {
  return jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify(body), { status }));
}

afterEach(() => {
  restoreTime();
  jest.restoreAllMocks();
});

describe('CalendarService: hari kerja', () => {
  it('Senin–Jumat hari kerja, Sabtu–Minggu dan libur aktif bukan hari kerja', async () => {
    const { service } = setup({
      holidays: [
        { id: 1, date: '2026-11-18', name: 'Libur A', source: 'MANUAL', isActive: true },
        { id: 2, date: '2026-11-19', name: 'Libur disembunyikan', source: 'SYNC', isActive: false },
      ],
    });
    const days = [...(await service.range('2026-11-16', '2026-11-22')).values()];
    expect(days.map((d) => d.isWorkDay)).toEqual([true, true, false, true, true, false, false]);
    expect(days[2].holidayName).toBe('Libur A');
    expect(days[3].holidayName).toBeNull(); // yang disembunyikan dihitung hari kerja
  });

  it('WORK_DAYS bisa diubah (mis. Senin–Sabtu); nilai tidak valid kembali ke default', async () => {
    expect(setup({ env: { WORK_DAYS: '6,1,2,3,4,5,5' } }).service.workDays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(setup({ env: { WORK_DAYS: 'abc,9' } }).service.workDays).toEqual([1, 2, 3, 4, 5]);
    expect((await setup({ env: { WORK_DAYS: '1,2,3,4,5,6' } }).service.day('2026-11-21')).isWorkDay).toBe(true);
  });
});

describe('CalendarService: kelola hari libur', () => {
  it('menolak tanggal yang sudah terdaftar (409)', async () => {
    const { service } = setup({ holidays: [{ id: 1, date: '2026-12-25', name: 'Natal', source: 'SYNC', isActive: true }] });
    expect(await rpcErrorOf(service.create({ date: '2026-12-25', name: 'Libur kantor' }))).toEqual({
      statusCode: 409, message: 'Tanggal ini sudah terdaftar sebagai hari libur (Natal)',
    });
  });

  it('libur MANUAL dihapus permanen, libur SYNC hanya disembunyikan', async () => {
    const { service, holidays } = setup({
      holidays: [
        { id: 1, date: '2026-12-24', name: 'Libur kantor', source: 'MANUAL', isActive: true },
        { id: 2, date: '2026-12-25', name: 'Natal', source: 'SYNC', isActive: true },
      ],
    });
    await expect(service.remove(1)).resolves.toEqual({ deleted: true, hidden: false });
    await expect(service.remove(2)).resolves.toEqual({ deleted: false, hidden: true });
    expect(holidays.rows).toEqual([expect.objectContaining({ id: 2, isActive: false })]);
  });
});

describe('CalendarService: sinkron dari feed online', () => {
  const existing: Partial<Holiday>[] = [
    { id: 1, date: '2026-01-01', name: 'Tahun Baru', source: 'SYNC', isActive: true }, // nama berubah di feed
    { id: 2, date: '2026-03-01', name: 'Cuti bersama dibatalkan', source: 'SYNC', isActive: true }, // hilang dari feed
    { id: 3, date: '2026-06-01', name: 'Ulang tahun kantor', source: 'MANUAL', isActive: true }, // tidak boleh disentuh
    { id: 4, date: '2026-12-25', name: 'Hari Raya Natal', source: 'SYNC', isActive: false }, // disembunyikan HRD
    { id: 5, date: '2025-05-01', name: 'Tahun lain', source: 'SYNC', isActive: true }, // tahun di luar feed
  ];
  const feed = {
    '2026-01-01': { summary: 'Tahun Baru Masehi' },
    '2026-06-01': { summary: 'Hari Lahir Pancasila' },
    '2026-08-17': { summary: ['Hari Kemerdekaan', 'HUT RI'] },
    '2026-12-25': { summary: 'Hari Raya Natal' },
    '2026-13-40': { summary: 'tanggal rusak' },
    info: { source: 'google calendar' },
  };

  it('menambah, memperbarui, menghapus yang basi, dan tidak menyentuh MANUAL atau status sembunyi', async () => {
    setNow('2026-11-20 10:00');
    mockFeed(feed);
    const { service, holidays, redis } = setup({ holidays: existing });
    const res = await service.sync();
    expect(res).toMatchObject({ ok: true, added: 1, updated: 1, removed: 1, years: ['2026'] });

    const byDate = Object.fromEntries(holidays.rows.map((h) => [h.date, h]));
    expect(byDate['2026-01-01']).toMatchObject({ name: 'Tahun Baru Masehi', source: 'SYNC' });
    expect(byDate['2026-03-01']).toBeUndefined();
    expect(byDate['2026-06-01']).toMatchObject({ name: 'Ulang tahun kantor', source: 'MANUAL' });
    expect(byDate['2026-08-17']).toMatchObject({ name: 'Hari Kemerdekaan / HUT RI', source: 'SYNC', isActive: true });
    expect(byDate['2026-12-25']).toMatchObject({ isActive: false });
    expect(byDate['2025-05-01']).toBeDefined();

    // hasil terakhir disimpan di Redis untuk semua instance, kunci dilepas
    expect(JSON.parse((await redis.get('holidays:sync:last'))!)).toMatchObject({ ok: true, added: 1 });
    expect(await redis.get('holidays:sync:lock')).toBeNull();
  });

  it('sinkron kedua tidak mengubah apa pun (idempoten)', async () => {
    mockFeed(feed);
    const { service } = setup({ holidays: existing });
    await service.sync();
    await expect(service.sync()).resolves.toMatchObject({ added: 0, updated: 0, removed: 0 });
  });

  it('menolak bila instance lain sedang sinkron (409) dan tidak melepas kunci milik instance lain', async () => {
    const redis = new FakeRedis();
    await redis.set('holidays:sync:lock', 'milik-instance-lain', 'EX', 120, 'NX');
    const fetchSpy = mockFeed(feed);
    const { service } = setup({ redis });
    expect((await rpcErrorOf(service.sync())).statusCode).toBe(409);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await redis.get('holidays:sync:lock')).toBe('milik-instance-lain');
  });

  it('tetap sinkron tanpa kunci bila Redis mati', async () => {
    const redis = new FakeRedis();
    redis.down = true;
    mockFeed(feed);
    const { service } = setup({ redis });
    await expect(service.sync()).resolves.toMatchObject({ ok: true, added: 4 });
    // status terakhir tetap bisa dibaca dari memori instance ini
    expect((await service.list(2026)).sync.last).toMatchObject({ ok: true });
  });

  it('feed error menjadi 502 dan status gagal disimpan', async () => {
    mockFeed({}, 500);
    const { service, redis } = setup();
    expect(await rpcErrorOf(service.sync())).toEqual({ statusCode: 502, message: 'Gagal sinkron hari libur: HTTP 500' });
    expect(JSON.parse((await redis.get('holidays:sync:last'))!)).toMatchObject({ ok: false, message: 'HTTP 500' });
  });

  it('HOLIDAY_SYNC_URL kosong mematikan sinkron', async () => {
    const { service } = setup({ env: { HOLIDAY_SYNC_URL: '' } });
    expect((await rpcErrorOf(() => service.sync())).statusCode).toBe(400);
    expect((await service.list(2026)).sync).toMatchObject({ enabled: false, url: null });
  });
});
