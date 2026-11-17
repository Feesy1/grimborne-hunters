// Shared configuration, class definitions, weapon progression, 9-archetype enemy roster, and 25-level campaign
// All modules import from './config.js' and adhere strictly to these IDs and data shapes.

export const ARENA_HALF_SIZE = 27; // Spacious 3D gothic courtyard arena [-27, +27]
export const WEAPON_MAX_LEVEL = 12;

export const CLASSES = {
  warrior: {
    id: 'warrior',
    nameRu: 'Воин Клятвы',
    nameEn: 'Oath Warrior',
    roleRu: 'Ближний бой • Стальной щит и рассекающий клинок',
    roleEn: 'Melee • High HP & Shield Block',
    descRu: 'Неудержимый скелет-латник с мечом и щитом. Держит удар в самой гуще орды, отражает выпады и рубит нежить широкими дугами.',
    descEn: 'Armored skeleton bruiser with high health, shield block, and sweeping blade strikes.',
    portrait: './assets/ui/portrait_warrior.png',
    maxHp: 145,
    moveSpeed: 5.5,
    damageBlock: 0.26,
    blockChance: 0.22,
    colorPrimary: 0x8b2635,
    colorSecondary: 0xc8ccd4,
    colorAccent: 0xf4b942,
    starterWeapon: 'club',
    weapons: ['club', 'spear', 'zweihander', 'axe', 'boss_hammer'],
    beastNameRu: 'Железный Жнец',
    beastColor: 0xd9480f
  },
  gunslinger: {
    id: 'gunslinger',
    nameRu: 'Охотник-Стрелок',
    nameEn: 'Grim Gunslinger',
    roleRu: 'Стрелок • USP, Кольт, ПП, Дробовик, АК-47',
    roleEn: 'Gunslinger • USP, Colt, SMG, Shotgun & AK-47',
    descRu: 'Ловкий стрелок в капюшоне с тактическим пистолетом USP. Маневрирует на максимальной скорости, меняет стволы от Кольта до АК-47 и перезаряжает на бегу.',
    descEn: 'Swift hooded hunter starting with a Tactical USP pistol and unlocking Colt, SMG, Shotgun, and AK-47.',
    portrait: './assets/ui/portrait_gunslinger.png',
    maxHp: 110,
    moveSpeed: 6.16,
    damageBlock: 0.14,
    blockChance: 0.08,
    colorPrimary: 0x2b3a4a,
    colorSecondary: 0x6b4423,
    colorAccent: 0xe09f3e,
    starterWeapon: 'usp_pistol',
    weapons: ['usp_pistol', 'colt', 'smg', 'pistol', 'ak47'],
    beastNameRu: 'Гончая Пороха',
    beastColor: 0x3b82f6
  },
  mage: {
    id: 'mage',
    nameRu: 'Маг Воды',
    nameEn: 'Water Mage',
    roleRu: 'Владыка прилива • Живая водная сфера',
    roleEn: 'Tidecaller • Living Water Sphere',
    descRu: 'Заклинатель глубин с живым водяным скипетром. Непрерывно восстанавливает ману, замедляет врагов приливом и выпускает стремительные водные сферы со шлейфом брызг.',
    descEn: 'Spellcaster of the deep channeling regenerating mana into swirling water spheres.',
    portrait: './assets/ui/portrait_mage.png',
    maxHp: 92,
    moveSpeed: 5.32,
    maxMana: 120,
    manaRegen: 9.5,
    damageBlock: 0.05,
    blockChance: 0.0,
    colorPrimary: 0x0369a1,
    colorSecondary: 0x0c4a6e,
    colorAccent: 0x38bdf8,
    starterWeapon: 'spark_staff',
    weapons: ['spark_staff'],
    beastNameRu: 'Владыка Океана',
    beastColor: 0x0ea5e9
  }
};

// 4 Elemental Schools for Mage (1st Element chosen FREE on first play; remaining 3 unlock progressively!)
export const MAGE_ELEMENTS = {
  fire: {
    id: 'fire',
    nameRu: 'Огонь',
    nameEn: 'Fire',
    shortRu: 'Огонь',
    icon: '🔥',
    color: 0xff5722,
    coreColor: 0xfef08a,
    staffColor: 0xff6b35,
    staffEmissive: 0xea580c,
    descRu: 'Жар Пепла: накладывает мощное стакающееся горение (до 8 зарядов) и увеличивает урон мага по горящей цели на +12% за заряд.'
  },
  water: {
    id: 'water',
    nameRu: 'Вода',
    nameEn: 'Water',
    shortRu: 'Вода',
    icon: '💧',
    color: 0x0ea5e9,
    coreColor: 0xe0f2fe,
    staffColor: 0x38bdf8,
    staffEmissive: 0x0284c7,
    descRu: 'Контроль Воды: замедляет врагов на 42%, а с шансом 7% поднимает группу врагов в водяном шаре в воздух и с грохотом роняет на ×3 урона!'
  },
  lightning: {
    id: 'lightning',
    nameRu: 'Электричество',
    nameEn: 'Lightning',
    shortRu: 'Молния',
    icon: '⚡',
    color: 0x38bdf8,
    coreColor: 0xfef08a,
    staffColor: 0xfde047,
    staffEmissive: 0x06b6d4,
    descRu: 'Цепная Молния: стремительный разряд (+32% скорость), перескакивающий цепной молнией по соседним врагам с широким охватом.'
  },
  air: {
    id: 'air',
    nameRu: 'Сила Воздуха',
    nameEn: 'Air Force',
    shortRu: 'Воздух',
    icon: '🌪️',
    color: 0x5eead4,
    coreColor: 0xf8fafc,
    staffColor: 0x99f6e4,
    staffEmissive: 0x14b8a6,
    descRu: 'Порыв Ветра: лёгкий контроль отталкиванием, компактный вихревой сплэш вокруг цели и +8% к скорости шага мага.'
  }
};
export const MAGE_ELEMENT_ORDER = ['water'];
export const MAGE_ELEMENT_UNLOCK_COSTS = [0];

export const WEAPONS = {
  // === WARRIOR ===
  club: {
    id: 'club',
    classId: 'warrior',
    tier: 1,
    unlockLevel: 1,
    shopCost: 0,
    nameRu: 'Меч Клятвы',
    nameEn: 'Oath Broadsword',
    descRu: 'Базовый меч Воина: бег 5.5 м/с, атака 0.67 с (1.5 уд/с), дальность 1.25 м, пробитие брони 15%. Бьёт строго 1 цель без сплэша.',
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
    color: 0xd97706,
    upgradeBaseCost: 45
  },
  spear: {
    id: 'spear',
    classId: 'warrior',
    tier: 2,
    twoHanded: true,
    unlockLevel: 3,
    blueprintChestChance: 0.20,
    shopCost: 220,
    nameRu: 'Боевое Копьё',
    nameEn: 'Executioner Spear',
    descRu: 'Двуручное копьё на 2.0 м, задержка 0.75 с, бег 4.0 м/с. Пробивает до 2 врагов в линию: 1-я цель 100% / 30% проб., 2-я позади — 50% / 15% проб. Чертёж из сундуков III+ (20%).',
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
    color: 0x38bdf8,
    upgradeBaseCost: 85
  },
  zweihander: {
    id: 'zweihander',
    classId: 'warrior',
    tier: 3,
    twoHanded: true,
    unlockLevel: 8,
    shopCost: 340,
    nameRu: 'Цвайхандер',
    nameEn: 'Iron Zweihander',
    descRu: 'Двуручный гигантский меч: бег 3.5 м/с, атака 1.0 с, дальность 1.8 м, урон 20, 50% пробития брони, удар до 2 целей спереди и 20% шанс обезоружить врага на 2 с. Открывается после 7-го этапа.',
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
    color: 0xcbd5e1,
    upgradeBaseCost: 110
  },
  axe: {
    id: 'axe',
    classId: 'warrior',
    tier: 3,
    twoHanded: true,
    unlockLevel: 5,
    unlockRequiresBossStage: 5,
    shopCost: 420,
    nameRu: 'Боевая Секира',
    nameEn: 'War Cleaver Axe',
    descRu: 'Тяжёлый топор: скорость бега 3.3 м/с, задержка 1.0 с, дальность 1.5 м, 50% пробития брони и сплэш строго спереди до 3 целей по 100% урона! Открывается после босса 5-го этапа.',
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
    color: 0xef4444,
    upgradeBaseCost: 135
  },
  boss_hammer: {
    id: 'boss_hammer',
    classId: 'warrior',
    tier: 4,
    twoHanded: true,
    bossExclusive: true,
    bossDropChance: 0.10,
    bossDropMilestones: [5, 10, 15, 20, 25],
    shopCost: 0,
    nameRu: 'Молот Костолома',
    nameEn: 'Bonecrusher Hammer',
    descRu: 'Трофей босса (10% шанс за первое прохождение этапов 5, 10, 15, 20, 25): бег 3.3 м/с, атака 1.1 с, дальность 1.6 м, урон 35, 60% пробития. Бьёт до 3 целей спереди + 1 за спиной 1-й (все 100%), шанс 25% оглушить на 0.5 с.',
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
    color: 0xf59e0b,
    upgradeBaseCost: 185
  },

  // === GUNSLINGER (USP Starter -> Colt -> SMG -> Hunter Shotgun -> AK-47) ===
  usp_pistol: {
    id: 'usp_pistol',
    classId: 'gunslinger',
    tier: 1,
    unlockLevel: 1,
    shopCost: 0,
    nameRu: 'Тактический USP',
    nameEn: 'Tactical USP',
    descRu: 'Стартовый пистолет Стрелка на 15 патронов (перезарядка 2.0 с). Максимальная скорость бега, не пробивает цели насквозь, 15% пробития брони.',
    type: 'ranged',
    isShotgun: false,
    moveSpeedMult: 1.0,
    baseDamage: 20,
    cooldown: 0.42,
    range: 15.0,
    projectileSpeed: 24,
    pellets: 1,
    spread: 0.03,
    moveSpread: 0.04,
    focusSpread: 0.02,
    focusTime: 1.0,
    pierce: 1,
    armorPierce: 0.15,
    splashRadius: 0,
    knockback: 3.0,
    magSize: 15,
    reloadTime: 2.0,
    recoilKick: 0.9,
    color: 0xe2e8f0,
    upgradeBaseCost: 55
  },
  colt: {
    id: 'colt',
    classId: 'gunslinger',
    tier: 2,
    unlockLevel: 3,
    shopCost: 220,
    nameRu: 'Револьвер Кольт',
    nameEn: 'Colt Revolver',
    descRu: 'Тяжёлый Кольт на 7 патронов (перезарядка 3.5 с): высокая мощность, скорострельность вдвое ниже USP, пробивает до 3 врагов (100% / 50% / 25%).',
    type: 'ranged',
    isShotgun: false,
    moveSpeedMult: 1.0,
    baseDamage: 40,
    cooldown: 0.84,
    range: 15.0,
    projectileSpeed: 25,
    pellets: 1,
    spread: 0.03,
    moveSpread: 0.04,
    focusSpread: 0.02,
    focusTime: 1.0,
    pierce: 3,
    pierceDecay: [1.0, 0.5, 0.25],
    armorPierce: 0.28,
    splashRadius: 0,
    knockback: 4.8,
    magSize: 7,
    reloadTime: 3.5,
    recoilKick: 1.6,
    color: 0xfbbf24,
    upgradeBaseCost: 80
  },
  smg: {
    id: 'smg',
    classId: 'gunslinger',
    tier: 3,
    unlockLevel: 5,
    shopCost: 300,
    nameRu: 'Пистолет-пулемёт',
    nameEn: 'Darksteel SMG',
    descRu: 'ПП на 25 патронов (перезарядка 3.0 с): вдвое выше темп стрельбы, ниже урон, -20% бега, дальность -13%, разброс 40% в движении и ~10% через 2 с на месте.',
    type: 'ranged',
    isShotgun: false,
    moveSpeedMult: 0.80,
    baseDamage: 12,
    cooldown: 0.21,
    range: 13.0,
    projectileSpeed: 23,
    pellets: 1,
    spread: 0.10,
    moveSpread: 0.40,
    focusSpread: 0.10,
    focusTime: 2.0,
    pierce: 1,
    armorPierce: 0.20,
    splashRadius: 0,
    knockback: 1.8,
    magSize: 25,
    reloadTime: 3.0,
    recoilKick: 0.7,
    color: 0xf59e0b,
    upgradeBaseCost: 100
  },
  pistol: {
    id: 'pistol',
    classId: 'gunslinger',
    tier: 4,
    unlockLevel: 7,
    shopCost: 380,
    nameRu: 'Охотничье ружьё',
    nameEn: 'Hunter Pump Shotgun',
    descRu: 'Помповый дробовик на 8 патронов (4.0 с / дозарядка 0.5 с за патрон): 6 дробинок (на 10% меньше урона Кольта в упор), -40% бега, -50% дальности, разброс 80% → 10% за 2.5 с.',
    type: 'ranged',
    isShotgun: true,
    moveSpeedMult: 0.60,
    baseDamage: 6,
    cooldown: 0.78,
    range: 7.5,
    projectileSpeed: 19,
    pellets: 6,
    spread: 0.10,
    moveSpread: 0.80,
    focusSpread: 0.10,
    focusTime: 2.5,
    pierce: 1,
    armorPierce: 0.25,
    splashRadius: 0,
    knockback: 6.5,
    magSize: 8,
    reloadTime: 4.0,
    reloadPerShellTime: 0.5,
    recoilKick: 2.4,
    color: 0xfbbf24,
    upgradeBaseCost: 120
  },
  ak47: {
    id: 'ak47',
    classId: 'gunslinger',
    tier: 5,
    unlockLevel: 11,
    shopCost: 480,
    nameRu: 'АК-47',
    nameEn: 'Assault Rifle AK-47',
    descRu: 'Автомат на 35 патронов (перезарядка 2.0 с): урон выше ПП, темп на 20% ниже ПП, -30% бега, пробивает 2 цели и стреляет на всю карту в пределах арены.',
    type: 'ranged',
    isShotgun: false,
    moveSpeedMult: 0.70,
    baseDamage: 18,
    cooldown: 0.2625,
    range: 54.0,
    clampToArenaBounds: true,
    projectileSpeed: 27,
    pellets: 1,
    spread: 0.08,
    moveSpread: 0.14,
    focusSpread: 0.05,
    focusTime: 1.5,
    pierce: 2,
    armorPierce: 0.36,
    splashRadius: 0,
    knockback: 2.8,
    magSize: 35,
    reloadTime: 2.0,
    recoilKick: 1.3,
    color: 0xef4444,
    upgradeBaseCost: 150
  },
  blunderbuss: {
    id: 'blunderbuss',
    classId: 'gunslinger',
    tier: 4,
    unlockLevel: 6,
    shopCost: 380,
    nameRu: 'Двуствольный мушкетон «Гром»',
    nameEn: 'Thunder Double-Barrel',
    descRu: 'Убойная двустволка на 2 гильзы: выплёвывает шквал из 11 картечин (28% пробития брони), сносящий отряд в упор.',
    type: 'ranged',
    isShotgun: true,
    baseDamage: 12,
    cooldown: 0.54,
    range: 12.0,
    projectileSpeed: 18.5,
    pellets: 11,
    spread: 0.50,
    pierce: 1,
    armorPierce: 0.28,
    splashRadius: 0,
    knockback: 10.8,
    magSize: 2,
    reloadTime: 2.25,
    recoilKick: 4.5,
    color: 0xf97316,
    upgradeBaseCost: 95
  },
  gatling: {
    id: 'gatling',
    classId: 'gunslinger',
    tier: 5,
    unlockLevel: 8,
    shopCost: 560,
    nameRu: 'Барабанный дробовик «Шквал»',
    nameEn: 'Tempest Drum Shotgun',
    descRu: 'Автоматическое ружьё с барабаном на 8 патронов и бронебойной картечью на вылет (36% пробития брони).',
    type: 'ranged',
    isShotgun: true,
    baseDamage: 14,
    cooldown: 0.36,
    range: 15.5,
    projectileSpeed: 21,
    pellets: 5,
    spread: 0.25,
    pierce: 2,
    armorPierce: 0.36,
    splashRadius: 0,
    knockback: 5.6,
    magSize: 8,
    reloadTime: 2.50,
    recoilKick: 1.9,
    color: 0x38bdf8,
    upgradeBaseCost: 145
  },

  // === MAGE (Single Pure Water Scepter — Upgradable up to Level 30, Continuous Mana Pool!) ===
  spark_staff: {
    id: 'spark_staff',
    classId: 'mage',
    tier: 1,
    maxLevel: 30,
    unlockLevel: 1,
    shopCost: 0,
    nameRu: 'Водяной скипетр',
    nameEn: 'Water Scepter',
    descRu: 'Выпускает живую водную сферу с вихревым шлейфом и 25% магического пробития брони. Расходует ману без перезарядки.',
    type: 'magic',
    baseDamage: 28,
    cooldown: 0.50,
    range: 16.5,
    projectileSpeed: 9.8,
    pellets: 1,
    spread: 0.02,
    pierce: 1,
    armorPierce: 0.25,
    splashRadius: 2.4,
    knockback: 3.0,
    magSize: 0,
    reloadTime: 0,
    manaCost: 7.5,
    recoilKick: 0.5,
    color: 0x38bdf8,
    upgradeBaseCost: 45
  }
};

// 16-Archetype Dark-Fantasy Villain Roster + 5 Milestone Act Bosses (matching ad09b7c9.jpg 1-to-1!)
export const ENEMY_TYPES = {
  // === 16 Regular & Specialist Dark-Fantasy Monsters ===
  ember_skeleton: {
    id: 'ember_skeleton',
    nameRu: 'Пылающий скелет',
    roleHintRu: 'Пылающее ядро в груди • Пехота мрака',
    hp: 76,
    speed: 2.94,
    damage: 13,
    xp: 10,
    gold: 3,
    scale: 0.94,
    color: 0xf97316
  },
  plague_zombie: {
    id: 'plague_zombie',
    nameRu: 'Чумной зомби',
    roleHintRu: 'Оживший мертвец • Натиск орды',
    hp: 84,
    speed: 2.85,
    damage: 14,
    xp: 12,
    gold: 4,
    scale: 1.0,
    color: 0x65a30d
  },
  goblin: {
    id: 'goblin',
    nameRu: 'Гоблин-налётчик',
    roleHintRu: 'Каменный топор • Стремительный рывок',
    hp: 62,
    speed: 4.55,
    damage: 12,
    xp: 12,
    gold: 4,
    scale: 0.84,
    canDash: true,
    color: 0x65a30d
  },
  werewolf: {
    id: 'werewolf',
    nameRu: 'Оборотень мрака',
    roleHintRu: 'Хищный прыжок и острые когти',
    hp: 94,
    speed: 4.78,
    damage: 16,
    xp: 16,
    gold: 6,
    scale: 0.98,
    canDash: true,
    dashMult: 1.85,
    color: 0xea580c
  },
  cursed_footman: {
    id: 'cursed_footman',
    nameRu: 'Проклятый латник',
    roleHintRu: 'Ржавый доспех и щит спереди',
    hp: 112,
    speed: 2.22,
    damage: 16,
    armor: 0.34,
    frontArmor: 0.45,
    xp: 18,
    gold: 7,
    scale: 1.04,
    color: 0x84cc16
  },
  iron_knight: {
    id: 'iron_knight',
    nameRu: 'Железный страж',
    roleHintRu: 'Тёмная латная броня • Таранный разбег',
    hp: 198,
    speed: 2.05,
    damage: 26,
    armor: 0.44,
    frontArmor: 0.30,
    canCharge: true,
    xp: 30,
    gold: 14,
    scale: 1.32,
    color: 0xd97706
  },
  dark_cultist: {
    id: 'dark_cultist',
    nameRu: 'Тёмный культист',
    roleHintRu: 'Посох черепа • Сфера тёмного пламени',
    hp: 72,
    speed: 2.38,
    damage: 16,
    ranged: true,
    projColor: 0xa855f7,
    keepDistance: 10.4,
    xp: 20,
    gold: 8,
    scale: 0.96,
    color: 0xa855f7
  },
  mummy: {
    id: 'mummy',
    nameRu: 'Древняя мумия',
    roleHintRu: 'Золотой серп • Призывает скелетов',
    hp: 82,
    speed: 2.24,
    damage: 15,
    summoner: true,
    keepDistance: 10.8,
    xp: 22,
    gold: 9,
    scale: 0.98,
    color: 0x22d3ee
  },
  dark_spider: {
    id: 'dark_spider',
    nameRu: 'Паук мрака',
    roleHintRu: 'Быстрый бросок восьмилапого ловца',
    hp: 58,
    speed: 4.42,
    damage: 13,
    canDash: true,
    dashMult: 1.55,
    xp: 14,
    gold: 5,
    scale: 0.92,
    color: 0xef4444
  },
  succubus: {
    id: 'succubus',
    nameRu: 'Суккуб мрака',
    roleHintRu: 'Крылатая демонесса • Залп тёмного очарования',
    hp: 76,
    speed: 3.12,
    damage: 16,
    ranged: true,
    projColor: 0xec4899,
    keepDistance: 9.8,
    xp: 20,
    gold: 9,
    scale: 1.0,
    color: 0xd946ef
  },
  toxic_slime: {
    id: 'toxic_slime',
    nameRu: 'Кислотная слизь',
    roleHintRu: 'Взрыв ядовитой лужи после гибели',
    hp: 52,
    speed: 3.72,
    damage: 22,
    explodesOnDeath: true,
    hazardColor: 0x22c55e,
    xp: 16,
    gold: 6,
    scale: 0.92,
    color: 0x22c55e
  },
  gargoyle: {
    id: 'gargoyle',
    nameRu: 'Каменная гаргулья',
    roleHintRu: 'Крылатый камень • Стремительный налёт',
    hp: 104,
    speed: 3.65,
    damage: 17,
    frontArmor: 0.25,
    canDash: true,
    xp: 18,
    gold: 7,
    scale: 0.96,
    color: 0x94a3b8
  },
  hell_imp: {
    id: 'hell_imp',
    nameRu: 'Бес преисподней',
    roleHintRu: 'Крылатый бес • Огненный выпад',
    hp: 64,
    speed: 4.48,
    damage: 15,
    canDash: true,
    xp: 15,
    gold: 6,
    scale: 0.84,
    color: 0xdc2626
  },
  phantom_ghost: {
    id: 'phantom_ghost',
    nameRu: 'Блуждающий призрак',
    roleHintRu: 'Неупокоенный дух • Скользит над землёй',
    hp: 68,
    speed: 3.45,
    damage: 15,
    xp: 15,
    gold: 6,
    scale: 0.94,
    color: 0xe2e8f0
  },
  vampire_lord: {
    id: 'vampire_lord',
    nameRu: 'Граф Дракула',
    roleHintRu: 'Повелитель ночи • Удар плащом и стая мышей',
    hp: 90,
    speed: 2.85,
    damage: 18,
    armor: 0.18,
    ranged: false,
    canSummonBats: true,
    cloakMelee: true,
    xp: 22,
    gold: 10,
    scale: 1.0,
    color: 0xe11d48
  },
  vampire_bat: {
    id: 'vampire_bat',
    nameRu: 'Летучая мышь',
    roleHintRu: 'Крылатый приспешник • Быстрый укус',
    hp: 18,
    speed: 5.2,
    damage: 8,
    isBat: true,
    xp: 5,
    gold: 2,
    scale: 0.9,
    color: 0xe11d48
  },
  mimic_chest: {
    id: 'mimic_chest',
    nameRu: 'Зубастый мимик',
    roleHintRu: 'Коварный сундук • Прыгает и клацает клыками',
    hp: 145,
    speed: 3.15,
    damage: 22,
    armor: 0.25,
    canHop: true,
    xp: 28,
    gold: 22,
    scale: 1.0,
    color: 0xc084fc
  },
  corrupted_treant: {
    id: 'corrupted_treant',
    nameRu: 'Гнилой древень',
    roleHintRu: 'Прыгающее древо • Наскок из чащи',
    hp: 195,
    speed: 2.45,
    damage: 25,
    armor: 0.24,
    canCharge: false,
    xp: 32,
    gold: 15,
    scale: 1.34,
    color: 0xf97316
  },
  shadow_wisp: {
    id: 'shadow_wisp',
    nameRu: 'Теневой дух',
    roleHintRu: 'Чёрное пламя • Стремительный рывок тени',
    hp: 62,
    speed: 4.18,
    damage: 16,
    canDash: true,
    xp: 16,
    gold: 6,
    scale: 0.92,
    color: 0xf59e0b
  },

  // === Legacy Archetype Aliases (100% Backwards-Compatible!) ===
  skeleton: {
    id: 'skeleton',
    nameRu: 'Пылающий скелет',
    roleHintRu: 'Пылающее ядро в груди • Пехота мрака',
    hp: 76,
    speed: 2.94,
    damage: 13,
    xp: 10,
    gold: 3,
    scale: 0.94,
    color: 0xf97316
  },
  hound: {
    id: 'hound',
    nameRu: 'Гоблин-налётчик',
    roleHintRu: 'Каменный топор • Стремительный рывок',
    hp: 62,
    speed: 4.55,
    damage: 12,
    xp: 12,
    gold: 4,
    scale: 0.84,
    canDash: true,
    color: 0x65a30d
  },
  archer: {
    id: 'archer',
    nameRu: 'Граф-вампир',
    roleHintRu: 'Аристократ ночи • Кровавые сгустки',
    hp: 78,
    speed: 2.72,
    damage: 16,
    ranged: true,
    projColor: 0xe11d48,
    keepDistance: 9.8,
    xp: 18,
    gold: 7,
    scale: 0.95,
    color: 0xe11d48
  },
  shieldbearer: {
    id: 'shieldbearer',
    nameRu: 'Проклятый латник',
    roleHintRu: 'Ржавый доспех и щит спереди',
    hp: 112,
    speed: 2.22,
    damage: 16,
    frontArmor: 0.45,
    xp: 18,
    gold: 7,
    scale: 1.04,
    color: 0x84cc16
  },
  bomber: {
    id: 'bomber',
    nameRu: 'Кислотная слизь',
    roleHintRu: 'Взрыв ядовитой лужи после гибели',
    hp: 52,
    speed: 3.72,
    damage: 22,
    explodesOnDeath: true,
    hazardColor: 0x22c55e,
    xp: 16,
    gold: 6,
    scale: 0.92,
    color: 0x22c55e
  },
  necromancer: {
    id: 'necromancer',
    nameRu: 'Древняя мумия',
    roleHintRu: 'Золотой серп • Призывает скелетов',
    hp: 82,
    speed: 2.24,
    damage: 15,
    summoner: true,
    keepDistance: 10.8,
    xp: 22,
    gold: 9,
    scale: 0.98,
    color: 0x22d3ee
  },
  cultist: {
    id: 'cultist',
    nameRu: 'Тёмный культист',
    roleHintRu: 'Посох черепа • Сфера тёмного пламени',
    hp: 72,
    speed: 2.38,
    damage: 16,
    ranged: true,
    projColor: 0xa855f7,
    keepDistance: 10.4,
    xp: 20,
    gold: 8,
    scale: 0.96,
    color: 0xa855f7
  },
  brute: {
    id: 'brute',
    nameRu: 'Железный страж',
    roleHintRu: 'Тёмная латная броня • Таранный разбег',
    hp: 198,
    speed: 2.05,
    damage: 26,
    frontArmor: 0.30,
    canCharge: true,
    xp: 30,
    gold: 14,
    scale: 1.32,
    color: 0xd97706
  },

  // === 5 DISTINCT ACT BOSSES (Appear on 5, 10, 15, 20, 25 -> then return as Mini-Bosses in later Acts!) ===
  boss_butcher: {
    id: 'boss_butcher',
    nameRu: 'Демон Преисподней',
    roleHintRu: 'Босс I Акта • Прыжок и клинок магмы',
    isBoss: true,
    bossAct: 1,
    hp: 920,
    speed: 3.43,
    damage: 26,
    xp: 120,
    gold: 95,
    scale: 1.85,
    color: 0xea580c
  },
  boss_archlich: {
    id: 'boss_archlich',
    nameRu: 'Король-Лич Тёмного Пламени',
    roleHintRu: 'Босс II Акта • Спираль пламени и призыв',
    isBoss: true,
    bossAct: 2,
    hp: 1380,
    speed: 3.05,
    damage: 30,
    armor: 0.22,
    xp: 150,
    gold: 125,
    scale: 1.96,
    color: 0xa855f7
  },
  boss_cthulhu: {
    id: 'boss_cthulhu',
    nameRu: 'Вестник Бездны',
    roleHintRu: 'Босс III Акта • Натиск щупалец и сфера Бездны',
    isBoss: true,
    bossAct: 3,
    hp: 1750,
    speed: 3.12,
    damage: 32,
    armor: 0.34,
    xp: 180,
    gold: 155,
    scale: 2.05,
    color: 0x06b6d4
  },
  boss_troll: {
    id: 'boss_troll',
    nameRu: 'Тролль-Костолом',
    roleHintRu: 'Босс с боевым молотом • Вихрь джаггернаута',
    isBoss: true,
    bossAct: 1,
    hp: 1120,
    speed: 3.12,
    damage: 26,
    armor: 0.36,
    xp: 160,
    gold: 135,
    scale: 2.15,
    color: 0xd97706
  },
  boss_warden: {
    id: 'boss_warden',
    nameRu: 'Тролль-Костолом',
    roleHintRu: 'Босс с боевым молотом • Вихрь джаггернаута',
    isBoss: true,
    bossAct: 4,
    hp: 2150,
    speed: 3.25,
    damage: 34,
    armor: 0.40,
    xp: 220,
    gold: 190,
    scale: 2.18,
    color: 0xd97706
  },
  boss_ashlord: {
    id: 'boss_ashlord',
    nameRu: 'Пепельный Дракон',
    roleHintRu: 'Финальный Ультра-Босс • Крылатый Дракон Пепла',
    isBoss: true,
    bossAct: 5,
    hp: 3100,
    speed: 3.64,
    damage: 40,
    armor: 0.44,
    xp: 350,
    gold: 320,
    scale: 2.42,
    color: 0xef4444
  },
  reaper: {
    id: 'reaper',
    nameRu: 'Вестник Бездны',
    roleHintRu: 'Босс III Акта • Натиск щупалец и сфера Бездны',
    isBoss: true,
    bossAct: 3,
    hp: 1750,
    speed: 3.12,
    damage: 32,
    xp: 180,
    gold: 155,
    scale: 2.05,
    color: 0x06b6d4
  }
};

// 25-Chapter Dark-Fantasy Campaign (5 Acts × 5 Chapters, Bosses on 5, 10, 15, 20, 25!)
// Chapters 1–10: Classic Gothic Courtyard | Chapters 11–25: Enchanted Misty Ruined Forest («Туманный Лес»)
const CHAPTER_METADATA = [
  // ACT I: Погост Проклятых (Levels 1-5 — Двор Цитадели)
  ['Окраина Погоста', 'Первая вылазка у железных врат: одолей отряд из 10 чумных зомби и их вожака.', 'stage_1.jpg', ['plague_zombie']],
  ['Ядовитый Прорыв', 'К 10 чумным зомби присоединяются 5 ядовитых слизняков — берегись кислотных всплесков.', 'stage_2.jpg', ['plague_zombie', 'toxic_slime']],
  ['Роща Проклятых Древней', 'На 3-м этапе наступают 10 зомби, 10 слизняков и 10 гнилых древней; в сундуках открывается шанс найти чертёж Копья (20%).', 'stage_2.jpg', ['plague_zombie', 'toxic_slime', 'corrupted_treant']],
  ['Караул Гаргулий', 'С башен срываются каменные гаргульи, а впереди строятся проклятые латники.', 'stage_3.jpg', ['ember_skeleton', 'cursed_footman', 'phantom_ghost', 'gargoyle']],
  ['Врата Погоста', 'Конец I Акта: сразись с Троллем-Костоломом! Победа откроет Боевую Секиру в Магазине и даст 10% шанс выбить его Молот!', 'stage_5.jpg', ['plague_zombie', 'corrupted_treant', 'vampire_lord', 'dark_spider', 'succubus']],

  // ACT II: Осквернённый Лагерь (Levels 6-10 — Двор Цитадели)
  ['Пески Проклятых', 'Древние мумии поднимают пылающих скелетов из-под камней — устраняй жрецов первыми.', 'stage_4.jpg', ['ember_skeleton', 'cursed_footman', 'mummy', 'phantom_ghost']],
  ['Склеп Культистов', 'Найди легендарный Рунный Сундук с оружием III ранга под обстрелом тёмных культистов!', 'stage_4.jpg', ['goblin', 'cursed_footman', 'dark_cultist', 'mimic_chest', 'gargoyle']],
  ['Волчья Охота', 'Стремительные оборотни мрака и крылатые бесы атакуют со всех флангов двора.', 'stage_2.jpg', ['werewolf', 'hell_imp', 'toxic_slime', 'vampire_lord']],
  ['Железный Заслон', 'Тяжёлые железные стражи идут на таран сквозь ряды проклятых латников.', 'stage_1.jpg', ['cursed_footman', 'dark_cultist', 'gargoyle', 'iron_knight']],
  ['Трон Тёмного Пламени', 'Конец II Акта: одолей Короля-Лича и свирепого Тролля-Костолома с боевым молотом!', 'stage_5.jpg', ['plague_zombie', 'corrupted_treant', 'dark_spider', 'succubus', 'vampire_lord']],

  // ACT III: Туманный Лес (Levels 11-15 — Новая Карта «Туманный Лес»!)
  ['Тропа Туманного Леса', 'Добро пожаловать в Туманный Лес: среди мшистых руин рыщут пауки мрака, оборотни и гнилые древни!', 'stage_3.jpg', ['dark_spider', 'werewolf', 'phantom_ghost', 'corrupted_treant']],
  ['Мшистые Арки', 'Из лилового тумана скользят теневые духи и ядовитая слизь под залпами культистов.', 'stage_3.jpg', ['dark_spider', 'shadow_wisp', 'dark_cultist', 'toxic_slime']],
  ['Чаща Древней', 'Вековые гнилые древни идут напролом среди паучьих гнёзд и зубастых мимиков.', 'stage_2.jpg', ['werewolf', 'dark_spider', 'mimic_chest', 'corrupted_treant', 'vampire_lord']],
  ['Забытое Святилище', 'У ступеней лесного алтаря мумии и культисты плетут чары под охраной древней.', 'stage_4.jpg', ['shadow_wisp', 'phantom_ghost', 'mummy', 'dark_cultist', 'corrupted_treant']],
  ['Алтарь Вестника Бездны', 'Конец III Акта: сразись с древним титаном — Вестником Бездны в сердце Туманного Леса!', 'stage_5.jpg', ['dark_spider', 'shadow_wisp', 'werewolf', 'dark_cultist', 'corrupted_treant']],

  // ACT IV: Курганы Костоломов (Levels 16-20 — Карта «Туманный Лес»)
  ['Застава Налётчиков', 'Орочьи отряды гоблинов, оборотней и железных стражей окружают лесные руины.', 'stage_1.jpg', ['goblin', 'werewolf', 'cursed_footman', 'gargoyle', 'iron_knight']],
  ['Трясина Мимиков', 'Кислотная слизь, пауки мрака и тяжёлые древни проверяют закалку твоего оружия.', 'stage_1.jpg', ['dark_spider', 'toxic_slime', 'mimic_chest', 'iron_knight', 'corrupted_treant']],
  ['Ковен Полуночи', 'Графы-вампиры, теневые духи и культисты заливают мшистые плиты тёмной магией.', 'stage_4.jpg', ['shadow_wisp', 'vampire_lord', 'mummy', 'dark_cultist', 'gargoyle']],
  ['Гнев Древнего Леса', 'Безостановочный штурм оборотней, крылатых бесов и бронированных стражей.', 'stage_3.jpg', ['werewolf', 'hell_imp', 'cursed_footman', 'iron_knight', 'corrupted_treant']],
  ['Курган Огра-Костолома', 'Конец IV Акта: выдержи сокрушительные удары молота исполинского Огра-Костолома!', 'stage_5.jpg', ['goblin', 'werewolf', 'iron_knight', 'dark_cultist', 'gargoyle']],

  // ACT V: Гнездо Пепельного Дракона (Levels 21-25 — Карта «Туманный Лес»)
  ['Дыхание Вулкана', 'Лесной туман багровеет от пепла: бесы преисподней и теневые духи идут в атаку.', 'stage_5.jpg', ['ember_skeleton', 'hell_imp', 'shadow_wisp', 'vampire_lord', 'dark_cultist']],
  ['Каменный Бастион', 'Железные стражи, гаргульи и гнилые древни смыкают кольцо вокруг охотника.', 'stage_1.jpg', ['gargoyle', 'hell_imp', 'toxic_slime', 'iron_knight', 'corrupted_treant']],
  ['Ночь Кровавой Охоты', 'Элитные стаи оборотней, вампиров, пауков и мимиков рвутся со всех сторон.', 'stage_2.jpg', ['werewolf', 'dark_spider', 'mummy', 'mimic_chest', 'vampire_lord', 'iron_knight']],
  ['Преддверие Дракона', 'Предпоследний рубеж: испытание предельной мощи твоего героя перед финальной битвой.', 'stage_4.jpg', ['ember_skeleton', 'hell_imp', 'shadow_wisp', 'dark_cultist', 'iron_knight', 'corrupted_treant']],
  ['Престол Пепельного Дракона', 'Финал кампании (Глава 25): сокруши крылатого Пепельного Дракона и очисти земли навсегда!', 'stage_5.jpg', ['ember_skeleton', 'hell_imp', 'gargoyle', 'dark_cultist', 'vampire_lord', 'iron_knight']]
];

const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV'
];

const ACT_BOSS_ORDER = ['boss_troll', 'boss_archlich', 'boss_cthulhu', 'boss_troll', 'boss_ashlord'];

// Progressive 1-new-unit-per-stage ladder: previewed as Mini-Boss on Stage N, graduates into Horde on Stage N+1
const CUMULATIVE_ENEMY_LADDER = [
  'plague_zombie',
  'toxic_slime',
  'corrupted_treant',
  'mimic_chest',
  'vampire_lord',
  'dark_spider',
  'cursed_footman',
  'dark_cultist',
  'ember_skeleton',
  'iron_knight',
  'succubus',
  'werewolf',
  'goblin',
  'gargoyle',
  'mummy',
  'phantom_ghost',
  'hell_imp'
];

export const LEVELS = CHAPTER_METADATA.map(([titleRu, subRu, bannerFile, _pool], idx) => {
  const lvl = idx + 1;
  const act = Math.ceil(lvl / 5);
  const isBossLevel = lvl % 5 === 0;
  const finaleBosses =
    lvl === 5
      ? ['boss_troll']
      : lvl === 10
        ? ['boss_troll', 'boss_archlich']
        : lvl === 15
          ? ['boss_troll', 'boss_troll', 'boss_archlich']
          : lvl === 20
            ? ['boss_troll', 'boss_troll', 'boss_archlich', 'boss_archlich']
            : lvl === 25
              ? ['boss_ashlord', 'boss_troll']
              : [];
  const bossId = finaleBosses[0] || null;
  const coBossId = finaleBosses.length > 1 ? finaleBosses[1] : null;
  const pool = CUMULATIVE_ENEMY_LADDER.slice(0, Math.min(CUMULATIVE_ENEMY_LADDER.length, lvl));
  const finaleMiniBossType = CUMULATIVE_ENEMY_LADDER[Math.min(CUMULATIVE_ENEMY_LADDER.length - 1, lvl)];
  const enemyQuotas =
    lvl === 1
      ? { plague_zombie: 10 }
      : lvl === 2
        ? { plague_zombie: 10, toxic_slime: 5 }
        : lvl === 3
          ? { plague_zombie: 10, toxic_slime: 10, corrupted_treant: 10 }
          : null;
  // Capped smooth progression (10 -> 15 -> 30 -> 32..42 max, never exploding to 60–500 enemies!)
  const targetKills =
    lvl === 1 ? 10 : lvl === 2 ? 15 : lvl === 3 ? 30 : Math.min(42, 30 + (lvl - 3) * 2);
  const miniBossPool = finaleMiniBossType ? [finaleMiniBossType] : [];
  const bossSpawnTimerSec = isBossLevel ? Math.min(65, 40 + act * 5) : 0;
  const recWeaponLevel = Math.min(WEAPON_MAX_LEVEL, Math.max(1, Math.ceil(lvl * 0.48)));
  return {
    level: lvl,
    act,
    roman: ROMAN[idx],
    shortTitleRu: titleRu,
    nameRu: `Глава ${ROMAN[idx]}: ${titleRu}`,
    nameEn: `Chapter ${ROMAN[idx]}`,
    subtitleRu: subRu,
    bannerImg: `./assets/ui/${bannerFile}`,
    recWeaponLevel,
    targetKills,
    enemyQuotas,
    finaleMiniBossType,
    bossSpawnTimerSec,
    finaleBosses,
    durationSec: Math.min(115, 62 + lvl * 2),
    spawnInterval: +(Math.max(0.46, 1.08 - lvl * 0.024)).toFixed(3),
    hpScale: +(1 + (lvl - 1) * 0.14 + Math.pow(Math.max(0, lvl - 1), 1.15) * 0.028).toFixed(2),
    dmgScale: +(1 + (lvl - 1) * 0.055).toFixed(2),
    enemyPool: pool,
    miniBossPool,
    bossId,
    coBossId,
    unlockWeaponTier: lvl === 3 ? 2 : lvl === 7 ? 3 : null,
    hasBoss: isBossLevel,
    hasEliteFinale: !isBossLevel
  };
});

// Distinct Class-Specific Blessings of Souls (Unique active mechanics per Hero Class!)
export const RUN_UPGRADES = [
  // =========================================================================
  // 🔮 ПЕПЕЛЬНЫЙ МАГ (6 Уникальных Магических Благословений)
  // =========================================================================
  {
    id: 'mage_arcane_surge',
    onlyClass: 'mage',
    nameRu: 'Тайное Могущество',
    categoryRu: 'ЧАРЫ ПОСОХА',
    statBadgeRu: '+20% МАГ. УРОН • +15% ОБЛАСТЬ ЧАР',
    descRu: 'Наполняет кристалл посоха эфиром: +20% к магическому урону заклинаний и +15% к радиусу стихийного взрыва.',
    theme: 'violet',
    maxStacks: 3,
    icon: '🔮'
  },
  {
    id: 'mage_twin_cast',
    onlyClass: 'mage',
    nameRu: 'Раздвоение Кометы',
    categoryRu: 'ВЫСШАЯ МАГИЯ',
    statBadgeRu: '40% ШАНС ДВОЙНОГО ЗАЛПА БЕЗ МАНЫ',
    descRu: 'При каждом взмахе посоха с шансом 40% (до 100%) бесплатно выпускает второй стихийный снаряд под углом.',
    theme: 'cyan',
    maxStacks: 3,
    icon: '✨'
  },
  {
    id: 'mage_elem_catalyst',
    onlyClass: 'mage',
    nameRu: 'Резонанс Стихии',
    categoryRu: 'ВЛАСТЬ СТИХИЙ',
    statBadgeRu: 'СВЕРХУСИЛЕНИЕ АКТИВНОЙ СТИХИИ',
    descRu: 'Огонь: +1 доп. стак напалма за удар. Вода: +5% к шансу Водяной Сферы. Молния: +1 цель цепи. Воздух: вихрь режет врагов.',
    theme: 'ice',
    maxStacks: 3,
    icon: '🌀'
  },
  {
    id: 'mage_meteor_shower',
    onlyClass: 'mage',
    nameRu: 'Звездопад Архонта',
    categoryRu: 'КАТАКЛИЗМ',
    statBadgeRu: 'МЕТЕОР С НЕБЕС КАЖДЫЕ 4.2 СЕК',
    descRu: 'Каждые 4.2 секунды с небес на гущу врагов обрушивается стихийный метеор, взрывая брусчатку в радиусе 3.8м.',
    theme: 'flame',
    maxStacks: 3,
    icon: '☄️'
  },
  {
    id: 'mage_arcane_ward',
    onlyClass: 'mage',
    nameRu: 'Сфера Отражения',
    categoryRu: 'ОБЕРЕГ МАГА',
    statBadgeRu: 'ЩИТ ЧАР ПОГЛОЩАЕТ УДАР И ВЗРЫВАЕТСЯ',
    descRu: 'Раз в 8 секунд окутывает мага рунным куполом: при ударе блокирует 65% урона и отбрасывает врагов взрывом магии.',
    theme: 'violet',
    maxStacks: 3,
    icon: '🛡️'
  },
  {
    id: 'mage_mana_font',
    onlyClass: 'mage',
    nameRu: 'Астральный Колодец',
    categoryRu: 'ПОТОК МАНЫ',
    statBadgeRu: '-18% ТРАТА МАНЫ • ВОЛНА ЧАР КАЖДЫЙ 6-Й КАСТ',
    descRu: 'Снижает стоимость заклинаний на 18%, а каждый 6-й выстрел выпускает кольцо чар вокруг мага и возвращает +16 маны.',
    theme: 'emerald',
    maxStacks: 3,
    icon: '💧'
  },

  // =========================================================================
  // 🔫 ОХОТНИК-СТРЕЛОК (6 Уникальных Оружейных Благословений)
  // =========================================================================
  {
    id: 'gun_heavy_buckshot',
    onlyClass: 'gunslinger',
    nameRu: 'Вольфрамовая Картечь',
    categoryRu: 'ОРУЖЕЙНИК',
    statBadgeRu: '+2 ДРОБИНЫ В ЗАЛПЕ • +14% УРОН СТВОЛА',
    descRu: 'Заряжает гильзы тяжёлой сечкой: каждый выстрел выпускает на +2 раскалённые дробины больше и бьёт на 14% сильнее.',
    theme: 'amber',
    maxStacks: 3,
    icon: '💥'
  },
  {
    id: 'gun_ricochet',
    onlyClass: 'gunslinger',
    nameRu: 'Рикошет Свинца',
    categoryRu: 'МЕТКИЙ СТРЕЛОК',
    statBadgeRu: '50% ШАНС ОТСКОКА ДРОБИ В СОСЕДА',
    descRu: 'Попавшие картечины с шансом 50% (до 100%) с искрами рикошетят от костей в ближайшего соседнего врага на 65% урона.',
    theme: 'cyan',
    maxStacks: 3,
    icon: '⚡'
  },
  {
    id: 'gun_explosive_slugs',
    onlyClass: 'gunslinger',
    nameRu: 'Пороховая Детонация',
    categoryRu: 'ЧЁРНЫЙ ПОРОХ',
    statBadgeRu: 'КАЖДЫЙ 3-Й ВЫСТРЕЛ — РАЗРЫВНОЙ ЗАЛП',
    descRu: 'Каждый 3-й выстрел из дробовика взрывается при попадании огненными осколками по площади (+40% урона).',
    theme: 'flame',
    maxStacks: 3,
    icon: '🧨'
  },
  {
    id: 'gun_tactical_reload',
    onlyClass: 'gunslinger',
    nameRu: 'Пороховой Рывок',
    categoryRu: 'ТАКТИКА ОХОТНИКА',
    statBadgeRu: '+28% ПЕРЕЗАРЯДКА • ВОЛНА И СПРИНТ',
    descRu: 'Ускоряет перезарядку на 28%. Начало перезарядки отбрасывает наседающих тварей взрывом и ускоряет бег на +35%.',
    theme: 'emerald',
    maxStacks: 3,
    icon: '💨'
  },
  {
    id: 'ammo_pouch',
    onlyClass: 'gunslinger',
    nameRu: 'Последний Козырь',
    categoryRu: 'БОЕЗАПАС',
    statBadgeRu: '+2 ПАТРОНА • ПОСЛЕДНИЙ ВЫСТРЕЛ ×2.0',
    descRu: 'Увеличивает магазин ружья на +2 гильзы, а последний патрон в обойме всегда наносит сокрушительный ×2.0 урон!',
    theme: 'gold',
    maxStacks: 3,
    icon: '🎯'
  },
  {
    id: 'gun_shrapnel_mine',
    onlyClass: 'gunslinger',
    nameRu: 'Шрапнельный Капкан',
    categoryRu: 'ЛОВУШКА',
    statBadgeRu: 'БРОСАЕТ РАЗРЫВНУЮ МИНУ КАЖДЫЕ 5 СЕК',
    descRu: 'На бегу стрелок каждые 5 секунд оставляет за спиной пороховой капкан, разрывающий наступивших мертвецов.',
    theme: 'crimson',
    maxStacks: 3,
    icon: '💣'
  },

  // =========================================================================
  // ⚔️ ВОИН КЛЯТВЫ (6 Уникальных Ратных Благословений)
  // =========================================================================
  {
    id: 'war_orbit_blades',
    onlyClass: 'warrior',
    nameRu: 'Клинки Предков',
    categoryRu: 'РЕЛИКВИЯ СКЛЕПА',
    statBadgeRu: 'ВРАЩАЮЩИЕСЯ МЕЧИ ДУШ ВОКРУГ ВОИНА',
    descRu: 'Призывает парящие призрачные мечи (2 / 3 / 4 клинка), которые непрерывно кружатся вокруг Воина и рубят нежить.',
    theme: 'gold',
    maxStacks: 3,
    icon: '🗡️'
  },
  {
    id: 'war_seismic_slam',
    onlyClass: 'warrior',
    nameRu: 'Раскол Брусчатки',
    categoryRu: 'ЯРОСТЬ СТАЛИ',
    statBadgeRu: 'КАЖДЫЙ 3-Й ВЗМАХ БЬЁТ РАЗЛОМОМ ЗЕМЛИ',
    descRu: 'Каждый 3-й удар мечом раскалывает камни золотой волной в радиусе 4.6м, нанося 110% урона и оглушая врагов.',
    theme: 'amber',
    maxStacks: 3,
    icon: '🌋'
  },
  {
    id: 'war_shield_thorns',
    onlyClass: 'warrior',
    nameRu: 'Шипованный Бастион',
    categoryRu: 'ЩИТ КЛЯТВЫ',
    statBadgeRu: '+7% БЛОК • ОТВЕТНЫЙ ВЗРЫВ ОСКОЛКОВ',
    descRu: 'Укрепляет щит (+7% к блоку), а каждый отражённый или принятый удар бьёт всех врагов вокруг стальной волной!',
    theme: 'steel',
    maxStacks: 3,
    icon: '🛡️'
  },
  {
    id: 'war_whirlwind',
    onlyClass: 'warrior',
    nameRu: 'Вихрь Жнеца',
    categoryRu: 'МАСТЕР МЕЧА',
    statBadgeRu: '+25% ДУГА УДАРА • ВИХРЬ 360° РАЗ В 4.5 СЕК',
    descRu: 'Расширяет дугу меча на 25%, а каждые 4.5 секунды Воин автоматически проводит круговой разрубающий вихрь на 360°!',
    theme: 'crimson',
    maxStacks: 3,
    icon: '🌪️'
  },
  {
    id: 'war_blood_cleave',
    onlyClass: 'warrior',
    nameRu: 'Казнь Кровопийцы',
    categoryRu: 'КЛЯТВА КРОВИ',
    statBadgeRu: '+50% ПО РАНЕНЫМ • ЛЕЧЕНИЕ ОТ КАЗНЕЙ',
    descRu: 'Наносит +50% урона врагам с менее 45% здоровья, а каждые 9 разрубленных тварей исцеляют Воина на +12 HP.',
    theme: 'crimson',
    maxStacks: 3,
    icon: '🩸'
  },
  {
    id: 'war_iron_banner',
    onlyClass: 'warrior',
    nameRu: 'Гнев Несокрушимого',
    categoryRu: 'БЕРСЕРК',
    statBadgeRu: '+24 МАКС. HP • ДО +45% ЯРОСТИ ПРИ РАНЕНИИ',
    descRu: 'Даёт +24 к макс. здоровью. Чем сильнее изранен Воин, тем быстрее и мощнее он рубит мечом (до +45% за ранг)!',
    theme: 'flame',
    maxStacks: 3,
    icon: '🔥'
  },

  // =========================================================================
  // 💀 РЕДКИЕ ОБЩИЕ ТЁМНЫЕ РЕЛИКВИИ (С Активным Эффектом!)
  // =========================================================================
  {
    id: 'crit_fang',
    nameRu: 'Жнец Черепов',
    categoryRu: 'СМЕРТОНОСНОСТЬ',
    statBadgeRu: '+15% КРИТ • ВЗРЫВ ДУШИ ПРИ КРИТЕ',
    descRu: 'Повышает шанс крита на 15%. Каждый критический удар взрывает цель астральной вспышкой, ранящей соседей!',
    theme: 'crimson',
    maxStacks: 3,
    icon: '💀'
  },
  {
    id: 'greed_contract',
    nameRu: 'Печать Алчности',
    categoryRu: 'ТРОФЕИ ОХОТЫ',
    statBadgeRu: '+35% ЗОЛОТА • УСКОРЕНИЕ ОТ ТРОФЕЕВ',
    descRu: 'Увеличивает добычу золота за каждого убитого монстра на 35% и даёт +7% к скорости движения.',
    theme: 'gold',
    maxStacks: 3,
    icon: '🪙'
  }
];

// =========================================================================
// MENU-ONLY CLASS TALENT TREES (1 Skill Point gained per Hero Level!)
// Initially launching full branching tree for Water Mage ("Маг Воды");
// Warrior & Gunslinger trees marked coming soon.
// =========================================================================
export const MAGE_TALENT_TREE = [
  {
    id: 'water_pressure',
    tier: 1,
    col: 2,
    row: 1,
    maxRank: 3,
    requires: [],
    iconKind: 'droplet',
    nameRu: 'Сила Потока',
    statBadgeRu: '+18% урон сфер • +12 макс. HP / ранг',
    descRu: 'Уплотняет водную материю скипетра: каждая сфера наносит больше урона и укрепляет здоровье Мага.'
  },
  {
    id: 'mana_spring',
    tier: 2,
    col: 1,
    row: 2,
    maxRank: 3,
    requires: [{ id: 'water_pressure', rank: 1 }],
    iconKind: 'chalice',
    nameRu: 'Источник Маны',
    statBadgeRu: '+22 макс. маны • +1.4 реген/сек / ранг',
    descRu: 'Расширяет глубинный резерв маны и ускоряет восстановление во время боя.'
  },
  {
    id: 'frost_velocity',
    tier: 2,
    col: 3,
    row: 2,
    maxRank: 3,
    requires: [{ id: 'water_pressure', rank: 1 }],
    iconKind: 'boots',
    nameRu: 'Течение Прилива',
    statBadgeRu: '+7% скорость атак • +6% бег / ранг',
    descRu: 'Наполняет походку лёгкостью волны: заклинания вылетают чаще, а уклоняться от врагов проще.'
  },
  {
    id: 'hydro_barrier',
    tier: 3,
    col: 1,
    row: 3,
    maxRank: 2,
    requires: [{ id: 'mana_spring', rank: 1 }],
    iconKind: 'shield',
    nameRu: 'Водяной Щит',
    statBadgeRu: 'Поглощение удара • +4% брони / ранг',
    descRu: 'Создаёт вокруг Мага защитную пелену воды, периодически поглощающую вражеский удар.'
  },
  {
    id: 'twin_sphere',
    tier: 3,
    col: 2,
    row: 3,
    maxRank: 3,
    requires: [{ id: 'water_pressure', rank: 2 }],
    iconKind: 'twin',
    nameRu: 'Раздвоение Сферы',
    statBadgeRu: '40% / 75% / 100% доп. сфера бесплатно',
    descRu: 'Каждый бросок водной сферы имеет высокий шанс бесплатно породить вторую волновую сферу.'
  },
  {
    id: 'crimson_tide',
    tier: 3,
    col: 3,
    row: 3,
    maxRank: 3,
    requires: [{ id: 'frost_velocity', rank: 1 }],
    iconKind: 'crit',
    nameRu: 'Кровавый Шторм',
    statBadgeRu: '+10% шанс крита • +15% сила крита / ранг',
    descRu: 'Заточенные гребни воды пробивают уязвимые места чудовищ с сокрушительным критическим уроном.'
  },
  {
    id: 'maelstrom_fury',
    tier: 4,
    col: 2,
    row: 4,
    maxRank: 2,
    requires: [{ id: 'twin_sphere', rank: 1 }],
    iconKind: 'crown',
    nameRu: 'Гнев Водоворота',
    statBadgeRu: '+22% урон • Вихрь с небес / ранг',
    descRu: 'Высшее таинство воды: периодически обрушивает небесный вихрь на скопления нечисти и усиливает магию.'
  }
];

export const WARRIOR_TALENT_TREE = [
  {
    id: 'war_steel_grip',
    tier: 1,
    col: 2,
    row: 1,
    maxRank: 3,
    requires: [],
    iconKind: 'crit',
    nameRu: 'Стальной Хват',
    statBadgeRu: '+16% урон в цель • +18 макс. HP / ранг',
    descRu: 'Закаляет хват меча и щита: точечные удары бьют глубже, а живучесть Воина возрастает.'
  },
  {
    id: 'war_shield_wall',
    tier: 2,
    col: 1,
    row: 2,
    maxRank: 3,
    requires: [{ id: 'war_steel_grip', rank: 1 }],
    iconKind: 'shield',
    nameRu: 'Стальной Бастион',
    statBadgeRu: '+7% броня • +8% блок щитом / ранг',
    descRu: 'Укрепляет стальной щит, снижая входящий урон и чаще отражая выпады монстров.'
  },
  {
    id: 'war_swift_stride',
    tier: 2,
    col: 3,
    row: 2,
    maxRank: 3,
    requires: [{ id: 'war_steel_grip', rank: 1 }],
    iconKind: 'boots',
    nameRu: 'Боевой Натиск',
    statBadgeRu: '+8% скорость ударов • +6% бег / ранг',
    descRu: 'Воин стремительнее сближается с целью и наносит быстрые прицельные удары мечом.'
  },
  {
    id: 'war_iron_banner',
    tier: 3,
    col: 1,
    row: 3,
    maxRank: 2,
    requires: [{ id: 'war_shield_wall', rank: 1 }],
    iconKind: 'chalice',
    nameRu: 'Железное Знамя',
    statBadgeRu: '+24 макс. HP • +14% стойкость дуэли / ранг',
    descRu: 'Несгибаемая воля к победе: поднимает запас здоровья Воина в ближнем бою.'
  },
  {
    id: 'war_whirlwind_edge',
    tier: 3,
    col: 2,
    row: 3,
    maxRank: 3,
    requires: [{ id: 'war_steel_grip', rank: 2 }],
    iconKind: 'twin',
    nameRu: 'Точный Выпад',
    statBadgeRu: '+12% дальность укола • +14% урон в цель',
    descRu: 'Фокусирует атаку меча на одном противнике, увеличивая дистанцию выпада без сплэша.'
  },
  {
    id: 'war_blood_cleave',
    tier: 3,
    col: 3,
    row: 3,
    maxRank: 3,
    requires: [{ id: 'war_swift_stride', rank: 1 }],
    iconKind: 'droplet',
    nameRu: 'Кровавая Жатва',
    statBadgeRu: '+10% крит • +15% крит урон • вампиризм',
    descRu: 'Прицельные удары меча пробивают броню одиночной цели и лечат при добивании.'
  },
  {
    id: 'war_orbital_blades',
    tier: 4,
    col: 2,
    row: 4,
    maxRank: 2,
    requires: [{ id: 'war_whirlwind_edge', rank: 1 }],
    iconKind: 'crown',
    nameRu: 'Мастер Дуэли',
    statBadgeRu: '+24% точечный урон • +10% шанс крита',
    descRu: 'Превращает каждый взмах меча в смертельную точечную казнь выбранного врага.'
  }
];

export const GUNSLINGER_TALENT_TREE = [
  {
    id: 'gun_heavy_slug',
    tier: 1,
    col: 2,
    row: 1,
    maxRank: 3,
    requires: [],
    iconKind: 'twin',
    nameRu: 'Крупная Картечь',
    statBadgeRu: '+14% урон • +2 дробины залпа / ранг',
    descRu: 'Утяжеляет заряд дробовика и увеличивает плотность смертоносного веера картечи.'
  },
  {
    id: 'gun_ammo_belt',
    tier: 2,
    col: 1,
    row: 2,
    maxRank: 3,
    requires: [{ id: 'gun_heavy_slug', rank: 1 }],
    iconKind: 'chalice',
    nameRu: 'Быстрый Барабан',
    statBadgeRu: '+2 патрона • +28% перезарядка / ранг',
    descRu: 'Расширяет магазин ствола и ускоряет перезарядку прямо на бегу.'
  },
  {
    id: 'gun_quicksilver',
    tier: 2,
    col: 3,
    row: 2,
    maxRank: 3,
    requires: [{ id: 'gun_heavy_slug', rank: 1 }],
    iconKind: 'boots',
    nameRu: 'Ртутный Шаг',
    statBadgeRu: '+7% скорострельность • +7% бег / ранг',
    descRu: 'Ускоряет реакцию Охотника: быстрее бег и выше темп стрельбы.'
  },
  {
    id: 'gun_ricochet_shot',
    tier: 3,
    col: 1,
    row: 3,
    maxRank: 2,
    requires: [{ id: 'gun_ammo_belt', rank: 1 }],
    iconKind: 'shield',
    nameRu: 'Хитрый Рикошет',
    statBadgeRu: 'Рикошет дроби по орде • +5% броня / ранг',
    descRu: 'Пули отскакивают от целей в соседних монстров, накрывая сразу целые группы.'
  },
  {
    id: 'gun_explosive_powder',
    tier: 3,
    col: 2,
    row: 3,
    maxRank: 3,
    requires: [{ id: 'gun_heavy_slug', rank: 2 }],
    iconKind: 'crit',
    nameRu: 'Огненный Порох',
    statBadgeRu: 'Разрывные заряды • +16% урон / ранг',
    descRu: 'Каждая дробь вспыхивает пороховым разрывом, подрывая плотные ряды врагов.'
  },
  {
    id: 'gun_deadeye',
    tier: 3,
    col: 3,
    row: 3,
    maxRank: 3,
    requires: [{ id: 'gun_quicksilver', rank: 1 }],
    iconKind: 'droplet',
    nameRu: 'Меткий Взор',
    statBadgeRu: '+11% крит • +16% крит урон / ранг',
    descRu: 'Прицельная стрельба по уязвимым точкам сокрушает даже бронированных стражей.'
  },
  {
    id: 'gun_shrapnel_trap',
    tier: 4,
    col: 2,
    row: 4,
    maxRank: 2,
    requires: [{ id: 'gun_explosive_powder', rank: 1 }],
    iconKind: 'crown',
    nameRu: 'Шрапнельные Мины',
    statBadgeRu: 'Осколочные ловушки • +22% урон / ранг',
    descRu: 'Периодически устанавливает мины под ноги орды и усиливает залпы.'
  }
];

export const CLASS_TALENT_TREES = {
  mage: MAGE_TALENT_TREE,
  warrior: WARRIOR_TALENT_TREE,
  gunslinger: GUNSLINGER_TALENT_TREE
};
