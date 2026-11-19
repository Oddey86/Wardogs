import { tmpdir } from 'node:os';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const source = path.join(tmpdir(), 'wardogs-kestrel-frames');
const output = fileURLToPath(new URL('../public/air-patrol/', import.meta.url));
await mkdir(output, { recursive: true });
for (let sheet = 0; sheet < 20; sheet++) {
  const tiles = Array.from({ length: 6 }, (_, tile) => ({
    input: path.join(source, String(sheet * 6 + tile).padStart(3, '0') + '.png'),
    left: (tile % 3) * 896, top: Math.floor(tile / 3) * 480,
  }));
  await sharp({ create: { width: 2688, height: 960, channels: 4, background: '#0000' } })
    .composite(tiles).webp({ quality: 88, alphaQuality: 95 }).toFile(path.join(output, 'orbit-' + sheet + '.webp'));
}
await sharp(path.join(source, '000.png')).webp({ quality: 92 }).toFile(path.join(output,'kestrel.webp'));
