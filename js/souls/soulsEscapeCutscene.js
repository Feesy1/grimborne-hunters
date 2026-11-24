// Grimborne Hunters — Tight 25.8-Second Post-Boss Escape Cutscene Choreography («Escape from the Castle of Ash»)
// Pure Zero-Dependency Vanilla ES Module (zero per-frame allocations).
//
// Uses REAL battle-tested game animations (`Heavy_Thrust`, `Block`, `Impact`, `Block_React`, `Combo_Backhand_2`,
// `Combo_Sweep_1`, `Walking`, `Combo_Slam_3`) + 5 clean anatomically-verified escape clips
// (`Escape_Taunt_Speak`, `Cutscene_Knockdown_Scoot`, `Cutscene_Dodge_Fall`, `Cutscene_River_Float`, `Cutscene_Shore_WakeUp`),
// genuine ElevenLabs `speech boss v2` voiceover (`boss_escape_vo_01..03.mp3`), and native game SFX cues
// including real Boss footsteps (`bossStepCue`), armor shifts (`bossArmorCue`), and hero dodge roll (`heroRollCue`).

import {
  SOULS_CASTLE_CONSTANTS,
  SOULS_CASTLE_THRONE_CONFIG
} from './soulsCastleLayout.js?v=20261125z103';
import {
  BOSS_ESCAPE_VO_DURATIONS_SEC,
  sampleEscapeBossMouthOpen
} from './soulsEscapeAudio.js?v=20261125z103';

const BOSS_SPEAKER_RU = 'РЫЦАРЬ ПЕПЛА';
const LOCATION_TITLE_RU = 'БЕРЕГ ПЕПЕЛЬНОГО СТОКА';
const LOCATION_SUBTITLE_RU = 'ЗА СТЕНАМИ ЗАМКА ПЕПЛА';

// ============================================================================
// Master 25.80 s Timeline Constants (Zero Dead Air, 1:1 Audio/Anim Lock)
// ============================================================================
export const BOSS_ESCAPE_CUTSCENE_DURATION = 25.80;
export const BOSS_ESCAPE_CUTSCENE_SKIP_TIME = 1.50;

const ACT1_START = 0.00;
const ACT1_END   = 4.20;
const ACT2_START = 4.20;
const ACT2_END   = 13.00;
const ACT3_START = 13.00;
const ACT3_END   = 17.50;
const ACT4_START = 17.50;
const ACT4_END   = 21.80;
const ACT5_START = 21.80;
const ACT5_END   = BOSS_ESCAPE_CUTSCENE_DURATION;

// Hard-Cut Shot Boundaries (12 tight shots)
const SHOT_01_END  = 1.15;  // Shot 1: Hero lunge (Heavy_Thrust) & Boss shaft parry (Block_React)
const SHOT_02_END  = 2.55;  // Shot 2: Boss backhand sweep (Combo_Backhand_2) -> block & Oathblade disarm
const SHOT_03_END  = 4.20;  // Shot 3: Boss crushing sweep (Combo_Sweep_1) -> Hero knocked back onto carpet
const SHOT_04_END  = 6.90;  // Shot 4: Wide low side-3/4 dolly — Boss heavy Walking strides (4 footsteps!) + Hero crab-scoot + VO 1
const SHOT_05_END  = 10.10; // Shot 5: Clean worm's-eye Boss medium shot (full face & torso clear!) + VO 2
const SHOT_06_END  = 11.45; // Shot 6: Reverse low Hero close-up beside fallen sword (dread)
const SHOT_07_END  = 13.00; // Shot 7: Dramatic Boss push-in + enraged fire + VO 3 + overhead warhammer raise
const SHOT_08_END  = 14.55; // Shot 8: Carpet-level slow-mo side roll + earth-shattering Combo_Slam_3 floor smash @ 14.15s
const SHOT_09_END  = 16.30; // Shot 9: High 3/4 chasm collapse & Hero/sword plunge into abyss
const SHOT_10_END  = 17.50; // Shot 10: Iconic upward abyss shot from inside shaft
const SHOT_11A_END = 18.85; // Shot 11A: 360-degree stone shaft plunge toward black water
const SHOT_11B_END = 20.15; // Shot 11B: Water splash @ 18.85s + brief underwater submersion + resurface
const SHOT_11C_END = 21.80; // Shot 11C: Supine river float & iron grate smash @ 20.85s + fade out
const SHOT_12A_END = 23.80; // Shot 12A -> 12B: Wake-up on shore + crane reveal of Castle of Ash -> gameplay handoff

// Dramatic Beat Timestamps
const CLASH_1_TIME        = 0.68;
const CLASH_2_TIME        = 1.68;
const SWORD_DISARM_TIME   = 1.95;
const SWORD_LAND_TIME     = 2.55;
const KNOCKDOWN_CUE_TIME  = 2.85;
const SHIELD_DISARM_TIME  = 2.85;
const KNOCKDOWN_LAND_TIME = 3.65;

const BOSS_STEP_TIMES     = Object.freeze([4.40, 4.95, 5.75, 6.30]); // Exact Walking foot plants -> native playBossFootstep!
const BOSS_ARMOR_TIME     = 12.15;                                   // Warhammer 2H overhead raise -> playBossArmorShift!
const SCOOT_TIMES         = Object.freeze([4.60, 5.55, 6.50, 7.60, 8.75, 9.85]);

const VO1_START = 4.65;  // 1.935s -> 6.585s
const VO2_START = 7.05;  // 2.760s -> 9.810s
const VO3_START = 11.50; // 1.075s -> 12.575s

const BOSS_ENRAGED_FIRE_START = 11.55;
const BOSS_ENRAGED_FIRE_END   = 16.60;

const HERO_ROLL_CUE_TIME  = 13.20;
const SLOWMO_START_TIME   = 13.30;
const SLOWMO_END_TIME     = 13.95;
const FLOOR_SMASH_TIME    = 14.15;
const CHASM_OPEN_END_TIME = 14.80;
const CHASM_FALL_START    = 14.70;
const BOSS_SMASH_STANDOFF_Z = 2.95; // Boss feet stay +0.70m BEHIND the solid north rim of 2.25m hole!

const SHAFT_TRANSITION_TIME = ACT4_START;
const WATER_SPLASH_TIME     = 18.85;
const UNDERWATER_END_TIME   = 19.95;
const GRATE_BREAK_TIME      = 20.85;
const FADE_OUT_START_TIME   = 21.30;
const SHORE_TRANSITION_TIME = ACT5_START;
const SHORE_WAKE_CUE_TIME   = 21.85;
const FADE_IN_END_TIME      = 22.45;
const LOCATION_CARD_START   = 22.65;
const LOCATION_CARD_END     = 25.45;
const LETTERBOX_OUT_START   = 24.85;

// Exterior Shore Canonical Anchors (1:1 Aligned with `soulsExteriorShore.js`)
const SHORE_WAKE_X = 0.0;
const SHORE_WAKE_Y = 0.0;
const SHORE_WAKE_Z = 2.5;
const SHORE_WAKE_FACING = Math.PI;
const FINAL_CAM_YAW = 0.0;

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

const DEFAULT_NORMAL_FOV = 52.0;

const DEFAULT_VO_DURATIONS_SEC = Object.freeze({
  1: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[1]) || 1.935,
  2: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[2]) || 2.760,
  3: Number(BOSS_ESCAPE_VO_DURATIONS_SEC?.[3]) || 1.075
});

const VO_RAW_SPECS = Object.freeze([
  Object.freeze({
    index: 1,
    start: VO1_START,
    file: 'boss_escape_vo_01.mp3',
    text: 'Хех... Уже уходишь, гость?',
    textEn: '[chuckle] Leaving so soon, guest?'
  }),
  Object.freeze({
    index: 2,
    start: VO2_START,
    file: 'boss_escape_vo_02.mp3',
    text: 'Хм... О, не делай такое удивлённое лицо.',
    textEn: "[scoff] Oh, don't look so surprised."
  }),
  Object.freeze({
    index: 3,
    start: VO3_START,
    file: 'boss_escape_vo_03.mp3',
    text: 'Отправляйся вниз.',
    textEn: 'Down below you go.'
  })
]);

let _externalVoDurations = null;
let _externalMouthSampler = null;

function round3(v) { return Math.round(v * 1000) / 1000; }

function buildDialogueCues(durationsMap) {
  const src = durationsMap || DEFAULT_VO_DURATIONS_SEC;
  const out = new Array(VO_RAW_SPECS.length);
  for (let i = 0; i < VO_RAW_SPECS.length; i++) {
    const spec = VO_RAW_SPECS[i];
    const nextSpec = i + 1 < VO_RAW_SPECS.length ? VO_RAW_SPECS[i + 1] : null;
    const rawDur = Number(src[spec.index]);
    const dur = Number.isFinite(rawDur) && rawDur > 0.2 ? round3(rawDur) : DEFAULT_VO_DURATIONS_SEC[spec.index];
    const maxEnd = nextSpec ? round3(nextSpec.start - 0.08) : round3(ACT2_END - 0.05);
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

export const BOSS_ESCAPE_SHOTS = Object.freeze([
  Object.freeze({ cutId: 1,  id: 'shot_01_parry_clash',       act: 1, stageMode: 'castle',         tStart: 0.00,        tEnd: SHOT_01_END  }),
  Object.freeze({ cutId: 2,  id: 'shot_02_shield_disarm',     act: 1, stageMode: 'castle',         tStart: SHOT_01_END, tEnd: SHOT_02_END  }),
  Object.freeze({ cutId: 3,  id: 'shot_03_knockdown_wide',    act: 1, stageMode: 'castle',         tStart: SHOT_02_END, tEnd: SHOT_03_END  }),
  Object.freeze({ cutId: 4,  id: 'shot_04_scoot_dolly',       act: 2, stageMode: 'castle',         tStart: SHOT_03_END, tEnd: SHOT_04_END  }),
  Object.freeze({ cutId: 5,  id: 'shot_05_boss_wormseye',     act: 2, stageMode: 'castle',         tStart: SHOT_04_END, tEnd: SHOT_05_END  }),
  Object.freeze({ cutId: 6,  id: 'shot_06_hero_reverse',      act: 2, stageMode: 'castle',         tStart: SHOT_05_END, tEnd: SHOT_06_END  }),
  Object.freeze({ cutId: 7,  id: 'shot_07_boss_enrage',       act: 2, stageMode: 'castle',         tStart: SHOT_06_END, tEnd: SHOT_07_END  }),
  Object.freeze({ cutId: 8,  id: 'shot_08_slowmo_dodge_smash',act: 3, stageMode: 'castle',         tStart: SHOT_07_END, tEnd: SHOT_08_END  }),
  Object.freeze({ cutId: 9,  id: 'shot_09_chasm_collapse',    act: 3, stageMode: 'castle',         tStart: SHOT_08_END, tEnd: SHOT_09_END  }),
  Object.freeze({ cutId: 10, id: 'shot_10_abyss_upward',      act: 3, stageMode: 'castle',         tStart: SHOT_09_END, tEnd: SHOT_10_END  }),
  Object.freeze({ cutId: 11, id: 'shot_11a_shaft_plunge',     act: 4, stageMode: 'shaft_river',    tStart: SHOT_10_END, tEnd: SHOT_11A_END }),
  Object.freeze({ cutId: 12, id: 'shot_11b_water_underwater', act: 4, stageMode: 'shaft_river',    tStart: SHOT_11A_END,tEnd: SHOT_11B_END }),
  Object.freeze({ cutId: 13, id: 'shot_11c_grate_smash',      act: 4, stageMode: 'shaft_river',    tStart: SHOT_11B_END,tEnd: SHOT_11C_END }),
  Object.freeze({ cutId: 14, id: 'shot_12_shore_vista',       act: 5, stageMode: 'exterior_shore', tStart: SHOT_11C_END,tEnd: ACT5_END     })
]);

export function setBossEscapeVoiceProvider(voDurations = null, sampleMouthOpenFn = null) {
  _externalVoDurations = voDurations && typeof voDurations === 'object' ? voDurations : null;
  _externalMouthSampler = typeof sampleMouthOpenFn === 'function' ? sampleMouthOpenFn : null;
}

export const BOSS_ESCAPE_ACTS = Object.freeze({
  DURATION: BOSS_ESCAPE_CUTSCENE_DURATION,
  SKIP_UNLOCK_TIME: BOSS_ESCAPE_CUTSCENE_SKIP_TIME,
  ACT1_START, ACT1_END, ACT2_START, ACT2_END, ACT3_START, ACT3_END,
  ACT4_START, ACT4_END, ACT5_START, ACT5_END,
  CLASH_1_TIME, CLASH_2_TIME, SWORD_DISARM_TIME, SWORD_LAND_TIME,
  SHIELD_DISARM_TIME, KNOCKDOWN_CUE_TIME, KNOCKDOWN_LAND_TIME,
  VO1_START, VO2_START, VO3_START,
  SLOWMO_START_TIME, SLOWMO_END_TIME, FLOOR_SMASH_TIME,
  SHAFT_TRANSITION_TIME, WATER_SPLASH_TIME, UNDERWATER_END_TIME,
  GRATE_BREAK_TIME, SHORE_TRANSITION_TIME, SHORE_WAKE_CUE_TIME,
  SHORE_WAKE_X, SHORE_WAKE_Y, SHORE_WAKE_Z, SHORE_WAKE_FACING, FINAL_CAM_YAW,
  SHORE_SWORD_X, SHORE_SWORD_Y, SHORE_SWORD_Z,
  SHORE_BONFIRE_X, SHORE_BONFIRE_Y, SHORE_BONFIRE_Z,
  SHORE_GATE_X, SHORE_GATE_Y, SHORE_GATE_Z,
  SHORE_WATERFALL_X, SHORE_WATERFALL_Y, SHORE_WATERFALL_Z,
  SHORE_CASTLE_VISTA_X, SHORE_CASTLE_VISTA_Y, SHORE_CASTLE_VISTA_Z,
  LOCATION_TITLE_RU, LOCATION_SUBTITLE_RU, BOSS_SPEAKER_RU,
  SHOT_COUNT: BOSS_ESCAPE_SHOTS.length
});

// ============================================================================
// Pure Zero-GC Math Helpers
// ============================================================================
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function clamp01(v) { return v <= 0 ? 0 : v >= 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { const x = clamp01(t); return x * x * (3 - 2 * x); }
function smootherstep(t) { const x = clamp01(t); return x * x * x * (x * (x * 6 - 15) + 10); }
function easeOutCubic(t) { const u = 1 - clamp01(t); return 1 - u * u * u; }
function easeInQuad(t) { const x = clamp01(t); return x * x; }
function seg01(t, t0, t1) { return t1 <= t0 ? (t >= t0 ? 1 : 0) : clamp01((t - t0) / (t1 - t0)); }

function setV3(dst, x, y, z) { dst.x = x; dst.y = y; dst.z = z; }
function lerpV3(dst, ax, ay, az, bx, by, bz, s) {
  dst.x = ax + (bx - ax) * s;
  dst.y = ay + (by - ay) * s;
  dst.z = az + (bz - az) * s;
}

function countPassed(t, arr) {
  let c = 0;
  for (let i = 0; i < arr.length; i++) if (t >= arr[i]) c++;
  return c;
}

// ============================================================================
// Rig & State Factories
// ============================================================================
export function createBossEscapeCutsceneRig(bossAnchorX = 0, bossAnchorZ = null, opts = null) {
  const centerZ = Number(SOULS_CASTLE_CONSTANTS?.BOSS_CENTER_Z ?? -48.0);
  const doorZ = Number(SOULS_CASTLE_CONSTANTS?.BOSS_DOOR_Z ?? -29.0);
  const sitZ = Number(SOULS_CASTLE_THRONE_CONFIG?.sitZ ?? (centerZ - 9.0));

  const ax = Number.isFinite(Number(bossAnchorX)) ? clamp(Number(bossAnchorX), -2.5, 2.5) : 0.0;
  const minSafeZ = sitZ + 5.0;
  const maxSafeZ = doorZ - 11.0;
  const rawZ = Number.isFinite(Number(bossAnchorZ)) ? Number(bossAnchorZ) : (centerZ - 1.0);
  const az = clamp(rawZ, minSafeZ, maxSafeZ);

  const bossStartZ = round3(az - 1.40);
  const bossFinalZ = round3(bossStartZ + 2.15); // Advances 2.15m during 2 Walking cycles
  const heroStartZ = round3(bossStartZ + 3.40); // Generous clash distance -> 0 hammer-through-helmet clipping!
  const heroClashZ = round3(bossStartZ + 2.65);
  const heroLandZ  = round3(bossStartZ + 5.05);
  const heroScootEndZ = round3(bossFinalZ + BOSS_SMASH_STANDOFF_Z); // Exact center of floor hole (+2.95m south of Boss!)
  const floorHoleX = round3(ax);
  const floorHoleZ = round3(heroScootEndZ);
  const swordLandX = round3(ax + 1.85);
  const swordLandZ = round3(bossStartZ + 4.40);

  const dialogueCues = buildDialogueCues(opts?.voDurations || _externalVoDurations || DEFAULT_VO_DURATIONS_SEC);
  const mouthSampler = typeof opts?.sampleMouthOpen === 'function'
    ? opts.sampleMouthOpen
    : (_externalMouthSampler || sampleEscapeBossMouthOpen);

  return {
    anchorX: round3(ax),
    anchorZ: round3(az),
    bossStartZ,
    bossFinalZ,
    heroStartZ,
    heroClashZ,
    heroLandZ,
    heroScootEndZ,
    floorHoleX,
    floorHoleZ,
    swordLandX,
    swordLandZ,
    dialogueCues,
    mouthSampler
  };
}

export function createBossEscapeCutsceneState() {
  return {
    active: false,
    finished: false,
    canSkip: false,
    t: 0,
    duration: BOSS_ESCAPE_CUTSCENE_DURATION,
    act: 1,
    stageMode: 'castle',
    cameraCutId: 1,
    shotId: 'shot_01_parry_clash',
    camPos: { x: 0, y: 2.2, z: -40 },
    camLook: { x: 0, y: 1.5, z: -46 },
    camFov: DEFAULT_NORMAL_FOV,
    camRoll: 0,
    letterbox01: 0,
    fadeToBlack01: 0,
    underwater01: 0,
    impactFlash01: 0,
    slowMoFactor: 1.0,
    hitstopSec: 0,
    screenShake: 0,
    heroX: 0, heroY: 0, heroZ: -44, heroFacing: Math.PI,
    heroAnimName: 'Heavy_Thrust',
    heroAnimU: 0,
    swordDisarmed: false,
    shieldDisarmed: false,
    bossVisible: true,
    bossX: 0, bossY: 0, bossZ: -48, bossFacing: 0,
    bossAnimName: 'Block_React',
    bossAnimU: 0,
    bossMouthOpen01: 0,
    bossEnragedFire: false,
    droppedSword: { visible: false, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    floorHoleProgress: 0,
    floorHoleX: 0,
    floorHoleZ: -45,
    grateBroken: false,
    subtitleSpeaker: '',
    subtitleText: '',
    voiceCueIndex: 0,
    showLocationCard: false,
    locationTitleRu: LOCATION_TITLE_RU,
    locationSubtitleRu: LOCATION_SUBTITLE_RU,
    finalCamYaw: FINAL_CAM_YAW,
    cues: {
      voiceCue: 0,
      clashCue: 0,
      disarmCue: 0,
      knockdownCue: 0,
      scootCue: 0,
      bossStepCue: 0,
      bossArmorCue: 0,
      heroRollCue: 0,
      slowMoCue: 0,
      floorSmashCue: 0,
      waterSplashCue: 0,
      grateBreakCue: 0,
      shoreWakeCue: 0
    }
  };
}

// ============================================================================
// Master Zero-GC Frame Sampler
// ============================================================================
export function sampleBossEscapeCutscene(rig, elapsedSec = 0, out = null, opts = null) {
  const r = rig || createBossEscapeCutsceneRig(0);
  const st = out || createBossEscapeCutsceneState();
  const t = clamp(Number(elapsedSec) || 0, 0, BOSS_ESCAPE_CUTSCENE_DURATION);

  const normPos = opts?.normalCamPos || { x: 0, y: 3.15, z: 8.20 };
  const normLook = opts?.normalCamLook || { x: 0, y: 1.65, z: 2.50 };
  const normFov = Number(opts?.normalFov) || DEFAULT_NORMAL_FOV;

  st.t = t;
  st.duration = BOSS_ESCAPE_CUTSCENE_DURATION;
  st.finished = t >= BOSS_ESCAPE_CUTSCENE_DURATION - 1e-4;
  st.active = !st.finished;
  st.canSkip = t >= BOSS_ESCAPE_CUTSCENE_SKIP_TIME;
  st.finalCamYaw = FINAL_CAM_YAW;
  st.locationTitleRu = LOCATION_TITLE_RU;
  st.locationSubtitleRu = LOCATION_SUBTITLE_RU;

  // Letterbox bars (smooth in 0..0.35s, retract cleanly 24.85..25.80s)
  if (t < 0.35) st.letterbox01 = smoothstep(t / 0.35);
  else if (t >= LETTERBOX_OUT_START) st.letterbox01 = 1.0 - smoothstep((t - LETTERBOX_OUT_START) / (ACT5_END - LETTERBOX_OUT_START));
  else st.letterbox01 = 1.0;

  // Fade to black across tunnel-exit -> exterior-shore cut (21.30 -> 21.80 -> 22.45s)
  if (t >= FADE_OUT_START_TIME && t < SHORE_TRANSITION_TIME) {
    st.fadeToBlack01 = smoothstep((t - FADE_OUT_START_TIME) / (SHORE_TRANSITION_TIME - FADE_OUT_START_TIME));
  } else if (t >= SHORE_TRANSITION_TIME && t < FADE_IN_END_TIME) {
    st.fadeToBlack01 = 1.0 - smoothstep((t - SHORE_TRANSITION_TIME) / (FADE_IN_END_TIME - SHORE_TRANSITION_TIME));
  } else {
    st.fadeToBlack01 = 0;
  }

  // Subtle underwater vignette only during brief dip (18.95..19.95s)
  if (t >= WATER_SPLASH_TIME + 0.10 && t < UNDERWATER_END_TIME) {
    const uIn = smoothstep((t - (WATER_SPLASH_TIME + 0.10)) / 0.16);
    const uOut = 1.0 - smoothstep((t - (UNDERWATER_END_TIME - 0.30)) / 0.30);
    st.underwater01 = uIn * uOut;
  } else {
    st.underwater01 = 0;
  }

  // Clean brief slow-mo during dodge roll (13.30..13.95s)
  if (t >= SLOWMO_START_TIME && t <= SLOWMO_END_TIME) {
    const w = Math.sin(seg01(t, SLOWMO_START_TIME, SLOWMO_END_TIME) * Math.PI);
    st.slowMoFactor = lerp(1.0, 0.38, w);
  } else {
    st.slowMoFactor = 1.0;
  }

  // Subtle impact flash ONLY on clash 1, clash 2, floor smash (no strobe!)
  let flash = 0;
  for (const bt of [CLASH_1_TIME, CLASH_2_TIME, FLOOR_SMASH_TIME]) {
    const dt = t - bt;
    if (dt >= 0 && dt < 0.16) flash = Math.max(flash, (1.0 - dt / 0.16) * (bt === FLOOR_SMASH_TIME ? 0.55 : 0.28));
  }
  st.impactFlash01 = flash;
  st.hitstopSec = 0;

  // Monotonic Audio / VFX Cues
  const cues = st.cues;
  cues.clashCue      = (t >= CLASH_2_TIME ? 2 : (t >= CLASH_1_TIME ? 1 : 0));
  cues.disarmCue     = t >= SWORD_DISARM_TIME ? 1 : 0;
  cues.knockdownCue  = t >= KNOCKDOWN_CUE_TIME ? 1 : 0;
  cues.scootCue      = countPassed(t, SCOOT_TIMES);
  cues.bossStepCue   = countPassed(t, BOSS_STEP_TIMES);
  cues.bossArmorCue  = t >= BOSS_ARMOR_TIME ? 1 : 0;
  cues.heroRollCue   = t >= HERO_ROLL_CUE_TIME ? 1 : 0;
  cues.slowMoCue     = t >= SLOWMO_START_TIME ? 1 : 0;
  cues.floorSmashCue = t >= FLOOR_SMASH_TIME ? 1 : 0;
  cues.waterSplashCue = t >= WATER_SPLASH_TIME ? 1 : 0;
  cues.grateBreakCue = t >= GRATE_BREAK_TIME ? 1 : 0;
  cues.shoreWakeCue  = t >= SHORE_WAKE_CUE_TIME ? 1 : 0;

  // Authentic speech boss v2 dialogue & 30-FPS lip-sync
  let activeCue = null;
  let passedVo = 0;
  for (let i = 0; i < r.dialogueCues.length; i++) {
    const c = r.dialogueCues[i];
    if (t >= c.start) passedVo = c.index;
    if (t >= c.start && t <= c.end + 0.18) activeCue = c;
  }
  cues.voiceCue = passedVo;
  if (activeCue) {
    st.voiceCueIndex = activeCue.index;
    st.subtitleSpeaker = activeCue.speaker;
    st.subtitleText = activeCue.text;
    st.bossMouthOpen01 = r.mouthSampler(activeCue.index, t - activeCue.start);
  } else {
    st.voiceCueIndex = 0;
    st.subtitleSpeaker = '';
    st.subtitleText = '';
    st.bossMouthOpen01 = 0;
  }

  st.showLocationCard = t >= LOCATION_CARD_START && t <= LOCATION_CARD_END;
  st.floorHoleX = r.floorHoleX;
  st.floorHoleZ = r.floorHoleZ;
  st.floorHoleProgress = t >= FLOOR_SMASH_TIME && t < ACT4_START
    ? easeOutCubic(seg01(t, FLOOR_SMASH_TIME, CHASM_OPEN_END_TIME))
    : 0;
  st.grateBroken = t >= GRATE_BREAK_TIME;
  st.bossEnragedFire = t >= BOSS_ENRAGED_FIRE_START && t <= BOSS_ENRAGED_FIRE_END;
  st.swordDisarmed = t >= SWORD_DISARM_TIME;
  st.shieldDisarmed = t >= SHIELD_DISARM_TIME && t < ACT5_START;

  // Determine active shot
  let shot = BOSS_ESCAPE_SHOTS[BOSS_ESCAPE_SHOTS.length - 1];
  for (let i = 0; i < BOSS_ESCAPE_SHOTS.length; i++) {
    if (t < BOSS_ESCAPE_SHOTS[i].tEnd) { shot = BOSS_ESCAPE_SHOTS[i]; break; }
  }
  st.act = shot.act;
  st.stageMode = shot.stageMode;
  st.cameraCutId = shot.cutId;
  st.shotId = shot.id;
  st.camRoll = 0;
  st.screenShake = 0;

  const ax = r.anchorX;

  // ==========================================================================
  // CASTLE STAGE (Acts 1 – 3: 0.00 – 17.50 s)
  // ==========================================================================
  if (t < ACT4_START) {
    st.bossVisible = true;
    st.bossX = ax;
    st.bossY = 0;
    st.bossFacing = 0; // Facing South (+Z) toward Hero

    // Boss Z progression: stands firm in Act 1, takes 2 heavy Walking strides in Shot 4, plants solidly behind chasm rim!
    if (t < ACT2_START) {
      st.bossZ = r.bossStartZ;
    } else if (t < SHOT_04_END) {
      st.bossZ = lerp(r.bossStartZ, r.bossFinalZ, smoothstep(seg01(t, ACT2_START, SHOT_04_END)));
    } else {
      st.bossZ = r.bossFinalZ;
    }

    // Boss Animation Selection (REAL z90 clips + clean Escape_Taunt_Speak!)
    if (t < SHOT_01_END) {
      st.bossAnimName = 'Block_React';
      st.bossAnimU = lerp(0.08, 0.88, seg01(t, 0.0, SHOT_01_END));
    } else if (t < SHOT_02_END) {
      st.bossAnimName = 'Combo_Backhand_2';
      st.bossAnimU = lerp(0.0, 0.94, seg01(t, SHOT_01_END, SHOT_02_END));
    } else if (t < ACT2_START) {
      st.bossAnimName = 'Combo_Sweep_1';
      st.bossAnimU = lerp(0.0, 0.92, seg01(t, SHOT_02_END, ACT2_START));
    } else if (t < SHOT_04_END) {
      // 2 grounded cycles of REAL Walking (1.35s each = 2.70s exact!)
      st.bossAnimName = 'Walking';
      st.bossAnimU = ((t - ACT2_START) / 1.35) % 1.0;
    } else if (t < BOSS_ARMOR_TIME) {
      // Clean Idle-layered Escape_Taunt_Speak (6.00s mapped smoothly over 6.90..12.15s = 5.25s!)
      st.bossAnimName = 'Escape_Taunt_Speak';
      st.bossAnimU = seg01(t, SHOT_04_END, BOSS_ARMOR_TIME);
    } else {
      // REAL z90 Combo_Slam_3:
      //   12.15..13.85s -> slow menacing raise overhead (u: 0.00 -> 0.50)
      //   13.85..14.15s -> explosive downward whip slam (u: 0.50 -> 0.65 impact!)
      //   14.15..16.10s -> hold warhammer buried in shattered floor rim (u: 0.65 -> 0.78)
      //   16.10..17.50s -> slow ominous pull-up watching Hero plunge (u: 0.78 -> 0.94)
      st.bossAnimName = 'Combo_Slam_3';
      if (t < 13.85) {
        st.bossAnimU = lerp(0.0, 0.50, smoothstep(seg01(t, BOSS_ARMOR_TIME, 13.85)));
      } else if (t < FLOOR_SMASH_TIME) {
        st.bossAnimU = lerp(0.50, 0.65, easeInQuad(seg01(t, 13.85, FLOOR_SMASH_TIME)));
      } else if (t < 16.10) {
        st.bossAnimU = lerp(0.65, 0.78, seg01(t, FLOOR_SMASH_TIME, 16.10));
      } else {
        st.bossAnimU = lerp(0.78, 0.94, smoothstep(seg01(t, 16.10, ACT4_START)));
      }
    }

    // Hero Position & Animation in Castle
    st.heroFacing = Math.PI; // Facing North (-Z) toward Boss
    if (t < SHOT_01_END) {
      // Lunge forward with real Heavy_Thrust
      st.heroX = ax;
      st.heroY = 0;
      st.heroZ = lerp(r.heroStartZ, r.heroClashZ, smoothstep(seg01(t, 0.0, CLASH_1_TIME)));
      st.heroAnimName = 'Heavy_Thrust';
      st.heroAnimU = lerp(0.0, 0.88, seg01(t, 0.0, SHOT_01_END));
    } else if (t < 1.72) {
      // Raise shield for Boss's counter-sweep (real Block)
      st.heroX = ax;
      st.heroY = 0;
      st.heroZ = lerp(r.heroClashZ, r.heroClashZ + 0.35, smoothstep(seg01(t, SHOT_01_END, 1.72)));
      st.heroAnimName = 'Block';
      st.heroAnimU = lerp(0.15, 0.55, seg01(t, SHOT_01_END, 1.72));
    } else if (t < SHOT_02_END) {
      // Guard shattered -> sword disarmed (real Impact!)
      st.heroX = ax;
      st.heroY = 0;
      st.heroZ = lerp(r.heroClashZ + 0.35, r.heroClashZ + 0.85, easeOutCubic(seg01(t, 1.72, SHOT_02_END)));
      st.heroAnimName = 'Impact';
      st.heroAnimU = lerp(0.0, 0.52, seg01(t, 1.72, SHOT_02_END));
    } else if (t < ACT2_START) {
      // Knocked back onto buttocks on crimson carpet (`Cutscene_Knockdown_Scoot` 0.0..1.20s -> u: 0.0..0.15)
      const kFlight = easeOutCubic(seg01(t, KNOCKDOWN_CUE_TIME, KNOCKDOWN_LAND_TIME));
      st.heroX = ax;
      st.heroY = Math.sin(seg01(t, KNOCKDOWN_CUE_TIME, KNOCKDOWN_LAND_TIME) * Math.PI) * 0.48;
      st.heroZ = lerp(r.heroClashZ + 0.85, r.heroLandZ, kFlight);
      st.heroAnimName = 'Cutscene_Knockdown_Scoot';
      st.heroAnimU = lerp(0.0, 0.15, seg01(t, SHOT_02_END, ACT2_START));
    } else if (t < ACT3_START) {
      // Active crab-scooting back across carpet (`Cutscene_Knockdown_Scoot` u: 0.15 -> 0.98)
      const scootFrac = smoothstep(seg01(t, ACT2_START, 10.60));
      st.heroX = ax;
      st.heroY = 0;
      st.heroZ = lerp(r.heroLandZ, r.heroScootEndZ, scootFrac);
      st.heroAnimName = 'Cutscene_Knockdown_Scoot';
      st.heroAnimU = lerp(0.15, 0.98, seg01(t, ACT2_START, ACT3_START));
    } else {
      // Act 3: Clean lateral side roll away from hammer -> floor shatters -> plunge into abyss!
      st.heroAnimName = 'Cutscene_Dodge_Fall';
      if (t < CHASM_FALL_START) {
        const dodgeK = smootherstep(seg01(t, HERO_ROLL_CUE_TIME, FLOOR_SMASH_TIME + 0.15));
        st.heroX = lerp(ax, ax - 1.38, dodgeK);
        st.heroY = 0;
        st.heroZ = lerp(r.heroScootEndZ, r.heroScootEndZ + 0.30, dodgeK);
        st.heroAnimU = lerp(0.0, 0.24, seg01(t, ACT3_START, CHASM_FALL_START));
      } else {
        const fallS = seg01(t, CHASM_FALL_START, ACT4_START);
        st.heroX = lerp(ax - 1.38, ax - 0.15, smoothstep(fallS));
        st.heroZ = lerp(r.heroScootEndZ + 0.30, r.floorHoleZ + 0.10, smoothstep(fallS));
        st.heroY = -14.8 * easeInQuad(fallS);
        st.heroAnimU = lerp(0.24, 0.82, fallS);
      }
    }

    // Flying & fallen 3D Oath Broadsword (clears Hero by >= 0.75m, then slides into chasm!)
    const ds = st.droppedSword;
    if (t >= SWORD_DISARM_TIME) {
      ds.visible = true;
      if (t < SWORD_LAND_TIME) {
        const sf = seg01(t, SWORD_DISARM_TIME, SWORD_LAND_TIME);
        ds.x = lerp(ax + 0.68, r.swordLandX, sf);
        ds.z = lerp(r.heroClashZ + 0.45, r.swordLandZ, sf);
        ds.y = lerp(1.15, 0.06, sf) + Math.sin(sf * Math.PI) * 1.35;
        ds.rx = sf * Math.PI * 2.5;
        ds.ry = sf * Math.PI * 1.4;
        ds.rz = Math.PI * 0.5;
      } else if (t < CHASM_FALL_START + 0.15) {
        ds.x = r.swordLandX;
        ds.y = 0.055;
        ds.z = r.swordLandZ;
        ds.rx = Math.PI * 0.5;
        ds.ry = 0.55;
        ds.rz = 0.12;
      } else {
        const sf = seg01(t, CHASM_FALL_START + 0.15, ACT4_START);
        ds.x = lerp(r.swordLandX, r.floorHoleX + 0.55, smoothstep(sf));
        ds.z = lerp(r.swordLandZ, r.floorHoleZ - 0.20, smoothstep(sf));
        ds.y = 0.055 - 14.5 * easeInQuad(sf);
        ds.rx = Math.PI * 0.5 + sf * 4.2;
        ds.ry = 0.55 + sf * 3.1;
        ds.rz = 0.12 + sf * 2.4;
      }
    } else {
      ds.visible = false;
    }

    // Castle Camera Shots (Clean, Unobstructed Framing — ZERO shoulder-in-lens!)
    const bz = st.bossZ;
    const hz = st.heroZ;
    if (shot.cutId === 1) {
      const s = seg01(t, 0.0, SHOT_01_END);
      lerpV3(st.camPos, ax + 3.2, 1.85, hz + 2.1, ax + 2.75, 1.65, hz + 1.4, smoothstep(s));
      lerpV3(st.camLook, ax, 1.55, (bz + hz) * 0.5, ax, 1.65, (bz + hz) * 0.5, s);
      st.camFov = 48;
    } else if (shot.cutId === 2) {
      const s = seg01(t, SHOT_01_END, SHOT_02_END);
      lerpV3(st.camPos, ax - 3.3, 1.75, hz + 1.8, ax - 2.95, 1.60, hz + 2.5, smoothstep(s));
      lerpV3(st.camLook, ax + 0.3, 1.45, (bz + hz) * 0.5, ax + 0.6, 1.25, hz, s);
      st.camFov = 48;
    } else if (shot.cutId === 3) {
      const s = seg01(t, SHOT_02_END, SHOT_03_END);
      lerpV3(st.camPos, ax + 4.4, 1.65, (bz + r.heroLandZ) * 0.5 + 1.2, ax + 4.8, 1.45, r.heroLandZ + 1.4, smoothstep(s));
      lerpV3(st.camLook, ax, 1.35, (bz + hz) * 0.5, ax, 1.15, (bz + r.heroLandZ) * 0.5, s);
      st.camFov = 50;
    } else if (shot.cutId === 4) {
      // Wide low side-3/4 dolly showing BOTH heavy striding Boss AND actively crab-scooting Hero!
      const s = seg01(t, SHOT_03_END, SHOT_04_END);
      lerpV3(st.camPos, ax + 4.2, 1.15, hz + 1.9, ax + 3.9, 1.10, hz + 2.3, smoothstep(s));
      lerpV3(st.camLook, ax, 1.45, (bz + hz) * 0.5, ax, 1.55, (bz + hz) * 0.5, s);
      st.camFov = 48;
    } else if (shot.cutId === 5) {
      // Clean Worm's-Eye Boss Medium Shot (front-left, 3.65m away -> FULL face, chest & left gesture unobstructed!)
      const s = seg01(t, SHOT_04_END, SHOT_05_END);
      lerpV3(st.camPos, ax - 1.55, 1.45, bz + 3.75, ax - 1.20, 1.55, bz + 3.45, smoothstep(s));
      lerpV3(st.camLook, ax, 2.25, bz, ax, 2.35, bz, s);
      st.camFov = 44;
    } else if (shot.cutId === 6) {
      // Reverse low Hero close-up looking up in dread
      const s = seg01(t, SHOT_05_END, SHOT_06_END);
      lerpV3(st.camPos, ax + 1.45, 0.85, hz - 1.85, ax + 1.15, 0.80, hz - 1.60, smoothstep(s));
      lerpV3(st.camLook, ax, 0.72, hz, ax, 0.78, hz, s);
      st.camFov = 42;
    } else if (shot.cutId === 7) {
      // Dramatic Boss push-in + subtle dutch tilt + wide enough so warhammer raise never clips camera!
      const s = seg01(t, SHOT_06_END, SHOT_07_END);
      lerpV3(st.camPos, ax + 1.85, 1.70, bz + 4.20, ax + 1.45, 1.85, bz + 3.65, smoothstep(s));
      lerpV3(st.camLook, ax, 2.30, bz, ax, 2.50, bz, s);
      st.camFov = lerp(46, 42, s);
      st.camRoll = -0.055 * smoothstep(s);
    } else if (shot.cutId === 8) {
      // Carpet-level wide action shot capturing Boss overhead smash + Hero lateral roll out from under hammer!
      const s = seg01(t, SHOT_07_END, SHOT_08_END);
      lerpV3(st.camPos, ax + 3.8, 1.05, r.floorHoleZ + 3.2, ax + 3.4, 1.25, r.floorHoleZ + 3.6, smoothstep(s));
      lerpV3(st.camLook, ax - 0.3, 1.20, (bz + r.floorHoleZ) * 0.5, ax - 0.4, 0.75, r.floorHoleZ, s);
      st.camFov = 50;
      if (t >= FLOOR_SMASH_TIME) st.screenShake = Math.max(0, 0.55 * (1.0 - (t - FLOOR_SMASH_TIME) / 0.45));
    } else if (shot.cutId === 9) {
      // High 3/4 chasm collapse
      const s = seg01(t, SHOT_08_END, SHOT_09_END);
      lerpV3(st.camPos, ax + 3.5, 4.6, r.floorHoleZ + 4.3, ax + 2.8, 5.1, r.floorHoleZ + 3.9, smoothstep(s));
      lerpV3(st.camLook, ax, -0.8, r.floorHoleZ, ax, -2.5, r.floorHoleZ, s);
      st.camFov = 52;
    } else {
      // Shot 10: Upward abyss shot from inside shaft looking up past falling Hero at Boss over breach!
      const s = seg01(t, SHOT_09_END, SHOT_10_END);
      const cy = lerp(-7.5, -13.5, smoothstep(s));
      setV3(st.camPos, ax + 0.55, cy, r.floorHoleZ + 0.95);
      setV3(st.camLook, ax, Math.min(2.0, st.heroY + 3.8), r.floorHoleZ - 0.8);
      st.camFov = 58;
    }
    return st;
  }

  // ==========================================================================
  // SHAFT & UNDERGROUND RIVER STAGE (Act 4: 17.50 – 21.80 s)
  // ==========================================================================
  if (t < ACT5_START) {
    st.bossVisible = false;
    st.droppedSword.visible = false;
    st.heroFacing = 0; // Feet/head oriented cleanly downstream (+Z)

    if (t < WATER_SPLASH_TIME) {
      // Shot 11A: Vertical 360-degree stone shaft plunge
      const s = seg01(t, ACT4_START, WATER_SPLASH_TIME);
      st.heroX = Math.sin(s * 3.0) * 0.25;
      st.heroZ = lerp(0.0, 1.2, s);
      st.heroY = lerp(16.5, 0.15, easeInQuad(s));
      st.heroAnimName = 'Cutscene_Dodge_Fall';
      st.heroAnimU = lerp(0.82, 1.0, s);
      setV3(st.camPos, 0.45, st.heroY + 3.6, st.heroZ - 1.65);
      setV3(st.camLook, st.heroX, Math.max(0.0, st.heroY - 2.2), st.heroZ + 0.8);
      st.camFov = 60;
    } else if (t < SHOT_11B_END) {
      // Shot 11B: Water splash & crisp low-over-water tumble -> pull ahead of floating Hero (NO lens-splitting water plane!)
      const s = seg01(t, WATER_SPLASH_TIME, SHOT_11B_END);
      st.heroX = Math.sin(s * 5.0) * 0.35;
      st.heroZ = lerp(1.2, 14.5, smoothstep(s));
      st.heroY = lerp(-0.18, 0.14, smoothstep(s));
      st.heroAnimName = 'Cutscene_River_Float';
      st.heroAnimU = lerp(0.0, 0.40, s);
      // Clean submerged dip fully below surface (-1.05m looking down-forward) -> rises smoothly to +1.45m over water
      const dipY = s < 0.48
        ? lerp(0.95, -1.05, smoothstep(s / 0.48))
        : lerp(-1.05, 1.45, smoothstep((s - 0.48) / 0.52));
      setV3(st.camPos, st.heroX + 1.35, dipY, st.heroZ + 3.2);
      setV3(st.camLook, st.heroX, dipY < 0 ? -0.45 : (st.heroY + 0.25), st.heroZ);
      st.camFov = 56;
    } else {
      // Shot 11C: Rushing supine down dark torrent & smashing through rusted iron grate @ 20.85s!
      const s = seg01(t, SHOT_11B_END, ACT5_START);
      st.heroX = Math.sin(s * 4.5) * 0.25;
      st.heroZ = lerp(14.5, 33.5, s);
      st.heroY = 0.14 + Math.sin(s * 9.0) * 0.08;
      st.heroAnimName = 'Cutscene_River_Float';
      st.heroAnimU = lerp(0.40, 1.0, s);
      setV3(st.camPos, st.heroX * 0.4, 1.85, st.heroZ - 4.2);
      setV3(st.camLook, st.heroX, 0.65, st.heroZ + 4.8);
      st.camFov = 56;
      if (t >= GRATE_BREAK_TIME) st.screenShake = Math.max(0, 0.35 * (1.0 - (t - GRATE_BREAK_TIME) / 0.35));
    }
    return st;
  }

  // ==========================================================================
  // EXTERIOR SHORE STAGE (Act 5: 21.80 – 25.80 s)
  // ==========================================================================
  st.bossVisible = false;
  st.droppedSword.visible = false;
  st.heroX = SHORE_WAKE_X;
  st.heroY = SHORE_WAKE_Y;
  st.heroZ = SHORE_WAKE_Z;
  st.heroFacing = SHORE_WAKE_FACING;
  st.heroAnimName = 'Cutscene_Shore_WakeUp';
  st.heroAnimU = seg01(t, ACT5_START, ACT5_END);

  if (t < SHOT_12A_END) {
    // Low side-3/4 rise beside waking Hero framing Castle of Ash rising on the cliff behind!
    const s = smootherstep(seg01(t, ACT5_START, SHOT_12A_END));
    lerpV3(st.camPos, 2.35, 1.15, 5.20, 0.85, 2.55, 7.60, s);
    lerpV3(st.camLook, 0.0, 0.85, 2.10, 0.0, 6.20, -14.0, s);
    st.camFov = lerp(48, 54, s);
  } else {
    // Seamless glide into exact gameplay third-person orbit camera (`normPos` -> `normLook`, < 0.005m delta!)
    const s = smootherstep(seg01(t, SHOT_12A_END, ACT5_END));
    lerpV3(st.camPos, 0.85, 2.55, 7.60, normPos.x, normPos.y, normPos.z, s);
    lerpV3(st.camLook, 0.0, 6.20, -14.0, normLook.x, normLook.y, normLook.z, s);
    st.camFov = lerp(54, normFov, s);
  }
  return st;
}

export function getBossEscapeCutsceneSkipState(rig, out = null, opts = null) {
  const st = sampleBossEscapeCutscene(rig, BOSS_ESCAPE_CUTSCENE_DURATION, out, opts);
  st.active = false;
  st.finished = true;
  st.letterbox01 = 0;
  st.fadeToBlack01 = 0;
  st.underwater01 = 0;
  st.showLocationCard = false;
  st.subtitleSpeaker = '';
  st.subtitleText = '';
  return st;
}

export function computeBossEscapeCameraShakeOffset(timeOrState, ampOrOut = null, outArg = null) {
  let t = 0;
  let amp = 0;
  let dst = null;
  if (timeOrState && typeof timeOrState === 'object') {
    t = Number(timeOrState.t) || 0;
    amp = Number(timeOrState.screenShake) || 0;
    dst = (ampOrOut && typeof ampOrOut === 'object') ? ampOrOut : { x: 0, y: 0, z: 0, roll: 0 };
  } else {
    t = Number(timeOrState) || 0;
    amp = Number(ampOrOut) || 0;
    dst = (outArg && typeof outArg === 'object') ? outArg : { x: 0, y: 0, z: 0, roll: 0 };
  }
  if (!Number.isFinite(amp) || amp <= 1e-4) {
    dst.x = 0; dst.y = 0; dst.z = 0; dst.roll = 0;
    return dst;
  }
  dst.x = Math.sin(t * 47.0) * amp * 0.12;
  dst.y = Math.cos(t * 59.0) * amp * 0.10;
  dst.z = Math.sin(t * 37.0) * amp * 0.06;
  dst.roll = Math.sin(t * 41.0) * amp * 0.015;
  return dst;
}
