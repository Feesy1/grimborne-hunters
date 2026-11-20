// UI Metadata Constants, Formatters & Progression / Shop Resolvers
// Extracted from js/ui.js (Wave 1 modularization) — pure helpers, zero circular deps.

import { WEAPON_MAX_LEVEL } from '../config.js?v=20261120z35';

export const CLASS_ORDER = ['warrior', 'gunslinger', 'mage'];

export const CLASS_META = {
  warrior: {
    bg: 'linear-gradient(145deg, #7f1d1d 0%, #2a0810 100%)',
    accent: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.42)',
    border: '#f87171',
    roleShortRu: 'Ближний бой • Стальной щит и клинок',
    roleShortEn: 'Melee • Iron Shield & Broadsword',
    loreShortRu: 'Неудержимый латник со щитом: держит удар в гуще орды и рубит нежить широкими дугами.',
    loreShortEn: 'Armored vanguard blocking heavy blows and cleaving undead hordes in wide arcs.'
  },
  gunslinger: {
    bg: 'linear-gradient(145deg, #1e3a5f 0%, #5c3415 100%)',
    accent: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.42)',
    border: '#fbbf24',
    roleShortRu: 'Дробовик • Мощная картечь и отдача',
    roleShortEn: 'Shotgunner • Heavy Buckshot & Reload',
    loreShortRu: 'Ловкий охотник с тяжёлым ружьём: рвёт дистанцию, бьёт веером картечи в упор и перезаряжает на бегу.',
    loreShortEn: 'Swift hooded hunter blasting devastating close-range buckshot volleys on the move.'
  },
  mage: {
    bg: 'linear-gradient(145deg, #581c87 0%, #17153b 100%)',
    accent: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.44)',
    border: '#c084fc',
    roleShortRu: 'Тёмные чары • Взрывные кометы',
    roleShortEn: 'Arcane • Explosive Comets & AoE',
    loreShortRu: 'Заклинатель кристального посоха: выжигает скопления чудовищ разрывными кометами и рунами.',
    loreShortEn: 'Arcane spellcaster incinerating monster packs with explosive astral comets.'
  }
};

export const ACT_DEFS = [
  { act: 1, roman: 'I', titleRu: 'Акт I: Погост (1–5)', titleEn: 'Act I: Graveyard (1–5)', shortRu: 'Акт I' },
  { act: 2, roman: 'II', titleRu: 'Акт II: Лагерь (6–10)', titleEn: 'Act II: Camp (6–10)', shortRu: 'Акт II' },
  { act: 3, roman: 'III', titleRu: 'Акт III: Чаща (11–15)', titleEn: 'Act III: Thicket (11–15)', shortRu: 'Акт III' },
  { act: 4, roman: 'IV', titleRu: 'Акт IV: Катакомбы (16–20)', titleEn: 'Act IV: Catacombs (16–20)', shortRu: 'Акт IV' },
  { act: 5, roman: 'V', titleRu: 'Акт V: Престол (21–25)', titleEn: 'Act V: Throne (21–25)', shortRu: 'Акт V' }
];

export const TIER_ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
export const RANK_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const DEFAULT_MASTERY_DEFS = [
  {
    keyCandidates: ['vitality', 'hp', 'maxHp', 'health'],
    defaultKey: 'vitality',
    runeType: 'hp',
    nameRu: 'Живучесть',
    nameEn: 'Vitality',
    bonusRu: '+15 к макс. здоровью за ур.',
    bonusEn: '+15 Max HP / lv',
    baseCost: 40,
    costScale: 1.38,
    maxLevel: 8
  },
  {
    keyCandidates: ['might', 'power', 'damage', 'attack'],
    defaultKey: 'might',
    runeType: 'might',
    nameRu: 'Мощь охотника',
    nameEn: 'Hunter Might',
    bonusRu: '+10% ко всему урону за ур.',
    bonusEn: '+10% Damage / lv',
    baseCost: 45,
    costScale: 1.38,
    maxLevel: 8
  },
  {
    keyCandidates: ['agility', 'speed', 'moveSpeed', 'haste'],
    defaultKey: 'agility',
    runeType: 'spd',
    nameRu: 'Стремительность',
    nameEn: 'Agility',
    bonusRu: '+4% к скорости бега и темпу атак',
    bonusEn: '+4% Speed & Haste / lv',
    baseCost: 45,
    costScale: 1.42,
    maxLevel: 6
  },
  {
    keyCandidates: ['ward', 'block', 'armor', 'damageBlock', 'defense'],
    defaultKey: 'ward',
    runeType: 'blk',
    nameRu: 'Закалённый оберег',
    nameEn: 'Tempered Ward',
    bonusRu: '+3% к блоку урона за ур.',
    bonusEn: '+3% Block / lv',
    baseCost: 40,
    costScale: 1.42,
    maxLevel: 6
  },
  {
    keyCandidates: ['mana_flow', 'manaRegen', 'mana'],
    defaultKey: 'mana_flow',
    onlyClass: 'mage',
    runeType: 'blk',
    nameRu: 'Поток маны',
    nameEn: 'Mana Flow',
    bonusRu: '+20% к регену маны и +15 к мане за ур.',
    bonusEn: '+20% Mana Regen & +15 Mana / lv',
    baseCost: 40,
    costScale: 1.38,
    maxLevel: 8
  }
];

export function formatTimeMMSS(seconds) {
  const s = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '' && text !== null && text !== undefined) node.textContent = text;
  return node;
}

export function hexNumToCss(hexNum, fallback = '#e5b85c') {
  if (typeof hexNum !== 'number' || !Number.isFinite(hexNum)) return fallback;
  return `#${Math.max(0, Math.floor(hexNum)).toString(16).padStart(6, '0')}`;
}

export function resolveMaxWeaponShopLevel(storeRef) {
  const fromStore = typeof storeRef?.getWeaponMaxShopLevel === 'function'
    ? Number(storeRef.getWeaponMaxShopLevel())
    : 0;
  return Math.max(WEAPON_MAX_LEVEL || 12, fromStore || 0);
}

export function resolveWeaponUnlocked(state, storeRef, wDef) {
  if (!wDef) return false;
  if (wDef.tier === 1 || wDef.unlockLevel <= 1) return true;
  if (typeof storeRef?.isWeaponUnlocked === 'function') {
    return Boolean(storeRef.isWeaponUnlocked(wDef.id));
  }
  if (!state) return false;
  const u = state.unlockedWeapons;
  if (Array.isArray(u)) return u.includes(wDef.id);
  if (u instanceof Set) return u.has(wDef.id);
  if (u && typeof u === 'object' && u[wDef.id]) return true;
  if (state.weapons?.[wDef.id]?.unlocked) return true;
  return false;
}

export function resolveWeaponShopLevel(state, storeRef, wId, maxLvl = 12) {
  if (typeof storeRef?.getWeaponShopLevel === 'function') {
    const lvl = Number(storeRef.getWeaponShopLevel(wId));
    if (Number.isFinite(lvl) && lvl >= 1) return Math.min(maxLvl, Math.floor(lvl));
  }
  const raw =
    state?.weaponShopLevels?.[wId] ??
    state?.weaponLevels?.[wId] ??
    state?.shopWeaponLevels?.[wId] ??
    state?.weapons?.[wId]?.shopLevel ??
    state?.weapons?.[wId]?.level ??
    1;
  return Math.max(1, Math.min(maxLvl, Number(raw) || 1));
}

export function resolveWeaponUpgradeCost(state, storeRef, callbacks, wDef, shopLevel, maxLvl = 12) {
  if (shopLevel >= maxLvl) return null;
  if (typeof storeRef?.getWeaponUpgradeCost === 'function') {
    const c = storeRef.getWeaponUpgradeCost(wDef.id, shopLevel);
    if (c === null || typeof c === 'number') return c;
  }
  if (typeof state?.getWeaponUpgradeCost === 'function') {
    const c = state.getWeaponUpgradeCost(wDef.id, shopLevel);
    if (c === null || typeof c === 'number') return c;
  }
  if (typeof callbacks?.getWeaponUpgradeCost === 'function') {
    const c = callbacks.getWeaponUpgradeCost(wDef.id, shopLevel);
    if (c === null || typeof c === 'number') return c;
  }
  const explicit =
    state?.weaponUpgradeCosts?.[wDef.id] ??
    state?.weapons?.[wDef.id]?.upgradeCost;
  if (typeof explicit === 'number') return explicit;
  return Math.round(wDef.upgradeBaseCost * Math.pow(1.36, shopLevel - 1));
}

export function resolveMasteryList(state, storeRef, callbacks, classId, lang) {
  const defsFromStore = typeof storeRef?.getHeroUpgradeDefs === 'function'
    ? storeRef.getHeroUpgradeDefs()
    : null;

  const rawMap =
    (state?.heroUpgradesByClass && state.heroUpgradesByClass[classId]) ||
    (state?.classUpgrades && state.classUpgrades[classId]) ||
    (state?.heroUpgrades && typeof state.heroUpgrades[classId] === 'object' && state.heroUpgrades[classId] !== null
      ? state.heroUpgrades[classId]
      : state?.heroUpgrades) ||
    state?.statLevels ||
    state?.mastery ||
    {};

  return DEFAULT_MASTERY_DEFS.filter((def) => !def.onlyClass || def.onlyClass === classId).map((def) => {
    let matchedKey = def.defaultKey;
    for (const candidate of def.keyCandidates) {
      if (Object.prototype.hasOwnProperty.call(rawMap, candidate)) {
        matchedKey = candidate;
        break;
      }
    }

    const storeDef = defsFromStore?.[matchedKey] || null;
    const maxLevel = Number(storeDef?.maxLevel ?? def.maxLevel ?? 8);

    let level = 0;
    if (typeof storeRef?.getHeroUpgradeLevel === 'function') {
      level = Number(storeRef.getHeroUpgradeLevel(matchedKey, classId)) || 0;
    } else {
      const rawVal = rawMap[matchedKey];
      level = Number(typeof rawVal === 'object' && rawVal !== null ? rawVal.level : rawVal) || 0;
    }
    level = Math.max(0, Math.min(maxLevel, Math.floor(level)));

    let cost = Math.round((storeDef?.baseCost ?? def.baseCost) * Math.pow(storeDef?.costScale ?? def.costScale ?? 1.4, level));
    if (level >= maxLevel) {
      cost = null;
    } else if (typeof storeRef?.getHeroUpgradeCost === 'function') {
      const c = storeRef.getHeroUpgradeCost(matchedKey, classId);
      if (c === null || typeof c === 'number') cost = c;
    } else if (typeof state?.getStatUpgradeCost === 'function') {
      cost = state.getStatUpgradeCost(matchedKey, level, classId);
    } else if (typeof callbacks?.getStatUpgradeCost === 'function') {
      cost = callbacks.getStatUpgradeCost(matchedKey, level, classId);
    }

    return {
      key: matchedKey,
      runeType: def.runeType,
      name: lang === 'en' ? (storeDef?.nameEn || def.nameEn) : (storeDef?.nameRu || def.nameRu),
      bonus: lang === 'en' ? (storeDef?.descEn || def.bonusEn) : (storeDef?.descRu || def.bonusRu),
      level,
      maxLevel,
      cost
    };
  });
}

export function isWeaponHighlightChoice(choice) {
  if (!choice) return false;
  if (choice.isWeaponLevelUp === false) return false;
  if (
    choice.isWeaponUpgrade ||
    choice.isWeaponLevelUp ||
    choice.goldHighlight ||
    choice.rarity === 'gold' ||
    choice.rarity === 'legendary' ||
    choice.type === 'weapon' ||
    choice.type === 'weapon_level' ||
    choice.category === 'weapon'
  ) {
    return true;
  }
  const id = String(choice.id || '').toLowerCase();
  return id === 'weapon_level_up' || id === 'levelup_weapon' || id.includes('weapon_level');
}

export function normalizeActivePerks(rawPerks) {
  const entries = [];
  if (!rawPerks) return entries;

  if (Array.isArray(rawPerks)) {
    const counts = new Map();
    for (let i = 0; i < rawPerks.length; i++) {
      const item = rawPerks[i];
      if (!item) continue;
      if (typeof item === 'string') {
        counts.set(item, (counts.get(item) || 0) + 1);
      } else if (typeof item === 'object' && item.id) {
        const st = Math.max(1, Number(item.stacks ?? item.count ?? item.rank ?? item.level ?? 1) || 1);
        counts.set(item.id, (counts.get(item.id) || 0) + st);
      }
    }
    for (const [id, stacks] of counts.entries()) {
      if (stacks > 0) entries.push([id, stacks]);
    }
  } else if (typeof rawPerks === 'object') {
    for (const [id, val] of Object.entries(rawPerks)) {
      const stacks = Number(val);
      if (Number.isFinite(stacks) && stacks > 0) {
        entries.push([id, Math.floor(stacks)]);
      }
    }
  }
  return entries;
}
