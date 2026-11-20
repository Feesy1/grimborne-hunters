// Souls-like Combat Game Feel Controller (Hitstop, Damped Camera Kick, Gate & Cutscene Rumble,
// Impact Steel Spark Presets, and AAA Mob Combo Micro-Shake Feedback)
// Pure Vanilla ES Module (zero external dependencies) for PC & Mobile (Yandex Games).

export const SOULS_HITSTOP_PRESETS = Object.freeze({
  r1: 0.042,
  light: 0.042,
  r2: 0.068,
  heavy: 0.068,
  guard_block: 0.036,
  guard_counter: 0.068,
  parry: 0.085,
  stance_break: 0.085,
  riposte: 0.085,
  wall_slam: 0.048,
  boss_slam: 0.072,
  boss_hammer_ground: 0.078,
  mob_light: 0.024,
  mob_heavy: 0.046,
  shield_bash: 0.044
});

export const SOULS_GAMEFEEL_CFG = Object.freeze({
  // Hitstop slow-mo scale (0.06x keeps subtle motion alive so impacts never look like frame lag)
  HITSTOP_TIME_SCALE: 0.06,
  HITSTOP_MIN_SEC: 0.012,
  HITSTOP_MAX_SEC: 0.120,
  // Anti-sticky cooldown between regular triggers and guaranteed post-hitstop breathing room
  HITSTOP_COOLDOWN_SEC: 0.140,
  HITSTOP_POST_BREATH_SEC: 0.095,
  // Hard anti-hang cap: even forced hitstop spam cannot hold slow-mo longer than this continuously
  HITSTOP_MAX_CONTINUOUS_SEC: 0.180,
  HITSTOP_RECOVERY_LOCK_SEC: 0.160,

  // Near-critically damped spring (zero motion-sickness oscillation, crisp weighty snap)
  SPRING_OMEGA: 26.0,
  SPRING_ZETA: 0.90,
  KICK_VEL_SCALE_XZ: 6.4,
  KICK_VEL_SCALE_Y: 4.8,
  KICK_POS_BIAS_XZ: 0.048,
  KICK_POS_BIAS_Y: 0.036,
  MAX_KICK_INTENSITY: 1.5,
  MAX_OFFSET_XZ: 0.42,
  MAX_OFFSET_Y: 0.28,
  MAX_VEL_XZ: 14.0,
  MAX_VEL_Y: 10.0,

  // Massive castle gate & cinematic seismic rumble
  MAX_RUMBLE_INTENSITY: 1.5,
  RUMBLE_ATTACK_RATE: 10.0,
  RUMBLE_RELEASE_RATE: 6.0,
  RUMBLE_AMP_XZ: 0.055,
  RUMBLE_AMP_Y: 0.042,

  // Mobile low-spec particle multiplier
  LOW_SPEC_PARTICLE_SCALE: 0.55
});

export const SOULS_SPARK_KINDS = Object.freeze([
  'sword_armor',
  'parry',
  'guard_block',
  'guard_counter',
  'stance_break',
  'heavy_thrust',
  'wall_slam',
  'boss_slam',
  'boss_hammer_ground',
  'door_dust',
  'cutscene_door_dust'
]);

/**
 * Heavy cinematic tremor & impact kick presets synced to the 7.2s 4-Act Boss Door Cutscene
 * (`soulsCutsceneChoreography.js`):
 * - Act 1 (0.00–2.05s): iron crossbar unlatch (`act1_bolt`) & first agonizing gate heave (`act1_door_shift`)
 * - Act 2 (2.05–4.35s): massive 6.4m oak leaves creaking open (`act2_door_creak`)
 * - Act 3 (4.35–6.45s): Ash Knight rising footsteps (`act3_boss_step`) & visceral Boss Roar (`act3_boss_roar`)
 * - Act 4 (6.45–7.20s): massive gates slamming shut behind the hero (`act4_door_slam`)
 */
export const SOULS_CUTSCENE_RUMBLE_PRESETS = Object.freeze({
  act1_bolt: Object.freeze({
    id: 'act1_bolt',
    act: 1,
    profile: 'bolt',
    duration: 0.34,
    rumbleIntensity: 0.52,
    kickIntensity: 0.42,
    kickDirX: 0.18,
    kickDirY: 0.46,
    kickDirZ: 0.92,
    envelope: 'decay',
    sparkKind: 'cutscene_door_dust'
  }),
  act1_door_shift: Object.freeze({
    id: 'act1_door_shift',
    act: 1,
    profile: 'door',
    duration: 1.15,
    rumbleIntensity: 0.88,
    kickIntensity: 0.50,
    kickDirX: 0.0,
    kickDirY: -0.62,
    kickDirZ: 1.0,
    envelope: 'bell',
    sparkKind: 'cutscene_door_dust'
  }),
  act2_door_creak: Object.freeze({
    id: 'act2_door_creak',
    act: 2,
    profile: 'door',
    duration: 1.85,
    rumbleIntensity: 0.64,
    kickIntensity: 0.24,
    kickDirX: 0.0,
    kickDirY: -0.45,
    kickDirZ: 1.0,
    envelope: 'bell',
    sparkKind: 'door_dust'
  }),
  act3_boss_step: Object.freeze({
    id: 'act3_boss_step',
    act: 3,
    profile: 'slam',
    duration: 0.42,
    rumbleIntensity: 0.72,
    kickIntensity: 0.62,
    kickDirX: 0.0,
    kickDirY: -0.88,
    kickDirZ: 0.25,
    envelope: 'decay',
    sparkKind: 'door_dust'
  }),
  act3_boss_roar: Object.freeze({
    id: 'act3_boss_roar',
    act: 3,
    profile: 'roar',
    duration: 1.45,
    rumbleIntensity: 1.18,
    kickIntensity: 0.58,
    kickDirX: 0.0,
    kickDirY: -0.52,
    kickDirZ: 1.0,
    envelope: 'surge',
    sparkKind: null
  }),
  act4_door_slam: Object.freeze({
    id: 'act4_door_slam',
    act: 4,
    profile: 'slam',
    duration: 0.68,
    rumbleIntensity: 1.25,
    kickIntensity: 1.15,
    kickDirX: 0.0,
    kickDirY: -0.92,
    kickDirZ: -1.0,
    envelope: 'decay',
    sparkKind: 'cutscene_door_dust'
  })
});

const CUTSCENE_PRESET_ALIASES = Object.freeze({
  bolt: 'act1_bolt',
  act1_bolt_unlatch: 'act1_bolt',
  push: 'act1_door_shift',
  act1_door_heave: 'act1_door_shift',
  act1_shift: 'act1_door_shift',
  open: 'act2_door_creak',
  creak: 'act2_door_creak',
  boss_step: 'act3_boss_step',
  roar: 'act3_boss_roar',
  boss_roar: 'act3_boss_roar',
  close: 'act4_door_slam',
  door_slam: 'act4_door_slam',
  slam: 'act4_door_slam'
});

/**
 * Micro-shake, hitstop, and steel-spark feedback profiles matched 1:1 with the AAA mob
 * combat moves in `soulsMobAi.js` (`slash_1`, `slash_2`, `overhead_crush`, `thrust_lunge`,
 * `thrust_1`, `sweep_2`, `shield_bash`, `overhead_poke`) plus Boss & ranged strikes.
 */
export const SOULS_MOB_COMBO_SHAKE_PRESETS = Object.freeze({
  slash_1: Object.freeze({
    id: 'slash_1',
    kickIntensity: 0.22,
    dirY: -0.26,
    hitstopSec: SOULS_HITSTOP_PRESETS.mob_light,
    blockedKickScale: 0.78,
    blockedHitstopSec: 0.028,
    sparkKind: 'sword_armor',
    blockedSparkKind: 'guard_block'
  }),
  slash_2: Object.freeze({
    id: 'slash_2',
    kickIntensity: 0.28,
    dirY: -0.32,
    hitstopSec: 0.028,
    blockedKickScale: 0.80,
    blockedHitstopSec: 0.032,
    sparkKind: 'sword_armor',
    blockedSparkKind: 'guard_block'
  }),
  overhead_crush: Object.freeze({
    id: 'overhead_crush',
    kickIntensity: 0.62,
    dirY: -0.86,
    hitstopSec: SOULS_HITSTOP_PRESETS.mob_heavy,
    blockedKickScale: 0.82,
    blockedHitstopSec: 0.044,
    sparkKind: 'boss_slam',
    blockedSparkKind: 'guard_block'
  }),
  thrust_lunge: Object.freeze({
    id: 'thrust_lunge',
    kickIntensity: 0.42,
    dirY: -0.22,
    hitstopSec: 0.036,
    blockedKickScale: 0.76,
    blockedHitstopSec: 0.036,
    sparkKind: 'heavy_thrust',
    blockedSparkKind: 'guard_block'
  }),
  thrust_1: Object.freeze({
    id: 'thrust_1',
    kickIntensity: 0.24,
    dirY: -0.20,
    hitstopSec: SOULS_HITSTOP_PRESETS.mob_light,
    blockedKickScale: 0.75,
    blockedHitstopSec: 0.028,
    sparkKind: 'heavy_thrust',
    blockedSparkKind: 'guard_block'
  }),
  sweep_2: Object.freeze({
    id: 'sweep_2',
    kickIntensity: 0.34,
    dirY: -0.30,
    hitstopSec: 0.032,
    blockedKickScale: 0.80,
    blockedHitstopSec: 0.034,
    sparkKind: 'sword_armor',
    blockedSparkKind: 'guard_block'
  }),
  shield_bash: Object.freeze({
    id: 'shield_bash',
    kickIntensity: 0.56,
    dirY: -0.44,
    hitstopSec: SOULS_HITSTOP_PRESETS.shield_bash,
    blockedKickScale: 0.88,
    blockedHitstopSec: 0.042,
    sparkKind: 'guard_block',
    blockedSparkKind: 'guard_block'
  }),
  overhead_poke: Object.freeze({
    id: 'overhead_poke',
    kickIntensity: 0.38,
    dirY: -0.68,
    hitstopSec: 0.034,
    blockedKickScale: 0.78,
    blockedHitstopSec: 0.032,
    sparkKind: 'heavy_thrust',
    blockedSparkKind: 'guard_block'
  }),
  arrow_hit: Object.freeze({
    id: 'arrow_hit',
    kickIntensity: 0.18,
    dirY: -0.18,
    hitstopSec: 0.016,
    blockedKickScale: 0.72,
    blockedHitstopSec: 0.022,
    sparkKind: 'sword_armor',
    blockedSparkKind: 'guard_block'
  }),
  boss_combo_1: Object.freeze({
    id: 'boss_combo_1',
    kickIntensity: 0.54,
    dirY: -0.48,
    hitstopSec: 0.048,
    blockedKickScale: 0.85,
    blockedHitstopSec: 0.044,
    sparkKind: 'sword_armor',
    blockedSparkKind: 'guard_block'
  }),
  boss_combo_2: Object.freeze({
    id: 'boss_combo_2',
    kickIntensity: 0.68,
    dirY: -0.58,
    hitstopSec: 0.056,
    blockedKickScale: 0.88,
    blockedHitstopSec: 0.050,
    sparkKind: 'boss_slam',
    blockedSparkKind: 'guard_block'
  }),
  boss_overhead_slam: Object.freeze({
    id: 'boss_overhead_slam',
    kickIntensity: 1.05,
    dirY: -0.94,
    hitstopSec: SOULS_HITSTOP_PRESETS.boss_hammer_ground,
    blockedKickScale: 0.90,
    blockedHitstopSec: 0.064,
    sparkKind: 'boss_hammer_ground',
    blockedSparkKind: 'guard_block'
  }),
  boss_sweep: Object.freeze({
    id: 'boss_sweep',
    kickIntensity: 0.76,
    dirY: -0.46,
    hitstopSec: 0.060,
    blockedKickScale: 0.86,
    blockedHitstopSec: 0.052,
    sparkKind: 'boss_slam',
    blockedSparkKind: 'guard_block'
  })
});

const EPSILON = 1e-6;
const SETTLE_POS_EPS = 1e-5;
const SETTLE_VEL_EPS = 1e-4;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function sanitizeNonNegative(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sanitizePositive(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildSparkPreset(spec, lowSpec = false) {
  const scale = lowSpec ? SOULS_GAMEFEEL_CFG.LOW_SPEC_PARTICLE_SCALE : 1.0;
  const primaryCount = Math.max(3, Math.round(spec.count * scale));
  const secondaryCount = Math.max(2, Math.round(spec.secondary.count * scale));

  const primaryLayer = Object.freeze({
    color: spec.color,
    count: primaryCount,
    speed: spec.speed,
    size: spec.size,
    life: spec.life,
    gravity: spec.gravity,
    yOffset: spec.yOffset
  });

  const secondaryLayer = Object.freeze({
    color: spec.secondary.color,
    count: secondaryCount,
    speed: spec.secondary.speed,
    size: spec.secondary.size,
    life: spec.secondary.life,
    gravity: spec.secondary.gravity,
    yOffset: spec.secondary.yOffset
  });

  const shockwave = spec.shockwave
    ? Object.freeze({
        radius: spec.shockwave.radius,
        color: spec.shockwave.color,
        duration: spec.shockwave.duration,
        withBloom: Boolean(spec.shockwave.withBloom),
        yOffset: spec.shockwave.yOffset
      })
    : null;

  const directional = Object.freeze({
    spreadAngle: spec.directional.spreadAngle,
    upwardBias: spec.directional.upwardBias,
    forwardOffset: spec.directional.forwardOffset,
    dirX: 0,
    dirZ: 1
  });

  return Object.freeze({
    kind: spec.kind,
    // Top-level fields directly usable with emitParticles(...) / world.spawnParticles({...})
    color: primaryLayer.color,
    secondaryColor: secondaryLayer.color,
    count: primaryLayer.count,
    secondaryCount: secondaryLayer.count,
    speed: primaryLayer.speed,
    size: primaryLayer.size,
    life: primaryLayer.life,
    gravity: primaryLayer.gravity,
    yOffset: primaryLayer.yOffset,
    // Structured layers & directional spark cone metadata
    primary: primaryLayer,
    secondary: secondaryLayer,
    layers: Object.freeze([primaryLayer, secondaryLayer]),
    directional,
    // Optional world.spawnShockwaveRing({...}) preset
    shockwave,
    // Paired impact game-feel cues
    hitstopSec: spec.hitstopSec,
    kickIntensity: spec.kickIntensity
  });
}

const RAW_SPARK_SPECS = Object.freeze({
  sword_armor: {
    kind: 'sword_armor',
    color: 0xfef08a, // bright steel-gold spark
    count: 12,
    speed: 7.4,
    size: 0.11,
    life: 0.30,
    gravity: 15.5,
    yOffset: 1.05,
    secondary: {
      color: 0xf59e0b, // hot amber trailing steel chips
      count: 6,
      speed: 5.2,
      size: 0.085,
      life: 0.36,
      gravity: 17.0,
      yOffset: 1.02
    },
    directional: {
      spreadAngle: 0.68,
      upwardBias: 0.42,
      forwardOffset: 0.18
    },
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.r1,
    kickIntensity: 0.24
  },
  parry: {
    kind: 'parry',
    color: 0xfffbeb, // incandescent white-gold deflection flash
    count: 24,
    speed: 9.8,
    size: 0.155,
    life: 0.42,
    gravity: 12.2,
    yOffset: 1.12,
    secondary: {
      color: 0xfde047, // blazing golden steel arc sparks
      count: 16,
      speed: 7.4,
      size: 0.125,
      life: 0.48,
      gravity: 14.5,
      yOffset: 1.08
    },
    directional: {
      spreadAngle: 1.18,
      upwardBias: 0.60,
      forwardOffset: 0.24
    },
    shockwave: {
      radius: 4.0,
      color: 0xfde047,
      duration: 0.32,
      withBloom: true,
      yOffset: 0.95
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.parry,
    kickIntensity: 0.76
  },
  guard_block: {
    kind: 'guard_block',
    color: 0xfef3c7, // crisp white-amber shield clash sparks
    count: 15,
    speed: 8.2,
    size: 0.12,
    life: 0.30,
    gravity: 15.2,
    yOffset: 1.06,
    secondary: {
      color: 0xf59e0b, // ricocheting heated steel filings
      count: 9,
      speed: 5.8,
      size: 0.095,
      life: 0.36,
      gravity: 16.8,
      yOffset: 1.00
    },
    directional: {
      spreadAngle: 0.76,
      upwardBias: 0.44,
      forwardOffset: 0.22
    },
    shockwave: {
      radius: 2.0,
      color: 0xfef08a,
      duration: 0.22,
      withBloom: false,
      yOffset: 0.92
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.guard_block,
    kickIntensity: 0.34
  },
  guard_counter: {
    kind: 'guard_counter',
    color: 0xfbbf24, // radiant retaliatory amber-gold
    count: 18,
    speed: 8.4,
    size: 0.15,
    life: 0.38,
    gravity: 13.5,
    yOffset: 1.08,
    secondary: {
      color: 0xfff7ed, // bright steel edge glint
      count: 10,
      speed: 6.6,
      size: 0.11,
      life: 0.32,
      gravity: 15.0,
      yOffset: 1.04
    },
    directional: {
      spreadAngle: 0.82,
      upwardBias: 0.46,
      forwardOffset: 0.25
    },
    shockwave: {
      radius: 3.1,
      color: 0xfbbf24,
      duration: 0.30,
      withBloom: true,
      yOffset: 0.65
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.guard_counter,
    kickIntensity: 0.56
  },
  stance_break: {
    kind: 'stance_break',
    color: 0xfde047, // posture shatter gold
    count: 26,
    speed: 8.8,
    size: 0.17,
    life: 0.48,
    gravity: 10.5,
    yOffset: 1.15,
    secondary: {
      color: 0xf97316, // incandescent ember burst
      count: 14,
      speed: 6.4,
      size: 0.14,
      life: 0.52,
      gravity: 13.0,
      yOffset: 0.95
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.65,
      forwardOffset: 0.12
    },
    shockwave: {
      radius: 4.4,
      color: 0xfde047,
      duration: 0.40,
      withBloom: true,
      yOffset: 0.20
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.stance_break,
    kickIntensity: 0.80
  },
  heavy_thrust: {
    kind: 'heavy_thrust',
    color: 0xfef3c7, // piercing steel spark jet
    count: 16,
    speed: 10.2,
    size: 0.13,
    life: 0.34,
    gravity: 14.0,
    yOffset: 1.08,
    secondary: {
      color: 0xf97316, // heated iron trail
      count: 8,
      speed: 7.6,
      size: 0.11,
      life: 0.40,
      gravity: 15.5,
      yOffset: 1.04
    },
    directional: {
      spreadAngle: 0.42,
      upwardBias: 0.30,
      forwardOffset: 0.32
    },
    shockwave: {
      radius: 2.3,
      color: 0xf59e0b,
      duration: 0.26,
      withBloom: false,
      yOffset: 0.90
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.heavy,
    kickIntensity: 0.48
  },
  wall_slam: {
    kind: 'wall_slam',
    color: 0xc8c0b4, // fractured cathedral stone dust & chips
    count: 16,
    speed: 5.4,
    size: 0.19,
    life: 0.54,
    gravity: 9.2,
    yOffset: 0.95,
    secondary: {
      color: 0xfbbf24, // armor scraping sparks against gothic stone
      count: 10,
      speed: 7.8,
      size: 0.11,
      life: 0.34,
      gravity: 16.0,
      yOffset: 1.02
    },
    directional: {
      spreadAngle: 1.05,
      upwardBias: 0.48,
      forwardOffset: 0.20
    },
    shockwave: {
      radius: 2.6,
      color: 0xd6cfc2,
      duration: 0.30,
      withBloom: false,
      yOffset: 0.72
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.wall_slam,
    kickIntensity: 0.44
  },
  boss_slam: {
    kind: 'boss_slam',
    color: 0xf97316, // molten hammer embers
    count: 28,
    speed: 9.6,
    size: 0.21,
    life: 0.56,
    gravity: 16.5,
    yOffset: 0.24,
    secondary: {
      color: 0xd6cfc2, // pulverized cathedral stone dust
      count: 16,
      speed: 5.8,
      size: 0.24,
      life: 0.68,
      gravity: 7.5,
      yOffset: 0.18
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.78,
      forwardOffset: 0.0
    },
    shockwave: {
      radius: 5.8,
      color: 0xf97316,
      duration: 0.46,
      withBloom: true,
      yOffset: 0.12
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.boss_slam,
    kickIntensity: 1.0
  },
  boss_hammer_ground: {
    kind: 'boss_hammer_ground',
    color: 0xff7a18, // incandescent furnace slag & white-hot floor sparks
    count: 34,
    speed: 10.6,
    size: 0.22,
    life: 0.60,
    gravity: 17.5,
    yOffset: 0.20,
    secondary: {
      color: 0xd6cfc2, // heavy shattered flagstone dust plume
      count: 20,
      speed: 6.4,
      size: 0.25,
      life: 0.76,
      gravity: 6.8,
      yOffset: 0.16
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.84,
      forwardOffset: 0.0
    },
    shockwave: {
      radius: 6.2,
      color: 0xf97316,
      duration: 0.50,
      withBloom: true,
      yOffset: 0.12
    },
    hitstopSec: SOULS_HITSTOP_PRESETS.boss_hammer_ground,
    kickIntensity: 1.15
  },
  door_dust: {
    kind: 'door_dust',
    color: 0xc8c0b4, // ancient limestone dust
    count: 14,
    speed: 2.8,
    size: 0.22,
    life: 0.78,
    gravity: 3.2,
    yOffset: 0.22,
    secondary: {
      color: 0x8c8478, // heavier falling mortar grit
      count: 8,
      speed: 2.1,
      size: 0.16,
      life: 0.64,
      gravity: 9.5,
      yOffset: 0.48
    },
    directional: {
      spreadAngle: 1.35,
      upwardBias: 0.25,
      forwardOffset: 0.15
    },
    shockwave: null,
    hitstopSec: 0,
    kickIntensity: 0
  },
  cutscene_door_dust: {
    kind: 'cutscene_door_dust',
    color: 0xd2cabd, // sunlit/moonlit falling arch limestone cloud
    count: 20,
    speed: 3.4,
    size: 0.25,
    life: 0.92,
    gravity: 2.8,
    yOffset: 1.85,
    secondary: {
      color: 0x9c9284, // crumbling mortar pebbles & rust flakes
      count: 12,
      speed: 2.9,
      size: 0.16,
      life: 0.72,
      gravity: 11.2,
      yOffset: 2.60
    },
    directional: {
      spreadAngle: 1.45,
      upwardBias: 0.12,
      forwardOffset: 0.22
    },
    shockwave: null,
    hitstopSec: 0,
    kickIntensity: 0
  }
});

const PRESETS_NORMAL = Object.freeze(
  Object.fromEntries(
    SOULS_SPARK_KINDS.map((k) => [k, buildSparkPreset(RAW_SPARK_SPECS[k], false)])
  )
);

const PRESETS_LOW_SPEC = Object.freeze(
  Object.fromEntries(
    SOULS_SPARK_KINDS.map((k) => [k, buildSparkPreset(RAW_SPARK_SPECS[k], true)])
  )
);

export const SOULS_IMPACT_SPARK_PRESETS = PRESETS_NORMAL;

/**
 * Resolves a cinematic cutscene rumble preset by canonical id or alias.
 *
 * @param {string} presetId
 */
export function getCutsceneRumblePreset(presetId) {
  if (typeof presetId !== 'string') return SOULS_CUTSCENE_RUMBLE_PRESETS.act1_door_shift;
  const canonical = SOULS_CUTSCENE_RUMBLE_PRESETS[presetId]
    ? presetId
    : CUTSCENE_PRESET_ALIASES[presetId];
  return (canonical && SOULS_CUTSCENE_RUMBLE_PRESETS[canonical])
    ? SOULS_CUTSCENE_RUMBLE_PRESETS[canonical]
    : SOULS_CUTSCENE_RUMBLE_PRESETS.act1_door_shift;
}

/**
 * Resolves a mob combo micro-shake preset by `soulsMobAi.js` attackId.
 *
 * @param {string} attackId
 */
export function getMobComboShakePreset(attackId) {
  if (typeof attackId === 'string' && SOULS_MOB_COMBO_SHAKE_PRESETS[attackId]) {
    return SOULS_MOB_COMBO_SHAKE_PRESETS[attackId];
  }
  return SOULS_MOB_COMBO_SHAKE_PRESETS.slash_1;
}

/**
 * Returns a combat impact spark & shockwave preset for emitParticles / world.spawnShockwaveRing.
 * Zero-allocation when called without directional overrides.
 *
 * @param {string} kind
 * @param {object} [opts]
 * @param {number} [opts.dirX]
 * @param {number} [opts.dirZ]
 * @param {boolean} [opts.lowSpec=false]
 */
export function getImpactSparkBurst(kind, opts = null) {
  const lowSpec = Boolean(opts?.lowSpec);
  const table = lowSpec ? PRESETS_LOW_SPEC : PRESETS_NORMAL;
  const base = (typeof kind === 'string' && table[kind]) ? table[kind] : table.sword_armor;

  if (!opts || (opts.dirX === undefined && opts.dirZ === undefined)) {
    return base;
  }

  const rawX = Number(opts.dirX);
  const rawZ = Number(opts.dirZ);
  let dx = Number.isFinite(rawX) ? rawX : 0;
  let dz = Number.isFinite(rawZ) ? rawZ : 0;
  const len = Math.hypot(dx, dz);
  if (len > EPSILON) {
    dx /= len;
    dz /= len;
  } else {
    dx = base.directional.dirX;
    dz = base.directional.dirZ;
  }

  return Object.freeze({
    ...base,
    directional: Object.freeze({
      spreadAngle: base.directional.spreadAngle,
      upwardBias: base.directional.upwardBias,
      forwardOffset: base.directional.forwardOffset,
      dirX: dx,
      dirZ: dz
    })
  });
}

function evalCutsceneEnvelope(envelope, u) {
  const t = clamp(u, 0, 1);
  if (envelope === 'bell') {
    return Math.sin(t * Math.PI);
  }
  if (envelope === 'surge') {
    // Fast chest-rumble rise -> sustained roar plateau -> smooth roll-off
    if (t < 0.22) return Math.sin((t / 0.22) * (Math.PI * 0.5));
    if (t < 0.72) return 0.92 + 0.08 * Math.sin(((t - 0.22) / 0.50) * Math.PI);
    return Math.cos(((t - 0.72) / 0.28) * (Math.PI * 0.5));
  }
  // 'decay': heavy impact shockwave settling exponentially
  const inv = 1 - t;
  return inv * inv;
}

/**
 * Creates a Souls-like Combat Game Feel controller:
 * 1. Framerate-independent Hitstop (0.06x time scale, anti-sticky cooldown, anti-hang cap).
 * 2. Near-critically damped 3D spring camera kicks + castle gate & 7.2s cutscene seismic rumble (0 GC/frame).
 * 3. Directional steel-clash spark burst & shockwave ring presets for emitParticles / world.spawnShockwaveRing.
 * 4. AAA mob combo hit micro-shake & spark feedback (`triggerComboHitFeedback`).
 *
 * @param {object} [config]
 */
export function createSoulsGameFeel(config = {}) {
  const timeScale = clamp(
    sanitizePositive(config.hitstopTimeScale, SOULS_GAMEFEEL_CFG.HITSTOP_TIME_SCALE),
    0.01,
    0.5
  );
  const maxHitstopSec = clamp(
    sanitizePositive(config.hitstopMaxSec, SOULS_GAMEFEEL_CFG.HITSTOP_MAX_SEC),
    0.02,
    0.25
  );
  const baseCooldownSec = sanitizeNonNegative(
    config.hitstopCooldownSec,
    SOULS_GAMEFEEL_CFG.HITSTOP_COOLDOWN_SEC
  );
  const postBreathSec = sanitizeNonNegative(
    config.hitstopPostBreathSec,
    SOULS_GAMEFEEL_CFG.HITSTOP_POST_BREATH_SEC
  );
  const maxContinuousSlowSec = Math.max(
    maxHitstopSec,
    sanitizePositive(config.hitstopMaxContinuousSec, SOULS_GAMEFEEL_CFG.HITSTOP_MAX_CONTINUOUS_SEC)
  );
  const recoveryLockSec = sanitizePositive(
    config.hitstopRecoveryLockSec,
    SOULS_GAMEFEEL_CFG.HITSTOP_RECOVERY_LOCK_SEC
  );

  // Damped harmonic oscillator constants (exact closed-form integration)
  const omega = clamp(sanitizePositive(config.springOmega, SOULS_GAMEFEEL_CFG.SPRING_OMEGA), 6.0, 60.0);
  const zeta = clamp(sanitizePositive(config.springZeta, SOULS_GAMEFEEL_CFG.SPRING_ZETA), 0.70, 0.995);
  const dampedFreq = omega * Math.sqrt(1 - zeta * zeta);
  const zetaOmega = zeta * omega;

  let lowSpecMode = Boolean(config.lowSpec);
  let shakeScale = clamp(sanitizeNonNegative(config.shakeScale, 1.0), 0, 2.0);

  // --- Hitstop state ---
  let hitstopRemaining = 0;
  let hitstopCooldown = 0;
  let continuousSlowTime = 0;
  let recoveryLockTimer = 0;

  // --- 3D Spring Camera Kick state ---
  let posX = 0;
  let posY = 0;
  let posZ = 0;
  let velX = 0;
  let velY = 0;
  let velZ = 0;

  // --- Massive Castle Gate Rumble state ---
  let doorRumbleTarget = 0;
  let doorRumbleCurrent = 0;
  let doorRumbleProfile = 'door';
  let rumblePhase = 0;

  // --- Timed 7.2s Cutscene Seismic Tremor state ---
  let cutsceneElapsed = 0;
  let cutsceneDuration = 0;
  let cutscenePeakIntensity = 0;
  let cutsceneProfile = 'door';
  let cutsceneEnvelope = 'decay';
  let cutsceneActiveId = null;

  // One-shot latches for syncCutsceneShake(cutsceneState, dt)
  let lastSyncedAudioStage = null;
  let lastSyncedRoarPeak = false;
  let lastSyncedDoorSlam = false;

  // Zero-allocation reusable outputs
  const shakeOutput = { offsetX: 0, offsetY: 0, offsetZ: 0 };
  const comboFeedbackOutput = {
    attackId: 'slash_1',
    sparkBurst: PRESETS_NORMAL.sword_armor,
    hitstopTriggered: false,
    kickIntensity: 0
  };

  /**
   * Triggers a combat hitstop slow-down.
   * Accepts either a duration in seconds (e.g. 0.042, 0.068, 0.085) or a preset name
   * ('r1', 'heavy', 'guard_block', 'guard_counter', 'parry', 'stance_break', 'riposte',
   * 'wall_slam', 'boss_slam', 'boss_hammer_ground', 'mob_light', 'mob_heavy', 'shield_bash').
   *
   * Anti-sticky & anti-hang guarantees:
   * - Regular triggers respect cooldown so multi-target cleaves cannot freeze combat.
   * - Forced triggers ({ force: true }) can upgrade an active hitstop, but are strictly
   *   bounded by maxContinuousSlowSec + mandatory recoveryLockSec so hitstop NEVER hangs.
   *
   * @param {number|string} sec
   * @param {object} [opts]
   * @param {boolean} [opts.force=false]
   * @returns {boolean} true if applied/extended
   */
  function triggerHitstop(sec, opts = null) {
    let rawSec = sec;
    if (typeof sec === 'string') {
      rawSec = SOULS_HITSTOP_PRESETS[sec] ?? 0;
    }

    const parsed = Number(rawSec);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return false;
    }

    const duration = clamp(parsed, SOULS_GAMEFEEL_CFG.HITSTOP_MIN_SEC, maxHitstopSec);

    // Unbypassable safety recovery window after hitting continuous slow-mo budget
    if (recoveryLockTimer > 0) {
      return false;
    }

    const remainingBudget = maxContinuousSlowSec - (continuousSlowTime + hitstopRemaining);
    if (remainingBudget <= EPSILON) {
      recoveryLockTimer = Math.max(recoveryLockTimer, recoveryLockSec);
      return false;
    }

    const force = Boolean(opts && opts.force);
    if (!force && (hitstopCooldown > 0 || hitstopRemaining > 0)) {
      return false;
    }

    // Clamp new/extended remaining time strictly within the continuous safety budget
    const cappedTotal = Math.min(duration, maxContinuousSlowSec - continuousSlowTime);
    if (cappedTotal <= hitstopRemaining + EPSILON) {
      return false;
    }

    hitstopRemaining = cappedTotal;
    hitstopCooldown = Math.max(baseCooldownSec, hitstopRemaining + postBreathSec);
    return true;
  }

  /**
   * Converts raw frame delta time into combat simulation dt.
   * Framerate-independent piecewise integration: while hitstop is active, only the
   * exact remaining hitstop slice runs at 0.06x; any remainder of rawDt runs at 1.0x.
   *
   * @param {number} rawDt
   * @returns {number}
   */
  function consumeSimulationDt(rawDt) {
    const safeDt = sanitizePositive(rawDt, 0);
    if (safeDt <= 0) {
      return 0;
    }

    if (hitstopCooldown > 0) {
      hitstopCooldown = Math.max(0, hitstopCooldown - safeDt);
    }

    if (recoveryLockTimer > 0) {
      recoveryLockTimer = Math.max(0, recoveryLockTimer - safeDt);
      if (recoveryLockTimer <= EPSILON) {
        recoveryLockTimer = 0;
      }
    }

    if (hitstopRemaining <= EPSILON) {
      hitstopRemaining = 0;
      if (continuousSlowTime > 0) {
        continuousSlowTime = Math.max(0, continuousSlowTime - safeDt * 1.5);
      }
      return safeDt;
    }

    const slowSlice = Math.min(hitstopRemaining, safeDt);
    const normalSlice = safeDt - slowSlice;

    hitstopRemaining -= slowSlice;
    if (hitstopRemaining <= 1e-7) {
      hitstopRemaining = 0;
    }

    continuousSlowTime += slowSlice;
    if (continuousSlowTime >= maxContinuousSlowSec - EPSILON) {
      // Budget reached: immediately clear any lingering hitstop and force breathing recovery
      hitstopRemaining = 0;
      continuousSlowTime = 0;
      recoveryLockTimer = Math.max(recoveryLockTimer, recoveryLockSec);
    } else if (hitstopRemaining === 0 && normalSlice > 0) {
      continuousSlowTime = Math.max(0, continuousSlowTime - normalSlice * 1.5);
    }

    return slowSlice * timeScale + normalSlice;
  }

  /**
   * Applies a weighty directional impulse to the damped camera spring.
   * If (dirX, dirZ) is near zero (e.g. radial hammer slam), applies a grounded vertical thump.
   *
   * @param {number} dirX
   * @param {number} dirZ
   * @param {number} intensity
   * @param {object} [opts]
   * @param {number} [opts.dirY]
   */
  function triggerKick(dirX, dirZ, intensity, opts = null) {
    const rawIntensity = Number(intensity);
    if (!Number.isFinite(rawIntensity) || rawIntensity <= 0) {
      return;
    }

    const mag = clamp(rawIntensity, 0, SOULS_GAMEFEEL_CFG.MAX_KICK_INTENSITY);
    const rx = Number.isFinite(Number(dirX)) ? Number(dirX) : 0;
    const rz = Number.isFinite(Number(dirZ)) ? Number(dirZ) : 0;
    const len = Math.hypot(rx, rz);

    let nx = 0;
    let nz = 0;
    let ny = -0.38;

    if (len > EPSILON) {
      nx = rx / len;
      nz = rz / len;
    } else {
      // Radial / ground impact (e.g. Troll Boss hammer slam): pure weighty downward thud
      ny = -0.88;
    }

    if (opts && Number.isFinite(Number(opts.dirY))) {
      ny = clamp(Number(opts.dirY), -1.0, 1.0);
    }

    // Immediate subtle frame-1 offset + crisp spring velocity impulse
    posX = clamp(
      posX + nx * mag * SOULS_GAMEFEEL_CFG.KICK_POS_BIAS_XZ,
      -SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ,
      SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ
    );
    posZ = clamp(
      posZ + nz * mag * SOULS_GAMEFEEL_CFG.KICK_POS_BIAS_XZ,
      -SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ,
      SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ
    );
    posY = clamp(
      posY + ny * mag * SOULS_GAMEFEEL_CFG.KICK_POS_BIAS_Y,
      -SOULS_GAMEFEEL_CFG.MAX_OFFSET_Y,
      SOULS_GAMEFEEL_CFG.MAX_OFFSET_Y
    );

    velX = clamp(
      velX + nx * mag * SOULS_GAMEFEEL_CFG.KICK_VEL_SCALE_XZ,
      -SOULS_GAMEFEEL_CFG.MAX_VEL_XZ,
      SOULS_GAMEFEEL_CFG.MAX_VEL_XZ
    );
    velZ = clamp(
      velZ + nz * mag * SOULS_GAMEFEEL_CFG.KICK_VEL_SCALE_XZ,
      -SOULS_GAMEFEEL_CFG.MAX_VEL_XZ,
      SOULS_GAMEFEEL_CFG.MAX_VEL_XZ
    );
    velY = clamp(
      velY + ny * mag * SOULS_GAMEFEEL_CFG.KICK_VEL_SCALE_Y,
      -SOULS_GAMEFEEL_CFG.MAX_VEL_Y,
      SOULS_GAMEFEEL_CFG.MAX_VEL_Y
    );
  }

  /**
   * Sets target seismic rumble intensity for massive castle gates grinding open/closed.
   * Smoothly ramped in stepCameraShake(dt) to avoid jarring single-frame jumps.
   *
   * @param {number} intensity - 0 to 1.5
   * @param {object} [opts]
   * @param {string} [opts.profile='door'] - 'door' | 'bolt' | 'roar' | 'slam'
   */
  function setDoorRumble(intensity, opts = null) {
    if (opts && typeof opts.profile === 'string') {
      doorRumbleProfile = opts.profile;
    }
    const n = Number(intensity);
    if (!Number.isFinite(n) || n <= 0) {
      doorRumbleTarget = 0;
      return;
    }
    doorRumbleTarget = clamp(n, 0, SOULS_GAMEFEEL_CFG.MAX_RUMBLE_INTENSITY);
  }

  /**
   * Triggers a heavy cinematic shake preset for the 7.2s Boss Door Cutscene:
   * - Act 1: 'act1_bolt' ('bolt'), 'act1_door_shift' ('push')
   * - Act 2: 'act2_door_creak' ('open')
   * - Act 3: 'act3_boss_step' ('boss_step'), 'act3_boss_roar' ('roar')
   * - Act 4: 'act4_door_slam' ('close' / 'door_slam')
   *
   * Combines a crisp damped spring impact kick with a timed zero-drift seismic tremor.
   *
   * @param {string} presetId
   * @param {number} [scale=1.0]
   * @returns {object} resolved cutscene preset
   */
  function triggerCutsceneShake(presetId, scale = 1.0) {
    const preset = getCutsceneRumblePreset(presetId);
    const mult = clamp(sanitizePositive(scale, 1.0), 0.1, 2.0);

    if (preset.kickIntensity > 0) {
      triggerKick(preset.kickDirX, preset.kickDirZ, preset.kickIntensity * mult, {
        dirY: preset.kickDirY
      });
    }

    cutsceneElapsed = 0;
    cutsceneDuration = preset.duration;
    cutscenePeakIntensity = clamp(
      preset.rumbleIntensity * mult,
      0,
      SOULS_GAMEFEEL_CFG.MAX_RUMBLE_INTENSITY
    );
    cutsceneProfile = preset.profile;
    cutsceneEnvelope = preset.envelope;
    cutsceneActiveId = preset.id;

    return preset;
  }

  /**
   * Automatically synchronizes heavy Act 1 / Act 3 / Act 4 cutscene shakes with the live
   * choreography state from `evaluateBossDoorCutscene` / `world.getBossDoorCutsceneState()`.
   * Safe to call every frame: uses internal edge-latches so each act impact fires exactly once.
   *
   * @param {object|null} cutsceneState
   * @param {number} [dt=0]
   * @returns {{ offsetX: number, offsetY: number, offsetZ: number }}
   */
  function syncCutsceneShake(cutsceneState, dt = 0) {
    if (!cutsceneState || cutsceneState.finished) {
      if (lastSyncedAudioStage !== null || lastSyncedRoarPeak || lastSyncedDoorSlam) {
        lastSyncedAudioStage = null;
        lastSyncedRoarPeak = false;
        lastSyncedDoorSlam = false;
        setDoorRumble(0);
        cutsceneDuration = 0;
        cutsceneElapsed = 0;
        cutscenePeakIntensity = 0;
        cutsceneActiveId = null;
      }
      return stepCameraShake(dt);
    }

    const rawStage = cutsceneState.audioCueStage;
    const stageKey = (typeof rawStage === 'number' || typeof rawStage === 'string') ? rawStage : null;
    if (stageKey !== null && stageKey !== 0 && stageKey !== lastSyncedAudioStage) {
      lastSyncedAudioStage = stageKey;
      if (stageKey === 1 || stageKey === 'bolt') {
        triggerCutsceneShake('act1_bolt');
      } else if (stageKey === 2 || stageKey === 'push') {
        triggerCutsceneShake('act1_door_shift');
      } else if (stageKey === 3 || stageKey === 'open') {
        triggerCutsceneShake('act2_door_creak');
      } else if (stageKey === 4 || stageKey === 'roar') {
        triggerCutsceneShake('act3_boss_step');
      } else if (stageKey === 5 || stageKey === 'close') {
        triggerCutsceneShake('act4_door_slam');
      }
    }

    const roarPeak = Boolean(cutsceneState.bossRoarPeak);
    if (roarPeak && !lastSyncedRoarPeak) {
      lastSyncedRoarPeak = true;
      triggerCutsceneShake('act3_boss_roar');
    }

    const doorSlam = Boolean(cutsceneState.doorSlam);
    if (doorSlam && !lastSyncedDoorSlam) {
      lastSyncedDoorSlam = true;
      if (cutsceneActiveId !== 'act4_door_slam') {
        triggerCutsceneShake('act4_door_slam');
      }
    }

    // Continuous subtle floor tremor tracks door shudder during Act 1–2 without overriding slam/roar
    const shudder = sanitizeNonNegative(cutsceneState.doorShudder, 0);
    if (shudder > 0.02) {
      setDoorRumble(clamp(shudder * 0.85, 0, 1.0), { profile: 'door' });
    } else {
      setDoorRumble(0);
    }

    return stepCameraShake(dt);
  }

  /**
   * Triggers tuned micro-shake, optional hitstop, and resolves the matching steel-clash spark burst
   * for any AAA enemy combo hit (`slash_1`, `slash_2`, `overhead_crush`, `thrust_lunge`,
   * `thrust_1`, `sweep_2`, `shield_bash`, `overhead_poke`, `boss_overhead_slam`, etc.).
   * Returns a reused output object (0 heap allocations in combat hot loops).
   *
   * @param {string} attackId
   * @param {number} dirX
   * @param {number} dirZ
   * @param {object} [opts]
   * @param {boolean} [opts.blocked=false]
   * @param {boolean} [opts.parried=false]
   * @param {boolean} [opts.applyHitstop=true]
   * @param {number} [opts.scale=1.0]
   * @returns {{ attackId: string, sparkBurst: object, hitstopTriggered: boolean, kickIntensity: number }}
   */
  function triggerComboHitFeedback(attackId, dirX, dirZ, opts = null) {
    const preset = getMobComboShakePreset(attackId);
    const blocked = Boolean(opts && opts.blocked);
    const parried = Boolean(opts && opts.parried);
    const applyHitstop = !(opts && opts.applyHitstop === false);
    const scale = clamp(sanitizePositive(opts && opts.scale, 1.0), 0.1, 2.0);

    let sparkKind = preset.sparkKind;
    let kickIntensity = preset.kickIntensity * scale;
    let kickDirY = preset.dirY;
    let hitstopSec = preset.hitstopSec;
    let forceHitstop = false;

    if (parried) {
      sparkKind = 'parry';
      kickIntensity = Math.max(0.68, preset.kickIntensity * 1.15) * scale;
      kickDirY = -0.35;
      hitstopSec = SOULS_HITSTOP_PRESETS.parry;
      forceHitstop = true;
    } else if (blocked) {
      sparkKind = preset.blockedSparkKind;
      kickIntensity = preset.kickIntensity * preset.blockedKickScale * scale;
      kickDirY = preset.dirY * 0.72;
      hitstopSec = preset.blockedHitstopSec;
    }

    triggerKick(dirX, dirZ, kickIntensity, { dirY: kickDirY });

    const hitstopTriggered = applyHitstop
      ? triggerHitstop(hitstopSec, forceHitstop ? { force: true } : null)
      : false;

    const table = lowSpecMode ? PRESETS_LOW_SPEC : PRESETS_NORMAL;
    const sparkBurst = table[sparkKind] || table.sword_armor;

    comboFeedbackOutput.attackId = preset.id;
    comboFeedbackOutput.sparkBurst = sparkBurst;
    comboFeedbackOutput.hitstopTriggered = hitstopTriggered;
    comboFeedbackOutput.kickIntensity = kickIntensity;

    return comboFeedbackOutput;
  }

  function sampleSeismicProfile(profile, phase, intensity, out) {
    if (intensity <= 1e-4) {
      out.x = 0;
      out.y = 0;
      out.z = 0;
      return;
    }

    if (profile === 'bolt') {
      // Crisp iron-on-stone metallic shudder
      const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * 0.85 * intensity;
      const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * 0.95 * intensity;
      out.x = (0.58 * Math.sin(phase * 54.3) + 0.42 * Math.sin(phase * 83.7 + 0.6)) * ampXZ;
      out.y = (0.62 * Math.cos(phase * 62.9) + 0.38 * Math.sin(phase * 91.1 + 1.2)) * ampY;
      out.z = (0.56 * Math.cos(phase * 58.1 + 0.9) + 0.44 * Math.cos(phase * 79.3)) * ampXZ;
      return;
    }

    if (profile === 'roar') {
      // Deep chest-rattling visceral Boss Roar (strong low-mid harmonics, 0 DC drift)
      const roarMod = 0.78 + 0.22 * Math.sin(phase * 11.2);
      const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * 1.18 * intensity * roarMod;
      const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * 1.25 * intensity * roarMod;
      out.x = (0.50 * Math.sin(phase * 29.3) + 0.32 * Math.sin(phase * 46.7 + 0.8) + 0.18 * Math.sin(phase * 71.9)) * ampXZ;
      out.y = (0.52 * Math.cos(phase * 33.1) + 0.30 * Math.sin(phase * 53.7 + 1.4) + 0.18 * Math.cos(phase * 77.3)) * ampY;
      out.z = (0.50 * Math.cos(phase * 31.7 + 0.5) + 0.32 * Math.cos(phase * 49.3) + 0.18 * Math.sin(phase * 68.9)) * ampXZ;
      return;
    }

    if (profile === 'slam') {
      // Tectonic stone floor shockwave aftershock (vertical-heavy thud)
      const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * 0.95 * intensity;
      const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * 1.45 * intensity;
      out.x = (0.60 * Math.sin(phase * 31.3) + 0.40 * Math.sin(phase * 53.1 + 0.5)) * ampXZ;
      out.y = (0.66 * Math.cos(phase * 27.9) + 0.34 * Math.sin(phase * 57.7 + 0.9)) * ampY;
      out.z = (0.60 * Math.cos(phase * 34.7 + 1.1) + 0.40 * Math.cos(phase * 51.3)) * ampXZ;
      return;
    }

    // Default 'door': massive ancient stone & oak gate grinding tremor
    const grindMod = 0.72 + 0.28 * Math.sin(phase * 7.4);
    const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * intensity * grindMod;
    const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * intensity * grindMod;
    out.x = (0.62 * Math.sin(phase * 39.7) + 0.38 * Math.sin(phase * 61.3 + 1.1)) * ampXZ;
    out.y = (0.58 * Math.cos(phase * 47.9) + 0.42 * Math.sin(phase * 73.1 + 0.4)) * ampY;
    out.z = (0.62 * Math.cos(phase * 43.3 + 0.7) + 0.38 * Math.cos(phase * 67.1)) * ampXZ;
  }

  // Reusable scratch vectors for zero-allocation seismic summation
  const _doorVec = { x: 0, y: 0, z: 0 };
  const _cutsceneVec = { x: 0, y: 0, z: 0 };

  /**
   * Steps the damped camera spring, castle gate rumble, and timed cutscene tremors.
   * Returns a reused { offsetX, offsetY, offsetZ } object (0 allocations per frame).
   *
   * @param {number} dt
   * @returns {{ offsetX: number, offsetY: number, offsetZ: number }}
   */
  function stepCameraShake(dt) {
    const safeDt = sanitizePositive(dt, 0);

    if (safeDt > 0) {
      // Exact closed-form damped harmonic oscillator step (unconditionally stable for any dt)
      if (posX !== 0 || velX !== 0 || posY !== 0 || velY !== 0 || posZ !== 0 || velZ !== 0) {
        const decay = Math.exp(-zetaOmega * safeDt);
        const angle = dampedFreq * safeDt;
        const cosT = Math.cos(angle);
        const sinT = Math.sin(angle);

        if (posX !== 0 || velX !== 0) {
          const a = posX;
          const b = (velX + zetaOmega * posX) / dampedFreq;
          posX = decay * (a * cosT + b * sinT);
          velX = decay * ((b * dampedFreq - a * zetaOmega) * cosT - (a * dampedFreq + b * zetaOmega) * sinT);
          if (Math.abs(posX) < SETTLE_POS_EPS && Math.abs(velX) < SETTLE_VEL_EPS) {
            posX = 0;
            velX = 0;
          }
        }

        if (posY !== 0 || velY !== 0) {
          const a = posY;
          const b = (velY + zetaOmega * posY) / dampedFreq;
          posY = decay * (a * cosT + b * sinT);
          velY = decay * ((b * dampedFreq - a * zetaOmega) * cosT - (a * dampedFreq + b * zetaOmega) * sinT);
          if (Math.abs(posY) < SETTLE_POS_EPS && Math.abs(velY) < SETTLE_VEL_EPS) {
            posY = 0;
            velY = 0;
          }
        }

        if (posZ !== 0 || velZ !== 0) {
          const a = posZ;
          const b = (velZ + zetaOmega * posZ) / dampedFreq;
          posZ = decay * (a * cosT + b * sinT);
          velZ = decay * ((b * dampedFreq - a * zetaOmega) * cosT - (a * dampedFreq + b * zetaOmega) * sinT);
          if (Math.abs(posZ) < SETTLE_POS_EPS && Math.abs(velZ) < SETTLE_VEL_EPS) {
            posZ = 0;
            velZ = 0;
          }
        }
      }

      // Smooth exponential ramp for continuous castle gate seismic rumble
      const rate = doorRumbleTarget > doorRumbleCurrent
        ? SOULS_GAMEFEEL_CFG.RUMBLE_ATTACK_RATE
        : SOULS_GAMEFEEL_CFG.RUMBLE_RELEASE_RATE;
      const alpha = 1 - Math.exp(-rate * safeDt);
      doorRumbleCurrent += (doorRumbleTarget - doorRumbleCurrent) * alpha;

      if (doorRumbleTarget === 0 && doorRumbleCurrent < 1e-4) {
        doorRumbleCurrent = 0;
      }

      // Advance timed cutscene seismic tremor
      if (cutsceneDuration > 0) {
        cutsceneElapsed += safeDt;
        if (cutsceneElapsed >= cutsceneDuration) {
          cutsceneElapsed = 0;
          cutsceneDuration = 0;
          cutscenePeakIntensity = 0;
          cutsceneActiveId = null;
        }
      }

      if (doorRumbleCurrent > 0 || cutsceneDuration > 0) {
        // Keep phase bounded so sin/cos precision never degrades over long sessions
        rumblePhase = (rumblePhase + safeDt) % 628.3185307179586;
      }
    }

    // Sample continuous door rumble & timed cutscene seismic tremor (0 allocations)
    sampleSeismicProfile(doorRumbleProfile, rumblePhase, doorRumbleCurrent, _doorVec);

    let cutsceneCurrent = 0;
    if (cutsceneDuration > 0 && cutscenePeakIntensity > 1e-4) {
      const u = clamp(cutsceneElapsed / cutsceneDuration, 0, 1);
      cutsceneCurrent = cutscenePeakIntensity * evalCutsceneEnvelope(cutsceneEnvelope, u);
    }
    sampleSeismicProfile(cutsceneProfile, rumblePhase + 1.37, cutsceneCurrent, _cutsceneVec);

    const totalX = clamp(
      (posX + _doorVec.x + _cutsceneVec.x) * shakeScale,
      -SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ,
      SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ
    );
    const totalY = clamp(
      (posY + _doorVec.y + _cutsceneVec.y) * shakeScale,
      -SOULS_GAMEFEEL_CFG.MAX_OFFSET_Y,
      SOULS_GAMEFEEL_CFG.MAX_OFFSET_Y
    );
    const totalZ = clamp(
      (posZ + _doorVec.z + _cutsceneVec.z) * shakeScale,
      -SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ,
      SOULS_GAMEFEEL_CFG.MAX_OFFSET_XZ
    );

    shakeOutput.offsetX = Math.abs(totalX) < SETTLE_POS_EPS ? 0 : totalX;
    shakeOutput.offsetY = Math.abs(totalY) < SETTLE_POS_EPS ? 0 : totalY;
    shakeOutput.offsetZ = Math.abs(totalZ) < SETTLE_POS_EPS ? 0 : totalZ;

    return shakeOutput;
  }

  function getBurst(kind, opts = null) {
    if (!opts) {
      const table = lowSpecMode ? PRESETS_LOW_SPEC : PRESETS_NORMAL;
      return (typeof kind === 'string' && table[kind]) ? table[kind] : table.sword_armor;
    }
    return getImpactSparkBurst(kind, {
      dirX: opts.dirX,
      dirZ: opts.dirZ,
      lowSpec: opts.lowSpec !== undefined ? Boolean(opts.lowSpec) : lowSpecMode
    });
  }

  function setLowSpec(enabled) {
    lowSpecMode = Boolean(enabled);
  }

  function setShakeScale(scale) {
    shakeScale = clamp(sanitizeNonNegative(scale, 1.0), 0, 2.0);
  }

  function reset() {
    hitstopRemaining = 0;
    hitstopCooldown = 0;
    continuousSlowTime = 0;
    recoveryLockTimer = 0;
    posX = 0;
    posY = 0;
    posZ = 0;
    velX = 0;
    velY = 0;
    velZ = 0;
    doorRumbleTarget = 0;
    doorRumbleCurrent = 0;
    doorRumbleProfile = 'door';
    rumblePhase = 0;
    cutsceneElapsed = 0;
    cutsceneDuration = 0;
    cutscenePeakIntensity = 0;
    cutsceneProfile = 'door';
    cutsceneEnvelope = 'decay';
    cutsceneActiveId = null;
    lastSyncedAudioStage = null;
    lastSyncedRoarPeak = false;
    lastSyncedDoorSlam = false;
    shakeOutput.offsetX = 0;
    shakeOutput.offsetY = 0;
    shakeOutput.offsetZ = 0;
  }

  function isHitstopActive() {
    return hitstopRemaining > EPSILON;
  }

  function getState() {
    return {
      hitstopRemaining,
      hitstopCooldown,
      continuousSlowTime,
      recoveryLockTimer,
      hitstopTimeScale: timeScale,
      doorRumbleTarget,
      doorRumbleCurrent,
      doorRumbleProfile,
      cutsceneActiveId,
      cutsceneRemaining: Math.max(0, cutsceneDuration - cutsceneElapsed),
      lowSpecMode,
      shakeScale,
      offsetX: shakeOutput.offsetX,
      offsetY: shakeOutput.offsetY,
      offsetZ: shakeOutput.offsetZ
    };
  }

  return {
    triggerHitstop,
    consumeSimulationDt,
    triggerKick,
    setDoorRumble,
    triggerCutsceneShake,
    syncCutsceneShake,
    triggerComboHitFeedback,
    stepCameraShake,
    getImpactSparkBurst: getBurst,
    setLowSpec,
    setShakeScale,
    isHitstopActive,
    reset,
    getState,
    HITSTOP_PRESETS: SOULS_HITSTOP_PRESETS,
    SPARK_KINDS: SOULS_SPARK_KINDS,
    CUTSCENE_RUMBLE_PRESETS: SOULS_CUTSCENE_RUMBLE_PRESETS,
    MOB_COMBO_SHAKE_PRESETS: SOULS_MOB_COMBO_SHAKE_PRESETS
  };
}
