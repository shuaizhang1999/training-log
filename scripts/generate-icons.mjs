/**
 * Generates the PWA icons (dark plate + orange barbell) without any image
 * dependencies: pixels are drawn into an RGBA buffer and written as PNG by
 * hand (zlib from node:zlib, chunks + CRC assembled here).
 *
 * Rerun after tweaking colors/shapes:  node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BG = [0x09, 0x09, 0x0b, 255];
const ACCENT = [0xf4, 0x53, 0x0c, 255];
const STEEL = [0x8f, 0x8f, 0x9b, 255];

// --- minimal PNG writer -----------------------------------------------------

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(path, size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${png.length} bytes)`);
}

// --- drawing ----------------------------------------------------------------

function roundedRectHit(px, py, x, y, w, h, r) {
  if (px < x || px >= x + w || py < y || py >= y + h) return false;
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  return (px - cx) ** 2 + (py - cy) ** 2 <= r ** 2 || (px >= x + r && px < x + w - r) || (py >= y + r && py < y + h - r);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  // Barbell geometry, kept inside the central 60% so maskable crops are safe.
  const u = size / 100;
  const cy = 50 * u;
  const bar = { x: 14 * u, y: cy - 3.5 * u, w: 72 * u, h: 7 * u, r: 3.5 * u };
  const plates = [
    { x: 24 * u, w: 9 * u, h: 44 * u, color: ACCENT },
    { x: 35 * u, w: 6 * u, h: 32 * u, color: ACCENT },
    { x: 67 * u, w: 9 * u, h: 44 * u, color: ACCENT },
    { x: 59 * u, w: 6 * u, h: 32 * u, color: ACCENT },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = BG;
      if (roundedRectHit(x, y, bar.x, bar.y, bar.w, bar.h, bar.r)) color = STEEL;
      for (const p of plates) {
        if (roundedRectHit(x, y, p.x, cy - p.h / 2, p.w, p.h, 2.5 * u)) color = p.color;
      }
      const i = (y * size + x) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = color[3];
    }
  }
  return buf;
}

const outDir = join(import.meta.dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const [name, size] of [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
]) {
  writePng(join(outDir, name), size, drawIcon(size));
}
