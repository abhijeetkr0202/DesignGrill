// Generates the 1024x1024 source icon used by `tauri icon`. Run: node scripts/make-icon.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const N = 1024;
const px = Buffer.alloc(N * N * 4);
const set = (x, y, r, g, b, a = 255) => {
  const i = (y * N + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
};
const inRoundRect = (x, y, x0, y0, x1, y1, rad) => {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const cx = x < x0 + rad ? x0 + rad : x >= x1 - rad ? x1 - rad - 1 : x;
  const cy = y < y0 + rad ? y0 + rad : y >= y1 - rad ? y1 - rad - 1 : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2;
};
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    if (!inRoundRect(x, y, 64, 64, N - 64, N - 64, 200)) continue;
    set(x, y, 24, 28, 38);
    // Grill bars with an orange flame-colored gradient.
    const bar = Math.floor((y - 300) / 110);
    if (y >= 300 && y < 300 + 110 * 4 && (y - 300) % 110 < 56 && x > 220 && x < N - 220) {
      const t = bar / 3;
      set(x, y, 255, Math.round(120 + 90 * t), Math.round(40 + 20 * t));
    }
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('src-tauri/icons', { recursive: true });
writeFileSync('src-tauri/app-icon.png', png);
