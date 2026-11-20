// Pass 1 AAA Gothic Castle 3D Props for Chapter 26 — «Abandoned Knight Rift»
// Upgraded for Dark Souls / Elden Ring visual craft within Mobile Yandex Games budget:
//   1. createHeroBonfire3D             -> Sculpted 12-stone charred hearth + ash mound + 5 charred crossed logs
//                                         + 3D skull/mandible & 8 bones/ribs + beveled forged Coiled Sword
//                                         + real multi-layer FBM fire, molten-crack coals, sparks & smoke (soulsFireVfx.js)
//   2. createGothicLanternBraziers3D   -> 12 carved gothic stone pedestals (real ashlar PBR) + multi-tier 8-bar forged
//                                         iron cages w/ scrolls & spires + 21 scrolled wall bracket lanterns w/ chains
//                                         & leaded-glass mullions + charred molten-crack coals + real instanced FBM flames
//                                         (no blobby orange halo!) + subtle wall firelight/soot bounce + HARD colliders!
//   3. createMeltedCandleClusters3D    -> 3 DC InstancedMesh: forged iron saucers w/ spilled wax puddle + sculpted beeswax
//                                         w/ 6 pronounced 3D drips & charred wicks + sapphire-blue cup candle flame shader
//                                         + tryBreakCandlesNear(x, z, r) / resetCandles() / setLowSpec(enabled)
//   4. createCastleBannersAndShrines3D -> 10x18 draped tattered gothic banners w/ AAA bannerAlbedo/Normal/Roughness &
//                                         multi-harmonic cloth wind shader + forged spear crossbars/chains + carved stone
//                                         Relic Altar w/ instanced runic crystal (setShrineClaimed) + East Alcove Armory
//                                         decor (2 weapon racks, 2 knight armor stands, 5 wall shields w/ crossed swords)!
// Zero WebGL memory leaks: every internal Geometry, Material, and Texture is tracked & auto-disposed on dispose().

import * as THREE_BASE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

// ============================================================================
// Mobile Tessellation Shim (#413 perf audit): every primitive built in this module
// is auto-decimated (radial/tubular segments ~0.6x, min 5-6) while a factory is
// building with isMobile === true. Desktop output stays 100% identical.
// ============================================================================
let SEG_MOBILE = false;
const segR = (n, min = 6) => (SEG_MOBILE && n > min ? Math.max(min, Math.round(n * 0.6)) : n);

class MCylinderGeometry extends THREE_BASE.CylinderGeometry {
  constructor(rt, rb, h, radial = 8, heightSegs = 1, open = false, ts, tl) {
    super(rt, rb, h, segR(radial, 5), SEG_MOBILE ? Math.max(1, Math.ceil(heightSegs * 0.5)) : heightSegs, open, ts, tl);
  }
}
class MSphereGeometry extends THREE_BASE.SphereGeometry {
  constructor(r, w = 8, h = 6, ps, pl, ts, tl) {
    super(r, SEG_MOBILE ? Math.max(5, segR(w, 5)) : w, SEG_MOBILE ? Math.max(4, Math.round(h * 0.65)) : h, ps, pl, ts, tl);
  }
}
class MTorusGeometry extends THREE_BASE.TorusGeometry {
  constructor(r, tube, radial = 8, tubular = 6, arc) {
    super(r, tube, SEG_MOBILE ? Math.max(3, Math.round(radial * 0.75)) : radial, segR(tubular, 5), arc);
  }
}
class MLatheGeometry extends THREE_BASE.LatheGeometry {
  constructor(points, segments = 12, phiStart, phiLength) {
    super(points, segR(segments, 6), phiStart, phiLength);
  }
}
class MConeGeometry extends THREE_BASE.ConeGeometry {
  constructor(r, h, radial = 8, heightSegs = 1, open = false, ts, tl) {
    super(r, h, segR(radial, 4), heightSegs, open, ts, tl);
  }
}
class MDodecahedronGeometry extends THREE_BASE.DodecahedronGeometry {
  constructor(radius = 1, detail = 0) {
    super(radius, SEG_MOBILE ? 0 : detail);
  }
}
class MIcosahedronGeometry extends THREE_BASE.IcosahedronGeometry {
  constructor(radius = 1, detail = 0) {
    super(radius, detail);
  }
}

const THREE = {
  ...THREE_BASE,
  CylinderGeometry: MCylinderGeometry,
  SphereGeometry: MSphereGeometry,
  TorusGeometry: MTorusGeometry,
  LatheGeometry: MLatheGeometry,
  ConeGeometry: MConeGeometry,
  DodecahedronGeometry: MDodecahedronGeometry,
  IcosahedronGeometry: MIcosahedronGeometry
};

import {
  createBonfireFlameAssembly,
  createInstancedBrazierFlames,
  createInstancedWallLanternFlames,
  createCandleFlameShaderMaterial,
  createCandleFlameTeardropGeometry
} from './soulsFireVfx.js?v=20261121z64';
import { SOULS_CASTLE_ALCOVE_DECOR } from './soulsCastleLayout.js?v=20261121z64';

// ============================================================================
// Deterministic PRNG, Transforms, Box-Projected UVs & Safe Geometry Merging
// ============================================================================
function makeRng(seedInit) {
  let seed = seedInit >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function resolveYaw(spec) {
  if (Number.isFinite(spec?.rotY)) return spec.rotY;
  if (Number.isFinite(spec?.facing)) return spec.facing;
  if (Number.isFinite(spec?.normalX) || Number.isFinite(spec?.normalZ)) {
    return Math.atan2(spec.normalX || 0, spec.normalZ || 0);
  }
  if (Number.isFinite(spec?.nx) || Number.isFinite(spec?.nz)) {
    return Math.atan2(spec.nx || 0, spec.nz || 0);
  }
  return 0;
}

function makeXform(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

// Tilt a vertical bar strictly in its radial plane (positive radialTilt leans inward toward axis, negative leans outward)
function makeRadialBar(geo, dist, y, ang, radialTilt = 0, centerZ = 0) {
  if (radialTilt !== 0) geo.rotateZ(radialTilt);
  if (ang !== 0) geo.rotateY(-ang);
  geo.translate(Math.cos(ang) * dist, y, centerZ + Math.sin(ang) * dist);
  return geo;
}

const _tmpColor = new THREE.Color();
const _tmpColor2 = new THREE.Color();
const _dummy = new THREE.Object3D();

// World-space box-projected UVs so ashlar stone & hammered iron PBR normal/roughness maps tile crisply on every bevel
function applyBoxProjectedUVs(geo, tileScale = 1.6) {
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  if (!pos || !norm) return geo;
  let uv = geo.attributes.uv;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
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

// Normalize geometry for safe vertex-colored merging (disposes rawGeo)
function tagGeo(rawGeo, {
  colorHex = 0xffffff,
  bottomColorHex = null,
  jitter = 0.0,
  rng = null,
  uvTile = 0
} = {}) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  rawGeo.dispose();

  for (const attrName of Object.keys(g.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv' && attrName !== 'color') {
      g.deleteAttribute(attrName);
    }
  }
  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  if (uvTile > 0) {
    applyBoxProjectedUVs(g, uvTile);
  } else if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }

  const pos = g.attributes.position;
  const count = pos.count;

  let minY = Infinity;
  let maxY = -Infinity;
  if (bottomColorHex !== null) {
    for (let i = 0; i < count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const spanY = Math.max(1e-4, maxY - minY);
  const colors = new Float32Array(count * 3);
  _tmpColor.setHex(colorHex);
  if (bottomColorHex !== null) _tmpColor2.setHex(bottomColorHex);

  for (let i = 0; i < count; i++) {
    let r = _tmpColor.r;
    let gr = _tmpColor.g;
    let b = _tmpColor.b;
    if (bottomColorHex !== null) {
      const t = (pos.getY(i) - minY) / spanY;
      r = _tmpColor2.r + (r - _tmpColor2.r) * t;
      gr = _tmpColor2.g + (gr - _tmpColor2.g) * t;
      b = _tmpColor2.b + (b - _tmpColor2.b) * t;
    }
    if (jitter > 0 && rng) {
      const j = 1.0 + (rng() - 0.5) * 2.0 * jitter;
      r = Math.min(1, Math.max(0, r * j));
      gr = Math.min(1, Math.max(0, gr * j));
      b = Math.min(1, Math.max(0, b * j));
    }
    colors[i * 3] = r;
    colors[i * 3 + 1] = gr;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function mergeTaggedParts(parts, boxUvTile = 0) {
  if (!parts.length) return null;
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  if (merged && boxUvTile > 0) {
    applyBoxProjectedUVs(merged, boxUvTile);
  }
  return merged;
}

function attachTextureCleanup(mat, textures, trackTex) {
  const valid = textures.filter(Boolean);
  for (const t of valid) {
    if (trackTex) trackTex(t);
  }
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const t of valid) t.dispose();
  };
  if (mat && typeof mat.addEventListener === 'function') {
    mat.addEventListener('dispose', cleanup);
  }
  return cleanup;
}

// ============================================================================
// 1. HERO COILED SWORD BONFIRE 3D
//    - Sculpted 12-stone charred basalt ring + rubble chips + windblown ash heap
//    - 5 crossed charred split firewood logs plunging into the coals
//    - Stylized 3D Gothic Skull + detached mandible + 8 half-buried 3D bones/ribs
//    - Detailed beveled helical Coiled Sword w/ forged iron PBR (normal+roughness)
//    - Real multi-layer FBM fire, molten-fissure charcoal bed, rising sparks &
//      curling smoke via createBonfireFlameAssembly (soulsFireVfx.js)
//    - Solid collider { x, z, r: 1.05, radius: 1.05 }
// ============================================================================
function buildBonfireHearthGeometry() {
  const rng = makeRng(260509);
  const parts = [];

  // 1A. Sculpted Windblown Ash Heap & Soot Apron (cratered hollow cradles the molten coal bed)
  const ashGeo = new THREE.CylinderGeometry(0.62, 1.34, 0.34, 20, 5, false);
  const ashPos = ashGeo.attributes.position;
  for (let i = 0; i < ashPos.count; i++) {
    let vx = ashPos.getX(i);
    let vy = ashPos.getY(i) + 0.17; // 0..0.34
    let vz = ashPos.getZ(i);
    const r = Math.hypot(vx, vz);
    const a = Math.atan2(vz, vx);
    const drift = 1.0 + Math.sin(a * 5.0 + 0.6) * 0.08 + Math.cos(a * 3.0 - 0.5) * 0.07;
    vx *= drift;
    vz *= drift;
    if (vy > 0.28 && r < 0.64) {
      // Deep concave crater hollow so dark molten coal bed nestles naturally inside
      vy -= (1.0 - r / 0.66) * 0.11;
    } else if (vy > 0.03) {
      vy += Math.sin(a * 7.0 + r * 4.0) * 0.024 + (rng() - 0.5) * 0.012;
    }
    ashPos.setXYZ(i, vx, Math.max(0.0, vy), vz);
  }
  ashGeo.computeVertexNormals();
  parts.push(tagGeo(ashGeo, {
    colorHex: 0x4b464d,
    bottomColorHex: 0x18171c,
    jitter: 0.09,
    rng
  }));

  // 1B. Ring of 12 Jagged Scorched Basalt Hearth Stones + 8 Small Fallen Rubble Chips
  const STONE_COUNT = 12;
  for (let i = 0; i < STONE_COUNT; i++) {
    const baseAngle = (i / STONE_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.14;
    const dist = 0.94 + (rng() - 0.5) * 0.16;
    const sx = Math.cos(baseAngle) * dist;
    const sz = Math.sin(baseAngle) * dist;
    const rad = 0.20 + rng() * 0.10;
    const stone = new THREE.DodecahedronGeometry(rad, 1);
    const sp = stone.attributes.position;
    for (let v = 0; v < sp.count; v++) {
      let x = sp.getX(v);
      let y = sp.getY(v);
      let z = sp.getZ(v);
      // Angular cleaved basalt facets & flat grounded base
      const ridge = 0.78 + 0.36 * ((Math.sin(x * 14 + i * 1.3) * Math.cos(z * 12 - i) + 1) * 0.5);
      x *= ridge * (1.06 + (i % 3) * 0.11);
      z *= ridge * (0.90 + ((i + 1) % 2) * 0.18);
      y *= (y < 0 ? 0.48 : 1.05 + (i % 3) * 0.18);
      sp.setXYZ(v, x, y, z);
    }
    stone.computeVertexNormals();
    makeXform(
      stone,
      sx, rad * 0.38, sz,
      (rng() - 0.5) * 0.34,
      baseAngle + (rng() - 0.5) * 0.7,
      (rng() - 0.5) * 0.32
    );
    const tagged = tagGeo(stone, {
      colorHex: i % 2 === 0 ? 0x3b3f4d : 0x323542,
      bottomColorHex: 0x15151b,
      jitter: 0.08,
      rng
    });
    // Heavy fire-soot blackening on stone faces turned inward toward the flames
    const tp = tagged.attributes.position;
    const tc = tagged.attributes.color;
    for (let v = 0; v < tp.count; v++) {
      const dr = Math.hypot(tp.getX(v), tp.getZ(v));
      if (dr < dist - 0.02) {
        const scorch = 0.42;
        tc.setXYZ(v, tc.getX(v) * scorch, tc.getY(v) * scorch * 0.90, tc.getZ(v) * scorch * 0.86);
      }
    }
    parts.push(tagged);
  }

  // Scattered dark basalt rubble & ash clods around perimeter so stones feel organically embedded
  for (let c = 0; c < 8; c++) {
    const a = (c / 8) * Math.PI * 2 + 0.32 + (rng() - 0.5) * 0.25;
    const d = 1.14 + rng() * 0.22;
    const chip = new THREE.DodecahedronGeometry(0.075 + rng() * 0.05, 0);
    makeXform(chip, Math.cos(a) * d, 0.035, Math.sin(a) * d, rng() * 2, rng() * 3, rng() * 2, 1.3, 0.55, 1.0);
    parts.push(tagGeo(chip, { colorHex: 0x353844, bottomColorHex: 0x17181e, rng }));
  }

  // 1C. 5 Crossed Charred Split Firewood Logs plunging into the molten hearth center
  const logAngles = [0.22, 1.48, 2.74, 3.98, 5.24];
  for (let l = 0; l < logAngles.length; l++) {
    const ang = logAngles[l];
    const len = 0.86 + (l % 2) * 0.16;
    const rad = 0.058 + (l % 3) * 0.011;
    const log = new THREE.CylinderGeometry(rad * 0.72, rad, len, 7, 4);
    const lp = log.attributes.position;
    for (let v = 0; v < lp.count; v++) {
      const x = lp.getX(v);
      const y = lp.getY(v);
      const z = lp.getZ(v);
      const a = Math.atan2(z, x);
      const bark = 0.88 + 0.20 * Math.sin(a * 4.0 + y * 9.0 + l);
      lp.setXYZ(v, x * bark, y, z * bark);
    }
    log.computeVertexNormals();
    // Tilt log inward toward hearth center (top end charred deep black/ember inside fire!)
    const dist = 0.44;
    makeRadialBar(log, dist, 0.27 + (l % 2) * 0.04, ang, 1.06);
    parts.push(tagGeo(log, {
      colorHex: 0x1d1311,       // Charred blackened wood tip inside coals
      bottomColorHex: 0x3a2c24, // Weathered dark soot-stained outer bark
      jitter: 0.07,
      rng
    }));
  }

  // 1D. Iconic Dark Souls 3D Skull + Detached Mandible resting prominently at front-right of hearth
  const buildSkull = (ox, oy, oz, rx, ry, rz, scale = 1.08) => {
    const skullLocal = [];
    const cranium = new THREE.IcosahedronGeometry(0.148, 1);
    const cp = cranium.attributes.position;
    for (let v = 0; v < cp.count; v++) {
      let x = cp.getX(v);
      let y = cp.getY(v);
      let z = cp.getZ(v);
      x *= 0.88;
      z *= 1.12;
      if (y < -0.02) {
        x *= 0.83;
        z *= 0.91;
      }
      if (z > 0.08 && y > -0.02 && y < 0.065) {
        z += 0.025; // Prominent gothic brow ridge
      }
      cp.setXYZ(v, x, y, z);
    }
    cranium.computeVertexNormals();
    skullLocal.push(tagGeo(cranium, { colorHex: 0xd9cdb4, bottomColorHex: 0x7e6e59, jitter: 0.04, rng }));

    // Zygomatic arches & upper maxilla
    skullLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.178, 0.068, 0.095), 0, -0.075, 0.082), {
      colorHex: 0xcabca0, bottomColorHex: 0x7a6a55
    }));
    skullLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.128, 0.056, 0.086), 0, -0.118, 0.106), {
      colorHex: 0xc4b59a, bottomColorHex: 0x6b5b49
    }));
    // Sculpted upper teeth
    for (let t = -1.5; t <= 1.5; t += 1.0) {
      skullLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.021, 0.028, 0.024), t * 0.027, -0.152, 0.139), {
        colorHex: 0xdfd3ba, bottomColorHex: 0x8e7e68
      }));
    }
    // Deep recessed orbital eye sockets & nasal aperture
    skullLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.039, 7, 5), -0.050, -0.022, 0.128, 0, 0, 0, 1.05, 0.88, 0.65), {
      colorHex: 0x100c0c
    }));
    skullLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.039, 7, 5),  0.050, -0.022, 0.128, 0, 0, 0, 1.05, 0.88, 0.65), {
      colorHex: 0x100c0c
    }));
    skullLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.022, 0.048, 3), 0, -0.078, 0.142, 0.12, Math.PI, 0), {
      colorHex: 0x130e0e
    }));

    const skullMerged = mergeTaggedParts(skullLocal);
    makeXform(skullMerged, ox, oy, oz, rx, ry, rz, scale, scale, scale);
    parts.push(skullMerged);

    // Detached lower jawbone resting in the ash
    const jawLocal = [
      tagGeo(makeXform(new THREE.BoxGeometry(0.132, 0.036, 0.076), 0, 0, 0), { colorHex: 0xc2b399, bottomColorHex: 0x625444 }),
      tagGeo(makeXform(new THREE.BoxGeometry(0.028, 0.062, 0.052), -0.062, 0.022, -0.032, -0.35, 0, 0), { colorHex: 0xb7a894, bottomColorHex: 0x625444 }),
      tagGeo(makeXform(new THREE.BoxGeometry(0.028, 0.062, 0.052),  0.062, 0.022, -0.032, -0.35, 0, 0), { colorHex: 0xb7a894, bottomColorHex: 0x625444 })
    ];
    const jawMerged = mergeTaggedParts(jawLocal);
    makeXform(jawMerged, ox - 0.13 * scale, oy - 0.11 * scale, oz + 0.16 * scale, 0.16, ry - 0.56, 0.22, scale, scale, scale);
    parts.push(jawMerged);
  };
  buildSkull(0.38, 0.28, 0.60, -0.24, 0.46, -0.18, 1.10);

  // 1E. 8 Half-Buried Crossed 3D Bones (5 Femurs/Tibias w/ condyle knobs + 3 Curved Ribs)
  const addBone3D = (len, rad, ox, oy, oz, rx, ry, rz, charredEnd = true) => {
    const boneLocal = [];
    const shaft = new THREE.CylinderGeometry(rad * 0.82, rad, len, 6, 3);
    const sp = shaft.attributes.position;
    for (let v = 0; v < sp.count; v++) {
      const y = sp.getY(v);
      const t = y / len;
      const waist = 0.82 + 0.28 * Math.pow(Math.abs(t * 2), 1.6);
      sp.setX(v, sp.getX(v) * waist + Math.sin((t + 0.5) * Math.PI) * 0.018);
      sp.setZ(v, sp.getZ(v) * waist);
    }
    shaft.computeVertexNormals();
    boneLocal.push(tagGeo(shaft, {
      colorHex: charredEnd ? 0x3b2b22 : 0xd2c4a9,
      bottomColorHex: 0xd5c8ad,
      jitter: 0.04,
      rng
    }));
    const kR = rad * 1.48;
    for (const endSign of [-1, 1]) {
      const endHex = endSign > 0 && charredEnd ? 0x2e221b : 0xd8cab2;
      boneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(kR, 5, 4), -rad * 0.72, endSign * len * 0.49, 0), { colorHex: endHex }));
      boneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(kR * 0.92, 5, 4), rad * 0.72, endSign * len * 0.49, rad * 0.25), { colorHex: endHex }));
    }
    const mergedBone = mergeTaggedParts(boneLocal);
    makeXform(mergedBone, ox, oy, oz, rx, ry, rz);
    parts.push(mergedBone);
  };

  addBone3D(0.70, 0.026, -0.46, 0.25,  0.38,  0.98,  0.68,  0.42, true);
  addBone3D(0.64, 0.024, -0.20, 0.22,  0.58,  1.05, -0.34, -0.26, true);
  addBone3D(0.68, 0.025,  0.56, 0.24, -0.14,  1.02, -1.35,  0.32, true);
  addBone3D(0.60, 0.023, -0.34, 0.26, -0.46, -0.94,  2.42,  0.22, true);
  addBone3D(0.56, 0.022,  0.16, 0.24, -0.54, -1.08, -2.75, -0.30, true);

  for (let r = 0; r < 3; r++) {
    const rib = new THREE.TorusGeometry(0.24 + r * 0.035, 0.017, 5, 10, Math.PI * 0.78);
    makeXform(
      rib,
      r === 0 ? -0.36 : r === 1 ? 0.46 : -0.05,
      0.24 + r * 0.025,
      r === 0 ? -0.14 : r === 1 ? 0.18 : 0.66,
      0.55 + r * 0.22,
      r === 0 ? 0.85 : r === 1 ? -1.25 : 0.15,
      r === 0 ? 0.42 : -0.58
    );
    parts.push(tagGeo(rib, { colorHex: 0xd4c7ad, bottomColorHex: 0x423125 }));
  }

  return mergeTaggedParts(parts, 1.4);
}

// Sculpted Beveled Helical Coiled Sword (diamond-beveled flamberge blade + dual forged spiral ribs + gothic crossguard & crown pommel)
function buildCoiledSwordGeometry() {
  const parts = [];

  // A. Beveled Diamond-Section Helical Flamberge Blade (26 vertical segments for crisp faceted reflections)
  const segs = 26;
  const yStart = 0.14;
  const bladeH = 1.72;
  // 4-sided cylinder rotated 45° creates a sharp diamond-beveled sword blade cross-section!
  const bladeGeo = new THREE.CylinderGeometry(0.068, 0.082, bladeH, 4, segs, false);
  bladeGeo.rotateY(Math.PI / 4);
  const pos = bladeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i);
    const localY = pos.getY(i) + bladeH * 0.5;
    const bz = pos.getZ(i) * 0.46; // Flatten diamond into keen double-edged broadsword profile
    const t = Math.max(0, Math.min(1, localY / bladeH));
    const taper = 0.56 + 0.44 * Math.sin(t * Math.PI * 0.84);
    const twist = t * Math.PI * 2.45;
    const waveX = Math.sin(t * Math.PI * 3.4) * 0.044;
    const c = Math.cos(twist);
    const s = Math.sin(twist);
    const rx = (bx * taper) * c - (bz * taper) * s + waveX;
    const rz = (bx * taper) * s + (bz * taper) * c;
    pos.setXYZ(i, rx, yStart + localY, rz);
  }
  bladeGeo.computeVertexNormals();
  parts.push(tagGeo(bladeGeo, { colorHex: 0x5c6378, bottomColorHex: 0x7c3e26 }));

  // B. Dual Spiralling Forged Iron Coil-Strands wrapping up the blade (signature Dark Souls silhouette!)
  const upVec = new THREE.Vector3(0, 1, 0);
  const segDir = new THREE.Vector3();
  const segQuat = new THREE.Quaternion();
  for (let strand = 0; strand < 2; strand++) {
    const coilSegs = 16;
    const offsetAng = strand * Math.PI;
    for (let k = 0; k < coilSegs; k++) {
      const t0 = k / coilSegs;
      const t1 = (k + 1) / coilSegs;
      const tm = (t0 + t1) * 0.5;
      const y0 = 0.30 + t0 * 1.44;
      const y1 = 0.30 + t1 * 1.44;
      const a0 = t0 * Math.PI * 3.8 + offsetAng;
      const a1 = t1 * Math.PI * 3.8 + offsetAng;
      const rad = 0.072 + Math.sin(tm * Math.PI) * 0.028;
      const p0x = Math.cos(a0) * rad + Math.sin(t0 * Math.PI * 3.4) * 0.038;
      const p0z = Math.sin(a0) * rad;
      const p1x = Math.cos(a1) * rad + Math.sin(t1 * Math.PI * 3.4) * 0.038;
      const p1z = Math.sin(a1) * rad;
      const dx = p1x - p0x;
      const dy = y1 - y0;
      const dz = p1z - p0z;
      const segLen = Math.hypot(dx, dy, dz) + 0.016;
      const seg = new THREE.CylinderGeometry(0.014, 0.016, segLen, 5);
      segDir.set(dx, dy, dz).normalize();
      segQuat.setFromUnitVectors(upVec, segDir);
      seg.applyQuaternion(segQuat);
      seg.translate((p0x + p1x) * 0.5, (y0 + y1) * 0.5, (p0z + p1z) * 0.5);
      parts.push(tagGeo(seg, {
        colorHex: tm < 0.38 ? 0x6f3e2a : 0x4f566b
      }));
    }
  }

  // C. Carved Gothic Crossguard (beveled ricasso collar + twin side parry rings + swept S-curved quillons w/ fleur tips)
  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.11, 0.13, 0.13, 6), 0, 1.86, 0, 0, Math.PI / 6, 0), {
    colorHex: 0x555d72, bottomColorHex: 0x353b4a
  }));
  for (const side of [-1, 1]) {
    // Inner angled arm
    parts.push(tagGeo(makeXform(new THREE.BoxGeometry(0.24, 0.068, 0.074), side * 0.18, 1.83, 0, 0, 0, side * 0.28), {
      colorHex: 0x4b5266
    }));
    // Outer upturned gothic quillon hook + spear tip
    parts.push(tagGeo(makeXform(new THREE.BoxGeometry(0.20, 0.054, 0.062), side * 0.34, 1.79, 0, 0, 0, -side * 0.42), {
      colorHex: 0x596178
    }));
    parts.push(tagGeo(makeXform(new THREE.ConeGeometry(0.044, 0.14, 4), side * 0.45, 1.84, 0, 0, 0, -side * 1.15), {
      colorHex: 0x677088
    }));
    // Decorative side parry-rings front & back
    parts.push(tagGeo(makeXform(new THREE.TorusGeometry(0.082, 0.017, 5, 10), 0, 1.85, side * 0.068, side * 0.18, 0, 0), {
      colorHex: 0x586075
    }));
  }

  // D. Fluted Cord-Wrapped Grip w/ 6 Raised Forged Collar Ribs + Faceted Gothic Crown Pommel
  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.038, 0.046, 0.40, 8), 0, 2.11, 0), {
    colorHex: 0x2f2827, bottomColorHex: 0x201b1b
  }));
  for (let gr = 0; gr < 6; gr++) {
    parts.push(tagGeo(makeXform(new THREE.TorusGeometry(0.045 - gr * 0.0014, 0.010, 4, 8), 0, 1.95 + gr * 0.064, 0, Math.PI / 2, 0, 0), {
      colorHex: 0x5b6378
    }));
  }
  // Flared pommel neck + faceted diamond pommel + crown ring & spire
  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.072, 0.042, 0.08, 8), 0, 2.33, 0), { colorHex: 0x525a6e }));
  parts.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.102, 0), 0, 2.43, 0, 0, Math.PI / 4, 0, 0.94, 1.18, 0.94), {
    colorHex: 0x626b82, bottomColorHex: 0x3b4150
  }));
  parts.push(tagGeo(makeXform(new THREE.TorusGeometry(0.056, 0.014, 4, 8), 0, 2.54, 0), { colorHex: 0x6b748e }));
  parts.push(tagGeo(makeXform(new THREE.ConeGeometry(0.032, 0.11, 4), 0, 2.62, 0, 0, Math.PI / 4, 0), { colorHex: 0x727c98 }));

  const merged = mergeTaggedParts(parts, 0.65);
  makeXform(merged, 0, 0, 0, 0.04, 0.30, 0.12);
  return merged;
}

export function createHeroBonfire3D({
  x = 0,
  z = 25.0,
  ironMat = null,
  ashMat = null,
  flameMat = null,
  pbr = null,
  trackGeo = (g) => g,
  trackMat = (m) => m,
  trackTex = null,
  isMobile = false,
  lowSpec = false
} = {}) {
  void flameMat;
  void trackTex;
  SEG_MOBILE = Boolean(isMobile);

  const group = new THREE.Group();
  group.name = 'hero_bonfire_3d';
  group.position.set(x, 0, z);

  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const ashNormal = pbr?.ashlarNormal || ashMat?.normalMap || null;
  const ashRough = pbr?.ashlarRoughness || ashMat?.roughnessMap || null;
  const ironNormal = pbr?.ironNormal || ironMat?.normalMap || null;
  const ironRough = pbr?.ironRoughness || ironMat?.roughnessMap || null;

  // DC #1: Sculpted 12-stone charred hearth + ash heap + 5 charred logs + 3D skull/mandible + 8 bones/ribs
  const hearthMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ashNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughnessMap: ashRough,
    roughness: 0.94,
    metalness: 0.05
  }));
  const hearthGeo = regGeo(buildBonfireHearthGeometry());
  const hearthMesh = new THREE.Mesh(hearthGeo, hearthMat);
  hearthMesh.name = 'bonfire_hearth_stones_bones';
  hearthMesh.castShadow = true;
  hearthMesh.receiveShadow = true;
  group.add(hearthMesh);

  // DC #2: Sculpted Beveled Helical Coiled Sword (real hammered iron PBR + subtle base heat glow!)
  const swordMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ironNormal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: ironRough,
    roughness: 0.56,
    metalness: 0.88,
    emissive: 0x6e1a04,
    emissiveIntensity: 0.26
  }));
  const swordGeo = regGeo(buildCoiledSwordGeometry());
  const swordMesh = new THREE.Mesh(swordGeo, swordMat);
  swordMesh.name = 'bonfire_coiled_sword';
  swordMesh.castShadow = true;
  swordMesh.receiveShadow = true;
  group.add(swordMesh);

  // DC #3..#7: Real Multi-Layer Volumetric FBM Fire + Molten-Fissure Coal Bed + Rising Sparks + Curling Smoke!
  const flameAssembly = createBonfireFlameAssembly({
    position: { x: 0, y: 0.30, z: 0 },
    scale: 1.04,
    isMobile,
    lowSpec,
    includeCoals: true,
    includeSparks: true,
    includeSmoke: true,
    trackGeo,
    trackMat
  });
  group.add(flameAssembly.group);

  const collider = { x, z, r: 1.05, radius: 1.05 };
  let isLowSpec = Boolean(lowSpec);

  function setLowSpec(enabled = false) {
    isLowSpec = Boolean(enabled);
    hearthMat.normalMap = isLowSpec ? null : ashNormal;
    swordMat.normalMap = isLowSpec ? null : ironNormal;
    hearthMat.needsUpdate = true;
    swordMat.needsUpdate = true;
    flameAssembly.setLowSpec(isLowSpec);
  }

  function update(dt = 0.016, elapsed = 0) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    // Note: soulsFireVfx expects (time, dt)
    flameAssembly.update(t, safeDt);
    // Subtle organic heat shimmer on the forged steel blade (never clipped!)
    swordMat.emissiveIntensity = 0.22 + Math.sin(t * 5.6) * 0.07 + Math.sin(t * 13.1) * 0.03;
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    flameAssembly.dispose();
    for (const g of localGeos) g.dispose?.();
    for (const m of localMats) m.dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    flameAssembly,
    collider,
    colliders: [collider],
    fireSite: { x, y: 0.36, z, scale: 1.08, haloY: 1.25, haloScale: 2.2, phase: 0.0 },
    get drawCalls() { return 2 + flameAssembly.getDrawCalls(); },
    update,
    setLowSpec,
    dispose
  };
}

// ============================================================================
// 2. GOTHIC 8-BAR LANTERN BRAZIERS & WALL BRACKET LANTERNS 3D
//    - Carved multi-tier gothic stone pedestals (real ashlarAlbedo/Normal/Roughness!)
//    - Multi-tier 8-bar forged iron cages w/ side scrolls, riveted hoops & spires
//    - 21 ornate scrolled wall bracket lanterns w/ 3-link hanging chains & leaded-glass
//      window mullions (real ironNormal/ironRoughness!)
//    - Charred molten-fissure coal beds inside every floor brazier (NO orange ball!)
//    - Real instanced FBM flames (createInstancedBrazierFlames + createInstancedWallLanternFlames)
//    - Subtle warm wall firelight bounce + soot plume behind wall sconces (NO blobby halo!)
//    - HARD cylindrical collider { x, z, r: 0.56 * scale, radius: 0.56 * scale } on EVERY floor brazier!
// ============================================================================
function appendFloorPedestalStoneParts(parts, spec, rng) {
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = Number.isFinite(spec.rotY) ? spec.rotY : rng() * Math.PI * 2;

  const local = [];

  // Stepped chamfered gothic stone plinth base (y = 0.00..0.16)
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.49, 0.55, 0.14, 8), 0, 0.07, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x62687b, bottomColorHex: 0x262933
  }));
  // Molded transition torus collar (y = 0.14..0.20)
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.42, 0.48, 0.07, 8), 0, 0.175, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x6e758a, bottomColorHex: 0x3b404e
  }));
  // Recessed fluted octagonal stone shaft (y = 0.21..0.54)
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.34, 0.37, 0.34, 8), 0, 0.38, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x555c6e, bottomColorHex: 0x333845
  }));
  // 4 carved corner gothic buttress pilasters with sloped caps
  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.13, 0.36, 0.14), 0.35, 0.36, a, 0.06), {
      colorHex: 0x70788d, bottomColorHex: 0x353946
    }));
  }
  // Corbeled overhanging gothic cornice cap & bevel rim (y = 0.54..0.68)
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.47, 0.38, 0.08, 8), 0, 0.58, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x687085, bottomColorHex: 0x3e4352
  }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.48, 0.50, 0.06, 8), 0, 0.65, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x767f96, bottomColorHex: 0x4b5163
  }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0, s, s, s);
  parts.push(merged);
}

function appendFloorBrazierIronParts(parts, spec, rng) {
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = Number.isFinite(spec.rotY) ? spec.rotY : rng() * Math.PI * 2;

  const local = [];

  // A. 4 Heavy Curved Forged Iron Scroll-Feet gripping the stone cornice (y = 0.65..0.78)
  for (let f = 0; f < 4; f++) {
    const a = (f / 4) * Math.PI * 2 + Math.PI / 4;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.082, 0.21, 0.12), 0.33, 0.74, a, 0.30), {
      colorHex: 0x313746, bottomColorHex: 0x1e222b
    }));
    // Decorative curled toe volute at foot base
    if (!SEG_MOBILE) local.push(tagGeo(makeXform(
      new THREE.TorusGeometry(0.048, 0.018, 4, 6),
      Math.cos(a) * 0.41, 0.70, Math.sin(a) * 0.41,
      0, -a + Math.PI / 2, 0
    ), { colorHex: 0x434a5c }));
  }

  // B. Deep Sculpted Iron Cauldron Fire-Basin + Lower Ash Drop-Pan (y = 0.72..1.14)
  const bowlPts = [
    new THREE.Vector2(0.01, 0.71),
    new THREE.Vector2(0.18, 0.73),
    new THREE.Vector2(0.28, 0.79),
    new THREE.Vector2(0.39, 0.94),
    new THREE.Vector2(0.49, 1.08),
    new THREE.Vector2(0.53, 1.14),
    new THREE.Vector2(0.45, 1.14),
    new THREE.Vector2(0.38, 0.98),
    new THREE.Vector2(0.01, 0.94)
  ];
  const bowl = new THREE.LatheGeometry(bowlPts, 8);
  bowl.computeVertexNormals();
  local.push(tagGeo(bowl, { colorHex: 0x353c4c, bottomColorHex: 0x1c2029 }));

  // C. 8 Gracefully Bowed Vertical Wrought-Iron Cage Bars + 8 Base Scroll Volutes (y = 1.10..1.94)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // Lower bowed forged rib (r 0.46 -> 0.50, leaning radially outward)
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.038, 0.44, 0.038), 0.48, 1.32, a, -0.10), {
      colorHex: 0x3d4456, bottomColorHex: 0x262b36
    }));
    // Upper inward-curving forged rib (r 0.50 -> 0.36, leaning radially inward)
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.035, 0.46, 0.035), 0.43, 1.74, a, 0.31), {
      colorHex: 0x444c5f, bottomColorHex: 0x2e3442
    }));
    // Forged C-scroll volute welded outside each lower rib base
    if (!SEG_MOBILE) local.push(tagGeo(makeXform(
      new THREE.TorusGeometry(0.064, 0.014, 4, 7),
      ca * 0.54, 1.24, sa * 0.54,
      0, -a + Math.PI / 2, 0
    ), { colorHex: 0x4a5266 }));
    // Outward forged rivet/spike studs along upper belly hoop
    if (!SEG_MOBILE) local.push(tagGeo(makeRadialBar(new THREE.ConeGeometry(0.024, 0.095, 4), 0.53, 1.54, a, -Math.PI * 0.5), {
      colorHex: 0x565f75
    }));
  }

  // D. 4 Riveted Horizontal Forged Iron Hoops (cauldron rim, lower waist, upper belly, crown collar)
  const hoops = [
    { y: 1.13, r: 0.49, tube: 0.030 },
    { y: 1.35, r: 0.49, tube: 0.020 },
    { y: 1.54, r: 0.50, tube: 0.026 },
    { y: 1.94, r: 0.37, tube: 0.030 }
  ];
  for (const hp of hoops) {
    if (SEG_MOBILE && hp.y === 1.35) continue;
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(hp.r, hp.tube, 5, 8), 0, hp.y, 0, Math.PI / 2, 0, 0), {
      colorHex: 0x485064
    }));
  }

  // E. Multi-Tier Open Gothic Ogee Crown Canopy (8 arched ribs) + Cupola Collar & Spire Finial (y = 1.94..2.46)
  for (let c = 0; c < 8; c += (SEG_MOBILE ? 2 : 1)) {
    const a = (c / 8) * Math.PI * 2;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.030, 0.46, 0.030), 0.195, 2.09, a, 0.84), {
      colorHex: 0x4c5468
    }));
  }
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.09, 0.022, 4, 8), 0, 2.22, 0, Math.PI / 2, 0, 0), { colorHex: 0x555e74 }));
  local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.072, 0), 0, 2.29, 0), { colorHex: 0x5b647a }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.040, 0.22, 4), 0, 2.43, 0, 0, Math.PI / 4, 0), { colorHex: 0x646e86 }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0, s, s, s);
  parts.push(merged);
}

function appendWallLanternIronParts(parts, spec) {
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 2.95;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];

  // A. Sculpted Gothic Shield Wall Backplate w/ 4 Dome Rivets + Fleur Finials (flush at z = 0)
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.28, 0.72, 0.055), 0, -0.06, 0.028), {
    colorHex: 0x394050, bottomColorHex: 0x222630
  }));
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.34, 0.22, 0.045), 0, 0.06, 0.024), { colorHex: 0x434b5e }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.12, 0.19, 4), 0, 0.39, 0.03, 0, Math.PI / 4, 0), { colorHex: 0x4f576c }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.11, 0.17, 4), 0, -0.50, 0.03, Math.PI, Math.PI / 4, 0), { colorHex: 0x454d60 }));
  for (const [rx, ry] of (SEG_MOBILE ? [] : [[-0.09, 0.22], [0.09, 0.22], [-0.09, -0.34], [0.09, -0.34]])) {
    local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.026, 0), rx, ry, 0.062), { colorHex: 0x5d667d }));
  }

  // B. Ornate Scrolled Wrought-Iron Bracket Arm + Upper & Lower S-Scroll Volutes (projects +Z to z = 0.64)
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.052, 0.054, 0.72), 0, 0.20, 0.36), { colorHex: 0x444c5e }));
  // Diagonal brace strut below arm
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.038, 0.038, 0.60), 0, -0.04, 0.25, -0.76, 0, 0), { colorHex: 0x353c4c }));
  // Double forged spiral S-scrolls (below arm & decorative crest scroll above arm!)
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.105, 0.017, 4, 8), 0, 0.06, 0.45, 0, Math.PI / 2, 0), { colorHex: 0x4e566b }));
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.072, 0.015, 4, 7), 0, -0.14, 0.19, 0, Math.PI / 2, 0), { colorHex: 0x485064 }));
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.068, 0.014, 4, 7), 0, 0.29, 0.22, 0, Math.PI / 2, 0), { colorHex: 0x525b70 }));
  // Tip finial at end of bracket arm
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.036, 0.11, 4), 0, 0.20, 0.75, Math.PI / 2, Math.PI / 4, 0), { colorHex: 0x5c657c }));

  // C. 3-Link Forged Hanging Iron Chain suspending lantern at z = 0.60 (y = +0.16..-0.02)
  const cz = 0.60;
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.036, 0.012, 4, 6), 0, 0.14, cz, 0, Math.PI / 2, 0), { colorHex: 0x545d73 }));
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.034, 0.011, 4, 6), 0, 0.07, cz, 0, 0, 0), { colorHex: 0x4c5468 }));
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.036, 0.012, 4, 6), 0, 0.00, cz, 0, Math.PI / 2, 0), { colorHex: 0x545d73 }));

  // D. Detailed 2-Tier Hexagonal Gothic Lantern Housing w/ Leaded-Glass Mullion Grid (y = -0.02..-0.76)
  // Upper vent cupola + sloped roof hood
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.065, 0.085, 0.07, 6), 0, -0.05, cz), { colorHex: 0x4d556a }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.26, 0.19, 6), 0, -0.14, cz), {
    colorHex: 0x464e62, bottomColorHex: 0x282d38
  }));
  // Top, mid-mullion, and bottom hexagonal iron rims
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.23, 0.020, 4, 6), 0, -0.22, cz, Math.PI / 2, 0, 0), { colorHex: 0x50586d }));
  if (!SEG_MOBILE) local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.195, 0.011, 4, 6), 0, -0.40, cz, Math.PI / 2, 0, 0), { colorHex: 0x42495c })); // Horizontal glass muntin!
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.165, 0.020, 4, 6), 0, -0.58, cz, Math.PI / 2, 0, 0), { colorHex: 0x444c5f }));

  // 6 tapered corner iron ribs + 6 fine diagonal leaded-glass crossbars
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.024, 0.38, 0.024), 0.195, -0.40, a, -0.16, cz), {
      colorHex: 0x3d4456
    }));
    // Subtle corner roof finial spikes on eaves
    if (!SEG_MOBILE) local.push(tagGeo(makeRadialBar(new THREE.ConeGeometry(0.018, 0.065, 4), 0.24, -0.20, a, -0.32, cz), {
      colorHex: 0x5a637a
    }));
  }

  // Lower flared fire-basin + sculpted drop finial
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.175, 0.11, 0.10, 6), 0, -0.63, cz), {
    colorHex: 0x323846, bottomColorHex: 0x1c2029
  }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.044, 0.14, 4), 0, -0.74, cz, Math.PI, Math.PI / 4, 0), {
    colorHex: 0x4f586e
  }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0, s, s, s);
  parts.push(merged);
}

// Sculpted craggy charred coal mound geometry for floor braziers (replaces smooth orange sphere!)
function createCharredBrazierCoalGeo() {
  const geo = new THREE.SphereGeometry(0.36, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const bump = 0.92 + 0.14 * Math.sin(ang * 5.0 + y * 12.0) + 0.08 * Math.cos(ang * 8.0 - x * 11.0);
    pos.setXYZ(i, x * bump, y * 0.56 * bump, z * bump);
  }
  geo.computeVertexNormals();
  return geo;
}

// Charred coal bed shader w/ dark matte charcoal crust + glowing fiery fissures (zero plastic orange blob!)
function createInstancedCharredCoalMat() {
  const uniforms = { uTime: { value: 0.0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: false,
    depthWrite: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying vec3 vLocal;
      varying float vPhase;
      void main() {
        vLocal = position;
        vPhase = aPhase;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vLocal;
      varying float vPhase;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float n3(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
              mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
              mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      void main() {
        vec3 p = vLocal * 9.5 + vec3(vPhase * 0.7, 0.0, vPhase * 0.4);
        float v1 = n3(p);
        float v2 = n3(p * 2.1 + vec3(3.1, 1.7, 2.3));
        // Sharp ridged glowing fissures between dark charred coal chunks
        float ridge = 1.0 - abs((v1 * 0.65 + v2 * 0.35) * 2.0 - 1.0);
        float radial = smoothstep(0.38, 0.04, length(vLocal.xz));
        float pulse = 0.78 + 0.22 * sin(uTime * 4.4 + vPhase + v1 * 4.0);
        float glow = pow(clamp(ridge, 0.0, 1.0), 2.5) * (0.42 + 0.68 * radial) * pulse;

        vec3 charred = vec3(0.055, 0.035, 0.032);
        vec3 emberRed = vec3(0.76, 0.11, 0.01);
        vec3 magmaOrg = vec3(1.00, 0.50, 0.05);
        vec3 hotGold  = vec3(1.00, 0.88, 0.40);

        vec3 col = mix(charred, emberRed, smoothstep(0.18, 0.46, glow));
        col = mix(col, magmaOrg, smoothstep(0.45, 0.76, glow));
        col = mix(col, hotGold,  smoothstep(0.76, 1.00, glow));
        gl_FragColor = vec4(min(col, vec3(1.06)), 1.0);
      }
    `
  });
  return { mat, uniforms };
}

// Subtle warm wall firelight bounce + dark vertical soot plume behind every wall lantern (1 DC for all 21 sconces!)
function createWallBounceDecalMat() {
  const uniforms = {
    uTime: { value: 0.0 },
    uOpacity: { value: 0.22 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying vec2 vUv;
      varying float vPhase;
      void main() {
        vUv = uv;
        vPhase = aPhase;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vPhase;
      void main() {
        vec2 c = vUv - vec2(0.5, 0.42);
        float r = length(c * vec2(1.15, 0.95));
        float flick = 0.86 + 0.10 * sin(uTime * 6.4 + vPhase) + 0.04 * sin(uTime * 15.2 + vPhase * 1.7);

        // Soft warm amber light pool cast on the stone masonry behind the lantern
        float warmGlow = exp(-r * r * 11.5) * smoothstep(0.52, 0.04, r) * flick;
        // Delicate rising dark soot smudge on the wall just above the lantern chimney
        vec2 sootC = vec2((vUv.x - 0.5) * 3.4, (vUv.y - 0.68) * 1.9);
        float sootR = length(sootC);
        float soot = exp(-sootR * sootR * 3.8) * smoothstep(0.95, 0.12, sootR) * smoothstep(0.42, 0.62, vUv.y) * 0.34;

        vec3 warmCol = mix(vec3(0.92, 0.34, 0.06), vec3(1.00, 0.68, 0.24), warmGlow);
        vec3 sootCol = vec3(0.03, 0.025, 0.03);

        float aWarm = warmGlow * uOpacity;
        float aTotal = clamp(aWarm + soot, 0.0, 0.42);
        if (aTotal < 0.008) discard;
        vec3 col = mix(warmCol, sootCol, soot / max(0.001, aWarm + soot));
        gl_FragColor = vec4(col, aTotal);
      }
    `
  });
  return { mat, uniforms };
}

export function createGothicLanternBraziers3D({
  specs = [],
  wallLanternSpecs = [],
  ironMat = null,
  coalEmberMat = null,
  flameMat = null,
  haloMat = null,
  darkStoneMat = null,
  trimStoneMat = null,
  pbr = null,
  trackGeo = (g) => g,
  trackMat = (m) => m,
  trackTex = null,
  isMobile = false,
  lowSpec = false
} = {}) {
  void coalEmberMat;
  void flameMat;
  void haloMat;
  void trackTex;
  SEG_MOBILE = Boolean(isMobile);

  const group = new THREE.Group();
  group.name = 'gothic_lantern_braziers_3d';

  const floorList = Array.isArray(specs) ? specs : [];
  const wallList = Array.isArray(wallLanternSpecs) ? wallLanternSpecs : [];

  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const colliders = [];
  const fireSites = [];
  const virtualLights = [];
  const rng = makeRng(260731);

  if (floorList.length === 0 && wallList.length === 0) {
    return {
      group,
      colliders,
      fireSites,
      virtualLights,
      drawCalls: 0,
      update() {},
      setLowSpec() {},
      dispose() {}
    };
  }

  const stoneAlbedo = pbr?.ashlarAlbedo || darkStoneMat?.map || trimStoneMat?.map || null;
  const stoneNormal = pbr?.ashlarNormal || darkStoneMat?.normalMap || trimStoneMat?.normalMap || null;
  const stoneRough  = pbr?.ashlarRoughness || darkStoneMat?.roughnessMap || trimStoneMat?.roughnessMap || null;
  const ironNormal  = pbr?.ironNormal || ironMat?.normalMap || null;
  const ironRough   = pbr?.ironRoughness || ironMat?.roughnessMap || null;

  const pedestalStoneParts = [];
  const forgedIronParts = [];
  const floorFlamePositions = [];
  const wallFlamePositions = [];
  const wallBounceSpecs = [];

  for (let i = 0; i < floorList.length; i++) {
    const b = floorList[i];
    const s = Number.isFinite(b.scale) ? b.scale : 1.0;
    const by = b.y || 0;
    const rotY = Number.isFinite(b.rotY) ? b.rotY : rng() * Math.PI * 2;
    const specWithRot = { ...b, rotY };

    appendFloorPedestalStoneParts(pedestalStoneParts, specWithRot, rng);
    appendFloorBrazierIronParts(forgedIronParts, specWithRot, rng);

    // CRITICAL USER REQUIREMENT: Hard cylindrical collider on EVERY floor lantern-brazier!
    const colR = Number((0.56 * s).toFixed(4));
    colliders.push({ x: b.x, z: b.z, r: colR, radius: colR });

    const phase = Number.isFinite(b.phase) ? b.phase : i * 1.37 + 0.25;
    const flameScale = Number.isFinite(b.flameScale) ? b.flameScale : 0.90 * s;

    floorFlamePositions.push({
      x: b.x,
      y: by + 1.12 * s,
      z: b.z,
      scale: flameScale,
      rotY: i * 1.13,
      phase,
      coalY: by + 1.06 * s,
      coalScale: s
    });

    fireSites.push({
      kind: 'floor',
      x: b.x,
      coalY: by + 1.06 * s,
      coalScale: s,
      y: by + 1.12 * s,
      z: b.z,
      scale: flameScale,
      haloY: by + 1.50 * s,
      haloScale: 1.45 * s,
      phase
    });

    virtualLights.push({
      x: b.x,
      y: by + 1.92 * s,
      z: b.z,
      color: 0xff7b1c,
      baseInt: Number.isFinite(b.lightInt) ? b.lightInt : 4.2,
      dist: Number.isFinite(b.lightDist) ? b.lightDist : 16.0,
      phase,
      weight: s > 1.2 ? 1.55 : 1.05
    });
  }

  for (let j = 0; j < wallList.length; j++) {
    const w = wallList[j];
    const s = Number.isFinite(w.scale) ? w.scale : 1.0;
    const wy = Number.isFinite(w.y) ? w.y : 2.95;
    const rotY = resolveYaw(w);
    appendWallLanternIronParts(forgedIronParts, w);

    // Hanging lantern glass cage center sits at local (0, -0.40, +0.60) rotated by rotY
    const arm = 0.60 * s;
    const sinY = Math.sin(rotY);
    const cosY = Math.cos(rotY);
    const lx = (w.x || 0) + sinY * arm;
    const lz = (w.z || 0) + cosY * arm;
    const phase = Number.isFinite(w.phase) ? w.phase : (floorList.length + j) * 1.51 + 0.6;
    const flameScale = Number.isFinite(w.flameScale) ? w.flameScale : 0.96 * s;

    wallFlamePositions.push({
      x: lx,
      y: wy - 0.56 * s,
      z: lz,
      scale: flameScale,
      rotY: rotY + j * 0.7,
      phase
    });

    wallBounceSpecs.push({
      x: (w.x || 0) + sinY * 0.045,
      y: wy - 0.14 * s,
      z: (w.z || 0) + cosY * 0.045,
      rotY,
      scale: s,
      phase
    });

    fireSites.push({
      kind: 'wall',
      x: lx,
      coalY: wy - 0.57 * s,
      coalScale: 0.34 * s,
      y: wy - 0.56 * s,
      z: lz,
      scale: flameScale,
      haloY: wy - 0.36 * s,
      haloScale: 1.05 * s,
      phase
    });

    virtualLights.push({
      x: lx,
      y: wy - 0.28 * s,
      z: lz,
      color: Number.isFinite(w.color) ? w.color : 0xff8528,
      baseInt: Number.isFinite(w.lightInt) ? w.lightInt : (Number.isFinite(w.intensity) ? w.intensity : 2.5),
      dist: Number.isFinite(w.lightDist) ? w.lightDist : (Number.isFinite(w.distance) ? w.distance : 13.0),
      phase,
      weight: 0.85
    });
  }

  let staticDC = 0;

  // DC #1: Carved Gothic Stone Pedestals (real dark ashlar PBR, zero light-grey plastic cylinders!)
  let pedestalStoneMat = null;
  if (pedestalStoneParts.length > 0) {
    pedestalStoneMat = regMat(new THREE.MeshStandardMaterial({
      map: stoneAlbedo,
      normalMap: lowSpec ? null : stoneNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: stoneRough,
      color: stoneAlbedo ? 0x9aa0b4 : 0x767c90,
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.09
    }));
    const pedGeo = regGeo(mergeTaggedParts(pedestalStoneParts, 1.85));
    const pedMesh = new THREE.Mesh(pedGeo, pedestalStoneMat);
    pedMesh.name = 'brazier_stone_pedestals';
    pedMesh.castShadow = true;
    pedMesh.receiveShadow = true;
    group.add(pedMesh);
    staticDC++;
  }

  // DC #2: Multi-Tier Forged Iron Cages (12 floor braziers) + 21 Ornate Scrolled Wall Bracket Lanterns
  let forgedIronMat = null;
  if (forgedIronParts.length > 0) {
    forgedIronMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      normalMap: lowSpec ? null : ironNormal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: ironRough,
      roughness: 0.56,
      metalness: 0.86
    }));
    const ironGeo = regGeo(mergeTaggedParts(forgedIronParts, 0.85));
    const ironMesh = new THREE.Mesh(ironGeo, forgedIronMat);
    ironMesh.name = 'braziers_and_wall_lanterns_iron';
    ironMesh.castShadow = true;
    ironMesh.receiveShadow = true;
    group.add(ironMesh);
    staticDC++;
  }

  // DC #3: Dark Charred Molten-Fissure Coal Beds inside all floor braziers (replaces smooth orange orb!)
  let coalUniforms = null;
  if (floorFlamePositions.length > 0) {
    const coalGeo = regGeo(createCharredBrazierCoalGeo());
    const coalPhases = new Float32Array(floorFlamePositions.length);
    for (let i = 0; i < floorFlamePositions.length; i++) coalPhases[i] = floorFlamePositions[i].phase;
    coalGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(coalPhases, 1));

    const coalPack = createInstancedCharredCoalMat();
    coalUniforms = coalPack.uniforms;
    const coalMat = regMat(coalPack.mat);
    const coalInst = new THREE.InstancedMesh(coalGeo, coalMat, floorFlamePositions.length);
    coalInst.name = 'brazier_charred_coals';
    for (let i = 0; i < floorFlamePositions.length; i++) {
      const f = floorFlamePositions[i];
      _dummy.position.set(f.x, f.coalY, f.z);
      _dummy.rotation.set(0, i * 0.9, 0);
      _dummy.scale.set(f.coalScale, f.coalScale, f.coalScale);
      _dummy.updateMatrix();
      coalInst.setMatrixAt(i, _dummy.matrix);
    }
    coalInst.instanceMatrix.needsUpdate = true;
    group.add(coalInst);
    staticDC++;
  }

  // DC #4..#5: Real Instanced Volumetric FBM Floor Brazier Flames (soulsFireVfx.js, 2 DC PC / 1 DC LowSpec!)
  const brazierFlames = floorFlamePositions.length > 0
    ? createInstancedBrazierFlames(floorFlamePositions, {
        width: 0.70,
        height: 1.00,
        isMobile,
        lowSpec,
        includeCore: true,
        trackGeo,
        trackMat
      })
    : null;
  if (brazierFlames) group.add(brazierFlames.group);

  // DC #6: Real Single-Pass Instanced Wall Lantern Flames (soulsFireVfx.js, 1 DC for ALL 21 sconces!)
  const wallLanternFlames = wallFlamePositions.length > 0
    ? createInstancedWallLanternFlames(wallFlamePositions, {
        width: 0.27,
        height: 0.37,
        applyBracketOffset: false,
        isMobile,
        lowSpec,
        trackGeo,
        trackMat
      })
    : null;
  if (wallLanternFlames) group.add(wallLanternFlames.group);

  // DC #7: Subtle Warm Firelight Bounce + Rising Soot Plume on Stone Wall Behind Every Sconce (0 DC in LowSpec!)
  let wallBounceInst = null;
  let wallBounceUniforms = null;
  if (wallBounceSpecs.length > 0) {
    const bounceGeo = regGeo(new THREE.PlaneGeometry(2.15, 2.45));
    const bouncePhases = new Float32Array(wallBounceSpecs.length);
    for (let i = 0; i < wallBounceSpecs.length; i++) bouncePhases[i] = wallBounceSpecs[i].phase;
    bounceGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(bouncePhases, 1));

    const bouncePack = createWallBounceDecalMat();
    wallBounceUniforms = bouncePack.uniforms;
    const bounceMat = regMat(bouncePack.mat);

    wallBounceInst = new THREE.InstancedMesh(bounceGeo, bounceMat, wallBounceSpecs.length);
    wallBounceInst.name = 'wall_lantern_firelight_soot';
    wallBounceInst.renderOrder = 2;
    wallBounceInst.visible = !lowSpec;
    for (let i = 0; i < wallBounceSpecs.length; i++) {
      const wb = wallBounceSpecs[i];
      _dummy.position.set(wb.x, wb.y, wb.z);
      _dummy.rotation.set(0, wb.rotY, 0);
      _dummy.scale.set(wb.scale, wb.scale, 1);
      _dummy.updateMatrix();
      wallBounceInst.setMatrixAt(i, _dummy.matrix);
    }
    wallBounceInst.instanceMatrix.needsUpdate = true;
    group.add(wallBounceInst);
  }

  let isLowSpec = Boolean(lowSpec);

  function setLowSpec(enabled = false) {
    isLowSpec = Boolean(enabled);
    if (pedestalStoneMat) {
      pedestalStoneMat.normalMap = isLowSpec ? null : stoneNormal;
      pedestalStoneMat.needsUpdate = true;
    }
    if (forgedIronMat) {
      forgedIronMat.normalMap = isLowSpec ? null : ironNormal;
      forgedIronMat.needsUpdate = true;
    }
    if (brazierFlames) brazierFlames.setLowSpec(isLowSpec);
    if (wallLanternFlames) wallLanternFlames.setLowSpec(isLowSpec);
    if (wallBounceInst) wallBounceInst.visible = !isLowSpec;
  }

  function update(dt = 0.016, elapsed = 0) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    if (coalUniforms) coalUniforms.uTime.value = t;
    if (brazierFlames) brazierFlames.update(t, safeDt);
    if (wallLanternFlames) wallLanternFlames.update(t, safeDt);
    if (wallBounceUniforms && wallBounceInst && wallBounceInst.visible) {
      wallBounceUniforms.uTime.value = t;
    }
  }

  function getDrawCalls() {
    let dc = staticDC;
    if (brazierFlames) dc += brazierFlames.getDrawCalls();
    if (wallLanternFlames) dc += wallLanternFlames.getDrawCalls();
    if (wallBounceInst && wallBounceInst.visible) dc += 1;
    return dc;
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (brazierFlames) brazierFlames.dispose();
    if (wallLanternFlames) wallLanternFlames.dispose();
    for (const g of localGeos) g.dispose?.();
    for (const m of localMats) m.dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    colliders,
    fireSites,
    virtualLights,
    get drawCalls() { return getDrawCalls(); },
    update,
    setLowSpec,
    dispose
  };
}

// ============================================================================
// 3. MELTED CANDLE CLUSTERS 3D (EXACTLY 3 DC via InstancedMesh; 0 DC LowSpec!)
//    - DC 1: Forged iron saucers w/ lipped rim, finger-ring handle & pooled melted wax
//    - DC 2: Sculpted beeswax cylinders w/ 6 pronounced 3D drips, concave melted rim & charred wicks
//    - DC 3: Real sapphire-blue cup teardrop candle flames (soulsFireVfx.js)
//    - Interactive: tryBreakCandlesNear(x, z, radius = 0.72), resetCandles(), setLowSpec(enabled)
// ============================================================================
function createForgedSaucerGeometry() {
  const parts = [];

  // Dished wrought-iron candle saucer w/ raised rolled wax-catch rim & central candle spike collar
  const pts = [
    new THREE.Vector2(0.005, 0.000),
    new THREE.Vector2(1.52,  0.000),
    new THREE.Vector2(2.04,  0.175),
    new THREE.Vector2(2.18,  0.295),
    new THREE.Vector2(1.98,  0.310),
    new THREE.Vector2(1.52,  0.095),
    new THREE.Vector2(0.005, 0.070)
  ];
  const dish = new THREE.LatheGeometry(pts, 12);
  dish.computeVertexNormals();
  parts.push(tagGeo(dish, { colorHex: 0x3a4050, bottomColorHex: 0x1b1e26 }));

  // Forged thumb-ring loop handle on saucer side
  const handle = new THREE.TorusGeometry(0.48, 0.092, 5, 8);
  makeXform(handle, 2.40, 0.36, 0, 0, 0, 0.16);
  if (!SEG_MOBILE) parts.push(tagGeo(handle, { colorHex: 0x4b5367 })); else handle.dispose();

  // Frozen spilled melted wax puddle pooled inside the iron saucer dish!
  const waxPool = new THREE.CylinderGeometry(1.56, 1.44, 0.09, 10);
  const wp = waxPool.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i);
    const y = wp.getY(i);
    const z = wp.getZ(i);
    const a = Math.atan2(z, x);
    const wv = 0.86 + 0.18 * Math.sin(a * 3.0 + 0.7) + 0.08 * Math.cos(a * 5.0);
    wp.setXYZ(i, x * wv, y + 0.115, z * wv);
  }
  waxPool.computeVertexNormals();
  parts.push(tagGeo(waxPool, { colorHex: 0xdccbb0, bottomColorHex: 0xb7a180 }));

  return mergeTaggedParts(parts, 2.5);
}

// Unit-normalized melted candle wax (radius ~1.0, height 0..1) w/ 6 sculpted 3D vertical drips + charred wick
function createMeltedWaxAndWickGeometry() {
  const parts = [];

  // Organically slumped beeswax cylinder w/ asymmetric scooped melted crown
  const body = new THREE.CylinderGeometry(0.92, 1.08, 1.0, 10, 5, false);
  const bp = body.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i);
    let y = bp.getY(i) + 0.5; // 0..1
    let z = bp.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    if (y > 0.95) {
      if (r < 0.18) {
        y = 0.86; // Deep concave melted wax reservoir around wick
      } else {
        // Dramatic organic melted wax lip wave
        y = 0.94 + Math.sin(a * 2.0 + 0.4) * 0.068 + Math.cos(a * 3.0 - 0.6) * 0.036;
      }
    } else if (y > 0.04) {
      const slump = 1.0 + Math.sin(y * Math.PI) * 0.055 + Math.sin(a * 3.0 + y * 5.0) * 0.038;
      x *= slump;
      z *= slump;
    }
    bp.setXYZ(i, x, y, z);
  }
  body.computeVertexNormals();
  parts.push(tagGeo(body, { colorHex: 0xf2e6cc, bottomColorHex: 0xb39f7e }));

  // 6 Pronounced 3D Sculpted Vertical Melted Wax Drips cascading down the sides w/ frozen bulbous droplets
  const dripSpecs = [
    { ang: 0.25, len: 0.62, r: 0.21 },
    { ang: 1.25, len: 0.36, r: 0.16 },
    { ang: 2.30, len: 0.78, r: 0.23 },
    { ang: 3.35, len: 0.44, r: 0.18 },
    { ang: 4.35, len: 0.70, r: 0.20 },
    { ang: 5.40, len: 0.30, r: 0.15 }
  ];
  for (let di = 0; di < dripSpecs.length; di++) {
    if (SEG_MOBILE && (di % 2) === 1) continue; // mobile: 3 drips instead of 6
    const d = dripSpecs[di];
    const ca = Math.cos(d.ang);
    const sa = Math.sin(d.ang);
    const topY = 0.95;
    const botY = Math.max(0.06, topY - d.len);
    const midY = (topY + botY) * 0.5;
    // Bulging melted wax stream clinging down candle outer surface
    parts.push(tagGeo(makeXform(
      new THREE.CylinderGeometry(d.r * 0.72, d.r * 1.02, topY - botY, 5),
      ca * 0.96, midY, sa * 0.96
    ), { colorHex: 0xecdec2, bottomColorHex: 0xc5af89 }));
    // Rounded frozen teardrop wax bead at drip bottom
    parts.push(tagGeo(makeXform(
      new THREE.SphereGeometry(d.r * 1.28, 6, 4),
      ca * 0.99, botY, sa * 0.99,
      0, 0, 0, 1.0, 1.42, 1.0
    ), { colorHex: 0xf1e4ca, bottomColorHex: 0xbca680 }));
  }

  // Dark charred curved wick rising out of the concave wax pool (y = 0.86..1.16)
  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.085, 0.115, 0.28, 5), 0.04, 1.01, 0, 0, 0, -0.22), {
    colorHex: 0x151112, bottomColorHex: 0x2b201b
  }));

  return mergeTaggedParts(parts);
}

export function createMeltedCandleClusters3D({
  clusterCoords = [],
  ironMat = null,
  pbr = null,
  trackGeo = (g) => g,
  trackMat = (m) => m,
  trackTex = null,
  lowSpec = false,
  isMobile = false
} = {}) {
  void trackTex;
  SEG_MOBILE = Boolean(isMobile);
  const group = new THREE.Group();
  group.name = 'melted_candle_clusters_3d';

  const coords = Array.isArray(clusterCoords) ? clusterCoords : [];
  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  if (coords.length === 0) {
    return {
      group,
      candleCount: 0,
      getActiveCount: () => 0,
      drawCalls: 0,
      tryBreakCandlesNear: () => [],
      resetCandles() {},
      update() {},
      setLowSpec() {},
      dispose() {}
    };
  }

  const rng = makeRng(261109);
  const clusters = [];
  const items = [];
  for (let c = 0; c < coords.length; c++) {
    const entry = coords[c];
    const cx = Array.isArray(entry) ? entry[0] : (entry.x || 0);
    const cy = Array.isArray(entry) ? (entry[1] || 0) : (entry.y || 0);
    const cz = Array.isArray(entry) ? entry[2] : (entry.z || 0);
    const scale = (!Array.isArray(entry) && Number.isFinite(entry.scale)) ? entry.scale : 1.0;
    const perCluster = (!Array.isArray(entry) && Number.isFinite(entry.count)) ? Math.max(1, Math.floor(entry.count)) : 4;

    clusters.push({
      x: cx,
      y: cy,
      z: cz,
      broken: false,
      itemIndices: []
    });

    for (let k = 0; k < perCluster; k++) {
      const ang = (k / perCluster) * Math.PI * 2 + c * 0.85 + (rng() - 0.5) * 0.35;
      const dist = k === 0 ? 0.03 : (0.14 + (k % 2) * 0.10 + rng() * 0.04) * scale;
      const hBase = k === 0 ? 0.38 : k === 1 ? 0.27 : k === 2 ? 0.18 : 0.12 + rng() * 0.15;
      const h = hBase * scale;
      const r = (0.040 + (k % 2) * 0.012 + rng() * 0.008) * scale;
      items.push({
        clusterIdx: c,
        tier: k,
        x: cx + Math.cos(ang) * dist,
        y: cy,
        z: cz + Math.sin(ang) * dist,
        h,
        r,
        rotY: rng() * Math.PI * 2,
        scatterSeed: rng(),
        phase: c * 1.9 + k * 2.3 + rng() * 3.1
      });
    }
  }
  items.sort((a, b) => a.tier - b.tier);
  for (let i = 0; i < items.length; i++) {
    clusters[items[i].clusterIdx].itemIndices.push(i);
  }

  const ironNormal = pbr?.ironNormal || ironMat?.normalMap || null;
  const ironRough  = pbr?.ironRoughness || ironMat?.roughnessMap || null;

  // DC #1: Forged Iron Saucers w/ Finger-Ring Handle & Spilled Melted Wax Puddle
  const saucerGeo = regGeo(createForgedSaucerGeometry());
  const saucerMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ironNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: ironRough,
    roughness: 0.54,
    metalness: 0.72
  }));
  const saucerInst = new THREE.InstancedMesh(saucerGeo, saucerMat, items.length);
  saucerInst.name = 'candle_forged_saucers';
  saucerInst.receiveShadow = true;

  // DC #2: Sculpted Melted Beeswax Cylinders w/ 6 3D Wax Drips + Dark Charred Wicks
  const waxGeo = regGeo(createMeltedWaxAndWickGeometry());
  const waxMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.02,
    emissive: 0x4e2408,
    emissiveIntensity: 0.26
  }));
  const waxInst = new THREE.InstancedMesh(waxGeo, waxMat, items.length);
  waxInst.name = 'candle_melted_wax';
  waxInst.receiveShadow = true;

  // DC #3: Real Sapphire-Blue Cup Teardrop Candle Flames (from soulsFireVfx.js!)
  const flameGeo = regGeo(createCandleFlameTeardropGeometry({ height: 0.145, radius: 0.028, radialSegments: isMobile ? 5 : 8 }));
  const flamePhases = new Float32Array(items.length);
  for (let i = 0; i < items.length; i++) flamePhases[i] = items[i].phase;
  flameGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(flamePhases, 1));

  const flameMat = regMat(createCandleFlameShaderMaterial({
    instanced: true,
    isMobile,
    lowSpec
  }));
  const flameInst = new THREE.InstancedMesh(flameGeo, flameMat, items.length);
  flameInst.name = 'candle_teardrop_flames';
  flameInst.renderOrder = 4;

  function writeStandingCandle(i) {
    const ci = items[i];
    _dummy.position.set(ci.x, ci.y + 0.002, ci.z);
    _dummy.rotation.set(0, ci.rotY, 0);
    _dummy.scale.set(ci.r, ci.r, ci.r);
    _dummy.updateMatrix();
    saucerInst.setMatrixAt(i, _dummy.matrix);

    const saucerSeatY = ci.y + ci.r * 0.12;
    _dummy.position.set(ci.x, saucerSeatY, ci.z);
    _dummy.rotation.set(0, ci.rotY + 0.6, 0);
    _dummy.scale.set(ci.r, ci.h, ci.r);
    _dummy.updateMatrix();
    waxInst.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(ci.x, saucerSeatY + ci.h * 1.05, ci.z);
    _dummy.rotation.set(0, ci.rotY, 0);
    const fScale = 0.88 + Math.min(0.45, ci.r * 7.2);
    _dummy.scale.set(fScale, fScale, fScale);
    _dummy.updateMatrix();
    flameInst.setMatrixAt(i, _dummy.matrix);
  }

  function writeBrokenCandle(i, pushDirX, pushDirZ) {
    const ci = items[i];
    const seed = ci.scatterSeed || 0.5;
    const spreadAng = Math.atan2(pushDirZ, pushDirX) + (seed - 0.5) * 1.65;
    const kickDist = 0.11 + seed * 0.16;
    const kx = ci.x + Math.cos(spreadAng) * kickDist;
    const kz = ci.z + Math.sin(spreadAng) * kickDist;

    _dummy.position.set(ci.x + Math.cos(spreadAng) * (kickDist * 0.45), ci.y + 0.004, ci.z + Math.sin(spreadAng) * (kickDist * 0.45));
    _dummy.rotation.set((seed - 0.5) * 0.24, ci.rotY + seed * 2.1, (0.5 - seed) * 0.22);
    _dummy.scale.set(ci.r, ci.r, ci.r);
    _dummy.updateMatrix();
    saucerInst.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(kx, ci.y + ci.r * 0.92, kz);
    _dummy.rotation.set(Math.PI * 0.49, spreadAng + Math.PI * 0.5, 0);
    _dummy.scale.set(ci.r, ci.h * 0.94, ci.r);
    _dummy.updateMatrix();
    waxInst.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(kx, ci.y - 10.0, kz);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    flameInst.setMatrixAt(i, _dummy.matrix);
  }

  for (let i = 0; i < items.length; i++) {
    writeStandingCandle(i);
  }
  saucerInst.instanceMatrix.needsUpdate = true;
  waxInst.instanceMatrix.needsUpdate = true;
  flameInst.instanceMatrix.needsUpdate = true;

  group.add(saucerInst, waxInst, flameInst);

  let isLowSpec = Boolean(lowSpec);
  const mobileCap = Math.min(items.length, Math.max(coords.length * 2, Math.ceil(items.length * 0.65)));

  function applyVisibility() {
    const targetCount = isLowSpec ? 0 : (isMobile ? mobileCap : items.length);
    saucerInst.count = targetCount;
    waxInst.count = targetCount;
    flameInst.count = targetCount;
    const vis = targetCount > 0;
    saucerInst.visible = vis;
    waxInst.visible = vis;
    flameInst.visible = vis;
  }
  applyVisibility();

  function tryBreakCandlesNear(px, pz, radius = 0.72) {
    if (!Number.isFinite(px) || !Number.isFinite(pz)) return [];
    const r = Math.max(0.05, Number.isFinite(radius) ? radius : 0.72);
    const rSq = r * r;
    const broken = [];
    for (let c = 0; c < clusters.length; c++) {
      const cl = clusters[c];
      if (cl.broken) continue;
      const dx = cl.x - px;
      const dz = cl.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq <= rSq) {
        cl.broken = true;
        const dist = Math.sqrt(distSq);
        const dirX = dist > 1e-4 ? dx / dist : Math.cos(c * 1.7);
        const dirZ = dist > 1e-4 ? dz / dist : Math.sin(c * 1.7);
        for (let k = 0; k < cl.itemIndices.length; k++) {
          writeBrokenCandle(cl.itemIndices[k], dirX, dirZ);
        }
        broken.push({ x: cl.x, y: cl.y, z: cl.z });
      }
    }
    if (broken.length > 0) {
      saucerInst.instanceMatrix.needsUpdate = true;
      waxInst.instanceMatrix.needsUpdate = true;
      flameInst.instanceMatrix.needsUpdate = true;
    }
    return broken;
  }

  function resetCandles() {
    let anyChanged = false;
    for (let c = 0; c < clusters.length; c++) {
      if (clusters[c].broken) {
        clusters[c].broken = false;
        anyChanged = true;
      }
    }
    if (anyChanged) {
      for (let i = 0; i < items.length; i++) {
        writeStandingCandle(i);
      }
      saucerInst.instanceMatrix.needsUpdate = true;
      waxInst.instanceMatrix.needsUpdate = true;
      flameInst.instanceMatrix.needsUpdate = true;
    }
  }

  function setLowSpec(enabled = false) {
    isLowSpec = Boolean(enabled);
    saucerMat.normalMap = isLowSpec ? null : ironNormal;
    saucerMat.needsUpdate = true;
    flameMat.setLowSpec(isLowSpec);
    applyVisibility();
  }

  function update(dt = 0.016, elapsed = 0) {
    if (!flameInst.visible) return;
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    flameMat.update(t, safeDt);
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const g of localGeos) g.dispose?.();
    for (const m of localMats) m.dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    candleCount: items.length,
    getActiveCount: () => waxInst.count,
    get drawCalls() { return waxInst.visible ? 3 : 0; },
    tryBreakCandlesNear,
    resetCandles,
    update,
    setLowSpec,
    dispose
  };
}

// ============================================================================
// 4. CASTLE BANNERS, RELIC SHRINES & EAST ALCOVE ARMORY DECOR 3D (4 DC TOTAL!)
//    - DC 1: 10x18 draped tattered gothic banners w/ AAA pbr.bannerAlbedo/Normal/Roughness
//            + multi-harmonic cloth wind shader (unique phase/fray per banner!)
//    - DC 2: Carved gothic stone Relic Altar(s) w/ real ashlarAlbedo/Normal/Roughness
//    - DC 3: Forged iron banner spear-crossbars/chains + shrine reliquary cradle + ALL 9
//            East Alcove Armory props (2 weapon racks w/ greatswords/halberds/spears,
//            2 full suits of Ashen Plate Armor on stands, 5 wall heraldic shields w/ crossed swords)
//    - DC 4: Instanced glowing runic crystals + orbital rings w/ setShrineClaimed(id)
// ============================================================================
function createFallbackBannerTexture() {
  if (typeof document === 'undefined') {
    const data = new Uint8Array([
      106, 19, 32, 255,  212, 170, 80, 255,
      72, 12, 22, 255,   180, 138, 56, 255
    ]);
    const fallback = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
    fallback.colorSpace = THREE.SRGBColorSpace;
    fallback.needsUpdate = true;
    return fallback;
  }

  const W = 256;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = makeRng(269044);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0.00, '#6e1422');
  bg.addColorStop(0.35, '#540e19');
  bg.addColorStop(0.74, '#3a0912');
  bg.addColorStop(1.00, '#1e060b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#c99c42';
  ctx.lineWidth = 11;
  ctx.strokeRect(18, 16, W - 36, H - 64);
  ctx.strokeStyle = '#8b6825';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 30, W - 64, H - 92);

  ctx.save();
  ctx.translate(W * 0.5, H * 0.42);
  ctx.strokeStyle = 'rgba(212, 168, 76, 0.72)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, -108); ctx.lineTo(66, 0); ctx.lineTo(0, 118); ctx.lineTo(-66, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#d8ae54';
  ctx.beginPath();
  ctx.moveTo(0, 102); ctx.lineTo(10, 74); ctx.lineTo(9, -36); ctx.lineTo(-9, -36); ctx.lineTo(-10, 74);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-44, -44, 88, 12);
  ctx.fillRect(-7, -76, 14, 34);
  ctx.beginPath(); ctx.arc(0, -82, 11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-30, -104); ctx.lineTo(-34, -132); ctx.lineTo(-14, -116);
  ctx.lineTo(0, -142); ctx.lineTo(14, -116); ctx.lineTo(34, -132); ctx.lineTo(30, -104);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < 16; i++) {
    const px = rng() * W;
    const py = H * 0.30 + rng() * H * 0.68;
    const pr = 16 + rng() * 34;
    const g = ctx.createRadialGradient(px, py, 2, px, py, pr);
    g.addColorStop(0, 'rgba(14, 7, 10, 0.36)');
    g.addColorStop(1, 'rgba(14, 7, 10, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Ornate forged banner crossbar w/ scrolled wall mounts, spear finials, 4 hanging rings & angled chains!
function appendBannerHardwareParts(parts, spec) {
  const w = Number.isFinite(spec.width) ? spec.width : 1.25;
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 4.6;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];
  // Two wall-mounted gothic bracket backplates + projecting support arms + upper anchor chains
  for (const sx of [-w * 0.44, w * 0.44]) {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.11, 0.28, 0.045), sx, 0.02, 0.022), { colorHex: 0x353c4c }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.052, 0.056, 0.26), sx, 0.03, 0.13), { colorHex: 0x41495c }));
    // Scrolled bracket strut below arm
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.068, 0.014, 4, 7), sx, -0.05, 0.12, 0, Math.PI / 2, 0), { colorHex: 0x4b5368 }));
    // Angled forged suspension chain running from wall eye (+0.42y) down to crossbar
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.075, 0.10, 0.035), sx, 0.40, 0.018), { colorHex: 0x383f50 }));
    for (let lnk = 0; lnk < (SEG_MOBILE ? 2 : 4); lnk++) {
      const f = (lnk + 0.5) / (SEG_MOBILE ? 2 : 4);
      local.push(tagGeo(makeXform(
        new THREE.TorusGeometry(0.032, 0.010, 4, 6),
        sx, 0.40 - f * 0.36, 0.03 + f * 0.19,
        0.48, lnk % 2 === 0 ? Math.PI / 2 : 0, 0
      ), { colorHex: 0x515a6f }));
    }
  }

  // Horizontal forged iron crossbar extending past banner width + decorative collar rings
  const barLen = w + 0.50;
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.034, 0.034, barLen, 7), 0, 0.03, 0.22, 0, 0, Math.PI / 2), {
    colorHex: 0x464e62, bottomColorHex: 0x282d39
  }));
  for (const side of [-1, 1]) {
    const endX = side * (barLen * 0.5);
    // Double forged collar + diamond spearhead finial w/ cross-barbs
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.044, 0.014, 4, 7), endX - side * 0.05, 0.03, 0.22, 0, Math.PI / 2, 0), { colorHex: 0x5c657c }));
    local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.056, 0), endX + side * 0.02, 0.03, 0.22), { colorHex: 0x5e677e }));
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.048, 0.20, 4), endX + side * 0.15, 0.03, 0.22, 0, 0, -side * Math.PI / 2), { colorHex: 0x6b758e }));
  }

  // 4 forged wrought-iron suspension rings gripping the banner top edge
  for (let r = 0; r < (SEG_MOBILE ? 2 : 4); r++) {
    const rx = -w * 0.41 + (r / (SEG_MOBILE ? 1 : 3)) * (w * 0.82);
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.052, 0.013, 4, 8), rx, -0.015, 0.22, 0, Math.PI / 2, 0), {
      colorHex: 0x555e74
    }));
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

// High-res 10x18 draped & tattered swallowtail banner cloth geometry w/ unique fray & natural ring sag!
function createSingleBannerClothGeo(spec, idx) {
  const rng = makeRng(269820 + idx * 131);
  const w = (Number.isFinite(spec.width) ? spec.width : 1.25) * (0.97 + rng() * 0.06);
  const h = (Number.isFinite(spec.height) ? spec.height : 3.15) * (0.96 + rng() * 0.08);
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 4.6;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const cols = SEG_MOBILE ? 8 : 10;
  const rows = SEG_MOBILE ? 11 : 18;
  const plane = new THREE.PlaneGeometry(w, h, cols, rows);
  const pos = plane.attributes.position;
  const uv = plane.attributes.uv;

  // Unique per-banner asymmetric tattered swallowtail V-notch + jagged battle-torn notches along hem
  const colHemCut = new Float32Array(cols + 1);
  const notchAsym = (rng() - 0.5) * 0.07;
  const tearCol = 1 + Math.floor(rng() * (cols - 1));
  for (let c = 0; c <= cols; c++) {
    const u = c / cols;
    const centerDist = Math.abs(u - (0.5 + notchAsym)) * 2.0;
    const swallowtail = Math.max(0, 1.0 - centerDist) * (0.21 + rng() * 0.05);
    const fray = rng() * 0.085 * (0.35 + centerDist * 0.65);
    const tearNotch = c === tearCol ? 0.095 : 0.0;
    colHemCut[c] = Math.min(0.34, swallowtail + fray + tearNotch);
  }

  const foldPhase = idx * 0.93 + rng() * 1.4;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i); // 1 top -> 0 bottom
    const hangT = 1.0 - v; // 0 top -> 1 bottom

    const colIdx = Math.min(cols, Math.max(0, Math.round(u * cols)));
    const effectiveH = h * (1.0 - colHemCut[colIdx] * Math.pow(hangT, 1.28));

    // Natural catenary sag between the 4 iron suspension rings at top edge (u = 0.09, 0.36, 0.64, 0.91)
    const ringWave = Math.abs(Math.sin(((u - 0.09) / 0.82) * Math.PI * 3.0));
    const topSag = ringWave * 0.055 * (1.0 - hangT * 0.65);

    // Deep vertical drapery pleats radiating down from the 4 rings + soft wind belly
    const pleatZ = Math.cos(((u - 0.09) / 0.82) * Math.PI * 6.0) * 0.036 * (0.25 + 0.75 * Math.sin(hangT * Math.PI * 0.9));
    const broadWaveZ = Math.sin(u * Math.PI * 2.0 + foldPhase) * 0.032 * Math.sin(hangT * Math.PI);
    const edgeCurlZ = Math.pow(Math.abs(u - 0.5) * 2.0, 2.2) * 0.042 * hangT;

    const x = (u - 0.5) * w * (1.0 - hangT * 0.045);
    const y = -0.045 - topSag - hangT * effectiveH;
    const z = 0.225 + pleatZ + broadWaveZ + edgeCurlZ;

    pos.setXYZ(i, x, y, z);
  }
  plane.computeVertexNormals();

  const nonIdx = plane.index ? plane.toNonIndexed() : plane;
  if (nonIdx !== plane) plane.dispose();

  const count = nonIdx.attributes.position.count;
  const swayPhase = new Float32Array(count);
  const swayWeight = new Float32Array(count);
  const lateral = new Float32Array(count);
  const pUv = nonIdx.attributes.uv;
  const phaseVal = idx * 1.71 + rng() * 2.4;
  for (let i = 0; i < count; i++) {
    const u = pUv.getX(i);
    const hangT = 1.0 - pUv.getY(i);
    swayPhase[i] = phaseVal;
    // Pinned solidly at top rings (0), billowing richly toward tattered swallowtail tips (1)
    swayWeight[i] = Math.pow(hangT, 1.65);
    lateral[i] = (u - 0.5) * 2.0;
  }
  nonIdx.setAttribute('aSwayPhase', new THREE.BufferAttribute(swayPhase, 1));
  nonIdx.setAttribute('aSwayWeight', new THREE.BufferAttribute(swayWeight, 1));
  nonIdx.setAttribute('aLateral', new THREE.BufferAttribute(lateral, 1));

  makeXform(nonIdx, ox, oy, oz, 0, rotY, 0);
  return nonIdx;
}

// Carved Gothic Stone Relic Altar (separated to receive real ashlarAlbedo/Normal/Roughness!)
function appendRelicShrineStoneParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];

  // 2-tier chamfered stepped gothic dais plinth
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(1.66, 0.14, 1.44), 0, 0.07, 0), {
    colorHex: 0x62697d, bottomColorHex: 0x262933
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(1.36, 0.14, 1.16), 0, 0.21, 0), {
    colorHex: 0x717990, bottomColorHex: 0x3b404f
  }));

  // Carved pedestal block + recessed gothic panel trim + 4 corner fluted colonnettes
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.94, 0.76, 0.78), 0, 0.66, 0), {
    colorHex: 0x5c6376, bottomColorHex: 0x343946
  }));
  for (const sx of [-0.47, 0.47]) {
    for (const sz of [-0.39, 0.39]) {
      local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.092, 0.105, 0.78, 8), sx, 0.67, sz), {
        colorHex: 0x7b849c, bottomColorHex: 0x424859
      }));
    }
  }

  // Beveled overhanging stone altar mensa slab
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(1.28, 0.14, 1.06), 0, 1.11, 0), {
    colorHex: 0x848ea8, bottomColorHex: 0x4e5568
  }));

  // Pointed gothic rear stela arch hood w/ spire finial & flanking crocketed pinnacles
  for (const sx of [-0.48, 0.48]) {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.20, 0.90, 0.26), sx, 1.63, -0.35), {
      colorHex: 0x6c748a, bottomColorHex: 0x3e4454
    }));
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.09, 0.26, 4), sx, 2.20, -0.35, 0, Math.PI / 4, 0), {
      colorHex: 0x828ba4
    }));
  }
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.68, 0.18, 0.26), -0.25, 2.11, -0.35, 0, 0, 0.56), { colorHex: 0x7d869f }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.68, 0.18, 0.26),  0.25, 2.11, -0.35, 0, 0, -0.56), { colorHex: 0x7d869f }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.13, 0.34, 4), 0, 2.38, -0.35, 0, Math.PI / 4, 0), { colorHex: 0x8b95b0 }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

function appendRelicShrineIronParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.27, 0.34, 0.11, 8), 0, 1.235, 0.04, 0, Math.PI / 8, 0), {
    colorHex: 0x373e4e, bottomColorHex: 0x1e222c
  }));
  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.044, 0.26, 0.044), 0.23, 1.35, a, -0.36, 0.04), {
      colorHex: 0x525b72
    }));
  }
  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

// ============================================================================
// East Alcove Armory Decor 3D Builders (Merged into the same forged iron PBR DC!)
//   - weapon_rack: dark timber A-frame w/ iron corner straps + greatswords, halberds, longswords, spears
//   - armor_stand: gothic Ashen Plate Armor cuirass, layered pauldrons, barbute/sallet helm, tassets & gauntlets
//   - wall_shield: beveled gothic kite/heater shields w/ heraldic crests & crossed broadswords
// ============================================================================
function appendWeaponRackParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const w = Number.isFinite(spec.width) ? spec.width : 1.8;
  const h = Number.isFinite(spec.height) ? spec.height : 1.85;
  const isHeavy = spec.style === 'greatswords_halberds';

  const local = [];
  const halfW = w * 0.46;

  // Heavy dark aged oak A-frame stand w/ forged iron base boots & notched crossbars
  for (const side of [-1, 1]) {
    const sx = side * halfW;
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.11, 0.12, 0.62), sx, 0.06, 0), { colorHex: 0x2b201a, bottomColorHex: 0x17120f }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.09, h * 0.78, 0.10), sx, h * 0.42, -0.06, 0.12, 0, 0), { colorHex: 0x3b2c22, bottomColorHex: 0x221914 }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.09, h * 0.76, 0.10), sx, h * 0.41,  0.14, -0.14, 0, 0), { colorHex: 0x3b2c22, bottomColorHex: 0x221914 }));
    // Iron top cap & side braces
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.12, 0.08, 0.24), sx, h * 0.78, 0.04), { colorHex: 0x454d60 }));
  }
  // Horizontal weapon-rest rails + floor trough
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(w, 0.08, 0.34), 0, 0.14, 0.02), { colorHex: 0x35271e }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.08, 0.075, 0.09), 0, h * 0.62, 0.02), { colorHex: 0x403025 }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.12, 0.055, 0.06), 0, h * 0.78, 0.04), { colorHex: 0x485064 }));

  // Helper: standing knightly sword leaning cleanly inside the rack
  const addRackSword = (sx, bladeLen, guardW, tiltZ) => {
    const sw = [];
    // Beveled diamond blade
    sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.028, 0.055, bladeLen, 4), 0, bladeLen * 0.5 + 0.18, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.35), {
      colorHex: 0x7b849b, bottomColorHex: 0x4d5466
    }));
    // Crossguard + grip + pommel
    sw.push(tagGeo(makeXform(new THREE.BoxGeometry(guardW, 0.045, 0.055), 0, bladeLen + 0.18, 0), { colorHex: 0x525a6f }));
    sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.024, 0.028, 0.26, 6), 0, bladeLen + 0.33, 0), { colorHex: 0x2c221f }));
    sw.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.052, 0), 0, bladeLen + 0.48, 0), { colorHex: 0x677088 }));
    const sm = mergeTaggedParts(sw);
    makeXform(sm, sx, 0, 0.04, -0.06, 0, tiltZ);
    local.push(sm);
  };

  // Helper: towering gothic halberd / polearm spear
  const addRackPolearm = (sx, poleH, isHalberd, tiltZ) => {
    const pl = [];
    pl.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.022, 0.026, poleH, 6), 0, poleH * 0.5 + 0.14, 0), {
      colorHex: 0x3d2e24, bottomColorHex: 0x241a15
    }));
    // Top spearhead
    pl.push(tagGeo(makeXform(new THREE.ConeGeometry(0.048, 0.34, 4), 0, poleH + 0.28, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.42), {
      colorHex: 0x848ea6, bottomColorHex: 0x555d72
    }));
    if (isHalberd) {
      // Swept crescent axe blade + back armor-piercing beak
      pl.push(tagGeo(makeXform(new THREE.BoxGeometry(0.24, 0.26, 0.022), 0.12, poleH + 0.04, 0, 0, 0, -0.18), { colorHex: 0x7c859c }));
      pl.push(tagGeo(makeXform(new THREE.ConeGeometry(0.036, 0.18, 4), -0.10, poleH + 0.08, 0, 0, 0, Math.PI * 0.52), { colorHex: 0x697288 }));
    }
    const pm = mergeTaggedParts(pl);
    makeXform(pm, sx, 0, -0.02, 0.05, 0, tiltZ);
    local.push(pm);
  };

  if (isHeavy) {
    addRackPolearm(-halfW * 0.68, 1.88, true,  0.04);
    addRackSword(-halfW * 0.22, 1.24, 0.38, -0.03);
    addRackSword( halfW * 0.22, 1.18, 0.36,  0.03);
    addRackPolearm( halfW * 0.68, 1.94, true, -0.05);
  } else {
    addRackPolearm(-halfW * 0.66, 1.82, false,  0.05);
    addRackSword(-halfW * 0.20, 0.98, 0.30, -0.04);
    addRackSword( halfW * 0.22, 1.04, 0.32,  0.02);
    addRackPolearm( halfW * 0.66, 1.86, false, -0.04);
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

function appendArmorStandParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];

  // Octagonal timber/iron stand plinth + central post + shoulder crossbar
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.36, 0.42, 0.14, 8), 0, 0.07, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x3b312a, bottomColorHex: 0x1e1916
  }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.045, 0.055, 1.56, 7), 0, 0.86, 0), { colorHex: 0x302620 }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.76, 0.055, 0.055), 0, 1.44, 0), { colorHex: 0x362b24 }));

  // Sculpted Ashen Plate Cuirass (fluted breastplate + gorget + waist faulds & thigh tassets)
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.24, 0.19, 0.46, 8), 0, 1.24, 0.02, 0, Math.PI / 8, 0, 1.16, 1.0, 0.78), {
    colorHex: 0x6c748a, bottomColorHex: 0x3a4050
  }));
  // Central breastplate keel ridge
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.055, 0.44, 0.10), 0, 1.24, 0.16, -0.08, 0, 0), { colorHex: 0x8089a2 }));
  // Armored gorget collar
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.14, 0.21, 0.12, 8), 0, 1.50, 0.01), { colorHex: 0x5c6478 }));
  // Layered hip faulds + twin hanging thigh tassets
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.20, 0.26, 0.20, 8), 0, 0.94, 0.01, 0, Math.PI / 8, 0, 1.12, 1.0, 0.78), {
    colorHex: 0x565e72, bottomColorHex: 0x343a48
  }));
  for (const side of [-1, 1]) {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.16, 0.30, 0.05), side * 0.14, 0.72, 0.13, -0.14, side * 0.22, side * 0.08), {
      colorHex: 0x626b80, bottomColorHex: 0x383e4d
    }));
    // Layered rounded gothic pauldrons + rerebrace sleeves
    local.push(tagGeo(makeXform(new THREE.SphereGeometry(0.155, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), side * 0.31, 1.44, 0, 0, 0, -side * 0.42, 1.15, 0.92, 1.05), {
      colorHex: 0x767f96, bottomColorHex: 0x42495a
    }));
    local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.082, 0.068, 0.32, 7), side * 0.36, 1.22, 0.01, 0, 0, -side * 0.12), {
      colorHex: 0x596175, bottomColorHex: 0x343a48
    }));
  }

  // Sculpted Gothic Sallet / Barbute Knight Helm w/ sharp visor ridge & dark eye-slit
  local.push(tagGeo(makeXform(new THREE.SphereGeometry(0.148, 9, 7), 0, 1.70, 0.01, 0, 0, 0, 0.92, 1.14, 1.08), {
    colorHex: 0x7b859e, bottomColorHex: 0x42495c
  }));
  // Pointed visor prow + crest keel + dark breathing slit
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.11, 0.22, 4), 0, 1.65, 0.14, Math.PI * 0.46, Math.PI / 4, 0), {
    colorHex: 0x697288, bottomColorHex: 0x3d4354
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.16, 0.026, 0.045), 0, 1.69, 0.175), { colorHex: 0x111318 }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.028, 0.16, 0.26), 0, 1.84, -0.02, -0.18, 0, 0), { colorHex: 0x8791ab }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

function appendWallShieldParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 2.85;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;

  const local = [];

  // Optional crossed knightly broadswords mounted behind the shield (z = 0.045)
  if (spec.crossedSwords) {
    for (const side of [-1, 1]) {
      const sw = [];
      sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.024, 0.046, 1.18, 4), 0, -0.10, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.34), {
        colorHex: 0x7e87a0, bottomColorHex: 0x525a6e
      }));
      sw.push(tagGeo(makeXform(new THREE.BoxGeometry(0.32, 0.042, 0.048), 0, 0.49, 0), { colorHex: 0x9b7e3c }));
      sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 6), 0, 0.62, 0), { colorHex: 0x2c221e }));
      sw.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.046, 0), 0, 0.75, 0), { colorHex: 0xb89648 }));
      const sm = mergeTaggedParts(sw);
      makeXform(sm, 0, 0.04, 0.048, 0, 0, side * 0.56);
      local.push(sm);
    }
  }

  // Sculpted Symmetric Gothic Heater Shield body (ExtrudeGeometry for crisp medieval silhouette, z = 0.08..0.14)
  const faceHex = spec.crest === 'relic_sun_shield' ? 0x6c1824 : (spec.crest === 'iron_cross' ? 0x263146 : 0x4e1421);
  const trimHex = spec.crest === 'relic_sun_shield' ? 0xd9ad4e : 0x7b859e;

  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.35,  0.42);
  shieldShape.lineTo( 0.35,  0.42);
  shieldShape.lineTo( 0.34,  0.02);
  shieldShape.quadraticCurveTo(0.28, -0.34, 0.0, -0.58);
  shieldShape.quadraticCurveTo(-0.28, -0.34, -0.34, 0.02);
  shieldShape.closePath();

  // Outer beveled metallic rim backing (slightly larger)
  const rimGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.032,
    bevelSegments: 1,
    curveSegments: SEG_MOBILE ? 2 : 5
  });
  makeXform(rimGeo, 0, 0, 0.082);
  local.push(tagGeo(rimGeo, { colorHex: trimHex, bottomColorHex: 0x3b3532 }));

  // Inner painted/enameled heraldic shield face slightly proud of rim trough
  const faceGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.030,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: -0.012,
    bevelSegments: 1,
    curveSegments: SEG_MOBILE ? 2 : 5
  });
  makeXform(faceGeo, 0, 0, 0.112);
  local.push(tagGeo(faceGeo, { colorHex: faceHex, bottomColorHex: 0x1a1117 }));

  // Central Heraldic Relief Crest on shield face
  if (spec.crest === 'relic_sun_shield') {
    local.push(tagGeo(makeXform(new THREE.SphereGeometry(0.12, 8, 6), 0, 0.06, 0.15, 0, 0, 0, 1.0, 1.0, 0.52), { colorHex: 0xe6be5c }));
    for (let r = 0; r < 8; r++) {
      const a = (r / 8) * Math.PI * 2;
      local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.032, 0.18, 4), Math.cos(a) * 0.19, 0.06 + Math.sin(a) * 0.19, 0.155, 0, 0, a - Math.PI / 2), {
        colorHex: 0xd9af4f
      }));
    }
  } else if (spec.crest === 'iron_cross') {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.11, 0.52, 0.04), 0, 0.04, 0.15), { colorHex: 0x9aa4bd }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.44, 0.11, 0.04), 0, 0.12, 0.15), { colorHex: 0x9aa4bd }));
    local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.072, 0), 0, 0.12, 0.175), { colorHex: 0xcba146 }));
  } else {
    // Ashen Crown emblem
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.28, 0.08, 0.04), 0, 0.06, 0.15), { colorHex: 0xd0a448 }));
    for (const cx of [-0.11, 0, 0.11]) {
      local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.045, 0.15, 4), cx, 0.16, 0.155), { colorHex: 0xe2b95b }));
    }
    local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.085, 0), 0, -0.10, 0.16), { colorHex: 0x8993ab }));
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0, s, s, s);
  parts.push(merged);
}

// Sculpted Double-Pointed Runic Crystal + Tilted Orbital Runic Ring (InstancedMesh)
function createRunicCrystalGeometry() {
  const parts = [];
  const crystal = new THREE.OctahedronGeometry(0.22, 0);
  crystal.scale(0.76, 1.78, 0.76);
  const nonIdxC = crystal.index ? crystal.toNonIndexed() : crystal;
  if (nonIdxC !== crystal) crystal.dispose();
  parts.push(nonIdxC);

  const ring = new THREE.TorusGeometry(0.33, 0.021, 4, 6);
  ring.rotateX(Math.PI * 0.38);
  ring.rotateZ(0.32);
  const nonIdxR = ring.index ? ring.toNonIndexed() : ring;
  if (nonIdxR !== ring) ring.dispose();
  parts.push(nonIdxR);

  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

export function createCastleBannersAndShrines3D({
  bannerSpecs = [],
  shrineSpecs = [],
  alcoveDecorSpecs = SOULS_CASTLE_ALCOVE_DECOR,
  darkStoneMat = null,
  trimStoneMat = null,
  ironMat = null,
  pbr = null,
  trackGeo = (g) => g,
  trackMat = (m) => m,
  trackTex = null,
  isMobile = false,
  lowSpec = false
} = {}) {
  SEG_MOBILE = Boolean(isMobile);
  const group = new THREE.Group();
  group.name = 'castle_banners_and_shrines_3d';

  const banners = Array.isArray(bannerSpecs) ? bannerSpecs : [];
  const shrines = Array.isArray(shrineSpecs) ? shrineSpecs : [];
  const alcoveDecor = Array.isArray(alcoveDecorSpecs) ? alcoveDecorSpecs : [];

  const localGeos = [];
  const localMats = [];
  const texCleanups = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const stoneAlbedo = pbr?.ashlarAlbedo || trimStoneMat?.map || darkStoneMat?.map || null;
  const stoneNormal = pbr?.ashlarNormal || trimStoneMat?.normalMap || darkStoneMat?.normalMap || null;
  const stoneRough  = pbr?.ashlarRoughness || trimStoneMat?.roughnessMap || darkStoneMat?.roughnessMap || null;
  const ironNormal  = pbr?.ironNormal || ironMat?.normalMap || null;
  const ironRough   = pbr?.ironRoughness || ironMat?.roughnessMap || null;

  const shrineColliders = [];
  const alcoveColliders = [];
  const shrineLights = [];
  let drawCalls = 0;

  // Collect Stone Shrine Parts & Forged Iron / East Alcove Armory Parts
  const stoneShrineParts = [];
  const forgedHardwareAndAlcoveParts = [];

  for (let i = 0; i < banners.length; i++) {
    appendBannerHardwareParts(forgedHardwareAndAlcoveParts, banners[i]);
  }
  for (let j = 0; j < shrines.length; j++) {
    const sh = shrines[j];
    appendRelicShrineStoneParts(stoneShrineParts, sh);
    appendRelicShrineIronParts(forgedHardwareAndAlcoveParts, sh);
    if (sh.collider !== false) {
      const colR = Number.isFinite(sh.colliderRadius) ? sh.colliderRadius : (Number.isFinite(sh.r) ? sh.r : 0.85);
      shrineColliders.push({
        id: sh.id ?? `shrine_${j}`,
        x: sh.x || 0,
        z: sh.z || 0,
        r: colR,
        radius: colR
      });
    }
  }

  for (let d = 0; d < alcoveDecor.length; d++) {
    const item = alcoveDecor[d];
    if (!item) continue;
    if (item.kind === 'weapon_rack') {
      appendWeaponRackParts(forgedHardwareAndAlcoveParts, item);
    } else if (item.kind === 'armor_stand') {
      appendArmorStandParts(forgedHardwareAndAlcoveParts, item);
    } else if (item.kind === 'wall_shield') {
      appendWallShieldParts(forgedHardwareAndAlcoveParts, item);
    }
    if (item.collider) {
      const r = Number.isFinite(item.radius) ? item.radius : 0.55;
      alcoveColliders.push({
        id: item.id ?? `alcove_decor_${d}`,
        kind: item.kind,
        x: item.x || 0,
        z: item.z || 0,
        r,
        radius: r
      });
    }
  }

  // DC #1: Carved Gothic Stone Relic Altars (real ashlar PBR!)
  let stoneShrineMat = null;
  if (stoneShrineParts.length > 0) {
    stoneShrineMat = regMat(new THREE.MeshStandardMaterial({
      map: stoneAlbedo,
      normalMap: lowSpec ? null : stoneNormal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: stoneRough,
      color: stoneAlbedo ? 0xa3aac0 : 0x7f879e,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.10
    }));
    const stoneGeo = regGeo(mergeTaggedParts(stoneShrineParts, 2.0));
    const stoneMesh = new THREE.Mesh(stoneGeo, stoneShrineMat);
    stoneMesh.name = 'castle_relic_shrines_stone';
    stoneMesh.castShadow = true;
    stoneMesh.receiveShadow = true;
    group.add(stoneMesh);
    drawCalls++;
  }

  // DC #2: Forged Iron Banner Crossbars/Chains + Shrine Iron Cradle + ALL 9 East Alcove Armory Props!
  let forgedDecorMat = null;
  if (forgedHardwareAndAlcoveParts.length > 0) {
    forgedDecorMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      normalMap: lowSpec ? null : ironNormal,
      normalScale: new THREE.Vector2(0.72, 0.72),
      roughnessMap: ironRough,
      roughness: 0.72,
      metalness: 0.68
    }));
    const ironGeo = regGeo(mergeTaggedParts(forgedHardwareAndAlcoveParts, 0.90));
    const ironMesh = new THREE.Mesh(ironGeo, forgedDecorMat);
    ironMesh.name = 'castle_banner_hardware_and_alcove_armory';
    ironMesh.castShadow = true;
    ironMesh.receiveShadow = true;
    group.add(ironMesh);
    drawCalls++;
  }

  // DC #3: AAA 10x18 Draped Tattered Gothic Banners w/ bannerAlbedo/Normal/Roughness + Multi-Harmonic Wind Shader!
  const bannerSwayUniforms = {
    uTime: { value: 0 },
    uSwayAmp: { value: lowSpec ? 0.040 : 0.088 }
  };
  let bannerMat = null;
  const bannerNormalTex = pbr?.bannerNormal || null;
  if (banners.length > 0) {
    const clothParts = [];
    for (let i = 0; i < banners.length; i++) {
      clothParts.push(createSingleBannerClothGeo(banners[i], i));
    }
    const mergedClothGeo = regGeo(mergeGeometries(clothParts, false));
    for (let i = 0; i < clothParts.length; i++) clothParts[i].dispose();

    const ownsFallbackBannerTex = !pbr?.bannerAlbedo;
    const bannerAlbedoTex = pbr?.bannerAlbedo || createFallbackBannerTexture();
    const bannerRoughTex = pbr?.bannerRoughness || null;

    bannerMat = regMat(new THREE.MeshStandardMaterial({
      map: bannerAlbedoTex,
      normalMap: lowSpec ? null : bannerNormalTex,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: bannerRoughTex,
      color: 0xffffff,
      roughness: bannerRoughTex ? 1.0 : 0.84,
      metalness: 0.16,
      side: THREE.DoubleSide
    }));
    bannerMat.customProgramCacheKey = () => 'souls_banner_cloth_wind_v2';
    bannerMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = bannerSwayUniforms.uTime;
      shader.uniforms.uSwayAmp = bannerSwayUniforms.uSwayAmp;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute float aSwayPhase;
           attribute float aSwayWeight;
           attribute float aLateral;
           uniform float uTime;
           uniform float uSwayAmp;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           // 3-harmonic gothic draft cloth simulation: slow cathedral swell + downward traveling wave + hem corner flutter
           float gust  = sin(uTime * 1.35 + aSwayPhase) * 0.56;
           float wave  = sin(uTime * 2.45 + aSwayPhase * 1.3 + position.y * 1.65) * 0.30;
           float flutt = sin(uTime * 4.65 + aSwayPhase * 2.1 + position.y * 3.1 + aLateral * 2.4) * 0.14;
           float disp  = (gust + wave + flutt) * uSwayAmp * aSwayWeight;
           transformed += normal * disp;
           // Subtle inextensible cloth lift when billowing out
           transformed.y += abs(disp) * 0.14;`
        );
    };
    if (ownsFallbackBannerTex) {
      texCleanups.push(attachTextureCleanup(bannerMat, [bannerAlbedoTex], trackTex));
    }

    const bannersClothMesh = new THREE.Mesh(mergedClothGeo, bannerMat);
    bannersClothMesh.name = 'castle_gothic_banners_cloth';
    bannersClothMesh.castShadow = false;
    bannersClothMesh.receiveShadow = true;
    group.add(bannersClothMesh);
    drawCalls++;
  }

  // DC #4: Instanced Glowing Runic Shrine Crystals (per-instance color & setShrineClaimed extinguishment!)
  const shrineIdToIdx = new Map();
  const shrineClaimedState = new Float32Array(shrines.length);
  let shrineClaimedAttr = null;
  let shrineRelicUniforms = null;

  if (shrines.length > 0) {
    const relicGeo = regGeo(createRunicCrystalGeometry());
    const relicColors = new Float32Array(shrines.length * 3);
    const relicPhases = new Float32Array(shrines.length);

    for (let i = 0; i < shrines.length; i++) {
      const sh = shrines[i];
      const id = sh.id ?? `shrine_${i}`;
      shrineIdToIdx.set(id, i);
      shrineClaimedState[i] = sh.claimed ? 1.0 : 0.0;

      const defaultColor = sh.kind === 'blade' ? 0x60a5fa : 0xfbbf24;
      const colHex = Number.isFinite(sh.color) ? sh.color : (Number.isFinite(sh.glowColor) ? sh.glowColor : defaultColor);
      _tmpColor.setHex(colHex);
      relicColors[i * 3]     = _tmpColor.r;
      relicColors[i * 3 + 1] = _tmpColor.g;
      relicColors[i * 3 + 2] = _tmpColor.b;
      relicPhases[i] = i * 2.1 + 0.35;

      const rotY = resolveYaw(sh);
      const rx = (sh.x || 0) + Math.sin(rotY) * 0.04;
      const rz = (sh.z || 0) + Math.cos(rotY) * 0.04;
      shrineLights.push({
        id,
        shrineId: id,
        x: rx,
        y: (sh.y || 0) + 1.85,
        z: rz,
        color: colHex,
        baseInt: 3.4,
        dist: 12.0,
        phase: relicPhases[i],
        weight: 1.45,
        active: !sh.claimed
      });
    }

    shrineClaimedAttr = new THREE.InstancedBufferAttribute(shrineClaimedState, 1);
    relicGeo.setAttribute('aClaimed', shrineClaimedAttr);
    relicGeo.setAttribute('aColor', new THREE.InstancedBufferAttribute(relicColors, 3));
    relicGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(relicPhases, 1));

    shrineRelicUniforms = { uTime: { value: 0 } };
    const relicMat = regMat(new THREE.ShaderMaterial({
      uniforms: shrineRelicUniforms,
      transparent: false,
      depthWrite: true,
      vertexShader: /* glsl */ `
        attribute float aClaimed;
        attribute vec3 aColor;
        attribute float aPhase;
        uniform float uTime;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vColor;
        varying float vClaimed;
        varying float vPulse;

        void main() {
          vColor = aColor;
          vClaimed = aClaimed;
          float isLit = 1.0 - clamp(aClaimed, 0.0, 1.0);
          float ang = (uTime * 1.15 + aPhase) * isLit;
          float c = cos(ang);
          float s = sin(ang);

          vec3 p = position;
          vec3 rp = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
          rp *= mix(0.84, 1.0, isLit);
          rp.y += mix(-0.18, sin(uTime * 2.3 + aPhase) * 0.085, isLit);

          vec3 n = normal;
          vec3 rn = vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c);

          vPulse = 0.78 + 0.22 * sin(uTime * 3.6 + aPhase * 1.4);
          vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(rp, 1.0);
          vNormalView = normalize(normalMatrix * mat3(instanceMatrix) * rn);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vColor;
        varying float vClaimed;
        varying float vPulse;

        void main() {
          float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
          float fresnel = pow(1.0 - ndv, 2.2);
          float facetLight = 0.45 + 0.55 * clamp(dot(normalize(vNormalView), normalize(vec3(0.4, 0.8, 0.45))), 0.0, 1.0);

          vec3 activeCol = vColor * (0.72 + 0.55 * facetLight) * vPulse + mix(vColor, vec3(1.0, 0.98, 0.90), 0.65) * (0.28 + fresnel * 0.85);
          vec3 dormantCol = vec3(0.11, 0.12, 0.16) * (0.60 + 0.65 * facetLight) + vec3(0.05, 0.06, 0.08) * fresnel;

          vec3 finalCol = mix(activeCol, dormantCol, clamp(vClaimed, 0.0, 1.0));
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `
    }));

    const relicInst = new THREE.InstancedMesh(relicGeo, relicMat, shrines.length);
    relicInst.name = 'castle_shrine_runic_crystals';
    relicInst.renderOrder = 3;
    for (let i = 0; i < shrines.length; i++) {
      const sh = shrines[i];
      const rotY = resolveYaw(sh);
      const rx = (sh.x || 0) + Math.sin(rotY) * 0.04;
      const rz = (sh.z || 0) + Math.cos(rotY) * 0.04;
      _dummy.position.set(rx, (sh.y || 0) + 1.66, rz);
      _dummy.rotation.set(0, rotY, 0);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      relicInst.setMatrixAt(i, _dummy.matrix);
    }
    relicInst.instanceMatrix.needsUpdate = true;
    group.add(relicInst);
    drawCalls++;
  }

  function setShrineClaimed(id, claimed = true) {
    if (!shrineClaimedAttr) return false;
    let idx = shrineIdToIdx.get(id);
    if (idx === undefined && typeof id === 'number' && id >= 0 && id < shrines.length) {
      idx = id;
    }
    if (idx === undefined) return false;
    shrineClaimedState[idx] = claimed ? 1.0 : 0.0;
    shrineClaimedAttr.needsUpdate = true;
    if (shrineLights[idx]) {
      shrineLights[idx].active = !claimed;
    }
    return true;
  }

  function isShrineClaimed(id) {
    let idx = shrineIdToIdx.get(id);
    if (idx === undefined && typeof id === 'number' && id >= 0 && id < shrines.length) {
      idx = id;
    }
    return idx !== undefined ? shrineClaimedState[idx] >= 0.5 : false;
  }

  function resetShrines() {
    if (!shrineClaimedAttr) return;
    shrineClaimedState.fill(0.0);
    shrineClaimedAttr.needsUpdate = true;
    for (let i = 0; i < shrineLights.length; i++) {
      shrineLights[i].active = true;
    }
  }

  function setLowSpec(enabled = false) {
    const low = Boolean(enabled);
    bannerSwayUniforms.uSwayAmp.value = low ? 0.040 : 0.088;
    if (stoneShrineMat) {
      stoneShrineMat.normalMap = low ? null : stoneNormal;
      stoneShrineMat.needsUpdate = true;
    }
    if (forgedDecorMat) {
      forgedDecorMat.normalMap = low ? null : ironNormal;
      forgedDecorMat.needsUpdate = true;
    }
    if (bannerMat && bannerNormalTex) {
      bannerMat.normalMap = low ? null : bannerNormalTex;
      bannerMat.needsUpdate = true;
    }
  }

  function update(_dt = 0.016, elapsed = 0) {
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    bannerSwayUniforms.uTime.value = t;
    if (shrineRelicUniforms) {
      shrineRelicUniforms.uTime.value = t;
    }
  }

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const fn of texCleanups) fn();
    texCleanups.length = 0;
    for (const g of localGeos) g.dispose?.();
    for (const m of localMats) m.dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    shrineColliders,
    alcoveColliders,
    colliders: [...shrineColliders, ...alcoveColliders],
    shrineLights,
    alcoveDecorCount: alcoveDecor.length,
    drawCalls,
    setShrineClaimed,
    isShrineClaimed,
    resetShrines,
    update,
    setLowSpec,
    dispose
  };
}
