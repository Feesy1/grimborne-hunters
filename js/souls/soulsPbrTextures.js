// Procedural AAA 2K PBR Texture Suite for Chapter 26 — «Abandoned Knight Rift» (Wave 3: Matte Anti-Shimmer + Royal Carpet)
// Generates shared high-resolution procedural PBR maps with ZERO duplicate VRAM clones:
//   - Gothic Flagstone Floor (2048px PC / 512px Mobile): albedo + anti-shimmer 3-scale Sobel normal + ORM (aoMap .r + roughnessMap .g: 0.64..0.92 soft worn centers vs matte mortar)
//   - Carved Gothic Ashlar Stone (2048px PC / 512px Mobile): lifted warm charcoal-slate albedo (+18% midtones) + anti-shimmer Sobel normal + ORM (roughnessMap .g: 0.74..0.96 matte stonework)
//   - Soot-Stained Cathedral Vault Stone (2048px PC / 512px Mobile): albedo + anti-shimmer Sobel normal + ORM (roughnessMap .g: 0.74..0.95)
//   - Royal Heraldic Tapestry / Velvet Banner (1024x2048 PC / 256x512 Mobile): albedo + woven/fold/bullion-stitch normal + ORM (aoMap .r + roughnessMap .g)
//   - Hand-Forged Hammered Wrought Iron (1024px PC / 256px Mobile): multi-tier Voronoi peens + micro-scratches + soot pitting normal + ORM (roughnessMap .g: 0.58..0.88)
//   - Royal Crimson-Velvet Ornate Runner Carpet (1024px PC / 256px Mobile): diamond-quilted tufting + damask + tarnished-gold Gothic filigree borders + ORM (roughnessMap .g: 0.84..0.96)
//   - 2x2 Storytelling Ground Decal Atlas (2048px PC / 512px Mobile): Shattered Slabs | Coagulated Blood | Damp Moss | Ash Scorch & Melted Wax
//   - Atmospheric Swirling Gothic Fog Wall & Volumetric Abyss Mist
// Note: Three.js r160 MeshStandardMaterial reads aoMap from .r and roughnessMap from .g, allowing
// zero-extra-VRAM ORM sharing (e.g. floorAo === floorRoughness, tex.channel = 0) with 100% GPU L1 cache reuse!

import * as THREE from '../../vendor/three.module.js';

// ============================================================================
// Core Deterministic RNG, Math & LUT-Accelerated Tileable Noise Primitives
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
  tex.channel = 0;
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

// Precompute 1D axis lookup tables (x0, x1, smoothstep sx) once per noise layer
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

// Tileable cellular Voronoi grid (for forged hammered iron peen dimples & mineral facets)
function createTileableVoronoiGrid(cells, seed, jitter = 0.84) {
  const rng = makeRng(seed);
  const count = cells * cells;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const depth = new Float32Array(count);
  const pad = (1 - jitter) * 0.5;
  for (let i = 0; i < count; i++) {
    px[i] = pad + rng() * jitter;
    py[i] = pad + rng() * jitter;
    depth[i] = 0.66 + rng() * 0.66;
  }
  return { cells, px, py, depth };
}

// Bounding-box culled wrapped drawing: 1x for interior shapes, 2-4x only across borders (100% seamless!)
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

function finalizeCanvasTexture(canvas, { isColor = true, repeat = true, repeatX = repeat, repeatY = repeat, anisotropy = 16 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.channel = 0;
  tex.wrapS = repeatX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 3-Octave Sculptural Sobel Normal Map Builder
// Combines:
//   - r1 = 1px fine Sobel (micro crystalline pores, hairline fractures, weave threads, chisel lines)
//   - r2 = bevel Sobel scaled w/ resolution (sharp chipped stone chamfers & deep mortar trenches)
//   - r3 = broad sculpt Sobel scaled w/ resolution (3D pillowed stone cushion & sweeping folds)
// Pre-flips rows (dstRow = height - 1 - y, flipY = false) for sub-pixel alignment with CanvasTexture!
// Supports independent repeatX / repeatY wrapping (e.g. runner carpet clamps U and tiles seamlessly along V).
// ============================================================================
function buildNormalMapFromHeight(
  heightData,
  width,
  height,
  microStrength,
  bevelStrength,
  sculptStrength,
  anisotropy,
  repeat = true,
  repeatY = repeat
) {
  const data = new Uint8Array(width * height * 4);
  const wMask = width - 1;
  const hMask = height - 1;
  const wMax = width - 1;
  const hMax = height - 1;
  const resScale = width / 512;
  const r2 = Math.max(2, Math.round(2.5 * resScale));
  const r3 = Math.max(5, Math.round(7.0 * resScale));
  const hasSculpt = sculptStrength > 0.001;

  if (repeat && repeatY) {
    for (let y = 0; y < height; y++) {
      const ym1 = ((y - 1) & hMask) * width;
      const y0  = y * width;
      const yp1 = ((y + 1) & hMask) * width;
      const ym2 = ((y - r2) & hMask) * width;
      const yp2 = ((y + r2) & hMask) * width;
      const ym3 = ((y - r3) & hMask) * width;
      const yp3 = ((y + r3) & hMask) * width;
      const dstRow = (hMax - y) * width;

      for (let x = 0; x < width; x++) {
        const xm1 = (x - 1) & wMask;
        const xp1 = (x + 1) & wMask;
        const xm2 = (x - r2) & wMask;
        const xp2 = (x + r2) & wMask;

        // Octave 1: 1px 3x3 Sobel (micro-grain & razor cracks)
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

        // Octave 2: bevel 3x3 Sobel (chipped stone chamfers & deep mortar seams)
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

        // Octave 3: fast 4-tap central difference for broad 3D stone pillowing (only 4 reads!)
        let dx = dx1 * microStrength + dx2 * bevelStrength;
        let dy = dy1 * microStrength + dy2 * bevelStrength;
        if (hasSculpt) {
          const xm3 = (x - r3) & wMask;
          const xp3 = (x + r3) & wMask;
          dx += (heightData[y0 + xp3] - heightData[y0 + xm3]) * (4.0 * sculptStrength);
          dy += (heightData[yp3 + x] - heightData[ym3 + x]) * (4.0 * sculptStrength);
        }

        let nx = -dx;
        let ny =  dy;
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
      const ym1 = (repeatY ? ((y - 1) & hMask) : (y > 0 ? y - 1 : 0)) * width;
      const y0  = y * width;
      const yp1 = (repeatY ? ((y + 1) & hMask) : (y < hMax ? y + 1 : hMax)) * width;
      const ym2 = (repeatY ? ((y - r2) & hMask) : (y >= r2 ? y - r2 : 0)) * width;
      const yp2 = (repeatY ? ((y + r2) & hMask) : (y + r2 <= hMax ? y + r2 : hMax)) * width;
      const ym3 = (repeatY ? ((y - r3) & hMask) : (y >= r3 ? y - r3 : 0)) * width;
      const yp3 = (repeatY ? ((y + r3) & hMask) : (y + r3 <= hMax ? y + r3 : hMax)) * width;
      const dstRow = (hMax - y) * width;

      for (let x = 0; x < width; x++) {
        const xm1 = repeat ? ((x - 1) & wMask) : (x > 0 ? x - 1 : 0);
        const xp1 = repeat ? ((x + 1) & wMask) : (x < wMax ? x + 1 : wMax);
        const xm2 = repeat ? ((x - r2) & wMask) : (x >= r2 ? x - r2 : 0);
        const xp2 = repeat ? ((x + r2) & wMask) : (x + r2 <= wMax ? x + r2 : wMax);

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

        let dx = dx1 * microStrength + dx2 * bevelStrength;
        let dy = dy1 * microStrength + dy2 * bevelStrength;
        if (hasSculpt) {
          const xm3 = repeat ? ((x - r3) & wMask) : (x >= r3 ? x - r3 : 0);
          const xp3 = repeat ? ((x + r3) & wMask) : (x + r3 <= wMax ? x + r3 : wMax);
          dx += (heightData[y0 + xp3] - heightData[y0 + xm3]) * (4.0 * sculptStrength);
          dy += (heightData[yp3 + x] - heightData[ym3 + x]) * (4.0 * sculptStrength);
        }

        let nx = -dx;
        let ny =  dy;
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
  tex.channel = 0;
  tex.flipY = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Build a packed ORM DataTexture:
//   - R channel (.r) = Physical Ambient Occlusion (read by MeshStandardMaterial.aoMap!)
//   - G channel (.g) = Physical Roughness (read by MeshStandardMaterial.roughnessMap!)
//   - B channel (.b) = Roughness mirror for clean visual inspection
function buildOrmMapFromFields(aoData, roughData, width, height, anisotropy, repeat = true, repeatY = repeat) {
  const data = new Uint8Array(width * height * 4);
  const hMax = height - 1;
  for (let y = 0; y < height; y++) {
    const srcRow = y * width;
    const dstRow = (hMax - y) * width;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x;
      const ao = aoData ? clamp01(aoData[si]) : 1.0;
      const rgh = clamp01(roughData[si]);
      const aoByte  = (ao * 255 + 0.5) | 0;
      const rghByte = (rgh * 255 + 0.5) | 0;
      const idx = (dstRow + x) * 4;
      data[idx]     = aoByte;  // .r -> aoMap
      data[idx + 1] = rghByte; // .g -> roughnessMap
      data[idx + 2] = rghByte;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.channel = 0;
  tex.flipY = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

// Build a weathered, deeply chipped 12-vertex stone polygon + irregular inner chamfer polygon
function buildChippedStonePolygon(x, y, w, h, scale, rand, chipChance = 0.78) {
  const bevel = Math.min(w, h) * 0.092;
  const jit = (amp) => (rand() - 0.5) * amp * scale;

  const basePts = [
    [x + bevel + jit(2.8),     y + jit(2.4)],
    [x + w * 0.5 + jit(3.4),   y + jit(2.8)],
    [x + w - bevel + jit(2.8), y + jit(2.4)],
    [x + w + jit(2.4),         y + bevel + jit(2.8)],
    [x + w + jit(2.8),         y + h * 0.5 + jit(3.4)],
    [x + w + jit(2.4),         y + h - bevel + jit(2.8)],
    [x + w - bevel + jit(2.8), y + h + jit(2.4)],
    [x + w * 0.5 + jit(3.4),   y + h + jit(2.8)],
    [x + bevel + jit(2.8),     y + h + jit(2.4)],
    [x + jit(2.4),             y + h - bevel + jit(2.8)],
    [x + jit(2.8),             y + h * 0.5 + jit(3.4)],
    [x + jit(2.4),             y + bevel + jit(2.8)]
  ];

  const cx = x + w * 0.5;
  const cy = y + h * 0.5;

  // Carve 1-3 realistic concave spall chips inward so stone bevels look hand-split & ancient
  const chips = [];
  if (rand() < chipChance) {
    const chipCount = 1 + Math.floor(rand() * 2.4);
    for (let k = 0; k < chipCount; k++) {
      const idx = Math.floor(rand() * basePts.length);
      const pt = basePts[idx];
      const dx = cx - pt[0];
      const dy = cy - pt[1];
      const d = Math.hypot(dx, dy) || 1;
      const cut = (4.6 + rand() * 7.4) * scale;
      const chipX = pt[0] + (dx / d) * cut;
      const chipY = pt[1] + (dy / d) * cut;
      pt[0] = chipX;
      pt[1] = chipY;
      chips.push({ x: chipX, y: chipY, r: cut * 1.05 });
    }
  }

  // Irregular inner chamfer shoulder polygon (gives non-uniform hand-chiseled bevel width!)
  const innerPts = new Array(basePts.length);
  for (let i = 0; i < basePts.length; i++) {
    const px = basePts[i][0];
    const py = basePts[i][1];
    const dx = cx - px;
    const dy = cy - py;
    const d = Math.hypot(dx, dy) || 1;
    const inset = (4.2 + rand() * 4.8) * scale;
    innerPts[i] = [px + (dx / d) * inset, py + (dy / d) * inset];
  }

  return { pts: basePts, innerPts, chips };
}

function tracePolyPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// ============================================================================
// 1. Gothic Flagstone Floor 2K PBR Set (2048px PC / 512px Mobile)
//    Deep sculpted stone bevels, chipped chamfers, deep mortar AO (.r),
//    calibrated anti-shimmer roughness (.g: 0.64..0.92 — soft satin worn stone
//    centers vs matte dry mortar, ZERO blinding pixel glitter!).
// ============================================================================
function createFlagstonePbrSet(size, anisotropy, sharedHeightCanvas) {
  const albedoCanvas = createCanvas2D(size, size);
  const heightCanvas = sharedHeightCanvas || createCanvas2D(size, size);
  if (!albedoCanvas || !heightCanvas) {
    const fbOrm = createFallbackTexture(220, 200, 200, 255, false, THREE.RepeatWrapping, anisotropy);
    return {
      albedo: createFallbackTexture(56, 60, 72, 255, true, THREE.RepeatWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.RepeatWrapping, anisotropy),
      roughness: fbOrm,
      ao: fbOrm
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const hctx = getFastCtx2D(heightCanvas, true);
  const scale = size / 512;
  const rand = makeRng(261337);

  // Deep recessed packed-ash & dark mortar bed (height ~0.025 -> ultra-deep mortar channel!)
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#060606';
  hctx.fillRect(0, 0, size, size);

  // Noble dark-gothic slate, basalt & weathered granite palette (zero garish saturation)
  const stoneTones = [
    [54, 59, 72],   // cold moonlit slate
    [46, 50, 62],   // deep gothic basalt
    [64, 66, 78],   // weathered ash-granite
    [57, 55, 66],   // soot-kissed granite
    [43, 47, 58],   // dark catacomb flagstone
    [68, 71, 82],   // worn silver-slate
    [51, 55, 65]    // damp ironstone
  ];

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
      const mortarGap = (4.0 + rand() * 1.6) * scale;
      const x = cursorX + mortarGap;
      const y = r * rowH + mortarGap;
      const w = cellW - mortarGap * 2;
      const h = rowH - mortarGap * 2;
      cursorX += cellW;

      const tone = stoneTones[Math.floor(rand() * stoneTones.length)];
      const shift = Math.floor((rand() - 0.5) * 18);
      const red = Math.max(24, Math.min(108, tone[0] + shift));
      const grn = Math.max(24, Math.min(108, tone[1] + shift));
      const blu = Math.max(30, Math.min(122, tone[2] + shift));

      const { pts, innerPts, chips } = buildChippedStonePolygon(x, y, w, h, scale, rand, 0.80);

      const faceH = Math.round(176 + rand() * 64);
      const tiltDir = rand() * Math.PI * 2;
      const tiltSpan = Math.round(18 + rand() * 20);
      const gradAngle = rand() * Math.PI * 2;
      const cx = x + w * 0.5;
      const cy = y + h * 0.5;
      const rad = Math.max(w, h) * 0.56;

      // Stone pitting clusters (strictly interior -> zero expensive ctx.clip() needed!)
      const pits = [];
      const pitCount = 10 + Math.floor(rand() * 8);
      for (let s = 0; s < pitCount; s++) {
        pits.push({
          x: x + 9 * scale + rand() * Math.max(4, w - 18 * scale),
          y: y + 9 * scale + rand() * Math.max(4, h - 18 * scale),
          rx: (0.9 + rand() * 3.2) * scale,
          ry: (0.7 + rand() * 2.2) * scale,
          rot: rand() * Math.PI,
          bright: rand() > 0.70,
          depth: Math.round(20 + rand() * 58)
        });
      }

      // Branching jagged structural fractures on ~58% of slabs
      const crackPaths = [];
      if (rand() < 0.58) {
        const horiz = rand() < 0.42;
        let px = horiz ? x + 4 * scale : x + w * (0.18 + rand() * 0.64);
        let py = horiz ? y + h * (0.20 + rand() * 0.60) : y + 4 * scale;
        const mainPts = [[px, py]];
        const segs = 5 + Math.floor(rand() * 3);
        for (let k = 1; k <= segs; k++) {
          if (horiz) {
            px = Math.min(x + w - 3 * scale, px + (w / segs) * (0.80 + rand() * 0.34));
            py = Math.max(y + 4 * scale, Math.min(y + h - 4 * scale, py + (rand() - 0.5) * 15 * scale));
          } else {
            px = Math.max(x + 4 * scale, Math.min(x + w - 4 * scale, px + (rand() - 0.5) * 16 * scale));
            py = Math.min(y + h - 3 * scale, py + (h / segs) * (0.80 + rand() * 0.34));
          }
          mainPts.push([px, py]);
        }
        crackPaths.push({ pts: mainPts, lw: (1.5 + rand() * 0.75) * scale, depth: 10 });

        if (rand() < 0.76) {
          const bStart = mainPts[1 + Math.floor(rand() * Math.max(1, mainPts.length - 2))];
          let bx = bStart[0];
          let by = bStart[1];
          const bAng = rand() * Math.PI * 2;
          const bPts = [[bx, by]];
          for (let bk = 0; bk < 3; bk++) {
            const step = (7 + rand() * 11) * scale;
            bx = Math.max(x + 4 * scale, Math.min(x + w - 4 * scale, bx + Math.cos(bAng + (rand() - 0.5) * 0.85) * step));
            by = Math.max(y + 4 * scale, Math.min(y + h - 4 * scale, by + Math.sin(bAng + (rand() - 0.5) * 0.85) * step));
            bPts.push([bx, by]);
          }
          crackPaths.push({ pts: bPts, lw: 0.95 * scale, depth: 26 });
        }
      }

      const hasVein = rand() < 0.46;
      const veinPts = hasVein ? [
        [x + 8 * scale + rand() * w * 0.22, y + 8 * scale + rand() * Math.max(4, h - 16 * scale)],
        [x + w * (0.4 + rand() * 0.2), y + 8 * scale + rand() * Math.max(4, h - 16 * scale)],
        [x + w * (0.72 + rand() * 0.20), y + 8 * scale + rand() * Math.max(4, h - 16 * scale)]
      ] : null;

      const pad = 14 * scale;
      const minX = x - pad;
      const minY = y - pad;
      const maxX = x + w + pad;
      const maxY = y + h + pad;

      // Albedo pass (zero ctx.clip() -> blazing fast at 2048x2048!)
      drawWrappedFast(ctx, size, size, minX, minY, maxX, maxY, () => {
        // 1. Deep mortar crevice contact shadow
        tracePolyPath(ctx, pts);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(3, 4, 8, 0.86)';
        ctx.lineWidth = 7.6 * scale;
        ctx.stroke();

        // 2. Steep outer cut-stone chamfer wall
        ctx.fillStyle = `rgb(${Math.max(12, red - 24)}, ${Math.max(13, grn - 24)}, ${Math.max(16, blu - 21)})`;
        ctx.fill();

        // 3. Irregular hand-chiseled inner stone face
        tracePolyPath(ctx, innerPts);
        const gx0 = cx - Math.cos(gradAngle) * rad;
        const gy0 = cy - Math.sin(gradAngle) * rad;
        const gx1 = cx + Math.cos(gradAngle) * rad;
        const gy1 = cy + Math.sin(gradAngle) * rad;
        const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
        grad.addColorStop(0.0, `rgb(${Math.min(255, red + 15)}, ${Math.min(255, grn + 14)}, ${Math.min(255, blu + 17)})`);
        grad.addColorStop(0.55, `rgb(${red}, ${grn}, ${blu})`);
        grad.addColorStop(1.0, `rgb(${Math.max(14, red - 15)}, ${Math.max(14, grn - 14)}, ${Math.max(18, blu - 12)})`);
        ctx.fillStyle = grad;
        ctx.fill();

        // Crisp bevel shoulder highlight along inner chamfer ridge
        ctx.strokeStyle = 'rgba(204, 214, 238, 0.14)';
        ctx.lineWidth = Math.max(1.0, 1.5 * scale);
        ctx.stroke();

        if (veinPts) {
          ctx.strokeStyle = 'rgba(188, 198, 222, 0.07)';
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.moveTo(veinPts[0][0], veinPts[0][1]);
          ctx.quadraticCurveTo(veinPts[1][0], veinPts[1][1], veinPts[2][0], veinPts[2][1]);
          ctx.stroke();
        }

        for (let s = 0; s < pits.length; s++) {
          const p = pits[s];
          ctx.fillStyle = p.bright ? 'rgba(210, 220, 240, 0.075)' : 'rgba(7, 9, 14, 0.26)';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
          ctx.fill();
        }

        // Raw fractured stone chips on slab corners/edges
        for (let ci = 0; ci < chips.length; ci++) {
          const ch = chips[ci];
          const cg = ctx.createRadialGradient(ch.x, ch.y, 0.5 * scale, ch.x, ch.y, ch.r * 1.25);
          cg.addColorStop(0.0, 'rgba(18, 20, 28, 0.62)');
          cg.addColorStop(0.55, 'rgba(164, 174, 196, 0.20)');
          cg.addColorStop(1.0, 'rgba(12, 14, 20, 0.0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(ch.x, ch.y, ch.r * 1.25, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let cp = 0; cp < crackPaths.length; cp++) {
          const cObj = crackPaths[cp];
          const cpts = cObj.pts;
          ctx.strokeStyle = 'rgba(192, 204, 228, 0.14)';
          ctx.lineWidth = Math.max(1, cObj.lw * 0.85);
          ctx.beginPath();
          ctx.moveTo(cpts[0][0] + 1.0 * scale, cpts[0][1] + 0.8 * scale);
          for (let i = 1; i < cpts.length; i++) ctx.lineTo(cpts[i][0] + 1.0 * scale, cpts[i][1] + 0.8 * scale);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(5, 6, 10, 0.86)';
          ctx.lineWidth = Math.max(1, cObj.lw);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cpts[0][0], cpts[0][1]);
          for (let i = 1; i < cpts.length; i++) ctx.lineTo(cpts[i][0], cpts[i][1]);
          ctx.stroke();
        }
      });

      // Multi-stage sculptural Heightfield pass (2x deeper bevels + pillowed stone dome + chipped facets!)
      drawWrappedFast(hctx, size, size, minX, minY, maxX, maxY, () => {
        // Stage 1: Outer mortar-to-stone steep ramp
        tracePolyPath(hctx, pts);
        hctx.lineJoin = 'round';
        hctx.strokeStyle = 'rgb(42, 42, 42)';
        hctx.lineWidth = 6.8 * scale;
        hctx.stroke();

        // Stage 2: Angled chipped chamfer skirt
        const skirtH = Math.round(faceH * 0.52);
        hctx.fillStyle = `rgb(${skirtH},${skirtH},${skirtH})`;
        hctx.fill();

        // Stage 3: Inner raised stone table with planar tilt
        tracePolyPath(hctx, innerPts);
        const hx0 = cx - Math.cos(tiltDir) * rad;
        const hy0 = cy - Math.sin(tiltDir) * rad;
        const hx1 = cx + Math.cos(tiltDir) * rad;
        const hy1 = cy + Math.sin(tiltDir) * rad;
        const hHi = Math.min(244, faceH + tiltSpan);
        const hLo = Math.max(132, faceH - tiltSpan);
        const hGrad = hctx.createLinearGradient(hx0, hy0, hx1, hy1);
        hGrad.addColorStop(0, `rgb(${hHi},${hHi},${hHi})`);
        hGrad.addColorStop(1, `rgb(${hLo},${hLo},${hLo})`);
        hctx.fillStyle = hGrad;
        hctx.fill();

        // Intermediate bevel transition along inner chamfer shoulder
        const shoulderH = Math.round(faceH * 0.76);
        hctx.strokeStyle = `rgb(${shoulderH},${shoulderH},${shoulderH})`;
        hctx.lineWidth = 3.4 * scale;
        hctx.stroke();

        // Stage 4: Subtle 3D pillowed dome crown toward slab center (dramatic grazing light roll!)
        const domeR = Math.min(w, h) * 0.46;
        if (domeR > 4) {
          const dome = hctx.createRadialGradient(cx, cy, domeR * 0.08, cx, cy, domeR);
          dome.addColorStop(0.0, 'rgba(255, 255, 255, 0.22)');
          dome.addColorStop(0.65, 'rgba(255, 255, 255, 0.08)');
          dome.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
          hctx.fillStyle = dome;
          hctx.beginPath();
          hctx.arc(cx, cy, domeR, 0, Math.PI * 2);
          hctx.fill();
        }

        // Concave spall chip gouges
        for (let ci = 0; ci < chips.length; ci++) {
          const ch = chips[ci];
          const cg = hctx.createRadialGradient(ch.x, ch.y, 0.4 * scale, ch.x, ch.y, ch.r * 1.25);
          cg.addColorStop(0.0, 'rgba(18, 18, 18, 0.92)');
          cg.addColorStop(0.60, 'rgba(72, 72, 72, 0.50)');
          cg.addColorStop(1.0, 'rgba(140, 140, 140, 0.0)');
          hctx.fillStyle = cg;
          hctx.beginPath();
          hctx.arc(ch.x, ch.y, ch.r * 1.25, 0, Math.PI * 2);
          hctx.fill();
        }

        for (let s = 0; s < pits.length; s++) {
          const p = pits[s];
          hctx.fillStyle = `rgba(${p.depth},${p.depth},${p.depth},0.56)`;
          hctx.beginPath();
          hctx.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, Math.PI * 2);
          hctx.fill();
        }

        // Deeply incised fractures
        for (let cp = 0; cp < crackPaths.length; cp++) {
          const cObj = crackPaths[cp];
          const cpts = cObj.pts;
          const dVal = cObj.depth;
          hctx.strokeStyle = `rgb(${dVal},${dVal},${dVal})`;
          hctx.lineWidth = Math.max(1.3, cObj.lw * 1.65);
          hctx.lineCap = 'round';
          hctx.beginPath();
          hctx.moveTo(cpts[0][0], cpts[0][1]);
          for (let i = 1; i < cpts.length; i++) hctx.lineTo(cpts[i][0], cpts[i][1]);
          hctx.stroke();
        }
      });
    }
  }

  // LUT-accelerated 2K pixel pass: smooth anti-shimmer granite relief, deep mortar AO,
  // soft worn stone centers (0.64..0.72) vs weathered stone (0.74..0.86) vs matte mortar (0.88..0.92)!
  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;

  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);
  const aoData = new Float32Array(total);

  const noiseWet   = createTileableNoiseGrid(16, 9103);
  const noiseMid   = createTileableNoiseGrid(32, 9101);
  const noiseFine  = createTileableNoiseGrid(64, 9102);
  const noiseMicro = createTileableNoiseGrid(64, 9109); // smooth sub-Nyquist mineral grain (zero pixel glitter!)

  const lutWet   = buildNoiseAxisLUT(noiseWet, size, 2);
  const lutMoss  = buildNoiseAxisLUT(noiseMid, size, 4);
  const lutGrA   = buildNoiseAxisLUT(noiseMid, size, 4);
  const lutGrB   = buildNoiseAxisLUT(noiseFine, size, 6);
  const lutMicro = buildNoiseAxisLUT(noiseMicro, size, 8);

  const gWet   = noiseWet.grid;
  const gMid   = noiseMid.grid;
  const gFine  = noiseFine.grid;
  const gMicro = noiseMicro.grid;

  const invSize = 1 / size;
  const sWetY   = 2 * noiseWet.size * invSize;
  const sMossY  = 4 * noiseMid.size * invSize;
  const sGrAY   = 4 * noiseMid.size * invSize;
  const sGrBY   = 6 * noiseFine.size * invSize;
  const sMicroY = 8 * noiseMicro.size * invSize;

  const wX0 = lutWet.x0,   wX1 = lutWet.x1,   wSx = lutWet.sx;
  const mX0 = lutMoss.x0,  mX1 = lutMoss.x1,  mSx = lutMoss.sx;
  const aX0 = lutGrA.x0,   aX1 = lutGrA.x1,   aSx = lutGrA.sx;
  const bX0 = lutGrB.x0,   bX1 = lutGrB.x1,   bSx = lutGrB.sx;
  const qX0 = lutMicro.x0, qX1 = lutMicro.x1, qSx = lutMicro.sx;

  for (let y = 0; y < size; y++) {
    const y0 = y * size;
    const rw = sampleRowParams(noiseWet, y * sWetY);
    const rm = sampleRowParams(noiseMid, y * sMossY);
    const ra = sampleRowParams(noiseMid, y * sGrAY);
    const rb = sampleRowParams(noiseFine, y * sGrBY);
    const rq = sampleRowParams(noiseMicro, y * sMicroY);

    const wR0 = rw.r0, wR1 = rw.r1, wSy = rw.sy;
    const mR0 = rm.r0, mR1 = rm.r1, mSy = rm.sy;
    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;
    const qR0 = rq.r0, qR1 = rq.r1, qSy = rq.sy;

    for (let x = 0; x < size; x++) {
      const idx = y0 + x;
      const p4 = idx * 4;
      const baseH = hPix[p4] * (1 / 255);

      const ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const nA0 = gMid[aR0 + ax0] + (gMid[aR0 + ax1] - gMid[aR0 + ax0]) * asx;
      const nA1 = gMid[aR1 + ax0] + (gMid[aR1 + ax1] - gMid[aR1 + ax0]) * asx;
      const nA = nA0 + (nA1 - nA0) * aSy;

      const bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const nB0 = gFine[bR0 + bx0] + (gFine[bR0 + bx1] - gFine[bR0 + bx0]) * bsx;
      const nB1 = gFine[bR1 + bx0] + (gFine[bR1 + bx1] - gFine[bR1 + bx0]) * bsx;
      const nB = nB0 + (nB1 - nB0) * bSy;

      const qx0 = qX0[x], qx1 = qX1[x], qsx = qSx[x];
      const nQ0 = gMicro[qR0 + qx0] + (gMicro[qR0 + qx1] - gMicro[qR0 + qx0]) * qsx;
      const nQ1 = gMicro[qR1 + qx0] + (gMicro[qR1 + qx1] - gMicro[qR1 + qx0]) * qsx;
      const micro = nQ0 + (nQ1 - nQ0) * qSy;

      const grain = (nA * 0.56 + nB * 0.34 + micro * 0.10) - 0.5;
      const hVal = clamp01(baseH + grain * (baseH > 0.28 ? 0.115 : 0.065));
      heightData[idx] = hVal;

      // True physical Ambient Occlusion (.r channel): deep dark mortar & fracture cavities (0.10..0.24)
      // ramping smoothly up chipped chamfers to 1.00 on exposed stone crowns!
      let ao;
      if (baseH < 0.22) {
        ao = 0.10 + (baseH / 0.22) * 0.22;
      } else if (baseH < 0.62) {
        const t = (baseH - 0.22) * 2.5;
        ao = 0.32 + t * 0.54;
      } else {
        ao = 0.86 + ((baseH - 0.62) / 0.38) * 0.14;
      }
      if (grain < 0) ao += grain * 0.18;
      aoData[idx] = ao < 0.08 ? 0.08 : ao > 1.0 ? 1.0 : ao;

      const wx0 = wX0[x], wx1 = wX1[x], wsx = wSx[x];
      const nW0 = gWet[wR0 + wx0] + (gWet[wR0 + wx1] - gWet[wR0 + wx0]) * wsx;
      const nW1 = gWet[wR1 + wx0] + (gWet[wR1 + wx1] - gWet[wR1 + wx0]) * wsx;
      const wetMacro = nW0 + (nW1 - nW0) * wSy;

      const mx0 = mX0[x], mx1 = mX1[x], msx = mSx[x];
      const nM0 = gMid[mR0 + mx0] + (gMid[mR0 + mx1] - gMid[mR0 + mx0]) * msx;
      const nM1 = gMid[mR1 + mx0] + (gMid[mR1 + mx1] - gMid[mR1 + mx0]) * msx;
      const nM = nM0 + (nM1 - nM0) * mSy;

      // Subtle worn footpath & stone patina variation
      const wetField = wetMacro * 0.66 + nM * 0.34;
      const wetness = clamp01((wetField - 0.42) * 3.4);
      const wetSmooth = wetness * wetness * (3 - 2 * wetness);

      // Subtle dark-gothic crevice moss tucked strictly inside mortar edges
      const mortarMask = clamp01((0.44 - baseH) * 2.8);
      const mossAmount = mortarMask * clamp01((nM * 0.65 + nB * 0.35 - 0.36) * 2.5);

      let r = aPix[p4] * (1.0 + grain * 0.19);
      let g = aPix[p4 + 1] * (1.0 + grain * 0.19);
      let b = aPix[p4 + 2] * (1.0 + grain * 0.19);

      if (mossAmount > 0.01) {
        const m = mossAmount * 0.72;
        r = r + (32 + nB * 16 - r) * m;
        g = g + (54 + nB * 22 - g) * m;
        b = b + (24 + nB * 10 - b) * m;
      }

      // Gentle foot-worn stone patina darkening (zero glassy obsidian puddles)
      if (wetSmooth > 0.01 && baseH > 0.22) {
        const df = 1.0 - wetSmooth * 0.14;
        r *= df;
        g *= df;
        b *= df * 1.02;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      // Matte anti-shimmer flagstone roughness calibration [0.64..0.92]:
      //   - Dry recessed mortar & raw cracks -> matte 0.88..0.92
      //   - Dry weathered stone face         -> 0.74..0.86
      //   - Worn stone slab centers          -> 0.64..0.72 (soft velvety satin, ZERO pixel glitter!)
      let rough;
      if (baseH < 0.28) {
        rough = 0.89 + (0.14 - baseH) * 0.14 + grain * 0.03;
      } else {
        const polish = clamp01((baseH - 0.52) * 2.2);
        const dryStone = 0.85 - polish * 0.10 + grain * 0.08;
        const wornStone = 0.71 - polish * 0.065 + grain * 0.04;
        rough = dryStone + (wornStone - dryStone) * wetSmooth;
        if (mossAmount > 0.01) {
          rough = rough + (0.91 - rough) * (mossAmount * 0.88);
        }
      }
      roughData[idx] = rough < 0.64 ? 0.64 : rough > 0.92 ? 0.92 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: true, anisotropy });
  // Balanced anti-shimmer 3-octave normal map (smooth micro, deep carved bevels & 3D stone crown!)
  const normal = buildNormalMapFromHeight(heightData, size, size, 0.95, 1.85, 0.88, anisotropy, true);
  const orm = buildOrmMapFromFields(aoData, roughData, size, size, anisotropy, true);

  return { albedo, normal, roughness: orm, ao: orm };
}

// ============================================================================
// 2. Carved Gothic Ashlar Stone 2K PBR Set (2048px PC / 512px Mobile)
//    Lifted warm charcoal-slate midtones (+18% vs dark walls), dressed bevels,
//    chipped corners, smooth anti-shimmer normal relief, deep mortar AO (.r)
//    & authentic matte weathered medieval stonework roughness (.g: 0.74..0.96).
// ============================================================================
function createAshlarPbrSet(size, anisotropy, sharedHeightCanvas) {
  const albedoCanvas = createCanvas2D(size, size);
  const heightCanvas = sharedHeightCanvas || createCanvas2D(size, size);
  if (!albedoCanvas || !heightCanvas) {
    const fbOrm = createFallbackTexture(220, 218, 218, 255, false, THREE.RepeatWrapping, anisotropy);
    return {
      albedo: createFallbackTexture(158, 159, 165, 255, true, THREE.RepeatWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.RepeatWrapping, anisotropy),
      roughness: fbOrm,
      ao: fbOrm
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const hctx = getFastCtx2D(heightCanvas, true);
  const scale = size / 512;
  const rand = makeRng(268811);

  ctx.fillStyle = '#252936';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#222222';
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

      // Balanced weathered gothic stonework midtones (eliminates harsh glossy LEGO-brick contrast!)
      const lum = 136 + Math.floor((rand() - 0.5) * 26);
      const warmCool = Math.floor((rand() - 0.52) * 12);
      const faceH = Math.round(176 + rand() * 44);
      const cx = x + w * 0.5;
      const cy = y + h * 0.5;

      const cornerCut = 3.2 * scale;
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

      // Chipped dressed chamfer inset polygon
      const bevelInset = (4.2 + rand() * 2.2) * scale;
      const innerPts = [
        [x + bevelInset + cornerCut * 0.6, y + bevelInset],
        [x + w - bevelInset - cornerCut * 0.6, y + bevelInset],
        [x + w - bevelInset, y + bevelInset + cornerCut * 0.6],
        [x + w - bevelInset, y + h - bevelInset - cornerCut * 0.6],
        [x + w - bevelInset - cornerCut * 0.6, y + h - bevelInset],
        [x + bevelInset + cornerCut * 0.6, y + h - bevelInset],
        [x + bevelInset, y + h - bevelInset - cornerCut * 0.6],
        [x + bevelInset, y + bevelInset + cornerCut * 0.6]
      ];

      // Chipped spall notches on ~52% of ashlar blocks
      const chips = [];
      if (rand() < 0.52) {
        const cCount = rand() < 0.35 ? 2 : 1;
        for (let ci = 0; ci < cCount; ci++) {
          const edge = Math.floor(rand() * 4);
          const t = 0.16 + rand() * 0.68;
          const chipX = edge === 0 || edge === 2 ? x + w * t : (edge === 1 ? x + w - 2 * scale : x + 2 * scale);
          const chipY = edge === 1 || edge === 3 ? y + h * t : (edge === 0 ? y + 2 * scale : y + h - 2 * scale);
          chips.push({ x: chipX, y: chipY, r: (3.8 + rand() * 5.8) * scale });
        }
      }

      // Mason claw-chisel tool striations (strictly interior)
      const chisels = [];
      const chiselCount = 8 + Math.floor(rand() * 6);
      const slant = (rand() - 0.5) * 4.8 * scale;
      for (let t = 0; t < chiselCount; t++) {
        const ty = y + 6 * scale + rand() * Math.max(4, h * 0.54);
        const len = Math.min(h - (ty - y) - 5 * scale, (8 + rand() * 18) * scale);
        if (len > 3 * scale) {
          chisels.push({
            x: x + 7 * scale + rand() * Math.max(4, w - 14 * scale),
            y: ty,
            len,
            dx: slant + (rand() - 0.5) * 1.4 * scale,
            light: rand() > 0.50
          });
        }
      }

      let crackPts = null;
      if (rand() < 0.38) {
        let kx = x + w * (0.2 + rand() * 0.6);
        let ky = y + 3 * scale;
        crackPts = [[kx, ky]];
        for (let s = 0; s < 3; s++) {
          kx = Math.max(x + 5 * scale, Math.min(x + w - 5 * scale, kx + (rand() - 0.5) * 12 * scale));
          ky = Math.min(y + h - 3 * scale, ky + h * 0.28);
          crackPts.push([kx, ky]);
        }
      }

      const pad = 10 * scale;
      const minX = x - pad;
      const minY = y - pad;
      const maxX = x + w + pad;
      const maxY = y + h + pad;

      drawWrappedFast(ctx, size, size, minX, minY, maxX, maxY, () => {
        tracePolyPath(ctx, pts);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(14, 17, 25, 0.62)';
        ctx.lineWidth = 4.2 * scale;
        ctx.stroke();

        // Subtle dressed chamfer rim (organic weathered stone transition)
        ctx.fillStyle = `rgb(${Math.max(54, lum - 16)}, ${Math.max(54, lum - 16)}, ${Math.max(58, lum - 13 + warmCool)})`;
        ctx.fill();

        // Weathered medieval ashlar face (soft tonal gradient without bright plastic top highlights)
        tracePolyPath(ctx, innerPts);
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0.0, `rgb(${Math.min(220, lum + 8)}, ${Math.min(220, lum + 8)}, ${Math.min(224, lum + 9 + warmCool)})`);
        grad.addColorStop(0.5, `rgb(${Math.min(216, lum + 1)}, ${Math.min(216, lum + 1)}, ${Math.min(220, lum + 3 + warmCool)})`);
        grad.addColorStop(1.0, `rgb(${Math.max(60, lum - 11)}, ${Math.max(60, lum - 11)}, ${Math.max(64, lum - 9 + warmCool)})`);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(218, 222, 232, 0.055)';
        ctx.lineWidth = Math.max(0.9, 1.2 * scale);
        ctx.stroke();

        for (let t = 0; t < chisels.length; t++) {
          const chMark = chisels[t];
          ctx.strokeStyle = chMark.light ? 'rgba(245, 244, 240, 0.07)' : 'rgba(18, 20, 26, 0.14)';
          ctx.lineWidth = Math.max(1.0, 1.4 * scale);
          ctx.beginPath();
          ctx.moveTo(chMark.x, chMark.y);
          ctx.lineTo(chMark.x + chMark.dx, chMark.y + chMark.len);
          ctx.stroke();
        }

        for (let ci = 0; ci < chips.length; ci++) {
          const cp = chips[ci];
          const cg = ctx.createRadialGradient(cp.x, cp.y, 0.6 * scale, cp.x, cp.y, cp.r * 1.3);
          cg.addColorStop(0.0, 'rgba(20, 23, 32, 0.76)');
          cg.addColorStop(0.55, 'rgba(196, 202, 218, 0.20)');
          cg.addColorStop(1.0, 'rgba(120, 126, 140, 0.0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, cp.r * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }

        if (crackPts) {
          ctx.strokeStyle = 'rgba(235, 240, 252, 0.13)';
          ctx.lineWidth = Math.max(0.9, 1.1 * scale);
          ctx.beginPath();
          ctx.moveTo(crackPts[0][0] + 1.0 * scale, crackPts[0][1] + 0.8 * scale);
          for (let i = 1; i < crackPts.length; i++) ctx.lineTo(crackPts[i][0] + 1.0 * scale, crackPts[i][1] + 0.8 * scale);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(8, 10, 16, 0.76)';
          ctx.lineWidth = Math.max(1.0, 1.5 * scale);
          ctx.beginPath();
          ctx.moveTo(crackPts[0][0], crackPts[0][1]);
          for (let i = 1; i < crackPts.length; i++) ctx.lineTo(crackPts[i][0], crackPts[i][1]);
          ctx.stroke();
        }
      });

      drawWrappedFast(hctx, size, size, minX, minY, maxX, maxY, () => {
        tracePolyPath(hctx, pts);
        hctx.lineJoin = 'round';
        hctx.strokeStyle = 'rgb(68, 68, 68)';
        hctx.lineWidth = 4.2 * scale;
        hctx.stroke();

        const skirtH = Math.round(faceH * 0.66);
        hctx.fillStyle = `rgb(${skirtH},${skirtH},${skirtH})`;
        hctx.fill();

        tracePolyPath(hctx, innerPts);
        const hGrad = hctx.createLinearGradient(x, y, x, y + h);
        hGrad.addColorStop(0.0, `rgb(${Math.min(238, faceH + 7)},${Math.min(238, faceH + 7)},${Math.min(238, faceH + 7)})`);
        hGrad.addColorStop(1.0, `rgb(${Math.max(136, faceH - 8)},${Math.max(136, faceH - 8)},${Math.max(136, faceH - 8)})`);
        hctx.fillStyle = hGrad;
        hctx.fill();

        const shoulderH = Math.round(faceH * 0.84);
        hctx.strokeStyle = `rgb(${shoulderH},${shoulderH},${shoulderH})`;
        hctx.lineWidth = 2.4 * scale;
        hctx.stroke();

        // Subtle hand-dressed stone face undulation (eliminates puffy plastic LEGO-brick cushions!)
        const domeR = Math.min(w, h) * 0.48;
        if (domeR > 4) {
          const dome = hctx.createRadialGradient(cx, cy, domeR * 0.1, cx, cy, domeR);
          dome.addColorStop(0.0, 'rgba(255, 255, 255, 0.09)');
          dome.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
          hctx.fillStyle = dome;
          hctx.beginPath();
          hctx.arc(cx, cy, domeR, 0, Math.PI * 2);
          hctx.fill();
        }

        for (let t = 0; t < chisels.length; t++) {
          const chMark = chisels[t];
          hctx.strokeStyle = chMark.light ? 'rgba(222, 222, 222, 0.18)' : 'rgba(118, 118, 118, 0.26)';
          hctx.lineWidth = Math.max(1.2, 1.7 * scale);
          hctx.beginPath();
          hctx.moveTo(chMark.x, chMark.y);
          hctx.lineTo(chMark.x + chMark.dx, chMark.y + chMark.len);
          hctx.stroke();
        }

        for (let ci = 0; ci < chips.length; ci++) {
          const cp = chips[ci];
          const cg = hctx.createRadialGradient(cp.x, cp.y, 0.5 * scale, cp.x, cp.y, cp.r * 1.3);
          cg.addColorStop(0.0, 'rgba(18, 18, 18, 0.92)');
          cg.addColorStop(0.6, 'rgba(84, 84, 84, 0.48)');
          cg.addColorStop(1.0, 'rgba(165, 165, 165, 0.0)');
          hctx.fillStyle = cg;
          hctx.beginPath();
          hctx.arc(cp.x, cp.y, cp.r * 1.3, 0, Math.PI * 2);
          hctx.fill();
        }

        if (crackPts) {
          hctx.strokeStyle = 'rgb(18, 18, 18)';
          hctx.lineWidth = Math.max(1.2, 2.3 * scale);
          hctx.beginPath();
          hctx.moveTo(crackPts[0][0], crackPts[0][1]);
          for (let i = 1; i < crackPts.length; i++) hctx.lineTo(crackPts[i][0], crackPts[i][1]);
          hctx.stroke();
        }
      });
    }
  }

  // Seamless vertical rain-runoff & soot weathering streaks (subtle so walls stay legible!)
  for (let i = 0; i < 24; i++) {
    const sx = rand() * size;
    const sw = (7 + rand() * 19) * scale;
    const alphaTop = 0.09 + rand() * 0.09;
    const alphaMid = 0.02 + rand() * 0.03;
    drawWrappedFast(ctx, size, size, sx - sw, 0, sx + sw, size, () => {
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0.0, `rgba(18, 20, 26, ${alphaTop.toFixed(3)})`);
      g.addColorStop(0.45, `rgba(22, 24, 30, ${alphaMid.toFixed(3)})`);
      g.addColorStop(1.0, `rgba(18, 20, 26, ${alphaTop.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(sx, 0, sw, size);
    });
  }

  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;

  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);
  const aoData = new Float32Array(total);

  const noiseSeep  = createTileableNoiseGrid(16, 8203);
  const noiseA     = createTileableNoiseGrid(32, 8201);
  const noiseB     = createTileableNoiseGrid(64, 8202);
  const noiseMicro = createTileableNoiseGrid(64, 8209); // smooth anti-shimmer mineral texture (no Nyquist aliasing!)

  const lutSeep  = buildNoiseAxisLUT(noiseSeep, size, 4);
  const lutGrA   = buildNoiseAxisLUT(noiseA, size, 4);
  const lutGrB   = buildNoiseAxisLUT(noiseB, size, 5);
  const lutMicro = buildNoiseAxisLUT(noiseMicro, size, 7);

  const gSeep  = noiseSeep.grid;
  const gA     = noiseA.grid;
  const gB     = noiseB.grid;
  const gMicro = noiseMicro.grid;

  const invSize = 1 / size;
  const sSeepY  = 1 * noiseSeep.size * invSize;
  const sGrAY   = 4 * noiseA.size * invSize;
  const sGrBY   = 5 * noiseB.size * invSize;
  const sMicroY = 7 * noiseMicro.size * invSize;

  const sX0 = lutSeep.x0,  sX1 = lutSeep.x1,  sSx = lutSeep.sx;
  const aX0 = lutGrA.x0,   aX1 = lutGrA.x1,   aSx = lutGrA.sx;
  const bX0 = lutGrB.x0,   bX1 = lutGrB.x1,   bSx = lutGrB.sx;
  const qX0 = lutMicro.x0, qX1 = lutMicro.x1, qSx = lutMicro.sx;

  for (let y = 0; y < size; y++) {
    const y0 = y * size;
    const rs = sampleRowParams(noiseSeep, y * sSeepY);
    const ra = sampleRowParams(noiseA, y * sGrAY);
    const rb = sampleRowParams(noiseB, y * sGrBY);
    const rq = sampleRowParams(noiseMicro, y * sMicroY);

    const sR0 = rs.r0, sR1 = rs.r1, sSy = rs.sy;
    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;
    const qR0 = rq.r0, qR1 = rq.r1, qSy = rq.sy;

    for (let x = 0; x < size; x++) {
      const idx = y0 + x;
      const p4 = idx * 4;
      const baseH = hPix[p4] * (1 / 255);

      const ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const nA0 = gA[aR0 + ax0] + (gA[aR0 + ax1] - gA[aR0 + ax0]) * asx;
      const nA1 = gA[aR1 + ax0] + (gA[aR1 + ax1] - gA[aR1 + ax0]) * asx;
      const nA = nA0 + (nA1 - nA0) * aSy;

      const bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const nB0 = gB[bR0 + bx0] + (gB[bR0 + bx1] - gB[bR0 + bx0]) * bsx;
      const nB1 = gB[bR1 + bx0] + (gB[bR1 + bx1] - gB[bR1 + bx0]) * bsx;
      const nB = nB0 + (nB1 - nB0) * bSy;

      const qx0 = qX0[x], qx1 = qX1[x], qsx = qSx[x];
      const nQ0 = gMicro[qR0 + qx0] + (gMicro[qR0 + qx1] - gMicro[qR0 + qx0]) * qsx;
      const nQ1 = gMicro[qR1 + qx0] + (gMicro[qR1 + qx1] - gMicro[qR1 + qx0]) * qsx;
      const micro = nQ0 + (nQ1 - nQ0) * qSy;

      const sx0 = sX0[x], sx1 = sX1[x], ssx = sSx[x];
      const nS0 = gSeep[sR0 + sx0] + (gSeep[sR0 + sx1] - gSeep[sR0 + sx0]) * ssx;
      const nS1 = gSeep[sR1 + sx0] + (gSeep[sR1 + sx1] - gSeep[sR1 + sx0]) * ssx;
      const seepN = nS0 + (nS1 - nS0) * sSy;

      const grain = (nA * 0.58 + nB * 0.32 + micro * 0.10) - 0.5;
      heightData[idx] = clamp01(baseH + grain * (baseH > 0.30 ? 0.095 : 0.055));

      // Physical Ashlar Mortar & Bevel AO (.r)
      let ao;
      if (baseH < 0.22) {
        ao = 0.12 + (baseH / 0.22) * 0.23;
      } else if (baseH < 0.60) {
        ao = 0.35 + ((baseH - 0.22) / 0.38) * 0.51;
      } else {
        ao = 0.86 + ((baseH - 0.60) / 0.40) * 0.14;
      }
      if (grain < 0) ao += grain * 0.14;
      aoData[idx] = ao < 0.10 ? 0.10 : ao > 1.0 ? 1.0 : ao;

      const seep = clamp01((seepN - 0.46) * 2.9);
      const seepSmooth = seep * seep * (3 - 2 * seep);
      const mortarMask = clamp01((0.40 - baseH) * 2.9);
      const moss = mortarMask * clamp01((nA - 0.42) * 2.4);

      let r = aPix[p4] * (1.0 + grain * 0.15);
      let g = aPix[p4 + 1] * (1.0 + grain * 0.15);
      let b = aPix[p4 + 2] * (1.0 + grain * 0.15);

      if (moss > 0.01) {
        const m = moss * 0.52;
        r = r + (54 + nB * 16 - r) * m;
        g = g + (80 + nB * 20 - g) * m;
        b = b + (44 + nB * 12 - b) * m;
      }

      if (seepSmooth > 0.01 && baseH > 0.26) {
        const df = 1.0 - seepSmooth * 0.10;
        r *= df;
        g *= df;
        b *= df;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      // Authentic matte weathered medieval gothic stonework roughness [0.84..0.98] — zero glossy brick bevel glare!
      let rough;
      if (baseH < 0.28) {
        rough = 0.96 + (0.14 - baseH) * 0.06 + grain * 0.03;
      } else {
        const wear = clamp01((baseH - 0.58) * 2.2);
        const dryR = 0.94 - wear * 0.05 + grain * 0.05;
        const dampR = 0.87 - wear * 0.04 + grain * 0.04;
        rough = dryR + (dampR - dryR) * seepSmooth;
        if (moss > 0.01) rough = rough + (0.97 - rough) * (moss * 0.85);
      }
      roughData[idx] = rough < 0.84 ? 0.84 : rough > 0.98 ? 0.98 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: true, anisotropy });
  // Natural weathered ashlar relief without exaggerated glossy brick bevels
  const normal = buildNormalMapFromHeight(heightData, size, size, 0.56, 0.94, 0.68, anisotropy, true);
  const orm = buildOrmMapFromFields(aoData, roughData, size, size, anisotropy, true);

  return { albedo, normal, roughness: orm, ao: orm };
}

// ============================================================================
// 3. Dark Soot-Stained Cathedral Vault Stone 2K Set (2048px PC / 512px Mobile)
//    Exported as vaultStoneAlbedo + vaultStoneNormal + vaultStoneRoughness + vaultStoneAo.
// ============================================================================
function createVaultStonePbrSet(size, anisotropy, sharedHeightCanvas) {
  const albedoCanvas = createCanvas2D(size, size);
  const heightCanvas = sharedHeightCanvas || createCanvas2D(size, size);
  if (!albedoCanvas || !heightCanvas) {
    const fbOrm = createFallbackTexture(210, 200, 200, 255, false, THREE.RepeatWrapping, anisotropy);
    return {
      albedo: createFallbackTexture(80, 82, 94, 255, true, THREE.RepeatWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.RepeatWrapping, anisotropy),
      roughness: fbOrm,
      ao: fbOrm
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const hctx = getFastCtx2D(heightCanvas, true);
  const scale = size / 512;
  const rand = makeRng(264499);

  ctx.fillStyle = '#0a0b10';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#070707';
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
      const joint = (isRibCourse ? 3.0 : 2.5) * scale;
      const x = cursorX + joint;
      const y = r * ch + joint;
      const w = cellW - joint * 2;
      const h = ch - joint * 2;
      cursorX += cellW;

      const baseLum = (isRibCourse ? 102 : 84) + Math.floor((rand() - 0.5) * 26);
      const sootWarm = Math.floor((rand() - 0.5) * 10);
      const faceH = Math.round((isRibCourse ? 218 : 172) + rand() * 38);

      const cornerCut = 2.4 * scale;
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

      const inset = 3.6 * scale;
      const innerPts = [
        [x + inset, y + inset],
        [x + w - inset, y + inset],
        [x + w - inset, y + h - inset],
        [x + inset, y + h - inset]
      ];

      let crackPts = null;
      if (!isRibCourse && rand() < 0.32) {
        let kx = x + w * (0.2 + rand() * 0.6);
        let ky = y + 3 * scale;
        crackPts = [
          [kx, ky],
          [Math.max(x + 4 * scale, Math.min(x + w - 4 * scale, kx + (rand() - 0.5) * 10 * scale)), ky + h * 0.44],
          [Math.max(x + 4 * scale, Math.min(x + w - 4 * scale, kx + (rand() - 0.5) * 14 * scale)), y + h - 3 * scale]
        ];
      }

      const pad = 8 * scale;
      const minX = x - pad;
      const minY = y - pad;
      const maxX = x + w + pad;
      const maxY = y + h + pad;

      drawWrappedFast(ctx, size, size, minX, minY, maxX, maxY, () => {
        tracePolyPath(ctx, pts);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(4, 5, 8, 0.88)';
        ctx.lineWidth = 5.8 * scale;
        ctx.stroke();

        ctx.fillStyle = `rgb(${Math.max(22, baseLum - 28)}, ${Math.max(22, baseLum - 27)}, ${Math.max(26, baseLum - 22 + sootWarm)})`;
        ctx.fill();

        tracePolyPath(ctx, innerPts);
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0.0, `rgb(${baseLum + 11}, ${baseLum + 11}, ${baseLum + 17 + sootWarm})`);
        grad.addColorStop(0.55, `rgb(${baseLum - 2}, ${baseLum - 2}, ${baseLum + 4 + sootWarm})`);
        grad.addColorStop(1.0, `rgb(${Math.max(26, baseLum - 22)}, ${Math.max(26, baseLum - 21)}, ${Math.max(32, baseLum - 15 + sootWarm)})`);
        ctx.fillStyle = grad;
        ctx.fill();

        if (isRibCourse) {
          ctx.strokeStyle = 'rgba(8, 9, 14, 0.56)';
          ctx.lineWidth = 2.2 * scale;
          ctx.beginPath();
          ctx.moveTo(x + 3 * scale, y + h * 0.24);
          ctx.lineTo(x + w - 3 * scale, y + h * 0.24);
          ctx.moveTo(x + 3 * scale, y + h * 0.76);
          ctx.lineTo(x + w - 3 * scale, y + h * 0.76);
          ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(182, 188, 208, 0.14)';
        ctx.lineWidth = Math.max(1.0, 1.5 * scale);
        ctx.beginPath();
        ctx.moveTo(x + inset, y + h - inset);
        ctx.lineTo(x + w - inset, y + h - inset);
        ctx.stroke();

        if (crackPts) {
          ctx.strokeStyle = 'rgba(5, 6, 9, 0.80)';
          ctx.lineWidth = Math.max(1.0, 1.4 * scale);
          ctx.beginPath();
          ctx.moveTo(crackPts[0][0], crackPts[0][1]);
          ctx.lineTo(crackPts[1][0], crackPts[1][1]);
          ctx.lineTo(crackPts[2][0], crackPts[2][1]);
          ctx.stroke();
        }
      });

      drawWrappedFast(hctx, size, size, minX, minY, maxX, maxY, () => {
        tracePolyPath(hctx, pts);
        hctx.lineJoin = 'round';
        hctx.strokeStyle = 'rgb(38, 38, 38)';
        hctx.lineWidth = 5.4 * scale;
        hctx.stroke();

        const skirtH = Math.round(faceH * 0.50);
        hctx.fillStyle = `rgb(${skirtH},${skirtH},${skirtH})`;
        hctx.fill();

        tracePolyPath(hctx, innerPts);
        hctx.fillStyle = `rgb(${faceH},${faceH},${faceH})`;
        hctx.fill();

        if (isRibCourse) {
          hctx.strokeStyle = 'rgb(104, 104, 104)';
          hctx.lineWidth = Math.max(1.8, 3.0 * scale);
          hctx.beginPath();
          hctx.moveTo(x + 3 * scale, y + h * 0.24);
          ctx.lineTo(x + w - 3 * scale, y + h * 0.24);
          ctx.moveTo(x + 3 * scale, y + h * 0.76);
          ctx.lineTo(x + w - 3 * scale, y + h * 0.76);
          hctx.stroke();
        }

        if (crackPts) {
          hctx.strokeStyle = 'rgb(18, 18, 18)';
          hctx.lineWidth = Math.max(1.2, 2.1 * scale);
          hctx.beginPath();
          hctx.moveTo(crackPts[0][0], crackPts[0][1]);
          ctx.lineTo(crackPts[1][0], crackPts[1][1]);
          ctx.lineTo(crackPts[2][0], crackPts[2][1]);
          hctx.stroke();
        }
      });
    }
  }

  for (let i = 0; i < 16; i++) {
    const px = rand() * size;
    const py = rand() * size;
    const pr = (32 + rand() * 58) * scale;
    const sootAlpha = 0.20 + rand() * 0.22;
    drawWrappedFast(ctx, size, size, px - pr, py - pr, px + pr, py + pr, () => {
      const g = ctx.createRadialGradient(px, py, 3 * scale, px, py, pr);
      g.addColorStop(0.0, `rgba(9, 8, 11, ${sootAlpha.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(15, 14, 19, ${(sootAlpha * 0.45).toFixed(3)})`);
      g.addColorStop(1.0, 'rgba(15, 14, 19, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;

  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);
  const aoData = new Float32Array(total);

  const noiseSoot = createTileableNoiseGrid(16, 4401);
  const noiseA    = createTileableNoiseGrid(32, 4402);
  const noiseB    = createTileableNoiseGrid(64, 4403);

  const lutSoot = buildNoiseAxisLUT(noiseSoot, size, 2);
  const lutGrA  = buildNoiseAxisLUT(noiseA, size, 4);
  const lutGrB  = buildNoiseAxisLUT(noiseB, size, 6);

  const gSoot = noiseSoot.grid;
  const gA    = noiseA.grid;
  const gB    = noiseB.grid;

  const invSize = 1 / size;
  const sSootY = 2 * noiseSoot.size * invSize;
  const sGrAY  = 4 * noiseA.size * invSize;
  const sGrBY  = 6 * noiseB.size * invSize;

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

      const ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const nA0 = gA[aR0 + ax0] + (gA[aR0 + ax1] - gA[aR0 + ax0]) * asx;
      const nA1 = gA[aR1 + ax0] + (gA[aR1 + ax1] - gA[aR1 + ax0]) * asx;
      const nA = nA0 + (nA1 - nA0) * aSy;

      const bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const nB0 = gB[bR0 + bx0] + (gB[bR0 + bx1] - gB[bR0 + bx0]) * bsx;
      const nB1 = gB[bR1 + bx0] + (gB[bR1 + bx1] - gB[bR1 + bx0]) * bsx;
      const nB = nB0 + (nB1 - nB0) * bSy;

      const sx0 = sX0[x], sx1 = sX1[x], ssx = sSx[x];
      const nS0 = gSoot[sR0 + sx0] + (gSoot[sR0 + sx1] - gSoot[sR0 + sx0]) * ssx;
      const nS1 = gSoot[sR1 + sx0] + (gSoot[sR1 + sx1] - gSoot[sR1 + sx0]) * ssx;
      const sootN = nS0 + (nS1 - nS0) * sSy;

      const grain = (nA * 0.62 + nB * 0.38) - 0.5;
      const soot = clamp01((sootN - 0.35) * 1.65);

      heightData[idx] = clamp01(baseH + grain * (baseH > 0.25 ? 0.105 : 0.055));

      const ao = baseH < 0.24 ? (0.10 + baseH * 1.0) : Math.min(1.0, 0.34 + (baseH - 0.24) * 0.90 + grain * 0.12);
      aoData[idx] = ao < 0.08 ? 0.08 : ao;

      // Matte soot-stained cathedral vault stone (0.74..0.95 — eliminates overhead glare!)
      roughData[idx] = baseH < 0.28
        ? 0.94
        : Math.max(0.74, Math.min(0.95, 0.87 - clamp01((baseH - 0.65) * 1.8) * 0.10 + soot * 0.08 + grain * 0.06));

      const shade = (1.0 + grain * 0.17) * (1.0 - soot * 0.24);
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
  const normal = buildNormalMapFromHeight(heightData, size, size, 0.85, 1.58, 0.82, anisotropy, true);
  const orm = buildOrmMapFromFields(aoData, roughData, size, size, anisotropy, true);

  return { albedo, normal, roughness: orm, ao: orm };
}

// ============================================================================
// 4. Royal Gothic Tapestry / Velvet Banner 2K Set (1024x2048 PC / 256x512 Mobile)
//    Exported as bannerAlbedo + bannerNormal + bannerRoughness + bannerAo.
//    Crisp 2K woven velvet & damask threads, sculpted hanging pleats, raised
//    3D bullion-cord gold embroidery stitches, scorched tattered swallowtail!
// ============================================================================
function createBannerPbrSet(width, height, anisotropy) {
  const albedoCanvas = createCanvas2D(width, height);
  const embCanvas = createCanvas2D(width, height);
  const scorchCanvas = createCanvas2D(width, height);
  if (!albedoCanvas || !embCanvas || !scorchCanvas) {
    const fbOrm = createFallbackTexture(220, 224, 224, 255, false, THREE.ClampToEdgeWrapping, anisotropy);
    return {
      albedo: createFallbackTexture(88, 14, 26, 255, true, THREE.ClampToEdgeWrapping, anisotropy),
      normal: createFallbackTexture(128, 128, 255, 255, false, THREE.ClampToEdgeWrapping, anisotropy),
      roughness: fbOrm,
      ao: fbOrm
    };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const ectx = getFastCtx2D(embCanvas, true);
  const sctx = getFastCtx2D(scorchCanvas, true);
  const sx = width / 512;
  const sy = height / 1024;
  const rand = makeRng(269044);

  // 1. Noble Deep Oxblood-Crimson Velvet Ground (regal dark-gothic, zero neon)
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0.00, '#6a1120');
  bg.addColorStop(0.28, '#560d19');
  bg.addColorStop(0.62, '#400813');
  bg.addColorStop(0.84, '#26060c');
  bg.addColorStop(1.00, '#100508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, width, height);
  sctx.fillStyle = '#000000';
  sctx.fillRect(0, 0, width, height);

  // 2. Woven Gothic Damask Jacquard Lattice inside crimson velvet
  ctx.save();
  ctx.strokeStyle = 'rgba(142, 25, 42, 0.22)';
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

      ctx.fillStyle = 'rgba(156, 30, 48, 0.17)';
      ctx.beginPath();
      ctx.arc(px, py, 3.2 * sx, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Shared vector embroidery renderer (antique tarnished bullion gold + raised stitch height mask)
  const drawRoyalHeraldry = (targetCtx, isMask) => {
    targetCtx.save();

    const goldGrad = isMask
      ? '#ffffff'
      : (() => {
          const g = targetCtx.createLinearGradient(0, 40 * sy, width, height * 0.82);
          g.addColorStop(0.00, '#e6c266');
          g.addColorStop(0.28, '#c4963a');
          g.addColorStop(0.55, '#efd07c');
          g.addColorStop(0.80, '#b1802b');
          g.addColorStop(1.00, '#805819');
          return g;
        })();

    const goldDark = isMask ? '#b0b0b0' : '#745017';
    const goldBright = isMask ? '#ffffff' : '#f6de96';
    const steelGold = isMask ? '#e6e6e6' : '#dfd2b2';

    // Top suspension header brocade band
    targetCtx.fillStyle = goldDark;
    targetCtx.fillRect(22 * sx, 16 * sy, width - 44 * sx, 18 * sy);
    targetCtx.fillStyle = goldGrad;
    targetCtx.fillRect(26 * sx, 20 * sy, width - 52 * sx, 10 * sy);

    // Outer double-braided antique gold brocade border
    const borderB = height * 0.84;
    if (!isMask) {
      targetCtx.strokeStyle = 'rgba(12, 3, 5, 0.78)';
      targetCtx.lineWidth = 25 * sx;
      targetCtx.strokeRect(30 * sx, 38 * sy, width - 60 * sx, borderB - 38 * sy);
    }

    targetCtx.strokeStyle = goldGrad;
    targetCtx.lineWidth = 17.5 * sx;
    targetCtx.strokeRect(30 * sx, 38 * sy, width - 60 * sx, borderB - 38 * sy);

    // Twisted gold cord chevron stitches along outer brocade border
    targetCtx.strokeStyle = goldDark;
    targetCtx.lineWidth = 2.4 * sx;
    targetCtx.beginPath();
    for (let by = 46 * sy; by < borderB - 10 * sy; by += 12 * sy) {
      targetCtx.moveTo(22 * sx, by);
      targetCtx.lineTo(38 * sx, by + 9 * sy);
      targetCtx.moveTo(width - 38 * sx, by);
      targetCtx.lineTo(width - 22 * sx, by + 9 * sy);
    }
    targetCtx.stroke();

    // Inner gothic filigree frame
    targetCtx.strokeStyle = goldDark;
    targetCtx.lineWidth = 5.2 * sx;
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
        targetCtx.fillStyle = '#480a14';
        targetCtx.beginPath();
        targetCtx.arc(cx, cy, 4.5 * sx, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }

    // CENTERPIECE ROYAL GOTHIC HERALDRY
    targetCtx.translate(width * 0.5, height * 0.41);

    // Pointed Gothic Mandorla Aureole Frame
    targetCtx.strokeStyle = goldGrad;
    targetCtx.lineWidth = 6.0 * sx;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -238 * sy);
    targetCtx.bezierCurveTo(138 * sx, -135 * sy, 138 * sx, 135 * sy, 0, 248 * sy);
    targetCtx.bezierCurveTo(-138 * sx, 135 * sy, -138 * sx, -135 * sy, 0, -238 * sy);
    targetCtx.closePath();
    targetCtx.stroke();

    targetCtx.strokeStyle = goldDark;
    targetCtx.lineWidth = 2.6 * sx;
    targetCtx.beginPath();
    targetCtx.moveTo(0, -216 * sy);
    targetCtx.bezierCurveTo(114 * sx, -120 * sy, 114 * sx, 120 * sy, 0, 224 * sy);
    targetCtx.bezierCurveTo(-114 * sx, 120 * sy, -114 * sx, -120 * sy, 0, -216 * sy);
    targetCtx.closePath();
    targetCtx.stroke();

    // Radiating Sunburst Thorns
    targetCtx.strokeStyle = goldGrad;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const innerR = (i % 2 === 0 ? 72 : 84) * sx;
      const outerR = (i % 2 === 0 ? 126 : 105) * sx;
      targetCtx.lineWidth = (i % 2 === 0 ? 3.4 : 1.9) * sx;
      targetCtx.beginPath();
      targetCtx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR * 1.18 - 18 * sy);
      targetCtx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR * 1.18 - 18 * sy);
      targetCtx.stroke();
    }

    // Flared Heraldic Cross Pattée w/ inner filigree rib
    const crossY = -36 * sy;
    targetCtx.fillStyle = isMask ? '#dcdcdc' : '#b4852f';
    const drawCrossArm = (rot) => {
      targetCtx.save();
      targetCtx.translate(0, crossY);
      targetCtx.rotate(rot);
      targetCtx.beginPath();
      targetCtx.moveTo(-10 * sx, 0);
      targetCtx.lineTo(-31 * sx, -116 * sy);
      targetCtx.lineTo(0, -96 * sy);
      targetCtx.lineTo(31 * sx, -116 * sy);
      targetCtx.lineTo(10 * sx, 0);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.strokeStyle = goldBright;
      targetCtx.lineWidth = 2.4 * sx;
      targetCtx.stroke();
      // Inner raised ridge line on each cross arm
      targetCtx.beginPath();
      targetCtx.moveTo(0, -14 * sy);
      targetCtx.lineTo(0, -92 * sy);
      targetCtx.stroke();
      targetCtx.restore();
    };
    drawCrossArm(0);
    drawCrossArm(Math.PI * 0.5);
    drawCrossArm(Math.PI);
    drawCrossArm(Math.PI * 1.5);

    // Royal Knight Greatsword
    if (!isMask) {
      targetCtx.fillStyle = 'rgba(10, 2, 5, 0.62)';
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

    targetCtx.strokeStyle = isMask ? '#909090' : '#583810';
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
    targetCtx.lineWidth = 2.2 * sx;
    targetCtx.stroke();

    // Wire-wrapped Grip & Faceted Pommel
    targetCtx.fillStyle = isMask ? '#cccccc' : '#926822';
    targetCtx.fillRect(-10 * sx, -124 * sy, 20 * sx, 72 * sy);
    targetCtx.strokeStyle = goldBright;
    targetCtx.lineWidth = 2.2 * sx;
    targetCtx.beginPath();
    for (let gy = -116 * sy; gy <= -62 * sy; gy += 10 * sy) {
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

    // Three-Spired Royal Gothic Crown
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
        targetCtx.fillStyle = '#821222';
        targetCtx.beginPath();
        targetCtx.arc(jx, -176 * sy, 5.2 * sx, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = 'rgba(255, 220, 210, 0.55)';
        targetCtx.beginPath();
        targetCtx.arc(jx - 1.5 * sx, -177.5 * sy, 1.6 * sx, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }

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

  // 3. Soot Smudges & Singed Swallowtail Bottom Hem
  for (let i = 0; i < 26; i++) {
    const px = rand() * width;
    const isBottom = i < 14;
    const py = isBottom ? height * (0.72 + rand() * 0.28) : height * (0.18 + rand() * 0.65);
    const pr = (isBottom ? (36 + rand() * 66) : (20 + rand() * 44)) * sx;
    const alpha = isBottom ? (0.48 + rand() * 0.34) : (0.15 + rand() * 0.18);

    const g = ctx.createRadialGradient(px, py, 2 * sx, px, py, pr);
    g.addColorStop(0.0, `rgba(10, 6, 8, ${alpha.toFixed(3)})`);
    g.addColorStop(0.55, `rgba(20, 10, 12, ${(alpha * 0.52).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(18, 8, 11, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    const sg = sctx.createRadialGradient(px, py, 2 * sx, px, py, pr);
    sg.addColorStop(0.0, `rgba(255, 255, 255, ${(alpha * 1.1).toFixed(3)})`);
    sg.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    sctx.fillStyle = sg;
    ctx.beginPath();
    sctx.arc(px, py, pr, 0, Math.PI * 2);
    sctx.fill();
  }

  const stepX = Math.max(2, Math.round(3 * sx));
  for (let x = 0; x < width; x += stepX) {
    const u = x / width;
    const centerWeight = 1.0 - Math.abs(u - 0.5) * 2.0;
    const hemStart = height * (0.86 - centerWeight * 0.14 - (rand() * 0.055));
    const emberY = hemStart - (14 + rand() * 22) * sy;

    const rimGrad = ctx.createLinearGradient(0, emberY, 0, height);
    rimGrad.addColorStop(0.00, 'rgba(44, 17, 10, 0.0)');
    rimGrad.addColorStop(0.26, 'rgba(54, 24, 12, 0.48)');
    rimGrad.addColorStop(0.50, 'rgba(16, 9, 10, 0.86)');
    rimGrad.addColorStop(1.00, 'rgba(6, 4, 6, 0.97)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(x, emberY, stepX + 1, height - emberY);

    const mGrad = sctx.createLinearGradient(0, emberY, 0, height);
    mGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
    mGrad.addColorStop(0.38, 'rgba(255, 255, 255, 0.74)');
    mGrad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');
    sctx.fillStyle = mGrad;
    sctx.fillRect(x, emberY, stepX + 1, height - emberY);

    if (rand() < 0.34) {
      const fLen = (26 + rand() * 72) * sy;
      ctx.fillStyle = rand() > 0.35 ? 'rgba(8, 4, 6, 0.58)' : 'rgba(144, 104, 46, 0.28)';
      ctx.fillRect(x, hemStart - fLen * 0.45, Math.max(1, 1.5 * sx), fLen);
    }
  }

  // 4. LUT-Accelerated 2K Pixel Pass: Fine Tapestry Twill Weave + Raised Bullion Embroidery + Fold AO!
  const albedoImg = ctx.getImageData(0, 0, width, height);
  const aPix = albedoImg.data;
  const ePix = ectx.getImageData(0, 0, width, height).data;
  const sPix = sctx.getImageData(0, 0, width, height).data;

  const total = width * height;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);
  const aoData = new Float32Array(total);

  const clothNoise = createTileableNoiseGrid(64, 9045);
  const napNoise   = createTileableNoiseGrid(32, 9046);
  const lutCloth = buildNoiseAxisLUT(clothNoise, width, 8);
  const lutNap   = buildNoiseAxisLUT(napNoise, width, 3);

  const gCloth = clothNoise.grid;
  const gNap   = napNoise.grid;
  const cX0 = lutCloth.x0, cX1 = lutCloth.x1, cSx = lutCloth.sx;
  const nX0 = lutNap.x0,   nX1 = lutNap.x1,   nSx = lutNap.sx;

  const invW = 1 / width;
  const invH = 1 / height;
  const weaveFreqX = (Math.PI * 2) * (160 * invW);
  const weaveFreqY = (Math.PI * 2) * (320 * invH);
  const stitchFreq = (Math.PI * 2) * (128 * invW);

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

    foldBaseLUT[x] = Math.sin(u * Math.PI * 6.0 - 0.45) * 0.60 + Math.cos(u * Math.PI * 4.0 + 0.6) * 0.22;
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

  const sClothY = 16 * clothNoise.size * invH;
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

      let foldWave = foldBaseLUT[x] + (foldSubSinLUT[x] * cosPhase + foldSubCosLUT[x] * sinPhase) * 0.24;
      if (topPinch > 0) {
        foldWave = foldWave + (ringGatherLUT[x] - foldWave) * topPinch;
      }
      const foldH = foldWave * foldEnv;

      const wxSin = wxSinLUT[x];
      const twill = wxHalfSinLUT[x] * wyHalfCos + wxHalfCosLUT[x] * wyHalfSin;

      const cx0 = cX0[x], cx1 = cX1[x], csx = cSx[x];
      const nc0 = gCloth[cR0 + cx0] + (gCloth[cR0 + cx1] - gCloth[cR0 + cx0]) * csx;
      const nc1 = gCloth[cR1 + cx0] + (gCloth[cR1 + cx1] - gCloth[cR1 + cx0]) * csx;
      const clothGrain = (nc0 + (nc1 - nc0) * cSy) - 0.5;

      const nx0 = nX0[x], nx1 = nX1[x], nsx = nSx[x];
      const nn0 = gNap[nR0 + nx0] + (gNap[nR0 + nx1] - gNap[nR0 + nx0]) * nsx;
      const nn1 = gNap[nR1 + nx0] + (gNap[nR1 + nx1] - gNap[nR1 + nx0]) * nsx;
      const nap = (nn0 + (nn1 - nn0) * nSy) - 0.5;

      const fabricWeave = (wxSin * 0.34 + wySin * 0.34 + twill * 0.32) * 0.056 + clothGrain * 0.056;

      // High-relief bullion gold embroidery stitches (+0.28 height + crisp directional cord ridges!)
      let embBump = 0;
      if (embMask > 0.02) {
        const stitch = (stitchSinXLUT[x] * styCos + stitchCosXLUT[x] * stySin) * 0.048;
        embBump = embMask * (0.28 + stitch);
      }

      const scorchCrinkle = scorchMask * clothGrain * 0.10;
      heightData[idx] = clamp01(0.44 + foldH * 0.30 + fabricWeave + embBump + scorchCrinkle);

      // Fold valley & stitch-border AO
      aoData[idx] = clamp01(0.76 + foldH * 0.24 + embMask * 0.12 - scorchMask * 0.25);

      let r = aPix[p4];
      let g = aPix[p4 + 1];
      let b = aPix[p4 + 2];

      const foldShade = 1.0 + foldH * 0.32 + (wxSin * wySin) * 0.045 + nap * 0.09;
      r *= foldShade;
      g *= foldShade;
      b *= foldShade;

      if (foldH > 0.28 && embMask < 0.15 && scorchMask < 0.4) {
        const sheen = (foldH - 0.28) * 18.0 * (1.0 - scorchMask);
        r += sheen * 1.08;
        g += sheen * 0.32;
        b += sheen * 0.40;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      let rough = 0.89 - foldH * 0.05 + nap * 0.05;
      if (embMask > 0.02) {
        const goldRough = 0.30 + clothGrain * 0.08 + (1.0 - embMask) * 0.12;
        rough = rough + (goldRough - rough) * (embMask * (1.0 - scorchMask * 0.65));
      }
      if (scorchMask > 0.02) {
        rough = rough + (0.95 - rough) * (scorchMask * 0.90);
      }
      roughData[idx] = rough < 0.26 ? 0.26 : rough > 0.96 ? 0.96 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeat: false, anisotropy });
  const normal = buildNormalMapFromHeight(heightData, width, height, 1.65, 1.45, 0.72, anisotropy, false);
  const orm = buildOrmMapFromFields(aoData, roughData, width, height, anisotropy, false);

  return { albedo, normal, roughness: orm, ao: orm };
}

// ============================================================================
// 5. Hand-Forged Hammered Wrought-Iron 1K Set (1024px PC / 256px Mobile)
//    Exported as ironNormal + ironRoughness + ironAo.
//    Multi-tier Voronoi anvil hammer peens, crisp tileable micro-scratches &
//    battle gouges, forge-scale soot pitting craters, matte-brushed wrought
//    iron roughness [0.58..0.88] so firelight scatters softly instead of
//    reflecting like smooth split obsidian!
// ============================================================================
function createIronPbrSet(size, anisotropy) {
  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);
  const aoData = new Float32Array(total);

  // Seamless tileable scratch & soot-pitting fields (zero DOM/Canvas allocation!)
  const scratchH = new Float32Array(total);
  const scratchMask = new Float32Array(total);
  const pitMask = new Float32Array(total);

  const mask = size - 1;
  const scale = size / 512;
  const rand = makeRng(774123);

  // Helper: rasterize a 100% seamless curved metal scratch (incised V-groove + subtle burred lip)
  const addSeamlessScratch = (x0, y0, ang, len, curve, halfW, depth, burr, maskStr) => {
    const steps = Math.max(8, Math.ceil(len * 1.45));
    const stepLen = len / steps;
    const rSpan = Math.max(1, Math.ceil(halfW * 1.85 + 1.0));
    let cx = x0;
    let cy = y0;
    let curAng = ang;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const env = Math.sin(t * Math.PI);
      if (env > 0.02) {
        const tx = Math.cos(curAng);
        const ty = Math.sin(curAng);
        const nx = -ty;
        const ny = tx;
        const icx = Math.round(cx);
        const icy = Math.round(cy);

        for (let oy = -rSpan; oy <= rSpan; oy++) {
          const py = (icy + oy) & mask;
          const rowOff = py * size;
          const dy = (icy + oy) - cy;
          for (let ox = -rSpan; ox <= rSpan; ox++) {
            const dx = (icx + ox) - cx;
            const para = dx * tx + dy * ty;
            if (para < -0.95 || para > 0.95) continue;
            const perp = dx * nx + dy * ny;
            const absPerp = perp < 0 ? -perp : perp;
            const px = (icx + ox) & mask;
            const idx = rowOff + px;

            if (absPerp <= halfW) {
              const g = (1.0 - absPerp / halfW) * env * depth;
              if (-g < scratchH[idx]) scratchH[idx] = -g;
              const m = (1.0 - absPerp / (halfW * 1.15)) * env * maskStr;
              if (m > scratchMask[idx]) scratchMask[idx] = m;
            } else if (perp > halfW && perp < halfW * 2.1 && burr > 0) {
              const bt = 1.0 - (perp - halfW) / (halfW * 1.1);
              const bVal = bt * env * burr;
              if (scratchH[idx] >= 0 && bVal > scratchH[idx]) {
                scratchH[idx] = bVal;
              }
              const bm = bt * env * maskStr * 0.55;
              if (bm > scratchMask[idx]) scratchMask[idx] = bm;
            }
          }
        }
      }
      curAng += curve / steps;
      cx += Math.cos(curAng) * stepLen;
      cy += Math.sin(curAng) * stepLen;
    }
  };

  // Layer A: ~360 crisp anisotropic forging / wire-brush micro-scratches
  for (let i = 0; i < 360; i++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const isForgedAxis = rand() < 0.60;
    const ang = isForgedAxis
      ? ((rand() < 0.5 ? 0 : Math.PI * 0.5) + (rand() - 0.5) * 0.56)
      : (rand() * Math.PI * 2);
    const len = (20 + rand() * 72) * scale;
    const curve = (rand() - 0.5) * 0.36;
    const hw = (0.62 + rand() * 0.62) * scale;
    const depth = 0.08 + rand() * 0.085;
    const burr = depth * 0.38;
    const mStr = 0.48 + rand() * 0.44;
    addSeamlessScratch(x0, y0, ang, len, curve, hw, depth, burr, mStr);
  }

  // Layer B: ~64 deeper battle / smithing gouge scratches (catch grazing firelight cleanly!)
  for (let i = 0; i < 64; i++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const ang = rand() * Math.PI * 2;
    const len = (30 + rand() * 98) * scale;
    const curve = (rand() - 0.5) * 0.64;
    const hw = (1.10 + rand() * 0.95) * scale;
    const depth = 0.16 + rand() * 0.11;
    const burr = depth * 0.42;
    const mStr = 0.75 + rand() * 0.25;
    addSeamlessScratch(x0, y0, ang, len, curve, hw, depth, burr, mStr);
  }

  // Layer C: ~220 irregular forge-scale & soot pitting craters (scattered + corrosion clusters)
  for (let i = 0; i < 220; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const isLarge = i < 48;
    const rx = (isLarge ? (4.2 + rand() * 6.8) : (1.6 + rand() * 4.0)) * scale;
    const ry = rx * (0.55 + rand() * 0.55);
    const rot = rand() * Math.PI;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const pitStr = isLarge ? (0.68 + rand() * 0.32) : (0.50 + rand() * 0.45);
    const rMax = Math.ceil(Math.max(rx, ry)) + 1;
    const icx = Math.round(cx);
    const icy = Math.round(cy);

    for (let oy = -rMax; oy <= rMax; oy++) {
      const py = (icy + oy) & mask;
      const rowOff = py * size;
      const dy = (icy + oy) - cy;
      for (let ox = -rMax; ox <= rMax; ox++) {
        const dx = (icx + ox) - cx;
        const lx = (dx * cosR + dy * sinR) / rx;
        const ly = (-dx * sinR + dy * cosR) / ry;
        const d2 = lx * lx + ly * ly;
        if (d2 < 1.0) {
          const bowl = (1.0 - d2) * (1.0 - d2 * 0.35) * pitStr;
          const idx = rowOff + ((icx + ox) & mask);
          if (bowl > pitMask[idx]) pitMask[idx] = bowl;
        }
      }
    }
  }

  const vCoarse = createTileableVoronoiGrid(10, 7701, 0.86);
  const vFine   = createTileableVoronoiGrid(22, 7702, 0.82);

  const nPatina = createTileableNoiseGrid(16, 7703);
  const nGrain  = createTileableNoiseGrid(32, 7704);
  const nMicro  = createTileableNoiseGrid(64, 7705);

  const lutPat = buildNoiseAxisLUT(nPatina, size, 3);
  const lutGr  = buildNoiseAxisLUT(nGrain, size, 6);
  const lutMic = buildNoiseAxisLUT(nMicro, size, 10);

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
  const sGrY  = 14 * nGrain.size * invSize;
  const sMicY = 10 * nMicro.size * invSize;

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
      const ridgeEdge = clamp01(1.0 - (f2 - f1) * 5.8);

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
      const finePeen = clamp01(Math.sqrt(fd1) * 1.42);

      const px0 = pX0[x], px1 = pX1[x], psx = pSx[x];
      const np0 = gPat[pR0 + px0] + (gPat[pR0 + px1] - gPat[pR0 + px0]) * psx;
      const np1 = gPat[pR1 + px0] + (gPat[pR1 + px1] - gPat[pR1 + px0]) * psx;
      const patN = np0 + (np1 - np0) * pSy;

      const gx0 = gX0[x], gx1 = gX1[x], gsx = gSx[x];
      const ng0 = gGr[gR0 + gx0] + (gGr[gR0 + gx1] - gGr[gR0 + gx0]) * gsx;
      const ng1 = gGr[gR1 + gx0] + (gGr[gR1 + gx1] - gGr[gR1 + gx0]) * gsx;
      const grN = ng0 + (ng1 - ng0) * gSy;

      const mx0 = mX0[x], mx1 = mX1[x], msx = mSx[x];
      const nm0 = gMic[mR0 + mx0] + (gMic[mR0 + mx1] - gMic[mR0 + mx0]) * msx;
      const nm1 = gMic[mR1 + mx0] + (gMic[mR1 + mx1] - gMic[mR1 + mx0]) * msx;
      const micN = nm0 + (nm1 - nm0) * mSy;

      const cavityMask = clamp01(1.0 - peenBowl * 0.85);
      const patinaRaw = clamp01((patN * 0.66 + micN * 0.34 - 0.38 + cavityMask * 0.24) * 2.3);
      const patina = patinaRaw * patinaRaw * (3 - 2 * patinaRaw);

      const pitDepth = clamp01(pitMask[idx] * (0.68 + micN * 0.68));
      const scrH = scratchH[idx];
      const scrM = scratchMask[idx];

      // Smooth rounded blacksmith ball-peen dimples (avoid sharp obsidian-crystal facets!)
      const peenClamped = clamp01(peenBowl);
      const peenSmooth = peenClamped * peenClamped * (3.0 - 2.0 * peenClamped);
      const fineSmooth = finePeen * finePeen * (3.0 - 2.0 * finePeen);

      heightData[idx] = clamp01(
        0.40 +
        peenSmooth * 0.16 +
        ridgeEdge * 0.045 +
        fineSmooth * 0.08 +
        (grN - 0.5) * 0.13 +
        (micN - 0.5) * 0.065 -
        patina * 0.06 -
        pitDepth * 0.28 +
        scrH * 1.12
      );

      const scrCrevice = scrH < 0 ? -scrH : 0;
      aoData[idx] = clamp01(
        0.58 + peenSmooth * 0.26 + ridgeEdge * 0.10 - patina * 0.20 - pitDepth * 0.44 - scrCrevice * 0.72
      );

      // Scratched forged wrought-iron roughness [0.58..0.88] — firelight scatters softly across scratched
      // metal instead of reflecting like smooth glassy split obsidian!
      const baseIronR = 0.75 - peenSmooth * 0.045 - ridgeEdge * 0.065 - scrM * 0.13 + (grN - 0.5) * 0.07;
      const patinaTarget = 0.855 + (micN - 0.5) * 0.045;
      let finalR = baseIronR + (patinaTarget - baseIronR) * (patina * 0.72);
      if (pitDepth > 0.01) {
        finalR = finalR + (0.875 - finalR) * clamp01(pitDepth * 1.15);
      }
      roughData[idx] = finalR < 0.58 ? 0.58 : finalR > 0.88 ? 0.88 : finalR;
    }
  }

  const normal = buildNormalMapFromHeight(heightData, size, size, 1.38, 1.05, 0.34, anisotropy, true);
  const orm = buildOrmMapFromFields(aoData, roughData, size, size, anisotropy, true);

  return { normal, roughness: orm, ao: orm };
}

// ============================================================================
// 5b. Royal Crimson-Velvet Ornate Runner Carpet PBR Set (1024px PC / 256px Mobile)
//     Exported as carpetAlbedo + carpetNormal + carpetRoughness + carpetAo.
//     Seamless vertical repeat along V (wrapT = Repeat), U in [0..1] across width:
//       - Deep dried-blood crimson velvet center field matching Souls_Throne_CrimsonVelvet
//       - Plush 45-degree diamond-quilted tufting + subtle woven jacquard damask motifs
//       - Ornate woven tarnished-gold Gothic filigree borders on u in [0.05..0.16] & [0.84..0.95]
//         with medieval trefoil / cross pattée medallions & dark braided hem piping
//       - Realistic woven carpet fabric normal bump, matte velvet roughness [0.84..0.96],
//         and subtle worn footstep darkening down the center walking path!
// ============================================================================
function createCarpetPbrSet(size, anisotropy) {
  const albedoCanvas = createCanvas2D(size, size);
  const embCanvas = createCanvas2D(size, size);
  if (!albedoCanvas || !embCanvas) {
    const fbAlb = createFallbackTexture(96, 16, 22, 255, true, THREE.ClampToEdgeWrapping, anisotropy);
    fbAlb.wrapT = THREE.RepeatWrapping;
    const fbNorm = createFallbackTexture(128, 128, 255, 255, false, THREE.ClampToEdgeWrapping, anisotropy);
    fbNorm.wrapT = THREE.RepeatWrapping;
    const fbOrm = createFallbackTexture(224, 232, 232, 255, false, THREE.ClampToEdgeWrapping, anisotropy);
    fbOrm.wrapT = THREE.RepeatWrapping;
    return { albedo: fbAlb, normal: fbNorm, roughness: fbOrm, ao: fbOrm };
  }

  const ctx = getFastCtx2D(albedoCanvas, true);
  const ectx = getFastCtx2D(embCanvas, true);
  const s = size / 1024;

  // Vertical-only seamless wrapper along runner length (V axis)
  const drawWrappedY = (targetCtx, minY, maxY, fn) => {
    const oyStart = maxY > size ? -size : 0;
    const oyEnd = minY < 0 ? size : 0;
    for (let oy = oyStart; oy <= oyEnd; oy += size) {
      if (oy === 0) {
        fn();
      } else {
        targetCtx.save();
        targetCtx.translate(0, oy);
        fn();
        targetCtx.restore();
      }
    }
  };

  // Clear embroidery/relief channel buffer (R = gold filigree, G = jacquard damask, B = hem piping cord)
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, size, size);

  // 1. Base Dried-Blood Crimson Velvet Field (matched to Throne_Worn_Crimson_Velvet)
  const baseGrad = ctx.createLinearGradient(0, 0, size, 0);
  baseGrad.addColorStop(0.000, '#220508');
  baseGrad.addColorStop(0.018, '#36080e');
  baseGrad.addColorStop(0.050, '#3a090f');
  baseGrad.addColorStop(0.105, '#4c0c13');
  baseGrad.addColorStop(0.160, '#3a090f');
  baseGrad.addColorStop(0.180, '#5a0e15');
  baseGrad.addColorStop(0.320, '#6c1219');
  baseGrad.addColorStop(0.500, '#641017');
  baseGrad.addColorStop(0.680, '#6c1219');
  baseGrad.addColorStop(0.820, '#5a0e15');
  baseGrad.addColorStop(0.840, '#3a090f');
  baseGrad.addColorStop(0.895, '#4c0c13');
  baseGrad.addColorStop(0.950, '#3a090f');
  baseGrad.addColorStop(0.982, '#36080e');
  baseGrad.addColorStop(1.000, '#220508');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, size, size);

  // Recessed shadow channels flanking the outer dark hem & gold filigree bands
  const drawStripShadow = (u0, u1, alpha) => {
    ctx.fillStyle = `rgba(14, 2, 4, ${alpha})`;
    ctx.fillRect(u0 * size, 0, (u1 - u0) * size, size);
  };
  drawStripShadow(0.000, 0.018, 0.62);
  drawStripShadow(0.982, 1.000, 0.62);
  drawStripShadow(0.036, 0.050, 0.45);
  drawStripShadow(0.950, 0.964, 0.45);
  drawStripShadow(0.160, 0.178, 0.36);
  drawStripShadow(0.822, 0.840, 0.36);

  // 2. Subtle Woven Jacquard Damask Motifs inside the 5x8 Diamond-Quilted Center Field (u in [0.18..0.82])
  const fieldLeft = 0.18 * size;
  const fieldRight = 0.82 * size;
  const fieldW = fieldRight - fieldLeft;
  const dCols = 5;
  const dRows = 8;
  const cellW = fieldW / dCols;
  const cellH = size / dRows;

  const drawDamaskMotif = (targetCtx, cx, cy, isMask) => {
    const rw = cellW * 0.28;
    const rh = cellH * 0.28;

    // Soft tone-on-tone woven damask quatrefoil petal star
    targetCtx.fillStyle = isMask ? 'rgb(0, 165, 0)' : 'rgba(148, 28, 36, 0.28)';
    targetCtx.beginPath();
    targetCtx.moveTo(cx, cy - rh);
    targetCtx.quadraticCurveTo(cx + rw * 0.34, cy - rh * 0.34, cx + rw, cy);
    targetCtx.quadraticCurveTo(cx + rw * 0.34, cy + rh * 0.34, cx, cy + rh);
    targetCtx.quadraticCurveTo(cx - rw * 0.34, cy + rh * 0.34, cx - rw, cy);
    targetCtx.quadraticCurveTo(cx - rw * 0.34, cy - rh * 0.34, cx, cy - rh);
    targetCtx.closePath();
    targetCtx.fill();

    // Inner gothic diamond jacquard outline (whisper-subtle antique bronze-red thread)
    targetCtx.strokeStyle = isMask ? 'rgb(0, 225, 0)' : 'rgba(176, 126, 56, 0.22)';
    targetCtx.lineWidth = Math.max(1.0, 2.2 * s);
    targetCtx.beginPath();
    targetCtx.moveTo(cx, cy - rh * 0.72);
    targetCtx.lineTo(cx + rw * 0.72, cy);
    targetCtx.lineTo(cx, cy + rh * 0.72);
    targetCtx.lineTo(cx - rw * 0.72, cy);
    targetCtx.closePath();
    targetCtx.stroke();

    // Four delicate cardinal damask bud dots
    targetCtx.fillStyle = isMask ? 'rgb(0, 240, 0)' : 'rgba(188, 138, 62, 0.25)';
    const budR = Math.max(1.0, 2.6 * s);
    for (const [ox, oy] of [[0, -rh * 0.42], [rw * 0.42, 0], [0, rh * 0.42], [-rw * 0.42, 0]]) {
      targetCtx.beginPath();
      targetCtx.arc(cx + ox, cy + oy, budR, 0, Math.PI * 2);
      targetCtx.fill();
    }

    // Center damask rosette seed
    targetCtx.fillStyle = isMask ? 'rgb(0, 255, 0)' : 'rgba(168, 44, 48, 0.34)';
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, Math.max(1.2, 4.2 * s), 0, Math.PI * 2);
    targetCtx.fill();
  };

  const renderDamaskPass = (targetCtx, isMask) => {
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(fieldLeft, 0, fieldW, size);
    targetCtx.clip();

    // Type A diamond centers: p = i + 0.5, q = j
    for (let j = 0; j < dRows; j++) {
      const cy = j * cellH;
      for (let i = 0; i < dCols; i++) {
        const cx = fieldLeft + (i + 0.5) * cellW;
        drawWrappedY(targetCtx, cy - cellH * 0.4, cy + cellH * 0.4, () => {
          drawDamaskMotif(targetCtx, cx, cy, isMask);
        });
      }
    }

    // Type B diamond centers: p = i (0..dCols), q = j + 0.5
    for (let j = 0; j < dRows; j++) {
      const cy = (j + 0.5) * cellH;
      for (let i = 0; i <= dCols; i++) {
        const cx = fieldLeft + i * cellW;
        drawWrappedY(targetCtx, cy - cellH * 0.4, cy + cellH * 0.4, () => {
          drawDamaskMotif(targetCtx, cx, cy, isMask);
        });
      }
    }

    // Subtle dark-bronze woven tuft knots at diamond seam intersections
    if (!isMask) {
      const knotR = Math.max(1.0, 2.8 * s);
      for (let j = 0; j < dRows; j++) {
        for (let i = 0; i <= dCols; i++) {
          const kxA = fieldLeft + i * cellW;
          const kyA = j * cellH;
          drawWrappedY(targetCtx, kyA - knotR * 2, kyA + knotR * 2, () => {
            ctx.fillStyle = 'rgba(20, 4, 6, 0.62)';
            ctx.beginPath();
            ctx.arc(kxA, kyA, knotR * 1.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(138, 96, 38, 0.38)';
            ctx.beginPath();
            ctx.arc(kxA, kyA, knotR * 0.72, 0, Math.PI * 2);
            ctx.fill();
          });
          if (i < dCols) {
            const kxB = fieldLeft + (i + 0.5) * cellW;
            const kyB = (j + 0.5) * cellH;
            ctx.fillStyle = 'rgba(20, 4, 6, 0.62)';
            ctx.beginPath();
            ctx.arc(kxB, kyB, knotR * 1.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(138, 96, 38, 0.38)';
            ctx.beginPath();
            ctx.arc(kxB, kyB, knotR * 0.72, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    targetCtx.restore();
  };

  renderDamaskPass(ctx, false);
  renderDamaskPass(ectx, true);

  // 3. Ornate Woven Tarnished-Gold Gothic Filigree Borders (u in [0.05..0.16] & [0.84..0.95])
  //    + Dark Braided Hem Piping (u ~ 0.027 & 0.973) + Inner Hairline Accent Stripe (u ~ 0.171 & 0.829)
  const drawGothicBorders = (targetCtx, isMask) => {
    targetCtx.save();

    const goldMid = isMask ? 'rgb(228, 0, 0)' : '#b48735';
    const goldBright = isMask ? 'rgb(255, 0, 0)' : '#d4aa52';
    const goldDark = isMask ? 'rgb(156, 0, 0)' : '#6e4d18';
    const pipingMain = isMask ? 'rgb(0, 0, 235)' : '#3d1016';
    const pipingTwist = isMask ? 'rgb(0, 0, 255)' : '#7e5a24';

    const drawSide = (sideSign) => {
      // sideSign = 0 -> left border, 1 -> mirrored right border
      const mapU = (u) => (sideSign === 0 ? u : 1.0 - u) * size;

      // A) Dark Braided Hem Piping Cord along u = 0.027 (mirror 0.973)
      const pipeX = mapU(0.027);
      const pipeW = 0.017 * size;
      if (!isMask) {
        targetCtx.fillStyle = 'rgba(8, 2, 3, 0.78)';
        targetCtx.fillRect(pipeX - pipeW * 0.72, 0, pipeW * 1.44, size);
      }
      targetCtx.fillStyle = pipingMain;
      targetCtx.fillRect(pipeX - pipeW * 0.5, 0, pipeW, size);

      // Diagonal twisted rope strands repeating cleanly 32x along V
      const twistCount = 32;
      const twistStep = size / twistCount;
      targetCtx.strokeStyle = pipingTwist;
      targetCtx.lineWidth = Math.max(1.2, 3.0 * s);
      targetCtx.beginPath();
      for (let k = -1; k <= twistCount + 1; k++) {
        const y0 = k * twistStep;
        targetCtx.moveTo(pipeX - pipeW * 0.44, y0);
        targetCtx.lineTo(pipeX + pipeW * 0.44, y0 + twistStep * 0.72);
      }
      targetCtx.stroke();

      // B) Outer & Inner Braided Tarnished-Gold Guard Rails (u = 0.056 & 0.154, mirrored 0.944 & 0.846)
      const railUs = [0.056, 0.154];
      const railW = 0.0115 * size;
      for (let ri = 0; ri < railUs.length; ri++) {
        const rx = mapU(railUs[ri]);
        if (!isMask) {
          targetCtx.fillStyle = 'rgba(12, 3, 4, 0.80)';
          targetCtx.fillRect(rx - railW * 0.80, 0, railW * 1.60, size);
        }
        const rg = isMask
          ? goldMid
          : (() => {
              const g = targetCtx.createLinearGradient(rx - railW * 0.5, 0, rx + railW * 0.5, 0);
              g.addColorStop(0.0, '#725019');
              g.addColorStop(0.32, '#c89b44');
              g.addColorStop(0.55, '#dfc06e');
              g.addColorStop(0.82, '#a77b2d');
              g.addColorStop(1.0, '#624313');
              return g;
            })();
        targetCtx.fillStyle = rg;
        targetCtx.fillRect(rx - railW * 0.5, 0, railW, size);

        // Woven bullion chevron cord ticks (64x along V -> seamless!)
        const chevCount = 64;
        const chevStep = size / chevCount;
        targetCtx.strokeStyle = goldDark;
        targetCtx.lineWidth = Math.max(0.8, 1.7 * s);
        targetCtx.beginPath();
        for (let k = 0; k < chevCount; k++) {
          const cy = k * chevStep;
          targetCtx.moveTo(rx - railW * 0.44, cy);
          targetCtx.lineTo(rx + railW * 0.44, cy + chevStep * 0.62);
        }
        targetCtx.stroke();
      }

      // C) Delicate Inner Hairline Gold Accent Pin-Stripe (u = 0.171 / 0.829)
      const pinX = mapU(0.171);
      if (!isMask) {
        targetCtx.fillStyle = 'rgba(12, 2, 4, 0.72)';
        targetCtx.fillRect(pinX - 3.6 * s, 0, 7.2 * s, size);
      }
      targetCtx.fillStyle = goldMid;
      targetCtx.fillRect(pinX - 2.0 * s, 0, 4.0 * s, size);

      // D) 4 Repeating Ornate Gothic Filigree Medallions + Trefoils + Flared Crosses inside [0.064..0.146]
      const medCx = mapU(0.105);
      const medHalfW = 0.036 * size;
      const medCount = 4;
      const medStep = size / medCount;

      for (let m = 0; m < medCount; m++) {
        const my = (m + 0.5) * medStep;
        drawWrappedY(targetCtx, my - medStep * 0.65, my + medStep * 0.65, () => {
          // Pointed Gothic Ogee / Mandorla Cartouche Frame
          const frameH = medStep * 0.36;
          const frameW = medHalfW * 0.90;

          if (!isMask) {
            targetCtx.strokeStyle = 'rgba(14, 3, 5, 0.78)';
            targetCtx.lineWidth = 8.5 * s;
            targetCtx.beginPath();
            targetCtx.moveTo(medCx, my - frameH);
            targetCtx.bezierCurveTo(medCx + frameW * 1.15, my - frameH * 0.45, medCx + frameW * 1.15, my + frameH * 0.45, medCx, my + frameH);
            targetCtx.bezierCurveTo(medCx - frameW * 1.15, my + frameH * 0.45, medCx - frameW * 1.15, my - frameH * 0.45, medCx, my - frameH);
            targetCtx.closePath();
            targetCtx.stroke();
          }

          targetCtx.strokeStyle = goldMid;
          targetCtx.lineWidth = Math.max(1.8, 5.0 * s);
          targetCtx.beginPath();
          targetCtx.moveTo(medCx, my - frameH);
          targetCtx.bezierCurveTo(medCx + frameW * 1.15, my - frameH * 0.45, medCx + frameW * 1.15, my + frameH * 0.45, medCx, my + frameH);
          targetCtx.bezierCurveTo(medCx - frameW * 1.15, my + frameH * 0.45, medCx - frameW * 1.15, my - frameH * 0.45, medCx, my - frameH);
          targetCtx.closePath();
          targetCtx.stroke();

          // Bright inner gold thread highlight along Gothic cartouche
          targetCtx.strokeStyle = goldBright;
          targetCtx.lineWidth = Math.max(0.9, 1.9 * s);
          targetCtx.beginPath();
          targetCtx.moveTo(medCx, my - frameH * 0.86);
          targetCtx.bezierCurveTo(medCx + frameW * 0.92, my - frameH * 0.38, medCx + frameW * 0.92, my + frameH * 0.38, medCx, my + frameH * 0.86);
          targetCtx.bezierCurveTo(medCx - frameW * 0.92, my + frameH * 0.38, medCx - frameW * 0.92, my - frameH * 0.38, medCx, my - frameH * 0.86);
          targetCtx.closePath();
          targetCtx.stroke();

          // Interlaced S-scroll Gothic vine tendrils weaving between rails and cartouche
          targetCtx.strokeStyle = goldMid;
          targetCtx.lineWidth = Math.max(1.2, 2.8 * s);
          for (const dirX of [-1, 1]) {
            for (const dirY of [-1, 1]) {
              targetCtx.beginPath();
              targetCtx.moveTo(medCx + dirX * frameW * 0.56, my + dirY * frameH * 0.56);
              targetCtx.quadraticCurveTo(
                medCx + dirX * frameW * 1.06,
                my + dirY * frameH * 0.84,
                medCx + dirX * frameW * 0.72,
                my + dirY * (medStep * 0.47)
              );
              targetCtx.stroke();

              // Tiny woven gold scroll leaf bud
              targetCtx.fillStyle = goldBright;
              targetCtx.beginPath();
              targetCtx.arc(medCx + dirX * frameW * 0.86, my + dirY * frameH * 0.82, Math.max(1.0, 2.8 * s), 0, Math.PI * 2);
              targetCtx.fill();
            }
          }

          // Medieval Flared Cross Pattée inside the Cartouche
          const armL = frameW * 0.68;
          const armV = frameH * 0.48;
          const drawArm = (rot, len, flare) => {
            targetCtx.save();
            targetCtx.translate(medCx, my);
            targetCtx.rotate(rot);
            targetCtx.fillStyle = goldMid;
            targetCtx.beginPath();
            targetCtx.moveTo(-3.2 * s, 0);
            targetCtx.lineTo(-flare, -len);
            targetCtx.lineTo(0, -len * 0.82);
            targetCtx.lineTo(flare, -len);
            targetCtx.lineTo(3.2 * s, 0);
            targetCtx.closePath();
            targetCtx.fill();
            targetCtx.strokeStyle = goldBright;
            targetCtx.lineWidth = Math.max(0.8, 1.5 * s);
            targetCtx.stroke();
            targetCtx.restore();
          };
          drawArm(0, armV, 9.5 * s);
          drawArm(Math.PI, armV, 9.5 * s);
          drawArm(Math.PI * 0.5, armL, 8.2 * s);
          drawArm(Math.PI * 1.5, armL, 8.2 * s);

          // Center Cross Rosette Jewel
          targetCtx.fillStyle = goldBright;
          targetCtx.beginPath();
          targetCtx.arc(medCx, my, Math.max(1.8, 6.4 * s), 0, Math.PI * 2);
          targetCtx.fill();
          if (!isMask) {
            targetCtx.fillStyle = '#5e0c14';
            targetCtx.beginPath();
            targetCtx.arc(medCx, my, Math.max(1.0, 3.4 * s), 0, Math.PI * 2);
            targetCtx.fill();
          }

          // Connecting Gothic Trefoil (3-lobed Fleur-de-lis) Finial at Joint (my + medStep * 0.5)
          const jy = my + medStep * 0.5;
          const drawTrefoilCluster = (cy) => {
            targetCtx.fillStyle = goldMid;
            // Central diamond link
            targetCtx.beginPath();
            targetCtx.moveTo(medCx, cy - 16 * s);
            targetCtx.lineTo(medCx + 12 * s, cy);
            targetCtx.lineTo(medCx, cy + 16 * s);
            targetCtx.lineTo(medCx - 12 * s, cy);
            targetCtx.closePath();
            targetCtx.fill();
            targetCtx.strokeStyle = goldBright;
            targetCtx.lineWidth = Math.max(0.8, 1.6 * s);
            targetCtx.stroke();

            // Left & right curved trefoil lobes
            for (const dx of [-1, 1]) {
              targetCtx.fillStyle = goldMid;
              targetCtx.beginPath();
              targetCtx.ellipse(medCx + dx * 15 * s, cy, 7.5 * s, 4.8 * s, 0, 0, Math.PI * 2);
              targetCtx.fill();
              targetCtx.strokeStyle = goldBright;
              targetCtx.lineWidth = Math.max(0.7, 1.2 * s);
              targetCtx.stroke();
            }

            // Center eyelet
            targetCtx.fillStyle = isMask ? 'rgb(140, 0, 0)' : '#440910';
            targetCtx.beginPath();
            targetCtx.arc(medCx, cy, Math.max(1.0, 3.5 * s), 0, Math.PI * 2);
            targetCtx.fill();
          };
          drawTrefoilCluster(jy);
        });
      }
    };

    drawSide(0);
    drawSide(1);
    targetCtx.restore();
  };

  drawGothicBorders(ctx, false);
  drawGothicBorders(ectx, true);

  // 4. LUT-Accelerated Pixel Pass: 45-deg Diamond-Quilted Tufting + Velvet Nap + Woven Warp/Weft
  //    + Subtle Worn Footstep Darkening Down Center Path + Matte Velvet Roughness [0.84..0.96]!
  const albedoImg = ctx.getImageData(0, 0, size, size);
  const aPix = albedoImg.data;
  const ePix = ectx.getImageData(0, 0, size, size).data;

  // Release temporary embroidery canvas backing store immediately
  embCanvas.width = 1;
  embCanvas.height = 1;

  const total = size * size;
  const heightData = new Float32Array(total);
  const roughData = new Float32Array(total);
  const aoData = new Float32Array(total);

  const nMacro = createTileableNoiseGrid(16, 26501);
  const nNap   = createTileableNoiseGrid(32, 26502);
  const nFiber = createTileableNoiseGrid(64, 26503);

  const lutMacro = buildNoiseAxisLUT(nMacro, size, 2);
  const lutNap   = buildNoiseAxisLUT(nNap, size, 5);
  const lutFiber = buildNoiseAxisLUT(nFiber, size, 10);

  const gMacro = nMacro.grid;
  const gNap   = nNap.grid;
  const gFiber = nFiber.grid;

  const mX0 = lutMacro.x0, mX1 = lutMacro.x1, mSx = lutMacro.sx;
  const nX0 = lutNap.x0,   nX1 = lutNap.x1,   nSx = lutNap.sx;
  const fX0 = lutFiber.x0, fX1 = lutFiber.x1, fSx = lutFiber.sx;

  const invSize = 1 / size;
  const sMacroY = 2 * nMacro.size * invSize;
  const sNapY   = 5 * nNap.size * invSize;
  const sFiberY = 10 * nFiber.size * invSize;

  // Precompute horizontal woven warp & embroidery stitch trigonometric LUTs
  const TWO_PI = Math.PI * 2;
  const wxLUT = new Float32Array(size);
  const twSinXLUT = new Float32Array(size);
  const twCosXLUT = new Float32Array(size);
  const stSinXLUT = new Float32Array(size);
  const stCosXLUT = new Float32Array(size);

  for (let x = 0; x < size; x++) {
    const u = x * invSize;
    wxLUT[x] = Math.sin(u * 128.0 * TWO_PI);
    const ta = u * 96.0 * TWO_PI;
    twSinXLUT[x] = Math.sin(ta);
    twCosXLUT[x] = Math.cos(ta);
    const sa = u * 160.0 * TWO_PI;
    stSinXLUT[x] = Math.sin(sa);
    stCosXLUT[x] = Math.cos(sa);
  }

  for (let y = 0; y < size; y++) {
    const rowOff = y * size;
    const v = y * invSize;
    const q = v * dRows;

    const wy = Math.sin(v * 192.0 * TWO_PI);
    const tya = v * 96.0 * TWO_PI;
    const tySin = Math.sin(tya);
    const tyCos = Math.cos(tya);
    const sya = v * 160.0 * TWO_PI;
    const sySin = Math.sin(sya);
    const syCos = Math.cos(sya);

    const rm = sampleRowParams(nMacro, y * sMacroY);
    const rn = sampleRowParams(nNap, y * sNapY);
    const rf = sampleRowParams(nFiber, y * sFiberY);

    const mR0 = rm.r0, mR1 = rm.r1, mSy = rm.sy;
    const nR0 = rn.r0, nR1 = rn.r1, nSy = rn.sy;
    const fR0 = rf.r0, fR1 = rf.r1, fSy = rf.sy;

    for (let x = 0; x < size; x++) {
      const idx = rowOff + x;
      const p4 = idx * 4;
      const u = x * invSize;

      const embGold = ePix[p4] * (1 / 255);
      const damask  = ePix[p4 + 1] * (1 / 255);
      const piping  = ePix[p4 + 2] * (1 / 255);

      const mx0 = mX0[x], mx1 = mX1[x], msx = mSx[x];
      const nm0 = gMacro[mR0 + mx0] + (gMacro[mR0 + mx1] - gMacro[mR0 + mx0]) * msx;
      const nm1 = gMacro[mR1 + mx0] + (gMacro[mR1 + mx1] - gMacro[mR1 + mx0]) * msx;
      const macroN = nm0 + (nm1 - nm0) * mSy;

      const nx0 = nX0[x], nx1 = nX1[x], nsx = nSx[x];
      const nn0 = gNap[nR0 + nx0] + (gNap[nR0 + nx1] - gNap[nR0 + nx0]) * nsx;
      const nn1 = gNap[nR1 + nx0] + (gNap[nR1 + nx1] - gNap[nR1 + nx0]) * nsx;
      const napN = nn0 + (nn1 - nn0) * nSy;

      const fx0 = fX0[x], fx1 = fX1[x], fsx = fSx[x];
      const nf0 = gFiber[fR0 + fx0] + (gFiber[fR0 + fx1] - gFiber[fR0 + fx0]) * fsx;
      const nf1 = gFiber[fR1 + fx0] + (gFiber[fR1 + fx1] - gFiber[fR1 + fx0]) * fsx;
      const fiberN = nf0 + (nf1 - nf0) * fSy;

      // Woven heavy carpet warp/weft & diagonal twill rib
      const twill = twSinXLUT[x] * tyCos + twCosXLUT[x] * tySin;
      const weave = wxLUT[x] * 0.36 + wy * 0.36 + twill * 0.28;

      // Subtle worn footstep path darkening down center lane (u ~ 0.50, organic wavy profile along V)
      const centerDist = Math.abs(u - 0.50);
      const pathWobble = (macroN - 0.5) * 0.068 + (napN - 0.5) * 0.036;
      const pathRaw = clamp01(1.0 - Math.max(0, centerDist + pathWobble - 0.035) / 0.24);
      const pathMask = pathRaw * pathRaw * (3 - 2 * pathRaw);
      const treadNoise = clamp01(0.56 + (macroN - 0.5) * 0.65 + (napN - 0.5) * 0.48);
      const footWear = pathMask * treadNoise;

      // 45-degree diamond-quilted tufting inside crimson velvet center field (u in [0.18..0.82])
      let fieldMask = 0;
      if (u > 0.174 && u < 0.826) {
        const edgeIn = clamp01((Math.min(u - 0.174, 0.826 - u)) / 0.014);
        fieldMask = edgeIn * edgeIn * (3 - 2 * edgeIn);
      }

      let pillow = 0;
      let crease = 0;
      let tuftDot = 0;
      if (fieldMask > 0.001) {
        const p = ((u - 0.18) / 0.64) * dCols;
        const s1 = p + q;
        const f1 = s1 - Math.floor(s1);
        const d1 = f1 < 0.5 ? f1 : 1.0 - f1;
        const s2 = p - q;
        const f2 = s2 - Math.floor(s2);
        const d2 = f2 < 0.5 ? f2 : 1.0 - f2;
        const dMin = d1 < d2 ? d1 : d2;

        // Plush flat-topped velvet cushion puff (matched to Throne_Worn_Crimson_Velvet_normal)
        // with tight stitched crease channels & subtle intersection tuft dimples
        pillow = Math.pow(clamp01(d1 * 2.0), 0.32) * Math.pow(clamp01(d2 * 2.0), 0.32);
        crease = Math.exp(-dMin * dMin * 460.0);
        tuftDot = Math.exp(-(d1 * d1 + d2 * d2) * 165.0);
      }

      // Outer hem bevel tucking edges smoothly down toward stone floor
      const edgeDist = u < 0.5 ? u : 1.0 - u;
      const hemBevel = clamp01(edgeDist / 0.016);

      // Raised bullion gold filigree stitches & braided hem piping height
      let embBump = 0;
      if (embGold > 0.02) {
        const stitchRib = (stSinXLUT[x] * syCos + stCosXLUT[x] * sySin) * 0.045;
        embBump = embGold * (0.20 + stitchRib);
      }
      let pipeBump = 0;
      if (piping > 0.02) {
        const ropeTwist = Math.sin((v * 32.0 + edgeDist * 140.0) * TWO_PI) * 0.052;
        pipeBump = piping * (0.15 + ropeTwist);
      }

      // Combined heightfield (quilt puff softens slightly along trodden footstep center path)
      const quiltHeight = fieldMask * (pillow * 0.165 * (1.0 - footWear * 0.24) - crease * 0.145 - tuftDot * 0.085);
      const damaskBump = damask * 0.058;
      const fabricGrain = weave * 0.044 + (fiberN - 0.5) * 0.046 + (napN - 0.5) * 0.030;

      heightData[idx] = clamp01(
        (0.40 + quiltHeight + damaskBump + embBump + pipeBump + fabricGrain) * (0.35 + 0.65 * hemBevel)
      );

      // Physical AO (.r): deep shadow in quilted stitch seams, border gutters & outer hem lip
      let ao = 0.84 + fieldMask * (pillow * 0.14 - crease * 0.44 - tuftDot * 0.24) + embGold * 0.10;
      ao *= (0.45 + 0.55 * hemBevel);
      ao -= footWear * 0.08;
      aoData[idx] = ao < 0.18 ? 0.18 : ao > 1.0 ? 1.0 : ao;

      // Albedo shading: quilted puff depth, throne-style mottled age patina, velvet weave & footstep tread wear
      let r = aPix[p4];
      let g = aPix[p4 + 1];
      let b = aPix[p4 + 2];

      // Throne-style organic dark soot/age mottling
      const ageCloud = clamp01((macroN * 0.65 + napN * 0.35 - 0.54) * 2.3);
      const velvetShade =
        (1.0 + weave * 0.045 + (napN - 0.5) * 0.11 + (fiberN - 0.5) * 0.06) *
        (1.0 - ageCloud * 0.22);

      // Diamond-quilted crimson velvet highlight on puffs & deep stitched shadow seams
      const quiltShade = 1.0 + fieldMask * (pillow * 0.22 - 0.08 - crease * 0.62 - tuftDot * 0.34);

      r *= velvetShade * quiltShade;
      g *= velvetShade * quiltShade;
      b *= velvetShade * quiltShade;

      // Subtle worn footstep darkening & ground-in castle ash dust down center path
      if (footWear > 0.01) {
        const wearDark = 1.0 - footWear * 0.22;
        r *= wearDark;
        g *= wearDark;
        b *= wearDark;
        const dustMix = footWear * 0.095 * (1.0 - embGold * 0.6);
        r = r + (52 + fiberN * 14 - r) * dustMix;
        g = g + (42 + fiberN * 12 - g) * dustMix;
        b = b + (40 + fiberN * 12 - b) * dustMix;
      }

      aPix[p4]     = r < 0 ? 0 : r > 255 ? 255 : (r | 0);
      aPix[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : (g | 0);
      aPix[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : (b | 0);

      // Matte velvet & tarnished bullion roughness [0.84..0.96] — ZERO plastic shine!
      let rough = 0.905 - fieldMask * pillow * 0.028 + fieldMask * crease * 0.048 + (napN - 0.5) * 0.036 + weave * 0.012;
      rough += footWear * 0.042;
      if (embGold > 0.02) {
        const goldThreadR = 0.846 + (fiberN - 0.5) * 0.022 + (1.0 - embGold) * 0.024;
        rough = rough + (goldThreadR - rough) * (embGold * (1.0 - footWear * 0.40));
      }
      if (edgeDist < 0.046) {
        rough = Math.max(rough, 0.92 + (fiberN - 0.5) * 0.03);
      }
      roughData[idx] = rough < 0.84 ? 0.84 : rough > 0.96 ? 0.96 : rough;
    }
  }

  ctx.putImageData(albedoImg, 0, 0);

  // Clamp U across carpet width (zero border bleed!), seamless Repeat along V runner length!
  const albedo = finalizeCanvasTexture(albedoCanvas, { isColor: true, repeatX: false, repeatY: true, anisotropy });
  const normal = buildNormalMapFromHeight(heightData, size, size, 1.05, 1.05, 0.30, anisotropy, false, true);
  const orm = buildOrmMapFromFields(aoData, roughData, size, size, anisotropy, false, true);

  return { albedo, normal, roughness: orm, ao: orm };
}

// ============================================================================
// 6. 2x2 Storytelling Ground Decal Atlas (2048px PC / 512px Mobile)
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
  const qScale = half / 256; // 4.0 on 2048px PC, 1.0 on 512px Mobile
  const rand = makeRng(269951);

  // Quadrant (0,0) [q=0]: Shattered Stone Impact Cracks
  ctx.save();
  ctx.beginPath();
  ctx.rect(4 * qScale, 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 0.5;
    const cy = half * 0.5;

    const crater = ctx.createRadialGradient(cx, cy, 4 * qScale, cx, cy, 114 * qScale);
    crater.addColorStop(0.00, 'rgba(5, 6, 10, 0.84)');
    crater.addColorStop(0.32, 'rgba(9, 10, 16, 0.56)');
    crater.addColorStop(0.68, 'rgba(13, 15, 22, 0.20)');
    crater.addColorStop(1.00, 'rgba(13, 15, 22, 0.0)');
    ctx.fillStyle = crater;
    ctx.beginPath();
    ctx.arc(cx, cy, 114 * qScale, 0, Math.PI * 2);
    ctx.fill();

    for (let ring = 0; ring < 2; ring++) {
      const rBase = (ring === 0 ? 36 : 68) * qScale;
      const segs = 14 + ring * 6;
      ctx.strokeStyle = ring === 0 ? 'rgba(5, 6, 11, 0.80)' : 'rgba(8, 10, 16, 0.52)';
      ctx.lineWidth = (ring === 0 ? 2.5 : 1.5) * qScale;
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

    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + (rand() - 0.5) * 0.26;
      const pts = [[cx + Math.cos(ang) * 4 * qScale, cy + Math.sin(ang) * 4 * qScale]];
      for (let s = 1; s <= 5; s++) {
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

    for (let k = 0; k < 32; k++) {
      const a = rand() * Math.PI * 2;
      const dist = (14 + rand() * 90) * qScale;
      const px = cx + Math.cos(a) * dist;
      const py = cy + Math.sin(a) * dist;
      const pr = (1.6 + rand() * 4.2) * qScale;
      ctx.fillStyle = 'rgba(4, 5, 8, 0.68)';
      ctx.beginPath();
      ctx.ellipse(px + 1.2 * qScale, py + 1.2 * qScale, pr * 1.15, pr * 0.78, a, 0, Math.PI * 2);
      ctx.fill();
      const lum = 60 + Math.floor(rand() * 32);
      ctx.fillStyle = `rgba(${lum}, ${lum + 3}, ${lum + 10}, 0.72)`;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.68, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Quadrant (1,0) [q=1]: Coagulated Battle Bloodstain
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
      g.addColorStop(0.00, 'rgba(46, 7, 9, 0.76)');
      g.addColorStop(0.62, 'rgba(58, 9, 12, 0.50)');
      g.addColorStop(0.84, 'rgba(40, 10, 11, 0.24)');
      g.addColorStop(1.00, 'rgba(26, 5, 7, 0.0)');
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
      g.addColorStop(0.00, 'rgba(28, 4, 6, 0.88)');
      g.addColorStop(0.70, 'rgba(64, 8, 11, 0.74)');
      g.addColorStop(0.90, 'rgba(40, 5, 8, 0.54)');
      g.addColorStop(1.00, 'rgba(28, 4, 6, 0.0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let s = 0; s < 18; s++) {
      const a = rand() * Math.PI * 2;
      const d0 = (24 + rand() * 36) * qScale;
      const d1 = d0 + (22 + rand() * 48) * qScale;
      ctx.strokeStyle = 'rgba(52, 7, 10, 0.64)';
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
      ctx.fillStyle = rand() > 0.4 ? 'rgba(56, 8, 11, 0.74)' : 'rgba(34, 5, 8, 0.80)';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, dr * 1.38, dr * 0.62, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Quadrant (0,1) [q=2]: Damp Wall-Base Moss & Lichen
  ctx.save();
  ctx.beginPath();
  ctx.rect(4 * qScale, half + 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 0.5;
    const cy = half * 1.5;

    const damp = ctx.createRadialGradient(cx, cy, 10 * qScale, cx, cy, 112 * qScale);
    damp.addColorStop(0.00, 'rgba(11, 16, 10, 0.58)');
    damp.addColorStop(0.62, 'rgba(15, 20, 13, 0.28)');
    damp.addColorStop(1.00, 'rgba(15, 20, 13, 0.0)');
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
        g.addColorStop(0.0, 'rgba(38, 60, 28, 0.74)');
        g.addColorStop(0.6, 'rgba(28, 44, 20, 0.42)');
        g.addColorStop(1.0, 'rgba(20, 32, 16, 0.0)');
      } else if (tone === 1) {
        g.addColorStop(0.0, 'rgba(54, 76, 36, 0.64)');
        g.addColorStop(0.6, 'rgba(38, 54, 26, 0.34)');
        g.addColorStop(1.0, 'rgba(24, 36, 18, 0.0)');
      } else {
        g.addColorStop(0.0, 'rgba(62, 74, 44, 0.52)');
        g.addColorStop(0.6, 'rgba(42, 52, 32, 0.24)');
        g.addColorStop(1.0, 'rgba(28, 36, 22, 0.0)');
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
      ctx.strokeStyle = 'rgba(34, 52, 24, 0.54)';
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
        ? 'rgba(112, 126, 88, 0.42)'
        : pick < 0.64
          ? 'rgba(64, 90, 42, 0.56)'
          : 'rgba(18, 30, 15, 0.52)';
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Quadrant (1,1) [q=3]: Ash Scorch & Melted Candle Wax
  ctx.save();
  ctx.beginPath();
  ctx.rect(half + 4 * qScale, half + 4 * qScale, half - 8 * qScale, half - 8 * qScale);
  ctx.clip();
  {
    const cx = half * 1.5;
    const cy = half * 1.5;

    const scorch = ctx.createRadialGradient(cx, cy, 6 * qScale, cx, cy, 110 * qScale);
    scorch.addColorStop(0.00, 'rgba(7, 6, 9, 0.88)');
    scorch.addColorStop(0.38, 'rgba(16, 14, 17, 0.62)');
    scorch.addColorStop(0.68, 'rgba(50, 44, 42, 0.26)');
    scorch.addColorStop(0.86, 'rgba(84, 78, 74, 0.10)');
    scorch.addColorStop(1.00, 'rgba(22, 18, 20, 0.0)');
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
      sg.addColorStop(0.0, 'rgba(11, 9, 11, 0.48)');
      sg.addColorStop(1.0, 'rgba(11, 9, 11, 0.0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

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
      ctx.strokeStyle = 'rgba(184, 168, 134, 0.44)';
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
      wg.addColorStop(0.00, 'rgba(214, 200, 168, 0.58)');
      wg.addColorStop(0.62, 'rgba(176, 160, 126, 0.42)');
      wg.addColorStop(1.00, 'rgba(126, 112, 88, 0.14)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(w.x, w.y, w.rx, w.ry, w.rot, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(244, 234, 210, 0.34)';
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
    const vEnv = Math.sin(v * Math.PI);
    const vProfile = Math.pow(vEnv, 0.55);

    const ra = sampleRowParams(nA, y * sAY);
    const rb = sampleRowParams(nB, y * sBY);
    const rc = sampleRowParams(nC, y * sCY);

    const aR0 = ra.r0, aR1 = ra.r1, aSy = ra.sy;
    const bR0 = rb.r0, bR1 = rb.r1, bSy = rb.sy;
    const cR0 = rc.r0, cR1 = rc.r1, cSy = rc.sy;

    for (let x = 0; x < size; x++) {
      const ax0 = aX0[x], ax1 = aX1[x], asx = aSx[x];
      const fA0 = gA[aR0 + ax0] + (gA[aR0 + ax1] - gA[aR0 + ax0]) * asx;
      const fA1 = gA[aR1 + ax0] + (gA[aR1 + ax1] - gA[aR1 + ax0]) * asx;
      const fA = fA0 + (fA1 - fA0) * aSy;

      const bx0 = bX0[x], bx1 = bX1[x], bsx = bSx[x];
      const fB0 = gB[bR0 + bx0] + (gB[bR0 + bx1] - gB[bR0 + bx0]) * bsx;
      const fB1 = gB[bR1 + bx0] + (gB[bR1 + bx1] - gB[bR1 + bx0]) * bsx;
      const fB = fB0 + (fB1 - fB0) * bSy;

      const cx0 = cX0[x], cx1 = cX1[x], csx = cSx[x];
      const fC0 = gC[cR0 + cx0] + (gC[cR0 + cx1] - gC[cR0 + cx0]) * csx;
      const fC1 = gC[cR1 + cx0] + (gC[cR1 + cx1] - gC[cR1 + cx0]) * csx;
      const fC = fC0 + (fC1 - fC0) * cSy;

      const fbm = fA * 0.56 + fB * 0.30 + fC * 0.14;
      const wisp = Math.sin((v * 2.5 + fA * 2.2 + fB * 0.9) * Math.PI) * 0.5 + 0.5;
      const density = clamp01((0.30 + fbm * 0.48 + wisp * 0.22) * vProfile);

      const goldMix = clamp01((fbm * 0.7 + wisp * 0.45) * 1.05);
      const r = (204 + goldMix * 46) | 0;
      const g = (208 + goldMix * 32) | 0;
      const b = (228 - goldMix * 24) | 0;
      const a = (density * 218) | 0;

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
// Public 2K PBR Suite Factory (PC: 2048x2048 | Mobile: 512x512)
// ============================================================================
export function createSoulsPbrTextures({ isMobile = false } = {}) {
  const texSize = isMobile ? 512 : 1024;
  const ironSize = isMobile ? 256 : 512;
  const carpetSize = isMobile ? 256 : 512;
  const bannerW = isMobile ? 256 : 512;
  const bannerH = isMobile ? 512 : 1024;
  const fogSize = isMobile ? 256 : 512;
  const anisotropy = isMobile ? 2 : 4;

  // Reuse a single temporary height canvas across the 3 square 2K stone generators (saves ~32MB RAM!)
  const sharedHeightCanvas = createCanvas2D(texSize, texSize);

  const floor = createFlagstonePbrSet(texSize, anisotropy, sharedHeightCanvas);
  const ashlar = createAshlarPbrSet(texSize, anisotropy, sharedHeightCanvas);
  const vaultStone = createVaultStonePbrSet(texSize, anisotropy, sharedHeightCanvas);

  // Release temporary 2K height canvas backing store immediately
  if (sharedHeightCanvas) {
    sharedHeightCanvas.width = 1;
    sharedHeightCanvas.height = 1;
  }

  const banner = createBannerPbrSet(bannerW, bannerH, anisotropy);
  const iron = createIronPbrSet(ironSize, anisotropy);
  const carpet = createCarpetPbrSet(carpetSize, anisotropy);
  const decalAtlas = createDecalAtlasTexture(texSize, anisotropy);
  const fogWall = createFogWallTexture(fogSize, anisotropy);
  const abyssMist = createAbyssMistTexture(anisotropy);

  // Deduplicated texture set (ORM textures serve both .roughness and .ao with zero duplicate VRAM!)
  const uniqueTextures = Array.from(new Set([
    floor.albedo, floor.normal, floor.roughness, floor.ao,
    ashlar.albedo, ashlar.normal, ashlar.roughness, ashlar.ao,
    vaultStone.albedo, vaultStone.normal, vaultStone.roughness, vaultStone.ao,
    banner.albedo, banner.normal, banner.roughness, banner.ao,
    iron.normal, iron.roughness, iron.ao,
    carpet.albedo, carpet.normal, carpet.roughness, carpet.ao,
    decalAtlas, fogWall, abyssMist
  ])).filter(Boolean);

  return {
    maxResolution: texSize,

    // Core Flagstone Floor 2K PBR + AO
    floorAlbedo: floor.albedo,
    floorNormal: floor.normal,
    floorRoughness: floor.roughness,
    floorAo: floor.ao,

    // Carved Gothic Ashlar Stone 2K PBR + AO
    ashlarAlbedo: ashlar.albedo,
    ashlarNormal: ashlar.normal,
    ashlarRoughness: ashlar.roughness,
    ashlarAo: ashlar.ao,

    // Soot-Stained Cathedral Vault Stone 2K PBR + AO
    vaultStoneAlbedo: vaultStone.albedo,
    vaultStoneNormal: vaultStone.normal,
    vaultStoneRoughness: vaultStone.roughness,
    vaultStoneAo: vaultStone.ao,

    // Royal Heraldic Tapestry / Velvet Banner 2K PBR + AO
    bannerAlbedo: banner.albedo,
    bannerNormal: banner.normal,
    bannerRoughness: banner.roughness,
    bannerAo: banner.ao,

    // Hand-Forged Hammered Wrought Iron 1K PBR + AO
    ironNormal: iron.normal,
    ironRoughness: iron.roughness,
    ironAo: iron.ao,

    // Royal Crimson-Velvet Ornate Runner Carpet 1K PBR + AO
    carpetAlbedo: carpet.albedo,
    carpetNormal: carpet.normal,
    carpetRoughness: carpet.roughness,
    carpetAo: carpet.ao,

    // Storytelling Ground Decals & Atmospheric Mist
    decalAtlas,
    fogWall,
    abyssMist,

    dispose() {
      for (let i = 0; i < uniqueTextures.length; i++) {
        uniqueTextures[i]?.dispose?.();
      }
      uniqueTextures.length = 0;
    }
  };
}
