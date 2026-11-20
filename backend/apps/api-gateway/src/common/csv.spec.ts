import { sendCsv } from './csv';

function capture() {
  const res: any = { headers: {} as Record<string, string>, body: '' };
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  res.send = (b: string) => (res.body = b);
  return res;
}

describe('sendCsv', () => {
  it('menulis BOM UTF-8, header unduhan, dan baris CRLF', () => {
    const res = capture();
    sendCsv(res, 'absensi.csv', ['Nama', 'Jam'], [['Budi', '08:00'], [null, undefined]]);
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toBe('attachment; filename="absensi.csv"');
    expect(res.body).toBe('﻿Nama,Jam\r\nBudi,08:00\r\n,\r\n');
  });

  it('meng-escape koma, kutip, dan baris baru', () => {
    const res = capture();
    sendCsv(res, 'x.csv', ['Catatan'], [['Rapat, lalu "review"\nselesai']]);
    expect(res.body).toContain('"Rapat, lalu ""review""\nselesai"');
  });

  it('mencegah CSV injection: teks diawali = + - @ diberi tanda kutip tunggal, angka tidak', () => {
    const res = capture();
    sendCsv(res, 'x.csv', ['A', 'B', 'C', 'D'], [['=HYPERLINK("http://x")', '@SUM(A1)', '-5', -5]]);
    const line = res.body.split('\r\n')[1];
    expect(line).toBe(`"'=HYPERLINK(""http://x"")",'@SUM(A1),'-5,-5`);
  });
});
