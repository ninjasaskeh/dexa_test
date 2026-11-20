import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Response } from 'express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { diskStorage } from 'multer';
import { localDate } from '@app/common';

export const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads');

const ALLOWED = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

/** Foto absensi disimpan di disk lokal: uploads/attendance/YYYY-MM/<uuid>.jpg */
export function multerOptions(): MulterOptions {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(UPLOAD_ROOT, 'attendance', localDate().slice(0, 7));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED.get(file.mimetype)}`),
    }),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.has(file.mimetype)) {
        return cb(new BadRequestException({ statusCode: 400, message: 'Validasi gagal', errors: { photo: 'Foto harus berformat JPG, PNG, atau WEBP' } }), false);
      }
      cb(null, true);
    },
  };
}

const photoError = (message: string) => new BadRequestException({ statusCode: 400, message: 'Validasi gagal', errors: { photo: message } });

/** Cek isi file (magic bytes), bukan hanya mimetype dari client */
export async function assertRealImage(filePath: string, mimetype: string) {
  const fh = await fs.promises.open(filePath, 'r');
  const buf = Buffer.alloc(12);
  try {
    await fh.read(buf, 0, 12, 0);
  } finally {
    await fh.close();
  }
  const ok =
    (mimetype === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    (mimetype === 'image/png' && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mimetype === 'image/webp' && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP');
  if (!ok) throw photoError('File bukan gambar JPG, PNG, atau WEBP yang valid');
}

/** Multer melempar "File too large" (bahasa Inggris); ubah ke format error aplikasi */
@Catch(PayloadTooLargeException)
export class UploadTooLargeFilter implements ExceptionFilter {
  catch(_e: PayloadTooLargeException, host: ArgumentsHost) {
    const message = `Ukuran foto maksimal ${Number(process.env.MAX_UPLOAD_MB ?? 5)} MB`;
    host.switchToHttp().getResponse<Response>().status(413).json({ statusCode: 413, message, errors: { photo: message } });
  }
}
