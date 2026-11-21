// Visual Upgrade Module for the Chapter 26 Boss (`Rift_Boss_Tripo.glb` & PvE `Troll_Tripo.glb`)
// Three.js r160 — 100% Mixamo-clip safe (never mutates bone transforms or AnimationMixer tracks):
//   - Real physical warm flickering `THREE.PointLight` on the Boss's right-shoulder iron lantern (PC, decay=2, dist=6.8, 0xff8c2b, base=1.25)
//   - Living fiery grin & eye furnace luminescence pulsing warmly in lip-sync with `mouthOpen01` speech and Phase-2 enrage (soft-knee anti-clipping!)
//   - Real volumetric Simplex FBM fire crown & swept trail attached to `mixamorig:WeaponHammer` (with fallback to `mixamorig:RightHand` for legacy `Troll_Tripo.glb`)
//   - Enhanced 256px procedural PBR micro-relief + Phase-2 smoldering volcanic coal cracks (preserves Cycles ORM & emissiveMap!)
//   - Zero per-frame JS allocations & ref-counted GPU resources with strict `.dispose()` (0 WebGL leaks).

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { createHammerFireTrailMaterial } from './soulsFireVfx.js?v=20261121z68';

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

// Physical right-shoulder iron lantern PointLight constants (PC only; Mobile uses 0 extra PointLights)
// Balanced warm amber rim glow that preserves crisp dark-fantasy self-shadows on hood & arms
const LANTERN_LIGHT_COLOR_HEX = 0xff8c2b;
const LANTERN_LIGHT_DISTANCE = 6.8;
const LANTERN_LIGHT_DECAY = 2.0;
const LANTERN_LIGHT_BASE_INTENSITY = 1.25;

// Ref-counted shared procedural assets (created lazily, disposed automatically at refCount === 0)
let sharedResources = null;
let sharedRefCount = 0;
// Persistent uniform wrappers so reused WebGLPrograms always sample live textures (0 stale re-uploads!)
const SHARED_MICRO_ROUGH_UNIFORM = { value: null };
const SHARED_MICRO_BUMP_UNIFORM = { value: null };

// Reusable scratch objects strictly for one-time enhanceSoulsBossModel calibration
const _calMatA = new THREE.Matrix4();
const _calMatB = new THREE.Matrix4();
const _calVecA = new THREE.Vector3();
const _calVecB = new THREE.Vector3();
const _calVecC = new THREE.Vector3();
const _calMin = new THREE.Vector3();
const _calMax = new THREE.Vector3();
// Reusable scratch quaternion for per-frame buoyant flame crown alignment (0 allocations!)
const _updCrownQuat = new THREE.Quaternion();

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

      const hammered = 1.0 - Math.abs(n1 * 2.0 - 1.0);
      const fineRidge = 1.0 - Math.abs(n2 * 2.0 - 1.0);
      let h = 0.50 + (hammered - 0.5) * 0.30 + (fineRidge - 0.5) * 0.22 + (n3 - 0.5) * 0.18;

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

      const edgeDelta = d2 - d1;
      const crackWidth = 0.085 + n2 * 0.065;
      const rawCrack = clamp01(1.0 - edgeDelta / crackWidth);
      const crack = rawCrack * rawCrack * (0.45 + 0.55 * n1);
      crackMask[y0 + x] = crack;

      h -= crack * 0.24;
      heightBuf[y0 + x] = clamp01(h);
    }
  }

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

    const cavity = clamp01(0.96 - po * 0.24 - cr * 0.34 - Math.max(0, 0.45 - h) * 0.36);
    const cavityVal = (cavity * 255 + 0.5) | 0;

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

function buildUnitHammerFireCrownGeometry() {
  const parts = [];

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
      const widthScale = 0.92 + Math.sin(v * Math.PI) * 0.18 - v * v * 0.28;
      const lx = pos.getX(k) * widthScale;
      const ly = (v - 0.14) * h;
      const cup = -0.26 * (1.0 - uc * uc) * (0.35 + 0.65 * Math.sin(v * Math.PI));
      const flare = 0.42 + Math.sin(v * Math.PI * 0.95) * 0.30 - Math.pow(v, 1.7) * 0.34;
      const lz = cup + flare;
      const tw = (tall ? 0.52 : -0.46) * Math.pow(v, 1.3);
      const ct = Math.cos(tw);
      const st = Math.sin(tw);
      pos.setXYZ(k, lx * ct - lz * st, ly, lx * st + lz * ct);
    }

    plane.rotateY(yaw);
    plane.rotateZ(tall ? 0.22 : -0.28);
    plane.computeVertexNormals();
    parts.push(normalizeGeomForMerge(plane));
  }

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

function buildUnitHammerFireTrailGeometry() {
  const parts = [];
  const ribbonSpecs = [
    { roll: 0.0,  pitch:  0.18, len: 3.9, width: 1.55, arcCurve: 0.82, twist:  0.65 },
    { roll: 1.05, pitch: -0.22, len: 3.5, width: 1.38, arcCurve: 0.72, twist: -0.58 },
    { roll: 2.10, pitch:  0.12, len: 3.2, width: 1.25, arcCurve: 0.68, twist:  0.52 }
  ];

  for (let r = 0; r < ribbonSpecs.length; r++) {
    const sp = ribbonSpecs[r];
    const plane = new THREE.PlaneGeometry(sp.len, sp.width, 10, 3);
    const pos = plane.attributes.position;
    const uv = plane.attributes.uv;

    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k);
      const v = uv.getY(k);
      const vc = (v - 0.5) * 2.0;

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
// Material Micro-Detail, Cycles ORM Preservation & Speech/Phase-2 Emissive Pulse
// ============================================================================
function createBossHeatUniforms(microRoughMap) {
  return {
    uBossTime: { value: 0.0 },
    uBossHeat: { value: 0.16 },
    uBossWindup: { value: 0.0 },
    uBossPhase2: { value: 0.0 },
    uBossStaggerDim: { value: 1.0 },
    uBossMouthOpen: { value: 0.0 },
    uBossPulse: { value: 0.0 },
    uBossLanternFlicker: { value: 1.0 },
    uBossMicroRoughMap: { value: microRoughMap }
  };
}

function isHammerLikeMesh(mesh, mat, meshIndex, totalMeshes) {
  const meshName = mesh?.name || '';
  const matName = mat?.name || '';
  if (/hammer|maul|mace|weapon|5a64b2bb/i.test(meshName) || /hammer|maul|mace|weapon|5a64b2bb/i.test(matName)) {
    return true;
  }
  // Multi-primitive Boss GLBs: prim 0 = Boss body (centered around X=0), prim 1 = Warhammer (offset on right side)
  if (totalMeshes >= 2 && meshIndex >= 1 && mesh?.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb) {
      const cx = (bb.min.x + bb.max.x) * 0.5;
      if (Math.abs(cx) > 0.18) return true;
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
  const hasBakedOrmMaps = Boolean(mat.metalnessMap && mat.roughnessMap && mat.metalness > 0.72);
  const hasEmissiveMap = Boolean(mat.emissiveMap);

  mat.userData = mat.userData || {};
  let matUniforms = mat.userData.__soulsBossUniforms;
  if (!matUniforms) {
    matUniforms = {
      uBossTime: { value: 0.0 },
      uBossHeat: { value: heatUniforms.uBossHeat.value },
      uBossWindup: { value: heatUniforms.uBossWindup.value },
      uBossPhase2: { value: heatUniforms.uBossPhase2.value },
      uBossStaggerDim: { value: heatUniforms.uBossStaggerDim.value },
      uBossMouthOpen: { value: 0.0 },
      uBossPulse: { value: 0.0 },
      uBossLanternFlicker: { value: 1.0 },
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
    matUniforms.uBossMouthOpen.value = 0.0;
    matUniforms.uBossPulse.value = 0.0;
    matUniforms.uBossLanternFlicker.value = 1.0;
    matUniforms.uBossIsWeapon.value = isWeaponMesh ? 1.0 : 0.0;
    matUniforms.uBossMicroRoughMap = SHARED_MICRO_ROUGH_UNIFORM;
    matUniforms.uBossMicroBumpMap = SHARED_MICRO_BUMP_UNIFORM;
  }

  rec = {
    mat,
    refCount: 1,
    isWeapon: Boolean(isWeaponMesh),
    hasEmissiveMap,
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

  // Preserve Cycles-baked cloth-vs-iron metalness/roughness separation on Rift_Boss_Tripo.glb,
  // while elevating flat Tripo/KayKit PBR response on Troll_Tripo.glb & plain meshes!
  mat.bumpMap = shared.microBumpMap;
  mat.bumpScale = hasBakedOrmMaps ? 0.026 : 0.036;
  mat.envMapIntensity = 1.45;
  if (!hasBakedOrmMaps) {
    mat.roughness = isWeaponMesh ? 0.48 : 0.50;
    mat.metalness = isWeaponMesh ? 0.36 : 0.30;
  }
  if (!hadRoughnessMap) {
    mat.roughnessMap = shared.microRoughnessMap;
  }

  const cacheSuffix = `souls_boss_pbr_v4_${hadRoughnessMap ? 'mr' : 'nmr'}_${hasEmissiveMap ? 'em' : 'noem'}`;
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
    shader.uniforms.uBossMouthOpen = rec.uniforms.uBossMouthOpen;
    shader.uniforms.uBossPulse = rec.uniforms.uBossPulse;
    shader.uniforms.uBossLanternFlicker = rec.uniforms.uBossLanternFlicker;
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
uniform float uBossMouthOpen;
uniform float uBossPulse;
uniform float uBossLanternFlicker;
uniform float uBossIsWeapon;
uniform sampler2D uBossMicroRoughMap;
uniform sampler2D uBossMicroBumpMap;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_BUMPMAP
  float bossCavity = texture2D( uBossMicroRoughMap, vBumpMapUv ).r;
  diffuseColor.rgb *= mix( 0.86, 1.04, bossCavity );
#endif`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
#if defined( USE_NORMALMAP ) && defined( USE_BUMPMAP )
  normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd() * 1.15, faceDirection );
#endif`
      );

      if (hadRoughnessMap) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
#ifdef USE_BUMPMAP
  float bossMicroR = texture2D( uBossMicroRoughMap, vBumpMapUv ).g;
  roughnessFactor = clamp( roughnessFactor * mix( 0.80, 1.20, bossMicroR ), 0.12, 0.96 );
#endif`
        );
      }

      // Modulate baked emissiveMap (Rift_Boss_Tripo fiery grin, eyes & shoulder lantern globe!)
      // smoothly & warmly with speech (`uBossMouthOpen`), Phase-2 volcanic throb & oil-lantern flicker:
      // rests in deep brooding smolder when silent and flares vividly in molten amber-gold when speaking,
      // compressed through a soft-knee luminance shoulder so the dark face cavity NEVER clips to harsh white!
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
#ifdef USE_EMISSIVEMAP
  float bossEmLuma = max( emissiveColor.r, max( emissiveColor.g, emissiveColor.b ) );
  if ( bossEmLuma > 0.035 ) {
    float bossSpeechWave = smoothstep( 0.0, 1.0, clamp( uBossMouthOpen, 0.0, 1.0 ) );
    float bossFaceMask = clamp( ( emissiveColor.r - emissiveColor.g * 0.78 ) * 2.8 + 0.45, 0.0, 1.0 );
    float bossActiveFace = max( bossSpeechWave, max( uBossPhase2, uBossWindup ) );
    float bossBaseFace = mix( 1.0, 0.58, bossFaceMask * ( 1.0 - bossActiveFace ) );
    float bossSpeechSurge = bossBaseFace * ( 1.0 + bossSpeechWave * ( 0.85 * bossFaceMask + 0.08 ) );
    float bossP2Surge = 1.0 + uBossPhase2 * ( 0.44 * bossFaceMask + 0.14 ) + uBossWindup * 0.34 + uBossPulse * ( 0.24 * bossFaceMask + 0.08 );
    float bossLanternMod = mix( uBossLanternFlicker, 1.0, bossFaceMask * 0.72 );
    vec3 bossWarmShift = mix( vec3( 0.96, 0.78, 0.52 ), vec3( 1.12, 1.18, 0.28 ), clamp( bossSpeechWave * 0.85 + uBossWindup * 0.35, 0.0, 1.0 ) * bossFaceMask );
    vec3 bossEm = totalEmissiveRadiance * bossWarmShift * bossSpeechSurge * bossP2Surge * bossLanternMod * mix( 0.28, 1.0, uBossStaggerDim );
    float bossMaxC = max( bossEm.r, max( bossEm.g, bossEm.b ) );
    float bossKnee = 1.25;
    float bossCap = 2.40 + 0.80 * bossSpeechWave + 0.45 * uBossPhase2 + 0.35 * uBossWindup;
    if ( bossMaxC > bossKnee ) {
      float bossExcess = bossMaxC - bossKnee;
      float bossHeadroom = max( 0.15, bossCap - bossKnee );
      float bossSoft = bossKnee + bossHeadroom * ( bossExcess / ( bossExcess + bossHeadroom ) );
      bossEm *= ( bossSoft / max( bossMaxC, 0.0001 ) );
    }
    totalEmissiveRadiance = bossEm;
  }
#endif`
      );

      // Phase-2 smoldering volcanic coal cracks & heated weapon edges (noble dark-fantasy range, 0 white blowout!)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `if ( uBossHeat > 0.005 ) {
  float bossNdotV = clamp( dot( geometryNormal, geometryViewDir ), 0.0, 1.0 );
  float bossEdge = pow( max( 1.0 - bossNdotV, 0.0001 ), 2.55 );
  #ifdef USE_BUMPMAP
    vec3 bossMicroTex = texture2D( bumpMap, vBumpMapUv ).rgb;
    float bossCrevice = clamp( 1.0 - bossMicroTex.r * 1.18, 0.0, 1.0 );
    float bossCrack = smoothstep( 0.20, 0.80, bossMicroTex.g );
    float bossCrackCore = smoothstep( 0.58, 0.95, bossMicroTex.g );
  #else
    float bossCrevice = 0.30;
    float bossCrack = 0.22;
    float bossCrackCore = 0.10;
  #endif
  float bossCoalPulse = 0.78 + 0.22 * sin( uBossTime * 4.9 + bossCrack * 5.2 );
  float bossCrackGate = clamp( uBossPhase2 * 0.92 + uBossWindup * 0.38 + uBossIsWeapon * 0.34, 0.0, 1.0 );
  vec3 bossCrackCol = mix( vec3( 0.92, 0.18, 0.02 ), vec3( 1.0, 0.66, 0.18 ), bossCrackCore * ( 0.65 + 0.35 * uBossWindup ) );
  float bossCrackAmp = ( bossCrack * 0.56 + bossCrackCore * 0.78 ) * bossCrackGate * bossCoalPulse * mix( 0.45, 1.20, uBossIsWeapon );

  vec3 bossEmberCol = mix( vec3( 1.0, 0.32, 0.04 ), vec3( 1.0, 0.74, 0.28 ), clamp( uBossWindup * 0.85, 0.0, 1.0 ) );
  float bossEdgeAmp = ( bossCrevice * ( 0.26 + 0.44 * uBossPhase2 ) + bossEdge * ( 0.20 + 0.58 * uBossWindup ) ) * mix( 0.18, 0.82, uBossIsWeapon );

  outgoingLight += ( bossCrackCol * bossCrackAmp + bossEmberCol * bossEdgeAmp ) * ( uBossHeat * uBossStaggerDim * 0.46 );
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
  uniforms.uBossMouthOpen.value = 0.0;
  uniforms.uBossPulse.value = 0.0;
  uniforms.uBossLanternFlicker.value = 1.0;
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
// Bind-Pose Bone Space Calibration: Warhammer, Shoulder Lantern, Eyes & Grin
// ============================================================================
function hasBoneSkinInfluence(mesh, boneIdx) {
  const skinIdx = mesh?.geometry?.attributes?.skinIndex;
  const skinW = mesh?.geometry?.attributes?.skinWeight;
  if (!skinIdx || !skinW || skinIdx.count === 0) return true;
  const stride = Math.max(1, Math.floor(skinIdx.count / 400));
  for (let i = 0; i < skinIdx.count; i += stride) {
    if (
      (skinIdx.getX(i) === boneIdx && skinW.getX(i) > 0.05) ||
      (skinIdx.getY(i) === boneIdx && skinW.getY(i) > 0.05) ||
      (skinIdx.getZ(i) === boneIdx && skinW.getZ(i) > 0.05) ||
      (skinIdx.getW(i) === boneIdx && skinW.getW(i) > 0.05)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the heavy Warhammer head center & radius in the calibration bone's local space.
 * Uses shaft principal-axis + transverse bulkiness so the Hammer Head is located accurately
 * REGARDLESS of where `mixamorig:WeaponHammer`'s bone pivot sits (grip, shaft center, pommel, or head!).
 */
function estimateHammerHeadFromLocalCoords(coords, count) {
  if (!coords || count < 2) return null;

  let cx = 0;
  let cy = 0;
  let cz = 0;
  let maxOriginDistSq = 0;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const x = coords[o];
    const y = coords[o + 1];
    const z = coords[o + 2];
    cx += x;
    cy += y;
    cz += z;
    const dSq = x * x + y * y + z * z;
    if (dSq > maxOriginDistSq) maxOriginDistSq = dSq;
  }
  const invN = 1 / count;
  cx *= invN;
  cy *= invN;
  cz *= invN;

  // 2-pass approximate diameter along the Warhammer's long shaft axis
  let ax = cx;
  let ay = cy;
  let az = cz;
  let farASq = -1;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const dx = coords[o] - cx;
    const dy = coords[o + 1] - cy;
    const dz = coords[o + 2] - cz;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq > farASq) {
      farASq = dSq;
      ax = coords[o];
      ay = coords[o + 1];
      az = coords[o + 2];
    }
  }

  let bx = ax;
  let by = ay;
  let bz = az;
  let farBSq = -1;
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const dx = coords[o] - ax;
    const dy = coords[o + 1] - ay;
    const dz = coords[o + 2] - az;
    const dSq = dx * dx + dy * dy + dz * dz;
    if (dSq > farBSq) {
      farBSq = dSq;
      bx = coords[o];
      by = coords[o + 1];
      bz = coords[o + 2];
    }
  }

  const spanLen = Math.sqrt(Math.max(0, farBSq));
  if (spanLen > 0.06 && count >= 4) {
    const invSpan = 1 / spanLen;
    const ux = (bx - ax) * invSpan;
    const uy = (by - ay) * invSpan;
    const uz = (bz - az) * invSpan;
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const mz = (az + bz) * 0.5;

    let sMin = Infinity;
    let sMax = -Infinity;
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const s = (coords[o] - mx) * ux + (coords[o + 1] - my) * uy + (coords[o + 2] - mz) * uz;
      if (s < sMin) sMin = s;
      if (s > sMax) sMax = s;
    }

    const totalLen = sMax - sMin;
    if (totalLen > 0.08) {
      const loCut = sMin + totalLen * 0.30;
      const hiCut = sMax - totalLen * 0.30;

      let loCount = 0;
      let loSumX = 0;
      let loSumY = 0;
      let loSumZ = 0;
      let loMinX = 1e6;
      let loMinY = 1e6;
      let loMinZ = 1e6;
      let loMaxX = -1e6;
      let loMaxY = -1e6;
      let loMaxZ = -1e6;
      let loSumPerpSq = 0;
      let loMaxPerpSq = 0;
      let loSumOriginDist = 0;

      let hiCount = 0;
      let hiSumX = 0;
      let hiSumY = 0;
      let hiSumZ = 0;
      let hiMinX = 1e6;
      let hiMinY = 1e6;
      let hiMinZ = 1e6;
      let hiMaxX = -1e6;
      let hiMaxY = -1e6;
      let hiMaxZ = -1e6;
      let hiSumPerpSq = 0;
      let hiMaxPerpSq = 0;
      let hiSumOriginDist = 0;

      for (let i = 0; i < count; i++) {
        const o = i * 3;
        const x = coords[o];
        const y = coords[o + 1];
        const z = coords[o + 2];
        const dx = x - mx;
        const dy = y - my;
        const dz = z - mz;
        const s = dx * ux + dy * uy + dz * uz;
        if (s <= loCut || s >= hiCut) {
          const perpSq = Math.max(0, dx * dx + dy * dy + dz * dz - s * s);
          const origDist = Math.sqrt(x * x + y * y + z * z);
          if (s <= loCut) {
            loCount += 1;
            loSumX += x;
            loSumY += y;
            loSumZ += z;
            if (x < loMinX) loMinX = x;
            if (y < loMinY) loMinY = y;
            if (z < loMinZ) loMinZ = z;
            if (x > loMaxX) loMaxX = x;
            if (y > loMaxY) loMaxY = y;
            if (z > loMaxZ) loMaxZ = z;
            loSumPerpSq += perpSq;
            if (perpSq > loMaxPerpSq) loMaxPerpSq = perpSq;
            loSumOriginDist += origDist;
          }
          if (s >= hiCut) {
            hiCount += 1;
            hiSumX += x;
            hiSumY += y;
            hiSumZ += z;
            if (x < hiMinX) hiMinX = x;
            if (y < hiMinY) hiMinY = y;
            if (z < hiMinZ) hiMinZ = z;
            if (x > hiMaxX) hiMaxX = x;
            if (y > hiMaxY) hiMaxY = y;
            if (z > hiMaxZ) hiMaxZ = z;
            hiSumPerpSq += perpSq;
            if (perpSq > hiMaxPerpSq) hiMaxPerpSq = perpSq;
            hiSumOriginDist += origDist;
          }
        }
      }

      const loMaxR = Math.sqrt(loMaxPerpSq);
      const hiMaxR = Math.sqrt(hiMaxPerpSq);
      const maxCrossR = Math.max(loMaxR, hiMaxR);
      if (loCount >= 2 && hiCount >= 2 && maxCrossR > 0.002 && totalLen > maxCrossR * 2.1) {
        const loMeanR = Math.sqrt(loSumPerpSq / loCount);
        const hiMeanR = Math.sqrt(hiSumPerpSq / hiCount);
        const loBulk = loMaxR * (loMeanR + 0.004) * Math.sqrt(loCount);
        const hiBulk = hiMaxR * (hiMeanR + 0.004) * Math.sqrt(hiCount);

        let pickHi;
        if (hiBulk > loBulk * 1.30) {
          pickHi = true;
        } else if (loBulk > hiBulk * 1.30) {
          pickHi = false;
        } else {
          pickHi = hiSumOriginDist / hiCount >= loSumOriginDist / loCount;
        }

        if (pickHi) {
          const invC = 1 / hiCount;
          _calVecB.set(hiSumX * invC, hiSumY * invC, hiSumZ * invC);
          _calVecC.set(hiMaxX - hiMinX, hiMaxY - hiMinY, hiMaxZ - hiMinZ);
        } else {
          const invC = 1 / loCount;
          _calVecB.set(loSumX * invC, loSumY * invC, loSumZ * invC);
          _calVecC.set(loMaxX - loMinX, loMaxY - loMinY, loMaxZ - loMinZ);
        }
        return {
          offset: _calVecB.clone(),
          radius: Math.max(0.045, Math.min(0.22, _calVecC.length() * 0.28))
        };
      }
    }
  }

  // Fallback for compact / non-elongated weapon head meshes: bone-origin distance threshold
  const maxDist = Math.sqrt(maxOriginDistSq);
  if (maxDist > 0.03) {
    const headThreshold = maxDist * 0.64;
    _calVecB.set(0, 0, 0);
    _calMin.set(1e6, 1e6, 1e6);
    _calMax.set(-1e6, -1e6, -1e6);
    let selCount = 0;
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const x = coords[o];
      const y = coords[o + 1];
      const z = coords[o + 2];
      if (Math.sqrt(x * x + y * y + z * z) >= headThreshold) {
        _calVecA.set(x, y, z);
        _calVecB.add(_calVecA);
        _calMin.min(_calVecA);
        _calMax.max(_calVecA);
        selCount += 1;
      }
    }
    if (selCount >= 2) {
      _calVecB.divideScalar(selCount);
      _calVecC.subVectors(_calMax, _calMin);
      return {
        offset: _calVecB.clone(),
        radius: Math.max(0.045, Math.min(0.22, _calVecC.length() * 0.28))
      };
    }
  }

  return null;
}

function calibrateHammerLocalInRightHand(hammerMesh, bodyMesh, weaponHammerBone, rightHandBone = null) {
  const candidateBones = [];
  if (weaponHammerBone) candidateBones.push(weaponHammerBone);
  if (rightHandBone && rightHandBone !== weaponHammerBone) candidateBones.push(rightHandBone);

  const fallback = {
    offset: new THREE.Vector3(0.0, 0.24, 0.04),
    radius: 0.095,
    bone: candidateBones[0] || null
  };
  if (candidateBones.length === 0) return fallback;

  // Case 1: Dedicated hammer mesh (SkinnedMesh primitive skinned to mixamorig:WeaponHammer or RightHand,
  //         OR child Mesh parented directly under the weapon/hand bone)
  if (hammerMesh?.geometry?.attributes?.position) {
    const posAttr = hammerMesh.geometry.attributes.position;
    if (posAttr.count >= 4) {
      let matToBone = null;
      let chosenBone = null;
      const skel = hammerMesh.isSkinnedMesh ? hammerMesh.skeleton : null;
      if (skel && Array.isArray(skel.bones) && Array.isArray(skel.boneInverses)) {
        for (let bi = 0; bi < candidateBones.length; bi++) {
          const cand = candidateBones[bi];
          const bIdx = skel.bones.indexOf(cand);
          if (bIdx < 0 || !skel.boneInverses[bIdx]) continue;
          // Prefer weaponHammerBone FIRST whenever it influences hammerMesh; fall back cleanly to rightHandBone if unused
          if (candidateBones.length > 1 && bi === 0 && !hasBoneSkinInfluence(hammerMesh, bIdx)) {
            continue;
          }
          _calMatA.multiplyMatrices(skel.boneInverses[bIdx], hammerMesh.bindMatrix);
          matToBone = _calMatA;
          chosenBone = cand;
          break;
        }
      } else if (!hammerMesh.isSkinnedMesh) {
        chosenBone = candidateBones[0];
        chosenBone.updateWorldMatrix(true, false);
        hammerMesh.updateWorldMatrix(true, false);
        _calMatB.copy(chosenBone.matrixWorld).invert();
        _calMatA.multiplyMatrices(_calMatB, hammerMesh.matrixWorld);
        matToBone = _calMatA;
      }

      if (matToBone && chosenBone) {
        const stride = Math.max(1, Math.floor(posAttr.count / 1200));
        const sampleCap = Math.ceil(posAttr.count / stride);
        const coords = new Float32Array(sampleCap * 3);
        let nPts = 0;
        for (let i = 0; i < posAttr.count; i += stride) {
          _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(matToBone);
          const o = nPts * 3;
          coords[o] = _calVecA.x;
          coords[o + 1] = _calVecA.y;
          coords[o + 2] = _calVecA.z;
          nPts += 1;
        }
        const est = estimateHammerHeadFromLocalCoords(coords, nPts);
        if (est) {
          return {
            offset: est.offset,
            radius: est.radius,
            bone: chosenBone
          };
        }
      }
    }
  }

  // Case 2: Single merged SkinnedMesh where the warhammer is weighted to mixamorig:WeaponHammer (preferred)
  //         or legacy mixamorig:RightHand
  if (bodyMesh?.isSkinnedMesh && bodyMesh.skeleton && bodyMesh.geometry?.attributes?.skinIndex) {
    const skel = bodyMesh.skeleton;
    const posAttr = bodyMesh.geometry.attributes.position;
    const skinIdx = bodyMesh.geometry.attributes.skinIndex;
    const skinW = bodyMesh.geometry.attributes.skinWeight;
    if (posAttr && skinIdx && skinW) {
      const stride = Math.max(1, Math.floor(posAttr.count / 3000));
      for (let bi = 0; bi < candidateBones.length; bi++) {
        const cand = candidateBones[bi];
        const bIdx = skel.bones.indexOf(cand);
        if (bIdx < 0 || !skel.boneInverses[bIdx]) continue;
        _calMatA.multiplyMatrices(skel.boneInverses[bIdx], bodyMesh.bindMatrix);

        const isDedicatedWeaponBone = /^(mixamorig:?)?WeaponHammer$/i.test(cand.name || '');
        if (isDedicatedWeaponBone) {
          // Every vertex weighted to mixamorig:WeaponHammer belongs exclusively to the Warhammer!
          const sampleCap = Math.ceil(posAttr.count / stride);
          const coords = new Float32Array(sampleCap * 3);
          let nPts = 0;
          for (let i = 0; i < posAttr.count; i += stride) {
            let wB = 0;
            if (skinIdx.getX(i) === bIdx) wB += skinW.getX(i);
            if (skinIdx.getY(i) === bIdx) wB += skinW.getY(i);
            if (skinIdx.getZ(i) === bIdx) wB += skinW.getZ(i);
            if (skinIdx.getW(i) === bIdx) wB += skinW.getW(i);
            if (wB > 0.45) {
              _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(_calMatA);
              const o = nPts * 3;
              coords[o] = _calVecA.x;
              coords[o + 1] = _calVecA.y;
              coords[o + 2] = _calVecA.z;
              nPts += 1;
            }
          }
          if (nPts >= 4) {
            const est = estimateHammerHeadFromLocalCoords(coords, nPts);
            if (est) {
              return {
                offset: est.offset,
                radius: Math.max(0.05, est.radius),
                bone: cand
              };
            }
          }
          continue;
        }

        // Legacy RightHand merged mesh: RightHand weights both fist & warhammer, so take far end > 0.66 * maxDist
        let maxDist = 0;
        for (let i = 0; i < posAttr.count; i += stride) {
          let wRH = 0;
          if (skinIdx.getX(i) === bIdx) wRH += skinW.getX(i);
          if (skinIdx.getY(i) === bIdx) wRH += skinW.getY(i);
          if (skinIdx.getZ(i) === bIdx) wRH += skinW.getZ(i);
          if (skinIdx.getW(i) === bIdx) wRH += skinW.getW(i);
          if (wRH > 0.45) {
            _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(_calMatA);
            const d = _calVecA.length();
            if (d > maxDist) maxDist = d;
          }
        }
        if (maxDist > 0.16) {
          const thresh = maxDist * 0.66;
          _calVecB.set(0, 0, 0);
          _calMin.set(1e6, 1e6, 1e6);
          _calMax.set(-1e6, -1e6, -1e6);
          let count = 0;
          for (let i = 0; i < posAttr.count; i += stride) {
            let wRH = 0;
            if (skinIdx.getX(i) === bIdx) wRH += skinW.getX(i);
            if (skinIdx.getY(i) === bIdx) wRH += skinW.getY(i);
            if (skinIdx.getZ(i) === bIdx) wRH += skinW.getZ(i);
            if (skinIdx.getW(i) === bIdx) wRH += skinW.getW(i);
            if (wRH > 0.45) {
              _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(_calMatA);
              if (_calVecA.length() >= thresh) {
                _calVecB.add(_calVecA);
                _calMin.min(_calVecA);
                _calMax.max(_calVecA);
                count += 1;
              }
            }
          }
          if (count >= 2) {
            _calVecB.divideScalar(count);
            _calVecC.subVectors(_calMax, _calMin);
            return {
              offset: _calVecB.clone(),
              radius: Math.max(0.05, Math.min(0.22, _calVecC.length() * 0.28)),
              bone: cand
            };
          }
        }
      }
    }
  }

  return fallback;
}

/**
 * Detects whether this Boss model carries the iconic Right-Shoulder Forged Iron Lantern
 * (`Rift_Boss_Tripo.glb`), while returning `enabled: false` for PvE `Troll_Tripo.glb`.
 * Computes exact bind-pose coordinates inside `rightShoulderBone` (or fallback `chestBone`/`root`).
 */
function calibrateShoulderLantern(root, meshes, bodyMesh, rightShoulderBone, chestBone, headBone, options) {
  if (options?.hasShoulderLantern === false) {
    return { enabled: false };
  }

  const explicitForce = options?.hasShoulderLantern === true;
  let isClassicTrollMesh = false;
  let namedOrEmissiveBoss = explicitForce;
  if (!namedOrEmissiveBoss) {
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      const mName = m.name || '';
      if (/55664754|troll_tripo/i.test(mName)) {
        isClassicTrollMesh = true;
      }
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (/rift_boss|3615f276|lantern|executioner_boss/i.test(mName)) {
        namedOrEmissiveBoss = true;
        break;
      }
      for (let j = 0; j < mats.length; j++) {
        if (/55664754/i.test(mats[j]?.name || '')) isClassicTrollMesh = true;
        if (mats[j]?.emissiveMap || /rift_boss|3615f276|lantern/i.test(mats[j]?.name || '')) {
          namedOrEmissiveBoss = true;
          break;
        }
      }
      if (namedOrEmissiveBoss) break;
    }
  }
  if (isClassicTrollMesh && !namedOrEmissiveBoss) {
    return { enabled: false };
  }

  const attachBone = rightShoulderBone || chestBone || null;
  const skel = bodyMesh?.isSkinnedMesh ? bodyMesh.skeleton : null;
  const posAttr = bodyMesh?.geometry?.attributes?.position;

  // Bind-pose geometric scan of the upper-right shoulder quadrant (`x < shoulderX - 0.06`, `y > shoulderY + 0.04`)
  if (skel && posAttr && posAttr.count >= 16) {
    const rsIdx = rightShoulderBone ? skel.bones.indexOf(rightShoulderBone) : -1;
    const hdIdx = headBone ? skel.bones.indexOf(headBone) : -1;
    const attachIdx = attachBone ? skel.bones.indexOf(attachBone) : -1;

    let shoulderOrigin = new THREE.Vector3(-0.044, 0.679, 0.010);
    if (rsIdx >= 0 && skel.boneInverses[rsIdx]) {
      _calMatA.copy(skel.boneInverses[rsIdx]).invert();
      shoulderOrigin.setFromMatrixPosition(_calMatA);
    }
    let headY = shoulderOrigin.y + 0.10;
    if (hdIdx >= 0 && skel.boneInverses[hdIdx]) {
      _calMatA.copy(skel.boneInverses[hdIdx]).invert();
      headY = _calVecC.setFromMatrixPosition(_calMatA).y;
    }

    const stride = Math.max(1, Math.floor(posAttr.count / 3200));
    _calVecB.set(0, 0, 0);
    let lanternTopY = -1e6;
    let centerCrownY = headY + 0.06;
    let count = 0;

    for (let i = 0; i < posAttr.count; i += stride) {
      _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(bodyMesh.bindMatrix);
      if (Math.abs(_calVecA.x - shoulderOrigin.x - 0.044) < 0.055 && _calVecA.y > centerCrownY) {
        centerCrownY = _calVecA.y;
      }
      if (
        _calVecA.x < shoulderOrigin.x - 0.065 &&
        _calVecA.x > shoulderOrigin.x - 0.34 &&
        _calVecA.y > shoulderOrigin.y + 0.045 &&
        _calVecA.z < shoulderOrigin.z + 0.06
      ) {
        _calVecB.add(_calVecA);
        if (_calVecA.y > lanternTopY) lanternTopY = _calVecA.y;
        count += 1;
      }
    }

    // Rift_Boss_Tripo's shoulder lantern finial towers ABOVE his crimson hood crown (0.973 > 0.87)
    const hasToweringLantern = count >= 8 && lanternTopY > centerCrownY + 0.02;
    if (hasToweringLantern || namedOrEmissiveBoss) {
      const coreBind = count >= 4
        ? _calVecB.divideScalar(count).clone()
        : new THREE.Vector3(shoulderOrigin.x - 0.143, shoulderOrigin.y + 0.088, shoulderOrigin.z - 0.147);

      // Offset PointLight slightly forward (+Z) & outward (-X) outside the iron cage bars so N·L illuminates
      // the Boss's crimson hood, chest chains, and surrounding stone floor with zero close-surface clipping!
      const lightBind = new THREE.Vector3(
        coreBind.x - 0.045,
        coreBind.y + 0.024,
        coreBind.z + 0.165
      );

      if (attachIdx >= 0 && skel.boneInverses[attachIdx]) {
        const invAttach = skel.boneInverses[attachIdx];
        return {
          enabled: true,
          parent: attachBone,
          haloOffset: coreBind.applyMatrix4(invAttach),
          lightOffset: lightBind.applyMatrix4(invAttach),
          haloScale: 0.34
        };
      }
    }
  }

  if (namedOrEmissiveBoss) {
    return {
      enabled: true,
      parent: attachBone || root,
      haloOffset: attachBone ? new THREE.Vector3(-0.14, 0.10, -0.12) : new THREE.Vector3(-0.52, 2.18, -0.28),
      lightOffset: attachBone ? new THREE.Vector3(-0.18, 0.12, 0.05) : new THREE.Vector3(-0.66, 2.25, 0.12),
      haloScale: attachBone ? 0.34 : 0.92
    };
  }

  return { enabled: false };
}

function calibrateFaceFireInHeadBone(bodyMesh, headBone, isLanternBoss) {
  const fallback = {
    left: new THREE.Vector3(-0.022, 0.036, 0.046),
    right: new THREE.Vector3(0.022, 0.036, 0.046),
    grinCenter: new THREE.Vector3(0.0, 0.004, 0.052),
    forward: new THREE.Vector3(0, 0, 1),
    up: new THREE.Vector3(0, 1, 0),
    eyeSize: 0.017,
    grinWidth: 0.068,
    grinHeight: 0.028
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
  let headTopY = headOrigin.y + 0.06;
  const yLowerScan = isLanternBoss ? headOrigin.y - 0.14 : headOrigin.y;

  for (let i = 0; i < posAttr.count; i += stride) {
    _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(bodyMesh.bindMatrix);
    if (_calVecA.y > yLowerScan && Math.abs(_calVecA.x - headOrigin.x) < 0.095) {
      if (_calVecA.y > headTopY) headTopY = _calVecA.y;
    }
  }

  const headH = Math.max(0.045, headTopY - headOrigin.y);
  // On Rift_Boss_Tripo (measured in Blender: Head y=0.796, Eyes y=0.707, Grin y=0.64..0.67 inside hood!),
  // the hooded face sits slightly below Head pivot; on Troll_Tripo it sits above Head pivot.
  const eyeY = isLanternBoss ? (headOrigin.y - headH * 0.34) : (headOrigin.y + headH * 0.48);
  const grinY = isLanternBoss ? (eyeY - headH * 0.24) : (headOrigin.y + headH * 0.18);
  const bandY = Math.max(0.015, headH * 0.18);

  let eyeFrontZ = -1e6;
  let eyeMaxAbsX = 0;
  for (let i = 0; i < posAttr.count; i += stride) {
    _calVecA.fromBufferAttribute(posAttr, i).applyMatrix4(bodyMesh.bindMatrix);
    if (Math.abs(_calVecA.y - eyeY) <= bandY && Math.abs(_calVecA.x - headOrigin.x) < 0.09) {
      if (_calVecA.z > eyeFrontZ) eyeFrontZ = _calVecA.z;
      const ax = Math.abs(_calVecA.x - headOrigin.x);
      if (ax > eyeMaxAbsX) eyeMaxAbsX = ax;
    }
  }
  if (eyeFrontZ < -100) return fallback;

  const headHalfW = Math.max(0.026, Math.min(0.085, eyeMaxAbsX));
  const eyeSep = headHalfW * (isLanternBoss ? 0.38 : 0.34);
  const eyeZ = eyeFrontZ + (isLanternBoss ? 0.002 : 0.0045);
  const invHead = skel.boneInverses[hdIdx];

  const left = new THREE.Vector3(headOrigin.x - eyeSep, eyeY, eyeZ).applyMatrix4(invHead);
  const right = new THREE.Vector3(headOrigin.x + eyeSep, eyeY, eyeZ).applyMatrix4(invHead);
  const grinCenter = new THREE.Vector3(headOrigin.x, grinY, eyeZ - 0.004).applyMatrix4(invHead);

  _calMatB.copy(invHead);
  const forward = new THREE.Vector3(0, 0, 1).transformDirection(_calMatB).normalize();
  const up = new THREE.Vector3(0, 1, 0).transformDirection(_calMatB).normalize();
  const eyeSize = Math.max(0.011, Math.min(0.030, headH * (isLanternBoss ? 0.14 : 0.20)));

  return {
    left,
    right,
    grinCenter,
    forward,
    up,
    eyeSize,
    grinWidth: eyeSep * 2.55,
    grinHeight: eyeSize * 1.65
  };
}

// ============================================================================
// GPU Hammer Ember Sparks & Single-Draw-Call Face Fire (Eyes + Speech Grin!)
// ============================================================================
function createHammerEmberPoints(radius) {
  const count = SPARK_COUNT_DESKTOP;
  const rng = makeRng(0x88e3b3a1);
  const positions = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
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
        p.y += (cos(swirlAng * 0.85) * 0.26 + 0.36) * aParam.z * life;
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

/**
 * Single-draw-call merged Face Fire Glow (2 blazing eyes + curved jagged fiery grin furnace aura
 * for the Hooded Executioner Boss that expands & pulses in real-time sync with `mouthOpen01` & Phase 2!).
 */
function createBossFaceFireGlowMesh(cal, includeGrin = false, hasBakedEmissiveMap = false) {
  const rightAxis = new THREE.Vector3().crossVectors(cal.up, cal.forward).normalize();
  if (rightAxis.lengthSq() < 0.01) rightAxis.set(1, 0, 0);
  const upAxis = new THREE.Vector3().crossVectors(cal.forward, rightAxis).normalize();

  const eyeW = cal.eyeSize * 1.15;
  const eyeH = cal.eyeSize * 0.72;
  const partCount = includeGrin ? 3 : 2;
  const positions = new Float32Array(partCount * 6 * 3);
  const uvs = new Float32Array(partCount * 6 * 2);
  const roles = new Float32Array(partCount * 6); // 0 = eye ember, 1 = fiery grin furnace glow

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
  let ri = 0;
  const eyeCenters = [cal.left, cal.right];
  for (let c = 0; c < 2; c++) {
    const center = eyeCenters[c];
    for (let k = 0; k < 6; k++) {
      const q = quadCorners[k];
      corner
        .copy(center)
        .addScaledVector(rightAxis, q[0] * eyeW)
        .addScaledVector(upAxis, q[1] * eyeH);
      positions[pi++] = corner.x;
      positions[pi++] = corner.y;
      positions[pi++] = corner.z;
      uvs[ui++] = q[2];
      uvs[ui++] = q[3];
      roles[ri++] = 0.0;
    }
  }

  if (includeGrin) {
    const gw = cal.grinWidth * 0.5;
    const gh = cal.grinHeight * 0.5;
    for (let k = 0; k < 6; k++) {
      const q = quadCorners[k];
      corner
        .copy(cal.grinCenter)
        .addScaledVector(rightAxis, q[0] * gw)
        .addScaledVector(upAxis, q[1] * gh);
      positions[pi++] = corner.x;
      positions[pi++] = corner.y;
      positions[pi++] = corner.z;
      uvs[ui++] = q[2];
      uvs[ui++] = q[3];
      roles[ri++] = 1.0;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aRole', new THREE.BufferAttribute(roles, 1));

  // When Rift_Boss_Tripo already has a crisp baked emissiveMap for eyes & jagged teeth,
  // keep the 3D overlay subtle & atmospheric (warm dark-cavity furnace haze, 0 white clipping!)
  const overlayWeight = hasBakedEmissiveMap ? 0.22 : 1.0;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uIntensity: { value: 0.72 },
      uPhase2: { value: 0.0 },
      uWindup: { value: 0.0 },
      uMouthOpen: { value: 0.0 },
      uStaggerDim: { value: 1.0 },
      uOverlayWeight: { value: overlayWeight },
      uUpAxis: { value: upAxis.clone() },
      uJawDropScale: { value: cal.eyeSize * (hasBakedEmissiveMap ? 0.30 : 0.55) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      attribute float aRole;
      uniform float uMouthOpen;
      uniform vec3 uUpAxis;
      uniform float uJawDropScale;
      varying vec2 vUv;
      varying float vRole;
      void main() {
        vUv = uv;
        vRole = aRole;
        vec3 p = position;
        // Lower half of fiery grin tracks jaw opening subtly in GPU vertex shader (0 CPU uploads!)
        if (aRole > 0.5) {
          float lowerLip = 1.0 - clamp(uv.y, 0.0, 1.0);
          p -= uUpAxis * (uMouthOpen * uJawDropScale * (0.20 + 0.80 * lowerLip));
        }
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uPhase2;
      uniform float uWindup;
      uniform float uMouthOpen;
      uniform float uStaggerDim;
      uniform float uOverlayWeight;
      varying vec2 vUv;
      varying float vRole;
      void main() {
        float smoothMouth = smoothstep(0.0, 1.0, clamp(uMouthOpen, 0.0, 1.0));
        if (vRole > 0.5) {
          // Organic warm furnace-cavity glow pulsing smoothly in sync with speech (uMouthOpen) & Phase 2 (0 white blowout!)
          float x = (vUv.x - 0.5) * 2.0;
          float smileCurve = 0.20 * (x * x - 0.35);
          float y = (vUv.y - 0.5 - smileCurve) * 2.4;
          // Synthetic teeth modulation only when no baked emissiveMap exists; otherwise keep soft cavity haze
          float teethMask = smoothstep(0.40, 0.85, uOverlayWeight);
          float teeth = sin(vUv.x * 37.699) * (0.24 - 0.08 * smoothMouth) * teethMask;
          float openHalfH = 0.38 + 0.36 * smoothMouth + 0.12 * uPhase2;
          float distY = abs(y - teeth * 0.40) / max(0.20, openHalfH);
          float rad = sqrt(x * x * 0.94 + distY * distY);
          float grinHalo = smoothstep(1.02, 0.14, rad);
          float grinCore = smoothstep(0.56, 0.06, rad);
          if (grinHalo < 0.02) discard;

          float vocalFlicker = 0.90 + 0.06 * sin(uTime * 10.5 + x * 3.0) + 0.04 * sin(uTime * 16.2 - x * 2.0);
          vec3 outerFire = mix(vec3(0.92, 0.24, 0.02), vec3(0.96, 0.14, 0.01), uPhase2);
          vec3 innerFire = mix(vec3(1.0, 0.58, 0.12), vec3(1.0, 0.74, 0.22), clamp(smoothMouth * 0.75 + uWindup * 0.35, 0.0, 1.0));
          vec3 col = mix(outerFire, innerFire, grinCore) * vocalFlicker;
          float speechAmp = (0.24 + 0.68 * smoothMouth + 0.36 * uPhase2 + 0.24 * uWindup) * uOverlayWeight;
          float alpha = (grinHalo * 0.52 + grinCore * 0.34) * speechAmp * uStaggerDim;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(col * (0.78 + 0.28 * smoothMouth + 0.22 * uPhase2), clamp(alpha, 0.0, 0.42));
          return;
        }

        // Smoldering / blazing Boss eyes (warm amber-gold core, zero harsh white clipping!)
        vec2 p = (vUv - vec2(0.5)) * vec2(2.0, 2.6);
        float d = length(p);
        float halo = smoothstep(1.0, 0.08, d);
        float pupil = smoothstep(0.44, 0.04, d);
        if (halo < 0.02) discard;
        vec3 emberCol = mix(vec3(1.0, 0.38, 0.05), vec3(1.0, 0.18, 0.02), uPhase2);
        vec3 coreCol = mix(vec3(1.0, 0.72, 0.22), vec3(1.0, 0.84, 0.36), clamp(uWindup * 0.85 + smoothMouth * 0.40, 0.0, 1.0));
        vec3 col = mix(emberCol, coreCol, pupil);
        float eyeWeight = mix(0.28, 0.92, uOverlayWeight);
        float alpha = (halo * 0.64 + pupil * 0.48) * uIntensity * (1.0 + smoothMouth * 0.22) * eyeWeight * uStaggerDim;
        gl_FragColor = vec4(col * (0.90 + uPhase2 * 0.28 + uWindup * 0.32 + smoothMouth * 0.16), clamp(alpha, 0.0, 0.78));
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
    state.hammerFireTrailMesh.visible = false;
  }
  // ZERO-HITCH: keep shoulderLanternLight.visible = true on PC so scene light count never mutates mid-fight;
  // in lowSpec, drop intensity cleanly to 0!
  if (state.shoulderLanternLight && globalLowSpec) {
    state.shoulderLanternLight.intensity = 0;
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
 * Enhances the Souls Boss (`Rift_Boss_Tripo.glb` or PvE `Troll_Tripo.glb`) with:
 * - Real warm flickering `THREE.PointLight` on the right-shoulder iron lantern (`0xff8c2b`, `decay=2`, `distance=6.8`, base=`1.25` on PC)
 * - Living fiery grin & blazing eye furnace luminescence pulsing warmly in lip-sync with `mouthOpen01` speech & Phase-2 enrage
 * - Procedural 256px micro-bump + micro-roughness + volcanic coal-crack PBR detail (preserving Cycles ORM & emissiveMap!)
 * - Real volumetric Simplex FBM fire crown & swept fire trail on the warhammer head attached to `mixamorig:WeaponHammer`
 *   (falling back seamlessly to `mixamorig:RightHand` for legacy `Troll_Tripo.glb`)
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
  let weaponHammerBone = null;
  let rightHandBone = null;
  let rightShoulderBone = null;
  let headBone = null;
  let chestBone = null;

  root.traverse((n) => {
    if (n.userData?.isSoulsBossVfx) return;
    const nm = n.name || '';
    if (n.isMesh && n.material && !/Eyes/i.test(nm)) {
      meshes.push(n);
    }
    if (/^(mixamorig:?)?WeaponHammer$/i.test(nm) && (!weaponHammerBone || (n.isBone && !weaponHammerBone.isBone))) {
      weaponHammerBone = n;
    }
    if (!rightHandBone && (/^(mixamorig:?)?RightHand$/i.test(nm) || /^handslot\.?r$/i.test(nm) || /^hand\.?r$/i.test(nm))) {
      rightHandBone = n;
    }
    if (!rightShoulderBone && /^(mixamorig:?)?RightShoulder$/i.test(nm)) {
      rightShoulderBone = n;
    }
    if (!headBone && /^(mixamorig:?)?Head$/i.test(nm)) {
      headBone = n;
    }
    if (!chestBone && /^(mixamorig:?)?(Spine2|Chest|UpperChest)$/i.test(nm)) {
      chestBone = n;
    }
  });

  // 1. Enhance PBR micro-relief, emissive speech/enrage modulation & Phase-2 coal-crack glow
  const patchedRecs = [];
  const touchedMats = new Set();
  let hammerMesh = null;
  let bodyMesh = null;
  let hasBakedEmissiveMap = false;

  for (let i = 0; i < meshes.length; i++) {
    const m = meshes[i];
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const firstMat = mats[0] || null;
    const isWeapon = isHammerLikeMesh(m, firstMat, i, meshes.length);
    if (isWeapon && !hammerMesh) hammerMesh = m;
    if (!isWeapon && !bodyMesh) bodyMesh = m;

    for (let j = 0; j < mats.length; j++) {
      if (mats[j]?.emissiveMap) hasBakedEmissiveMap = true;
      const rec = patchBossMaterial(mats[j], shared, heatUniforms, isWeapon, touchedMats);
      if (rec) patchedRecs.push(rec);
    }
  }
  if (!bodyMesh && meshes.length > 0) bodyMesh = meshes[0];

  // 2. Right-Shoulder Forged Iron Lantern (`Rift_Boss_Tripo.glb`):
  //    PC gets a real physical flickering `THREE.PointLight(0xff8c2b, 1.25, 6.8, 2)` + delicate amber halo!
  const lanternCal = calibrateShoulderLantern(root, meshes, bodyMesh, rightShoulderBone, chestBone, headBone, options);
  let shoulderLanternGroup = null;
  let shoulderLanternLight = null;
  let shoulderLanternHalo = null;
  let shoulderLanternHaloMat = null;

  if (lanternCal.enabled && lanternCal.parent) {
    shoulderLanternGroup = new THREE.Group();
    shoulderLanternGroup.name = 'bossShoulderLanternRig';
    shoulderLanternGroup.userData.isSoulsBossVfx = true;

    const allowPcLanternPointLight =
      options.forceLanternPointLight === true || (!IS_MOBILE_DEVICE && options.disableLanternPointLight !== true);

    if (allowPcLanternPointLight) {
      shoulderLanternLight = new THREE.PointLight(
        LANTERN_LIGHT_COLOR_HEX,
        globalLowSpec ? 0 : LANTERN_LIGHT_BASE_INTENSITY,
        LANTERN_LIGHT_DISTANCE,
        LANTERN_LIGHT_DECAY
      );
      shoulderLanternLight.name = 'bossShoulderLanternLight';
      shoulderLanternLight.castShadow = false;
      shoulderLanternLight.visible = true;
      shoulderLanternLight.position.copy(lanternCal.lightOffset);
      shoulderLanternLight.userData.isSoulsBossVfx = true;
      shoulderLanternGroup.add(shoulderLanternLight);
    }

    // Subtle soft amber atmospheric sheen around the lantern's glowing glass globe (opacity <= 0.22, 0 blowout!)
    shoulderLanternHaloMat = new THREE.SpriteMaterial({
      map: shared.emberHaloTex,
      color: new THREE.Color(0xff9a3b),
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    shoulderLanternHalo = new THREE.Sprite(shoulderLanternHaloMat);
    shoulderLanternHalo.name = 'bossShoulderLanternHalo';
    shoulderLanternHalo.position.copy(lanternCal.haloOffset);
    shoulderLanternHalo.scale.set(lanternCal.haloScale, lanternCal.haloScale, 1);
    shoulderLanternHalo.frustumCulled = false;
    shoulderLanternHalo.renderOrder = 4;
    shoulderLanternHalo.userData.isSoulsBossVfx = true;
    shoulderLanternGroup.add(shoulderLanternHalo);

    lanternCal.parent.add(shoulderLanternGroup);
  }

  // 3. Attach Real Volumetric Hammer Fire Crown + Swept Fire Trail + Tight Glow Halo + GPU Sparks
  //    Prefer dedicated `mixamorig:WeaponHammer` bone FIRST (so fire & sparks sit directly on the Warhammer
  //    while leaning beside the Obsidian Throne and travel cleanly when the Boss grabs it on Stand-Up!),
  //    falling back seamlessly to `rightHandBone` for legacy `Troll_Tripo.glb` in PvE.
  const hammerCal = calibrateHammerLocalInRightHand(hammerMesh, bodyMesh, weaponHammerBone, rightHandBone);
  const hammerBone = hammerCal.bone || weaponHammerBone || rightHandBone || null;
  const hammerAttachParent = hammerBone || root;
  const hammerEmberCore = new THREE.Group();
  hammerEmberCore.name = 'hammerEmberCore';
  hammerEmberCore.userData.isSoulsBossVfx = true;
  if (hammerBone) {
    hammerEmberCore.position.copy(hammerCal.offset);
  } else {
    hammerEmberCore.position.set(-0.45, 1.35, 0.35);
  }

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

  const haloMat = new THREE.SpriteMaterial({
    map: shared.emberHaloTex,
    color: new THREE.Color(0xff6b1a),
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const hammerHaloSprite = new THREE.Sprite(haloMat);
  hammerHaloSprite.name = 'hammerEmberHalo';
  const baseHaloScale = hammerCal.radius * 3.05;
  hammerHaloSprite.scale.set(baseHaloScale, baseHaloScale, 1);
  hammerHaloSprite.frustumCulled = false;
  hammerHaloSprite.renderOrder = 4;
  hammerHaloSprite.userData.isSoulsBossVfx = true;
  hammerEmberCore.add(hammerHaloSprite);

  const { points: hammerEmberPoints, geo: emberGeo, mat: emberMat } = createHammerEmberPoints(hammerCal.radius);
  hammerEmberPoints.visible = false;
  hammerEmberCore.add(hammerEmberPoints);
  hammerAttachParent.add(hammerEmberCore);

  // 4. Attach Face Fire Glow (Eyes + Speech-Reactive Fiery Grin on Hooded Boss — 1 single draw call!)
  let eyeGlowMesh = null;
  let eyeGlowGeo = null;
  let eyeGlowMat = null;
  const eyeAttachParent = headBone || chestBone || null;
  if (eyeAttachParent && options.disableEyes !== true) {
    const faceCal = calibrateFaceFireInHeadBone(bodyMesh, headBone, lanternCal.enabled);
    const builtFace = createBossFaceFireGlowMesh(faceCal, lanternCal.enabled, hasBakedEmissiveMap);
    eyeGlowMesh = builtFace.mesh;
    eyeGlowGeo = builtFace.geo;
    eyeGlowMat = builtFace.mat;
    eyeAttachParent.add(eyeGlowMesh);
  }

  const crownCombatState = { heat: 0.42, intensity: 0.42, phase2: 0.0, windup: 0.0, staggerDim: 1.0 };
  const trailCombatState = { heat: 0.0, intensity: 0.0, phase2: 0.0, windup: 0.0, staggerDim: 1.0 };

  const state = {
    root,
    disposed: false,
    isLanternBoss: Boolean(lanternCal.enabled),
    localTime: 0,
    phase2Blend: 0,
    windupBlend: 0,
    staggerBlend: 0,
    roarBlend: 0,
    mouthBlend: 0,
    baseHammerRadius: hammerCal.radius,
    baseHaloScale,
    baseLanternHaloScale: lanternCal.haloScale || 0.34,
    heatUniforms,
    patchedRecs,
    crownCombatState,
    trailCombatState,
    shoulderLanternGroup,
    shoulderLanternLight,
    shoulderLanternHalo,
    shoulderLanternHaloMat,
    hammerEmberCore,
    hammerFireCrownMesh,
    hammerFireCrownMat,
    hammerFireTrailMesh,
    hammerFireTrailMat,
    hammerCoreMesh: hammerFireCrownMesh,
    hammerHaloSprite,
    haloMat,
    hammerEmberPoints,
    emberGeo,
    emberMat,
    eyeGlowMesh,
    eyeGlowGeo,
    eyeGlowMat,
    weaponHammerBone,
    hammerAttachBone: hammerBone,
    rightHandBone,
    rightShoulderBone,
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
 * - Physical warm flickering `shoulderLanternLight` (`0xff8c2b`, `decay=2`, `distance=6.8`, base=`1.25` on PC)
 * - Speech-reactive organic furnace grin & eye pulsation (`mouthOpen01`, read from params OR automatically from `bossRoot.userData.getBossMouthOpen()`)
 * - Real buoyant volumetric fire crown & swept trail on the warhammer via `.setCombatState(...)`
 * - Heavy Windup (`isWindup`), Act 3 Cutscene Roar, Phase 2 (`phase2Enraged`), and Stagger (`isStaggered`)
 */
export function updateSoulsBossVisuals(bossRoot, dt, params = {}) {
  const root = resolveBossObject(bossRoot);
  const state = root?.userData?.soulsBossVisuals;
  if (!state || state.disposed) return;

  const {
    phase2Enraged = false,
    isWindup = false,
    isStaggered = false,
    isCutsceneRoar = false,
    cutsceneRoar = false,
    bossRoarPeak = false,
    cutsceneAct = 0,
    mouthOpen01,
    mouthOpen,
    elapsed = 0
  } = params || {};

  const safeDt = Number.isFinite(dt) ? (dt < 0 ? 0 : dt > 0.1 ? 0.1 : dt) : 0.016;
  state.localTime += safeDt;
  const t = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : state.localTime;

  // Resolve real-time lip-sync mouth openness (explicit param OR auto-read from models.js animCtrl!)
  let rawMouth = 0;
  if (Number.isFinite(mouthOpen01)) {
    rawMouth = mouthOpen01;
  } else if (Number.isFinite(mouthOpen)) {
    rawMouth = mouthOpen;
  } else if (root.userData) {
    const getMouthFn = root.userData.getBossMouthOpen || root.userData.animCtrl?.getBossMouthOpen;
    if (typeof getMouthFn === 'function') {
      const mv = getMouthFn();
      if (Number.isFinite(mv)) rawMouth = mv;
    }
  }
  const targetMouth = isStaggered ? 0.0 : (rawMouth < 0 ? 0 : rawMouth > 1 ? 1 : rawMouth);

  const roarActive = Boolean(isCutsceneRoar || cutsceneRoar || bossRoarPeak || cutsceneAct === 3);
  const targetP2 = phase2Enraged ? 1.0 : 0.0;
  const targetWindup = isWindup && !isStaggered ? 1.0 : 0.0;
  const targetStagger = isStaggered ? 1.0 : 0.0;
  const targetRoar = roarActive && !isStaggered ? 1.0 : 0.0;

  const kP2 = 1.0 - Math.exp(-(phase2Enraged ? 3.2 : 2.6) * safeDt);
  const kWindup = 1.0 - Math.exp(-(targetWindup > state.windupBlend ? 14.0 : 5.8) * safeDt);
  const kStagger = 1.0 - Math.exp(-(isStaggered ? 10.5 : 3.6) * safeDt);
  const kRoar = 1.0 - Math.exp(-(targetRoar > state.roarBlend ? 7.5 : 3.0) * safeDt);
  const kMouth = 1.0 - Math.exp(-(targetMouth > state.mouthBlend ? 18.0 : 9.5) * safeDt);

  state.phase2Blend += (targetP2 - state.phase2Blend) * kP2;
  state.windupBlend += (targetWindup - state.windupBlend) * kWindup;
  state.staggerBlend += (targetStagger - state.staggerBlend) * kStagger;
  state.roarBlend += (targetRoar - state.roarBlend) * kRoar;
  state.mouthBlend += (targetMouth - state.mouthBlend) * kMouth;

  const p2 = state.phase2Blend;
  const wu = state.windupBlend;
  const stg = state.staggerBlend;
  const roar = state.roarBlend;
  const mouth = state.mouthBlend;
  const staggerDim = 1.0 - stg * 0.84;

  const flare = wu > roar * 0.92 ? wu : roar * 0.92;
  const effPhase2 = p2 > roar * 0.78 ? p2 : roar * 0.78;

  // Dual-harmonic combustion pulse + warm organic speech coal shimmer when speaking
  const slowPulse = Math.sin(t * 2.45) * 0.5 + 0.5;
  const fastPulse = Math.sin(t * 5.8) * 0.65 + Math.sin(t * 12.7) * 0.35;
  const speechCrackle = mouth * (0.55 + 0.30 * Math.sin(t * 9.6) + 0.15 * Math.sin(t * 15.3));
  const pulse = (0.14 * slowPulse) * (1.0 - effPhase2) + (0.28 * (fastPulse * 0.5 + 0.5)) * effPhase2 + 0.10 * speechCrackle;

  // Physical multi-harmonic oil-flame flicker for the Right-Shoulder Iron Lantern
  const lanternFlicker =
    0.91 +
    0.055 * Math.sin(t * 7.1 + 1.13) +
    0.035 * Math.sin(t * 15.9 + 2.87) +
    0.020 * Math.cos(t * 26.3 + 0.41);

  const baseHeat = 0.22 + effPhase2 * 0.72 + flare * 0.68 + pulse;
  const effectiveHeat = baseHeat * staggerDim;

  // 1. Sync PBR armor/skin/hammer & baked emissiveMap shader uniforms (0 allocations!)
  const recs = state.patchedRecs;
  for (let i = 0; i < recs.length; i++) {
    const u = recs[i].uniforms;
    u.uBossTime.value = t;
    u.uBossHeat.value = effectiveHeat;
    u.uBossWindup.value = flare;
    u.uBossPhase2.value = effPhase2;
    u.uBossStaggerDim.value = staggerDim;
    u.uBossMouthOpen.value = mouth;
    u.uBossPulse.value = pulse;
    u.uBossLanternFlicker.value = lanternFlicker;
  }

  // 2. Right-Shoulder Forged Iron Lantern PointLight & Subtle Amber Halo
  if (state.shoulderLanternLight) {
    if (globalLowSpec || root.visible === false) {
      state.shoulderLanternLight.intensity = 0;
    } else {
      const lanternBoost = 1.0 + effPhase2 * 0.28 + flare * 0.22 + mouth * 0.10;
      const stgLantern = 0.38 + 0.62 * staggerDim;
      state.shoulderLanternLight.intensity =
        LANTERN_LIGHT_BASE_INTENSITY * lanternFlicker * lanternBoost * stgLantern;
    }
  }
  if (state.shoulderLanternHalo && state.shoulderLanternHaloMat) {
    const lhScale = state.baseLanternHaloScale * (0.92 + (lanternFlicker - 0.91) * 0.85 + effPhase2 * 0.18 + mouth * 0.08);
    state.shoulderLanternHalo.scale.set(lhScale, lhScale, 1);
    const lhOp = (0.15 + effPhase2 * 0.06 + flare * 0.05) * lanternFlicker * (0.45 + 0.55 * staggerDim);
    state.shoulderLanternHaloMat.opacity = lhOp > 0.24 ? 0.24 : lhOp < 0 ? 0 : lhOp;
  }

  // 3. Real Volumetric Simplex FBM Fire Crown on Hammer Head (buoyant world-up alignment so flames
  //    always lick cleanly upward off the hammer head while leaning beside the Throne AND in combat!)
  const crownMat = state.hammerFireCrownMat;
  const crownMesh = state.hammerFireCrownMesh;
  let hasBuoyantQuat = false;
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
      if (crownMesh.parent) {
        crownMesh.parent.updateWorldMatrix(true, false);
        crownMesh.parent.getWorldQuaternion(_updCrownQuat);
        const qLenSq = _updCrownQuat.lengthSq();
        if (Number.isFinite(qLenSq) && qLenSq > 0.0001) {
          _updCrownQuat.invert();
          crownMesh.quaternion.copy(_updCrownQuat);
          hasBuoyantQuat = true;
        }
      }
      const rBase = state.baseHammerRadius;
      const sx = rBase * (0.86 + effPhase2 * 0.30 + flare * 0.34 + pulse * 0.12) * (0.68 + 0.32 * staggerDim);
      const sy = rBase * (0.84 + effPhase2 * 0.44 + flare * 0.52 + pulse * 0.18) * (0.62 + 0.38 * staggerDim);
      crownMesh.scale.set(sx, sy, sx);
    }
  }

  // 4. Swept Volcanic Fire Trail Ribbons (off in LowSpec)
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

  // 5. Tight Volumetric Hammer Halo Sprite
  const halo = state.hammerHaloSprite;
  if (halo) {
    const haloScale = state.baseHaloScale * (0.72 + effPhase2 * 0.42 + flare * 0.52 + pulse * 0.16) * (0.52 + 0.48 * staggerDim);
    halo.scale.set(haloScale, haloScale, 1);

    const haloOp = (0.18 + effPhase2 * 0.30 + flare * 0.36 + pulse * 0.10) * staggerDim;
    state.haloMat.opacity = haloOp > 0.82 ? 0.82 : haloOp < 0 ? 0 : haloOp;

    const r = 1.0;
    const g = 0.44 - effPhase2 * 0.14 + flare * 0.34 - stg * 0.16;
    const b = 0.10 - effPhase2 * 0.05 + flare * 0.24 - stg * 0.04;
    state.haloMat.color.setRGB(
      r,
      g < 0.08 ? 0.08 : g > 1.0 ? 1.0 : g,
      b < 0.02 ? 0.02 : b > 0.72 ? 0.72 : b
    );
  }

  // 6. GPU Hammer Ember Spark Trail
  const sparks = state.hammerEmberPoints;
  if (sparks) {
    const rawSparkInt = (effPhase2 * 0.92 + flare * 1.12 + (globalLowSpec ? 0.0 : 0.12)) * staggerDim;
    const sparkVisible = rawSparkInt > 0.035;
    sparks.visible = sparkVisible;
    if (sparkVisible) {
      if (hasBuoyantQuat) {
        sparks.quaternion.copy(_updCrownQuat);
      } else if (sparks.parent) {
        sparks.parent.updateWorldMatrix(true, false);
        sparks.parent.getWorldQuaternion(_updCrownQuat);
        const qLenSq = _updCrownQuat.lengthSq();
        if (Number.isFinite(qLenSq) && qLenSq > 0.0001) {
          _updCrownQuat.invert();
          sparks.quaternion.copy(_updCrownQuat);
        }
      }
      const eu = state.emberMat.uniforms;
      eu.uTime.value = t;
      eu.uIntensity.value = rawSparkInt > 1.3 ? 1.3 : rawSparkInt;
      eu.uWindup.value = flare;
      eu.uPhase2.value = effPhase2;
    }
  }

  // 7. Boss Face Fire Glow (Eyes + Organic Speech-Reactive Furnace Cavity!)
  if (state.eyeGlowMat) {
    const eyU = state.eyeGlowMat.uniforms;
    eyU.uTime.value = t;
    eyU.uIntensity.value = 0.62 + effPhase2 * 0.36 + flare * 0.32 + pulse * 0.18;
    eyU.uPhase2.value = effPhase2;
    eyU.uWindup.value = flare;
    eyU.uMouthOpen.value = mouth;
    eyU.uStaggerDim.value = staggerDim;
  }
}

/**
 * Toggles low-spec mobile preset (Yandex Games Mobile):
 * drops Simplex FBM detail to 2 octaves on hammer flames, hides secondary swept trail ribbon,
 * zeroes PC lantern PointLight intensity without mutating scene light count, and caps spark drawRange at 10.
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
 * Cleanly detaches and disposes all per-boss VFX resources (including shoulder lantern PointLight,
 * hammer fire materials, face fire mesh), restores shared GLB materials, and releases shared procedural
 * textures & geometries when the last enhanced boss is disposed (0 WebGL leaks).
 */
export function disposeSoulsBossVisuals(bossRoot) {
  const root = resolveBossObject(bossRoot);
  const state = root?.userData?.soulsBossVisuals;
  if (!state || state.disposed) return;
  state.disposed = true;

  if (state.shoulderLanternGroup?.parent) {
    state.shoulderLanternGroup.parent.remove(state.shoulderLanternGroup);
  }
  if (state.hammerEmberCore?.parent) {
    state.hammerEmberCore.parent.remove(state.hammerEmberCore);
  }
  if (state.eyeGlowMesh?.parent) {
    state.eyeGlowMesh.parent.remove(state.eyeGlowMesh);
  }

  state.shoulderLanternLight?.dispose?.();
  state.shoulderLanternHaloMat?.dispose();
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
