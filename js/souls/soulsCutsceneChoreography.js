// Full Narrative First-Boss Intro Cutscene Choreography for Chapter 26 — «Abandoned Knight Rift»
// Pure Vanilla ES Module (Browser / V8 / Node compatible, zero external engine dependencies).
//
// 100% Dynamically Anchored to `soulsCastleLayout.js`:
//   - All camera spline knots, door hinges, silent Hero pull/entry path, and Obsidian Throne
//     coordinates are computed strictly from `SOULS_CASTLE_CONSTANTS.BOSS_DOOR_Z`,
//     `SOULS_CASTLE_CONSTANTS.BOSS_CENTER_Z`, and `SOULS_CASTLE_THRONE_CONFIG`
//     (`heroEntryZ`, `sitZ`, `riseZ`, `standZ`) — zero hardcoded world-Z literals!
//   - Outward-Pulling Doors (`doorPullDirection = +1` into +Z sanctuary/corridor, 0° -> 82°)
//     scraping over forged iron floor rails with live friction sparks (`doorScrapeSparkIntensity`).
//   - 7-Clip Dark English Master Voiceover (`boss_intro_vo_01..07.mp3`) + Elden Ring-style Russian
//     subtitles + 30-FPS jaw lip-sync (`soulsBossLipSyncData.js`: `BOSS_VO_DURATIONS_SEC`,
//     `sampleBossMouthOpen`).
//   - Boss Acting Clips (`Rift_Boss_Tripo.glb`: `Throne_Intro_Dialogue` 20.000 s + calm
//     `Throne_Intro_StandUp` 3.400 s with Warhammer pickup beside Throne armrest, ZERO roar,
//     ZERO Hero cutaway during dialogue, ZERO closing door-slam audio/shake cue!).

import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_THRONE_CONFIG
} from './soulsCastleLayout.js?v=20261125z105';
import {
  BOSS_VO_DURATIONS_SEC,
  sampleBossMouthOpen
} from './soulsBossLipSyncData.js?v=20261125z105';

const DEG_TO_RAD = Math.PI / 180;
const BOSS_SPEAKER_RU = 'РЫЦАРЬ ПЕПЛА';

const ACT1_MAX_DOOR_DEG = 12.0;
const MAX_DOOR_ANGLE_DEG = 82.0;
const ACT1_DOOR_NORM = ACT1_MAX_DOOR_DEG / MAX_DOOR_ANGLE_DEG;

// Exact millisecond-accurate dialogue cue schedule for the 7-clip dark English master
// (`boss_intro_vo_01..07.mp3`, durations pulled straight from `BOSS_VO_DURATIONS_SEC`).
const ACT1_END = 2.30;
const ACT2_END = 5.80;

const VO_SPECS = [
  {
    index: 1,
    start: 6.20,
    text: 'Ещё один, да?',
    textEn: '[chuckle] Another one, eh?'
  },
  {
    index: 2,
    start: 8.65,
    text: 'Как же не терпится испытать пределы моего гостеприимства.',
    textEn: 'So eager to test the limits of my hospitality.'
  },
  {
    index: 3,
    start: 13.15,
    text: 'Ты обнаружишь, дорогой гость, что время здесь течёт... иначе.',
    textEn: "You'll find, dear guest, that time here moves... differently."
  },
  {
    index: 4,
    start: 19.00,
    text: 'О, не делай такое удивлённое лицо. Многие приходили до тебя — полные бравады.',
    textEn: "[scoff/chuckle] Oh, don't look so surprised. Many have come before you, full of bravado."
  },
  {
    index: 5,
    start: 25.85,
    text: 'Но со временем все они постигают истинный смысл терпения... и тишины.',
    textEn: 'They learn, eventually, the true meaning of patience... and silence.'
  },
  {
    index: 6,
    start: 32.55,
    text: 'А теперь, если позволишь, у меня есть и другие... дела.',
    textEn: "Now, if you'll excuse me, I have other... arrangements to attend to."
  },
  {
    index: 7,
    start: 39.40,
    text: 'Чувствуй себя как дома.',
    textEn: 'Enjoy your stay.'
  }
];

function round3(v) {
  return Math.round(v * 1000) / 1000;
}

const _builtCues = [];
for (let i = 0; i < VO_SPECS.length; i++) {
  const spec = VO_SPECS[i];
  const dur = round3(Number(BOSS_VO_DURATIONS_SEC[spec.index]) || 2.0);
  const start = round3(spec.start);
  const end = round3(start + dur);
  _builtCues.push(Object.freeze({
    index: spec.index,
    start,
    end,
    duration: dur,
    file: `boss_intro_vo_${String(spec.index).padStart(2, '0')}.mp3`,
    speaker: BOSS_SPEAKER_RU,
    text: spec.text,
    textEn: spec.textEn
  }));
}

export const BOSS_INTRO_DIALOGUE_CUES = Object.freeze(_builtCues);

const VO1 = BOSS_INTRO_DIALOGUE_CUES[0];
const VO2 = BOSS_INTRO_DIALOGUE_CUES[1];
const VO3 = BOSS_INTRO_DIALOGUE_CUES[2];
const VO4 = BOSS_INTRO_DIALOGUE_CUES[3];
const VO5 = BOSS_INTRO_DIALOGUE_CUES[4];
const VO6 = BOSS_INTRO_DIALOGUE_CUES[5];

// Live chuckle shoulder-shake windows (the chuckle itself is baked into VO 1 & VO 4 audio)
const CHUCKLE_WINDOWS = Object.freeze([
  Object.freeze({ start: VO1.start, end: round3(VO1.start + 0.90) }),
  Object.freeze({ start: VO4.start, end: round3(VO4.start + 0.90) })
]);
const CHUCKLE_START = CHUCKLE_WINDOWS[0].start;
const CHUCKLE_END = CHUCKLE_WINDOWS[0].end;

const ARMOR_SHIFT_1_TIME = 19.10;
const ARMOR_SHIFT_2_TIME = 33.20;
const TURNING_POINT_START = 28.50;
const TURNING_POINT_END = 30.50;
const BOSS_STANDUP_START = 37.85;
const BOSS_STANDUP_DURATION = 3.40;
const BOSS_STANDUP_END = round3(BOSS_STANDUP_START + BOSS_STANDUP_DURATION); // 41.25 s
const BOSS_STEP1_TIME = round3(BOSS_STANDUP_START + 2.34); // 40.19 s — exact Right boot stone plant in Throne_Intro_StandUp!
const BOSS_STEP2_TIME = round3(BOSS_STANDUP_START + 2.88); // 40.73 s — exact Left boot stone plant in Throne_Intro_StandUp!
const ACT4_END = 41.60;
const TITLE_CARD_START = 39.20;
const TITLE_CARD_END = 42.40;
const TOTAL_DURATION = 43.20;
const LETTERBOX_OUT_START = round3(TOTAL_DURATION - 1.15); // 42.05 s

export const BOSS_DOOR_CUTSCENE_DURATION = TOTAL_DURATION;
export const BOSS_DOOR_CUTSCENE_SKIP_TIME = 1.50;

// ============================================================================
// Dynamic Layout Rig Builder (100% Parametric on BOSS_DOOR_Z & Throne Config)
// ============================================================================

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
      return damp * (w1 + w2) / (w1 / mPrev + w2 / mNext);
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

/**
 * Builds a complete, frozen spatial rig + C1 Hermite camera spline strictly from
 * `constants` (`SOULS_CASTLE_CONSTANTS`) and `throneConfig` (`SOULS_CASTLE_THRONE_CONFIG`).
 * Works identically for any `BOSS_DOOR_Z` shift without a single hardcoded Z literal.
 */
export function buildBossDoorCutsceneRig(
  constants = SOULS_CASTLE_CONSTANTS,
  throneConfig = SOULS_CASTLE_THRONE_CONFIG
) {
  const doorZ = Number.isFinite(constants?.BOSS_DOOR_Z) ? constants.BOSS_DOOR_Z : -32.0;
  const portalHalfW = Number.isFinite(constants?.BOSS_PORTAL_HALF_W) ? constants.BOSS_PORTAL_HALF_W : 3.15;
  const bossRadius = Number.isFinite(constants?.BOSS_RADIUS) ? constants.BOSS_RADIUS : 16.0;
  const bossCenterZ = Number.isFinite(constants?.BOSS_CENTER_Z) ? constants.BOSS_CENTER_Z : doorZ - 15.2;

  const heroPushZ = round3(doorZ + 0.95);     // Hands right at the forged pull-rings
  const heroPullBackZ = round3(doorZ + 2.35); // Full-weight backward pull as outward leaves swing open
  const heroFinalZ = Number.isFinite(throneConfig?.heroEntryZ)
    ? throneConfig.heroEntryZ
    : Number.isFinite(constants?.BOSS_HERO_ENTRY_Z)
      ? constants.BOSS_HERO_ENTRY_Z
      : round3(doorZ - 5.20);

  const bossSitZ = Number.isFinite(throneConfig?.sitZ) ? throneConfig.sitZ : round3(doorZ - 24.90);
  const bossRiseZ = Number.isFinite(throneConfig?.riseZ) ? throneConfig.riseZ : round3(doorZ - 23.60);
  const bossFinalZ = Number.isFinite(throneConfig?.standZ) ? throneConfig.standZ : round3(doorZ - 21.40);
  const bossFaceZ = round3(bossSitZ + 0.40);

  const defaultNormalCamPos = Object.freeze({ x: 0.0, y: 3.45, z: round3(heroFinalZ + 3.80) });
  const defaultNormalCamLook = Object.freeze({ x: 0.0, y: 1.35, z: heroFinalZ });

  // Single-take C1 Hermite camera spline (0.00 – 41.60 s), 100% parametric on layout anchors
  const camKnots = Object.freeze([
    // Act 1 (0.00–2.30 s): Intimate low side angle on Hero's hands & forged iron floor rail
    { t: 0.00,               px:  2.15, py: 1.25, pz: doorZ + 3.40, lx:  0.00, ly: 1.35, lz: doorZ + 0.15, fov: 46.0, dp: 0.0, dl: 0.0 },
    { t: 1.15,               px:  2.08, py: 1.40, pz: doorZ + 3.78, lx:  0.00, ly: 1.72, lz: doorZ + 0.30, fov: 44.5, dp: 0.8, dl: 0.5 },
    { t: ACT1_END,           px:  1.72, py: 1.62, pz: doorZ + 4.10, lx:  0.00, ly: 1.88, lz: doorZ + 0.20, fov: 43.0, dp: 0.7, dl: 0.5 },

    // Act 2 (2.30–5.80 s): Outward doors scrape wide (12°->82°); camera glides down center aisle into Throne Hall
    { t: 3.30,               px:  0.72, py: 1.88, pz: doorZ + 3.45, lx:  0.00, ly: 2.08, lz: doorZ - 8.50, fov: 45.2, dp: 0.9, dl: 0.8 },
    { t: 4.55,               px:  0.88, py: 2.06, pz: doorZ - 0.85, lx:  0.00, ly: 2.28, lz: doorZ - 18.0, fov: 44.5, dp: 0.9, dl: 0.8 },
    { t: ACT2_END,           px:  1.65, py: 2.18, pz: heroFinalZ - 1.00, lx: 0.00, ly: 2.48, lz: bossFaceZ, fov: 42.0, dp: 0.8, dl: 0.3 },

    // Act 3 — Continuous Boss-Only Throne Framing (5.80–37.85 s): ZERO cutaway away from the Boss!
    // VO 1 (6.20–8.09 s): Boss slowly turns head toward the entering Hero
    { t: VO1.start,          px:  1.92, py: 2.22, pz: heroFinalZ - 3.60, lx:  0.00, ly: 2.52, lz: bossFaceZ,         fov: 40.5, dp: 0.9,  dl: 0.2 },

    // VO 2 (8.65–12.53 s): calm moderate approach toward the illuminated Obsidian Throne
    { t: VO2.start,          px:  1.85, py: 2.30, pz: heroFinalZ - 6.80, lx:  0.00, ly: 2.54, lz: bossFaceZ,         fov: 39.0, dp: 0.9,  dl: 0.2 },
    { t: VO3.start,          px:  1.55, py: 2.44, pz: bossSitZ + 7.70,   lx:  0.00, ly: 2.54, lz: bossFaceZ,         fov: 36.5, dp: 0.9,  dl: 0.2 },

    // VO 3 (13.15–18.34 s): graceful theatrical semicircle across the Throne front
    { t: round3((VO3.start + VO3.end) * 0.5),
                             px: -0.25, py: 2.52, pz: bossSitZ + 7.10,   lx:  0.00, ly: 2.55, lz: bossFaceZ,         fov: 35.8, dp: 1.0,  dl: 0.2 },

    // VO 4 (19.00–25.21 s): scoff/chuckle + regal lean back (3/4 right-armrest view showing Warhammer beside Throne)
    { t: VO4.start,          px: -2.05, py: 2.48, pz: bossSitZ + 6.70,   lx:  0.00, ly: 2.55, lz: bossFaceZ,         fov: 35.5, dp: 0.8,  dl: 0.2 },
    { t: round3((VO4.start + VO4.end) * 0.5),
                             px: -1.65, py: 2.54, pz: bossSitZ + 6.20,   lx:  0.00, ly: 2.53, lz: bossFaceZ - 0.15,  fov: 34.8, dp: 0.75, dl: 0.2 },

    // VO 5 (25.85–31.86 s): unbroken slow theatrical orbit & dramatic close-in on Boss ("patience... and silence")
    { t: VO5.start,          px:  0.30, py: 2.50, pz: bossSitZ + 6.40,   lx:  0.00, ly: 2.54, lz: bossFaceZ - 0.05,  fov: 34.4, dp: 0.9,  dl: 0.2 },
    { t: TURNING_POINT_START,px:  1.45, py: 2.46, pz: bossSitZ + 5.95,   lx:  0.00, ly: 2.55, lz: bossFaceZ,         fov: 33.2, dp: 0.8,  dl: 0.2 },
    { t: TURNING_POINT_END,  px:  1.22, py: 2.49, pz: bossSitZ + 5.38,   lx:  0.00, ly: 2.57, lz: bossFaceZ,         fov: 31.8, dp: 0.75, dl: 0.2 },

    // VO 6 (32.55–37.57 s): tasteful closer portrait framing on Boss's shadowed face & grin, then majestic pull-back to FULL HEIGHT
    { t: VO6.start,          px:  0.72, py: 2.52, pz: bossSitZ + 4.95,   lx:  0.00, ly: 2.57, lz: bossFaceZ + 0.02,  fov: 30.6, dp: 0.75, dl: 0.2 },
    { t: round3(VO6.start + 1.60),
                             px:  0.18, py: 2.52, pz: bossSitZ + 4.80,   lx:  0.00, ly: 2.56, lz: bossFaceZ + 0.05,  fov: 29.8, dp: 0.65, dl: 0.2 },
    { t: round3(VO6.start + 2.65),
                             px: -0.35, py: 2.48, pz: bossSitZ + 5.50,   lx: -0.05, ly: 2.48, lz: bossFaceZ + 0.15,  fov: 31.8, dp: 0.65, dl: 0.3 },
    { t: round3(VO6.start + 4.00),
                             px: -0.82, py: 2.38, pz: bossSitZ + 8.80,   lx: -0.10, ly: 2.30, lz: bossSitZ + 0.90,   fov: 37.2, dp: 0.85, dl: 0.7 },
    { t: BOSS_STANDUP_START, px: -1.05, py: 2.28, pz: bossSitZ + 11.95,  lx: -0.12, ly: 2.18, lz: bossSitZ + 1.35,   fov: 42.0, dp: 0.65, dl: 0.5 },

    // Act 4 Stand-Up (37.85–41.60 s) + VO 7 (39.40–40.69 s) + Title Card:
    // Full-height heroic framing so the Boss rising off the Obsidian Throne, reaching over to grab
    // the Warhammer standing beside his right armrest (~39.80 s), and hefting it into combat stance read clearly!
    { t: round3((BOSS_STANDUP_START + ACT4_END) * 0.5),
                             px: -0.65, py: 2.22, pz: bossFinalZ + 9.75, lx: -0.12, ly: 2.34, lz: bossFinalZ - 1.15, fov: 43.2, dp: 0.75, dl: 0.6 },
    { t: ACT4_END,           px:  0.65, py: 2.18, pz: bossFinalZ + 10.50,lx:  0.00, ly: 2.38, lz: bossFinalZ,        fov: 44.0, dp: 0.0,  dl: 0.0 }
  ]);

  const camTangents = computeCamTangents(camKnots);

  return Object.freeze({
    doorZ,
    portalHalfW,
    bossRadius,
    bossCenterZ,
    heroPushZ,
    heroPullBackZ,
    heroFinalZ,
    bossSitZ,
    bossRiseZ,
    bossFinalZ,
    bossFaceZ,
    defaultNormalCamPos,
    defaultNormalCamLook,
    camKnots,
    camTangents
  });
}

const DEFAULT_RIG = buildBossDoorCutsceneRig(SOULS_CASTLE_CONSTANTS, SOULS_CASTLE_THRONE_CONFIG);

export const BOSS_DOOR_CUTSCENE_ACTS = Object.freeze({
  DURATION: BOSS_DOOR_CUTSCENE_DURATION,
  SKIP_UNLOCK_TIME: BOSS_DOOR_CUTSCENE_SKIP_TIME,
  ACT1_START: 0.0,
  ACT1_END,
  ACT2_START: ACT1_END,
  ACT2_END,
  ACT3_START: ACT2_END,
  ACT3_END: BOSS_STANDUP_START,
  ACT4_START: BOSS_STANDUP_START,
  ACT4_END,
  ACT5_START: ACT4_END,
  ACT5_END: BOSS_DOOR_CUTSCENE_DURATION,
  DOOR_BOLT_TIME: 0.05,
  DOOR_PUSH_TIME: 0.60,
  DOOR_OPEN_TIME: 2.30,
  DOOR_OPEN_FULL_TIME: 4.60,
  DOOR_SLAM_TIME: 5.35,
  DOOR_PULL_DIRECTION: 1,
  CHUCKLE_START,
  CHUCKLE_END,
  TURNING_POINT_START,
  TURNING_POINT_END,
  BOSS_STANDUP_START,
  BOSS_STANDUP_DURATION,
  BOSS_STANDUP_END,
  BOSS_RISE_TIME: BOSS_STANDUP_START,
  BOSS_STEP1_TIME,
  BOSS_STEP2_TIME,
  ARMOR_SHIFT_1_TIME,
  ARMOR_SHIFT_2_TIME,
  ARMOR_SHIFT_3_TIME: BOSS_STANDUP_START,
  TITLE_CARD_START,
  TITLE_CARD_END,
  LETTERBOX_OUT_START,
  HERO_PUSH_X: 0.0,
  HERO_PUSH_Z: DEFAULT_RIG.heroPushZ,
  HERO_PULL_BACK_Z: DEFAULT_RIG.heroPullBackZ,
  HERO_WALK_START_TIME: 3.15,
  HERO_FINAL_X: 0.0,
  HERO_FINAL_Z: DEFAULT_RIG.heroFinalZ,
  HERO_FACING: Math.PI,
  BOSS_CENTER_Z: DEFAULT_RIG.bossCenterZ,
  BOSS_SIT_Z: DEFAULT_RIG.bossSitZ,
  BOSS_RISE_Z: DEFAULT_RIG.bossRiseZ,
  BOSS_FINAL_Z: DEFAULT_RIG.bossFinalZ,
  BOSS_FACE_Z: DEFAULT_RIG.bossFaceZ,
  BOSS_DIALOGUE_CLIP_DURATION: 20.0,
  DOOR_Z: DEFAULT_RIG.doorZ,
  ACT1_MAX_DOOR_DEG,
  MAX_DOOR_ANGLE_DEG,
  DEFAULT_NORMAL_FOV: 52.0,
  BOSS_TITLE_RU: 'РЫЦАРЬ ПЕПЛА',
  BOSS_SUBTITLE_RU: 'СУДИЯ РУИН'
});

// Monotonic acting timeline for `Throne_Intro_Dialogue` (20.000 s, u ∈ [0..1])
// Synced 1:1 with the 8 acting beats in Troll_Tripo.glb & all VO lines.
const DIALOGUE_U_KNOTS = Object.freeze([
  { t: 0.00,               u: 0.000 }, // Seated relaxed on the Throne (Beat 1)
  { t: ACT2_END,           u: 0.050 }, // Subtle idle breathing while the doors close
  { t: VO1.start,          u: 0.080 }, // Slow head turn & chin lift toward the entering hero (Beat 2)
  { t: VO1.end,            u: 0.220 }, // VO 1: [chuckle] Another one, eh?
  { t: VO2.end,            u: 0.360 }, // VO 2: So eager to test the limits of my hospitality.
  { t: VO3.end,            u: 0.490 }, // VO 3: time here moves... differently (mocking head tilt + lazy gesture)
  { t: VO4.end,            u: 0.640 }, // VO 4: scoff/chuckle, lean back on the backrest (armorShiftCue 1)
  { t: VO5.end,            u: 0.800 }, // VO 5: patience... and silence (smile fades, eyes narrow)
  { t: BOSS_STANDUP_START, u: 1.000 }  // VO 6: other arrangements -> exact seamless start of `Throne_Intro_StandUp`
]);

// ============================================================================
// Pure Math & Spline Helpers (Zero Allocations)
// ============================================================================
function clamp01(v) {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
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

function easeInOutSine(t) {
  const u = clamp01(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
}

function pulseBell(t, start, end) {
  if (t <= start || t >= end || end <= start) return 0;
  const u = (t - start) / (end - start);
  return Math.sin(u * Math.PI);
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

const _camSample = { px: 0, py: 0, pz: 0, lx: 0, ly: 0, lz: 0, fov: 44.0 };

function sampleCameraSpline(t, rig) {
  const knots = rig.camKnots;
  const tangents = rig.camTangents;
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
// Sub-Evaluators: Outward Doors, Iron Rail Sparks, Bolt, Shake, Hero, Boss & VO
// ============================================================================

/**
 * Heavy cathedral iron crossbar bolt lift/stow progress (0 = locked, 1 = lifted & stowed clear).
 */
function evaluateBoltLift01(t) {
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_BOLT_TIME) return 0.0;
  if (t < 0.25) {
    const u = (t - BOSS_DOOR_CUTSCENE_ACTS.DOOR_BOLT_TIME) / 0.20;
    return clamp01(0.10 * smoothstep(u) + Math.sin(u * Math.PI * 3.0) * 0.024);
  }
  if (t < 0.85) {
    const u = (t - 0.25) / 0.60;
    const heavyLift = 1.0 - Math.pow(1.0 - u, 2.1);
    return clamp01(0.10 + 0.64 * heavyLift);
  }
  if (t < 1.35) {
    const u = (t - 0.85) / 0.50;
    return clamp01(0.74 + 0.26 * smoothstep(u));
  }
  if (t < 5.56) {
    return 1.0;
  }
  if (t < 5.92) {
    const u = (t - 5.56) / 0.36;
    if (u < 0.78) {
      const d = u / 0.78;
      return clamp01(1.0 - d * d);
    }
    const b = (u - 0.78) / 0.22;
    return clamp01(Math.sin(b * Math.PI) * 0.045);
  }
  return 0.0;
}

/**
 * Outward-pulling (+Z) twin-door opening curve (0 = closed 0°, 1 = wide open 82°):
 *   0.00 – 2.30 s: strained breakaway crack 0° -> 12° (~0.1463) starting at 0.60 s
 *   2.30 – 4.60 s: heavy scraping outward swing 12° -> 82° (1.0) along forged iron floor rails
 *   4.60 – 5.35 s: resting wide open at 82° while Hero finishes entering Throne Hall
 *   5.35 – 5.75 s: smooth silent off-screen closure back to 0° behind Hero (`doorClosed` /
 *                  `doorFullyClosed = true` cleanly by 5.75 s, zero slam SFX/shake!)
 */
function evaluateDoorAngle01(t) {
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME) {
    if (t < 0.32) return 0.0;
    const flexU = (t - 0.32) / (BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME - 0.32);
    return 0.005 * smoothstep(flexU);
  }
  if (t < 1.48) {
    // First strained outward jerk tearing free of rust (0.5° -> 5.6°)
    const u = (t - BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME) / 0.88;
    const crack = smoothstep(u) * 0.85 + Math.pow(u, 2.05) * 0.15;
    const stickSlip = Math.sin(u * Math.PI * 3.0) * 0.003 * (1.0 - u);
    return clamp01(0.005 + (ACT1_DOOR_NORM * 0.47 - 0.005) * crack + stickSlip);
  }
  if (t < ACT1_END) {
    // Heavy grind up to 12° before second full-body pull
    const u = (t - 1.48) / (ACT1_END - 1.48);
    const resist = 1.0 - Math.pow(1.0 - u, 1.85);
    return clamp01(ACT1_DOOR_NORM * (0.47 + 0.53 * resist));
  }
  if (t < 4.32) {
    // Act 2 (2.30 – 4.32 s): C1-smooth pull-and-inertia outward swing (12° -> 82°)
    const u = (t - ACT1_END) / 2.02;
    let s;
    if (u < 0.30) {
      const p = u / 0.30;
      s = p * p * 0.28;
    } else {
      const v = (u - 0.30) / 0.70;
      const k = 1.8148148148;
      const g = (k - 2.0) * v * v * v + (3.0 - 2.0 * k) * v * v + k * v;
      s = 0.28 + 0.72 * g;
    }
    return clamp01(lerp(ACT1_DOOR_NORM, 1.0, s));
  }
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_OPEN_FULL_TIME) {
    // Subtle damped elastic settle at 82°
    const u = (t - 4.32) / (BOSS_DOOR_CUTSCENE_ACTS.DOOR_OPEN_FULL_TIME - 4.32);
    const rebound = Math.sin(u * Math.PI * 1.5) * (1.0 - u) * 0.011;
    return clamp01(1.0 - Math.abs(rebound));
  }
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_SLAM_TIME) {
    return 1.0;
  }
  if (t < 5.75) {
    // Smooth, monotonic silent off-screen closure (82° -> 0° over 0.40 s, zero rabbet bounce)
    const u = (t - BOSS_DOOR_CUTSCENE_ACTS.DOOR_SLAM_TIME) / 0.40;
    return clamp01(1.0 - smoothstep(u));
  }
  return 0.0;
}

/**
 * Live iron-on-iron rail friction spark intensity (0..1) beneath the bottom edges of both leaves:
 *   - 0.60–2.30 s: initial sparks as leaves tear loose across the forged floor plate (0.20..0.55)
 *   - 2.30–4.60 s: rich orange-white sparks during heavy outward scraping swing (12° -> 82°)
 *   - 0.0 from 4.60 s onward (off-screen door closure is silent and spark-free!).
 */
function evaluateDoorScrapeSparkIntensity(t) {
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME) return 0.0;
  if (t < ACT1_END) {
    const u = (t - BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME) / (ACT1_END - BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME);
    return clamp01((0.22 + 0.36 * Math.sin(u * Math.PI)) * smoothstep(u / 0.18));
  }
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_OPEN_FULL_TIME) {
    const u = (t - ACT1_END) / (BOSS_DOOR_CUTSCENE_ACTS.DOOR_OPEN_FULL_TIME - ACT1_END);
    const surge = Math.sin(clamp01(u / 0.88) * Math.PI);
    const tail = 1.0 - smoothstep((u - 0.78) / 0.22);
    return clamp01((0.35 + 0.62 * surge) * tail);
  }
  return 0.0;
}

/**
 * Physical leaf & iron hinge shudder intensity (0..1) — strictly 0.0 from 4.62 s onward
 * so off-screen closure and the entire Boss monologue have zero vibration/rumble.
 */
function evaluateDoorShudder(t) {
  if (t < 0.05) return 0.0;
  if (t < ACT1_END) {
    const boltBurst = pulseBell(t, 0.05, 0.90) * 0.54;
    const breakaway = pulseBell(t, 0.60, ACT1_END) * 0.72;
    return clamp01(0.18 + Math.max(boltBurst, breakaway) * 0.68);
  }
  if (t < 4.35) {
    const pullKick = pulseBell(t, ACT1_END, 2.95) * 0.52;
    const railGrind = Math.max(0, 1.0 - (t - 2.65) / 1.70) * 0.30;
    return clamp01(Math.max(pullKick, railGrind));
  }
  if (t < 4.62) {
    return clamp01(pulseBell(t, 4.30, 4.62) * 0.20);
  }
  return 0.0;
}

/**
 * Monotonic stone-dust burst stage (0..3):
 *   0: pre-touch
 *   1: bolt clank & keystone dust (t >= 0.12 s)
 *   2: outward breakaway crack 0° -> 12° dust (t >= 0.68 s)
 *   3: heavy rail-scrape swing dust cloud (t >= 2.35 s)
 *   (Intentionally omits stage 4 closing-slam burst during dialogue.)
 */
function evaluateDustBurstStage(t) {
  if (t >= 2.35) return 3;
  if (t >= 0.68) return 2;
  if (t >= 0.12) return 1;
  return 0;
}

/**
 * Monotonic door audio stage (0 | 1 | 2 | 3) matching soulsSpatialAudio & soulsGameFeel:
 *   1: bolt (0.05 s)
 *   2: outward pull strain (0.60 s)
 *   3: heavy scraping swing open (2.30 s)
 *   (Intentionally omits roar stage 4 and closing slam stage 5 so NO door-close noise or
 *    jarring slam shake triggers during the Boss intro cutscene!)
 */
function evaluateAudioCueStage(t) {
  if (t >= BOSS_DOOR_CUTSCENE_ACTS.DOOR_OPEN_TIME) return 3;
  if (t >= BOSS_DOOR_CUTSCENE_ACTS.DOOR_PUSH_TIME) return 2;
  if (t >= BOSS_DOOR_CUTSCENE_ACTS.DOOR_BOLT_TIME) return 1;
  return 0;
}

/**
 * Restrained, filmic camera shake (0..1):
 *   - Delicate micro-tremor ONLY on door shift/rail scrape (0.08–3.50 s)
 *     and the Boss's 2 heavy footsteps descending the Throne dais (BOSS_STEP1_TIME & BOSS_STEP2_TIME).
 *   - Strictly 0.0 during off-screen door closure, the entire Boss dialogue (3.50 – 40.07 s),
 *     and combat return!
 */
function evaluateCameraShake(t) {
  if (t <= 0.05 || t >= BOSS_DOOR_CUTSCENE_DURATION) return 0.0;

  if (t < 3.50) {
    const boltClank = pulseBell(t, 0.08, 0.68) * 0.24;
    const shiftStrain = pulseBell(t, 0.58, 2.32) * 0.34;
    const pullHeave = pulseBell(t, 2.28, 3.00) * 0.28;
    const railTail = t >= 2.65 && t < 3.50 ? lerp(0.14, 0.0, (t - 2.65) / 0.85) : 0.0;
    return clamp01(Math.max(boltClank, shiftStrain, pullHeave, railTail));
  }

  if (t >= BOSS_STEP1_TIME - 0.02 && t < BOSS_STEP2_TIME + 0.32) {
    const step1 = pulseBell(t, BOSS_STEP1_TIME - 0.02, BOSS_STEP1_TIME + 0.28) * 0.24;
    const step2 = pulseBell(t, BOSS_STEP2_TIME - 0.02, BOSS_STEP2_TIME + 0.32) * 0.30;
    return clamp01(Math.max(step1, step2));
  }

  return 0.0;
}

const _heroScratch = { x: 0, z: 0, mode: 'ready', effort: 0 };

/**
 * Silent Hero trajectory strictly relative to `rig` (`heroPushZ -> heroPullBackZ -> heroFinalZ`):
 *   0.00 – 2.30 s: right at the iron pull-rings, straining backward (`push`)
 *   2.30 – 3.15 s: full-body pull backward (`push`) as outward leaves break wide
 *   3.15 – 5.75 s: confident resolute stride into the illuminated Throne Hall (`walk_in`, 4 steps)
 *   5.75 – 43.20 s: stoic silent combat stance at `(0, heroFinalZ)` facing the Throne (`ready`)
 */
function evaluateHeroTrack(t, rig) {
  if (t < ACT1_END) {
    const ramp = smoothstep(t / 0.38);
    const strainBack = smoothstep(clamp01((t - 0.60) / (ACT1_END - 0.60)));
    const heaveWave = 0.5 + 0.5 * Math.sin(clamp01((t - 0.35) / 1.85) * Math.PI);
    _heroScratch.x = 0.0;
    _heroScratch.z = lerp(rig.heroPushZ, rig.heroPushZ + 0.35, strainBack);
    _heroScratch.mode = 'push';
    _heroScratch.effort = clamp01(0.32 + 0.68 * ramp * (0.72 + 0.28 * heaveWave));
    return _heroScratch;
  }
  if (t < BOSS_DOOR_CUTSCENE_ACTS.HERO_WALK_START_TIME) {
    const u = (t - ACT1_END) / (BOSS_DOOR_CUTSCENE_ACTS.HERO_WALK_START_TIME - ACT1_END);
    _heroScratch.x = 0.0;
    _heroScratch.z = lerp(rig.heroPushZ + 0.35, rig.heroPullBackZ, smoothstep(u));
    _heroScratch.mode = 'push';
    _heroScratch.effort = clamp01(0.96 - 0.28 * u);
    return _heroScratch;
  }
  if (t < 5.75) {
    const u = (t - BOSS_DOOR_CUTSCENE_ACTS.HERO_WALK_START_TIME)
      / (5.75 - BOSS_DOOR_CUTSCENE_ACTS.HERO_WALK_START_TIME);
    _heroScratch.x = 0.0;
    _heroScratch.z = lerp(rig.heroPullBackZ, rig.heroFinalZ, easeInOutSine(u));
    _heroScratch.mode = 'walk_in';
    _heroScratch.effort = 0.0;
    return _heroScratch;
  }
  _heroScratch.x = 0.0;
  _heroScratch.z = rig.heroFinalZ;
  _heroScratch.mode = 'ready';
  _heroScratch.effort = 0.0;
  return _heroScratch;
}

/**
 * 4 measured stone footsteps while the silent Hero walks from `heroPullBackZ` to `heroFinalZ` (3.15–5.75 s).
 */
function evaluateHeroStepCue(t) {
  if (t >= 5.42) return 4;
  if (t >= 4.76) return 3;
  if (t >= 4.10) return 2;
  if (t >= 3.45) return 1;
  return 0;
}

/**
 * 2 heavy armored Boss footsteps descending the Obsidian Throne dais (BOSS_STEP1_TIME & BOSS_STEP2_TIME).
 */
function evaluateBossStepCue(t) {
  if (t >= BOSS_STEP2_TIME) return 2;
  if (t >= BOSS_STEP1_TIME) return 1;
  return 0;
}

/**
 * Subtle leather & steel armor shift foley cues (0 | 1 | 2 | 3).
 */
function evaluateArmorShiftCue(t) {
  if (t >= BOSS_STANDUP_START) return 3;
  if (t >= ARMOR_SHIFT_2_TIME) return 2;
  if (t >= ARMOR_SHIFT_1_TIME) return 1;
  return 0;
}

/**
 * Normalized phase u ∈ [0..1] for `Throne_Intro_Dialogue` (`action.time = u * 20.0`).
 */
function evaluateBossDialogueU(t) {
  const n = DIALOGUE_U_KNOTS.length;
  if (t <= DIALOGUE_U_KNOTS[0].t) return DIALOGUE_U_KNOTS[0].u;
  if (t >= DIALOGUE_U_KNOTS[n - 1].t) return 1.0;
  for (let i = 0; i < n - 1; i++) {
    const a = DIALOGUE_U_KNOTS[i];
    const b = DIALOGUE_U_KNOTS[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = Math.max(1e-6, b.t - a.t);
      const s = smoothstep((t - a.t) / span);
      return lerp(a.u, b.u, s);
    }
  }
  return 1.0;
}

/**
 * Normalized phase u ∈ [0..1] for `Throne_Intro_StandUp` (exact 3.40 s).
 */
function evaluateBossStandupU(t) {
  if (t <= BOSS_STANDUP_START) return 0.0;
  if (t >= BOSS_STANDUP_END) return 1.0;
  return clamp01((t - BOSS_STANDUP_START) / BOSS_STANDUP_DURATION);
}

/**
 * Synchronized Boss root Z matching `Throne_Intro_StandUp` (`bossSitZ -> bossRiseZ -> bossFinalZ`).
 */
function evaluateBossTargetZ(standupU, rig) {
  const u = clamp01(standupU);
  if (u <= 0.24) return rig.bossSitZ;
  if (u <= 0.52) {
    const s = smoothstep((u - 0.24) / 0.28);
    return lerp(rig.bossSitZ, rig.bossRiseZ, s);
  }
  if (u <= 0.86) {
    const s = smoothstep((u - 0.52) / 0.34);
    return lerp(rig.bossRiseZ, rig.bossFinalZ, s);
  }
  return rig.bossFinalZ;
}

/**
 * Active voiceover cue entry (null during pauses or outside dialogue).
 */
function findActiveDialogueCue(t) {
  for (let i = 0; i < BOSS_INTRO_DIALOGUE_CUES.length; i++) {
    const cue = BOSS_INTRO_DIALOGUE_CUES[i];
    if (t >= cue.start && t < cue.end) return cue;
  }
  return null;
}

/**
 * Illuminated Throne Hall light spill through the opening portal (0..1).
 */
function evaluateLightBreakthrough01(t, doorAngle01) {
  if (t < 0.80) return 0.0;
  if (t < BOSS_DOOR_CUTSCENE_ACTS.DOOR_SLAM_TIME) {
    const crackGlow = smoothstep((t - 0.80) / 1.15) * 0.26;
    const openSpill = Math.pow(clamp01(doorAngle01), 0.72);
    return clamp01(Math.max(crackGlow, openSpill));
  }
  const closeFade = clamp01(1.0 - (t - BOSS_DOOR_CUTSCENE_ACTS.DOOR_SLAM_TIME) / 0.38);
  return clamp01(closeFade * closeFade);
}

/**
 * Smooth cinematic letterbox envelope (0 = hidden, 1 = full cinema bars).
 */
function evaluateLetterbox01(t) {
  if (t <= 0 || t >= BOSS_DOOR_CUTSCENE_DURATION) return 0.0;
  if (t < 0.42) return smoothstep(t / 0.42);
  if (t < LETTERBOX_OUT_START) return 1.0;
  const outSpan = BOSS_DOOR_CUTSCENE_DURATION - LETTERBOX_OUT_START;
  return 1.0 - smoothstep((t - LETTERBOX_OUT_START) / outSpan);
}

// ============================================================================
// Public Deterministic Camera Shake Offset Helper
// ============================================================================

/**
 * Computes a deterministic, restrained multi-frequency camera tremor offset for door opening shift
 * and Throne dais footsteps (returns strict zeros whenever shake === 0 during the dialogue).
 *
 * @param {number} elapsed - Seconds since cutscene start.
 * @param {number} shake - Normalized shake intensity (0..1) from evaluateBossDoorCutscene().
 * @param {{ x: number, y: number, z: number, roll: number }|null} [out] - Optional reusable target.
 * @returns {{ x: number, y: number, z: number, roll: number }}
 */
export function computeBossDoorCutsceneShakeOffset(elapsed, shake, out = null) {
  const target = out || { x: 0, y: 0, z: 0, roll: 0 };
  const s = clamp01(Number.isFinite(shake) ? shake : 0);
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  if (s <= 0.0005) {
    target.x = 0;
    target.y = 0;
    target.z = 0;
    target.roll = 0;
    return target;
  }

  const amp = 0.052 * s * (0.45 + 0.55 * s);
  const wx = Math.sin(t * 47.0) * 0.58 + Math.sin(t * 89.0 + 1.3) * 0.42;
  const wy = Math.cos(t * 59.0 + 0.6) * 0.62 + Math.sin(t * 103.0 + 2.1) * 0.38;
  const wz = Math.sin(t * 37.0 + 2.4) * 0.55 + Math.cos(t * 73.0 + 0.9) * 0.45;

  target.x = wx * amp;
  target.y = wy * amp * 0.76;
  target.z = wz * amp * 0.52;
  target.roll = (Math.sin(t * 41.0 + 0.4) * 0.6 + Math.cos(t * 79.0) * 0.4) * 0.008 * s;
  return target;
}

// ============================================================================
// Public Master Evaluator: evaluateBossDoorCutscene
// ============================================================================

/**
 * Evaluates the complete First-Boss Narrative Intro Cutscene state at timestamp `elapsed`.
 * Pure, deterministic, zero-allocation (when `options.out` is passed), V8/Browser/Node safe.
 *
 * @param {number} elapsed - Elapsed time in seconds (0 .. BOSS_DOOR_CUTSCENE_DURATION).
 * @param {{ x: number, y: number, z: number }|number[]|null} [startCamPos] - Camera position at t = 0.
 * @param {{ x: number, y: number, z: number }|number[]|null} [startCamLook] - Camera lookAt at t = 0.
 * @param {{ x: number, y: number, z: number }|number[]|null} [normalCamPos] - Normal combat camera behind hero at `(0, heroFinalZ)`.
 * @param {{ x: number, y: number, z: number }|number[]|null} [normalCamLook] - Normal combat camera lookAt for hero at `(0, heroFinalZ)`.
 * @param {{ normalFov?: number, startFov?: number, out?: object, rig?: object }|null} [options] - Optional FOV/scratch/rig overrides.
 */
export function evaluateBossDoorCutscene(
  elapsed,
  startCamPos = null,
  startCamLook = null,
  normalCamPos = null,
  normalCamLook = null,
  options = null
) {
  const rig = options && options.rig && Array.isArray(options.rig.camKnots) ? options.rig : DEFAULT_RIG;

  const rawElapsed = Number(elapsed);
  const safeElapsed = Number.isFinite(rawElapsed) ? Math.max(0, rawElapsed) : 0;
  const t = Math.min(safeElapsed, BOSS_DOOR_CUTSCENE_DURATION);
  const finished = safeElapsed >= BOSS_DOOR_CUTSCENE_DURATION;

  const normalFovRaw = Number(options?.normalFov);
  const normalFov = Number.isFinite(normalFovRaw) && normalFovRaw > 10 && normalFovRaw < 120
    ? normalFovRaw
    : BOSS_DOOR_CUTSCENE_ACTS.DEFAULT_NORMAL_FOV;

  const startFovRaw = Number(options?.startFov);
  const hasStartFov = Number.isFinite(startFovRaw) && startFovRaw > 10 && startFovRaw < 120;

  const knots = rig.camKnots;
  const k0 = knots[0];
  const kEnd = knots[knots.length - 1];

  const sPosX = readVec3X(startCamPos, k0.px);
  const sPosY = readVec3Y(startCamPos, k0.py);
  const sPosZ = readVec3Z(startCamPos, k0.pz);

  const sLookX = readVec3X(startCamLook, k0.lx);
  const sLookY = readVec3Y(startCamLook, k0.ly);
  const sLookZ = readVec3Z(startCamLook, k0.lz);

  const nPosX = readVec3X(normalCamPos, rig.defaultNormalCamPos.x);
  const nPosY = readVec3Y(normalCamPos, rig.defaultNormalCamPos.y);
  const nPosZ = readVec3Z(normalCamPos, rig.defaultNormalCamPos.z);

  const nLookX = readVec3X(normalCamLook, rig.defaultNormalCamLook.x);
  const nLookY = readVec3Y(normalCamLook, rig.defaultNormalCamLook.y);
  const nLookZ = readVec3Z(normalCamLook, rig.defaultNormalCamLook.z);

  let camPosX;
  let camPosY;
  let camPosZ;
  let camLookX;
  let camLookY;
  let camLookZ;
  let fov;
  let act;
  let actId;
  let actProgress;

  if (finished) {
    act = 5;
    actId = 'combat_handoff';
    actProgress = 1.0;
    camPosX = nPosX;
    camPosY = nPosY;
    camPosZ = nPosZ;
    camLookX = nLookX;
    camLookY = nLookY;
    camLookZ = nLookZ;
    fov = normalFov;
  } else if (t >= ACT4_END) {
    // Act 5: Silky smootherstep return into combat chase camera behind hero at (0, heroFinalZ)
    act = 5;
    actId = 'combat_handoff';
    const span = BOSS_DOOR_CUTSCENE_DURATION - ACT4_END;
    actProgress = clamp01((t - ACT4_END) / span);
    const w = smootherstep(actProgress);

    camPosX = lerp(kEnd.px, nPosX, w);
    camPosY = lerp(kEnd.py, nPosY, w);
    camPosZ = lerp(kEnd.pz, nPosZ, w);

    camLookX = lerp(kEnd.lx, nLookX, w);
    camLookY = lerp(kEnd.ly, nLookY, w);
    camLookZ = lerp(kEnd.lz, nLookZ, w);

    fov = lerp(kEnd.fov, normalFov, w);
  } else {
    // Acts 1–4: Single unbroken C1 Hermite camera spline
    const sample = sampleCameraSpline(t, rig);

    if (t < ACT1_END) {
      act = 1;
      actId = 'doors_push';
      actProgress = clamp01(t / ACT1_END);
    } else if (t < ACT2_END) {
      act = 2;
      actId = 'doors_enter';
      actProgress = clamp01((t - ACT1_END) / (ACT2_END - ACT1_END));
    } else if (t < BOSS_STANDUP_START) {
      act = 3;
      actId = 'throne_dialogue';
      actProgress = clamp01((t - ACT2_END) / (BOSS_STANDUP_START - ACT2_END));
    } else {
      act = 4;
      actId = 'boss_standup';
      actProgress = clamp01((t - BOSS_STANDUP_START) / (ACT4_END - BOSS_STANDUP_START));
    }

    if (t < 0.36) {
      const enterBlend = smootherstep(t / 0.36);
      camPosX = lerp(sPosX, sample.px, enterBlend);
      camPosY = lerp(sPosY, sample.py, enterBlend);
      camPosZ = lerp(sPosZ, sample.pz, enterBlend);
      camLookX = lerp(sLookX, sample.lx, enterBlend);
      camLookY = lerp(sLookY, sample.ly, enterBlend);
      camLookZ = lerp(sLookZ, sample.lz, enterBlend);
      fov = hasStartFov ? lerp(startFovRaw, sample.fov, smootherstep(t / 0.32)) : sample.fov;
    } else {
      camPosX = sample.px;
      camPosY = sample.py;
      camPosZ = sample.pz;
      camLookX = sample.lx;
      camLookY = sample.ly;
      camLookZ = sample.lz;
      fov = sample.fov;
    }
  }

  const doorAngle01 = finished ? 0.0 : evaluateDoorAngle01(t);
  const doorAngleDeg = doorAngle01 * MAX_DOOR_ANGLE_DEG;
  const boltLift01 = finished ? 0.0 : evaluateBoltLift01(t);
  const dustBurstStage = evaluateDustBurstStage(t);
  const shake = finished ? 0.0 : evaluateCameraShake(t);
  const doorShudder = finished ? 0.0 : evaluateDoorShudder(t);
  const doorScrapeSparkIntensity = finished ? 0.0 : evaluateDoorScrapeSparkIntensity(t);
  const hero = evaluateHeroTrack(t, rig);

  const bossDialogueU = evaluateBossDialogueU(t);
  const bossStandupU = evaluateBossStandupU(t);
  const bossTargetZ = evaluateBossTargetZ(bossStandupU, rig);
  const bossRiseTrigger = t >= BOSS_STANDUP_START;
  const bossTrigger = bossRiseTrigger ? 'intro_standup' : 'none';
  const bossAnimPhase =
    finished || t >= BOSS_STANDUP_END
      ? 'ready'
      : bossRiseTrigger
        ? 'standup'
        : 'dialogue';

  const activeCue = finished ? null : findActiveDialogueCue(t);
  const voiceCueIndex = activeCue ? activeCue.index : 0;
  const voiceLocalTime = activeCue ? Math.max(0, t - activeCue.start) : 0.0;
  const mouthOpen01 = voiceCueIndex > 0 ? sampleBossMouthOpen(voiceCueIndex, voiceLocalTime) : 0.0;
  const subtitleSpeaker = activeCue ? activeCue.speaker : '';
  const subtitleText = activeCue ? activeCue.text : '';
  let bossChuckleCue = false;
  if (!finished) {
    for (let ci = 0; ci < CHUCKLE_WINDOWS.length; ci++) {
      const cw = CHUCKLE_WINDOWS[ci];
      if (t >= cw.start && t < cw.end) {
        bossChuckleCue = true;
        break;
      }
    }
  }

  const armorShiftCue = evaluateArmorShiftCue(t);
  const heroStepCue = evaluateHeroStepCue(t);
  const bossStepCue = evaluateBossStepCue(t);

  const doorClosing = t >= BOSS_DOOR_CUTSCENE_ACTS.DOOR_SLAM_TIME;
  const doorFullyClosed = Boolean(finished || (doorClosing && doorAngle01 <= 0.005));
  const doorClosed = doorFullyClosed;
  // Silent off-screen Boss Hall closure: keep `doorSlam` false throughout the cutscene so neither
  // `soulsGameFeel.js` (`act4_door_slam`) nor audio listeners fire a jarring closing slam cue!
  const doorSlam = false;

  const showBossTitleCard = !finished && t >= TITLE_CARD_START && t < TITLE_CARD_END;
  const letterbox01 = evaluateLetterbox01(t);
  const showLetterbox = !finished && t < TOTAL_DURATION - 0.75;
  const canSkip = !finished && t >= BOSS_DOOR_CUTSCENE_SKIP_TIME;
  const lightBreakthrough01 = finished ? 0.0 : evaluateLightBreakthrough01(t, doorAngle01);
  const audioCueStage = evaluateAudioCueStage(t);

  const out = options && options.out && typeof options.out === 'object' ? options.out : {};
  if (!out.camPos || typeof out.camPos !== 'object') out.camPos = { x: 0, y: 0, z: 0 };
  if (!out.camLook || typeof out.camLook !== 'object') out.camLook = { x: 0, y: 0, z: 0 };

  out.camPos.x = camPosX;
  out.camPos.y = camPosY;
  out.camPos.z = camPosZ;

  out.camLook.x = camLookX;
  out.camLook.y = camLookY;
  out.camLook.z = camLookZ;

  // Core API fields (100% backward-compatible)
  out.fov = fov;
  out.shake = shake;
  out.doorAngle01 = doorAngle01;
  out.boltLift01 = boltLift01;
  out.dustBurstStage = dustBurstStage;
  out.heroTargetX = hero.x;
  out.heroTargetZ = hero.z;
  out.heroMode = hero.mode;
  out.bossTrigger = bossTrigger;
  out.doorSlam = doorSlam;
  out.showBossTitleCard = showBossTitleCard;
  out.canSkip = canSkip;
  out.finished = finished;

  // Narrative dialogue, lip-sync, chuckle, outward rail doors & step cues
  out.subtitleSpeaker = subtitleSpeaker;
  out.subtitleText = subtitleText;
  out.voiceCueIndex = voiceCueIndex;
  out.voiceLocalTime = voiceLocalTime;
  out.mouthOpen01 = mouthOpen01;
  out.bossChuckleCue = bossChuckleCue;
  out.doorScrapeSparkIntensity = doorScrapeSparkIntensity;
  out.doorPullDirection = BOSS_DOOR_CUTSCENE_ACTS.DOOR_PULL_DIRECTION;
  out.doorClosed = doorClosed;
  out.doorFullyClosed = doorFullyClosed;
  out.armorShiftCue = armorShiftCue;
  out.heroStepCue = heroStepCue;
  out.bossStepCue = bossStepCue;
  out.bossAnimPhase = bossAnimPhase;
  out.bossDialogueU = bossDialogueU;
  out.bossStandupU = bossStandupU;
  out.bossTargetZ = bossTargetZ;
  out.heroFinalZ = rig.heroFinalZ;
  out.bossFinalZ = rig.bossFinalZ;

  // Extended choreography & FX fields
  out.act = act;
  out.actId = actId;
  out.actProgress = actProgress;
  out.progress = clamp01(t / BOSS_DOOR_CUTSCENE_DURATION);
  out.doorAngleDeg = doorAngleDeg;
  out.doorAngleRad = doorAngleDeg * DEG_TO_RAD;
  out.doorShudder = doorShudder;
  out.lightBreakthrough01 = lightBreakthrough01;
  out.heroFacing = BOSS_DOOR_CUTSCENE_ACTS.HERO_FACING;
  out.heroPushEffort = hero.effort;
  out.bossRiseTrigger = bossRiseTrigger;
  out.bossRoarPeak = false;
  out.doorSlamTrigger = doorSlam;
  out.showLetterbox = showLetterbox;
  out.letterbox01 = letterbox01;
  out.audioCueStage = audioCueStage;
  out.bossTitleRu = BOSS_DOOR_CUTSCENE_ACTS.BOSS_TITLE_RU;
  out.bossSubtitleRu = BOSS_DOOR_CUTSCENE_ACTS.BOSS_SUBTITLE_RU;

  return out;
}

/**
 * Returns the canonical post-skip end state when skipped after 1.50 s ([Esc]/[Space]/tap):
 * hero at `(0, heroFinalZ)` in 'ready' stance, Boss standing at `(0, bossFinalZ)` in 'ready' stance,
 * doors fully closed & sealed (`doorFullyClosed = true`), voice/lip-sync/subtitles/title-card/
 * letterbox dismissed, camera & FOV restored to combat normal.
 */
export function getBossDoorCutsceneSkipState(normalCamPos = null, normalCamLook = null, options = null) {
  return evaluateBossDoorCutscene(
    BOSS_DOOR_CUTSCENE_DURATION,
    null,
    null,
    normalCamPos,
    normalCamLook,
    options
  );
}
