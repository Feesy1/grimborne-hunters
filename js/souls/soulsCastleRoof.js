// Monumental High-Gothic Vaulted Roof, Star-Ribbed Tierceron Ceilings, Deep Traceried Clerestory Windows,
// Enlarged Boss Cathedral Dome & Swaying Wrought-Iron Candle Chandeliers
// for Chapter 26 — «Abandoned Knight Rift» (Wave 2 `?v=20261124z90` — Pure Vanilla ES Module, Three.js r160).
//
// Wave 2 Architectural & Next-Gen PBR Upgrade (+200% PC Geometry, Depth & Physical Realism):
//   - 2x Smoother Multi-Segment Pointed Arch Curvature & 10-Face Gothic Roll-and-Fillet Cavetto Rib Mouldings on PC!
//   - Authentic High-Gothic Tierceron & Chevron Star-Vault Ribs with Primary 16-Sided Foliate Pendant Boss Keystones
//     & Secondary Tierceron Ridge Bosses across Bonfire Hall, 36m Corridor, East Alcove & R=16 Boss Cathedral Dome!
//   - True 0.44m-Deep Recessed Splayed Stone Clerestory Embrasures (perforated manifold lunettes + angled moonlit
//     stone splays + outer archivolts + 3D stone Y-tracery mullions & ocular rose rings in front of stained glass)!
//   - High-Detail Wrought-Iron Corona Lucis Chandeliers with 3D interlinked vertical & diagonal chains, pierced
//     cusped iron friezes, S-scrollwork brackets, 3D Melted Beeswax Pillar Candles w/ warm subsurface top glow,
//     and multi-layer blackbody flickering flames — all swaying in exact GPU rigid-body pendulum sync!
//   - Calibrated Next-Gen PBR (PMREM reflections, 2K normal relief, balanced gothic bounce — ZERO washout/overexposure!).
//
// Strictly 6 Draw Calls on PC/Mobile (<= 7 DC budget! 4 Draw Calls on LowSpec, 0 castShadow overhead!):
//   1. vaultShellMesh        — Ribbed Groin Vaults, Boss Drum/Dome/Lantern, Gables & Deep Splayed Window Embrasures (FrontSide).
//   2. vaultRibsMesh         — 10-Face Roll-and-Fillet Ribs, Tierceron Star-Ribs, Foliate Keystones, Y-Tracery & Cornices (FrontSide).
//   3. clerestoryGlassMesh   — Deep-Recessed Stained-Glass Windows w/ Lead-Tracery & Sapphire-Lunar Shader (FrontSide).
//   4. chandeliersIronMesh   — High-Poly Forged Iron Chandeliers & 3D Chains w/ GPU Pendulum Sway (FrontSide).
//   5. chandelierCandlesMesh — 3D Clustered Melted Beeswax Candles w/ Subsurface Flame-Top Translucency & GPU Sway (off in lowSpec).
//   6. chandelierFlamesMesh  — GPU Billboarded Blackbody Teardrop Candle Flames locked to exact wick tips (off in lowSpec).

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_ROOMS,
  SOULS_CASTLE_VAULTS,
  SOULS_CASTLE_CHANDELIERS
} from './soulsCastleLayout.js?v=20261124z90';

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
  const cySpringY = Number((cyWallH - 0.25).toFixed(3));
  const cyApexY = courtVaults[0]?.apexY ?? cyRoom.ceilingY ?? 11.4;
  const cyRise = Math.max(1.8, cyApexY - cySpringY);
  const cyLunetteRise = Number((cyRise * 0.84).toFixed(3));
  const cyTransRise = Number((cyRise * 0.93).toFixed(3));
  const cyBaysZ = makeContiguousBaysZ(cyRoom.minZ, cyRoom.maxZ, courtVaults.length || 3, 0.20, 0.35);

  // Corridor (36m x 10m): wall height 8.4, 6 vault bays -> apexY 10.2
  const coRoom = rooms.corridor;
  const coWallH = C.CORRIDOR_WALL_HEIGHT;
  const coSpringY = Number((coWallH - 0.25).toFixed(3));
  const coApexY = corrVaults[0]?.apexY ?? coRoom.ceilingY ?? 10.2;
  const coRise = Math.max(1.4, coApexY - coSpringY);
  const coLunetteRise = Number((coRise * 0.86).toFixed(3));
  const coTransRise = Number((coRise * 0.93).toFixed(3));
  const coBaysZ = makeContiguousBaysZ(coRoom.minZ, coRoom.maxZ, corrVaults.length || 6, 0.15, 0.15);

  // East Alcove (Armory Chapel): wall height 7.8, cross-ribbed chapel vault -> apexY 8.9
  const eaRoom = rooms.east_alcove;
  const eaWallH = C.ALCOVE_WALL_HEIGHT;
  const eaSpringY = Number((eaWallH - 0.25).toFixed(3));
  const eaApexY = alcoveVault?.apexY ?? eaRoom.ceilingY ?? 8.9;
  const eaRise = Math.max(1.0, eaApexY - eaSpringY);
  const eaLunetteRise = Number((eaRise * 0.94).toFixed(3));

  // Boss Throne Cathedral (Enlarged R=16.0, center (0, -31.2), wall height 12.4 -> apexY 18.2)
  const bossRoom = rooms.boss_hall;
  const bossInnerR = C.BOSS_RADIUS;
  const bossWallH = C.BOSS_WALL_HEIGHT;
  const bossSpringY = Number((bossWallH - 0.25).toFixed(3));
  const bossApexY = bossVault?.apexY ?? bossRoom.ceilingY ?? 18.2;
  const bossDrumTopY = Number((bossSpringY + 1.96).toFixed(3));
  const bossLanternApexY = bossApexY;
  const bossLanternTopY = Number((bossLanternApexY - 0.34).toFixed(3));
  const bossOculusY = Number((bossLanternTopY - 1.34).toFixed(3));
  const bossOculusR = Number(Math.min(3.85, Math.max(2.6, (bossVault?.oculusRadius ?? 4.0) * 0.90)).toFixed(3));

  const courtyardOculusBay = courtVaults.find((v) => v.hasOculus) || null;

  return Object.freeze({
    courtyard: Object.freeze({
      minX: cyRoom.minX,
      maxX: cyRoom.maxX,
      minZ: cyRoom.minZ,
      maxZ: cyRoom.maxZ,
      wallHeight: cyWallH,
      wallOverlapX: 0.46,
      wallOverlapZ: 0.42,
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
      wallOverlapX: 0.46,
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
      wallOverlap: 0.44,
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
      outerSkirtRadius: Number((bossInnerR + 0.98).toFixed(3)),
      drumRadius: Number((bossInnerR + 0.25).toFixed(3)),
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

// Matches soulsCastleDoors.js pointed doorway curve with slight outer clearance
function gothicBossDoorArchY(xAbs) {
  const halfSpan = SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W + 0.11;
  const springY = 4.65;
  const apexY = 6.56;
  const u = 1.0 - clamp01(Math.abs(xAbs) / halfSpan);
  return springY + (apexY - springY) * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78);
}

// Evaluate exact analytical groin-vault surface height at local offsets (dx, dz) inside a bay
function evalGroinBayY(dx, dz, hx, hz, ySpring, yApex, lunetteRise, transRise) {
  const rise = yApex - ySpring;
  const sx = clamp01(Math.abs(dx) / Math.max(0.01, hx));
  const sz = clamp01(Math.abs(dz) / Math.max(0.01, hz));
  if (sx < 1e-5 && sz < 1e-5) return yApex;
  if (sx >= sz) {
    const u = sx;
    const t = sz / Math.max(1e-5, sx);
    const yd = ySpring + rise * gothicOgive(u, 0.48);
    const ym = ySpring + lunetteRise + (rise - lunetteRise) * (1.0 - u * u);
    return yd + (ym - yd) * gothicOgive(t, 0.48);
  }
  const u = sz;
  const t = sx / Math.max(1e-5, sz);
  const yd = ySpring + rise * gothicOgive(u, 0.48);
  const ym = ySpring + transRise + (rise - transRise) * (1.0 - u * u);
  return yd + (ym - yd) * gothicOgive(t, 0.48);
}

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
    return evalGroinBayY(x - cx, z - cz, hx, hz, ea.springY, ea.apexY, ea.lunetteRise, ea.transRise);
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
  const hx = (hall.maxX - hall.minX) * 0.5 + hall.wallOverlapX;
  return evalGroinBayY(x, z - cz, hx, hz, hall.springY, hall.apexY, hall.lunetteRise, hall.transRise);
}

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
    if (lenSq < 1e-10) return;
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
// 1. Sculpted Gothic Vault Rib Extruder
//    - PC (`!isMobile`): 10-Face Authentic Gothic Roll-and-Fillet CavettoKeel Moulding!
//    - Mobile (`isMobile`): Crisp 5-Face Chamfered Gothic Moulding!
//    Strictly monotonically increasing binormalFrac -> ALL faces point downward/inward
//    (100% FrontSide backface-culling from above, 0 upward top caps!).
// ============================================================================
const RIB_PROFILE_PC_10FACE = Object.freeze([
  Object.freeze([-0.50, -0.05, 0.50]), // left ceiling flange
  Object.freeze([-0.46,  0.18, 0.68]), // left upper quirk
  Object.freeze([-0.38,  0.34, 0.60]), // left hollow cavetto groove (deep shadow crease!)
  Object.freeze([-0.30,  0.60, 0.96]), // left torus roll-moulding bead (catches firelight!)
  Object.freeze([-0.16,  0.76, 0.82]), // left inner fillet step
  Object.freeze([ 0.00,  0.98, 1.08]), // central pointed Gothic keel soffit ridge!
  Object.freeze([ 0.16,  0.76, 0.82]), // right inner fillet step
  Object.freeze([ 0.30,  0.60, 0.96]), // right torus roll-moulding bead
  Object.freeze([ 0.38,  0.34, 0.60]), // right hollow cavetto groove
  Object.freeze([ 0.46,  0.18, 0.68]), // right upper quirk
  Object.freeze([ 0.50, -0.05, 0.50])  // right ceiling flange
]);

const RIB_PROFILE_MOB_5FACE = Object.freeze([
  Object.freeze([-0.50, -0.05, 0.56]),
  Object.freeze([-0.43,  0.34, 0.84]),
  Object.freeze([-0.22,  0.88, 1.04]),
  Object.freeze([ 0.22,  0.88, 1.04]),
  Object.freeze([ 0.43,  0.34, 0.84]),
  Object.freeze([ 0.50, -0.05, 0.56])
]);

function createGothicRibGeometry(points, {
  width = 0.44,
  depth = 0.34,
  dropDir = null,
  uvScale = 2.8,
  tintR = 1.0,
  tintG = 1.0,
  tintB = 1.0,
  closedLoop = false,
  highDetail = true
} = {}) {
  const nPts = points.length;
  if (nPts < 2) return null;
  const prof = highDetail ? RIB_PROFILE_PC_10FACE : RIB_PROFILE_MOB_5FACE;
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

    let tx = pNext.x - pPrev.x;
    let ty = pNext.y - pPrev.y;
    let tz = pNext.z - pPrev.z;
    const tLen = Math.hypot(tx, ty, tz) || 1;
    tx /= tLen;
    ty /= tLen;
    tz /= tLen;

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
        (fx - centerX) + (a.dx + b.dx) * 0.16,
        (fy - centerY) + (a.dy + b.dy) * 0.16,
        (fz - centerZ) + (a.dz + b.dz) * 0.16
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

// Sculpted High-Detail 3D Gothic Foliate Rosette & Pendant Boss Keystone
// (16-sided w/ 8-lobed carved acanthus/trefoil wreath on PC, 8-sided on Mobile; NO upward top cap!)
function createGothicKeystoneGeometry(x, y, z, scale = 1.0, highDetail = true) {
  const segs = highDetail ? 16 : 8;
  const ringsSpec = highDetail
    ? [
        { r: 0.78 * scale, dy:  0.04 * scale, ao: 0.56, lobe: 0.04 }, // ceiling collar
        { r: 0.72 * scale, dy: -0.14 * scale, ao: 0.88, lobe: 0.13 }, // upper 8-lobed foliate crown
        { r: 0.58 * scale, dy: -0.22 * scale, ao: 0.64, lobe: 0.05 }, // undercut shadow throat
        { r: 0.62 * scale, dy: -0.34 * scale, ao: 1.02, lobe: 0.14 }, // sculpted acanthus rosette boss!
        { r: 0.44 * scale, dy: -0.46 * scale, ao: 0.86, lobe: 0.04 }, // octagonal shield molding
        { r: 0.32 * scale, dy: -0.56 * scale, ao: 1.06, lobe: 0.00 }, // beveled pendant drum
        { r: 0.14 * scale, dy: -0.66 * scale, ao: 1.00, lobe: 0.00 }, // tapered finial cone
        { r: 0.00,         dy: -0.74 * scale, ao: 0.90, lobe: 0.00 }  // pendant tip
      ]
    : [
        { r: 0.72 * scale, dy:  0.04 * scale, ao: 0.64, lobe: 0.06 },
        { r: 0.66 * scale, dy: -0.16 * scale, ao: 0.86, lobe: 0.08 },
        { r: 0.54 * scale, dy: -0.22 * scale, ao: 0.76, lobe: 0.00 },
        { r: 0.46 * scale, dy: -0.40 * scale, ao: 1.00, lobe: 0.06 },
        { r: 0.24 * scale, dy: -0.54 * scale, ao: 1.06, lobe: 0.00 },
        { r: 0.00,         dy: -0.60 * scale, ao: 0.94, lobe: 0.00 }
      ];

  const rows = ringsSpec.length;
  const cols = segs + 1;
  const verts = new Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const spec = ringsSpec[r];
    for (let c = 0; c < cols; c++) {
      const ang = (c / segs) * Math.PI * 2 + Math.PI / segs;
      const lobeWave = Math.cos(ang * 8.0);
      const rad = spec.r * (1.0 + spec.lobe * lobeWave);
      const lobeShade = 1.0 + spec.lobe * 0.45 * lobeWave;
      const ao = spec.ao * lobeShade;
      verts[r * cols + c] = {
        x: x + Math.cos(ang) * rad,
        y: y + spec.dy,
        z: z + Math.sin(ang) * rad,
        u: (c / segs) * 2.2,
        v: r * 0.18,
        r: ao,
        g: ao * 0.99,
        b: ao * 1.03
      };
    }
  }

  return buildInwardGridGeometry(rows, cols, verts, (mx, my, mz) => [
    mx - x,
    (my - y) - 0.65 * scale,
    mz - z
  ]);
}

// Sculpted Underside-Only Multi-Tiered Gothic Springer Corbel Bracket anchored to perimeter walls
function createWallCorbelGeometry(x, y, z, inwardNx, inwardNz, width = 0.62, depth = 0.52, height = 0.92, highDetail = true) {
  const tx = -inwardNz;
  const tz = inwardNx;
  const tiers = highDetail
    ? [
        { dy:  0.04,          proj: depth * 1.00, halfW: width * 0.56, ao: 0.98 },
        { dy: -height * 0.14, proj: depth * 0.96, halfW: width * 0.53, ao: 0.94 },
        { dy: -height * 0.26, proj: depth * 0.78, halfW: width * 0.46, ao: 0.76 },
        { dy: -height * 0.44, proj: depth * 0.70, halfW: width * 0.42, ao: 0.90 },
        { dy: -height * 0.62, proj: depth * 0.48, halfW: width * 0.32, ao: 0.72 },
        { dy: -height * 0.82, proj: depth * 0.28, halfW: width * 0.22, ao: 0.80 },
        { dy: -height * 1.00, proj: 0.02,         halfW: width * 0.12, ao: 0.56 }
      ]
    : [
        { dy:  0.04,          proj: depth * 1.00, halfW: width * 0.54, ao: 0.96 },
        { dy: -height * 0.20, proj: depth * 0.92, halfW: width * 0.50, ao: 0.92 },
        { dy: -height * 0.36, proj: depth * 0.68, halfW: width * 0.42, ao: 0.80 },
        { dy: -height * 0.68, proj: depth * 0.42, halfW: width * 0.30, ao: 0.72 },
        { dy: -height * 1.00, proj: 0.02,         halfW: width * 0.14, ao: 0.58 }
      ];

  const rows = tiers.length;
  const cols = highDetail ? 6 : 4;
  const verts = new Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    const t = tiers[r];
    const pts = highDetail
      ? [
          { s: -t.halfW,        p: 0.0,          ao: t.ao * 0.72 },
          { s: -t.halfW * 0.86, p: t.proj * 0.58, ao: t.ao * 0.88 },
          { s: -t.halfW * 0.48, p: t.proj,        ao: t.ao * 1.02 },
          { s:  t.halfW * 0.48, p: t.proj,        ao: t.ao * 1.02 },
          { s:  t.halfW * 0.86, p: t.proj * 0.58, ao: t.ao * 0.88 },
          { s:  t.halfW,        p: 0.0,          ao: t.ao * 0.72 }
        ]
      : [
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

// Continuous Underside-Moulded Wall Cornice Strip (NO upward top cap!)
function createWallCorniceGeometry(x0, z0, x1, z1, yTop, inwardNx, inwardNz, height = 0.44, proj = 0.38, highDetail = true) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return null;
  const steps = highDetail
    ? [
        { dy:  0.02,          p: proj,        ao: 0.98 },
        { dy: -height * 0.24, p: proj,        ao: 0.92 },
        { dy: -height * 0.42, p: proj * 0.72, ao: 0.72 },
        { dy: -height * 0.64, p: proj * 0.64, ao: 0.86 },
        { dy: -height * 0.84, p: proj * 0.32, ao: 0.68 },
        { dy: -height,        p: 0.0,         ao: 0.58 }
      ]
    : [
        { dy:  0.02,          p: proj,        ao: 0.96 },
        { dy: -height * 0.38, p: proj,        ao: 0.88 },
        { dy: -height * 0.70, p: proj * 0.55, ao: 0.74 },
        { dy: -height,        p: 0.0,         ao: 0.60 }
      ];
  const rows = steps.length;
  const cols = 2;
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
        v: r * 0.12,
        r: st.ao,
        g: st.ao,
        b: st.ao * 1.02
      };
    }
  }
  return buildInwardGridGeometry(rows, cols, verts, () => [inwardNx, -0.45, inwardNz]);
}

// ============================================================================
// 2. Deep Recessed Splayed Clerestory Traceried Window Builder
//    - Recesses stained glass `recessDepth` (0.42m) OUTWARD into the 1.2m wall!
//    - Builds a watertight 4-sided Splayed Stone Embrasure Tunnel catching cold
//      moonlit stained-glass bounce light + outer Gothic archivolt + 3D stone
//      bifurcating Y-tracery mullions & ocular rose ring!
// ============================================================================
function evalWindowContourY(sNorm, yBot, yTop) {
  const h = Math.max(0.50, yTop - yBot);
  const springFrac = 0.56;
  const springY = yBot + h * springFrac;
  const archRise = h * (1.0 - springFrac);
  return springY + archRise * gothicOgive(Math.abs(sNorm), 0.52);
}

function appendClerestoryLancetWindow(shellParts, glassParts, ribParts, windowRegistry, {
  id,
  roomId,
  x,
  yBot,
  yTop,
  z,
  width,
  inwardNx,
  inwardNz,
  winKind = 0.0, // 0.0 = recessed wall clerestory, 1.0 = Boss Hall central dome lantern
  recessDepth = 0.42,
  splayHalfW = null,
  splayBotY = null,
  splayTopY = null,
  addStoneFrame = true,
  highDetail = true
}) {
  const h = Math.max(0.52, yTop - yBot);
  const halfW = width * 0.5;
  const springFrac = 0.56;
  const springY = yBot + h * springFrac;
  const archRise = h * (1.0 - springFrac);

  const tx = -inwardNz;
  const tz = inwardNx;

  const effRecess = recessDepth > 0.01 ? recessDepth : 0.0;
  const glassOffsetInward = effRecess > 0 ? -effRecess : 0.06;

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

  // 1. Pointed-Arch Stained-Glass Pane Geometry (sits recessed at `glassOffsetInward`)
  const cols = highDetail ? 8 : 6;
  const rows = highDetail ? 6 : 5;
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
        x: x + tx * localU + inwardNx * glassOffsetInward,
        y: py,
        z: z + tz * localU + inwardNz * glassOffsetInward,
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

  // 2. Watertight 3D Splayed Stone Embrasure Tunnel connecting Inner Lunette Rim -> Recessed Glass Rim!
  if (effRecess > 0 && shellParts) {
    const inHW = splayHalfW || (halfW * 1.16);
    const inBot = splayBotY !== null ? splayBotY : (yBot - 0.06);
    const inTop = splayTopY !== null ? splayTopY : (yTop + 0.08);
    const archSteps = highDetail ? 12 : 8;

    // Trace closed loop around window opening: Bottom-Left -> Arch Apex -> Bottom-Right -> Sill -> Bottom-Left
    const buildPerimeterLoop = (hw, bY, tY) => {
      const loop = [];
      // Left jamb bottom -> left springer
      const spY = bY + Math.max(0.45, tY - bY) * 0.56;
      loop.push({ u: -hw, y: bY });
      loop.push({ u: -hw, y: spY });
      // Pointed arch from -1 to +1
      for (let i = 1; i < archSteps; i++) {
        const s = -1.0 + (2.0 * i) / archSteps;
        loop.push({ u: s * hw, y: evalWindowContourY(s, bY, tY) });
      }
      // Right springer -> right jamb bottom -> back to left jamb bottom
      loop.push({ u: hw, y: spY });
      loop.push({ u: hw, y: bY });
      loop.push({ u: -hw, y: bY });
      return loop;
    };

    const innerLoop = buildPerimeterLoop(inHW, inBot, inTop);
    const outerLoop = buildPerimeterLoop(halfW, yBot, yTop);
    const loopCols = innerLoop.length;
    const tunnelVerts = new Array(2 * loopCols);

    let perimDist = 0;
    for (let c = 0; c < loopCols; c++) {
      if (c > 0) {
        perimDist += Math.hypot(innerLoop[c].u - innerLoop[c - 1].u, innerLoop[c].y - innerLoop[c - 1].y);
      }
      const pIn = innerLoop[c];
      const pOut = outerLoop[c];
      // Row 0: inner room wall face (slightly darker stone frame transition)
      tunnelVerts[c] = {
        x: x + tx * pIn.u,
        y: pIn.y,
        z: z + tz * pIn.u,
        u: perimDist / 2.6,
        v: 0.0,
        r: 0.80,
        g: 0.85,
        b: 0.96
      };
      // Row 1: deep recessed rim right beside glowing moonlit stained glass (bright cool lunar bounce!)
      tunnelVerts[loopCols + c] = {
        x: x + tx * pOut.u + inwardNx * glassOffsetInward,
        y: pOut.y,
        z: z + tz * pOut.u + inwardNz * glassOffsetInward,
        u: perimDist / 2.6,
        v: effRecess / 2.6,
        r: 0.96,
        g: 1.08,
        b: 1.32
      };
    }
    const winMidY = (yBot + yTop) * 0.48;
    const focusX = x + inwardNx * 1.25;
    const focusZ = z + inwardNz * 1.25;
    shellParts.push(
      buildInwardGridGeometry(2, loopCols, tunnelVerts, (mx, my, mz) => [
        focusX - mx,
        (winMidY - 0.15) - my,
        focusZ - mz
      ])
    );
  }

  if (!addStoneFrame) return;

  // 3. Outer Proud Gothic Archivolt Hood-Mould, Jamb Colonnettes & Moulded Sill on Inner Wall Face
  const outHW = splayHalfW || (halfW * 1.16);
  const outBot = splayBotY !== null ? splayBotY : (yBot - 0.06);
  const outTop = splayTopY !== null ? splayTopY : (yTop + 0.08);
  const outH = Math.max(0.55, outTop - outBot);
  const outSpringY = outBot + outH * 0.56;
  const outArchRise = outH * 0.44;

  const archPts = [];
  const archSegs = highDetail ? 14 : 8;
  for (let i = 0; i <= archSegs; i++) {
    const s = -1.0 + (2.0 * i) / archSegs;
    const ly = outSpringY + (outArchRise + 0.06) * gothicOgive(Math.abs(s), 0.52);
    const lu = s * (outHW + 0.09);
    archPts.push({
      x: x + tx * lu + inwardNx * 0.04,
      y: ly,
      z: z + tz * lu + inwardNz * 0.04
    });
  }
  const hoodGeo = createGothicRibGeometry(archPts, {
    width: 0.22,
    depth: 0.18,
    dropDir: [inwardNx * 0.92, -0.38, inwardNz * 0.92],
    tintR: 0.98,
    tintG: 1.00,
    tintB: 1.06,
    highDetail
  });
  if (hoodGeo) ribParts.push(hoodGeo);

  // Outer engaged jamb colonnettes flanking the splayed reveal
  for (const side of [-1, 1]) {
    const lu = side * (outHW + 0.08);
    const jambPts = [
      { x: x + tx * lu + inwardNx * 0.04, y: outBot, z: z + tz * lu + inwardNz * 0.04 },
      { x: x + tx * lu + inwardNx * 0.04, y: outSpringY + 0.06, z: z + tz * lu + inwardNz * 0.04 }
    ];
    const jGeo = createGothicRibGeometry(jambPts, {
      width: 0.19,
      depth: 0.17,
      dropDir: [inwardNx, -0.22, inwardNz],
      tintR: 0.94,
      tintG: 0.96,
      tintB: 1.04,
      highDetail
    });
    if (jGeo) ribParts.push(jGeo);
  }

  // Deep Recessed 3D Gothic Stone Y-Tracery Mullion + Bifurcating Branches + Ocular Rose Ring!
  const traceryPlaneOff = glassOffsetInward + 0.055;
  const centerTopY = highDetail ? (springY + archRise * 0.12) : (yTop - 0.12);
  const centerMullionPts = [
    { x: x + inwardNx * traceryPlaneOff, y: yBot, z: z + inwardNz * traceryPlaneOff },
    { x: x + inwardNx * traceryPlaneOff, y: centerTopY, z: z + inwardNz * traceryPlaneOff }
  ];
  const cmGeo = createGothicRibGeometry(centerMullionPts, {
    width: 0.12,
    depth: 0.12,
    dropDir: [inwardNx, -0.20, inwardNz],
    tintR: 0.90,
    tintG: 0.94,
    tintB: 1.04,
    highDetail
  });
  if (cmGeo) ribParts.push(cmGeo);

  if (highDetail) {
    // Bifurcating Y-tracery stone branches curving gracefully into left & right arch haunches
    for (const side of [-1, 1]) {
      const yBranchPts = [];
      for (let i = 0; i <= 5; i++) {
        const f = i / 5;
        const lu = side * halfW * 0.62 * Math.pow(f, 0.85);
        const ly = (springY - 0.04) + archRise * 0.56 * f;
        yBranchPts.push({
          x: x + tx * lu + inwardNx * traceryPlaneOff,
          y: ly,
          z: z + tz * lu + inwardNz * traceryPlaneOff
        });
      }
      const ybGeo = createGothicRibGeometry(yBranchPts, {
        width: 0.095,
        depth: 0.10,
        dropDir: [inwardNx, -0.25, inwardNz],
        tintR: 0.92,
        tintG: 0.96,
        tintB: 1.06,
        highDetail: false
      });
      if (ybGeo) ribParts.push(ybGeo);
    }

    // Sculpted 3D Stone Ocular Rose Ring nestled in the pointed arch head!
    const roseR = Math.min(halfW * 0.30, archRise * 0.25);
    if (roseR >= 0.11) {
      const roseCy = springY + archRise * 0.54;
      const rosePts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const lu = Math.cos(a) * roseR;
        const ly = roseCy + Math.sin(a) * roseR;
        rosePts.push({
          x: x + tx * lu + inwardNx * traceryPlaneOff,
          y: ly,
          z: z + tz * lu + inwardNz * traceryPlaneOff
        });
      }
      const roseGeo = createGothicRibGeometry(rosePts, {
        width: 0.085,
        depth: 0.09,
        dropDir: [inwardNx, -0.25, inwardNz],
        closedLoop: true,
        tintR: 0.94,
        tintG: 0.98,
        tintB: 1.08,
        highDetail: false
      });
      if (roseGeo) ribParts.push(roseGeo);
    }
  }

  // Moulded outer window sill cornice
  const sx0 = x + tx * (-outHW - 0.18);
  const sz0 = z + tz * (-outHW - 0.18);
  const sx1 = x + tx * (outHW + 0.18);
  const sz1 = z + tz * (outHW + 0.18);
  const sillGeo = createWallCorniceGeometry(sx0, sz0, sx1, sz1, outBot + 0.04, inwardNx, inwardNz, 0.22, 0.24, highDetail);
  if (sillGeo) ribParts.push(sillGeo);
}

// Helper: Build a Perforated Manifold Lunette Wall (splits cleanly around deep recessed window opening!)
function appendPerforatedLunetteWall(shellParts, {
  cx,
  cz,
  axis,
  wallCoord,
  inNx,
  inNz,
  spanHalf,
  yBotCurve,
  yTopFn,
  steps,
  tileScale,
  hole = null // { halfW, yBot, yTop }
}) {
  const inwardFn = () => [inNx, -0.06, inNz];

  const emitStrip = (uStart, uEnd, count, botFn, topFn) => {
    if (uEnd - uStart < 0.005) return;
    const cols = Math.max(2, count + 1);
    const verts = new Array(2 * cols);
    for (let c = 0; c < cols; c++) {
      const f = c / (cols - 1);
      const uLocal = uStart + (uEnd - uStart) * f;
      const yb = botFn(uLocal);
      const yt = Math.max(yb + 0.015, topFn(uLocal));
      const vx = axis === 'x' ? wallCoord : (cx + uLocal);
      const vz = axis === 'x' ? (cz + uLocal) : wallCoord;
      const uTex = uLocal / tileScale;
      verts[c] = {
        x: vx, y: yb, z: vz, u: uTex, v: yb / tileScale,
        r: 0.72, g: 0.75, b: 0.83
      };
      verts[cols + c] = {
        x: vx, y: yt, z: vz, u: uTex, v: yt / tileScale,
        r: 0.90, g: 0.95, b: 1.05
      };
    }
    shellParts.push(buildInwardGridGeometry(2, cols, verts, inwardFn));
  };

  if (!hole) {
    emitStrip(-spanHalf, spanHalf, steps, () => yBotCurve, yTopFn);
    return;
  }

  const hHW = Math.min(spanHalf - 0.12, hole.halfW);
  const sideSteps = Math.max(3, Math.round(steps * 0.35));
  const midSteps = Math.max(6, Math.round(steps * 0.5));

  // Left solid wing, Right solid wing, Lower Sill below window, Upper Arch Spandrel above window
  emitStrip(-spanHalf, -hHW, sideSteps, () => yBotCurve, yTopFn);
  emitStrip(hHW, spanHalf, sideSteps, () => yBotCurve, yTopFn);
  emitStrip(-hHW, hHW, midSteps, () => yBotCurve, () => hole.yBot);
  emitStrip(
    -hHW,
    hHW,
    midSteps,
    (uLocal) => evalWindowContourY(uLocal / hHW, hole.yBot, hole.yTop),
    yTopFn
  );
}

// ============================================================================
// 3. True 4-Severy High-Gothic Star-Ribbed Groin Vault Bay Builder
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
  highDetail = true,
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

  // A. West (-1) & East (+1) Curved Masonry Severies
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
        const ao = Math.max(0.58, Math.min(1.06, cornerAO * groinCreaseAO));
        const moonLift = u > 0.52 && absT < 0.55 ? 0.16 * (u - 0.52) : 0.0;

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

  // B. North (-1) & South (+1) Curved Masonry Severies
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
        const ao = Math.max(0.58, Math.min(1.06, cornerAO * groinCreaseAO));

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

  // C. Primary Diagonal Ogive Vault Ribs (10-face roll-and-fillet moulding on PC!)
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
      depth: ribThick * 0.82,
      dropDir: (pt) => [(cx - pt.x) * 0.08, -1.0, (cz - pt.z) * 0.08],
      highDetail
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
  const rNS = createGothicRibGeometry(ridgeNS, { width: ribThick * 0.68, depth: ribThick * 0.50, dropDir: [0, -1, 0], highDetail });
  const rEW = createGothicRibGeometry(ridgeEW, { width: ribThick * 0.68, depth: ribThick * 0.50, dropDir: [0, -1, 0], highDetail });
  if (rNS) ribParts.push(rNS);
  if (rEW) ribParts.push(rEW);

  // D2. High-Gothic Tierceron Star-Vault Ribs & Secondary Foliate Bosses on PC (`highDetail === true`)!
  if (highDetail) {
    const tSteps = 8;
    const ridgeFrac = 0.54;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // 1) Tierceron from corner (sx*innerHalfX, sz*innerHalfZ) -> N-S ridge point (0, sz*ridgeFrac*hz)
        const ptsNS = [];
        for (let i = 0; i <= tSteps; i++) {
          const f = i / tSteps;
          const easeX = 1.0 - Math.pow(f, 0.90);
          const dx = sx * innerHalfX * easeX;
          const dz = sz * (innerHalfZ * (1.0 - f) + hz * ridgeFrac * f);
          const py = evalGroinBayY(dx, dz, hx, hz, ySpring, yApex, lunetteRise, transRise);
          ptsNS.push({ x: cx + dx, y: py, z: cz + dz });
        }
        const tRibNS = createGothicRibGeometry(ptsNS, {
          width: ribThick * 0.62,
          depth: ribThick * 0.50,
          dropDir: (pt) => [(cx - pt.x) * 0.07, -1.0, (cz - pt.z) * 0.07],
          highDetail: true
        });
        if (tRibNS) ribParts.push(tRibNS);

        // 2) Tierceron from corner -> E-W ridge point (sx*ridgeFrac*innerHalfX, 0)
        const ptsEW = [];
        for (let i = 0; i <= tSteps; i++) {
          const f = i / tSteps;
          const easeZ = 1.0 - Math.pow(f, 0.90);
          const dx = sx * innerHalfX * ((1.0 - f) + ridgeFrac * f);
          const dz = sz * innerHalfZ * easeZ;
          const py = evalGroinBayY(dx, dz, hx, hz, ySpring, yApex, lunetteRise, transRise);
          ptsEW.push({ x: cx + dx, y: py, z: cz + dz });
        }
        const tRibEW = createGothicRibGeometry(ptsEW, {
          width: ribThick * 0.62,
          depth: ribThick * 0.50,
          dropDir: (pt) => [(cx - pt.x) * 0.07, -1.0, (cz - pt.z) * 0.07],
          highDetail: true
        });
        if (tRibEW) ribParts.push(tRibEW);
      }
    }

    // 4 Secondary Carved Foliate Bosses where the 8 tiercerons meet the Longitudinal & Transverse Ridge Ribs!
    for (const sz of [-1, 1]) {
      const bz = cz + sz * ridgeFrac * hz;
      const by = evalGroinBayY(0, sz * ridgeFrac * hz, hx, hz, ySpring, yApex, lunetteRise, transRise);
      ribParts.push(createGothicKeystoneGeometry(cx, by + 0.02, bz, keystoneScale * 0.52, false));
    }
    for (const sx of [-1, 1]) {
      const bx = cx + sx * ridgeFrac * innerHalfX;
      const by = evalGroinBayY(sx * ridgeFrac * innerHalfX, 0, hx, hz, ySpring, yApex, lunetteRise, transRise);
      ribParts.push(createGothicKeystoneGeometry(bx, by + 0.02, cz, keystoneScale * 0.52, false));
    }
  }

  // E. Sculpted Primary 16-Sided Foliate Pendant Keystone Boss at Bay Apex
  if (includeKeystone) {
    ribParts.push(createGothicKeystoneGeometry(cx, yApex, cz, keystoneScale, highDetail));
  }

  // F. Perforated Manifold Clerestory Lunette Walls + Formeret Ribs + Deep Recessed Traceried Windows
  const buildSideLunette = (axis, side, hasWindow) => {
    const steps = segT * 2;
    const wallCoord = axis === 'x'
      ? cx + side * (innerHalfX + 0.02)
      : cz + side * (innerHalfZ + 0.02);
    const inNx = axis === 'x' ? -side : 0;
    const inNz = axis === 'z' ? -side : 0;
    const spanHalf = axis === 'x' ? hz : hx;
    const riseVal = axis === 'x' ? lunetteRise : transRise;

    const yTopFn = (uLocal) => ySpring + riseVal * gothicOgive(Math.abs(uLocal) / spanHalf, 0.48) + 0.08;
    const yBotCurve = ySpring - 0.18;

    const formeretPts = [];
    for (let c = 0; c <= steps; c++) {
      const uLocal = -spanHalf + (2.0 * spanHalf * c) / steps;
      const yTopCurve = yTopFn(uLocal);
      const vx = axis === 'x' ? wallCoord : (cx + uLocal);
      const vz = axis === 'x' ? (cz + uLocal) : wallCoord;
      formeretPts.push({
        x: vx + inNx * 0.04,
        y: yTopCurve - 0.08,
        z: vz + inNz * 0.04
      });
    }
    const formRib = createGothicRibGeometry(formeretPts, {
      width: 0.25,
      depth: 0.20,
      dropDir: [inNx * 0.72, -0.69, inNz * 0.72],
      highDetail
    });
    if (formRib) ribParts.push(formRib);

    if (!hasWindow) {
      appendPerforatedLunetteWall(shellParts, {
        cx, cz, axis, wallCoord, inNx, inNz, spanHalf, yBotCurve, yTopFn, steps, tileScale, hole: null
      });
      return;
    }

    const winBot = Math.max(ySpring + 0.14, wallHeight + 0.04);
    const splayHW = windowWidth * 0.5 * 1.16;
    const maxAllowedTop = ySpring + riseVal * gothicOgive(splayHW / spanHalf, 0.48) - 0.06;
    const winTop = Math.max(winBot + 0.65, Math.min(ySpring + riseVal - 0.16, maxAllowedTop));
    const splayBot = Math.max(yBotCurve + 0.04, winBot - 0.05);
    const splayTop = winTop + 0.06;

    appendPerforatedLunetteWall(shellParts, {
      cx,
      cz,
      axis,
      wallCoord,
      inNx,
      inNz,
      spanHalf,
      yBotCurve,
      yTopFn,
      steps,
      tileScale,
      hole: { halfW: splayHW, yBot: splayBot, yTop: splayTop }
    });

    appendClerestoryLancetWindow(shellParts, glassParts, ribParts, windowRegistry, {
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
      recessDepth: 0.42,
      splayHalfW: splayHW,
      splayBotY: splayBot,
      splayTopY: splayTop,
      addStoneFrame: true,
      highDetail
    });
  };

  if (addWestLunette) buildSideLunette('x', -1, addWestWindow);
  if (addEastLunette) buildSideLunette('x', +1, addEastWindow);
  if (addNorthLunette) buildSideLunette('z', -1, addNorthWindow);
  if (addSouthLunette) buildSideLunette('z', +1, addSouthWindow);
}

// Helper: Transverse Pointed Arch Rib + Crown Keystone Boss spanning X across a hall at zPos
function appendTransverseArchRib(ribParts, cx, innerHalfX, hx, zPos, ySpring, transRise, width = 0.54, depth = 0.42, segs = 18, highDetail = true) {
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
    tintB: 1.04,
    highDetail
  });
  if (geo) ribParts.push(geo);
  if (highDetail) {
    ribParts.push(createGothicKeystoneGeometry(cx, ySpring + transRise + 0.02, zPos, 0.64, false));
  }
}

// Watertight Vertical Pointed Tympanum Wall along Z = zPlane spanning x in [minX, maxX]
function buildGableTympanumZ(zPlane, minX, maxX, yBotFn, yTopFn, inwardNz, segs = 22, tileScale = 3.2) {
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
// 4. Giant 16-Bay Boss Throne Cathedral Clerestory Drum, Star-Ribbed Ogival Dome & Lantern
// ============================================================================
function buildBossCathedralDome(shellParts, ribParts, glassParts, windowRegistry, isMobile) {
  const highDetail = !isMobile;
  const spec = SOULS_CASTLE_ROOF_SPEC.bossHall;
  const cx = spec.cx;
  const cz = spec.cz;
  const R_outer = spec.outerSkirtRadius;
  const R_drum = spec.drumRadius;
  const R_inner = spec.innerRadius;
  const R_oculus = spec.oculusRadius;
  const ySpring = spec.springY;
  const yDrumTop = spec.drumTopY;
  const yOculus = spec.oculusY;
  const yLanternTop = spec.lanternTopY;
  const yLanternApex = spec.lanternApexY;
  const bays = spec.radialBays; // 16
  const bayAng = (Math.PI * 2) / bays;
  const baseAngOffset = bayAng * 0.5;
  const southClampZ = spec.doorZ - 0.05;
  const southDz = Math.abs(southClampZ - cz);
  const southClampHalfX = Math.sqrt(Math.max(16.0, R_outer * R_outer - southDz * southDz)) + 0.35;
  const southDrumHalfX = Math.sqrt(Math.max(12.0, R_drum * R_drum - southDz * southDz)) + 0.25;

  const ringSegs = isMobile ? 6 : 15;
  const subAngSegs = isMobile ? 2 : 5;
  const domeRise = yOculus - yDrumTop;

  // A0. Horizontal Stone Wall-to-Drum Soffit Collar (seals 16-segment curtain walls R=16.0..16.98 at y=12.15)
  {
    const colSegs = isMobile ? 32 : 64;
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
          x: px, y: ySpring, z: pz,
          u: (c / colSegs) * 30.0, v: r * 0.35,
          r: 0.64, g: 0.67, b: 0.74
        };
      }
    }
    shellParts.push(buildInwardGridGeometry(rows, cols, verts, () => [0, -1, 0]));
  }

  // A1 + D. 16-Bay Vertical Clerestory Drum w/ Perforated Manifold Bays & 8 Deep-Recessed Drum Windows!
  for (let b = 0; b < bays; b++) {
    const a0 = baseAngOffset + b * bayAng;
    const a1 = a0 + bayAng;
    const midAng = (a0 + a1) * 0.5;
    const inNx = -Math.cos(midAng);
    const inNz = -Math.sin(midAng);

    const p0x = cx + Math.cos(a0) * R_drum;
    const p0z = cz + Math.sin(a0) * R_drum;
    const p1x = cx + Math.cos(a1) * R_drum;
    const p1z = cz + Math.sin(a1) * R_drum;
    const isSouthClamped = (Math.sin(midAng) > 0.78 && Math.abs(cx + Math.cos(midAng) * R_drum) < southDrumHalfX + 0.6);
    const hasWin = (b % 2 === 0) && !isSouthClamped;

    if (!hasWin) {
      // Solid curved/clamped drum bay
      const cSegs = highDetail ? 4 : 2;
      const verts = new Array(2 * (cSegs + 1));
      for (let c = 0; c <= cSegs; c++) {
        const a = a0 + (bayAng * c) / cSegs;
        let px = cx + Math.cos(a) * R_drum;
        let pz = cz + Math.sin(a) * R_drum;
        if (pz > southClampZ && Math.abs(px) < southClampHalfX) pz = southClampZ;
        verts[c] = { x: px, y: ySpring - 0.04, z: pz, u: c * 0.8, v: 0.0, r: 0.68, g: 0.71, b: 0.78 };
        verts[cSegs + 1 + c] = { x: px, y: yDrumTop + 0.06, z: pz, u: c * 0.8, v: 0.65, r: 0.88, g: 0.92, b: 1.00 };
      }
      shellParts.push(buildInwardGridGeometry(2, cSegs + 1, verts, (mx, _my, mz) => [cx - mx, -0.05, cz - mz]));
    } else {
      // Chord plane from (p0x, p0z) to (p1x, p1z) with exact perforated hole & 0.44m splayed stone embrasure!
      const chordCx = (p0x + p1x) * 0.5;
      const chordCz = (p0z + p1z) * 0.5;
      const chordHalf = Math.hypot(p1x - p0x, p1z - p0z) * 0.5;
      const tx = (p1x - p0x) / (chordHalf * 2.0);
      const tz = (p1z - p0z) / (chordHalf * 2.0);
      const winW = Math.min(2.25, chordHalf * 1.32);
      const splayHW = winW * 0.5 * 1.15;
      const winBot = Math.max(ySpring + 0.22, spec.wallHeight + 0.05);
      const winTop = yDrumTop - 0.16;
      const splayBot = winBot - 0.05;
      const splayTop = winTop + 0.06;

      const emitChordStrip = (u0, u1, colsCount, botFn, topFn) => {
        const cols = colsCount + 1;
        const verts = new Array(2 * cols);
        for (let c = 0; c < cols; c++) {
          const uL = u0 + ((u1 - u0) * c) / colsCount;
          const yb = botFn(uL);
          const yt = Math.max(yb + 0.015, topFn(uL));
          const vx = chordCx + tx * uL;
          const vz = chordCz + tz * uL;
          verts[c] = { x: vx, y: yb, z: vz, u: uL / 3.0, v: yb / 3.0, r: 0.70, g: 0.74, b: 0.82 };
          verts[cols + c] = { x: vx, y: yt, z: vz, u: uL / 3.0, v: yt / 3.0, r: 0.90, g: 0.94, b: 1.03 };
        }
        shellParts.push(buildInwardGridGeometry(2, cols, verts, () => [inNx, -0.05, inNz]));
      };

      emitChordStrip(-chordHalf, -splayHW, 2, () => ySpring - 0.04, () => yDrumTop + 0.06);
      emitChordStrip(splayHW, chordHalf, 2, () => ySpring - 0.04, () => yDrumTop + 0.06);
      emitChordStrip(-splayHW, splayHW, 4, () => ySpring - 0.04, () => splayBot);
      emitChordStrip(-splayHW, splayHW, 6, (uL) => evalWindowContourY(uL / splayHW, splayBot, splayTop), () => yDrumTop + 0.06);

      appendClerestoryLancetWindow(shellParts, glassParts, ribParts, windowRegistry, {
        id: `clerestory_boss_drum_${b}`,
        roomId: 'boss_hall',
        x: chordCx,
        yBot: winBot,
        yTop: winTop,
        z: chordCz,
        width: winW,
        inwardNx: inNx,
        inwardNz: inNz,
        winKind: 0.0,
        recessDepth: 0.44,
        splayHalfW: splayHW,
        splayBotY: splayBot,
        splayTopY: splayTop,
        addStoneFrame: true,
        highDetail
      });
    }
  }

  // Helper evaluating a point on the 16-bay scalloped Gothic ogival dome (y = 14.07 -> 16.52)
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

  // A2. 16 High-Resolution Curved Scalloped Dome Shell Bays
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

        const ribCrease = 1.0 - 0.15 * Math.pow(Math.abs(bf - 0.5) * 2.0, 2.2);
        const heightShade = 0.70 + 0.34 * Math.pow(u, 0.70);
        const oculusGlow = u > 0.58 ? (u - 0.58) / 0.42 : 0.0;
        const ao = Math.max(0.60, heightShade * ribCrease);

        verts[r * cols + c] = {
          x: pt.x, y: pt.y, z: pt.z,
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

  // B. 16 Engaged Drum Pilasters + Sweeping 20-Segment Radial Gothic Dome Ribs + Chevron Star-Liernes (PC!)
  const ribSteps = isMobile ? 7 : 18;
  const midU = 0.48;
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
      depth: spec.ribThick * 0.80,
      dropDir: (pt) => {
        const dx = cx - pt.x;
        const dz = cz - pt.z;
        const d = Math.hypot(dx, dz) || 1;
        return [(dx / d) * 0.58, -0.82, (dz / d) * 0.58];
      },
      tintR: 1.00,
      tintG: 1.02,
      tintB: 1.08,
      highDetail
    });
    if (radialRib) ribParts.push(radialRib);

    // High-Gothic Chevron Star-Lierne Ribs weaving across each dome bay + Secondary Bosses on PC!
    if (highDetail) {
      const nextAng = ang + bayAng;
      const midAng = ang + bayAng * 0.5;
      // 2 diagonal star-tiercerons rising from base of ribs `b` & `b+1` to mid-dome bay center `(midAng, midU)`!
      for (const srcAng of [ang, nextAng]) {
        const liernePts = [];
        for (let k = 0; k <= 7; k++) {
          const f = k / 7;
          const uCur = midU * f;
          const aCur = srcAng + (midAng - srcAng) * f;
          const bf = (aCur - ang) / bayAng;
          const pt = evalDomePoint(aCur, uCur, bf);
          liernePts.push({ x: pt.x, y: pt.y - 0.04, z: pt.z });
        }
        const lGeo = createGothicRibGeometry(liernePts, {
          width: spec.ribThick * 0.62,
          depth: spec.ribThick * 0.50,
          dropDir: (pt) => {
            const dx = cx - pt.x;
            const dz = cz - pt.z;
            const d = Math.hypot(dx, dz) || 1;
            return [(dx / d) * 0.58, -0.82, (dz / d) * 0.58];
          },
          highDetail: true
        });
        if (lGeo) ribParts.push(lGeo);
      }
      const bossPt = evalDomePoint(midAng, midU, 0.5);
      if (!(bossPt.z > southClampZ - 0.1 && Math.abs(bossPt.x) < southClampHalfX)) {
        ribParts.push(createGothicKeystoneGeometry(bossPt.x, bossPt.y, bossPt.z, 0.58, false));
      }
    }

    const wallX = cx + Math.cos(ang) * (R_inner + 0.04);
    const wallZ = cz + Math.sin(ang) * (R_inner + 0.04);
    if (!(wallZ > spec.doorZ - 0.6 && Math.abs(wallX) < spec.doorHalfW + 1.0)) {
      ribParts.push(
        createWallCorbelGeometry(wallX, ySpring + 0.02, wallZ, -Math.cos(ang), -Math.sin(ang), 0.84, 0.70, 1.28, highDetail)
      );
    }
  }

  // C. 4 Concentric Cathedral Structural Rings (smooth 64-seg on PC!)
  const ringSegCount = isMobile ? 32 : 64;
  const ringConfigs = [
    { r: R_inner - 0.02, y: ySpring + 0.06, w: 0.52, d: 0.40, segs: ringSegCount, clampSouth: true },
    { r: R_drum - 0.16, y: yDrumTop, w: 0.50, d: 0.38, segs: ringSegCount, clampSouth: true },
    {
      r: R_oculus + (R_drum - 0.14 - R_oculus) * Math.pow(Math.cos(midU * Math.PI * 0.5), 0.86),
      y: yDrumTop + domeRise * Math.pow(Math.sin(midU * Math.PI * 0.5), 0.78),
      w: 0.44,
      d: 0.34,
      segs: ringSegCount,
      clampSouth: false
    },
    { r: R_oculus, y: yOculus, w: 0.62, d: 0.48, segs: isMobile ? 24 : 48, clampSouth: false }
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
      tintB: 1.08,
      highDetail
    });
    if (ringGeo) ribParts.push(ringGeo);
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
      tintB: 1.12,
      highDetail
    });
    if (pierGeo) ribParts.push(pierGeo);

    const chordW = 2.0 * (lRadius - 0.14) * Math.sin(lStep * 0.5) - 0.18;
    const wx = cx + Math.cos(winAng) * (lRadius - 0.08);
    const wz = cz + Math.sin(winAng) * (lRadius - 0.08);
    appendClerestoryLancetWindow(null, glassParts, ribParts, windowRegistry, {
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
      recessDepth: 0.0,
      addStoneFrame: highDetail,
      highDetail
    });
  }

  const capRingPts = [];
  for (let i = 0; i < lBays * 2; i++) {
    const a = (i / (lBays * 2)) * Math.PI * 2;
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
    tintB: 1.12,
    highDetail
  });
  if (lanternCrownRing) ribParts.push(lanternCrownRing);

  const drumRows = 2;
  const drumCols = lBays + 1;
  const drumVerts = new Array(drumRows * drumCols);
  for (let r = 0; r < drumRows; r++) {
    const vy = r === 0 ? (yOculus - 0.05) : (yLanternTop + 0.08);
    for (let c = 0; c < drumCols; c++) {
      const a = (c % lBays) * lStep;
      drumVerts[r * drumCols + c] = {
        x: cx + Math.cos(a) * (lRadius + 0.14),
        y: vy,
        z: cz + Math.sin(a) * (lRadius + 0.14),
        u: (c / lBays) * 4.5,
        v: r * 0.5,
        r: 0.72,
        g: 0.80,
        b: 0.96
      };
    }
  }
  shellParts.push(buildInwardGridGeometry(drumRows, drumCols, drumVerts, (mx, _my, mz) => [cx - mx, -0.15, cz - mz]));

  const capRows = highDetail ? 5 : 3;
  const capCols = (highDetail ? lBays * 2 : lBays) + 1;
  const capSegs = capCols - 1;
  const capVerts = new Array(capRows * capCols);
  for (let r = 0; r < capRows; r++) {
    const f = r / (capRows - 1);
    const rad = (lRadius + 0.14) * (1.0 - f);
    const vy = yLanternTop + (yLanternApex - yLanternTop) * Math.sin(f * Math.PI * 0.5);
    for (let c = 0; c < capCols; c++) {
      const a = (c % capSegs) * ((Math.PI * 2) / capSegs);
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

  for (let i = 0; i < lBays; i++) {
    const a = i * lStep;
    const pts = [
      { x: cx + Math.cos(a) * lRadius, y: yLanternTop, z: cz + Math.sin(a) * lRadius },
      { x: cx + Math.cos(a) * (lRadius * 0.5), y: (yLanternTop + yLanternApex) * 0.5 + 0.08, z: cz + Math.sin(a) * (lRadius * 0.5) },
      { x: cx, y: yLanternApex, z: cz }
    ];
    const capRib = createGothicRibGeometry(pts, { width: 0.24, depth: 0.18, dropDir: [0, -1, 0], highDetail });
    if (capRib) ribParts.push(capRib);
  }
  ribParts.push(createGothicKeystoneGeometry(cx, yLanternApex, cz, 1.50, highDetail));

  // F. Watertight South Boss Portal Tympanum Wall + Triumphal Arch
  const bossPortalTopFn = (x) => {
    const dist = Math.hypot(x - cx, southClampZ - cz);
    const cosTerm = clamp01((dist - R_oculus) / (R_drum - R_oculus));
    const u = Math.acos(Math.pow(cosTerm, 1.0 / 0.86)) / (Math.PI * 0.5);
    return yDrumTop + domeRise * Math.pow(Math.sin(u * Math.PI * 0.5), 0.78) + 0.30;
  };
  const bossPortalBotFn = (x) => (Math.abs(x) < spec.doorHalfW + 0.10 ? gothicBossDoorArchY(x) : 8.40);
  const tympHalfX = Math.max(6.25, southDrumHalfX);
  shellParts.push(buildGableTympanumZ(southClampZ, -tympHalfX, tympHalfX, bossPortalBotFn, bossPortalTopFn, -1, highDetail ? 32 : 22, 3.2));

  const pSegs = highDetail ? 24 : 16;
  const portalFramePts = [];
  for (let i = 0; i <= pSegs; i++) {
    const x = -tympHalfX + 0.20 + ((tympHalfX * 2 - 0.40) * i) / pSegs;
    portalFramePts.push({ x, y: bossPortalTopFn(x) - 0.18, z: southClampZ - 0.06 });
  }
  const portalArchRib = createGothicRibGeometry(portalFramePts, {
    width: 0.58,
    depth: 0.46,
    dropDir: [0, -0.78, -0.62],
    highDetail
  });
  if (portalArchRib) ribParts.push(portalArchRib);
}

// ============================================================================
// 5. High-Detail Wrought-Iron Chandeliers + 3D Chains + Melted Beeswax Candles
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

// Build a sculpted 3D melted beeswax pillar candle + wax drips tagged with `aPivotPhase` + `aWaxGlow`
function appendMeltedWaxCandle(candleParts, cx, baseY, cz, candleH, candleR, pivotX, pivotY, pivotZ, phase, flickerPhase, highDetail) {
  const segs = highDetail ? 8 : 6;
  const geo = new THREE.CylinderGeometry(candleR * 0.90, candleR * 1.04, candleH, segs, 2, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    // Organic melted lip undulation along top rim
    if (ly > candleH * 0.25) {
      const ang = Math.atan2(lz, lx);
      const melt = 0.016 * Math.sin(ang * 3.0 + flickerPhase) + 0.010 * Math.cos(ang * 5.0);
      pos.setY(i, ly + melt);
    }
  }
  geo.translate(cx, baseY + candleH * 0.5, cz);
  geo.computeVertexNormals();

  const parts = [geo];
  if (highDetail) {
    // 2 organic solidified wax drip rivulets down the side of the candle + smaller secondary stub!
    for (let d = 0; d < 2; d++) {
      const dAng = flickerPhase * 1.3 + d * 2.35;
      const dh = candleH * (0.48 + d * 0.22);
      const drip = new THREE.CylinderGeometry(candleR * 0.22, candleR * 0.30, dh, 5);
      drip.translate(
        cx + Math.cos(dAng) * (candleR * 0.88),
        baseY + candleH - dh * 0.52,
        cz + Math.sin(dAng) * (candleR * 0.88)
      );
      parts.push(drip);
    }
  }

  for (let p = 0; p < parts.length; p++) {
    const g = parts[p].index ? parts[p].toNonIndexed() : parts[p].clone();
    parts[p].dispose();
    for (const attrName of Object.keys(g.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        g.deleteAttribute(attrName);
      }
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const piv = new Float32Array(n * 4);
    const glow = new Float32Array(n * 2); // [waxTop01, flickerPhase]
    const gp = g.attributes.position;
    for (let i = 0; i < n; i++) {
      piv[i * 4] = pivotX;
      piv[i * 4 + 1] = pivotY;
      piv[i * 4 + 2] = pivotZ;
      piv[i * 4 + 3] = phase;
      const h01 = clamp01((gp.getY(i) - baseY) / Math.max(0.05, candleH));
      glow[i * 2] = h01;
      glow[i * 2 + 1] = flickerPhase;
    }
    g.setAttribute('aPivotPhase', new THREE.BufferAttribute(piv, 4));
    g.setAttribute('aWaxGlow', new THREE.BufferAttribute(glow, 2));
    candleParts.push(g);
  }
}

function appendChandelierTier(ironParts, candleParts, flameSpecs, cfg, tierRadius, tierY, cupCount, isUpperTier, highDetail) {
  const { x, z, pivotY, phase } = cfg;
  const push = (geo) => ironParts.push(tagChandelierPart(geo, x, pivotY, z, phase));

  // Smooth multi-segmented circular iron hoop on PC (2x smoother wheel silhouette!)
  const ringSegs = highDetail ? Math.max(16, cupCount * 2) : Math.max(8, cupCount);
  const bandH = isUpperTier ? 0.20 : (cfg.doubleTier ? 0.30 : 0.24);
  const bandThick = isUpperTier ? 0.058 : 0.078;

  for (let i = 0; i < ringSegs; i++) {
    const a0 = (i / ringSegs) * Math.PI * 2;
    const a1 = ((i + 1) / ringSegs) * Math.PI * 2;
    const am = (a0 + a1) * 0.5;
    const x0 = x + Math.cos(a0) * tierRadius;
    const z0 = z + Math.sin(a0) * tierRadius;
    const x1 = x + Math.cos(a1) * tierRadius;
    const z1 = z + Math.sin(a1) * tierRadius;
    const chord = Math.hypot(x1 - x0, z1 - z0) + 0.025;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const rotY = -Math.atan2(z1 - z0, x1 - x0);

    // Main forged iron band + proud top/bottom beveled iron rim moldings
    push(placeGeo(new THREE.BoxGeometry(chord, bandH, bandThick), mx, tierY, mz, 0, rotY, 0));
    push(placeGeo(new THREE.BoxGeometry(chord + 0.015, 0.045, bandThick + 0.048), mx, tierY + bandH * 0.48, mz, 0, rotY, 0));
    push(placeGeo(new THREE.BoxGeometry(chord + 0.015, 0.045, bandThick + 0.048), mx, tierY - bandH * 0.48, mz, 0, rotY, 0));

    // Pierced Gothic quatrefoil / rivet boss stud on outer band face (PC!)
    if (highDetail) {
      const rx = x + Math.cos(am) * (tierRadius + bandThick * 0.55);
      const rz = z + Math.sin(am) * (tierRadius + bandThick * 0.55);
      push(placeGeo(new THREE.OctahedronGeometry(0.032, 0), rx, tierY, rz));
    }

    // Gothic fleur-de-lis iron crown spike + hanging iron drop-finial along the wheel!
    const sx = x + Math.cos(a0) * tierRadius;
    const sz = z + Math.sin(a0) * tierRadius;
    const spikeH = (i % 2 === 0) ? 0.30 : 0.19;
    push(placeGeo(new THREE.ConeGeometry(0.048, spikeH, 4), sx, tierY + bandH * 0.5 + spikeH * 0.46, sz, 0, -a0 + Math.PI * 0.25, 0));
    if (highDetail && i % 2 === 0) {
      push(placeGeo(new THREE.ConeGeometry(0.040, 0.20, 4), sx, tierY - bandH * 0.5 - 0.10, sz, Math.PI, -a0 + Math.PI * 0.25, 0));
    }
  }

  // Cantilevered S-Scrollwork Forged Iron Sconce Cups + 3D Melted Wax Candles + Flames
  for (let i = 0; i < cupCount; i++) {
    const am = ((i + 0.5) / cupCount) * Math.PI * 2;
    const cupR = tierRadius + 0.18;
    const cx = x + Math.cos(am) * cupR;
    const cz = z + Math.sin(am) * cupR;
    const bracketX = x + Math.cos(am) * (tierRadius + 0.09);
    const bracketZ = z + Math.sin(am) * (tierRadius + 0.09);

    // Forged horizontal bracket arm + lower S-scrollwork strut
    push(placeGeo(new THREE.BoxGeometry(0.20, 0.044, 0.052), bracketX, tierY - 0.02, bracketZ, 0, -am, 0));
    if (highDetail) {
      const scroll = new THREE.BoxGeometry(0.20, 0.034, 0.038);
      scroll.rotateZ(0.52);
      scroll.rotateY(-am);
      scroll.translate(bracketX, tierY - 0.09, bracketZ);
      push(scroll);
    }

    // Wide fluted iron drip-saucer + ribbed sconce goblet + dark iron wick pricket
    push(placeGeo(new THREE.CylinderGeometry(0.135, 0.085, 0.048, highDetail ? 8 : 6), cx, tierY + 0.035, cz));
    push(placeGeo(new THREE.CylinderGeometry(0.088, 0.058, 0.12, highDetail ? 8 : 6), cx, tierY + 0.10, cz));

    const fPhase = i * 1.73 + phase * 3.1 + (isUpperTier ? 4.2 : 0);
    const candleH = (cfg.doubleTier ? (isUpperTier ? 0.24 : 0.30) : 0.25) * (0.88 + 0.22 * ((i * 37) % 5) / 4);
    const candleR = cfg.doubleTier ? 0.046 : 0.040;
    const candleBaseY = tierY + 0.15;

    appendMeltedWaxCandle(candleParts, cx, candleBaseY, cz, candleH, candleR, x, pivotY, z, phase, fPhase, highDetail);
    // Charred iron/cotton wick stub poking out of melted wax crater
    push(placeGeo(new THREE.CylinderGeometry(0.008, 0.010, 0.055, 4), cx, candleBaseY + candleH + 0.02, cz));

    flameSpecs.push({
      x: cx,
      y: candleBaseY + candleH + 0.09,
      z: cz,
      pivotX: x,
      pivotY,
      pivotZ: z,
      phase,
      flickerPhase: fPhase,
      scale: cfg.doubleTier ? (isUpperTier ? 0.34 : 0.42) : 0.32
    });
  }

  // Interior Radial Iron Cross-Spokes + Heavy Diagonal Suspension Chains!
  const spokeCount = cfg.doubleTier ? (isUpperTier ? 4 : 6) : 4;
  const collarY = Math.min(pivotY - 0.55, tierY + (cfg.doubleTier ? (isUpperTier ? 1.45 : 2.10) : 1.30));
  for (let s = 0; s < spokeCount; s++) {
    const a = (s / spokeCount) * Math.PI * 2 + (isUpperTier ? Math.PI * 0.25 : 0);
    const midR = tierRadius * 0.5;
    push(
      placeGeo(
        new THREE.BoxGeometry(tierRadius, 0.052, 0.052),
        x + Math.cos(a) * midR,
        tierY,
        z + Math.sin(a) * midR,
        0,
        -a,
        0
      )
    );

    const rimR = tierRadius - 0.06;
    const rimX = x + Math.cos(a) * rimR;
    const rimZ = z + Math.sin(a) * rimR;
    const dy = Math.max(0.3, collarY - tierY);
    const strutLen = Math.hypot(rimR, dy);
    const tiltAng = Math.atan2(rimR, dy);
    const mx = (rimX + x) * 0.5;
    const my = (tierY + collarY) * 0.5;
    const mz = (rimZ + z) * 0.5;
    const strut = new THREE.CylinderGeometry(0.024, 0.024, strutLen, 5);
    strut.rotateZ(tiltAng);
    strut.rotateY(-a);
    strut.translate(mx, my, mz);
    push(strut);

    // 3D Interlinked Diagonal Iron Chain Links along every stay-chain on PC!
    if (highDetail) {
      const diagLinks = Math.max(4, Math.min(12, Math.floor(strutLen / 0.30)));
      for (let lk = 0; lk < diagLinks; lk++) {
        const f = (lk + 0.5) / diagLinks;
        const lx = x + (rimX - x) * f;
        const ly = collarY + (tierY - collarY) * f;
        const lz = z + (rimZ - z) * f;
        const dLink = new THREE.TorusGeometry(0.064, 0.020, 4, 7);
        dLink.scale(0.66, 1.32, 1.0);
        dLink.rotateY((lk % 2) * (Math.PI * 0.5));
        dLink.rotateZ(tiltAng);
        dLink.rotateY(-a);
        dLink.translate(lx, ly, lz);
        push(dLink);
      }
    }
  }
}

function appendGothicChandelier(ironParts, candleParts, flameSpecs, ribParts, cfg, isMobile) {
  const highDetail = !isMobile;
  const { x, z, pivotY, wheelY, radius, cupCount, phase, doubleTier } = cfg;
  const push = (geo) => ironParts.push(tagChandelierPart(geo, x, pivotY, z, phase));

  if (cfg.id !== 'chandelier_boss_center') {
    ribParts.push(createGothicKeystoneGeometry(x, pivotY + 0.04, z, doubleTier ? 0.98 : 0.80, highDetail));
  }

  // 1. Heavy Ceiling Forged Iron Rosette & Swivel Shackle
  push(placeGeo(new THREE.CylinderGeometry(0.26, 0.19, 0.17, highDetail ? 12 : 8), x, pivotY - 0.18, z));
  push(placeGeo(new THREE.TorusGeometry(0.115, 0.034, highDetail ? 6 : 4, highDetail ? 12 : 8), x, pivotY - 0.30, z));

  // 2. Heavy Forged Vertical Iron Chain descending from keystone to upper hub canopy
  const hubCollarY = Math.min(pivotY - 0.55, doubleTier ? (cfg.upperY + 1.45) : (wheelY + 1.30));
  const chainTopY = pivotY - 0.34;
  const chainLen = Math.max(0.35, chainTopY - hubCollarY);
  const linkStep = isMobile ? 0.38 : 0.21;
  const linkCount = Math.max(2, Math.floor(chainLen / linkStep));
  const actualStep = chainLen / linkCount;

  push(placeGeo(new THREE.CylinderGeometry(0.026, 0.026, chainLen + 0.1, 6), x, (chainTopY + hubCollarY) * 0.5, z));
  for (let i = 0; i < linkCount; i++) {
    const ly = chainTopY - (i + 0.5) * actualStep;
    const rotY = (i % 2) * (Math.PI * 0.5);
    const link = new THREE.TorusGeometry(0.092, 0.028, highDetail ? 6 : 4, highDetail ? 10 : 6);
    link.scale(0.68, 1.36, 1.0);
    link.rotateY(rotY);
    link.translate(x, ly, z);
    push(link);
  }

  // 3. Central Forged Iron Hub Shaft, Flared Gothic Canopy Crowns & Hanging Cage Plumb Finial
  const shaftBotY = wheelY - 0.50;
  const shaftH = Math.max(0.5, hubCollarY - shaftBotY);
  const cylSegs = highDetail ? 10 : 6;
  push(placeGeo(new THREE.CylinderGeometry(0.068, 0.090, shaftH, cylSegs), x, (hubCollarY + shaftBotY) * 0.5, z));
  push(placeGeo(new THREE.CylinderGeometry(0.25, 0.14, 0.24, highDetail ? 12 : 8), x, hubCollarY, z));
  push(placeGeo(new THREE.CylinderGeometry(0.26, 0.30, 0.25, highDetail ? 12 : 8), x, wheelY, z));
  push(placeGeo(new THREE.ConeGeometry(0.165, 0.56, highDetail ? 8 : 6), x, wheelY - 0.72, z, Math.PI, 0, 0));
  if (highDetail) {
    // Ornate hanging forged iron ring beneath central plumb finial
    push(placeGeo(new THREE.TorusGeometry(0.12, 0.024, 5, 12), x, wheelY - 1.04, z));
  }

  // 4. Primary Lower Iron Wheel Tier (+ Upper Royal Crown Tier when tierCount >= 2!)
  appendChandelierTier(ironParts, candleParts, flameSpecs, cfg, radius, wheelY, cupCount, false, highDetail);
  if (doubleTier) {
    appendChandelierTier(ironParts, candleParts, flameSpecs, cfg, cfg.upperRadius, cfg.upperY, cfg.upperCupCount, true, highDetail);
    const rodCount = highDetail ? 8 : 4;
    for (let k = 0; k < rodCount; k++) {
      const a = (k / rodCount) * Math.PI * 2 + Math.PI / rodCount;
      const lx = x + Math.cos(a) * (cfg.upperRadius + 0.22);
      const lz = z + Math.sin(a) * (cfg.upperRadius + 0.22);
      const dy = cfg.upperY - wheelY;
      push(placeGeo(new THREE.CylinderGeometry(0.028, 0.028, dy, 5), lx, (wheelY + cfg.upperY) * 0.5, lz));
    }
  }
}

// Build 1 merged billboarded BufferGeometry for ALL chandelier candle flames
function buildChandelierFlamesGeometry(flameSpecs) {
  const count = flameSpecs.length;
  const positions = new Float32Array(count * 4 * 3);
  const quadOffsets = new Float32Array(count * 4 * 2);
  const uvs = new Float32Array(count * 4 * 2);
  const pivotPhases = new Float32Array(count * 4 * 4);
  const flameParams = new Float32Array(count * 4 * 2);
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
export function createSoulsCastleRoof(options = {}) {
  const isMobile = Boolean(options.isMobile);
  const highDetail = !isMobile;
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
  // A. Calibrated Next-Gen PBR Materials (PMREM reflections + 2K relief, 0 washout!)
  // ==========================================================================
  const srcDark = options.darkStoneMat || null;
  const srcTrim = options.trimStoneMat || null;
  const srcIron = options.ironMat || null;
  const pbr = options.pbr || null;

  const vaultAlbedoMap = options.vaultStoneAlbedo || pbr?.vaultStoneAlbedo || srcDark?.map || pbr?.ashlarAlbedo || null;
  const vaultNormalMap = options.vaultStoneNormal || pbr?.vaultStoneNormal || srcDark?.normalMap || pbr?.ashlarNormal || null;
  const vaultRoughMap = srcDark?.roughnessMap || pbr?.ashlarRoughness || null;
  const baseNormalScale = isMobile ? 0.85 : 1.12;

  // DC #1 Material: Soot-Darkened Gothic Vaulted Ceiling Stone (harmonized cool indigo-slate w/ castle walls!)
  const vaultShellMat = trackMat(new THREE.MeshStandardMaterial({
    map: vaultAlbedoMap,
    normalMap: lowSpecMode ? null : vaultNormalMap,
    normalScale: new THREE.Vector2(baseNormalScale, baseNormalScale),
    roughnessMap: vaultRoughMap,
    color: 0x626c88,
    emissive: new THREE.Color(0x131b30),
    emissiveMap: vaultAlbedoMap,
    emissiveIntensity: 0.24,
    roughness: 0.92,
    metalness: 0.04,
    envMapIntensity: 0.44,
    vertexColors: true,
    side: THREE.FrontSide
  }));

  // DC #2 Material: Dressed Slate 10-Face Gothic Ribs, Star-Tiercerons & Foliate Keystones (STRICT THREE.FrontSide!)
  const ribAlbedoMap = srcTrim?.map || pbr?.ashlarAlbedo || vaultAlbedoMap;
  const ribNormalMap = srcTrim?.normalMap || pbr?.ashlarNormal || vaultNormalMap;
  const ribRoughMap = srcTrim?.roughnessMap || pbr?.ashlarRoughness || vaultRoughMap;

  const vaultRibsMat = trackMat(new THREE.MeshStandardMaterial({
    map: ribAlbedoMap,
    normalMap: lowSpecMode ? null : ribNormalMap,
    normalScale: new THREE.Vector2(baseNormalScale * 0.88, baseNormalScale * 0.88),
    roughnessMap: ribRoughMap,
    color: 0x76819e,
    emissive: new THREE.Color(0x11192b),
    emissiveMap: ribAlbedoMap,
    emissiveIntensity: 0.20,
    roughness: 0.86,
    metalness: 0.06,
    envMapIntensity: 0.50,
    vertexColors: true,
    side: THREE.FrontSide
  }));

  // DC #3 Material: Deep-Recessed Stained-Glass Clerestory Windows w/ Sapphire-Lunar Lead Tracery (STRICT THREE.FrontSide!)
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

        // Outer leaded border & horizontal wrought-iron saddle bars
        float outerLead = smoothstep(0.90, 0.96, cx) + smoothstep(0.04, 0.0, uv.y) + smoothstep(0.95, 0.99, uv.y);
        float centerBar = 1.0 - smoothstep(0.020, 0.038, abs(uv.x - 0.5));
        float hBar1 = 1.0 - smoothstep(0.011, 0.022, abs(uv.y - 0.28));
        float hBar2 = 1.0 - smoothstep(0.011, 0.022, abs(uv.y - 0.56));

        // Gothic arch-head quatrefoil rose medallion
        vec2 roseDelta = vec2((uv.x - 0.5) * 1.35, (uv.y - 0.77) * 2.05);
        float roseDist = length(roseDelta);
        float roseAng = atan(roseDelta.y, roseDelta.x);
        float rosePetals = abs(roseDist - (0.21 + 0.035 * cos(roseAng * 4.0)));
        float roseRing = 1.0 - smoothstep(0.020, 0.048, rosePetals);
        float roseCore = 1.0 - smoothstep(0.04, 0.075, roseDist);

        // Fine medieval diamond quarry lead-caming lattice
        float d1 = abs(fract(uv.x * 6.0 + uv.y * 9.5) - 0.5);
        float d2 = abs(fract(uv.x * 6.0 - uv.y * 9.5) - 0.5);
        float diamondLead = (1.0 - smoothstep(0.026, 0.054, d1)) + (1.0 - smoothstep(0.026, 0.054, d2));

        float leadMask = clamp(outerLead + centerBar + hBar1 + hBar2 + roseRing + roseCore * 0.55 + diamondLead * 0.56, 0.0, 1.0);

        // Rich gothic stained-glass palette: deep cobalt-sapphire border -> pale lunar silver-blue core + subtle warm gold rose heart
        float borderBand = smoothstep(0.68, 0.90, cx);
        float vGrad = smoothstep(0.0, 0.86, uv.y);
        float archCore = 1.0 - smoothstep(0.0, 0.90, cx * 0.72 + abs(uv.y - 0.62) * 0.55);

        vec3 sapphireEdge = vec3(0.11, 0.21, 0.44);
        vec3 deepLunar    = vec3(0.22, 0.36, 0.60);
        vec3 paleLunar    = vec3(0.52, 0.73, 0.98);
        vec3 moonHeart    = vec3(0.74, 0.88, 1.00);
        vec3 goldRoseTint = vec3(0.76, 0.62, 0.36);

        vec3 glassCol = mix(deepLunar, paleLunar, vGrad * 0.62 + archCore * 0.38);
        glassCol = mix(glassCol, sapphireEdge, borderBand * 0.65);
        glassCol = mix(glassCol, moonHeart, archCore * (0.24 + 0.30 * vKind));
        float inRose = 1.0 - smoothstep(0.14, 0.22, roseDist);
        glassCol = mix(glassCol, goldRoseTint, inRose * 0.38);

        if (uLowSpec < 0.5) {
          float cloudWave = 0.88 + 0.12 * sin(uv.x * 4.2 + uTime * 0.24 + vWorldPos.z * 0.15)
                                       * cos(uv.y * 3.1 - uTime * 0.18 + vWorldPos.x * 0.12);
          vec3 viewDir = normalize(uCamPos - vWorldPos);
          float fresnel = pow(1.0 - max(0.0, dot(normalize(vWorldNormal), viewDir)), 2.0);
          glassCol *= cloudWave * (1.0 + fresnel * 0.24);
        }

        glassCol *= (0.96 + 0.28 * vKind);

        vec3 leadCol = vec3(0.026, 0.032, 0.048);
        vec3 finalCol = mix(glassCol, leadCol, leadMask);

        float camDist = length(uCamPos - vWorldPos);
        float fogAmt = smoothstep(30.0, 108.0, camDist) * 0.52;
        finalCol = mix(finalCol, vec3(0.050, 0.064, 0.104), fogAmt);

        float alpha = mix(0.84 + 0.08 * vKind, 0.97, leadMask);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `
  }));

  // DC #4 Material: Hand-Forged Blackened Wrought-Iron Chandeliers w/ Metallic PMREM Glints + GPU Pendulum Sway!
  const ironNormalMap = srcIron?.normalMap || pbr?.ironNormal || null;
  const ironRoughMap = srcIron?.roughnessMap || pbr?.ironRoughness || null;
  const chandelierSwayUniforms = {
    uTime: { value: 0 },
    uSwayAmp: { value: lowSpecMode ? 0.45 : 1.0 }
  };

  const chandeliersIronMat = trackMat(new THREE.MeshStandardMaterial({
    normalMap: lowSpecMode ? null : ironNormalMap,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: ironRoughMap,
    color: new THREE.Color(0x323846),
    emissive: new THREE.Color(0x180e07),
    emissiveIntensity: 0.18,
    roughness: 0.48,
    metalness: 0.88,
    envMapIntensity: 1.45,
    side: THREE.FrontSide
  }));
  chandeliersIronMat.customProgramCacheKey = () => 'souls_chandelier_pendulum_v3';
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

  // DC #5 Material: 3D Melted Beeswax Pillar Candles w/ Warm Subsurface Flame-Top Translucency & GPU Sway!
  const chandelierCandlesMat = trackMat(new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdccfb4),
    roughness: 0.62,
    metalness: 0.02,
    emissive: new THREE.Color(0x2e1c0a),
    emissiveIntensity: 0.35,
    side: THREE.FrontSide
  }));
  chandelierCandlesMat.customProgramCacheKey = () => 'souls_chandelier_wax_sss_v1';
  chandelierCandlesMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = chandelierSwayUniforms.uTime;
    shader.uniforms.uSwayAmp = chandelierSwayUniforms.uSwayAmp;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aPivotPhase;
        attribute vec2 aWaxGlow;
        uniform float uTime;
        uniform float uSwayAmp;
        varying vec2 vWaxGlow;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWaxGlow = aWaxGlow;
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
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        varying vec2 vWaxGlow;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float sssFlick = 0.86 + 0.14 * sin(uTime * 9.5 + vWaxGlow.y);
        float topTranslucency = pow(clamp(vWaxGlow.x, 0.0, 1.0), 2.4);
        totalEmissiveRadiance += vec3(0.96, 0.52, 0.14) * topTranslucency * sssFlick * 0.92;`
      );
  };

  // DC #6 Material: Multi-Layer Blackbody Flickering Candle Flames locked bit-for-bit to Wick Tips!
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
      varying float vPhase;
      void main() {
        vUv = uv;
        float fPhase = aFlameParam.x;
        float fScale = aFlameParam.y;
        vPhase = fPhase;
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
        float wSize = fScale * (0.90 + 0.10 * flick);
        float hSize = fScale * 1.44 * flick;
        float tipSway = sin(uTime * 11.2 + fPhase) * 0.075 * pow(max(0.0, uv.y), 1.4);
        mvCenter.x += (aQuadOffset.x + tipSway) * wSize;
        mvCenter.y += aQuadOffset.y * hSize;
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vFlicker;
      varying float vPhase;
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * 2.0, vUv.y);
        float wobble = sin(p.y * 6.5 - uTime * 13.0 + vPhase) * 0.07 * p.y;
        float px = p.x + wobble;
        float widthAtY = mix(0.64, 0.04, pow(clamp(p.y, 0.0, 1.0), 0.74));
        float dx = abs(px) / max(0.035, widthAtY);
        float flameBody = smoothstep(1.0, 0.14, dx) * smoothstep(0.0, 0.13, p.y) * smoothstep(1.0, 0.38, p.y);
        float innerCore = smoothstep(0.58, 0.04, length(vec2(px * 1.65, (p.y - 0.22) * 2.15)));
        float blueBase  = smoothstep(0.42, 0.04, length(vec2(px * 1.9, (p.y - 0.09) * 3.4)));
        float halo = smoothstep(0.96, 0.04, length(vec2(px * 0.90, (p.y - 0.34) * 1.12))) * 0.26;

        float intensity = clamp(flameBody * 0.92 + innerCore * 0.88 + halo, 0.0, 1.0);
        if (intensity < 0.015) discard;

        vec3 crimsonVeil = vec3(0.92, 0.24, 0.03);
        vec3 amberBody   = vec3(1.00, 0.66, 0.16);
        vec3 hotCore     = vec3(1.00, 0.96, 0.82);
        vec3 col = mix(crimsonVeil, amberBody, clamp(flameBody * 1.15, 0.0, 1.0));
        col = mix(col, vec3(0.35, 0.55, 1.0), blueBase * 0.32);
        col = mix(col, hotCore, clamp(innerCore, 0.0, 1.0));
        gl_FragColor = vec4(col * vFlicker, intensity * 0.90);
      }
    `
  }));

  const normalMappedMats = [
    { mat: vaultShellMat, map: vaultNormalMap },
    { mat: vaultRibsMat, map: ribNormalMap },
    { mat: chandeliersIronMat, map: ironNormalMap }
  ];

  // ==========================================================================
  // B. Assemble All High-Gothic Architectural Roof Buckets
  // ==========================================================================
  const shellParts = [];
  const ribParts = [];
  const glassParts = [];
  const windowRegistry = [];

  // 2x higher curve & vault tessellation on PC (`highDetail`), lean on Mobile!
  const segU = isMobile ? 4 : 10;
  const segT = isMobile ? 3 : 8;

  // --------------------------------------------------------------------------
  // 1. BONFIRE HALL (`courtyard`, x in [-9, +9], z in [20, 38], 3 Star-Groin Bays -> apexY = 11.4)
  // --------------------------------------------------------------------------
  const cy = SOULS_CASTLE_ROOF_SPEC.courtyard;
  const cyHalfInnerX = (cy.maxX - cy.minX) * 0.5;
  const cyHx = cyHalfInnerX + cy.wallOverlapX;

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
      highDetail,
      shellParts,
      ribParts,
      glassParts,
      windowRegistry,
      addWestLunette: true,
      addEastLunette: true,
      addWestWindow: true,
      addEastWindow: true,
      windowWidth: 1.88,
      includeKeystone: true,
      keystoneScale: b === 1 ? 1.28 : 1.12
    });
  }

  // Sculpted stone Bonfire smoke-oculus crown ring + radial collar bosses above Bonfire!
  if (cy.oculus) {
    const ocR = Math.min(2.15, cy.oculus.radius * 0.85);
    const ocY = evaluateExactRoofHeight('courtyard', cy.oculus.x, cy.oculus.z) - 0.14;
    const ocSegs = highDetail ? 32 : 16;
    const ocPts = [];
    for (let i = 0; i < ocSegs; i++) {
      const a = (i / ocSegs) * Math.PI * 2;
      ocPts.push({
        x: cy.oculus.x + Math.cos(a) * ocR,
        y: ocY,
        z: cy.oculus.z + Math.sin(a) * ocR
      });
    }
    const ocRing = createGothicRibGeometry(ocPts, {
      width: 0.38,
      depth: 0.30,
      dropDir: [0, -1, 0],
      closedLoop: true,
      tintR: 0.96,
      tintG: 0.98,
      tintB: 1.04,
      highDetail
    });
    if (ocRing) ribParts.push(ocRing);
  }

  // Courtyard Transverse Pointed Arches + Multi-Tiered Wall Corbels + Moulded Cornices
  const co = SOULS_CASTLE_ROOF_SPEC.corridor;
  const coHalfInnerX = (co.maxX - co.minX) * 0.5;
  const coHx = coHalfInnerX + co.wallOverlapX;

  for (let i = 0; i < cy.baysZ.length; i++) {
    const bz = Math.max(cy.minZ + 0.04, Math.min(cy.maxZ - 0.04, cy.baysZ[i]));
    appendTransverseArchRib(ribParts, 0, cyHalfInnerX, cyHx, bz, cy.springY, cy.transRise, 0.58, 0.44, isMobile ? 10 : 22, highDetail);
    ribParts.push(createWallCorbelGeometry(-cyHalfInnerX, cy.springY + 0.04, bz, 1, 0, 0.74, 0.58, 1.10, highDetail));
    ribParts.push(createWallCorbelGeometry(cyHalfInnerX, cy.springY + 0.04, bz, -1, 0, 0.74, 0.58, 1.10, highDetail));
  }
  ribParts.push(createWallCorniceGeometry(-cyHalfInnerX, cy.minZ, -cyHalfInnerX, cy.maxZ, cy.springY + 0.06, 1, 0, 0.46, 0.38, highDetail));
  ribParts.push(createWallCorniceGeometry(cyHalfInnerX, cy.minZ, cyHalfInnerX, cy.maxZ, cy.springY + 0.06, -1, 0, 0.46, 0.38, highDetail));
  ribParts.push(createWallCorniceGeometry(-cyHalfInnerX, cy.maxZ, cyHalfInnerX, cy.maxZ, cy.springY + 0.06, 0, -1, 0.46, 0.38, highDetail));
  ribParts.push(createWallCorniceGeometry(-cyHalfInnerX, cy.minZ, -coHalfInnerX, cy.minZ, cy.springY + 0.06, 0, 1, 0.46, 0.38, highDetail));
  ribParts.push(createWallCorniceGeometry(coHalfInnerX, cy.minZ, cyHalfInnerX, cy.minZ, cy.springY + 0.06, 0, 1, 0.46, 0.38, highDetail));

  // South Gable Perforated Tympanum (z = 38.02, normal -Z) + Deep-Recessed South Cathedral Lancet Window!
  const cyArchTopFn = (x) => cy.springY + cy.transRise * gothicOgive(Math.abs(x) / cyHx, 0.48) + 0.08;
  const southWinW = 2.25;
  const southSplayHW = southWinW * 0.5 * 1.16;
  const southWinBot = cy.wallHeight + 0.06;
  const southWinTop = cy.springY + cy.transRise - 0.24;
  appendPerforatedLunetteWall(shellParts, {
    cx: 0,
    cz: cy.maxZ + 0.02,
    axis: 'z',
    wallCoord: cy.maxZ + 0.02,
    inNx: 0,
    inNz: -1,
    spanHalf: cyHx,
    yBotCurve: cy.springY - 0.16,
    yTopFn: cyArchTopFn,
    steps: highDetail ? 26 : 16,
    tileScale: 3.2,
    hole: { halfW: southSplayHW, yBot: southWinBot - 0.05, yTop: southWinTop + 0.06 }
  });
  appendClerestoryLancetWindow(shellParts, glassParts, ribParts, windowRegistry, {
    id: 'clerestory_courtyard_south_center',
    roomId: 'courtyard',
    x: 0.0,
    yBot: southWinBot,
    yTop: southWinTop,
    z: cy.maxZ + 0.02,
    width: southWinW,
    inwardNx: 0,
    inwardNz: -1,
    winKind: 0.0,
    recessDepth: 0.44,
    splayHalfW: southSplayHW,
    splayBotY: southWinBot - 0.05,
    splayTopY: southWinTop + 0.06,
    addStoneFrame: true,
    highDetail
  });

  // Watertight North Transition Tympanum (z = 19.98, normal +Z facing Courtyard)
  const coArchTopFn = (x) => co.springY + co.transRise * gothicOgive(Math.abs(x) / coHx, 0.48) + 0.06;
  const cyNorthBotFn = (x) => (Math.abs(x) < coHalfInnerX + 0.02 ? coArchTopFn(x) - 0.12 : cy.springY - 0.16);
  shellParts.push(buildGableTympanumZ(cy.minZ - 0.02, -cyHx, cyHx, cyNorthBotFn, cyArchTopFn, +1, highDetail ? 30 : 22, 3.2));

  // --------------------------------------------------------------------------
  // 2. GRAND 36m CASTLE CORRIDOR (`corridor`, x in [-5, +5], z in [-16, 20], 6 Star-Groin Bays -> apexY = 10.2)
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
      highDetail,
      shellParts,
      ribParts,
      glassParts,
      windowRegistry,
      addWestLunette: true,
      addEastLunette: true,
      addWestWindow: true,
      addEastWindow: true,
      windowWidth: 1.48,
      includeKeystone: true,
      keystoneScale: 0.98
    });
  }

  for (let i = 0; i < co.baysZ.length; i++) {
    const bz = Math.max(co.minZ + 0.08, Math.min(co.maxZ - 0.04, co.baysZ[i]));
    appendTransverseArchRib(ribParts, 0, coHalfInnerX, coHx, bz, co.springY, co.transRise, 0.50, 0.38, isMobile ? 9 : 20, highDetail);
    ribParts.push(createWallCorbelGeometry(-coHalfInnerX, co.springY + 0.04, bz, 1, 0, 0.60, 0.46, 0.90, highDetail));
    ribParts.push(createWallCorbelGeometry(coHalfInnerX, co.springY + 0.04, bz, -1, 0, 0.60, 0.46, 0.90, highDetail));
  }
  ribParts.push(createWallCorniceGeometry(-coHalfInnerX, co.minZ, -coHalfInnerX, co.maxZ, co.springY + 0.05, 1, 0, 0.40, 0.32, highDetail));
  ribParts.push(createWallCorniceGeometry(coHalfInnerX, co.minZ, coHalfInnerX, co.maxZ, co.springY + 0.05, -1, 0, 0.40, 0.32, highDetail));

  // Watertight Corridor North End Tympanum above Boss Doors (z = -15.95, normal +Z facing Corridor)
  const bossHalfW = SOULS_CASTLE_CONSTANTS.BOSS_PORTAL_HALF_W + 0.10;
  const coNorthBotFn = (x) => (Math.abs(x) < bossHalfW ? gothicBossDoorArchY(x) : co.springY - 0.16);
  shellParts.push(buildGableTympanumZ(co.minZ + 0.05, -coHx, coHx, coNorthBotFn, coArchTopFn, +1, highDetail ? 28 : 20, 3.2));

  // --------------------------------------------------------------------------
  // 3. EAST ALCOVE CHAPEL (`east_alcove`, x in [5.8, 13.8], z in [-5, 4] -> apexY = 8.9)
  // --------------------------------------------------------------------------
  const ea = SOULS_CASTLE_ROOF_SPEC.eastAlcove;
  const eaCx = (ea.minX + ea.maxX) * 0.5;
  const eaCz = (ea.minZ + ea.maxZ) * 0.5;
  const eaInnerHx = (ea.maxX - ea.minX) * 0.5;
  const eaInnerHz = (ea.maxZ - ea.minZ) * 0.5;
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
    highDetail,
    shellParts,
    ribParts,
    glassParts,
    windowRegistry,
    addWestLunette: true,
    addEastLunette: true,
    addNorthLunette: true,
    addSouthLunette: true,
    addWestWindow: false,
    addEastWindow: true,
    addNorthWindow: false,
    addSouthWindow: false,
    windowWidth: 1.65,
    includeKeystone: true,
    keystoneScale: 0.92
  });

  ribParts.push(createWallCorniceGeometry(ea.minX, ea.minZ, ea.maxX, ea.minZ, ea.springY + 0.05, 0, 1, 0.36, 0.28, highDetail));
  ribParts.push(createWallCorniceGeometry(ea.minX, ea.maxZ, ea.maxX, ea.maxZ, ea.springY + 0.05, 0, -1, 0.36, 0.28, highDetail));
  ribParts.push(createWallCorniceGeometry(ea.maxX, ea.minZ, ea.maxX, ea.maxZ, ea.springY + 0.05, -1, 0, 0.36, 0.28, highDetail));
  ribParts.push(createWallCorniceGeometry(ea.minX, ea.minZ, ea.minX, ea.maxZ, ea.springY + 0.05, 1, 0, 0.36, 0.28, highDetail));
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
          0.58,
          0.46,
          0.86,
          highDetail
        )
      );
    }
  }

  // --------------------------------------------------------------------------
  // 4. ENLARGED BOSS THRONE CATHEDRAL DOME (`boss_hall`, R=16.0, center (0, -31.2) -> apexY = 18.2)
  // --------------------------------------------------------------------------
  buildBossCathedralDome(shellParts, ribParts, glassParts, windowRegistry, isMobile);

  // --------------------------------------------------------------------------
  // 5. All 7 High-Detail Wrought-Iron Chandeliers + 3D Melted Wax Candles + Flames
  // --------------------------------------------------------------------------
  const ironParts = [];
  const candleParts = [];
  const flameSpecs = [];
  for (let i = 0; i < CHANDELIER_SPECS.length; i++) {
    appendGothicChandelier(ironParts, candleParts, flameSpecs, ribParts, CHANDELIER_SPECS[i], isMobile);
  }

  // ==========================================================================
  // C. Merge Into Strictly 6 Draw-Call Meshes (<= 7 DC Budget! 4 DC LowSpec!)
  // ==========================================================================
  // 1. Vaulted Ceiling Shell + Deep Splayed Window Embrasures [1 DC]
  const vaultShellGeo = trackGeo(mergeStoneParts(shellParts));
  vaultShellGeo.computeBoundingSphere();
  const vaultShellMesh = new THREE.Mesh(vaultShellGeo, vaultShellMat);
  vaultShellMesh.name = 'CastleVaultShell';
  vaultShellMesh.castShadow = false;
  vaultShellMesh.receiveShadow = false;
  group.add(vaultShellMesh);

  // 2. Sculpted 10-Face Gothic Ribs, Star-Tiercerons, Foliate Keystones & Y-Tracery [1 DC]
  const vaultRibsGeo = trackGeo(mergeStoneParts(ribParts));
  vaultRibsGeo.computeBoundingSphere();
  const vaultRibsMesh = new THREE.Mesh(vaultRibsGeo, vaultRibsMat);
  vaultRibsMesh.name = 'CastleVaultRibs';
  vaultRibsMesh.castShadow = false;
  vaultRibsMesh.receiveShadow = false;
  group.add(vaultRibsMesh);

  // 3. Deep-Recessed Moonlit Clerestory & Dome Lantern Stained-Glass Windows [1 DC]
  const clerestoryGlassGeo = trackGeo(mergeGeometries(glassParts, false));
  for (let i = 0; i < glassParts.length; i++) glassParts[i].dispose();
  clerestoryGlassGeo.computeBoundingSphere();
  const clerestoryGlassMesh = new THREE.Mesh(clerestoryGlassGeo, clerestoryGlassMat);
  clerestoryGlassMesh.name = 'CastleClerestoryGlass';
  clerestoryGlassMesh.castShadow = false;
  clerestoryGlassMesh.receiveShadow = false;
  clerestoryGlassMesh.renderOrder = 3;
  group.add(clerestoryGlassMesh);

  // 4. Merged Forged Wrought-Iron Chandeliers & 3D Chains [1 DC]
  const chandeliersIronGeo = trackGeo(mergeGeometries(ironParts, false));
  for (let i = 0; i < ironParts.length; i++) ironParts[i].dispose();
  applyBoxProjectedUVs(chandeliersIronGeo, 1.4);
  chandeliersIronGeo.computeBoundingSphere();
  const chandeliersIronMesh = new THREE.Mesh(chandeliersIronGeo, chandeliersIronMat);
  chandeliersIronMesh.name = 'CastleChandeliersIron';
  chandeliersIronMesh.castShadow = false;
  chandeliersIronMesh.receiveShadow = false;
  group.add(chandeliersIronMesh);

  // 5. Merged 3D Melted Beeswax Pillar Candles w/ Warm Subsurface Top Glow [1 DC, off in lowSpec]
  const chandelierCandlesGeo = trackGeo(mergeGeometries(candleParts, false));
  for (let i = 0; i < candleParts.length; i++) candleParts[i].dispose();
  chandelierCandlesGeo.computeBoundingSphere();
  const chandelierCandlesMesh = new THREE.Mesh(chandelierCandlesGeo, chandelierCandlesMat);
  chandelierCandlesMesh.name = 'CastleChandelierCandles';
  chandelierCandlesMesh.castShadow = false;
  chandelierCandlesMesh.receiveShadow = false;
  chandelierCandlesMesh.visible = !lowSpecMode;
  group.add(chandelierCandlesMesh);

  // 6. Merged GPU Billboarded Multi-Layer Blackbody Candle Flames [1 DC, off in lowSpec]
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

    // ZERO-HITCH: never strip normalMap or trigger mat.needsUpdate = true mid-combat (avoids 200-600ms shader recompile freeze!)
    glassUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    chandelierSwayUniforms.uSwayAmp.value = lowSpecMode ? 0.45 : 1.0;
    chandelierCandlesMesh.visible = !lowSpecMode;
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
    if (chandelierCandlesMesh.visible) dc++;
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
      chandelierCandlesMesh,
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
