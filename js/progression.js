// Meta-progression store, Per-Class Arsenal & Workshop upgrades, stat calculator, and Tarot blessing roller
import {
  CLASSES,
  WEAPONS,
  LEVELS,
  SOULS_LEVEL_DEF,
  RUN_UPGRADES,
  WEAPON_MAX_LEVEL,
  MAGE_ELEMENTS,
  MAGE_ELEMENT_ORDER,
  MAGE_ELEMENT_UNLOCK_COSTS,
  MAGE_TALENT_TREE,
  CLASS_TALENT_TREES,
  DAILY_QUEST_TEMPLATES
} from './config.js?v=20261121z68';

export const WEAPON_MAX_SHOP_LEVEL = WEAPON_MAX_LEVEL || 12;

function getWeaponMaxLevel(weaponId) {
  return WEAPONS[weaponId]?.maxLevel || WEAPON_MAX_SHOP_LEVEL;
}

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

function createDefaultClassTalentsBucket(classId) {
  const map = {};
  const list = CLASS_TALENT_TREES[classId] || [];
  for (const node of list) {
    map[node.id] = 0;
  }
  return map;
}

function createDefaultAllClassTalents() {
  const all = {};
  for (const clsId of Object.keys(CLASS_TALENT_TREES)) {
    all[clsId] = createDefaultClassTalentsBucket(clsId);
  }
  return all;
}

function createDefaultMageTalents() {
  return createDefaultClassTalentsBucket('mage');
}

function getHeroXpToNext(level = 1) {
  return Math.round(95 * Math.pow(1.32, Math.max(0, Math.floor(Number(level) || 1) - 1)));
}

const DAILY_QUEST_KINDS_ORDER = ['kills', 'barrels_chests', 'bosses_waves'];
const DAILY_QUEST_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getTodayDateKey(dateObj = new Date()) {
  const d = dateObj instanceof Date && !Number.isNaN(dateObj.getTime()) ? dateObj : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDailyQuestKind(kind) {
  const raw = String(kind || '').trim().toLowerCase();
  if (raw === 'kills' || raw === 'kill' || raw === 'enemy' || raw === 'enemies' || raw === 'slay') {
    return 'kills';
  }
  if (
    raw === 'barrels_chests' ||
    raw === 'barrel' ||
    raw === 'barrels' ||
    raw === 'chest' ||
    raw === 'chests' ||
    raw === 'cursed_chest' ||
    raw === 'crate' ||
    raw === 'crates'
  ) {
    return 'barrels_chests';
  }
  if (
    raw === 'bosses_waves' ||
    raw === 'boss' ||
    raw === 'bosses' ||
    raw === 'wave' ||
    raw === 'waves' ||
    raw === 'endless_wave' ||
    raw === 'chapter'
  ) {
    return 'bosses_waves';
  }
  return raw;
}

function hashDateKey(dateKey) {
  let h = 2166136261;
  const s = String(dateKey || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildDailyQuestsForDate(dateKey) {
  const seed = hashDateKey(dateKey || getTodayDateKey());
  const templates = Array.isArray(DAILY_QUEST_TEMPLATES) ? DAILY_QUEST_TEMPLATES : [];
  const picked = [];
  for (let i = 0; i < DAILY_QUEST_KINDS_ORDER.length; i++) {
    const kind = DAILY_QUEST_KINDS_ORDER[i];
    const pool = templates.filter((t) => t && t.kind === kind);
    if (!pool.length) continue;
    const tpl = pool[(seed + i * 7) % pool.length];
    picked.push({
      id: String(tpl.id),
      kind: tpl.kind,
      titleRu: String(tpl.titleRu || tpl.id),
      target: clampInt(tpl.target, 1, 99999, 1),
      progress: 0,
      rewardGold: clampInt(tpl.rewardGold, 10, 99999, 100),
      claimed: false
    });
  }
  return picked;
}

function sanitizeDailyQuestsList(list, dateKey) {
  const fallback = buildDailyQuestsForDate(dateKey);
  if (!Array.isArray(list) || list.length === 0) return fallback;
  const tplById = new Map((Array.isArray(DAILY_QUEST_TEMPLATES) ? DAILY_QUEST_TEMPLATES : []).map((t) => [t.id, t]));
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length && out.length < 3; i++) {
    const raw = list[i];
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const id = String(raw.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const tpl = tplById.get(id);
    const target = clampInt(raw.target ?? tpl?.target, 1, 99999, 1);
    out.push({
      id,
      kind: normalizeDailyQuestKind(raw.kind || tpl?.kind || 'kills'),
      titleRu: String(raw.titleRu || tpl?.titleRu || id),
      target,
      progress: clampInt(raw.progress, 0, target, 0),
      rewardGold: clampInt(raw.rewardGold ?? tpl?.rewardGold, 10, 99999, 100),
      claimed: Boolean(raw.claimed)
    });
  }
  return out.length === 3 ? out : fallback;
}

function mergeDailyQuestsState(localState, cloudState) {
  const todayKey = getTodayDateKey();
  const localDate = typeof localState?.dailyQuestsDate === 'string' && DAILY_QUEST_DATE_RE.test(localState.dailyQuestsDate)
    ? localState.dailyQuestsDate
    : '';
  const cloudDate = typeof cloudState?.dailyQuestsDate === 'string' && DAILY_QUEST_DATE_RE.test(cloudState.dailyQuestsDate)
    ? cloudState.dailyQuestsDate
    : '';

  if (localDate && localDate === cloudDate) {
    const localList = sanitizeDailyQuestsList(localState.dailyQuests, localDate);
    const cloudList = sanitizeDailyQuestsList(cloudState.dailyQuests, cloudDate);
    const byId = new Map();
    for (const q of localList) byId.set(q.id, { ...q });
    for (const q of cloudList) {
      const prev = byId.get(q.id);
      if (prev) {
        const target = Math.max(prev.target, q.target);
        prev.target = target;
        prev.progress = clampInt(Math.max(prev.progress, q.progress), 0, target, 0);
        prev.claimed = Boolean(prev.claimed || q.claimed);
      } else if (byId.size < 3) {
        byId.set(q.id, { ...q });
      }
    }
    return {
      dailyQuestsDate: localDate,
      dailyQuests: sanitizeDailyQuestsList(Array.from(byId.values()), localDate)
    };
  }

  if (localDate && (!cloudDate || localDate > cloudDate)) {
    return {
      dailyQuestsDate: localDate,
      dailyQuests: sanitizeDailyQuestsList(localState.dailyQuests, localDate)
    };
  }
  if (cloudDate) {
    return {
      dailyQuestsDate: cloudDate,
      dailyQuests: sanitizeDailyQuestsList(cloudState.dailyQuests, cloudDate)
    };
  }
  return {
    dailyQuestsDate: todayKey,
    dailyQuests: buildDailyQuestsForDate(todayKey)
  };
}

function createDefaultState(zeroGold = false) {
  const classUpgrades = createDefaultClassUpgrades();
  const classTalents = createDefaultAllClassTalents();
  const mageTalents = classTalents.mage;
  const todayKey = getTodayDateKey();
  return {
    gold: zeroGold ? 0 : 0,
    riftGold: 0,
    selectedClass: 'warrior',
    maxUnlockedLevel: 1,
    heroLevel: 1,
    heroXp: 0,
    bestEndlessKills: 0,
    bestEndlessTimeSec: 0,
    levelStars: {},
    difficultyMode: 'normal',
    unlockedBlueprints: {},
    bossHammerAttemptedStages: {},
    mageStarterChosen: true,
    activeMageElement: 'water',
    unlockedMageElements: { water: true },
    unlockedWeapons: {
      club: true,
      usp_pistol: true,
      spark_staff: true
    },
    equippedWeapons: {
      warrior: 'club',
      gunslinger: 'usp_pistol',
      mage: 'spark_staff'
    },
    gunslingerUspStarterMigrated: true,
    weaponShopLevels: {
      club: 1, spear: 1, zweihander: 1, axe: 1, boss_hammer: 1,
      usp_pistol: 1, colt: 1, smg: 1, pistol: 1, ak47: 1, blunderbuss: 1, gatling: 1,
      spark_staff: 1
    },
    classUpgrades,
    classTalents,
    mageTalents,
    dailyQuestsDate: todayKey,
    dailyQuests: buildDailyQuestsForDate(todayKey),
    onboardingDone: false
  };
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(num)));
}

function mergeTruthyMap(a, b) {
  const out = {};
  const absorb = (src) => {
    if (!src) return;
    if (Array.isArray(src)) {
      for (let i = 0; i < src.length; i++) {
        if (src[i]) out[String(src[i])] = true;
      }
    } else if (typeof src === 'object') {
      for (const [k, v] of Object.entries(src)) {
        if (v) out[k] = true;
      }
    }
  };
  absorb(a);
  absorb(b);
  return out;
}

function mergeMaxNumMap(a, b, fallback = 0) {
  const out = {};
  const keys = new Set([
    ...(a && typeof a === 'object' ? Object.keys(a) : []),
    ...(b && typeof b === 'object' ? Object.keys(b) : [])
  ]);
  for (const k of keys) {
    const va = Number(a?.[k]);
    const vb = Number(b?.[k]);
    const na = Number.isFinite(va) ? va : fallback;
    const nb = Number.isFinite(vb) ? vb : fallback;
    out[k] = Math.max(na, nb);
  }
  return out;
}

// Non-destructive Yandex Cloud <-> Local save merger:
// Always preserves maximum progression (gold, hero XP/level, chapters, stars, shop & talent ranks,
// Endless records) and unions unlocked weapons, blueprints, relics, and achievements.
export function mergeCloudState(localState, cloudState) {
  const hasLocal = localState && typeof localState === 'object' && Object.keys(localState).length > 0;
  const hasCloud = cloudState && typeof cloudState === 'object' && Object.keys(cloudState).length > 0;
  if (!hasLocal && !hasCloud) return createDefaultState();
  if (!hasCloud) return { ...localState };
  if (!hasLocal) return { ...cloudState };

  const localTs = Number(localState.updatedAt || 0);
  const cloudTs = Number(cloudState.updatedAt || 0);
  const primary = cloudTs > localTs ? cloudState : localState;
  const secondary = cloudTs > localTs ? localState : cloudState;

  const localHeroLvl = clampInt(localState.heroLevel, 1, 50, 1);
  const cloudHeroLvl = clampInt(cloudState.heroLevel, 1, 50, 1);
  const localHeroXp = clampInt(localState.heroXp, 0, 999999, 0);
  const cloudHeroXp = clampInt(cloudState.heroXp, 0, 999999, 0);
  let heroLevel = localHeroLvl;
  let heroXp = localHeroXp;
  if (cloudHeroLvl > localHeroLvl) {
    heroLevel = cloudHeroLvl;
    heroXp = cloudHeroXp;
  } else if (cloudHeroLvl === localHeroLvl) {
    heroXp = Math.max(localHeroXp, cloudHeroXp);
  }

  const unlockedWeapons = mergeTruthyMap(localState.unlockedWeapons, cloudState.unlockedWeapons);
  unlockedWeapons.club = true;
  unlockedWeapons.usp_pistol = true;
  unlockedWeapons.spark_staff = true;

  const weaponShopLevels = mergeMaxNumMap(localState.weaponShopLevels, cloudState.weaponShopLevels, 1);
  const rawLevelStars = mergeMaxNumMap(localState.levelStars, cloudState.levelStars, 0);
  const levelStars = {};
  for (let lvl = 1; lvl <= LEVELS.length; lvl++) {
    const s = rawLevelStars[lvl] ?? rawLevelStars[String(lvl)];
    if (s !== undefined) {
      levelStars[lvl] = clampInt(s, 0, 3, 0);
    }
  }
  const unlockedBlueprints = mergeTruthyMap(localState.unlockedBlueprints, cloudState.unlockedBlueprints);
  const bossHammerAttemptedStages = mergeTruthyMap(localState.bossHammerAttemptedStages, cloudState.bossHammerAttemptedStages);
  const unlockedMageElements = mergeTruthyMap(localState.unlockedMageElements, cloudState.unlockedMageElements);
  unlockedMageElements.water = true;

  const classUpgrades = {};
  for (const clsId of Object.keys(CLASSES)) {
    classUpgrades[clsId] = mergeMaxNumMap(
      localState.classUpgrades?.[clsId],
      cloudState.classUpgrades?.[clsId],
      0
    );
  }

  const classTalents = {};
  for (const clsId of Object.keys(CLASS_TALENT_TREES)) {
    const localBucket = clsId === 'mage'
      ? mergeMaxNumMap(localState.classTalents?.mage, localState.mageTalents, 0)
      : localState.classTalents?.[clsId];
    const cloudBucket = clsId === 'mage'
      ? mergeMaxNumMap(cloudState.classTalents?.mage, cloudState.mageTalents, 0)
      : cloudState.classTalents?.[clsId];
    classTalents[clsId] = mergeMaxNumMap(localBucket, cloudBucket, 0);
  }
  const mageTalents = { ...(classTalents.mage || {}) };

  const equippedWeapons = {
    ...(secondary.equippedWeapons || {}),
    ...(primary.equippedWeapons || {})
  };
  for (const [clsId, clsDef] of Object.entries(CLASSES)) {
    const eq = equippedWeapons[clsId];
    if (!eq || !WEAPONS[eq] || !unlockedWeapons[eq]) {
      equippedWeapons[clsId] = clsDef.starterWeapon;
    }
  }

  const merged = {
    ...secondary,
    ...primary,
    gold: Math.max(clampInt(localState.gold, 0, 99999999, 0), clampInt(cloudState.gold, 0, 99999999, 0)),
    riftGold: Math.max(clampInt(localState.riftGold, 0, 99999999, 0), clampInt(cloudState.riftGold, 0, 99999999, 0)),
    maxUnlockedLevel: Math.max(
      clampInt(localState.maxUnlockedLevel, 1, LEVELS.length, 1),
      clampInt(cloudState.maxUnlockedLevel, 1, LEVELS.length, 1)
    ),
    heroLevel,
    heroXp,
    bestEndlessKills: Math.max(
      clampInt(localState.bestEndlessKills, 0, 9999999, 0),
      clampInt(cloudState.bestEndlessKills, 0, 9999999, 0)
    ),
    bestEndlessTimeSec: Math.max(
      clampInt(localState.bestEndlessTimeSec, 0, 9999999, 0),
      clampInt(cloudState.bestEndlessTimeSec, 0, 9999999, 0)
    ),
    levelStars,
    unlockedWeapons,
    equippedWeapons,
    gunslingerUspStarterMigrated: Boolean(
      localState.gunslingerUspStarterMigrated || cloudState.gunslingerUspStarterMigrated
    ),
    weaponShopLevels,
    unlockedBlueprints,
    bossHammerAttemptedStages,
    unlockedMageElements,
    classUpgrades,
    classTalents,
    mageTalents,
    ...mergeDailyQuestsState(localState, cloudState),
    onboardingDone: Boolean(localState.onboardingDone || cloudState.onboardingDone),
    updatedAt: Math.max(localTs, cloudTs, Date.now())
  };

  if (localState.unlockedRelics || cloudState.unlockedRelics) {
    merged.unlockedRelics = mergeTruthyMap(localState.unlockedRelics, cloudState.unlockedRelics);
  }
  if (localState.achievements || cloudState.achievements) {
    merged.achievements = mergeTruthyMap(localState.achievements, cloudState.achievements);
  }
  if (localState.heroUpgrades || cloudState.heroUpgrades) {
    merged.heroUpgrades = mergeMaxNumMap(localState.heroUpgrades, cloudState.heroUpgrades, 0);
  }

  return merged;
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
    const heroLevel = clampInt(state.heroLevel, 1, 50, 1);
    const heroXpNext = getHeroXpToNext(heroLevel);
    const heroXp = clampInt(state.heroXp, 0, heroXpNext, 0);
    const mageTalents = {
      ...createDefaultClassTalentsBucket('mage'),
      ...(state.classTalents?.mage || {}),
      ...(state.mageTalents || {})
    };
    const classTalents = createDefaultAllClassTalents();
    for (const clsId of Object.keys(CLASS_TALENT_TREES)) {
      classTalents[clsId] = {
        ...createDefaultClassTalentsBucket(clsId),
        ...(state.classTalents?.[clsId] || {}),
        ...(clsId === 'mage' ? mageTalents : {})
      };
    }
    return {
      gold: state.gold,
      riftGold: clampInt(state.riftGold, 0, 99999999, 0),
      selectedClass: activeCls,
      maxUnlockedLevel: clampInt(state.maxUnlockedLevel, 1, LEVELS.length, 1),
      heroLevel,
      heroXp,
      heroXpNext,
      bestEndlessKills: clampInt(state.bestEndlessKills, 0, 9999999, 0),
      bestEndlessTimeSec: clampInt(state.bestEndlessTimeSec, 0, 9999999, 0),
      levelStars: { ...(state.levelStars || {}) },
      difficultyMode: state.difficultyMode === 'hard' ? 'hard' : 'normal',
      unlockedBlueprints: { ...(state.unlockedBlueprints || {}) },
      bossHammerAttemptedStages: { ...(state.bossHammerAttemptedStages || {}) },
      classTalents,
      mageTalents,
      mageStarterChosen: true,
      activeMageElement: 'water',
      unlockedMageElements: { water: true },
      unlockedWeapons: { ...state.unlockedWeapons },
      equippedWeapons: { ...state.equippedWeapons },
      gunslingerUspStarterMigrated: Boolean(state.gunslingerUspStarterMigrated),
      weaponShopLevels: { ...state.weaponShopLevels },
      classUpgrades,
      // Active class mirror for UI helpers reading state.heroUpgrades
      heroUpgrades: { ...classUpgrades[activeCls] },
      dailyQuestsDate: state.dailyQuestsDate || getTodayDateKey(),
      dailyQuests: Array.isArray(state.dailyQuests)
        ? state.dailyQuests.map((q) => ({ ...q }))
        : buildDailyQuestsForDate(state.dailyQuestsDate || getTodayDateKey()),
      onboardingDone: Boolean(state.onboardingDone)
    };
  }

  function loadState(savedObj) {
    const base = createDefaultState();
    if (!savedObj || typeof savedObj !== 'object') {
      state = base;
      return cloneState();
    }

    base.gold = clampInt(savedObj.gold, 0, 99999999, base.gold);
    base.riftGold = clampInt(savedObj.riftGold, 0, 99999999, base.riftGold);
    if (savedObj.selectedClass && CLASSES[savedObj.selectedClass]) {
      base.selectedClass = savedObj.selectedClass;
    }
    // Shared 25-level campaign unlock across all classes
    base.maxUnlockedLevel = clampInt(savedObj.maxUnlockedLevel, 1, LEVELS.length, 1);
    if (savedObj.heroLevel !== undefined && savedObj.heroLevel !== null) {
      base.heroLevel = clampInt(savedObj.heroLevel, 1, 50, 1);
    } else if (base.maxUnlockedLevel > 1) {
      base.heroLevel = clampInt(Math.min(8, Math.max(2, Math.floor(base.maxUnlockedLevel * 0.35))), 1, 50, 1);
    }
    base.heroXp = clampInt(savedObj.heroXp, 0, 999999, 0);
    base.bestEndlessKills = clampInt(savedObj.bestEndlessKills, 0, 9999999, 0);
    base.bestEndlessTimeSec = clampInt(savedObj.bestEndlessTimeSec, 0, 9999999, 0);
    if (savedObj.mageTalents && typeof savedObj.mageTalents === 'object') {
      for (const node of MAGE_TALENT_TREE) {
        if (savedObj.mageTalents[node.id] !== undefined) {
          const val = clampInt(savedObj.mageTalents[node.id], 0, node.maxRank, 0);
          base.mageTalents[node.id] = val;
          base.classTalents.mage[node.id] = val;
        }
      }
    }
    if (savedObj.classTalents && typeof savedObj.classTalents === 'object') {
      for (const [clsId, tree] of Object.entries(CLASS_TALENT_TREES)) {
        const src = savedObj.classTalents[clsId];
        if (!src || typeof src !== 'object') continue;
        for (const node of tree) {
          if (src[node.id] !== undefined) {
            base.classTalents[clsId][node.id] = clampInt(src[node.id], 0, node.maxRank, 0);
          }
        }
      }
      base.mageTalents = { ...base.classTalents.mage };
    }
    if (savedObj.levelStars && typeof savedObj.levelStars === 'object') {
      for (let lvl = 1; lvl <= LEVELS.length; lvl++) {
        const s = savedObj.levelStars[lvl] ?? savedObj.levelStars[String(lvl)];
        if (s !== undefined) {
          base.levelStars[lvl] = clampInt(s, 0, 3, 0);
        }
      }
    }
    base.difficultyMode = savedObj.difficultyMode === 'hard' ? 'hard' : 'normal';
    if (savedObj.unlockedBlueprints && typeof savedObj.unlockedBlueprints === 'object') {
      for (const [k, v] of Object.entries(savedObj.unlockedBlueprints)) {
        if (v) base.unlockedBlueprints[k] = true;
      }
    }
    if (savedObj.bossHammerAttemptedStages && typeof savedObj.bossHammerAttemptedStages === 'object') {
      for (const [k, v] of Object.entries(savedObj.bossHammerAttemptedStages)) {
        if (v) base.bossHammerAttemptedStages[k] = true;
      }
    }

    base.unlockedMageElements = { water: true };
    base.mageStarterChosen = true;
    base.activeMageElement = 'water';

    if (savedObj.unlockedWeapons && typeof savedObj.unlockedWeapons === 'object') {
      for (const wpnId of Object.keys(WEAPONS)) {
        if (savedObj.unlockedWeapons[wpnId]) {
          base.unlockedWeapons[wpnId] = true;
        }
      }
    }
    // Starter weapons are always unlocked
    base.unlockedWeapons.club = true;
    base.unlockedWeapons.usp_pistol = true;
    base.unlockedWeapons.spark_staff = true;
    base.gunslingerUspStarterMigrated = Boolean(savedObj.gunslingerUspStarterMigrated);
    if (!base.gunslingerUspStarterMigrated) {
      base.gunslingerUspStarterMigrated = true;
      const hadShotgunOnlyAsOldStarter =
        base.maxUnlockedLevel < 7 &&
        (savedObj.weaponShopLevels?.pistol ?? 1) <= 1 &&
        (!savedObj.equippedWeapons?.gunslinger || savedObj.equippedWeapons.gunslinger === 'pistol');
      if (hadShotgunOnlyAsOldStarter) {
        delete base.unlockedWeapons.pistol;
        base.equippedWeapons.gunslinger = 'usp_pistol';
      }
    }

    if (savedObj.weaponShopLevels && typeof savedObj.weaponShopLevels === 'object') {
      for (const wpnId of Object.keys(WEAPONS)) {
        base.weaponShopLevels[wpnId] = clampInt(
          savedObj.weaponShopLevels[wpnId],
          1,
          getWeaponMaxLevel(wpnId),
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

    const todayKey = getTodayDateKey();
    const savedDailyDate =
      typeof savedObj.dailyQuestsDate === 'string' && DAILY_QUEST_DATE_RE.test(savedObj.dailyQuestsDate)
        ? savedObj.dailyQuestsDate
        : '';
    if (savedDailyDate === todayKey && Array.isArray(savedObj.dailyQuests)) {
      base.dailyQuestsDate = todayKey;
      base.dailyQuests = sanitizeDailyQuestsList(savedObj.dailyQuests, todayKey);
    } else {
      base.dailyQuestsDate = todayKey;
      base.dailyQuests = buildDailyQuestsForDate(todayKey);
    }
    base.onboardingDone = Boolean(savedObj.onboardingDone);

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

  function getRiftGold() {
    return clampInt(state.riftGold, 0, 99999999, 0);
  }

  function addRiftGold(amount) {
    const delta = Number(amount);
    if (!Number.isFinite(delta)) return getRiftGold();
    state.riftGold = Math.max(0, Math.min(99999999, Math.round(getRiftGold() + delta)));
    return state.riftGold;
  }

  function selectClass(classId) {
    if (!CLASSES[classId]) return false;
    state.selectedClass = classId;
    return true;
  }

  function isWeaponUnlocked(weaponId) {
    return Boolean(state.unlockedWeapons[weaponId]);
  }

  function isBlueprintUnlocked(weaponId) {
    return Boolean(state.unlockedBlueprints?.[weaponId]);
  }

  function unlockBlueprint(weaponId) {
    if (!WEAPONS[weaponId]) return false;
    if (!state.unlockedBlueprints) state.unlockedBlueprints = {};
    const newlyFound = !state.unlockedBlueprints[weaponId];
    state.unlockedBlueprints[weaponId] = true;
    return newlyFound;
  }

  function hasAttemptedBossHammerStage(stageNumber) {
    return Boolean(state.bossHammerAttemptedStages?.[String(stageNumber)]);
  }

  function markBossHammerAttempted(stageNumber) {
    if (!state.bossHammerAttemptedStages) state.bossHammerAttemptedStages = {};
    state.bossHammerAttemptedStages[String(stageNumber)] = true;
  }

  function canBuyWeaponInShop(weaponId) {
    const wpn = WEAPONS[weaponId];
    if (!wpn || isWeaponUnlocked(weaponId) || wpn.bossExclusive || (wpn.shopCost || 0) <= 0) {
      return { ok: false, reason: 'unavailable' };
    }
    if (wpn.blueprintChestChance && !isBlueprintUnlocked(weaponId)) {
      return { ok: false, reason: 'blueprint' };
    }
    if (wpn.unlockRequiresBossStage && state.maxUnlockedLevel <= wpn.unlockRequiresBossStage) {
      return { ok: false, reason: 'boss' };
    }
    if (wpn.unlockLevel && state.maxUnlockedLevel < wpn.unlockLevel) {
      return { ok: false, reason: 'level' };
    }
    if (state.gold < wpn.shopCost) {
      return { ok: false, reason: 'gold' };
    }
    return { ok: true, cost: wpn.shopCost };
  }

  function buyWeaponInShop(weaponId) {
    const check = canBuyWeaponInShop(weaponId);
    if (!check.ok) return false;
    state.gold -= check.cost;
    state.unlockedWeapons[weaponId] = true;
    const wpn = WEAPONS[weaponId];
    if (wpn?.classId && CLASSES[wpn.classId]) {
      state.equippedWeapons[wpn.classId] = weaponId;
    }
    return true;
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
    const maxLvl = getWeaponMaxLevel(weaponId);
    if (currentLevel >= maxLvl) return null;
    const baseCost = wpn.upgradeBaseCost || 45;
    if (currentLevel <= 12) {
      return Math.round(baseCost * Math.pow(1.34, currentLevel - 1));
    }
    return Math.round(baseCost * Math.pow(1.34, 11) * Math.pow(1.14, currentLevel - 12));
  }

  function upgradeWeaponInShop(weaponId) {
    const wpn = WEAPONS[weaponId];
    if (!wpn || !isWeaponUnlocked(weaponId)) return false;
    const currentLevel = getWeaponShopLevel(weaponId);
    const maxLvl = getWeaponMaxLevel(weaponId);
    if (currentLevel >= maxLvl) return false;
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

  function isCampaignLevel(levelNum) {
    if (levelNum === SOULS_LEVEL_DEF.id) return false;
    const num = Number(levelNum);
    if (!Number.isFinite(num)) return false;
    const lvl = Math.floor(num);
    return lvl >= 1 && lvl <= LEVELS.length && lvl !== SOULS_LEVEL_DEF.level;
  }

  function unlockNextLevel(clearedLevel) {
    const hasExplicit = clearedLevel !== undefined && clearedLevel !== null;
    if (hasExplicit && !isCampaignLevel(clearedLevel)) {
      return false;
    }
    const baseLevel = hasExplicit
      ? Math.floor(Number(clearedLevel))
      : clampInt(state.maxUnlockedLevel, 1, LEVELS.length, 1);
    if (baseLevel < 1 || baseLevel >= LEVELS.length) {
      return false;
    }
    const targetLevel = Math.min(LEVELS.length, baseLevel + 1);
    if (targetLevel > state.maxUnlockedLevel) {
      state.maxUnlockedLevel = targetLevel;
      return true;
    }
    return false;
  }

  function recordLevelStars(levelNum, starsCount) {
    if (!isCampaignLevel(levelNum)) return false;
    const lvl = Math.floor(Number(levelNum));
    const stars = clampInt(starsCount, 0, 3, 0);
    if (!state.levelStars || typeof state.levelStars !== 'object') {
      state.levelStars = {};
    }
    const prev = clampInt(state.levelStars[lvl], 0, 3, 0);
    if (stars > prev) {
      state.levelStars[lvl] = stars;
      return true;
    }
    return false;
  }

  function setDifficultyMode(mode) {
    state.difficultyMode = mode === 'hard' ? 'hard' : 'normal';
    return state.difficultyMode;
  }

  function addHeroXp(amount) {
    const gain = Math.max(0, Math.round(Number(amount) || 0));
    if (gain <= 0) {
      return {
        leveledUp: false,
        gainedLevels: 0,
        newLevel: state.heroLevel || 1,
        heroXp: state.heroXp || 0,
        heroXpNext: getHeroXpToNext(state.heroLevel || 1)
      };
    }
    state.heroLevel = clampInt(state.heroLevel, 1, 50, 1);
    state.heroXp = Math.max(0, Number(state.heroXp) || 0) + gain;
    let gainedLevels = 0;
    while (state.heroLevel < 50) {
      const req = getHeroXpToNext(state.heroLevel);
      if (state.heroXp < req) break;
      state.heroXp -= req;
      state.heroLevel += 1;
      gainedLevels += 1;
    }
    if (state.heroLevel >= 50) {
      state.heroXp = Math.min(state.heroXp, getHeroXpToNext(50));
    }
    return {
      leveledUp: gainedLevels > 0,
      gainedLevels,
      newLevel: state.heroLevel,
      heroXp: state.heroXp,
      heroXpNext: getHeroXpToNext(state.heroLevel)
    };
  }

  function getClassTalentRank(classId, talentId) {
    const cls = resolveClassId(classId);
    const map = cls === 'mage' ? (state.classTalents?.mage || state.mageTalents) : state.classTalents?.[cls];
    return clampInt(map?.[talentId], 0, 10, 0);
  }

  function getClassTalentPointsSpent(classId) {
    const cls = resolveClassId(classId);
    const tree = CLASS_TALENT_TREES[cls] || [];
    let sum = 0;
    for (const node of tree) {
      sum += getClassTalentRank(cls, node.id);
    }
    return sum;
  }

  function getClassTalentPointsAvailable(classId) {
    const totalPoints = clampInt(state.heroLevel, 1, 50, 1);
    return Math.max(0, totalPoints - getClassTalentPointsSpent(classId));
  }

  function canUpgradeClassTalent(classId, talentId) {
    const cls = resolveClassId(classId);
    const tree = CLASS_TALENT_TREES[cls] || [];
    const def = tree.find((n) => n.id === talentId);
    if (!def) return false;
    if (getClassTalentPointsAvailable(cls) < 1) return false;
    if (getClassTalentRank(cls, talentId) >= def.maxRank) return false;
    for (const req of def.requires || []) {
      if (getClassTalentRank(cls, req.id) < (req.rank || 1)) return false;
    }
    return true;
  }

  function upgradeClassTalent(classId, talentId) {
    const cls = resolveClassId(classId);
    if (!canUpgradeClassTalent(cls, talentId)) return false;
    if (!state.classTalents) state.classTalents = createDefaultAllClassTalents();
    if (!state.classTalents[cls]) state.classTalents[cls] = createDefaultClassTalentsBucket(cls);
    const nextVal = getClassTalentRank(cls, talentId) + 1;
    state.classTalents[cls][talentId] = nextVal;
    if (cls === 'mage') {
      if (!state.mageTalents) state.mageTalents = createDefaultClassTalentsBucket('mage');
      state.mageTalents[talentId] = nextVal;
    }
    return true;
  }

  function resetClassTalents(classId) {
    const cls = resolveClassId(classId);
    if (!state.classTalents) state.classTalents = createDefaultAllClassTalents();
    state.classTalents[cls] = createDefaultClassTalentsBucket(cls);
    if (cls === 'mage') {
      state.mageTalents = createDefaultClassTalentsBucket('mage');
    }
    return true;
  }

  const getMageTalentRank = (talentId) => getClassTalentRank('mage', talentId);
  const getMageTalentPointsSpent = () => getClassTalentPointsSpent('mage');
  const getMageTalentPointsAvailable = () => getClassTalentPointsAvailable('mage');
  const canUpgradeMageTalent = (talentId) => canUpgradeClassTalent('mage', talentId);
  const upgradeMageTalent = (talentId) => upgradeClassTalent('mage', talentId);
  const resetMageTalents = () => resetClassTalents('mage');

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

    // Menu-only Class Talent Tree stacks (+ legacy zeroed in-run perks fallback)
    const isMage = cls.id === 'mage';
    const isWar = cls.id === 'warrior';
    const isGun = cls.id === 'gunslinger';

    const tFlow = isMage ? getClassTalentRank('mage', 'water_pressure') : 0;
    const tMana = isMage ? getClassTalentRank('mage', 'mana_spring') : 0;
    const tVel = isMage ? getClassTalentRank('mage', 'frost_velocity') : 0;
    const tWard = isMage ? getClassTalentRank('mage', 'hydro_barrier') : 0;
    const tTwin = isMage ? getClassTalentRank('mage', 'twin_sphere') : 0;
    const tCrit = isMage ? getClassTalentRank('mage', 'crimson_tide') : 0;
    const tFury = isMage ? getClassTalentRank('mage', 'maelstrom_fury') : 0;

    const wGrip = isWar ? getClassTalentRank('warrior', 'war_steel_grip') : 0;
    const wShield = isWar ? getClassTalentRank('warrior', 'war_shield_wall') : 0;
    const wStride = isWar ? getClassTalentRank('warrior', 'war_swift_stride') : 0;
    const wBanner = isWar ? getClassTalentRank('warrior', 'war_iron_banner') : 0;
    const wWhirl = isWar ? getClassTalentRank('warrior', 'war_whirlwind_edge') : 0;
    const wBlood = isWar ? getClassTalentRank('warrior', 'war_blood_cleave') : 0;
    const wOrbit = isWar ? getClassTalentRank('warrior', 'war_orbital_blades') : 0;

    const gSlug = isGun ? getClassTalentRank('gunslinger', 'gun_heavy_slug') : 0;
    const gBelt = isGun ? getClassTalentRank('gunslinger', 'gun_ammo_belt') : 0;
    const gQuick = isGun ? getClassTalentRank('gunslinger', 'gun_quicksilver') : 0;
    const gRico = isGun ? getClassTalentRank('gunslinger', 'gun_ricochet_shot') : 0;
    const gExp = isGun ? getClassTalentRank('gunslinger', 'gun_explosive_powder') : 0;
    const gDead = isGun ? getClassTalentRank('gunslinger', 'gun_deadeye') : 0;
    const gMine = isGun ? getClassTalentRank('gunslinger', 'gun_shrapnel_trap') : 0;
    const gLightArms = isGun ? getClassTalentRank('gunslinger', 'gun_light_arms') : 0;
    const gPistolMast = isGun ? getClassTalentRank('gunslinger', 'gun_pistol_mastery') : 0;
    const gSmgFury = isGun ? getClassTalentRank('gunslinger', 'gun_smg_fury') : 0;
    const gRifleCore = isGun ? getClassTalentRank('gunslinger', 'gun_rifle_core') : 0;
    const gRifleStab = isGun ? getClassTalentRank('gunslinger', 'gun_rifle_stabilizer') : 0;
    const gShotBlitz = isGun ? getClassTalentRank('gunslinger', 'gun_shotgun_blitz') : 0;

    const isPistolWpn = wpn.id === 'usp_pistol' || wpn.id === 'colt';
    const isSmgWpn = wpn.id === 'smg';
    const isLightWpn = isPistolWpn || isSmgWpn;
    const isRifleWpn = wpn.id === 'ak47';
    const isShotgunWpn = Boolean(wpn.isShotgun);

    // Class-specific & dark relic in-run blessing stacks
    const mageArcaneStacks = getPerkStacks(perks, 'mage_arcane_surge');
    const mageTwinStacks = getPerkStacks(perks, 'mage_twin_cast') + tTwin;
    const mageCatalystStacks = getPerkStacks(perks, 'mage_elem_catalyst') + tFury;
    const mageMeteorStacks = getPerkStacks(perks, 'mage_meteor_shower') + tFury;
    const mageWardStacks = getPerkStacks(perks, 'mage_arcane_ward') + tWard;
    const mageManaFontStacks = getPerkStacks(perks, 'mage_mana_font') + tMana;

    const gunHeavyStacks = getPerkStacks(perks, 'gun_heavy_buckshot') + gSlug;
    const gunRicochetStacks = getPerkStacks(perks, 'gun_ricochet') + gRico;
    const gunExplosiveStacks = getPerkStacks(perks, 'gun_explosive_slugs') + gExp;
    const gunReloadStacks = getPerkStacks(perks, 'gun_tactical_reload') + gBelt;
    const ammoPouchStacks = getPerkStacks(perks, 'ammo_pouch') + gBelt;
    const gunMineStacks = getPerkStacks(perks, 'gun_shrapnel_mine') + gMine;

    // Warrior single-target focused talent scaling (zero sword AoE / splash!)
    const warOrbitStacks = 0;
    const warSeismicStacks = 0;
    const warThornsStacks = 0;
    const warWhirlwindStacks = 0;
    const warBloodStacks = getPerkStacks(perks, 'war_blood_cleave') + wBlood;
    const warBannerStacks = getPerkStacks(perks, 'war_iron_banner') + wBanner;

    const critFangStacks = getPerkStacks(perks, 'crit_fang');
    const greedStacks = getPerkStacks(perks, 'greed_contract');

    // Stage 2 Synergistic Roguelike In-Run Perks
    const dashFireTrailStacks = getPerkStacks(perks, 'dash_fire_trail');
    const shieldThornsStacks = getPerkStacks(perks, 'shield_thorns_wave');
    const critChainStacks = getPerkStacks(perks, 'crit_chain_lightning');
    const vampiricHarvestStacks = getPerkStacks(perks, 'vampiric_harvest');
    const rapidCadenceStacks = getPerkStacks(perks, 'rapid_cadence');
    const frostShatterStacks = getPerkStacks(perks, 'frost_shatter');
    const executionerStacks = getPerkStacks(perks, 'executioner_cleave');

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
      tFlow * 0.18 +
      tFury * 0.22 +
      wGrip * 0.16 +
      wBanner * 0.14 +
      wWhirl * 0.14 +
      wOrbit * 0.24 +
      (isShotgunWpn ? gunHeavyStacks * 0.14 : getPerkStacks(perks, 'gun_heavy_buckshot') * 0.14) +
      (isLightWpn ? gLightArms * 0.12 : 0) +
      (isPistolWpn ? gPistolMast * 0.18 : 0) +
      (isRifleWpn ? gRifleCore * 0.16 : 0) +
      gExp * 0.16 +
      gMine * 0.18;
    const perkHasteMult =
      1 +
      rapidCadenceStacks * 0.18 +
      tVel * 0.07 +
      wStride * 0.08 +
      gQuick * 0.07 +
      (isSmgWpn ? gSmgFury * 0.12 : 0) +
      (isShotgunWpn ? gShotBlitz * 0.12 : 0);
    const perkReloadMult =
      1 +
      rapidCadenceStacks * 0.18 +
      gunReloadStacks * 0.28 +
      (isLightWpn ? gLightArms * 0.18 : 0) +
      (isShotgunWpn ? gShotBlitz * 0.20 : 0);
    const perkMoveMult =
      1 +
      greedStacks * 0.07 +
      tVel * 0.06 +
      wStride * 0.06 +
      gQuick * 0.07;

    const weaponMoveMult = Math.min(1.12, (wpn.moveSpeedMult ?? 1.0) + (isRifleWpn ? gRifleStab * 0.11 : 0));
    const maxHp = Math.round(cls.maxHp + vitalityLvl * 15 + warBannerStacks * 24 + tFlow * 12 + wGrip * 18 + vampiricHarvestStacks * 15);
    const moveSpeed = +(cls.moveSpeed * weaponMoveMult * heroAgilityMult * perkMoveMult).toFixed(3);
    const damageBlock = Math.min(
      0.78,
      +(cls.damageBlock + wardLvl * 0.03 + wShield * 0.07 + gRico * 0.06 + tWard * 0.04).toFixed(4)
    );
    const blockChance = Math.min(0.65, (cls.blockChance || 0) + wShield * 0.08 + shieldThornsStacks * 0.05);
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

    const meleeReachMult = wpn.type === 'melee' ? 1 + wWhirl * 0.12 : 1.0;
    const range = +(wpn.range * (wpn.type === 'melee' ? 1 + runLevelsAbove * 0.04 : runWeaponAreaMult) * meleeReachMult).toFixed(3);
    const arcAngle = wpn.arcAngle
      ? Math.min(
          Math.PI * 1.45,
          +(wpn.arcAngle * (1 + runLevelsAbove * 0.03) * (1 + executionerStacks * 0.18)).toFixed(4)
        )
      : 0;

    const baseSplash = wpn.splashRadius || 0;
    const splashRadius =
      baseSplash > 0
        ? +(baseSplash * runWeaponAreaMult * (1 + mageArcaneStacks * 0.15)).toFixed(3)
        : 0;
    const armorPierce = Math.min(
      1,
      +(
        (wpn.armorPierce || 0) +
        (cls.id === 'warrior' ? wBlood * 0.05 : 0) +
        (isPistolWpn ? gPistolMast * 0.08 : 0) +
        (isRifleWpn ? gRifleCore * 0.07 : 0) +
        gExp * 0.10 +
        executionerStacks * 0.08
      ).toFixed(3)
    );

    const knockback = +(
      (wpn.knockback || 0) *
      (1 + runLevelsAbove * 0.05)
    ).toFixed(3);

    const pellets = (wpn.pellets || 1) + (wpn.isShotgun ? gunHeavyStacks * 2 : 0);
    const spreadReduce = Math.max(
      0.32,
      1 - (isSmgWpn ? gSmgFury * 0.20 : 0) - (isRifleWpn ? gRifleStab * 0.22 : 0)
    );
    const spread = +((wpn.spread ?? 0) * (wpn.isShotgun && gunHeavyStacks > 0 ? 1.08 : 1.0) * spreadReduce).toFixed(4);
    const pierce =
      (wpn.pierce || 1) +
      (isPistolWpn && gDead > 0 ? 1 : 0) +
      (isRifleWpn && gRifleStab >= 2 ? 1 : 0) +
      executionerStacks;
    const projectileSpeed = wpn.projectileSpeed ? +wpn.projectileSpeed.toFixed(2) : 0;
    const pickupRadius = +(3.8 * perkMoveMult).toFixed(3);
    const dashCooldownMult = Math.max(0.40, +(1 - rapidCadenceStacks * 0.20).toFixed(3));

    // Magazine & Reload metrics (Gunslinger) + Continuous Mana Pool & Regen (Mage)
    const usesMana = cls.id === 'mage' || wpn.type === 'magic';
    const mageElement = usesMana ? 'water' : null;
    const elemDef = mageElement ? MAGE_ELEMENTS[mageElement] : null;
    const baseMag = usesMana ? 0 : (wpn.magSize || 0);
    const magSize = baseMag > 0 ? baseMag + ammoPouchStacks * 3 - getPerkStacks(perks, 'ammo_pouch') : 0;
    const reloadSpeedMult = +(shopReloadMult * heroAgilityMult * perkReloadMult).toFixed(4);
    const reloadTime =
      baseMag > 0 && wpn.reloadTime
        ? Math.max(0.24, +(wpn.reloadTime / reloadSpeedMult).toFixed(3))
        : 0;
    const reloadPerShellTime =
      baseMag > 0 && wpn.reloadPerShellTime
        ? Math.max(0.12, +(wpn.reloadPerShellTime / reloadSpeedMult).toFixed(3))
        : 0;
    const moveSpread = +((wpn.moveSpread ?? wpn.spread ?? 0) * spreadReduce).toFixed(4);
    const focusSpread = +((wpn.focusSpread ?? wpn.spread ?? 0) * spreadReduce).toFixed(4);
    const focusTime = wpn.focusTime ?? 0;
    const pierceDecay = Array.isArray(wpn.pierceDecay) ? wpn.pierceDecay : null;

    const maxMana = usesMana
      ? Math.round((cls.maxMana || 120) + manaFlowLvl * 15 + tMana * 22)
      : 0;
    const manaRegen = usesMana
      ? +(
          (cls.manaRegen || 9.5) *
          (1 + manaFlowLvl * 0.20 + shopLevelsAbove * 0.03) +
          tMana * 1.4
        ).toFixed(2)
      : 0;
    const manaCostMult = Math.max(0.38, 1 - tMana * 0.08);
    const manaCost = usesMana ? +((wpn.manaCost || 8) * manaCostMult).toFixed(2) : 0;

    // Crit & Class Blessing parameters
    const critChance = Math.min(
      0.85,
      +(0.05 + critFangStacks * 0.15 + critChainStacks * 0.08 + tCrit * 0.10 + wBlood * 0.10 + wOrbit * 0.10 + gDead * 0.11).toFixed(4)
    );
    const critMult = +(1.80 + tCrit * 0.15 + wBlood * 0.15 + gDead * 0.16).toFixed(2);
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
      armorPierce,
      splashRadius: mageElement === 'water' ? +(splashRadius * 1.25).toFixed(3) : splashRadius,
      knockback: mageElement === 'air' ? +(knockback * 2.2).toFixed(3) : knockback,
      pellets,
      spread,
      pierce,
      projectileSpeed: mageElement === 'lightning' ? +(projectileSpeed * 1.32).toFixed(2) : projectileSpeed,
      pickupRadius,
      dashCooldownMult,
      magSize,
      reloadTime,
      reloadPerShellTime,
      reloadSpeedMult,
      moveSpread,
      focusSpread,
      focusTime,
      pierceDecay,
      clampToArenaBounds: Boolean(wpn.clampToArenaBounds),
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
      dashFireTrailStacks,
      shieldThornsStacks,
      critChainStacks,
      vampiricHarvestStacks,
      rapidCadenceStacks,
      frostShatterStacks,
      executionerStacks,
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

  function recordEndlessRun(killsCount, timeSec) {
    const k = clampInt(killsCount, 0, 9999999, 0);
    const t = clampInt(timeSec, 0, 9999999, 0);
    const prevKills = clampInt(state.bestEndlessKills, 0, 9999999, 0);
    const prevTime = clampInt(state.bestEndlessTimeSec, 0, 9999999, 0);
    const isNewBestKills = k > prevKills;
    const isNewBestTime = t > prevTime;
    if (isNewBestKills) state.bestEndlessKills = k;
    if (isNewBestTime) state.bestEndlessTimeSec = t;
    return {
      bestEndlessKills: state.bestEndlessKills,
      bestEndlessTimeSec: state.bestEndlessTimeSec,
      isNewBestKills,
      isNewBestTime,
      isNewRecord: isNewBestKills || isNewBestTime
    };
  }

  function rollLevelUpChoices(classOrWeapon, weaponRunLevelOrPerks = 1, currentPerksArg = {}, soulLevel = 2) {
    let activeClsId = state.selectedClass || 'warrior';
    let currentPerks = currentPerksArg;
    let resolvedSoulLevel = soulLevel;

    if (typeof classOrWeapon === 'string' && CLASSES[classOrWeapon]) {
      activeClsId = classOrWeapon;
      if (weaponRunLevelOrPerks && typeof weaponRunLevelOrPerks === 'object') {
        currentPerks = weaponRunLevelOrPerks;
        if (typeof currentPerksArg === 'number') {
          resolvedSoulLevel = currentPerksArg;
        }
      }
    } else if (classOrWeapon && typeof classOrWeapon === 'object' && classOrWeapon.classId) {
      activeClsId = classOrWeapon.classId;
    } else if (typeof classOrWeapon === 'string' && WEAPONS[classOrWeapon]) {
      activeClsId = WEAPONS[classOrWeapon].classId || activeClsId;
    }

    const availablePerks = [];
    const fallbackPerks = [];
    for (const perk of RUN_UPGRADES) {
      if (perk.onlyClass && perk.onlyClass !== activeClsId) continue;
      const maxS = perk.maxStacks || 3;
      const curS = getPerkStacks(currentPerks, perk.id);
      if (curS < maxS) {
        availablePerks.push(perk);
      } else {
        fallbackPerks.push(perk);
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
    shuffle(availablePerks);
    shuffle(fallbackPerks);

    const pool = [...availablePerks, ...fallbackPerks];
    const choices = [];
    for (let i = 0; i < 3 && i < pool.length; i++) {
      const perk = pool[i];
      const curStacks = getPerkStacks(currentPerks, perk.id);
      const maxStacks = perk.maxStacks || 3;
      choices.push({
        id: perk.id,
        nextRank: curStacks + 1,
        currentStacks: curStacks,
        maxStacks,
        soulLevel: resolvedSoulLevel,
        nameRu: perk.nameRu,
        categoryRu: perk.categoryRu || 'БЛАГОСЛОВЕНИЕ',
        statBadgeRu: perk.statBadgeRu || '',
        theme: perk.theme || 'amber',
        descRu: perk.descRu,
        icon: perk.icon,
        iconKind: perk.iconKind || 'flame',
        isWeaponLevelUp: false
      });
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
      starterChosen: true,
      activeElement: 'water',
      unlockedElements: { water: true },
      nextUnlockCost: null
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

  function ensureDailyQuests(dateKey = getTodayDateKey()) {
    const targetDate = typeof dateKey === 'string' && DAILY_QUEST_DATE_RE.test(dateKey)
      ? dateKey
      : getTodayDateKey();
    const needsReset =
      state.dailyQuestsDate !== targetDate ||
      !Array.isArray(state.dailyQuests) ||
      state.dailyQuests.length !== 3;
    if (needsReset) {
      state.dailyQuestsDate = targetDate;
      state.dailyQuests = buildDailyQuestsForDate(targetDate);
    }
    return {
      date: state.dailyQuestsDate,
      quests: state.dailyQuests.map((q) => ({ ...q })),
      reset: needsReset
    };
  }

  function recordDailyProgress(kind, delta = 1) {
    ensureDailyQuests();
    const normKind = normalizeDailyQuestKind(kind);
    const inc = Math.max(0, Math.floor(Number(delta) || 0));
    if (!normKind || inc <= 0) return [];
    const newlyCompleted = [];
    for (let i = 0; i < state.dailyQuests.length; i++) {
      const q = state.dailyQuests[i];
      if (!q || q.kind !== normKind) continue;
      const before = q.progress;
      const next = Math.min(q.target, before + inc);
      if (next !== before) {
        q.progress = next;
        if (before < q.target && next >= q.target && !q.claimed) {
          newlyCompleted.push({ ...q });
        }
      }
    }
    return newlyCompleted;
  }

  function claimDailyQuest(id) {
    ensureDailyQuests();
    if (!id) return { ok: false, reason: 'not_found' };
    const quest = state.dailyQuests.find((q) => q && q.id === id);
    if (!quest) return { ok: false, reason: 'not_found' };
    if (quest.claimed) return { ok: false, reason: 'already_claimed', quest: { ...quest } };
    if (quest.progress < quest.target) {
      return { ok: false, reason: 'incomplete', quest: { ...quest } };
    }
    quest.claimed = true;
    addGold(quest.rewardGold);
    return {
      ok: true,
      id: quest.id,
      rewardGold: quest.rewardGold,
      gold: state.gold,
      quest: { ...quest }
    };
  }

  function completeOnboarding() {
    state.onboardingDone = true;
    return true;
  }

  function resetAllProgress() {
    state = createDefaultState(true);
    return cloneState();
  }

  if (initialSave) {
    loadState(initialSave);
  }
  ensureDailyQuests();

  return {
    getState,
    loadState,
    mergeCloudState: (localOrCloud, maybeCloud) =>
      maybeCloud !== undefined
        ? mergeCloudState(localOrCloud, maybeCloud)
        : mergeCloudState(cloneState(), localOrCloud),
    resetAllProgress,
    addGold,
    getRiftGold,
    addRiftGold,
    selectClass,
    ensureDailyQuests,
    recordDailyProgress,
    claimDailyQuest,
    completeOnboarding,
    getMageElementState,
    getMageElementUnlockCost,
    selectOrUnlockMageElement,
    isWeaponUnlocked,
    unlockWeapon,
    isBlueprintUnlocked,
    unlockBlueprint,
    canBuyWeaponInShop,
    buyWeaponInShop,
    hasAttemptedBossHammerStage,
    markBossHammerAttempted,
    getEquippedWeaponId,
    equipWeapon,
    getWeaponShopLevel,
    getWeaponUpgradeCost,
    upgradeWeaponInShop,
    getHeroUpgradeLevel,
    getHeroUpgradeCost,
    buyHeroUpgrade,
    unlockNextLevel,
    recordLevelStars,
    recordEndlessRun,
    setDifficultyMode,
    addHeroXp,
    getHeroXpToNext,
    getClassTalentRank,
    getClassTalentPointsSpent,
    getClassTalentPointsAvailable,
    canUpgradeClassTalent,
    upgradeClassTalent,
    resetClassTalents,
    getClassTalentTree: (cid) => CLASS_TALENT_TREES[cid] || MAGE_TALENT_TREE,
    getMageTalentRank,
    getMageTalentPointsSpent,
    getMageTalentPointsAvailable,
    canUpgradeMageTalent,
    upgradeMageTalent,
    resetMageTalents,
    getMageTalentTree: () => MAGE_TALENT_TREE,
    computeCombatStats,
    rollLevelUpChoices,
    getHeroUpgradeDefs: () => HERO_UPGRADE_DEFS,
    getWeaponMaxShopLevel: (weaponId) => (weaponId ? getWeaponMaxLevel(weaponId) : WEAPON_MAX_SHOP_LEVEL)
  };
}
