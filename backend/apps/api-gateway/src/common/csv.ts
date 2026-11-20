import type { Response } from 'express';

type Cell = string | number | boolean | null | undefined;

/** Sel yang diawali karakter ini bisa dieksekusi sebagai formula oleh Excel (CSV injection) */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v: Cell): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (typeof v === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV UTF-8 dengan BOM agar huruf non-ASCII terbaca benar di Excel */
export function sendCsv(res: Response, filename: string, headers: string[], rows: Cell[][]) {
  const body = [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`﻿${body}\r\n`);
}
