// Procedural AAA PBR Texture Suite for Chapter 26 — «Abandoned Knight Rift»
// Generates shared high-resolution procedural PBR maps with ZERO duplicate VRAM clones:
//   - Gothic Flagstone Floor (albedo + dual-scale Sobel normal + wet/polished roughness 0.32..0.94)
//   - Carved Gothic Ashlar Stone (albedo + dual-scale Sobel normal + weathered roughness)
//   - Soot-Stained Cathedral Vault Stone (albedo + deep relief Sobel normal)
//   - Royal Heraldic Tapestry / Velvet Banner (albedo + woven/fold/embroidery normal + velvet/gold roughness)
//   - Hand-Forged Hammered Wrought Iron (Voronoi peen normal + patina/edge-glint roughness)
//   - 2x2 Storytelling Ground Decal Atlas (Cracks | Coagulated Blood | Damp Moss | Ash Scorch & Melted Wax)
//   - Atmospheric Swirling Gothic Fog Wall & Volumetric Abyss Mist
// Resolution adapts automatically: 1024px (Desktop) / 512px (Mobile) for stone & decals,
// 512x1024 (Desktop) / 256x512 (Mobile) for 1:2 hanging banners, 512px / 256px for forged iron.

import * as THREE from '../../vendor/three.module.js';

// ============================================================================
// Core Deterministic RNG, Math & High-Speed Tileable Noise Primitives
// ============================================================================
function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function createCanvas2D(width, height) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getFastCtx2D(canvas, willRead = false) {
  return canvas.getContext('2d', willRead ? { willReadFrequently: true } : undefined);
}

function createFallbackTexture(r, g, b, a, isColor, wrapMode, anisotropy) {
  const data = new Uint8Array([r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = wrapMode;
  tex.wrapT = wrapMode;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Fast tileable 2D value noise (power-of-2 gridSize)
function createTileableNoiseGrid(gridSize, seed) {
  const rng = makeRng(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return { grid, size: gridSize, mask: gridSize - 1 };
}

// Precompute X lookup tables (x0, x1, smoothstep sx) once per noise layer to eliminate millions of ops!
function buildNoiseAxisLUT(n, length, freq) {
  const x0 = new Int32Array(length);
  const x1 = new Int32Array(length);
  const sx = new Float32Array(length);
  const scale = (freq * n.size) / length;
  const mask = n.mask;
  for (let i = 0; i < length; i++) {
    const g = i * scale;
    const gi = g | 0;
    const f = g - gi;
    const i0 = gi & mask;
    x0[i] = i0;
    x1[i] = (i0 + 1) & mask;
    sx[i] = f * f * (3 - 2 * f);
  }
  return { x0, x1, sx };
}

function sampleRowParams(n, gy) {
  const iy = gy | 0;
  const y0 = iy & n.mask;
  const y1 = (y0 + 1) & n.mask;
  const fy = gy - iy;
  return {
    r0: y0 * n.size,
    r1: y1 * n.size,
    sy: fy * fy * (3 - 2 * fy)
  };
}

// Tileable cellular Voronoi grid (for hammered iron peen dimples)
function createTileableVoronoiGrid(cells, seed, jitter = 0.82) {
  const rng = makeRng(seed);
  const count = cells * cells;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const depth = new Float32Array(count);
  const pad = (1 - jitter) * 0.5;
  for (let i = 0; i < count; i++) {
    px[i] = pad + rng() * jitter;
    py[i] = pad + rng() * jitter;
    depth[i] = 0.68 + rng() * 0.62;
  }
  return { cells, px, py, depth };
}

// Bounding-box culled wrapped drawing: draws 1x for interior shapes, 2-4x only across borders (100% seamless!)
function drawWrappedFast(ctx, width, height, minX, minY, maxX, maxY, fn) {
  const oxStart = maxX > width ? -width : 0;
  const oxEnd = minX < 0 ? width : 0;
  const oyStart = maxY > height ? -height : 0;
  const oyEnd = minY < 0 ? height : 0;
  for (let ox = oxStart; ox <= oxEnd; ox += width) {
    for (let oy = oyStart; oy <= oyEnd; oy += height) {
      if (ox === 0 && oy === 0) {
        fn();
      } else {
        ctx.save();
        ctx.translate(ox, oy);
        fn();
        ctx.restore();
      }
    }
  }
}

// Configure CanvasTexture with standard AAA mipmap & anisotropy settings
function finalizeCanvasTexture(canvas, { isColor = true, repeat = true, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Dual-scale resolution-invariant Sobel tangent-space normalMap DataTexture.
// Rows are pre-flipped (dstRow = height - 1 - y) with flipY=false so WebGL UV (u, v) aligns
// pixel-for-pixel with THREE.CanvasTexture (flipY=true) without UNPACK_FLIP_Y_WEBGL quirks!
function buildNormalMapFromHeight(
  heightData,
  width,
  height,
  microStrength,
  macroStrength,
  anisotropy,
  repeat = true
) {
  const data = new Uint8Array(width * height * 4);
  const wMask = width - 1;
  const hMask = height - 1;
  const wMax = width - 1;
  const hMax = height - 1;
  const r2 = Math.max(2, Math.round(2 * (width / 512)));

  if (repeat) {
    for (let y = 0; y < height; y++) {
      const ym1 = ((y - 1) & hMask) * width;
      const y0 = y * width;
      const yp1 = ((y + 1) & hMask) * width;
      const ym2 = ((y - r2) & hMask) * width;
      const yp2 = ((y + r2) & hMask) * width;
      const dstRow = (hMax - y) * width;

      for (let x = 0; x < width; x++) {
        const xm1 = (x - 1) & wMask;
        const xp1 = (x + 1) & wMask;
        const xm2 = (x - r2) & wMask;
        const xp2 = (x + r2) & wMask;

        const tl1 = heightData[ym1 + xm1];
        const t1  = heightData[ym1 + x];
        const tr1 = heightData[ym1 + xp1];
        const l1  = heightData[y0 + xm1];
        const r1  = heightData[y0 + xp1];
        const bl1 = heightData[yp1 + xm1];
        const b1  = heightData[yp1 + x];
        const br1 = heightData[yp1 + xp1];

        const dx1 = (tr1 + 2 * r1 + br1) - (tl1 + 2 * l1 + bl1);
        const dy1 = (bl1 + 2 * b1 + br1) - (tl1 + 2 * t1 + tr1);

        const tl2 = heightData[ym2 + xm2];
        const t2  = heightData[ym2 + x];
        const tr2 = heightData[ym2 + xp2];
        const l2  = heightData[y0 + xm2];
        const r2v = heightData[y0 + xp2];
        const bl2 = heightData[yp2 + xm2];
        const b2  = heightData[yp2 + x];
        const br2 = heightData[yp2 + xp2];

        const dx2 = (tr2 + 2 * r2v + br2) - (tl2 + 2 * l2 + bl2);
        const dy2 = (bl2 + 2 * b2 + br2) - (tl2 + 2 * t2 + tr2);

        let nx = -(dx1 * microStrength + dx2 * macroStrength);
        let ny =  (dy1 * microStrength + dy2 * macroStrength);
        const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);
        nx *= invLen;
        ny *= invLen;

        const idx = (dstRow + x) * 4;
        data[idx]     = (nx * 127.5 + 127.5) | 0;
        data[idx + 1] = (ny * 127.5 + 127.5) | 0;
        data[idx + 2] = (invLen * 127.5 + 127.5) | 0;
        data[idx + 3] = 255;
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      const ym1 = (y > 0 ? y - 1 : 0) * width;
      const y0 = y * width;
      const yp1 = (y < hMax ? y + 1 : hMax) * width;
      const ym2 = (y >= r2 ? y - r2 : 0) * width;
      const yp2 = (y + r2 <= hMax ? y + r2 : hMax) * width;
      const dstRow = (hMax - y) * width;

      for (let x = 0; x < width; x++) {
        const xm1 = x > 0 ? x - 1 : 0;
        const xp1 = x < wMax ? x + 1 : wMax;
        const xm2 = x >= r2 ? x - r2 : 0;
        const xp2 = x + r2 <= wMax ? x + r2 : wMax;

        const tl1 = heightData[ym1 + xm1];
        const t1  = heightData[ym1 + x];
        const tr1 = heightData[ym1 + xp1];
        const l1  = heightData[y0 + xm1];
        const r1  = heightData[y0 + xp1];
        const bl1 = heightData[yp1 + xm1];
        const b1  = heightData[yp1 + x];
        const br1 = heightData[yp1 + xp1];

        const dx1 = (tr1 + 2 * r1 + br1) - (tl1 + 2 * l1 + bl1);
        const dy1 = (bl1 + 2 * b1 + br1) - (tl1 + 2 * t1 + tr1);

        const tl2 = heightData[ym2 + xm2];
        const t2  = heightData[ym2 + x];
        const tr2 = heightData[ym2 + xp2];
        const l2  = heightData[y0 + xm2];
        const r2v = heightData[y0 + xp2];
        const bl2 = heightData[yp2 + xm2];
        const b2  = heightData[yp2 + x];
        const br2 = heightData[yp2 + xp2];

        const dx2 = (tr2 + 2 * r2v + br2) - (tl2 + 2 * l2 + bl2);
        const dy2 = (bl2 + 2 * b2 + br2) - (tl2 + 2 * t2 + tr2);

        let nx = -(dx1 * microStrength + dx2 * macroStrength);
        let ny =  (dy1 * microStrength + dy2 * macroStrength);
        const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);
        nx *= invLen;
        ny *= invLen;

        const idx = (dstRow + x) * 4;
        data[idx]     = (nx * 127.5 + 127.5) | 0;
        data[idx + 1] = (ny * 127.5 + 127.5) | 0;
        data[idx + 2] = (invLen * 127.5 + 127.5) | 0;
        data[idx + 3] = 255;
      }
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Build a pre-flipped roughness DataTexture directly from a Float32Array [0..1]
function buildRoughnessMapFromField(roughData, width, height, anisotropy, repeat = true) {
  const data = new Uint8Array(width * height * 4);
  const hMax = height - 1;
  for (let y = 0; y < height; y++) {
    const srcRow = y * width;
    const dstRow = (hMax - y) * width;
    for (let x = 0; x < width; x++) {
      const v = clamp01(roughData[srcRow + x]);
      const byteVal = (v * 255 + 0.5) | 0;
      const idx = (dstRow + x) * 4;
      data[idx]     = byteVal;
      data[idx + 1] = byteVal;
      data[idx + 2] = byteVal;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  const wrap = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Build a weathered, slightly chipped multi-vertex stone slab polygon (12 vertices)
function buildChippedStonePolygon(x, y, w, h, scale, rand, chipChance = 0.65) {
  const bevel = Math.min(w, h) * 0.085;
  const jit = (amp) => (rand() - 0.5) * amp * scale;

  const basePts = [
    [x + bevel + jit(2.4),     y + jit(2.2)],
    [x + w * 0.5 + jit(3.0),   y + jit(2.6)],
    [x + w - bevel + jit(2.4), y + jit(2.2)],
    [x + w + jit(2.2),         y + bevel + jit(2.4)],
    [x + w + jit(2.6),         y + h * 0.5 + jit(3.0)],
    [x + w + jit(2.2),         y + h - bevel + jit(2.4)],
    [x + w - bevel + jit(2.4), y + h + jit(2.2)],
    [x + w * 0.5 + jit(3.0),   y + h + jit(2.6)],
    [x + bevel + jit(2.4),     y + h + jit(2.2)],
    [x + jit(2.2),             y + h - bevel + jit(2.4)],
    [x + jit(2.6),             y + h * 0.5 + jit(3.0)],
    [x + jit(2.2),             y + bevel + jit(2.4)]
  ];

  // Carve 1-2 realistic concave edge chips inward so stones feel battle-worn & hand-hewn
  const chips = [];
  if (rand() < chipChance) {
    const chipCount = rand() < 0.40 ? 2 : 1;
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    for (let k = 0; k < chipCount; k++) {
      const idx = Math.floor(rand() * basePts.length);
      const pt = basePts[idx];
      const dx = cx - pt[0];
      const dy = cy - pt[1];
      const d = Math.hypot(dx, dy) || 1;
      const cut = (4.0 + rand() * 6.0) * scale;
      const chipX = pt[0] + (dx / d) * cut;
      const chipY = pt[1] + (dy / d) * cut;
      pt[0] = chipX;
      pt[1] = chipY;
      chips.push({ x: chipX, y: chipY, r: cut * 0.95 });
    }
  }

  return { pts: basePts, chips };
}

function tracePolyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// ============================================================================
// 1. Gothic Flagstone Floor PBR Set (1024px PC / 512px Mobile)
//    Deep chamfered bevels, chipped edges, micro-fractures, mossy AO mortar,
//    wet puddle / polished-stone roughness variation (0.32 -> 0.94).
// ============================================================================
function createFlagstonePbrSet(size, anisotropy) {
  const albedoCanvas = createCanvas2D(size, size);
  const heightCanvas = createCanvas2D(size, size);
  if (!albedoCanvas || !heightCanvas) {
    return {
      albedo: createFallbackTexture(62, 66, 78, 255, true, THREE.RepeatWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.RepeatWrapping, anisotropy),
      roughness: createFallbackTexture(196, 196, 196, 255, false, THREE.RepeatWrapping, anisotropy)
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const hctx = getFastCtx2D(heightCanvas, true);
  const scale = size / 512;
  const rand = makeRng(261337);

  // Packed charcoal-ash & dark damp soil mortar bed
  ctx.fillStyle = '#0d0f15';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#0c0c0c';
  hctx.fillRect(0, 0, size, size);

  const stoneTones = [
    [58, 63, 77],   // cold moonlit slate
    [49, 53, 66],   // deep gothic basalt
    [68, 70, 82],   // weathered pale ash-granite
    [61, 59, 70],   // warm soot-stained granite
    [45, 49, 61],   // dark catacomb flagstone
    [72, 75, 87],   // worn silver limestone
    [54, 59, 68]    // damp iron-slate
  ];

  // 6 monumental staggered courses — 100% seamlessly wrapped across 0..size!
  const rows = 6;
  const rowH = size / rows;
  const colCounts = [4, 5, 4, 5, 4, 5];

  for (let r = 0; r < rows; r++) {
    const cols = colCounts[r];
    const rowOff = ((r * 0.43 + (r % 2) * 0.14) % 1) * size;

    const weights = new Float32Array(cols);
    let wSum = 0;
    for (let c = 0; c < cols; c++) {
      weights[c] = 0.78 + rand() * 0.48;
      wSum += weights[c];
    }

    let cursorX = rowOff;
    for (let c = 0; c < cols; c++) {
      const cellW = (weights[c] / wSum) * size;
      const mortarGap = (3.4 + rand() * 1.4) * scale;
      const x = cursorX + mortarGap;
      const y = r * rowH + mortarGap;
      const w = cellW - mortarGap * 2;
      const h = rowH - mortarGap * 2;
      cursorX += cellW;

      const tone = stoneTones[Math.floor(rand() * stoneTones.length)];
      const shift = Math.floor((rand() - 0.5) * 20);
      const red = Math.max(26, Math.min(118, tone[0] + shift));
      const grn = Math.max(26, Math.min(118, tone[1] + shift));
      const blu = Math.max(32, Math.min(132, tone[2] + shift));

      const { pts, chips } = buildChippedStonePolygon(x, y, w, h, scale, rand, 0.68);

      const faceH = Math.round(168 + rand() * 68);
      const tiltDir = rand() * Math.PI * 2;
      const tiltSpan = Math.round(15 + rand() * 18);
      const gradAngle = rand() * Math.PI * 2;
      const cx = x + w * 0.5;
      const cy = y + h * 0.5;
      const rad = Math.max(w, h) * 0.56;

      // Natural stone pitting speckles
      const pits = [];
      const pitCount = 8 + Math.floor(rand() * 6);
      for (let s = 0; s < pitCount; s++) {
        pits.push({
          x: x + 6 * scale + rand() * Math.max(4, w - 12 * scale),
          y: y + 6 * scale + rand() * Math.max(4, h - 12 * scale),
          rx: (1.0 + rand() * 3.4) * scale,
          ry: (0.8 + rand() * 2.4) * scale,
          rot: rand() * Math.PI,
          bright: rand() > 0.68,
          depth: Math.round(28 + rand() * 66)
        });
      }

      // Branching jagged micro-cracks on ~54% of slabs
      const crackPaths = [];
      if (rand() < 0.54) {
        const horiz = rand() < 0.42;
        let px = horiz ? x + 2 * scale : x + w * (0.18 + rand() * 0.64);
        let py = horiz ? y + h * (0.2 + rand() * 0.6) : y + 2 * scale;
        const mainPts = [[px, py]];
        const segs = 4 + Math.floor(rand() * 3);
        for (let k = 1; k <= segs; k++) {
          if (horiz) {
            px += (w / segs) * (0.82 + rand() * 0.36);
            py += (rand() - 0.5) * 16 * scale;
          } else {
            px += (rand() - 0.5) * 18 * scale;
            py += (h / segs) * (0.82 + rand() * 0.36);
          }
          mainPts.push([px, py]);
        }
        crackPaths.push({ pts: mainPts, lw: (1.4 + rand() * 0.65) * scale, depth: 16 });

        if (rand() < 0.74) {
          const bStart = mainPts[1 + Math.floor(rand() * Math.max(1, mainPts.length - 2))];
          let bx = bStart[0];
          let by = bStart[1];
          const bAng = rand() * Math.PI * 2;
          const bPts = [[bx, by]];
          for (let bk = 0; bk < 3; bk++) {
            const step = (7 + rand() * 11) * scale;
            bx += Math.cos(bAng + (rand() - 0.5) * 0.85) * step;
            by += Math.sin(bAng + (rand() - 0.5) * 0.85) * step;
            bPts.push([bx, by]);
          }
          crackPaths.push({ pts: bPts, lw: 0.95 * scale, depth: 32 });
        }
      }

      const hasVein = rand() < 0.45;
      const veinPts = hasVein ? [
        [x + rand() * w * 0.25, y + rand() * h],
        [x + w * (0.4 + rand() * 0.2), y + rand() * h],
        [x + w * (0.75 + rand() * 0.25), y + rand() * h]
      ] : null;

      const pad = 12 * scale;
      const minX = x - pad;
      const minY = y - pad;
      const maxX = x + w + pad;
      const maxY = y + h + pad;

      // Albedo pass
      drawWrappedFast(ctx, size, size, minX, minY, maxX, maxY, () => {
        ctx.save();
        tracePolyPath(ctx, pts);
        ctx.strokeStyle = 'rgba(4, 5, 9, 0.80)';
        ctx.lineWidth = 6.8 * scale;
        ctx.lineJoin = 'round';
        ctx.stroke();

        ctx.strokeStyle = `rgb(${Math.max(12, red - 24)}, ${Math.max(13, grn - 24)}, ${Math.max(16, blu - 22)})`;
        ctx.lineWidth = 3.2 * scale;
        ctx.stroke();

        const gx0 = cx - Math.cos(gradAngle) * rad;
        const gy0 = cy - Math.sin(gradAngle) * rad;
        const gx1 = cx + Math.cos(gradAngle) * rad;
        const gy1 = cy + Math.sin(gradAngle) * rad;
        const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        grad.addColorStop(0.0, `rgb(${Math.min(255, red + 16)}, ${Math.min(255, grn + 15)}, ${Math.min(255, blu + 18)})`);
        grad.addColorStop(0.55, `rgb(${red}, ${grn}, ${blu})`);
        grad.addColorStop(1.0, `rgb(${Math.max(14, red - 15)}, ${Math.max(14, grn - 14)}, ${Math.max(18, blu - 12)})`);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.clip();

        const crown = ctx.createRadialGradient(cx, cy, 2 * scale, cx, cy, rad * 0.95);
        crown.addColorStop(0.0, 'rgba(218, 226, 248, 0.09)');
        crown.addColorStop(0.7, 'rgba(180, 190, 212, 0.02)');
        crown.addColorStop(1.0, 'rgba(6, 8, 13, 0.25)');
        ctx.fillStyle = crown;
        ctx.fillRect(x - 4 * scale, y - 4 * scale, w + 8 * scale, h + 8 * scale);

        if (veinPts) {
          ctx.strokeStyle = 'rgba(195, 206, 228, 0.075)';
          ctx.lineWidth = 1.6 * scale;
          ctx.beginPath();
          ctx.moveTo(veinPts[0][0], veinPts[0][1]);
          ctx.quadraticCurveTo(veinPts[1][0], veinPts[1][1], veinPts[2][0], veinPts[2][1]);
          ctx.stroke();
        }

        for (let s = 0; s < pits.length; s++) {
          const p = pits[s];
          ctx.fillStyle = p.bright ? 'rgba(216, 224, 244, 0.08)' : 'rgba(8, 10, 16, 0.24)';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let ci = 0; ci < chips.length; ci++) {
          const ch = chips[ci];
          const cg = ctx.createRadialGradient(ch.x, ch.y, 0.5 * scale, ch.x, ch.y, ch.r * 1.4);
          cg.addColorStop(0.0, 'rgba(176, 186, 208, 0.28)');
          cg.addColorStop(0.55, 'rgba(26, 30, 40, 0.22)');
          cg.addColorStop(1.0, 'rgba(12, 14, 20, 0.0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(ch.x, ch.y, ch.r * 1.4, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let cp = 0; cp < crackPaths.length; cp++) {
          const cObj = crackPaths[cp];
          const cpts = cObj.pts;
          ctx.strokeStyle = 'rgba(196, 208, 232, 0.14)';
          ctx.lineWidth = Math.max(1, cObj.lw * 0.9);
          ctx.beginPath();
          ctx.moveTo(cpts[0][0] + 1.0 * scale, cpts[0][1] + 0.8 * scale);
          for (let i = 1; i < cpts.length; i++) ctx.lineTo(cpts[i][0] + 1.0 * scale, cpts[i][1] + 0.8 * scale);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(6, 7, 12, 0.82)';
          ctx.lineWidth = Math.max(1, cObj.lw);
          ctx.beginPath();
          ctx.moveTo(cpts[0][0], cpts[0][1]);
          for (let i = 1; i < cpts.length; i++) ctx.lineTo(cpts[i][0], cpts[i][1]);
          ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(218, 228, 252, 0.19)';
        ctx.lineWidth = Math.max(1, 1.8 * scale);
        ctx.beginPath();
        ctx.moveTo(pts[9][0], pts[9][1]);
        ctx.lineTo(pts[11][0], pts[11][1]);
        ctx.lineTo(pts[0][0], pts[0][1]);
        ctx.lineTo(pts[2][0], pts[2][1]);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(5, 6, 11, 0.64)';
        ctx.lineWidth = Math.max(1.2, 2.4 * scale);
        ctx.beginPath();
        ctx.moveTo(pts[3][0], pts[3][1]);
        ctx.lineTo(pts[5][0], pts[5][1]);
        ctx.lineTo(pts[6][0], pts[6][1]);
        ctx.lineTo(pts[8][0], pts[8][1]);
        ctx.stroke();

        ctx.restore();
      });

      // Heightfield pass
      drawWrappedFast(hctx, size, size, minX, minY, maxX, maxY, () => {
        hctx.save();
        tracePolyPath(hctx, pts);

        const hx0 = cx - Math.cos(tiltDir) * rad;
        const hy0 = cy - Math.sin(tiltDir) * rad;
        const hx1 = cx + Math.cos(tiltDir) * rad;
        const hy1 = cy + Math.sin(tiltDir) * rad;
        const hHi = Math.min(248, faceH + tiltSpan);
        const hLo = Math.max(125, faceH - tiltSpan);
        const hGrad = hctx.createLinearGradient(hx0, hy0, hx1, hy1);
        hGrad.addColorStop(0, `rgb(${hHi},${hHi},${hHi})`);
        hGrad.addColorStop(1, `rgb(${hLo},${hLo},${hLo})`);
        hctx.fillStyle = hGrad;
        hctx.fill();

        hctx.lineJoin = 'round';
        hctx.strokeStyle = 'rgb(60, 60, 60)';
        hctx.lineWidth = Math.max(2.5, 6.4 * scale);
        hctx.stroke();

        hctx.clip();

        hctx.strokeStyle = `rgb(${Math.round(faceH * 0.56)},${Math.round(faceH * 0.56)},${Math.round(faceH * 0.56)})`;
        hctx.lineWidth = Math.max(1.8, 3.6 * scale);
        hctx.stroke();

        for (let ci = 0; ci < chips.length; ci++) {
          const ch = chips[ci];
          const cg = hctx.createRadialGradient(ch.x, ch.y, 0.5 * scale, ch.x, ch.y, ch.r * 1.35);
          cg.addColorStop(0.0, 'rgba(32, 32, 32, 0.88)');
          cg.addColorStop(0.65, 'rgba(90, 90, 90, 0.45)');
          cg.addColorStop(1.0, 'rgba(150, 150, 150, 0.0)');
          hctx.fillStyle = cg;
          hctx.beginPath();
          hctx.arc(ch.x, ch.y, ch.r * 1.35, 0, Math.PI * 2);
          hctx.fill();
        }

        for (let s = 0; s < pits.length; s++) {
          const p = pits[s];
          hctx.fillStyle = `rgba(${p.depth},${p.depth},${p.depth},0.52)`;
          hctx.beginPath();
          hctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
          hctx.fill();
        }

        for (let cp = 0; cp < crackPaths.length; cp++) {
          const cObj = crackPaths[cp];
          const cpts = cObj.pts;
          const dVal = cObj.depth;
          hctx.strokeStyle = `rgb(${dVal},${dVal},${dVal})`;
          hctx.lineWidth = Math.max(1.2, cObj.lw * 1.48);
          hctx.lineCap = 'round';
          hctx.beginPath();
          hctx.moveTo(cpts[0][0], cpts[0][1]);
          for (let i = 1; i < cpts.length; i++) hctx.lineTo(cpts[i][0], cpts[i][1]);
          hctx.stroke();
        }

        hctx.restore();
      });
    }
  }

  // Fast LUT-accelerated pixel pass: granite micro-grain, crevice moss, physically darkened wet
  // puddles & crisp full-range roughness (0.32 wet/polished -> 0.94 rough fracture/mortar/moss)!
  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;

  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);

  const noiseWet  = createTileableNoiseGrid(16, 9103);
  const noiseMid  = createTileableNoiseGrid(32, 9101);
  const noiseFine = createTileableNoiseGrid(64, 9102);

  const lutWet  = buildNoiseAxisLUT(noiseWet, size, 2);
  const lutMoss = buildNoiseAxisLUT(noiseMid, size, 4);
  const lutGrA  = buildNoiseAxisLUT(noiseMid, size, 6);
  const lutGrB  = buildNoiseAxisLUT(noiseFine, size, 10);

  const gWet  = noiseWet.grid;
  const gMid  = noiseMid.grid;
  const gFine = noiseFine.grid;

  const invSize = 1 / size;
  const sWetY  = 2 * noiseWet.size * invSize;
  const sMossY = 4 * noiseMid.size * invSize;
  const sGrAY  = 6 * noiseMid.size * invSize;
  const sGrBY  = 10 * noiseFine.size * invSize;

  const wX0 = lutWet.x0,  wX1 = lutWet.x1,  wSx = lutWet.sx;
  const mX0 = lutMoss.x0, mX1 = lutMoss.x1, mSx = lutMoss.sx;
  const aX0 = lutGrA.x0,  aX1 = lutGrA.x1,  aSx = lutGrA.sx;
  const bX0 = lutGrB.x0,  bX1 = lutGrB.x1,  bSx = lutGrB.sx;

  for (let y = 0; y < size; y++) {
    const y0 = y * size;
    const rw = sampleRowParams(noiseWet, y * sWetY);
    const rm = sampleRowParams(noiseMid, y * sMossY);
    const ra = sampleRowParams(noiseMid, y * sGrAY);
    const rb = sampleRowParams(noiseFine, y * sGrBY);

    const wR0 = rw.r0, wR1 = rw.r1, wSy = rw.sy;
    const mR0 = rm.r0, mR1 = rm.r1, mSy = rm.sy;
    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;

    for (let x = 0; x < size; x++) {
      const idx = y0 + x;
      const p4 = idx * 4;
      const baseH = hPix[p4] * (1 / 255);

      // Inlined bilinear noise samples using precomputed axis LUTs
      let ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const nA0 = gMid[aR0 + ax0] + (gMid[aR0 + ax1] - gMid[aR0 + ax0]) * asx;
      const nA1 = gMid[aR1 + ax0] + (gMid[aR1 + ax1] - gMid[aR1 + ax0]) * asx;
      const nA = nA0 + (nA1 - nA0) * aSy;

      let bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const nB0 = gFine[bR0 + bx0] + (gFine[bR0 + bx1] - gFine[bR0 + bx0]) * bsx;
      const nB1 = gFine[bR1 + bx0] + (gFine[bR1 + bx1] - gFine[bR1 + bx0]) * bsx;
      const nB = nB0 + (nB1 - nB0) * bSy;

      const grain = (nA * 0.62 + nB * 0.38) - 0.5;
      heightData[idx] = clamp01(baseH + grain * (baseH > 0.30 ? 0.145 : 0.085));

      let wx0 = wX0[x], wx1 = wX1[x], wsx = wSx[x];
      const nW0 = gWet[wR0 + wx0] + (gWet[wR0 + wx1] - gWet[wR0 + wx0]) * wsx;
      const nW1 = gWet[wR1 + wx0] + (gWet[wR1 + wx1] - gWet[wR1 + wx0]) * wsx;
      const wetMacro = nW0 + (nW1 - nW0) * wSy;

      let mx0 = mX0[x], mx1 = mX1[x], msx = mSx[x];
      const nM0 = gMid[mR0 + mx0] + (gMid[mR0 + mx1] - gMid[mR0 + mx0]) * msx;
      const nM1 = gMid[mR1 + mx0] + (gMid[mR1 + mx1] - gMid[mR1 + mx0]) * msx;
      const nM = nM0 + (nM1 - nM0) * mSy;

      // Distinct wet puddle / damp footpath sheen (reaches true 0.32 in glistening wet pockets!)
      const wetField = wetMacro * 0.68 + nM * 0.32;
      const wetness = clamp01((wetField - 0.45) * 3.6);
      const wetSmooth = wetness * wetness * (3 - 2 * wetness);

      // Damp emerald moss nestled inside deep mortar joints & chipped lips
      const mortarMask = clamp01((0.48 - baseH) * 2.8);
      const mossAmount = mortarMask * clamp01((nM * 0.65 + nB * 0.35 - 0.32) * 2.6);

      let r = aPix[p4] * (1.0 + grain * 0.24);
      let g = aPix[p4 + 1] * (1.0 + grain * 0.24);
      let b = aPix[p4 + 2] * (1.0 + grain * 0.24);

      if (mossAmount > 0.01) {
        const m = mossAmount * 0.78;
        r = r + (36 + nB * 18 - r) * m;
        g = g + (62 + nB * 26 - g) * m;
        b = b + (26 + nB * 12 - b) * m;
      }

      // Physical wet-stone darkening so specular wet patches read authentically
      if (wetSmooth > 0.01 && baseH > 0.24) {
        const df = 1.0 - wetSmooth * 0.25;
        r *= df;
        g *= df;
        b *= df * 1.04;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      let rough;
      if (baseH < 0.30) {
        rough = 0.90 + (1.0 - baseH * 3.3) * 0.04 + grain * 0.04;
      } else {
        const polish = clamp01((baseH - 0.54) * 2.2);
        const dryStone = 0.80 - polish * 0.22 + grain * 0.14;
        const wetStone = 0.32 + (1.0 - polish) * 0.06 + grain * 0.04;
        rough = dryStone + (wetStone - dryStone) * wetSmooth;
        if (mossAmount > 0.01) {
          rough = rough + (0.94 - rough) * (mossAmount * 0.88);
        }
      }
      roughData[idx] = rough < 0.32 ? 0.32 : rough > 0.94 ? 0.94 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: true, anisotropy });
  const normal = buildNormalMapFromHeight(heightData, size, size, 1.50, 1.44, anisotropy, true);
  const roughness = buildRoughnessMapFromField(roughData, size, size, anisotropy, true);

  return { albedo, normal, roughness };
}

// ============================================================================
// 2. Carved Gothic Ashlar Stone PBR Set (1024px PC / 512px Mobile)
//    Used by Walls, Pillars, Arches, Trims & Dais (tinted 0x5c6274..0x8991a7).
// ============================================================================
function createAshlarPbrSet(size, anisotropy) {
  const albedoCanvas = createCanvas2D(size, size);
  const heightCanvas = createCanvas2D(size, size);
  if (!albedoCanvas || !heightCanvas) {
    return {
      albedo: createFallbackTexture(136, 140, 152, 255, true, THREE.RepeatWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.RepeatWrapping, anisotropy),
      roughness: createFallbackTexture(208, 208, 208, 255, false, THREE.RepeatWrapping, anisotropy)
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const hctx = getFastCtx2D(heightCanvas, true);
  const scale = size / 512;
  const rand = makeRng(268811);

  ctx.fillStyle = '#1b1e27';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#121212';
  hctx.fillRect(0, 0, size, size);

  const courses = 8;
  const ch = size / courses;
  const blockCounts = [4, 5, 4, 5, 4, 5, 4, 5];

  for (let r = 0; r < courses; r++) {
    const blocks = blockCounts[r];
    const off = ((r % 2) * 0.48 + (r * 0.13)) % 1 * size;

    const weights = new Float32Array(blocks);
    let wSum = 0;
    for (let c = 0; c < blocks; c++) {
      weights[c] = 0.76 + rand() * 0.48;
      wSum += weights[c];
    }

    let cursorX = off;
    for (let c = 0; c < blocks; c++) {
      const cellW = (weights[c] / wSum) * size;
      const joint = 2.6 * scale;
      const x = cursorX + joint;
      const y = r * ch + joint;
      const w = cellW - joint * 2;
      const h = ch - joint * 2;
      cursorX += cellW;

      const lum = 136 + Math.floor((rand() - 0.5) * 38);
      const warmCool = Math.floor((rand() - 0.42) * 16);
      const faceH = Math.round(176 + rand() * 58);

      const cornerCut = 2.6 * scale;
      const pts = [
        [x + cornerCut, y],
        [x + w - cornerCut, y],
        [x + w, y + cornerCut],
        [x + w, y + h - cornerCut],
        [x + w - cornerCut, y + h],
        [x + cornerCut, y + h],
        [x, y + h - cornerCut],
        [x, y + cornerCut]
      ];

      const chips = [];
      if (rand() < 0.38) {
        const edge = Math.floor(rand() * 4);
        const t = 0.2 + rand() * 0.6;
        const cx = edge === 0 || edge === 2 ? x + w * t : (edge === 1 ? x + w : x);
        const cy = edge === 1 || edge === 3 ? y + h * t : (edge === 0 ? y : y + h);
        chips.push({ x: cx, y: cy, r: (3.2 + rand() * 4.8) * scale });
      }

      const chisels = [];
      const chiselCount = 6 + Math.floor(rand() * 5);
      const slant = (rand() - 0.5) * 4.5 * scale;
      for (let t = 0; t < chiselCount; t++) {
        chisels.push({
          x: x + 4 * scale + rand() * Math.max(4, w - 8 * scale),
          y: y + 3 * scale + rand() * Math.max(4, h * 0.52),
          len: (8 + rand() * 18) * scale,
          dx: slant + (rand() - 0.5) * 1.4 * scale,
          light: rand() > 0.52
        });
      }

      let crackPts = null;
      if (rand() < 0.34) {
        let kx = x + w * (0.2 + rand() * 0.6);
        let ky = y + 1.5 * scale;
        crackPts = [[kx, ky]];
        for (let s = 0; s < 3; s++) {
          kx += (rand() - 0.5) * 12 * scale;
          ky += h * 0.28;
          crackPts.push([kx, ky]);
        }
      }

      const pad = 8 * scale;
      const minX = x - pad;
      const minY = y - pad;
      const maxX = x + w + pad;
      const maxY = y + h + pad;

      drawWrappedFast(ctx, size, size, minX, minY, maxX, maxY, () => {
        ctx.save();
        tracePolyPath(ctx, pts);

        ctx.strokeStyle = 'rgba(8, 10, 16, 0.72)';
        ctx.lineWidth = 5.2 * scale;
        ctx.lineJoin = 'round';
        ctx.stroke();

        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0.0, `rgb(${Math.min(240, lum + 14)}, ${Math.min(242, lum + 15)}, ${Math.min(248, lum + 20 + warmCool)})`);
        grad.addColorStop(0.5, `rgb(${lum}, ${lum + 2}, ${lum + 8 + warmCool})`);
        grad.addColorStop(1.0, `rgb(${Math.max(58, lum - 20)}, ${Math.max(60, lum - 18)}, ${Math.max(66, lum - 12 + warmCool)})`);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.clip();

        ctx.strokeStyle = 'rgba(242, 246, 255, 0.22)';
        ctx.lineWidth = Math.max(1.2, 2.2 * scale);
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(x, y + cornerCut);
        ctx.lineTo(x + cornerCut, y);
        ctx.lineTo(x + w - cornerCut, y);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(12, 14, 22, 0.44)';
        ctx.lineWidth = Math.max(1.2, 2.4 * scale);
        ctx.beginPath();
        ctx.moveTo(x + w, y + cornerCut);
        ctx.lineTo(x + w, y + h - cornerCut);
        ctx.lineTo(x + w - cornerCut, y + h);
        ctx.lineTo(x + cornerCut, y + h);
        ctx.stroke();

        for (let t = 0; t < chisels.length; t++) {
          const chMark = chisels[t];
          ctx.strokeStyle = chMark.light ? 'rgba(245, 248, 255, 0.085)' : 'rgba(14, 17, 25, 0.16)';
          ctx.lineWidth = Math.max(0.9, 1.15 * scale);
          ctx.beginPath();
          ctx.moveTo(chMark.x, chMark.y);
          ctx.lineTo(chMark.x + chMark.dx, chMark.y + chMark.len);
          ctx.stroke();
        }

        for (let ci = 0; ci < chips.length; ci++) {
          const cp = chips[ci];
          const cg = ctx.createRadialGradient(cp.x, cp.y, 0.6 * scale, cp.x, cp.y, cp.r * 1.45);
          cg.addColorStop(0.0, 'rgba(24, 27, 36, 0.72)');
          cg.addColorStop(0.55, 'rgba(198, 204, 218, 0.18)');
          cg.addColorStop(1.0, 'rgba(120, 126, 140, 0.0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, cp.r * 1.45, 0, Math.PI * 2);
          ctx.fill();
        }

        if (crackPts) {
          ctx.strokeStyle = 'rgba(235, 240, 252, 0.12)';
          ctx.lineWidth = Math.max(0.9, 1.1 * scale);
          ctx.beginPath();
          ctx.moveTo(crackPts[0][0] + 1.0 * scale, crackPts[0][1] + 0.8 * scale);
          for (let i = 1; i < crackPts.length; i++) ctx.lineTo(crackPts[i][0] + 1.0 * scale, crackPts[i][1] + 0.8 * scale);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(10, 12, 18, 0.70)';
          ctx.lineWidth = Math.max(1.0, 1.4 * scale);
          ctx.beginPath();
          ctx.moveTo(crackPts[0][0], crackPts[0][1]);
          for (let i = 1; i < crackPts.length; i++) ctx.lineTo(crackPts[i][0], crackPts[i][1]);
          ctx.stroke();
        }

        ctx.restore();
      });

      drawWrappedFast(hctx, size, size, minX, minY, maxX, maxY, () => {
        hctx.save();
        tracePolyPath(hctx, pts);

        const hGrad = hctx.createLinearGradient(x, y, x, y + h);
        hGrad.addColorStop(0.0, `rgb(${Math.min(250, faceH + 10)},${Math.min(250, faceH + 10)},${Math.min(250, faceH + 10)})`);
        hGrad.addColorStop(1.0, `rgb(${Math.max(130, faceH - 12)},${Math.max(130, faceH - 12)},${Math.max(130, faceH - 12)})`);
        hctx.fillStyle = hGrad;
        hctx.fill();

        hctx.lineJoin = 'round';
        hctx.strokeStyle = 'rgb(68, 68, 68)';
        hctx.lineWidth = Math.max(2.2, 5.2 * scale);
        hctx.stroke();

        hctx.clip();

        hctx.strokeStyle = `rgb(${Math.round(faceH * 0.62)},${Math.round(faceH * 0.62)},${Math.round(faceH * 0.62)})`;
        hctx.lineWidth = Math.max(1.5, 2.8 * scale);
        hctx.stroke();

        for (let t = 0; t < chisels.length; t++) {
          const chMark = chisels[t];
          hctx.strokeStyle = chMark.light ? 'rgba(240, 240, 240, 0.22)' : 'rgba(95, 95, 95, 0.34)';
          hctx.lineWidth = Math.max(1.0, 1.3 * scale);
          hctx.beginPath();
          hctx.moveTo(chMark.x, chMark.y);
          hctx.lineTo(chMark.x + chMark.dx, chMark.y + chMark.len);
          hctx.stroke();
        }

        for (let ci = 0; ci < chips.length; ci++) {
          const cp = chips[ci];
          const cg = hctx.createRadialGradient(cp.x, cp.y, 0.5 * scale, cp.x, cp.y, cp.r * 1.4);
          cg.addColorStop(0.0, 'rgba(30, 30, 30, 0.90)');
          cg.addColorStop(0.6, 'rgba(105, 105, 105, 0.45)');
          cg.addColorStop(1.0, 'rgba(165, 165, 165, 0.0)');
          hctx.fillStyle = cg;
          hctx.beginPath();
          hctx.arc(cp.x, cp.y, cp.r * 1.4, 0, Math.PI * 2);
          hctx.fill();
        }

        if (crackPts) {
          hctx.strokeStyle = 'rgb(28, 28, 28)';
          hctx.lineWidth = Math.max(1.2, 2.1 * scale);
          hctx.beginPath();
          hctx.moveTo(crackPts[0][0], crackPts[0][1]);
          for (let i = 1; i < crackPts.length; i++) hctx.lineTo(crackPts[i][0], crackPts[i][1]);
          hctx.stroke();
        }

        hctx.restore();
      });
    }
  }

  // Seamless vertical rain-runoff & soot weathering streaks
  for (let i = 0; i < 24; i++) {
    const sx = rand() * size;
    const sw = (7 + rand() * 19) * scale;
    const alphaTop = 0.14 + rand() * 0.14;
    const alphaMid = 0.03 + rand() * 0.05;
    drawWrappedFast(ctx, size, size, sx - sw, 0, sx + sw, size, () => {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0.0, `rgba(18, 20, 28, ${alphaTop.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(22, 25, 34, ${alphaMid.toFixed(3)})`);
      g.addColorStop(1.0, `rgba(18, 20, 28, ${alphaTop.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(sx, 0, sw, size);
    });
  }

  // LUT-accelerated pixel pass
  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;

  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);

  const noiseSeep = createTileableNoiseGrid(16, 8203);
  const noiseA    = createTileableNoiseGrid(32, 8201);
  const noiseB    = createTileableNoiseGrid(64, 8202);

  const lutSeep = buildNoiseAxisLUT(noiseSeep, size, 4);
  const lutGrA  = buildNoiseAxisLUT(noiseA, size, 6);
  const lutGrB  = buildNoiseAxisLUT(noiseB, size, 10);

  const gSeep = noiseSeep.grid;
  const gA    = noiseA.grid;
  const gB    = noiseB.grid;

  const invSize = 1 / size;
  const sSeepY = 1 * noiseSeep.size * invSize;
  const sGrAY  = 6 * noiseA.size * invSize;
  const sGrBY  = 10 * noiseB.size * invSize;

  const sX0 = lutSeep.x0, sX1 = lutSeep.x1, sSx = lutSeep.sx;
  const aX0 = lutGrA.x0,  aX1 = lutGrA.x1,  aSx = lutGrA.sx;
  const bX0 = lutGrB.x0,  bX1 = lutGrB.x1,  bSx = lutGrB.sx;

  for (let y = 0; y < size; y++) {
    const y0 = y * size;
    const rs = sampleRowParams(noiseSeep, y * sSeepY);
    const ra = sampleRowParams(noiseA, y * sGrAY);
    const rb = sampleRowParams(noiseB, y * sGrBY);

    const sR0 = rs.r0, sR1 = rs.r1, sSy = rs.sy;
    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;

    for (let x = 0; x < size; x++) {
      const idx = y0 + x;
      const p4 = idx * 4;
      const baseH = hPix[p4] * (1 / 255);

      let ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const nA0 = gA[aR0 + ax0] + (gA[aR0 + ax1] - gA[aR0 + ax0]) * asx;
      const nA1 = gA[aR1 + ax0] + (gA[aR1 + ax1] - gA[aR1 + ax0]) * asx;
      const nA = nA0 + (nA1 - nA0) * aSy;

      let bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const nB0 = gB[bR0 + bx0] + (gB[bR0 + bx1] - gB[bR0 + bx0]) * bsx;
      const nB1 = gB[bR1 + bx0] + (gB[bR1 + bx1] - gB[bR1 + bx0]) * bsx;
      const nB = nB0 + (nB1 - nB0) * bSy;

      let sx0 = sX0[x], sx1 = sX1[x], ssx = sSx[x];
      const nS0 = gSeep[sR0 + sx0] + (gSeep[sR0 + sx1] - gSeep[sR0 + sx0]) * ssx;
      const nS1 = gSeep[sR1 + sx0] + (gSeep[sR1 + sx1] - gSeep[sR1 + sx0]) * ssx;
      const seepN = nS0 + (nS1 - nS0) * sSy;

      const grain = (nA * 0.60 + nB * 0.40) - 0.5;
      heightData[idx] = clamp01(baseH + grain * (baseH > 0.32 ? 0.15 : 0.09));

      const seep = clamp01((seepN - 0.50) * 2.8);
      const mortarMask = clamp01((0.42 - baseH) * 2.9);
      const moss = mortarMask * clamp01((nA - 0.42) * 2.4);

      let r = aPix[p4] * (1.0 + grain * 0.20);
      let g = aPix[p4 + 1] * (1.0 + grain * 0.20);
      let b = aPix[p4 + 2] * (1.0 + grain * 0.20);

      if (moss > 0.01) {
        const m = moss * 0.58;
        r = r + (54 + nB * 18 - r) * m;
        g = g + (84 + nB * 24 - g) * m;
        b = b + (44 + nB * 14 - b) * m;
      }

      if (seep > 0.01 && baseH > 0.28) {
        const df = 1.0 - seep * 0.18;
        r *= df;
        g *= df;
        b *= df;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      let rough;
      if (baseH < 0.30) {
        rough = 0.90 + grain * 0.05;
      } else {
        const wear = clamp01((baseH - 0.60) * 2.2);
        const dryR = 0.84 - wear * 0.16 + grain * 0.13;
        const dampR = 0.38 + (1.0 - wear) * 0.11 + grain * 0.05;
        rough = dryR + (dampR - dryR) * (seep * 0.82);
        if (moss > 0.01) rough = rough + (0.94 - rough) * (moss * 0.85);
      }
      roughData[idx] = rough < 0.36 ? 0.36 : rough > 0.94 ? 0.94 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: true, anisotropy });
  const normal = buildNormalMapFromHeight(heightData, size, size, 1.38, 1.30, anisotropy, true);
  const roughness = buildRoughnessMapFromField(roughData, size, size, anisotropy, true);

  return { albedo, normal, roughness };
}

// ============================================================================
// 3. Dark Soot-Stained Cathedral Vault Stone (1024px PC / 512px Mobile)
//    Exported as vaultStoneAlbedo + vaultStoneNormal for overhead arches/roofs.
// ============================================================================
function createVaultStonePbrSet(size, anisotropy) {
  const albedoCanvas = createCanvas2D(size, size);
  const heightCanvas = createCanvas2D(size, size);
  if (!albedoCanvas || !heightCanvas) {
    return {
      albedo: createFallbackTexture(84, 86, 98, 255, true, THREE.RepeatWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.RepeatWrapping, anisotropy)
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const hctx = getFastCtx2D(heightCanvas, true);
  const scale = size / 512;
  const rand = makeRng(264499);

  ctx.fillStyle = '#0d0e13';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#0e0e0e';
  hctx.fillRect(0, 0, size, size);

  const courses = 10;
  const ch = size / courses;

  for (let r = 0; r < courses; r++) {
    const isRibCourse = (r === 0 || r === 5);
    const blocks = isRibCourse ? 4 : (r % 2 === 0 ? 5 : 6);
    const off = ((r * 0.37 + (r % 2) * 0.25) % 1) * size;

    const weights = new Float32Array(blocks);
    let wSum = 0;
    for (let c = 0; c < blocks; c++) {
      weights[c] = isRibCourse ? (0.92 + rand() * 0.16) : (0.72 + rand() * 0.56);
      wSum += weights[c];
    }

    let cursorX = off;
    for (let c = 0; c < blocks; c++) {
      const cellW = (weights[c] / wSum) * size;
      const joint = (isRibCourse ? 2.8 : 2.3) * scale;
      const x = cursorX + joint;
      const y = r * ch + joint;
      const w = cellW - joint * 2;
      const h = ch - joint * 2;
      cursorX += cellW;

      const baseLum = (isRibCourse ? 104 : 88) + Math.floor((rand() - 0.5) * 28);
      const sootWarm = Math.floor((rand() - 0.5) * 10);
      const faceH = Math.round((isRibCourse ? 212 : 168) + rand() * 38);

      const cornerCut = 2.0 * scale;
      const pts = [
        [x + cornerCut, y],
        [x + w - cornerCut, y],
        [x + w, y + cornerCut],
        [x + w, y + h - cornerCut],
        [x + w - cornerCut, y + h],
        [x + cornerCut, y + h],
        [x, y + h - cornerCut],
        [x, y + cornerCut]
      ];

      let crackPts = null;
      if (!isRibCourse && rand() < 0.28) {
        let kx = x + w * (0.2 + rand() * 0.6);
        let ky = y + 1.5 * scale;
        crackPts = [[kx, ky], [kx + (rand() - 0.5) * 10 * scale, ky + h * 0.45], [kx + (rand() - 0.5) * 14 * scale, ky + h * 0.88]];
      }

      const pad = 7 * scale;
      const minX = x - pad;
      const minY = y - pad;
      const maxX = x + w + pad;
      const maxY = y + h + pad;

      drawWrappedFast(ctx, size, size, minX, minY, maxX, maxY, () => {
        ctx.save();
        tracePolyPath(ctx, pts);

        ctx.strokeStyle = 'rgba(5, 6, 9, 0.84)';
        ctx.lineWidth = 5.4 * scale;
        ctx.lineJoin = 'round';
        ctx.stroke();

        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0.0, `rgb(${baseLum + 10}, ${baseLum + 10}, ${baseLum + 16 + sootWarm})`);
        grad.addColorStop(0.55, `rgb(${baseLum - 2}, ${baseLum - 2}, ${baseLum + 4 + sootWarm})`);
        grad.addColorStop(1.0, `rgb(${Math.max(30, baseLum - 22)}, ${Math.max(30, baseLum - 21)}, ${Math.max(35, baseLum - 15 + sootWarm)})`);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.clip();

        if (isRibCourse) {
          ctx.strokeStyle = 'rgba(10, 11, 16, 0.52)';
          ctx.lineWidth = 2.0 * scale;
          ctx.beginPath();
          ctx.moveTo(x, y + h * 0.22);
          ctx.lineTo(x + w, y + h * 0.22);
          ctx.moveTo(x, y + h * 0.78);
          ctx.lineTo(x + w, y + h * 0.78);
          ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(182, 186, 206, 0.14)';
        ctx.lineWidth = Math.max(1.0, 1.6 * scale);
        ctx.beginPath();
        ctx.moveTo(x + cornerCut, y + h);
        ctx.lineTo(x + w - cornerCut, y + h);
        ctx.stroke();

        if (crackPts) {
          ctx.strokeStyle = 'rgba(6, 7, 10, 0.76)';
          ctx.lineWidth = Math.max(1.0, 1.3 * scale);
          ctx.beginPath();
          ctx.moveTo(crackPts[0][0], crackPts[0][1]);
          ctx.lineTo(crackPts[1][0], crackPts[1][1]);
          ctx.lineTo(crackPts[2][0], crackPts[2][1]);
          ctx.stroke();
        }

        ctx.restore();
      });

      drawWrappedFast(hctx, size, size, minX, minY, maxX, maxY, () => {
        hctx.save();
        tracePolyPath(hctx, pts);
        hctx.fillStyle = `rgb(${faceH},${faceH},${faceH})`;
        hctx.fill();

        hctx.lineJoin = 'round';
        hctx.strokeStyle = 'rgb(52, 52, 52)';
        hctx.lineWidth = Math.max(2.2, 5.0 * scale);
        hctx.stroke();

        hctx.clip();

        if (isRibCourse) {
          hctx.strokeStyle = 'rgb(112, 112, 112)';
          hctx.lineWidth = Math.max(1.6, 2.8 * scale);
          hctx.beginPath();
          hctx.moveTo(x, y + h * 0.22);
          hctx.lineTo(x + w, y + h * 0.22);
          hctx.moveTo(x, y + h * 0.78);
          hctx.lineTo(x + w, y + h * 0.78);
          hctx.stroke();
        }

        if (crackPts) {
          hctx.strokeStyle = 'rgb(26, 26, 26)';
          hctx.lineWidth = Math.max(1.2, 1.9 * scale);
          hctx.beginPath();
          hctx.moveTo(crackPts[0][0], crackPts[0][1]);
          hctx.lineTo(crackPts[1][0], crackPts[1][1]);
          hctx.lineTo(crackPts[2][0], crackPts[2][1]);
          hctx.stroke();
        }

        hctx.restore();
      });
    }
  }

  // Rising torch-smoke soot plumes
  for (let i = 0; i < 16; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const pr = (32 + rand() * 58) * scale;
    const sootAlpha = 0.20 + rand() * 0.22;
    drawWrappedFast(ctx, size, size, px - pr, py - pr, px + pr, py + pr, () => {
      const g = ctx.createRadialGradient(px, py, 3 * scale, px, py, pr);
      g.addColorStop(0.0, `rgba(10, 9, 12, ${sootAlpha.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(16, 15, 20, ${(sootAlpha * 0.45).toFixed(3)})`);
      g.addColorStop(1.0, 'rgba(16, 15, 20, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // LUT-accelerated pixel pass
  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;

  const total = size * size;
  const heightData = new Float32Array(total);

  const noiseSoot = createTileableNoiseGrid(16, 4401);
  const noiseA    = createTileableNoiseGrid(32, 4402);
  const noiseB    = createTileableNoiseGrid(64, 4403);

  const lutSoot = buildNoiseAxisLUT(noiseSoot, size, 2);
  const lutGrA  = buildNoiseAxisLUT(noiseA, size, 6);
  const lutGrB  = buildNoiseAxisLUT(noiseB, size, 10);

  const gSoot = noiseSoot.grid;
  const gA    = noiseA.grid;
  const gB    = noiseB.grid;

  const invSize = 1 / size;
  const sSootY = 2 * noiseSoot.size * invSize;
  const sGrAY  = 6 * noiseA.size * invSize;
  const sGrBY  = 10 * noiseB.size * invSize;

  const sX0 = lutSoot.x0, sX1 = lutSoot.x1, sSx = lutSoot.sx;
  const aX0 = lutGrA.x0,  aX1 = lutGrA.x1,  aSx = lutGrA.sx;
  const bX0 = lutGrB.x0,  bX1 = lutGrB.x1,  bSx = lutGrB.sx;

  for (let y = 0; y < size; y++) {
    const y0 = y * size;
    const rs = sampleRowParams(noiseSoot, y * sSootY);
    const ra = sampleRowParams(noiseA, y * sGrAY);
    const rb = sampleRowParams(noiseB, y * sGrBY);

    const sR0 = rs.r0, sR1 = rs.r1, sSy = rs.sy;
    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;

    for (let x = 0; x < size; x++) {
      const idx = y0 + x;
      const p4 = idx * 4;
      const baseH = hPix[p4] * (1 / 255);

      let ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const nA0 = gA[aR0 + ax0] + (gA[aR0 + ax1] - gA[aR0 + ax0]) * asx;
      const nA1 = gA[aR1 + ax0] + (gA[aR1 + ax1] - gA[aR1 + ax0]) * asx;
      const nA = nA0 + (nA1 - nA0) * aSy;

      let bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const nB0 = gB[bR0 + bx0] + (gB[bR0 + bx1] - gB[bR0 + bx0]) * bsx;
      const nB1 = gB[bR1 + bx0] + (gB[bR1 + bx1] - gB[bR1 + bx0]) * bsx;
      const nB = nB0 + (nB1 - nB0) * bSy;

      let sx0 = sX0[x], sx1 = sX1[x], ssx = sSx[x];
      const nS0 = gSoot[sR0 + sx0] + (gSoot[sR0 + sx1] - gSoot[sR0 + sx0]) * ssx;
      const nS1 = gSoot[sR1 + sx0] + (gSoot[sR1 + sx1] - gSoot[sR1 + sx0]) * ssx;
      const sootN = nS0 + (nS1 - nS0) * sSy;

      const grain = (nA * 0.60 + nB * 0.40) - 0.5;
      const soot = clamp01((sootN - 0.35) * 1.65);

      heightData[idx] = clamp01(baseH + grain * (baseH > 0.25 ? 0.165 : 0.08));

      const shade = (1.0 + grain * 0.22) * (1.0 - soot * 0.28);
      const r = aPix[p4] * shade;
      const g = aPix[p4 + 1] * shade;
      const b = aPix[p4 + 2] * shade;
      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: true, anisotropy });
  const normal = buildNormalMapFromHeight(heightData, size, size, 1.50, 1.44, anisotropy, true);

  return { albedo, normal };
}

// ============================================================================
// 4. Royal Gothic Tapestry / Velvet Banner PBR Set (512x1024 PC / 256x512 Mobile)
//    Exported as bannerAlbedo + bannerNormal + bannerRoughness.
//    Fine woven tapestry/velvet bump, royal gold gothic heraldry (cross/sword/crown),
//    rich sculpted drapery folds aligned to 4 crossbar rings, scorched frayed hem!
// ============================================================================
function createBannerPbrSet(width, height, anisotropy) {
  const albedoCanvas = createCanvas2D(width, height);
  const embCanvas = createCanvas2D(width, height);
  const scorchCanvas = createCanvas2D(width, height);
  if (!albedoCanvas || !embCanvas || !scorchCanvas) {
    return {
      albedo: createFallbackTexture(92, 16, 28, 255, true, THREE.ClampToEdgeWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.ClampToEdgeWrapping, anisotropy),
      roughness: createFallbackTexture(224, 224, 224, 255, false, THREE.ClampToEdgeWrapping, anisotropy)
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const ectx = getFastCtx2D(embCanvas, true);
  const sctx = getFastCtx2D(scorchCanvas, true);
  const sx = width / 512;
  const sy = height / 1024;
  const rand = makeRng(269044);

  // 1. Opulent Royal Crimson-Burgundy Velvet Ground
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0.00, '#721322');
  bg.addColorStop(0.28, '#5d0e1c');
  bg.addColorStop(0.62, '#460a15');
  bg.addColorStop(0.84, '#2a070e');
  bg.addColorStop(1.00, '#120609');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, width, height);
  sctx.fillStyle = '#000000';
  sctx.fillRect(0, 0, width, height);

  // 2. Subtle Tone-on-Tone Woven Gothic Damask Lattice inside crimson velvet
  ctx.save();
  ctx.strokeStyle = 'rgba(146, 26, 44, 0.22)';
  ctx.lineWidth = 2.0 * sx;
  const dStepX = 48 * sx;
  const dStepY = 64 * sy;
  for (let py = 36 * sy; py < height * 0.86; py += dStepY) {
    for (let px = 36 * sx; px < width - 36 * sx; px += dStepX) {
      ctx.beginPath();
      ctx.moveTo(px, py - 24 * sy);
      ctx.lineTo(px + 18 * sx, py);
      ctx.lineTo(px, py + 24 * sy);
      ctx.lineTo(px - 18 * sx, py);
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = 'rgba(160, 32, 50, 0.17)';
      ctx.beginPath();
      ctx.arc(px, py, 3.2 * sx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Shared vector embroidery renderer (draws rich antique gold into albedo & white height mask into embCanvas)
  const drawRoyalHeraldry = (targetCtx, isMask) => {
    targetCtx.save();

    const goldGrad = isMask
      ? '#ffffff'
      : (() => {
          const g = targetCtx.createLinearGradient(0, 40 * sy, width, height * 0.82);
          g.addColorStop(0.00, '#ecc86c');
          g.addColorStop(0.28, '#ca9c3e');
          g.addColorStop(0.55, '#f4d682');
          g.addColorStop(0.80, '#b7862f');
          g.addColorStop(1.00, '#865d1c');
          return g;
        })();

    const goldDark = isMask ? '#b8b8b8' : '#7b561a';
    const goldBright = isMask ? '#ffffff' : '#f8e19a';
    const steelGold = isMask ? '#e8e8e8' : '#e2d5b5';

    // Top suspension header brocade band
    targetCtx.fillStyle = goldDark;
    targetCtx.fillRect(22 * sx, 16 * sy, width - 44 * sx, 18 * sy);
    targetCtx.fillStyle = goldGrad;
    targetCtx.fillRect(26 * sx, 20 * sy, width - 52 * sx, 10 * sy);

    // Outer double-braided antique gold brocade border
    const borderB = height * 0.84;
    if (!isMask) {
      targetCtx.strokeStyle = 'rgba(14, 3, 6, 0.72)';
      targetCtx.lineWidth = 24 * sx;
      targetCtx.strokeRect(30 * sx, 38 * sy, width - 60 * sx, borderB - 38 * sy);
    }

    targetCtx.strokeStyle = goldGrad;
    targetCtx.lineWidth = 17 * sx;
    targetCtx.strokeRect(30 * sx, 38 * sy, width - 60 * sx, borderB - 38 * sy);

    // Braided bullion diagonal chevron stitches along vertical borders
    targetCtx.strokeStyle = goldDark;
    targetCtx.lineWidth = 2.4 * sx;
    targetCtx.beginPath();
    for (let by = 48 * sy; by < borderB - 10 * sy; by += 14 * sy) {
      targetCtx.moveTo(22 * sx, by);
      targetCtx.lineTo(38 * sx, by + 10 * sy);
      targetCtx.moveTo(width - 38 * sx, by);
      targetCtx.lineTo(width - 22 * sx, by + 10 * sy);
    }
    targetCtx.stroke();

    // Inner gothic pinstripe
    targetCtx.strokeStyle = goldDark;
    targetCtx.lineWidth = 5.0 * sx;
    targetCtx.strokeRect(54 * sx, 60 * sy, width - 108 * sx, borderB - 84 * sy);

    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.0 * sx;
    targetCtx.strokeRect(54 * sx, 60 * sy, width - 108 * sx, borderB - 84 * sy);

    // Corner gothic quatrefoil rosettes
    const corners = [
      [42 * sx, 50 * sy],
      [width - 42 * sx, 50 * sy],
      [42 * sx, borderB - 12 * sy],
      [width - 42 * sx, borderB - 12 * sy]
    ];
    for (let i = 0; i < corners.length; i++) {
      const [cx, cy] = corners[i];
      targetCtx.fillStyle = goldGrad;
      targetCtx.beginPath();
      targetCtx.moveTo(cx, cy - 22 * sy);
      targetCtx.lineTo(cx + 8 * sx, cy - 8 * sy);
      targetCtx.lineTo(cx + 22 * sx, cy);
      targetCtx.lineTo(cx + 8 * sx, cy + 8 * sy);
      targetCtx.lineTo(cx, cy + 22 * sy);
      targetCtx.lineTo(cx - 8 * sx, cy + 8 * sy);
      targetCtx.lineTo(cx - 22 * sx, cy);
      targetCtx.lineTo(cx - 8 * sx, cy - 8 * sy);
      targetCtx.closePath();
      targetCtx.fill();

      if (!isMask) {
        targetCtx.fillStyle = '#4c0b16';
        targetCtx.beginPath();
        targetCtx.arc(cx, cy, 4.5 * sx, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }

    // CENTERPIECE ROYAL GOTHIC HERALDRY: Mandorla Halo + Pattée Cross + Greatsword + Royal Crown
    targetCtx.translate(width * 0.5, height * 0.41);

    // Pointed Gothic Vesica Aureole Frame
    targetCtx.strokeStyle = goldGrad;
    targetCtx.lineWidth = 5.5 * sx;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -238 * sy);
    targetCtx.bezierCurveTo(138 * sx, -135 * sy, 138 * sx, 135 * sy, 0, 248 * sy);
    targetCtx.bezierCurveTo(-138 * sx, 135 * sy, -138 * sx, -135 * sy, 0, -238 * sy);
    targetCtx.closePath();
    targetCtx.stroke();

    targetCtx.strokeStyle = goldDark;
    targetCtx.lineWidth = 2.4 * sx;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -216 * sy);
    targetCtx.bezierCurveTo(114 * sx, -120 * sy, 114 * sx, 120 * sy, 0, 224 * sy);
    targetCtx.bezierCurveTo(-114 * sx, 120 * sy, -114 * sx, -120 * sy, 0, -216 * sy);
    targetCtx.closePath();
    targetCtx.stroke();

    // Radiating Gothic Sunburst Spikes
    targetCtx.strokeStyle = goldGrad;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const innerR = (i % 2 === 0 ? 72 : 84) * sx;
      const outerR = (i % 2 === 0 ? 124 : 104) * sx;
      targetCtx.lineWidth = (i % 2 === 0 ? 3.2 : 1.8) * sx;
      targetCtx.beginPath();
      targetCtx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR * 1.18 - 18 * sy);
      targetCtx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR * 1.18 - 18 * sy);
      targetCtx.stroke();
    }

    // Flared Heraldic Gothic Cross (Cross Pattée) behind Sword Hilt
    const crossY = -36 * sy;
    targetCtx.fillStyle = isMask ? '#dcdcdc' : '#b78831';
    const drawCrossArm = (rot) => {
      targetCtx.save();
      targetCtx.translate(0, crossY);
      targetCtx.rotate(rot);
      targetCtx.beginPath();
      targetCtx.moveTo(-10 * sx, 0);
      targetCtx.lineTo(-30 * sx, -116 * sy);
      targetCtx.lineTo(0, -96 * sy);
      targetCtx.lineTo(30 * sx, -116 * sy);
      targetCtx.lineTo(10 * sx, 0);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.strokeStyle = goldBright;
      targetCtx.lineWidth = 2.2 * sx;
      targetCtx.stroke();
      targetCtx.restore();
    };
    drawCrossArm(0);
    drawCrossArm(Math.PI * 0.5);
    drawCrossArm(Math.PI);
    drawCrossArm(Math.PI * 1.5);

    // Royal Knight Greatsword
    if (!isMask) {
      targetCtx.fillStyle = 'rgba(12, 3, 6, 0.55)';
      targetCtx.beginPath();
      targetCtx.moveTo(5 * sx, 226 * sy);
      targetCtx.lineTo(22 * sx, 168 * sy);
      targetCtx.lineTo(19 * sx, -42 * sy);
      targetCtx.lineTo(-14 * sx, -42 * sy);
      targetCtx.lineTo(-17 * sx, 168 * sy);
      targetCtx.closePath();
      targetCtx.fill();
    }

    targetCtx.fillStyle = steelGold;
    targetCtx.beginPath();
    targetCtx.moveTo(0, 220 * sy);
    targetCtx.lineTo(-17 * sx, 166 * sy);
    targetCtx.lineTo(-15 * sx, -44 * sy);
    targetCtx.lineTo(0, -44 * sy);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.fillStyle = goldGrad;
    targetCtx.beginPath();
    targetCtx.moveTo(0, 220 * sy);
    targetCtx.lineTo(17 * sx, 166 * sy);
    targetCtx.lineTo(15 * sx, -44 * sy);
    targetCtx.lineTo(0, -44 * sy);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.strokeStyle = isMask ? '#969696' : '#5e3d12';
    targetCtx.lineWidth = 3.2 * sx;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -34 * sy);
    targetCtx.lineTo(0, 148 * sy);
    targetCtx.stroke();

    // Swept Gothic Crossguard
    targetCtx.fillStyle = goldGrad;
    targetCtx.beginPath();
    targetCtx.moveTo(-98 * sx, -28 * sy);
    targetCtx.quadraticCurveTo(-56 * sx, -56 * sy, 0, -56 * sy);
    targetCtx.quadraticCurveTo(56 * sx, -56 * sy, 98 * sx, -28 * sy);
    targetCtx.lineTo(84 * sx, -18 * sy);
    targetCtx.quadraticCurveTo(46 * sx, -34 * sy, 0, -34 * sy);
    targetCtx.quadraticCurveTo(-46 * sx, -34 * sy, -84 * sx, -18 * sy);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.0 * sx;
    targetCtx.stroke();

    // Wire-wrapped Grip & Faceted Diamond Pommel
    targetCtx.fillStyle = isMask ? '#cccccc' : '#966b24';
    targetCtx.fillRect(-10 * sx, -124 * sy, 20 * sx, 72 * sy);
    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.2 * sx;
    targetCtx.beginPath();
    for (let gy = -116 * sy; gy <= -62 * sy; gy += 11 * sy) {
      targetCtx.moveTo(-10 * sx, gy);
      targetCtx.lineTo(10 * sx, gy + 5 * sy);
    }
    targetCtx.stroke();

    targetCtx.fillStyle = goldGrad;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -158 * sy);
    targetCtx.lineTo(20 * sx, -138 * sy);
    targetCtx.lineTo(0, -118 * sy);
    targetCtx.lineTo(-20 * sx, -138 * sy);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.0 * sx;
    targetCtx.stroke();

    // Three-Spired Royal Gothic Crown + Ruby Jewels
    targetCtx.fillStyle = goldGrad;
    targetCtx.beginPath();
    targetCtx.moveTo(-64 * sx, -178 * sy);
    targetCtx.lineTo(-76 * sx, -238 * sy);
    targetCtx.lineTo(-42 * sx, -206 * sy);
    targetCtx.lineTo(-24 * sx, -252 * sy);
    targetCtx.lineTo(-10 * sx, -212 * sy);
    targetCtx.lineTo(0, -274 * sy);
    targetCtx.lineTo(10 * sx, -212 * sy);
    targetCtx.lineTo(24 * sx, -252 * sy);
    targetCtx.lineTo(42 * sx, -206 * sy);
    targetCtx.lineTo(76 * sx, -238 * sy);
    targetCtx.lineTo(64 * sx, -178 * sy);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.4 * sx;
    targetCtx.stroke();

    targetCtx.fillStyle = goldDark;
    targetCtx.fillRect(-66 * sx, -184 * sy, 132 * sx, 16 * sy);
    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.0 * sx;
    targetCtx.strokeRect(-66 * sx, -184 * sy, 132 * sx, 16 * sy);

    if (!isMask) {
      for (const jx of [-40 * sx, 0, 40 * sx]) {
        targetCtx.fillStyle = '#8b1424';
        targetCtx.beginPath();
        targetCtx.arc(jx, -176 * sy, 5.2 * sx, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = 'rgba(255, 220, 210, 0.55)';
        targetCtx.beginPath();
        targetCtx.arc(jx - 1.5 * sx, -177.5 * sy, 1.6 * sx, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }

    // Lower gothic diamond flourish above swallowtail notch
    targetCtx.fillStyle = goldGrad;
    targetCtx.beginPath();
    targetCtx.moveTo(0, 260 * sy);
    targetCtx.lineTo(14 * sx, 280 * sy);
    targetCtx.lineTo(0, 302 * sy);
    targetCtx.lineTo(-14 * sx, 280 * sy);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.restore();
  };

  drawRoyalHeraldry(ctx, false);
  drawRoyalHeraldry(ectx, true);

  // 3. Battle Weathering, Soot Smudges & Singed Swallowtail Bottom Hem
  for (let i = 0; i < 26; i++) {
    const px = rand() * width;
    const isBottom = i < 14;
    const py = isBottom ? height * (0.72 + rand() * 0.28) : height * (0.18 + rand() * 0.65);
    const pr = (isBottom ? (36 + rand() * 66) : (20 + rand() * 44)) * sx;
    const alpha = isBottom ? (0.48 + rand() * 0.34) : (0.15 + rand() * 0.18);

    const g = ctx.createRadialGradient(px, py, 2 * sx, px, py, pr);
    g.addColorStop(0.0, `rgba(11, 7, 9, ${alpha.toFixed(3)})`);
    g.addColorStop(0.55, `rgba(22, 11, 13, ${(alpha * 0.52).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(20, 9, 12, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    const sg = sctx.createRadialGradient(px, py, 2 * sx, px, py, pr);
    sg.addColorStop(0.0, `rgba(255, 255, 255, ${(alpha * 1.1).toFixed(3)})`);
    sg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    sctx.fillStyle = sg;
    sctx.beginPath();
    sctx.arc(px, py, pr, 0, Math.PI * 2);
    sctx.fill();
  }

  // Singed charred swallowtail contour + frayed vertical thread tears
  const stepX = Math.max(2, Math.round(3 * sx));
  for (let x = 0; x < width; x += stepX) {
    const u = x / width;
    const centerWeight = 1.0 - Math.abs(u - 0.5) * 2.0;
    const hemStart = height * (0.86 - centerWeight * 0.14 - (rand() * 0.055));
    const emberY = hemStart - (14 + rand() * 22) * sy;

    const rimGrad = ctx.createLinearGradient(0, emberY, 0, height);
    rimGrad.addColorStop(0.00, 'rgba(46, 18, 10, 0.0)');
    rimGrad.addColorStop(0.26, 'rgba(56, 26, 13, 0.48)');
    rimGrad.addColorStop(0.50, 'rgba(18, 10, 11, 0.85)');
    rimGrad.addColorStop(1.00, 'rgba(7, 5, 7, 0.96)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(x, emberY, stepX + 1, height - emberY);

    const mGrad = sctx.createLinearGradient(0, emberY, 0, height);
    mGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    mGrad.addColorStop(0.38, 'rgba(255, 255, 255, 0.74)');
    mGrad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');
    sctx.fillStyle = mGrad;
    sctx.fillRect(x, emberY, stepX + 1, height - emberY);

    if (rand() < 0.32) {
      const fLen = (26 + rand() * 70) * sy;
      ctx.fillStyle = rand() > 0.35 ? 'rgba(9, 5, 7, 0.56)' : 'rgba(148, 108, 48, 0.28)';
      ctx.fillRect(x, hemStart - fLen * 0.45, Math.max(1, 1.5 * sx), fLen);
    }
  }

  // 4. LUT-Accelerated Pixel Pass: Tapestry Weave + Sculpted Drapery Pleats + Raised Embroidery Relief
  const albedoImg = ctx.getImageData(0, 0, width, height);
  const aPix = albedoImg.data;
  const ePix = ectx.getImageData(0, 0, width, height).data;
  const sPix = sctx.getImageData(0, 0, width, height).data;

  const total = width * height;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);

  const clothNoise = createTileableNoiseGrid(64, 9045);
  const napNoise   = createTileableNoiseGrid(32, 9046);
  const lutCloth = buildNoiseAxisLUT(clothNoise, width, 6);
  const lutNap   = buildNoiseAxisLUT(napNoise, width, 3);

  const gCloth = clothNoise.grid;
  const gNap   = napNoise.grid;
  const cX0 = lutCloth.x0, cX1 = lutCloth.x1, cSx = lutCloth.sx;
  const nX0 = lutNap.x0,   nX1 = lutNap.x1,   nSx = lutNap.sx;

  const invW = 1 / width;
  const invH = 1 / height;
  const weaveFreqX = (Math.PI * 2) * (128 * invW);
  const weaveFreqY = (Math.PI * 2) * (256 * invH);
  const stitchFreq = (Math.PI * 2) * (96 * invW);

  // Precompute 1D horizontal tables (eliminates ~2.5M trig/exp ops!)
  const ringU = [0.08, 0.36, 0.64, 0.92];
  const wxSinLUT = new Float32Array(width);
  const wxHalfSinLUT = new Float32Array(width);
  const wxHalfCosLUT = new Float32Array(width);
  const foldBaseLUT = new Float32Array(width);
  const foldSubSinLUT = new Float32Array(width);
  const foldSubCosLUT = new Float32Array(width);
  const ringGatherLUT = new Float32Array(width);
  const stitchSinXLUT = new Float32Array(width);
  const stitchCosXLUT = new Float32Array(width);

  for (let x = 0; x < width; x++) {
    const u = x * invW;
    const wx = x * weaveFreqX;
    wxSinLUT[x] = Math.sin(wx);
    wxHalfSinLUT[x] = Math.sin(wx * 0.5);
    wxHalfCosLUT[x] = Math.cos(wx * 0.5);

    foldBaseLUT[x] = Math.sin(u * Math.PI * 6.0 - 0.45) * 0.58 + Math.cos(u * Math.PI * 4.0 + 0.6) * 0.22;
    const subA = u * Math.PI * 10.0;
    foldSubSinLUT[x] = Math.sin(subA);
    foldSubCosLUT[x] = Math.cos(subA);

    let rg = 0;
    for (let ri = 0; ri < 4; ri++) {
      const du = (u - ringU[ri]) * 14.0;
      rg += Math.exp(-du * du);
    }
    ringGatherLUT[x] = rg * 1.25 - 0.45;

    const stx = x * stitchFreq;
    stitchSinXLUT[x] = Math.sin(stx);
    stitchCosXLUT[x] = Math.cos(stx);
  }

  const sClothY = 12 * clothNoise.size * invH;
  const sNapY   = 5 * napNoise.size * invH;

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    const hangT = y * invH;
    const wy = y * weaveFreqY;
    const wySin = Math.sin(wy);
    const wyHalfSin = Math.sin(wy * 0.5);
    const wyHalfCos = Math.cos(wy * 0.5);

    const foldEnv = Math.sin(clamp01(hangT * 1.08) * Math.PI * 0.88) * 0.84 + 0.16;
    const subPhase = hangT * 1.15;
    const cosPhase = Math.cos(subPhase);
    const sinPhase = Math.sin(subPhase);
    const topPinch = Math.max(0, 1.0 - hangT * 5.0) * 0.68;

    const sty = y * 0.65 * stitchFreq;
    const styCos = Math.cos(sty);
    const stySin = Math.sin(sty);

    const rc = sampleRowParams(clothNoise, y * sClothY);
    const rn = sampleRowParams(napNoise, y * sNapY);
    const cR0 = rc.r0, cR1 = rc.r1, cSy = rc.sy;
    const nR0 = rn.r0, nR1 = rn.r1, nSy = rn.sy;

    for (let x = 0; x < width; x++) {
      const idx = rowOff + x;
      const p4 = idx * 4;

      const embMask = ePix[p4] * (1 / 255);
      const scorchMask = sPix[p4] * (1 / 255);

      // Rich sculpted gravity drapery pleats
      let foldWave = foldBaseLUT[x] + (foldSubSinLUT[x] * cosPhase + foldSubCosLUT[x] * sinPhase) * 0.24;
      if (topPinch > 0) {
        foldWave = foldWave + (ringGatherLUT[x] - foldWave) * topPinch;
      }
      const foldH = foldWave * foldEnv;

      // Tapestry twill weave (sin(a+b) = sin(a)cos(b) + cos(a)sin(b) — zero trig inside inner loop!)
      const wxSin = wxSinLUT[x];
      const twill = wxHalfSinLUT[x] * wyHalfCos + wxHalfCosLUT[x] * wyHalfSin;

      let cx0 = cX0[x], cx1 = cX1[x], csx = cSx[x];
      const nc0 = gCloth[cR0 + cx0] + (gCloth[cR0 + cx1] - gCloth[cR0 + cx0]) * csx;
      const nc1 = gCloth[cR1 + cx0] + (gCloth[cR1 + cx1] - gCloth[cR1 + cx0]) * csx;
      const clothGrain = (nc0 + (nc1 - nc0) * cSy) - 0.5;

      let nx0 = nX0[x], nx1 = nX1[x], nsx = nSx[x];
      const nn0 = gNap[nR0 + nx0] + (gNap[nR0 + nx1] - gNap[nR0 + nx0]) * nsx;
      const nn1 = gNap[nR1 + nx0] + (gNap[nR1 + nx1] - gNap[nR1 + nx0]) * nsx;
      const nap = (nn0 + (nn1 - nn0) * nSy) - 0.5;

      const fabricWeave = (wxSin * 0.34 + wySin * 0.34 + twill * 0.32) * 0.048 + clothGrain * 0.052;

      let embBump = 0;
      if (embMask > 0.02) {
        const stitch = (stitchSinXLUT[x] * styCos + stitchCosXLUT[x] * stySin) * 0.032;
        embBump = embMask * (0.21 + stitch);
      }

      const scorchCrinkle = scorchMask * clothGrain * 0.09;
      heightData[idx] = clamp01(0.45 + foldH * 0.28 + fabricWeave + embBump + scorchCrinkle);

      // Rich drapery fold occlusion & warm velvet crest sheen
      let r = aPix[p4];
      let g = aPix[p4 + 1];
      let b = aPix[p4 + 2];

      const foldShade = 1.0 + foldH * 0.32 + (wxSin * wySin) * 0.04 + nap * 0.09;
      r *= foldShade;
      g *= foldShade;
      b *= foldShade;

      if (foldH > 0.28 && embMask < 0.15 && scorchMask < 0.4) {
        const sheen = (foldH - 0.28) * 19.0 * (1.0 - scorchMask);
        r += sheen * 1.12;
        g += sheen * 0.34;
        b += sheen * 0.42;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      let rough = 0.89 - foldH * 0.055 + nap * 0.06;
      if (embMask > 0.02) {
        const goldRough = 0.33 + clothGrain * 0.08 + (1.0 - embMask) * 0.12;
        rough = rough + (goldRough - rough) * (embMask * (1.0 - scorchMask * 0.65));
      }
      if (scorchMask > 0.02) {
        rough = rough + (0.96 - rough) * (scorchMask * 0.90);
      }
      roughData[idx] = rough < 0.28 ? 0.28 : rough > 0.98 ? 0.98 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: false, anisotropy });
  const normal = buildNormalMapFromHeight(heightData, width, height, 1.38, 1.18, anisotropy, false);
  const roughness = buildRoughnessMapFromField(roughData, width, height, anisotropy, false);

  return { albedo, normal, roughness };
}

// ============================================================================
// 5. Hand-Forged Hammered Wrought-Iron PBR Set (512px PC / 256px Mobile)
//    Exported as ironNormal + ironRoughness.
//    Dual-scale tileable Voronoi anvil hammer strikes, burnished metallic edge
//    glints (roughness ~0.22..0.34) & organic oxidized patina pockets (~0.88).
// ============================================================================
function createIronPbrSet(size, anisotropy) {
  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);

  const vCoarse = createTileableVoronoiGrid(9, 7701, 0.86);
  const vFine   = createTileableVoronoiGrid(20, 7702, 0.82);

  const nPatina = createTileableNoiseGrid(16, 7703);
  const nGrain  = createTileableNoiseGrid(32, 7704);
  const nMicro  = createTileableNoiseGrid(64, 7705);

  const lutPat = buildNoiseAxisLUT(nPatina, size, 3);
  const lutGr  = buildNoiseAxisLUT(nGrain, size, 6);
  const lutMic = buildNoiseAxisLUT(nMicro, size, 20);

  const gPat = nPatina.grid;
  const gGr  = nGrain.grid;
  const gMic = nMicro.grid;

  const pX0 = lutPat.x0, pX1 = lutPat.x1, pSx = lutPat.sx;
  const gX0 = lutGr.x0,  gX1 = lutGr.x1,  gSx = lutGr.sx;
  const mX0 = lutMic.x0, mX1 = lutMic.x1, mSx = lutMic.sx;

  const invSize = 1 / size;
  const cCells = vCoarse.cells;
  const cPx = vCoarse.px;
  const cPy = vCoarse.py;
  const cDepth = vCoarse.depth;

  const fCells = vFine.cells;
  const fPx = vFine.px;
  const fPy = vFine.py;

  const sPatY = 3 * nPatina.size * invSize;
  const sGrY  = 18 * nGrain.size * invSize; // anisotropic hammer-drawn steel grain
  const sMicY = 20 * nMicro.size * invSize;

  const cNyRow = new Int32Array(3);
  const fNyRow = new Int32Array(3);

  for (let y = 0; y < size; y++) {
    const rowOff = y * size;
    const uy = y * invSize;
    const cy = uy * cCells;
    const ciy = cy | 0;
    const fy = uy * fCells;
    const fiy = fy | 0;

    for (let oy = -1; oy <= 1; oy++) {
      let ny = ciy + oy;
      if (ny < 0) ny += cCells;
      else if (ny >= cCells) ny -= cCells;
      cNyRow[oy + 1] = ny * cCells;

      let fny = fiy + oy;
      if (fny < 0) fny += fCells;
      else if (fny >= fCells) fny -= fCells;
      fNyRow[oy + 1] = fny * fCells;
    }

    const rp = sampleRowParams(nPatina, y * sPatY);
    const rg = sampleRowParams(nGrain, y * sGrY);
    const rm = sampleRowParams(nMicro, y * sMicY);

    const pR0 = rp.r0, pR1 = rp.r1, pSy = rp.sy;
    const gR0 = rg.r0, gR1 = rg.r1, gSy = rg.sy;
    const mR0 = rm.r0, mR1 = rm.r1, mSy = rm.sy;

    for (let x = 0; x < size; x++) {
      const idx = rowOff + x;
      const ux = x * invSize;

      // Primary Voronoi ball-peen hammer strikes
      const cx = ux * cCells;
      const cix = cx | 0;
      let d1 = 9.0;
      let d2 = 9.0;
      let bestDepth = 1.0;

      for (let oy = -1; oy <= 1; oy++) {
        const nRow = cNyRow[oy + 1];
        const baseY = ciy + oy;
        for (let ox = -1; ox <= 1; ox++) {
          let nx = cix + ox;
          if (nx < 0) nx += cCells;
          else if (nx >= cCells) nx -= cCells;
          const ci = nRow + nx;
          const dx = (cix + ox + cPx[ci]) - cx;
          const dy = (baseY + cPy[ci]) - cy;
          const distSq = dx * dx + dy * dy;
          if (distSq < d1) {
            d2 = d1;
            d1 = distSq;
            bestDepth = cDepth[ci];
          } else if (distSq < d2) {
            d2 = distSq;
          }
        }
      }

      const f1 = Math.sqrt(d1);
      const f2 = Math.sqrt(d2);
      const peenBowl = clamp01(f1 * 1.44) * bestDepth;
      const ridgeEdge = clamp01(1.0 - (f2 - f1) * 5.6);

      // Secondary finer planishing hammer marks
      const fx = ux * fCells;
      const fix = fx | 0;
      let fd1 = 9.0;
      for (let oy = -1; oy <= 1; oy++) {
        const nRow = fNyRow[oy + 1];
        const baseY = fiy + oy;
        for (let ox = -1; ox <= 1; ox++) {
          let nx = fix + ox;
          if (nx < 0) nx += fCells;
          else if (nx >= fCells) nx -= fCells;
          const ci = nRow + nx;
          const dx = (fix + ox + fPx[ci]) - fx;
          const dy = (baseY + fPy[ci]) - fy;
          const distSq = dx * dx + dy * dy;
          if (distSq < fd1) fd1 = distSq;
        }
      }
      const finePeen = clamp01(Math.sqrt(fd1) * 1.40);

      // LUT noise samples for patina, forged slag grain & micro-pitting
      let px0 = pX0[x], px1 = pX1[x], psx = pSx[x];
      const np0 = gPat[pR0 + px0] + (gPat[pR0 + px1] - gPat[pR0 + px0]) * psx;
      const np1 = gPat[pR1 + px0] + (gPat[pR1 + px1] - gPat[pR1 + px0]) * psx;
      const patN = np0 + (np1 - np0) * pSy;

      let gx0 = gX0[x], gx1 = gX1[x], gsx = gSx[x];
      const ng0 = gGr[gR0 + gx0] + (gGr[gR0 + gx1] - gGr[gR0 + gx0]) * gsx;
      const ng1 = gGr[gR1 + gx0] + (gGr[gR1 + gx1] - gGr[gR1 + gx0]) * gsx;
      const grN = ng0 + (ng1 - ng0) * gSy;

      let mx0 = mX0[x], mx1 = mX1[x], msx = mSx[x];
      const nm0 = gMic[mR0 + mx0] + (gMic[mR0 + mx1] - gMic[mR0 + mx0]) * msx;
      const nm1 = gMic[mR1 + mx0] + (gMic[mR1 + mx1] - gMic[mR1 + mx0]) * msx;
      const micN = nm0 + (nm1 - nm0) * mSy;

      // Irregular rust/mill-scale patina patches concentrating in hammer depressions
      const cavityMask = clamp01(1.0 - peenBowl * 0.85);
      const patinaRaw = clamp01((patN * 0.66 + micN * 0.34 - 0.40 + cavityMask * 0.22) * 2.4);
      const patina = patinaRaw * patinaRaw * (3 - 2 * patinaRaw);

      heightData[idx] = clamp01(
        0.16 +
        peenBowl * 0.42 +
        ridgeEdge * 0.13 +
        finePeen * 0.17 +
        (grN - 0.5) * 0.12 +
        (micN - 0.5) * 0.08 -
        patina * 0.06
      );

      // Burnished metallic ridge glints (~0.22..0.34) vs forged scale (~0.52) vs rough patina (~0.88..0.92)
      const baseIronR = 0.55 - peenBowl * 0.12 - ridgeEdge * 0.24 + (grN - 0.5) * 0.10;
      const finalR = baseIronR + (0.89 + (micN - 0.5) * 0.08 - baseIronR) * (patina * 0.85);
      roughData[idx] = finalR < 0.22 ? 0.22 : finalR > 0.92 ? 0.92 : finalR;
    }
  }

  const normal = buildNormalMapFromHeight(heightData, size, size, 1.24, 1.10, anisotropy, true);
  const roughness = buildRoughnessMapFromField(roughData, size, size, anisotropy, true);

  return { normal, roughness };
}

// ============================================================================
// 6. 2x2 Storytelling Ground Decal Atlas (1024px PC / 512px Mobile)
//    Exact 2x2 UV quadrant compatibility with soulsArena.js:
//      q=0 (top-left):     Shattered Stone Impact Cracks & Fractured Shards
//      q=1 (top-right):    Coagulated Crimson Battle Bloodstain & Splatter
//      q=2 (bottom-left):  Damp Wall-Base Emerald Moss, Lichen & Tendrils
//      q=3 (bottom-right): Fire-Charred Ash Scorch & Melted Candle Wax Drippings
// ============================================================================
function createDecalAtlasTexture(size, anisotropy) {
  const canvas = createCanvas2D(size, size);
  if (!canvas) {
    return createFallbackTexture(0, 0, 0, 0, true, THREE.ClampToEdgeWrapping, anisotropy);
  }

  const ctx = getFastCtx2D(canvas, false);
  ctx.clearRect(0, 0, size, size);

  const half = size * 0.5;
  const qScale = half / 256;
  const rand = makeRng(269951);

  // --------------------------------------------------------------------------
  // Quadrant (0,0) [q=0, UV x:0..0.5, y:0.5..1.0]: Shattered Stone Impact Cracks
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(4 * qScale, 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 0.5;
    const cy = half * 0.5;

    const crater = ctx.createRadialGradient(cx, cy, 4 * qScale, cx, cy, 114 * qScale);
    crater.addColorStop(0.00, 'rgba(6, 7, 11, 0.82)');
    crater.addColorStop(0.32, 'rgba(10, 11, 17, 0.54)');
    crater.addColorStop(0.68, 'rgba(14, 16, 23, 0.20)');
    crater.addColorStop(1.00, 'rgba(14, 16, 23, 0.0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(cx, cy, 114 * qScale, 0, Math.PI * 2);
    ctx.fill();

    // Concentric impact stress ring fractures (cracked stone slab rings)
    for (let ring = 0; ring < 2; ring++) {
      const rBase = (ring === 0 ? 36 : 68) * qScale;
      const segs = 14 + ring * 6;
      ctx.strokeStyle = ring === 0 ? 'rgba(5, 6, 11, 0.78)' : 'rgba(8, 10, 16, 0.50)';
      ctx.lineWidth = (ring === 0 ? 2.4 : 1.45) * qScale;
      for (let s = 0; s < segs; s++) {
        if (rand() < 0.24) continue;
        const a0 = (s / segs) * Math.PI * 2 + (rand() - 0.5) * 0.12;
        const a1 = ((s + 0.88) / segs) * Math.PI * 2 + (rand() - 0.5) * 0.12;
        const r0 = rBase + (rand() - 0.5) * 9 * qScale;
        const r1 = rBase + (rand() - 0.5) * 9 * qScale;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
        ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
        ctx.stroke();
      }
    }

    // 13 bold jagged primary fissures with crisp fractured bevel catchlights & spiderweb forks
    for (let i = 0; i < 13; i++) {
      const ang = (i / 13) * Math.PI * 2 + (rand() - 0.5) * 0.26;
      const pts = [[cx + Math.cos(ang) * 4 * qScale, cy + Math.sin(ang) * 4 * qScale]];
      const steps = 5;
      for (let s = 1; s <= steps; s++) {
        const dist = (18 + s * 19.5 + (rand() - 0.3) * 8) * qScale;
        const jitter = (rand() - 0.5) * 0.24;
        pts.push([cx + Math.cos(ang + jitter) * dist, cy + Math.sin(ang + jitter) * dist]);
      }

      ctx.strokeStyle = 'rgba(176, 186, 212, 0.26)';
      ctx.lineWidth = Math.max(1.2, (2.6 - (i % 3) * 0.45) * qScale);
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + 1.4 * qScale, pts[0][1] + 1.2 * qScale);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0] + 1.4 * qScale, pts[p][1] + 1.2 * qScale);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(4, 5, 9, 0.94)';
      ctx.lineWidth = Math.max(1.5, (3.8 - (i % 3) * 0.65) * qScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
      ctx.stroke();

      if (rand() < 0.78) {
        const bIdx = 1 + Math.floor(rand() * 3);
        let bx = pts[bIdx][0];
        let by = pts[bIdx][1];
        const bAng = ang + (rand() > 0.5 ? 1 : -1) * (0.45 + rand() * 0.55);
        ctx.strokeStyle = 'rgba(6, 7, 12, 0.78)';
        ctx.lineWidth = Math.max(1.0, 1.5 * qScale);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        for (let bk = 0; bk < 3; bk++) {
          const step = (10 + rand() * 12) * qScale;
          bx += Math.cos(bAng + (rand() - 0.5) * 0.45) * step;
          by += Math.sin(bAng + (rand() - 0.5) * 0.45) * step;
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
    }

    // Scattered shattered stone pebbles & chips around impact
    for (let k = 0; k < 28; k++) {
      const a = rand() * Math.PI * 2;
      const dist = (14 + rand() * 90) * qScale;
      const px = cx + Math.cos(a) * dist;
      const py = cy + Math.sin(a) * dist;
      const pr = (1.6 + rand() * 4.2) * qScale;
      ctx.fillStyle = 'rgba(4, 5, 8, 0.68)';
      ctx.beginPath();
      ctx.ellipse(px + 1.2 * qScale, py + 1.2 * qScale, pr * 1.15, pr * 0.78, a, 0, Math.PI * 2);
      ctx.fill();
      const lum = 64 + Math.floor(rand() * 34);
      ctx.fillStyle = `rgba(${lum}, ${lum + 3}, ${lum + 10}, 0.70)`;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.68, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // Quadrant (1,0) [q=1, UV x:0.5..1.0, y:0.5..1.0]: Coagulated Battle Bloodstain
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(half + 4 * qScale, 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 1.5;
    const cy = half * 0.5;

    for (let i = 0; i < 12; i++) {
      const ox = cx + (rand() - 0.5) * 96 * qScale;
      const oy = cy + (rand() - 0.5) * 96 * qScale;
      const r = (24 + rand() * 42) * qScale;
      const g = ctx.createRadialGradient(ox, oy, 2 * qScale, ox, oy, r);
      g.addColorStop(0.00, 'rgba(48, 8, 10, 0.76)');
      g.addColorStop(0.62, 'rgba(60, 10, 13, 0.50)');
      g.addColorStop(0.84, 'rgba(42, 11, 12, 0.24)');
      g.addColorStop(1.00, 'rgba(28, 6, 8, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 7; i++) {
      const ox = cx + (rand() - 0.5) * 56 * qScale;
      const oy = cy + (rand() - 0.5) * 56 * qScale;
      const r = (16 + rand() * 28) * qScale;
      const g = ctx.createRadialGradient(ox, oy, 1 * qScale, ox, oy, r);
      g.addColorStop(0.00, 'rgba(30, 4, 6, 0.88)');
      g.addColorStop(0.70, 'rgba(68, 8, 12, 0.74)');
      g.addColorStop(0.90, 'rgba(42, 5, 8, 0.54)');
      g.addColorStop(1.00, 'rgba(30, 4, 6, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 6; i++) {
      const ox = cx + (rand() - 0.5) * 46 * qScale;
      const oy = cy + (rand() - 0.5) * 46 * qScale;
      const r = (4 + rand() * 10) * qScale;
      ctx.fillStyle = 'rgba(118, 22, 26, 0.26)';
      ctx.beginPath();
      ctx.ellipse(ox, oy, r, r * 0.55, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let s = 0; s < 18; s++) {
      const a = rand() * Math.PI * 2;
      const d0 = (24 + rand() * 36) * qScale;
      const d1 = d0 + (22 + rand() * 48) * qScale;
      ctx.strokeStyle = 'rgba(54, 7, 10, 0.64)';
      ctx.lineWidth = (1.6 + rand() * 3.2) * qScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0);
      ctx.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1);
      ctx.stroke();
    }

    for (let d = 0; d < 48; d++) {
      const a = rand() * Math.PI * 2;
      const dist = (34 + rand() * 82) * qScale;
      const dr = (1.2 + rand() * 5.6) * qScale;
      ctx.fillStyle = rand() > 0.4 ? 'rgba(60, 8, 11, 0.74)' : 'rgba(36, 5, 8, 0.80)';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, dr * 1.38, dr * 0.62, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // Quadrant (0,1) [q=2, UV x:0..0.5, y:0..0.5]: Damp Wall-Base Moss & Lichen
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(4 * qScale, half + 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 0.5;
    const cy = half * 1.5;

    const damp = ctx.createRadialGradient(cx, cy, 10 * qScale, cx, cy, 112 * qScale);
    damp.addColorStop(0.00, 'rgba(12, 18, 11, 0.58)');
    damp.addColorStop(0.62, 'rgba(16, 22, 14, 0.28)');
    damp.addColorStop(1.00, 'rgba(16, 22, 14, 0.0)');
    ctx.fillStyle = damp;
    ctx.beginPath();
    ctx.arc(cx, cy, 112 * qScale, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 24; i++) {
      const a = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.72) * 78 * qScale;
      const ox = cx + Math.cos(a) * dist;
      const oy = cy + Math.sin(a) * dist;
      const r = (14 + rand() * 32) * qScale;
      const g = ctx.createRadialGradient(ox, oy, 2 * qScale, ox, oy, r);
      const tone = i % 3;
      if (tone === 0) {
        g.addColorStop(0.0, 'rgba(42, 66, 30, 0.74)');
        g.addColorStop(0.6, 'rgba(30, 48, 22, 0.42)');
        g.addColorStop(1.0, 'rgba(22, 34, 18, 0.0)');
      } else if (tone === 1) {
        g.addColorStop(0.0, 'rgba(58, 82, 38, 0.64)');
        g.addColorStop(0.6, 'rgba(40, 58, 28, 0.34)');
        g.addColorStop(1.0, 'rgba(26, 38, 20, 0.0)');
      } else {
        g.addColorStop(0.0, 'rgba(66, 78, 46, 0.52)');
        g.addColorStop(0.6, 'rgba(44, 54, 34, 0.24)');
        g.addColorStop(1.0, 'rgba(30, 38, 24, 0.0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let t = 0; t < 10; t++) {
      const a = (t / 10) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      let tx = cx + Math.cos(a) * 28 * qScale;
      let ty = cy + Math.sin(a) * 28 * qScale;
      ctx.strokeStyle = 'rgba(36, 56, 26, 0.54)';
      ctx.lineWidth = (2.6 + rand() * 2.4) * qScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      for (let s = 0; s < 4; s++) {
        tx += Math.cos(a + (rand() - 0.5) * 0.75) * (14 + rand() * 8) * qScale;
        ty += Math.sin(a + (rand() - 0.5) * 0.75) * (14 + rand() * 8) * qScale;
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
    }

    for (let k = 0; k < 180; k++) {
      const a = rand() * Math.PI * 2;
      const dist = Math.pow(rand(), 0.75) * 94 * qScale;
      const ox = cx + Math.cos(a) * dist;
      const oy = cy + Math.sin(a) * dist;
      const r = (1.1 + rand() * 2.8) * qScale;
      const pick = rand();
      ctx.fillStyle = pick < 0.22
        ? 'rgba(116, 132, 92, 0.42)'
        : pick < 0.64
          ? 'rgba(68, 96, 44, 0.56)'
          : 'rgba(20, 32, 16, 0.52)';
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // Quadrant (1,1) [q=3, UV x:0.5..1.0, y:0..0.5]: Ash Scorch & Melted Candle Wax
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(half + 4 * qScale, half + 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 1.5;
    const cy = half * 1.5;

    const scorch = ctx.createRadialGradient(cx, cy, 6 * qScale, cx, cy, 110 * qScale);
    scorch.addColorStop(0.00, 'rgba(8, 7, 10, 0.88)');
    scorch.addColorStop(0.38, 'rgba(18, 15, 18, 0.62)');
    scorch.addColorStop(0.68, 'rgba(54, 48, 46, 0.26)');
    scorch.addColorStop(0.86, 'rgba(88, 82, 78, 0.10)');
    scorch.addColorStop(1.00, 'rgba(24, 20, 22, 0.0)');
    ctx.fillStyle = scorch;
    ctx.beginPath();
    ctx.arc(cx, cy, 110 * qScale, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 8; i++) {
      const a = rand() * Math.PI * 2;
      const dist = (22 + rand() * 34) * qScale;
      const r = (18 + rand() * 26) * qScale;
      const ox = cx + Math.cos(a) * dist;
      const oy = cy + Math.sin(a) * dist;
      const sg = ctx.createRadialGradient(ox, oy, 2 * qScale, ox, oy, r);
      sg.addColorStop(0.0, 'rgba(12, 10, 12, 0.48)');
      sg.addColorStop(1.0, 'rgba(12, 10, 12, 0.0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let k = 0; k < 40; k++) {
      const a = rand() * Math.PI * 2;
      const dist = (14 + rand() * 82) * qScale;
      const r = (1.0 + rand() * 2.6) * qScale;
      ctx.fillStyle = rand() > 0.35 ? 'rgba(128, 122, 118, 0.28)' : 'rgba(6, 5, 7, 0.65)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Organic flowing wax pools & solidified dripping rivulets (blended subtly into scorched ash)
    const waxPools = [];
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const dist = (6 + rand() * 58) * qScale;
      waxPools.push({
        x: cx + Math.cos(a) * dist,
        y: cy + Math.sin(a) * dist,
        rx: (4.5 + rand() * 11.5) * qScale,
        ry: (3.2 + rand() * 8.2) * qScale,
        rot: rand() * Math.PI
      });
    }

    for (let i = 0; i < waxPools.length; i++) {
      const w = waxPools[i];
      ctx.fillStyle = 'rgba(8, 6, 6, 0.48)';
      ctx.beginPath();
      ctx.ellipse(w.x + 1.6 * qScale, w.y + 1.6 * qScale, w.rx * 1.10, w.ry * 1.10, w.rot, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 12; i++) {
      const a = rand() * Math.PI * 2;
      const len = (20 + rand() * 46) * qScale;
      const x0 = cx + Math.cos(a) * 6 * qScale;
      const y0 = cy + Math.sin(a) * 6 * qScale;
      const x1 = cx + Math.cos(a + (rand() - 0.5) * 0.4) * len;
      const y1 = cy + Math.sin(a + (rand() - 0.5) * 0.4) * len;
      ctx.strokeStyle = 'rgba(188, 172, 138, 0.44)';
      ctx.lineWidth = (2.2 + rand() * 3.0) * qScale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        (x0 + x1) * 0.5 + (rand() - 0.5) * 10 * qScale,
        (y0 + y1) * 0.5 + (rand() - 0.5) * 10 * qScale,
        x1,
        y1
      );
      ctx.stroke();
    }

    for (let i = 0; i < waxPools.length; i++) {
      const w = waxPools[i];
      const wg = ctx.createRadialGradient(w.x - w.rx * 0.22, w.y - w.ry * 0.22, 0.8 * qScale, w.x, w.y, Math.max(w.rx, w.ry));
      wg.addColorStop(0.00, 'rgba(216, 202, 170, 0.58)');
      wg.addColorStop(0.62, 'rgba(178, 162, 128, 0.42)');
      wg.addColorStop(1.00, 'rgba(128, 114, 90, 0.14)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.rx, w.ry, w.rot, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(246, 236, 212, 0.34)';
      ctx.beginPath();
      ctx.ellipse(w.x - w.rx * 0.24, w.y - w.ry * 0.22, w.rx * 0.28, w.ry * 0.20, w.rot, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  return finalizeCanvasTexture(canvas, { isColor: true, repeat: false, anisotropy });
}

// ============================================================================
// 7. Atmospheric Swirling Boss Fog Wall & Volumetric Abyss Mist Textures
// ============================================================================
function createFogWallTexture(size, anisotropy) {
  const canvas = createCanvas2D(size, size);
  if (!canvas) {
    return createFallbackTexture(230, 226, 214, 180, true, THREE.RepeatWrapping, anisotropy);
  }
  const ctx = getFastCtx2D(canvas, true);
  const img = ctx.createImageData(size, size);
  const pix = img.data;

  // Seamless 3-octave silky billowing boss-fog curtain (low-frequency smooth FBM, zero grain/bokeh!)
  const nA = createTileableNoiseGrid(8, 26071);
  const nB = createTileableNoiseGrid(16, 26072);
  const nC = createTileableNoiseGrid(32, 26073);

  const lutA = buildNoiseAxisLUT(nA, size, 1);
  const lutB = buildNoiseAxisLUT(nB, size, 1);
  const lutC = buildNoiseAxisLUT(nC, size, 1);

  const gA = nA.grid, gB = nB.grid, gC = nC.grid;
  const aX0 = lutA.x0, aX1 = lutA.x1, aSx = lutA.sx;
  const bX0 = lutB.x0, bX1 = lutB.x1, bSx = lutB.sx;
  const cX0 = lutC.x0, cX1 = lutC.x1, cSx = lutC.sx;

  const invSize = 1 / size;
  const sAY = nA.size * invSize;
  const sBY = nB.size * invSize;
  const sCY = nC.size * invSize;

  for (let y = 0; y < size; y++) {
    const rowOff = y * size;
    const v = y * invSize;
    // Soft gothic archway curtain vertical envelope (fades gracefully at top & bottom)
    const vEnv = Math.sin(v * Math.PI);
    const vProfile = Math.pow(vEnv, 0.55);

    // Slight vertical stretching for ethereal rising mist ribbons
    const ra = sampleRowParams(nA, y * sAY);
    const rb = sampleRowParams(nB, y * sBY);
    const rc = sampleRowParams(nC, y * sCY);

    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;
    const cR0 = rc.r0, cR1 = rc.r1, cSy = rc.sy;

    for (let x = 0; x < size; x++) {
      let ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const fA0 = gA[aR0 + ax0] + (gA[aR0 + ax1] - gA[aR0 + ax0]) * asx;
      const fA1 = gA[aR1 + ax0] + (gA[aR1 + ax1] - gA[aR1 + ax0]) * asx;
      const fA = fA0 + (fA1 - fA0) * aSy;

      let bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const fB0 = gB[bR0 + bx0] + (gB[bR0 + bx1] - gB[bR0 + bx0]) * bsx;
      const fB1 = gB[bR1 + bx0] + (gB[bR1 + bx1] - gB[bR1 + bx0]) * bsx;
      const fB = fB0 + (fB1 - fB0) * bSy;

      let cx0 = cX0[x], cx1 = cX1[x], csx = cSx[x];
      const fC0 = gC[cR0 + cx0] + (gC[cR0 + cx1] - gC[cR0 + cx0]) * csx;
      const fC1 = gC[cR1 + cx0] + (gC[cR1 + cx1] - gC[cR1 + cx0]) * csx;
      const fC = fC0 + (fC1 - fC0) * cSy;

      const fbm = fA * 0.56 + fB * 0.30 + fC * 0.14;
      const wisp = Math.sin((v * 2.5 + fA * 2.2 + fB * 0.9) * Math.PI) * 0.5 + 0.5;
      const density = clamp01((0.32 + fbm * 0.50 + wisp * 0.22) * vProfile);

      // Warm pale-golden Souls Boss Fog glow blending softly into silvery moonlit mist
      const goldMix = clamp01((fbm * 0.7 + wisp * 0.45) * 1.05);
      const r = (206 + goldMix * 48) | 0;
      const g = (210 + goldMix * 34) | 0;
      const b = (232 - goldMix * 26) | 0;
      const a = (density * 224) | 0;

      const p4 = (rowOff + x) * 4;
      pix[p4]     = r;
      pix[p4 + 1] = g;
      pix[p4 + 2] = b;
      pix[p4 + 3] = a;
    }
  }

  ctx.putImageData(img, 0, 0);
  return finalizeCanvasTexture(canvas, { isColor: true, repeat: true, anisotropy });
}

function createAbyssMistTexture(anisotropy) {
  const size = 256;
  const canvas = createCanvas2D(size, size);
  if (!canvas) {
    return createFallbackTexture(255, 255, 255, 128, true, THREE.ClampToEdgeWrapping, anisotropy);
  }
  const ctx = getFastCtx2D(canvas, false);
  ctx.clearRect(0, 0, size, size);

  const lobes = [
    [0.50, 0.50, 0.45, 0.44],
    [0.34, 0.46, 0.33, 0.30],
    [0.66, 0.54, 0.34, 0.28],
    [0.46, 0.34, 0.29, 0.24],
    [0.54, 0.66, 0.30, 0.24],
    [0.39, 0.60, 0.24, 0.18],
    [0.62, 0.38, 0.23, 0.18]
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [ux, uy, ur, a] = lobes[i];
    const cx = ux * size;
    const cy = uy * size;
    const r = ur * size;
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0.00, `rgba(255, 255, 255, ${a})`);
    g.addColorStop(0.50, `rgba(255, 255, 255, ${(a * 0.44).toFixed(3)})`);
    g.addColorStop(1.00, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeCanvasTexture(canvas, { isColor: true, repeat: false, anisotropy });
}

// ============================================================================
// Public Suite Factory (100% backward-compatible + new AAA PBR maps)
// ============================================================================
export function createSoulsPbrTextures({ isMobile = false } = {}) {
  const texSize = isMobile ? 512 : 1024;
  const ironSize = isMobile ? 256 : 512;
  const bannerW = isMobile ? 256 : 512;
  const bannerH = isMobile ? 512 : 1024;
  const fogSize = isMobile ? 256 : 512;
  const anisotropy = isMobile ? 2 : 8;

  const floor = createFlagstonePbrSet(texSize, anisotropy);
  const ashlar = createAshlarPbrSet(texSize, anisotropy);
  const vaultStone = createVaultStonePbrSet(texSize, anisotropy);
  const banner = createBannerPbrSet(bannerW, bannerH, anisotropy);
  const iron = createIronPbrSet(ironSize, anisotropy);
  const decalAtlas = createDecalAtlasTexture(texSize, anisotropy);
  const fogWall = createFogWallTexture(fogSize, anisotropy);
  const abyssMist = createAbyssMistTexture(anisotropy);

  const allTextures = [
    floor.albedo, floor.normal, floor.roughness,
    ashlar.albedo, ashlar.normal, ashlar.roughness,
    vaultStone.albedo, vaultStone.normal,
    banner.albedo, banner.normal, banner.roughness,
    iron.normal, iron.roughness,
    decalAtlas, fogWall, abyssMist
  ];

  return {
    // Existing core PBR maps (100% backward compatible with soulsArena.js)
    floorAlbedo: floor.albedo,
    floorNormal: floor.normal,
    floorRoughness: floor.roughness,
    ashlarAlbedo: ashlar.albedo,
    ashlarNormal: ashlar.normal,
    ashlarRoughness: ashlar.roughness,
    ironNormal: iron.normal,
    ironRoughness: iron.roughness,
    decalAtlas,
    fogWall,
    abyssMist,

    // New AAA PBR maps for gothic cathedral vaults & royal heraldic banners
    vaultStoneAlbedo: vaultStone.albedo,
    vaultStoneNormal: vaultStone.normal,
    bannerAlbedo: banner.albedo,
    bannerNormal: banner.normal,
    bannerRoughness: banner.roughness,

    dispose() {
      for (let i = 0; i < allTextures.length; i++) {
        allTextures[i]?.dispose?.();
      }
      allTextures.length = 0;
    }
  };
}
