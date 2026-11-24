// Full 34.0-Second AAA 12-Shot Narrative Post-Boss Escape Cutscene Choreography — «Escape from the Castle of Ash»
// Pure Zero-Dependency Vanilla ES Module (Browser / V8 / Node compatible, zero per-frame allocations).
//
// 100% Dynamically Anchored to `soulsCastleLayout.js` (`SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z`,
// `BOSS_RADIUS`, `BOSS_DOOR_Z`, `SOULS_CASTLE_THRONE_CONFIG`) & aligned 1:1 with:
//   - `soulsExteriorShore.js` (`EXTERIOR_SHORE_ANCHORS`)
//   - `Rift_Boss_Tripo.glb` (`Escape_Parry_Disarm` 5.20s, `Escape_Taunt_Walk` 10.60s, `Escape_Floor_Smash` 7.00s)
//   - `Warrior_Run.glb` (`Cutscene_FinalClash_Disarm` 3.40s, `Cutscene_Knockdown_Scoot` 12.60s,
//     `Cutscene_Dodge_Fall` 6.50s, `Cutscene_River_Tumble` 4.60s, `Cutscene_Shore_WakeUp` 4.55s)
//   - `soulsEscapeAudio.js` (`BOSS_ESCAPE_VO_DURATIONS_SEC`, `sampleEscapeBossMouthOpen`)
//
// 5-Act / 12-Shot Hard-Cut Cinematic Montage (34.000 s total, skippable after 1.500 s):
//   Act 1 (0.00 – 4.95 s)  — Shots 1–3:  «Схватка, выбивание меча и нокдаун» (`stageMode: 'castle'`)
//   Act 2 (4.95 – 17.85 s) — Shots 4–7:  «Кино-восьмёрка: отползание, монолог и ярость» (`stageMode: 'castle'`)
//   Act 3 (17.85 – 22.85 s)— Shots 8–10: «Слоу-мо уворот, пролом пола и взгляд из бездны» (`stageMode: 'castle'`)
//   Act 4 (22.85 – 29.45 s)— Shots 11A–C:«Шахта, нырок, подводный кадр и пробой решётки» (`stageMode: 'shaft_river'`)
//   Act 5 (29.45 – 34.00 s)— Shot 12A–B: «Пробуждение на берегу и панорама Замка Пепла» (`stageMode: 'exterior_shore'`)

import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_THRONE_CONFIG
} from './soulsCastleLayout.js?v=20261124z92';
import {
  BOSS_ESCAPE_VO_DURATIONS_SEC,
  sampleEscapeBossMouthOpen
} from './soulsEscapeAudio.js?v=20261124z92';

const BOSS_SPEAKER_RU = 'РЫЦАРЬ ПЕПЛА';
const LOCATION_TITLE_RU = 'БЕРЕГ ПЕПЕЛЬНОГО СТОКА';
const LOCATION_SUBTITLE_RU = 'ЗА СТЕНАМИ ЗАМКА ПЕПЛА';

// ============================================================================
// Master Timeline Constants (Exact Millisecond Alignment Across All 5 Acts & 12 Shots)
// ============================================================================
export const BOSS_ESCAPE_CUTSCENE_DURATION = 34.0;
export const BOSS_ESCAPE_CUTSCENE_SKIP_TIME = 1.5;

const ACT1_START = 0.0;
const ACT1_END = 4.95;
const ACT2_START = 4.95;
const ACT2_END = 17.85;
const ACT3_START = 17.85;
const ACT3_END = 22.85;
const ACT4_START = 22.85;
const ACT4_END = 29.45;
const ACT5_START = 29.45;
const ACT5_END = BOSS_ESCAPE_CUTSCENE_DURATION;

// Hard-Cut Shot Boundaries (14 camera cuts across the 12 dramatic shots)
const SHOT_01_END = 1.05;   // Shot 1: Low 3/4 duel lunge & shaft parry @ 0.85s
const SHOT_02_END = 2.85;   // Shot 2: Counter-angle shield bash @ 1.75s & Oathblade disarm @ 2.55s
const SHOT_03_END = 4.95;   // Shot 3: Wide side impact shove @ 3.35s & 3.4m knockdown landing @ 4.15s
const SHOT_04_END = 8.55;   // Shot 4: Low side 3/4 dolly (y=0.95m): full scooting Hero + sword + Boss
const SHOT_05_END = 11.55;  // Shot 5: Worm's-eye Boss close-up against chandelier & stained glass (VO 2)
const SHOT_06_END = 14.30;  // Shot 6: Reverse low-front Hero close-up, sword glance & dread (VO 3)
const SHOT_07_END = 17.85;  // Shot 7: Dramatic Boss push-in + dutch tilt (-0.08 rad) + fire + windup (VO 4)
const SHOT_08_END = 19.35;  // Shot 8: Carpet-level slow-mo dodge (0.24x) + floor smash @ 19.15s
const SHOT_09_END = 21.35;  // Shot 9: High 3/4 chasm collapse & Hero/sword plunge into abyss
const SHOT_10_END = 22.85;  // Shot 10: Iconic upward abyss shot from inside shaft (y = -9.5 -> -15.5m)
const SHOT_11A_END = 24.85; // Shot 11A: 360-degree gothic vertical shaft plunge toward black water
const SHOT_11B_END = 26.45; // Shot 11B: Violent water splash + underwater submersion + resurface
const SHOT_11C_END = 29.45; // Shot 11C: Underground torrent rush & explosive iron grate smash @ 27.65s
const SHOT_12A_END = 31.85; // Shot 12A -> 12B seamless crane-up & orbit into open-shore gameplay camera

// Key Dramatic Beat Timestamps (1:1 Synced with `Warrior_Run.glb`, `Rift_Boss_Tripo.glb` & `soulsEscapeAudio.js`)
const CLASH_1_TIME = 0.85;
const LUNGE_END_TIME = 1.05;
const CLASH_2_TIME = 1.75;
const SWORD_DISARM_TIME = 2.55;
const SWORD_LAND_TIME = 3.15;
const SHIELD_DISARM_TIME = 3.35;   // Shield knocked free on the crushing 3.35s shove (keeps shield intact for 1.75s block!)
const KNOCKDOWN_CLIP_START = 3.35; // `Cutscene_Knockdown_Scoot` starts seamlessly @ 3.35s
const KNOCKDOWN_CUE_TIME = 3.35;
const KNOCKDOWN_LAND_TIME = 4.15;  // Hard buttocks impact onto crimson cathedral carpet

const BOSS_TAUNT_CLIP_START = 5.20;
const BOSS_SMASH_CLIP_START = 15.80;

const SCOOT_START_TIME = 4.95;
const SCOOT_STEP_INTERVAL = 0.70;
const SCOOT_FIRST_CUE_TIME = 5.35;
const SCOOT_END_TIME = 15.65;

const VO1_START = 5.40;
const VO2_START = 8.75;
const VO3_START = 11.65;
const VO4_START = 15.95;
const BOSS_ENRAGED_FIRE_START = 14.60;
const BOSS_ENRAGED_FIRE_END = 20.85;

const DODGE_CLIP_START = 18.25;
const SLOWMO_START_TIME = 18.30;
const SLOWMO_END_TIME = 19.05;
const FLOOR_SMASH_TIME = 19.15;
const CHASM_OPEN_END_TIME = 19.85;
const CHASM_FALL_START_TIME = 19.85;
const FLOOR_HOLE_MAX_RADIUS = 2.25; // 4.50 m full diameter chasm matching `soulsExteriorShore.js`
const BOSS_SMASH_STANDOFF_Z = 2.85; // Boss feet stay 0.60 m BEHIND the solid north rim of the 2.25 m hole!

const SHAFT_TRANSITION_TIME = 22.85;
const WATER_SPLASH_TIME = 24.85;
const UNDERWATER_END_TIME = 26.65;
const GRATE_BREAK_TIME = 27.65;
const FADE_OUT_START_TIME = 28.85;
const SHORE_TRANSITION_TIME = 29.45;
const SHORE_WAKE_CUE_TIME = 29.50;
const FADE_IN_END_TIME = 30.15;
const LOCATION_CARD_START_TIME = 30.40;
const LOCATION_CARD_END_TIME = 33.60;
const LETTERBOX_OUT_START_TIME = 32.85;

// Clip Durations Matching `Rift_Boss_Tripo.glb` & `Warrior_Run.glb`
const BOSS_CLIP_PARRY_DUR = 5.20;   // Escape_Parry_Disarm        (0.00 – 5.20 s)
const BOSS_CLIP_TAUNT_DUR = 10.60;  // Escape_Taunt_Walk          (5.20 – 15.80 s)
const BOSS_CLIP_SMASH_DUR = 7.00;   // Escape_Floor_Smash         (15.80 – 22.80 s, holds end through 22.85 s)

const HERO_CLIP_CLASH_DUR = 3.40;   // Cutscene_FinalClash_Disarm (0.00 – 3.35 s -> C0 into Knockdown_Scoot)
const HERO_CLIP_SCOOT_DUR = 12.60;  // Cutscene_Knockdown_Scoot   (3.35 – 15.95 s, holds dread pose to 18.25 s)
const HERO_CLIP_DODGE_DUR = 6.50;   // Cutscene_Dodge_Fall        (18.25 – 24.85 s piecewise exact)
const HERO_CLIP_RIVER_DUR = 4.60;   // Cutscene_River_Tumble      (24.85 – 29.45 s exact 4.600 s!)
const HERO_CLIP_WAKE_DUR = 4.55;    // Cutscene_Shore_WakeUp      (29.45 – 34.00 s exact 4.550 s!)

// Exterior Shore Canonical Anchors (1:1 Aligned with `soulsExteriorShore.js`)
const SHORE_WAKE_X = 0.0;
const SHORE_WAKE_Y = 0.0;
const SHORE_WAKE_Z = 2.5;
const SHORE_WAKE_FACING = Math.PI;  // Facing North (-Z) toward Waterfall Culvert & Castle of Ash on Cliff
const FINAL_CAM_YAW = 0.0;          // Orbit yaw = 0 -> behind Hero (+Z) looking strictly North (-Z), open shore to z = +36 m!

const SHORE_SWORD_X = 2.8;
const SHORE_SWORD_Y = 0.077;
const SHORE_SWORD_Z = 5.2;

const SHORE_BONFIRE_X = -2.2;
const SHORE_BONFIRE_Y = 0.205;
const SHORE_BONFIRE_Z = 15.0;

const SHORE_GATE_X = 0.0;
const SHORE_GATE_Y = 0.558;
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
    const maxEnd = nextSpec ? round3(nextSpec.start - 0.08) : round3(ACT2_END - 0.10);
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

// Canonical 14-Cut / 12-Shot Editorial Table (exported for VFX, QA verifiers & storyboard tools)
export const BOSS_ESCAPE_SHOTS = Object.freeze([
  Object.freeze({ cutId: 1,  id: 'shot_01_parry_clash',       act: 1, stageMode: 'castle',         tStart: 0.00,  tEnd: SHOT_01_END  }),
  Object.freeze({ cutId: 2,  id: 'shot_02_shield_disarm',     act: 1, stageMode: 'castle',         tStart: SHOT_01_END,  tEnd: SHOT_02_END  }),
  Object.freeze({ cutId: 3,  id: 'shot_03_knockdown_wide',    act: 1, stageMode: 'castle',         tStart: SHOT_02_END,  tEnd: SHOT_03_END  }),
  Object.freeze({ cutId: 4,  id: 'shot_04_scoot_dolly',       act: 2, stageMode: 'castle',         tStart: SHOT_03_END,  tEnd: SHOT_04_END  }),
  Object.freeze({ cutId: 5,  id: 'shot_05_boss_wormseye',     act: 2, stageMode: 'castle',         tStart: SHOT_04_END,  tEnd: SHOT_05_END  }),
  Object.freeze({ cutId: 6,  id: 'shot_06_hero_reverse',      act: 2, stageMode: 'castle',         tStart: SHOT_05_END,  tEnd: SHOT_06_END  }),
  Object.freeze({ cutId: 7,  id: 'shot_07_boss_enrage_dutch', act: 2, stageMode: 'castle',         tStart: SHOT_06_END,  tEnd: SHOT_07_END  }),
  Object.freeze({ cutId: 8,  id: 'shot_08_slowmo_dodge_smash',act: 3, stageMode: 'castle',         tStart: SHOT_07_END,  tEnd: SHOT_08_END  }),
  Object.freeze({ cutId: 9,  id: 'shot_09_chasm_collapse',    act: 3, stageMode: 'castle',         tStart: SHOT_08_END,  tEnd: SHOT_09_END  }),
  Object.freeze({ cutId: 10, id: 'shot_10_abyss_upward',      act: 3, stageMode: 'castle',         tStart: SHOT_09_END,  tEnd: SHOT_10_END  }),
  Object.freeze({ cutId: 11, id: 'shot_11a_shaft_plunge',     act: 4, stageMode: 'shaft_river',    tStart: SHOT_10_END,  tEnd: SHOT_11A_END }),
  Object.freeze({ cutId: 12, id: 'shot_11b_water_underwater', act: 4, stageMode: 'shaft_river',    tStart: SHOT_11A_END, tEnd: SHOT_11B_END }),
  Object.freeze({ cutId: 13, id: 'shot_11c_grate_smash',      act: 4, stageMode: 'shaft_river',    tStart: SHOT_11B_END, tEnd: SHOT_11C_END }),
  Object.freeze({ cutId: 14, id: 'shot_12_shore_vista',       act: 5, stageMode: 'exterior_shore', tStart: SHOT_11C_END, tEnd: ACT5_END     })
]);

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

  SHOT_01_END,
  SHOT_02_END,
  SHOT_03_END,
  SHOT_04_END,
  SHOT_05_END,
  SHOT_06_END,
  SHOT_07_END,
  SHOT_08_END,
  SHOT_09_END,
  SHOT_10_END,
  SHOT_11A_END,
  SHOT_11B_END,
  SHOT_11C_END,
  SHOT_12A_END,

  CLASH_1_TIME,
  LUNGE_END_TIME,
  CLASH_2_TIME,
  SHIELD_DISARM_TIME,
  SWORD_DISARM_TIME,
  SWORD_LAND_TIME,
  KNOCKDOWN_CLIP_START,
  KNOCKDOWN_CUE_TIME,
  KNOCKDOWN_LAND_TIME,

  BOSS_TAUNT_CLIP_START,
  BOSS_SMASH_CLIP_START,

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
  CHASM_OPEN_END_TIME,
  CHASM_FALL_START_TIME,
  FLOOR_HOLE_MAX_RADIUS,
  BOSS_SMASH_STANDOFF_Z,

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
  FINAL_CAM_YAW,
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
// Pure Zero-Allocation Math & Per-Shot C1 Hermite Camera Helpers
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
      out[i] = Object.freeze({ vx: 0, vy: 0, vz: 0, lvx: 0, lvy: 0, lvz: 0, vfov: 0, vroll: 0 });
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
      vfov: calcTangent(prev.fov, k.fov, next.fov, dtPrev, dtNext, k.dp, true),
      vroll: calcTangent(prev.roll || 0, k.roll || 0, next.roll || 0, dtPrev, dtNext, k.dp, false)
    });
  }
  return Object.freeze(out);
}

const _camSample = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov: 46.0, roll: 0.0 };

function sampleShotCamera(t, shot) {
  const knots = shot.knots;
  const tangents = shot.tangents;
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
    _camSample.roll = k.roll || 0;
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
    _camSample.roll = last.roll || 0;
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

  // Smooth C1 motion inside 2-knot shots via ease-in-out cubic when endpoint tangents are 0,
  // or full Hermite spline for multi-knot shots (dolly/orbit/push-in/FOV/dutch-tilt).
  if (n === 2) {
    const ease = shot.ease === 'linear'
      ? s
      : shot.ease === 'easeOut'
        ? easeOutCubic(s)
        : smoothstep(s);
    _camSample.px = lerp(k0.px, k1.px, ease);
    _camSample.py = lerp(k0.py, k1.py, ease);
    _camSample.pz = lerp(k0.pz, k1.pz, ease);
    _camSample.lx = lerp(k0.lx, k1.lx, ease);
    _camSample.ly = lerp(k0.ly, k1.ly, ease);
    _camSample.lz = lerp(k0.lz, k1.lz, ease);
    _camSample.fov = lerp(k0.fov, k1.fov, ease);
    _camSample.roll = lerp(k0.roll || 0, k1.roll || 0, ease);
    return _camSample;
  }

  _camSample.px = hermite1D(k0.px, k1.px, m0.vx, m1.vx, dt, s);
  _camSample.py = hermite1D(k0.py, k1.py, m0.vy, m1.vy, dt, s);
  _camSample.pz = hermite1D(k0.pz, k1.pz, m0.vz, m1.vz, dt, s);
  _camSample.lx = hermite1D(k0.lx, k1.lx, m0.lvx, m1.lvx, dt, s);
  _camSample.ly = hermite1D(k0.ly, k1.ly, m0.lvy, m1.lvy, dt, s);
  _camSample.lz = hermite1D(k0.lz, k1.lz, m0.lvz, m1.lvz, dt, s);
  _camSample.fov = hermite1D(k0.fov, k1.fov, m0.vfov, m1.vfov, dt, s);
  _camSample.roll = hermite1D(k0.roll || 0, k1.roll || 0, m0.vroll, m1.vroll, dt, s);
  return _camSample;
}

function makeShot(cutId, id, act, stageMode, ease, rawKnots) {
  const knots = Object.freeze(rawKnots.map((k) => Object.freeze({
    t: k.t,
    px: k.px,
    py: k.py,
    pz: k.pz,
    lx: k.lx,
    ly: k.ly,
    lz: k.lz,
    fov: k.fov,
    roll: k.roll || 0,
    dp: k.dp !== undefined ? k.dp : 0.75,
    dl: k.dl !== undefined ? k.dl : 0.60
  })));
  return Object.freeze({
    cutId,
    id,
    act,
    stageMode,
    ease: ease || 'smooth',
    tStart: knots[0].t,
    tEnd: knots[knots.length - 1].t,
    knots,
    tangents: computeCamTangents(knots)
  });
}

function findActiveShot(t, shots) {
  const n = shots.length;
  for (let i = 0; i < n; i++) {
    const sh = shots[i];
    if (t < sh.tEnd || i === n - 1) return sh;
  }
  return shots[n - 1];
}

// ============================================================================
// Parametric Escape Rig Factory (14 Hard-Cut Cinematic Shots Across 3 Stages)
// ============================================================================

/**
 * Builds a complete, frozen spatial rig + 14 hard-cut cinematic camera shots
 * (`castle`, `shaft_river`, `exterior_shore`) parametrically anchored to `(anchorX, anchorZ)`.
 *
 * Clamps `(anchorX, anchorZ)` inside the flat open carpet nave of `boss_hall` so neither
 * the camera, actors, dropped Oathblade, nor 4.5 m floor chasm can ever clip the outer
 * colonnade pillars (`R = 12.8 m`), Boss Doors (`z = -32.0`), or Obsidian Throne (`z = -57.6`).
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
  const ax = disableClamp ? round3(rawX) : clamp(round3(rawX), centerX - 3.2, centerX + 3.2);
  const az = disableClamp ? round3(rawZ) : clamp(round3(rawZ), centerZ - 1.8, centerZ + 1.0);

  // CRITICAL CHASM GEOMETRY:
  //   - Floor Chasm Center: `(ax, az + 6.85)`, radius = 2.25 m -> north rim at `az + 4.60`.
  //   - Boss smash stance: `bossZ = holeZ - 2.85 = az + 4.00` (0.60 m BEHIND solid north rim — NEVER floating!).
  //   - Hero sits directly at `(holeX, holeZ)` before slow-mo, rolls left to `(holeX - 1.25, holeZ + 0.15)`
  //     (dist = 1.26 m < 2.25 m -> falls cleanly through the shattering slab at 19.85 s!).
  //   - Dropped Oathblade slides cleanly right (+X) to `(ax + 2.35, 0.048, az + 5.15)` (`heroZ_act2 - 1.2`).
  const floorHoleX = round3(ax);
  const floorHoleZ = round3(az + 6.85);
  const bossSmashZ = round3(floorHoleZ - BOSS_SMASH_STANDOFF_Z);
  const droppedSwordRestX = round3(ax + 2.35);
  const droppedSwordRestZ = round3(az + 5.15);

  // Exterior Shore Wake Anchor (defaults 1:1 to `EXTERIOR_SHORE_ANCHORS.wakePos = (0, 0, 2.5)`)
  const shoreWakeX = round3(readVec3X(opts?.shoreWakePos, SHORE_WAKE_X));
  const shoreWakeY = round3(readVec3Y(opts?.shoreWakePos, SHORE_WAKE_Y));
  const shoreWakeZ = round3(readVec3Z(opts?.shoreWakePos, SHORE_WAKE_Z));

  const normalFovRaw = Number(opts?.normalFov);
  const normalFov = Number.isFinite(normalFovRaw) && normalFovRaw > 15 && normalFovRaw < 110
    ? normalFovRaw
    : DEFAULT_NORMAL_FOV;

  // Canonical open-shore gameplay chase position behind Hero facing strictly North (-Z) toward Castle of Ash
  // (shore is wide open southward to z = +36 m — 0% cliff/rock clipping!).
  const defaultNormalCamPos = Object.freeze({
    x: round3(readVec3X(opts?.normalCamPos, shoreWakeX)),
    y: round3(readVec3Y(opts?.normalCamPos, shoreWakeY + 3.15)),
    z: round3(readVec3Z(opts?.normalCamPos, shoreWakeZ + 5.70)) // 2.5 + 5.7 = 8.20 exact!
  });
  const defaultNormalCamLook = Object.freeze({
    x: round3(readVec3X(opts?.normalCamLook, shoreWakeX)),
    y: round3(readVec3Y(opts?.normalCamLook, shoreWakeY + 1.65)),
    z: round3(readVec3Z(opts?.normalCamLook, shoreWakeZ))
  });

  // ==========================================================================
  // 14 HARD-CUT CINEMATIC SHOTS (Acts 1–5, t ∈ [0.00 .. 34.00 s])
  // Every shot has its own isolated C1 spline — ZERO spline bleed across cuts,
  // ZERO hammer lens occlusion, ZERO floor plane crossing, ZERO cliff clipping!
  // ==========================================================================
  const shots = Object.freeze([
    // ------------------------------------------------------------------------
    // ACT 1 (0.00 – 4.95 s): REAL DUEL — 3 Dynamic Hard-Cut Action Shots
    // ------------------------------------------------------------------------

    // SHOT 1 (0.00 – 1.05 s, cutId = 1, FOV 46° -> 42°):
    // Low 3/4 side tracking dolly pushing in with Hero's lunge -> violent hammer shaft parry @ 0.85s!
    makeShot(1, 'shot_01_parry_clash', 1, 'castle', 'easeOut', [
      { t: 0.00, px: ax - 3.65, py: 1.34, pz: az + 3.45, lx: ax + 0.00, ly: 1.38, lz: az + 0.70, fov: 46.0, roll: 0.000, dp: 0.0, dl: 0.0 },
      { t: 0.85, px: ax - 3.05, py: 1.18, pz: az + 1.65, lx: ax + 0.00, ly: 1.48, lz: az - 0.15, fov: 42.5, roll: 0.028, dp: 0.7, dl: 0.6 },
      { t: 1.05, px: ax - 2.95, py: 1.20, pz: az + 1.50, lx: ax + 0.00, ly: 1.46, lz: az - 0.08, fov: 42.0, roll: 0.015, dp: 0.0, dl: 0.0 }
    ]),

    // SHOT 2 (1.05 – 2.85 s, cutId = 2, HARD CUT, FOV 40° -> 42°):
    // Elevated opposite-front-side counter-angle (far clear of Boss's warhammer head — ZERO occlusion!).
    // Boss smashes Hero's shield @ 1.75s -> diagonal whip disarms Oathblade @ 2.55s flying cleanly +X!
    makeShot(2, 'shot_02_shield_disarm', 1, 'castle', 'smooth', [
      { t: 1.05, px: ax + 4.35, py: 1.72, pz: az + 2.75, lx: ax + 0.00, ly: 1.42, lz: az + 0.35, fov: 40.0, roll: -0.018, dp: 0.0,  dl: 0.0 },
      { t: 1.75, px: ax + 4.50, py: 1.66, pz: az + 3.30, lx: ax + 0.05, ly: 1.44, lz: az + 0.55, fov: 39.5, roll:  0.014, dp: 0.75, dl: 0.6 },
      { t: 2.55, px: ax + 4.65, py: 1.58, pz: az + 3.95, lx: ax + 0.35, ly: 1.34, lz: az + 1.15, fov: 41.2, roll:  0.026, dp: 0.75, dl: 0.6 },
      { t: 2.85, px: ax + 4.75, py: 1.54, pz: az + 4.30, lx: ax + 0.58, ly: 1.24, lz: az + 1.65, fov: 42.0, roll:  0.018, dp: 0.0,  dl: 0.0 }
    ]),

    // SHOT 3 (2.85 – 4.95 s, cutId = 3, HARD CUT, FOV 46° -> 45°):
    // Wide lateral impact shot framing BOTH towering Boss & Hero's full 3.4 m airborne knockdown arc
    // (shove @ 3.35s, hard buttocks impact @ 4.15s) plus the disarmed Oathblade bouncing onto the carpet!
    makeShot(3, 'shot_03_knockdown_wide', 1, 'castle', 'smooth', [
      { t: 2.85, px: ax + 5.65, py: 1.54, pz: az + 3.95, lx: ax + 0.00, ly: 1.12, lz: az + 1.90, fov: 47.0, roll:  0.000, dp: 0.0,  dl: 0.0 },
      { t: 3.35, px: ax + 5.55, py: 1.44, pz: az + 4.45, lx: ax + 0.00, ly: 1.10, lz: az + 2.40, fov: 46.5, roll: -0.026, dp: 0.75, dl: 0.6 },
      { t: 4.15, px: ax + 5.35, py: 1.28, pz: az + 5.25, lx: ax + 0.00, ly: 1.02, lz: az + 3.45, fov: 45.5, roll: -0.018, dp: 0.75, dl: 0.6 },
      { t: 4.95, px: ax + 5.15, py: 1.22, pz: az + 5.75, lx: ax + 0.00, ly: 1.08, lz: az + 3.60, fov: 45.0, roll:  0.000, dp: 0.0,  dl: 0.0 }
    ]),

    // ------------------------------------------------------------------------
    // ACT 2 (4.95 – 17.85 s): CINEMA SHOT-REVERSE-SHOT — 4 Distinct Angles
    // (ZERO 10-second static back-of-helmet shots!)
    // ------------------------------------------------------------------------

    // SHOT 4 (4.95 – 8.55 s, cutId = 4, HARD CUT, FOV 42° -> 41°):
    // Low side 3/4 tracking dolly (`y = 0.95 m`): FULL seated body of scooting Hero clearly pushing
    // backward with heels & hands; gleaming Oathblade razor-sharp in lower foreground (safely above
    // cinema letterbox!); Boss striding heavily with warhammer on shoulder, chuckling (Cue 1: 5.40 – 8.487 s).
    makeShot(4, 'shot_04_scoot_dolly', 2, 'castle', 'smooth', [
      { t: 4.95, px: ax + 4.45, py: 0.95, pz: az + 7.65, lx: ax + 0.15, ly: 0.94, lz: az + 3.65, fov: 43.0, roll: 0.000, dp: 0.0, dl: 0.0 },
      { t: 6.75, px: ax + 4.25, py: 0.95, pz: az + 8.05, lx: ax + 0.12, ly: 1.00, lz: az + 4.05, fov: 42.5, roll: 0.000, dp: 0.8, dl: 0.6 },
      { t: 8.55, px: ax + 4.05, py: 0.95, pz: az + 8.45, lx: ax + 0.10, ly: 1.08, lz: az + 4.35, fov: 42.0, roll: 0.000, dp: 0.0, dl: 0.0 }
    ]),

    // SHOT 5 (8.55 – 11.55 s, cutId = 5, HARD CUT, FOV 34° -> 32.5°):
    // Heroic worm's-eye close-up looking steeply UP at the Judge of Ruins — looms like a 5-meter
    // colossus against chandelier & stained glass, laughing & gesturing with free left hand (Cue 2: 8.75 – 11.398 s).
    // Positioned cleanly in front of Hero (`z < heroZ`) so Hero's helmet NEVER enters frame!
    makeShot(5, 'shot_05_boss_wormseye', 2, 'castle', 'smooth', [
      { t: 8.55,  px: ax + 1.12, py: 0.72, pz: az + 5.05, lx: ax - 0.05, ly: 2.30, lz: az + 1.75, fov: 34.0, roll: 0.018, dp: 0.0, dl: 0.0 },
      { t: 11.55, px: ax + 0.78, py: 0.78, pz: az + 4.88, lx: ax + 0.00, ly: 2.44, lz: az + 2.40, fov: 32.5, roll: 0.032, dp: 0.0, dl: 0.0 }
    ]),

    // SHOT 6 (11.55 – 14.30 s, cutId = 6, HARD CUT, FOV 36° -> 34.5°):
    // Tight reverse low-front close-up on Hero's horned helmet/face as he scoots in dread, glancing
    // desperately toward the unreachable Oathblade (11.85 – 13.35 s) and back to Boss (Cue 3 starts 11.65 s).
    // Placed strictly ahead of Boss (`z > bossZ + 1.5 m`) looking +Z toward Hero — zero Boss mesh clip!
    makeShot(6, 'shot_06_hero_reverse', 2, 'castle', 'smooth', [
      { t: 11.55, px: ax + 1.18, py: 0.72, pz: az + 4.35, lx: ax + 0.04, ly: 0.86, lz: az + 6.25, fov: 36.0, roll: -0.022, dp: 0.0, dl: 0.0 },
      { t: 14.30, px: ax + 0.96, py: 0.68, pz: az + 4.88, lx: ax + 0.02, ly: 0.82, lz: az + 6.68, fov: 34.5, roll: -0.040, dp: 0.0, dl: 0.0 }
    ]),

    // SHOT 7 (14.30 – 17.85 s, cutId = 7, HARD CUT, FOV 42° -> 33°, Dutch Tilt -> -0.08 rad):
    // Dramatic push-in on Boss as both hands slam onto warhammer (14.60 s), head erupts in flames
    // (`bossEnragedFire: true`), Cue 4 ("...они спускаются вниз.") plays, and `Escape_Floor_Smash`
    // lifts the blazing warhammer sky-high toward the cathedral chandelier!
    makeShot(7, 'shot_07_boss_enrage_dutch', 2, 'castle', 'smooth', [
      { t: 14.30, px: ax - 1.92, py: 1.06, pz: az + 7.60, lx: ax + 0.00, ly: 2.08, lz: az + 3.40, fov: 42.0, roll: -0.020, dp: 0.0, dl: 0.0 },
      { t: 15.80, px: ax - 1.65, py: 1.10, pz: az + 7.05, lx: ax + 0.00, ly: 2.26, lz: az + 3.68, fov: 38.0, roll: -0.055, dp: 0.7, dl: 0.6 },
      { t: 17.85, px: ax - 1.38, py: 1.18, pz: az + 6.35, lx: ax + 0.00, ly: 2.72, lz: az + 3.85, fov: 33.0, roll: -0.080, dp: 0.0, dl: 0.0 }
    ]),

    // ------------------------------------------------------------------------
    // ACT 3 (17.85 – 22.85 s): SLOW-MO DODGE, SOLID-FLOOR SMASH & ABYSS VIEW
    // ------------------------------------------------------------------------

    // SHOT 8 (17.85 – 19.35 s, cutId = 8, HARD CUT, FOV 48° -> 36°, Slow-Mo 0.24x @ 18.30–19.05 s):
    // Ultra-low carpet-level angle: flaming warhammer streaks down from top of frame -> Hero rolls
    // desperately left to `(holeX - 1.25, holeZ + 0.15)` -> SMASH dead-center at `(holeX, holeZ)` @ 19.15 s!
    makeShot(8, 'shot_08_slowmo_dodge_smash', 3, 'castle', 'smooth', [
      { t: 17.85, px: floorHoleX + 2.38, py: 0.62, pz: floorHoleZ + 3.25, lx: floorHoleX - 0.12, ly: 1.68, lz: floorHoleZ - 0.90, fov: 48.0, roll:  0.035, dp: 0.0, dl: 0.0 },
      { t: 18.55, px: floorHoleX + 2.10, py: 0.68, pz: floorHoleZ + 3.10, lx: floorHoleX - 0.35, ly: 1.15, lz: floorHoleZ - 0.20, fov: 40.5, roll:  0.015, dp: 0.7, dl: 0.6 },
      { t: 19.15, px: floorHoleX + 1.88, py: 0.78, pz: floorHoleZ + 2.95, lx: floorHoleX - 0.42, ly: 0.70, lz: floorHoleZ + 0.02, fov: 36.0, roll: -0.050, dp: 0.6, dl: 0.5 },
      { t: 19.35, px: floorHoleX + 1.85, py: 0.82, pz: floorHoleZ + 2.95, lx: floorHoleX - 0.45, ly: 0.65, lz: floorHoleZ + 0.05, fov: 36.5, roll: -0.035, dp: 0.0, dl: 0.0 }
    ]),

    // SHOT 9 (19.35 – 21.35 s, cutId = 9, HARD CUT, FOV 54° -> 55°):
    // Dramatic high 3/4 overhead reveal (`y = 3.90 -> 3.55 m`, strictly ABOVE floor — NEVER crosses y = 0!,
    // stays safely inside Boss Hall pillar clearance R < 11.6 m!).
    // Comfortably frames Boss standing 100% solidly behind north rim + jagged 4.5 m chasm + falling Hero & sword!
    makeShot(9, 'shot_09_chasm_collapse', 3, 'castle', 'smooth', [
      { t: 19.35, px: floorHoleX + 3.30, py: 3.90, pz: floorHoleZ + 4.18, lx: floorHoleX - 0.10, ly: 0.74,  lz: floorHoleZ - 0.72, fov: 54.0, roll: 0.000, dp: 0.0, dl: 0.0 },
      { t: 20.15, px: floorHoleX + 3.05, py: 3.76, pz: floorHoleZ + 3.92, lx: floorHoleX - 0.12, ly: 0.25,  lz: floorHoleZ - 0.42, fov: 54.5, roll: 0.000, dp: 0.8, dl: 0.6 },
      { t: 21.35, px: floorHoleX + 2.65, py: 3.55, pz: floorHoleZ + 3.55, lx: floorHoleX - 0.10, ly: -1.10, lz: floorHoleZ - 0.05, fov: 55.0, roll: 0.000, dp: 0.0, dl: 0.0 }
    ]),

    // SHOT 10 (21.35 – 22.85 s, cutId = 10, HARD CUT, FOV 58° -> 60°):
    // ICONIC ABYSS UPWARD SHOT STRICTLY INSIDE THE CHASM SHAFT (`y = -9.5 -> -15.5 m`, `r_horiz <= 0.60 m < 2.25 m`,
    // ZERO floor clipping!). Rocky shaft walls surround camera; tumbling Hero & Oathblade silhouetted overhead;
    // blazing circular breach frames the towering Judge of Ruins + glowing lantern peering straight down!
    makeShot(10, 'shot_10_abyss_upward', 3, 'castle', 'linear', [
      { t: 21.35, px: floorHoleX + 0.20, py: -9.50,  pz: floorHoleZ + 0.42, lx: floorHoleX, ly: 1.80, lz: floorHoleZ - 2.30, fov: 58.0, roll: 0.000, dp: 0.0, dl: 0.0 },
      { t: 22.85, px: floorHoleX + 0.20, py: -15.50, pz: floorHoleZ + 0.56, lx: floorHoleX, ly: 1.80, lz: floorHoleZ - 2.30, fov: 60.0, roll: 0.042, dp: 0.0, dl: 0.0 }
    ]),

    // ------------------------------------------------------------------------
    // ACT 4 (22.85 – 29.45 s): 360° SHAFT, UNDERWATER SPLASH & IRON GRATE SMASH
    // ------------------------------------------------------------------------

    // SHOT 11A (22.85 – 24.85 s, cutId = 11, HARD CUT, FOV 60° -> 58°):
    // Dynamic falling chase inside 360° gothic stone shaft (`y = 17.5 -> 1.5 m`, `r < 3.6 m < shaftR`).
    // Tracks Hero squarely inside the center of the shaft as beams, roots & water whip past toward black water!
    makeShot(11, 'shot_11a_shaft_plunge', 4, 'shaft_river', 'smooth', [
      { t: 22.85, px: 1.55, py: 17.20, pz: 2.35, lx: 0.00, ly: 20.40, lz: 0.00, fov: 60.0, roll:  0.038, dp: 0.0,  dl: 0.0 },
      { t: 23.85, px: 1.48, py: 8.40,  pz: 2.85, lx: 0.00, ly: 12.20, lz: 0.45, fov: 59.0, roll:  0.005, dp: 0.85, dl: 0.7 },
      { t: 24.85, px: 1.35, py: 1.50,  pz: 3.35, lx: 0.00, ly: 0.55,  lz: 1.35, fov: 58.0, roll: -0.028, dp: 0.0,  dl: 0.0 }
    ]),

    // SHOT 11B (24.85 – 26.45 s, cutId = 12, HARD CUT, FOV 54° -> 56°):
    // Splash impact @ 24.85s (`waterSplashCue: 1`) -> camera dives UNDERWATER (`camY = -0.62 m`) STRICTLY BEHIND
    // tumbling Hero (`camZ < heroZ - 2.0 m`) amid swirling bubbles (`underwater01: 0 -> 1 -> 0.20`), then resurfaces!
    makeShot(12, 'shot_11b_water_underwater', 4, 'shaft_river', 'smooth', [
      { t: 24.85, px:  1.15, py:  0.48, pz: -1.15, lx: 0.00, ly: -0.10, lz:  2.40, fov: 54.0, roll: -0.048, dp: 0.0,  dl: 0.0 },
      { t: 25.45, px:  0.85, py: -0.62, pz:  2.40, lx: 0.00, ly: -0.58, lz:  6.40, fov: 55.5, roll: -0.025, dp: 0.75, dl: 0.6 },
      { t: 26.05, px: -0.25, py: -0.18, pz:  5.85, lx: 0.00, ly:  0.05, lz: 11.20, fov: 56.0, roll:  0.018, dp: 0.75, dl: 0.6 },
      { t: 26.45, px: -0.75, py:  0.52, pz:  8.40, lx: 0.00, ly:  0.45, lz: 15.80, fov: 56.0, roll:  0.032, dp: 0.0,  dl: 0.0 }
    ]),

    // SHOT 11C (26.45 – 29.45 s, cutId = 13, HARD CUT, FOV 56° -> 64°):
    // Adrenaline river tunnel rush straight at the moonlit rusty iron grate (`z = 26 m`) ->
    // EXPLOSIVE GRATE SMASH @ 27.65s (`grateBreakCue: 1`, `grateBroken: true`) -> camera blasts cleanly
    // through the wide 3.8 m open breach (`|x| <= 0.65 m`) into cold moonlit waterfall mist!
    makeShot(13, 'shot_11c_grate_smash', 4, 'shaft_river', 'smooth', [
      { t: 26.45, px: 1.05, py: 1.52, pz: 13.80, lx: 0.00, ly: 0.92, lz: 25.80, fov: 56.0, roll: 0.000, dp: 0.0,  dl: 0.0 },
      { t: 27.65, px: 0.68, py: 1.72, pz: 20.80, lx: 0.00, ly: 1.00, lz: 27.60, fov: 60.5, roll: 0.028, dp: 0.85, dl: 0.6 },
      { t: 28.55, px: 0.45, py: 1.84, pz: 26.20, lx: 0.00, ly: 0.92, lz: 32.50, fov: 63.0, roll: 0.015, dp: 0.85, dl: 0.6 },
      { t: 29.45, px: 0.35, py: 1.88, pz: 29.60, lx: 0.00, ly: 0.85, lz: 35.80, fov: 64.0, roll: 0.000, dp: 0.0,  dl: 0.0 }
    ]),

    // ------------------------------------------------------------------------
    // ACT 5 (29.45 – 34.00 s): SHORE AWAKENING + MONUMENTAL CASTLE VISTA
    // (0% CLIFF CLIPPING! Open shore behind Hero to z = +36 m; finalCamYaw = 0!)
    // ------------------------------------------------------------------------

    // SHOT 12A (29.45 – 31.85 s) -> SHOT 12B (31.85 – 34.00 s), cutId = 14 (HARD CUT @ 29.45 s):
    //   - 29.45–31.85 s (12A): Low coastal angle at `(-1.60, 1.42, 8.75) -> (-1.15, 1.85, 8.55)` framing ALL FOUR
    //     story anchors simultaneously inside the 16:9 letterbox-safe frame: rising Hero `(0, 0.7, 2.5)`, gleaming
    //     planted Oathblade `(2.8, 0.4, 5.2)` in the right foreground third, roaring Waterfall Arch behind, AND
    //     towering Monumental Castle of Ash on the cliff!
    //   - 31.85–34.00 s (12B): Smooth epic crane-up & orbit behind Hero showcasing the full Moonlit Castle
    //     of Ash during Location Card (`30.40–33.60 s`), settling seamlessly at `34.00 s` into the exact
    //     unobstructed gameplay position `(0.0, 3.15, 8.20)` looking at `(0.0, 1.65, 2.50)` (`finalCamYaw = 0`)!
    makeShot(14, 'shot_12_shore_vista', 5, 'exterior_shore', 'smooth', [
      { t: 29.45, px: shoreWakeX - 1.60, py: shoreWakeY + 1.42, pz: shoreWakeZ + 6.25, lx: shoreWakeX + 0.95, ly: shoreWakeY + 1.38, lz: shoreWakeZ - 0.60, fov: 56.0, roll: 0.0, dp: 0.0,  dl: 0.0  },
      { t: 30.85, px: shoreWakeX - 1.42, py: shoreWakeY + 1.58, pz: shoreWakeZ + 6.15, lx: shoreWakeX + 0.55, ly: shoreWakeY + 3.50, lz: shoreWakeZ - 11.50, fov: 56.0, roll: 0.0, dp: 0.75, dl: 0.55 },
      { t: 31.85, px: shoreWakeX - 1.10, py: shoreWakeY + 1.92, pz: shoreWakeZ + 6.00, lx: shoreWakeX + 0.12, ly: shoreWakeY + 6.60, lz: shoreWakeZ - 23.50, fov: 55.5, roll: 0.0, dp: 0.75, dl: 0.55 },
      { t: 32.85, px: shoreWakeX - 0.45, py: shoreWakeY + 2.62, pz: shoreWakeZ + 5.85, lx: shoreWakeX + 0.00, ly: shoreWakeY + 4.10, lz: shoreWakeZ - 11.00, fov: 54.0, roll: 0.0, dp: 0.70, dl: 0.55 },
      { t: 34.00, px: defaultNormalCamPos.x, py: defaultNormalCamPos.y, pz: defaultNormalCamPos.z, lx: defaultNormalCamLook.x, ly: defaultNormalCamLook.y, lz: defaultNormalCamLook.z, fov: normalFov, roll: 0.0, dp: 0.0, dl: 0.0 }
    ])
  ]);

  // Flat legacy-compatible stage knot views (useful for external inspection tools)
  const castleCamKnots = Object.freeze(shots.filter((s) => s.stageMode === 'castle').flatMap((s) => s.knots));
  const shaftCamKnots = Object.freeze(shots.filter((s) => s.stageMode === 'shaft_river').flatMap((s) => s.knots));
  const shoreCamKnots = Object.freeze(shots.filter((s) => s.stageMode === 'exterior_shore').flatMap((s) => s.knots));

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
    bossSmashZ,
    droppedSwordRestX,
    droppedSwordRestZ,
    shoreWakeX,
    shoreWakeY,
    shoreWakeZ,
    finalCamYaw: FINAL_CAM_YAW,
    defaultNormalCamPos,
    defaultNormalCamLook,
    normalFov,
    dialogueCues,
    sampleMouthOpen,
    shots,
    castleCamKnots,
    shaftCamKnots,
    shoreCamKnots
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
    cameraCutId: 1,
    shotId: 'shot_01_parry_clash',
    letterbox01: 0,
    fadeToBlack01: 0,
    underwater01: 0,
    slowMoFactor: 1,
    canSkip: false,
    screenShake: 0,
    hitstopSec: 0,
    impactFlash01: 0,
    grateBroken: false,
    finalCamYaw: FINAL_CAM_YAW,
    camPos: { x: 0, y: 0, z: 0 },
    camLook: { x: 0, y: 0, z: 0 },
    camFov: 46,
    fov: 46,
    camRoll: 0,
    heroMode: 'final_clash',
    heroAnimName: 'Cutscene_FinalClash_Disarm',
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
  mode: 'final_clash',
  animName: 'Cutscene_FinalClash_Disarm',
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

  // --- ACT 1 PART A (0.00 – 3.35 s): `Cutscene_FinalClash_Disarm` (3.400 s) ---
  // Aggressive lunge + slash @ 0.85s -> recoil -> shield block @ 1.75s -> Oathblade disarm @ 2.55s -> shove @ 3.35s
  if (t < KNOCKDOWN_CLIP_START) {
    _heroEval.animName = 'Cutscene_FinalClash_Disarm';
    _heroEval.animU = clamp01(t / HERO_CLIP_CLASH_DUR);
    _heroEval.y = 0.0;

    if (t < CLASH_1_TIME) {
      // 0.00 – 0.85 s: Charging sprint + heavy diagonal lunge toward Boss
      const u = easeOutCubic(t / CLASH_1_TIME);
      _heroEval.mode = 'final_lunge';
      _heroEval.x = ax;
      _heroEval.z = lerp(az + 2.85, az + 0.65, u);
      _heroEval.facing = Math.PI;
    } else if (t < LUNGE_END_TIME) {
      // 0.85 – 1.05 s: Hard parry recoil onto heels
      const u = smoothstep((t - CLASH_1_TIME) / (LUNGE_END_TIME - CLASH_1_TIME));
      _heroEval.mode = 'parry_recoil';
      _heroEval.x = ax + lerp(0.0, -0.08, u);
      _heroEval.z = lerp(az + 0.65, az + 1.05, u);
      _heroEval.facing = Math.PI + 0.10 * u;
    } else if (t < CLASH_2_TIME) {
      // 1.05 – 1.75 s: Plants boots & raises left shield into deep guard -> Boss hammers shield @ 1.75s
      const u = smoothstep((t - LUNGE_END_TIME) / (CLASH_2_TIME - LUNGE_END_TIME));
      _heroEval.mode = 'shield_guard';
      _heroEval.x = ax + lerp(-0.08, -0.04, u);
      _heroEval.z = lerp(az + 1.05, az + 1.18, u);
      _heroEval.facing = Math.PI + lerp(0.10, -0.06, u);
    } else if (t < SWORD_DISARM_TIME) {
      // 1.75 – 2.55 s: Driven back slightly by shield blow -> Boss whips right wrist to disarm Oathblade @ 2.55s
      const u = smoothstep((t - CLASH_2_TIME) / (SWORD_DISARM_TIME - CLASH_2_TIME));
      _heroEval.mode = 'clash_exchange';
      _heroEval.x = ax + lerp(-0.04, 0.00, u);
      _heroEval.z = lerp(az + 1.18, az + 1.50, u);
      _heroEval.facing = Math.PI + lerp(-0.06, 0.08, u);
    } else {
      // 2.55 – 3.35 s: Disarmed open-handed stagger right into the devastating Boss shove @ 3.35s
      const u = smoothstep((t - SWORD_DISARM_TIME) / (KNOCKDOWN_CLIP_START - SWORD_DISARM_TIME));
      _heroEval.mode = 'disarm_stagger';
      _heroEval.x = ax + lerp(0.00, -0.04, u);
      _heroEval.z = lerp(az + 1.50, az + 1.85, u);
      _heroEval.facing = Math.PI + lerp(0.08, 0.02, u);
    }
    return _heroEval;
  }

  // --- ACT 1 PART B (3.35 – 4.95 s): Knockdown Flight & Hard Buttocks Impact @ 4.15s ---
  // `Cutscene_Knockdown_Scoot` (12.600 s) starts cleanly @ 3.35s (0.80s impact = 4.15s exact!)
  if (t < ACT1_END) {
    _heroEval.mode = 'knockdown_sit';
    _heroEval.animName = 'Cutscene_Knockdown_Scoot';
    _heroEval.animU = clamp01((t - KNOCKDOWN_CLIP_START) / HERO_CLIP_SCOOT_DUR);
    if (t < KNOCKDOWN_LAND_TIME) {
      // 3.35 – 4.15 s: Dynamic ~3.10 m airborne knockback arc
      const u = (t - KNOCKDOWN_CLIP_START) / (KNOCKDOWN_LAND_TIME - KNOCKDOWN_CLIP_START);
      _heroEval.x = ax + lerp(-0.04, 0.02, u);
      _heroEval.y = Math.sin(u * Math.PI) * 0.42;
      _heroEval.z = lerp(az + 1.85, az + 4.88, easeOutCubic(u));
      _heroEval.facing = Math.PI + Math.sin(u * Math.PI) * 0.08;
    } else {
      // 4.15 – 4.95 s: Heavy armored buttocks slam, micro-bounce & skid settling at az + 5.25 (+3.40 m total knockback!)
      const u = clamp01((t - KNOCKDOWN_LAND_TIME) / (ACT1_END - KNOCKDOWN_LAND_TIME));
      const skid = easeOutCubic(clamp01(u / 0.72));
      const bounce = u < 0.25 ? Math.sin((u / 0.25) * Math.PI) * 0.06 : 0.0;
      _heroEval.x = ax + lerp(0.02, 0.00, skid);
      _heroEval.y = bounce;
      _heroEval.z = lerp(az + 4.88, az + 5.25, skid);
      _heroEval.facing = Math.PI;
    }
    return _heroEval;
  }

  // --- ACT 2 & EARLY ACT 3 (4.95 – 18.25 s): Rhythmic Backward Butt-Scoot -> Frozen Dread at `(holeX, holeZ)` ---
  if (t < DODGE_CLIP_START) {
    _heroEval.animName = 'Cutscene_Knockdown_Scoot';
    _heroEval.animU = clamp01((t - KNOCKDOWN_CLIP_START) / HERO_CLIP_SCOOT_DUR);

    if (t < SCOOT_END_TIME) {
      _heroEval.mode = 'scoot_back';
      const scootSpan = SCOOT_END_TIME - SCOOT_START_TIME;
      const rawU = clamp01((t - SCOOT_START_TIME) / scootSpan);
      // Discrete rhythmic heel-push lurches every 0.70 s synced 1:1 with `scootCue`!
      const numSteps = scootSpan / SCOOT_STEP_INTERVAL;
      const stepPos = rawU * numSteps;
      const stepIdx = Math.floor(stepPos);
      const stepFrac = stepPos - stepIdx;
      const steppedU = (stepIdx + smootherstep(stepFrac)) / numSteps;

      const lateralWiggle = Math.sin(stepPos * Math.PI) * 0.055 * (1.0 - smoothstep((t - 14.9) / 0.75));
      _heroEval.x = holeX + lateralWiggle;
      _heroEval.y = 0.0;
      _heroEval.z = lerp(az + 5.25, holeZ, steppedU);
      _heroEval.facing = Math.PI + Math.sin(stepPos * Math.PI) * 0.045;
    } else {
      // 15.65 – 18.25 s: Hero sits frozen in terror DEAD CENTER at `(holeX, holeZ)` directly under the blazing hammer!
      _heroEval.mode = 'cower_freeze';
      const dreadTremor = Math.sin((t - SCOOT_END_TIME) * 28.0) * 0.012 * smoothstep((t - 16.0) / 1.2);
      _heroEval.x = holeX + dreadTremor;
      _heroEval.y = 0.0;
      _heroEval.z = holeZ;
      _heroEval.facing = Math.PI;
    }
    return _heroEval;
  }

  // --- ACT 3 PART B (18.25 – 22.85 s): Slow-Mo Dodge Roll Left -> Shattering Slab -> Chasm Plunge ---
  // `Cutscene_Dodge_Fall` (6.500 s) piecewise exact:
  //   0.00–0.85s (18.25–19.15s): Explosive panic side-roll left to `(holeX - 1.25, holeZ + 0.15)`
  //   0.85–1.55s (19.15–19.85s): Slab cracks & buckles beneath Hero; reaches desperately for rim
  //   1.55–6.50s (19.85–24.85s): Expressive tumbling fall down chasm (Act 3) & vertical shaft (Act 4)
  if (t < FLOOR_SMASH_TIME) {
    const u = clamp01((t - DODGE_CLIP_START) / (FLOOR_SMASH_TIME - DODGE_CLIP_START));
    _heroEval.mode = 'dodge_side_roll';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = (u * 0.85) / HERO_CLIP_DODGE_DUR;
    const s = easeOutCubic(u);
    _heroEval.x = lerp(holeX, holeX - 1.25, s);
    _heroEval.y = Math.sin(u * Math.PI) * 0.16;
    _heroEval.z = lerp(holeZ, holeZ + 0.15, s);
    _heroEval.facing = Math.PI + 0.42 * s;
    return _heroEval;
  }

  if (t < CHASM_FALL_START_TIME) {
    // 19.15 – 19.85 s: Rim fractures & collapses directly underneath Hero (`x = holeX - 1.25`, inside 2.25 m hole!)
    const u = clamp01((t - FLOOR_SMASH_TIME) / (CHASM_FALL_START_TIME - FLOOR_SMASH_TIME));
    _heroEval.mode = 'dodge_side_roll';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = (0.85 + u * 0.70) / HERO_CLIP_DODGE_DUR;
    const slip = easeInQuad(u);
    _heroEval.x = lerp(holeX - 1.25, holeX - 0.92, slip);
    _heroEval.y = lerp(0.0, -0.22, slip);
    _heroEval.z = lerp(holeZ + 0.15, holeZ + 0.10, slip);
    _heroEval.facing = Math.PI + lerp(0.42, 0.20, u);
    return _heroEval;
  }

  if (t < ACT3_END) {
    // 19.85 – 22.85 s: Continuous accelerated plunge down the chasm (`y: -0.22 -> -7.40 m @ 21.35s -> -13.40 m @ 22.85s`)
    // Keeps Hero strictly ~2.1 m ABOVE Shot 10's upward abyss camera (`camY: -9.5 -> -15.5 m`) so his
    // flailing silhouette stays dead-center against the blazing chasm opening & towering Boss overhead!
    const u = clamp01((t - CHASM_FALL_START_TIME) / (ACT3_END - CHASM_FALL_START_TIME));
    _heroEval.mode = 'fall_chasm';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = lerp(1.55 / HERO_CLIP_DODGE_DUR, 0.72, u);
    _heroEval.x = lerp(holeX - 0.92, holeX - 0.08, smoothstep(u)) + Math.sin(u * 8.5) * 0.12;
    if (t < SHOT_09_END) {
      const f1 = clamp01((t - CHASM_FALL_START_TIME) / (SHOT_09_END - CHASM_FALL_START_TIME));
      _heroEval.y = lerp(-0.22, -7.40, 0.25 * f1 + 0.75 * f1 * f1);
    } else {
      const f2 = clamp01((t - SHOT_09_END) / (ACT3_END - SHOT_09_END));
      _heroEval.y = lerp(-7.40, -13.40, f2);
    }
    _heroEval.z = lerp(holeZ + 0.10, holeZ - 0.05, smoothstep(u));
    _heroEval.facing = Math.PI + Math.sin(u * 5.2) * 0.36;
    return _heroEval;
  }

  // --- ACT 4 PART A (22.85 – 24.85 s): Vertical 360° Stone Shaft Fall ---
  if (t < WATER_SPLASH_TIME) {
    const u = clamp01((t - ACT4_START) / (WATER_SPLASH_TIME - ACT4_START));
    _heroEval.mode = 'fall_chasm';
    _heroEval.animName = 'Cutscene_Dodge_Fall';
    _heroEval.animU = lerp(0.72, 1.0, u);
    _heroEval.x = 0.22 * (1.0 - u) + Math.sin(u * 7.6) * 0.20;
    _heroEval.y = lerp(SHAFT_ENTRY_HERO_Y, RIVER_WATER_Y + 0.20, 0.38 * u + 0.62 * u * u);
    _heroEval.z = lerp(0.0, 1.15, smoothstep(u));
    _heroEval.facing = Math.PI + Math.sin(u * 6.2) * 0.42;
    return _heroEval;
  }

  // --- ACT 4 PART B (24.85 – 29.45 s): `Cutscene_River_Tumble` (4.600 s exact!) ---
  // Water plunge (24.85s) -> underwater 360° tumble -> resurface -> explosive grate smash (27.65s @ z=26m) -> exit (z=34m)
  if (t < ACT4_END) {
    const dt = t - WATER_SPLASH_TIME;
    const span = ACT4_END - WATER_SPLASH_TIME;
    const u = clamp01(dt / span);
    _heroEval.mode = 'river_tumble';
    _heroEval.animName = 'Cutscene_River_Tumble';
    _heroEval.animU = clamp01(dt / HERO_CLIP_RIVER_DUR);

    let zPos;
    let yPos;
    if (t < GRATE_BREAK_TIME) {
      const rU = clamp01((t - WATER_SPLASH_TIME) / (GRATE_BREAK_TIME - WATER_SPLASH_TIME));
      if (rU < 0.26) {
        yPos = lerp(0.20, -1.35, easeOutCubic(rU / 0.26));
      } else if (rU < 0.72) {
        yPos = lerp(-1.35, 0.16, smoothstep((rU - 0.26) / 0.46));
      } else {
        yPos = 0.16 + Math.sin((rU - 0.72) * Math.PI * 3.0) * 0.15;
      }
      zPos = lerp(1.15, RIVER_GRATE_Z, 0.72 * rU + 0.28 * rU * rU);
    } else {
      const eU = clamp01((t - GRATE_BREAK_TIME) / (ACT4_END - GRATE_BREAK_TIME));
      yPos = 0.18 - 0.34 * eU + Math.sin(eU * Math.PI) * 0.26;
      zPos = lerp(RIVER_GRATE_Z, RIVER_EXIT_Z, easeOutCubic(eU));
    }

    _heroEval.x = Math.sin(dt * 3.0) * 0.56 * (1.0 - 0.58 * u);
    _heroEval.y = yPos;
    _heroEval.z = zPos;
    _heroEval.facing = Math.sin(dt * 2.5) * 0.28;
    return _heroEval;
  }

  // --- ACT 5 (29.45 – 34.00 s): `Cutscene_Shore_WakeUp` (4.550 s exact -> Idle[0]!) ---
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
    _bossEval.z = rig.bossSmashZ;
    _bossEval.facing = 0;
    _bossEval.animName = 'Escape_Floor_Smash';
    _bossEval.animU = 1.0;
    _bossEval.enragedFire = false;
    _bossEval.chuckle01 = 0.0;
    return _bossEval;
  }

  const ax = rig.anchorX;
  const az = rig.anchorZ;
  const bossSmashZ = rig.bossSmashZ; // Exact `floorHoleZ - 2.85` -> 100% solid floor behind 2.25 m chasm rim!

  _bossEval.visible = true;
  _bossEval.y = 0.0;
  _bossEval.facing = 0.0; // Facing South (+Z) toward Hero

  // Boss Clip 1: `Escape_Parry_Disarm` (0.00 – 5.20 s)
  if (t < BOSS_TAUNT_CLIP_START) {
    _bossEval.animName = 'Escape_Parry_Disarm';
    _bossEval.animU = clamp01(t / BOSS_CLIP_PARRY_DUR);
    _bossEval.enragedFire = false;
    _bossEval.chuckle01 = 0.0;

    if (t < CLASH_1_TIME) {
      const u = smoothstep(t / CLASH_1_TIME);
      _bossEval.x = ax;
      _bossEval.z = lerp(az - 1.35, az - 1.15, u);
    } else if (t < CLASH_2_TIME) {
      const u = smoothstep((t - CLASH_1_TIME) / (CLASH_2_TIME - CLASH_1_TIME));
      _bossEval.x = ax + Math.sin(u * Math.PI) * 0.12;
      _bossEval.z = lerp(az - 1.15, az - 0.70, u);
    } else if (t < SWORD_DISARM_TIME) {
      const u = smoothstep((t - CLASH_2_TIME) / (SWORD_DISARM_TIME - CLASH_2_TIME));
      _bossEval.x = ax - Math.sin(u * Math.PI) * 0.12;
      _bossEval.z = lerp(az - 0.70, az - 0.35, u);
    } else if (t < KNOCKDOWN_CUE_TIME + 0.25) {
      const u = smoothstep((t - SWORD_DISARM_TIME) / (KNOCKDOWN_CUE_TIME + 0.25 - SWORD_DISARM_TIME));
      _bossEval.x = ax;
      _bossEval.z = lerp(az - 0.35, az + 0.35, u);
    } else {
      const u = smoothstep((t - (KNOCKDOWN_CUE_TIME + 0.25)) / (BOSS_TAUNT_CLIP_START - (KNOCKDOWN_CUE_TIME + 0.25)));
      _bossEval.x = ax;
      _bossEval.z = lerp(az + 0.35, az + 0.65, u);
    }
    return _bossEval;
  }

  // Boss Clip 2: `Escape_Taunt_Walk` (5.20 – 15.80 s) — heavy predatory giant strides with hammer on shoulder
  if (t < BOSS_SMASH_CLIP_START) {
    _bossEval.animName = 'Escape_Taunt_Walk';
    _bossEval.animU = clamp01((t - BOSS_TAUNT_CLIP_START) / BOSS_CLIP_TAUNT_DUR);

    const zStart = az + 0.65;
    const zPreSmash = bossSmashZ - 0.30; // az + 3.70 -> steps cleanly +0.30 m into `bossSmashZ` during windup/strike!
    let zPos;
    if (t < 8.55) {
      zPos = lerp(zStart, lerp(zStart, zPreSmash, 0.33), smoothstep((t - BOSS_TAUNT_CLIP_START) / (8.55 - BOSS_TAUNT_CLIP_START)));
    } else if (t < 11.55) {
      zPos = lerp(lerp(zStart, zPreSmash, 0.33), lerp(zStart, zPreSmash, 0.59), smoothstep((t - 8.55) / (11.55 - 8.55)));
    } else if (t < 14.60) {
      zPos = lerp(lerp(zStart, zPreSmash, 0.59), lerp(zStart, zPreSmash, 0.93), smoothstep((t - 11.55) / (14.60 - 11.55)));
    } else {
      // Plants boots firmly as both hands grip the warhammer (`9.40–10.60 s` of clip -> flames ignite!)
      zPos = lerp(lerp(zStart, zPreSmash, 0.93), zPreSmash, smoothstep((t - 14.60) / (BOSS_SMASH_CLIP_START - 14.60)));
    }
    const walkSway = t < 14.60 ? Math.sin((t - BOSS_TAUNT_CLIP_START) * 2.15) * 0.085 : 0.0;
    _bossEval.x = ax + walkSway;
    _bossEval.z = zPos;

    // Chuckle shoulder shake synced 1:1 with VO 1 laugh (5.40–6.75 s) + mocking beat in VO 2 (9.00–9.85 s)
    const chuckle1 = pulseBell(t, VO1_START, VO1_START + 1.35) * (0.72 + 0.28 * Math.abs(Math.sin((t - VO1_START) * 18.0)));
    const chuckle2 = pulseBell(t, VO2_START + 0.25, VO2_START + 1.10) * 0.42;
    _bossEval.chuckle01 = clamp01(Math.max(chuckle1, chuckle2));
    _bossEval.enragedFire = t >= BOSS_ENRAGED_FIRE_START;
    return _bossEval;
  }

  // Boss Clip 3: `Escape_Floor_Smash` (15.80 – 22.85 s)
  // Exact 3.35s impact -> `15.80 + 3.35 = 19.15 s`! Stops strictly at `bossSmashZ = floorHoleZ - 2.85` (100% solid stone!)
  _bossEval.animName = 'Escape_Floor_Smash';
  _bossEval.animU = clamp01((t - BOSS_SMASH_CLIP_START) / BOSS_CLIP_SMASH_DUR);
  const stepIntoSmash = smoothstep(clamp01((t - 18.75) / 0.40));
  _bossEval.x = ax;
  _bossEval.z = lerp(bossSmashZ - 0.30, bossSmashZ, stepIntoSmash);
  _bossEval.chuckle01 = 0.0;
  _bossEval.enragedFire = t >= BOSS_ENRAGED_FIRE_START && t < BOSS_ENRAGED_FIRE_END;
  return _bossEval;
}

/**
 * Clean ballistic trajectory of the disarmed Oathblade (`droppedSword`), mutating `target` in-place:
 *   - `t < 2.55 s`: hidden (held in Hero's right hand)
 *   - `2.55 – 3.15 s`: clean outward-right (`+X`) parabolic arc starting strictly from Hero's RIGHT WRIST
 *     `(ax + 0.68, 1.26, az + 1.45)` — NEVER passes near/through Hero's helmet or torso!
 *   - `3.15 – 3.55 s`: metallic bounce off crimson carpet
 *   - `3.55 – 4.45 s`: damped slide to visible foreground rest `(ax + 2.35, 0.048, az + 5.15)` (`heroZ_act2 - 1.2`)
 *   - `4.45 – 19.45 s`: gleams prominently on foreground carpet during Act 2 & early Act 3
 *   - `19.45 – 22.85 s`: knocked inward off the collapsing rim slab & plunges spinning down the chasm behind Hero
 *   - `22.85 – 28.85 s`: tumbles alongside Hero in the vertical shaft & underground river
 *   - `t >= 29.45 s`: hidden (`soulsExteriorShore.js` renders the interactive Oathblade planted in shore gravel!)
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
  const restX = rig.droppedSwordRestX; // ax + 2.35
  const restZ = rig.droppedSwordRestZ; // az + 5.15

  target.visible = true;

  // Phase A: Clean outward-right (+X) ballistic arc from Hero's right wrist (2.55 – 3.15 s, dt = 0.60 s)
  if (t < SWORD_LAND_TIME) {
    const dt = t - SWORD_DISARM_TIME;
    const u = dt / (SWORD_LAND_TIME - SWORD_DISARM_TIME);
    // Moves strictly OUTWARD in +X (`+0.68 -> +1.92`) so clearance to Hero (`x ~ 0`) stays >= 0.68 m at every frame!
    target.x = lerp(ax + 0.68, ax + 1.92, easeOutCubic(u * 0.85 + 0.15 * u));
    // Exact projectile: y(0) = 1.26 m, apex = 1.54 m @ dt = 0.185 s, lands cleanly on carpet @ dt = 0.60 s (y = 0.052 m)
    target.y = Math.max(0.052, 1.26 + 3.00 * dt - 0.5 * 16.70 * dt * dt);
    target.z = lerp(az + 1.45, az + 3.85, u);
    target.rx = 0.42 + dt * 17.2;
    target.ry = 0.30 + dt * 5.8;
    target.rz = 0.22 + dt * 11.8;
    return target;
  }

  // Phase B: First metallic clatter bounce on crimson carpet (3.15 – 3.55 s, dt = 0.40 s)
  if (t < 3.55) {
    const u = (t - SWORD_LAND_TIME) / (3.55 - SWORD_LAND_TIME);
    target.x = lerp(ax + 1.92, ax + 2.20, u);
    target.y = 0.052 + Math.sin(u * Math.PI) * 0.28;
    target.z = lerp(az + 3.85, az + 4.62, u);
    target.rx = lerp(Math.PI * 0.5 + 1.05, Math.PI * 0.5, easeOutCubic(u));
    target.ry = lerp(0.95, 0.64, u);
    target.rz = lerp(0.75, 0.05, easeOutCubic(u));
    return target;
  }

  // Phase C: Damped slide to foreground rest `(ax + 2.35, 0.048, az + 5.15)` (3.55 – 4.45 s)
  if (t < 4.45) {
    const u = (t - 3.55) / (4.45 - 3.55);
    const slide = 1.0 - Math.pow(1.0 - u, 2.4);
    target.x = lerp(ax + 2.20, restX, slide);
    target.y = 0.048;
    target.z = lerp(az + 4.62, restZ, slide);
    target.rx = Math.PI * 0.5;
    target.ry = lerp(0.64, 0.52, slide);
    target.rz = lerp(0.05, 0.02, slide);
    return target;
  }

  // Phase D: Resting gleamingly in foreground during Act 2 & slow-mo dodge (4.45 – 19.45 s)
  if (t < 19.45) {
    const rattle = t >= FLOOR_SMASH_TIME
      ? Math.sin((t - FLOOR_SMASH_TIME) * 62.0) * 0.036 * (1.0 - (t - FLOOR_SMASH_TIME) / 0.30)
      : 0.0;
    const hop = t >= FLOOR_SMASH_TIME
      ? Math.sin(((t - FLOOR_SMASH_TIME) / 0.30) * Math.PI) * 0.18
      : 0.0;
    target.x = restX + rattle;
    target.y = 0.048 + hop;
    target.z = restZ + rattle * 0.5;
    target.rx = Math.PI * 0.5 + rattle * 2.6;
    target.ry = 0.52 + rattle * 1.8;
    target.rz = 0.02 + rattle * 2.0;
    return target;
  }

  // Phase E: Slides off tilting shattered rim slab & plunges into chasm right after Hero (19.45 – 22.85 s)
  if (t < ACT3_END) {
    if (t < 20.05) {
      const u = (t - 19.45) / (20.05 - 19.45);
      const tip = easeInQuad(u);
      target.x = lerp(restX, holeX + 0.92, tip);
      target.y = lerp(0.048, -0.32, tip);
      target.z = lerp(restZ, holeZ + 0.05, tip);
      target.rx = Math.PI * 0.5 + tip * 0.95;
      target.ry = 0.52 + tip * 0.48;
      target.rz = 0.02 + tip * 0.72;
    } else {
      const dt = t - 20.05;
      const u = clamp01(dt / (ACT3_END - 20.05));
      target.x = lerp(holeX + 0.92, holeX + 0.55, smoothstep(u));
      // Stays ~1.9 m above Hero during Shot 10 upward view so both Hero & spinning Oathblade gleam in the shaft!
      target.y = Math.min(-0.32, heroState.y + lerp(1.25, 2.25, u));
      target.z = lerp(holeZ + 0.05, holeZ - 0.18, smoothstep(u));
      target.rx = Math.PI * 0.5 + 0.95 + dt * 5.8;
      target.ry = 1.00 + dt * 2.4;
      target.rz = 0.74 + dt * 4.2;
    }
    return target;
  }

  // Phase F: Tumbling alongside Hero in 360° Vertical Shaft & Underground River (22.85 – 28.85 s)
  if (t < FADE_OUT_START_TIME) {
    const dt = t - ACT4_START;
    if (t < WATER_SPLASH_TIME) {
      target.x = heroState.x + 1.15;
      target.y = heroState.y + 2.25;
      target.z = heroState.z - 0.50;
      target.rx = 1.2 + dt * 6.4;
      target.ry = 0.6 + dt * 3.1;
      target.rz = 0.4 + dt * 4.7;
    } else {
      const rdt = t - WATER_SPLASH_TIME;
      target.x = heroState.x + 0.95 * Math.cos(rdt * 1.4);
      target.y = heroState.y + 0.25 + Math.sin(rdt * 4.2) * 0.22;
      target.z = heroState.z + 1.35;
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
 * curve (`sampleEscapeBossMouthOpen`) is bound yet.
 */
function sampleDefaultEscapeMouthOpen(cueIndex, localTimeSec, durationSec) {
  if (!Number.isFinite(localTimeSec) || localTimeSec < 0) return 0.0;
  const dur = Number.isFinite(durationSec) && durationSec > 0.2 ? durationSec : 2.0;
  if (localTimeSec >= dur) return 0.0;

  const u = localTimeSec / dur;
  const edgeEnv = smoothstep(u / 0.08) * (1.0 - smoothstep((u - 0.88) / 0.12));

  let phraseGate = 1.0;
  if (cueIndex === 1) {
    if (u > 0.16 && u < 0.24) phraseGate = 0.12;
    else if (u > 0.56 && u < 0.66) phraseGate = 0.08;
  } else if (cueIndex === 2) {
    if (u > 0.22 && u < 0.34) phraseGate = 0.08;
    else if (u > 0.60 && u < 0.72) phraseGate = 0.10;
  } else if (cueIndex === 3) {
    if (u > 0.55 && u < 0.65) phraseGate = 0.10;
  } else if (cueIndex === 4) {
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
  // Exact 0.24x dramatic slow-mo plateau across 18.30 – 19.05 s with tight 0.10 s smooth entry/exit
  if (t <= 18.20 || t >= 19.15) return 1.0;
  if (t < SLOWMO_START_TIME) {
    return lerp(1.0, 0.24, smoothstep((t - 18.20) / (SLOWMO_START_TIME - 18.20)));
  }
  if (t <= SLOWMO_END_TIME) {
    return 0.24;
  }
  return lerp(0.24, 1.0, smoothstep((t - SLOWMO_END_TIME) / (19.15 - SLOWMO_END_TIME)));
}

function evaluateFloorHoleProgress(t) {
  if (t < FLOOR_SMASH_TIME || t >= ACT3_END) return 0.0;
  if (t < 19.45) {
    return 0.68 * easeOutCubic((t - FLOOR_SMASH_TIME) / (19.45 - FLOOR_SMASH_TIME));
  }
  if (t < CHASM_OPEN_END_TIME) {
    return lerp(0.68, 1.0, smoothstep((t - 19.45) / (CHASM_OPEN_END_TIME - 19.45)));
  }
  return 1.0;
}

function evaluateUnderwater01(t) {
  if (t < WATER_SPLASH_TIME || t >= UNDERWATER_END_TIME) return 0.0;
  if (t < 25.05) {
    return smoothstep((t - WATER_SPLASH_TIME) / (25.05 - WATER_SPLASH_TIME));
  }
  if (t < 25.85) {
    return 0.94 + 0.06 * Math.sin((t - 25.05) * 9.5);
  }
  if (t < SHOT_11B_END) {
    return lerp(0.95, 0.20, smoothstep((t - 25.85) / (SHOT_11B_END - 25.85)));
  }
  return lerp(0.20, 0.0, smoothstep((t - SHOT_11B_END) / (UNDERWATER_END_TIME - SHOT_11B_END)));
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
  if (t < 0.35) return smoothstep(t / 0.35);
  if (t < LETTERBOX_OUT_START_TIME) return 1.0;
  return 1.0 - smoothstep((t - LETTERBOX_OUT_START_TIME) / (BOSS_ESCAPE_CUTSCENE_DURATION - LETTERBOX_OUT_START_TIME));
}

function evaluateScreenShake(t) {
  if (t <= 0.0 || t >= BOSS_ESCAPE_CUTSCENE_DURATION) return 0.0;
  let s = 0.0;
  s = Math.max(s, decayImpulse(t, CLASH_1_TIME, 0.26, 0.55));
  s = Math.max(s, decayImpulse(t, CLASH_2_TIME, 0.24, 0.45));
  s = Math.max(s, decayImpulse(t, SWORD_DISARM_TIME, 0.28, 0.65));
  s = Math.max(s, decayImpulse(t, KNOCKDOWN_CUE_TIME, 0.38, 0.85));
  s = Math.max(s, decayImpulse(t, KNOCKDOWN_LAND_TIME, 0.26, 0.42));
  // Colossal 1.50 earthquake shockwave on the 4.5 m cathedral floor smash!
  s = Math.max(s, decayImpulse(t, FLOOR_SMASH_TIME, 1.30, 1.50));
  s = Math.max(s, decayImpulse(t, WATER_SPLASH_TIME, 0.48, 0.90));
  s = Math.max(s, decayImpulse(t, GRATE_BREAK_TIME, 0.58, 1.18));
  return s;
}

function evaluateImpactFlash01(t) {
  if (t <= 0.0 || t >= BOSS_ESCAPE_CUTSCENE_DURATION) return 0.0;
  let f = 0.0;
  f = Math.max(f, decayImpulse(t, CLASH_1_TIME, 0.18, 0.62));
  f = Math.max(f, decayImpulse(t, CLASH_2_TIME, 0.16, 0.48));
  f = Math.max(f, decayImpulse(t, SWORD_DISARM_TIME, 0.18, 0.58));
  f = Math.max(f, decayImpulse(t, KNOCKDOWN_CUE_TIME, 0.22, 0.72));
  f = Math.max(f, decayImpulse(t, FLOOR_SMASH_TIME, 0.34, 1.00));
  f = Math.max(f, decayImpulse(t, WATER_SPLASH_TIME, 0.20, 0.46));
  f = Math.max(f, decayImpulse(t, GRATE_BREAK_TIME, 0.24, 0.72));
  return clamp01(f);
}

function evaluateHitstopSec(t) {
  if (t >= CLASH_1_TIME && t < CLASH_1_TIME + 0.09) return 0.09;
  if (t >= CLASH_2_TIME && t < CLASH_2_TIME + 0.06) return 0.06;
  if (t >= SWORD_DISARM_TIME && t < SWORD_DISARM_TIME + 0.07) return 0.07;
  if (t >= KNOCKDOWN_CUE_TIME && t < KNOCKDOWN_CUE_TIME + 0.07) return 0.075;
  if (t >= FLOOR_SMASH_TIME && t < FLOOR_SMASH_TIME + 0.095) return 0.095;
  if (t >= GRATE_BREAK_TIME && t < GRATE_BREAK_TIME + 0.055) return 0.055;
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
 * Computes a deterministic multi-frequency camera tremor offset from `screenShake` (`0 .. 1.5`).
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

  const amp = 0.072 * s * (0.48 + 0.52 * Math.min(1.5, s));
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
 * Evaluates the complete 34.0-second 12-Shot AAA Boss Escape Cutscene state at timestamp `tSec`.
 * Pure, deterministic, zero-GC when `outState` is reused across frames.
 *
 * @param {object|null} rig - Rig returned by `createBossEscapeCutsceneRig(...)` (falls back to default rig).
 * @param {number} tSec - Elapsed cutscene time in seconds (`0 .. 34.0`).
 * @param {object|null} [outState] - Optional pre-allocated state object to mutate in-place.
 * @param {{
 *   sampleMouthOpen?: ((cueIndex: number, localTimeSec: number) => number)|null,
 *   normalCamPos?: { x: number, y: number, z: number }|number[]|null,
 *   normalCamLook?: { x: number, y: number, z: number }|number[]|null,
 *   normalFov?: number
 * }|null} [opts]
 */
export function sampleBossEscapeCutscene(rig, tSec, outState = null, opts = null) {
  const activeRig = rig && Array.isArray(rig.shots) ? rig : DEFAULT_RIG;
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

  // Per-Shot Hard-Cut Camera Evaluation (14 cuts across 12 cinematic shots — zero cross-cut bleed!)
  const activeShot = findActiveShot(t, activeRig.shots);
  const camSample = sampleShotCamera(t, activeShot);

  let camPosX = camSample.px;
  let camPosY = camSample.py;
  let camPosZ = camSample.pz;
  let camLookX = camSample.lx;
  let camLookY = camSample.ly;
  let camLookZ = camSample.lz;
  let camFov = camSample.fov;
  let camRoll = finished ? 0.0 : camSample.roll;

  // Guarded final gameplay camera handoff on Exterior Shore (32.85 – 34.00 s):
  // ONLY blends toward caller-supplied `opts.normalCamPos` if it is a valid open-shore coordinate
  // near `shoreWakePos` (defeats the stale-castle-coordinate cliff-clipping bug during seek/handoff!).
  if (stageMode === 'exterior_shore' && opts && (opts.normalCamPos || opts.normalCamLook || Number.isFinite(opts.normalFov))) {
    const handoffW = finished ? 1.0 : smootherstep((t - LETTERBOX_OUT_START_TIME) / (ACT5_END - LETTERBOX_OUT_START_TIME));
    if (handoffW > 0) {
      const nPosX = readVec3X(opts.normalCamPos, activeRig.defaultNormalCamPos.x);
      const nPosY = readVec3Y(opts.normalCamPos, activeRig.defaultNormalCamPos.y);
      const nPosZ = readVec3Z(opts.normalCamPos, activeRig.defaultNormalCamPos.z);
      const isShoreValid =
        Math.hypot(nPosX - activeRig.shoreWakeX, nPosZ - activeRig.shoreWakeZ) <= 13.5 &&
        nPosZ >= activeRig.shoreWakeZ + 2.2 &&
        nPosZ <= 24.0 &&
        Math.abs(nPosX - activeRig.shoreWakeX) <= 7.5 &&
        nPosY >= activeRig.shoreWakeY + 1.2 &&
        nPosY <= 9.5;
      if (isShoreValid) {
        const nLookX = readVec3X(opts.normalCamLook, activeRig.defaultNormalCamLook.x);
        const nLookY = readVec3Y(opts.normalCamLook, activeRig.defaultNormalCamLook.y);
        const nLookZ = readVec3Z(opts.normalCamLook, activeRig.defaultNormalCamLook.z);
        const isLookValid =
          Math.hypot(nLookX - activeRig.shoreWakeX, nLookZ - activeRig.shoreWakeZ) <= 22.0 &&
          nLookY >= -1.0 && nLookY <= 18.0;
        camPosX = lerp(camPosX, nPosX, handoffW);
        camPosY = lerp(camPosY, nPosY, handoffW);
        camPosZ = lerp(camPosZ, nPosZ, handoffW);
        if (isLookValid) {
          camLookX = lerp(camLookX, nLookX, handoffW);
          camLookY = lerp(camLookY, nLookY, handoffW);
          camLookZ = lerp(camLookZ, nLookZ, handoffW);
        }
      }
      if (Number.isFinite(opts.normalFov) && opts.normalFov > 15 && opts.normalFov < 110) {
        camFov = lerp(camFov, opts.normalFov, handoffW);
      }
    }
  }

  // Hero, Boss & Dropped Oathblade Kinematics
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

  // Floor Chasm, Slow-Mo, Underwater, Fade, Shake, Flash, Grate & Letterbox
  const floorHoleProgress = evaluateFloorHoleProgress(t);
  const floorHoleRadius = floorHoleProgress * activeRig.floorHoleMaxRadius;
  const slowMoFactor = finished ? 1.0 : evaluateSlowMoFactor(t);
  const underwater01 = finished ? 0.0 : evaluateUnderwater01(t);
  const fadeToBlack01 = finished ? 0.0 : evaluateFadeToBlack01(t);
  const letterbox01 = evaluateLetterbox01(t);
  const screenShake = finished ? 0.0 : evaluateScreenShake(t);
  const impactFlash01 = finished ? 0.0 : evaluateImpactFlash01(t);
  const hitstopSec = finished ? 0.0 : evaluateHitstopSec(t);
  const grateBroken = t >= GRATE_BREAK_TIME;

  // Monotonic Event Cues (plus active voiceCue)
  const clashCue = t >= CLASH_2_TIME ? 2 : t >= CLASH_1_TIME ? 1 : 0;
  const disarmCue = t >= SWORD_DISARM_TIME ? 1 : 0;
  const knockdownCue = t >= KNOCKDOWN_CUE_TIME ? 1 : 0;
  const scootCue = evaluateScootCue(t);
  const slowMoCue = t >= SLOWMO_START_TIME ? 1 : 0;
  const floorSmashCue = t >= FLOOR_SMASH_TIME ? 1 : 0;
  const waterSplashCue = t >= WATER_SPLASH_TIME ? 1 : 0;
  const grateBreakCue = grateBroken ? 1 : 0;
  const shoreWakeCue = t >= SHORE_WAKE_CUE_TIME ? 1 : 0;

  // Populate Flat Zero-GC Output State
  out.t = t;
  out.finished = finished;
  out.act = act;
  out.actId = actId;
  out.actProgress = actProgress;
  out.progress = clamp01(t / BOSS_ESCAPE_CUTSCENE_DURATION);
  out.stageMode = stageMode;
  out.cameraCutId = activeShot.cutId;
  out.shotId = activeShot.id;
  out.letterbox01 = letterbox01;
  out.fadeToBlack01 = fadeToBlack01;
  out.underwater01 = underwater01;
  out.slowMoFactor = slowMoFactor;
  out.canSkip = !finished && t >= BOSS_ESCAPE_CUTSCENE_SKIP_TIME;
  out.screenShake = screenShake;
  out.hitstopSec = hitstopSec;
  out.impactFlash01 = impactFlash01;
  out.grateBroken = grateBroken;
  out.finalCamYaw = activeRig.finalCamYaw;

  out.camPos.x = camPosX;
  out.camPos.y = camPosY;
  out.camPos.z = camPosZ;
  out.camLook.x = camLookX;
  out.camLook.y = camLookY;
  out.camLook.z = camLookZ;
  out.camFov = camFov;
  out.fov = camFov;
  out.camRoll = camRoll;

  out.heroMode = hero.mode;
  out.heroAnimName = hero.animName;
  out.heroX = hero.x;
  out.heroY = hero.y;
  out.heroZ = hero.z;
  out.heroFacing = hero.facing;
  out.heroAnimU = hero.animU;
  out.swordDisarmed = t >= SWORD_DISARM_TIME;
  // Shield stays intact for the 1.75s block, knocked free on the 3.35s crushing shove, restored on shore
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
 * unarmed on wet gravel at `wakePos`, camera at `(0, 3.15, 8.2)` looking North `-Z`, `finalCamYaw = 0`).
 *
 * @param {object|null} [rig]
 * @param {object|null} [outState]
 * @param {object|null} [opts]
 */
export function getBossEscapeCutsceneSkipState(rig = null, outState = null, opts = null) {
  return sampleBossEscapeCutscene(rig, BOSS_ESCAPE_CUTSCENE_DURATION, outState, opts);
}
