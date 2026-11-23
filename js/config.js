// Pure Soulslike Configuration («Охотники Мрака — Замок Пепла»):
// - Warrior Hero Class + 5 Melee Weapons (Oath Broadsword+Shield, Spear, Zweihander, War Cleaver Axe, Bonecrusher Hammer)
// - Castle of Ash Enemy Roster (Vanguard, Executioner, Acolyte, Judge of Ruins Boss)

export const ARENA_HALF_SIZE = 23;
export const WEAPON_MAX_LEVEL = 12;

export const CLASSES = {
  warrior: {
    id: 'warrior',
    nameRu: 'Воин Клятвы',
    nameEn: 'Oath Warrior',
    roleRu: 'Ближний бой • Стальной щит и клинок',
    roleEn: 'Melee • Iron Shield & Broadsword',
    descRu: 'Неудержимый латник с мечом и щитом. Парирует удары, держит стойку и сокрушает врагов в ближнем бою.',
    descEn: 'Armored knight with broadsword and shield.',
    maxHp: 145,
    moveSpeed: 4.4,
    damageBlock: 0.26,
    blockChance: 0.22,
    colorPrimary: 0x8b2635,
    colorSecondary: 0xc8ccd4,
    colorAccent: 0xf4b942,
    starterWeapon: 'club',
    weapons: ['club', 'spear', 'zweihander', 'axe', 'boss_hammer']
  }
};

// All 5 Warrior Melee Weapons preserved for in-world discovery & equipment
export const WEAPONS = {
  club: {
    id: 'club',
    classId: 'warrior',
    tier: 1,
    nameRu: 'Меч Клятвы',
    nameEn: 'Oath Broadsword',
    descRu: 'Клинок и щит рыцаря: сбалансированная скорость, блок и парирование.',
    type: 'melee',
    baseDamage: 15,
    cooldown: 0.67,
    range: 1.25,
    arcAngle: Math.PI * 0.56,
    knockback: 7.4,
    armorPierce: 0.15,
    splashRadius: 0,
    moveSpeedMult: 1.0,
    maxTargets: 1,
    color: 0xd97706
  },
  spear: {
    id: 'spear',
    classId: 'warrior',
    tier: 2,
    twoHanded: true,
    nameRu: 'Боевое Копьё',
    nameEn: 'Executioner Spear',
    descRu: 'Двуручное копьё с длинным выпадом и высоким пробитием брони.',
    type: 'melee',
    baseDamage: 15,
    cooldown: 0.75,
    range: 2.0,
    arcAngle: Math.PI * 0.34,
    knockback: 7.8,
    armorPierce: 0.30,
    splashRadius: 0,
    moveSpeedMult: 0.727273,
    maxTargets: 2,
    color: 0x38bdf8
  },
  zweihander: {
    id: 'zweihander',
    classId: 'warrior',
    tier: 3,
    twoHanded: true,
    nameRu: 'Цвайхандер',
    nameEn: 'Iron Zweihander',
    descRu: 'Гигантский двуручный меч с широкой дугой и тяжёлым ударом.',
    type: 'melee',
    baseDamage: 20,
    cooldown: 1.0,
    range: 1.8,
    arcAngle: Math.PI * 0.78,
    knockback: 9.2,
    armorPierce: 0.50,
    splashRadius: 1.65,
    moveSpeedMult: 0.636364,
    maxTargets: 2,
    disarmChance: 0.20,
    disarmDuration: 2.0,
    color: 0xcbd5e1
  },
  axe: {
    id: 'axe',
    classId: 'warrior',
    tier: 3,
    twoHanded: true,
    nameRu: 'Боевая Секира',
    nameEn: 'War Cleaver Axe',
    descRu: 'Тяжёлая двуручная секира с сокрушительным рассечением.',
    type: 'melee',
    baseDamage: 20,
    cooldown: 1.0,
    range: 1.5,
    arcAngle: Math.PI * 0.85,
    knockback: 10.6,
    armorPierce: 0.50,
    splashRadius: 1.5,
    moveSpeedMult: 0.60,
    maxTargets: 3,
    color: 0xef4444
  },
  boss_hammer: {
    id: 'boss_hammer',
    classId: 'warrior',
    tier: 4,
    twoHanded: true,
    nameRu: 'Молот Костолома',
    nameEn: 'Bonecrusher Hammer',
    descRu: 'Массивный боевой молот, ломающий стойку и доспехи.',
    type: 'melee',
    baseDamage: 35,
    cooldown: 1.1,
    range: 1.6,
    arcAngle: Math.PI * 1.05,
    knockback: 13.8,
    armorPierce: 0.60,
    splashRadius: 1.75,
    moveSpeedMult: 0.60,
    maxTargets: 3,
    stunChance: 0.25,
    stunDuration: 0.5,
    color: 0xf59e0b
  }
};

// Castle of Ash Enemy Archetypes
export const ENEMY_TYPES = {
  cursed_footman: {
    id: 'cursed_footman',
    nameRu: 'Щитоносец Нефа',
    roleHintRu: 'Тяжёлый щит и клинок',
    hp: 230,
    speed: 2.4,
    damage: 24,
    armor: 0.34,
    frontArmor: 0.45,
    xp: 45,
    gold: 0,
    scale: 1.12,
    color: 0x84cc16
  },
  iron_knight: {
    id: 'iron_knight',
    nameRu: 'Железный страж',
    roleHintRu: 'Тёмная латная броня • Дуэлянт',
    hp: 260,
    speed: 2.45,
    damage: 26,
    armor: 0.44,
    frontArmor: 0.30,
    canCharge: true,
    xp: 55,
    gold: 0,
    scale: 1.18,
    color: 0xd97706
  },
  bone_archer: {
    id: 'bone_archer',
    nameRu: 'Аколит Разлома',
    roleHintRu: 'Рунный арбалет • Дальняя атака',
    hp: 150,
    speed: 2.15,
    damage: 20,
    xp: 40,
    gold: 0,
    scale: 1.0,
    ranged: true,
    color: 0x38bdf8
  },
  boss_warden: {
    id: 'boss_warden',
    nameRu: 'Судия Руин',
    roleHintRu: 'Рыцарь Пепла • Босс Тронного Зала',
    isBoss: true,
    bossAct: 4,
    hp: 2150,
    speed: 3.25,
    damage: 34,
    armor: 0.40,
    xp: 220,
    gold: 0,
    scale: 2.18,
    color: 0xd97706
  }
};

export const SOULS_LEVEL_DEF = Object.freeze({
  level: 26,
  id: 'castle_of_ash',
  act: 1,
  roman: 'I',
  shortTitleRu: 'Замок Пепла',
  nameRu: 'Замок Пепла',
  nameEn: 'Castle of Ash',
  subtitleRu: 'Тёмная цитадель • Выносливость • Блок и парирование • Фляга Эстуса',
  biome: 'souls_citadel',
  isSoulslike: true,
  isStandaloneMode: true,
  recWeaponLevel: 1,
  targetKills: 5,
  enemyQuotas: null,
  finaleMiniBossType: null,
  bossSpawnTimerSec: 0,
  finaleBosses: ['boss_warden'],
  durationSec: 600,
  spawnInterval: 99,
  hpScale: 1.0,
  dmgScale: 1.0,
  enemyPool: ['cursed_footman', 'iron_knight', 'bone_archer'],
  miniBossPool: [],
  bossId: 'boss_warden',
  bossType: 'boss_warden',
  coBossId: null,
  unlockWeaponTier: null,
  hasBoss: true,
  hasEliteFinale: false
});

export const LEVELS = Object.freeze([SOULS_LEVEL_DEF]);

export function getLevelDef() {
  return SOULS_LEVEL_DEF;
}

export const RUN_UPGRADES = Object.freeze([]);
