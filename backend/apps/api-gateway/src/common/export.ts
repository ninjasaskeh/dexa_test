import type { Response } from 'express';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { sendCsv } from './csv';

/** `?format=csv|xlsx` di endpoint export (default csv) */
export const exportFormatSchema = z.enum(['csv', 'xlsx'], 'Format export harus csv atau xlsx').default('csv');
export type ExportFormat = z.infer<typeof exportFormatSchema>;

/** Date hanya untuk Excel (ditulis sebagai tanggal UTC); CSV memakai teks */
type Cell = string | number | Date | null | undefined;

export interface ExportColumn {
  header: string;
  /** lebar kolom Excel (karakter) */
  width?: number;
  /** format angka Excel, mis. '0' atau '0.0' atau '0%' */
  numFmt?: string;
  align?: 'left' | 'center' | 'right';
}

export interface ExportTable {
  /** nama file tanpa ekstensi */
  filename: string;
  sheetName: string;
  /** judul di baris pertama sheet Excel, mis. "Absensi 1 Nov – 30 Nov 2026" */
  title: string;
  columns: ExportColumn[];
  rows: Cell[][];
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Buat file .xlsx: judul, header tebal berwarna, baris header dibekukan, autofilter, dan lebar kolom.
 * Nilai string disimpan sebagai teks (bukan formula), jadi aman dari formula injection.
 */
export async function buildXlsx(t: ExportTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dexa WFH';
  wb.created = new Date();
  const ws = wb.addWorksheet(t.sheetName.slice(0, 31), { views: [{ state: 'frozen', ySplit: 3 }] });

  ws.mergeCells(1, 1, 1, t.columns.length);
  const title = ws.getCell(1, 1);
  title.value = t.title;
  title.font = { bold: true, size: 14 };
  ws.getRow(1).height = 22;

  const header = ws.getRow(3);
  t.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA52823' } }; // primary Dexa
    cell.alignment = { vertical: 'middle', horizontal: c.align ?? 'left', wrapText: true };
    ws.getColumn(i + 1).width = c.width ?? Math.max(10, c.header.length + 2);
  });
  header.height = 20;

  t.rows.forEach((r, ri) => {
    const row = ws.getRow(4 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v === undefined ? null : v;
      const col = t.columns[ci];
      if (col?.numFmt) cell.numFmt = col.numFmt;
      if (col?.align) cell.alignment = { horizontal: col.align };
    });
  });

  if (t.rows.length) ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + t.rows.length, column: t.columns.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Kirim tabel sebagai CSV atau Excel sesuai `format` */
export async function sendExport(res: Response, format: ExportFormat, t: ExportTable) {
  if (format === 'csv') {
    sendCsv(res, `${t.filename}.csv`, t.columns.map((c) => c.header), t.rows.map((r) => r.map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v))));
    return;
  }
  const buf = await buildXlsx(t);
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${t.filename}.xlsx"`);
  res.send(buf);
}
