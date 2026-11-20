import { addDays, eachDate, hhmmToMinutes, isoWeekday, localDate, localDateTime, paginate, parseLocalDate } from './types';

describe('helper tanggal (zona waktu server)', () => {
  it('localDate memakai tanggal lokal, bukan UTC', () => {
    // 20 Nov 00:30 WIB masih 19 Nov di UTC
    expect(localDate(new Date('2026-11-20T00:30:00+07:00'))).toBe('2026-11-20');
  });

  it('parseLocalDate dan localDateTime tidak menggeser hari', () => {
    expect(parseLocalDate('2026-03-01').getDate()).toBe(1);
    const d = localDateTime('2026-11-20', '08:05');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 20, 8, 5]);
  });

  it('addDays melewati batas bulan dan tahun kabisat', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('eachDate inklusif di kedua ujung', () => {
    expect(eachDate('2026-11-29', '2026-12-02')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
    expect(eachDate('2026-11-20', '2026-11-19')).toEqual([]);
  });

  it('isoWeekday: Senin = 1, Minggu = 7', () => {
    expect(isoWeekday('2026-11-16')).toBe(1);
    expect(isoWeekday('2026-11-22')).toBe(7);
  });

  it('hhmmToMinutes menerima HH:mm dan HH:mm:ss', () => {
    expect(hhmmToMinutes('09:00')).toBe(540);
    expect(hhmmToMinutes('22:00:00')).toBe(1320);
  });

  it('paginate menghitung total halaman minimal 1', () => {
    expect(paginate([], 0, 1, 10).meta.totalPages).toBe(1);
    expect(paginate([1], 21, 3, 10).meta).toEqual({ page: 3, limit: 10, total: 21, totalPages: 3 });
  });
});
