// Meta-progression store, Per-Class Arsenal & Workshop upgrades, stat calculator, and Tarot blessing roller
import {
  CLASSES,
  WEAPONS,
  LEVELS,
  RUN_UPGRADES,
  WEAPON_MAX_LEVEL,
  MAGE_ELEMENTS,
  MAGE_ELEMENT_ORDER,
  MAGE_ELEMENT_UNLOCK_COSTS
} from './config.js?v=20261116m';

export const WEAPON_MAX_SHOP_LEVEL = WEAPON_MAX_LEVEL || 12;

export const HERO_UPGRADE_DEFS = {
  vitality: {
    key: 'vitality',
    nameRu: 'Живучесть',
    nameEn: 'Vitality',
    descRu: '+15 к макс. здоровью за уровень',
    descEn: '+15 Max HP per level',
    icon: '❤️',
    maxLevel: 8,
    baseCost: 40,
    costScale: 1.38
  },
  might: {
    key: 'might',
    nameRu: 'Мощь охотника',
    nameEn: 'Hunter Might',
    descRu: '+10% ко всему урону за уровень',
    descEn: '+10% all damage per level',
    icon: '⚔️',
    maxLevel: 8,
    baseCost: 45,
    costScale: 1.38
  },
  agility: {
    key: 'agility',
    nameRu: 'Стремительность',
    nameEn: 'Agility',
    descRu: '+4% к скорости бега, темпу атак и перезарядке',
    descEn: '+4% move speed, attack & reload haste per level',
    icon: '💨',
    maxLevel: 6,
    baseCost: 45,
    costScale: 1.42
  },
  ward: {
    key: 'ward',
    nameRu: 'Закалённый оберег',
    nameEn: 'Tempered Ward',
    descRu: '+3% к блоку урона за уровень',
    descEn: '+3% damage block per level',
    icon: '🛡️',
    maxLevel: 6,
    baseCost: 40,
    costScale: 1.42
  },
  mana_flow: {
    key: 'mana_flow',
    nameRu: 'Поток маны',
    nameEn: 'Mana Flow',
    descRu: '+20% к регенерации маны и +15 к запасу маны',
    descEn: '+20% Mana Regen & +15 Max Mana per level',
    icon: '💧',
    maxLevel: 8,
    baseCost: 40,
    costScale: 1.38
  }
};

function createDefaultHeroUpgradeBucket() {
  return {
    vitality: 0,
    might: 0,
    agility: 0,
    ward: 0,
    mana_flow: 0
  };
}

function createDefaultClassUpgrades() {
  const map = {};
  for (const clsId of Object.keys(CLASSES)) {
    map[clsId] = createDefaultHeroUpgradeBucket();
  }
  return map;
}

function createDefaultState(zeroGold = false) {
  const classUpgrades = createDefaultClassUpgrades();
  return {
    gold: zeroGold ? 0 : 0,
    selectedClass: 'warrior',
    maxUnlockedLevel: 1,
    mageStarterChosen: false,
    activeMageElement: 'fire',
    unlockedMageElements: {},
    unlockedWeapons: {
      club: true,
      pistol: true,
      spark_staff: true
    },
    equippedWeapons: {
      warrior: 'club',
      gunslinger: 'pistol',
      mage: 'spark_staff'
    },
    weaponShopLevels: {
      club: 1, cleaver: 1, flail: 1,
      pistol: 1, blunderbuss: 1, gatling: 1,
      spark_staff: 1, cinder_tome: 1, void_orb: 1
    },
    classUpgrades
  };
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function getPerkStacks(perks, perkId) {
  if (!perks) return 0;
  if (Array.isArray(perks)) {
    let count = 0;
    for (let i = 0; i < perks.length; i++) {
      if (perks[i] === perkId) count++;
    }
    return count;
  }
  const val = Number(perks[perkId]);
  return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}

export function createProgressionStore(initialSave = null) {
  let state = createDefaultState();

  function resolveClassId(classId) {
    return classId && CLASSES[classId] ? classId : state.selectedClass || 'warrior';
  }

  function cloneClassUpgrades() {
    const out = {};
    for (const clsId of Object.keys(CLASSES)) {
      out[clsId] = {
        ...createDefaultHeroUpgradeBucket(),
        ...(state.classUpgrades?.[clsId] || {})
      };
    }
    return out;
  }

  function cloneState() {
    const classUpgrades = cloneClassUpgrades();
    const activeCls = resolveClassId(state.selectedClass);
    return {
      gold: state.gold,
      selectedClass: activeCls,
      maxUnlockedLevel: state.maxUnlockedLevel,
      mageStarterChosen: Boolean(state.mageStarterChosen),
      activeMageElement: state.activeMageElement || 'fire',
      unlockedMageElements: { ...(state.unlockedMageElements || {}) },
      unlockedWeapons: { ...state.unlockedWeapons },
      equippedWeapons: { ...state.equippedWeapons },
      weaponShopLevels: { ...state.weaponShopLevels },
      classUpgrades,
      // Active class mirror for UI helpers reading state.heroUpgrades
      heroUpgrades: { ...classUpgrades[activeCls] }
    };
  }

  function loadState(savedObj) {
    const base = createDefaultState();
    if (!savedObj || typeof savedObj !== 'object') {
      state = base;
      return cloneState();
    }

    base.gold = clampInt(savedObj.gold, 0, 99999999, base.gold);
    if (savedObj.selectedClass && CLASSES[savedObj.selectedClass]) {
      base.selectedClass = savedObj.selectedClass;
    }
    // Shared 25-level campaign unlock across all classes
    base.maxUnlockedLevel = clampInt(savedObj.maxUnlockedLevel, 1, LEVELS.length, 1);

    if (savedObj.unlockedMageElements && typeof savedObj.unlockedMageElements === 'object') {
      for (const elKey of MAGE_ELEMENT_ORDER) {
        if (savedObj.unlockedMageElements[elKey]) {
          base.unlockedMageElements[elKey] = true;
        }
      }
    }
    const unlockedElCount = Object.keys(base.unlockedMageElements).filter((k) => base.unlockedMageElements[k]).length;
    base.mageStarterChosen = Boolean(savedObj.mageStarterChosen || unlockedElCount > 0);
    if (savedObj.activeMageElement && MAGE_ELEMENTS[savedObj.activeMageElement]) {
      base.activeMageElement = savedObj.activeMageElement;
    }
    if (base.mageStarterChosen && !base.unlockedMageElements[base.activeMageElement]) {
      const firstUnlocked = MAGE_ELEMENT_ORDER.find((k) => base.unlockedMageElements[k]) || 'fire';
      base.unlockedMageElements[firstUnlocked] = true;
      base.activeMageElement = firstUnlocked;
    }

    if (savedObj.unlockedWeapons && typeof savedObj.unlockedWeapons === 'object') {
      for (const wpnId of Object.keys(WEAPONS)) {
        if (savedObj.unlockedWeapons[wpnId]) {
          base.unlockedWeapons[wpnId] = true;
        }
      }
    }
    // Starter weapons are always unlocked
    base.unlockedWeapons.club = true;
    base.unlockedWeapons.pistol = true;
    base.unlockedWeapons.spark_staff = true;

    if (savedObj.weaponShopLevels && typeof savedObj.weaponShopLevels === 'object') {
      for (const wpnId of Object.keys(WEAPONS)) {
        base.weaponShopLevels[wpnId] = clampInt(
          savedObj.weaponShopLevels[wpnId],
          1,
          WEAPON_MAX_SHOP_LEVEL,
          1
        );
      }
    }

    // Per-class Workshop upgrades (with seamless legacy heroUpgrades migration onto selectedClass)
    if (savedObj.classUpgrades && typeof savedObj.classUpgrades === 'object') {
      for (const clsId of Object.keys(CLASSES)) {
        const srcBucket = savedObj.classUpgrades[clsId];
        if (srcBucket && typeof srcBucket === 'object') {
          for (const [key, def] of Object.entries(HERO_UPGRADE_DEFS)) {
            base.classUpgrades[clsId][key] = clampInt(srcBucket[key], 0, def.maxLevel, 0);
          }
        }
      }
    } else if (savedObj.heroUpgrades && typeof savedObj.heroUpgrades === 'object') {
      const targetCls = base.selectedClass;
      for (const [key, def] of Object.entries(HERO_UPGRADE_DEFS)) {
        base.classUpgrades[targetCls][key] = clampInt(
          savedObj.heroUpgrades[key],
          0,
          def.maxLevel,
          0
        );
      }
    }

    if (savedObj.equippedWeapons && typeof savedObj.equippedWeapons === 'object') {
      for (const [clsId, clsDef] of Object.entries(CLASSES)) {
        const candidate = savedObj.equippedWeapons[clsId];
        if (
          candidate &&
          WEAPONS[candidate] &&
          WEAPONS[candidate].classId === clsId &&
          base.unlockedWeapons[candidate]
        ) {
          base.equippedWeapons[clsId] = candidate;
        } else {
          base.equippedWeapons[clsId] = clsDef.starterWeapon;
        }
      }
    }

    state = base;
    return cloneState();
  }

  function getState() {
    return cloneState();
  }

  function addGold(amount) {
    const delta = Number(amount);
    if (!Number.isFinite(delta)) return state.gold;
    state.gold = Math.max(0, Math.round(state.gold + delta));
    return state.gold;
  }

  function selectClass(classId) {
    if (!CLASSES[classId]) return false;
    state.selectedClass = classId;
    return true;
  }

  function isWeaponUnlocked(weaponId) {
    return Boolean(state.unlockedWeapons[weaponId]);
  }

  function unlockWeapon(weaponId) {
    const wpn = WEAPONS[weaponId];
    if (!wpn) return false;
    const newlyUnlocked = !state.unlockedWeapons[weaponId];
    state.unlockedWeapons[weaponId] = true;
    if (wpn.classId && CLASSES[wpn.classId]) {
      state.equippedWeapons[wpn.classId] = weaponId;
    }
    return newlyUnlocked;
  }

  function getEquippedWeaponId(classId) {
    const clsId = resolveClassId(classId);
    const equipped = state.equippedWeapons[clsId];
    if (equipped && WEAPONS[equipped] && state.unlockedWeapons[equipped]) {
      return equipped;
    }
    return CLASSES[clsId]?.starterWeapon || 'club';
  }

  function equipWeapon(classId, weaponId) {
    // Support both equipWeapon(classId, weaponId) and single-arg equipWeapon(weaponId)
    let resolvedClassId = classId;
    let resolvedWeaponId = weaponId;
    if (resolvedWeaponId === undefined && WEAPONS[resolvedClassId]) {
      resolvedWeaponId = resolvedClassId;
      resolvedClassId = WEAPONS[resolvedWeaponId].classId;
    }
    const wpn = WEAPONS[resolvedWeaponId];
    if (!wpn || !CLASSES[resolvedClassId] || wpn.classId !== resolvedClassId) {
      return false;
    }
    if (!isWeaponUnlocked(resolvedWeaponId)) {
      return false;
    }
    state.equippedWeapons[resolvedClassId] = resolvedWeaponId;
    return true;
  }

  function getWeaponShopLevel(weaponId) {
    if (!WEAPONS[weaponId]) return 1;
    return state.weaponShopLevels[weaponId] || 1;
  }

  function getWeaponUpgradeCost(weaponId) {
    const wpn = WEAPONS[weaponId];
    if (!wpn) return null;
    const currentLevel = getWeaponShopLevel(weaponId);
    if (currentLevel >= WEAPON_MAX_SHOP_LEVEL) return null;
    const baseCost = wpn.upgradeBaseCost || 45;
    return Math.round(baseCost * Math.pow(1.36, currentLevel - 1));
  }

  function upgradeWeaponInShop(weaponId) {
    const wpn = WEAPONS[weaponId];
    if (!wpn || !isWeaponUnlocked(weaponId)) return false;
    const currentLevel = getWeaponShopLevel(weaponId);
    if (currentLevel >= WEAPON_MAX_SHOP_LEVEL) return false;
    const cost = getWeaponUpgradeCost(weaponId);
    if (cost === null || state.gold < cost) return false;
    state.gold -= cost;
    state.weaponShopLevels[weaponId] = currentLevel + 1;
    return true;
  }

  function resolveHeroKey(key) {
    if (key === 'power') return 'might';
    if (key === 'hp' || key === 'health') return 'vitality';
    if (key === 'speed') return 'agility';
    if (key === 'block' || key === 'armor') return 'ward';
    return key;
  }

  function getHeroUpgradeLevel(key, classId = state.selectedClass) {
    const k = resolveHeroKey(key);
    if (!HERO_UPGRADE_DEFS[k]) return 0;
    const clsId = resolveClassId(classId);
    return state.classUpgrades[clsId]?.[k] || 0;
  }

  function getHeroUpgradeCost(key, classId = state.selectedClass) {
    const k = resolveHeroKey(key);
    const def = HERO_UPGRADE_DEFS[k];
    if (!def) return null;
    const currentLevel = getHeroUpgradeLevel(k, classId);
    if (currentLevel >= def.maxLevel) return null;
    return Math.round(def.baseCost * Math.pow(def.costScale, currentLevel));
  }

  function buyHeroUpgrade(key, classId = state.selectedClass) {
    const k = resolveHeroKey(key);
    const def = HERO_UPGRADE_DEFS[k];
    if (!def) return false;
    const clsId = resolveClassId(classId);
    const currentLevel = getHeroUpgradeLevel(k, clsId);
    if (currentLevel >= def.maxLevel) return false;
    const cost = getHeroUpgradeCost(k, clsId);
    if (cost === null || state.gold < cost) return false;
    state.gold -= cost;
    if (!state.classUpgrades[clsId]) {
      state.classUpgrades[clsId] = createDefaultHeroUpgradeBucket();
    }
    state.classUpgrades[clsId][k] = currentLevel + 1;
    return true;
  }

  function unlockNextLevel(clearedLevel) {
    const baseLevel = Number.isFinite(Number(clearedLevel))
      ? Math.floor(Number(clearedLevel))
      : state.maxUnlockedLevel;
    const targetLevel = Math.min(LEVELS.length, Math.max(1, baseLevel + 1));
    if (targetLevel > state.maxUnlockedLevel) {
      state.maxUnlockedLevel = targetLevel;
      return true;
    }
    return false;
  }

  function computeCombatStats(classId, weaponId, runModifiers = {}) {
    const cls = CLASSES[classId] || CLASSES[state.selectedClass] || CLASSES.warrior;
    const resolvedWeaponId =
      weaponId && WEAPONS[weaponId] ? weaponId : getEquippedWeaponId(cls.id);
    const wpn = WEAPONS[resolvedWeaponId] || WEAPONS[cls.starterWeapon] || WEAPONS.club;

    const mods = runModifiers || {};
    const weaponRunLevel = Math.max(1, Math.floor(Number(mods.weaponRunLevel) || 1));
    const perks = mods.perks || {};

    // Per-weapon shop levels (1..12) & strictly per-class Workshop upgrades
    const shopLevel = getWeaponShopLevel(wpn.id);
    const shopLevelsAbove = Math.max(0, shopLevel - 1);
    const runLevelsAbove = Math.max(0, weaponRunLevel - 1);

    const vitalityLvl = getHeroUpgradeLevel('vitality', cls.id);
    const mightLvl = getHeroUpgradeLevel('might', cls.id);
    const agilityLvl = getHeroUpgradeLevel('agility', cls.id);
    const wardLvl = getHeroUpgradeLevel('ward', cls.id);
    const manaFlowLvl = getHeroUpgradeLevel('mana_flow', cls.id);

    // Class-specific & dark relic in-run blessing stacks
    const mageArcaneStacks = getPerkStacks(perks, 'mage_arcane_surge');
    const mageTwinStacks = getPerkStacks(perks, 'mage_twin_cast');
    const mageCatalystStacks = getPerkStacks(perks, 'mage_elem_catalyst');
    const mageMeteorStacks = getPerkStacks(perks, 'mage_meteor_shower');
    const mageWardStacks = getPerkStacks(perks, 'mage_arcane_ward');
    const mageManaFontStacks = getPerkStacks(perks, 'mage_mana_font');

    const gunHeavyStacks = getPerkStacks(perks, 'gun_heavy_buckshot');
    const gunRicochetStacks = getPerkStacks(perks, 'gun_ricochet');
    const gunExplosiveStacks = getPerkStacks(perks, 'gun_explosive_slugs');
    const gunReloadStacks = getPerkStacks(perks, 'gun_tactical_reload');
    const ammoPouchStacks = getPerkStacks(perks, 'ammo_pouch');
    const gunMineStacks = getPerkStacks(perks, 'gun_shrapnel_mine');

    const warOrbitStacks = getPerkStacks(perks, 'war_orbit_blades');
    const warSeismicStacks = getPerkStacks(perks, 'war_seismic_slam');
    const warThornsStacks = getPerkStacks(perks, 'war_shield_thorns');
    const warWhirlwindStacks = getPerkStacks(perks, 'war_whirlwind');
    const warBloodStacks = getPerkStacks(perks, 'war_blood_cleave');
    const warBannerStacks = getPerkStacks(perks, 'war_iron_banner');

    const critFangStacks = getPerkStacks(perks, 'crit_fang');
    const greedStacks = getPerkStacks(perks, 'greed_contract');

    // Essential shop weapon scaling (+24% damage & +3.5% reload/attack cadence per shop level)
    const shopDamageMult = 1 + shopLevelsAbove * 0.24;
    const shopReloadMult = 1 + shopLevelsAbove * 0.035;
    const shopSpeedMult = 1 + shopLevelsAbove * 0.03;

    // Meaningful in-run weapon/magic rank scaling (+16% damage per run weapon level)
    const runWeaponDamageMult = 1 + runLevelsAbove * 0.16;
    const runWeaponAreaMult = 1 + runLevelsAbove * 0.08;

    const heroDamageMult = 1 + mightLvl * 0.10;
    const heroAgilityMult = 1 + agilityLvl * 0.04;

    const perkDamageMult =
      1 +
      mageArcaneStacks * 0.20 +
      gunHeavyStacks * 0.14;
    const perkHasteMult = 1 + (warWhirlwindStacks > 0 ? warWhirlwindStacks * 0.06 : 0);
    const perkReloadMult = 1 + gunReloadStacks * 0.28;
    const perkMoveMult = 1 + greedStacks * 0.07;

    const maxHp = Math.round(cls.maxHp + vitalityLvl * 15 + warBannerStacks * 24);
    const moveSpeed = +(cls.moveSpeed * heroAgilityMult * perkMoveMult).toFixed(3);
    const damageBlock = Math.min(
      0.78,
      +(cls.damageBlock + wardLvl * 0.03 + warThornsStacks * 0.07).toFixed(4)
    );
    const blockChance = Math.min(0.65, (cls.blockChance || 0) + warThornsStacks * 0.06);
    const dodgeChance = 0;

    const damage = Math.max(
      1,
      Math.round(
        wpn.baseDamage *
          shopDamageMult *
          runWeaponDamageMult *
          heroDamageMult *
          perkDamageMult
      )
    );

    const totalAttackHaste = shopSpeedMult * heroAgilityMult * perkHasteMult;
    const cooldown = Math.max(0.06, +(wpn.cooldown / totalAttackHaste).toFixed(4));

    const meleeReachMult = wpn.type === 'melee' ? 1 + warWhirlwindStacks * 0.12 : 1.0;
    const range = +(wpn.range * runWeaponAreaMult * meleeReachMult).toFixed(3);
    const arcAngle = wpn.arcAngle
      ? Math.min(
          Math.PI * 1.96,
          +(wpn.arcAngle * (1 + runLevelsAbove * 0.06 + warWhirlwindStacks * 0.25)).toFixed(4)
        )
      : 0;

    const baseSplash = wpn.splashRadius || 0;
    const splashRadius =
      baseSplash > 0
        ? +(baseSplash * runWeaponAreaMult * (1 + mageArcaneStacks * 0.15)).toFixed(3)
        : 0;

    const knockback = +(
      (wpn.knockback || 0) *
      (1 + runLevelsAbove * 0.05)
    ).toFixed(3);

    const pellets = (wpn.pellets || 1) + (wpn.isShotgun ? gunHeavyStacks * 2 : 0);
    const spread = (wpn.spread ?? 0) * (wpn.isShotgun && gunHeavyStacks > 0 ? 1.08 : 1.0);
    const pierce = wpn.pierce || 1;
    const projectileSpeed = wpn.projectileSpeed ? +wpn.projectileSpeed.toFixed(2) : 0;
    const pickupRadius = +(3.8 * perkMoveMult).toFixed(3);

    // Magazine & Reload metrics (Gunslinger) + Continuous Mana Pool & Regen (Mage)
    const usesMana = cls.id === 'mage' || wpn.type === 'magic';
    const mageElement = usesMana
      ? (MAGE_ELEMENTS[mods.mageElement || state.activeMageElement] ? (mods.mageElement || state.activeMageElement) : 'fire')
      : null;
    const elemDef = mageElement ? MAGE_ELEMENTS[mageElement] : null;
    const baseMag = usesMana ? 0 : (wpn.magSize || 0);
    const magSize = baseMag > 0 ? baseMag + ammoPouchStacks * 2 : 0;
    const reloadSpeedMult = +(shopReloadMult * heroAgilityMult * perkReloadMult).toFixed(4);
    const reloadTime =
      baseMag > 0 && wpn.reloadTime
        ? Math.max(0.24, +(wpn.reloadTime / reloadSpeedMult).toFixed(3))
        : 0;

    const maxMana = usesMana
      ? Math.round((cls.maxMana || 120) + manaFlowLvl * 15 + mageManaFontStacks * 18)
      : 0;
    const manaRegen = usesMana
      ? +(
          (cls.manaRegen || 9.5) *
          (1 + manaFlowLvl * 0.20 + mageManaFontStacks * 0.15 + shopLevelsAbove * 0.03)
        ).toFixed(2)
      : 0;
    const manaCostMult = Math.max(0.38, 1 - mageManaFontStacks * 0.18);
    const manaCost = usesMana ? +((wpn.manaCost || 8) * manaCostMult).toFixed(2) : 0;

    // Crit & Class Blessing parameters
    const critChance = Math.min(0.85, +(0.05 + critFangStacks * 0.15).toFixed(4));
    const critMult = 1.80;
    const goldMult = +(1 + greedStacks * 0.35).toFixed(3);

    return {
      maxHp,
      moveSpeed: +(moveSpeed * (cls.id === 'mage' && state.activeMageElement === 'air' ? 1.08 : 1.0)).toFixed(3),
      damageBlock,
      blockChance,
      dodgeChance,
      damage,
      cooldown,
      range,
      arcAngle,
      splashRadius: mageElement === 'water' ? +(splashRadius * 1.25).toFixed(3) : splashRadius,
      knockback: mageElement === 'air' ? +(knockback * 2.2).toFixed(3) : knockback,
      pellets,
      spread,
      pierce,
      projectileSpeed: mageElement === 'lightning' ? +(projectileSpeed * 1.32).toFixed(2) : projectileSpeed,
      pickupRadius,
      magSize,
      reloadTime,
      reloadSpeedMult,
      usesMana,
      maxMana,
      manaRegen,
      manaCost,
      mageElement,
      mageElementColor: elemDef ? elemDef.color : wpn.color,
      recoilKick: wpn.recoilKick || 0,
      isShotgun: Boolean(wpn.isShotgun),
      critChance,
      critMult,
      critExplosionStacks: critFangStacks,
      mageTwinStacks,
      mageCatalystStacks,
      mageMeteorStacks,
      mageWardStacks,
      mageManaFontStacks,
      gunRicochetStacks,
      gunExplosiveStacks,
      gunReloadStacks,
      ammoPouchStacks,
      gunMineStacks,
      warOrbitStacks,
      warSeismicStacks,
      warThornsStacks,
      warWhirlwindStacks,
      warBloodStacks,
      warBannerStacks,
      goldMult
    };
  }

  function rollLevelUpChoices(currentWeaponDef, weaponRunLevel = 1, currentPerks = {}, soulLevel = 2) {
    const resolvedWeapon =
      typeof currentWeaponDef === 'string'
        ? WEAPONS[currentWeaponDef] || WEAPONS.club
        : currentWeaponDef || WEAPONS.club;

    const activeClsId = resolvedWeapon.classId || state.selectedClass || 'warrior';
    const curWpnLvl = Math.max(1, Math.floor(Number(weaponRunLevel) || 1));
    const nextWpnRank = curWpnLvl + 1;
    const isMageWpn = activeClsId === 'mage' || resolvedWeapon.type === 'magic';
    const isGunWpn = activeClsId === 'gunslinger' || resolvedWeapon.type === 'ranged';

    const weaponChoice = {
      id: 'weapon_level_up',
      weaponId: resolvedWeapon.id,
      weaponType: resolvedWeapon.type,
      weaponNameRu: resolvedWeapon.nameRu,
      nextRank: nextWpnRank,
      maxStacks: 5,
      soulLevel,
      nameRu: isMageWpn
        ? `Чары: ${resolvedWeapon.nameRu}`
        : isGunWpn
          ? `Калибр: ${resolvedWeapon.nameRu}`
          : `Закалка: ${resolvedWeapon.nameRu}`,
      statBadgeRu: isMageWpn
        ? '+16% МАГИЧЕСКИЙ УРОН • +8% ОБЛАСТЬ ЧАР'
        : isGunWpn
          ? '+16% УРОН ВЫСТРЕЛА • +8% ДАЛЬНОСТЬ'
          : '+16% РУБЯЩИЙ УРОН • +8% РАЗМАХ КЛИНКА',
      categoryRu: isMageWpn
        ? 'ВОЗВЫШЕНИЕ ПОСОХА'
        : isGunWpn
          ? 'ОРУЖЕЙНОЕ МАСТЕРСТВО'
          : 'МАСТЕРСТВО КЛИНКА',
      theme: 'gold',
      descRu: isMageWpn
        ? `Усиливает магический поток посоха до ${nextWpnRank}-го ранга: +16% к магическому урону и шире радиус взрывов стихии.`
        : isGunWpn
          ? `Растачивает ствол до ${nextWpnRank}-го ранга: +16% к урону каждой дробины и дальше прицельный бой.`
          : `Перековывает клинок до ${nextWpnRank}-го ранга: +16% к рубящему урону и шире дуга рассечения.`,
      icon: isMageWpn ? '🔮' : isGunWpn ? '🔫' : '⚔️',
      isWeaponLevelUp: true
    };

    // Strictly filter by class so Mage, Gunslinger & Warrior each get their own distinct upgrades!
    const classPerks = [];
    const sharedPerks = [];
    for (const perk of RUN_UPGRADES) {
      if (perk.onlyClass && perk.onlyClass !== activeClsId) continue;
      const maxS = perk.maxStacks || 3;
      const curS = getPerkStacks(currentPerks, perk.id);
      if (curS >= maxS) continue;
      if (perk.onlyClass === activeClsId) {
        classPerks.push(perk);
      } else {
        sharedPerks.push(perk);
      }
    }

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    };
    shuffle(classPerks);
    shuffle(sharedPerks);

    // Guarantee at least 2 class-exclusive blessings when available so every class feels deeply unique!
    const availablePerks = [];
    while (classPerks.length > 0 && availablePerks.length < 2) {
      availablePerks.push(classPerks.shift());
    }
    const restPool = shuffle([...classPerks, ...sharedPerks]);
    availablePerks.push(...restPool);

    const choices = [];
    const canOfferWeaponRank = curWpnLvl < 5;
    const includeWeaponRank =
      canOfferWeaponRank && (Math.random() < 0.28 || availablePerks.length < 3);

    if (includeWeaponRank) {
      choices.push(weaponChoice);
    }

    const neededPerks = 3 - choices.length;
    for (let i = 0; i < neededPerks && i < availablePerks.length; i++) {
      const perk = availablePerks[i];
      const curStacks = getPerkStacks(currentPerks, perk.id);
      const maxStacks = perk.maxStacks || 3;
      choices.push({
        id: perk.id,
        nextRank: curStacks + 1,
        maxStacks,
        soulLevel,
        nameRu: perk.nameRu,
        categoryRu: perk.categoryRu || 'БЛАГОСЛОВЕНИЕ',
        statBadgeRu: perk.statBadgeRu || '',
        theme: perk.theme || 'amber',
        descRu: perk.descRu,
        icon: perk.icon,
        isWeaponLevelUp: false
      });
    }

    if (choices.length === 0) {
      choices.push(weaponChoice);
    }

    return choices;
  }

  function getMageElementUnlockCost() {
    const count = MAGE_ELEMENT_ORDER.filter((k) => state.unlockedMageElements?.[k]).length;
    if (!state.mageStarterChosen || count === 0) return 0;
    if (count >= MAGE_ELEMENT_ORDER.length) return null;
    return MAGE_ELEMENT_UNLOCK_COSTS[count] ?? 360;
  }

  function getMageElementState() {
    const unlocked = {};
    for (const k of MAGE_ELEMENT_ORDER) {
      unlocked[k] = Boolean(state.unlockedMageElements?.[k]);
    }
    return {
      starterChosen: Boolean(state.mageStarterChosen),
      activeElement: state.activeMageElement || 'fire',
      unlockedElements: unlocked,
      nextUnlockCost: getMageElementUnlockCost()
    };
  }

  function selectOrUnlockMageElement(elemId) {
    if (!MAGE_ELEMENTS[elemId]) return { ok: false, reason: 'invalid' };
    if (!state.unlockedMageElements) state.unlockedMageElements = {};

    // Already unlocked -> switch immediately!
    if (state.unlockedMageElements[elemId]) {
      state.activeMageElement = elemId;
      state.mageStarterChosen = true;
      return { ok: true, action: 'equipped', element: elemId };
    }

    const cost = getMageElementUnlockCost();
    if (cost === 0) {
      // First starter element is FREE!
      state.unlockedMageElements[elemId] = true;
      state.activeMageElement = elemId;
      state.mageStarterChosen = true;
      return { ok: true, action: 'starter_unlocked', element: elemId };
    }

    if (cost !== null && state.gold >= cost) {
      state.gold -= cost;
      state.unlockedMageElements[elemId] = true;
      state.activeMageElement = elemId;
      state.mageStarterChosen = true;
      return { ok: true, action: 'purchased', element: elemId, cost };
    }

    return { ok: false, reason: 'gold', cost };
  }

  function resetAllProgress() {
    state = createDefaultState(true);
    return cloneState();
  }

  if (initialSave) {
    loadState(initialSave);
  }

  return {
    getState,
    loadState,
    resetAllProgress,
    addGold,
    selectClass,
    getMageElementState,
    getMageElementUnlockCost,
    selectOrUnlockMageElement,
    isWeaponUnlocked,
    unlockWeapon,
    getEquippedWeaponId,
    equipWeapon,
    getWeaponShopLevel,
    getWeaponUpgradeCost,
    upgradeWeaponInShop,
    getHeroUpgradeLevel,
    getHeroUpgradeCost,
    buyHeroUpgrade,
    unlockNextLevel,
    computeCombatStats,
    rollLevelUpChoices,
    getHeroUpgradeDefs: () => HERO_UPGRADE_DEFS,
    getWeaponMaxShopLevel: () => WEAPON_MAX_SHOP_LEVEL
  };
}
