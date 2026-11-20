import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { assertRealImage } from './upload.config';

describe('assertRealImage (cek isi file, bukan hanya mimetype)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dexa-img-'));
  const file = (name: string, bytes: number[] | string) => {
    const p = path.join(dir, name);
    fs.writeFileSync(p, typeof bytes === 'string' ? bytes : Buffer.from(bytes));
    return p;
  };
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('menerima JPG, PNG, dan WEBP asli', async () => {
    await expect(assertRealImage(file('a.jpg', [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), 'image/jpeg')).resolves.toBeUndefined();
    await expect(assertRealImage(file('a.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), 'image/png')).resolves.toBeUndefined();
    await expect(assertRealImage(file('a.webp', 'RIFF\0\0\0\0WEBPVP8 '), 'image/webp')).resolves.toBeUndefined();
  });

  it('menolak file lain yang mengaku gambar', async () => {
    await expect(assertRealImage(file('evil.jpg', '<?php echo 1; ?>'), 'image/jpeg')).rejects.toMatchObject({
      response: { statusCode: 400, errors: { photo: 'File bukan gambar JPG, PNG, atau WEBP yang valid' } },
    });
    // PNG asli tetapi dikirim sebagai JPEG
    await expect(assertRealImage(file('b.png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), 'image/jpeg')).rejects.toBeDefined();
  });
});
