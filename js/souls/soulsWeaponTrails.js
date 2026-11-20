// Souls-like 3D Swept Ribbon Weapon Trails & Physical Steel Clash Sparks
// Pure Vanilla ES Module (Three.js r160) — Elden Ring / Dark Souls 3 combat VFX:
//   - Up to 6 simultaneous dynamic 3D swept blade ribbons in 1 SINGLE draw call (0 when idle)
//   - Centripetal Catmull-Rom spline smoothing + blade-length arc preservation (silky even at 30 FPS)
//   - 4 handcrafted GLSL styles: 'hero_steel', 'hero_heavy', 'mob_iron', 'boss_ember' (+ Phase 2 boost)
//   - Premultiplied CustomBlending (simultaneous smoky silhouette + HDR glow, preserves canvas alpha = 1)
//   - Velocity-stretched instanced metallic ricochet sparks + Sekiro-style impact starburst in 1 draw call
//   - Zero per-frame heap allocations, dynamic lowSpec toggle without shader recompilation, 0 WebGL leaks

import * as THREE from '../../vendor/three.module.js';

// ============================================================================
// Public Style & Tier Constants
// ============================================================================
export const WEAPON_TRAIL_STYLES = Object.freeze({
  HERO_STEEL: 'hero_steel',
  HERO_HEAVY: 'hero_heavy',
  MOB_IRON: 'mob_iron',
  BOSS_EMBER: 'boss_ember',
  BOSS_EMBER_P2: 'boss_ember_p2'
});

export const CLASH_SPARK_TIERS = Object.freeze({
  LIGHT: 'light',
  BLOCK: 'block',
  PARRY: 'parry',
  HEAVY: 'heavy',
  STONE: 'stone',
  BOSS: 'boss'
});

// ============================================================================
// Internal Style & Spark Preset Tables
// ============================================================================
const STYLE_SPECS = Object.freeze({
  hero_steel: Object.freeze({
    id: 0,
    life: 0.24,
    intensity: 1.0,
    taper: 0.26,
    buoyancy: 0.04,
    widthPadTip: 0.03,
    widthPadBase: 0.0
  }),
  hero_heavy: Object.freeze({
    id: 1,
    life: 0.32,
    intensity: 1.22,
    taper: 0.20,
    buoyancy: 0.08,
    widthPadTip: 0.09,
    widthPadBase: -0.02
  }),
  mob_iron: Object.freeze({
    id: 2,
    life: 0.28,
    intensity: 1.05,
    taper: 0.28,
    buoyancy: 0.02,
    widthPadTip: 0.04,
    widthPadBase: 0.0
  }),
  boss_ember: Object.freeze({
    id: 3,
    life: 0.38,
    intensity: 1.0,
    taper: 0.16,
    buoyancy: 0.48,
    widthPadTip: 0.16,
    widthPadBase: -0.04
  }),
  boss_ember_p2: Object.freeze({
    id: 3,
    life: 0.46,
    intensity: 1.58,
    taper: 0.12,
    buoyancy: 0.72,
    widthPadTip: 0.24,
    widthPadBase: -0.06
  })
});

const CLASH_TIER_SPECS = Object.freeze({
  light: Object.freeze({
    countDesktop: 12,
    countMobile: 8,
    countLowSpec: 6,
    speedMin: 4.5,
    speedMax: 8.6,
    spreadRad: 0.72,
    upwardBias: 0.35,
    lifeMin: 0.20,
    lifeMax: 0.38,
    gravity: 15.0,
    drag: 1.8,
    restitution: 0.45,
    widthMin: 0.016,
    widthMax: 0.028,
    streakScale: 0.034,
    flashSize: 0.32,
    flashLife: 0.075,
    hotColor: [1.0, 0.98, 0.86],
    midColor: [1.0, 0.78, 0.32],
    coolColor: [0.92, 0.32, 0.06]
  }),
  block: Object.freeze({
    countDesktop: 22,
    countMobile: 14,
    countLowSpec: 10,
    speedMin: 5.5,
    speedMax: 11.2,
    spreadRad: 0.88,
    upwardBias: 0.42,
    lifeMin: 0.26,
    lifeMax: 0.50,
    gravity: 14.5,
    drag: 1.65,
    restitution: 0.50,
    widthMin: 0.020,
    widthMax: 0.034,
    streakScale: 0.040,
    flashSize: 0.52,
    flashLife: 0.095,
    hotColor: [1.0, 0.99, 0.92],
    midColor: [1.0, 0.80, 0.30],
    coolColor: [0.95, 0.34, 0.05]
  }),
  parry: Object.freeze({
    countDesktop: 40,
    countMobile: 24,
    countLowSpec: 16,
    speedMin: 6.8,
    speedMax: 15.2,
    spreadRad: 1.22,
    upwardBias: 0.52,
    lifeMin: 0.34,
    lifeMax: 0.68,
    gravity: 13.5,
    drag: 1.45,
    restitution: 0.56,
    widthMin: 0.022,
    widthMax: 0.042,
    streakScale: 0.046,
    flashSize: 0.92,
    flashLife: 0.135,
    hotColor: [1.0, 1.0, 0.96],
    midColor: [1.0, 0.88, 0.38],
    coolColor: [1.0, 0.46, 0.08]
  }),
  heavy: Object.freeze({
    countDesktop: 28,
    countMobile: 18,
    countLowSpec: 12,
    speedMin: 6.5,
    speedMax: 13.4,
    spreadRad: 0.62,
    upwardBias: 0.34,
    lifeMin: 0.28,
    lifeMax: 0.56,
    gravity: 14.0,
    drag: 1.5,
    restitution: 0.48,
    widthMin: 0.022,
    widthMax: 0.038,
    streakScale: 0.044,
    flashSize: 0.68,
    flashLife: 0.11,
    hotColor: [1.0, 0.97, 0.84],
    midColor: [1.0, 0.72, 0.18],
    coolColor: [0.96, 0.26, 0.04]
  }),
  stone: Object.freeze({
    countDesktop: 18,
    countMobile: 12,
    countLowSpec: 8,
    speedMin: 4.8,
    speedMax: 10.4,
    spreadRad: 1.05,
    upwardBias: 0.48,
    lifeMin: 0.24,
    lifeMax: 0.48,
    gravity: 16.0,
    drag: 1.55,
    restitution: 0.62,
    widthMin: 0.017,
    widthMax: 0.030,
    streakScale: 0.036,
    flashSize: 0.42,
    flashLife: 0.085,
    hotColor: [1.0, 0.95, 0.78],
    midColor: [1.0, 0.66, 0.22],
    coolColor: [0.85, 0.24, 0.05]
  }),
  boss: Object.freeze({
    countDesktop: 46,
    countMobile: 28,
    countLowSpec: 18,
    speedMin: 6.2,
    speedMax: 15.8,
    spreadRad: 1.32,
    upwardBias: 0.62,
    lifeMin: 0.40,
    lifeMax: 0.82,
    gravity: 13.0,
    drag: 1.25,
    restitution: 0.52,
    widthMin: 0.028,
    widthMax: 0.052,
    streakScale: 0.048,
    flashSize: 1.12,
    flashLife: 0.15,
    hotColor: [1.0, 0.94, 0.72],
    midColor: [1.0, 0.50, 0.08],
    coolColor: [0.78, 0.10, 0.02]
  })
});

// ============================================================================
// Constants & Helpers
// ============================================================================
const DEFAULT_MAX_RIBBONS = 6;
const RAW_SAMPLE_CAP = 24;
const MAX_CROSS_SECTIONS_DESKTOP = 56;
const MAX_CROSS_SECTIONS_MOBILE = 40;
const MAX_CROSS_SECTIONS_LOWSPEC = 26;

const MAX_SPARKS_DESKTOP = 192;
const MAX_SPARKS_MOBILE = 112;
const MAX_SPARKS_LOWSPEC = 64;

const STROKE_TIME_GAP_SEC = 0.095;
const STROKE_TELEPORT_DIST_SQ = 7.2; // > ~2.68m jump starts a clean stroke
const MIN_SAMPLE_MOVE_SQ = 0.00025;  // ~1.6cm movement dedup
const MIN_BLADE_LEN_SQ = 1e-6;

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

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function resolveStyleSpec(style, opts) {
  let key = 'hero_steel';
  if (typeof style === 'string') {
    const k = style.trim().toLowerCase();
    if (STYLE_SPECS[k]) key = k;
    else if (k === 'heavy' || k === 'r2' || k === 'guard_counter' || k === 'heavy_thrust') key = 'hero_heavy';
    else if (k === 'mob' || k === 'enemy' || k === 'crimson') key = 'mob_iron';
    else if (k === 'boss' || k === 'ember' || k === 'fire') key = 'boss_ember';
  }
  const baseSpec = STYLE_SPECS[key] || STYLE_SPECS.hero_steel;
  const isPhase2 = Boolean(opts && (opts.phase2 || opts.isPhase2));
  if (key === 'boss_ember' && isPhase2) {
    return STYLE_SPECS.boss_ember_p2;
  }
  return baseSpec;
}

function resolveClashTier(tier) {
  if (typeof tier === 'number') {
    if (tier <= 0) return CLASH_TIER_SPECS.light;
    if (tier === 1) return CLASH_TIER_SPECS.block;
    if (tier === 2) return CLASH_TIER_SPECS.parry;
    if (tier === 3) return CLASH_TIER_SPECS.heavy;
    if (tier === 4) return CLASH_TIER_SPECS.stone;
    return CLASH_TIER_SPECS.boss;
  }
  if (typeof tier === 'string') {
    const k = tier.trim().toLowerCase();
    if (CLASH_TIER_SPECS[k]) return CLASH_TIER_SPECS[k];
    if (k === 'guard' || k === 'shield' || k === 'deflect') return CLASH_TIER_SPECS.block;
    if (k === 'riposte' || k === 'stance_break' || k === 'perfect_parry') return CLASH_TIER_SPECS.parry;
    if (k === 'heavy_thrust' || k === 'guard_counter' || k === 'r2' || k === 'charged_r2') return CLASH_TIER_SPECS.heavy;
    if (k === 'wall' || k === 'ground' || k === 'masonry' || k === 'rock') return CLASH_TIER_SPECS.stone;
    if (k === 'boss_slam' || k === 'boss_ember' || k === 'slam') return CLASH_TIER_SPECS.boss;
    if (k === 'sword_armor' || k === 'r1' || k === 'chip') return CLASH_TIER_SPECS.light;
  }
  return CLASH_TIER_SPECS.block;
}

function readVec3Into(src, outArr, offset) {
  if (!src) return false;
  let x;
  let y;
  let z;
  if (typeof src.x === 'number') {
    x = src.x;
    y = src.y;
    z = src.z;
  } else if (Array.isArray(src) || ArrayBuffer.isView(src)) {
    x = src[0];
    y = src[1];
    z = src[2];
  } else {
    return false;
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false;
  outArr[offset] = x;
  outArr[offset + 1] = y;
  outArr[offset + 2] = z;
  return true;
}

function markAttrDirtyRange(attr, countFloats) {
  if (typeof attr.clearUpdateRanges === 'function') {
    attr.clearUpdateRanges();
    if (countFloats > 0) {
      attr.addUpdateRange(0, countFloats);
    }
  }
  attr.needsUpdate = true;
}

// ============================================================================
// Centripetal Catmull-Rom Evaluator (Barry-Goldman, alpha = 0.5, 0 allocations)
// Guarantees C1 continuity with ZERO cusps/loops even under 30 FPS or hitstop.
// ============================================================================
function evalCentripetalCR3(
  p0x, p0y, p0z,
  p1x, p1y, p1z,
  p2x, p2y, p2z,
  p3x, p3y, p3z,
  u,
  outArr,
  outOff
) {
  const d01 = Math.hypot(p1x - p0x, p1y - p0y, p1z - p0z);
  const d12 = Math.hypot(p2x - p1x, p2y - p1y, p2z - p1z);
  const d23 = Math.hypot(p3x - p2x, p3y - p2y, p3z - p2z);

  const dt01 = Math.sqrt(d01 > 1e-4 ? d01 : 1e-4);
  const dt12 = Math.sqrt(d12 > 1e-4 ? d12 : 1e-4);
  const dt23 = Math.sqrt(d23 > 1e-4 ? d23 : 1e-4);

  const t0 = 0.0;
  const t1 = dt01;
  const t2 = t1 + dt12;
  const t3 = t2 + dt23;
  const t = t1 + dt12 * u;

  const inv01 = 1.0 / dt01;
  const inv12 = 1.0 / dt12;
  const inv23 = 1.0 / dt23;
  const inv02 = 1.0 / (t2 - t0);
  const inv13 = 1.0 / (t3 - t1);

  const w0a = (t1 - t) * inv01;
  const w1a = (t - t0) * inv01;
  const a1x = w0a * p0x + w1a * p1x;
  const a1y = w0a * p0y + w1a * p1y;
  const a1z = w0a * p0z + w1a * p1z;

  const w1b = (t2 - t) * inv12;
  const w2b = (t - t1) * inv12;
  const a2x = w1b * p1x + w2b * p2x;
  const a2y = w1b * p1y + w2b * p2y;
  const a2z = w1b * p1z + w2b * p2z;

  const w2c = (t3 - t) * inv23;
  const w3c = (t - t2) * inv23;
  const a3x = w2c * p2x + w3c * p3x;
  const a3y = w2c * p2y + w3c * p3y;
  const a3z = w2c * p2z + w3c * p3z;

  const b1w0 = (t2 - t) * inv02;
  const b1w1 = (t - t0) * inv02;
  const b1x = b1w0 * a1x + b1w1 * a2x;
  const b1y = b1w0 * a1y + b1w1 * a2y;
  const b1z = b1w0 * a1z + b1w1 * a2z;

  const b2w0 = (t3 - t) * inv13;
  const b2w1 = (t - t1) * inv13;
  const b2x = b2w0 * a2x + b2w1 * a3x;
  const b2y = b2w0 * a2y + b2w1 * a3y;
  const b2z = b2w0 * a2z + b2w1 * a3z;

  outArr[outOff]     = w1b * b1x + w2b * b2x;
  outArr[outOff + 1] = w1b * b1y + w2b * b2y;
  outArr[outOff + 2] = w1b * b1z + w2b * b2z;
}

// ============================================================================
// GLSL Shaders — Unified 4-Style Swept Weapon Ribbon Material
// ============================================================================
const RIBBON_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aTrail; // x: along (0=head..1=tail), y: width (0=hilt..1=tip), z: life (0..1), w: speed
  attribute vec4 aStyle; // x: styleId (0..3), y: intensity, z: seed, w: arcU (world meters)

  varying vec4 vTrail;
  varying vec4 vStyle;

  void main() {
    vTrail = aTrail;
    vStyle = aStyle;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uLowSpec;

  varying vec4 vTrail;
  varying vec4 vStyle;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm2(vec2 p) {
    float n = vnoise(p);
    if (uLowSpec < 0.5) {
      n = n * 0.64 + vnoise(p * 2.17 + vec2(13.4, 7.1)) * 0.36;
    }
    return n;
  }

  vec3 softRolloff(vec3 c) {
    float peak = max(c.r, max(c.g, c.b));
    return c / (1.0 + peak * 0.24);
  }

  void main() {
    float along = clamp(vTrail.x, 0.0, 1.0);
    float w = clamp(vTrail.y, 0.0, 1.0);
    float life = clamp(vTrail.z, 0.0, 1.0);
    float speed = clamp(vTrail.w, 0.35, 1.50);

    float styleId = vStyle.x;
    float intensity = max(0.3, vStyle.y);
    float seed = vStyle.z;
    float arcU = vStyle.w;

    // Swept crescent leading-edge entry (blade tip leads, hilt sweeps smoothly behind — zero blunt cutoff!)
    float headIn = smoothstep(0.0, 0.045 + (1.0 - w) * 0.14, along);
    float lifeFade = pow(max(0.0, 1.0 - life), 1.32);
    float tailGeoFade = 1.0 - smoothstep(0.56, 1.0, along);
    float env = headIn * lifeFade * tailGeoFade;
    if (env <= 0.002) discard;

    // World-arc anchored turbulence so wisps stay physically locked in air where blade cut
    float scroll = uTime * 2.9;
    float nTurb = fbm2(vec2(arcU * 2.4 - scroll + seed, w * 3.6 + seed * 0.37));
    float nShear = vnoise(vec2(arcU * 1.15 - uTime * 1.6 + seed * 1.7, w * 12.5));

    vec3 darkCol = vec3(0.0);
    vec3 glowCol = vec3(0.0);
    float absorb = 0.0;

    if (styleId < 0.5) {
      // ------------------------------------------------------------------
      // 0: 'hero_steel' — Cold silvery-moonlight steel sheen + thin gold rim
      // ------------------------------------------------------------------
      float outerSoft = 1.0 - smoothstep(0.965, 1.0, w);
      float innerCut = smoothstep(0.10 + life * 0.32, 0.66, w + (nTurb - 0.5) * 0.22);
      float wisp = smoothstep(life * 0.56 - 0.14, life * 0.56 + 0.34, nTurb * 0.62 + w * 0.52);
      float bodyMask = innerCut * outerSoft * wisp * env;

      float steelBand = smoothstep(0.66, 0.87, w) * (1.0 - smoothstep(0.91, 0.97, w)) * env;
      float goldRim = smoothstep(0.875, 0.955, w) * (1.0 - smoothstep(0.975, 1.0, w)) * env;
      float streaks = 0.58 + 0.42 * smoothstep(0.28, 0.85, nShear);

      darkCol = vec3(0.10, 0.15, 0.25);
      absorb = bodyMask * 0.28;

      vec3 lunarSilver = vec3(0.54, 0.74, 1.00) * (0.48 + 0.52 * streaks);
      vec3 steelEdge = vec3(1.18, 1.30, 1.50) * (0.72 + 0.32 * speed);
      vec3 fineGold = vec3(1.85, 1.16, 0.22) * (0.88 + 0.36 * nShear);

      glowCol = (lunarSilver * bodyMask * 0.78
              + steelEdge * steelBand * 0.88
              + fineGold * goldRim * 1.38) * intensity * (0.72 + 0.34 * speed);

    } else if (styleId < 1.5) {
      // ------------------------------------------------------------------
      // 1: 'hero_heavy' — Incandescent molten-gold piercing Heavy / Counter
      // ------------------------------------------------------------------
      float outerSoft = 1.0 - smoothstep(0.95, 1.0, w);
      float innerCut = smoothstep(0.05 + life * 0.24, 0.52, w + (nTurb - 0.5) * 0.26);
      float wisp = smoothstep(life * 0.52 - 0.16, life * 0.52 + 0.36, nTurb * 0.68 + w * 0.46);
      float bodyMask = innerCut * outerSoft * wisp * env;

      float coreRidge = smoothstep(0.68, 0.92, w) * outerSoft * env;
      float headFlare = (1.0 - smoothstep(0.0, 0.34, along)) * smoothstep(0.40, 0.92, w) * outerSoft * env;
      float specks = smoothstep(0.75, 0.93, nTurb * nShear) * smoothstep(0.20, 0.95, w) * env;

      darkCol = vec3(0.32, 0.10, 0.02);
      absorb = bodyMask * 0.36;

      vec3 amberBody = mix(vec3(1.02, 0.36, 0.04), vec3(1.62, 0.94, 0.16), smoothstep(0.22, 0.84, w));
      vec3 moltenCore = vec3(2.05, 1.62, 0.68);
      vec3 sparkGold = vec3(2.1, 1.40, 0.35);

      glowCol = (amberBody * bodyMask * (0.85 + 0.38 * nShear)
              + moltenCore * (coreRidge * 0.88 + headFlare * 0.48)
              + sparkGold * specks * 0.95) * intensity * (0.76 + 0.32 * speed);

    } else if (styleId < 2.5) {
      // ------------------------------------------------------------------
      // 2: 'mob_iron' — Grim crimson-steel sinister enemy slash trajectory
      // ------------------------------------------------------------------
      float outerSoft = 1.0 - smoothstep(0.95, 1.0, w);
      float ragged = nTurb * 0.72 + nShear * 0.28;
      float innerCut = smoothstep(0.10 + life * 0.28, 0.58, w + (ragged - 0.5) * 0.30);
      float wisp = smoothstep(life * 0.55 - 0.12, life * 0.55 + 0.36, ragged * 0.70 + w * 0.44);
      float bodyMask = innerCut * outerSoft * wisp * env;

      float crimsonEdge = smoothstep(0.72, 0.94, w) * outerSoft * env;
      float ironGlint = smoothstep(0.87, 0.955, w) * (1.0 - smoothstep(0.97, 1.0, w))
                      * (1.0 - smoothstep(0.0, 0.42, along)) * env;

      // Strong smoky blood-iron shadow silhouette for unmistakable combat readability!
      darkCol = vec3(0.16, 0.015, 0.02);
      absorb = bodyMask * 0.54;

      vec3 bloodBody = vec3(0.98, 0.10, 0.08) * (0.62 + 0.55 * nShear);
      vec3 razorCrimson = vec3(1.52, 0.28, 0.10);
      vec3 coldIron = vec3(1.08, 0.84, 0.80);

      glowCol = (bloodBody * bodyMask * 0.92
              + razorCrimson * crimsonEdge * 0.95
              + coldIron * ironGlint * 0.95) * intensity * (0.76 + 0.32 * speed);

    } else {
      // ------------------------------------------------------------------
      // 3: 'boss_ember' — Thick blazing volcanic fire wake (+ Phase 2 boost)
      // ------------------------------------------------------------------
      float p2 = clamp((intensity - 1.0) * 1.65, 0.0, 1.0);
      float fireScroll = uTime * (4.1 + p2 * 1.9);
      float nFire = fbm2(vec2(arcU * 2.15 - fireScroll + seed, w * 3.1 - uTime * 1.55 + seed * 0.23));
      float nLick = vnoise(vec2(arcU * 4.8 - fireScroll * 1.25 + seed * 0.9, w * 6.4));

      float flameField = nFire * 0.62 + nLick * 0.38;
      float jaggedOuter = 1.0 - smoothstep(0.82 - p2 * 0.04, 1.0, w + (0.5 - flameField) * 0.28);
      float flameMask = smoothstep(0.16 + life * 0.44, 0.58 + life * 0.24, flameField * 0.78 + w * (0.46 + p2 * 0.14))
                      * jaggedOuter * env;

      // Charred smoky crimson border keeps tongues of fire sharp & volumetric (never white washout)
      float smokeRim = smoothstep(0.06 + life * 0.34, 0.46 + life * 0.22, flameField * 0.74 + w * 0.40)
                     * jaggedOuter * env;
      darkCol = vec3(0.24, 0.025, 0.008);
      absorb = smokeRim * (0.58 - p2 * 0.06);

      float headHeat = (1.0 - smoothstep(0.0, 0.42, along)) * 0.24;
      float heat = clamp(w * 0.66 + flameField * 0.42 - life * 0.48 + headHeat + p2 * 0.20, 0.0, 1.0);
      vec3 magmaRed = vec3(0.98, 0.11, 0.015);
      vec3 blazeOrange = vec3(1.68, 0.42, 0.03);
      vec3 furnaceGold = vec3(2.05, 1.18, 0.22);
      vec3 whiteCore = vec3(2.35, 1.88, 1.02);

      vec3 fireCol = mix(magmaRed, blazeOrange, smoothstep(0.14, 0.54, heat));
      fireCol = mix(fireCol, furnaceGold, smoothstep(0.56, 0.86, heat));
      fireCol = mix(fireCol, whiteCore, smoothstep(0.86, 1.0, heat) * (0.35 + 0.65 * p2));

      float coreEdge = smoothstep(0.74, 0.94, w) * jaggedOuter * (1.0 - life * 0.55) * (0.65 + 0.35 * (1.0 - along)) * env;
      float emberSpecks = smoothstep(0.72 - p2 * 0.09, 0.91,
        vnoise(vec2(arcU * 8.5 - uTime * 3.5 + seed, w * 11.0 - uTime * 4.2))) * smokeRim;

      glowCol = (fireCol * flameMask * (0.94 + 0.34 * p2)
              + furnaceGold * coreEdge * (0.55 + 0.38 * p2)
              + vec3(2.25, 1.12, 0.20) * emberSpecks * (1.05 + 0.55 * p2)) * (0.80 + 0.26 * speed);
    }

    vec3 outRgb = softRolloff(darkCol * absorb + glowCol);
    float outAlpha = clamp(absorb, 0.0, 0.85);
    if (outAlpha < 0.004 && max(outRgb.r, max(outRgb.g, outRgb.b)) < 0.004) discard;

    gl_FragColor = vec4(outRgb, outAlpha);
  }
`;

// ============================================================================
// GLSL Shaders — Instanced Velocity-Stretched Metallic Clash Sparks + Starburst
// ============================================================================
const SPARK_VERTEX_SHADER = /* glsl */ `
  attribute vec4 iPosSize;   // xyz: world pos, w: width (or starburst size)
  attribute vec4 iVelLen;    // xyz: world velocity, w: streak length multiplier
  attribute vec4 iColorLife; // rgb: cooled HDR color, a: life01 (0..1)
  attribute vec2 iKind;      // x: 0=needle spark, 1=impact starburst flash; y: phase

  varying vec2 vUv;
  varying vec4 vColorLife;
  varying vec2 vKind;

  void main() {
    vec3 center = iPosSize.xyz;
    float baseSize = iPosSize.w;
    vec3 vel = iVelLen.xyz;
    float speed = length(vel);

    vec3 toCam = cameraPosition - center;
    float camDist = length(toCam);
    toCam = camDist > 1e-4 ? (toCam / camDist) : vec3(0.0, 0.0, 1.0);

    vec3 worldPos;
    if (iKind.x > 0.5) {
      // Camera-facing Sekiro/Elden Ring metallic clash starburst
      vec3 worldUp = abs(toCam.y) > 0.96 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 right = normalize(cross(worldUp, toCam));
      vec3 up = cross(toCam, right);
      // Slight deterministic rotation per impact flash using phase
      float ang = iKind.y * 6.2831853;
      float ca = cos(ang);
      float sa = sin(ang);
      vec3 rRot = right * ca - up * sa;
      vec3 uRot = right * sa + up * ca;
      float lx = position.x;        // [-0.5, 0.5]
      float ly = position.y + 0.5;  // [-0.5, 0.5]
      worldPos = center + (rRot * lx + uRot * ly) * baseSize;
      vUv = vec2(lx + 0.5, ly + 0.5);
    } else {
      // Camera-aligned velocity-stretched molten steel needle
      vec3 dir = speed > 0.04 ? (vel / speed) : vec3(0.0, 1.0, 0.0);
      vec3 side = cross(toCam, dir);
      float sideLen = length(side);
      if (sideLen < 0.002) {
        vec3 fallback = abs(toCam.y) > 0.94 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        side = normalize(cross(toCam, fallback));
        dir = normalize(cross(side, toCam));
      } else {
        side /= sideLen;
      }
      float streakLen = clamp(speed * iVelLen.w, baseSize * 1.65, 0.78);
      // position.x in [-0.5, 0.5], position.y in [-1.0, 0.0] (0=leading head, -1=trailing tail)
      worldPos = center + side * (position.x * baseSize) + dir * (position.y * streakLen);
      vUv = vec2(position.x + 0.5, -position.y); // u: [0..1] across width, v: [0=head..1=tail]
    }

    vColorLife = iColorLife;
    vKind = iKind;
    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const SPARK_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  varying vec2 vUv;
  varying vec4 vColorLife;
  varying vec2 vKind;

  void main() {
    float life = clamp(vColorLife.a, 0.0, 1.0);
    if (life >= 1.0) discard;

    vec3 col = vColorLife.rgb;
    float alpha = 0.0;

    if (vKind.x > 0.5) {
      // Crisp 4-point metallic clash starburst + hot core
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      if (r > 1.0) discard;

      float core = exp(-r * r * 14.0);
      // Primary horizontal & vertical clash spikes
      float rayX = exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 2.4);
      float rayY = exp(-abs(p.x) * 18.0) * exp(-abs(p.y) * 2.4);
      // Subtle 45-deg secondary spikes
      vec2 d = vec2(p.x + p.y, p.x - p.y) * 0.7071;
      float rayD = (exp(-abs(d.y) * 22.0) * exp(-abs(d.x) * 3.8)
                  + exp(-abs(d.x) * 22.0) * exp(-abs(d.y) * 3.8)) * 0.45;

      float fade = pow(1.0 - life, 1.85);
      float burst = (core * 1.45 + (rayX + rayY) * 0.95 + rayD) * fade;
      if (burst < 0.015) discard;
      vec3 outCol = mix(col, vec3(1.0, 1.0, 0.98), clamp(core * 0.75, 0.0, 1.0)) * burst * 1.35;
      gl_FragColor = vec4(outCol, 0.0);
    } else {
      // Tapered razor-sharp glowing metal spark needle
      float distX = abs(vUv.x - 0.5) * 2.0; // [0..1]
      float tAlong = clamp(vUv.y, 0.0, 1.0); // 0=hot head, 1=tapered tail
      float halfWidth = mix(0.95, 0.16, tAlong);
      float across = 1.0 - smoothstep(0.0, halfWidth, distX);
      float alongMask = (1.0 - smoothstep(0.0, 1.0, tAlong)) * smoothstep(0.0, 0.06, tAlong + 0.04);
      float headBoost = exp(-tAlong * 7.5) * (1.0 - smoothstep(0.0, 0.50, distX));
      float flicker = 0.84 + 0.16 * sin(uTime * 46.0 + vKind.y * 37.0);
      float fade = pow(1.0 - life, 1.15);

      alpha = (across * alongMask * 0.92 + headBoost * 0.75) * fade * flicker;
      if (alpha < 0.01) discard;

      // White-hot molten tip transitioning to vivid gold/amber/fiery-orange needle tail
      vec3 tailCol = col * mix(vec3(1.0, 0.95, 0.82), vec3(1.05, 0.48, 0.12), smoothstep(0.18, 0.88, tAlong));
      vec3 outCol = mix(tailCol, vec3(1.0, 0.99, 0.94), clamp(headBoost * 0.78 * (1.0 - life * 0.6), 0.0, 1.0)) * alpha * 1.35;
      gl_FragColor = vec4(outCol, 0.0);
    }
  }
`;

// ============================================================================
// Main Factory: createWeaponTrailSystem(scene, { isMobile, lowSpec })
// ============================================================================
export function createWeaponTrailSystem(scene, options = {}) {
  const isMobile =
    typeof options.isMobile === 'boolean' ? options.isMobile : detectMobileDevice();
  let lowSpec = Boolean(options.lowSpec);
  const maxRibbons = clamp(
    Number.isFinite(options.maxRibbons) ? Math.round(options.maxRibbons) : DEFAULT_MAX_RIBBONS,
    1,
    12
  );

  const maxCrossSectionsAlloc = isMobile
    ? MAX_CROSS_SECTIONS_MOBILE
    : MAX_CROSS_SECTIONS_DESKTOP;
  const maxVertsPerRibbon = maxCrossSectionsAlloc * 2;
  const totalMaxVerts = maxRibbons * maxVertsPerRibbon;
  const totalMaxIndices = maxRibbons * (maxCrossSectionsAlloc - 1) * 6;

  const sparkPoolAlloc = clamp(
    Number.isFinite(options.maxSparks)
      ? Math.round(options.maxSparks)
      : (isMobile ? MAX_SPARKS_MOBILE : MAX_SPARKS_DESKTOP),
    32,
    384
  );

  let disposed = false;
  let elapsedTime = 0.0;
  let ribbonDirty = false;
  let seedCounter = 1.0;

  // Deterministic lightweight PRNG for spark bursts (zero allocations)
  let rngState = 0x51a7c3d9;
  function rand01() {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  function getActiveCrossSectionBudget() {
    if (lowSpec) return Math.min(maxCrossSectionsAlloc, MAX_CROSS_SECTIONS_LOWSPEC);
    return isMobile ? MAX_CROSS_SECTIONS_MOBILE : MAX_CROSS_SECTIONS_DESKTOP;
  }

  function getActiveSparkCap() {
    if (lowSpec) return Math.min(sparkPoolAlloc, MAX_SPARKS_LOWSPEC);
    return sparkPoolAlloc;
  }

  // --------------------------------------------------------------------------
  // 1. Pre-allocated Ribbon Pool (6 concurrent actor slots, 0 frame allocs)
  // --------------------------------------------------------------------------
  function createRibbonSlot() {
    return {
      actorId: null,
      head: 0,
      count: 0,
      strokeId: 0,
      lastRecordTime: -100.0,
      lastStyleId: -1,
      strokeSeed: 0.0,
      cumulativeArc: 0.0,
      pendingBreak: false,
      // Pre-allocated Structure-of-Arrays ring buffer
      bx: new Float32Array(RAW_SAMPLE_CAP),
      by: new Float32Array(RAW_SAMPLE_CAP),
      bz: new Float32Array(RAW_SAMPLE_CAP),
      tx: new Float32Array(RAW_SAMPLE_CAP),
      ty: new Float32Array(RAW_SAMPLE_CAP),
      tz: new Float32Array(RAW_SAMPLE_CAP),
      age: new Float32Array(RAW_SAMPLE_CAP),
      maxLife: new Float32Array(RAW_SAMPLE_CAP),
      styleId: new Float32Array(RAW_SAMPLE_CAP),
      intensity: new Float32Array(RAW_SAMPLE_CAP),
      taper: new Float32Array(RAW_SAMPLE_CAP),
      buoyancy: new Float32Array(RAW_SAMPLE_CAP),
      speed: new Float32Array(RAW_SAMPLE_CAP),
      arcU: new Float32Array(RAW_SAMPLE_CAP),
      seed: new Float32Array(RAW_SAMPLE_CAP),
      stroke: new Int32Array(RAW_SAMPLE_CAP)
    };
  }

  const slots = new Array(maxRibbons);
  for (let i = 0; i < maxRibbons; i++) {
    slots[i] = createRibbonSlot();
  }
  const actorToSlot = new Map();

  // Unified Ribbon Geometry + ShaderMaterial (1 SINGLE draw call for all 6 ribbons!)
  const ribPosArr = new Float32Array(totalMaxVerts * 3);
  const ribTrailArr = new Float32Array(totalMaxVerts * 4);
  const ribStyleArr = new Float32Array(totalMaxVerts * 4);
  const ribIdxArr = new Uint16Array(totalMaxIndices);

  const ribPosAttr = new THREE.BufferAttribute(ribPosArr, 3);
  const ribTrailAttr = new THREE.BufferAttribute(ribTrailArr, 4);
  const ribStyleAttr = new THREE.BufferAttribute(ribStyleArr, 4);
  const ribIdxAttr = new THREE.BufferAttribute(ribIdxArr, 1);

  ribPosAttr.setUsage(THREE.DynamicDrawUsage);
  ribTrailAttr.setUsage(THREE.DynamicDrawUsage);
  ribStyleAttr.setUsage(THREE.DynamicDrawUsage);
  ribIdxAttr.setUsage(THREE.DynamicDrawUsage);

  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', ribPosAttr);
  ribbonGeo.setAttribute('aTrail', ribTrailAttr);
  ribbonGeo.setAttribute('aStyle', ribStyleAttr);
  ribbonGeo.setIndex(ribIdxAttr);
  ribbonGeo.setDrawRange(0, 0);

  const ribbonMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uLowSpec: { value: lowSpec ? 1.0 : 0.0 }
    },
    vertexShader: RIBBON_VERTEX_SHADER,
    fragmentShader: RIBBON_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });

  const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonMesh.name = 'SoulsWeaponTrailsRibbonPool';
  ribbonMesh.frustumCulled = false;
  ribbonMesh.renderOrder = 9;
  ribbonMesh.visible = false;

  if (scene && typeof scene.add === 'function') {
    scene.add(ribbonMesh);
  }

  // Scratch buffers for Catmull-Rom & input parsing (zero per-frame allocations)
  const _inBase = new Float32Array(3);
  const _inTip = new Float32Array(3);
  const _inPos = new Float32Array(3);
  const _inNorm = new Float32Array(3);
  const _crBase = new Float32Array(3);
  const _crTip = new Float32Array(3);
  const _segSubCounts = new Uint16Array(RAW_SAMPLE_CAP);

  let lastActiveRibbons = 0;
  let lastActiveTriangles = 0;

  // --------------------------------------------------------------------------
  // 2. Pre-allocated Instanced Clash Spark Pool (1 SINGLE draw call, 0 idle)
  // --------------------------------------------------------------------------
  const sparkBaseGeo = new THREE.InstancedBufferGeometry();
  // Unit quad: x in [-0.5, 0.5], y in [-1.0, 0.0]
  const quadPositions = new Float32Array([
    -0.5,  0.0, 0.0,
     0.5,  0.0, 0.0,
    -0.5, -1.0, 0.0,
     0.5, -1.0, 0.0
  ]);
  const quadIndices = new Uint16Array([0, 2, 1, 1, 2, 3]);
  sparkBaseGeo.setAttribute('position', new THREE.BufferAttribute(quadPositions, 3));
  sparkBaseGeo.setIndex(new THREE.BufferAttribute(quadIndices, 1));

  const spkPosSizeArr = new Float32Array(sparkPoolAlloc * 4);
  const spkVelLenArr = new Float32Array(sparkPoolAlloc * 4);
  const spkColorLifeArr = new Float32Array(sparkPoolAlloc * 4);
  const spkKindArr = new Float32Array(sparkPoolAlloc * 2);

  const spkPosSizeAttr = new THREE.InstancedBufferAttribute(spkPosSizeArr, 4);
  const spkVelLenAttr = new THREE.InstancedBufferAttribute(spkVelLenArr, 4);
  const spkColorLifeAttr = new THREE.InstancedBufferAttribute(spkColorLifeArr, 4);
  const spkKindAttr = new THREE.InstancedBufferAttribute(spkKindArr, 2);

  spkPosSizeAttr.setUsage(THREE.DynamicDrawUsage);
  spkVelLenAttr.setUsage(THREE.DynamicDrawUsage);
  spkColorLifeAttr.setUsage(THREE.DynamicDrawUsage);
  spkKindAttr.setUsage(THREE.DynamicDrawUsage);

  sparkBaseGeo.setAttribute('iPosSize', spkPosSizeAttr);
  sparkBaseGeo.setAttribute('iVelLen', spkVelLenAttr);
  sparkBaseGeo.setAttribute('iColorLife', spkColorLifeAttr);
  sparkBaseGeo.setAttribute('iKind', spkKindAttr);
  sparkBaseGeo.instanceCount = 0;

  // CPU simulation SoA for active sparks (swap-remove O(1))
  let activeSparkCount = 0;
  const spX = new Float32Array(sparkPoolAlloc);
  const spY = new Float32Array(sparkPoolAlloc);
  const spZ = new Float32Array(sparkPoolAlloc);
  const spVx = new Float32Array(sparkPoolAlloc);
  const spVy = new Float32Array(sparkPoolAlloc);
  const spVz = new Float32Array(sparkPoolAlloc);
  const spAge = new Float32Array(sparkPoolAlloc);
  const spMaxLife = new Float32Array(sparkPoolAlloc);
  const spSize = new Float32Array(sparkPoolAlloc);
  const spStreak = new Float32Array(sparkPoolAlloc);
  const spGrav = new Float32Array(sparkPoolAlloc);
  const spDrag = new Float32Array(sparkPoolAlloc);
  const spRest = new Float32Array(sparkPoolAlloc);
  const spFloorY = new Float32Array(sparkPoolAlloc);
  const spKind = new Uint8Array(sparkPoolAlloc); // 0 = needle spark, 1 = starburst flash
  const spPhase = new Float32Array(sparkPoolAlloc);
  // 3-stop cooling colors per spark
  const spHotR = new Float32Array(sparkPoolAlloc);
  const spHotG = new Float32Array(sparkPoolAlloc);
  const spHotB = new Float32Array(sparkPoolAlloc);
  const spMidR = new Float32Array(sparkPoolAlloc);
  const spMidG = new Float32Array(sparkPoolAlloc);
  const spMidB = new Float32Array(sparkPoolAlloc);
  const spCoolR = new Float32Array(sparkPoolAlloc);
  const spCoolG = new Float32Array(sparkPoolAlloc);
  const spCoolB = new Float32Array(sparkPoolAlloc);

  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uLowSpec: { value: lowSpec ? 1.0 : 0.0 }
    },
    vertexShader: SPARK_VERTEX_SHADER,
    fragmentShader: SPARK_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });

  const sparkMesh = new THREE.Mesh(sparkBaseGeo, sparkMat);
  sparkMesh.name = 'SoulsWeaponClashSparksPool';
  sparkMesh.frustumCulled = false;
  sparkMesh.renderOrder = 10;
  sparkMesh.visible = false;

  if (scene && typeof scene.add === 'function') {
    scene.add(sparkMesh);
  }

  // --------------------------------------------------------------------------
  // Slot Allocation & Eviction (Strict 6-Ribbon Pool)
  // --------------------------------------------------------------------------
  function resetSlot(slot) {
    if (slot.actorId !== null && actorToSlot.get(slot.actorId) === slot) {
      actorToSlot.delete(slot.actorId);
    }
    slot.actorId = null;
    slot.head = 0;
    slot.count = 0;
    slot.lastRecordTime = -100.0;
    slot.lastStyleId = -1;
    slot.cumulativeArc = 0.0;
    slot.pendingBreak = false;
  }

  function acquireSlot(actorId) {
    const existing = actorToSlot.get(actorId);
    if (existing) return existing;

    // 1. Prefer completely empty slot
    for (let i = 0; i < maxRibbons; i++) {
      if (slots[i].count === 0) {
        resetSlot(slots[i]);
        slots[i].actorId = actorId;
        actorToSlot.set(actorId, slots[i]);
        return slots[i];
      }
    }

    // 2. Evict stalest slot (preferring non-hero/non-boss if busy)
    let victim = slots[0];
    let bestScore = Infinity;
    for (let i = 0; i < maxRibbons; i++) {
      const s = slots[i];
      // Higher priority penalty keeps hero/boss ribbons alive over generic mobs
      const priorityBonus =
        s.lastStyleId === 0 || s.lastStyleId === 1 || s.lastStyleId === 3 ? 10.0 : 0.0;
      const score = s.lastRecordTime + priorityBonus;
      if (score < bestScore) {
        bestScore = score;
        victim = s;
      }
    }
    resetSlot(victim);
    victim.actorId = actorId;
    actorToSlot.set(actorId, victim);
    return victim;
  }

  // --------------------------------------------------------------------------
  // Public API: recordBladeSegment & recordWeaponSegment & endSwing
  // --------------------------------------------------------------------------
  function recordBladeSegment(actorId, baseWorldVec3, tipWorldVec3, style = 'hero_steel', opts = null) {
    if (disposed || actorId === null || actorId === undefined) return false;

    // Support direct pass-through of getWeaponSegmentWorld() object: { hiltX, hiltY, hiltZ, tipX, tipY, tipZ }
    let effStyle = style;
    let effOpts = opts;
    if (
      baseWorldVec3 &&
      typeof baseWorldVec3.hiltX === 'number' &&
      typeof baseWorldVec3.tipX === 'number' &&
      (typeof tipWorldVec3 === 'string' || tipWorldVec3 === null || tipWorldVec3 === undefined)
    ) {
      if (
        !Number.isFinite(baseWorldVec3.hiltX) ||
        !Number.isFinite(baseWorldVec3.hiltY) ||
        !Number.isFinite(baseWorldVec3.hiltZ) ||
        !Number.isFinite(baseWorldVec3.tipX) ||
        !Number.isFinite(baseWorldVec3.tipY) ||
        !Number.isFinite(baseWorldVec3.tipZ)
      ) {
        return false;
      }
      _inBase[0] = baseWorldVec3.hiltX;
      _inBase[1] = baseWorldVec3.hiltY;
      _inBase[2] = baseWorldVec3.hiltZ;
      _inTip[0] = baseWorldVec3.tipX;
      _inTip[1] = baseWorldVec3.tipY;
      _inTip[2] = baseWorldVec3.tipZ;
      effStyle = typeof tipWorldVec3 === 'string' ? tipWorldVec3 : 'hero_steel';
      effOpts = typeof style === 'object' && style !== null ? style : opts;
    } else {
      if (!readVec3Into(baseWorldVec3, _inBase, 0)) return false;
      if (!readVec3Into(tipWorldVec3, _inTip, 0)) return false;
    }

    // Validate non-degenerate blade segment and apply optional subtle style width padding
    let bx = _inBase[0];
    let by = _inBase[1];
    let bz = _inBase[2];
    let tx = _inTip[0];
    let ty = _inTip[1];
    let tz = _inTip[2];

    const dx = tx - bx;
    const dy = ty - by;
    const dz = tz - bz;
    const bladeLenSq = dx * dx + dy * dy + dz * dz;
    if (bladeLenSq < MIN_BLADE_LEN_SQ) return false;

    const spec = resolveStyleSpec(effStyle, effOpts);
    const bladeLen = Math.sqrt(bladeLenSq);
    const invLen = 1.0 / bladeLen;
    const widthScale =
      effOpts && Number.isFinite(effOpts.widthScale) ? clamp(effOpts.widthScale, 0.35, 2.2) : 1.0;
    const padTip = spec.widthPadTip * widthScale;
    const padBase = spec.widthPadBase * widthScale;

    if (padTip !== 0.0 || padBase !== 0.0) {
      const ux = dx * invLen;
      const uy = dy * invLen;
      const uz = dz * invLen;
      bx += ux * padBase;
      by += uy * padBase;
      bz += uz * padBase;
      tx += ux * padTip;
      ty += uy * padTip;
      tz += uz * padTip;
    }

    const slot = acquireSlot(actorId);
    const dtSinceLast = elapsedTime - slot.lastRecordTime;

    let startNewStroke =
      slot.count === 0 ||
      slot.pendingBreak ||
      dtSinceLast > STROKE_TIME_GAP_SEC ||
      slot.lastStyleId !== spec.id;

    let tipMoveDist = 0.0;
    let speedNorm = 0.85;

    if (!startNewStroke && slot.count > 0) {
      const lastPhys = (slot.head + slot.count - 1) % RAW_SAMPLE_CAP;
      const dbx = bx - slot.bx[lastPhys];
      const dby = by - slot.by[lastPhys];
      const dbz = bz - slot.bz[lastPhys];
      const dtx = tx - slot.tx[lastPhys];
      const dty = ty - slot.ty[lastPhys];
      const dtz = tz - slot.tz[lastPhys];
      const baseMoveSq = dbx * dbx + dby * dby + dbz * dbz;
      const tipMoveSq = dtx * dtx + dty * dty + dtz * dtz;

      // Teleport discontinuity guard
      if (baseMoveSq > STROKE_TELEPORT_DIST_SQ || tipMoveSq > STROKE_TELEPORT_DIST_SQ * 2.2) {
        startNewStroke = true;
      } else if (baseMoveSq < MIN_SAMPLE_MOVE_SQ && tipMoveSq < MIN_SAMPLE_MOVE_SQ) {
        // Stationary / hitstop freeze frame: refresh newest point gently without stacking duplicate knots
        slot.age[lastPhys] = Math.min(slot.age[lastPhys], 0.012);
        slot.lastRecordTime = elapsedTime;
        ribbonDirty = true;
        return true;
      } else {
        tipMoveDist = Math.sqrt(tipMoveSq);
        const effDt = dtSinceLast > 0.004 ? dtSinceLast : 0.016;
        // ~12 m/s blade tip speed -> speedNorm ~ 1.0
        speedNorm = clamp((tipMoveDist / effDt) / 11.5, 0.35, 1.5);
      }
    }

    if (startNewStroke) {
      slot.strokeId += 1;
      seedCounter = (seedCounter + 17.31) % 997.0;
      slot.strokeSeed = seedCounter;
      slot.cumulativeArc = 0.0;
      slot.pendingBreak = false;
      speedNorm = 0.85;
    } else {
      slot.cumulativeArc += tipMoveDist;
    }

    // Ring buffer insertion
    let writePhys;
    if (slot.count >= RAW_SAMPLE_CAP) {
      writePhys = slot.head;
      slot.head = (slot.head + 1) % RAW_SAMPLE_CAP;
    } else {
      writePhys = (slot.head + slot.count) % RAW_SAMPLE_CAP;
      slot.count += 1;
    }

    const lifeOverride =
      effOpts && Number.isFinite(effOpts.life) ? clamp(effOpts.life, 0.08, 1.2) : spec.life;
    const intensityOverride =
      effOpts && Number.isFinite(effOpts.intensity)
        ? clamp(effOpts.intensity, 0.2, 2.5)
        : spec.intensity;

    slot.bx[writePhys] = bx;
    slot.by[writePhys] = by;
    slot.bz[writePhys] = bz;
    slot.tx[writePhys] = tx;
    slot.ty[writePhys] = ty;
    slot.tz[writePhys] = tz;
    slot.age[writePhys] = 0.0;
    slot.maxLife[writePhys] = lifeOverride;
    slot.styleId[writePhys] = spec.id;
    slot.intensity[writePhys] = intensityOverride;
    slot.taper[writePhys] = spec.taper;
    slot.buoyancy[writePhys] = spec.buoyancy;
    slot.speed[writePhys] = speedNorm;
    slot.arcU[writePhys] = slot.cumulativeArc;
    slot.seed[writePhys] = slot.strokeSeed;
    slot.stroke[writePhys] = slot.strokeId;

    slot.lastRecordTime = elapsedTime;
    slot.lastStyleId = spec.id;
    ribbonDirty = true;
    return true;
  }

  function recordWeaponSegment(actorId, seg, style = 'hero_steel', opts = null) {
    if (!seg) return false;
    return recordBladeSegment(actorId, seg, style, opts);
  }

  function endSwing(actorId) {
    if (disposed || actorId === null || actorId === undefined) return;
    const slot = actorToSlot.get(actorId);
    if (slot) {
      slot.pendingBreak = true;
    }
  }

  // --------------------------------------------------------------------------
  // Ribbon Geometry Builder (Centripetal Catmull-Rom + Arc-Preserving Blade)
  // --------------------------------------------------------------------------
  function rebuildRibbonGeometry() {
    const crossBudget = getActiveCrossSectionBudget();
    const maxSubPerSeg = lowSpec ? 3 : isMobile ? 4 : 6;

    let vCursor = 0;
    let iCursor = 0;
    let activeRibbonCount = 0;

    for (let sIdx = 0; sIdx < maxRibbons; sIdx++) {
      const slot = slots[sIdx];
      const count = slot.count;
      if (count < 2) continue;

      let ribbonHasQuads = false;
      let ribbonSectionsUsed = 0;

      // Count total valid stroke samples in this slot so multi-stroke combo tails share budget fairly
      let totalValidSamples = 0;
      {
        let scan = 0;
        while (scan < count) {
          const st = slot.stroke[(slot.head + scan) % RAW_SAMPLE_CAP];
          let end = scan + 1;
          while (end < count && slot.stroke[(slot.head + end) % RAW_SAMPLE_CAP] === st) {
            end++;
          }
          if (end - scan >= 2) totalValidSamples += (end - scan);
          scan = end;
        }
      }

      // Partition ring buffer into contiguous stroke runs (prevents stretched polygon bridges across combo swings)
      let runStart = 0;
      let remainingValidSamples = totalValidSamples;
      while (runStart < count) {
        const physStart = (slot.head + runStart) % RAW_SAMPLE_CAP;
        const curStroke = slot.stroke[physStart];
        let runEnd = runStart + 1;
        while (
          runEnd < count &&
          slot.stroke[(slot.head + runEnd) % RAW_SAMPLE_CAP] === curStroke
        ) {
          runEnd++;
        }

        const rawRunLen = runEnd - runStart;
        let effRunStart = runStart;
        let runLen = rawRunLen;
        const remainingBudget = crossBudget - ribbonSectionsUsed;

        if (runLen >= 2 && remainingBudget >= 2) {
          // Fair proportional share of cross-section budget across active strokes in the same slot
          const otherSamples = Math.max(0, remainingValidSamples - runLen);
          const maxBudgetForRun = Math.max(2, remainingBudget - otherSamples);
          const fairShare = remainingValidSamples > 0
            ? Math.round((remainingBudget * runLen) / remainingValidSamples)
            : remainingBudget;
          const runBudget = clamp(Math.max(runLen, fairShare), 2, maxBudgetForRun);

          // If raw run exceeds allowed budget, keep the newest (leading-edge) points of the stroke
          if (runLen > runBudget) {
            effRunStart = runEnd - runBudget;
            runLen = runBudget;
          }

          const segCount = runLen - 1;
          let totalSubs = 0;

          // Adaptive subdivision count per raw segment based on tip displacement & angular sweep
          for (let j = 0; j < segCount; j++) {
            const pA = (slot.head + effRunStart + j) % RAW_SAMPLE_CAP;
            const pB = (slot.head + effRunStart + j + 1) % RAW_SAMPLE_CAP;

            const dtx = slot.tx[pB] - slot.tx[pA];
            const dty = slot.ty[pB] - slot.ty[pA];
            const dtz = slot.tz[pB] - slot.tz[pA];
            const tipStep = Math.hypot(dtx, dty, dtz);

            // Blade direction dot product to detect fast 30 FPS angular sweeps
            const bAx = slot.tx[pA] - slot.bx[pA];
            const bAy = slot.ty[pA] - slot.by[pA];
            const bAz = slot.tz[pA] - slot.bz[pA];
            const bBx = slot.tx[pB] - slot.bx[pB];
            const bBy = slot.ty[pB] - slot.by[pB];
            const bBz = slot.tz[pB] - slot.bz[pB];
            const lenA = Math.hypot(bAx, bAy, bAz) || 1.0;
            const lenB = Math.hypot(bBx, bBy, bBz) || 1.0;
            const cosAng = clamp((bAx * bBx + bAy * bBy + bAz * bBz) / (lenA * lenB), -1.0, 1.0);
            const angSweep = Math.acos(cosAng);

            const subsDist = Math.ceil(tipStep / (lowSpec ? 0.28 : 0.16));
            const subsAng = Math.ceil(angSweep / (lowSpec ? 0.24 : 0.13));
            const subs = clamp(Math.max(1, subsDist, subsAng), 1, maxSubPerSeg);
            _segSubCounts[j] = subs;
            totalSubs += subs;
          }

          // Scale down subdivisions proportionally if stroke exceeds its fair section budget
          const maxAllowedSubs = Math.max(segCount, runBudget - 1);
          if (totalSubs > maxAllowedSubs) {
            const ratio = maxAllowedSubs / totalSubs;
            totalSubs = 0;
            for (let j = 0; j < segCount; j++) {
              const scaled = Math.max(1, Math.floor(_segSubCounts[j] * ratio));
              _segSubCounts[j] = scaled;
              totalSubs += scaled;
            }
            while (totalSubs > maxAllowedSubs) {
              let reduced = false;
              for (let j = 0; j < segCount && totalSubs > maxAllowedSubs; j++) {
                if (_segSubCounts[j] > 1) {
                  _segSubCounts[j] -= 1;
                  totalSubs -= 1;
                  reduced = true;
                }
              }
              if (!reduced) break;
            }
          }

          const totalSectionsInRun = totalSubs + 1;
          const runBaseVertex = vCursor;
          let emittedInRun = 0;

          for (let j = 0; j < segCount; j++) {
            const idx1 = effRunStart + j;
            const idx2 = idx1 + 1;
            const p1 = (slot.head + idx1) % RAW_SAMPLE_CAP;
            const p2 = (slot.head + idx2) % RAW_SAMPLE_CAP;

            const hasPrev = j > 0;
            const hasNext = j + 1 < segCount;
            const p0 = hasPrev ? (slot.head + idx1 - 1) % RAW_SAMPLE_CAP : p1;
            const p3 = hasNext ? (slot.head + idx2 + 1) % RAW_SAMPLE_CAP : p2;

            // Natural mirrored phantom endpoints for crisp tangents at blade head & tail tip
            const b1x = slot.bx[p1], b1y = slot.by[p1], b1z = slot.bz[p1];
            const b2x = slot.bx[p2], b2y = slot.by[p2], b2z = slot.bz[p2];
            const b0x = hasPrev ? slot.bx[p0] : (2.0 * b1x - b2x);
            const b0y = hasPrev ? slot.by[p0] : (2.0 * b1y - b2y);
            const b0z = hasPrev ? slot.bz[p0] : (2.0 * b1z - b2z);
            const b3x = hasNext ? slot.bx[p3] : (2.0 * b2x - b1x);
            const b3y = hasNext ? slot.by[p3] : (2.0 * b2y - b1y);
            const b3z = hasNext ? slot.bz[p3] : (2.0 * b2z - b1z);

            const t1x = slot.tx[p1], t1y = slot.ty[p1], t1z = slot.tz[p1];
            const t2x = slot.tx[p2], t2y = slot.ty[p2], t2z = slot.tz[p2];
            const t0x = hasPrev ? slot.tx[p0] : (2.0 * t1x - t2x);
            const t0y = hasPrev ? slot.ty[p0] : (2.0 * t1y - t2y);
            const t0z = hasPrev ? slot.tz[p0] : (2.0 * t1z - t2z);
            const t3x = hasNext ? slot.tx[p3] : (2.0 * t2x - t1x);
            const t3y = hasNext ? slot.ty[p3] : (2.0 * t2y - t1y);
            const t3z = hasNext ? slot.tz[p3] : (2.0 * t2z - t1z);

            const len1 = Math.hypot(t1x - b1x, t1y - b1y, t1z - b1z);
            const len2 = Math.hypot(t2x - b2x, t2y - b2y, t2z - b2z);

            const life1 = clamp(slot.age[p1] / slot.maxLife[p1], 0.0, 1.0);
            const life2 = clamp(slot.age[p2] / slot.maxLife[p2], 0.0, 1.0);
            const spd1 = slot.speed[p1];
            const spd2 = slot.speed[p2];
            const arc1 = slot.arcU[p1];
            const arc2 = slot.arcU[p2];
            const sty = slot.styleId[p2];
            const inten1 = slot.intensity[p1];
            const inten2 = slot.intensity[p2];
            const taper1 = slot.taper[p1];
            const taper2 = slot.taper[p2];
            const buoy1 = slot.buoyancy[p1];
            const buoy2 = slot.buoyancy[p2];
            const seed = slot.seed[p2];

            const subs = _segSubCounts[j];
            const kEnd = j === segCount - 1 ? subs : subs - 1;

            for (let k = 0; k <= kEnd; k++) {
              if (vCursor + 2 > totalMaxVerts) break;
              const u = k / subs;

              evalCentripetalCR3(b0x, b0y, b0z, b1x, b1y, b1z, b2x, b2y, b2z, b3x, b3y, b3z, u, _crBase, 0);
              evalCentripetalCR3(t0x, t0y, t0z, t1x, t1y, t1z, t2x, t2y, t2z, t3x, t3y, t3z, u, _crTip, 0);

              let bx = _crBase[0];
              let by = _crBase[1];
              let bz = _crBase[2];
              let tx = _crTip[0];
              let ty = _crTip[1];
              let tz = _crTip[2];

              // Preserve true rigid blade length across sharp 30 FPS circular swings (zero chord pinching!)
              const targetLen = len1 + (len2 - len1) * u;
              let bdx = tx - bx;
              let bdy = ty - by;
              let bdz = tz - bz;
              const curLenSq = bdx * bdx + bdy * bdy + bdz * bdz;
              if (curLenSq > MIN_BLADE_LEN_SQ) {
                const scale = targetLen / Math.sqrt(curLenSq);
                bdx *= scale;
                bdy *= scale;
                bdz *= scale;
                tx = bx + bdx;
                ty = by + bdy;
                tz = bz + bdz;
              }

              const life = life1 + (life2 - life1) * u;
              // along: 0.0 at newest blade leading edge (emittedInRun = totalSectionsInRun - 1), 1.0 at tail tip (0)
              const along = totalSectionsInRun > 1
                ? 1.0 - emittedInRun / (totalSectionsInRun - 1)
                : 0.0;
              const speed = spd1 + (spd2 - spd1) * u;
              const arcU = arc1 + (arc2 - arc1) * u;
              const inten = inten1 + (inten2 - inten1) * u;
              const taperAmt = (taper1 + (taper2 - taper1) * u) * life * life;
              const riseY = (buoy1 + (buoy2 - buoy1) * u) * life * life;

              // Crescent scythe taper: inner hilt edge drifts smoothly toward blade tip as trail ages
              if (taperAmt > 1e-4) {
                bx += bdx * taperAmt;
                by += bdy * taperAmt;
                bz += bdz * taperAmt;
              }
              // Thermal buoyancy rise (makes Boss flame wake curl organically upward!)
              if (riseY > 1e-4) {
                by += riseY * 0.55;
                ty += riseY;
              }

              // Emit base vertex (vWidth = 0)
              const pOff0 = vCursor * 3;
              const aOff0 = vCursor * 4;
              ribPosArr[pOff0] = bx;
              ribPosArr[pOff0 + 1] = by;
              ribPosArr[pOff0 + 2] = bz;
              ribTrailArr[aOff0] = along;
              ribTrailArr[aOff0 + 1] = 0.0;
              ribTrailArr[aOff0 + 2] = life;
              ribTrailArr[aOff0 + 3] = speed;
              ribStyleArr[aOff0] = sty;
              ribStyleArr[aOff0 + 1] = inten;
              ribStyleArr[aOff0 + 2] = seed;
              ribStyleArr[aOff0 + 3] = arcU;

              // Emit tip vertex (vWidth = 1)
              const pOff1 = pOff0 + 3;
              const aOff1 = aOff0 + 4;
              ribPosArr[pOff1] = tx;
              ribPosArr[pOff1 + 1] = ty;
              ribPosArr[pOff1 + 2] = tz;
              ribTrailArr[aOff1] = along;
              ribTrailArr[aOff1 + 1] = 1.0;
              ribTrailArr[aOff1 + 2] = life;
              ribTrailArr[aOff1 + 3] = speed;
              ribStyleArr[aOff1] = sty;
              ribStyleArr[aOff1 + 1] = inten;
              ribStyleArr[aOff1 + 2] = seed;
              ribStyleArr[aOff1 + 3] = arcU;

              vCursor += 2;
              emittedInRun += 1;
              ribbonSectionsUsed += 1;
            }
          }

          // Emit triangle strip indices for this contiguous stroke
          if (emittedInRun >= 2) {
            for (let q = 0; q < emittedInRun - 1; q++) {
              if (iCursor + 6 > totalMaxIndices) break;
              const b0 = runBaseVertex + q * 2;
              const t0 = b0 + 1;
              const b1 = b0 + 2;
              const t1 = b0 + 3;
              ribIdxArr[iCursor] = b0;
              ribIdxArr[iCursor + 1] = t0;
              ribIdxArr[iCursor + 2] = b1;
              ribIdxArr[iCursor + 3] = t0;
              ribIdxArr[iCursor + 4] = t1;
              ribIdxArr[iCursor + 5] = b1;
              iCursor += 6;
            }
            ribbonHasQuads = true;
          }
        }

        if (rawRunLen >= 2) {
          remainingValidSamples -= rawRunLen;
        }
        runStart = runEnd;
      }

      if (ribbonHasQuads) {
        activeRibbonCount += 1;
      }
    }

    lastActiveRibbons = activeRibbonCount;
    lastActiveTriangles = iCursor / 3;

    if (iCursor === 0) {
      ribbonMesh.visible = false;
      ribbonGeo.setDrawRange(0, 0);
    } else {
      ribbonMesh.visible = true;
      ribbonGeo.setDrawRange(0, iCursor);
      markAttrDirtyRange(ribPosAttr, vCursor * 3);
      markAttrDirtyRange(ribTrailAttr, vCursor * 4);
      markAttrDirtyRange(ribStyleAttr, vCursor * 4);
      markAttrDirtyRange(ribIdxAttr, iCursor);
    }
    ribbonDirty = false;
  }

  // --------------------------------------------------------------------------
  // Public API: spawnClashSparks(pos, normalDir, tier, opts)
  // --------------------------------------------------------------------------
  function allocateSparkSlot(cap) {
    if (activeSparkCount < cap) {
      const idx = activeSparkCount;
      activeSparkCount += 1;
      return idx;
    }
    // Pool full: recycle oldest non-flash spark (or oldest overall)
    let bestIdx = 0;
    let maxNormAge = -1.0;
    for (let i = 0; i < activeSparkCount; i++) {
      const normAge = spAge[i] / (spMaxLife[i] || 0.1) + (spKind[i] === 0 ? 0.15 : 0.0);
      if (normAge > maxNormAge) {
        maxNormAge = normAge;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function spawnClashSparks(pos, normalDir = null, tier = 'block', opts = null) {
    if (disposed) return 0;
    if (!readVec3Into(pos, _inPos, 0)) return 0;

    // Build orthonormal tangent basis around impact normalDir (fallback: +Y)
    let nx = 0.0;
    let ny = 1.0;
    let nz = 0.0;
    if (readVec3Into(normalDir, _inNorm, 0)) {
      const nLen = Math.hypot(_inNorm[0], _inNorm[1], _inNorm[2]);
      if (nLen > 1e-4) {
        nx = _inNorm[0] / nLen;
        ny = _inNorm[1] / nLen;
        nz = _inNorm[2] / nLen;
      }
    }

    // Orthonormal tangent vectors (t1, t2) perpendicular to (nx, ny, nz)
    const refX = Math.abs(ny) > 0.92 ? 1.0 : 0.0;
    const refY = Math.abs(ny) > 0.92 ? 0.0 : 1.0;
    const refZ = 0.0;
    let t1x = refY * nz - refZ * ny;
    let t1y = refZ * nx - refX * nz;
    let t1z = refX * ny - refY * nx;
    const t1Len = Math.hypot(t1x, t1y, t1z) || 1.0;
    t1x /= t1Len;
    t1y /= t1Len;
    t1z /= t1Len;
    const t2x = ny * t1z - nz * t1y;
    const t2y = nz * t1x - nx * t1z;
    const t2z = nx * t1y - ny * t1x;

    const spec = resolveClashTier(tier);
    const cap = getActiveSparkCap();
    const countScale =
      opts && Number.isFinite(opts.countScale) ? clamp(opts.countScale, 0.25, 2.0) : 1.0;
    const floorY = opts && Number.isFinite(opts.floorY) ? opts.floorY : 0.035;
    const baseCount = lowSpec
      ? spec.countLowSpec
      : isMobile
        ? spec.countMobile
        : spec.countDesktop;
    const sparkCount = clamp(Math.round(baseCount * countScale), 3, cap - 1);

    const px = _inPos[0];
    const py = _inPos[1];
    const pz = _inPos[2];
    const hot = spec.hotColor;
    const mid = spec.midColor;
    const cool = spec.coolColor;

    let spawned = 0;

    // 1. Spawn point-of-contact metallic starburst flash
    {
      const fi = allocateSparkSlot(cap);
      spX[fi] = px + nx * 0.03;
      spY[fi] = py + ny * 0.03;
      spZ[fi] = pz + nz * 0.03;
      spVx[fi] = 0.0;
      spVy[fi] = 0.0;
      spVz[fi] = 0.0;
      spAge[fi] = 0.0;
      spMaxLife[fi] = spec.flashLife;
      spSize[fi] = spec.flashSize * (0.90 + rand01() * 0.24);
      spStreak[fi] = 0.0;
      spGrav[fi] = 0.0;
      spDrag[fi] = 0.0;
      spRest[fi] = 0.0;
      spFloorY[fi] = floorY;
      spKind[fi] = 1;
      spPhase[fi] = rand01();
      spHotR[fi] = hot[0]; spHotG[fi] = hot[1]; spHotB[fi] = hot[2];
      spMidR[fi] = mid[0]; spMidG[fi] = mid[1]; spMidB[fi] = mid[2];
      spCoolR[fi] = cool[0]; spCoolG[fi] = cool[1]; spCoolB[fi] = cool[2];
      spawned += 1;
    }

    // 2. Spawn physical ballistic metallic ricochet needles
    for (let i = 0; i < sparkCount; i++) {
      const idx = allocateSparkSlot(cap);
      // Cone + tangential steel ricochet spray
      const phi = rand01() * Math.PI * 2.0;
      // Bias slightly toward rim of cone for dramatic fan silhouette
      const theta = Math.pow(rand01(), 0.65) * spec.spreadRad;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);

      let dx = nx * cosT + (t1x * cosP + t2x * sinP) * sinT;
      let dy = ny * cosT + (t1y * cosP + t2y * sinP) * sinT + spec.upwardBias * (0.35 + rand01() * 0.65);
      let dz = nz * cosT + (t1z * cosP + t2z * sinP) * sinT;
      const dLen = Math.hypot(dx, dy, dz) || 1.0;
      dx /= dLen;
      dy /= dLen;
      dz /= dLen;

      const spd = spec.speedMin + Math.pow(rand01(), 0.78) * (spec.speedMax - spec.speedMin);
      const jitter = 0.035;
      spX[idx] = px + (rand01() - 0.5) * jitter;
      spY[idx] = Math.max(floorY + 0.01, py + (rand01() - 0.5) * jitter);
      spZ[idx] = pz + (rand01() - 0.5) * jitter;
      spVx[idx] = dx * spd;
      spVy[idx] = dy * spd;
      spVz[idx] = dz * spd;

      spAge[idx] = 0.0;
      spMaxLife[idx] = spec.lifeMin + rand01() * (spec.lifeMax - spec.lifeMin);
      spSize[idx] = spec.widthMin + rand01() * (spec.widthMax - spec.widthMin);
      spStreak[idx] = spec.streakScale * (0.78 + rand01() * 0.55);
      spGrav[idx] = spec.gravity * (0.86 + rand01() * 0.28);
      spDrag[idx] = spec.drag * (0.8 + rand01() * 0.4);
      spRest[idx] = spec.restitution * (0.82 + rand01() * 0.34);
      spFloorY[idx] = floorY;
      spKind[idx] = 0;
      spPhase[idx] = rand01();

      const tempVar = 0.88 + rand01() * 0.24;
      spHotR[idx] = hot[0] * tempVar;
      spHotG[idx] = hot[1] * tempVar;
      spHotB[idx] = hot[2] * tempVar;
      spMidR[idx] = mid[0] * tempVar;
      spMidG[idx] = mid[1] * tempVar;
      spMidB[idx] = mid[2] * tempVar;
      spCoolR[idx] = cool[0] * tempVar;
      spCoolG[idx] = cool[1] * tempVar;
      spCoolB[idx] = cool[2] * tempVar;
      spawned += 1;
    }

    syncSparkBuffers();
    return spawned;
  }

  function swapRemoveSpark(idx) {
    const last = activeSparkCount - 1;
    if (idx !== last) {
      spX[idx] = spX[last];
      spY[idx] = spY[last];
      spZ[idx] = spZ[last];
      spVx[idx] = spVx[last];
      spVy[idx] = spVy[last];
      spVz[idx] = spVz[last];
      spAge[idx] = spAge[last];
      spMaxLife[idx] = spMaxLife[last];
      spSize[idx] = spSize[last];
      spStreak[idx] = spStreak[last];
      spGrav[idx] = spGrav[last];
      spDrag[idx] = spDrag[last];
      spRest[idx] = spRest[last];
      spFloorY[idx] = spFloorY[last];
      spKind[idx] = spKind[last];
      spPhase[idx] = spPhase[last];
      spHotR[idx] = spHotR[last]; spHotG[idx] = spHotG[last]; spHotB[idx] = spHotB[last];
      spMidR[idx] = spMidR[last]; spMidG[idx] = spMidG[last]; spMidB[idx] = spMidB[last];
      spCoolR[idx] = spCoolR[last]; spCoolG[idx] = spCoolG[last]; spCoolB[idx] = spCoolB[last];
    }
    activeSparkCount = last;
  }

  function syncSparkBuffers() {
    if (activeSparkCount <= 0) {
      sparkBaseGeo.instanceCount = 0;
      sparkMesh.visible = false;
      return;
    }

    for (let i = 0; i < activeSparkCount; i++) {
      const life01 = clamp(spAge[i] / (spMaxLife[i] || 0.1), 0.0, 1.0);
      const o4 = i * 4;
      const o2 = i * 2;

      // Flash expands sharply on impact; metallic needles stay crisp and shrink subtly near burnout
      const effSize = spKind[i] === 1
        ? spSize[i] * (0.45 + 0.85 * Math.sqrt(life01))
        : spSize[i] * (1.0 - life01 * 0.42);

      spkPosSizeArr[o4] = spX[i];
      spkPosSizeArr[o4 + 1] = spY[i];
      spkPosSizeArr[o4 + 2] = spZ[i];
      spkPosSizeArr[o4 + 3] = effSize;

      spkVelLenArr[o4] = spVx[i];
      spkVelLenArr[o4 + 1] = spVy[i];
      spkVelLenArr[o4 + 2] = spVz[i];
      spkVelLenArr[o4 + 3] = spStreak[i];

      // Realistic incandescent steel cooling curve: white-hot -> gold -> amber/ember
      let r;
      let g;
      let b;
      if (life01 < 0.28) {
        const k = life01 / 0.28;
        r = spHotR[i] + (spMidR[i] - spHotR[i]) * k;
        g = spHotG[i] + (spMidG[i] - spHotG[i]) * k;
        b = spHotB[i] + (spMidB[i] - spHotB[i]) * k;
      } else {
        const k = (life01 - 0.28) / 0.72;
        r = spMidR[i] + (spCoolR[i] - spMidR[i]) * k;
        g = spMidG[i] + (spCoolG[i] - spMidG[i]) * k;
        b = spMidB[i] + (spCoolB[i] - spMidB[i]) * k;
      }

      spkColorLifeArr[o4] = r;
      spkColorLifeArr[o4 + 1] = g;
      spkColorLifeArr[o4 + 2] = b;
      spkColorLifeArr[o4 + 3] = life01;

      spkKindArr[o2] = spKind[i];
      spkKindArr[o2 + 1] = spPhase[i];
    }

    sparkBaseGeo.instanceCount = activeSparkCount;
    sparkMesh.visible = true;
    markAttrDirtyRange(spkPosSizeAttr, activeSparkCount * 4);
    markAttrDirtyRange(spkVelLenAttr, activeSparkCount * 4);
    markAttrDirtyRange(spkColorLifeAttr, activeSparkCount * 4);
    markAttrDirtyRange(spkKindAttr, activeSparkCount * 2);
  }

  // --------------------------------------------------------------------------
  // Public API: update(dt)
  // --------------------------------------------------------------------------
  function update(dt) {
    if (disposed) return;
    const safeDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.06) : 0.0;
    elapsedTime += safeDt;

    ribbonMat.uniforms.uTime.value = elapsedTime;
    sparkMat.uniforms.uTime.value = elapsedTime;

    // 1. Age ribbon samples & prune expired tails
    let anyRibbonSamples = false;
    if (safeDt > 0.0) {
      for (let sIdx = 0; sIdx < maxRibbons; sIdx++) {
        const slot = slots[sIdx];
        if (slot.count === 0) continue;

        for (let i = 0; i < slot.count; i++) {
          const phys = (slot.head + i) % RAW_SAMPLE_CAP;
          slot.age[phys] += safeDt;
        }

        // Pop expired samples from oldest end
        while (slot.count > 0) {
          const oldest = slot.head;
          if (slot.age[oldest] >= slot.maxLife[oldest]) {
            slot.head = (slot.head + 1) % RAW_SAMPLE_CAP;
            slot.count -= 1;
          } else {
            break;
          }
        }

        // If only 1 lonely sample remains and actor stopped swinging, let it expire cleanly
        if (slot.count === 0) {
          resetSlot(slot);
        } else {
          anyRibbonSamples = true;
        }
        ribbonDirty = true;
      }
    } else {
      for (let sIdx = 0; sIdx < maxRibbons; sIdx++) {
        if (slots[sIdx].count >= 2) {
          anyRibbonSamples = true;
          break;
        }
      }
    }

    if (ribbonDirty || anyRibbonSamples) {
      rebuildRibbonGeometry();
    }

    // 2. Step ballistic spark physics + stone floor ricochet
    if (activeSparkCount > 0 && safeDt > 0.0) {
      let i = 0;
      while (i < activeSparkCount) {
        const nextAge = spAge[i] + safeDt;
        if (nextAge >= spMaxLife[i]) {
          swapRemoveSpark(i);
          continue;
        }
        spAge[i] = nextAge;

        if (spKind[i] === 0) {
          const damp = Math.exp(-spDrag[i] * safeDt);
          let vx = spVx[i] * damp;
          let vy = (spVy[i] - spGrav[i] * safeDt) * damp;
          let vz = spVz[i] * damp;

          let nx = spX[i] + vx * safeDt;
          let ny = spY[i] + vy * safeDt;
          let nz = spZ[i] + vz * safeDt;

          // Physical ricochet bounce off cathedral stone floor!
          const floorY = spFloorY[i];
          if (ny < floorY) {
            ny = floorY;
            if (vy < -0.35) {
              vy = -vy * spRest[i];
              vx = vx * 0.72 + (rand01() - 0.5) * 1.15;
              vz = vz * 0.72 + (rand01() - 0.5) * 1.15;
            } else {
              vy = 0.0;
              vx *= 0.65;
              vz *= 0.65;
            }
          }

          spX[i] = nx;
          spY[i] = ny;
          spZ[i] = nz;
          spVx[i] = vx;
          spVy[i] = vy;
          spVz[i] = vz;
        }

        i += 1;
      }

      syncSparkBuffers();
    }
  }

  // --------------------------------------------------------------------------
  // Public API: clearActor, clearAll, setLowSpec, getStats, dispose
  // --------------------------------------------------------------------------
  function clearActor(actorId) {
    if (disposed || actorId === null || actorId === undefined) return;
    const slot = actorToSlot.get(actorId);
    if (!slot) return;
    resetSlot(slot);
    ribbonDirty = true;
    rebuildRibbonGeometry();
  }

  function clearAll() {
    if (disposed) return;
    for (let i = 0; i < maxRibbons; i++) {
      resetSlot(slots[i]);
    }
    actorToSlot.clear();
    lastActiveRibbons = 0;
    lastActiveTriangles = 0;
    ribbonGeo.setDrawRange(0, 0);
    ribbonMesh.visible = false;
    ribbonDirty = false;

    activeSparkCount = 0;
    sparkBaseGeo.instanceCount = 0;
    sparkMesh.visible = false;
  }

  function setLowSpec(enabled) {
    const next = Boolean(enabled);
    if (lowSpec === next) return;
    lowSpec = next;
    ribbonMat.uniforms.uLowSpec.value = lowSpec ? 1.0 : 0.0;
    sparkMat.uniforms.uLowSpec.value = lowSpec ? 1.0 : 0.0;

    // Immediately clamp active sparks if shrinking down to lowSpec cap
    const cap = getActiveSparkCap();
    if (activeSparkCount > cap) {
      activeSparkCount = cap;
      syncSparkBuffers();
    }
    ribbonDirty = true;
  }

  function getStats() {
    const drawCalls = (ribbonMesh.visible ? 1 : 0) + (sparkMesh.visible ? 1 : 0);
    return {
      activeRibbons: lastActiveRibbons,
      activeTriangles: lastActiveTriangles,
      activeSparks: activeSparkCount,
      maxRibbons,
      maxSparks: getActiveSparkCap(),
      lowSpec,
      isMobile,
      drawCalls,
      disposed
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;

    for (let i = 0; i < maxRibbons; i++) {
      resetSlot(slots[i]);
    }
    actorToSlot.clear();
    activeSparkCount = 0;
    lastActiveRibbons = 0;
    lastActiveTriangles = 0;

    if (ribbonMesh.parent) {
      ribbonMesh.parent.remove(ribbonMesh);
    }
    if (sparkMesh.parent) {
      sparkMesh.parent.remove(sparkMesh);
    }

    ribbonGeo.dispose();
    ribbonMat.dispose();
    sparkBaseGeo.dispose();
    sparkMat.dispose();
  }

  return {
    recordBladeSegment,
    recordWeaponSegment,
    endSwing,
    spawnClashSparks,
    update,
    clearActor,
    clearAll,
    setLowSpec,
    getStats,
    dispose,
    ribbonMesh,
    sparkMesh
  };
}
