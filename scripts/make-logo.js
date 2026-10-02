// Renders the MoneyMate logo (white wallet on an indigo rounded square) to PNG.
// No dependencies: shapes are drawn with signed-distance functions (anti-aliased edges)
// and encoded with Node's zlib. Run: node scripts/make-logo.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function encodePng(width, height, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Signed distance to a rounded rectangle (negative inside). Units: fractions of the canvas. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

function render(size, { badge = true } = {}) {
  const out = Buffer.alloc(size * size * 4);
  const px1 = 1 / size; // one pixel in canvas units, for anti-aliasing
  const cover = (d) => Math.min(1, Math.max(0, 0.5 - d / px1));
  const [a1, a2] = [hex('#6366F1'), hex('#4338CA')];
  const pocket = hex('#818CF8');

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size;
      const y = (j + 0.5) / size;
      let r = 0, g = 0, b = 0, a = 0;
      const over = (cr, cg, cb, ca) => {
        // "source over" compositing, straight alpha
        const na = ca + a * (1 - ca);
        if (na <= 0) return;
        r = (cr * ca + r * a * (1 - ca)) / na;
        g = (cg * ca + g * a * (1 - ca)) / na;
        b = (cb * ca + b * a * (1 - ca)) / na;
        a = na;
      };

      if (badge) {
        const t = Math.min(1, Math.max(0, (x + y) / 2));
        const bc = a1.map((v, k) => v + (a2[k] - v) * t);
        over(bc[0], bc[1], bc[2], cover(sdRoundRect(x, y, 0, 0, 1, 1, 0.23)));
        // soft top-left highlight
        const hl = Math.max(0, 1 - Math.hypot(x - 0.25, y - 0.15) / 0.8) * 0.18;
        over(255, 255, 255, hl * cover(sdRoundRect(x, y, 0, 0, 1, 1, 0.23)));
      }
      // wallet: back flap, body, clasp pocket, clasp dot
      over(255, 255, 255, 0.55 * cover(sdRoundRect(x, y, 0.24, 0.27, 0.46, 0.2, 0.07)));
      over(255, 255, 255, cover(sdRoundRect(x, y, 0.2, 0.36, 0.6, 0.4, 0.09)));
      over(pocket[0], pocket[1], pocket[2], cover(sdRoundRect(x, y, 0.58, 0.47, 0.26, 0.18, 0.09)));
      over(255, 255, 255, cover(sdCircle(x, y, 0.665, 0.56, 0.035)));

      const o = (j * size + i) * 4;
      out[o] = Math.round(r);
      out[o + 1] = Math.round(g);
      out[o + 2] = Math.round(b);
      out[o + 3] = Math.round(a * 255);
    }
  }
  return encodePng(size, size, out);
}

const assets = path.join(__dirname, '..', 'assets');
const outputs = [
  ['splash-icon.png', 800], // native splash + in-app loading screen
  ['favicon.png', 64], // web tab icon (64px stays sharp on 2× screens)
];
for (const [name, size] of outputs) {
  fs.writeFileSync(path.join(assets, name), render(size));
  console.log(`wrote assets/${name} (${size}×${size})`);
}
