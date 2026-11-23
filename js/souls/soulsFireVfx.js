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
// 6. BOSS PHASE-2 HAMMER VOLCANIC FIRE TRAIL SHADER MATERIAL
//    - Anisotropic high-velocity Simplex FBM fire streaks ripping backward off
//      the Boss's warhammer during Phase 2 enrage & heavy cleaves!
//    - Supports swept ribbon trails (flowAxis: 'u', u=0 leading edge -> u=1 tail)
//      AND 3D hammer flame sheaths (flowAxis: 'v', v=0 hammer head -> v=1 tips).
//    - Balanced NormalBlending by default (charred dark-crimson smoke wake +
//      blazing magma-orange body + white-gold impact leading edge!) or optional
//      additive: true for layered additive core ribbons.
// ============================================================================
export function createHammerFireTrailMaterial(opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : IS_MOBILE_DEFAULT;
  let lowSpec = Boolean(opts.lowSpec);
  const flowAlongV = opts.flowAxis === 'v';
  const additive = Boolean(opts.additive);

  let baseIntensity = Number.isFinite(opts.intensity) ? opts.intensity : 1.0;

  const uniforms = {
    uTime: { value: 0.0 },
    uIntensity: { value: baseIntensity },
    uPhase2: { value: Number.isFinite(opts.phase2) ? opts.phase2 : 1.0 },
    uWindup: { value: Number.isFinite(opts.windup) ? opts.windup : 0.0 },
    uStaggerDim: { value: 1.0 },
    uDetail: { value: (isMobile || lowSpec) ? 0.0 : 1.0 },
    uSpeed: { value: Number.isFinite(opts.speed) ? opts.speed : 4.6 },
    uFlowAxis: { value: flowAlongV ? 1.0 : 0.0 },
    uVertexDistort: { value: Number.isFinite(opts.vertexDistort) ? opts.vertexDistort : (flowAlongV ? 0.065 : 0.025) },
    uColSoot:  { value: toColorVec3(opts.sootColor,  0x5e0902) }, // Deep glowing volcanic crimson wake
    uColOuter: { value: toColorVec3(opts.outerColor, 0xc41a04) }, // Violent volcanic crimson-scarlet tongues
    uColMid:   { value: toColorVec3(opts.midColor,   0xff5806) }, // Roaring magma-orange fire body
    uColHot:   { value: toColorVec3(opts.hotColor,   0xffcf36) }, // Incandescent golden impact flare
    uColCore:  { value: toColorVec3(opts.coreColor,  0xfffbe0) }  // Scorching white-yellow leading rim
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
      uniform float uTime;
      uniform float uSpeed;
      uniform float uPhase2;
      uniform float uWindup;
      uniform float uFlowAxis;
      uniform float uVertexDistort;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        float along = (uFlowAxis > 0.5) ? uv.y : uv.x;
        float across = (uFlowAxis > 0.5) ? uv.x : uv.y;

        vec3 p = position;
        // Turbulent high-velocity flame whip along trailing wake
        float whipAmp = uVertexDistort * pow(clamp(along, 0.0, 1.0), 1.35) * (0.65 + 0.55 * uPhase2 + 0.45 * uWindup);
        float t = uTime * (uSpeed * 1.85);
        float wave = sin(t - along * 9.5 + across * 4.2) * 0.65 + cos(t * 1.63 - along * 14.2) * 0.35;
        p += normal * (wave * whipAmp);

        vLocalPos = p;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNormalV = normalize(normalMatrix * normal);
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

      uniform vec3 uColSoot;
      uniform vec3 uColOuter;
      uniform vec3 uColMid;
      uniform vec3 uColHot;
      uniform vec3 uColCore;

      varying vec2 vUv;
      varying vec3 vLocalPos;
      varying vec3 vNormalV;
      varying vec3 vViewDir;

      ${GLSL_SIMPLEX_NOISE}

      void main() {
        // Normalize coordinates so along = 0 at hot hammer leading edge -> 1 at torn fire tail
        float along  = clamp((uFlowAxis > 0.5) ? vUv.y : vUv.x, 0.0, 1.0);
        float across = clamp((uFlowAxis > 0.5) ? vUv.x : vUv.y, 0.0, 1.0);

        float speedMult = 0.85 + 0.45 * uPhase2 + 0.40 * uWindup;
        float t = uTime * uSpeed * speedMult;

        // Anisotropic velocity-stretched turbulence streaming violently backward from the hammer head
        vec2 warpUv = vec2(across * 2.8, along * 2.2 - t * 0.78);
        vec2 warpV = fireDomainWarp(warpUv, uDetail);
        float wx = warpV.x;
        float wy = warpV.y;
        float warpAmt = (0.16 + 0.52 * along) * (0.78 + 0.32 * uPhase2);

        vec3 p3 = vec3(
          vLocalPos.x * 2.2 + wx * warpAmt,
          vLocalPos.z * 2.2 + wy * warpAmt,
          along * 3.1 - t * 1.05
        );
        // Stretched along-flow streaks so flames whip like a roaring volcanic trail
        vec2 p2 = vec2(
          across * 5.8 + wx * warpAmt * 1.4,
          along * 3.4 - t * 1.75 + wy * warpAmt * 0.55
        );
        vec2 turb = fireTurbulenceFbm(p3, p2, uDetail);
        float fbm = turb.x;
        float streaks = turb.y;

        // Cross-width envelope (softly narrower at tail, ragged burning borders on both edges)
        float halfW = mix(0.49, 0.24, pow(max(along, 0.0), 0.95));
        float distAcross = abs((across - 0.5) - wx * 0.14 * along);
        float edgeMask = clamp(1.0 - pow(max(distAcross / max(halfW, 0.08), 0.0), 1.85), 0.0, 1.0);

        // Organic turbulent leading-edge ignition + jagged flame erosion along tail + detached flying fire shreds
        float leadIn = smoothstep(0.0, 0.07 + (1.0 - fbm) * 0.09, along);
        float tailFade = smoothstep(1.0, 0.10, along);
        float shredBurst = smoothstep(0.56, 0.88, fbm) * smoothstep(0.32, 0.70, along) * smoothstep(0.99, 0.74, along) * 0.44;

        float field = edgeMask * (0.66 + 0.46 * tailFade)
          + (fbm - 0.45) * mix(0.34, 1.08, pow(max(along, 0.0), 0.65))
          + shredBurst
          - pow(max(along, 0.0), 1.15) * 0.58;
        field *= leadIn;

        float effIntensity = clamp(uIntensity * uStaggerDim * (0.68 + 0.48 * uPhase2 + 0.55 * uWindup), 0.0, 1.75);
        float fireEdge  = smoothstep(0.08, 0.28, field);
        float tailSmoke = smoothstep(0.55, 0.94, along) * smoothstep(0.02, 0.14, field) * (1.0 - fireEdge);
        float alpha = clamp(fireEdge * 0.96 + tailSmoke * 0.34, 0.0, 1.0) * clamp(effIntensity, 0.0, 1.0);
        if (alpha < 0.02) discard;

        // Volcanic combustion temperature: hot white-gold right along hammer impact rim -> roaring magma-orange -> crimson shreds
        float outerBladeHot = smoothstep(0.20, 0.95, across);
        float leadHeat = smoothstep(0.26, 0.01, along) * (0.34 + 0.24 * outerBladeHot + 0.28 * uWindup + 0.16 * uPhase2);
        float temp = clamp(
          smoothstep(0.08, 0.88, field) * 0.52
          + leadHeat
          + (streaks - 0.46) * 0.32
          - smoothstep(0.30, 0.94, along) * 0.46,
          0.0,
          1.0
        );

        vec3 col = mix(uColSoot, uColOuter, smoothstep(0.00, 0.24, temp));
        col = mix(col, uColMid,  smoothstep(0.22, 0.52, temp));
        col = mix(col, uColHot,  smoothstep(0.50, 0.80, temp));
        col = mix(col, uColCore, smoothstep(0.78, 0.97, temp));
        col = mix(col, vec3(0.22, 0.03, 0.015), tailSmoke * 0.65);

        // Bright crackling lava-fire veins streaming through the ribbon
        float vein = smoothstep(0.56, 0.90, streaks) * smoothstep(0.22, 0.65, temp) * (1.0 - along * 0.42);
        col = mix(col, uColCore, vein * (0.28 + 0.24 * uWindup));

        float boost = 0.95 + 0.16 * uPhase2 + 0.24 * uWindup;
        gl_FragColor = vec4(min(col * boost, vec3(1.12)), clamp(alpha, 0.0, 0.95));
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

  mat.setCombatState = function setCombatState({
    heat,
    intensity,
    phase2,
    windup,
    staggerDim
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
