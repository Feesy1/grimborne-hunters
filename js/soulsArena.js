// Chapter 26 — Dark Souls / Elden Ring Prototype Arena («Тропа Пепла» / Abandoned Knight Rift)
// Unified Modular Enclosed Gothic Castle Architecture (PC 60+ FPS & Yandex Games Mobile 60 FPS):
//   - Single source of truth layout & collision: ./souls/soulsCastleLayout.js
//     (Bonfire Hall -> Castle Corridor -> Compact East Alcove w/ Relic Shrine -> Boss Doors -> Throne Hall)
//   - Monumental animated twin oak-and-iron Boss Doors: ./souls/soulsCastleDoors.js
//   - High-detail 3D Props (Hero Bonfire w/ skull/bones/Coiled Sword, 8-bar caged braziers w/ solid colliders,
//     21 wall bracket lanterns, melted dripping-wax candles, swaying banners & Relic Shrine): ./souls/soulsCastleProps.js
//   - Shared procedural PBR albedo + matte anti-shimmer Sobel normalMap (0.88 PC / 0.78 Mobile) + roughnessMap: ./souls/soulsPbrTextures.js
//   - Dynamic nearest-light PointLight pool (2 PC / 2 Mobile / 1 LowSpec), 100% GPU embers/smoke & sky dome
//   - 100% invisible shadow-only 12-tri proxy replacing 58.5k-tri throne in shadow map pass

import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { DRACOLoader } from '../vendor/DRACOLoader.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';
import { createSoulsPbrTextures } from './souls/soulsPbrTextures.js?v=20261124z93';
import * as CastleLayout from './souls/soulsCastleLayout.js?v=20261124z93';
import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_BONFIRE,
  SOULS_CASTLE_PLAYER_SPAWN,
  SOULS_CASTLE_DOOR_CONFIG,
  SOULS_CASTLE_ROOMS,
  SOULS_CASTLE_FLOOR_SLABS,
  SOULS_CASTLE_WALL_SEGMENTS,
  SOULS_CASTLE_ARCHES,
  SOULS_CASTLE_PILLARS,
  SOULS_CASTLE_BRAZIERS,
  SOULS_CASTLE_WALL_LANTERNS,
  SOULS_CASTLE_CANDLE_CLUSTERS,
  SOULS_CASTLE_BANNERS,
  SOULS_CASTLE_CLERESTORY_SHAFTS,
  SOULS_CASTLE_ALCOVE_DECOR,
  SOULS_CASTLE_RELICS,
  SOULS_CASTLE_ENCOUNTERS,
  SOULS_CASTLE_THRONE_CONFIG,
  SOULS_CASTLE_FLAME_TRAPS,
  clampCastlePosition,
  getCastleSurfaceType,
  getCastleStaticColliders
} from './souls/soulsCastleLayout.js?v=20261124z93';
import { createWallFlameJetTraps } from './souls/soulsFireVfx.js?v=20261124z93';
import { createSoulsCastleDoors } from './souls/soulsCastleDoors.js?v=20261124z93';
import {
  createHeroBonfire3D,
  createGothicLanternBraziers3D,
  createMeltedCandleClusters3D,
  createCastleBannersAndShrines3D
} from './souls/soulsCastleProps.js?v=20261124z93';
import { createSoulsCastleRoof } from './souls/soulsCastleRoof.js?v=20261124z93';
import { createCastleAtmosphere } from './souls/soulsAtmosphere.js?v=20261124z93';
import {
  createSoulsFireShadowRig,
  buildFireSourcesFromCastleLayout
} from './souls/soulsLightingRig.js?v=20261124z93';

const sharedDracoLoader = new DRACOLoader();
sharedDracoLoader.setDecoderPath('./vendor/draco/');

const THRONE_GLB_URL = './assets/env/souls_throne.glb?v=20261124z93';

const BOSS_CENTER_Z = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;
const BOSS_RADIUS = SOULS_CASTLE_CONSTANTS.BOSS_RADIUS;
const BOSS_DOOR_Z = SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z;
const BONFIRE_POS = { x: SOULS_CASTLE_BONFIRE.x, z: SOULS_CASTLE_BONFIRE.z };
// Boss hall scale vs the original 13.2m prototype (medallion / floor ribs / ember field scale with the +21% arena)
const BOSS_HALL_SCALE = BOSS_RADIUS / 13.2;
// Boss stays hidden behind closed doors until the player is this close (P1 occlusion culling)
const BOSS_OCCLUSION_MARGIN_Z = 7.0;

// Single source of truth: Throne coordinates come straight from soulsCastleLayout.js (NO hard-coded copies!)
export const SOULS_THRONE_CONFIG = { ...SOULS_CASTLE_THRONE_CONFIG };

export const SOULS_CASTLE_ZONES = Object.freeze({
  bonfire: SOULS_CASTLE_BONFIRE,
  playerSpawn: SOULS_CASTLE_PLAYER_SPAWN,
  bossDoor: SOULS_CASTLE_DOOR_CONFIG,
  throne: SOULS_CASTLE_THRONE_CONFIG,
  rooms: SOULS_CASTLE_ROOMS,
  relics: SOULS_CASTLE_RELICS,
  encounters: SOULS_CASTLE_ENCOUNTERS,
  flameTraps: SOULS_CASTLE_FLAME_TRAPS
});

function detectMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPod|iPad|Android/i.test(navigator.userAgent || '') ||
    ((navigator.maxTouchPoints || 0) > 1 &&
      Math.min(window.innerWidth || 1280, window.innerHeight || 720) <= 1024)
  );
}

// Normalize geometry for safe mergeGeometries (non-indexed, position+normal+uv only)
function normalizeForMerge(rawGeo) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      g.deleteAttribute(attrName);
    }
  }
  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

// World-space box-projected UVs so every merged floor slab, wall, pilaster & arch has crisp uniform masonry scale
function applyBoxProjectedUVs(geo, tileScale = 3.6) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  if (!pos || !norm || !uv) return geo;
  const inv = 1 / Math.max(0.01, tileScale);
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

function mergeBucket(parts, tileScale = 0) {
  if (!parts.length) return null;
  const normalized = [];
  for (let i = 0; i < parts.length; i++) {
    const g = normalizeForMerge(parts[i]);
    if (tileScale > 0) applyBoxProjectedUVs(g, tileScale);
    normalized.push(g);
    parts[i].dispose();
  }
  const merged = mergeGeometries(normalized, false);
  for (let i = 0; i < normalized.length; i++) normalized[i].dispose();
  return merged;
}

function makeTranslatedGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

// Fluted gothic column shaft
function createFlutedShaftGeometry(rTop, rBot, height, radialSegs = 12) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, radialSegs, 3, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rad = Math.hypot(x, z);
    if (rad > 0.05) {
      const ang = Math.atan2(z, x);
      const flute = 1.0 - 0.065 * Math.pow(Math.max(0, Math.cos(ang * (radialSegs * 0.5))), 2.0);
      const endFade = Math.min(1, (height * 0.5 - Math.abs(y)) / 0.35);
      const k = 1.0 + (flute - 1.0) * Math.max(0, endFade);
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function createPillarBaseGeometry() {
  const parts = [
    makeTranslatedGeo(new THREE.BoxGeometry(1.74, 0.24, 1.74), 0, 0.12, 0),
    makeTranslatedGeo(new THREE.BoxGeometry(1.48, 0.28, 1.48), 0, 0.38, 0),
    makeTranslatedGeo(new THREE.CylinderGeometry(0.66, 0.76, 0.22, 8), 0, 0.62, 0, 0, Math.PI / 8, 0)
  ];
  return mergeBucket(parts, 2.2);
}

function createPillarCapitalGeometry() {
  const parts = [
    makeTranslatedGeo(new THREE.CylinderGeometry(0.74, 0.55, 0.34, 8), 0, 0.17, 0, 0, Math.PI / 8, 0),
    makeTranslatedGeo(new THREE.BoxGeometry(1.52, 0.16, 1.52), 0, 0.42, 0),
    makeTranslatedGeo(new THREE.BoxGeometry(1.82, 0.24, 1.82), 0, 0.62, 0)
  ];
  return mergeBucket(parts, 2.2);
}

function createBrokenPillarCapGeometry() {
  const parts = [
    makeTranslatedGeo(new THREE.CylinderGeometry(0.45, 0.56, 0.36, 7), -0.06, 0.14, 0.04, 0.24, 0.4, -0.18),
    makeTranslatedGeo(new THREE.BoxGeometry(0.54, 0.32, 0.40), 0.18, 0.12, -0.16, -0.22, 0.5, 0.32),
    makeTranslatedGeo(new THREE.BoxGeometry(0.35, 0.22, 0.32), -0.20, 0.08, -0.14, 0.18, -0.3, -0.26)
  ];
  return mergeBucket(parts, 2.0);
}

// Build a detailed double-order pointed gothic arch matching an entry in SOULS_CASTLE_ARCHES (axis 'x' or 'z')
function buildGothicArchGeometry(arch) {
  const parts = [];
  const halfSpan = arch.halfSpan;
  const springY = arch.springY;
  const apexY = arch.apexY;
  const depth = arch.depth || 1.1;
  const ribThick = 0.62;
  const segsPerSide = 6;

  for (const s of [-1, 1]) {
    for (let i = 0; i < segsPerSide; i++) {
      const t0 = i / segsPerSide;
      const t1 = (i + 1) / segsPerSide;
      const tm = (t0 + t1) * 0.5;
      const u0 = s * halfSpan * Math.pow(1 - t0, 0.82);
      const y0 = springY + (apexY - springY) * Math.sin(t0 * Math.PI * 0.5);
      const u1 = s * halfSpan * Math.pow(1 - t1, 0.82);
      const y1 = springY + (apexY - springY) * Math.sin(t1 * Math.PI * 0.5);
      const du = u1 - u0;
      const dy = y1 - y0;
      const len = Math.hypot(du, dy) + 0.14;
      const ang = Math.atan2(dy, du);
      const mu = (u0 + u1) * 0.5;
      const my = (y0 + y1) * 0.5;
      const thick = ribThick * (1.0 - tm * 0.14);
      if (arch.axis === 'z') {
        // Primary inner soffit voussoir rib
        parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth, thick, len), arch.x, my, arch.z + mu, -ang, 0, 0));
        // Secondary proud outer archivolt hood molding (deep 3D Gothic chamfered order!)
        parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth + 0.24, thick * 0.42, len * 1.03), arch.x, my + 0.24, arch.z + mu, -ang, 0, 0));
      } else {
        parts.push(makeTranslatedGeo(new THREE.BoxGeometry(len, thick, depth), arch.x + mu, my, arch.z, 0, 0, ang));
        parts.push(makeTranslatedGeo(new THREE.BoxGeometry(len * 1.03, thick * 0.42, depth + 0.24), arch.x + mu, my + 0.24, arch.z, 0, 0, ang));
      }
    }
    // 2-tier molded springing capital impost + bevel corbel bracket
    if (arch.axis === 'z') {
      parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth + 0.34, 0.28, 0.98), arch.x, springY + 0.12, arch.z + s * halfSpan));
      parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth + 0.22, 0.26, 0.78), arch.x, springY - 0.14, arch.z + s * halfSpan));
    } else {
      parts.push(makeTranslatedGeo(new THREE.BoxGeometry(0.98, 0.28, depth + 0.34), arch.x + s * halfSpan, springY + 0.12, arch.z));
      parts.push(makeTranslatedGeo(new THREE.BoxGeometry(0.78, 0.26, depth + 0.22), arch.x + s * halfSpan, springY - 0.14, arch.z));
    }
  }

  // Carved double-stepped keystone + upper wall spandrel beam + crown cornice connecting cleanly to vault
  const topY = arch.axis === 'z' ? SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT : SOULS_CASTLE_CONSTANTS.CORRIDOR_WALL_HEIGHT + 0.2;
  const spandrelH = Math.max(0.9, topY - apexY);
  if (arch.axis === 'z') {
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth + 0.36, 1.08, 0.74), arch.x, apexY + 0.10, arch.z));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth + 0.48, 0.42, 0.50), arch.x, apexY - 0.16, arch.z));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth, spandrelH, halfSpan * 2 + 0.5), arch.x, apexY + spandrelH * 0.5, arch.z));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(depth + 0.30, 0.30, halfSpan * 2 + 0.6), arch.x, topY - 0.15, arch.z));
  } else {
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(0.76, 1.12, depth + 0.36), arch.x, apexY + 0.10, arch.z));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(0.52, 0.44, depth + 0.48), arch.x, apexY - 0.16, arch.z));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(halfSpan * 2 + 0.6, spandrelH, depth * 0.92), arch.x, apexY + spandrelH * 0.5, arch.z));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(halfSpan * 2 + 0.7, 0.30, depth + 0.28), arch.x, topY - 0.15, arch.z));
  }

  return mergeBucket(parts, 2.8);
}

// Append a rich 3D gothic masonry wall segment (base plinth + body + pilasters + blind niches + cornice + optional lancet windows)
function appendRichCastleWallSegment(seg, lowerDark, lowerTrim, upperDark, upperTrim, splitHeight = 1.55) {
  const len = seg.length;
  const thick = seg.thickness;
  const h = seg.height;
  const rotY = seg.angleY;
  const isBossNorthWindow =
    seg.role === 'boss_cathedral' &&
    seg.z < BOSS_CENTER_Z - 4.0 &&
    (parseInt(seg.id.split('_').pop(), 10) % 2 === 0);

  // Local helper places a box in segment-local coords (u along length, y height, v along inward normal)
  const addLocalBox = (targetBucket, w, bh, d, u, y, v, rx = 0) => {
    const g = new THREE.BoxGeometry(w, bh, d);
    if (rx !== 0) g.rotateX(rx);
    g.translate(u, y, v);
    if (rotY !== 0) g.rotateY(rotY);
    g.translate(seg.x, 0, seg.z);
    targetBucket.push(g);
  };

  // Determine which local +Z / -Z faces inward toward room (normalX, normalZ)
  // After rotateY(rotY), local (0,0,1) maps to (sin(rotY), 0, cos(rotY))
  const dotInward = Math.sin(rotY) * (seg.normalX || 0) + Math.cos(rotY) * (seg.normalZ || 0);
  const inSign = dotInward >= 0 ? 1 : -1;

  // 1. Permanent lower solid stone wainscot & protruding chamfered plinth base (y = 0 .. splitHeight)
  const lowerH = Math.min(splitHeight, h);
  addLocalBox(lowerDark, len, lowerH, thick, 0, lowerH * 0.5, 0);
  addLocalBox(lowerTrim, len + 0.08, 0.52, thick + 0.34, 0, 0.26, inSign * 0.08);
  addLocalBox(lowerTrim, len + 0.06, 0.22, thick + 0.24, 0, lowerH - 0.06, inSign * 0.06);

  if (h <= splitHeight + 0.1) return;

  // 2. Upper castle masonry (y = splitHeight .. h)
  const upH = h - splitHeight;
  if (isBossNorthWindow) {
    // Lower solid wall up to window sill (y = splitHeight .. 5.8)
    const sillY = 5.8;
    const winTopY = 9.4;
    addLocalBox(upperDark, len, sillY - splitHeight, thick, 0, (splitHeight + sillY) * 0.5, 0);
    addLocalBox(upperTrim, len + 0.10, 0.34, thick + 0.28, 0, sillY + 0.04, inSign * 0.06);
    // Flanking stone jamb piers & slender central gothic mullion framing tall moonlit lancet window
    const jambW = len * 0.30;
    addLocalBox(upperTrim, jambW, winTopY - sillY, thick, -(len * 0.5 - jambW * 0.5), (sillY + winTopY) * 0.5, 0);
    addLocalBox(upperTrim, jambW, winTopY - sillY, thick, +(len * 0.5 - jambW * 0.5), (sillY + winTopY) * 0.5, 0);
    addLocalBox(upperTrim, 0.24, winTopY - sillY, 0.44, 0, (sillY + winTopY) * 0.5, 0);
    // Upper spandrel above window
    addLocalBox(upperDark, len, h - winTopY, thick, 0, (winTopY + h) * 0.5, 0);
  } else {
    addLocalBox(upperDark, len, upH, thick, 0, splitHeight + upH * 0.5, 0);
  }

  // 3. Mid-wall horizontal gothic string-course ledge & upper carved battlement cornice
  const midY = Math.min(h - 2.4, 5.2);
  addLocalBox(upperTrim, len + 0.08, 0.30, thick + 0.26, 0, midY, inSign * 0.06);
  addLocalBox(upperTrim, len + 0.14, 0.50, thick + 0.44, 0, h - 0.25, inSign * 0.10);

  // 4. Rhythmic engaged gothic buttress pilasters & recessed blind-arch hood moldings along long wall spans!
  if (len >= 4.2 && seg.role !== 'jamb') {
    const bays = Math.max(1, Math.min(5, Math.round(len / 4.4)));
    const bayW = len / bays;
    for (let i = 0; i <= bays; i++) {
      const u = -len * 0.5 + i * bayW;
      // Skip pilasters right at open edges of short segments
      if (i > 0 && i < bays) {
        addLocalBox(lowerTrim, 0.62, lowerH + 0.14, 0.42, u, (lowerH + 0.14) * 0.5, inSign * (thick * 0.5 + 0.14));
        addLocalBox(upperTrim, 0.58, upH, 0.38, u, splitHeight + upH * 0.5, inSign * (thick * 0.5 + 0.12));
      }
      if (i < bays && !isBossNorthWindow) {
        const bu = u + bayW * 0.5;
        // Pointed gothic blind-arch relief hood molding on inner wall face
        const archSpan = Math.min(1.6, bayW * 0.38);
        const archY = midY - 0.55;
        addLocalBox(upperTrim, archSpan * 1.15, 0.32, 0.26, bu - archSpan * 0.45, archY, inSign * (thick * 0.5 + 0.10));
        addLocalBox(upperTrim, archSpan * 1.15, 0.32, 0.26, bu + archSpan * 0.45, archY, inSign * (thick * 0.5 + 0.10));
        addLocalBox(upperTrim, 0.42, 0.46, 0.32, bu, midY - 0.26, inSign * (thick * 0.5 + 0.14));
      }
    }
  }

  // 4b. Rusticated ashlar quoins & chamfered plinth detail on Boss Gatehouse entry pylons (role === 'jamb')
  if (seg.role === 'jamb') {
    const portalSide = seg.x < 0 ? 1 : -1;
    const quoinU = portalSide * (len * 0.5 - 0.28);
    // Stepped chamfered pylon base molding
    addLocalBox(lowerTrim, len + 0.28, 0.34, thick + 0.52, 0, 0.17, 0);
    addLocalBox(lowerTrim, len + 0.18, 0.26, thick + 0.40, 0, 0.46, 0);
    // Alternating rusticated gothic corner quoin stones rising along the Boss Door jamb face
    for (let q = 0; q < 7; q++) {
      const qy = 1.15 + q * 0.92;
      if (qy > h - 0.8) break;
      const qw = (q % 2 === 0) ? 0.64 : 0.44;
      addLocalBox(q < 1 ? lowerTrim : upperTrim, qw, 0.46, thick + 0.32, quoinU - portalSide * (qw * 0.15), qy, 0);
    }
  }

  // 5. Vaulted ceiling rib springers curving inward around the top of the Boss Throne Cathedral!
  if (seg.role === 'boss_cathedral') {
    addLocalBox(upperTrim, 0.68, 0.58, 2.8, 0, h - 0.20, inSign * (thick * 0.5 + 1.15), -inSign * 0.30);
  }
}

// Distant Towering Gothic Keep Spires rising above the enclosed castle roofline (1 merged mesh!)
// All anchor points derive from the layout constants (boss hall centre/radius, courtyard & corridor extents)
function createDistantCastleKeepGeometry() {
  const parts = [];
  const cz = BOSS_CENTER_Z - BOSS_RADIUS - 20.0;
  const farFlankZ = BOSS_CENTER_Z + 0.4 * BOSS_RADIUS;
  const nearFlankZ = SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z - 2.0;
  const flankX = SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_X + 17.0;
  parts.push(makeTranslatedGeo(new THREE.BoxGeometry(16.0, 28, 5.2), 0, 12.0, cz));
  parts.push(makeTranslatedGeo(new THREE.ConeGeometry(7.2, 13.0, 4), 0, 32.0, cz, 0, Math.PI / 4, 0));
  for (const sx of [-11.5, 11.5]) {
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(5.2, 30, 5.2), sx, 13.0, cz + 3.0));
    parts.push(makeTranslatedGeo(new THREE.ConeGeometry(3.6, 13.5, 4), sx, 34.2, cz + 3.0, 0, Math.PI / 4, 0));
    const dir = Math.sign(sx);
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(8.0, 2.0, 2.2), sx + dir * 4.8, 16.0, cz + 4.0, 0, 0, -dir * 0.52));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(3.4, 24, 3.4), sx + dir * 8.4, 10.0, cz + 4.0));
  }
  for (const side of [-1, 1]) {
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(6.0, 24, 6.0), side * (flankX + 3), 10.0, farFlankZ, 0, side * 0.14, 0));
    parts.push(makeTranslatedGeo(new THREE.ConeGeometry(4.0, 9.5, 4), side * (flankX + 3), 26.5, farFlankZ, 0, Math.PI / 4 + side * 0.14, 0));
    parts.push(makeTranslatedGeo(new THREE.BoxGeometry(5.4, 22, 5.4), side * flankX, 9.0, nearFlankZ, 0, side * 0.18, 0));
    parts.push(makeTranslatedGeo(new THREE.ConeGeometry(3.6, 8.0, 4), side * flankX, 24.0, nearFlankZ, 0, Math.PI / 4 + side * 0.18, 0));
  }
  return mergeBucket(parts, 0);
}

// Continuous wide (~2.4m) beveled royal crimson-and-gold velvet ceremonial runner draped
// seamlessly from the Throne base down both dais steps and all the way to the Boss Doors.
// UVs: u in [0..1] across width (woven gold-filigree borders cleanly frame both edges),
//      v tiled evenly by real surface arc-length along treads, risers & cathedral aisle.
function createRoyalRunnerCarpetGeometry(tx, tz, bossDoorZ) {
  const CARPET_WIDTH = 2.40;
  const HALF_W = CARPET_WIDTH * 0.5;
  const HEM_BEVEL_X = 0.024;
  const SHOULDER_INSET = 0.045;
  const REPEAT_LEN = 2.40; // 1:1 square texel ratio matching CARPET_WIDTH

  const upperStepTopY = 0.505;
  const lowerStepTopY = 0.257;
  const floorBaseY = -0.002;
  const thick = 0.022;

  const upperTopY = upperStepTopY + thick; // 0.527
  const lowerTopY = lowerStepTopY + thick; // 0.279
  const aisleTopY = thick;                 // 0.022m proud off stone floor

  const zStart = tz + 1.560;        // Tucked cleanly against Throne front plinth on upper step
  const zUpperLip = tz + 2.495;     // Front trim lip of upper dais step
  const zLowerLip = tz + 3.490;     // Front trim lip of lower dais step
  const zAisleEnd = bossDoorZ - 1.15; // Stops cleanly before Boss Door stone threshold sill

  const stations = [
    // North beveled hem tucked against Throne plinth
    { topY: upperStepTopY - 0.002, topZ: zStart,                    baseY: upperStepTopY - 0.002, baseZ: zStart,                    pinched: true },
    { topY: upperTopY,             topZ: zStart + 0.022,            baseY: upperStepTopY - 0.002, baseZ: zStart + 0.022,            pinched: false },
    // Upper dais tread + nosing guard
    { topY: upperTopY,             topZ: zUpperLip - 0.018,         baseY: upperStepTopY - 0.002, baseZ: zUpperLip - 0.018,         pinched: false },
    { topY: upperTopY,             topZ: zUpperLip,                 baseY: upperStepTopY - 0.002, baseZ: zUpperLip,                 pinched: false },
    // Upper stair nosing bevel & vertical riser draped down onto lower step
    { topY: upperStepTopY,         topZ: zUpperLip + thick,         baseY: upperStepTopY - 0.010, baseZ: zUpperLip,                 pinched: false },
    { topY: lowerTopY,             topZ: zUpperLip + thick,         baseY: lowerStepTopY - 0.002, baseZ: zUpperLip,                 pinched: false },
    // Inner crease guard + lower dais tread + nosing guard
    { topY: lowerTopY,             topZ: zUpperLip + thick + 0.022, baseY: lowerStepTopY - 0.002, baseZ: zUpperLip + thick + 0.022, pinched: false },
    { topY: lowerTopY,             topZ: zLowerLip - 0.018,         baseY: lowerStepTopY - 0.002, baseZ: zLowerLip - 0.018,         pinched: false },
    { topY: lowerTopY,             topZ: zLowerLip,                 baseY: lowerStepTopY - 0.002, baseZ: zLowerLip,                 pinched: false },
    // Lower stair nosing bevel & vertical riser draped down onto Boss Hall stone floor
    { topY: lowerStepTopY,         topZ: zLowerLip + thick,         baseY: lowerStepTopY - 0.010, baseZ: zLowerLip,                 pinched: false },
    { topY: aisleTopY,             topZ: zLowerLip + thick,         baseY: floorBaseY,            baseZ: zLowerLip,                 pinched: false },
    // Inner crease guard onto cathedral floor
    { topY: aisleTopY,             topZ: zLowerLip + thick + 0.024, baseY: floorBaseY,            baseZ: zLowerLip + thick + 0.024, pinched: false }
  ];

  // Subdivide the long cathedral aisle so shadow & firelight shading interpolate smoothly
  const aisleStartZ = zLowerLip + thick + 0.024;
  const aisleLen = Math.max(0.5, zAisleEnd - aisleStartZ);
  const aisleSegs = Math.max(6, Math.round(aisleLen / 2.2));
  for (let i = 1; i <= aisleSegs; i++) {
    const zi = aisleStartZ + (aisleLen * i) / aisleSegs;
    stations.push({ topY: aisleTopY, topZ: zi, baseY: floorBaseY, baseZ: zi, pinched: false });
  }
  // South beveled woven end hem right in front of the Boss Doors threshold
  stations.push({ topY: floorBaseY, topZ: zAisleEnd + 0.024, baseY: floorBaseY, baseZ: zAisleEnd + 0.024, pinched: true });

  // 7-point lateral cross-section across width (u in [0..1] cleanly frames both gold-filigree borders)
  const lateralOffsets = [
    { x: tx - HALF_W - HEM_BEVEL_X,    u: 0.002, isBase: true  },
    { x: tx - HALF_W,                  u: 0.014, isBase: false },
    { x: tx - HALF_W + SHOULDER_INSET, u: 0.032, isBase: false },
    { x: tx,                           u: 0.500, isBase: false },
    { x: tx + HALF_W - SHOULDER_INSET, u: 0.968, isBase: false },
    { x: tx + HALF_W,                  u: 0.986, isBase: false },
    { x: tx + HALF_W + HEM_BEVEL_X,    u: 0.998, isBase: true  }
  ];
  const cols = lateralOffsets.length;
  const rows = stations.length;

  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);

  let arcLen = 0;
  for (let r = 0; r < rows; r++) {
    const st = stations[r];
    if (r > 0) {
      const prev = stations[r - 1];
      arcLen += Math.hypot(st.topZ - prev.topZ, st.topY - prev.topY);
    }
    const v = arcLen / REPEAT_LEN;
    for (let c = 0; c < cols; c++) {
      const lat = lateralOffsets[c];
      const useBase = st.pinched || lat.isBase;
      const vi = r * cols + c;
      positions[vi * 3] = lat.x;
      positions[vi * 3 + 1] = useBase ? st.baseY : st.topY;
      positions[vi * 3 + 2] = useBase ? st.baseZ : st.topZ;
      uvs[vi * 2] = lat.u;
      uvs[vi * 2 + 1] = v;
    }
  }

  const indices = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = (r + 1) * cols + c;
      const d = r * cols + (c + 1);
      const e = (r + 1) * cols + (c + 1);
      indices.push(a, b, e, a, e, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Safe fallback matching the physical Throne dais stone steps if soulsCastleLayout.js hasn't exported getCastleFloorHeight yet
function fallbackCastleFloorHeight(x = 0, z = 0) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  const dx = Math.abs(x - SOULS_THRONE_CONFIG.x);
  const dz = z - SOULS_THRONE_CONFIG.z;
  if ((dx <= 2.39 && dz >= 1.555 && dz <= 2.495) || (dx <= 0.83 && dz >= 1.16 && dz <= 1.60)) {
    return SOULS_THRONE_CONFIG.footrestY ?? 0.50;
  }
  if (dx <= 3.04 && dz >= 2.41 && dz <= 3.49) {
    return SOULS_THRONE_CONFIG.lowerStepY ?? 0.25;
  }
  if (dx <= 3.74 && dz >= -2.49 && dz <= 2.39) {
    return 0.06;
  }
  return 0;
}

// ============================================================================
// Main Souls Arena Factory (Compact Enclosed Gothic Castle + Modular Props & Doors)
// ============================================================================
export function createSoulsArena(options = {}) {
  const isMobile = options.isMobile !== undefined ? Boolean(options.isMobile) : detectMobileDevice();
  let lowSpecMode = Boolean(options.lowSpec);
  const stoneNormalStrength = isMobile ? 0.58 : 0.66;

  const group = new THREE.Group();
  group.visible = false;

  const ownedGeos = [];
  const ownedMats = [];
  const ownedTex = [];
  const trackGeo = (g) => { if (g) ownedGeos.push(g); return g; };
  const trackMat = (m) => { if (m) ownedMats.push(m); return m; };
  const trackTex = (t) => { if (t) ownedTex.push(t); return t; };

  const pbr = createSoulsPbrTextures({ isMobile });

  // ==========================================================================
  // Shared Matte Weathered Medieval PBR Materials (zero plastic brick glare!)
  // ==========================================================================
  const stoneFloorMat = trackMat(new THREE.MeshStandardMaterial({
    map: pbr.floorAlbedo,
    normalMap: lowSpecMode ? null : pbr.floorNormal,
    normalScale: new THREE.Vector2(stoneNormalStrength * 1.18, stoneNormalStrength * 1.18),
    roughnessMap: pbr.floorRoughness,
    color: 0xc0c6d6,
    roughness: 1.0,
    metalness: 0.04,
    envMapIntensity: 0.34
  }));

  const darkStoneMat = trackMat(new THREE.MeshStandardMaterial({
    map: pbr.ashlarAlbedo,
    normalMap: lowSpecMode ? null : pbr.ashlarNormal,
    normalScale: new THREE.Vector2(stoneNormalStrength, stoneNormalStrength),
    roughnessMap: pbr.ashlarRoughness,
    color: 0x7d869e,
    roughness: 1.0,
    metalness: 0.03,
    envMapIntensity: 0.20
  }));

  const trimStoneMat = trackMat(new THREE.MeshStandardMaterial({
    map: pbr.ashlarAlbedo,
    normalMap: lowSpecMode ? null : pbr.ashlarNormal,
    normalScale: new THREE.Vector2(stoneNormalStrength * 0.90, stoneNormalStrength * 0.90),
    roughnessMap: pbr.ashlarRoughness,
    color: 0x8891a8,
    roughness: 0.98,
    metalness: 0.04,
    envMapIntensity: 0.20
  }));

  const ironMat = trackMat(new THREE.MeshStandardMaterial({
    normalMap: lowSpecMode ? null : pbr.ironNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: pbr.ironRoughness,
    color: 0x363b47,
    roughness: 0.92,
    metalness: 0.72,
    envMapIntensity: 0.45
  }));

  const daisRunnerMat = trackMat(new THREE.MeshStandardMaterial({
    map: pbr.carpetAlbedo || null,
    normalMap: lowSpecMode ? null : (pbr.carpetNormal || null),
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: pbr.carpetRoughness || null,
    color: pbr.carpetAlbedo ? 0xffffff : 0x671720,
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.25
  }));

  const normalMappedMats = [
    { mat: stoneFloorMat, map: pbr.floorNormal },
    { mat: darkStoneMat, map: pbr.ashlarNormal },
    { mat: trimStoneMat, map: pbr.ashlarNormal },
    { mat: ironMat, map: pbr.ironNormal }
  ];
  if (pbr.carpetNormal) {
    normalMappedMats.push({ mat: daisRunnerMat, map: pbr.carpetNormal });
  }

  // ==========================================================================
  // 0. Gothic Night Sky Dome (Pale Ashen Moon visible high above Castle Walls) [1 DC]
  // ==========================================================================
  const skyUniforms = {
    uTime: { value: 0 },
    uLowSpec: { value: lowSpecMode ? 1.0 : 0.0 }
  };
  const skyDomeMat = trackMat(new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uLowSpec;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        vec3 d = normalize(vDir);
        float elev = clamp(d.y, -0.35, 1.0);
        vec3 darkStone = vec3(0.042, 0.046, 0.068);
        vec3 horizonCol = vec3(0.088, 0.104, 0.158);
        vec3 zenithCol = vec3(0.026, 0.035, 0.068);
        vec3 col = elev < 0.0
          ? mix(horizonCol, darkStone, clamp(-elev * 3.8, 0.0, 1.0))
          : mix(horizonCol, zenithCol, pow(elev, 0.62));

        vec3 moonDir = normalize(vec3(-0.18, 0.42, -0.89));
        float mDot = dot(d, moonDir);
        float moonHalo = pow(max(mDot, 0.0), 10.0) * 0.34 + pow(max(mDot, 0.0), 42.0) * 0.42;
        col += vec3(0.32, 0.42, 0.64) * moonHalo;

        float disc = smoothstep(0.9942, 0.9964, mDot);
        if (disc > 0.001) {
          vec2 mUv = (d.xy - moonDir.xy) * 14.0;
          float craters = vnoise(mUv * 2.2) * 0.65 + vnoise(mUv * 5.0) * 0.35;
          vec3 moonCol = mix(vec3(0.68, 0.74, 0.86), vec3(0.95, 0.96, 1.0), craters);
          col = mix(col, moonCol, disc);
        }

        if (uLowSpec < 0.5 && elev > 0.02) {
          vec2 cUv = d.xz / (elev + 0.24);
          float c1 = vnoise(cUv * 0.65 + vec2(uTime * 0.012, -uTime * 0.007));
          float c2 = vnoise(cUv * 1.45 - vec2(uTime * 0.018, uTime * 0.009));
          float cloud = smoothstep(0.46, 0.82, c1 * 0.65 + c2 * 0.35) * smoothstep(0.02, 0.18, elev) * (1.0 - smoothstep(0.58, 0.92, elev));
          vec3 cloudCol = mix(vec3(0.09, 0.11, 0.17), vec3(0.30, 0.38, 0.56), pow(max(mDot, 0.0), 4.0));
          col = mix(col, cloudCol, cloud * 0.56);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `
  }));
  const skyDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(132, 24, 14)), skyDomeMat);
  skyDome.position.set(0, -8, -5);
  skyDome.renderOrder = 2;
  group.add(skyDome);

  // ==========================================================================
  // 1. Solid Grounded Castle Stone Floor (from SOULS_CASTLE_FLOOR_SLABS + Sub-Floor) [1 DC]
  // ==========================================================================
  const foundationMinZ = BOSS_CENTER_Z - BOSS_RADIUS - 3.0;
  const foundationMaxZ = SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_Z + 3.0;
  const floorParts = [
    // Continuous dark stone castle foundation underneath all chambers (ZERO floating bridge / sky void!)
    makeTranslatedGeo(
      new THREE.BoxGeometry(2 * (BOSS_RADIUS + 5.0), 1.2, foundationMaxZ - foundationMinZ),
      0, -0.68, (foundationMaxZ + foundationMinZ) * 0.5
    )
  ];
  for (let i = 0; i < SOULS_CASTLE_FLOOR_SLABS.length; i++) {
    const sl = SOULS_CASTLE_FLOOR_SLABS[i];
    if (sl.shape === 'circle') {
      floorParts.push(
        makeTranslatedGeo(new THREE.CylinderGeometry(sl.radius, sl.radius + 0.2, 0.48, 28), sl.cx, sl.y - 0.24, sl.cz)
      );
    } else {
      floorParts.push(
        makeTranslatedGeo(new THREE.BoxGeometry(sl.width, 0.48, sl.depth), sl.cx, sl.y - 0.24, sl.cz)
      );
    }
  }
  const walkableFloorGeo = trackGeo(mergeBucket(floorParts, 3.85));
  const walkableFloorMesh = new THREE.Mesh(walkableFloorGeo, stoneFloorMat);
  walkableFloorMesh.receiveShadow = true;
  walkableFloorMesh.renderOrder = -200;
  group.add(walkableFloorMesh);

  // ==========================================================================
  // 2. Enclosed Castle Perimeter Walls (from SOULS_CASTLE_WALL_SEGMENTS),
  //    Boss Cathedral Medallion, Floor Ribs, Throne Dais & Rubble [5 DC]
  // ==========================================================================
  const darkStoneParts = [];
  const trimStoneParts = [];
  const fadeSouthParts = [];
  const fadeWestParts = [];
  const fadeEastParts = [];
  const carpetParts = [];

  for (let i = 0; i < SOULS_CASTLE_WALL_SEGMENTS.length; i++) {
    const seg = SOULS_CASTLE_WALL_SEGMENTS[i];
    if (seg.role === 'perimeter_south') {
      // Alcove south wall: lower wainscot permanent; upper part auto-fades ONLY if camera sits outside it while hero is inside the alcove!
      appendRichCastleWallSegment(seg, darkStoneParts, trimStoneParts, fadeSouthParts, fadeSouthParts, 1.55);
    } else if (seg.id === 'corridor_west' || seg.id === 'courtyard_west') {
      appendRichCastleWallSegment(seg, darkStoneParts, trimStoneParts, fadeWestParts, fadeWestParts, 1.55);
    } else if (seg.id === 'corridor_east_south' || seg.id === 'corridor_east_north_ext' || seg.id === 'courtyard_east') {
      appendRichCastleWallSegment(seg, darkStoneParts, trimStoneParts, fadeEastParts, fadeEastParts, 1.55);
    } else {
      // Includes courtyard_south: the entrance wall behind the Bonfire is a PERMANENT full-height (8.6m) wall — no holes into the black sky!
      appendRichCastleWallSegment(seg, darkStoneParts, trimStoneParts, darkStoneParts, trimStoneParts, 1.55);
    }
  }

  // Boss Cathedral Carved Stone Medallion Ring + Extended Radial Floor Ribs (scale with the enlarged +21% hall)
  // Kept flush/low (top <= 0.011m) so stone inlays never slice through the 0.022m royal velvet runner!
  const ringSegs = 16;
  const ringInnerR = 4.88 * BOSS_HALL_SCALE;
  const ringOuterR = 9.8 * BOSS_HALL_SCALE;
  const ribMidR = 5.2 * BOSS_HALL_SCALE;
  for (let i = 0; i < ringSegs; i++) {
    const a = (i / ringSegs) * Math.PI * 2;
    const rx = Math.cos(a) * ringInnerR;
    const rz = BOSS_CENTER_Z + Math.sin(a) * ringInnerR;
    trimStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(1.88 * BOSS_HALL_SCALE, 0.016, 0.56), rx, 0.002, rz, 0, -a + Math.PI / 2, 0));
    const ox = Math.cos(a) * ringOuterR;
    const oz = BOSS_CENTER_Z + Math.sin(a) * ringOuterR;
    darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(3.85 * BOSS_HALL_SCALE, 0.014, 0.44), ox, 0.001, oz, 0, -a + Math.PI / 2, 0));
    if (i % 2 === 0) {
      const sx = Math.cos(a) * ribMidR;
      const sz = BOSS_CENTER_Z + Math.sin(a) * ribMidR;
      darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(0.36, 0.014, 9.6 * BOSS_HALL_SCALE), sx, 0.001, sz, 0, -a + Math.PI / 2, 0));
    }
  }
  trimStoneParts.push(makeTranslatedGeo(new THREE.CylinderGeometry(1.05 * BOSS_HALL_SCALE, 1.18 * BOSS_HALL_SCALE, 0.016, 8), 0, 0.003, BOSS_CENTER_Z));

  const bossRuneMat = trackMat(new THREE.MeshBasicMaterial({
    color: 0xd97706,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0x01,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  // Golden sigil of the Boss arena, centred strictly on BOSS_CENTER_Z
  const bossRing = new THREE.Mesh(
    trackGeo(new THREE.RingGeometry(4.52 * BOSS_HALL_SCALE, 4.68 * BOSS_HALL_SCALE, 48)),
    bossRuneMat
  );
  bossRing.rotation.x = -Math.PI / 2;
  bossRing.position.set(0, 0.030, BOSS_CENTER_Z);
  group.add(bossRing);

  // Ceremonial Stepped Throne Dais & Continuous Royal Crimson-Velvet Runner (exact IK heights matching SOULS_CASTLE_THRONE_CONFIG!)
  const tx = SOULS_THRONE_CONFIG.x;
  const tz = SOULS_THRONE_CONFIG.z;
  darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(7.2, 0.08, 4.6), tx, 0.02, tz - 0.05));
  trimStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(7.48, 0.05, 4.88), tx, 0.01, tz - 0.05));
  darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(1.66, 0.50, 0.44), tx, 0.25, tz + 1.38));
  darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(4.60, 0.50, 0.85), tx, 0.25, tz + 2.025));
  trimStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(4.78, 0.08, 0.94), tx, 0.465, tz + 2.025));
  darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(5.90, 0.25, 1.00), tx, 0.125, tz + 2.95));
  trimStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(6.08, 0.07, 1.08), tx, 0.222, tz + 2.95));
  // Single continuous, wide (2.40m), beveled woven crimson-and-gold velvet runner draped over both steps to the Boss Doors
  carpetParts.push(createRoyalRunnerCarpetGeometry(tx, tz, BOSS_DOOR_Z));

  // Edge-hugging shattered gothic masonry rubble & toppled broken column drums
  // Aligned 1:1 with canonical SOULS_CASTLE_RUBBLE from soulsCastleLayout.js (with safe fallback)
  const alcoveMidX = (SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X + SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_X) * 0.5;
  const courtyardWallX = SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_X - 1.0;
  const corridorWallX = SOULS_CASTLE_CONSTANTS.CORRIDOR_HALF_W - 0.9;
  const hallRubbleX = BOSS_RADIUS - 2.4;
  const fallbackRubbleSpecs = [
    { kind: 'rubble_box', x: -courtyardWallX, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_Z - 1.4, w: 0.52, h: 0.28, d: 0.44, rotY: 0.5 },
    { kind: 'rubble_box', x:  courtyardWallX, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MAX_Z - 2.0, w: 0.48, h: 0.26, d: 0.42, rotY: -0.6 },
    { kind: 'rubble_box', x: -courtyardWallX, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z + 3.2, w: 0.54, h: 0.30, d: 0.42, rotY: 0.8 },
    { kind: 'rubble_box', x:  courtyardWallX, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z + 3.6, w: 0.46, h: 0.24, d: 0.40, rotY: -0.4 },
    { kind: 'rubble_box', x: -corridorWallX,  z: 9.0,  w: 0.50, h: 0.26, d: 0.40, rotY: 0.6 },
    { kind: 'rubble_box', x:  corridorWallX,  z: -9.4, w: 0.48, h: 0.24, d: 0.38, rotY: -0.5 },
    { kind: 'rubble_box', x: alcoveMidX + 2.8, z: SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_Z + 1.2, w: 0.48, h: 0.26, d: 0.40, rotY: 0.4 },
    { kind: 'rubble_box', x: alcoveMidX + 2.8, z: SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_Z - 1.2, w: 0.44, h: 0.24, d: 0.38, rotY: -0.7 },
    { kind: 'rubble_box', x: -hallRubbleX, z: BOSS_CENTER_Z - 4.2, w: 0.62, h: 0.34, d: 0.50, rotY: 0.7 },
    { kind: 'rubble_box', x:  hallRubbleX, z: BOSS_CENTER_Z + 4.2, w: 0.56, h: 0.30, d: 0.46, rotY: -0.4 },
    { kind: 'fallen_column', x: -hallRubbleX, y: 0.42, z: BOSS_CENTER_Z + 5.6, rTop: 0.48, rBot: 0.52, length: 1.38, rotX: Math.PI * 0.48, rotY: 0.55, rotZ: 0.12 },
    { kind: 'fallen_column', x:  hallRubbleX, y: 0.40, z: BOSS_CENTER_Z - 5.2, rTop: 0.46, rBot: 0.50, length: 1.30, rotX: Math.PI * 0.49, rotY: -0.72, rotZ: -0.08 }
  ];
  const rubbleList =
    Array.isArray(CastleLayout.SOULS_CASTLE_RUBBLE) && CastleLayout.SOULS_CASTLE_RUBBLE.length > 0
      ? CastleLayout.SOULS_CASTLE_RUBBLE
      : fallbackRubbleSpecs;
  for (let i = 0; i < rubbleList.length; i++) {
    const item = rubbleList[i];
    if (!item) continue;
    if (Array.isArray(item)) {
      const [rx, rz, rw, rh, rd, rrot] = item;
      darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(rw, rh, rd), rx, rh * 0.45, rz, 0.08, rrot, -0.06));
      continue;
    }
    const kindStr = String(item.kind || item.shape || item.type || '').toLowerCase();
    const isCylinder =
      kindStr.includes('column') ||
      kindStr.includes('drum') ||
      kindStr.includes('cyl') ||
      item.rTop != null ||
      item.rBot != null;
    if (isCylinder) {
      const rTop = Number.isFinite(item.rTop) ? item.rTop : (Number.isFinite(item.radiusTop) ? item.radiusTop : (Number.isFinite(item.radius) ? item.radius * 0.72 : 0.47));
      const rBot = Number.isFinite(item.rBot) ? item.rBot : (Number.isFinite(item.radiusBottom) ? item.radiusBottom : rTop + 0.04);
      const cLen = Number.isFinite(item.length) ? item.length : (Number.isFinite(item.len) ? item.len : (Number.isFinite(item.height) ? item.height : 1.34));
      const cy = Number.isFinite(item.y) ? item.y : (rBot * 0.82);
      const rx = Number.isFinite(item.rotX) ? item.rotX : (Number.isFinite(item.rx) ? item.rx : Math.PI * 0.485);
      const ry = Number.isFinite(item.rotY) ? item.rotY : (Number.isFinite(item.ry) ? item.ry : (Number.isFinite(item.rot) ? item.rot : 0.55));
      const rz = Number.isFinite(item.rotZ) ? item.rotZ : (Number.isFinite(item.rz) ? item.rz : 0.08);
      const radialSegs = Number.isFinite(item.radialSegs) ? Math.max(5, Math.round(item.radialSegs)) : 9;
      darkStoneParts.push(makeTranslatedGeo(new THREE.CylinderGeometry(rTop, rBot, cLen, radialSegs), item.x, cy, item.z, rx, ry, rz));
    } else {
      const rw = Number.isFinite(item.w) ? item.w : (Number.isFinite(item.width) ? item.width : 0.50);
      const rh = Number.isFinite(item.h) ? item.h : (Number.isFinite(item.height) ? item.height : 0.28);
      const rd = Number.isFinite(item.d) ? item.d : (Number.isFinite(item.depth) ? item.depth : 0.42);
      const cy = Number.isFinite(item.y) ? item.y : rh * 0.45;
      const rx = Number.isFinite(item.rotX) ? item.rotX : (Number.isFinite(item.rx) ? item.rx : 0.08);
      const ry = Number.isFinite(item.rotY) ? item.rotY : (Number.isFinite(item.ry) ? item.ry : (Number.isFinite(item.rot) ? item.rot : 0));
      const rz = Number.isFinite(item.rotZ) ? item.rotZ : (Number.isFinite(item.rz) ? item.rz : -0.06);
      darkStoneParts.push(makeTranslatedGeo(new THREE.BoxGeometry(rw, rh, rd), item.x, cy, item.z, rx, ry, rz));
    }
  }

  const darkStoneBatch = new THREE.Mesh(trackGeo(mergeBucket(darkStoneParts, 3.2)), darkStoneMat);
  darkStoneBatch.castShadow = false;
  darkStoneBatch.receiveShadow = true;
  darkStoneBatch.renderOrder = -195;
  group.add(darkStoneBatch);

  const trimStoneBatch = new THREE.Mesh(trackGeo(mergeBucket(trimStoneParts, 3.0)), trimStoneMat);
  trimStoneBatch.castShadow = false;
  trimStoneBatch.receiveShadow = true;
  trimStoneBatch.renderOrder = -195;
  group.add(trimStoneBatch);

  const crimsonCarpetBatch = new THREE.Mesh(trackGeo(mergeBucket(carpetParts, 0)), daisRunnerMat);
  crimsonCarpetBatch.castShadow = false;
  crimsonCarpetBatch.receiveShadow = true;
  crimsonCarpetBatch.renderOrder = -190;
  group.add(crimsonCarpetBatch);

  // Camera-safe solid stone upper wall groups (South, West, East) [3 DC]
  const fadeWallEntries = [];
  for (const [kind, bucket] of [['south', fadeSouthParts], ['west', fadeWestParts], ['east', fadeEastParts]]) {
    if (!bucket.length) continue;
    const mat = trackMat(new THREE.MeshStandardMaterial({
      map: pbr.ashlarAlbedo,
      normalMap: lowSpecMode ? null : pbr.ashlarNormal,
      normalScale: new THREE.Vector2(stoneNormalStrength * 0.95, stoneNormalStrength * 0.95),
      roughnessMap: pbr.ashlarRoughness,
      color: 0x828ba2,
      roughness: 1.0,
      metalness: 0.03,
      envMapIntensity: 0.20,
      transparent: false,
      opacity: 1.0
    }));
    normalMappedMats.push({ mat, map: pbr.ashlarNormal });
    const mesh = new THREE.Mesh(trackGeo(mergeBucket(bucket, 3.2)), mat);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    fadeWallEntries.push({ kind, mesh, mat, curOpacity: 1.0 });
  }

  // ==========================================================================
  // 3. Camera-Safe Pointed Gothic Archways (from SOULS_CASTLE_ARCHES) [3 DC]
  //    (boss_door_portal is built with ornate tympanum inside soulsCastleDoors.js)
  // ==========================================================================
  const archEntries = [];
  for (let i = 0; i < SOULS_CASTLE_ARCHES.length; i++) {
    const arch = SOULS_CASTLE_ARCHES[i];
    if (arch.id === 'boss_door_portal') continue;
    const archMat = trackMat(new THREE.MeshStandardMaterial({
      map: pbr.ashlarAlbedo,
      normalMap: lowSpecMode ? null : pbr.ashlarNormal,
      normalScale: new THREE.Vector2(stoneNormalStrength * 0.90, stoneNormalStrength * 0.90),
      roughnessMap: pbr.ashlarRoughness,
      color: 0x868fa6,
      roughness: 0.98,
      metalness: 0.04,
      envMapIntensity: 0.20,
      transparent: false,
      opacity: 1.0
    }));
    normalMappedMats.push({ mat: archMat, map: pbr.ashlarNormal });
    const archMesh = new THREE.Mesh(trackGeo(buildGothicArchGeometry(arch)), archMat);
    archMesh.castShadow = false;
    archMesh.receiveShadow = true;
    group.add(archMesh);
    archEntries.push({ arch, mesh: archMesh, mat: archMat, curOpacity: 1.0 });
  }

  // ==========================================================================
  // 4. Instanced Fluted Gothic Pillars (from SOULS_CASTLE_PILLARS) [4 DC]
  // ==========================================================================
  const intactPillars = SOULS_CASTLE_PILLARS.filter((p) => !p.broken);
  const brokenPillars = SOULS_CASTLE_PILLARS.filter((p) => p.broken);

  const pillarBaseGeo = trackGeo(createPillarBaseGeometry());
  const pillarShaftGeo = trackGeo(createFlutedShaftGeometry(0.54, 0.62, 5.2, isMobile ? 12 : 28));
  const pillarCapGeo = trackGeo(createPillarCapitalGeometry());
  const pillarBrokenCapGeo = trackGeo(createBrokenPillarCapGeometry());

  const pillarBaseInst = new THREE.InstancedMesh(pillarBaseGeo, trimStoneMat, SOULS_CASTLE_PILLARS.length);
  const pillarShaftInst = new THREE.InstancedMesh(pillarShaftGeo, darkStoneMat, SOULS_CASTLE_PILLARS.length);
  const pillarCapInst = new THREE.InstancedMesh(pillarCapGeo, trimStoneMat, Math.max(1, intactPillars.length));
  const pillarBrokenInst = new THREE.InstancedMesh(pillarBrokenCapGeo, darkStoneMat, Math.max(1, brokenPillars.length));
  pillarCapInst.count = intactPillars.length;
  pillarBrokenInst.count = brokenPillars.length;

  for (const inst of [pillarBaseInst, pillarShaftInst, pillarCapInst, pillarBrokenInst]) {
    inst.castShadow = true;
    inst.receiveShadow = true;
    group.add(inst);
  }

  const dummyObj = new THREE.Object3D();
  let intactIdx = 0;
  let brokenIdx = 0;
  for (let i = 0; i < SOULS_CASTLE_PILLARS.length; i++) {
    const p = SOULS_CASTLE_PILLARS[i];
    dummyObj.position.set(p.x, 0, p.z);
    dummyObj.rotation.set(0, 0, 0);
    dummyObj.scale.set(1, 1, 1);
    dummyObj.updateMatrix();
    pillarBaseInst.setMatrixAt(i, dummyObj.matrix);

    const targetH = Math.max(3.2, (p.height || 7.2) - 1.35);
    const shaftH = p.broken ? Math.min(3.8, targetH * 0.55) : targetH;
    const shaftScaleY = shaftH / 5.2;
    dummyObj.position.set(p.x, 0.72 + shaftH * 0.5, p.z);
    dummyObj.rotation.set(0, (i * 0.45) % Math.PI, 0);
    dummyObj.scale.set(1, shaftScaleY, 1);
    dummyObj.updateMatrix();
    pillarShaftInst.setMatrixAt(i, dummyObj.matrix);

    if (!p.broken) {
      dummyObj.position.set(p.x, 0.72 + shaftH, p.z);
      dummyObj.rotation.set(0, 0, 0);
      dummyObj.scale.set(1, 1, 1);
      dummyObj.updateMatrix();
      pillarCapInst.setMatrixAt(intactIdx++, dummyObj.matrix);
    } else {
      dummyObj.position.set(p.x, 0.72 + shaftH - 0.04, p.z);
      dummyObj.rotation.set(0, i * 1.1, 0);
      dummyObj.scale.set(1, 1, 1);
      dummyObj.updateMatrix();
      pillarBrokenInst.setMatrixAt(brokenIdx++, dummyObj.matrix);
    }
  }
  pillarBaseInst.instanceMatrix.needsUpdate = true;
  pillarShaftInst.instanceMatrix.needsUpdate = true;
  pillarCapInst.instanceMatrix.needsUpdate = true;
  pillarBrokenInst.instanceMatrix.needsUpdate = true;

  // ==========================================================================
  // 5. Monumental Twin Oak & Iron Boss Doors (./souls/soulsCastleDoors.js) [5-6 DC]
  // ==========================================================================
  const castleDoors = createSoulsCastleDoors({
    darkStoneMat,
    trimStoneMat,
    ironMat,
    pbr,
    trackGeo,
    trackMat,
    z: BOSS_DOOR_Z,
    isMobile
  });
  group.add(castleDoors.group);

  // Soft feathered radial threshold floor spill (replaces hard-edged yellow rectangle! ZERO sharp corners!) [1 DC]
  const thresholdGlowUniforms = {
    uColor: { value: new THREE.Color(0xff9234) },
    uOpacity: { value: 0.0 },
    uTime: { value: 0.0 }
  };
  const thresholdGlowMat = trackMat(new THREE.ShaderMaterial({
    uniforms: thresholdGlowUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - vec2(0.5)) * 2.0;
        float r = length(p);
        float radial = smoothstep(1.0, 0.08, r);
        radial = radial * radial;
        float shimmer = 0.90 + 0.10 * sin(uTime * 2.8 + p.x * 4.0 + p.y * 2.5);
        float a = radial * shimmer * uOpacity;
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor * (0.85 + 0.35 * radial), a);
      }
    `
  }));
  const thresholdGlowMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(7.6, 5.4)), thresholdGlowMat);
  thresholdGlowMesh.rotation.x = -Math.PI / 2;
  thresholdGlowMesh.position.set(0, 0.024, BOSS_DOOR_Z + 0.95);
  thresholdGlowMesh.visible = false;
  thresholdGlowMesh.renderOrder = 3;
  group.add(thresholdGlowMesh);

  let fogGateSealed = false;
  let lastDoorShudder = 0;
  let wasCutsceneDriven = false;
  let throneOccluded = false;

  function getBossDoorState() {
    return castleDoors.getState();
  }
  function getDoorShudderIntensity() {
    return lastDoorShudder;
  }
  function openBossDoors() {
    fogGateSealed = false;
    if (wasCutsceneDriven) {
      wasCutsceneDriven = false;
      castleDoors.applyCutsceneState?.(null, 0.016);
    }
    throneOccluded = false;
    if (throneGrp) throneGrp.visible = true;
    castleDoors.group.visible = true;
    if (castleDoors.getState() === 'sealed') {
      thresholdGlowMesh.visible = false;
      thresholdGlowUniforms.uOpacity.value = 0.0;
    }
    return castleDoors.openDoors();
  }
  function sealBossDoors() {
    fogGateSealed = true;
    const ok = castleDoors.sealDoors();
    thresholdGlowMesh.visible = true;
    thresholdGlowMesh.scale.set(0.95, 0.34, 1.0);
    thresholdGlowMesh.position.z = BOSS_DOOR_Z;
    thresholdGlowUniforms.uColor.value.setHex(0xe8821c);
    thresholdGlowUniforms.uOpacity.value = 0.24;
    return ok;
  }
  function resetBossDoors(keepOpen = false) {
    fogGateSealed = false;
    lastDoorShudder = 0;
    wasCutsceneDriven = false;
    castleDoors.applyCutsceneState?.(null, 0.016);
    castleDoors.resetDoors(Boolean(keepOpen));
    castleDoors.group.visible = true;
    if (keepOpen) {
      throneOccluded = false;
      if (throneGrp) throneGrp.visible = true;
      thresholdGlowMesh.visible = true;
      thresholdGlowMesh.scale.set(1.0, 1.0, 1.0);
      thresholdGlowMesh.position.z = BOSS_DOOR_Z + 0.95;
      thresholdGlowUniforms.uColor.value.setHex(0xff9234);
      thresholdGlowUniforms.uOpacity.value = 0.16;
    } else {
      thresholdGlowMesh.visible = false;
      thresholdGlowUniforms.uOpacity.value = 0.0;
    }
  }
  function setFogGateSealed(sealed) {
    if (Boolean(sealed)) {
      sealBossDoors();
    } else {
      fogGateSealed = false;
      const curState = castleDoors.getState();
      if (curState === 'opening' || curState === 'open') {
        castleDoors.group.visible = true;
        throneOccluded = false;
        if (throneGrp) throneGrp.visible = true;
      } else {
        resetBossDoors(false);
      }
    }
  }

  // ==========================================================================
  // 5b. Solid Gothic Vaulted Castle Roof & Hanging Chandeliers (./souls/soulsCastleRoof.js)
  // ==========================================================================
  const castleRoof = createSoulsCastleRoof({
    darkStoneMat,
    trimStoneMat,
    ironMat,
    pbr,
    isMobile,
    lowSpec: lowSpecMode
  });
  group.add(castleRoof.group);

  // ==========================================================================
  // 6. High-Detail Modular 3D Castle Props (./souls/soulsCastleProps.js)
  //    - Hero Bonfire (10 scorched stones + 3D skull/bones + Coiled Sword + FBM flame/smoke/embers)
  //    - 12 Caged Standing Lantern-Braziers (ALL w/ solid colliders!) + 21 Wall Bracket Lanterns
  //    - 9 Melted Dripping-Wax Candle Clusters (breakable via tryBreakCandlesNear!)
  //    - 8 Tattered Swaying Crimson Banners + East Alcove Relic Shrine + 9 Alcove Armory Props
  // ==========================================================================
  const bonfire3D = createHeroBonfire3D({
    x: BONFIRE_POS.x,
    z: BONFIRE_POS.z,
    ironMat,
    pbr,
    trackGeo,
    trackMat,
    trackTex,
    isMobile,
    lowSpec: lowSpecMode
  });
  group.add(bonfire3D.group);

  const mappedWallLanterns = SOULS_CASTLE_WALL_LANTERNS.map((w) => ({
    ...w,
    nx: w.normalX,
    nz: w.normalZ
  }));
  const braziers3D = createGothicLanternBraziers3D({
    specs: SOULS_CASTLE_BRAZIERS,
    wallLanternSpecs: mappedWallLanterns,
    ironMat,
    darkStoneMat,
    trimStoneMat,
    pbr,
    trackGeo,
    trackMat,
    trackTex,
    isMobile,
    lowSpec: lowSpecMode
  });
  group.add(braziers3D.group);

  const candles3D = createMeltedCandleClusters3D({
    clusterCoords: SOULS_CASTLE_CANDLE_CLUSTERS,
    ironMat,
    pbr,
    trackGeo,
    trackMat,
    trackTex,
    lowSpec: lowSpecMode,
    isMobile
  });
  group.add(candles3D.group);

  const mappedBanners = SOULS_CASTLE_BANNERS.map((b) => ({
    ...b,
    nx: b.normalX,
    nz: b.normalZ
  }));
  const mappedShrines = SOULS_CASTLE_RELICS.map((r) => ({
    ...r,
    rotY: Number.isFinite(r.facing) ? r.facing : -Math.PI * 0.5
  }));
  const bannersAndShrines = createCastleBannersAndShrines3D({
    bannerSpecs: mappedBanners,
    shrineSpecs: mappedShrines,
    alcoveDecorSpecs: SOULS_CASTLE_ALCOVE_DECOR,
    darkStoneMat,
    trimStoneMat,
    ironMat,
    pbr,
    trackGeo,
    trackMat,
    trackTex,
    isMobile,
    lowSpec: lowSpecMode
  });
  group.add(bannersAndShrines.group);

  // ==========================================================================
  // 6b. Volumetric Atmosphere: Moonlit God-Rays, Ground Mist, Dust Motes & Contact AO
  //     (./souls/soulsAtmosphere.js)
  // ==========================================================================
  const castleAtmo = createCastleAtmosphere({
    isMobile,
    lowSpec: lowSpecMode,
    bonfire: BONFIRE_POS,
    throne: { x: tx, z: tz },
    bossCenter: { x: 0, z: BOSS_CENTER_Z },
    bossDoorZ: BOSS_DOOR_Z,
    pillars: SOULS_CASTLE_PILLARS,
    braziers: SOULS_CASTLE_BRAZIERS,
    relics: SOULS_CASTLE_RELICS,
    clerestoryShafts: SOULS_CASTLE_CLERESTORY_SHAFTS,
    alcoveDecor: SOULS_CASTLE_ALCOVE_DECOR,
    trackGeo,
    trackMat,
    trackTex
  });
  group.add(castleAtmo.group);

  // Canonical static colliders from soulsCastleLayout.js (Bonfire, Pillars, Braziers, Shrines, Rubble, Door Jambs & Throne!)
  const staticColliders = getCastleStaticColliders().map((c) => {
    if (c.halfW != null && c.halfD != null) {
      return { ...c, id: c.id, kind: c.kind, x: c.x, z: c.z, halfW: c.halfW, halfD: c.halfD };
    }
    const r = Number.isFinite(c.radius) ? c.radius : (Number.isFinite(c.r) ? c.r : 0.55);
    return { ...c, id: c.id, kind: c.kind, x: c.x, z: c.z, r, radius: r };
  });

  // ==========================================================================
  // 7. Dynamic Nearest-Light PointLight Pool (4 PC / 2 Mobile / 1 LowSpec!)
  //    Deep molten-amber firelights (0xff7b1c, decay 1.85) + well-lit Boss Throne Hall
  //    (warm portrait key on seated Boss/Throne + cool silver dome-lantern fill at hall center!)
  // ==========================================================================
  const virtualLights = [
    { x: BONFIRE_POS.x, y: 1.75, z: BONFIRE_POS.z, color: 0xff7b1c, baseInt: 6.2, dist: 22, phase: 0.0, weight: 2.5 },
    ...braziers3D.virtualLights.map((vl) => ({
      ...vl,
      color: 0xff7b1c,
      baseInt: vl.kind === 'wall' ? Math.max(2.6, (vl.baseInt || 2.1) * 1.15) : Math.max(4.2, (vl.baseInt || 3.4) * 1.22),
      dist: vl.kind === 'wall' ? Math.max(12, vl.dist || 12) : Math.max(17.5, vl.dist || 17)
    })),
    ...bannersAndShrines.shrineLights.map((sl) => ({
      ...sl,
      color: 0xff9424,
      baseInt: Math.max(3.8, sl.baseInt ?? 3.4),
      dist: sl.dist ?? 15,
      phase: sl.phase ?? 1.4,
      weight: 1.85,
      steady: true
    })),
    // Noble Throne Hall Illumination: Arena is clearly lit (never hiding the Boss in darkness!)
    // Index: throneFaceKeyIdx (3/4 warm portrait key on seated Boss face (0, 2.2, -30.5) & Obsidian Throne)
    { id: 'throne_face_key', x: tx + 0.75, y: 3.15, z: tz + 3.9, color: 0xffb266, baseInt: 5.4, dist: 25, phase: 1.9, weight: 3.2, steady: true },
    // Index: domeMoonFillIdx (soft silver-blue moonlight streaming down from Cathedral dome lantern onto hall center)
    { id: 'dome_moon_fill', x: -1.4, y: 8.2, z: BOSS_CENTER_Z - 0.4, color: 0xa8c6f0, baseInt: 6.2, dist: 34, phase: 0.4, weight: 3.5, steady: true },
    // Warm flanking hearth braziers & subtle crimson throne back-rim
    { x: tx - 3.8, y: 3.2, z: tz + 1.8, color: 0xff7b1c, baseInt: 4.5, dist: 19, phase: 0.8, weight: 2.3 },
    { x: tx + 3.8, y: 3.2, z: tz + 1.8, color: 0xff7b1c, baseInt: 4.5, dist: 19, phase: 2.5, weight: 2.3 },
    { x: tx, y: 3.6, z: tz - 1.5, color: 0xdc2626, baseInt: 3.2, dist: 15, phase: 3.3, weight: 1.4, steady: true }
  ];
  const throneFaceKeyIdx = virtualLights.findIndex((vl) => vl.id === 'throne_face_key');
  const domeMoonFillIdx = virtualLights.findIndex((vl) => vl.id === 'dome_moon_fill');
  const _tmpLightColor = new THREE.Color();

  const MAX_POOL_LIGHTS = isMobile ? 2 : 2;
  let activePoolCount = lowSpecMode ? 1 : MAX_POOL_LIGHTS;
  const lightPool = [];
  for (let i = 0; i < MAX_POOL_LIGHTS; i++) {
    const pl = new THREE.PointLight(0xff7b1c, 0, 18, 1.85);
    pl.position.set(0, 2.0, BONFIRE_POS.z);
    // ZERO-HITCH: every pool light stays `visible = true` for the whole session (inactive slots just run at intensity 0),
    // so toggling lowSpecMode mid-fight NEVER changes the scene light count => no +N shader recompiles!
    pl.visible = true;
    group.add(pl);
    lightPool.push({ light: pl, assignedSrc: -1, fade: 0 });
  }
  const _topLightIndices = new Int32Array(MAX_POOL_LIGHTS);
  const _topLightScores = new Float32Array(MAX_POOL_LIGHTS);
  const _srcUsedFlags = new Uint8Array(virtualLights.length);

  // ==========================================================================
  // 8. Grand Obsidian Demon-Skull Throne (GLB + 100% Invisible Shadow-Only Proxy!)
  // ==========================================================================
  const throneGrp = new THREE.Group();
  throneGrp.position.set(tx, 0, tz);
  group.add(throneGrp);

  // 100% invisible shadow-only 12-triangle proxy (casts crisp throne shadow while NEVER poking out of GLB!)
  const throneShadowOnlyMat = trackMat(new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false
  }));
  const throneShadowProxy = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.0, 3.6, 1.15)),
    throneShadowOnlyMat
  );
  throneShadowProxy.position.set(0, 1.85, -0.25);
  throneShadowProxy.castShadow = true;
  throneShadowProxy.receiveShadow = false;
  throneGrp.add(throneShadowProxy);

  const thronePlaceholder = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.4, 4.8, 2.2)), darkStoneMat);
  thronePlaceholder.position.set(0, 2.4, -0.2);
  throneGrp.add(thronePlaceholder);

  let throneDisposed = false;
  // P1 occlusion culling state: the Throne (182k-tri hall content) is hidden while the Boss Doors are closed & player is far.
  // A short warm-up window after the GLB lands keeps it visible for a few frames so its shaders compile BEFORE the cutscene.
  let throneWarmFrames = 0;
  const throneLoader = new GLTFLoader();
  throneLoader.setDRACOLoader(sharedDracoLoader);
  throneLoader.load(
    THRONE_GLB_URL,
    (gltf) => {
      if (throneDisposed || !gltf?.scene) return;
      const root = gltf.scene;
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(1);
      root.traverse((node) => {
        if (!node.isMesh) return;
        node.castShadow = false;
        node.receiveShadow = true;
        if (node.geometry) ownedGeos.push(node.geometry);
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) {
          if (!m) continue;
          ownedMats.push(m);
          if (m.map) ownedTex.push(m.map);
          if (m.normalMap) ownedTex.push(m.normalMap);
          if (m.roughnessMap) ownedTex.push(m.roughnessMap);
          if (m.metalnessMap) ownedTex.push(m.metalnessMap);
        }
      });
      thronePlaceholder.visible = false;
      throneGrp.remove(thronePlaceholder);
      throneGrp.add(root);
      throneWarmFrames = 8;
    },
    undefined,
    (err) => {
      console.warn('[soulsArena] Failed to load souls_throne.glb:', err);
    }
  );

  // ==========================================================================
  // 8b. Wall Flame-Jet Traps (./souls/soulsFireVfx.js, <= 3 DC) — deterministic, shared with combat.js
  // ==========================================================================
  const flameTraps = createWallFlameJetTraps(SOULS_CASTLE_FLAME_TRAPS, {
    isMobile,
    lowSpec: lowSpecMode,
    pbr,
    trackGeo,
    trackMat
  });
  group.add(flameTraps.group);

  // ==========================================================================
  // 8c. Physically-Based Dynamic Fire Shadow Rig (./souls/soulsLightingRig.js)
  //     2 real shadow-casting fire PointLights (1024+512 PCFSoft, decay=2) on PC!
  // ==========================================================================
  const fireShadowRig = createSoulsFireShadowRig(group, {
    isMobile,
    lowSpec: lowSpecMode,
    sources: buildFireSourcesFromCastleLayout(SOULS_CASTLE_ZONES),
    bossDoorZ: BOSS_DOOR_Z
  });

  // ==========================================================================
  // 9. Towering Distant Gothic Castle Keep Spires Above Roofline [1 DC]
  // ==========================================================================
  const distantRuinsMat = trackMat(new THREE.MeshLambertMaterial({
    color: 0x222738,
    fog: true
  }));
  const distantRuinsMesh = new THREE.Mesh(trackGeo(createDistantCastleKeepGeometry()), distantRuinsMat);
  distantRuinsMesh.castShadow = false;
  distantRuinsMesh.receiveShadow = false;
  group.add(distantRuinsMesh);

  // ==========================================================================
  // 10. Storytelling Ground Decals (2x2 Atlas: Cracks/Blood/Moss/Wax) [1 DC]
  // ==========================================================================
  // All decals are anchored to the layout (Bonfire, pillars, corridor, East Alcove shrine, Throne dais, Boss arena centre) — 0 hard-coded old coordinates!
  const relic0 = SOULS_CASTLE_RELICS[0] || { x: 12.2, z: -0.4 };
  const alcoveCx = (SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X + SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_X) * 0.5;
  const alcoveCz = (SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_Z + SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_Z) * 0.5;
  const corrMidZ = (SOULS_CASTLE_CONSTANTS.CORRIDOR_MIN_Z + SOULS_CASTLE_CONSTANTS.CORRIDOR_MAX_Z) * 0.5;
  const decalSpecs = [
    // Shattered battle cracks (placed strictly on bare flagstones — NEVER cutting across the velvet royal carpet!)
    { q: 0, x:  0.4, z: SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z + 4.0, s: 3.4, rot: 0.3 },
    { q: 0, x: -1.4, z: corrMidZ + 3.0, s: 2.6, rot: 1.1 },
    { q: 0, x: alcoveCx - 1.6, z: alcoveCz, s: 3.0, rot: 0.7 },
    { q: 0, x: -4.4 * BOSS_HALL_SCALE, z: BOSS_CENTER_Z - 1.1 * BOSS_HALL_SCALE, s: 4.0, rot: 0.5 },
    { q: 0, x: -5.4 * BOSS_HALL_SCALE, z: BOSS_CENTER_Z + 2.7 * BOSS_HALL_SCALE, s: 3.8, rot: 2.1 },
    { q: 0, x:  4.8 * BOSS_HALL_SCALE, z: BOSS_CENTER_Z - 2.0 * BOSS_HALL_SCALE, s: 4.1, rot: -0.7 },
    // Scorched ash & wax circles (Bonfire Sanctuary, Relic Shrine, Boss Doors & Flame Gauntlet)
    { q: 3, x: BONFIRE_POS.x, z: BONFIRE_POS.z, s: 4.2, rot: 0.0 },
    { q: 3, x: relic0.x, z: relic0.z, s: 3.0, rot: 0.4 },
    { q: 3, x: -3.5, z: BOSS_DOOR_Z + 1.6, s: 1.9, rot: 0.7 },
    { q: 3, x:  3.5, z: BOSS_DOOR_Z + 1.6, s: 1.9, rot: -0.6 },
    { q: 3, x: tx - 2.8, z: tz + 1.4, s: 2.1, rot: 1.2 },
    { q: 3, x: tx + 2.8, z: tz + 1.4, s: 2.1, rot: -1.1 },
    ...SOULS_CASTLE_FLAME_TRAPS.map((tr, idx) => ({
      q: 3,
      x: (tr.x || 0) * 0.35,
      z: tr.z || 14.0,
      s: 2.6,
      rot: idx * 0.8
    }))
  ];
  // Moss tufts hugging the base of every structural pillar (auto-follows SOULS_CASTLE_PILLARS)
  for (let pi = 0; pi < SOULS_CASTLE_PILLARS.length; pi++) {
    const pl = SOULS_CASTLE_PILLARS[pi];
    decalSpecs.push({ q: 2, x: pl.x + ((pi % 2) ? 0.5 : -0.5), z: pl.z + ((pi % 3) ? 0.4 : -0.4), s: 2.6 + (pi % 3) * 0.2, rot: pi * 0.9 });
  }
  const decalParts = [];
  for (let i = 0; i < decalSpecs.length; i++) {
    const d = decalSpecs[i];
    const p = new THREE.PlaneGeometry(d.s, d.s);
    const uv = p.attributes.uv;
    const u0 = (d.q === 1 || d.q === 3) ? 0.505 : 0.005;
    const v0 = (d.q === 0 || d.q === 1) ? 0.505 : 0.005;
    const span = 0.49;
    for (let k = 0; k < uv.count; k++) {
      uv.setXY(k, u0 + uv.getX(k) * span, v0 + uv.getY(k) * span);
    }
    p.rotateX(-Math.PI / 2);
    p.rotateY(d.rot);
    p.translate(d.x, 0.009, d.z);
    decalParts.push(p);
  }
  const decalMat = trackMat(new THREE.MeshBasicMaterial({
    map: pbr.decalAtlas,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.EqualStencilFunc,
    stencilFuncMask: 0x01,
    stencilWriteMask: 0x00,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  }));
  const groundDecalsMesh = new THREE.Mesh(trackGeo(mergeBucket(decalParts, 0)), decalMat);
  groundDecalsMesh.renderOrder = 1;
  group.add(groundDecalsMesh);

  // ==========================================================================
  // 11. 100% GPU Vertex-Shader Rising Embers + Curling Smoke [2 DC, 0 CPU uploads!]
  // ==========================================================================
  const allFireSites = [bonfire3D.fireSite, ...braziers3D.fireSites];
  const EMBER_MAX = 150;
  const emberOrigin = new Float32Array(EMBER_MAX * 3);
  const emberParams = new Float32Array(EMBER_MAX * 4);
  for (let i = 0; i < EMBER_MAX; i++) {
    let ox, oy, oz, riseH, sz;
    if (i < 34) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.1;
      ox = BONFIRE_POS.x + Math.cos(a) * r;
      oy = 0.45;
      oz = BONFIRE_POS.z + Math.sin(a) * r;
      riseH = 4.8 + Math.random() * 2.4;
      sz = 0.14 + Math.random() * 0.10;
    } else if (i < 34 + SOULS_CASTLE_BRAZIERS.length * 6) {
      const bi = Math.floor((i - 34) / 6) % SOULS_CASTLE_BRAZIERS.length;
      const b = SOULS_CASTLE_BRAZIERS[bi];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.36;
      ox = b.x + Math.cos(a) * r;
      oy = 1.25 * (b.scale || 1);
      oz = b.z + Math.sin(a) * r;
      riseH = 3.2 + Math.random() * 2.2;
      sz = 0.11 + Math.random() * 0.08;
    } else {
      ox = (Math.random() - 0.5) * (BOSS_RADIUS * 1.5);
      oy = 0.35;
      oz = BOSS_CENTER_Z + (Math.random() - 0.5) * (BOSS_RADIUS * 1.5);
      riseH = 5.4 + Math.random() * 2.6;
      sz = 0.12 + Math.random() * 0.09;
    }
    emberOrigin[i * 3] = ox;
    emberOrigin[i * 3 + 1] = oy;
    emberOrigin[i * 3 + 2] = oz;
    emberParams[i * 4] = 0.14 + Math.random() * 0.24;
    emberParams[i * 4 + 1] = Math.random();
    emberParams[i * 4 + 2] = riseH;
    emberParams[i * 4 + 3] = sz;
  }
  const emberGeo = trackGeo(new THREE.BufferGeometry());
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberOrigin, 3));
  emberGeo.setAttribute('aParam', new THREE.BufferAttribute(emberParams, 4));
  const getTargetEmberCount = () => (lowSpecMode ? 36 : isMobile ? 84 : EMBER_MAX);
  emberGeo.setDrawRange(0, getTargetEmberCount());

  const emberUniforms = { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window?.devicePixelRatio || 1, 1.5) } };
  const emberMat = trackMat(new THREE.ShaderMaterial({
    uniforms: emberUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec4 aParam;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vLife;
      void main() {
        float life = fract(uTime * aParam.x + aParam.y);
        vLife = life;
        vec3 p = position;
        p.y += life * aParam.z;
        float sw = uTime * 1.9 + aParam.y * 18.84;
        p.x += sin(sw) * 0.34 * life;
        p.z += cos(sw * 0.82) * 0.28 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float pulse = sin(life * 3.14159);
        gl_PointSize = clamp((aParam.w * 280.0 * uPixelRatio * (0.65 + 0.55 * pulse)) / max(1.0, -mv.z), 1.5, 18.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float glow = smoothstep(0.5, 0.08, d);
        if (glow < 0.02) discard;
        float alpha = glow * smoothstep(0.0, 0.14, vLife) * smoothstep(1.0, 0.55, vLife);
        vec3 col = mix(vec3(1.0, 0.88, 0.48), vec3(1.0, 0.38, 0.08), vLife);
        gl_FragColor = vec4(col, alpha * 0.92);
      }
    `
  }));
  const emberPoints = new THREE.Points(emberGeo, emberMat);
  emberPoints.frustumCulled = false;
  emberPoints.renderOrder = 5;
  group.add(emberPoints);

  const SMOKE_MAX = 52;
  const smokeOrigin = new Float32Array(SMOKE_MAX * 3);
  const smokeParams = new Float32Array(SMOKE_MAX * 4);
  for (let i = 0; i < SMOKE_MAX; i++) {
    const site = allFireSites[i % allFireSites.length];
    smokeOrigin[i * 3] = site.x + (Math.random() - 0.5) * 0.22;
    smokeOrigin[i * 3 + 1] = site.y + 0.65 * (site.scale || 1);
    smokeOrigin[i * 3 + 2] = site.z + (Math.random() - 0.5) * 0.22;
    smokeParams[i * 4] = 0.10 + Math.random() * 0.09;
    smokeParams[i * 4 + 1] = Math.random();
    smokeParams[i * 4 + 2] = 2.6 + Math.random() * 1.6;
    smokeParams[i * 4 + 3] = (0.75 + Math.random() * 0.65) * (site.scale || 1);
  }
  const smokeGeo = trackGeo(new THREE.BufferGeometry());
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokeOrigin, 3));
  smokeGeo.setAttribute('aParam', new THREE.BufferAttribute(smokeParams, 4));
  const getTargetSmokeCount = () => (lowSpecMode ? 0 : isMobile ? 26 : SMOKE_MAX);
  smokeGeo.setDrawRange(0, getTargetSmokeCount());

  const smokeUniforms = { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window?.devicePixelRatio || 1, 1.5) } };
  const smokeMat = trackMat(new THREE.ShaderMaterial({
    uniforms: smokeUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec4 aParam;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vLife;
      void main() {
        float life = fract(uTime * aParam.x + aParam.y);
        vLife = life;
        vec3 p = position;
        p.y += life * aParam.z;
        float drift = uTime * 0.9 + aParam.y * 12.56;
        p.x += sin(drift) * 0.42 * life;
        p.z += cos(drift * 0.75) * 0.36 * life - 0.25 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float grow = 0.55 + life * 1.25;
        gl_PointSize = clamp((aParam.w * 260.0 * uPixelRatio * grow) / max(1.0, -mv.z), 4.0, 56.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vLife;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.5, 0.06, d);
        if (soft < 0.02) discard;
        float env = smoothstep(0.0, 0.22, vLife) * smoothstep(1.0, 0.35, vLife);
        vec3 col = mix(vec3(0.24, 0.16, 0.13), vec3(0.11, 0.13, 0.19), vLife);
        gl_FragColor = vec4(col, soft * env * 0.18);
      }
    `
  }));
  const smokePoints = new THREE.Points(smokeGeo, smokeMat);
  smokePoints.frustumCulled = false;
  smokePoints.visible = !lowSpecMode;
  smokePoints.renderOrder = 3;
  group.add(smokePoints);

  // ==========================================================================
  // 12. Low-Spec Mode Toggle (called by world.js when FPS drops or mobile lowSpec)
  // ==========================================================================
  function setLowSpecMode(enabled = false) {
    const next = Boolean(enabled);
    if (next === lowSpecMode) return;
    lowSpecMode = next;

    // ZERO-HITCH: never strip normalMap or set mat.needsUpdate = true mid-combat (causes 200-600ms HLSL recompile freeze!).
    activePoolCount = lowSpecMode ? 1 : MAX_POOL_LIGHTS;
    // ZERO-HITCH: NEVER toggle PointLight.visible (changes the scene light count => recompiles every lit shader mid-fight!).
    // Inactive slots simply fade to intensity 0 and get released; they stay `visible = true`.
    for (let i = 0; i < lightPool.length; i++) {
      lightPool[i].light.visible = true;
      if (i >= activePoolCount) {
        lightPool[i].light.intensity = 0;
        lightPool[i].assignedSrc = -1;
        lightPool[i].fade = 0;
      }
    }

    skyUniforms.uLowSpec.value = lowSpecMode ? 1.0 : 0.0;
    emberGeo.setDrawRange(0, getTargetEmberCount());
    smokeGeo.setDrawRange(0, getTargetSmokeCount());
    smokePoints.visible = !lowSpecMode;

    bonfire3D.setLowSpec(lowSpecMode);
    braziers3D.setLowSpec(lowSpecMode);
    candles3D.setLowSpec(lowSpecMode);
    bannersAndShrines.setLowSpec(lowSpecMode);
    castleRoof.setLowSpec(lowSpecMode);
    castleAtmo.setLowSpec(lowSpecMode);
    flameTraps.setLowSpec(lowSpecMode);
    fireShadowRig?.setLowSpecMode?.(lowSpecMode);
  }

  // ==========================================================================
  // 13. Canonical Walkable Clamping (delegates directly to soulsCastleLayout.js!)
  // ==========================================================================
  function clampPosition(x, z, radius = 0.55, clampOpts = null) {
    const rawState = fogGateSealed ? 'sealed' : castleDoors.getState();
    const dState = (!fogGateSealed && castleDoors.isPassable()) ? 'open' : rawState;
    const allowBossHall =
      clampOpts && typeof clampOpts.allowBossHall === 'boolean'
        ? clampOpts.allowBossHall
        : (fogGateSealed || z < BOSS_DOOR_Z - 0.5);
    return clampCastlePosition(x, z, radius, {
      ...(clampOpts && typeof clampOpts === 'object' ? clampOpts : null),
      bossDoorState: dState,
      allowBossHall
    });
  }

  function getFloorHeight(x = 0, z = 0) {
    if (typeof CastleLayout.getCastleFloorHeight === 'function') {
      return CastleLayout.getCastleFloorHeight(x, z);
    }
    return fallbackCastleFloorHeight(x, z);
  }

  function getSurfaceType(x = 0, z = 0) {
    return getCastleSurfaceType(x, z);
  }

  function getColliders() {
    return staticColliders;
  }

  function tryBreakCandlesNear(x, z, r = 0.72) {
    return candles3D.tryBreakCandlesNear(x, z, r);
  }

  function resetCandles() {
    candles3D.resetCandles();
  }

  function setShrineClaimed(id, claimed = true) {
    const normId = id === 0 || id === 'east' || id === 'east_armory' ? 'east_estus_shrine' : id;
    return bannersAndShrines.setShrineClaimed(normId, claimed);
  }

  function resetShrines() {
    bannersAndShrines.resetShrines();
  }

  function getSoulsCastleLayout() {
    return {
      constants: SOULS_CASTLE_CONSTANTS,
      bonfire: SOULS_CASTLE_BONFIRE,
      playerSpawn: SOULS_CASTLE_PLAYER_SPAWN,
      door: SOULS_CASTLE_DOOR_CONFIG,
      throne: SOULS_CASTLE_THRONE_CONFIG,
      rooms: SOULS_CASTLE_ROOMS,
      relics: SOULS_CASTLE_RELICS,
      encounters: SOULS_CASTLE_ENCOUNTERS,
      flameTraps: SOULS_CASTLE_FLAME_TRAPS
    };
  }

  // ==========================================================================
  // 13b. Flame-Trap API (combat.js damage queries) + Boss-Hall Occlusion API
  // ==========================================================================
  function getActiveFlameBoxes() {
    return flameTraps.getActiveFlameBoxes();
  }
  function isPointInFlameTrap(x, z, y = 1.0, r = 0.35) {
    return flameTraps.isPointInFlame(x, z, y, r);
  }
  function getFlameTrapStates() {
    return flameTraps.getTrapStates();
  }

  // True when the Boss Hall content may be skipped: doors closed, no cutscene, player far south of the doors.
  function isBossHallOccludedAt(playerZ, doorState, cutsceneActive = false) {
    if (cutsceneActive) return false;
    if (doorState !== 'closed') return false;
    if (!Number.isFinite(playerZ)) return false;
    return playerZ > BOSS_DOOR_Z + BOSS_OCCLUSION_MARGIN_Z;
  }
  function isBossHallOccluded(playerZ) {
    // Honour the warm-up window so the Throne shaders compile before the first time it is hidden.
    if (throneWarmFrames > 0) return false;
    return isBossHallOccludedAt(playerZ, castleDoors.getState(), wasCutsceneDriven);
  }

  // ==========================================================================
  // 14. Per-Frame Zero-Allocation Update (Doors, Cutscene, Roof, Atmosphere, Props, Lights)
  // ==========================================================================
  const _camPosScratch = new THREE.Vector3();
  const _atmoFrameOpts = { doorOpenProgress: 0 };
  const _fireRigOpts = {
    heroX: 0,
    heroZ: 0,
    camPos: null,
    bossDoorState: 'closed',
    cutsceneActive: false,
    trapSources: null
  };

  function update(dt = 0.016, t = 0, opts = null) {
    if (!group.visible) return;
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);

    // 1. Advance GPU shader clocks & modular 3D props
    skyUniforms.uTime.value = t;
    emberUniforms.uTime.value = t;
    thresholdGlowUniforms.uTime.value = t;
    if (!lowSpecMode) smokeUniforms.uTime.value = t;
    bossRuneMat.opacity = 0.14 + Math.sin(t * 2.1) * 0.035;

    bonfire3D.update(safeDt, t);
    braziers3D.update(safeDt, t);
    candles3D.update(safeDt, t);
    bannersAndShrines.update(safeDt, t);

    // 2. Monumental Twin Boss Doors animation (supports 7.2s choreographed cutscene OR standalone!)
    const cutState = opts && opts.cutsceneState ? opts.cutsceneState : null;
    const cutsceneActive = Boolean(cutState && cutState.active);
    let doorRes;
    if (cutsceneActive) {
      wasCutsceneDriven = true;
      doorRes = castleDoors.applyCutsceneState(cutState, safeDt);
    } else {
      if (wasCutsceneDriven) {
        wasCutsceneDriven = false;
        castleDoors.applyCutsceneState(null, safeDt);
      }
      doorRes = castleDoors.update(safeDt, t);
    }
    lastDoorShudder = doorRes?.doorShudderIntensity || 0;
    const dState = doorRes?.state || castleDoors.getState();
    const dProg = doorRes?.openProgress || 0;

    // 2b. P1 Occlusion Culling — hide the Throne (+ expose the flag for combat.js to hide the 182k-tri Boss)
    //     while the Boss Doors are closed and the player is still far from them. Warm-up frames let shaders compile first.
    const playerZForOcclusion = (opts && Number.isFinite(opts.playerZ)) ? opts.playerZ : NaN;
    if (throneWarmFrames > 0) throneWarmFrames--;
    throneOccluded = throneWarmFrames <= 0 && isBossHallOccludedAt(playerZForOcclusion, dState, cutsceneActive);
    throneGrp.visible = !throneOccluded;

    // 2c. Wall flame-jet traps (deterministic time-driven; same phases are read by combat.js through getActiveFlameBoxes())
    flameTraps.update(t, safeDt);
    if (dState === 'opening' || dState === 'open') {
      if (dProg > 0.02) {
        thresholdGlowMesh.visible = true;
        thresholdGlowMesh.scale.set(0.55 + 0.45 * dProg, 0.45 + 0.55 * dProg, 1.0);
        thresholdGlowMesh.position.z = BOSS_DOOR_Z + 0.95;
        thresholdGlowUniforms.uColor.value.setHex(0xff9234);
        thresholdGlowUniforms.uOpacity.value = (0.16 + Math.sin(t * 2.4) * 0.02) * dProg;
      } else {
        thresholdGlowMesh.visible = false;
        thresholdGlowUniforms.uOpacity.value = 0.0;
      }
    } else if (dState === 'sealed' && thresholdGlowMesh.visible) {
      const pulse = 0.85 + Math.sin(t * 5.2) * 0.15;
      thresholdGlowUniforms.uColor.value.setHex(0xe8821c);
      thresholdGlowUniforms.uOpacity.value = 0.22 * pulse;
    }

    // 3. Camera-Safe Auto-Fade on Arches, South/Side Upper Walls & Sealed Boss Doors
    const focusX = (opts && Number.isFinite(opts.playerX)) ? opts.playerX : 0;
    const focusZ = (opts && Number.isFinite(opts.playerZ))
      ? opts.playerZ
      : (fogGateSealed ? BOSS_CENTER_Z : BONFIRE_POS.z - 3.2);
    const hasCam = opts && Number.isFinite(opts.camZ);
    const camX = hasCam ? opts.camX : 0;
    const camY = hasCam ? (opts.camY ?? 4.0) : 4.0;
    const camZ = hasCam ? opts.camZ : 999;

    // 3a. Update Solid Vaulted Gothic Roof (chandelier sway, stained-glass Fresnel, flames) & Volumetric Atmosphere
    if (hasCam) _camPosScratch.set(camX, camY, camZ);
    castleRoof.update(t, safeDt, hasCam ? _camPosScratch : null);
    _atmoFrameOpts.doorOpenProgress = dProg;
    castleAtmo.update(t, safeDt, _atmoFrameOpts);
    _fireRigOpts.heroX = focusX;
    _fireRigOpts.heroZ = focusZ;
    _fireRigOpts.camPos = hasCam ? _camPosScratch : null;
    _fireRigOpts.bossDoorState = dState;
    _fireRigOpts.cutsceneActive = cutsceneActive;
    _fireRigOpts.trapSources = flameTraps.getActiveTrapLightSources?.() || null;
    fireShadowRig?.update?.(t, safeDt, _fireRigOpts);

    const minSightZ = Math.min(camZ, focusZ) - 1.2;
    const maxSightZ = Math.max(camZ, focusZ) + 1.8;
    const fadeLerp = 1 - Math.exp(-12 * safeDt);

    for (let i = 0; i < archEntries.length; i++) {
      const ae = archEntries[i];
      const a = ae.arch;
      let targetOp = 1.0;
      if (hasCam && a.cameraFade) {
        if (a.axis === 'z') {
          const dist = Math.hypot(camX - a.x, camZ - a.z);
          if (dist < 4.2 && camY > 1.6) targetOp = 0.0;
        } else {
          const dzCam = Math.abs(camZ - a.z);
          const nearHoriz = Math.abs(camX - a.x) < a.halfSpan + 4.5;
          const between = nearHoriz && a.z >= minSightZ && a.z <= maxSightZ;
          if (between || (nearHoriz && dzCam < 4.4 && camY > 1.6)) {
            targetOp = 0.0;
          } else if (nearHoriz && dzCam < 6.2 && camY > 1.6) {
            targetOp = Math.max(0.0, (dzCam - 4.4) / 1.8);
          }
        }
      }
      ae.curOpacity += (targetOp - ae.curOpacity) * fadeLerp;
      if (ae.curOpacity < 0.03) {
        ae.mesh.visible = false;
      } else {
        ae.mesh.visible = true;
        const isFading = ae.curOpacity < 0.992;
        ae.mat.transparent = isFading;
        ae.mat.opacity = isFading ? ae.curOpacity : 1.0;
        ae.mat.depthWrite = !isFading || ae.curOpacity > 0.85;
      }
    }

    // If sealed Boss Doors stand physically between camera (on corridor side) and hero (inside Boss Hall), hide doors cleanly
    // NEVER hide doors during the active 7.2s choreographed Boss Door cutscene!
    const sealedBlocksCam =
      !cutsceneActive &&
      dState === 'sealed' &&
      hasCam &&
      ((camZ > BOSS_DOOR_Z - 0.5 && focusZ < BOSS_DOOR_Z - 0.2) || (Math.abs(camZ - BOSS_DOOR_Z) < 2.2 && focusZ < BOSS_DOOR_Z));
    castleDoors.group.visible = !sealedBlocksCam;

    // Fade upper perimeter side/alcove walls ONLY if camera swings outside them (limits derived from layout constants)
    const SC = SOULS_CASTLE_CONSTANTS;
    // 3. Keep castle walls solid & opaque (authentic Elden Ring spring-arm collision, zero mid-walk shader recompilation hitches!)
    for (let i = 0; i < fadeWallEntries.length; i++) {
      const fw = fadeWallEntries[i];
      fw.curOpacity = 1.0;
      fw.mesh.visible = true;
    }

    // 4. Dynamic Nearest-Light PointLight Pool (4 PC / 2 Mobile / 1 LowSpec, 0 shader recompiles!)
    // During an active Boss intro cutscene, pin 2 dedicated pool slots to the seated Boss face/Throne
    // and the Cathedral dome-lantern hall center so every dialogue close-up & wide shot reads with crisp nobility!
    const kCount = Math.min(activePoolCount, lightPool.length);
    for (let k = 0; k < kCount; k++) {
      _topLightIndices[k] = -1;
      _topLightScores[k] = 1e9;
    }

    let pinnedCount = 0;
    if (cutsceneActive && kCount >= 1 && throneFaceKeyIdx >= 0) {
      _topLightIndices[0] = throneFaceKeyIdx;
      _topLightScores[0] = -2.0;
      pinnedCount = 1;
      if (kCount >= 2 && domeMoonFillIdx >= 0) {
        _topLightIndices[1] = domeMoonFillIdx;
        _topLightScores[1] = -1.0;
        pinnedCount = 2;
      }
    }

    const throneFocusBias = cutsceneActive ? 1.0 : 0.0;
    const lightFocusX = focusX * (1 - throneFocusBias) + tx * throneFocusBias;
    const lightFocusZ = focusZ * (1 - throneFocusBias) + (tz + 3.0) * throneFocusBias;

    for (let i = 0; i < virtualLights.length; i++) {
      if (cutsceneActive && (i === throneFaceKeyIdx || (kCount >= 2 && i === domeMoonFillIdx))) continue;
      const vl = virtualLights[i];
      if (vl.shrineId && bannersAndShrines.isShrineClaimed(vl.shrineId)) continue;
      const dx = vl.x - lightFocusX;
      const dz = vl.z - lightFocusZ;
      const score = (dx * dx + dz * dz + 4.0) / (vl.weight || 1.0);
      for (let k = pinnedCount; k < kCount; k++) {
        if (score < _topLightScores[k]) {
          for (let j = kCount - 1; j > k; j--) {
            _topLightScores[j] = _topLightScores[j - 1];
            _topLightIndices[j] = _topLightIndices[j - 1];
          }
          _topLightScores[k] = score;
          _topLightIndices[k] = i;
          break;
        }
      }
    }

    _srcUsedFlags.fill(0);
    for (let s = 0; s < kCount; s++) {
      const slot = lightPool[s];
      let stillTop = false;
      for (let k = 0; k < kCount; k++) {
        if (_topLightIndices[k] === slot.assignedSrc) {
          stillTop = true;
          _srcUsedFlags[slot.assignedSrc] = 1;
          break;
        }
      }
      if (!stillTop) slot.assignedSrc = -1;
    }
    for (let k = 0; k < kCount; k++) {
      const srcIdx = _topLightIndices[k];
      if (srcIdx < 0 || _srcUsedFlags[srcIdx]) continue;
      for (let s = 0; s < kCount; s++) {
        if (lightPool[s].assignedSrc === -1) {
          lightPool[s].assignedSrc = srcIdx;
          lightPool[s].fade = 0.14;
          const vl = virtualLights[srcIdx];
          lightPool[s].light.position.set(vl.x, vl.y, vl.z);
          lightPool[s].light.color.setHex(vl.color);
          lightPool[s].light.distance = vl.dist;
          _srcUsedFlags[srcIdx] = 1;
          break;
        }
      }
    }
    const posLerp = 1 - Math.exp(-10 * safeDt);
    const colLerp = 1 - Math.exp(-8 * safeDt);
    for (let s = 0; s < kCount; s++) {
      const slot = lightPool[s];
      const pl = slot.light;
      if (slot.assignedSrc < 0) {
        pl.intensity = 0;
        continue;
      }
      const vl = virtualLights[slot.assignedSrc];
      slot.fade = Math.min(1, slot.fade + safeDt * 5.2);

      // Gentle close-up refinement during active Boss intro cutscene (0 overexposure, crisp facial readability!)
      let targetX = vl.x;
      let targetY = vl.y;
      let targetZ = vl.z;
      let targetInt = vl.baseInt;
      let targetDist = vl.dist;
      let targetHex = vl.color;
      if (cutsceneActive && slot.assignedSrc === throneFaceKeyIdx) {
        if (kCount === 1) {
          // 1-light LowSpec cutscene: balanced warm-neutral key illuminating both Throne & hall center
          targetX = tx + 0.55;
          targetY = 3.9;
          targetZ = tz + 4.6;
          targetInt = 6.2;
          targetDist = 30;
          targetHex = 0xffc88a;
        } else {
          // Classic 3/4 portrait key right in front of seated Boss face (0, 2.2, -30.5) & Obsidian Throne
          targetX = tx + 0.75;
          targetY = 2.85;
          targetZ = tz + 4.1;
          targetInt = 5.2;
          targetDist = 25;
          targetHex = 0xffb66c;
        }
      } else if (cutsceneActive && slot.assignedSrc === domeMoonFillIdx) {
        targetInt = 6.4;
        targetDist = 34;
      }

      const fl = vl.steady
        ? (0.96 + Math.sin(t * 3.1 + (vl.phase || 0)) * 0.04)
        : (0.86 + Math.sin(t * 9.8 + (vl.phase || 0)) * 0.09 + Math.sin(t * 19.4 + (vl.phase || 0)) * 0.05);
      pl.position.x += (targetX - pl.position.x) * posLerp;
      pl.position.y += (targetY - pl.position.y) * posLerp;
      pl.position.z += (targetZ - pl.position.z) * posLerp;
      _tmpLightColor.setHex(targetHex);
      pl.color.lerp(_tmpLightColor, colLerp);
      pl.distance = targetDist;
      pl.intensity = targetInt * fl * slot.fade;
    }
    // Slots beyond the active quality budget stay `visible` (zero-recompile) but contribute 0 light
    for (let s = kCount; s < lightPool.length; s++) {
      lightPool[s].light.intensity = 0;
      lightPool[s].assignedSrc = -1;
      lightPool[s].fade = 0;
    }
  }

  function getStats() {
    return {
      isMobile,
      lowSpecMode,
      activePointLights: activePoolCount,
      maxPointLights: MAX_POOL_LIGHTS,
      bossDoorState: castleDoors.getState(),
      doorOpenProgress: Number(castleDoors.getOpenProgress().toFixed(3)),
      doorShudderIntensity: Number(lastDoorShudder.toFixed(3)),
      candleCount: candles3D.getActiveCount(),
      wallLanternCount: SOULS_CASTLE_WALL_LANTERNS.length,
      brazierCount: SOULS_CASTLE_BRAZIERS.length,
      colliderCount: staticColliders.length,
      emberCount: emberGeo.drawRange.count,
      smokeVisible: smokePoints.visible,
      roofDrawCalls: castleRoof.getDrawCallCount(),
      atmosphereStats: castleAtmo.getStats(),
      flameTrapCount: flameTraps.count,
      flameTrapDrawCalls: flameTraps.getDrawCalls(),
      throneOccluded,
      bossHallOccluded: throneOccluded
    };
  }

  function dispose() {
    throneDisposed = true;
    fireShadowRig?.dispose?.();
    flameTraps.dispose();
    castleRoof.dispose();
    castleAtmo.dispose();
    bonfire3D.dispose();
    braziers3D.dispose();
    candles3D.dispose();
    bannersAndShrines.dispose();
    castleDoors.dispose();
    pbr.dispose();
    for (const g of ownedGeos) g.dispose?.();
    for (const m of ownedMats) m.dispose?.();
    for (const t of ownedTex) t.dispose?.();
    ownedGeos.length = 0;
    ownedMats.length = 0;
    ownedTex.length = 0;
  }

  return {
    group,
    getColliders,
    clampPosition,
    getFloorHeight,
    getSurfaceType,
    getBossDoorState,
    getDoorShudderIntensity,
    openBossDoors,
    sealBossDoors,
    resetBossDoors,
    setFogGateSealed,
    isBossHallOccluded,
    getActiveFlameBoxes,
    isPointInFlameTrap,
    getFlameTrapStates,
    tryBreakCandlesNear,
    resetCandles,
    setShrineClaimed,
    resetShrines,
    setLowSpecMode,
    getBonfirePos: () => ({ ...BONFIRE_POS }),
    getThroneConfig: () => ({ ...SOULS_THRONE_CONFIG }),
    getCastleZones: () => SOULS_CASTLE_ZONES,
    getSoulsCastleLayout,
    getStats,
    update,
    dispose
  };
}
