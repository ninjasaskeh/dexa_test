import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Nomor urut baris tabel; untuk tabel berhalaman, lanjut dari halaman sebelumnya */
export function rowNo(index: number, meta?: { page: number; limit: number }) {
  return (meta ? (meta.page - 1) * meta.limit : 0) + index + 1
}
