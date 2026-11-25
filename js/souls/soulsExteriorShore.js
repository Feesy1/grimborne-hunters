// Chapter 26 Escape Finale & Free-Roam Exterior World — «Берег Пепельного Стока»
// AAA Dark Souls III / Elden Ring / Bloodborne Visual Overhaul (z92)
// Pure Vanilla ES Module (Three.js r160, ZERO external textures, ZERO external imports, 60+ FPS, 0 VRAM leaks).
//
// Exports:
//   - EXTERIOR_SHORE_ANCHORS
//   - createSoulsExteriorShore(THREE, opts = {})
//
// Builds 3 cleanly isolated 3D scenic groups under `rootGroup` controlled by `setStageMode(mode)`:
//   A) `chasmOverlayGroup`  ('chasm_only')     — Act 3: 4.6m jagged WebGL Stencil-portal chasm in the Throne Hall floor
//                                                (full overhead + abyss upward view down to y=-24m w/ rocky ledges,
//                                                molten fiery rim, backlit smoky cathedral vault & 18 falling chunks).
//   B) `shaftAndRiverGroup` ('shaft_river')    — Act 4: Full 360° gothic stone shaft (y=-2..+26m) w/ inward-facing
//                                                relieved masonry, ring arches every 5m, hanging iron chains, roots,
//                                                snapped beams, ragged overhead breach + 3 volumetric crimson-gold
//                                                god-ray cones, vaulted river tunnel, AAA dark-slate whitewater river
//                                                shader & explosive forged-iron grate break (5 central bars ripped
//                                                78–96° wide open + 6 flying 3D shards + sparks & water spray!).
//   C) `exteriorGroup`      ('exterior_shore') — Act 5 + Full Free-Roam Gameplay (~46x54m):
//                                                Multi-octave displaced basalt cliffs & crags, monumental Gothic
//                                                Cathedral-Citadel Castle of Ash (flying buttresses, real stone
//                                                tracery pointed windows & rose wheel, volumetric crimson-gold glow,
//                                                weathervanes, rising ash), giant cratered moon w/ 3-layer halo &
//                                                floating cliff-base night clouds, multi-layered 3D outfall waterfall
//                                                w/ ripped iron grate, AAA moonlit gorge river, rolling ground mist,
//                                                monumental Gothic Gate of the Ash Gorge w/ golden-silver Boss Fog
//                                                swirl veil & twin ornate braziers, arching bog reeds, gnarled dead
//                                                pines, broken skiff wreckage, Shore Bonfire & real 3D Oath Sword slot.

// ============================================================================
// Pure Math, Deterministic PRNG, Terrain Height & River Course (Single Source of Truth)
// ============================================================================
import {
  WATER_LEVEL,
  GORGE_ANCHORS,
  GORGE_FIRE_SOURCES,
  GORGE_INTERACTABLES,
  RIVER_REACH_LIFT_MIN_Y,
  RIVER_REACH_LIFT_MAX_Y,
  evalRiverReachBaseTerrainY,
  getGorgePathCenterX,
  getGorgeRiverCenterX,
  getGorgeRiverHalfWidth,
  getGorgeRiverSignedDist,
  evalBaseTerrainY,
  evalGorgeGroundY,
  evalGorgeSurfaceType,
  clampGorgePosition,
  getGorgeZoneTitleAt
} from './soulsGorgeTopology.js?v=20261125z104';
import {
  createSoulsGorgeRoad,
  createGorgePbrTextures
} from './soulsGorgeRoad.js?v=20261125z104';
import { createSoulsRiverReachEast } from './soulsRiverReachEast.js?v=20261125z104';
import { createSoulsRiverReachNorth } from './soulsRiverReachNorth.js?v=20261125z104';
import {
  createGorgeSkyMaterial,
  createGorgeRiverMaterial,
  createValleyMistRig
} from './soulsGorgeAtmosphere.js?v=20261125z104';
import {
  createStylizedGorgeTerrainMaterial,
  createMossCoatedStoneMaterial
} from './soulsGorgeTerrainMat.js?v=20261125z104';

const CHASM_STENCIL_ID = 65; // 0x41: odd bit-0 masks bossRing; far outside world.js crater pool slots (3..33)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = clamp01((x - edge0) / denom);
  return t * t * (3.0 - 2.0 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Single Source of Truth delegated to `soulsGorgeTopology.js` (Zone 0 Shore + Multi-Elevation Dark Souls Gorge!)
const getRiverCenterX = getGorgeRiverCenterX;
const getRiverHalfWidth = getGorgeRiverHalfWidth;
const getRiverSignedDist = getGorgeRiverSignedDist;
const getPathCenterX = getGorgePathCenterX;

function evalExteriorGroundY(x, z, currentY, state) {
  if (Number.isFinite(currentY)) {
    return evalGorgeGroundY(x, z, currentY, state);
  }
  return evalBaseTerrainY(x, z);
}

function evalExteriorSurfaceType(x, z, currentY, state) {
  return evalGorgeSurfaceType(x, z, currentY, state);
}

function clampExteriorPosition(x, z, r = 0.55, opts = null) {
  const cy = Number.isFinite(opts?.currentY) ? opts.currentY : 0.0;
  return clampGorgePosition(x, z, cy, r, opts, opts?.out || null);
}

function getExteriorZoneTitleAt(x, z, currentY) {
  return getGorgeZoneTitleAt(x, z, currentY);
}

export const EXTERIOR_SHORE_ANCHORS = Object.freeze({
  ...GORGE_ANCHORS,
  shaftCenter: Object.freeze({ x: 0.0, y: 0.0, z: 0.0 }),
  gratePos: Object.freeze({ x: 0.0, y: 1.8, z: 26.0 })
});

// ============================================================================
// Jagged Chasm Rim Curve (shared 1:1 between stencil aperture, shaft walls & rim crack shader)
// ============================================================================
function evalChasmEdgeR(theta) {
  return (
    2.28 +
    0.18 * Math.sin(theta * 5.0 + 0.35) +
    0.13 * Math.cos(theta * 8.0 - 0.85) +
    0.09 * Math.sin(theta * 13.0 + 1.55) +
    0.05 * Math.cos(theta * 19.0 - 0.4)
  );
}

// ============================================================================
// Procedural PBR Texture Suite (Zero External Assets, Anti-Shimmer Sobel Normals)
// ============================================================================
function createCanvas2D(w, h) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function createFallbackTex(THREE, r, g, b, a, isColor, repeat = true) {
  const data = new Uint8Array([r, g, b, a, r, g, b, a, r, g, b, a, r, g, b, a]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function finalizeCanvasTex(THREE, canvas, { isColor = true, repeat = true, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildSobelNormalTex(THREE, heightField, w, h, strength, anisotropy, repeat = true) {
  const data = new Uint8Array(w * h * 4);
  const wm = w - 1;
  const hm = h - 1;
  const r2 = Math.max(2, Math.round(w / 256) * 2);
  for (let y = 0; y < h; y++) {
    const ym1 = ((y - 1) & hm) * w;
    const y0 = y * w;
    const yp1 = ((y + 1) & hm) * w;
    const ym2 = ((y - r2) & hm) * w;
    const yp2 = ((y + r2) & hm) * w;
    const dstRow = (hm - y) * w;
    for (let x = 0; x < w; x++) {
      const xm1 = (x - 1) & wm;
      const xp1 = (x + 1) & wm;
      const xm2 = (x - r2) & wm;
      const xp2 = (x + r2) & wm;

      const dx1 =
        (heightField[ym1 + xp1] + 2 * heightField[y0 + xp1] + heightField[yp1 + xp1]) -
        (heightField[ym1 + xm1] + 2 * heightField[y0 + xm1] + heightField[yp1 + xm1]);
      const dy1 =
        (heightField[yp1 + xm1] + 2 * heightField[yp1 + x] + heightField[yp1 + xp1]) -
        (heightField[ym1 + xm1] + 2 * heightField[ym1 + x] + heightField[ym1 + xp1]);

      const dx2 = heightField[y0 + xp2] - heightField[y0 + xm2];
      const dy2 = heightField[yp2 + x] - heightField[ym2 + x];

      let nx = -(dx1 * strength + dx2 * strength * 1.4);
      let ny =  (dy1 * strength + dy2 * strength * 1.4);
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
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function buildOrmTex(THREE, aoField, roughField, w, h, anisotropy, repeat = true) {
  const data = new Uint8Array(w * h * 4);
  const hm = h - 1;
  for (let y = 0; y < h; y++) {
    const srcRow = y * w;
    const dstRow = (hm - y) * w;
    for (let x = 0; x < w; x++) {
      const si = srcRow + x;
      const aoB = (clamp01(aoField[si]) * 255 + 0.5) | 0;
      const rgB = (clamp01(roughField[si]) * 255 + 0.5) | 0;
      const idx = (dstRow + x) * 4;
      data[idx]     = aoB;
      data[idx + 1] = rgB;
      data[idx + 2] = rgB;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.flipY = false;
  tex.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function makeNoiseSampler(gridSize, seed) {
  const rng = makeRng(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const mask = gridSize - 1;
  return (u, v) => {
    const gx = u * gridSize;
    const gy = v * gridSize;
    const x0 = Math.floor(gx) & mask;
    const y0 = Math.floor(gy) & mask;
    const x1 = (x0 + 1) & mask;
    const y1 = (y0 + 1) & mask;
    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const r0 = y0 * gridSize;
    const r1 = y1 * gridSize;
    const n0 = grid[r0 + x0] + (grid[r0 + x1] - grid[r0 + x0]) * sx;
    const n1 = grid[r1 + x0] + (grid[r1 + x1] - grid[r1 + x0]) * sx;
    return n0 + (n1 - n0) * sy;
  };
}

// 1) Wet Coastal Pebble, Volcanic Silt & Slate Shingle PBR (Shore Terrain)
function buildShorePebblePbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  const hc = createCanvas2D(size, size);
  if (!c || !hc) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 46, 50, 60, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 210, 175, 175, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  const rng = makeRng(774101);
  const sc = size / 512;

  ctx.fillStyle = '#161a22';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#1a1a1a';
  hctx.fillRect(0, 0, size, size);

  const tones = [
    [42, 47, 58],
    [52, 57, 69],
    [34, 38, 48],
    [60, 64, 75],
    [46, 52, 60],
    [40, 48, 50],
    [68, 72, 84]
  ];

  const drawWrapped = (fn, x, y, r) => {
    const ox0 = x + r > size ? -size : 0;
    const ox1 = x - r < 0 ? size : 0;
    const oy0 = y + r > size ? -size : 0;
    const oy1 = y - r < 0 ? size : 0;
    for (let ox = ox0; ox <= ox1; ox += size) {
      for (let oy = oy0; oy <= oy1; oy += size) {
        ctx.save();
        hctx.save();
        ctx.translate(ox, oy);
        hctx.translate(ox, oy);
        fn();
        ctx.restore();
        hctx.restore();
      }
    }
  };

  const cobbleCount = Math.round(110 * (size >= 1024 ? 1.35 : 1.0));
  for (let i = 0; i < cobbleCount; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const rx = (11 + rng() * 23) * sc;
    const ry = (8 + rng() * 16) * sc;
    const rot = rng() * Math.PI;
    const t = tones[Math.floor(rng() * tones.length)];
    const sh = Math.floor((rng() - 0.5) * 16);
    const rr = clamp(t[0] + sh, 18, 94);
    const gg = clamp(t[1] + sh, 20, 98);
    const bb = clamp(t[2] + sh, 26, 112);
    const hv = Math.round(128 + rng() * 90);

    drawWrapped(() => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(5,7,11,0.58)';
      ctx.lineWidth = 1.8 * sc;
      ctx.stroke();

      const g = hctx.createRadialGradient(cx, cy, rx * 0.08, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, `rgb(${hv},${hv},${hv})`);
      g.addColorStop(0.76, `rgb(${Math.round(hv * 0.72)},${Math.round(hv * 0.72)},${Math.round(hv * 0.72)})`);
      g.addColorStop(1, 'rgb(24,24,24)');
      hctx.beginPath();
      hctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      hctx.fillStyle = g;
      hctx.fill();
    }, cx, cy, Math.max(rx, ry) + 4 * sc);
  }

  const pebbleCount = Math.round(480 * (size >= 1024 ? 1.35 : 1.0));
  for (let i = 0; i < pebbleCount; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const rx = (2.8 + rng() * 8.8) * sc;
    const ry = rx * (0.55 + rng() * 0.44);
    const rot = rng() * Math.PI;
    const t = tones[Math.floor(rng() * tones.length)];
    const sh = Math.floor((rng() - 0.5) * 26);
    const rr = clamp(t[0] + sh, 16, 110);
    const gg = clamp(t[1] + sh, 18, 114);
    const bb = clamp(t[2] + sh, 22, 126);
    const hv = Math.round(145 + rng() * 98);

    drawWrapped(() => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(5,7,11,0.45)';
      ctx.lineWidth = Math.max(1, 1.0 * sc);
      ctx.stroke();

      hctx.beginPath();
      hctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fill();
    }, cx, cy, rx + 2 * sc);
  }

  const aImg = ctx.getImageData(0, 0, size, size);
  const aPix = aImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const nWet = makeNoiseSampler(16, 4401);
  const nGrain = makeNoiseSampler(64, 4402);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const bh = hPix[p4] * (1 / 255);
      const gr = nGrain(u * 4, v * 4);
      const wet = nWet(u * 2, v * 2);
      heightF[idx] = clamp01(bh * 0.72 + gr * 0.28);
      aoF[idx] = clamp01(0.46 + bh * 0.54);
      // Matte damp dark-fantasy coastal shingle & ash soil (ZERO plastic shiny brown ovals!)
      roughF[idx] = clamp01(lerp(0.94, 0.72 + (1.0 - wet) * 0.18, smoothstep(0.22, 0.78, bh)));
      // Cool slate-charcoal shift + fine grain variation so pebbles feel natural & earthy
      const grainMod = 0.84 + gr * 0.28;
      aPix[p4]     = clamp(aPix[p4] * 0.90 * grainMod + 10, 0, 255) | 0;
      aPix[p4 + 1] = clamp(aPix[p4 + 1] * 0.96 * grainMod + 12, 0, 255) | 0;
      aPix[p4 + 2] = clamp(aPix[p4 + 2] * 1.12 * grainMod + 16, 0, 255) | 0;
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.45, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  hc.width = 1;
  hc.height = 1;
  return { albedo, normal, orm };
}

// 2) Stratified Wet Gothic Ashlar Masonry PBR (Shaft, Tunnel Vault, Outfall Arch, Ruined Gate)
function buildWetBasaltPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  const hc = createCanvas2D(size, size);
  if (!c || !hc) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 46, 50, 62, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 200, 185, 185, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const hctx = hc.getContext('2d', { willReadFrequently: true });
  const rng = makeRng(882103);
  const sc = size / 512;

  ctx.fillStyle = '#11141c';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#121212';
  hctx.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3 + (r % 2);
    const colW = size / cols;
    const xOff = (r % 2) * colW * 0.46;
    for (let k = -1; k <= cols; k++) {
      const bx = k * colW + xOff + 3 * sc;
      const by = r * rowH + 3 * sc;
      const bw = colW - 6 * sc;
      const bh = rowH - 6 * sc;
      const base = 64 + Math.floor(rng() * 34);
      const blu = base + 10 + Math.floor(rng() * 12);
      const hv = Math.round(145 + rng() * 94);

      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, `rgb(${base + 18},${base + 20},${blu + 20})`);
      g.addColorStop(0.52, `rgb(${base},${base + 3},${blu})`);
      g.addColorStop(1, `rgb(${Math.max(24, base - 16)},${Math.max(26, base - 14)},${Math.max(32, blu - 10)})`);
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, bw, bh);

      // Chiseled stone bevel highlight on upper edge
      ctx.fillStyle = 'rgba(175, 192, 224, 0.08)';
      ctx.fillRect(bx, by, bw, 3.0 * sc);

      // Damp dark moss/lichen along mortar ledges
      if (rng() < 0.40) {
        ctx.fillStyle = 'rgba(28, 52, 38, 0.32)';
        ctx.fillRect(bx, by, bw, bh * (0.18 + rng() * 0.22));
      }

      // Vertical water seepage streaks
      if (rng() < 0.35) {
        const sx = bx + bw * (0.15 + rng() * 0.70);
        const sg = ctx.createLinearGradient(sx, by, sx, by + bh);
        sg.addColorStop(0, 'rgba(8, 12, 18, 0.38)');
        sg.addColorStop(1, 'rgba(8, 12, 18, 0.04)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx, by, (4 + rng() * 7) * sc, bh);
      }

      // Cracks across masonry blocks
      ctx.strokeStyle = 'rgba(5,7,12,0.78)';
      ctx.lineWidth = (1.5 + rng() * 1.4) * sc;
      ctx.beginPath();
      const fx = bx + bw * (0.18 + rng() * 0.64);
      ctx.moveTo(fx, by);
      ctx.lineTo(fx + (rng() - 0.5) * 18 * sc, by + bh * 0.5);
      ctx.lineTo(fx + (rng() - 0.5) * 24 * sc, by + bh);
      ctx.stroke();

      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fillRect(bx + 2 * sc, by + 2 * sc, Math.max(2, bw - 4 * sc), Math.max(2, bh - 4 * sc));
      hctx.strokeStyle = 'rgb(18,18,18)';
      hctx.lineWidth = 3.2 * sc;
      hctx.beginPath();
      hctx.moveTo(fx, by);
      hctx.lineTo(fx + (rng() - 0.5) * 18 * sc, by + bh * 0.5);
      hctx.lineTo(fx + (rng() - 0.5) * 24 * sc, by + bh);
      hctx.stroke();
    }
  }

  const aImg = ctx.getImageData(0, 0, size, size);
  const aPix = aImg.data;
  const hPix = hctx.getImageData(0, 0, size, size).data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const nBroad = makeNoiseSampler(16, 8821);
  const nFine = makeNoiseSampler(64, 8822);
  const nDrip = makeNoiseSampler(32, 8823);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const bh = hPix[p4] * (1 / 255);
      const nb = nBroad(u * 2, v * 2);
      const nf = nFine(u * 5, v * 5);
      const drip = smoothstep(0.56, 0.84, nDrip(u * 6, v * 1.2));
      heightF[idx] = clamp01(bh * 0.72 + nb * 0.16 + nf * 0.12);
      aoF[idx] = clamp01(0.35 + bh * 0.65);
      // Glistening wet vertical seepage streaks (0.38) vs matte weathered stone (0.86)
      roughF[idx] = clamp01(lerp(0.56 + (1.0 - nb) * 0.26 + (1.0 - bh) * 0.12, 0.36, drip * 0.72));
      const mod = (0.80 + nb * 0.24 + nf * 0.16) * (1.0 - drip * 0.16);
      aPix[p4]     = clamp(aPix[p4] * mod, 0, 255) | 0;
      aPix[p4 + 1] = clamp(aPix[p4 + 1] * mod, 0, 255) | 0;
      aPix[p4 + 2] = clamp(aPix[p4 + 2] * mod, 0, 255) | 0;
    }
  }
  ctx.putImageData(aImg, 0, 0);

  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.55, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  hc.width = 1;
  hc.height = 1;
  return { albedo, normal, orm };
}

// 2b) Natural Jagged Volcanic Basalt Cliff Rock PBR (Stratified rock ledges, fissures & wet moss)
function buildNaturalCliffPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 38, 43, 54, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 195, 195, 195, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const aImg = ctx.createImageData(size, size);
  const aPix = aImg.data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);

  const nStrata = makeNoiseSampler(16, 6101);
  const nCrag = makeNoiseSampler(32, 6102);
  const nFine = makeNoiseSampler(64, 6103);
  const nMoss = makeNoiseSampler(16, 6104);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;

      const warp = nStrata(u * 2, v * 2) * 0.30;
      const colWave = nCrag(u * 5 + warp, v * 1.4);
      const ledgeWave = nCrag(u * 1.6, v * 6.5 + warp * 1.35);
      const fine = nFine(u * 8, v * 8);
      const ridge = 1.0 - Math.abs(colWave * 2.0 - 1.0);
      const fissure = Math.pow(clamp01(ridge), 4.6);
      const ledgeCrack = Math.pow(clamp01(1.0 - Math.abs(ledgeWave * 2.0 - 1.0)), 5.5);

      const hVal = clamp01(
        0.58 + (colWave - 0.5) * 0.38 + (ledgeWave - 0.5) * 0.26 + (fine - 0.5) * 0.16 - fissure * 0.44 - ledgeCrack * 0.36
      );
      heightF[idx] = hVal;
      aoF[idx] = clamp01(0.28 + hVal * 0.72);

      const mossNoise = nMoss(u * 3, v * 3);
      const mossMask = smoothstep(0.58, 0.84, mossNoise) * smoothstep(0.36, 0.74, hVal);
      const wetStreak = smoothstep(0.56, 0.84, nStrata(u * 5, v * 1));

      let r = lerp(42, 102, hVal) * (0.86 + fine * 0.28);
      let g = lerp(48, 112, hVal) * (0.86 + fine * 0.28);
      let b = lerp(60, 134, hVal) * (0.86 + fine * 0.28);
      r = lerp(r, 44, mossMask * 0.65);
      g = lerp(g, 78, mossMask * 0.65);
      b = lerp(b, 50, mossMask * 0.65);

      aPix[p4]     = clamp(r, 0, 255) | 0;
      aPix[p4 + 1] = clamp(g, 0, 255) | 0;
      aPix[p4 + 2] = clamp(b, 0, 255) | 0;
      aPix[p4 + 3] = 255;

      roughF[idx] = clamp01(lerp(0.92, 0.68, wetStreak * 0.72) + mossMask * 0.06);
    }
  }
  ctx.putImageData(aImg, 0, 0);
  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.95, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  return { albedo, normal, orm };
}

// 3) Corroded Rusty Forged Iron PBR (Outfall Grate, Chains, Braziers, Shields)
function buildRustyIronPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 68, 52, 46, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 210, 175, 175, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const aImg = ctx.createImageData(size, size);
  const aPix = aImg.data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const n1 = makeNoiseSampler(16, 3311);
  const n2 = makeNoiseSampler(32, 3312);
  const n3 = makeNoiseSampler(64, 3313);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const f1 = n1(u * 2, v * 2);
      const f2 = n2(u * 4, v * 4);
      const f3 = n3(u * 6, v * 6);
      const rustMask = smoothstep(0.40, 0.78, f1 * 0.60 + f2 * 0.28 + f3 * 0.12);
      const r = lerp(44, 128, rustMask) * (0.84 + f3 * 0.32);
      const g = lerp(48, 58, rustMask) * (0.84 + f3 * 0.32);
      const b = lerp(58, 34, rustMask) * (0.84 + f3 * 0.32);
      aPix[p4]     = clamp(r, 0, 255) | 0;
      aPix[p4 + 1] = clamp(g, 0, 255) | 0;
      aPix[p4 + 2] = clamp(b, 0, 255) | 0;
      aPix[p4 + 3] = 255;
      heightF[idx] = clamp01(0.56 - rustMask * 0.26 + (f2 - 0.5) * 0.24 + (f3 - 0.5) * 0.18);
      aoF[idx] = clamp01(0.62 + heightF[idx] * 0.38);
      roughF[idx] = clamp01(lerp(0.50, 0.92, rustMask));
    }
  }
  ctx.putImageData(aImg, 0, 0);
  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.35, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  return { albedo, normal, orm };
}

// 3b) Weathered Gnarled Bark & Driftwood PBR (Dead Pines, Broken Skiff Hull, Shaft Beams)
function buildWeatheredWoodPbr(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) {
    return {
      albedo: trackTex(createFallbackTex(THREE, 56, 46, 40, 255, true)),
      normal: trackTex(createFallbackTex(THREE, 128, 128, 255, 255, false)),
      orm: trackTex(createFallbackTex(THREE, 210, 215, 215, 255, false))
    };
  }
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const aImg = ctx.createImageData(size, size);
  const aPix = aImg.data;
  const total = size * size;
  const heightF = new Float32Array(total);
  const roughF = new Float32Array(total);
  const aoF = new Float32Array(total);
  const n1 = makeNoiseSampler(16, 5111);
  const n2 = makeNoiseSampler(32, 5112);
  const n3 = makeNoiseSampler(64, 5113);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = row + x;
      const p4 = idx * 4;
      const warp = n1(u * 2, v * 2) * 0.22;
      const grain = n2(u * 10 + warp * 4.0, v * 1.8);
      const fiber = n3(u * 22 + warp * 3.0, v * 4.0);
      const furrow = Math.pow(clamp01(1.0 - Math.abs(grain * 2.0 - 1.0)), 3.2);
      const hVal = clamp01(0.55 + (grain - 0.5) * 0.36 + (fiber - 0.5) * 0.20 - furrow * 0.36);
      heightF[idx] = hVal;
      aoF[idx] = clamp01(0.32 + hVal * 0.68);
      roughF[idx] = clamp01(0.78 + (1.0 - hVal) * 0.18);

      const r = lerp(24, 68, hVal) * (0.88 + fiber * 0.22);
      const g = lerp(20, 56, hVal) * (0.88 + fiber * 0.22);
      const b = lerp(19, 49, hVal) * (0.88 + fiber * 0.22);
      aPix[p4]     = clamp(r, 0, 255) | 0;
      aPix[p4 + 1] = clamp(g, 0, 255) | 0;
      aPix[p4 + 2] = clamp(b, 0, 255) | 0;
      aPix[p4 + 3] = 255;
    }
  }
  ctx.putImageData(aImg, 0, 0);
  const albedo = trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: true, anisotropy }));
  const normal = trackTex(buildSobelNormalTex(THREE, heightF, size, size, 1.55, anisotropy, true));
  const orm = trackTex(buildOrmTex(THREE, aoF, roughF, size, size, anisotropy, true));
  return { albedo, normal, orm };
}

// 4) Torn Royal Crimson-and-Gold Velvet Carpet Texture (for Chasm Drape & Tattered Shore Banners)
function buildTornCarpetTex(THREE, size, anisotropy, trackTex) {
  const c = createCanvas2D(size, size);
  if (!c) return trackTex(createFallbackTex(THREE, 112, 22, 32, 255, true));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c121b';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(130, 26, 36, 0.45)';
  ctx.lineWidth = Math.max(1, size / 128);
  const step = size / 8;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x + step * 0.5, y);
      ctx.lineTo(x + step, y + step * 0.5);
      ctx.lineTo(x + step * 0.5, y + step);
      ctx.lineTo(x, y + step * 0.5);
      ctx.closePath();
      ctx.stroke();
    }
  }
  const bw = size * 0.085;
  ctx.fillStyle = '#8b6a2c';
  ctx.fillRect(size * 0.03, 0, bw * 0.35, size);
  ctx.fillRect(size * 0.08, 0, bw * 0.18, size);
  ctx.fillRect(size * (1 - 0.03) - bw * 0.35, 0, bw * 0.35, size);
  ctx.fillRect(size * (1 - 0.08) - bw * 0.18, 0, bw * 0.18, size);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, 'rgba(8, 6, 8, 0.55)');
  grad.addColorStop(0.25, 'rgba(18, 8, 10, 0.10)');
  grad.addColorStop(0.75, 'rgba(14, 7, 9, 0.18)');
  grad.addColorStop(1.0, 'rgba(6, 5, 8, 0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: false, anisotropy }));
}

// 5) Soft Multi-Lobe Radial Mist / Spray Sprite Texture (Zero Hard Square Edges!)
function buildSoftMistSpriteTex(THREE, trackTex) {
  const size = 256;
  const c = createCanvas2D(size, size);
  if (!c) return trackTex(createFallbackTex(THREE, 220, 232, 245, 160, true, false));
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const lobes = [
    [0.50, 0.50, 0.44, 0.42],
    [0.36, 0.46, 0.32, 0.28],
    [0.64, 0.54, 0.32, 0.28],
    [0.48, 0.36, 0.28, 0.22],
    [0.54, 0.65, 0.28, 0.22]
  ];
  for (let i = 0; i < lobes.length; i++) {
    const [ux, uy, ur, a] = lobes[i];
    const g = ctx.createRadialGradient(ux * size, uy * size, 2, ux * size, uy * size, ur * size);
    g.addColorStop(0.0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.5, `rgba(255,255,255,${(a * 0.42).toFixed(3)})`);
    g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ux * size, uy * size, ur * size, 0, Math.PI * 2);
    ctx.fill();
  }
  return trackTex(finalizeCanvasTex(THREE, c, { isColor: true, repeat: false, anisotropy: 2 }));
}

// ============================================================================
// Zero-Dependency BufferGeometry Helpers (Uses Passed THREE Instance Only!)
// ============================================================================
function xformGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

function applyBoxUVs(geo, tileScale = 3.2) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return geo;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new pos.constructor(new Float32Array(pos.count * 2), 2);
    geo.setAttribute('uv', uv);
  }
  const inv = 1.0 / Math.max(0.05, tileScale);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    if (ay >= ax && ay >= az) {
      uv.setXY(i, x * inv, z * inv);
    } else if (ax >= az) {
      uv.setXY(i, z * inv, y * inv);
    } else {
      uv.setXY(i, x * inv, y * inv);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function mergeNonIndexedGeos(THREE, rawList, { boxUvTile = 0, withColor = false } = {}) {
  if (!rawList || rawList.length === 0) return null;
  const parts = [];
  let totalVerts = 0;
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (!raw || !raw.attributes?.position) continue;
    const g = raw.index ? raw.toNonIndexed() : raw.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (boxUvTile > 0) applyBoxUVs(g, boxUvTile);
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (withColor && !g.attributes.color) {
      const cArr = new Float32Array(g.attributes.position.count * 3);
      cArr.fill(1.0);
      g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    }
    totalVerts += g.attributes.position.count;
    parts.push(g);
    raw.dispose();
  }
  if (totalVerts === 0) return null;

  const posOut = new Float32Array(totalVerts * 3);
  const normOut = new Float32Array(totalVerts * 3);
  const uvOut = new Float32Array(totalVerts * 2);
  const colOut = withColor ? new Float32Array(totalVerts * 3) : null;

  let offset = 0;
  for (let i = 0; i < parts.length; i++) {
    const g = parts[i];
    const cnt = g.attributes.position.count;
    posOut.set(g.attributes.position.array, offset * 3);
    normOut.set(g.attributes.normal.array, offset * 3);
    uvOut.set(g.attributes.uv.array, offset * 2);
    if (colOut && g.attributes.color) {
      colOut.set(g.attributes.color.array, offset * 3);
    }
    offset += cnt;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posOut, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normOut, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvOut, 2));
  if (colOut) {
    merged.setAttribute('color', new THREE.BufferAttribute(colOut, 3));
  }
  merged.computeBoundingSphere();
  return merged;
}

function tintGeo(THREE, rawGeo, topHex, bottomHex = null, jitter = 0.0, rng = null) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  if (g !== rawGeo) rawGeo.dispose();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const cnt = pos.count;
  const cTop = new THREE.Color(topHex);
  const cBot = bottomHex !== null ? new THREE.Color(bottomHex) : cTop;
  let minY = Infinity;
  let maxY = -Infinity;
  if (bottomHex !== null) {
    for (let i = 0; i < cnt; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const span = Math.max(1e-4, maxY - minY);
  const cols = new Float32Array(cnt * 3);
  for (let i = 0; i < cnt; i++) {
    const t = bottomHex !== null ? clamp01((pos.getY(i) - minY) / span) : 1.0;
    const j = jitter > 0 && rng ? (1.0 + (rng() - 0.5) * 2.0 * jitter) : 1.0;
    cols[i * 3]     = clamp01(lerp(cBot.r, cTop.r, t) * j);
    cols[i * 3 + 1] = clamp01(lerp(cBot.g, cTop.g, t) * j);
    cols[i * 3 + 2] = clamp01(lerp(cBot.b, cTop.b, t) * j);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

// Sculpt an angular faceted basalt boulder (for river/shore boulders & chunks)
function buildSculptedRockGeo(THREE, radius = 1.0, seed = 1, flattenY = 0.72, detail = 2) {
  const rng = makeRng(seed);
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const p1 = rng() * 6.28, p2 = rng() * 6.28, p3 = rng() * 6.28, p4 = rng() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len, ny = y / len, nz = z / len;
    // Multi-octave angular ridge & strata shelf displacement
    const f1 = Math.sin(nx * 3.1 + p1) * Math.cos(nz * 2.9 - p2) * 0.20;
    const f2 = (1.0 - Math.abs(Math.sin(nx * 5.7 + ny * 4.3 + p3))) * 0.14;
    const f3 = Math.sin(ny * 7.8 + nz * 4.1 + p4) * 0.08;
    const strata = Math.floor((ny + 1.0) * 3.2) * 0.025 + Math.sin(ny * 9.5 + p1) * 0.045;
    const k = 0.80 + f1 + f2 + f3 + strata;
    x *= k;
    z *= k;
    y *= (0.84 + f1 * 0.55 + f3 * 0.65) * flattenY;
    if (y < -radius * flattenY * 0.44) {
      y = -radius * flattenY * 0.44 + (y + radius * flattenY * 0.44) * 0.22;
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// AAA Multi-Octave Displaced Craggy Cliff Mass / Mountain Outcrop (ZERO smooth cones or origami pyramids!)
// Produces terraced volcanic basalt cliff ribs, sharp tectonic ridges, rooted broad base & moss-tinted ledges.
function buildCraggyCliffMassGeo(THREE, rx, ry, rz, seed, detail = 3, opts = null) {
  const rng = makeRng(seed);
  const baseGeo = new THREE.IcosahedronGeometry(1.0, detail);
  const g = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo;
  if (g !== baseGeo) baseGeo.dispose();

  const pos = g.attributes.position;
  const p1 = rng() * 6.283;
  const p2 = rng() * 6.283;
  const p3 = rng() * 6.283;
  const p4 = rng() * 6.283;
  const tiltX = ((rng() - 0.5) * 0.28) + (opts?.tiltX || 0);
  const tiltZ = ((rng() - 0.5) * 0.28) + (opts?.tiltZ || 0);
  const flatTop = Boolean(opts?.flatTop);

  for (let i = 0; i < pos.count; i++) {
    let nx = pos.getX(i);
    let ny = pos.getY(i);
    let nz = pos.getZ(i);
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    // 4-octave ridged multifractal crag displacement (angular volcanic shoulders & vertical basalt columns!)
    const ang = Math.atan2(nz, nx);
    const oct1 = Math.sin(nx * 2.6 + nz * 2.1 + p1) * Math.cos(ny * 2.2 - nz * 2.4 + p2);
    const oct2 = 1.0 - Math.abs(Math.sin(nx * 5.2 - nz * 4.8 + p2) * Math.cos(ny * 4.1 + p3));
    const oct3 = 1.0 - Math.abs(Math.sin(ang * 5.0 + ny * 3.4 + p3)); // columnar basalt ribs
    const oct4 = Math.sin(nx * 10.5 + ny * 9.2 + nz * 11.1 + p4) * 0.5;

    // Stepped horizontal rock terraces/ledges
    const y01 = clamp01(ny * 0.5 + 0.5);
    const terraceWave = Math.sin(y01 * Math.PI * 5.0 + oct1 * 1.4);
    const terraceStep = terraceWave > 0 ? Math.pow(terraceWave, 0.55) : -Math.pow(-terraceWave, 0.55);

    // Broad rooted talus base widening smoothly downward, craggy irregular asymmetric ridge crest on top
    const baseSkirt = lerp(1.38, 0.62, smoothstep(0.05, 0.96, y01));
    const crestNotch = smoothstep(0.60, 1.0, y01) * (Math.sin(ang * 2.0 + p1) * 0.22 + Math.cos(ang * 3.0 - p2) * 0.16);
    const radialScale = baseSkirt * (0.76 + oct1 * 0.22 + oct2 * 0.20 + oct3 * 0.14 + oct4 * 0.07 + terraceStep * 0.06);

    let x = nx * radialScale * rx + (y01 - 0.3) * tiltX * rx;
    let z = nz * radialScale * rz + (y01 - 0.3) * tiltZ * rz;
    let yNorm = ny * (0.86 + oct1 * 0.14 + oct2 * 0.10 + crestNotch);
    if (flatTop && yNorm > 0.52) {
      yNorm = 0.52 + (yNorm - 0.52) * 0.28 + oct4 * 0.04;
    }
    // Flatten underside softly so cliffs seat solidly into ground with zero floating gaps
    if (yNorm < -0.68) {
      yNorm = -0.68 + (yNorm + 0.68) * 0.20;
    }
    const y = (yNorm + 0.68) * 0.58 * ry;
    pos.setXYZ(i, x, y, z);
  }

  g.computeVertexNormals();
  // Rich directional vertex coloring: wet dark base, cold moonlit ridge facets, subtle moss on flat upward shelves!
  const norm = g.attributes.normal;
  const cols = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color(opts?.botHex ?? 0x151923);
  const cMid  = new THREE.Color(opts?.midHex ?? 0x2c3445);
  const cRim  = new THREE.Color(opts?.topHex ?? 0x52607a);
  const cMoss = new THREE.Color(opts?.mossHex ?? 0x2a3b30);
  const cTmp  = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const ny = norm.getY(i);
    const nx = norm.getX(i);
    const nz = norm.getZ(i);
    const hT = clamp01(py / Math.max(0.5, ry));
    // Moonlit facet catch toward (-0.25, 0.55, -0.80) and cool front rim
    const moonCatch = clamp01(ny * 0.55 + Math.max(0, -nx * 0.25 - nz * 0.45) * 0.45);
    const mossCatch = smoothstep(0.52, 0.85, ny) * smoothstep(0.18, 0.72, hT) * (opts?.noMoss ? 0.0 : 0.48);

    cTmp.copy(cBase).lerp(cMid, smoothstep(0.0, 0.55, hT));
    cTmp.lerp(cRim, moonCatch * smoothstep(0.25, 0.95, hT) * 0.75);
    cTmp.lerp(cMoss, mossCatch);
    cols[i * 3]     = cTmp.r;
    cols[i * 3 + 1] = cTmp.g;
    cols[i * 3 + 2] = cTmp.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}

// Helper: Build a vertical chain made of alternating interlocking iron torus links
function addHangingChainParts(THREE, parts, x, yTop, z, linkCount, linkLen = 0.24, swayX = 0, swayZ = 0) {
  for (let i = 0; i < linkCount; i++) {
    const t = i / Math.max(1, linkCount - 1);
    const lx = x + swayX * t * t;
    const ly = yTop - i * linkLen * 0.78;
    const lz = z + swayZ * t * t;
    const link = new THREE.TorusGeometry(linkLen * 0.44, linkLen * 0.13, 5, 8);
    xformGeo(link, lx, ly, lz, 0, (i % 2) * (Math.PI * 0.5), 0, 0.72, 1.18, 1.0);
    parts.push(link);
  }
}

// ============================================================================
// Main Factory: createSoulsExteriorShore(THREE, opts = {})
// ============================================================================
export function createSoulsExteriorShore(THREE, opts = {}) {
  if (!THREE) {
    throw new Error('createSoulsExteriorShore(THREE, opts): THREE instance is required');
  }

  const isMobile = opts.isMobile !== undefined
    ? Boolean(opts.isMobile)
    : (typeof navigator !== 'undefined' && /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || ''));
  let lowSpecMode = Boolean(opts.lowSpec);
  const anisotropy = isMobile ? 2 : 4;
  const externalPbr = opts.pbr || null;

  // Zero-leak resource registry
  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];
  const trackGeo = (g) => { if (g) ownedGeos.push(g); return g; };
  const trackMat = (m) => { if (m) ownedMats.push(m); return m; };
  const trackTex = (t) => { if (t) ownedTex.push(t); return t; };

  // Zero-recompile light stub: exterior shore reuses `world.js` permanent lights so NUM_POINT_LIGHTS & NUM_DIR_LIGHTS stay 100% constant!
  const makeLightStub = () => ({
    visible: false,
    intensity: 0,
    position: new THREE.Vector3(),
    target: { position: new THREE.Vector3() }
  });

  // Procedural PBR texture maps (256px PC / 128px Mobile -> 16x faster build, <35ms, zero combat hitch!)
  const stoneTexRes = isMobile ? 128 : 256;
  const propTexRes = isMobile ? 128 : 128;
  const shorePbr = buildShorePebblePbr(THREE, stoneTexRes, anisotropy, trackTex);
  const basaltPbr = buildWetBasaltPbr(THREE, stoneTexRes, anisotropy, trackTex);
  const cliffPbr = buildNaturalCliffPbr(THREE, stoneTexRes, anisotropy, trackTex);
  const ironPbr = buildRustyIronPbr(THREE, propTexRes, anisotropy, trackTex);
  const barkPbr = buildWeatheredWoodPbr(THREE, propTexRes, anisotropy, trackTex);
  const carpetTex = externalPbr?.carpetAlbedo || buildTornCarpetTex(THREE, propTexRes, anisotropy, trackTex);
  const mistSpriteTex = buildSoftMistSpriteTex(THREE, trackTex);

  const normalMappedMats = [];
  const regNormalMat = (mat, normalMap) => {
    if (mat && normalMap) normalMappedMats.push({ mat, map: normalMap });
    return mat;
  };

  // Root & 3 Stage Groups
  const rootGroup = new THREE.Group();
  rootGroup.name = 'SoulsExteriorShoreRoot';

  const chasmOverlayGroup = new THREE.Group();
  chasmOverlayGroup.name = 'ChasmOverlayGroup';
  chasmOverlayGroup.visible = false;

  const shaftAndRiverGroup = new THREE.Group();
  shaftAndRiverGroup.name = 'ShaftAndRiverGroup';
  shaftAndRiverGroup.visible = false;

  const exteriorGroup = new THREE.Group();
  exteriorGroup.name = 'ExteriorShoreGroup';
  exteriorGroup.visible = false;

  rootGroup.add(chasmOverlayGroup, shaftAndRiverGroup, exteriorGroup);

  // Tracked stage & gameplay states
  let stageMode = 'none';
  let chasmProgress = 0.0;
  let chasmX = 0.0;
  let chasmZ = 0.0;
  let chasmCamBelow = false;
  let grateBroken = false;
  let grateBreakAnim = 0.0; // 0 = intact, 0..1 = explosive shatter, 1 = fully ripped wide open (78-96 deg)
  let swordPickedUp = false;
  let bonfireLit = false;

  // ==========================================================================
  // GROUP A: `chasmOverlayGroup` — Act 3: 4.6m WebGL Stencil Chasm in Throne Hall Floor
  //          Upgraded for dramatic clarity BOTH overhead AND looking UP from abyss (camY < -0.18)!
  // ==========================================================================
  const chasmContent = new THREE.Group();
  chasmContent.visible = false;
  chasmOverlayGroup.add(chasmContent);

  const CHASM_SEGS = isMobile ? 28 : 36;

  function buildChasmApertureGeo(segs) {
    const pos = new Float32Array((segs + 1) * 3);
    const idx = [];
    for (let s = 0; s < segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const r = evalChasmEdgeR(th);
      pos[(s + 1) * 3]     = Math.cos(th) * r;
      pos[(s + 1) * 3 + 1] = 0;
      pos[(s + 1) * 3 + 2] = Math.sin(th) * r;
      idx.push(0, ((s + 1) % segs) + 1, s + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function buildChasmShaftGeo(segs) {
    const profile = [
      { rScale: 1.07, y:   0.03, jag: 0.00, shade: 0.90 },
      { rScale: 1.00, y:  -0.02, jag: 0.02, shade: 0.96 },
      { rScale: 0.98, y:  -0.40, jag: 0.05, shade: 0.84 },
      { rScale: 0.95, y:  -1.25, jag: 0.08, shade: 0.72 },
      { rScale: 1.08, y:  -2.90, jag: 0.10, shade: 0.62 },
      { rScale: 1.03, y:  -5.60, jag: 0.12, shade: 0.54 },
      { rScale: 1.15, y:  -9.20, jag: 0.13, shade: 0.46 },
      { rScale: 1.09, y: -13.60, jag: 0.12, shade: 0.38 },
      { rScale: 1.18, y: -18.60, jag: 0.11, shade: 0.32 },
      { rScale: 1.14, y: -24.20, jag: 0.10, shade: 0.24 },
      { rScale: 0.80, y: -27.20, jag: 0.05, shade: 0.12 },
      { rScale: 0.00, y: -28.00, jag: 0.00, shade: 0.05 }
    ];
    const nR = profile.length;
    const rings = [];
    for (let ri = 0; ri < nR; ri++) {
      const rp = profile[ri];
      const row = [];
      for (let s = 0; s <= segs; s++) {
        const sw = s % segs;
        const th = (sw / segs) * Math.PI * 2;
        const baseR = evalChasmEdgeR(th);
        const h1 = Math.sin(sw * 3.7 + ri * 2.3) * Math.cos(sw * 2.1 - ri * 1.7);
        const h2 = Math.sin(sw * 7.3 - ri * 3.1);
        const r = Math.max(0.0, baseR * rp.rScale * (1.0 + rp.jag * (0.65 * h1 + 0.35 * h2)));
        const y = rp.y + rp.jag * 0.48 * h1;
        row.push({
          x: Math.cos(th) * r,
          y,
          z: Math.sin(th) * r,
          u: s / segs,
          v: Math.abs(y) / 14.0,
          shade: rp.shade * (0.80 + 0.38 * (0.5 + 0.5 * h2))
        });
      }
      rings.push(row);
    }

    const posArr = [];
    const colArr = [];
    const uvArr = [];
    const pushV = (v) => {
      posArr.push(v.x, v.y, v.z);
      colArr.push(v.shade, clamp01(v.v), 0.5);
      uvArr.push(v.u, v.v);
    };
    for (let ri = 0; ri < nR - 1; ri++) {
      for (let s = 0; s < segs; s++) {
        const a = rings[ri][s];
        const b = rings[ri + 1][s];
        const c = rings[ri][s + 1];
        const d = rings[ri + 1][s + 1];
        pushV(a); pushV(b); pushV(c);
        if (ri < nR - 2) {
          pushV(b); pushV(d); pushV(c);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
    g.computeVertexNormals();
    return g;
  }

  const chasmApertureGeo = trackGeo(buildChasmApertureGeo(CHASM_SEGS));
  const chasmShaftGeo = trackGeo(buildChasmShaftGeo(CHASM_SEGS));

  const chasmStencilMaskMat = trackMat(new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0xFF,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp
  }));
  const chasmStencilMask = new THREE.Mesh(chasmApertureGeo, chasmStencilMaskMat);
  chasmStencilMask.position.y = 0.036;
  chasmStencilMask.renderOrder = -30;
  chasmStencilMask.frustumCulled = false;

  const chasmDepthClearMat = trackMat(new THREE.ShaderMaterial({
    vertexShader: `
      void main() {
        vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vec4(c.xy, c.w * 0.99995, c.w);
      }
    `,
    fragmentShader: `
      void main() { gl_FragColor = vec4(0.0); }
    `,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    depthFunc: THREE.AlwaysDepth,
    side: THREE.DoubleSide,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmDepthClear = new THREE.Mesh(chasmApertureGeo, chasmDepthClearMat);
  chasmDepthClear.position.y = 0.036;
  chasmDepthClear.renderOrder = -29;
  chasmDepthClear.frustumCulled = false;

  const chasmShaftUniforms = {
    uTime: { value: 0.0 },
    uHeat: { value: 1.0 },
    uCamBelow: { value: 0.0 }
  };
  const chasmShaftMat = trackMat(new THREE.ShaderMaterial({
    uniforms: chasmShaftUniforms,
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormalW;
      varying vec3 vMeta;
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      void main() {
        vMeta = color;
        vUv = uv;
        vLocalPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uHeat;
      uniform float uCamBelow;
      varying vec3 vNormalW;
      varying vec3 vMeta;
      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float depthM = max(0.0, -vLocalPos.y);
        float depth01 = clamp(depthM / 22.0, 0.0, 1.0);

        float arc = vUv.x * 18.0;
        float warp = vnoise(vec2(arc * 0.85, depthM * 0.90)) * 1.35;
        float row = floor(depthM * 1.75 + warp * 0.35);
        float colIdx = floor(arc + mod(row, 2.0) * 0.5 + warp * 0.25);
        float blkH = hash21(vec2(colIdx, row));
        float hSeam = 1.0 - smoothstep(0.02, 0.09, abs(fract(depthM * 1.75 + warp * 0.35) - 0.5));
        float vSeam = 1.0 - smoothstep(0.02, 0.08, abs(fract(arc + mod(row, 2.0) * 0.5 + warp * 0.25) - 0.5));
        float seam = max(hSeam * 0.58, vSeam * 0.45);

        float rockN = vnoise(vec2(arc * 1.7, depthM * 2.1)) * 0.58 + vnoise(vec2(arc * 4.8, depthM * 5.6)) * 0.42;
        float ridge = 1.0 - abs(vnoise(vec2(arc * 2.4 + warp, depthM * 2.8 - warp * 0.6)) * 2.0 - 1.0);
        float hairlineCrack = pow(clamp(ridge, 0.0, 1.0), 9.0);
        float wetStreak = smoothstep(0.58, 0.86, vnoise(vec2(arc * 3.8, depthM * 0.35)));

        vec3 cTopSlab = vec3(0.055, 0.060, 0.082);
        vec3 cMidRock = vec3(0.022, 0.027, 0.040);
        vec3 cAbyss   = mix(vec3(0.002, 0.003, 0.005), vec3(0.011, 0.016, 0.028), uCamBelow);

        vec3 baseCol = mix(cTopSlab, cMidRock, smoothstep(0.02, 0.24, depth01));
        baseCol = mix(baseCol, cAbyss, smoothstep(0.28, 0.85, depth01));
        baseCol *= (0.68 + 0.56 * blkH) * (0.70 + 0.52 * rockN) * (0.60 + 0.40 * vMeta.x);
        baseCol *= (1.0 - seam * 0.74);

        // Overhead Throne Hall firelight + cool moonlit stone rim down the deep chimney
        vec3 upDir = normalize(vec3(0.12, 0.96, 0.14));
        vec3 warmL = normalize(vec3(-0.35, 0.78, -0.52));
        float overhangAo = mix(0.38, 1.0, smoothstep(0.0, 0.22, depthM));
        float falloffRate = mix(0.32, 0.12, uCamBelow);
        float depthFade = exp(-depthM * falloffRate);
        float rimUp = pow(1.0 - max(dot(N, V), 0.0), 2.4) * (0.30 + 0.70 * max(0.0, N.y + 0.35));
        float lightTerm = (0.20 + 0.90 * max(0.0, dot(N, upDir)) + 0.45 * max(0.0, dot(N, warmL))) * depthFade * overhangAo;
        vec3 lit = baseCol * lightTerm;

        if (uCamBelow > 0.5) {
          float abyssGlow = exp(-depthM * 0.16);
          lit += vec3(0.12, 0.036, 0.018) * (0.22 + 0.78 * max(0.0, N.y * 0.5 + 0.5)) * abyssGlow;
          lit += vec3(0.035, 0.058, 0.098) * (0.28 + 0.72 * wetStreak) * (0.35 + 0.65 * rimUp) * (1.0 - seam * 0.65);
          vec3 H = normalize(upDir + V);
          float spec = pow(max(dot(N, H), 0.0), 32.0) * wetStreak * abyssGlow * 0.28;
          lit += vec3(0.82, 0.34, 0.12) * spec;
        }

        // Fiery molten fractures concentrated strictly near the freshly shattered upper breach rim (depthM < 5.5m!)
        float pulse = 0.84 + 0.16 * sin(uTime * 5.6 + arc * 1.4 + depthM * 1.8);
        float crackBand = smoothstep(0.0, 0.02, depth01) * (1.0 - smoothstep(0.08, 0.26, depth01));
        float emberMask = hairlineCrack * crackBand * smoothstep(0.42, 0.84, rockN) * uHeat;
        vec3 emberCol = mix(vec3(0.85, 0.08, 0.015), vec3(2.15, 0.58, 0.12), smoothstep(0.45, 0.95, rockN));
        lit += emberCol * emberMask * pulse * 1.05;

        // Blazing shattered breach rim lip right at y = 0..-1.1m (dramatically silhouettes Boss on the edge!)
        float lipRing = exp(-depthM * 2.1) * uHeat;
        lit += vec3(1.25, 0.30, 0.06) * lipRing * mix(0.24, 0.82, uCamBelow) * pulse;

        gl_FragColor = vec4(lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmShaftMesh = new THREE.Mesh(chasmShaftGeo, chasmShaftMat);
  chasmShaftMesh.position.y = 0.002;
  chasmShaftMesh.renderOrder = -28;
  chasmShaftMesh.frustumCulled = false;

  // Upward-view crimson backlit Throne Hall vault smoke backdrop (visible when camY < -0.18!)
  const chasmUpwardBackdropMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: chasmShaftUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float smoke = vnoise(p * 3.4 + vec2(uTime * 0.14, -uTime * 0.10)) * 0.6 +
                      vnoise(p * 7.2 - vec2(uTime * 0.18, uTime * 0.12)) * 0.4;
        // Gothic cathedral vault rib cross-shadows overhead
        float ang = atan(p.y, p.x);
        float rib = smoothstep(0.86, 0.98, abs(cos(ang * 4.0))) * smoothstep(0.18, 0.85, r);
        float glow = exp(-r * r * 1.45);
        vec3 outerCol = vec3(0.055, 0.035, 0.060);
        vec3 fireCol  = mix(vec3(0.45, 0.11, 0.045), vec3(0.95, 0.34, 0.10), smoke);
        vec3 col = mix(outerCol, fireCol, glow * (0.72 + 0.28 * smoke));
        col *= (1.0 - rib * 0.42);
        col *= 0.90 + 0.10 * sin(uTime * 4.2 + p.x * 3.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    stencilWrite: false,
    fog: false
  }));
  const chasmUpwardBackdrop = new THREE.Mesh(
    trackGeo(new THREE.CircleGeometry(18.0, 28)),
    chasmUpwardBackdropMat
  );
  chasmUpwardBackdrop.rotation.x = Math.PI * 0.5;
  chasmUpwardBackdrop.position.y = 14.5;
  chasmUpwardBackdrop.renderOrder = -28;
  chasmUpwardBackdrop.visible = false;
  chasmUpwardBackdrop.frustumCulled = false;

  // Broken sub-floor joists + deep stone wall ring ribs down to y = -20m so abyss plunge feels rich & physical!
  const chasmBeamsParts = [];
  const chasmRng = makeRng(30917);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + 0.28 + (chasmRng() - 0.5) * 0.25;
    const edgeR = evalChasmEdgeR(ang);
    const beamLen = 0.72 + chasmRng() * 0.78;
    const by = -0.85 - i * 1.55 - chasmRng() * 0.35;
    const g = new THREE.BoxGeometry(0.18, 0.22, beamLen);
    xformGeo(
      g,
      Math.cos(ang) * (edgeR - beamLen * 0.30),
      by,
      Math.sin(ang) * (edgeR - beamLen * 0.30),
      (chasmRng() - 0.5) * 0.35,
      -ang + Math.PI * 0.5,
      (chasmRng() - 0.5) * 0.45
    );
    chasmBeamsParts.push(tintGeo(THREE, g, 0x524844, 0x262120));
  }
  // Protruding rocky strata ledges tucked cleanly against the outer shaft walls (zero camera occlusion!)
  const chasmLedgeHeights = [-4.2, -8.8, -13.6, -18.4];
  for (let li = 0; li < chasmLedgeHeights.length; li++) {
    const ly = chasmLedgeHeights[li];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + li * 0.52;
      const rr = evalChasmEdgeR(a) * 1.24;
      const lg = buildSculptedRockGeo(THREE, 0.42 + (k % 2) * 0.14, 7300 + li * 10 + k, 0.42, 1);
      xformGeo(lg, Math.cos(a) * rr, ly, Math.sin(a) * rr, 0, a, 0);
      chasmBeamsParts.push(tintGeo(THREE, lg, 0x62708a, 0x262c3c));
    }
  }
  const chasmInnerPropMat = trackMat(new THREE.MeshStandardMaterial({
    map: basaltPbr.albedo,
    roughness: 0.88,
    metalness: 0.18,
    vertexColors: true,
    color: 0x9aa4bc,
    emissive: 0x2a1412,
    emissiveIntensity: 0.55,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmInnerBeams = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, chasmBeamsParts, { boxUvTile: 1.5, withColor: true })),
    chasmInnerPropMat
  );
  chasmInnerBeams.renderOrder = -27;
  chasmInnerBeams.frustumCulled = false;

  // Outer spiderweb cracked rim disc (strictly discards inside evalChasmEdgeR so hole is 100% open!)
  const chasmRimCrackUniforms = {
    uTime: chasmShaftUniforms.uTime,
    uProgress: { value: 0.0 }
  };
  const chasmRimCrackMat = trackMat(new THREE.ShaderMaterial({
    uniforms: chasmRimCrackUniforms,
    vertexShader: `
      varying vec2 vLocalXZ;
      void main() {
        vLocalXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uProgress;
      varying vec2 vLocalXZ;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float evalEdge(float th) {
        return 2.28
          + 0.18 * sin(th * 5.0 + 0.35)
          + 0.13 * cos(th * 8.0 - 0.85)
          + 0.09 * sin(th * 13.0 + 1.55)
          + 0.05 * cos(th * 19.0 - 0.4);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        float r = length(vLocalXZ);
        float th = atan(vLocalXZ.y, vLocalXZ.x);
        float edgeR = evalEdge(th);
        if (r < edgeR - 0.04) discard;

        float distOut = r - edgeR;
        float outerFade = 1.0 - smoothstep(0.25, 2.05, distOut);
        if (outerFade <= 0.005) discard;

        float nWarp = vnoise(vLocalXZ * 2.1) * 0.65 + vnoise(vLocalXZ * 5.2) * 0.35;
        float jaggedTh = th + (nWarp - 0.5) * 0.36;
        float crackA = 1.0 - abs(sin(jaggedTh * 7.0 + floor(r * 1.8) * 0.18));
        float crackB = 1.0 - abs(vnoise(vLocalXZ * 3.4) * 2.0 - 1.0);
        float crackLine = pow(clamp(crackA, 0.0, 1.0), 14.0) * 0.95 + pow(clamp(crackB, 0.0, 1.0), 12.0) * 0.72;
        float rimChar = exp(-distOut * 1.95) * (0.72 + 0.38 * nWarp);

        float pulse = 0.84 + 0.16 * sin(uTime * 6.2 + th * 3.0);
        float heat = clamp((crackLine * 0.85 * exp(-distOut * 1.2) + exp(-distOut * 11.0) * 0.55) * outerFade * uProgress, 0.0, 1.0);

        vec3 scorchCol = vec3(0.012, 0.013, 0.018);
        vec3 glowCol = mix(vec3(0.72, 0.09, 0.02), vec3(1.55, 0.38, 0.07), clamp(heat * 1.1, 0.0, 1.0));
        vec3 col = mix(scorchCol, glowCol, smoothstep(0.28, 0.85, heat) * pulse);
        float alpha = clamp((rimChar * 0.88 + crackLine * 0.78 * outerFade) * uProgress, 0.0, 0.94);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide
  }));
  const chasmRimCrackGeo = trackGeo(new THREE.PlaneGeometry(9.6, 9.6, 1, 1));
  chasmRimCrackGeo.rotateX(-Math.PI * 0.5);
  const chasmRimCrackMesh = new THREE.Mesh(chasmRimCrackGeo, chasmRimCrackMat);
  chasmRimCrackMesh.position.y = 0.030;
  chasmRimCrackMesh.renderOrder = -26;
  chasmRimCrackMesh.frustumCulled = false;

  // 14 Jagged Buckled Broken Cathedral Flagstone Rim Slabs encircling the chasm lip
  const rimSlabMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: externalPbr?.floorAlbedo || basaltPbr.albedo,
      normalMap: lowSpecMode ? null : (externalPbr?.floorNormal || basaltPbr.normal),
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: externalPbr?.floorRoughness || basaltPbr.orm,
      color: 0x8e93a6,
      roughness: 0.94,
      metalness: 0.06,
      vertexColors: true
    })),
    externalPbr?.floorNormal || basaltPbr.normal
  );
  const rimSlabsGroup = new THREE.Group();
  const rimSlabEntries = [];
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + (chasmRng() - 0.5) * 0.16;
    const edgeR = evalChasmEdgeR(ang);
    const w = 0.78 + chasmRng() * 0.52;
    const h = 0.16 + chasmRng() * 0.12;
    const d = 0.62 + chasmRng() * 0.44;
    const sg = new THREE.BoxGeometry(w, h, d, 2, 1, 2);
    const sp = sg.attributes.position;
    for (let vi = 0; vi < sp.count; vi++) {
      sp.setXYZ(
        vi,
        sp.getX(vi) + (chasmRng() - 0.5) * 0.11,
        sp.getY(vi) + (chasmRng() - 0.5) * 0.04,
        sp.getZ(vi) + (chasmRng() - 0.5) * 0.11
      );
    }
    sg.computeVertexNormals();
    applyBoxUVs(sg, 1.8);
    const coloredSlab = trackGeo(tintGeo(THREE, sg, 0x9fa5ba, 0x3b3d4a));
    const mesh = new THREE.Mesh(coloredSlab, rimSlabMat);
    mesh.rotation.order = 'YXZ';
    const dist = edgeR + 0.22 + (i % 3) * 0.18;
    const inwardTip = (i % 3 === 0);
    mesh.position.set(Math.cos(ang) * dist, 0.02, Math.sin(ang) * dist);
    const yaw = Math.atan2(Math.cos(ang), Math.sin(ang));
    const targetPitch = inwardTip ? -(0.34 + chasmRng() * 0.22) : (0.18 + chasmRng() * 0.26);
    const targetRoll = (chasmRng() - 0.5) * 0.22;
    const targetY = inwardTip ? -0.08 : (0.06 + chasmRng() * 0.08);
    mesh.rotation.set(targetPitch, yaw, targetRoll);
    mesh.receiveShadow = true;
    rimSlabsGroup.add(mesh);
    rimSlabEntries.push({ mesh, yaw, targetPitch, targetRoll, targetY });
  }

  // Torn Crimson Royal Velvet Runner Carpet flaps sagging down over the North & South chasm edges
  const tornCarpetMat = trackMat(new THREE.MeshStandardMaterial({
    map: carpetTex,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide
  }));
  function buildTornCarpetFlapGeo(signZ) {
    const cols = 10;
    const rows = 7;
    const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uvs = new Float32Array((cols + 1) * (rows + 1) * 2);
    const indices = [];
    const width = 2.34;
    for (let r = 0; r <= rows; r++) {
      const vFrac = r / rows;
      for (let c = 0; c <= cols; c++) {
        const uFrac = c / cols;
        const x = (uFrac - 0.5) * width;
        const tearLen = 0.85 + 0.55 * Math.sin(c * 2.4 + signZ * 1.1) + 0.28 * Math.cos(c * 4.7);
        const hang = vFrac * tearLen;
        const zOut = signZ * (2.36 - Math.min(hang, 0.45) * 0.92 - Math.max(0, hang - 0.45) * 0.16);
        const yDrop = 0.032 - Math.pow(vFrac, 1.55) * (0.95 * tearLen);
        const vi = r * (cols + 1) + c;
        positions[vi * 3]     = x;
        positions[vi * 3 + 1] = yDrop;
        positions[vi * 3 + 2] = zOut;
        uvs[vi * 2]     = uFrac;
        uvs[vi * 2 + 1] = vFrac;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = (r + 1) * (cols + 1) + c;
        const d = r * (cols + 1) + (c + 1);
        const e = (r + 1) * (cols + 1) + (c + 1);
        indices.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }
  const tornCarpetNorth = new THREE.Mesh(trackGeo(buildTornCarpetFlapGeo(-1)), tornCarpetMat);
  const tornCarpetSouth = new THREE.Mesh(trackGeo(buildTornCarpetFlapGeo(1)), tornCarpetMat);
  tornCarpetNorth.renderOrder = -25;
  tornCarpetSouth.renderOrder = -25;

  // 18 Animated Falling Stone Chunks (1 InstancedMesh = 1 DC!)
  const CHASM_CHUNK_COUNT = 18;
  const chasmChunkGeo = trackGeo(tintGeo(THREE, buildSculptedRockGeo(THREE, 0.34, 4123, 0.65, 1), 0x8d93a8, 0x3b3f4e));
  applyBoxUVs(chasmChunkGeo, 1.2);
  const chasmChunkMat = trackMat(new THREE.MeshStandardMaterial({
    map: basaltPbr.albedo,
    roughness: 0.88,
    metalness: 0.08,
    vertexColors: true,
    emissive: 0x241210,
    emissiveIntensity: 0.55,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmChunksInst = new THREE.InstancedMesh(chasmChunkGeo, chasmChunkMat, CHASM_CHUNK_COUNT);
  chasmChunksInst.renderOrder = -27;
  chasmChunksInst.frustumCulled = false;

  const chasmChunkData = [];
  for (let i = 0; i < CHASM_CHUNK_COUNT; i++) {
    const ang = (i / CHASM_CHUNK_COUNT) * Math.PI * 2 + chasmRng() * 0.4;
    const rad = 1.25 + chasmRng() * 0.85;
    chasmChunkData.push({
      x0: Math.cos(ang) * rad,
      z0: Math.sin(ang) * rad,
      vx: Math.cos(ang) * (0.25 - chasmRng() * 0.65),
      vz: Math.sin(ang) * (0.25 - chasmRng() * 0.65),
      vy0: 1.2 + chasmRng() * 2.1,
      delay: (i % 6) * 0.06 + chasmRng() * 0.14,
      rx0: chasmRng() * 6.28,
      ry0: chasmRng() * 6.28,
      rz0: chasmRng() * 6.28,
      vrx: (chasmRng() - 0.5) * 6.5,
      vry: (chasmRng() - 0.5) * 6.5,
      vrz: (chasmRng() - 0.5) * 6.5,
      sx: 0.65 + chasmRng() * 0.95,
      sy: 0.45 + chasmRng() * 0.72,
      sz: 0.65 + chasmRng() * 0.95,
      loopPeriod: 2.3 + chasmRng() * 1.6
    });
  }

  // Rising dark crimson-ash abyss haze inside the open chasm
  const CHASM_MIST_COUNT = isMobile ? 18 : 32;
  const chasmMistPos = new Float32Array(CHASM_MIST_COUNT * 3);
  const chasmMistSeed = new Float32Array(CHASM_MIST_COUNT * 3);
  for (let i = 0; i < CHASM_MIST_COUNT; i++) {
    const a = chasmRng() * Math.PI * 2;
    const r = chasmRng() * 1.95;
    chasmMistPos[i * 3]     = Math.cos(a) * r;
    chasmMistPos[i * 3 + 1] = -chasmRng() * 16.0;
    chasmMistPos[i * 3 + 2] = Math.sin(a) * r;
    chasmMistSeed[i * 3]     = chasmRng();
    chasmMistSeed[i * 3 + 1] = 0.6 + chasmRng() * 0.9;
    chasmMistSeed[i * 3 + 2] = 1.6 + chasmRng() * 1.8;
  }
  const chasmMistGeo = trackGeo(new THREE.BufferGeometry());
  chasmMistGeo.setAttribute('position', new THREE.BufferAttribute(chasmMistPos, 3));
  chasmMistGeo.setAttribute('aSeed', new THREE.BufferAttribute(chasmMistSeed, 3));
  const chasmMistMat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: chasmShaftUniforms.uTime,
      uProgress: chasmRimCrackUniforms.uProgress,
      uTex: { value: mistSpriteTex }
    },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vEmber;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.14 * aSeed.y);
        vec3 p = position;
        p.y = mix(-14.5, 0.55, cyc);
        p.x += sin(uTime * 0.9 + aSeed.x * 12.0) * 0.35;
        p.z += cos(uTime * 0.8 + aSeed.x * 9.0) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 260.0) / max(1.2, -mv.z), 12.0, 140.0);
        vAlpha = sin(cyc * 3.14159) * 0.38;
        vEmber = aSeed.x;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uProgress;
      varying float vAlpha;
      varying float vEmber;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.10, 0.08, 0.12), vec3(0.68, 0.16, 0.05), smoothstep(0.42, 0.95, vEmber));
        float a = t.a * vAlpha * uProgress;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    stencilWrite: true,
    stencilRef: CHASM_STENCIL_ID,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0xFF,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const chasmMistPoints = new THREE.Points(chasmMistGeo, chasmMistMat);
  chasmMistPoints.renderOrder = -25;
  chasmMistPoints.frustumCulled = false;

  const chasmGlowLight = makeLightStub();
  const chasmAbyssFillLight = makeLightStub();

  chasmContent.add(
    chasmStencilMask,
    chasmDepthClear,
    chasmShaftMesh,
    chasmUpwardBackdrop,
    chasmInnerBeams,
    chasmRimCrackMesh,
    rimSlabsGroup,
    tornCarpetNorth,
    tornCarpetSouth,
    chasmChunksInst,
    chasmMistPoints
  );

  // Seamless dual-mode switch: looking DOWN into chasm vs looking UP from inside chasm (camY < -0.18)!
  function syncChasmCameraSide(camY) {
    const below = Number.isFinite(camY) && camY < -0.18;
    if (below === chasmCamBelow) return;
    chasmCamBelow = below;
    chasmShaftUniforms.uCamBelow.value = below ? 1.0 : 0.0;
    chasmStencilMaskMat.depthTest = !below;
    chasmShaftMat.stencilWrite = !below;
    chasmInnerPropMat.stencilWrite = !below;
    chasmChunkMat.stencilWrite = !below;
    chasmMistMat.stencilWrite = !below;
    chasmUpwardBackdrop.visible = below;
    chasmAbyssFillLight.visible = below && stageMode === 'chasm_only' && chasmProgress > 0.01 && !lowSpecMode;
  }

  chasmStencilMask.onBeforeRender = (_renderer, _scene, camera) => {
    if (camera && camera.position) {
      syncChasmCameraSide(camera.position.y);
    }
  };

  // ==========================================================================
  // GROUP B: `shaftAndRiverGroup` — Act 4: Full 360° Gothic Shaft + AAA Underground River + Explosive Iron Grate
  // ==========================================================================
  const shaftRng = makeRng(40499);

  const tunnelStoneMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: basaltPbr.albedo,
      normalMap: lowSpecMode ? null : basaltPbr.normal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: basaltPbr.orm,
      aoMap: basaltPbr.orm,
      aoMapIntensity: 0.78,
      color: 0x7a88a4,
      emissive: 0x0b101b,
      emissiveIntensity: 0.55,
      roughness: 0.88,
      metalness: 0.08,
      vertexColors: true
    })),
    basaltPbr.normal
  );

  const rustedGrateMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: ironPbr.albedo,
      normalMap: lowSpecMode ? null : ironPbr.normal,
      normalScale: new THREE.Vector2(0.92, 0.92),
      roughnessMap: ironPbr.orm,
      color: 0xb09b90,
      roughness: 0.88,
      metalness: 0.72,
      envMapIntensity: 0.58
    })),
    ironPbr.normal
  );

  const shaftTimberMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: barkPbr.albedo,
      normalMap: lowSpecMode ? null : barkPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: barkPbr.orm,
      roughness: 0.92,
      metalness: 0.04,
      vertexColors: true,
      color: 0x907f72
    })),
    barkPbr.normal
  );

  // 1. FULL 360° INWARD-FACING GOTHIC VERTICAL SHAFT (y = -2.2..+26.0m) + POINTED BARREL-VAULTED RIVER TUNNEL!
  function buildShaftAndTunnelGeo() {
    const parts = [];

    const rSegs = isMobile ? 24 : 36;
    const hSegs = 16;
    const shaftH = 28.2; // y = -2.2 .. +26.0m (zero open black gap anywhere!)
    const yMin = -2.2;
    const pos = [];
    const col = [];
    const uv = [];
    // CORRECT INWARD WINDING: (b - a) x (c - a) points -r_hat (INTO the shaft center!)
    const pushInwardQuad = (a, b, c, d) => {
      const verts = [a, b, c, b, d, c];
      for (let i = 0; i < 6; i++) {
        const v = verts[i];
        pos.push(v.x, v.y, v.z);
        col.push(v.cr, v.cg, v.cb);
        uv.push(v.u, v.v);
      }
    };

    const sampleShaftPt = (s, hi) => {
      const th = (s / rSegs) * Math.PI * 2;
      const yFrac = hi / hSegs;
      const y = yMin + yFrac * shaftH;
      // Narrows dramatically near the shattered Throne Hall breach (y = +23..+26m)
      const topPinch = 1.0 - smoothstep(14.5, 25.8, y) * 0.56;
      const crag = 1.0 + 0.075 * Math.sin(th * 5.0 + y * 0.42) + 0.055 * Math.cos(th * 9.0 - y * 0.68) + 0.025 * Math.sin(th * 15.0 + y * 1.1);
      const rad = 7.2 * topPinch * crag;
      // Rich wet seepage darkening + warm crimson Throne Hall top bounce + cool moonlight river bounce!
      const wetRunoff = 0.72 + 0.28 * Math.sin(th * 7.0 + 1.2) * Math.cos(th * 11.0 - 0.5);
      const warmTop = smoothstep(13.5, 25.0, y);
      const coolLow = 1.0 - smoothstep(-1.0, 9.5, y);
      const base = lerp(0.62, 1.05, warmTop) * wetRunoff;
      return {
        x: Math.cos(th) * rad,
        y,
        z: Math.sin(th) * rad,
        u: (s / rSegs) * 9.0,
        v: y / 3.8,
        cr: base * lerp(0.84, 1.52, warmTop) * lerp(1.0, 0.82, coolLow),
        cg: base * lerp(0.92, 0.78, warmTop) * lerp(1.0, 0.96, coolLow),
        cb: base * lerp(1.10, 0.62, warmTop) * lerp(1.0, 1.22, coolLow)
      };
    };

    for (let hi = 0; hi < hSegs; hi++) {
      const yMid = yMin + ((hi + 0.5) / hSegs) * shaftH;
      for (let s = 0; s < rSegs; s++) {
        const thMid = ((s + 0.5) / rSegs) * Math.PI * 2;
        const zDir = Math.sin(thMid);
        // Clean arched opening on +Z side (y in [-1.8..+9.6]) leading directly into the vaulted river tunnel
        const xSpan = Math.abs(Math.cos(thMid));
        const archMaxY = 9.5 - xSpan * xSpan * 5.8;
        if (zDir > 0.56 && yMid < archMaxY && yMid > -2.0) continue;
        const a = sampleShaftPt(s, hi);
        const b = sampleShaftPt(s + 1, hi);
        const c = sampleShaftPt(s, hi + 1);
        const d = sampleShaftPt(s + 1, hi + 1);
        pushInwardQuad(a, b, c, d);
      }
    }
    const shaftWallGeo = new THREE.BufferGeometry();
    shaftWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shaftWallGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    shaftWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shaftWallGeo.computeVertexNormals();
    parts.push(shaftWallGeo);

    // Massive Gothic Stone Ring-Arches & Corbel Collars encircling the shaft every 5m (y = 3, 8, 13, 18, 23m)!
    const ringYs = [3.2, 8.2, 13.2, 18.2, 23.0];
    for (let ri = 0; ri < ringYs.length; ri++) {
      const ry = ringYs[ri];
      const topPinch = 1.0 - smoothstep(14.5, 25.8, ry) * 0.56;
      const ringR = 6.75 * topPinch;
      const segCount = isMobile ? 16 : 22;
      const warmRing = smoothstep(13.0, 23.5, ry);
      const topHex = warmRing > 0.45 ? 0x8b6a64 : 0x6f7c98;
      const botHex = warmRing > 0.45 ? 0x453132 : 0x30384b;
      for (let si = 0; si < segCount; si++) {
        const a0 = (si / segCount) * Math.PI * 2;
        const a1 = ((si + 1) / segCount) * Math.PI * 2;
        const am = (a0 + a1) * 0.5;
        if (Math.sin(am) > 0.52 && ry < 9.8) continue; // keep tunnel mouth completely clear!
        const segLen = 2.0 * ringR * Math.sin(Math.PI / segCount) + 0.25;
        const archBlock = new THREE.BoxGeometry(segLen, 0.72, 0.92);
        xformGeo(archBlock, Math.cos(am) * ringR, ry, Math.sin(am) * ringR, 0, -am + Math.PI * 0.5, 0);
        parts.push(tintGeo(THREE, archBlock, topHex, botHex));

        // Carved vertical gothic wall pilasters every 3rd segment
        if (si % 3 === 0 && ri < ringYs.length - 1) {
          const pil = new THREE.BoxGeometry(0.65, 4.9, 0.72);
          xformGeo(pil, Math.cos(am) * (ringR + 0.12), ry + 2.45, Math.sin(am) * (ringR + 0.12), 0, -am + Math.PI * 0.5, 0);
          parts.push(tintGeo(THREE, pil, topHex, botHex));
        }
      }
    }

    // Jagged 3D Shattered Cathedral Breach Rim Collar at y = +24.2m (REAL dark broken rock silhouette around overhead opening!)
    const breachSegs = 18;
    for (let bi = 0; bi < breachSegs; bi++) {
      const a0 = (bi / breachSegs) * Math.PI * 2;
      const jagR = 2.65 + 0.45 * Math.sin(a0 * 3.0 + 0.5) + 0.28 * Math.cos(a0 * 7.0 - 0.9);
      const slab = buildSculptedRockGeo(THREE, 0.92 + (bi % 3) * 0.22, 6600 + bi, 0.42, 1);
      xformGeo(slab, Math.cos(a0) * jagR, 24.3 + (bi % 2) * 0.28, Math.sin(a0) * jagR, (shaftRng() - 0.5) * 0.35, a0, (shaftRng() - 0.5) * 0.35);
      parts.push(tintGeo(THREE, slab, 0x9c5a46, 0x2a1c22));
    }

    // Vaulted Pointed-Gothic Underground River Tunnel (z = +4.4 -> +37.5m, CORRECT INWARD WINDING!)
    const archSegs = isMobile ? 16 : 22;
    const zSegs = 16;
    const zStart = 4.4;
    const zEnd = 37.5;
    const tPos = [];
    const tCol = [];
    const tUv = [];
    const sampleTunnelPt = (ai, zi) => {
      const aFrac = ai / archSegs;
      const zFrac = zi / zSegs;
      const z = lerp(zStart, zEnd, zFrac);
      const ang = aFrac * Math.PI;
      const hw = 6.20 + Math.sin(z * 0.25 + aFrac * 5.0) * 0.24;
      const x = -Math.cos(ang) * hw;
      const sinA = Math.sin(ang);
      const pointedApex = Math.pow(sinA, 0.76);
      const y = -1.8 + pointedApex * 11.2 + Math.cos(z * 0.37 + ai * 1.4) * 0.14;
      const moonReach = smoothstep(11.0, 32.0, z);
      const wetDark = smoothstep(-1.4, 2.4, y);
      const base = lerp(0.42, 0.94, wetDark) * lerp(0.76, 1.24, moonReach);
      return {
        x,
        y,
        z,
        u: z / 3.8,
        v: aFrac * 6.5,
        cr: base * lerp(0.80, 0.92, moonReach),
        cg: base * lerp(0.90, 1.04, moonReach),
        cb: base * lerp(1.08, 1.30, moonReach)
      };
    };
    for (let zi = 0; zi < zSegs; zi++) {
      for (let ai = 0; ai < archSegs; ai++) {
        const a = sampleTunnelPt(ai, zi);
        const b = sampleTunnelPt(ai + 1, zi);
        const c = sampleTunnelPt(ai, zi + 1);
        const d = sampleTunnelPt(ai + 1, zi + 1);
        // CORRECT INWARD WINDING: (b - a) x (c - a) points DOWN/INWARD into tunnel!
        const verts = [a, b, c, b, d, c];
        for (let k = 0; k < 6; k++) {
          const v = verts[k];
          tPos.push(v.x, v.y, v.z);
          tCol.push(v.cr, v.cg, v.cb);
          tUv.push(v.u, v.v);
        }
      }
    }
    const tunnelVaultGeo = new THREE.BufferGeometry();
    tunnelVaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    tunnelVaultGeo.setAttribute('color', new THREE.Float32BufferAttribute(tCol, 3));
    tunnelVaultGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tUv, 2));
    tunnelVaultGeo.computeVertexNormals();
    parts.push(tunnelVaultGeo);

    // Heavy Gothic Ribbed Stone Arches, Carved Keystones & Wet Curbs every 5.0m along tunnel
    for (let az = 6.5; az <= 36.5; az += 5.0) {
      const segs = 12;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI;
        const a1 = ((i + 1) / segs) * Math.PI;
        const x0 = -Math.cos(a0) * 5.88;
        const y0 = -1.2 + Math.pow(Math.sin(a0), 0.76) * 10.4;
        const x1 = -Math.cos(a1) * 5.88;
        const y1 = -1.2 + Math.pow(Math.sin(a1), 0.76) * 10.4;
        const len = Math.hypot(x1 - x0, y1 - y0) + 0.18;
        const rotZ = Math.atan2(y1 - y0, x1 - x0);
        const rib = new THREE.BoxGeometry(len, 0.76, 0.94);
        xformGeo(rib, (x0 + x1) * 0.5, (y0 + y1) * 0.5, az, 0, 0, rotZ);
        parts.push(tintGeo(THREE, rib, 0x8290ad, 0x3b4458));
      }
      // Crown keystone block
      parts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.95, 1.15, 1.15), 0, 9.15, az), 0x8d9cb8, 0x454f64));
      for (const side of [-1, 1]) {
        const ledge = new THREE.BoxGeometry(1.55, 2.0, 5.1);
        xformGeo(ledge, side * 5.75, -0.35, az);
        parts.push(tintGeo(THREE, ledge, 0x5c6880, 0x242a38));
      }
    }

    // Protruding mossy wet rock shelves inside the vertical shaft
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + shaftRng() * 0.45;
      const y = 1.8 + (i / 16) * 19.5;
      if (Math.sin(ang) > 0.50 && y < 9.8) continue;
      const topPinch = 1.0 - smoothstep(14.5, 25.8, y) * 0.56;
      const r = 6.35 * topPinch;
      const ledge = buildSculptedRockGeo(THREE, 1.05 + shaftRng() * 0.75, 500 + i, 0.48, 1);
      xformGeo(ledge, Math.cos(ang) * r, y, Math.sin(ang) * r, 0, ang, (shaftRng() - 0.5) * 0.22);
      parts.push(tintGeo(THREE, ledge, 0x647088, 0x262c3a));
    }

    // Dark rocky underwater riverbed floor enclosing shaft bottom & river tunnel (y = -2.25m -> 0 sky void underwater!)
    const riverBed = new THREE.BoxGeometry(16.0, 0.8, 56.0);
    xformGeo(riverBed, 0, -2.35, 17.5);
    parts.push(tintGeo(THREE, riverBed, 0x182534, 0x090f18));

    // Submerged riverbed boulders visible during underwater tumble
    for (let bi = 0; bi < 14; bi++) {
      const bx = (shaftRng() - 0.5) * 9.5;
      const bz = 2.0 + bi * 2.4 + shaftRng() * 1.2;
      const rb = buildSculptedRockGeo(THREE, 0.65 + shaftRng() * 0.65, 580 + bi, 0.48, 1);
      xformGeo(rb, bx, -1.78, bz, 0, shaftRng() * 6.28, 0);
      parts.push(tintGeo(THREE, rb, 0x24384a, 0x0d1520));
    }

    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 3.4, withColor: true });
  }

  const shaftTunnelMesh = new THREE.Mesh(trackGeo(buildShaftAndTunnelGeo()), tunnelStoneMat);
  shaftTunnelMesh.receiveShadow = true;
  shaftAndRiverGroup.add(shaftTunnelMesh);

  // 2. Snapped Wall-Embedded Timber Joist Stubs, Twisted Roots & Hanging Rusted Iron Chains inside the Shaft!
  //    (All timbers stay strictly outside r > 4.65m so upward & downward camera shots are 100% unobstructed!)
  const shaftTimberParts = [];
  const shaftChainParts = [];
  const beamHeights = [20.5, 17.4, 14.2, 11.2, 8.2, 5.2, 2.8];
  for (let i = 0; i < beamHeights.length; i++) {
    const by = beamHeights[i];
    const ang = i * 1.18 + 0.42;
    const side = (i % 2 === 0) ? 1 : -1;
    const topPinch = 1.0 - smoothstep(14.5, 25.8, by) * 0.56;
    const wallR = 6.7 * topPinch;
    // Snapped jutting broken timber stub anchored in stone wall (never crossing center camera view!)
    const stubA = 1.85 + shaftRng() * 0.75;
    const beam = new THREE.BoxGeometry(stubA, 0.30, 0.34);
    xformGeo(
      beam,
      Math.cos(ang) * (wallR - stubA * 0.38) * side,
      by,
      Math.sin(ang) * (wallR - stubA * 0.38) * side,
      (shaftRng() - 0.5) * 0.16,
      -ang,
      side * (0.18 + shaftRng() * 0.22)
    );
    shaftTimberParts.push(tintGeo(THREE, beam, 0x625044, 0x2b221c));

    // Opposite snapped splintered stub
    const stubLen = 1.55 + shaftRng() * 0.75;
    const stub = new THREE.BoxGeometry(stubLen, 0.26, 0.28);
    xformGeo(
      stub,
      -Math.cos(ang) * (wallR - stubLen * 0.36) * side,
      by - 0.65,
      -Math.sin(ang) * (wallR - stubLen * 0.36) * side,
      0.14,
      -ang,
      -side * (0.22 + shaftRng() * 0.18)
    );
    shaftTimberParts.push(tintGeo(THREE, stub, 0x524339, 0x221b17));

    // Twisting hanging subterranean root clusters draping down shaft masonry
    for (let rt = 0; rt < 2; rt++) {
      const ra = ang + 0.85 + rt * 1.45;
      if (Math.sin(ra) > 0.55 && by < 10.0) continue;
      const rootLen = 3.8 + shaftRng() * 2.8;
      const root = new THREE.CylinderGeometry(0.045, 0.13, rootLen, 6);
      xformGeo(
        root,
        Math.cos(ra) * (5.6 * topPinch),
        by - 1.5,
        Math.sin(ra) * (5.6 * topPinch),
        (shaftRng() - 0.5) * 0.26,
        ra,
        (shaftRng() - 0.5) * 0.30
      );
      shaftTimberParts.push(tintGeo(THREE, root, 0x3f362d, 0x1d1915));
    }

    // Hanging rusted iron chains dangling from the stone rings!
    const ca = ang + 2.25;
    if (!(Math.sin(ca) > 0.50 && by < 11.0)) {
      const chainR = 5.45 * topPinch;
      addHangingChainParts(
        THREE,
        shaftChainParts,
        Math.cos(ca) * chainR,
        by + 0.6,
        Math.sin(ca) * chainR,
        isMobile ? 9 : 14,
        0.25,
        Math.cos(ca) * -0.18,
        Math.sin(ca) * -0.18
      );
    }
  }
  // Extra hanging chains along tunnel vault piers approaching the grate
  for (let cz = 11.5; cz <= 21.5; cz += 5.0) {
    for (const sx of [-4.8, 4.8]) {
      addHangingChainParts(THREE, shaftChainParts, sx, 6.2, cz, isMobile ? 7 : 10, 0.24, 0, 0.14);
    }
  }

  const shaftTimbersMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, shaftTimberParts, { boxUvTile: 1.8, withColor: true })),
    shaftTimberMat
  );
  shaftAndRiverGroup.add(shaftTimbersMesh);

  const shaftChainsMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, shaftChainParts, { boxUvTile: 0.8 })),
    rustedGrateMat
  );
  shaftAndRiverGroup.add(shaftChainsMesh);

  // 3. REAL Jagged Throne Hall Overhead Breach (y = +25.4m) + Dark Cathedral Vault Glimpse + 3 Volumetric Crimson-Gold God-Ray Cones!
  //    (Replaces the old flat orange star with real architectural depth & volumetric light!)
  const shaftTopGlowUniforms = { uTime: { value: 0.0 } };
  const shaftBreachSkyMat = trackMat(new THREE.ShaderMaterial({
    uniforms: shaftTopGlowUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        // Dark smoky vaulted Throne Hall ceiling + silhouetted cathedral arches glimpsed high above the breach!
        float smoke1 = vnoise(p * 4.5 + vec2(uTime * 0.18, -uTime * 0.14));
        float smoke2 = vnoise(p * 9.5 - vec2(uTime * 0.25, uTime * 0.16));
        float smoke = smoke1 * 0.58 + smoke2 * 0.42;
        // Bold dark gothic cathedral vaulting ribs & crossed ceiling beams framing the fiery Throne Hall smoke!
        float ribA = smoothstep(0.055, 0.13, abs(p.x + p.y * 0.42));
        float ribB = smoothstep(0.055, 0.13, abs(p.y - p.x * 0.42));
        float ribRing = smoothstep(0.035, 0.085, abs(r - 0.26));
        float ribs = 0.22 + 0.78 * min(min(ribA, ribB), ribRing);
        float core = exp(-r * r * 2.8);
        float flick = 0.86 + 0.14 * sin(uTime * 5.4) + 0.06 * sin(uTime * 11.7);
        vec3 hallDark = vec3(0.035, 0.018, 0.032);
        vec3 fireMist = mix(vec3(0.55, 0.09, 0.025), vec3(1.35, 0.42, 0.10), smoothstep(0.22, 0.86, smoke * 0.75 + core * 0.42));
        vec3 col = mix(hallDark, fireMist, clamp(core * 0.82 + smoke * 0.34, 0.0, 1.0)) * ribs * flick;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: false
  }));
  const shaftTopPortal = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(7.5, 24)), shaftBreachSkyMat);
  shaftTopPortal.rotation.x = Math.PI * 0.5;
  shaftTopPortal.position.set(0, 25.8, 0);
  shaftAndRiverGroup.add(shaftTopPortal);

  // 3 Layered Volumetric Crimson-Gold God-Ray Cones descending from the jagged breach!
  const shaftRayMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: shaftTopGlowUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        float fres = pow(abs(dot(normalize(vNorm), normalize(vView))), 1.75);
        float topFade = smoothstep(0.0, 0.72, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
        float streak1 = 0.55 + 0.45 * sin(vUv.x * 25.13 + uTime * 0.65 + vUv.y * 2.5);
        float streak2 = 0.65 + 0.35 * cos(vUv.x * 43.98 - uTime * 0.45 - vUv.y * 4.0);
        float a = fres * topFade * streak1 * streak2 * 0.18;
        if (a < 0.004) discard;
        vec3 col = mix(vec3(0.92, 0.24, 0.07), vec3(1.45, 0.72, 0.24), smoothstep(0.35, 0.95, vUv.y));
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  }));
  const raySpecs = [
    { rt: 1.85, rb: 4.85, h: 23.0, x: 0.0,  y: 13.0, z: 0.0,  rx:  0.00, rz:  0.00 },
    { rt: 1.25, rb: 3.40, h: 21.5, x: -0.4, y: 13.6, z: -0.3, rx:  0.05, rz:  0.07 },
    { rt: 1.15, rb: 3.20, h: 20.5, x:  0.5, y: 14.0, z:  0.2, rx: -0.04, rz: -0.06 }
  ];
  for (let i = 0; i < raySpecs.length; i++) {
    const rs = raySpecs[i];
    const ray = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(rs.rt, rs.rb, rs.h, 18, 1, true)), shaftRayMat);
    ray.position.set(rs.x, rs.y, rs.z);
    ray.rotation.set(rs.rx, i * 1.1, rs.rz);
    shaftAndRiverGroup.add(ray);
  }

  // 4. AAA Rushing Dark-Slate Underground River (ZERO plastic mercury blobs! Fine FBM rapids, rich foam & teal underwater!)
  const tunnelRiverUniforms = {
    uTime: { value: 0.0 },
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 },
    uGrateBroken: { value: 0.0 }
  };
  const tunnelRiverGeo = trackGeo(new THREE.PlaneGeometry(14.0, 50.0, isMobile ? 24 : 40, isMobile ? 42 : 76));
  tunnelRiverGeo.rotateX(-Math.PI * 0.5);
  tunnelRiverGeo.translate(0, 0.0, 17.5);

  const tunnelRiverMat = trackMat(new THREE.ShaderMaterial({
    uniforms: tunnelRiverUniforms,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWaveH;
      void main() {
        vUv = uv;
        vec3 p = position;
        float t = uTime * 3.6;
        // Restrained physical chop (ZERO thick bulbous mercury waves!)
        float w1 = sin(p.z * 0.85 - t * 2.2 + sin(p.x * 1.15) * 0.9) * 0.048;
        float w2 = cos(p.x * 1.85 + p.z * 1.45 - t * 3.1) * 0.026;
        float w3 = sin(p.x * 3.2 - p.z * 2.1 - t * 4.0) * 0.014;
        float splashZone = exp(-dot(p.xz, p.xz) * 0.085) * 0.11;
        float grateChurn = exp(-pow(p.z - 25.8, 2.0) * 0.18) * 0.09;
        float disp = w1 + w2 + w3 + (splashZone + grateChurn) * sin(t * 4.2 + p.x * 3.2);
        p.y += disp;
        vWaveH = disp;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      uniform float uGrateBroken;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vWaveH;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm4(vec2 p) {
        float v = 0.0;
        float a = 0.50;
        for (int i = 0; i < 4; i++) {
          v += a * vnoise(p);
          p = p * 2.12 + vec2(11.3, 7.1);
          a *= 0.48;
        }
        return v;
      }
      float fbm2(vec2 p) {
        return vnoise(p) * 0.65 + vnoise(p * 2.2 + vec2(9.1, 5.7)) * 0.35;
      }

      void main() {
        float flowT = uTime * 3.2;
        // High-frequency elongated current ripples racing down +Z
        vec2 flowA = vec2(vWorldPos.x * 1.45, vWorldPos.z * 0.58 - flowT * 1.15);
        vec2 flowB = vec2(vWorldPos.x * 2.65 + 4.2, vWorldPos.z * 1.12 - flowT * 1.72);
        float nA = uLowSpec < 0.5 ? fbm4(flowA) : fbm2(flowA);
        float nB = uLowSpec < 0.5 ? fbm4(flowB + vec2(nA * 0.85, -flowT * 0.35)) : fbm2(flowB);
        float h0 = nA * 0.55 + nB * 0.45;

        // Crisp fine-scale micro-ripple normal (subtle slope -> matte slate water, ZERO oily plastic sheen!)
        float eps = 0.09;
        float hX = (fbm2(flowA + vec2(eps, 0.0)) * 0.55 + fbm2(flowB + vec2(eps * 1.6, 0.0)) * 0.45);
        float hZ = (fbm2(flowA + vec2(0.0, eps)) * 0.55 + fbm2(flowB + vec2(0.0, eps * 1.6)) * 0.45);
        vec3 N = normalize(vec3((h0 - hX) * 2.1, 1.0, (h0 - hZ) * 2.4));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float ndotv = max(dot(N, V), 0.0);
        float fres = pow(1.0 - ndotv, 4.5);

        // Deep matte dark-slate subterranean river water with spatially varying roughness
        float moonReach = smoothstep(5.0, 29.0, vWorldPos.z);
        vec3 deepSlate  = vec3(0.007, 0.014, 0.022);
        vec3 turbidTeal = vec3(0.018, 0.036, 0.048);
        vec3 skyTint    = vec3(0.095, 0.145, 0.225);
        vec3 col = mix(deepSlate, turbidTeal, clamp(h0 * 0.52 + moonReach * 0.25, 0.0, 1.0));
        col = mix(col, skyTint, fres * (0.20 + 0.36 * moonReach));

        // Soft restrained silver moonlight path from the outfall exit + fine broken ripple glints
        vec3 moonPos = vec3(0.0, 5.2, 37.0);
        vec3 Lm = normalize(moonPos - vWorldPos);
        vec3 Hm = normalize(Lm + V);
        float roughVar = mix(42.0, 140.0, smoothstep(0.35, 0.80, nB));
        float moonGlint = pow(max(dot(N, Hm), 0.0), roughVar) * (0.25 + 1.15 * moonReach);
        float softMoonPath = pow(max(dot(N, Hm), 0.0), 14.0) * 0.08 * moonReach * smoothstep(5.5, 0.0, abs(vWorldPos.x));
        col += vec3(0.56, 0.74, 0.96) * (moonGlint * 0.75 + softMoonPath);

        // Warm crimson-amber reflections near the vertical shaft drop (z ~ 0)
        float shaftProx = exp(-dot(vWorldPos.xz, vWorldPos.xz) * 0.028);
        vec3 Lr = normalize(vec3(0.0, 20.0, 0.0) - vWorldPos);
        vec3 Hr = normalize(Lr + V);
        float redSpec = pow(max(dot(N, Hr), 0.0), 48.0) * shaftProx;
        col += vec3(0.95, 0.26, 0.08) * (redSpec * 0.65 + shaftProx * 0.055);

        // CRISP LACY WHITEWATER FOAM: fine filament current streaks + wet stone bank foam + plunge & grate boil!
        float streakUv = vnoise(vec2(vWorldPos.x * 3.8 + nA * 1.4, vWorldPos.z * 0.34 - flowT * 0.92));
        float fineLace = smoothstep(0.56, 0.88, nB);
        float rapidsStreaks = smoothstep(0.70, 0.92, streakUv * 0.62 + nB * 0.48) * smoothstep(0.50, 0.84, h0) * 0.56;
        float bankMask = smoothstep(4.25, 5.65, abs(vWorldPos.x));
        float edgeFoam = bankMask * smoothstep(0.42, 0.82, nB * 0.68 + nA * 0.38) * 0.82;
        float splashFoam = exp(-dot(vWorldPos.xz, vWorldPos.xz) * 0.11) * smoothstep(0.42, 0.82, nB) * 0.78;
        float grateBand = exp(-pow(vWorldPos.z - 25.9, 2.0) * 0.24);
        float grateFoam = grateBand * (0.46 + 0.52 * uGrateBroken) * smoothstep(0.38, 0.80, nB * 0.65 + streakUv * 0.35);
        float foam = clamp(rapidsStreaks + edgeFoam + splashFoam + grateFoam + fineLace * max(0.0, vWaveH * 2.8), 0.0, 0.86);

        vec3 foamDark = vec3(0.24, 0.34, 0.46);
        vec3 foamLit  = vec3(0.72, 0.82, 0.94);
        vec3 foamCol  = mix(foamDark, foamLit, clamp(moonReach * 0.72 + 0.18 + grateBand * 0.22, 0.0, 1.0));
        col = mix(col, foamCol, foam * 0.78);

        // Deep turquoise-teal backlit underwater view when camera submerges (camY < 0)!
        if (!gl_FrontFacing) {
          float caustic = pow(clamp(nB * 0.65 + nA * 0.45, 0.0, 1.0), 2.4);
          vec3 deepTeal = vec3(0.012, 0.052, 0.072);
          vec3 brightAqua = vec3(0.18, 0.48, 0.62);
          vec3 underCol = mix(deepTeal, brightAqua, caustic * (0.45 + 0.55 * moonReach));
          underCol += vec3(0.42, 0.14, 0.06) * shaftProx * 0.55;
          underCol += vec3(0.45, 0.72, 0.88) * smoothstep(0.72, 0.95, h0) * moonReach * 0.45;
          col = underCol;
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide
  }));
  const tunnelRiverMesh = new THREE.Mesh(tunnelRiverGeo, tunnelRiverMat);
  shaftAndRiverGroup.add(tunnelRiverMesh);

  // 5. Heavy Forged Rusty Iron Outfall Grate at z = +26.0m with EXPLOSIVE 5-Bar Break & 6 Flying Debris Shards!
  const grateGroup = new THREE.Group();
  grateGroup.position.set(0, 0, 26.0);
  shaftAndRiverGroup.add(grateGroup);

  const grateFrameParts = [];
  // Top riveted iron lintel, upper transom, submerged sill & heavy stone-bolted side jambs
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(11.8, 0.54, 0.52), 0, 7.65, 0));
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(11.8, 0.36, 0.40), 0, 5.55, 0));
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(11.8, 0.34, 0.38), 0, 0.15, 0));
  // Heavy forged side jamb brackets & rivet studs
  for (const sx of [-5.35, 5.35]) {
    grateFrameParts.push(xformGeo(new THREE.BoxGeometry(0.72, 8.8, 0.72), sx, 3.7, 0));
    for (let ry = 1.0; ry <= 7.0; ry += 1.5) {
      grateFrameParts.push(xformGeo(new THREE.BoxGeometry(0.18, 0.18, 0.86), sx, ry, 0));
    }
  }
  // Fixed outer flank forged vertical bars (|x| >= 2.45 -> leaves massive 3.9m central breach when center 5 bars shatter!)
  const outerBarXs = [-4.85, -4.05, -3.25, -2.45, 2.45, 3.25, 4.05, 4.85];
  for (let i = 0; i < outerBarXs.length; i++) {
    const bx = outerBarXs[i];
    grateFrameParts.push(xformGeo(new THREE.CylinderGeometry(0.115, 0.125, 8.6, 8), bx, 3.7, 0));
    // Forged collar clasps & rivets at cross-bar intersections
    for (const cy of [0.22, 2.75, 5.55]) {
      grateFrameParts.push(xformGeo(new THREE.BoxGeometry(0.32, 0.28, 0.44), bx, cy, 0));
    }
  }
  // Outer fixed side cross-bar stubs flanking the central breach
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(3.2, 0.30, 0.34), -3.85, 2.75, 0.04));
  grateFrameParts.push(xformGeo(new THREE.BoxGeometry(3.2, 0.30, 0.34),  3.85, 2.75, 0.04));
  // Hanging rusted chains bolted to the upper grate lintel
  addHangingChainParts(THREE, grateFrameParts, -2.85, 7.3, 0.25, 8, 0.22, -0.08, 0.12);
  addHangingChainParts(THREE, grateFrameParts,  2.85, 7.3, 0.25, 8, 0.22,  0.08, 0.12);

  const grateFrameMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, grateFrameParts, { boxUvTile: 1.5 })),
    rustedGrateMat
  );
  grateGroup.add(grateFrameMesh);

  // Damp mossy clumps clinging to lower grate frame corners
  const grateMossParts = [];
  for (const sx of [-4.7, -3.6, 3.6, 4.7]) {
    const mp = buildSculptedRockGeo(THREE, 0.42, 6900 + Math.abs(sx * 10), 0.52, 1);
    xformGeo(mp, sx, 0.55, 0.22);
    grateMossParts.push(tintGeo(THREE, mp, 0x2a4534, 0x132219));
  }
  const grateMossMat = trackMat(new THREE.MeshStandardMaterial({
    roughness: 0.94,
    metalness: 0.02,
    vertexColors: true
  }));
  grateGroup.add(new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, grateMossParts, { withColor: true })), grateMossMat));

  // CENTRAL 5 BREAKABLE FORGED IRON BARS (x = -1.6, -0.8, 0.0, +0.8, +1.6 -> 3.8m+ CLEAN OPEN BREACH!)
  // Each bar splits cleanly at mid-height and rips violently OUTWARD +Z by 78–96 degrees!
  const breakableBars = [];
  const centralUpperBarGeo = trackGeo((() => {
    const parts = [];
    parts.push(xformGeo(new THREE.CylinderGeometry(0.11, 0.12, 3.85, 8), 0, -1.92, 0));
    // Forged iron collar band + jagged snapped tip cone
    parts.push(xformGeo(new THREE.BoxGeometry(0.32, 0.26, 0.38), 0, -1.85, 0));
    parts.push(xformGeo(new THREE.ConeGeometry(0.11, 0.36, 5), 0, -3.96, 0, Math.PI, 0, 0));
    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.2 });
  })());
  const centralLowerBarGeo = trackGeo((() => {
    const parts = [];
    parts.push(xformGeo(new THREE.CylinderGeometry(0.11, 0.125, 3.75, 8), 0, 1.88, 0));
    parts.push(xformGeo(new THREE.BoxGeometry(0.32, 0.26, 0.38), 0, 0.52, 0));
    parts.push(xformGeo(new THREE.ConeGeometry(0.105, 0.34, 5), 0, 3.86, 0));
    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.2 });
  })());

  for (let i = -2; i <= 2; i++) {
    const bx = i * 0.80;
    const topPivot = new THREE.Group();
    topPivot.position.set(bx, 7.45, 0);
    const topBar = new THREE.Mesh(centralUpperBarGeo, rustedGrateMat);
    topPivot.add(topBar);
    grateGroup.add(topPivot);

    const botPivot = new THREE.Group();
    botPivot.position.set(bx, -0.35, 0);
    const botBar = new THREE.Mesh(centralLowerBarGeo, rustedGrateMat);
    botPivot.add(botBar);
    grateGroup.add(botPivot);

    // ALL 5 central bars bend violently outward 78..96 deg (1.36..1.68 rad) & splay sideways for a HUGE clean breach!
    const absI = Math.abs(i);
    const splaySign = i === 0 ? 0.18 : Math.sign(i);
    breakableBars.push({
      topPivot,
      botPivot,
      targetTopRx: -(absI === 0 ? 1.66 : absI === 1 ? 1.54 : 1.40), // -80 to -95 deg outward (+Z)
      targetBotRx:  (absI === 0 ? 1.58 : absI === 1 ? 1.48 : 1.36), // +78 to +91 deg outward (+Z)
      targetRz: splaySign * (absI === 0 ? 0.14 : absI === 1 ? 0.38 : 0.62),
      delay: absI * 0.028
    });
  }

  // Central riveted horizontal locking crossbar splits into left & right hinged halves swinging wide open!
  const crossHalfGeo = trackGeo(new THREE.BoxGeometry(2.35, 0.30, 0.34));
  const crossLeftPivot = new THREE.Group();
  crossLeftPivot.position.set(-2.25, 2.75, 0.06);
  const crossLeftMesh = new THREE.Mesh(crossHalfGeo, rustedGrateMat);
  crossLeftMesh.position.x = 1.15;
  crossLeftPivot.add(crossLeftMesh);
  grateGroup.add(crossLeftPivot);

  const crossRightPivot = new THREE.Group();
  crossRightPivot.position.set(2.25, 2.75, 0.06);
  const crossRightMesh = new THREE.Mesh(crossHalfGeo, rustedGrateMat);
  crossRightMesh.position.x = -1.15;
  crossRightPivot.add(crossRightMesh);
  grateGroup.add(crossRightPivot);

  // 6 Flying 3D Broken Iron Bar Debris Shards blasting outward (+Z) on grate break!
  const debrisShardGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.105, 1.35, 7));
  const grateDebris = [];
  const debrisSpecs = [
    { x: -1.1, y: 3.1, vx: -2.8, vy: 4.2, vz: 14.5, rx: 5.8, ry: 3.2, rz: 4.4 },
    { x: -0.4, y: 2.3, vx: -1.4, vy: 5.5, vz: 17.0, rx: -6.4, ry: 4.1, rz: -3.5 },
    { x:  0.1, y: 3.8, vx:  0.8, vy: 6.2, vz: 18.2, rx: 7.2, ry: -3.8, rz: 5.1 },
    { x:  0.7, y: 2.6, vx:  2.2, vy: 4.8, vz: 15.8, rx: -5.2, ry: -4.6, rz: -6.0 },
    { x:  1.3, y: 3.4, vx:  3.4, vy: 3.9, vz: 13.6, rx: 4.8, ry: 5.2, rz: 3.8 },
    { x: -0.2, y: 1.7, vx: -0.6, vy: 3.1, vz: 16.4, rx: -7.0, ry: 2.4, rz: 4.9 }
  ];
  for (let i = 0; i < debrisSpecs.length; i++) {
    const ds = debrisSpecs[i];
    const m = new THREE.Mesh(debrisShardGeo, rustedGrateMat);
    m.visible = false;
    grateGroup.add(m);
    grateDebris.push({ mesh: m, ...ds });
  }

  // 6. Atmospheric Moonlit Night Gorge Exit Portal & Slanting Moonlight Shafts (z = +26..+44m!)
  const tunnelMoonBackdropMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelRiverUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        // Underwater sub-surface band (y < 0.05): murky deep teal-black abyss so underwater camera sees ZERO bright cyan strip!
        if (vWorldPos.y < 0.08) {
          float uwFade = smoothstep(-1.4, 0.08, vWorldPos.y);
          vec3 uwCol = mix(vec3(0.008, 0.024, 0.036), vec3(0.022, 0.064, 0.088), uwFade);
          gl_FragColor = vec4(uwCol, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        // Moody nocturnal moonlit gorge mist outside tunnel exit (never harsh overexposed white!)
        float mist = vnoise(p * 3.4 + vec2(uTime * 0.08, -uTime * 0.05)) * 0.62 +
                     vnoise(p * 7.2 - vec2(uTime * 0.12, uTime * 0.04)) * 0.38;
        float glow = exp(-dot(p - vec2(0.0, 0.08), p - vec2(0.0, 0.08)) * 2.6);
        float mistBand = exp(-pow(p.y + 0.16, 2.0) * 5.2) * (0.65 + 0.35 * mist);
        vec3 nightCol = vec3(0.016, 0.028, 0.062);
        vec3 moonMist = vec3(0.20, 0.34, 0.56);
        vec3 col = mix(nightCol, moonMist, clamp(glow * 0.72 + mistBand * 0.42 + mist * 0.10, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: false
  }));
  const tunnelMoonBackdrop = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(36, 26)), tunnelMoonBackdropMat);
  tunnelMoonBackdrop.position.set(0, 5.2, 43.0);
  tunnelMoonBackdrop.rotation.y = Math.PI;
  shaftAndRiverGroup.add(tunnelMoonBackdrop);

  // Volumetric cold moonlight god-ray sheets slanting inward from the iron grate
  const moonBeamMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelRiverUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float sideFade = sin(vUv.x * 3.14159);
        float lenFade = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.45, 1.0, vUv.y));
        float bars = 0.70 + 0.30 * sin(vUv.x * 20.0 + 0.4);
        float drift = 0.85 + 0.15 * sin(uTime * 1.1 + vUv.y * 6.0);
        float a = sideFade * lenFade * bars * drift * 0.20;
        if (a < 0.005) discard;
        gl_FragColor = vec4(vec3(0.54, 0.74, 1.02), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  }));
  for (let b = 0; b < 3; b++) {
    const beam = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.2, 13.5)), moonBeamMat);
    beam.position.set((b - 1) * 1.9, 3.6 - b * 0.2, 22.8);
    beam.rotation.set(-0.92, (b - 1) * 0.14, 0);
    shaftAndRiverGroup.add(beam);
  }

  // 7. Falling Shaft Dust & Embers + Grate-Break Sparks & Whitewater Spray Burst!
  const SHAFT_DUST_COUNT = isMobile ? 85 : 180;
  const shaftDustPos = new Float32Array(SHAFT_DUST_COUNT * 3);
  const shaftDustSeed = new Float32Array(SHAFT_DUST_COUNT * 3);
  for (let i = 0; i < SHAFT_DUST_COUNT; i++) {
    const a = shaftRng() * Math.PI * 2;
    const r = 0.6 + shaftRng() * 5.1;
    shaftDustPos[i * 3]     = Math.cos(a) * r;
    shaftDustPos[i * 3 + 1] = shaftRng() * 24.0;
    shaftDustPos[i * 3 + 2] = Math.sin(a) * r;
    shaftDustSeed[i * 3]     = shaftRng();
    shaftDustSeed[i * 3 + 1] = 0.65 + shaftRng() * 0.90;
    shaftDustSeed[i * 3 + 2] = 0.7 + shaftRng() * 1.4;
  }
  const shaftDustGeo = trackGeo(new THREE.BufferGeometry());
  shaftDustGeo.setAttribute('position', new THREE.BufferAttribute(shaftDustPos, 3));
  shaftDustGeo.setAttribute('aSeed', new THREE.BufferAttribute(shaftDustSeed, 3));
  const shaftDustMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: tunnelRiverUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        float cyc = fract(aSeed.x - uTime * 0.26 * aSeed.y);
        vec3 p = position;
        p.y = cyc * 24.0;
        p.x += sin(uTime * 1.3 + aSeed.x * 16.0) * 0.32;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 78.0) / max(1.0, -mv.z), 2.5, 22.0);
        vAlpha = sin(cyc * 3.14159) * 0.62;
        vWarm = smoothstep(10.0, 22.5, p.y);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.55, 0.70, 0.88), vec3(1.25, 0.48, 0.18), vWarm);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const shaftDustPoints = new THREE.Points(shaftDustGeo, shaftDustMat);
  shaftAndRiverGroup.add(shaftDustPoints);

  // Grate Break Burst (110 Sparks + Exploding Whitewater Spray at z = +26m!)
  const GRATE_BURST_COUNT = isMobile ? 60 : 112;
  const grateBurstPos = new Float32Array(GRATE_BURST_COUNT * 3);
  const grateBurstVel = new Float32Array(GRATE_BURST_COUNT * 3);
  const grateBurstKind = new Float32Array(GRATE_BURST_COUNT);
  for (let i = 0; i < GRATE_BURST_COUNT; i++) {
    const isSpark = i < Math.floor(GRATE_BURST_COUNT * 0.48);
    grateBurstPos[i * 3]     = (shaftRng() - 0.5) * 4.4;
    grateBurstPos[i * 3 + 1] = 0.5 + shaftRng() * 5.0;
    grateBurstPos[i * 3 + 2] = 26.0;
    grateBurstVel[i * 3]     = (shaftRng() - 0.5) * (isSpark ? 10.5 : 8.2);
    grateBurstVel[i * 3 + 1] = (isSpark ? 2.8 : 4.5) + shaftRng() * 6.2;
    grateBurstVel[i * 3 + 2] = (isSpark ? 7.5 : 9.5) + shaftRng() * 10.5;
    grateBurstKind[i]        = isSpark ? 1.0 : 0.0;
  }
  const grateBurstGeo = trackGeo(new THREE.BufferGeometry());
  grateBurstGeo.setAttribute('position', new THREE.BufferAttribute(grateBurstPos, 3));
  grateBurstGeo.setAttribute('aVel', new THREE.BufferAttribute(grateBurstVel, 3));
  grateBurstGeo.setAttribute('aKind', new THREE.BufferAttribute(grateBurstKind, 1));
  const grateBurstUniforms = {
    uAge: { value: 0.0 },
    uTex: { value: mistSpriteTex }
  };
  const grateBurstMat = trackMat(new THREE.ShaderMaterial({
    uniforms: grateBurstUniforms,
    vertexShader: `
      attribute vec3 aVel;
      attribute float aKind;
      uniform float uAge;
      varying float vAlpha;
      varying float vKind;
      void main() {
        float t = clamp(uAge, 0.0, 1.5);
        vec3 p = position + aVel * t + vec3(0.0, -9.8 * 0.5 * t * t, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float sz = mix(195.0, 72.0, aKind);
        gl_PointSize = clamp(sz / max(1.0, -mv.z), 3.0, 62.0);
        vAlpha = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.55, 1.38, t));
        vKind = aKind;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vKind;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 sprayCol = vec3(0.82, 0.92, 1.0);
        vec3 sparkCol = vec3(2.15, 1.05, 0.32);
        vec3 col = mix(sprayCol, sparkCol, vKind);
        float a = t.a * vAlpha * mix(0.75, 1.0, vKind);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const grateBurstPoints = new THREE.Points(grateBurstGeo, grateBurstMat);
  grateBurstPoints.visible = false;
  grateBurstPoints.frustumCulled = false;
  shaftAndRiverGroup.add(grateBurstPoints);

  // Zero-recompile stubs (lighting driven cleanly by world.js permanent rig + stone emissive bounce)
  const shaftCrimsonLight = makeLightStub();
  const shaftMidLight = makeLightStub();
  const tunnelMoonLight = makeLightStub();
  const tunnelFillLight = makeLightStub();

  // ==========================================================================
  // GROUP C: `exteriorGroup` — Act 5 & Free-Roam Gameplay: «Берег Пепельного Стока»
  // ==========================================================================
  const extRng = makeRng(90926);

  // Shared canonical Moon direction (frames huge luminous cratered full moon upper-left right in normal gameplay view!)
  const MOON_DIR_X =  0.315;
  const MOON_DIR_Y =  0.250;
  const MOON_DIR_Z =  0.916;

  // --------------------------------------------------------------------------
  // C1. Nocturnal Gothic Sky Dome + Giant Cratered Moon + 3-Layer Halo + Stars + Night Clouds
  // --------------------------------------------------------------------------
  const extSkyUniforms = {
    uTime: { value: 0.0 },
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 }
  };
  const extSkyMat = trackMat(createGorgeSkyMaterial(THREE, extSkyUniforms.uTime, lowSpecMode));
  if (extSkyMat.uniforms?.uFogColor?.value) {
    extSkyMat.uniforms.uFogColor.value.setHex(0x1a2a40);
  }
  const extSkyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(430, 32, 20)), extSkyMat);
  extSkyDome.position.set(0, -6, 0);
  extSkyDome.renderOrder = -20;
  exteriorGroup.add(extSkyDome);

  // --------------------------------------------------------------------------
  // C2. MONUMENTAL GOTHIC CATHEDRAL-CITADEL: CASTLE OF ASH on Sheer Basalt Precipice (z = -56m)
  //     - Multi-tiered sculpted basalt cliff promontory w/ 3D rock ribs & cliff buttresses
  //     - Wide crenellated curtain wall w/ recessed arcades, machicolations, corner bastions & 2 flanking towers
  //     - Central Gothic Throne Cathedral: stepped nave/aisles, PIERCED FLYING BUTTRESSES, twin needle spires,
  //       soaring central crossing spire w/ gothic iron weathervane, REAL 3D POINTED ARCH WINDOWS w/ stone
  //       mullion tracery & spoked ROSE WINDOW, pulsing crimson-gold glass + AdditiveBlending volumetric glow halo!
  //     - 3 depth-layered drifting nocturnal cloud veils at the foot of the cliff so the Castle FLOATS in clouds!
  // --------------------------------------------------------------------------
  function buildCastleOfAshVista() {
    const castleParts = [];
    const windowParts = [];
    const haloSpecs = [];

    const addBox = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, topC = 0x4c5874, botC = 0x191e2c) => {
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), topC, botC));
    };
    const addCyl = (rt, rb, h, segs, x, y, z, rx = 0, ry = 0, rz = 0, topC = 0x4e5b78, botC = 0x1b2030) => {
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(rt, rb, h, segs), x, y, z, rx, ry, rz), topC, botC));
    };
    const addSpire = (r, h, segs, x, y, z, ry = Math.PI / 4, topC = 0x5c6c90, botC = 0x242c40) => {
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.ConeGeometry(r, h, segs), x, y, z, 0, ry, 0), topC, botC));
    };
    // Gothic Spire + Slender Finial Cross / Weathervane
    const addGothicFinial = (x, yBase, z, height = 3.2, withVane = true) => {
      addCyl(0.06, 0.14, height, 6, x, yBase + height * 0.5, z, 0, 0, 0, 0x7284ab, 0x3b465e);
      addBox(height * 0.34, 0.12, 0.12, x, yBase + height * 0.72, z, 0, 0, 0, 0x7a8db5, 0x424e68);
      if (withVane) {
        addBox(height * 0.42, 0.32, 0.08, x + height * 0.18, yBase + height * 0.84, z, 0, 0, 0, 0x7e92bc, 0x485672);
      }
    };

    // Real 3D Pointed Gothic Arched Window with recessed stone hood, vertical stone mullion & pointed tracery bars!
    const addGothicLancetWindow = (w, h, x, y, z, { hasMullion = true, addHalo = true, haloScale = 1.0 } = {}) => {
      const archH = w * 0.72;
      const bodyH = Math.max(0.8, h - archH);
      const yBot = y - h * 0.5;
      const ySpring = yBot + bodyH;
      // Glowing glass shape behind stone tracery: lower rectangle + sharp gothic pointed arch triangle
      const glassShape = new THREE.Shape();
      glassShape.moveTo(-w * 0.5, -h * 0.5);
      glassShape.lineTo( w * 0.5, -h * 0.5);
      glassShape.lineTo( w * 0.5, -h * 0.5 + bodyH);
      glassShape.quadraticCurveTo(w * 0.42, -h * 0.5 + bodyH + archH * 0.62, 0.0, h * 0.5);
      glassShape.quadraticCurveTo(-w * 0.42, -h * 0.5 + bodyH + archH * 0.62, -w * 0.5, -h * 0.5 + bodyH);
      glassShape.closePath();
      const glassGeo = new THREE.ShapeGeometry(glassShape, 8);
      // Normalize glass UV so v = 0 at sill, v = 1 at pointed apex (for rich stained-glass vertical gradient!)
      const gPos = glassGeo.attributes.position;
      const gUv = new Float32Array(gPos.count * 2);
      for (let i = 0; i < gPos.count; i++) {
        gUv[i * 2]     = clamp01((gPos.getX(i) / Math.max(0.1, w)) + 0.5);
        gUv[i * 2 + 1] = clamp01((gPos.getY(i) / Math.max(0.1, h)) + 0.5);
      }
      glassGeo.setAttribute('uv', new THREE.BufferAttribute(gUv, 2));
      xformGeo(glassGeo, x, y, z);
      windowParts.push(glassGeo);

      // Deep 3D stone surround jambs, sloped sill & pointed gothic hood molding protruding in front of glass!
      const frameZ = z + 0.24;
      const jw = Math.max(0.18, w * 0.14);
      addBox(jw, bodyH + 0.2, 0.56, x - w * 0.52, yBot + bodyH * 0.5, frameZ, 0, 0, 0, 0x5c6a8a, 0x262d3f);
      addBox(jw, bodyH + 0.2, 0.56, x + w * 0.52, yBot + bodyH * 0.5, frameZ, 0, 0, 0, 0x5c6a8a, 0x262d3f);
      addBox(w + jw * 2.4, 0.26, 0.68, x, yBot - 0.12, frameZ + 0.06, 0, 0, 0, 0x677698, 0x2d3549);
      // Pointed arch hood stone legs converging at apex
      const legLen = Math.hypot(w * 0.55, archH) + 0.18;
      const legAng = Math.atan2(archH, w * 0.55);
      addBox(legLen, jw * 1.15, 0.58, x - w * 0.26, ySpring + archH * 0.52, frameZ + 0.04, 0, 0,  legAng, 0x68789a, 0x2d364a);
      addBox(legLen, jw * 1.15, 0.58, x + w * 0.26, ySpring + archH * 0.52, frameZ + 0.04, 0, 0, -legAng, 0x68789a, 0x2d364a);

      // Authentic Gothic Stone Tracery Mullions IN FRONT of the warm glowing glass (breaks up flat rectangles!)
      if (hasMullion) {
        const mw = Math.max(0.11, w * 0.075);
        // Central vertical stone mullion + 2 horizontal transoms + upper Y-tracery fork!
        addBox(mw, h * 0.88, 0.28, x, y - h * 0.04, z + 0.16, 0, 0, 0, 0x3b4459, 0x1b202e);
        addBox(w * 0.96, mw * 1.05, 0.26, x, yBot + bodyH * 0.48, z + 0.16, 0, 0, 0, 0x3b4459, 0x1b202e);
        addBox(w * 0.96, mw * 1.05, 0.26, x, ySpring - 0.08, z + 0.16, 0, 0, 0, 0x424d66, 0x1e2433);
        // Upper tracery diagonal Y-bars & small lancet oculus ring
        const forkLen = w * 0.48;
        addBox(forkLen, mw * 0.95, 0.24, x - w * 0.18, ySpring + archH * 0.28, z + 0.16, 0, 0, -0.78, 0x424d66, 0x1e2433);
        addBox(forkLen, mw * 0.95, 0.24, x + w * 0.18, ySpring + archH * 0.28, z + 0.16, 0, 0,  0.78, 0x424d66, 0x1e2433);
      }

      if (addHalo) {
        haloSpecs.push({ x, y: y + 0.1, z: z + 0.55, sx: w * 2.9 * haloScale, sy: h * 1.75 * haloScale });
      }
    };

    // Real 3D Spoked Gothic Rose Window (stone outer ring + 8 radial tracery spokes + center wheel IN FRONT of glass!)
    const addGothicRoseWindow = (radius, x, y, z) => {
      const glassGeo = new THREE.CircleGeometry(radius, 20);
      const gp = glassGeo.attributes.position;
      const guv = new Float32Array(gp.count * 2);
      for (let i = 0; i < gp.count; i++) {
        guv[i * 2]     = clamp01(gp.getX(i) / (radius * 2) + 0.5);
        guv[i * 2 + 1] = clamp01(gp.getY(i) / (radius * 2) + 0.5);
      }
      glassGeo.setAttribute('uv', new THREE.BufferAttribute(guv, 2));
      xformGeo(glassGeo, x, y, z);
      windowParts.push(glassGeo);

      // Deep carved stone rose wheel surround + inner wheel + 8 stone radial mullions!
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.TorusGeometry(radius * 1.04, radius * 0.16, 7, 20), x, y, z + 0.22), 0x677799, 0x283042));
      castleParts.push(tintGeo(THREE, xformGeo(new THREE.TorusGeometry(radius * 0.52, radius * 0.08, 6, 16), x, y, z + 0.20), 0x4e5b78, 0x222838));
      addCyl(radius * 0.18, radius * 0.18, 0.30, 8, x, y, z + 0.20, Math.PI * 0.5, 0, 0, 0x5c6a8a, 0x262d3f);
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        addBox(radius * 2.02, radius * 0.09, 0.26, x, y, z + 0.18, 0, 0, a, 0x45516a, 0x1e2433);
      }
      haloSpecs.push({ x, y, z: z + 0.65, sx: radius * 5.6, sy: radius * 5.6 });
    };

    const cz = -56.0;
    const baseY = 16.2; // Elevated cleanly above swirling cliff-base cloud belt while soaring 45m spire fits inside vista!

    // 1. MULTI-TIERED SHEER BASALT PROMONTORY CLIFF (y = -8 .. +18m) w/ Craggy 3D Displaced Rock Ribs & Stone Buttresses!
    const cliffDetail = isMobile ? 2 : 3;
    const cragSpecs = [
      { x:   0.0, y:  0.0, z: cz + 3.2, rx: 16.5, ry: 22.0, rz: 12.0, seed: 701, flatTop: true },
      { x: -15.5, y: -1.5, z: cz + 5.8, rx: 14.5, ry: 20.5, rz: 11.5, seed: 702, flatTop: true },
      { x:  16.0, y: -1.2, z: cz + 5.5, rx: 14.8, ry: 21.0, rz: 11.5, seed: 703, flatTop: true },
      { x: -29.0, y: -3.0, z: cz + 10.5, rx: 16.0, ry: 18.5, rz: 12.5, seed: 704, flatTop: false },
      { x:  30.0, y: -2.5, z: cz + 10.0, rx: 16.5, ry: 19.0, rz: 12.5, seed: 705, flatTop: false },
      { x:  -8.2, y:  5.5, z: cz + 5.2, rx:  8.4, ry: 13.5, rz:  7.8, seed: 706, flatTop: true },
      { x:   8.6, y:  5.8, z: cz + 5.0, rx:  8.6, ry: 13.8, rz:  7.8, seed: 707, flatTop: true },
      { x:   0.0, y:  6.2, z: cz + 5.6, rx:  9.5, ry: 12.8, rz:  7.2, seed: 708, flatTop: true }
    ];
    for (let i = 0; i < cragSpecs.length; i++) {
      const cs = cragSpecs[i];
      const g = buildCraggyCliffMassGeo(THREE, cs.rx, cs.ry, cs.rz, cs.seed, cliffDetail, {
        flatTop: cs.flatTop,
        topHex: 0x3b465e,
        midHex: 0x202736,
        botHex: 0x0b0e16,
        noMoss: true
      });
      xformGeo(g, cs.x, cs.y, cs.z);
      castleParts.push(g);
    }

    // Deep battered stone retaining cliff-buttresses gripping the precipice face below the fortress
    for (const bx of [-18.5, -12.4, -6.2, 0.0, 6.2, 12.4, 18.5]) {
      addBox(2.2, 15.5, 4.2, bx, baseY - 2.6, cz + 6.4, 0.14, 0, 0, 0x3e4860, 0x131722);
      addBox(2.6, 1.1, 4.8, bx, baseY + 4.8, cz + 6.0, 0, 0, 0, 0x52607d, 0x252c3e);
    }

    // 2. WIDE FORTIFIED CURTAIN WALL, MACHICOLATED BATTLEMENTS, CORNER BASTIONS & FLANKING TOWERS (y = 14..38m)
    addBox(42.0, 8.2, 6.2, 0, baseY + 3.6, cz + 3.4, 0, 0, 0, 0x424d66, 0x181d2b);
    // Projecting stone cornice & machicolation corbel belt along the entire curtain wall
    addBox(43.2, 0.78, 6.9, 0, baseY + 7.75, cz + 3.6, 0, 0, 0, 0x576686, 0x293145);
    for (let mx = -20.0; mx <= 20.0; mx += 2.2) {
      // Crenellated merlons + corbel brackets underneath
      addBox(1.25, 1.65, 1.35, mx, baseY + 8.85, cz + 6.45, 0, 0, 0, 0x586788, 0x2a3246);
      addBox(0.55, 0.85, 0.85, mx, baseY + 7.15, cz + 6.75, 0, 0, 0, 0x4e5c7a, 0x222838);
    }
    // Recessed curtain-wall blind gothic arcade pilasters
    for (let px = -14.0; px <= 14.0; px += 3.5) {
      addBox(0.95, 6.8, 0.85, px, baseY + 3.6, cz + 6.55, 0, 0, 0, 0x4c5875, 0x1e2434);
    }
    // Central Lower Barbican Gatehouse & Crimson Gate Slit
    addBox(6.8, 9.6, 4.6, 0, baseY + 4.2, cz + 5.6, 0, 0, 0, 0x4a5672, 0x1c2231);
    for (const sx of [-2.8, 2.8]) {
      addCyl(1.05, 1.25, 11.4, 8, sx, baseY + 5.2, cz + 7.4, 0, 0, 0, 0x556484, 0x212737);
      addSpire(1.25, 3.8, 8, sx, baseY + 12.6, cz + 7.4, 0, 0x627396, 0x2a3348);
    }
    addGothicLancetWindow(1.15, 2.8, 0.0, baseY + 4.4, cz + 7.95, { hasMullion: true, addHalo: true, haloScale: 0.75 });

    // 2 Tall Polygonal Flanking Citadel Bastion Towers (x = ±15.8m) + 2 Outer Rampart Watchtowers (x = ±24.2m)!
    const citadelTowers = [
      { x: -15.8, z: cz + 3.0, r: 3.1, h: 16.5, spireH: 10.2, broken: false, vane: true,  winY: 12.5 },
      { x:  16.2, z: cz + 2.8, r: 3.2, h: 17.6, spireH: 11.0, broken: false, vane: true,  winY: 13.4 },
      { x: -24.2, z: cz + 5.8, r: 2.6, h: 12.2, spireH:  6.4, broken: true,  vane: false, winY:  9.0 },
      { x:  24.6, z: cz + 5.5, r: 2.7, h: 13.4, spireH:  7.8, broken: false, vane: true,  winY:  9.8 },
      { x: -10.8, z: cz - 6.8, r: 2.5, h: 20.5, spireH:  9.5, broken: false, vane: false, winY:  0.0 },
      { x:  11.2, z: cz - 7.0, r: 2.6, h: 21.8, spireH: 10.6, broken: false, vane: false, winY:  0.0 }
    ];
    for (let i = 0; i < citadelTowers.length; i++) {
      const tw = citadelTowers[i];
      // Octagonal gothic stone tower drum + stepped plinth + corbelled gallery collar
      addCyl(tw.r * 0.94, tw.r * 1.12, tw.h, 8, tw.x, baseY + tw.h * 0.5 + 1.0, tw.z, 0, Math.PI / 8, 0, 0x4b5875, 0x1a1f2e);
      addCyl(tw.r * 1.16, tw.r * 0.96, 1.35, 8, tw.x, baseY + tw.h + 1.1, tw.z, 0, Math.PI / 8, 0, 0x5c6c8e, 0x2b3348);
      // Corner turret pinnacle ring
      for (let k = 0; k < 4; k++) {
        const pa = (k / 4) * Math.PI * 2 + Math.PI / 4;
        const px = tw.x + Math.cos(pa) * tw.r * 0.98;
        const pz = tw.z + Math.sin(pa) * tw.r * 0.98;
        addBox(0.68, 2.2, 0.68, px, baseY + tw.h + 2.5, pz, 0, 0, 0, 0x5e6e92, 0x2e374d);
        addSpire(0.46, 2.4, 4, px, baseY + tw.h + 4.7, pz, Math.PI / 4, 0x6c7ea6, 0x353f58);
      }
      if (!tw.broken) {
        const spireBaseY = baseY + tw.h + 1.75;
        addSpire(tw.r * 1.06, tw.spireH, 8, tw.x, spireBaseY + tw.spireH * 0.5, tw.z, Math.PI / 8, 0x607094, 0x262e42);
        if (tw.vane) {
          addGothicFinial(tw.x, spireBaseY + tw.spireH - 0.2, tw.z, 3.0, true);
        }
      } else {
        // Battle-shattered jagged tower crown
        addBox(1.5, 3.0, 1.6, tw.x - 1.1, baseY + tw.h + 2.8, tw.z, 0, 0, 0.14, 0x586684, 0x262d3e);
        addBox(1.3, 1.9, 1.5, tw.x + 1.2, baseY + tw.h + 2.3, tw.z + 0.5, 0, 0, -0.10, 0x52607c, 0x232939);
      }
      if (tw.winY > 0) {
        addGothicLancetWindow(0.86, 3.1, tw.x, baseY + tw.winY, tw.z + tw.r * 1.04, {
          hasMullion: true,
          addHalo: true,
          haloScale: 0.72
        });
      }
    }

    // 3. GRAND CENTRAL GOTHIC CATHEDRAL OF THE THRONE HALL (y = 18 .. 44.5m — Monumental Sculpted Facade!)
    // Lower wider side-aisles + taller stepped central nave clerestory (true Gothic Cathedral silhouette!)
    addBox(16.8, 10.5, 11.5, 0, baseY + 10.8, cz - 0.6, 0, 0, 0, 0x45516b, 0x1c2231);
    addBox(11.6, 15.8, 12.2, 0, baseY + 14.5, cz - 0.8, 0, 0, 0, 0x4d5a78, 0x202636);

    // Steep Gothic Triangular Cathedral West-Facade Gable & Pitched Roof above the Nave!
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-6.2, 0);
    gableShape.lineTo( 6.2, 0);
    gableShape.lineTo( 0.0, 6.8);
    gableShape.closePath();
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 12.6, bevelEnabled: false });
    xformGeo(gableGeo, 0, baseY + 22.3, cz - 7.1);
    castleParts.push(tintGeo(THREE, gableGeo, 0x5f7094, 0x2b3348));
    // Sculpted stepped stone gable coping & peak cross
    for (let step = 0; step < 5; step++) {
      const f = step / 4;
      const gx = lerp(5.6, 0.7, f);
      const gy = baseY + 22.6 + f * 5.8;
      addBox(0.75, 1.35, 1.1, -gx, gy, cz + 5.2, 0, 0, 0, 0x6a7ca4, 0x333c54);
      addBox(0.75, 1.35, 1.1,  gx, gy, cz + 5.2, 0, 0, 0, 0x6a7ca4, 0x333c54);
    }

    // Soaring Central Crossing Bell-Tower & Needle Spire crowning the Cathedral at y = 44.5m!
    addCyl(2.55, 3.05, 7.2, 8, 0, baseY + 25.8, cz - 1.5, 0, Math.PI / 8, 0, 0x566586, 0x242c3f);
    addCyl(3.15, 2.65, 0.95, 8, 0, baseY + 29.4, cz - 1.5, 0, Math.PI / 8, 0, 0x6779a0, 0x303a52);
    // Crossing tower turret pinnacle finials
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      addSpire(0.55, 3.8, 4, Math.cos(a) * 2.75, baseY + 31.6, cz - 1.5 + Math.sin(a) * 2.75, Math.PI / 4, 0x6e81aa, 0x36415a);
    }
    addSpire(2.85, 11.4, 8, 0, baseY + 35.3, cz - 1.5, Math.PI / 8, 0x6a7ca4, 0x2b344a);
    addGothicFinial(0, baseY + 40.8, cz - 1.5, 3.8, true);

    // Twin Slender Gothic Bell-Spires flanking the Cathedral Front Facade (x = ±6.1m) w/ belfry arches & finials!
    for (const side of [-1, 1]) {
      const tx = side * 6.1;
      const tz = cz + 3.7;
      addBox(2.9, 18.2, 3.2, tx, baseY + 13.8, tz, 0, 0, 0, 0x505e7c, 0x1e2434);
      // Vertical gothic buttress ribs running up each tower corner
      addBox(0.55, 18.8, 0.72, tx - 1.35, baseY + 14.0, tz + 1.55, 0, 0, 0, 0x5c6c8e, 0x252c3e);
      addBox(0.55, 18.8, 0.72, tx + 1.35, baseY + 14.0, tz + 1.55, 0, 0, 0, 0x5c6c8e, 0x252c3e);
      // Open belfry lantern stage (4 corner stone piers creating real openwork silhouette!)
      const belfryY = baseY + 23.0;
      addBox(3.35, 0.72, 3.65, tx, belfryY, tz, 0, 0, 0, 0x627398, 0x2c354a);
      for (const ox of [-1.05, 1.05]) {
        for (const oz of [-1.05, 1.05]) {
          addBox(0.58, 3.2, 0.58, tx + ox, belfryY + 1.9, tz + oz, 0, 0, 0, 0x617296, 0x2d364c);
        }
      }
      addBox(3.15, 0.65, 3.35, tx, belfryY + 3.6, tz, 0, 0, 0, 0x687aa0, 0x313a52);
      addSpire(2.05, 9.4, 4, tx, belfryY + 8.5, tz, Math.PI / 4, 0x687aa2, 0x2b3348);
      addGothicFinial(tx, belfryY + 13.0, tz, 2.8, true);
      // Tall slender lancet slit on twin cathedral facade towers
      addGothicLancetWindow(0.76, 3.2, tx, baseY + 16.4, tz + 1.66, { hasMullion: true, addHalo: true, haloScale: 0.75 });
    }

    // 4. REAL 3D PIERCED FLYING BUTTRESSES (АРКБУТАНЫ) bridging the Cathedral Nave to Outer Pinnacle Piers!
    for (const side of [-1, 1]) {
      // Outer stepped buttress pier standing independently outside the aisle (x = ±11.2m) w/ gothic pinnacle!
      const pierX = side * 11.2;
      addBox(2.2, 14.8, 2.6, pierX, baseY + 11.8, cz + 1.6, 0, 0, 0, 0x4f5d7c, 0x1d2332);
      addBox(2.55, 0.65, 2.95, pierX, baseY + 19.3, cz + 1.6, 0, 0, 0, 0x617296, 0x2e374c);
      addSpire(1.15, 5.2, 4, pierX, baseY + 22.1, cz + 1.6, Math.PI / 4, 0x6b7ea6, 0x333d56);
      addGothicFinial(pierX, baseY + 24.5, cz + 1.6, 1.8, false);

      // Upper & Lower Pierced Diagonal Flying Buttress Arches (open night sky shines right THROUGH them!)
      for (let tier = 0; tier < 2; tier++) {
        const yOuter = baseY + (tier === 0 ? 13.4 : 18.0);
        const yInner = baseY + (tier === 0 ? 16.4 : 21.4);
        const midX = side * 8.65;
        const midY = (yOuter + yInner) * 0.5;
        const dx = 4.9;
        const dy = yInner - yOuter;
        const flyerLen = Math.hypot(dx, dy) + 0.5;
        const flyerAng = -side * Math.atan2(dy, dx);
        addBox(flyerLen, 1.05, 1.15, midX, midY, cz + 1.6, 0, 0, flyerAng, 0x5c6c8e, 0x272f42);
        // Sculpted curved under-rib support strut beneath each flying arch
        addBox(flyerLen * 0.86, 0.48, 0.82, midX, midY - 0.72, cz + 1.6, 0, 0, flyerAng * 1.15, 0x4c5976, 0x202738);
      }

      // Outer Viaduct Archway linking Curtain Wall Bastion to Outer Watchtower (x = ±20.0m)
      addBox(5.6, 1.45, 1.65, side * 20.0, baseY + 10.6, cz + 4.4, 0, 0, -side * 0.14, 0x495672, 0x1e2434);
      addBox(1.1, 4.4, 1.5, side * 20.0, baseY + 8.0, cz + 4.4, 0, 0, 0, 0x434f69, 0x1a1f2e);
    }

    // 5. CATHEDRAL THRONE HALL FRONT FACADE: 3 POINTED TRACERY LANCETS + SPOKED GOTHIC ROSE WINDOW!
    const facadeZ = cz + 5.38;
    // Vertical stone nave buttress shafts dividing the 3 great Throne Hall windows
    for (const bx of [-4.65, -1.75, 1.75, 4.65]) {
      addBox(0.68, 12.8, 0.92, bx, baseY + 15.2, facadeZ + 0.18, 0, 0, 0, 0x58688a, 0x22293a);
      addSpire(0.42, 2.2, 4, bx, baseY + 22.6, facadeZ + 0.18, Math.PI / 4, 0x6779a0, 0x303950);
    }
    // Three Tall Pointed Gothic Windows with real 3D Stone Mullions & Y-Tracery!
    addGothicLancetWindow(1.75, 5.4, -3.20, baseY + 14.3, facadeZ, { hasMullion: true, addHalo: true, haloScale: 1.05 });
    addGothicLancetWindow(2.15, 6.8,  0.00, baseY + 14.8, facadeZ, { hasMullion: true, addHalo: true, haloScale: 1.25 });
    addGothicLancetWindow(1.75, 5.4,  3.20, baseY + 14.3, facadeZ, { hasMullion: true, addHalo: true, haloScale: 1.05 });
    // Great Spoked Gothic Rose Window crowning the Throne Hall facade!
    addGothicRoseWindow(1.72, 0.0, baseY + 20.5, facadeZ + 0.04);

    // Build merged AdditiveBlending volumetric halo planes behind/over the Cathedral glowing windows!
    const haloParts = [];
    for (let i = 0; i < haloSpecs.length; i++) {
      const hs = haloSpecs[i];
      const p = new THREE.PlaneGeometry(hs.sx, hs.sy);
      xformGeo(p, hs.x, hs.y, hs.z);
      haloParts.push(p);
    }
    // Broad master Throne Hall atmospheric crimson-amber radiance halo
    haloParts.push(xformGeo(new THREE.PlaneGeometry(18.5, 15.5), 0.0, baseY + 16.8, facadeZ + 1.1));

    const castleGeo = trackGeo(mergeNonIndexedGeos(THREE, castleParts, { boxUvTile: 5.5, withColor: true }));
    const windowsGeo = trackGeo(mergeNonIndexedGeos(THREE, windowParts, { boxUvTile: 0, withColor: false }));
    const halosGeo = trackGeo(mergeNonIndexedGeos(THREE, haloParts, { boxUvTile: 0, withColor: false }));
    return { castleGeo, windowsGeo, halosGeo };
  }

  const castleVista = buildCastleOfAshVista();

  // Custom Nocturnal Moon-Rimmed Gothic Cathedral Silhouette Shader (`fog: false` -> ALWAYS razor-crisp!)
  const castleSilhouetteMat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: extSkyUniforms.uTime
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;
      void main() {
        vCol = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec3 vCol;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 moonL = normalize(vec3(-0.27, 0.43, -0.861));
        vec3 frontKey = normalize(vec3(-0.34, 0.56, 0.76));

        // Brooding dark obsidian-charcoal Gothic ashlar masonry (authentic Castle of Ash — ZERO pastel pink!)
        float row = floor(vWorldPos.y * 0.78);
        float colCell = floor((vWorldPos.x + vWorldPos.z * 0.5) * 0.58 + mod(row, 2.0) * 0.5);
        float blkShade = 0.74 + 0.42 * hash21(vec2(colCell, row));
        float hMortar = 1.0 - smoothstep(0.03, 0.11, abs(fract(vWorldPos.y * 0.78) - 0.5));
        float streak = 0.84 + 0.16 * sin(vWorldPos.x * 1.9 + vWorldPos.z * 0.7);
        vec3 base = vCol * blkShade * (1.0 - hMortar * 0.30) * streak * 0.22;

        // Razor-sharp cold silvery-blue moonlight rim tracing every spire, flying buttress, pinnacle & battlement!
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.1);
        float moonSide = max(0.0, dot(N, moonL) * 0.5 + 0.5);
        float topCatch = max(0.0, N.y) * 0.38 + max(0.0, dot(N, frontKey)) * 0.44;
        vec3 lit = base * (0.40 + topCatch * 0.88);
        lit += vec3(0.16, 0.25, 0.42) * fres * (0.40 + 0.85 * moonSide) * smoothstep(10.0, 38.0, vWorldPos.y);
        float leftMoonEdge = max(0.0, dot(N, normalize(vec3(-0.84, 0.42, 0.34)))) * smoothstep(15.0, 42.0, vWorldPos.y);
        lit += vec3(0.13, 0.21, 0.36) * leftMoonEdge * 0.72;

        // Tight localized deep blood-crimson & amber firelight bounce ONLY directly around the Throne Hall windows!
        float throneDist = length(vWorldPos - vec3(0.0, 31.8, -50.4));
        float flick = 0.86 + 0.14 * sin(uTime * 4.8) + 0.05 * sin(uTime * 11.2);
        float throneGlow = exp(-throneDist * 0.23) * flick;
        lit += vec3(0.46, 0.10, 0.022) * throneGlow * (0.50 + 0.50 * max(0.0, N.z + 0.20));

        // Swirling nocturnal cloud-valley mist hugging ONLY the lower cliff base (y < 20m) so Castle floats in clouds!
        float baseMist = (1.0 - smoothstep(6.0, 23.0, vWorldPos.y)) * 0.64;
        vec3 mistCol = vec3(0.068, 0.098, 0.162);
        lit = mix(lit, mistCol, baseMist);

        gl_FragColor = vec4(lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.FrontSide,
    fog: false
  }));
  const castleVistaMesh = new THREE.Mesh(castleVista.castleGeo, castleSilhouetteMat);
  castleVistaMesh.frustumCulled = false;
  exteriorGroup.add(castleVistaMesh);

  // Glowing Stained-Glass Crimson-Gold Throne Hall Windows (rich gradient hearth fire behind 3D stone tracery!)
  const castleWindowsMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        float fl = 0.84 + 0.16 * sin(uTime * 5.0 + vWorldPos.x * 0.85) + 0.08 * sin(uTime * 11.3 + vWorldPos.y * 0.6);
        // Subtle leaded stained-glass diamond grid + warm golden-ember hearth gradient (hotter near base/center!)
        float leadX = abs(fract(vUv.x * 6.0) - 0.5);
        float leadY = abs(fract(vUv.y * 10.0) - 0.5);
        float lead = smoothstep(0.03, 0.09, min(leadX, leadY));
        float centerHot = 1.0 - clamp(length((vUv - vec2(0.5, 0.36)) * vec2(1.4, 1.15)), 0.0, 1.0);
        vec3 deepCrimson = vec3(0.95, 0.10, 0.025);
        vec3 moltenAmber = vec3(2.05, 0.62, 0.12);
        vec3 hearthGold  = vec3(2.55, 1.45, 0.42);
        vec3 col = mix(deepCrimson, moltenAmber, smoothstep(0.05, 0.65, centerHot));
        col = mix(col, hearthGold, smoothstep(0.58, 0.96, centerHot) * fl);
        col *= (0.72 + 0.28 * lead) * fl;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: false
  }));
  const castleWindowsMesh = new THREE.Mesh(castleVista.windowsGeo, castleWindowsMat);
  castleWindowsMesh.frustumCulled = false;
  exteriorGroup.add(castleWindowsMesh);

  // Soft Volumetric AdditiveBlending Crimson-Gold Glow Halo around the Cathedral Windows!
  const castleGlowHaloMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        float g = exp(-r2 * 4.2) * (1.0 - smoothstep(0.55, 1.0, r2));
        float fl = 0.86 + 0.14 * sin(uTime * 4.6 + vWorldPos.x * 0.5);
        vec3 col = mix(vec3(0.95, 0.14, 0.03), vec3(1.55, 0.68, 0.16), smoothstep(0.55, 0.0, r2));
        float a = g * 0.22 * fl;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false
  }));
  const castleGlowHaloMesh = new THREE.Mesh(castleVista.halosGeo, castleGlowHaloMat);
  castleGlowHaloMesh.renderOrder = 2;
  castleGlowHaloMesh.frustumCulled = false;
  exteriorGroup.add(castleGlowHaloMesh);

  // 3 Depth-Staggered Drifting Night Cloud Veil Banks at the Foot of the Castle Cliff (Castle FLOATS above clouds!)
  const cliffCloudMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        float drift = uTime * (0.018 + abs(vWorldPos.z + 40.0) * 0.0005);
        vec2 uv1 = vec2(vUv.x * 4.2 + drift, vUv.y * 2.2);
        vec2 uv2 = vec2(vUv.x * 8.6 - drift * 0.65, vUv.y * 4.4 + 1.3);
        float n = vnoise(uv1) * 0.62 + vnoise(uv2) * 0.38;
        float edgeX = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);
        float edgeY = smoothstep(0.0, 0.24, vUv.y) * (1.0 - smoothstep(0.50, 1.0, vUv.y));
        float density = smoothstep(0.28, 0.74, n) * edgeX * edgeY;
        if (density < 0.01) discard;
        // Subtle brooding twilight mountain mist hugging the crag (NEVER a flat solid grey cut!)
        float moonSide = smoothstep(0.95, 0.10, vUv.x);
        vec3 shadowCol = vec3(0.035, 0.055, 0.098);
        vec3 silverRim = vec3(0.24, 0.35, 0.54);
        vec3 col = mix(shadowCol, silverRim, clamp(vUv.y * 0.78 + moonSide * 0.32 * n, 0.0, 1.0));
        gl_FragColor = vec4(col, density * 0.36);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  }));
  const cliffCloudSpecs = [
    { x:  0.0, y: 12.6, z: -29.0, w: 68, h:  9.5 },
    { x: -4.0, y: 15.8, z: -39.0, w: 84, h: 12.0 },
    { x:  5.0, y: 18.6, z: -48.5, w: 96, h: 13.5 }
  ];
  const cliffCloudMeshes = [];
  for (let i = 0; i < cliffCloudSpecs.length; i++) {
    const cs = cliffCloudSpecs[i];
    const cm = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(cs.w, cs.h)), cliffCloudMat);
    cm.position.set(cs.x, cs.y, cs.z);
    cm.renderOrder = 1;
    cm.frustumCulled = false;
    exteriorGroup.add(cm);
    cliffCloudMeshes.push(cm);
  }

  // Rising Column of Volcanic Ash, Dark Smoke & Faint Embers billowing from the Castle of Ash Spires!
  const CASTLE_PLUME_COUNT = isMobile ? 28 : 54;
  const plumePos = new Float32Array(CASTLE_PLUME_COUNT * 3);
  const plumeSeed = new Float32Array(CASTLE_PLUME_COUNT * 3);
  for (let i = 0; i < CASTLE_PLUME_COUNT; i++) {
    plumePos[i * 3]     = (extRng() - 0.5) * 14.0;
    plumePos[i * 3 + 1] = 30.0 + extRng() * 24.0;
    plumePos[i * 3 + 2] = -55.5 + (extRng() - 0.5) * 6.0;
    plumeSeed[i * 3]     = extRng();
    plumeSeed[i * 3 + 1] = 0.55 + extRng() * 0.75;
    plumeSeed[i * 3 + 2] = 0.75 + extRng() * 1.45;
  }
  const castlePlumeGeo = trackGeo(new THREE.BufferGeometry());
  castlePlumeGeo.setAttribute('position', new THREE.BufferAttribute(plumePos, 3));
  castlePlumeGeo.setAttribute('aSeed', new THREE.BufferAttribute(plumeSeed, 3));
  const castlePlumeMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vHeight;
      varying float vEmber;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.036 * aSeed.y);
        vec3 p = position;
        p.y = 29.0 + cyc * 28.0;
        p.x += cyc * 14.5 + sin(uTime * 0.35 + aSeed.x * 12.0) * 2.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float isEmber = step(0.84, aSeed.x);
        float baseSz = mix((1.2 + cyc * 2.1) * aSeed.z * 740.0, 145.0, isEmber);
        gl_PointSize = clamp(baseSz / max(8.0, -mv.z), mix(16.0, 2.5, isEmber), mix(165.0, 9.0, isEmber));
        vAlpha = sin(cyc * 3.14159) * mix(0.32, 0.90, isEmber);
        vHeight = cyc;
        vEmber = isEmber;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vHeight;
      varying float vEmber;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 smokeCol = mix(vec3(0.32, 0.11, 0.07), vec3(0.14, 0.19, 0.29), smoothstep(0.0, 0.55, vHeight));
        vec3 emberCol = vec3(1.85, 0.65, 0.18);
        vec3 col = mix(smokeCol, emberCol, vEmber);
        float a = t.a * vAlpha;
        if (a < 0.008) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false
  }));
  const castlePlumePoints = new THREE.Points(castlePlumeGeo, castlePlumeMat);
  castlePlumePoints.frustumCulled = false;
  exteriorGroup.add(castlePlumePoints);

  // --------------------------------------------------------------------------
  // C3. Studio 1024px Wet Cobblestone / Moss / Cliff Terrain Mesh w/ Puddle Mirror Reflections!
  //     (100% synced with `evalBaseTerrainY` & seamless transition from Zone 0 -> Zones 1–3!)
  // --------------------------------------------------------------------------
  const gorgePbrTex = createGorgePbrTextures(THREE, { anisotropy, trackTex });
  const shoreTerrainMat = createStylizedGorgeTerrainMaterial(THREE, gorgePbrTex, {
    uTimeUniform: extSkyUniforms.uTime,
    lowSpecMode,
    envMapIntensity: 0.56,
    trackMat,
    regNormalMat
  });

  function buildShoreTerrainGeo() {
    const segX = isMobile ? 64 : 112;
    const segZ = isMobile ? 128 : 224;
    const minX = -28.0, maxX = 40.0;
    const minZ = -18.0, maxZ = 144.0;
    const geo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, segX, segZ);
    geo.rotateX(-Math.PI * 0.5);
    geo.translate((minX + maxX) * 0.5, 0, (minZ + maxZ) * 0.5);

    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const cols = new Float32Array(pos.count * 3);
    const mixAttr = new Float32Array(pos.count * 4);
    const cDry = new THREE.Color(0x6e7b91);
    const cWet = new THREE.Color(0x2c3648);
    const cPath = new THREE.Color(0x9aa8bf);
    const cMoss = new THREE.Color(0x5d785e);
    const cCliff = new THREE.Color(0x4b586e);
    const cWarmFire = new THREE.Color(0xffaa52);
    const cTmp = new THREE.Color();

    // Zero-PointLight Baked Warm Firelight Radiance Pools (Shore + Extended Gorge Road Camps & Lanterns!)
    const bakedWarmPools = [
      { x:  2.80, z:  5.20, r: 4.0, w: 0.44 },
      { x: -3.60, z:  8.20, r: 3.6, w: 0.38 },
      { x:  6.20, z:  9.80, r: 3.4, w: 0.34 },
      { x:  3.20, z: 13.80, r: 3.6, w: 0.38 },
      { x: -2.20, z: 15.00, r: 5.0, w: 0.32 },
      { x: -4.40, z: 21.60, r: 3.6, w: 0.38 },
      { x:  3.40, z: 24.40, r: 3.6, w: 0.38 },
      { x: -3.55, z: 29.30, r: 5.5, w: 0.58 },
      { x:  3.55, z: 29.30, r: 5.5, w: 0.58 },
      { x: -2.95, z: 45.20, r: 6.8, w: 0.72 },
      { x: -2.42, z: 54.65, r: 4.8, w: 0.48 },
      { x:  4.15, z: 53.50, r: 4.2, w: 0.46 },
      { x: -3.15, z: 66.20, r: 4.6, w: 0.48 },
      { x: -3.55, z: 71.20, r: 6.8, w: 0.72 },
      { x: -3.25, z: 75.40, r: 4.6, w: 0.48 },
      { x: -2.05, z: 84.20, r: 4.6, w: 0.46 },
      { x: -4.25, z: 88.80, r: 5.0, w: 0.52 },
      { x: -0.55, z: 92.80, r: 4.6, w: 0.46 },
      { x:  0.65, z: 111.20, r: 7.4, w: 0.74 }
    ];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = evalBaseTerrainY(x, z);
      pos.setY(i, y);
      // 1024px irregular medieval cobblestones at crisp realistic boot scale (~2.25m per tile)
      uv.setXY(i, x * 0.44, z * 0.44);

      const rDist = getRiverSignedDist(x, z);
      const wetT = 1.0 - smoothstep(-0.3, 2.8, rDist);
      const pathDist = Math.abs(x - getPathCenterX(z));
      const roadHalf = z > 30.0 ? 3.45 : 2.85;
      const pathT = (z >= 2.0 && z <= 122.0) ? (1.0 - smoothstep(roadHalf * 0.55, roadHalf + 1.35, pathDist)) : 0.0;
      const shoalT = (z >= 36.0 && z <= 60.0 && x >= 2.2 && x <= 7.2) ? 0.65 : 0.0;
      const cliffT = smoothstep(2.0, 4.8, y);
      const mossNoise = clamp01(0.5 + 0.5 * Math.sin(x * 0.48 + z * 0.34) * Math.cos(z * 0.38 - x * 0.25));
      const mossT = clamp01((0.35 + mossNoise * 0.65) * (1.0 - pathT * 0.85) * (1.0 - wetT * 0.45) * smoothstep(-0.05, 1.1, y));

      mixAttr[i * 4]     = clamp01(Math.max(pathT, shoalT));
      mixAttr[i * 4 + 1] = mossT;
      mixAttr[i * 4 + 2] = cliffT;
      mixAttr[i * 4 + 3] = clamp01(wetT + pathT * 0.26);

      cTmp.copy(cDry);
      cTmp.lerp(cPath, pathT * 0.72);
      cTmp.lerp(cMoss, mossT * 0.55);
      cTmp.lerp(cWet, wetT * 0.65);
      cTmp.lerp(cCliff, cliffT * 0.68);

      let warmSum = 0.0;
      for (let pi = 0; pi < bakedWarmPools.length; pi++) {
        const bp = bakedWarmPools[pi];
        const d = Math.hypot(x - bp.x, z - bp.z);
        if (d < bp.r) {
          const f = 1.0 - d / bp.r;
          warmSum += f * f * bp.w;
        }
      }
      if (warmSum > 0.005) {
        cTmp.lerp(cWarmFire, Math.min(0.76, warmSum));
      }
      cols[i * 3]     = cTmp.r;
      cols[i * 3 + 1] = cTmp.g;
      cols[i * 3 + 2] = cTmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.setAttribute('aTerrainMix', new THREE.BufferAttribute(mixAttr, 4));
    geo.computeVertexNormals();
    return geo;
  }

  const shoreTerrainMesh = new THREE.Mesh(trackGeo(buildShoreTerrainGeo()), shoreTerrainMat);
  shoreTerrainMesh.receiveShadow = true;
  exteriorGroup.add(shoreTerrainMesh);

  // Ancient Broken Mossy Gothic Pilgrim Flagstones & Road Curbing (Zone 0 Shore z = 5.6..30.2)
  const pathSlabParts = [];
  for (let pz = 5.6; pz <= 30.2; pz += 1.45) {
    const basePx = getPathCenterX(pz);
    const slabsInRow = extRng() < 0.45 ? 2 : 1;
    for (let si = 0; si < slabsInRow; si++) {
      const cx = basePx + (slabsInRow === 2 ? (si === 0 ? -0.68 : 0.68) : 0) + (extRng() - 0.5) * 0.42;
      const cz = pz + (extRng() - 0.5) * 0.34;
      const gy = evalBaseTerrainY(cx, cz);
      const sw = (slabsInRow === 2 ? 0.86 : 1.38) + extRng() * 0.46;
      const sd = 0.72 + extRng() * 0.46;
      const slab = new THREE.CylinderGeometry(Math.max(sw, sd) * 0.52, Math.max(sw, sd) * 0.56, 0.14, 6);
      slab.scale(sw / Math.max(sw, sd), 1.0, sd / Math.max(sw, sd));
      xformGeo(slab, cx, gy - 0.025, cz, (extRng() - 0.5) * 0.05, extRng() * 1.4, (extRng() - 0.5) * 0.05);
      pathSlabParts.push(tintGeo(THREE, slab, extRng() < 0.35 ? 0x7e9482 : 0x9aa6be, 0x4c566b));
    }
    if (Math.floor(pz) % 3 === 0 && pz >= 7.5 && pz <= 27.5) {
      for (const side of [-1, 1]) {
        const kx = basePx + side * (2.05 + extRng() * 0.35);
        const kz = pz + (extRng() - 0.5) * 0.5;
        const kgy = evalBaseTerrainY(kx, kz);
        if (kgy < WATER_LEVEL + 0.08) continue;
        const kerb = new THREE.BoxGeometry(0.32 + extRng() * 0.14, 0.26 + extRng() * 0.12, 0.68 + extRng() * 0.28);
        xformGeo(kerb, kx, kgy + 0.05, kz, (extRng() - 0.5) * 0.14, (extRng() - 0.5) * 0.28, side * 0.08);
        pathSlabParts.push(tintGeo(THREE, kerb, 0x8d9cb6, 0x454f63));
      }
    }
  }
  const extAshlarMat = createMossCoatedStoneMaterial(THREE, gorgePbrTex, {
    kind: 'ruin',
    color: 0xb4c0d4,
    envMapIntensity: 0.44,
    mossAmount: 0.56,
    groundAO: 0.36,
    rimStrength: 0.14,
    lowSpecMode,
    trackMat,
    regNormalMat
  });
  const pathSlabsMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, pathSlabParts, { boxUvTile: 2.2, withColor: true })),
    extAshlarMat
  );
  pathSlabsMesh.receiveShadow = true;
  exteriorGroup.add(pathSlabsMesh);

  // --------------------------------------------------------------------------
  // C4. AAA Curving Gorge River (Moonlight Path + Crisp Shoreline Foam) + Multi-Layered 3D Waterfall!
  // --------------------------------------------------------------------------
  function buildExteriorRiverRibbonGeo() {
    const zSteps = isMobile ? 96 : 168;
    const xSteps = isMobile ? 16 : 24;
    const zMin = -14.8;
    const zMax = 158.0;
    const pos = new Float32Array((zSteps + 1) * (xSteps + 1) * 3);
    const uv = new Float32Array((zSteps + 1) * (xSteps + 1) * 2);
    const indices = [];

    for (let iz = 0; iz <= zSteps; iz++) {
      const v = iz / zSteps;
      const z = lerp(zMin, zMax, v);
      const rcx = getRiverCenterX(z);
      const rhw = getRiverHalfWidth(z) + 2.4;
      for (let ix = 0; ix <= xSteps; ix++) {
        const u = ix / xSteps;
        const x = rcx + (u * 2.0 - 1.0) * rhw;
        const vi = iz * (xSteps + 1) + ix;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = WATER_LEVEL;
        pos[vi * 3 + 2] = z;
        uv[vi * 2]     = u;
        uv[vi * 2 + 1] = v * 34.0;
      }
    }
    for (let iz = 0; iz < zSteps; iz++) {
      for (let ix = 0; ix < xSteps; ix++) {
        const a = iz * (xSteps + 1) + ix;
        const b = (iz + 1) * (xSteps + 1) + ix;
        const d = iz * (xSteps + 1) + (ix + 1);
        const e = (iz + 1) * (xSteps + 1) + (ix + 1);
        indices.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  const extRiverUniforms = {
    uTime: extSkyUniforms.uTime,
    uLowSpec: extSkyUniforms.uLowSpec,
    uBonfireLit: { value: 0.0 }
  };
  const extRiverMat = trackMat(createGorgeRiverMaterial(THREE, extSkyUniforms.uTime, extRiverUniforms.uBonfireLit, lowSpecMode));
  if (extRiverMat.uniforms?.uFogColor?.value) {
    extRiverMat.uniforms.uFogColor.value.setHex(0x1a2a40);
  }
  const extRiverMesh = new THREE.Mesh(trackGeo(buildExteriorRiverRibbonGeo()), extRiverMat);
  extRiverMesh.renderOrder = 1;
  exteriorGroup.add(extRiverMesh);

  // Multi-Layered 3D Roaring Outfall Waterfall Cascade (Core Torrent + Outer Frothy Spray Curtain!)
  function buildWaterfallSheetGeo(zStart, yTop, dropZ, dropY, wStart, wEnd, bulge) {
    const cols = 18;
    const rows = 16;
    const pos = new Float32Array((cols + 1) * (rows + 1) * 3);
    const uv = new Float32Array((cols + 1) * (rows + 1) * 2);
    const idx = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      const z = zStart + v * dropZ;
      const y = yTop - Math.pow(v, 1.85) * dropY;
      const halfW = lerp(wStart, wEnd, v);
      for (let c = 0; c <= cols; c++) {
        const u = c / cols;
        const nx = u * 2.0 - 1.0;
        const x = nx * halfW;
        const archDip = (1.0 - nx * nx) * bulge;
        const rib = Math.sin(u * Math.PI * 5.0) * 0.08 * v;
        const vi = r * (cols + 1) + c;
        pos[vi * 3]     = x;
        pos[vi * 3 + 1] = y + archDip * (1.0 - v * 0.65) + rib;
        pos[vi * 3 + 2] = z + archDip * 0.65 + Math.abs(rib) * 0.6;
        uv[vi * 2]     = u;
        uv[vi * 2 + 1] = v;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = (r + 1) * (cols + 1) + c;
        const d = r * (cols + 1) + (c + 1);
        const e = (r + 1) * (cols + 1) + (c + 1);
        idx.push(a, b, e, a, e, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function makeWaterfallMat(speedMul, opacityMul, foamBias) {
    return trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: extSkyUniforms.uTime },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.y += sin(uv.x * 18.0 + uv.y * 9.0 - uTime * ${(8.5 * speedMul).toFixed(2)}) * 0.065 * uv.y;
          p.z += cos(uv.x * 12.0 - uTime * ${(6.8 * speedMul).toFixed(2)}) * 0.045 * uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        void main() {
          float t = uTime * ${(4.8 * speedMul).toFixed(2)};
          float s1 = vnoise(vec2(vUv.x * 13.0, vUv.y * 4.5 - t));
          float s2 = vnoise(vec2(vUv.x * 26.0 + 3.1, vUv.y * 8.5 - t * 1.55));
          float s3 = vnoise(vec2(vUv.x * 6.0 - 1.4, vUv.y * 2.8 - t * 0.75));
          float streak = smoothstep(0.24, 0.80, s1 * 0.50 + s2 * 0.32 + s3 * 0.18 + vUv.y * 0.30 + ${foamBias.toFixed(2)});
          float sideFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(0.0, 0.15, 1.0 - vUv.x);
          float topFade = smoothstep(0.0, 0.08, vUv.y);
          vec3 slateWater = vec3(0.10, 0.18, 0.30);
          vec3 moonFoam   = vec3(0.80, 0.90, 1.02);
          vec3 waterCol = mix(slateWater, moonFoam, streak);
          float a = clamp((0.46 + streak * 0.54) * sideFade * topFade * ${opacityMul.toFixed(2)}, 0.0, 0.95);
          if (a < 0.01) discard;
          gl_FragColor = vec4(waterCol, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
  }

  // Layer 1: Dense Core Roaring Outfall Cascade (y = +2.1 -> -0.25m, z = -14.6 -> -10.5m)
  const waterfallCoreMesh = new THREE.Mesh(
    trackGeo(buildWaterfallSheetGeo(-14.6, 2.05, 4.05, 2.30, 2.75, 3.65, 0.28)),
    makeWaterfallMat(1.0, 0.94, 0.0)
  );
  waterfallCoreMesh.renderOrder = 2;
  exteriorGroup.add(waterfallCoreMesh);

  // Layer 2: Outer Frothy Spray & Turbulent Cascade Veil slightly ahead & wider!
  const waterfallVeilMesh = new THREE.Mesh(
    trackGeo(buildWaterfallSheetGeo(-14.25, 2.25, 4.35, 2.45, 2.95, 4.10, 0.42)),
    makeWaterfallMat(1.24, 0.58, 0.12)
  );
  waterfallVeilMesh.renderOrder = 3;
  exteriorGroup.add(waterfallVeilMesh);

  // --------------------------------------------------------------------------
  // C5. Multi-Octave Displaced Basalt Cliffs & Gorge Mountains (ZERO smooth cones!),
  //     Monumental Gothic Outfall Arch w/ Ripped Grate, Coastal Boulders &
  //     MONUMENTAL GOTHIC GATE OF THE ASH GORGE w/ Swirling Golden-Silver Boss Fog & Twin Braziers!
  // --------------------------------------------------------------------------
  const extBasaltMat = createMossCoatedStoneMaterial(THREE, gorgePbrTex, {
    kind: 'cliff',
    color: 0xadb9cc,
    envMapIntensity: 0.42,
    mossAmount: 0.72,
    groundAO: 0.38,
    rimStrength: 0.16,
    lowSpecMode,
    trackMat,
    regNormalMat
  });

  const basaltParts = [];
  const ashlarParts = [];
  const extIronParts = [];

  // 1. CRAGGY MULTI-OCTAVE DISPLACED BASALT CLIFFS & GORGE MOUNTAINS
  //    - Carefully sculpted low V-canyon framing around z = -14m so Castle of Ash & Giant Moon are 100% UNOBSTRUCTED!
  //    - Rugged stepped coastal cliff ridges enclosing west shore, east riverbank & curving behind Ash Gorge Gate!
  const rockDetail = isMobile ? 2 : 3;
  const cliffMassSpecs = [
    // Foreground V-gorge outfall cliff shoulders (grounded solidly into terrain, framing outfall arch w/o blocking Moon/Castle!)
    { x: -11.4, y: -1.4, z: -15.6, rx: 6.4, ry:  9.2, rz: 5.8, seed: 801, flatTop: true },
    { x:  11.6, y: -1.4, z: -15.4, rx: 6.6, ry:  9.4, rz: 5.8, seed: 802, flatTop: true },
    { x: -20.5, y: -1.2, z: -13.6, rx: 8.6, ry: 13.8, rz: 7.4, seed: 803, flatTop: false },
    { x:  21.0, y: -1.2, z: -13.4, rx: 8.8, ry: 14.2, rz: 7.5, seed: 804, flatTop: false },
    // Low craggy basalt ridge crest directly above outfall headwall (y top ~ 9.6m -> Castle towers soar freely behind!)
    { x:   0.0, y:  6.4, z: -17.4, rx: 6.2, ry:  3.4, rz: 4.2, seed: 805, flatTop: true },
    { x:  -7.2, y:  6.2, z: -17.8, rx: 5.8, ry:  4.2, rz: 4.6, seed: 806, flatTop: true },
    { x:   7.4, y:  6.3, z: -17.6, rx: 6.0, ry:  4.3, rz: 4.6, seed: 807, flatTop: true },
    // West coastal craggy mountain ridge (x = -16..-25, z = -5..+36) — broad terraced basalt mesas & stepped shelves!
    { x: -18.8, y: -1.4, z:  -4.8, rx: 9.2, ry:  9.8, rz: 8.6, seed: 808, flatTop: true },
    { x: -20.2, y: -1.4, z:   5.2, rx: 9.6, ry: 10.6, rz: 9.4, seed: 809, flatTop: true },
    { x: -21.2, y: -1.4, z:  15.6, rx: 10.4, ry: 11.4, rz: 10.0, seed: 810, flatTop: true },
    { x: -19.6, y: -1.4, z:  25.8, rx: 9.8, ry: 10.8, rz: 9.4, seed: 811, flatTop: true },
    { x: -15.4, y: -1.4, z:  34.8, rx: 9.2, ry: 10.2, rz: 8.6, seed: 812, flatTop: true },
    // East gorge mountain wall across the black river (x = +21..+29, z = -4..+32)
    { x:  23.4, y: -1.4, z:  -3.5, rx: 9.8, ry: 10.5, rz: 9.0, seed: 813, flatTop: true },
    { x:  25.4, y: -1.4, z:   7.5, rx: 10.6, ry: 11.6, rz: 9.8, seed: 814, flatTop: true },
    { x:  26.8, y: -1.4, z:  19.2, rx: 11.2, ry: 12.2, rz: 10.2, seed: 815, flatTop: true },
    { x:  25.8, y: -1.4, z:  30.6, rx: 10.6, ry: 11.2, rz: 9.8, seed: 816, flatTop: true }
  ];
  for (let i = 0; i < cliffMassSpecs.length; i++) {
    const c = cliffMassSpecs[i];
    const g = buildCraggyCliffMassGeo(THREE, c.rx, c.ry, c.rz, c.seed, rockDetail, {
      flatTop: c.flatTop,
      topHex: 0x7c8eae,
      midHex: 0x45526c,
      botHex: 0x22293a,
      mossHex: 0x3f5e46
    });
    xformGeo(g, c.x, c.y, c.z, 0, extRng() * 6.28, 0);
    basaltParts.push(g);
  }

  // Sculpted Shore & River Boulders (matching EXTERIOR_STATIC_COLLIDERS 1:1!)
  const boulderSpecs = [
    { x: -8.6, z:  0.8, r: 1.60, sy: 0.72 },
    { x: -9.4, z:  8.5, r: 1.72, sy: 0.78 },
    { x: -9.8, z: 18.8, r: 1.76, sy: 0.80 },
    { x: -8.8, z: 26.4, r: 1.70, sy: 0.76 },
    { x: -5.4, z: -2.6, r: 1.48, sy: 0.68 },
    { x:  6.4, z: 23.2, r: 1.38, sy: 0.66 },
    // Churning plunge-pool & river rapids boulders
    { x:  4.6, z: -8.2, r: 1.45, sy: 0.62 },
    { x: -4.4, z: -9.5, r: 1.65, sy: 0.72 },
    { x:  9.2, z:  0.4, r: 1.22, sy: 0.56 },
    { x: 13.8, z: 11.2, r: 1.40, sy: 0.60 },
    { x: 11.2, z: 21.8, r: 1.28, sy: 0.58 },
    { x: 15.8, z: 28.0, r: 1.65, sy: 0.70 },
    { x: -11.5, z: 13.2, r: 1.35, sy: 0.70 },
    { x:  -7.2, z: 12.2, r: 0.72, sy: 0.55 },
    { x:   4.2, z: 10.6, r: 0.64, sy: 0.48 },
    { x:  -5.6, z: 22.0, r: 0.78, sy: 0.55 }
  ];
  for (let i = 0; i < boulderSpecs.length; i++) {
    const b = boulderSpecs[i];
    const gy = evalExteriorGroundY(b.x, b.z);
    const g = buildSculptedRockGeo(THREE, b.r, 850 + i, b.sy, isMobile ? 1 : 2);
    xformGeo(g, b.x, gy + b.r * b.sy * 0.30, b.z, 0, extRng() * 6.28, 0);
    const inWater = gy < WATER_LEVEL + 0.1;
    basaltParts.push(tintGeo(THREE, g, inWater ? 0x424d64 : 0x5c6978, 0x1a1f2b));
  }

  // 2. MONUMENTAL GOTHIC SUBTERRANEAN OUTFALL ARCHWAY at (0, 0, -14.0) + VIOLENTLY RIPPED IRON GRATE!
  const archZ = -14.0;
  for (const side of [-1, 1]) {
    // Stepped gothic sluice retaining piers w/ battered plinths, buttress pilasters & weathered capstones
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(3.2, 1.3, 4.5), side * 4.55, 0.35, archZ + 0.25), 0x626e88, 0x242938));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(2.7, 7.8, 4.0), side * 4.55, 3.6, archZ), 0x6c7996, 0x282e3f));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.15, 7.2, 1.25), side * 5.65, 3.4, archZ + 1.85), 0x7685a4, 0x2f364a));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(3.2, 0.65, 4.5), side * 4.55, 7.2, archZ + 0.12), 0x7c8bac, 0x353d52));
  }
  // Double-ring recessed pointed gothic stone archivolts spanning the outfall opening (x in [-3.5..+3.5])
  const outArchSegs = 14;
  for (let ring = 0; ring < 2; ring++) {
    const rad = ring === 0 ? 3.55 : 4.18;
    const zOff = ring === 0 ? archZ + 0.0 : archZ + 0.55;
    const depth = ring === 0 ? 3.4 : 1.15;
    const thick = ring === 0 ? 0.85 : 0.68;
    for (let i = 0; i < outArchSegs; i++) {
      const a0 = (i / outArchSegs) * Math.PI;
      const a1 = ((i + 1) / outArchSegs) * Math.PI;
      const x0 = -Math.cos(a0) * rad;
      const y0 = 3.85 + Math.pow(Math.sin(a0), 0.78) * (rad + 0.35);
      const x1 = -Math.cos(a1) * rad;
      const y1 = 3.85 + Math.pow(Math.sin(a1), 0.78) * (rad + 0.35);
      const len = Math.hypot(x1 - x0, y1 - y0) + 0.18;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      ashlarParts.push(tintGeo(
        THREE,
        xformGeo(new THREE.BoxGeometry(len, thick, depth), (x0 + x1) * 0.5, (y0 + y1) * 0.5, zOff, 0, 0, ang),
        ring === 1 ? 0x8291b2 : 0x6c7894,
        0x2e3548
      ));
    }
  }
  // Sculpted keystone, molded headwall cornice & crumbling stone parapet
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(1.25, 1.75, 4.1), 0, 8.15, archZ + 0.25), 0x8897b8, 0x3b445b));
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(12.2, 2.0, 3.2), 0, 8.85, archZ - 0.35), 0x5d6882, 0x242a38));
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(12.6, 0.48, 3.6), 0, 9.75, archZ - 0.15), 0x7482a0, 0x31384c));

  const outfallVoidMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x03050a }));
  const outfallVoid = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.2, 7.6)), outfallVoidMat);
  outfallVoid.position.set(0, 3.5, archZ - 1.35);
  exteriorGroup.add(outfallVoid);

  // VIOLENTLY RIPPED & BENT-OUTWARD RUSTY IRON OUTFALL GRATE (organic asymmetric breaks, consistent w/ Act 4!)
  extIronParts.push(xformGeo(new THREE.BoxGeometry(7.6, 0.38, 0.38), 0, 6.45, archZ + 1.35));
  for (let i = -4; i <= 4; i++) {
    const bx = i * 0.78;
    const isBrokenCenter = Math.abs(i) <= 2;
    if (isBrokenCenter) {
      // Torn upper iron bars violently blasted OUTWARD (+Z) at irregular jagged angles!
      const lenVar = 2.0 + Math.abs(i) * 0.45 + (i % 2 === 0 ? 0.35 : -0.15);
      const bendPitch = -0.96 - (2 - Math.abs(i)) * 0.24;
      const splayZ = i * 0.28 + (i === 0 ? 0.14 : 0);
      const topStub = new THREE.CylinderGeometry(0.085, 0.095, lenVar, 7);
      xformGeo(topStub, bx, 6.35 - lenVar * 0.26, archZ + 1.95 + (2 - Math.abs(i)) * 0.32, bendPitch, 0, splayZ);
      extIronParts.push(topStub);
      // Only outer 2 broken lower shards jut asymmetrically near the waterfall edges (clean wide roaring breach in center!)
      if (Math.abs(i) >= 1) {
        const botLen = Math.abs(i) === 2 ? 1.55 : 0.95;
        const botStub = new THREE.CylinderGeometry(0.08, 0.09, botLen, 7);
        xformGeo(botStub, bx + Math.sign(i) * 0.18, 1.85 + (Math.abs(i) - 1) * 0.25, archZ + 1.92, 1.05 + Math.abs(i) * 0.14, 0, -i * 0.34);
        extIronParts.push(botStub);
      }
    } else {
      const bar = new THREE.CylinderGeometry(0.095, 0.105, 5.6, 7);
      xformGeo(bar, bx, 3.7, archZ + 1.35);
      extIronParts.push(bar);
      extIronParts.push(xformGeo(new THREE.BoxGeometry(0.28, 0.24, 0.36), bx, 3.6, archZ + 1.35));
    }
  }
  // Dangling broken iron chains hanging off the ripped grate frame
  addHangingChainParts(THREE, extIronParts, -2.4, 6.2, archZ + 1.55, 7, 0.24, -0.15, 0.25);
  addHangingChainParts(THREE, extIronParts,  2.4, 6.2, archZ + 1.55, 7, 0.24,  0.15, 0.22);

  // 3. ZONE 0 ASH GORGE GATE THRESHOLD & ORNATE TWIN FORGED-IRON BRAZIERS at z = +31.0
  //    (Sculpted Blender Ash Gorge Gate masonry mounts cleanly from soulsGorgeRoad.js!)
  const gateZ = 31.0;
  const gateGroundY = evalExteriorGroundY(0.0, gateZ);
  for (const side of [-1, 1]) {
    // ORNATE GOTHIC FORGED-IRON GATE BRAZIERS at (±3.55, 29.3) matching collider!
    const bxP = side * 3.55;
    const bzP = 29.3;
    const bgy = evalExteriorGroundY(bxP, bzP);
    // Stepped octagonal carved stone pedestal
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.58, 0.68, 0.28, 8), bxP, bgy + 0.14, bzP), 0x7c8aa8, 0x333a4e));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.40, 0.52, 0.96, 8), bxP, bgy + 0.72, bzP), 0x7482a0, 0x2f3648));
    ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.54, 0.44, 0.20, 8), bxP, bgy + 1.26, bzP), 0x8594b4, 0x3a435a));
    // Wrought-iron splayed bowl, lower forged ring, 8 curved iron fire-basket ribs & crown spikes!
    extIronParts.push(xformGeo(new THREE.CylinderGeometry(0.62, 0.34, 0.46, 8), bxP, bgy + 1.54, bzP));
    extIronParts.push(xformGeo(new THREE.TorusGeometry(0.58, 0.042, 6, 14), bxP, bgy + 1.76, bzP, Math.PI * 0.5, 0, 0));
    extIronParts.push(xformGeo(new THREE.TorusGeometry(0.66, 0.040, 6, 14), bxP, bgy + 2.24, bzP, Math.PI * 0.5, 0, 0));
    for (let bi = 0; bi < 8; bi++) {
      const ba = (bi / 8) * Math.PI * 2;
      const rx = bxP + Math.cos(ba) * 0.59;
      const rz = bzP + Math.sin(ba) * 0.59;
      extIronParts.push(xformGeo(new THREE.CylinderGeometry(0.032, 0.038, 0.78, 6), rx, bgy + 2.02, rz, Math.sin(ba) * 0.16, 0, -Math.cos(ba) * 0.16));
      extIronParts.push(xformGeo(new THREE.ConeGeometry(0.042, 0.18, 4), bxP + Math.cos(ba) * 0.66, bgy + 2.44, bzP + Math.sin(ba) * 0.66));
    }
  }

  // Subtle low open threshold stone paving through the sculpted gateway at z = 31 (road continues straight ahead!)
  ashlarParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(6.8, 0.10, 3.4), 0, gateGroundY - 0.03, gateZ + 0.05), 0x6f7b96, 0x262c3c));

  const extBasaltMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, basaltParts, { boxUvTile: 4.5, withColor: true })),
    extBasaltMat
  );
  extBasaltMesh.receiveShadow = true;
  exteriorGroup.add(extBasaltMesh);

  const extAshlarMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, ashlarParts, { boxUvTile: 2.6, withColor: true })),
    extAshlarMat
  );
  extAshlarMesh.receiveShadow = true;
  exteriorGroup.add(extAshlarMesh);

  const extIronMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, extIronParts, { boxUvTile: 1.4 })),
    rustedGrateMat
  );
  exteriorGroup.add(extIronMesh);

  // Veiled Boss Fog Portal removed — player walks freely straight through the open ruined archway at z = 31 into the Gorge Road!

  // --------------------------------------------------------------------------
  // C6. Planted Oath Sword («Меч Клятвы») at swordPos (2.8, y, 5.2)
  //     + Full Support for Real 3D `sword_tripo` via `attachRealSwordModel(swordMesh)`!
  // --------------------------------------------------------------------------
  const swordGroup = new THREE.Group();
  const sx = EXTERIOR_SHORE_ANCHORS.swordPos.x;
  const sy = EXTERIOR_SHORE_ANCHORS.swordPos.y;
  const sz = EXTERIOR_SHORE_ANCHORS.swordPos.z;
  swordGroup.position.set(sx, sy, sz);
  exteriorGroup.add(swordGroup);

  // Sculpted wet pebble impact mound & scattered cobbles where the Oath Sword plunged into the shore
  const swordMoundMesh = new THREE.Mesh(
    trackGeo(tintGeo(THREE, buildSculptedRockGeo(THREE, 0.46, 910, 0.30, 2), 0x5c6476, 0x242934)),
    extBasaltMat
  );
  swordMoundMesh.position.y = 0.03;
  swordGroup.add(swordMoundMesh);

  // Tilted 12-degree pivot (0.21 rad) holding EITHER the real `sword_tripo` clone OR the refined fallback broadsword!
  const swordVisualPivot = new THREE.Group();
  swordVisualPivot.rotation.set(0.18, 0.52, -0.11); // ~12.1 deg heroic angle planted in coastal pebbles!
  swordGroup.add(swordVisualPivot);

  // Dedicated mount for externally attached real 3D `sword_tripo` model
  const swordRealMount = new THREE.Group();
  swordRealMount.name = 'RealOathSwordMount';
  swordVisualPivot.add(swordRealMount);
  let attachedRealSword = null;
  let attachedRealSwordWrapper = null;

  // Fallback procedural Gothic Oath Broadsword (sleek forged steel + aged antique gold crossguard — hidden when real model attached!)
  const swordFallbackGroup = new THREE.Group();
  swordVisualPivot.add(swordFallbackGroup);

  const oathSteelMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xc8d4e8,
    roughness: 0.26,
    metalness: 0.90,
    emissive: 0x221a0c,
    emissiveIntensity: 0.25
  }));
  const oathGoldMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xb89248,
    roughness: 0.36,
    metalness: 0.84,
    emissive: 0x3b2608,
    emissiveIntensity: 0.30
  }));
  const oathGripMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0x3a241d,
    roughness: 0.85,
    metalness: 0.10
  }));

  const swordBladeGeo = trackGeo((() => {
    const parts = [];
    const main = new THREE.CylinderGeometry(0.052, 0.016, 1.06, 4);
    xformGeo(main, 0, 0.34, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.26);
    parts.push(main);
    const fuller = new THREE.BoxGeometry(0.018, 0.72, 0.022);
    xformGeo(fuller, 0, 0.44, 0);
    parts.push(fuller);
    return mergeNonIndexedGeos(THREE, parts);
  })());
  const swordBladeMesh = new THREE.Mesh(swordBladeGeo, oathSteelMat);
  swordFallbackGroup.add(swordBladeMesh);

  const swordHiltGeo = trackGeo((() => {
    const parts = [];
    parts.push(xformGeo(new THREE.BoxGeometry(0.38, 0.052, 0.058), 0, 0.88, 0));
    parts.push(xformGeo(new THREE.ConeGeometry(0.036, 0.13, 4), -0.22, 0.85, 0, 0, 0, 1.15));
    parts.push(xformGeo(new THREE.ConeGeometry(0.036, 0.13, 4),  0.22, 0.85, 0, 0, 0, -1.15));
    parts.push(xformGeo(new THREE.OctahedronGeometry(0.056, 0), 0, 1.22, 0));
    return mergeNonIndexedGeos(THREE, parts);
  })());
  const swordHiltMesh = new THREE.Mesh(swordHiltGeo, oathGoldMat);
  swordFallbackGroup.add(swordHiltMesh);

  const swordGripMesh = new THREE.Mesh(
    trackGeo(xformGeo(new THREE.CylinderGeometry(0.026, 0.030, 0.27, 8), 0, 1.04, 0)),
    oathGripMat
  );
  swordFallbackGroup.add(swordGripMesh);

  // Refined Ethereal Slender Golden Light-Shaft + Soft Ground Glint Halo (replaces chunky yellow cylinder!)
  const swordBeaconMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNorm = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNorm;
      varying vec3 vView;
      void main() {
        float fres = pow(abs(dot(normalize(vNorm), normalize(vView))), 2.2);
        float yFade = smoothstep(0.0, 0.16, vUv.y) * pow(1.0 - vUv.y, 2.0);
        float wisp = 0.72 + 0.28 * sin(uTime * 2.8 - vUv.y * 7.0 + vUv.x * 6.283);
        vec3 col = mix(vec3(1.15, 0.74, 0.22), vec3(1.95, 1.62, 0.92), smoothstep(0.55, 0.05, vUv.y));
        float a = fres * yFade * wisp * 0.42;
        if (a < 0.006) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  }));
  const swordBeaconMesh = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.05, 0.22, 2.85, 14, 1, true)),
    swordBeaconMat
  );
  swordBeaconMesh.position.y = 1.44;
  swordBeaconMesh.renderOrder = 4;
  swordGroup.add(swordBeaconMesh);

  // Soft warm golden shimmer disc pooling around the planted sword blade on the wet pebbles
  const swordGroundHaloMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float g = exp(-r * r * 4.5) * (0.85 + 0.15 * sin(uTime * 3.1));
        vec3 col = mix(vec3(1.0, 0.62, 0.15), vec3(1.85, 1.45, 0.75), smoothstep(0.6, 0.0, r));
        gl_FragColor = vec4(col, g * 0.40);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const swordGroundHalo = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.45, 1.45)), swordGroundHaloMat);
  swordGroundHalo.rotation.x = -Math.PI * 0.5;
  swordGroundHalo.position.y = 0.06;
  swordGroundHalo.renderOrder = 3;
  swordGroup.add(swordGroundHalo);

  // Orbiting Delicate Golden Dust Motes rising around the Oath Sword
  const SWORD_SPARK_COUNT = isMobile ? 18 : 34;
  const swSpPos = new Float32Array(SWORD_SPARK_COUNT * 3);
  const swSpSeed = new Float32Array(SWORD_SPARK_COUNT * 3);
  for (let i = 0; i < SWORD_SPARK_COUNT; i++) {
    swSpPos[i * 3] = 0; swSpPos[i * 3 + 1] = 0.35; swSpPos[i * 3 + 2] = 0;
    swSpSeed[i * 3]     = extRng();
    swSpSeed[i * 3 + 1] = 0.45 + extRng() * 0.85;
    swSpSeed[i * 3 + 2] = 0.14 + extRng() * 0.36;
  }
  const swordSparkGeo = trackGeo(new THREE.BufferGeometry());
  swordSparkGeo.setAttribute('position', new THREE.BufferAttribute(swSpPos, 3));
  swordSparkGeo.setAttribute('aSeed', new THREE.BufferAttribute(swSpSeed, 3));
  const swordSparkMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.28 * aSeed.y);
        float ang = aSeed.x * 6.283 + uTime * (1.0 + aSeed.y * 0.9);
        float rad = aSeed.z * (1.0 - cyc * 0.48);
        vec3 p = vec3(cos(ang) * rad, 0.18 + cyc * 2.35, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(52.0 / max(1.0, -mv.z), 2.5, 16.0);
        vAlpha = sin(cyc * 3.14159) * 0.92;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(1.95, 1.48, 0.62), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const swordSparks = new THREE.Points(swordSparkGeo, swordSparkMat);
  swordSparks.renderOrder = 5;
  swordGroup.add(swordSparks);

  const swordBeaconLight = makeLightStub();

  // --------------------------------------------------------------------------
  // C7. DETAILED SHORE BONFIRE («Костёр Берега») at bonfirePos (-2.2, y, 15.0)
  //     + Twin Ornate Gate Brazier Multi-Layer FBM Flames & Rising Sparks!
  // --------------------------------------------------------------------------
  const bonfireGroup = new THREE.Group();
  const bx = EXTERIOR_SHORE_ANCHORS.bonfirePos.x;
  const by = EXTERIOR_SHORE_ANCHORS.bonfirePos.y;
  const bz = EXTERIOR_SHORE_ANCHORS.bonfirePos.z;
  bonfireGroup.position.set(bx, by, bz);
  exteriorGroup.add(bonfireGroup);

  function buildShoreBonfireHearthGeo() {
    const parts = [];
    // Sculpted pale-grey volcanic ash & charred soil mound
    const mound = new THREE.CylinderGeometry(0.58, 1.24, 0.36, 16, 2);
    xformGeo(mound, 0, 0.15, 0);
    parts.push(tintGeo(THREE, mound, 0x4b484a, 0x1d1c22));
    // 16 mossy & soot-stained hearth border stones encircling the ash bed
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + (extRng() - 0.5) * 0.12;
      const rr = 0.98 + (i % 2) * 0.08;
      const st = buildSculptedRockGeo(THREE, 0.25 + (i % 3) * 0.04, 930 + i, 0.72, 1);
      xformGeo(st, Math.cos(a) * rr, 0.13, Math.sin(a) * rr, 0, a, 0);
      parts.push(tintGeo(THREE, st, 0x677084, 0x242834));
    }
    // 8 Charred logs & weathered ancient warrior bones embedded in the ash mound
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.25;
      const isBone = i % 3 === 0;
      const log = new THREE.CylinderGeometry(isBone ? 0.032 : 0.055, isBone ? 0.042 : 0.075, isBone ? 0.72 : 0.92, 6);
      xformGeo(log, Math.cos(a) * 0.36, 0.23, Math.sin(a) * 0.36, Math.PI * 0.44, a, 0.28);
      parts.push(tintGeo(THREE, log, isBone ? 0x86827a : 0x342822, isBone ? 0x484440 : 0x16110e));
    }
    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.5, withColor: true });
  }

  function buildShoreCoiledSwordGeo() {
    const parts = [];
    const segs = isMobile ? 18 : 28;
    const bladeH = 1.68;
    const blade = new THREE.CylinderGeometry(0.055, 0.068, bladeH, 4, segs);
    blade.rotateY(Math.PI / 4);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const vx = bp.getX(i);
      const ly = bp.getY(i) + bladeH * 0.5;
      const vz = bp.getZ(i) * 0.45;
      const t = clamp01(ly / bladeH);
      const twist = t * Math.PI * 2.4;
      const waveX = Math.sin(t * Math.PI * 3.4) * 0.044;
      const c = Math.cos(twist);
      const s = Math.sin(twist);
      bp.setXYZ(i, vx * c - vz * s + waveX, 0.18 + ly, vx * s + vz * c);
    }
    blade.computeVertexNormals();
    parts.push(tintGeo(THREE, blade, 0x6b748c, 0x8e482b));
    parts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.60, 0.070, 0.078), 0, 1.80, 0, 0, 0, 0.08), 0x677088, 0x353b4a));
    parts.push(tintGeo(THREE, xformGeo(new THREE.TorusGeometry(0.095, 0.020, 5, 12), 0, 1.82, 0.068), 0x6f7892, 0x3a4052));
    parts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.036, 0.042, 0.34, 8), 0, 2.02, 0), 0x342c2a, 0x1e1919));
    parts.push(tintGeo(THREE, xformGeo(new THREE.OctahedronGeometry(0.098, 0), 0, 2.24, 0), 0x737e98, 0x3c4252));
    return mergeNonIndexedGeos(THREE, parts, { boxUvTile: 1.2, withColor: true });
  }

  const bonfireHearthMesh = new THREE.Mesh(trackGeo(buildShoreBonfireHearthGeo()), extBasaltMat);
  bonfireHearthMesh.receiveShadow = true;
  bonfireGroup.add(bonfireHearthMesh);

  const coiledSwordMat = trackMat(new THREE.MeshStandardMaterial({
    map: ironPbr.albedo,
    roughnessMap: ironPbr.orm,
    vertexColors: true,
    color: 0xb4bcd0,
    roughness: 0.68,
    metalness: 0.80,
    envMapIntensity: 0.58
  }));
  const coiledSwordMesh = new THREE.Mesh(trackGeo(buildShoreCoiledSwordGeo()), coiledSwordMat);
  coiledSwordMesh.rotation.set(0.08, 0.45, -0.10);
  bonfireGroup.add(coiledSwordMesh);

  // Glowing Molten Ember Coal Bed inside the bonfire ring (dimly smoldering unlit, blazing molten gold-orange when lit!)
  const bonfireCoalsUniforms = {
    uTime: extSkyUniforms.uTime,
    uLit: { value: 0.0 }
  };
  const bonfireCoalsMat = trackMat(new THREE.ShaderMaterial({
    uniforms: bonfireCoalsUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLit;
      varying vec2 vUv;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float n = hash21(floor(vUv * 18.0));
        float pulse = 0.78 + 0.22 * sin(uTime * 6.5 + n * 12.0);
        float radial = 1.0 - smoothstep(0.18, 0.98, r);
        float glow = radial * (0.24 + uLit * 0.92) * (0.65 + 0.35 * n) * pulse;
        vec3 col = mix(vec3(0.14, 0.04, 0.02), vec3(2.3, 0.72, 0.12), clamp(glow * 1.1, 0.0, 1.0));
        gl_FragColor = vec4(col, radial * (0.72 + uLit * 0.28));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false
  }));
  const bonfireCoals = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.80, 18)), bonfireCoalsMat);
  bonfireCoals.rotation.x = -Math.PI * 0.5;
  bonfireCoals.position.y = 0.33;
  bonfireGroup.add(bonfireCoals);

  // Reusable Volumetric Multi-Tongue Souls Fire Assembly (6 offset curved flame sheets + soft amber haze orb -> ZERO white-cone X-seam!)
  function createFlameAssemblyMesh(scaleW, scaleH, litUniformRef) {
    const group = new THREE.Group();
    const flameParts = [];
    const sheetSpecs = [
      { w: scaleW * 1.00, h: scaleH * 1.04, ry: 0.00, ox:  0.00, oz:  0.00 },
      { w: scaleW * 0.94, h: scaleH * 0.96, ry: 1.05, ox:  0.05, oz: -0.04 },
      { w: scaleW * 0.92, h: scaleH * 0.98, ry: 2.10, ox: -0.05, oz:  0.04 },
      { w: scaleW * 0.72, h: scaleH * 1.18, ry: 0.52, ox:  0.09, oz:  0.07 },
      { w: scaleW * 0.70, h: scaleH * 1.12, ry: 1.57, ox: -0.09, oz: -0.06 },
      { w: scaleW * 0.68, h: scaleH * 0.86, ry: 2.62, ox:  0.02, oz: -0.09 }
    ];
    for (let k = 0; k < sheetSpecs.length; k++) {
      const sp = sheetSpecs[k];
      const plane = new THREE.PlaneGeometry(sp.w, sp.h, 6, 12);
      // Slight organic cylindrical bow so flames look round & volumetric from every angle
      const pp = plane.attributes.position;
      for (let vi = 0; vi < pp.count; vi++) {
        const lx = pp.getX(vi);
        const ly = pp.getY(vi);
        const bow = (1.0 - Math.min(1.0, (lx / (sp.w * 0.5)) ** 2)) * sp.w * 0.14;
        pp.setZ(vi, bow);
        pp.setY(vi, ly + sp.h * 0.5);
      }
      plane.rotateY(sp.ry);
      plane.translate(sp.ox, 0, sp.oz);
      flameParts.push(plane);
    }
    const geo = trackGeo(mergeNonIndexedGeos(THREE, flameParts));
    const mat = trackMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: extSkyUniforms.uTime,
        uLit: litUniformRef
      },
      vertexShader: `
        uniform float uTime;
        uniform float uLit;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 p = position;
          float h = clamp(uv.y, 0.0, 1.0);
          float phase = p.x * 4.5 + p.z * 3.8;
          float swayX = (sin(uTime * 6.8 - h * 6.2 + phase) * 0.18 + sin(uTime * 11.4 - h * 9.0) * 0.06) * h * h;
          float swayZ = (cos(uTime * 5.9 - h * 5.5 - phase) * 0.16 + cos(uTime * 9.8 - h * 8.2) * 0.05) * h * h;
          float taper = 1.0 - smoothstep(0.15, 1.0, h) * 0.68;
          p.x = p.x * taper + swayX;
          p.z = p.z * taper + swayZ;
          p.y *= (0.15 + 0.85 * uLit);
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        float hash21(vec2 p) {
          p = fract(p * vec2(127.1, 311.7));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        void main() {
          if (uLit < 0.02) discard;
          float cx = abs(vUv.x - 0.5) * 2.0;
          float seed = fract(sin(dot(floor(vWorldPos.xz * 2.5), vec2(12.9898, 78.233))) * 43758.5453);
          float n1 = vnoise(vec2(vUv.x * 4.4 + seed * 3.0, vUv.y * 3.8 - uTime * 3.8));
          float n2 = vnoise(vec2(vUv.x * 9.8 - seed * 2.0, vUv.y * 7.8 - uTime * 6.8));
          float n3 = vnoise(vec2(vUv.x * 16.0, vUv.y * 12.0 - uTime * 9.5));
          float turb = n1 * 0.48 + n2 * 0.34 + n3 * 0.18;
          // Distinct separated licking fire tongues (zero solid triangle cone!)
          float tongueCut = smoothstep(0.24, 0.82, turb + (1.0 - vUv.y) * 0.42 - cx * cx * 0.92);
          float verticalEnv = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.32, 0.98, vUv.y + (0.52 - turb) * 0.65));
          float mask = tongueCut * verticalEnv;
          if (mask < 0.02) discard;
          // Rich crimson-ember outer tongues -> vivid blazing Souls orange -> warm compact amber-gold heart (never clipped white!)
          float heat = clamp(mask * (1.08 - vUv.y * 0.88) + (turb - 0.5) * 0.25, 0.0, 1.0);
          vec3 col = mix(vec3(0.72, 0.08, 0.008), vec3(1.18, 0.34, 0.03), smoothstep(0.08, 0.50, heat));
          col = mix(col, vec3(1.48, 0.86, 0.24), smoothstep(0.56, 0.94, heat));
          gl_FragColor = vec4(col, mask * 0.42 * uLit);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }));
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 4;
    group.add(m);

    // Soft additive warm atmospheric fire-haze billboard halo (adds lush volumetric aura around the flames!)
    const haloMat = trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: extSkyUniforms.uTime, uLit: litUniformRef },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        varying vec2 vUv;
        void main() {
          if (uLit < 0.02) discard;
          float d = length(vUv * 2.0 - 1.0);
          if (d > 1.0) discard;
          float flick = 0.86 + 0.14 * sin(uTime * 8.3) * cos(uTime * 5.7);
          float g = exp(-d * d * 4.2) * (1.0 - smoothstep(0.62, 1.0, d));
          vec3 col = mix(vec3(0.95, 0.26, 0.04), vec3(1.25, 0.62, 0.16), exp(-d * d * 6.0));
          gl_FragColor = vec4(col * flick, g * 0.34 * uLit);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const halo = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(scaleW * 2.5, scaleH * 1.9)), haloMat);
    halo.position.y = scaleH * 0.44;
    halo.renderOrder = 3;
    group.add(halo);
    return group;
  }

  // Terrain-Conforming Flickering Warm Firelight Ground Pool Decal (ZERO PointLights -> ZERO shader hitches!)
  function addWarmGroundPool(px, pz, radius, colorRgb, strength, litUniformRef, phaseOff = 0) {
    const segs = isMobile ? 4 : 6;
    const g = new THREE.PlaneGeometry(radius * 2, radius * 2, segs, segs);
    g.rotateX(-Math.PI * 0.5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const wx = px + p.getX(i);
      const wz = pz + p.getZ(i);
      p.setXYZ(i, wx, evalExteriorGroundY(wx, wz) + 0.048, wz);
    }
    const mat = trackMat(new THREE.ShaderMaterial({
      uniforms: {
        uTime: extSkyUniforms.uTime,
        uLit: litUniformRef,
        uCol: { value: new THREE.Vector3(colorRgb[0], colorRgb[1], colorRgb[2]) },
        uStr: { value: strength },
        uPhase: { value: phaseOff }
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vGroundY;
        void main() {
          vUv = uv;
          vGroundY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uLit;
        uniform vec3 uCol;
        uniform float uStr;
        uniform float uPhase;
        varying vec2 vUv;
        varying float vGroundY;
        void main() {
          if (uLit < 0.01) discard;
          float dryMask = smoothstep(-0.28, -0.02, vGroundY);
          if (dryMask < 0.01) discard;
          float d = length(vUv * 2.0 - 1.0);
          if (d > 1.0) discard;
          float flick = 0.88 + 0.12 * sin(uTime * 6.4 + uPhase) * cos(uTime * 4.1 - uPhase * 0.7);
          float fall = exp(-d * d * 4.2) * (1.0 - smoothstep(0.62, 1.0, d));
          gl_FragColor = vec4(uCol * flick, fall * uStr * uLit * dryMask);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    const mesh = new THREE.Mesh(trackGeo(g), mat);
    mesh.renderOrder = 2;
    exteriorGroup.add(mesh);
    return mesh;
  }

  const alwaysOneUniform = { value: 1.0 };
  // Warm flickering firelight pool under the Shore Bonfire (activates seamlessly when lit!)
  addWarmGroundPool(bx, bz, 5.8, [1.05, 0.42, 0.08], 0.46, bonfireCoalsUniforms.uLit, 0.7);
  // Subtle permanent dying-ember glow under unlit bonfire so player spots the sanctuary immediately!
  addWarmGroundPool(bx, bz, 2.6, [0.85, 0.34, 0.08], 0.16, alwaysOneUniform, 1.3);
  // Warm flickering firelight pools under BOTH Ash Gorge Gate Braziers!
  addWarmGroundPool(-3.55, 29.3, 5.2, [1.10, 0.44, 0.10], 0.48, alwaysOneUniform, 2.1);
  addWarmGroundPool( 3.55, 29.3, 5.2, [1.10, 0.44, 0.10], 0.48, alwaysOneUniform, 4.3);

  const bonfireFlameMesh = createFlameAssemblyMesh(1.18, 1.72, bonfireCoalsUniforms.uLit);
  bonfireFlameMesh.position.y = 0.28;
  bonfireFlameMesh.visible = false;
  bonfireGroup.add(bonfireFlameMesh);

  // Rising Bonfire Ember Sparks (visible when lit)
  const BF_EMBER_COUNT = isMobile ? 22 : 44;
  const bfEmPos = new Float32Array(BF_EMBER_COUNT * 3);
  const bfEmSeed = new Float32Array(BF_EMBER_COUNT * 3);
  for (let i = 0; i < BF_EMBER_COUNT; i++) {
    bfEmPos[i * 3] = 0; bfEmPos[i * 3 + 1] = 0.3; bfEmPos[i * 3 + 2] = 0;
    bfEmSeed[i * 3]     = extRng();
    bfEmSeed[i * 3 + 1] = 0.6 + extRng() * 0.9;
    bfEmSeed[i * 3 + 2] = 0.12 + extRng() * 0.44;
  }
  const bfEmberGeo = trackGeo(new THREE.BufferGeometry());
  bfEmberGeo.setAttribute('position', new THREE.BufferAttribute(bfEmPos, 3));
  bfEmberGeo.setAttribute('aSeed', new THREE.BufferAttribute(bfEmSeed, 3));
  const bfEmberMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uLit: bonfireCoalsUniforms.uLit, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.42 * aSeed.y);
        float ang = aSeed.x * 6.283 + uTime * 1.9 + cyc * 4.0;
        float rad = aSeed.z * (0.4 + cyc * 1.35);
        vec3 p = vec3(cos(ang) * rad, 0.30 + cyc * 3.4, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(56.0 / max(1.0, -mv.z), 2.5, 16.0);
        vAlpha = sin(cyc * 3.14159);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      uniform float uLit;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha * uLit;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(2.25, 0.88, 0.22), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const bonfireEmbers = new THREE.Points(bfEmberGeo, bfEmberMat);
  bonfireEmbers.visible = false;
  bonfireEmbers.renderOrder = 5;
  bonfireGroup.add(bonfireEmbers);

  const bonfireLight = makeLightStub();

  // Always-Lit Twin Gate Brazier Flames + Glowing Coals + Rising Sparks + Twin Warm PointLights!
  const gateAlwaysLit = { value: 1.0 };
  const gateBrazierLights = [];
  const brazierSparkPos = [];
  const brazierSparkSeed = [];
  const sparksPerBrazier = isMobile ? 12 : 24;
  for (const side of [-1, 1]) {
    const bxP = side * 3.55;
    const bzP = 29.3;
    const bgy = evalExteriorGroundY(bxP, bzP);
    const bf = createFlameAssemblyMesh(1.05, 1.62, gateAlwaysLit);
    bf.position.set(bxP, bgy + 1.68, bzP);
    exteriorGroup.add(bf);

    // Molten glowing brazier coal bed
    const coalDisc = new THREE.Mesh(
      trackGeo(new THREE.CircleGeometry(0.52, 12)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xff6e18 }))
    );
    coalDisc.rotation.x = -Math.PI * 0.5;
    coalDisc.position.set(bxP, bgy + 1.78, bzP);
    exteriorGroup.add(coalDisc);

    const bl = makeLightStub();
    gateBrazierLights.push(bl);

    for (let si = 0; si < sparksPerBrazier; si++) {
      brazierSparkPos.push(bxP, bgy + 1.85, bzP);
      brazierSparkSeed.push(extRng(), 0.55 + extRng() * 0.85, 0.14 + extRng() * 0.38);
    }
  }
  const brazierSparksGeo = trackGeo(new THREE.BufferGeometry());
  brazierSparksGeo.setAttribute('position', new THREE.Float32BufferAttribute(brazierSparkPos, 3));
  brazierSparksGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(brazierSparkSeed, 3));
  const brazierSparksMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * 0.38 * aSeed.y);
        float ang = aSeed.x * 6.283 + uTime * 2.1 + cyc * 3.5;
        float rad = aSeed.z * (0.35 + cyc * 1.45);
        vec3 p = position + vec3(cos(ang) * rad, cyc * 3.6, sin(ang) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(54.0 / max(1.0, -mv.z), 2.5, 15.0);
        vAlpha = sin(cyc * 3.14159);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(2.3, 0.92, 0.24), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const brazierSparks = new THREE.Points(brazierSparksGeo, brazierSparksMat);
  brazierSparks.renderOrder = 5;
  exteriorGroup.add(brazierSparks);

  // --------------------------------------------------------------------------
  // C8. Living Foreground Details: Gnarled Dead Pines w/ Bark PBR, Curved Arching Bog Reeds,
  //     Broken Skiff Hull, Tattered Banners, Abandoned Shields & Rusted Spear!
  // --------------------------------------------------------------------------
  // 1) Gnarled Twisted Dead Coastal Pines (multi-tier crooked limbs + exposed roots + bark PBR!)
  const deadTreeParts = [];
  const pinePlacements = [
    { x: -11.4, z:  -4.2, h: 6.4, leanX:  0.26, leanZ:  0.14, ry: 0.4 },
    { x: -12.6, z:   6.8, h: 7.4, leanX:  0.28, leanZ: -0.08, ry: 1.5 },
    { x: -12.8, z:  16.8, h: 7.2, leanX:  0.26, leanZ:  0.12, ry: 2.8 },
    { x: -10.6, z:  24.8, h: 6.4, leanX:  0.22, leanZ: -0.15, ry: 4.1 },
    { x:  -9.6, z:  31.0, h: 6.8, leanX:  0.18, leanZ: -0.18, ry: 5.2 },
    { x:  15.6, z:   1.8, h: 7.2, leanX: -0.26, leanZ:  0.10, ry: 0.9 },
    { x:  18.2, z:  14.8, h: 7.8, leanX: -0.28, leanZ: -0.08, ry: 2.3 },
    { x:  16.4, z:  26.5, h: 6.8, leanX: -0.24, leanZ:  0.12, ry: 3.7 }
  ];
  for (let i = 0; i < pinePlacements.length; i++) {
    const tr = pinePlacements[i];
    const gy = evalExteriorGroundY(tr.x, tr.z) - 0.25;
    // Exposed clutching root spurs gripping the rocky slope
    for (let rt = 0; rt < 3; rt++) {
      const ra = tr.ry + (rt / 3) * Math.PI * 2;
      const rootSpur = new THREE.CylinderGeometry(0.08, 0.20, 1.35, 5);
      xformGeo(rootSpur, tr.x + Math.cos(ra) * 0.42, gy + 0.35, tr.z + Math.sin(ra) * 0.42, Math.sin(ra) * 0.72, ra, -Math.cos(ra) * 0.72);
      deadTreeParts.push(tintGeo(THREE, rootSpur, 0x3b3332, 0x181517));
    }
    // Lower gnarled trunk
    deadTreeParts.push(tintGeo(
      THREE,
      xformGeo(new THREE.CylinderGeometry(0.18, 0.38, tr.h * 0.56, 7), tr.x, gy + tr.h * 0.26, tr.z, tr.leanZ, tr.ry, -tr.leanX),
      0x403838, 0x18151a
    ));
    // Upper crooked trunk
    const midX = tr.x + Math.sin(tr.leanX) * tr.h * 0.45;
    const midY = gy + tr.h * 0.52;
    const midZ = tr.z + Math.sin(tr.leanZ) * tr.h * 0.45;
    deadTreeParts.push(tintGeo(
      THREE,
      xformGeo(new THREE.CylinderGeometry(0.055, 0.19, tr.h * 0.52, 6), midX, midY + tr.h * 0.22, midZ, tr.leanZ * 1.4, tr.ry + 0.5, -tr.leanX * 1.3),
      0x48424a, 0x201d24
    ));
    // 5 Primary wind-bent branches tucked naturally inside the pine canopy!
    for (let b = 0; b < 5; b++) {
      const ba = tr.ry + b * 1.32 + 0.35;
      const bh = midY + (b - 1.4) * tr.h * 0.11;
      const blen = 0.85 + (b % 2) * 0.42;
      const br = new THREE.CylinderGeometry(0.028, 0.078, blen, 5);
      xformGeo(br, midX + Math.cos(ba) * blen * 0.40, bh, midZ + Math.sin(ba) * blen * 0.40, Math.sin(ba) * 1.25, ba, Math.cos(ba) * 1.25);
      deadTreeParts.push(tintGeo(THREE, br, 0x48444e, 0x1f1d24));
    }
  }
  const deadTreeMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: barkPbr.albedo,
      normalMap: lowSpecMode ? null : barkPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: barkPbr.orm,
      roughness: 0.94,
      metalness: 0.03,
      envMapIntensity: 0.44,
      vertexColors: true,
      color: 0xb4b6c4
    })),
    barkPbr.normal
  );
  const deadTreesMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, deadTreeParts, { boxUvTile: 1.8, withColor: true })),
    deadTreeMat
  );
  exteriorGroup.add(deadTreesMesh);

  // 2) CURVED ARCHING MARSH SEDGE & BOG REED TUSSOCKS (Gracefully curved 3D blades in organic clumps — ZERO straight white toothpicks!)
  function buildCurvedReedBladeGeo(bw, bh, droopAmount, yaw) {
    const segs = 4;
    const pos = [];
    const uv = [];
    const idx = [];
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs; // 0 = root, 1 = curved tapered tip
      const halfW = bw * 0.5 * (1.0 - Math.pow(t, 1.35) * 0.92);
      // Graceful outward parabolic arch & natural gravity bend!
      const archOut = droopAmount * t * t * bh;
      const y = bh * (t - 0.22 * droopAmount * t * t * t);
      for (let side = -1; side <= 1; side += 2) {
        const lx = side * halfW;
        const lz = archOut;
        const wx = lx * cosY + lz * sinY;
        const wz = -lx * sinY + lz * cosY;
        pos.push(wx, y, wz);
        uv.push(side < 0 ? 0.0 : 1.0, t);
      }
    }
    for (let s = 0; s < segs; s++) {
      const a = s * 2;
      const b = s * 2 + 1;
      const c = (s + 1) * 2;
      const d = (s + 1) * 2 + 1;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const reedParts = [];
  const reedClusters = [
    [ 3.8,  1.2], [ 4.6,  3.9], [ 5.2,  7.8], [ 6.2, 11.4], [ 7.0, 15.6],
    [ 7.4, 20.2], [ 7.8, 25.0], [ 6.6, 28.4], [-4.8,  0.2], [-6.8,  4.2],
    [-7.6, 10.6], [-7.8, 16.5], [-7.4, 22.8], [-5.4, 27.6], [ 2.4, -2.6],
    [-2.9, -3.2], [ 4.8, 17.5], [-4.8, 12.2], [ 5.8,  5.6], [-6.2,  8.2]
  ];
  const bladesPerCluster = isMobile ? 7 : 12;
  for (let ci = 0; ci < reedClusters.length; ci++) {
    const [cx, cz] = reedClusters[ci];
    const baseGy = evalExteriorGroundY(cx, cz);
    for (let bi = 0; bi < bladesPerCluster; bi++) {
      const radialAng = (bi / bladesPerCluster) * Math.PI * 2 + (extRng() - 0.5) * 0.55;
      const rOff = 0.08 + extRng() * 0.58;
      const ox = cx + Math.cos(radialAng) * rOff;
      const oz = cz + Math.sin(radialAng) * rOff;
      const gy = evalExteriorGroundY(ox, oz);
      if (gy < WATER_LEVEL - 0.25) continue;
      const bh = 0.42 + extRng() * 0.68;
      const bw = 0.052 + extRng() * 0.038;
      const droop = 0.28 + extRng() * 0.48; // strong graceful outward curve in tussock bouquet!
      const blade = buildCurvedReedBladeGeo(bw, bh, droop, radialAng);
      xformGeo(blade, ox, Math.min(gy, baseGy + 0.15) - 0.05, oz);
      reedParts.push(blade);
    }
  }
  const reedMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float windPhase = uTime * 2.2 + wp.x * 0.55 + wp.z * 0.38;
        float gust = (sin(windPhase) * 0.12 + sin(windPhase * 2.3 + 1.1) * 0.045) * uv.y * uv.y;
        wp.x += gust;
        wp.z += gust * 0.52;
        wp.y -= abs(gust) * 0.18 * uv.y;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        // Dark nocturnal marsh-sedge palette (rich dark olive roots -> subtle muted moonlit reed tips, ZERO glowing white spikes!)
        vec3 rootCol = vec3(0.010, 0.015, 0.014);
        vec3 midCol  = vec3(0.026, 0.042, 0.036);
        vec3 tipCol  = vec3(0.068, 0.088, 0.086);
        vec3 col = mix(rootCol, midCol, smoothstep(0.0, 0.55, vUv.y));
        col = mix(col, tipCol, smoothstep(0.55, 1.0, vUv.y));
        // Subtle central blade rib shading
        float rib = 0.84 + 0.16 * (1.0 - abs(vUv.x - 0.5) * 2.0);
        gl_FragColor = vec4(col * rib, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide
  }));
  const reedsMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, reedParts)),
    reedMat
  );
  exteriorGroup.add(reedsMesh);

  // 3) Environmental Storytelling Wreckage: Broken Wooden Skiff Hull, Tattered Banners, Knight Shields & Rusted Spear!
  const wreckWoodParts = [];
  const wreckMetalParts = [];
  const bannerClothParts = [];

  // Half-buried Shattered Wooden Boat/Skiff Hull at (-6.2, 5.8) matching collider!
  const wgy = evalExteriorGroundY(-6.2, 5.8);
  // Curved central timber keel beam
  wreckWoodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.18, 0.16, 2.85), -6.2, wgy + 0.16, 5.8, 0.12, 0.55, 0.35), 0x48392e, 0x1d1612));
  // Exposed curved wooden boat ribs arching up out of the gravel
  for (let rib = -2; rib <= 2; rib++) {
    const rzOff = rib * 0.46;
    const wRib = 0.92 - Math.abs(rib) * 0.14;
    for (const sSide of [-1, 1]) {
      const plank = new THREE.BoxGeometry(0.11, 0.72, 0.16);
      xformGeo(
        plank,
        -6.2 + Math.cos(0.55) * (sSide * wRib * 0.45) + Math.sin(0.55) * rzOff,
        wgy + 0.34 + (sSide > 0 ? 0.14 : -0.02),
        5.8 - Math.sin(0.55) * (sSide * wRib * 0.45) + Math.cos(0.55) * rzOff,
        0.10, 0.55, sSide * -0.58 + 0.25
      );
      wreckWoodParts.push(tintGeo(THREE, plank, 0x544437, 0x221b16));
    }
  }
  // Splintered hull strake planks & broken oar resting beside the skiff
  for (let p = 0; p < 5; p++) {
    const plank = new THREE.BoxGeometry(0.22, 0.06, 1.55 + (p % 3) * 0.42);
    xformGeo(plank, -6.45 + (p - 2) * 0.26, wgy + 0.18 + Math.abs(p - 2) * 0.06, 5.95 + (p % 2) * 0.22, 0.22, 0.52 + (p - 2) * 0.10, (p - 2) * 0.18);
    wreckWoodParts.push(tintGeo(THREE, plank, 0x4e3f33, 0x201915));
  }
  // Scattered splintered castle beams washed onto the shoal
  const beamSpots = [
    [-3.4, -1.6, 1.6, 0.85],
    [ 4.2,  2.1, 1.4, -0.55],
    [ 4.9, 13.8, 1.9, 1.15],
    [-5.8, 19.6, 1.5, -0.92]
  ];
  for (let i = 0; i < beamSpots.length; i++) {
    const [bxp, bzp, blen, bry] = beamSpots[i];
    const gy = evalExteriorGroundY(bxp, bzp);
    wreckWoodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.18, 0.14, blen), bxp, gy + 0.05, bzp, 0.05, bry, 0.06), 0x4c3d32, 0x201a16));
  }

  // Two Leaning Snapped War-Banner Poles w/ Tattered Crimson Castle Pennants fluttering near path & wreckage!
  const bannerSpots = [
    { x: -6.8, z:  7.2, ry: 0.45, lean: 0.22 },
    { x:  5.4, z: 22.2, ry: -0.65, lean: -0.18 }
  ];
  for (let bi = 0; bi < bannerSpots.length; bi++) {
    const bs = bannerSpots[bi];
    const gy = evalExteriorGroundY(bs.x, bs.z);
    wreckWoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.036, 0.048, 2.95, 6), bs.x, gy + 1.35, bs.z, 0.10, bs.ry, bs.lean), 0x4a3c32, 0x1d1713));
    wreckMetalParts.push(xformGeo(new THREE.ConeGeometry(0.065, 0.24, 4), bs.x - Math.sin(bs.lean) * 1.45, gy + 2.82, bs.z + 0.14, 0.10, bs.ry, bs.lean));
    const cloth = new THREE.PlaneGeometry(0.68, 1.35, 3, 6);
    cloth.translate(0.36, -0.62, 0);
    xformGeo(cloth, bs.x - Math.sin(bs.lean) * 1.15, gy + 2.55, bs.z + 0.10, 0, bs.ry, bs.lean * 0.4);
    bannerClothParts.push(cloth);
  }

  // Dented abandoned knight kite shields & rusted broken spear half-submerged along the bank
  const shieldSpots = [
    [-4.1, 3.6, 0.45],
    [ 4.6, 8.8, -0.82],
    [-4.8, 21.4, 1.25]
  ];
  for (let i = 0; i < shieldSpots.length; i++) {
    const [shx, shz, shry] = shieldSpots[i];
    const gy = evalExteriorGroundY(shx, shz);
    wreckMetalParts.push(xformGeo(new THREE.CylinderGeometry(0.38, 0.34, 0.06, 7), shx, gy + 0.06, shz, 0.28, shry, 0.22));
    wreckMetalParts.push(xformGeo(new THREE.SphereGeometry(0.10, 6, 5), shx, gy + 0.11, shz));
  }
  const spGy = evalExteriorGroundY(-5.4, 6.5);
  wreckWoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.028, 0.032, 1.85, 6), -5.4, spGy + 0.72, 6.5, 0.35, 0.4, -0.45), 0x45372d, 0x1e1814));
  wreckMetalParts.push(xformGeo(new THREE.ConeGeometry(0.055, 0.32, 4), -5.06, spGy + 1.54, 6.76, 0.35, 0.4, -0.45));

  const wreckWoodMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, wreckWoodParts, { boxUvTile: 1.5, withColor: true })),
    deadTreeMat
  );
  exteriorGroup.add(wreckWoodMesh);
  const wreckMetalMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, wreckMetalParts, { boxUvTile: 1.0 })),
    rustedGrateMat
  );
  exteriorGroup.add(wreckMetalMesh);

  // Tattered Crimson Banners fluttering gently in coastal wind
  const bannerClothMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uMap: { value: carpetTex } },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        float flap = sin(uTime * 3.4 + uv.x * 5.0 - uv.y * 4.0) * 0.11 * uv.x;
        p.z += flap;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        // Ragged torn pennant bottom fringe
        float tear = 0.18 * sin(vUv.x * 19.0) + 0.10 * cos(vUv.x * 31.0);
        if (vUv.y < 0.16 + tear) discard;
        vec3 c = texture2D(uMap, vUv).rgb * 0.62;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide
  }));
  const bannerClothMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, bannerClothParts)),
    bannerClothMat
  );
  exteriorGroup.add(bannerClothMesh);

  // --------------------------------------------------------------------------
  // C8b. z96 AAA STARTING LOCATION OVERHAUL — Architectural Landmarks, Lanterns,
  //      Wooden River Jetty, Ruined Gothic Archway, Cemetery of Ash Tombs,
  //      Carved Runic Waystone, Full Pine Canopies, Fireflies & Smashable Barrels!
  //      (ZERO extra PointLights -> ZERO shader-compile hitches, 150+ FPS!)
  // --------------------------------------------------------------------------
  const z96StoneParts = [];
  const z96WoodParts = [];
  const z96IronParts = [];
  const z96FoliageParts = [];
  const z96LanternGlowParts = [];
  const z96LanternHalos = [];

  // Shared helper: Forged-Iron Wrought Lantern Cage + Warm Glowing Glass Core + Additive Halo + Ground Pool
  function addWroughtLantern(lx, ly, lz, { withPost = true, postHeight = 3.0, leanZ = 0.06, yaw = 0, poolR = 3.5, poolStr = 0.38 } = {}) {
    const gY = evalExteriorGroundY(lx, lz);
    let lampX = lx, lampY = ly, lampZ = lz;
    if (withPost) {
      // Stepped carved stone footing + forged iron lamp pole + curved gooseneck arm
      z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.22, 0.30, 0.34, 6), lx, gY + 0.14, lz), 0x8b9ab8, 0x3b4458));
      z96IronParts.push(xformGeo(new THREE.CylinderGeometry(0.042, 0.062, postHeight, 6), lx, gY + postHeight * 0.5, lz, leanZ, yaw, 0));
      // Decorative wrought-iron scroll collar + horizontal bracket arm jutting toward road!
      const armDirX = Math.sin(yaw);
      const armDirZ = Math.cos(yaw);
      const topY = gY + postHeight;
      z96IronParts.push(xformGeo(new THREE.BoxGeometry(0.06, 0.06, 0.72), lx + armDirX * 0.34, topY - 0.10, lz + armDirZ * 0.34, 0, yaw, 0));
      z96IronParts.push(xformGeo(new THREE.BoxGeometry(0.045, 0.045, 0.56), lx + armDirX * 0.22, topY - 0.34, lz + armDirZ * 0.22, -0.68, yaw, 0));
      z96IronParts.push(xformGeo(new THREE.ConeGeometry(0.075, 0.24, 4), lx, topY + 0.14, lz));
      lampX = lx + armDirX * 0.64;
      lampY = topY - 0.34;
      lampZ = lz + armDirZ * 0.64;
    }
    // Wrought-iron lantern cap, bottom saucer & 4 cage bars
    z96IronParts.push(xformGeo(new THREE.ConeGeometry(0.16, 0.14, 6), lampX, lampY + 0.22, lampZ));
    z96IronParts.push(xformGeo(new THREE.CylinderGeometry(0.14, 0.10, 0.06, 6), lampX, lampY - 0.14, lampZ));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      z96IronParts.push(xformGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.30, 4), lampX + Math.cos(a) * 0.11, lampY + 0.04, lampZ + Math.sin(a) * 0.11));
    }
    // Warm amber glowing glass core
    z96LanternGlowParts.push(xformGeo(new THREE.CylinderGeometry(0.095, 0.078, 0.24, 6), lampX, lampY + 0.04, lampZ));
    z96LanternHalos.push({ x: lampX, y: lampY + 0.04, z: lampZ, size: 1.55 });
    // Flickering warm firelight pool on the ground directly below!
    if (poolR > 0.2) {
      addWarmGroundPool(lampX, lampZ, poolR, [1.05, 0.54, 0.14], poolStr, alwaysOneUniform, lx * 0.9 + lz * 0.7);
    }
  }

  // 1) GREAT CLUB FALLEN HUNTER'S DRIFTWOOD & STORM-LANTERN CAMP at swordPos (2.8, 5.2)!
  //    Makes the Great Club's resting spot an unforgettable, warm-lit visual focal point right from wakePos!
  {
    const cx = EXTERIOR_SHORE_ANCHORS.swordPos.x;
    const cz = EXTERIOR_SHORE_ANCHORS.swordPos.z;
    const cgy = evalExteriorGroundY(cx, cz);
    // Bleached gnarled driftwood timber log bracing the mossy stone mound behind the Great Club
    z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.13, 0.20, 2.35, 7), cx + 0.48, cgy + 0.14, cz + 0.32, 0.18, 0.72, 1.38), 0x6b5a4a, 0x2b231d));
    z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.07, 0.12, 1.15, 6), cx + 0.85, cgy + 0.36, cz + 0.65, -0.35, 0.9, 1.05), 0x746252, 0x312822));
    // Crooked weathered timber lantern stake & glowing storm-lantern bathing the Great Club in golden light!
    z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.045, 0.065, 1.82, 6), cx + 0.85, cgy + 0.86, cz - 0.55, 0.08, 0, -0.14), 0x5c4b3d, 0x261e18));
    z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.55, 0.055, 0.055), cx + 0.58, cgy + 1.62, cz - 0.52, 0, 0.15, 0.08), 0x5c4b3d, 0x261e18));
    addWroughtLantern(cx + 0.36, cgy + 1.36, cz - 0.48, { withPost: false, poolR: 4.1, poolStr: 0.42 });
    // Half-buried dented knight helm & mossy cairn rocks framing the club camp
    z96IronParts.push(xformGeo(new THREE.SphereGeometry(0.17, 7, 6), cx - 0.75, cgy + 0.12, cz + 0.62));
    z96StoneParts.push(tintGeo(THREE, xformGeo(buildSculptedRockGeo(THREE, 0.44, 961, 0.62, 1), cx + 0.72, cgy + 0.18, cz + 0.55), 0x76869c, 0x313a4b));
    z96StoneParts.push(tintGeo(THREE, xformGeo(buildSculptedRockGeo(THREE, 0.32, 962, 0.54, 1), cx - 0.68, cgy + 0.10, cz - 0.48), 0x6a7f6c, 0x2a352f));
  }

  // 2) COLLAPSED PILGRIM ARCHWAY at z = 10.6 (old LEGO box-arch + chains removed; sculpted Blender archway mounts in soulsGorgeRoad.js!)

  // 3) WEATHERED WOODEN RIVER JETTY / FERRYMAN'S PIER jutting over the dark moonlit river (x = 5.4..9.0, z = 8.4..11.4)!
  {
    const pierZ = 9.9;
    const deckY = WATER_LEVEL + 0.62;
    // 6 thick weathered oak pilings driven into river bed + horizontal stringer beams
    for (let px = 5.5; px <= 8.8; px += 1.65) {
      for (const pzOff of [-1.25, 1.25]) {
        const postH = px > 8.0 ? 2.45 : 1.95;
        z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.13, 0.16, postH, 7), px, deckY - 0.55 + postH * 0.35, pierZ + pzOff, 0.03 * Math.sign(pzOff), 0, -0.03), 0x5c4c3f, 0x201914));
      }
    }
    for (const pzOff of [-1.05, 0.0, 1.05]) {
      z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(4.1, 0.14, 0.16), 7.1, deckY - 0.08, pierZ + pzOff), 0x4f4034, 0x1e1712));
    }
    // 14 slightly uneven, cracked, mossy weathered oak deck planks (gap near broken outer end!)
    for (let pi = 0; pi < 14; pi++) {
      if (pi === 11) continue;
      const px = 5.2 + pi * 0.285;
      const pLen = 2.65 + ((pi * 37) % 10) * 0.03;
      const tilt = ((pi % 3) - 1) * 0.025;
      z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.24, 0.065, pLen), px, deckY + tilt * 0.4, pierZ + ((pi % 2) - 0.5) * 0.06, tilt, ((pi % 5) - 2) * 0.015, tilt), pi % 4 === 0 ? 0x6f826a : 0xa1805d, 0x4a392a));
    }
    // Tall hanging Ferryman Pier Lantern on the end piling — casts warm amber shimmer onto the black river!
    z96WoodParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.05, 0.07, 2.35, 6), 8.65, deckY + 1.15, pierZ - 1.25), 0x8a6d52, 0x3b2d21));
    z96IronParts.push(xformGeo(new THREE.BoxGeometry(0.65, 0.05, 0.05), 8.38, deckY + 2.18, pierZ - 1.25));
    addWroughtLantern(8.12, deckY + 1.94, pierZ - 1.25, { withPost: false, poolR: 0, poolStr: 0 });
    addWarmGroundPool(4.65, pierZ, 2.35, [1.05, 0.56, 0.16], 0.30, alwaysOneUniform, 3.1);
  }

  // 4) CEMETERY OF ASH ROADSIDE TOMBSTONES, LEANING STONE CROSSES & CARVED RUNIC WAYSTONE MONOLITH (-5.0, 16.4)!
  {
    const tombSpecs = [
      [-6.4, 12.2, 0.85, 0.42,  0.14,  0.18, false],
      [-7.8, 13.4, 1.25, 0.48, -0.08, -0.15, true],
      [-6.8, 14.8, 0.96, 0.44,  0.10,  0.22, false],
      [-8.4, 15.6, 1.42, 0.52, -0.12, -0.10, true],
      [-6.6, 17.8, 1.05, 0.46,  0.08,  0.16, false],
      [-8.1, 19.2, 1.32, 0.44, -0.14, -0.18, true],
      [-6.2, 20.4, 0.78, 0.40,  0.18,  0.12, false],
      [-7.6, 22.0, 1.18, 0.48, -0.06,  0.24, false],
      [-6.5, 23.6, 1.38, 0.46,  0.11, -0.14, true],
      [-8.2, 24.4, 0.92, 0.44, -0.15,  0.10, false],
      [ 4.9, 16.4, 1.08, 0.45,  0.12, -0.20, false],
      [ 5.6, 18.2, 1.36, 0.46, -0.08, -0.12, true],
      [ 5.2, 20.4, 0.94, 0.42,  0.14, -0.18, false],
      [-5.8,  8.6, 1.12, 0.46,  0.08,  0.28, true]
    ];
    for (let i = 0; i < tombSpecs.length; i++) {
      const [tx, tz, th, tw, leanX, yaw, isCross] = tombSpecs[i];
      const tgy = evalExteriorGroundY(tx, tz);
      if (isCross) {
        // Ancient weathered Gothic stone cross
        z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(tw * 0.42, th, 0.18), tx, tgy + th * 0.46, tz, leanX, yaw, (i % 2 ? 0.08 : -0.08)), 0x8e9db8, 0x3b4458));
        z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(tw * 1.45, tw * 0.36, 0.17), tx, tgy + th * 0.68, tz, leanX, yaw, (i % 2 ? 0.08 : -0.08)), 0x94a3be, 0x414a5e));
      } else {
        // Arched weathered tombstone slab + moss-rimmed base
        z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(tw, th, 0.16), tx, tgy + th * 0.45, tz, leanX, yaw, (i % 2 ? -0.06 : 0.06)), i % 3 === 0 ? 0x7b9384 : 0x8b9ab5, 0x394254));
        z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(tw * 0.48, tw * 0.48, 0.16, 8), tx, tgy + th * 0.90, tz, Math.PI * 0.5, yaw, 0), 0x92a1bc, 0x404a5e));
      }
      // Small glowing pilgrim vigil candle perched beside every 4th tombstone!
      if (i % 4 === 0) {
        z96LanternGlowParts.push(xformGeo(new THREE.CylinderGeometry(0.032, 0.038, 0.12, 5), tx + 0.28, tgy + 0.08, tz + 0.24));
        z96LanternHalos.push({ x: tx + 0.28, y: tgy + 0.16, z: tz + 0.24, size: 0.52 });
      }
    }

    // CARVED RUNIC WAYSTONE MONOLITH at (-5.0, 16.4) beside Shore Bonfire (Interactive [E] Lore Tablet!)
    const mx = EXTERIOR_SHORE_ANCHORS.monolithPos.x;
    const mz = EXTERIOR_SHORE_ANCHORS.monolithPos.z;
    const mgy = evalExteriorGroundY(mx, mz);
    z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.76, 0.92, 0.28, 8), mx, mgy + 0.12, mz), 0x8b9ab8, 0x3b4458));
    z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.86, 2.35, 0.42), mx, mgy + 1.32, mz, 0.04, 0.65, -0.04), 0x97a7c6, 0x434d64));
    z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.ConeGeometry(0.56, 0.68, 4), mx, mgy + 2.80, mz, 0.04, 0.65 + Math.PI * 0.25, -0.04), 0xa1b1d0, 0x4c5770));
    // Cool glacial moon-blue carved runic glyph bars facing the bonfire/path (contrasts with warm amber bonfire!)
    const runeGlyphMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x76baff }));
    const runeGlyphParts = [
      xformGeo(new THREE.BoxGeometry(0.06, 0.64, 0.04), mx + 0.17, mgy + 1.48, mz + 0.15, 0.04, 0.65, -0.04),
      xformGeo(new THREE.BoxGeometry(0.28, 0.05, 0.04), mx + 0.17, mgy + 1.66, mz + 0.15, 0.04, 0.65, -0.04),
      xformGeo(new THREE.BoxGeometry(0.22, 0.05, 0.04), mx + 0.17, mgy + 1.44, mz + 0.15, 0.04, 0.65, -0.04),
      xformGeo(new THREE.BoxGeometry(0.16, 0.05, 0.04), mx + 0.17, mgy + 1.24, mz + 0.15, 0.04, 0.65, -0.04)
    ];
    exteriorGroup.add(new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, runeGlyphParts)), runeGlyphMat));
    addWarmGroundPool(mx, mz, 2.2, [0.36, 0.68, 1.15], 0.22, alwaysOneUniform, 5.5);
  }

  // 5) HALF-SUNKEN BROKEN GOTHIC WATCHTOWER SPIRE JUTTING OUT OF THE DARK RIVER (x = 12.8, z = 16.8)!
  {
    const tx = 12.8, tz = 16.8;
    const ty = WATER_LEVEL - 1.35;
    z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.48, 1.78, 7.2, 10), tx, ty + 2.65, tz, 0.14, 0.4, -0.30), 0x7e8ea8, 0x2c3547));
    z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(1.68, 1.56, 0.55, 10), tx + 0.88, ty + 5.75, tz + 0.36, 0.14, 0.4, -0.30), 0x8c9cb8, 0x3b455a));
    // Broken jagged crenellations around top rim
    for (let mi = 0; mi < 5; mi++) {
      if (mi === 2) continue;
      const ma = (mi / 5) * Math.PI * 2 + 0.3;
      z96StoneParts.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.55, 0.85, 0.45), tx + 1.00 + Math.cos(ma) * 1.35, ty + 6.22, tz + 0.40 + Math.sin(ma) * 1.35, 0.14, ma, -0.30), 0x92a2be, 0x3f495f));
    }
  }

  // 6) FOUR WROUGHT-IRON COASTAL PILGRIM LANTERN POSTS LINING THE ROAD FROM LANDING -> BONFIRE -> GATE!
  addWroughtLantern(-3.6, 0,  8.2, { withPost: true, postHeight: 2.95, leanZ:  0.05, yaw:  1.25, poolR: 3.6, poolStr: 0.36 });
  addWroughtLantern( 3.2, 0, 13.8, { withPost: true, postHeight: 3.05, leanZ: -0.04, yaw: -1.35, poolR: 3.6, poolStr: 0.36 });
  addWroughtLantern(-4.4, 0, 21.6, { withPost: true, postHeight: 2.90, leanZ:  0.06, yaw:  1.18, poolR: 3.6, poolStr: 0.36 });
  addWroughtLantern( 3.4, 0, 24.4, { withPost: true, postHeight: 3.10, leanZ: -0.05, yaw: -1.42, poolR: 3.6, poolStr: 0.36 });

  // 7) BROODING DARK-SOULS MULTI-BOUGH WIND-SWEPT PINE CANOPIES (ZERO toy cones — jagged drooping needle fronds!)
  for (let i = 0; i < pinePlacements.length; i++) {
    const tr = pinePlacements[i];
    const gy = evalExteriorGroundY(tr.x, tr.z) - 0.25;
    const midX = tr.x + Math.sin(tr.leanX) * tr.h * 0.45;
    const midY = gy + tr.h * 0.52;
    const midZ = tr.z + Math.sin(tr.leanZ) * tr.h * 0.45;
    const tiers = [
      { yOff: -0.35, boughs: 7, len: 2.35, w: 0.72, droop: 0.44, topC: 0x1b302a, botC: 0x0a1311 },
      { yOff:  0.85, boughs: 7, len: 1.95, w: 0.62, droop: 0.40, topC: 0x203831, botC: 0x0c1714 },
      { yOff:  1.95, boughs: 6, len: 1.48, w: 0.50, droop: 0.34, topC: 0x254038, botC: 0x0f1c18 },
      { yOff:  2.95, boughs: 5, len: 0.96, w: 0.38, droop: 0.26, topC: 0x2c4a41, botC: 0x13221e }
    ];
    for (let ti = 0; ti < tiers.length; ti++) {
      const td = tiers[ti];
      const ox = midX + Math.sin(tr.leanX) * td.yOff * 0.45;
      const oz = midZ + Math.sin(tr.leanZ) * td.yOff * 0.45;
      for (let bi = 0; bi < td.boughs; bi++) {
        const ang = tr.ry + ti * 0.65 + (bi / td.boughs) * Math.PI * 2 + Math.sin(i * 3.1 + bi * 2.3) * 0.22;
        const bLen = td.len * (0.82 + 0.32 * Math.abs(Math.sin(bi * 2.1 + i * 1.7)));
        const bW = td.w * (0.85 + 0.25 * Math.abs(Math.cos(bi * 1.7 + ti)));
        // Tapered flattened drooping pine bough frond radiating outward from the crooked trunk!
        const bough = new THREE.ConeGeometry(bW, bLen, 5, 1);
        bough.scale(1.0, 1.0, 0.36);
        bough.rotateX(Math.PI * 0.5 + td.droop);
        bough.rotateY(ang);
        const cx = ox + Math.sin(ang) * bLen * 0.46;
        const cy = midY + td.yOff - Math.sin(td.droop) * bLen * 0.30;
        const cz = oz + Math.cos(ang) * bLen * 0.46;
        bough.translate(cx, cy, cz);
        z96FoliageParts.push(tintGeo(THREE, bough, td.topC, td.botC));
      }
    }
    // Wind-swept ragged pine crown spire tip
    const topCrown = new THREE.ConeGeometry(0.46, 1.35, 5);
    topCrown.scale(1.0, 1.0, 0.72);
    xformGeo(topCrown, midX + Math.sin(tr.leanX) * 1.65, midY + 3.65, midZ + Math.sin(tr.leanZ) * 1.65, tr.leanZ * 0.7, tr.ry, -tr.leanX * 0.7);
    z96FoliageParts.push(tintGeo(THREE, topCrown, 0x2c4b42, 0x111f1b));
  }
  // Organic arching coastal fern bushes (smoothly curved botanical blades — ZERO spiky low-poly shards!)
  const fernSpots = [
    [-5.2, 2.4], [-7.4, 7.6], [-5.2, 11.4], [4.5, 11.4], [-6.0, 15.8],
    [-6.2, 19.6], [4.6, 15.2], [5.4, 21.6], [-4.8, 25.4], [4.8, 25.8],
    [1.8, 6.2], [3.8, 4.4], [-3.8, 14.2], [-0.8, 16.2]
  ];
  for (let fi = 0; fi < fernSpots.length; fi++) {
    const [fx, fz] = fernSpots[fi];
    const fgy = evalExteriorGroundY(fx, fz);
    for (let fr = 0; fr < 7; fr++) {
      const fa = (fr / 7) * Math.PI * 2 + fi * 0.73;
      const fBlade = buildCurvedReedBladeGeo(0.14 + (fr % 2) * 0.04, 0.56 + (fr % 3) * 0.11, 0.44, fa);
      fBlade.translate(fx + Math.cos(fa) * 0.08, fgy - 0.02, fz + Math.sin(fa) * 0.08);
      z96FoliageParts.push(tintGeo(THREE, fBlade, 0x2b4b38, 0x101f17));
    }
  }

  // Dedicated warm weathered oak PBR material for Ferryman's Pier, Driftwood Camp & Smashable Barrels/Crates!
  const warmOakMat = regNormalMat(
    trackMat(new THREE.MeshStandardMaterial({
      map: barkPbr.albedo,
      normalMap: lowSpecMode ? null : barkPbr.normal,
      normalScale: new THREE.Vector2(0.88, 0.88),
      roughnessMap: barkPbr.orm,
      roughness: 0.85,
      metalness: 0.05,
      envMapIntensity: 0.44,
      vertexColors: true,
      color: 0xe6d2b6
    })),
    barkPbr.normal
  );

  // Merge static z96 architectural & foliage layers into just 4 batched meshes (ultra-fast draw count!)
  const z96StoneMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, z96StoneParts, { boxUvTile: 2.2, withColor: true })), extAshlarMat);
  z96StoneMesh.receiveShadow = true;
  exteriorGroup.add(z96StoneMesh);

  const z96WoodMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, z96WoodParts, { boxUvTile: 1.5, withColor: true })), warmOakMat);
  z96WoodMesh.receiveShadow = true;
  exteriorGroup.add(z96WoodMesh);

  const z96IronMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, z96IronParts, { boxUvTile: 1.2 })), rustedGrateMat);
  exteriorGroup.add(z96IronMesh);

  const z96FoliageMat = trackMat(new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xaec4bc,
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.44,
    side: THREE.DoubleSide
  }));
  const z96FoliageMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, z96FoliageParts, { withColor: true })), z96FoliageMat);
  exteriorGroup.add(z96FoliageMesh);

  // Glowing Amber Glass Lantern Cores & Soft Additive Lantern Halos
  const lanternCoreMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xffb44c }));
  const z96LanternGlowMesh = new THREE.Mesh(trackGeo(mergeNonIndexedGeos(THREE, z96LanternGlowParts)), lanternCoreMat);
  exteriorGroup.add(z96LanternGlowMesh);

  const lanternHaloMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float d = length(vUv * 2.0 - 1.0);
        if (d > 1.0) discard;
        float flick = 0.90 + 0.10 * sin(uTime * 5.8);
        float g = exp(-d * d * 4.8) * (1.0 - smoothstep(0.65, 1.0, d));
        vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.5, 0.96, 0.44), exp(-d * d * 7.5));
        gl_FragColor = vec4(col * flick, g * 0.62);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  for (let hi = 0; hi < z96LanternHalos.length; hi++) {
    const h = z96LanternHalos[hi];
    const hm = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(h.size, h.size)), lanternHaloMat);
    hm.position.set(h.x, h.y, h.z);
    hm.renderOrder = 4;
    exteriorGroup.add(hm);
  }

  // 8) DRIFTING NOCTURNAL RIVER FIREFLIES / WILLOW WISPS (soft bioluminescent golden-cyan motes along full gorge!)
  const FIREFLY_COUNT = isMobile ? 48 : 112;
  const ffPos = new Float32Array(FIREFLY_COUNT * 3);
  const ffSeed = new Float32Array(FIREFLY_COUNT * 3);
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const fz = -2.0 + extRng() * 124.0;
    const fx = getPathCenterX(fz) - 4.0 + extRng() * 15.0;
    ffPos[i * 3]     = fx;
    ffPos[i * 3 + 1] = Math.max(WATER_LEVEL + 0.45, evalExteriorGroundY(fx, fz) + 0.55) + extRng() * 2.1;
    ffPos[i * 3 + 2] = fz;
    ffSeed[i * 3]     = extRng();
    ffSeed[i * 3 + 1] = 0.5 + extRng() * 1.1;
    ffSeed[i * 3 + 2] = extRng();
  }
  const fireflyGeo = trackGeo(new THREE.BufferGeometry());
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  fireflyGeo.setAttribute('aSeed', new THREE.BufferAttribute(ffSeed, 3));
  const fireflyMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vPulse;
      varying float vHue;
      void main() {
        vec3 p = position;
        float t = uTime * (0.45 + aSeed.y * 0.45) + aSeed.x * 24.0;
        p.x += sin(t * 1.1 + aSeed.z * 6.28) * 0.65;
        p.y += sin(t * 1.7 + aSeed.x * 12.0) * 0.35;
        p.z += cos(t * 0.9 - aSeed.z * 6.28) * 0.65;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(85.0 / max(1.5, -mv.z), 3.0, 14.0);
        vPulse = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (2.2 + aSeed.y * 2.0) + aSeed.x * 30.0), 2.2);
        vHue = aSeed.z;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vPulse;
      varying float vHue;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vPulse * 0.85;
        if (a < 0.01) discard;
        vec3 col = mix(vec3(1.55, 1.12, 0.38), vec3(0.65, 1.25, 1.55), step(0.68, vHue));
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const fireflyPoints = new THREE.Points(fireflyGeo, fireflyMat);
  fireflyPoints.renderOrder = 5;
  exteriorGroup.add(fireflyPoints);

  // 9) INTERACTIVE SMASHABLE WOODEN BARRELS & CARGO CRATES (Smash them to splinters with your new Great Club!)
  const destructibleSpecs = [
    { x:  4.55, z:  8.55, kind: 'barrel' },
    { x:  4.95, z:  9.35, kind: 'crate'  },
    { x:  4.65, z: 11.20, kind: 'barrel' },
    { x: -4.95, z:  6.35, kind: 'crate'  },
    { x: -4.45, z:  7.25, kind: 'barrel' },
    { x: -3.25, z: 11.75, kind: 'barrel' },
    { x:  2.95, z: 11.55, kind: 'crate'  },
    { x: -3.75, z: 13.75, kind: 'barrel' },
    { x:  4.85, z: 26.85, kind: 'crate'  },
    { x: -5.15, z: 27.15, kind: 'barrel' }
  ];
  const barrelBaseGeo = trackGeo((() => {
    const p = [];
    p.push(tintGeo(THREE, xformGeo(new THREE.CylinderGeometry(0.32, 0.29, 0.86, 10), 0, 0.43, 0), 0xb48a5f, 0x5c432d));
    p.push(tintGeo(THREE, xformGeo(new THREE.TorusGeometry(0.325, 0.024, 5, 12), 0, 0.22, 0, Math.PI * 0.5, 0, 0), 0x8692a4, 0x454e5d));
    p.push(tintGeo(THREE, xformGeo(new THREE.TorusGeometry(0.335, 0.024, 5, 12), 0, 0.64, 0, Math.PI * 0.5, 0, 0), 0x8692a4, 0x454e5d));
    return mergeNonIndexedGeos(THREE, p, { boxUvTile: 1.2, withColor: true });
  })());
  const crateBaseGeo = trackGeo((() => {
    const p = [];
    p.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.76, 0.72, 0.76), 0, 0.36, 0), 0xac845b, 0x563f2a));
    p.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.82, 0.09, 0.82), 0, 0.06, 0), 0x826345, 0x423020));
    p.push(tintGeo(THREE, xformGeo(new THREE.BoxGeometry(0.82, 0.09, 0.82), 0, 0.66, 0), 0x826345, 0x423020));
    return mergeNonIndexedGeos(THREE, p, { boxUvTile: 1.2, withColor: true });
  })());
  const splinterGeo = trackGeo(
    tintGeo(THREE, new THREE.BoxGeometry(0.11, 0.05, 0.46), 0xc2986b, 0x624830)
  );

  const destructibleProps = [];
  const activeSplinters = [];
  for (let di = 0; di < destructibleSpecs.length; di++) {
    const ds = destructibleSpecs[di];
    const gy = evalExteriorGroundY(ds.x, ds.z);
    const mesh = new THREE.Mesh(ds.kind === 'barrel' ? barrelBaseGeo : crateBaseGeo, warmOakMat);
    mesh.position.set(ds.x, gy - 0.02, ds.z);
    mesh.rotation.y = (di * 1.13) % 6.28;
    mesh.receiveShadow = true;
    exteriorGroup.add(mesh);
    destructibleProps.push({ x: ds.x, y: gy, z: ds.z, r: 0.52, broken: false, mesh });
  }

  function spawnWoodSplinters(ox, oy, oz) {
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + Math.random() * 0.6;
      const spd = 2.4 + Math.random() * 2.8;
      const m = new THREE.Mesh(splinterGeo, warmOakMat);
      m.position.set(ox + Math.cos(ang) * 0.14, oy + 0.38, oz + Math.sin(ang) * 0.14);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      exteriorGroup.add(m);
      activeSplinters.push({
        mesh: m,
        vx: Math.cos(ang) * spd,
        vy: 3.0 + Math.random() * 2.4,
        vz: Math.sin(ang) * spd,
        rx: (Math.random() - 0.5) * 11,
        ry: (Math.random() - 0.5) * 11,
        age: 0,
        maxAge: 2.2
      });
    }
  }

  function hitDestructibles(hx, hz, radius = 1.65) {
    if (stageMode !== 'exterior_shore') return { count: 0, hits: [] };
    const hits = [];
    for (let i = 0; i < destructibleProps.length; i++) {
      const p = destructibleProps[i];
      if (p.broken) continue;
      if (Math.hypot(p.x - hx, p.z - hz) <= radius + p.r) {
        p.broken = true;
        p.mesh.visible = false;
        spawnWoodSplinters(p.x, p.y, p.z);
        hits.push({ x: p.x, y: p.y + 0.4, z: p.z });
      }
    }
    return { count: hits.length, hits };
  }

  function resetDestructibles() {
    for (let i = 0; i < destructibleProps.length; i++) {
      destructibleProps[i].broken = false;
      destructibleProps[i].mesh.visible = true;
    }
    for (let i = activeSplinters.length - 1; i >= 0; i--) {
      exteriorGroup.remove(activeSplinters[i].mesh);
    }
    activeSplinters.length = 0;
  }

  // --------------------------------------------------------------------------
  // C8c. EXTENDED DARK SOULS / BLOODBORNE RIVERSIDE GORGE LOCATION (z = 31 .. 132m)
  //      Real Blender 4.5.9 GLB kits + 1024px PBR + Botanical Foliage + Multi-Elevation Architecture!
  // --------------------------------------------------------------------------
  const gorgeRoadCtrl = createSoulsGorgeRoad(THREE, {
    parentGroup: exteriorGroup,
    gltfLoader: opts?.gltfLoader || null,
    pbrTex: gorgePbrTex,
    isMobile,
    lowSpecMode,
    anisotropy,
    trackGeo,
    trackMat,
    trackTex,
    regNormalMat,
    xformGeo,
    tintGeo,
    mergeNonIndexedGeos,
    createFlameAssemblyMesh,
    addWarmGroundPool,
    alwaysOneUniform,
    uTimeUniform: extSkyUniforms.uTime,
    mistSpriteTex,
    rustedGrateMat,
    destructibleProps
  });

  // C8d. FULL 8-SECTOR «РЕЧНОЙ ПРЕДЕЛ» WORLD EXPANSION (Sectors 01-05 East + Sectors 06-08 North)
  const riverReachEastCtrl = createSoulsRiverReachEast(THREE, {
    parentGroup: exteriorGroup,
    gltfLoader: opts?.gltfLoader || null,
    pbrTex: gorgePbrTex,
    terrainMat: shoreTerrainMat,
    riverMat: extRiverMat,
    campfireRig: gorgeRoadCtrl?.campfireRig || null,
    isMobile,
    lowSpecMode,
    trackGeo,
    trackMat,
    regNormalMat,
    xformGeo,
    tintGeo,
    mergeNonIndexedGeos,
    uTimeUniform: extSkyUniforms.uTime,
    mistSpriteTex,
    evalTerrainY: evalRiverReachBaseTerrainY
  });

  const riverReachNorthCtrl = createSoulsRiverReachNorth(THREE, {
    parentGroup: exteriorGroup,
    gltfLoader: opts?.gltfLoader || null,
    pbrTex: gorgePbrTex,
    terrainMat: shoreTerrainMat,
    campfireRig: gorgeRoadCtrl?.campfireRig || null,
    isMobile,
    lowSpecMode,
    trackGeo,
    trackMat,
    regNormalMat,
    xformGeo,
    tintGeo,
    mergeNonIndexedGeos,
    uTimeUniform: extSkyUniforms.uTime,
    mistSpriteTex,
    evalTerrainY: evalRiverReachBaseTerrainY
  });

  // Layered Nocturnal Blue-Slate Valley Mist Rig (River Sheets + Depth Curtains + Road Wisps, z103)
  const valleyMistRig = createValleyMistRig(THREE, {
    parentGroup: exteriorGroup,
    uTimeUniform: extSkyUniforms.uTime,
    mistSpriteTex,
    isMobile,
    lowSpecMode,
    trackGeo,
    trackMat,
    evalGroundY: evalBaseTerrainY
  });
  valleyMistRig.group?.traverse((child) => {
    if (child.isMesh && child.material?.uniforms?.uFogColor?.value) {
      child.material.uniforms.uFogColor.value.setHex(0x1a2a40);
    }
  });

  // --------------------------------------------------------------------------
  // C9. Rolling Volumetric Coastal Ground Mist Sheets + Waterfall Spray + Falling Ash Flakes!
  // --------------------------------------------------------------------------
  // 1) Rolling Low-Lying Volumetric Mist Ribbons creeping over the black river & damp coastal pebbles!
  const rollingMistMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.53);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      void main() {
        vec2 d = vUv * 2.0 - 1.0;
        float oval = 1.0 - smoothstep(0.35, 1.0, length(d));
        if (oval < 0.01) discard;
        float n1 = vnoise(vUv * 4.2 + vec2(uTime * 0.08, -uTime * 0.06));
        float n2 = vnoise(vUv * 8.4 - vec2(uTime * 0.11, uTime * 0.05));
        float wisp = smoothstep(0.30, 0.80, n1 * 0.62 + n2 * 0.38);
        float a = oval * wisp * 0.22;
        if (a < 0.005) discard;
        vec3 col = mix(vec3(0.24, 0.34, 0.50), vec3(0.46, 0.58, 0.78), wisp);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide
  }));
  const rollingMistParts = [];
  const mistSheetSpecs = [
    { x:  0.4, y: 0.55, z: -10.2, w: 12.5, h:  9.5, rx: -Math.PI * 0.5, ry: 0.0 },
    { x:  5.8, y: 0.42, z:  -1.5, w: 15.0, h: 12.0, rx: -Math.PI * 0.5, ry: 0.2 },
    { x:  9.8, y: 0.48, z:  10.5, w: 15.5, h: 14.0, rx: -Math.PI * 0.5, ry: -0.15 },
    { x:  9.5, y: 0.52, z:  22.5, w: 16.0, h: 14.0, rx: -Math.PI * 0.5, ry: 0.12 },
    { x: -3.2, y: 0.68, z:  18.5, w: 14.0, h: 11.0, rx: -Math.PI * 0.5, ry: -0.22 }
  ];
  for (let i = 0; i < mistSheetSpecs.length; i++) {
    const ms = mistSheetSpecs[i];
    rollingMistParts.push(xformGeo(new THREE.PlaneGeometry(ms.w, ms.h), ms.x, ms.y, ms.z, ms.rx, ms.ry, 0));
  }
  const rollingMistMesh = new THREE.Mesh(
    trackGeo(mergeNonIndexedGeos(THREE, rollingMistParts)),
    rollingMistMat
  );
  rollingMistMesh.renderOrder = 2;
  exteriorGroup.add(rollingMistMesh);

  // 2) Gently Falling Pale Ash Flakes & Faint Embers drifting across the Shore & Gorge Road!
  const SHORE_ASH_COUNT = isMobile ? 120 : 260;
  const ashPos = new Float32Array(SHORE_ASH_COUNT * 3);
  const ashSeed = new Float32Array(SHORE_ASH_COUNT * 3);
  for (let i = 0; i < SHORE_ASH_COUNT; i++) {
    const az = -12.0 + extRng() * 142.0;
    ashPos[i * 3]     = getPathCenterX(az) + (extRng() - 0.5) * 30.0;
    ashPos[i * 3 + 1] = extRng() * 15.5;
    ashPos[i * 3 + 2] = az;
    ashSeed[i * 3]     = extRng();
    ashSeed[i * 3 + 1] = 0.50 + extRng() * 0.85;
    ashSeed[i * 3 + 2] = 0.65 + extRng() * 1.15;
  }
  const shoreAshGeo = trackGeo(new THREE.BufferGeometry());
  shoreAshGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
  shoreAshGeo.setAttribute('aSeed', new THREE.BufferAttribute(ashSeed, 3));
  const shoreAshMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        float cyc = fract(aSeed.x - uTime * 0.042 * aSeed.y);
        vec3 p = position;
        p.y = 0.35 + cyc * 14.5;
        p.x += sin(uTime * 0.55 + aSeed.x * 18.0) * 1.45 + uTime * 0.22 * (aSeed.y - 0.5);
        p.x = mod(p.x + 17.0, 34.0) - 17.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 58.0) / max(1.2, -mv.z), 2.0, 14.0);
        vAlpha = sin(cyc * 3.14159) * 0.65;
        vWarm = step(0.86, aSeed.x);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        vec3 col = mix(vec3(0.72, 0.80, 0.92), vec3(1.65, 0.68, 0.22), vWarm);
        float a = t.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  const shoreAshPoints = new THREE.Points(shoreAshGeo, shoreAshMat);
  shoreAshPoints.frustumCulled = false;
  exteriorGroup.add(shoreAshPoints);

  // 3) Boiling Waterfall Plunge-Pool Spray Plumes + Low River Mist Puffs!
  const SHORE_MIST_COUNT = isMobile ? 30 : 56;
  const smPos = new Float32Array(SHORE_MIST_COUNT * 3);
  const smSeed = new Float32Array(SHORE_MIST_COUNT * 3);
  for (let i = 0; i < SHORE_MIST_COUNT; i++) {
    const isWaterfallSpray = i < Math.floor(SHORE_MIST_COUNT * 0.52);
    if (isWaterfallSpray) {
      smPos[i * 3]     = (extRng() - 0.5) * 7.4;
      smPos[i * 3 + 1] = 0.25 + extRng() * 2.4;
      smPos[i * 3 + 2] = -12.6 + extRng() * 4.4;
      smSeed[i * 3]     = extRng();
      smSeed[i * 3 + 1] = 0.26 + extRng() * 0.36;
      smSeed[i * 3 + 2] = 2.8 + extRng() * 2.6;
    } else {
      const mz = -8.0 + extRng() * 136.0;
      smPos[i * 3]     = getRiverCenterX(mz) + (extRng() - 0.5) * 9.5;
      smPos[i * 3 + 1] = 0.45 + extRng() * 1.45;
      smPos[i * 3 + 2] = mz;
      smSeed[i * 3]     = extRng();
      smSeed[i * 3 + 1] = 0.06 + extRng() * 0.08;
      smSeed[i * 3 + 2] = 4.2 + extRng() * 3.8;
    }
  }
  const shoreMistGeo = trackGeo(new THREE.BufferGeometry());
  shoreMistGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3));
  shoreMistGeo.setAttribute('aSeed', new THREE.BufferAttribute(smSeed, 3));
  const shoreMistMat = trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: extSkyUniforms.uTime, uTex: { value: mistSpriteTex } },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        float cyc = fract(aSeed.x + uTime * aSeed.y);
        vec3 p = position;
        p.y += cyc * 1.85;
        p.x += sin(uTime * 0.48 + aSeed.x * 10.0) * 1.25;
        p.z += cyc * 2.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((aSeed.z * 330.0) / max(1.8, -mv.z), 18.0, 195.0);
        vAlpha = sin(cyc * 3.14159) * 0.28;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      void main() {
        vec4 t = texture2D(uTex, gl_PointCoord);
        float a = t.a * vAlpha;
        if (a < 0.008) discard;
        gl_FragColor = vec4(vec3(0.46, 0.58, 0.78), a);
      }
    `,
    transparent: true,
    depthWrite: false
  }));
  const shoreMistPoints = new THREE.Points(shoreMistGeo, shoreMistMat);
  shoreMistPoints.renderOrder = 3;
  shoreMistPoints.frustumCulled = false;
  exteriorGroup.add(shoreMistPoints);

  // Zero-recompile stubs (moonlight & waterfall bounce driven cleanly by world.js permanent dirLight & hemiLight!)
  const moonDirLight = makeLightStub();
  const waterfallMistLight = makeLightStub();

  // ==========================================================================
  // Reusable Zero-GC Scratch Objects for Per-Frame Updates
  // ==========================================================================
  const _dummy = new THREE.Object3D();

  // ==========================================================================
  // Internal State Sync Helpers
  // ==========================================================================
  function syncActiveLights() {
    const isChasm = stageMode === 'chasm_only' && chasmProgress > 0.01;
    const isShaft = stageMode === 'shaft_river';
    const isExt = stageMode === 'exterior_shore';

    chasmGlowLight.visible = isChasm && !lowSpecMode;
    chasmAbyssFillLight.visible = isChasm && chasmCamBelow && !lowSpecMode;
    if (!chasmGlowLight.visible) chasmGlowLight.intensity = 0;
    if (!chasmAbyssFillLight.visible) chasmAbyssFillLight.intensity = 0;

    shaftCrimsonLight.visible = isShaft;
    shaftMidLight.visible = isShaft && !lowSpecMode;
    tunnelMoonLight.visible = isShaft;
    tunnelFillLight.visible = isShaft && !lowSpecMode;
    if (!isShaft) {
      shaftCrimsonLight.intensity = 0;
      shaftMidLight.intensity = 0;
      tunnelMoonLight.intensity = 0;
      tunnelFillLight.intensity = 0;
    }

    moonDirLight.visible = isExt;
    waterfallMistLight.visible = isExt && !lowSpecMode;
    for (let i = 0; i < gateBrazierLights.length; i++) {
      gateBrazierLights[i].visible = isExt && !lowSpecMode;
      if (!gateBrazierLights[i].visible) gateBrazierLights[i].intensity = 0;
    }
    swordBeaconLight.visible = isExt && !swordPickedUp && !lowSpecMode;
    bonfireLight.visible = isExt && bonfireLit;
    if (!isExt) {
      moonDirLight.intensity = 0;
      waterfallMistLight.intensity = 0;
      swordBeaconLight.intensity = 0;
      bonfireLight.intensity = 0;
    }
  }

  function applyChasmVisuals(elapsedSec = 0) {
    const p = chasmProgress;
    const active = p > 0.001;
    chasmContent.visible = active;
    if (!active) {
      chasmGlowLight.intensity = 0;
      chasmAbyssFillLight.intensity = 0;
      return;
    }

    const openScale = 0.12 + 0.88 * smoothstep(0.0, 0.55, p);
    chasmStencilMask.scale.set(openScale, 1.0, openScale);
    chasmDepthClear.scale.set(openScale, 1.0, openScale);
    chasmShaftMesh.scale.set(openScale, 1.0, openScale);
    chasmInnerBeams.scale.set(openScale, 1.0, openScale);
    chasmRimCrackMesh.scale.set(openScale, 1.0, openScale);
    chasmRimCrackUniforms.uProgress.value = smoothstep(0.0, 0.40, p);
    chasmShaftUniforms.uHeat.value = 0.50 + 0.50 * (1.0 - smoothstep(0.6, 1.0, p) * 0.25);

    const slabT = smoothstep(0.04, 0.62, p);
    for (let i = 0; i < rimSlabEntries.length; i++) {
      const s = rimSlabEntries[i];
      s.mesh.position.y = lerp(-0.08, s.targetY, slabT);
      s.mesh.rotation.set(s.targetPitch * slabT, s.yaw, s.targetRoll * slabT);
      s.mesh.scale.setScalar(0.35 + 0.65 * slabT);
    }

    const drapeT = smoothstep(0.08, 0.72, p);
    tornCarpetNorth.scale.set(1.0, Math.max(0.05, drapeT), openScale);
    tornCarpetSouth.scale.set(1.0, Math.max(0.05, drapeT), openScale);

    for (let i = 0; i < CHASM_CHUNK_COUNT; i++) {
      const c = chasmChunkData[i];
      const rawT = Math.max(0.0, (p * 1.95 - c.delay) + (p >= 0.99 ? ((elapsedSec + i * 0.37) % c.loopPeriod) : 0.0));
      const tFall = (p >= 0.99) ? ((elapsedSec * 0.95 + c.delay * 4.5 + i * 0.29) % c.loopPeriod) : rawT;
      const y = c.vy0 * Math.min(tFall, 0.45) - 0.5 * 11.8 * tFall * tFall;
      const inBounds = y > -22.5;
      if (!inBounds || tFall <= 0.001) {
        _dummy.position.set(0, -34, 0);
        _dummy.scale.setScalar(0.001);
      } else {
        const radialTighten = Math.max(0.45, 1.0 - Math.max(0, -y) * 0.020);
        _dummy.position.set(
          (c.x0 + c.vx * tFall) * openScale * radialTighten,
          y,
          (c.z0 + c.vz * tFall) * openScale * radialTighten
        );
        _dummy.rotation.set(c.rx0 + c.vrx * tFall, c.ry0 + c.vry * tFall, c.rz0 + c.vrz * tFall);
        const fadeOut = smoothstep(-22.0, -17.5, y);
        _dummy.scale.set(c.sx * fadeOut, c.sy * fadeOut, c.sz * fadeOut);
      }
      _dummy.updateMatrix();
      chasmChunksInst.setMatrixAt(i, _dummy.matrix);
    }
    chasmChunksInst.instanceMatrix.needsUpdate = true;

    if (chasmGlowLight.visible) {
      const fl = 0.86 + 0.14 * Math.sin(elapsedSec * 7.5);
      chasmGlowLight.intensity = (chasmCamBelow ? 6.8 : 4.4) * smoothstep(0.0, 0.45, p) * fl;
    }
    if (chasmAbyssFillLight.visible) {
      chasmAbyssFillLight.intensity = 4.6 * smoothstep(0.0, 0.45, p);
    }
  }

  function applyGrateVisuals() {
    const a = clamp01(grateBreakAnim);
    tunnelRiverUniforms.uGrateBroken.value = grateBroken ? 1.0 : 0.0;

    for (let i = 0; i < breakableBars.length; i++) {
      const b = breakableBars[i];
      const localT = clamp01((a - b.delay) / 0.36);
      // Fast explosive cubic whip outward (78..96 deg) w/ metallic spring recoil bounce!
      const bounce = localT > 0
        ? Math.min(1.12, 1.0 - Math.pow(1.0 - localT, 3.0) + Math.sin(localT * Math.PI * 2.6) * 0.09 * (1.0 - localT))
        : 0.0;
      b.topPivot.rotation.set(b.targetTopRx * bounce, 0, b.targetRz * bounce);
      b.botPivot.rotation.set(b.targetBotRx * bounce, 0, -b.targetRz * bounce);
    }

    // Central horizontal crossbar splits & whips violently open (+Z) out of the 3.8m breach!
    const crossT = clamp01(a / 0.32);
    const crossSwing = 1.0 - Math.pow(1.0 - crossT, 3.0);
    crossLeftPivot.rotation.set(crossSwing * 0.22, -crossSwing * 1.48, -crossSwing * 0.16);
    crossRightPivot.rotation.set(crossSwing * 0.18, crossSwing * 1.48, crossSwing * 0.18);

    // 6 Flying 3D broken iron debris shards blasting outward (+Z) into the moonlit tunnel exit!
    const debrisActive = grateBroken && grateBreakAnim > 0.005 && grateBreakAnim < 1.38;
    for (let i = 0; i < grateDebris.length; i++) {
      const d = grateDebris[i];
      if (!debrisActive) {
        d.mesh.visible = false;
      } else {
        const ft = grateBreakAnim * 0.88;
        d.mesh.visible = true;
        d.mesh.position.set(
          d.x + d.vx * ft,
          d.y + d.vy * ft - 0.5 * 9.8 * ft * ft,
          0.15 + d.vz * ft
        );
        d.mesh.rotation.set(d.rx * ft, d.ry * ft, d.rz * ft);
      }
    }

    const burstActive = grateBroken && grateBreakAnim > 0.005 && grateBreakAnim < 1.45;
    grateBurstPoints.visible = burstActive;
    grateBurstUniforms.uAge.value = grateBreakAnim * 1.05;
  }

  // ==========================================================================
  // Public API Implementation (100% Backwards-Compatible + attachRealSwordModel)
  // ==========================================================================
  function setStageMode(mode) {
    const valid =
      mode === 'chasm_only' ||
      mode === 'shaft_river' ||
      mode === 'exterior_shore'
        ? mode
        : 'none';
    stageMode = valid;
    chasmOverlayGroup.visible = valid === 'chasm_only';
    shaftAndRiverGroup.visible = valid === 'shaft_river';
    exteriorGroup.visible = valid === 'exterior_shore';
    syncActiveLights();
    if (valid === 'chasm_only') applyChasmVisuals(0);
    if (valid === 'shaft_river') applyGrateVisuals();
  }

  function setChasmState(progress01, x, z) {
    chasmProgress = clamp01(Number.isFinite(progress01) ? progress01 : 0);
    if (Number.isFinite(x)) {
      chasmX = x;
      chasmOverlayGroup.position.x = x;
    }
    if (Number.isFinite(z)) {
      chasmZ = z;
      chasmOverlayGroup.position.z = z;
    }
    chasmOverlayGroup.position.y = 0;
    syncActiveLights();
    applyChasmVisuals(chasmShaftUniforms.uTime.value);
  }

  // Explosive grate-shatter animation: starts at explosive crack impulse (0.24 -> bars already flying apart
  // with debris/sparks visible even on single-frame seeks, then whips smoothly to full 95° wide open in ~0.35s!)
  function triggerGrateBreak() {
    grateBroken = true;
    grateBreakAnim = 0.24;
    applyGrateVisuals();
  }

  // Idempotent state setter (works identically on any seek() AND never clobbers an active triggerGrateBreak() burst!)
  function setGrateBroken(broken, animProgress) {
    const b = Boolean(broken);
    if (b) {
      if (Number.isFinite(animProgress)) {
        grateBroken = true;
        grateBreakAnim = Math.max(0.0, Math.min(1.5, animProgress));
      } else if (!grateBroken) {
        // Idempotent transition false -> true: IMMEDIATELY wide open 78-96 deg (3.8m clean breach)!
        grateBroken = true;
        grateBreakAnim = 1.0;
      }
      // If already grateBroken === true (e.g. during active triggerGrateBreak() burst), preserve current grateBreakAnim!
    } else {
      grateBroken = false;
      grateBreakAnim = 0.0;
    }
    applyGrateVisuals();
  }

  function setSwordPickedUp(picked) {
    swordPickedUp = Boolean(picked);
    swordGroup.visible = !swordPickedUp;
    syncActiveLights();
  }

  // Attach a real 3D `sword_tripo` clone (or `createDroppedSwordMesh().obj`) cleanly planted tip-down at 12°!
  function attachRealSwordModel(swordMesh) {
    // Detach previous custom sword without disposing externally owned assets
    if (attachedRealSwordWrapper && attachedRealSwordWrapper.parent === swordRealMount) {
      swordRealMount.remove(attachedRealSwordWrapper);
    }
    if (attachedRealSword && attachedRealSword.parent) {
      attachedRealSword.parent.remove(attachedRealSword);
    }
    attachedRealSword = null;
    attachedRealSwordWrapper = null;

    if (!swordMesh || typeof swordMesh !== 'object' || !swordMesh.isObject3D) {
      swordFallbackGroup.visible = true;
      return false;
    }

    const wrapper = new THREE.Group();
    wrapper.name = swordMesh.userData?.isGreatClub ? 'RealGreatClubShoreWrapper' : 'RealOathSwordAlignedWrapper';
    swordMesh.visible = true;
    wrapper.add(swordMesh);

    // Measure intrinsic orientation & span of the passed weapon object
    wrapper.updateMatrixWorld(true);
    const box0 = new THREE.Box3().setFromObject(wrapper);
    const size0 = new THREE.Vector3();
    box0.getSize(size0);
    const maxDim = Math.max(size0.x, size0.y, size0.z);
    if (!Number.isFinite(maxDim) || maxDim < 1e-4) {
      wrapper.remove(swordMesh);
      swordFallbackGroup.visible = true;
      return false;
    }

    if (swordMesh.userData?.isGreatClub) {
      // Lay the Elden Ring Great Club naturally propped diagonally across the coastal rock/pebble mound!
      // Butt/leather handle rests on the wet pebbles near the waking hero; massive gnarled dark-oak head
      // leans naturally up onto the coastal mound (~20 deg tilt) so its iconic silhouette pops immediately!
      swordVisualPivot.rotation.set(0, 0, 0);
      const center0 = new THREE.Vector3();
      box0.getCenter(center0);
      const targetLen = 1.48;
      const sc = targetLen / Math.max(1e-4, size0.y);
      wrapper.scale.setScalar(sc);
      wrapper.position.set(-center0.x * sc, -box0.min.y * sc, -center0.z * sc);

      const finalMount = new THREE.Group();
      finalMount.name = 'RealGreatClubShoreMount';
      finalMount.add(wrapper);
      // Tilt from vertical (+Y) to ~26 deg above horizontal leaning naturally up onto the coastal rock mound,
      // angled prominently toward the waking hero so the gnarled dark-oak silhouette & leather grip pop clearly!
      finalMount.rotation.order = 'YXZ';
      finalMount.rotation.y = 0.72;
      finalMount.rotation.z = -1.10;
      finalMount.rotation.x = 0.06;
      finalMount.position.set(-0.34, 0.14, -0.14);

      swordRealMount.add(finalMount);
      attachedRealSword = swordMesh;
      attachedRealSwordWrapper = finalMount;
      swordFallbackGroup.visible = false;
      swordGroup.visible = !swordPickedUp;
      return true;
    }

    swordVisualPivot.rotation.set(0.18, 0.52, -0.11); // ~12.1 deg heroic angle for Oath Broadsword if used

    // Align longest axis vertically along Y
    if (size0.x >= size0.y && size0.x >= size0.z) {
      swordMesh.rotation.z += Math.PI * 0.5;
    } else if (size0.z >= size0.y && size0.z >= size0.x) {
      swordMesh.rotation.x += Math.PI * 0.5;
    }
    wrapper.updateMatrixWorld(true);

    // Auto-detect which end is the wide crossguard/hilt vs narrow blade tip so TIP is ALWAYS planted DOWN!
    const box1 = new THREE.Box3().setFromObject(wrapper);
    const size1 = new THREE.Vector3();
    const center1 = new THREE.Vector3();
    box1.getSize(size1);
    box1.getCenter(center1);
    const ySpan = Math.max(1e-4, size1.y);
    let lowerSpanMax = 0;
    let upperSpanMax = 0;
    const tmpV = new THREE.Vector3();
    const invWrapper = new THREE.Matrix4().copy(wrapper.matrixWorld).invert();
    const toWrapper = new THREE.Matrix4();

    swordMesh.traverse((n) => {
      if (!n.isMesh || !n.geometry?.attributes?.position) return;
      n.frustumCulled = false;
      n.castShadow = true;
      n.receiveShadow = true;
      const posAttr = n.geometry.attributes.position;
      toWrapper.multiplyMatrices(invWrapper, n.matrixWorld);
      const step = Math.max(1, Math.floor(posAttr.count / 240));
      for (let i = 0; i < posAttr.count; i += step) {
        tmpV.fromBufferAttribute(posAttr, i).applyMatrix4(toWrapper);
        const yFrac = (tmpV.y - box1.min.y) / ySpan;
        const radial = Math.hypot(tmpV.x - center1.x, tmpV.z - center1.z);
        if (yFrac < 0.36 && radial > lowerSpanMax) lowerSpanMax = radial;
        if (yFrac > 0.64 && radial > upperSpanMax) upperSpanMax = radial;
      }
    });

    // If the wide crossguard is currently near the bottom (lowerSpanMax > upperSpanMax), flip upside-down so blade tip plunges down!
    if (lowerSpanMax > upperSpanMax * 1.12) {
      wrapper.rotation.z = Math.PI;
      wrapper.updateMatrixWorld(true);
    }

    // Normalize to 1.36m exact hero Oath Broadsword height & seat blade tip ~0.22m deep in coastal pebbles!
    const box2 = new THREE.Box3().setFromObject(wrapper);
    const size2 = new THREE.Vector3();
    const center2 = new THREE.Vector3();
    box2.getSize(size2);
    box2.getCenter(center2);
    const targetLen = 1.36;
    const sc = targetLen / Math.max(1e-4, size2.y);

    const finalMount = new THREE.Group();
    finalMount.name = 'RealOathSwordScaledMount';
    wrapper.scale.multiplyScalar(sc);
    wrapper.position.set(-center2.x * sc, -box2.min.y * sc - 0.14, -center2.z * sc);
    finalMount.add(wrapper);

    swordRealMount.add(finalMount);
    attachedRealSword = swordMesh;
    attachedRealSwordWrapper = finalMount;
    swordFallbackGroup.visible = false;
    swordGroup.visible = !swordPickedUp;
    return true;
  }

  function setBonfireLit(lit) {
    bonfireLit = Boolean(lit);
    bonfireFlameMesh.visible = bonfireLit;
    bonfireEmbers.visible = bonfireLit;
    bonfireCoalsUniforms.uLit.value = bonfireLit ? 1.0 : 0.0;
    extRiverUniforms.uBonfireLit.value = bonfireLit ? 1.0 : 0.0;
    if (shoreTerrainMat?.userData?.gorgeUniforms?.uBonfireLitGorge) {
      shoreTerrainMat.userData.gorgeUniforms.uBonfireLitGorge.value = bonfireLit ? 1.0 : 0.0;
    }
    syncActiveLights();
  }

  let gorgeShortcutUnlocked = false;
  let liftUnlocked = false;
  let liftY = RIVER_REACH_LIFT_MIN_Y;
  let liftTargetY = RIVER_REACH_LIFT_MIN_Y;
  let liftRiding = false;
  let monasteryShortcutUnlocked = false;
  let logShortcutUnlocked = false;

  function setShortcutUnlocked(unlocked, instant = false) {
    gorgeShortcutUnlocked = Boolean(unlocked);
    gorgeRoadCtrl?.setShortcutUnlocked?.(gorgeShortcutUnlocked, instant);
  }
  function isShortcutUnlocked() {
    return gorgeShortcutUnlocked;
  }

  function setRiverReachShortcuts(patch = null, instant = false) {
    if (!patch || typeof patch !== 'object') return getRiverReachShortcuts();
    if (patch.shortcutUnlocked !== undefined) {
      setShortcutUnlocked(Boolean(patch.shortcutUnlocked), instant);
    }
    if (patch.liftUnlocked !== undefined) {
      liftUnlocked = Boolean(patch.liftUnlocked);
    }
    if (Number.isFinite(patch.liftY)) {
      liftY = clamp(patch.liftY, RIVER_REACH_LIFT_MIN_Y, RIVER_REACH_LIFT_MAX_Y);
      liftTargetY = liftY;
      liftRiding = false;
    }
    if (patch.monasteryShortcutUnlocked !== undefined) {
      monasteryShortcutUnlocked = Boolean(patch.monasteryShortcutUnlocked);
      riverReachNorthCtrl?.setMonasteryShortcutUnlocked?.(monasteryShortcutUnlocked, instant);
    }
    if (patch.logShortcutUnlocked !== undefined) {
      logShortcutUnlocked = Boolean(patch.logShortcutUnlocked);
      riverReachEastCtrl?.setLogShortcutUnlocked?.(logShortcutUnlocked, instant);
    }
    riverReachNorthCtrl?.setLiftState?.({ unlocked: liftUnlocked, y: liftY, riding: liftRiding });
    return getRiverReachShortcuts();
  }

  function getRiverReachShortcuts() {
    return {
      shortcutUnlocked: gorgeShortcutUnlocked,
      liftUnlocked,
      liftY,
      liftTargetY,
      liftRiding,
      monasteryShortcutUnlocked,
      logShortcutUnlocked
    };
  }

  function triggerRiverReachLift(targetFloor = null) {
    if (!liftUnlocked) return liftY;
    if (targetFloor === 'top') {
      liftTargetY = RIVER_REACH_LIFT_MAX_Y;
    } else if (targetFloor === 'bottom') {
      liftTargetY = RIVER_REACH_LIFT_MIN_Y;
    } else {
      liftTargetY = liftY > (RIVER_REACH_LIFT_MIN_Y + RIVER_REACH_LIFT_MAX_Y) * 0.5
        ? RIVER_REACH_LIFT_MIN_Y
        : RIVER_REACH_LIFT_MAX_Y;
    }
    liftRiding = Math.abs(liftTargetY - liftY) > 0.02;
    riverReachNorthCtrl?.setLiftState?.({ unlocked: liftUnlocked, y: liftY, riding: liftRiding });
    return liftY;
  }

  function getRiverReachLiftY() {
    return liftY;
  }

  function buildTopologyState(extraOpts = null) {
    return {
      shortcutUnlocked: gorgeShortcutUnlocked,
      liftUnlocked,
      liftY,
      monasteryShortcutUnlocked,
      logShortcutUnlocked,
      ...(extraOpts || {})
    };
  }

  function getAnchors() {
    const out = {};
    for (const key in EXTERIOR_SHORE_ANCHORS) {
      const v = EXTERIOR_SHORE_ANCHORS[key];
      out[key] = (v && typeof v === 'object') ? { ...v } : v;
    }
    return out;
  }

  // Unified list of ALL 3D fire hearths across Shore + Multi-Elevation Gorge Road (preserves exact elevated Y!)
  const _fireSourcesList = [
    { id: 'shore_bonfire', x: EXTERIOR_SHORE_ANCHORS.bonfirePos.x, z: EXTERIOR_SHORE_ANCHORS.bonfirePos.z, y: EXTERIOR_SHORE_ANCHORS.bonfirePos.y + 1.65, weight: 1.0, radius: 17.5, lightIntensity: 9.5, isBonfire: true },
    { id: 'gate_brazier_r', x: -3.55, z: 29.3, y: evalBaseTerrainY(-3.55, 29.3) + 2.1, weight: 0.82, radius: 14.0, lightIntensity: 6.8, alwaysLit: true },
    { id: 'gate_brazier_l', x:  3.55, z: 29.3, y: evalBaseTerrainY( 3.55, 29.3) + 2.1, weight: 0.82, radius: 14.0, lightIntensity: 6.8, alwaysLit: true },
    ...GORGE_FIRE_SOURCES.map((f) => ({
      ...f,
      y: Number.isFinite(f.y) ? f.y : evalBaseTerrainY(f.x, f.z) + 1.65
    }))
  ];

  function getActiveFireSources() {
    _fireSourcesList[0].weight = bonfireLit ? 1.0 : 0.24;
    _fireSourcesList[0].radius = bonfireLit ? 17.5 : 4.8;
    _fireSourcesList[0].lightIntensity = bonfireLit ? 9.5 : 1.8;
    return _fireSourcesList;
  }

  function getInteractables() {
    return GORGE_INTERACTABLES;
  }

  function getZoneTitleAt(x, z, currentY) {
    return getExteriorZoneTitleAt(x, z, currentY);
  }

  function clampPosition(x, z, r = 0.55, opts = null) {
    return clampExteriorPosition(x, z, r, buildTopologyState(opts));
  }

  function getGroundY(x, z, currentY) {
    return evalExteriorGroundY(x, z, currentY, buildTopologyState());
  }

  function getSurfaceType(x, z, currentY) {
    return evalExteriorSurfaceType(x, z, currentY, buildTopologyState());
  }

  function getReadyPromise() {
    return Promise.all([
      gorgeRoadCtrl?.readyPromise || Promise.resolve(true),
      riverReachEastCtrl?.readyPromise || Promise.resolve(true),
      riverReachNorthCtrl?.readyPromise || Promise.resolve(true)
    ]);
  }

  function setLowSpecMode(lowSpec) {
    lowSpecMode = Boolean(lowSpec);
    tunnelRiverUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    extSkyUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    extRiverUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    if (extSkyMat.uniforms?.uLowSpec) extSkyMat.uniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    if (extRiverMat.uniforms?.uLowSpec) extRiverMat.uniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    valleyMistRig?.setLowSpec?.(lowSpecMode);

    for (let i = 0; i < normalMappedMats.length; i++) {
      const entry = normalMappedMats[i];
      entry.mat.normalMap = lowSpecMode ? null : entry.map;
      entry.mat.needsUpdate = true;
    }

    shoreAshGeo.setDrawRange(0, lowSpecMode ? Math.floor(SHORE_ASH_COUNT * 0.45) : SHORE_ASH_COUNT);
    shoreMistGeo.setDrawRange(0, lowSpecMode ? Math.floor(SHORE_MIST_COUNT * 0.45) : SHORE_MIST_COUNT);
    fireflyGeo.setDrawRange(0, lowSpecMode ? Math.floor(FIREFLY_COUNT * 0.45) : FIREFLY_COUNT);
    shaftDustGeo.setDrawRange(0, lowSpecMode ? Math.floor(SHAFT_DUST_COUNT * 0.45) : SHAFT_DUST_COUNT);
    castlePlumePoints.visible = !lowSpecMode;
    rollingMistMesh.visible = !lowSpecMode;
    for (let i = 0; i < cliffCloudMeshes.length; i++) {
      cliffCloudMeshes[i].visible = !lowSpecMode || i === 1;
    }
    syncActiveLights();
  }

  function update(dt = 0.016, elapsed = 0, updateOpts = null) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0.0;

    if (stageMode === 'none') return;

    // A) Chasm overlay animation
    if (stageMode === 'chasm_only') {
      chasmShaftUniforms.uTime.value = t;
      const camY =
        updateOpts?.camY ??
        updateOpts?.camPos?.y ??
        updateOpts?.camera?.position?.y;
      if (Number.isFinite(camY)) {
        syncChasmCameraSide(camY);
      }
      if (chasmProgress > 0.001) {
        applyChasmVisuals(t);
      }
      return;
    }

    // B) Vertical shaft + rushing underground river + outfall grate
    if (stageMode === 'shaft_river') {
      shaftTopGlowUniforms.uTime.value = t;
      tunnelRiverUniforms.uTime.value = t;

      if (grateBroken && grateBreakAnim < 1.48) {
        grateBreakAnim = Math.min(1.48, grateBreakAnim + safeDt * 1.95);
        applyGrateVisuals();
      }

      const redFlick = 0.86 + 0.14 * Math.sin(t * 6.8) + 0.06 * Math.sin(t * 14.3);
      shaftCrimsonLight.intensity = 14.5 * redFlick;
      if (shaftMidLight.visible) {
        shaftMidLight.intensity = 5.4;
      }
      tunnelMoonLight.intensity = 12.5 + (grateBroken ? 4.2 : 0.0);
      if (tunnelFillLight.visible) {
        tunnelFillLight.intensity = 4.6;
      }
      return;
    }

    // C) Exterior Shore & Gorge Road («Берег Пепельного Стока → Тракт Древней Арки → Башня Перевала»)
    if (stageMode === 'exterior_shore') {
      extSkyUniforms.uTime.value = t;
      const camPos = updateOpts?.camPos || updateOpts?.camera?.position || null;
      if (Math.abs(liftTargetY - liftY) > 0.005) {
        const liftSpeed = 4.6; // smooth ~3.2s ride across 15m vertical shaft
        const stepY = safeDt * liftSpeed;
        liftY = liftY < liftTargetY ? Math.min(liftTargetY, liftY + stepY) : Math.max(liftTargetY, liftY - stepY);
        liftRiding = Math.abs(liftTargetY - liftY) > 0.005;
        riverReachNorthCtrl?.setLiftState?.({ unlocked: liftUnlocked, y: liftY, riding: liftRiding });
      }
      gorgeRoadCtrl?.update?.(safeDt, t, camPos);
      riverReachEastCtrl?.update?.(safeDt, t, camPos);
      riverReachNorthCtrl?.update?.(safeDt, t, camPos);
      valleyMistRig?.update?.(t, camPos);
      // Keep sky dome centered on camera XYZ so the Full Moon, storm clouds & stars stay at true infinite horizon across all 8 sectors!
      if (camPos && Number.isFinite(camPos.x) && Number.isFinite(camPos.z)) {
        const skyY = Number.isFinite(camPos.y) ? camPos.y - 6.0 : -6.0;
        extSkyDome.position.set(camPos.x, skyY, camPos.z);
      }

      if (!swordPickedUp) {
        const pulse = 0.84 + 0.16 * Math.sin(t * 3.1);
        swordBeaconMesh.scale.set(0.92 + 0.08 * pulse, 0.96 + 0.06 * pulse, 0.92 + 0.08 * pulse);
        if (swordBeaconLight.visible) {
          swordBeaconLight.intensity = 2.8 * pulse;
        }
      }

      if (bonfireLit && bonfireLight.visible) {
        const fl = 0.84 + 0.10 * Math.sin(t * 9.4) + 0.06 * Math.sin(t * 18.7);
        bonfireLight.intensity = 8.2 * fl;
      }

      moonDirLight.intensity = 1.95;
      if (waterfallMistLight.visible) {
        waterfallMistLight.intensity = 34.0 + 2.5 * Math.sin(t * 3.4);
      }
      for (let i = 0; i < gateBrazierLights.length; i++) {
        const bl = gateBrazierLights[i];
        if (bl.visible) {
          const gfl = 0.86 + 0.14 * Math.sin(t * 8.4 + i * 2.1);
          bl.intensity = 5.2 * gfl;
        }
      }

      // Step flying wooden barrel/crate splinters (ballistic arc + ground bounce + scale fade)
      for (let si = activeSplinters.length - 1; si >= 0; si--) {
        const sp = activeSplinters[si];
        sp.age += safeDt;
        if (sp.age >= sp.maxAge) {
          exteriorGroup.remove(sp.mesh);
          activeSplinters.splice(si, 1);
          continue;
        }
        sp.vy -= 14.5 * safeDt;
        sp.mesh.position.x += sp.vx * safeDt;
        sp.mesh.position.y += sp.vy * safeDt;
        sp.mesh.position.z += sp.vz * safeDt;
        sp.mesh.rotation.x += sp.rx * safeDt;
        sp.mesh.rotation.y += sp.ry * safeDt;
        const groundY = evalExteriorGroundY(sp.mesh.position.x, sp.mesh.position.z) + 0.04;
        if (sp.mesh.position.y < groundY) {
          sp.mesh.position.y = groundY;
          if (Math.abs(sp.vy) > 0.65) {
            sp.vy = -sp.vy * 0.32;
            sp.vx *= 0.56;
            sp.vz *= 0.56;
            sp.rx *= 0.5;
            sp.ry *= 0.5;
          } else {
            sp.vy = 0;
            sp.vx *= 0.82;
            sp.vz *= 0.82;
            sp.rx *= 0.7;
            sp.ry *= 0.7;
          }
        }
        if (sp.age > sp.maxAge - 0.45) {
          const sc = Math.max(0.01, (sp.maxAge - sp.age) / 0.45);
          sp.mesh.scale.setScalar(sc);
        }
      }
    }
  }

  function dispose() {
    resetDestructibles();
    setStageMode('none');
    attachRealSwordModel(null);
    valleyMistRig?.dispose?.();
    riverReachEastCtrl?.dispose?.();
    riverReachNorthCtrl?.dispose?.();
    for (let i = 0; i < ownedGeos.length; i++) ownedGeos[i]?.dispose?.();
    for (let i = 0; i < ownedMats.length; i++) ownedMats[i]?.dispose?.();
    for (let i = 0; i < ownedTex.length; i++) ownedTex[i]?.dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
    normalMappedMats.length = 0;
    if (rootGroup.parent) rootGroup.parent.remove(rootGroup);
  }

  // Apply initial clean defaults
  setLowSpecMode(lowSpecMode);
  setSwordPickedUp(false);
  setBonfireLit(false);
  setGrateBroken(false);
  setStageMode('none');

  function setCompilePreview(on) {
    if (on) {
      rootGroup.visible = true;
      chasmOverlayGroup.visible = true;
      chasmContent.visible = true;
      shaftAndRiverGroup.visible = true;
      exteriorGroup.visible = true;
    } else {
      setStageMode(stageMode);
      chasmContent.visible = stageMode === 'chasm_only' && chasmProgress > 0.001;
    }
  }

  return {
    rootGroup,
    chasmOverlayGroup,
    shaftAndRiverGroup,
    exteriorGroup,
    setStageMode,
    setCompilePreview,
    setChasmState,
    triggerGrateBreak,
    setGrateBroken,
    setSwordPickedUp,
    setBonfireLit,
    setShortcutUnlocked,
    isShortcutUnlocked,
    setRiverReachShortcuts,
    getRiverReachShortcuts,
    triggerRiverReachLift,
    getRiverReachLiftY,
    hitDestructibles,
    resetDestructibles,
    attachRealSwordModel,
    getAnchors,
    getActiveFireSources,
    getInteractables,
    getZoneTitleAt,
    clampPosition,
    getGroundY,
    getSurfaceType,
    getReadyPromise,
    update,
    setLowSpecMode,
    dispose,
    getStageMode: () => stageMode,
    isSwordPickedUp: () => swordPickedUp,
    isBonfireLit: () => bonfireLit,
    isGrateBroken: () => grateBroken,
    getStats: () => ({
      stageMode,
      isMobile,
      lowSpecMode,
      hasRealSwordAttached: Boolean(attachedRealSword),
      hasGorgeRoad: Boolean(gorgeRoadCtrl?.gorgeGroup),
      ownedGeos: ownedGeos.length,
      ownedMats: ownedMats.length,
      ownedTex: ownedTex.length
    })
  };
}
