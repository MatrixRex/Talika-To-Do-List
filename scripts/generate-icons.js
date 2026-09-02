import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Precompute CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf, offset, length) {
  let c = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPng(width, height, rgbaBuffer) {
  // 1. Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // 2. IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // 3. IDAT (Scanlines with filter byte 0)
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx] = rgbaBuffer[srcIdx];         // R
      rawData[dstIdx + 1] = rgbaBuffer[srcIdx + 1]; // G
      rawData[dstIdx + 2] = rgbaBuffer[srcIdx + 2]; // B
      rawData[dstIdx + 3] = rgbaBuffer[srcIdx + 3]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // 4. IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(typeStr, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(typeStr, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk, 4, 4 + length);
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

/**
 * Draw Talika App Icon onto an RGBA buffer
 */
function renderTalikaIcon(size) {
  const buffer = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Antialiased circle boundary
      if (dist <= radius + 0.75) {
        let alpha = 1;
        if (dist > radius - 0.75) {
          alpha = Math.max(0, Math.min(1, (radius + 0.75 - dist) / 1.5));
        }

        // Gradient from #3B82F6 (top) to #1D4ED8 (bottom)
        const t = (y / size);
        const r = Math.round(59 + (29 - 59) * t);
        const g = Math.round(130 + (78 - 130) * t);
        const b = Math.round(246 + (216 - 246) * t);

        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = Math.round(alpha * 255);
      }
    }
  }

  // Draw checkmark / emblem in center with white pixels
  const u = size / 32; // Unit scale
  const checkPoints = [
    // Left segment (descending check)
    { x1: 9 * u, y1: 16 * u, x2: 14 * u, y2: 21 * u, stroke: 2.8 * u },
    // Right segment (ascending check)
    { x1: 14 * u, y1: 21 * u, x2: 23 * u, y2: 11 * u, stroke: 2.8 * u },
    // Top horizontal bar (symbolizing task line)
    { x1: 9 * u, y1: 10 * u, x2: 23 * u, y2: 10 * u, stroke: 2.2 * u }
  ];

  for (const seg of checkPoints) {
    const { x1, y1, x2, y2, stroke } = seg;
    const halfStroke = stroke / 2;
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - stroke));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + stroke));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - stroke));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + stroke));

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;

        // Projection of (px, py) onto segment
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        const dist = Math.hypot(px - projX, py - projY);
        if (dist <= halfStroke + 0.6) {
          let markAlpha = 1;
          if (dist > halfStroke - 0.6) {
            markAlpha = Math.max(0, Math.min(1, (halfStroke + 0.6 - dist) / 1.2));
          }

          const idx = (y * size + x) * 4;
          const bgAlpha = buffer[idx + 3] / 255;
          if (bgAlpha > 0.1) {
            // Alpha composite white (255, 255, 255) over background
            const blendedR = Math.round(buffer[idx] * (1 - markAlpha) + 255 * markAlpha);
            const blendedG = Math.round(buffer[idx + 1] * (1 - markAlpha) + 255 * markAlpha);
            const blendedB = Math.round(buffer[idx + 2] * (1 - markAlpha) + 255 * markAlpha);

            buffer[idx] = blendedR;
            buffer[idx + 1] = blendedG;
            buffer[idx + 2] = blendedB;
          }
        }
      }
    }
  }

  return buffer;
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const rgba = renderTalikaIcon(size);
  const png = createPng(size, size, rgba);
  const targetPath = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(targetPath, png);
  console.log(`Generated ${targetPath} (${size}x${size}, ${png.length} bytes)`);
}

