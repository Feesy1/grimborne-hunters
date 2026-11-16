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
    moveSpeed: 5.25,
    damageBlock: 0.26,
    blockChance: 0.22,
    colorPrimary: 0x8b2635,
    colorSecondary: 0xc8ccd4,
    colorAccent: 0xf4b942,
    starterWeapon: 'club',
    weapons: ['club', 'cleaver', 'flail'],
    beastNameRu: 'Железный Жнец',
    beastColor: 0xd9480f
  },
  gunslinger: {
    id: 'gunslinger',
    nameRu: 'Охотник-Стрелок',
    nameEn: 'Grim Shotgunner',
    roleRu: 'Дробовик • Мощная картечь, отдача и перезарядка',
    roleEn: 'Shotgunner • Heavy Buckshot, Recoil & Reload',
    descRu: 'Ловкий стрелок в капюшоне с тяжёлым ружьём в обеих руках. Рвёт дистанцию, всаживает веер свинцовой картечи в упор и перезаряжает патроны на бегу.',
    descEn: 'Swift hooded hunter wielding heavy black-powder shotguns with devastating close-range buckshot.',
    portrait: './assets/ui/portrait_gunslinger.png',
    maxHp: 110,
    moveSpeed: 6.16,
    damageBlock: 0.14,
    blockChance: 0.08,
    colorPrimary: 0x2b3a4a,
    colorSecondary: 0x6b4423,
    colorAccent: 0xe09f3e,
    starterWeapon: 'pistol',
    weapons: ['pistol', 'blunderbuss', 'gatling'],
    beastNameRu: 'Гончая Пороха',
    beastColor: 0x3b82f6
  },
  mage: {
    id: 'mage',
    nameRu: 'Пепельный Маг',
    nameEn: 'Ashen Mage',
    roleRu: 'Тёмные чары • Поток маны и взрывные кометы',
    roleEn: 'Arcane • Mana Pool & AoE Comets',
    descRu: 'Хрупкий заклинатель с кристальным посохом. Непрерывно восстанавливает ману и выжигает скопления чудовищ разрывными кометами без перезарядки.',
    descEn: 'Fragile skeletal spellcaster channeling regenerating mana into explosive arcane comets.',
    portrait: './assets/ui/portrait_mage.png',
    maxHp: 92,
    moveSpeed: 5.32,
    maxMana: 120,
    manaRegen: 9.5,
    damageBlock: 0.05,
    blockChance: 0.0,
    colorPrimary: 0x4c1d95,
    colorSecondary: 0x1e1b4b,
    colorAccent: 0xc084fc,
    starterWeapon: 'spark_staff',
    weapons: ['spark_staff', 'cinder_tome', 'void_orb'],
    beastNameRu: 'Архонт Пустоты',
    beastColor: 0xa855f7
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
export const MAGE_ELEMENT_ORDER = ['fire', 'water', 'lightning', 'air'];
export const MAGE_ELEMENT_UNLOCK_COSTS = [0, 140, 240, 360];

export const WEAPONS = {
  // === WARRIOR ===
  club: {
    id: 'club',
    classId: 'warrior',
    tier: 1,
    unlockLevel: 1,
    nameRu: 'Клинок Клятвы',
    nameEn: 'Oath Broadsword',
    descRu: 'Тяжёлый широкий меч стража склепа. Рубит плотной дугой и отшвыривает ходячих мертвецов.',
    type: 'melee',
    baseDamage: 32,
    cooldown: 0.48,
    range: 3.6,
    arcAngle: Math.PI * 0.78,
    knockback: 7.4,
    splashRadius: 0,
    color: 0xd97706,
    upgradeBaseCost: 45
  },
  cleaver: {
    id: 'cleaver',
    classId: 'warrior',
    tier: 2,
    unlockLevel: 3,
    nameRu: 'Секач Инквизитора',
    nameEn: 'Inquisitor Cleaver',
    descRu: 'Двуручный багровый тесак. Рассекает строй врагов широкой дугой с ударной волной.',
    type: 'melee',
    baseDamage: 48,
    cooldown: 0.56,
    range: 4.4,
    arcAngle: Math.PI * 0.95,
    knockback: 9.4,
    splashRadius: 2.2,
    color: 0xef4444,
    upgradeBaseCost: 85
  },
  flail: {
    id: 'flail',
    classId: 'warrior',
    tier: 3,
    unlockLevel: 7,
    nameRu: 'Клинок Пепельной Бури',
    nameEn: 'Cinderstorm Greatsword',
    descRu: 'Легендарный двуручный меч: сокрушительный круговой вихрь стали с огненным разломом.',
    type: 'melee',
    baseDamage: 70,
    cooldown: 0.62,
    range: 4.9,
    arcAngle: Math.PI * 1.35,
    knockback: 11.8,
    splashRadius: 3.3,
    color: 0xf59e0b,
    upgradeBaseCost: 135
  },

  // === GUNSLINGER (True Heavy Shotguns — NO pistol spam!) ===
  pistol: {
    id: 'pistol',
    classId: 'gunslinger',
    tier: 1,
    unlockLevel: 1,
    nameRu: 'Охотничье ружьё',
    nameEn: 'Hunter Pump Shotgun',
    descRu: 'Тяжёлое помповое ружьё на 5 патронов. Бьёт плотным веером из 7 свинцовых картечин с ощутимой отдачей и мощным уроном вблизи.',
    type: 'ranged',
    isShotgun: true,
    baseDamage: 11,        // 7 pellets * 11 = 77 point-blank meatshot!
    cooldown: 0.80,        // Weighty pump-action shotgun cadence
    range: 13.8,
    projectileSpeed: 27,
    pellets: 7,
    spread: 0.36,
    pierce: 1,
    splashRadius: 0,
    knockback: 7.5,
    magSize: 5,
    reloadTime: 2.10,
    recoilKick: 2.8,
    color: 0xfbbf24,
    upgradeBaseCost: 45
  },
  blunderbuss: {
    id: 'blunderbuss',
    classId: 'gunslinger',
    tier: 2,
    unlockLevel: 3,
    nameRu: 'Двуствольный мушкетон «Гром»',
    nameEn: 'Thunder Double-Barrel',
    descRu: 'Убойная двустволка на 2 гильзы: выплёвывает шквал из 11 раскалённых картечин, сносящий целый отряд в упор.',
    type: 'ranged',
    isShotgun: true,
    baseDamage: 12,
    cooldown: 0.54,
    range: 12.0,
    projectileSpeed: 26,
    pellets: 11,
    spread: 0.50,
    pierce: 1,
    splashRadius: 0,
    knockback: 10.8,
    magSize: 2,
    reloadTime: 2.25,
    recoilKick: 4.5,
    color: 0xf97316,
    upgradeBaseCost: 85
  },
  gatling: {
    id: 'gatling',
    classId: 'gunslinger',
    tier: 3,
    unlockLevel: 7,
    nameRu: 'Барабанный дробовик «Шквал»',
    nameEn: 'Tempest Drum Shotgun',
    descRu: 'Автоматическое ружьё с барабаном на 8 патронов и бронебойной картечью на вылет.',
    type: 'ranged',
    isShotgun: true,
    baseDamage: 14,
    cooldown: 0.36,
    range: 15.5,
    projectileSpeed: 30,
    pellets: 5,
    spread: 0.25,
    pierce: 2,
    splashRadius: 0,
    knockback: 5.6,
    magSize: 8,
    reloadTime: 2.50,
    recoilKick: 1.9,
    color: 0x38bdf8,
    upgradeBaseCost: 135
  },

  // === MAGE (Continuous Mana Pool — ZERO Reload!) ===
  spark_staff: {
    id: 'spark_staff',
    classId: 'mage',
    tier: 1,
    unlockLevel: 1,
    nameRu: 'Посох гибельных искр',
    nameEn: 'Spark Staff',
    descRu: 'Выпускает астральную комету с фиолетовым взрывом по соседним врагам. Расходует ману без перезарядки.',
    type: 'magic',
    baseDamage: 28,
    cooldown: 0.50,
    range: 16.5,
    projectileSpeed: 18,
    pellets: 1,
    spread: 0.02,
    pierce: 1,
    splashRadius: 2.4,
    knockback: 3.0,
    magSize: 0,
    reloadTime: 0,
    manaCost: 7.5,
    recoilKick: 0.5,
    color: 0xc084fc,
    upgradeBaseCost: 45
  },
  cinder_tome: {
    id: 'cinder_tome',
    classId: 'mage',
    tier: 2,
    unlockLevel: 3,
    nameRu: 'Посох багрового пепла',
    nameEn: 'Crimson Cinder Staff',
    descRu: 'Запускает парные пиромантические кометы с широким огненным взрывом. Питается потоком маны.',
    type: 'magic',
    baseDamage: 34,
    cooldown: 0.62,
    range: 17.5,
    projectileSpeed: 17.5,
    pellets: 2,
    spread: 0.17,
    pierce: 1,
    splashRadius: 3.4,
    knockback: 4.2,
    magSize: 0,
    reloadTime: 0,
    manaCost: 10.5,
    recoilKick: 0.8,
    color: 0xf43f5e,
    upgradeBaseCost: 85
  },
  void_orb: {
    id: 'void_orb',
    classId: 'mage',
    tier: 3,
    unlockLevel: 7,
    nameRu: 'Скипетр пустотного разлома',
    nameEn: 'Void Rift Scepter',
    descRu: 'Высшая магия: пробивная комета пустоты, вызывающая гравитационную сверхновую за счёт маны.',
    type: 'magic',
    baseDamage: 58,
    cooldown: 0.70,
    range: 18.5,
    projectileSpeed: 19.5,
    pellets: 1,
    spread: 0,
    pierce: 2,
    splashRadius: 4.5,
    knockback: 5.8,
    magSize: 0,
    reloadTime: 0,
    manaCost: 13.5,
    recoilKick: 1.1,
    color: 0x818cf8,
    upgradeBaseCost: 135
  }
};

// 9-Archetype Dark-Fantasy Villain Roster (Tactical -30% movement pace, 1 fair signature mechanic each!)
export const ENEMY_TYPES = {
  skeleton: {
    id: 'skeleton',
    nameRu: 'Костяной ходок',
    roleHintRu: 'Каска и щит • Пехота погоста',
    hp: 76,
    speed: 2.94,
    damage: 13,
    xp: 10,
    gold: 3,
    scale: 0.94,
    color: 0x84cc16
  },
  hound: {
    id: 'hound',
    nameRu: 'Кровавый налётчик',
    roleHintRu: 'Стремительный рывок',
    hp: 62,
    speed: 4.62,
    damage: 12,
    xp: 12,
    gold: 4,
    scale: 0.84,
    canDash: true,
    color: 0xef4444
  },
  archer: {
    id: 'archer',
    nameRu: 'Проклятый стрелок',
    roleHintRu: 'Дальний выстрел из арбалета',
    hp: 66,
    speed: 2.66,
    damage: 14,
    ranged: true,
    keepDistance: 9.2,
    xp: 14,
    gold: 5,
    scale: 0.90,
    color: 0x22d3ee
  },
  shieldbearer: {
    id: 'shieldbearer',
    nameRu: 'Щитоносец склепа',
    roleHintRu: 'Стальной щит спереди',
    hp: 110,
    speed: 2.17,
    damage: 16,
    frontArmor: 0.45,
    xp: 18,
    gold: 7,
    scale: 1.06,
    color: 0x60a5fa
  },
  bomber: {
    id: 'bomber',
    nameRu: 'Чумной подрывник',
    roleHintRu: 'Взрыв бочки после гибели',
    hp: 44,
    speed: 3.92,
    damage: 22,
    explodesOnDeath: true,
    xp: 16,
    gold: 6,
    scale: 0.88,
    color: 0xf97316
  },
  necromancer: {
    id: 'necromancer',
    nameRu: 'Призыватель могил',
    roleHintRu: 'Поднимает 2 скелетов из земли',
    hp: 76,
    speed: 2.24,
    damage: 14,
    summoner: true,
    keepDistance: 10.8,
    xp: 22,
    gold: 9,
    scale: 0.98,
    color: 0x10b981
  },
  cultist: {
    id: 'cultist',
    nameRu: 'Тёмный культист',
    roleHintRu: 'Веер из 3 теневых копий',
    hp: 72,
    speed: 2.38,
    damage: 16,
    ranged: true,
    burstCount: 3,
    keepDistance: 10.2,
    xp: 20,
    gold: 8,
    scale: 0.98,
    color: 0xa855f7
  },
  brute: {
    id: 'brute',
    nameRu: 'Павший палач',
    roleHintRu: 'Тяжёлый таранный разбег',
    hp: 195,
    speed: 2.03,
    damage: 26,
    canCharge: true,
    xp: 30,
    gold: 14,
    scale: 1.36,
    color: 0x475569
  },

  // === 5 DISTINCT ACT BOSSES (Appear on 5, 10, 15, 20, 25 -> then return as Mini-Bosses in later Acts!) ===
  boss_butcher: {
    id: 'boss_butcher',
    nameRu: 'Костяной Мясник',
    roleHintRu: 'Босс I Акта • Прыжок и двойные топоры',
    isBoss: true,
    bossAct: 1,
    hp: 920,
    speed: 3.43,
    damage: 26,
    xp: 120,
    gold: 95,
    scale: 1.85,
    color: 0x991b1b
  },
  boss_warden: {
    id: 'boss_warden',
    nameRu: 'Железный Инквизитор',
    roleHintRu: 'Босс II Акта • Таран и раскол земли',
    isBoss: true,
    bossAct: 2,
    hp: 1380,
    speed: 3.08,
    damage: 30,
    xp: 150,
    gold: 125,
    scale: 1.98,
    color: 0x1e3a8a
  },
  boss_archlich: {
    id: 'boss_archlich',
    nameRu: 'Архилич Мора',
    roleHintRu: 'Босс III Акта • Кольцо проклятий и призыв',
    isBoss: true,
    bossAct: 3,
    hp: 1750,
    speed: 2.94,
    damage: 32,
    xp: 180,
    gold: 155,
    scale: 2.05,
    color: 0x065f46
  },
  reaper: {
    id: 'reaper',
    nameRu: 'Древний Жнец Душ',
    roleHintRu: 'Босс IV Акта • Рывок косой и тёмное пламя',
    isBoss: true,
    bossAct: 4,
    hp: 2150,
    speed: 3.50,
    damage: 35,
    xp: 220,
    gold: 190,
    scale: 2.15,
    color: 0x0f172a
  },
  boss_ashlord: {
    id: 'boss_ashlord',
    nameRu: 'Владыка Вечного Пепла',
    roleHintRu: 'Финальный Ультра-Босс • Король Мрака',
    isBoss: true,
    bossAct: 5,
    hp: 3100,
    speed: 3.64,
    damage: 40,
    xp: 350,
    gold: 320,
    scale: 2.48,
    color: 0x7f1d1d
  }
};

// 25-Chapter Dark-Fantasy Campaign (5 Acts × 5 Chapters, Bosses on 5, 10, 15, 20, 25!)
const CHAPTER_METADATA = [
  // ACT I: Погост Проклятых (Levels 1-5)
  ['Окраина Погоста', 'Первая вылазка у железных врат: ходячие кости и быстрые налётчики проверяют твой хват.', 'stage_1.jpg', ['skeleton', 'hound']],
  ['Сторожевой Костёр', 'Из тумана выходят проклятые арбалетчики — не стой на одной линии огня.', 'stage_2.jpg', ['skeleton', 'hound', 'archer']],
  ['Пороховой Схрон', 'Чумные подрывники несут бочки: взрывай их прямо в толпе мертвецов и открой оружие II ранга!', 'stage_2.jpg', ['skeleton', 'hound', 'archer', 'bomber']],
  ['Висельная Роща', 'Под сухими ветвями строятся щитоносцы склепа — обходи сбоку или бей картечью в упор.', 'stage_3.jpg', ['skeleton', 'hound', 'archer', 'shieldbearer']],
  ['Врата Первого Жнеца', 'Конец I Акта: сокруши Стража Погоста — Древнего Жнеца у расколотой усыпальницы!', 'stage_5.jpg', ['skeleton', 'hound', 'archer', 'shieldbearer', 'bomber']],

  // ACT II: Осквернённый Лагерь (Levels 6-10)
  ['Пепельный Редут', 'Призыватели могил поднимают свежих скелетов из-под брусчатки — устраняй их первыми.', 'stage_4.jpg', ['skeleton', 'hound', 'archer', 'necromancer']],
  ['Оружейная Инквизиции', 'Найди среди руин легендарный Рунный Сундук с оружием III ранга под обстрелом культистов!', 'stage_4.jpg', ['skeleton', 'archer', 'shieldbearer', 'bomber', 'cultist']],
  ['Тропа Мародёров', 'Стремительные стаи налётчиков и подрывников атакуют с четырёх сторон двора.', 'stage_2.jpg', ['hound', 'archer', 'bomber', 'cultist']],
  ['Железный Заслон', 'Тяжёлые павшие палачи идут на таран сквозь ряды щитоносцев.', 'stage_1.jpg', ['skeleton', 'shieldbearer', 'cultist', 'brute']],
  ['Судилище Палача', 'Конец II Акта: переживи осаду элитной гвардии и одолей Жнеца Кровавой Луны!', 'stage_5.jpg', ['hound', 'archer', 'shieldbearer', 'cultist', 'brute']],

  // ACT III: Мёртвая Чаща (Levels 11-15)
  ['Шёпот Корней', 'Некроманты и арбалетчики держат дистанцию за спинами костяной пехоты.', 'stage_3.jpg', ['skeleton', 'hound', 'archer', 'necromancer', 'shieldbearer']],
  ['Костяной Бурелом', 'Узкие манёвры между алтарями под залпами теневых копий.', 'stage_3.jpg', ['hound', 'bomber', 'necromancer', 'cultist']],
  ['Лагерь Алхимиков', 'Цепные взрывы чумных бочек способны очистить половину двора при метком выстреле.', 'stage_2.jpg', ['skeleton', 'archer', 'bomber', 'shieldbearer', 'brute']],
  ['Курган Безмолвных', 'Бронированная фаланга склепа наступает под прикрытием тёмных чародеев.', 'stage_4.jpg', ['shieldbearer', 'necromancer', 'cultist', 'brute']],
  ['Алтарь Лесного Мора', 'Конец III Акта: битва с Повелителем Мёртвой Чащи в кольце тёмного пламени!', 'stage_5.jpg', ['hound', 'bomber', 'necromancer', 'cultist', 'brute']],

  // ACT IV: Катакомбы Королей (Levels 16-20)
  ['Ступени Бездны', 'Здесь выживает только закалённое оружие — рядовая нежить сменяется ветеранами склепа.', 'stage_1.jpg', ['skeleton', 'hound', 'archer', 'shieldbearer', 'cultist']],
  ['Зал Разбитых Щитов', 'Двойные волны щитоносцев и таранных палачей проверяют твою мощь.', 'stage_1.jpg', ['hound', 'shieldbearer', 'bomber', 'brute']],
  ['Багровый Ковен', 'Кольцо культистов и некромантов заливает арену магическим огнём.', 'stage_4.jpg', ['archer', 'necromancer', 'cultist', 'brute']],
  ['Караул Бессмертных', 'Непрерывный штурм элитных охотников, подрывников и латников.', 'stage_3.jpg', ['hound', 'archer', 'shieldbearer', 'bomber', 'necromancer', 'brute']],
  ['Чертог Павших Королей', 'Конец IV Акта: сойдись один на один с Архи-Жнецом Королевской Усыпальницы!', 'stage_5.jpg', ['archer', 'shieldbearer', 'necromancer', 'cultist', 'brute']],

  // ACT V: Престол Пепла (Levels 21-25)
  ['Разлом Пустоты', 'Небо багровеет: высшая нечисть атакует в максимальном темпе.', 'stage_5.jpg', ['hound', 'archer', 'bomber', 'necromancer', 'cultist']],
  ['Пепельный Бастион', 'Железная поступь палачей и щитоносцев не оставляет права на промах.', 'stage_1.jpg', ['shieldbearer', 'bomber', 'cultist', 'brute']],
  ['Жатва Обречённых', 'Все виды проклятых тварей выходят на охоту одновременно.', 'stage_2.jpg', ['hound', 'archer', 'shieldbearer', 'bomber', 'necromancer', 'cultist', 'brute']],
  ['Преддверие Вечной Ночи', 'Предпоследний рубеж перед троном: испытание предельной прокачки твоего класса.', 'stage_4.jpg', ['archer', 'shieldbearer', 'bomber', 'necromancer', 'cultist', 'brute']],
  ['Трон Владыки Мрака', 'Финал кампании (Глава 25): сокруши Изначального Владыку Жнецов и очисти земли навсегда!', 'stage_5.jpg', ['hound', 'archer', 'shieldbearer', 'bomber', 'necromancer', 'cultist', 'brute']]
];

const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
  'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV'
];

const ACT_BOSS_ORDER = ['boss_butcher', 'boss_warden', 'boss_archlich', 'reaper', 'boss_ashlord'];

export const LEVELS = CHAPTER_METADATA.map(([titleRu, subRu, bannerFile, pool], idx) => {
  const lvl = idx + 1;
  const act = Math.ceil(lvl / 5);
  const isBossLevel = lvl % 5 === 0;
  const bossId = isBossLevel ? ACT_BOSS_ORDER[act - 1] : null;
  // Previous Acts' bosses become Mini-Bosses in subsequent Acts! (Act 1 levels 1-4 have NO bosses, only small elite mobs!)
  const miniBossPool = act > 1 ? ACT_BOSS_ORDER.slice(0, act - 1) : [];
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
    durationSec: Math.min(115, 62 + lvl * 2),
    spawnInterval: +(Math.max(0.46, 1.08 - lvl * 0.024)).toFixed(3),
    hpScale: +(1 + (lvl - 1) * 0.18 + Math.pow(Math.max(0, lvl - 1), 1.25) * 0.045).toFixed(2),
    dmgScale: +(1 + (lvl - 1) * 0.075).toFixed(2),
    enemyPool: pool,
    miniBossPool,
    bossId,
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
