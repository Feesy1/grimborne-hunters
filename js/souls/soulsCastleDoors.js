// Monumental Cinematic Gothic Castle Doors for Chapter 26 — «Abandoned Knight Rift»
// Exclusive ES module (Pass 2 Stage B2):
//   - Twin relief oak & forged-iron gothic doors swinging OUTWARD (+Z toward hero/corridor, 0° -> 82°)
//   - Curved forged-iron floor rail plates under both sweep arcs (y = 0.015, pbr.ironNormal/Roughness
//     + procedural concentric friction-scratch map, 3D anchor bolts & heavy floor door-stops)
//   - Live incandescent orange-white metal-on-metal scrape sparks + thick rolling rail/arch stone dust
//     unified in a single GPU-shaded Points draw call!
//   - Full synchronization with Pass 2 cutscene choreography (`applyCutsceneState`) + 100% backward
//     compatibility (`openDoors`, `startOpening`, `sealDoors`, `sealImmediate`, `resetDoors`, `update`).
//
// Draw-Call Budget (6 DC at rest, 7 DC max during active dust + friction sparks):
//   1. portalDarkMesh  — Merged masonry piers, ashlar rustication, sill & spandrels (darkStoneMat)
//   2. portalTrimMesh  — Merged carved gothic capitals, architrave, colonnettes & keystone (trimStoneMat)
//   3. doorWoodInst    — InstancedMesh (count=2) for both dark oak leaves (CanvasTexture + bumpMap)
//   4. doorIronInst    — InstancedMesh (count=2) for forged straps, scrollwork, bottom shoes, rivets & rings
//   5. lockBarMesh     — Animated heavy wrought-iron crossbar bolt mounted on leftPivot
//   6. floorRailMesh   — Curved forged-iron floor track plates, dual guide rails & stops under +Z sweep arcs
//   7. doorVfxPoints   — Unified GPU-shaded Points for stone dust + incandescent friction sparks (0 DC at rest)

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { SOULS_CASTLE_CONSTANTS } from './soulsCastleLayout.js?v=20261121z64';

const DEFAULT_DOOR_Z = SOULS_CASTLE_CONSTANTS?.BOSS_DOOR_Z ?? -16.0;
const OPENING_HALF_W = SOULS_CASTLE_CONSTANTS?.BOSS_PORTAL_HALF_W ?? 3.15; // 6.30 m clear doorway span
const LEAF_WIDTH = OPENING_HALF_W - 0.02;         // 3.13 m -> 0.04 m dramatic central seam when closed
const SPRING_Y = 4.55;                            // Pointed gothic arch springing height
const ARCH_APEX_Y = 6.40;                         // 6.40 m clear arch apex height
const MAX_OPEN_ANGLE = (82 * Math.PI) / 180;      // 82 deg outward swing into corridor (+Z)

const OPEN_SHUDDER_DURATION = 0.38;
const OPEN_TOTAL_DURATION = 1.85;
const SEAL_TOTAL_DURATION = 0.42;
const SEAL_SLAM_TIME = 0.30;

const BOLT_Y_LOCKED = 2.72;
const BOLT_Y_LIFTED = 3.06;
const BOLT_Y_STOWED = 2.94;
const BOLT_LOCAL_X_LOCKED = OPENING_HALF_W;       // World x = 0 when leftPivot is at -3.15, rotY = 0
const BOLT_LOCAL_X_STOWED = 1.58;                 // Centered cleanly on left leaf (0.06..3.10 m)
const BOLT_LOCAL_Z = 0.255;

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Pointed gothic ogive curve height at distance xAbs from doorway centerline (0..OPENING_HALF_W)
function gothicArchY(xAbs, halfSpan = OPENING_HALF_W, springY = SPRING_Y, apexY = ARCH_APEX_Y) {
  const u = 1.0 - clamp01(Math.abs(xAbs) / Math.max(0.01, halfSpan));
  return springY + (apexY - springY) * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
}

// Leaf local top height at local x (0 at hinge -> LEAF_WIDTH at center seam)
function leafArchY(lx) {
  const xAbs = Math.max(0, OPENING_HALF_W - lx);
  return gothicArchY(xAbs, OPENING_HALF_W, SPRING_Y, ARCH_APEX_Y) - 0.05;
}

// Weighty inertia curve: easeInOutCubic + subtle damped elastic stop against corridor floor bumpers
function easeHeavyDoorOpen(u) {
  const t = clamp01(u);
  const cubic = t < 0.5
    ? 4.0 * t * t * t
    : 1.0 - Math.pow(-2.0 * t + 2.0, 3) * 0.5;
  let elasticBrake = 0;
  if (t > 0.80 && t < 1.0) {
    const s = (t - 0.80) / 0.20;
    elasticBrake = Math.sin(s * Math.PI * 2.0) * (1.0 - s) * 0.018;
  }
  return Math.max(0, cubic + elasticBrake);
}

// ============================================================================
// Geometry Merge, Polar Arc Mesh & UV Projection Helpers
// ============================================================================
function normalizeForMerge(rawGeo) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      g.deleteAttribute(attrName);
    }
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

function applyBoxProjectedUVs(geo, tileScale = 2.8) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !norm || !uv) return geo;
  const inv = 1.0 / Math.max(0.01, tileScale);
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

function applyWoodGrainUVs(geo, horizontal = false, scaleU = 0.55, scaleV = 0.34) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !norm || !uv) return geo;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ax = Math.abs(norm.getX(i));
    const ay = Math.abs(norm.getY(i));
    const az = Math.abs(norm.getZ(i));
    let u;
    let v;
    if (az >= ax && az >= ay) {
      u = horizontal ? y * scaleU : x * scaleU;
      v = horizontal ? x * scaleV : y * scaleV;
    } else if (ax >= ay) {
      u = z * scaleU;
      v = y * scaleV;
    } else {
      u = x * scaleU;
      v = z * scaleV;
    }
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geo;
}

function mergeBucket(parts, boxUvScale = 0) {
  if (!parts.length) return null;
  const normalized = [];
  for (let i = 0; i < parts.length; i++) {
    const g = normalizeForMerge(parts[i]);
    if (boxUvScale > 0) applyBoxProjectedUVs(g, boxUvScale);
    normalized.push(g);
    parts[i].dispose();
  }
  const merged = mergeGeometries(normalized, false);
  for (let i = 0; i < normalized.length; i++) normalized[i].dispose();
  return merged;
}

function placeGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

// Create a box clipped cleanly along its top edge by topYFn(x)
function createArchClippedSlab(x0, x1, yBot, zCenter, zThick, topYFn, segsX = 3) {
  const w = Math.max(0.01, x1 - x0);
  const cx = (x0 + x1) * 0.5;
  const geo = new THREE.BoxGeometry(w, 1.0, zThick, segsX, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i) + cx;
    const ly = pos.getY(i);
    const lz = pos.getZ(i) + zCenter;
    const topY = Math.max(yBot + 0.04, topYFn(lx));
    pos.setXYZ(i, lx, ly > 0 ? topY : yBot, lz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Build a seamless curved iron floor plate / raised rail ribbon with exact outward normals
// and concentric polar UVs (u = arc sweep, v = radial band) so metal scrape scratches curve naturally!
function createCurvedArcPlateGeo(
  pivotX,
  doorZ,
  sideSign,
  rInner,
  rOuter,
  yBot,
  yTop,
  angStart,
  angEnd,
  segs = 16,
  uRepeat = 2.0
) {
  const positions = [];
  const normals = [];
  const uvs = [];

  function pushQuad(p0, p1, p2, p3, nx, ny, nz, uv0, uv1, uv2, uv3) {
    // Auto-orient triangle winding to match desired outward normal (handles both left & right arcs!)
    const ex = p1[0] - p0[0];
    const ey = p1[1] - p0[1];
    const ez = p1[2] - p0[2];
    const fx = p2[0] - p0[0];
    const fy = p2[1] - p0[1];
    const fz = p2[2] - p0[2];
    const cx = ey * fz - ez * fy;
    const cy = ez * fx - ex * fz;
    const cz = ex * fy - ey * fx;
    const flip = (cx * nx + cy * ny + cz * nz) < 0;

    const verts = flip ? [p0, p2, p1, p0, p3, p2] : [p0, p1, p2, p0, p2, p3];
    const texs = flip ? [uv0, uv2, uv1, uv0, uv3, uv2] : [uv0, uv1, uv2, uv0, uv2, uv3];
    for (let k = 0; k < 6; k++) {
      positions.push(verts[k][0], verts[k][1], verts[k][2]);
      normals.push(nx, ny, nz);
      uvs.push(texs[k][0], texs[k][1]);
    }
  }

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const a0 = angStart + (angEnd - angStart) * t0;
    const a1 = angStart + (angEnd - angStart) * t1;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);

    const u0 = t0 * uRepeat;
    const u1 = t1 * uRepeat;

    const in0T = [pivotX + sideSign * rInner * c0, yTop, doorZ + rInner * s0];
    const out0T = [pivotX + sideSign * rOuter * c0, yTop, doorZ + rOuter * s0];
    const out1T = [pivotX + sideSign * rOuter * c1, yTop, doorZ + rOuter * s1];
    const in1T = [pivotX + sideSign * rInner * c1, yTop, doorZ + rInner * s1];

    const in0B = [in0T[0], yBot, in0T[2]];
    const out0B = [out0T[0], yBot, out0T[2]];
    const out1B = [out1T[0], yBot, out1T[2]];
    const in1B = [in1T[0], yBot, in1T[2]];

    // Top scraped iron face (y = yTop, normal = +Y)
    pushQuad(in0T, out0T, out1T, in1T, 0, 1, 0, [u0, 0], [u0, 1], [u1, 1], [u1, 0]);

    // Outer beveled edge
    const am = (a0 + a1) * 0.5;
    const oxN = sideSign * Math.cos(am);
    const ozN = Math.sin(am);
    pushQuad(out0B, out1B, out1T, out0T, oxN, 0.15, ozN, [u0, 0.9], [u1, 0.9], [u1, 1], [u0, 1]);

    // Inner beveled edge
    pushQuad(in0B, in0T, in1T, in1B, -oxN, 0.15, -ozN, [u0, 0], [u0, 0.1], [u1, 0.1], [u1, 0]);

    // Start & end bevel caps
    if (i === 0) {
      pushQuad(in0B, out0B, out0T, in0T, sideSign * s0, 0, -c0, [0, 0], [0, 1], [0.05, 1], [0.05, 0]);
    }
    if (i === segs - 1) {
      pushQuad(in1B, in1T, out1T, out1B, -sideSign * s1, 0, c1, [uRepeat, 0], [uRepeat, 0.05], [uRepeat, 1], [uRepeat, 0.95]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

// ============================================================================
// Procedural Dark Cathedral Oak Wood-Grain CanvasTexture + BumpMap
// ============================================================================
function createDarkOakWoodTextures(isMobile = false) {
  const size = isMobile ? 256 : 512;
  const rand = makeRng(0x5011D00A);

  if (typeof document === 'undefined' || !document.createElement) {
    const sz = 16;
    const albedoData = new Uint8Array(sz * sz * 4);
    const bumpData = new Uint8Array(sz * sz * 4);
    for (let i = 0; i < sz * sz; i++) {
      const idx = i * 4;
      albedoData[idx] = 52;
      albedoData[idx + 1] = 36;
      albedoData[idx + 2] = 27;
      albedoData[idx + 3] = 255;
      bumpData[idx] = 128;
      bumpData[idx + 1] = 128;
      bumpData[idx + 2] = 128;
      bumpData[idx + 3] = 255;
    }
    const map = new THREE.DataTexture(albedoData, sz, sz, THREE.RGBAFormat);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;

    const bumpMap = new THREE.DataTexture(bumpData, sz, sz, THREE.RGBAFormat);
    bumpMap.colorSpace = THREE.NoColorSpace;
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.needsUpdate = true;

    return { map, bumpMap };
  }

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const aImg = aCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const aBuf = aImg.data;
  const bBuf = bImg.data;

  const plankCount = 4;
  const plankW = size / plankCount;
  const plankSeeds = [];
  for (let p = 0; p < plankCount; p++) {
    plankSeeds.push({
      tone: (rand() - 0.5) * 14,
      phase: rand() * 50,
      freq: 1.0 + rand() * 0.45,
      knotX: (p + 0.25 + rand() * 0.5) * plankW,
      knotY: (0.18 + rand() * 0.64) * size,
      knotR: (0.14 + rand() * 0.14) * plankW
    });
  }

  const invSize = 1.0 / size;
  for (let y = 0; y < size; y++) {
    const ny = y * invSize;
    for (let x = 0; x < size; x++) {
      const pIdx = Math.min(plankCount - 1, Math.floor(x / plankW));
      const ps = plankSeeds[pIdx];
      const localX = x - pIdx * plankW;
      const distEdge = Math.min(localX, plankW - localX);

      const seamMask = distEdge < 2.5 ? distEdge / 2.5 : 1.0;
      const chamfer = distEdge < 7.0 ? 0.78 + 0.22 * (distEdge / 7.0) : 1.0;

      const kx = (x - ps.knotX) / ps.knotR;
      const ky = (y - ps.knotY) / (ps.knotR * 2.35);
      const kd = Math.sqrt(kx * kx + ky * ky);
      const knotWarp = Math.exp(-kd * kd * 1.45) * 4.2;

      const warp = Math.sin(ny * Math.PI * 4.0 + ps.phase) * 0.42
        + Math.sin(ny * Math.PI * 10.0 + x * 0.04 + ps.phase * 1.7) * 0.16;
      const ringCoord = (localX / plankW) * 13.5 * ps.freq + warp + knotWarp;
      const rings = 0.5 + 0.5 * Math.sin(ringCoord * Math.PI * 2.0);
      const sharpRings = Math.pow(rings, 1.55);

      const fiberA = 0.5 + 0.5 * Math.sin((x * 0.85 + Math.sin(ny * 28.0 + ps.phase) * 1.6) * 1.15);
      const fiberB = 0.5 + 0.5 * Math.sin((x * 1.9 + y * 0.06 + ps.phase) * 1.7);
      const grain = sharpRings * 0.54 + fiberA * 0.28 + fiberB * 0.18;

      const knotDark = kd < 1.15 ? 1.0 - (1.0 - kd / 1.15) * 0.42 : 1.0;
      const ridgeSheen = Math.max(0, grain - 0.62) * 28.0;
      const baseR = (49 + ps.tone + grain * 29 + ridgeSheen * 0.75) * chamfer * knotDark;
      const baseG = (35 + ps.tone * 0.72 + grain * 21 + ridgeSheen * 0.68) * chamfer * knotDark;
      const baseB = (27 + ps.tone * 0.55 + grain * 15 + ridgeSheen * 0.72) * chamfer * knotDark;

      const idx = (y * size + x) * 4;
      aBuf[idx] = Math.max(6, Math.min(255, (baseR * (0.24 + 0.76 * seamMask)) | 0));
      aBuf[idx + 1] = Math.max(5, Math.min(255, (baseG * (0.24 + 0.76 * seamMask)) | 0));
      aBuf[idx + 2] = Math.max(5, Math.min(255, (baseB * (0.24 + 0.76 * seamMask)) | 0));
      aBuf[idx + 3] = 255;

      const hVal = clamp01((0.18 + grain * 0.66 + (kd < 1.1 ? (1.0 - kd / 1.1) * 0.14 : 0)) * chamfer * seamMask);
      const bByte = (hVal * 255) | 0;
      bBuf[idx] = bByte;
      bBuf[idx + 1] = bByte;
      bBuf[idx + 2] = bByte;
      bBuf[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  aCtx.strokeStyle = 'rgba(10, 7, 5, 0.44)';
  bCtx.strokeStyle = 'rgba(18, 18, 18, 0.62)';
  for (let c = 0; c < 18; c++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const len = size * (0.10 + rand() * 0.24);
    const lw = 0.8 + rand() * 1.4;
    aCtx.lineWidth = lw;
    bCtx.lineWidth = lw;
    aCtx.beginPath();
    bCtx.beginPath();
    aCtx.moveTo(cx, cy);
    bCtx.moveTo(cx, cy);
    const midX = cx + (rand() - 0.5) * 4.0;
    aCtx.lineTo(midX, cy + len * 0.5);
    aCtx.lineTo(cx + (rand() - 0.5) * 3.0, cy + len);
    bCtx.lineTo(midX, cy + len * 0.5);
    bCtx.lineTo(cx + (rand() - 0.5) * 3.0, cy + len);
    aCtx.stroke();
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = isMobile ? 2 : 4;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = isMobile ? 2 : 4;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

// ============================================================================
// Procedural Dark Forged Iron Floor-Rail Albedo with Bright Scrape Scratches
// (UV u = concentric arc sweep direction, v = radial band across rail plate)
// ============================================================================
function createFloorRailScrapeTexture(isMobile = false) {
  const size = isMobile ? 256 : 512;
  const rand = makeRng(0x5C4A9E12);

  if (typeof document === 'undefined' || !document.createElement) {
    const sz = 16;
    const data = new Uint8Array(sz * sz * 4);
    for (let i = 0; i < sz * sz; i++) {
      const idx = i * 4;
      data[idx] = 56;
      data[idx + 1] = 60;
      data[idx + 2] = 70;
      data[idx + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, sz, sz, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Dark forged iron plate base with subtle forged pitting & soot edges
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#1e222a');
  grad.addColorStop(0.14, '#2a2f3a');
  grad.addColorStop(0.50, '#323845');
  grad.addColorStop(0.86, '#2a2f3a');
  grad.addColorStop(1.0, '#1b1f27');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle hammered iron mottling & rust patina near bolted edges
  for (let i = 0; i < 160; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (4 + rand() * 14) * (size / 512);
    const isRust = y < size * 0.16 || y > size * 0.84;
    ctx.fillStyle = isRust
      ? `rgba(76, 46, 32, ${(0.08 + rand() * 0.12).toFixed(3)})`
      : `rgba(18, 21, 28, ${(0.08 + rand() * 0.14).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Concentric bright brushed-steel & silver-white friction gouges along the arc (horizontal in UV space!)
  const wearBands = [0.22, 0.36, 0.56, 0.74, 0.82];
  for (const bandV of wearBands) {
    const baseY = bandV * size;
    // Worn polished track groove undertone
    const glowG = ctx.createLinearGradient(0, baseY - size * 0.045, 0, baseY + size * 0.045);
    glowG.addColorStop(0.0, 'rgba(130, 142, 160, 0.0)');
    glowG.addColorStop(0.5, 'rgba(148, 160, 178, 0.24)');
    glowG.addColorStop(1.0, 'rgba(130, 142, 160, 0.0)');
    ctx.fillStyle = glowG;
    ctx.fillRect(0, baseY - size * 0.045, size, size * 0.09);

    // Individual sharp bright steel friction scratches
    for (let s = 0; s < 26; s++) {
      const sy = baseY + (rand() - 0.5) * size * 0.068;
      const sx0 = rand() * size * 0.7;
      const len = size * (0.18 + rand() * 0.65);
      const bright = 158 + Math.floor(rand() * 78);
      const alpha = (0.22 + rand() * 0.48).toFixed(3);
      ctx.strokeStyle = `rgba(${bright}, ${bright + 6}, ${Math.min(255, bright + 16)}, ${alpha})`;
      ctx.lineWidth = (0.6 + rand() * 1.6) * (size / 512);
      ctx.beginPath();
      ctx.moveTo(sx0, sy);
      ctx.lineTo(sx0 + len, sy + (rand() - 0.5) * 2.2);
      ctx.stroke();
      // Wrap across seamless U boundary
      if (sx0 + len > size) {
        ctx.beginPath();
        ctx.moveTo(sx0 - size, sy);
        ctx.lineTo(sx0 + len - size, sy + (rand() - 0.5) * 2.2);
        ctx.stroke();
      }
    }
  }

  // Dark incised plate seam joints across radial direction
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.72)';
  ctx.lineWidth = 2.4 * (size / 512);
  for (let j = 0; j < 4; j++) {
    const jx = (j / 4) * size;
    ctx.beginPath();
    ctx.moveTo(jx, 0);
    ctx.lineTo(jx, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = isMobile ? 2 : 4;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 1. Monumental Gothic Stone Portal Geometry (Rustication + Carved Capitals)
// ============================================================================
function buildPortalGeometries(doorZ) {
  const darkParts = [];
  const trimParts = [];

  // Low beveled cathedral threshold stone sill anchoring the doors & iron rails to the stone floor
  darkParts.push(placeGeo(new THREE.BoxGeometry(7.2, 0.06, 1.88), 0, 0.02, doorZ));
  trimParts.push(placeGeo(new THREE.BoxGeometry(6.6, 0.036, 0.20), 0, 0.055, doorZ - 0.84));

  // Flanking monumental fortress piers with alternating ashlar rustication,
  // engaged gothic colonnettes & richly carved multi-tier gothic capitals
  for (const side of [-1, 1]) {
    const px = side * 3.92;
    darkParts.push(placeGeo(new THREE.BoxGeometry(1.44, 5.15, 1.56), px, 2.575, doorZ));
    darkParts.push(placeGeo(new THREE.BoxGeometry(0.68, 3.65, 1.94), side * 4.78, 1.825, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(0.84, 0.28, 2.12), side * 4.78, 3.74, doorZ, 0, 0, -side * 0.22));

    // Inner stone door-stop rabbet on -Z (Throne Hall) jamb face so +Z outward swing is 100% clear!
    darkParts.push(placeGeo(new THREE.BoxGeometry(0.24, SPRING_Y, 0.42), side * 3.24, SPRING_Y * 0.5, doorZ - 0.46));

    // Stepped chamfered gothic base plinths
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.92, 0.34, 2.00), px, 0.17, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.70, 0.24, 1.80), px, 0.46, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.62, 0.18, 1.72), px, 1.38, doorZ));

    // Carved 3D Ashlar Rustication (Руст) — 7 alternating proud quoin & boss courses up each pier
    const rustCourseCount = 7;
    const rustStartY = 0.78;
    const rustPitch = 0.52;
    for (let r = 0; r < rustCourseCount; r++) {
      const ry = rustStartY + r * rustPitch;
      if (Math.abs(ry - 1.38) < 0.16) continue;
      const isLongQuoin = r % 2 === 0;
      const rw = isLongQuoin ? 1.56 : 1.38;
      const rd = isLongQuoin ? 1.74 : 1.66;
      const rh = 0.36;
      if (isLongQuoin) {
        trimParts.push(placeGeo(new THREE.BoxGeometry(rw, rh, rd), px + side * 0.04, ry, doorZ));
        darkParts.push(placeGeo(new THREE.BoxGeometry(1.06, 0.26, 1.80), px + side * 0.06, ry, doorZ));
      } else {
        darkParts.push(placeGeo(new THREE.BoxGeometry(rw, rh, rd), px + side * 0.02, ry, doorZ));
        trimParts.push(placeGeo(new THREE.BoxGeometry(0.54, 0.34, 1.82), px + side * 0.56, ry, doorZ));
      }
    }

    // Engaged twin gothic jamb colonnettes framing the portal reveal (front & back)
    for (const zOff of [-0.70, 0.70]) {
      const cx = side * 3.26;
      const cz = doorZ + zOff;
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.165, 0.195, 3.68, 8), cx, 2.44, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.11, 8), cx, 2.38, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.24, 0.29, 0.26, 8), cx, 0.64, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.21, 0.21, 0.09, 8), cx, 4.26, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.31, 0.19, 0.34, 8), cx, 4.46, cz));
      for (let leaf = 0; leaf < 4; leaf++) {
        const ang = (leaf / 4) * Math.PI * 2 + Math.PI * 0.25;
        trimParts.push(
          placeGeo(
            new THREE.BoxGeometry(0.13, 0.24, 0.13),
            cx + Math.cos(ang) * 0.23,
            4.50,
            cz + Math.sin(ang) * 0.23,
            Math.sin(ang) * 0.32,
            ang,
            -Math.cos(ang) * 0.32
          )
        );
      }
      trimParts.push(placeGeo(new THREE.BoxGeometry(0.68, 0.13, 0.68), cx, 4.68, cz));
    }

    // Main Pier Carved Gothic Impost Capital: astragal necking + dentil corbel frieze + cornice
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.66, 0.14, 1.78), px, SPRING_Y - 0.12, doorZ));
    for (const faceZ of [-0.90, 0.90]) {
      for (const ox of [-0.48, 0.0, 0.48]) {
        trimParts.push(placeGeo(new THREE.BoxGeometry(0.22, 0.26, 0.22), px + ox, SPRING_Y + 0.04, doorZ + faceZ));
        darkParts.push(placeGeo(new THREE.BoxGeometry(0.16, 0.14, 0.18), px + ox, SPRING_Y - 0.10, doorZ + faceZ * 0.94));
      }
    }
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.86, 0.24, 2.02), px, SPRING_Y + 0.22, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(2.02, 0.20, 2.18), px, SPRING_Y + 0.44, doorZ));

    // Upper tower turret shoulder & crenellated pinnacle
    darkParts.push(placeGeo(new THREE.BoxGeometry(1.36, 2.25, 1.44), side * 3.96, 6.18, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.52, 0.16, 1.62), side * 3.96, 5.72, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.58, 0.24, 1.68), side * 3.96, 7.36, doorZ));
    trimParts.push(placeGeo(new THREE.ConeGeometry(0.56, 1.32, 4), side * 3.96, 8.12, doorZ, 0, Math.PI * 0.25, 0));
  }

  // Sculpted Pointed Gothic Architrave: inner recessed voussoir order + outer stepped hood-mould + crockets
  const archSegs = 8;
  for (const side of [-1, 1]) {
    for (let i = 0; i < archSegs; i++) {
      const t0 = i / archSegs;
      const t1 = (i + 1) / archSegs;
      const tm = (t0 + t1) * 0.5;

      const ix0 = side * (OPENING_HALF_W + 0.18) * (1.0 - t0);
      const ix1 = side * (OPENING_HALF_W + 0.18) * (1.0 - t1);
      const iy0 = gothicArchY(Math.abs(ix0), OPENING_HALF_W + 0.18, SPRING_Y, ARCH_APEX_Y + 0.22);
      const iy1 = gothicArchY(Math.abs(ix1), OPENING_HALF_W + 0.18, SPRING_Y, ARCH_APEX_Y + 0.22);
      const idx = ix1 - ix0;
      const idy = iy1 - iy0;
      const iLen = Math.hypot(idx, idy) + 0.14;
      const iAng = Math.atan2(idy, idx);
      const imx = (ix0 + ix1) * 0.5;
      const imy = (iy0 + iy1) * 0.5;
      const voussoirThick = (i % 2 === 0 ? 0.56 : 0.46) * (1.0 - tm * 0.08);
      trimParts.push(
        placeGeo(new THREE.BoxGeometry(iLen, voussoirThick, 1.66), imx, imy, doorZ, 0, 0, iAng)
      );

      const ox0 = side * (OPENING_HALF_W + 0.72) * (1.0 - t0);
      const ox1 = side * (OPENING_HALF_W + 0.72) * (1.0 - t1);
      const oy0 = gothicArchY(Math.abs(ox0), OPENING_HALF_W + 0.72, SPRING_Y + 0.22, ARCH_APEX_Y + 0.96);
      const oy1 = gothicArchY(Math.abs(ox1), OPENING_HALF_W + 0.72, SPRING_Y + 0.22, ARCH_APEX_Y + 0.96);
      const odx = ox1 - ox0;
      const ody = oy1 - oy0;
      const oLen = Math.hypot(odx, ody) + 0.16;
      const oAng = Math.atan2(ody, odx);
      const omx = (ox0 + ox1) * 0.5;
      const omy = (oy0 + oy1) * 0.5;
      trimParts.push(
        placeGeo(new THREE.BoxGeometry(oLen, 0.36, 1.94), omx, omy, doorZ, 0, 0, oAng)
      );

      if (i % 2 === 1 && i < archSegs - 1) {
        trimParts.push(
          placeGeo(
            new THREE.BoxGeometry(0.24, 0.28, 0.42),
            omx + side * 0.12,
            omy + 0.28,
            doorZ,
            0,
            0,
            oAng + side * 0.35
          )
        );
      }

      const smx = (imx + omx) * 0.5;
      const smy = (imy + omy) * 0.5;
      darkParts.push(
        placeGeo(new THREE.BoxGeometry(iLen + 0.10, 0.52, 1.40), smx, smy, doorZ, 0, 0, iAng)
      );
    }
  }

  // Monumental Carved Gothic Keystone + Heraldic Boss + Apex Crown Finial
  trimParts.push(placeGeo(new THREE.BoxGeometry(0.88, 1.26, 2.00), 0, ARCH_APEX_Y + 0.62, doorZ));
  trimParts.push(placeGeo(new THREE.BoxGeometry(0.64, 0.94, 2.22), 0, ARCH_APEX_Y + 0.56, doorZ));
  trimParts.push(placeGeo(new THREE.BoxGeometry(0.38, 0.38, 2.30), 0, ARCH_APEX_Y + 0.56, doorZ, 0, 0, Math.PI * 0.25));
  trimParts.push(placeGeo(new THREE.BoxGeometry(1.14, 0.24, 2.10), 0, ARCH_APEX_Y + 1.28, doorZ));
  trimParts.push(placeGeo(new THREE.ConeGeometry(0.42, 1.26, 4), 0, ARCH_APEX_Y + 2.02, doorZ, 0, Math.PI * 0.25, 0));
  darkParts.push(placeGeo(new THREE.BoxGeometry(0.56, 0.42, 1.56), 0, ARCH_APEX_Y + 1.48, doorZ));

  return {
    portalDarkGeo: mergeBucket(darkParts, 2.8),
    portalTrimGeo: mergeBucket(trimParts, 2.6)
  };
}

// ============================================================================
// 2. Curved Forged Iron Floor Rails & Track Plates Under Both +Z Sweep Arcs
//    (y = 0.015 base slab + raised scrape rails + 3D floor anchor bolts + stops)
// ============================================================================
function buildFloorRailGeometry(doorZ) {
  const parts = [];
  const arcMax = MAX_OPEN_ANGLE + 0.08; // Sweep slightly past 82° to meet the forged floor stop-bumper

  // Threshold wrought-iron base plate connecting both curved tracks across z = doorZ
  const sillPlate = placeGeo(new THREE.BoxGeometry(OPENING_HALF_W * 2 + 0.2, 0.026, 0.56), 0, 0.015, doorZ + 0.10);
  applyBoxProjectedUVs(sillPlate, 1.4);
  parts.push(sillPlate);

  // Build mirrored curved iron plates on the corridor (+Z) floor under left & right sweeping edges
  for (const side of [-1, 1]) {
    // side = -1 -> left hinge at -3.15 (ray extends +X -> sideSign = +1)
    // side = +1 -> right hinge at +3.15 (ray extends -X -> sideSign = -1)
    const pivotX = side * OPENING_HALF_W;
    const sideSign = -side;

    // Main curved forged-iron sweep apron (y = 0.002..0.024, centered ~0.015, zero floor Z-fighting!)
    parts.push(
      createCurvedArcPlateGeo(
        pivotX, doorZ, sideSign,
        1.78, 3.20,
        0.002, 0.024,
        -0.03, arcMax,
        16, 2.2
      )
    );

    // Outer raised forged-iron friction guide rail (where the door's iron skid shoe grinds & sparks!)
    parts.push(
      createCurvedArcPlateGeo(
        pivotX, doorZ, sideSign,
        2.92, 3.07,
        0.022, 0.038,
        0.0, arcMax,
        16, 2.4
      )
    );

    // Inner raised forged-iron stabilizer track bead
    parts.push(
      createCurvedArcPlateGeo(
        pivotX, doorZ, sideSign,
        2.12, 2.24,
        0.022, 0.034,
        0.0, arcMax,
        14, 2.2
      )
    );

    // 3D forged anchor bolts fastening the curved iron track plates into the corridor stone floor
    const boltCount = 6;
    for (let b = 0; b <= boltCount; b++) {
      const ang = (b / boltCount) * MAX_OPEN_ANGLE;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (const rBolt of [1.88, 3.13]) {
        const bx = pivotX + sideSign * rBolt * ca;
        const bz = doorZ + rBolt * sa;
        const bolt = placeGeo(new THREE.CylinderGeometry(0.038, 0.044, 0.030, 6), bx, 0.030, bz, 0, ang, 0);
        applyBoxProjectedUVs(bolt, 0.8);
        parts.push(bolt);
      }
    }

    // Heavy forged iron floor door-stop bumper at a = 86° catching the open leaf in the corridor
    const stopAng = MAX_OPEN_ANGLE + 0.06;
    const sx = pivotX + sideSign * 2.68 * Math.cos(stopAng);
    const sz = doorZ + 2.68 * Math.sin(stopAng);
    const stopYaw = -sideSign * stopAng;
    const stopBase = placeGeo(new THREE.BoxGeometry(0.46, 0.06, 0.24), sx, 0.04, sz, 0, stopYaw, 0);
    const stopLug = placeGeo(new THREE.BoxGeometry(0.28, 0.14, 0.16), sx, 0.11, sz, 0, stopYaw, 0);
    applyBoxProjectedUVs(stopBase, 1.0);
    applyBoxProjectedUVs(stopLug, 1.0);
    parts.push(stopBase, stopLug);
  }

  return mergeBucket(parts, 0);
}

// ============================================================================
// 3. Canonical Oak Door Leaf Geometry (x: 0..LEAF_WIDTH, symmetric in +-Z)
// ============================================================================
function buildDoorWoodGeometry() {
  const parts = [];
  const rand = makeRng(0xD00A7711);

  const core = createArchClippedSlab(0.08, LEAF_WIDTH - 0.04, 0.08, 0, 0.19, leafArchY, 7);
  applyWoodGrainUVs(core, false, 0.58, 0.34);
  parts.push(core);

  const plankCount = 8;
  const innerStart = 0.22;
  const innerEnd = LEAF_WIDTH - 0.20;
  const span = innerEnd - innerStart;
  const gap = 0.012;
  const plankW = (span - gap * (plankCount - 1)) / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const x0 = innerStart + i * (plankW + gap);
    const x1 = x0 + plankW;
    const zThick = 0.265 + (rand() - 0.5) * 0.018;
    const plank = createArchClippedSlab(x0, x1, 0.24, 0, zThick, (lx) => leafArchY(lx) - 0.16, 2);
    applyWoodGrainUVs(plank, false, 0.62, 0.34);
    parts.push(plank);
  }

  const hingeStile = createArchClippedSlab(0.02, 0.26, 0.04, 0, 0.34, leafArchY, 2);
  applyWoodGrainUVs(hingeStile, false, 0.55, 0.32);
  parts.push(hingeStile);

  const centerStile = createArchClippedSlab(LEAF_WIDTH - 0.24, LEAF_WIDTH, 0.04, 0, 0.34, leafArchY, 2);
  applyWoodGrainUVs(centerStile, false, 0.55, 0.32);
  parts.push(centerStile);

  const railSpecs = [
    { y: 0.17, h: 0.28 },
    { y: 2.02, h: 0.22 },
    { y: 4.26, h: 0.24 }
  ];
  for (const r of railSpecs) {
    const rail = placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.06, r.h, 0.34), LEAF_WIDTH * 0.5, r.y, 0);
    applyWoodGrainUVs(rail, true, 0.55, 0.34);
    parts.push(rail);
  }

  const archSegs = 7;
  for (let i = 0; i < archSegs; i++) {
    const lx0 = 0.06 + (i / archSegs) * (LEAF_WIDTH - 0.12);
    const lx1 = 0.06 + ((i + 1) / archSegs) * (LEAF_WIDTH - 0.12);
    const ly0 = leafArchY(lx0) - 0.11;
    const ly1 = leafArchY(lx1) - 0.11;
    const dx = lx1 - lx0;
    const dy = ly1 - ly0;
    const len = Math.hypot(dx, dy) + 0.08;
    const ang = Math.atan2(dy, dx);
    const seg = placeGeo(
      new THREE.BoxGeometry(len, 0.24, 0.345),
      (lx0 + lx1) * 0.5,
      (ly0 + ly1) * 0.5,
      0,
      0,
      0,
      ang
    );
    applyWoodGrainUVs(seg, true, 0.55, 0.34);
    parts.push(seg);
  }

  for (const mx of [1.14, 2.04]) {
    const rib = createArchClippedSlab(mx - 0.075, mx + 0.075, 0.28, 0, 0.32, (lx) => leafArchY(lx) - 0.18, 2);
    applyWoodGrainUVs(rib, false, 0.55, 0.34);
    parts.push(rib);
  }

  return mergeBucket(parts, 0);
}

// ============================================================================
// 4. Canonical Forged Iron Hardware Geometry (Straps, Scrollwork, Bottom Shoe,
//    3D Rivets, Pull-Rings — uniform box UVs for pbr.ironNormal/ironRoughness)
// ============================================================================
function buildDoorIronGeometry() {
  const parts = [];

  // Heavy cylindrical forged pintle hinge barrels with gothic finial caps along hinge edge
  for (const hy of [1.02, 2.68, 4.24]) {
    parts.push(placeGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.48, 10), 0.04, hy, 0));
    parts.push(placeGeo(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 10), 0.04, hy + 0.26, 0));
    parts.push(placeGeo(new THREE.CylinderGeometry(0.135, 0.135, 0.08, 10), 0.04, hy - 0.26, 0));
    parts.push(placeGeo(new THREE.ConeGeometry(0.085, 0.18, 8), 0.04, hy + 0.38, 0));
    parts.push(placeGeo(new THREE.ConeGeometry(0.085, 0.18, 8), 0.04, hy - 0.38, 0, Math.PI, 0, 0));
  }

  // Heavy forged-iron bottom scraping skid-shoe riding directly over the curved iron floor rails!
  parts.push(placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.04, 0.085, 0.375), LEAF_WIDTH * 0.5, 0.068, 0));
  // Dual protruding wrought-iron guide runners aligned over R = 2.18 and R = 2.99 floor rails
  parts.push(placeGeo(new THREE.BoxGeometry(0.22, 0.048, 0.39), 2.18, 0.046, 0));
  parts.push(placeGeo(new THREE.BoxGeometry(0.24, 0.048, 0.39), 2.99, 0.046, 0));

  // Center meeting edge vertical iron astragal armor band
  parts.push(createArchClippedSlab(LEAF_WIDTH - 0.06, LEAF_WIDTH + 0.008, 0.04, 0, 0.365, leafArchY, 2));

  // Curved iron top rim-binding along the pointed arch contour
  const rimSegs = 6;
  for (let i = 0; i < rimSegs; i++) {
    const lx0 = 0.06 + (i / rimSegs) * (LEAF_WIDTH - 0.10);
    const lx1 = 0.06 + ((i + 1) / rimSegs) * (LEAF_WIDTH - 0.10);
    const ly0 = leafArchY(lx0) - 0.02;
    const ly1 = leafArchY(lx1) - 0.02;
    const dx = lx1 - lx0;
    const dy = ly1 - ly0;
    const len = Math.hypot(dx, dy) + 0.05;
    const ang = Math.atan2(dy, dx);
    parts.push(
      placeGeo(new THREE.BoxGeometry(len, 0.088, 0.372), (lx0 + lx1) * 0.5, (ly0 + ly1) * 0.5, 0, 0, 0, ang)
    );
  }

  // Symmetric wrought-iron straps, scrollwork, 3D rivets, pull-rings & keeper brackets on BOTH faces
  for (const face of [-1, 1]) {
    const strapZ = face * 0.19;
    const rivetZ = face * 0.216;

    const bandSpecs = [
      { y: 1.02, len: 2.86, h: 0.22 },
      { y: 2.68, len: 2.74, h: 0.21 },
      { y: 4.24, len: 2.86, h: 0.22 }
    ];
    for (const b of bandSpecs) {
      parts.push(placeGeo(new THREE.BoxGeometry(b.len, b.h, 0.044), 0.08 + b.len * 0.5, b.y, strapZ));
      parts.push(placeGeo(new THREE.BoxGeometry(b.len - 0.14, 0.055, 0.024), 0.08 + b.len * 0.5, b.y, face * 0.214));

      for (const vy of [-1, 1]) {
        parts.push(
          placeGeo(new THREE.BoxGeometry(0.46, 0.068, 0.036), 0.42, b.y + vy * 0.21, strapZ, 0, 0, vy * 0.52)
        );
        parts.push(
          placeGeo(new THREE.OctahedronGeometry(0.042, 0), 0.62, b.y + vy * 0.32, rivetZ)
        );
      }

      const tipX = 0.08 + b.len;
      parts.push(placeGeo(new THREE.BoxGeometry(0.24, 0.24, 0.048), tipX, b.y, strapZ, 0, 0, Math.PI * 0.25));
      parts.push(placeGeo(new THREE.BoxGeometry(0.20, 0.072, 0.042), tipX - 0.22, b.y + 0.15, strapZ, 0, 0, 0.56));
      parts.push(placeGeo(new THREE.BoxGeometry(0.20, 0.072, 0.042), tipX - 0.22, b.y - 0.15, strapZ, 0, 0, -0.56));

      for (let r = 0; r < 8; r++) {
        const rx = 0.26 + r * 0.355;
        parts.push(placeGeo(new THREE.OctahedronGeometry(0.038, 0), rx, b.y, rivetZ));
      }
    }

    parts.push(placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.12, 0.17, 0.038), LEAF_WIDTH * 0.5, 0.14, strapZ));
    for (let r = 0; r < 6; r++) {
      parts.push(placeGeo(new THREE.OctahedronGeometry(0.034, 0), 0.36 + r * 0.48, 0.14, rivetZ));
    }

    for (let k = 0; k < 5; k++) {
      const rx = 0.42 + k * 0.58;
      const ry = leafArchY(rx) - 0.14;
      parts.push(placeGeo(new THREE.OctahedronGeometry(0.040, 0), rx, ry, rivetZ));
    }

    // Massive Forged Iron Pull-Ring Handle (rosette escutcheon + quatrefoil plate + boss + heavy hanging ring)
    const ringX = 2.46;
    const ringY = 2.02;
    parts.push(
      placeGeo(new THREE.CylinderGeometry(0.32, 0.34, 0.058, 8), ringX, ringY, strapZ, Math.PI * 0.5, 0, Math.PI / 8)
    );
    parts.push(
      placeGeo(new THREE.BoxGeometry(0.42, 0.42, 0.046), ringX, ringY, face * 0.206, 0, 0, Math.PI * 0.25)
    );
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
      parts.push(
        placeGeo(new THREE.OctahedronGeometry(0.032, 0), ringX + Math.cos(a) * 0.23, ringY + Math.sin(a) * 0.23, rivetZ + face * 0.01)
      );
    }
    parts.push(
      placeGeo(new THREE.CylinderGeometry(0.092, 0.115, 0.13, 8), ringX, ringY + 0.04, face * 0.235, Math.PI * 0.5, 0, 0)
    );
    parts.push(
      placeGeo(new THREE.TorusGeometry(0.26, 0.046, 8, 18), ringX, ringY - 0.21, face * 0.282, face * 0.22, 0, 0)
    );

    // Heavy U-shaped Iron Bolt Keeper Brackets
    for (const bx of [0.68, 2.15]) {
      parts.push(placeGeo(new THREE.BoxGeometry(0.28, 0.46, 0.048), bx, BOLT_Y_LOCKED - 0.02, strapZ));
      parts.push(placeGeo(new THREE.OctahedronGeometry(0.030, 0), bx, BOLT_Y_LOCKED + 0.16, rivetZ));
      parts.push(placeGeo(new THREE.OctahedronGeometry(0.030, 0), bx, BOLT_Y_LOCKED - 0.20, rivetZ));
      parts.push(placeGeo(new THREE.BoxGeometry(0.21, 0.078, 0.185), bx, BOLT_Y_LOCKED - 0.145, face * 0.265));
      parts.push(placeGeo(new THREE.BoxGeometry(0.21, 0.22, 0.064), bx, BOLT_Y_LOCKED - 0.055, face * 0.335));
    }
  }

  return mergeBucket(parts, 1.15);
}

// ============================================================================
// 5. Animated Heavy Iron Crossbar Lock-Bar Geometry (Box-projected iron UVs)
// ============================================================================
function buildLockBarGeometry() {
  const parts = [];
  const barLen = 3.04;

  parts.push(new THREE.BoxGeometry(barLen, 0.195, 0.098));
  parts.push(placeGeo(new THREE.BoxGeometry(barLen - 0.12, 0.038, 0.116), 0, 0.095, 0));
  parts.push(placeGeo(new THREE.BoxGeometry(barLen - 0.12, 0.038, 0.116), 0, -0.095, 0));

  for (const side of [-1, 1]) {
    parts.push(placeGeo(new THREE.BoxGeometry(0.15, 0.27, 0.14), side * (barLen * 0.5 - 0.04), 0, 0));
    parts.push(placeGeo(new THREE.BoxGeometry(0.125, 0.245, 0.128), side * 0.92, 0, 0));
  }

  parts.push(placeGeo(new THREE.BoxGeometry(0.38, 0.32, 0.142), 0, 0, 0.01));
  parts.push(placeGeo(new THREE.BoxGeometry(0.26, 0.26, 0.058), 0, 0, 0.078, 0, 0, Math.PI * 0.25));
  parts.push(placeGeo(new THREE.BoxGeometry(0.058, 0.058, 0.115), -0.115, -0.02, 0.108));
  parts.push(placeGeo(new THREE.BoxGeometry(0.058, 0.058, 0.115), 0.115, -0.02, 0.108));
  parts.push(placeGeo(new THREE.BoxGeometry(0.285, 0.062, 0.055), 0, -0.02, 0.15));

  for (const rx of [-1.22, -0.62, -0.34, 0.34, 0.62, 1.22]) {
    parts.push(placeGeo(new THREE.OctahedronGeometry(0.036, 0), rx, 0, 0.064));
  }

  return mergeBucket(parts, 1.15);
}

// ============================================================================
// 6. Unified Stone Dust + Incandescent Iron-Scrape Sparks System (1 Points DC!)
//    aKind = 0 -> billowing warm-gray limestone dust clouds
//    aKind = 1 -> hot white-orange bouncing metal-on-metal friction sparks
// ============================================================================
function createDoorVfxSystem(doorZ, isMobile, trackGeo, trackMat) {
  const count = isMobile ? 120 : 196;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const kinds = new Float32Array(count);
  const heats = new Float32Array(count);

  const velX = new Float32Array(count);
  const velY = new Float32Array(count);
  const velZ = new Float32Array(count);
  const age = new Float32Array(count);
  const life = new Float32Array(count);
  const baseSize = new Float32Array(count);
  const peakAlpha = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    age[i] = 999;
    life[i] = 1;
    alphas[i] = 0;
    sizes[i] = 0;
    kinds[i] = 0;
    heats[i] = 0;
  }

  const geo = trackGeo(new THREE.BufferGeometry());
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1);
  const kindAttr = new THREE.BufferAttribute(kinds, 1);
  const heatAttr = new THREE.BufferAttribute(heats, 1);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  kindAttr.setUsage(THREE.DynamicDrawUsage);
  heatAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setAttribute('aKind', kindAttr);
  geo.setAttribute('aHeat', heatAttr);

  const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const mat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uDustColor: { value: new THREE.Color(0xc5beb2) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aKind;
      attribute float aHeat;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vKind;
      varying float vHeat;
      void main() {
        vAlpha = aAlpha;
        vKind = aKind;
        vHeat = aHeat;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        float maxPt = aKind > 0.5 ? 26.0 : 48.0;
        gl_PointSize = clamp((aSize * uPixelRatio * 240.0) / max(1.0, -mvPos.z), 1.5, maxPt);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uDustColor;
      varying float vAlpha;
      varying float vKind;
      varying float vHeat;
      void main() {
        if (vAlpha <= 0.005) discard;
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;

        if (vKind > 0.5) {
          // Incandescent metal-on-metal friction spark: white-hot core -> molten orange-gold halo -> ember
          float core = smoothstep(0.24, 0.0, d);
          float halo = smoothstep(0.5, 0.06, d);
          vec3 emberCol = vec3(0.95, 0.24, 0.03);
          vec3 orangeCol = vec3(1.0, 0.56, 0.12);
          vec3 whiteHot = vec3(1.0, 0.96, 0.84);
          vec3 sparkCol = mix(emberCol, orangeCol, clamp(vHeat * 1.4, 0.0, 1.0));
          sparkCol = mix(sparkCol, whiteHot, clamp(core * (0.45 + 0.55 * vHeat), 0.0, 1.0));
          // High luminance punch so sparks pop vividly over dark stone & iron rails
          float alpha = clamp((core * 0.95 + halo * halo * 0.65) * vAlpha, 0.0, 1.0);
          gl_FragColor = vec4(sparkCol * (1.25 + 0.75 * core), alpha);
        } else {
          // Billowing warm limestone mortar dust puff
          float soft = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(uDustColor, soft * soft * vAlpha);
        }
      }
    `
  }));

  const points = new THREE.Points(geo, mat);
  points.name = 'CastleDoorStoneDustAndSparks';
  points.frustumCulled = false;
  points.visible = false;
  points.renderOrder = 6;

  const rand = makeRng(0xD057FACE);
  let cursor = 0;
  let activeCount = 0;
  let totalSparksSpawned = 0;

  function spawnParticle(x, y, z, vx, vy, vz, pSize, pLife, pAlpha, kind = 0) {
    const i = cursor;
    cursor = (cursor + 1) % count;
    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    velX[i] = vx;
    velY[i] = vy;
    velZ[i] = vz;
    age[i] = 0;
    life[i] = pLife;
    baseSize[i] = pSize;
    peakAlpha[i] = pAlpha;
    kinds[i] = kind;
    heats[i] = kind > 0.5 ? 1.0 : 0.0;
    sizes[i] = kind > 0.5 ? pSize : pSize * 0.6;
    alphas[i] = kind > 0.5 ? pAlpha : pAlpha * 0.4;
    if (kind > 0.5) totalSparksSpawned++;
    activeCount = count;
    points.visible = true;
  }

  // Generic shudder dust along center vertical seam, hinge crevices & pointed architrave
  function emitShudderDust(n = 8, intensity = 1.0) {
    for (let k = 0; k < n; k++) {
      const zone = rand();
      let sx;
      let sy;
      let sz;
      let vx;
      let vy;
      let vz;
      if (zone < 0.54) {
        sx = (rand() - 0.5) * 0.24;
        sy = 0.45 + rand() * 5.75;
        sz = doorZ + (rand() - 0.5) * 0.42;
        vx = (rand() - 0.5) * 0.72 * intensity;
        vy = (-0.18 + rand() * 0.35) * intensity;
        vz = (0.35 + rand() * 0.95) * (rand() < 0.72 ? 1 : -1) * intensity;
      } else if (zone < 0.84) {
        sx = (rand() - 0.5) * 5.8;
        sy = gothicArchY(Math.abs(sx)) - 0.08 + (rand() - 0.5) * 0.22;
        sz = doorZ + (rand() - 0.5) * 0.85;
        vx = (rand() - 0.5) * 0.48;
        vy = -0.35 - rand() * 0.55;
        vz = (rand() - 0.5) * 0.52;
      } else {
        const side = rand() < 0.5 ? -1 : 1;
        sx = side * (OPENING_HALF_W - 0.06) + (rand() - 0.5) * 0.18;
        sy = 0.6 + rand() * 3.85;
        sz = doorZ + (rand() - 0.5) * 0.36;
        vx = -side * (0.18 + rand() * 0.38);
        vy = -0.15 + rand() * 0.22;
        vz = (rand() - 0.5) * 0.62;
      }
      spawnParticle(
        sx, sy, sz,
        vx, vy, vz,
        0.16 + rand() * 0.26,
        0.75 + rand() * 0.95,
        (0.32 + rand() * 0.36) * Math.min(1.15, 0.55 + intensity * 0.6),
        0
      );
    }
  }

  // Incandescent orange-white metal-on-metal scrape sparks + rolling floor dust directly
  // under the moving bottom scraping shoes of BOTH leaves along the curved iron floor rails!
  function emitRailScrapeSparksAndDust(angleRad, intensity = 1.0, closing = false, pullDir = 1) {
    const clampedInt = clamp01(intensity);
    if (clampedInt <= 0.01) return;

    const ca = Math.cos(angleRad);
    const sa = Math.sin(angleRad);
    const zDir = pullDir >= 0 ? 1 : -1;
    const sparkCount = Math.max(2, Math.round((isMobile ? 4 : 7) * clampedInt));
    const railDustCount = Math.max(1, Math.round((isMobile ? 2 : 4) * clampedInt));

    // 1. Hot orange-white metallic sparks spraying tangentially off the curved iron guide rails
    for (let k = 0; k < sparkCount; k++) {
      const side = (k % 2 === 0) ? -1 : 1; // Alternate left & right moving leaves
      const pivotX = side * OPENING_HALF_W;
      const sideSign = -side;
      // Concentrate sparks right under the dual iron skid runners (r ≈ 2.18 and r ≈ 2.99)
      const r = rand() < 0.66
        ? (2.78 + rand() * 0.32)
        : (1.96 + rand() * 0.38);

      const wx = pivotX + sideSign * r * ca;
      const wz = doorZ + zDir * r * sa;

      // Tangent of sweeping edge: d/da(pivotX + sideSign*r*cos(a), doorZ + zDir*r*sin(a))
      // = (-sideSign*sin(a), zDir*cos(a)). Sparks shoot opposite to scraping travel + slight outward spray!
      const moveSign = closing ? -1 : 1;
      const tanX = -sideSign * sa * moveSign;
      const tanZ = zDir * ca * moveSign;
      const radX = sideSign * ca;
      const radZ = zDir * sa;

      const speed = (2.2 + rand() * 3.4) * (0.65 + 0.45 * clampedInt);
      const spraySpread = (rand() - 0.5) * 1.45;
      const vx = (-tanX * 0.85 + radX * (0.28 + rand() * 0.45)) * speed + spraySpread;
      const vz = (-tanZ * 0.85 + radZ * (0.28 + rand() * 0.45)) * speed + (rand() - 0.5) * 1.1;
      const vy = (0.75 + rand() * 2.05) * (0.7 + 0.4 * clampedInt);

      spawnParticle(
        wx + (rand() - 0.5) * 0.08,
        0.045 + rand() * 0.04,
        wz + (rand() - 0.5) * 0.08,
        vx, vy, vz,
        0.075 + rand() * 0.085,
        0.24 + rand() * 0.36,
        0.88 + rand() * 0.12,
        1
      );
    }

    // 2. Thick swirling stone-dust clouds kicked up along both curved floor rails
    for (let d = 0; d < railDustCount; d++) {
      const side = rand() < 0.5 ? -1 : 1;
      const pivotX = side * OPENING_HALF_W;
      const sideSign = -side;
      const r = 1.65 + rand() * 1.48;
      const wx = pivotX + sideSign * r * ca;
      const wz = doorZ + zDir * r * sa;
      spawnParticle(
        wx + (rand() - 0.5) * 0.22,
        0.08 + rand() * 0.22,
        wz + (rand() - 0.5) * 0.22,
        (rand() - 0.5) * 0.95,
        0.22 + rand() * 0.52,
        (rand() - 0.5) * 0.95 + zDir * (closing ? -0.35 : 0.45),
        0.24 + rand() * 0.28,
        0.85 + rand() * 0.95,
        (0.32 + rand() * 0.32) * (0.6 + 0.5 * clampedInt),
        0
      );
    }
  }

  // Cutscene Stage 1: bolt clank + overhead keystone & architrave mortar shower + bolt sparks
  function emitKeystoneCascade(n = 20) {
    for (let k = 0; k < n; k++) {
      const fromBolt = rand() < 0.38;
      const sx = fromBolt ? (rand() - 0.5) * 2.4 : (rand() - 0.5) * 4.4;
      const sy = fromBolt
        ? BOLT_Y_LOCKED + (rand() - 0.5) * 0.35
        : gothicArchY(Math.abs(sx)) - 0.05 + (rand() - 0.5) * 0.25;
      const sz = doorZ + (fromBolt ? 0.34 + rand() * 0.22 : (rand() - 0.5) * 0.95);
      const vx = (rand() - 0.5) * (fromBolt ? 0.85 : 0.42);
      const vy = fromBolt ? (-0.15 + rand() * 0.45) : (-0.55 - rand() * 0.75);
      const vz = fromBolt ? (0.35 + rand() * 0.75) : ((rand() - 0.5) * 0.55);
      spawnParticle(
        sx, sy, sz,
        vx, vy, vz,
        0.15 + rand() * 0.24,
        0.90 + rand() * 1.15,
        0.34 + rand() * 0.34,
        0
      );
    }
  }

  // Cutscene Stage 2: breakaway crack (0 -> 12 deg) pressurized vertical seam + initial floor scrape sparks
  function emitBreakawaySeamBurst(n = 26) {
    for (let k = 0; k < n; k++) {
      const fromHinge = rand() < 0.28;
      let sx;
      let sy;
      let vx;
      if (fromHinge) {
        const side = rand() < 0.5 ? -1 : 1;
        sx = side * (OPENING_HALF_W - 0.05) + (rand() - 0.5) * 0.16;
        sy = 0.5 + rand() * 4.0;
        vx = -side * (0.30 + rand() * 0.55);
      } else {
        sx = (rand() - 0.5) * 0.32;
        sy = 0.35 + rand() * 5.85;
        vx = (rand() - 0.5) * 0.95;
      }
      const sz = doorZ + (rand() - 0.5) * 0.48;
      const vy = -0.22 + rand() * 0.38;
      const vz = (0.55 + rand() * 1.15) * (rand() < 0.78 ? 1 : -1);
      spawnParticle(
        sx, sy, sz,
        vx, vy, vz,
        0.20 + rand() * 0.30,
        0.85 + rand() * 1.05,
        0.40 + rand() * 0.34,
        0
      );
    }
  }

  // Cutscene Stage 3: billowing portal dust cloud as doors sweep wide outward (+Z)
  function emitPortalBillowCloud(n = 30) {
    for (let k = 0; k < n; k++) {
      const fromArch = rand() < 0.42;
      const sx = (rand() - 0.5) * 5.8;
      const sy = fromArch
        ? gothicArchY(Math.abs(sx)) - 0.12 + (rand() - 0.5) * 0.30
        : 0.15 + rand() * 3.8;
      const sz = doorZ + rand() * 1.4 + (rand() - 0.5) * 0.7;
      const vx = (rand() - 0.5) * 1.35;
      const vy = fromArch ? (-0.45 - rand() * 0.65) : (0.12 + rand() * 0.65);
      const vz = (0.65 + rand() * 1.45) * (rand() < 0.65 ? 1 : -1);
      spawnParticle(
        sx, sy, sz,
        vx, vy, vz,
        0.24 + rand() * 0.36,
        1.05 + rand() * 1.15,
        0.34 + rand() * 0.32,
        0
      );
    }
  }

  // Cutscene Stage 4 & sealDoors() slam: shockwave floor/seam dust + metallic clash sparks!
  function emitSlamBurst(n = 34) {
    for (let k = 0; k < n; k++) {
      const fromFloor = rand() < 0.55;
      const sx = fromFloor ? (rand() - 0.5) * 6.2 : (rand() - 0.5) * 0.42;
      const sy = fromFloor ? (0.08 + rand() * 0.38) : (0.45 + rand() * 5.75);
      const sz = doorZ + (rand() - 0.5) * 0.52;
      const vx = (rand() - 0.5) * (fromFloor ? 2.15 : 1.10);
      const vy = fromFloor ? (0.38 + rand() * 1.05) : (-0.20 + rand() * 0.45);
      const vz = (0.75 + rand() * 1.75) * (rand() < 0.5 ? 1 : -1);
      spawnParticle(
        sx, sy, sz,
        vx, vy, vz,
        0.24 + rand() * 0.38,
        0.78 + rand() * 0.95,
        0.42 + rand() * 0.36,
        0
      );
    }
    // Impact sparks erupting from the center iron astragal & floor threshold on slam
    const impactSparks = isMobile ? 12 : 22;
    for (let s = 0; s < impactSparks; s++) {
      const alongFloor = rand() < 0.65;
      const sx = alongFloor ? (rand() - 0.5) * 5.6 : (rand() - 0.5) * 0.25;
      const sy = alongFloor ? 0.055 : (1.2 + rand() * 2.2);
      const sz = doorZ + (rand() - 0.5) * 0.35;
      spawnParticle(
        sx, sy, sz,
        (rand() - 0.5) * 4.2,
        1.1 + rand() * 2.6,
        (0.8 + rand() * 2.6) * (rand() < 0.5 ? 1 : -1),
        0.08 + rand() * 0.085,
        0.25 + rand() * 0.38,
        0.95,
        1
      );
    }
  }

  function clear() {
    for (let i = 0; i < count; i++) {
      age[i] = 999;
      alphas[i] = 0;
      sizes[i] = 0;
      heats[i] = 0;
    }
    activeCount = 0;
    alphaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    heatAttr.needsUpdate = true;
    points.visible = false;
  }

  function update(dt) {
    if (!points.visible) return;
    let alive = 0;
    const dustDrag = Math.exp(-1.85 * dt);
    const sparkDrag = Math.exp(-1.15 * dt);

    for (let i = 0; i < count; i++) {
      const a = age[i];
      const maxL = life[i];
      if (a >= maxL) {
        if (alphas[i] !== 0) {
          alphas[i] = 0;
          sizes[i] = 0;
          heats[i] = 0;
        }
        continue;
      }

      const nextAge = a + dt;
      age[i] = nextAge;
      if (nextAge >= maxL) {
        alphas[i] = 0;
        sizes[i] = 0;
        heats[i] = 0;
        continue;
      }

      alive++;
      const t = nextAge / maxL;
      const i3 = i * 3;
      const isSpark = kinds[i] > 0.5;

      if (isSpark) {
        // Ballistic incandescent metal sparks with realistic iron-floor bounce!
        velX[i] *= sparkDrag;
        velZ[i] *= sparkDrag;
        velY[i] -= 8.8 * dt;

        let ny = positions[i3 + 1] + velY[i] * dt;
        if (ny < 0.038) {
          ny = 0.038;
          if (velY[i] < -0.45) {
            velY[i] = -velY[i] * 0.42;
            velX[i] *= 0.78;
            velZ[i] *= 0.78;
          } else {
            velY[i] = 0;
            velX[i] *= 0.65;
            velZ[i] *= 0.65;
          }
        }
        positions[i3] += velX[i] * dt;
        positions[i3 + 1] = ny;
        positions[i3 + 2] += velZ[i] * dt;

        const cool = 1.0 - t;
        heats[i] = cool * cool;
        alphas[i] = peakAlpha[i] * Math.pow(cool, 0.72);
        sizes[i] = baseSize[i] * (0.45 + 0.65 * cool);
      } else {
        // Billowing stone & mortar dust cloud
        velX[i] *= dustDrag;
        velZ[i] *= dustDrag;
        velY[i] = velY[i] * Math.exp(-0.75 * dt) - 2.35 * dt;

        let ny = positions[i3 + 1] + velY[i] * dt;
        if (ny < 0.05) {
          ny = 0.05;
          velY[i] = 0;
          velX[i] *= 0.82;
          velZ[i] *= 0.82;
        }
        positions[i3] += velX[i] * dt;
        positions[i3 + 1] = ny;
        positions[i3 + 2] += velZ[i] * dt;

        const fadeIn = Math.min(1.0, t / 0.14);
        const fadeOut = 1.0 - t;
        heats[i] = 0;
        alphas[i] = peakAlpha[i] * fadeIn * fadeOut * fadeOut;
        sizes[i] = baseSize[i] * (0.75 + t * 0.95);
      }
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    kindAttr.needsUpdate = true;
    heatAttr.needsUpdate = true;
    activeCount = alive;
    if (alive === 0) {
      points.visible = false;
    }
  }

  return {
    points,
    emitShudderDust,
    emitRailScrapeSparksAndDust,
    emitKeystoneCascade,
    emitBreakawaySeamBurst,
    emitPortalBillowCloud,
    emitSlamBurst,
    clear,
    update,
    isActive: () => activeCount > 0 && points.visible,
    getTotalSparksSpawned: () => totalSparksSpawned
  };
}

// ============================================================================
// Public Factory: createSoulsCastleDoors
// ============================================================================
export function createSoulsCastleDoors({
  darkStoneMat,
  trimStoneMat,
  ironMat,
  pbr = null,
  trackGeo,
  trackMat,
  z = DEFAULT_DOOR_Z,
  isMobile = false
} = {}) {
  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];

  const regGeo = (g) => {
    if (!g) return g;
    ownedGeos.push(g);
    return typeof trackGeo === 'function' ? trackGeo(g) : g;
  };
  const regMat = (m) => {
    if (!m) return m;
    ownedMats.push(m);
    return typeof trackMat === 'function' ? trackMat(m) : m;
  };
  const regTex = (t) => {
    if (t) ownedTex.push(t);
    return t;
  };

  // Fallback materials when invoked standalone / in unit tests
  const resolvedDarkStoneMat = darkStoneMat || regMat(new THREE.MeshStandardMaterial({
    color: 0x5c6274,
    roughness: 0.94,
    metalness: 0.08
  }));
  const resolvedTrimStoneMat = trimStoneMat || regMat(new THREE.MeshStandardMaterial({
    color: 0x8a92a8,
    roughness: 0.90,
    metalness: 0.12
  }));

  // Connect pbr.ironNormal / pbr.ironRoughness to wrought-iron hinges, straps, pull-rings, rivets & lock-bar
  const hasPbrIron = Boolean(pbr && (pbr.ironNormal || pbr.ironRoughness));
  const resolvedIronMat = hasPbrIron
    ? regMat(new THREE.MeshStandardMaterial({
      color: ironMat?.color ? ironMat.color.clone() : new THREE.Color(0x2d323d),
      normalMap: pbr.ironNormal || ironMat?.normalMap || null,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: pbr.ironRoughness || ironMat?.roughnessMap || null,
      roughness: 0.88,
      metalness: 0.86
    }))
    : (ironMat || regMat(new THREE.MeshStandardMaterial({
      color: 0x2d323d,
      roughness: 0.74,
      metalness: 0.86
    })));

  // Curved forged-iron floor rail material: pbr.ironNormal/Roughness + concentric steel friction-scratch map
  const floorRailScrapeTex = regTex(createFloorRailScrapeTexture(isMobile));
  const floorRailMat = regMat(new THREE.MeshStandardMaterial({
    map: floorRailScrapeTex,
    normalMap: pbr?.ironNormal || ironMat?.normalMap || null,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: pbr?.ironRoughness || ironMat?.roughnessMap || null,
    color: 0xd8dee9,
    roughness: 0.68,
    metalness: 0.88
  }));

  // Procedural Dark Oak Wood material (wood-grain CanvasTexture + matching bumpMap)
  const woodTex = createDarkOakWoodTextures(isMobile);
  regTex(woodTex.map);
  regTex(woodTex.bumpMap);

  const oakWoodMat = regMat(new THREE.MeshStandardMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.088,
    color: 0xd8c8ba,
    roughness: 0.84,
    metalness: 0.07
  }));

  const group = new THREE.Group();
  group.name = 'SoulsCastleDoors';

  // --- DC 1 & DC 2: Monumental Pointed Gothic Stone Portal (Rustication + Carved Capitals) ---
  const { portalDarkGeo, portalTrimGeo } = buildPortalGeometries(z);
  const portalDarkMesh = new THREE.Mesh(regGeo(portalDarkGeo), resolvedDarkStoneMat);
  portalDarkMesh.castShadow = true;
  portalDarkMesh.receiveShadow = true;
  portalDarkMesh.name = 'CastlePortalDarkStone';
  group.add(portalDarkMesh);

  const portalTrimMesh = new THREE.Mesh(regGeo(portalTrimGeo), resolvedTrimStoneMat);
  portalTrimMesh.castShadow = true;
  portalTrimMesh.receiveShadow = true;
  portalTrimMesh.name = 'CastlePortalTrimStone';
  group.add(portalTrimMesh);

  // --- Hinge Pivots (exact coordinates: leftPivot at x = -3.15, rightPivot at x = +3.15) ---
  const leftPivot = new THREE.Group();
  leftPivot.name = 'CastleDoorLeftPivot';
  leftPivot.position.set(-OPENING_HALF_W, 0, z);
  group.add(leftPivot);

  const rightPivot = new THREE.Group();
  rightPivot.name = 'CastleDoorRightPivot';
  rightPivot.position.set(OPENING_HALF_W, 0, z);
  group.add(rightPivot);

  // --- DC 3: Twin Dark Relief Oak Door Leaves (1 InstancedMesh = 1 DC for both leaves!) ---
  const doorWoodGeo = regGeo(buildDoorWoodGeometry());
  const doorWoodInst = new THREE.InstancedMesh(doorWoodGeo, oakWoodMat, 2);
  doorWoodInst.name = 'CastleDoorWoodLeaves';
  doorWoodInst.castShadow = true;
  doorWoodInst.receiveShadow = true;
  doorWoodInst.frustumCulled = false;
  group.add(doorWoodInst);

  // --- DC 4: Twin Forged Wrought-Iron Straps, Bottom Skid Shoes, Scrollwork, Rivets & Rings ---
  const doorIronGeo = regGeo(buildDoorIronGeometry());
  const doorIronInst = new THREE.InstancedMesh(doorIronGeo, resolvedIronMat, 2);
  doorIronInst.name = 'CastleDoorIronHardware';
  doorIronInst.castShadow = true;
  doorIronInst.receiveShadow = true;
  doorIronInst.frustumCulled = false;
  group.add(doorIronInst);

  // --- DC 5: Animated Heavy Wrought-Iron Crossbar Lock-Bar (child of leftPivot) ---
  const lockBarGeo = regGeo(buildLockBarGeometry());
  const lockBarMesh = new THREE.Mesh(lockBarGeo, resolvedIronMat);
  lockBarMesh.name = 'CastleDoorLockBar';
  lockBarMesh.castShadow = true;
  lockBarMesh.receiveShadow = true;
  lockBarMesh.position.set(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z);
  leftPivot.add(lockBarMesh);

  // --- DC 6: Curved Forged Iron Floor Rails & Track Plates Under Both +Z Sweep Arcs ---
  const floorRailGeo = regGeo(buildFloorRailGeometry(z));
  const floorRailMesh = new THREE.Mesh(floorRailGeo, floorRailMat);
  floorRailMesh.name = 'CastleDoorIronFloorRails';
  floorRailMesh.receiveShadow = true;
  floorRailMesh.castShadow = false;
  group.add(floorRailMesh);

  // --- DC 7 (0 DC at rest!): Unified Stone Dust + Incandescent Scrape Sparks Points ---
  const vfxSystem = createDoorVfxSystem(z, isMobile, regGeo, regMat);
  group.add(vfxSystem.points);

  // ==========================================================================
  // Reusable Scratch Matrices & Animation State (Zero per-frame allocations!)
  // ==========================================================================
  const flipYMatrix = new THREE.Matrix4().makeRotationY(Math.PI);
  const rightLeafMatrix = new THREE.Matrix4();

  /** @type {'closed' | 'opening' | 'open' | 'sealed'} */
  let state = 'closed';
  let currentAngle = 0;           // Unsigned opening angle 0 .. MAX_OPEN_ANGLE (82 deg)
  let currentPullDir = 1;         // +1 = outward toward corridor (+Z), -1 = inward (-Z)
  let openAnimTime = 0;
  let sealAnimActive = false;
  let sealAnimTime = 0;
  let sealStartAngle = 0;
  let sealImpactTriggered = false;
  let dustEmitAccum = 0;
  let sparkEmitAccum = 0;
  let doorShudderIntensity = 0;
  let scrapeSparkIntensity = 0;

  // Cutscene Synchronization State
  let cutsceneDriven = false;
  let cutsceneClock = 0;
  let lastCutsceneDustStage = 0;
  let lastCutsceneAngle = 0;
  let cutsceneSlamBurstFired = false;
  let vfxSteppedByCutscene = false;

  const frameResult = {
    state: 'closed',
    openProgress: 0,
    doorShudderIntensity: 0,
    scrapeSparkIntensity: 0,
    isPassable: false,
    dustBurstStage: 0
  };

  // Helper converting unsigned open angle -> pivot Y rotations based on pull direction:
  //   pullDir = +1 (OUTWARD into +Z corridor): leftPivot.rotation.y = -angle, rightPivot.rotation.y = +angle
  //   pullDir = -1 (legacy inward into -Z):    leftPivot.rotation.y = +angle, rightPivot.rotation.y = -angle
  function syncLeafAngles(
    openAngleL,
    openAngleR,
    leftDx = 0,
    leftDz = 0,
    rightDx = 0,
    rightDz = 0,
    pullDir = currentPullDir
  ) {
    const dirSign = pullDir >= 0 ? -1 : 1; // -1 maps positive openAngle -> negative left rotY (+Z swing!)
    leftPivot.position.set(-OPENING_HALF_W + leftDx, 0, z + leftDz);
    leftPivot.rotation.set(0, dirSign * openAngleL, 0);
    leftPivot.updateMatrix();

    rightPivot.position.set(OPENING_HALF_W + rightDx, 0, z + rightDz);
    rightPivot.rotation.set(0, -dirSign * openAngleR, 0);
    rightPivot.updateMatrix();

    // Instance 0: Left leaf (hinged at -3.15, extends +X toward center, swings outward into +Z at rotY < 0)
    doorWoodInst.setMatrixAt(0, leftPivot.matrix);
    doorIronInst.setMatrixAt(0, leftPivot.matrix);

    // Instance 1: Right leaf (hinged at +3.15, flipped via rotY(PI) to extend -X, swings outward into +Z at rotY > 0)
    rightLeafMatrix.multiplyMatrices(rightPivot.matrix, flipYMatrix);
    doorWoodInst.setMatrixAt(1, rightLeafMatrix);
    doorIronInst.setMatrixAt(1, rightLeafMatrix);

    doorWoodInst.instanceMatrix.needsUpdate = true;
    doorIronInst.instanceMatrix.needsUpdate = true;
  }

  function applyBoltTransform(lx, ly, lz, rotZ = 0, rotX = 0) {
    lockBarMesh.position.set(lx, ly, lz);
    lockBarMesh.rotation.set(rotX, 0, rotZ);
  }

  function computePassable() {
    if (state === 'sealed') return false;
    if (state === 'open') return true;
    return state === 'opening' && currentAngle >= MAX_OPEN_ANGLE * 0.45;
  }

  function fillFrameResult() {
    frameResult.state = state;
    frameResult.openProgress = clamp01(currentAngle / MAX_OPEN_ANGLE);
    frameResult.doorShudderIntensity = doorShudderIntensity;
    frameResult.scrapeSparkIntensity = scrapeSparkIntensity;
    frameResult.isPassable = computePassable();
    frameResult.dustBurstStage = lastCutsceneDustStage;
    return frameResult;
  }

  // Initialize closed pose immediately
  syncLeafAngles(0, 0);

  // ==========================================================================
  // Public Control API (Standalone + Pass 2 Cutscene Synchronization)
  // ==========================================================================
  function openDoors() {
    if (state === 'opening' || state === 'open') return false;
    cutsceneDriven = false;
    currentPullDir = 1;
    state = 'opening';
    sealAnimActive = false;
    openAnimTime = 0;
    dustEmitAccum = 0;
    sparkEmitAccum = 0;
    doorShudderIntensity = 0.85;
    scrapeSparkIntensity = 0.25;
    vfxSystem.emitShudderDust(16, 1.0);
    return true;
  }

  function startOpening() {
    return openDoors();
  }

  function sealDoors() {
    if (state === 'sealed' && !sealAnimActive && !cutsceneDriven && currentAngle <= 0.001) {
      return false;
    }
    cutsceneDriven = false;
    state = 'sealed';
    sealAnimActive = true;
    sealAnimTime = 0;
    sealStartAngle = currentAngle;
    sealImpactTriggered = false;
    dustEmitAccum = 0;
    sparkEmitAccum = 0;
    if (sealStartAngle < 0.02) {
      sealAnimTime = SEAL_SLAM_TIME * 0.65;
    }
    return true;
  }

  function sealImmediate() {
    const wasOpen = currentAngle > 0.05 || state !== 'sealed';
    cutsceneDriven = false;
    sealAnimActive = false;
    sealImpactTriggered = true;
    openAnimTime = 0;
    sealAnimTime = 0;
    dustEmitAccum = 0;
    sparkEmitAccum = 0;
    state = 'sealed';
    currentAngle = 0;
    doorShudderIntensity = 0;
    scrapeSparkIntensity = 0;
    applyBoltTransform(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z, 0, 0);
    syncLeafAngles(0, 0);
    if (wasOpen) {
      vfxSystem.emitSlamBurst(isMobile ? 20 : 34);
    }
    return true;
  }

  function resetDoors(keepOpen = false) {
    cutsceneDriven = false;
    cutsceneClock = 0;
    lastCutsceneDustStage = 0;
    lastCutsceneAngle = 0;
    cutsceneSlamBurstFired = false;
    vfxSteppedByCutscene = false;
    sealAnimActive = false;
    sealImpactTriggered = false;
    openAnimTime = 0;
    sealAnimTime = 0;
    dustEmitAccum = 0;
    sparkEmitAccum = 0;
    doorShudderIntensity = 0;
    scrapeSparkIntensity = 0;
    currentPullDir = 1;
    vfxSystem.clear();

    if (keepOpen) {
      state = 'open';
      currentAngle = MAX_OPEN_ANGLE;
      applyBoltTransform(BOLT_LOCAL_X_STOWED, BOLT_Y_STOWED, BOLT_LOCAL_Z, 0, 0);
      syncLeafAngles(MAX_OPEN_ANGLE, MAX_OPEN_ANGLE);
    } else {
      state = 'closed';
      currentAngle = 0;
      applyBoltTransform(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z, 0, 0);
      syncLeafAngles(0, 0);
    }
  }

  /**
   * Direct frame-accurate synchronization with Pass 2 Boss Door Cutscene Choreography:
   *   - Pulls BOTH leaves OUTWARD (+Z toward hero & corridor, 0° -> 12° -> 82°) along curved iron rails
   *   - Emits incandescent orange-white metal-on-metal scrape sparks + thick rolling rail dust
   *     whenever `doorScrapeSparkIntensity > 0`
   *   - Slams shut (82° -> 0°) on `doorSlam` with shockwave dust & impact clash sparks!
   *
   * @param {null | {
   *   doorAngle01?: number,
   *   boltLift01?: number,
   *   doorShudder?: number,
   *   dustBurstStage?: number,
   *   doorSlam?: boolean,
   *   doorScrapeSparkIntensity?: number,
   *   doorPullDirection?: number,
   *   doorFullyClosed?: boolean,
   *   finished?: boolean
   * }} cutsceneState
   * @param {number} [dt=0.016]
   */
  function applyCutsceneState(cutsceneState, dt = 0.016) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0), 0.1);

    if (!cutsceneState || typeof cutsceneState !== 'object') {
      cutsceneDriven = false;
      vfxSteppedByCutscene = false;
      scrapeSparkIntensity = 0;
      return fillFrameResult();
    }

    const angle01 = clamp01(Number(cutsceneState.doorAngle01) || 0);
    const bolt01 = clamp01(Number(cutsceneState.boltLift01) || 0);
    const shudder = clamp01(Number(cutsceneState.doorShudder) || 0);
    const dustStage = Math.max(0, Math.min(4, Math.floor(Number(cutsceneState.dustBurstStage) || 0)));
    const doorSlam = Boolean(cutsceneState.doorSlam);
    const doorFullyClosed = Boolean(cutsceneState.doorFullyClosed);
    const finished = Boolean(cutsceneState.finished);
    const explicitSpark = Number(cutsceneState.doorScrapeSparkIntensity);
    const pullDir = Number.isFinite(cutsceneState.doorPullDirection)
      ? (cutsceneState.doorPullDirection >= 0 ? 1 : -1)
      : 1; // Default: +1 outward into corridor (+Z)

    if (dustStage === 0 || dustStage < lastCutsceneDustStage) {
      lastCutsceneDustStage = 0;
      lastCutsceneAngle = 0;
      cutsceneSlamBurstFired = false;
      cutsceneClock = 0;
    }

    cutsceneClock += safeDt;
    sealAnimActive = false;
    currentPullDir = pullDir;

    const prevAngle = lastCutsceneAngle;
    currentAngle = (finished || doorFullyClosed) ? 0 : angle01 * MAX_OPEN_ANGLE;
    const angularDelta = currentAngle - prevAngle;
    const angularSpeed = safeDt > 0.0005 ? Math.abs(angularDelta) / safeDt : 0;
    const isClosing = doorSlam || angularDelta < -0.0005;
    lastCutsceneAngle = currentAngle;

    // 1. Update high-level state accurately across all acts
    if (finished || doorFullyClosed) {
      state = 'sealed';
      cutsceneDriven = !finished;
    } else {
      cutsceneDriven = true;
      if (doorSlam) {
        state = 'sealed';
      } else if (angle01 >= 0.96) {
        state = 'open';
      } else if (angle01 > 0.002 || bolt01 > 0.01 || shudder > 0.02) {
        state = 'opening';
      } else {
        state = 'closed';
      }
    }

    // 2. Apply outward (+Z) leaf angles + physically weighted shudder vibration
    const effShudder = (finished || doorFullyClosed) ? 0 : shudder;
    doorShudderIntensity = effShudder;

    if (effShudder > 0.005) {
      const openDamp = doorSlam ? 1.0 : (1.0 - clamp01((angle01 - 0.14) / 0.55) * 0.62);
      const oscL = Math.sin(cutsceneClock * 58.0) * 0.62 + Math.sin(cutsceneClock * 97.0 + 1.1) * 0.38;
      const oscR = Math.sin(cutsceneClock * 61.0 + 1.9) * 0.62 + Math.sin(cutsceneClock * 103.0 + 0.4) * 0.38;

      const angJitterL = oscL * 0.032 * effShudder * openDamp;
      const angJitterR = oscR * 0.032 * effShudder * openDamp;
      const jxL = Math.sin(cutsceneClock * 74.0) * 0.017 * effShudder * openDamp;
      const jzL = Math.cos(cutsceneClock * 83.0) * 0.024 * effShudder;
      const jxR = Math.sin(cutsceneClock * 79.0 + 2.2) * 0.017 * effShudder * openDamp;
      const jzR = Math.cos(cutsceneClock * 89.0 + 1.5) * 0.024 * effShudder;

      syncLeafAngles(
        Math.max(-0.04, currentAngle + angJitterL),
        Math.max(-0.04, currentAngle + angJitterR),
        jxL, jzL,
        jxR, jzR,
        pullDir
      );
    } else {
      syncLeafAngles(currentAngle, currentAngle, 0, 0, 0, 0, pullDir);
    }

    // 3. Apply heavy wrought-iron crossbar bolt lift (0..0.72) & retraction onto left leaf (0.72..1.0)
    const effBolt = (finished || doorFullyClosed) ? 0 : bolt01;
    if (effBolt <= 0.001) {
      applyBoltTransform(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z, 0, 0);
    } else if (effBolt < 0.72) {
      const liftFrac = effBolt / 0.72;
      const boltY = BOLT_Y_LOCKED + (BOLT_Y_LIFTED - BOLT_Y_LOCKED) * liftFrac;
      const rattle = effShudder * (1.0 - liftFrac * 0.35);
      const boltX = BOLT_LOCAL_X_LOCKED + Math.sin(cutsceneClock * 92.0) * 0.024 * rattle;
      const boltZ = BOLT_LOCAL_Z + Math.max(0, Math.sin(cutsceneClock * 86.0) * 0.022 * rattle);
      const boltRotZ = Math.sin(cutsceneClock * 68.0) * 0.048 * rattle + liftFrac * 0.042;
      const boltRotX = Math.sin(cutsceneClock * 76.0) * 0.032 * rattle;
      applyBoltTransform(boltX, boltY, boltZ, boltRotZ, boltRotX);
    } else {
      const slideFrac = clamp01((effBolt - 0.72) / 0.28);
      const slideSmooth = slideFrac * slideFrac * (3.0 - 2.0 * slideFrac);
      const boltX = BOLT_LOCAL_X_LOCKED + (BOLT_LOCAL_X_STOWED - BOLT_LOCAL_X_LOCKED) * slideSmooth;
      const stowDrop = clamp01((slideFrac - 0.55) / 0.45);
      const boltY = BOLT_Y_LIFTED + (BOLT_Y_STOWED - BOLT_Y_LIFTED) * stowDrop;
      const boltZ = BOLT_LOCAL_Z + 0.012 * (1.0 - slideSmooth);
      const boltRotZ = (1.0 - slideSmooth) * 0.042;
      applyBoltTransform(boltX, boltY, boltZ, boltRotZ, 0);
    }

    // 4. Fire 4-stage cascading stone dust bursts (monotonic edges 1 -> 2 -> 3 -> 4)
    if (dustStage > lastCutsceneDustStage) {
      for (let st = lastCutsceneDustStage + 1; st <= dustStage; st++) {
        if (st === 1) {
          vfxSystem.emitKeystoneCascade(isMobile ? 14 : 22);
        } else if (st === 2) {
          vfxSystem.emitBreakawaySeamBurst(isMobile ? 18 : 28);
        } else if (st === 3) {
          vfxSystem.emitPortalBillowCloud(isMobile ? 20 : 32);
        } else if (st === 4) {
          if (angle01 <= 0.10 || finished || doorFullyClosed) {
            vfxSystem.emitSlamBurst(isMobile ? 22 : 36);
            cutsceneSlamBurstFired = true;
          } else {
            vfxSystem.emitShudderDust(isMobile ? 10 : 16, 1.0);
          }
        }
      }
      lastCutsceneDustStage = dustStage;
    }

    // Trigger thunderous floor/seam shockwave + clash sparks at exact moment slamming leaves hit 0°
    if ((doorSlam || dustStage >= 4) && !cutsceneSlamBurstFired && (angle01 <= 0.08 || doorFullyClosed || finished)) {
      cutsceneSlamBurstFired = true;
      vfxSystem.emitSlamBurst(isMobile ? 22 : 36);
    }

    // 5. LIVE INCANDESCENT METAL-ON-METAL SCRAPE SPARKS + THICK RAIL DUST
    //    Driven directly by `doorScrapeSparkIntensity` (with graceful motion fallback if omitted)
    const derivedSpark = (!finished && !doorFullyClosed && angularSpeed > 0.06 && angle01 > 0.005 && angle01 < 0.995)
      ? clamp01(angularSpeed * 0.95)
      : 0;
    scrapeSparkIntensity = (finished || doorFullyClosed)
      ? 0
      : (Number.isFinite(explicitSpark) ? clamp01(explicitSpark) : derivedSpark);

    if (scrapeSparkIntensity > 0.01) {
      sparkEmitAccum += safeDt * (22.0 + 36.0 * scrapeSparkIntensity);
      if (sparkEmitAccum >= 1.0) {
        sparkEmitAccum = Math.min(sparkEmitAccum - 1.0, 2.0);
        vfxSystem.emitRailScrapeSparksAndDust(currentAngle, scrapeSparkIntensity, isClosing, pullDir);
      }
    }

    // Continuous arch/seam mortar dust stream while shuddering
    if (!finished && !doorFullyClosed && !doorSlam && effShudder > 0.14 && dustStage >= 1 && dustStage <= 3) {
      const rate = dustStage === 2 ? 56.0 : (dustStage === 1 ? 30.0 : 24.0);
      dustEmitAccum += safeDt * rate * effShudder;
      if (dustEmitAccum >= 1.0) {
        const n = Math.min(8, dustEmitAccum | 0);
        dustEmitAccum -= n;
        vfxSystem.emitShudderDust(n, 0.70 + 0.45 * effShudder);
      }
    }

    vfxSystem.update(safeDt);
    vfxSteppedByCutscene = true;

    return fillFrameResult();
  }

  function getState() {
    return state;
  }

  function update(dt = 0.016, elapsed = 0) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0.016, 0), 0.1);

    if (cutsceneDriven) {
      if (!vfxSteppedByCutscene) {
        vfxSystem.update(safeDt);
      }
      vfxSteppedByCutscene = false;
      return fillFrameResult();
    }

    const clock = Number.isFinite(elapsed) ? elapsed : openAnimTime;
    doorShudderIntensity = 0;
    scrapeSparkIntensity = 0;

    if (state === 'opening') {
      openAnimTime += safeDt;

      if (openAnimTime < OPEN_SHUDDER_DURATION) {
        const p = clamp01(openAnimTime / OPEN_SHUDDER_DURATION);
        const env = Math.sin(Math.min(1.0, p / 0.16) * Math.PI * 0.5)
          * (1.0 - Math.max(0, (p - 0.82) / 0.18) * 0.35);

        const tSig = openAnimTime + clock * 0.0001;
        const oscL = Math.sin(tSig * 58.0) * 0.62 + Math.sin(tSig * 97.0 + 1.1) * 0.38;
        const oscR = Math.sin(tSig * 61.0 + 1.9) * 0.62 + Math.sin(tSig * 103.0 + 0.4) * 0.38;

        const shudderAngleL = oscL * 0.032 * env;
        const shudderAngleR = oscR * 0.032 * env;
        const jxL = Math.sin(tSig * 74.0) * 0.016 * env;
        const jzL = Math.cos(tSig * 83.0) * 0.022 * env;
        const jxR = Math.sin(tSig * 79.0 + 2.2) * 0.016 * env;
        const jzR = Math.cos(tSig * 89.0 + 1.5) * 0.022 * env;

        const preCrack = p > 0.70 ? ((p - 0.70) / 0.30) * 0.018 : 0;
        currentAngle = preCrack;
        syncLeafAngles(
          preCrack + shudderAngleL,
          preCrack + shudderAngleR,
          jxL, jzL,
          jxR, jzR,
          1
        );

        if (p < 0.48) {
          const lp = p / 0.48;
          const liftEase = 1.0 - Math.pow(1.0 - lp, 2.2);
          const boltY = BOLT_Y_LOCKED + (BOLT_Y_LIFTED - BOLT_Y_LOCKED) * liftEase;
          const boltJerkZ = Math.sin(tSig * 88.0) * 0.024 * (1.0 - lp * 0.4);
          const boltRotZ = Math.sin(tSig * 66.0) * 0.048 * (1.0 - lp * 0.5) + liftEase * 0.045;
          applyBoltTransform(
            BOLT_LOCAL_X_LOCKED + Math.sin(tSig * 92.0) * 0.025,
            boltY,
            BOLT_LOCAL_Z + Math.max(0, boltJerkZ),
            boltRotZ,
            Math.sin(tSig * 72.0) * 0.035 * (1.0 - lp * 0.5)
          );
        } else {
          const sp = (p - 0.48) / 0.52;
          const slideEase = sp * sp * (3.0 - 2.0 * sp);
          const boltX = BOLT_LOCAL_X_LOCKED + (BOLT_LOCAL_X_STOWED - BOLT_LOCAL_X_LOCKED) * slideEase;
          const boltY = BOLT_Y_LIFTED + (BOLT_Y_STOWED - BOLT_Y_LIFTED) * Math.max(0, (sp - 0.65) / 0.35);
          const boltRotZ = (1.0 - slideEase) * 0.045;
          applyBoltTransform(boltX, boltY, BOLT_LOCAL_Z + 0.012 * (1.0 - slideEase), boltRotZ, 0);
        }

        dustEmitAccum += safeDt * 68.0;
        if (dustEmitAccum >= 1.0) {
          const n = Math.min(10, dustEmitAccum | 0);
          dustEmitAccum -= n;
          vfxSystem.emitShudderDust(n, 0.85 + 0.3 * env);
        }

        doorShudderIntensity = clamp01(0.28 + 0.72 * env);
        scrapeSparkIntensity = p > 0.62 ? 0.38 : 0;
        if (scrapeSparkIntensity > 0) {
          sparkEmitAccum += safeDt * 24.0;
          if (sparkEmitAccum >= 1.0) {
            sparkEmitAccum -= 1.0;
            vfxSystem.emitRailScrapeSparksAndDust(currentAngle, scrapeSparkIntensity, false, 1);
          }
        }
      } else if (openAnimTime < OPEN_TOTAL_DURATION) {
        // Phase 2 (0.38 .. 1.85 s): Heavy monumental OUTWARD swing (+Z, 0 -> 82 deg) with floor sparks!
        const p2 = clamp01((openAnimTime - OPEN_SHUDDER_DURATION) / (OPEN_TOTAL_DURATION - OPEN_SHUDDER_DURATION));
        const eased = easeHeavyDoorOpen(p2);
        currentAngle = eased * MAX_OPEN_ANGLE;

        const grindDecay = Math.max(0, 1.0 - p2 / 0.34);
        const stopThud = (p2 > 0.80 && p2 < 0.96)
          ? Math.sin(((p2 - 0.80) / 0.16) * Math.PI) * 0.24
          : 0;
        const microRumble = Math.sin(openAnimTime * 46.0) * 0.0045 * grindDecay;
        const jz = Math.cos(openAnimTime * 54.0) * 0.005 * grindDecay;

        syncLeafAngles(
          currentAngle + microRumble,
          currentAngle + microRumble,
          0, jz,
          0, -jz,
          1
        );

        applyBoltTransform(BOLT_LOCAL_X_STOWED, BOLT_Y_STOWED, BOLT_LOCAL_Z, 0, 0);

        if (p2 < 0.86) {
          scrapeSparkIntensity = clamp01(Math.sin(p2 * Math.PI) * 0.92);
          sparkEmitAccum += safeDt * (24.0 + 28.0 * scrapeSparkIntensity);
          if (sparkEmitAccum >= 1.0) {
            sparkEmitAccum = Math.min(sparkEmitAccum - 1.0, 2.0);
            vfxSystem.emitRailScrapeSparksAndDust(currentAngle, scrapeSparkIntensity, false, 1);
          }
        }

        if (p2 < 0.45) {
          dustEmitAccum += safeDt * (28.0 * (1.0 - p2 / 0.45));
          if (dustEmitAccum >= 1.0) {
            const n = Math.min(5, dustEmitAccum | 0);
            dustEmitAccum -= n;
            vfxSystem.emitShudderDust(n, 0.55);
          }
        }

        doorShudderIntensity = clamp01(grindDecay * 0.34 + stopThud);
      } else {
        state = 'open';
        currentAngle = MAX_OPEN_ANGLE;
        applyBoltTransform(BOLT_LOCAL_X_STOWED, BOLT_Y_STOWED, BOLT_LOCAL_Z, 0, 0);
        syncLeafAngles(MAX_OPEN_ANGLE, MAX_OPEN_ANGLE, 0, 0, 0, 0, 1);
        doorShudderIntensity = 0;
        scrapeSparkIntensity = 0;
      }
    } else if (sealAnimActive) {
      sealAnimTime += safeDt;

      if (sealAnimTime < SEAL_SLAM_TIME) {
        const sp = clamp01(sealAnimTime / SEAL_SLAM_TIME);
        const slamEase = sp * sp * sp;
        currentAngle = sealStartAngle * (1.0 - slamEase);
        syncLeafAngles(currentAngle, currentAngle, 0, 0, 0, 0, currentPullDir);

        const slidePre = clamp01((sp - 0.55) / 0.45);
        const bx = BOLT_LOCAL_X_STOWED + (BOLT_LOCAL_X_LOCKED - BOLT_LOCAL_X_STOWED) * (slidePre * 0.45);
        applyBoltTransform(bx, BOLT_Y_LIFTED, BOLT_LOCAL_Z, 0, 0);
        doorShudderIntensity = sp * 0.28;
        scrapeSparkIntensity = clamp01(0.35 + sp * 0.65);
        sparkEmitAccum += safeDt * 42.0;
        if (sparkEmitAccum >= 1.0) {
          sparkEmitAccum -= 1.0;
          vfxSystem.emitRailScrapeSparksAndDust(currentAngle, scrapeSparkIntensity, true, currentPullDir);
        }
      } else if (sealAnimTime < SEAL_TOTAL_DURATION) {
        if (!sealImpactTriggered) {
          sealImpactTriggered = true;
          vfxSystem.emitSlamBurst(isMobile ? 20 : 34);
        }
        const rp = clamp01((sealAnimTime - SEAL_SLAM_TIME) / (SEAL_TOTAL_DURATION - SEAL_SLAM_TIME));
        currentAngle = 0;

        const recoilDecay = (1.0 - rp) * (1.0 - rp);
        const recoilAng = Math.sin(rp * Math.PI * 3.5) * 0.018 * recoilDecay;
        const recoilZ = Math.sin(rp * Math.PI * 2.5) * 0.026 * recoilDecay;
        syncLeafAngles(recoilAng, recoilAng, 0, recoilZ, 0, recoilZ, currentPullDir);

        const slideDone = clamp01(rp / 0.45);
        const bx = BOLT_LOCAL_X_STOWED + (BOLT_LOCAL_X_LOCKED - BOLT_LOCAL_X_STOWED) * (0.45 + 0.55 * slideDone);
        const dropP = clamp01((rp - 0.25) / 0.75);
        let by;
        if (dropP < 0.72) {
          const d = dropP / 0.72;
          by = BOLT_Y_LIFTED - (BOLT_Y_LIFTED - BOLT_Y_LOCKED) * (d * d);
        } else {
          const b = (dropP - 0.72) / 0.28;
          by = BOLT_Y_LOCKED + Math.sin(b * Math.PI) * 0.045;
        }
        applyBoltTransform(bx, by, BOLT_LOCAL_Z, Math.sin(rp * Math.PI * 2.0) * 0.025 * recoilDecay, 0);

        doorShudderIntensity = clamp01(0.95 * recoilDecay);
      } else {
        sealAnimActive = false;
        currentAngle = 0;
        syncLeafAngles(0, 0, 0, 0, 0, 0, currentPullDir);
        applyBoltTransform(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z, 0, 0);
        doorShudderIntensity = 0;
        scrapeSparkIntensity = 0;
      }
    }

    if (!vfxSteppedByCutscene) {
      vfxSystem.update(safeDt);
    }
    vfxSteppedByCutscene = false;

    return fillFrameResult();
  }

  function dispose() {
    for (let i = 0; i < ownedGeos.length; i++) ownedGeos[i].dispose?.();
    for (let i = 0; i < ownedMats.length; i++) ownedMats[i].dispose?.();
    for (let i = 0; i < ownedTex.length; i++) ownedTex[i].dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
  }

  return {
    group,
    leftPivot,
    rightPivot,
    lockBarMesh,
    floorRailMesh,
    openDoors,
    startOpening,
    sealDoors,
    sealImmediate,
    resetDoors,
    applyCutsceneState,
    getState,
    getOpenProgress: () => clamp01(currentAngle / MAX_OPEN_ANGLE),
    isPassable: computePassable,
    getDrawCallCount: () => (vfxSystem.isActive() ? 7 : 6),
    getTotalSparksSpawned: vfxSystem.getTotalSparksSpawned,
    update,
    dispose
  };
}
