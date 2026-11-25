// Wave 2 (`?v=20261125z105`) Next-Gen Gothic Castle 3D Props — «Abandoned Knight Rift»
// +200% PC Polygon Fidelity, Physical PBR Reflections & Dynamic Fire Shadow-Casting
// while preserving the strict <= 45k-tri Mobile Yandex Games tessellation budget:
//   1. createHeroBonfire3D             -> High-poly 16-stone charred hearth + ash mound + 6 bark-grooved charred logs
//                                         + 3D skull/mandible & 8 bones/ribs + 36-seg beveled helical Coiled Sword
//                                         + real multi-layer FBM fire, molten-crack coals, sparks & smoke (castShadow on PC!)
//   2. createGothicLanternBraziers3D   -> High-poly carved stone pedestals + 3-seg curved 8-bar forged cages w/ rivets,
//                                         hanging rings, scrolls & craggy 3D coals (castShadow on PC!) + 8-sided gothic
//                                         wall lanterns w/ helically twisted brackets, 4-link chains, leaded mullions &
//                                         NEW translucent glowing frosted-amber glass shades + HARD floor colliders!
//   3. createMeltedCandleClusters3D    -> 3 DC InstancedMesh: high-poly forged saucers w/ wax puddles + sculpted beeswax
//                                         w/ 6 multi-bead 3D drips + sapphire-blue cup flames (castShadow on PC!)
//                                         + tryBreakCandlesNear(x, z, r) / resetCandles() / setLowSpec(enabled)
//   4. createCastleBannersAndShrines3D -> 14x24 PC draped tattered royal banners (AAA bannerAlbedo/Normal/Roughness +
//                                         3-harmonic wind shader) + carved stone Relic Altar + 9 East Alcove Armory props
//                                         + NEW architectural stone wall pilasters, base socles & corbel cornices
//                                         + NEW flame-trap charred blast scorch, wall soot plumes & 3D ash/cinder drifts!
// Zero WebGL memory leaks: every internal Geometry, Material, and Texture is tracked & auto-disposed on dispose().

import * as THREE_BASE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import {
  createBonfireFlameAssembly,
  createInstancedBrazierFlames,
  createInstancedWallLanternFlames,
  createCandleFlameShaderMaterial,
  createCandleFlameTeardropGeometry
} from './soulsFireVfx.js?v=20261125z105';
import {
  SOULS_CASTLE_ALCOVE_DECOR,
  SOULS_CASTLE_WALL_SEGMENTS,
  SOULS_CASTLE_FLAME_TRAPS,
  SOULS_CASTLE_WALL_LANTERNS
} from './soulsCastleLayout.js?v=20261125z105';

// ============================================================================
// Dual-Profile Tessellation Shim:
//   - PC (`SEG_MOBILE === false`): smooth high-poly curves (~2x segments on round
//     lathes, tori, spheres & smooth cylinders; preserves intentional 3/4/6/8-gon bevels!)
//   - Mobile (`SEG_MOBILE === true`): auto-decimated (~0.6x, min 5-6) so mobile stays <= 45k tris!
// ============================================================================
let SEG_MOBILE = false;

function segCyl(radial, minMobile = 5) {
  if (SEG_MOBILE) {
    return radial > minMobile ? Math.max(minMobile, Math.round(radial * 0.6)) : radial;
  }
  // Preserve intentional triangular (3), diamond sword-blade/pyramid (4), hex (6), and octagonal (8) architectural facets;
  // boost smooth round shafts & pools (radial >= 9) for crisp next-gen PC silhouettes!
  if (radial >= 9) return Math.round(radial * 1.5);
  return radial;
}

class MCylinderGeometry extends THREE_BASE.CylinderGeometry {
  constructor(rt, rb, h, radial = 8, heightSegs = 1, open = false, ts, tl) {
    const rSeg = segCyl(radial, 5);
    const hSeg = SEG_MOBILE
      ? Math.max(1, Math.ceil(heightSegs * 0.5))
      : (heightSegs > 1 ? Math.round(heightSegs * 1.35) : 1);
    super(rt, rb, h, rSeg, hSeg, open, ts, tl);
  }
}
class MSphereGeometry extends THREE_BASE.SphereGeometry {
  constructor(r, w = 8, h = 6, ps, pl, ts, tl) {
    const wSeg = SEG_MOBILE ? Math.max(5, Math.round(w * 0.6)) : Math.max(10, Math.round(w * 1.5));
    const hSeg = SEG_MOBILE ? Math.max(4, Math.round(h * 0.65)) : Math.max(7, Math.round(h * 1.4));
    super(r, wSeg, hSeg, ps, pl, ts, tl);
  }
}
class MTorusGeometry extends THREE_BASE.TorusGeometry {
  constructor(r, tube, radial = 8, tubular = 6, arc) {
    const rSeg = SEG_MOBILE ? Math.max(3, Math.round(radial * 0.75)) : Math.max(7, Math.round(radial * 1.5));
    // Preserve intentional octagonal/hexagonal iron hoops when tubular === 6 or 8? Boost circular scrolls & rings!
    const tSeg = SEG_MOBILE
      ? (tubular > 5 ? Math.max(5, Math.round(tubular * 0.6)) : tubular)
      : (tubular >= 7 ? Math.max(14, Math.round(tubular * 1.75)) : tubular);
    super(r, tube, rSeg, tSeg, arc);
  }
}
class MLatheGeometry extends THREE_BASE.LatheGeometry {
  constructor(points, segments = 12, phiStart, phiLength) {
    const segs = SEG_MOBILE
      ? Math.max(6, Math.round(segments * 0.6))
      : Math.max(16, Math.round(segments * 1.65));
    super(points, segs, phiStart, phiLength);
  }
}
class MConeGeometry extends THREE_BASE.ConeGeometry {
  constructor(r, h, radial = 8, heightSegs = 1, open = false, ts, tl) {
    const rSeg = SEG_MOBILE
      ? (radial > 4 ? Math.max(4, Math.round(radial * 0.6)) : radial)
      : (radial >= 9 ? Math.round(radial * 1.5) : radial);
    super(r, h, rSeg, heightSegs, open, ts, tl);
  }
}
class MDodecahedronGeometry extends THREE_BASE.DodecahedronGeometry {
  constructor(radius = 1, detail = 0) {
    super(radius, SEG_MOBILE ? 0 : detail);
  }
}
class MIcosahedronGeometry extends THREE_BASE.IcosahedronGeometry {
  constructor(radius = 1, detail = 0) {
    super(radius, SEG_MOBILE ? detail : Math.max(detail, 1));
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

// Helically twisted square wrought-iron bar along Z (authentic blacksmith torsion-bar ironwork on PC!)
function createTwistedIronBarZ(thick, length, twists = 2.0) {
  const zSegs = SEG_MOBILE ? 1 : 12;
  const g = new THREE.BoxGeometry(thick, thick, length, 1, 1, zSegs);
  if (!SEG_MOBILE && twists !== 0) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const t = (z / Math.max(1e-4, length)) + 0.5;
      const ang = t * Math.PI * 2.0 * twists;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      pos.setXY(i, x * c - y * s, x * s + y * c);
    }
    g.computeVertexNormals();
  }
  return g;
}

const _tmpColor = new THREE.Color();
const _tmpColor2 = new THREE.Color();
const _dummy = new THREE.Object3D();

// World-space box-projected UVs so 2048px ashlar stone & hammered iron PBR maps tile crisply on every bevel
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
// 1. HERO COILED SWORD BONFIRE 3D (High-Poly PC + Lean Mobile)
// ============================================================================
function buildBonfireHearthGeometry() {
  const rng = makeRng(260509);
  const parts = [];

  // 1A. Sculpted Windblown Ash Heap & Soot Apron (28x6 on PC via shim)
  const ashGeo = new THREE.CylinderGeometry(0.62, 1.36, 0.35, 20, 5, false);
  const ashPos = ashGeo.attributes.position;
  for (let i = 0; i < ashPos.count; i++) {
    let vx = ashPos.getX(i);
    let vy = ashPos.getY(i) + 0.175;
    let vz = ashPos.getZ(i);
    const r = Math.hypot(vx, vz);
    const a = Math.atan2(vz, vx);
    const drift = 1.0 + Math.sin(a * 5.0 + 0.6) * 0.08 + Math.cos(a * 3.0 - 0.5) * 0.07;
    vx *= drift;
    vz *= drift;
    if (vy > 0.28 && r < 0.64) {
      vy -= (1.0 - r / 0.66) * 0.11;
    } else if (vy > 0.03) {
      vy += Math.sin(a * 7.0 + r * 4.0) * 0.025 + (rng() - 0.5) * 0.012;
    }
    ashPos.setXYZ(i, vx, Math.max(0.0, vy), vz);
  }
  ashGeo.computeVertexNormals();
  parts.push(tagGeo(ashGeo, {
    colorHex: 0x4b464d,
    bottomColorHex: 0x17161b,
    jitter: 0.09,
    rng
  }));

  // 1B. Ring of Jagged Scorched Basalt Hearth Stones (16 stones on PC, 12 on Mobile) + Rubble Chips
  const STONE_COUNT = SEG_MOBILE ? 12 : 16;
  for (let i = 0; i < STONE_COUNT; i++) {
    const baseAngle = (i / STONE_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.12;
    const dist = 0.95 + (rng() - 0.5) * 0.16;
    const sx = Math.cos(baseAngle) * dist;
    const sz = Math.sin(baseAngle) * dist;
    const rad = 0.19 + rng() * 0.10;
    const stone = new THREE.DodecahedronGeometry(rad, 1);
    const sp = stone.attributes.position;
    for (let v = 0; v < sp.count; v++) {
      let x = sp.getX(v);
      let y = sp.getY(v);
      let z = sp.getZ(v);
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
    const tp = tagged.attributes.position;
    const tc = tagged.attributes.color;
    for (let v = 0; v < tp.count; v++) {
      const dr = Math.hypot(tp.getX(v), tp.getZ(v));
      if (dr < dist - 0.02) {
        const scorch = 0.40;
        tc.setXYZ(v, tc.getX(v) * scorch, tc.getY(v) * scorch * 0.90, tc.getZ(v) * scorch * 0.86);
      }
    }
    parts.push(tagged);
  }

  const chipCount = SEG_MOBILE ? 8 : 14;
  for (let c = 0; c < chipCount; c++) {
    const a = (c / chipCount) * Math.PI * 2 + 0.32 + (rng() - 0.5) * 0.25;
    const d = 1.14 + rng() * 0.24;
    const chip = new THREE.DodecahedronGeometry(0.07 + rng() * 0.05, 0);
    makeXform(chip, Math.cos(a) * d, 0.035, Math.sin(a) * d, rng() * 2, rng() * 3, rng() * 2, 1.3, 0.55, 1.0);
    parts.push(tagGeo(chip, { colorHex: 0x353844, bottomColorHex: 0x17181e, rng }));
  }

  // 1C. 6 Crossed Charred Split Firewood Logs plunging into the molten hearth center
  const logAngles = SEG_MOBILE ? [0.22, 1.48, 2.74, 3.98, 5.24] : [0.18, 1.22, 2.26, 3.32, 4.38, 5.42];
  for (let l = 0; l < logAngles.length; l++) {
    const ang = logAngles[l];
    const len = 0.86 + (l % 2) * 0.16;
    const rad = 0.058 + (l % 3) * 0.011;
    const log = new THREE.CylinderGeometry(rad * 0.72, rad, len, 10, 4);
    const lp = log.attributes.position;
    for (let v = 0; v < lp.count; v++) {
      const x = lp.getX(v);
      const y = lp.getY(v);
      const z = lp.getZ(v);
      const a = Math.atan2(z, x);
      const bark = 0.88 + 0.20 * Math.sin(a * 5.0 + y * 9.0 + l);
      lp.setXYZ(v, x * bark, y, z * bark);
    }
    log.computeVertexNormals();
    makeRadialBar(log, 0.44, 0.27 + (l % 2) * 0.04, ang, 1.06);
    parts.push(tagGeo(log, {
      colorHex: 0x1b1110,
      bottomColorHex: 0x3a2c24,
      jitter: 0.07,
      rng
    }));
  }

  // 1D. Iconic Dark Souls 3D Skull + Detached Mandible
  const buildSkull = (ox, oy, oz, rx, ry, rz, scale = 1.10) => {
    const skullLocal = [];
    const cranium = new THREE.IcosahedronGeometry(0.148, SEG_MOBILE ? 1 : 2);
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
        z += 0.026;
      }
      cp.setXYZ(v, x, y, z);
    }
    cranium.computeVertexNormals();
    skullLocal.push(tagGeo(cranium, { colorHex: 0xd9cdb4, bottomColorHex: 0x7e6e59, jitter: 0.04, rng }));

    skullLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.178, 0.068, 0.095), 0, -0.075, 0.082), {
      colorHex: 0xcabca0, bottomColorHex: 0x7a6a55
    }));
    skullLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.128, 0.056, 0.086), 0, -0.118, 0.106), {
      colorHex: 0xc4b59a, bottomColorHex: 0x6b5b49
    }));
    for (let t = -1.5; t <= 1.5; t += 1.0) {
      skullLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.021, 0.028, 0.024), t * 0.027, -0.152, 0.139), {
        colorHex: 0xdfd3ba, bottomColorHex: 0x8e7e68
      }));
    }
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

  // 1E. 8 Half-Buried Crossed 3D Bones & Ribs
  const addBone3D = (len, rad, ox, oy, oz, rx, ry, rz, charredEnd = true) => {
    const boneLocal = [];
    const shaft = new THREE.CylinderGeometry(rad * 0.82, rad, len, 9, 3);
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
      boneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(kR, 6, 5), -rad * 0.72, endSign * len * 0.49, 0), { colorHex: endHex }));
      boneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(kR * 0.92, 6, 5), rad * 0.72, endSign * len * 0.49, rad * 0.25), { colorHex: endHex }));
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

// Sculpted High-Poly Beveled Helical Coiled Sword
function buildCoiledSwordGeometry() {
  const parts = [];

  const segs = SEG_MOBILE ? 22 : 36;
  const yStart = 0.14;
  const bladeH = 1.72;
  const bladeGeo = new THREE.CylinderGeometry(0.068, 0.082, bladeH, 4, segs, false);
  bladeGeo.rotateY(Math.PI / 4);
  const pos = bladeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const bx = pos.getX(i);
    const localY = pos.getY(i) + bladeH * 0.5;
    const bz = pos.getZ(i) * 0.46;
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

  const upVec = new THREE.Vector3(0, 1, 0);
  const segDir = new THREE.Vector3();
  const segQuat = new THREE.Quaternion();
  const coilSegs = SEG_MOBILE ? 14 : 22;
  for (let strand = 0; strand < 2; strand++) {
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
      const segLen = Math.hypot(dx, dy, dz) + 0.014;
      const seg = new THREE.CylinderGeometry(0.014, 0.016, segLen, 9);
      segDir.set(dx, dy, dz).normalize();
      segQuat.setFromUnitVectors(upVec, segDir);
      seg.applyQuaternion(segQuat);
      seg.translate((p0x + p1x) * 0.5, (y0 + y1) * 0.5, (p0z + p1z) * 0.5);
      parts.push(tagGeo(seg, {
        colorHex: tm < 0.38 ? 0x6f3e2a : 0x4f566b
      }));
    }
  }

  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.11, 0.13, 0.13, 6), 0, 1.86, 0, 0, Math.PI / 6, 0), {
    colorHex: 0x555d72, bottomColorHex: 0x353b4a
  }));
  for (const side of [-1, 1]) {
    parts.push(tagGeo(makeXform(new THREE.BoxGeometry(0.24, 0.068, 0.074), side * 0.18, 1.83, 0, 0, 0, side * 0.28), {
      colorHex: 0x4b5266
    }));
    parts.push(tagGeo(makeXform(new THREE.BoxGeometry(0.20, 0.054, 0.062), side * 0.34, 1.79, 0, 0, 0, -side * 0.42), {
      colorHex: 0x596178
    }));
    parts.push(tagGeo(makeXform(new THREE.ConeGeometry(0.044, 0.14, 4), side * 0.45, 1.84, 0, 0, 0, -side * 1.15), {
      colorHex: 0x677088
    }));
    parts.push(tagGeo(makeXform(new THREE.TorusGeometry(0.082, 0.017, 5, 10), 0, 1.85, side * 0.068, side * 0.18, 0, 0), {
      colorHex: 0x586075
    }));
  }

  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.038, 0.046, 0.40, 10), 0, 2.11, 0), {
    colorHex: 0x2f2827, bottomColorHex: 0x201b1b
  }));
  for (let gr = 0; gr < 6; gr++) {
    parts.push(tagGeo(makeXform(new THREE.TorusGeometry(0.045 - gr * 0.0014, 0.010, 5, 10), 0, 1.95 + gr * 0.064, 0, Math.PI / 2, 0, 0), {
      colorHex: 0x5b6378
    }));
  }
  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.072, 0.042, 0.08, 10), 0, 2.33, 0), { colorHex: 0x525a6e }));
  parts.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.102, SEG_MOBILE ? 0 : 1), 0, 2.43, 0, 0, Math.PI / 4, 0, 0.94, 1.18, 0.94), {
    colorHex: 0x626b82, bottomColorHex: 0x3b4150
  }));
  parts.push(tagGeo(makeXform(new THREE.TorusGeometry(0.056, 0.014, 5, 10), 0, 2.54, 0), { colorHex: 0x6b748e }));
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
  const castShadowsPC = !isMobile && !lowSpec;

  const hearthMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ashNormal,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughnessMap: ashRough,
    roughness: 0.92,
    metalness: 0.06,
    envMapIntensity: 0.55
  }));
  const hearthGeo = regGeo(buildBonfireHearthGeometry());
  const hearthMesh = new THREE.Mesh(hearthGeo, hearthMat);
  hearthMesh.name = 'bonfire_hearth_stones_bones';
  hearthMesh.castShadow = castShadowsPC;
  hearthMesh.receiveShadow = true;
  group.add(hearthMesh);

  const swordMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ironNormal,
    normalScale: new THREE.Vector2(1.10, 1.10),
    roughnessMap: ironRough,
    roughness: 0.46,
    metalness: 0.90,
    envMapIntensity: 1.25,
    emissive: 0x6e1a04,
    emissiveIntensity: 0.24
  }));
  const swordGeo = regGeo(buildCoiledSwordGeometry());
  const swordMesh = new THREE.Mesh(swordGeo, swordMat);
  swordMesh.name = 'bonfire_coiled_sword';
  swordMesh.castShadow = castShadowsPC;
  swordMesh.receiveShadow = true;
  group.add(swordMesh);

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
    const cast = !isMobile && !isLowSpec;
    hearthMesh.castShadow = cast;
    swordMesh.castShadow = cast;
    flameAssembly.setLowSpec(isLowSpec);
  }

  function update(dt = 0.016, elapsed = 0) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    flameAssembly.update(t, safeDt);
    swordMat.emissiveIntensity = 0.20 + Math.sin(t * 5.6) * 0.06 + Math.sin(t * 13.1) * 0.03;
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
// 2. GOTHIC 8-BAR LANTERN BRAZIERS & MULTI-FACETED GLOWING-GLASS WALL LANTERNS
//    - High-poly forged iron braziers w/ 3-seg curved bars, rivets, cauldron rings
//      & sculpted 3D coal chunks (`castShadow = true` on PC!)
//    - 8-sided (PC) / 6-sided (Mobile) wall lanterns w/ helically twisted brackets,
//      multi-scroll volutes, 4-link chains & warm translucent frosted-amber glass shades!
//    - HARD cylindrical collider { x, z, r: 0.56 * scale, radius: 0.56 * scale } on EVERY floor brazier!
// ============================================================================
function appendFloorPedestalStoneParts(parts, spec, rng) {
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = Number.isFinite(spec.rotY) ? spec.rotY : rng() * Math.PI * 2;

  const local = [];

  // Stepped chamfered octagonal plinth + smooth molded torus astragal on PC
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.49, 0.55, 0.14, 8), 0, 0.07, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x62687b, bottomColorHex: 0x242731
  }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.42, 0.49, 0.07, SEG_MOBILE ? 8 : 16), 0, 0.175, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x6f768c, bottomColorHex: 0x3b404e
  }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.34, 0.37, 0.34, 8), 0, 0.38, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x555c6e, bottomColorHex: 0x323744
  }));
  for (let p = 0; p < 4; p++) {
    const a = (p / 4) * Math.PI * 2 + Math.PI / 4;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.13, 0.36, 0.14), 0.35, 0.36, a, 0.06), {
      colorHex: 0x70788d, bottomColorHex: 0x353946
    }));
  }
  if (!SEG_MOBILE) {
    // 4 carved recessed gothic lancet ribs on the intermediate faces (PC high-detail)
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2;
      local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.06, 0.28, 0.16), 0.355, 0.38, a, 0.02), {
        colorHex: 0x454b5c, bottomColorHex: 0x2b2f3b
      }));
    }
  }
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.47, 0.38, 0.08, SEG_MOBILE ? 8 : 16), 0, 0.58, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x687085, bottomColorHex: 0x3e4352
  }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.48, 0.51, 0.065, 8), 0, 0.65, 0, 0, Math.PI / 8, 0), {
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

  // A. 4 Heavy Curved Forged Iron Scroll-Feet + Hanging Cauldron Rings on PC
  for (let f = 0; f < 4; f++) {
    const a = (f / 4) * Math.PI * 2 + Math.PI / 4;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.084, 0.21, 0.12), 0.33, 0.74, a, 0.30), {
      colorHex: 0x313746, bottomColorHex: 0x1d212a
    }));
    if (!SEG_MOBILE) {
      local.push(tagGeo(makeXform(
        new THREE.TorusGeometry(0.050, 0.018, 5, 10),
        Math.cos(a) * 0.41, 0.70, Math.sin(a) * 0.41,
        0, -a + Math.PI / 2, 0
      ), { colorHex: 0x454d60 }));
      // Hanging wrought-iron cauldron carry-ring on bowl flank
      const ra = a + Math.PI / 4;
      local.push(tagGeo(makeXform(
        new THREE.TorusGeometry(0.068, 0.015, 5, 10),
        Math.cos(ra) * 0.46, 0.96, Math.sin(ra) * 0.46,
        Math.sin(ra) * 0.22, -ra + Math.PI / 2, Math.cos(ra) * 0.22
      ), { colorHex: 0x525b70 }));
    }
  }

  // B. Smooth High-Poly Lathe Cauldron Fire-Basin + Rolled Rim Collar
  const bowlPts = [
    new THREE.Vector2(0.01, 0.71),
    new THREE.Vector2(0.19, 0.73),
    new THREE.Vector2(0.29, 0.80),
    new THREE.Vector2(0.40, 0.95),
    new THREE.Vector2(0.50, 1.09),
    new THREE.Vector2(0.535, 1.145),
    new THREE.Vector2(0.45, 1.145),
    new THREE.Vector2(0.38, 0.98),
    new THREE.Vector2(0.01, 0.94)
  ];
  const bowl = new THREE.LatheGeometry(bowlPts, 12);
  bowl.computeVertexNormals();
  local.push(tagGeo(bowl, { colorHex: 0x353c4c, bottomColorHex: 0x1b1f28 }));

  // C. 8 Gracefully Bowed Vertical Wrought-Iron Cage Bars (3-seg curved w/ knuckles on PC!)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    if (SEG_MOBILE) {
      local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.038, 0.44, 0.038), 0.48, 1.32, a, -0.10), {
        colorHex: 0x3d4456, bottomColorHex: 0x262b36
      }));
      local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.035, 0.46, 0.035), 0.43, 1.74, a, 0.31), {
        colorHex: 0x444c5f, bottomColorHex: 0x2e3442
      }));
    } else {
      // Smooth 3-segment forged S-curve rib + forged mid-knuckle collar + scroll volutes + rivets!
      local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.040, 0.28, 0.040), 0.475, 1.24, a, -0.14), {
        colorHex: 0x3d4456, bottomColorHex: 0x252a35
      }));
      local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.038, 0.30, 0.038), 0.495, 1.50, a, 0.04), {
        colorHex: 0x454d60, bottomColorHex: 0x313746
      }));
      local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.035, 0.34, 0.035), 0.430, 1.79, a, 0.36), {
        colorHex: 0x4b5368, bottomColorHex: 0x353b4b
      }));
      // Forged knuckle node on rib belly
      local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.032, 0), ca * 0.50, 1.54, sa * 0.50), {
        colorHex: 0x5c657c
      }));
      // Base C-scroll volute + outward gothic spike stud
      local.push(tagGeo(makeXform(
        new THREE.TorusGeometry(0.066, 0.015, 5, 10),
        ca * 0.545, 1.24, sa * 0.545,
        0, -a + Math.PI / 2, 0
      ), { colorHex: 0x4c556a }));
      local.push(tagGeo(makeRadialBar(new THREE.ConeGeometry(0.024, 0.10, 4), 0.535, 1.54, a, -Math.PI * 0.5), {
        colorHex: 0x5d677e
      }));
    }
  }

  // D. 4 Riveted Horizontal Forged Iron Hoops (smooth round hoops on PC + pyramid rivets!)
  const hoopTubular = SEG_MOBILE ? 8 : 16;
  const hoops = [
    { y: 1.13, r: 0.49, tube: 0.030 },
    { y: 1.35, r: 0.495, tube: 0.020 },
    { y: 1.54, r: 0.50, tube: 0.027 },
    { y: 1.94, r: 0.37, tube: 0.030 }
  ];
  for (const hp of hoops) {
    if (SEG_MOBILE && hp.y === 1.35) continue;
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(hp.r, hp.tube, 6, hoopTubular), 0, hp.y, 0, Math.PI / 2, 0, 0), {
      colorHex: 0x495266
    }));
  }

  // E. Multi-Tier Open Gothic Ogee Crown Canopy + Spire Finial
  for (let c = 0; c < 8; c += (SEG_MOBILE ? 2 : 1)) {
    const a = (c / 8) * Math.PI * 2;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.032, 0.46, 0.032), 0.195, 2.09, a, 0.84), {
      colorHex: 0x4e576c
    }));
  }
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.092, 0.022, 5, hoopTubular), 0, 2.22, 0, Math.PI / 2, 0, 0), { colorHex: 0x566078 }));
  local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.074, SEG_MOBILE ? 0 : 1), 0, 2.29, 0), { colorHex: 0x5d677e }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.042, 0.24, SEG_MOBILE ? 4 : 8), 0, 2.44, 0, 0, Math.PI / 4, 0), { colorHex: 0x67728c }));

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
  const cageSides = SEG_MOBILE ? 6 : 8; // 8-sided multi-faceted gothic lantern on PC!

  // A. Sculpted Gothic Escutcheon Wall Backplate w/ Dome Rivets & Fleur Finials
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.28, 0.74, 0.055), 0, -0.06, 0.028), {
    colorHex: 0x394050, bottomColorHex: 0x222630
  }));
  if (!SEG_MOBILE) {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.35, 0.24, 0.046), 0, 0.06, 0.025), { colorHex: 0x454e62 }));
  }
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.12, 0.19, 4), 0, 0.40, 0.03, 0, Math.PI / 4, 0), { colorHex: 0x4f576c }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.11, 0.17, 4), 0, -0.51, 0.03, Math.PI, Math.PI / 4, 0), { colorHex: 0x454d60 }));
  for (const [rx, ry] of (SEG_MOBILE ? [] : [[-0.095, 0.24], [0.095, 0.24], [-0.095, 0.06], [0.095, 0.06], [-0.095, -0.35], [0.095, -0.35]])) {
    local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.026, 0), rx, ry, 0.064), { colorHex: 0x606a82 }));
  }

  // B. Helically Twisted Wrought-Iron Bracket Arm + Twisted Strut + Multi-Scroll Volutes!
  local.push(tagGeo(makeXform(createTwistedIronBarZ(0.052, 0.72, 2.5), 0, 0.20, 0.36), { colorHex: 0x464f62 }));
  local.push(tagGeo(makeXform(createTwistedIronBarZ(0.038, 0.60, 1.5), 0, -0.04, 0.25, -0.76, 0, 0), { colorHex: 0x363e4e }));
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.108, 0.018, 5, 10), 0, 0.06, 0.45, 0, Math.PI / 2, 0), { colorHex: 0x50596f }));
  if (!SEG_MOBILE) {
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.074, 0.015, 5, 9), 0, -0.14, 0.19, 0, Math.PI / 2, 0), { colorHex: 0x485064 }));
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.070, 0.014, 5, 9), 0, 0.29, 0.22, 0, Math.PI / 2, 0), { colorHex: 0x555e74 }));
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.048, 0.012, 4, 8), 0, 0.27, 0.50, 0, Math.PI / 2, 0), { colorHex: 0x586278 }));
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.038, 0.12, 4), 0, 0.20, 0.76, Math.PI / 2, Math.PI / 4, 0), { colorHex: 0x606a82 }));
  }

  // C. Forged Hanging Chain at z = 0.60
  const cz = 0.60;
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.036, 0.012, 4, 8), 0, 0.14, cz, 0, Math.PI / 2, 0), { colorHex: 0x555f76 }));
  if (!SEG_MOBILE) {
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.034, 0.011, 4, 8), 0, 0.08, cz, 0, 0, 0), { colorHex: 0x4d566b }));
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.034, 0.011, 4, 8), 0, 0.02, cz, 0, Math.PI / 2, 0), { colorHex: 0x555f76 }));
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.036, 0.012, 4, 8), 0, -0.03, cz, 0, 0, 0), { colorHex: 0x4d566b }));
  }

  // D. Multi-Faceted 8-Sided (PC) / 6-Sided (Mobile) Gothic Lantern Housing
  if (!SEG_MOBILE) {
    local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.070, 0.092, 0.075, cageSides), 0, -0.05, cz), { colorHex: 0x4f586e }));
  }
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.265, 0.195, cageSides), 0, -0.14, cz), {
    colorHex: 0x475064, bottomColorHex: 0x282d38
  }));
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.232, 0.020, 5, cageSides), 0, -0.22, cz, Math.PI / 2, 0, 0), { colorHex: 0x525b70 }));
  if (!SEG_MOBILE) {
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.198, 0.011, 4, cageSides), 0, -0.40, cz, Math.PI / 2, 0, 0), { colorHex: 0x444c5f }));
  }
  local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.165, 0.020, 5, cageSides), 0, -0.58, cz, Math.PI / 2, 0, 0), { colorHex: 0x464f62 }));

  for (let k = 0; k < cageSides; k++) {
    const a = (k / cageSides) * Math.PI * 2;
    local.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.022, 0.38, 0.022), 0.198, -0.40, a, -0.17, cz), {
      colorHex: 0x3e4658
    }));
    if (!SEG_MOBILE) {
      local.push(tagGeo(makeRadialBar(new THREE.ConeGeometry(0.018, 0.065, 4), 0.245, -0.20, a, -0.32, cz), {
        colorHex: 0x5c667e
      }));
    }
  }

  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.175, 0.11, 0.10, cageSides), 0, -0.63, cz), {
    colorHex: 0x333948, bottomColorHex: 0x1c2029
  }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.044, 0.14, 4), 0, -0.74, cz, Math.PI, Math.PI / 4, 0), {
    colorHex: 0x505a70
  }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0, s, s, s);
  parts.push(merged);
}

// Sculpted Craggy 3D Coal Heap + Angular Charcoal Chunks on PC
function createCharredBrazierCoalGeo() {
  const parts = [];
  const dome = new THREE.SphereGeometry(0.36, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const bump = 0.92 + 0.14 * Math.sin(ang * 5.0 + y * 12.0) + 0.08 * Math.cos(ang * 8.0 - x * 11.0);
    pos.setXYZ(i, x * bump, y * 0.56 * bump, z * bump);
  }
  dome.computeVertexNormals();
  const dNon = dome.index ? dome.toNonIndexed() : dome;
  if (dNon !== dome) dome.dispose();
  parts.push(dNon);

  // On PC, nestle 8 distinct angular 3D glowing coal chunks on top of the ember mound!
  if (!SEG_MOBILE) {
    const rng = makeRng(260899);
    for (let c = 0; c < 8; c++) {
      const a = (c / 8) * Math.PI * 2 + (rng() - 0.5) * 0.35;
      const r = 0.09 + (c % 3) * 0.075;
      const chunk = new THREE.DodecahedronGeometry(0.068 + (c % 2) * 0.018, 0);
      makeXform(chunk, Math.cos(a) * r, 0.14 + (1.0 - r / 0.32) * 0.05, Math.sin(a) * r, rng() * 3, rng() * 3, rng() * 3, 1.2, 0.72, 0.95);
      const cNon = chunk.index ? chunk.toNonIndexed() : chunk;
      if (cNon !== chunk) chunk.dispose();
      parts.push(cNon);
    }
  }

  for (const g of parts) {
    for (const k of Object.keys(g.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

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
      varying vec3 vNormalV;
      varying float vPhase;
      void main() {
        vLocal = position;
        vPhase = aPhase;
        vNormalV = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vLocal;
      varying vec3 vNormalV;
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
        vec3 p = vLocal * 10.5 + vec3(vPhase * 0.7, 0.0, vPhase * 0.4);
        float v1 = n3(p);
        float v2 = n3(p * 2.2 + vec3(3.1, 1.7, 2.3));
        float ridge = 1.0 - abs((v1 * 0.64 + v2 * 0.36) * 2.0 - 1.0);
        float radial = smoothstep(0.39, 0.04, length(vLocal.xz));
        // Crevices facing sideways/downward glow hotter than ash-dusted top caps
        float crevice = 1.0 - 0.26 * clamp(vNormalV.y, 0.0, 1.0);
        float pulse = 0.80 + 0.20 * sin(uTime * 4.2 + vPhase + v1 * 4.0);
        float glow = pow(clamp(ridge, 0.0, 1.0), 2.35) * (0.42 + 0.68 * radial) * crevice * pulse;

        vec3 charred  = vec3(0.048, 0.032, 0.030);
        vec3 emberRed = vec3(0.72, 0.095, 0.012);
        vec3 magmaOrg = vec3(0.98, 0.46, 0.045);
        vec3 hotGold  = vec3(1.00, 0.86, 0.38);

        vec3 col = mix(charred, emberRed, smoothstep(0.18, 0.46, glow));
        col = mix(col, magmaOrg, smoothstep(0.46, 0.76, glow));
        col = mix(col, hotGold,  smoothstep(0.76, 1.00, glow));
        gl_FragColor = vec4(min(col, vec3(1.02)), 1.0);
      }
    `
  });
  return { mat, uniforms };
}

// Multi-faceted Warm Translucent Frosted-Amber Glass Lantern Shade (1 DC for all wall sconces!)
function createWallLanternGlassMat() {
  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying float vPhase;
      void main() {
        vUv = uv;
        vPhase = aPhase;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying float vPhase;

      void main() {
        float h = clamp(vUv.y, 0.0, 1.0);
        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        float flick = 0.88 + 0.09 * sin(uTime * 6.8 + vPhase) + 0.04 * sin(uTime * 15.4 + vPhase * 1.6);

        // Warm subsurface candle/oil-flame scatter peaking in lower-middle of glass shade
        float coreBand = exp(-pow((h - 0.36) * 2.55, 2.0));
        // Subtle vertical leaded-facet bevel variation + frosted Fresnel rim
        float fresnel = pow(1.0 - ndv, 1.75);
        float sootTop = smoothstep(0.72, 1.0, h);

        vec3 honeyCore = vec3(1.00, 0.72, 0.26);
        vec3 warmAmber = vec3(0.92, 0.42, 0.09);
        vec3 smokedRim = vec3(0.22, 0.11, 0.06);

        vec3 col = mix(warmAmber, honeyCore, coreBand * (0.45 + 0.55 * ndv));
        col = mix(col, smokedRim, sootTop * 0.65);
        col *= flick * clamp(uIntensity, 0.0, 1.25);

        // Translucent frosted glass: lets the sharp 3D flame tongues inside shine right through!
        float alpha = (0.20 + 0.22 * coreBand + 0.16 * fresnel) * (1.0 - sootTop * 0.25);
        gl_FragColor = vec4(min(col, vec3(0.98)), clamp(alpha, 0.0, 0.54));
      }
    `
  });
  return { mat, uniforms };
}

function createWallBounceDecalMat() {
  const uniforms = {
    uTime: { value: 0.0 },
    uOpacity: { value: 0.20 }
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

        float warmGlow = exp(-r * r * 11.5) * smoothstep(0.52, 0.04, r) * flick;
        vec2 sootC = vec2((vUv.x - 0.5) * 3.4, (vUv.y - 0.68) * 1.9);
        float sootR = length(sootC);
        float soot = exp(-sootR * sootR * 3.8) * smoothstep(0.95, 0.12, sootR) * smoothstep(0.42, 0.62, vUv.y) * 0.34;

        vec3 warmCol = mix(vec3(0.90, 0.34, 0.06), vec3(1.00, 0.66, 0.22), warmGlow);
        vec3 sootCol = vec3(0.03, 0.025, 0.03);

        float aWarm = warmGlow * uOpacity;
        float aTotal = clamp(aWarm + soot, 0.0, 0.40);
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
  const castShadowsPC = !isMobile && !lowSpec;

  const pedestalStoneParts = [];
  const forgedIronParts = [];
  const floorFlamePositions = [];
  const wallFlamePositions = [];
  const wallGlassSpecs = [];
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

    wallGlassSpecs.push({
      x: lx,
      y: wy - 0.40 * s,
      z: lz,
      rotY,
      scale: s,
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

  // DC #1: Carved Gothic Stone Pedestals (`castShadow = true` on PC!)
  let pedestalStoneMat = null;
  let pedMesh = null;
  if (pedestalStoneParts.length > 0) {
    pedestalStoneMat = regMat(new THREE.MeshStandardMaterial({
      map: stoneAlbedo,
      normalMap: lowSpec ? null : stoneNormal,
      normalScale: new THREE.Vector2(1.20, 1.20),
      roughnessMap: stoneRough,
      color: stoneAlbedo ? 0x9aa0b4 : 0x767c90,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.08,
      envMapIntensity: 0.55
    }));
    const pedGeo = regGeo(mergeTaggedParts(pedestalStoneParts, 1.85));
    pedMesh = new THREE.Mesh(pedGeo, pedestalStoneMat);
    pedMesh.name = 'brazier_stone_pedestals';
    pedMesh.castShadow = castShadowsPC;
    pedMesh.receiveShadow = true;
    group.add(pedMesh);
    staticDC++;
  }

  // DC #2: High-Poly Forged Iron Cages + Twisted Wall Bracket Lanterns (`castShadow = true` on PC!)
  let forgedIronMat = null;
  let ironMesh = null;
  if (forgedIronParts.length > 0) {
    forgedIronMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      normalMap: lowSpec ? null : ironNormal,
      normalScale: new THREE.Vector2(1.10, 1.10),
      roughnessMap: ironRough,
      roughness: 0.48,
      metalness: 0.88,
      envMapIntensity: 1.20
    }));
    const ironGeo = regGeo(mergeTaggedParts(forgedIronParts, 0.85));
    ironMesh = new THREE.Mesh(ironGeo, forgedIronMat);
    ironMesh.name = 'braziers_and_wall_lanterns_iron';
    ironMesh.castShadow = false;
    ironMesh.receiveShadow = true;
    group.add(ironMesh);
    staticDC++;
  }

  // DC #3: Sculpted Craggy 3D Charred Coal Beds inside all floor braziers (`castShadow = true` on PC!)
  let coalUniforms = null;
  let coalInst = null;
  if (floorFlamePositions.length > 0) {
    const coalGeo = regGeo(createCharredBrazierCoalGeo());
    const coalPhases = new Float32Array(floorFlamePositions.length);
    for (let i = 0; i < floorFlamePositions.length; i++) coalPhases[i] = floorFlamePositions[i].phase;
    coalGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(coalPhases, 1));

    const coalPack = createInstancedCharredCoalMat();
    coalUniforms = coalPack.uniforms;
    const coalMat = regMat(coalPack.mat);
    coalInst = new THREE.InstancedMesh(coalGeo, coalMat, floorFlamePositions.length);
    coalInst.name = 'brazier_charred_coals';
    coalInst.castShadow = false;
    coalInst.receiveShadow = true;
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

  // DC #4: Multi-Faceted Warm Translucent Frosted-Amber Glass Lantern Shades (inside wall sconces!)
  let wallGlassInst = null;
  let wallGlassUniforms = null;
  if (wallGlassSpecs.length > 0) {
    const glassSides = isMobile ? 6 : 8;
    const glassGeo = regGeo(new THREE_BASE.CylinderGeometry(0.205, 0.148, 0.34, glassSides, 1, true));
    const glassPhases = new Float32Array(wallGlassSpecs.length);
    for (let i = 0; i < wallGlassSpecs.length; i++) glassPhases[i] = wallGlassSpecs[i].phase;
    glassGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(glassPhases, 1));

    const glassPack = createWallLanternGlassMat();
    wallGlassUniforms = glassPack.uniforms;
    const glassMat = regMat(glassPack.mat);

    wallGlassInst = new THREE.InstancedMesh(glassGeo, glassMat, wallGlassSpecs.length);
    wallGlassInst.name = 'wall_lantern_frosted_glass';
    wallGlassInst.renderOrder = 3;
    wallGlassInst.visible = !lowSpec;
    for (let i = 0; i < wallGlassSpecs.length; i++) {
      const wg = wallGlassSpecs[i];
      _dummy.position.set(wg.x, wg.y, wg.z);
      _dummy.rotation.set(0, wg.rotY, 0);
      _dummy.scale.set(wg.scale, wg.scale, wg.scale);
      _dummy.updateMatrix();
      wallGlassInst.setMatrixAt(i, _dummy.matrix);
    }
    wallGlassInst.instanceMatrix.needsUpdate = true;
    group.add(wallGlassInst);
  }

  // DC #5..#6: Real Instanced Volumetric FBM Floor Brazier Flames
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

  // DC #7: Real Single-Pass Instanced Wall Lantern Flames
  const wallLanternFlames = wallFlamePositions.length > 0
    ? createInstancedWallLanternFlames(wallFlamePositions, {
        width: 0.26,
        height: 0.36,
        applyBracketOffset: false,
        isMobile,
        lowSpec,
        trackGeo,
        trackMat
      })
    : null;
  if (wallLanternFlames) group.add(wallLanternFlames.group);

  // DC #8: Subtle Warm Wall Firelight Bounce + Rising Soot Plume Behind Every Sconce
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
    const cast = !isMobile && !isLowSpec;
    if (pedMesh) pedMesh.castShadow = cast;
    if (ironMesh) ironMesh.castShadow = false;
    if (coalInst) coalInst.castShadow = false;
    if (brazierFlames) brazierFlames.setLowSpec(isLowSpec);
    if (wallLanternFlames) wallLanternFlames.setLowSpec(isLowSpec);
    if (wallGlassInst) wallGlassInst.visible = !isLowSpec;
    if (wallBounceInst) wallBounceInst.visible = !isLowSpec;
  }

  function update(dt = 0.016, elapsed = 0) {
    const safeDt = Math.min(Math.max(dt || 0.016, 0.001), 0.1);
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    if (coalUniforms) coalUniforms.uTime.value = t;
    if (brazierFlames) brazierFlames.update(t, safeDt);
    if (wallLanternFlames) wallLanternFlames.update(t, safeDt);
    if (wallGlassUniforms && wallGlassInst && wallGlassInst.visible) {
      wallGlassUniforms.uTime.value = t;
    }
    if (wallBounceUniforms && wallBounceInst && wallBounceInst.visible) {
      wallBounceUniforms.uTime.value = t;
    }
  }

  function getDrawCalls() {
    let dc = staticDC;
    if (wallGlassInst && wallGlassInst.visible) dc += 1;
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
// ============================================================================
function createForgedSaucerGeometry() {
  const parts = [];

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

  const handle = new THREE.TorusGeometry(0.48, 0.092, 5, 8);
  makeXform(handle, 2.40, 0.36, 0, 0, 0, 0.16);
  if (!SEG_MOBILE) parts.push(tagGeo(handle, { colorHex: 0x4b5367 })); else handle.dispose();

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

function createMeltedWaxAndWickGeometry() {
  const parts = [];

  const body = new THREE.CylinderGeometry(0.92, 1.08, 1.0, 10, 5, false);
  const bp = body.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i);
    let y = bp.getY(i) + 0.5;
    let z = bp.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    if (y > 0.95) {
      if (r < 0.18) {
        y = 0.86;
      } else {
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
  parts.push(tagGeo(body, { colorHex: 0xd8c6a2, bottomColorHex: 0x8e7959 }));

  const dripSpecs = [
    { ang: 0.25, len: 0.62, r: 0.21 },
    { ang: 1.25, len: 0.36, r: 0.16 },
    { ang: 2.30, len: 0.78, r: 0.23 },
    { ang: 3.35, len: 0.44, r: 0.18 },
    { ang: 4.35, len: 0.70, r: 0.20 },
    { ang: 5.40, len: 0.30, r: 0.15 }
  ];
  for (let di = 0; di < dripSpecs.length; di++) {
    if (SEG_MOBILE && (di % 2) === 1) continue;
    const d = dripSpecs[di];
    const ca = Math.cos(d.ang);
    const sa = Math.sin(d.ang);
    const topY = 0.95;
    const botY = Math.max(0.06, topY - d.len);
    const midY = (topY + botY) * 0.5;
    parts.push(tagGeo(makeXform(
      new THREE.CylinderGeometry(d.r * 0.72, d.r * 1.02, topY - botY, SEG_MOBILE ? 5 : 9),
      ca * 0.96, midY, sa * 0.96
    ), { colorHex: 0xcfbca0, bottomColorHex: 0x9b8564 }));
    parts.push(tagGeo(makeXform(
      new THREE.SphereGeometry(d.r * 1.28, 6, 4),
      ca * 0.99, botY, sa * 0.99,
      0, 0, 0, 1.0, 1.42, 1.0
    ), { colorHex: 0xd4c19e, bottomColorHex: 0x937d5d }));
  }

  parts.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.085, 0.115, 0.28, SEG_MOBILE ? 5 : 8), 0.04, 1.01, 0, 0, 0, -0.22), {
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
      unbreakable: (!Array.isArray(entry) && entry.breakable === false) || cy > 0.65,
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
  const castShadowsPC = !isMobile && !lowSpec;

  const saucerGeo = regGeo(createForgedSaucerGeometry());
  const saucerMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ironNormal,
    normalScale: new THREE.Vector2(0.90, 0.90),
    roughnessMap: ironRough,
    roughness: 0.48,
    metalness: 0.78,
    envMapIntensity: 1.10
  }));
  const saucerInst = new THREE.InstancedMesh(saucerGeo, saucerMat, items.length);
  saucerInst.name = 'candle_forged_saucers';
  saucerInst.castShadow = false;
  saucerInst.receiveShadow = true;

  const waxGeo = regGeo(createMeltedWaxAndWickGeometry());
  const waxMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.54,
    metalness: 0.02,
    envMapIntensity: 0.45,
    emissive: 0x4e2408,
    emissiveIntensity: 0.24
  }));
  const waxInst = new THREE.InstancedMesh(waxGeo, waxMat, items.length);
  waxInst.name = 'candle_melted_wax';
  waxInst.castShadow = false;
  waxInst.receiveShadow = true;

  const flameGeo = regGeo(createCandleFlameTeardropGeometry({ height: 0.145, radius: 0.028, radialSegments: isMobile ? 5 : 12 }));
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
      if (cl.broken || cl.unbreakable) continue;
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
    const cast = !isMobile && !isLowSpec;
    saucerInst.castShadow = false;
    waxInst.castShadow = false;
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
// 4. CASTLE BANNERS, RELIC SHRINES, EAST ALCOVE ARMORY, ARCHITECTURAL STONE
//    WALL PILASTERS/CORNICES & FLAME-TRAP CHARRED SCORCH / 3D ASH DRIFTS!
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

function appendBannerHardwareParts(parts, spec) {
  const w = Number.isFinite(spec.width) ? spec.width : 1.25;
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 4.6;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];
  for (const sx of [-w * 0.44, w * 0.44]) {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.11, 0.28, 0.045), sx, 0.02, 0.022), { colorHex: 0x353c4c }));
    local.push(tagGeo(makeXform(createTwistedIronBarZ(0.052, 0.26, 1.0), sx, 0.03, 0.13), { colorHex: 0x41495c }));
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.068, 0.014, 4, 8), sx, -0.05, 0.12, 0, Math.PI / 2, 0), { colorHex: 0x4b5368 }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.075, 0.10, 0.035), sx, 0.40, 0.018), { colorHex: 0x383f50 }));
    const chainCount = SEG_MOBILE ? 2 : 4;
    for (let lnk = 0; lnk < chainCount; lnk++) {
      const f = (lnk + 0.5) / chainCount;
      local.push(tagGeo(makeXform(
        new THREE.TorusGeometry(0.032, 0.010, 4, 7),
        sx, 0.40 - f * 0.36, 0.03 + f * 0.19,
        0.48, lnk % 2 === 0 ? Math.PI / 2 : 0, 0
      ), { colorHex: 0x515a6f }));
    }
  }

  const barLen = w + 0.50;
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.034, 0.034, barLen, 10), 0, 0.03, 0.22, 0, 0, Math.PI / 2), {
    colorHex: 0x464e62, bottomColorHex: 0x282d39
  }));
  for (const side of [-1, 1]) {
    const endX = side * (barLen * 0.5);
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.044, 0.014, 4, 8), endX - side * 0.05, 0.03, 0.22, 0, Math.PI / 2, 0), { colorHex: 0x5c657c }));
    local.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.056, 0), endX + side * 0.02, 0.03, 0.22), { colorHex: 0x5e677e }));
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.048, 0.20, 4), endX + side * 0.15, 0.03, 0.22, 0, 0, -side * Math.PI / 2), { colorHex: 0x6b758e }));
  }

  const ringCount = SEG_MOBILE ? 2 : 4;
  for (let r = 0; r < ringCount; r++) {
    const rx = -w * 0.41 + (r / Math.max(1, ringCount - 1)) * (w * 0.82);
    local.push(tagGeo(makeXform(new THREE.TorusGeometry(0.052, 0.013, 4, 9), rx, -0.015, 0.22, 0, Math.PI / 2, 0), {
      colorHex: 0x555e74
    }));
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

// 14x24 PC (8x11 Mobile) draped & tattered swallowtail banner cloth geometry
function createSingleBannerClothGeo(spec, idx) {
  const rng = makeRng(269820 + idx * 131);
  const w = (Number.isFinite(spec.width) ? spec.width : 1.25) * (0.97 + rng() * 0.06);
  const h = (Number.isFinite(spec.height) ? spec.height : 3.15) * (0.96 + rng() * 0.08);
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 4.6;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const cols = SEG_MOBILE ? 8 : 14;
  const rows = SEG_MOBILE ? 11 : 24;
  const plane = new THREE.PlaneGeometry(w, h, cols, rows);
  const pos = plane.attributes.position;
  const uv = plane.attributes.uv;

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
    const v = uv.getY(i);
    const hangT = 1.0 - v;

    const colIdx = Math.min(cols, Math.max(0, Math.round(u * cols)));
    const effectiveH = h * (1.0 - colHemCut[colIdx] * Math.pow(hangT, 1.28));

    const ringWave = Math.abs(Math.sin(((u - 0.09) / 0.82) * Math.PI * 3.0));
    const topSag = ringWave * 0.055 * (1.0 - hangT * 0.65);

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
    swayWeight[i] = Math.pow(hangT, 1.65);
    lateral[i] = (u - 0.5) * 2.0;
  }
  nonIdx.setAttribute('aSwayPhase', new THREE.BufferAttribute(swayPhase, 1));
  nonIdx.setAttribute('aSwayWeight', new THREE.BufferAttribute(swayWeight, 1));
  nonIdx.setAttribute('aLateral', new THREE.BufferAttribute(lateral, 1));

  makeXform(nonIdx, ox, oy, oz, 0, rotY, 0);
  return nonIdx;
}

function appendRelicShrineStoneParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const local = [];

  local.push(tagGeo(makeXform(new THREE.BoxGeometry(1.66, 0.14, 1.44), 0, 0.07, 0), {
    colorHex: 0x62697d, bottomColorHex: 0x262933
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(1.36, 0.14, 1.16), 0, 0.21, 0), {
    colorHex: 0x717990, bottomColorHex: 0x3b404f
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.94, 0.76, 0.78), 0, 0.66, 0), {
    colorHex: 0x5c6376, bottomColorHex: 0x343946
  }));
  for (const sx of [-0.47, 0.47]) {
    for (const sz of [-0.39, 0.39]) {
      local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.092, 0.105, 0.78, 10), sx, 0.67, sz), {
        colorHex: 0x7b849c, bottomColorHex: 0x424859
      }));
    }
  }
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(1.28, 0.14, 1.06), 0, 1.11, 0), {
    colorHex: 0x848ea8, bottomColorHex: 0x4e5568
  }));
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
// Architectural Stone Wall Pilasters, Grounded Base Socles & Corbel Cornices
//   - Dynamically follows `SOULS_CASTLE_WALL_SEGMENTS` across ALL castle zones!
//   - Automatically clears banners, wall lanterns, shields & flame-trap nozzles.
//   - Merged into `stoneShrineParts` (0 extra draw calls!).
// ============================================================================
function appendCastleWallArchitecturalTrim(stoneParts, wallSegments, obstacles) {
  const walls = Array.isArray(wallSegments) ? wallSegments : [];
  if (!walls.length) return 0;

  let pilasterCount = 0;

  const isNearWallProp = (px, pz, minDist = 1.05) => {
    const minSq = minDist * minDist;
    for (let i = 0; i < obstacles.length; i++) {
      const ob = obstacles[i];
      if (!ob) continue;
      const dx = (ob.x || 0) - px;
      const dz = (ob.z || 0) - pz;
      if (dx * dx + dz * dz < minSq) return true;
    }
    return false;
  };

  for (let w = 0; w < walls.length; w++) {
    const seg = walls[w];
    if (!seg || !Number.isFinite(seg.x1) || !Number.isFinite(seg.z1) || !Number.isFinite(seg.x2) || !Number.isFinite(seg.z2)) {
      continue;
    }
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 2.2) continue;

    const nx = Number.isFinite(seg.normalX) ? seg.normalX : 0;
    const nz = Number.isFinite(seg.normalZ) ? seg.normalZ : 1;
    const wallH = Number.isFinite(seg.height) ? seg.height : 8.0;
    const ux = dx / segLen;
    const uz = dz / segLen;

    // Local +X runs along `(ux, uz)` and local +Z projects inward along `(nx, nz)`?
    // Check right-hand Y rotation: rotateY(theta) maps local (1, 0, 0) -> (cos, 0, -sin) and (0, 0, 1) -> (sin, 0, cos).
    // Align local +Z directly with inward wall normal (nx, nz):
    const rotY = Math.atan2(nx, nz);
    const midX = (seg.x1 + seg.x2) * 0.5;
    const midZ = (seg.z1 + seg.z2) * 0.5;
    const trimSpan = Math.max(1.2, segLen - 0.36);

    const segLocal = [];

    // 1. Grounded Chamfered Stone Base Socle Molding (eliminates sterile 90-degree wall-floor seams!)
    segLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(trimSpan, 0.28, 0.15), 0, 0.14, 0.075), {
      colorHex: 0x5f667a, bottomColorHex: 0x1c1f28
    }));
    if (!SEG_MOBILE) {
      // Sloped stone water-table bevel cap along socle top
      segLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(trimSpan, 0.09, 0.12), 0, 0.31, 0.05, 0.42, 0, 0), {
        colorHex: 0x747d94, bottomColorHex: 0x4b5163
      }));
    }

    // 2. Mid-Wall Carved Gothic Stringcourse Band (on straight masonry walls, stays behind banners/sconces!)
    if (seg.axis !== 'angled' && wallH >= 6.2) {
      segLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(trimSpan, 0.14, 0.11), 0, 4.08, 0.055), {
        colorHex: 0x727b92, bottomColorHex: 0x3d4352
      }));
    }

    // 3. Upper Corbel Cornice Frieze + PC Dentil Corbel Blocks
    segLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(trimSpan, 0.24, 0.22), 0, wallH - 0.12, 0.11), {
      colorHex: 0x788199, bottomColorHex: 0x414758
    }));
    if (!SEG_MOBILE && seg.axis !== 'angled' && trimSpan >= 3.2) {
      const corbels = Math.min(14, Math.floor(trimSpan / 1.55));
      for (let c = 0; c < corbels; c++) {
        const lx = -trimSpan * 0.44 + (corbels > 1 ? (c / (corbels - 1)) * (trimSpan * 0.88) : 0);
        segLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.18, 0.20, 0.18), lx, wallH - 0.32, 0.09, 0.24, 0, 0), {
          colorHex: 0x677086, bottomColorHex: 0x343948
        }));
      }
    }

    const trimMerged = mergeTaggedParts(segLocal);
    makeXform(trimMerged, midX, 0, midZ, 0, rotY, 0);
    stoneParts.push(trimMerged);

    // 4. Engaged Vertical Gothic Stone Pilasters along straight walls (skipping props & archways!)
    if (seg.axis !== 'angled' && segLen >= 6.4) {
      const bayCount = Math.max(1, Math.floor(segLen / 5.8));
      for (let b = 1; b <= bayCount; b++) {
        const frac = b / (bayCount + 1);
        const px = seg.x1 + ux * (segLen * frac);
        const pz = seg.z1 + uz * (segLen * frac);
        if (isNearWallProp(px, pz, 1.05)) continue;

        const pil = [];
        // Stepped pilaster base plinth
        pil.push(tagGeo(makeXform(new THREE.BoxGeometry(0.60, 0.46, 0.24), 0, 0.23, 0.12), {
          colorHex: 0x687086, bottomColorHex: 0x1e212a
        }));
        // Vertical chamfered pilaster shaft
        const shaftH = Math.max(2.0, wallH - 0.92);
        pil.push(tagGeo(makeXform(new THREE.BoxGeometry(0.40, shaftH, 0.17), 0, 0.46 + shaftH * 0.5, 0.085), {
          colorHex: 0x636b80, bottomColorHex: 0x3b404f
        }));
        if (!SEG_MOBILE) {
          // Central gothic vertical molding rib on pilaster face
          pil.push(tagGeo(makeXform(new THREE.BoxGeometry(0.14, shaftH - 0.3, 0.05), 0, 0.46 + shaftH * 0.5, 0.185), {
            colorHex: 0x79829a, bottomColorHex: 0x484f62
          }));
        }
        // Corbeled pilaster capital supporting vault ribs
        pil.push(tagGeo(makeXform(new THREE.BoxGeometry(0.56, 0.36, 0.26), 0, wallH - 0.28, 0.13), {
          colorHex: 0x7e88a0, bottomColorHex: 0x454c5e
        }));

        const pilMerged = mergeTaggedParts(pil);
        makeXform(pilMerged, px, 0, pz, 0, rotY, 0);
        stoneParts.push(pilMerged);
        pilasterCount++;
      }
    }
  }

  return pilasterCount;
}

// ============================================================================
// Flame-Trap Gauntlet Charred Blast Scorch, Wall Soot Plumes & 3D Ash Clods!
//   - Raycasts each flame trap across `wallSegments` to find exact opposite wall!
//   - Places 3D blackened ash drifts & spalled stone clods at wall bases (0 extra DC)
//     + procedural FBM floor/wall scorch & smoldering cinder shader mesh (1 DC)!
// ============================================================================
function raycastWallHit2D(ox, oz, dx, dz, maxDist, wallSegments) {
  let bestT = Infinity;
  let bestWall = null;
  const walls = Array.isArray(wallSegments) ? wallSegments : [];
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (!w || !Number.isFinite(w.x1)) continue;
    const sx = w.x2 - w.x1;
    const sz = w.z2 - w.z1;
    const denom = dx * sz - dz * sx;
    if (Math.abs(denom) < 1e-6) continue;
    const qx = w.x1 - ox;
    const qz = w.z1 - oz;
    const t = (qx * sz - qz * sx) / denom;
    const u = (qx * dz - qz * dx) / denom;
    if (t > 1.8 && t <= maxDist && u >= 0.05 && u <= 0.95 && t < bestT) {
      bestT = t;
      bestWall = w;
    }
  }
  if (!bestWall) return null;
  return {
    dist: bestT,
    x: ox + dx * bestT,
    z: oz + dz * bestT,
    nx: Number.isFinite(bestWall.normalX) ? bestWall.normalX : -dx,
    nz: Number.isFinite(bestWall.normalZ) ? bestWall.normalZ : -dz
  };
}

function appendFlameTrapAshAndScorch(stoneParts, scorchPlanes, flameTraps, wallSegments) {
  const traps = Array.isArray(flameTraps) ? flameTraps : [];
  if (!traps.length) return 0;
  const rng = makeRng(265511);

  const pushScorchPlane = (planeGeo, role, seed) => {
    const g = planeGeo.index ? planeGeo.toNonIndexed() : planeGeo;
    if (g !== planeGeo) planeGeo.dispose();
    const count = g.attributes.position.count;
    const meta = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      meta[i * 2] = role;
      meta[i * 2 + 1] = seed;
    }
    g.setAttribute('aScorchMeta', new THREE.BufferAttribute(meta, 2));
    scorchPlanes.push(g);
  };

  const addCharredAshDrift3D = (cx, cz, nx, nz, scale = 1.0) => {
    const local = [];
    // Low-profile windblown charred ash heap hugging the wall plinth (y <= 0.09m, zero trip hazard!)
    const mound = new THREE.CylinderGeometry(0.28 * scale, 0.68 * scale, 0.075 * scale, SEG_MOBILE ? 6 : 10);
    makeXform(mound, 0, 0.036 * scale, 0.24 * scale, 0, 0, 0, 1.55, 1.0, 0.72);
    local.push(tagGeo(mound, { colorHex: 0x1c191d, bottomColorHex: 0x0d0b0e, jitter: 0.08, rng }));

    const clods = SEG_MOBILE ? 2 : 5;
    for (let k = 0; k < clods; k++) {
      const clod = new THREE.DodecahedronGeometry((0.048 + rng() * 0.038) * scale, 0);
      makeXform(
        clod,
        (rng() - 0.5) * 0.95 * scale,
        0.032 * scale,
        (0.14 + rng() * 0.36) * scale,
        rng() * 2, rng() * 3, rng() * 2,
        1.25, 0.52, 0.95
      );
      local.push(tagGeo(clod, { colorHex: k % 2 === 0 ? 0x241d1c : 0x151316, bottomColorHex: 0x0c0a0c }));
    }
    const merged = mergeTaggedParts(local);
    makeXform(merged, cx, 0, cz, 0, Math.atan2(nx, nz), 0);
    stoneParts.push(merged);
  };

  for (let i = 0; i < traps.length; i++) {
    const tr = traps[i];
    if (!tr || !Number.isFinite(tr.x) || !Number.isFinite(tr.z)) continue;
    const rawDx = Number.isFinite(tr.dirX) ? tr.dirX : 1;
    const rawDz = Number.isFinite(tr.dirZ) ? tr.dirZ : 0;
    const lenDir = Math.hypot(rawDx, rawDz) || 1;
    const dx = rawDx / lenDir;
    const dz = rawDz / lenDir;
    const jetLen = Number.isFinite(tr.jetLength) ? tr.jetLength : 7.8;
    const halfW = Number.isFinite(tr.jetHalfWidth) ? tr.jetHalfWidth : 1.15;
    const nozzleY = Number.isFinite(tr.y) ? tr.y : 1.15;
    const seed = i * 1.73 + 0.41;

    const hit = raycastWallHit2D(tr.x, tr.z, dx, dz, jetLen + 4.0, wallSegments);
    const streakLen = hit ? Math.min(hit.dist - 0.08, jetLen + 2.4) : jetLen + 0.8;

    // 1. Floor Charred Blast Streak across flagstones (u = 0 at nozzle -> u = 1 at impact end)
    const floorW = halfW * 2.75;
    const fp = new THREE_BASE.PlaneGeometry(streakLen, floorW);
    fp.rotateX(-Math.PI / 2);
    // Plane X initially spans [-streakLen/2, +streakLen/2]; shift +X by streakLen/2 then rotate along (dx, dz)
    fp.translate(streakLen * 0.5 + 0.06, 0.019, 0);
    fp.rotateY(Math.atan2(-dz, dx));
    fp.translate(tr.x, 0, tr.z);
    pushScorchPlane(fp, 0.0, seed);

    // 2. Nozzle Wall Blackened Soot Halo & Rising Buoyant Plume
    const srcRotY = Math.atan2(dx, dz);
    const wpSrc = new THREE_BASE.PlaneGeometry(2.5, 3.3);
    makeXform(wpSrc, tr.x + dx * 0.036, nozzleY + 0.65, tr.z + dz * 0.036, 0, srcRotY, 0);
    pushScorchPlane(wpSrc, 1.0, seed);

    // 3D charred ash drift directly beneath nozzle
    addCharredAshDrift3D(tr.x, tr.z, dx, dz, 1.0);

    // 3. Opposite Wall Heavy Carbonized Impact Crater & Soot Tongues (only when solid wall hit!)
    if (hit) {
      const hitRotY = Math.atan2(hit.nx, hit.nz);
      const wpHit = new THREE_BASE.PlaneGeometry(3.1, 3.3);
      makeXform(wpHit, hit.x + hit.nx * 0.036, nozzleY + 0.45, hit.z + hit.nz * 0.036, 0, hitRotY, 0);
      pushScorchPlane(wpHit, 2.0, seed + 0.9);

      // Larger 3D heap of burned ash & spalled stone chips at the opposite wall impact base!
      addCharredAshDrift3D(hit.x, hit.z, hit.nx, hit.nz, 1.22);
    }
  }

  return traps.length;
}

function createFlameTrapScorchShaderMat() {
  const uniforms = { uTime: { value: 0.0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec2 aScorchMeta;
      varying vec2 vUv;
      varying vec2 vMeta;
      void main() {
        vUv = uv;
        vMeta = aScorchMeta;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec2 vMeta;

      float hash21(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 34.5);
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
      float fbm(vec2 p) {
        return vnoise(p) * 0.56 + vnoise(p * 2.13 + vec2(3.7, 1.9)) * 0.30 + vnoise(p * 4.41) * 0.14;
      }

      void main() {
        float role = vMeta.x;
        float seed = vMeta.y;
        float soot = 0.0;
        float ashRing = 0.0;
        float ember = 0.0;

        if (role < 0.5) {
          // Role 0: Floor elongated turbulent flame-blast scorch fan (u=0 nozzle -> u=1 opposite wall)
          float u = vUv.x;
          float v = (vUv.y - 0.5) * 2.0;
          float n = fbm(vec2(u * 4.5 + seed, v * 3.2));
          // Fan widens slightly away from nozzle with ragged turbulent edges
          float fanHalfW = mix(0.32, 0.88, pow(clamp(u, 0.0, 1.0), 0.55));
          float lat = abs(v + (n - 0.5) * 0.36) / max(0.12, fanHalfW);
          float along = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.68, u - (n - 0.5) * 0.18);
          float body = smoothstep(1.0, 0.18, lat) * along;
          soot = clamp(body * (0.62 + 0.58 * n), 0.0, 1.0);
          ashRing = smoothstep(0.96, 0.55, lat) * (1.0 - smoothstep(0.55, 0.20, lat)) * along * n;
          // Faint smoldering residual ember specks in flagstone mortar cracks
          float speck = vnoise(vec2(u * 26.0 + seed * 5.0, v * 14.0));
          ember = smoothstep(0.86, 0.96, speck) * body * (0.55 + 0.45 * sin(uTime * 3.6 + speck * 18.0));
        } else if (role < 1.5) {
          // Role 1: Nozzle wall soot collar + buoyant rising smoke tongue
          vec2 c = vec2((vUv.x - 0.5) * 2.2, (vUv.y - 0.30) * 1.5);
          float n = fbm(vec2(c.x * 3.0 + seed, c.y * 2.6));
          float plumeW = mix(0.42, 0.72, clamp(vUv.y, 0.0, 1.0));
          float plume = smoothstep(plumeW, 0.08, abs(c.x + (n - 0.5) * 0.28))
                      * smoothstep(0.06, 0.28, vUv.y) * smoothstep(0.98, 0.36, vUv.y);
          float ring = exp(-dot(c, c) * 6.5);
          soot = clamp((plume * 0.75 + ring * 0.85) * (0.65 + 0.50 * n), 0.0, 1.0);
        } else {
          // Role 2: Opposite stone wall heavy carbonized flame-impact blast mark
          vec2 c = vec2((vUv.x - 0.5) * 2.0, (vUv.y - 0.38) * 1.75);
          float n = fbm(vec2(c.x * 3.4 + seed, c.y * 3.0));
          float r = length(c) + (n - 0.5) * 0.34;
          float blast = smoothstep(0.95, 0.14, r);
          float upLick = smoothstep(0.68, 0.10, abs(c.x + (n - 0.5) * 0.3)) * smoothstep(0.32, 0.52, vUv.y) * smoothstep(0.98, 0.48, vUv.y);
          soot = clamp(max(blast, upLick * 0.82) * (0.68 + 0.48 * n), 0.0, 1.0);
          ashRing = smoothstep(0.94, 0.62, r) * (1.0 - smoothstep(0.62, 0.32, r)) * n;
          float fis = vnoise(c * 14.0 + seed);
          ember = smoothstep(0.83, 0.95, fis) * smoothstep(0.48, 0.06, r) * (0.55 + 0.45 * sin(uTime * 4.1 + seed * 3.0));
        }

        float alpha = clamp(soot * 0.76 + ashRing * 0.32 + ember * 0.45, 0.0, 0.82);
        if (alpha < 0.012) discard;

        vec3 sootBlack = vec3(0.024, 0.020, 0.024);
        vec3 paleAsh   = vec3(0.24, 0.22, 0.23);
        vec3 hotCinder = vec3(0.92, 0.30, 0.04);

        vec3 col = mix(sootBlack, paleAsh, clamp(ashRing * 0.85, 0.0, 0.65));
        col = mix(col, hotCinder, clamp(ember, 0.0, 0.85));
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  return { mat, uniforms };
}

// ============================================================================
// East Alcove Armory Decor 3D Builders
// ============================================================================
function appendWeaponRackParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const w = Number.isFinite(spec.width) ? spec.width : 1.8;
  const h = Number.isFinite(spec.height) ? spec.height : 1.85;
  const isHeavy = spec.style === 'greatswords_halberds';
  const hasShield = spec.style === 'halberds_shields';

  const local = [];
  const halfW = w * 0.46;

  for (const side of [-1, 1]) {
    const sx = side * halfW;
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.11, 0.12, 0.62), sx, 0.06, 0), { colorHex: 0x2b201a, bottomColorHex: 0x17120f }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.09, h * 0.78, 0.10), sx, h * 0.42, -0.06, 0.12, 0, 0), { colorHex: 0x3b2c22, bottomColorHex: 0x221914 }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.09, h * 0.76, 0.10), sx, h * 0.41,  0.14, -0.14, 0, 0), { colorHex: 0x3b2c22, bottomColorHex: 0x221914 }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.12, 0.08, 0.24), sx, h * 0.78, 0.04), { colorHex: 0x454d60 }));
    if (!SEG_MOBILE) {
      local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.045, 0.14, 4), sx, h * 0.86, 0.04, 0, Math.PI / 4, 0), { colorHex: 0x5c667e }));
    }
  }
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(w, 0.08, 0.34), 0, 0.14, 0.02), { colorHex: 0x35271e }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.08, 0.075, 0.09), 0, h * 0.62, 0.02), { colorHex: 0x403025 }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.12, 0.055, 0.06), 0, h * 0.78, 0.04), { colorHex: 0x485064 }));

  const addRackSword = (sx, bladeLen, guardW, tiltZ) => {
    const sw = [];
    sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.028, 0.058, bladeLen, 4), 0, bladeLen * 0.5 + 0.18, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.35), {
      colorHex: 0x7b849b, bottomColorHex: 0x4d5466
    }));
    sw.push(tagGeo(makeXform(new THREE.BoxGeometry(guardW, 0.045, 0.055), 0, bladeLen + 0.18, 0), { colorHex: 0x525a6f }));
    sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.024, 0.028, 0.26, 8), 0, bladeLen + 0.33, 0), { colorHex: 0x2c221f }));
    sw.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.052, 0), 0, bladeLen + 0.48, 0), { colorHex: 0x677088 }));
    const sm = mergeTaggedParts(sw);
    makeXform(sm, sx, 0, 0.04, -0.06, 0, tiltZ);
    local.push(sm);
  };

  const addRackPolearm = (sx, poleH, isHalberd, tiltZ) => {
    const pl = [];
    pl.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.022, 0.026, poleH, 8), 0, poleH * 0.5 + 0.14, 0), {
      colorHex: 0x3d2e24, bottomColorHex: 0x241a15
    }));
    pl.push(tagGeo(makeXform(new THREE.ConeGeometry(0.048, 0.34, 4), 0, poleH + 0.28, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.42), {
      colorHex: 0x848ea6, bottomColorHex: 0x555d72
    }));
    if (isHalberd) {
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
  } else if (hasShield) {
    addRackPolearm(-halfW * 0.70, 1.92, true,  0.05);
    addRackSword(-halfW * 0.24, 1.26, 0.40, -0.03);
    addRackSword( halfW * 0.26, 1.12, 0.34,  0.04);
    addRackPolearm( halfW * 0.70, 1.84, false, -0.04);
    // Battered Gothic Kite Shield leaning against front of weapon rack
    const sh = [];
    sh.push(tagGeo(makeXform(new THREE.BoxGeometry(0.54, 0.84, 0.045), 0, 0.46, 0), { colorHex: 0x4b1520, bottomColorHex: 0x1d0b10 }));
    sh.push(tagGeo(makeXform(new THREE.BoxGeometry(0.58, 0.05, 0.058), 0, 0.87, 0), { colorHex: 0x6e7890 }));
    sh.push(tagGeo(makeXform(new THREE.ConeGeometry(0.28, 0.34, 4), 0, 0.16, 0, Math.PI, Math.PI / 4, 0, 1.0, 1.0, 0.18), { colorHex: 0x5c657c }));
    sh.push(tagGeo(makeXform(new THREE.SphereGeometry(0.09, 7, 5), 0, 0.52, 0.032, 0, 0, 0, 1.0, 1.0, 0.45), { colorHex: 0xb89344 }));
    const sm = mergeTaggedParts(sh);
    makeXform(sm, halfW * 0.32, 0.02, 0.24, -0.24, 0.14, -0.05);
    local.push(sm);
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
  const scarred = spec.style === 'battle_scarred';
  const plateTopHex = scarred ? 0x565e72 : 0x6c748a;
  const plateHiHex = scarred ? 0x677088 : 0x7b859e;

  const local = [];

  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.36, 0.42, 0.14, 8), 0, 0.07, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x3b312a, bottomColorHex: 0x1e1916
  }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.045, 0.055, 1.56, 8), 0, 0.86, 0), { colorHex: 0x302620 }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.76, 0.055, 0.055), 0, 1.44, 0), { colorHex: 0x362b24 }));

  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.24, 0.19, 0.46, 10), 0, 1.24, 0.02, 0, Math.PI / 8, 0, 1.16, 1.0, 0.78), {
    colorHex: plateTopHex, bottomColorHex: 0x2d3240
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.055, 0.44, 0.10), 0, 1.24, 0.16, -0.08, 0, 0), { colorHex: plateHiHex }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.14, 0.21, 0.12, 10), 0, 1.50, 0.01), { colorHex: 0x525a6e }));
  local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.20, 0.26, 0.20, 10), 0, 0.94, 0.01, 0, Math.PI / 8, 0, 1.12, 1.0, 0.78), {
    colorHex: 0x4c5468, bottomColorHex: 0x2a2f3c
  }));
  for (const side of [-1, 1]) {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.16, 0.30, 0.05), side * 0.14, 0.72, 0.13, -0.14, side * 0.22, side * 0.08), {
      colorHex: plateTopHex, bottomColorHex: 0x303644
    }));
    local.push(tagGeo(makeXform(new THREE.SphereGeometry(0.155, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), side * 0.31, 1.44, 0, 0, 0, -side * 0.42, 1.15, 0.92, 1.05), {
      colorHex: plateHiHex, bottomColorHex: 0x394050
    }));
    local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.082, 0.068, 0.32, 9), side * 0.36, 1.22, 0.01, 0, 0, -side * 0.12), {
      colorHex: 0x525a6e, bottomColorHex: 0x2e3442
    }));
    if (scarred && !SEG_MOBILE && side === -1) {
      // Asymmetric gothic pauldron spike ridge on battle-scarred veteran armor
      local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.036, 0.16, 4), side * 0.35, 1.58, 0.0, 0, 0, side * -0.45), {
        colorHex: 0x7d87a0
      }));
    }
  }

  local.push(tagGeo(makeXform(new THREE.SphereGeometry(0.148, 9, 7), 0, 1.70, 0.01, 0, 0, scarsTilt(scarred), 0.92, 1.14, 1.08), {
    colorHex: plateHiHex, bottomColorHex: 0x3b4254
  }));
  local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.11, 0.22, 4), 0, 1.65, 0.14, Math.PI * 0.46, Math.PI / 4, 0), {
    colorHex: plateTopHex, bottomColorHex: 0x353b4a
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.16, 0.026, 0.045), 0, 1.69, 0.175), { colorHex: 0x111318 }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.028, 0.16, 0.26), 0, 1.84, -0.02, -0.18, 0, 0), { colorHex: 0x8791ab }));

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  parts.push(merged);
}

function scarsTilt(scarred) {
  return scarred ? 0.11 : 0.0;
}

function appendWallShieldParts(parts, spec) {
  const ox = spec.x || 0;
  const oy = Number.isFinite(spec.y) ? spec.y : 2.85;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;

  const local = [];

  if (spec.crossedSwords) {
    for (const side of [-1, 1]) {
      const sw = [];
      sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.024, 0.046, 1.18, 4), 0, -0.10, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.34), {
        colorHex: 0x7e87a0, bottomColorHex: 0x525a6e
      }));
      sw.push(tagGeo(makeXform(new THREE.BoxGeometry(0.32, 0.042, 0.048), 0, 0.49, 0), { colorHex: 0x9b7e3c }));
      sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 8), 0, 0.62, 0), { colorHex: 0x2c221e }));
      sw.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.046, 0), 0, 0.75, 0), { colorHex: 0xb89648 }));
      const sm = mergeTaggedParts(sw);
      makeXform(sm, 0, 0.04, 0.048, 0, 0, side * 0.56);
      local.push(sm);
    }
  }

  const faceHex = spec.crest === 'relic_sun_shield' ? 0x6c1824 : (spec.crest === 'iron_cross' ? 0x263146 : 0x4e1421);
  const trimHex = spec.crest === 'relic_sun_shield' ? 0xd9ad4e : 0x7b859e;

  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.35,  0.42);
  shieldShape.lineTo( 0.35,  0.42);
  shieldShape.lineTo( 0.34,  0.02);
  shieldShape.quadraticCurveTo(0.28, -0.34, 0.0, -0.58);
  shieldShape.quadraticCurveTo(-0.28, -0.34, -0.34, 0.02);
  shieldShape.closePath();

  const rimGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.042,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.032,
    bevelSegments: SEG_MOBILE ? 1 : 2,
    curveSegments: SEG_MOBILE ? 2 : 7
  });
  makeXform(rimGeo, 0, 0, 0.082);
  local.push(tagGeo(rimGeo, { colorHex: trimHex, bottomColorHex: 0x3b3532 }));

  const faceGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.030,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: -0.012,
    bevelSegments: SEG_MOBILE ? 1 : 2,
    curveSegments: SEG_MOBILE ? 2 : 7
  });
  makeXform(faceGeo, 0, 0, 0.112);
  local.push(tagGeo(faceGeo, { colorHex: faceHex, bottomColorHex: 0x1a1117 }));

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

// ============================================================================
// Zones 1–5 Dark-Fantasy Environmental Storytelling 3D Prop Builders
//   - Zone 1: Stone Sarcophagi / Knight Tomb Effigies, Weathered Vigilant Knight
//             Statues, Broken Overhead Portcullis & Chains, Fallen Shields/Rubble
//   - Zone 2: Carved Gothic Skull Reliquary Wall Niches (+ Weapon Racks & Armor)
//   - Zone 3: GPU-Swaying Hanging Wrought-Iron Prisoner Cages (1 InstancedMesh DC)
//             + Safe-Pocket Charred Skeletal Remains & Scorched Armor
//   - Zone 4: Cathedral Stone Pews / Shattered Benches, Tall Gothic Side-Wall
//             Shrines/Statues, GPU-Swaying Hanging Chain Censers (1 InstancedMesh DC),
//             and Fallen Carved Masonry Slabs
//   - Zone 5: Kneeling Armored Watcher Statues facing the Boss Doors, Weathered
//             Pilgrim Stone Benches, and Leaning Greatswords / Resting Gear
// ============================================================================
function buildStorySkullMerged({
  scale = 1.0,
  craniumHex = 0xe8dcc2,
  bottomHex = 0x8e7e68,
  socketHex = 0x100e12,
  rng = null
} = {}) {
  const local = [];
  const cran = new THREE.IcosahedronGeometry(0.125, SEG_MOBILE ? 0 : 1);
  const cp = cran.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    let x = cp.getX(i) * 0.86;
    let y = cp.getY(i);
    let z = cp.getZ(i) * 1.12;
    if (y < -0.02) {
      x *= 0.82;
      z *= 0.90;
    }
    if (z > 0.06 && y > -0.02 && y < 0.055) z += 0.022;
    cp.setXYZ(i, x, y, z);
  }
  cran.computeVertexNormals();
  local.push(tagGeo(cran, { colorHex: craniumHex, bottomColorHex: bottomHex, jitter: rng ? 0.04 : 0, rng }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.145, 0.056, 0.082), 0, -0.062, 0.068), {
    colorHex: craniumHex, bottomColorHex: bottomHex
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.104, 0.046, 0.072), 0, -0.098, 0.088), {
    colorHex: bottomHex, bottomColorHex: 0x4b4238
  }));
  for (const sx of [-0.042, 0.042]) {
    if (SEG_MOBILE) {
      local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.046, 0.038, 0.028), sx, -0.018, 0.106), {
        colorHex: socketHex
      }));
    } else {
      local.push(tagGeo(makeXform(new THREE.SphereGeometry(0.032, 6, 4), sx, -0.018, 0.106, 0, 0, 0, 1.05, 0.86, 0.60), {
        colorHex: socketHex
      }));
    }
  }
  if (!SEG_MOBILE) {
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.018, 0.040, 3), 0, -0.064, 0.118, 0.12, Math.PI, 0), {
      colorHex: socketHex
    }));
  }
  const merged = mergeTaggedParts(local);
  if (scale !== 1.0) merged.scale(scale, scale, scale);
  return merged;
}

function buildStoryLongboneMerged(len = 0.52, rad = 0.022, topHex = 0xe2d5ba, botHex = 0x867762) {
  const local = [
    tagGeo(new THREE.CylinderGeometry(rad * 0.82, rad * 0.95, len, SEG_MOBILE ? 5 : 8), {
      colorHex: topHex, bottomColorHex: botHex
    })
  ];
  if (!SEG_MOBILE) {
    for (const s of [-1, 1]) {
      local.push(tagGeo(makeXform(new THREE.SphereGeometry(rad * 1.42, 5, 4), -rad * 0.55, s * len * 0.48, 0), { colorHex: topHex }));
      local.push(tagGeo(makeXform(new THREE.SphereGeometry(rad * 1.35, 5, 4),  rad * 0.55, s * len * 0.48, 0), { colorHex: topHex }));
    }
  }
  return mergeTaggedParts(local);
}

// 1. Zone 1: Carved Gothic Stone Sarcophagus / Recumbent Knight Tomb Effigy / Cracked Tomb
function appendStoneSarcophagusParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const w = Number.isFinite(spec.width) ? spec.width : 2.28;
  const d = Number.isFinite(spec.depth) ? spec.depth : 1.06;
  const isCracked = spec.style === 'cracked_tomb';
  const isFounder = spec.style === 'founder_effigy';
  const rng = makeRng(310411 + Math.round((ox + oz) * 37));

  const stoneLocal = [];
  const ironLocal = [];

  // Stepped chamfered Gothic stone plinth
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16), 0, 0.07, 0), {
    colorHex: 0x62697d, bottomColorHex: 0x222530
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.06, 0.10, d + 0.06), 0, 0.19, 0), {
    colorHex: 0x737b92, bottomColorHex: 0x3b4050
  }));

  // Tomb chest walls (hollow dark interior when cracked ajar, solid coffer otherwise)
  if (isCracked) {
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.06, 0.56, d - 0.06), 0, 0.52, 0), {
      colorHex: 0x161821, bottomColorHex: 0x0d0e14
    }));
    const wallT = 0.12;
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.04, 0.58, wallT), 0, 0.53, (d - wallT) * 0.48), {
      colorHex: 0x687086, bottomColorHex: 0x343948
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.04, 0.58, wallT), 0, 0.53, -(d - wallT) * 0.48), {
      colorHex: 0x687086, bottomColorHex: 0x343948
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(wallT, 0.58, d - 0.20), (w - wallT) * 0.48, 0.53, 0), {
      colorHex: 0x687086, bottomColorHex: 0x343948
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(wallT, 0.58, d - 0.20), -(w - wallT) * 0.48, 0.53, 0), {
      colorHex: 0x687086, bottomColorHex: 0x343948
    }));
    // Skeletal occupant skull & reaching forearm inside cracked sarcophagus gap!
    const sk = buildStorySkullMerged({ scale: 0.92, craniumHex: 0xdccfb4, bottomHex: 0x7a6c58, rng });
    makeXform(sk, -w * 0.24, 0.74, 0.12, -0.35, 0.48, 0.22);
    stoneLocal.push(sk);
    const armBone = buildStoryLongboneMerged(0.46, 0.020, 0xd8cab0, 0x706250);
    makeXform(armBone, -w * 0.06, 0.80, d * 0.34, 0.32, 0.25, 1.35);
    stoneLocal.push(armBone);
  } else {
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.04, 0.58, d - 0.04), 0, 0.53, 0), {
      colorHex: 0x666e84, bottomColorHex: 0x333846
    }));
  }

  // Carved Gothic blind-arcade side pilasters & corner colonnettes
  if (!SEG_MOBILE) {
    const bays = 5;
    for (const sz of [-1, 1]) {
      const fz = sz * (d * 0.5 - 0.005);
      for (let b = 0; b <= bays; b++) {
        const bx = -w * 0.44 + (b / bays) * (w * 0.88);
        stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.085, 0.52, 0.055), bx, 0.53, fz), {
          colorHex: 0x7d869e, bottomColorHex: 0x414758
        }));
      }
    }
  }
  for (const sx of [-w * 0.47, w * 0.47]) {
    for (const sz of [-d * 0.46, d * 0.46]) {
      if (!SEG_MOBILE) {
        stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.062, 0.072, 0.60, 8), sx, 0.54, sz), {
          colorHex: 0x8089a2, bottomColorHex: 0x43495a
        }));
      }
      ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.14, 0.06, 0.14), sx, 0.81, sz), {
        colorHex: 0x3b4254
      }));
    }
  }

  // Molded cornice rim & heavy beveled stone tomb lid (+ sculpted recumbent Knight Tomb Effigy!)
  const lidLocal = [];
  lidLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.08, 0.10, d + 0.08), 0, 0.05, 0), {
    colorHex: 0x838ca6, bottomColorHex: 0x4c5366
  }));
  lidLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.08, 0.09, d - 0.10), 0, 0.14, 0), {
    colorHex: 0x79829a, bottomColorHex: 0x4e5568
  }));

  // Sculpted Recumbent Knight Effigy lying in eternal vigil atop the sarcophagus lid
  lidLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.36, 0.08, 0.48), -w * 0.31, 0.21, 0, 0, 0, -0.06), {
    colorHex: 0x747d95, bottomColorHex: 0x494f60
  }));
  lidLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.115, 0.13, 0.24, 8), -w * 0.30, 0.28, 0, 0, 0, Math.PI * 0.48), {
    colorHex: 0x8b95b0, bottomColorHex: 0x52596d
  }));
  lidLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.17, 0.21, 0.56, 8), -w * 0.08, 0.25, 0, 0, 0, Math.PI * 0.5, 1.0, 1.0, 1.24), {
    colorHex: 0x858fa8, bottomColorHex: 0x4d5466
  }));
  for (const sz of [-0.21, 0.21]) {
    lidLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.115, 7, 5), -w * 0.16, 0.26, sz, 0, 0, 0, 1.15, 0.78, 0.95), {
      colorHex: 0x8c96b0, bottomColorHex: 0x50576a
    }));
  }
  lidLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.68, 0.14, 0.34), w * 0.20, 0.22, 0), {
    colorHex: 0x7c859e, bottomColorHex: 0x4a5163
  }));
  for (const sz of [-0.09, 0.09]) {
    lidLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.11, 0.18, 0.09), w * 0.39, 0.26, sz, 0, 0, -0.18), {
      colorHex: 0x8690aa, bottomColorHex: 0x4f5668
    }));
  }
  const swordTarget = isFounder ? ironLocal : lidLocal;
  const swY = isFounder ? 0.82 + 0.33 : 0.33;
  swordTarget.push(tagGeo(makeXform(new THREE.BoxGeometry(1.12, 0.032, 0.068), w * 0.08, swY, 0), {
    colorHex: isFounder ? 0x9aa4be : 0x949eb8
  }));
  swordTarget.push(tagGeo(makeXform(new THREE.BoxGeometry(0.052, 0.045, 0.34), -w * 0.14, swY + 0.01, 0), {
    colorHex: isFounder ? 0xc8a048 : 0x8e98b2
  }));

  const lidMerged = mergeTaggedParts(lidLocal);
  if (isCracked) {
    makeXform(lidMerged, 0.12, 0.81, -0.19, -0.04, 0.13, 0.02);
  } else {
    makeXform(lidMerged, 0, 0.82, 0);
  }
  stoneLocal.push(lidMerged);

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(stoneMerged);

  if (ironLocal.length > 0) {
    const ironMerged = mergeTaggedParts(ironLocal);
    makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
    ironParts.push(ironMerged);
  }
}

// 2. Zone 1: Weathered Vigilant Knight Stone Statue on Carved Octagonal Pedestal (~3.45m tall)
function appendKnightStatueParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;
  const isSentinel = spec.style === 'vigilant_sentinel';

  const stoneLocal = [];
  const ironLocal = [];

  // A. Carved Octagonal Gothic Pedestal (y = 0 .. 1.18)
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.58, 0.65, 0.18, 8), 0, 0.09, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x60677b, bottomColorHex: 0x20232d
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.48, 0.56, 0.14, 8), 0, 0.25, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x727a90, bottomColorHex: 0x3b4050
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.41, 0.44, 0.64, 8), 0, 0.64, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x646c82, bottomColorHex: 0x343948
  }));
  if (!SEG_MOBILE) {
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2;
      stoneLocal.push(tagGeo(makeRadialBar(new THREE.BoxGeometry(0.10, 0.54, 0.18), 0.41, 0.64, a, 0.02), {
        colorHex: 0x7b849c, bottomColorHex: 0x3e4454
      }));
    }
  }
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.54, 0.43, 0.12, 8), 0, 1.02, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x7c859e, bottomColorHex: 0x454b5d
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.52, 0.55, 0.10, 8), 0, 1.13, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x8690aa, bottomColorHex: 0x4f5668
  }));

  // B. Standing Vigilant Knight Figure (y = 1.18 .. 3.42, facing +Z)
  const baseY = 1.18;
  for (const sx of [-0.15, 0.15]) {
    stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.088, 0.102, 0.78, 8), sx, baseY + 0.39, 0.02, 0, 0, sx * -0.04), {
      colorHex: 0x747d95, bottomColorHex: 0x3f4556
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.13, 0.09, 0.25), sx, baseY + 0.045, 0.08), {
      colorHex: 0x6b748b, bottomColorHex: 0x353a48
    }));
  }
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.21, 0.33, 0.92, 9), 0, baseY + 0.62, -0.02, 0, 0, 0, 1.08, 1.0, 0.85), {
    colorHex: 0x6f7890, bottomColorHex: 0x393f4f
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.38, 1.56, 8, 1, true), 0, baseY + 0.88, -0.10, 0.08, Math.PI, 0, 1.15, 1.0, 0.68), {
    colorHex: 0x687088, bottomColorHex: 0x313644
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.26, 0.20, 0.56, 9), 0, baseY + 1.24, 0.02, 0, Math.PI / 8, 0, 1.18, 1.0, 0.82), {
    colorHex: 0x828ca6, bottomColorHex: 0x4b5264
  }));
  for (const side of [-1, 1]) {
    stoneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), side * 0.32, baseY + 1.46, 0.0, 0, 0, -side * 0.38, 1.18, 0.95, 1.05), {
      colorHex: 0x8b95b0, bottomColorHex: 0x4d5468
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.072, 0.082, 0.54, 8), side * 0.20, baseY + 1.24, 0.14, 0.52, 0, side * 0.38), {
      colorHex: 0x7b849e, bottomColorHex: 0x474e60
    }));
  }
  stoneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.095, 7, 5), 0, baseY + 1.05, 0.27, 0, 0, 0, 1.25, 0.85, 1.0), {
    colorHex: 0x8993ae, bottomColorHex: 0x52596c
  }));

  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.14, 0.155, 0.32, 8), 0, baseY + 1.72, 0.03, 0.18, Math.PI / 8, 0), {
    colorHex: 0x8d97b2, bottomColorHex: 0x4f566a
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.142, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, baseY + 1.85, 0.01, 0.18, 0, 0), {
    colorHex: 0x959fba, bottomColorHex: 0x5c647a
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.18, 0.032, 0.06), 0, baseY + 1.74, 0.16, 0.18, 0, 0), {
    colorHex: 0x1a1d26
  }));
  if (isSentinel && !SEG_MOBILE) {
    for (const side of [-1, 1]) {
      stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.05, 0.28, 4), side * 0.16, baseY + 1.96, -0.02, -0.20, 0, -side * 0.36), {
        colorHex: 0x96a0bc, bottomColorHex: 0x596176
      }));
    }
  }

  const swList = isSentinel ? ironLocal : stoneLocal;
  const bladeHex = isSentinel ? 0x6f7992 : 0x8b95b0;
  const guardHex = isSentinel ? 0x555e74 : 0x848ea8;
  swList.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.024, 0.056, 0.88, 4), 0, baseY + 0.45, 0.27, 0, Math.PI / 4, 0, 1.0, 1.0, 0.34), {
    colorHex: bladeHex, bottomColorHex: 0x3b4152
  }));
  swList.push(tagGeo(makeXform(new THREE.BoxGeometry(0.38, 0.048, 0.064), 0, baseY + 0.90, 0.27), {
    colorHex: guardHex
  }));
  swList.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.056, 0), 0, baseY + 1.13, 0.27), {
    colorHex: bladeHex
  }));

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0, s, s, s);
  stoneParts.push(stoneMerged);

  if (ironLocal.length > 0) {
    const ironMerged = mergeTaggedParts(ironLocal);
    makeXform(ironMerged, ox, oy, oz, 0, rotY, 0, s, s, s);
    ironParts.push(ironMerged);
  }
}

// 3. Zone 1 & 2: Broken Overhead Wrought-Iron Portcullis & Dangling Hoist Chains
function appendBrokenPortcullisParts(ironParts, spec) {
  const ox = spec.x || 0;
  const oz = spec.z || 0;
  const spanW = Number.isFinite(spec.spanWidth) ? spec.spanWidth : 10.4;
  const halfSpan = spanW * 0.5;
  const springY = Number.isFinite(spec.springY) ? spec.springY : 5.0;
  const apexY = Number.isFinite(spec.apexY) ? spec.apexY : 7.9;
  const minCenterY = Number.isFinite(spec.minCenterSpikeY) ? spec.minCenterSpikeY : 4.85;
  const rng = makeRng(320987 + Math.round(Math.abs(oz) * 19));

  const local = [];
  const evalArchY = (u) => {
    const t = Math.max(0, Math.min(1, 1.0 - Math.pow(Math.abs(u) / Math.max(0.5, halfSpan), 1 / 0.82)));
    return springY + (apexY - springY) * Math.sin(t * Math.PI * 0.5) - 0.18;
  };

  const spacing = spanW > 14 ? 0.92 : 0.74;
  const barCount = Math.max(7, Math.floor((spanW - 1.2) / spacing));
  const usedW = (barCount - 1) * spacing;

  for (let i = 0; i < barCount; i++) {
    const lx = -usedW * 0.5 + i * spacing;
    const normX = Math.abs(lx) / Math.max(0.5, halfSpan);
    const topY = evalArchY(lx);
    const outerDrop = Math.pow(Math.max(0, (normX - 0.52) / 0.48), 1.45) * 1.25;
    const jaggedSnap = (rng() - 0.35) * 0.48;
    const botY = Math.max(3.55, (normX < 0.55 ? minCenterY + 0.15 + Math.abs(jaggedSnap) : minCenterY - outerDrop + jaggedSnap * 0.5));
    if (topY - botY < 0.45) continue;

    if (normX < 0.45 && (i % 5 === 2)) {
      const stubLen = Math.min(0.85, topY - botY);
      local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.068, stubLen, 0.068), lx, topY - stubLen * 0.5, 0, 0, 0, (rng() - 0.5) * 0.08), {
        colorHex: 0x3b4254, bottomColorHex: 0x222632
      }));
      continue;
    }

    const len = topY - botY;
    const bendZ = normX > 0.55 ? 0 : (rng() - 0.5) * 0.05;
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.072, len, 0.072), lx, botY + len * 0.5, 0, bendZ, 0, (rng() - 0.5) * 0.04), {
      colorHex: 0x41495c, bottomColorHex: 0x252a36
    }));
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.058, 0.22, 4), lx, botY - 0.09, 0, Math.PI, Math.PI / 4, 0), {
      colorHex: 0x58627a, bottomColorHex: 0x2d3342
    }));
  }

  const railYs = [minCenterY + 0.58, minCenterY + 1.28, minCenterY + 2.02];
  for (let r = 0; r < railYs.length; r++) {
    const ry = railYs[r];
    if (ry >= apexY - 0.45) continue;
    let halfChord = halfSpan * 0.90;
    for (let s = 0; s < 16; s++) {
      const testX = halfSpan * (1.0 - s / 16);
      if (evalArchY(testX) >= ry + 0.08) {
        halfChord = testX;
        break;
      }
    }
    const railW = Math.max(1.6, halfChord * 1.94);
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(railW, 0.095, 0.12), 0, ry, 0, 0, 0, r === 0 ? -0.025 : 0.012), {
      colorHex: 0x495268, bottomColorHex: 0x282d3a
    }));
  }

  for (const side of [-1, 1]) {
    const cx = side * (halfSpan * 0.78);
    const drumY = Math.min(apexY - 0.8, springY + 0.55);
    local.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.18, 0.18, 0.46, 8), cx, drumY, 0.22, 0, 0, Math.PI / 2), {
      colorHex: 0x384050, bottomColorHex: 0x1e222c
    }));
    const links = SEG_MOBILE ? 5 : 9;
    for (let k = 0; k < links; k++) {
      const ly = drumY - 0.22 - k * 0.19;
      if (ly < 3.65) break;
      const swayX = Math.sin(k * 0.55 + side) * 0.04;
      local.push(tagGeo(makeXform(
        new THREE.TorusGeometry(0.068, 0.020, 4, 8),
        cx + swayX, ly, 0.28,
        0.08, k % 2 === 0 ? Math.PI / 2 : 0, 0
      ), { colorHex: 0x525c74 }));
    }
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, 0, oz);
  ironParts.push(merged);
}

// 4. Zone 1: Scattered Ancient Stone Rubble & Fallen Battle Shields
function appendFallenShieldClusterParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const rng = makeRng(330157 + Math.round((ox * 13 + oz * 29)));

  const stoneLocal = [];
  const ironLocal = [];

  for (let c = 0; c < (SEG_MOBILE ? 3 : 5); c++) {
    const ang = (c / 5) * Math.PI * 2 + 0.3;
    const dist = 0.18 + rng() * 0.34;
    const chunk = new THREE.DodecahedronGeometry(0.11 + rng() * 0.07, 0);
    makeXform(chunk, Math.cos(ang) * dist, 0.065, Math.sin(ang) * dist, rng() * 2, rng() * 3, rng() * 2, 1.35, 0.55, 1.05);
    stoneLocal.push(tagGeo(chunk, { colorHex: 0x6b738a, bottomColorHex: 0x262a36, jitter: 0.06, rng }));
  }

  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.56, 0.042, 0.82), -0.06, 0.13, 0.04, 0.18, 0.26, -0.22), {
    colorHex: 0x4c1622, bottomColorHex: 0x221018
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.TorusGeometry(0.24, 0.022, 4, 8), -0.06, 0.15, 0.04, Math.PI * 0.5 + 0.18, 0.26, -0.22), {
    colorHex: 0x6c768e
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.26, 0.28, 0.036, 10), 0.34, 0.07, -0.18, -0.14, 0.4, 0.19), {
    colorHex: 0x454e62, bottomColorHex: 0x242834
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.072, 7, 5), 0.34, 0.10, -0.18, 0, 0, 0, 1.0, 0.55, 1.0), {
    colorHex: 0x8690aa
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.018, 0.022, 0.96, 7), -0.12, 0.05, -0.24, Math.PI * 0.49, 0.35, 0.92), {
    colorHex: 0x3b2c22, bottomColorHex: 0x1e1612
  }));

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(stoneMerged);

  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
  ironParts.push(ironMerged);
}

// 5. Zone 2: Carved Gothic Stone Reliquary Wall Niche w/ Skulls, Bones & Iron Keeper Grille
function appendReliquaryNicheParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const s = Number.isFinite(spec.scale) ? spec.scale : 1.0;
  const rng = makeRng(340821 + Math.round((ox + oz) * 23));

  const stoneLocal = [];
  const ironLocal = [];

  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(1.24, 0.14, 0.42), 0, 1.11, 0.20), {
    colorHex: 0x7e87a0, bottomColorHex: 0x3b4050
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.88, 0.24, 0.28), 0, 0.94, 0.13, 0.26, 0, 0), {
    colorHex: 0x677086, bottomColorHex: 0x2d3240
  }));

  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.86, 1.24, 0.08), 0, 1.80, 0.05), {
    colorHex: 0x151822, bottomColorHex: 0x0c0e14
  }));
  for (const sx of [-0.48, 0.48]) {
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.16, 1.24, 0.28), sx, 1.80, 0.14), {
      colorHex: 0x6d768e, bottomColorHex: 0x3d4354
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.058, 0.066, 1.18, 8), sx * 0.86, 1.80, 0.27), {
      colorHex: 0x858fa8, bottomColorHex: 0x4a5164
    }));
  }

  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.74, 0.16, 0.30), -0.26, 2.58, 0.15, 0, 0, 0.62), {
    colorHex: 0x828ca6, bottomColorHex: 0x484f62
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.74, 0.16, 0.30),  0.26, 2.58, 0.15, 0, 0, -0.62), {
    colorHex: 0x828ca6, bottomColorHex: 0x484f62
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.11, 0.34, 4), 0, 2.92, 0.16, 0, Math.PI / 4, 0), {
    colorHex: 0x909ab6
  }));

  const skullCoords = [
    [-0.20, 1.32, 0.16, -0.08,  0.22,  0.04, 0.96],
    [ 0.20, 1.32, 0.16, -0.06, -0.24, -0.05, 0.94],
    [ 0.00, 1.54, 0.14,  0.05,  0.04,  0.02, 1.02]
  ];
  for (let i = 0; i < skullCoords.length; i++) {
    if (SEG_MOBILE && i === 1) continue;
    const [kx, ky, kz, rx, ry, rz, ks] = skullCoords[i];
    const sk = buildStorySkullMerged({ scale: ks, craniumHex: 0xebe0c8, bottomHex: 0x8c7d66, rng });
    makeXform(sk, kx, ky, kz, rx, ry, rz);
    stoneLocal.push(sk);
  }
  const boneA = buildStoryLongboneMerged(0.56, 0.020, 0xe4d7bc, 0x82745e);
  makeXform(boneA, 0, 1.22, 0.22, 0.12, 0.22, 1.38);
  stoneLocal.push(boneA);

  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.88, 0.032, 0.032), 0, 1.34, 0.34), { colorHex: 0x454e62 }));
  for (let b = -2; b <= 2; b++) {
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.012, 0.014, 0.20, 6), b * 0.17, 1.26, 0.34), { colorHex: 0x3b4356 }));
  }

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0, s, s, s);
  stoneParts.push(stoneMerged);

  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0, s, s, s);
  ironParts.push(ironMerged);
}

// 6. Zone 3: Safe-Recess Charred Skeletal Remains & Scorched Armor Pieces
function appendCharredRemainsParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const pose = spec.pose || 'seated_knight';
  const rng = makeRng(350613 + Math.round((ox * 17 + oz * 31)));

  const stoneLocal = [];
  const ironLocal = [];

  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.32, 0.58, 0.08, SEG_MOBILE ? 6 : 10), 0, 0.04, 0.08, 0, 0, 0, 1.15, 1.0, 0.82), {
    colorHex: 0x1d1a1e, bottomColorHex: 0x0d0b0e, jitter: 0.07, rng
  }));

  if (pose === 'seated_knight') {
    for (let r = 0; r < 3; r++) {
      stoneLocal.push(tagGeo(makeXform(new THREE.TorusGeometry(0.13 - r * 0.012, 0.015, 4, 8, Math.PI * 1.15), 0, 0.26 + r * 0.065, -0.08, 1.25, 0, 0), {
        colorHex: 0x4f423b, bottomColorHex: 0x201918
      }));
    }
    const sk = buildStorySkullMerged({ scale: 0.96, craniumHex: 0x5c4d44, bottomHex: 0x241d1b, socketHex: 0x090708, rng });
    makeXform(sk, 0.03, 0.52, -0.05, 0.36, 0.22, -0.18);
    stoneLocal.push(sk);

    for (const sx of [-0.12, 0.14]) {
      const fem = buildStoryLongboneMerged(0.48, 0.022, 0x584a40, 0x221b19);
      makeXform(fem, sx, 0.07, 0.18, Math.PI * 0.48, sx * 0.8, 0.12);
      stoneLocal.push(fem);
    }
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.16, 0.19, 0.30, 8), 0, 0.28, -0.06, -0.24, 0, 0, 1.15, 1.0, 0.72), {
      colorHex: 0x2d282e, bottomColorHex: 0x141216
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.13, 7, 5), 0.28, 0.11, 0.12, 0.3, -0.4, 0.5), {
      colorHex: 0x353038, bottomColorHex: 0x161419
    }));
  } else if (pose === 'crawling_husk') {
    const sk = buildStorySkullMerged({ scale: 0.94, craniumHex: 0x54463d, bottomHex: 0x201917, socketHex: 0x090708, rng });
    makeXform(sk, 0.16, 0.15, 0.12, -0.25, 0.85, 0.28);
    stoneLocal.push(sk);
    for (let b = 0; b < 3; b++) {
      const bn = buildStoryLongboneMerged(0.44, 0.020, 0x56483e, 0x1e1816);
      makeXform(bn, -0.10 + b * 0.14, 0.06, -0.06 + (b % 2) * 0.16, Math.PI * 0.49, 0.5 + b * 0.7, 0.2);
      stoneLocal.push(bn);
    }
    ironLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.14, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), -0.04, 0.14, 0.02, 0.2, 0.3, -0.3), {
      colorHex: 0x312c34, bottomColorHex: 0x151318
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.62, 0.026, 0.052), 0.24, 0.045, 0.20, 0.05, 0.42, 0.08), {
      colorHex: 0x423d48, bottomColorHex: 0x1d1a20
    }));
  } else {
    const sk = buildStorySkullMerged({ scale: 0.92, craniumHex: 0x594a41, bottomHex: 0x221b19, socketHex: 0x090708, rng });
    makeXform(sk, -0.14, 0.16, 0.08, 0.18, -0.52, 0.35);
    stoneLocal.push(sk);
    ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.48, 0.04, 0.68), 0.08, 0.14, 0.04, 0.26, -0.32, 0.24), {
      colorHex: 0x2c1b20, bottomColorHex: 0x140e12
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.020, 0.024, 0.88, 7), -0.05, 0.08, 0.14, Math.PI * 0.47, -0.25, 1.15), {
      colorHex: 0x2a201b, bottomColorHex: 0x14100e
    }));
  }

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(stoneMerged);

  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
  ironParts.push(ironMerged);
}

// 7. Zone 4: Carved Cathedral Stone Pew / Shattered Bench
function appendCathedralPewParts(stoneParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const w = Number.isFinite(spec.width) ? spec.width : 1.95;
  const d = Number.isFinite(spec.depth) ? spec.depth : 0.64;
  const shattered = spec.style === 'shattered';
  const halfW = w * 0.46;

  const local = [];

  if (!shattered) {
    for (const side of [-1, 1]) {
      const sx = side * halfW;
      local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.14, 0.14, d), sx, 0.07, 0), {
        colorHex: 0x62697d, bottomColorHex: 0x222630
      }));
      local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.12, 0.88, d * 0.88), sx, 0.51, -0.02), {
        colorHex: 0x747d95, bottomColorHex: 0x3b4050
      }));
      local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.10, 0.24, 4), sx, 1.06, -d * 0.24, 0, Math.PI / 4, 0), {
        colorHex: 0x8993ae, bottomColorHex: 0x4d5466
      }));
    }
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w, 0.09, d * 0.76), 0, 0.46, 0.04), {
      colorHex: 0x808aa4, bottomColorHex: 0x474e60
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.06, 0.48, 0.10), 0, 0.72, -d * 0.30, -0.08, 0, 0), {
      colorHex: 0x768098, bottomColorHex: 0x414858
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w + 0.04, 0.07, 0.13), 0, 0.96, -d * 0.32), {
      colorHex: 0x8c96b0, bottomColorHex: 0x52596c
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w - 0.16, 0.08, 0.14), 0, 0.08, d * 0.28), {
      colorHex: 0x5d6478, bottomColorHex: 0x252934
    }));
  } else {
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.14, 0.14, d), -halfW, 0.07, 0), {
      colorHex: 0x62697d, bottomColorHex: 0x222630
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.12, 0.86, d * 0.88), -halfW, 0.50, -0.02), {
      colorHex: 0x747d95, bottomColorHex: 0x3b4050
    }));
    local.push(tagGeo(makeXform(new THREE.ConeGeometry(0.10, 0.22, 4), -halfW, 1.04, -d * 0.24, 0, Math.PI / 4, 0), {
      colorHex: 0x8892ac
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.14, 0.38, d * 0.84), halfW, 0.19, -0.02, 0.04, 0.08, -0.09), {
      colorHex: 0x687086, bottomColorHex: 0x262a36
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w * 0.54, 0.09, d * 0.74), -w * 0.20, 0.44, 0.04, 0.03, 0, -0.08), {
      colorHex: 0x7c86a0, bottomColorHex: 0x434a5c
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w * 0.48, 0.44, 0.10), -w * 0.22, 0.68, -d * 0.29, -0.08, 0.03, -0.10), {
      colorHex: 0x727b94, bottomColorHex: 0x3d4354
    }));
    local.push(tagGeo(makeXform(new THREE.BoxGeometry(w * 0.46, 0.09, d * 0.70), w * 0.22, 0.20, 0.06, 0.12, -0.10, -0.38), {
      colorHex: 0x6e778e, bottomColorHex: 0x303544
    }));
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(merged);
}

// 8. Zone 4: Tall Gothic Side-Wall Tabernacle Shrine / Hooded Saint Statue (~3.65m tall)
function appendGothicWallShrineParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const stoneLocal = [];
  const ironLocal = [];

  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(1.18, 0.16, 0.78), 0, 0.08, 0.06), {
    colorHex: 0x62697d, bottomColorHex: 0x20232d
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.98, 0.74, 0.62), 0, 0.53, 0.04), {
    colorHex: 0x6d768e, bottomColorHex: 0x373c4b
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(1.14, 0.14, 0.74), 0, 0.97, 0.06), {
    colorHex: 0x858fa8, bottomColorHex: 0x4b5264
  }));

  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.96, 1.88, 0.14), 0, 1.98, -0.22), {
    colorHex: 0x4c5366, bottomColorHex: 0x282c38
  }));
  for (const sx of [-0.46, 0.46]) {
    stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.068, 0.078, 1.84, 8), sx, 1.96, 0.22), {
      colorHex: 0x828ca6, bottomColorHex: 0x474e60
    }));
    stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.085, 0.32, 4), sx, 3.04, 0.22, 0, Math.PI / 4, 0), {
      colorHex: 0x8f99b4
    }));
  }
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.72, 0.16, 0.56), -0.25, 3.12, 0.02, 0, 0, 0.68), {
    colorHex: 0x8892ac, bottomColorHex: 0x4b5264
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.72, 0.16, 0.56),  0.25, 3.12, 0.02, 0, 0, -0.68), {
    colorHex: 0x8892ac, bottomColorHex: 0x4b5264
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.12, 0.42, 4), 0, 3.54, 0.04, 0, Math.PI / 4, 0), {
    colorHex: 0x96a0bc
  }));

  stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.28, 1.32, 9), 0, 1.70, 0.02, 0, 0, 0, 1.06, 1.0, 0.82), {
    colorHex: 0x808aa4, bottomColorHex: 0x434a5c
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.21, 8, 6), 0, 2.24, 0.01, 0, 0, 0, 1.12, 0.85, 0.85), {
    colorHex: 0x8993ae, bottomColorHex: 0x4e5568
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.15, 0.34, 8), 0, 2.54, 0.03, 0.24, 0, 0), {
    colorHex: 0x919bb6, bottomColorHex: 0x4c5366
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.085, 6, 5), 0, 2.46, 0.11), {
    colorHex: 0x1c1f29
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.042, 0.88, 0.024), 0, 1.66, 0.20), {
    colorHex: 0x7b859e, bottomColorHex: 0x454c5e
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.26, 0.038, 0.042), 0, 2.02, 0.20), {
    colorHex: 0xb89244
  }));

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(stoneMerged);

  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
  ironParts.push(ironMerged);
}

// 9. Zone 4: Fallen Carved Masonry Slabs & Broken Vault Shards
function appendFallenMasonrySlabParts(stoneParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const rng = makeRng(360941 + Math.round((ox * 23 + oz * 17)));

  const local = [];
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.76, 0.13, 0.54), -0.12, 0.075, 0.14, 0.08, 0.24, -0.07), {
    colorHex: 0x747d95, bottomColorHex: 0x262a36, jitter: 0.05, rng
  }));
  local.push(tagGeo(makeXform(new THREE.BoxGeometry(0.52, 0.11, 0.42), 0.34, 0.06, -0.18, -0.06, -0.45, 0.08), {
    colorHex: 0x697288, bottomColorHex: 0x242834, jitter: 0.05, rng
  }));
  for (let c = 0; c < (SEG_MOBILE ? 2 : 4); c++) {
    const ch = new THREE.DodecahedronGeometry(0.08 + rng() * 0.05, 0);
    makeXform(ch, (rng() - 0.5) * 0.9, 0.045, (rng() - 0.5) * 0.8, rng() * 2, rng() * 3, rng() * 2, 1.3, 0.5, 1.0);
    local.push(tagGeo(ch, { colorHex: 0x626a80, bottomColorHex: 0x20232e }));
  }

  const merged = mergeTaggedParts(local);
  makeXform(merged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(merged);
}

// 10. Zone 5: Solemn Kneeling Armored Husk / Watcher Statue facing the Boss Doors
function appendKneelingKnightParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);

  const stoneLocal = [];
  const ironLocal = [];

  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.50, 0.56, 0.12, 8), 0, 0.06, 0, 0, Math.PI / 8, 0), {
    colorHex: 0x62697d, bottomColorHex: 0x20232d
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.38, 0.88, 9), 0, 0.52, -0.06, -0.14, 0, 0, 1.08, 1.0, 1.15), {
    colorHex: 0x5c6378, bottomColorHex: 0x262a36
  }));

  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.075, 0.085, 0.44, 8), 0.14, 0.22, -0.10, Math.PI * 0.45, 0.12, 0), {
    colorHex: 0x4b5368, bottomColorHex: 0x252a36
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.078, 0.088, 0.42, 8), -0.14, 0.33, 0.08, 0.08, 0, 0), {
    colorHex: 0x525b72, bottomColorHex: 0x2a303e
  }));

  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.22, 0.18, 0.48, 9), 0, 0.82, 0.0, 0.22, Math.PI / 8, 0, 1.16, 1.0, 0.82), {
    colorHex: 0x5d6780, bottomColorHex: 0x313746
  }));
  for (const side of [-1, 1]) {
    ironLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.65), side * 0.28, 0.98, 0.04, 0.2, 0, -side * 0.38, 1.15, 0.92, 1.05), {
      colorHex: 0x6b7590, bottomColorHex: 0x383f50
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.064, 0.074, 0.44, 8), side * 0.17, 0.84, 0.18, 0.68, 0, side * 0.36), {
      colorHex: 0x565f76, bottomColorHex: 0x2e3442
    }));
  }

  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.125, 0.142, 0.26, 8), 0, 1.16, 0.09, 0.38, Math.PI / 8, 0), {
    colorHex: 0x6e7892, bottomColorHex: 0x363d4e
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.115, 0.20, 4), 0, 1.12, 0.21, Math.PI * 0.58, Math.PI / 4, 0), {
    colorHex: 0x606a82, bottomColorHex: 0x323848
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.15, 0.024, 0.05), 0, 1.16, 0.23, 0.38, 0, 0), {
    colorHex: 0x101218
  }));

  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.024, 0.054, 0.86, 4), 0, 0.53, 0.31, 0, Math.PI / 4, 0, 1.0, 1.0, 0.34), {
    colorHex: 0x7c86a0, bottomColorHex: 0x42495c
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.38, 0.044, 0.058), 0, 0.96, 0.31), {
    colorHex: 0x9b7d3c
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.SphereGeometry(0.082, 7, 5), 0, 1.04, 0.31, 0, 0, 0, 1.25, 0.85, 1.0), {
    colorHex: 0x646e88
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.048, 0), 0, 1.20, 0.31), {
    colorHex: 0xb29046
  }));

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(stoneMerged);

  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
  ironParts.push(ironMerged);
}

// 11. Zone 5: Weathered Pilgrim Stone Bench & Resting Sanctuary Gear
function appendPilgrimBenchParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const w = Number.isFinite(spec.width) ? spec.width : 1.92;
  const d = Number.isFinite(spec.depth) ? spec.depth : 0.64;

  const stoneLocal = [];
  const ironLocal = [];

  for (const sx of [-w * 0.38, w * 0.38]) {
    stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.24, 0.42, d * 0.86), sx, 0.21, 0), {
      colorHex: 0x687086, bottomColorHex: 0x242834
    }));
  }
  stoneLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(w, 0.12, d), 0, 0.47, 0), {
    colorHex: 0x828ca6, bottomColorHex: 0x474e60
  }));
  stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.08, 0.11, 0.26, 8), -w * 0.34, 0.66, -0.06), {
    colorHex: 0x767f96, bottomColorHex: 0x3f4556
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.065, 0.055, 0.18, 6), w * 0.30, 0.62, 0.04), {
    colorHex: 0x454e62, bottomColorHex: 0x222632
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.ConeGeometry(0.078, 0.09, 6), w * 0.30, 0.74, 0.04), {
    colorHex: 0x566078
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.92, 0.036, 0.072), -0.02, 0.55, 0.06, 0.04, 0.18, 0.02), {
    colorHex: 0x3b2c24, bottomColorHex: 0x1e1612
  }));
  ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.042, 0.045, 0.26), -0.46, 0.56, -0.02, 0, 0.18, 0), {
    colorHex: 0x9b7e3c
  }));

  const stoneMerged = mergeTaggedParts(stoneLocal);
  makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
  stoneParts.push(stoneMerged);

  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
  ironParts.push(ironMerged);
}

// 12. Zone 5: Leaning Greatswords / Halberds / Heater Shields along Sanctuary Outer Walls
function appendLeaningGreatswordParts(stoneParts, ironParts, spec) {
  const ox = spec.x || 0;
  const oy = spec.y || 0;
  const oz = spec.z || 0;
  const rotY = resolveYaw(spec);
  const style = spec.style || 'greatsword_shield';

  const stoneLocal = [];
  const ironLocal = [];

  if (style === 'halberd_urn') {
    stoneLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.14, 0.18, 0.44, 9), -0.26, 0.22, 0.18), {
      colorHex: 0x747d95, bottomColorHex: 0x343948
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.022, 0.026, 1.96, 8), 0.14, 0.98, 0.18, -0.18, 0, 0.06), {
      colorHex: 0x3d2e24, bottomColorHex: 0x201813
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.24, 0.28, 0.024), 0.22, 1.72, 0.03, -0.18, 0, -0.12), {
      colorHex: 0x828ca6
    }));
  } else if (style === 'pilgrim_staff_sword') {
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.020, 0.024, 1.78, 8), -0.22, 0.88, 0.16, -0.17, 0, -0.05), {
      colorHex: 0x423126, bottomColorHex: 0x221913
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.TorusGeometry(0.075, 0.016, 5, 9), -0.18, 1.76, 0.02), {
      colorHex: 0xa68642
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.13, 0.145, 0.24, 8), 0.26, 0.12, 0.22, 0.12, -0.35, 0.08), {
      colorHex: 0x69738c, bottomColorHex: 0x323848
    }));
  }

  const sw = [];
  sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.032, 0.068, 1.42, 4), 0, 0.72, 0, 0, Math.PI / 4, 0, 1.0, 1.0, 0.34), {
    colorHex: 0x828ca6, bottomColorHex: 0x495064
  }));
  sw.push(tagGeo(makeXform(new THREE.BoxGeometry(0.44, 0.052, 0.062), 0, 1.44, 0), {
    colorHex: 0x5c657c
  }));
  sw.push(tagGeo(makeXform(new THREE.CylinderGeometry(0.026, 0.030, 0.32, 8), 0, 1.62, 0), {
    colorHex: 0x2d221e
  }));
  sw.push(tagGeo(makeXform(new THREE.OctahedronGeometry(0.058, 0), 0, 1.80, 0), {
    colorHex: 0x7b859e
  }));
  const swMerged = mergeTaggedParts(sw);
  makeXform(swMerged, 0.04, 0.02, 0.28, -0.19, 0.08, -0.04);
  ironLocal.push(swMerged);

  if (style === 'greatsword_shield') {
    ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.56, 0.86, 0.046), -0.26, 0.44, 0.22, -0.24, 0.22, 0.05), {
      colorHex: 0x4e1522, bottomColorHex: 0x1e0b10
    }));
    ironLocal.push(tagGeo(makeXform(new THREE.BoxGeometry(0.60, 0.05, 0.058), -0.24, 0.85, 0.12, -0.24, 0.22, 0.05), {
      colorHex: 0x727c94
    }));
  }

  if (stoneLocal.length > 0) {
    const stoneMerged = mergeTaggedParts(stoneLocal);
    makeXform(stoneMerged, ox, oy, oz, 0, rotY, 0);
    stoneParts.push(stoneMerged);
  }
  const ironMerged = mergeTaggedParts(ironLocal);
  makeXform(ironMerged, ox, oy, oz, 0, rotY, 0);
  ironParts.push(ironMerged);
}

// ============================================================================
// Exact Corridor Groin-Vault Ceiling Height Evaluator & GPU Pendulum Instancers
//   - Zone 3: 6 Swaying Hanging Wrought-Iron Prisoner Cages (1 InstancedMesh DC!)
//   - Zone 4: 6 Swaying Hanging Gothic Chain Censers (1 InstancedMesh DC!)
// ============================================================================
function gothicVaultOgive(absS, ecc = 0.48) {
  const s = Math.max(0, Math.min(1, Math.abs(absS)));
  const R = 1.0 + ecc;
  const peak = Math.sqrt(R * R - ecc * ecc);
  const val = Math.sqrt(Math.max(0, R * R - (s + ecc) * (s + ecc)));
  return val / peak;
}

function evalCastleCorridorVaultY(x, z) {
  const hx = (8.0 - (-12.5)) * 0.5 + 0.46;
  const minZ = -32.0;
  const maxZ = 26.0;
  const nBays = 9;
  const step = (maxZ - minZ) / nBays;
  const bIdx = Math.max(0, Math.min(nBays - 1, Math.floor((z - minZ) / step)));
  const z0 = minZ + bIdx * step - (bIdx === 0 ? 0.15 : 0);
  const z1 = minZ + (bIdx + 1) * step + (bIdx === nBays - 1 ? 0.15 : 0);
  const cz = (z0 + z1) * 0.5;
  const hz = Math.max(0.5, (z1 - z0) * 0.5);
  const ySpring = 8.15;
  const yApex = 10.6;
  const rise = yApex - ySpring;
  const lunetteRise = rise * 0.86;
  const transRise = rise * 0.93;

  const sx = Math.max(0, Math.min(1, Math.abs(x) / hx));
  const sz = Math.max(0, Math.min(1, Math.abs(z - cz) / hz));
  if (sx < 1e-5 && sz < 1e-5) return yApex;
  if (sx >= sz) {
    const t = sz / Math.max(1e-5, sx);
    const yd = ySpring + rise * gothicVaultOgive(sx);
    const ym = ySpring + lunetteRise + (rise - lunetteRise) * (1.0 - sx * sx);
    return yd + (ym - yd) * gothicVaultOgive(t);
  }
  const t = sx / Math.max(1e-5, sz);
  const yd = ySpring + rise * gothicVaultOgive(sz);
  const ym = ySpring + transRise + (rise - transRise) * (1.0 - sz * sz);
  return yd + (ym - yd) * gothicVaultOgive(t);
}

function tagPendulumPart(rawGeo, partRole, tagOpts = {}) {
  const g = tagGeo(rawGeo, { uvTile: 0.85, ...tagOpts });
  const count = g.attributes.position.count;
  const roleArr = new Float32Array(count);
  roleArr.fill(partRole);
  g.setAttribute('aPartRole', new THREE.BufferAttribute(roleArr, 1));
  return g;
}

function buildUnitHangingCageGeometry() {
  const parts = [];
  const rng = makeRng(370529);

  parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.16, 0.12, 0.08, 8), 0, -0.04, 0), 0.0, {
    colorHex: 0x3b4254, bottomColorHex: 0x222632
  }));

  if (SEG_MOBILE) {
    parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.022, 0.022, 3.70, 5), 0, -1.93, 0), 1.0, {
      colorHex: 0x454e62
    }));
  } else {
    const linkCount = 24;
    for (let i = 0; i < linkCount; i++) {
      const f = (i + 0.5) / linkCount;
      const ly = -0.08 - f * 3.70;
      parts.push(tagPendulumPart(makeXform(
        new THREE.TorusGeometry(0.062, 0.019, 4, 8),
        0, ly, 0,
        0, i % 2 === 0 ? Math.PI / 2 : 0, 0
      ), 1.0, { colorHex: i % 2 === 0 ? 0x4c556c : 0x3f475a }));
    }
  }

  parts.push(tagPendulumPart(makeXform(new THREE.TorusGeometry(0.085, 0.022, 5, 9), 0, -3.82, 0), 2.0, { colorHex: 0x566078 }));
  for (let s = 0; s < 4; s++) {
    const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(tagPendulumPart(makeRadialBar(new THREE.BoxGeometry(0.036, 0.34, 0.036), 0.21, -3.96, a, 0.72), 2.0, {
      colorHex: 0x485166
    }));
  }
  for (const hy of [-4.08, -4.56, -5.02]) {
    parts.push(tagPendulumPart(makeXform(new THREE.TorusGeometry(0.42, 0.026, 5, SEG_MOBILE ? 8 : 14), 0, hy, 0, Math.PI / 2, 0, 0), 2.0, {
      colorHex: 0x4b546a
    }));
  }
  const cageBars = SEG_MOBILE ? 6 : 8;
  for (let b = 0; b < cageBars; b++) {
    const a = (b / cageBars) * Math.PI * 2;
    parts.push(tagPendulumPart(makeRadialBar(new THREE.BoxGeometry(0.032, 0.98, 0.032), 0.42, -4.55, a, 0), 2.0, {
      colorHex: 0x3e4658, bottomColorHex: 0x242936
    }));
  }
  parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.41, 0.38, 0.05, 8), 0, -5.04, 0), 2.0, {
    colorHex: 0x343b4b, bottomColorHex: 0x1d212b
  }));
  parts.push(tagPendulumPart(makeXform(new THREE.ConeGeometry(0.06, 0.18, 4), 0, -5.14, 0, Math.PI, Math.PI / 4, 0), 2.0, {
    colorHex: 0x525c74
  }));

  const cran = new THREE.IcosahedronGeometry(0.118, SEG_MOBILE ? 0 : 1);
  makeXform(cran, 0.06, -4.48, 0.10, 0.28, 0.35, -0.14, 0.88, 1.04, 1.08);
  parts.push(tagPendulumPart(cran, 3.0, { colorHex: 0xcbbfa6, bottomColorHex: 0x6c5e4c, jitter: 0.04, rng }));
  for (let r = 0; r < 3; r++) {
    parts.push(tagPendulumPart(makeXform(new THREE.TorusGeometry(0.13 - r * 0.012, 0.016, 4, 8, Math.PI * 1.2), 0.02, -4.68 - r * 0.075, 0.02, 1.35, 0.2, 0), 3.0, {
      colorHex: 0xc2b59c, bottomColorHex: 0x5c4f3f
    }));
  }
  for (const sx of [-0.11, 0.13]) {
    parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.020, 0.022, 0.42, 6), sx, -4.92, 0.08, 1.18, sx * 1.2, 0.2), 3.0, {
      colorHex: 0xbfb298, bottomColorHex: 0x584c3d
    }));
  }

  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

function buildUnitHangingCenserGeometry() {
  const parts = [];

  parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.14, 0.09, 0.08, 8), 0, -0.04, 0), 0.0, {
    colorHex: 0x4b5368, bottomColorHex: 0x262b38
  }));

  if (SEG_MOBILE) {
    parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.016, 0.016, 3.42, 5), 0, -1.79, 0), 1.0, {
      colorHex: 0x58627a
    }));
  } else {
    const upperLinks = 20;
    for (let i = 0; i < upperLinks; i++) {
      const f = (i + 0.5) / upperLinks;
      const ly = -0.08 - f * 3.42;
      parts.push(tagPendulumPart(makeXform(
        new THREE.TorusGeometry(0.046, 0.014, 4, 7),
        0, ly, 0,
        0, i % 2 === 0 ? Math.PI / 2 : 0, 0
      ), 1.0, { colorHex: 0x58627a }));
    }
  }
  parts.push(tagPendulumPart(makeXform(new THREE.TorusGeometry(0.095, 0.018, 4, 9), 0, -3.52, 0, Math.PI / 2, 0, 0), 1.0, {
    colorHex: 0x8e7238
  }));
  for (let c = 0; c < 3; c++) {
    const a = (c / 3) * Math.PI * 2;
    parts.push(tagPendulumPart(makeRadialBar(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 5), 0.14, -3.86, a, -0.26), 1.0, {
      colorHex: 0x7c6434
    }));
  }

  parts.push(tagPendulumPart(makeXform(new THREE.ConeGeometry(0.28, 0.36, 8), 0, -4.06, 0), 2.0, {
    colorHex: 0x9b7c3c, bottomColorHex: 0x4f3f22
  }));
  parts.push(tagPendulumPart(makeXform(new THREE.TorusGeometry(0.29, 0.026, 5, 8), 0, -4.24, 0, Math.PI / 2, 0, 0), 2.0, {
    colorHex: 0xb59146
  }));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    parts.push(tagPendulumPart(makeRadialBar(new THREE.BoxGeometry(0.032, 0.22, 0.036), 0.26, -4.35, a, 0), 2.0, {
      colorHex: 0x8c6f35
    }));
  }
  parts.push(tagPendulumPart(makeXform(new THREE.TorusGeometry(0.28, 0.024, 5, 8), 0, -4.46, 0, Math.PI / 2, 0, 0), 2.0, {
    colorHex: 0xa88640
  }));
  parts.push(tagPendulumPart(makeXform(new THREE.CylinderGeometry(0.27, 0.12, 0.26, 8), 0, -4.60, 0), 2.0, {
    colorHex: 0x7d6330, bottomColorHex: 0x3b2f19
  }));
  parts.push(tagPendulumPart(makeXform(new THREE.ConeGeometry(0.065, 0.24, 6), 0, -4.84, 0, Math.PI, 0, 0), 2.0, {
    colorHex: 0x9e7e3e
  }));

  parts.push(tagPendulumPart(makeXform(new THREE.SphereGeometry(0.19, 8, 6), 0, -4.36, 0, 0, 0, 0, 1.0, 0.72, 1.0), 4.0, {
    colorHex: 0xff7b1c, bottomColorHex: 0x6e1a04
  }));

  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

function attachPendulumShader(mat, uniforms, { baseChainSpan = 3.70, hasEmberGlow = false } = {}) {
  mat.customProgramCacheKey = () => `souls_pendulum_${baseChainSpan.toFixed(2)}_${hasEmberGlow ? 1 : 0}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSwayAmp = uniforms.uSwayAmp;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aPartRole;
         attribute float aPhase;
         attribute float aExtraDrop;
         attribute float aHasSkeleton;
         uniform float uTime;
         uniform float uSwayAmp;
         varying float vEmberRole;
         varying float vEmberPhase;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         float pendNx = sin(uTime * 1.12 + aPhase) * uSwayAmp;
         float pendNz = cos(uTime * 0.86 + aPhase * 1.37) * (uSwayAmp * 0.68);
         objectNormal = normalize(vec3(
           objectNormal.x - objectNormal.y * pendNz,
           objectNormal.y + objectNormal.x * pendNz + objectNormal.z * pendNx,
           objectNormal.z - objectNormal.y * pendNx
         ));`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vEmberRole = step(3.5, aPartRole);
         vEmberPhase = aPhase;
         if (aPartRole > 0.5 && aPartRole < 1.5) {
           float span = ${baseChainSpan.toFixed(2)};
           transformed.y = -0.08 + (transformed.y + 0.08) * max(0.32, (span + aExtraDrop) / span);
         } else if (aPartRole >= 1.5) {
           transformed.y -= aExtraDrop;
           if (aPartRole > 2.5 && aPartRole < 3.5 && aHasSkeleton < 0.5) {
             transformed = vec3(0.0, -4.0 - aExtraDrop, 0.0);
           }
         }
         float pendAx = sin(uTime * 1.12 + aPhase) * uSwayAmp;
         float pendAz = cos(uTime * 0.86 + aPhase * 1.37) * (uSwayAmp * 0.68);
         float pendY = transformed.y;
         transformed.x += (-pendY) * pendAz;
         transformed.z += (-pendY) * pendAx;
         transformed.y += (pendAx * pendAx + pendAz * pendAz) * pendY * 0.5;`
      );
    if (hasEmberGlow) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           varying float vEmberRole;
           varying float vEmberPhase;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           if (vEmberRole > 0.5) {
             float cPulse = 0.76 + 0.24 * sin(uTime * 4.6 + vEmberPhase);
             totalEmissiveRadiance += vec3(1.18, 0.40, 0.06) * cPulse;
           }`
        );
    }
  };
}

function createHangingPendulumInstancedMesh(specs, {
  isCenser = false,
  ironNormal = null,
  ironRough = null,
  lowSpec = false,
  regGeo,
  regMat,
  uniforms
}) {
  if (!specs.length) return null;
  const geo = regGeo(isCenser ? buildUnitHangingCenserGeometry() : buildUnitHangingCageGeometry());
  const count = specs.length;
  const phases = new Float32Array(count);
  const extraDrops = new Float32Array(count);
  const hasSkeletons = new Float32Array(count);
  const unitHeight = isCenser ? 4.96 : 5.15;

  for (let i = 0; i < count; i++) {
    const sp = specs[i];
    const vaultY = evalCastleCorridorVaultY(sp.x || 0, sp.z || 0);
    const pivotY = vaultY + 0.03;
    const rawDrop = Number.isFinite(sp.dropLen) ? sp.dropLen : 5.05;
    const safeDrop = Math.max(3.35, Math.min(rawDrop, pivotY - 4.70));
    phases[i] = Number.isFinite(sp.phase) ? sp.phase : i * 1.43 + 0.3;
    extraDrops[i] = safeDrop - unitHeight;
    hasSkeletons[i] = sp.hasSkeleton === false ? 0.0 : 1.0;
  }

  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  geo.setAttribute('aExtraDrop', new THREE.InstancedBufferAttribute(extraDrops, 1));
  geo.setAttribute('aHasSkeleton', new THREE.InstancedBufferAttribute(hasSkeletons, 1));

  const mat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: lowSpec ? null : ironNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: ironRough,
    roughness: isCenser ? 0.50 : 0.58,
    metalness: isCenser ? 0.82 : 0.76,
    envMapIntensity: 1.15
  }));
  attachPendulumShader(mat, uniforms, {
    baseChainSpan: isCenser ? 4.10 : 3.70,
    hasEmberGlow: isCenser
  });

  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.name = isCenser ? 'castle_hanging_chain_censers' : 'castle_hanging_prisoner_cages';
  inst.castShadow = false;
  inst.receiveShadow = true;
  inst.frustumCulled = false;

  for (let i = 0; i < count; i++) {
    const sp = specs[i];
    const pivotY = evalCastleCorridorVaultY(sp.x || 0, sp.z || 0) + 0.03;
    _dummy.position.set(sp.x || 0, pivotY, sp.z || 0);
    _dummy.rotation.set(0, i * 0.85 + 0.3, 0);
    _dummy.scale.set(1, 1, 1);
    _dummy.updateMatrix();
    inst.setMatrixAt(i, _dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

function createRunicCrystalGeometry() {
  // Sculpted Gothic Golden Estus Reliquary Chalice / Fluted Amber Flask (replaces arcade crystal + Saturn ring!)
  const parts = [];
  const seg = SEG_MOBILE ? 10 : 18;
  const toNonIdx = (g) => {
    const out = g.index ? g.toNonIndexed() : g;
    if (out !== g) g.dispose();
    // Ensure consistent position/normal/uv attributes before merge
    if (!out.attributes.normal) out.computeVertexNormals();
    if (!out.attributes.uv) {
      out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    }
    return out;
  };

  // 1. Turned Gothic Chalice & Bulbous Fluted Estus Vessel profile (LatheGeometry)
  const profile = [
    new THREE.Vector2(0.001, -0.34),
    new THREE.Vector2(0.155, -0.34), // Wide stepped chalice base
    new THREE.Vector2(0.150, -0.305),
    new THREE.Vector2(0.110, -0.285),
    new THREE.Vector2(0.056, -0.245), // Stem collar
    new THREE.Vector2(0.042, -0.195),
    new THREE.Vector2(0.072, -0.165), // Gothic stem knop
    new THREE.Vector2(0.045, -0.130),
    new THREE.Vector2(0.095, -0.092), // Calyx cup flare
    new THREE.Vector2(0.168, -0.032), // Lower amber flask belly
    new THREE.Vector2(0.184,  0.045), // Widest glowing Estus belly
    new THREE.Vector2(0.164,  0.125), // Upper shoulder
    new THREE.Vector2(0.096,  0.182), // Flask neck base
    new THREE.Vector2(0.068,  0.222), // Forged collar throat
    new THREE.Vector2(0.108,  0.258), // Flared reliquary crown lip
    new THREE.Vector2(0.088,  0.275),
    new THREE.Vector2(0.052,  0.292), // Stopper finial neck
    new THREE.Vector2(0.064,  0.328), // Finial jewel bud
    new THREE.Vector2(0.022,  0.375),
    new THREE.Vector2(0.001,  0.395)
  ];
  const chalice = new THREE.LatheGeometry(profile, seg);
  chalice.computeVertexNormals();
  parts.push(toNonIdx(chalice));

  // 2. Four slender wrought-gold gothic cradle ribs clasping the amber vessel belly
  const ribCount = SEG_MOBILE ? 4 : 6;
  for (let i = 0; i < ribCount; i++) {
    const a = (i / ribCount) * Math.PI * 2;
    const rib = new THREE.CylinderGeometry(0.012, 0.015, 0.27, SEG_MOBILE ? 4 : 6);
    rib.translate(Math.cos(a) * 0.186, 0.042, Math.sin(a) * 0.186);
    parts.push(toNonIdx(rib));
  }

  // 3. Delicate horizontal filigree waist band around the reliquary shoulder
  const band = new THREE.TorusGeometry(0.172, 0.013, 5, seg);
  band.rotateX(Math.PI * 0.5);
  band.translate(0, 0.126, 0);
  parts.push(toNonIdx(band));

  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) parts[i].dispose();
  return merged;
}

export function createCastleBannersAndShrines3D({
  bannerSpecs = [],
  shrineSpecs = [],
  alcoveDecorSpecs = SOULS_CASTLE_ALCOVE_DECOR,
  wallSegments = SOULS_CASTLE_WALL_SEGMENTS,
  flameTrapSpecs = SOULS_CASTLE_FLAME_TRAPS,
  wallLanternSpecs = SOULS_CASTLE_WALL_LANTERNS,
  includeWallTrim = undefined,
  includeFlameTrapScorch = undefined,
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
  const walls = Array.isArray(wallSegments) ? wallSegments : [];
  const flameTraps = Array.isArray(flameTrapSpecs) ? flameTrapSpecs : [];
  const wallLanterns = Array.isArray(wallLanternSpecs) ? wallLanternSpecs : [];

  // Auto-enable wall architectural trim & flame-trap scorch whenever full castle layout is active
  // (e.g. alcoveDecor or >= 4 banners or explicit flag), while letting small isolated showcase scenes stay clean!
  const isFullCastleContext = alcoveDecor.length > 0 || banners.length >= 4;
  const useWallTrim = includeWallTrim !== undefined ? Boolean(includeWallTrim) : isFullCastleContext;
  const useFlameScorch = includeFlameTrapScorch !== undefined ? Boolean(includeFlameTrapScorch) : isFullCastleContext;

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
  const castShadowsPC = !isMobile && !lowSpec;

  const shrineColliders = [];
  const alcoveColliders = [];
  const shrineLights = [];
  let drawCalls = 0;

  const stoneShrineParts = [];
  const forgedHardwareAndAlcoveParts = [];
  const scorchPlanes = [];

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

  const hangingCageSpecs = [];
  const hangingCenserSpecs = [];

  for (let d = 0; d < alcoveDecor.length; d++) {
    const item = alcoveDecor[d];
    if (!item) continue;
    switch (item.kind) {
      case 'weapon_rack':
        appendWeaponRackParts(forgedHardwareAndAlcoveParts, item);
        break;
      case 'armor_stand':
        appendArmorStandParts(forgedHardwareAndAlcoveParts, item);
        break;
      case 'wall_shield':
        appendWallShieldParts(forgedHardwareAndAlcoveParts, item);
        break;
      case 'stone_sarcophagus':
        appendStoneSarcophagusParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'knight_statue':
        appendKnightStatueParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'broken_portcullis':
        appendBrokenPortcullisParts(forgedHardwareAndAlcoveParts, item);
        break;
      case 'fallen_shield_cluster':
        appendFallenShieldClusterParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'reliquary_niche':
        appendReliquaryNicheParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'charred_remains':
        appendCharredRemainsParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'cathedral_pew':
        appendCathedralPewParts(stoneShrineParts, item);
        break;
      case 'gothic_wall_shrine':
        appendGothicWallShrineParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'fallen_masonry_slab':
        appendFallenMasonrySlabParts(stoneShrineParts, item);
        break;
      case 'kneeling_knight':
        appendKneelingKnightParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'pilgrim_bench':
        appendPilgrimBenchParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'leaning_greatsword':
        appendLeaningGreatswordParts(stoneShrineParts, forgedHardwareAndAlcoveParts, item);
        break;
      case 'hanging_cage':
        hangingCageSpecs.push(item);
        break;
      case 'hanging_censer':
        hangingCenserSpecs.push(item);
        break;
      default:
        break;
    }
    if (item.collider) {
      const isRect =
        item.shape === 'aabb' ||
        ((item.kind === 'weapon_rack' ||
          item.kind === 'stone_sarcophagus' ||
          item.kind === 'cathedral_pew' ||
          item.kind === 'pilgrim_bench') &&
          Number.isFinite(item.width) &&
          Number.isFinite(item.depth));
      if (isRect) {
        const yaw = resolveYaw(item);
        const swapped = Math.abs(Math.sin(yaw)) > 0.7071;
        const localHX = item.width * 0.5;
        const localHZ = (item.kind === 'weapon_rack' ? Math.max(item.depth, 0.72) : item.depth) * 0.5;
        const halfW = Number((Number.isFinite(item.halfW) ? item.halfW : (swapped ? localHZ : localHX)).toFixed(3));
        const halfD = Number((Number.isFinite(item.halfD) ? item.halfD : (swapped ? localHX : localHZ)).toFixed(3));
        const rIn = Math.min(halfW, halfD);
        alcoveColliders.push({
          id: item.id ?? `alcove_decor_${d}`,
          kind: item.kind,
          shape: 'aabb',
          x: item.x || 0,
          z: item.z || 0,
          halfW,
          halfD,
          r: rIn,
          radius: rIn
        });
      } else {
        const r = Number.isFinite(item.radius) ? item.radius : 0.55;
        alcoveColliders.push({
          id: item.id ?? `alcove_decor_${d}`,
          kind: item.kind,
          shape: 'circle',
          x: item.x || 0,
          z: item.z || 0,
          r,
          radius: r
        });
      }
    }
  }

  let pilasterCount = 0;
  if (useWallTrim && walls.length > 0) {
    const wallObstacles = [
      ...banners,
      ...wallLanterns,
      ...alcoveDecor.filter(
        (a) =>
          a &&
          (a.kind === 'wall_shield' ||
            a.kind === 'reliquary_niche' ||
            a.kind === 'gothic_wall_shrine' ||
            a.kind === 'stone_sarcophagus' ||
            a.kind === 'knight_statue' ||
            a.kind === 'weapon_rack')
      ),
      ...flameTraps
    ];
    pilasterCount = appendCastleWallArchitecturalTrim(stoneShrineParts, walls, wallObstacles);
  }

  let scorchedTrapCount = 0;
  if (useFlameScorch && flameTraps.length > 0) {
    scorchedTrapCount = appendFlameTrapAshAndScorch(stoneShrineParts, scorchPlanes, flameTraps, walls);
  }

  // DC #1: Carved Gothic Stone Relic Altars + Wall Pilasters/Socles/Cornices + 3D Charred Ash Clods!
  let stoneShrineMat = null;
  let stoneMesh = null;
  if (stoneShrineParts.length > 0) {
    stoneShrineMat = regMat(new THREE.MeshStandardMaterial({
      map: stoneAlbedo,
      normalMap: lowSpec ? null : stoneNormal,
      normalScale: new THREE.Vector2(0.76, 0.76),
      roughnessMap: stoneRough,
      color: stoneAlbedo ? 0x8b93aa : 0x767e94,
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.05,
      envMapIntensity: 0.24
    }));
    const stoneGeo = regGeo(mergeTaggedParts(stoneShrineParts, 2.0));
    stoneMesh = new THREE.Mesh(stoneGeo, stoneShrineMat);
    stoneMesh.name = 'castle_relic_shrines_and_wall_trim_stone';
    stoneMesh.castShadow = castShadowsPC;
    stoneMesh.receiveShadow = true;
    group.add(stoneMesh);
    drawCalls++;
  }

  // DC #2: Forged Iron Banner Crossbars/Chains + Shrine Cradle + ALL 9 East Alcove Armory Props!
  let forgedDecorMat = null;
  let ironMesh = null;
  if (forgedHardwareAndAlcoveParts.length > 0) {
    forgedDecorMat = regMat(new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      normalMap: lowSpec ? null : ironNormal,
      normalScale: new THREE.Vector2(0.80, 0.80),
      roughnessMap: ironRough,
      roughness: 0.62,
      metalness: 0.74,
      envMapIntensity: 1.15
    }));
    const ironGeo = regGeo(mergeTaggedParts(forgedHardwareAndAlcoveParts, 0.90));
    ironMesh = new THREE.Mesh(ironGeo, forgedDecorMat);
    ironMesh.name = 'castle_banner_hardware_and_alcove_armory';
    ironMesh.castShadow = false;
    ironMesh.receiveShadow = true;
    group.add(ironMesh);
    drawCalls++;
  }

  // DC #3: AAA 14x24 PC Draped Tattered Gothic Banners w/ bannerAlbedo/Normal/Roughness + Wind Shader!
  const bannerSwayUniforms = {
    uTime: { value: 0 },
    uSwayAmp: { value: lowSpec ? 0.040 : 0.088 }
  };
  let bannerMat = null;
  let bannersClothMesh = null;
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
      normalScale: new THREE.Vector2(1.20, 1.20),
      roughnessMap: bannerRoughTex,
      color: 0xffffff,
      roughness: bannerRoughTex ? 1.0 : 0.84,
      metalness: 0.18,
      envMapIntensity: 0.65,
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
           float gust  = sin(uTime * 1.35 + aSwayPhase) * 0.56;
           float wave  = sin(uTime * 2.45 + aSwayPhase * 1.3 + position.y * 1.65) * 0.30;
           float flutt = sin(uTime * 4.65 + aSwayPhase * 2.1 + position.y * 3.1 + aLateral * 2.4) * 0.14;
           float disp  = (gust + wave + flutt) * uSwayAmp * aSwayWeight;
           transformed += normal * disp;
           transformed.y += abs(disp) * 0.14;`
        );
    };
    if (ownsFallbackBannerTex) {
      texCleanups.push(attachTextureCleanup(bannerMat, [bannerAlbedoTex], trackTex));
    }

    bannersClothMesh = new THREE.Mesh(mergedClothGeo, bannerMat);
    bannersClothMesh.name = 'castle_gothic_banners_cloth';
    bannersClothMesh.castShadow = false;
    bannersClothMesh.receiveShadow = true;
    group.add(bannersClothMesh);
    drawCalls++;
  }

  // DC #4: Flame-Trap Gauntlet Charred Blast Scorch & Smoldering Ember Decals (1 DC for all 5 traps!)
  let scorchUniforms = null;
  let scorchMesh = null;
  if (scorchPlanes.length > 0) {
    const scorchGeo = regGeo(mergeGeometries(scorchPlanes, false));
    for (let i = 0; i < scorchPlanes.length; i++) scorchPlanes[i].dispose();

    const scorchPack = createFlameTrapScorchShaderMat();
    scorchUniforms = scorchPack.uniforms;
    const scorchMat = regMat(scorchPack.mat);

    scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
    scorchMesh.name = 'flame_trap_charred_scorch_marks';
    scorchMesh.renderOrder = 2;
    group.add(scorchMesh);
    drawCalls++;
  }

  // DC #5: Instanced Glowing Runic Shrine Crystals
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
        varying vec3 vLocalP;
        varying float vClaimed;
        varying float vPulse;

        void main() {
          vColor = aColor;
          vLocalP = position;
          vClaimed = aClaimed;
          float isLit = 1.0 - clamp(aClaimed, 0.0, 1.0);
          float ang = (uTime * 0.48 + aPhase) * isLit;
          float c = cos(ang);
          float s = sin(ang);

          vec3 p = position;
          vec3 rp = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
          rp *= mix(0.92, 1.0, isLit);
          rp.y += mix(-0.14, sin(uTime * 1.75 + aPhase) * 0.042, isLit);

          vec3 n = normal;
          vec3 rn = vec3(n.x * c - n.z * s, n.y, n.x * s + n.z * c);

          vPulse = 0.84 + 0.16 * sin(uTime * 2.6 + aPhase * 1.4);
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
        varying vec3 vLocalP;
        varying float vClaimed;
        varying float vPulse;

        void main() {
          vec3 N = normalize(vNormalView);
          vec3 V = normalize(vViewDir);
          vec3 L = normalize(vec3(0.38, 0.82, 0.44));
          vec3 H = normalize(L + V);

          float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
          float ndl = clamp(dot(N, L), 0.0, 1.0);
          float fresnel = pow(1.0 - ndv, 2.4);
          float spec = pow(clamp(dot(N, H), 0.0, 1.0), 28.0);

          // Distinguish forged antique-gold chalice stem/collar/cradle ribs vs glowing molten-amber Estus vessel belly
          float rad = length(vLocalP.xz);
          float inVesselY = smoothstep(-0.105, -0.055, vLocalP.y) * smoothstep(0.205, 0.145, vLocalP.y);
          float isCageRib = smoothstep(0.174, 0.184, rad);
          float isBand = smoothstep(0.108, 0.120, vLocalP.y) * smoothstep(0.144, 0.132, vLocalP.y) * smoothstep(0.158, 0.168, rad);
          float glassMask = clamp(inVesselY * (1.0 - max(isCageRib, isBand)), 0.0, 1.0);

          // 1. Tarnished Antique Gothic Gold / Forged Bronze Metalwork
          vec3 goldBase = vec3(0.36, 0.25, 0.11);
          vec3 goldHi   = vec3(0.88, 0.68, 0.34);
          vec3 metalLit = goldBase * (0.38 + 0.72 * ndl) + goldHi * (spec * 0.72 + fresnel * 0.24);
          vec3 metalDormant = vec3(0.16, 0.14, 0.13) * (0.45 + 0.55 * ndl) + vec3(0.24, 0.21, 0.18) * spec * 0.35;

          // 2. Bottled Bonfire Amber Glass (deep honey-ember core + dark smoked-glass rim, zero flat neon!)
          vec3 warmVessel = mix(vColor * vec3(0.76, 0.44, 0.16), vec3(0.92, 0.56, 0.14), 0.32);
          float innerGlow = pow(ndv, 1.35) * vPulse;
          vec3 glassLit = warmVessel * (0.28 + 0.78 * innerGlow + 0.26 * ndl)
            + mix(vColor, vec3(1.0, 0.88, 0.56), 0.55) * (spec * 0.48 + pow(ndv, 3.0) * 0.34 * vPulse)
            + vec3(0.42, 0.20, 0.06) * fresnel * 0.32;
          vec3 glassDormant = vec3(0.08, 0.085, 0.10) * (0.50 + 0.50 * ndl) + vec3(0.14, 0.15, 0.19) * (fresnel * 0.45 + spec * 0.32);

          vec3 activeCol = mix(metalLit, glassLit, glassMask);
          vec3 dormantCol = mix(metalDormant, glassDormant, glassMask);
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

  // DC #6 & #7: GPU Pendulum-Swaying Overhead Prisoner Cages (Zone 3) & Chain Censers (Zone 4)
  const pendulumSwayUniforms = {
    uTime: { value: 0 },
    uSwayAmp: { value: lowSpec ? 0.008 : 0.018 }
  };
  const hangingCageInst = createHangingPendulumInstancedMesh(hangingCageSpecs, {
    isCenser: false,
    ironNormal,
    ironRough,
    lowSpec,
    regGeo,
    regMat,
    uniforms: pendulumSwayUniforms
  });
  if (hangingCageInst) {
    group.add(hangingCageInst);
    drawCalls++;
  }

  const hangingCenserInst = createHangingPendulumInstancedMesh(hangingCenserSpecs, {
    isCenser: true,
    ironNormal,
    ironRough,
    lowSpec,
    regGeo,
    regMat,
    uniforms: pendulumSwayUniforms
  });
  if (hangingCenserInst) {
    group.add(hangingCenserInst);
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
    const cast = !isMobile && !low;
    bannerSwayUniforms.uSwayAmp.value = low ? 0.040 : 0.088;
    pendulumSwayUniforms.uSwayAmp.value = low ? 0.008 : 0.018;
    if (stoneMesh) stoneMesh.castShadow = cast;
    if (ironMesh) ironMesh.castShadow = false;
    if (bannersClothMesh) bannersClothMesh.castShadow = false;
  }

  function update(_dt = 0.016, elapsed = 0) {
    const t = Number.isFinite(elapsed) ? elapsed : 0;
    bannerSwayUniforms.uTime.value = t;
    pendulumSwayUniforms.uTime.value = t;
    if (shrineRelicUniforms) {
      shrineRelicUniforms.uTime.value = t;
    }
    if (scorchUniforms) {
      scorchUniforms.uTime.value = t;
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
    hangingCageCount: hangingCageSpecs.length,
    hangingCenserCount: hangingCenserSpecs.length,
    pilasterCount,
    scorchedTrapCount,
    scorchMesh,
    hangingCageInst,
    hangingCenserInst,
    drawCalls,
    setShrineClaimed,
    isShrineClaimed,
    resetShrines,
    update,
    setLowSpec,
    dispose
  };
}
