// Procedural Realistic Volumetric Fire VFX Module (Three.js r160, Vanilla ES Module)
// Chapter 26 вЂ” В«Abandoned Knight RiftВ»
//
// Authentic physical combustion fire built with domain-warped 2D+3D Simplex FBM noise,
// sculpted curved 3D flame ribbons (zero flat-card cross artifacts), balanced NormalBlending
// dark-crimson/golden-orange flame silhouettes + tight AdditiveBlending incandescent core,
// per-instance helical vertex sway/curl desynchronization, GPU rising sparks & curling smoke.
//
// Exports:
//   - createRealisticFireMaterial(opts)
//   - createBonfireFlameAssembly(opts)
//   - createInstancedBrazierFlames(positions, opts)
//   - createInstancedWallLanternFlames(positions, opts)
//   - createCandleFlameShaderMaterial(opts)
//   - createCandleFlameTeardropGeometry(opts)
//   - createHammerFireTrailMaterial(opts)
//   - createWallFlameJetTraps(trapSpecs, opts)
//   - createVolumetricFireFieldMesh(opts)
//   - createVolumetricFireRoadMesh(opts)
//   - createPhase2ArenaFireRingController(opts)
//
// Every returned object & material supports:
//   .update(time, dt), .setLowSpec(enabled), .dispose() (0 WebGL leaks).

import * as THREE from '../../vendor/three.module.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

// ============================================================================
// Device Detection, Deterministic PRNG & Reusable Math Scratch
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

const IS_MOBILE_DEFAULT = detectMobileDevice();

function makeRng(seedInit) {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function getSafePixelRatio(isMobile, lowSpec) {
  const raw = typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
    ? window.devicePixelRatio
    : 1.0;
  if (lowSpec) return Math.min(raw, 1.0);
  return Math.min(raw, isMobile ? 1.15 : 1.5);
}

function toColorVec3(input, fallbackHex) {
  const c = new THREE.Color();
  if (input && input.isColor) {
    c.copy(input);
  } else if (Array.isArray(input) && input.length >= 3) {
    return new THREE.Vector3(input[0], input[1], input[2]);
  } else if (input !== undefined && input !== null) {
    c.set(input);
  } else {
    c.setHex(fallbackHex);
  }
  return new THREE.Vector3(c.r, c.g, c.b);
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

const _dummy = new THREE.Object3D();

// ============================================================================
// Shared GLSL Noise Library вЂ” Compact Analytical 2D & 3D Simplex Noise + FBM
// Zero ANGLE/D3D11 X4000 warnings (strict single-exit initialized return vars!).
// Mobile (#ifdef FIRE_MOBILE_FAST) & LowSpec (uDetail <= 0.5):
//   - Analytical sin/cos curl domain warp (0 Simplex warp calls!)
//   - Strictly <= 2 octaves of 2D Simplex noise (0 snoise3 -> ~-60% fragment ALU!)
// Desktop High (uDetail > 0.5):
//   - Full 2D domain warp + 3-octave 3D+2D Simplex FBM turbulence!
// ============================================================================
const GLSL_SIMPLEX_NOISE = /* glsl */ `
vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute3(vec3 x) { return mod289_3(((x * 34.0) + 10.0) * x); }

// Analytical 2D Simplex Noise in [-1, 1]
float snoise2(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,   // 0.5 * (sqrt(3.0) - 1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289_2(i);
  vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

#ifndef FIRE_MOBILE_FAST
vec4 mod289_4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute4(vec4 x) { return mod289_4(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Analytical 3D Simplex Noise in [-1, 1] (Desktop High only вЂ” stripped on Mobile!)
float snoise3(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289_3(i);
  vec4 p = permute4(
    permute4(
      permute4(i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0)
    )
    + i.x + vec4(0.0, i1.x, i2.x, 1.0)
  );
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt4(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
#endif

// Domain warp: analytical sin/cos curl on Mobile/LowSpec (0 Simplex calls),
// dual 2D Simplex eddies on Desktop High. Single-exit initialized return (0 X4000 warnings).
vec2 fireDomainWarp(vec2 coord, float detail) {
  vec2 res = vec2(0.0);
#ifdef FIRE_MOBILE_FAST
  float sx = sin(coord.y * 2.35 + coord.x * 1.45) * 0.65 + cos(coord.y * 4.10 - coord.x * 2.15) * 0.35;
  float sy = cos(coord.x * 2.25 - coord.y * 1.65) * 0.65 + sin(coord.x * 3.85 + coord.y * 2.40) * 0.35;
  res = vec2(sx, sy);
#else
  if (detail > 0.5) {
    res = vec2(snoise2(coord), snoise2(coord + vec2(5.2, 1.3)));
  } else {
    float sx = sin(coord.y * 2.35 + coord.x * 1.45) * 0.65 + cos(coord.y * 4.10 - coord.x * 2.15) * 0.35;
    float sy = cos(coord.x * 2.25 - coord.y * 1.65) * 0.65 + sin(coord.x * 3.85 + coord.y * 2.40) * 0.35;
    res = vec2(sx, sy);
  }
#endif
  return res;
}

// Volumetric flame FBM:
//   - Mobile / LowSpec: strictly 2 octaves of 2D Simplex (0 snoise3 -> ~-60% ALU!)
//   - Desktop High: 3 octaves (3D Simplex volumetric swirl + 2D licking + 2D fine filaments)
// Strict single-exit initialized variable avoids ANGLE/D3D11 warning X4000!
vec2 fireTurbulenceFbm(vec3 p3, vec2 p2, float detail) {
  vec2 res = vec2(0.0);
#ifdef FIRE_MOBILE_FAST
  vec2 p2Coarse = vec2(p2.x * 0.54 + (p3.x - p3.y) * 0.22, p2.y * 0.56);
  float n1 = snoise2(p2Coarse) * 0.5 + 0.5;
  float n2 = snoise2(p2) * 0.5 + 0.5;
  float ridged = 1.0 - abs(n2 * 2.0 - 1.0);
  res = vec2(n1 * 0.58 + n2 * 0.42, ridged);
#else
  if (detail > 0.5) {
    float n1 = snoise3(p3) * 0.5 + 0.5;
    float n2 = snoise2(p2) * 0.5 + 0.5;
    float n3 = snoise2(p2 * 2.13 + vec2(3.7, -1.9)) * 0.5 + 0.5;
    float ridged = 1.0 - abs(n2 * 2.0 - 1.0);
    float fbm = n1 * 0.52 + n2 * 0.31 + n3 * 0.17;
    float fil = ridged * 0.62 + (1.0 - abs(n3 * 2.0 - 1.0)) * 0.38;
    res = vec2(fbm, fil);
  } else {
    vec2 p2Coarse = vec2(p2.x * 0.54 + (p3.x - p3.y) * 0.22, p2.y * 0.56);
    float n1 = snoise2(p2Coarse) * 0.5 + 0.5;
    float n2 = snoise2(p2) * 0.5 + 0.5;
    float ridged = 1.0 - abs(n2 * 2.0 - 1.0);
    res = vec2(n1 * 0.58 + n2 * 0.42, ridged);
  }
#endif
  return res;
}
`;

// ============================================================================
// Curved 3D Flame Ribbon & Crown Geometry Builders (Merged, Zero Flat Cross!)
// Every geometry carries: position, normal, uv, aFlameMeta (vec4):
//   aFlameMeta.x = per-ribbon phase offset (default 0.0)
//   aFlameMeta.y = per-ribbon temperature bias (default 0.0)
//   aFlameMeta.z = layer role (-1.0 haze, 0.0 flame body, +1.0 hot inner core; default 0.0)
//   aFlameMeta.w = sway amplitude multiplier (default 1.0)
// Note: WebGL default for missing attribute is (0, 0, 0, 1) -> exact neutral defaults!
// ============================================================================
function normalizeForMerge(rawGeo, phaseOffset = 0.0, heatBias = 0.0, layerRole = 0.0, swayScale = 1.0) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  if (g !== rawGeo) rawGeo.dispose();

  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') {
      g.deleteAttribute(name);
    }
  }
  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  const count = g.attributes.position.count;
  const meta = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    meta[i * 4] = phaseOffset;
    meta[i * 4 + 1] = heatBias;
    meta[i * 4 + 2] = layerRole;
    meta[i * 4 + 3] = swayScale;
  }
  g.setAttribute('aFlameMeta', new THREE.BufferAttribute(meta, 4));
  return g;
}

function mergeFlameParts(parts) {
  const merged = mergeGeometries(parts, false);
  for (let i = 0; i < parts.length; i++) {
    parts[i].dispose();
  }
  return merged;
}

/**
 * Builds a single curved, cupped, gently twisting 3D flame ribbon.
 * Reads sculptural & volumetric from eye-level and top-down Souls cameras alike.
 */
function createCurvedFlameRibbon({
  width = 1.0,
  height = 1.5,
  segX = 3,
  segY = 8,
  cupDepth = 0.14,
  twist = 0.35,
  leanOut = 0.06,
  inwardTip = 0.14,
  radialOffset = 0.0,
  yOffset = 0.0,
  angle = 0.0,
  phaseOffset = 0.0,
  heatBias = 0.0,
  layerRole = 0.0,
  swayScale = 1.0
} = {}) {
  const plane = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = plane.attributes.position;
  const uv = plane.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i); // 0..1 across width
    const v = uv.getY(i); // 0..1 base to tip
    const uCentered = (u - 0.5) * 2.0; // -1..+1

    // Slight organic width profile: fuller lower belly, subtle narrowing at very top
    const widthProfile = 1.0 + Math.sin(v * Math.PI) * 0.12 - v * v * 0.24;
    let lx = pos.getX(i) * widthProfile;
    let ly = v * height;

    // Concave horizontal cupping so ribbon hugs the flame volume from above
    const cup = cupDepth * (1.0 - uCentered * uCentered) * (0.45 + 0.55 * Math.sin(v * Math.PI));
    // Graceful S-profile: flares subtly outward at lower belly, curls inward toward spire tip
    const sBow = Math.sin(v * Math.PI * 1.15) * leanOut - Math.pow(v, 1.55) * inwardTip;
    let lz = cup + sBow;

    // Gentle helical twist around ribbon vertical spine
    const tw = twist * Math.pow(v, 1.25);
    const ct = Math.cos(tw);
    const st = Math.sin(tw);
    const tx = lx * ct - lz * st;
    const tz = lx * st + lz * ct;

    pos.setXYZ(i, tx, ly + yOffset, tz + radialOffset);
  }

  plane.rotateY(angle);
  plane.computeVertexNormals();
  return normalizeForMerge(plane, phaseOffset, heatBias, layerRole, swayScale);
}

/**
 * Hero Bonfire 3-Axis Multi-Layered Sculpted Flame Body Crown (1 merged geometry)
 * When embedCore=true (Mobile single-pass), appends compact bright inner core ribbons (layerRole=1.0)
 * in the SAME draw call (-1 DC, -50% overdraw!).
 */
function createBonfireBodyCrownGeometry(scale = 1.0, embedCore = false) {
  const parts = [];
  const hiPoly = !embedCore;

  // Tier A: 3 intersecting curved central fins (0В°, 60В°, 120В°) forming the roaring spine around the Coiled Sword
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI;
    parts.push(createCurvedFlameRibbon({
      width: 1.26 * scale,
      height: (1.78 + (i % 2) * 0.18) * scale,
      segX: hiPoly ? 6 : 3,
      segY: hiPoly ? 15 : 9,
      cupDepth: 0.17 * scale,
      twist: (i % 2 === 0 ? 0.44 : -0.40),
      leanOut: 0.07 * scale,
      inwardTip: 0.05 * scale,
      radialOffset: 0.0,
      yOffset: -0.02 * scale,
      angle: ang,
      phaseOffset: i * 2.09,
      heatBias: 0.11,
      layerRole: 0.0,
      swayScale: 1.0
    }));
  }

  // Tier B: 6 outer cupped/fluted flame petals hugging the glowing coal mound (lush wide 3D campfire volume!)
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2.0 + 0.26;
    const tall = i % 2 === 0;
    parts.push(createCurvedFlameRibbon({
      width: (tall ? 0.88 : 0.76) * scale,
      height: (tall ? 1.52 : 1.24) * scale,
      segX: hiPoly ? 5 : 3,
      segY: hiPoly ? 12 : 8,
      cupDepth: -0.17 * scale, // Cups outward away from center like real licking campfire walls
      twist: (tall ? 0.36 : -0.32),
      leanOut: 0.16 * scale,
      inwardTip: 0.33 * scale, // Tips curl back inward toward the rising draft column!
      radialOffset: (tall ? 0.28 : 0.34) * scale,
      yOffset: -0.04 * scale,
      angle: ang,
      phaseOffset: 1.15 + i * 1.37,
      heatBias: -0.03,
      layerRole: 0.0,
      swayScale: 1.14
    }));
  }

  // Tier C: 3 tall flickering upper spire licks that curl up past the sword hilt & dissolve into dark smoke plumes
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2.0 + 0.52;
    parts.push(createCurvedFlameRibbon({
      width: 0.60 * scale,
      height: (2.16 + i * 0.10) * scale,
      segX: hiPoly ? 4 : 2,
      segY: hiPoly ? 13 : 8,
      cupDepth: 0.11 * scale,
      twist: (i === 1 ? -0.58 : 0.54),
      leanOut: 0.07 * scale,
      inwardTip: 0.16 * scale,
      radialOffset: 0.13 * scale,
      yOffset: 0.05 * scale,
      angle: ang,
      phaseOffset: 3.4 + i * 2.27,
      heatBias: -0.08,
      layerRole: 0.0,
      swayScale: 1.38
    }));
  }

  // Mobile single-pass embedded incandescent heart (layerRole = 1.0, drawn on top in same 1 DC!)
  if (embedCore) {
    for (let i = 0; i < 2; i++) {
      const ang = i * Math.PI * 0.5 + 0.35;
      parts.push(createCurvedFlameRibbon({
        width: 0.50 * scale,
        height: 0.90 * scale,
        segX: 2,
        segY: 5,
        cupDepth: 0.08 * scale,
        twist: i === 0 ? 0.24 : -0.22,
        leanOut: 0.02 * scale,
        inwardTip: 0.02 * scale,
        radialOffset: 0.0,
        yOffset: 0.04 * scale,
        angle: ang,
        phaseOffset: 0.7 + i * 1.93,
        heatBias: 0.30,
        layerRole: 1.0,
        swayScale: 0.68
      }));
    }
  }

  return mergeFlameParts(parts);
}

/**
 * Compact Inner Incandescent Heart Geometry (AdditiveBlending core pass)
 */
function createInnerCoreCrownGeometry(width = 0.58, height = 0.96, segX = 2, segY = 6) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI + 0.35;
    parts.push(createCurvedFlameRibbon({
      width,
      height,
      segX,
      segY,
      cupDepth: width * 0.15,
      twist: i % 2 === 0 ? 0.28 : -0.25,
      leanOut: width * 0.04,
      inwardTip: width * 0.04,
      radialOffset: 0.0,
      yOffset: 0.0,
      angle: ang,
      phaseOffset: 0.7 + i * 2.13,
      heatBias: 0.22,
      layerRole: 1.0,
      swayScale: 0.72
    }));
  }
  return mergeFlameParts(parts);
}

/**
 * Floor Brazier Sculpted Flame Crown Geometry (6 curved ribbons snugly fitting the 8-bar iron cage)
 * When embedCore=true (Mobile single-pass), embeds a compact incandescent heart (layerRole=1.0)
 * in the SAME 1 InstancedMesh draw call (-1 DC, -50% overdraw across all 12 braziers!).
 */
function createBrazierFlameCrownGeometry(width = 0.76, height = 1.18, embedCore = false) {
  const parts = [];
  const hiPoly = !embedCore;
  // 3 central curved intersecting fins
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI;
    parts.push(createCurvedFlameRibbon({
      width: width * 0.95,
      height: height * (i === 1 ? 1.09 : 0.97),
      segX: hiPoly ? 5 : 3,
      segY: hiPoly ? 12 : 7,
      cupDepth: width * 0.15,
      twist: i % 2 === 0 ? 0.40 : -0.36,
      leanOut: width * 0.05,
      inwardTip: width * 0.05,
      radialOffset: 0.0,
      yOffset: 0.0,
      angle: ang,
      phaseOffset: i * 2.11,
      heatBias: 0.07,
      layerRole: 0.0,
      swayScale: 1.0
    }));
  }
  // 3 cupped peripheral flame licks rising inside the iron ribs
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2.0 + 0.52;
    parts.push(createCurvedFlameRibbon({
      width: width * 0.64,
      height: height * 0.86,
      segX: hiPoly ? 4 : 2,
      segY: hiPoly ? 10 : 6,
      cupDepth: -width * 0.15,
      twist: i % 2 === 0 ? -0.32 : 0.32,
      leanOut: width * 0.10,
      inwardTip: width * 0.24,
      radialOffset: width * 0.23,
      yOffset: -0.01,
      angle: ang,
      phaseOffset: 1.3 + i * 2.03,
      heatBias: -0.03,
      layerRole: 0.0,
      swayScale: 1.15
    }));
  }
  if (embedCore) {
    for (let i = 0; i < 2; i++) {
      const ang = i * Math.PI * 0.5 + 0.35;
      parts.push(createCurvedFlameRibbon({
        width: width * 0.52,
        height: height * 0.58,
        segX: 2,
        segY: 4,
        cupDepth: width * 0.08,
        twist: i === 0 ? 0.22 : -0.20,
        leanOut: 0.0,
        inwardTip: 0.0,
        radialOffset: 0.0,
        yOffset: height * 0.03,
        angle: ang,
        phaseOffset: 0.85 + i * 1.57,
        heatBias: 0.30,
        layerRole: 1.0,
        swayScale: 0.62
      }));
    }
  }
  return mergeFlameParts(parts);
}

/**
 * Wall Lantern Single-Draw-Call Multi-Layer Geometry:
 *   1. Soft warm lantern-glass mantle (layerRole = -1.0, drawn first)
 *   2. 3 curved dancing flame ribbons (layerRole = 0.0, drawn second)
 *   3. Compact bright incandescent heart (layerRole = +1.0, drawn last)
 */
function createWallLanternSinglePassGeometry(width = 0.28, height = 0.42) {
  const parts = [];

  // Layer -1: Subtle warm forged-glass amber haze cylinder tucked inside the 6 iron cage ribs
  const glassBarrel = new THREE.CylinderGeometry(width * 0.50, width * 0.42, height * 0.78, 6, 1, true);
  glassBarrel.translate(0, height * 0.42, 0);
  parts.push(normalizeForMerge(glassBarrel, 0.0, 0.0, -1.0, 0.18));

  // Layer 0: 3 curved volumetric licking flame tongues
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI;
    parts.push(createCurvedFlameRibbon({
      width,
      height: height * (i === 1 ? 1.06 : 0.95),
      segX: 2,
      segY: 6,
      cupDepth: width * 0.15,
      twist: i % 2 === 0 ? 0.34 : -0.30,
      leanOut: width * 0.04,
      inwardTip: width * 0.05,
      radialOffset: 0.0,
      yOffset: 0.0,
      angle: ang,
      phaseOffset: i * 2.09,
      heatBias: 0.02,
      layerRole: 0.0,
      swayScale: 0.92
    }));
  }

  // Layer +1: Compact incandescent inner white-yellow heart (rendered on top in same 1 DC!)
  for (let i = 0; i < 2; i++) {
    const ang = i * Math.PI * 0.5 + 0.4;
    parts.push(createCurvedFlameRibbon({
      width: width * 0.50,
      height: height * 0.54,
      segX: 2,
      segY: 4,
      cupDepth: width * 0.08,
      twist: 0.18,
      leanOut: 0.0,
      inwardTip: 0.0,
      radialOffset: 0.0,
      yOffset: height * 0.02,
      angle: ang,
      phaseOffset: 0.8 + i * 1.57,
      heatBias: 0.28,
      layerRole: 1.0,
      swayScale: 0.55
    }));
  }

  return mergeFlameParts(parts);
}

/**
 * Bonus helper: Smooth high-craft 3D teardrop geometry for candles
 * (also matches soulsCastleProps.js 0..0.135m candle flame scale cleanly!)
 */
export function createCandleFlameTeardropGeometry({
  height = 0.145,
  radius = 0.027,
  radialSegments = IS_MOBILE_DEFAULT ? 8 : 14
} = {}) {
  const pts = [
    new THREE.Vector2(0.001, 0.000 * height),
    new THREE.Vector2(0.55 * radius, 0.08 * height),
    new THREE.Vector2(0.96 * radius, 0.22 * height),
    new THREE.Vector2(1.00 * radius, 0.36 * height),
    new THREE.Vector2(0.76 * radius, 0.56 * height),
    new THREE.Vector2(0.42 * radius, 0.78 * height),
    new THREE.Vector2(0.14 * radius, 0.93 * height),
    new THREE.Vector2(0.001, 1.00 * height)
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegments);
  geo.computeVertexNormals();
  return geo;
}

// ============================================================================
// Preset Tuning Table for createRealisticFireMaterial
// ============================================================================
const FIRE_PRESETS = {
  bonfire: {
    speed: 2.55,
    sway: 0.14,
    curlTwist: 0.42,
    freqX: 3.1,
    freqY: 2.4,
    warpStrength: 0.48,
    taperPower: 0.80,
    coreStrength: 1.08,
    alphaStrength: 0.94,
    grazingFade: 0.56
  },
  brazier: {
    speed: 2.85,
    sway: 0.11,
    curlTwist: 0.38,
    freqX: 3.4,
    freqY: 2.7,
    warpStrength: 0.46,
    taperPower: 0.84,
    coreStrength: 1.05,
    alphaStrength: 0.94,
    grazingFade: 0.50
  },
  lantern: {
    speed: 2.35,
    sway: 0.065,
    curlTwist: 0.24,
    freqX: 3.2,
    freqY: 2.5,
    warpStrength: 0.38,
    taperPower: 0.88,
    coreStrength: 1.12,
    alphaStrength: 0.93,
    grazingFade: 0.38
  },
  torch: {
    speed: 3.15,
    sway: 0.15,
    curlTwist: 0.46,
    freqX: 3.6,
    freqY: 2.8,
    warpStrength: 0.50,
    taperPower: 0.78,
    coreStrength: 1.06,
    alphaStrength: 0.94,
    grazingFade: 0.48
  }
};

// ============================================================================
// 1. REALISTIC MULTI-LAYER SIMPLEX 2D+3D FBM FIRE SHADER MATERIAL
//    - NormalBlending outer/body layer (sharp dark-crimson ragged licks + vivid
//      golden-orange body + incandescent yellow-white base core, crisp even on bright bg!)
//    - Optional layer: 'core' (thin AdditiveBlending scorching inner heart)
//    - Vertex sway + helical curl twist + per-instance phase desynchronization
//    - Returns THREE.ShaderMaterial with .update(time, dt), .setLowSpec(enabled), .dispose()
// ============================================================================
export function createRealisticFireMaterial(opts = {}) {
  const preset = FIRE_PRESETS[opts.preset] || FIRE_PRESETS.bonfire;
  const instanced = opts.instanced !== false;
  const isCoreLayer = opts.layer === 'core';
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  let baseIntensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const windX = Array.isArray(opts.windDir)
    ? (opts.windDir[0] || 0)
    : Number.isFinite(opts.windDir?.x) ? opts.windDir.x : 0.16;
  const windZ = Array.isArray(opts.windDir)
    ? (opts.windDir[1] || 0)
    : Number.isFinite(opts.windDir?.z) ? opts.windDir.z : -0.09;

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: baseIntensity },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSpeed: { value: Number.isFinite(opts.speed) ? opts.speed : preset.speed },
    uSway: { value: Number.isFinite(opts.sway) ? opts.sway : preset.sway },
    uCurlTwist: { value: Number.isFinite(opts.curlTwist) ? opts.curlTwist : preset.curlTwist },
    uFreq: { value: new THREE.Vector2(
      Number.isFinite(opts.freqX) ? opts.freqX : preset.freqX,
      Number.isFinite(opts.freqY) ? opts.freqY : preset.freqY
    ) },
    uWarp: { value: Number.isFinite(opts.warpStrength) ? opts.warpStrength : preset.warpStrength },
    uTaper: { value: Number.isFinite(opts.taperPower) ? opts.taperPower : preset.taperPower },
    uGrazingFade: { value: Number.isFinite(opts.grazingFade) ? opts.grazingFade : preset.grazingFade },
    uAlphaScale: { value: Number.isFinite(opts.alphaStrength) ? opts.alphaStrength : (isCoreLayer ? 0.62 : preset.alphaStrength) },
    uWindDir: { value: new THREE.Vector2(windX, windZ) },
    uLayerMode: { value: isCoreLayer ? 1.0 : 0.0 },
    // Physical Planckian blackbody combustion gradient (900K cherry-crimson -> 1700K bright amber -> 2300K radiant gold -> 2900K white-gold heart)
    uColRim:   { value: toColorVec3(opts.rimColor,   0x9c1202) }, // Deep cherry-crimson outer flame boundary
    uColOuter: { value: toColorVec3(opts.outerColor, 0xe02c04) }, // Rich scarlet-vermilion outer tongues
    uColMid:   { value: toColorVec3(opts.midColor,   0xff820c) }, // Vivid luminous amber-orange primary body
    uColHot:   { value: toColorVec3(opts.hotColor,   0xffdd4a) }, // Radiant golden-yellow inner mantle
    uColCore:  { value: toColorVec3(opts.coreColor,  0xfff9dc) }  // Warm white-gold incandescent core at coals
  };

  const instDecl = instanced
    ? /* glsl */ `attribute float aPhase;`
    : /* glsl */ `const float aPhase = 0.0;`;

  const instTransform = instanced
    ? /* glsl */ `
      float instHash = dot(instanceMatrix[3].xyz, vec3(1.731, 0.913, 2.417));
      float ph = aPhase + aFlameMeta.x + instHash;
      mat3 instRot = mat3(instanceMatrix);
      vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      vNormalV = normalize(normalMatrix * (instRot * n));
    `
    : /* glsl */ `
      float ph = aFlameMeta.x + dot(modelMatrix[3].xyz, vec3(1.731, 0.913, 2.417));
      vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
      vNormalV = normalize(normalMatrix * n);
    `;

  const vertexShader = /* glsl */ `
    ${instDecl}
    attribute vec4 aFlameMeta;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uSway;
    uniform float uCurlTwist;
    uniform vec2 uWindDir;

    varying vec2 vUv;
    varying vec3 vLocalPos;
    varying vec3 vNormalV;
    varying vec3 vViewDir;
    varying vec4 vMeta;
    varying float vPhase;
    varying float vPulse;

    void main() {
      vUv = uv;
      vMeta = aFlameMeta;

      float h = clamp(uv.y, 0.0, 1.0);
      float swayScale = aFlameMeta.w;
      float bend = pow(h, 1.42) * swayScale;

      vec3 p = position;
      vec3 n = normal;

      // Compute unique phase before deformation so each instance & ribbon sways independently
      float prePh = aPhase + aFlameMeta.x;
      ${instanced ? 'prePh += dot(instanceMatrix[3].xyz, vec3(1.731, 0.913, 2.417));' : 'prePh += dot(modelMatrix[3].xyz, vec3(1.731, 0.913, 2.417));'}

      float t = uTime * (uSpeed * 1.45) + prePh;

      // Organic multi-harmonic upward lick breathing & vertical tongue stretch
      float pulse = 0.92
        + 0.11 * sin(t * 1.55 + prePh * 0.7)
        + 0.06 * sin(t * 3.15 + prePh * 1.9);
      vPulse = pulse;
      p.y *= mix(1.0, pulse, h * 0.85);

      // Helical curl twist around Y axis вЂ” flame tips spiral & whip as hot air rises
      float twistAng = (
        sin(t * 0.95 + h * 3.1) * 0.65
        + cos(t * 1.78 - h * 4.4 + prePh) * 0.35
      ) * uCurlTwist * bend;
      float ct = cos(twistAng);
      float st = sin(twistAng);
      p.xz = mat2(ct, -st, st, ct) * p.xz;
      n.xz = mat2(ct, -st, st, ct) * n.xz;

      // Turbulent draft sway + subtle cathedral cross-draft lean
      float swayX = (
        sin(t * 1.15 + h * 4.1) * 0.68
        + sin(t * 2.42 - h * 6.3 + prePh * 1.3) * 0.32
      ) * uSway * bend + uWindDir.x * bend * (0.42 + 0.18 * sin(t * 0.8));
      float swayZ = (
        cos(t * 0.98 + h * 3.7 + prePh * 0.5) * 0.68
        + cos(t * 2.15 - h * 5.8) * 0.32
      ) * uSway * bend + uWindDir.y * bend * (0.42 + 0.18 * cos(t * 0.7));
      p.x += swayX;
      p.z += swayZ;

      // Slight radial flutter in mid-flame belly
      float flutter = 1.0 + sin(t * 2.7 - h * 5.2) * 0.065 * sin(h * 3.14159) * swayScale;
      p.xz *= flutter;

      vLocalPos = p;
      ${instTransform}
      vPhase = ph;
      vViewDir = normalize(-mvPos.xyz);
      gl_Position = projectionMatrix * mvPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform float uIntensity;
    uniform float uDetail;
    uniform float uSpeed;
    uniform vec2 uFreq;
    uniform float uWarp;
    uniform float uTaper;
    uniform float uGrazingFade;
    uniform float uAlphaScale;
    uniform float uLayerMode;

    uniform vec3 uColRim;
    uniform vec3 uColOuter;
    uniform vec3 uColMid;
    uniform vec3 uColHot;
    uniform vec3 uColCore;

    varying vec2 vUv;
    varying vec3 vLocalPos;
    varying vec3 vNormalV;
    varying vec3 vViewDir;
    varying vec4 vMeta;
    varying float vPhase;
    varying float vPulse;

    ${GLSL_SIMPLEX_NOISE}

    void main() {
      float layerRole = vMeta.z;

      // Special single-pass warm lantern-glass mantle role (layerRole < -0.5)
      if (layerRole < -0.5) {
        float ndvG = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        float vGrad = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        float flickerG = 0.88 + 0.08 * sin(uTime * 9.2 + vPhase) + 0.04 * sin(uTime * 18.7 + vPhase * 1.4);
        float rimGlow = pow(max(1.0 - ndvG, 0.0), 1.4) * 0.55 + ndvG * 0.45;
        float aG = vGrad * rimGlow * 0.20 * flickerG * clamp(uIntensity, 0.0, 1.4);
        if (aG < 0.01) discard;
        vec3 glassCol = mix(uColOuter * 0.85, uColMid, vGrad * 0.72);
        gl_FragColor = vec4(glassCol, aG);
        return;
      }

      vec2 uv = clamp(vUv, 0.0, 1.0);
      float t = uTime * uSpeed + vPhase * 1.73;

      // Soft view-angle grazing fade & silky UV margin feather (zero flat polygon edges anywhere!)
      float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
      float viewFade = mix(1.0, smoothstep(0.08, 0.50, ndv), uGrazingFade);
      float sideEdgeFade = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
      float topCapFeather = smoothstep(1.0, 0.88, uv.y);

      // Upward buoyant flow вЂ” accelerates slightly toward upper tips
      float flowYFast = uv.y * (uFreq.y * 1.65) - t * 1.68;

      // Domain-warping turbulence (0 Simplex on Mobile/LowSpec via analytical sin/cos; 2D Simplex on Desktop!)
      vec2 warpCoord = vec2(uv.x * (uFreq.x * 0.72) + vPhase * 0.37, uv.y * (uFreq.y * 0.85) - t * 0.82);
      vec2 warpV = fireDomainWarp(warpCoord, uDetail);
      float wx = warpV.x;
      float wy = warpV.y;
      float warpAmt = uWarp * (0.20 + 0.80 * pow(max(uv.y, 0.0), 0.82));

      // Multi-octave Simplex FBM (strictly 2x 2D Simplex on Mobile/LowSpec; 3D+2D 3-octave on Desktop!)
      vec3 p3 = vec3(
        vLocalPos.x * (uFreq.x * 0.85) + wx * warpAmt + sin(vPhase) * 1.7,
        vLocalPos.z * (uFreq.x * 0.85) + wy * warpAmt + cos(vPhase) * 1.7,
        vLocalPos.y * (uFreq.y * 0.75) - t * 0.95
      );
      vec2 p2 = vec2(
        uv.x * (uFreq.x * 1.55) + wx * warpAmt * 1.35 + vPhase * 0.61,
        flowYFast + wy * warpAmt * 0.65
      );
      vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
      float fbm = turb.x;
      float filaments = turb.y;

      // Sculpted tapering flame silhouette with rounded coal-hugging base & wild multi-tongue turbulence
      float spineShift = (wx * 0.24 + (fbm - 0.5) * 0.28) * pow(max(uv.y, 0.0), 1.05);
      float baseRound = smoothstep(0.0, 0.20, uv.y);
      float halfWidth = mix(0.44, 0.088, pow(max(uv.y, 0.0), uTaper)) * (0.62 + 0.38 * baseRound);
      halfWidth += sin(clamp(uv.y * 3.14159, 0.0, 3.14159)) * 0.068;
      float distX = abs((uv.x - 0.5) - spineShift);
      float r = distX / max(halfWidth, 0.048);

      // Organic noise-feathered bottom ignition & silky upper dissipation (0 hard polygon cutoffs!)
      float baseMask = smoothstep(0.03 + fbm * 0.08, 0.24 + fbm * 0.06, uv.y);
      float topFade = smoothstep(1.0, 0.16, uv.y);

      float colShape = clamp(1.0 - r * r, 0.0, 1.0);
      float turbDrive = (fbm - 0.44) * mix(0.52, 1.22, pow(max(uv.y, 0.0), 0.64));
      float detachPeak = smoothstep(0.54, 0.86, fbm) * smoothstep(0.34, 0.68, uv.y) * smoothstep(0.96, 0.70, uv.y) * smoothstep(1.48, 0.42, r) * 0.48;
      float erosion = pow(max(uv.y, 0.0), 1.24) * 0.56;
      float field = (colShape * (0.70 + 0.42 * topFade) + turbDrive + detachPeak - erosion) * baseMask * topCapFeather;

      // Determine if rendering additive inner core (uLayerMode > 0.5) or single-pass core submesh (layerRole > 0.5)
      bool isAdditiveCore = uLayerMode > 0.5;
      bool isEmbeddedCore = layerRole > 0.5;

      if (isAdditiveCore) {
        float coreBase = smoothstep(0.08, 0.34, uv.y);
        float coreField = field * coreBase * smoothstep(0.84, 0.12, uv.y) * smoothstep(0.95, 0.14, r);
        float coreAlpha = smoothstep(0.16, 0.64, coreField) * viewFade * sideEdgeFade * uAlphaScale * clamp(uIntensity, 0.0, 1.5);
        if (coreAlpha < 0.012) discard;
        vec3 cCol = mix(uColMid, uColHot, smoothstep(0.16, 0.52, coreField));
        cCol = mix(cCol, uColCore, smoothstep(0.42, 0.78, coreField) * (1.0 - uv.y * 0.52));
        float pulseBoost = 0.88 + 0.16 * vPulse;
        gl_FragColor = vec4(cCol * pulseBoost, clamp(coreAlpha * 0.58, 0.0, 0.78));
        return;
      }

      // Soft physical edge feather + dark thermal smoke plume rising above cooling crimson tips!
      float flameEdge = smoothstep(0.06, 0.38, field);
      float smokeField = (colShape * 0.52 + (fbm - 0.38) * 0.78) * smoothstep(0.52, 0.78, uv.y) * topCapFeather * smoothstep(1.55, 0.35, r);
      float tipSmokeMask = isEmbeddedCore ? 0.0 : (smoothstep(0.10, 0.48, smokeField) * (1.0 - flameEdge * 0.88));
      float alpha = clamp(pow(max(flameEdge, 0.0), 0.88) * 0.94 + tipSmokeMask * 0.30, 0.0, 1.0) * viewFade * sideEdgeFade * uAlphaScale;
      if (isEmbeddedCore) {
        alpha *= smoothstep(0.86, 0.14, uv.y) * 0.90;
      }
      alpha *= clamp(uIntensity, 0.0, 1.45);
      if (alpha < 0.015) discard;

      // Planckian blackbody temperature [0..1]:
      // White-gold heart at coals -> radiant amber-orange body -> cherry-crimson tongues -> dark smoke veil
      float coreZone = (1.0 - smoothstep(0.0, 0.72, r)) * smoothstep(0.78, 0.06, uv.y);
      float temp = clamp(
        smoothstep(0.05, 0.82, field) * 0.62
        + coreZone * 0.48
        + (filaments - 0.44) * 0.28
        + vMeta.y
        + (isEmbeddedCore ? 0.34 : 0.0)
        - smoothstep(0.44, 0.94, uv.y) * 0.46,
        0.0,
        1.0
      );

      vec3 col = mix(uColRim, uColOuter, smoothstep(0.00, 0.26, temp));
      col = mix(col, uColMid,  smoothstep(0.24, 0.55, temp));
      col = mix(col, uColHot,  smoothstep(0.53, 0.81, temp));
      col = mix(col, uColCore, smoothstep(0.79, 0.97, temp));

      // Cooling crimson-to-soot smoke veil at the upper plume tips
      float upperTipCool = smoothstep(0.52, 0.94, uv.y) * (1.0 - smoothstep(0.14, 0.52, temp));
      vec3 warmSootSmoke = mix(vec3(0.26, 0.04, 0.018), vec3(0.09, 0.075, 0.072), smoothstep(0.65, 0.96, uv.y));
      col = mix(col, warmSootSmoke, clamp(upperTipCool * 0.64 + tipSmokeMask * 0.78, 0.0, 0.90));

      // Internal glowing gas convection filaments
      float hotStreak = smoothstep(0.54, 0.90, filaments) * smoothstep(0.20, 0.62, temp) * (1.0 - uv.y * 0.42);
      col = mix(col, uColCore, hotStreak * 0.28);

      float lumBoost = (0.95 + 0.09 * vPulse) * mix(0.84, 1.06, clamp(uIntensity, 0.0, 1.4)) * (isEmbeddedCore ? 1.08 : 1.0);
      col = min(col * lumBoost, vec3(1.10));

      gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
    }
  `;

  const mat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: isCoreLayer ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });

  let elapsedInternal = 0.0;
  let disposed = false;

  mat.update = function update(time, dt = 0.016) {
    if (disposed) return;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    uniforms.uTime.value = elapsedInternal;
  };

  mat.setLowSpec = function setLowSpec(enabled = false) {
    lowSpec = Boolean(enabled);
    uniforms.uDetail.value = (isMobile || lowSpec) ? 0.0 : 1.0;
    uniforms.uIntensity.value = lowSpec ? baseIntensity * 0.88 : baseIntensity;
  };

  mat.setIntensity = function setIntensity(val = 1.0) {
    baseIntensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    uniforms.uIntensity.value = lowSpec ? baseIntensity * 0.88 : baseIntensity;
  };

  const baseDispose = mat.dispose.bind(mat);
  mat.dispose = function dispose() {
    if (disposed) return;
    disposed = true;
    baseDispose();
  };

  return mat;
}

// ============================================================================
// Glowing Ember-Coal Bed (Sculpted Procedural Molten Cracks in Charred Coals)
// ============================================================================
function createBonfireCoalBed(scale = 1.0, isMobile = false, lowSpec = false) {
  const geo = new THREE.SphereGeometry(0.60 * scale, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const pos = geo.attributes.position;
  const rng = makeRng(0x26f13e01);
  // Sculpt natural craggy charcoal mound with organic rounded skirt
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ang = Math.atan2(pz, px);
    const rad = Math.hypot(px, pz);
    const bump = 1.0 + 0.09 * Math.sin(ang * 5.0 + rad * 6.5) + 0.06 * Math.cos(ang * 8.0 - py * 9.0) + (rng() - 0.5) * 0.03;
    pos.setXYZ(i, px * bump, py * 0.42 * bump, pz * bump);
  }
  geo.computeVertexNormals();

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 }
  };

  const mat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms,
    transparent: false,
    depthWrite: true,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vLocalPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uDetail;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        vec3 p = vLocalPos * 5.4;
        float n1 = 0.0;
        float n2 = 0.0;
#ifdef FIRE_MOBILE_FAST
        n1 = snoise2(p.xz + vec2(p.y * 0.8, -p.y * 0.6));
#else
        if (uDetail > 0.5) {
          n1 = snoise3(p);
          n2 = snoise3(p * 2.35 + vec3(4.1, -2.3, 1.7));
        } else {
          n1 = snoise2(p.xz + vec2(p.y * 0.8, -p.y * 0.6));
        }
#endif
        // Ridged molten fissures glowing fiercely between dark charred charcoal chunks
        float crack = 1.0 - abs(n1 * 0.72 + n2 * 0.28);
        float pulse = 0.78 + 0.22 * sin(uTime * 3.8 + n1 * 4.2) + 0.10 * sin(uTime * 8.9 + vLocalPos.x * 6.0);
        float radialHot = smoothstep(0.66, 0.05, length(vLocalPos.xz));
        float glow = pow(clamp(crack, 0.0, 1.0), 2.4) * (0.45 + 0.65 * radialHot) * pulse;

        vec3 ashCrust  = vec3(0.06, 0.035, 0.030);
        vec3 deepEmber = vec3(0.72, 0.09, 0.01);
        vec3 brightMag = vec3(1.00, 0.48, 0.04);
        vec3 hotCore   = vec3(1.00, 0.90, 0.42);

        vec3 col = mix(ashCrust, deepEmber, smoothstep(0.16, 0.45, glow));
        col = mix(col, brightMag, smoothstep(0.42, 0.76, glow));
        col = mix(col, hotCore,   smoothstep(0.75, 1.02, glow));

        // Slight top-facing ash shading
        float rim = pow(1.0 - clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0), 2.0);
        col += vec3(0.14, 0.04, 0.01) * rim * radialHot;

        gl_FragColor = vec4(min(col * clamp(uIntensity, 0.0, 1.5), vec3(1.1)), 1.0);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'bonfire_ember_coals';
  mesh.renderOrder = 2;
  return { mesh, geo, mat, uniforms };
}

// ============================================================================
// GPU Rising Fiery Sparks + Turbulent Curling Dark Smoke (Bonfire Assembly)
// ============================================================================
function createBonfireSparks(scale = 1.0, isMobile = false, lowSpec = false) {
  const MAX_SPARKS = 48;
  const rng = makeRng(0x9a3779b9);

  const origins = new Float32Array(MAX_SPARKS * 3);
  const params = new Float32Array(MAX_SPARKS * 4); // speed, phase, riseHeight, size
  const swirls = new Float32Array(MAX_SPARKS * 3); // swirlRad, swirlFreq, twinkleFreq

  for (let i = 0; i < MAX_SPARKS; i++) {
    const ang = rng() * Math.PI * 2.0;
    const rad = Math.sqrt(rng()) * 0.46 * scale;
    origins[i * 3]     = Math.cos(ang) * rad;
    origins[i * 3 + 1] = (0.08 + rng() * 0.32) * scale;
    origins[i * 3 + 2] = Math.sin(ang) * rad;

    params[i * 4]     = 0.34 + rng() * 0.46;               // life cycles / sec
    params[i * 4 + 1] = rng();                             // phase offset [0..1]
    params[i * 4 + 2] = (2.3 + rng() * 2.5) * scale;       // rise height
    params[i * 4 + 3] = (0.048 + rng() * 0.056) * scale;   // point size base

    swirls[i * 3]     = (0.20 + rng() * 0.42) * scale;     // helical swirl radius
    swirls[i * 3 + 1] = 2.2 + rng() * 3.8;                 // swirl angular speed
    swirls[i * 3 + 2] = 9.0 + rng() * 14.0;                // spark twinkle speed
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(origins, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(params, 4));
  geo.setAttribute('aSwirl', new THREE.BufferAttribute(swirls, 3));

  const targetCount = (low) => (low ? 12 : isMobile ? 26 : MAX_SPARKS);
  geo.setDrawRange(0, targetCount(lowSpec));

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aParam;
      attribute vec3 aSwirl;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vLife;
      varying float vTwinkle;

      void main() {
        float life = fract(uTime * aParam.x + aParam.y);
        vLife = life;

        vec3 p = position;
        // Buoyant upward acceleration with gentle helical thermal vortex
        float rise = pow(life, 0.88) * aParam.z;
        p.y += rise;
        float theta = uTime * aSwirl.y + aParam.y * 6.28318 + life * 4.5;
        float spread = aSwirl.x * pow(life, 0.78);
        p.x += cos(theta) * spread + 0.14 * life;
        p.z += sin(theta * 0.87) * spread - 0.08 * life;

        vTwinkle = 0.62 + 0.38 * sin(uTime * aSwirl.z + aParam.y * 31.4);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float env = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.30, life);
        gl_PointSize = clamp((aParam.w * 340.0 * uPixelRatio * (0.62 + 0.72 * env)) / max(1.0, -mv.z), 2.2, 16.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vLife;
      varying float vTwinkle;

      void main() {
        // Elongated vertical spark streak inside point sprite
        vec2 c = gl_PointCoord - vec2(0.5);
        c.x *= 1.45;
        float d = length(c);
        float core = smoothstep(0.46, 0.04, d);
        if (core < 0.02) discard;

        float fade = smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.30, vLife);
        vec3 colHot = vec3(1.00, 0.96, 0.68);
        vec3 colMid = vec3(1.00, 0.50, 0.07);
        vec3 colEnd = vec3(0.82, 0.14, 0.02);
        vec3 col = mix(colHot, colMid, smoothstep(0.05, 0.48, vLife));
        col = mix(col, colEnd, smoothstep(0.48, 0.95, vLife));

        float alpha = core * fade * vTwinkle * clamp(uIntensity, 0.0, 1.4);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'bonfire_rising_sparks';
  points.frustumCulled = false;
  points.renderOrder = 6;

  return { points, geo, mat, uniforms, targetCount };
}

function createBonfireSmokeWisps(scale = 1.0, isMobile = false, lowSpec = false) {
  const MAX_SMOKE = 22;
  const rng = makeRng(0x55a1c7d3);

  const origins = new Float32Array(MAX_SMOKE * 3);
  const params = new Float32Array(MAX_SMOKE * 4); // speed, phase, riseHeight, size

  for (let i = 0; i < MAX_SMOKE; i++) {
    const ang = rng() * Math.PI * 2.0;
    const rad = rng() * 0.24 * scale;
    origins[i * 3]     = Math.cos(ang) * rad;
    origins[i * 3 + 1] = (1.15 + rng() * 0.45) * scale;
    origins[i * 3 + 2] = Math.sin(ang) * rad;

    params[i * 4]     = 0.14 + rng() * 0.11;
    params[i * 4 + 1] = rng();
    params[i * 4 + 2] = (2.1 + rng() * 1.4) * scale;
    params[i * 4 + 3] = (0.72 + rng() * 0.56) * scale;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(origins, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(params, 4));

  const targetCount = (low) => (low ? 0 : isMobile ? 11 : MAX_SMOKE);
  geo.setDrawRange(0, targetCount(lowSpec));

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aParam;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vLife;
      varying float vSeed;

      void main() {
        float life = fract(uTime * aParam.x + aParam.y);
        vLife = life;
        vSeed = aParam.y * 6.28318;

        vec3 p = position;
        p.y += life * aParam.z;
        float drift = uTime * 1.05 + vSeed * 2.0;
        p.x += sin(drift) * 0.34 * life + 0.22 * life;
        p.z += cos(drift * 0.81) * 0.30 * life - 0.14 * life;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float grow = 0.55 + life * 1.35;
        gl_PointSize = clamp((aParam.w * 280.0 * uPixelRatio * grow) / max(1.0, -mv.z), 4.0, 68.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      varying float vLife;
      varying float vSeed;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        // Rotate & warp point UV so every smoke puff looks like an organic curling wisp
        vec2 c = gl_PointCoord - vec2(0.5);
        float ang = vSeed + vLife * 1.85;
        float ca = cos(ang);
        float sa = sin(ang);
        vec2 rc = mat2(ca, -sa, sa, ca) * c;

        float dist = length(c) * 2.0;
        float n = snoise2(rc * 3.8 + vec2(vSeed, -vLife * 2.2)) * 0.5 + 0.5;
        float wisp = smoothstep(0.96, 0.10, dist + (n - 0.5) * 0.46);
        wisp *= smoothstep(1.0, 0.25, dist);
        if (wisp < 0.025) discard;

        float env = smoothstep(0.0, 0.26, vLife) * smoothstep(1.0, 0.26, vLife);
        // Warm firelit soot near the flame tips cooling to subtle gothic ash-smoke higher up
        vec3 warmSoot = vec3(0.24, 0.09, 0.05);
        vec3 coolAsh  = vec3(0.10, 0.105, 0.13);
        vec3 col = mix(warmSoot, coolAsh, smoothstep(0.05, 0.58, vLife));
        float alpha = wisp * env * 0.19 * clamp(uIntensity, 0.0, 1.2);
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'bonfire_smoke_wisps';
  points.frustumCulled = false;
  points.visible = !lowSpec;
  points.renderOrder = 3;

  return { points, geo, mat, uniforms, targetCount };
}

// ============================================================================
// 2. HERO BONFIRE 3-AXIS MULTI-LAYER FLAME ASSEMBLY
//    Includes:
//      - DC 1: Sculpted 3-axis curved 3D flame crown + outer petals + spire licks (NormalBlending)
//      - DC 2: Tight incandescent inner heart around Coiled Sword base (AdditiveBlending)
//      - DC 3 (optional): Glowing molten-cracks charcoal bed (includeCoals = true)
//      - DC 4 (optional): GPU rising sparks (includeSparks = true)
//      - DC 5 (optional): GPU curling dark smoke tendrils (includeSmoke = true, off in LowSpec)
// ============================================================================
export function createBonfireFlameAssembly(opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  const scale = Number.isFinite(opts.scale) ? opts.scale : 1.0;
  let intensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const includeCoals = opts.includeCoals !== false;
  const includeSparks = opts.includeSparks !== false;
  const includeSmoke = opts.includeSmoke !== false;

  const trackGeo = typeof opts.trackGeo === 'function' ? opts.trackGeo : (g) => g;
  const trackMat = typeof opts.trackMat === 'function' ? opts.trackMat : (m) => m;

  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const group = new THREE.Group();
  group.name = 'bonfire_flame_assembly';

  const px = Number.isFinite(opts.position?.x) ? opts.position.x : (Number.isFinite(opts.x) ? opts.x : 0);
  const py = Number.isFinite(opts.position?.y) ? opts.position.y : (Number.isFinite(opts.y) ? opts.y : 0.30);
  const pz = Number.isFinite(opts.position?.z) ? opts.position.z : (Number.isFinite(opts.z) ? opts.z : 0);
  group.position.set(px, py, pz);

  // Mobile single-pass mode embeds the bright inner core directly into bodyGeo (-1 DC, -50% overdraw!)
  const useSinglePass = isMobile || opts.singlePass === true;

  // DC #1: Sculpted 3-axis curved flame crown (NormalBlending вЂ” crisp crimson silhouette + rich golden body)
  const bodyGeo = regGeo(createBonfireBodyCrownGeometry(scale, useSinglePass));
  const bodyMat = regMat(createRealisticFireMaterial({
    instanced: false,
    layer: 'body',
    preset: 'bonfire',
    isMobile,
    lowSpec,
    intensity,
    windDir: opts.windDir
  }));
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = 'bonfire_flame_body';
  bodyMesh.renderOrder = 4;
  group.add(bodyMesh);

  // DC #2 (Desktop High only): Tight inner incandescent core right around coals & sword root (AdditiveBlending)
  let coreMat = null;
  let coreMesh = null;
  if (!useSinglePass) {
    const coreGeo = regGeo(createInnerCoreCrownGeometry(0.48 * scale, 0.92 * scale, 2, 6));
    coreMat = regMat(createRealisticFireMaterial({
      instanced: false,
      layer: 'core',
      preset: 'bonfire',
      isMobile,
      lowSpec,
      intensity,
      sway: 0.08,
      curlTwist: 0.25,
      windDir: opts.windDir
    }));
    coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.name = 'bonfire_flame_core';
    coreMesh.position.y = 0.05 * scale;
    coreMesh.renderOrder = 5;
    coreMesh.visible = !lowSpec;
    group.add(coreMesh);
  }

  // DC #3 (optional): Glowing sculpted ember-coal bed with animated molten fissures
  let coalsEntry = null;
  if (includeCoals) {
    coalsEntry = createBonfireCoalBed(scale, isMobile, lowSpec);
    regGeo(coalsEntry.geo);
    regMat(coalsEntry.mat);
    coalsEntry.mesh.position.y = -0.06 * scale;
    group.add(coalsEntry.mesh);
  }

  // DC #4 (optional): GPU Rising Fiery Sparks
  let sparksEntry = null;
  if (includeSparks) {
    sparksEntry = createBonfireSparks(scale, isMobile, lowSpec);
    regGeo(sparksEntry.geo);
    regMat(sparksEntry.mat);
    group.add(sparksEntry.points);
  }

  // DC #5 (optional): GPU Curling Dark Smoke Tendrils
  let smokeEntry = null;
  if (includeSmoke) {
    smokeEntry = createBonfireSmokeWisps(scale, isMobile, lowSpec);
    regGeo(smokeEntry.geo);
    regMat(smokeEntry.mat);
    group.add(smokeEntry.points);
  }

  function getDrawCalls() {
    let dc = 1; // bodyMesh
    if (coreMesh && coreMesh.visible) dc += 1;
    if (coalsEntry && coalsEntry.mesh.visible) dc += 1;
    if (sparksEntry && sparksEntry.points.visible) dc += 1;
    if (smokeEntry && smokeEntry.points.visible) dc += 1;
    return dc;
  }

  let elapsedInternal = 0.0;
  let disposed = false;

  function update(time, dt = 0.016) {
    if (disposed) return;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    const t = elapsedInternal;
    bodyMat.update(t, dt);
    if (coreMat && coreMesh && coreMesh.visible) coreMat.update(t, dt);
    if (coalsEntry) coalsEntry.uniforms.uTime.value = t;
    if (sparksEntry) sparksEntry.uniforms.uTime.value = t;
    if (smokeEntry && smokeEntry.points.visible) smokeEntry.uniforms.uTime.value = t;
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    bodyMat.setLowSpec(lowSpec);
    if (coreMat && coreMesh) {
      coreMat.setLowSpec(lowSpec);
      coreMesh.visible = !lowSpec;
    }
    if (coalsEntry) {
      coalsEntry.uniforms.uDetail.value = (isMobile || lowSpec) ? 0.0 : 1.0;
    }
    if (sparksEntry) {
      sparksEntry.geo.setDrawRange(0, sparksEntry.targetCount(lowSpec));
      sparksEntry.uniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);
    }
    if (smokeEntry) {
      const sc = smokeEntry.targetCount(lowSpec);
      smokeEntry.geo.setDrawRange(0, sc);
      smokeEntry.points.visible = sc > 0;
      smokeEntry.uniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);
    }
  }

  function setIntensity(val = 1.0) {
    if (disposed) return;
    intensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    bodyMat.setIntensity(intensity);
    if (coreMat) coreMat.setIntensity(intensity);
    if (coalsEntry) coalsEntry.uniforms.uIntensity.value = intensity;
    if (sparksEntry) sparksEntry.uniforms.uIntensity.value = intensity;
    if (smokeEntry) smokeEntry.uniforms.uIntensity.value = intensity;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < localGeos.length; i++) localGeos[i].dispose?.();
    for (let i = 0; i < localMats.length; i++) localMats[i].dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  const handle = {
    group,
    bodyMesh,
    coreMesh,
    coalsMesh: coalsEntry ? coalsEntry.mesh : null,
    sparksPoints: sparksEntry ? sparksEntry.points : null,
    smokePoints: smokeEntry ? smokeEntry.points : null,
    get drawCalls() { return getDrawCalls(); },
    getDrawCalls,
    update,
    setLowSpec,
    setIntensity,
    dispose
  };

  return handle;
}

// ============================================================================
// Helper: Normalize Position Specs (supports Vector3, [x,y,z], layout specs, fireSites)
// ============================================================================
function normalizeFirePositions(positions, {
  defaultY = 0.0,
  yOffset = 0.0,
  globalScale = 1.0,
  applyBracketOffset = false
} = {}) {
  const list = Array.isArray(positions) ? positions : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!p) continue;
    let x = 0;
    let y = defaultY;
    let z = 0;
    let s = globalScale;
    let rotY = i * 0.93;
    let phase = i * 1.6180339 + 0.37;

    if (Array.isArray(p)) {
      x = Number(p[0]) || 0;
      y = (Number.isFinite(p[1]) ? p[1] : defaultY) + yOffset;
      z = Number(p[2]) || 0;
    } else if (p.isVector3) {
      x = p.x;
      y = p.y + yOffset;
      z = p.z;
    } else {
      const baseScale = Number.isFinite(p.scale) ? p.scale : 1.0;
      x = Number(p.x) || 0;
      z = Number(p.z) || 0;
      const hasExplicitY = Number.isFinite(p.y);
      y = hasExplicitY ? (p.y + yOffset) : (defaultY * baseScale + yOffset);
      rotY = Number.isFinite(p.rotY) ? p.rotY : (i * 0.93);
      if (Number.isFinite(p.phase)) phase = p.phase;

      if (applyBracketOffset) {
        const yaw = resolveYaw(p);
        const arm = 0.60 * baseScale;
        x += Math.sin(yaw) * arm;
        z += Math.cos(yaw) * arm;
        y = (hasExplicitY ? p.y : 2.75) - 0.48 * baseScale + yOffset;
      }

      if (Number.isFinite(p.flameScale)) {
        s = p.flameScale * globalScale;
      } else {
        s = baseScale * globalScale;
      }
    }

    out.push({ x, y, z, scale: s, rotY, phase });
  }
  return out;
}

// ============================================================================
// 3. INSTANCED FLOOR BRAZIER FLAMES (1вЂ“2 DC for all 12 Floor Braziers!)
//    - DC 1: Sculpted curved licking flame crowns inside the 8-bar iron cages (NormalBlending)
//    - DC 2: Tight incandescent inner heart cores (AdditiveBlending, auto-hidden on LowSpec -> 1 DC!)
// ============================================================================
export function createInstancedBrazierFlames(positions = [], opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  const includeCore = opts.includeCore !== false;
  let intensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const trackGeo = typeof opts.trackGeo === 'function' ? opts.trackGeo : (g) => g;
  const trackMat = typeof opts.trackMat === 'function' ? opts.trackMat : (m) => m;

  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const group = new THREE.Group();
  group.name = 'instanced_brazier_flames';

  const items = normalizeFirePositions(positions, {
    defaultY: Number.isFinite(opts.defaultY) ? opts.defaultY : 1.12,
    yOffset: Number.isFinite(opts.yOffset) ? opts.yOffset : 0.0,
    globalScale: Number.isFinite(opts.scale) ? opts.scale : 1.0,
    applyBracketOffset: false
  });

  if (items.length === 0) {
    return {
      group,
      bodyMesh: null,
      coreMesh: null,
      count: 0,
      drawCalls: 0,
      getDrawCalls: () => 0,
      update() {},
      setLowSpec() {},
      setIntensity() {},
      setInstanceMatrixAt() {},
      dispose() {}
    };
  }

  const width = Number.isFinite(opts.width) ? opts.width : 0.72;
  const height = Number.isFinite(opts.height) ? opts.height : 1.14;
  const phases = new Float32Array(items.length);
  for (let i = 0; i < items.length; i++) phases[i] = items[i].phase;

  // Mobile single-pass mode embeds the glowing inner heart inside bodyGeo (-1 DC, -50% overdraw!)
  const useSinglePass = isMobile || !includeCore || opts.singlePass === true;

  // DC #1: Curved 3D licking flame crown (NormalBlending; includes embedded inner core on Mobile!)
  const bodyGeo = regGeo(createBrazierFlameCrownGeometry(width, height, useSinglePass));
  bodyGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

  const bodyMat = regMat(createRealisticFireMaterial({
    instanced: true,
    layer: 'body',
    preset: 'brazier',
    isMobile,
    lowSpec,
    intensity,
    windDir: opts.windDir
  }));

  const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, items.length);
  bodyMesh.name = 'brazier_flames_body';
  bodyMesh.frustumCulled = false;
  bodyMesh.renderOrder = 4;

  // DC #2 (Desktop High only): Tight incandescent inner heart (AdditiveBlending; hidden in LowSpec -> 1 DC!)
  let coreGeo = null;
  let coreMat = null;
  let coreMesh = null;
  if (!useSinglePass) {
    coreGeo = regGeo(createInnerCoreCrownGeometry(width * 0.56, height * 0.62, 2, 5));
    coreGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(phases), 1));
    coreMat = regMat(createRealisticFireMaterial({
      instanced: true,
      layer: 'core',
      preset: 'brazier',
      isMobile,
      lowSpec,
      intensity,
      sway: 0.06,
      curlTwist: 0.22,
      windDir: opts.windDir
    }));
    coreMesh = new THREE.InstancedMesh(coreGeo, coreMat, items.length);
    coreMesh.name = 'brazier_flames_core';
    coreMesh.frustumCulled = false;
    coreMesh.renderOrder = 5;
    coreMesh.visible = !lowSpec;
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    _dummy.position.set(it.x, it.y, it.z);
    _dummy.rotation.set(0, it.rotY, 0);
    _dummy.scale.set(it.scale, it.scale, it.scale);
    _dummy.updateMatrix();
    bodyMesh.setMatrixAt(i, _dummy.matrix);
    if (coreMesh) coreMesh.setMatrixAt(i, _dummy.matrix);
  }
  bodyMesh.instanceMatrix.needsUpdate = true;
  if (coreMesh) coreMesh.instanceMatrix.needsUpdate = true;

  group.add(bodyMesh);
  if (coreMesh) group.add(coreMesh);

  function getDrawCalls() {
    return 1 + (coreMesh && coreMesh.visible ? 1 : 0);
  }

  let elapsedInternal = 0.0;
  let disposed = false;

  function update(time, dt = 0.016) {
    if (disposed) return;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    bodyMat.update(elapsedInternal, dt);
    if (coreMat && coreMesh.visible) coreMat.update(elapsedInternal, dt);
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    bodyMat.setLowSpec(lowSpec);
    if (coreMat && coreMesh) {
      coreMat.setLowSpec(lowSpec);
      coreMesh.visible = !lowSpec;
    }
  }

  function setIntensity(val = 1.0) {
    if (disposed) return;
    intensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    bodyMat.setIntensity(intensity);
    if (coreMat) coreMat.setIntensity(intensity);
  }

  function setInstanceMatrixAt(index, matrix) {
    if (disposed || index < 0 || index >= items.length) return;
    bodyMesh.setMatrixAt(index, matrix);
    bodyMesh.instanceMatrix.needsUpdate = true;
    if (coreMesh) {
      coreMesh.setMatrixAt(index, matrix);
      coreMesh.instanceMatrix.needsUpdate = true;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < localGeos.length; i++) localGeos[i].dispose?.();
    for (let i = 0; i < localMats.length; i++) localMats[i].dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    bodyMesh,
    coreMesh,
    count: items.length,
    get drawCalls() { return getDrawCalls(); },
    getDrawCalls,
    update,
    setLowSpec,
    setIntensity,
    setInstanceMatrixAt,
    dispose
  };
}

// ============================================================================
// 4. INSTANCED WALL LANTERN FLAMES (STRICTLY 1 DC for all 21 Wall Lanterns!)
//    Single-pass layered geometry: warm forged-glass amber haze + 3 curved
//    licking flame tongues + bright incandescent inner flame core in 1 draw call!
// ============================================================================
export function createInstancedWallLanternFlames(positions = [], opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  let intensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const trackGeo = typeof opts.trackGeo === 'function' ? opts.trackGeo : (g) => g;
  const trackMat = typeof opts.trackMat === 'function' ? opts.trackMat : (m) => m;

  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const group = new THREE.Group();
  group.name = 'instanced_wall_lantern_flames';

  const items = normalizeFirePositions(positions, {
    defaultY: Number.isFinite(opts.defaultY) ? opts.defaultY : 0.0,
    yOffset: Number.isFinite(opts.yOffset) ? opts.yOffset : 0.0,
    globalScale: Number.isFinite(opts.scale) ? opts.scale : 1.0,
    applyBracketOffset: Boolean(opts.applyBracketOffset)
  });

  if (items.length === 0) {
    return {
      group,
      mesh: null,
      count: 0,
      drawCalls: 0,
      getDrawCalls: () => 0,
      update() {},
      setLowSpec() {},
      setIntensity() {},
      dispose() {}
    };
  }

  const width = Number.isFinite(opts.width) ? opts.width : 0.27;
  const height = Number.isFinite(opts.height) ? opts.height : 0.40;
  const phases = new Float32Array(items.length);
  for (let i = 0; i < items.length; i++) phases[i] = items[i].phase;

  // STRICTLY 1 DC: merged glass-haze + 3 curved flame tongues + incandescent core heart
  const geo = regGeo(createWallLanternSinglePassGeometry(width, height));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

  const mat = regMat(createRealisticFireMaterial({
    instanced: true,
    layer: 'body',
    preset: 'lantern',
    isMobile,
    lowSpec,
    intensity,
    windDir: opts.windDir || [0.05, -0.04]
  }));

  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  mesh.name = 'wall_lantern_flames';
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    _dummy.position.set(it.x, it.y, it.z);
    _dummy.rotation.set(0, it.rotY, 0);
    _dummy.scale.set(it.scale, it.scale, it.scale);
    _dummy.updateMatrix();
    mesh.setMatrixAt(i, _dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  let elapsedInternal = 0.0;
  let disposed = false;

  function update(time, dt = 0.016) {
    if (disposed) return;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    mat.update(elapsedInternal, dt);
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    mat.setLowSpec(lowSpec);
  }

  function setIntensity(val = 1.0) {
    if (disposed) return;
    intensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    mat.setIntensity(intensity);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (let i = 0; i < localGeos.length; i++) localGeos[i].dispose?.();
    for (let i = 0; i < localMats.length; i++) localMats[i].dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    mesh,
    count: items.length,
    drawCalls: 1,
    getDrawCalls: () => (mesh.visible ? 1 : 0),
    update,
    setLowSpec,
    setIntensity,
    dispose
  };
}

// ============================================================================
// 5. DELICATE LIVING TEARDROP CANDLE FLAME SHADER MATERIAL (43 Candles, 1 DC)
//    Physical beeswax candle zones:
//      - Dark wick ignition gap -> translucent oxygen-blue lower cup ->
//        luminous creamy white-yellow Fresnel core -> warm amber-orange tip!
//    NormalBlending (no white blob clipping when candles cluster together!).
//    Compatible with both LatheGeometry (soulsCastleProps.js) & custom teardrops.
// ============================================================================
export function createCandleFlameShaderMaterial(opts = {}) {
  const instanced = opts.instanced !== false;
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  let baseIntensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: baseIntensity },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSway: { value: Number.isFinite(opts.sway) ? opts.sway : 0.015 },
    uDraftDir: { value: new THREE.Vector2(
      Number.isFinite(opts.draftX) ? opts.draftX : 0.004,
      Number.isFinite(opts.draftZ) ? opts.draftZ : -0.003
    ) }
  };

  const instDecl = instanced
    ? /* glsl */ `attribute float aPhase;`
    : /* glsl */ `const float aPhase = 0.0;`;

  const instWorld = instanced
    ? /* glsl */ `
      float ph = aPhase + dot(instanceMatrix[3].xyz, vec3(3.17, 1.43, 2.89));
      mat3 instRot = mat3(instanceMatrix);
      vec4 mvPos = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      vNormalV = normalize(normalMatrix * (instRot * normal));
    `
    : /* glsl */ `
      float ph = dot(modelMatrix[3].xyz, vec3(3.17, 1.43, 2.89));
      vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
      vNormalV = normalize(normalMatrix * normal);
    `;

  const mat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      ${instDecl}
      uniform float uTime;
      uniform float uSway;
      uniform vec2 uDraftDir;

      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying float vFlicker;
      varying float vPhase;

      void main() {
        vUv = uv;
        float h = clamp(uv.y, 0.0, 1.0);

        float phPre = aPhase;
        ${instanced ? 'phPre += dot(instanceMatrix[3].xyz, vec3(3.17, 1.43, 2.89));' : 'phPre += dot(modelMatrix[3].xyz, vec3(3.17, 1.43, 2.89));'}

        // Delicate breathing candle draft dance (gentle slow wave + subtle quick quiver)
        float t = uTime * 5.6 + phPre;
        float slowDraft = sin(t * 0.42 + phPre * 0.6);
        float quickFlicker = sin(t * 1.45) * 0.55 + sin(t * 3.1 + phPre * 1.7) * 0.30 + cos(t * 5.2) * 0.15;
        float fl = 0.90 + 0.07 * slowDraft + 0.06 * quickFlicker;
        vFlicker = fl;

        vec3 p = position;
        float bend = pow(h, 1.55);
        // Gentle lateral sway & occasional draft lean at the teardrop tip
        p.x += (sin(t * 0.78 + h * 2.6) * 0.65 + sin(t * 2.05) * 0.35) * uSway * bend + uDraftDir.x * bend;
        p.z += (cos(t * 0.67 + h * 2.3 + phPre) * 0.65 + cos(t * 1.85) * 0.35) * uSway * bend + uDraftDir.y * bend;
        // Subtle vertical stretch & slight belly breathing
        p.y *= mix(1.0, fl, smoothstep(0.05, 0.85, h));
        float belly = 1.0 + (1.0 - fl) * 0.35 * sin(h * 3.14159);
        p.xz *= belly;

        ${instWorld}
        vPhase = ph;
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uDetail;

      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying float vFlicker;
      varying float vPhase;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        float h = clamp(vUv.y, 0.0, 1.0);
        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);

        // Subtle organic micro-flutter near teardrop tip
        float micro = 0.0;
#ifdef FIRE_MOBILE_FAST
        micro = sin(uTime * 11.0 + vPhase + h * 6.0) * 0.035 * smoothstep(0.45, 0.95, h);
#else
        if (uDetail > 0.5) {
          micro = snoise2(vec2(vUv.x * 4.0 + vPhase, h * 4.5 - uTime * 7.2)) * 0.08 * smoothstep(0.45, 0.95, h);
        } else {
          micro = sin(uTime * 11.0 + vPhase + h * 6.0) * 0.035 * smoothstep(0.45, 0.95, h);
        }
#endif
        float hm = clamp(h + micro, 0.0, 1.0);

        // Physical candle flame color zones:
        // 1. Oxygen-rich sapphire-blue cup right above the charred wick (h = 0.05..0.24)
        vec3 blueBase   = vec3(0.22, 0.42, 0.98);
        // 2. Dark amber-orange silhouette edge mantle
        vec3 amberEdge  = vec3(0.96, 0.44, 0.05);
        // 3. Warm golden outer body
        vec3 goldBody   = vec3(1.00, 0.78, 0.24);
        // 4. Incandescent creamy white-yellow luminous heart (strongest along center normal!)
        vec3 whiteCore  = vec3(1.00, 0.98, 0.86);
        // 5. Deep orange-crimson smoky tip
        vec3 tipCrimson = vec3(0.84, 0.20, 0.03);

        // Fresnel inner heart: brightest in center of teardrop, warmer & deeper orange on rim
        float coreMask = pow(ndv, 1.15) * smoothstep(0.16, 0.36, hm) * smoothstep(0.88, 0.42, hm);
        float blueMask = smoothstep(0.02, 0.10, hm) * smoothstep(0.30, 0.14, hm);

        vec3 col = mix(amberEdge, goldBody, smoothstep(0.18, 0.48, hm) * (0.45 + 0.55 * ndv));
        col = mix(col, whiteCore, clamp(coreMask * 1.15, 0.0, 1.0));
        col = mix(col, tipCrimson, smoothstep(0.70, 0.98, hm) * (1.0 - ndv * 0.35));
        col = mix(col, blueBase, blueMask * (0.82 - ndv * 0.20));

        // Soft volumetric teardrop opacity: transparent off wick, opaque-bright in core, wispy tapering tip
        float baseAlpha = smoothstep(0.0, 0.11, hm);
        float tipAlpha = smoothstep(1.0, 0.62, hm);
        float edgeSoft = smoothstep(0.02, 0.38, ndv);
        float alpha = baseAlpha * tipAlpha * mix(0.48, 0.96, edgeSoft) * (0.88 + 0.12 * vFlicker);
        // Slightly more translucent at the blue base cup
        alpha *= mix(1.0, 0.62, blueMask);
        alpha *= clamp(uIntensity, 0.0, 1.35);

        if (alpha < 0.02) discard;
        gl_FragColor = vec4(min(col * (0.94 + 0.08 * vFlicker), vec3(1.06)), clamp(alpha, 0.0, 0.95));
      }
    `
  });

  let elapsedInternal = 0.0;
  let disposed = false;

  mat.update = function update(time, dt = 0.016) {
    if (disposed) return;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    uniforms.uTime.value = elapsedInternal;
  };

  mat.setLowSpec = function setLowSpec(enabled = false) {
    lowSpec = Boolean(enabled);
    uniforms.uDetail.value = (isMobile || lowSpec) ? 0.0 : 1.0;
    uniforms.uIntensity.value = lowSpec ? baseIntensity * 0.85 : baseIntensity;
  };

  mat.setIntensity = function setIntensity(val = 1.0) {
    baseIntensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    uniforms.uIntensity.value = lowSpec ? baseIntensity * 0.85 : baseIntensity;
  };

  const baseDispose = mat.dispose.bind(mat);
  mat.dispose = function dispose() {
    if (disposed) return;
    disposed = true;
    baseDispose();
  };

  return mat;
}

// ============================================================================
// 6. BOSS PHASE-2 STREAMLINED AERODYNAMIC HAMMER FLAME SHEATH & CURVED WAKE SHADER
//    - Sleek liquid-fire forge sheath hugging the iron warhammer faces at the
//      front stagnation boundary & tapering smoothly into curved licking tongues
//      along the C2-filtered airflow + swing-curvature Bezier vector!
//    - Supports 3D multi-shell hammer sheaths (flowAxis: 'v', v=0 iron head -> v=1 tips)
//      AND multi-segment curved wake ribbons (flowAxis: 'u', u=0 sheath -> u=1 comet tail)
//      with parallel-transported twist-free cross-section framing (`curvedSpine: true`).
//    - Rich Planckian blackbody temperature ramp (incandescent white-gold iron core ->
//      solar gold -> vivid liquid amber-orange -> deep crimson-carmine -> soft dark
//      smoke/heat-dissolve edge) + Fresnel grazing-angle fade (ZERO hard polygon seams!).
// ============================================================================
export function createHammerFireTrailMaterial(opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  const flowAlongV = opts.flowAxis === 'v';
  const additive = Boolean(opts.additive);
  const curvedSpine = Boolean(opts.curvedSpine);

  let baseIntensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: baseIntensity },
    uPhase2: { value: Number.isFinite(opts.phase2) ? opts.phase2 : 1.0 },
    uWindup: { value: Number.isFinite(opts.windup) ? opts.windup : 0.0 },
    uStaggerDim: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSpeed: { value: Number.isFinite(opts.speed) ? opts.speed : 4.8 },
    uFlowAxis: { value: flowAlongV ? 1.0 : 0.0 },
    uAdditive: { value: additive ? 1.0 : 0.0 },
    uCurvedSpineMode: { value: curvedSpine ? 1.0 : 0.0 },
    uVertexDistort: { value: Number.isFinite(opts.vertexDistort) ? opts.vertexDistort : (flowAlongV ? 0.055 : 0.024) },
    // Streamlined C2 aerodynamic uniforms in mesh local space (0 quaternion flips!)
    uAeroFlowDir: { value: flowAlongV ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1) },
    uAeroBendDir: { value: new THREE.Vector3(0, 0, 0) },
    uWakeRight:   { value: new THREE.Vector3(1, 0, 0) },
    uWakeUp:      { value: new THREE.Vector3(0, 1, 0) },
    uSwingStretch: { value: 0.0 },
    uImpactBurst:  { value: 0.0 },
    // 5-stop Planckian forge-fire blackbody ramp
    uColSoot:  { value: toColorVec3(opts.sootColor,  0x520602) }, // Deep carmine-crimson ember wake
    uColOuter: { value: toColorVec3(opts.outerColor, 0xc41804) }, // Rich crimson-scarlet licking tongues
    uColMid:   { value: toColorVec3(opts.midColor,   0xff6208) }, // Vivid molten amber-orange liquid fire
    uColHot:   { value: toColorVec3(opts.hotColor,   0xffcf38) }, // Radiant golden-amber forge mantle
    uColCore:  { value: toColorVec3(opts.coreColor,  0xfff0b8) }  // Incandescent white-gold iron-contact core (0 flat-white clip!)
  };

  const mat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aFlameMeta;

      uniform float uTime;
      uniform float uSpeed;
      uniform float uPhase2;
      uniform float uWindup;
      uniform float uFlowAxis;
      uniform float uCurvedSpineMode;
      uniform float uVertexDistort;
      uniform vec3 uAeroFlowDir;
      uniform vec3 uAeroBendDir;
      uniform vec3 uWakeRight;
      uniform vec3 uWakeUp;
      uniform float uSwingStretch;
      uniform float uImpactBurst;

      varying vec2 vUv;
      varying vec3 vBasePos;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying float vWindward;

      void main() {
        vUv = uv;
        vBasePos = position;
        vMeta = aFlameMeta;

        float along = clamp((uFlowAxis > 0.5) ? uv.y : uv.x, 0.0, 1.0);
        float across = clamp((uFlowAxis > 0.5) ? uv.x : uv.y, 0.0, 1.0);
        float ac = (across - 0.5) * 2.0;
        float role = aFlameMeta.z;

        vec3 p = position;
        vec3 n = normal;
        float windward = 0.0;

        float stretch = clamp(uSwingStretch, 0.0, 1.45);
        float burst = clamp(uImpactBurst, 0.0, 1.25);
        float flowLen = length(uAeroFlowDir);
        vec3 flowDir = (flowLen > 0.001)
          ? (uAeroFlowDir / flowLen)
          : ((uFlowAxis > 0.5) ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));

        float petalPhase = aFlameMeta.x + dot(position, vec3(1.93, 0.81, 2.37));
        float t = uTime * (uSpeed * (1.65 + 0.55 * stretch + 0.25 * burst));

        if (uFlowAxis > 0.5) {
          // ==================================================================
          // Streamlined Liquid-Fire Teardrop Sheath around Warhammer Head
          // ==================================================================
          vec3 radVec = vec3(p.x, p.y * 0.36, p.z);
          float radLen = length(radVec);
          vec3 radDir = (radLen > 0.0005) ? (radVec / radLen) : vec3(0.0, 1.0, 0.0);

          // Stagnation face compression: windward side hugs the forged iron tightly,
          // leeward side tapers smoothly into aerodynamic teardrop flame tongues!
          windward = clamp(dot(radDir, -flowDir), 0.0, 1.0);
          float leeward = clamp(dot(radDir, flowDir), 0.0, 1.0);
          float stagCompress = 1.0 - windward * stretch * 0.36 * (1.0 - along * 0.35);
          float crossNarrow = 1.0 - stretch * 0.16 * along * (1.0 - leeward * 0.55);
          p.xz *= stagCompress * crossNarrow;

          // Inner core shell (role ~ 1.0) stays sleek & tight around the metal;
          // outer aerofoil tongues sweep smoothly into the resultant airflow & arc bend!
          float isInnerCore = step(0.5, role) * (1.0 - step(1.5, role));
          float sweepWeight = mix(1.0, 0.52, isInnerCore);
          float alongPow1 = pow(max(along, 0.0001), 1.16);
          float alongPow2 = pow(max(along, 0.0001), 2.02);

          // Smooth deflection from upright +Y toward resultant airflow (buoyancy + swing wake)
          vec3 aeroDelta = (flowDir - vec3(0.0, 1.0, 0.0)) * (alongPow1 * (1.15 + 1.35 * stretch) * sweepWeight);
          // Smooth C2 arc curvature along lagged swing wake (uAeroBendDir)
          vec3 arcBend = uAeroBendDir * (alongPow2 * (1.05 + 1.15 * stretch) * sweepWeight);
          // Leeward teardrop elongation during fast cleaves + radial forge flare on slam impact!
          vec3 wakeStretch = flowDir * (alongPow1 * stretch * (0.55 + 0.42 * leeward) * sweepWeight);
          vec3 impactSwell = (radDir * (0.26 * sin(along * 3.14159)) + vec3(0.0, 0.18 * along, 0.0)) * burst;

          p += aeroDelta + arcBend + wakeStretch + impactSwell;

          // Smooth traveling Kelvin-Helmholtz flame shear waves along the sheath
          float whipAmp = uVertexDistort * pow(max(along, 0.0001), 1.32)
            * (0.52 + 0.42 * uPhase2 + 0.36 * uWindup + 0.30 * stretch + 0.38 * burst)
            * mix(1.0, 0.42, isInnerCore);
          float wave = (
            sin(t - along * 8.4 + ac * 2.10 + petalPhase) +
            sin(t * 1.17 - along * 9.2 - ac * 2.10 - petalPhase * 0.71)
          ) * 0.34 + cos(t * 1.54 - along * 12.6 + petalPhase * 1.23) * 0.30;
          p += n * (wave * whipAmp);

          // Rotate normal subtly toward swept flow tangent for accurate Fresnel soft-edge fade
          vec3 sweptN = normalize(n + (flowDir - vec3(0.0, 1.0, 0.0)) * (0.38 * along * stretch));
          n = sweptN;
        } else if (uCurvedSpineMode > 0.5) {
          // ==================================================================
          // Multi-Segment Curved Bezier Liquid-Fire Wake Ribbon (0 Twist / 0 Pop!)
          // ==================================================================
          float s = along;
          float s1 = pow(max(s, 0.0001), 1.06);
          float s2 = s * s;

          // Continuous wake reach: short buoyant lick at idle -> sweeping comet arc on fast swings!
          float wakeLen = mix(0.68, 3.95, clamp(stretch / 1.15, 0.0, 1.0))
            + 0.34 * uWindup
            + 0.42 * burst;
          vec3 bendVec = uAeroBendDir * (wakeLen * 0.92);
          vec3 thermalLift = vec3(0.0, (0.18 + 0.16 * (1.0 - clamp(stretch, 0.0, 1.0))) * wakeLen, 0.0);

          // Smooth curved Bezier wake spine anchored right inside the warhammer sheath (s = 0)
          vec3 spinePos = flowDir * ((s1 * 0.96 - 0.08) * wakeLen)
            + bendVec * s2
            + thermalLift * s2;
          vec3 spineTan = normalize(
            flowDir * wakeLen
            + bendVec * (2.0 * s)
            + thermalLift * (2.0 * s)
            + vec3(0.0, 0.0001, 0.0)
          );

          // Re-orthogonalize parallel-transported cross-section basis smoothly along the curved tangent
          vec3 rAxis = uWakeRight - spineTan * dot(uWakeRight, spineTan);
          float rLen = length(rAxis);
          rAxis = (rLen > 0.001) ? (rAxis / rLen) : vec3(1.0, 0.0, 0.0);
          vec3 uAxis = normalize(cross(spineTan, rAxis));

          // Aerofoil cross-section taper + gentle helical flame-ribbon roll along wake
          float crossWidth = (0.76 + 0.22 * uPhase2 + 0.20 * uWindup + 0.28 * burst + 0.16 * clamp(stretch, 0.0, 1.0))
            * mix(1.02, 0.16, pow(max(s, 0.0001), 1.28));
          float vortexRoll = (aFlameMeta.y * 0.48 + sin(t * 0.58 - s * 4.4 + aFlameMeta.x) * 0.24) * s;
          float cr = cos(vortexRoll);
          float sr = sin(vortexRoll);
          vec2 csRot = mat2(cr, -sr, sr, cr) * (position.xy * crossWidth);
          vec2 nRot  = mat2(cr, -sr, sr, cr) * normal.xy;

          // Traveling shear flutter perpendicular to curved ribbon surface
          float flutterAmp = uVertexDistort * pow(max(s, 0.0001), 1.18) * (0.55 + 0.50 * stretch + 0.35 * uPhase2);
          float flutter = sin(t * 1.12 - s * 9.6 + ac * 2.2 + petalPhase) * 0.58
            + cos(t * 1.62 - s * 13.8 - petalPhase * 0.85) * 0.42;

          vec3 surfNorm = normalize(rAxis * nRot.x + uAxis * nRot.y + spineTan * (normal.z * 0.35));
          p = spinePos + rAxis * csRot.x + uAxis * csRot.y + surfNorm * (flutter * flutterAmp);
          n = surfNorm;
          windward = clamp(1.0 - s * 2.2, 0.0, 1.0);
        } else {
          // Legacy straight +Z ribbon mode for standalone callers
          float whipAmp = uVertexDistort * pow(max(along, 0.0001), 1.35) * (0.65 + 0.55 * uPhase2 + 0.45 * uWindup);
          float wave = (
            sin(t - along * 8.8 + ac * 2.35 + petalPhase) +
            sin(t * 1.13 - along * 9.4 - ac * 2.35 - petalPhase * 0.73)
          ) * 0.34 + cos(t * 1.58 - along * 13.4 + petalPhase * 1.29) * 0.32;
          p += n * (wave * whipAmp);
        }

        vWindward = windward;
        vLocalPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uPhase2;
      uniform float uWindup;
      uniform float uStaggerDim;
      uniform float uDetail;
      uniform float uSpeed;
      uniform float uFlowAxis;
      uniform float uAdditive;
      uniform float uSwingStretch;
      uniform float uImpactBurst;

      uniform vec3 uColSoot;
      uniform vec3 uColOuter;
      uniform vec3 uColMid;
      uniform vec3 uColHot;
      uniform vec3 uColCore;

      varying vec2 vUv;
      varying vec3 vBasePos;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying float vWindward;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        float along  = clamp((uFlowAxis > 0.5) ? vUv.y : vUv.x, 0.0, 1.0);
        float across = clamp((uFlowAxis > 0.5) ? vUv.x : vUv.y, 0.0, 1.0);
        float ac = (across - 0.5) * 2.0;
        float role = vMeta.z;
        float isClosedCore = step(0.5, role) * (1.0 - step(1.5, role));

        float stretch = clamp(uSwingStretch, 0.0, 1.45);
        float burst = clamp(uImpactBurst, 0.0, 1.25);

        // View-angle Fresnel grazing fade eliminates ALL hard polygon ribbon seams!
        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        float fresnelWeight = mix(0.68, 0.52, isClosedCore);
        float viewFade = mix(1.0, smoothstep(0.05, 0.54, ndv), fresnelWeight);
        float sideFeather = mix(
          smoothstep(0.0, 0.22, across) * smoothstep(1.0, 0.78, across),
          1.0,
          isClosedCore
        );

        float speedMult = 0.86 + 0.42 * uPhase2 + 0.36 * uWindup + 0.52 * stretch + 0.25 * burst;
        float t = uTime * uSpeed * speedMult;
        float petalOff = vMeta.x * 0.42 + (vBasePos.x - vBasePos.z) * 0.85;

        // Bilateral-symmetric (1, 1) Simplex lattice flow -> zero 45-degree diagonal drift!
        float flowFreq = mix(2.55, 2.05, clamp(stretch * 0.65, 0.0, 1.0));
        float warpFlow  = along * flowFreq - t * 0.86 + petalOff * 0.42;
        float warpCross = ac * 1.35;
        vec2 warpUv = vec2(warpFlow + warpCross, warpFlow - warpCross) * 0.70710678;
        vec2 warpV = fireDomainWarp(warpUv, uDetail);
        float wx = (warpV.x - warpV.y) * 0.70710678;
        float wy = (warpV.x + warpV.y) * 0.70710678;
        float warpAmt = (0.13 + 0.46 * along) * (0.76 + 0.28 * uPhase2 + 0.18 * burst);

        vec3 p3 = (uFlowAxis > 0.5)
          ? vec3(
              vLocalPos.x * 2.15 + wx * warpAmt * 0.72,
              along * 2.95 - t * 1.14,
              vLocalPos.z * 2.15 + wy * warpAmt * 0.72
            )
          : vec3(
              vLocalPos.x * 2.10 + wx * warpAmt,
              vLocalPos.y * 2.10 + wy * warpAmt,
              along * 2.85 - t * 1.28
            );

        float uCross = ac * 2.65 + wx * warpAmt * 0.98 + petalOff * 0.60;
        float uFlow  = along * (3.20 - 0.55 * clamp(stretch, 0.0, 1.0)) - t * 1.82 + wy * warpAmt * 0.48;
        vec2 p2 = vec2(uFlow + uCross, uFlow - uCross) * 0.70710678;
        vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
        float fbm = turb.x;
        float streaks = turb.y;

        // Streamlined teardrop width profile (closed inner core wraps 360° seamlessly)
        float halfW = mix(0.49, 0.21, pow(max(along, 0.0001), 1.05));
        float swayAcross = mix(0.11, 0.07, uFlowAxis);
        float distAcross = abs((across - 0.5) - wx * swayAcross * along);
        float ribbonMask = clamp(1.0 - pow(max(distAcross / max(halfW, 0.08), 0.0001), 1.90), 0.0, 1.0);
        float edgeMask = mix(ribbonMask, 0.92 + 0.08 * fbm, isClosedCore);

        // Smooth molten boundary ignition near iron + sleek licking tongue erosion at tail
        float leadIn = smoothstep(0.0, mix(0.08 + (1.0 - fbm) * 0.07, 0.03, isClosedCore), along);
        float tailFade = smoothstep(1.0, 0.08, along);
        float lickTip = smoothstep(0.52, 0.86, fbm) * smoothstep(0.28, 0.68, along) * smoothstep(0.99, 0.72, along) * 0.42;

        float field = edgeMask * (0.70 + 0.44 * tailFade)
          + (fbm - 0.45) * mix(0.30, 1.02, pow(max(along, 0.0001), 0.62))
          + lickTip
          + vWindward * 0.14 * (1.0 - along * 0.65)
          - pow(max(along, 0.0001), 1.18) * mix(0.56, 0.42, isClosedCore);
        field *= leadIn;

        float effIntensity = clamp(
          uIntensity * uStaggerDim * (0.72 + 0.46 * uPhase2 + 0.50 * uWindup + 0.24 * burst),
          0.0,
          1.75
        );
        float fireEdge  = smoothstep(0.06, 0.34, field);
        float tailSmoke = (1.0 - isClosedCore) * smoothstep(0.52, 0.95, along) * smoothstep(0.01, 0.16, field) * (1.0 - fireEdge * 0.85);
        float alpha = clamp(fireEdge * 0.94 + tailSmoke * 0.30, 0.0, 0.96)
          * viewFade
          * sideFeather
          * clamp(effIntensity, 0.0, 1.0);
        if (alpha < 0.015) discard;

        // Planckian Blackbody Temperature:
        // White-gold iron boundary & windward stagnation edge -> solar gold -> liquid amber -> deep carmine -> dark smoke dissolve!
        float centerSpineHot = mix(1.0 - smoothstep(0.0, 0.92, abs(ac)), 0.75 + 0.25 * ndv, isClosedCore);
        float ironBoundaryHot = smoothstep(0.34, 0.01, along)
          * (0.36 + 0.26 * centerSpineHot + 0.24 * uWindup + 0.16 * uPhase2 + 0.18 * vWindward + 0.20 * burst);
        float temp = clamp(
          smoothstep(0.06, 0.86, field) * 0.50
          + ironBoundaryHot
          + (streaks - 0.46) * 0.30
          + vMeta.y * 0.22
          + isClosedCore * 0.16 * (1.0 - along * 0.55)
          - smoothstep(0.28, 0.95, along) * 0.48,
          0.0,
          1.0
        );

        vec3 col = mix(uColSoot, uColOuter, smoothstep(0.00, 0.25, temp));
        col = mix(col, uColMid,  smoothstep(0.22, 0.54, temp));
        col = mix(col, uColHot,  smoothstep(0.52, 0.82, temp));
        col = mix(col, uColCore, smoothstep(0.80, 0.98, temp));

        // Soft dark smoke / heat-dissolve rim at cool trailing tips
        vec3 smokeRimCol = mix(vec3(0.20, 0.028, 0.014), vec3(0.075, 0.045, 0.042), smoothstep(0.68, 0.98, along));
        col = mix(col, smokeRimCol, clamp(tailSmoke * 0.72, 0.0, 0.85));

        // Incandescent liquid-fire filaments streaming off the forged iron
        float filament = smoothstep(0.58, 0.91, streaks) * smoothstep(0.26, 0.68, temp) * (1.0 - along * 0.45);
        col = mix(col, uColCore, filament * (0.24 + 0.20 * uWindup + 0.16 * stretch));

        // Soft-knee gold-preserving shoulder so toneMapped:false + wake/halo NEVER clips to flat white!
        float boost = 0.92 + 0.12 * uPhase2 + 0.16 * uWindup + 0.12 * burst;
        vec3 hdrCol = col * boost;
        float maxC = max(hdrCol.r, max(hdrCol.g, hdrCol.b));
        if (maxC > 0.88) {
          float soft = 0.88 + 0.12 * ((maxC - 0.88) / ((maxC - 0.88) + 0.24));
          hdrCol *= (soft / max(maxC, 0.0001));
        }
        vec3 ceiling = mix(vec3(1.00, 0.92, 0.68), vec3(0.94, 0.72, 0.30), uAdditive);
        hdrCol = min(hdrCol, ceiling);
        float outAlpha = clamp(alpha * mix(1.0, 0.62, uAdditive), 0.0, 0.92);
        gl_FragColor = vec4(hdrCol, outAlpha);
      }
    `
  });

  let elapsedInternal = 0.0;
  let disposed = false;

  mat.update = function update(time, dt = 0.016) {
    if (disposed) return;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    uniforms.uTime.value = elapsedInternal;
  };

  mat.setLowSpec = function setLowSpec(enabled = false) {
    lowSpec = Boolean(enabled);
    uniforms.uDetail.value = (isMobile || lowSpec) ? 0.0 : 1.0;
    uniforms.uIntensity.value = lowSpec ? baseIntensity * 0.85 : baseIntensity;
  };

  mat.setIntensity = function setIntensity(val = 1.0) {
    baseIntensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    uniforms.uIntensity.value = lowSpec ? baseIntensity * 0.85 : baseIntensity;
  };

  mat.setAerodynamics = function setAerodynamics({
    flowDir,
    bendDir,
    wakeRight,
    wakeUp,
    stretch,
    impactBurst
  } = {}) {
    if (disposed) return;
    if (flowDir && Number.isFinite(flowDir.x)) uniforms.uAeroFlowDir.value.copy(flowDir);
    if (bendDir && Number.isFinite(bendDir.x)) uniforms.uAeroBendDir.value.copy(bendDir);
    if (wakeRight && Number.isFinite(wakeRight.x)) uniforms.uWakeRight.value.copy(wakeRight);
    if (wakeUp && Number.isFinite(wakeUp.x)) uniforms.uWakeUp.value.copy(wakeUp);
    if (Number.isFinite(stretch)) uniforms.uSwingStretch.value = Math.max(0.0, Math.min(1.5, stretch));
    if (Number.isFinite(impactBurst)) uniforms.uImpactBurst.value = Math.max(0.0, Math.min(1.3, impactBurst));
  };

  mat.setCombatState = function setCombatState({
    heat,
    intensity,
    phase2,
    windup,
    staggerDim,
    aeroFlowDir,
    aeroBendDir,
    wakeRight,
    wakeUp,
    swingStretch,
    impactBurst
  } = {}) {
    if (disposed) return;
    if (Number.isFinite(intensity)) {
      mat.setIntensity(intensity);
    } else if (Number.isFinite(heat)) {
      mat.setIntensity(heat);
    }
    if (Number.isFinite(phase2)) uniforms.uPhase2.value = Math.max(0.0, Math.min(1.0, phase2));
    if (Number.isFinite(windup)) uniforms.uWindup.value = Math.max(0.0, Math.min(1.5, windup));
    if (Number.isFinite(staggerDim)) uniforms.uStaggerDim.value = Math.max(0.0, Math.min(1.0, staggerDim));
    if (aeroFlowDir && Number.isFinite(aeroFlowDir.x)) uniforms.uAeroFlowDir.value.copy(aeroFlowDir);
    if (aeroBendDir && Number.isFinite(aeroBendDir.x)) uniforms.uAeroBendDir.value.copy(aeroBendDir);
    if (wakeRight && Number.isFinite(wakeRight.x)) uniforms.uWakeRight.value.copy(wakeRight);
    if (wakeUp && Number.isFinite(wakeUp.x)) uniforms.uWakeUp.value.copy(wakeUp);
    if (Number.isFinite(swingStretch)) uniforms.uSwingStretch.value = Math.max(0.0, Math.min(1.5, swingStretch));
    if (Number.isFinite(impactBurst)) uniforms.uImpactBurst.value = Math.max(0.0, Math.min(1.3, impactBurst));
  };

  const baseDispose = mat.dispose.bind(mat);
  mat.dispose = function dispose() {
    if (disposed) return;
    disposed = true;
    baseDispose();
  };

  return mat;
}


// ============================================================================
// 7. WALL FLAME-JET TRAPS — WAVE 2 NEXT-GEN GARGOYLE INFERNO EDITION
//    - DC 1: High-detail carved Gothic Stone Gargoyle Heads (stepped corbel,
//            multi-segment ram/demon horns, deep eye sockets, snarling snout,
//            8 stone fangs & soot-charred furnace throat; castShadow on PC!)
//    - DC 2: Multi-layer volumetric InstancedMesh:
//              * Role -1: Recessed glowing throat furnace + eye-embers + 0.75s
//                         pressurized pre-ignition pilot spit
//              * Role  0: 5 helically-twisted longitudinal vortex ribbons +
//                         cross-billow rings with Archimedean buoyancy curl &
//                         radial opposite-wall splash!
//              * Role +1: Pressurized white-yellow blowtorch nozzle core spine
//    - DC 3 (PC): GPU billowing fire-lit thermal smoke plumes rising above jet
//    - DC 4 (PC) / DC 3 (Mobile): GPU 3D Wall-Impact Ricochet Spark Fountain +
//                                 streaking horizontal jet embers (off in LowSpec)
//    - Zero-GC .update(time, dt), .getActiveFlameBoxes(), .getActiveTrapLightSources()
//    - Zero ANGLE/D3D11 X4000 / X3571 warnings!
// ============================================================================
const MAX_WALL_FLAME_TRAPS = 12;

const GLSL_FETCH_TRAP_STATE_12 = /* glsl */ `
vec4 fetchTrapState12(float id) {
  vec4 s = vec4(0.0);
  s += uTrapState[0]  * (1.0 - step(0.5, abs(id - 0.0)));
  s += uTrapState[1]  * (1.0 - step(0.5, abs(id - 1.0)));
  s += uTrapState[2]  * (1.0 - step(0.5, abs(id - 2.0)));
  s += uTrapState[3]  * (1.0 - step(0.5, abs(id - 3.0)));
  s += uTrapState[4]  * (1.0 - step(0.5, abs(id - 4.0)));
  s += uTrapState[5]  * (1.0 - step(0.5, abs(id - 5.0)));
  s += uTrapState[6]  * (1.0 - step(0.5, abs(id - 6.0)));
  s += uTrapState[7]  * (1.0 - step(0.5, abs(id - 7.0)));
  s += uTrapState[8]  * (1.0 - step(0.5, abs(id - 8.0)));
  s += uTrapState[9]  * (1.0 - step(0.5, abs(id - 9.0)));
  s += uTrapState[10] * (1.0 - step(0.5, abs(id - 10.0)));
  s += uTrapState[11] * (1.0 - step(0.5, abs(id - 11.0)));
  return s;
}
`;

function smoothstep01(edge0, edge1, x) {
  const span = edge1 - edge0;
  if (span <= 1e-6) return x >= edge1 ? 1.0 : 0.0;
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / span));
  return t * t * (3.0 - 2.0 * t);
}

function tagGargoyleStonePart(rawGeo, topHex, botHex = null, sootNearMouth = false) {
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  if (g !== rawGeo) rawGeo.dispose();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal') {
      g.deleteAttribute(name);
    }
  }
  if (!g.attributes.normal) g.computeVertexNormals();

  const pos = g.attributes.position;
  const count = pos.count;
  const colTop = new THREE.Color(topHex);
  const colBot = botHex !== null ? new THREE.Color(botHex) : colTop;
  const sootCol = new THREE.Color(0x16100e);

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = pos.getY(i);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanY = Math.max(1e-4, maxY - minY);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const ty = botHex !== null ? (py - minY) / spanY : 1.0;
    let r = colBot.r + (colTop.r - colBot.r) * ty;
    let gr = colBot.g + (colTop.g - colBot.g) * ty;
    let b = colBot.b + (colTop.b - colBot.b) * ty;

    if (sootNearMouth) {
      // Realistic carbon soot darkening around the open furnace jaws (0, -0.02, 0.42)
      const dMouth = Math.hypot(px, py + 0.02, pz - 0.40);
      const scorch = smoothstep01(0.42, 0.08, dMouth) * 0.72;
      r = r + (sootCol.r - r) * scorch;
      gr = gr + (sootCol.g - gr) * scorch;
      b = b + (sootCol.b - b) * scorch;
    }

    colors[i * 3]     = r;
    colors[i * 3 + 1] = gr;
    colors[i * 3 + 2] = b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function xformNozzleGeo(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  if (rx !== 0) geo.rotateX(rx);
  if (ry !== 0) geo.rotateY(ry);
  if (rz !== 0) geo.rotateZ(rz);
  if (x !== 0 || y !== 0 || z !== 0) geo.translate(x, y, z);
  return geo;
}

/**
 * Sculpted High-Detail Gothic Carved Stone Gargoyle Head projecting along +Z from castle wall
 */
function appendCarvedStoneGargoyleHead(outParts, trap, isMobile = false) {
  const s = trap.scale;
  const seg = isMobile ? 7 : 12;
  const local = [];

  // A. Carved Gothic Ashlar Wall Medallion & Stepped Corbel Support Bracket (z = 0..0.18)
  // Darkened charred forged-iron / soot-stained gothic basalt palette so gargoyles sit organically in castle walls!
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.CylinderGeometry(0.48, 0.52, 0.11, isMobile ? 8 : 12), 0, 0.02, 0.055, Math.PI * 0.5, Math.PI / 12, 0),
    0x2c313e, 0x161820
  ));
  // Pointed Gothic arch crown molding above medallion
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.ConeGeometry(0.40, 0.38, 4), 0, 0.52, 0.06, 0, Math.PI * 0.25, 0, 1.15, 1.0, 0.42),
    0x333947, 0x1a1d26
  ));
  // Stepped stone corbel console supporting the heavy gargoyle jaw from below
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.CylinderGeometry(0.28, 0.14, 0.36, 6), 0, -0.44, 0.15, 0.28, Math.PI / 6, 0),
    0x272c37, 0x13151c
  ));
  // 4 carved stone rosette bosses around wall collar
  for (const [bx, by] of [[-0.36, 0.30], [0.36, 0.30], [-0.36, -0.28], [0.36, -0.28]]) {
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.DodecahedronGeometry(0.052, 0), bx, by, 0.10),
      0x3a4050, 0x1c202a
    ));
  }

  // B. Sculpted Gargoyle Cranium, Neck Collar & Recessed Soot-Charred Stone Throat (z = 0.08..0.44)
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.CylinderGeometry(0.30, 0.38, 0.28, seg), 0, 0.04, 0.20, Math.PI * 0.5, 0, 0),
    0x2b303c, 0x15171f, true
  ));
  // Sculpted bulbous cranium dome
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.SphereGeometry(0.29, seg, isMobile ? 6 : 9), 0, 0.18, 0.25, 0, 0, 0, 1.08, 0.88, 1.05),
    0x323846, 0x191c25
  ));
  // Deep blackened stone furnace throat barrel
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.CylinderGeometry(0.20, 0.18, 0.34, seg, 1, true), 0, -0.02, 0.26, Math.PI * 0.5, 0, 0),
    0x0e0908, 0x080505
  ));

  // C. Fierce Scowling Supraorbital Brow Ridges, Deep Eye Sockets, Snarling Snout & Flared Nostrils
  for (const side of [-1, 1]) {
    // Heavy furrowed stone brow ridge angled in a fierce V-scowl
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.BoxGeometry(0.24, 0.095, 0.22), side * 0.14, 0.23, 0.36, 0.18, -side * 0.22, -side * 0.28),
      0x394050, 0x1a1e28, true
    ));
    // Recessed dark eye-socket hood
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.SphereGeometry(0.068, 6, 5), side * 0.155, 0.175, 0.35, 0, 0, 0, 1.1, 0.8, 0.8),
      0x140e0d, 0x0c0808
    ));
    // Sculpted zygomatic cheekbone & swept bat-wing ear fin
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.11, 0.32, 5), side * 0.31, 0.08, 0.26, -0.25, 0, -side * 0.65),
      0x2f3442, 0x161922, true
    ));
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.085, 0.30, 4), side * 0.36, 0.26, 0.18, -0.45, side * 0.2, -side * 0.78),
      0x343a49, 0x181b24
    ));
    // Flared beast nostrils on snout tip
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.SphereGeometry(0.065, 6, 5), side * 0.095, 0.135, 0.46, 0, 0, 0, 1.0, 0.85, 1.15),
      0x303543, 0x171416, true
    ));
  }

  // Central ridged nasal bridge & snarling upper muzzle roof (z = 0.24..0.50)
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.CylinderGeometry(0.16, 0.25, 0.28, isMobile ? 6 : 8), 0, 0.13, 0.36, Math.PI * 0.44, Math.PI / 8, 0, 1.18, 1.0, 0.68),
    0x353b4a, 0x171416, true
  ));

  // D. Multi-Segment Curved Forged-Iron / Basalt Demon Horns (3 smooth arched segments per horn!)
  for (const side of [-1, 1]) {
    // Base horn boss
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.CylinderGeometry(0.068, 0.088, 0.18, isMobile ? 6 : 8), side * 0.23, 0.34, 0.24, -0.35, 0, -side * 0.52),
      0x2f3441, 0x1a1d26
    ));
    // Mid sweeping horn arc
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.CylinderGeometry(0.046, 0.068, 0.20, isMobile ? 6 : 8), side * 0.33, 0.47, 0.19, -0.15, 0, -side * 0.36),
      0x383e4d, 0x1f222d
    ));
    // Sharp forward-curling horn tip
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.046, 0.22, isMobile ? 6 : 8), side * 0.37, 0.62, 0.23, 0.38, 0, -side * 0.12),
      0x43495a, 0x242834
    ));
  }

  // E. Gaping Roaring Lower Jaw, Beard Scroll & 8 Smoked-Iron Fangs!
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.CylinderGeometry(0.19, 0.23, 0.26, isMobile ? 6 : 8), 0, -0.21, 0.34, Math.PI * 0.58, Math.PI / 8, 0, 1.14, 1.0, 0.58),
    0x262a35, 0x12141a, true
  ));
  local.push(tagGargoyleStonePart(
    xformNozzleGeo(new THREE.ConeGeometry(0.10, 0.20, 5), 0, -0.34, 0.32, Math.PI * 0.88, 0, 0),
    0x2b303c, 0x15171e
  ));

  // 2 long upper sabre canines + 2 lower tusks + 4 inner jagged teeth framing the fiery throat
  for (const side of [-1, 1]) {
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.036, 0.155, 5), side * 0.145, 0.055, 0.45, Math.PI * 0.96, 0, side * 0.08),
      0x504a42, 0x221d1c, true
    ));
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.025, 0.095, 4), side * 0.062, 0.075, 0.46, Math.PI * 0.96, 0, 0),
      0x4a443d, 0x201b1a, true
    ));
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.032, 0.13, 5), side * 0.125, -0.125, 0.42, 0.12, 0, -side * 0.08),
      0x4c463f, 0x1f1a19, true
    ));
    local.push(tagGargoyleStonePart(
      xformNozzleGeo(new THREE.ConeGeometry(0.022, 0.08, 4), side * 0.052, -0.14, 0.43, 0.12, 0, 0),
      0x45403a, 0x1c1817, true
    ));
  }

  const merged = mergeGeometries(local, false);
  for (let i = 0; i < local.length; i++) local[i].dispose();
  if (!merged) return;

  xformNozzleGeo(merged, trap.x, trap.y, trap.z, 0, trap.yaw, 0, s, s, s);
  outParts.push(merged);
}

/**
 * Multi-Layer Volumetric Turbulent Flame-Jet Geometry (1 InstancedMesh Draw Call!):
 *   - layerRole = -1.0: Deep gargoyle throat furnace orb + 2 glowing eye embers + pre-ignition pilot spit
 *   - layerRole =  0.0: 5 helically-twisted longitudinal vortex ribbons + 4 cupped cross-billow rings (PC)
 *   - layerRole = +1.0: 3 crossed pressurized white-yellow blowtorch nozzle core spines
 */
function createWallJetMultiLayerGeometry(isMobile = false) {
  const parts = [];

  // Layer -1.0 (A): Recessed molten throat furnace core + 2 fiery gargoyle eye-socket embers!
  const mawOrb = new THREE.SphereGeometry(0.175, isMobile ? 7 : 12, isMobile ? 5 : 8);
  mawOrb.scale(1.0, 0.88, 1.18);
  mawOrb.translate(0, -0.02, 0.27);
  parts.push(normalizeForMerge(mawOrb, 0.0, 0.22, -1.0, 0.35));

  for (const side of [-1, 1]) {
    const eyeEmber = new THREE.SphereGeometry(0.044, 7, 5);
    eyeEmber.scale(1.18, 0.75, 0.95);
    eyeEmber.translate(side * 0.155, 0.172, 0.395);
    parts.push(normalizeForMerge(eyeEmber, side * 0.6, 0.42, -1.0, 0.20));
  }

  // Layer -1.0 (B): 2 crossed pressurized pre-ignition pilot tongues spitting between stone fangs during 0.75s telegraph!
  for (let i = 0; i < 2; i++) {
    const p = new THREE.PlaneGeometry(0.32, 0.78, 3, 6);
    const pos = p.attributes.position;
    const uv = p.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const v = uv.getY(k);
      const lx = pos.getX(k) * (0.62 + 0.38 * Math.sin(v * Math.PI));
      const lz = 0.28 + v * 0.76;
      pos.setXYZ(k, lx, -0.02, lz);
    }
    p.rotateZ(i * Math.PI * 0.5 + 0.35);
    p.computeVertexNormals();
    parts.push(normalizeForMerge(p, 0.9 + i * 1.7, 0.18, -1.0, 1.0));
  }

  // Layer 0.0: 6 helically-twisted cupped 3D longitudinal flame vortex ribbons along +Z (uv.y: 0=muzzle -> 1=tip)
  // Smooth continuous 3D volume from every corridor camera angle with ZERO perpendicular cross-plane seams!
  const ribbonCount = isMobile ? 3 : 6;
  const segX = isMobile ? 3 : 5;
  const segY = isMobile ? 9 : 20;
  for (let i = 0; i < ribbonCount; i++) {
    const ang = (i / ribbonCount) * Math.PI;
    const plane = new THREE.PlaneGeometry(1.0, 1.0, segX, segY);
    const pos = plane.attributes.position;
    const uv = plane.attributes.uv;
    const twistSign = (i % 2 === 0) ? 1.0 : -1.0;

    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k);
      const v = uv.getY(k);
      const uCentered = (u - 0.5) * 2.0;
      // Pressurized narrow throat (0.19) -> billowing turbulent vortex (0.95) -> buoyant curling plume head
      const radiusProfile = 0.19 + 0.72 * Math.sin(Math.pow(v, 0.62) * Math.PI * 0.78) + 0.16 * v;
      const lx = uCentered * radiusProfile;
      const ly = 0.22 * radiusProfile * (1.0 - uCentered * uCentered) * twistSign;
      const tw = twistSign * 0.76 * Math.pow(v, 1.12);
      const ct = Math.cos(tw);
      const st = Math.sin(tw);
      pos.setXYZ(k, lx * ct - ly * st, lx * st + ly * ct, v);
    }
    plane.rotateZ(ang);
    plane.computeVertexNormals();
    parts.push(normalizeForMerge(plane, i * 1.19, (i % 2 === 0) ? 0.04 : -0.02, 0.0, 1.0));
  }

  // Layer +1.0: Short turbulent molten throat core (0..0.34 along jet — NO rigid white blowtorch cone!)
  const coreRibbons = isMobile ? 2 : 3;
  for (let i = 0; i < coreRibbons; i++) {
    const ang = (i / coreRibbons) * Math.PI + 0.38;
    const plane = new THREE.PlaneGeometry(1.0, 1.0, 2, isMobile ? 5 : 9);
    const pos = plane.attributes.position;
    const uv = plane.attributes.uv;
    for (let k = 0; k < pos.count; k++) {
      const u = uv.getX(k);
      const v = uv.getY(k);
      const uCentered = (u - 0.5) * 2.0;
      const rad = (0.11 + 0.17 * Math.sin(v * Math.PI * 0.85)) * (1.0 - v * 0.48);
      pos.setXYZ(k, uCentered * rad, 0.0, v * 0.34);
    }
    plane.rotateZ(ang);
    plane.computeVertexNormals();
    parts.push(normalizeForMerge(plane, 0.65 + i * 1.88, 0.14, 1.0, 0.34));
  }

  return mergeFlameParts(parts);
}

function resolveTrapDirection(spec) {
  let dx = 0;
  let dz = 0;
  if (Number.isFinite(spec.dirX) || Number.isFinite(spec.dirZ)) {
    dx = spec.dirX || 0;
    dz = spec.dirZ || 0;
  } else if (Number.isFinite(spec.normalX) || Number.isFinite(spec.normalZ)) {
    dx = spec.normalX || 0;
    dz = spec.normalZ || 0;
  } else if (Number.isFinite(spec.nx) || Number.isFinite(spec.nz)) {
    dx = spec.nx || 0;
    dz = spec.nz || 0;
  } else if (Number.isFinite(spec.rotY) || Number.isFinite(spec.facing)) {
    const y = Number.isFinite(spec.rotY) ? spec.rotY : spec.facing;
    dx = Math.sin(y);
    dz = Math.cos(y);
  } else if (spec.side === 'left' || spec.side === 'west') {
    dx = 1; dz = 0;
  } else if (spec.side === 'right' || spec.side === 'east') {
    dx = -1; dz = 0;
  } else {
    dx = (Number(spec.x) || 0) <= 0 ? 1 : -1;
    dz = 0;
  }
  const len = Math.hypot(dx, dz);
  if (len > 1e-4) {
    dx /= len;
    dz /= len;
  } else {
    dx = 1;
    dz = 0;
  }
  return { dx, dz, yaw: Math.atan2(dx, dz) };
}

/**
 * GPU Billowing Fire-Lit Smoke Plumes rising buoyantly above active flame jets & opposite-wall splash (PC)
 */
function createWallTrapSmokePlumes(traps, isMobile, lowSpec, stateUniformArr) {
  const perTrap = 14;
  const count = traps.length * perTrap;
  const rng = makeRng(0x41d89c23);

  const origins = new Float32Array(count * 3);
  const dirs = new Float32Array(count * 3);
  const params = new Float32Array(count * 4); // speed, phase, distAlongJet, size
  const trapIndices = new Float32Array(count);

  let idx = 0;
  for (let s = 0; s < perTrap; s++) {
    for (let t = 0; t < traps.length; t++) {
      const tr = traps[t];
      origins[idx * 3]     = tr.muzzleX + (rng() - 0.5) * 0.25;
      origins[idx * 3 + 1] = tr.y + 0.08 + rng() * 0.22;
      origins[idx * 3 + 2] = tr.muzzleZ + (rng() - 0.5) * 0.25;

      dirs[idx * 3]     = tr.dirX;
      dirs[idx * 3 + 1] = tr.wallSpan; // store wallSpan in dirs.y!
      dirs[idx * 3 + 2] = tr.dirZ;

      params[idx * 4]     = 0.42 + rng() * 0.34;
      params[idx * 4 + 1] = rng();
      params[idx * 4 + 2] = tr.jetLength * (0.38 + rng() * 0.62);
      params[idx * 4 + 3] = 0.85 + rng() * 0.70;

      trapIndices[idx] = t;
      idx++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(origins, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(params, 4));
  geo.setAttribute('aTrapIdx', new THREE.BufferAttribute(trapIndices, 1));

  const targetCount = (low) => ((low || isMobile) ? 0 : count);
  geo.setDrawRange(0, targetCount(lowSpec));

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) },
    uTrapState: { value: stateUniformArr }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec3 aDir;
      attribute vec4 aParam;
      attribute float aTrapIdx;

      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec4 uTrapState[${MAX_WALL_FLAME_TRAPS}];

      varying float vLife;
      varying float vAlpha;
      varying float vSeed;

      ${GLSL_FETCH_TRAP_STATE_12}

      void main() {
        vec4 st = fetchTrapState12(aTrapIdx);
        float jetPow = st.y;
        float jetExt = st.z;

        float life = fract(uTime * aParam.x + aParam.y);
        vLife = life;
        vSeed = aParam.y * 6.28318;
        vAlpha = jetPow;

        float maxWall = max(1.5, aDir.y - 0.22);
        float travel = min(aParam.z * max(0.2, jetExt) * pow(max(life, 0.0), 0.72), maxWall);
        float hitWall = smoothstep(maxWall - 0.8, maxWall, aParam.z * jetExt * life);

        vec3 p = position;
        p.x += aDir.x * travel + (-aDir.z) * sin(uTime * 1.4 + vSeed) * (0.28 + 0.55 * hitWall) * life;
        p.z += aDir.z * travel + ( aDir.x) * sin(uTime * 1.4 + vSeed) * (0.28 + 0.55 * hitWall) * life;
        // Strong thermal buoyancy lift (surges higher when smoke mushrooms up the opposite stone wall!)
        p.y += (0.35 + 1.55 * pow(max(life, 0.0), 1.25) + 0.95 * hitWall * life) * step(0.02, jetPow);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float grow = 0.60 + life * 1.45;
        float ptSize = (aParam.w * 290.0 * uPixelRatio * grow * step(0.02, jetPow)) / max(1.0, -mv.z);
        gl_PointSize = clamp(ptSize, 0.0, 74.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vLife;
      varying float vAlpha;
      varying float vSeed;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        if (vAlpha < 0.02) discard;
        vec2 c = gl_PointCoord - vec2(0.5);
        float ang = vSeed + vLife * 1.75;
        float ca = cos(ang);
        float sa = sin(ang);
        vec2 rc = mat2(ca, -sa, sa, ca) * c;

        float dist = length(c) * 2.0;
        float n = snoise2(rc * 3.6 + vec2(vSeed, -vLife * 2.1)) * 0.5 + 0.5;
        float wisp = smoothstep(0.96, 0.12, dist + (n - 0.5) * 0.48) * smoothstep(1.0, 0.24, dist);
        if (wisp < 0.025) discard;

        float env = smoothstep(0.0, 0.20, vLife) * smoothstep(1.0, 0.24, vLife);
        // Bottom of puff is warmly under-lit by the roaring flame stream beneath it!
        float underLit = clamp((gl_PointCoord.y - 0.32) * 1.35, 0.0, 1.0) * (1.0 - vLife * 0.65);
        vec3 fireGlow = vec3(0.52, 0.16, 0.04);
        vec3 darkSoot = vec3(0.09, 0.085, 0.095);
        vec3 col = mix(darkSoot, fireGlow, underLit * 0.72);

        float alpha = wisp * env * vAlpha * 0.24 * clamp(uIntensity, 0.0, 1.3);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'wall_flame_trap_smoke';
  points.frustumCulled = false;
  points.visible = !lowSpec && !isMobile;
  points.renderOrder = 3;

  return { points, geo, mat, uniforms, targetCount };
}

/**
 * GPU 3D Wall-Impact Ricochet Spark Fountain + Streaking Horizontal Jet Embers!
 *   - 40% jet/telegraph embers shooting out of gargoyle throat
 *   - 60% 3D conical spark shower exploding & bouncing under gravity off the opposite stone wall!
 */
function createWallFlameTrapSparks(traps, isMobile, lowSpec, stateUniformArr) {
  const perTrapPC = 32;
  const perTrapMob = 14;
  const maxPerTrap = perTrapPC;
  const count = traps.length * maxPerTrap;
  const rng = makeRng(0x77b41e5a);

  const origins = new Float32Array(count * 3);
  const dirs = new Float32Array(count * 3);
  const params = new Float32Array(count * 4); // speed, phase, reachOrImpactDist, signedSize (+jet / -wallImpact)
  const bounceVel = new Float32Array(count * 3); // 3D ricochet velocity off opposite stone wall!
  const trapIndices = new Float32Array(count);

  let idx = 0;
  // Interleave by slot so Mobile drawRange keeps both jet embers & wall-impact sparks on EVERY trap!
  for (let s = 0; s < maxPerTrap; s++) {
    const isWallSpark = (s % 4) !== 0; // 75% 3D wall-impact ricochet spark shower, 25% nozzle jet sparks!
    for (let t = 0; t < traps.length; t++) {
      const tr = traps[t];
      origins[idx * 3]     = tr.muzzleX + (rng() - 0.5) * 0.14;
      origins[idx * 3 + 1] = tr.y + (rng() - 0.5) * 0.14;
      origins[idx * 3 + 2] = tr.muzzleZ + (rng() - 0.5) * 0.14;

      dirs[idx * 3]     = tr.dirX;
      dirs[idx * 3 + 1] = (rng() - 0.35) * 0.22;
      dirs[idx * 3 + 2] = tr.dirZ;

      const impactDist = Math.min(tr.jetLength, tr.wallSpan - 0.12);
      const sz = isWallSpark ? (0.068 + rng() * 0.078) : (0.052 + rng() * 0.056);

      params[idx * 4]     = isWallSpark ? (1.35 + rng() * 1.25) : (1.15 + rng() * 1.15);
      params[idx * 4 + 1] = rng();
      params[idx * 4 + 2] = isWallSpark ? impactDist : (tr.jetLength * (0.68 + rng() * 0.34));
      params[idx * 4 + 3] = isWallSpark ? -sz : sz;

      // Rich 3D hemispherical ricochet velocity splashing BACKWARD, SIDEWAYS & UPWARD off stone wall!
      const reflBack = 1.10 + rng() * 2.65;
      const latSpread = (rng() - 0.5) * 5.2;
      const upBurst = 1.25 + rng() * 3.15;
      bounceVel[idx * 3]     = -tr.dirX * reflBack + (-tr.dirZ) * latSpread;
      bounceVel[idx * 3 + 1] = upBurst;
      bounceVel[idx * 3 + 2] = -tr.dirZ * reflBack + ( tr.dirX) * latSpread;

      trapIndices[idx] = t;
      idx++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(origins, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  geo.setAttribute('aParam', new THREE.BufferAttribute(params, 4));
  geo.setAttribute('aBounce', new THREE.BufferAttribute(bounceVel, 3));
  geo.setAttribute('aTrapIdx', new THREE.BufferAttribute(trapIndices, 1));

  const targetCount = (low) => (low ? 0 : traps.length * (isMobile ? perTrapMob : perTrapPC));
  geo.setDrawRange(0, targetCount(lowSpec));

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) },
    uTrapState: { value: stateUniformArr }
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec3 aDir;
      attribute vec4 aParam;
      attribute vec3 aBounce;
      attribute float aTrapIdx;

      uniform float uTime;
      uniform float uPixelRatio;
      uniform vec4 uTrapState[${MAX_WALL_FLAME_TRAPS}];

      varying float vLife;
      varying float vAlpha;
      varying float vIsSplash;

      ${GLSL_FETCH_TRAP_STATE_12}

      void main() {
        vec4 st = fetchTrapState12(aTrapIdx);
        float tele = st.x;
        float jetPow = st.y;
        float jetExt = st.z;

        bool wallSpark = aParam.w < 0.0;
        float baseSize = abs(aParam.w);
        float life = fract(uTime * aParam.x * (0.80 + 0.55 * jetPow) + aParam.y);
        vLife = life;
        vIsSplash = wallSpark ? 1.0 : 0.0;

        vec3 p = position;
        float actLvl = 0.0;

        if (wallSpark) {
          // 3D Wall-Impact Ricochet Spark Fountain: triggers when jet slams into opposite stone wall (jetExt > 0.72)!
          float impactOn = smoothstep(0.68, 0.90, jetExt) * jetPow;
          actLvl = impactOn;
          float hitDist = aParam.z;
          // Impact origin on opposite stone wall (lifted slightly by jet buoyancy!)
          p.x += aDir.x * hitDist;
          p.z += aDir.z * hitDist;
          p.y += 0.34;
          // Ballistic 3D ricochet trajectory with air drag + real gravity (-4.6 * t^2) + floor bounce clamp!
          float tof = life * 0.78;
          p += aBounce * (tof * (1.0 - 0.28 * life));
          p.y -= 4.6 * tof * tof;
          if (p.y < 0.03) {
            p.y = 0.03 + abs(p.y - 0.03) * 0.32;
          }
        } else {
          // Nozzle warning spit sparks during 0.75s telegraph + high-speed horizontal jet embers!
          actLvl = max(jetPow, tele * 0.65);
          float reach = mix(0.45 + tele * 1.15, aParam.z * max(0.18, jetExt), smoothstep(0.05, 0.28, jetPow));
          float dist = pow(max(life, 0.0), 0.78) * reach;
          p.x += aDir.x * dist;
          p.z += aDir.z * dist;
          float sw = uTime * 9.5 + aParam.y * 18.84 + life * 7.5;
          float spread = (0.10 + 0.48 * jetPow) * life;
          p.y += aDir.y * dist + sin(sw) * spread + 0.34 * life * life * jetPow;
          p.x += -aDir.z * cos(sw * 0.85) * spread;
          p.z +=  aDir.x * cos(sw * 0.85) * spread;
        }

        vAlpha = actLvl;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float env = smoothstep(0.0, 0.06, life) * smoothstep(1.0, 0.22, life);
        float ptSize = (baseSize * 360.0 * uPixelRatio * (0.58 + 0.70 * env) * step(0.02, actLvl)) / max(1.0, -mv.z);
        gl_PointSize = clamp(ptSize, 0.0, 16.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vLife;
      varying float vAlpha;
      varying float vIsSplash;

      void main() {
        if (vAlpha < 0.02) discard;
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        float soft = smoothstep(0.48, 0.04, d);
        if (soft < 0.02) discard;

        float fade = smoothstep(0.0, 0.08, vLife) * smoothstep(1.0, 0.24, vLife);
        vec3 colHot = mix(vec3(1.00, 0.95, 0.68), vec3(1.00, 0.99, 0.86), vIsSplash);
        vec3 colMid = vec3(1.00, 0.52, 0.08);
        vec3 colEnd = vec3(0.86, 0.14, 0.02);
        vec3 col = mix(colHot, colMid, smoothstep(0.04, 0.44, vLife));
        col = mix(col, colEnd, smoothstep(0.44, 0.96, vLife));

        float a = soft * fade * vAlpha * clamp(uIntensity, 0.0, 1.4);
        if (a < 0.015) discard;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'wall_flame_trap_sparks';
  points.frustumCulled = false;
  points.visible = !lowSpec;
  points.renderOrder = 6;

  return { points, geo, mat, uniforms, targetCount };
}

/**
 * Creates the Next-Gen Gothic Stone Gargoyle Wall Flame-Jet Trap Suite:
 *   - Carved stone gargoyle heads w/ 0.75s glowing throat & eye-ember telegraph
 *   - Multi-layer turbulent horizontal FBM flame jet w/ thermal buoyancy curl & wall splash
 *   - Billowing fire-lit dark smoke plumes + 3D opposite-wall ricochet spark shower
 *   - Exports .getActiveFlameBoxes() for combat.js AND .getActiveTrapLightSources() for dynamic wall lighting!
 */
export function createWallFlameJetTraps(trapSpecs = [], opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  let baseIntensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;
  const corridorHalfWidth = Number.isFinite(opts.corridorHalfWidth) ? opts.corridorHalfWidth : 5.0;

  const trackGeo = typeof opts.trackGeo === 'function' ? opts.trackGeo : (g) => g;
  const trackMat = typeof opts.trackMat === 'function' ? opts.trackMat : (m) => m;

  const localGeos = [];
  const localMats = [];
  const regGeo = (g) => { localGeos.push(g); return trackGeo(g); };
  const regMat = (m) => { localMats.push(m); return trackMat(m); };

  const group = new THREE.Group();
  group.name = 'wall_flame_jet_traps';

  const rawList = Array.isArray(trapSpecs) ? trapSpecs.slice(0, MAX_WALL_FLAME_TRAPS) : [];
  const traps = [];
  for (let i = 0; i < rawList.length; i++) {
    const s = rawList[i];
    if (!s) continue;
    const { dx, dz, yaw } = resolveTrapDirection(s);
    const scale = Number.isFinite(s.scale) ? s.scale : 1.0;
    const x = Number(s.x) || 0;
    const y = Number.isFinite(s.y) ? s.y : 1.15;
    const z = Number(s.z) || 0;
    const muzzleOffset = 0.42 * scale;
    const muzzleX = x + dx * muzzleOffset;
    const muzzleZ = z + dz * muzzleOffset;

    const cycleSec = (Number.isFinite(s.cycleSec) && s.cycleSec > 0.3) ? s.cycleSec : 4.6;
    const telegraphSec = Number.isFinite(s.telegraphSec) ? Math.max(0.15, s.telegraphSec) : 0.75;
    const jetSec = Number.isFinite(s.jetSec) ? Math.max(0.15, s.jetSec) : 1.55;
    const phaseOffset = Number.isFinite(s.phaseOffset) ? s.phaseOffset : (Number.isFinite(s.phase) ? s.phase : i * 1.15);
    const jetLength = (Number.isFinite(s.jetLength) && s.jetLength > 0.5) ? s.jetLength : 9.4;
    const jetHalfWidth = (Number.isFinite(s.jetHalfWidth) && s.jetHalfWidth > 0.15) ? s.jetHalfWidth : 1.15;
    const damagePerTick = Number.isFinite(s.damagePerTick) ? s.damagePerTick : 18;
    const tickIntervalSec = (Number.isFinite(s.tickIntervalSec) && s.tickIntervalSec > 0.05) ? s.tickIntervalSec : 0.35;

    // Exact distance from gargoyle jaws to opposite stone corridor wall (for wall splash & 3D spark ricochet!)
    let wallSpan = jetLength;
    if (Number.isFinite(s.wallSpan) && s.wallSpan > 1.0) {
      wallSpan = s.wallSpan;
    } else if (Math.abs(dx) > 0.5) {
      const oppWallX = dx > 0 ? corridorHalfWidth : -corridorHalfWidth;
      wallSpan = Math.max(2.0, (oppWallX - muzzleX) / dx);
    }

    traps.push({
      id: s.id || `flame_trap_${i}`,
      index: traps.length,
      x,
      y,
      z,
      muzzleX,
      muzzleZ,
      dirX: dx,
      dirZ: dz,
      yaw,
      scale,
      cycleSec,
      telegraphSec,
      jetSec,
      phaseOffset,
      jetLength,
      jetHalfWidth,
      wallSpan,
      damagePerTick,
      tickIntervalSec
    });
  }

  if (traps.length === 0) {
    const emptyArr = [];
    return {
      group,
      nozzleMesh: null,
      jetMesh: null,
      smokePoints: null,
      sparksPoints: null,
      count: 0,
      drawCalls: 0,
      getDrawCalls: () => 0,
      update: () => emptyArr,
      getActiveFlameBoxes: () => emptyArr,
      getActiveTrapLightSources: () => emptyArr,
      getTrapStates: () => emptyArr,
      isPointInFlame: () => null,
      setLowSpec() {},
      setIntensity() {},
      dispose() {}
    };
  }

  // DC #1: Merged High-Detail Charred Forged-Iron & Basalt Gargoyle Heads w/ PBR Micro-Relief
  const nozzleParts = [];
  for (let i = 0; i < traps.length; i++) {
    appendCarvedStoneGargoyleHead(nozzleParts, traps[i], isMobile);
  }
  const nozzleGeo = regGeo(mergeGeometries(nozzleParts, false));
  for (let i = 0; i < nozzleParts.length; i++) nozzleParts[i].dispose();
  if (nozzleGeo && nozzleGeo.attributes.position && nozzleGeo.attributes.normal) {
    const nPos = nozzleGeo.attributes.position;
    const nNorm = nozzleGeo.attributes.normal;
    const nUv = new Float32Array(nPos.count * 2);
    for (let k = 0; k < nPos.count; k++) {
      const ax = Math.abs(nNorm.getX(k));
      const ay = Math.abs(nNorm.getY(k));
      const az = Math.abs(nNorm.getZ(k));
      if (ay >= ax && ay >= az) {
        nUv[k * 2] = nPos.getX(k) * 1.35;
        nUv[k * 2 + 1] = nPos.getZ(k) * 1.35;
      } else if (ax >= az) {
        nUv[k * 2] = nPos.getZ(k) * 1.35;
        nUv[k * 2 + 1] = nPos.getY(k) * 1.35;
      } else {
        nUv[k * 2] = nPos.getX(k) * 1.35;
        nUv[k * 2 + 1] = nPos.getY(k) * 1.35;
      }
    }
    nozzleGeo.setAttribute('uv', new THREE.BufferAttribute(nUv, 2));
  }

  const pbr = opts.pbr || null;
  const nozzleMat = regMat(new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    normalMap: (!lowSpec && pbr?.ironNormal) ? pbr.ironNormal : null,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: pbr?.ironRoughness || null,
    roughness: 0.88,
    metalness: 0.36,
    envMapIntensity: 0.48
  }));
  const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzleMesh.name = 'wall_flame_trap_gargoyles';
  nozzleMesh.castShadow = false;
  nozzleMesh.receiveShadow = true;
  group.add(nozzleMesh);

  // DC #2: Multi-Layer Volumetric InstancedMesh (Throat/Eye Telegraph + Buoyant FBM Flame Jet + Wall Splash!)
  const jetGeo = regGeo(createWallJetMultiLayerGeometry(isMobile));
  const trapStateData = new Float32Array(traps.length * 4);
  const trapDimData = new Float32Array(traps.length * 3); // jetLength, jetHalfWidth, wallSpan
  for (let i = 0; i < traps.length; i++) {
    trapStateData[i * 4 + 3] = traps[i].phaseOffset + i * 1.91;
    trapDimData[i * 3]     = traps[i].jetLength;
    trapDimData[i * 3 + 1] = traps[i].jetHalfWidth;
    trapDimData[i * 3 + 2] = traps[i].wallSpan;
  }
  const trapStateAttr = new THREE.InstancedBufferAttribute(trapStateData, 4);
  trapStateAttr.setUsage(THREE.DynamicDrawUsage);
  jetGeo.setAttribute('aTrapState', trapStateAttr);
  jetGeo.setAttribute('aTrapDim', new THREE.InstancedBufferAttribute(trapDimData, 3));

  const jetUniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: baseIntensity },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uColRim:   { value: toColorVec3(opts.rimColor,   0x6e0a02) },
    uColOuter: { value: toColorVec3(opts.outerColor, 0xc82204) },
    uColMid:   { value: toColorVec3(opts.midColor,   0xf4680a) },
    uColHot:   { value: toColorVec3(opts.hotColor,   0xffba32) },
    uColCore:  { value: toColorVec3(opts.coreColor,  0xfff0be) }
  };

  const jetMat = regMat(new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: jetUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aFlameMeta;
      attribute vec4 aTrapState; // x=telegraph01, y=jetPower, z=jetExtend, w=phase
      attribute vec3 aTrapDim;   // x=jetLength, y=jetHalfWidth, z=wallSpan

      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying vec4 vState;
      varying float vWallSplash;

      void main() {
        vUv = uv;
        vMeta = aFlameMeta;
        vState = aTrapState;
        vWallSplash = 0.0;

        float role = aFlameMeta.z;
        float tele = aTrapState.x;
        float jetPow = aTrapState.y;
        float jetExt = aTrapState.z;
        float ph = aTrapState.w + aFlameMeta.x;

        vec3 p = position;
        vec3 n = normal;

        if (role < -0.5) {
          // Glowing stone gargoyle throat furnace, fiery eye sockets & 0.75s pressurized pilot spit
          float actLvl = max(tele, jetPow);
          float pulse = 1.0 + 0.14 * sin(uTime * (13.0 + tele * 20.0) + ph);
          if (aFlameMeta.w > 0.6) {
            float lick = max(tele * tele * 1.18, jetPow * 0.78);
            p.z = 0.28 + (p.z - 0.28) * max(0.02, lick * pulse);
            p.xy *= (0.45 + 0.75 * lick);
            p.x += sin(uTime * 19.0 + ph + uv.y * 5.0) * 0.06 * uv.y * lick;
            p.y += cos(uTime * 16.0 + ph) * 0.04 * uv.y * lick + uv.y * uv.y * 0.08 * lick;
          } else if (aFlameMeta.w < 0.30) {
            // Gargoyle eye-socket embers
            p = position;
          } else {
            // Deep throat molten core
            p.xy *= (0.84 + 0.26 * actLvl) * pulse;
          }
        } else {
          // Multi-layer volumetric horizontal flame jet with buoyancy curl & opposite-wall splash!
          float along = clamp(p.z, 0.0, 1.0);
          float rawReach = aTrapDim.x * mix(0.06, 1.0, clamp(jetExt, 0.0, 1.0));
          float maxWallZ = max(1.2, aTrapDim.z - 0.08);
          float wallHit = smoothstep(maxWallZ - 0.85, maxWallZ, rawReach) * smoothstep(0.72, 0.98, along);
          vWallSplash = wallHit;

          float swell = aTrapDim.y * (0.48 + 0.56 * jetPow) * (1.0 + wallHit * 0.68);
          p.xy *= swell;

          float zDist = min(along * rawReach, maxWallZ);
          p.z = 0.40 + zDist;

          // Turbulent helical shear vortex + real Archimedean upward buoyancy curl!
          float t = uTime * 14.0 + ph;
          float bend = pow(max(along, 0.0), 1.15) * jetPow;
          float tw = sin(t - along * 7.4) * 0.42 * bend;
          float ct = cos(tw);
          float st = sin(tw);
          p.xy = mat2(ct, -st, st, ct) * p.xy;
          n.xy = mat2(ct, -st, st, ct) * n.xy;

          float buoyancyLift = (pow(max(along, 0.0), 1.78) * 0.54 + wallHit * 0.48) * jetPow;
          p.x += sin(t * 0.94 - along * 8.8) * 0.14 * aTrapDim.y * bend;
          p.y += cos(t * 0.86 - along * 8.1 + ph) * 0.11 * aTrapDim.y * bend + buoyancyLift;

          p *= step(0.005, jetPow);
        }

        vLocalPos = p;
        mat3 instRot = mat3(instanceMatrix);
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * (instRot * n));
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uIntensity;
      uniform float uDetail;

      uniform vec3 uColRim;
      uniform vec3 uColOuter;
      uniform vec3 uColMid;
      uniform vec3 uColHot;
      uniform vec3 uColCore;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying vec4 vState;
      varying float vWallSplash;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        float role = vMeta.z;
        float tele = vState.x;
        float jetPow = vState.y;
        float ph = vState.w + vMeta.x;
        vec2 uv = clamp(vUv, 0.0, 1.0);

        // ====================================================================
        // Role -1: Recessed Gargoyle Throat Furnace, Eye Embers & 0.75s Pilot Spit
        // ====================================================================
        if (role < -0.5) {
          float heat = max(tele, jetPow);
          if (heat < 0.015) discard;

          float tFast = uTime * (7.0 + heat * 7.0) + ph;
          float pulse = 0.80 + 0.20 * sin(tFast * 2.2 + uv.y * 4.0);

          if (vMeta.w > 0.6) {
            float acrossP = abs(uv.x - 0.5) * 2.0;
            float n = snoise2(vec2(uv.x * 3.8 + ph, uv.y * 3.2 - tFast * 1.45)) * 0.5 + 0.5;
            float env = (1.0 - acrossP * acrossP) * smoothstep(0.0, 0.16, uv.y) * smoothstep(1.0, 0.14, uv.y);
            float f = env + (n - 0.45) * 0.55 - uv.y * 0.34;
            float a = smoothstep(0.08, 0.36, f) * smoothstep(0.06, 0.60, heat) * 0.92 * clamp(uIntensity, 0.0, 1.4);
            if (a < 0.02) discard;
            float tempT = clamp(f * 0.76 + heat * 0.48 - uv.y * 0.34, 0.0, 1.0);
            vec3 cT = mix(uColOuter, uColMid, smoothstep(0.10, 0.44, tempT));
            cT = mix(cT, uColHot, smoothstep(0.44, 0.76, tempT));
            cT = mix(cT, uColCore, smoothstep(0.76, 0.96, tempT));
            gl_FragColor = vec4(min(cT * (0.95 + 0.16 * pulse), vec3(1.10)), a);
            return;
          }

          float ndvM = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
          float crack = snoise2(vec2(uv.x * 6.5 + ph, uv.y * 6.5 - uTime * 3.4)) * 0.5 + 0.5;
          float glow = clamp((0.48 + 0.52 * ndvM) * (0.56 + 0.44 * crack) * heat * pulse * 1.40, 0.0, 1.0);
          vec3 colM = mix(uColRim, uColOuter, smoothstep(0.04, 0.28, glow));
          colM = mix(colM, uColMid,  smoothstep(0.26, 0.55, glow));
          colM = mix(colM, uColHot,  smoothstep(0.53, 0.80, glow));
          colM = mix(colM, uColCore, smoothstep(0.78, 0.96, glow));
          float alphaM = clamp(smoothstep(0.02, 0.24, heat) * (0.72 + 0.28 * ndvM), 0.0, 0.96);
          gl_FragColor = vec4(min(colM * (0.95 + 0.18 * heat), vec3(1.10)), alphaM);
          return;
        }

        // ====================================================================
        // Role 0 & +1: Pressurized Nozzle + Buoyant Vortex Plume + Wall Splash!
        // ====================================================================
        if (jetPow < 0.015) discard;

        float along = uv.y;
        float across = uv.x;
        float t = uTime * 6.2 + ph * 1.31;

        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        // Stronger grazing-angle & lateral edge fade eliminates crisp almond ribbon plane seams!
        float viewFade = mix(1.0, smoothstep(0.08, 0.54, ndv), 0.64);
        float sideFade = smoothstep(0.0, 0.26, across) * smoothstep(1.0, 0.74, across);

        vec2 warpCoord = vec2(across * 2.9 + ph * 0.41, along * 3.8 - t * 1.24);
        vec2 warpV = fireDomainWarp(warpCoord, uDetail);
        float wx = warpV.x;
        float wy = warpV.y;
        float warpAmt = 0.24 + 0.72 * pow(max(along, 0.0), 0.72);

        vec3 p3 = vec3(
          vLocalPos.x * 1.55 + wx * warpAmt + sin(ph),
          vLocalPos.y * 1.55 + wy * warpAmt + cos(ph),
          vLocalPos.z * 0.96 - t * 1.68
        );
        vec2 p2 = vec2(
          across * 5.2 + wx * warpAmt * 1.45 + ph * 0.73,
          along * 4.8 - t * 2.38 + wy * warpAmt * 0.72
        );
        vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
        float fbm = turb.x;
        float filaments = turb.y;

        float centerShift = (wx * 0.22 + (fbm - 0.5) * 0.28) * pow(max(along, 0.0), 0.84);
        float halfW = mix(0.38, 0.22, pow(max(along, 0.0), 1.25)) + sin(along * 3.14159) * 0.11 + vWallSplash * 0.14;
        float r = abs((across - 0.5) - centerShift) / max(halfW, 0.07);

        float muzzleIn = smoothstep(0.0, 0.08, along);
        float tipFeather = smoothstep(1.0, 0.74, along);
        float tipOut = smoothstep(1.0, 0.14, along);
        float colShape = pow(clamp(1.0 - r * r, 0.0, 1.0), 1.25);
        float turbDrive = (fbm - 0.44) * mix(0.52, 1.40, pow(max(along, 0.0), 0.58));
        float detachTip = smoothstep(0.52, 0.84, fbm) * smoothstep(0.32, 0.68, along) * smoothstep(0.98, 0.70, along) * smoothstep(1.50, 0.35, r) * 0.58;
        float erosion = pow(max(along, 0.0), 1.18) * 0.56 - vWallSplash * 0.16;

        float field = (colShape * (0.68 + 0.36 * tipOut) + turbDrive + detachTip - erosion) * muzzleIn * tipFeather;

        bool isCoreSpine = role > 0.5;
        float flameEdge = isCoreSpine ? smoothstep(0.24, 0.68, field) : smoothstep(0.11, 0.54, field);
        float smokeBillow = isCoreSpine ? 0.0 : (smoothstep(0.46, 0.94, along) * smoothstep(0.02, 0.22, field) * (1.0 - flameEdge * 0.82));
        float alpha = clamp(pow(max(flameEdge, 0.0), 0.94) * 0.86 + smokeBillow * 0.32, 0.0, 0.90) * viewFade * sideFade;
        if (isCoreSpine) {
          alpha *= smoothstep(0.76, 0.08, along) * 0.44;
        }
        alpha *= smoothstep(0.02, 0.22, jetPow) * clamp(uIntensity, 0.0, 1.35);
        if (alpha < 0.016) discard;

        // Calibrated Gothic Bonfire-matched temperature ramp: molten throat -> roaring amber-orange -> crimson licking tongues -> dark soot!
        float nozzlePressureHot = smoothstep(0.30, 0.01, along) * (1.0 - smoothstep(0.0, 0.55, r)) * 0.24;
        float coreZone = (1.0 - smoothstep(0.0, 0.64, r)) * smoothstep(0.72, 0.03, along);
        float temp = clamp(
          smoothstep(0.08, 0.88, field) * 0.48
          + coreZone * 0.28
          + nozzlePressureHot
          + vWallSplash * 0.10
          + (filaments - 0.46) * 0.34
          + vMeta.y * 0.75
          + (isCoreSpine ? 0.16 : 0.0)
          - smoothstep(0.38, 0.92, along) * 0.46,
          0.0,
          1.0
        );

        vec3 col = mix(uColRim, uColOuter, smoothstep(0.00, 0.28, temp));
        col = mix(col, uColMid,  smoothstep(0.26, 0.58, temp));
        col = mix(col, uColHot,  smoothstep(0.56, 0.84, temp));
        col = mix(col, uColCore, smoothstep(0.84, 0.98, temp));

        float tipCool = smoothstep(0.48, 0.94, along) * (1.0 - smoothstep(0.14, 0.54, temp));
        vec3 sootSmoke = mix(vec3(0.22, 0.032, 0.014), vec3(0.08, 0.075, 0.082), smoothstep(0.64, 0.96, along));
        col = mix(col, sootSmoke, clamp(tipCool * 0.66 + smokeBillow * 0.78, 0.0, 0.90));

        float hotStreak = smoothstep(0.60, 0.92, filaments) * smoothstep(0.30, 0.72, temp) * (1.0 - along * 0.48);
        col = mix(col, uColCore, hotStreak * 0.22);

        float boost = (0.90 + 0.10 * jetPow) * (isCoreSpine ? 1.02 : 0.96);
        gl_FragColor = vec4(min(col * boost, vec3(1.02)), clamp(alpha, 0.0, 0.88));
      }
    `
  }));

  const jetMesh = new THREE.InstancedMesh(jetGeo, jetMat, traps.length);
  jetMesh.name = 'wall_flame_trap_jets';
  jetMesh.frustumCulled = false;
  jetMesh.renderOrder = 4;

  for (let i = 0; i < traps.length; i++) {
    const tr = traps[i];
    _dummy.position.set(tr.x, tr.y, tr.z);
    _dummy.rotation.set(0, tr.yaw, 0);
    _dummy.scale.set(tr.scale, tr.scale, tr.scale);
    _dummy.updateMatrix();
    jetMesh.setMatrixAt(i, _dummy.matrix);
  }
  jetMesh.instanceMatrix.needsUpdate = true;
  group.add(jetMesh);

  // Shared GPU state uniform array across smoke & spark particle systems
  const sharedStateUniformArr = [];
  for (let i = 0; i < MAX_WALL_FLAME_TRAPS; i++) {
    sharedStateUniformArr.push(new THREE.Vector4(0, 0, 0, 0));
  }

  // DC #3 (PC High): Billowing Fire-Lit Rising Smoke Plumes
  const smokeEntry = createWallTrapSmokePlumes(traps, isMobile, lowSpec, sharedStateUniformArr);
  regGeo(smokeEntry.geo);
  regMat(smokeEntry.mat);
  group.add(smokeEntry.points);

  // DC #4 (PC) / DC #3 (Mobile): 3D Wall-Impact Ricochet Spark Fountain + Jet Embers (off in LowSpec -> 2 DC!)
  const sparksEntry = createWallFlameTrapSparks(traps, isMobile, lowSpec, sharedStateUniformArr);
  regGeo(sparksEntry.geo);
  regMat(sparksEntry.mat);
  group.add(sparksEntry.points);

  // Pre-allocated zero-GC pools for combat.js & dynamic wall lighting (soulsLightingRig / soulsArena)
  const trapStates = traps.map((tr) => ({
    id: tr.id,
    index: tr.index,
    state: 'cooldown',
    telegraph01: 0,
    jet01: 0,
    jetPower: 0,
    jetExtend: 0,
    jetReach: 0,
    isHarmful: false,
    justStartedTelegraph: false,
    justStartedFiring: false,
    originX: tr.muzzleX,
    originY: tr.y,
    originZ: tr.muzzleZ,
    dirX: tr.dirX,
    dirZ: tr.dirZ,
    jetLength: tr.jetLength,
    wallSpan: tr.wallSpan,
    halfWidth: tr.jetHalfWidth
  }));

  const boxPool = traps.map((tr) => ({
    id: tr.id,
    index: tr.index,
    state: 'firing',
    originX: tr.muzzleX,
    originY: tr.y,
    originZ: tr.muzzleZ,
    dirX: tr.dirX,
    dirZ: tr.dirZ,
    length: 0,
    halfWidth: tr.jetHalfWidth,
    minX: tr.muzzleX,
    maxX: tr.muzzleX,
    minY: tr.y - 0.88,
    maxY: tr.y + 0.95,
    minZ: tr.muzzleZ,
    maxZ: tr.muzzleZ,
    power: 0,
    telegraph01: 0,
    jet01: 0,
    damagePerTick: tr.damagePerTick,
    tickIntervalSec: tr.tickIntervalSec
  }));

  const lightPool = traps.map((tr) => ({
    id: tr.id,
    index: tr.index,
    state: 'firing',
    x: tr.muzzleX,
    y: tr.y + 0.15,
    z: tr.muzzleZ,
    color: 0xff8220,
    intensity: 0,
    baseInt: 0,
    distance: 15.5,
    dist: 15.5,
    decay: 2,
    weight: 2.6,
    power: 0,
    phase: tr.phaseOffset
  }));

  const activeBoxes = [];
  const activeLights = [];

  function getDrawCalls() {
    let dc = 2; // nozzleMesh + jetMesh
    if (smokeEntry.points.visible) dc += 1;
    if (sparksEntry.points.visible) dc += 1;
    return dc;
  }

  let elapsedInternal = 0.0;
  let disposed = false;

  function update(time, dt = 0.016) {
    if (disposed) return activeBoxes;
    if (Number.isFinite(time)) {
      elapsedInternal = time;
    } else if (Number.isFinite(dt)) {
      elapsedInternal += Math.max(0.0, Math.min(dt, 0.1));
    }
    const t = elapsedInternal;
    jetUniforms.uTime.value = t;
    if (smokeEntry.points.visible) smokeEntry.uniforms.uTime.value = t;
    if (sparksEntry.points.visible) sparksEntry.uniforms.uTime.value = t;

    activeBoxes.length = 0;
    activeLights.length = 0;

    for (let i = 0; i < traps.length; i++) {
      const tr = traps[i];
      const st = trapStates[i];
      const prevState = st.state;

      const modT = (((t + tr.phaseOffset) % tr.cycleSec) + tr.cycleSec) % tr.cycleSec;
      let nextState = 'cooldown';
      let teleVis = 0.0;
      let tele01 = 0.0;
      let jet01 = 0.0;
      let jetPow = 0.0;
      let jetExt = 0.0;

      if (modT < tr.telegraphSec) {
        nextState = 'telegraph';
        tele01 = modT / tr.telegraphSec;
        teleVis = 0.18 + 0.82 * Math.pow(tele01, 1.30);
      } else if (modT < tr.telegraphSec + tr.jetSec) {
        nextState = 'firing';
        const jetElapsed = modT - tr.telegraphSec;
        jet01 = jetElapsed / tr.jetSec;
        const extRamp = smoothstep01(0.0, Math.min(0.18, tr.jetSec * 0.24), jetElapsed);
        const retRamp = 1.0 - smoothstep01(Math.max(0.0, tr.jetSec - 0.24), tr.jetSec, jetElapsed);
        jetExt = 0.14 + 0.86 * extRamp;
        jetPow = extRamp * retRamp;
        teleVis = 0.96 * retRamp;
      } else {
        nextState = 'cooldown';
        const coolElapsed = modT - (tr.telegraphSec + tr.jetSec);
        teleVis = Math.exp(-coolElapsed * 4.2) * 0.40;
        if (teleVis < 0.015) teleVis = 0.0;
      }

      const clampedMaxLen = Math.min(tr.jetLength, tr.wallSpan);
      const reach = jetPow > 0.02 ? clampedMaxLen * jetExt : 0.0;
      const isHarmful = nextState === 'firing' && jetPow > 0.22;

      st.state = nextState;
      st.telegraph01 = tele01;
      st.jet01 = jet01;
      st.jetPower = jetPow;
      st.jetExtend = jetExt;
      st.jetReach = reach;
      st.isHarmful = isHarmful;
      st.justStartedTelegraph = nextState === 'telegraph' && prevState !== 'telegraph';
      st.justStartedFiring = nextState === 'firing' && prevState !== 'firing';

      const b4 = i * 4;
      trapStateData[b4]     = teleVis;
      trapStateData[b4 + 1] = jetPow;
      trapStateData[b4 + 2] = jetExt;
      sharedStateUniformArr[i].set(teleVis, jetPow, jetExt, trapStateData[b4 + 3]);

      if (isHarmful) {
        const box = boxPool[i];
        const endX = tr.muzzleX + tr.dirX * reach;
        const endZ = tr.muzzleZ + tr.dirZ * reach;
        const hw = tr.jetHalfWidth;
        box.length = reach;
        box.power = jetPow;
        box.telegraph01 = 0;
        box.jet01 = jet01;
        box.minX = Math.min(tr.muzzleX, endX) - Math.abs(tr.dirZ) * hw;
        box.maxX = Math.max(tr.muzzleX, endX) + Math.abs(tr.dirZ) * hw;
        box.minZ = Math.min(tr.muzzleZ, endZ) - Math.abs(tr.dirX) * hw;
        box.maxZ = Math.max(tr.muzzleZ, endZ) + Math.abs(tr.dirX) * hw;
        if (Math.abs(tr.dirZ) < 0.01) {
          box.minZ = tr.muzzleZ - hw;
          box.maxZ = tr.muzzleZ + hw;
        }
        if (Math.abs(tr.dirX) < 0.01) {
          box.minX = tr.muzzleX - hw;
          box.maxX = tr.muzzleX + hw;
        }
        activeBoxes.push(box);
      }

      // Dynamic physical wall-lighting source during firing & telegraph!
      if (jetPow > 0.04 || teleVis > 0.12) {
        const lt = lightPool[i];
        const flicker = 0.90 + 0.07 * Math.sin(t * 17.3 + i * 2.1) + 0.04 * Math.cos(t * 29.1 + i);
        if (jetPow > 0.04) {
          const midDist = reach * 0.48;
          lt.state = 'firing';
          lt.x = tr.muzzleX + tr.dirX * midDist;
          lt.y = tr.y + 0.28 + 0.20 * jetExt;
          lt.z = tr.muzzleZ + tr.dirZ * midDist;
          lt.color = 0xff8220;
          lt.intensity = 6.2 * jetPow * flicker * baseIntensity;
          lt.baseInt = lt.intensity;
          lt.distance = 16.0;
          lt.dist = 16.0;
          lt.weight = 2.75 * jetPow;
          lt.power = jetPow;
        } else {
          lt.state = 'telegraph';
          lt.x = tr.muzzleX + tr.dirX * 0.42;
          lt.y = tr.y + 0.06;
          lt.z = tr.muzzleZ + tr.dirZ * 0.42;
          lt.color = 0xff4812;
          lt.intensity = 2.3 * teleVis * flicker * baseIntensity;
          lt.baseInt = lt.intensity;
          lt.distance = 7.8;
          lt.dist = 7.8;
          lt.weight = 1.15 * teleVis;
          lt.power = teleVis * 0.45;
        }
        activeLights.push(lt);
      }
    }

    trapStateAttr.needsUpdate = true;
    return activeBoxes;
  }

  function isPointInFlame(px, pz, py = 1.0, padRadius = 0.35) {
    const pad = Math.max(0, Number.isFinite(padRadius) ? padRadius : 0.35);
    for (let i = 0; i < activeBoxes.length; i++) {
      const b = activeBoxes[i];
      if (py < b.minY - pad || py > b.maxY + pad) continue;
      const rx = px - b.originX;
      const rz = pz - b.originZ;
      const along = rx * b.dirX + rz * b.dirZ;
      if (along < -pad || along > b.length + pad) continue;
      const perp = Math.abs(rx * (-b.dirZ) + rz * b.dirX);
      if (perp <= b.halfWidth + pad) return b;
    }
    return null;
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    jetUniforms.uDetail.value = (isMobile || lowSpec) ? 0.0 : 1.0;
    jetUniforms.uIntensity.value = lowSpec ? baseIntensity * 0.88 : baseIntensity;
    nozzleMesh.castShadow = !isMobile && !lowSpec;

    const smkCount = smokeEntry.targetCount(lowSpec);
    smokeEntry.geo.setDrawRange(0, smkCount);
    smokeEntry.points.visible = smkCount > 0;
    smokeEntry.uniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);

    const spkCount = sparksEntry.targetCount(lowSpec);
    sparksEntry.geo.setDrawRange(0, spkCount);
    sparksEntry.points.visible = spkCount > 0;
    sparksEntry.uniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);
  }

  function setIntensity(val = 1.0) {
    if (disposed) return;
    baseIntensity = Math.max(0.0, Number.isFinite(val) ? val : 1.0);
    jetUniforms.uIntensity.value = lowSpec ? baseIntensity * 0.88 : baseIntensity;
    smokeEntry.uniforms.uIntensity.value = baseIntensity;
    sparksEntry.uniforms.uIntensity.value = baseIntensity;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    activeBoxes.length = 0;
    activeLights.length = 0;
    for (let i = 0; i < localGeos.length; i++) localGeos[i].dispose?.();
    for (let i = 0; i < localMats.length; i++) localMats[i].dispose?.();
    localGeos.length = 0;
    localMats.length = 0;
  }

  return {
    group,
    nozzleMesh,
    jetMesh,
    smokePoints: smokeEntry.points,
    sparksPoints: sparksEntry.points,
    count: traps.length,
    get drawCalls() { return getDrawCalls(); },
    getDrawCalls,
    update,
    getActiveFlameBoxes: () => activeBoxes,
    getActiveTrapLightSources: () => activeLights,
    getTrapStates: () => trapStates,
    isPointInFlame,
    setLowSpec,
    setIntensity,
    dispose
  };
}

// ============================================================================
// 8 & 9. 3X VOLUMETRIC BOSS FIRE FIELD (`circle`) & FIRE ROAD (`ash_fissure`)
//        - Ref-counted shared GPU geometries across pooled world.js entries
//        - Domain-warped Voronoi molten magma fissure beds (NormalBlending,
//          ragged volcanic edges — ZERO flat cartoon circles or rectangles!)
//        - Multi-tier 3D rising flame crowns & undulating 3D fissure curtains
//          with travelling wave-crest surge (`uWaveFront01`), Fresnel soft edges,
//          Planckian blackbody HDR color ramp & GPU rising sparks/ember curl!
// ============================================================================
const GLSL_VORONOI_MAGMA = /* glsl */ `
vec2 magmaHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Returns vec2(crackMask, cellCenterGlow) with strict single-exit return (0 X4000 warnings!)
vec2 magmaVoronoiCracks(vec2 x, float detail) {
  vec2 outRes = vec2(0.0);
#ifdef FIRE_MOBILE_FAST
  float r1 = 1.0 - abs(snoise2(x * 0.62));
  float r2 = 1.0 - abs(snoise2(x * 1.31 + vec2(3.7, -2.1)));
  float crMobile = pow(max(r1, 0.0001), 3.2) * 0.72 + pow(max(r2, 0.0001), 4.0) * 0.48;
  outRes = vec2(clamp(crMobile, 0.0, 1.0), r1 * 0.5);
#else
  if (detail > 0.5) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float md1 = 8.0;
    float md2 = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = magmaHash22(n + g);
        vec2 r = g + (0.14 + 0.72 * o) - f;
        float d = length(r);
        if (d < md1) {
          md2 = md1;
          md1 = d;
        } else if (d < md2) {
          md2 = d;
        }
      }
    }
    float edge = md2 - md1;
    float primaryCrack = smoothstep(0.16, 0.008, edge);
    float fineVein = pow(max(1.0 - abs(snoise2(x * 1.45 + vec2(2.3, -4.1))), 0.0001), 4.2);
    float centerHeat = clamp(1.0 - md1 * 1.25, 0.0, 1.0);
    outRes = vec2(clamp(primaryCrack * 0.88 + fineVein * 0.42, 0.0, 1.0), centerHeat);
  } else {
    float r1 = 1.0 - abs(snoise2(x * 0.62));
    float r2 = 1.0 - abs(snoise2(x * 1.31 + vec2(3.7, -2.1)));
    float crLow = pow(max(r1, 0.0001), 3.2) * 0.72 + pow(max(r2, 0.0001), 4.0) * 0.48;
    outRes = vec2(clamp(crLow, 0.0, 1.0), r1 * 0.5);
  }
#endif
  return outRes;
}
`;

const _sharedFloorFireCache = {
  desktop: null,
  mobile: null
};

function buildFireFieldCrownGeometry(isMobile) {
  const parts = [];
  const outerCount = isMobile ? 7 : 10;
  const midCount = isMobile ? 4 : 6;
  const segX = isMobile ? 3 : 5;
  const segY = isMobile ? 7 : 11;

  // Tier 1: Outer perimeter ring of cupped, tangentially-curled 3D flame tongues (0.78m..1.34m)
  for (let i = 0; i < outerCount; i++) {
    const ang = (i / outerCount) * Math.PI * 2.0 + 0.19;
    const tall = i % 2 === 0;
    const mid = i % 3 === 1;
    const h = tall ? 1.32 : (mid ? 1.06 : 0.84);
    const w = tall ? 0.62 : 0.52;
    const rOff = tall ? 0.78 : 0.84;
    parts.push(createCurvedFlameRibbon({
      width: w,
      height: h,
      segX,
      segY,
      cupDepth: -0.13,
      twist: (i % 2 === 0 ? 0.42 : -0.38),
      leanOut: 0.09,
      inwardTip: 0.24,
      radialOffset: rOff,
      yOffset: -0.01,
      angle: ang + (i % 2 === 0 ? 0.22 : -0.22),
      phaseOffset: i * 1.47,
      heatBias: tall ? 0.06 : -0.02,
      layerRole: 0.0,
      swayScale: 1.12
    }));
  }

  // Tier 2: Mid-radius swirling 3D flame tongues filling the interior from Souls 3/4 overhead camera (0.72m..1.16m)
  for (let i = 0; i < midCount; i++) {
    const ang = (i / midCount) * Math.PI * 2.0 + 0.61;
    const tall = i % 2 === 0;
    parts.push(createCurvedFlameRibbon({
      width: tall ? 0.58 : 0.48,
      height: tall ? 1.16 : 0.78,
      segX: isMobile ? 2 : 4,
      segY: isMobile ? 6 : 9,
      cupDepth: 0.11,
      twist: tall ? -0.36 : 0.34,
      leanOut: 0.06,
      inwardTip: 0.15,
      radialOffset: tall ? 0.42 : 0.50,
      yOffset: 0.0,
      angle: ang,
      phaseOffset: 2.1 + i * 1.83,
      heatBias: 0.10,
      layerRole: 0.0,
      swayScale: 1.0
    }));
  }

  // Tier 3: Central roaring impact spire + compact incandescent white-gold heart (`layerRole = 1.0`)
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI + 0.28;
    parts.push(createCurvedFlameRibbon({
      width: 0.64,
      height: (i === 1 ? 1.28 : 0.98),
      segX: isMobile ? 2 : 4,
      segY: isMobile ? 6 : 9,
      cupDepth: 0.10,
      twist: i % 2 === 0 ? 0.32 : -0.30,
      leanOut: 0.04,
      inwardTip: 0.06,
      radialOffset: 0.0,
      yOffset: 0.0,
      angle: ang,
      phaseOffset: 0.85 + i * 2.09,
      heatBias: 0.16,
      layerRole: 0.0,
      swayScale: 0.92
    }));
  }

  for (let i = 0; i < 2; i++) {
    parts.push(createCurvedFlameRibbon({
      width: 0.46,
      height: 0.68,
      segX: 2,
      segY: isMobile ? 4 : 6,
      cupDepth: 0.07,
      twist: i === 0 ? 0.22 : -0.22,
      leanOut: 0.02,
      inwardTip: 0.02,
      radialOffset: 0.0,
      yOffset: 0.02,
      angle: i * Math.PI * 0.5 + 0.42,
      phaseOffset: 0.4 + i * 1.71,
      heatBias: 0.32,
      layerRole: 1.0,
      swayScale: 0.68
    }));
  }

  return mergeFlameParts(parts);
}

function buildFireFieldSparksGeometry(isMobile) {
  const count = isMobile ? 24 : 48;
  const rng = makeRng(0x51a9d307);
  const pos = new Float32Array(count * 3);
  const param = new Float32Array(count * 4); // speed, phase, maxRise, size (negative = dark-amber ember)
  const swirl = new Float32Array(count * 3); // radialDrift, swirlFreq, radiusNorm

  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2.0;
    const r = rng() < 0.64 ? (0.64 + rng() * 0.28) : Math.sqrt(rng()) * 0.68;
    pos[i * 3] = Math.cos(ang) * r;
    pos[i * 3 + 1] = 0.04 + rng() * 0.08;
    pos[i * 3 + 2] = Math.sin(ang) * r;

    const isCinder = i % 2 === 1;
    param[i * 4] = isCinder ? (0.85 + rng() * 0.75) : (1.35 + rng() * 1.10);
    param[i * 4 + 1] = rng();
    param[i * 4 + 2] = isCinder ? (0.75 + rng() * 0.70) : (1.05 + rng() * 0.85);
    const sz = isCinder ? (0.095 + rng() * 0.065) : (0.060 + rng() * 0.050);
    param[i * 4 + 3] = isCinder ? -sz : sz;

    swirl[i * 3] = (rng() - 0.5) * 0.34;
    swirl[i * 3 + 1] = (rng() < 0.5 ? -1 : 1) * (2.6 + rng() * 3.2);
    swirl[i * 3 + 2] = r;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSparkParam', new THREE.BufferAttribute(param, 4));
  geo.setAttribute('aSparkSwirl', new THREE.BufferAttribute(swirl, 3));
  return geo;
}

function createUndulatingRoadFlameCurtain({
  xBase = 0.0,
  zStart = -0.96,
  zEnd = 0.96,
  heightMin = 1.25,
  heightMax = 1.85,
  weaveAmp = 0.14,
  weaveFreq = 4.2,
  weavePhase = 0.0,
  leanX = 0.0,
  cupSide = 0.08,
  segU = 22,
  segV = 9,
  phaseOffset = 0.0,
  heatBias = 0.0,
  layerRole = 0.0,
  swayScale = 1.0
} = {}) {
  const len = zEnd - zStart;
  const plane = new THREE.PlaneGeometry(len, 1.0, segU, segV);
  const pos = plane.attributes.position;
  const uv = plane.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i); // 0..1 along road (-Z -> +Z)
    const v = uv.getY(i); // 0..1 vertical base -> flame crest
    const z = zStart + u * len;

    // Taper smoothly at both ends of the fissure segment while peaking in a jagged volcanic profile
    const endEnv = Math.sin(Math.min(1.0, Math.max(0.0, u)) * Math.PI);
    const crownProfile = 0.66 + 0.34 * endEnv;
    const ridgeMod = 0.5 + 0.5 * Math.sin(u * Math.PI * 5.0 + weavePhase * 1.7);
    const localH = (heightMin + (heightMax - heightMin) * ridgeMod) * crownProfile;

    const sWeave = Math.sin(z * weaveFreq + weavePhase) * weaveAmp * (0.45 + 0.55 * v);
    const cup = cupSide * Math.sin(v * Math.PI) * (1.0 - Math.abs(u - 0.5) * 0.5);
    const x = xBase + sWeave + cup + leanX * v * v;
    const y = v * localH;

    pos.setXYZ(i, x, y, z);
  }

  plane.computeVertexNormals();
  return normalizeForMerge(plane, phaseOffset, heatBias, layerRole, swayScale);
}

function buildFireRoadWallGeometry(isMobile) {
  const parts = [];
  const segU = isMobile ? 13 : 22;
  const segV = isMobile ? 6 : 10;

  // 1. Central tall undulating volcanic flame curtain (1.38m..1.88m)
  parts.push(createUndulatingRoadFlameCurtain({
    xBase: 0.0,
    zStart: -0.96,
    zEnd: 0.96,
    heightMin: 1.38,
    heightMax: 1.88,
    weaveAmp: 0.14,
    weaveFreq: 4.4,
    weavePhase: 0.25,
    leanX: 0.0,
    cupSide: 0.07,
    segU,
    segV,
    phaseOffset: 0.0,
    heatBias: 0.12,
    layerRole: 0.0,
    swayScale: 1.0
  }));

  // 2 & 3. Twin flanking undulating 3D flame walls (1.12m..1.56m) framing the molten trench
  parts.push(createUndulatingRoadFlameCurtain({
    xBase: -0.32,
    zStart: -0.92,
    zEnd: 0.94,
    heightMin: 1.12,
    heightMax: 1.56,
    weaveAmp: 0.11,
    weaveFreq: 5.1,
    weavePhase: 1.9,
    leanX: -0.10,
    cupSide: 0.09,
    segU: isMobile ? 10 : 18,
    segV: isMobile ? 5 : 8,
    phaseOffset: 1.85,
    heatBias: 0.02,
    layerRole: 0.0,
    swayScale: 1.12
  }));

  parts.push(createUndulatingRoadFlameCurtain({
    xBase: 0.32,
    zStart: -0.92,
    zEnd: 0.94,
    heightMin: 1.12,
    heightMax: 1.56,
    weaveAmp: 0.11,
    weaveFreq: 5.1,
    weavePhase: 4.1,
    leanX: 0.10,
    cupSide: -0.09,
    segU: isMobile ? 10 : 18,
    segV: isMobile ? 5 : 8,
    phaseOffset: 3.45,
    heatBias: 0.02,
    layerRole: 0.0,
    swayScale: 1.12
  }));

  // 4. Scorching white-gold lower magma core spine (`layerRole = 1.0`)
  parts.push(createUndulatingRoadFlameCurtain({
    xBase: 0.0,
    zStart: -0.90,
    zEnd: 0.92,
    heightMin: 0.72,
    heightMax: 1.04,
    weaveAmp: 0.07,
    weaveFreq: 4.6,
    weavePhase: 0.9,
    leanX: 0.0,
    cupSide: -0.04,
    segU: isMobile ? 8 : 14,
    segV: 4,
    phaseOffset: 0.65,
    heatBias: 0.30,
    layerRole: 1.0,
    swayScale: 0.68
  }));

  // 5. Transverse cupped 3D eruption tongues along the trench (eliminates down-axis plane flatness!)
  const tongueCount = isMobile ? 5 : 9;
  for (let i = 0; i < tongueCount; i++) {
    const frac = tongueCount > 1 ? i / (tongueCount - 1) : 0.5;
    const zPos = -0.84 + frac * 1.68;
    const side = (i % 3) - 1;
    const tall = i % 2 === 0;
    const rib = createCurvedFlameRibbon({
      width: tall ? 0.68 : 0.56,
      height: tall ? 1.78 : 1.36,
      segX: isMobile ? 2 : 4,
      segY: isMobile ? 6 : 9,
      cupDepth: 0.12,
      twist: i % 2 === 0 ? 0.36 : -0.34,
      leanOut: 0.10,
      inwardTip: 0.14,
      radialOffset: 0.0,
      yOffset: 0.0,
      angle: (i % 2 === 0 ? 1.12 : -1.12) + side * 0.25,
      phaseOffset: 1.1 + i * 1.37,
      heatBias: tall ? 0.14 : 0.04,
      layerRole: 0.0,
      swayScale: 1.08
    });
    rib.translate(side * 0.16, 0.0, zPos);
    parts.push(rib);
  }

  return mergeFlameParts(parts);
}

function buildFireRoadSparksGeometry(isMobile) {
  const count = isMobile ? 28 : 56;
  const rng = makeRng(0x94c27e3b);
  const pos = new Float32Array(count * 3);
  const param = new Float32Array(count * 4); // speed, phase, maxRise, size (negative = dark-amber ember)
  const roadMeta = new Float32Array(count * 3); // along01, latDrift, swirlFreq

  for (let i = 0; i < count; i++) {
    const along01 = (i + rng() * 0.85) / count;
    const z = -0.94 + along01 * 1.88;
    const x = (rng() - 0.5) * 0.78;
    pos[i * 3] = x;
    pos[i * 3 + 1] = 0.05 + rng() * 0.10;
    pos[i * 3 + 2] = z;

    const isCinder = i % 2 === 1;
    param[i * 4] = isCinder ? (0.90 + rng() * 0.80) : (1.45 + rng() * 1.15);
    param[i * 4 + 1] = rng();
    param[i * 4 + 2] = isCinder ? (0.95 + rng() * 0.80) : (1.25 + rng() * 1.05);
    const sz = isCinder ? (0.100 + rng() * 0.065) : (0.064 + rng() * 0.052);
    param[i * 4 + 3] = isCinder ? -sz : sz;

    roadMeta[i * 3] = along01;
    roadMeta[i * 3 + 1] = (rng() - 0.5) * 0.42;
    roadMeta[i * 3 + 2] = (rng() < 0.5 ? -1 : 1) * (2.8 + rng() * 3.4);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSparkParam', new THREE.BufferAttribute(param, 4));
  geo.setAttribute('aRoadMeta', new THREE.BufferAttribute(roadMeta, 3));
  return geo;
}

function acquireSharedFloorFireGeos(isMobile) {
  const key = isMobile ? 'mobile' : 'desktop';
  let bucket = _sharedFloorFireCache[key];
  if (!bucket) {
    const fieldBedGeo = new THREE.PlaneGeometry(2.16, 2.16, 1, 1);
    fieldBedGeo.rotateX(-Math.PI * 0.5);

    const roadBedGeo = new THREE.PlaneGeometry(2.16, 2.24, 1, 1);
    roadBedGeo.rotateX(-Math.PI * 0.5);

    bucket = {
      refCount: 0,
      fieldBedGeo,
      fieldCrownGeo: buildFireFieldCrownGeometry(isMobile),
      fieldSparksGeo: buildFireFieldSparksGeometry(isMobile),
      roadBedGeo,
      roadWallGeo: buildFireRoadWallGeometry(isMobile),
      roadSparksGeo: buildFireRoadSparksGeometry(isMobile)
    };
    _sharedFloorFireCache[key] = bucket;
  }
  bucket.refCount += 1;
  return bucket;
}

function releaseSharedFloorFireGeos(isMobile) {
  const key = isMobile ? 'mobile' : 'desktop';
  const bucket = _sharedFloorFireCache[key];
  if (!bucket) return;
  bucket.refCount = Math.max(0, bucket.refCount - 1);
  if (bucket.refCount === 0) {
    bucket.fieldBedGeo.dispose();
    bucket.fieldCrownGeo.dispose();
    bucket.fieldSparksGeo.dispose();
    bucket.roadBedGeo.dispose();
    bucket.roadWallGeo.dispose();
    bucket.roadSparksGeo.dispose();
    _sharedFloorFireCache[key] = null;
  }
}

/**
 * Section 5.0 — 3x Volumetric Boss Fire Field (`circle`, `duration = 1.0s` friendly):
 *   1) Domain-warped Voronoi molten magma fissure bed (`bedMesh`, ragged scorch border, 0 flat circle!)
 *   2) Multi-ring 3D crown of rising flame tongues (`crownMesh`, `0.65m..1.35m`, FBM curl + Fresnel soft edges!)
 *   3) GPU rising forge sparks & dark-amber curling embers (`sparksPoints`)
 */
export function createVolumetricFireFieldMesh(opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  const shared = acquireSharedFloorFireGeos(isMobile);

  const group = new THREE.Group();
  group.name = 'volumetric_boss_fire_field';

  const seedInit = Number.isFinite(opts.seed) ? opts.seed : 0.0;

  // 1. Domain-warped Voronoi magma-fissure ground bed
  const bedUniforms = {
    uTime: { value: 0.0 },
    uErupt01: { value: 1.0 },
    uBurnDown01: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSeed: { value: seedInit }
  };

  const bedMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: bedUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vBedPos;
      void main() {
        vBedPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uErupt01;
      uniform float uBurnDown01;
      uniform float uIntensity;
      uniform float uDetail;
      uniform float uSeed;

      varying vec3 vBedPos;

      ${GLSL_SIMPLEX_NOISE}
      ${GLSL_VORONOI_MAGMA}

      void main() {
        if (uIntensity < 0.01) discard;
        vec2 p = vBedPos.xz;
        float r = length(p);
        if (r > 1.08) discard;

        // Organic domain-warped ragged perimeter (ZERO geometric cartoon circle!)
        vec2 warp = fireDomainWarp(p * 2.35 + vec2(uSeed, -uTime * 0.85), uDetail);
        float rimNoise = snoise2(p * 3.8 + warp * 0.55 + vec2(uSeed * 1.7, uTime * 0.6));
        float rWarped = r + rimNoise * 0.14 + (warp.x - warp.y) * 0.06;

        float expandR = mix(0.28, 1.0, uErupt01);
        if (rWarped > expandR + 0.04) discard;

        float outerMask = 1.0 - smoothstep(expandR - 0.24, expandR + 0.02, rWarped);
        if (outerMask < 0.01) discard;

        // Voronoi cellular magma cracks + convective boiling fissures
        vec2 cellCoord = p * 4.4 + warp * 0.68 + vec2(uSeed * 2.1, -uTime * 0.35);
        vec2 vor = magmaVoronoiCracks(cellCoord, uDetail);
        float crack = vor.x;
        float boil = snoise2(p * 5.6 - vec2(0.0, uTime * 2.8) + warp * 0.9) * 0.5 + 0.5;

        // Ring hot-band under the outer 3D flame curtain + central impact furnace
        float perimeterHot = exp(-pow((r - 0.78) * 4.6, 2.0)) * 0.65;
        float centerHot = smoothstep(0.72, 0.04, r) * 0.55;
        float liveHeat = (1.0 - uBurnDown01 * 0.86) * uErupt01;

        float magmaHeat = clamp(
          (crack * (0.68 + 0.52 * boil) + perimeterHot * (0.45 + 0.55 * boil) + centerHot * crack * 0.65) * liveHeat,
          0.0,
          1.25
        );

        // Dark charred volcanic basalt crust between glowing magma fissures
        vec3 crustCol = mix(vec3(0.05, 0.028, 0.024), vec3(0.14, 0.045, 0.018), vor.y);
        vec3 colDeep  = vec3(0.66, 0.06, 0.01);
        vec3 colMid   = vec3(0.98, 0.34, 0.03);
        vec3 colGold  = vec3(1.00, 0.80, 0.26);
        vec3 colCore  = vec3(1.00, 0.96, 0.78);

        vec3 magmaCol = mix(colDeep, colMid, smoothstep(0.08, 0.42, magmaHeat));
        magmaCol = mix(magmaCol, colGold, smoothstep(0.40, 0.78, magmaHeat));
        magmaCol = mix(magmaCol, colCore, smoothstep(0.76, 1.05, magmaHeat));

        float glowBlend = smoothstep(0.06, 0.38, magmaHeat);
        vec3 finalCol = mix(crustCol, magmaCol, glowBlend);

        // Crust grounds the fire bed physically, dissolving cleanly as it burns down
        float crustAlpha = outerMask * (0.56 * (1.0 - uBurnDown01 * 0.92));
        float crackAlpha = outerMask * smoothstep(0.05, 0.32, magmaHeat) * 0.94 * (1.0 - uBurnDown01 * 0.65);
        float alpha = max(crustAlpha, crackAlpha) * clamp(uIntensity, 0.0, 1.25);
        if (alpha < 0.012) discard;

        gl_FragColor = vec4(min(finalCol, vec3(1.15)), clamp(alpha, 0.0, 0.94));
      }
    `
  });

  const bedMesh = new THREE.Mesh(shared.fieldBedGeo, bedMat);
  bedMesh.name = 'fire_field_magma_bed';
  bedMesh.position.y = 0.032;
  bedMesh.renderOrder = 4;
  bedMesh.frustumCulled = false;
  group.add(bedMesh);

  // 2. 3D Crown of Rising Flame Tongues (0.65m..1.35m)
  const crownUniforms = {
    uTime: { value: 0.0 },
    uErupt01: { value: 1.0 },
    uBurnDown01: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSeed: { value: seedInit }
  };

  const crownMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: crownUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aFlameMeta;

      uniform float uTime;
      uniform float uErupt01;
      uniform float uBurnDown01;
      uniform float uSeed;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;

      void main() {
        vUv = uv;
        vMeta = aFlameMeta;

        float h = clamp(uv.y, 0.0, 1.0);
        float ph = aFlameMeta.x + uSeed * 1.37;
        float swayScale = aFlameMeta.w;
        float bend = pow(max(h, 0.0001), 1.35) * swayScale;

        vec3 p = position;
        vec3 n = normal;

        // Fast volcanic geyser eruption (0..0.15) -> fierce roaring blaze -> organic burn-down collapse (0.65..1.0)
        float eruptOvershoot = mix(0.16, 1.08, uErupt01) - 0.08 * smoothstep(0.75, 1.0, uErupt01);
        float burnCollapse = mix(1.0, 0.24, uBurnDown01 * uBurnDown01);
        float t = uTime * 5.2 + ph;
        float breath = 0.94 + 0.10 * sin(t * 1.45 + ph) + 0.05 * cos(t * 2.9 - ph * 0.7);
        p.y *= eruptOvershoot * burnCollapse * mix(1.0, breath, h * 0.85);

        // Helical thermal curl around center + turbulent FBM-like tongue whip
        float twist = sin(t * 0.95 - h * 3.6) * 0.30 * bend;
        float ct = cos(twist);
        float st = sin(twist);
        p.xz = mat2(ct, -st, st, ct) * p.xz;
        n.xz = mat2(ct, -st, st, ct) * n.xz;

        p.x += (sin(t * 1.35 - h * 4.8 + ph) * 0.65 + cos(t * 2.45 - h * 7.2) * 0.35) * 0.11 * bend;
        p.z += (cos(t * 1.25 - h * 4.5 - ph) * 0.65 + sin(t * 2.30 - h * 6.8) * 0.35) * 0.11 * bend;

        vLocalPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uErupt01;
      uniform float uBurnDown01;
      uniform float uIntensity;
      uniform float uDetail;
      uniform float uSeed;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        if (uIntensity < 0.01) discard;
        float h = clamp(vUv.y, 0.0, 1.0);
        float across = clamp(vUv.x, 0.0, 1.0);
        float ac = (across - 0.5) * 2.0;
        float ph = vMeta.x + uSeed;
        bool isCore = vMeta.z > 0.5;

        // Soft Fresnel grazing-angle fade + lateral ribbon feather -> 0 polygon edges!
        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        float viewFade = mix(1.0, smoothstep(0.05, 0.50, ndv), 0.60);
        float sideFade = smoothstep(0.0, 0.22, across) * smoothstep(1.0, 0.78, across);

        float t = uTime * 4.6 + ph * 0.73;
        vec2 warp = fireDomainWarp(vec2(ac * 1.8 + ph * 0.4, h * 2.9 - t * 1.15), uDetail);
        float warpAmt = 0.20 + 0.55 * h;

        vec3 p3 = vec3(
          vLocalPos.x * 2.2 + warp.x * warpAmt,
          vLocalPos.y * 2.4 - t * 1.65,
          vLocalPos.z * 2.2 + warp.y * warpAmt
        );
        vec2 p2 = vec2(
          ac * 2.9 + warp.x * warpAmt * 1.2 + ph * 0.6,
          h * 3.6 - t * 2.15 + warp.y * warpAmt * 0.6
        );
        vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
        float fbm = turb.x;
        float streaks = turb.y;

        float halfW = mix(0.48, 0.20, pow(max(h, 0.0001), 0.92));
        float distX = abs(ac * 0.5 - warp.x * 0.09 * h);
        float shape = clamp(1.0 - pow(max(distX / max(halfW, 0.08), 0.0001), 1.85), 0.0, 1.0);

        float baseIn = smoothstep(0.0, 0.08, h);
        float tipOut = smoothstep(1.0, 0.12, h);
        float lick = smoothstep(0.52, 0.86, fbm) * smoothstep(0.28, 0.68, h) * smoothstep(0.98, 0.72, h) * 0.45;
        float burnErode = uBurnDown01 * (0.45 + 0.65 * h);

        float field = (shape * (0.68 + 0.40 * tipOut) + (fbm - 0.44) * mix(0.36, 1.15, pow(max(h, 0.0001), 0.65)) + lick - pow(max(h, 0.0001), 1.12) * 0.56 - burnErode) * baseIn;

        float flameEdge = isCore ? smoothstep(0.20, 0.58, field) : smoothstep(0.07, 0.36, field);
        float smokeTip = isCore ? 0.0 : smoothstep(0.54, 0.95, h) * smoothstep(0.01, 0.16, field) * (1.0 - flameEdge * 0.82);
        float liveFade = smoothstep(0.0, 0.12, uErupt01) * (1.0 - smoothstep(0.72, 1.0, uBurnDown01));
        float alpha = clamp(flameEdge * 0.92 + smokeTip * 0.28, 0.0, 0.94)
          * viewFade
          * sideFade
          * liveFade
          * clamp(uIntensity, 0.0, 1.35);
        if (alpha < 0.015) discard;

        float spineHot = (1.0 - smoothstep(0.0, 0.85, abs(ac))) * smoothstep(0.68, 0.02, h);
        float temp = clamp(
          smoothstep(0.06, 0.86, field) * 0.50
          + spineHot * 0.34
          + (streaks - 0.46) * 0.30
          + vMeta.y * 0.55
          + (isCore ? 0.20 : 0.0)
          - smoothstep(0.30, 0.94, h) * 0.46
          - uBurnDown01 * 0.22,
          0.0,
          1.0
        );

        vec3 colRim   = vec3(0.54, 0.04, 0.01);
        vec3 colOuter = vec3(0.88, 0.16, 0.02);
        vec3 colMid   = vec3(1.00, 0.48, 0.05);
        vec3 colGold  = vec3(1.00, 0.82, 0.28);
        vec3 colCore  = vec3(1.00, 0.97, 0.84);

        vec3 col = mix(colRim, colOuter, smoothstep(0.00, 0.24, temp));
        col = mix(col, colMid,  smoothstep(0.22, 0.54, temp));
        col = mix(col, colGold, smoothstep(0.52, 0.82, temp));
        col = mix(col, colCore, smoothstep(0.80, 0.98, temp));
        col = mix(col, vec3(0.14, 0.03, 0.02), clamp(smokeTip * 0.72, 0.0, 0.85));

        float boost = 0.96 + 0.14 * (1.0 - uBurnDown01);
        gl_FragColor = vec4(min(col * boost, vec3(1.16)), clamp(alpha, 0.0, 0.92));
      }
    `
  });

  const crownMesh = new THREE.Mesh(shared.fieldCrownGeo, crownMat);
  crownMesh.name = 'fire_field_flame_crown';
  crownMesh.position.y = 0.018;
  crownMesh.renderOrder = 6;
  crownMesh.frustumCulled = false;
  group.add(crownMesh);

  // 3. GPU Billboarding Rising Sparks & Dark-Amber Ember Curl
  const sparkUniforms = {
    uTime: { value: 0.0 },
    uErupt01: { value: 1.0 },
    uBurnDown01: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) },
    uSeed: { value: seedInit }
  };

  const sparksMat = new THREE.ShaderMaterial({
    uniforms: sparkUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSparkParam;
      attribute vec3 aSparkSwirl;

      uniform float uTime;
      uniform float uErupt01;
      uniform float uBurnDown01;
      uniform float uIntensity;
      uniform float uPixelRatio;
      uniform float uSeed;

      varying float vLife;
      varying float vIsCinder;
      varying float vAlpha;

      void main() {
        float life = fract(uTime * aSparkParam.x + aSparkParam.y + uSeed * 0.17);
        vLife = life;
        vIsCinder = aSparkParam.w < 0.0 ? 1.0 : 0.0;

        float swirlAng = life * aSparkSwirl.y + aSparkParam.y * 6.28318 + uSeed;
        float curlR = (0.06 + 0.18 * life) * (0.65 + 0.35 * vIsCinder);
        vec3 p = position;
        p.x += cos(swirlAng) * curlR + aSparkSwirl.x * life;
        p.z += sin(swirlAng) * curlR - aSparkSwirl.x * 0.7 * life;
        p.y += life * aSparkParam.z * mix(0.35, 1.05, uErupt01);

        float env = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.28, life);
        float live = smoothstep(0.0, 0.08, uErupt01) * (1.0 - smoothstep(0.76, 1.0, uBurnDown01));
        vAlpha = env * live * clamp(uIntensity, 0.0, 1.35);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float sz = abs(aSparkParam.w) * (0.55 + 0.65 * env) * step(0.01, vAlpha);
        gl_PointSize = clamp((sz * 310.0 * uPixelRatio) / max(1.0, -mv.z), 0.0, 18.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      varying float vIsCinder;
      varying float vAlpha;

      void main() {
        if (vAlpha < 0.015) discard;
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.48, 0.05, d);
        if (soft < 0.02) discard;

        vec3 sparkHot  = mix(vec3(1.00, 0.96, 0.74), vec3(1.00, 0.62, 0.14), vIsCinder);
        vec3 sparkCool = mix(vec3(1.00, 0.36, 0.04), vec3(0.76, 0.10, 0.02), vIsCinder);
        vec3 col = mix(sparkHot, sparkCool, smoothstep(0.08, 0.92, vLife));
        float a = soft * vAlpha * mix(0.95, 0.78, vIsCinder);
        if (a < 0.012) discard;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const sparksPoints = new THREE.Points(shared.fieldSparksGeo, sparksMat);
  sparksPoints.name = 'fire_field_sparks';
  sparksPoints.renderOrder = 7;
  sparksPoints.frustumCulled = false;
  sparksPoints.visible = !lowSpec;
  group.add(sparksPoints);

  let disposed = false;

  function reset({ radius, heightScale = 1.0, seed } = {}) {
    if (disposed) return;
    if (Number.isFinite(seed)) {
      bedUniforms.uSeed.value = seed;
      crownUniforms.uSeed.value = seed;
      sparkUniforms.uSeed.value = seed;
    }
    if (Number.isFinite(radius) && radius > 0) {
      group.scale.set(radius, Number.isFinite(heightScale) ? heightScale : 1.0, radius);
    }
    bedUniforms.uTime.value = 0.0;
    crownUniforms.uTime.value = 0.0;
    sparkUniforms.uTime.value = 0.0;
    bedUniforms.uErupt01.value = 0.08;
    crownUniforms.uErupt01.value = 0.08;
    sparkUniforms.uErupt01.value = 0.08;
    bedUniforms.uBurnDown01.value = 0.0;
    crownUniforms.uBurnDown01.value = 0.0;
    sparkUniforms.uBurnDown01.value = 0.0;
  }

  function update(entryOrElapsed, elapsed, life01, intensity = 1.0) {
    if (disposed) return;
    let tVal = 0.0;
    let l01 = 0.25;
    let intVal = 1.0;

    if (entryOrElapsed && typeof entryOrElapsed === 'object') {
      const entry = entryOrElapsed;
      if (Number.isFinite(entry.seed)) {
        bedUniforms.uSeed.value = entry.seed;
        crownUniforms.uSeed.value = entry.seed;
        sparkUniforms.uSeed.value = entry.seed;
      }
      tVal = Number.isFinite(elapsed)
        ? elapsed
        : (Number.isFinite(entry.elapsed) ? entry.elapsed : (Number.isFinite(entry.age) ? entry.age : 0.0));
      if (Number.isFinite(life01)) {
        l01 = life01;
      } else if (Number.isFinite(entry.life01)) {
        l01 = entry.life01;
      } else if (Number.isFinite(entry.age) && Number.isFinite(entry.duration) && entry.duration > 0) {
        l01 = entry.age / entry.duration;
      }
      intVal = Number.isFinite(intensity) ? intensity : (Number.isFinite(entry.intensity) ? entry.intensity : 1.0);
    } else {
      tVal = Number.isFinite(entryOrElapsed) ? entryOrElapsed : 0.0;
      l01 = Number.isFinite(life01) ? life01 : 0.25;
      intVal = Number.isFinite(intensity) ? intensity : 1.0;
    }

    const clampedLife = Math.max(0.0, Math.min(1.0, l01));
    // 0.00..0.15: fast volcanic eruption; 0.15..0.65: fierce blaze; 0.65..1.00: organic burn-down!
    const erupt01 = smoothstep01(0.0, 0.15, clampedLife);
    const burnDown01 = smoothstep01(0.65, 1.0, clampedLife);
    const effInt = Math.max(0.0, intVal) * (lowSpec ? 0.85 : 1.0);

    bedUniforms.uTime.value = tVal;
    bedUniforms.uErupt01.value = Math.max(0.05, erupt01);
    bedUniforms.uBurnDown01.value = burnDown01;
    bedUniforms.uIntensity.value = effInt;

    crownUniforms.uTime.value = tVal;
    crownUniforms.uErupt01.value = Math.max(0.05, erupt01);
    crownUniforms.uBurnDown01.value = burnDown01;
    crownUniforms.uIntensity.value = effInt;

    if (sparksPoints.visible) {
      sparkUniforms.uTime.value = tVal;
      sparkUniforms.uErupt01.value = Math.max(0.05, erupt01);
      sparkUniforms.uBurnDown01.value = burnDown01;
      sparkUniforms.uIntensity.value = effInt;
    }
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    const det = (isMobile || lowSpec) ? 0.0 : 1.0;
    bedUniforms.uDetail.value = det;
    crownUniforms.uDetail.value = det;
    sparksPoints.visible = !lowSpec;
    sparkUniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    bedMat.dispose();
    crownMat.dispose();
    sparksMat.dispose();
    releaseSharedFloorFireGeos(isMobile);
  }

  return {
    group,
    bedMesh,
    crownMesh,
    sparksPoints,
    reset,
    update,
    setLowSpec,
    dispose
  };
}

/**
 * Section 5.0 — 3x Volumetric Boss Fire Road / Wave (`ash_fissure`):
 *   1) Domain-warped ragged molten-lava trench bed (`trenchBedMesh`, 0 straight rectangle!)
 *   2) Triple undulating 3D vertical flame-wall ribbons + surging eruption wave crest (`1.15m..1.90m`, `uWaveFront01`!)
 *   3) GPU surging fissure sparks & curling magma embers (`sparksPoints`)
 */
export function createVolumetricFireRoadMesh(opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  const shared = acquireSharedFloorFireGeos(isMobile);

  const group = new THREE.Group();
  group.name = 'volumetric_boss_fire_road';

  const seedInit = Number.isFinite(opts.seed) ? opts.seed : 0.0;

  // 1. Cracked molten-lava trench bed with ragged volcanic edges
  const trenchUniforms = {
    uTime: { value: 0.0 },
    uWaveFront01: { value: 1.0 },
    uBurnDown01: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSeed: { value: seedInit }
  };

  const trenchMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: trenchUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    toneMapped: false,
    vertexShader: /* glsl */ `
      varying vec3 vBedPos;
      void main() {
        vBedPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveFront01;
      uniform float uBurnDown01;
      uniform float uIntensity;
      uniform float uDetail;
      uniform float uSeed;

      varying vec3 vBedPos;

      ${GLSL_SIMPLEX_NOISE}
      ${GLSL_VORONOI_MAGMA}

      void main() {
        if (uIntensity < 0.01) discard;
        float x = vBedPos.x;
        float z = vBedPos.z;
        if (abs(x) > 1.08 || abs(z) > 1.12) discard;

        // along01 = 0 at Boss start (-Z), 1 at fissure tip (+Z)
        float along01 = clamp((z + 1.0) * 0.5, 0.0, 1.0);
        float frontGate = smoothstep(uWaveFront01 + 0.05, uWaveFront01 - 0.09, along01);
        if (frontGate < 0.01) discard;

        // Domain-warped jagged volcanic trench boundaries (NEVER a straight rectangular strip!)
        vec2 warp = fireDomainWarp(vec2(x * 2.6 + uSeed, z * 2.2 - uTime * 1.35), uDetail);
        float jagA = snoise2(vec2(z * 4.2 + uSeed * 1.9, x * 2.1));
        float jagB = snoise2(vec2(z * 8.6 - uSeed * 0.7, x * 3.8 + uTime * 0.5));
        float raggedHalfW = (0.58 + 0.24 * (jagA * 0.65 + jagB * 0.35)) * smoothstep(1.10, 0.78, abs(z + jagA * 0.08));
        float ax = abs(x + warp.x * 0.14);

        float trenchMask = 1.0 - smoothstep(raggedHalfW - 0.22, raggedHalfW + 0.04, ax);
        if (trenchMask < 0.01) discard;

        // Voronoi magma fissures + fast surging lava spine down +Z
        vec2 vor = magmaVoronoiCracks(vec2(x * 4.6 + warp.x * 0.75, z * 3.8 - uTime * 0.95 + warp.y * 0.65), uDetail);
        float crack = vor.x;
        float lavaFlow = snoise2(vec2(x * 5.2 + warp.x, z * 4.4 - uTime * 3.8)) * 0.5 + 0.5;
        float spine = exp(-pow((x + sin(z * 4.2 + uSeed) * 0.12) * 3.2, 2.0));
        float crestFlash = exp(-pow((along01 - uWaveFront01) * 7.5, 2.0)) * smoothstep(0.02, 0.98, uWaveFront01);

        float liveHeat = (1.0 - uBurnDown01 * 0.84) * frontGate;
        float magmaHeat = clamp(
          (crack * (0.62 + 0.52 * lavaFlow) + spine * (0.48 + 0.44 * lavaFlow) + crestFlash * 0.55) * liveHeat,
          0.0,
          1.25
        );

        vec3 crustCol = mix(vec3(0.05, 0.028, 0.024), vec3(0.15, 0.048, 0.020), vor.y);
        vec3 magmaCol = mix(vec3(0.68, 0.06, 0.01), vec3(0.99, 0.36, 0.03), smoothstep(0.08, 0.42, magmaHeat));
        magmaCol = mix(magmaCol, vec3(1.00, 0.82, 0.28), smoothstep(0.40, 0.78, magmaHeat));
        magmaCol = mix(magmaCol, vec3(1.00, 0.97, 0.80), smoothstep(0.76, 1.05, magmaHeat));

        vec3 finalCol = mix(crustCol, magmaCol, smoothstep(0.06, 0.36, magmaHeat));
        float crustAlpha = trenchMask * frontGate * 0.58 * (1.0 - uBurnDown01 * 0.90);
        float lavaAlpha  = trenchMask * frontGate * smoothstep(0.05, 0.30, magmaHeat) * 0.95 * (1.0 - uBurnDown01 * 0.62);
        float alpha = max(crustAlpha, lavaAlpha) * clamp(uIntensity, 0.0, 1.25);
        if (alpha < 0.012) discard;

        gl_FragColor = vec4(min(finalCol, vec3(1.16)), clamp(alpha, 0.0, 0.95));
      }
    `
  });

  const trenchBedMesh = new THREE.Mesh(shared.roadBedGeo, trenchMat);
  trenchBedMesh.name = 'fire_road_trench_bed';
  trenchBedMesh.position.y = 0.034;
  trenchBedMesh.renderOrder = 4;
  trenchBedMesh.frustumCulled = false;
  group.add(trenchBedMesh);

  // 2. Triple undulating 3D vertical flame-wall ribbons + surging eruption crest
  const wallUniforms = {
    uTime: { value: 0.0 },
    uWaveFront01: { value: 1.0 },
    uBurnDown01: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSeed: { value: seedInit }
  };

  const wallMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: wallUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aFlameMeta;

      uniform float uTime;
      uniform float uWaveFront01;
      uniform float uBurnDown01;
      uniform float uSeed;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying float vAlongRoad;
      varying float vCrest;

      void main() {
        vUv = uv;
        vMeta = aFlameMeta;

        float h = clamp(uv.y, 0.0, 1.0);
        float alongRoad = clamp((position.z + 1.0) * 0.5, 0.0, 1.0);
        vAlongRoad = alongRoad;

        float frontGate = smoothstep(uWaveFront01 + 0.06, uWaveFront01 - 0.11, alongRoad);
        float crest = exp(-pow((alongRoad - uWaveFront01) * 5.8, 2.0)) * smoothstep(0.02, 0.99, uWaveFront01);
        vCrest = crest;

        vec3 p = position;
        vec3 n = normal;

        float ph = aFlameMeta.x + uSeed * 1.41 + position.z * 2.1;
        float t = uTime * 5.6 + ph;
        float bend = pow(max(h, 0.0001), 1.32) * aFlameMeta.w;

        // Travelling wave crest surges flames up to ~1.9m high & leans forward along +Z!
        float heightScale = frontGate * (1.0 + 0.34 * crest) * mix(1.0, 0.24, uBurnDown01 * uBurnDown01);
        float breath = 0.94 + 0.10 * sin(t * 1.5 - position.z * 3.4);
        p.y *= heightScale * mix(1.0, breath, h * 0.85);

        p.x += (sin(t * 1.4 - h * 5.0) * 0.68 + cos(t * 2.5 - h * 7.4 + ph) * 0.32) * 0.12 * bend;
        p.z += (0.18 + 0.22 * crest + 0.08 * sin(t * 1.2 - h * 4.2)) * bend * frontGate;

        vLocalPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveFront01;
      uniform float uBurnDown01;
      uniform float uIntensity;
      uniform float uDetail;
      uniform float uSeed;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying float vAlongRoad;
      varying float vCrest;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        if (uIntensity < 0.01) discard;
        float frontGate = smoothstep(uWaveFront01 + 0.05, uWaveFront01 - 0.10, vAlongRoad);
        if (frontGate < 0.015) discard;

        float h = clamp(vUv.y, 0.0, 1.0);
        float across = clamp(vUv.x, 0.0, 1.0);
        float ph = vMeta.x + uSeed;
        bool isCore = vMeta.z > 0.5;

        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        float viewFade = mix(1.0, smoothstep(0.05, 0.48, ndv), 0.58);
        float endFeather = smoothstep(0.0, 0.12, across) * smoothstep(1.0, 0.88, across);

        float t = uTime * 5.0 + ph * 0.65;
        vec2 warp = fireDomainWarp(vec2(vLocalPos.z * 2.4 - t * 0.65 + ph, h * 3.0 - t * 1.35), uDetail);
        float warpAmt = 0.22 + 0.56 * h;

        vec3 p3 = vec3(
          vLocalPos.x * 2.3 + warp.x * warpAmt,
          vLocalPos.y * 2.2 - t * 1.85,
          vLocalPos.z * 2.1 - t * 1.15 + warp.y * warpAmt
        );
        vec2 p2 = vec2(
          vLocalPos.z * 3.4 - t * 1.05 + warp.x * warpAmt * 1.1,
          h * 3.8 - t * 2.35 + warp.y * warpAmt * 0.65
        );
        vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
        float fbm = turb.x;
        float streaks = turb.y;

        float baseIn = smoothstep(0.0, 0.07, h);
        float tipOut = smoothstep(1.0, 0.10, h);
        // Jagged individual vertical flame tongues carved out of the undulating curtain!
        float tongueCarve = sin(vLocalPos.z * 11.5 - t * 0.8 + warp.x * 2.4) * 0.14 * pow(max(h, 0.0001), 0.85);
        float lick = smoothstep(0.50, 0.86, fbm) * smoothstep(0.25, 0.68, h) * smoothstep(0.98, 0.72, h) * 0.48;
        float burnErode = uBurnDown01 * (0.44 + 0.68 * h);

        float field = ((0.64 + 0.44 * tipOut) + tongueCarve + (fbm - 0.44) * mix(0.40, 1.22, pow(max(h, 0.0001), 0.62)) + lick + vCrest * 0.22 - pow(max(h, 0.0001), 1.08) * 0.58 - burnErode) * baseIn;

        float flameEdge = isCore ? smoothstep(0.20, 0.58, field) : smoothstep(0.08, 0.38, field);
        float smokeTip = isCore ? 0.0 : smoothstep(0.54, 0.96, h) * smoothstep(0.01, 0.16, field) * (1.0 - flameEdge * 0.82);
        float alpha = clamp(flameEdge * 0.92 + smokeTip * 0.28, 0.0, 0.94)
          * viewFade
          * endFeather
          * frontGate
          * (1.0 - smoothstep(0.74, 1.0, uBurnDown01))
          * clamp(uIntensity, 0.0, 1.35);
        if (alpha < 0.015) discard;

        float baseHot = smoothstep(0.65, 0.02, h);
        float temp = clamp(
          smoothstep(0.06, 0.86, field) * 0.50
          + baseHot * 0.30
          + vCrest * 0.22
          + (streaks - 0.46) * 0.30
          + vMeta.y * 0.50
          + (isCore ? 0.20 : 0.0)
          - smoothstep(0.32, 0.95, h) * 0.48
          - uBurnDown01 * 0.22,
          0.0,
          1.0
        );

        vec3 col = mix(vec3(0.54, 0.04, 0.01), vec3(0.90, 0.16, 0.02), smoothstep(0.00, 0.24, temp));
        col = mix(col, vec3(1.00, 0.50, 0.05), smoothstep(0.22, 0.54, temp));
        col = mix(col, vec3(1.00, 0.84, 0.30), smoothstep(0.52, 0.82, temp));
        col = mix(col, vec3(1.00, 0.98, 0.86), smoothstep(0.80, 0.98, temp));
        col = mix(col, vec3(0.14, 0.03, 0.02), clamp(smokeTip * 0.72, 0.0, 0.85));

        float boost = 0.96 + 0.18 * vCrest + 0.10 * (1.0 - uBurnDown01);
        gl_FragColor = vec4(min(col * boost, vec3(1.18)), clamp(alpha, 0.0, 0.93));
      }
    `
  });

  const flameWallMesh = new THREE.Mesh(shared.roadWallGeo, wallMat);
  flameWallMesh.name = 'fire_road_flame_walls';
  flameWallMesh.position.y = 0.018;
  flameWallMesh.renderOrder = 6;
  flameWallMesh.frustumCulled = false;
  group.add(flameWallMesh);

  // 3. GPU Fissure Wave Sparks & Curling Embers
  const sparkUniforms = {
    uTime: { value: 0.0 },
    uWaveFront01: { value: 1.0 },
    uBurnDown01: { value: 0.0 },
    uIntensity: { value: 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) },
    uSeed: { value: seedInit }
  };

  const sparksMat = new THREE.ShaderMaterial({
    uniforms: sparkUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSparkParam;
      attribute vec3 aRoadMeta;

      uniform float uTime;
      uniform float uWaveFront01;
      uniform float uBurnDown01;
      uniform float uIntensity;
      uniform float uPixelRatio;
      uniform float uSeed;

      varying float vLife;
      varying float vIsCinder;
      varying float vAlpha;

      void main() {
        float alongRoad = aRoadMeta.x;
        float frontGate = smoothstep(uWaveFront01 + 0.04, uWaveFront01 - 0.08, alongRoad);
        float crest = exp(-pow((alongRoad - uWaveFront01) * 6.0, 2.0));

        float life = fract(uTime * aSparkParam.x + aSparkParam.y + uSeed * 0.19);
        vLife = life;
        vIsCinder = aSparkParam.w < 0.0 ? 1.0 : 0.0;

        float swirlAng = life * aRoadMeta.z + aSparkParam.y * 6.28318 + uSeed;
        vec3 p = position;
        p.x += cos(swirlAng) * (0.08 + 0.18 * life) + aRoadMeta.y * life;
        p.z += sin(swirlAng) * 0.08 + life * (0.28 + 0.35 * crest);
        p.y += life * aSparkParam.z * (1.0 + 0.45 * crest);

        float env = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.26, life);
        float live = frontGate * (1.0 - smoothstep(0.76, 1.0, uBurnDown01));
        vAlpha = env * live * clamp(uIntensity, 0.0, 1.35);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float sz = abs(aSparkParam.w) * (0.58 + 0.68 * env + 0.25 * crest) * step(0.01, vAlpha);
        gl_PointSize = clamp((sz * 315.0 * uPixelRatio) / max(1.0, -mv.z), 0.0, 18.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      varying float vIsCinder;
      varying float vAlpha;

      void main() {
        if (vAlpha < 0.015) discard;
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.48, 0.05, d);
        if (soft < 0.02) discard;

        vec3 sparkHot  = mix(vec3(1.00, 0.97, 0.78), vec3(1.00, 0.64, 0.16), vIsCinder);
        vec3 sparkCool = mix(vec3(1.00, 0.36, 0.04), vec3(0.78, 0.10, 0.02), vIsCinder);
        vec3 col = mix(sparkHot, sparkCool, smoothstep(0.08, 0.92, vLife));
        float a = soft * vAlpha * mix(0.95, 0.80, vIsCinder);
        if (a < 0.012) discard;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const sparksPoints = new THREE.Points(shared.roadSparksGeo, sparksMat);
  sparksPoints.name = 'fire_road_sparks';
  sparksPoints.renderOrder = 7;
  sparksPoints.frustumCulled = false;
  sparksPoints.visible = !lowSpec;
  group.add(sparksPoints);

  let disposed = false;

  function reset({ radius, widthScale, lengthScale, heightScale = 1.0, seed } = {}) {
    if (disposed) return;
    if (Number.isFinite(seed)) {
      trenchUniforms.uSeed.value = seed;
      wallUniforms.uSeed.value = seed;
      sparkUniforms.uSeed.value = seed;
    }
    if (Number.isFinite(widthScale) || Number.isFinite(lengthScale)) {
      const sx = Number.isFinite(widthScale) ? widthScale : 1.0;
      const sy = Number.isFinite(heightScale) ? heightScale : 1.0;
      const sz = Number.isFinite(lengthScale) ? lengthScale : 1.0;
      group.scale.set(sx, sy, sz);
    } else if (Number.isFinite(radius) && radius > 0) {
      group.scale.set(radius * 0.88, Number.isFinite(heightScale) ? heightScale : 1.0, radius * 1.16);
    }
    trenchUniforms.uTime.value = 0.0;
    wallUniforms.uTime.value = 0.0;
    sparkUniforms.uTime.value = 0.0;
    trenchUniforms.uWaveFront01.value = 0.12;
    wallUniforms.uWaveFront01.value = 0.12;
    sparkUniforms.uWaveFront01.value = 0.12;
    trenchUniforms.uBurnDown01.value = 0.0;
    wallUniforms.uBurnDown01.value = 0.0;
    sparkUniforms.uBurnDown01.value = 0.0;
  }

  function update(entryOrElapsed, elapsed, life01, intensity = 1.0, waveFront01) {
    if (disposed) return;
    let tVal = 0.0;
    let l01 = 0.25;
    let intVal = 1.0;
    let explicitWave = waveFront01;

    if (entryOrElapsed && typeof entryOrElapsed === 'object') {
      const entry = entryOrElapsed;
      if (Number.isFinite(entry.seed)) {
        trenchUniforms.uSeed.value = entry.seed;
        wallUniforms.uSeed.value = entry.seed;
        sparkUniforms.uSeed.value = entry.seed;
      }
      tVal = Number.isFinite(elapsed)
        ? elapsed
        : (Number.isFinite(entry.elapsed) ? entry.elapsed : (Number.isFinite(entry.age) ? entry.age : 0.0));
      if (Number.isFinite(life01)) {
        l01 = life01;
      } else if (Number.isFinite(entry.life01)) {
        l01 = entry.life01;
      } else if (Number.isFinite(entry.age) && Number.isFinite(entry.duration) && entry.duration > 0) {
        l01 = entry.age / entry.duration;
      }
      intVal = Number.isFinite(intensity) ? intensity : (Number.isFinite(entry.intensity) ? entry.intensity : 1.0);
      if (!Number.isFinite(explicitWave) && Number.isFinite(entry.waveFront01)) {
        explicitWave = entry.waveFront01;
      }
    } else {
      tVal = Number.isFinite(entryOrElapsed) ? entryOrElapsed : 0.0;
      l01 = Number.isFinite(life01) ? life01 : 0.25;
      intVal = Number.isFinite(intensity) ? intensity : 1.0;
    }

    const clampedLife = Math.max(0.0, Math.min(1.0, l01));
    // Travelling wave crest surges down +Z from Boss toward endpoint over the opening ~26% of lifetime!
    const wf = Number.isFinite(explicitWave)
      ? Math.max(0.0, Math.min(1.15, explicitWave))
      : (0.10 + 0.98 * smoothstep01(0.0, 0.26, clampedLife));
    const burnDown01 = smoothstep01(0.68, 1.0, clampedLife);
    const effInt = Math.max(0.0, intVal) * (lowSpec ? 0.85 : 1.0);

    trenchUniforms.uTime.value = tVal;
    trenchUniforms.uWaveFront01.value = wf;
    trenchUniforms.uBurnDown01.value = burnDown01;
    trenchUniforms.uIntensity.value = effInt;

    wallUniforms.uTime.value = tVal;
    wallUniforms.uWaveFront01.value = wf;
    wallUniforms.uBurnDown01.value = burnDown01;
    wallUniforms.uIntensity.value = effInt;

    if (sparksPoints.visible) {
      sparkUniforms.uTime.value = tVal;
      sparkUniforms.uWaveFront01.value = wf;
      sparkUniforms.uBurnDown01.value = burnDown01;
      sparkUniforms.uIntensity.value = effInt;
    }
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    const det = (isMobile || lowSpec) ? 0.0 : 1.0;
    trenchUniforms.uDetail.value = det;
    wallUniforms.uDetail.value = det;
    sparksPoints.visible = !lowSpec;
    sparkUniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    trenchMat.dispose();
    wallMat.dispose();
    sparksMat.dispose();
    releaseSharedFloorFireGeos(isMobile);
  }

  return {
    group,
    trenchBedMesh,
    flameWallMesh,
    sparksPoints,
    reset,
    update,
    setLowSpec,
    dispose
  };
}

// ============================================================================
// 10. SECTION 4.6 — PHASE-2 ARENA PERIMETER FIRE AWAKENING CONTROLLER
//     - Purely visual (0 damage!) Throne Hall spectacle when Boss enters Phase 2:
//       1) Fiery liquid-magma stream shoots across flagstones from `(bx, bz)`
//          outward to the Throne Hall perimeter (`radius ~ 11.8m` around `(0, -44.0)`,
//          clamped cleanly inside Boss Doors, Throne steps & curved Hall walls);
//       2) Splits CW + CCW & races 360° around the entire arena perimeter (`~2.4s`),
//          meeting on the opposite side with a convergence flare;
//       3) Sustains an awakening ring of low gothic floor flames & rising
//          golden-crimson embers for `~4.5s` before gracefully subsiding!
// ============================================================================
function softClampMax(val, maxLimit, softness = 1.0) {
  if (softness <= 1e-5) return Math.min(val, maxLimit);
  const diff = maxLimit - val;
  return maxLimit - 0.5 * (diff + Math.sqrt(diff * diff + softness * softness));
}

function softClampMin(val, minLimit, softness = 1.0) {
  if (softness <= 1e-5) return Math.max(val, minLimit);
  const diff = val - minLimit;
  return minLimit + 0.5 * (diff + Math.sqrt(diff * diff + softness * softness));
}

function evalDefaultBossHallFloorY(x, z) {
  // Matches SOULS_CASTLE_ELEVATION_PLATFORMS subtle dais plinth near the Obsidian Throne (-57.6)
  const ax = Math.abs(x);
  if (z < -54.9 && ax < 3.85) {
    const wx = 1.0 - smoothstep01(3.60, 3.88, ax);
    const wz = 1.0 - smoothstep01(-55.25, -54.95, z);
    return 0.06 * wx * wz;
  }
  if (z > -33.1 && ax < 3.25) {
    const wx = 1.0 - smoothstep01(3.00, 3.28, ax);
    const wz = smoothstep01(-33.10, -32.80, z);
    return 0.05 * wx * wz;
  }
  return 0.0;
}

function evalThronePerimeterContour(theta, cfg, out) {
  // theta = 0 -> North (-Z), PI/2 -> East (+X), PI -> South (+Z), 3*PI/2 -> West (-X)
  let x = cfg.centerX + Math.sin(theta) * cfg.radius;
  let z = cfg.centerZ - Math.cos(theta) * cfg.radius;

  // 1. Stay cleanly inside sealed Boss Doors & protruding door jambs at south end (`z <= -33.55`)
  z = softClampMax(z, cfg.maxZ, 0.95);

  // 2. Curve gracefully across the foot of the Obsidian Throne steps at north end (`z >= -54.45` near |x| < 4.1)
  const throneBand = 1.0 - smoothstep01(2.6, 4.5, Math.abs(x - cfg.centerX));
  const northFloorMinZ = cfg.minZ + throneBand * 0.75;
  z = softClampMin(z, northFloorMinZ, 0.85);

  // 3. Clamp smoothly inside circular Boss Hall stone walls (`BOSS_CENTER = (0, -47.2), R = 16.0 -> <= 14.5m`)
  const dxH = x - cfg.hallCenterX;
  const dzH = z - cfg.hallCenterZ;
  const distH = Math.hypot(dxH, dzH);
  if (distH > 0.001) {
    const clampedDistH = softClampMax(distH, cfg.hallMaxRadius, 0.80);
    const scaleH = clampedDistH / distH;
    x = cfg.hallCenterX + dxH * scaleH;
    z = cfg.hallCenterZ + dzH * scaleH;
  }

  const y = typeof cfg.getGroundHeight === 'function'
    ? (Number(cfg.getGroundHeight(x, z)) || 0.0)
    : evalDefaultBossHallFloorY(x, z);

  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

function setRingSAttr(geo, sValues) {
  geo.setAttribute('aRingS', new THREE.BufferAttribute(sValues, 1));
  return geo;
}

function buildRadialFeederStreamGeometry(isMobile) {
  const parts = [];
  const segZ = isMobile ? 12 : 20;

  // Layer 0: Molten floor channel (`z in [0, 1]`, `width = 1.10m`)
  const bed = new THREE.PlaneGeometry(1.10, 1.0, 2, segZ);
  bed.rotateX(-Math.PI * 0.5);
  // After -PI/2 X-rotation: local z spans [-0.5..+0.5], with uv.y=1 at z=-0.5 and uv.y=0 at z=+0.5.
  // Shift to z in [0..1] and rewrite uv.y = z so uv.y = 0 at Boss `(bx,bz)` -> 1 at perimeter `P(s0)`!
  bed.translate(0, 0.004, 0.5);
  const bedPos = bed.attributes.position;
  const bedUv = bed.attributes.uv;
  for (let i = 0; i < bedPos.count; i++) {
    bedUv.setY(i, Math.max(0.0, Math.min(1.0, bedPos.getZ(i))));
  }
  const bedNorm = normalizeForMerge(bed, 0.0, 0.15, -1.0, 0.0);
  setRingSAttr(bedNorm, new Float32Array(bedNorm.attributes.position.count));
  parts.push(bedNorm);

  // Layer 1: Twin low surging liquid-fire ribbons (`height = 0.52m`, `z in [0, 1]`)
  for (let r = 0; r < 2; r++) {
    const side = r === 0 ? -1 : 1;
    const rib = new THREE.PlaneGeometry(1.0, 0.52, segZ, 4);
    const rPos = rib.attributes.position;
    const rUv = rib.attributes.uv;
    for (let i = 0; i < rPos.count; i++) {
      const u = rUv.getX(i); // 0..1 along stream
      const v = rUv.getY(i); // 0..1 base -> tip
      const z = u;
      const weave = Math.sin(u * Math.PI * 3.0 + r * 1.8) * 0.08 * side;
      const x = weave + side * 0.06 * (1.0 - v * 0.5);
      const y = v * 0.52 * (0.65 + 0.35 * Math.sin(u * Math.PI));
      rPos.setXYZ(i, x, y, z);
      rUv.setXY(i, (r === 0 ? 0.35 : 0.65), u); // uv.y = 0..1 along +Z stream!
    }
    rib.computeVertexNormals();
    const ribNorm = normalizeForMerge(rib, r * 2.1, 0.24, 0.0, 1.0);
    setRingSAttr(ribNorm, new Float32Array(ribNorm.attributes.position.count));
    parts.push(ribNorm);
  }

  return mergeFlameParts(parts);
}

function buildArenaPerimeterGeometries(stations, isMobile) {
  const N = stations.length; // Closed loop of N stations (`s = i / N`)

  // 1. Perimeter Molten Magma Seam Bed (`width = 1.38m` across floor normal)
  const bedHalfW = 0.69;
  const bedPositions = new Float32Array((N + 1) * 2 * 3);
  const bedNormals = new Float32Array((N + 1) * 2 * 3);
  const bedUvs = new Float32Array((N + 1) * 2 * 2);
  const bedRingS = new Float32Array((N + 1) * 2);
  const bedIndices = [];

  for (let i = 0; i <= N; i++) {
    const st = stations[i % N];
    const sContinuous = i / N;
    const sWrapped = (i % N) / N;

    const v0 = i * 2;
    const v1 = v0 + 1;

    bedPositions[v0 * 3]     = st.x - st.nx * bedHalfW;
    bedPositions[v0 * 3 + 1] = st.y + 0.032;
    bedPositions[v0 * 3 + 2] = st.z - st.nz * bedHalfW;

    bedPositions[v1 * 3]     = st.x + st.nx * bedHalfW;
    bedPositions[v1 * 3 + 1] = st.y + 0.032;
    bedPositions[v1 * 3 + 2] = st.z + st.nz * bedHalfW;

    bedNormals[v0 * 3 + 1] = 1.0;
    bedNormals[v1 * 3 + 1] = 1.0;

    bedUvs[v0 * 2] = 0.0;
    bedUvs[v0 * 2 + 1] = sContinuous * 16.0;
    bedUvs[v1 * 2] = 1.0;
    bedUvs[v1 * 2 + 1] = sContinuous * 16.0;

    bedRingS[v0] = sWrapped;
    bedRingS[v1] = sWrapped;

    if (i < N) {
      const a = v0;
      const b = v1;
      const c = v0 + 2;
      const d = v0 + 3;
      bedIndices.push(a, c, b, b, c, d);
    }
  }

  const bedGeo = new THREE.BufferGeometry();
  bedGeo.setAttribute('position', new THREE.BufferAttribute(bedPositions, 3));
  bedGeo.setAttribute('normal', new THREE.BufferAttribute(bedNormals, 3));
  bedGeo.setAttribute('uv', new THREE.BufferAttribute(bedUvs, 2));
  bedGeo.setAttribute('aRingS', new THREE.BufferAttribute(bedRingS, 1));
  bedGeo.setIndex(bedIndices);

  // 2. Perimeter 360° Low Awakening Floor Flame Crown (continuous twin curtains + sculpted 3D tongues)
  const crownParts = [];
  const rowsV = isMobile ? 4 : 6;

  for (let wallIdx = 0; wallIdx < 2; wallIdx++) {
    const radialShift = wallIdx === 0 ? -0.14 : 0.14;
    const tiltInward = wallIdx === 0 ? 0.08 : -0.12;
    const baseH = wallIdx === 0 ? 0.68 : 0.56;
    const vCount = (N + 1) * (rowsV + 1);
    const cPos = new Float32Array(vCount * 3);
    const cUv = new Float32Array(vCount * 2);
    const cIndices = [];

    for (let i = 0; i <= N; i++) {
      const st = stations[i % N];
      const sCont = i / N;
      const hMod = 0.78 + 0.28 * Math.sin(sCont * Math.PI * 24.0 + wallIdx * 2.1)
        + 0.16 * Math.cos(sCont * Math.PI * 14.0 - wallIdx);
      const localH = baseH * hMod;

      for (let r = 0; r <= rowsV; r++) {
        const v = r / rowsV;
        const idx = i * (rowsV + 1) + r;
        const nOff = radialShift + tiltInward * v * v + Math.sin(v * Math.PI) * (wallIdx === 0 ? -0.05 : 0.05);
        cPos[idx * 3]     = st.x + st.nx * nOff;
        cPos[idx * 3 + 1] = st.y + 0.02 + v * localH;
        cPos[idx * 3 + 2] = st.z + st.nz * nOff;

        cUv[idx * 2]     = sCont * 18.0;
        cUv[idx * 2 + 1] = v;

        if (i < N && r < rowsV) {
          const a = idx;
          const b = idx + 1;
          const c = idx + (rowsV + 1);
          const d = c + 1;
          cIndices.push(a, c, b, b, c, d);
        }
      }
    }

    const rawWall = new THREE.BufferGeometry();
    rawWall.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    rawWall.setAttribute('uv', new THREE.BufferAttribute(cUv, 2));
    rawWall.setIndex(cIndices);
    rawWall.computeVertexNormals();

    const nonIdx = normalizeForMerge(rawWall, wallIdx * 1.9, wallIdx === 0 ? 0.10 : 0.02, 0.0, 1.0);
    // Compute exact wrapped `aRingS` per vertex from XZ angle relative to stations
    const pAttr = nonIdx.attributes.position;
    const uvAttr = nonIdx.attributes.uv;
    const sArr = new Float32Array(pAttr.count);
    for (let k = 0; k < pAttr.count; k++) {
      const rawS = (uvAttr.getX(k) / 18.0) % 1.0;
      sArr[k] = rawS < 0 ? rawS + 1.0 : rawS;
    }
    setRingSAttr(nonIdx, sArr);
    crownParts.push(nonIdx);
  }

  // Add 3D angled flame tongues around the perimeter so camera looking parallel to wall sees rich 3D licks!
  const tongueCount = isMobile ? 28 : 48;
  for (let tIdx = 0; tIdx < tongueCount; tIdx++) {
    const sVal = tIdx / tongueCount;
    const stIdx = Math.floor(sVal * N) % N;
    const st = stations[stIdx];
    const tall = tIdx % 2 === 0;
    const isCore = tIdx % 4 === 0;
    const tangYaw = Math.atan2(st.tx, st.tz) + (tall ? 0.72 : -0.72);

    const tongue = createCurvedFlameRibbon({
      width: tall ? 0.68 : 0.54,
      height: tall ? 0.98 : 0.72,
      segX: 2,
      segY: isMobile ? 5 : 7,
      cupDepth: 0.10,
      twist: tall ? 0.34 : -0.32,
      leanOut: 0.06,
      inwardTip: 0.12,
      radialOffset: 0.0,
      yOffset: 0.0,
      angle: tangYaw,
      phaseOffset: tIdx * 0.93,
      heatBias: isCore ? 0.24 : 0.08,
      layerRole: isCore ? 1.0 : 0.0,
      swayScale: 1.05
    });
    tongue.translate(st.x, st.y + 0.02, st.z);
    const sFill = new Float32Array(tongue.attributes.position.count);
    sFill.fill(sVal);
    setRingSAttr(tongue, sFill);
    crownParts.push(tongue);
  }

  const crownGeo = mergeFlameParts(crownParts);

  // 3. Perimeter GPU Rising Golden-Crimson Embers & Racing Vanguard Sparks
  const sparkCount = isMobile ? 84 : 168;
  const rng = makeRng(0x7c41e829);
  const spPos = new Float32Array(sparkCount * 3);
  const spParam = new Float32Array(sparkCount * 4); // speed, phase, maxRise, size (neg = crimson cinder)
  const spRing = new Float32Array(sparkCount * 3);  // ringS, driftTangential, swirlFreq

  for (let i = 0; i < sparkCount; i++) {
    const sVal = (i + rng() * 0.9) / sparkCount;
    const fIdx = sVal * N;
    const i0 = Math.floor(fIdx) % N;
    const i1 = (i0 + 1) % N;
    const frac = fIdx - Math.floor(fIdx);
    const st0 = stations[i0];
    const st1 = stations[i1];

    const jitterN = (rng() - 0.5) * 0.62;
    const bx = st0.x + (st1.x - st0.x) * frac + st0.nx * jitterN;
    const by = st0.y + (st1.y - st0.y) * frac + 0.06 + rng() * 0.08;
    const bz = st0.z + (st1.z - st0.z) * frac + st0.nz * jitterN;

    spPos[i * 3]     = bx;
    spPos[i * 3 + 1] = by;
    spPos[i * 3 + 2] = bz;

    const isCrimson = i % 3 === 1;
    spParam[i * 4]     = isCrimson ? (0.62 + rng() * 0.58) : (1.05 + rng() * 0.95);
    spParam[i * 4 + 1] = rng();
    spParam[i * 4 + 2] = isCrimson ? (1.35 + rng() * 1.15) : (1.65 + rng() * 1.25);
    const sz = isCrimson ? (0.105 + rng() * 0.065) : (0.068 + rng() * 0.055);
    spParam[i * 4 + 3] = isCrimson ? -sz : sz;

    spRing[i * 3]     = sVal % 1.0;
    spRing[i * 3 + 1] = (rng() - 0.5) * 0.55;
    spRing[i * 3 + 2] = (rng() < 0.5 ? -1 : 1) * (2.2 + rng() * 2.8);
  }

  const sparksGeo = new THREE.BufferGeometry();
  sparksGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  sparksGeo.setAttribute('aSparkParam', new THREE.BufferAttribute(spParam, 4));
  sparksGeo.setAttribute('aSparkRing', new THREE.BufferAttribute(spRing, 3));

  return { bedGeo, crownGeo, sparksGeo };
}

/**
 * Section 4.6 — Phase-2 Arena Perimeter Fire Awakening Controller (`0` damage!)
 * Returns `{ group, trigger(bx, bz), update(dt, elapsed), reset(), clear(), setLowSpec(enabled), isActive(), getLightHint(), prewarm(), dispose() }`
 */
export function createPhase2ArenaFireRingController(opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);

  const cfg = {
    centerX: Number.isFinite(opts.centerX) ? opts.centerX : 0.0,
    centerZ: Number.isFinite(opts.centerZ) ? opts.centerZ : -44.0,
    radius: Number.isFinite(opts.radius) ? opts.radius : 11.8,
    maxZ: Number.isFinite(opts.maxZ) ? opts.maxZ : -33.55,
    minZ: Number.isFinite(opts.minZ) ? opts.minZ : -54.55,
    hallCenterX: Number.isFinite(opts.hallCenterX) ? opts.hallCenterX : 0.0,
    hallCenterZ: Number.isFinite(opts.hallCenterZ) ? opts.hallCenterZ : -47.2,
    hallMaxRadius: Number.isFinite(opts.hallMaxRadius) ? opts.hallMaxRadius : 14.5,
    getGroundHeight: typeof opts.getGroundHeight === 'function' ? opts.getGroundHeight : null
  };

  // Bake smooth 96-station Throne Hall perimeter contour + outward floor normals
  const STATION_COUNT = isMobile ? 64 : 96;
  const stations = new Array(STATION_COUNT);
  const tmpPt = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < STATION_COUNT; i++) {
    const theta = (i / STATION_COUNT) * Math.PI * 2.0;
    evalThronePerimeterContour(theta, cfg, tmpPt);
    stations[i] = { x: tmpPt.x, y: tmpPt.y, z: tmpPt.z, tx: 0, tz: 1, nx: 1, nz: 0 };
  }
  for (let i = 0; i < STATION_COUNT; i++) {
    const prev = stations[(i - 1 + STATION_COUNT) % STATION_COUNT];
    const next = stations[(i + 1) % STATION_COUNT];
    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const tLen = Math.hypot(tx, tz) || 1.0;
    tx /= tLen;
    tz /= tLen;
    // Outward normal in XZ (since theta=0 is North -Z and increases CW toward East +X, outward is (-tz, tx) or checked via radial dot!)
    let nx = -tz;
    let nz = tx;
    const rx = stations[i].x - cfg.centerX;
    const rz = stations[i].z - cfg.centerZ;
    if (nx * rx + nz * rz < 0) {
      nx = -nx;
      nz = -nz;
    }
    stations[i].tx = tx;
    stations[i].tz = tz;
    stations[i].nx = nx;
    stations[i].nz = nz;
  }

  const group = new THREE.Group();
  group.name = 'phase2_arena_perimeter_fire_ring';
  group.visible = false;

  const feederGeo = buildRadialFeederStreamGeometry(isMobile);
  const { bedGeo, crownGeo, sparksGeo } = buildArenaPerimeterGeometries(stations, isMobile);

  // Shared timeline uniforms
  const ringUniforms = {
    uTime: { value: 0.0 },
    uHitS: { value: 0.0 },
    uRunnerFront01: { value: 0.0 },
    uRunnerFade: { value: 0.0 },
    uSweep01: { value: 0.0 },
    uMeetFlare: { value: 0.0 },
    uRingFade: { value: 0.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uPixelRatio: { value: getSafePixelRatio(isMobile, lowSpec) }
  };

  // DC #1: Radial Feeder Fire Stream (`(bx, bz)` -> Throne Hall Perimeter `P(s0)`)
  const feederMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aFlameMeta;
      uniform float uTime;
      uniform float uRunnerFront01;
      uniform float uRunnerFade;

      varying vec2 vUv;
      varying vec4 vMeta;

      void main() {
        vUv = uv;
        vMeta = aFlameMeta;
        vec3 p = position;
        if (aFlameMeta.z > -0.5) {
          float s = clamp(uv.y, 0.0, 1.0);
          float h = clamp((p.y) / 0.52, 0.0, 1.0);
          float headBoost = 1.0 + 0.45 * exp(-pow((s - uRunnerFront01) * 6.5, 2.0));
          p.y *= headBoost * (0.35 + 0.65 * uRunnerFade);
          p.x += sin(uTime * 14.0 - s * 10.0 + aFlameMeta.x) * 0.08 * h;
        }
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uRunnerFront01;
      uniform float uRunnerFade;
      uniform float uDetail;

      varying vec2 vUv;
      varying vec4 vMeta;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        if (uRunnerFade < 0.015) discard;
        float s = clamp(vUv.y, 0.0, 1.0);
        float frontMask = smoothstep(uRunnerFront01 + 0.05, uRunnerFront01 - 0.10, s);
        if (frontMask < 0.015) discard;

        float headGlow = exp(-pow((s - uRunnerFront01) * 7.0, 2.0));
        float n = snoise2(vec2(vUv.x * 4.5 + vMeta.x, s * 8.0 - uTime * 7.5)) * 0.5 + 0.5;
        float endCaps = smoothstep(0.0, 0.06, s) * smoothstep(1.0, 0.92, s);

        if (vMeta.z < -0.5) {
          // Molten stone seam along radial runner
          float ax = abs(vUv.x - 0.5) * 2.0 + (n - 0.5) * 0.35;
          float seam = 1.0 - smoothstep(0.28, 0.92, ax);
          float alpha = seam * frontMask * endCaps * uRunnerFade * 0.88;
          if (alpha < 0.015) discard;
          float temp = clamp(seam * (0.55 + 0.55 * n) + headGlow * 0.55, 0.0, 1.0);
          vec3 col = mix(vec3(0.45, 0.04, 0.01), vec3(0.98, 0.38, 0.04), smoothstep(0.05, 0.50, temp));
          col = mix(col, vec3(1.00, 0.92, 0.58), smoothstep(0.50, 0.96, temp));
          gl_FragColor = vec4(col, alpha);
          return;
        }

        // Low racing flame lick along runner
        float flame = (0.65 + 0.55 * (n - 0.42) + headGlow * 0.35) * frontMask * endCaps;
        float alpha = smoothstep(0.18, 0.58, flame) * uRunnerFade * 0.86;
        if (alpha < 0.015) discard;
        vec3 col = mix(vec3(0.86, 0.14, 0.02), vec3(1.00, 0.62, 0.10), smoothstep(0.20, 0.68, flame));
        col = mix(col, vec3(1.00, 0.96, 0.76), clamp(headGlow * 0.85, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  const radialStreamMesh = new THREE.Mesh(feederGeo, feederMat);
  radialStreamMesh.name = 'phase2_arena_feeder_stream';
  radialStreamMesh.renderOrder = 5;
  radialStreamMesh.frustumCulled = false;
  group.add(radialStreamMesh);

  // DC #2: 360° Perimeter Molten Floor Seam
  const perimeterBedMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float aRingS;
      varying vec2 vUv;
      varying float vRingS;
      void main() {
        vUv = uv;
        vRingS = aRingS;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHitS;
      uniform float uSweep01;
      uniform float uMeetFlare;
      uniform float uRingFade;
      uniform float uDetail;

      varying vec2 vUv;
      varying float vRingS;

      ${GLSL_SIMPLEX_NOISE}
      ${GLSL_VORONOI_MAGMA}

      void main() {
        if (uRingFade < 0.012 || uSweep01 < 0.005) discard;
        float arcDist = abs(fract(vRingS - uHitS + 0.5) - 0.5) * 2.0;
        float sweepGate = smoothstep(uSweep01 + 0.035, uSweep01 - 0.055, arcDist);
        if (sweepGate < 0.012) discard;

        float headWave = exp(-pow((arcDist - uSweep01) * 11.0, 2.0)) * step(uSweep01, 0.995);
        float antiFlare = exp(-pow((1.0 - arcDist) * 7.5, 2.0)) * uMeetFlare;

        float across = (vUv.x - 0.5) * 2.0;
        float jag = snoise2(vec2(vUv.y * 2.4, across * 2.2 - uTime * 0.7));
        float ax = abs(across + jag * 0.24);
        float bandMask = 1.0 - smoothstep(0.46, 0.96, ax);
        if (bandMask < 0.012) discard;

        vec2 vor = magmaVoronoiCracks(vec2(across * 2.6, vUv.y * 2.8 - uTime * 0.45), uDetail);
        float boil = snoise2(vec2(across * 3.8, vUv.y * 3.5 - uTime * 2.6)) * 0.5 + 0.5;
        float spine = exp(-across * across * 5.2);

        float heat = clamp(
          (vor.x * (0.58 + 0.48 * boil) + spine * 0.44 + headWave * 0.65 + antiFlare * 0.55) * uRingFade,
          0.0,
          1.25
        );

        vec3 crust = vec3(0.055, 0.03, 0.025);
        vec3 magma = mix(vec3(0.65, 0.06, 0.01), vec3(0.98, 0.36, 0.03), smoothstep(0.08, 0.44, heat));
        magma = mix(magma, vec3(1.00, 0.84, 0.32), smoothstep(0.42, 0.80, heat));
        magma = mix(magma, vec3(1.00, 0.97, 0.82), smoothstep(0.78, 1.05, heat));

        vec3 col = mix(crust, magma, smoothstep(0.06, 0.38, heat));
        float alpha = bandMask * sweepGate * mix(0.46, 0.92, smoothstep(0.06, 0.36, heat)) * uRingFade;
        if (alpha < 0.012) discard;

        gl_FragColor = vec4(min(col, vec3(1.15)), clamp(alpha, 0.0, 0.92));
      }
    `
  });

  const perimeterBedMesh = new THREE.Mesh(bedGeo, perimeterBedMat);
  perimeterBedMesh.name = 'phase2_arena_perimeter_bed';
  perimeterBedMesh.renderOrder = 4;
  perimeterBedMesh.frustumCulled = false;
  group.add(perimeterBedMesh);

  // DC #3: 360° Perimeter Low Awakening Floor Flame Crown
  const perimeterCrownMat = new THREE.ShaderMaterial({
    defines: isMobile ? { FIRE_MOBILE_FAST: 1 } : {},
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aFlameMeta;
      attribute float aRingS;

      uniform float uTime;
      uniform float uHitS;
      uniform float uSweep01;
      uniform float uMeetFlare;
      uniform float uRingFade;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying float vRingS;
      varying float vHeadBoost;

      void main() {
        vUv = uv;
        vMeta = aFlameMeta;
        vRingS = aRingS;

        float h = clamp(uv.y, 0.0, 1.0);
        float arcDist = abs(fract(aRingS - uHitS + 0.5) - 0.5) * 2.0;
        float sweepGate = smoothstep(uSweep01 + 0.04, uSweep01 - 0.06, arcDist);
        float headWave = exp(-pow((arcDist - uSweep01) * 10.5, 2.0)) * step(uSweep01, 0.995);
        float antiFlare = exp(-pow((1.0 - arcDist) * 7.0, 2.0)) * uMeetFlare;
        float crest = clamp(headWave + antiFlare * 0.9, 0.0, 1.4);
        vHeadBoost = crest;

        vec3 p = position;
        vec3 n = normal;

        float ph = aFlameMeta.x + aRingS * 37.699;
        float t = uTime * 5.2 + ph;
        float scaleH = sweepGate * (0.35 + 0.65 * uRingFade) * (1.0 + 0.62 * crest);
        float breath = 0.92 + 0.12 * sin(t * 1.6 + ph);

        // Lift relative to local base height smoothly so flames grow from stone floor & subside back down!
        p.y += h * 0.62 * (scaleH * breath - 1.0);
        float sway = sin(t * 1.4 - h * 4.5 + ph) * 0.09 * pow(max(h, 0.0001), 1.35) * aFlameMeta.w;
        p.x += sway;
        p.z += cos(t * 1.25 - h * 4.2 - ph) * 0.09 * pow(max(h, 0.0001), 1.35) * aFlameMeta.w;

        vLocalPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * n);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uHitS;
      uniform float uSweep01;
      uniform float uRingFade;
      uniform float uDetail;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec4 vMeta;
      varying float vRingS;
      varying float vHeadBoost;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        if (uRingFade < 0.015 || uSweep01 < 0.005) discard;
        float arcDist = abs(fract(vRingS - uHitS + 0.5) - 0.5) * 2.0;
        float sweepGate = smoothstep(uSweep01 + 0.035, uSweep01 - 0.055, arcDist);
        if (sweepGate < 0.015) discard;

        float h = clamp(vUv.y, 0.0, 1.0);
        bool isCore = vMeta.z > 0.5;
        float ndv = clamp(abs(dot(normalize(vNormalV), normalize(vViewDir))), 0.0, 1.0);
        float viewFade = mix(1.0, smoothstep(0.05, 0.46, ndv), 0.52);

        float t = uTime * 4.8 + vMeta.x;
        vec2 warp = fireDomainWarp(vec2(vRingS * 28.0 + vMeta.x, h * 3.2 - t * 1.25), uDetail);
        vec3 p3 = vec3(
          vLocalPos.x * 0.85 + warp.x * 0.35,
          h * 3.0 - t * 1.75,
          vLocalPos.z * 0.85 + warp.y * 0.35
        );
        vec2 p2 = vec2(vRingS * 44.0 + warp.x * 0.85, h * 3.8 - t * 2.25 + warp.y * 0.55);
        vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
        float fbm = turb.x;
        float streaks = turb.y;

        // Carve distinct dancing low floor flame licks all around the 360° perimeter!
        float crownWave = sin(vRingS * 113.097 + warp.x * 2.6 - t * 0.5) * 0.16 * pow(max(h, 0.0001), 0.8);
        float baseIn = smoothstep(0.0, 0.08, h);
        float tipOut = smoothstep(1.0, 0.12, h);
        float erode = (1.0 - uRingFade) * (0.42 + 0.58 * h);

        float field = ((0.64 + 0.42 * tipOut) + crownWave + (fbm - 0.44) * mix(0.42, 1.18, pow(max(h, 0.0001), 0.62)) + vHeadBoost * 0.28 - pow(max(h, 0.0001), 1.06) * 0.60 - erode) * baseIn;

        float flameEdge = isCore ? smoothstep(0.20, 0.58, field) : smoothstep(0.08, 0.38, field);
        float alpha = flameEdge * viewFade * sweepGate * uRingFade * 0.90;
        if (alpha < 0.015) discard;

        float temp = clamp(
          smoothstep(0.06, 0.85, field) * 0.52
          + smoothstep(0.65, 0.02, h) * 0.30
          + vHeadBoost * 0.28
          + (streaks - 0.46) * 0.28
          + vMeta.y * 0.45
          - smoothstep(0.30, 0.95, h) * 0.46,
          0.0,
          1.0
        );

        vec3 col = mix(vec3(0.56, 0.04, 0.01), vec3(0.92, 0.16, 0.02), smoothstep(0.00, 0.25, temp));
        col = mix(col, vec3(1.00, 0.52, 0.06), smoothstep(0.22, 0.55, temp));
        col = mix(col, vec3(1.00, 0.84, 0.30), smoothstep(0.54, 0.84, temp));
        col = mix(col, vec3(1.00, 0.98, 0.84), smoothstep(0.82, 0.99, temp));

        float boost = 0.95 + 0.20 * vHeadBoost;
        gl_FragColor = vec4(min(col * boost, vec3(1.18)), clamp(alpha, 0.0, 0.92));
      }
    `
  });

  const perimeterCrownMesh = new THREE.Mesh(crownGeo, perimeterCrownMat);
  perimeterCrownMesh.name = 'phase2_arena_perimeter_flames';
  perimeterCrownMesh.renderOrder = 6;
  perimeterCrownMesh.frustumCulled = false;
  group.add(perimeterCrownMesh);

  // DC #4: 360° Perimeter Rising Golden-Crimson Embers & Vanguard Sparks
  const perimeterSparksMat = new THREE.ShaderMaterial({
    uniforms: ringUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec4 aSparkParam;
      attribute vec3 aSparkRing;

      uniform float uTime;
      uniform float uHitS;
      uniform float uSweep01;
      uniform float uMeetFlare;
      uniform float uRingFade;
      uniform float uPixelRatio;

      varying float vLife;
      varying float vIsCrimson;
      varying float vAlpha;

      void main() {
        float ringS = aSparkRing.x;
        float arcDist = abs(fract(ringS - uHitS + 0.5) - 0.5) * 2.0;
        float sweepGate = smoothstep(uSweep01 + 0.03, uSweep01 - 0.05, arcDist);
        float headWave = exp(-pow((arcDist - uSweep01) * 11.0, 2.0)) * step(uSweep01, 0.995);
        float antiFlare = exp(-pow((1.0 - arcDist) * 7.5, 2.0)) * uMeetFlare;
        float boost = clamp(headWave + antiFlare, 0.0, 1.4);

        float life = fract(uTime * aSparkParam.x + aSparkParam.y);
        vLife = life;
        vIsCrimson = aSparkParam.w < 0.0 ? 1.0 : 0.0;

        float swirlAng = life * aSparkRing.z + aSparkParam.y * 6.28318;
        vec3 p = position;
        p.x += cos(swirlAng) * (0.10 + 0.24 * life) + aSparkRing.y * life;
        p.z += sin(swirlAng) * (0.10 + 0.24 * life);
        p.y += life * aSparkParam.z * (0.85 + 0.55 * boost);

        float env = smoothstep(0.0, 0.10, life) * smoothstep(1.0, 0.26, life);
        vAlpha = env * sweepGate * uRingFade * (0.85 + 0.35 * boost);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float sz = abs(aSparkParam.w) * (0.60 + 0.65 * env + 0.30 * boost) * step(0.01, vAlpha);
        gl_PointSize = clamp((sz * 320.0 * uPixelRatio) / max(1.0, -mv.z), 0.0, 18.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      varying float vIsCrimson;
      varying float vAlpha;

      void main() {
        if (vAlpha < 0.015) discard;
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.48, 0.05, d);
        if (soft < 0.02) discard;

        vec3 colGoldHot = mix(vec3(1.00, 0.94, 0.62), vec3(1.00, 0.44, 0.08), vIsCrimson);
        vec3 colCrimEnd = mix(vec3(0.98, 0.28, 0.03), vec3(0.76, 0.06, 0.02), vIsCrimson);
        vec3 col = mix(colGoldHot, colCrimEnd, smoothstep(0.06, 0.92, vLife));
        float a = soft * vAlpha * 0.92;
        if (a < 0.012) discard;
        gl_FragColor = vec4(col, a);
      }
    `
  });

  const perimeterSparksPoints = new THREE.Points(sparksGeo, perimeterSparksMat);
  perimeterSparksPoints.name = 'phase2_arena_perimeter_sparks';
  perimeterSparksPoints.renderOrder = 7;
  perimeterSparksPoints.frustumCulled = false;
  perimeterSparksPoints.visible = !lowSpec;
  group.add(perimeterSparksPoints);

  // Timeline constants:
  //   0.00..0.38s: Fiery stream shoots across stone floor from `(bx, bz)` to perimeter `P(s0)`
  //   0.34..2.74s: Splits CW + CCW and sweeps 360° around the arena border (`2.40s` sweep!)
  //   2.74..7.24s: Awakening low floor flames & golden-crimson embers hold ~4.5s & subside cleanly!
  const STREAM_TRAVEL_SEC = 0.38;
  const RING_START_SEC = 0.34;
  const RING_SWEEP_SEC = 2.40;
  const RING_HOLD_END_SEC = RING_START_SEC + RING_SWEEP_SEC + 3.00; // 5.74s
  const TOTAL_DURATION_SEC = RING_START_SEC + RING_SWEEP_SEC + 4.50; // 7.24s

  let active = false;
  let age = 0.0;
  let clockTime = 0.0;
  let disposed = false;

  const lightHint = {
    active: false,
    x: cfg.centerX,
    y: 0.65,
    z: cfg.centerZ,
    color: 0xff6e18,
    intensity: 0.0,
    distance: 22.0
  };
  let originX = 0.0;
  let originZ = -47.2;
  let hitX = 0.0;
  let hitZ = -54.0;

  function trigger(bx = 0.0, bz = -47.2) {
    if (disposed) return false;
    const safeBx = Number.isFinite(bx) ? bx : 0.0;
    const safeBz = Number.isFinite(bz) ? bz : -47.2;
    originX = safeBx;
    originZ = safeBz;

    // Pick outward radial target on the Throne Hall perimeter (nearest perimeter point along Boss radial ray,
    // or closest station on the perimeter so the floor stream shoots cleanly to the nearest arena border!)
    let bestIdx = 0;
    let bestScore = Infinity;
    const rdx = safeBx - cfg.centerX;
    const rdz = safeBz - cfg.centerZ;
    const rLen = Math.hypot(rdx, rdz);

    for (let i = 0; i < STATION_COUNT; i++) {
      const st = stations[i];
      const d = Math.hypot(st.x - safeBx, st.z - safeBz);
      let score = d;
      if (rLen < 0.35) {
        // If triggered near exact center `(0, -44)`, shoot straight North (`theta = 0`) toward Throne steps!
        score = Math.abs(st.x - cfg.centerX) + (st.z - cfg.minZ) * 0.5;
      }
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const hitSt = stations[bestIdx];
    hitX = hitSt.x;
    hitZ = hitSt.z;
    const hitS = bestIdx / STATION_COUNT;
    const startFloorY = typeof cfg.getGroundHeight === 'function'
      ? (Number(cfg.getGroundHeight(safeBx, safeBz)) || 0.0)
      : evalDefaultBossHallFloorY(safeBx, safeBz);

    const dx = hitX - safeBx;
    const dz = hitZ - safeBz;
    const streamDist = Math.hypot(dx, dz);
    const streamYaw = streamDist > 0.01 ? Math.atan2(dx, dz) : 0.0;

    radialStreamMesh.position.set(safeBx, startFloorY + 0.028, safeBz);
    radialStreamMesh.rotation.set(0, streamYaw, 0);
    radialStreamMesh.scale.set(1.0, 1.0, Math.max(0.65, streamDist));

    ringUniforms.uHitS.value = hitS;
    ringUniforms.uRunnerFront01.value = 0.04;
    ringUniforms.uRunnerFade.value = streamDist > 0.35 ? 1.0 : 0.0;
    ringUniforms.uSweep01.value = 0.0;
    ringUniforms.uMeetFlare.value = 0.0;
    ringUniforms.uRingFade.value = 0.0;

    age = 0.0;
    active = true;
    group.visible = true;
    return true;
  }

  function reset() {
    active = false;
    age = 0.0;
    group.visible = false;
    ringUniforms.uRunnerFront01.value = 0.0;
    ringUniforms.uRunnerFade.value = 0.0;
    ringUniforms.uSweep01.value = 0.0;
    ringUniforms.uMeetFlare.value = 0.0;
    ringUniforms.uRingFade.value = 0.0;
    lightHint.active = false;
    lightHint.intensity = 0.0;
  }

  function update(dt = 0.016, elapsed) {
    if (disposed || !active) return false;
    const safeDt = Number.isFinite(dt) ? Math.max(0.0, Math.min(dt, 0.1)) : 0.016;
    age += safeDt;
    clockTime = Number.isFinite(elapsed) ? elapsed : (clockTime + safeDt);

    if (age >= TOTAL_DURATION_SEC) {
      reset();
      return false;
    }

    ringUniforms.uTime.value = clockTime;

    // 1. Radial feeder stream (`0.00..0.38s` shoot, `0.55..1.85s` fade behind the split)
    const runnerFront = smoothstep01(0.0, STREAM_TRAVEL_SEC, age);
    const runnerFade = (1.0 - smoothstep01(0.60, 1.85, age)) * (lowSpec ? 0.85 : 1.0);
    ringUniforms.uRunnerFront01.value = runnerFront;
    ringUniforms.uRunnerFade.value = runnerFade;

    // 2. 360° CW + CCW perimeter split sweep (`0.34..2.74s` -> `2.40s` sweep)
    let sweep01 = 0.0;
    let ringFade = 0.0;
    let meetFlare = 0.0;

    if (age >= RING_START_SEC) {
      const ringElapsed = age - RING_START_SEC;
      const rawSweep = Math.min(1.0, ringElapsed / RING_SWEEP_SEC);
      // Slight ease-out at convergence while maintaining crisp energetic racing speed
      sweep01 = rawSweep < 1.0 ? (rawSweep * (1.18 - 0.18 * rawSweep)) : 1.0;

      const fadeIn = smoothstep01(0.0, 0.16, ringElapsed);
      const subside = 1.0 - smoothstep01(RING_HOLD_END_SEC, TOTAL_DURATION_SEC, age);
      ringFade = fadeIn * subside * (lowSpec ? 0.85 : 1.0);

      // Antipodal convergence flare right as CW & CCW fire heads collide at `RING_START_SEC + RING_SWEEP_SEC`!
      const meetT = age - (RING_START_SEC + RING_SWEEP_SEC);
      if (meetT > -0.16 && meetT < 0.85) {
        meetFlare = meetT < 0.0
          ? smoothstep01(-0.16, 0.0, meetT)
          : Math.exp(-meetT * 4.2);
      }
    }

    ringUniforms.uSweep01.value = sweep01;
    ringUniforms.uMeetFlare.value = meetFlare;
    ringUniforms.uRingFade.value = ringFade;

    // Optional zero-alloc light hint for world lighting rigs
    if (age < RING_START_SEC) {
      lightHint.active = true;
      lightHint.x = originX + (hitX - originX) * runnerFront;
      lightHint.z = originZ + (hitZ - originZ) * runnerFront;
      lightHint.intensity = 3.2 * runnerFade;
    } else {
      lightHint.active = ringFade > 0.02;
      lightHint.x = cfg.centerX;
      lightHint.z = cfg.centerZ;
      lightHint.intensity = (2.8 + 1.4 * meetFlare) * ringFade;
    }

    return true;
  }

  function setLowSpec(enabled = false) {
    if (disposed) return;
    lowSpec = Boolean(enabled);
    ringUniforms.uDetail.value = (isMobile || lowSpec) ? 0.0 : 1.0;
    ringUniforms.uPixelRatio.value = getSafePixelRatio(isMobile, lowSpec);
    perimeterSparksPoints.visible = !lowSpec;
  }

  function prewarm(renderer, camera) {
    if (disposed || !renderer || !camera) return;
    const prevVis = group.visible;
    group.visible = true;
    renderer.compile(group, camera);
    group.visible = prevVis;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    reset();
    feederGeo.dispose();
    bedGeo.dispose();
    crownGeo.dispose();
    sparksGeo.dispose();
    feederMat.dispose();
    perimeterBedMat.dispose();
    perimeterCrownMat.dispose();
    perimeterSparksMat.dispose();
  }

  return {
    group,
    radialStreamMesh,
    perimeterBedMesh,
    perimeterCrownMesh,
    perimeterSparksPoints,
    trigger,
    update,
    reset,
    clear: reset,
    setLowSpec,
    isActive: () => active,
    getLightHint: () => lightHint,
    prewarm,
    dispose
  };
}
