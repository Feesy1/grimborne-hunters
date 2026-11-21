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

export const POISE_PROFILES = Object.freeze({
  souls_boss: Object.freeze({
    id: 'souls_boss',
    poiseMax: 175,
    poiseRegenDelaySec: 2.0,
    poiseRegenRate: 34,
    poiseImmunitySec: 4.4,
    microStunSec: 0.38,
    hitClip: 'Hit_React',
    hitSpeed: 1.65,
    punishHitClip: 'Hit_React_Gut',
    punishHitSpeed: 2.15,
    punishMicroStunSec: 0.42,
    hyperArmorPoiseLeak: 0.25,
    hyperArmorPoiseCapRatio: 0.78,
    joltScaleNormal: 0.55,
    joltScaleHyperArmor: 0.28,
    joltScaleBreak: 1.0,
    interruptsActiveAttack: false
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
    poiseMax: 68,
    poiseRegenDelaySec: 1.6,
    poiseRegenRate: 24,
    poiseImmunitySec: 2.6,
    microStunSec: 0.32,
    hitClip: 'Hit_A',
    hitSpeed: 1.85,
    hyperArmorPoiseLeak: 0.20,
    hyperArmorPoiseCapRatio: 0.75,
    joltScaleNormal: 0.70,
    joltScaleHyperArmor: 0.40,
    joltScaleBreak: 1.0,
    interruptsActiveAttack: false
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
  flinchCooldownSec: 1.45,
  microStunSec: 0.24,
  cancelableAfterSec: 0.16,
  moveSpeedMult: 0.32,
  impulseSpeedMob: 3.4,
  impulseSpeedBoss: 4.8,
  clipName: 'Impact',
  clipDurationSec: 1.0,
  blendInSec: 0.028,
  blendOutSec: 0.070
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
    duration: 0.24,
    rollCancelAfter: 0.16,
    moveSpeedMult: 0.32,
    impulseMult: 1.0
  }),
  heavy: Object.freeze({
    damageLevel: 'heavy',
    duration: 0.38,
    rollCancelAfter: 0.24,
    moveSpeedMult: 0.22,
    impulseMult: 1.35
  }),
  knockdown: Object.freeze({
    damageLevel: 'knockdown',
    duration: 0.72,
    rollCancelAfter: 0.50,
    moveSpeedMult: 0.08,
    impulseMult: 1.75
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
  guardBreakDuration: 1.45,
  guardCounterWindowPc: 0.48,
  guardCounterWindowTouch: 0.56,
  parryStartupSec: 0.055,
  parryActivePc: 0.190,
  parryActiveTouch: 0.240,
  partialParryTolerance: 0.065,
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
  if (!(Number(enemy.poiseMax) > 0)) {
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
  if (enemy.isSoulsBoss && (THRONE_HYPER_ARMOR_PHASES.has(thronePhase) || !enemy.soulsAwake)) {
    return { active: true, reason: 'throne_sequence' };
  }

  const soulsSt = normState(enemy.soulsState);
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
    // Souls Boss Punish Windows (DS3 / Elden Ring):
    //   - short non-punishable recover (no soulsPunishWindow, e.g. after overhead_cleave) stays PROTECTED,
    //     so greedy players get countered instead of flinching the boss;
    //   - a real open punish window (soulsPunishWindow 'heavy' | 'light') has NO Hyper-Armor at all;
    //   - parry stun / riposte (stunTimer, parriedRiposteTimer) is never protected.
    if (
      enemy.isSoulsBoss &&
      soulsSt === 'recover' &&
      !enemy.soulsPunishWindow &&
      !((enemy.stunTimer || 0) > 0) &&
      !((enemy.parriedRiposteTimer || 0) > 0)
    ) {
      return { active: true, reason: 'boss_short_recover' };
    }
    if (enemy.isSoulsBoss && enemy.soulsPunishWindow && (soulsSt === 'recover' || soulsSt === 'hit_react')) {
      return { active: false, reason: `punish_window_${enemy.soulsPunishWindow}` };
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
  // Vulnerable to micro-poise during idle/stalk/walk/recover/early windup,
  // but committed strikes (and bull charges) keep brief follow-through Hyper-Armor.
  if (chargeSt === 'charging') {
    return { active: true, reason: 'mob_charging' };
  }
  if (soulsSt === 'attack' || soulsSt === 'attacking' || soulsSt === 'active' || soulsSt === 'strike') {
    return { active: true, reason: 'mob_committed_strike' };
  }
  if (soulsSt === 'windup' && (enemy.soulsTimer || 0) <= 0.18) {
    return { active: true, reason: 'mob_late_windup' };
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

  const dmg = Number(hitInfo.damage) || 0;
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
 *   - Hyper-Armor blocks interruption during active attacks/leaps/whirlwinds/roars/throne rise.
 *   - Anti-stunlock immunity cooldown (poiseImmunitySec) prevents click-spam stunlocking.
 */
export function evaluateEnemyHitReact(enemy, hitInfo = {}, opts = null) {
  if (opts?.isSoulslike === false || hitInfo?.isSoulslike === false) {
    return {
      triggered: false,
      shouldReact: false,
      reason: 'pve_mode_disabled',
      hyperArmored: false,
      joltScale: 0,
      clipName: null,
      clipSpeed: 1.0,
      microStunSec: 0,
      immunitySec: 0,
      interruptsAttack: false
    };
  }
  if (!enemy || enemy.hp <= 0) {
    return {
      triggered: false,
      shouldReact: false,
      reason: 'dead',
      hyperArmored: false,
      joltScale: 0,
      clipName: null,
      clipSpeed: 1.0,
      microStunSec: 0,
      immunitySec: 0,
      interruptsAttack: false
    };
  }

  const profile = ensureEnemyPoiseState(enemy, opts);

  if (hitInfo?.isDoT) {
    return {
      shouldReact: false,
      reason: 'dot',
      hyperArmored: false,
      joltScale: 0,
      clipName: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  const soulsSt = normState(enemy.soulsState);
  const bossSt = normState(enemy.bossSubState);

  // Never override a full Stance Break (Stagger_Kneel) with a standing Hit_React!
  if ((enemy.staggeredTimer || 0) > 0 || STAGGER_KNEEL_STATES.has(soulsSt) || STAGGER_KNEEL_STATES.has(bossSt)) {
    return {
      shouldReact: false,
      reason: 'already_staggered',
      hyperArmored: true,
      joltScale: profile.joltScaleHyperArmor,
      clipName: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  const poiseHitBase = computeHitPoiseDamage(hitInfo, enemy);
  // Open Souls Boss punish window: amplified poise intake (heavy ×1.40, light ×1.20) rewards correct punishes.
  const punishWindow = enemy.isSoulsBoss ? enemy.soulsPunishWindow || null : null;
  const punishPoiseMult = punishWindow === 'heavy' ? 1.4 : punishWindow === 'light' ? 1.2 : 1.0;
  const poiseHit = Math.round(poiseHitBase * punishPoiseMult);

  // 1) Hyper-Armor check (active boss/elite attack, leap, whirl, roar, throne rise, stagger_recover)
  const haState = getEnemyHyperArmorState(enemy, opts);
  if (haState.active && !hitInfo?.bypassHyperArmor) {
    // Allow a small capped poise chip during Hyper-Armor without ever breaking or interrupting
    // (main stagger / staggerMax accumulates separately and breaks through at 100%).
    if (poiseHit > 0 && profile.hyperArmorPoiseLeak > 0 && enemy.poiseImmunityTimer <= 0) {
      const cap = enemy.poiseMax * profile.hyperArmorPoiseCapRatio;
      if (enemy.poiseDamage < cap) {
        enemy.poiseDamage = Math.min(cap, enemy.poiseDamage + poiseHit * profile.hyperArmorPoiseLeak);
        enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);
      }
      enemy.poiseLastHitAge = 0;
    }
    return {
      shouldReact: false,
      reason: 'hyper_armor',
      hyperArmorReason: haState.reason,
      hyperArmored: true,
      joltScale: profile.joltScaleHyperArmor,
      clipName: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // 2) Anti-stunlock immunity cooldown check (prevents consecutive flinch chains!)
  if ((enemy.poiseMicroStunTimer || 0) > 0) {
    return {
      shouldReact: false,
      reason: 'already_flinching',
      hyperArmored: false,
      joltScale: profile.joltScaleHyperArmor,
      clipName: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  if ((enemy.poiseImmunityTimer || 0) > 0 && !hitInfo?.ignorePoiseImmunity) {
    return {
      shouldReact: false,
      reason: 'immunity_cooldown',
      hyperArmored: false,
      joltScale: profile.joltScaleNormal,
      clipName: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: enemy.poiseImmunityTimer,
      interruptsAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // 3) Outside Hyper-Armor & off immunity cooldown -> accumulate micro-poise
  enemy.poiseLastHitAge = 0;
  enemy.poiseDamage = Math.min(enemy.poiseMax, enemy.poiseDamage + poiseHit);
  enemy.poise = Math.max(0, enemy.poiseMax - enemy.poiseDamage);

  if (enemy.poiseDamage < enemy.poiseMax && !hitInfo?.forceMicroStun) {
    return {
      shouldReact: false,
      reason: 'poise_holding',
      hyperArmored: false,
      joltScale: profile.joltScaleNormal,
      clipName: null,
      clipSpeed: profile.hitSpeed,
      microStunSec: 0,
      immunitySec: 0,
      interruptsAttack: false,
      poise: enemy.poise,
      poiseMax: enemy.poiseMax,
      poiseDamage: enemy.poiseDamage,
      poiseRatio: enemy.poiseMax > 0 ? clamp01(enemy.poise / enemy.poiseMax) : 1
    };
  }

  // 4) Micro-poise threshold reached -> trigger single expressive Hit_React / Hit_React_Gut / Hit_A + arm immunity!
  enemy.poiseDamage = 0;
  enemy.poise = enemy.poiseMax;
  enemy.poiseBreakCount = (enemy.poiseBreakCount || 0) + 1;
  const useGutReact =
    Boolean(enemy.isSoulsBoss && profile.punishHitClip) &&
    (Boolean(punishWindow) || enemy.poiseBreakCount % 2 === 0);
  const chosenClip = useGutReact ? profile.punishHitClip : profile.hitClip;
  const chosenSpeed = useGutReact ? (profile.punishHitSpeed || 2.15) : profile.hitSpeed;
  const chosenMicroStunSec = useGutReact ? (profile.punishMicroStunSec || 0.42) : profile.microStunSec;
  enemy.poiseMicroStunTimer = chosenMicroStunSec;
  enemy.poiseImmunityTimer = profile.poiseImmunitySec;

  return {
    triggered: true,
    shouldReact: true,
    reason: 'poise_break',
    hyperArmored: false,
    joltScale: profile.joltScaleBreak,
    clipName: chosenClip,
    clipSpeed: chosenSpeed,
    microStunSec: chosenMicroStunSec,
    immunitySec: profile.poiseImmunitySec,
    interruptsAttack: Boolean(profile.interruptsActiveAttack),
    poise: enemy.poise,
    poiseMax: enemy.poiseMax,
    poiseDamage: 0,
    poiseRatio: 1
  };
}

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
  if ((enemy.poiseMicroStunTimer || 0) > 0) {
    enemy.poiseMicroStunTimer = Math.max(0, enemy.poiseMicroStunTimer - dt);
  }
  if ((enemy.poiseImmunityTimer || 0) > 0) {
    enemy.poiseImmunityTimer = Math.max(0, enemy.poiseImmunityTimer - dt);
  }
  if ((enemy.hyperArmorTimer || 0) > 0) {
    enemy.hyperArmorTimer = Math.max(0, enemy.hyperArmorTimer - dt);
  }
  enemy.poiseLastHitAge = (enemy.poiseLastHitAge || 0) + dt;
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
  entity.poiseMax = profile.poiseMax;
  entity.poiseDamage = 0;
  entity.poise = profile.poiseMax;
  entity.poiseLastHitAge = 0;
  entity.poiseMicroStunTimer = 0;
  entity.poiseBreakCount = 0;
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
    STANCE_DAMAGE_TABLE,
    STANCE_REGEN_RATE,
    PLAYER_HITSTUN_SPECS,
    SOULS_GUARD_CFG,
    getStanceRegenDelay,
    getPlayerHitstunSpec,
    computeBlockedStaminaCost,
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
