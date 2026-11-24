// Full 32.5-Second Narrative Post-Boss Escape Cutscene Choreography — «Escape from the Castle of Ash»
// Pure Zero-Dependency Vanilla ES Module (Browser / V8 / Node compatible, zero per-frame allocations).
//
// 100% Dynamically Anchored to `soulsCastleLayout.js` (`SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z`,
// `BOSS_RADIUS`, `BOSS_DOOR_Z`, `SOULS_CASTLE_THRONE_CONFIG`) & aligned with `soulsExteriorShore.js`
// (`EXTERIOR_SHORE_ANCHORS`), `Rift_Boss_Tripo.glb` (`Escape_Parry_Disarm`, `Escape_Taunt_Walk`,
// `Escape_Floor_Smash`), `Warrior_Run.glb` (`Cutscene_Knockdown_Scoot`, `Cutscene_Dodge_Fall`,
// `Cutscene_River_Tumble`, `Cutscene_Shore_WakeUp`), and `soulsEscapeAudio.js`.
//
// 5-Act Cinematic Arc (32.500 s total, skippable after 1.500 s):
//   Act 1 (0.00 – 5.20 s)  — «Обманка и перехват» (stageMode: 'castle')
//   Act 2 (5.20 – 15.80 s) — «Отползание и саркастический монолог» (stageMode: 'castle')
//   Act 3 (15.80 – 22.80 s)— «Удар молотом, слоу-мо уворот и пролом в полу» (stageMode: 'castle')
//   Act 4 (22.80 – 29.00 s)— «Шахта и Подземная Река» (stageMode: 'shaft_river')
//   Act 5 (29.00 – 32.50 s)— «Берег за стенами Замка» (stageMode: 'exterior_shore')

import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_THRONE_CONFIG
} from './soulsCastleLayout.js?v=20261124z91';
import {
  BOSS_ESCAPE_VO_DURATIONS_SEC,
  sampleEscapeBossMouthOpen
} from './soulsEscapeAudio.js?v=20261124z91';

const BOSS_SPEAKER_RU = 'РЫЦАРЬ ПЕПЛА';
const LOCATION_TITLE_RU = 'БЕРЕГ ПЕПЕЛЬНОГО СТОКА';
const LOCATION_SUBTITLE_RU = 'ЗА СТЕНАМИ ЗАМКА ПЕПЛА';

// ============================================================================
// Master Timeline Constants (Exact Millisecond Alignment Across All 5 Acts)
// ============================================================================
export const BOSS_ESCAPE_CUTSCENE_DURATION = 32.5;
export const BOSS_ESCAPE_CUTSCENE_SKIP_TIME = 1.5;

const ACT1_START = 0.0;
const ACT1_END = 5.2;
const ACT2_START = 5.2;
const ACT2_END = 15.8;
const ACT3_START = 15.8;
const ACT3_END = 22.8;
const ACT4_START = 22.8;
const ACT4_END = 29.0;
const ACT5_START = 29.0;
const ACT5_END = BOSS_ESCAPE_CUTSCENE_DURATION;

// Key Dramatic Beat Timestamps
const CLASH_1_TIME = 0.85;
const LUNGE_END_TIME = 1.00;
const CLASH_2_TIME = 1.95;
const SHIELD_DISARM_TIME = 2.25;
const SWORD_DISARM_TIME = 2.65;
const KNOCKDOWN_CLIP_START = 3.20;
const KNOCKDOWN_CUE_TIME = 3.35;

const SCOOT_START_TIME = 5.20;
const SCOOT_STEP_INTERVAL = 0.70;
const SCOOT_FIRST_CUE_TIME = 5.65;
const SCOOT_END_TIME = 15.10;

const VO1_START = 5.40;
const VO2_START = 8.75;
const VO3_START = 11.65;
const VO4_START = 15.95;
const BOSS_ENRAGED_FIRE_START = 15.10;
const BOSS_ENRAGED_FIRE_END = 20.60;

const SLOWMO_START_TIME = 18.30;
const SLOWMO_END_TIME = 19.05;
const DODGE_CLIP_START = 18.30;
const FLOOR_SMASH_TIME = 19.15;
const CHASM_FALL_START_TIME = 19.90;
const FLOOR_HOLE_MAX_RADIUS = 2.25; // 4.50 m full diameter chasm matching soulsExteriorShore.js

const SHAFT_TRANSITION_TIME = 22.80;
const WATER_SPLASH_TIME = 24.85;
const UNDERWATER_END_TIME = 27.20;
const GRATE_BREAK_TIME = 27.85;
const FADE_OUT_START_TIME = 28.50;
const SHORE_TRANSITION_TIME = 29.00;
const SHORE_WAKE_CUE_TIME = 29.10;
const FADE_IN_END_TIME = 29.65;
const LOCATION_CARD_START_TIME = 29.95;
const LOCATION_CARD_END_TIME = 32.35;
const LETTERBOX_OUT_START_TIME = 31.35;

// Clip Durations Matching `Rift_Boss_Tripo.glb` & `Warrior_Run.glb`
const BOSS_CLIP_PARRY_DUR = 5.20;   // Escape_Parry_Disarm (0.00 – 5.20 s)
const BOSS_CLIP_TAUNT_DUR = 10.60;  // Escape_Taunt_Walk   (5.20 – 15.80 s)
const BOSS_CLIP_SMASH_DUR = 7.00;   // Escape_Floor_Smash  (15.80 – 22.80 s)

const HERO_CLIP_SCOOT_DUR = 12.60;  // Cutscene_Knockdown_Scoot (3.20 – 15.80 s)
const HERO_CLIP_DODGE_DUR = 7.00;   // Cutscene_Dodge_Fall      (18.30 – 24.85 s piecewise exact)
const HERO_CLIP_RIVER_DUR = 4.20;   // Cutscene_River_Tumble    (24.85 – 29.05 s)
const HERO_CLIP_WAKE_DUR = 3.50;    // Cutscene_Shore_WakeUp    (29.00 – 32.50 s)

// Exterior Shore Canonical Anchors (1:1 Aligned with `soulsExteriorShore.js`)
const SHORE_WAKE_X = 0.0;
const SHORE_WAKE_Y = 0.0;
const SHORE_WAKE_Z = 2.5;
const SHORE_WAKE_FACING = Math.PI; // Facing North (-Z) toward Waterfall Culvert & Castle of Ash on Cliff

const SHORE_SWORD_X = 2.8;
const SHORE_SWORD_Y = 0.0;
const SHORE_SWORD_Z = 5.2;

const SHORE_BONFIRE_X = -2.2;
const SHORE_BONFIRE_Y = 0.0;
const SHORE_BONFIRE_Z = 15.0;

const SHORE_GATE_X = 0.0;
const SHORE_GATE_Y = 0.0;
const SHORE_GATE_Z = 31.0;

const SHORE_WATERFALL_X = 0.0;
const SHORE_WATERFALL_Y = 0.0;
const SHORE_WATERFALL_Z = -14.0;

const SHORE_CASTLE_VISTA_X = 0.0;
const SHORE_CASTLE_VISTA_Y = 32.0;
const SHORE_CASTLE_VISTA_Z = -56.0;

// Underground Shaft & River Canonical Anchors (1:1 Aligned with `soulsExteriorShore.js`)
const SHAFT_TOP_LIGHT_Y = 22.0;
const SHAFT_ENTRY_HERO_Y = 19.5;
const RIVER_WATER_Y = 0.0;
const RIVER_GRATE_Z = 26.0;
const RIVER_EXIT_Z = 34.0;

const DEFAULT_NORMAL_FOV = 52.0;

// Exact millisecond-accurate durations pulled straight from `soulsEscapeAudio.js`
// (`BOSS_ESCAPE_VO_DURATIONS_SEC`: { 1: 3.087, 2: 2.648, 3: 4.147, 4: 1.661 }, 0 overlap!)
const DEFAULT_VO_DURATIONS_SEC = Object.freeze({
  1: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[1]) || 3.087, // "Heh... Did you truly think... that was the end?"
  2: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[2]) || 2.648, // "Brave. Almost... touching."
  3: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[3]) || 4.147, // "Yet you never learned the rules of my house. Guests do not leave..."
  4: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[4]) || 1.661  // "...they go down below."
});

const VO_RAW_SPECS = Object.freeze([
  Object.freeze({
    index: 1,
    start: VO1_START,
    file: 'boss_escape_vo_01.mp3',
    text: 'А ты и правда решил, что это... всё?',
    textEn: '[chuckle] Did you truly think... that was the end?'
  }),
  Object.freeze({
    index: 2,
    start: VO2_START,
    file: 'boss_escape_vo_02.mp3',
    text: 'Храбро. Почти... трогательно.',
    textEn: 'Brave. Almost... touching.'
  }),
  Object.freeze({
    index: 3,
    start: VO3_START,
    file: 'boss_escape_vo_03.mp3',
    text: 'Но ты так и не понял правил моего дома. Гости отсюда не уходят...',
    textEn: 'Yet you never learned the rules of my house. Guests do not leave...'
  }),
  Object.freeze({
    index: 4,
    start: VO4_START,
    file: 'boss_escape_vo_04.mp3',
    text: '...они спускаются вниз.',
    textEn: '...they go down below.'
  })
]);

// Runtime-configurable voice provider (allows zero-GC binding to `soulsEscapeAudio.js` curves/durations)
let _externalVoDurations = null;
let _externalMouthSampler = null;

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

function buildDialogueCues(durationsMap) {
  const src = durationsMap || DEFAULT_VO_DURATIONS_SEC;
  const out = new Array(VO_RAW_SPECS.length);
  for (let i = 0; i < VO_RAW_SPECS.length; i++) {
    const spec = VO_RAW_SPECS[i];
    const nextSpec = i + 1 < VO_RAW_SPECS.length ? VO_RAW_SPECS[i + 1] : null;
    const rawDur = Number(src[spec.index]);
    const fallbackDur = DEFAULT_VO_DURATIONS_SEC[spec.index];
    const dur = Number.isFinite(rawDur) && rawDur > 0.25 ? round3(rawDur) : fallbackDur;
    // Prevent subtitle overlap if an external audio clip runs slightly longer than the gap
    const maxEnd = nextSpec ? round3(nextSpec.start - 0.08) : round3(ACT3_START + 2.35);
    const start = round3(spec.start);
    const end = round3(Math.min(start + dur, maxEnd));
    out[i] = Object.freeze({
      index: spec.index,
      start,
      end,
      duration: round3(Math.max(0.25, end - start)),
      audioDuration: dur,
      file: spec.file,
      speaker: BOSS_SPEAKER_RU,
      text: spec.text,
      textEn: spec.textEn
    });
  }
  return Object.freeze(out);
}

export const BOSS_ESCAPE_DIALOGUE_CUES = buildDialogueCues(DEFAULT_VO_DURATIONS_SEC);

/**
 * Optionally binds exact durations & 30-FPS lip-sync sampler from `soulsEscapeAudio.js`
 * globally for subsequently created rigs (or pass per-rig via `createBossEscapeCutsceneRig` opts).
 *
 * @param {Record<number, number>|null} [voDurations]
 * @param {((cueIndex: number, localTimeSec: number) => number)|null} [sampleMouthOpenFn]
 */
export function setBossEscapeVoiceProvider(voDurations = null, sampleMouthOpenFn = null) {
  _externalVoDurations = voDurations && typeof voDurations === 'object' ? voDurations : null;
  _externalMouthSampler = typeof sampleMouthOpenFn === 'function' ? sampleMouthOpenFn : null;
}

export const BOSS_ESCAPE_ACTS = Object.freeze({
  DURATION: BOSS_ESCAPE_CUTSCENE_DURATION,
  SKIP_UNLOCK_TIME: BOSS_ESCAPE_CUTSCENE_SKIP_TIME,

  ACT1_START,
  ACT1_END,
  ACT2_START,
  ACT2_END,
  ACT3_START,
  ACT3_END,
  ACT4_START,
  ACT4_END,
  ACT5_START,
  ACT5_END,

  CLASH_1_TIME,
  LUNGE_END_TIME,
  CLASH_2_TIME,
  SHIELD_DISARM_TIME,
  SWORD_DISARM_TIME,
  KNOCKDOWN_CLIP_START,
  KNOCKDOWN_CUE_TIME,

  SCOOT_START_TIME,
  SCOOT_STEP_INTERVAL,
  SCOOT_FIRST_CUE_TIME,
  SCOOT_END_TIME,

  VO1_START,
  VO2_START,
  VO3_START,
  VO4_START,
  BOSS_ENRAGED_FIRE_START,
  BOSS_ENRAGED_FIRE_END,

  SLOWMO_START_TIME,
  SLOWMO_END_TIME,
  DODGE_CLIP_START,
  FLOOR_SMASH_TIME,
  CHASM_FALL_START_TIME,
  FLOOR_HOLE_MAX_RADIUS,

  SHAFT_TRANSITION_TIME,
  WATER_SPLASH_TIME,
  UNDERWATER_END_TIME,
  GRATE_BREAK_TIME,
  FADE_OUT_START_TIME,
  SHORE_TRANSITION_TIME,
  SHORE_WAKE_CUE_TIME,
  FADE_IN_END_TIME,
  LOCATION_CARD_START_TIME,
  LOCATION_CARD_END_TIME,
  LETTERBOX_OUT_START_TIME,

  // Throne Hall Parametric Defaults
  DEFAULT_ANCHOR_X: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
  DEFAULT_ANCHOR_Z: SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
  BOSS_DOOR_Z: SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z,
  BOSS_RADIUS: SOULS_CASTLE_CONSTANTS.BOSS_RADIUS,
  THRONE_Z: SOULS_CASTLE_THRONE_CONFIG.z,

  // Shaft & Underground River Coordinates
  SHAFT_TOP_LIGHT_Y,
  SHAFT_ENTRY_HERO_Y,
  RIVER_WATER_Y,
  RIVER_GRATE_Z,
  RIVER_EXIT_Z,

  // Exterior Shore Final Coordinates (1:1 Aligned with `EXTERIOR_SHORE_ANCHORS`)
  SHORE_WAKE_X,
  SHORE_WAKE_Y,
  SHORE_WAKE_Z,
  SHORE_WAKE_FACING,
  SHORE_SWORD_X,
  SHORE_SWORD_Y,
  SHORE_SWORD_Z,
  SHORE_BONFIRE_X,
  SHORE_BONFIRE_Y,
  SHORE_BONFIRE_Z,
  SHORE_GATE_X,
  SHORE_GATE_Y,
  SHORE_GATE_Z,
  SHORE_WATERFALL_X,
  SHORE_WATERFALL_Y,
  SHORE_WATERFALL_Z,
  SHORE_CASTLE_VISTA_X,
  SHORE_CASTLE_VISTA_Y,
  SHORE_CASTLE_VISTA_Z,

  DEFAULT_NORMAL_FOV,
  BOSS_SPEAKER_RU,
  LOCATION_TITLE_RU,
  LOCATION_SUBTITLE_RU
});

// ============================================================================
// Pure Zero-Allocation Math & C1 Hermite Camera Spline Helpers
// ============================================================================
function clamp01(v) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

function clamp(v, minV, maxV) {
  return v < minV ? minV : v > maxV ? maxV : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  const u = clamp01(t);
  return u * u * (3.0 - 2.0 * u);
}

function smootherstep(t) {
  const u = clamp01(t);
  return u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
}

function easeOutCubic(t) {
  const u = 1.0 - clamp01(t);
  return 1.0 - u * u * u;
}

function easeInQuad(t) {
  const u = clamp01(t);
  return u * u;
}

function pulseBell(t, start, end) {
  if (t <= start || t >= end || end <= start) return 0.0;
  const u = (t - start) / (end - start);
  return Math.sin(u * Math.PI);
}

function decayImpulse(t, start, dur, peak) {
  if (t < start || t >= start + dur || dur <= 0) return 0.0;
  const u = (t - start) / dur;
  const env = (1.0 - u) * (1.0 - u);
  return peak * env;
}

function hermite1D(y0, y1, m0, m1, dt, s) {
  const s2 = s * s;
  const s3 = s2 * s;
  const h00 = 2.0 * s3 - 3.0 * s2 + 1.0;
  const h10 = s3 - 2.0 * s2 + s;
  const h01 = -2.0 * s3 + 3.0 * s2;
  const h11 = s3 - s2;
  return h00 * y0 + h10 * dt * m0 + h01 * y1 + h11 * dt * m1;
}

function readVec3X(v, fallback) {
  if (!v) return fallback;
  const n = Array.isArray(v) ? Number(v[0]) : Number(v.x);
  return Number.isFinite(n) ? n : fallback;
}

function readVec3Y(v, fallback) {
  if (!v) return fallback;
  const n = Array.isArray(v) ? Number(v[1]) : Number(v.y);
  return Number.isFinite(n) ? n : fallback;
}

function readVec3Z(v, fallback) {
  if (!v) return fallback;
  const n = Array.isArray(v) ? Number(v[2]) : Number(v.z);
  return Number.isFinite(n) ? n : fallback;
}

function computeCamTangents(knots) {
  const n = knots.length;
  const out = new Array(n);

  function calcTangent(prevVal, curVal, nextVal, dtPrev, dtNext, damp, monotoneOnly) {
    if (damp <= 0 || dtPrev <= 0 || dtNext <= 0) return 0;
    const mPrev = (curVal - prevVal) / dtPrev;
    const mNext = (nextVal - curVal) / dtNext;
    if (monotoneOnly) {
      if (mPrev * mNext <= 0) return 0;
      const w1 = 2 * dtNext + dtPrev;
      const w2 = dtNext + 2 * dtPrev;
      return (damp * (w1 + w2)) / (w1 / mPrev + w2 / mNext);
    }
    return damp * 0.5 * (mPrev + mNext);
  }

  for (let i = 0; i < n; i++) {
    const k = knots[i];
    if (i === 0 || i === n - 1) {
      out[i] = Object.freeze({ vx: 0, vy: 0, vz: 0, lvx: 0, lvy: 0, lvz: 0, vfov: 0 });
      continue;
    }
    const prev = knots[i - 1];
    const next = knots[i + 1];
    const dtPrev = k.t - prev.t;
    const dtNext = next.t - k.t;
    out[i] = Object.freeze({
      vx: calcTangent(prev.px, k.px, next.px, dtPrev, dtNext, k.dp, false),
      vy: calcTangent(prev.py, k.py, next.py, dtPrev, dtNext, k.dp, false),
      vz: calcTangent(prev.pz, k.pz, next.pz, dtPrev, dtNext, k.dp, false),
      lvx: calcTangent(prev.lx, k.lx, next.lx, dtPrev, dtNext, k.dl, false),
      lvy: calcTangent(prev.ly, k.ly, next.ly, dtPrev, dtNext, k.dl, false),
      lvz: calcTangent(prev.lz, k.lz, next.lz, dtPrev, dtNext, k.dl, false),
      vfov: calcTangent(prev.fov, k.fov, next.fov, dtPrev, dtNext, k.dp, true)
    });
  }
  return Object.freeze(out);
}

const _camSample = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov: 46.0 };

function sampleSplineSegment(t, knots, tangents) {
  const n = knots.length;
  if (t <= knots[0].t) {
    const k = knots[0];
    _camSample.px = k.px;
    _camSample.py = k.py;
    _camSample.pz = k.pz;
    _camSample.lx = k.lx;
    _camSample.ly = k.ly;
    _camSample.lz = k.lz;
    _camSample.fov = k.fov;
    return _camSample;
  }
  const last = knots[n - 1];
  if (t >= last.t) {
    _camSample.px = last.px;
    _camSample.py = last.py;
    _camSample.pz = last.pz;
    _camSample.lx = last.lx;
    _camSample.ly = last.ly;
    _camSample.lz = last.lz;
    _camSample.fov = last.fov;
    return _camSample;
  }

  let lo = 0;
  let hi = n - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (t < knots[mid].t) {
      hi = mid - 1;
    } else if (t > knots[mid + 1].t) {
      lo = mid + 1;
    } else {
      lo = mid;
      break;
    }
  }
  const i = lo < 0 ? 0 : lo > n - 2 ? n - 2 : lo;
  const k0 = knots[i];
  const k1 = knots[i + 1];
  const m0 = tangents[i];
  const m1 = tangents[i + 1];
  const dt = Math.max(1e-6, k1.t - k0.t);
  const s = clamp01((t - k0.t) / dt);

  _camSample.px = hermite1D(k0.px, k1.px, m0.vx, m1.vx, dt, s);
  _camSample.py = hermite1D(k0.py, k1.py, m0.vy, m1.vy, dt, s);
  _camSample.pz = hermite1D(k0.pz, k1.pz, m0.vz, m1.vz, dt, s);
  _camSample.lx = hermite1D(k0.lx, k1.lx, m0.lvx, m1.lvx, dt, s);
  _camSample.ly = hermite1D(k0.ly, k1.ly, m0.lvy, m1.lvy, dt, s);
  _camSample.lz = hermite1D(k0.lz, k1.lz, m0.lvz, m1.lvz, dt, s);
  _camSample.fov = hermite1D(k0.fov, k1.fov, m0.vfov, m1.vfov, dt, s);
  return _camSample;
}

// ============================================================================
// Parametric Escape Rig Factory (3 Independent Stage C1 Hermite Splines)
// ============================================================================

/**
 * Builds a complete, frozen spatial rig + 3 stage-isolated C1 Hermite camera splines
 * (`castle`, `shaft_river`, `exterior_shore`) parametrically anchored to `(anchorX, anchorZ)`.
 *
 * Clamps `(anchorX, anchorZ)` softly inside the open flat carpet center of the Boss Throne Hall
 * so neither the camera, actors, dropped sword, nor the 4.5 m floor chasm can ever clip the
 * outer colonnade pillars, Boss Doors (`z = -32.2`), or Obsidian Throne dais (`z = -55.2`).
 *
 * @param {number} [anchorX=0]
 * @param {number} [anchorZ=SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z]
 * @param {{
 *   disableArenaClamp?: boolean,
 *   voDurations?: Record<number, number>|null,
 *   sampleMouthOpen?: ((cueIndex: number, localTimeSec: number) => number)|null,
 *   shoreWakePos?: { x: number, y?: number, z: number }|null,
 *   normalCamPos?: { x: number, y: number, z: number }|null,
 *   normalCamLook?: { x: number, y: number, z: number }|null,
 *   normalFov?: number
 * }|null} [opts]
 */
export function createBossEscapeCutsceneRig(
  anchorX = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
  anchorZ = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z,
  opts = null
) {
  const centerX = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X;
  const centerZ = SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z;

  const rawX = Number.isFinite(anchorX) ? anchorX : centerX;
  const rawZ = Number.isFinite(anchorZ) ? anchorZ : centerZ;

  // Keep choreography inside the flat obstacle-free nave of `boss_hall` (R = 16 m, pillars at R = 12.8 m)
  const disableClamp = Boolean(opts && opts.disableArenaClamp);
  const ax = disableClamp ? round3(rawX) : clamp(round3(rawX), centerX - 4.0, centerX + 4.0);
  const az = disableClamp ? round3(rawZ) : clamp(round3(rawZ), centerZ - 1.8, centerZ + 1.4);

  // Floor Chasm Center (4.50 m diameter hole centered right beneath Hero's dodge rim & dropped sword)
  const floorHoleX = round3(ax - 0.30);
  const floorHoleZ = round3(az + 6.45);

  // Exterior Shore Wake Anchor (defaults 1:1 to `EXTERIOR_SHORE_ANCHORS.wakePos`)
  const shoreWakeX = round3(readVec3X(opts?.shoreWakePos, SHORE_WAKE_X));
  const shoreWakeY = round3(readVec3Y(opts?.shoreWakePos, SHORE_WAKE_Y));
  const shoreWakeZ = round3(readVec3Z(opts?.shoreWakePos, SHORE_WAKE_Z));

  const normalFovRaw = Number(opts?.normalFov);
  const normalFov = Number.isFinite(normalFovRaw) && normalFovRaw > 15 && normalFovRaw < 110
    ? normalFovRaw
    : DEFAULT_NORMAL_FOV;

  const defaultNormalCamPos = Object.freeze({
    x: round3(readVec3X(opts?.normalCamPos, shoreWakeX)),
    y: round3(readVec3Y(opts?.normalCamPos, shoreWakeY + 3.45)),
    z: round3(readVec3Z(opts?.normalCamPos, shoreWakeZ + 3.80))
  });
  const defaultNormalCamLook = Object.freeze({
    x: round3(readVec3X(opts?.normalCamLook, shoreWakeX)),
    y: round3(readVec3Y(opts?.normalCamLook, shoreWakeY + 1.45)),
    z: round3(readVec3Z(opts?.normalCamLook, shoreWakeZ))
  });

  // --------------------------------------------------------------------------
  // Spline 1: Castle Throne Hall (Acts 1–3, t ∈ [0.00 .. 22.80 s])
  //   - Stays strictly inside circular Boss Hall & flies directly DOWN THROUGH
  //     the open 4.5 m floor chasm aperture at t = 20.20..20.65 s (0 floor clip!).
  // --------------------------------------------------------------------------
  const castleCamKnots = Object.freeze([
    // Act 1 (0.00–5.20 s): Finishing lunge -> brutal parry -> furious 2-strike clash -> disarm -> knockdown
    { t: 0.00,  px: ax + 3.10, py: 1.85, pz: az + 4.35, lx: ax + 0.00, ly: 1.45, lz: az - 0.35, fov: 48.0, dp: 0.0,  dl: 0.0  },
    { t: 0.85,  px: ax + 2.65, py: 1.55, pz: az + 0.75, lx: ax + 0.00, ly: 1.55, lz: az - 0.15, fov: 42.0, dp: 0.7,  dl: 0.5  },
    { t: 1.95,  px: ax + 2.95, py: 1.44, pz: az + 2.35, lx: ax + 0.05, ly: 1.62, lz: az + 0.55, fov: 44.0, dp: 0.8,  dl: 0.6  },
    { t: 2.65,  px: ax + 3.85, py: 1.72, pz: az + 4.15, lx: ax + 0.35, ly: 1.45, lz: az + 1.40, fov: 46.5, dp: 0.75, dl: 0.6  },
    { t: 3.35,  px: ax + 3.45, py: 1.32, pz: az + 5.70, lx: ax + 0.05, ly: 1.28, lz: az + 2.95, fov: 47.0, dp: 0.8,  dl: 0.6  },
    { t: 4.85,  px: ax + 2.35, py: 1.05, pz: az + 7.85, lx: ax + 0.00, ly: 1.85, lz: az + 1.25, fov: 44.0, dp: 0.75, dl: 0.5  },

    // Act 2 (5.20–15.80 s): Low-angle behind scooting Hero looking UP at towering chuckling Boss + dropped sword
    { t: 5.80,  px: ax + 1.85, py: 0.92, pz: az + 8.45, lx: ax + 0.00, ly: 2.18, lz: az + 1.45, fov: 42.0, dp: 0.8,  dl: 0.4  },
    { t: 8.60,  px: ax + 0.95, py: 0.88, pz: az + 9.25, lx: ax + 0.00, ly: 2.24, lz: az + 1.90, fov: 40.5, dp: 0.85, dl: 0.4  },
    { t: 11.40, px: ax - 1.45, py: 0.94, pz: az + 9.65, lx: ax + 0.00, ly: 2.26, lz: az + 2.45, fov: 39.8, dp: 0.85, dl: 0.4  },
    { t: 14.40, px: ax - 0.85, py: 0.86, pz: az + 9.95, lx: ax + 0.00, ly: 2.30, lz: az + 3.35, fov: 38.8, dp: 0.75, dl: 0.4  },
    { t: 15.80, px: ax + 0.55, py: 0.82, pz: az + 9.65, lx: ax + 0.00, ly: 2.55, lz: az + 3.75, fov: 41.5, dp: 0.7,  dl: 0.5  },

    // Act 3 (15.80–22.80 s): Towering overhead hammer windup -> same-side slow-mo dodge -> elevated 3D chasm reveal -> abyss upward shot!
    { t: 17.75, px: ax + 1.35, py: 0.92, pz: az + 9.05, lx: ax + 0.00, ly: 3.05, lz: az + 3.90, fov: 45.0, dp: 0.75, dl: 0.5  },
    { t: 18.35, px: ax + 1.85, py: 1.15, pz: az + 8.95, lx: ax - 0.35, ly: 1.55, lz: az + 5.65, fov: 40.5, dp: 0.65, dl: 0.5  },
    { t: 19.00, px: ax + 2.45, py: 1.58, pz: az + 9.35, lx: ax - 0.55, ly: 1.05, lz: az + 6.15, fov: 42.5, dp: 0.75, dl: 0.5  },
    // Elevated 3/4 wide reveal on the same right side (zero 180° axis-crossing!): flaming smash + 4.5 m 3D chasm + rolling Hero!
    { t: 19.45, px: ax + 3.35, py: 3.30, pz: az + 10.35, lx: floorHoleX + 0.08, ly: 0.32, lz: az + 5.75, fov: 49.0, dp: 0.6,  dl: 0.45 },
    { t: 19.95, px: ax + 2.75, py: 3.00, pz: az + 9.75,  lx: floorHoleX,        ly: -0.15, lz: floorHoleZ, fov: 50.5, dp: 0.65, dl: 0.5  },
    // Camera glides directly over the open 4.5 m hole aperture (r ~ 1.1 m < 2.25 m) and plunges cleanly into the abyss!
    { t: 20.30, px: floorHoleX + 0.80, py: 1.75,  pz: floorHoleZ + 0.90, lx: floorHoleX - 0.15, ly: -0.95, lz: floorHoleZ, fov: 53.0, dp: 0.75, dl: 0.5 },
    { t: 20.72, px: floorHoleX + 0.66, py: -2.45, pz: floorHoleZ + 1.06, lx: floorHoleX - 0.10, ly: -0.20, lz: az + 5.45,  fov: 56.0, dp: 0.85, dl: 0.6 },
    // Looking STRAIGHT UP from the abyss past tumbling Hero & sword at the shrinking chasm & Boss with lantern on rim!
    { t: 21.55, px: floorHoleX + 0.52, py: -11.40, pz: floorHoleZ + 1.32, lx: floorHoleX + 0.08, ly: 0.95,  lz: az + 4.45, fov: 59.0, dp: 0.9,  dl: 0.5 },
    { t: 22.80, px: floorHoleX + 0.42, py: -21.20, pz: floorHoleZ + 1.48, lx: floorHoleX + 0.12, ly: 1.25,  lz: az + 4.25, fov: 62.0, dp: 0.0,  dl: 0.0 }
  ]);

  // --------------------------------------------------------------------------
  // Spline 2: Vertical Shaft & Underground River (Act 4, t ∈ [22.80 .. 29.00 s])
  //   - Shaft centered at (0, y, 0), R ~ 7 m, crimson castle pinhole at (0, +22, 0).
  //   - River surface at y = 0, vaulted tunnel z = 0 -> +36 m, iron grate at z = +26 m.
  // --------------------------------------------------------------------------
  const shaftCamKnots = Object.freeze([
    // Vertical shaft plunge looking UP past Hero toward distant crimson hole of the Castle
    { t: 22.80, px: 1.55, py: 15.80, pz: 2.75,  lx: 0.00, ly: 21.20, lz: 0.00,  fov: 62.0, dp: 0.0,  dl: 0.0  },
    { t: 23.95, px: 1.40, py: 7.40,  pz: 2.85,  lx: 0.00, ly: 11.80, lz: 0.25,  fov: 59.0, dp: 0.9,  dl: 0.7  },
    { t: 24.85, px: 1.45, py: 1.55,  pz: 3.65,  lx: 0.00, ly: 0.35,  lz: 1.65,  fov: 56.0, dp: 0.7,  dl: 0.5  },
    // Underwater submersion right behind tumbling Hero in dark rushing rapids
    { t: 25.45, px: 1.10, py: -0.78, pz: 5.40,  lx: 0.00, ly: -0.45, lz: 11.50, fov: 58.0, dp: 0.75, dl: 0.6  },
    { t: 26.45, px: -0.85, py: 0.25, pz: 10.60, lx: 0.00, ly: 0.55,  lz: 21.50, fov: 58.5, dp: 0.85, dl: 0.7  },
    // Bursting to surface — dramatic river tunnel shot toward moonlit iron grate at z = +26 m!
    { t: 27.25, px: 1.15, py: 1.68,  pz: 15.80, lx: 0.00, ly: 0.85,  lz: 26.00, fov: 60.0, dp: 0.85, dl: 0.6  },
    { t: 27.85, px: 0.92, py: 1.78,  pz: 20.60, lx: 0.00, ly: 0.95,  lz: 27.20, fov: 63.5, dp: 0.85, dl: 0.6  },
    // Blasting through shattered iron grate into cold moonlit waterfall mist
    { t: 29.00, px: 0.55, py: 1.85,  pz: 28.80, lx: 0.00, ly: 0.85,  lz: 35.50, fov: 66.5, dp: 0.0,  dl: 0.0  }
  ]);

  // --------------------------------------------------------------------------
  // Spline 3: Exterior Moonlit Shore & Castle Vista (Act 5, t ∈ [29.00 .. 32.50 s])
  //   - Hero wakes at (0, 0, 2.5) facing North (-Z) toward Waterfall Culvert (z = -14)
  //     and Monumental Castle of Ash on Cliff (z = -56, y = +18..+48).
  //   - Pulls back & tilts up to frame BOTH rising Hero (lower third) & Castle + Moon (upper half),
  //     then glides seamlessly behind Hero's back into live third-person gameplay!
  // --------------------------------------------------------------------------
  const shoreCamKnots = Object.freeze([
    // Intimate low wet-gravel reveal beside prone Hero
    { t: 29.00, px: shoreWakeX + 2.15, py: shoreWakeY + 0.95, pz: shoreWakeZ + 3.10, lx: shoreWakeX, ly: shoreWakeY + 0.62, lz: shoreWakeZ - 0.40, fov: 48.0, dp: 0.0,  dl: 0.0  },
    { t: 29.75, px: shoreWakeX + 1.85, py: shoreWakeY + 1.25, pz: shoreWakeZ + 4.45, lx: shoreWakeX, ly: shoreWakeY + 2.40, lz: shoreWakeZ - 11.50, fov: 52.0, dp: 0.8, dl: 0.65 },
    // Heroic Elden Ring Vista: Hero standing up in foreground + Waterfall Arch + Colossal Castle of Ash + Giant Moon!
    { t: 30.75, px: shoreWakeX + 1.05, py: shoreWakeY + 1.65, pz: shoreWakeZ + 6.05, lx: shoreWakeX, ly: shoreWakeY + 9.20, lz: shoreWakeZ - 39.00, fov: 57.5, dp: 0.75, dl: 0.55 },
    { t: 31.35, px: shoreWakeX + 0.55, py: shoreWakeY + 2.05, pz: shoreWakeZ + 5.75, lx: shoreWakeX, ly: shoreWakeY + 8.60, lz: shoreWakeZ - 36.50, fov: 56.5, dp: 0.7,  dl: 0.6  },
    // Seamless settle directly behind Hero's back into normal chase camera
    { t: 32.50, px: defaultNormalCamPos.x, py: defaultNormalCamPos.y, pz: defaultNormalCamPos.z, lx: defaultNormalCamLook.x, ly: defaultNormalCamLook.y, lz: defaultNormalCamLook.z, fov: normalFov, dp: 0.0, dl: 0.0 }
  ]);

  const dialogueCues = buildDialogueCues(opts?.voDurations || _externalVoDurations || DEFAULT_VO_DURATIONS_SEC);
  const sampleMouthOpen = typeof opts?.sampleMouthOpen === 'function'
    ? opts.sampleMouthOpen
    : _externalMouthSampler;

  return Object.freeze({
    anchorX: ax,
    anchorZ: az,
    floorHoleX,
    floorHoleZ,
    floorHoleMaxRadius: FLOOR_HOLE_MAX_RADIUS,
    shoreWakeX,
    shoreWakeY,
    shoreWakeZ,
    defaultNormalCamPos,
    defaultNormalCamLook,
    normalFov,
    dialogueCues,
    sampleMouthOpen,
    castleCamKnots,
    castleCamTangents: computeCamTangents(castleCamKnots),
    shaftCamKnots,
    shaftCamTangents: computeCamTangents(shaftCamKnots),
    shoreCamKnots,
    shoreCamTangents: computeCamTangents(shoreCamKnots)
  });
}

const DEFAULT_RIG = createBossEscapeCutsceneRig(
  SOULS_CASTLE_CONSTANTS.BOSS_CENTER_X,
  SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z
);

// ============================================================================
// Reusable Zero-GC State Factory
// ============================================================================

/**
 * Pre-allocates one flat state object suitable for passing repeatedly into
 * `sampleBossEscapeCutscene(rig, tSec, outState)` with zero per-frame garbage collection.
 */
export function createBossEscapeCutsceneState() {
  return {
    t: 0,
    finished: false,
    act: 1,
    actId: 'parry_disarm',
    actProgress: 0,
    progress: 0,
    stageMode: 'castle',
    letterbox01: 0,
    fadeToBlack01: 0,
    underwater01: 0,
    slowMoFactor: 1,
    canSkip: false,
    screenShake: 0,
    hitstopSec: 0,
    camPos: { x: 0, y: 0, z: 0 },
    camLook: { x: 0, y: 0, z: 0 },
    camFov: 48,
    fov: 48,
    heroMode: 'final_lunge',
    heroAnimName: 'Heavy_Thrust',
    heroX: 0,
    heroY: 0,
    heroZ: 0,
    heroFacing: Math.PI,
    heroAnimU: 0,
    swordDisarmed: false,
    shieldDisarmed: false,
    bossVisible: true,
    bossX: 0,
    bossY: 0,
    bossZ: 0,
    bossFacing: 0,
    bossAnimName: 'Escape_Parry_Disarm',
    bossAnimU: 0,
    bossMouthOpen01: 0,
    bossEnragedFire: false,
    bossChuckle01: 0,
    droppedSword: {
      visible: false,
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0
    },
    floorHoleX: 0,
    floorHoleZ: 0,
    floorHoleRadius: 0,
    floorHoleProgress: 0,
    voiceCueIndex: 0,
    voiceLocalTime: 0,
    subtitleSpeaker: '',
    subtitleText: '',
    subtitleTextEn: '',
    showLocationCard: false,
    locationTitleRu: LOCATION_TITLE_RU,
    locationSubtitleRu: LOCATION_SUBTITLE_RU,
    clashSparkCue: 0,
    cues: {
      voiceCue: 0,
      clashCue: 0,
      disarmCue: 0,
      knockdownCue: 0,
      scootCue: 0,
      slowMoCue: 0,
      floorSmashCue: 0,
      waterSplashCue: 0,
      grateBreakCue: 0,
      shoreWakeCue: 0
    }
  };
}

// ============================================================================
// Sub-Evaluators: Hero, Boss, Dropped Oathblade, Floor Chasm, VFX & Dialogue
// ============================================================================

const _heroEval = {
  mode: 'final_lunge',
  animName: 'Heavy_Thrust',
  x: 0,
  y: 0,
  z: 0,
  facing: Math.PI,
  animU: 0
};

function evaluateHeroState(t, rig) {
  const ax = rig.anchorX;
  const az = rig.anchorZ;
  const holeX = rig.floorHoleX;
  const holeZ = rig.floorHoleZ;

  // --- ACT 1: Final Lunge (0.00–1.00 s) -> 2-Strike Clash & Disarm (1.00–3.20 s) -> Knockdown Sit (3.20–5.20 s) ---
  if (t < LUNGE_END_TIME) {
    _heroEval.mode = 'final_lunge';
    _heroEval.animName = 'Heavy_Thrust';
    _heroEval.animU = clamp01(t / LUNGE_END_TIME);
    if (t < CLASH_1_TIME) {
      const u = easeOutCubic(t / CLASH_1_TIME);
      _heroEval.x = ax;
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 3.60, az + 0.82, u);
      _heroEval.facing = Math.PI;
    } else {
      const u = smoothstep((t - CLASH_1_TIME) / (LUNGE_END_TIME - CLASH_1_TIME));
      _heroEval.x = ax + lerp(0.0, -0.14, u);
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 0.82, az + 1.20, u);
      _heroEval.facing = Math.PI + 0.14 * u;
    }
    return _heroEval;
  }

  if (t < KNOCKDOWN_CLIP_START) {
    _heroEval.mode = 'clash_exchange';
    if (t < CLASH_2_TIME) {
      const u = (t - LUNGE_END_TIME) / (CLASH_2_TIME - LUNGE_END_TIME);
      _heroEval.animName = 'Diagonal_Slash';
      _heroEval.animU = clamp01(u);
      const lungeIn = Math.sin(u * Math.PI);
      _heroEval.x = ax + lerp(-0.14, 0.16, smoothstep(u));
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 1.20, az + 1.42, u) - 0.42 * lungeIn;
      _heroEval.facing = Math.PI + lerp(0.14, -0.12, u);
    } else if (t < SWORD_DISARM_TIME) {
      const u = (t - CLASH_2_TIME) / (SWORD_DISARM_TIME - CLASH_2_TIME);
      _heroEval.animName = 'Hit_React';
      _heroEval.animU = clamp01(u);
      _heroEval.x = ax + lerp(0.16, -0.14, smoothstep(u));
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 1.42, az + 1.98, smoothstep(u));
      _heroEval.facing = Math.PI - 0.12 + 0.28 * smoothstep(u);
    } else {
      // Disarmed stagger right before the devastating Boss shove
      const u = (t - SWORD_DISARM_TIME) / (KNOCKDOWN_CLIP_START - SWORD_DISARM_TIME);
      _heroEval.animName = 'Hit_React';
      _heroEval.animU = clamp01(0.45 + 0.55 * u);
      _heroEval.x = ax + lerp(-0.14, -0.06, smoothstep(u));
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 1.98, az + 2.25, smoothstep(u));
      _heroEval.facing = Math.PI + lerp(0.16, 0.04, smoothstep(u));
    }
    return _heroEval;
  }

  if (t < ACT1_END) {
    // 3.20–5.20 s: Knocked backward ~3.4 m onto buttocks (`Cutscene_Knockdown_Scoot` 0.00–2.00 s)
    _heroEval.mode = 'knockdown_sit';
    _heroEval.animName = 'Cutscene_Knockdown_Scoot';
    _heroEval.animU = clamp01((t - KNOCKDOWN_CLIP_START) / HERO_CLIP_SCOOT_DUR);
    if (t < KNOCKDOWN_CUE_TIME) {
      const u = (t - KNOCKDOWN_CLIP_START) / (KNOCKDOWN_CUE_TIME - KNOCKDOWN_CLIP_START);
      _heroEval.x = ax - 0.06;
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 2.25, az + 2.38, u);
      _heroEval.facing = Math.PI;
    } else if (t < 4.00) {
      // Airborne knockback arc
      const u = (t - KNOCKDOWN_CUE_TIME) / (4.00 - KNOCKDOWN_CUE_TIME);
      _heroEval.x = ax + lerp(-0.06, 0.04, u);
      _heroEval.y = Math.sin(u * Math.PI) * 0.38;
      _heroEval.z = lerp(az + 2.38, az + 4.95, easeOutCubic(u));
      _heroEval.facing = Math.PI + Math.sin(u * Math.PI) * 0.08;
    } else {
      // Heavy armored impact skid + tiny bounce settling onto buttocks at az + 5.65 (+3.40 m knockback!)
      const u = clamp01((t - 4.00) / (ACT1_END - 4.00));
      const skid = easeOutCubic(clamp01(u / 0.72));
      const bounce = u < 0.22 ? Math.sin((u / 0.22) * Math.PI) * 0.055 : 0.0;
      _heroEval.x = ax + 0.04;
      _heroEval.y = bounce;
      _heroEval.z = lerp(az + 4.95, az + 5.65, skid);
      _heroEval.facing = Math.PI;
    }
    return _heroEval;
  }

  // --- ACT 2: Terrified Backward Butt-Scoot (5.20–15.80 s) ---
  if (t < ACT2_END) {
    _heroEval.mode = 'scoot_back';
    _heroEval.animName = 'Cutscene_Knockdown_Scoot';
    _heroEval.animU = clamp01((t - KNOCKDOWN_CLIP_START) / HERO_CLIP_SCOOT_DUR);
    const scootSpan = SCOOT_END_TIME - SCOOT_START_TIME;
    const rawU = clamp01((t - SCOOT_START_TIME) / scootSpan);
    // Discrete rhythmic heel-push lurches every 0.70 s so body visibly scoots on each scrape cue!
    const numSteps = scootSpan / SCOOT_STEP_INTERVAL;
    const stepPos = rawU * numSteps;
    const stepIdx = Math.floor(stepPos);
    const stepFrac = stepPos - stepIdx;
    const steppedU = (stepIdx + smootherstep(stepFrac)) / numSteps;

    const lateralWiggle = Math.sin(stepPos * Math.PI) * 0.055 * (1.0 - smoothstep((t - 14.4) / 0.8));
    _heroEval.x = ax + lerp(0.04, 0.0, rawU) + lateralWiggle;
    _heroEval.y = 0.0;
    _heroEval.z = lerp(az + 5.65, az + 7.25, steppedU);
    _heroEval.facing = Math.PI + Math.sin(stepPos * Math.PI) * 0.045;
    return _heroEval;
  }

  // --- ACT 3: Frozen Dread (15.80–18.30 s) -> Slow-Mo Side Dodge (18.30–19.90 s) -> Chasm Fall (19.90–22.80 s) ---
  if (t < DODGE_CLIP_START) {
    _heroEval.mode = 'cower_freeze';
    _heroEval.animName = 'Cutscene_Knockdown_Scoot';
    _heroEval.animU = 1.0;
    const dreadTremor = Math.sin((t - ACT2_END) * 26.0) * 0.012 * smoothstep((t - 16.4) / 1.4);
    _heroEval.x = ax + dreadTremor;
    _heroEval.y = 0.0;
    _heroEval.z = az + 7.25;
    _heroEval.facing = Math.PI;
    return _heroEval;
  }

  if (t < FLOOR_SMASH_TIME) {
    // 18.30–19.15 s: Desperate slow-mo sideways roll left (`Cutscene_Dodge_Fall` 0.00–0.85 s)
    const u = clamp01((t - DODGE_CLIP_START) / (FLOOR_SMASH_TIME - DODGE_CLIP_START));
    _heroEval.mode = 'dodge_side_roll';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = (u * 0.85) / HERO_CLIP_DODGE_DUR;
    const s = easeOutCubic(u);
    _heroEval.x = lerp(ax, ax - 1.58, s);
    _heroEval.y = Math.sin(u * Math.PI) * 0.14;
    _heroEval.z = lerp(az + 7.25, az + 7.02, s);
    _heroEval.facing = Math.PI + 0.42 * s;
    return _heroEval;
  }

  if (t < CHASM_FALL_START_TIME) {
    // 19.15–19.90 s: Rim cracks & collapses beneath Hero (`Cutscene_Dodge_Fall` 0.85–1.60 s)
    const u = clamp01((t - FLOOR_SMASH_TIME) / (CHASM_FALL_START_TIME - FLOOR_SMASH_TIME));
    _heroEval.mode = 'dodge_side_roll';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = (0.85 + u * 0.75) / HERO_CLIP_DODGE_DUR;
    const slip = easeInQuad(u);
    _heroEval.x = lerp(ax - 1.58, ax - 1.02, slip);
    _heroEval.y = lerp(0.0, -0.28, slip);
    _heroEval.z = lerp(az + 7.02, az + 6.72, slip);
    _heroEval.facing = Math.PI + lerp(0.42, 0.18, u);
    return _heroEval;
  }

  if (t < ACT3_END) {
    // 19.90–22.80 s: Plummets down through the open 3D floor chasm (`y: -0.28 -> -18.5 m`)
    const u = clamp01((t - CHASM_FALL_START_TIME) / (ACT3_END - CHASM_FALL_START_TIME));
    _heroEval.mode = 'fall_chasm';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    // Maps smoothly across 0.2286 -> 0.72 so Act 4 shaft plunge seamlessly completes 0.72 -> 1.00!
    _heroEval.animU = lerp(1.60 / HERO_CLIP_DODGE_DUR, 0.72, u);
    _heroEval.x = lerp(ax - 1.02, holeX - 0.18, smoothstep(u)) + Math.sin(u * 9.5) * 0.14;
    _heroEval.y = -0.28 - 18.22 * (0.20 * u + 0.80 * u * u);
    _heroEval.z = lerp(az + 6.72, holeZ + 0.05, smoothstep(u));
    _heroEval.facing = Math.PI + Math.sin(u * 5.0) * 0.35;
    return _heroEval;
  }

  // --- ACT 4: Vertical Shaft Fall (22.80–24.85 s) -> Underground River Rapids & Grate Smash (24.85–29.00 s) ---
  if (t < WATER_SPLASH_TIME) {
    const u = clamp01((t - ACT4_START) / (WATER_SPLASH_TIME - ACT4_START));
    _heroEval.mode = 'fall_chasm';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = lerp(0.72, 1.0, u);
    _heroEval.x = 0.28 * (1.0 - u) + Math.sin(u * 7.8) * 0.22;
    _heroEval.y = lerp(SHAFT_ENTRY_HERO_Y, RIVER_WATER_Y + 0.20, 0.38 * u + 0.62 * u * u);
    _heroEval.z = lerp(0.0, 1.15, smoothstep(u));
    _heroEval.facing = Math.PI + Math.sin(u * 6.4) * 0.45;
    return _heroEval;
  }

  if (t < ACT4_END) {
    const dt = t - WATER_SPLASH_TIME;
    const span = ACT4_END - WATER_SPLASH_TIME;
    const u = clamp01(dt / span);
    _heroEval.mode = 'river_tumble';
    _heroEval.animName = 'Cutscene_River_Tumble';
    _heroEval.animU = clamp01(dt / HERO_CLIP_RIVER_DUR);

    // Swept from splash (z = 1.15) -> iron grate impact (z = 26.0 @ 27.85 s) -> waterfall exit (z = 34.0 @ 29.00 s)
    let zPos;
    let yPos;
    if (t < GRATE_BREAK_TIME) {
      const rU = clamp01((t - WATER_SPLASH_TIME) / (GRATE_BREAK_TIME - WATER_SPLASH_TIME));
      // Rapid plunge down to y = -1.45 m, then buoyant surge back onto churning whitewater surface
      if (rU < 0.24) {
        yPos = lerp(0.20, -1.45, easeOutCubic(rU / 0.24));
      } else if (rU < 0.74) {
        yPos = lerp(-1.45, 0.14, smoothstep((rU - 0.24) / 0.50));
      } else {
        yPos = 0.14 + Math.sin((rU - 0.74) * Math.PI * 3.0) * 0.16;
      }
      zPos = lerp(1.15, RIVER_GRATE_Z, 0.75 * rU + 0.25 * rU * rU);
    } else {
      const eU = clamp01((t - GRATE_BREAK_TIME) / (ACT4_END - GRATE_BREAK_TIME));
      yPos = 0.16 - 0.36 * eU + Math.sin(eU * Math.PI) * 0.28;
      zPos = lerp(RIVER_GRATE_Z, RIVER_EXIT_Z, easeOutCubic(eU));
    }

    _heroEval.x = Math.sin(dt * 3.1) * 0.62 * (1.0 - 0.55 * u);
    _heroEval.y = yPos;
    _heroEval.z = zPos;
    // Swept head/torso forward along +Z toward the moonlit grate
    _heroEval.facing = Math.sin(dt * 2.6) * 0.32;
    return _heroEval;
  }

  // --- ACT 5: Exterior Shore Wakeup (29.00–32.50 s) ---
  const wakeU = clamp01((t - ACT5_START) / HERO_CLIP_WAKE_DUR);
  _heroEval.mode = 'shore_wakeup';
  _heroEval.animName = 'Cutscene_Shore_WakeUp';
  _heroEval.animU = wakeU;
  _heroEval.x = rig.shoreWakeX;
  _heroEval.y = rig.shoreWakeY;
  _heroEval.z = rig.shoreWakeZ;
  _heroEval.facing = SHORE_WAKE_FACING;
  return _heroEval;
}

const _bossEval = {
  visible: true,
  x: 0,
  y: 0,
  z: 0,
  facing: 0,
  animName: 'Escape_Parry_Disarm',
  animU: 0,
  enragedFire: false,
  chuckle01: 0
};

function evaluateBossState(t, rig) {
  if (t >= ACT3_END) {
    _bossEval.visible = false;
    _bossEval.x = rig.anchorX;
    _bossEval.y = 0;
    _bossEval.z = rig.anchorZ + 4.10;
    _bossEval.facing = 0;
    _bossEval.animName = 'Escape_Floor_Smash';
    _bossEval.animU = 1.0;
    _bossEval.enragedFire = false;
    _bossEval.chuckle01 = 0.0;
    return _bossEval;
  }

  const ax = rig.anchorX;
  const az = rig.anchorZ;
  _bossEval.visible = true;
  _bossEval.y = 0.0;
  _bossEval.facing = 0.0; // Facing South (+Z) toward the Hero

  if (t < ACT1_END) {
    // Act 1: `Escape_Parry_Disarm` (0.00 – 5.20 s)
    _bossEval.animName = 'Escape_Parry_Disarm';
    _bossEval.animU = clamp01(t / BOSS_CLIP_PARRY_DUR);
    _bossEval.enragedFire = false;
    _bossEval.chuckle01 = 0.0;

    if (t < CLASH_1_TIME) {
      const u = smoothstep(t / CLASH_1_TIME);
      _bossEval.x = ax;
      _bossEval.z = lerp(az - 1.55, az - 1.32, u);
    } else if (t < CLASH_2_TIME) {
      const u = smoothstep((t - CLASH_1_TIME) / (CLASH_2_TIME - CLASH_1_TIME));
      _bossEval.x = ax + Math.sin(u * Math.PI) * 0.16;
      _bossEval.z = lerp(az - 1.32, az - 0.72, u);
    } else if (t < SWORD_DISARM_TIME) {
      const u = smoothstep((t - CLASH_2_TIME) / (SWORD_DISARM_TIME - CLASH_2_TIME));
      _bossEval.x = ax - Math.sin(u * Math.PI) * 0.14;
      _bossEval.z = lerp(az - 0.72, az - 0.25, u);
    } else if (t < 3.55) {
      const u = smoothstep((t - SWORD_DISARM_TIME) / (3.55 - SWORD_DISARM_TIME));
      _bossEval.x = ax;
      _bossEval.z = lerp(az - 0.25, az + 0.55, u);
    } else {
      const u = smoothstep((t - 3.55) / (ACT1_END - 3.55));
      _bossEval.x = ax;
      _bossEval.z = lerp(az + 0.55, az + 0.75, u);
    }
    return _bossEval;
  }

  if (t < ACT2_END) {
    // Act 2: `Escape_Taunt_Walk` (5.20 – 15.80 s) — predatory measured stalk with warhammer on shoulder
    _bossEval.animName = 'Escape_Taunt_Walk';
    _bossEval.animU = clamp01((t - ACT2_START) / BOSS_CLIP_TAUNT_DUR);

    let zPos;
    if (t < 8.80) {
      zPos = lerp(az + 0.75, az + 1.75, smoothstep((t - ACT2_START) / (8.80 - ACT2_START)));
    } else if (t < 11.50) {
      zPos = lerp(az + 1.75, az + 2.35, smoothstep((t - 8.80) / (11.50 - 8.80)));
    } else if (t < 14.80) {
      zPos = lerp(az + 2.35, az + 3.55, smoothstep((t - 11.50) / (14.80 - 11.50)));
    } else {
      // Plants boots firmly as both hands grip the warhammer (`9.40–10.60 s` of clip)
      zPos = lerp(az + 3.55, az + 3.75, smoothstep((t - 14.80) / (ACT2_END - 14.80)));
    }
    const walkSway = t < 14.80 ? Math.sin((t - ACT2_START) * 2.1) * 0.09 : 0.0;
    _bossEval.x = ax + walkSway;
    _bossEval.z = zPos;

    // Chuckle shoulder shake synced 1:1 with VO 1 baked chuckle (5.40–6.75 s) + mocking beat in VO 2 (9.00–9.85 s)
    const chuckle1 = pulseBell(t, VO1_START, VO1_START + 1.35) * (0.72 + 0.28 * Math.abs(Math.sin((t - VO1_START) * 18.0)));
    const chuckle2 = pulseBell(t, VO2_START + 0.25, VO2_START + 1.10) * 0.42;
    _bossEval.chuckle01 = clamp01(Math.max(chuckle1, chuckle2));
    _bossEval.enragedFire = t >= BOSS_ENRAGED_FIRE_START;
    return _bossEval;
  }

  // Act 3: `Escape_Floor_Smash` (15.80 – 22.80 s) — overhead slam & peering into the smoking chasm
  _bossEval.animName = 'Escape_Floor_Smash';
  _bossEval.animU = clamp01((t - ACT3_START) / BOSS_CLIP_SMASH_DUR);
  const stepIntoSmash = smoothstep(clamp01((t - 18.90) / 0.30));
  _bossEval.x = ax;
  _bossEval.z = lerp(az + 3.75, az + 4.10, stepIntoSmash);
  _bossEval.chuckle01 = 0.0;
  _bossEval.enragedFire = t >= BOSS_ENRAGED_FIRE_START && t < BOSS_ENRAGED_FIRE_END;
  return _bossEval;
}

/**
 * Exact ballistic trajectory of the disarmed Oathblade (`droppedSword`), mutating `target` in-place:
 *   - `t < 2.65 s`: hidden (still held in Hero's right hand)
 *   - `2.65 – 3.38 s`: airborne parabolic arc & rapid end-over-end spin after Boss disarm whip
 *   - `3.38 – 3.74 s`: metallic clatter bounce off stone floor
 *   - `3.74 – 4.55 s`: damped slide across crimson cathedral carpet to `(ax + 1.56, 0.045, az + 6.28)`
 *   - `4.55 – 19.65 s`: resting visibly on carpet beside scooting Hero (inside 2.25 m chasm radius!)
 *   - `19.65 – 22.80 s`: tips off shattered slab & plunges spinning down chasm right after Hero
 *   - `22.80 – 28.60 s`: tumbles nearby down shaft & underground river current
 *   - `t >= 29.00 s`: hidden (exteriorShore renders the interactive Oathblade stuck in shore gravel!)
 */
function evaluateDroppedSword(t, rig, heroState, target) {
  if (t < SWORD_DISARM_TIME || t >= ACT4_END) {
    target.visible = false;
    target.x = 0;
    target.y = 0;
    target.z = 0;
    target.rx = 0;
    target.ry = 0;
    target.rz = 0;
    return target;
  }

  const ax = rig.anchorX;
  const az = rig.anchorZ;
  const holeX = rig.floorHoleX;
  const holeZ = rig.floorHoleZ;

  target.visible = true;

  // Phase A: Airborne ballistic arc (2.65 – 3.38 s, dt = 0.73 s)
  if (t < 3.38) {
    const dt = t - SWORD_DISARM_TIME;
    const u = dt / 0.73;
    target.x = lerp(ax + 0.42, ax + 1.18, u);
    // Exact projectile: y(0) = 1.38, apex ~ 1.74 m @ dt = 0.23 s, y(0.73) = 0.06 m
    target.y = Math.max(0.055, 1.38 + 3.10 * dt - 0.5 * 13.45 * dt * dt);
    target.z = lerp(az + 1.85, az + 4.40, u);
    target.rx = 0.45 + dt * 16.5;
    target.ry = 0.35 + dt * 5.2;
    target.rz = 0.25 + dt * 11.4;
    return target;
  }

  // Phase B: First metallic bounce on stone (3.38 – 3.74 s, dt = 0.36 s)
  if (t < 3.74) {
    const u = (t - 3.38) / 0.36;
    target.x = lerp(ax + 1.18, ax + 1.42, u);
    target.y = 0.055 + Math.sin(u * Math.PI) * 0.32;
    target.z = lerp(az + 4.40, az + 5.38, u);
    target.rx = lerp(Math.PI * 0.5 + 1.15, Math.PI * 0.5, easeOutCubic(u));
    target.ry = lerp(0.95, 0.68, u);
    target.rz = lerp(0.85, 0.06, easeOutCubic(u));
    return target;
  }

  // Phase C: Sliding to rest along crimson cathedral carpet (3.74 – 4.55 s)
  if (t < 4.55) {
    const u = (t - 3.74) / (4.55 - 3.74);
    const slide = 1.0 - Math.pow(1.0 - u, 2.4);
    target.x = lerp(ax + 1.42, ax + 1.56, slide);
    target.y = 0.045;
    target.z = lerp(az + 5.38, az + 6.28, slide);
    target.rx = Math.PI * 0.5;
    target.ry = lerp(0.68, 0.58, slide);
    target.rz = lerp(0.06, 0.02, slide);
    return target;
  }

  // Phase D: Resting visibly on carpet during Act 2 & early Act 3 (4.55 – 19.65 s)
  if (t < 19.65) {
    const rattle = t >= FLOOR_SMASH_TIME
      ? Math.sin((t - FLOOR_SMASH_TIME) * 62.0) * 0.032 * (1.0 - (t - FLOOR_SMASH_TIME) / 0.50)
      : 0.0;
    const hop = t >= FLOOR_SMASH_TIME && t < 19.45
      ? Math.sin(((t - FLOOR_SMASH_TIME) / 0.30) * Math.PI) * 0.14
      : 0.0;
    target.x = ax + 1.56 + rattle;
    target.y = 0.045 + hop;
    target.z = az + 6.28 + rattle * 0.5;
    target.rx = Math.PI * 0.5 + rattle * 2.4;
    target.ry = 0.58 + rattle * 1.6;
    target.rz = 0.02 + rattle * 1.8;
    return target;
  }

  // Phase E: Sliding off tilted rim & plunging into the 3D chasm right behind Hero (19.65 – 22.80 s)
  if (t < ACT3_END) {
    if (t < 20.15) {
      const u = (t - 19.65) / 0.50;
      const tip = easeInQuad(u);
      target.x = lerp(ax + 1.56, holeX + 0.92, tip);
      target.y = lerp(0.045, -0.35, tip);
      target.z = lerp(az + 6.28, holeZ + 0.05, tip);
      target.rx = Math.PI * 0.5 + tip * 0.95;
      target.ry = 0.58 + tip * 0.45;
      target.rz = 0.02 + tip * 0.72;
    } else {
      const dt = t - 20.15;
      const u = clamp01(dt / (ACT3_END - 20.15));
      target.x = lerp(holeX + 0.92, holeX + 0.45, smoothstep(u));
      target.y = -0.35 - 17.80 * (0.16 * u + 0.84 * u * u);
      target.z = lerp(holeZ + 0.05, holeZ - 0.18, smoothstep(u));
      target.rx = Math.PI * 0.5 + 0.95 + dt * 5.8;
      target.ry = 1.03 + dt * 2.4;
      target.rz = 0.74 + dt * 4.2;
    }
    return target;
  }

  // Phase F: Tumbling alongside Hero in Shaft & Underground River (22.80 – 28.60 s)
  if (t < 28.60) {
    const dt = t - ACT4_START;
    if (t < WATER_SPLASH_TIME) {
      target.x = heroState.x + 1.25;
      target.y = heroState.y + 2.35;
      target.z = heroState.z - 0.55;
      target.rx = 1.2 + dt * 6.4;
      target.ry = 0.6 + dt * 3.1;
      target.rz = 0.4 + dt * 4.7;
    } else {
      const rdt = t - WATER_SPLASH_TIME;
      target.x = heroState.x + 1.05 * Math.cos(rdt * 1.4);
      target.y = heroState.y + 0.25 + Math.sin(rdt * 4.2) * 0.22;
      target.z = heroState.z + 1.45;
      target.rx = Math.PI * 0.5 + Math.sin(rdt * 3.5) * 0.55;
      target.ry = rdt * 3.8;
      target.rz = Math.cos(rdt * 4.1) * 0.48;
    }
    return target;
  }

  target.visible = false;
  return target;
}

/**
 * Fallback zero-GC multi-syllable speech envelope used when no external 30-FPS lip-sync
 * curve (`sampleEscapeBossMouthOpen`) is bound yet. Produces expressive jaw articulation
 * tuned to the exact phrasing & pauses of all 4 Escape VO lines.
 */
function sampleDefaultEscapeMouthOpen(cueIndex, localTimeSec, durationSec) {
  if (!Number.isFinite(localTimeSec) || localTimeSec < 0) return 0.0;
  const dur = Number.isFinite(durationSec) && durationSec > 0.2 ? durationSec : 2.0;
  if (localTimeSec >= dur) return 0.0;

  const u = localTimeSec / dur;
  const edgeEnv = smoothstep(u / 0.08) * (1.0 - smoothstep((u - 0.88) / 0.12));

  // Add realistic dramatic pauses matching ellipses ("...", ".") in each line
  let phraseGate = 1.0;
  if (cueIndex === 1) {
    // "[chuckle] Did you truly think... that was the end?"
    if (u > 0.16 && u < 0.24) phraseGate = 0.12;
    else if (u > 0.56 && u < 0.66) phraseGate = 0.08;
  } else if (cueIndex === 2) {
    // "Brave. Almost... touching."
    if (u > 0.22 && u < 0.34) phraseGate = 0.08;
    else if (u > 0.60 && u < 0.72) phraseGate = 0.10;
  } else if (cueIndex === 3) {
    // "Yet you never learned the rules of my house. Guests do not leave..."
    if (u > 0.55 && u < 0.65) phraseGate = 0.10;
  } else if (cueIndex === 4) {
    // "...they go down below."
    if (u < 0.08) phraseGate = 0.20;
  }

  const syllFreq = cueIndex === 4 ? 17.5 : cueIndex === 2 ? 18.5 : 22.0;
  const wave = 0.52 + 0.34 * Math.sin(localTimeSec * syllFreq + cueIndex * 1.1)
    + 0.18 * Math.sin(localTimeSec * (syllFreq * 1.63) + 0.7);
  return clamp01(wave * phraseGate * edgeEnv);
}

function findActiveDialogueCue(t, cues) {
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (t >= cue.start && t < cue.end) return cue;
  }
  return null;
}

function evaluateSlowMoFactor(t) {
  if (t <= 18.22 || t >= 19.14) return 1.0;
  if (t < 18.42) {
    return lerp(1.0, 0.28, smoothstep((t - 18.22) / 0.20));
  }
  if (t <= 18.92) {
    return 0.28;
  }
  return lerp(0.28, 1.0, smoothstep((t - 18.92) / 0.22));
}

function evaluateFloorHoleProgress(t) {
  if (t < FLOOR_SMASH_TIME || t >= ACT3_END) return 0.0;
  if (t < 19.45) {
    return 0.72 * easeOutCubic((t - FLOOR_SMASH_TIME) / (19.45 - FLOOR_SMASH_TIME));
  }
  if (t < 19.95) {
    return lerp(0.72, 1.0, smoothstep((t - 19.45) / (19.95 - 19.45)));
  }
  return 1.0;
}

function evaluateUnderwater01(t) {
  if (t < WATER_SPLASH_TIME || t >= UNDERWATER_END_TIME) return 0.0;
  if (t < 25.05) {
    return smoothstep((t - WATER_SPLASH_TIME) / (25.05 - WATER_SPLASH_TIME));
  }
  if (t < 26.45) {
    return 0.94 + 0.06 * Math.sin((t - 25.05) * 9.5);
  }
  return 1.0 - smoothstep((t - 26.45) / (UNDERWATER_END_TIME - 26.45));
}

function evaluateFadeToBlack01(t) {
  if (t < FADE_OUT_START_TIME || t >= FADE_IN_END_TIME) return 0.0;
  if (t < SHORE_TRANSITION_TIME) {
    return smoothstep((t - FADE_OUT_START_TIME) / (SHORE_TRANSITION_TIME - FADE_OUT_START_TIME));
  }
  if (t < SHORE_WAKE_CUE_TIME) {
    return 1.0;
  }
  return 1.0 - smoothstep((t - SHORE_WAKE_CUE_TIME) / (FADE_IN_END_TIME - SHORE_WAKE_CUE_TIME));
}

function evaluateLetterbox01(t) {
  if (t <= 0.0 || t >= BOSS_ESCAPE_CUTSCENE_DURATION) return 0.0;
  if (t < 0.38) return smoothstep(t / 0.38);
  if (t < LETTERBOX_OUT_START_TIME) return 1.0;
  return 1.0 - smoothstep((t - LETTERBOX_OUT_START_TIME) / (BOSS_ESCAPE_CUTSCENE_DURATION - LETTERBOX_OUT_START_TIME));
}

function evaluateScreenShake(t) {
  if (t <= 0.0 || t >= BOSS_ESCAPE_CUTSCENE_DURATION) return 0.0;
  let s = 0.0;
  s = Math.max(s, decayImpulse(t, CLASH_1_TIME, 0.32, 0.72));
  s = Math.max(s, decayImpulse(t, CLASH_2_TIME, 0.28, 0.65));
  s = Math.max(s, decayImpulse(t, SWORD_DISARM_TIME, 0.34, 0.80));
  s = Math.max(s, decayImpulse(t, KNOCKDOWN_CUE_TIME, 0.44, 0.92));
  // Colossal 1.40 earthquake shockwave on the 4.5 m cathedral floor smash!
  s = Math.max(s, decayImpulse(t, FLOOR_SMASH_TIME, 1.35, 1.40));
  s = Math.max(s, decayImpulse(t, WATER_SPLASH_TIME, 0.52, 0.88));
  s = Math.max(s, decayImpulse(t, GRATE_BREAK_TIME, 0.62, 1.12));
  return s;
}

function evaluateHitstopSec(t) {
  if (t >= CLASH_1_TIME && t < CLASH_1_TIME + 0.07) return 0.065;
  if (t >= CLASH_2_TIME && t < CLASH_2_TIME + 0.06) return 0.055;
  if (t >= SWORD_DISARM_TIME && t < SWORD_DISARM_TIME + 0.07) return 0.065;
  if (t >= FLOOR_SMASH_TIME && t < FLOOR_SMASH_TIME + 0.09) return 0.085;
  return 0.0;
}

function evaluateScootCue(t) {
  if (t < SCOOT_FIRST_CUE_TIME) return 0;
  const clamped = t > SCOOT_END_TIME ? SCOOT_END_TIME : t;
  return Math.floor((clamped - SCOOT_FIRST_CUE_TIME) / SCOOT_STEP_INTERVAL) + 1;
}

// ============================================================================
// Public Deterministic Camera Shake Offset Helper (Zero GC)
// ============================================================================

/**
 * Computes a deterministic multi-frequency camera tremor offset from `screenShake` (`0 .. 1.4`).
 *
 * @param {number} elapsed
 * @param {number} shake
 * @param {{ x: number, y: number, z: number, roll: number }|null} [out]
 * @returns {{ x: number, y: number, z: number, roll: number }}
 */
export function computeBossEscapeCameraShakeOffset(elapsed, shake, out = null) {
  const target = out || { x: 0, y: 0, z: 0, roll: 0 };
  const s = Number.isFinite(shake) && shake > 0 ? Math.min(1.6, shake) : 0;
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  if (s <= 0.0005) {
    target.x = 0;
    target.y = 0;
    target.z = 0;
    target.roll = 0;
    return target;
  }

  const amp = 0.072 * s * (0.48 + 0.52 * Math.min(1.4, s));
  const wx = Math.sin(t * 53.0) * 0.58 + Math.sin(t * 97.0 + 1.1) * 0.42;
  const wy = Math.cos(t * 61.0 + 0.7) * 0.62 + Math.sin(t * 109.0 + 2.3) * 0.38;
  const wz = Math.sin(t * 43.0 + 2.1) * 0.55 + Math.cos(t * 79.0 + 0.8) * 0.45;

  target.x = wx * amp;
  target.y = wy * amp * 0.82;
  target.z = wz * amp * 0.55;
  target.roll = (Math.sin(t * 47.0 + 0.5) * 0.6 + Math.cos(t * 83.0) * 0.4) * 0.014 * s;
  return target;
}

// ============================================================================
// Public Master Evaluator: sampleBossEscapeCutscene
// ============================================================================

/**
 * Evaluates the complete 32.5-second Boss Escape Cutscene state at timestamp `tSec`.
 * Pure, deterministic, zero-GC when `outState` is reused across frames.
 *
 * @param {object|null} rig - Rig returned by `createBossEscapeCutsceneRig(...)` (falls back to default rig).
 * @param {number} tSec - Elapsed cutscene time in seconds (`0 .. 32.5`).
 * @param {object|null} [outState] - Optional pre-allocated state object to mutate in-place.
 * @param {{
 *   sampleMouthOpen?: ((cueIndex: number, localTimeSec: number) => number)|null,
 *   normalCamPos?: { x: number, y: number, z: number }|number[]|null,
 *   normalCamLook?: { x: number, y: number, z: number }|number[]|null,
 *   normalFov?: number
 * }|null} [opts]
 */
export function sampleBossEscapeCutscene(rig, tSec, outState = null, opts = null) {
  const activeRig = rig && Array.isArray(rig.castleCamKnots) ? rig : DEFAULT_RIG;
  const out = outState && typeof outState === 'object' ? outState : createBossEscapeCutsceneState();
  if (!out.camPos || typeof out.camPos !== 'object') out.camPos = { x: 0, y: 0, z: 0 };
  if (!out.camLook || typeof out.camLook !== 'object') out.camLook = { x: 0, y: 0, z: 0 };
  if (!out.droppedSword || typeof out.droppedSword !== 'object') {
    out.droppedSword = { visible: false, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  }
  if (!out.cues || typeof out.cues !== 'object') {
    out.cues = {
      voiceCue: 0,
      clashCue: 0,
      disarmCue: 0,
      knockdownCue: 0,
      scootCue: 0,
      slowMoCue: 0,
      floorSmashCue: 0,
      waterSplashCue: 0,
      grateBreakCue: 0,
      shoreWakeCue: 0
    };
  }

  const rawT = Number(tSec);
  const safeT = Number.isFinite(rawT) ? Math.max(0.0, rawT) : 0.0;
  const t = safeT >= BOSS_ESCAPE_CUTSCENE_DURATION ? BOSS_ESCAPE_CUTSCENE_DURATION : safeT;
  const finished = safeT >= BOSS_ESCAPE_CUTSCENE_DURATION;

  // Act & Stage Mode Classification
  let act;
  let actId;
  let actProgress;
  let stageMode;
  if (t < ACT1_END) {
    act = 1;
    actId = 'parry_disarm';
    actProgress = clamp01(t / ACT1_END);
    stageMode = 'castle';
  } else if (t < ACT2_END) {
    act = 2;
    actId = 'scoot_monologue';
    actProgress = clamp01((t - ACT2_START) / (ACT2_END - ACT2_START));
    stageMode = 'castle';
  } else if (t < ACT3_END) {
    act = 3;
    actId = 'floor_smash_chasm';
    actProgress = clamp01((t - ACT3_START) / (ACT3_END - ACT3_START));
    stageMode = 'castle';
  } else if (t < ACT4_END) {
    act = 4;
    actId = 'shaft_river';
    actProgress = clamp01((t - ACT4_START) / (ACT4_END - ACT4_START));
    stageMode = 'shaft_river';
  } else {
    act = 5;
    actId = 'exterior_shore';
    actProgress = clamp01((t - ACT5_START) / (ACT5_END - ACT5_START));
    stageMode = 'exterior_shore';
  }

  // Camera Evaluation (3 stage-isolated C1 Hermite splines — zero cross-stage overshoot!)
  let camSample;
  if (stageMode === 'castle') {
    camSample = sampleSplineSegment(t, activeRig.castleCamKnots, activeRig.castleCamTangents);
  } else if (stageMode === 'shaft_river') {
    camSample = sampleSplineSegment(t, activeRig.shaftCamKnots, activeRig.shaftCamTangents);
  } else {
    camSample = sampleSplineSegment(t, activeRig.shoreCamKnots, activeRig.shoreCamTangents);
  }

  let camPosX = camSample.px;
  let camPosY = camSample.py;
  let camPosZ = camSample.pz;
  let camLookX = camSample.lx;
  let camLookY = camSample.ly;
  let camLookZ = camSample.lz;
  let camFov = camSample.fov;

  // Optional final chase-camera override during the Act 5 handoff window (31.35 – 32.50 s)
  if (stageMode === 'exterior_shore' && opts && (opts.normalCamPos || opts.normalCamLook || Number.isFinite(opts.normalFov))) {
    const handoffW = finished ? 1.0 : smootherstep((t - LETTERBOX_OUT_START_TIME) / (ACT5_END - LETTERBOX_OUT_START_TIME));
    if (handoffW > 0) {
      const nPosX = readVec3X(opts.normalCamPos, activeRig.defaultNormalCamPos.x);
      const nPosY = readVec3Y(opts.normalCamPos, activeRig.defaultNormalCamPos.y);
      const nPosZ = readVec3Z(opts.normalCamPos, activeRig.defaultNormalCamPos.z);
      const nLookX = readVec3X(opts.normalCamLook, activeRig.defaultNormalCamLook.x);
      const nLookY = readVec3Y(opts.normalCamLook, activeRig.defaultNormalCamLook.y);
      const nLookZ = readVec3Z(opts.normalCamLook, activeRig.defaultNormalCamLook.z);
      const nFov = Number.isFinite(opts.normalFov) && opts.normalFov > 15 && opts.normalFov < 110
        ? opts.normalFov
        : activeRig.normalFov;
      camPosX = lerp(camPosX, nPosX, handoffW);
      camPosY = lerp(camPosY, nPosY, handoffW);
      camPosZ = lerp(camPosZ, nPosZ, handoffW);
      camLookX = lerp(camLookX, nLookX, handoffW);
      camLookY = lerp(camLookY, nLookY, handoffW);
      camLookZ = lerp(camLookZ, nLookZ, handoffW);
      camFov = lerp(camFov, nFov, handoffW);
    }
  }

  // Hero, Boss & Dropped Sword Kinematics
  const hero = evaluateHeroState(t, activeRig);
  const boss = evaluateBossState(t, activeRig);
  evaluateDroppedSword(t, activeRig, hero, out.droppedSword);

  // Dialogue & Lip-Sync (exact 30-FPS mastered curve from `soulsEscapeAudio.js`, overridable via opts/provider)
  const activeCue = finished ? null : findActiveDialogueCue(t, activeRig.dialogueCues);
  const voiceCueIndex = activeCue ? activeCue.index : 0;
  const voiceLocalTime = activeCue ? Math.max(0.0, t - activeCue.start) : 0.0;
  let bossMouthOpen01 = 0.0;
  if (voiceCueIndex > 0 && boss.visible) {
    const mouthFn = (opts && typeof opts.sampleMouthOpen === 'function')
      ? opts.sampleMouthOpen
      : (activeRig.sampleMouthOpen || _externalMouthSampler || sampleEscapeBossMouthOpen);
    if (typeof mouthFn === 'function') {
      const sampled = Number(mouthFn(voiceCueIndex, voiceLocalTime));
      bossMouthOpen01 = Number.isFinite(sampled) ? clamp01(sampled) : 0.0;
    } else {
      bossMouthOpen01 = sampleDefaultEscapeMouthOpen(voiceCueIndex, voiceLocalTime, activeCue.duration);
    }
  }

  // Floor Chasm, Slow-Mo, Underwater, Fade, Shake & Letterbox
  const floorHoleProgress = evaluateFloorHoleProgress(t);
  const floorHoleRadius = floorHoleProgress * activeRig.floorHoleMaxRadius;
  const slowMoFactor = finished ? 1.0 : evaluateSlowMoFactor(t);
  const underwater01 = finished ? 0.0 : evaluateUnderwater01(t);
  const fadeToBlack01 = finished ? 0.0 : evaluateFadeToBlack01(t);
  const letterbox01 = evaluateLetterbox01(t);
  const screenShake = finished ? 0.0 : evaluateScreenShake(t);
  const hitstopSec = finished ? 0.0 : evaluateHitstopSec(t);

  // Monotonic Event Cues (plus active voiceCue)
  const clashCue = t >= CLASH_2_TIME ? 2 : t >= CLASH_1_TIME ? 1 : 0;
  const disarmCue = t >= SWORD_DISARM_TIME ? 1 : 0;
  const knockdownCue = t >= KNOCKDOWN_CUE_TIME ? 1 : 0;
  const scootCue = evaluateScootCue(t);
  const slowMoCue = t >= SLOWMO_START_TIME ? 1 : 0;
  const floorSmashCue = t >= FLOOR_SMASH_TIME ? 1 : 0;
  const waterSplashCue = t >= WATER_SPLASH_TIME ? 1 : 0;
  const grateBreakCue = t >= GRATE_BREAK_TIME ? 1 : 0;
  const shoreWakeCue = t >= SHORE_WAKE_CUE_TIME ? 1 : 0;

  // Populate Flat Zero-GC Output State
  out.t = t;
  out.finished = finished;
  out.act = act;
  out.actId = actId;
  out.actProgress = actProgress;
  out.progress = clamp01(t / BOSS_ESCAPE_CUTSCENE_DURATION);
  out.stageMode = stageMode;
  out.letterbox01 = letterbox01;
  out.fadeToBlack01 = fadeToBlack01;
  out.underwater01 = underwater01;
  out.slowMoFactor = slowMoFactor;
  out.canSkip = !finished && t >= BOSS_ESCAPE_CUTSCENE_SKIP_TIME;
  out.screenShake = screenShake;
  out.hitstopSec = hitstopSec;

  out.camPos.x = camPosX;
  out.camPos.y = camPosY;
  out.camPos.z = camPosZ;
  out.camLook.x = camLookX;
  out.camLook.y = camLookY;
  out.camLook.z = camLookZ;
  out.camFov = camFov;
  out.fov = camFov;

  out.heroMode = hero.mode;
  out.heroAnimName = hero.animName;
  out.heroX = hero.x;
  out.heroY = hero.y;
  out.heroZ = hero.z;
  out.heroFacing = hero.facing;
  out.heroAnimU = hero.animU;
  out.swordDisarmed = t >= SWORD_DISARM_TIME;
  // Shield knocked loose in castle/river; restored on shore so only Oathblade requires pickup
  out.shieldDisarmed = t >= SHIELD_DISARM_TIME && t < SHORE_TRANSITION_TIME;

  out.bossVisible = boss.visible;
  out.bossX = boss.x;
  out.bossY = boss.y;
  out.bossZ = boss.z;
  out.bossFacing = boss.facing;
  out.bossAnimName = boss.animName;
  out.bossAnimU = boss.animU;
  out.bossMouthOpen01 = bossMouthOpen01;
  out.bossEnragedFire = boss.enragedFire;
  out.bossChuckle01 = boss.chuckle01;

  out.floorHoleX = activeRig.floorHoleX;
  out.floorHoleZ = activeRig.floorHoleZ;
  out.floorHoleRadius = floorHoleRadius;
  out.floorHoleProgress = floorHoleProgress;

  out.voiceCueIndex = voiceCueIndex;
  out.voiceLocalTime = voiceLocalTime;
  out.subtitleSpeaker = activeCue ? activeCue.speaker : '';
  out.subtitleText = activeCue ? activeCue.text : '';
  out.subtitleTextEn = activeCue ? activeCue.textEn : '';

  out.showLocationCard = !finished && t >= LOCATION_CARD_START_TIME && t < LOCATION_CARD_END_TIME;
  out.locationTitleRu = LOCATION_TITLE_RU;
  out.locationSubtitleRu = LOCATION_SUBTITLE_RU;

  out.clashSparkCue = clashCue;
  out.cues.voiceCue = voiceCueIndex;
  out.cues.clashCue = clashCue;
  out.cues.disarmCue = disarmCue;
  out.cues.knockdownCue = knockdownCue;
  out.cues.scootCue = scootCue;
  out.cues.slowMoCue = slowMoCue;
  out.cues.floorSmashCue = floorSmashCue;
  out.cues.waterSplashCue = waterSplashCue;
  out.cues.grateBreakCue = grateBreakCue;
  out.cues.shoreWakeCue = shoreWakeCue;

  return out;
}

/**
 * Returns the canonical post-skip end state (`stageMode: 'exterior_shore'`, Hero standing
 * unarmed on the wet gravel at `wakePos`, camera positioned behind Hero's shoulders).
 *
 * @param {object|null} [rig]
 * @param {object|null} [outState]
 * @param {object|null} [opts]
 */
export function getBossEscapeCutsceneSkipState(rig = null, outState = null, opts = null) {
  return sampleBossEscapeCutscene(rig, BOSS_ESCAPE_CUTSCENE_DURATION, outState, opts);
}
