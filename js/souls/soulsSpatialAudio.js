// Spatial Acoustic Engine & 43.2s Boss Intro Cutscene Audio (Doors + 7 Voiced Dialogue Lines)
// Pure Vanilla ES Module (Web Audio API, zero external dependencies, zero per-frame allocations).
//
// Features:
//   1. Spatial Living Fire (Hero Bonfire + 12 Floor Braziers, coordinates pulled live from
//      soulsCastleLayout.js) with energy-weighted StereoPannerNode imaging, distance air-absorption
//      filtering, cathedral early reflections, seamless `souls_env_fire_crackle.wav` looping +
//      warm organic procedural ember fallback.
//   2. Vaulted Stone Castle Draft (deep low-frequency resonant corridor wind + cold archway draft)
//      dynamically sculpted by castle room acoustics (Bonfire Hall, Corridor, East Alcove, Boss Hall).
//   3. Boss Intro Cutscene Audio:
//      A) Initial Door Sequence (`playCinematicBossDoorSequence`, NO boss roar, NO closing door slam, ZERO ringing/bell modes):
//           t = 0.05s : massive iron bolt unlatch `souls_env_door_bolt.wav` + deep stone sub-bass thud
//           t = 0.42s : 3 deg heavy leaf shudder — tectonic masonry sub tremor + cascading arch dust
//           t = 0.85s : monumental outward slide (3 -> 84 deg, 0.85..3.60s) `souls_env_door_open.wav`
//                       + rolling sub-bass + outward stereo cold cathedral draft
//           (Closing door SFX intentionally omitted during the Boss intro cutscene so Boss dialogue opens cleanly.)
//      B) Edge-Triggered Voiced Boss Dialogue & Throne Foley (100% timeline-locked from combat.js):
//           - `playBossIntroVoiceLine(cueIndex)` (1..7 -> `boss_intro_vo_01..07.mp3`, clean `voiceGain`,
//             auto-cuts previous line, soft music ducking via optional `duckMusic(-9.0, ...)`).
//           - `playBossArmorShift(intensity)` (`boss_intro_armor_shift.wav` + procedural steel/leather fallback).
//           - `stopBossIntroVoice(fadeSec)` (also invoked automatically by `stopCinematicSequence()` on skip).
//      Full Yandex Games `suspend()`/`resume()` (pauses/resumes voice, door clock & staggered preload) & leak-free `.dispose()`.

import * as CASTLE_LAYOUT from './soulsCastleLayout.js?v=20261124z99';

const {
  SOULS_CASTLE_BONFIRE,
  SOULS_CASTLE_BRAZIERS,
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_FLAME_TRAPS,
  evaluateFlameTrapState
} = CASTLE_LAYOUT;

export const SOULS_SPATIAL_AUDIO_VERSION = '20261124z99';
export const BOSS_DOOR_CINEMATIC_DURATION = 43.2;
export const BOSS_DOOR_AUDIO_SEQUENCE_DURATION = 7.8;

const BASE_AUDIO_PATH = './assets/audio';

// Single source of truth: live castle layout (all bonfires + 12 floor braziers) — never hardcoded here!
export const DEFAULT_SOULS_BONFIRE = Object.freeze({
  id: SOULS_CASTLE_BONFIRE.id || 'bonfire_main',
  roomId: SOULS_CASTLE_BONFIRE.roomId || 'courtyard',
  x: SOULS_CASTLE_BONFIRE.x,
  z: SOULS_CASTLE_BONFIRE.z,
  weight: 1.28,
  refDist: 1.8,
  maxDist: 14.5,
  isBonfire: true
});

function collectLayoutBonfires() {
  if (Array.isArray(CASTLE_LAYOUT.SOULS_CASTLE_BONFIRES) && CASTLE_LAYOUT.SOULS_CASTLE_BONFIRES.length > 0) {
    return CASTLE_LAYOUT.SOULS_CASTLE_BONFIRES;
  }
  const list = [SOULS_CASTLE_BONFIRE];
  const extra = CASTLE_LAYOUT.SOULS_CASTLE_BOSS_BONFIRE || CASTLE_LAYOUT.SOULS_CASTLE_CHECKPOINT_BONFIRE || null;
  if (extra && Number.isFinite(extra.x) && Number.isFinite(extra.z)) {
    list.push(extra);
  }
  return list;
}

export const DEFAULT_SOULS_BRAZIERS = Object.freeze(
  SOULS_CASTLE_BRAZIERS.map((b) => Object.freeze({
    id: b.id,
    roomId: b.roomId,
    x: b.x,
    z: b.z,
    scale: Number.isFinite(b.scale) ? b.scale : 1.0
  }))
);

export const BOSS_DOOR_CINEMATIC_STAGES = Object.freeze([
  Object.freeze({ id: 'bolt', atSec: 0.05, sampleKey: 'door_bolt' }),
  Object.freeze({ id: 'push', atSec: 0.42, sampleKey: null }),
  Object.freeze({ id: 'open', atSec: 0.85, sampleKey: 'door_open' })
]);

export const BOSS_INTRO_VOICE_LINES = Object.freeze([
  Object.freeze({ index: 1, key: 'boss_intro_vo_01', file: 'boss_intro_vo_01.mp3', durationSec: 1.886 }),
  Object.freeze({ index: 2, key: 'boss_intro_vo_02', file: 'boss_intro_vo_02.mp3', durationSec: 3.876 }),
  Object.freeze({ index: 3, key: 'boss_intro_vo_03', file: 'boss_intro_vo_03.mp3', durationSec: 5.194 }),
  Object.freeze({ index: 4, key: 'boss_intro_vo_04', file: 'boss_intro_vo_04.mp3', durationSec: 6.214 }),
  Object.freeze({ index: 5, key: 'boss_intro_vo_05', file: 'boss_intro_vo_05.mp3', durationSec: 6.011 }),
  Object.freeze({ index: 6, key: 'boss_intro_vo_06', file: 'boss_intro_vo_06.mp3', durationSec: 5.023 }),
  Object.freeze({ index: 7, key: 'boss_intro_vo_07', file: 'boss_intro_vo_07.mp3', durationSec: 1.293 })
]);

export function buildSpatialSampleManifest(basePath = BASE_AUDIO_PATH, version = SOULS_SPATIAL_AUDIO_VERSION) {
  const cleanBase = String(basePath || BASE_AUDIO_PATH).replace(/\/+$/, '');
  const q = version ? `?v=${encodeURIComponent(String(version))}` : '';
  // Priority order for staggered non-blocking warmup:
  //   1. Spatial Bonfire/Brazier fire crackle (immediate castle ambient)
  //   2. Boss Door bolt & outward opening scrape (NO door_close in cutscene!)
  //   3. Boss armor shift & 7 cutscene VO lines (pre-decoded gently before Boss Hall)
  const entries = [
    Object.freeze(['fire_crackle', `${cleanBase}/souls_env_fire_crackle.wav${q}`]),
    Object.freeze(['door_bolt', `${cleanBase}/souls_env_door_bolt.wav${q}`]),
    Object.freeze(['door_open', `${cleanBase}/souls_env_door_open.wav${q}`]),
    Object.freeze(['boss_intro_armor_shift', `${cleanBase}/boss_intro_armor_shift.wav${q}`])
  ];
  for (let i = 0; i < BOSS_INTRO_VOICE_LINES.length; i++) {
    const vl = BOSS_INTRO_VOICE_LINES[i];
    entries.push(Object.freeze([vl.key, `${cleanBase}/${vl.file}${q}`]));
  }
  return Object.freeze(entries);
}

// Legacy/on-demand fallback URLs (never eagerly preloaded during castle warmup)
function buildLazyFallbackManifest(basePath = BASE_AUDIO_PATH, version = SOULS_SPATIAL_AUDIO_VERSION) {
  const cleanBase = String(basePath || BASE_AUDIO_PATH).replace(/\/+$/, '');
  const q = version ? `?v=${encodeURIComponent(String(version))}` : '';
  return [
    ['bonfire_crackle_legacy', `${cleanBase}/souls_env_bonfire_crackle.wav${q}`],
    ['boss_cutscene_roar', `${cleanBase}/souls_boss_cutscene_roar.wav${q}`],
    ['boss_roar_legacy', `${cleanBase}/souls_boss_roar.wav${q}`]
  ];
}

export const SOULS_SPATIAL_SAMPLE_MANIFEST = buildSpatialSampleManifest();

// ============================================================================
// Internal Math & Safe Web Audio Helpers
// ============================================================================

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function finiteOr(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function isAudioContextLike(obj) {
  return Boolean(
    obj &&
    typeof obj === 'object' &&
    typeof obj.createGain === 'function' &&
    typeof obj.createBuffer === 'function'
  );
}

function safeDisconnect(node) {
  if (!node) return;
  try { node.disconnect(); } catch {}
}

function safeStop(node) {
  if (!node) return;
  try { node.stop(); } catch {}
}

function safeTargetParam(param, value, time, timeConstant) {
  if (!param) return;
  const safeVal = Number.isFinite(value) ? value : 0;
  const safeT = Number.isFinite(time) ? time : 0;
  const safeTc = Number.isFinite(timeConstant) && timeConstant > 0.001 ? timeConstant : 0.015;
  try {
    param.setTargetAtTime(safeVal, safeT, safeTc);
  } catch {
    try { param.value = safeVal; } catch {}
  }
}

function createStereoPannerSafe(ctx) {
  if (ctx && typeof ctx.createStereoPanner === 'function') {
    try {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(0, ctx.currentTime);
      return p;
    } catch {}
  }
  // Ultra-old WebKit fallback: transparent GainNode with dummy pan AudioParam-like interface
  const g = ctx.createGain();
  g.gain.setValueAtTime(1.0, ctx.currentTime);
  return g;
}

function setPannerValue(pannerNode, pan, t, tc = 0.04) {
  if (!pannerNode || !pannerNode.pan) return;
  safeTargetParam(pannerNode.pan, clamp(finiteOr(pan, 0), -1, 1), t, tc);
}

function decodeAudioBuffer(audioCtx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onOk = (decoded) => {
      if (settled) return;
      settled = true;
      resolve(decoded);
    };
    const onErr = (err) => {
      if (settled) return;
      settled = true;
      reject(err || new Error('decodeAudioData failed'));
    };
    try {
      const res = audioCtx.decodeAudioData(arrayBuffer, onOk, onErr);
      if (res && typeof res.then === 'function') {
        res.then(onOk, onErr);
      }
    } catch (err) {
      onErr(err);
    }
  });
}

// ============================================================================
// Procedural Audio Buffers (Cathedral Stereo IR + Warm Sculpted Noise Loops)
// ============================================================================

const INV_2_POW_31 = 2 / 4294967296;

/**
 * Generates a realistic stereo Gothic Cathedral Stone Impulse Response:
 * - Asymmetric early stone nave, buttress & vault reflections (17..225 ms)
 * - Smoothly diffused dark limestone decay (zero periodic/ringing coloration!)
 * - Uses exact multiplicative exponential recurrence + inline LCG PRNG (~12x faster, 0 frame hitch!)
 */
function buildCathedralImpulseResponse(ctx, durationSec = 3.1, deepCinemaMode = false) {
  const sr = Math.max(22050, Math.min(96000, ctx.sampleRate || 44100));
  const length = Math.max(4096, Math.floor(sr * durationSec));
  const ir = ctx.createBuffer(2, length, sr);
  let seed = (deepCinemaMode ? 0xCA7ED51A : 0xCA7ED4A1) >>> 0;

  // Early stone reflections: [delaySec, gainL, gainR]
  const earlyTaps = deepCinemaMode
    ? [
      [0.019, 0.34, 0.21],
      [0.031, 0.19, 0.33],
      [0.047, 0.27, 0.16],
      [0.068, 0.15, 0.26],
      [0.093, 0.22, 0.14],
      [0.124, 0.13, 0.21],
      [0.161, 0.17, 0.12],
      [0.208, 0.11, 0.16]
    ]
    : [
      [0.017, 0.36, 0.22],
      [0.026, 0.20, 0.34],
      [0.039, 0.28, 0.17],
      [0.054, 0.16, 0.27],
      [0.071, 0.22, 0.15],
      [0.094, 0.14, 0.21],
      [0.118, 0.17, 0.12],
      [0.146, 0.11, 0.16]
    ];

  const preDelaySamples = Math.floor(sr * (deepCinemaMode ? 0.022 : 0.016));
  const fadeInSamples = Math.max(1, Math.floor(sr * (deepCinemaMode ? 0.058 : 0.045)));
  const invFadeIn = 1.0 / fadeInSamples;
  const startLp = deepCinemaMode ? 0.27 : 0.35;
  const lpSlope = 0.21 / (Math.max(0.1, durationSec) * sr);
  const hpAlpha = deepCinemaMode ? 0.9945 : 0.992; // preserves warm ~42 Hz stone body
  const w1 = deepCinemaMode ? 0.62 : 0.72;
  const w2 = deepCinemaMode ? 0.38 : 0.28;
  const decay1 = Math.exp((deepCinemaMode ? -1.55 : -2.15) / sr);
  const decay2 = Math.exp((deepCinemaMode ? -0.72 : -1.15) / sr);
  const tailFade = Math.min(length, Math.floor(sr * 0.12));
  const invTailFade = tailFade > 0 ? 1.0 / tailFade : 1.0;

  for (let ch = 0; ch < 2; ch++) {
    const out = ir.getChannelData(ch);

    // Stamp early reflections with slight stone lowpass softening (3-sample kernel)
    for (let i = 0; i < earlyTaps.length; i++) {
      const tap = earlyTaps[i];
      const idx = Math.floor(tap[0] * sr);
      const amp = ch === 0 ? tap[1] : tap[2];
      const sign = ((i + ch) % 2 === 0) ? 1 : -1;
      if (idx > 1 && idx + 2 < length) {
        out[idx - 1] += sign * amp * 0.24;
        out[idx] += sign * amp * 0.52;
        out[idx + 1] += sign * amp * 0.24;
      }
    }

    // Late diffused dark stone hall tail (100% non-tonal, zero sine/modal ringing!)
    let lpState = 0;
    let lpState2 = 0;
    let hpState = 0;
    let prevIn = 0;
    let env1 = w1;
    let env2 = w2;
    let lpCoeff = startLp;

    for (let i = preDelaySamples; i < length; i++) {
      const rel = i - preDelaySamples;
      const attackRamp = rel < fadeInSamples ? rel * invFadeIn : 1.0;

      // Stereo decorrelated white excitation (inline LCG PRNG)
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed * INV_2_POW_31 - 1.0;

      // Progressive air + rough limestone HF absorption: darker velvet late tail
      const c = lpCoeff < 0.055 ? 0.055 : lpCoeff;
      lpState += c * (white - lpState);
      lpState2 += (c * 0.82) * (lpState - lpState2);

      // Gentle HPF
      const raw = lpState2;
      hpState = hpAlpha * (hpState + raw - prevIn);
      prevIn = raw;

      out[i] += hpState * (env1 + env2) * attackRamp * 0.25;
      env1 *= decay1;
      env2 *= decay2;
      lpCoeff -= lpSlope;
    }

    // Smooth final 120 ms fade-out to exact zero (zero truncation click)
    const fadeStart = length - tailFade;
    for (let k = 0; k < tailFade; k++) {
      const mult = 1.0 - k * invTailFade;
      out[fadeStart + k] *= mult * mult;
    }
  }

  return ir;
}

/**
 * Transparent analog-style soft-ceiling curve for the cinematic master bus:
 * Linear up to |x| <= 0.72, smoothly saturating to strict [-0.97, +0.97] ceiling
 * so loud door scrapes stay massive with ZERO digital clipping.
 */
function buildSoftLimiterCurve(samples = 1024) {
  const curve = new Float32Array(samples);
  const knee = 0.72;
  const ceiling = 0.97;
  const span = ceiling - knee;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    const ax = Math.abs(x);
    if (ax <= knee) {
      curve[i] = x;
    } else {
      const over = (ax - knee) / span;
      const shaped = knee + span * Math.tanh(over);
      curve[i] = x < 0 ? -shaped : shaped;
    }
  }
  return curve;
}

/**
 * Generates a seamless 4.5-second stereo pink/brown sculpted noise loop for
 * vaulted stone corridor wind draft and warm procedural hearth rumble.
 * Writes directly into output channels (zero multi-MB temporary buffer allocations)
 * and equal-power crossfades head-to-tail for 100% click-free infinite looping.
 */
function buildSeamlessWarmNoiseLoop(ctx, durationSec = 4.5) {
  const sr = Math.max(22050, Math.min(96000, ctx.sampleRate || 44100));
  const length = Math.max(8192, Math.floor(sr * durationSec));
  const xfade = Math.max(1, Math.min(Math.floor(sr * 0.45), Math.floor(length * 0.2)));
  const buf = ctx.createBuffer(2, length, sr);
  let seed = 0xF14E2026 >>> 0;
  const dAngle = (Math.PI * 0.5) / xfade;
  const cosD = Math.cos(dAngle);
  const sinD = Math.sin(dAngle);
  const invBrown = 1.0 / 1.028;

  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    // Paul Kellet pink-ish + warm brown blend (zero harsh high-frequency white hiss!)
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let brown = 0;
    for (let i = 0; i < length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const w = seed * INV_2_POW_31 - 1.0;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      const pink = (b0 + b1 + b2 + w * 0.1848) * 0.14;
      brown = (brown + 0.028 * w) * invBrown;
      const sample = pink * 0.55 + brown * 1.85;
      out[i] = sample < -0.95 ? -0.95 : sample > 0.95 ? 0.95 : sample;
    }

    // Equal-power seamless loop wrap over the short tail continuation (zero temporary Float32Array!)
    let fadeIn = 0.0;  // sin(0)
    let fadeOut = 1.0; // cos(0)
    for (let i = 0; i < xfade; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const w = seed * INV_2_POW_31 - 1.0;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      const pink = (b0 + b1 + b2 + w * 0.1848) * 0.14;
      brown = (brown + 0.028 * w) * invBrown;
      const tailSample = pink * 0.55 + brown * 1.85;
      const clampedTail = tailSample < -0.95 ? -0.95 : tailSample > 0.95 ? 0.95 : tailSample;
      out[i] = out[i] * fadeIn + clampedTail * fadeOut;
      const nextIn = fadeIn * cosD + fadeOut * sinD;
      const nextOut = fadeOut * cosD - fadeIn * sinD;
      fadeIn = nextIn;
      fadeOut = nextOut;
    }
  }
  return buf;
}

/**
 * Generates a short 1.2-second crisp white noise buffer for transient metallic rattles,
 * oak snaps, stone grit, and procedural fire ember pops.
 */
function buildTransientNoiseBuffer(ctx, durationSec = 1.2) {
  const sr = Math.max(22050, Math.min(96000, ctx.sampleRate || 44100));
  const length = Math.max(4096, Math.floor(sr * durationSec));
  const xfade = Math.min(256, Math.floor(length * 0.1));
  const buf = ctx.createBuffer(1, length, sr);
  const data = buf.getChannelData(0);
  let seed = 0x570AE991 >>> 0;
  for (let i = 0; i < length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    data[i] = seed * INV_2_POW_31 - 1.0;
  }
  // Equal-power loop seam wrap so looping broadband flame crackle is 100% click-free
  for (let k = 0; k < xfade; k++) {
    const a = (k / xfade) * (Math.PI * 0.5);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const tail = seed * INV_2_POW_31 - 1.0;
    data[k] = data[k] * Math.sin(a) + tail * Math.cos(a);
  }
  return buf;
}

// ============================================================================
// Spatial Acoustic Zone Classifier (aligned with soulsCastleLayout.js)
// ============================================================================

const LAYOUT_BOSS_DOOR_Z = Number.isFinite(SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z) ? SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z : -16.0;
const LAYOUT_COURTYARD_MIN_Z = Number.isFinite(SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z) ? SOULS_CASTLE_CONSTANTS.COURTYARD_MIN_Z : 20.0;
const LAYOUT_CORRIDOR_MIN_Z = Number.isFinite(SOULS_CASTLE_CONSTANTS.CORRIDOR_MIN_Z) ? SOULS_CASTLE_CONSTANTS.CORRIDOR_MIN_Z : LAYOUT_BOSS_DOOR_Z;
const LAYOUT_CORRIDOR_MAX_Z = Number.isFinite(SOULS_CASTLE_CONSTANTS.CORRIDOR_MAX_Z) ? SOULS_CASTLE_CONSTANTS.CORRIDOR_MAX_Z : LAYOUT_COURTYARD_MIN_Z;
const LAYOUT_CORRIDOR_SPAN_Z = Math.max(4.0, LAYOUT_CORRIDOR_MAX_Z - LAYOUT_CORRIDOR_MIN_Z);
const LAYOUT_ALCOVE_MIN_X = (Number.isFinite(SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X) ? SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_X : 5.8) - 0.8; // include the open arch
const LAYOUT_ALCOVE_MIN_Z = Number.isFinite(SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_Z) ? SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MIN_Z : -5.0;
const LAYOUT_ALCOVE_MAX_Z = Number.isFinite(SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_Z) ? SOULS_CASTLE_CONSTANTS.EAST_ALCOVE_MAX_Z : 4.0;

function classifyCastleAcoustics(x, z) {
  // Returns a zone index (0 courtyard, 1 corridor, 2 east_alcove, 3 boss_hall). Zero allocation.
  // All boundaries come from soulsCastleLayout.js (single source of truth).
  if (z < LAYOUT_BOSS_DOOR_Z) {
    return 3; // 'boss_hall': enlarged circular cathedral, deep cavernous acoustics
  }
  if (x >= LAYOUT_ALCOVE_MIN_X && z >= LAYOUT_ALCOVE_MIN_Z && z <= LAYOUT_ALCOVE_MAX_Z) {
    return 2; // 'east_alcove': stone relic chapel
  }
  if (z >= LAYOUT_COURTYARD_MIN_Z) {
    return 0; // 'courtyard': Bonfire Hall
  }
  return 1; // 'corridor': vaulted narrow stone nave (strongest cold stone draft!)
}

const ZONE_IDS = Object.freeze(['courtyard', 'corridor', 'east_alcove', 'boss_hall']);

// ============================================================================
// Main Factory: createSoulsSpatialAudio(audioCtx, masterGain, options)
// ============================================================================

/**
 * Creates the Abandoned Knight Rift Spatial Audio & 7.2s Cinematic Boss Door Audio Engine.
 *
 * Accepts either:
 *   - `createSoulsSpatialAudio(audioCtx, masterGain, options)`
 *   - `createSoulsSpatialAudio({ audioCtx, getCtx, masterGain, getMasterGain, bonfire, braziers, ... })`
 *
 * `listenerYaw` convention (default `'camera_orbit'`):
 *   Matches `world.getCombatOrbitYaw()` and Three.js `camera.rotation.y`:
 *   yaw = 0 faces North (-Z) with right ear toward East (+X), i.e. right = (cos(yaw), -sin(yaw)).
 *   Pass `options.yawConvention = 'actor_facing'` if feeding `player.facing` (0 = +Z).
 */
export function createSoulsSpatialAudio(audioCtxOrOpts = null, masterGainArg = null, optionsArg = null) {
  let ctx = null;
  let destNode = null;
  let getCtxFn = null;
  let getDestFn = null;
  let opts = {};

  if (isAudioContextLike(audioCtxOrOpts) || audioCtxOrOpts === null || audioCtxOrOpts === undefined) {
    ctx = isAudioContextLike(audioCtxOrOpts) ? audioCtxOrOpts : null;
    destNode = masterGainArg || null;
    opts = optionsArg && typeof optionsArg === 'object' ? optionsArg : {};
  } else if (typeof audioCtxOrOpts === 'object') {
    opts = audioCtxOrOpts;
    ctx = isAudioContextLike(opts.audioCtx) ? opts.audioCtx : null;
    destNode = opts.masterGain || opts.dest || null;
    if (typeof opts.getCtx === 'function') getCtxFn = opts.getCtx;
    if (typeof opts.getMasterGain === 'function') getDestFn = opts.getMasterGain;
    else if (typeof opts.getSfxDest === 'function') getDestFn = opts.getSfxDest;
  }

  const basePath = opts.basePath || BASE_AUDIO_PATH;
  const assetVersion = opts.version !== undefined ? opts.version : SOULS_SPATIAL_AUDIO_VERSION;
  const yawConvention = opts.yawConvention === 'actor_facing' ? 'actor_facing' : 'camera_orbit';
  const manifest = buildSpatialSampleManifest(basePath, assetVersion);
  const sampleUrls = new Map();
  for (let i = 0; i < manifest.length; i++) {
    sampleUrls.set(manifest[i][0], manifest[i][1]);
  }
  const lazyFallbackEntries = buildLazyFallbackManifest(basePath, assetVersion);
  const lazyFallbackUrls = new Map();
  for (let i = 0; i < lazyFallbackEntries.length; i++) {
    lazyFallbackUrls.set(lazyFallbackEntries[i][0], lazyFallbackEntries[i][1]);
  }
  let duckMusicFn = typeof opts.duckMusic === 'function' ? opts.duckMusic : null;

  // Fire source registry: index 0 is Hero Bonfire, 1..N are floor braziers
  const fireSources = [];

  function normalizeFireSource(src, isBonfire = false, idx = 0) {
    if (!src) return null;
    const x = Array.isArray(src) ? Number(src[0]) : Number(src.x);
    const z = Array.isArray(src) ? Number(src[1]) : Number(src.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    const scale = finiteOr(Number(src.scale), 1.0);
    const refDist = finiteOr(Number(src.refDist), isBonfire ? 1.8 : 1.5);
    const maxDist = finiteOr(Number(src.maxDist), isBonfire ? 14.5 : 11.2);
    return {
      id: typeof src.id === 'string' ? src.id : (isBonfire ? 'bonfire_main' : `brazier_${idx}`),
      x,
      z,
      weight: finiteOr(Number(src.weight), isBonfire ? 1.28 : 0.98 * clamp(scale, 0.85, 1.25)),
      refDist,
      maxDist,
      maxDistSq: maxDist * maxDist,
      invDistSpan: 1.0 / Math.max(0.5, maxDist - refDist),
      isBonfire: Boolean(isBonfire)
    };
  }

  function setFireSources(bonfire = collectLayoutBonfires(), braziers = DEFAULT_SOULS_BRAZIERS) {
    fireSources.length = 0;
    if (Array.isArray(bonfire) && bonfire.length > 0 && typeof bonfire[0] === 'object') {
      for (let i = 0; i < bonfire.length; i++) {
        const bf = normalizeFireSource(bonfire[i], true, i);
        if (bf) fireSources.push(bf);
      }
    } else {
      const bf = normalizeFireSource(bonfire, true, 0);
      if (bf) fireSources.push(bf);
    }
    if (Array.isArray(braziers)) {
      for (let i = 0; i < braziers.length; i++) {
        const br = normalizeFireSource(braziers[i], false, i + 1);
        if (br) fireSources.push(br);
      }
    }
  }

  setFireSources(
    opts.bonfire !== undefined ? opts.bonfire : collectLayoutBonfires(),
    opts.braziers !== undefined ? opts.braziers : DEFAULT_SOULS_BRAZIERS
  );

  // ==========================================================================
  // Runtime State (all scalars pre-allocated -> 0 allocations in update())
  // ==========================================================================
  let disposed = false;
  let suspended = false;
  let muted = Boolean(opts.muted);
  let masterVolume = clamp(finiteOr(Number(opts.volume), 1.0), 0, 1.5);

  let graphInitialized = false;
  let graphCtxRef = null;
  let graphDestRef = null;

  // Decoded AudioBuffer cache & staggered non-blocking warmup queue
  const buffers = new Map();       // key -> AudioBuffer
  const pendingLoads = new Map();  // key -> Promise<AudioBuffer|null>
  const failedKeys = new Set();    // permanent 404 keys (never retried on footsteps)
  let preloadInitiated = false;
  let preloadCompleted = false;
  let preloadCtxRef = null;
  let preloadPromise = null;
  let warmupGeneration = 0;
  let warmupResumeCallbacks = [];

  // Reusable procedural AudioBuffers
  let cathedralIRBuffer = null;
  let cinemaCathedralIRBuffer = null;
  let warmNoiseBuffer = null;
  let transientNoiseBuffer = null;

  // Permanent Master, Voice & Ambient Web Audio Graph Nodes
  let spatialMasterGain = null;
  let dryAmbientBus = null;
  let voiceGain = null;
  let voiceVolume = clamp(finiteOr(Number(opts.voiceVolume), 1.08), 0, 1.6);

  // Shared Gothic Cathedral Reverb (Ambient bus — warmed off frame 0 for 0ms hitch!)
  let ambReverbIn = null;
  let ambReverbHpf = null;
  let ambReverbLpf = null;
  let ambReverbNode = null;        // ConvolverNode or delay fallback head
  let ambReverbFallbackNodes = []; // Only populated if ConvolverNode unavailable
  let ambReverbWetGain = null;
  let ambReverbReady = false;

  // Cinematic Compressor + Soft-Ceiling Limiter + Dedicated Cathedral Reverb (warmed off frame 0!)
  let cinemaCompressor = null;
  let cinemaSoftLimiter = null;
  let cinemaReverbIn = null;
  let cinemaReverbHpf = null;
  let cinemaReverbLpf = null;
  let cinemaReverbNode = null;
  let cinemaReverbFallbackNodes = [];
  let cinemaReverbWetGain = null;
  let cinemaReverbReady = false;

  // Spatial Fire Chain (WAV loop + warm procedural hearth rumble fallback)
  let fireSource = null;           // Looping AudioBufferSourceNode for WAV
  let fireWavGain = null;
  let procFireSource = null;       // Looping warm hearth rumble fallback while WAV decodes
  let procFireFilter = null;
  let procFireGain = null;
  let procFireStopTimer = null;
  let fireLpf = null;              // Distance air-absorption filter
  let firePanner = null;           // StereoPannerNode
  let fireGain = null;
  let fireReverbSend = null;
  let fireWavActive = false;

  // Vaulted Stone Corridor Wind Draft Chain (dual resonant stone bands)
  let windSource = null;
  let windVaultBpf = null;         // Deep 95-155 Hz stone vault cavity resonance
  let windVaultGain = null;
  let windDraftBpf = null;         // Cold 260-430 Hz gothic archway draft howl
  let windDraftGain = null;
  let windToneLpf = null;
  let windPanner = null;           // Subtle stereo draft sway
  let windGain = null;
  let windReverbSend = null;

  // Gargoyle Pressurized Flame-Jet Gauntlet Chain (Zone 3 — 5 synchronized flame traps)
  let jetSource = null;
  let jetCrackleSource = null;
  let jetRoarBpf = null;           // 135-220 Hz punchy pressurized furnace combustion rumble
  let jetRoarGain = null;
  let jetBlastBpf = null;          // 520-1100 Hz roaring flamethrower column
  let jetBlastGain = null;
  let jetHissBpf = null;           // 1850-3200 Hz pressurized nozzle roar & crisp fire crackle
  let jetHissGain = null;
  let jetLpf = null;
  let jetPanner = null;
  let jetGain = null;
  let jetReverbSend = null;
  const trapWasFiring = new Uint8Array(12);
  let lastJetBurstAt = -10;
  let nextJetCrackleAt = 0;

  // Live Ambient Telemetry & Smoothing Scalars + Epsilon Param Caches (0 GC / 0 timeline flood!)
  let lastIsInSouls = false;
  let lastBossAwakened = false;
  let ambientSilenced = true;
  let clockSec = 0;
  let nextEmberPopAt = 0;
  let curZoneIdx = 0;
  let curCorridorFactor = 0.35;
  let curNearestFireId = null;
  let curNearestFireDist = Infinity;
  let curFireTargetGain = 0;
  let curFireTargetPan = 0;
  let curWindTargetGain = 0;
  let curFlameJetTargetGain = 0;
  let curFlameJetTargetPan = 0;

  let lastSentFireGain = NaN;
  let lastSentFirePan = NaN;
  let lastSentFireCutoff = NaN;
  let lastSentFireRev = NaN;
  let lastSentWindGain = NaN;
  let lastSentWindVaultFreq = NaN;
  let lastSentWindDraftFreq = NaN;
  let lastSentWindDraftGain = NaN;
  let lastSentWindRev = NaN;
  let lastSentWindPan = NaN;
  let lastSentJetGain = NaN;
  let lastSentJetPan = NaN;
  let lastSentJetCutoff = NaN;
  let lastSentJetBlastGain = NaN;
  let lastSentJetHissGain = NaN;

  function resetAmbientParamCache() {
    ambientSilenced = false;
    lastSentFireGain = NaN;
    lastSentFirePan = NaN;
    lastSentFireCutoff = NaN;
    lastSentFireRev = NaN;
    lastSentWindGain = NaN;
    lastSentWindVaultFreq = NaN;
    lastSentWindDraftFreq = NaN;
    lastSentWindDraftGain = NaN;
    lastSentWindRev = NaN;
    lastSentWindPan = NaN;
    lastSentJetGain = NaN;
    lastSentJetPan = NaN;
    lastSentJetCutoff = NaN;
    lastSentJetBlastGain = NaN;
    lastSentJetHissGain = NaN;
  }

  // Active Transient Node, Timer & Idle-Callback Tracking (0 leaks on dispose!)
  const activeTransientNodes = new Set();
  const activeTimers = new Set();
  const activeIdleHandles = new Set();

  // Active Boss Door Cutscene Session & All Live/Fading Sessions (0 leaks on dispose!)
  let cinematicSession = null;
  const activeSessions = new Set();
  let cinemaRevToken = 0;

  // Dedicated Boss Intro Dialogue Voice Playback State (7 lines, zero overlap, pause/resume safe)
  let activeVoice = null;          // { cueIndex, key, source, gain, startedAtCtx, offsetAtStart, duration, stopped, fadeTimer }
  const fadingVoices = new Set();  // fading-out previous voice entries tracked for 0-leak dispose
  let voicePlayToken = 0;          // monotonic token canceling stale async on-demand decodes on skip/next line
  let pausedVoiceCueIndex = 0;     // remembered on Yandex Games suspend() for seamless resume()
  let pausedVoiceOffsetSec = 0;
  let voiceDuckTimer = null;
  let lastVoiceDuckMs = 0;

  // ==========================================================================
  // Context & Graph Lifecycle
  // ==========================================================================

  function resolveCtx() {
    if (disposed) return null;
    if (ctx) return ctx;
    if (getCtxFn) {
      try {
        const c = getCtxFn();
        if (isAudioContextLike(c)) {
          ctx = c;
          return ctx;
        }
      } catch {}
    }
    return null;
  }

  function resolveDest(audioCtx) {
    if (!audioCtx || disposed) return null;
    if (destNode) return destNode;
    if (getDestFn) {
      try {
        const d = getDestFn();
        if (d) {
          destNode = d;
          return destNode;
        }
      } catch {}
    }
    return audioCtx.destination || null;
  }

  function createReverbProcessor(audioCtx, inputNode, outputNode, fallbackBucket, irOverride = null) {
    const irBuf = irOverride || cathedralIRBuffer;
    // Primary: True Stereo Cathedral ConvolverNode (equal-power W3C RMS normalization -> unity wet gain!)
    if (typeof audioCtx.createConvolver === 'function' && irBuf) {
      try {
        const conv = audioCtx.createConvolver();
        conv.normalize = true;
        conv.buffer = irBuf;
        inputNode.connect(conv);
        conv.connect(outputNode);
        return conv;
      } catch {}
    }

    // Fallback: Lush Dual-Tap Cross-Feedback Stereo Stone Delay Reverb
    const d1 = audioCtx.createDelay(0.5);
    const d2 = audioCtx.createDelay(0.5);
    const d3 = audioCtx.createDelay(0.5);
    const fb1 = audioCtx.createGain();
    const fb2 = audioCtx.createGain();
    const damp = audioCtx.createBiquadFilter();
    const t0 = audioCtx.currentTime;

    d1.delayTime.setValueAtTime(0.067, t0);
    d2.delayTime.setValueAtTime(0.143, t0);
    d3.delayTime.setValueAtTime(0.241, t0);
    fb1.gain.setValueAtTime(0.46, t0);
    fb2.gain.setValueAtTime(0.38, t0);
    damp.type = 'lowpass';
    damp.frequency.setValueAtTime(2200, t0);

    inputNode.connect(d1);
    inputNode.connect(d2);
    d1.connect(damp);
    d2.connect(damp);
    damp.connect(d3);
    d3.connect(fb1);
    fb1.connect(d1);
    d3.connect(fb2);
    fb2.connect(d2);
    d1.connect(outputNode);
    d2.connect(outputNode);
    d3.connect(outputNode);

    fallbackBucket.push(d1, d2, d3, fb1, fb2, damp);
    return d1;
  }

  function cancelWarmupHandles() {
    if (typeof cancelIdleCallback === 'function') {
      for (const h of activeIdleHandles) {
        try { cancelIdleCallback(h); } catch {}
      }
    }
    activeIdleHandles.clear();
  }

  function flushWarmupResumeCallbacks() {
    if (warmupResumeCallbacks.length === 0) return;
    const cbs = warmupResumeCallbacks;
    warmupResumeCallbacks = [];
    for (let i = 0; i < cbs.length; i++) {
      try { cbs[i](); } catch {}
    }
  }

  function stopProceduralFireFallback() {
    if (procFireStopTimer !== null) {
      clearTimeout(procFireStopTimer);
      activeTimers.delete(procFireStopTimer);
      procFireStopTimer = null;
    }
    safeStop(procFireSource);
    safeDisconnect(procFireSource);
    safeDisconnect(procFireFilter);
    safeDisconnect(procFireGain);
    procFireSource = null;
    procFireFilter = null;
    procFireGain = null;
  }

  function teardownGraph() {
    safeStop(fireSource);
    stopProceduralFireFallback();
    safeStop(windSource);
    safeStop(jetSource);
    safeStop(jetCrackleSource);

    safeDisconnect(fireSource);
    safeDisconnect(fireWavGain);
    safeDisconnect(fireLpf);
    safeDisconnect(firePanner);
    safeDisconnect(fireGain);
    safeDisconnect(fireReverbSend);

    safeDisconnect(windSource);
    safeDisconnect(windVaultBpf);
    safeDisconnect(windVaultGain);
    safeDisconnect(windDraftBpf);
    safeDisconnect(windDraftGain);
    safeDisconnect(windToneLpf);
    safeDisconnect(windPanner);
    safeDisconnect(windGain);
    safeDisconnect(windReverbSend);

    safeDisconnect(jetSource);
    safeDisconnect(jetCrackleSource);
    safeDisconnect(jetRoarBpf);
    safeDisconnect(jetRoarGain);
    safeDisconnect(jetBlastBpf);
    safeDisconnect(jetBlastGain);
    safeDisconnect(jetHissBpf);
    safeDisconnect(jetHissGain);
    safeDisconnect(jetLpf);
    safeDisconnect(jetPanner);
    safeDisconnect(jetGain);
    safeDisconnect(jetReverbSend);

    safeDisconnect(ambReverbIn);
    safeDisconnect(ambReverbHpf);
    safeDisconnect(ambReverbLpf);
    safeDisconnect(ambReverbNode);
    for (let i = 0; i < ambReverbFallbackNodes.length; i++) safeDisconnect(ambReverbFallbackNodes[i]);
    ambReverbFallbackNodes.length = 0;
    safeDisconnect(ambReverbWetGain);

    safeDisconnect(cinemaReverbIn);
    safeDisconnect(cinemaReverbHpf);
    safeDisconnect(cinemaReverbLpf);
    safeDisconnect(cinemaReverbNode);
    for (let i = 0; i < cinemaReverbFallbackNodes.length; i++) safeDisconnect(cinemaReverbFallbackNodes[i]);
    cinemaReverbFallbackNodes.length = 0;
    safeDisconnect(cinemaReverbWetGain);

    safeDisconnect(cinemaCompressor);
    safeDisconnect(cinemaSoftLimiter);
    safeDisconnect(voiceGain);
    safeDisconnect(dryAmbientBus);
    safeDisconnect(spatialMasterGain);

    fireSource = null;
    fireWavGain = null;
    fireLpf = null;
    firePanner = null;
    fireGain = null;
    fireReverbSend = null;
    fireWavActive = false;

    windSource = null;
    windVaultBpf = null;
    windVaultGain = null;
    windDraftBpf = null;
    windDraftGain = null;
    windToneLpf = null;
    windPanner = null;
    windGain = null;
    windReverbSend = null;

    jetSource = null;
    jetCrackleSource = null;
    jetRoarBpf = null;
    jetRoarGain = null;
    jetBlastBpf = null;
    jetBlastGain = null;
    jetHissBpf = null;
    jetHissGain = null;
    jetLpf = null;
    jetPanner = null;
    jetGain = null;
    jetReverbSend = null;
    trapWasFiring.fill(0);

    ambReverbIn = null;
    ambReverbHpf = null;
    ambReverbLpf = null;
    ambReverbNode = null;
    ambReverbWetGain = null;
    ambReverbReady = false;

    cinemaReverbIn = null;
    cinemaReverbHpf = null;
    cinemaReverbLpf = null;
    cinemaReverbNode = null;
    cinemaReverbWetGain = null;
    cinemaReverbReady = false;

    cinemaCompressor = null;
    cinemaSoftLimiter = null;
    voiceGain = null;
    dryAmbientBus = null;
    spatialMasterGain = null;

    graphInitialized = false;
    graphCtxRef = null;
    graphDestRef = null;
    resetAmbientParamCache();
    ambientSilenced = true;
  }

  function computeEffectiveMasterGain() {
    if (disposed || suspended || muted) return 0.0001;
    return Math.max(0.0001, masterVolume);
  }

  function syncSpatialMasterGain(tc = 0.03) {
    const audioCtx = resolveCtx();
    if (!audioCtx || !spatialMasterGain || graphCtxRef !== audioCtx) return;
    const t = audioCtx.currentTime;
    const target = computeEffectiveMasterGain();
    try {
      spatialMasterGain.gain.cancelScheduledValues(t);
      spatialMasterGain.gain.setTargetAtTime(target, t, tc);
    } catch {
      try { spatialMasterGain.gain.value = target; } catch {}
    }
  }

  /**
   * Lazily initializes the 3.1s Gothic stone hall Convolver for ambient fire & wind reverb.
   * Deferred off frame 0 into an idle slice so entering Souls Citadel never drops a frame
   * on synchronous ConvolverNode FFT preparation, then blooms in smoothly (0 click).
   */
  function ensureAmbReverbReady() {
    if (ambReverbReady) return true;
    if (disposed || !graphInitialized || !graphCtxRef || !ambReverbLpf || !ambReverbWetGain) {
      return false;
    }
    try {
      if (!cathedralIRBuffer) {
        cathedralIRBuffer = buildCathedralImpulseResponse(graphCtxRef, 3.1, false);
      }
      ambReverbNode = createReverbProcessor(
        graphCtxRef,
        ambReverbLpf,
        ambReverbWetGain,
        ambReverbFallbackNodes,
        cathedralIRBuffer
      );
      ambReverbReady = true;
      safeTargetParam(ambReverbWetGain.gain, 0.62, graphCtxRef.currentTime, 0.12);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lazily initializes the deep 3.6s Gothic Cathedral Convolver for the Boss Door & Armor Shift bus.
   * Deferred off frame 0 (warmed in idle slice during preload, or created synchronously on demand
   * if a cutscene/armor-shift cue triggers before idle warmup completes).
   */
  function ensureCinemaReverbReady() {
    if (cinemaReverbReady) return true;
    if (disposed || !graphInitialized || !graphCtxRef || !cinemaReverbLpf || !cinemaReverbWetGain) {
      return false;
    }
    try {
      if (!cinemaCathedralIRBuffer) {
        cinemaCathedralIRBuffer = buildCathedralImpulseResponse(graphCtxRef, 3.6, true);
      }
      cinemaReverbNode = createReverbProcessor(
        graphCtxRef,
        cinemaReverbLpf,
        cinemaReverbWetGain,
        cinemaReverbFallbackNodes,
        cinemaCathedralIRBuffer
      );
      cinemaReverbReady = true;
      return true;
    } catch {
      return false;
    }
  }

  function startFireWavLoopIfReady() {
    if (disposed || !graphInitialized || !graphCtxRef || !fireWavGain) return false;
    if (fireWavActive && fireSource) return true;
    const buf = buffers.get('fire_crackle') || buffers.get('bonfire_crackle_legacy');
    if (!buf) return false;

    const audioCtx = graphCtxRef;
    const t = audioCtx.currentTime;
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(fireWavGain);
      src.start(t);
      fireSource = src;
      fireWavActive = true;

      // Crossfade seamlessly from procedural hearth fallback to real studio WAV loop,
      // then stop the silent procedural fallback source to free audio-thread DSP!
      safeTargetParam(fireWavGain.gain, 1.0, t, 0.25);
      if (procFireGain) {
        safeTargetParam(procFireGain.gain, 0.0001, t, 0.30);
      }
      if (procFireSource && procFireStopTimer === null) {
        const tid = setTimeout(() => {
          activeTimers.delete(tid);
          procFireStopTimer = null;
          if (fireWavActive) stopProceduralFireFallback();
        }, 1600);
        procFireStopTimer = tid;
        activeTimers.add(tid);
      }
      return true;
    } catch {
      fireWavActive = false;
      return false;
    }
  }

  function ensureGraph() {
    if (disposed) return false;
    const audioCtx = resolveCtx();
    if (!audioCtx) return false;
    const targetDest = resolveDest(audioCtx);
    if (!targetDest) return false;

    if (graphInitialized && graphCtxRef === audioCtx) {
      if (graphDestRef !== targetDest && spatialMasterGain) {
        safeDisconnect(spatialMasterGain);
        try { spatialMasterGain.connect(targetDest); } catch {}
        graphDestRef = targetDest;
      }
      return true;
    }

    // Rebuilding on a new AudioContext
    if (graphInitialized) {
      warmupGeneration++;
      cancelWarmupHandles();
      flushWarmupResumeCallbacks();
      teardownGraph();
      buffers.clear();
      pendingLoads.clear();
      failedKeys.clear();
      preloadInitiated = false;
      preloadCompleted = false;
      preloadCtxRef = null;
      preloadPromise = null;
      cathedralIRBuffer = null;
      cinemaCathedralIRBuffer = null;
      warmNoiseBuffer = null;
      transientNoiseBuffer = null;
    }

    try {
      const t = audioCtx.currentTime;

      // Generate lightweight procedural noise buffers once per AudioContext (~1-2ms total!).
      // Both ConvolverNode cathedral IRs are deferred off frame 0 into idle warmup slices
      // (ensureAmbReverbReady / ensureCinemaReverbReady) so entering Souls NEVER drops a frame!
      warmNoiseBuffer = buildSeamlessWarmNoiseLoop(audioCtx, 3.2);
      transientNoiseBuffer = buildTransientNoiseBuffer(audioCtx, 1.2);

      // Master spatial output bus with transparent analog soft-ceiling limiter (strict <= 0.97 ceiling!)
      spatialMasterGain = audioCtx.createGain();
      spatialMasterGain.gain.setValueAtTime(computeEffectiveMasterGain(), t);
      spatialMasterGain.connect(targetDest);

      let spatialSumDest = spatialMasterGain;
      if (typeof audioCtx.createWaveShaper === 'function') {
        cinemaSoftLimiter = audioCtx.createWaveShaper();
        cinemaSoftLimiter.curve = buildSoftLimiterCurve(1024);
        cinemaSoftLimiter.oversample = '2x';
        cinemaSoftLimiter.connect(spatialMasterGain);
        spatialSumDest = cinemaSoftLimiter;
      }

      dryAmbientBus = audioCtx.createGain();
      dryAmbientBus.gain.setValueAtTime(1.0, t);
      dryAmbientBus.connect(spatialSumDest);

      // Dedicated pristine Dialogue Voice bus (bypasses heavy SFX compressor, protected by soft limiter!)
      voiceGain = audioCtx.createGain();
      voiceGain.gain.setValueAtTime(voiceVolume, t);
      voiceGain.connect(spatialSumDest);

      // 1. Ambient Cathedral Reverb Bus (Convolver warmed off frame 0 -> blooms smoothly to 0.62)
      ambReverbIn = audioCtx.createGain();
      ambReverbIn.gain.setValueAtTime(1.0, t);
      ambReverbHpf = audioCtx.createBiquadFilter();
      ambReverbHpf.type = 'highpass';
      ambReverbHpf.frequency.setValueAtTime(105, t);
      ambReverbLpf = audioCtx.createBiquadFilter();
      ambReverbLpf.type = 'lowpass';
      ambReverbLpf.frequency.setValueAtTime(3400, t);
      ambReverbWetGain = audioCtx.createGain();
      ambReverbWetGain.gain.setValueAtTime(0.0001, t);

      ambReverbIn.connect(ambReverbHpf);
      ambReverbHpf.connect(ambReverbLpf);
      ambReverbNode = null;
      ambReverbReady = false;
      ambReverbWetGain.connect(spatialSumDest);

      // 2. Cinematic Bus Compressor + Dedicated Cathedral Reverb (Convolver warmed off frame 0!)
      if (typeof audioCtx.createDynamicsCompressor === 'function') {
        cinemaCompressor = audioCtx.createDynamicsCompressor();
        cinemaCompressor.threshold.setValueAtTime(-5.0, t);
        cinemaCompressor.knee.setValueAtTime(10.0, t);
        cinemaCompressor.ratio.setValueAtTime(6.0, t);
        cinemaCompressor.attack.setValueAtTime(0.002, t);
        cinemaCompressor.release.setValueAtTime(0.16, t);
      } else {
        cinemaCompressor = audioCtx.createGain();
        cinemaCompressor.gain.setValueAtTime(0.95, t);
      }
      cinemaCompressor.connect(spatialSumDest);

      cinemaReverbIn = audioCtx.createGain();
      cinemaReverbIn.gain.setValueAtTime(1.0, t);
      cinemaReverbHpf = audioCtx.createBiquadFilter();
      cinemaReverbHpf.type = 'highpass';
      cinemaReverbHpf.frequency.setValueAtTime(68, t);
      cinemaReverbLpf = audioCtx.createBiquadFilter();
      cinemaReverbLpf.type = 'lowpass';
      cinemaReverbLpf.frequency.setValueAtTime(2850, t);
      cinemaReverbWetGain = audioCtx.createGain();
      cinemaReverbWetGain.gain.setValueAtTime(0.88, t);

      cinemaReverbIn.connect(cinemaReverbHpf);
      cinemaReverbHpf.connect(cinemaReverbLpf);
      cinemaReverbNode = null;
      cinemaReverbReady = false;
      cinemaReverbWetGain.connect(cinemaCompressor);

      // 3. Spatial Fire Chain (WAV loop + warm procedural hearth rumble fallback)
      fireLpf = audioCtx.createBiquadFilter();
      fireLpf.type = 'lowpass';
      fireLpf.frequency.setValueAtTime(7200, t);
      fireLpf.Q.setValueAtTime(0.65, t);

      firePanner = createStereoPannerSafe(audioCtx);

      fireGain = audioCtx.createGain();
      fireGain.gain.setValueAtTime(0.0001, t);

      fireReverbSend = audioCtx.createGain();
      fireReverbSend.gain.setValueAtTime(0.24, t);

      fireWavGain = audioCtx.createGain();
      fireWavGain.gain.setValueAtTime(0.0001, t);
      fireWavGain.connect(fireLpf);

      // Warm procedural hearth bed (active ONLY while WAV is loading, zero harsh white noise!)
      procFireSource = audioCtx.createBufferSource();
      procFireSource.buffer = warmNoiseBuffer;
      procFireSource.loop = true;

      procFireFilter = audioCtx.createBiquadFilter();
      procFireFilter.type = 'bandpass';
      procFireFilter.frequency.setValueAtTime(185, t);
      procFireFilter.Q.setValueAtTime(0.95, t);

      procFireGain = audioCtx.createGain();
      procFireGain.gain.setValueAtTime(0.52, t);

      procFireSource.connect(procFireFilter);
      procFireFilter.connect(procFireGain);
      procFireGain.connect(fireLpf);
      procFireSource.start(t);

      fireLpf.connect(firePanner);
      firePanner.connect(fireGain);
      fireGain.connect(dryAmbientBus);
      fireGain.connect(fireReverbSend);
      fireReverbSend.connect(ambReverbIn);

      // 4. Vaulted Stone Corridor Cold Wind Draft Chain (dual resonant stone bands)
      windSource = audioCtx.createBufferSource();
      windSource.buffer = warmNoiseBuffer;
      windSource.loop = true;

      // Band A: Deep stone vault cavity rumble (95..155 Hz)
      windVaultBpf = audioCtx.createBiquadFilter();
      windVaultBpf.type = 'bandpass';
      windVaultBpf.frequency.setValueAtTime(118, t);
      windVaultBpf.Q.setValueAtTime(3.8, t);

      windVaultGain = audioCtx.createGain();
      windVaultGain.gain.setValueAtTime(0.92, t);

      // Band B: Cold gothic archway draft whistle (260..420 Hz)
      windDraftBpf = audioCtx.createBiquadFilter();
      windDraftBpf.type = 'bandpass';
      windDraftBpf.frequency.setValueAtTime(315, t);
      windDraftBpf.Q.setValueAtTime(5.2, t);

      windDraftGain = audioCtx.createGain();
      windDraftGain.gain.setValueAtTime(0.24, t);

      windToneLpf = audioCtx.createBiquadFilter();
      windToneLpf.type = 'lowpass';
      windToneLpf.frequency.setValueAtTime(920, t);
      windToneLpf.Q.setValueAtTime(0.7, t);

      windPanner = createStereoPannerSafe(audioCtx);

      windGain = audioCtx.createGain();
      windGain.gain.setValueAtTime(0.0001, t);

      windReverbSend = audioCtx.createGain();
      windReverbSend.gain.setValueAtTime(0.42, t);

      windSource.connect(windVaultBpf);
      windVaultBpf.connect(windVaultGain);
      windVaultGain.connect(windToneLpf);

      windSource.connect(windDraftBpf);
      windDraftBpf.connect(windDraftGain);
      windDraftGain.connect(windToneLpf);

      windToneLpf.connect(windPanner);
      windPanner.connect(windGain);
      windGain.connect(dryAmbientBus);
      windGain.connect(windReverbSend);
      windReverbSend.connect(ambReverbIn);

      windSource.start(t);

      // 5. Gargoyle Pressurized Flame-Jet Gauntlet Chain (Zone 3 — 5 wall traps, ~2.4x visceral roar!)
      jetSource = audioCtx.createBufferSource();
      jetSource.buffer = warmNoiseBuffer;
      jetSource.loop = true;

      jetCrackleSource = audioCtx.createBufferSource();
      jetCrackleSource.buffer = transientNoiseBuffer;
      jetCrackleSource.loop = true;

      jetRoarBpf = audioCtx.createBiquadFilter();
      jetRoarBpf.type = 'bandpass';
      jetRoarBpf.frequency.setValueAtTime(138, t);
      jetRoarBpf.Q.setValueAtTime(1.05, t);
      jetRoarGain = audioCtx.createGain();
      jetRoarGain.gain.setValueAtTime(1.75, t);

      jetBlastBpf = audioCtx.createBiquadFilter();
      jetBlastBpf.type = 'bandpass';
      jetBlastBpf.frequency.setValueAtTime(540, t);
      jetBlastBpf.Q.setValueAtTime(0.85, t);
      jetBlastGain = audioCtx.createGain();
      jetBlastGain.gain.setValueAtTime(0.95, t);

      jetHissBpf = audioCtx.createBiquadFilter();
      jetHissBpf.type = 'bandpass';
      jetHissBpf.frequency.setValueAtTime(1980, t);
      jetHissBpf.Q.setValueAtTime(1.08, t);
      jetHissGain = audioCtx.createGain();
      jetHissGain.gain.setValueAtTime(0.44, t);

      jetLpf = audioCtx.createBiquadFilter();
      jetLpf.type = 'lowpass';
      jetLpf.frequency.setValueAtTime(3400, t);
      jetLpf.Q.setValueAtTime(0.80, t);

      jetPanner = createStereoPannerSafe(audioCtx);
      jetGain = audioCtx.createGain();
      jetGain.gain.setValueAtTime(0.0001, t);
      jetReverbSend = audioCtx.createGain();
      jetReverbSend.gain.setValueAtTime(0.52, t);

      jetSource.connect(jetRoarBpf);
      jetRoarBpf.connect(jetRoarGain);
      jetRoarGain.connect(jetLpf);

      jetSource.connect(jetBlastBpf);
      jetBlastBpf.connect(jetBlastGain);
      jetBlastGain.connect(jetLpf);

      jetSource.connect(jetHissBpf);
      jetCrackleSource.connect(jetHissBpf);
      jetHissBpf.connect(jetHissGain);
      jetHissGain.connect(jetLpf);

      jetLpf.connect(jetPanner);
      jetPanner.connect(jetGain);
      jetGain.connect(dryAmbientBus);
      jetGain.connect(jetReverbSend);
      jetReverbSend.connect(ambReverbIn);

      jetSource.start(t, 0.9);
      jetCrackleSource.start(t, 0.2);

      graphInitialized = true;
      graphCtxRef = audioCtx;
      graphDestRef = targetDest;
      resetAmbientParamCache();

      // Immediately hook up fire WAV if already decoded
      startFireWavLoopIfReady();
      return true;
    } catch {
      teardownGraph();
      return false;
    }
  }

  // ==========================================================================
  // Staggered Non-Blocking Asset Preloader & On-Demand Decoder
  // (Strictly 1 decode in flight during warmup -> zero main-thread microfreezes!)
  // ==========================================================================

  function scheduleWarmupWait(delayMs, useIdle = true) {
    return new Promise((resolve) => {
      if (disposed) {
        resolve(false);
        return;
      }
      const tid = setTimeout(() => {
        activeTimers.delete(tid);
        if (disposed) {
          resolve(false);
          return;
        }
        if (useIdle && typeof requestIdleCallback === 'function') {
          try {
            const handle = requestIdleCallback(() => {
              activeIdleHandles.delete(handle);
              resolve(!disposed);
            }, { timeout: 220 });
            activeIdleHandles.add(handle);
            return;
          } catch {}
        }
        resolve(true);
      }, Math.max(0, delayMs));
      activeTimers.add(tid);
    });
  }

  function waitWhileSuspended(gen) {
    if (disposed || gen !== warmupGeneration) return Promise.resolve(false);
    if (!suspended) return Promise.resolve(true);
    return new Promise((resolve) => {
      warmupResumeCallbacks.push(() => resolve(!disposed && gen === warmupGeneration));
    });
  }

  function loadSampleKey(key, audioCtxOverride = null) {
    if (disposed || !key) return Promise.resolve(null);
    const cached = buffers.get(key);
    if (cached) return Promise.resolve(cached);
    if (failedKeys.has(key)) return Promise.resolve(null);
    const inflight = pendingLoads.get(key);
    if (inflight) return inflight;

    const audioCtx = isAudioContextLike(audioCtxOverride) ? audioCtxOverride : resolveCtx();
    const url = sampleUrls.get(key) || lazyFallbackUrls.get(key);
    if (!audioCtx || !url || typeof fetch !== 'function') {
      return Promise.resolve(null);
    }

    const p = fetch(url)
      .then((res) => {
        if (!res || !res.ok) {
          if (res && res.status === 404) failedKeys.add(key);
          return Promise.reject(new Error(`HTTP ${res ? res.status : 0}`));
        }
        return res.arrayBuffer();
      })
      .then((ab) => {
        if (disposed || !ab) return null;
        return decodeAudioBuffer(audioCtx, ab);
      })
      .then((decoded) => {
        if (decoded && !disposed && (!graphCtxRef || graphCtxRef === audioCtx)) {
          buffers.set(key, decoded);
          failedKeys.delete(key);
          if ((key === 'fire_crackle' || key === 'bonfire_crackle_legacy') && graphInitialized) {
            startFireWavLoopIfReady();
          }
        }
        return decoded || null;
      })
      .catch(() => {
        // Only fall back to legacy bonfire crackle if primary fire_crackle actually fails
        if (
          key === 'fire_crackle' &&
          !disposed &&
          !buffers.has('bonfire_crackle_legacy') &&
          !failedKeys.has('bonfire_crackle_legacy')
        ) {
          return loadSampleKey('bonfire_crackle_legacy', audioCtx);
        }
        return null;
      })
      .finally(() => {
        pendingLoads.delete(key);
      });

    pendingLoads.set(key, p);
    return p;
  }

  function preload(audioCtxOverride = null, preloadOpts = null) {
    if (disposed) return Promise.resolve(false);
    const audioCtx = isAudioContextLike(audioCtxOverride) ? audioCtxOverride : resolveCtx();
    if (!audioCtx || typeof fetch !== 'function') {
      return Promise.resolve(false);
    }

    if (isAudioContextLike(audioCtxOverride) && !ctx) {
      ctx = audioCtxOverride;
    }

    const immediate = Boolean(preloadOpts && preloadOpts.immediate);

    // O(1) zero-allocation fast path: audio.js invokes preloadSoulsAudio(ctx) on every footstep/swing!
    if (!immediate && preloadInitiated && preloadCtxRef === audioCtx && preloadPromise) {
      return preloadPromise;
    }

    preloadInitiated = true;
    preloadCtxRef = audioCtx;

    // Collect remaining un-decoded keys strictly in manifest priority order:
    //   fire_crackle -> door_bolt -> door_open -> boss_intro_armor_shift -> boss_intro_vo_01..07
    const queue = [];
    for (const key of sampleUrls.keys()) {
      if (!buffers.has(key) && !failedKeys.has(key)) {
        queue.push(key);
      }
    }

    if (queue.length === 0 && (!graphInitialized || (ambReverbReady && cinemaReverbReady))) {
      preloadCompleted = true;
      const doneP = Promise.resolve(buffers.size > 0);
      preloadPromise = doneP;
      return doneP;
    }

    const gen = ++warmupGeneration;
    preloadCompleted = false;

    const run = (async () => {
      // Step 0a: Warm up ambient stone hall reverb off frame 0 (blooms in smoothly over 120ms)
      if (graphInitialized && !ambReverbReady && graphCtxRef === audioCtx) {
        if (!immediate) {
          const okA = await scheduleWarmupWait(25, true);
          if (!okA || gen !== warmupGeneration) return buffers.size > 0;
          const unsuspA = await waitWhileSuspended(gen);
          if (!unsuspA) return buffers.size > 0;
        }
        if (graphInitialized && !ambReverbReady && graphCtxRef === audioCtx) {
          ensureAmbReverbReady();
        }
      }

      // Step 0b: Warm up deep cinema cathedral reverb on a separate idle slice
      if (graphInitialized && !cinemaReverbReady && graphCtxRef === audioCtx) {
        if (!immediate) {
          const ok0 = await scheduleWarmupWait(55, true);
          if (!ok0 || gen !== warmupGeneration) return buffers.size > 0;
          const unsusp0 = await waitWhileSuspended(gen);
          if (!unsusp0) return buffers.size > 0;
        }
        if (graphInitialized && !cinemaReverbReady && graphCtxRef === audioCtx) {
          ensureCinemaReverbReady();
        }
      }

      // Steps 1..N: Gently stagger fetch + decodeAudioData 1 file at a time with idle yields
      // so running down the castle NEVER triggers a decodeAudioData main-thread microfreeze!
      for (let i = 0; i < queue.length; i++) {
        if (disposed || gen !== warmupGeneration) return buffers.size > 0;
        const key = queue[i];
        if (buffers.has(key) || failedKeys.has(key)) continue;

        if (!immediate) {
          const unsusp = await waitWhileSuspended(gen);
          if (!unsusp) return buffers.size > 0;

          const delayMs = i === 0
            ? 45
            : key === 'door_open'
              ? 105
              : (key === 'door_bolt' || key === 'boss_intro_armor_shift')
                ? 90
                : 75;
          const ok = await scheduleWarmupWait(delayMs, true);
          if (!ok || gen !== warmupGeneration) return buffers.size > 0;

          const unsuspAfter = await waitWhileSuspended(gen);
          if (!unsuspAfter) return buffers.size > 0;
        }

        if (disposed || gen !== warmupGeneration) return buffers.size > 0;
        if (buffers.has(key) || failedKeys.has(key)) continue;
        await loadSampleKey(key, audioCtx);
      }

      if (!disposed && gen === warmupGeneration) {
        preloadCompleted = true;
      }
      return buffers.size > 0;
    })();

    preloadPromise = run;
    return run;
  }

  // ==========================================================================
  // Organic Procedural Fire Ember Pop (used ONLY before fire WAV finishes loading)
  // ==========================================================================

  function spawnProceduralFireEmberPop(intensity) {
    if (disposed || suspended || muted || !graphInitialized || !graphCtxRef || !transientNoiseBuffer || !fireLpf) {
      return;
    }
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime;
    const dur = 0.005 + Math.random() * 0.011; // ultra-short wood snap (5..16 ms)
    const freq = 1900 + Math.random() * 3800;
    const peak = clamp(intensity * (0.18 + Math.random() * 0.34), 0.02, 0.55);

    try {
      const src = audioCtx.createBufferSource();
      src.buffer = transientNoiseBuffer;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, t0);
      bp.Q.setValueAtTime(2.6 + Math.random() * 2.2, t0);

      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.0012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(bp);
      bp.connect(g);
      g.connect(fireLpf);

      activeTransientNodes.add(src);
      activeTransientNodes.add(bp);
      activeTransientNodes.add(g);

      src.onended = () => {
        safeDisconnect(src);
        safeDisconnect(bp);
        safeDisconnect(g);
        activeTransientNodes.delete(src);
        activeTransientNodes.delete(bp);
        activeTransientNodes.delete(g);
      };

      const maxOffset = Math.max(0, transientNoiseBuffer.duration - dur - 0.02);
      src.start(t0, Math.random() * maxOffset, dur + 0.008);
    } catch {}
  }

  function spawnFlameJetIgnitionBurst(pan, atten) {
    if (disposed || suspended || muted || !graphInitialized || !graphCtxRef || !warmNoiseBuffer || !dryAmbientBus) {
      return;
    }
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime;
    const level = clamp(atten, 0.08, 1.0);
    const localNodes = [];
    try {
      const panner = createStereoPannerSafe(audioCtx);
      if (panner.pan) panner.pan.setValueAtTime(clamp(pan, -0.92, 0.92), t0);
      const dryG = audioCtx.createGain();
      dryG.gain.setValueAtTime(1.32 * level, t0);
      panner.connect(dryG);
      dryG.connect(dryAmbientBus);
      localNodes.push(panner, dryG);

      if (ambReverbIn) {
        const wetG = audioCtx.createGain();
        wetG.gain.setValueAtTime(0.72 * level, t0);
        panner.connect(wetG);
        wetG.connect(ambReverbIn);
        localNodes.push(wetG);
      }

      // Layer A: Deep pressurized furnace detonation WHOOMPH (114 -> 34 Hz + 172 -> 48 Hz punch)
      const sub = audioCtx.createOscillator();
      const subG = audioCtx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(114, t0);
      sub.frequency.exponentialRampToValueAtTime(34, t0 + 0.30);
      subG.gain.setValueAtTime(0.0001, t0);
      subG.gain.linearRampToValueAtTime(0.68, t0 + 0.012);
      subG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      sub.connect(subG);
      subG.connect(panner);
      localNodes.push(sub, subG);
      sub.start(t0);
      sub.stop(t0 + 0.36);

      const punch = audioCtx.createOscillator();
      const punchG = audioCtx.createGain();
      punch.type = 'triangle';
      punch.frequency.setValueAtTime(172, t0);
      punch.frequency.exponentialRampToValueAtTime(48, t0 + 0.16);
      punchG.gain.setValueAtTime(0.0001, t0);
      punchG.gain.linearRampToValueAtTime(0.38, t0 + 0.008);
      punchG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      punch.connect(punchG);
      punchG.connect(panner);
      localNodes.push(punch, punchG);
      punch.start(t0);
      punch.stop(t0 + 0.20);

      // Layer B: Roaring pressurized flame column surge (230 -> 1480 -> 380 Hz)
      const nSrc = audioCtx.createBufferSource();
      nSrc.buffer = warmNoiseBuffer;
      nSrc.loop = true;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(230, t0);
      bp.frequency.exponentialRampToValueAtTime(1480, t0 + 0.095);
      bp.frequency.exponentialRampToValueAtTime(380, t0 + 0.54);
      bp.Q.setValueAtTime(0.95, t0);
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.linearRampToValueAtTime(0.86, t0 + 0.036);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.58);
      nSrc.connect(bp);
      bp.connect(ng);
      ng.connect(panner);
      localNodes.push(nSrc, bp, ng);

      // Layer C: Crisp searing ignition flash & crackle (1100 -> 3100 -> 1350 Hz)
      if (transientNoiseBuffer) {
        const cSrc = audioCtx.createBufferSource();
        cSrc.buffer = transientNoiseBuffer;
        cSrc.loop = true;
        const cBp = audioCtx.createBiquadFilter();
        cBp.type = 'bandpass';
        cBp.frequency.setValueAtTime(1100, t0);
        cBp.frequency.exponentialRampToValueAtTime(3100, t0 + 0.06);
        cBp.frequency.exponentialRampToValueAtTime(1350, t0 + 0.28);
        cBp.Q.setValueAtTime(1.15, t0);
        const cLp = audioCtx.createBiquadFilter();
        cLp.type = 'lowpass';
        cLp.frequency.setValueAtTime(3300, t0);
        const cg = audioCtx.createGain();
        cg.gain.setValueAtTime(0.0001, t0);
        cg.gain.linearRampToValueAtTime(0.48, t0 + 0.018);
        cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
        cSrc.connect(cBp);
        cBp.connect(cLp);
        cLp.connect(cg);
        cg.connect(panner);
        localNodes.push(cSrc, cBp, cLp, cg);
        cSrc.start(t0, Math.random() * 0.8, 0.32);
        cSrc.stop(t0 + 0.33);
      }

      for (let i = 0; i < localNodes.length; i++) activeTransientNodes.add(localNodes[i]);
      nSrc.onended = () => {
        for (let i = 0; i < localNodes.length; i++) {
          safeDisconnect(localNodes[i]);
          activeTransientNodes.delete(localNodes[i]);
        }
      };
      nSrc.start(t0, Math.random() * 1.6, 0.60);
      nSrc.stop(t0 + 0.61);
    } catch {
      for (let i = 0; i < localNodes.length; i++) {
        safeDisconnect(localNodes[i]);
        activeTransientNodes.delete(localNodes[i]);
      }
    }
  }

  function spawnFlameJetCracklePop(pan, atten) {
    if (disposed || suspended || muted || !graphInitialized || !graphCtxRef || !transientNoiseBuffer || !jetPanner) {
      return;
    }
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime;
    const dur = 0.012 + Math.random() * 0.026;
    const freq = 1450 + Math.random() * 1950;
    const peak = clamp(atten * (0.20 + Math.random() * 0.28), 0.03, 0.48);
    try {
      const src = audioCtx.createBufferSource();
      src.buffer = transientNoiseBuffer;
      const bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, t0);
      bp.Q.setValueAtTime(1.8 + Math.random() * 1.6, t0);
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(bp);
      bp.connect(g);
      g.connect(jetLpf || jetPanner);

      activeTransientNodes.add(src);
      activeTransientNodes.add(bp);
      activeTransientNodes.add(g);

      src.onended = () => {
        safeDisconnect(src);
        safeDisconnect(bp);
        safeDisconnect(g);
        activeTransientNodes.delete(src);
        activeTransientNodes.delete(bp);
        activeTransientNodes.delete(g);
      };
      const maxOffset = Math.max(0, transientNoiseBuffer.duration - dur - 0.02);
      src.start(t0, Math.random() * maxOffset, dur + 0.008);
    } catch {}
  }

  // ==========================================================================
  // Per-Frame Spatial Audio Update (ZERO allocations!)
  // ==========================================================================

  function update(listenerX = 0, listenerZ = 21.8, listenerYaw = 0, isInSouls = false, bossAwakened = false, dt = 0.016, liveTrapStates = null) {
    if (disposed) return;

    const safeDt = clamp(finiteOr(Number(dt), 0.016), 0, 0.12);
    const activeSouls = Boolean(isInSouls);
    const awakened = Boolean(bossAwakened);
    lastIsInSouls = activeSouls;
    lastBossAwakened = awakened;

    // Advance paused-aware cinematic timeline if running
    if (cinematicSession && !cinematicSession.stopped && !suspended) {
      stepCinematicSession(safeDt);
    }

    // Sustain gentle music ducking while Boss intro dialogue voice is actively speaking
    if (activeVoice && !activeVoice.stopped && !suspended && !muted) {
      refreshActiveVoiceDucking();
    }

    if (!activeSouls) {
      curFireTargetGain = 0;
      curWindTargetGain = 0;
      curFlameJetTargetGain = 0;
      if (!ambientSilenced && graphInitialized && graphCtxRef && fireGain && windGain) {
        const t = graphCtxRef.currentTime;
        safeTargetParam(fireGain.gain, 0.0001, t, 0.14);
        safeTargetParam(windGain.gain, 0.0001, t, 0.18);
        if (jetGain) safeTargetParam(jetGain.gain, 0.0001, t, 0.10);
        ambientSilenced = true;
        lastSentFireGain = 0.0001;
        lastSentWindGain = 0.0001;
        lastSentJetGain = 0.0001;
      }
      return;
    }

    if (!ensureGraph()) return;
    if (!preloadInitiated) preload();

    const audioCtx = graphCtxRef;
    const t = audioCtx.currentTime;

    if (suspended || muted) {
      if (!ambientSilenced && fireGain && windGain) {
        safeTargetParam(fireGain.gain, 0.0001, t, 0.04);
        safeTargetParam(windGain.gain, 0.0001, t, 0.04);
        if (jetGain) safeTargetParam(jetGain.gain, 0.0001, t, 0.04);
        ambientSilenced = true;
        lastSentFireGain = 0.0001;
        lastSentWindGain = 0.0001;
        lastSentJetGain = 0.0001;
      }
      return;
    }
    ambientSilenced = false;

    clockSec += safeDt;

    const lx = finiteOr(Number(listenerX), 0);
    const lz = finiteOr(Number(listenerZ), 21.8);
    const yaw = finiteOr(Number(listenerYaw), 0);

    // Compute listener horizontal Right vector in world XZ
    // 'camera_orbit': yaw=0 looks North (-Z), right = (+cos(yaw), -sin(yaw))
    // 'actor_facing': facing=0 looks South (+Z), right = (-cos(yaw), +sin(yaw))
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    const rightX = yawConvention === 'actor_facing' ? -cosY : cosY;
    const rightZ = yawConvention === 'actor_facing' ? sinY : -sinY;

    // ------------------------------------------------------------------------
    // 1. Spatial Fire Field: Bonfires + 12 Floor Braziers
    //    Energy-weighted stereo imaging avoids hard pan snaps between symmetric braziers!
    // ------------------------------------------------------------------------
    let bestAtten = 0;
    let bestDist = Infinity;
    let bestId = null;
    let sumEnergy = 0;
    let weightedPanSum = 0;
    let secondaryEnergy = 0;

    for (let i = 0; i < fireSources.length; i++) {
      const f = fireSources[i];
      const dx = f.x - lx;
      const dz = f.z - lz;
      const dSq = dx * dx + dz * dz;
      if (dSq >= f.maxDistSq) continue;

      const d = Math.sqrt(dSq);
      const norm = clamp((d - f.refDist) * f.invDistSpan, 0, 1);
      // Warm perceptual inverse rolloff with smooth zero-slope fadeout at maxDist
      const rawAtten = Math.pow(1.0 - norm, 2.15) * f.weight;
      if (rawAtten <= 0.0005) continue;

      if (rawAtten > bestAtten) {
        secondaryEnergy += bestAtten * 0.24;
        bestAtten = rawAtten;
        bestDist = d;
        bestId = f.id;
      } else {
        secondaryEnergy += rawAtten * 0.24;
      }

      // Compute stereo pan contribution for this fire source (-1 left .. +1 right)
      let pan = 0;
      if (d > 0.05) {
        const invD = 1.0 / d;
        const projRight = (dx * rightX + dz * rightZ) * invD;
        // Soft near-field width narrowing when standing almost directly over the flames
        const nearScale = d < 1.35 ? clamp(d / 1.35, 0.12, 1.0) : 1.0;
        pan = clamp(projRight * 0.88 * nearScale, -0.92, 0.92);
      }

      const weightSq = rawAtten * rawAtten;
      weightedPanSum += pan * weightSq;
      sumEnergy += weightSq;
    }

    const totalFirePresence = clamp(bestAtten + Math.min(0.28, secondaryEnergy), 0, 1.35);
    const stereoPan = sumEnergy > 1e-6 ? clamp(weightedPanSum / sumEnergy, -0.92, 0.92) : 0;

    // Gentle living flame breathing modulation (±7% organic flicker)
    const flameBreath = 1.0 + 0.055 * Math.sin(clockSec * 3.7) + 0.032 * Math.sin(clockSec * 9.3 + 1.1);
    const voiceActive = Boolean(activeVoice && !activeVoice.stopped);
    const cinemaDuck = (cinematicSession && !cinematicSession.stopped) ? 0.36 : (voiceActive ? 0.42 : 1.0);
    const combatDuck = awakened ? 0.62 : 1.0;

    // Target fire gain: warm & vivid beside Bonfire (~0.38), clear beside Braziers (~0.29), silent far away
    const targetFireGain = totalFirePresence > 0.004
      ? clamp(totalFirePresence * 0.315 * flameBreath * cinemaDuck * combatDuck, 0.0001, 0.48)
      : 0.0001;

    // Distance air-absorption filter: crisp 9.5 kHz close -> warm 1.7 kHz distant
    const proxNorm = bestDist < Infinity ? clamp((bestDist - 1.5) / 11.5, 0, 1) : 1;
    const targetFireCutoff = 9400 - proxNorm * 7700;
    const targetFireRevSend = 0.18 + proxNorm * 0.34;

    if (!(Math.abs(targetFireGain - lastSentFireGain) < 0.0012)) {
      safeTargetParam(fireGain.gain, targetFireGain, t, 0.075);
      lastSentFireGain = targetFireGain;
    }
    if (!(Math.abs(stereoPan - lastSentFirePan) < 0.005)) {
      setPannerValue(firePanner, stereoPan, t, 0.055);
      lastSentFirePan = stereoPan;
    }
    if (!(Math.abs(targetFireCutoff - lastSentFireCutoff) < 24)) {
      safeTargetParam(fireLpf.frequency, targetFireCutoff, t, 0.08);
      lastSentFireCutoff = targetFireCutoff;
    }
    if (!(Math.abs(targetFireRevSend - lastSentFireRev) < 0.004)) {
      safeTargetParam(fireReverbSend.gain, targetFireRevSend, t, 0.12);
      lastSentFireRev = targetFireRevSend;
    }

    // Organic procedural ember crackles ONLY while studio fire WAV is still loading
    if (!fireWavActive && targetFireGain > 0.025 && clockSec >= nextEmberPopAt) {
      spawnProceduralFireEmberPop(clamp(totalFirePresence, 0.2, 1.0));
      nextEmberPopAt = clockSec + 0.055 + Math.random() * 0.19;
    }

    // ------------------------------------------------------------------------
    // 2. Vaulted Stone Corridor Cold Resonant Wind Draft
    // ------------------------------------------------------------------------
    const zoneIdx = classifyCastleAcoustics(lx, lz);
    curZoneIdx = zoneIdx;

    // Target corridor/vault acoustic presence by room:
    //   0 courtyard (Bonfire Hall): 0.38
    //   1 corridor (High Vaulted Nave): 1.00
    //   2 east_alcove (Chapel): 0.62
    //   3 boss_hall (26m Circular Cathedral): 0.88 (pre-fight) / 0.44 (awakened)
    let wantCorridor = 0.38;
    let baseVaultFreq = 114;
    let baseDraftFreq = 295;
    let wantRevSend = 0.38;

    if (zoneIdx === 1) {
      // High vaulted stone corridor: strongest deep resonant draft!
      // Swells even deeper near the middle of the corridor & approaching the Boss Doors
      const doorApproach = clamp((LAYOUT_CORRIDOR_MAX_Z - lz) / LAYOUT_CORRIDOR_SPAN_Z, 0, 1);
      wantCorridor = 0.88 + doorApproach * 0.20;
      baseVaultFreq = 104 + doorApproach * 18;
      baseDraftFreq = 315 + doorApproach * 55;
      wantRevSend = 0.54;
    } else if (zoneIdx === 2) {
      // Quiet stone relic chapel alcove
      wantCorridor = 0.58;
      baseVaultFreq = 128;
      baseDraftFreq = 275;
      wantRevSend = 0.48;
    } else if (zoneIdx === 3) {
      // Vast Boss Throne Cathedral: deeper cavernous pitch
      wantCorridor = awakened ? 0.44 : 0.86;
      baseVaultFreq = awakened ? 92 : 98;
      baseDraftFreq = awakened ? 245 : 265;
      wantRevSend = 0.68;
    }

    // Smooth corridor factor transitions between rooms
    const zoneLerp = 1.0 - Math.exp(-2.8 * safeDt);
    curCorridorFactor += (wantCorridor - curCorridorFactor) * zoneLerp;

    // Slow organic wind gusts breathing through gothic arches (never static!)
    const gustSlow = 0.80 + 0.20 * Math.sin(clockSec * 0.41 + 0.5) + 0.11 * Math.sin(clockSec * 0.93 + 2.2);
    const pitchDriftVault = baseVaultFreq + Math.sin(clockSec * 0.29) * 14.0 + Math.cos(clockSec * 0.67) * 6.0;
    const pitchDriftDraft = baseDraftFreq + Math.sin(clockSec * 0.37 + 1.3) * 42.0 + Math.sin(clockSec * 0.83) * 18.0;

    // During cutscene: hush wind slightly during Act 1 bolt/push, swell as doors open (0.85..5.35s), calm for dialogue
    let cinemaWindMult = 1.0;
    if (cinematicSession && !cinematicSession.stopped) {
      const ce = cinematicSession.elapsedSec;
      if (ce < 0.85) cinemaWindMult = 0.55;
      else if (ce < 5.35) cinemaWindMult = 1.32;
      else cinemaWindMult = 0.45;
    } else if (voiceActive) {
      cinemaWindMult = 0.42;
    }

    const targetWindGain = clamp(0.24 * curCorridorFactor * gustSlow * cinemaWindMult, 0.0001, 0.36);

    // Subtle stereo wind drift (pulled faintly toward open East Archway when passing z in [-2, 4])
    let draftPan = Math.sin(clockSec * 0.23) * 0.24;
    if (zoneIdx === 1 && lz > LAYOUT_ALCOVE_MIN_Z - 0.5 && lz < LAYOUT_ALCOVE_MAX_Z + 0.5) {
      // East archway opens to +X
      const archPull = 0.22 * (rightX);
      draftPan = clamp(draftPan + archPull, -0.55, 0.55);
    }

    const targetVaultFreq = clamp(pitchDriftVault, 70, 195);
    const targetDraftFreq = clamp(pitchDriftDraft, 190, 520);
    const targetDraftGain = clamp(0.18 + curCorridorFactor * 0.16, 0.14, 0.38);

    if (!(Math.abs(targetWindGain - lastSentWindGain) < 0.0012)) {
      safeTargetParam(windGain.gain, targetWindGain, t, 0.22);
      lastSentWindGain = targetWindGain;
    }
    if (!(Math.abs(targetVaultFreq - lastSentWindVaultFreq) < 0.8)) {
      safeTargetParam(windVaultBpf.frequency, targetVaultFreq, t, 0.25);
      lastSentWindVaultFreq = targetVaultFreq;
    }
    if (!(Math.abs(targetDraftFreq - lastSentWindDraftFreq) < 2.0)) {
      safeTargetParam(windDraftBpf.frequency, targetDraftFreq, t, 0.22);
      lastSentWindDraftFreq = targetDraftFreq;
    }
    if (!(Math.abs(targetDraftGain - lastSentWindDraftGain) < 0.003)) {
      safeTargetParam(windDraftGain.gain, targetDraftGain, t, 0.25);
      lastSentWindDraftGain = targetDraftGain;
    }
    if (!(Math.abs(wantRevSend - lastSentWindRev) < 0.004)) {
      safeTargetParam(windReverbSend.gain, wantRevSend, t, 0.22);
      lastSentWindRev = wantRevSend;
    }
    if (!(Math.abs(draftPan - lastSentWindPan) < 0.005)) {
      setPannerValue(windPanner, draftPan, t, 0.18);
      lastSentWindPan = draftPan;
    }

    // ------------------------------------------------------------------------
    // 3. Gargoyle Pressurized Flame-Jet Gauntlet (Zone 3 — 5 wall traps)
    //    Synchronized 1:1 with visual flame jets + ~2.4x visceral roar, crackle & ignition blast!
    // ------------------------------------------------------------------------
    let bestJetAtten = 0;
    let secondaryJetEnergy = 0;
    let bestJetDist = Infinity;
    let sumJetEnergy = 0;
    let weightedJetPan = 0;
    let maxJetPower = 0;
    let maxTeleHiss = 0;

    const hasLiveTraps = Array.isArray(liveTrapStates) && liveTrapStates.length > 0;
    const trapCount = hasLiveTraps
      ? liveTrapStates.length
      : (Array.isArray(SOULS_CASTLE_FLAME_TRAPS) ? SOULS_CASTLE_FLAME_TRAPS.length : 0);

    // Evaluate full jet geometry when listener is within hearing range of Zone 3 (z in [-14, +48])
    if (trapCount > 0 && lz >= -14.0 && lz <= 48.0 && !awakened) {
      for (let i = 0; i < trapCount; i++) {
        let ox = 0;
        let oz = 0;
        let dirX = 1;
        let reach = 0;
        let jetPow = 0;
        let tele01 = 0;
        let isFiring = false;
        let justIgnited = false;

        if (hasLiveTraps) {
          const st = liveTrapStates[i];
          if (!st) continue;
          ox = finiteOr(st.originX, 0);
          oz = finiteOr(st.originZ, 18);
          dirX = finiteOr(st.dirX, 1);
          reach = finiteOr(st.jetReach, 0);
          jetPow = finiteOr(st.jetPower, 0);
          tele01 = st.state === 'telegraph' ? finiteOr(st.telegraph01, 0) : 0;
          isFiring = st.state === 'firing' && jetPow > 0.05;
          justIgnited = Boolean(st.justStartedFiring) || (isFiring && i < trapWasFiring.length && trapWasFiring[i] === 0);
        } else {
          const tr = SOULS_CASTLE_FLAME_TRAPS[i];
          if (!tr) continue;
          const ev = evaluateFlameTrapState(tr, clockSec);
          ox = tr.x;
          oz = tr.z;
          dirX = tr.dirX || 1;
          isFiring = ev.phase === 'jet' && ev.intensity > 0.05;
          jetPow = isFiring ? ev.intensity : 0;
          tele01 = ev.phase === 'telegraph' ? ev.phase01 : 0;
          reach = isFiring ? (tr.jetLength || 9.8) * Math.min(1, 0.35 + 0.65 * (ev.phase01 / 0.14)) : 0;
          justIgnited = isFiring && i < trapWasFiring.length && trapWasFiring[i] === 0;
        }
        if (i < trapWasFiring.length) {
          trapWasFiring[i] = isFiring ? 1 : 0;
        }

        // Closest point along active horizontal flame stream [ox .. ox + dirX * reach] at oz
        const endX = ox + dirX * reach;
        const segMinX = ox < endX ? ox : endX;
        const segMaxX = ox > endX ? ox : endX;
        const cx = isFiring ? clamp(lx, segMinX, segMaxX) : ox;
        const dx = cx - lx;
        const dz = oz - lz;
        const dSq = dx * dx + dz * dz;
        if (dSq >= 625.0) continue; // 25m corridor hearing range

        const d = Math.sqrt(dSq);
        const distNorm = clamp((d - 2.4) / 21.6, 0, 1);
        const distAtten = Math.pow(1.0 - distNorm, 1.55);
        if (distAtten <= 0.002) continue;

        let pan = 0;
        if (d > 0.08) {
          const invD = 1.0 / d;
          const projR = (dx * rightX + dz * rightZ) * invD;
          const nearNarrow = d < 1.6 ? clamp(d / 1.6, 0.15, 1.0) : 1.0;
          pan = clamp(projR * 0.90 * nearNarrow, -0.92, 0.92);
        }

        if (justIgnited && distAtten > 0.06 && clockSec - lastJetBurstAt > 0.09) {
          lastJetBurstAt = clockSec;
          spawnFlameJetIgnitionBurst(pan, distAtten * cinemaDuck);
        }

        const trapActivity = isFiring ? jetPow : (tele01 > 0.02 ? tele01 * 0.28 : 0);
        if (trapActivity <= 0.004) continue;

        const contrib = distAtten * trapActivity;
        if (contrib > bestJetAtten) {
          secondaryJetEnergy += bestJetAtten * 0.28;
          bestJetAtten = contrib;
          bestJetDist = d;
        } else {
          secondaryJetEnergy += contrib * 0.28;
        }
        if (jetPow * distAtten > maxJetPower) maxJetPower = jetPow * distAtten;
        if (tele01 * distAtten > maxTeleHiss) maxTeleHiss = tele01 * distAtten;

        const wSq = contrib * contrib;
        weightedJetPan += pan * wSq;
        sumJetEnergy += wSq;
      }
    } else {
      trapWasFiring.fill(0);
    }

    const totalJetPresence = clamp(bestJetAtten + Math.min(0.35, secondaryJetEnergy), 0, 1.38);
    const jetTurbulence = 1.0 + 0.12 * Math.sin(clockSec * 18.2) + 0.08 * Math.sin(clockSec * 31.4 + 0.7);
    const targetJetGain = totalJetPresence > 0.004
      ? clamp(totalJetPresence * 1.32 * jetTurbulence * cinemaDuck, 0.0001, 1.48)
      : 0.0001;
    const targetJetPan = sumJetEnergy > 1e-6 ? clamp(weightedJetPan / sumJetEnergy, -0.92, 0.92) : 0;
    const jetProxNorm = bestJetDist < Infinity ? clamp((bestJetDist - 2.0) / 18.0, 0, 1) : 1;
    // Wide 3400 Hz close-up (~2600-3400 Hz across corridor lane) -> 1550 Hz far away
    const targetJetCutoff = 3400 - jetProxNorm * 1850;
    const targetBlastGain = 0.55 + clamp(maxJetPower, 0, 1) * 1.10;
    const targetHissGain = 0.24 + clamp(maxTeleHiss * 0.56 + maxJetPower * 0.54, 0, 0.88);

    // Live searing flame crackle snaps while active corridor jets roar nearby
    if (maxJetPower > 0.14 && clockSec >= nextJetCrackleAt) {
      spawnFlameJetCracklePop(targetJetPan, clamp(maxJetPower * cinemaDuck, 0.15, 1.0));
      nextJetCrackleAt = clockSec + 0.038 + Math.random() * 0.062;
    }

    if (jetGain && !(Math.abs(targetJetGain - lastSentJetGain) < 0.0015)) {
      safeTargetParam(jetGain.gain, targetJetGain, t, targetJetGain > (lastSentJetGain || 0) ? 0.038 : 0.075);
      lastSentJetGain = targetJetGain;
    }
    if (jetPanner && !(Math.abs(targetJetPan - lastSentJetPan) < 0.006)) {
      setPannerValue(jetPanner, targetJetPan, t, 0.05);
      lastSentJetPan = targetJetPan;
    }
    if (jetLpf && !(Math.abs(targetJetCutoff - lastSentJetCutoff) < 28)) {
      safeTargetParam(jetLpf.frequency, targetJetCutoff, t, 0.065);
      lastSentJetCutoff = targetJetCutoff;
    }
    if (jetBlastGain && !(Math.abs(targetBlastGain - lastSentJetBlastGain) < 0.008)) {
      safeTargetParam(jetBlastGain.gain, targetBlastGain, t, 0.05);
      lastSentJetBlastGain = targetBlastGain;
    }
    if (jetHissGain && !(Math.abs(targetHissGain - lastSentJetHissGain) < 0.008)) {
      safeTargetParam(jetHissGain.gain, targetHissGain, t, 0.05);
      lastSentJetHissGain = targetHissGain;
    }

    // Record telemetry
    curNearestFireId = bestId;
    curNearestFireDist = bestDist;
    curFireTargetGain = targetFireGain;
    curFireTargetPan = stereoPan;
    curWindTargetGain = targetWindGain;
    curFlameJetTargetGain = targetJetGain;
    curFlameJetTargetPan = targetJetPan;
  }

  // ==========================================================================
  // 7.2-Second Theatrical Boss Door Cutscene Audio Synthesis & Playback
  // ==========================================================================

  function registerSessionNode(session, node) {
    if (!session || !node) return node;
    session.nodes.add(node);
    return node;
  }

  function releaseSessionNodes(session, list) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      safeDisconnect(n);
      if (session) session.nodes.delete(n);
    }
  }

  /**
   * Plays a loaded studio WAV inside a cinematic session with optional stereo pan sweep,
   * cathedral reverb send, and crisp EQ sculpting.
   */
  function playCinematicSample(session, buffer, {
    gain = 1.0,
    rate = 1.0,
    reverbSend = 0.65,
    panStart = 0,
    panEnd = 0,
    panDur = 1.0,
    lowShelfDb = 0,
    lowShelfFreq = 120
  } = {}) {
    if (!session || session.stopped || !buffer || !graphCtxRef) return false;
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime;
    const localNodes = [];

    try {
      const src = registerSessionNode(session, audioCtx.createBufferSource());
      src.buffer = buffer;
      src.playbackRate.setValueAtTime(rate, t0);
      localNodes.push(src);

      let chain = src;

      if (lowShelfDb !== 0) {
        const ls = registerSessionNode(session, audioCtx.createBiquadFilter());
        ls.type = 'lowshelf';
        ls.frequency.setValueAtTime(lowShelfFreq, t0);
        ls.gain.setValueAtTime(lowShelfDb, t0);
        chain.connect(ls);
        chain = ls;
        localNodes.push(ls);
      }

      if (panStart !== 0 || panEnd !== 0) {
        const panner = registerSessionNode(session, createStereoPannerSafe(audioCtx));
        if (panner.pan) {
          panner.pan.setValueAtTime(clamp(panStart, -1, 1), t0);
          if (panEnd !== panStart) {
            panner.pan.linearRampToValueAtTime(clamp(panEnd, -1, 1), t0 + Math.max(0.05, panDur));
          }
        }
        chain.connect(panner);
        chain = panner;
        localNodes.push(panner);
      }

      const dryG = registerSessionNode(session, audioCtx.createGain());
      dryG.gain.setValueAtTime(gain, t0);
      chain.connect(dryG);
      dryG.connect(session.dryBus);
      localNodes.push(dryG);

      if (reverbSend > 0.001 && session.revBus) {
        const wetG = registerSessionNode(session, audioCtx.createGain());
        wetG.gain.setValueAtTime(gain * reverbSend, t0);
        chain.connect(wetG);
        wetG.connect(session.revBus);
        localNodes.push(wetG);
      }

      src.onended = () => releaseSessionNodes(session, localNodes);
      src.start(t0);
      return true;
    } catch {
      releaseSessionNodes(session, localNodes);
      return false;
    }
  }

  /**
   * Utility: spawns a pitched modal metallic/wood oscillator burst inside the cinematic session.
   */
  function spawnCinematicTone(session, {
    type = 'sine',
    freqStart = 120,
    freqMid = null,
    midAt = 0.2,
    freqEnd = 45,
    delay = 0,
    attack = 0.006,
    duration = 0.4,
    gainPeak = 0.3,
    reverbSend = 0.45,
    filterType = null,
    filterFreq = 1200,
    filterQ = 2.0,
    pan = 0,
    toSub = false
  } = {}) {
    if (!session || session.stopped || !graphCtxRef) return;
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime + Math.max(0, delay);
    const dur = Math.max(0.02, duration);
    const atk = Math.min(dur * 0.45, Math.max(0.0015, attack));
    const localNodes = [];

    try {
      const osc = registerSessionNode(session, audioCtx.createOscillator());
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(18, freqStart), t0);
      if (freqMid !== null && midAt > 0 && midAt < dur) {
        osc.frequency.linearRampToValueAtTime(Math.max(18, freqMid), t0 + midAt);
      }
      osc.frequency.exponentialRampToValueAtTime(Math.max(18, freqEnd), t0 + dur);
      localNodes.push(osc);

      let chain = osc;
      if (filterType) {
        const flt = registerSessionNode(session, audioCtx.createBiquadFilter());
        flt.type = filterType;
        flt.frequency.setValueAtTime(filterFreq, t0);
        flt.Q.setValueAtTime(filterQ, t0);
        chain.connect(flt);
        chain = flt;
        localNodes.push(flt);
      }

      const g = registerSessionNode(session, audioCtx.createGain());
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, gainPeak), t0 + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      chain.connect(g);
      chain = g;
      localNodes.push(g);

      if (pan !== 0 && !toSub) {
        const panner = registerSessionNode(session, createStereoPannerSafe(audioCtx));
        if (panner.pan) panner.pan.setValueAtTime(clamp(pan, -1, 1), t0);
        chain.connect(panner);
        chain = panner;
        localNodes.push(panner);
      }

      chain.connect(toSub ? session.subBus : session.dryBus);

      if (!toSub && reverbSend > 0.001 && session.revBus) {
        const wet = registerSessionNode(session, audioCtx.createGain());
        wet.gain.setValueAtTime(reverbSend, t0);
        chain.connect(wet);
        wet.connect(session.revBus);
        localNodes.push(wet);
      }

      osc.onended = () => releaseSessionNodes(session, localNodes);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch {
      releaseSessionNodes(session, localNodes);
    }
  }

  /**
   * Utility: spawns a filtered noise texture burst (stone scrape, iron rattle, rushing cold air).
   */
  function spawnCinematicNoise(session, {
    warm = false,
    filterType = 'bandpass',
    freqStart = 600,
    freqMid = null,
    midAt = 0.2,
    freqEnd = 240,
    q = 2.0,
    delay = 0,
    attack = 0.015,
    duration = 0.45,
    gainPeak = 0.25,
    reverbSend = 0.5,
    panStart = 0,
    panEnd = 0
  } = {}) {
    if (!session || session.stopped || !graphCtxRef) return;
    const buf = warm ? warmNoiseBuffer : transientNoiseBuffer;
    if (!buf) return;
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime + Math.max(0, delay);
    const dur = Math.max(0.02, duration);
    const atk = Math.min(dur * 0.48, Math.max(0.002, attack));
    const localNodes = [];

    try {
      const src = registerSessionNode(session, audioCtx.createBufferSource());
      src.buffer = buf;
      src.loop = true;
      localNodes.push(src);

      const flt = registerSessionNode(session, audioCtx.createBiquadFilter());
      flt.type = filterType;
      flt.frequency.setValueAtTime(Math.max(30, freqStart), t0);
      if (freqMid !== null && midAt > 0 && midAt < dur) {
        flt.frequency.linearRampToValueAtTime(Math.max(30, freqMid), t0 + midAt);
      }
      flt.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
      flt.Q.setValueAtTime(Math.max(0.3, q), t0);
      localNodes.push(flt);

      const g = registerSessionNode(session, audioCtx.createGain());
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, gainPeak), t0 + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      localNodes.push(g);

      src.connect(flt);
      flt.connect(g);
      let chain = g;

      if (panStart !== 0 || panEnd !== 0) {
        const panner = registerSessionNode(session, createStereoPannerSafe(audioCtx));
        if (panner.pan) {
          panner.pan.setValueAtTime(clamp(panStart, -1, 1), t0);
          if (panEnd !== panStart) {
            panner.pan.linearRampToValueAtTime(clamp(panEnd, -1, 1), t0 + dur);
          }
        }
        chain.connect(panner);
        chain = panner;
        localNodes.push(panner);
      }

      chain.connect(session.dryBus);

      if (reverbSend > 0.001 && session.revBus) {
        const wet = registerSessionNode(session, audioCtx.createGain());
        wet.gain.setValueAtTime(reverbSend, t0);
        chain.connect(wet);
        wet.connect(session.revBus);
        localNodes.push(wet);
      }

      src.onended = () => releaseSessionNodes(session, localNodes);
      src.start(t0, Math.random() * Math.max(0.1, buf.duration * 0.5));
      src.stop(t0 + dur + 0.03);
    } catch {
      releaseSessionNodes(session, localNodes);
    }
  }

  // --------------------------------------------------------------------------
  // Stage 1 (t = 0.05s): RAW heavy iron scrape / crossbar lift (`souls_env_door_bolt.wav`)
  // NO synthetic metallic "ring" or bell modes — only the raw studio scrape + weight.
  // --------------------------------------------------------------------------
  function executeStageBolt(session) {
    const wav = buffers.get('door_bolt');
    const playedWav = wav
      ? playCinematicSample(session, wav, {
        gain: 1.0,
        rate: 1.0,
        reverbSend: 0.55,
        panStart: -0.12,
        panEnd: 0.04,
        panDur: 0.95,
        lowShelfDb: 2.5,
        lowShelfFreq: 130
      })
      : false;

    // Sub-bass weight of the iron crossbar leaving its stone keepers (pure sine, no ring)
    spawnCinematicTone(session, {
      type: 'sine',
      freqStart: 92,
      freqEnd: 36,
      delay: 0.0,
      attack: 0.006,
      duration: 0.34,
      gainPeak: playedWav ? 0.30 : 0.44,
      toSub: true
    });

    // Only if the WAV is still decoding: toneless stone-on-iron grind (filtered noise, no pitched modes)
    if (!playedWav) {
      spawnCinematicNoise(session, {
        warm: false,
        filterType: 'bandpass',
        freqStart: 520,
        freqMid: 980,
        midAt: 0.30,
        freqEnd: 300,
        q: 0.9,
        delay: 0.02,
        attack: 0.05,
        duration: 1.0,
        gainPeak: 0.30,
        reverbSend: 0.55,
        panStart: -0.18,
        panEnd: 0.10
      });
    }
  }

  // --------------------------------------------------------------------------
  // Stage 2 (t = 0.42s): Hero's straining push — pure sub-bass timber/stone pressure + dust grit.
  // No tonal/ringing layers: the raw scrape sample carries every groan and creak.
  // --------------------------------------------------------------------------
  function executeStagePush(session) {
    // Masonry & timber pressure when the hero leans shoulders into the oak
    spawnCinematicTone(session, {
      type: 'sine',
      freqStart: 74,
      freqMid: 56,
      midAt: 0.14,
      freqEnd: 33,
      delay: 0.0,
      attack: 0.014,
      duration: 0.64,
      gainPeak: 0.40,
      toSub: true
    });

    // Falling stone dust & threshold grit (warm filtered noise — broadband, never pitched)
    spawnCinematicNoise(session, {
      warm: true,
      filterType: 'bandpass',
      freqStart: 200,
      freqMid: 420,
      midAt: 0.5,
      freqEnd: 150,
      q: 0.8,
      delay: 0.04,
      attack: 0.14,
      duration: 1.1,
      gainPeak: 0.26,
      reverbSend: 0.58,
      panStart: -0.12,
      panEnd: 0.12
    });
  }

  // --------------------------------------------------------------------------
  // Stage 3 (t = 0.85s): RAW monumental hinge / stone scrape (`souls_env_door_open.wav`, ~4.45s)
  // played wide, loud and unprocessed, with a deep cathedral sub-bass. No synthetic rings.
  // --------------------------------------------------------------------------
  function executeStageOpen(session) {
    const wav = buffers.get('door_open');
    const playedWav = wav
      ? playCinematicSample(session, wav, {
        gain: 0.96,
        rate: 1.0,
        reverbSend: 0.70,
        panStart: 0.0,
        panEnd: 0.0,
        lowShelfDb: 3.0,
        lowShelfFreq: 115
      })
      : false;

    // Deep tectonic sub-bass weight of the twin gates grinding across the whole swing (pure sine)
    spawnCinematicTone(session, {
      type: 'sine',
      freqStart: 46,
      freqMid: 55,
      midAt: 1.6,
      freqEnd: 32,
      delay: 0.02,
      attack: 0.30,
      duration: 3.9,
      gainPeak: playedWav ? 0.34 : 0.48,
      toSub: true
    });

    // Cold unknown cathedral draft rushing past through the widening doorway (broadband, stereo sweep)
    spawnCinematicNoise(session, {
      warm: true,
      filterType: 'bandpass',
      freqStart: 140,
      freqMid: 360,
      midAt: 2.0,
      freqEnd: 170,
      q: 0.9,
      delay: 0.2,
      attack: 0.7,
      duration: 3.8,
      gainPeak: playedWav ? 0.22 : 0.40,
      reverbSend: 0.82,
      panStart: -0.30,
      panEnd: 0.30
    });

    // Procedural scrape ONLY while the WAV is still decoding (broadband noise, no pitched creak)
    if (!playedWav) {
      spawnCinematicNoise(session, {
        warm: false,
        filterType: 'bandpass',
        freqStart: 300,
        freqMid: 760,
        midAt: 1.8,
        freqEnd: 230,
        q: 0.9,
        delay: 0.05,
        attack: 0.35,
        duration: 3.9,
        gainPeak: 0.36,
        reverbSend: 0.74,
        panStart: -0.2,
        panEnd: 0.2
      });
    }
  }

  // --------------------------------------------------------------------------
  // Optional Stage: Echoing Boss Roar (only if explicitly invoked via triggerCinematicStage('roar'))
  // --------------------------------------------------------------------------
  function executeStageRoar(session) {
    const wav = buffers.get('boss_cutscene_roar') || buffers.get('boss_roar_legacy');
    const playedWav = wav
      ? playCinematicSample(session, wav, {
        gain: 1.08,
        rate: 0.97,
        reverbSend: 0.92,
        lowShelfDb: 3.5,
        lowShelfFreq: 105
      })
      : false;

    // Layer A: Chest-shaking sub-bass seismic presence beneath the giant's roar
    spawnCinematicTone(session, {
      type: 'sine',
      freqStart: 58,
      freqMid: 46,
      midAt: 0.55,
      freqEnd: 30,
      delay: 0.03,
      attack: 0.14,
      duration: 1.75,
      gainPeak: playedWav ? 0.34 : 0.52,
      toSub: true
    });

    // Layer B: Ringing incandescent forged warhammer scrape/toll echoing across the throne hall
    const hammerModes = [
      { f0: 294, f1: 289, d: 0.08, dur: 1.45, g: 0.16, pan: 0.24 },
      { f0: 618, f1: 604, d: 0.09, dur: 1.15, g: 0.13, pan: 0.28 },
      { f0: 1470, f1: 1435, d: 0.10, dur: 0.85, g: 0.09, pan: 0.32 }
    ];
    const hammerMult = playedWav ? 0.65 : 1.0;
    for (let i = 0; i < hammerModes.length; i++) {
      const hm = hammerModes[i];
      spawnCinematicTone(session, {
        type: 'sine',
        freqStart: hm.f0,
        freqEnd: hm.f1,
        delay: hm.d,
        attack: 0.005,
        duration: hm.dur,
        gainPeak: hm.g * hammerMult,
        reverbSend: 0.90,
        pan: hm.pan
      });
    }

    // Layer C: Procedural Giant Formant Roar fallback (ONLY if neither roar WAV is decoded)
    if (!playedWav) {
      spawnCinematicTone(session, {
        type: 'sawtooth',
        freqStart: 108,
        freqMid: 152,
        midAt: 0.35,
        freqEnd: 52,
        delay: 0.0,
        attack: 0.12,
        duration: 1.85,
        gainPeak: 0.42,
        filterType: 'bandpass',
        filterFreq: 420,
        filterQ: 3.4,
        reverbSend: 0.94
      });
      spawnCinematicTone(session, {
        type: 'sawtooth',
        freqStart: 162,
        freqMid: 224,
        midAt: 0.40,
        freqEnd: 74,
        delay: 0.04,
        attack: 0.16,
        duration: 1.72,
        gainPeak: 0.30,
        filterType: 'bandpass',
        filterFreq: 860,
        filterQ: 4.0,
        reverbSend: 0.94
      });
      spawnCinematicNoise(session, {
        warm: true,
        filterType: 'bandpass',
        freqStart: 360,
        freqMid: 740,
        midAt: 0.38,
        freqEnd: 190,
        q: 1.8,
        delay: 0.02,
        attack: 0.10,
        duration: 1.78,
        gainPeak: 0.44,
        reverbSend: 0.90
      });
    }
  }

  function dispatchCinematicStage(session, stageId) {
    if (!session || session.stopped) return;
    if (stageId === 'bolt') executeStageBolt(session);
    else if (stageId === 'push') executeStagePush(session);
    else if (stageId === 'open') executeStageOpen(session);
    else if (stageId === 'roar') executeStageRoar(session);
    else return;

    if (typeof session.onStage === 'function') {
      try { session.onStage(stageId, session.elapsedSec); } catch {}
    }
  }

  // ==========================================================================
  // Pause-Aware Cinematic Session Scheduler
  // ==========================================================================

  function createCinematicSessionBus() {
    ensureCinemaReverbReady();
    const audioCtx = graphCtxRef;
    const t = audioCtx.currentTime;

    const sessionMaster = audioCtx.createGain();
    sessionMaster.gain.setValueAtTime(1.0, t);

    const dryBus = audioCtx.createGain();
    dryBus.gain.setValueAtTime(1.0, t);
    dryBus.connect(sessionMaster);

    const subBus = audioCtx.createGain();
    subBus.gain.setValueAtTime(1.0, t);
    subBus.connect(sessionMaster);

    // Dedicated session send into cinemaReverbIn (which itself feeds cinemaCompressor)
    const revBus = audioCtx.createGain();
    revBus.gain.setValueAtTime(1.0, t);
    revBus.connect(cinemaReverbIn);

    sessionMaster.connect(cinemaCompressor);

    return { sessionMaster, dryBus, subBus, revBus };
  }

  function scheduleNextCinematicTimer(session) {
    if (!session || session.stopped || suspended || disposed) return;
    if (session.timerId !== null) {
      clearTimeout(session.timerId);
      activeTimers.delete(session.timerId);
      session.timerId = null;
    }

    // Find next unfired stage
    let nextStage = null;
    for (let i = 0; i < session.stages.length; i++) {
      if (!session.stages[i].fired) {
        nextStage = session.stages[i];
        break;
      }
    }

    if (!nextStage) {
      // Schedule graceful natural completion after final cathedral reverb tail of outward door opening
      const tailRemainMs = Math.max(40, Math.ceil((BOSS_DOOR_AUDIO_SEQUENCE_DURATION - session.elapsedSec) * 1000));
      const tid = setTimeout(() => {
        activeTimers.delete(tid);
        if (session === cinematicSession && !session.stopped) {
          finalizeCinematicSession(session, 0.05);
        }
      }, tailRemainMs);
      session.timerId = tid;
      activeTimers.add(tid);
      return;
    }

    const remainSec = Math.max(0, nextStage.atSec - session.elapsedSec);
    const delayMs = Math.max(12, Math.ceil(remainSec * 1000));
    const tid = setTimeout(() => {
      activeTimers.delete(tid);
      if (session !== cinematicSession || session.stopped || suspended || disposed) return;
      session.timerId = null;
      // Only advance from wall-clock if game loop update(dt) is not actively driving the timeline
      const now = nowMs();
      if (now - session.lastFrameStepMs > 80) {
        syncSessionWallClock(session);
      }
      flushDueCinematicStages(session);
      scheduleNextCinematicTimer(session);
    }, delayMs);
    session.timerId = tid;
    activeTimers.add(tid);
  }

  function syncSessionWallClock(session) {
    if (!session || session.stopped || suspended) return;
    const now = nowMs();
    const wallDt = Math.max(0, (now - session.lastWallMs) * 0.001);
    session.lastWallMs = now;
    // Clamp large wall jumps (e.g. debugger pause) cleanly
    session.elapsedSec += Math.min(wallDt, 0.25);
  }

  function flushDueCinematicStages(session) {
    if (!session || session.stopped || suspended) return;
    let firedAny = false;
    for (let i = 0; i < session.stages.length; i++) {
      const st = session.stages[i];
      if (!st.fired && session.elapsedSec + 0.008 >= st.atSec) {
        st.fired = true;
        firedAny = true;
        dispatchCinematicStage(session, st.id);
      }
    }
    // Check if all stages have fired and natural sequence duration + tail has completed
    if (firedAny && session.timerId === null) {
      scheduleNextCinematicTimer(session);
    }
    if (session.elapsedSec >= BOSS_DOOR_AUDIO_SEQUENCE_DURATION) {
      finalizeCinematicSession(session, 0.05);
    }
  }

  function stepCinematicSession(dt) {
    const session = cinematicSession;
    if (!session || session.stopped || suspended) return;
    // Frame-driven advancement keeps cues locked tightly to game animation frame rate (0 drift!)
    const now = nowMs();
    session.elapsedSec += dt;
    session.lastWallMs = now;
    session.lastFrameStepMs = now;
    flushDueCinematicStages(session);
  }

  function finalizeCinematicSession(session, fadeSec = 0.08) {
    if (!session || session.stopped) return;
    session.stopped = true;

    if (session.timerId !== null) {
      clearTimeout(session.timerId);
      activeTimers.delete(session.timerId);
      session.timerId = null;
    }
    if (session === cinematicSession) {
      cinematicSession = null;
    }

    const audioCtx = graphCtxRef;
    const safeFade = Math.max(0, finiteOr(Number(fadeSec), 0.08));
    const myRevToken = ++cinemaRevToken;

    const cleanupNodes = () => {
      activeSessions.delete(session);
      for (const n of session.nodes) {
        safeStop(n);
        safeDisconnect(n);
      }
      session.nodes.clear();
      safeDisconnect(session.dryBus);
      safeDisconnect(session.subBus);
      safeDisconnect(session.revBus);
      safeDisconnect(session.sessionMaster);

      // Restore cinemaReverbWetGain for future sequences only if no newer session superseded us
      if (cinemaReverbWetGain && graphCtxRef && !disposed && cinemaRevToken === myRevToken) {
        const tNow = graphCtxRef.currentTime;
        safeTargetParam(cinemaReverbWetGain.gain, 0.88, tNow, 0.04);
      }
    };

    if (!audioCtx || safeFade <= 0.005) {
      cleanupNodes();
      return;
    }

    const t = audioCtx.currentTime;
    // Check if any OTHER unstopped session is still using the shared cinematic reverb
    let otherLiveSession = false;
    for (const s of activeSessions) {
      if (s !== session && !s.stopped) {
        otherLiveSession = true;
        break;
      }
    }

    try {
      session.sessionMaster.gain.cancelScheduledValues(t);
      const curM = finiteOr(session.sessionMaster.gain.value, 1.0);
      session.sessionMaster.gain.setValueAtTime(Math.max(0.0001, curM), t);
      session.sessionMaster.gain.linearRampToValueAtTime(0.0001, t + safeFade);

      session.revBus.gain.cancelScheduledValues(t);
      session.revBus.gain.setValueAtTime(Math.max(0.0001, finiteOr(session.revBus.gain.value, 1.0)), t);
      session.revBus.gain.linearRampToValueAtTime(0.0001, t + safeFade);

      // Swiftly fade shared cinematic convolver wet return on skip when no other cinematic session is live
      if (cinemaReverbWetGain && !otherLiveSession) {
        cinemaReverbWetGain.gain.cancelScheduledValues(t);
        const curW = finiteOr(cinemaReverbWetGain.gain.value, 0.88);
        cinemaReverbWetGain.gain.setValueAtTime(Math.max(0.0001, curW), t);
        cinemaReverbWetGain.gain.linearRampToValueAtTime(0.0001, t + safeFade);
      }
    } catch {}

    const cleanupTid = setTimeout(() => {
      activeTimers.delete(cleanupTid);
      cleanupNodes();
    }, Math.ceil((safeFade + 0.04) * 1000));
    activeTimers.add(cleanupTid);
  }

  function playCinematicBossDoorSequence(seqOpts = {}) {
    if (disposed) return false;
    if (!ensureGraph()) return false;
    ensureCinemaReverbReady();
    if (!preloadInitiated) preload();

    // Prioritize door samples immediately if cutscene starts before staggered background warmup finishes
    if (!buffers.has('door_bolt') && !failedKeys.has('door_bolt')) {
      loadSampleKey('door_bolt', graphCtxRef);
    }
    if (!buffers.has('door_open') && !failedKeys.has('door_open')) {
      loadSampleKey('door_open', graphCtxRef);
    }

    // Cleanly stop any previous sequence first
    if (cinematicSession && !cinematicSession.stopped) {
      finalizeCinematicSession(cinematicSession, 0.04);
    }

    // Ensure cinematic reverb wet return is at full theatrical richness
    cinemaRevToken++;
    if (cinemaReverbWetGain && graphCtxRef) {
      const t = graphCtxRef.currentTime;
      try {
        cinemaReverbWetGain.gain.cancelScheduledValues(t);
        cinemaReverbWetGain.gain.setValueAtTime(0.88, t);
      } catch {}
    }

    const startOffset = clamp(finiteOr(Number(seqOpts?.startOffsetSec), 0), 0, BOSS_DOOR_AUDIO_SEQUENCE_DURATION);
    const buses = createCinematicSessionBus();

    const stages = [];
    for (let i = 0; i < BOSS_DOOR_CINEMATIC_STAGES.length; i++) {
      const st = BOSS_DOOR_CINEMATIC_STAGES[i];
      stages.push({
        id: st.id,
        atSec: st.atSec,
        fired: st.atSec < startOffset - 0.01
      });
    }

    const now = nowMs();
    const session = {
      id: now,
      elapsedSec: startOffset,
      lastWallMs: now,
      lastFrameStepMs: 0,
      stopped: false,
      timerId: null,
      stages,
      nodes: new Set(),
      onStage: typeof seqOpts?.onStage === 'function' ? seqOpts.onStage : null,
      sessionMaster: buses.sessionMaster,
      dryBus: buses.dryBus,
      subBus: buses.subBus,
      revBus: buses.revBus
    };

    cinematicSession = session;
    activeSessions.add(session);

    if (!suspended) {
      flushDueCinematicStages(session);
      scheduleNextCinematicTimer(session);
    }
    return true;
  }

  function stopCinematicSequence(fadeSec = 0.08) {
    const stoppedVoice = stopBossIntroVoice(fadeSec);
    let stoppedDoor = false;
    if (cinematicSession && !cinematicSession.stopped) {
      finalizeCinematicSession(cinematicSession, fadeSec);
      stoppedDoor = true;
    }
    return stoppedDoor || stoppedVoice;
  }

  // ==========================================================================
  // Boss Intro Dialogue Voice (10 Lines: boss_intro_vo_01..10.mp3) & Throne Armor Shift
  // Strictly edge-triggered by cutscene timeline -> 0 drift even across pauses/ads!
  // ==========================================================================

  function resolveVoiceLineSpec(cueIndex) {
    const idx = Math.floor(Number(cueIndex));
    if (!Number.isFinite(idx) || idx < 1 || idx > BOSS_INTRO_VOICE_LINES.length) return null;
    return BOSS_INTRO_VOICE_LINES[idx - 1];
  }

  function clearVoiceDuckTimer() {
    if (voiceDuckTimer !== null) {
      clearTimeout(voiceDuckTimer);
      activeTimers.delete(voiceDuckTimer);
      voiceDuckTimer = null;
    }
  }

  function invokeMusicDuck(holdSec = 0.15, releaseSec = 0.9, overrideFn = null) {
    const fn = typeof overrideFn === 'function' ? overrideFn : duckMusicFn;
    if (typeof fn !== 'function') return;
    lastVoiceDuckMs = nowMs();
    try {
      fn(-9.0, holdSec, releaseSec);
    } catch {}
  }

  function getVoiceElapsedSec(voice, audioCtx) {
    if (!voice || !audioCtx) return 0;
    const elapsed = Math.max(0, audioCtx.currentTime - voice.startedAtCtx);
    return clamp((voice.offsetAtStart || 0) + elapsed, 0, Math.max(0.01, voice.duration || 0.01));
  }

  function refreshActiveVoiceDucking() {
    if (!activeVoice || activeVoice.stopped || suspended || muted || disposed) return;
    const now = nowMs();
    if (now - lastVoiceDuckMs < 750) return;
    const audioCtx = graphCtxRef;
    if (!audioCtx) return;
    const played = getVoiceElapsedSec(activeVoice, audioCtx);
    const remain = Math.max(0, (activeVoice.duration || 0) - played);
    if (remain > 0.25) {
      invokeMusicDuck(clamp(remain, 0.15, 4.5), 0.9, activeVoice.duckFn);
    }
  }

  function scheduleVoiceDuckRefresh(voice) {
    clearVoiceDuckTimer();
    if (!voice || voice.stopped || suspended || disposed) return;
    const fn = typeof voice.duckFn === 'function' ? voice.duckFn : duckMusicFn;
    if (typeof fn !== 'function') return;

    const audioCtx = graphCtxRef;
    const played = audioCtx ? getVoiceElapsedSec(voice, audioCtx) : 0;
    const remain = Math.max(0, (voice.duration || 0) - played);
    if (remain <= 0.85) return;

    const tid = setTimeout(() => {
      activeTimers.delete(tid);
      if (voiceDuckTimer === tid) voiceDuckTimer = null;
      if (voice !== activeVoice || voice.stopped || suspended || disposed) return;
      const curPlayed = graphCtxRef ? getVoiceElapsedSec(voice, graphCtxRef) : played + 1.0;
      const curRemain = Math.max(0, (voice.duration || 0) - curPlayed);
      if (curRemain > 0.25) {
        invokeMusicDuck(clamp(curRemain, 0.15, 4.5), 0.9, voice.duckFn);
        scheduleVoiceDuckRefresh(voice);
      }
    }, 1000);
    voiceDuckTimer = tid;
    activeTimers.add(tid);
  }

  function destroyVoiceEntry(voice) {
    if (!voice) return;
    voice.stopped = true;
    if (voice.fadeTimer !== null) {
      clearTimeout(voice.fadeTimer);
      activeTimers.delete(voice.fadeTimer);
      voice.fadeTimer = null;
    }
    if (activeVoice === voice) {
      activeVoice = null;
      clearVoiceDuckTimer();
    }
    fadingVoices.delete(voice);
    try { if (voice.source) voice.source.onended = null; } catch {}
    safeStop(voice.source);
    safeDisconnect(voice.source);
    safeDisconnect(voice.gain);
    voice.source = null;
    voice.gain = null;
  }

  function fadeOutVoiceEntry(voice, fadeSec = 0.08) {
    if (!voice || voice.stopped) return;
    voice.stopped = true;
    if (activeVoice === voice) {
      activeVoice = null;
      clearVoiceDuckTimer();
    }
    fadingVoices.add(voice);

    const audioCtx = graphCtxRef;
    const safeFade = Math.max(0, finiteOr(Number(fadeSec), 0.08));
    if (!audioCtx || !voice.gain || safeFade <= 0.005) {
      destroyVoiceEntry(voice);
      return;
    }

    const t = audioCtx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(t);
      const cur = finiteOr(voice.gain.gain.value, 1.0);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, cur), t);
      voice.gain.gain.linearRampToValueAtTime(0.0001, t + safeFade);
    } catch {
      destroyVoiceEntry(voice);
      return;
    }

    if (voice.fadeTimer !== null) {
      clearTimeout(voice.fadeTimer);
      activeTimers.delete(voice.fadeTimer);
    }
    const tid = setTimeout(() => {
      activeTimers.delete(tid);
      voice.fadeTimer = null;
      destroyVoiceEntry(voice);
    }, Math.ceil((safeFade + 0.035) * 1000));
    voice.fadeTimer = tid;
    activeTimers.add(tid);
  }

  function startDecodedVoiceBuffer(spec, buffer, {
    offsetSec = 0,
    gainScale = 1.0,
    duckMusic: duckOverride = null,
    onEnded = null
  } = {}) {
    if (disposed || suspended || !graphInitialized || !graphCtxRef || !voiceGain || !buffer) {
      return false;
    }
    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime;
    const safeDur = Math.max(0.05, finiteOr(buffer.duration, spec.durationSec || 1.0));
    const safeOffset = clamp(finiteOr(Number(offsetSec), 0), 0, Math.max(0, safeDur - 0.02));
    const remainDur = Math.max(0.02, safeDur - safeOffset);
    const targetGain = clamp(finiteOr(Number(gainScale), 1.0), 0.05, 1.5);

    try {
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;

      const g = audioCtx.createGain();
      // Subtle 10 ms de-click attack when resuming mid-line; crisp 4 ms onset from start
      const atk = safeOffset > 0.01 ? 0.012 : 0.004;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(targetGain, t0 + atk);

      src.connect(g);
      g.connect(voiceGain);

      const voice = {
        cueIndex: spec.index,
        key: spec.key,
        source: src,
        gain: g,
        startedAtCtx: t0,
        offsetAtStart: safeOffset,
        duration: safeDur,
        stopped: false,
        fadeTimer: null,
        duckFn: typeof duckOverride === 'function' ? duckOverride : null
      };

      src.onended = () => {
        const wasActive = activeVoice === voice && !voice.stopped;
        destroyVoiceEntry(voice);
        if (wasActive && typeof onEnded === 'function') {
          try { onEnded(spec.index); } catch {}
        }
      };

      src.start(t0, safeOffset);
      activeVoice = voice;

      // Softly hold music ducking at -9.0 dB so music never masks the Boss's spoken voice!
      const initialHold = clamp(remainDur, 0.15, 4.5);
      invokeMusicDuck(initialHold, 0.9, voice.duckFn);
      scheduleVoiceDuckRefresh(voice);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Plays Boss intro dialogue voice line `cueIndex` (1..10 -> `boss_intro_vo_01..10.mp3`)
   * through the dedicated clean `voiceGain` bus, cutting any previous voice cleanly and
   * softly ducking music via optional `duckMusic(-9.0, holdSec, 0.9)`.
   */
  function playBossIntroVoiceLine(cueIndex, playOpts = {}) {
    if (disposed) return false;
    const spec = resolveVoiceLineSpec(cueIndex);
    if (!spec) return false;
    if (!ensureGraph()) return false;
    if (!preloadInitiated) preload();

    // Interrupt any currently speaking line smoothly (zero overlap!)
    if (activeVoice && !activeVoice.stopped) {
      fadeOutVoiceEntry(activeVoice, 0.035);
    }
    pausedVoiceCueIndex = 0;
    pausedVoiceOffsetSec = 0;

    const token = ++voicePlayToken;
    const offsetSec = clamp(finiteOr(Number(playOpts?.offsetSec), 0), 0, spec.durationSec);

    // If suspended (e.g. Yandex Games ad), remember exact line so resume() speaks it cleanly
    if (suspended) {
      pausedVoiceCueIndex = spec.index;
      pausedVoiceOffsetSec = offsetSec;
      return true;
    }

    const buf = buffers.get(spec.key);
    if (buf) {
      return startDecodedVoiceBuffer(spec, buf, {
        offsetSec,
        gainScale: playOpts?.gain ?? 1.0,
        duckMusic: playOpts?.duckMusic ?? null,
        onEnded: playOpts?.onEnded ?? null
      });
    }

    // On-demand async fallback if MP3 is still decoding in flight
    const requestedAtMs = nowMs();
    loadSampleKey(spec.key).then((decoded) => {
      if (!decoded || disposed || token !== voicePlayToken) return;
      if (suspended) {
        pausedVoiceCueIndex = spec.index;
        pausedVoiceOffsetSec = offsetSec;
        return;
      }
      // Keep sync tight if decode took < 250 ms; avoid skipping short opening syllables
      const decodeDelaySec = (nowMs() - requestedAtMs) * 0.001;
      const syncOffset = decodeDelaySec > 0.18 && decodeDelaySec < decoded.duration * 0.5
        ? offsetSec + decodeDelaySec
        : offsetSec;
      startDecodedVoiceBuffer(spec, decoded, {
        offsetSec: syncOffset,
        gainScale: playOpts?.gain ?? 1.0,
        duckMusic: playOpts?.duckMusic ?? null,
        onEnded: playOpts?.onEnded ?? null
      });
    });
    return true;
  }

  /**
   * Stops any active or fading Boss intro voice line cleanly (and cancels pending decodes).
   * Automatically called inside `stopCinematicSequence()` on cutscene skip.
   */
  function stopBossIntroVoice(fadeSec = 0.08) {
    voicePlayToken++;
    pausedVoiceCueIndex = 0;
    pausedVoiceOffsetSec = 0;
    clearVoiceDuckTimer();

    let stoppedAny = false;
    if (activeVoice && !activeVoice.stopped) {
      fadeOutVoiceEntry(activeVoice, fadeSec);
      stoppedAny = true;
    }
    for (const v of Array.from(fadingVoices)) {
      if (fadeSec <= 0.005) {
        destroyVoiceEntry(v);
      }
    }
    return stoppedAny;
  }

  /**
   * Plays subtle heavy steel armor & oiled leather shift / warhammer grip Foley
   * (`boss_intro_armor_shift.wav`, with a rich procedural steel+leather fallback).
   */
  function playBossArmorShift(intensity = 1.0) {
    if (disposed || suspended || muted) return false;
    if (!ensureGraph()) return false;
    ensureCinemaReverbReady();
    if (!preloadInitiated) preload();

    const audioCtx = graphCtxRef;
    const t0 = audioCtx.currentTime;
    const scale = clamp(finiteOr(Number(intensity), 1.0), 0.15, 1.6);
    const wav = buffers.get('boss_intro_armor_shift');
    if (!wav && !failedKeys.has('boss_intro_armor_shift')) {
      loadSampleKey('boss_intro_armor_shift', audioCtx);
    }

    if (wav) {
      const localNodes = [];
      try {
        const src = audioCtx.createBufferSource();
        src.buffer = wav;
        src.playbackRate.setValueAtTime(0.97 + Math.random() * 0.06, t0);

        const panner = createStereoPannerSafe(audioCtx);
        if (panner.pan) {
          panner.pan.setValueAtTime(-0.08, t0);
          panner.pan.linearRampToValueAtTime(0.08, t0 + Math.min(1.1, wav.duration || 1.0));
        }

        const dryG = audioCtx.createGain();
        dryG.gain.setValueAtTime(0.76 * scale, t0);

        src.connect(panner);
        panner.connect(dryG);
        dryG.connect(cinemaCompressor);
        localNodes.push(src, panner, dryG);

        if (cinemaReverbIn) {
          const wetG = audioCtx.createGain();
          wetG.gain.setValueAtTime(0.28 * scale, t0);
          panner.connect(wetG);
          wetG.connect(cinemaReverbIn);
          localNodes.push(wetG);
        }

        for (let i = 0; i < localNodes.length; i++) activeTransientNodes.add(localNodes[i]);
        src.onended = () => {
          for (let i = 0; i < localNodes.length; i++) {
            safeDisconnect(localNodes[i]);
            activeTransientNodes.delete(localNodes[i]);
          }
        };
        src.start(t0);
        return true;
      } catch {
        for (let i = 0; i < localNodes.length; i++) {
          safeDisconnect(localNodes[i]);
          activeTransientNodes.delete(localNodes[i]);
        }
        return false;
      }
    }

    // Rich procedural fallback: oiled leather shift + damped steel cuirass plate settle + grip thud
    const localNodes = [];
    try {
      const bus = audioCtx.createGain();
      bus.gain.setValueAtTime(0.85 * scale, t0);
      bus.connect(cinemaCompressor);
      localNodes.push(bus);

      if (cinemaReverbIn) {
        const wet = audioCtx.createGain();
        wet.gain.setValueAtTime(0.32 * scale, t0);
        bus.connect(wet);
        wet.connect(cinemaReverbIn);
        localNodes.push(wet);
      }

      // Layer 1: Warm leather & mail rustle
      if (warmNoiseBuffer) {
        const nSrc = audioCtx.createBufferSource();
        nSrc.buffer = warmNoiseBuffer;
        nSrc.loop = true;
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(280, t0);
        bp.frequency.linearRampToValueAtTime(590, t0 + 0.24);
        bp.frequency.exponentialRampToValueAtTime(210, t0 + 0.68);
        bp.Q.setValueAtTime(1.8, t0);
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.0001, t0);
        ng.gain.linearRampToValueAtTime(0.34, t0 + 0.14);
        ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.72);
        nSrc.connect(bp);
        bp.connect(ng);
        ng.connect(bus);
        localNodes.push(nSrc, bp, ng);
        nSrc.start(t0, Math.random() * 1.5);
        nSrc.stop(t0 + 0.76);
      }

      // Layer 2: Damped steel plate settle modes (subtle nobleman armor weight)
      const plateModes = [
        { f0: 355, f1: 332, at: 0.08, dur: 0.24, g: 0.11 },
        { f0: 710, f1: 668, at: 0.14, dur: 0.19, g: 0.08 },
        { f0: 1290, f1: 1210, at: 0.28, dur: 0.16, g: 0.06 }
      ];
      for (let i = 0; i < plateModes.length; i++) {
        const m = plateModes[i];
        const osc = audioCtx.createOscillator();
        const og = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(m.f0, t0 + m.at);
        osc.frequency.exponentialRampToValueAtTime(m.f1, t0 + m.at + m.dur);
        og.gain.setValueAtTime(0.0001, t0 + m.at);
        og.gain.linearRampToValueAtTime(m.g, t0 + m.at + 0.006);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + m.at + m.dur);
        osc.connect(og);
        og.connect(bus);
        localNodes.push(osc, og);
        osc.start(t0 + m.at);
        osc.stop(t0 + m.at + m.dur + 0.02);
      }

      // Layer 3: Subtle warhammer shaft grip settle thump
      const grip = audioCtx.createOscillator();
      const gripG = audioCtx.createGain();
      grip.type = 'sine';
      grip.frequency.setValueAtTime(84, t0 + 0.34);
      grip.frequency.exponentialRampToValueAtTime(42, t0 + 0.54);
      gripG.gain.setValueAtTime(0.0001, t0 + 0.34);
      gripG.gain.linearRampToValueAtTime(0.18, t0 + 0.35);
      gripG.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.56);
      grip.connect(gripG);
      gripG.connect(bus);
      localNodes.push(grip, gripG);
      grip.start(t0 + 0.34);
      grip.stop(t0 + 0.58);

      for (let i = 0; i < localNodes.length; i++) activeTransientNodes.add(localNodes[i]);
      const tid = setTimeout(() => {
        activeTimers.delete(tid);
        for (let i = 0; i < localNodes.length; i++) {
          safeDisconnect(localNodes[i]);
          activeTransientNodes.delete(localNodes[i]);
        }
      }, 860);
      activeTimers.add(tid);
      return true;
    } catch {
      for (let i = 0; i < localNodes.length; i++) {
        safeDisconnect(localNodes[i]);
        activeTransientNodes.delete(localNodes[i]);
      }
      return false;
    }
  }

  function triggerCinematicStage(stageId) {
    if (disposed) return false;
    // Closing door SFX is intentionally disabled in the Boss cutscene audio engine
    if (stageId !== 'bolt' && stageId !== 'push' && stageId !== 'open' && stageId !== 'roar') {
      return false;
    }
    if (!ensureGraph()) return false;
    ensureCinemaReverbReady();
    if (!preloadInitiated) preload();

    if (stageId === 'open' && !buffers.has('door_open') && !failedKeys.has('door_open')) {
      loadSampleKey('door_open', graphCtxRef);
    } else if (stageId === 'bolt' && !buffers.has('door_bolt') && !failedKeys.has('door_bolt')) {
      loadSampleKey('door_bolt', graphCtxRef);
    }

    cinemaRevToken++;
    if (cinemaReverbWetGain && graphCtxRef) {
      const t = graphCtxRef.currentTime;
      try {
        cinemaReverbWetGain.gain.cancelScheduledValues(t);
        cinemaReverbWetGain.gain.setValueAtTime(0.88, t);
      } catch {}
    }

    // Spawn an auto-expiring mini-session for single-stage triggers (e.g., manual door open)
    const buses = createCinematicSessionBus();
    const now = nowMs();
    const miniSession = {
      id: now,
      elapsedSec: 0,
      lastWallMs: now,
      lastFrameStepMs: 0,
      stopped: false,
      timerId: null,
      stages: [],
      nodes: new Set(),
      onStage: null,
      sessionMaster: buses.sessionMaster,
      dryBus: buses.dryBus,
      subBus: buses.subBus,
      revBus: buses.revBus
    };
    activeSessions.add(miniSession);
    dispatchCinematicStage(miniSession, stageId);

    const ttlMs = stageId === 'open' ? 6200 : stageId === 'roar' ? 5400 : 4200;
    const tid = setTimeout(() => {
      activeTimers.delete(tid);
      finalizeCinematicSession(miniSession, 0.05);
    }, ttlMs);
    miniSession.timerId = tid;
    activeTimers.add(tid);
    return true;
  }

  // ==========================================================================
  // Yandex Games Lifecycle Compliance: suspend() / resume()
  // ==========================================================================

  function suspend() {
    if (disposed || suspended) return;
    suspended = true;

    // Freeze active cinematic door timeline exactly where it paused (never fire cues during ads!)
    if (cinematicSession && !cinematicSession.stopped) {
      syncSessionWallClock(cinematicSession);
      if (cinematicSession.timerId !== null) {
        clearTimeout(cinematicSession.timerId);
        activeTimers.delete(cinematicSession.timerId);
        cinematicSession.timerId = null;
      }
    }

    // Pause active Boss intro dialogue line at exact offset so Yandex ads / tab hide never cut off speech!
    clearVoiceDuckTimer();
    if (activeVoice && !activeVoice.stopped) {
      const audioCtx = graphCtxRef;
      const playedSec = audioCtx ? getVoiceElapsedSec(activeVoice, audioCtx) : (activeVoice.offsetAtStart || 0);
      if (playedSec < (activeVoice.duration || 0) - 0.08) {
        pausedVoiceCueIndex = activeVoice.cueIndex;
        pausedVoiceOffsetSec = playedSec;
      } else {
        pausedVoiceCueIndex = 0;
        pausedVoiceOffsetSec = 0;
      }
      fadeOutVoiceEntry(activeVoice, 0.03);
    }

    // Smooth click-free silence on spatial master bus
    syncSpatialMasterGain(0.02);
    if (graphInitialized && graphCtxRef && fireGain && windGain) {
      const t = graphCtxRef.currentTime;
      safeTargetParam(fireGain.gain, 0.0001, t, 0.02);
      safeTargetParam(windGain.gain, 0.0001, t, 0.02);
      if (jetGain) safeTargetParam(jetGain.gain, 0.0001, t, 0.02);
      ambientSilenced = true;
      lastSentFireGain = 0.0001;
      lastSentWindGain = 0.0001;
      lastSentJetGain = 0.0001;
    }
  }

  function resume() {
    if (disposed || !suspended) return;
    suspended = false;
    resetAmbientParamCache();

    syncSpatialMasterGain(0.05);
    flushWarmupResumeCallbacks();

    // Resume paused cinematic door timeline seamlessly from exact paused timestamp
    if (cinematicSession && !cinematicSession.stopped) {
      cinematicSession.lastWallMs = nowMs();
      scheduleNextCinematicTimer(cinematicSession);
    }

    // Resume interrupted Boss intro voice line from exact paused second!
    if (pausedVoiceCueIndex >= 1 && pausedVoiceCueIndex <= BOSS_INTRO_VOICE_LINES.length) {
      const resumeCue = pausedVoiceCueIndex;
      const resumeOff = pausedVoiceOffsetSec;
      pausedVoiceCueIndex = 0;
      pausedVoiceOffsetSec = 0;
      playBossIntroVoiceLine(resumeCue, { offsetSec: resumeOff });
    }
  }

  // ==========================================================================
  // Configuration, Context Rebinding & Complete Leak-Free Dispose
  // ==========================================================================

  function attachContext(nextAudioCtx, nextMasterGain = null) {
    if (disposed) return false;
    // O(1) steady-state fast path (called every frame from audio.updateSoulsSpatial!)
    if (
      graphInitialized &&
      nextAudioCtx === graphCtxRef &&
      (!nextMasterGain || nextMasterGain === graphDestRef)
    ) {
      if (!preloadInitiated) preload(graphCtxRef);
      return true;
    }
    if (isAudioContextLike(nextAudioCtx)) {
      ctx = nextAudioCtx;
    }
    if (nextMasterGain) {
      destNode = nextMasterGain;
    }
    const ok = ensureGraph();
    if (ok && !preloadInitiated) {
      preload();
    }
    return ok;
  }

  function setVolume(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return masterVolume;
    masterVolume = clamp(num, 0, 1.5);
    syncSpatialMasterGain(0.04);
    return masterVolume;
  }

  function getVolume() {
    return masterVolume;
  }

  function setVoiceVolume(val) {
    const num = Number(val);
    if (!Number.isFinite(num)) return voiceVolume;
    voiceVolume = clamp(num, 0, 1.6);
    if (voiceGain && graphCtxRef && !disposed) {
      safeTargetParam(voiceGain.gain, voiceVolume, graphCtxRef.currentTime, 0.03);
    }
    return voiceVolume;
  }

  function getVoiceVolume() {
    return voiceVolume;
  }

  function setDuckMusicCallback(fn) {
    duckMusicFn = typeof fn === 'function' ? fn : null;
  }

  /**
   * Allows runtime replacement of any Boss intro VO file (1..7) — e.g. user custom audio swap.
   */
  function setBossIntroVoiceUrl(cueIndex, url) {
    const spec = resolveVoiceLineSpec(cueIndex);
    if (!spec || typeof url !== 'string' || !url.trim()) return false;
    sampleUrls.set(spec.key, url.trim());
    buffers.delete(spec.key);
    pendingLoads.delete(spec.key);
    failedKeys.delete(spec.key);
    preloadCompleted = false;
    preloadPromise = null;
    preloadInitiated = false;
    return true;
  }

  function setMuted(bool) {
    muted = Boolean(bool);
    if (!muted) resetAmbientParamCache();
    syncSpatialMasterGain(0.03);
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function isSuspended() {
    return suspended;
  }

  function isCinematicPlaying() {
    return Boolean(cinematicSession && !cinematicSession.stopped);
  }

  function getCinematicElapsed() {
    return cinematicSession && !cinematicSession.stopped ? cinematicSession.elapsedSec : 0;
  }

  function isBossIntroVoicePlaying() {
    return Boolean(activeVoice && !activeVoice.stopped);
  }

  function getActiveVoiceCueIndex() {
    return activeVoice && !activeVoice.stopped ? activeVoice.cueIndex : 0;
  }

  function getDebugState() {
    let loadedVoiceCount = 0;
    for (let i = 0; i < BOSS_INTRO_VOICE_LINES.length; i++) {
      if (buffers.has(BOSS_INTRO_VOICE_LINES[i].key)) loadedVoiceCount++;
    }
    return {
      version: SOULS_SPATIAL_AUDIO_VERSION,
      initialized: graphInitialized,
      ambReverbReady,
      cinemaReverbReady,
      preloadCompleted,
      disposed,
      suspended,
      muted,
      volume: masterVolume,
      voiceVolume,
      isInSouls: lastIsInSouls,
      bossAwakened: lastBossAwakened,
      fireSourceCount: fireSources.length,
      fireWavActive,
      loadedSamples: Array.from(buffers.keys()),
      loadedVoiceCount,
      hasArmorShiftSample: buffers.has('boss_intro_armor_shift'),
      voiceActive: isBossIntroVoicePlaying(),
      activeVoiceCueIndex: getActiveVoiceCueIndex(),
      zoneId: ZONE_IDS[curZoneIdx] || 'courtyard',
      corridorFactor: Number(curCorridorFactor.toFixed(3)),
      nearestFireId: curNearestFireId,
      nearestFireDist: Number.isFinite(curNearestFireDist) ? Number(curNearestFireDist.toFixed(2)) : null,
      fireGain: Number(curFireTargetGain.toFixed(4)),
      firePan: Number(curFireTargetPan.toFixed(3)),
      windGain: Number(curWindTargetGain.toFixed(4)),
      flameJetGain: Number(curFlameJetTargetGain.toFixed(4)),
      flameJetPan: Number(curFlameJetTargetPan.toFixed(3)),
      cinematicActive: isCinematicPlaying(),
      cinematicElapsed: Number(getCinematicElapsed().toFixed(3))
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    suspended = true;
    warmupGeneration++;
    cancelWarmupHandles();
    flushWarmupResumeCallbacks();

    // 1. Immediately stop & disconnect active/fading Boss intro voice nodes
    voicePlayToken++;
    pausedVoiceCueIndex = 0;
    pausedVoiceOffsetSec = 0;
    clearVoiceDuckTimer();
    if (activeVoice) {
      destroyVoiceEntry(activeVoice);
      activeVoice = null;
    }
    for (const v of Array.from(fadingVoices)) {
      destroyVoiceEntry(v);
    }
    fadingVoices.clear();

    // 2. Immediately abort all active/fading cinematic & mini sessions & clear every timer
    for (const s of Array.from(activeSessions)) {
      if (!s.stopped) {
        finalizeCinematicSession(s, 0);
      } else {
        for (const n of s.nodes) {
          safeStop(n);
          safeDisconnect(n);
        }
        s.nodes.clear();
        safeDisconnect(s.dryBus);
        safeDisconnect(s.subBus);
        safeDisconnect(s.revBus);
        safeDisconnect(s.sessionMaster);
        activeSessions.delete(s);
      }
    }
    cinematicSession = null;
    for (const tid of activeTimers) {
      clearTimeout(tid);
    }
    activeTimers.clear();
    procFireStopTimer = null;

    // 3. Stop & disconnect any lingering procedural/Foley transient nodes (armor shift, embers)
    for (const n of activeTransientNodes) {
      safeStop(n);
      safeDisconnect(n);
    }
    activeTransientNodes.clear();

    // 4. Teardown all persistent ambient, voice, reverb, and master Web Audio nodes
    teardownGraph();

    // 5. Release all cached AudioBuffers & references
    buffers.clear();
    pendingLoads.clear();
    failedKeys.clear();
    preloadInitiated = false;
    preloadCompleted = false;
    preloadCtxRef = null;
    preloadPromise = null;
    cathedralIRBuffer = null;
    cinemaCathedralIRBuffer = null;
    warmNoiseBuffer = null;
    transientNoiseBuffer = null;
    duckMusicFn = null;
    ctx = null;
    destNode = null;
  }

  // Eagerly initialize graph & kick off gentle staggered preloading when AudioContext is already provided
  if (ctx) {
    ensureGraph();
    preload(ctx);
  }

  return {
    update,
    playCinematicBossDoorSequence,
    stopCinematicSequence,
    triggerCinematicStage,
    playBossIntroVoiceLine,
    stopBossIntroVoice,
    playBossArmorShift,
    isBossIntroVoicePlaying,
    getActiveVoiceCueIndex,
    setVoiceVolume,
    getVoiceVolume,
    setDuckMusicCallback,
    setBossIntroVoiceUrl,
    suspend,
    resume,
    setFireSources,
    attachContext,
    preload,
    preloadSoulsAudio: preload,
    setVolume,
    getVolume,
    setMuted,
    isMuted,
    isSuspended,
    isCinematicPlaying,
    getCinematicElapsed,
    getDebugState,
    dispose
  };
}
