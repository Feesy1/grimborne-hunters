// Visual Upgrade Module for the Chapter 26 Boss (Troll / Abandoned Knight Rift)
// Three.js r160 — 100% Mixamo-clip safe (never mutates bone transforms or AnimationMixer tracks),
// integrates real volumetric Simplex FBM fire (`createHammerFireTrailMaterial` from soulsFireVfx.js),
// enhanced 256px procedural PBR micro-relief + Phase-2 smoldering volcanic coal cracks,
// zero per-frame JS allocations, zero extra PointLights (respects Mobile/LowSpec light budget),
// and ref-counted GPU resources with strict `.dispose()` (0 WebGL leaks).

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { createHammerFireTrailMaterial } from './soulsFireVfx.js?v=20261121z64';

// ============================================================================
// Module-level State, Mobile Detection & Ref-Counted Shared GPU Resources
// ============================================================================
function detectMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|iPad|Android/i.test(ua)) return true;
  if (typeof window !== 'undefined') {
    const touch = navigator.maxTouchPoints || 0;
    const minDim = Math.min(window.innerWidth || 1280, window.innerHeight || 720);
    if (touch > 1 && minDim <= 1024) return true;
  }
  return false;
}

const IS_MOBILE_DEVICE = detectMobileDevice();
let globalLowSpec = false;

const activeBossStates = new Set();
const patchedMaterialRecords = new WeakMap();

const SPARK_COUNT_DESKTOP = 36;
const SPARK_COUNT_MOBILE = 20;
const SPARK_COUNT_LOWSPEC = 10;

// Ref-counted shared procedural assets (created lazily, disposed automatically at refCount === 0)
let sharedResources = null;
let sharedRefCount = 0;
// Persistent uniform wrappers so reused WebGLPrograms always sample the live textures (0 stale re-uploads!)
const SHARED_MICRO_ROUGH_UNIFORM = { value: null };
const SHARED_MICRO_BUMP_UNIFORM = { value: null };

// Reusable scratch objects strictly for one-time enhanceSoulsBossModel calibration (never used per-frame)
const _calMatA = new THREE.Matrix4();
const _calMatB = new THREE.Matrix4();
const _calVecA = new THREE.Vector3();
const _calVecB = new THREE.Vector3();
const _calVecC = new THREE.Vector3();
const _calMin = new THREE.Vector3();
const _calMax = new THREE.Vector3();

// ============================================================================
// Deterministic Seeded PRNG & Tileable Value Noise (No DOM Canvas Required!)
// ============================================================================
function makeRng(seedInit) {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function createTileNoise(gridSize, seed) {
  const rng = makeRng(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  return { grid, size: gridSize, mask: gridSize - 1 };
}

function sampleTileNoise(n, gx, gy) {
  const mask = n.mask;
  const sz = n.size;
  const grid = n.grid;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const x0 = ix & mask;
  const y0 = iy & mask;
  const x1 = (x0 + 1) & mask;
  const y1 = (y0 + 1) & mask;
  const fx = gx - ix;
  const fy = gy - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const r0 = y0 * sz;
  const r1 = y1 * sz;
  const n00 = grid[r0 + x0];
  const n10 = grid[r0 + x1];
  const n01 = grid[r1 + x0];
  const n11 = grid[r1 + x1];
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

// ============================================================================
// Procedural 256px Micro-Bump, Volcanic Coal-Crack & Micro-Roughness Maps
//   microBumpMap:
//     .r = high-contrast forged metal scratches + hammered pits + skin pores
//     .g = branching tileable volcanic coal-crack fissure mask (ignites in Phase 2!)
//     .b = fine micro-ridge highlight mask
//   microRoughnessMap:
//     .r = micro-cavity AO mask (deepens armor grooves & pores)
//     .g = micro-roughness (glossy scratched steel edges vs matte pitted skin/soot)
// ============================================================================
function buildBossMicroPbrMaps() {
  const size = 256;
  const mask = size - 1;
  const total = size * size;
  const heightBuf = new Float32Array(total);
  const scratchMask = new Float32Array(total);
  const poreMask = new Float32Array(total);
  const crackMask = new Float32Array(total);

  const noiseLo = createTileNoise(16, 0x7a011b05);
  const noiseMid = createTileNoise(32, 0x52c4e913);
  const noiseHi = createTileNoise(64, 0x91e73a4d);
  const noiseCrackA = createTileNoise(16, 0xc34f92a1);
  const noiseCrackB = createTileNoise(32, 0x41d80b77);
  const rng = makeRng(0x26b05571);

  // 1. Multi-octave hammered-iron relief + leather/skin grain + Voronoi-like volcanic crack network
  const cellCount = 12;
  const cellPtsX = new Float32Array(cellCount * cellCount);
  const cellPtsY = new Float32Array(cellCount * cellCount);
  for (let cy = 0; cy < cellCount; cy++) {
    for (let cx = 0; cx < cellCount; cx++) {
      const ci = cy * cellCount + cx;
      cellPtsX[ci] = cx + 0.16 + rng() * 0.68;
      cellPtsY[ci] = cy + 0.16 + rng() * 0.68;
    }
  }

  const invSize = 1 / size;
  for (let y = 0; y < size; y++) {
    const y0 = y * size;
    const ny = y * invSize;
    for (let x = 0; x < size; x++) {
      const nx = x * invSize;
      const n1 = sampleTileNoise(noiseLo, nx * 16, ny * 16);
      const n2 = sampleTileNoise(noiseMid, nx * 32, ny * 32);
      const n3 = sampleTileNoise(noiseHi, nx * 64, ny * 64);

      // Hammered iron facets + tactile skin grain
      const hammered = 1.0 - Math.abs(n1 * 2.0 - 1.0);
      const fineRidge = 1.0 - Math.abs(n2 * 2.0 - 1.0);
      let h = 0.50 + (hammered - 0.5) * 0.30 + (fineRidge - 0.5) * 0.22 + (n3 - 0.5) * 0.18;

      // Domain-warped tileable cellular edge distance (authentic branching molten coal cracks!)
      const warpX = (sampleTileNoise(noiseCrackA, nx * 16, ny * 16) - 0.5) * 0.72
        + (sampleTileNoise(noiseCrackB, nx * 32, ny * 32) - 0.5) * 0.28;
      const warpY = (sampleTileNoise(noiseCrackA, nx * 16 + 7.3, ny * 16 + 3.1) - 0.5) * 0.72
        + (sampleTileNoise(noiseCrackB, nx * 32 + 4.9, ny * 32 + 9.2) - 0.5) * 0.28;

      const fx = ((nx * cellCount + warpX) % cellCount + cellCount) % cellCount;
      const fy = ((ny * cellCount + warpY) % cellCount + cellCount) % cellCount;
      const gx = Math.floor(fx);
      const gy = Math.floor(fy);

      let d1 = 99.0;
      let d2 = 99.0;
      for (let oy = -1; oy <= 1; oy++) {
        const ngy = (gy + oy + cellCount) % cellCount;
        const wrapY = (gy + oy < 0) ? -cellCount : (gy + oy >= cellCount ? cellCount : 0);
        for (let ox = -1; ox <= 1; ox++) {
          const ngx = (gx + ox + cellCount) % cellCount;
          const wrapX = (gx + ox < 0) ? -cellCount : (gx + ox >= cellCount ? cellCount : 0);
          const ci = ngy * cellCount + ngx;
          const dx = (cellPtsX[ci] + wrapX) - fx;
          const dy = (cellPtsY[ci] + wrapY) - fy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }

      // Crisp irregular magma fissure along Voronoi cell borders modulated by noise
      const edgeDelta = d2 - d1;
      const crackWidth = 0.085 + n2 * 0.065;
      const rawCrack = clamp01(1.0 - edgeDelta / crackWidth);
      const crack = rawCrack * rawCrack * (0.45 + 0.55 * n1);
      crackMask[y0 + x] = crack;

      // Carve subtle physical indentation into height map right along the fissures!
      h -= crack * 0.24;
      heightBuf[y0 + x] = clamp01(h);
    }
  }

  // 2. Organic skin pores & hammered micro-pits (tileable wrapped dimples)
  const poreCount = 310;
  for (let i = 0; i < poreCount; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const rad = 1.1 + rng() * 2.5;
    const depth = 0.13 + rng() * 0.19;
    const rCeil = Math.ceil(rad + 1);
    const invRad2 = 1.0 / (rad * rad);

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      const py = (Math.floor(cy) + dy) & mask;
      const row = py * size;
      const ddy = dy * dy;
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        const d2 = dx * dx + ddy;
        if (d2 >= rad * rad) continue;
        const px = (Math.floor(cx) + dx) & mask;
        const fall = 1.0 - d2 * invRad2;
        const smooth = fall * fall;
        const idx = row + px;
        heightBuf[idx] = clamp01(heightBuf[idx] - depth * smooth);
        poreMask[idx] = Math.min(1.0, poreMask[idx] + smooth * 0.90);
      }
    }
  }

  // 3. Forged steel micro-scratches & battle gouges (crossed directional wraps)
  const scratchCount = 84;
  for (let i = 0; i < scratchCount; i++) {
    let x = rng() * size;
    let y = rng() * size;
    const baseAngle = (i % 3 === 0 ? 0.42 : i % 3 === 1 ? -0.68 : 1.18) + (rng() - 0.5) * 0.58;
    const len = 18 + rng() * 64;
    const width = 0.65 + rng() * 1.05;
    const depth = 0.18 + rng() * 0.26;
    const curve = (rng() - 0.5) * 0.013;
    const steps = Math.ceil(len * 1.4);
    const stepLen = len / steps;

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const taper = Math.sin(t * Math.PI);
      const ang = baseAngle + curve * s;
      x += Math.cos(ang) * stepLen;
      y += Math.sin(ang) * stepLen;

      const rCeil = Math.ceil(width + 1);
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const invW2 = 1.0 / (width * width + 0.05);

      for (let dy = -rCeil; dy <= rCeil; dy++) {
        const py = (iy + dy) & mask;
        const row = py * size;
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > (width + 1.0) * (width + 1.0)) continue;
          const px = (ix + dx) & mask;
          const idx = row + px;
          const core = Math.exp(-d2 * invW2) * taper;
          const lip = Math.exp(-Math.pow(Math.sqrt(d2) - width * 1.05, 2) * 2.4) * taper * 0.38;
          heightBuf[idx] = clamp01(heightBuf[idx] - depth * core + depth * lip);
          scratchMask[idx] = Math.min(1.0, scratchMask[idx] + (core * 0.92 + lip * 0.78));
        }
      }
    }
  }

  // Pack RGBA DataTextures (works identically in WebGL2 browsers & headless tests)
  const bumpData = new Uint8Array(total * 4);
  const roughData = new Uint8Array(total * 4);
  for (let i = 0; i < total; i++) {
    const h = heightBuf[i];
    const cr = crackMask[i];
    const sc = scratchMask[i];
    const po = poreMask[i];

    const bVal = (clamp01(h) * 255 + 0.5) | 0;
    const crackVal = (clamp01(cr) * 255 + 0.5) | 0;
    const ridgeVal = (clamp01(sc * 0.85 + Math.max(0, h - 0.55) * 1.2) * 255 + 0.5) | 0;

    // Cavity AO (.r): darkens deep pores, fissures & gouges subtly for sculptural armor/skin depth
    const cavity = clamp01(0.96 - po * 0.24 - cr * 0.34 - Math.max(0, 0.45 - h) * 0.36);
    const cavityVal = (cavity * 255 + 0.5) | 0;

    // Micro-roughness (.g): raised hammered ridges & fresh battle scratches glint crisply under PMREM IBL;
    // pitted pores & charred fissures stay matte for tactile dark-fantasy contrast!
    const rNorm = clamp01(0.68 - (h - 0.5) * 0.48 - sc * 0.28 + po * 0.22 + cr * 0.16);
    const rVal = (rNorm * 255 + 0.5) | 0;

    const o = i * 4;
    bumpData[o] = bVal;
    bumpData[o + 1] = crackVal;
    bumpData[o + 2] = ridgeVal;
    bumpData[o + 3] = 255;

    roughData[o] = cavityVal;
    roughData[o + 1] = rVal;
    roughData[o + 2] = rVal;
    roughData[o + 3] = 255;
  }

  const aniso = globalLowSpec || IS_MOBILE_DEVICE ? 1 : 4;

  const microBumpMap = new THREE.DataTexture(bumpData, size, size, THREE.RGBAFormat);
  microBumpMap.colorSpace = THREE.NoColorSpace;
  microBumpMap.wrapS = THREE.RepeatWrapping;
  microBumpMap.wrapT = THREE.RepeatWrapping;
  microBumpMap.repeat.set(5.5, 5.5);
  microBumpMap.generateMipmaps = true;
  microBumpMap.minFilter = THREE.LinearMipmapLinearFilter;
  microBumpMap.magFilter = THREE.LinearFilter;
  microBumpMap.anisotropy = aniso;
  microBumpMap.needsUpdate = true;

  const microRoughnessMap = new THREE.DataTexture(roughData, size, size, THREE.RGBAFormat);
  microRoughnessMap.colorSpace = THREE.NoColorSpace;
  microRoughnessMap.wrapS = THREE.RepeatWrapping;
  microRoughnessMap.wrapT = THREE.RepeatWrapping;
  microRoughnessMap.repeat.set(5.5, 5.5);
  microRoughnessMap.generateMipmaps = true;
  microRoughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  microRoughnessMap.magFilter = THREE.LinearFilter;
  microRoughnessMap.anisotropy = aniso;
  microRoughnessMap.needsUpdate = true;

  return { microBumpMap, microRoughnessMap };
}

// Procedural 128px radial volumetric ember halo DataTexture (zero DOM canvas needed)
function buildSoftEmberHaloTexture() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  const invHalf = 1.0 / half;

  for (let y = 0; y < size; y++) {
    const dy = (y - half) * invHalf;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const dx = (x - half) * invHalf;
      const d = Math.sqrt(dx * dx + dy * dy);
      const t = clamp01(1.0 - d);
      const core = Math.pow(t, 5.2);
      const glow = Math.pow(t, 2.35);
      const r = clamp01(glow * 1.12 + core * 0.50);
      const g = clamp01(Math.pow(t, 3.2) * 0.78 + core * 0.70);
      const b = clamp01(Math.pow(t, 5.0) * 0.28 + core * 0.48);
      const a = clamp01(glow * 0.85 + core * 0.30);

      const o = (row + x) * 4;
      data[o] = (r * 255 + 0.5) | 0;
      data[o + 1] = (g * 255 + 0.5) | 0;
      data[o + 2] = (b * 255 + 0.5) | 0;
      data[o + 3] = (a * 255 + 0.5) | 0;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// Unit-Scale Sculpted 3D Hammer Flame Crown & Swept Fire Trail Geometries
// Built once in sharedResources (radius = 1.0), scaled per-boss by hammerCal.radius!
// ============================================================================
function normalizeGeomForMerge(rawGeo) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  if (g !== rawGeo) rawGeo.dispose();
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      g.deleteAttribute(attrName);
    }
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

/**
 * Multi-axis sculpted curved 3D flame crown hugging the warhammer head (flowAxis: 'v').
 * v = 0 anchors inside the forged iron head; v = 1 whips outward into jagged licking fire tongues.
 */
function buildUnitHammerFireCrownGeometry() {
  const parts = [];

  // 1. 6 radial cupped flame tongues wreathing the hammer head from all viewing angles
  const ringCount = 6;
  for (let i = 0; i < ringCount; i++) {
    const yaw = (i / ringCount) * Math.PI * 2.0 + 0.22;
    const tall = i % 2 === 0;
    const w = tall ? 1.55 : 1.32;
    const h = tall ? 2.55 : 2.05;
    const plane = new THREE.PlaneGeometry(w, h, 3, 7);
    const pos = plane.attributes.position;
    const uv = plane.attributes.uv;

    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k);
      const v = uv.getY(k);
      const uc = (u - 0.5) * 2.0;
      // Full lower base hugging hammer head, tapering organically toward tips
      const widthScale = 0.92 + Math.sin(v * Math.PI) * 0.18 - v * v * 0.28;
      const lx = pos.getX(k) * widthScale;
      const ly = (v - 0.14) * h;
      // Concave outward cup + gentle inward tip curl
      const cup = -0.26 * (1.0 - uc * uc) * (0.35 + 0.65 * Math.sin(v * Math.PI));
      const flare = 0.42 + Math.sin(v * Math.PI * 0.95) * 0.30 - Math.pow(v, 1.7) * 0.34;
      const lz = cup + flare;
      // Helical flame twist
      const tw = (tall ? 0.52 : -0.46) * Math.pow(v, 1.3);
      const ct = Math.cos(tw);
      const st = Math.sin(tw);
      pos.setXYZ(k, lx * ct - lz * st, ly, lx * st + lz * ct);
    }

    plane.rotateY(yaw);
    // Tilt alternating petals slightly out along hammer strike faces for full 3D silhouette
    plane.rotateZ(tall ? 0.22 : -0.28);
    plane.computeVertexNormals();
    parts.push(normalizeGeomForMerge(plane));
  }

  // 2. 3 intersecting central licking spine fins for rich volume from top-down & low cutscene cameras
  for (let i = 0; i < 3; i++) {
    const yaw = (i / 3) * Math.PI + 0.52;
    const w = 1.85;
    const h = 2.75 + (i === 1 ? 0.35 : 0.0);
    const plane = new THREE.PlaneGeometry(w, h, 3, 8);
    const pos = plane.attributes.position;
    const uv = plane.attributes.uv;

    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k);
      const v = uv.getY(k);
      const uc = (u - 0.5) * 2.0;
      const lx = pos.getX(k) * (1.0 + Math.sin(v * Math.PI) * 0.14 - v * v * 0.30);
      const ly = (v - 0.18) * h;
      const lz = 0.24 * (1.0 - uc * uc) * Math.sin(v * Math.PI);
      const tw = (i % 2 === 0 ? 0.62 : -0.56) * Math.pow(v, 1.25);
      const ct = Math.cos(tw);
      const st = Math.sin(tw);
      pos.setXYZ(k, lx * ct - lz * st, ly, lx * st + lz * ct);
    }

    plane.rotateY(yaw);
    plane.rotateX(i === 1 ? 0.36 : -0.22);
    plane.computeVertexNormals();
    parts.push(normalizeGeomForMerge(plane));
  }

  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

/**
 * Curved swept volcanic flame wake ribbons streaming backward off the hammer head (flowAxis: 'u').
 * u = 0 sits at the incandescent leading edge on the hammer head -> u = 1 tears into trailing flames.
 */
function buildUnitHammerFireTrailGeometry() {
  const parts = [];
  const ribbonSpecs = [
    { roll: 0.0,   pitch:  0.18, len: 3.9, width: 1.55, arcCurve: 0.82, twist:  0.65 },
    { roll: 1.05,  pitch: -0.22, len: 3.5, width: 1.38, arcCurve: 0.72, twist: -0.58 },
    { roll: 2.10,  pitch:  0.12, len: 3.2, width: 1.25, arcCurve: 0.68, twist:  0.52 }
  ];

  for (let r = 0; r < ribbonSpecs.length; r++) {
    const sp = ribbonSpecs[r];
    const plane = new THREE.PlaneGeometry(sp.len, sp.width, 10, 3);
    const pos = plane.attributes.position;
    const uv = plane.attributes.uv;

    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k); // 0 = hammer head leading edge, 1 = fire tail
      const v = uv.getY(k); // 0..1 across ribbon width
      const vc = (v - 0.5) * 2.0;

      // Sweep backwards along -Z and slightly up along +Y in a curved comet-wake arc
      const sweepDist = u * sp.len;
      const wScale = 0.72 + Math.sin(u * Math.PI * 0.85) * 0.45 - u * u * 0.35;
      const halfSpan = vc * (sp.width * 0.5) * wScale;

      const tw = sp.twist * u;
      const ct = Math.cos(tw);
      const st = Math.sin(tw);

      const lx = halfSpan * ct + Math.sin(u * Math.PI) * sp.arcCurve * 0.35;
      const ly = halfSpan * st + Math.pow(u, 1.35) * sp.arcCurve;
      const lz = -sweepDist * 0.92 + 0.35;

      pos.setXYZ(k, lx, ly, lz);
    }

    plane.rotateX(sp.pitch);
    plane.rotateZ(sp.roll);
    plane.computeVertexNormals();
    parts.push(normalizeGeomForMerge(plane));
  }

  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

function acquireSharedResources() {
  if (!sharedResources) {
    const { microBumpMap, microRoughnessMap } = buildBossMicroPbrMaps();
    const emberHaloTex = buildSoftEmberHaloTexture();
    const hammerFireCrownGeo = buildUnitHammerFireCrownGeometry();
    const hammerFireTrailGeo = buildUnitHammerFireTrailGeometry();
    sharedResources = {
      microBumpMap,
      microRoughnessMap,
      emberHaloTex,
      hammerFireCrownGeo,
      hammerFireTrailGeo
    };
  }
  SHARED_MICRO_ROUGH_UNIFORM.value = sharedResources.microRoughnessMap;
  SHARED_MICRO_BUMP_UNIFORM.value = sharedResources.microBumpMap;
  sharedRefCount += 1;
  return sharedResources;
}

function releaseSharedResources() {
  sharedRefCount = Math.max(0, sharedRefCount - 1);
  if (sharedRefCount === 0 && sharedResources) {
    SHARED_MICRO_ROUGH_UNIFORM.value = null;
    SHARED_MICRO_BUMP_UNIFORM.value = null;
    sharedResources.microBumpMap?.dispose();
    sharedResources.microRoughnessMap?.dispose();
    sharedResources.emberHaloTex?.dispose();
    sharedResources.hammerFireCrownGeo?.dispose();
    sharedResources.hammerFireTrailGeo?.dispose();
    sharedResources = null;
  }
}

// ============================================================================
// Material Micro-Detail & Phase-2 Volcanic Coal-Crack Injection (Skinning-Safe)
// ============================================================================
function createBossHeatUniforms(microRoughMap) {
  return {
    uBossTime: { value: 0.0 },
    uBossHeat: { value: 0.16 },
    uBossWindup: { value: 0.0 },
    uBossPhase2: { value: 0.0 },
    uBossStaggerDim: { value: 1.0 },
    uBossMicroRoughMap: { value: microRoughMap }
  };
}

function isHammerLikeMesh(mesh, mat, meshIndex, totalMeshes) {
  const meshName = mesh?.name || '';
  const matName = mat?.name || '';
  if (/hammer|maul|mace|weapon|5a64b2bb/i.test(meshName) || /hammer|maul|mace|weapon|5a64b2bb/i.test(matName)) {
    return true;
  }
  // Troll_Tripo.glb has 2 primitives: prim 0 = Troll body (centered around X=0), prim 1 = Warhammer (offset X < -0.25)
  if (totalMeshes >= 2 && meshIndex === 1 && mesh?.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb) {
      const cx = (bb.min.x + bb.max.x) * 0.5;
      if (Math.abs(cx) > 0.22) return true;
    }
  }
  return false;
}

function patchBossMaterial(mat, shared, heatUniforms, isWeaponMesh, touchedSet) {
  if (!mat || !(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) return null;
  if (touchedSet.has(mat)) return patchedMaterialRecords.get(mat) || null;
  touchedSet.add(mat);

  let rec = patchedMaterialRecords.get(mat);
  if (rec) {
    rec.refCount += 1;
    rec.uniformBindTargets.add(heatUniforms);
    rec.isWeapon = rec.isWeapon || isWeaponMesh;
    return rec;
  }

  const hadOwnOnBeforeCompile =
    Object.prototype.hasOwnProperty.call(mat, 'onBeforeCompile') && typeof mat.onBeforeCompile === 'function';
  const prevOnBeforeCompile = hadOwnOnBeforeCompile ? mat.onBeforeCompile : null;
  const hadOwnCacheKey =
    Object.prototype.hasOwnProperty.call(mat, 'customProgramCacheKey') && typeof mat.customProgramCacheKey === 'function';
  const prevCacheKey = hadOwnCacheKey ? mat.customProgramCacheKey : null;

  const hadRoughnessMap = Boolean(mat.roughnessMap);

  // Reuse stable per-material uniform holders across dispose/re-enhance cycles so Three.js WebGLPrograms
  // cache hits NEVER hold stale uniform object references or trigger extra shader recompiles!
  mat.userData = mat.userData || {};
  let matUniforms = mat.userData.__soulsBossUniforms;
  if (!matUniforms) {
    matUniforms = {
      uBossTime: { value: 0.0 },
      uBossHeat: { value: heatUniforms.uBossHeat.value },
      uBossWindup: { value: heatUniforms.uBossWindup.value },
      uBossPhase2: { value: heatUniforms.uBossPhase2.value },
      uBossStaggerDim: { value: heatUniforms.uBossStaggerDim.value },
      uBossIsWeapon: { value: isWeaponMesh ? 1.0 : 0.0 },
      uBossMicroRoughMap: SHARED_MICRO_ROUGH_UNIFORM,
      uBossMicroBumpMap: SHARED_MICRO_BUMP_UNIFORM
    };
    mat.userData.__soulsBossUniforms = matUniforms;
  } else {
    matUniforms.uBossTime.value = 0.0;
    matUniforms.uBossHeat.value = heatUniforms.uBossHeat.value;
    matUniforms.uBossWindup.value = heatUniforms.uBossWindup.value;
    matUniforms.uBossPhase2.value = heatUniforms.uBossPhase2.value;
    matUniforms.uBossStaggerDim.value = heatUniforms.uBossStaggerDim.value;
    matUniforms.uBossIsWeapon.value = isWeaponMesh ? 1.0 : 0.0;
    matUniforms.uBossMicroRoughMap = SHARED_MICRO_ROUGH_UNIFORM;
    matUniforms.uBossMicroBumpMap = SHARED_MICRO_BUMP_UNIFORM;
  }

  rec = {
    mat,
    refCount: 1,
    isWeapon: Boolean(isWeaponMesh),
    uniformBindTargets: new Set([heatUniforms]),
    uniforms: matUniforms,
    orig: {
      bumpMap: mat.bumpMap,
      bumpScale: mat.bumpScale,
      roughnessMap: mat.roughnessMap,
      roughness: mat.roughness,
      metalness: mat.metalness,
      envMapIntensity: mat.envMapIntensity,
      hadOwnOnBeforeCompile,
      prevOnBeforeCompile,
      hadOwnCacheKey,
      prevCacheKey
    }
  };

  // Sculptural PBR micro-relief & metallic sheen under PMREM IBL + 50° moonlit key light
  // (preserves original diffuse map & tangent-space normalMap 100% intact!)
  mat.bumpMap = shared.microBumpMap;
  mat.bumpScale = 0.036;
  mat.envMapIntensity = 1.45;
  mat.roughness = isWeaponMesh ? 0.48 : 0.50;
  mat.metalness = isWeaponMesh ? 0.36 : 0.30;
  if (!hadRoughnessMap) {
    mat.roughnessMap = shared.microRoughnessMap;
  }

  const cacheSuffix = hadRoughnessMap ? 'souls_boss_pbr_v2_mr' : 'souls_boss_pbr_v2';
  mat.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(mat) : '';
    return base ? `${base}|${cacheSuffix}` : cacheSuffix;
  };

  mat.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) prevOnBeforeCompile.call(mat, shader, renderer);
    shader.uniforms.uBossTime = rec.uniforms.uBossTime;
    shader.uniforms.uBossHeat = rec.uniforms.uBossHeat;
    shader.uniforms.uBossWindup = rec.uniforms.uBossWindup;
    shader.uniforms.uBossPhase2 = rec.uniforms.uBossPhase2;
    shader.uniforms.uBossStaggerDim = rec.uniforms.uBossStaggerDim;
    shader.uniforms.uBossIsWeapon = rec.uniforms.uBossIsWeapon;
    shader.uniforms.uBossMicroRoughMap = rec.uniforms.uBossMicroRoughMap;
    shader.uniforms.uBossMicroBumpMap = rec.uniforms.uBossMicroBumpMap;

    if (!shader.fragmentShader.includes('uBossHeat')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform float uBossTime;
uniform float uBossHeat;
uniform float uBossWindup;
uniform float uBossPhase2;
uniform float uBossStaggerDim;
uniform float uBossIsWeapon;
uniform sampler2D uBossMicroRoughMap;
uniform sampler2D uBossMicroBumpMap;`
      );

      // Subtle micro-cavity AO darkening in pores & forged gouges so armor & skin read deeper under moonlight
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_BUMPMAP
  float bossCavity = texture2D( uBossMicroRoughMap, vBumpMapUv ).r;
  diffuseColor.rgb *= mix( 0.84, 1.05, bossCavity );
#endif`
      );

      // Layer procedural microBumpMap ON TOP of tangent-space normalMap (Three.js r160 uses #elif by default)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
#if defined( USE_NORMALMAP ) && defined( USE_BUMPMAP )
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd() * 1.18, faceDirection );
#endif`
      );

      // Modulate existing GLB roughnessMap with our 256px forged-scratch/pore microRoughnessMap
      if (hadRoughnessMap) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
#ifdef USE_BUMPMAP
  float bossMicroR = texture2D( uBossMicroRoughMap, vBumpMapUv ).g;
  roughnessFactor = clamp( roughnessFactor * mix( 0.76, 1.24, bossMicroR ), 0.12, 0.96 );
#endif`
        );
      }

      // Smoldering volcanic coal cracks (Phase 2 & Cutscene Roar) + forged edge heat glow
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `if ( uBossHeat > 0.005 ) {
  float bossNdotV = clamp( dot( geometryNormal, geometryViewDir ), 0.0, 1.0 );
  float bossEdge = pow( max( 1.0 - bossNdotV, 0.0001 ), 2.45 );
  #ifdef USE_BUMPMAP
    vec3 bossMicroTex = texture2D( bumpMap, vBumpMapUv ).rgb;
    float bossCrevice = clamp( 1.0 - bossMicroTex.r * 1.18, 0.0, 1.0 );
    float bossCrack = smoothstep( 0.18, 0.78, bossMicroTex.g );
    float bossCrackCore = smoothstep( 0.56, 0.94, bossMicroTex.g );
  #else
    float bossCrevice = 0.32;
    float bossCrack = 0.25;
    float bossCrackCore = 0.12;
  #endif
  float bossCoalPulse = 0.78 + 0.22 * sin( uBossTime * 4.9 + bossCrack * 5.2 );
  float bossCrackGate = clamp( uBossPhase2 * 0.95 + uBossWindup * 0.42 + uBossIsWeapon * 0.35, 0.0, 1.0 );
  vec3 bossCrackCol = mix( vec3( 0.96, 0.18, 0.02 ), vec3( 1.0, 0.68, 0.18 ), bossCrackCore * ( 0.65 + 0.35 * uBossWindup ) );
  float bossCrackAmp = ( bossCrack * 0.62 + bossCrackCore * 0.85 ) * bossCrackGate * bossCoalPulse * mix( 0.58, 1.25, uBossIsWeapon );

  vec3 bossEmberCol = mix( vec3( 1.0, 0.32, 0.04 ), vec3( 1.0, 0.78, 0.30 ), clamp( uBossWindup * 0.85, 0.0, 1.0 ) );
  float bossEdgeAmp = ( bossCrevice * ( 0.30 + 0.48 * uBossPhase2 ) + bossEdge * ( 0.24 + 0.66 * uBossWindup ) ) * mix( 0.20, 0.85, uBossIsWeapon );

  outgoingLight += ( bossCrackCol * bossCrackAmp + bossEmberCol * bossEdgeAmp ) * ( uBossHeat * uBossStaggerDim * 0.52 );
}
#include <opaque_fragment>`
      );
    }
  };

  mat.needsUpdate = true;
  patchedMaterialRecords.set(mat, rec);
  return rec;
}

function releasePatchedMaterial(rec, heatUniforms) {
  if (!rec) return;
  rec.uniformBindTargets.delete(heatUniforms);
  rec.refCount = Math.max(0, rec.refCount - 1);
  if (rec.refCount > 0) return;

  const { mat, orig, uniforms } = rec;
  uniforms.uBossTime.value = 0.0;
  uniforms.uBossHeat.value = 0.0;
  uniforms.uBossWindup.value = 0.0;
  uniforms.uBossPhase2.value = 0.0;
  uniforms.uBossStaggerDim.value = 1.0;
  mat.bumpMap = orig.bumpMap;
  mat.bumpScale = orig.bumpScale;
  mat.roughnessMap = orig.roughnessMap;
  mat.roughness = orig.roughness;
  mat.metalness = orig.metalness;
  mat.envMapIntensity = orig.envMapIntensity;

  if (orig.hadOwnOnBeforeCompile) {
    mat.onBeforeCompile = orig.prevOnBeforeCompile;
  } else {
    delete mat.onBeforeCompile;
  }
  if (orig.hadOwnCacheKey) {
    mat.customProgramCacheKey = orig.prevCacheKey;
  } else {
    delete mat.customProgramCacheKey;
  }
  mat.needsUpdate = true;
  patchedMaterialRecords.delete(mat);
}

// ============================================================================
// Bind-Pose Bone Space Calibration (Invariant to Pose / -90° Mixamo Armature!)
// ============================================================================
function calibrateHammerLocalInRightHand(hammerMesh, rightHandBone) {
  const fallback = {
    offset: new THREE.Vector3(0.0, 0.24, 0.04),
    radius: 0.095
  };
  if (!hammerMesh?.geometry?.attributes?.position || !rightHandBone) return fallback;

  const skel = hammerMesh.isSkinnedMesh ? hammerMesh.skeleton : null;
  const posAttr = hammerMesh.geometry.attributes.position;
  if (!posAttr || posAttr.count < 4) return fallback;

  let matToRH = null;
  if (skel && Array.isArray(skel.bones) && Array.isArray(skel.boneInverses)) {
    const rhIdx = skel.bones.indexOf(rightHandBone);
    if (rhIdx >= 0 && skel.boneInverses[rhIdx]) {
      _calMatA.multiplyMatrices(skel.boneInverses[rhIdx], hammerMesh.bindMatrix);
      matToRH = _calMatA;
    }
  }
  if (!matToRH) return fallback;

  const stride = Math.max(1, Math.floor(posAttr.count / 1200));
  let maxDistSq = 0;
  for (let i = 0; i < posAttr.count; i += stride) {
    _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(matToRH);
    const dSq = _calVecA.lengthSq();
    if (dSq > maxDistSq) maxDistSq = dSq;
  }
  const maxDist = Math.sqrt(maxDistSq);
  if (!(maxDist > 0.02)) return fallback;

  const headThreshold = maxDist * 0.64;
  _calVecB.set(0, 0, 0);
  _calMin.set(1e6, 1e6, 1e6);
  _calMax.set(-1e6, -1e6, -1e6);
  let count = 0;

  for (let i = 0; i < posAttr.count; i += stride) {
    _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(matToRH);
    if (_calVecA.length() >= headThreshold) {
      _calVecB.add(_calVecA);
      _calMin.min(_calVecA);
      _calMax.max(_calVecA);
      count += 1;
    }
  }
  if (count < 2) return fallback;

  _calVecB.divideScalar(count);
  _calVecC.subVectors(_calMax, _calMin);
  const estRad = Math.max(0.045, Math.min(0.20, _calVecC.length() * 0.28));
  return {
    offset: _calVecB.clone(),
    radius: estRad
  };
}

function calibrateEyesInHeadBone(bodyMesh, headBone) {
  const fallback = {
    left: new THREE.Vector3(-0.022, 0.036, 0.046),
    right: new THREE.Vector3(0.022, 0.036, 0.046),
    forward: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
    eyeSize: 0.017
  };
  if (!bodyMesh?.geometry?.attributes?.position || !headBone) return fallback;

  const skel = bodyMesh.isSkinnedMesh ? bodyMesh.skeleton : null;
  const posAttr = bodyMesh.geometry.attributes.position;
  if (!skel || !posAttr || posAttr.count < 8) return fallback;

  const hdIdx = skel.bones.indexOf(headBone);
  if (hdIdx < 0 || !skel.boneInverses[hdIdx]) return fallback;

  _calMatA.copy(skel.boneInverses[hdIdx]).invert();
  const headOrigin = _calVecB.setFromMatrixPosition(_calMatA).clone();

  const stride = Math.max(1, Math.floor(posAttr.count / 2400));
  let headTopY = headOrigin.y + 0.05;
  let headHalfW = 0.045;
  let maxFrontZ = -1e6;

  for (let i = 0; i < posAttr.count; i += stride) {
    _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(bodyMesh.bindMatrix);
    if (_calVecA.y > headOrigin.y && Math.abs(_calVecA.x - headOrigin.x) < 0.095) {
      if (_calVecA.y > headTopY) headTopY = _calVecA.y;
      if (_calVecA.z > maxFrontZ) maxFrontZ = _calVecA.z;
    }
  }
  const headH = Math.max(0.04, headTopY - headOrigin.y);
  const eyeY = headOrigin.y + headH * 0.48;
  const bandY = Math.max(0.012, headH * 0.16);

  let eyeFrontZ = -1e6;
  let eyeMaxAbsX = 0;
  for (let i = 0; i < posAttr.count; i += stride) {
    _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(bodyMesh.bindMatrix);
    if (Math.abs(_calVecA.y - eyeY) <= bandY && Math.abs(_calVecA.x - headOrigin.x) < 0.085) {
      if (_calVecA.z > eyeFrontZ) eyeFrontZ = _calVecA.z;
      const ax = Math.abs(_calVecA.x - headOrigin.x);
      if (ax > eyeMaxAbsX) eyeMaxAbsX = ax;
    }
  }
  if (eyeFrontZ < -100) return fallback;
  headHalfW = Math.max(0.025, Math.min(0.07, eyeMaxAbsX));

  const eyeSep = headHalfW * 0.34;
  const eyeZ = eyeFrontZ + 0.0045;
  const invHead = skel.boneInverses[hdIdx];

  const left = new THREE.Vector3(headOrigin.x - eyeSep, eyeY, eyeZ).applyMatrix4(invHead);
  const right = new THREE.Vector3(headOrigin.x + eyeSep, eyeY, eyeZ).applyMatrix4(invHead);

  _calMatB.copy(invHead);
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(_calMatB).normalize();
  const up = new THREE.Vector3(0, 1, 0).transformDirection(_calMatB).normalize();
  const eyeSize = Math.max(0.011, Math.min(0.028, headH * 0.20));

  return { left, right, forward, up, eyeSize };
}

// ============================================================================
// GPU Hammer Ember Sparks & Single-Draw-Call Eye Glow
// ============================================================================
function createHammerEmberPoints(radius) {
  const count = SPARK_COUNT_DESKTOP;
  const rng = makeRng(0x88e3b3a1);
  const positions = new Float32Array(count * 3);
  const params = new Float32Array(count * 4); // speed, phase, driftDist, size
  const dirs = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const sinP = Math.sin(phi);
    const dx = sinP * Math.cos(theta);
    const dy = Math.cos(phi);
    const dz = sinP * Math.sin(theta);

    const r = radius * (0.42 + rng() * 0.68);
    positions[i * 3] = dx * r;
    positions[i * 3 + 1] = dy * r;
    positions[i * 3 + 2] = dz * r;

    dirs[i * 3] = dx;
    dirs[i * 3 + 1] = dy;
    dirs[i * 3 + 2] = dz;

    params[i * 4] = 0.78 + rng() * 1.22;
    params[i * 4 + 1] = rng();
    params[i * 4 + 2] = radius * (0.70 + rng() * 1.25);
    params[i * 4 + 3] = 0.072 + rng() * 0.088;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(params, 4));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  geo.setDrawRange(0, getTargetSparkCount());

  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.0 },
      uWindup: { value: 0.0 },
      uPhase2: { value: 0.0 },
      uPixelRatio: { value: Math.min(dpr, globalLowSpec ? 1.0 : IS_MOBILE_DEVICE ? 1.15 : 1.5) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      attribute vec4 aParam;
      attribute vec3 aDir;
      uniform float uTime;
      uniform float uIntensity;
      uniform float uWindup;
      uniform float uPhase2;
      uniform float uPixelRatio;
      varying float vLife;
      varying float vHeat;
      void main() {
        float speedMult = 0.88 + uPhase2 * 0.72 + uWindup * 1.20;
        float life = fract(uTime * aParam.x * speedMult + aParam.y);
        vLife = life;
        vHeat = clamp(0.48 + uPhase2 * 0.38 + uWindup * 0.68, 0.0, 1.45);

        float swirlAng = life * (4.1 + uPhase2 * 2.4) + aParam.y * 6.28318;
        float spread = aParam.z * (0.68 + uPhase2 * 0.58 + uWindup * 0.85) * life;
        vec3 p = position + aDir * spread;
        p.x += sin(swirlAng) * aParam.z * 0.26 * life;
        p.y += cos(swirlAng * 0.85) * aParam.z * 0.26 * life;
        p.z += sin(swirlAng * 1.15) * aParam.z * 0.20 * life;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float env = sin(life * 3.14159);
        float sizeScale = (0.55 + 0.65 * env) * (0.72 + 0.55 * uWindup + 0.38 * uPhase2) * clamp(uIntensity, 0.0, 1.35);
        gl_PointSize = clamp((aParam.w * 240.0 * uPixelRatio * sizeScale) / max(1.0, -mv.z), 1.0, 20.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      uniform float uWindup;
      varying float vLife;
      varying float vHeat;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.5, 0.05, d);
        if (soft < 0.02) discard;
        float fade = smoothstep(0.0, 0.12, vLife) * smoothstep(1.0, 0.42, vLife);
        vec3 colStart = mix(vec3(1.0, 0.88, 0.45), vec3(1.0, 0.98, 0.80), uWindup);
        vec3 colEnd = vec3(1.0, 0.22, 0.02);
        vec3 col = mix(colStart, colEnd, clamp(vLife * 1.15, 0.0, 1.0)) * vHeat;
        float alpha = soft * fade * clamp(uIntensity, 0.0, 1.0);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'hammerEmberSparks';
  points.frustumCulled = false;
  points.renderOrder = 7;
  points.userData.isSoulsBossVfx = true;
  return { points, geo, mat };
}

function createBossEyeGlowMesh(cal) {
  const rightAxis = new THREE.Vector3().crossVectors(cal.up, cal.forward).normalize();
  if (rightAxis.lengthSq() < 0.01) rightAxis.set(1, 0, 0);
  const upAxis = new THREE.Vector3().crossVectors(cal.forward, rightAxis).normalize();

  const w = cal.eyeSize * 1.15;
  const h = cal.eyeSize * 0.72;
  const centers = [cal.left, cal.right];
  const positions = new Float32Array(centers.length * 6 * 3);
  const uvs = new Float32Array(centers.length * 6 * 2);

  const corner = new THREE.Vector3();
  const quadCorners = [
    [-1, -1, 0, 0],
    [ 1, -1, 1, 0],
    [ 1,  1, 1, 1],
    [-1, -1, 0, 0],
    [ 1,  1, 1, 1],
    [-1,  1, 0, 1]
  ];

  let pi = 0;
  let ui = 0;
  for (let c = 0; c < centers.length; c++) {
    const center = centers[c];
    for (let k = 0; k < 6; k++) {
      const q = quadCorners[k];
      corner
        .copy(center)
        .addScaledVector(rightAxis, q[0] * w)
        .addScaledVector(upAxis, q[1] * h);
      positions[pi++] = corner.x;
      positions[pi++] = corner.y;
      positions[pi++] = corner.z;
      uvs[ui++] = q[2];
      uvs[ui++] = q[3];
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uIntensity: { value: 0.75 },
      uPhase2: { value: 0.0 },
      uWindup: { value: 0.0 },
      uStaggerDim: { value: 1.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      uniform float uPhase2;
      uniform float uWindup;
      uniform float uStaggerDim;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - vec2(0.5)) * vec2(2.0, 2.6);
        float d = length(p);
        float halo = smoothstep(1.0, 0.06, d);
        float pupil = smoothstep(0.42, 0.02, d);
        if (halo < 0.02) discard;
        vec3 emberCol = mix(vec3(1.0, 0.44, 0.08), vec3(1.0, 0.20, 0.03), uPhase2);
        vec3 coreCol = mix(vec3(1.0, 0.86, 0.44), vec3(1.0, 0.96, 0.74), uWindup);
        vec3 col = mix(emberCol, coreCol, pupil);
        float alpha = (halo * 0.72 + pupil * 0.65) * uIntensity * uStaggerDim;
        gl_FragColor = vec4(col * (1.0 + uPhase2 * 0.40 + uWindup * 0.55), clamp(alpha, 0.0, 1.0));
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'bossEyeEmberGlow';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.userData.isSoulsBossVfx = true;
  return { mesh, geo, mat };
}

function getTargetSparkCount() {
  if (globalLowSpec) return SPARK_COUNT_LOWSPEC;
  if (IS_MOBILE_DEVICE) return SPARK_COUNT_MOBILE;
  return SPARK_COUNT_DESKTOP;
}

function applyLowSpecToState(state) {
  if (!state || state.disposed) return;
  const sparkCount = getTargetSparkCount();
  if (state.emberGeo) {
    state.emberGeo.setDrawRange(0, sparkCount);
  }
  if (state.emberMat) {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    state.emberMat.uniforms.uPixelRatio.value = Math.min(
      dpr,
      globalLowSpec ? 1.0 : IS_MOBILE_DEVICE ? 1.15 : 1.5
    );
  }
  if (state.hammerFireCrownMat?.setLowSpec) {
    state.hammerFireCrownMat.setLowSpec(globalLowSpec);
  }
  if (state.hammerFireTrailMat?.setLowSpec) {
    state.hammerFireTrailMat.setLowSpec(globalLowSpec);
  }
  if (state.hammerFireTrailMesh && globalLowSpec) {
    // Low-spec drops the secondary additive fire trail ribbon (saves 1 DC + fragment fill-rate)
    state.hammerFireTrailMesh.visible = false;
  }
}

// ============================================================================
// Public API
// ============================================================================
function resolveBossObject(bossRoot) {
  if (!bossRoot) return null;
  if (bossRoot.isObject3D) return bossRoot;
  if (bossRoot.obj?.isObject3D) return bossRoot.obj;
  if (bossRoot.root?.isObject3D) return bossRoot.root;
  return null;
}

/**
 * Enhances the Souls Boss (Troll) 3D model with:
 * - Procedural 256px micro-bump + micro-roughness + volcanic coal-crack PBR detail
 * - Real volumetric Simplex FBM roaring fire crown & swept fire trail on the warhammer head
 *   (`createHammerFireTrailMaterial` from soulsFireVfx.js), 0 extra PointLights
 * - GPU rising ember spark trail (`Points`) & single-draw-call smoldering eye glow
 * 100% Mixamo-safe (never mutates bone transforms or clips) & idempotent.
 */
export function enhanceSoulsBossModel(bossRoot, options = {}) {
  const root = resolveBossObject(bossRoot);
  if (!root) return null;

  if (root.userData?.soulsBossVisuals && !root.userData.soulsBossVisuals.disposed) {
    return root.userData.soulsBossVisuals;
  }

  const shared = acquireSharedResources();
  const heatUniforms = createBossHeatUniforms(shared.microRoughnessMap);

  const meshes = [];
  let rightHandBone = null;
  let headBone = null;
  let chestBone = null;

  root.traverse((n) => {
    if (n.userData?.isSoulsBossVfx) return;
    const nm = n.name || '';
    if (n.isMesh && n.material && !/Eyes/i.test(nm)) {
      meshes.push(n);
    }
    if (!rightHandBone && (/^(mixamorig:?)?RightHand$/i.test(nm) || /^handslot\.?r$/i.test(nm) || /^hand\.?r$/i.test(nm))) {
      rightHandBone = n;
    }
    if (!headBone && /^(mixamorig:?)?Head$/i.test(nm)) {
      headBone = n;
    }
    if (!chestBone && /^(mixamorig:?)?(Spine2|Chest|UpperChest)$/i.test(nm)) {
      chestBone = n;
    }
  });

  // 1. Enhance PBR micro-relief & Phase-2 volcanic coal-crack glow without breaking diffuse/normal maps
  const patchedRecs = [];
  const touchedMats = new Set();
  let hammerMesh = null;
  let bodyMesh = null;

  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const firstMat = mats[0] || null;
    const isWeapon = isHammerLikeMesh(m, firstMat, i, meshes.length);
    if (isWeapon && !hammerMesh) hammerMesh = m;
    if (!isWeapon && !bodyMesh) bodyMesh = m;

    for (let j = 0; j < mats.length; j++) {
      const rec = patchBossMaterial(mats[j], shared, heatUniforms, isWeapon, touchedMats);
      if (rec) patchedRecs.push(rec);
    }
  }
  if (!bodyMesh && meshes.length > 0) bodyMesh = meshes[0];

  // 2. Attach Real Volumetric Hammer Fire Crown + Swept Fire Trail + Tight Glow Halo + GPU Sparks
  const hammerCal = calibrateHammerLocalInRightHand(hammerMesh || bodyMesh, rightHandBone);
  const hammerAttachParent = rightHandBone || root;
  const hammerEmberCore = new THREE.Group();
  hammerEmberCore.name = 'hammerEmberCore';
  hammerEmberCore.userData.isSoulsBossVfx = true;
  if (rightHandBone) {
    hammerEmberCore.position.copy(hammerCal.offset);
  } else {
    hammerEmberCore.position.set(-0.45, 1.35, 0.35);
  }

  // Primary roaring 3D flame crown wreathing the warhammer head (NormalBlending, sharp silhouettes!)
  const hammerFireCrownMat = createHammerFireTrailMaterial({
    flowAxis: 'v',
    additive: false,
    intensity: 0.42,
    phase2: 0.0,
    windup: 0.0,
    speed: 4.5,
    vertexDistort: hammerCal.radius * 0.28,
    isMobile: IS_MOBILE_DEVICE,
    lowSpec: globalLowSpec
  });
  const hammerFireCrownMesh = new THREE.Mesh(shared.hammerFireCrownGeo, hammerFireCrownMat);
  hammerFireCrownMesh.name = 'hammerFireCrown';
  hammerFireCrownMesh.scale.setScalar(hammerCal.radius);
  hammerFireCrownMesh.frustumCulled = false;
  hammerFireCrownMesh.renderOrder = 5;
  hammerFireCrownMesh.userData.isSoulsBossVfx = true;
  hammerEmberCore.add(hammerFireCrownMesh);

  // Secondary swept incandescent flame trail streaming off swings / Act 3 Roar / Phase 2 (off in LowSpec)
  const hammerFireTrailMat = createHammerFireTrailMaterial({
    flowAxis: 'u',
    additive: true,
    intensity: 0.0,
    phase2: 0.0,
    windup: 0.0,
    speed: 5.6,
    vertexDistort: hammerCal.radius * 0.36,
    isMobile: IS_MOBILE_DEVICE,
    lowSpec: globalLowSpec
  });
  const hammerFireTrailMesh = new THREE.Mesh(shared.hammerFireTrailGeo, hammerFireTrailMat);
  hammerFireTrailMesh.name = 'hammerFireTrail';
  hammerFireTrailMesh.scale.setScalar(hammerCal.radius);
  hammerFireTrailMesh.visible = false;
  hammerFireTrailMesh.frustumCulled = false;
  hammerFireTrailMesh.renderOrder = 6;
  hammerFireTrailMesh.userData.isSoulsBossVfx = true;
  hammerEmberCore.add(hammerFireTrailMesh);

  // Tight volumetric warm ember halo sprite (replaces expensive PointLight — 0 extra PointLights!)
  const haloMat = new THREE.SpriteMaterial({
    map: shared.emberHaloTex,
    color: new THREE.Color(0xff6b1a),
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const hammerHaloSprite = new THREE.Sprite(haloMat);
  hammerHaloSprite.name = 'hammerEmberHalo';
  const baseHaloScale = hammerCal.radius * 3.10;
  hammerHaloSprite.scale.set(baseHaloScale, baseHaloScale, 1);
  hammerHaloSprite.frustumCulled = false;
  hammerHaloSprite.renderOrder = 4;
  hammerHaloSprite.userData.isSoulsBossVfx = true;
  hammerEmberCore.add(hammerHaloSprite);

  // GPU-animated rising ember/spark trail around hammer head
  const { points: hammerEmberPoints, geo: emberGeo, mat: emberMat } = createHammerEmberPoints(hammerCal.radius);
  hammerEmberPoints.visible = false;
  hammerEmberCore.add(hammerEmberPoints);
  hammerAttachParent.add(hammerEmberCore);

  // 3. Attach Smoldering Eye Glow to Head bone (1 single draw call)
  let eyeGlowMesh = null;
  let eyeGlowGeo = null;
  let eyeGlowMat = null;
  const eyeAttachParent = headBone || chestBone || null;
  if (eyeAttachParent && options.disableEyes !== true) {
    const eyeCal = calibrateEyesInHeadBone(bodyMesh, headBone);
    const builtEyes = createBossEyeGlowMesh(eyeCal);
    eyeGlowMesh = builtEyes.mesh;
    eyeGlowGeo = builtEyes.geo;
    eyeGlowMat = builtEyes.mat;
    eyeAttachParent.add(eyeGlowMesh);
  }

  // Reusable combat-state scratch objects for zero-allocation setCombatState() calls every frame!
  const crownCombatState = { heat: 0.42, intensity: 0.42, phase2: 0.0, windup: 0.0, staggerDim: 1.0 };
  const trailCombatState = { heat: 0.0, intensity: 0.0, phase2: 0.0, windup: 0.0, staggerDim: 1.0 };

  const state = {
    root,
    disposed: false,
    localTime: 0,
    phase2Blend: 0,
    windupBlend: 0,
    staggerBlend: 0,
    roarBlend: 0,
    baseHammerRadius: hammerCal.radius,
    baseHaloScale,
    heatUniforms,
    patchedRecs,
    crownCombatState,
    trailCombatState,
    hammerEmberCore,
    hammerFireCrownMesh,
    hammerFireCrownMat,
    hammerFireTrailMesh,
    hammerFireTrailMat,
    // Backward-compatible alias so callers inspecting hammerCoreMesh still see the active primary flame mesh
    hammerCoreMesh: hammerFireCrownMesh,
    hammerHaloSprite,
    haloMat,
    hammerEmberPoints,
    emberGeo,
    emberMat,
    eyeGlowMesh,
    eyeGlowGeo,
    eyeGlowMat,
    rightHandBone,
    headBone,
    setLowSpec(enabled) {
      setLowSpec(enabled);
    },
    update(dt, params) {
      updateSoulsBossVisuals(root, dt, params);
    },
    dispose() {
      disposeSoulsBossVisuals(root);
    }
  };

  applyLowSpecToState(state);
  activeBossStates.add(state);

  root.userData = root.userData || {};
  root.userData.soulsBossVisuals = state;
  return state;
}

/**
 * Updates Boss visual intensity smoothly with ZERO per-frame JS allocations:
 * - Real roaring volcanic fire crown & swept trail on the warhammer via `.setCombatState(...)`
 * - Heavy Windup (`isWindup`): intense golden-white ignition flare + sweeping fire wake + fast sparks
 * - Act 3 Cutscene Roar (`isCutsceneRoar` / `cutsceneRoar` / `bossRoarPeak` / `cutsceneAct === 3`):
 *   dramatic volcanic ignition surge as Boss rises from the throne & roars
 * - Phase 2 (`phase2Enraged`, HP < 50%): fierce roaring hammer flames + glowing coal cracks across armor & hammer
 * - Staggered (`isStaggered`): smoothly dims flames & coal cracks down to dying ash
 */
export function updateSoulsBossVisuals(
  bossRoot,
  dt,
  {
    phase2Enraged = false,
    isWindup = false,
    isStaggered = false,
    isCutsceneRoar = false,
    cutsceneRoar = false,
    bossRoarPeak = false,
    cutsceneAct = 0,
    elapsed = 0
  } = {}
) {
  const root = resolveBossObject(bossRoot);
  const state = root?.userData?.soulsBossVisuals;
  if (!state || state.disposed) return;

  const safeDt = Number.isFinite(dt) ? (dt < 0 ? 0 : dt > 0.1 ? 0.1 : dt) : 0.016;
  state.localTime += safeDt;
  const t = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : state.localTime;

  const roarActive = Boolean(isCutsceneRoar || cutsceneRoar || bossRoarPeak || cutsceneAct === 3);
  const targetP2 = phase2Enraged ? 1.0 : 0.0;
  const targetWindup = isWindup && !isStaggered ? 1.0 : 0.0;
  const targetStagger = isStaggered ? 1.0 : 0.0;
  const targetRoar = roarActive && !isStaggered ? 1.0 : 0.0;

  const kP2 = 1.0 - Math.exp(-(phase2Enraged ? 3.2 : 2.6) * safeDt);
  const kWindup = 1.0 - Math.exp(-(targetWindup > state.windupBlend ? 14.0 : 5.8) * safeDt);
  const kStagger = 1.0 - Math.exp(-(isStaggered ? 10.5 : 3.6) * safeDt);
  const kRoar = 1.0 - Math.exp(-(targetRoar > state.roarBlend ? 7.5 : 3.0) * safeDt);

  state.phase2Blend += (targetP2 - state.phase2Blend) * kP2;
  state.windupBlend += (targetWindup - state.windupBlend) * kWindup;
  state.staggerBlend += (targetStagger - state.staggerBlend) * kStagger;
  state.roarBlend += (targetRoar - state.roarBlend) * kRoar;

  const p2 = state.phase2Blend;
  const wu = state.windupBlend;
  const stg = state.staggerBlend;
  const roar = state.roarBlend;
  const staggerDim = 1.0 - stg * 0.84;

  // Combined theatrical surge (windup or Act 3 throne roar drives dramatic fire intensification)
  const flare = wu > roar * 0.92 ? wu : roar * 0.92;
  const effPhase2 = p2 > roar * 0.78 ? p2 : roar * 0.78;

  // Dual-harmonic organic combustion pulse
  const slowPulse = Math.sin(t * 2.45) * 0.5 + 0.5;
  const fastPulse = Math.sin(t * 5.8) * 0.65 + Math.sin(t * 12.7) * 0.35;
  const pulse = (0.14 * slowPulse) * (1.0 - effPhase2) + (0.28 * (fastPulse * 0.5 + 0.5)) * effPhase2;

  const baseHeat = 0.22 + effPhase2 * 0.72 + flare * 0.68 + pulse;
  const effectiveHeat = baseHeat * staggerDim;

  // 1. Sync PBR armor/skin/hammer shader uniforms (volcanic coal cracks + rim heat, 0 allocations)
  const recs = state.patchedRecs;
  for (let i = 0; i < recs.length; i++) {
    const u = recs[i].uniforms;
    u.uBossTime.value = t;
    u.uBossHeat.value = effectiveHeat;
    u.uBossWindup.value = flare;
    u.uBossPhase2.value = effPhase2;
    u.uBossStaggerDim.value = staggerDim;
  }

  // 2. Real Volumetric Simplex FBM Fire Crown on Hammer Head (createHammerFireTrailMaterial)
  const crownMat = state.hammerFireCrownMat;
  const crownMesh = state.hammerFireCrownMesh;
  if (crownMat && crownMesh) {
    const crownInt = (0.44 + effPhase2 * 0.66 + flare * 0.62 + pulse * 0.24) * staggerDim;
    const cs = state.crownCombatState;
    cs.heat = crownInt;
    cs.intensity = crownInt;
    cs.phase2 = effPhase2;
    cs.windup = flare;
    cs.staggerDim = staggerDim;
    crownMat.setCombatState(cs);
    crownMat.update(t, safeDt);

    const crownVis = crownInt > 0.04;
    crownMesh.visible = crownVis;
    if (crownVis) {
      const rBase = state.baseHammerRadius;
      const sx = rBase * (0.86 + effPhase2 * 0.30 + flare * 0.34 + pulse * 0.12) * (0.68 + 0.32 * staggerDim);
      const sy = rBase * (0.84 + effPhase2 * 0.44 + flare * 0.52 + pulse * 0.18) * (0.62 + 0.38 * staggerDim);
      crownMesh.scale.set(sx, sy, sx);
    }
  }

  // 3. Swept Volcanic Fire Trail Ribbons (blazes on Windup, Act 3 Cutscene Roar & Phase 2; off in LowSpec)
  const trailMat = state.hammerFireTrailMat;
  const trailMesh = state.hammerFireTrailMesh;
  if (trailMat && trailMesh) {
    const trailInt = globalLowSpec ? 0.0 : (effPhase2 * 0.88 + flare * 1.10) * staggerDim;
    const trailVis = trailInt > 0.05;
    trailMesh.visible = trailVis;
    if (trailVis) {
      const ts = state.trailCombatState;
      ts.heat = trailInt;
      ts.intensity = trailInt;
      ts.phase2 = effPhase2;
      ts.windup = flare;
      ts.staggerDim = staggerDim;
      trailMat.setCombatState(ts);
      trailMat.update(t, safeDt);

      const rBase = state.baseHammerRadius;
      const trailScale = rBase * (0.88 + effPhase2 * 0.28 + flare * 0.42);
      trailMesh.scale.set(trailScale, trailScale, trailScale * (0.95 + flare * 0.35));
    }
  }

  // 4. Tight Volumetric Hammer Halo Sprite (0 extra PointLights!)
  const halo = state.hammerHaloSprite;
  if (halo) {
    const haloScale = state.baseHaloScale * (0.72 + effPhase2 * 0.42 + flare * 0.52 + pulse * 0.16) * (0.52 + 0.48 * staggerDim);
    halo.scale.set(haloScale, haloScale, 1);

    const haloOp = (0.18 + effPhase2 * 0.30 + flare * 0.36 + pulse * 0.10) * staggerDim;
    state.haloMat.opacity = haloOp > 0.85 ? 0.85 : haloOp < 0 ? 0 : haloOp;

    const r = 1.0;
    const g = 0.44 - effPhase2 * 0.14 + flare * 0.34 - stg * 0.16;
    const b = 0.10 - effPhase2 * 0.05 + flare * 0.24 - stg * 0.04;
    state.haloMat.color.setRGB(
      r,
      g < 0.08 ? 0.08 : g > 1.0 ? 1.0 : g,
      b < 0.02 ? 0.02 : b > 0.72 ? 0.72 : b
    );
  }

  // 5. GPU Hammer Ember Spark Trail (Points — surges on Windup, Act 3 Roar & Phase 2)
  const sparks = state.hammerEmberPoints;
  if (sparks) {
    const rawSparkInt = (effPhase2 * 0.92 + flare * 1.12 + (globalLowSpec ? 0.0 : 0.12)) * staggerDim;
    const sparkVisible = rawSparkInt > 0.035;
    sparks.visible = sparkVisible;
    if (sparkVisible) {
      const eu = state.emberMat.uniforms;
      eu.uTime.value = t;
      eu.uIntensity.value = rawSparkInt > 1.3 ? 1.3 : rawSparkInt;
      eu.uWindup.value = flare;
      eu.uPhase2.value = effPhase2;
    }
  }

  // 6. Boss Eye Ember Glow
  if (state.eyeGlowMat) {
    const eyU = state.eyeGlowMat.uniforms;
    eyU.uIntensity.value = 0.68 + effPhase2 * 0.45 + flare * 0.42 + pulse * 0.22;
    eyU.uPhase2.value = effPhase2;
    eyU.uWindup.value = flare;
    eyU.uStaggerDim.value = staggerDim;
  }
}

/**
 * Toggles low-spec mobile preset (Yandex Games Mobile):
 * drops Simplex FBM detail to 2 octaves on hammer flames, hides secondary swept trail ribbon,
 * reduces GPU spark drawRange to 10, and caps point pixelRatio at 1.0.
 */
export function setLowSpec(enabled = false) {
  const next = Boolean(enabled);
  if (next === globalLowSpec) return globalLowSpec;
  globalLowSpec = next;

  if (sharedResources) {
    const aniso = globalLowSpec || IS_MOBILE_DEVICE ? 1 : 4;
    sharedResources.microBumpMap.anisotropy = aniso;
    sharedResources.microRoughnessMap.anisotropy = aniso;
  }
  for (const st of activeBossStates) {
    applyLowSpecToState(st);
  }
  return globalLowSpec;
}

export function getLowSpec() {
  return globalLowSpec;
}

/**
 * Cleanly detaches and disposes all per-boss VFX resources (including hammer fire materials),
 * restores shared GLB materials, and releases shared procedural textures & geometries
 * when the last enhanced boss is disposed (0 WebGL leaks).
 */
export function disposeSoulsBossVisuals(bossRoot) {
  const root = resolveBossObject(bossRoot);
  const state = root?.userData?.soulsBossVisuals;
  if (!state || state.disposed) return;
  state.disposed = true;

  if (state.hammerEmberCore?.parent) {
    state.hammerEmberCore.parent.remove(state.hammerEmberCore);
  }
  if (state.eyeGlowMesh?.parent) {
    state.eyeGlowMesh.parent.remove(state.eyeGlowMesh);
  }

  state.hammerFireCrownMat?.dispose();
  state.hammerFireTrailMat?.dispose();
  state.haloMat?.dispose();
  state.emberGeo?.dispose();
  state.emberMat?.dispose();
  state.eyeGlowGeo?.dispose();
  state.eyeGlowMat?.dispose();

  for (let i = 0; i < state.patchedRecs.length; i++) {
    releasePatchedMaterial(state.patchedRecs[i], state.heatUniforms);
  }
  state.patchedRecs.length = 0;

  activeBossStates.delete(state);
  releaseSharedResources();

  if (root.userData && root.userData.soulsBossVisuals === state) {
    delete root.userData.soulsBossVisuals;
  }
}

export function getSoulsBossVisualStats() {
  return {
    activeBosses: activeBossStates.size,
    sharedRefCount,
    hasSharedResources: Boolean(sharedResources),
    lowSpec: globalLowSpec,
    isMobile: IS_MOBILE_DEVICE,
    targetSparkCount: getTargetSparkCount()
  };
}
