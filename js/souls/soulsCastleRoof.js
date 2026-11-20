// Monumental Enclosed Gothic Vaulted Roof, Cathedral Dome, Clerestory Windows & Swaying Chandeliers
// for Chapter 26 — «Abandoned Knight Rift» (Pass 2 Expanded Castle — Pure Vanilla ES Module, Three.js r160).
//
// 100% Data-Driven from `soulsCastleLayout.js`:
//   - Bonfire Hall (`courtyard`, x in [-9, +9], z in [20, 38], 3 ribbed groin vault bays -> apexY = 11.4)
//   - Grand 36m Castle Corridor (`corridor`, x in [-5, +5], z in [-16, 20], 6 ribbed groin vault bays -> apexY = 10.2)
//   - East Alcove Armory Chapel (`east_alcove`, x in [5.8, 13.8], z in [-5, 4], cross-ribbed chapel vault -> apexY = 8.9)
//   - Enlarged Boss Throne Cathedral (`boss_hall`, center (0, -31.2), R = 16.0, 16-bay clerestory drum +
//     16-rib scalloped ogival dome + 8-window Central Gothic Lantern Cupola -> apexY = 18.2,
//     south portal chord cleanly clamped to z = BOSS_DOOR_Z = -16.0 with ZERO corridor protrusion!)
//   - All 7 Wrought-Iron Chandeliers from `SOULS_CASTLE_CHANDELIERS` anchored solidly into their vaulted ceilings.
//
// Strictly 5 Draw Calls on PC/Mobile (4 Draw Calls on LowSpec, 0 castShadow overhead!):
//   1. vaultShellMesh       — Merged Ribbed Groin Vaults, Boss Cathedral Drum & Dome, Lantern Capstone &
//                             Watertight Gable/Lunette Closures (THREE.FrontSide, normals strictly DOWN/INWARD!).
//   2. vaultRibsMesh        — Merged Sculpted Gothic Vault Ribs (5-face downward-tapered chamfered mouldings,
//                             NO upward top caps!), Transverse Arches, Carved Keystones, Wall Cornices,
//                             Springer Corbels, Oculus Ring & Lantern Mullions (THREE.FrontSide).
//   3. clerestoryGlassMesh  — Merged Pointed Clerestory Lancet Windows & Boss Dome Lantern Windows
//                             with Procedural Lead-Tracery Moonlit Stained-Glass GLSL Shader (THREE.FrontSide).
//   4. chandeliersIronMesh  — Merged Wrought-Iron Gothic Corona Lucis Chandeliers & Heavy Chains across all
//                             4 halls with rigid-body GPU Pendulum Sway around each ceiling anchor!
//   5. chandelierFlamesMesh — Merged GPU Billboarded Flickering Candle/Oil Flames locked bit-for-bit to
//                             chandelier pendulum sway (hidden automatically in lowSpec -> 4 DC total!).
//
// Camera-Safe Backface-Culling Architecture (0 CPU overhead!):
//   Every overhead vault panel, dome web, gable closure, clerestory window & chamfered rib uses
//   THREE.FrontSide with normals strictly oriented INWARD/DOWNWARD into the castle chambers.
//   Inside the castle (exploration, combat, Boss Door cutscene) -> 100% solid enclosed Gothic cathedral ceiling.
//   If the camera ever rises high above the roofline looking downward -> hardware backface culling makes the
//   roof cleanly invisible from above without ever obscuring the hero or boss!

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_ROOMS,
  SOULS_CASTLE_VAULTS,
  SOULS_CASTLE_CHANDELIERS
} from './soulsCastleLayout.js?v=20261121z64';

// ============================================================================
// Canonical Architectural Roof Spec (derived 100% live from soulsCastleLayout.js!)
// ============================================================================
function buildRoofSpecFromLayout() {
  const C = SOULS_CASTLE_CONSTANTS;
  const rooms = SOULS_CASTLE_ROOMS;
  const vaults = SOULS_CASTLE_VAULTS;

  const sortByCzAsc = (a, b) => a.cz - b.cz;
  const courtVaults = vaults.filter((v) => v.roomId === 'courtyard').slice().sort(sortByCzAsc);
  const corrVaults = vaults.filter((v) => v.roomId === 'corridor').slice().sort(sortByCzAsc);
  const alcoveVault = vaults.find((v) => v.roomId === 'east_alcove') || null;
  const bossVault = vaults.find((v) => v.roomId === 'boss_hall' || v.kind === 'radial_cathedral_dome') || null;

  // Build watertight contiguous bay boundary arrays along Z directly from room bounds + vault count
  const makeContiguousBaysZ = (minZ, maxZ, count, padMin, padMax) => {
    const n = Math.max(1, count);
    const step = (maxZ - minZ) / n;
    const arr = [];
    for (let i = 0; i <= n; i++) {
      let z = minZ + i * step;
      if (i === 0) z -= padMin;
      if (i === n) z += padMax;
      arr.push(Number(z.toFixed(4)));
    }
    return Object.freeze(arr);
  };

  // Courtyard (Bonfire Hall): wall height 8.6, vault apexY 11.4
  const cyRoom = rooms.courtyard;
  const cyWallH = C.COURTYARD_WALL_HEIGHT;
  const cySpringY = Number((cyWallH - 0.25).toFixed(3)); // 8.35: overlaps 0.25m into 8.6m walls (zero seam!)
  const cyApexY = courtVaults[0]?.apexY ?? cyRoom.ceilingY ?? 11.4;
  const cyRise = Math.max(1.8, cyApexY - cySpringY);
  const cyLunetteRise = Number((cyRise * 0.82).toFixed(3)); // lunette apex ~10.85 (100% above 8.6m wall!)
  const cyTransRise = Number((cyRise * 0.93).toFixed(3));   // transverse arch apex ~11.19
  const cyBaysZ = makeContiguousBaysZ(cyRoom.minZ, cyRoom.maxZ, courtVaults.length || 3, 0.20, 0.35);

  // Corridor (36m x 10m): wall height 8.4, 6 vault bays -> apexY 10.2
  const coRoom = rooms.corridor;
  const coWallH = C.CORRIDOR_WALL_HEIGHT;
  const coSpringY = Number((coWallH - 0.25).toFixed(3)); // 8.15: overlaps 0.25m into 8.4m walls & clears 7.8m arches!
  const coApexY = corrVaults[0]?.apexY ?? coRoom.ceilingY ?? 10.2;
  const coRise = Math.max(1.4, coApexY - coSpringY);
  const coLunetteRise = Number((coRise * 0.84).toFixed(3)); // lunette apex ~9.87 (100% above 8.4m wall!)
  const coTransRise = Number((coRise * 0.93).toFixed(3));   // transverse arch apex ~10.06
  const coBaysZ = makeContiguousBaysZ(coRoom.minZ, coRoom.maxZ, corrVaults.length || 6, 0.15, 0.15);

  // East Alcove (Armory Chapel): wall height 7.8, cross-ribbed chapel vault -> apexY 8.9
  const eaRoom = rooms.east_alcove;
  const eaWallH = C.ALCOVE_WALL_HEIGHT;
  const eaSpringY = Number((eaWallH - 0.25).toFixed(3)); // 7.55: overlaps 0.25m into 7.8m walls!
  const eaApexY = alcoveVault?.apexY ?? eaRoom.ceilingY ?? 8.9;
  const eaRise = Math.max(1.0, eaApexY - eaSpringY);
  const eaLunetteRise = Number((eaRise * 0.94).toFixed(3)); // lunette apex ~8.82 (tall sanctuary lancet!)

  // Boss Throne Cathedral (Enlarged R=16.0, center (0, -31.2), wall height 12.4 -> apexY 18.2)
  const bossRoom = rooms.boss_hall;
  const bossInnerR = C.BOSS_RADIUS;
  const bossWallH = C.BOSS_WALL_HEIGHT;
  const bossSpringY = Number((bossWallH - 0.25).toFixed(3)); // 12.15: overlaps 0.25m into 12.4m curtain walls!
  const bossApexY = bossVault?.apexY ?? bossRoom.ceilingY ?? 18.2;
  const bossDrumTopY = Number((bossSpringY + 1.92).toFixed(3)); // 14.07: 1.92m vertical clerestory drum!
  const bossLanternApexY = bossApexY;                           // 18.20 exact match!
  const bossLanternTopY = Number((bossLanternApexY - 0.34).toFixed(3)); // 17.86
  const bossOculusY = Number((bossLanternTopY - 1.34).toFixed(3));      // 16.52 -> tall 1.34m glowing lantern windows!
  const bossOculusR = Number(Math.min(3.85, Math.max(2.6, (bossVault?.oculusRadius ?? 4.0) * 0.90)).toFixed(3)); // 3.60

  const courtyardOculusBay = courtVaults.find((v) => v.hasOculus) || null;

  return Object.freeze({
    courtyard: Object.freeze({
      minX: cyRoom.minX,
      maxX: cyRoom.maxX,
      minZ: cyRoom.minZ,
      maxZ: cyRoom.maxZ,
      wallHeight: cyWallH,
      wallOverlapX: 0.38,
      wallOverlapZ: 0.35,
      springY: cySpringY,
      corbelSpringY: courtVaults[0]?.springY ?? 7.4,
      apexY: cyApexY,
      lunetteRise: cyLunetteRise,
      transRise: cyTransRise,
      ribThick: courtVaults[0]?.ribThick ?? 0.42,
      baysZ: cyBaysZ,
      oculus: courtyardOculusBay
        ? Object.freeze({
            x: courtyardOculusBay.oculusX ?? 0,
            z: courtyardOculusBay.oculusZ ?? 32.5,
            radius: courtyardOculusBay.oculusRadius ?? 2.3
          })
        : null
    }),
    corridor: Object.freeze({
      minX: coRoom.minX,
      maxX: coRoom.maxX,
      minZ: coRoom.minZ,
      maxZ: coRoom.maxZ,
      wallHeight: coWallH,
      wallOverlapX: 0.38,
      springY: coSpringY,
      corbelSpringY: corrVaults[0]?.springY ?? 6.6,
      apexY: coApexY,
      lunetteRise: coLunetteRise,
      transRise: coTransRise,
      ribThick: corrVaults[0]?.ribThick ?? 0.38,
      baysZ: coBaysZ
    }),
    eastAlcove: Object.freeze({
      minX: eaRoom.minX,
      maxX: eaRoom.maxX,
      minZ: eaRoom.minZ,
      maxZ: eaRoom.maxZ,
      wallHeight: eaWallH,
      wallOverlap: 0.36,
      springY: eaSpringY,
      corbelSpringY: alcoveVault?.springY ?? 5.8,
      apexY: eaApexY,
      lunetteRise: eaLunetteRise,
      transRise: eaLunetteRise,
      ribThick: alcoveVault?.ribThick ?? 0.34
    }),
    bossHall: Object.freeze({
      cx: C.BOSS_CENTER_X,
      cz: C.BOSS_CENTER_Z,
      innerRadius: bossInnerR,
      outerSkirtRadius: Number((bossInnerR + 0.95).toFixed(3)), // 16.95: overlaps past 16.275m 16-gon vertices!
      drumRadius: Number((bossInnerR + 0.25).toFixed(3)),       // 16.25: vertical clerestory drum!
      wallHeight: bossWallH,
      springY: bossSpringY,
      drumTopY: bossDrumTopY,
      oculusRadius: bossOculusR,
      oculusY: bossOculusY,
      lanternTopY: bossLanternTopY,
      lanternApexY: bossLanternApexY,
      radialBays: bossVault?.ribCount ?? 16,
      lanternBays: 8,
      ribThick: bossVault?.ribThick ?? 0.50,
      doorZ: C.BOSS_DOOR_Z,
      doorHalfW: C.BOSS_PORTAL_HALF_W
    })
  });
}

export const SOULS_CASTLE_ROOF_SPEC = buildRoofSpecFromLayout();

// ============================================================================
// Pure Gothic Mathematical Profiles & Exact Ceiling Height Evaluator
// ============================================================================
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Two-centered Gothic pointed arch ogive: crisp pointed apex at s=0, vertical springing at s=1
function gothicOgive(absS, ecc = 0.48) {
  const s = clamp01(Math.abs(absS));
  const R = 1.0 + ecc;
  const peak = Math.sqrt(R * R - ecc * ecc);
  const val = Math.sqrt(Math.max(0, R * R - (s + ecc) * (s + ecc)));
  return val / peak;
}

// Matches soulsCastleDoors.js pointed doorway curve with slight outer clearance (never clips opening doors!)
function gothicBossDoorArchY(xAbs) {
  const halfSpan = SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W + 0.11;
  const springY = 4.65;
  const apexY = 6.56;
  const u = 1.0 - clamp01(Math.abs(xAbs) / halfSpan);
  return springY + (apexY - springY) * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
}

// Exact ceiling height at (x, z) inside a room so EVERY chandelier chain anchors cleanly into solid stone!
function evaluateExactRoofHeight(roomId, x, z) {
  const spec = SOULS_CASTLE_ROOF_SPEC;
  if (roomId === 'boss_hall') {
    const bh = spec.bossHall;
    const dist = Math.hypot(x - bh.cx, z - bh.cz);
    if (dist <= bh.oculusRadius + 0.15) {
      const f = clamp01(1.0 - dist / (bh.oculusRadius + 0.10));
      return bh.lanternTopY + (bh.lanternApexY - bh.lanternTopY) * Math.sin(f * Math.PI * 0.5);
    }
    const cosTerm = clamp01((dist - bh.oculusRadius) / Math.max(0.1, bh.drumRadius - bh.oculusRadius));
    const u = Math.acos(Math.pow(cosTerm, 1.0 / 0.86)) / (Math.PI * 0.5);
    return bh.drumTopY + (bh.oculusY - bh.drumTopY) * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
  }

  if (roomId === 'east_alcove') {
    const ea = spec.eastAlcove;
    const cx = (ea.minX + ea.maxX) * 0.5;
    const cz = (ea.minZ + ea.maxZ) * 0.5;
    const hx = (ea.maxX - ea.minX) * 0.5 + ea.wallOverlap;
    const hz = (ea.maxZ - ea.minZ) * 0.5 + ea.wallOverlap;
    const sx = clamp01(Math.abs(x - cx) / hx);
    const sz = clamp01(Math.abs(z - cz) / hz);
    const u = Math.max(sx, sz);
    const rise = ea.apexY - ea.springY;
    return ea.springY + ea.lunetteRise + (rise - ea.lunetteRise) * (1.0 - u * u);
  }

  const hall = roomId === 'courtyard' ? spec.courtyard : spec.corridor;
  const baysZ = hall.baysZ;
  let bIdx = 0;
  for (let i = 0; i < baysZ.length - 1; i++) {
    if (z >= baysZ[i] && z <= baysZ[i + 1]) {
      bIdx = i;
      break;
    }
    if (z > baysZ[i + 1]) bIdx = i;
  }
  const cz = (baysZ[bIdx] + baysZ[bIdx + 1]) * 0.5;
  const hz = Math.max(0.5, (baysZ[bIdx + 1] - baysZ[bIdx]) * 0.5);
  const sz = clamp01(Math.abs(z - cz) / hz);
  const rise = hall.apexY - hall.springY;
  // Along centerline x=0, height follows the N-S vault ridge curve cleanly!
  return hall.springY + hall.transRise + (rise - hall.transRise) * (1.0 - sz * sz);
}

// Build normalized chandelier configs straight from SOULS_CASTLE_CHANDELIERS (zero floating chains!)
function buildChandelierSpecsFromLayout() {
  return Object.freeze(
    SOULS_CASTLE_CHANDELIERS.map((ch) => {
      const exactRoofY = evaluateExactRoofHeight(ch.roomId, ch.x, ch.z);
      const pivotY = Number(Math.max(ch.hangFromY - 0.04, exactRoofY - 0.04).toFixed(3));
      const doubleTier = (ch.tierCount || 1) >= 2;
      const wheelY = ch.ringY;
      const radius = ch.ringRadius;
      const cupCount = ch.candleCount || 8;
      const upperRadius = doubleTier ? Number((radius * 0.58).toFixed(3)) : 0;
      const upperY = doubleTier ? Number((wheelY + Math.min(1.18, Math.max(0.85, radius * 0.38))).toFixed(3)) : 0;
      const upperCupCount = doubleTier ? Math.max(6, Math.round(cupCount * 0.5)) : 0;

      return Object.freeze({
        id: ch.id,
        roomId: ch.roomId,
        x: ch.x,
        z: ch.z,
        pivotY,
        hangFromY: ch.hangFromY,
        wheelY,
        ringY: wheelY,
        radius,
        ringRadius: radius,
        cupCount,
        candleCount: cupCount,
        phase: ch.swayPhase ?? 0,
        swayAmp: ch.swayAmp ?? 0.014,
        swaySpeed: ch.swaySpeed ?? 0.65,
        doubleTier,
        tierCount: ch.tierCount || 1,
        upperY,
        upperRadius,
        upperCupCount
      });
    })
  );
}

const CHANDELIER_SPECS = buildChandelierSpecsFromLayout();

// ============================================================================
// Geometry Normalization & Guaranteed-Inward Mesh Builders
// ============================================================================
function normalizeStoneGeo(rawGeo) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv' && attrName !== 'color') {
      g.deleteAttribute(attrName);
    }
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const count = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!g.attributes.color) {
    const cols = new Float32Array(count * 3);
    cols.fill(1.0);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  }
  return g;
}

function mergeStoneParts(parts) {
  if (!parts.length) return new THREE.BufferGeometry();
  const normalized = [];
  for (let i = 0; i < parts.length; i++) {
    const g = normalizeStoneGeo(parts[i]);
    normalized.push(g);
    parts[i].dispose();
  }
  const merged = mergeGeometries(normalized, false);
  for (let i = 0; i < normalized.length; i++) normalized[i].dispose();
  return merged;
}

function applyBoxProjectedUVs(geo, tileScale = 3.2) {
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

function placeGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

// Build a guaranteed-inward-facing indexed BufferGeometry from a 2D vertex grid.
// Every triangle's geometric normal is mathematically checked against `inwardCheckFn(cx, cy, cz)`
// so FrontSide ALWAYS faces INTO the room & DOWNWARD (0 upward ceiling leaks!).
function buildInwardGridGeometry(rows, cols, gridVerts, inwardCheckFn) {
  const count = rows * cols;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const v = gridVerts[i];
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    uvs[i * 2] = v.u;
    uvs[i * 2 + 1] = v.v;
    colors[i * 3] = v.r;
    colors[i * 3 + 1] = v.g;
    colors[i * 3 + 2] = v.b;
  }

  const indices = [];
  const pushOrientedTri = (i0, i1, i2) => {
    const a = gridVerts[i0];
    const b = gridVerts[i1];
    const c = gridVerts[i2];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const lenSq = nx * nx + ny * ny + nz * nz;
    if (lenSq < 1e-10) return; // skip degenerate apex triangle
    const mx = (a.x + b.x + c.x) * (1 / 3);
    const my = (a.y + b.y + c.y) * (1 / 3);
    const mz = (a.z + b.z + c.z) * (1 / 3);
    const dir = inwardCheckFn(mx, my, mz);
    const dot = nx * dir[0] + ny * dir[1] + nz * dir[2];
    if (dot >= 0) {
      indices.push(i0, i1, i2);
    } else {
      indices.push(i0, i2, i1);
    }
  };

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i00 = r * cols + c;
      const i10 = (r + 1) * cols + c;
      const i11 = (r + 1) * cols + (c + 1);
      const i01 = r * cols + (c + 1);
      pushOrientedTri(i00, i10, i11);
      pushOrientedTri(i00, i11, i01);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// 1. Sculpted Gothic Vault Rib Extruder (Underside-Only 5-Face Chamfered Profile!)
// ============================================================================
const RIB_PROFILE_5FACE = Object.freeze([
  // [binormalFrac, dropFrac, aoBrightness]
  Object.freeze([-0.50, -0.05, 0.58]), // left ceiling root (embedded into web)
  Object.freeze([-0.43,  0.34, 0.86]), // left hollow chamfer shoulder
  Object.freeze([-0.22,  0.88, 1.05]), // left soffit bevel edge
  Object.freeze([ 0.22,  0.88, 1.05]), // right soffit bevel edge
  Object.freeze([ 0.43,  0.34, 0.86]), // right hollow chamfer shoulder
  Object.freeze([ 0.50, -0.05, 0.58])  // right ceiling root
]);

function createGothicRibGeometry(points, {
  width = 0.44,
  depth = 0.34,
  dropDir = null, // either [dx,dy,dz] or (pt) => [dx,dy,dz]
  uvScale = 2.8,
  tintR = 1.0,
  tintG = 1.0,
  tintB = 1.0,
  closedLoop = false
} = {}) {
  const nPts = points.length;
  if (nPts < 2) return null;
  const prof = RIB_PROFILE_5FACE;
  const pLen = prof.length;

  const rings = [];
  let arcLen = 0;

  for (let i = 0; i < nPts; i++) {
    const p = points[i];
    if (i > 0) {
      const prev = points[i - 1];
      arcLen += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
    }

    let pPrev, pNext;
    if (closedLoop) {
      pPrev = points[(i - 1 + nPts) % nPts];
      pNext = points[(i + 1) % nPts];
    } else {
      pPrev = points[Math.max(0, i - 1)];
      pNext = points[Math.min(nPts - 1, i + 1)];
    }

    // Unit tangent T
    let tx = pNext.x - pPrev.x;
    let ty = pNext.y - pPrev.y;
    let tz = pNext.z - pPrev.z;
    const tLen = Math.hypot(tx, ty, tz) || 1;
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;

    // Desired inward/downward drop vector D orthogonalized against T
    const rawDrop = typeof dropDir === 'function' ? dropDir(p) : (dropDir || [0, -1, 0]);
    let dx = rawDrop[0];
    let dy = rawDrop[1];
    let dz = rawDrop[2];
    const dDotT = dx * tx + dy * ty + dz * tz;
    dx -= dDotT * tx;
    dy -= dDotT * ty;
    dz -= dDotT * tz;
    let dLen = Math.hypot(dx, dy, dz);
    if (dLen < 1e-4) {
      dx = 0;
      dy = -1;
      dz = 0;
      const dot2 = dy * ty;
      dx -= dot2 * tx;
      dy -= dot2 * ty;
      dz -= dot2 * tz;
      dLen = Math.hypot(dx, dy, dz) || 1;
    }
    dx /= dLen;
    dy /= dLen;
    dz /= dLen;

    // Binormal B = normalize(T x D)
    let bx = ty * dz - tz * dy;
    let by = tz * dx - tx * dz;
    let bz = tx * dy - ty * dx;
    const bLen = Math.hypot(bx, by, bz) || 1;
    bx /= bLen;
    by /= bLen;
    bz /= bLen;

    const ring = [];
    for (let k = 0; k < pLen; k++) {
      const [bf, df, ao] = prof[k];
      const offB = bf * width;
      const offD = df * depth;
      ring.push({
        x: p.x + bx * offB + dx * offD,
        y: p.y + by * offB + dy * offD,
        z: p.z + bz * offB + dz * offD,
        u: arcLen / uvScale,
        v: (k / (pLen - 1)) * ((width + depth * 1.8) / uvScale),
        r: ao * tintR,
        g: ao * tintG,
        b: ao * tintB,
        dx,
        dy,
        dz
      });
    }
    rings.push(ring);
  }

  const totalSegs = closedLoop ? nPts : nPts - 1;
  const positions = [];
  const uvs = [];
  const colors = [];

  const pushTri = (a, b, c, outDir) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    const dot = nx * outDir[0] + ny * outDir[1] + nz * outDir[2];
    const order = dot >= 0 ? [a, b, c] : [a, c, b];
    for (let m = 0; m < 3; m++) {
      const vt = order[m];
      positions.push(vt.x, vt.y, vt.z);
      uvs.push(vt.u, vt.v);
      colors.push(vt.r, vt.g, vt.b);
    }
  };

  for (let i = 0; i < totalSegs; i++) {
    const r0 = rings[i];
    const r1 = rings[(i + 1) % nPts];
    const p0 = points[i];
    const p1 = points[(i + 1) % nPts];
    const centerX = (p0.x + p1.x) * 0.5;
    const centerY = (p0.y + p1.y) * 0.5;
    const centerZ = (p0.z + p1.z) * 0.5;
    for (let k = 0; k < pLen - 1; k++) {
      const a = r0[k];
      const b = r1[k];
      const c = r1[k + 1];
      const d = r0[k + 1];
      const fx = (a.x + b.x + c.x + d.x) * 0.25;
      const fy = (a.y + b.y + c.y + d.y) * 0.25;
      const fz = (a.z + b.z + c.z + d.z) * 0.25;
      const outDir = [
        (fx - centerX) + (a.dx + b.dx) * 0.14,
        (fy - centerY) + (a.dy + b.dy) * 0.14,
        (fz - centerZ) + (a.dz + b.dz) * 0.14
      ];
      pushTri(a, b, c, outDir);
      pushTri(a, c, d, outDir);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// Sculpted downward-tapered Octagonal Gothic Keystone Boss (NO top cap -> FrontSide safe from above!)
function createGothicKeystoneGeometry(x, y, z, scale = 1.0) {
  const segs = 8;
  const ringsSpec = [
    { r: 0.72 * scale, dy:  0.04 * scale, ao: 0.64 },
    { r: 0.66 * scale, dy: -0.16 * scale, ao: 0.86 },
    { r: 0.54 * scale, dy: -0.22 * scale, ao: 0.76 },
    { r: 0.46 * scale, dy: -0.40 * scale, ao: 1.00 },
    { r: 0.24 * scale, dy: -0.54 * scale, ao: 1.06 },
    { r: 0.00,         dy: -0.60 * scale, ao: 0.94 }
  ];

  const rows = ringsSpec.length;
  const cols = segs + 1;
  const verts = new Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const spec = ringsSpec[r];
    for (let c = 0; c < cols; c++) {
      const ang = (c / segs) * Math.PI * 2 + Math.PI / 8;
      const scallop = r === 1 || r === 3 ? (1.0 + 0.06 * Math.cos(c * Math.PI)) : 1.0;
      const rad = spec.r * scallop;
      verts[r * cols + c] = {
        x: x + Math.cos(ang) * rad,
        y: y + spec.dy,
        z: z + Math.sin(ang) * rad,
        u: (c / segs) * 2.0,
        v: r * 0.22,
        r: spec.ao,
        g: spec.ao * 0.99,
        b: spec.ao * 1.02
      };
    }
  }

  return buildInwardGridGeometry(rows, cols, verts, (mx, my, mz) => [
    mx - x,
    (my - y) - 0.55 * scale,
    mz - z
  ]);
}

// Sculpted Underside-Only Gothic Springer Corbel Bracket anchored to perimeter walls
function createWallCorbelGeometry(x, y, z, inwardNx, inwardNz, width = 0.62, depth = 0.52, height = 0.92) {
  const tx = -inwardNz;
  const tz = inwardNx;
  const tiers = [
    { dy:  0.04,          proj: depth * 1.00, halfW: width * 0.54, ao: 0.96 },
    { dy: -height * 0.20, proj: depth * 0.92, halfW: width * 0.50, ao: 0.92 },
    { dy: -height * 0.36, proj: depth * 0.68, halfW: width * 0.42, ao: 0.80 },
    { dy: -height * 0.68, proj: depth * 0.42, halfW: width * 0.30, ao: 0.72 },
    { dy: -height * 1.00, proj: 0.02,         halfW: width * 0.14, ao: 0.58 }
  ];
  const rows = tiers.length;
  const cols = 4;
  const verts = new Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const t = tiers[r];
    const pts = [
      { s: -t.halfW,        p: 0.0,    ao: t.ao * 0.76 },
      { s: -t.halfW * 0.78, p: t.proj, ao: t.ao },
      { s:  t.halfW * 0.78, p: t.proj, ao: t.ao },
      { s:  t.halfW,        p: 0.0,    ao: t.ao * 0.76 }
    ];
    for (let c = 0; c < cols; c++) {
      const pt = pts[c];
      verts[r * cols + c] = {
        x: x + tx * pt.s + inwardNx * pt.p,
        y: y + t.dy,
        z: z + tz * pt.s + inwardNz * pt.p,
        u: (pt.s + width * 0.5) * 0.7,
        v: (y + t.dy) * 0.45,
        r: pt.ao,
        g: pt.ao,
        b: pt.ao * 1.02
      };
    }
  }
  return buildInwardGridGeometry(rows, cols, verts, (mx, _my, mz) => [
    inwardNx * 0.85 + (mx - x) * 0.35,
    -0.55,
    inwardNz * 0.85 + (mz - z) * 0.35
  ]);
}

// Continuous Underside-Beveled Wall Cornice Strip (vertical frieze + downward-sloped soffit, NO top cap!)
function createWallCorniceGeometry(x0, z0, x1, z1, yTop, inwardNx, inwardNz, height = 0.42, proj = 0.36) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return null;
  const rows = 4;
  const cols = 2;
  const steps = [
    { dy:  0.02,          p: proj,        ao: 0.96 },
    { dy: -height * 0.38, p: proj,        ao: 0.88 },
    { dy: -height * 0.70, p: proj * 0.55, ao: 0.74 },
    { dy: -height,        p: 0.0,         ao: 0.60 }
  ];
  const verts = new Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const st = steps[r];
    for (let c = 0; c < 2; c++) {
      const bx = c === 0 ? x0 : x1;
      const bz = c === 0 ? z0 : z1;
      verts[r * cols + c] = {
        x: bx + inwardNx * st.p,
        y: yTop + st.dy,
        z: bz + inwardNz * st.p,
        u: (c * len) / 3.0,
        v: r * 0.14,
        r: st.ao,
        g: st.ao,
        b: st.ao * 1.02
      };
    }
  }
  return buildInwardGridGeometry(rows, cols, verts, () => [inwardNx, -0.45, inwardNz]);
}

// ============================================================================
// 2. Clerestory Pointed Lancet Window Builder (Glass Pane + Carved Stone Frame)
// ============================================================================
function appendClerestoryLancetWindow(glassParts, ribParts, windowRegistry, {
  id,
  roomId,
  x,
  yBot,
  yTop,
  z,
  width,
  inwardNx,
  inwardNz,
  winKind = 0.0, // 0.0 = wall clerestory lancet, 1.0 = Boss Hall central dome lantern
  addStoneFrame = true
}) {
  const h = Math.max(0.55, yTop - yBot);
  const halfW = width * 0.5;
  const springFrac = 0.56;
  const springY = yBot + h * springFrac;
  const archRise = h * (1.0 - springFrac);

  const tx = -inwardNz;
  const tz = inwardNx;

  windowRegistry.push(Object.freeze({
    id,
    roomId,
    x: Number(x.toFixed(3)),
    y: Number((yBot + h * 0.52).toFixed(3)),
    z: Number(z.toFixed(3)),
    normalX: Number(inwardNx.toFixed(4)),
    normalY: 0,
    normalZ: Number(inwardNz.toFixed(4)),
    width: Number(width.toFixed(3)),
    height: Number(h.toFixed(3)),
    kind: winKind > 0.5 ? 'dome_lantern' : 'clerestory'
  }));

  // 1. Pointed-arch stained-glass pane geometry (FrontSide strictly facing inwardNx/inwardNz!)
  const cols = 6;
  const rows = 5;
  const positions = [];
  const normals = [];
  const uvs = [];
  const kinds = [];

  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const vf = r / rows;
    const rowPts = [];
    for (let c = 0; c <= cols; c++) {
      const uf = c / cols;
      const sx = (uf - 0.5) * 2.0;
      const topAtX = springY + archRise * gothicOgive(Math.abs(sx), 0.52);
      const py = yBot + (topAtX - yBot) * vf;
      const localU = sx * halfW;
      rowPts.push({
        x: x + tx * localU + inwardNx * 0.07,
        y: py,
        z: z + tz * localU + inwardNz * 0.07,
        u: uf,
        v: (py - yBot) / h
      });
    }
    grid.push(rowPts);
  }

  const pushGlassTri = (a, b, c) => {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const acx = c.x - a.x;
    const acy = c.y - a.y;
    const acz = c.z - a.z;
    const nx = aby * acz - abz * acy;
    const nz = abx * acy - aby * acx;
    const dot = nx * inwardNx + nz * inwardNz;
    const order = dot >= 0 ? [a, b, c] : [a, c, b];
    for (let k = 0; k < 3; k++) {
      const p = order[k];
      positions.push(p.x, p.y, p.z);
      normals.push(inwardNx, 0, inwardNz);
      uvs.push(p.u, p.v);
      kinds.push(winKind);
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pushGlassTri(grid[r][c], grid[r + 1][c], grid[r + 1][c + 1]);
      pushGlassTri(grid[r][c], grid[r + 1][c + 1], grid[r][c + 1]);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('aWinKind', new THREE.Float32BufferAttribute(kinds, 1));
  glassParts.push(g);

  if (!addStoneFrame) return;

  // 2. Sculpted Stone Gothic Pointed Arch Hood-Mould, Sill Ledge & Central Stone Mullion (ribParts)
  const archPts = [];
  const archSegs = 8;
  for (let i = 0; i <= archSegs; i++) {
    const s = -1.0 + (2.0 * i) / archSegs;
    const ly = springY + (archRise + 0.07) * gothicOgive(Math.abs(s), 0.52);
    const lu = s * (halfW + 0.11);
    archPts.push({
      x: x + tx * lu + inwardNx * 0.04,
      y: ly,
      z: z + tz * lu + inwardNz * 0.04
    });
  }
  const hoodGeo = createGothicRibGeometry(archPts, {
    width: 0.20,
    depth: 0.17,
    dropDir: [inwardNx * 0.92, -0.38, inwardNz * 0.92],
    tintR: 0.95,
    tintG: 0.97,
    tintB: 1.04
  });
  if (hoodGeo) ribParts.push(hoodGeo);

  const jambOffsets = [-halfW - 0.08, 0.0, halfW + 0.08];
  for (let j = 0; j < jambOffsets.length; j++) {
    const lu = jambOffsets[j];
    const isCenter = j === 1;
    const topY = isCenter ? (yTop - 0.12) : (springY + 0.05);
    const mullionPts = [
      { x: x + tx * lu + inwardNx * 0.04, y: yBot, z: z + tz * lu + inwardNz * 0.04 },
      { x: x + tx * lu + inwardNx * 0.04, y: topY, z: z + tz * lu + inwardNz * 0.04 }
    ];
    const mGeo = createGothicRibGeometry(mullionPts, {
      width: isCenter ? 0.11 : 0.18,
      depth: isCenter ? 0.11 : 0.16,
      dropDir: [inwardNx, -0.25, inwardNz],
      tintR: 0.92,
      tintG: 0.94,
      tintB: 1.02
    });
    if (mGeo) ribParts.push(mGeo);
  }

  const sx0 = x + tx * (-halfW - 0.18);
  const sz0 = z + tz * (-halfW - 0.18);
  const sx1 = x + tx * (halfW + 0.18);
  const sz1 = z + tz * (halfW + 0.18);
  const sillGeo = createWallCorniceGeometry(sx0, sz0, sx1, sz1, yBot + 0.04, inwardNx, inwardNz, 0.20, 0.22);
  if (sillGeo) ribParts.push(sillGeo);
}

// ============================================================================
// 3. True 4-Severy Ribbed Gothic Groin Vault Bay Builder
// ============================================================================
function buildGroinVaultBay({
  roomId,
  bayIndex,
  cx,
  cz,
  hx,
  hz,
  innerHalfX,
  innerHalfZ,
  ySpring,
  yApex,
  lunetteRise,
  transRise,
  ribThick = 0.42,
  wallHeight = 8.4,
  segU,
  segT,
  shellParts,
  ribParts,
  glassParts,
  windowRegistry,
  addWestLunette = true,
  addEastLunette = true,
  addNorthLunette = false,
  addSouthLunette = false,
  addWestWindow = false,
  addEastWindow = false,
  addNorthWindow = false,
  addSouthWindow = false,
  windowWidth = 1.65,
  includeKeystone = true,
  keystoneScale = 1.0,
  tileScale = 3.2
}) {
  const rise = yApex - ySpring;

  const yDiagFn = (u) => ySpring + rise * gothicOgive(u, 0.48);
  const yRidgeEW = (u) => ySpring + lunetteRise + (rise - lunetteRise) * (1.0 - u * u);
  const yRidgeNS = (u) => ySpring + transRise + (rise - transRise) * (1.0 - u * u);

  const inwardRef = [cx, ySpring - 10.0, cz];
  const inwardCheck = (mx, my, mz) => [inwardRef[0] - mx, inwardRef[1] - my, inwardRef[2] - mz];

  // A. West (-1) & East (+1) Severies
  for (const sideX of [-1, 1]) {
    const rows = segU + 1;
    const cols = segT * 2 + 1;
    const verts = new Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const u = r / segU;
      const yd = yDiagFn(u);
      const ym = yRidgeEW(u);
      for (let c = 0; c < cols; c++) {
        const tSigned = -1.0 + (2.0 * c) / (cols - 1);
        const absT = Math.abs(tSigned);
        const ogT = gothicOgive(absT, 0.48);
        const px = cx + sideX * u * hx;
        const pz = cz + u * tSigned * hz;
        const py = yd + (ym - yd) * ogT;

        const cornerAO = 1.0 - 0.34 * (u * u) * (0.45 + 0.55 * absT * absT);
        const groinCreaseAO = 1.0 - 0.14 * Math.pow(absT, 3.0);
        const ao = Math.max(0.60, Math.min(1.06, cornerAO * groinCreaseAO));
        const moonLift = u > 0.55 && absT < 0.52 ? 0.14 * (u - 0.55) : 0.0;

        verts[r * cols + c] = {
          x: px,
          y: py,
          z: pz,
          u: (px - cx) / tileScale,
          v: ((pz - cz) + (py - ySpring) * 0.45) / tileScale,
          r: ao * (0.94 + moonLift * 0.45),
          g: ao * (0.97 + moonLift * 0.78),
          b: ao * (1.05 + moonLift * 1.45)
        };
      }
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, inwardCheck));
  }

  // B. North (-1) & South (+1) Severies
  for (const sideZ of [-1, 1]) {
    const rows = segU + 1;
    const cols = segT * 2 + 1;
    const verts = new Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const u = r / segU;
      const yd = yDiagFn(u);
      const ym = yRidgeNS(u);
      for (let c = 0; c < cols; c++) {
        const tSigned = -1.0 + (2.0 * c) / (cols - 1);
        const absT = Math.abs(tSigned);
        const ogT = gothicOgive(absT, 0.48);
        const px = cx + u * tSigned * hx;
        const pz = cz + sideZ * u * hz;
        const py = yd + (ym - yd) * ogT;

        const cornerAO = 1.0 - 0.34 * (u * u) * (0.45 + 0.55 * absT * absT);
        const groinCreaseAO = 1.0 - 0.14 * Math.pow(absT, 3.0);
        const ao = Math.max(0.60, Math.min(1.06, cornerAO * groinCreaseAO));

        verts[r * cols + c] = {
          x: px,
          y: py,
          z: pz,
          u: ((px - cx) + (py - ySpring) * 0.45) / tileScale,
          v: (pz - cz) / tileScale,
          r: ao * 0.94,
          g: ao * 0.97,
          b: ao * 1.05
        };
      }
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, inwardCheck));
  }

  // C. Carved Gothic Diagonal Ogive Ribs (2 full corner-to-corner crossing arches!)
  const diagSteps = segU * 2;
  for (const diagSign of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= diagSteps; i++) {
      const s = -1.0 + (2.0 * i) / diagSteps;
      const absS = Math.abs(s);
      pts.push({
        x: cx + s * innerHalfX,
        y: yDiagFn(absS * (innerHalfX / hx)),
        z: cz + diagSign * s * innerHalfZ
      });
    }
    const diagRib = createGothicRibGeometry(pts, {
      width: ribThick,
      depth: ribThick * 0.80,
      dropDir: (pt) => [(cx - pt.x) * 0.08, -1.0, (cz - pt.z) * 0.08]
    });
    if (diagRib) ribParts.push(diagRib);
  }

  // D. Longitudinal & Transverse Crown Ridge Ribs
  const ridgeNS = [];
  const ridgeEW = [];
  for (let i = 0; i <= segU * 2; i++) {
    const s = -1.0 + (2.0 * i) / (segU * 2);
    const absS = Math.abs(s);
    ridgeNS.push({ x: cx, y: yRidgeNS(absS), z: cz + s * hz });
    ridgeEW.push({ x: cx + s * innerHalfX, y: yRidgeEW(absS * (innerHalfX / hx)), z: cz });
  }
  const rNS = createGothicRibGeometry(ridgeNS, { width: ribThick * 0.68, depth: ribThick * 0.48, dropDir: [0, -1, 0] });
  const rEW = createGothicRibGeometry(ridgeEW, { width: ribThick * 0.68, depth: ribThick * 0.48, dropDir: [0, -1, 0] });
  if (rNS) ribParts.push(rNS);
  if (rEW) ribParts.push(rEW);

  // E. Sculpted Central Keystone Boss at Bay Apex
  if (includeKeystone) {
    ribParts.push(createGothicKeystoneGeometry(cx, yApex, cz, keystoneScale));
  }

  // F. Watertight Perimeter Clerestory Lunette Spandrel Walls + Formeret Ribs + Lancet Windows
  const buildSideLunette = (axis, side, hasWindow) => {
    const steps = segT * 2;
    const rows = 2;
    const cols = steps + 1;
    const verts = new Array(rows * cols);
    const wallCoord = axis === 'x'
      ? cx + side * (innerHalfX + 0.02)
      : cz + side * (innerHalfZ + 0.02);
    const inNx = axis === 'x' ? -side : 0;
    const inNz = axis === 'z' ? -side : 0;
    const spanHalf = axis === 'x' ? hz : hx;
    const riseVal = axis === 'x' ? lunetteRise : transRise;

    const formeretPts = [];
    for (let c = 0; c <= steps; c++) {
      const tSigned = -1.0 + (2.0 * c) / steps;
      const absT = Math.abs(tSigned);
      const yTopCurve = ySpring + riseVal * gothicOgive(absT, 0.48) + 0.08;
      const yBotCurve = ySpring - 0.18;
      const vx = axis === 'x' ? wallCoord : (cx + tSigned * spanHalf);
      const vz = axis === 'x' ? (cz + tSigned * spanHalf) : wallCoord;
      const uCoord = (tSigned * spanHalf) / tileScale;

      verts[c] = {
        x: vx, y: yBotCurve, z: vz, u: uCoord, v: yBotCurve / tileScale,
        r: 0.72, g: 0.75, b: 0.82
      };
      verts[cols + c] = {
        x: vx, y: yTopCurve, z: vz, u: uCoord, v: yTopCurve / tileScale,
        r: 0.90, g: 0.94, b: 1.04
      };
      formeretPts.push({
        x: vx + inNx * 0.04,
        y: yTopCurve - 0.08,
        z: vz + inNz * 0.04
      });
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, () => [inNx, -0.06, inNz]));

    const formRib = createGothicRibGeometry(formeretPts, {
      width: 0.24,
      depth: 0.20,
      dropDir: [inNx * 0.72, -0.69, inNz * 0.72]
    });
    if (formRib) ribParts.push(formRib);

    if (hasWindow) {
      // Position clerestory window strictly ABOVE the room's solid perimeter wall height (0 wall occlusion!)
      const winBot = Math.max(ySpring + 0.16, wallHeight + 0.04);
      const winTop = Math.max(winBot + 0.72, ySpring + riseVal - 0.16);
      appendClerestoryLancetWindow(glassParts, ribParts, windowRegistry, {
        id: `clerestory_${roomId}_${axis}${side > 0 ? 'p' : 'n'}_${bayIndex}`,
        roomId,
        x: axis === 'x' ? wallCoord : cx,
        yBot: winBot,
        yTop: winTop,
        z: axis === 'x' ? cz : wallCoord,
        width: windowWidth,
        inwardNx: inNx,
        inwardNz: inNz,
        winKind: 0.0,
        addStoneFrame: true
      });
    }
  };

  if (addWestLunette) buildSideLunette('x', -1, addWestWindow);
  if (addEastLunette) buildSideLunette('x', +1, addEastWindow);
  if (addNorthLunette) buildSideLunette('z', -1, addNorthWindow);
  if (addSouthLunette) buildSideLunette('z', +1, addSouthWindow);
}

// Helper: Transverse Pointed Arch Rib spanning X across a hall at zPos
function appendTransverseArchRib(ribParts, cx, innerHalfX, hx, zPos, ySpring, transRise, width = 0.54, depth = 0.42, segs = 12) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const s = -1.0 + (2.0 * i) / segs;
    const x = cx + s * innerHalfX;
    const y = ySpring + transRise * gothicOgive(Math.abs(s) * (innerHalfX / hx), 0.48);
    pts.push({ x, y, z: zPos });
  }
  const geo = createGothicRibGeometry(pts, {
    width,
    depth,
    dropDir: [0, -1, 0],
    tintR: 1.02,
    tintG: 1.02,
    tintB: 1.04
  });
  if (geo) ribParts.push(geo);
}

// Watertight Vertical Pointed Tympanum Wall along Z = zPlane spanning x in [minX, maxX]
function buildGableTympanumZ(zPlane, minX, maxX, yBotFn, yTopFn, inwardNz, segs = 18, tileScale = 3.2) {
  const rows = 2;
  const cols = segs + 1;
  const verts = new Array(rows * cols);
  for (let c = 0; c <= segs; c++) {
    const f = c / segs;
    const x = minX + (maxX - minX) * f;
    const yTop = yTopFn(x);
    const yBot = Math.min(yTop - 0.02, yBotFn(x));
    const u = x / tileScale;
    verts[c] = {
      x, y: yBot, z: zPlane, u, v: yBot / tileScale,
      r: 0.70, g: 0.74, b: 0.82
    };
    verts[cols + c] = {
      x, y: yTop, z: zPlane, u, v: yTop / tileScale,
      r: 0.92, g: 0.96, b: 1.05
    };
  }
  return buildInwardGridGeometry(rows, cols, verts, () => [0, -0.05, inwardNz]);
}

// ============================================================================
// 4. Giant 16-Bay Boss Throne Cathedral Clerestory Drum, Ogival Dome & Lantern
//    (Enlarged R = 16.0, center (0, -31.2), apexY = 18.2, clamped cleanly at z = -16.05!)
// ============================================================================
function buildBossCathedralDome(shellParts, ribParts, glassParts, windowRegistry, isMobile) {
  const spec = SOULS_CASTLE_ROOF_SPEC.bossHall;
  const cx = spec.cx;
  const cz = spec.cz;
  const R_outer = spec.outerSkirtRadius; // 16.95
  const R_drum = spec.drumRadius;        // 16.25
  const R_inner = spec.innerRadius;      // 16.00
  const R_oculus = spec.oculusRadius;    // 3.60
  const ySpring = spec.springY;          // 12.15
  const yDrumTop = spec.drumTopY;        // 14.07
  const yOculus = spec.oculusY;          // 16.86
  const yLanternTop = spec.lanternTopY;  // 17.84
  const yLanternApex = spec.lanternApexY; // 18.20
  const bays = spec.radialBays;          // 16
  const bayAng = (Math.PI * 2) / bays;
  const baseAngOffset = bayAng * 0.5;    // centers North (Throne) & South (Boss Doors) cleanly inside bays!
  const southClampZ = spec.doorZ - 0.05; // -16.05: ZERO dome protrusion into Corridor!
  // Exact chord half-width where outer dome skirt meets z = southClampZ (~7.6m on R=16.0 hall!)
  const southDz = Math.abs(southClampZ - cz);
  const southClampHalfX = Math.sqrt(Math.max(16.0, R_outer * R_outer - southDz * southDz)) + 0.35;
  const southDrumHalfX = Math.sqrt(Math.max(12.0, R_drum * R_drum - southDz * southDz)) + 0.25;

  const ringSegs = isMobile ? 6 : 9;
  const subAngSegs = isMobile ? 2 : 3;
  const domeRise = yOculus - yDrumTop;

  // A0. Horizontal Stone Wall-to-Drum Soffit Collar (seals 16-segment curtain walls R=16.0..16.95 at y=12.15)
  {
    const colSegs = 32;
    const rows = 2;
    const cols = colSegs + 1;
    const verts = new Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const rad = r === 0 ? R_drum : R_outer;
      for (let c = 0; c < cols; c++) {
        const a = (c / colSegs) * Math.PI * 2;
        let px = cx + Math.cos(a) * rad;
        let pz = cz + Math.sin(a) * rad;
        if (pz > southClampZ && Math.abs(px) < southClampHalfX) pz = southClampZ;
        verts[r * cols + c] = {
          x: px,
          y: ySpring,
          z: pz,
          u: (c / colSegs) * 30.0,
          v: r * 0.35,
          r: 0.64,
          g: 0.67,
          b: 0.74
        };
      }
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, () => [0, -1, 0]));
  }

  // A1. Vertical 16-Bay Gothic Clerestory Drum (y = 12.15 -> 14.07 at R = 16.25, FrontSide strictly inward!)
  {
    const drumSegs = bays * 2;
    const rows = 2;
    const cols = drumSegs + 1;
    const verts = new Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const vy = r === 0 ? (ySpring - 0.04) : (yDrumTop + 0.06);
      for (let c = 0; c < cols; c++) {
        const a = baseAngOffset + (c / drumSegs) * Math.PI * 2;
        let px = cx + Math.cos(a) * R_drum;
        let pz = cz + Math.sin(a) * R_drum;
        if (pz > southClampZ && Math.abs(px) < southClampHalfX) pz = southClampZ;
        const ao = r === 0 ? 0.68 : 0.88;
        verts[r * cols + c] = {
          x: px,
          y: vy,
          z: pz,
          u: (c / drumSegs) * 32.0,
          v: (vy - ySpring) / 3.0,
          r: ao * 0.94,
          g: ao * 0.98,
          b: ao * 1.06
        };
      }
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, (mx, _my, mz) => [cx - mx, -0.05, cz - mz]));
  }

  // Helper evaluating a point on the 16-bay scalloped Gothic ogival dome (y = 14.07 -> 16.86)
  const evalDomePoint = (ang, u, bayFrac) => {
    const baseR = R_oculus + (R_drum - R_oculus) * Math.pow(Math.cos(u * Math.PI * 0.5), 0.86);
    const baseY = yDrumTop + domeRise * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
    const scallop = 0.28 * Math.sin(bayFrac * Math.PI) * Math.sin(u * Math.PI);
    let px = cx + Math.cos(ang) * baseR;
    let pz = cz + Math.sin(ang) * baseR;
    const py = baseY + scallop;

    if (pz > southClampZ && Math.abs(px) < southClampHalfX) {
      pz = southClampZ;
    }
    return { x: px, y: py, z: pz, r: baseR };
  };

  // A2. 16 Curved Scalloped Dome Shell Bays (FrontSide strictly pointing inward/downward!)
  const domeInwardCheck = (mx, my, mz) => [cx - mx, (ySpring - 10.0) - my, cz - mz];

  for (let b = 0; b < bays; b++) {
    const a0 = baseAngOffset + b * bayAng;
    const rows = ringSegs + 1;
    const cols = subAngSegs + 1;
    const verts = new Array(rows * cols);

    for (let r = 0; r < rows; r++) {
      const u = r / ringSegs;
      for (let c = 0; c < cols; c++) {
        const bf = c / subAngSegs;
        const ang = a0 + bf * bayAng;
        const pt = evalDomePoint(ang, u, bf);

        const ribCrease = 1.0 - 0.14 * Math.pow(Math.abs(bf - 0.5) * 2.0, 2.2);
        const heightShade = 0.72 + 0.32 * Math.pow(u, 0.70);
        const oculusGlow = u > 0.60 ? (u - 0.60) / 0.40 : 0.0;
        const ao = Math.max(0.62, heightShade * ribCrease);

        verts[r * cols + c] = {
          x: pt.x,
          y: pt.y,
          z: pt.z,
          u: ((b + bf) * (Math.PI * 2 * (pt.r * 0.16))) / 3.2,
          v: (u * 14.8) / 3.2,
          r: ao * (0.94 + oculusGlow * 0.16),
          g: ao * (0.98 + oculusGlow * 0.25),
          b: ao * (1.07 + oculusGlow * 0.42)
        };
      }
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, domeInwardCheck));
  }

  // B. 16 Engaged Drum Pilasters + Sweeping Radial Gothic Dome Ribs + Wall Corbels
  const ribSteps = isMobile ? 7 : 10;
  for (let b = 0; b < bays; b++) {
    const ang = baseAngOffset + b * bayAng;
    const pts = [];
    let drumPx = cx + Math.cos(ang) * (R_drum - 0.14);
    let drumPz = cz + Math.sin(ang) * (R_drum - 0.14);
    if (drumPz > southClampZ && Math.abs(drumPx) < southClampHalfX) drumPz = southClampZ;
    pts.push({ x: drumPx, y: ySpring + 0.04, z: drumPz });

    for (let i = 0; i <= ribSteps; i++) {
      const u = i / ribSteps;
      const rad = R_oculus + (R_drum - 0.14 - R_oculus) * Math.pow(Math.cos(u * Math.PI * 0.5), 0.86);
      const py = yDrumTop + domeRise * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
      let px = cx + Math.cos(ang) * rad;
      let pz = cz + Math.sin(ang) * rad;
      if (pz > southClampZ && Math.abs(px) < southClampHalfX) pz = southClampZ;
      pts.push({ x: px, y: py, z: pz });
    }
    const radialRib = createGothicRibGeometry(pts, {
      width: spec.ribThick,
      depth: spec.ribThick * 0.78,
      dropDir: (pt) => {
        const dx = cx - pt.x;
        const dz = cz - pt.z;
        const d = Math.hypot(dx, dz) || 1;
        return [(dx / d) * 0.58, -0.82, (dz / d) * 0.58];
      },
      tintR: 1.00,
      tintG: 1.02,
      tintB: 1.08
    });
    if (radialRib) ribParts.push(radialRib);

    const wallX = cx + Math.cos(ang) * (R_inner + 0.04);
    const wallZ = cz + Math.sin(ang) * (R_inner + 0.04);
    if (!(wallZ > spec.doorZ - 0.6 && Math.abs(wallX) < spec.doorHalfW + 1.0)) {
      ribParts.push(
        createWallCorbelGeometry(wallX, ySpring + 0.02, wallZ, -Math.cos(ang), -Math.sin(ang), 0.82, 0.68, 1.25)
      );
    }
  }

  // C. Concentric Cathedral Structural Rings (Lower Drum, Upper Drum, Mid-Dome Tierceron Purline, Oculus Ring)
  const midU = 0.48;
  const ringConfigs = [
    { r: R_inner - 0.02, y: ySpring + 0.06, w: 0.52, d: 0.40, segs: 32, clampSouth: true },
    { r: R_drum - 0.16, y: yDrumTop, w: 0.50, d: 0.38, segs: 32, clampSouth: true },
    {
      r: R_oculus + (R_drum - 0.14 - R_oculus) * Math.pow(Math.cos(midU * Math.PI * 0.5), 0.86),
      y: yDrumTop + domeRise * Math.pow(Math.sin(midU * Math.PI * 0.5), 0.78),
      w: 0.44,
      d: 0.34,
      segs: 32,
      clampSouth: false
    },
    { r: R_oculus, y: yOculus, w: 0.60, d: 0.46, segs: 24, clampSouth: false }
  ];

  for (const rc of ringConfigs) {
    const pts = [];
    for (let i = 0; i < rc.segs; i++) {
      const a = (i / rc.segs) * Math.PI * 2;
      let px = cx + Math.cos(a) * rc.r;
      let pz = cz + Math.sin(a) * rc.r;
      if (rc.clampSouth && pz > southClampZ && Math.abs(px) < southClampHalfX) pz = southClampZ;
      pts.push({ x: px, y: rc.y, z: pz });
    }
    const ringGeo = createGothicRibGeometry(pts, {
      width: rc.w,
      depth: rc.d,
      dropDir: (pt) => {
        const dx = cx - pt.x;
        const dz = cz - pt.z;
        const d = Math.hypot(dx, dz) || 1;
        return [(dx / d) * 0.45, -0.89, (dz / d) * 0.45];
      },
      closedLoop: true,
      tintR: 1.00,
      tintG: 1.02,
      tintB: 1.08
    });
    if (ringGeo) ribParts.push(ringGeo);
  }

  // D. 8 Unclipped Vertical Clerestory Drum Lancet Windows (flush inside drum y = 12.44..13.90!)
  for (let b = 0; b < bays; b += 2) {
    const midAng = baseAngOffset + (b + 0.5) * bayAng;
    const wx = cx + Math.cos(midAng) * (R_drum - 0.18);
    const wz = cz + Math.sin(midAng) * (R_drum - 0.18);
    // Skip South Boss Door bay
    if (Math.sin(midAng) > 0.78 && Math.abs(wx) < southDrumHalfX + 0.5) continue;
    appendClerestoryLancetWindow(glassParts, ribParts, windowRegistry, {
      id: `clerestory_boss_drum_${b}`,
      roomId: 'boss_hall',
      x: wx,
      yBot: Math.max(ySpring + 0.20, spec.wallHeight + 0.04),
      yTop: yDrumTop - 0.14,
      z: wz,
      width: 2.30,
      inwardNx: -Math.cos(midAng),
      inwardNz: -Math.sin(midAng),
      winKind: 0.0,
      addStoneFrame: true
    });
  }

  // E. Central Gothic Cathedral Lantern Cupola (8 Glowing Moonlit Lancet Windows + Star-Vault Capstone -> y=18.20!)
  const lBays = spec.lanternBays; // 8
  const lStep = (Math.PI * 2) / lBays;
  const lRadius = R_oculus;

  for (let i = 0; i < lBays; i++) {
    const pierAng = i * lStep;
    const winAng = pierAng + lStep * 0.5;
    const inNx = -Math.cos(winAng);
    const inNz = -Math.sin(winAng);

    const px = cx + Math.cos(pierAng) * (lRadius - 0.04);
    const pz = cz + Math.sin(pierAng) * (lRadius - 0.04);
    const pierPts = [
      { x: px, y: yOculus - 0.06, z: pz },
      { x: px, y: yLanternTop + 0.08, z: pz }
    ];
    const pierGeo = createGothicRibGeometry(pierPts, {
      width: 0.34,
      depth: 0.26,
      dropDir: [-Math.cos(pierAng), -0.18, -Math.sin(pierAng)],
      tintR: 0.96,
      tintG: 1.00,
      tintB: 1.12
    });
    if (pierGeo) ribParts.push(pierGeo);

    const chordW = 2.0 * (lRadius - 0.14) * Math.sin(lStep * 0.5) - 0.18;
    const wx = cx + Math.cos(winAng) * (lRadius - 0.08);
    const wz = cz + Math.sin(winAng) * (lRadius - 0.08);
    appendClerestoryLancetWindow(glassParts, ribParts, windowRegistry, {
      id: `boss_lantern_window_${i}`,
      roomId: 'boss_hall',
      x: wx,
      yBot: yOculus + 0.04,
      yTop: yLanternTop + 0.02,
      z: wz,
      width: chordW,
      inwardNx: inNx,
      inwardNz: inNz,
      winKind: 1.0,
      addStoneFrame: false
    });
  }

  // Lantern upper cornice ring
  const capRingPts = [];
  for (let i = 0; i < lBays; i++) {
    const a = i * lStep;
    capRingPts.push({
      x: cx + Math.cos(a) * (lRadius + 0.02),
      y: yLanternTop,
      z: cz + Math.sin(a) * (lRadius + 0.02)
    });
  }
  const lanternCrownRing = createGothicRibGeometry(capRingPts, {
    width: 0.38,
    depth: 0.28,
    dropDir: (pt) => [(cx - pt.x) * 0.45, -0.89, (cz - pt.z) * 0.45],
    closedLoop: true,
    tintR: 0.96,
    tintG: 1.02,
    tintB: 1.12
  });
  if (lanternCrownRing) ribParts.push(lanternCrownRing);

  // Solid inward-facing lantern spandrel drum backing (seals pointed arch corners behind lantern windows!)
  const drumRows = 2;
  const drumCols = lBays + 1;
  const drumVerts = new Array(drumRows * drumCols);
  for (let r = 0; r < drumRows; r++) {
    const vy = r === 0 ? (yOculus - 0.05) : (yLanternTop + 0.08);
    for (let c = 0; c < drumCols; c++) {
      const a = (c % lBays) * lStep;
      drumVerts[r * drumCols + c] = {
        x: cx + Math.cos(a) * (lRadius + 0.08),
        y: vy,
        z: cz + Math.sin(a) * (lRadius + 0.08),
        u: (c / lBays) * 4.5,
        v: r * 0.5,
        r: 0.72,
        g: 0.80,
        b: 0.96
      };
    }
  }
  shellParts.push(buildInwardGridGeometry(drumRows, drumCols, drumVerts, (mx, _my, mz) => [cx - mx, -0.15, cz - mz]));

  // Pointed Octagonal Star-Vault Lantern Capstone (y = 17.84 -> 18.20, FrontSide strictly DOWNWARD!)
  const capRows = 3;
  const capCols = lBays + 1;
  const capVerts = new Array(capRows * capCols);
  for (let r = 0; r < capRows; r++) {
    const f = r / (capRows - 1);
    const rad = (lRadius + 0.12) * (1.0 - f);
    const vy = yLanternTop + (yLanternApex - yLanternTop) * Math.sin(f * Math.PI * 0.5);
    for (let c = 0; c < capCols; c++) {
      const a = (c % lBays) * lStep;
      capVerts[r * capCols + c] = {
        x: cx + Math.cos(a) * rad,
        y: vy,
        z: cz + Math.sin(a) * rad,
        u: (Math.cos(a) * rad) / 2.4,
        v: (Math.sin(a) * rad) / 2.4,
        r: 0.80 + f * 0.18,
        g: 0.88 + f * 0.20,
        b: 1.04 + f * 0.22
      };
    }
  }
  shellParts.push(buildInwardGridGeometry(capRows, capCols, capVerts, () => [0, -1, 0]));

  // 8 Star-Vault Lantern Capstone Ribs + Royal Central Boss Keystone anchoring `chandelier_boss_center`!
  for (let i = 0; i < lBays; i++) {
    const a = i * lStep;
    const pts = [
      { x: cx + Math.cos(a) * lRadius, y: yLanternTop, z: cz + Math.sin(a) * lRadius },
      { x: cx + Math.cos(a) * (lRadius * 0.5), y: (yLanternTop + yLanternApex) * 0.5 + 0.08, z: cz + Math.sin(a) * (lRadius * 0.5) },
      { x: cx, y: yLanternApex, z: cz }
    ];
    const capRib = createGothicRibGeometry(pts, { width: 0.24, depth: 0.18, dropDir: [0, -1, 0] });
    if (capRib) ribParts.push(capRib);
  }
  ribParts.push(createGothicKeystoneGeometry(cx, yLanternApex, cz, 1.45));

  // F. Watertight South Boss Portal Tympanum Wall (Boss Hall side, z = -16.05, normal -Z facing Boss Hall)
  const bossPortalTopFn = (x) => {
    const dist = Math.hypot(x - cx, southClampZ - cz);
    const cosTerm = clamp01((dist - R_oculus) / (R_drum - R_oculus));
    const u = Math.acos(Math.pow(cosTerm, 1.0 / 0.86)) / (Math.PI * 0.5);
    return yDrumTop + domeRise * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78) + 0.30;
  };
  const bossPortalBotFn = (x) => (Math.abs(x) < spec.doorHalfW + 0.10 ? gothicBossDoorArchY(x) : 8.40);
  const tympHalfX = Math.max(6.25, southDrumHalfX);
  shellParts.push(buildGableTympanumZ(southClampZ, -tympHalfX, tympHalfX, bossPortalBotFn, bossPortalTopFn, -1, 22, 3.2));

  // Triumphal Gothic Stone Arch Framing the Boss Portal Tympanum on the Throne Hall Side
  const portalFramePts = [];
  for (let i = 0; i <= 16; i++) {
    const x = -tympHalfX + 0.20 + ((tympHalfX * 2 - 0.40) * i) / 16;
    portalFramePts.push({ x, y: bossPortalTopFn(x) - 0.18, z: southClampZ - 0.06 });
  }
  const portalArchRib = createGothicRibGeometry(portalFramePts, {
    width: 0.56,
    depth: 0.44,
    dropDir: [0, -0.78, -0.62]
  });
  if (portalArchRib) ribParts.push(portalArchRib);
}

// ============================================================================
// 5. Wrought-Iron Gothic Corona Lucis Chandeliers + GPU Pendulum Sway + Flames
// ============================================================================
function tagChandelierPart(rawGeo, pivotX, pivotY, pivotZ, phase) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  rawGeo.dispose();
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      g.deleteAttribute(attrName);
    }
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const count = g.attributes.position.count;
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  const pivotAttr = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pivotAttr[i * 4] = pivotX;
    pivotAttr[i * 4 + 1] = pivotY;
    pivotAttr[i * 4 + 2] = pivotZ;
    pivotAttr[i * 4 + 3] = phase;
  }
  g.setAttribute('aPivotPhase', new THREE.BufferAttribute(pivotAttr, 4));
  return g;
}

function appendChandelierTier(ironParts, flameSpecs, cfg, tierRadius, tierY, cupCount, isUpperTier = false) {
  const { x, z, pivotY, phase } = cfg;
  const push = (geo) => ironParts.push(tagChandelierPart(geo, x, pivotY, z, phase));

  const ringSegs = Math.max(8, cupCount);
  const bandH = isUpperTier ? 0.18 : (cfg.doubleTier ? 0.28 : 0.22);
  const bandThick = isUpperTier ? 0.055 : 0.075;

  for (let i = 0; i < ringSegs; i++) {
    const a0 = (i / ringSegs) * Math.PI * 2;
    const a1 = ((i + 1) / ringSegs) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    const x0 = x + Math.cos(a0) * tierRadius;
    const z0 = z + Math.sin(a0) * tierRadius;
    const x1 = x + Math.cos(a1) * tierRadius;
    const z1 = z + Math.sin(a1) * tierRadius;
    const chord = Math.hypot(x1 - x0, z1 - z0) + 0.04;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const rotY = -Math.atan2(z1 - z0, x1 - x0);

    push(placeGeo(new THREE.BoxGeometry(chord, bandH, bandThick), mx, tierY, mz, 0, rotY, 0));
    push(placeGeo(new THREE.BoxGeometry(chord + 0.02, 0.042, bandThick + 0.042), mx, tierY + bandH * 0.46, mz, 0, rotY, 0));
    push(placeGeo(new THREE.BoxGeometry(chord + 0.02, 0.042, bandThick + 0.042), mx, tierY - bandH * 0.46, mz, 0, rotY, 0));

    const sx = x + Math.cos(a0) * tierRadius;
    const sz = z + Math.sin(a0) * tierRadius;
    push(placeGeo(new THREE.ConeGeometry(0.052, 0.26, 4), sx, tierY + bandH * 0.5 + 0.12, sz, 0, -a0 + Math.PI * 0.25, 0));

    const cupR = tierRadius + 0.16;
    const cx = x + Math.cos(am) * cupR;
    const cz = z + Math.sin(am) * cupR;
    const bracketX = x + Math.cos(am) * (tierRadius + 0.09);
    const bracketZ = z + Math.sin(am) * (tierRadius + 0.09);
    push(placeGeo(new THREE.BoxGeometry(0.18, 0.042, 0.05), bracketX, tierY - 0.02, bracketZ, 0, -am, 0));
    push(placeGeo(new THREE.CylinderGeometry(0.12, 0.08, 0.045, 6), cx, tierY + 0.04, cz));
    push(placeGeo(new THREE.CylinderGeometry(0.085, 0.055, 0.13, 6), cx, tierY + 0.12, cz));

    flameSpecs.push({
      x: cx,
      y: tierY + 0.29,
      z: cz,
      pivotX: x,
      pivotY,
      pivotZ: z,
      phase,
      flickerPhase: i * 1.73 + phase * 3.1 + (isUpperTier ? 4.2 : 0),
      scale: cfg.doubleTier ? (isUpperTier ? 0.34 : 0.42) : 0.32
    });
  }

  const spokeCount = cfg.doubleTier ? (isUpperTier ? 4 : 6) : 4;
  const collarY = Math.min(pivotY - 0.55, tierY + (cfg.doubleTier ? (isUpperTier ? 1.45 : 2.10) : 1.30));
  for (let s = 0; s < spokeCount; s++) {
    const a = (s / spokeCount) * Math.PI * 2 + (isUpperTier ? Math.PI * 0.25 : 0);
    const midR = tierRadius * 0.5;
    push(
      placeGeo(
        new THREE.BoxGeometry(tierRadius, 0.05, 0.05),
        x + Math.cos(a) * midR,
        tierY,
        z + Math.sin(a) * midR,
        0,
        -a,
        0
      )
    );
    const rimX = x + Math.cos(a) * (tierRadius - 0.06);
    const rimZ = z + Math.sin(a) * (tierRadius - 0.06);
    const dy = Math.max(0.3, collarY - tierY);
    const strutLen = Math.hypot(tierRadius - 0.12, dy);
    const tiltAng = Math.atan2(tierRadius - 0.12, dy);
    const mx = (rimX + x) * 0.5;
    const my = (tierY + collarY) * 0.5;
    const mz = (rimZ + z) * 0.5;
    const strut = new THREE.CylinderGeometry(0.026, 0.026, strutLen, 5);
    strut.rotateZ(tiltAng);
    strut.rotateY(-a);
    strut.translate(mx, my, mz);
    push(strut);
  }
}

function appendGothicChandelier(ironParts, flameSpecs, ribParts, cfg, isMobile) {
  const { x, z, pivotY, wheelY, radius, cupCount, phase, doubleTier } = cfg;
  const push = (geo) => ironParts.push(tagChandelierPart(geo, x, pivotY, z, phase));

  // Carved stone ceiling anchor rosette boss on the vault/dome so every suspension chain bolts into stone!
  if (cfg.id !== 'chandelier_boss_center') {
    ribParts.push(createGothicKeystoneGeometry(x, pivotY + 0.04, z, doubleTier ? 0.95 : 0.78));
  }

  // 1. Heavy Ceiling Iron Anchor Rosette & Shackle Collar bolted to keystone
  push(placeGeo(new THREE.CylinderGeometry(0.24, 0.18, 0.16, 8), x, pivotY - 0.18, z));
  push(placeGeo(new THREE.TorusGeometry(0.11, 0.032, 4, 8), x, pivotY - 0.30, z));

  // 2. Heavy Forged Iron Vertical Suspension Chain descending from ceiling boss to upper hub collar
  const hubCollarY = Math.min(pivotY - 0.55, doubleTier ? (cfg.upperY + 1.45) : (wheelY + 1.30));
  const chainTopY = pivotY - 0.34;
  const chainLen = Math.max(0.35, chainTopY - hubCollarY);
  const linkStep = isMobile ? 0.38 : 0.27;
  const linkCount = Math.max(2, Math.floor(chainLen / linkStep));
  const actualStep = chainLen / linkCount;

  push(placeGeo(new THREE.CylinderGeometry(0.028, 0.028, chainLen + 0.1, 5), x, (chainTopY + hubCollarY) * 0.5, z));
  for (let i = 0; i < linkCount; i++) {
    const ly = chainTopY - (i + 0.5) * actualStep;
    const rotY = (i % 2) * (Math.PI * 0.5);
    const link = new THREE.TorusGeometry(0.085, 0.026, 4, 6);
    link.scale(0.68, 1.35, 1.0);
    link.rotateY(rotY);
    link.translate(x, ly, z);
    push(link);
  }

  // 3. Central Forged Iron Hub Shaft, Flared Crowns & Hanging Gothic Plumb Finial
  const shaftBotY = wheelY - 0.46;
  const shaftH = Math.max(0.5, hubCollarY - shaftBotY);
  push(placeGeo(new THREE.CylinderGeometry(0.065, 0.085, shaftH, 6), x, (hubCollarY + shaftBotY) * 0.5, z));
  push(placeGeo(new THREE.CylinderGeometry(0.22, 0.14, 0.22, 8), x, hubCollarY, z));
  push(placeGeo(new THREE.CylinderGeometry(0.24, 0.28, 0.24, 8), x, wheelY, z));
  push(placeGeo(new THREE.ConeGeometry(0.15, 0.52, 6), x, wheelY - 0.68, z, Math.PI, 0, 0));

  // 4. Primary Lower Iron Wheel Tier (+ Upper Royal Crown Tier when tierCount >= 2!)
  appendChandelierTier(ironParts, flameSpecs, cfg, radius, wheelY, cupCount, false);
  if (doubleTier) {
    appendChandelierTier(ironParts, flameSpecs, cfg, cfg.upperRadius, cfg.upperY, cfg.upperCupCount, true);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
      const lx = x + Math.cos(a) * (cfg.upperRadius + 0.22);
      const lz = z + Math.sin(a) * (cfg.upperRadius + 0.22);
      const dy = cfg.upperY - wheelY;
      push(placeGeo(new THREE.CylinderGeometry(0.03, 0.03, dy, 5), lx, (wheelY + cfg.upperY) * 0.5, lz));
    }
  }
}

// Build 1 merged billboarded BufferGeometry for ALL chandelier candle/fire flames
function buildChandelierFlamesGeometry(flameSpecs) {
  const count = flameSpecs.length;
  const positions = new Float32Array(count * 4 * 3);
  const quadOffsets = new Float32Array(count * 4 * 2);
  const uvs = new Float32Array(count * 4 * 2);
  const pivotPhases = new Float32Array(count * 4 * 4);
  const flameParams = new Float32Array(count * 4 * 2); // [flickerPhase, scale]
  const indices = new Uint16Array(count * 6);

  const corners = [
    [-0.5, -0.15, 0, 0],
    [ 0.5, -0.15, 1, 0],
    [ 0.5,  1.05, 1, 1],
    [-0.5,  1.05, 0, 1]
  ];

  for (let i = 0; i < count; i++) {
    const f = flameSpecs[i];
    const vBase = i * 4;
    for (let c = 0; c < 4; c++) {
      const vi = vBase + c;
      positions[vi * 3] = f.x;
      positions[vi * 3 + 1] = f.y;
      positions[vi * 3 + 2] = f.z;
      quadOffsets[vi * 2] = corners[c][0];
      quadOffsets[vi * 2 + 1] = corners[c][1];
      uvs[vi * 2] = corners[c][2];
      uvs[vi * 2 + 1] = corners[c][3];
      pivotPhases[vi * 4] = f.pivotX;
      pivotPhases[vi * 4 + 1] = f.pivotY;
      pivotPhases[vi * 4 + 2] = f.pivotZ;
      pivotPhases[vi * 4 + 3] = f.phase;
      flameParams[vi * 2] = f.flickerPhase;
      flameParams[vi * 2 + 1] = f.scale;
    }
    const iBase = i * 6;
    indices[iBase] = vBase;
    indices[iBase + 1] = vBase + 1;
    indices[iBase + 2] = vBase + 2;
    indices[iBase + 3] = vBase;
    indices[iBase + 4] = vBase + 2;
    indices[iBase + 5] = vBase + 3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aQuadOffset', new THREE.BufferAttribute(quadOffsets, 2));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aPivotPhase', new THREE.BufferAttribute(pivotPhases, 4));
  geo.setAttribute('aFlameParam', new THREE.BufferAttribute(flameParams, 2));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

// ============================================================================
// 6. Main Factory: createSoulsCastleRoof(options)
// ============================================================================
/**
 * Builds the complete enclosed Gothic vaulted roof, cathedral dome, clerestory lancet windows,
 * and gently swaying wrought-iron chandeliers for the Chapter 26 Castle Arena (5 DC PC/Mobile, 4 DC LowSpec).
 * Synchronized 100% directly with `SOULS_CASTLE_CONSTANTS`, `SOULS_CASTLE_ROOMS`,
 * `SOULS_CASTLE_VAULTS`, and `SOULS_CASTLE_CHANDELIERS` from `soulsCastleLayout.js`.
 *
 * @param {object} [options]
 * @param {THREE.MeshStandardMaterial} [options.darkStoneMat]  Shared ashlar stone material from soulsArena.js
 * @param {THREE.MeshStandardMaterial} [options.trimStoneMat]  Shared carved trim stone material from soulsArena.js
 * @param {THREE.MeshStandardMaterial} [options.ironMat]       Shared wrought-iron material from soulsArena.js
 * @param {object} [options.pbr]                               Optional PBR suite from soulsPbrTextures.js
 * @param {THREE.Texture} [options.vaultStoneAlbedo]           Optional explicit vaulted stone albedo map
 * @param {THREE.Texture} [options.vaultStoneNormal]           Optional explicit vaulted stone normal map
 * @param {boolean} [options.isMobile=false]                   Mobile tessellation preset
 * @param {boolean} [options.lowSpec=false]                    Low-spec mode (drops normalMaps & chandelier flames -> 4 DC)
 * @param {boolean} [options.enableChandelierFlames=true]      Enable flickering flames on chandelier cups
 */
export function createSoulsCastleRoof(options = {}) {
  const isMobile = Boolean(options.isMobile);
  let lowSpecMode = Boolean(options.lowSpec);
  const enableChandelierFlames = options.enableChandelierFlames !== false;

  const group = new THREE.Group();
  group.name = 'SoulsCastleVaultedRoof';

  const ownedGeos = [];
  const ownedMats = [];
  const trackGeo = (g) => {
    if (g) ownedGeos.push(g);
    return g;
  };
  const trackMat = (m) => {
    if (m) ownedMats.push(m);
    return m;
  };

  // ==========================================================================
  // A. Owned Derived PBR Materials (Shares caller textures, NEVER disposes them!)
  // ==========================================================================
  const srcDark = options.darkStoneMat || null;
  const srcTrim = options.trimStoneMat || null;
  const srcIron = options.ironMat || null;
  const pbr = options.pbr || null;

  const vaultAlbedoMap = options.vaultStoneAlbedo || pbr?.vaultStoneAlbedo || srcDark?.map || pbr?.ashlarAlbedo || null;
  const vaultNormalMap = options.vaultStoneNormal || pbr?.vaultStoneNormal || srcDark?.normalMap || pbr?.ashlarNormal || null;
  const vaultRoughMap = srcDark?.roughnessMap || pbr?.ashlarRoughness || null;
  const baseNormalScale = isMobile ? 1.05 : 1.35;

  // DC #1 Material: Carved Gothic Vaulted Ceiling Stone (STRICT THREE.FrontSide!)
  const vaultShellMat = trackMat(new THREE.MeshStandardMaterial({
    map: vaultAlbedoMap,
    normalMap: lowSpecMode ? null : vaultNormalMap,
    normalScale: new THREE.Vector2(baseNormalScale, baseNormalScale),
    roughnessMap: vaultRoughMap,
    color: 0xa2acc8,
    emissive: new THREE.Color(0x2d3c5c),
    emissiveMap: vaultAlbedoMap,
    emissiveIntensity: 0.72,
    roughness: 0.94,
    metalness: 0.08,
    vertexColors: true,
    side: THREE.FrontSide
  }));

  // DC #2 Material: Carved Limestone Gothic Vault Ribs, Arches, Keystones & Cornices (STRICT THREE.FrontSide!)
  const ribAlbedoMap = srcTrim?.map || pbr?.ashlarAlbedo || vaultAlbedoMap;
  const ribNormalMap = srcTrim?.normalMap || pbr?.ashlarNormal || vaultNormalMap;
  const ribRoughMap = srcTrim?.roughnessMap || pbr?.ashlarRoughness || vaultRoughMap;

  const vaultRibsMat = trackMat(new THREE.MeshStandardMaterial({
    map: ribAlbedoMap,
    normalMap: lowSpecMode ? null : ribNormalMap,
    normalScale: new THREE.Vector2(baseNormalScale * 0.92, baseNormalScale * 0.92),
    roughnessMap: ribRoughMap,
    color: 0xc2cae2,
    emissive: new THREE.Color(0x26324a),
    emissiveMap: ribAlbedoMap,
    emissiveIntensity: 0.48,
    roughness: 0.90,
    metalness: 0.11,
    vertexColors: true,
    side: THREE.FrontSide
  }));

  // DC #3 Material: Procedural Moonlit Clerestory Stained-Glass + Gothic Lead Tracery (STRICT THREE.FrontSide!)
  const glassUniforms = {
    uTime: { value: 0 },
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 },
    uCamPos: { value: new THREE.Vector3(0, 3.5, SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_Z - 8.0) }
  };
  const clerestoryGlassMat = trackMat(new THREE.ShaderMaterial({
    uniforms: glassUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    vertexShader: `
      attribute float aWinKind;
      varying vec2 vUv;
      varying float vKind;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vKind = aWinKind;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      uniform vec3 uCamPos;
      varying vec2 vUv;
      varying float vKind;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec2 uv = vUv;
        float cx = abs(uv.x - 0.5) * 2.0;

        float outerLead = smoothstep(0.91, 0.96, cx) + smoothstep(0.04, 0.0, uv.y) + smoothstep(0.95, 0.99, uv.y);
        float centerBar = 1.0 - smoothstep(0.022, 0.042, abs(uv.x - 0.5));
        float hBar1 = 1.0 - smoothstep(0.012, 0.024, abs(uv.y - 0.30));
        float hBar2 = 1.0 - smoothstep(0.012, 0.024, abs(uv.y - 0.60));

        vec2 roseDelta = vec2((uv.x - 0.5) * 1.35, (uv.y - 0.77) * 2.05);
        float roseDist = length(roseDelta);
        float roseRing = 1.0 - smoothstep(0.025, 0.055, abs(roseDist - 0.24));
        float roseCore = 1.0 - smoothstep(0.05, 0.09, roseDist);

        float d1 = abs(fract(uv.x * 5.0 + uv.y * 8.0) - 0.5);
        float d2 = abs(fract(uv.x * 5.0 - uv.y * 8.0) - 0.5);
        float diamondLead = (1.0 - smoothstep(0.028, 0.058, d1)) + (1.0 - smoothstep(0.028, 0.058, d2));

        float leadMask = clamp(outerLead + centerBar + hBar1 + hBar2 + roseRing + roseCore * 0.6 + diamondLead * 0.58, 0.0, 1.0);

        float vGrad = smoothstep(0.0, 0.85, uv.y);
        float archCore = 1.0 - smoothstep(0.0, 0.92, cx * 0.72 + abs(uv.y - 0.62) * 0.55);
        vec3 deepLunar = vec3(0.20, 0.33, 0.56);
        vec3 paleLunar = vec3(0.54, 0.75, 1.00);
        vec3 moonHeart = vec3(0.76, 0.89, 1.00);

        vec3 glassCol = mix(deepLunar, paleLunar, vGrad * 0.65 + archCore * 0.35);
        glassCol = mix(glassCol, moonHeart, archCore * (0.28 + 0.34 * vKind));

        if (uLowSpec < 0.5) {
          float cloudWave = 0.88 + 0.12 * sin(uv.x * 4.2 + uTime * 0.24 + vWorldPos.z * 0.15)
                                       * cos(uv.y * 3.1 - uTime * 0.18 + vWorldPos.x * 0.12);
          vec3 viewDir = normalize(uCamPos - vWorldPos);
          float fresnel = pow(1.0 - max(0.0, dot(normalize(vWorldNormal), viewDir)), 2.0);
          glassCol *= cloudWave * (1.0 + fresnel * 0.26);
        }

        glassCol *= (1.0 + 0.34 * vKind);

        vec3 leadCol = vec3(0.032, 0.038, 0.054);
        vec3 finalCol = mix(glassCol, leadCol, leadMask);

        float camDist = length(uCamPos - vWorldPos);
        float fogAmt = smoothstep(30.0, 108.0, camDist) * 0.52;
        finalCol = mix(finalCol, vec3(0.055, 0.070, 0.112), fogAmt);

        float alpha = mix(0.82 + 0.10 * vKind, 0.96, leadMask);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `
  }));

  // DC #4 Material: Forged Wrought-Iron Chandeliers w/ Rigid-Body GPU Pendulum Sway around each Ceiling Anchor!
  const ironNormalMap = srcIron?.normalMap || pbr?.ironNormal || null;
  const ironRoughMap = srcIron?.roughnessMap || pbr?.ironRoughness || null;
  const chandelierSwayUniforms = {
    uTime: { value: 0 },
    uSwayAmp: { value: lowSpecMode ? 0.45 : 1.0 }
  };

  const chandeliersIronMat = trackMat(new THREE.MeshStandardMaterial({
    normalMap: lowSpecMode ? null : ironNormalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: ironRoughMap,
    color: srcIron?.color ? srcIron.color.clone() : new THREE.Color(0x2d323e),
    emissive: new THREE.Color(0x24160c),
    emissiveIntensity: 0.28,
    roughness: 0.86,
    metalness: 0.86,
    side: THREE.FrontSide
  }));
  chandeliersIronMat.customProgramCacheKey = () => 'souls_chandelier_pendulum_v2';
  chandeliersIronMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = chandelierSwayUniforms.uTime;
    shader.uniforms.uSwayAmp = chandelierSwayUniforms.uSwayAmp;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aPivotPhase;
        uniform float uTime;
        uniform float uSwayAmp;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 chRel = transformed - aPivotPhase.xyz;
        float chAmp = uSwayAmp * step(0.01, -chRel.y);
        float chAx = sin(uTime * 0.66 + aPivotPhase.w) * 0.016 * chAmp;
        float chAz = cos(uTime * 0.54 + aPivotPhase.w * 1.41) * 0.013 * chAmp;
        float chCx = cos(chAx), chSx = sin(chAx);
        float chCz = cos(chAz), chSz = sin(chAz);
        vec3 chR1 = vec3(chRel.x * chCz - chRel.y * chSz, chRel.x * chSz + chRel.y * chCz, chRel.z);
        vec3 chR2 = vec3(chR1.x, chR1.y * chCx - chR1.z * chSx, chR1.y * chSx + chR1.z * chCx);
        transformed = aPivotPhase.xyz + chR2;`
      );
  };

  // DC #5 Material: GPU Billboarded Flickering Candle/Oil Flames locked bit-for-bit to Chandelier Pendulum Sway!
  const flameUniforms = {
    uTime: { value: 0 },
    uSwayAmp: chandelierSwayUniforms.uSwayAmp
  };
  const chandelierFlamesMat = trackMat(new THREE.ShaderMaterial({
    uniforms: flameUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: `
      attribute vec2 aQuadOffset;
      attribute vec4 aPivotPhase;
      attribute vec2 aFlameParam;
      uniform float uTime;
      uniform float uSwayAmp;
      varying vec2 vUv;
      varying float vFlicker;
      void main() {
        vUv = uv;
        float fPhase = aFlameParam.x;
        float fScale = aFlameParam.y;
        float flick = 0.88 + 0.12 * sin(uTime * 9.5 + fPhase) + 0.07 * sin(uTime * 17.2 + fPhase * 1.7);
        vFlicker = flick;

        vec3 rel = position - aPivotPhase.xyz;
        float amp = uSwayAmp * step(0.01, -rel.y);
        float ax = sin(uTime * 0.66 + aPivotPhase.w) * 0.016 * amp;
        float az = cos(uTime * 0.54 + aPivotPhase.w * 1.41) * 0.013 * amp;
        float cx = cos(ax), sx = sin(ax);
        float cz = cos(az), sz = sin(az);
        vec3 r1 = vec3(rel.x * cz - rel.y * sz, rel.x * sz + rel.y * cz, rel.z);
        vec3 r2 = vec3(r1.x, r1.y * cx - r1.z * sx, r1.y * sx + r1.z * cx);
        vec3 worldCenter = aPivotPhase.xyz + r2;

        vec4 mvCenter = modelViewMatrix * vec4(worldCenter, 1.0);
        float wSize = fScale * (0.94 + 0.10 * flick);
        float hSize = fScale * 1.48 * flick;
        float tipSway = sin(uTime * 11.0 + fPhase) * 0.08 * max(0.0, uv.y);
        mvCenter.x += (aQuadOffset.x + tipSway) * wSize;
        mvCenter.y += aQuadOffset.y * hSize;
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vFlicker;
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
        float widthAtY = mix(0.68, 0.05, pow(clamp(p.y, 0.0, 1.0), 0.72));
        float dx = abs(p.x) / max(0.04, widthAtY);
        float flameBody = smoothstep(1.0, 0.15, dx) * smoothstep(0.0, 0.14, p.y) * smoothstep(1.0, 0.42, p.y);
        float innerCore = smoothstep(0.62, 0.05, length(vec2(p.x * 1.6, (p.y - 0.24) * 2.1)));
        float halo = smoothstep(0.95, 0.05, length(vec2(p.x * 0.92, (p.y - 0.34) * 1.12))) * 0.32;

        float intensity = clamp(flameBody * 0.92 + innerCore * 0.85 + halo, 0.0, 1.0);
        if (intensity < 0.015) discard;

        vec3 outerOrange = vec3(1.00, 0.38, 0.06);
        vec3 midGold = vec3(1.00, 0.72, 0.22);
        vec3 hotCore = vec3(1.00, 0.96, 0.78);
        vec3 col = mix(outerOrange, midGold, clamp(flameBody, 0.0, 1.0));
        col = mix(col, hotCore, clamp(innerCore, 0.0, 1.0));
        gl_FragColor = vec4(col * vFlicker, intensity * 0.92);
      }
    `
  }));

  const normalMappedMats = [
    { mat: vaultShellMat, map: vaultNormalMap },
    { mat: vaultRibsMat, map: ribNormalMap },
    { mat: chandeliersIronMat, map: ironNormalMap }
  ];

  // ==========================================================================
  // B. Assemble All Architectural Roof Buckets from SOULS_CASTLE_ROOF_SPEC
  // ==========================================================================
  const shellParts = [];
  const ribParts = [];
  const glassParts = [];
  const windowRegistry = [];

  const segU = isMobile ? 4 : 6;
  const segT = isMobile ? 3 : 5;

  // --------------------------------------------------------------------------
  // 1. BONFIRE HALL (`courtyard`, x in [-9, +9], z in [20, 38], 3 Groin Bays -> apexY = 11.4)
  // --------------------------------------------------------------------------
  const cy = SOULS_CASTLE_ROOF_SPEC.courtyard;
  const cyHalfInnerX = (cy.maxX - cy.minX) * 0.5; // 9.0
  const cyHx = cyHalfInnerX + cy.wallOverlapX;    // 9.38

  for (let b = 0; b < cy.baysZ.length - 1; b++) {
    const z0 = cy.baysZ[b];
    const z1 = cy.baysZ[b + 1];
    const cz = (z0 + z1) * 0.5;
    const hz = (z1 - z0) * 0.5;
    buildGroinVaultBay({
      roomId: 'courtyard',
      bayIndex: b,
      cx: 0,
      cz,
      hx: cyHx,
      hz,
      innerHalfX: cyHalfInnerX,
      innerHalfZ: hz,
      ySpring: cy.springY,
      yApex: cy.apexY,
      lunetteRise: cy.lunetteRise,
      transRise: cy.transRise,
      ribThick: cy.ribThick,
      wallHeight: cy.wallHeight,
      segU,
      segT,
      shellParts,
      ribParts,
      glassParts,
      windowRegistry,
      addWestLunette: true,
      addEastLunette: true,
      addWestWindow: true,
      addEastWindow: true,
      windowWidth: 1.90,
      includeKeystone: true,
      keystoneScale: b === 1 ? 1.24 : 1.08
    });
  }

  // Sculpted stone Bonfire smoke-oculus crown ring on the vaulted ceiling above the Bonfire!
  if (cy.oculus) {
    const ocR = Math.min(2.15, cy.oculus.radius * 0.85);
    const ocY = evaluateExactRoofHeight('courtyard', cy.oculus.x, cy.oculus.z) - 0.14;
    const ocPts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ocPts.push({
        x: cy.oculus.x + Math.cos(a) * ocR,
        y: ocY,
        z: cy.oculus.z + Math.sin(a) * ocR
      });
    }
    const ocRing = createGothicRibGeometry(ocPts, {
      width: 0.36,
      depth: 0.28,
      dropDir: [0, -1, 0],
      closedLoop: true,
      tintR: 0.96,
      tintG: 0.98,
      tintB: 1.04
    });
    if (ocRing) ribParts.push(ocRing);
  }

  // Courtyard Transverse Pointed Arches + Wall Springer Corbels + Perimeter Cornices
  const co = SOULS_CASTLE_ROOF_SPEC.corridor;
  const coHalfInnerX = (co.maxX - co.minX) * 0.5; // 5.0
  const coHx = coHalfInnerX + co.wallOverlapX;    // 5.38

  for (let i = 0; i < cy.baysZ.length; i++) {
    const bz = Math.max(cy.minZ + 0.04, Math.min(cy.maxZ - 0.04, cy.baysZ[i]));
    appendTransverseArchRib(ribParts, 0, cyHalfInnerX, cyHx, bz, cy.springY, cy.transRise, 0.56, 0.42, isMobile ? 10 : 14);
    ribParts.push(createWallCorbelGeometry(-cyHalfInnerX, cy.springY + 0.04, bz, 1, 0, 0.72, 0.56, 1.08));
    ribParts.push(createWallCorbelGeometry(cyHalfInnerX, cy.springY + 0.04, bz, -1, 0, 0.72, 0.56, 1.08));
  }
  ribParts.push(createWallCorniceGeometry(-cyHalfInnerX, cy.minZ, -cyHalfInnerX, cy.maxZ, cy.springY + 0.06, 1, 0, 0.44, 0.36));
  ribParts.push(createWallCorniceGeometry(cyHalfInnerX, cy.minZ, cyHalfInnerX, cy.maxZ, cy.springY + 0.06, -1, 0, 0.44, 0.36));
  ribParts.push(createWallCorniceGeometry(-cyHalfInnerX, cy.maxZ, cyHalfInnerX, cy.maxZ, cy.springY + 0.06, 0, -1, 0.44, 0.36));
  ribParts.push(createWallCorniceGeometry(-cyHalfInnerX, cy.minZ, -coHalfInnerX, cy.minZ, cy.springY + 0.06, 0, 1, 0.44, 0.36));
  ribParts.push(createWallCorniceGeometry(coHalfInnerX, cy.minZ, cyHalfInnerX, cy.minZ, cy.springY + 0.06, 0, 1, 0.44, 0.36));

  // Watertight South Gable Tympanum (z = 38.02, normal -Z) + Monumental Triple-Lancet South Cathedral Window
  const cyArchTopFn = (x) => cy.springY + cy.transRise * gothicOgive(Math.abs(x) / cyHx, 0.48) + 0.08;
  shellParts.push(buildGableTympanumZ(cy.maxZ + 0.02, -cyHx, cyHx, () => cy.springY - 0.16, cyArchTopFn, -1, 18, 3.2));
  appendClerestoryLancetWindow(glassParts, ribParts, windowRegistry, {
    id: 'clerestory_courtyard_south_center',
    roomId: 'courtyard',
    x: 0.0,
    yBot: cy.wallHeight + 0.08,
    yTop: cy.springY + cy.transRise - 0.22,
    z: cy.maxZ,
    width: 2.15,
    inwardNx: 0,
    inwardNz: -1,
    winKind: 0.0,
    addStoneFrame: true
  });
  for (const sx of [-2.60, 2.60]) {
    appendClerestoryLancetWindow(glassParts, ribParts, windowRegistry, {
      id: `clerestory_courtyard_south_${sx < 0 ? 'w' : 'e'}`,
      roomId: 'courtyard',
      x: sx,
      yBot: cy.wallHeight + 0.08,
      yTop: cy.springY + cy.transRise * 0.72,
      z: cy.maxZ,
      width: 1.32,
      inwardNx: 0,
      inwardNz: -1,
      winKind: 0.0,
      addStoneFrame: true
    });
  }

  // Watertight North Transition Tympanum (z = 19.98, normal +Z facing Courtyard)
  const coArchTopFn = (x) => co.springY + co.transRise * gothicOgive(Math.abs(x) / coHx, 0.48) + 0.06;
  const cyNorthBotFn = (x) => {
    if (Math.abs(x) < coHalfInnerX + 0.02) {
      return coArchTopFn(x) - 0.12;
    }
    return cy.springY - 0.16;
  };
  shellParts.push(buildGableTympanumZ(cy.minZ - 0.02, -cyHx, cyHx, cyNorthBotFn, cyArchTopFn, +1, 22, 3.2));

  // --------------------------------------------------------------------------
  // 2. GRAND 36m CASTLE CORRIDOR (`corridor`, x in [-5, +5], z in [-16, 20], 6 Groin Bays -> apexY = 10.2)
  // --------------------------------------------------------------------------
  for (let b = 0; b < co.baysZ.length - 1; b++) {
    const z0 = co.baysZ[b];
    const z1 = co.baysZ[b + 1];
    const cz = (z0 + z1) * 0.5;
    const hz = (z1 - z0) * 0.5;
    buildGroinVaultBay({
      roomId: 'corridor',
      bayIndex: b,
      cx: 0,
      cz,
      hx: coHx,
      hz,
      innerHalfX: coHalfInnerX,
      innerHalfZ: hz,
      ySpring: co.springY,
      yApex: co.apexY,
      lunetteRise: co.lunetteRise,
      transRise: co.transRise,
      ribThick: co.ribThick,
      wallHeight: co.wallHeight,
      segU,
      segT,
      shellParts,
      ribParts,
      glassParts,
      windowRegistry,
      addWestLunette: true,
      addEastLunette: true,
      addWestWindow: true,
      addEastWindow: true,
      windowWidth: 1.50,
      includeKeystone: true,
      keystoneScale: 0.94
    });
  }

  // Corridor Transverse Pointed Arches, Corbels & Perimeter Cornices along full 36m span
  for (let i = 0; i < co.baysZ.length; i++) {
    const bz = Math.max(co.minZ + 0.08, Math.min(co.maxZ - 0.04, co.baysZ[i]));
    appendTransverseArchRib(ribParts, 0, coHalfInnerX, coHx, bz, co.springY, co.transRise, 0.48, 0.36, isMobile ? 9 : 12);
    ribParts.push(createWallCorbelGeometry(-coHalfInnerX, co.springY + 0.04, bz, 1, 0, 0.58, 0.44, 0.88));
    ribParts.push(createWallCorbelGeometry(coHalfInnerX, co.springY + 0.04, bz, -1, 0, 0.58, 0.44, 0.88));
  }
  ribParts.push(createWallCorniceGeometry(-coHalfInnerX, co.minZ, -coHalfInnerX, co.maxZ, co.springY + 0.05, 1, 0, 0.38, 0.30));
  ribParts.push(createWallCorniceGeometry(coHalfInnerX, co.minZ, coHalfInnerX, co.maxZ, co.springY + 0.05, -1, 0, 0.38, 0.30));

  // Watertight Corridor North End Tympanum above Boss Doors (z = -15.95, normal +Z facing Corridor)
  const bossHalfW = SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W + 0.10;
  const coNorthBotFn = (x) => (Math.abs(x) < bossHalfW ? gothicBossDoorArchY(x) : co.springY - 0.16);
  shellParts.push(buildGableTympanumZ(co.minZ + 0.05, -coHx, coHx, coNorthBotFn, coArchTopFn, +1, 20, 3.2));

  // --------------------------------------------------------------------------
  // 3. EAST ALCOVE CHAPEL (`east_alcove`, x in [5.8, 13.8], z in [-5, 4] -> apexY = 8.9)
  // --------------------------------------------------------------------------
  const ea = SOULS_CASTLE_ROOF_SPEC.eastAlcove;
  const eaCx = (ea.minX + ea.maxX) * 0.5;      // 9.8
  const eaCz = (ea.minZ + ea.maxZ) * 0.5;      // -0.5
  const eaInnerHx = (ea.maxX - ea.minX) * 0.5; // 4.0
  const eaInnerHz = (ea.maxZ - ea.minZ) * 0.5; // 4.5
  const eaHx = eaInnerHx + ea.wallOverlap;
  const eaHz = eaInnerHz + ea.wallOverlap;

  buildGroinVaultBay({
    roomId: 'east_alcove',
    bayIndex: 0,
    cx: eaCx,
    cz: eaCz,
    hx: eaHx,
    hz: eaHz,
    innerHalfX: eaInnerHx,
    innerHalfZ: eaInnerHz,
    ySpring: ea.springY,
    yApex: ea.apexY,
    lunetteRise: ea.lunetteRise,
    transRise: ea.transRise,
    ribThick: ea.ribThick,
    wallHeight: ea.wallHeight,
    segU,
    segT,
    shellParts,
    ribParts,
    glassParts,
    windowRegistry,
    addWestLunette: true,
    addEastLunette: true,
    addNorthLunette: true,
    addSouthLunette: true,
    addWestWindow: false,
    addEastWindow: true, // Moonlit sanctuary window directly above the Estus Relic Shrine!
    addNorthWindow: false,
    addSouthWindow: false,
    windowWidth: 1.68,
    includeKeystone: true,
    keystoneScale: 0.88
  });

  // East Alcove Perimeter Cornices & 4 Corner Corbels
  ribParts.push(createWallCorniceGeometry(ea.minX, ea.minZ, ea.maxX, ea.minZ, ea.springY + 0.05, 0, 1, 0.34, 0.26));
  ribParts.push(createWallCorniceGeometry(ea.minX, ea.maxZ, ea.maxX, ea.maxZ, ea.springY + 0.05, 0, -1, 0.34, 0.26));
  ribParts.push(createWallCorniceGeometry(ea.maxX, ea.minZ, ea.maxX, ea.maxZ, ea.springY + 0.05, -1, 0, 0.34, 0.26));
  ribParts.push(createWallCorniceGeometry(ea.minX, ea.minZ, ea.minX, ea.maxZ, ea.springY + 0.05, 1, 0, 0.34, 0.26));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const invLen = 1 / Math.SQRT2;
      ribParts.push(
        createWallCorbelGeometry(
          eaCx + sx * eaInnerHx,
          ea.springY + 0.02,
          eaCz + sz * eaInnerHz,
          -sx * invLen,
          -sz * invLen,
          0.56,
          0.44,
          0.84
        )
      );
    }
  }

  // --------------------------------------------------------------------------
  // 4. ENLARGED BOSS THRONE CATHEDRAL DOME (`boss_hall`, R=16.0, center (0, -31.2) -> apexY = 18.2)
  // --------------------------------------------------------------------------
  buildBossCathedralDome(shellParts, ribParts, glassParts, windowRegistry, isMobile);

  // --------------------------------------------------------------------------
  // 5. All 7 Wrought-Iron Gothic Chandeliers (synced 1:1 with SOULS_CASTLE_CHANDELIERS)
  // --------------------------------------------------------------------------
  const ironParts = [];
  const flameSpecs = [];
  for (let i = 0; i < CHANDELIER_SPECS.length; i++) {
    appendGothicChandelier(ironParts, flameSpecs, ribParts, CHANDELIER_SPECS[i], isMobile);
  }

  // ==========================================================================
  // C. Merge Into Strictly 5 Draw-Call Meshes (4 DC LowSpec, 0 CastShadow!)
  // ==========================================================================
  // 1. Vaulted Ceiling Shell [1 DC]
  const vaultShellGeo = trackGeo(mergeStoneParts(shellParts));
  vaultShellGeo.computeBoundingSphere();
  const vaultShellMesh = new THREE.Mesh(vaultShellGeo, vaultShellMat);
  vaultShellMesh.name = 'CastleVaultShell';
  vaultShellMesh.castShadow = false;
  vaultShellMesh.receiveShadow = false;
  group.add(vaultShellMesh);

  // 2. Sculpted Gothic Vault Ribs, Arches, Keystones, Corbels & Cornices [1 DC]
  const vaultRibsGeo = trackGeo(mergeStoneParts(ribParts));
  vaultRibsGeo.computeBoundingSphere();
  const vaultRibsMesh = new THREE.Mesh(vaultRibsGeo, vaultRibsMat);
  vaultRibsMesh.name = 'CastleVaultRibs';
  vaultRibsMesh.castShadow = false;
  vaultRibsMesh.receiveShadow = false;
  group.add(vaultRibsMesh);

  // 3. Moonlit Gothic Clerestory & Cathedral Dome Lantern Stained-Glass Windows [1 DC]
  const clerestoryGlassGeo = trackGeo(mergeGeometries(glassParts, false));
  for (let i = 0; i < glassParts.length; i++) glassParts[i].dispose();
  clerestoryGlassGeo.computeBoundingSphere();
  const clerestoryGlassMesh = new THREE.Mesh(clerestoryGlassGeo, clerestoryGlassMat);
  clerestoryGlassMesh.name = 'CastleClerestoryGlass';
  clerestoryGlassMesh.castShadow = false;
  clerestoryGlassMesh.receiveShadow = false;
  clerestoryGlassMesh.renderOrder = 3;
  group.add(clerestoryGlassMesh);

  // 4. Merged Wrought-Iron Swaying Gothic Chandeliers & Heavy Chains [1 DC]
  const chandeliersIronGeo = trackGeo(mergeGeometries(ironParts, false));
  for (let i = 0; i < ironParts.length; i++) ironParts[i].dispose();
  applyBoxProjectedUVs(chandeliersIronGeo, 1.4);
  chandeliersIronGeo.computeBoundingSphere();
  const chandeliersIronMesh = new THREE.Mesh(chandeliersIronGeo, chandeliersIronMat);
  chandeliersIronMesh.name = 'CastleChandeliersIron';
  chandeliersIronMesh.castShadow = false;
  chandeliersIronMesh.receiveShadow = false;
  group.add(chandeliersIronMesh);

  // 5. Merged GPU Billboarded Flickering Chandelier Flames [1 DC, off in lowSpec]
  const chandelierFlamesGeo = trackGeo(buildChandelierFlamesGeometry(flameSpecs));
  const chandelierFlamesMesh = new THREE.Mesh(chandelierFlamesGeo, chandelierFlamesMat);
  chandelierFlamesMesh.name = 'CastleChandelierFlames';
  chandelierFlamesMesh.frustumCulled = false;
  chandelierFlamesMesh.castShadow = false;
  chandelierFlamesMesh.receiveShadow = false;
  chandelierFlamesMesh.renderOrder = 5;
  chandelierFlamesMesh.visible = enableChandelierFlames && !lowSpecMode;
  group.add(chandelierFlamesMesh);

  // ==========================================================================
  // D. Runtime Controls: update(time, dt, cameraPos), setLowSpec(enabled), dispose()
  // ==========================================================================
  let disposed = false;

  function update(time = 0, _dt = 0.016, cameraPos = null) {
    if (disposed || !group.visible) return;
    const safeTime = Number.isFinite(time) ? time : 0;

    chandelierSwayUniforms.uTime.value = safeTime;
    flameUniforms.uTime.value = safeTime;
    glassUniforms.uTime.value = safeTime;

    if (cameraPos && Number.isFinite(cameraPos.x) && Number.isFinite(cameraPos.y) && Number.isFinite(cameraPos.z)) {
      glassUniforms.uCamPos.value.set(cameraPos.x, cameraPos.y, cameraPos.z);
    }
  }

  function setLowSpec(enabled = false) {
    const next = Boolean(enabled);
    if (next === lowSpecMode) return;
    lowSpecMode = next;

    for (let i = 0; i < normalMappedMats.length; i++) {
      const entry = normalMappedMats[i];
      entry.mat.normalMap = lowSpecMode ? null : entry.map;
      entry.mat.needsUpdate = true;
    }

    glassUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    chandelierSwayUniforms.uSwayAmp.value = lowSpecMode ? 0.45 : 1.0;
    chandelierFlamesMesh.visible = enableChandelierFlames && !lowSpecMode;
  }

  function setVisible(visible = true) {
    group.visible = Boolean(visible);
  }

  function getDrawCallCount() {
    if (!group.visible) return 0;
    let dc = 0;
    if (vaultShellMesh.visible) dc++;
    if (vaultRibsMesh.visible) dc++;
    if (clerestoryGlassMesh.visible) dc++;
    if (chandeliersIronMesh.visible) dc++;
    if (chandelierFlamesMesh.visible) dc++;
    return dc;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < ownedGeos.length; i++) {
      ownedGeos[i].dispose?.();
    }
    for (let i = 0; i < ownedMats.length; i++) {
      ownedMats[i].dispose?.();
    }
    ownedGeos.length = 0;
    ownedMats.length = 0;
    group.clear();
  }

  return {
    group,
    meshes: {
      vaultShellMesh,
      vaultRibsMesh,
      clerestoryGlassMesh,
      chandeliersIronMesh,
      chandelierFlamesMesh
    },
    clerestoryWindows: Object.freeze(windowRegistry),
    chandeliers: CHANDELIER_SPECS,
    getDrawCallCount,
    update,
    setLowSpec,
    setVisible,
    dispose
  };
}
