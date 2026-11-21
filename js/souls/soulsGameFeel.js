// Souls-like Combat Game Feel & Physical Impact VFX Controller (Wave 2 — z65)
// - Framerate-independent Hitstop (0.06x slow-mo, anti-sticky cooldown, anti-hang guarantee)
// - Near-critically damped 3D camera spring kicks + castle gate & cutscene seismic rumble (0 GC/frame)
// - Physical Cathedral Stone Dust (heavy footsteps & Boss hammer ground shockwave) +
//   Directional Planck-Blackbody Steel Spark Sheaves on Parry / Block (1 Draw Call GPU InstancedMesh,
//   0 Draw Calls when idle, Premultiplied Dual-Mode Blending, 0 WebGL leaks, replaces arcade circles!)

import * as THREE from '../../vendor/three.module.js';

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
  LOW_SPEC_PARTICLE_SCALE: 0.55,
  PC_MAX_IMPACT_PARTICLES: 280,
  MOBILE_MAX_IMPACT_PARTICLES: 140
});

export const SOULS_SPARK_KINDS = Object.freeze([
  'sword_armor',
  'parry',
  'parry_steel_sheaf',
  'guard_block',
  'block_steel_sheaf',
  'guard_counter',
  'stance_break',
  'heavy_thrust',
  'wall_slam',
  'boss_slam',
  'boss_hammer_ground',
  'hammer_ground_wave',
  'heavy_footstep_dust',
  'boss_footstep_dust',
  'door_dust',
  'cutscene_door_dust'
]);

/**
 * Heavy cinematic tremor & impact kick presets synced to the Boss Door Cutscene:
 * - Act 1: iron crossbar unlatch (`act1_bolt`) & first agonizing gate heave (`act1_door_shift`)
 * - Act 2: massive 6.4m oak leaves creaking open (`act2_door_creak`)
 * - Act 3: Ash Knight rising footsteps (`act3_boss_step`) & visceral Boss Roar (`act3_boss_roar`)
 * - Act 4: massive gates slamming shut behind the hero (`act4_door_slam`)
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
    sparkKind: 'boss_footstep_dust'
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
 * Micro-shake, hitstop, and directional steel-sheaf / physical stone-dust feedback profiles
 * matched 1:1 with the AAA mob combat moves in `soulsMobAi.js` + Boss Executioner moves.
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
    sparkKind: 'hammer_ground_wave',
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
    sparkKind: 'hammer_ground_wave',
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
    sparkKind: 'hammer_ground_wave',
    blockedSparkKind: 'guard_block'
  })
});

const EPSILON = 1e-6;
const SETTLE_POS_EPS = 1e-5;
const SETTLE_VEL_EPS = 1e-4;
const TWO_PI = Math.PI * 2;

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

  const sheaf = spec.sheaf
    ? Object.freeze({
        sparkCount: Math.max(4, Math.round(spec.sheaf.sparkCount * scale)),
        smokeCount: Math.max(1, Math.round(spec.sheaf.smokeCount * scale)),
        coneHalfRad: spec.sheaf.coneHalfRad,
        jetSpeedMin: spec.sheaf.jetSpeedMin,
        jetSpeedMax: spec.sheaf.jetSpeedMax,
        bounceRestitution: spec.sheaf.bounceRestitution,
        initialHeat: spec.sheaf.initialHeat
      })
    : null;

  const stoneDust = spec.stoneDust
    ? Object.freeze({
        puffCount: Math.max(3, Math.round(spec.stoneDust.puffCount * scale)),
        gritCount: Math.max(2, Math.round(spec.stoneDust.gritCount * scale)),
        slagSparkCount: Math.round((spec.stoneDust.slagSparkCount || 0) * scale),
        ringRadius: spec.stoneDust.ringRadius,
        outwardSpeed: spec.stoneDust.outwardSpeed,
        drag: spec.stoneDust.drag
      })
    : null;

  return Object.freeze({
    kind: spec.kind,
    vfxMode: spec.vfxMode || 'steel_sheaf',
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
    // Structured layers & directional spark sheaf / physical stone dust descriptors
    primary: primaryLayer,
    secondary: secondaryLayer,
    layers: Object.freeze([primaryLayer, secondaryLayer]),
    directional,
    sheaf,
    stoneDust,
    // Replaces arcade red/neon telegraph circles (null on ground dust & physical hammer waves)
    shockwave,
    // Paired impact game-feel cues
    hitstopSec: spec.hitstopSec,
    kickIntensity: spec.kickIntensity
  });
}

// Noble Planck-blackbody steel & weathered gothic limestone palette (zero acid/neon overexposure!)
const RAW_SPARK_SPECS = Object.freeze({
  sword_armor: {
    kind: 'sword_armor',
    vfxMode: 'steel_sheaf',
    color: 0xffefc2, // forged steel white-amber spark
    count: 14,
    speed: 8.2,
    size: 0.10,
    life: 0.32,
    gravity: 16.5,
    yOffset: 1.05,
    secondary: {
      color: 0xd97724, // cooling forged iron chips
      count: 7,
      speed: 5.6,
      size: 0.08,
      life: 0.38,
      gravity: 17.5,
      yOffset: 1.02
    },
    directional: {
      spreadAngle: 0.48,
      upwardBias: 0.36,
      forwardOffset: 0.18
    },
    sheaf: {
      sparkCount: 16,
      smokeCount: 2,
      coneHalfRad: 0.42,
      jetSpeedMin: 6.2,
      jetSpeedMax: 11.4,
      bounceRestitution: 0.36,
      initialHeat: 0.88
    },
    stoneDust: null,
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.r1,
    kickIntensity: 0.24
  },
  parry: {
    kind: 'parry',
    vfxMode: 'steel_sheaf',
    color: 0xfff6dc, // white-hot forged deflection sheaf
    count: 26,
    speed: 10.6,
    size: 0.135,
    life: 0.44,
    gravity: 15.0,
    yOffset: 1.12,
    secondary: {
      color: 0xeb9834, // rich blackbody amber steel streaks
      count: 16,
      speed: 7.8,
      size: 0.105,
      life: 0.50,
      gravity: 16.5,
      yOffset: 1.08
    },
    directional: {
      spreadAngle: 0.58,
      upwardBias: 0.48,
      forwardOffset: 0.24
    },
    sheaf: {
      sparkCount: 34,
      smokeCount: 4,
      coneHalfRad: 0.52,
      jetSpeedMin: 8.5,
      jetSpeedMax: 15.8,
      bounceRestitution: 0.42,
      initialHeat: 1.0
    },
    stoneDust: null,
    shockwave: null, // Pure directional steel spark sheaf instead of flat arcade circle!
    hitstopSec: SOULS_HITSTOP_PRESETS.parry,
    kickIntensity: 0.76
  },
  parry_steel_sheaf: {
    kind: 'parry_steel_sheaf',
    vfxMode: 'steel_sheaf',
    color: 0xfff6dc,
    count: 28,
    speed: 11.2,
    size: 0.13,
    life: 0.46,
    gravity: 15.5,
    yOffset: 1.12,
    secondary: {
      color: 0xe68a2e,
      count: 18,
      speed: 8.2,
      size: 0.10,
      life: 0.52,
      gravity: 16.8,
      yOffset: 1.06
    },
    directional: {
      spreadAngle: 0.50,
      upwardBias: 0.46,
      forwardOffset: 0.24
    },
    sheaf: {
      sparkCount: 38,
      smokeCount: 4,
      coneHalfRad: 0.48,
      jetSpeedMin: 9.0,
      jetSpeedMax: 16.4,
      bounceRestitution: 0.44,
      initialHeat: 1.0
    },
    stoneDust: null,
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.parry,
    kickIntensity: 0.76
  },
  guard_block: {
    kind: 'guard_block',
    vfxMode: 'steel_sheaf',
    color: 0xfff0c4, // tight shield-rim deflection spark sheaf
    count: 18,
    speed: 8.8,
    size: 0.11,
    life: 0.32,
    gravity: 16.2,
    yOffset: 1.06,
    secondary: {
      color: 0xd97b24, // ricocheting heated iron filings
      count: 10,
      speed: 6.2,
      size: 0.085,
      life: 0.38,
      gravity: 17.5,
      yOffset: 1.00
    },
    directional: {
      spreadAngle: 0.54,
      upwardBias: 0.38,
      forwardOffset: 0.22
    },
    sheaf: {
      sparkCount: 24,
      smokeCount: 3,
      coneHalfRad: 0.46,
      jetSpeedMin: 7.0,
      jetSpeedMax: 13.2,
      bounceRestitution: 0.38,
      initialHeat: 0.92
    },
    stoneDust: null,
    shockwave: null, // Pure directional shield spark sheaf, 0 arcade rings
    hitstopSec: SOULS_HITSTOP_PRESETS.guard_block,
    kickIntensity: 0.34
  },
  block_steel_sheaf: {
    kind: 'block_steel_sheaf',
    vfxMode: 'steel_sheaf',
    color: 0xfff0c4,
    count: 20,
    speed: 9.2,
    size: 0.11,
    life: 0.34,
    gravity: 16.2,
    yOffset: 1.06,
    secondary: {
      color: 0xd97b24,
      count: 12,
      speed: 6.4,
      size: 0.085,
      life: 0.40,
      gravity: 17.5,
      yOffset: 1.00
    },
    directional: {
      spreadAngle: 0.50,
      upwardBias: 0.36,
      forwardOffset: 0.22
    },
    sheaf: {
      sparkCount: 26,
      smokeCount: 3,
      coneHalfRad: 0.44,
      jetSpeedMin: 7.2,
      jetSpeedMax: 13.6,
      bounceRestitution: 0.38,
      initialHeat: 0.92
    },
    stoneDust: null,
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.guard_block,
    kickIntensity: 0.34
  },
  guard_counter: {
    kind: 'guard_counter',
    vfxMode: 'steel_sheaf',
    color: 0xffe8ad, // heavy retaliatory forged-steel cleave sparks
    count: 20,
    speed: 9.2,
    size: 0.13,
    life: 0.38,
    gravity: 15.2,
    yOffset: 1.08,
    secondary: {
      color: 0xe07b22,
      count: 12,
      speed: 6.8,
      size: 0.10,
      life: 0.42,
      gravity: 16.5,
      yOffset: 1.04
    },
    directional: {
      spreadAngle: 0.62,
      upwardBias: 0.44,
      forwardOffset: 0.25
    },
    sheaf: {
      sparkCount: 28,
      smokeCount: 3,
      coneHalfRad: 0.55,
      jetSpeedMin: 7.8,
      jetSpeedMax: 14.2,
      bounceRestitution: 0.40,
      initialHeat: 0.96
    },
    stoneDust: null,
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.guard_counter,
    kickIntensity: 0.56
  },
  stance_break: {
    kind: 'stance_break',
    vfxMode: 'steel_sheaf',
    color: 0xfff2c6, // posture shatter steel & stone burst
    count: 26,
    speed: 9.0,
    size: 0.15,
    life: 0.48,
    gravity: 13.5,
    yOffset: 1.10,
    secondary: {
      color: 0x948b7e, // shaken armor & flagstone dust puff
      count: 14,
      speed: 4.8,
      size: 0.18,
      life: 0.58,
      gravity: 4.5,
      yOffset: 0.32
    },
    directional: {
      spreadAngle: 1.25,
      upwardBias: 0.56,
      forwardOffset: 0.14
    },
    sheaf: {
      sparkCount: 32,
      smokeCount: 6,
      coneHalfRad: 1.15,
      jetSpeedMin: 7.2,
      jetSpeedMax: 14.5,
      bounceRestitution: 0.40,
      initialHeat: 0.98
    },
    stoneDust: {
      puffCount: 10,
      gritCount: 6,
      slagSparkCount: 8,
      ringRadius: 2.2,
      outwardSpeed: 4.6,
      drag: 4.2
    },
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.stance_break,
    kickIntensity: 0.80
  },
  heavy_thrust: {
    kind: 'heavy_thrust',
    vfxMode: 'steel_sheaf',
    color: 0xfff3cf, // narrow high-velocity piercing steel jet
    count: 18,
    speed: 10.8,
    size: 0.115,
    life: 0.35,
    gravity: 15.5,
    yOffset: 1.08,
    secondary: {
      color: 0xd97320,
      count: 9,
      speed: 7.8,
      size: 0.095,
      life: 0.42,
      gravity: 16.8,
      yOffset: 1.04
    },
    directional: {
      spreadAngle: 0.34,
      upwardBias: 0.28,
      forwardOffset: 0.32
    },
    sheaf: {
      sparkCount: 24,
      smokeCount: 2,
      coneHalfRad: 0.30,
      jetSpeedMin: 9.2,
      jetSpeedMax: 16.0,
      bounceRestitution: 0.38,
      initialHeat: 0.95
    },
    stoneDust: null,
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.heavy,
    kickIntensity: 0.48
  },
  wall_slam: {
    kind: 'wall_slam',
    vfxMode: 'stone_and_sparks',
    color: 0x8f877b, // fractured gothic ashlar dust cloud
    count: 16,
    speed: 4.6,
    size: 0.19,
    life: 0.62,
    gravity: 4.2,
    yOffset: 0.92,
    secondary: {
      color: 0xffdfa0, // steel plate scraping stone sparks
      count: 12,
      speed: 8.2,
      size: 0.10,
      life: 0.34,
      gravity: 16.5,
      yOffset: 1.02
    },
    directional: {
      spreadAngle: 0.92,
      upwardBias: 0.42,
      forwardOffset: 0.20
    },
    sheaf: {
      sparkCount: 16,
      smokeCount: 5,
      coneHalfRad: 0.78,
      jetSpeedMin: 5.8,
      jetSpeedMax: 11.2,
      bounceRestitution: 0.34,
      initialHeat: 0.86
    },
    stoneDust: {
      puffCount: 10,
      gritCount: 8,
      slagSparkCount: 6,
      ringRadius: 1.6,
      outwardSpeed: 3.8,
      drag: 4.5
    },
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.wall_slam,
    kickIntensity: 0.44
  },
  boss_slam: {
    kind: 'boss_slam',
    vfxMode: 'hammer_dust_wave',
    color: 0x8c8377, // physical pulverized flagstone dust wave (replaces red circles!)
    count: 26,
    speed: 7.4,
    size: 0.23,
    life: 0.68,
    gravity: 3.6,
    yOffset: 0.18,
    secondary: {
      color: 0xf29438, // forged-iron & ember slag sparks skimming floor
      count: 18,
      speed: 9.4,
      size: 0.13,
      life: 0.48,
      gravity: 16.8,
      yOffset: 0.22
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.42,
      forwardOffset: 0.0
    },
    sheaf: null,
    stoneDust: {
      puffCount: 22,
      gritCount: 12,
      slagSparkCount: 18,
      ringRadius: 4.2,
      outwardSpeed: 8.6,
      drag: 3.8
    },
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.boss_slam,
    kickIntensity: 1.0
  },
  boss_hammer_ground: {
    kind: 'boss_hammer_ground',
    vfxMode: 'hammer_dust_wave',
    color: 0x91887b, // dense radial cathedral stone dust wave
    count: 30,
    speed: 8.4,
    size: 0.25,
    life: 0.76,
    gravity: 3.2,
    yOffset: 0.16,
    secondary: {
      color: 0xffb35c, // white-amber forged hammer impact sparks + stone chips
      count: 22,
      speed: 10.6,
      size: 0.14,
      life: 0.54,
      gravity: 17.2,
      yOffset: 0.20
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.46,
      forwardOffset: 0.0
    },
    sheaf: null,
    stoneDust: {
      puffCount: 28,
      gritCount: 16,
      slagSparkCount: 24,
      ringRadius: 5.2,
      outwardSpeed: 9.8,
      drag: 3.5
    },
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.boss_hammer_ground,
    kickIntensity: 1.15
  },
  hammer_ground_wave: {
    kind: 'hammer_ground_wave',
    vfxMode: 'hammer_dust_wave',
    color: 0x8a8175,
    count: 22,
    speed: 6.8,
    size: 0.22,
    life: 0.66,
    gravity: 3.4,
    yOffset: 0.16,
    secondary: {
      color: 0xeb8c34,
      count: 14,
      speed: 8.8,
      size: 0.12,
      life: 0.46,
      gravity: 16.8,
      yOffset: 0.20
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.40,
      forwardOffset: 0.0
    },
    sheaf: null,
    stoneDust: {
      puffCount: 18,
      gritCount: 10,
      slagSparkCount: 14,
      ringRadius: 3.4,
      outwardSpeed: 7.4,
      drag: 4.0
    },
    shockwave: null,
    hitstopSec: SOULS_HITSTOP_PRESETS.mob_heavy,
    kickIntensity: 0.62
  },
  heavy_footstep_dust: {
    kind: 'heavy_footstep_dust',
    vfxMode: 'footstep_dust',
    color: 0x7d756b, // low-hugging weathered flagstone dust puff
    count: 6,
    speed: 1.8,
    size: 0.16,
    life: 0.52,
    gravity: 1.8,
    yOffset: 0.06,
    secondary: {
      color: 0x5c564e, // tiny kicked stone grit
      count: 4,
      speed: 2.4,
      size: 0.07,
      life: 0.36,
      gravity: 13.5,
      yOffset: 0.08
    },
    directional: {
      spreadAngle: 1.40,
      upwardBias: 0.18,
      forwardOffset: 0.04
    },
    sheaf: null,
    stoneDust: {
      puffCount: 6,
      gritCount: 4,
      slagSparkCount: 0,
      ringRadius: 0.55,
      outwardSpeed: 1.9,
      drag: 5.2
    },
    shockwave: null,
    hitstopSec: 0,
    kickIntensity: 0.05
  },
  boss_footstep_dust: {
    kind: 'boss_footstep_dust',
    vfxMode: 'footstep_dust',
    color: 0x877f73, // heavy Executioner Boss boot impact stone cloud
    count: 11,
    speed: 2.9,
    size: 0.22,
    life: 0.66,
    gravity: 2.0,
    yOffset: 0.08,
    secondary: {
      color: 0x635c53, // bouncing flagstone pebbles
      count: 6,
      speed: 3.6,
      size: 0.09,
      life: 0.44,
      gravity: 14.5,
      yOffset: 0.10
    },
    directional: {
      spreadAngle: Math.PI,
      upwardBias: 0.22,
      forwardOffset: 0.06
    },
    sheaf: null,
    stoneDust: {
      puffCount: 11,
      gritCount: 6,
      slagSparkCount: 2,
      ringRadius: 1.15,
      outwardSpeed: 3.1,
      drag: 4.6
    },
    shockwave: null,
    hitstopSec: 0,
    kickIntensity: 0.18
  },
  door_dust: {
    kind: 'door_dust',
    vfxMode: 'footstep_dust',
    color: 0x8a8277, // ancient limestone dust (muted gothic stone, 0 white fog!)
    count: 14,
    speed: 2.6,
    size: 0.22,
    life: 0.78,
    gravity: 2.6,
    yOffset: 0.18,
    secondary: {
      color: 0x665f56, // heavier falling mortar grit
      count: 8,
      speed: 2.1,
      size: 0.12,
      life: 0.60,
      gravity: 11.0,
      yOffset: 0.42
    },
    directional: {
      spreadAngle: 1.35,
      upwardBias: 0.22,
      forwardOffset: 0.15
    },
    sheaf: null,
    stoneDust: {
      puffCount: 12,
      gritCount: 7,
      slagSparkCount: 0,
      ringRadius: 1.4,
      outwardSpeed: 2.4,
      drag: 4.2
    },
    shockwave: null,
    hitstopSec: 0,
    kickIntensity: 0
  },
  cutscene_door_dust: {
    kind: 'cutscene_door_dust',
    vfxMode: 'footstep_dust',
    color: 0x91887c, // falling arch limestone cloud
    count: 20,
    speed: 3.2,
    size: 0.24,
    life: 0.90,
    gravity: 2.4,
    yOffset: 1.85,
    secondary: {
      color: 0x6b6359, // crumbling mortar pebbles & rust flakes
      count: 12,
      speed: 2.8,
      size: 0.13,
      life: 0.70,
      gravity: 11.8,
      yOffset: 2.60
    },
    directional: {
      spreadAngle: 1.45,
      upwardBias: 0.12,
      forwardOffset: 0.22
    },
    sheaf: null,
    stoneDust: {
      puffCount: 16,
      gritCount: 10,
      slagSparkCount: 3,
      ringRadius: 1.8,
      outwardSpeed: 3.0,
      drag: 3.8
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
 * Returns a combat impact spark & physical stone dust preset.
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

// ============================================================================
// 1-Draw-Call Physical Cathedral Stone Dust & Directional Steel Spark Sheaf VFX
// (Premultiplied Dual-Mode Blending: Opaque/Translucent Stone Dust + Additive
//  Planck-Blackbody Steel Sparks in ONE single InstancedMesh draw call; 0 when idle)
// ============================================================================

const IMPACT_VFX_VERT_GLSL = /* glsl */ `
attribute vec2 aQuad;
attribute vec4 aPosSize;
attribute vec4 aVelKind;
attribute vec4 aLifeSeed;
attribute vec3 aTint;

varying vec2 vUv;
varying float vKind;
varying float vAge;
varying float vAlpha;
varying float vHeat;
varying float vSeed;
varying vec3 vTint;

void main() {
  vec4 mvCenter = modelViewMatrix * vec4(aPosSize.xyz, 1.0);
  float kind = aVelKind.w;
  float size = aPosSize.w;

  if (kind >= 1.5) {
    // Velocity-stretched forged steel spark streak in camera space
    vec3 mvVel = mat3(modelViewMatrix) * aVelKind.xyz;
    float spd2D = length(mvVel.xy);
    vec2 dir2D = spd2D > 0.001 ? (mvVel.xy / spd2D) : vec2(0.0, 1.0);
    vec2 perp2D = vec2(-dir2D.y, dir2D.x);
    float worldSpd = length(aVelKind.xyz);
    float stretch = clamp(1.15 + worldSpd * 0.26, 1.2, 5.2);
    float len = size * stretch;
    float wid = max(0.018, size * 0.38);
    mvCenter.xy += dir2D * (aQuad.x * len) + perp2D * (aQuad.y * wid);
  } else {
    // Tumbling cathedral stone dust billow or fractured stone grit chip
    float spinRate = kind < 0.5 ? 1.35 : 9.2;
    float ang = aLifeSeed.w * 6.2831853 + aLifeSeed.x * spinRate;
    float c = cos(ang);
    float s = sin(ang);
    vec2 rotQuad = vec2(aQuad.x * c - aQuad.y * s, aQuad.x * s + aQuad.y * c);
    mvCenter.xy += rotQuad * size;
  }

  vUv = aQuad + 0.5;
  vKind = kind;
  vAge = aLifeSeed.x;
  vAlpha = aLifeSeed.y;
  vHeat = aLifeSeed.z;
  vSeed = aLifeSeed.w;
  vTint = aTint;

  gl_Position = projectionMatrix * mvCenter;
}
`;

const IMPACT_VFX_FRAG_GLSL = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying float vKind;
varying float vAge;
varying float vAlpha;
varying float vHeat;
varying float vSeed;
varying vec3 vTint;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 sampleSteelBlackbody(float heat) {
  float h = clamp(heat, 0.0, 1.0);
  vec3 darkIron = vec3(0.07, 0.025, 0.012);
  vec3 cherryRed = vec3(0.56, 0.115, 0.028);
  vec3 forgedAmber = vec3(0.95, 0.51, 0.135);
  vec3 whiteGold = vec3(1.0, 0.945, 0.79);

  vec3 c1 = mix(darkIron, cherryRed, smoothstep(0.0, 0.34, h));
  vec3 c2 = mix(c1, forgedAmber, smoothstep(0.30, 0.72, h));
  return mix(c2, whiteGold, smoothstep(0.68, 1.0, h));
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  vec4 outColor = vec4(0.0);

  if (vKind < 0.5) {
    // Archetype 0: Physical Cathedral Stone Dust Billow (muted limestone, 0 white fog!)
    vec2 nCoord = p * 2.15 + vec2(vSeed * 11.7, vSeed * 7.3 + vAge * 0.85);
    float n1 = valueNoise(nCoord);
    float n2 = valueNoise(nCoord * 2.3 + 4.1);
    float billow = n1 * 0.65 + n2 * 0.35;

    float radial = length(p) + (billow - 0.5) * 0.38;
    float shape = 1.0 - smoothstep(0.28, 0.96, radial);
    float fadeIn = smoothstep(0.0, 0.11, vAge);
    float fadeOut = pow(clamp(1.0 - vAge, 0.0, 1.0), 1.55);
    // Hard physical opacity cap prevents additive/whiteout fog buildup
    float alpha = clamp(shape * fadeIn * fadeOut * vAlpha, 0.0, 0.36);

    float topShade = 0.78 + 0.26 * clamp(0.5 - p.y * 0.45, 0.0, 1.0);
    vec3 stoneRgb = vTint * topShade * mix(0.76, 1.10, billow);
    outColor = vec4(stoneRgb * alpha, alpha);
  } else if (vKind < 1.5) {
    // Archetype 1: Fractured Flagstone Grit / Pebble Chip
    float skew = (vSeed - 0.5) * 0.35;
    float d1 = abs(p.x + p.y * skew) * 0.92 + abs(p.y) * 0.48;
    float d2 = abs(p.y - p.x * skew) * 0.94 + abs(p.x) * 0.42;
    float facet = max(d1, d2);
    float mask = 1.0 - smoothstep(0.52, 0.82, facet);
    float fadeOut = smoothstep(1.0, 0.68, vAge);
    float alpha = clamp(mask * fadeOut * vAlpha, 0.0, 0.88);

    float bevelLight = 0.72 + 0.38 * smoothstep(-0.4, 0.5, p.x - p.y);
    vec3 gritRgb = vTint * bevelLight;
    outColor = vec4(gritRgb * alpha, alpha);
  } else {
    // Archetype 2: Directional Velocity-Stretched Steel Spark (pure additive via alpha = 0)
    float crossCore = exp(-p.y * p.y * 18.0);
    float crossHalo = exp(-p.y * p.y * 4.6) * 0.34;
    // Bright forged tip at +p.x, cooling tapered streak toward -p.x
    float headTaper = 1.0 - smoothstep(0.38, 1.0, p.x);
    float tailTaper = smoothstep(-1.0, 0.42, p.x);
    float along = headTaper * tailTaper;

    float tailTemp = clamp(vHeat * mix(0.52, 1.06, smoothstep(-0.85, 0.65, p.x)), 0.0, 1.0);
    vec3 bbRgb = sampleSteelBlackbody(tailTemp) * mix(vec3(1.0), vTint, 0.22);

    float fade = (1.0 - smoothstep(0.72, 1.0, vAge)) * vAlpha;
    float intensity = (crossCore * 1.32 + crossHalo) * along * fade;
    outColor = vec4(bbRgb * intensity, 0.0);
  }

  gl_FragColor = outColor;
}
`;

/**
 * Creates a strictly 1-Draw-Call GPU-instanced combat impact VFX system for:
 * - Physical cathedral stone dust billows & bouncing grit under heavy footsteps
 * - Radial flagstone dust & cooling forged-iron spark waves on Boss hammer ground slams
 *   (replacing arcade red/neon telegraph & shockwave circles!)
 * - Tight directional sheaves of ricocheting steel sparks on Parry, Shield Block & Armor hits
 *
 * Performance & Memory Contract:
 * - 1 draw call when active, 0 draw calls when idle (`mesh.visible = false`).
 * - 0 heap allocations in `emit*` and `update(dt)`.
 * - Preserves framebuffer alpha = 1.0 via premultiplied CustomBlending.
 * - Full `.dispose()` with 0 WebGL geometry/material leaks across Hub <-> Rift transitions.
 *
 * @param {THREE.Scene|THREE.Object3D} scene
 * @param {object} [opts]
 * @param {boolean} [opts.isMobile]
 * @param {boolean} [opts.lowSpec=false]
 * @param {number} [opts.maxParticles]
 */
export function createSoulsImpactVfxSystem(scene, opts = {}) {
  const isMobile = opts.isMobile !== undefined ? Boolean(opts.isMobile) : detectMobileDevice();
  let lowSpec = Boolean(opts.lowSpec);
  const defaultCap = isMobile
    ? SOULS_GAMEFEEL_CFG.MOBILE_MAX_IMPACT_PARTICLES
    : SOULS_GAMEFEEL_CFG.PC_MAX_IMPACT_PARTICLES;
  const maxParticles = Math.max(32, Math.min(512, Math.floor(opts.maxParticles || defaultCap)));

  // Deterministic LCG PRNG so bursts never allocate or stutter
  let rngState = 0x51f3a9d7;
  function nextRand() {
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  // Pre-allocated SOA physics state arrays (0 GC allocations)
  const active = new Uint8Array(maxParticles);
  const kindArr = new Float32Array(maxParticles); // 0 = dust, 1 = grit, 2 = steel spark
  const px = new Float32Array(maxParticles);
  const py = new Float32Array(maxParticles);
  const pz = new Float32Array(maxParticles);
  const vx = new Float32Array(maxParticles);
  const vy = new Float32Array(maxParticles);
  const vz = new Float32Array(maxParticles);
  const groundYArr = new Float32Array(maxParticles);
  const size0Arr = new Float32Array(maxParticles);
  const size1Arr = new Float32Array(maxParticles);
  const ageArr = new Float32Array(maxParticles);
  const lifeArr = new Float32Array(maxParticles);
  const dragArr = new Float32Array(maxParticles);
  const gravArr = new Float32Array(maxParticles);
  const liftArr = new Float32Array(maxParticles);
  const bounceArr = new Float32Array(maxParticles);
  const alphaArr = new Float32Array(maxParticles);
  const heat0Arr = new Float32Array(maxParticles);
  const heatArr = new Float32Array(maxParticles);
  const seedArr = new Float32Array(maxParticles);
  const crArr = new Float32Array(maxParticles);
  const cgArr = new Float32Array(maxParticles);
  const cbArr = new Float32Array(maxParticles);

  // Compact GPU upload buffers (only activeCount instances uploaded/rendered)
  const gpuPosSize = new Float32Array(maxParticles * 4);
  const gpuVelKind = new Float32Array(maxParticles * 4);
  const gpuLifeSeed = new Float32Array(maxParticles * 4);
  const gpuTint = new Float32Array(maxParticles * 3);

  const geo = new THREE.InstancedBufferGeometry();
  const quadVerts = new Float32Array([
    -0.5, -0.5,
     0.5, -0.5,
     0.5,  0.5,
    -0.5, -0.5,
     0.5,  0.5,
    -0.5,  0.5
  ]);
  // Provide standard `position` attribute alongside `aQuad` for Three.js r160 compatibility
  const dummyPos = new Float32Array(18);
  geo.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
  geo.setAttribute('aQuad', new THREE.BufferAttribute(quadVerts, 2));

  const attrPosSize = new THREE.InstancedBufferAttribute(gpuPosSize, 4);
  const attrVelKind = new THREE.InstancedBufferAttribute(gpuVelKind, 4);
  const attrLifeSeed = new THREE.InstancedBufferAttribute(gpuLifeSeed, 4);
  const attrTint = new THREE.InstancedBufferAttribute(gpuTint, 3);
  attrPosSize.setUsage(THREE.DynamicDrawUsage);
  attrVelKind.setUsage(THREE.DynamicDrawUsage);
  attrLifeSeed.setUsage(THREE.DynamicDrawUsage);
  attrTint.setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute('aPosSize', attrPosSize);
  geo.setAttribute('aVelKind', attrVelKind);
  geo.setAttribute('aLifeSeed', attrLifeSeed);
  geo.setAttribute('aTint', attrTint);
  geo.instanceCount = 0;

  const mat = new THREE.ShaderMaterial({
    vertexShader: IMPACT_VFX_VERT_GLSL,
    fragmentShader: IMPACT_VFX_FRAG_GLSL,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'SoulsImpactVfxInstanced';
  mesh.frustumCulled = false;
  mesh.renderOrder = 18;
  mesh.visible = false;

  if (scene && typeof scene.add === 'function') {
    scene.add(mesh);
  }

  let cursor = 0;
  let activeCount = 0;
  let disposed = false;

  function allocSlot() {
    for (let probe = 0; probe < maxParticles; probe++) {
      const idx = (cursor + probe) % maxParticles;
      if (active[idx] === 0) {
        cursor = (idx + 1) % maxParticles;
        active[idx] = 1;
        activeCount++;
        return idx;
      }
    }
    const overwrite = cursor;
    cursor = (cursor + 1) % maxParticles;
    return overwrite;
  }

  function setHexRgb(idx, hex, jitter = 0.06) {
    const r0 = ((hex >> 16) & 255) / 255;
    const g0 = ((hex >> 8) & 255) / 255;
    const b0 = (hex & 255) / 255;
    const shift = 1 + (nextRand() - 0.5) * jitter * 2;
    crArr[idx] = clamp(r0 * shift, 0, 1);
    cgArr[idx] = clamp(g0 * shift, 0, 1);
    cbArr[idx] = clamp(b0 * shift, 0, 1);
  }

  function scaledCount(baseCount, minCount = 1) {
    const mult = lowSpec ? SOULS_GAMEFEEL_CFG.LOW_SPEC_PARTICLE_SCALE : 1.0;
    const mobileMult = isMobile ? 0.78 : 1.0;
    return Math.max(minCount, Math.round(baseCount * mult * mobileMult));
  }

  /**
   * Spawns physical cathedral stone dust puffs + kicked flagstone grit under heavy footsteps.
   */
  function emitFootstepDust(x, y, z, stepOpts = null) {
    if (disposed) return 0;
    const sx = Number.isFinite(Number(x)) ? Number(x) : 0;
    const sy = Number.isFinite(Number(y)) ? Number(y) : 0;
    const sz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const actorKind = (stepOpts && stepOpts.actorKind) || 'knight';
    const isBoss = actorKind === 'boss';
    const intensity = clamp(sanitizePositive(stepOpts && stepOpts.intensity, 1.0), 0.2, 2.0);
    const groundY = (stepOpts && stepOpts.groundY !== undefined && stepOpts.groundY !== null && Number.isFinite(Number(stepOpts.groundY)))
      ? Number(stepOpts.groundY)
      : sy;

    const rawDx = stepOpts && stepOpts.dirX !== undefined && stepOpts.dirX !== null ? Number(stepOpts.dirX) : 0;
    const rawDz = stepOpts && stepOpts.dirZ !== undefined && stepOpts.dirZ !== null ? Number(stepOpts.dirZ) : 0;
    let backX = 0;
    let backZ = 0;
    const dLen = Math.hypot(Number.isFinite(rawDx) ? rawDx : 0, Number.isFinite(rawDz) ? rawDz : 0);
    if (dLen > EPSILON) {
      backX = -(rawDx / dLen);
      backZ = -(rawDz / dLen);
    }

    const puffCount = scaledCount((isBoss ? 10 : 5) * intensity, 2);
    const gritCount = scaledCount((isBoss ? 6 : 3) * intensity, 1);
    const baseOutSpeed = (isBoss ? 2.8 : 1.65) * intensity;
    const baseSize = isBoss ? 0.22 : 0.14;
    let spawned = 0;

    // 1. Expanding low-hugging stone dust puffs
    for (let i = 0; i < puffCount; i++) {
      const idx = allocSlot();
      const ang = (i / puffCount) * TWO_PI + (nextRand() - 0.5) * 0.55;
      const spd = baseOutSpeed * (0.55 + nextRand() * 0.65);
      const rOff = (isBoss ? 0.22 : 0.11) * (0.5 + nextRand() * 0.7);

      kindArr[idx] = 0;
      px[idx] = sx + Math.cos(ang) * rOff;
      py[idx] = groundY + 0.05 + nextRand() * 0.06;
      pz[idx] = sz + Math.sin(ang) * rOff;
      vx[idx] = Math.cos(ang) * spd + backX * spd * 0.35;
      vy[idx] = 0.22 + nextRand() * (isBoss ? 0.52 : 0.32);
      vz[idx] = Math.sin(ang) * spd + backZ * spd * 0.35;
      groundYArr[idx] = groundY;
      size0Arr[idx] = baseSize * (0.75 + nextRand() * 0.45);
      size1Arr[idx] = size0Arr[idx] * (isBoss ? 2.65 : 2.25);
      ageArr[idx] = 0;
      lifeArr[idx] = (isBoss ? 0.68 : 0.48) * (0.82 + nextRand() * 0.36);
      dragArr[idx] = isBoss ? 4.4 : 5.2;
      gravArr[idx] = 0.0;
      liftArr[idx] = isBoss ? 0.36 : 0.24;
      bounceArr[idx] = 0;
      alphaArr[idx] = (isBoss ? 0.32 : 0.24) * clamp(intensity, 0.5, 1.25);
      heat0Arr[idx] = 0;
      heatArr[idx] = 0;
      seedArr[idx] = nextRand();
      setHexRgb(idx, isBoss ? 0x847b70 : 0x787066, 0.10);
      spawned++;
    }

    // 2. Bouncing flagstone grit pebbles
    for (let i = 0; i < gritCount; i++) {
      const idx = allocSlot();
      const ang = nextRand() * TWO_PI;
      const spd = (isBoss ? 3.4 : 2.2) * (0.6 + nextRand() * 0.7) * intensity;

      kindArr[idx] = 1;
      px[idx] = sx + (nextRand() - 0.5) * 0.18;
      py[idx] = groundY + 0.04 + nextRand() * 0.05;
      pz[idx] = sz + (nextRand() - 0.5) * 0.18;
      vx[idx] = Math.cos(ang) * spd + backX * 0.8;
      vy[idx] = (isBoss ? 2.4 : 1.7) * (0.65 + nextRand() * 0.7);
      vz[idx] = Math.sin(ang) * spd + backZ * 0.8;
      groundYArr[idx] = groundY;
      size0Arr[idx] = (isBoss ? 0.075 : 0.052) * (0.75 + nextRand() * 0.5);
      size1Arr[idx] = size0Arr[idx] * 0.85;
      ageArr[idx] = 0;
      lifeArr[idx] = (isBoss ? 0.48 : 0.36) * (0.8 + nextRand() * 0.4);
      dragArr[idx] = 1.4;
      gravArr[idx] = 14.5;
      liftArr[idx] = 0;
      bounceArr[idx] = 0.32;
      alphaArr[idx] = 0.82;
      heat0Arr[idx] = 0;
      heatArr[idx] = 0;
      seedArr[idx] = nextRand();
      setHexRgb(idx, 0x5e584f, 0.14);
      spawned++;
    }

    return spawned;
  }

  /**
   * Spawns a physical radial stone-dust wave + bouncing flagstone chips + low-skimming
   * blackbody forged-iron sparks when a Boss / Executioner hammer slams the floor.
   * Completely replaces flat arcade red/neon telegraph & shockwave circles!
   */
  function emitHammerSlamWave(x, y, z, slamOpts = null) {
    if (disposed) return 0;
    const sx = Number.isFinite(Number(x)) ? Number(x) : 0;
    const sy = Number.isFinite(Number(y)) ? Number(y) : 0;
    const sz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const groundY = (slamOpts && slamOpts.groundY !== undefined && slamOpts.groundY !== null && Number.isFinite(Number(slamOpts.groundY)))
      ? Number(slamOpts.groundY)
      : sy;
    const radius = clamp(sanitizePositive(slamOpts && slamOpts.radius, 4.6), 1.4, 8.5);
    const intensity = clamp(sanitizePositive(slamOpts && slamOpts.intensity, 1.0), 0.3, 2.0);
    const phase2 = Boolean(slamOpts && slamOpts.phase2);

    const puffCount = scaledCount(Math.round((16 + radius * 2.2) * intensity), 6);
    const gritCount = scaledCount(Math.round(13 * intensity), 4);
    const sparkCount = scaledCount(Math.round((phase2 ? 28 : 20) * intensity), 6);
    const drag = 3.6;
    const ringOutSpeed = Math.max(4.5, radius * drag * 0.62);
    let spawned = 0;

    // 1. Aerodynamic expanding ring of cathedral limestone dust billows
    for (let i = 0; i < puffCount; i++) {
      const idx = allocSlot();
      const ang = (i / puffCount) * TWO_PI + (nextRand() - 0.5) * 0.24;
      const spd = ringOutSpeed * (0.78 + nextRand() * 0.42);
      const r0 = 0.24 + nextRand() * 0.22;

      kindArr[idx] = 0;
      px[idx] = sx + Math.cos(ang) * r0;
      py[idx] = groundY + 0.08 + nextRand() * 0.10;
      pz[idx] = sz + Math.sin(ang) * r0;
      vx[idx] = Math.cos(ang) * spd;
      vy[idx] = 0.28 + nextRand() * 0.55;
      vz[idx] = Math.sin(ang) * spd;
      groundYArr[idx] = groundY;
      size0Arr[idx] = (0.24 + nextRand() * 0.12) * clamp(intensity, 0.7, 1.3);
      size1Arr[idx] = size0Arr[idx] * 2.95;
      ageArr[idx] = 0;
      lifeArr[idx] = 0.68 + nextRand() * 0.28;
      dragArr[idx] = drag;
      gravArr[idx] = 0;
      liftArr[idx] = 0.42;
      bounceArr[idx] = 0;
      alphaArr[idx] = 0.34;
      heat0Arr[idx] = 0;
      heatArr[idx] = 0;
      seedArr[idx] = nextRand();
      setHexRgb(idx, phase2 ? 0x8d8174 : 0x867e73, 0.12);
      spawned++;
    }

    // 2. Shattered flagstone chips bouncing twice across the floor
    for (let i = 0; i < gritCount; i++) {
      const idx = allocSlot();
      const ang = nextRand() * TWO_PI;
      const spd = (4.2 + nextRand() * 4.8) * intensity;

      kindArr[idx] = 1;
      px[idx] = sx + Math.cos(ang) * 0.22;
      py[idx] = groundY + 0.06 + nextRand() * 0.08;
      pz[idx] = sz + Math.sin(ang) * 0.22;
      vx[idx] = Math.cos(ang) * spd;
      vy[idx] = (3.2 + nextRand() * 3.8) * clamp(intensity, 0.7, 1.35);
      vz[idx] = Math.sin(ang) * spd;
      groundYArr[idx] = groundY;
      size0Arr[idx] = 0.075 + nextRand() * 0.065;
      size1Arr[idx] = size0Arr[idx] * 0.88;
      ageArr[idx] = 0;
      lifeArr[idx] = 0.56 + nextRand() * 0.28;
      dragArr[idx] = 1.1;
      gravArr[idx] = 16.5;
      liftArr[idx] = 0;
      bounceArr[idx] = 0.36;
      alphaArr[idx] = 0.88;
      heat0Arr[idx] = 0;
      heatArr[idx] = 0;
      seedArr[idx] = nextRand();
      setHexRgb(idx, 0x5c554c, 0.16);
      spawned++;
    }

    // 3. Low-skimming forged-iron & ember sparks ricocheting across flagstones
    for (let i = 0; i < sparkCount; i++) {
      const idx = allocSlot();
      const ang = nextRand() * TWO_PI;
      const spd = (7.2 + nextRand() * 7.6) * clamp(intensity, 0.75, 1.4);

      kindArr[idx] = 2;
      px[idx] = sx + Math.cos(ang) * 0.18;
      py[idx] = groundY + 0.08 + nextRand() * 0.12;
      pz[idx] = sz + Math.sin(ang) * 0.18;
      vx[idx] = Math.cos(ang) * spd;
      vy[idx] = 1.6 + nextRand() * 4.4;
      vz[idx] = Math.sin(ang) * spd;
      groundYArr[idx] = groundY;
      size0Arr[idx] = 0.095 + nextRand() * 0.055;
      size1Arr[idx] = size0Arr[idx] * 0.55;
      ageArr[idx] = 0;
      lifeArr[idx] = 0.40 + nextRand() * 0.32;
      dragArr[idx] = 2.1;
      gravArr[idx] = 17.0;
      liftArr[idx] = 0;
      bounceArr[idx] = 0.42;
      alphaArr[idx] = 0.95;
      heat0Arr[idx] = phase2 ? 1.0 : 0.92;
      heatArr[idx] = heat0Arr[idx];
      seedArr[idx] = nextRand();
      setHexRgb(idx, phase2 ? 0xffd296 : 0xffe6ba, 0.08);
      spawned++;
    }

    return spawned;
  }

  /**
   * Spawns a tight directional sheaf (сноп искр) of velocity-stretched forged-steel sparks
   * on Parry, Shield Block, Guard Counter, or Blade-on-Armor clash, with real floor ricochet
   * and subtle gunmetal friction smoke.
   */
  function emitSteelSparkSheaf(x, y, z, dirX = 0, dirY = 0.35, dirZ = 1, sheafOpts = null) {
    if (disposed) return 0;
    const sx = Number.isFinite(Number(x)) ? Number(x) : 0;
    const sy = Number.isFinite(Number(y)) ? Number(y) : 1.05;
    const sz = Number.isFinite(Number(z)) ? Number(z) : 0;
    const kind = (sheafOpts && sheafOpts.kind) || 'parry';
    const preset = PRESETS_NORMAL[kind] || PRESETS_NORMAL.parry;
    const sheafSpec = preset.sheaf || PRESETS_NORMAL.parry.sheaf;
    const intensity = clamp(sanitizePositive(sheafOpts && sheafOpts.intensity, 1.0), 0.25, 2.0);
    const groundY = (sheafOpts && sheafOpts.groundY !== undefined && sheafOpts.groundY !== null && Number.isFinite(Number(sheafOpts.groundY)))
      ? Number(sheafOpts.groundY)
      : Math.max(0, sy - preset.yOffset);

    let nx = Number.isFinite(Number(dirX)) ? Number(dirX) : 0;
    let ny = Number.isFinite(Number(dirY)) ? Number(dirY) : preset.directional.upwardBias;
    let nz = Number.isFinite(Number(dirZ)) ? Number(dirZ) : 1;
    const dLen = Math.hypot(nx, ny, nz);
    if (dLen > EPSILON) {
      nx /= dLen;
      ny /= dLen;
      nz /= dLen;
    } else {
      nx = 0;
      ny = 0.42;
      nz = 1;
    }

    // Build orthonormal basis (u, v) perpendicular to primary sheaf axis (nx, ny, nz)
    let upX = 0;
    let upY = 1;
    let upZ = 0;
    if (Math.abs(ny) > 0.92) {
      upX = 1;
      upY = 0;
    }
    let ux = upY * nz - upZ * ny;
    let uy = upZ * nx - upX * nz;
    let uz = upX * ny - upY * nx;
    const uLen = Math.hypot(ux, uy, uz) || 1;
    ux /= uLen;
    uy /= uLen;
    uz /= uLen;
    const vxBasis = ny * uz - nz * uy;
    const vyBasis = nz * ux - nx * uz;
    const vzBasis = nx * uy - ny * ux;

    const sparkCount = scaledCount(Math.round(sheafSpec.sparkCount * intensity), 5);
    const smokeCount = scaledCount(Math.round(sheafSpec.smokeCount * intensity), 1);
    const coneHalf = sheafSpec.coneHalfRad;
    let spawned = 0;

    // 1. Focused directional steel spark sheaf (75% tight core jet + 25% wide ricochet spray)
    for (let i = 0; i < sparkCount; i++) {
      const idx = allocSlot();
      const isWideSpray = i >= sparkCount * 0.75;
      const spread = (isWideSpray ? coneHalf * 1.85 : coneHalf) * Math.pow(nextRand(), 0.68);
      const phi = nextRand() * TWO_PI;
      const sinS = Math.sin(spread);
      const cosS = Math.cos(spread);
      const cPhi = Math.cos(phi);
      const sPhi = Math.sin(phi);

      const rx = nx * cosS + (ux * cPhi + vxBasis * sPhi) * sinS;
      const ry = ny * cosS + (uy * cPhi + vyBasis * sPhi) * sinS;
      const rz = nz * cosS + (uz * cPhi + vzBasis * sPhi) * sinS;

      const spd = (sheafSpec.jetSpeedMin + nextRand() * (sheafSpec.jetSpeedMax - sheafSpec.jetSpeedMin))
        * (isWideSpray ? 0.72 : 1.0)
        * clamp(intensity, 0.7, 1.35);

      kindArr[idx] = 2;
      px[idx] = sx + nx * 0.06 + (nextRand() - 0.5) * 0.06;
      py[idx] = sy + (nextRand() - 0.5) * 0.06;
      pz[idx] = sz + nz * 0.06 + (nextRand() - 0.5) * 0.06;
      vx[idx] = rx * spd;
      vy[idx] = ry * spd + 0.8;
      vz[idx] = rz * spd;
      groundYArr[idx] = groundY;
      size0Arr[idx] = (kind === 'parry' || kind === 'parry_steel_sheaf' ? 0.105 : 0.085) * (0.75 + nextRand() * 0.5);
      size1Arr[idx] = size0Arr[idx] * 0.52;
      ageArr[idx] = 0;
      lifeArr[idx] = (0.28 + nextRand() * 0.28) * (kind === 'parry' || kind === 'parry_steel_sheaf' ? 1.18 : 1.0);
      dragArr[idx] = 2.4;
      gravArr[idx] = 16.5;
      liftArr[idx] = 0;
      bounceArr[idx] = sheafSpec.bounceRestitution;
      alphaArr[idx] = 0.96;
      heat0Arr[idx] = clamp(sheafSpec.initialHeat * (0.86 + nextRand() * 0.18), 0.5, 1.0);
      heatArr[idx] = heat0Arr[idx];
      seedArr[idx] = nextRand();
      setHexRgb(idx, 0xfff2d2, 0.06);
      spawned++;
    }

    // 2. Subtle gunmetal steel-clash micro-smoke wisp at impact point
    for (let i = 0; i < smokeCount; i++) {
      const idx = allocSlot();
      const ang = nextRand() * TWO_PI;
      const spd = 0.8 + nextRand() * 1.4;

      kindArr[idx] = 0;
      px[idx] = sx + (nextRand() - 0.5) * 0.10;
      py[idx] = sy + (nextRand() - 0.5) * 0.10;
      pz[idx] = sz + (nextRand() - 0.5) * 0.10;
      vx[idx] = nx * spd + Math.cos(ang) * 0.5;
      vy[idx] = 0.45 + nextRand() * 0.55;
      vz[idx] = nz * spd + Math.sin(ang) * 0.5;
      groundYArr[idx] = groundY;
      size0Arr[idx] = 0.13 + nextRand() * 0.07;
      size1Arr[idx] = size0Arr[idx] * 2.2;
      ageArr[idx] = 0;
      lifeArr[idx] = 0.34 + nextRand() * 0.18;
      dragArr[idx] = 5.5;
      gravArr[idx] = 0;
      liftArr[idx] = 0.35;
      bounceArr[idx] = 0;
      alphaArr[idx] = 0.18;
      heat0Arr[idx] = 0;
      heatArr[idx] = 0;
      seedArr[idx] = nextRand();
      setHexRgb(idx, 0x767980, 0.08);
      spawned++;
    }

    return spawned;
  }

  /**
   * Universal 1-line preset emitter: dispatches any `SOULS_SPARK_KINDS` preset to the
   * physical stone-dust / hammer-wave / directional steel-sheaf simulation.
   */
  function emitFromPreset(kind, x, y, z, dirX = 0, dirZ = 1, extraOpts = null) {
    if (disposed) return 0;
    const preset = PRESETS_NORMAL[kind] || PRESETS_NORMAL.sword_armor;
    const safeY = (y !== undefined && y !== null && Number.isFinite(Number(y))) ? Number(y) : 0;
    const groundY = (extraOpts && extraOpts.groundY !== undefined && extraOpts.groundY !== null && Number.isFinite(Number(extraOpts.groundY)))
      ? Number(extraOpts.groundY)
      : safeY;

    if (preset.vfxMode === 'hammer_dust_wave') {
      return emitHammerSlamWave(x, groundY, z, {
        groundY,
        radius: (extraOpts && extraOpts.radius) || (preset.stoneDust && preset.stoneDust.ringRadius) || 4.4,
        intensity: (extraOpts && extraOpts.intensity) || 1.0,
        phase2: Boolean(extraOpts && extraOpts.phase2)
      });
    }

    if (preset.vfxMode === 'footstep_dust') {
      return emitFootstepDust(x, groundY + (preset.kind === 'cutscene_door_dust' ? 1.6 : 0), z, {
        groundY,
        actorKind: preset.kind === 'boss_footstep_dust' || preset.kind === 'cutscene_door_dust' ? 'boss' : 'knight',
        dirX,
        dirZ,
        intensity: (extraOpts && extraOpts.intensity) || 1.0
      });
    }

    if (preset.vfxMode === 'stone_and_sparks') {
      const n1 = emitFootstepDust(x, groundY, z, {
        groundY,
        actorKind: 'boss',
        dirX: -dirX,
        dirZ: -dirZ,
        intensity: 0.85
      });
      const n2 = emitSteelSparkSheaf(x, groundY + preset.yOffset, z, dirX, preset.directional.upwardBias, dirZ, {
        kind: preset.kind,
        groundY,
        intensity: (extraOpts && extraOpts.intensity) || 1.0
      });
      return n1 + n2;
    }

    const clashY = (extraOpts && extraOpts.clashY !== undefined && extraOpts.clashY !== null && Number.isFinite(Number(extraOpts.clashY)))
      ? Number(extraOpts.clashY)
      : groundY + preset.yOffset;
    return emitSteelSparkSheaf(x, clashY, z, dirX, preset.directional.upwardBias, dirZ, {
      kind: preset.kind,
      groundY,
      intensity: (extraOpts && extraOpts.intensity) || 1.0
    });
  }

  /**
   * Advances physical stone dust & steel spark simulation and packs active instances (0 GC/frame).
   *
   * @param {number} dt
   */
  function update(dt) {
    if (disposed) return;
    const safeDt = clamp(sanitizePositive(dt, 0), 0, 0.1);
    if (activeCount === 0) {
      mesh.visible = false;
      geo.instanceCount = 0;
      return;
    }

    let outIdx = 0;
    for (let i = 0; i < maxParticles; i++) {
      if (active[i] === 0) continue;

      if (safeDt > 0) {
        ageArr[i] += safeDt;
        if (ageArr[i] >= lifeArr[i]) {
          active[i] = 0;
          activeCount = Math.max(0, activeCount - 1);
          continue;
        }

        const damp = Math.exp(-dragArr[i] * safeDt);
        vx[i] *= damp;
        vz[i] *= damp;
        if (kindArr[i] < 0.5) {
          vy[i] = vy[i] * damp + liftArr[i] * safeDt;
        } else {
          vy[i] -= gravArr[i] * safeDt;
        }

        px[i] += vx[i] * safeDt;
        py[i] += vy[i] * safeDt;
        pz[i] += vz[i] * safeDt;

        // Real flagstone bounce & friction skid for pebbles and steel sparks
        const floorY = groundYArr[i] + 0.018;
        if (bounceArr[i] > 0 && py[i] <= floorY && vy[i] < 0) {
          py[i] = floorY;
          vy[i] = -vy[i] * bounceArr[i];
          vx[i] *= 0.72;
          vz[i] *= 0.72;
          if (kindArr[i] >= 1.5) {
            // Brief frictional spark glint on flagstone strike
            heatArr[i] = Math.min(1.0, heatArr[i] + 0.14);
          }
        }
      }

      const age01 = clamp(ageArr[i] / lifeArr[i], 0, 1);
      const curSize = size0Arr[i] + (size1Arr[i] - size0Arr[i]) * (1 - (1 - age01) * (1 - age01));
      if (kindArr[i] >= 1.5) {
        heatArr[i] = heat0Arr[i] * Math.pow(1 - age01, 0.78);
      }

      const b4 = outIdx * 4;
      const b3 = outIdx * 3;
      gpuPosSize[b4] = px[i];
      gpuPosSize[b4 + 1] = py[i];
      gpuPosSize[b4 + 2] = pz[i];
      gpuPosSize[b4 + 3] = curSize;

      gpuVelKind[b4] = vx[i];
      gpuVelKind[b4 + 1] = vy[i];
      gpuVelKind[b4 + 2] = vz[i];
      gpuVelKind[b4 + 3] = kindArr[i];

      gpuLifeSeed[b4] = age01;
      gpuLifeSeed[b4 + 1] = alphaArr[i];
      gpuLifeSeed[b4 + 2] = heatArr[i];
      gpuLifeSeed[b4 + 3] = seedArr[i];

      gpuTint[b3] = crArr[i];
      gpuTint[b3 + 1] = cgArr[i];
      gpuTint[b3 + 2] = cbArr[i];

      outIdx++;
    }

    activeCount = outIdx;
    geo.instanceCount = outIdx;
    mesh.visible = outIdx > 0;

    if (outIdx > 0) {
      attrPosSize.needsUpdate = true;
      attrVelKind.needsUpdate = true;
      attrLifeSeed.needsUpdate = true;
      attrTint.needsUpdate = true;
    }
  }

  function clearAll() {
    active.fill(0);
    activeCount = 0;
    cursor = 0;
    geo.instanceCount = 0;
    mesh.visible = false;
  }

  function setLowSpec(enabled) {
    lowSpec = Boolean(enabled);
  }

  function getActiveCount() {
    return activeCount;
  }

  function getDrawCallCount() {
    return !disposed && mesh.visible && geo.instanceCount > 0 ? 1 : 0;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearAll();
    if (mesh.parent) {
      mesh.parent.remove(mesh);
    }
    geo.dispose();
    mat.dispose();
  }

  return {
    mesh,
    emitFootstepDust,
    emitHammerSlamWave,
    emitSteelSparkSheaf,
    emitFromPreset,
    update,
    clearAll,
    setLowSpec,
    getActiveCount,
    getDrawCallCount,
    dispose
  };
}

function evalCutsceneEnvelope(envelope, u) {
  const t = clamp(u, 0, 1);
  if (envelope === 'bell') {
    return Math.sin(t * Math.PI);
  }
  if (envelope === 'surge') {
    if (t < 0.22) return Math.sin((t / 0.22) * (Math.PI * 0.5));
    if (t < 0.72) return 0.92 + 0.08 * Math.sin(((t - 0.22) / 0.50) * Math.PI);
    return Math.cos(((t - 0.72) / 0.28) * (Math.PI * 0.5));
  }
  const inv = 1 - t;
  return inv * inv;
}

/**
 * Creates a Souls-like Combat Game Feel controller:
 * 1. Framerate-independent Hitstop (0.06x time scale, anti-sticky cooldown, anti-hang cap).
 * 2. Near-critically damped 3D spring camera kicks + castle gate & cutscene seismic rumble (0 GC/frame).
 * 3. Physical stone dust & directional Planck-blackbody steel spark sheaf presets + optional attached
 *    1-Draw-Call GPU `createSoulsImpactVfxSystem` (`attachImpactVfxScene` / `config.scene`).
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
  let impactVfx = config.scene
    ? createSoulsImpactVfxSystem(config.scene, {
        isMobile: config.isMobile,
        lowSpec: lowSpecMode,
        maxParticles: config.maxParticles
      })
    : null;

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

  // --- Timed Cutscene Seismic Tremor state ---
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

    const cappedTotal = Math.min(duration, maxContinuousSlowSec - continuousSlowTime);
    if (cappedTotal <= hitstopRemaining + EPSILON) {
      return false;
    }

    hitstopRemaining = cappedTotal;
    hitstopCooldown = Math.max(baseCooldownSec, hitstopRemaining + postBreathSec);
    return true;
  }

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
      hitstopRemaining = 0;
      continuousSlowTime = 0;
      recoveryLockTimer = Math.max(recoveryLockTimer, recoveryLockSec);
    } else if (hitstopRemaining === 0 && normalSlice > 0) {
      continuousSlowTime = Math.max(0, continuousSlowTime - normalSlice * 1.5);
    }

    return slowSlice * timeScale + normalSlice;
  }

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
      ny = -0.88;
    }

    if (opts && Number.isFinite(Number(opts.dirY))) {
      ny = clamp(Number(opts.dirY), -1.0, 1.0);
    }

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

    const shudder = sanitizeNonNegative(cutsceneState.doorShudder, 0);
    if (shudder > 0.02) {
      setDoorRumble(clamp(shudder * 0.85, 0, 1.0), { profile: 'door' });
    } else {
      setDoorRumble(0);
    }

    return stepCameraShake(dt);
  }

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

    if (impactVfx && opts && Number.isFinite(Number(opts.x)) && Number.isFinite(Number(opts.z))) {
      impactVfx.emitFromPreset(sparkKind, Number(opts.x), Number(opts.y) || 0, Number(opts.z), dirX, dirZ, {
        intensity: scale
      });
    }

    comboFeedbackOutput.attackId = preset.id;
    comboFeedbackOutput.sparkBurst = sparkBurst;
    comboFeedbackOutput.hitstopTriggered = hitstopTriggered;
    comboFeedbackOutput.kickIntensity = kickIntensity;

    return comboFeedbackOutput;
  }

  // --- Attached GPU Impact VFX System wrappers ---
  function attachImpactVfxScene(scene, vfxOpts = null) {
    if (impactVfx) {
      impactVfx.dispose();
      impactVfx = null;
    }
    if (!scene) return null;
    impactVfx = createSoulsImpactVfxSystem(scene, {
      isMobile: vfxOpts && vfxOpts.isMobile,
      lowSpec: vfxOpts && vfxOpts.lowSpec !== undefined ? Boolean(vfxOpts.lowSpec) : lowSpecMode,
      maxParticles: vfxOpts && vfxOpts.maxParticles
    });
    return impactVfx;
  }

  function getImpactVfxSystem() {
    return impactVfx;
  }

  function emitFootstepDust(x, y, z, stepOpts = null) {
    const isBoss = Boolean(stepOpts && stepOpts.actorKind === 'boss');
    if (isBoss && (!stepOpts || stepOpts.withShake !== false)) {
      const atten = clamp(sanitizePositive(stepOpts && stepOpts.shakeScale, 1.0), 0, 1.5);
      if (atten > 0.02) {
        triggerKick(0, 0, 0.16 * atten, { dirY: -0.85 });
      }
    }
    return impactVfx ? impactVfx.emitFootstepDust(x, y, z, stepOpts) : 0;
  }

  function emitHammerSlamWave(x, y, z, slamOpts = null) {
    const intensity = clamp(sanitizePositive(slamOpts && slamOpts.intensity, 1.0), 0.25, 2.0);
    if (!slamOpts || slamOpts.withShake !== false) {
      triggerKick(0, 0, 1.05 * intensity, { dirY: -0.92 });
    }
    if (slamOpts && slamOpts.withHitstop) {
      triggerHitstop('boss_hammer_ground');
    }
    return impactVfx ? impactVfx.emitHammerSlamWave(x, y, z, slamOpts) : 0;
  }

  function emitSteelSparkSheaf(x, y, z, dirX = 0, dirY = 0.38, dirZ = 1, sheafOpts = null) {
    return impactVfx ? impactVfx.emitSteelSparkSheaf(x, y, z, dirX, dirY, dirZ, sheafOpts) : 0;
  }

  function updateVfx(dt) {
    if (impactVfx) impactVfx.update(dt);
  }

  function clearVfx() {
    if (impactVfx) impactVfx.clearAll();
  }

  function dispose() {
    if (impactVfx) {
      impactVfx.dispose();
      impactVfx = null;
    }
    reset();
  }

  function sampleSeismicProfile(profile, phase, intensity, out) {
    if (intensity <= 1e-4) {
      out.x = 0;
      out.y = 0;
      out.z = 0;
      return;
    }

    if (profile === 'bolt') {
      const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * 0.85 * intensity;
      const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * 0.95 * intensity;
      out.x = (0.58 * Math.sin(phase * 54.3) + 0.42 * Math.sin(phase * 83.7 + 0.6)) * ampXZ;
      out.y = (0.62 * Math.cos(phase * 62.9) + 0.38 * Math.sin(phase * 91.1 + 1.2)) * ampY;
      out.z = (0.56 * Math.cos(phase * 58.1 + 0.9) + 0.44 * Math.cos(phase * 79.3)) * ampXZ;
      return;
    }

    if (profile === 'roar') {
      const roarMod = 0.78 + 0.22 * Math.sin(phase * 11.2);
      const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * 1.18 * intensity * roarMod;
      const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * 1.25 * intensity * roarMod;
      out.x = (0.50 * Math.sin(phase * 29.3) + 0.32 * Math.sin(phase * 46.7 + 0.8) + 0.18 * Math.sin(phase * 71.9)) * ampXZ;
      out.y = (0.52 * Math.cos(phase * 33.1) + 0.30 * Math.sin(phase * 53.7 + 1.4) + 0.18 * Math.cos(phase * 77.3)) * ampY;
      out.z = (0.50 * Math.cos(phase * 31.7 + 0.5) + 0.32 * Math.cos(phase * 49.3) + 0.18 * Math.sin(phase * 68.9)) * ampXZ;
      return;
    }

    if (profile === 'slam') {
      const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * 0.95 * intensity;
      const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * 1.45 * intensity;
      out.x = (0.60 * Math.sin(phase * 31.3) + 0.40 * Math.sin(phase * 53.1 + 0.5)) * ampXZ;
      out.y = (0.66 * Math.cos(phase * 27.9) + 0.34 * Math.sin(phase * 57.7 + 0.9)) * ampY;
      out.z = (0.60 * Math.cos(phase * 34.7 + 1.1) + 0.40 * Math.cos(phase * 51.3)) * ampXZ;
      return;
    }

    const grindMod = 0.72 + 0.28 * Math.sin(phase * 7.4);
    const ampXZ = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_XZ * intensity * grindMod;
    const ampY = SOULS_GAMEFEEL_CFG.RUMBLE_AMP_Y * intensity * grindMod;
    out.x = (0.62 * Math.sin(phase * 39.7) + 0.38 * Math.sin(phase * 61.3 + 1.1)) * ampXZ;
    out.y = (0.58 * Math.cos(phase * 47.9) + 0.42 * Math.sin(phase * 73.1 + 0.4)) * ampY;
    out.z = (0.62 * Math.cos(phase * 43.3 + 0.7) + 0.38 * Math.cos(phase * 67.1)) * ampXZ;
  }

  const _doorVec = { x: 0, y: 0, z: 0 };
  const _cutsceneVec = { x: 0, y: 0, z: 0 };

  function stepCameraShake(dt) {
    const safeDt = sanitizePositive(dt, 0);

    if (safeDt > 0) {
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

      const rate = doorRumbleTarget > doorRumbleCurrent
        ? SOULS_GAMEFEEL_CFG.RUMBLE_ATTACK_RATE
        : SOULS_GAMEFEEL_CFG.RUMBLE_RELEASE_RATE;
      const alpha = 1 - Math.exp(-rate * safeDt);
      doorRumbleCurrent += (doorRumbleTarget - doorRumbleCurrent) * alpha;

      if (doorRumbleTarget === 0 && doorRumbleCurrent < 1e-4) {
        doorRumbleCurrent = 0;
      }

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
        rumblePhase = (rumblePhase + safeDt) % 628.3185307179586;
      }
    }

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
    if (impactVfx) impactVfx.setLowSpec(lowSpecMode);
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
    if (impactVfx) impactVfx.clearAll();
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
      vfxActiveParticles: impactVfx ? impactVfx.getActiveCount() : 0,
      vfxDrawCalls: impactVfx ? impactVfx.getDrawCallCount() : 0,
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
    attachImpactVfxScene,
    getImpactVfxSystem,
    emitFootstepDust,
    emitHammerSlamWave,
    emitSteelSparkSheaf,
    updateVfx,
    clearVfx,
    dispose,
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
