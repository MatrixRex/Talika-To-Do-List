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
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // 3. IDAT
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = rowOffset + 1 + x * 4;
      rawData[dstIdx] = rgbaBuffer[srcIdx];
      rawData[dstIdx + 1] = rgbaBuffer[srcIdx + 1];
      rawData[dstIdx + 2] = rgbaBuffer[srcIdx + 2];
      rawData[dstIdx + 3] = rgbaBuffer[srcIdx + 3];
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

// Evaluate cubic bezier at t: B(t) = (1-t)^3 P0 + 3(1-t)^2 t P1 + 3(1-t) t^2 P2 + t^3 P3
function evalCubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

// Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// Discretize curves into fine line segments for high-speed, exact vector rasterization
const STEPS = 300;
const pathSegments = [];

function addCubicCurve(p0, p1, p2, p3) {
  let prev = evalCubicBezier(p0, p1, p2, p3, 0);
  for (let i = 1; i <= STEPS; i++) {
    const curr = evalCubicBezier(p0, p1, p2, p3, i / STEPS);
    pathSegments.push({ x1: prev.x, y1: prev.y, x2: curr.x, y2: curr.y });
    prev = curr;
  }
}

// Path 1 from icon-v2.svg: M107.062 155.56 C162.518 81.151, 335.385 179.013, 404.94 144.077
addCubicCurve(
  { x: 107.062, y: 155.56 },
  { x: 162.518, y: 81.151 },
  { x: 335.385, y: 179.013 },
  { x: 404.94, y: 144.077 }
);

// Path 2A from icon-v2.svg: M229.879 252.972 C322.005 120.128, 383.279 385.15, 222.538 385.15
addCubicCurve(
  { x: 229.879, y: 252.972 },
  { x: 322.005, y: 120.128 },
  { x: 383.279, y: 385.15 },
  { x: 222.538, y: 385.15 }
);

// Path 2B from icon-v2.svg: C110.942 385.15, 72.7733 233.823, 165.613 184.309
addCubicCurve(
  { x: 222.538, y: 385.15 },
  { x: 110.942, y: 385.15 },
  { x: 72.7733, y: 233.823 },
  { x: 165.613, y: 184.309 }
);

// Path 3 from icon-v2.svg: M381.758 155.559 V367.559
pathSegments.push({
  x1: 381.758,
  y1: 155.559,
  x2: 381.758,
  y2: 367.559,
});

const STROKE_RADIUS = 18; // Half of stroke-width 36

/**
 * Render exact icon-v2.svg to pixel buffer at target size with MSAA supersampling
 */
function renderExactIcon(targetSize) {
  const buffer = new Uint8Array(targetSize * targetSize * 4);
  const scale = 512 / targetSize;

  // 4x4 MSAA subpixel sampling grid for smooth antialiasing
  const subSamples = 4;
  const totalSub = subSamples * subSamples;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let sy = 0; sy < subSamples; sy++) {
        for (let sx = 0; sx < subSamples; sx++) {
          const px = (x + (sx + 0.5) / subSamples) * scale;
          const py = (y + (sy + 0.5) / subSamples) * scale;

          // Distance to center of circle (256, 256)
          const distToCenter = Math.hypot(px - 256, py - 256);

          if (distToCenter <= 236) {
            // Linear gradient: (48, 32) -> (464, 480)
            const gdx = 464 - 48;
            const gdy = 480 - 32;
            const glenSq = gdx * gdx + gdy * gdy;
            const t = Math.max(0, Math.min(1, ((px - 48) * gdx + (py - 32) * gdy) / glenSq));

            let bgR, bgG, bgB;
            if (t <= 0.55) {
              const u = t / 0.55;
              bgR = Math.round(59 + (37 - 59) * u);   // #3B82F6 -> #2563EB
              bgG = Math.round(130 + (99 - 130) * u);
              bgB = Math.round(246 + (235 - 246) * u);
            } else {
              const u = (t - 0.55) / 0.45;
              bgR = Math.round(37 + (29 - 37) * u);   // #2563EB -> #1D4ED8
              bgG = Math.round(99 + (78 - 99) * u);
              bgB = Math.round(235 + (216 - 235) * u);
            }

            // Outer stroke highlight at radius 234 (stroke width 4)
            if (distToCenter >= 230 && distToCenter <= 234) {
              const strokeAlpha = (1 - t) * 0.25 + 0.05;
              bgR = Math.round(bgR * (1 - strokeAlpha) + 255 * strokeAlpha);
              bgG = Math.round(bgG * (1 - strokeAlpha) + 255 * strokeAlpha);
              bgB = Math.round(bgB * (1 - strokeAlpha) + 255 * strokeAlpha);
            }

            // Check distance to exact vector glyph paths
            let minDist = Infinity;
            for (let s = 0; s < pathSegments.length; s++) {
              const seg = pathSegments[s];
              const d = distToSegment(px, py, seg.x1, seg.y1, seg.x2, seg.y2);
              if (d < minDist) {
                minDist = d;
                if (minDist <= STROKE_RADIUS) break;
              }
            }

            if (minDist <= STROKE_RADIUS) {
              // Inside the white glyph
              rSum += 255;
              gSum += 255;
              bSum += 255;
              aSum += 255;
            } else {
              // Background circle pixel
              rSum += bgR;
              gSum += bgG;
              bSum += bgB;
              aSum += 255;
            }
          }
        }
      }

      const idx = (y * targetSize + x) * 4;
      buffer[idx] = Math.round(rSum / totalSub);
      buffer[idx + 1] = Math.round(gSum / totalSub);
      buffer[idx + 2] = Math.round(bSum / totalSub);
      buffer[idx + 3] = Math.round(aSum / totalSub);
    }
  }

  return buffer;
}

const sizes = [16, 32, 48, 128, 192, 512];
for (const size of sizes) {
  const rgba = renderExactIcon(size);
  const png = createPng(size, size, rgba);
  const targetPath = path.join(outputDir, `icon-${size}.png`);
  fs.writeFileSync(targetPath, png);
  console.log(`Generated exact brand icon ${targetPath} (${size}x${size}, ${png.length} bytes)`);
}
