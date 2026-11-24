// Monumental Cinematic Gothic Castle Doors for Chapter 26 — «Abandoned Knight Rift»
// Exclusive ES module (Wave 2 Ultra-Detail & Physical PBR Upgrade — ?v=20261124z92):
//   - High-poly sculpted 3D Gothic oak coffers & lancet raised panels (3D-филёнки), chamfered planks,
//     carved timber medallions & 1024px PC procedural oak albedo + bumpMap + roughnessMap
//   - High-poly forged wrought-iron hardware: domed 3D rivets with washer collars, multi-scrollwork
//     fleur-de-lis straps, sculpted quatrefoil/boss escutcheons & collared massive torus pull-rings,
//     tuned for PMREM metallic reflections & dynamic firelight shadows (castShadow/receiveShadow on PC)
//   - High-segment curved forged-iron floor rail plates (y = 0.015) with dual raised runner ribs,
//     countersunk anchor bolts, buttressed floor stops & selective-roughness steel scrape-scratch PBR
//   - Velocity-streaked blackbody-cooling friction sparks (white-hot -> gold -> cherry-orange -> dark
//     glowing ember slag with floor-bounce energy loss) + billowing stone dust in 1 unified Points DC!
//
// Draw-Call Budget (6 DC at rest, 7 DC max during active dust + friction sparks):
//   1. portalDarkMesh  — Merged masonry piers, ashlar rustication, sill & spandrels (darkStoneMat)
//   2. portalTrimMesh  — Merged carved gothic capitals, smooth architrave, colonnettes & keystone
//   3. doorWoodInst    — InstancedMesh (count=2) for both sculpted 3D-coffered dark oak leaves
//   4. doorIronInst    — InstancedMesh (count=2) for high-poly forged straps, domed rivets & pull-rings
//   5. lockBarMesh     — Animated heavy wrought-iron crossbar bolt mounted on leftPivot
//   6. floorRailMesh   — High-poly curved forged-iron floor track plates, dual guide rails & stops
//   7. doorVfxPoints   — Unified GPU-shaded Points for stone dust + velocity-streaked cooling sparks

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { SOULS_CASTLE_CONSTANTS } from './soulsCastleLayout.js?v=20261124z92';

const DEFAULT_DOOR_Z = SOULS_CASTLE_CONSTANTS?.BOSS_DOOR_Z ?? -32.0;
const OPENING_HALF_W = SOULS_CASTLE_CONSTANTS?.BOSS_PORTAL_HALF_W ?? 3.15; // 6.30 m clear doorway span
const LEAF_WIDTH = OPENING_HALF_W - 0.02;         // 3.13 m -> 0.04 m dramatic central seam when closed
const SPRING_Y = 4.55;                            // Pointed gothic arch springing height
const ARCH_APEX_Y = 6.40;                         // 6.40 m clear arch apex height
const MAX_OPEN_ANGLE = (84 * Math.PI) / 180;      // 84 deg epic outward swing into corridor (+Z)

const OPEN_SHUDDER_DURATION = 0.42;
const OPEN_TOTAL_DURATION = 2.05;
const SEAL_TOTAL_DURATION = 0.34;
const SEAL_SLAM_TIME = 0.20;

const BOLT_Y_LOCKED = 2.72;
const BOLT_Y_LIFTED = 3.06;
const BOLT_Y_STOWED = 2.94;
const BOLT_LOCAL_X_LOCKED = OPENING_HALF_W;       // World x = 0 when leftPivot is at -3.15, rotY = 0
const BOLT_LOCAL_X_STOWED = 1.58;                 // Centered cleanly on left leaf (0.06..3.10 m)
const BOLT_LOCAL_Z = 0.258;

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
// Geometry Merge, Bevel Panel, Polar Arc Mesh & UV Projection Helpers
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

// Create a box clipped cleanly along its top edge by topYFn(x), with optional X-edge bevel taper
function createArchClippedSlab(x0, x1, yBot, zCenter, zThick, topYFn, segsX = 4, bevelZ = 0) {
  const w = Math.max(0.01, x1 - x0);
  const cx = (x0 + x1) * 0.5;
  const geo = new THREE.BoxGeometry(w, 1.0, zThick, segsX, 1, 1);
  const pos = geo.attributes.position;
  const halfW = w * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const rawX = pos.getX(i);
    const lx = rawX + cx;
    const ly = pos.getY(i);
    let lz = pos.getZ(i);
    if (bevelZ > 0 && Math.abs(rawX) > halfW * 0.88) {
      lz *= Math.max(0.55, 1.0 - bevelZ);
    }
    const topY = Math.max(yBot + 0.04, topYFn(lx));
    pos.setXYZ(i, lx, ly > 0 ? topY : yBot, lz + zCenter);
  }
  geo.computeVertexNormals();
  return geo;
}

// Create a true 3D beveled raised fielding panel (филёнка: wider back base -> tapered proud front table)
function createBeveledFieldPanelGeo(cx, cy, w, h, zBase, faceSign, depth = 0.032, bevelMargin = 0.055) {
  const geo = new THREE.BoxGeometry(w, h, depth, 1, 1, 1);
  const pos = geo.attributes.position;
  const shrinkX = Math.max(0.45, (w - bevelMargin * 2) / Math.max(0.02, w));
  const shrinkY = Math.max(0.45, (h - bevelMargin * 2) / Math.max(0.02, h));
  const halfD = depth * 0.5;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const isOuterFace = faceSign > 0 ? z > 0 : z < 0;
    if (isOuterFace) {
      x *= shrinkX;
      y *= shrinkY;
    }
    pos.setXYZ(i, cx + x, cy + y, zBase + faceSign * halfD + z);
  }
  geo.computeVertexNormals();
  return geo;
}

// Append a 3D forged rivet (octagonal washer collar + smooth domed hemisphere head)
function appendForgedRivet(bucket, x, y, zSurface, faceSign, radius = 0.038, isMobile = false) {
  if (isMobile) {
    bucket.push(placeGeo(new THREE.OctahedronGeometry(radius * 0.95, 0), x, y, zSurface + faceSign * 0.01));
    return;
  }
  // Forged chamfered washer plate
  bucket.push(
    placeGeo(
      new THREE.CylinderGeometry(radius * 1.18, radius * 1.28, 0.012, 8),
      x, y, zSurface + faceSign * 0.005,
      Math.PI * 0.5, 0, Math.PI / 8
    )
  );
  // Smooth multi-segment hammered dome rivet head catching specular firelight
  const dome = new THREE.SphereGeometry(radius, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
  placeGeo(dome, x, y, zSurface + faceSign * 0.008, faceSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0, 0);
  bucket.push(dome);
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
  segs = 24,
  uRepeat = 2.2
) {
  const positions = [];
  const normals = [];
  const uvs = [];

  function pushQuad(p0, p1, p2, p3, nx, ny, nz, uv0, uv1, uv2, uv3) {
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
    const invLen = 1.0 / Math.max(1e-5, Math.hypot(nx, ny, nz));
    const ux = nx * invLen;
    const uy = ny * invLen;
    const uz = nz * invLen;
    for (let k = 0; k < 6; k++) {
      positions.push(verts[k][0], verts[k][1], verts[k][2]);
      normals.push(ux, uy, uz);
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

    pushQuad(in0T, out0T, out1T, in1T, 0, 1, 0, [u0, 0], [u0, 1], [u1, 1], [u1, 0]);

    const am = (a0 + a1) * 0.5;
    const oxN = sideSign * Math.cos(am);
    const ozN = Math.sin(am);
    pushQuad(out0B, out1B, out1T, out0T, oxN, 0.22, ozN, [u0, 0.9], [u1, 0.9], [u1, 1], [u0, 1]);
    pushQuad(in0B, in0T, in1T, in1B, -oxN, 0.22, -ozN, [u0, 0], [u0, 0.1], [u1, 0.1], [u1, 0]);

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
// Procedural Dark Cathedral Oak Wood-Grain PBR Set (Albedo + Bump + Roughness)
// ============================================================================
function createDarkOakWoodTextures(isMobile = false) {
  const size = isMobile ? 256 : 1024;
  const rand = makeRng(0x5011D00A);

  if (typeof document === 'undefined' || !document.createElement) {
    const sz = 16;
    const albedoData = new Uint8Array(sz * sz * 4);
    const bumpData = new Uint8Array(sz * sz * 4);
    const roughData = new Uint8Array(sz * sz * 4);
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
      roughData[idx] = 196;
      roughData[idx + 1] = 196;
      roughData[idx + 2] = 196;
      roughData[idx + 3] = 255;
    }
    const mk = (buf, srgb) => {
      const t = new THREE.DataTexture(buf, sz, sz, THREE.RGBAFormat);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    };
    return { map: mk(albedoData, true), bumpMap: mk(bumpData, false), roughnessMap: mk(roughData, false) };
  }

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const aImg = aCtx.createImageData(size, size);
  const bImg = bCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const aBuf = aImg.data;
  const bBuf = bImg.data;
  const rBuf = rImg.data;

  const plankCount = 4;
  const plankW = size / plankCount;
  const seamPx = Math.max(2.5, size * 0.0048);
  const chamferPx = Math.max(7.0, size * 0.014);
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
  const coordScale = 512.0 / size;
  for (let y = 0; y < size; y++) {
    const ny = y * invSize;
    for (let x = 0; x < size; x++) {
      const pIdx = Math.min(plankCount - 1, Math.floor(x / plankW));
      const ps = plankSeeds[pIdx];
      const localX = x - pIdx * plankW;
      const distEdge = Math.min(localX, plankW - localX);

      const seamMask = distEdge < seamPx ? distEdge / seamPx : 1.0;
      const chamfer = distEdge < chamferPx ? 0.76 + 0.24 * (distEdge / chamferPx) : 1.0;

      const kx = (x - ps.knotX) / ps.knotR;
      const ky = (y - ps.knotY) / (ps.knotR * 2.35);
      const kd = Math.sqrt(kx * kx + ky * ky);
      const knotWarp = Math.exp(-kd * kd * 1.45) * 4.2;

      const warp = Math.sin(ny * Math.PI * 4.0 + ps.phase) * 0.42
        + Math.sin(ny * Math.PI * 10.0 + x * coordScale * 0.04 + ps.phase * 1.7) * 0.16;
      const ringCoord = (localX / plankW) * 13.5 * ps.freq + warp + knotWarp;
      const rings = 0.5 + 0.5 * Math.sin(ringCoord * Math.PI * 2.0);
      const sharpRings = Math.pow(rings, 1.55);

      const fiberA = 0.5 + 0.5 * Math.sin((x * coordScale * 0.85 + Math.sin(ny * 28.0 + ps.phase) * 1.6) * 1.15);
      const fiberB = 0.5 + 0.5 * Math.sin((x * coordScale * 1.9 + y * coordScale * 0.06 + ps.phase) * 1.7);
      const grain = sharpRings * 0.54 + fiberA * 0.28 + fiberB * 0.18;

      const knotDark = kd < 1.15 ? 1.0 - (1.0 - kd / 1.15) * 0.42 : 1.0;
      const ridgeSheen = Math.max(0, grain - 0.60) * 30.0;
      const baseR = (48 + ps.tone + grain * 30 + ridgeSheen * 0.75) * chamfer * knotDark;
      const baseG = (34 + ps.tone * 0.72 + grain * 22 + ridgeSheen * 0.68) * chamfer * knotDark;
      const baseB = (26 + ps.tone * 0.55 + grain * 16 + ridgeSheen * 0.72) * chamfer * knotDark;

      const idx = (y * size + x) * 4;
      aBuf[idx] = Math.max(6, Math.min(255, (baseR * (0.22 + 0.78 * seamMask)) | 0));
      aBuf[idx + 1] = Math.max(5, Math.min(255, (baseG * (0.22 + 0.78 * seamMask)) | 0));
      aBuf[idx + 2] = Math.max(5, Math.min(255, (baseB * (0.22 + 0.78 * seamMask)) | 0));
      aBuf[idx + 3] = 255;

      const hVal = clamp01((0.16 + grain * 0.68 + (kd < 1.1 ? (1.0 - kd / 1.1) * 0.16 : 0)) * chamfer * seamMask);
      const bByte = (hVal * 255) | 0;
      bBuf[idx] = bByte;
      bBuf[idx + 1] = bByte;
      bBuf[idx + 2] = bByte;
      bBuf[idx + 3] = 255;

      // Physically plausible wood roughness: oiled high grain ridges (~0.54) vs matte pores & seams (~0.94)
      const roughVal = clamp01(0.95 - hVal * 0.41);
      const rByte = (roughVal * 255) | 0;
      rBuf[idx] = rByte;
      rBuf[idx + 1] = rByte;
      rBuf[idx + 2] = rByte;
      rBuf[idx + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const scale = size / 512;
  aCtx.strokeStyle = 'rgba(10, 7, 5, 0.46)';
  bCtx.strokeStyle = 'rgba(14, 14, 14, 0.68)';
  rCtx.strokeStyle = 'rgba(242, 242, 242, 0.70)';
  for (let c = 0; c < 24; c++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const len = size * (0.10 + rand() * 0.24);
    const lw = (0.8 + rand() * 1.5) * scale;
    for (const ctx of [aCtx, bCtx, rCtx]) {
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (rand() - 0.5) * 4.0 * scale, cy + len * 0.5);
      ctx.lineTo(cx + (rand() - 0.5) * 3.0 * scale, cy + len);
      ctx.stroke();
    }
  }

  const aniso = isMobile ? 2 : 8;
  const finalize = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.needsUpdate = true;
    return t;
  };

  return {
    map: finalize(albedoCanvas, true),
    bumpMap: finalize(bumpCanvas, false),
    roughnessMap: finalize(roughCanvas, false)
  };
}

// ============================================================================
// Procedural Forged Iron Floor-Rail Albedo + Selective Scrape RoughnessMap
// (Worn scratched steel scrape arcs ~0.54 vs matte oxidized iron plate ~0.76)
// ============================================================================
function createFloorRailTextures(isMobile = false) {
  const size = isMobile ? 256 : 1024;
  const rand = makeRng(0x5C4A9E12);

  if (typeof document === 'undefined' || !document.createElement) {
    const sz = 16;
    const aData = new Uint8Array(sz * sz * 4);
    const rData = new Uint8Array(sz * sz * 4);
    for (let i = 0; i < sz * sz; i++) {
      const idx = i * 4;
      aData[idx] = 56;
      aData[idx + 1] = 60;
      aData[idx + 2] = 70;
      aData[idx + 3] = 255;
      rData[idx] = 188;
      rData[idx + 1] = 188;
      rData[idx + 2] = 188;
      rData[idx + 3] = 255;
    }
    const mk = (buf, srgb) => {
      const t = new THREE.DataTexture(buf, sz, sz, THREE.RGBAFormat);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    };
    return { map: mk(aData, true), roughnessMap: mk(rData, false) };
  }

  const aCanvas = document.createElement('canvas');
  aCanvas.width = size;
  aCanvas.height = size;
  const aCtx = aCanvas.getContext('2d');

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d');

  const scale = size / 512;

  const grad = aCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#1c2028');
  grad.addColorStop(0.14, '#292f3b');
  grad.addColorStop(0.50, '#323947');
  grad.addColorStop(0.86, '#292f3b');
  grad.addColorStop(1.0, '#1a1e26');
  aCtx.fillStyle = grad;
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = 'rgb(194, 194, 194)'; // ~0.76 matte oxidized forged iron roughness
  rCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 180; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (4 + rand() * 14) * scale;
    const isRust = y < size * 0.16 || y > size * 0.84;
    aCtx.fillStyle = isRust
      ? `rgba(74, 45, 31, ${(0.08 + rand() * 0.12).toFixed(3)})`
      : `rgba(18, 21, 28, ${(0.08 + rand() * 0.14).toFixed(3)})`;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.fill();

    if (isRust) {
      rCtx.fillStyle = 'rgba(232, 232, 232, 0.28)';
      rCtx.beginPath();
      rCtx.arc(x, y, r, 0, Math.PI * 2);
      rCtx.fill();
    }
  }

  // Concentric worn scratched-steel friction gouges & matte-burnished tracks (no mirror glare)
  const wearBands = [0.22, 0.36, 0.56, 0.74, 0.83];
  for (const bandV of wearBands) {
    const baseY = bandV * size;
    const glowG = aCtx.createLinearGradient(0, baseY - size * 0.045, 0, baseY + size * 0.045);
    glowG.addColorStop(0.0, 'rgba(122, 132, 146, 0.0)');
    glowG.addColorStop(0.5, 'rgba(136, 146, 162, 0.20)');
    glowG.addColorStop(1.0, 'rgba(122, 132, 146, 0.0)');
    aCtx.fillStyle = glowG;
    aCtx.fillRect(0, baseY - size * 0.045, size, size * 0.09);

    const roughG = rCtx.createLinearGradient(0, baseY - size * 0.042, 0, baseY + size * 0.042);
    roughG.addColorStop(0.0, 'rgba(158, 158, 158, 0.0)');
    roughG.addColorStop(0.5, 'rgba(150, 150, 150, 0.45)');
    roughG.addColorStop(1.0, 'rgba(158, 158, 158, 0.0)');
    rCtx.fillStyle = roughG;
    rCtx.fillRect(0, baseY - size * 0.042, size, size * 0.084);

    for (let s = 0; s < 34; s++) {
      const sy = baseY + (rand() - 0.5) * size * 0.068;
      const sx0 = rand() * size * 0.7;
      const len = size * (0.18 + rand() * 0.65);
      const bright = 148 + Math.floor(rand() * 68);
      const alpha = (0.22 + rand() * 0.42).toFixed(3);
      const lw = (0.65 + rand() * 1.55) * scale;
      const dy = (rand() - 0.5) * 2.2 * scale;

      aCtx.strokeStyle = `rgba(${bright}, ${bright + 5}, ${Math.min(255, bright + 12)}, ${alpha})`;
      aCtx.lineWidth = lw;
      rCtx.strokeStyle = `rgba(138, 138, 138, ${alpha})`; // ~0.54 worn scratched steel roughness (no mirror glare)
      rCtx.lineWidth = lw * 1.25;

      for (const ox of [0, -size]) {
        if (ox < 0 && sx0 + len <= size) continue;
        aCtx.beginPath();
        aCtx.moveTo(sx0 + ox, sy);
        aCtx.lineTo(sx0 + len + ox, sy + dy);
        aCtx.stroke();

        rCtx.beginPath();
        rCtx.moveTo(sx0 + ox, sy);
        rCtx.lineTo(sx0 + len + ox, sy + dy);
        rCtx.stroke();
      }
    }
  }

  // Dark incised radial plate joints
  aCtx.strokeStyle = 'rgba(10, 12, 16, 0.74)';
  rCtx.strokeStyle = 'rgba(235, 235, 235, 0.80)';
  aCtx.lineWidth = 2.4 * scale;
  rCtx.lineWidth = 3.0 * scale;
  for (let j = 0; j < 4; j++) {
    const jx = (j / 4) * size;
    for (const ctx of [aCtx, rCtx]) {
      ctx.beginPath();
      ctx.moveTo(jx, 0);
      ctx.lineTo(jx, size);
      ctx.stroke();
    }
  }

  const aniso = isMobile ? 2 : 8;
  const finalize = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.needsUpdate = true;
    return t;
  };

  return {
    map: finalize(aCanvas, true),
    roughnessMap: finalize(rCanvas, false)
  };
}

// ============================================================================
// Procedural Scratched, Hammered, Soot-Dulled Wrought-Iron Albedo Map
// (Eliminates smooth obsidian-like glare on door straps, rings, rivets & bolt)
// ============================================================================
function createWroughtIronAlbedoTexture(isMobile = false) {
  const size = isMobile ? 128 : 512;
  const rand = makeRng(0x1A07C0DE);

  if (typeof document === 'undefined' || !document.createElement) {
    const sz = 16;
    const data = new Uint8Array(sz * sz * 4);
    for (let i = 0; i < sz * sz; i++) {
      const idx = i * 4;
      const v = 56 + ((i * 13) % 14);
      data[idx] = v;
      data[idx + 1] = v + 4;
      data[idx + 2] = v + 10;
      data[idx + 3] = 255;
    }
    const t = new THREE.DataTexture(data, sz, sz, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const scale = size / 512;

  // Base charcoal wrought-iron body
  ctx.fillStyle = '#3a404a';
  ctx.fillRect(0, 0, size, size);

  // Seamless hammered soot-cavity & forge-scale mottling
  const drawWrappedDisc = (cx, cy, r, style) => {
    ctx.fillStyle = style;
    for (const ox of [-size, 0, size]) {
      if (cx + ox + r < 0 || cx + ox - r > size) continue;
      for (const oy of [-size, 0, size]) {
        if (cy + oy + r < 0 || cy + oy - r > size) continue;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const blotches = isMobile ? 75 : 220;
  for (let i = 0; i < blotches; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (7 + rand() * 24) * scale;
    const kind = rand();
    if (kind < 0.48) {
      // Soot-dulled hammer hollows
      drawWrappedDisc(x, y, r, `rgba(22, 25, 31, ${(0.10 + rand() * 0.16).toFixed(3)})`);
    } else if (kind < 0.80) {
      // Slightly worn brushed charcoal iron highs
      drawWrappedDisc(x, y, r, `rgba(80, 88, 102, ${(0.07 + rand() * 0.12).toFixed(3)})`);
    } else {
      // Subtle aged forge-scale / iron-oxide patina
      drawWrappedDisc(x, y, r * 0.85, `rgba(76, 52, 38, ${(0.06 + rand() * 0.10).toFixed(3)})`);
    }
  }

  // Seamless multi-directional forged micro-scratches & battle/wear score marks
  const scratches = isMobile ? 90 : 320;
  for (let s = 0; s < scratches; s++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const ang = rand() * Math.PI * 2;
    const len = (10 + rand() * 58) * scale;
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const isLight = rand() < 0.62;
    const v = 122 + Math.floor(rand() * 38);
    ctx.strokeStyle = isLight
      ? `rgba(${v}, ${v + 6}, ${Math.min(255, v + 14)}, ${(0.12 + rand() * 0.22).toFixed(3)})`
      : `rgba(14, 16, 20, ${(0.20 + rand() * 0.26).toFixed(3)})`;
    ctx.lineWidth = (0.55 + rand() * 1.15) * scale;

    for (const ox of [-size, 0, size]) {
      const ax0 = x0 + ox;
      const ax1 = x1 + ox;
      if (Math.max(ax0, ax1) < 0 || Math.min(ax0, ax1) > size) continue;
      for (const oy of [-size, 0, size]) {
        const ay0 = y0 + oy;
        const ay1 = y1 + oy;
        if (Math.max(ay0, ay1) < 0 || Math.min(ay0, ay1) > size) continue;
        ctx.beginPath();
        ctx.moveTo(ax0, ay0);
        ctx.lineTo(ax1, ay1);
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = isMobile ? 2 : 8;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 1. Monumental Gothic Stone Portal Geometry (High-Poly Arch, Capitals & Quoins)
// ============================================================================
function buildPortalGeometries(doorZ, isMobile = false) {
  const darkParts = [];
  const trimParts = [];
  const colSegs = isMobile ? 8 : 16;
  const archSegs = isMobile ? 8 : 14;

  // Low beveled cathedral threshold stone sill anchoring the doors & iron rails to the stone floor
  darkParts.push(placeGeo(new THREE.BoxGeometry(7.2, 0.06, 1.88), 0, 0.02, doorZ));
  trimParts.push(placeGeo(new THREE.BoxGeometry(6.6, 0.036, 0.20), 0, 0.055, doorZ - 0.84));

  for (const side of [-1, 1]) {
    const px = side * 3.92;
    darkParts.push(placeGeo(new THREE.BoxGeometry(1.44, 5.15, 1.56), px, 2.575, doorZ));
    darkParts.push(placeGeo(new THREE.BoxGeometry(0.68, 3.65, 1.94), side * 4.78, 1.825, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(0.84, 0.28, 2.12), side * 4.78, 3.74, doorZ, 0, 0, -side * 0.22));

    // Inner stone door-stop rabbet on -Z (Throne Hall) jamb face so +Z outward swing is 100% clear
    darkParts.push(placeGeo(new THREE.BoxGeometry(0.24, SPRING_Y, 0.42), side * 3.24, SPRING_Y * 0.5, doorZ - 0.46));

    // Stepped chamfered gothic base plinths
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.94, 0.34, 2.02), px, 0.17, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.72, 0.24, 1.82), px, 0.46, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.64, 0.18, 1.74), px, 1.38, doorZ));

    // Carved 3D Ashlar Rustication (Руст) — 7 alternating proud quoin & boss courses up each pier
    const rustCourseCount = 7;
    const rustStartY = 0.78;
    const rustPitch = 0.52;
    for (let r = 0; r < rustCourseCount; r++) {
      const ry = rustStartY + r * rustPitch;
      if (Math.abs(ry - 1.38) < 0.16) continue;
      const isLongQuoin = r % 2 === 0;
      const rw = isLongQuoin ? 1.58 : 1.40;
      const rd = isLongQuoin ? 1.76 : 1.68;
      const rh = 0.36;
      if (isLongQuoin) {
        trimParts.push(placeGeo(new THREE.BoxGeometry(rw, rh, rd), px + side * 0.04, ry, doorZ));
        darkParts.push(placeGeo(new THREE.BoxGeometry(1.08, 0.26, 1.82), px + side * 0.06, ry, doorZ));
      } else {
        darkParts.push(placeGeo(new THREE.BoxGeometry(rw, rh, rd), px + side * 0.02, ry, doorZ));
        trimParts.push(placeGeo(new THREE.BoxGeometry(0.56, 0.34, 1.84), px + side * 0.56, ry, doorZ));
      }
    }

    // Engaged twin gothic jamb colonnettes framing the portal reveal (front & back)
    const leafCount = isMobile ? 4 : 8;
    for (const zOff of [-0.70, 0.70]) {
      const cx = side * 3.26;
      const cz = doorZ + zOff;
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.165, 0.195, 3.68, colSegs), cx, 2.44, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.225, 0.225, 0.11, colSegs), cx, 2.38, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.245, 0.295, 0.26, colSegs), cx, 0.64, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.215, 0.215, 0.09, colSegs), cx, 4.26, cz));
      trimParts.push(placeGeo(new THREE.CylinderGeometry(0.32, 0.19, 0.35, colSegs), cx, 4.46, cz));
      for (let leaf = 0; leaf < leafCount; leaf++) {
        const ang = (leaf / leafCount) * Math.PI * 2 + Math.PI / leafCount;
        trimParts.push(
          placeGeo(
            new THREE.BoxGeometry(0.12, 0.24, 0.12),
            cx + Math.cos(ang) * 0.235,
            4.50,
            cz + Math.sin(ang) * 0.235,
            Math.sin(ang) * 0.34,
            ang,
            -Math.cos(ang) * 0.34
          )
        );
      }
      trimParts.push(placeGeo(new THREE.BoxGeometry(0.68, 0.13, 0.68), cx, 4.68, cz));
    }

    // Main Pier Carved Gothic Impost Capital: astragal necking + dentil corbel frieze + cornice
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.66, 0.14, 1.78), px, SPRING_Y - 0.12, doorZ));
    for (const faceZ of [-0.90, 0.90]) {
      for (const ox of [-0.52, -0.17, 0.17, 0.52]) {
        trimParts.push(placeGeo(new THREE.BoxGeometry(0.19, 0.26, 0.22), px + ox, SPRING_Y + 0.04, doorZ + faceZ));
        darkParts.push(placeGeo(new THREE.BoxGeometry(0.14, 0.14, 0.18), px + ox, SPRING_Y - 0.10, doorZ + faceZ * 0.94));
      }
    }
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.86, 0.24, 2.02), px, SPRING_Y + 0.22, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(2.02, 0.20, 2.18), px, SPRING_Y + 0.44, doorZ));

    // Upper tower turret shoulder & crenellated pinnacle
    darkParts.push(placeGeo(new THREE.BoxGeometry(1.36, 2.25, 1.44), side * 3.96, 6.18, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.52, 0.16, 1.62), side * 3.96, 5.72, doorZ));
    trimParts.push(placeGeo(new THREE.BoxGeometry(1.58, 0.24, 1.68), side * 3.96, 7.36, doorZ));
    trimParts.push(placeGeo(new THREE.ConeGeometry(0.56, 1.34, isMobile ? 4 : 8), side * 3.96, 8.12, doorZ, 0, Math.PI * 0.25, 0));
  }

  // Smooth Pointed Gothic Architrave: inner voussoir order + outer stepped hood-mould + crockets
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
      const iLen = Math.hypot(idx, idy) + 0.09;
      const iAng = Math.atan2(idy, idx);
      const imx = (ix0 + ix1) * 0.5;
      const imy = (iy0 + iy1) * 0.5;
      const voussoirThick = (i % 2 === 0 ? 0.56 : 0.47) * (1.0 - tm * 0.08);
      trimParts.push(
        placeGeo(new THREE.BoxGeometry(iLen, voussoirThick, 1.66), imx, imy, doorZ, 0, 0, iAng)
      );

      const ox0 = side * (OPENING_HALF_W + 0.72) * (1.0 - t0);
      const ox1 = side * (OPENING_HALF_W + 0.72) * (1.0 - t1);
      const oy0 = gothicArchY(Math.abs(ox0), OPENING_HALF_W + 0.72, SPRING_Y + 0.22, ARCH_APEX_Y + 0.96);
      const oy1 = gothicArchY(Math.abs(ox1), OPENING_HALF_W + 0.72, SPRING_Y + 0.22, ARCH_APEX_Y + 0.96);
      const odx = ox1 - ox0;
      const ody = oy1 - oy0;
      const oLen = Math.hypot(odx, ody) + 0.10;
      const oAng = Math.atan2(ody, odx);
      const omx = (ox0 + ox1) * 0.5;
      const omy = (oy0 + oy1) * 0.5;
      trimParts.push(
        placeGeo(new THREE.BoxGeometry(oLen, 0.36, 1.94), omx, omy, doorZ, 0, 0, oAng)
      );

      if (i % 2 === 1 && i < archSegs - 1) {
        trimParts.push(
          placeGeo(
            new THREE.BoxGeometry(0.22, 0.28, 0.44),
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
        placeGeo(new THREE.BoxGeometry(iLen + 0.08, 0.52, 1.40), smx, smy, doorZ, 0, 0, iAng)
      );
    }
  }

  // Monumental Carved Gothic Keystone + Heraldic Boss + Apex Crown Finial
  trimParts.push(placeGeo(new THREE.BoxGeometry(0.88, 1.26, 2.00), 0, ARCH_APEX_Y + 0.62, doorZ));
  trimParts.push(placeGeo(new THREE.BoxGeometry(0.64, 0.94, 2.22), 0, ARCH_APEX_Y + 0.56, doorZ));
  trimParts.push(placeGeo(new THREE.BoxGeometry(0.40, 0.40, 2.32), 0, ARCH_APEX_Y + 0.56, doorZ, 0, 0, Math.PI * 0.25));
  trimParts.push(placeGeo(new THREE.BoxGeometry(1.14, 0.24, 2.10), 0, ARCH_APEX_Y + 1.28, doorZ));
  trimParts.push(placeGeo(new THREE.ConeGeometry(0.42, 1.28, isMobile ? 4 : 8), 0, ARCH_APEX_Y + 2.02, doorZ, 0, Math.PI * 0.25, 0));
  darkParts.push(placeGeo(new THREE.BoxGeometry(0.56, 0.42, 1.56), 0, ARCH_APEX_Y + 1.48, doorZ));

  return {
    portalDarkGeo: mergeBucket(darkParts, 2.8),
    portalTrimGeo: mergeBucket(trimParts, 2.6)
  };
}

// ============================================================================
// 2. High-Poly Curved Forged Iron Floor Rails & Track Plates Under +Z Arcs
// ============================================================================
function buildFloorRailGeometry(doorZ, isMobile = false) {
  const parts = [];
  const arcMax = MAX_OPEN_ANGLE + 0.08;
  const arcSegs = isMobile ? 16 : 28;

  // Threshold wrought-iron base plate + beveled center flange across z = doorZ
  const sillPlate = placeGeo(new THREE.BoxGeometry(OPENING_HALF_W * 2 + 0.24, 0.026, 0.58), 0, 0.015, doorZ + 0.10);
  applyBoxProjectedUVs(sillPlate, 1.4);
  parts.push(sillPlate);

  for (const side of [-1, 1]) {
    const pivotX = side * OPENING_HALF_W;
    const sideSign = -side;

    // Main curved forged-iron sweep apron (y = 0.002..0.024, smooth 28-segment arc on PC)
    parts.push(
      createCurvedArcPlateGeo(
        pivotX, doorZ, sideSign,
        1.76, 3.22,
        0.002, 0.024,
        -0.03, arcMax,
        arcSegs, 2.2
      )
    );

    // Outer raised forged-iron friction guide rail + flanking channel lips (R ≈ 2.92..3.08)
    parts.push(
      createCurvedArcPlateGeo(
        pivotX, doorZ, sideSign,
        2.92, 3.07,
        0.022, 0.040,
        0.0, arcMax,
        arcSegs, 2.4
      )
    );
    if (!isMobile) {
      parts.push(
        createCurvedArcPlateGeo(
          pivotX, doorZ, sideSign,
          3.13, 3.20,
          0.022, 0.032,
          0.0, arcMax,
          arcSegs, 2.2
        )
      );
    }

    // Inner raised forged-iron stabilizer track bead (R ≈ 2.11..2.24)
    parts.push(
      createCurvedArcPlateGeo(
        pivotX, doorZ, sideSign,
        2.11, 2.24,
        0.022, 0.036,
        0.0, arcMax,
        arcSegs, 2.2
      )
    );

    // 3D forged countersunk anchor bolts fastening curved iron plates into corridor stone floor
    const boltCount = isMobile ? 6 : 9;
    for (let b = 0; b <= boltCount; b++) {
      const ang = (b / boltCount) * MAX_OPEN_ANGLE;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (const rBolt of [1.86, 2.56, 3.15]) {
        if (isMobile && rBolt === 2.56) continue;
        const bx = pivotX + sideSign * rBolt * ca;
        const bz = doorZ + rBolt * sa;
        const bolt = placeGeo(
          new THREE.CylinderGeometry(0.034, 0.044, 0.030, isMobile ? 6 : 8),
          bx, 0.030, bz, 0, ang, 0
        );
        applyBoxProjectedUVs(bolt, 0.8);
        parts.push(bolt);
      }
    }

    // Sculpted buttressed forged-iron floor door-stop anvil at a = 86° catching the open leaf
    const stopAng = MAX_OPEN_ANGLE + 0.06;
    const sx = pivotX + sideSign * 2.68 * Math.cos(stopAng);
    const sz = doorZ + 2.68 * Math.sin(stopAng);
    const stopYaw = -sideSign * stopAng;
    const stopBase = placeGeo(new THREE.BoxGeometry(0.52, 0.055, 0.28), sx, 0.038, sz, 0, stopYaw, 0);
    const stopLug = placeGeo(new THREE.BoxGeometry(0.30, 0.16, 0.17), sx, 0.12, sz, 0, stopYaw, 0);
    const stopGusset = placeGeo(new THREE.BoxGeometry(0.24, 0.12, 0.14), sx, 0.09, sz + 0.08, -0.45, stopYaw, 0);
    applyBoxProjectedUVs(stopBase, 1.0);
    applyBoxProjectedUVs(stopLug, 1.0);
    applyBoxProjectedUVs(stopGusset, 1.0);
    parts.push(stopBase, stopLug, stopGusset);
  }

  return mergeBucket(parts, 0);
}

// ============================================================================
// 3. Sculpted 3D-Coffered Gothic Oak Door Leaf Geometry (3D-филёнки + фаски!)
// ============================================================================
function buildDoorWoodGeometry(isMobile = false) {
  const parts = [];
  const rand = makeRng(0xD00A7711);

  // Solid recessed oak core so no unintended light leaks between beveled planks
  const core = createArchClippedSlab(0.08, LEAF_WIDTH - 0.04, 0.08, 0, 0.18, leafArchY, isMobile ? 7 : 12);
  applyWoodGrainUVs(core, false, 0.58, 0.34);
  parts.push(core);

  // Chamfered vertical hand-hewn cathedral oak planks (10 on PC, 8 on Mobile)
  const plankCount = isMobile ? 8 : 10;
  const innerStart = 0.24;
  const innerEnd = LEAF_WIDTH - 0.22;
  const span = innerEnd - innerStart;
  const gap = 0.011;
  const plankW = (span - gap * (plankCount - 1)) / plankCount;
  for (let i = 0; i < plankCount; i++) {
    const x0 = innerStart + i * (plankW + gap);
    const x1 = x0 + plankW;
    const zThick = 0.245 + (rand() - 0.5) * 0.016;
    const plank = createArchClippedSlab(
      x0, x1, 0.24, 0, zThick,
      (lx) => leafArchY(lx) - 0.16,
      isMobile ? 2 : 4,
      isMobile ? 0 : 0.12
    );
    applyWoodGrainUVs(plank, false, 0.62, 0.34);
    parts.push(plank);
  }

  // Stepped perimeter oak framing stiles (hinge stile + center meeting stile + chamfered inner fillets)
  const hingeStile = createArchClippedSlab(0.02, 0.26, 0.04, 0, 0.345, leafArchY, 3);
  applyWoodGrainUVs(hingeStile, false, 0.55, 0.32);
  parts.push(hingeStile);

  const centerStile = createArchClippedSlab(LEAF_WIDTH - 0.24, LEAF_WIDTH, 0.04, 0, 0.345, leafArchY, 3);
  applyWoodGrainUVs(centerStile, false, 0.55, 0.32);
  parts.push(centerStile);

  if (!isMobile) {
    const hingeFillet = createArchClippedSlab(0.24, 0.30, 0.20, 0, 0.305, (lx) => leafArchY(lx) - 0.12, 2);
    const centerFillet = createArchClippedSlab(LEAF_WIDTH - 0.30, LEAF_WIDTH - 0.22, 0.20, 0, 0.305, (lx) => leafArchY(lx) - 0.12, 2);
    applyWoodGrainUVs(hingeFillet, false, 0.55, 0.32);
    applyWoodGrainUVs(centerFillet, false, 0.55, 0.32);
    parts.push(hingeFillet, centerFillet);
  }

  // Proud horizontal oak cross-rails with stepped molding ledges
  const railSpecs = [
    { y: 0.18, h: 0.28 },
    { y: 1.02, h: 0.20 },
    { y: 2.68, h: 0.21 },
    { y: 4.24, h: 0.24 }
  ];
  for (const r of railSpecs) {
    const rail = placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.06, r.h, 0.345), LEAF_WIDTH * 0.5, r.y, 0);
    applyWoodGrainUVs(rail, true, 0.55, 0.34);
    parts.push(rail);
    if (!isMobile) {
      const fillet = placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.36, r.h + 0.06, 0.305), LEAF_WIDTH * 0.5, r.y, 0);
      applyWoodGrainUVs(fillet, true, 0.55, 0.34);
      parts.push(fillet);
    }
  }

  // Smooth curved gothic timber arch-head molding (14 segs on PC, 7 on Mobile)
  const archSegs = isMobile ? 7 : 14;
  for (let i = 0; i < archSegs; i++) {
    const lx0 = 0.06 + (i / archSegs) * (LEAF_WIDTH - 0.12);
    const lx1 = 0.06 + ((i + 1) / archSegs) * (LEAF_WIDTH - 0.12);
    const ly0 = leafArchY(lx0) - 0.11;
    const ly1 = leafArchY(lx1) - 0.11;
    const dx = lx1 - lx0;
    const dy = ly1 - ly0;
    const len = Math.hypot(dx, dy) + 0.05;
    const ang = Math.atan2(dy, dx);
    const seg = placeGeo(
      new THREE.BoxGeometry(len, 0.24, 0.35),
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

  // Sculpted gothic vertical mullion ribs dividing each leaf into 3 cathedral coffer bays!
  const mullions = [1.14, 2.04];
  for (const mx of mullions) {
    const rib = createArchClippedSlab(mx - 0.08, mx + 0.08, 0.26, 0, 0.335, (lx) => leafArchY(lx) - 0.18, 2);
    applyWoodGrainUVs(rib, false, 0.55, 0.34);
    parts.push(rib);
    if (!isMobile) {
      const sub = createArchClippedSlab(mx - 0.12, mx + 0.12, 0.26, 0, 0.298, (lx) => leafArchY(lx) - 0.18, 2);
      applyWoodGrainUVs(sub, false, 0.55, 0.34);
      parts.push(sub);
    }
  }

  // 3D Raised Beveled Coffers & Gothic Lancet Panels (3D-филёнки!) across all 3 bays on BOTH faces
  const bays = [
    { x0: 0.34, x1: 1.02 },
    { x0: 1.26, x1: 1.92 },
    { x0: 2.16, x1: 2.84 }
  ];
  for (const face of [-1, 1]) {
    const zPanelBase = face * 0.125;
    for (let bIdx = 0; bIdx < bays.length; bIdx++) {
      const bay = bays[bIdx];
      const bcx = (bay.x0 + bay.x1) * 0.5;
      const bw = bay.x1 - bay.x0;

      // Tier A (Lower plinth coffer: y = 0.37..0.87)
      const lowPanel = createBeveledFieldPanelGeo(bcx, 0.62, bw, 0.48, zPanelBase, face, 0.036, 0.055);
      applyWoodGrainUVs(lowPanel, false, 0.60, 0.34);
      parts.push(lowPanel);

      // Tier B (Eye-level heroic gothic lancet panel: y = 1.18..2.52)
      const midPanel = createBeveledFieldPanelGeo(bcx, 1.85, bw, 1.28, zPanelBase, face, 0.040, 0.065);
      applyWoodGrainUVs(midPanel, false, 0.60, 0.34);
      parts.push(midPanel);

      // Carved 3D pointed gothic lancet arch crown inside eye-level panel!
      if (!isMobile) {
        const lCrownL = placeGeo(
          new THREE.BoxGeometry(bw * 0.52, 0.055, 0.036),
          bcx - bw * 0.18, 2.34, face * 0.156, 0, 0, 0.52
        );
        const lCrownR = placeGeo(
          new THREE.BoxGeometry(bw * 0.52, 0.055, 0.036),
          bcx + bw * 0.18, 2.34, face * 0.156, 0, 0, -0.52
        );
        applyWoodGrainUVs(lCrownL, true, 0.55, 0.34);
        applyWoodGrainUVs(lCrownR, true, 0.55, 0.34);
        parts.push(lCrownL, lCrownR);
      }

      // Tier C (Upper soaring cathedral coffer: y = 2.86..4.06)
      const upPanel = createBeveledFieldPanelGeo(bcx, 3.46, bw, 1.16, zPanelBase, face, 0.040, 0.065);
      applyWoodGrainUVs(upPanel, false, 0.60, 0.34);
      parts.push(upPanel);

      // Carved Gothic timber quatrefoil / rose boss inside upper panel on PC
      if (!isMobile) {
        const roseRing = placeGeo(
          new THREE.TorusGeometry(bw * 0.26, 0.024, 6, 14),
          bcx, 3.68, face * 0.162
        );
        const roseDiamond = placeGeo(
          new THREE.BoxGeometry(bw * 0.24, bw * 0.24, 0.034),
          bcx, 3.68, face * 0.160, 0, 0, Math.PI * 0.25
        );
        applyWoodGrainUVs(roseRing, false, 0.55, 0.34);
        applyWoodGrainUVs(roseDiamond, false, 0.55, 0.34);
        parts.push(roseRing, roseDiamond);
      }

      // Tier D (Pointed arch tympanum coffer above y = 4.42 where arch rises high near center!)
      const archTopAtBay = leafArchY(bcx) - 0.30;
      if (archTopAtBay > 4.68) {
        const th = archTopAtBay - 4.44;
        const tympPanel = createBeveledFieldPanelGeo(
          bcx, 4.44 + th * 0.5, bw * 0.92, th, zPanelBase, face, 0.036, 0.055
        );
        applyWoodGrainUVs(tympPanel, false, 0.60, 0.34);
        parts.push(tympPanel);
      }
    }
  }

  return mergeBucket(parts, 0);
}

// ============================================================================
// 4. High-Poly Forged Iron Hardware (Domed 3D Rivets, Multi-Scroll Straps,
//    Collared Massive Pull-Rings — uniform UVs for PMREM + pbr.ironNormal)
// ============================================================================
function buildDoorIronGeometry(isMobile = false) {
  const parts = [];
  const cylSegs = isMobile ? 10 : 18;

  // 4 Heavy cylindrical forged pintle hinge barrels with triple collar rings & gothic finials
  for (const hy of [0.62, 1.85, 3.12, 4.28]) {
    parts.push(placeGeo(new THREE.CylinderGeometry(0.112, 0.112, 0.46, cylSegs), 0.04, hy, 0));
    parts.push(placeGeo(new THREE.CylinderGeometry(0.138, 0.138, 0.075, cylSegs), 0.04, hy + 0.25, 0));
    parts.push(placeGeo(new THREE.CylinderGeometry(0.138, 0.138, 0.075, cylSegs), 0.04, hy - 0.25, 0));
    if (!isMobile) {
      parts.push(placeGeo(new THREE.CylinderGeometry(0.132, 0.132, 0.055, cylSegs), 0.04, hy, 0));
    }
    parts.push(placeGeo(new THREE.ConeGeometry(0.088, 0.19, cylSegs), 0.04, hy + 0.38, 0));
    parts.push(placeGeo(new THREE.ConeGeometry(0.088, 0.19, cylSegs), 0.04, hy - 0.38, 0, Math.PI, 0, 0));
  }

  // Heavy forged-iron bottom scraping skid-shoe + dual protruding guide runners over floor rails
  parts.push(placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.04, 0.088, 0.378), LEAF_WIDTH * 0.5, 0.068, 0));
  parts.push(placeGeo(new THREE.BoxGeometry(0.24, 0.050, 0.395), 2.18, 0.046, 0));
  parts.push(placeGeo(new THREE.BoxGeometry(0.26, 0.050, 0.395), 2.99, 0.046, 0));

  // Center meeting edge vertical iron astragal armor band with beveled spine
  parts.push(createArchClippedSlab(LEAF_WIDTH - 0.065, LEAF_WIDTH + 0.008, 0.04, 0, 0.368, leafArchY, 3));

  // Smooth curved iron top rim-binding along the pointed arch contour (14 segs on PC)
  const rimSegs = isMobile ? 6 : 14;
  for (let i = 0; i < rimSegs; i++) {
    const lx0 = 0.06 + (i / rimSegs) * (LEAF_WIDTH - 0.10);
    const lx1 = 0.06 + ((i + 1) / rimSegs) * (LEAF_WIDTH - 0.10);
    const ly0 = leafArchY(lx0) - 0.02;
    const ly1 = leafArchY(lx1) - 0.02;
    const dx = lx1 - lx0;
    const dy = ly1 - ly0;
    const len = Math.hypot(dx, dy) + 0.04;
    const ang = Math.atan2(dy, dx);
    parts.push(
      placeGeo(new THREE.BoxGeometry(len, 0.092, 0.376), (lx0 + lx1) * 0.5, (ly0 + ly1) * 0.5, 0, 0, 0, ang)
    );
  }

  // Symmetric wrought-iron straps, scrollwork, domed 3D rivets, pull-rings & keeper brackets on BOTH faces
  for (const face of [-1, 1]) {
    const strapZ = face * 0.192;
    const rivetSurfaceZ = face * 0.214;

    const bandSpecs = [
      { y: 1.02, len: 2.86, h: 0.225 },
      { y: 2.68, len: 2.74, h: 0.215 },
      { y: 4.24, len: 2.86, h: 0.225 }
    ];
    for (const b of bandSpecs) {
      // Stepped double-profile forged strap bar + chamfered raised central spine
      parts.push(placeGeo(new THREE.BoxGeometry(b.len, b.h, 0.044), 0.08 + b.len * 0.5, b.y, strapZ));
      parts.push(placeGeo(new THREE.BoxGeometry(b.len - 0.10, b.h * 0.42, 0.026), 0.08 + b.len * 0.5, b.y, face * 0.216));

      // Curved multi-segment gothic C-scroll volutes branching symmetrically from hinge & mid-leaf
      for (const vy of [-1, 1]) {
        parts.push(
          placeGeo(new THREE.BoxGeometry(0.46, 0.068, 0.038), 0.42, b.y + vy * 0.21, strapZ, 0, 0, vy * 0.50)
        );
        if (!isMobile) {
          parts.push(
            placeGeo(
              new THREE.TorusGeometry(0.14, 0.026, 6, 12, Math.PI * 1.35),
              0.68, b.y + vy * 0.28, strapZ, 0, 0, vy > 0 ? -0.35 : Math.PI + 0.35
            )
          );
          parts.push(
            placeGeo(
              new THREE.TorusGeometry(0.11, 0.022, 6, 10, Math.PI * 1.25),
              1.60, b.y + vy * 0.22, strapZ, 0, 0, vy > 0 ? -0.4 : Math.PI + 0.4
            )
          );
        }
        appendForgedRivet(parts, 0.68, b.y + vy * 0.28, rivetSurfaceZ, face, 0.036, isMobile);
      }

      // Sculpted Gothic 3-petal Fleur-de-Lis spearhead finial at strap tip
      const tipX = 0.08 + b.len;
      parts.push(placeGeo(new THREE.BoxGeometry(0.25, 0.25, 0.050), tipX, b.y, strapZ, 0, 0, Math.PI * 0.25));
      parts.push(placeGeo(new THREE.BoxGeometry(0.22, 0.074, 0.044), tipX - 0.22, b.y + 0.155, strapZ, 0, 0, 0.58));
      parts.push(placeGeo(new THREE.BoxGeometry(0.22, 0.074, 0.044), tipX - 0.22, b.y - 0.155, strapZ, 0, 0, -0.58));
      appendForgedRivet(parts, tipX, b.y, rivetSurfaceZ + face * 0.004, face, 0.036, isMobile);

      // 9 crisp 3D forged washer+dome rivets along each strap
      const strapRivets = isMobile ? 7 : 9;
      for (let r = 0; r < strapRivets; r++) {
        const rx = 0.24 + r * ((b.len - 0.34) / (strapRivets - 1));
        appendForgedRivet(parts, rx, b.y + 0.062, rivetSurfaceZ, face, 0.030, isMobile);
        appendForgedRivet(parts, rx, b.y - 0.062, rivetSurfaceZ, face, 0.030, isMobile);
      }
    }

    // Bottom iron kick-plate reinforcement + double row of forged rivets
    parts.push(placeGeo(new THREE.BoxGeometry(LEAF_WIDTH - 0.10, 0.18, 0.040), LEAF_WIDTH * 0.5, 0.145, strapZ));
    for (let r = 0; r < 7; r++) {
      appendForgedRivet(parts, 0.30 + r * 0.42, 0.15, rivetSurfaceZ, face, 0.034, isMobile);
    }

    // Vertical hinge-stile & center-stile forged rivet studs + upper arch rim rivets
    const vertRivetCount = isMobile ? 5 : 9;
    for (let v = 0; v < vertRivetCount; v++) {
      const vy = 0.48 + v * 0.44;
      appendForgedRivet(parts, 0.14, vy, face * 0.175, face, 0.032, isMobile);
      appendForgedRivet(parts, LEAF_WIDTH - 0.12, vy, face * 0.175, face, 0.032, isMobile);
    }
    const archRivetCount = isMobile ? 5 : 8;
    for (let k = 0; k < archRivetCount; k++) {
      const rx = 0.36 + k * 0.37;
      const ry = leafArchY(rx) - 0.12;
      appendForgedRivet(parts, rx, ry, face * 0.178, face, 0.035, isMobile);
    }

    // Monumental Sculpted Forged Iron Pull-Ring Handle (массивные кольца-ручки!)
    const ringX = 2.46;
    const ringY = 1.98;
    // Multi-tiered octagonal + gothic quatrefoil rosette escutcheon backplate
    parts.push(
      placeGeo(
        new THREE.CylinderGeometry(0.35, 0.37, 0.056, isMobile ? 8 : 16),
        ringX, ringY, strapZ, Math.PI * 0.5, 0, Math.PI / 8
      )
    );
    parts.push(
      placeGeo(new THREE.BoxGeometry(0.45, 0.45, 0.048), ringX, ringY, face * 0.208, 0, 0, Math.PI * 0.25)
    );
    if (!isMobile) {
      // Raised forged outer rim ring around escutcheon
      parts.push(
        placeGeo(new THREE.TorusGeometry(0.33, 0.022, 8, 20), ringX, ringY, face * 0.214)
      );
    }
    const escRivets = isMobile ? 4 : 8;
    for (let c = 0; c < escRivets; c++) {
      const a = (c / escRivets) * Math.PI * 2 + Math.PI / escRivets;
      appendForgedRivet(
        parts,
        ringX + Math.cos(a) * 0.265,
        ringY + Math.sin(a) * 0.265,
        face * 0.220,
        face,
        0.028,
        isMobile
      );
    }
    // High-relief sculpted domed boss & heavy U-shackle eye loop
    parts.push(
      placeGeo(
        new THREE.SphereGeometry(0.125, isMobile ? 8 : 14, isMobile ? 5 : 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        ringX, ringY + 0.04, face * 0.218,
        face > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0, 0
      )
    );
    parts.push(
      placeGeo(
        new THREE.TorusGeometry(0.082, 0.028, isMobile ? 6 : 10, isMobile ? 10 : 16),
        ringX, ringY + 0.02, face * 0.285,
        0, Math.PI * 0.5, 0
      )
    );
    // Massive high-poly wrought-iron pull-ring + 3 forged grip collars
    const ringCenterY = ringY - 0.22;
    const ringCenterZ = face * 0.295;
    const ringTiltX = face * 0.20;
    parts.push(
      placeGeo(
        new THREE.TorusGeometry(0.285, 0.052, isMobile ? 8 : 16, isMobile ? 18 : 36),
        ringX, ringCenterY, ringCenterZ,
        ringTiltX, 0, 0
      )
    );
    if (!isMobile) {
      // Bottom forged grip-boss & flanking decorative ring collars on the heavy torus
      parts.push(
        placeGeo(
          new THREE.CylinderGeometry(0.068, 0.068, 0.11, 12),
          ringX,
          ringCenterY - Math.cos(ringTiltX) * 0.285,
          ringCenterZ - Math.sin(ringTiltX) * 0.285,
          0, 0, Math.PI * 0.5
        )
      );
      for (const sgn of [-1, 1]) {
        parts.push(
          placeGeo(
            new THREE.CylinderGeometry(0.064, 0.064, 0.08, 12),
            ringX + sgn * 0.285,
            ringCenterY,
            ringCenterZ,
            ringTiltX, 0, 0
          )
        );
      }
    }

    // Heavy U-shaped Iron Bolt Keeper Brackets
    for (const bx of [0.68, 2.15]) {
      parts.push(placeGeo(new THREE.BoxGeometry(0.29, 0.48, 0.050), bx, BOLT_Y_LOCKED - 0.02, strapZ));
      appendForgedRivet(parts, bx, BOLT_Y_LOCKED + 0.17, rivetSurfaceZ, face, 0.032, isMobile);
      appendForgedRivet(parts, bx, BOLT_Y_LOCKED - 0.21, rivetSurfaceZ, face, 0.032, isMobile);
      parts.push(placeGeo(new THREE.BoxGeometry(0.22, 0.080, 0.188), bx, BOLT_Y_LOCKED - 0.145, face * 0.268));
      parts.push(placeGeo(new THREE.BoxGeometry(0.22, 0.225, 0.066), bx, BOLT_Y_LOCKED - 0.055, face * 0.338));
    }
  }

  return mergeBucket(parts, 1.10);
}

// ============================================================================
// 5. Animated Heavy Iron Crossbar Lock-Bar Geometry (High-Poly Rivets & Handle)
// ============================================================================
function buildLockBarGeometry(isMobile = false) {
  const parts = [];
  const barLen = 3.04;

  parts.push(new THREE.BoxGeometry(barLen, 0.20, 0.102));
  parts.push(placeGeo(new THREE.BoxGeometry(barLen - 0.10, 0.040, 0.120), 0, 0.098, 0));
  parts.push(placeGeo(new THREE.BoxGeometry(barLen - 0.10, 0.040, 0.120), 0, -0.098, 0));

  for (const side of [-1, 1]) {
    parts.push(placeGeo(new THREE.BoxGeometry(0.16, 0.28, 0.146), side * (barLen * 0.5 - 0.04), 0, 0));
    parts.push(placeGeo(new THREE.BoxGeometry(0.13, 0.25, 0.132), side * 0.92, 0, 0));
    if (!isMobile) {
      parts.push(
        placeGeo(
          new THREE.TorusGeometry(0.085, 0.024, 8, 16),
          side * (barLen * 0.5 + 0.04), 0, 0.01
        )
      );
    }
  }

  parts.push(placeGeo(new THREE.BoxGeometry(0.40, 0.33, 0.146), 0, 0, 0.01));
  parts.push(placeGeo(new THREE.BoxGeometry(0.27, 0.27, 0.060), 0, 0, 0.080, 0, 0, Math.PI * 0.25));
  parts.push(placeGeo(new THREE.BoxGeometry(0.060, 0.060, 0.12), -0.12, -0.02, 0.11));
  parts.push(placeGeo(new THREE.BoxGeometry(0.060, 0.060, 0.12), 0.12, -0.02, 0.11));
  parts.push(placeGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.30, isMobile ? 6 : 12), 0, -0.02, 0.155, 0, 0, Math.PI * 0.5));

  for (const rx of [-1.26, -0.88, -0.54, -0.30, 0.30, 0.54, 0.88, 1.26]) {
    appendForgedRivet(parts, rx, 0, 0.056, 1, 0.034, isMobile);
  }

  return mergeBucket(parts, 1.10);
}

// ============================================================================
// 6. Unified Stone Dust + Velocity-Streaked Blackbody-Cooling Sparks (1 DC!)
//    aKind = 0 -> billowing warm-gray limestone dust clouds
//    aKind = 1 -> physically cooling velocity-streaked friction sparks
//                 (3200K white-lemon -> 2200K gold -> 1400K cherry-orange -> 800K ember slag)
// ============================================================================
function createDoorVfxSystem(doorZ, isMobile, trackGeo, trackMat) {
  const count = isMobile ? 160 : 320;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const kinds = new Float32Array(count);
  const heats = new Float32Array(count);

  const age = new Float32Array(count);
  const life = new Float32Array(count);
  const baseSize = new Float32Array(count);
  const peakAlpha = new Float32Array(count);
  const seedPhase = new Float32Array(count);

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
  const velAttr = new THREE.BufferAttribute(velocities, 3);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1);
  const kindAttr = new THREE.BufferAttribute(kinds, 1);
  const heatAttr = new THREE.BufferAttribute(heats, 1);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  velAttr.setUsage(THREE.DynamicDrawUsage);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);
  kindAttr.setUsage(THREE.DynamicDrawUsage);
  heatAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aVel', velAttr);
  geo.setAttribute('aSize', sizeAttr);
  geo.setAttribute('aAlpha', alphaAttr);
  geo.setAttribute('aKind', kindAttr);
  geo.setAttribute('aHeat', heatAttr);

  const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const mat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uDustColor: { value: new THREE.Color(0xc2bbb0) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: `
      attribute vec3 aVel;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aKind;
      attribute float aHeat;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vKind;
      varying float vHeat;
      varying vec2 vSparkDir;
      varying float vStretch;
      void main() {
        vAlpha = aAlpha;
        vKind = aKind;
        vHeat = aHeat;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vec4 clipPos = projectionMatrix * mvPos;

        vec2 dir2d = vec2(0.0, 1.0);
        float stretch = 1.0;
        if (aKind > 0.5) {
          vec3 mvVel = mat3(modelViewMatrix) * aVel;
          float spd = length(mvVel);
          vec2 projVel = vec2(mvVel.x, -mvVel.y);
          float pLen = length(projVel);
          if (pLen > 0.001) {
            dir2d = projVel / pLen;
          }
          stretch = clamp(1.0 + spd * 0.58, 1.15, 3.8);
        }
        vSparkDir = dir2d;
        vStretch = stretch;

        float maxPt = aKind > 0.5 ? 34.0 : 48.0;
        gl_PointSize = clamp((aSize * stretch * uPixelRatio * 240.0) / max(1.0, -mvPos.z), 1.5, maxPt);
        gl_Position = clipPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uDustColor;
      varying float vAlpha;
      varying float vKind;
      varying float vHeat;
      varying vec2 vSparkDir;
      varying float vStretch;
      void main() {
        if (vAlpha <= 0.005) discard;
        vec2 c = gl_PointCoord - vec2(0.5);

        if (vKind > 0.5) {
          // Velocity-aligned motion-blurred spark capsule with hot leading head & cooling tail!
          vec2 perp = vec2(-vSparkDir.y, vSparkDir.x);
          float along = dot(c, vSparkDir);
          float across = dot(c, perp) * vStretch * 1.65;
          // Slight taper toward cooling trailing tail (along < 0)
          float tailFactor = clamp(along * 2.0 + 0.5, 0.0, 1.0);
          float dCap = sqrt(along * along * 1.12 + across * across);
          if (dCap > 0.5) discard;

          float core = smoothstep(0.20, 0.0, dCap) * (0.55 + 0.45 * tailFactor);
          float glow = smoothstep(0.50, 0.04, dCap);

          // Physical blackbody cooling ramp: dark slag -> cherry red -> amber orange -> gold -> white-hot
          float h = clamp(vHeat * (0.72 + 0.28 * tailFactor), 0.0, 1.0);
          vec3 darkSlag = vec3(0.42, 0.05, 0.01);
          vec3 cherryRed = vec3(0.92, 0.18, 0.02);
          vec3 moltenOrange = vec3(1.0, 0.52, 0.09);
          vec3 goldHot = vec3(1.0, 0.82, 0.36);
          vec3 whiteHot = vec3(1.0, 0.98, 0.88);

          vec3 sparkCol = mix(darkSlag, cherryRed, smoothstep(0.0, 0.26, h));
          sparkCol = mix(sparkCol, moltenOrange, smoothstep(0.22, 0.56, h));
          sparkCol = mix(sparkCol, goldHot, smoothstep(0.52, 0.84, h));
          sparkCol = mix(sparkCol, whiteHot, clamp(core * smoothstep(0.62, 1.0, h), 0.0, 1.0));

          float lumBoost = 0.85 + 0.95 * h + 0.55 * core * h;
          float alpha = clamp((core * 0.96 + glow * glow * 0.62) * vAlpha, 0.0, 1.0);
          gl_FragColor = vec4(sparkCol * lumBoost, alpha);
        } else {
          float d = length(c);
          if (d > 0.5) discard;
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

  function acquireSlot() {
    for (let step = 0; step < count; step++) {
      const idx = (cursor + step) % count;
      if (age[idx] >= life[idx]) {
        cursor = (idx + 1) % count;
        return idx;
      }
    }
    const idx = cursor;
    cursor = (cursor + 1) % count;
    return idx;
  }

  function spawnParticle(x, y, z, vx, vy, vz, pSize, pLife, pAlpha, kind = 0, initHeat = 1.0) {
    const i = acquireSlot();
    const i3 = i * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    velocities[i3] = vx;
    velocities[i3 + 1] = vy;
    velocities[i3 + 2] = vz;
    age[i] = 0;
    life[i] = pLife;
    baseSize[i] = pSize;
    peakAlpha[i] = pAlpha;
    kinds[i] = kind;
    seedPhase[i] = rand() * Math.PI * 2;
    heats[i] = kind > 0.5 ? initHeat : 0.0;
    sizes[i] = kind > 0.5 ? pSize : pSize * 0.6;
    alphas[i] = kind > 0.5 ? pAlpha : pAlpha * 0.4;
    if (kind > 0.5) totalSparksSpawned++;
    activeCount = count;
    points.visible = true;
  }

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
        0,
        0
      );
    }
  }

  // Physically cooling metal-on-metal scrape sparks + rolling floor dust under BOTH sweeping shoes
  function emitRailScrapeSparksAndDust(angleRad, intensity = 1.0, closing = false, pullDir = 1) {
    const clampedInt = clamp01(intensity);
    if (clampedInt <= 0.01) return;

    const ca = Math.cos(angleRad);
    const sa = Math.sin(angleRad);
    const zDir = pullDir >= 0 ? 1 : -1;
    const sparkCount = Math.max(2, Math.round((isMobile ? 4 : 8) * clampedInt));
    const railDustCount = Math.max(1, Math.round((isMobile ? 2 : 4) * clampedInt));

    for (let k = 0; k < sparkCount; k++) {
      const side = (k % 2 === 0) ? -1 : 1;
      const pivotX = side * OPENING_HALF_W;
      const sideSign = -side;
      const r = rand() < 0.68
        ? (2.82 + rand() * 0.30)
        : (2.02 + rand() * 0.32);

      const wx = pivotX + sideSign * r * ca;
      const wz = doorZ + zDir * r * sa;

      const moveSign = closing ? -1 : 1;
      const tanX = -sideSign * sa * moveSign;
      const tanZ = zDir * ca * moveSign;
      const radX = sideSign * ca;
      const radZ = zDir * sa;

      const speed = (2.4 + rand() * 3.8) * (0.65 + 0.45 * clampedInt);
      const vx = (-tanX * 0.88 + radX * (0.25 + rand() * 0.45)) * speed + (rand() - 0.5) * 1.35;
      const vz = (-tanZ * 0.88 + radZ * (0.25 + rand() * 0.45)) * speed + (rand() - 0.5) * 1.05;
      const vy = (0.70 + rand() * 2.15) * (0.7 + 0.4 * clampedInt);

      // Vary initial temperature slightly: fine sparks start white-hot (1.0), heavier slag starts orange-gold (0.82)
      const isHeavySlag = rand() < 0.28;
      spawnParticle(
        wx + (rand() - 0.5) * 0.07,
        0.044 + rand() * 0.035,
        wz + (rand() - 0.5) * 0.07,
        vx, vy, vz,
        isHeavySlag ? (0.095 + rand() * 0.075) : (0.062 + rand() * 0.065),
        isHeavySlag ? (0.48 + rand() * 0.48) : (0.24 + rand() * 0.36),
        0.90 + rand() * 0.10,
        1,
        isHeavySlag ? (0.80 + rand() * 0.14) : (0.94 + rand() * 0.06)
      );
    }

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
        0,
        0
      );
    }
  }

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
        0,
        0
      );
    }
  }

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
        0,
        0
      );
    }
  }

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
        0,
        0
      );
    }
  }

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
        0,
        0
      );
    }
    const impactSparks = isMobile ? 14 : 26;
    for (let s = 0; s < impactSparks; s++) {
      const alongFloor = rand() < 0.65;
      const sx = alongFloor ? (rand() - 0.5) * 5.6 : (rand() - 0.5) * 0.25;
      const sy = alongFloor ? 0.055 : (1.2 + rand() * 2.2);
      const sz = doorZ + (rand() - 0.5) * 0.35;
      spawnParticle(
        sx, sy, sz,
        (rand() - 0.5) * 4.4,
        1.1 + rand() * 2.8,
        (0.8 + rand() * 2.8) * (rand() < 0.5 ? 1 : -1),
        0.07 + rand() * 0.08,
        0.30 + rand() * 0.45,
        0.96,
        1,
        0.92 + rand() * 0.08
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
    const sparkDrag = Math.exp(-1.35 * dt);

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
        // Ballistic incandescent sparks with realistic air drag, floor bounce & conductive cooling!
        let vx = velocities[i3] * sparkDrag;
        let vy = velocities[i3 + 1] - 9.2 * dt;
        let vz = velocities[i3 + 2] * sparkDrag;

        let ny = positions[i3 + 1] + vy * dt;
        let bounceCool = 1.0;
        if (ny < 0.038) {
          ny = 0.038;
          if (vy < -0.45) {
            vy = -vy * 0.44;
            vx *= 0.76;
            vz *= 0.76;
            bounceCool = 0.88; // Heat transfer into cold stone/iron floor on impact
          } else {
            vy = 0;
            vx *= 0.62;
            vz *= 0.62;
          }
        }
        velocities[i3] = vx;
        velocities[i3 + 1] = vy;
        velocities[i3 + 2] = vz;

        positions[i3] += vx * dt;
        positions[i3 + 1] = ny;
        positions[i3 + 2] += vz * dt;

        // Stefan-Boltzmann radiative + convective cooling (rapid initial drop from white-hot -> lingering red ember)
        const invT = 1.0 - t;
        const sputter = t > 0.68 ? (0.82 + 0.18 * Math.sin(nextAge * 62.0 + seedPhase[i])) : 1.0;
        heats[i] = Math.min(heats[i], Math.pow(invT, 1.45)) * bounceCool;
        alphas[i] = peakAlpha[i] * Math.pow(invT, 0.62) * sputter;
        sizes[i] = baseSize[i] * (0.42 + 0.68 * invT);
      } else {
        let vx = velocities[i3] * dustDrag;
        let vy = velocities[i3 + 1] * Math.exp(-0.75 * dt) - 2.35 * dt;
        let vz = velocities[i3 + 2] * dustDrag;

        let ny = positions[i3 + 1] + vy * dt;
        if (ny < 0.05) {
          ny = 0.05;
          vy = 0;
          vx *= 0.82;
          vz *= 0.82;
        }
        velocities[i3] = vx;
        velocities[i3 + 1] = vy;
        velocities[i3 + 2] = vz;

        positions[i3] += vx * dt;
        positions[i3 + 1] = ny;
        positions[i3 + 2] += vz * dt;

        const fadeIn = Math.min(1.0, t / 0.14);
        const fadeOut = 1.0 - t;
        heats[i] = 0;
        alphas[i] = peakAlpha[i] * fadeIn * fadeOut * fadeOut;
        sizes[i] = baseSize[i] * (0.75 + t * 0.95);
      }
    }

    posAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
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

  const castShadowPC = !isMobile;

  // Matte weathered masonry materials for portal jambs & architrave (zero glossy plastic specular)
  let portalDarkMat;
  if (darkStoneMat && typeof darkStoneMat.clone === 'function') {
    portalDarkMat = regMat(darkStoneMat.clone());
    portalDarkMat.roughness = Math.max(portalDarkMat.roughness ?? 0.95, 0.95);
    portalDarkMat.metalness = Math.min(portalDarkMat.metalness ?? 0.04, 0.04);
    portalDarkMat.envMapIntensity = 0.36;
    if (portalDarkMat.normalScale) {
      portalDarkMat.normalScale.set(
        Math.min(portalDarkMat.normalScale.x, 0.88),
        Math.min(portalDarkMat.normalScale.y, 0.88)
      );
    }
  } else {
    portalDarkMat = darkStoneMat || regMat(new THREE.MeshStandardMaterial({
      map: pbr?.ashlarAlbedo || null,
      normalMap: pbr?.ashlarNormal || null,
      normalScale: new THREE.Vector2(0.88, 0.88),
      roughnessMap: pbr?.ashlarRoughness || null,
      color: 0x6c7488,
      roughness: 0.95,
      metalness: 0.04,
      envMapIntensity: 0.36
    }));
  }

  let portalTrimMat;
  if (trimStoneMat && typeof trimStoneMat.clone === 'function') {
    portalTrimMat = regMat(trimStoneMat.clone());
    portalTrimMat.roughness = Math.max(portalTrimMat.roughness ?? 0.92, 0.92);
    portalTrimMat.metalness = Math.min(portalTrimMat.metalness ?? 0.05, 0.05);
    portalTrimMat.envMapIntensity = 0.36;
    if (portalTrimMat.normalScale) {
      portalTrimMat.normalScale.set(
        Math.min(portalTrimMat.normalScale.x, 0.85),
        Math.min(portalTrimMat.normalScale.y, 0.85)
      );
    }
  } else {
    portalTrimMat = trimStoneMat || regMat(new THREE.MeshStandardMaterial({
      map: pbr?.ashlarAlbedo || null,
      normalMap: pbr?.ashlarNormal || null,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: pbr?.ashlarRoughness || null,
      color: 0x9098ae,
      roughness: 0.92,
      metalness: 0.05,
      envMapIntensity: 0.36
    }));
  }

  // Scratched, hammered, soot-dulled medieval wrought-iron PBR material for hinges, straps,
  // domed rivets, pull-rings & crossbar: matte-satin roughness + micro-scratches kill glassy
  // split-obsidian firelight glare while keeping authentic forged-iron relief!
  const ironAlbedoTex = regTex(createWroughtIronAlbedoTexture(isMobile));
  const ironNormTex = pbr?.ironNormal || ironMat?.normalMap || null;
  const ironRoughTex = pbr?.ironRoughness || ironMat?.roughnessMap || null;
  const resolvedIronMat = regMat(new THREE.MeshStandardMaterial({
    map: ironAlbedoTex,
    color: new THREE.Color(0xc8cedb),
    normalMap: ironNormTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: ironRoughTex,
    roughness: ironRoughTex ? 0.90 : 0.78,
    metalness: 0.56,
    envMapIntensity: 0.45
  }));

  // Curved forged-iron floor rail PBR material: matte oxidized iron plate + worn scratched steel tracks
  const railTex = createFloorRailTextures(isMobile);
  regTex(railTex.map);
  regTex(railTex.roughnessMap);
  const floorRailMat = regMat(new THREE.MeshStandardMaterial({
    map: railTex.map,
    normalMap: ironNormTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: railTex.roughnessMap,
    color: 0xd0d6e2,
    roughness: 0.94,
    metalness: 0.58,
    envMapIntensity: 0.45
  }));

  // Procedural Dark Cathedral Oak PBR material (1024px PC wood-grain albedo + bumpMap + roughnessMap)
  const woodTex = createDarkOakWoodTextures(isMobile);
  regTex(woodTex.map);
  regTex(woodTex.bumpMap);
  regTex(woodTex.roughnessMap);

  const oakWoodMat = regMat(new THREE.MeshStandardMaterial({
    map: woodTex.map,
    bumpMap: woodTex.bumpMap,
    bumpScale: 0.115,
    roughnessMap: woodTex.roughnessMap,
    color: 0xdac9bb,
    roughness: 0.94,
    metalness: 0.03,
    envMapIntensity: 0.45
  }));

  const group = new THREE.Group();
  group.name = 'SoulsCastleDoors';

  // --- DC 1 & DC 2: Monumental Pointed Gothic Stone Portal ---
  const { portalDarkGeo, portalTrimGeo } = buildPortalGeometries(z, isMobile);
  const portalDarkMesh = new THREE.Mesh(regGeo(portalDarkGeo), portalDarkMat);
  portalDarkMesh.castShadow = castShadowPC;
  portalDarkMesh.receiveShadow = true;
  portalDarkMesh.name = 'CastlePortalDarkStone';
  group.add(portalDarkMesh);

  const portalTrimMesh = new THREE.Mesh(regGeo(portalTrimGeo), portalTrimMat);
  portalTrimMesh.castShadow = castShadowPC;
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

  // --- DC 3: Twin Sculpted 3D-Coffered Dark Oak Door Leaves (1 InstancedMesh = 1 DC!) ---
  const doorWoodGeo = regGeo(buildDoorWoodGeometry(isMobile));
  const doorWoodInst = new THREE.InstancedMesh(doorWoodGeo, oakWoodMat, 2);
  doorWoodInst.name = 'CastleDoorWoodLeaves';
  doorWoodInst.castShadow = castShadowPC;
  doorWoodInst.receiveShadow = true;
  doorWoodInst.frustumCulled = false;
  group.add(doorWoodInst);

  // --- DC 4: Twin High-Poly Forged Iron Straps, Domed Rivets & Massive Pull-Rings (1 DC!) ---
  const doorIronGeo = regGeo(buildDoorIronGeometry(isMobile));
  const doorIronInst = new THREE.InstancedMesh(doorIronGeo, resolvedIronMat, 2);
  doorIronInst.name = 'CastleDoorIronHardware';
  doorIronInst.castShadow = false;
  doorIronInst.receiveShadow = true;
  doorIronInst.frustumCulled = false;
  group.add(doorIronInst);

  // --- DC 5: Animated Heavy Wrought-Iron Crossbar Lock-Bar (child of leftPivot) ---
  const lockBarGeo = regGeo(buildLockBarGeometry(isMobile));
  const lockBarMesh = new THREE.Mesh(lockBarGeo, resolvedIronMat);
  lockBarMesh.name = 'CastleDoorLockBar';
  lockBarMesh.castShadow = castShadowPC;
  lockBarMesh.receiveShadow = true;
  lockBarMesh.position.set(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z);
  leftPivot.add(lockBarMesh);

  // --- DC 6: High-Segment Curved Forged Iron Floor Rails & Buttressed Door-Stops ---
  const floorRailGeo = regGeo(buildFloorRailGeometry(z, isMobile));
  const floorRailMesh = new THREE.Mesh(floorRailGeo, floorRailMat);
  floorRailMesh.name = 'CastleDoorIronFloorRails';
  floorRailMesh.castShadow = false;
  floorRailMesh.receiveShadow = true;
  group.add(floorRailMesh);

  // --- DC 7 (0 DC at rest!): Unified Stone Dust + Velocity-Streaked Cooling Sparks ---
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

  function syncLeafAngles(
    openAngleL,
    openAngleR,
    leftDx = 0,
    leftDz = 0,
    rightDx = 0,
    rightDz = 0,
    pullDir = currentPullDir
  ) {
    const dirSign = pullDir >= 0 ? -1 : 1;
    leftPivot.position.set(-OPENING_HALF_W + leftDx, 0, z + leftDz);
    leftPivot.rotation.set(0, dirSign * openAngleL, 0);
    leftPivot.updateMatrix();

    rightPivot.position.set(OPENING_HALF_W + rightDx, 0, z + rightDz);
    rightPivot.rotation.set(0, -dirSign * openAngleR, 0);
    rightPivot.updateMatrix();

    doorWoodInst.setMatrixAt(0, leftPivot.matrix);
    doorIronInst.setMatrixAt(0, leftPivot.matrix);

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
  // Public Control API (Standalone + Cutscene Synchronization)
  // ==========================================================================
  function openDoors() {
    if (state === 'opening' || state === 'open') return false;
    const prevAngle = currentAngle;
    cutsceneDriven = false;
    vfxSteppedByCutscene = false;
    lastCutsceneDustStage = 0;
    lastCutsceneAngle = 0;
    cutsceneSlamBurstFired = false;
    sealAnimActive = false;
    sealAnimTime = 0;
    sealStartAngle = 0;
    sealImpactTriggered = false;
    currentPullDir = 1;
    state = 'opening';
    dustEmitAccum = 0;
    sparkEmitAccum = 0;
    group.visible = true;

    if (prevAngle > 0.02) {
      // Mid-seal reopen: resume smoothly from currentAngle without snapping back to 0
      const targetFrac = clamp01(prevAngle / MAX_OPEN_ANGLE);
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 10; it++) {
        const mid = (lo + hi) * 0.5;
        if (easeHeavyDoorOpen(mid) < targetFrac) lo = mid;
        else hi = mid;
      }
      openAnimTime = OPEN_SHUDDER_DURATION + ((lo + hi) * 0.5) * (OPEN_TOTAL_DURATION - OPEN_SHUDDER_DURATION);
      applyBoltTransform(BOLT_LOCAL_X_STOWED, BOLT_Y_STOWED, BOLT_LOCAL_Z, 0, 0);
      doorShudderIntensity = 0.25;
      scrapeSparkIntensity = 0.35;
    } else {
      // Clean unlock & outward swing from closed or sealed state
      currentAngle = 0;
      openAnimTime = 0;
      applyBoltTransform(BOLT_LOCAL_X_LOCKED, BOLT_Y_LOCKED, BOLT_LOCAL_Z, 0, 0);
      syncLeafAngles(0, 0, 0, 0, 0, 0, 1);
      doorShudderIntensity = 0.85;
      scrapeSparkIntensity = 0.25;
      vfxSystem.emitShudderDust(16, 1.0);
    }
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
      : 1;

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
    const rawRad = Number(cutsceneState.doorAngleRad);
    currentAngle = (finished || doorFullyClosed)
      ? 0
      : (Number.isFinite(rawRad) && rawRad >= 0 ? rawRad : angle01 * MAX_OPEN_ANGLE);
    const angularDelta = currentAngle - prevAngle;
    const angularSpeed = safeDt > 0.0005 ? Math.abs(angularDelta) / safeDt : 0;
    const isClosing = doorSlam || angularDelta < -0.0005;
    lastCutsceneAngle = currentAngle;

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

    if ((doorSlam || dustStage >= 4) && !cutsceneSlamBurstFired && (angle01 <= 0.08 || doorFullyClosed || finished)) {
      cutsceneSlamBurstFired = true;
      vfxSystem.emitSlamBurst(isMobile ? 22 : 36);
    }

    const derivedSpark = (!finished && !doorFullyClosed && angularSpeed > 0.06 && angle01 > 0.005 && angle01 < 0.995)
      ? clamp01(angularSpeed * 0.95)
      : 0;
    scrapeSparkIntensity = (finished || doorFullyClosed)
      ? 0
      : (Number.isFinite(explicitSpark) ? clamp01(explicitSpark) : derivedSpark);

    if (scrapeSparkIntensity > 0.01) {
      sparkEmitAccum += safeDt * (24.0 + 38.0 * scrapeSparkIntensity);
      if (sparkEmitAccum >= 1.0) {
        sparkEmitAccum = Math.min(sparkEmitAccum - 1.0, 2.0);
        vfxSystem.emitRailScrapeSparksAndDust(currentAngle, scrapeSparkIntensity, isClosing, pullDir);
      }
    }

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
