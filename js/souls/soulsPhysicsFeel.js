// Souls-like Combat Physics, Weight Feel, Dynamic Posture Inertia & Foot-Speed Sync
// Pure zero-dependency Vanilla ES module (Browser / Three.js / Node compatible, PC & Mobile).
//
// Solves three classic action-RPG feel failures:
//   1. Linear / mass-less knockback -> Real (physVx, physVz) momentum body with
//      framerate-independent analytical two-regime stone friction (kinetic skid -> static boot grip),
//      armor-mass differentiation (heavy plate stops solid; light mobs fly farther),
//      and dull castle-wall bounce with limestone dust & steel-on-stone spark events.
//   2. Wooden upright linear swings -> Procedural body-inertia posture layer
//      { pitchRad, rollRad, yawOffsetRad, bobY, forwardLean } driven by attack phase
//      (windup coil -> active whip & spring plant -> heavy follow-through overshoot & elastic settle)
//      plus a directional critically damped spring for hitRecoil / clashRecoil / parry / wall slam.
//   3. "Treadmill" skating feet -> Exact biomechanical foot-sync playback rate computed from
//      actual horizontal speed Math.hypot(vx, vz) and anatomical model stride length.
//
// Performance contract:
//   - 0 heap allocations in the per-frame hot loop (all per-actor state & outputs reused in-place).
//   - 0 global actor maps (zero memory leaks on enemy death / pool recycle / bonfire respawn).

const TWO_PI = Math.PI * 2;
const EPS = 1e-6;

// ============================================================================
// 1. Physics Tuning Constants & Actor Mass/Biomechanics Profiles
// ============================================================================

export const SOULS_PHYSICS_CFG = Object.freeze({
  MAX_DT: 0.1,
  STOP_SPEED_EPS: 0.035,
  SKID_SPEED_THRESHOLD: 1.85,
  WALL_PENETRATION_EPS: 1e-4,
  WALL_TANGENTIAL_DAMP: 0.62,
  WALL_GLANCE_TANGENTIAL_DAMP: 0.78,
  WALL_MAX_REBOUND_SPEED: 3.85,
  WALL_COOLDOWN_SEC: 0.18,
  SPRING_POS_EPS: 1e-4,
  SPRING_VEL_EPS: 1e-3,

  // Safe anatomical posture bounds (subtle readable weight, strictly grounded boots — zero floating/bowling-pin tilt!)
  MAX_PITCH_BACK_RAD: -0.16,
  MAX_PITCH_FWD_RAD: 0.17,
  MAX_ROLL_RAD: 0.14,
  MAX_YAW_OFFSET_RAD: 0.22,
  MAX_BOB_DOWN_M: 0.0,
  MAX_BOB_UP_M: 0.022,
  MAX_LEAN_BACK_M: -0.05,
  MAX_LEAN_FWD_M: 0.06,
  MAX_LATERAL_SHIFT_M: 0.04,

  // Colossal Boss (`boss_troll` / `boss_warden`) strict anti-wobble & floor-guard limits:
  //   - Zero bowling-pin tilt in neutral / idle / recover / stagger
  //   - Hard `bobY >= 0.0` floor guard (never sinks knees/feet/hammer below y = 0)
  //   - Soft overhead/slam pitch ceiling so baked heavy slams never clip through stone flagstones
  BOSS_MAX_PITCH_BACK_RAD: -0.09,
  BOSS_MAX_PITCH_FWD_RAD: 0.095,
  BOSS_OVERHEAD_MAX_PITCH_FWD_RAD: 0.08,
  BOSS_MAX_ROLL_RAD: 0.075,
  BOSS_MAX_YAW_OFFSET_RAD: 0.12,
  BOSS_MIN_BOB_Y_M: 0.0,
  BOSS_MAX_BOB_UP_M: 0.025,
  BOSS_MAX_LEAN_BACK_M: -0.04,
  BOSS_MAX_LEAN_FWD_M: 0.05,
  BOSS_MAX_LATERAL_SHIFT_M: 0.035,
  BOSS_RECOIL_SCALE: 0.34,

  // Foot-sync biomechanical defaults (strict 1:1 ground lock across full combat speed range)
  FOOT_STOP_SPEED: 0.06,
  FOOT_RAMP_END_SPEED: 0.18,
  FOOT_MIN_RATE: 0.32,
  FOOT_MAX_RATE: 2.55,
  FOOT_HIGH_SPEED_KNEE: 2.15,
  FOOT_HIGH_SPEED_POWER: 0.96,

  // Low-spec VFX particle scale for mobile Yandex Games
  LOW_SPEC_VFX_SCALE: 0.55
});

export const SOULS_PHYSICS_PROFILES = Object.freeze({
  hero: Object.freeze({
    id: 'hero',
    mass: 1.0,
    stoneFriction: 11.8,
    slidingFriction: 7.4,
    knockbackResist: 1.0,
    wallRestitution: 0.26,
    wallImpactMinSpeed: 2.5,
    maxPhysSpeed: 13.5,
    // Calibrated to Warrior_Run.glb (Running_A = 2.20s, ~3.49m per 2-step cycle at scale 1.0)
    strideLength: 3.49,
    patrolStrideLength: 0,
    strafeStrideLength: 0,
    clipDuration: 2.20,
    nominalRate: 2.65,
    maxPlaybackRate: 3.35,
    referenceScale: 1.0,
    encounterReferenceScale: 1.0,
    postureScale: 1.0,
    weaponHeft: 0.95,
    recoilOmega: 24.5,
    recoilZeta: 0.96,
    armorMaterial: 'steel'
  }),
  iron_knight: Object.freeze({
    id: 'iron_knight',
    mass: 1.65,
    stoneFriction: 13.8,
    slidingFriction: 8.8,
    knockbackResist: 0.66,
    wallRestitution: 0.20,
    wallImpactMinSpeed: 2.2,
    maxPhysSpeed: 10.5,
    // Exact FK-measured from Rift_Executioner_Tripo.glb at in-game liveScale = 2.217:
    // Combat_Walk = 1.23m (0.950s), Patrol_Walk = 1.28m (1.283s), Strafe_Left/Right = 0.72m (0.883s)
    strideLength: 1.23,
    patrolStrideLength: 1.28,
    strafeStrideLength: 0.72,
    clipDuration: 0.950,
    nominalRate: 1.0,
    maxPlaybackRate: 2.35,
    referenceScale: 2.22,
    encounterReferenceScale: 1.18,
    postureScale: 0.42,
    weaponHeft: 1.15,
    recoilOmega: 19.5,
    recoilZeta: 0.98,
    armorMaterial: 'heavy_plate'
  }),
  cursed_footman: Object.freeze({
    id: 'cursed_footman',
    mass: 1.15,
    stoneFriction: 11.0,
    slidingFriction: 7.0,
    knockbackResist: 0.86,
    wallRestitution: 0.28,
    wallImpactMinSpeed: 2.35,
    maxPhysSpeed: 12.5,
    // Exact FK-measured from Rift_Vanguard_Tripo.glb at in-game liveScale = 2.175:
    // Combat_Walk = 0.83m (0.933s), Patrol_Walk = 0.95m (1.200s), Strafe_Left/Right = 0.59m (0.800s)
    strideLength: 0.83,
    patrolStrideLength: 0.95,
    strafeStrideLength: 0.59,
    clipDuration: 0.933,
    nominalRate: 1.0,
    maxPlaybackRate: 2.55,
    referenceScale: 2.18,
    encounterReferenceScale: 1.12,
    postureScale: 0.40,
    weaponHeft: 0.95,
    recoilOmega: 23.0,
    recoilZeta: 0.95,
    armorMaterial: 'iron'
  }),
  bone_archer: Object.freeze({
    id: 'bone_archer',
    mass: 0.78,
    stoneFriction: 8.6,
    slidingFriction: 5.8,
    knockbackResist: 1.12,
    wallRestitution: 0.34,
    wallImpactMinSpeed: 1.95,
    maxPhysSpeed: 14.5,
    // Exact FK-measured from Rift_Acolyte_Tripo.glb at in-game liveScale = 2.246:
    strideLength: 1.25,
    patrolStrideLength: 1.15,
    strafeStrideLength: 0.95,
    clipDuration: 0.800,
    nominalRate: 1.0,
    maxPlaybackRate: 2.45,
    referenceScale: 2.25,
    encounterReferenceScale: 1.08,
    postureScale: 0.38,
    weaponHeft: 0.65,
    recoilOmega: 27.0,
    recoilZeta: 0.92,
    armorMaterial: 'light_cloth'
  }),
  souls_boss: Object.freeze({
    id: 'souls_boss',
    mass: 3.8,
    stoneFriction: 16.5,
    slidingFriction: 11.5,
    knockbackResist: 0.34,
    wallRestitution: 0.15,
    wallImpactMinSpeed: 1.8,
    maxPhysSpeed: 8.2,
    // Exact FK-measured from Rift_Boss_Tripo.glb v2 at in-game liveScale = 3.7615:
    //   Walking (1.350s) = 2.26m 2-step stride (1.68 m/s @ 1.0x -> 1.58x @ 2.65 m/s)
    //   Strafe_Left/Right (1.100s) = 1.15m 2-step lateral stride (1.05 m/s @ 1.0x -> 1.96x @ 2.06 m/s)
    //   Walk_Backward (1.200s) = 1.40m 2-step backstep stride (LOCOMOTION_STRIDE_MULT.backstep = 0.62)
    strideLength: 2.26,
    patrolStrideLength: 2.26,
    strafeStrideLength: 1.15,
    clipDuration: 1.350,
    nominalRate: 1.0,
    maxPlaybackRate: 2.30,
    referenceScale: 3.76,
    encounterReferenceScale: 3.76,
    postureScale: 0.28,
    weaponHeft: 1.0,
    recoilOmega: 15.5,
    recoilZeta: 0.99,
    armorMaterial: 'colossal_plate'
  }),
  pve_skeleton: Object.freeze({
    id: 'pve_skeleton',
    mass: 0.85,
    stoneFriction: 10.5,
    slidingFriction: 6.8,
    knockbackResist: 1.05,
    wallRestitution: 0.28,
    wallImpactMinSpeed: 2.1,
    maxPhysSpeed: 13.5,
    strideLength: 0.72,
    patrolStrideLength: 0.72,
    strafeStrideLength: 0.56,
    clipDuration: 1.067,
    nominalRate: 1.0,
    maxPlaybackRate: 2.75,
    referenceScale: 1.0,
    encounterReferenceScale: 1.0,
    postureScale: 0.36,
    weaponHeft: 0.8,
    recoilOmega: 24.0,
    recoilZeta: 0.94,
    armorMaterial: 'bone'
  }),
  pve_zombie: Object.freeze({
    id: 'pve_zombie',
    mass: 1.1,
    stoneFriction: 11.2,
    slidingFriction: 7.2,
    knockbackResist: 0.92,
    wallRestitution: 0.24,
    wallImpactMinSpeed: 2.2,
    maxPhysSpeed: 12.0,
    strideLength: 0.92,
    patrolStrideLength: 0.92,
    strafeStrideLength: 0.65,
    clipDuration: 0.900,
    nominalRate: 1.0,
    maxPlaybackRate: 2.65,
    referenceScale: 2.02,
    encounterReferenceScale: 2.02,
    postureScale: 0.36,
    weaponHeft: 0.85,
    recoilOmega: 21.0,
    recoilZeta: 0.96,
    armorMaterial: 'flesh'
  }),
  pve_barbarian: Object.freeze({
    id: 'pve_barbarian',
    mass: 1.1,
    stoneFriction: 11.5,
    slidingFriction: 7.5,
    knockbackResist: 0.9,
    wallRestitution: 0.25,
    wallImpactMinSpeed: 2.2,
    maxPhysSpeed: 14.0,
    strideLength: 0.84,
    patrolStrideLength: 0.84,
    strafeStrideLength: 0.62,
    clipDuration: 1.067,
    nominalRate: 1.0,
    maxPlaybackRate: 2.85,
    referenceScale: 0.95,
    encounterReferenceScale: 0.95,
    postureScale: 0.36,
    weaponHeft: 0.95,
    recoilOmega: 22.0,
    recoilZeta: 0.95,
    armorMaterial: 'leather'
  }),
  pve_boss_humanoid: Object.freeze({
    id: 'pve_boss_humanoid',
    mass: 2.8,
    stoneFriction: 14.5,
    slidingFriction: 9.8,
    knockbackResist: 0.45,
    wallRestitution: 0.18,
    wallImpactMinSpeed: 2.0,
    maxPhysSpeed: 10.5,
    strideLength: 1.48,
    patrolStrideLength: 1.48,
    strafeStrideLength: 1.02,
    clipDuration: 1.067,
    nominalRate: 1.0,
    maxPlaybackRate: 2.45,
    referenceScale: 1.72,
    encounterReferenceScale: 1.72,
    postureScale: 0.30,
    weaponHeft: 1.1,
    recoilOmega: 17.5,
    recoilZeta: 0.98,
    armorMaterial: 'heavy_plate'
  })
});

const PROFILE_ALIASES = Object.freeze({
  hero: 'hero',
  player: 'hero',
  warrior: 'hero',
  warrior_run: 'hero',
  mage: 'hero',
  gunslinger: 'hero',

  iron_knight: 'iron_knight',
  rift_executioner: 'iron_knight',
  executioner: 'iron_knight',
  heavy_knight: 'iron_knight',
  duelist: 'iron_knight',
  armory_warden: 'iron_knight',

  cursed_footman: 'cursed_footman',
  rift_vanguard: 'cursed_footman',
  vanguard: 'cursed_footman',
  guard: 'cursed_footman',
  shieldbearer: 'cursed_footman',

  bone_archer: 'bone_archer',
  rift_acolyte: 'bone_archer',
  acolyte: 'bone_archer',
  archer: 'bone_archer',

  ember_skeleton: 'pve_skeleton',
  skeleton: 'pve_skeleton',
  skeleton_minion: 'pve_skeleton',
  skeleton_warrior: 'pve_skeleton',
  skeleton_mage: 'pve_skeleton',
  skeleton_rogue: 'pve_skeleton',
  plague_zombie: 'pve_zombie',
  zombie: 'pve_zombie',
  goblin: 'pve_barbarian',
  werewolf: 'pve_barbarian',
  barbarian: 'pve_barbarian',
  boss_butcher: 'pve_boss_humanoid',
  boss_archlich: 'pve_boss_humanoid',
  boss_cthulhu: 'pve_boss_humanoid',
  boss_ashlord: 'pve_boss_humanoid',

  souls_boss: 'souls_boss',
  boss: 'souls_boss',
  boss_troll: 'souls_boss',
  boss_warden: 'souls_boss',
  troll_tripo: 'souls_boss',
  rift_boss: 'souls_boss'
});

// Anatomical stride length multipliers per movement gait mode
const LOCOMOTION_STRIDE_MULT = Object.freeze({
  idle: 1.0,
  patrol: 0.88,
  walk: 0.96,
  combat_walk: 1.0,
  approach: 1.0,
  run: 1.05,
  sprint: 1.22,
  strafe: 0.78,
  strafe_left: 0.78,
  strafe_right: 0.78,
  circle: 0.86,
  retreat: 0.94,
  walk_back: 0.94,
  backstep: 0.96,
  turn_left: 0.72,
  turn_right: 0.72
});

// ============================================================================
// 2. Attack Move Biomechanical Posture Profiles
//    Each move defines windup coil, active strike snap, landing spring, and
//    heavy follow-through overshoot for { pitch, roll, yaw, bobY, lean, lateral }.
// ============================================================================

export const SOULS_MOVE_POSTURE_PROFILES = Object.freeze({
  slash: Object.freeze({
    id: 'slash',
    // Right-to-left sweeping cleave
    wPitch: -0.17, wRoll: 0.12, wYaw: -0.30, wBob: -0.062, wLean: -0.10, wLat: -0.04,
    aPitch: 0.23, aRoll: -0.18, aYaw: 0.28, aBob: -0.084, aLean: 0.16, aLat: 0.05,
    plantSpringBob: 0.030,
    rOverPitch: 0.055, rOverRoll: -0.04, rOverYaw: 0.085, rOverBob: -0.022, rOverLean: 0.038,
    overEndU: 0.28,
    windupLiftAtApex: 0.0
  }),
  slash_backhand: Object.freeze({
    id: 'slash_backhand',
    // Left-to-right mirror cleave (flows seamlessly out of `slash` recovery!)
    wPitch: -0.14, wRoll: -0.13, wYaw: 0.28, wBob: -0.058, wLean: -0.085, wLat: 0.04,
    aPitch: 0.22, aRoll: 0.18, aYaw: -0.27, aBob: -0.080, aLean: 0.15, aLat: -0.05,
    plantSpringBob: 0.028,
    rOverPitch: 0.050, rOverRoll: 0.04, rOverYaw: -0.080, rOverBob: -0.020, rOverLean: 0.034,
    overEndU: 0.27,
    windupLiftAtApex: 0.0
  }),
  overhead: Object.freeze({
    id: 'overhead',
    // Massive vertical heavy smash: crouch gather -> lift heave -> violent slam -> weapon heft pull-up
    wPitch: -0.30, wRoll: 0.05, wYaw: -0.10, wBob: -0.068, wLean: -0.135, wLat: -0.02,
    aPitch: 0.37, aRoll: -0.075, aYaw: 0.12, aBob: -0.122, aLean: 0.20, aLat: 0.02,
    plantSpringBob: 0.042,
    rOverPitch: 0.075, rOverRoll: -0.015, rOverYaw: 0.035, rOverBob: -0.036, rOverLean: 0.045,
    overEndU: 0.34,
    windupLiftAtApex: 0.112
  }),
  thrust: Object.freeze({
    id: 'thrust',
    // Compact fencer/halberd coil -> razor-sharp forward extension -> lead-boot catch
    wPitch: -0.14, wRoll: 0.10, wYaw: -0.25, wBob: -0.085, wLean: -0.125, wLat: -0.03,
    aPitch: 0.31, aRoll: -0.09, aYaw: 0.14, aBob: -0.076, aLean: 0.24, aLat: 0.02,
    plantSpringBob: 0.026,
    rOverPitch: 0.045, rOverRoll: -0.02, rOverYaw: 0.035, rOverBob: -0.018, rOverLean: 0.045,
    overEndU: 0.24,
    windupLiftAtApex: 0.0
  }),
  shield_bash: Object.freeze({
    id: 'shield_bash',
    // Deep braced crouch -> explosive left-shoulder/shield ram -> firm guard lock
    wPitch: -0.11, wRoll: -0.16, wYaw: 0.22, wBob: -0.095, wLean: -0.085, wLat: 0.045,
    aPitch: 0.26, aRoll: 0.21, aYaw: -0.23, aBob: -0.066, aLean: 0.19, aLat: -0.04,
    plantSpringBob: 0.025,
    rOverPitch: 0.042, rOverRoll: 0.04, rOverYaw: -0.045, rOverBob: -0.016, rOverLean: 0.032,
    overEndU: 0.24,
    windupLiftAtApex: 0.0
  }),
  leap_slam: Object.freeze({
    id: 'leap_slam',
    // Colossal airborne slam: crouch coil -> skyward launch -> thunderous crater impact
    wPitch: -0.24, wRoll: 0.04, wYaw: -0.08, wBob: -0.135, wLean: -0.11, wLat: 0.0,
    aPitch: 0.38, aRoll: -0.06, aYaw: 0.10, aBob: -0.155, aLean: 0.21, aLat: 0.0,
    plantSpringBob: 0.052,
    rOverPitch: 0.082, rOverRoll: -0.015, rOverYaw: 0.025, rOverBob: -0.042, rOverLean: 0.048,
    overEndU: 0.36,
    windupLiftAtApex: 0.19
  }),
  whirl_spin: Object.freeze({
    id: 'whirl_spin',
    // Cyclonic heavy momentum: deep torque windup -> centrifugal bank -> hard boot brake
    wPitch: -0.16, wRoll: 0.17, wYaw: -0.38, wBob: -0.105, wLean: -0.09, wLat: -0.04,
    aPitch: 0.18, aRoll: -0.24, aYaw: 0.26, aBob: -0.085, aLean: 0.12, aLat: 0.06,
    plantSpringBob: 0.024,
    rOverPitch: 0.04, rOverRoll: 0.11, rOverYaw: 0.12, rOverBob: -0.03, rOverLean: 0.025,
    overEndU: 0.32,
    windupLiftAtApex: 0.0
  }),
  shot: Object.freeze({
    id: 'shot',
    // Archer bow/staff brace -> crisp string-release kickback -> smooth relax
    wPitch: -0.08, wRoll: 0.06, wYaw: -0.22, wBob: -0.038, wLean: -0.065, wLat: -0.02,
    aPitch: -0.12, aRoll: -0.05, aYaw: 0.09, aBob: 0.015, aLean: -0.085, aLat: 0.015,
    plantSpringBob: 0.012,
    rOverPitch: -0.025, rOverRoll: -0.01, rOverYaw: 0.03, rOverBob: 0.008, rOverLean: -0.02,
    overEndU: 0.22,
    windupLiftAtApex: 0.0
  }),
  backstep: Object.freeze({
    id: 'backstep',
    // Crisp athletic evade hop backward
    wPitch: 0.10, wRoll: 0.0, wYaw: 0.0, wBob: -0.05, wLean: -0.04, wLat: 0.0,
    aPitch: 0.17, aRoll: 0.04, aYaw: -0.05, aBob: 0.045, aLean: -0.11, aLat: 0.0,
    plantSpringBob: -0.045,
    rOverPitch: 0.04, rOverRoll: 0.0, rOverYaw: 0.0, rOverBob: -0.04, rOverLean: -0.03,
    overEndU: 0.30,
    windupLiftAtApex: 0.0
  })
});

const MOVE_TYPE_ALIASES = Object.freeze({
  slash: 'slash',
  slash_1: 'slash',
  attack_slash_1: 'slash',
  aaa_combo: 'slash',
  r1: 'slash',
  r1_1: 'slash',
  light: 'slash',
  sweep: 'slash',
  sweep_1: 'slash',
  sweep_combo: 'slash',
  sweep_combo_1: 'slash',
  combo_sweep_1: 'slash',
  cleave: 'slash',

  slash_backhand: 'slash_backhand',
  slash_2: 'slash_backhand',
  attack_slash_2: 'slash_backhand',
  sweep_2: 'slash_backhand',
  attack_sweep_2: 'slash_backhand',
  r1_2: 'slash_backhand',
  sweep_combo_2: 'slash_backhand',
  combo_backhand_2: 'slash_backhand',
  backhand: 'slash_backhand',

  overhead: 'overhead',
  overhead_crush: 'overhead',
  attack_overhead_crush: 'overhead',
  overhead_cleave: 'overhead',
  heavy_cleave: 'overhead',
  delayed_crush: 'overhead',
  delayed_crush_1: 'slash',
  delayed_crush_2: 'slash_backhand',
  delayed_crush_3: 'overhead',
  delayed_crush_slam: 'overhead',
  combo_slam_3: 'overhead',
  r1_3: 'overhead',
  slam: 'overhead',
  heavy: 'overhead',
  chop: 'overhead',

  thrust: 'thrust',
  thrust_1: 'thrust',
  attack_thrust_1: 'thrust',
  thrust_lunge: 'thrust',
  attack_thrust_lunge: 'thrust',
  overhead_poke: 'thrust',
  attack_overhead_poke: 'thrust',
  heavy_thrust: 'thrust',
  r2: 'thrust',
  charged_r2: 'thrust',
  rolling_r1: 'thrust',
  pierce: 'thrust',
  poke: 'thrust',
  lunge: 'thrust',

  shield_bash: 'shield_bash',
  attack_shield_bash: 'shield_bash',
  bash: 'shield_bash',
  guard_counter: 'shield_bash',
  shoulder_bash: 'shield_bash',

  leap_slam: 'leap_slam',
  leap: 'leap_slam',
  jump_slam: 'leap_slam',

  whirl_spin: 'whirl_spin',
  whirl: 'whirl_spin',
  spin: 'whirl_spin',

  shot: 'shot',
  quick_shot: 'shot',
  aim_draw: 'shot',
  shot_release: 'shot',
  quick_retreat_shot: 'shot',
  bow: 'shot',
  ranged: 'shot',

  backstep: 'backstep',
  backstep_evade: 'backstep'
});

// ============================================================================
// 3. Pure Scalar Math Helpers (Zero Allocations)
// ============================================================================

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function finiteOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

function smoothstep01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function smootherstep01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// Module-level zero-allocation scratch objects (never exposed outside a call)
const _tmpClampOut = { x: 0, z: 0 };
const _springTmp = { x: 0, v: 0 };
const _nullStepResult = Object.freeze({
  x: 0, z: 0, dx: 0, dz: 0, vx: 0, vz: 0, speed: 0,
  moved: false, isSliding: false, groundDustIntensity: 0,
  wallHit: false, wallImpactSpeed: 0, wallImpactIntensity: 0,
  wallNormalX: 0, wallNormalZ: 0, wallHitX: 0, wallHitZ: 0, wallHitY: 0,
  wallVfx: Object.freeze({
    dustColor: 0xc8c0b4, dustCount: 0, dustSpeed: 0,
    sparkColor: 0xfde68a, sparkCount: 0, sparkSpeed: 0,
    cameraKick: 0, soundTier: 'none', bonusWallStagger: 0
  })
});
const _nullPostureOut = Object.freeze({
  pitchRad: 0,
  rollRad: 0,
  yawOffsetRad: 0,
  bobY: 0,
  forwardLean: 0,
  lateralShift: 0,
  recoilActive: false
});
const _nullImpulseOut = Object.freeze({ vx: 0, vz: 0, appliedSpeed: 0 });

/**
 * Exact closed-form step of a 1D damped harmonic spring toward 0.
 * - For zeta >= 0.999: strictly critically damped (zero oscillation overshoot).
 * - For 0.65 <= zeta < 0.999: near-critically damped (subtle weighty catch).
 * Unconditionally stable for any positive dt; writes into module scratch `_springTmp`.
 */
function stepSpring1D(x, v, omega, zeta, dt) {
  if (
    Math.abs(x) < SOULS_PHYSICS_CFG.SPRING_POS_EPS &&
    Math.abs(v) < SOULS_PHYSICS_CFG.SPRING_VEL_EPS
  ) {
    _springTmp.x = 0;
    _springTmp.v = 0;
    return _springTmp;
  }

  let nx;
  let nv;
  if (zeta >= 0.999) {
    const expTerm = Math.exp(-omega * dt);
    const c1 = x;
    const c2 = v + omega * x;
    nx = (c1 + c2 * dt) * expTerm;
    nv = (v - omega * c2 * dt) * expTerm;
  } else {
    const z = clamp(zeta, 0.65, 0.999);
    const zo = z * omega;
    const wd = omega * Math.sqrt(1 - z * z);
    const expTerm = Math.exp(-zo * dt);
    const angle = wd * dt;
    const cosT = Math.cos(angle);
    const sinT = Math.sin(angle);
    const c1 = x;
    const c2 = (v + zo * x) / wd;
    nx = expTerm * (c1 * cosT + c2 * sinT);
    nv = expTerm * ((c2 * wd - c1 * zo) * cosT - (c1 * wd + c2 * zo) * sinT);
  }

  if (
    Math.abs(nx) < SOULS_PHYSICS_CFG.SPRING_POS_EPS &&
    Math.abs(nv) < SOULS_PHYSICS_CFG.SPRING_VEL_EPS
  ) {
    nx = 0;
    nv = 0;
  }
  _springTmp.x = nx;
  _springTmp.v = nv;
  return _springTmp;
}

// ============================================================================
// 4. Actor Profile & Per-Actor State Management (Monomorphic, Zero-Leak)
// ============================================================================

/**
 * Resolves the frozen mass, friction, stride, and posture profile for an actor or type id.
 *
 * @param {object|string|null} actorOrType
 * @returns {Readonly<object>}
 */
export function getActorPhysicsProfile(actorOrType) {
  if (!actorOrType) return SOULS_PHYSICS_PROFILES.cursed_footman;
  if (typeof actorOrType === 'string') {
    const k = PROFILE_ALIASES[actorOrType.toLowerCase()];
    return SOULS_PHYSICS_PROFILES[k] || SOULS_PHYSICS_PROFILES.cursed_footman;
  }
  if (typeof actorOrType === 'object') {
    if (actorOrType.isSoulsBoss) {
      return SOULS_PHYSICS_PROFILES.souls_boss;
    }
    const explicit = actorOrType.physicsProfileId || actorOrType.physProfileId;
    if (typeof explicit === 'string') {
      const k = PROFILE_ALIASES[explicit.toLowerCase()];
      if (k) return SOULS_PHYSICS_PROFILES[k];
    }
    if (typeof actorOrType.type === 'string') {
      const k = PROFILE_ALIASES[actorOrType.type.toLowerCase()];
      if (k) return SOULS_PHYSICS_PROFILES[k];
    }
    if (actorOrType.isBoss) {
      return SOULS_PHYSICS_PROFILES.souls_boss;
    }
    if (typeof actorOrType.soulsMobProfileId === 'string') {
      const k = PROFILE_ALIASES[actorOrType.soulsMobProfileId.toLowerCase()];
      if (k) return SOULS_PHYSICS_PROFILES[k];
    }
    if (typeof actorOrType.soulsRole === 'string') {
      const k = PROFILE_ALIASES[actorOrType.soulsRole.toLowerCase()];
      if (k) return SOULS_PHYSICS_PROFILES[k];
    }
    if (actorOrType.isPlayer || actorOrType.isHero || typeof actorOrType.classId === 'string') {
      return SOULS_PHYSICS_PROFILES.hero;
    }
  }
  return SOULS_PHYSICS_PROFILES.cursed_footman;
}

function resolveMovePostureProfile(moveType) {
  if (typeof moveType === 'string' && moveType.length > 0) {
    const direct = SOULS_MOVE_POSTURE_PROFILES[moveType];
    if (direct) return direct;
    const alias = MOVE_TYPE_ALIASES[moveType.toLowerCase()];
    if (alias) return SOULS_MOVE_POSTURE_PROFILES[alias];
  }
  return SOULS_MOVE_POSTURE_PROFILES.slash;
}

function createActorPhysicsState(profile) {
  return {
    // Linear inertia body
    vx: 0,
    vz: 0,
    speed: 0,
    skidTimer: 0,
    wallCooldown: 0,
    lastImpulseMag: 0,

    // Posture follower state
    curPitch: 0,
    curRoll: 0,
    curYaw: 0,
    curBobY: 0,
    curForwardLean: 0,
    curLateralShift: 0,
    postureInit: false,
    prevFacing: 0,
    hasPrevFacing: false,
    prevPhase: 'neutral',
    smoothedYawRate: 0,

    // Critically damped recoil spring state
    recPitch: 0,
    recPitchVel: 0,
    recRoll: 0,
    recRollVel: 0,
    recYaw: 0,
    recYawVel: 0,
    recBobY: 0,
    recBobYVel: 0,
    recLean: 0,
    recLeanVel: 0,
    recOmega: profile.recoilOmega,
    recZeta: profile.recoilZeta,
    lastInlineHitRecoil: 0,
    lastInlineClashRecoil: 0,

    // Foot-sync smoother state
    footSyncRate: 0,
    footSyncInit: false,

    // Reusable zero-GC return containers
    impulseOut: { vx: 0, vz: 0, appliedSpeed: 0 },
    stepResult: {
      x: 0,
      z: 0,
      dx: 0,
      dz: 0,
      vx: 0,
      vz: 0,
      speed: 0,
      moved: false,
      isSliding: false,
      groundDustIntensity: 0,
      wallHit: false,
      wallImpactSpeed: 0,
      wallImpactIntensity: 0,
      wallNormalX: 0,
      wallNormalZ: 0,
      wallHitX: 0,
      wallHitZ: 0,
      wallHitY: 0,
      wallVfx: {
        dustColor: 0xc8c0b4,
        dustCount: 0,
        dustSpeed: 0,
        sparkColor: 0xfde68a,
        sparkCount: 0,
        sparkSpeed: 0,
        cameraKick: 0,
        soundTier: 'none',
        bonusWallStagger: 0
      }
    },
    postureOut: {
      pitchRad: 0,
      rollRad: 0,
      yawOffsetRad: 0,
      bobY: 0,
      forwardLean: 0,
      lateralShift: 0,
      recoilActive: false
    }
  };
}

function ensureState(actor, profile) {
  let st = actor._physFeel;
  if (!st) {
    st = createActorPhysicsState(profile);
    actor._physFeel = st;
    if (!Number.isFinite(actor.physVx)) actor.physVx = 0;
    if (!Number.isFinite(actor.physVz)) actor.physVz = 0;
    if (!Number.isFinite(actor.physSpeed)) actor.physSpeed = 0;
    actor.physSliding = false;
  }
  return st;
}

/**
 * Cleanly resets all combat physics inertia, recoil springs, posture smoothers,
 * and foot-sync state on an actor (zero allocations, zero leaks on spawn/respawn/pool recycle).
 *
 * @param {object} actor
 * @returns {object} actor
 */
export function resetActorPhysics(actor) {
  if (!actor || typeof actor !== 'object') return actor;

  actor.physVx = 0;
  actor.physVz = 0;
  actor.physSpeed = 0;
  actor.physSliding = false;

  const st = actor._physFeel;
  if (!st) return actor;

  const profile = getActorPhysicsProfile(actor);

  st.vx = 0;
  st.vz = 0;
  st.speed = 0;
  st.skidTimer = 0;
  st.wallCooldown = 0;
  st.lastImpulseMag = 0;

  st.curPitch = 0;
  st.curRoll = 0;
  st.curYaw = 0;
  st.curBobY = 0;
  st.curForwardLean = 0;
  st.curLateralShift = 0;
  st.postureInit = false;
  st.prevFacing = Number.isFinite(actor.facing) ? actor.facing : 0;
  st.hasPrevFacing = false;
  st.prevPhase = 'neutral';
  st.smoothedYawRate = 0;

  st.recPitch = 0;
  st.recPitchVel = 0;
  st.recRoll = 0;
  st.recRollVel = 0;
  st.recYaw = 0;
  st.recYawVel = 0;
  st.recBobY = 0;
  st.recBobYVel = 0;
  st.recLean = 0;
  st.recLeanVel = 0;
  st.recOmega = profile.recoilOmega;
  st.recZeta = profile.recoilZeta;
  st.lastInlineHitRecoil = 0;
  st.lastInlineClashRecoil = 0;

  st.footSyncRate = 0;
  st.footSyncInit = false;

  const r = st.stepResult;
  r.x = Number.isFinite(actor.x) ? actor.x : 0;
  r.z = Number.isFinite(actor.z) ? actor.z : 0;
  r.dx = 0;
  r.dz = 0;
  r.vx = 0;
  r.vz = 0;
  r.speed = 0;
  r.moved = false;
  r.isSliding = false;
  r.groundDustIntensity = 0;
  r.wallHit = false;
  r.wallImpactSpeed = 0;
  r.wallImpactIntensity = 0;
  r.wallNormalX = 0;
  r.wallNormalZ = 0;
  r.wallHitX = 0;
  r.wallHitZ = 0;
  r.wallHitY = 0;
  r.wallVfx.dustCount = 0;
  r.wallVfx.sparkCount = 0;
  r.wallVfx.cameraKick = 0;
  r.wallVfx.soundTier = 'none';
  r.wallVfx.bonusWallStagger = 0;

  const p = st.postureOut;
  p.pitchRad = 0;
  p.rollRad = 0;
  p.yawOffsetRad = 0;
  p.bobY = 0;
  p.forwardLean = 0;
  p.lateralShift = 0;
  p.recoilActive = false;

  return actor;
}

// ============================================================================
// 5. Directional Critically Damped Spring Recoil Impulse
// ============================================================================

/**
 * Injects a directional critically damped spring recoil impulse into an actor's posture
 * for taking hits (`hitRecoil`), weapon/shield clashes (`clashRecoil` / `blockRecoil`),
 * parries (`parryRecoil`), or slamming into castle walls (`wallSlam`).
 * Zero allocations.
 *
 * @param {object} actor
 * @param {object} [opts]
 * @param {'hitRecoil'|'clashRecoil'|'blockRecoil'|'parryRecoil'|'wallSlam'} [opts.kind='hitRecoil']
 * @param {number} [opts.dirX] World-space push direction X (from attacker toward victim)
 * @param {number} [opts.dirZ] World-space push direction Z
 * @param {number} [opts.intensity=0.85] Scalar recoil strength [0..2.0]
 * @param {boolean} [opts.isHeavy=false]
 * @param {number} [opts.sideBias=0] Optional left(+1)/right(-1) lateral deflection bias
 */
export function applyCombatRecoilImpulse(actor, opts = null) {
  if (!actor || typeof actor !== 'object') return false;
  const profile = getActorPhysicsProfile(actor);
  const st = ensureState(actor, profile);

  const kind = typeof opts?.kind === 'string' ? opts.kind : 'hitRecoil';
  const isHeavy = Boolean(opts?.isHeavy);
  const rawIntensity = finiteOr(opts?.intensity, isHeavy ? 1.15 : 0.85);
  if (rawIntensity <= 0.001) return false;

  const mag = clamp(rawIntensity * (isHeavy ? 1.28 : 1.0), 0.05, 2.0);
  const facing = finiteOr(actor.facing, 0);
  const fwdX = Math.sin(facing);
  const fwdZ = Math.cos(facing);
  const leftX = Math.cos(facing);
  const leftZ = -Math.sin(facing);

  let dx = finiteOr(opts?.dirX, 0);
  let dz = finiteOr(opts?.dirZ, 0);
  const len = Math.hypot(dx, dz);
  let localFwd;
  let localLeft;
  if (len > EPS) {
    dx /= len;
    dz /= len;
    localFwd = dx * fwdX + dz * fwdZ;
    localLeft = dx * leftX + dz * leftZ;
  } else {
    // Default frontal impact (pushes chest backwards along -fwd)
    localFwd = -1.0;
    localLeft = clamp(finiteOr(opts?.sideBias, 0), -1, 1);
  }

  // Mass attenuates angular recoil slightly so colossal bosses feel heavier, not limp
  const massDamp = clamp(1.0 / Math.pow(Math.max(0.45, finiteOr(actor.physMass, profile.mass)), 0.24), 0.58, 1.18);
  const scale = mag * massDamp;

  let pitchKick = 0;
  let rollKick = 0;
  let yawKick = 0;
  let bobKick = 0;
  let leanKick = 0;
  let omegaMult = 1.0;
  let zeta = 1.0; // strictly critically damped by default (0 ugly oscillation)

  if (kind === 'clashRecoil' || kind === 'blockRecoil') {
    // Crisp steel-on-shield shock: firm backward brace + left-shield shoulder absorb + quick snap
    omegaMult = 1.28;
    zeta = 0.95;
    pitchKick = localFwd * 0.16 * scale - 0.06 * scale;
    rollKick = (-localLeft * 0.17 + 0.09) * scale;
    yawKick = (-0.18 + localLeft * 0.14) * scale;
    bobKick = -0.052 * scale;
    leanKick = localFwd * 0.075 * scale;
  } else if (kind === 'parryRecoil') {
    // Dramatic deflected weapon snap: wide yaw twist & upper-body fling open for riposte!
    omegaMult = 0.88;
    zeta = 0.92;
    pitchKick = (localFwd * 0.22 - 0.14) * scale;
    rollKick = (-localLeft * 0.20 + 0.14) * scale;
    yawKick = (localLeft >= 0 ? 0.34 : -0.34) * scale;
    bobKick = -0.045 * scale;
    leanKick = localFwd * 0.09 * scale;
  } else if (kind === 'wallSlam') {
    // Dull heavy stone rebound against castle masonry
    omegaMult = 1.05;
    zeta = 0.96;
    pitchKick = localFwd * 0.24 * scale;
    rollKick = -localLeft * 0.22 * scale;
    yawKick = localLeft * 0.15 * scale;
    bobKick = -0.060 * scale;
    leanKick = localFwd * 0.08 * scale;
  } else {
    // Standard directional `hitRecoil`: chest snaps in the exact direction of the blow
    omegaMult = isHeavy ? 0.92 : 1.06;
    zeta = 0.98;
    pitchKick = localFwd * 0.23 * scale;
    rollKick = -localLeft * 0.21 * scale;
    yawKick = localLeft * 0.20 * scale;
    bobKick = -0.042 * scale;
    leanKick = localFwd * 0.085 * scale;
  }

  const omega = clamp(profile.recoilOmega * omegaMult, 10.0, 42.0);
  st.recOmega = omega;
  st.recZeta = zeta;

  // Immediate frame-0 tactile impulse bias (~22%) + strong critically damped velocity launch
  const velScale = omega * 1.48;
  st.recPitch = clamp(st.recPitch + pitchKick * 0.24, -0.34, 0.34);
  st.recRoll = clamp(st.recRoll + rollKick * 0.24, -0.28, 0.28);
  st.recYaw = clamp(st.recYaw + yawKick * 0.24, -0.36, 0.36);
  st.recBobY = clamp(st.recBobY + bobKick * 0.28, -0.14, 0.08);
  st.recLean = clamp(st.recLean + leanKick * 0.24, -0.16, 0.16);

  st.recPitchVel = clamp(st.recPitchVel + pitchKick * velScale, -9.0, 9.0);
  st.recRollVel = clamp(st.recRollVel + rollKick * velScale, -8.0, 8.0);
  st.recYawVel = clamp(st.recYawVel + yawKick * velScale, -10.0, 10.0);
  st.recBobYVel = clamp(st.recBobYVel + bobKick * velScale, -4.5, 4.5);
  st.recLeanVel = clamp(st.recLeanVel + leanKick * velScale, -5.0, 5.0);

  return true;
}

// ============================================================================
// 6. Impulse Knockback & Stone Friction Body Physics
// ============================================================================

/**
 * Applies a physically weighted knockback impulse to an actor's momentum vector (physVx, physVz).
 * - Heavy plate knights (`iron_knight`) and colossal bosses (`boss_troll`) absorb much more
 *   momentum and brake shorter & heavier on stone.
 * - Lightweight enemies (`bone_archer`) launch noticeably farther and skid across flagstones.
 * - Automatically feeds a synchronized directional recoil impulse into the posture spring
 *   unless `opts.triggerRecoil === false`.
 *
 * Calling patterns:
 *   - `applyKnockbackImpulse(actor, dirX, dirZ, impulse, opts)`
 *   - `applyKnockbackImpulse(actor, kx, kz)` (when `impulse` is omitted, uses vector magnitude)
 *
 * @param {object} actor
 * @param {number} dirX
 * @param {number} dirZ
 * @param {number} [impulse]
 * @param {object} [opts]
 * @returns {{ vx: number, vz: number, appliedSpeed: number }}
 */
export function applyKnockbackImpulse(actor, dirX, dirZ, impulse = undefined, opts = null) {
  if (!actor || typeof actor !== 'object') return _nullImpulseOut;

  let options = opts;
  let impMag = impulse;
  if (impulse && typeof impulse === 'object') {
    options = impulse;
    impMag = undefined;
  }

  const profile = getActorPhysicsProfile(actor);
  const st = ensureState(actor, profile);

  const rx = finiteOr(dirX, 0);
  const rz = finiteOr(dirZ, 0);
  const rawLen = Math.hypot(rx, rz);

  let nx = 0;
  let nz = 0;
  if (rawLen > EPS) {
    nx = rx / rawLen;
    nz = rz / rawLen;
  } else {
    // Fallback: push backward along actor's facing
    const f = finiteOr(actor.facing, 0);
    nx = -Math.sin(f);
    nz = -Math.cos(f);
  }

  let baseImpulse = impMag !== undefined ? finiteOr(impMag, 0) : rawLen;
  if (baseImpulse <= 0) {
    const outZero = options?.out || st.impulseOut;
    outZero.vx = st.vx;
    outZero.vz = st.vz;
    outZero.appliedSpeed = 0;
    return outZero;
  }

  const ignoreMass = Boolean(options?.ignoreMass);
  const ignoreHyperArmor = Boolean(options?.ignoreHyperArmor);
  const isHeavy = Boolean(options?.isHeavy);
  const isParry = Boolean(options?.isParry);
  const isGuardBlock = Boolean(options?.isGuardBlock);

  // Effective inertial mass (combines profile mass, optional per-actor mass, and heavy armor def)
  const rawMass = Math.max(0.35, finiteOr(actor.physMass ?? actor.mass, profile.mass));
  const armorBonus = !ignoreMass && Number.isFinite(actor.flatDef) && actor.flatDef > 18
    ? 1 + clamp((actor.flatDef - 18) * 0.012, 0, 0.25)
    : 1.0;
  const effMass = ignoreMass ? 1.0 : rawMass * armorBonus;

  let deltaV = ignoreMass ? baseImpulse : (baseImpulse / effMass) * (0.45 + 0.55 * profile.knockbackResist);

  // Hyper-armor absorbs linear knockback so massive mid-swing enemies feel planted like iron
  const inHyperArmor = Boolean(
    !ignoreHyperArmor &&
    !isParry &&
    (actor.hasHyperArmor || (actor.isSoulsBoss && actor.soulsState !== 'stagger_kneel' && actor.soulsState !== 'recover'))
  );
  if (inHyperArmor) {
    deltaV *= actor.isSoulsBoss ? 0.30 : 0.42;
  }

  if (isGuardBlock) {
    deltaV *= 0.55;
  } else if (isParry) {
    deltaV *= 1.25;
  } else if (isHeavy) {
    deltaV *= 1.12;
  }

  const minImpulse = finiteOr(options?.minImpulse, 0);
  if (minImpulse > 0 && deltaV < minImpulse) {
    deltaV = minImpulse;
  }

  // Sync in case external code modified actor.physVx/physVz directly
  let vx = Number.isFinite(actor.physVx) ? actor.physVx : st.vx;
  let vz = Number.isFinite(actor.physVz) ? actor.physVz : st.vz;

  vx += nx * deltaV;
  vz += nz * deltaV;

  const maxSpeed = Math.max(1.0, finiteOr(options?.maxSpeed, profile.maxPhysSpeed));
  const newSpeed = Math.hypot(vx, vz);
  if (newSpeed > maxSpeed) {
    const capScale = maxSpeed / newSpeed;
    vx *= capScale;
    vz *= capScale;
  }

  st.vx = vx;
  st.vz = vz;
  st.speed = Math.hypot(vx, vz);
  st.lastImpulseMag = deltaV;
  if (st.speed >= SOULS_PHYSICS_CFG.SKID_SPEED_THRESHOLD * 0.85) {
    st.skidTimer = Math.max(st.skidTimer, clamp(deltaV * 0.055, 0.08, 0.34));
  }

  actor.physVx = vx;
  actor.physVz = vz;
  actor.physSpeed = st.speed;
  actor.physSliding = st.speed >= SOULS_PHYSICS_CFG.SKID_SPEED_THRESHOLD;

  // Feed matching directional recoil into the critically damped posture spring
  if (options?.triggerRecoil !== false) {
    const recoilKind = typeof options?.recoilKind === 'string'
      ? options.recoilKind
      : isParry
        ? 'parryRecoil'
        : isGuardBlock
          ? 'clashRecoil'
          : 'hitRecoil';
    const defaultRecoilStrength = clamp(baseImpulse / 5.5, 0.35, 1.55);
    applyCombatRecoilImpulse(actor, {
      kind: recoilKind,
      dirX: nx,
      dirZ: nz,
      intensity: finiteOr(options?.recoilStrength, defaultRecoilStrength),
      isHeavy
    });
  }

  const out = options?.out || st.impulseOut;
  out.vx = vx;
  out.vz = vz;
  out.appliedSpeed = deltaV;
  return out;
}

function clampToSimpleBounds(x, z, radius, bounds, out) {
  let cx = x;
  let cz = z;
  const r = Math.max(0, radius);

  if (Number.isFinite(bounds.radius) && bounds.radius > 0) {
    const bx = finiteOr(bounds.cx ?? bounds.centerX, 0);
    const bz = finiteOr(bounds.cz ?? bounds.centerZ, 0);
    const effR = Math.max(0.05, bounds.radius - r);
    const dx = cx - bx;
    const dz = cz - bz;
    const dSq = dx * dx + dz * dz;
    if (dSq > effR * effR && dSq > EPS) {
      const inv = effR / Math.sqrt(dSq);
      cx = bx + dx * inv;
      cz = bz + dz * inv;
    }
    if (Number.isFinite(bounds.maxZ) && cz > bounds.maxZ - r) {
      cz = bounds.maxZ - r;
    }
    if (Number.isFinite(bounds.minZ) && cz < bounds.minZ + r) {
      cz = bounds.minZ + r;
    }
  } else {
    if (Number.isFinite(bounds.minX) && cx < bounds.minX + r) cx = bounds.minX + r;
    if (Number.isFinite(bounds.maxX) && cx > bounds.maxX - r) cx = bounds.maxX - r;
    if (Number.isFinite(bounds.minZ) && cz < bounds.minZ + r) cz = bounds.minZ + r;
    if (Number.isFinite(bounds.maxZ) && cz > bounds.maxZ - r) cz = bounds.maxZ - r;
  }

  out.x = cx;
  out.z = cz;
  return out;
}

/**
 * Steps an actor's linear inertia body (physVx, physVz) with framerate-independent
 * two-regime exponential castle-stone friction and dull masonry wall bounce + VFX payload.
 * Zero allocations in the hot loop.
 *
 * @param {object} actor
 * @param {number} dt Delta time in seconds
 * @param {object} [opts]
 * @param {function} [opts.clampPosition] Optional `(x, z, radius, out) => { x, z }` (e.g. `clampCastlePosition`)
 * @param {object} [opts.bounds] Optional `{ minX, maxX, minZ, maxZ }` or `{ cx, cz, radius, maxZ }`
 * @param {number} [opts.radius] Actor collision radius override (defaults to `actor.radius || 0.55`)
 * @param {number} [opts.frictionMult=1.0] Multiplier on stone friction (e.g. 1.25 when bracing shield)
 * @param {boolean} [opts.applyPosition=true] Whether to write clamped `(x, z)` back to `actor.x/z`
 * @param {boolean} [opts.lowSpec=false] Scales wall VFX particle counts for low-spec mobile
 * @param {object} [opts.out] Optional caller-provided output container
 * @returns {object} Reused step result with `{ x, z, dx, dz, vx, vz, speed, moved, isSliding, groundDustIntensity, wallHit, wallImpactSpeed, wallImpactIntensity, wallNormalX, wallNormalZ, wallHitX, wallHitZ, wallHitY, wallVfx }`
 */
export function stepActorPhysicsBody(actor, dt, opts = null) {
  if (!actor || typeof actor !== 'object') return _nullStepResult;

  const profile = getActorPhysicsProfile(actor);
  const st = ensureState(actor, profile);
  const out = opts?.out || st.stepResult;
  const vfx = out.wallVfx;

  const safeDt = clamp(finiteOr(dt, 0), 0, SOULS_PHYSICS_CFG.MAX_DT);
  const startX = finiteOr(actor.x, 0);
  const startZ = finiteOr(actor.z, 0);
  const radius = Math.max(0.15, finiteOr(opts?.radius ?? actor.radius, 0.55));
  const actorScale = Math.max(0.5, finiteOr(actor.scale, profile.referenceScale));

  // Sync external physVx/physVz writes if any
  let vx = Number.isFinite(actor.physVx) ? actor.physVx : st.vx;
  let vz = Number.isFinite(actor.physVz) ? actor.physVz : st.vz;

  if (st.wallCooldown > 0 && safeDt > 0) {
    st.wallCooldown = Math.max(0, st.wallCooldown - safeDt);
  }
  if (st.skidTimer > 0 && safeDt > 0) {
    st.skidTimer = Math.max(0, st.skidTimer - safeDt);
  }

  // Reset per-step wall impact flags
  out.wallHit = false;
  out.wallImpactSpeed = 0;
  out.wallImpactIntensity = 0;
  out.wallNormalX = 0;
  out.wallNormalZ = 0;
  out.wallHitX = startX;
  out.wallHitZ = startZ;
  out.wallHitY = 0.92 * actorScale;
  vfx.dustCount = 0;
  vfx.sparkCount = 0;
  vfx.cameraKick = 0;
  vfx.soundTier = 'none';
  vfx.bonusWallStagger = 0;

  const startSpeed = Math.hypot(vx, vz);
  if (safeDt <= 0 || startSpeed < SOULS_PHYSICS_CFG.STOP_SPEED_EPS) {
    if (startSpeed < SOULS_PHYSICS_CFG.STOP_SPEED_EPS) {
      vx = 0;
      vz = 0;
    }
    st.vx = vx;
    st.vz = vz;
    st.speed = Math.hypot(vx, vz);
    actor.physVx = vx;
    actor.physVz = vz;
    actor.physSpeed = st.speed;
    actor.physSliding = false;

    out.x = startX;
    out.z = startZ;
    out.dx = 0;
    out.dz = 0;
    out.vx = vx;
    out.vz = vz;
    out.speed = st.speed;
    out.moved = false;
    out.isSliding = false;
    out.groundDustIntensity = 0;
    return out;
  }

  // Two-regime stone friction: kinetic skid right after a strong hit transitioning
  // into heavy boot-plant grip on castle flagstones as velocity drops.
  const skidBlend = clamp(
    Math.max(
      (startSpeed - SOULS_PHYSICS_CFG.SKID_SPEED_THRESHOLD * 0.65) / 3.8,
      st.skidTimer > 0 ? 0.65 : 0
    ),
    0,
    1
  );
  const frictionMult = clamp(finiteOr(opts?.frictionMult, 1.0), 0.25, 3.0);
  const baseK = profile.stoneFriction + (profile.slidingFriction - profile.stoneFriction) * skidBlend;
  const k = Math.max(1.0, baseK * frictionMult);

  // Exact analytical integration of exponential drag over dt:
  //   v(t) = v0 * exp(-k*t)
  //   dx   = integral_0^dt v(t) dt = v0 * (1 - exp(-k*dt)) / k
  // Guarantees identical knockback travel distance at 30 FPS, 60 FPS, and 144 FPS!
  const decay = Math.exp(-k * safeDt);
  const dispFactor = (1 - decay) / k;

  const rawDx = vx * dispFactor;
  const rawDz = vz * dispFactor;
  const rawX = startX + rawDx;
  const rawZ = startZ + rawDz;

  let nextVx = vx * decay;
  let nextVz = vz * decay;
  let finalX = rawX;
  let finalZ = rawZ;

  // Optional castle wall / pillar / bounds collision & dull rebound
  const clampFn = typeof opts?.clampPosition === 'function'
    ? opts.clampPosition
    : (typeof opts?.resolvePosition === 'function' ? opts.resolvePosition : null);

  if (clampFn) {
    _tmpClampOut.x = rawX;
    _tmpClampOut.z = rawZ;
    const clamped = clampFn(rawX, rawZ, radius, _tmpClampOut);
    if (clamped && Number.isFinite(clamped.x) && Number.isFinite(clamped.z)) {
      finalX = clamped.x;
      finalZ = clamped.z;
    } else {
      finalX = _tmpClampOut.x;
      finalZ = _tmpClampOut.z;
    }
  } else if (opts?.bounds && typeof opts.bounds === 'object') {
    clampToSimpleBounds(rawX, rawZ, radius, opts.bounds, _tmpClampOut);
    finalX = _tmpClampOut.x;
    finalZ = _tmpClampOut.z;
  }

  // Detect wall penetration vector pointing from solid wall back into walkable floor
  const penX = finalX - rawX;
  const penZ = finalZ - rawZ;
  const penLen = Math.hypot(penX, penZ);

  if (penLen > SOULS_PHYSICS_CFG.WALL_PENETRATION_EPS) {
    const nx = penX / penLen;
    const nz = penZ / penLen;
    // Measure incoming impact speed strictly along the wall normal
    const preDotN = vx * nx + vz * nz;
    const postDotN = nextVx * nx + nextVz * nz;
    const impactSpeed = Math.max(0, -preDotN);

    if (preDotN < -EPS) {
      // Decompose post-decay velocity into wall-normal & wall-tangent
      const vtX = nextVx - postDotN * nx;
      const vtZ = nextVz - postDotN * nz;

      if (impactSpeed >= profile.wallImpactMinSpeed) {
        // Dull armored bounce off castle masonry + stone scraping friction!
        const reboundSpeed = clamp(
          Math.max(-postDotN, impactSpeed * 0.72) * profile.wallRestitution,
          0.32,
          SOULS_PHYSICS_CFG.WALL_MAX_REBOUND_SPEED
        );
        nextVx = vtX * SOULS_PHYSICS_CFG.WALL_TANGENTIAL_DAMP + nx * reboundSpeed;
        nextVz = vtZ * SOULS_PHYSICS_CFG.WALL_TANGENTIAL_DAMP + nz * reboundSpeed;

        if (st.wallCooldown <= 0) {
          st.wallCooldown = SOULS_PHYSICS_CFG.WALL_COOLDOWN_SEC;
          const intensity = clamp(
            (impactSpeed - profile.wallImpactMinSpeed * 0.75) / 5.2,
            0.22,
            1.0
          );
          const lowSpecScale = opts?.lowSpec ? SOULS_PHYSICS_CFG.LOW_SPEC_VFX_SCALE : 1.0;
          const isArmored = profile.armorMaterial !== 'light_cloth';

          out.wallHit = true;
          out.wallImpactSpeed = impactSpeed;
          out.wallImpactIntensity = intensity;
          out.wallNormalX = nx;
          out.wallNormalZ = nz;
          out.wallHitX = finalX - nx * radius * 0.85;
          out.wallHitZ = finalZ - nz * radius * 0.85;
          out.wallHitY = clamp(0.82 * actorScale, 0.65, 1.85);

          vfx.dustColor = 0xc8c0b4;
          vfx.dustCount = Math.max(3, Math.round((6 + intensity * 9) * lowSpecScale));
          vfx.dustSpeed = 2.4 + intensity * 3.4;
          vfx.sparkColor = profile.armorMaterial === 'colossal_plate' ? 0xfbbf24 : 0xfde68a;
          vfx.sparkCount = isArmored
            ? Math.max(3, Math.round((4 + intensity * 8) * lowSpecScale))
            : Math.max(2, Math.round((2 + intensity * 3) * lowSpecScale));
          vfx.sparkSpeed = 4.6 + intensity * 4.2;
          vfx.cameraKick = clamp(
            (0.10 + intensity * 0.24) * clamp(Math.sqrt(profile.mass), 0.75, 1.55),
            0.08,
            0.42
          );
          vfx.soundTier = intensity >= 0.72 || profile.mass >= 1.8 ? 'heavy' : intensity >= 0.42 ? 'medium' : 'light';
          vfx.bonusWallStagger = Math.round(4 + intensity * 10);

          // Slam actor's upper body back off the stone wall via the critically damped spring
          applyCombatRecoilImpulse(actor, {
            kind: 'wallSlam',
            dirX: nx,
            dirZ: nz,
            intensity: 0.45 + intensity * 0.85,
            isHeavy: intensity >= 0.65
          });
        }
      } else {
        // Glancing contact: kill inward velocity cleanly & damp scraping along wall
        nextVx = vtX * SOULS_PHYSICS_CFG.WALL_GLANCE_TANGENTIAL_DAMP;
        nextVz = vtZ * SOULS_PHYSICS_CFG.WALL_GLANCE_TANGENTIAL_DAMP;
      }
    }
  }

  let endSpeed = Math.hypot(nextVx, nextVz);
  if (endSpeed < SOULS_PHYSICS_CFG.STOP_SPEED_EPS) {
    nextVx = 0;
    nextVz = 0;
    endSpeed = 0;
  }

  if (opts?.applyPosition !== false) {
    actor.x = finalX;
    actor.z = finalZ;
  }

  st.vx = nextVx;
  st.vz = nextVz;
  st.speed = endSpeed;
  actor.physVx = nextVx;
  actor.physVz = nextVz;
  actor.physSpeed = endSpeed;
  const isSliding = endSpeed >= SOULS_PHYSICS_CFG.SKID_SPEED_THRESHOLD * 0.75;
  actor.physSliding = isSliding;

  const actualDx = finalX - startX;
  const actualDz = finalZ - startZ;

  out.x = finalX;
  out.z = finalZ;
  out.dx = actualDx;
  out.dz = actualDz;
  out.vx = nextVx;
  out.vz = nextVz;
  out.speed = endSpeed;
  out.moved = Math.hypot(actualDx, actualDz) > 1e-5;
  out.isSliding = isSliding;
  out.groundDustIntensity = isSliding ? clamp((endSpeed - 1.2) / 5.5, 0, 1) : 0;
  return out;
}

// ============================================================================
// 7. Dynamic Combat Posture & Body-Inertia Layer
// ============================================================================

function resolveRelativeScale(actorScale, profile) {
  const tripoRef = Math.max(0.4, profile.referenceScale || 1.0);
  const encRef = Math.max(0.4, profile.encounterReferenceScale || tripoRef);
  const ref = tripoRef > encRef * 1.4 && actorScale < (tripoRef + encRef) * 0.5
    ? encRef
    : tripoRef;
  return clamp(actorScale / ref, 0.60, 1.85);
}

function inferPhaseFromActor(actor) {
  const s = actor.soulsState || actor.aiState || 'neutral';
  if (s === 'windup' || s === 'leap_windup' || s === 'leap_telegraph' || s === 'whirl_windup' || s === 'delayed_hold') {
    return 'windup';
  }
  if (s === 'aaa_combo') {
    const elapsed = Number(actor.soulsComboStageElapsed);
    const impactAt = Number(actor.soulsComboStageImpactAt);
    if (Number.isFinite(elapsed) && Number.isFinite(impactAt) && impactAt > 0.05) {
      if (elapsed < impactAt * 0.78) return 'windup';
      if (elapsed <= impactAt + 0.22) return 'active';
      return 'recover';
    }
    return 'active';
  }
  if (
    s === 'active' ||
    s === 'strike' ||
    s === 'overhead_cleave' ||
    s === 'sweep_combo' ||
    s === 'delayed_crush' ||
    s === 'leap_slam' ||
    s === 'whirl_spin'
  ) {
    return 'active';
  }
  if (s === 'recover' || s === 'hit_react') {
    return 'recover';
  }
  if (s === 'backstep') {
    return 'backstep';
  }
  if (s === 'stagger_kneel' || s === 'stagger_recover' || s === 'stunned' || (actor.stunTimer || 0) > 0 || (actor.staggeredTimer || 0) > 0) {
    return 'stagger';
  }
  return 'neutral';
}

function inferPhase01FromActor(actor, phase) {
  if (actor.soulsState === 'aaa_combo') {
    const elapsed = Number(actor.soulsComboStageElapsed);
    const impactAt = Number(actor.soulsComboStageImpactAt);
    const dur = Math.max(0.2, finiteOr(actor.soulsComboStageDur, 1.15));
    if (Number.isFinite(elapsed) && Number.isFinite(impactAt) && impactAt > 0.05) {
      const windEnd = Math.max(0.05, impactAt * 0.78);
      const actEnd = Math.min(dur, impactAt + 0.22);
      if (phase === 'windup') return clamp(elapsed / windEnd, 0, 1);
      if (phase === 'active') return clamp((elapsed - windEnd) / Math.max(0.05, actEnd - windEnd), 0, 1);
      if (phase === 'recover') return clamp((elapsed - actEnd) / Math.max(0.05, dur - actEnd), 0, 1);
    }
    return 0.65;
  }
  const meta = actor.currentAttackMeta;
  if (phase === 'windup') {
    const dur = Math.max(0.08, finiteOr(meta?.windup, 0.55));
    if (Number.isFinite(actor._soulsAttackElapsed) && actor._soulsAttackElapsed >= 0) {
      return clamp(actor._soulsAttackElapsed / dur, 0, 1);
    }
    if (Number.isFinite(actor.soulsTimer)) {
      return clamp(1 - actor.soulsTimer / dur, 0, 1);
    }
    return 0.5;
  }
  if (phase === 'active') {
    const dur = Math.max(0.05, finiteOr(meta?.active, 0.09));
    if (Number.isFinite(actor._soulsActiveTimer)) {
      return clamp(1 - actor._soulsActiveTimer / dur, 0, 1);
    }
    if (Number.isFinite(actor.soulsTimer)) {
      return clamp(1 - actor.soulsTimer / dur, 0, 1);
    }
    return 0.5;
  }
  if (phase === 'recover') {
    const dur = Math.max(0.15, finiteOr(actor._soulsRecoverDuration ?? meta?.recovery, 0.55));
    if (Number.isFinite(actor._soulsRecoverElapsed) && actor._soulsRecoverElapsed >= 0) {
      return clamp(actor._soulsRecoverElapsed / dur, 0, 1);
    }
    if (Number.isFinite(actor.soulsTimer)) {
      return clamp(1 - actor.soulsTimer / dur, 0, 1);
    }
    return 0.5;
  }
  if (phase === 'backstep') {
    const dur = Math.max(0.08, finiteOr(actor._soulsBackstepDuration, 0.28));
    if (Number.isFinite(actor._soulsBackstepTimer)) {
      return clamp(1 - actor._soulsBackstepTimer / dur, 0, 1);
    }
    return 0.5;
  }
  return 0;
}

function shouldSuppressPosture(actor, opts) {
  if (opts?.suppress || opts?.isDead) return true;
  if (Number.isFinite(actor.hp) && actor.hp <= 0) return true;
  if (actor.isDying || actor.dead) return true;
  if (opts?.isRolling || opts?.isTurning180 || actor.turn180Active) return true;
  if ((actor.waterLiftTimer || 0) > 0) return true;
  const throne = actor.soulsThronePhase;
  if (throne === 'sitting' || throne === 'pause' || throne === 'standing' || throne === 'dialogue') return true;
  const s = actor.soulsState;
  if (s === 'riposte_victim' || s === 'roar_taunt' || s === 'phase2_roar' || s === 'cutscene_rise_roar') return true;
  return false;
}

/**
 * Computes the procedural body-inertia & recoil posture layer over skeletal animations
 * for regular enemies, Boss, and Hero:
 *   - `windup`: kinetic energy coil (shoulder/torso pullback, yaw twist, knee crouch / overhead lift)
 *   - `active`: explosive forward throw, swing-plane roll bank, springy foot-plant absorb
 *   - `recover`: heavy-weapon follow-through overshoot («дотягивание») & elastic return to balance
 *   - `neutral` / locomotion: velocity- & turn-driven lean, strafe bank, living combat breath
 *   - `hitRecoil` / `clashRecoil` / `parryRecoil` / `wallSlam`: additive critically damped spring
 *
 * Calling patterns:
 *   - `computeCombatPostureDynamics(actor, opts, dt)`
 *   - `computeCombatPostureDynamics(actor, dt, opts)`
 *   - `computeCombatPostureDynamics(actor)` (auto-infers state from actor fields)
 *
 * Zero allocations in the hot loop (writes into `opts.out` or `actor._physFeel.postureOut`).
 *
 * @param {object} actor
 * @param {object|number|null} [stateOrOpts]
 * @param {number|object} [dtOrOpts]
 * @returns {{ pitchRad: number, rollRad: number, yawOffsetRad: number, bobY: number, forwardLean: number, lateralShift: number, recoilActive: boolean }}
 */
export function computeCombatPostureDynamics(actor, stateOrOpts = null, dtOrOpts = undefined) {
  if (!actor || typeof actor !== 'object') return _nullPostureOut;

  let opts = null;
  let dt = 0.016;
  if (typeof stateOrOpts === 'number') {
    dt = stateOrOpts;
    opts = dtOrOpts && typeof dtOrOpts === 'object' ? dtOrOpts : null;
  } else {
    opts = stateOrOpts && typeof stateOrOpts === 'object' ? stateOrOpts : null;
    if (typeof dtOrOpts === 'number') {
      dt = dtOrOpts;
    } else if (opts && opts.dt !== undefined) {
      dt = opts.dt;
    }
  }

  const safeDt = clamp(finiteOr(dt, 0.016), 0, SOULS_PHYSICS_CFG.MAX_DT);
  const profile = getActorPhysicsProfile(actor);
  const st = ensureState(actor, profile);
  const out = opts?.out || st.postureOut;

  const isColossalBoss = profile.id === 'souls_boss';
  const actorScale = clamp(finiteOr(opts?.scale ?? actor.scale, profile.referenceScale), 0.5, 3.8);
  const linearScale = clamp(resolveRelativeScale(actorScale, profile), 0.65, 1.55);
  const postureMult = clamp(finiteOr(opts?.postureScale, profile.postureScale), 0.20, 1.8);
  const heft = clamp(finiteOr(opts?.weaponHeft, profile.weaponHeft), 0.5, 2.0);
  const facing = finiteOr(opts?.facing ?? actor.facing, 0);

  // 1. Handle inline hitRecoil / clashRecoil signals (supports both one-shot impulses & timers)
  if (opts) {
    if (opts.hitRecoil && typeof opts.hitRecoil === 'object') {
      const hInt = finiteOr(opts.hitRecoil.intensity, 0);
      if (hInt > 0.01 && hInt > st.lastInlineHitRecoil + 0.04) {
        applyCombatRecoilImpulse(actor, {
          kind: 'hitRecoil',
          dirX: opts.hitRecoil.dirX,
          dirZ: opts.hitRecoil.dirZ,
          intensity: hInt,
          isHeavy: Boolean(opts.hitRecoil.isHeavy)
        });
      }
      st.lastInlineHitRecoil = hInt;
    } else if (opts.hitRecoil !== undefined) {
      const hVal = Math.max(0, finiteOr(opts.hitRecoil, 0));
      if (hVal > 0.04 && hVal > st.lastInlineHitRecoil + 0.06) {
        applyCombatRecoilImpulse(actor, {
          kind: 'hitRecoil',
          dirX: opts.hitDirX,
          dirZ: opts.hitDirZ,
          intensity: hVal,
          isHeavy: Boolean(opts.isHeavy)
        });
      }
      st.lastInlineHitRecoil = hVal;
    }

    if (opts.clashRecoil && typeof opts.clashRecoil === 'object') {
      const cInt = finiteOr(opts.clashRecoil.intensity, 0);
      if (cInt > 0.01 && cInt > st.lastInlineClashRecoil + 0.04) {
        applyCombatRecoilImpulse(actor, {
          kind: opts.clashRecoil.isParry ? 'parryRecoil' : 'clashRecoil',
          dirX: opts.clashRecoil.dirX,
          dirZ: opts.clashRecoil.dirZ,
          intensity: cInt,
          isHeavy: Boolean(opts.clashRecoil.isHeavy)
        });
      }
      st.lastInlineClashRecoil = cInt;
    } else if (opts.clashRecoil !== undefined) {
      const cVal = Math.max(0, finiteOr(opts.clashRecoil, 0));
      if (cVal > 0.04 && cVal > st.lastInlineClashRecoil + 0.06) {
        applyCombatRecoilImpulse(actor, {
          kind: opts.isParry ? 'parryRecoil' : 'clashRecoil',
          dirX: opts.clashDirX ?? opts.hitDirX,
          dirZ: opts.clashDirZ ?? opts.hitDirZ,
          intensity: cVal,
          isHeavy: Boolean(opts.isHeavy)
        });
      }
      st.lastInlineClashRecoil = cVal;
    }
  }

  // 2. Step the critically damped recoil spring (exact closed-form integration)
  if (safeDt > 0) {
    const om = st.recOmega;
    const zt = st.recZeta;

    stepSpring1D(st.recPitch, st.recPitchVel, om, zt, safeDt);
    st.recPitch = _springTmp.x;
    st.recPitchVel = _springTmp.v;

    stepSpring1D(st.recRoll, st.recRollVel, om, zt, safeDt);
    st.recRoll = _springTmp.x;
    st.recRollVel = _springTmp.v;

    stepSpring1D(st.recYaw, st.recYawVel, om, zt, safeDt);
    st.recYaw = _springTmp.x;
    st.recYawVel = _springTmp.v;

    stepSpring1D(st.recBobY, st.recBobYVel, om * 1.15, zt, safeDt);
    st.recBobY = _springTmp.x;
    st.recBobYVel = _springTmp.v;

    stepSpring1D(st.recLean, st.recLeanVel, om, zt, safeDt);
    st.recLean = _springTmp.x;
    st.recLeanVel = _springTmp.v;
  }

  const recoilActive =
    Math.abs(st.recPitch) > 1e-4 ||
    Math.abs(st.recRoll) > 1e-4 ||
    Math.abs(st.recYaw) > 1e-4 ||
    Math.abs(st.recBobY) > 1e-4 ||
    Math.abs(st.recLean) > 1e-4;

  // 3. Track live angular turn rate for grounded locomotion banking
  let yawRate = finiteOr(opts?.turnRate, NaN);
  if (!Number.isFinite(yawRate)) {
    if (st.hasPrevFacing && safeDt > 1e-4) {
      yawRate = clamp(normalizeAngle(facing - st.prevFacing) / safeDt, -12, 12);
    } else {
      yawRate = 0;
    }
  }
  st.prevFacing = facing;
  st.hasPrevFacing = true;
  if (safeDt > 0) {
    const yawAlpha = 1 - Math.exp(-safeDt * 12.0);
    st.smoothedYawRate += (yawRate - st.smoothedYawRate) * yawAlpha;
  }

  // 4. Suppression check (death, Combat_Roll, Turn_180, Throne cutscene, Water Prison)
  const suppressed = shouldSuppressPosture(actor, opts);

  let tgtPitch = 0;
  let tgtRoll = 0;
  let tgtYaw = 0;
  let tgtBob = 0;
  let tgtLean = 0;
  let tgtLat = 0;
  let followRate = 18.0;

  let activeMoveProfile = SOULS_MOVE_POSTURE_PROFILES.slash;
  let activePhaseNorm = 'neutral';

  if (!suppressed) {
    const phaseRaw = opts?.combatPhase ?? opts?.phase ?? inferPhaseFromActor(actor);
    const phase = typeof phaseRaw === 'string' ? phaseRaw.toLowerCase() : 'neutral';
    activePhaseNorm = phase;
    const rawPhase01 = opts?.combatPhase01 ?? opts?.phase01;
    const u = clamp(
      rawPhase01 !== undefined ? finiteOr(rawPhase01, 0) : inferPhase01FromActor(actor, phase),
      0,
      1
    );

    const aaaStageMove = actor.soulsState === 'aaa_combo'
      ? (actor.soulsComboStage === 3 ? 'combo_slam_3' : actor.soulsComboStage === 2 ? 'combo_backhand_2' : 'combo_sweep_1')
      : null;
    const moveTypeRaw =
      opts?.moveType ??
      opts?.attackKey ??
      opts?.attackId ??
      actor.currentAttackMeta?.label ??
      actor.currentAttackMeta?.moveType ??
      actor.currentAttackMeta?.id ??
      aaaStageMove ??
      actor.soulsMoveType ??
      'slash';
    const mp = resolveMovePostureProfile(phase === 'backstep' ? 'backstep' : moveTypeRaw);
    activeMoveProfile = mp;
    const mirror = opts?.mirror ? -1 : 1;

    if (isColossalBoss && (phase === 'neutral' || phase === 'idle' || phase === 'recover' || phase === 'stagger')) {
      // Colossal Boss (`boss_troll` / `boss_warden`) owns full baked skeletal Idle, Walking, Strafe_*,
      // Recover_Heft & Stagger_Kneel clips: keep procedural root strictly upright (zero bowling-pin sway!).
      tgtPitch = 0;
      tgtRoll = 0;
      tgtYaw = 0;
      tgtBob = 0;
      tgtLean = 0;
      tgtLat = 0;
      followRate = phase === 'recover' ? 14.0 : 18.0;
    } else if (phase === 'windup') {
      // Kinetic energy coil: gathers tension rapidly, holds charged suspense near u=0.84,
      // then starts micro-cocking forward right before release (u=0.90..1.00)
      const gather = smootherstep01(u / 0.84);
      const preLaunchSnap = u > 0.88 ? smoothstep01((u - 0.88) / 0.12) * 0.14 : 0;
      const coil = gather * (1 - preLaunchSnap);

      // Heavy overhead moves drop into a brief knee gather then heave upward at the apex
      let liftOffset = 0;
      if (mp.windupLiftAtApex > 0) {
        const liftWave = smootherstep01((u - 0.28) / 0.58);
        liftOffset = mp.windupLiftAtApex * liftWave * (1 - preLaunchSnap * 1.4);
      }

      tgtPitch = mp.wPitch * coil * postureMult;
      tgtRoll = mp.wRoll * mirror * coil * postureMult;
      tgtYaw = mp.wYaw * mirror * coil * postureMult;
      tgtBob = (mp.wBob * coil + liftOffset) * linearScale * postureMult;
      tgtLean = mp.wLean * coil * linearScale * postureMult;
      tgtLat = mp.wLat * mirror * coil * linearScale * postureMult;
      followRate = 20.0;
    } else if (phase === 'active') {
      // Explosive kinetic snap from coiled end-state through the strike plane!
      // Power-skewed whip hits peak angular acceleration across u = 0.08..0.55.
      const whip = 1 - Math.pow(1 - u, 2.35);
      // Spring-loaded lead-foot plant compression peaking near impact (u=0.42) with elastic rebound
      const impactDip = Math.sin(clamp(u / 0.72, 0, 1) * Math.PI);
      const plantRebound = u > 0.52 ? Math.sin(((u - 0.52) / 0.48) * Math.PI) * mp.plantSpringBob : 0;

      const startBlend = 0.86;
      const wPitchStart = mp.wPitch * startBlend;
      const wRollStart = mp.wRoll * mirror * startBlend;
      const wYawStart = mp.wYaw * mirror * startBlend;
      const wBobStart = (mp.wBob * startBlend + mp.windupLiftAtApex * 0.78);
      const wLeanStart = mp.wLean * startBlend;
      const wLatStart = mp.wLat * mirror * startBlend;

      tgtPitch = (wPitchStart + (mp.aPitch - wPitchStart) * whip) * postureMult;
      tgtRoll = (wRollStart + (mp.aRoll * mirror - wRollStart) * whip) * postureMult;
      tgtYaw = (wYawStart + (mp.aYaw * mirror - wYawStart) * whip) * postureMult;
      tgtBob = (wBobStart + (mp.aBob - wBobStart) * whip - impactDip * 0.024 + plantRebound) * linearScale * postureMult;
      tgtLean = (wLeanStart + (mp.aLean - wLeanStart) * whip) * linearScale * postureMult;
      tgtLat = (wLatStart + (mp.aLat * mirror - wLatStart) * whip) * linearScale * postureMult;
      followRate = 40.0;
    } else if (phase === 'recover') {
      // Phase A [0 .. overEndU]: heavy-weapon inertia follow-through («дотягивание»)
      // Phase B [overEndU .. 1]: elastic return to balanced combat stance with gentle weight catch
      const overEnd = mp.overEndU;
      const overBell = u < overEnd ? Math.sin((u / overEnd) * Math.PI) : 0;

      let returnWeight;
      let settleBounce = 0;
      if (u <= overEnd * 0.65) {
        returnWeight = 1.0;
      } else {
        const ru = clamp((u - overEnd * 0.65) / Math.max(0.05, 1 - overEnd * 0.65), 0, 1);
        const eased = smootherstep01(ru);
        // Subtle 7% damped elastic catch near u = 0.80 as feet re-establish upright equilibrium
        const elastic = -0.075 * Math.sin(ru * Math.PI * 1.35) * (1 - ru) * Math.min(1.25, heft);
        returnWeight = Math.max(-0.08, 1 - eased + elastic);
        settleBounce = Math.sin(ru * Math.PI) * 0.018 * Math.min(1.3, heft);
      }

      const heftCarry = overBell * heft;
      tgtPitch = (mp.aPitch * returnWeight + mp.rOverPitch * heftCarry) * postureMult;
      tgtRoll = (mp.aRoll * mirror * returnWeight + mp.rOverRoll * mirror * heftCarry) * postureMult;
      tgtYaw = (mp.aYaw * mirror * returnWeight + mp.rOverYaw * mirror * heftCarry) * postureMult;
      tgtBob = (mp.aBob * returnWeight + mp.rOverBob * heftCarry + settleBounce) * linearScale * postureMult;
      tgtLean = (mp.aLean * returnWeight + mp.rOverLean * heftCarry) * linearScale * postureMult;
      tgtLat = (mp.aLat * mirror * returnWeight) * linearScale * postureMult;
      followRate = 16.0;
    } else if (phase === 'backstep') {
      const hopArc = Math.sin(u * Math.PI);
      const landCatch = u > 0.68 ? Math.sin(((u - 0.68) / 0.32) * Math.PI) : 0;
      tgtPitch = (mp.aPitch * hopArc + 0.06 * landCatch) * postureMult;
      tgtRoll = mp.aRoll * mirror * hopArc * postureMult;
      tgtYaw = mp.aYaw * mirror * hopArc * postureMult;
      tgtBob = (mp.aBob * hopArc - 0.048 * landCatch) * linearScale * postureMult;
      tgtLean = mp.aLean * hopArc * linearScale * postureMult;
      followRate = 26.0;
    } else if (phase === 'stagger') {
      // Heavy winded slump during Stagger_Kneel / Guard Break / Stun
      const timeSec = finiteOr(opts?.timeSec ?? opts?.elapsedTime, 0);
      const pant = Math.sin(timeSec * 4.4) * 0.016;
      tgtPitch = (0.14 + pant) * postureMult;
      tgtRoll = Math.sin(timeSec * 2.1) * 0.025 * postureMult;
      tgtYaw = 0;
      tgtBob = (-0.036 + pant * 0.35) * linearScale;
      tgtLean = 0.045 * linearScale;
      followRate = 11.0;
    } else {
      // Neutral / locomotion inertia: velocity lean, strafe bank, turn lean & combat breath
      const vx = finiteOr(opts?.vx ?? actor.moveVelX ?? actor.vx, 0);
      const vz = finiteOr(opts?.vz ?? actor.moveVelZ ?? actor.vz, 0);
      const fwdX = Math.sin(facing);
      const fwdZ = Math.cos(facing);
      const leftX = Math.cos(facing);
      const leftZ = -Math.sin(facing);

      const localFwdSpd = vx * fwdX + vz * fwdZ;
      const localLeftSpd = vx * leftX + vz * leftZ;
      const moveSpeed = Math.hypot(vx, vz);
      const isBlocking = Boolean(opts?.isBlocking);
      const inCombat = Boolean(opts?.inCombat ?? actor.soulsAwake);
      const timeSec = finiteOr(opts?.timeSec ?? opts?.elapsedTime, 0);

      // Lean slightly forward when advancing, slightly back when backpedaling
      const movePitch = clamp(localFwdSpd / 5.5, -0.7, 1.15) * 0.095;
      // Bank gently INTO sideways strafe and yaw turns (athletic footwork)
      const strafeRoll = -clamp(localLeftSpd / 3.2, -1, 1) * 0.095;
      const turnRoll = clamp(st.smoothedYawRate / 6.5, -1, 1) * 0.065;
      const turnYawLead = clamp(st.smoothedYawRate / 7.5, -1, 1) * 0.075;
      const blockPitch = isBlocking ? 0.055 : 0;
      const blockRoll = isBlocking ? -0.055 : 0;

      // Subtle living combat breathing when idle/stalking
      const breathFreq = inCombat ? 2.65 : 1.65;
      const breathWave = timeSec > 0 ? Math.sin(timeSec * breathFreq + (finiteOr(actor.uid, 0) * 1.37)) : 0;
      const idleWeight = 1 - smoothstep01(moveSpeed / 1.8);
      const breathBob = breathWave * (inCombat ? 0.009 : 0.005) * idleWeight;

      tgtPitch = (movePitch + blockPitch + breathWave * 0.008 * idleWeight) * postureMult;
      tgtRoll = (strafeRoll + turnRoll + blockRoll) * postureMult;
      tgtYaw = turnYawLead * postureMult;
      tgtBob = (breathBob - (isBlocking ? 0.022 : 0)) * linearScale;
      tgtLean = clamp(localFwdSpd / 5.5, -0.5, 1.0) * 0.055 * linearScale;
      tgtLat = clamp(localLeftSpd / 3.5, -1, 1) * 0.032 * linearScale;
      followRate = 14.0;
    }

    st.prevPhase = phase;
  } else {
    followRate = 24.0;
  }

  // 5. Smooth base posture follower (eliminates 1-frame phase transition pops while preserving whip snap)
  const useSmoothing = opts?.smooth !== false && opts?.stateless !== true && safeDt > 0 && st.postureInit;
  if (useSmoothing) {
    const alpha = 1 - Math.exp(-followRate * safeDt);
    st.curPitch += (tgtPitch - st.curPitch) * alpha;
    st.curRoll += (tgtRoll - st.curRoll) * alpha;
    st.curYaw += (tgtYaw - st.curYaw) * alpha;
    st.curBobY += (tgtBob - st.curBobY) * alpha;
    st.curForwardLean += (tgtLean - st.curForwardLean) * alpha;
    st.curLateralShift += (tgtLat - st.curLateralShift) * alpha;
  } else {
    st.curPitch = tgtPitch;
    st.curRoll = tgtRoll;
    st.curYaw = tgtYaw;
    st.curBobY = tgtBob;
    st.curForwardLean = tgtLean;
    st.curLateralShift = tgtLat;
    st.postureInit = true;
  }

  // 6. Combine base attack/locomotion inertia + critically damped recoil spring (clamped safely)
  const recMult = suppressed ? 0 : (isColossalBoss ? SOULS_PHYSICS_CFG.BOSS_RECOIL_SCALE : 1);

  if (isColossalBoss) {
    // Colossal Boss strict floor-guard & anti-clipping envelope:
    //   - Smooth exponential decay to 0 in neutral/idle/recover/stagger (NO 1-frame bossIdleStrict hard-zero snap!)
    //   - Hard `bobY >= 0.0` floor guard (never sinks knees/feet/hammer below y = 0)
    //   - Soft overhead/slam pitch ceiling so baked heavy slams never clip through stone flagstones
    const isBossOverhead = activeMoveProfile.id === 'overhead' || activeMoveProfile.id === 'leap_slam';
    const bossMaxFwdPitch = isBossOverhead
      ? SOULS_PHYSICS_CFG.BOSS_OVERHEAD_MAX_PITCH_FWD_RAD
      : SOULS_PHYSICS_CFG.BOSS_MAX_PITCH_FWD_RAD;

    out.pitchRad = clamp(
      st.curPitch + st.recPitch * recMult,
      SOULS_PHYSICS_CFG.BOSS_MAX_PITCH_BACK_RAD,
      bossMaxFwdPitch
    );
    out.rollRad = clamp(
      st.curRoll + st.recRoll * recMult,
      -SOULS_PHYSICS_CFG.BOSS_MAX_ROLL_RAD,
      SOULS_PHYSICS_CFG.BOSS_MAX_ROLL_RAD
    );
    out.yawOffsetRad = clamp(
      st.curYaw + st.recYaw * recMult,
      -SOULS_PHYSICS_CFG.BOSS_MAX_YAW_OFFSET_RAD,
      SOULS_PHYSICS_CFG.BOSS_MAX_YAW_OFFSET_RAD
    );
    out.bobY = clamp(
      st.curBobY + Math.max(0, st.recBobY * recMult),
      SOULS_PHYSICS_CFG.BOSS_MIN_BOB_Y_M,
      SOULS_PHYSICS_CFG.BOSS_MAX_BOB_UP_M
    );
    out.forwardLean = clamp(
      st.curForwardLean + st.recLean * recMult,
      SOULS_PHYSICS_CFG.BOSS_MAX_LEAN_BACK_M,
      SOULS_PHYSICS_CFG.BOSS_MAX_LEAN_FWD_M
    );
    out.lateralShift = clamp(
      st.curLateralShift,
      -SOULS_PHYSICS_CFG.BOSS_MAX_LATERAL_SHIFT_M,
      SOULS_PHYSICS_CFG.BOSS_MAX_LATERAL_SHIFT_M
    );
    out.recoilActive = Boolean(recoilActive && !suppressed);
  } else {
    const maxBobDown = SOULS_PHYSICS_CFG.MAX_BOB_DOWN_M * linearScale;
    const maxBobUp = SOULS_PHYSICS_CFG.MAX_BOB_UP_M * linearScale;
    const maxLeanBack = SOULS_PHYSICS_CFG.MAX_LEAN_BACK_M * linearScale;
    const maxLeanFwd = SOULS_PHYSICS_CFG.MAX_LEAN_FWD_M * linearScale;
    const maxLat = SOULS_PHYSICS_CFG.MAX_LATERAL_SHIFT_M * linearScale;

    out.pitchRad = clamp(
      st.curPitch + st.recPitch * recMult,
      SOULS_PHYSICS_CFG.MAX_PITCH_BACK_RAD,
      SOULS_PHYSICS_CFG.MAX_PITCH_FWD_RAD
    );
    out.rollRad = clamp(
      st.curRoll + st.recRoll * recMult,
      -SOULS_PHYSICS_CFG.MAX_ROLL_RAD,
      SOULS_PHYSICS_CFG.MAX_ROLL_RAD
    );
    out.yawOffsetRad = clamp(
      st.curYaw + st.recYaw * recMult,
      -SOULS_PHYSICS_CFG.MAX_YAW_OFFSET_RAD,
      SOULS_PHYSICS_CFG.MAX_YAW_OFFSET_RAD
    );
    out.bobY = clamp(st.curBobY + st.recBobY * recMult, maxBobDown, maxBobUp);
    out.forwardLean = clamp(st.curForwardLean + st.recLean * recMult, maxLeanBack, maxLeanFwd);
    out.lateralShift = clamp(st.curLateralShift, -maxLat, maxLat);
    out.recoilActive = Boolean(recoilActive && !suppressed);
  }

  return out;
}

/**
 * Optional zero-allocation Three.js Object3D applier for `computeCombatPostureDynamics`.
 * Automatically enforces `'YXZ'` Euler rotation order so local pitch (`rotation.x`) and
 * local roll (`rotation.z`) ALWAYS tilt relative to the character's facing heading
 * (even when facing North/East/West!) instead of world axes.
 *
 * @param {object} obj3D Three.js Object3D (root or child mesh wrapper)
 * @param {object} posture Output from `computeCombatPostureDynamics`
 * @param {object} [opts]
 * @param {number} [opts.baseX] World X (if applying world forwardLean offset)
 * @param {number} [opts.baseY=0] Ground Y
 * @param {number} [opts.baseZ] World Z (if applying world forwardLean offset)
 * @param {number} [opts.baseFacing=0] Actor facing yaw (rad)
 * @param {boolean} [opts.isLocalChild=false] Set true if `obj3D` is a child inside a yaw-rotated root
 * @param {boolean} [opts.applyForwardLean=true] Apply center-of-mass forward/lateral shift
 */
export function applyCombatPostureToObject3D(obj3D, posture, opts = null) {
  if (!obj3D || !posture) return;
  const isLocalChild = Boolean(opts?.isLocalChild);
  const baseFacing = finiteOr(opts?.baseFacing, 0);
  const baseY = finiteOr(opts?.baseY, 0);
  const applyLean = opts?.applyForwardLean !== false;

  if (obj3D.rotation) {
    if (obj3D.rotation.order !== 'YXZ') {
      obj3D.rotation.order = 'YXZ';
    }
    obj3D.rotation.y = isLocalChild ? posture.yawOffsetRad : baseFacing + posture.yawOffsetRad;
    obj3D.rotation.x = posture.pitchRad;
    obj3D.rotation.z = posture.rollRad;
  }

  if (obj3D.position) {
    const allowBob = opts?.applyBobY !== false;
    obj3D.position.y = baseY + (allowBob ? Math.max(0, posture.bobY) : 0);
    if (applyLean) {
      if (isLocalChild) {
        obj3D.position.x = finiteOr(posture.lateralShift, 0);
        obj3D.position.z = finiteOr(posture.forwardLean, 0);
      } else if (Number.isFinite(opts?.baseX) && Number.isFinite(opts?.baseZ)) {
        const sinF = Math.sin(baseFacing);
        const cosF = Math.cos(baseFacing);
        const fwd = finiteOr(posture.forwardLean, 0);
        const lat = finiteOr(posture.lateralShift, 0);
        obj3D.position.x = opts.baseX + sinF * fwd + cosF * lat;
        obj3D.position.z = opts.baseZ + cosF * fwd - sinF * lat;
      }
    } else if (isLocalChild) {
      obj3D.position.x = 0;
      obj3D.position.z = 0;
    }
  }
}

// ============================================================================
// 8. Ground-Speed to Walk/Strafe Clip Playback Synchronization (Zero Treadmill!)
// ============================================================================

/**
 * Computes the exact locomotion animation clip playback rate (`animSpeedMult`) from actual
 * horizontal ground speed `Math.hypot(vx, vz)` (or post-clamp displacement `Math.hypot(dx, dz) / dt`)
 * and the model's anatomical stride length — permanently eliminating the "treadmill" effect!
 *
 * Flexible zero-allocation signatures:
 *   1. `computeFootSyncPlaybackRate(vx, vz, opts)`
 *   2. `computeFootSyncPlaybackRate(actor, vx, vz, opts)`
 *   3. `computeFootSyncPlaybackRate(actor, opts)`
 *   4. `computeFootSyncPlaybackRate({ vx, vz, dx, dz, dt, actor, type, strideLength, clipDuration, mode, ... })`
 *
 * @returns {number} Exact playback rate (`0` when below stop threshold -> clean Idle transition)
 */
export function computeFootSyncPlaybackRate(a, b = undefined, c = undefined, d = undefined) {
  let actor = null;
  let opts = null;
  let vx = 0;
  let vz = 0;
  let hasExplicitVel = false;

  if (typeof a === 'number') {
    vx = a;
    vz = typeof b === 'number' ? b : 0;
    hasExplicitVel = true;
    opts = c && typeof c === 'object' ? c : null;
    actor = opts?.actor || null;
  } else if (a && typeof a === 'object') {
    if (typeof b === 'number') {
      // (actor, vx, vz, opts)
      actor = a;
      vx = b;
      vz = typeof c === 'number' ? c : 0;
      hasExplicitVel = true;
      opts = d && typeof d === 'object' ? d : null;
    } else if (
      a.vx !== undefined ||
      a.vz !== undefined ||
      a.dx !== undefined ||
      a.dz !== undefined ||
      a.strideLength !== undefined ||
      a.actor !== undefined
    ) {
      // Single options object ({ vx, vz, dx, dz, dt, actor, ... }) or actor with vx/vz
      opts = a;
      actor = a.actor || (a.facing !== undefined || a.type !== undefined || a.isPlayer !== undefined ? a : null);
      if (a.vx !== undefined || a.vz !== undefined) {
        vx = finiteOr(a.vx, 0);
        vz = finiteOr(a.vz, 0);
        hasExplicitVel = true;
      }
    } else {
      // (actor, opts)
      actor = a;
      opts = b && typeof b === 'object' ? b : null;
    }
  }

  let groundSpeed = 0;
  if (opts && (opts.dx !== undefined || opts.dz !== undefined) && finiteOr(opts.dt, 0) > EPS) {
    groundSpeed = Math.hypot(finiteOr(opts.dx, 0), finiteOr(opts.dz, 0)) / opts.dt;
  } else if (hasExplicitVel) {
    groundSpeed = Math.hypot(finiteOr(vx, 0), finiteOr(vz, 0));
  } else if (actor) {
    const avx = finiteOr(actor.moveVelX ?? actor.vx, 0);
    const avz = finiteOr(actor.moveVelZ ?? actor.vz, 0);
    groundSpeed = Math.hypot(avx, avz);
  }

  if (!Number.isFinite(groundSpeed) || groundSpeed < 0) {
    groundSpeed = 0;
  }

  // Optional suppression when actor is only sliding from knockback
  if (opts?.dampWhileSliding && actor?.physSliding) {
    groundSpeed *= 0.25;
  }

  const profile = getActorPhysicsProfile(opts?.type ?? actor);
  const stopSpeed = Math.max(0.01, finiteOr(opts?.stopThreshold, SOULS_PHYSICS_CFG.FOOT_STOP_SPEED));
  const rampEnd = Math.max(stopSpeed + 0.02, finiteOr(opts?.rampEndSpeed, SOULS_PHYSICS_CFG.FOOT_RAMP_END_SPEED));

  let targetRate = 0;
  if (groundSpeed >= stopSpeed) {
    const modeKey = typeof opts?.mode === 'string'
      ? opts.mode.toLowerCase()
      : (typeof opts?.strafeAnimMode === 'string' ? opts.strafeAnimMode.toLowerCase() : 'combat_walk');
    const modeMult = LOCOMOTION_STRIDE_MULT[modeKey] ?? 1.0;

    let effStride;
    if (opts && Number.isFinite(Number(opts.strideLength)) && Number(opts.strideLength) > EPS) {
      const explicitScale = finiteOr(opts.scaleMultiplier, 1.0);
      effStride = Number(opts.strideLength) * modeMult * clamp(explicitScale, 0.35, 3.0);
    } else {
      const actorScale = finiteOr(opts?.scale ?? actor?.scale, profile.referenceScale);
      const relScale = resolveRelativeScale(actorScale, profile);
      if (modeKey === 'patrol' && profile.patrolStrideLength > EPS) {
        effStride = profile.patrolStrideLength * relScale;
      } else if (
        (modeKey === 'strafe' || modeKey === 'strafe_left' || modeKey === 'strafe_right' || modeKey === 'circle') &&
        profile.strafeStrideLength > EPS
      ) {
        effStride = profile.strafeStrideLength * relScale;
      } else {
        effStride = profile.strideLength * relScale * modeMult;
      }
    }

    const clipDur = opts && Number.isFinite(Number(opts.clipDuration)) && Number(opts.clipDuration) > EPS
      ? Number(opts.clipDuration)
      : profile.clipDuration;
    const baseClipSpeed = opts && Number.isFinite(Number(opts.baseClipSpeed)) && Number(opts.baseClipSpeed) > EPS
      ? Number(opts.baseClipSpeed)
      : 1.0;

    // Exact linear 1:1 kinematic sync: v_ground * clipDuration / strideLength
    const rawRate = (groundSpeed * clipDur) / Math.max(0.25, effStride * baseClipSpeed);

    // Above 1.25x nominal cadence, gently taper via human stride-length elasticity (no cartoon leg blur)
    const hasExplicitStride = Boolean(opts && Number.isFinite(Number(opts.strideLength)) && Number(opts.strideLength) > EPS);
    const nominal = hasExplicitStride ? 1.0 : (profile.nominalRate || 1.0) / baseClipSpeed;
    const knee = SOULS_PHYSICS_CFG.FOOT_HIGH_SPEED_KNEE * nominal;
    const adjustedRate = rawRate <= knee
      ? rawRate
      : knee * Math.pow(rawRate / knee, SOULS_PHYSICS_CFG.FOOT_HIGH_SPEED_POWER);

    const minRate = clamp(finiteOr(opts?.minRate, SOULS_PHYSICS_CFG.FOOT_MIN_RATE), 0.1, 1.5);
    const defaultMaxRate = hasExplicitStride
      ? SOULS_PHYSICS_CFG.FOOT_MAX_RATE
      : (profile.maxPlaybackRate || SOULS_PHYSICS_CFG.FOOT_MAX_RATE);
    const maxRate = clamp(finiteOr(opts?.maxRate, defaultMaxRate), minRate, 4.0);

    // Smooth deceleration near stop threshold prevents abrupt gait freezes when coming to a halt
    if (groundSpeed < rampEnd) {
      const ramp01 = smoothstep01((groundSpeed - stopSpeed) / (rampEnd - stopSpeed));
      targetRate = clamp(adjustedRate, minRate * 0.65, maxRate) * ramp01;
    } else {
      targetRate = clamp(adjustedRate, minRate, maxRate);
    }
  }

  // Optional zero-alloc exponential rate smoothing (when caller passes `smoothDt`)
  const smoothDt = finiteOr(opts?.smoothDt, 0);
  if (actor && smoothDt > 0) {
    const st = ensureState(actor, profile);
    if (!st.footSyncInit) {
      st.footSyncRate = targetRate;
      st.footSyncInit = true;
    } else {
      const rate = targetRate === 0 ? 18.0 : 14.0;
      const alpha = 1 - Math.exp(-rate * clamp(smoothDt, 0, SOULS_PHYSICS_CFG.MAX_DT));
      st.footSyncRate += (targetRate - st.footSyncRate) * alpha;
      if (targetRate === 0 && st.footSyncRate < 0.04) {
        st.footSyncRate = 0;
      }
    }
    return st.footSyncRate;
  }

  return targetRate;
}
