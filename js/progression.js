// Pure Soulslike Progression & Base Warrior Stat Calculator («Замок Пепла»)
// Zero PvE gold/shop/talents/daily-quests/mage/gunslinger bloat.

import { CLASSES, WEAPONS } from './config.js?v=20261124z89';

function createDefaultState() {
  return {
    version: 10,
    selectedClass: 'warrior',
    difficultyMode: 'normal',
    equippedWeapons: { warrior: 'club' },
    unlockedWeapons: ['club', 'spear', 'zweihander', 'axe', 'boss_hammer'],
    heroLevel: 1,
    heroXp: 0,
    heroXpNext: 95,
    gold: 0,
    riftGold: 0,
    maxUnlockedLevel: 26
  };
}

export function mergeCloudState(localState, cloudState) {
  const base = createDefaultState();
  const src = { ...base, ...(cloudState || {}), ...(localState || {}) };
  src.selectedClass = 'warrior';
  if (!['easy', 'normal', 'hard'].includes(src.difficultyMode)) {
    src.difficultyMode = 'normal';
  }
  const eq = src.equippedWeapons?.warrior;
  src.equippedWeapons = { warrior: eq && WEAPONS[eq] ? eq : 'club' };
  return src;
}

export function createProgressionStore() {
  let state = createDefaultState();

  function getState() {
    return state;
  }

  function loadState(raw) {
    if (!raw || typeof raw !== 'object') return state;
    state = mergeCloudState(raw, createDefaultState());
    return state;
  }

  function resetAllProgress() {
    state = createDefaultState();
    return state;
  }

  function selectClass() {
    state.selectedClass = 'warrior';
    return 'warrior';
  }

  function getEquippedWeaponId() {
    const wId = state.equippedWeapons?.warrior;
    return wId && WEAPONS[wId] ? wId : 'club';
  }

  function equipWeapon(_classId, weaponId) {
    if (!weaponId || !WEAPONS[weaponId]) return false;
    state.equippedWeapons.warrior = weaponId;
    return true;
  }

  function setDifficultyMode(mode) {
    state.difficultyMode = ['easy', 'normal', 'hard'].includes(mode) ? mode : 'normal';
    return state.difficultyMode;
  }

  function computeCombatStats(_classId = 'warrior', weaponId = null) {
    const cls = CLASSES.warrior;
    const resolvedWeaponId = weaponId && WEAPONS[weaponId] ? weaponId : getEquippedWeaponId();
    const wpn = WEAPONS[resolvedWeaponId] || WEAPONS.club;

    const moveSpeed = +((cls.moveSpeed || 4.4) * (wpn.moveSpeedMult || 1.0)).toFixed(3);
    const maxHp = Math.round(cls.maxHp || 145);

    return {
      maxHp,
      moveSpeed,
      damageBlock: cls.damageBlock || 0.26,
      blockChance: cls.blockChance || 0.22,
      dodgeChance: 0,
      damage: wpn.baseDamage || 15,
      cooldown: wpn.cooldown || 0.67,
      range: wpn.range || 1.25,
      arcAngle: wpn.arcAngle || Math.PI * 0.56,
      armorPierce: wpn.armorPierce || 0.15,
      splashRadius: wpn.splashRadius || 0,
      knockback: wpn.knockback || 7.4,
      pellets: 1,
      spread: 0,
      pierce: 0,
      projectileSpeed: 0,
      pickupRadius: 2.2,
      dashCooldownMult: 1.0,
      magSize: 0,
      reloadTime: 0,
      reloadPerShellTime: 0,
      reloadSpeedMult: 1.0,
      moveSpread: 0,
      focusSpread: 0,
      focusTime: 0,
      pierceDecay: null,
      clampToArenaBounds: false,
      usesMana: false,
      maxMana: 0,
      manaRegen: 0,
      manaCost: 0,
      mageElement: null,
      mageElementColor: wpn.color || 0xd97706,
      recoilKick: 0,
      isShotgun: false,
      critChance: 0.05,
      critMult: 1.80,
      critExplosionStacks: 0,
      dashFireTrailStacks: 0,
      shieldThornsStacks: 0,
      critChainStacks: 0,
      vampiricHarvestStacks: 0,
      rapidCadenceStacks: 0,
      frostShatterStacks: 0,
      executionerStacks: 0,
      mageTwinStacks: 0,
      vampiricKillsReq: 999,
      soulNovaStacks: 0,
      whirlwindStacks: 0,
      meteorStacks: 0,
      mineStacks: 0,
      orbitalBladeStacks: 0,
      arcaneWardStacks: 0,
      ricochetStacks: 0,
      explosiveShotStacks: 0,
      goldMult: 1.0,
      maxTargets: wpn.maxTargets || 1,
      twoHanded: Boolean(wpn.twoHanded),
      disarmChance: wpn.disarmChance || 0,
      disarmDuration: wpn.disarmDuration || 0,
      stunChance: wpn.stunChance || 0,
      stunDuration: wpn.stunDuration || 0
    };
  }

  return {
    getState,
    loadState,
    resetAllProgress,
    selectClass,
    getEquippedWeaponId,
    equipWeapon,
    setDifficultyMode,
    computeCombatStats,
    // Safe compatibility stubs for combat.js
    isWeaponUnlocked: (wId) => Boolean(WEAPONS[wId]),
    unlockWeapon: () => false,
    unlockBlueprint: () => false,
    addGold: () => 0,
    addHeroXp: () => ({ leveledUp: false }),
    addRiftGold: () => 0,
    getRiftGold: () => 0,
    recordDailyProgress: () => {},
    recordLevelStars: () => {},
    unlockNextLevel: () => {},
    rollLevelUpChoices: () => [],
    hasAttemptedBossHammerStage: () => false,
    markBossHammerAttempted: () => {}
  };
}
