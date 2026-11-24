// Dark Souls Poise, Hyper-Armor & Anti-Stunlock Microstun Controller.
// Pure zero-dependency ES module for bidirectional hit reactions:
//   1) Player -> Enemy / Boss:
//      - Hyper-Armor during active boss/elite windups, swings, leaps, whirlwinds, roars & throne rise.
//      - Outside Hyper-Armor (idle/stalk/walk/recover), hits accumulate micro-poise up to poiseMax,
//        triggering one crisp Hit_React (boss) or Hit_A (mob) and immediately arming poiseImmunitySec
//        (~4.4s boss, ~2.6s Souls mobs) so spamming LMB can NEVER stunlock enemies.
//      - Main stagger/staggerMax (Stance Break -> Stagger_Kneel) remains strictly independent and
//        breaks through any Hyper-Armor at 100%; Hit_React never interrupts Stagger_Kneel/Recover.
//   2) Enemy / Boss -> Player (Warrior):
//      - Unblocked hits (not blocking, not parrying, not in roll i-frames, not dead, not on
//        playerFlinchCooldown = 1.45s) trigger a brief ~0.24s microstun (Warrior_Run.glb 'Impact'
//        clip + brief slow + knockback impulse), roll-cancelable with Space after 0.16s.

export const BOSS_POISE_CFG = Object.freeze({
  basePoiseMax: 68,
  escalationPerInterrupt: 14,
  maxPoiseCap: 110,
  escalationDecayDelaySec: 6.5,
  escalationDecayRate: 3.5,
  maxConsecutiveInterrupts: 2,
  interruptLockoutSec: 5.0,
  interruptComboResetSec: 2.2,
  interruptCooldownSec: 5.0,
  windupCutoff01: 0.62,
  interruptMicroStunSec: 0.36,
  interruptClip: 'Hit_React',
  interruptClipLeft: 'Hit_React_Left',
  interruptClipCenter: 'Hit_React_Gut',
  interruptClipSpeed: 1.35,
  joltScaleReact: 0.28,
  joltScaleOverlay: 0.24
});

export const POISE_PROFILES = Object.freeze({
  souls_boss: Object.freeze({
    id: 'souls_boss',
    poiseMax: BOSS_POISE_CFG.basePoiseMax,
    poiseRegenDelaySec: 3.2,
    poiseRegenRate: 14,
    poiseImmunitySec: BOSS_POISE_CFG.interruptLockoutSec,
    microStunSec: BOSS_POISE_CFG.interruptMicroStunSec,
    hitClip: BOSS_POISE_CFG.interruptClip,
    hitSpeed: BOSS_POISE_CFG.interruptClipSpeed,
    punishHitClip: BOSS_POISE_CFG.interruptClipCenter,
    punishHitSpeed: BOSS_POISE_CFG.interruptClipSpeed,
    punishMicroStunSec: BOSS_POISE_CFG.interruptMicroStunSec,
    hyperArmorPoiseLeak: 0.25,
    hyperArmorPoiseCapRatio: 0.78,
    joltScaleNormal: BOSS_POISE_CFG.joltScaleReact,
    joltScaleHyperArmor: BOSS_POISE_CFG.joltScaleOverlay,
    joltScaleBreak: BOSS_POISE_CFG.joltScaleReact,
    interruptsActiveAttack: true
  }),
  boss: Object.freeze({
    id: 'boss',
    poiseMax: 65,
    poiseRegenDelaySec: 2.4,
    poiseRegenRate: 26,
    poiseImmunitySec: 2.65,
    microStunSec: 0.28,
    hitClip: 'Hit_React',
    hitSpeed: 1.8,
    hyperArmorPoiseLeak: 0.25,
    hyperArmorPoiseCapRatio: 0.78,
    joltScaleNormal: 0.55,
    joltScaleHyperArmor: 0.30,
    joltScaleBreak: 1.0,
    interruptsActiveAttack: false
  }),
  miniboss_elite: Object.freeze({
    id: 'miniboss_elite',
    poiseMax: 44,
    poiseRegenDelaySec: 2.0,
    poiseRegenRate: 20,
    poiseImmunitySec: 2.0,
    microStunSec: 0.30,
    hitClip: 'Hit_A',
    hitSpeed: 1.85,
    hyperArmorPoiseLeak: 0.25,
    hyperArmorPoiseCapRatio: 0.75,
    joltScaleNormal: 0.65,
    joltScaleHyperArmor: 0.35,
    joltScaleBreak: 1.0,
    interruptsActiveAttack: false
  }),
  souls_mob: Object.freeze({
    id: 'souls_mob',
    poiseMax: 22,
    poiseRegenDelaySec: 1.4,
    poiseRegenRate: 24,
    poiseImmunitySec: 1.05,
    maxConsecutiveFlinches: 2,
    microStunSec: 0.54,
    hitClip: 'Hit_React',
    hitSpeed: 1.05,
    hyperArmorPoiseLeak: 0.25,
    hyperArmorPoiseCapRatio: 0.75,
    joltScaleNormal: 0.80,
    joltScaleHyperArmor: 0.45,
    joltScaleBreak: 1.05,
    interruptsActiveAttack: true
  }),
  mob: Object.freeze({
    id: 'mob',
    poiseMax: 20,
    poiseRegenDelaySec: 1.6,
    poiseRegenRate: 18,
    poiseImmunitySec: 1.15,
    microStunSec: 0.22,
    hitClip: 'Hit_A',
    hitSpeed: 1.9,
    hyperArmorPoiseLeak: 0.20,
    hyperArmorPoiseCapRatio: 0.75,
    joltScaleNormal: 0.75,
    joltScaleHyperArmor: 0.45,
    joltScaleBreak: 1.0,
    interruptsActiveAttack: false
  }),
  dummy: Object.freeze({
    id: 'dummy',
    poiseMax: 1,
    poiseRegenDelaySec: 0.5,
    poiseRegenRate: 50,
    poiseImmunitySec: 0.22,
    microStunSec: 0.18,
    hitClip: 'Hit_A',
    hitSpeed: 1.9,
    hyperArmorPoiseLeak: 0,
    hyperArmorPoiseCapRatio: 0,
    joltScaleNormal: 0.80,
    joltScaleHyperArmor: 0.50,
    joltScaleBreak: 1.0,
    interruptsActiveAttack: false
  })
});

export const PLAYER_MICROSTUN_DEFAULTS = Object.freeze({
  flinchCooldownSec: 0.52,
  microStunSec: 0.34,
  cancelableAfterSec: 0.23,
  moveSpeedMult: 0.28,
  impulseSpeedMob: 4.1,
  impulseSpeedBoss: 5.8,
  clipName: 'Impact',
  clipDurationSec: 1.0,
  blendInSec: 0.025,
  blendOutSec: 0.110
});

// Elden Ring Stance Break (Poise Damage) table per player attack class
export const STANCE_DAMAGE_TABLE = Object.freeze({
  r1: 5,
  r1Finisher: 13,
  r2: 15,
  chargedR2: 26,
  rollingR1: 5,
  runningR1: 5,
  jumpR2: 22,
  guardCounter: 24,
  parry: 82
});

// Elden Ring stance regeneration rate (points/sec after regen delay elapses)
export const STANCE_REGEN_RATE = 13.0;

/**
 * Illusory Wall Elden Ring stance regeneration delay formula:
 * wait >= 6.0s, scaling linearly with maxStance / 13.33 for larger boss stance pools.
 */
export function getStanceRegenDelay(maxStance) {
  const numericMax = Number(maxStance);
  const effectiveMax = Number.isFinite(numericMax) && numericMax > 0 ? numericMax : 80;
  return Math.max(6.0, effectiveMax / 13.33);
}

// Elden Ring 3-tier player hitstun specs (light / heavy / knockdown)
export const PLAYER_HITSTUN_SPECS = Object.freeze({
  light: Object.freeze({
    damageLevel: 'light',
    duration: 0.34,
    rollCancelAfter: 0.23,
    moveSpeedMult: 0.28,
    impulseMult: 1.08
  }),
  heavy: Object.freeze({
    damageLevel: 'heavy',
    duration: 0.52,
    rollCancelAfter: 0.35,
    moveSpeedMult: 0.18,
    impulseMult: 1.50
  }),
  knockdown: Object.freeze({
    damageLevel: 'knockdown',
    duration: 0.88,
    rollCancelAfter: 0.58,
    moveSpeedMult: 0.05,
    impulseMult: 2.05
  })
});

export function getPlayerHitstunSpec(damageLevel = 'light') {
  const key = typeof damageLevel === 'string' ? damageLevel.trim().toLowerCase() : 'light';
  return PLAYER_HITSTUN_SPECS[key] || PLAYER_HITSTUN_SPECS.light;
}

// Elden Ring Guard Boost, Guard Counter, Parry & Riposte timing/tuning constants
export const SOULS_GUARD_CFG = Object.freeze({
  guardBoost: 55,
  physChipMult: 0.0,
  mobileBlockChipMult: 0.15,
  guardBreakDuration: 1.45,
  guardCounterWindowPc: 0.48,
  guardCounterWindowTouch: 0.56,
  parryStartupSec: 0.115,
  parryStartupTouch: 0.0,
  parryActivePc: 0.115,
  parryActiveTouch: 0.275,
  partialParryTolerance: 0.045,
  partialParryHpMult: 0.35,
  riposteInvulnSec: 1.05
});

/**
 * Computes stamina drained on a shield block using Elden Ring's Guard Boost reduction:
 *   cost = max(4, baseStaminaDmg * (1 - clamp(guardBoost, 0, 98) / 100))
 */
export function computeBlockedStaminaCost(baseStaminaDmg, guardBoost = SOULS_GUARD_CFG.guardBoost) {
  const base = Math.max(0, Number(baseStaminaDmg) || 0);
  const boostNum = Number(guardBoost);
  const clampedBoost = Number.isFinite(boostNum)
    ? Math.min(98, Math.max(0, boostNum))
    : SOULS_GUARD_CFG.guardBoost;
  return Math.max(4, base * (1 - clampedBoost / 100));
}

// Boss / Souls state names that inherently grant Hyper-Armor (normal hits never interrupt these!)
export const THRONE_HYPER_ARMOR_PHASES = new Set([
  'sitting',
  'pause',
  'standing',
  'roar',
  'roar_taunt'
]);

export const STAGGER_KNEEL_STATES = new Set([
  'stagger_kneel',
  'kneel',
  'kneeling',
  'staggered',
  'riposte_victim'
]);

export const STAGGER_RECOVER_STATES = new Set([
  'stagger_recover',
  'recover_stagger',
  'stand_from_kneel'
]);

export const BOSS_HYPER_ARMOR_STATES = new Set([
  'windup',
  'attack',
  'attacking',
  'swing',
  'active',
  'strike',
  'combo',
  'combo_swing',
  'aaa_combo',
  'combo_sweep_1',
  'combo_backhand_2',
  'combo_slam_3',
  'overhead_cleave',
  'heavy_cleave',
  'sweep_combo',
  'sweep_1',
  'sweep_2',
  'delayed_hold',
  'delayed_crush',
  'leap_windup',
  'leap_telegraph',
  'leap_air',
  'leaping',
  'leap_slam',
  'whirl_windup',
  'whirl_spin',
  'rising_upcut',
  'ram_thrust_hook',
  'telegraph_dash',
  'dashing',
  'slam',
  'cleave',
  'lunge',
  'roar',
  'roar_taunt',
  'phase2_roar',
  'phase_transition',
  'throne_standup',
  'spiral_1',
  'plague_cast',
  'summon'
]);

export const NON_HYPER_ARMOR_STATES = new Set([
  '',
  'idle',
  'stalk',
  'stalk_advance',
  'menacing_advance',
  'walk',
  'walking',
  'approach',
  'circle',
  'circling',
  'circle_strafe',
  'predatory_circle',
  'neutral_spacing',
  'strafe',
  'retreat',
  'recover',
  'recover_heft',
  'recovery',
  'hit_react',
  'micro_stun'
]);

export const BOSS_STANDARD_INTERRUPTIBLE_ATTACKS = new Set([
  'overhead_cleave',
  'heavy_cleave',
  'ash_fissure',
  'sweep_combo',
  'delayed_crush',
  'aaa_combo',
  'combo_sweep_1',
  'combo_backhand_2',
  'combo_slam_3',
  'whirl_windup',
  'rising_upcut',
  'ram_thrust_hook'
]);

export const BOSS_UNINTERRUPTIBLE_STATES = new Set([
  'stagger_kneel',
  'kneel',
  'kneeling',
  'staggered',
  'stagger_recover',
  'recover_stagger',
  'stand_from_kneel',
  'riposte_victim',
  'roar',
  'roar_taunt',
  'phase2_roar',
  'phase_transition',
  'throne_standup',
  'leap_windup',
  'leap_telegraph',
  'leap_air',
  'leaping',
  'leap_slam',
  'whirl_spin'
]);

const WEAPON_BASE_POISE = Object.freeze({
  boss_hammer: 42,
  hammer: 42,
  zweihander: 36,
  axe: 34,
  spear: 26,
  claymore: 30,
  blade: 26,
  club: 26
});

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function normState(s) {
  return typeof s === 'string' ? s.trim().toLowerCase() : '';
}

function resolveSoulsBossPoiseMax(enemy, profile) {
  const baseMax = Number(enemy?.poiseMaxOverride) > 0
    ? Number(enemy.poiseMaxOverride)
    : (Number(profile?.poiseMax) > 0 ? Number(profile.poiseMax) : BOSS_POISE_CFG.basePoiseMax);
  const bonus = Math.max(0, Number(enemy?.bossPoiseBonus) || 0);
  return Math.min(BOSS_POISE_CFG.maxPoiseCap, Math.round(baseMax + bonus));
}

export function resolveBossDirectionalHitClip(hitInfo = {}) {
  const swingDir = typeof hitInfo?.swingDir === 'string' ? hitInfo.swingDir.trim().toLowerCase() : '';
  if (swingDir === 'left_to_right') return BOSS_POISE_CFG.interruptClipLeft;
  if (swingDir === 'center') return BOSS_POISE_CFG.interruptClipCenter;
  if (swingDir === 'right_to_left') return BOSS_POISE_CFG.interruptClip;
  const atkKey = typeof hitInfo?.attackKey === 'string' ? hitInfo.attackKey.trim().toLowerCase() : '';
  if (atkKey === 'r1_2') return BOSS_POISE_CFG.interruptClipLeft;
  if (atkKey === 'r1_3' || atkKey === 'r2' || atkKey === 'charged_r2' || atkKey === 'guard_counter') {
    return BOSS_POISE_CFG.interruptClipCenter;
  }
  return BOSS_POISE_CFG.interruptClip;
}

function isSoulsBossInterruptLockoutActive(enemy) {
  return (enemy?._bossInterruptLockoutTimer || 0) > 0 || (enemy?.bossPoiseInterruptCd || 0) > 0;
}

function isSoulsBossMidAirLeap(enemy, soulsSt) {
  if (!enemy?.isSoulsBoss) return false;
  if (enemy._soulsAirborne === true || soulsSt === 'leap_air' || soulsSt === 'leaping') return true;
  const posturePhase = normState(enemy.soulsPosturePhase);
  return soulsSt === 'leap_slam' && posturePhase === 'active' && !enemy.soulsHit1Done;
}

function isSoulsBossEarlyWindupOpen(enemy, soulsSt) {
  if (!enemy?.isSoulsBoss) return false;
  if (isSoulsBossInterruptLockoutActive(enemy)) return false;
  const activeAtk = normState(enemy.soulsActiveAttack);
  const moveType = normState(enemy.soulsMoveType);
  if (
    BOSS_UNINTERRUPTIBLE_STATES.has(soulsSt) ||
    BOSS_UNINTERRUPTIBLE_STATES.has(activeAtk) ||
    BOSS_UNINTERRUPTIBLE_STATES.has(moveType)
  ) {
    return false;
  }
  const isStandardAttack =
    BOSS_STANDARD_INTERRUPTIBLE_ATTACKS.has(soulsSt) ||
    BOSS_STANDARD_INTERRUPTIBLE_ATTACKS.has(activeAtk) ||
    BOSS_STANDARD_INTERRUPTIBLE_ATTACKS.has(moveType);
  if (!isStandardAttack) return false;

  const posturePhase = normState(enemy.soulsPosturePhase);
  const phase01 = Number.isFinite(enemy.soulsPosturePhase01) ? enemy.soulsPosturePhase01 : 0;
  if (posturePhase === 'active') return false;
  const inWindup =
    posturePhase === 'windup' ||
    ((posturePhase === '' || posturePhase === 'neutral') && (enemy.soulsAttackElapsed || 0) <= 0.06);
  return inWindup && phase01 <= BOSS_POISE_CFG.windupCutoff01;
}

export function getEnemyPoiseProfile(enemy, profileOverrides = null) {
  let key = 'mob';
  if (enemy?.isTrainingDummy) key = 'dummy';
  else if (enemy?.isSoulsBoss) key = 'souls_boss';
  else if (enemy?.isBoss) key = 'boss';
  else if (enemy?.isMiniBoss || enemy?.isWarden || enemy?.eliteType) key = 'miniboss_elite';
  else if (enemy?.isSoulsUnit) key = 'souls_mob';

  const base = POISE_PROFILES[key] || POISE_PROFILES.mob;
  const ov = profileOverrides?.[key] || null;
  const enemyMax = Number(enemy?.poiseMaxOverride);
  const enemyImm = Number(enemy?.poiseImmunityOverride);

  if (!ov && !(enemyMax > 0) && !(enemyImm > 0) && !enemy?.hitReactClip) {
    return base;
  }
  return {
    ...base,
    ...(ov || {}),
    ...(enemyMax > 0 ? { poiseMax: enemyMax } : {}),
    ...(enemyImm > 0 ? { poiseImmunitySec: enemyImm } : {}),
    ...(typeof enemy?.hitReactClip === 'string' && enemy.hitReactClip ? { hitClip: enemy.hitReactClip } : {})
  };
}

export function ensureEnemyPoiseState(enemy, opts = null) {
  if (!enemy || typeof enemy !== 'object') return null;
  const profile = getEnemyPoiseProfile(enemy, opts?.profiles);
  if (!Number.isFinite(enemy.bossPoiseInterruptCd)) enemy.bossPoiseInterruptCd = 0;
  if (!Number.isFinite(enemy.bossPoiseBonus)) enemy.bossPoiseBonus = 0;
  if (!Number.isFinite(enemy._bossConsecutiveInterrupts)) enemy._bossConsecutiveInterrupts = 0;
  if (!Number.isFinite(enemy._bossInterruptLockoutTimer)) enemy._bossInterruptLockoutTimer = 0;
  if (enemy.isSoulsBoss) {
    enemy.poiseMax = resolveSoulsBossPoiseMax(enemy, profile);
  } else if (!(Number(enemy.poiseMax) > 0)) {
    enemy.poiseMax = profile.poiseMax;
  }
  if (!Number.isFinite(enemy.poiseDamage)) {
    enemy.poiseDamage = 0;
  }
  enemy.poiseDamage = Math.max(0, Math.min(enemy.poiseMax, enemy.poiseDamage));
  enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);
  if (!Number.isFinite(enemy.poiseImmunityTimer)) enemy.poiseImmunityTimer = 0;
  if (!Number.isFinite(enemy.poiseMicroStunTimer)) enemy.poiseMicroStunTimer = 0;
  if (!Number.isFinite(enemy.poiseLastHitAge)) enemy.poiseLastHitAge = 0;
  if (!Number.isFinite(enemy.hyperArmorTimer)) enemy.hyperArmorTimer = 0;
  return profile;
}

export function ensurePlayerPoiseState(player, opts = null) {
  if (!player || typeof player !== 'object') return null;
  const cfg = opts?.playerConfig
    ? { ...PLAYER_MICROSTUN_DEFAULTS, ...opts.playerConfig }
    : PLAYER_MICROSTUN_DEFAULTS;
  if (!Number.isFinite(player.microStunTimer)) player.microStunTimer = 0;
  if (!Number.isFinite(player.microStunDuration)) player.microStunDuration = 0;
  if (!Number.isFinite(player.microStunElapsed)) player.microStunElapsed = 0;
  if (!Number.isFinite(player.microStunCancelableAfter)) {
    player.microStunCancelableAfter = cfg.cancelableAfterSec;
  }
  if (!Number.isFinite(player.microStunMoveMult)) player.microStunMoveMult = 1.0;
  if (!Number.isFinite(player.flinchCooldown)) player.flinchCooldown = 0;
  return cfg;
}

export function isPlayerEntity(entity, opts = null) {
  if (opts?.isPlayer === true || opts?.kind === 'player') return true;
  if (opts?.isPlayer === false || opts?.kind === 'enemy') return false;
  if (!entity || typeof entity !== 'object') return false;
  if (entity.isPlayer === true) return true;
  // Combat enemies carry `type` / `isBoss` / `isSoulsUnit`; player carries `dashInvulnTimer` / `comboStep` / `flinchCooldown`.
  if (entity.type !== undefined || entity.isBoss !== undefined || entity.isSoulsUnit !== undefined) {
    return false;
  }
  return (
    entity.flinchCooldown !== undefined ||
    entity.dashInvulnTimer !== undefined ||
    entity.microStunTimer !== undefined
  );
}

/**
 * Detailed Hyper-Armor check for enemies and bosses.
 * Returns { active: boolean, reason: string }.
 */
export function getEnemyHyperArmorState(enemy, opts = null) {
  if (!enemy || enemy.hp <= 0) {
    return { active: false, reason: 'inactive' };
  }
  if (opts?.forceHyperArmor === true || enemy.hyperArmor === true || (enemy.hyperArmorTimer || 0) > 0) {
    return { active: true, reason: 'explicit_hyper_armor' };
  }

  const thronePhase = normState(enemy.soulsThronePhase);
  const soulsSt = normState(enemy.soulsState);
  if (
    enemy.isSoulsBoss &&
    (THRONE_HYPER_ARMOR_PHASES.has(thronePhase) ||
      enemy.soulsAwake === false ||
      soulsSt === 'throne_sit' ||
      soulsSt === 'cutscene')
  ) {
    return { active: true, reason: 'throne_sequence' };
  }

  const bossSt = normState(enemy.bossSubState);
  const chargeSt = normState(enemy.chargeState);

  if (STAGGER_RECOVER_STATES.has(soulsSt) || STAGGER_RECOVER_STATES.has(bossSt)) {
    return { active: true, reason: 'stagger_recover' };
  }

  const extraStates = opts?.extraHyperArmorStates || null;
  if (extraStates && (extraStates.has(soulsSt) || extraStates.has(bossSt))) {
    return { active: true, reason: 'custom_state' };
  }

  const isBossTier = Boolean(enemy.isSoulsBoss || enemy.isBoss || enemy.isMiniBoss || enemy.isWarden);
  const isEliteTier = Boolean(enemy.eliteType);

  if (isBossTier) {
    if (enemy.isSoulsBoss) {
      const activeAtk = normState(enemy.soulsActiveAttack);
      const moveType = normState(enemy.soulsMoveType);
      const posturePhase = normState(enemy.soulsPosturePhase);
      if (
        BOSS_UNINTERRUPTIBLE_STATES.has(soulsSt) ||
        BOSS_UNINTERRUPTIBLE_STATES.has(activeAtk) ||
        BOSS_UNINTERRUPTIBLE_STATES.has(moveType) ||
        (soulsSt === 'leap_slam' && posturePhase === 'active')
      ) {
        return { active: true, reason: `boss_uninterruptible_${soulsSt || activeAtk || moveType}` };
      }
      // 2-Hit Interrupt Cap & Early-Windup Window (`windup01 <= 0.62`):
      //   When `_bossInterruptLockoutTimer <= 0`, Boss can be interrupted up to 2 consecutive times
      //   in neutral (`idle` / `stalk` / `recover` / `hit_react`) OR early windup (`<= 0.62`).
      //   Once `_bossConsecutiveInterrupts >= 2`, `_bossInterruptLockoutTimer = 5.0s` grants Hyper-Armor!
      if (!isSoulsBossInterruptLockoutActive(enemy)) {
        if (soulsSt === 'stalk' || soulsSt === 'recover' || soulsSt === 'idle' || NON_HYPER_ARMOR_STATES.has(soulsSt)) {
          return {
            active: false,
            reason: enemy.soulsPunishWindow ? `punish_window_${enemy.soulsPunishWindow}` : 'boss_neutral_poise_open'
          };
        }
        if (isSoulsBossEarlyWindupOpen(enemy, soulsSt)) {
          return { active: false, reason: 'boss_early_windup_open' };
        }
      } else {
        return { active: true, reason: 'boss_interrupt_lockout' };
      }
    }
    if (BOSS_HYPER_ARMOR_STATES.has(soulsSt)) {
      return { active: true, reason: `boss_souls_${soulsSt}` };
    }
    if (BOSS_HYPER_ARMOR_STATES.has(bossSt)) {
      return { active: true, reason: `boss_sub_${bossSt}` };
    }
    if (chargeSt === 'telegraph' || chargeSt === 'charging') {
      return { active: true, reason: `boss_charge_${chargeSt}` };
    }
    if ((enemy.lungeWindupTimer || 0) > 0 || (enemy.lungeTimer || 0) > 0) {
      return { active: true, reason: 'boss_lunge' };
    }
    if ((enemy.attackHyperArmorTimer || 0) > 0) {
      return { active: true, reason: 'boss_attack_timer' };
    }
    if (
      (enemy.activeAttackId || enemy.soulsActiveAttack) &&
      !NON_HYPER_ARMOR_STATES.has(soulsSt) &&
      !STAGGER_KNEEL_STATES.has(soulsSt)
    ) {
      return { active: true, reason: 'boss_active_attack' };
    }
    return { active: false, reason: 'none' };
  }

  if (isEliteTier) {
    if (chargeSt === 'telegraph' || chargeSt === 'charging') {
      return { active: true, reason: `elite_charge_${chargeSt}` };
    }
    if ((enemy.lungeTimer || 0) > 0) {
      return { active: true, reason: 'elite_lunge' };
    }
    if (soulsSt === 'attack' || soulsSt === 'attacking' || soulsSt === 'active' || soulsSt === 'strike') {
      return { active: true, reason: 'elite_strike' };
    }
    if (soulsSt === 'windup' && (enemy.soulsTimer || 0) <= 0.28) {
      return { active: true, reason: 'elite_late_windup' };
    }
    return { active: false, reason: 'none' };
  }

  // Ordinary Souls mobs & regular mobs:
  // Authentic Dark Souls rule: if the player strikes a regular Souls mob FIRST during its windup
  // (or before its blade connects), the mob does NOT get hyper-armor — its attack is cleanly interrupted!
  if (chargeSt === 'charging') {
    return { active: true, reason: 'mob_charging' };
  }
  if (!enemy.isSoulsUnit) {
    if (soulsSt === 'attack' || soulsSt === 'attacking' || soulsSt === 'active' || soulsSt === 'strike') {
      return { active: true, reason: 'mob_committed_strike' };
    }
    if (soulsSt === 'windup' && (enemy.soulsTimer || 0) <= 0.18) {
      return { active: true, reason: 'mob_late_windup' };
    }
  } else if (soulsSt === 'active' && enemy._lastSwingConnected) {
    return { active: true, reason: 'mob_already_connected' };
  }

  return { active: false, reason: 'none' };
}

/**
 * Boolean convenience check: true if the enemy currently has Hyper-Armor
 * (normal player strikes cannot interrupt or trigger Hit_React / Hit_A).
 */
export function isEnemyHyperArmored(enemy, opts = null) {
  return getEnemyHyperArmorState(enemy, opts).active;
}

export const isEnemyInHyperArmor = isEnemyHyperArmored;

export function computeHitPoiseDamage(hitInfo = {}, enemy = null) {
  if (!hitInfo || hitInfo.isDoT) return 0;
  if (Number.isFinite(Number(hitInfo.poiseDamage))) {
    return Math.max(0, Number(hitInfo.poiseDamage));
  }

  const dmg = Number(hitInfo.damage) || 0;

  // Calibrated DS3 / Elden Ring Boss poise intake (~68 base threshold, escalating +14 up to 110):
  //   - 1 Hero heavy / charged / guard-counter / finisher strike breaks base Boss poise (72..96 >= 68).
  //   - 2 quick R1 strikes break base Boss poise (36 + 36 = 72 >= 68), while 1 light poke (36) holds.
  if (enemy?.isSoulsBoss && !hitInfo.isShotgunPellet && !hitInfo.isProjectile) {
    const atkKey = typeof hitInfo.attackKey === 'string' ? hitInfo.attackKey.trim().toLowerCase() : '';
    const isCharged = Boolean(
      hitInfo.isCharged ||
      hitInfo.isChargedHeavy ||
      atkKey === 'charged_r2' ||
      hitInfo.isParryRiposte ||
      hitInfo.isBarrelBlast
    );
    if (isCharged) return 96;

    const isHeavyOrCounter = Boolean(
      hitInfo.isHeavy ||
      hitInfo.isCounter ||
      hitInfo.isGuardCounter ||
      hitInfo.isPierceCounter ||
      hitInfo.isComboFinisher ||
      hitInfo.isWaterSlam ||
      atkKey === 'r2' ||
      atkKey === 'guard_counter' ||
      atkKey === 'r1_3' ||
      atkKey === 'jump_r2' ||
      Number(hitInfo.stanceDmg) >= 18 ||
      dmg >= 56
    );
    if (isHeavyOrCounter) return 72;

    return 36;
  }

  let base = 24;
  if (hitInfo.isShotgunPellet) {
    base = 6;
  } else if (hitInfo.isProjectile) {
    base = 14;
  } else if (hitInfo.isSplash && !hitInfo.isBarrelBlast && !hitInfo.isWaterSlam) {
    base = 14;
  } else if (typeof hitInfo.weaponId === 'string' && WEAPON_BASE_POISE[hitInfo.weaponId] !== undefined) {
    base = WEAPON_BASE_POISE[hitInfo.weaponId];
  }

  let mult = 1.0;
  if (hitInfo.isComboFinisher) mult *= 1.65;
  if (hitInfo.isCrit) mult *= 1.35;

  let bonus = 0;
  if (hitInfo.isBarrelBlast) bonus += 48;
  if (hitInfo.isWaterSlam) bonus += 38;
  if (hitInfo.isParryRiposte) bonus += 60;

  const maxHp = Number(enemy?.maxHp) || 0;
  if (dmg > 0 && maxHp > 0 && dmg >= maxHp * 0.08) {
    bonus += 14;
  }

  return Math.max(0, Math.round(base * mult + bonus));
}

/**
 * Evaluates whether a player hit triggers a brief Hit_React / Hit_A microstun on an enemy/boss.
 * Strictly enforces:
 *   - Independent from main stagger/staggerMax (never interrupts Stagger_Kneel or Stagger_Recover).
 *   - Hyper-Armor blocks interruption during active swings/leaps/whirlwinds/roars/throne rise.
 *   - Conditional Souls Boss early-windup (`<= 0.68`) & neutral poise interrupt gated by `bossPoiseInterruptCd = 10.5s`.
 *   - Regular Souls mob 1st-hit windup interrupt (`Hit_React`) + 2-hit R1 combo stagger kept 100% intact.
 */
export function evaluateEnemyHitReact(enemy, hitInfo = {}, opts = null) {
  if (opts?.isSoulslike === false || hitInfo?.isSoulslike === false) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'pve_mode_disabled',
      hyperArmored: false,
      joltScale: 0,
      clipName: null,
      flinchAnim: null,
      clipSpeed: 1.0,
      microStunSec: 0,
      immunitySec: 0,
      interruptsAttack: false,
      interruptsActiveAttack: false
    };
  }
  if (!enemy || enemy.hp <= 0) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'dead',
      hyperArmored: false,
      joltScale: 0,
      clipName: null,
      flinchAnim: null,
      clipSpeed: 1.0,
      microStunSec: 0,
      immunitySec: 0,
      interruptsAttack: false,
      interruptsActiveAttack: false
    };
  }

  const profile = ensureEnemyPoiseState(enemy, opts);

  if (hitInfo?.isDoT) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'dot',
      hyperArmored: false,
      joltScale: 0,
      clipName: null,
      flinchAnim: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  const soulsSt = normState(enemy.soulsState);
  const bossSt = normState(enemy.bossSubState);

  // Dedicated ТЗ 4.1 Souls Boss Hit-React & Max-2-Consecutive-Interrupt Controller:
  //   1) 100% reliable subtle visual reaction (`shouldReact: true`) on EVERY direct melee sword hit
  //      outside riposte / cutscene / stagger_kneel / stagger_recover / mid-air leap!
  //   2) Strict 2-consecutive-interrupt cap (`_bossConsecutiveInterrupts` -> `_bossInterruptLockoutTimer = 5.0s`)
  //      in neutral (`idle`/`stalk`/`recover`) or early windup (`windup01 <= 0.62` on non-unstoppable moves).
  //      During lockout or committed hyper-armor (`windup01 > 0.62`), `interruptsActiveAttack` is `false`
  //      and `playSubtleOverlayOnly` is `true` (`joltScale: 0.24`) so the Boss can NEVER be stunlocked!
  if (enemy.isSoulsBoss) {
    const thronePhase = normState(enemy.soulsThronePhase);
    const inCutsceneOrThrone =
      THRONE_HYPER_ARMOR_PHASES.has(thronePhase) ||
      enemy.soulsAwake === false ||
      soulsSt === 'throne_sit' ||
      soulsSt === 'cutscene' ||
      soulsSt === 'throne_standup';
    const inKneelOrRiposte =
      (enemy.staggeredTimer || 0) > 0 ||
      Boolean(enemy.soulsRiposteInvuln) ||
      STAGGER_KNEEL_STATES.has(soulsSt) ||
      STAGGER_KNEEL_STATES.has(bossSt) ||
      STAGGER_RECOVER_STATES.has(soulsSt) ||
      STAGGER_RECOVER_STATES.has(bossSt);
    const inMidAirLeap = isSoulsBossMidAirLeap(enemy, soulsSt);
    const isProjectileHit = Boolean(hitInfo?.isProjectile || hitInfo?.isShotgunPellet);

    if (inCutsceneOrThrone || inKneelOrRiposte || inMidAirLeap || isProjectileHit) {
      return {
        triggered: false,
        shouldReact: false,
        shouldStun: false,
        playSubtleOverlayOnly: false,
        reason: inMidAirLeap
          ? 'mid_air_leap'
          : inCutsceneOrThrone
            ? 'cutscene_or_throne'
            : isProjectileHit
              ? 'projectile'
              : 'already_staggered',
        hyperArmored: true,
        joltScale: 0,
        clipName: null,
        flinchAnim: null,
        clipSpeed: BOSS_POISE_CFG.interruptClipSpeed,
        microStunSec: 0,
        immunitySec: enemy._bossInterruptLockoutTimer || 0,
        bossPoiseInterruptCd: enemy._bossInterruptLockoutTimer || 0,
        interruptsAttack: false,
        interruptsActiveAttack: false,
        poise: enemy.poise,
        poiseMax: enemy.poiseMax,
        poiseDamage: enemy.poiseDamage,
        poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
      };
    }

    if (
      (enemy._bossInterruptLockoutTimer || 0) <= 0 &&
      (enemy.poiseLastHitAge || 0) > BOSS_POISE_CFG.interruptComboResetSec
    ) {
      enemy._bossConsecutiveInterrupts = 0;
    }
    enemy.poiseLastHitAge = 0;

    const clipName = resolveBossDirectionalHitClip(hitInfo);
    const clipSpeed = BOSS_POISE_CFG.interruptClipSpeed;
    const activeAtk = normState(enemy.soulsActiveAttack);
    const moveType = normState(enemy.soulsMoveType);
    const lockoutActive = isSoulsBossInterruptLockoutActive(enemy) && !hitInfo?.ignorePoiseImmunity;
    const explicitHA =
      Boolean(opts?.forceHyperArmor === true || enemy.hyperArmor === true || (enemy.hyperArmorTimer || 0) > 0) &&
      !hitInfo?.bypassHyperArmor;
    const uninterruptibleMove =
      BOSS_UNINTERRUPTIBLE_STATES.has(soulsSt) ||
      BOSS_UNINTERRUPTIBLE_STATES.has(activeAtk) ||
      BOSS_UNINTERRUPTIBLE_STATES.has(moveType);
    const inNeutral =
      !uninterruptibleMove &&
      NON_HYPER_ARMOR_STATES.has(soulsSt) &&
      (!activeAtk || soulsSt === 'stalk' || soulsSt === 'idle' || soulsSt === 'recover' || soulsSt === 'hit_react');
    const inEarlyWindup = !uninterruptibleMove && isSoulsBossEarlyWindupOpen(enemy, soulsSt);
    const canInterrupt = !lockoutActive && !explicitHA && (inNeutral || inEarlyWindup);

    if (canInterrupt) {
      enemy._bossConsecutiveInterrupts = (enemy._bossConsecutiveInterrupts || 0) + 1;
      enemy.poiseBreakCount = (enemy.poiseBreakCount || 0) + 1;
      const microStunSec = BOSS_POISE_CFG.interruptMicroStunSec;
      enemy.poiseMicroStunTimer = microStunSec;
      enemy.poiseDamage = 0;
      enemy.poise = enemy.poiseMax;

      if (enemy._bossConsecutiveInterrupts >= BOSS_POISE_CFG.maxConsecutiveInterrupts) {
        enemy._bossInterruptLockoutTimer = BOSS_POISE_CFG.interruptLockoutSec;
        enemy.bossPoiseInterruptCd = BOSS_POISE_CFG.interruptLockoutSec;
        enemy.poiseImmunityTimer = BOSS_POISE_CFG.interruptLockoutSec;
      }

      return {
        triggered: true,
        shouldReact: true,
        shouldStun: true,
        playSubtleOverlayOnly: false,
        reason: inEarlyWindup ? 'boss_windup_interrupt' : 'boss_neutral_interrupt',
        hyperArmored: false,
        joltScale: BOSS_POISE_CFG.joltScaleReact,
        clipName,
        flinchAnim: clipName,
        clipSpeed,
        microStunSec,
        immunitySec: enemy._bossInterruptLockoutTimer || 0,
        bossPoiseInterruptCd: enemy._bossInterruptLockoutTimer || 0,
        consecutiveInterrupts: enemy._bossConsecutiveInterrupts,
        interruptLockoutTimer: enemy._bossInterruptLockoutTimer || 0,
        interruptsAttack: true,
        interruptsActiveAttack: true,
        poise: enemy.poise,
        poiseMax: enemy.poiseMax,
        poiseDamage: 0,
        poiseRatio: 1
      };
    }

    // Boss has Hyper-Armor (lockout active after 2 interrupts, late windup > 0.62, active swing,
    // grounded Leap_Slam extraction, Whirl_Spin, or Phase-2 Roar):
    // NEVER interrupt his attack, ALWAYS play subtle torso overlay recoil (`joltScale: 0.24`)!
    return {
      triggered: true,
      shouldReact: true,
      shouldStun: false,
      playSubtleOverlayOnly: true,
      reason: lockoutActive ? 'boss_interrupt_lockout_overlay' : 'boss_hyper_armor_overlay',
      hyperArmored: true,
      joltScale: BOSS_POISE_CFG.joltScaleOverlay,
      clipName,
      flinchAnim: clipName,
      clipSpeed,
      microStunSec: 0,
      immunitySec: enemy._bossInterruptLockoutTimer || 0,
      bossPoiseInterruptCd: enemy._bossInterruptLockoutTimer || 0,
      consecutiveInterrupts: enemy._bossConsecutiveInterrupts || 0,
      interruptLockoutTimer: enemy._bossInterruptLockoutTimer || 0,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // Never override a full Stance Break (Stagger_Kneel) or Stagger_Recover on regular mobs/bosses!
  if (
    (enemy.staggeredTimer || 0) > 0 ||
    STAGGER_KNEEL_STATES.has(soulsSt) ||
    STAGGER_KNEEL_STATES.has(bossSt)
  ) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'already_staggered',
      hyperArmored: true,
      joltScale: profile.joltScaleHyperArmor,
      clipName: null,
      flinchAnim: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  const poiseHit = computeHitPoiseDamage(hitInfo, enemy);

  // 1) Hyper-Armor check (committed late windup, active swing, leap, whirl_spin, roar, stagger_recover)
  const haState = getEnemyHyperArmorState(enemy, opts);
  if (haState.active && !hitInfo?.bypassHyperArmor) {
    if (poiseHit > 0 && profile.hyperArmorPoiseLeak > 0 && enemy.poiseImmunityTimer <= 0) {
      const cap = enemy.poiseMax * profile.hyperArmorPoiseCapRatio;
      if (enemy.poiseDamage < cap) {
        enemy.poiseDamage = Math.min(cap, enemy.poiseDamage + poiseHit * profile.hyperArmorPoiseLeak);
        enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);
      }
      enemy.poiseLastHitAge = 0;
    }
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'hyper_armor',
      hyperArmorReason: haState.reason,
      hyperArmored: true,
      joltScale: profile.joltScaleHyperArmor,
      clipName: null,
      flinchAnim: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // 2) Anti-stunlock immunity & Dark Souls 2-hit combo / counter-hit interrupt check:
  //    - Regular Souls mobs allow up to `maxConsecutiveFlinches` (2 consecutive R1 staggers, e.g. R1_1 -> R1_2)
  //      before arming brief poise escape (`1.05s`), AND striking a regular mob FIRST while it is winding up an
  //      attack ALWAYS interrupts its attack!
  const isRegularSoulsMob = Boolean(enemy.isSoulsUnit && !enemy.isSoulsBoss && !enemy.isBoss);
  const maxChainFlinches = Math.max(1, Number(profile.maxConsecutiveFlinches) || 1);
  const isCounteringMobAttack =
    isRegularSoulsMob &&
    (soulsSt === 'windup' || normState(enemy.aiState) === 'windup' || (soulsSt === 'active' && !enemy._lastSwingConnected));
  const curChainFlinches = Number(enemy._consecFlinches) || 0;
  const allowChainFollowup =
    isRegularSoulsMob &&
    curChainFlinches < maxChainFlinches &&
    (enemy.poiseLastHitAge || 0) >= 0.12;

  if ((enemy.poiseMicroStunTimer || 0) > 0 && !allowChainFollowup && !isCounteringMobAttack) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'already_flinching',
      hyperArmored: false,
      joltScale: profile.joltScaleHyperArmor,
      clipName: null,
      flinchAnim: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  if ((enemy.poiseImmunityTimer || 0) > 0 && !hitInfo?.ignorePoiseImmunity && !isCounteringMobAttack) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'immunity_cooldown',
      hyperArmored: false,
      joltScale: profile.joltScaleNormal,
      clipName: null,
      flinchAnim: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // 3) Outside Hyper-Armor & off immunity cooldown -> accumulate poise damage
  enemy.poiseLastHitAge = 0;
  enemy.poiseDamage = Math.min(enemy.poiseMax, enemy.poiseDamage + poiseHit);
  enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);

  if (enemy.poiseDamage < enemy.poiseMax && !hitInfo?.forceMicroStun && !isCounteringMobAttack) {
    return {
      triggered: false,
      shouldReact: false,
      shouldStun: false,
      reason: 'poise_holding',
      hyperArmored: false,
      joltScale: profile.joltScaleNormal,
      clipName: null,
      flinchAnim: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: 0,
      interruptsAttack: false,
      interruptsActiveAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // 4) Poise threshold reached -> trigger Hit_React (Souls Mob) or Hit_A (regular enemy)!
  enemy.poiseDamage = 0;
  enemy.poiseBreakCount = (enemy.poiseBreakCount || 0) + 1;
  enemy.poise = enemy.poiseMax;
  const nextChain = isCounteringMobAttack && curChainFlinches >= maxChainFlinches ? maxChainFlinches : curChainFlinches + 1;
  enemy._consecFlinches = nextChain;
  const chosenClip = profile.hitClip;
  const chosenSpeed = profile.hitSpeed;
  const chosenMicroStunSec = profile.microStunSec;
  enemy.poiseMicroStunTimer = chosenMicroStunSec;
  enemy.poiseImmunityTimer = nextChain >= maxChainFlinches ? profile.poiseImmunitySec : 0;
  const interruptsActive = Boolean(profile.interruptsActiveAttack);

  return {
    triggered: true,
    shouldReact: true,
    shouldStun: true,
    reason: isCounteringMobAttack ? 'counter_interrupt' : 'poise_break',
    hyperArmored: false,
    joltScale: profile.joltScaleBreak,
    clipName: chosenClip,
    flinchAnim: chosenClip,
    clipSpeed: chosenSpeed,
    microStunSec: chosenMicroStunSec,
    immunitySec: enemy.poiseImmunityTimer,
    interruptsAttack: interruptsActive,
    interruptsActiveAttack: interruptsActive,
    poise: enemy.poise,
    poiseMax: enemy.poiseMax,
    poiseDamage: 0,
    poiseRatio: 1
  };
}

export const evaluateEnemyPoiseHit = evaluateEnemyHitReact;

/**
 * Evaluates whether an unblocked enemy/boss hit triggers the Warrior's tiered hitstun ('Impact').
 * Respects block (Alt), parry, roll i-frames (Space), death, Player Hyperarmor (on light hits),
 * and personal anti-stunlock cooldown (1.45s).
 */
export function evaluatePlayerMicroStun(player, hitInfo = {}, opts = null) {
  const cfg = ensurePlayerPoiseState(player, opts) || PLAYER_MICROSTUN_DEFAULTS;
  const resolvedDamageLevel =
    typeof hitInfo?.damageLevel === 'string' && hitInfo.damageLevel.trim()
      ? getPlayerHitstunSpec(hitInfo.damageLevel).damageLevel
      : hitInfo?.isKnockdown
        ? 'knockdown'
        : hitInfo?.isHeavy || hitInfo?.isGuardBreak
          ? 'heavy'
          : 'light';
  const hitSpec = getPlayerHitstunSpec(resolvedDamageLevel);
  const hasExplicitMicroStun = opts?.microStunSec !== undefined || hitInfo?.microStunSec !== undefined;
  const rawMicroStun = hasExplicitMicroStun
    ? Number(opts?.microStunSec ?? hitInfo?.microStunSec)
    : resolvedDamageLevel === 'light'
      ? Number(opts?.playerConfig?.microStunSec ?? hitSpec.duration)
      : hitSpec.duration;
  const microStunSec = Math.max(0.08, rawMicroStun);
  const hasExplicitCancel = opts?.cancelableAfterSec !== undefined || hitInfo?.cancelableAfterSec !== undefined;
  const rawCancelAfter = hasExplicitCancel
    ? Number(opts?.cancelableAfterSec ?? hitInfo?.cancelableAfterSec)
    : resolvedDamageLevel === 'light'
      ? Number(opts?.playerConfig?.cancelableAfterSec ?? hitSpec.rollCancelAfter)
      : hitSpec.rollCancelAfter;
  const cancelableAfterSec = Math.max(0.04, Math.min(microStunSec, rawCancelAfter));
  const moveSpeedMult =
    resolvedDamageLevel === 'light' && opts?.playerConfig?.moveSpeedMult !== undefined
      ? Number(opts.playerConfig.moveSpeedMult)
      : hitSpec.moveSpeedMult;
  const flinchCooldownSec = Math.max(0.2, Number(opts?.flinchCooldownSec ?? cfg.flinchCooldownSec));
  const clipDurationSec = Math.max(0.1, Number(opts?.clipDurationSec ?? cfg.clipDurationSec));
  const clipSpeed = Number((clipDurationSec / microStunSec).toFixed(3));

  const deny = (reason, extra = null) => ({
    triggered: false,
    shouldStun: false,
    reason,
    damageLevel: resolvedDamageLevel,
    duration: 0,
    cancelableAfter: cancelableAfterSec,
    cooldownSec: flinchCooldownSec,
    cooldownRemaining: Math.max(0, Number(player?.flinchCooldown) || 0),
    moveSpeedMult: 1.0,
    impulseX: 0,
    impulseZ: 0,
    clipName: null,
    clipSpeed,
    blendInSec: cfg.blendInSec,
    blendOutSec: cfg.blendOutSec,
    cancelsAttackWindup: false,
    cancelsTurn180: false,
    ...(extra || {})
  });

  if (opts?.isSoulslike === false || hitInfo?.isSoulslike === false) {
    return deny('pve_mode_disabled');
  }
  if (!player || player.hp <= 0 || hitInfo?.isFatal || player.isDead) {
    return deny('dead');
  }
  if (hitInfo?.isDoT) {
    return deny('dot');
  }
  if (hitInfo?.isParried) {
    return deny('parried');
  }
  if (hitInfo?.isBlocked && !hitInfo?.isGuardBreak) {
    return deny('blocked');
  }
  const hasIFrames =
    Boolean(hitInfo?.isDodged || hitInfo?.inIFrames) ||
    (player.dashInvulnTimer || 0) > 0 ||
    (player.dashTimer || 0) > 0 ||
    (player.beastTimeLeft || 0) > 0 ||
    (!opts?.ignoreInvulnTimer && (player.invulnTimer || 0) > 0);
  if (hasIFrames) {
    return deny('iframes');
  }
  const playerHyperArmored =
    Boolean(player.hasHyperArmor || hitInfo?.playerHasHyperArmor) || (player.hyperArmorTimer || 0) > 0;
  if (playerHyperArmored && resolvedDamageLevel === 'light' && !hitInfo?.isGuardBreak) {
    return deny('player_hyper_armor');
  }
  if ((player.microStunTimer || 0) > 0) {
    return deny('already_stunned');
  }
  if ((player.flinchCooldown || 0) > 0 && !hitInfo?.ignoreFlinchCooldown) {
    return deny('cooldown');
  }

  // Compute knockback impulse vector away from attacker (or backward along facing if ambient/unknown)
  const attacker = hitInfo?.attacker || null;
  const srcX = Number.isFinite(hitInfo?.sourceX) ? hitInfo.sourceX : attacker?.x;
  const srcZ = Number.isFinite(hitInfo?.sourceZ) ? hitInfo.sourceZ : attacker?.z;
  let dirX = 0;
  let dirZ = 0;
  if (Number.isFinite(srcX) && Number.isFinite(srcZ)) {
    const dx = (player.x || 0) - srcX;
    const dz = (player.z || 0) - srcZ;
    const len = Math.hypot(dx, dz);
    if (len > 1e-4) {
      dirX = dx / len;
      dirZ = dz / len;
    }
  }
  if (dirX === 0 && dirZ === 0) {
    const f = Number(player.facing) || 0;
    dirX = -Math.sin(f);
    dirZ = -Math.cos(f);
  }

  const isHeavyHit = Boolean(
    resolvedDamageLevel !== 'light' ||
      hitInfo?.isHeavy ||
      hitInfo?.isGuardBreak ||
      attacker?.isBoss ||
      attacker?.isSoulsBoss ||
      attacker?.isMiniBoss
  );
  const baseImpulse = Number.isFinite(Number(hitInfo?.impulseSpeed))
    ? Number(hitInfo.impulseSpeed)
    : isHeavyHit
      ? cfg.impulseSpeedBoss
      : cfg.impulseSpeedMob;
  const impulseMag = Number.isFinite(Number(hitInfo?.impulseSpeed))
    ? baseImpulse
    : baseImpulse * (hitSpec.impulseMult || 1.0);

  player.microStunTimer = microStunSec;
  player.microStunDuration = microStunSec;
  player.microStunElapsed = 0;
  player.microStunCancelableAfter = cancelableAfterSec;
  player.microStunMoveMult = moveSpeedMult;
  player.flinchCooldown = flinchCooldownSec;

  return {
    triggered: true,
    shouldStun: true,
    reason: hitInfo?.isGuardBreak ? 'guard_break_microstun' : 'microstun',
    damageLevel: resolvedDamageLevel,
    duration: microStunSec,
    cancelableAfter: cancelableAfterSec,
    cooldownSec: flinchCooldownSec,
    cooldownRemaining: flinchCooldownSec,
    moveSpeedMult,
    impulseX: dirX * impulseMag,
    impulseZ: dirZ * impulseMag,
    clipName: cfg.clipName,
    clipSpeed,
    blendInSec: cfg.blendInSec,
    blendOutSec: cfg.blendOutSec,
    cancelsAttackWindup: true,
    cancelsTurn180: true
  };
}

export const evaluatePlayerHitReact = evaluatePlayerMicroStun;

/**
 * True when the player can roll-cancel out of an active microstun (after 0.16s) or is not stunned.
 */
export function canPlayerCancelMicroStun(player) {
  if (!player || (player.microStunTimer || 0) <= 0) return true;
  const threshold = Number.isFinite(player.microStunCancelableAfter)
    ? player.microStunCancelableAfter
    : PLAYER_MICROSTUN_DEFAULTS.cancelableAfterSec;
  return (player.microStunElapsed || 0) >= threshold;
}

/**
 * Cancels the remaining player microstun (e.g. when player rolls with Space after 0.16s).
 * Intentionally keeps player.flinchCooldown intact so anti-stunlock protection stays active!
 */
export function cancelPlayerMicroStun(player) {
  if (!player) return false;
  const wasActive = (player.microStunTimer || 0) > 0;
  player.microStunTimer = 0;
  player.microStunElapsed = 0;
  player.microStunMoveMult = 1.0;
  return wasActive;
}

export function tickEnemyPoise(enemy, dt, opts = null) {
  if (!enemy || !(dt > 0)) return;
  const profile = ensureEnemyPoiseState(enemy, opts);
  enemy.bossPoiseInterruptCd = Math.max(0, (enemy.bossPoiseInterruptCd || 0) - dt);
  if ((enemy._bossInterruptLockoutTimer || 0) > 0) {
    enemy._bossInterruptLockoutTimer = Math.max(0, enemy._bossInterruptLockoutTimer - dt);
    if (enemy._bossInterruptLockoutTimer <= 0) {
      enemy._bossConsecutiveInterrupts = 0;
      enemy.bossPoiseInterruptCd = 0;
    }
  }
  if ((enemy.poiseMicroStunTimer || 0) > 0) {
    enemy.poiseMicroStunTimer = Math.max(0, enemy.poiseMicroStunTimer - dt);
  }
  if ((enemy.poiseImmunityTimer || 0) > 0) {
    enemy.poiseImmunityTimer = Math.max(0, enemy.poiseImmunityTimer - dt);
    if (enemy.poiseImmunityTimer <= 0 && (enemy._consecFlinches || 0) > 0) {
      enemy._consecFlinches = 0;
    }
  }
  if ((enemy.hyperArmorTimer || 0) > 0) {
    enemy.hyperArmorTimer = Math.max(0, enemy.hyperArmorTimer - dt);
  }
  enemy.poiseLastHitAge = (enemy.poiseLastHitAge || 0) + dt;
  if (
    enemy.isSoulsBoss &&
    (enemy._bossInterruptLockoutTimer || 0) <= 0 &&
    (enemy._bossConsecutiveInterrupts || 0) > 0 &&
    enemy.poiseLastHitAge > BOSS_POISE_CFG.interruptComboResetSec
  ) {
    enemy._bossConsecutiveInterrupts = 0;
  }
  if ((enemy._consecFlinches || 0) > 0 && enemy.poiseLastHitAge >= 1.35 && (enemy.poiseImmunityTimer || 0) <= 0) {
    enemy._consecFlinches = 0;
  }
  if (
    enemy.isSoulsBoss &&
    (enemy.bossPoiseBonus || 0) > 0 &&
    enemy.poiseMicroStunTimer <= 0 &&
    enemy.poiseLastHitAge >= BOSS_POISE_CFG.escalationDecayDelaySec
  ) {
    enemy.bossPoiseBonus = Math.max(0, enemy.bossPoiseBonus - BOSS_POISE_CFG.escalationDecayRate * dt);
    enemy.poiseMax = resolveSoulsBossPoiseMax(enemy, profile);
    enemy.poiseDamage = Math.max(0, Math.min(enemy.poiseMax, enemy.poiseDamage));
    enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);
  }
  if (
    enemy.poiseDamage > 0 &&
    enemy.poiseMicroStunTimer <= 0 &&
    enemy.poiseLastHitAge >= profile.poiseRegenDelaySec
  ) {
    enemy.poiseDamage = Math.max(0, enemy.poiseDamage - profile.poiseRegenRate * dt);
    enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);
  }
}

export function tickPlayerPoise(player, dt, opts = null) {
  if (!player || !(dt > 0)) return;
  ensurePlayerPoiseState(player, opts);
  if ((player.flinchCooldown || 0) > 0) {
    player.flinchCooldown = Math.max(0, player.flinchCooldown - dt);
  }
  if ((player.hyperArmorTimer || 0) > 0) {
    player.hyperArmorTimer = Math.max(0, player.hyperArmorTimer - dt);
  }
  if ((player.microStunTimer || 0) > 0) {
    player.microStunTimer = Math.max(0, player.microStunTimer - dt);
    player.microStunElapsed = (player.microStunElapsed || 0) + dt;
    if (player.microStunTimer <= 0) {
      player.microStunElapsed = 0;
      player.microStunMoveMult = 1.0;
    }
  } else if (player.microStunMoveMult !== 1.0) {
    player.microStunMoveMult = 1.0;
  }
}

/**
 * Advances poise, microstun & anti-stunlock immunity timers for an enemy OR the player.
 */
export function tickPoiseTimers(entity, dt, opts = null) {
  if (!entity || !(dt > 0)) return;
  if (isPlayerEntity(entity, opts)) {
    tickPlayerPoise(entity, dt, opts);
  } else {
    tickEnemyPoise(entity, dt, opts);
  }
}

export const tickEntityPoise = tickPoiseTimers;

/**
 * Initializes or resets poise / microstun state on an enemy or the player.
 * For enemies (e.g. on spawn or right after Stagger_Kneel):
 *   resetEntityPoise(enemy, { grantImmunity: true })
 * For player (on run start / revive / death):
 *   resetEntityPoise(player, { isPlayer: true })
 */
export function resetEntityPoise(entity, opts = null) {
  if (!entity || typeof entity !== 'object') return;
  if (isPlayerEntity(entity, opts)) {
    const cfg = opts?.playerConfig
      ? { ...PLAYER_MICROSTUN_DEFAULTS, ...opts.playerConfig }
      : PLAYER_MICROSTUN_DEFAULTS;
    entity.microStunTimer = 0;
    entity.microStunDuration = 0;
    entity.microStunElapsed = 0;
    entity.microStunCancelableAfter = cfg.cancelableAfterSec;
    entity.microStunMoveMult = 1.0;
    entity.hyperArmorTimer = 0;
    if (!opts?.keepCooldown) {
      entity.flinchCooldown = Math.max(0, Number(opts?.flinchCooldownSec) || 0);
    }
    return;
  }

  const profile = getEnemyPoiseProfile(entity, opts?.profiles);
  entity._bossConsecutiveInterrupts = 0;
  if (!opts?.keepCooldown && !opts?.grantImmunity) {
    entity.bossPoiseInterruptCd = 0;
    entity._bossInterruptLockoutTimer = 0;
    entity.bossPoiseBonus = 0;
  } else {
    if (!Number.isFinite(entity.bossPoiseInterruptCd)) entity.bossPoiseInterruptCd = 0;
    if (!Number.isFinite(entity._bossInterruptLockoutTimer)) entity._bossInterruptLockoutTimer = 0;
    if (!Number.isFinite(entity.bossPoiseBonus)) entity.bossPoiseBonus = 0;
    if (entity.isSoulsBoss && opts?.grantImmunity) {
      entity._bossInterruptLockoutTimer = Math.max(entity._bossInterruptLockoutTimer || 0, 1.6);
      entity.bossPoiseInterruptCd = entity._bossInterruptLockoutTimer;
    }
  }
  entity.poiseMax = entity.isSoulsBoss ? resolveSoulsBossPoiseMax(entity, profile) : profile.poiseMax;
  entity.poiseDamage = 0;
  entity.poise = entity.poiseMax;
  entity.poiseLastHitAge = 0;
  entity.poiseMicroStunTimer = 0;
  entity.poiseBreakCount = 0;
  entity._consecFlinches = 0;
  entity.hyperArmorTimer = 0;
  if (opts?.grantImmunity) {
    entity.poiseImmunityTimer = profile.poiseImmunitySec;
  } else if (Number.isFinite(Number(opts?.immunitySec))) {
    entity.poiseImmunityTimer = Math.max(0, Number(opts.immunitySec));
  } else {
    entity.poiseImmunityTimer = 0;
  }
}

/**
 * Creates a configured Poise & Anti-Stunlock Controller instance.
 */
export function createPoiseController(config = {}) {
  const opts = {
    profiles: config.profiles || null,
    playerConfig: config.playerConfig || null,
    extraHyperArmorStates: config.extraHyperArmorStates
      ? new Set(Array.from(config.extraHyperArmorStates, (s) => normState(s)))
      : null
  };

  return {
    config: opts,
    BOSS_POISE_CFG,
    STANCE_DAMAGE_TABLE,
    STANCE_REGEN_RATE,
    PLAYER_HITSTUN_SPECS,
    SOULS_GUARD_CFG,
    getStanceRegenDelay,
    getPlayerHitstunSpec,
    computeBlockedStaminaCost,
    resolveBossDirectionalHitClip,
    getEnemyPoiseProfile: (enemy) => getEnemyPoiseProfile(enemy, opts.profiles),
    computeHitPoiseDamage,
    getEnemyHyperArmorState: (enemy, callOpts = null) =>
      getEnemyHyperArmorState(enemy, callOpts ? { ...opts, ...callOpts } : opts),
    isEnemyHyperArmored: (enemy, callOpts = null) =>
      isEnemyHyperArmored(enemy, callOpts ? { ...opts, ...callOpts } : opts),
    isEnemyInHyperArmor: (enemy, callOpts = null) =>
      isEnemyHyperArmored(enemy, callOpts ? { ...opts, ...callOpts } : opts),
    evaluateEnemyHitReact: (enemy, hitInfo = {}, callOpts = null) =>
      evaluateEnemyHitReact(enemy, hitInfo, callOpts ? { ...opts, ...callOpts } : opts),
    evaluateEnemyPoiseHit: (enemy, hitInfo = {}, callOpts = null) =>
      evaluateEnemyHitReact(enemy, hitInfo, callOpts ? { ...opts, ...callOpts } : opts),
    evaluatePlayerMicroStun: (player, hitInfo = {}, callOpts = null) =>
      evaluatePlayerMicroStun(player, hitInfo, callOpts ? { ...opts, ...callOpts } : opts),
    evaluatePlayerHitReact: (player, hitInfo = {}, callOpts = null) =>
      evaluatePlayerMicroStun(player, hitInfo, callOpts ? { ...opts, ...callOpts } : opts),
    canPlayerCancelMicroStun,
    cancelPlayerMicroStun,
    tickEnemyPoise: (enemy, dt) => tickEnemyPoise(enemy, dt, opts),
    tickPlayerPoise: (player, dt) => tickPlayerPoise(player, dt, opts),
    tickPoiseTimers: (entity, dt, callOpts = null) =>
      tickPoiseTimers(entity, dt, callOpts ? { ...opts, ...callOpts } : opts),
    tickEntityPoise: (entity, dt, callOpts = null) =>
      tickPoiseTimers(entity, dt, callOpts ? { ...opts, ...callOpts } : opts),
    tickCombatPoise: (player, enemies, dt) => {
      if (!(dt > 0)) return;
      if (player) tickPlayerPoise(player, dt, opts);
      if (Array.isArray(enemies)) {
        for (let i = 0; i < enemies.length; i++) {
          const e = enemies[i];
          if (e && e.hp > 0) tickEnemyPoise(e, dt, opts);
        }
      }
    },
    resetEntityPoise: (entity, callOpts = null) =>
      resetEntityPoise(entity, callOpts ? { ...opts, ...callOpts } : opts)
  };
}
