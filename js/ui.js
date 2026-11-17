// AAA Gothic Dark-Fantasy UI Manager:
// - 4-Tab Hub (⚔️ Герои, 🗺️ Поход 25 Глав, 🗡️ Арсенал 1..12, 🧪 Мастерская классов)
// - HD Character Portraits, 10-Segment RPG Crystal Rune Bars & Custom Vector Weapon Art
// - Illustrated 25-Chapter Campaign Showcase (5 Acts × 5 Chapters)
// - Animated "Благословение Душ" Tarot / Relic Altar Cards (100% Custom SVG, Zero Emojis)
// - Combat HUD with Brass Shotgun Shell / Mana Pips, Golden Reload Bar, [R] Button & Perk Mini-Badges
// - Single Floating Bottom-Left iPhone / Mobile Virtual Joystick with Auto-Aim

import {
  WEAPON_MAX_LEVEL,
  CLASSES,
  MAGE_ELEMENTS,
  MAGE_ELEMENT_ORDER,
  MAGE_ELEMENT_UNLOCK_COSTS,
  WEAPONS,
  ENEMY_TYPES,
  LEVELS,
  RUN_UPGRADES,
  MAGE_TALENT_TREE,
  CLASS_TALENT_TREES
} from './config.js?v=20261117z22';

const CLASS_ORDER = ['warrior', 'gunslinger', 'mage'];

const CLASS_META = {
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

const ACT_DEFS = [
  { act: 1, roman: 'I', titleRu: 'Акт I: Погост (1–5)', titleEn: 'Act I: Graveyard (1–5)', shortRu: 'Акт I' },
  { act: 2, roman: 'II', titleRu: 'Акт II: Лагерь (6–10)', titleEn: 'Act II: Camp (6–10)', shortRu: 'Акт II' },
  { act: 3, roman: 'III', titleRu: 'Акт III: Чаща (11–15)', titleEn: 'Act III: Thicket (11–15)', shortRu: 'Акт III' },
  { act: 4, roman: 'IV', titleRu: 'Акт IV: Катакомбы (16–20)', titleEn: 'Act IV: Catacombs (16–20)', shortRu: 'Акт IV' },
  { act: 5, roman: 'V', titleRu: 'Акт V: Престол (21–25)', titleEn: 'Act V: Throne (21–25)', shortRu: 'Акт V' }
];

const TIER_ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
const RANK_ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const DEFAULT_MASTERY_DEFS = [
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

let svgUidCounter = 0;

function nextSvgUid(prefix = 'g') {
  svgUidCounter = (svgUidCounter + 1) % 999999;
  return `${prefix}${svgUidCounter}`;
}

function makeSvgNode(markup, className = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  const svg = tpl.content.firstElementChild;
  if (svg && className) {
    svg.setAttribute('class', className);
  }
  return svg;
}

// ============================================================================
// CUSTOM VECTOR ARTWORK GENERATORS (WEAPONS, STAT RUNES, TAROT RELICS, MANDALA)
// ============================================================================

export function createWeaponSvg(weaponId, className = 'weapon-vector-svg') {
  const id = String(weaponId || 'club');
  const u = nextSvgUid('wpn');
  let defs = '';
  let body = '';

  switch (id) {
    case 'club': // Клинок Клятвы — Ornate Gothic Broadsword
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="48%" stop-color="#cbd5e1"/>
          <stop offset="100%" stop-color="#64748b"/>
        </linearGradient>
        <linearGradient id="${u}_g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="55%" stop-color="#eab308"/>
          <stop offset="100%" stop-color="#92400e"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="24" fill="rgba(217,119,6,0.12)"/>
        <polygon points="53,11 49,23 26,46 18,46 18,38 41,15" fill="url(#${u}_b)" stroke="#e2e8f0" stroke-width="1.1"/>
        <line x1="47" y1="17" x2="24" y2="40" stroke="#475569" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M13 33 L31 51 L28 54 L10 36 Z" fill="url(#${u}_g)" stroke="#fde047" stroke-width="0.9"/>
        <path d="M18 44 L11 51 L13 53 L20 46 Z" fill="#78350f" stroke="#f59e0b" stroke-width="0.8"/>
        <circle cx="10.5" cy="53.5" r="3.2" fill="url(#${u}_g)" stroke="#fef08a" stroke-width="0.9"/>
        <circle cx="22" cy="42" r="2.1" fill="#dc2626"/>`;
      break;

    case 'spear': // Боевое Копьё — Ornate Long Steel Spear
    case 'cleaver':
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="50%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="24" fill="rgba(56,189,248,0.14)"/>
        <line x1="10" y1="54" x2="40" y2="24" stroke="#78350f" stroke-width="3.6" stroke-linecap="round"/>
        <polygon points="56,8 47,26 39,25 38,17" fill="url(#${u}_b)" stroke="#bae6fd" stroke-width="1.1"/>
        <path d="M35 20 L44 29" stroke="#f59e0b" stroke-width="2.4" stroke-linecap="round"/>`;
      break;

    case 'zweihander': // Цвайхандер — Two-Handed Greatsword
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="50%" stop-color="#cbd5e1"/>
          <stop offset="100%" stop-color="#475569"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(203,213,225,0.14)"/>
        <polygon points="56,8 51,21 25,47 17,47 17,39 43,13" fill="url(#${u}_b)" stroke="#f8fafc" stroke-width="1.1"/>
        <path d="M11 32 L32 53" stroke="#eab308" stroke-width="3.2" stroke-linecap="round"/>
        <line x1="20" y1="44" x2="9" y2="55" stroke="#78350f" stroke-width="3.4" stroke-linecap="round"/>`;
      break;

    case 'axe': // Боевая Секира — Double-Bitted Iron War Axe
    case 'flail':
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e2e8f0"/>
          <stop offset="55%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#475569"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(239,68,68,0.15)"/>
        <line x1="11" y1="53" x2="45" y2="19" stroke="#5c2d16" stroke-width="4.2" stroke-linecap="round"/>
        <path d="M35 12 C48 9 56 17 51 28 L39 24 Z" fill="url(#${u}_b)" stroke="#f8fafc" stroke-width="1.1"/>
        <path d="M52 29 C55 42 47 50 36 45 L40 33 Z" fill="url(#${u}_b)" stroke="#f8fafc" stroke-width="1.1"/>
        <rect x="37" y="21" width="8" height="8" rx="1.5" transform="rotate(-45 41 25)" fill="#b45309" stroke="#fbbf24" stroke-width="1"/>`;
      break;

    case 'boss_hammer': // Молот Костолома — Exclusive Boss Warhammer
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="45%" stop-color="#d97706"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(245,158,11,0.18)"/>
        <line x1="11" y1="53" x2="43" y2="21" stroke="#451a03" stroke-width="4.6" stroke-linecap="round"/>
        <rect x="29" y="10" width="22" height="14" rx="2.5" transform="rotate(45 40 17)" fill="url(#${u}_b)" stroke="#fef08a" stroke-width="1.2"/>`;
      break;

    case 'usp_pistol': // Тактический USP — Modern Tactical Handgun
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#cbd5e1"/>
          <stop offset="55%" stop-color="#64748b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="24" fill="rgba(148,163,184,0.14)"/>
        <rect x="16" y="21" width="34" height="8" rx="1.5" fill="url(#${u}_m)" stroke="#e2e8f0" stroke-width="0.9"/>
        <path d="M18 29 L28 29 L24 44 L15 44 Z" fill="#1e293b" stroke="#94a3b8" stroke-width="0.9"/>`;
      break;

    case 'colt': // Револьвер Кольт — Chrome Six-Shooter Magnum Revolver
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="55%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(251,191,36,0.14)"/>
        <g transform="rotate(-14 32 32)">
          <rect x="25" y="19" width="29" height="6.2" rx="1.4" fill="url(#${u}_m)" stroke="#f8fafc" stroke-width="0.9"/>
          <rect x="28" y="25.2" width="19" height="3.2" rx="1" fill="#64748b"/>
          <rect x="19" y="21" width="11" height="10" rx="2" fill="#e2e8f0" stroke="#fbbf24" stroke-width="1"/>
          <circle cx="24.5" cy="26" r="2.2" fill="#d97706"/>
          <path d="M19 29 L12 44 L20 45 L24 31 Z" fill="#78350f" stroke="#d97706" stroke-width="0.9"/>
        </g>`;
      break;

    case 'smg': // Пистолет-пулемёт — Submachine Gun
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e2e8f0"/>
          <stop offset="55%" stop-color="#475569"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="24" fill="rgba(245,158,11,0.14)"/>
        <rect x="13" y="22" width="38" height="9" rx="2" fill="url(#${u}_m)" stroke="#cbd5e1" stroke-width="0.9"/>
        <rect x="31" y="31" width="6" height="17" rx="1.5" transform="rotate(-10 34 39)" fill="#334155" stroke="#94a3b8" stroke-width="0.9"/>
        <path d="M16 31 L23 31 L20 43 L14 43 Z" fill="#78350f" stroke="#d97706" stroke-width="0.8"/>`;
      break;

    case 'ak47': // АК-47 — Assault Rifle
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e2e8f0"/>
          <stop offset="55%" stop-color="#475569"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(239,68,68,0.14)"/>
        <path d="M8 28 L19 25 L19 33 L8 37 Z" fill="#78350f" stroke="#d97706" stroke-width="0.9"/>
        <rect x="19" y="24" width="35" height="6.5" rx="1.5" fill="url(#${u}_m)" stroke="#cbd5e1" stroke-width="0.9"/>
        <path d="M32 30.5 C32 39 36 45 41 47 L36 48 C30 45 27 38 27 30.5 Z" fill="#92400e" stroke="#f59e0b" stroke-width="0.9"/>`;
      break;

    case 'pistol': // Охотничье ружьё — Heavy Pump-Action Shotgun
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f1f5f9"/>
          <stop offset="55%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
        <linearGradient id="${u}_w" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#b45309"/>
          <stop offset="100%" stop-color="#451a03"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(251,191,36,0.14)"/>
        <g transform="rotate(-28 32 32)">
          <rect x="20" y="24" width="36" height="4.2" rx="1.2" fill="url(#${u}_m)" stroke="#e2e8f0" stroke-width="0.8"/>
          <rect x="22" y="28.6" width="28" height="3.1" rx="1" fill="#64748b"/>
          <rect x="31" y="27.8" width="13" height="5.4" rx="1.6" fill="url(#${u}_w)" stroke="#fbbf24" stroke-width="0.9"/>
          <line x1="34" y1="28.2" x2="34" y2="33" stroke="#fde68a" stroke-width="0.9"/>
          <line x1="37.5" y1="28.2" x2="37.5" y2="33" stroke="#fde68a" stroke-width="0.9"/>
          <line x1="41" y1="28.2" x2="41" y2="33" stroke="#fde68a" stroke-width="0.9"/>
          <rect x="19" y="24.5" width="11" height="6.8" rx="1.4" fill="#d97706" stroke="#fef08a" stroke-width="0.9"/>
          <path d="M19 26 L6 31 L7 39 L18 33 L21 31 Z" fill="url(#${u}_w)" stroke="#f59e0b" stroke-width="0.9"/>
          <path d="M22 31.3 C22 35 26 35 26 31.3" fill="none" stroke="#cbd5e1" stroke-width="1.3"/>
        </g>`;
      break;

    case 'blunderbuss': // Двуствольный мушкетон «Гром» — Twin-Barrel Flared Shotgun
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#94a3b8"/>
          <stop offset="65%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#fb923c"/>
        </linearGradient>
        <linearGradient id="${u}_w" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#c2410c"/>
          <stop offset="100%" stop-color="#431407"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(249,115,22,0.17)"/>
        <g transform="rotate(-28 32 32)">
          <path d="M21 22.5 L51 22 L56 19.8 L56 26.8 L51 25.8 L21 26.2 Z" fill="url(#${u}_m)" stroke="#fed7aa" stroke-width="0.8"/>
          <path d="M21 27 L51 26.8 L56 26.2 L56 32.8 L51 30.8 L21 30.8 Z" fill="url(#${u}_m)" stroke="#fed7aa" stroke-width="0.8"/>
          <rect x="33" y="22" width="3.5" height="9.2" rx="1" fill="#f59e0b"/>
          <rect x="18" y="23" width="9" height="8.2" rx="1.5" fill="#ea580c" stroke="#fde047" stroke-width="0.9"/>
          <path d="M19 20 L22 23 M22 20 L24 23" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M18 25 L5 31 L7 40 L19 32.5 Z" fill="url(#${u}_w)" stroke="#fb923c" stroke-width="0.9"/>
        </g>`;
      break;

    case 'gatling': // Барабанный дробовик «Шквал» — Revolving Drum Auto-Shotgun
      defs = `
        <linearGradient id="${u}_m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e0f2fe"/>
          <stop offset="55%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="25" fill="rgba(56,189,248,0.16)"/>
        <g transform="rotate(-26 32 32)">
          <rect x="20" y="22.5" width="36" height="6.2" rx="1.5" fill="url(#${u}_m)" stroke="#bae6fd" stroke-width="0.9"/>
          <line x1="36" y1="24.5" x2="52" y2="24.5" stroke="#0f172a" stroke-width="1.4" stroke-dasharray="2.5 2"/>
          <circle cx="31" cy="33" r="7.4" fill="#1e293b" stroke="#fbbf24" stroke-width="1.5"/>
          <circle cx="31" cy="33" r="2.4" fill="#38bdf8"/>
          <circle cx="31" cy="28.3" r="1.2" fill="#fde047"/>
          <circle cx="35.2" cy="31" r="1.2" fill="#fde047"/>
          <circle cx="34" cy="36.2" r="1.2" fill="#fde047"/>
          <circle cx="28" cy="36.2" r="1.2" fill="#fde047"/>
          <circle cx="26.8" cy="31" r="1.2" fill="#fde047"/>
          <path d="M20 24 L6 29 L7 37 L20 30.5 Z" fill="#334155" stroke="#7dd3fc" stroke-width="0.9"/>
        </g>`;
      break;

    case 'spark_staff': // Посох гибельных искр — Violet Crystal Arcane Staff
      defs = `
        <radialGradient id="${u}_c" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#faf5ff"/>
          <stop offset="55%" stop-color="#c084fc"/>
          <stop offset="100%" stop-color="#6b21a8"/>
        </radialGradient>`;
      body = `
        <circle cx="39" cy="23" r="18" fill="rgba(192,132,252,0.2)"/>
        <line x1="12" y1="52" x2="38" y2="26" stroke="#78350f" stroke-width="4.2" stroke-linecap="round"/>
        <line x1="12" y1="52" x2="38" y2="26" stroke="#d97706" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M32 29 C30 20 37 12 46 13 M35 32 C44 34 52 27 51 18" fill="none" stroke="#e9d5ff" stroke-width="2" stroke-linecap="round"/>
        <polygon points="48,11 52,20 43,25 39,16" fill="url(#${u}_c)" stroke="#f3e8ff" stroke-width="1.1"/>
        <polyline points="29,14 34,16 31,21" fill="none" stroke="#e879f9" stroke-width="1.3" stroke-linecap="round"/>
        <polyline points="50,29 47,34 53,35" fill="none" stroke="#e879f9" stroke-width="1.3" stroke-linecap="round"/>`;
      break;

    case 'cinder_tome': // Посох багрового пепла — Pyromancer Cinder Staff
      defs = `
        <radialGradient id="${u}_f" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#fef08a"/>
          <stop offset="52%" stop-color="#f97316"/>
          <stop offset="100%" stop-color="#be123c"/>
        </radialGradient>`;
      body = `
        <circle cx="40" cy="23" r="19" fill="rgba(244,63,94,0.22)"/>
        <line x1="11" y1="53" x2="37" y2="27" stroke="#3f1d28" stroke-width="4.5" stroke-linecap="round"/>
        <line x1="13" y1="51" x2="36" y2="28" stroke="#fb7185" stroke-width="1.2" stroke-dasharray="3 3"/>
        <path d="M31 28 C29 19 36 11 44 10 C42 16 46 18 49 14 C54 22 49 32 39 33 Z" fill="url(#${u}_f)" stroke="#fde047" stroke-width="1.1"/>
        <circle cx="42" cy="23" r="4" fill="#fffbeb"/>
        <path d="M31 31 L39 23 L41 33" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>`;
      break;

    case 'void_orb': // Скипетр пустотного разлома — Void Rift Scepter
      defs = `
        <radialGradient id="${u}_v" cx="45%" cy="42%" r="55%">
          <stop offset="0%" stop-color="#312e81"/>
          <stop offset="68%" stop-color="#090717"/>
          <stop offset="100%" stop-color="#818cf8"/>
        </radialGradient>`;
      body = `
        <circle cx="41" cy="23" r="19" fill="rgba(129,140,248,0.22)"/>
        <line x1="11" y1="53" x2="36" y2="28" stroke="#4338ca" stroke-width="4.2" stroke-linecap="round"/>
        <line x1="11" y1="53" x2="36" y2="28" stroke="#fde047" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M30 25 C30 14 40 9 49 12 M39 34 C49 34 55 24 52 15" fill="none" stroke="#fde047" stroke-width="2" stroke-linecap="round"/>
        <circle cx="43" cy="21" r="8.2" fill="url(#${u}_v)" stroke="#a5b4fc" stroke-width="1.3"/>
        <ellipse cx="43" cy="21" rx="13" ry="4.2" transform="rotate(-32 43 21)" fill="none" stroke="#c7d2fe" stroke-width="1.4"/>
        <circle cx="46" cy="18" r="1.6" fill="#ffffff"/>`;
      break;

    default:
      body = `
        <polygon points="52,12 48,24 25,47 17,47 17,39 40,16" fill="#cbd5e1" stroke="#f8fafc" stroke-width="1.2"/>
        <path d="M13 34 L30 51" stroke="#eab308" stroke-width="3.5" stroke-linecap="round"/>`;
      break;
  }

  return makeSvgNode(
    `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${defs}</defs>
      ${body}
    </svg>`,
    className
  );
}

function createStatRuneSvg(kind) {
  let path = '';
  if (kind === 'hp') {
    path = `
      <path d="M12 20.5 C12 20.5 4 15.2 4 9.3 C4 6.4 6.3 4.2 9 4.2 C10.7 4.2 12 5.2 12 6.5 C12 5.2 13.3 4.2 15 4.2 C17.7 4.2 20 6.4 20 9.3 C20 15.2 12 20.5 12 20.5 Z" fill="#ef4444" stroke="#fca5a5" stroke-width="1.4"/>
      <path d="M8.2 8.2 C8.2 7.2 9 6.6 9.8 6.6" stroke="#fee2e2" stroke-width="1.4" stroke-linecap="round"/>`;
  } else if (kind === 'spd') {
    path = `
      <path d="M3 10 H15.5 C17.4 10 18.8 8.6 18.8 6.8 C18.8 5.1 17.4 3.8 15.7 3.8 C14.2 3.8 13.1 4.8 13 6.1" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M2 14 H18.2 C20.1 14 21.5 15.4 21.5 17.2 C21.5 18.9 20.1 20.2 18.4 20.2 C16.9 20.2 15.8 19.2 15.6 17.9" stroke="#fde047" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M5 17.5 H12" stroke="#f59e0b" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (kind === 'blk') {
    path = `
      <path d="M12 3 L19.5 6 V11.8 C19.5 16.5 16.2 19.9 12 21.4 C7.8 19.9 4.5 16.5 4.5 11.8 V6 L12 3 Z" fill="#7c3aed" stroke="#ddd6fe" stroke-width="1.4"/>
      <path d="M12 6 V18.5 M7.5 11.2 H16.5" stroke="#ede9fe" stroke-width="1.4" stroke-linecap="round"/>`;
  } else {
    // 'might' — crossed blades
    path = `
      <path d="M5 19 L18.5 5.5 M15 5 H19 V9" stroke="#fbbf24" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 19 L5.5 5.5 M9 5 H5 V9" stroke="#f87171" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="2.2" fill="#fef08a"/>`;
  }

  return makeSvgNode(
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${path}</svg>`,
    'stat-rune-svg'
  );
}

function createTalentRuneSvg(kind) {
  let inner = '';
  if (kind === 'droplet') {
    inner = `
      <path d="M12 2.5 C12 2.5 18.5 10.2 18.5 14.5 C18.5 18.1 15.6 21 12 21 C8.4 21 5.5 18.1 5.5 14.5 C5.5 10.2 12 2.5 12 2.5 Z" fill="#0284c7" stroke="#7dd3fc" stroke-width="1.5"/>
      <path d="M9.2 14.8 C9.2 16.5 10.5 17.8 12.1 18" stroke="#e0f2fe" stroke-width="1.5" stroke-linecap="round"/>`;
  } else if (kind === 'chalice') {
    inner = `
      <path d="M6.5 4.5 H17.5 L15.5 11.2 C15 13 13.7 14 12 14 C10.3 14 9 13 8.5 11.2 Z" fill="#0369a1" stroke="#7dd3fc" stroke-width="1.4"/>
      <path d="M12 14 V19 M8.5 19.5 H15.5" stroke="#fde047" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="12" cy="8.5" r="1.6" fill="#e0f2fe"/>`;
  } else if (kind === 'boots') {
    inner = `
      <path d="M4 13 H14.5 C16.8 13 18.5 11.4 18.5 9.4 C18.5 7.6 17 6.2 15.2 6.2 C13.8 6.2 12.6 7 12.2 8.2" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <path d="M3 17 H17.5 C19.5 17 20.8 18.2 20.8 19.6" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M7 9.5 H10.5" stroke="#fde047" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (kind === 'shield') {
    inner = `
      <path d="M12 3 L19 6.2 V12.2 C19 16.6 15.9 19.8 12 21.3 C8.1 19.8 5 16.6 5 12.2 V6.2 L12 3 Z" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5"/>
      <circle cx="12" cy="11.5" r="3.2" stroke="#bae6fd" stroke-width="1.4" fill="rgba(56,189,248,0.28)"/>`;
  } else if (kind === 'twin') {
    inner = `
      <circle cx="8.2" cy="13.5" r="4.2" fill="#0284c7" stroke="#bae6fd" stroke-width="1.4"/>
      <circle cx="15.8" cy="10.2" r="4.2" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.4"/>
      <path d="M11 6.5 L12.5 5 L14 6.5" stroke="#fde047" stroke-width="1.5" stroke-linecap="round"/>`;
  } else if (kind === 'crit') {
    inner = `
      <polygon points="12,2.5 14.8,9 21.5,9.5 16.2,14 17.8,20.8 12,17.2 6.2,20.8 7.8,14 2.5,9.5 9.2,9" fill="#9f1239" stroke="#fda4af" stroke-width="1.4"/>
      <circle cx="12" cy="12" r="2.2" fill="#fde047"/>`;
  } else {
    // crown / maelstrom_fury
    inner = `
      <path d="M4.5 17.5 L6.2 7.5 L10 11.8 L12 5.5 L14 11.8 L17.8 7.5 L19.5 17.5 Z" fill="#7c2d12" stroke="#fde047" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="12" cy="5" r="1.4" fill="#38bdf8"/>
      <path d="M5.5 19.8 H18.5" stroke="#fbbf24" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  return makeSvgNode(
    `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`,
    'talent-rune-svg'
  );
}

function createMandalaSvg() {
  return makeSvgNode(
    `<svg viewBox="0 0 220 220" width="220" height="220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="110" cy="110" r="102" stroke="rgba(229,184,92,0.34)" stroke-width="1.2" stroke-dasharray="6 5"/>
      <circle cx="110" cy="110" r="84" stroke="rgba(253,224,147,0.26)" stroke-width="1.5"/>
      <circle cx="110" cy="110" r="64" stroke="rgba(192,132,252,0.28)" stroke-width="1.1" stroke-dasharray="3 4"/>
      <polygon points="110,16 132,88 204,110 132,132 110,204 88,132 16,110 88,88" stroke="rgba(229,184,92,0.3)" stroke-width="1.2" fill="rgba(229,184,92,0.03)"/>
      <polygon points="44,44 126,94 176,176 94,126" stroke="rgba(229,184,92,0.22)" stroke-width="1"/>
      <polygon points="176,44 126,126 44,176 94,94" stroke="rgba(229,184,92,0.22)" stroke-width="1"/>
      <circle cx="110" cy="110" r="22" stroke="rgba(253,224,147,0.42)" stroke-width="1.4"/>
    </svg>`,
    'altar-mandala-svg'
  );
}

function createRuneHaloSvg() {
  return makeSvgNode(
    `<svg viewBox="0 0 116 116" width="116" height="116" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="58" cy="58" r="53" stroke="currentColor" stroke-opacity="0.48" stroke-width="1.2" stroke-dasharray="5 4"/>
      <circle cx="58" cy="58" r="44" stroke="currentColor" stroke-opacity="0.28" stroke-width="1"/>
      <polygon points="58,7 68,48 109,58 68,68 58,109 48,68 7,58 48,48" stroke="currentColor" stroke-opacity="0.32" stroke-width="1"/>
    </svg>`,
    'blessing-rune-halo'
  );
}

export function createBlessingRelicSvg(choice, className = 'blessing-relic-svg') {
  const id = String(choice?.id || 'wpn_power');
  const isWpn = isWeaponHighlightChoice(choice);
  const u = nextSvgUid('rel');

  let defs = '';
  let art = '';

  if (isWpn) {
    defs = `
      <radialGradient id="${u}_rg" cx="50%" cy="50%" r="52%">
        <stop offset="0%" stop-color="#fef9c3" stop-opacity="0.55"/>
        <stop offset="65%" stop-color="#f59e0b" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#78350f" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${u}_lg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fffbeb"/>
        <stop offset="50%" stop-color="#fde047"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>`;
    art = `
      <circle cx="44" cy="44" r="38" fill="url(#${u}_rg)"/>
      <circle cx="44" cy="44" r="33" stroke="#fde047" stroke-opacity="0.55" stroke-width="1.3" stroke-dasharray="4 3"/>
      <polygon points="44,10 51,33 74,44 51,55 44,78 37,55 14,44 37,33" fill="rgba(251,191,36,0.16)" stroke="#fef08a" stroke-width="1.2"/>
      <polygon points="64,20 59,34 33,60 25,60 25,52 51,26" fill="url(#${u}_lg)" stroke="#ffffff" stroke-width="1.3"/>
      <line x1="58" y1="26" x2="31" y2="53" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 46 L40 67 L36 70 L16 50 Z" fill="#f59e0b" stroke="#fef08a" stroke-width="1.1"/>
      <path d="M25 58 L16 67 L19 70 L28 61 Z" fill="#78350f" stroke="#fde047" stroke-width="1"/>
      <circle cx="16" cy="70" r="3.8" fill="#fef08a"/>
      <polygon points="44,16 46.5,22 53,22.5 48,26.8 49.5,33 44,29.5 38.5,33 40,26.8 35,22.5 41.5,22" fill="#fffbeb"/>`;
  } else {
    switch (id) {
      // ==================== MAGE EXCLUSIVE BLESSINGS ====================
      case 'mage_arcane_surge': // Тайное Могущество — Radiant Violet Arcane Crystal Staff Head & Rune Ring
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#d8b4fe" stop-opacity="0.55"/><stop offset="100%" stop-color="#3b0764" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="36" r="22" stroke="#e9d5ff" stroke-width="1.5" stroke-dasharray="5 3"/>
          <line x1="44" y1="48" x2="44" y2="76" stroke="#b45309" stroke-width="5" stroke-linecap="round"/>
          <path d="M30 44 C30 28 38 18 44 14 C50 18 58 28 58 44" fill="none" stroke="#fde047" stroke-width="2.2"/>
          <polygon points="44,16 54,34 44,50 34,34" fill="#a855f7" stroke="#faf5ff" stroke-width="1.6"/>
          <polygon points="44,23 49,34 44,43 39,34" fill="#f3e8ff"/>`;
        break;

      case 'mage_twin_cast': // Раздвоение Кометы — Twin Diverging Cyan-Violet Shooting Comets
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5"/><stop offset="100%" stop-color="#082f49" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M18 68 Q32 52 30 24" fill="none" stroke="#67e8f9" stroke-width="4" stroke-linecap="round"/>
          <path d="M22 70 Q42 54 64 28" fill="none" stroke="#c084fc" stroke-width="4" stroke-linecap="round"/>
          <polygon points="30,13 36,24 30,31 24,24" fill="#ecfeff" stroke="#22d3ee" stroke-width="1.5"/>
          <polygon points="67,18 72,29 63,34 59,24" fill="#faf5ff" stroke="#a855f7" stroke-width="1.5"/>
          <circle cx="20" cy="69" r="5" fill="#fef08a"/>`;
        break;

      case 'mage_elem_catalyst': // Резонанс Стихии — 4-Elemental Spiral Vortex (Fire, Water, Lightning, Air)
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="100%" stop-color="#1e1b4b" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 14 A30 30 0 0 1 74 44" fill="none" stroke="#ff5722" stroke-width="4.2" stroke-linecap="round"/>
          <path d="M74 44 A30 30 0 0 1 44 74" fill="none" stroke="#38bdf8" stroke-width="4.2" stroke-linecap="round"/>
          <path d="M44 74 A30 30 0 0 1 14 44" fill="none" stroke="#5eead4" stroke-width="4.2" stroke-linecap="round"/>
          <path d="M14 44 A30 30 0 0 1 44 14" fill="none" stroke="#fde047" stroke-width="4.2" stroke-linecap="round"/>
          <polygon points="44,26 52,38 62,44 52,50 44,62 36,50 26,44 36,38" fill="#e0f2fe" stroke="#ffffff" stroke-width="1.4"/>`;
        break;

      case 'mage_meteor_shower': // Звездопад Архонта — Blazing Diagonal Falling Meteor & Impact Crater
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.55"/><stop offset="100%" stop-color="#431407" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M68 14 L38 46 M74 24 L46 54 M58 12 L32 38" stroke="#fb923c" stroke-width="3.5" stroke-linecap="round"/>
          <circle cx="34" cy="52" r="14" fill="#ea580c" stroke="#fef08a" stroke-width="2"/>
          <circle cx="31" cy="54" r="7" fill="#fffbeb"/>
          <ellipse cx="34" cy="70" rx="22" ry="5" fill="none" stroke="#fde047" stroke-width="1.8"/>`;
        break;

      case 'mage_arcane_ward': // Сфера Отражения — Glowing Hexagonal Rune Barrier Dome
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#c084fc" stop-opacity="0.52"/><stop offset="100%" stop-color="#2e1065" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="44" r="27" fill="rgba(168,85,247,0.22)" stroke="#f3e8ff" stroke-width="2.2"/>
          <polygon points="44,20 65,32 65,56 44,68 23,56 23,32" fill="none" stroke="#e879f9" stroke-width="1.6"/>
          <path d="M16 28 L24 34 M72 28 L64 34" stroke="#fde047" stroke-width="2.4" stroke-linecap="round"/>
          <circle cx="44" cy="44" r="7" fill="#faf5ff"/>`;
        break;

      case 'mage_mana_font': // Астральный Колодец — Levitating Sapphire Mana Tear & Expanding Ripples
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.55"/><stop offset="100%" stop-color="#082f49" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 15 C44 15 60 33 60 44 C60 53 53 60 44 60 C35 60 28 53 28 44 C28 33 44 15 44 15 Z" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.8"/>
          <path d="M44 26 C44 26 52 37 52 44 C52 49 48.5 52 44 52" fill="#bae6fd"/>
          <ellipse cx="44" cy="69" rx="24" ry="5.5" fill="none" stroke="#7dd3fc" stroke-width="1.8"/>`;
        break;

      // ==================== GUNSLINGER EXCLUSIVE BLESSINGS ====================
      case 'gun_heavy_buckshot': // Вольфрамовая Картечь — Fanning Muzzle Blast & 7 Molten Pellets
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.52"/><stop offset="100%" stop-color="#78350f" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M18 66 L38 20 M18 66 L54 24 M18 66 L68 38 M18 66 L70 56" stroke="#f59e0b" stroke-width="2.2" stroke-dasharray="4 3"/>
          <circle cx="38" cy="19" r="4.2" fill="#fffbeb" stroke="#f97316" stroke-width="1.4"/>
          <circle cx="55" cy="23" r="4.5" fill="#fffbeb" stroke="#f97316" stroke-width="1.4"/>
          <circle cx="68" cy="37" r="4.2" fill="#fffbeb" stroke="#f97316" stroke-width="1.4"/>
          <circle cx="70" cy="55" r="4" fill="#fffbeb" stroke="#f97316" stroke-width="1.4"/>
          <circle cx="48" cy="41" r="3.8" fill="#fde047"/>
          <polygon points="14,72 28,68 24,58 12,62" fill="#f97316" stroke="#fef08a" stroke-width="1.3"/>`;
        break;

      case 'gun_ricochet': // Рикошет Свинца — Sharp Zig-Zag Bullet Ricochet Sparking Off Steel
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0.5"/><stop offset="100%" stop-color="#083344" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polyline points="16,66 42,24 68,54" fill="none" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
          <polygon points="42,14 46,23 55,24 47,29 49,38 42,32 35,38 37,29 29,24 38,23" fill="#22d3ee" stroke="#ffffff" stroke-width="1.2"/>
          <polygon points="73,59 63,56 69,48" fill="#ffffff"/>`;
        break;

      case 'gun_explosive_slugs': // Пороховая Детонация — Crimson Shell Exploding in Fiery Starburst
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.55"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polygon points="44,11 52,29 72,24 59,41 74,56 54,56 48,75 39,58 19,64 30,46 15,31 35,31" fill="#f97316" stroke="#fef08a" stroke-width="1.5"/>
          <rect x="37" y="31" width="14" height="22" rx="2" fill="#dc2626" stroke="#fffbeb" stroke-width="1.4"/>
          <rect x="36" y="52" width="16" height="9" rx="1.5" fill="#facc15" stroke="#ffffff" stroke-width="1.2"/>`;
        break;

      case 'gun_tactical_reload': // Пороховой Рывок — Revolving Cylinder + Emerald Wind Dash
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#34d399" stop-opacity="0.5"/><stop offset="100%" stop-color="#064e3b" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M12 34 H36 M8 46 H30 M14 58 H38" stroke="#6ee7b7" stroke-width="3" stroke-linecap="round"/>
          <circle cx="50" cy="44" r="19" fill="#1e293b" stroke="#fde047" stroke-width="2"/>
          <circle cx="50" cy="32" r="4" fill="#facc15"/><circle cx="60" cy="39" r="4" fill="#facc15"/>
          <circle cx="57" cy="51" r="4" fill="#facc15"/><circle cx="43" cy="51" r="4" fill="#facc15"/>
          <circle cx="40" cy="39" r="4" fill="#facc15"/>`;
        break;

      case 'ammo_pouch': // Последний Козырь — Golden Crowned Ace Shotgun Shell
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#facc15" stop-opacity="0.52"/><stop offset="100%" stop-color="#713f12" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <rect x="34" y="22" width="20" height="32" rx="3" fill="#dc2626" stroke="#fef08a" stroke-width="1.8"/>
          <rect x="32" y="52" width="24" height="16" rx="2" fill="#eab308" stroke="#fffbeb" stroke-width="1.6"/>
          <polygon points="35,19 38,11 44,16 50,11 53,19" fill="#fde047" stroke="#ffffff" stroke-width="1.1"/>`;
        break;

      case 'gun_shrapnel_mine': // Шрапнельный Капкан — Spiked Iron Powder Mine & Red Detonator Core
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f87171" stop-opacity="0.5"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <line x1="44" y1="14" x2="44" y2="74" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
          <line x1="14" y1="44" x2="74" y2="44" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
          <line x1="23" y1="23" x2="65" y2="65" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
          <line x1="65" y1="23" x2="23" y2="65" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
          <circle cx="44" cy="44" r="18" fill="#334155" stroke="#f1f5f9" stroke-width="2"/>
          <circle cx="44" cy="44" r="7.5" fill="#ef4444" stroke="#fef08a" stroke-width="1.5"/>`;
        break;

      // ==================== WARRIOR EXCLUSIVE BLESSINGS ====================
      case 'war_orbit_blades': // Клинки Предков — Three Golden Spectral Swords Orbiting in a Ring
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fde047" stop-opacity="0.5"/><stop offset="100%" stop-color="#78350f" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="44" r="24" fill="none" stroke="#fde047" stroke-width="1.5" stroke-dasharray="5 4"/>
          <polygon points="44,9 48,24 40,24" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.3"/>
          <polygon points="73,60 58,59 62,52" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.3"/>
          <polygon points="15,60 26,52 30,59" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.3"/>
          <circle cx="44" cy="44" r="7" fill="#f59e0b" stroke="#fffbeb" stroke-width="1.4"/>`;
        break;

      case 'war_seismic_slam': // Раскол Брусчатки — Greatsword Plunging Into Shattered Golden Fissure
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f59e0b" stop-opacity="0.52"/><stop offset="100%" stop-color="#451a03" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polygon points="40,14 48,14 47,54 44,61 41,54" fill="#f8fafc" stroke="#fbbf24" stroke-width="1.4"/>
          <rect x="33" y="22" width="22" height="5" rx="2" fill="#eab308"/>
          <polyline points="14,66 30,59 44,65 58,58 74,67" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
          <polyline points="24,73 44,65 63,74" fill="none" stroke="#f97316" stroke-width="2.2" stroke-linecap="round"/>`;
        break;

      case 'war_shield_thorns': // Шипованный Бастион — Steel Tower Shield Radiating Spikes
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#cbd5e1" stop-opacity="0.48"/><stop offset="100%" stop-color="#0f172a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M12 34 L22 38 M12 52 L22 48 M76 34 L66 38 M76 52 L66 48" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
          <path d="M44 15 L65 24 V44 C65 58 55 68 44 74 C33 68 23 58 23 44 V24 L44 15 Z" fill="#475569" stroke="#f8fafc" stroke-width="2"/>
          <polygon points="44,32 50,44 44,56 38,44" fill="#fbbf24" stroke="#ffffff" stroke-width="1.3"/>`;
        break;

      case 'war_whirlwind': // Вихрь Жнеца — Crimson 360° Spinning Dual Crescent Blades
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.52"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 14 A30 30 0 1 1 16 54" fill="none" stroke="#f87171" stroke-width="5" stroke-linecap="round"/>
          <path d="M44 23 A21 21 0 1 0 64 36" fill="none" stroke="#fef08a" stroke-width="3.2" stroke-linecap="round"/>
          <circle cx="44" cy="44" r="6" fill="#ffffff"/>`;
        break;

      case 'war_blood_cleave': // Казнь Кровопийцы — Heavy Crimson Executioner Axe & Blood Drop
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#dc2626" stop-opacity="0.54"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <line x1="22" y1="70" x2="58" y2="20" stroke="#cbd5e1" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M46 18 L69 29 C67 44 56 53 41 53 L37 36 Z" fill="#dc2626" stroke="#fecaca" stroke-width="1.8"/>
          <path d="M62 56 C62 56 69 65 69 69 C69 73 66 76 62 76 C58 76 55 73 55 69 C55 65 62 56 62 56 Z" fill="#ef4444" stroke="#fff1f2" stroke-width="1.2"/>`;
        break;

      case 'war_iron_banner': // Гнев Несокрушимого — Horned Berserker Helm Wreathed in Rage Flames
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fb923c" stop-opacity="0.55"/><stop offset="100%" stop-color="#431407" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M29 36 C17 32 14 20 20 14 C23 22 28 26 33 28" fill="#fde047" stroke="#ffffff" stroke-width="1.4"/>
          <path d="M59 36 C71 32 74 20 68 14 C65 22 60 26 55 28" fill="#fde047" stroke="#ffffff" stroke-width="1.4"/>
          <path d="M29 34 C29 24 59 24 59 34 V58 L44 68 L29 58 Z" fill="#334155" stroke="#f8fafc" stroke-width="1.8"/>
          <circle cx="38" cy="45" r="3.2" fill="#ef4444"/><circle cx="50" cy="45" r="3.2" fill="#ef4444"/>`;
        break;

      // ==================== SHARED RELICS ====================
      case 'crit_fang': // Жнец Черепов — Blazing Reaper Skull & Crossed Scythes
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.5"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 18 C31 18 24 27 24 39 C24 47 28 52 33 55 V65 H55 V55 C60 52 64 47 64 39 C64 27 57 18 44 18 Z" fill="#f1f5f9" stroke="#fca5a5" stroke-width="1.8"/>
          <circle cx="36" cy="39" r="5" fill="#dc2626"/><circle cx="52" cy="39" r="5" fill="#dc2626"/>
          <polygon points="44,45 41,51 47,51" fill="#1e293b"/>`;
        break;

      case 'greed_contract': // Печать Алчности — Golden Sovereign Coins & Crown Seal
      default:
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fde047" stop-opacity="0.48"/>
            <stop offset="100%" stop-color="#78350f" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_cn" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fffbeb"/>
            <stop offset="48%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="32" cy="50" r="15" fill="#ca8a04" stroke="#fef08a" stroke-width="1.3"/>
          <circle cx="56" cy="52" r="14" fill="#a16207" stroke="#fde047" stroke-width="1.2"/>
          <circle cx="45" cy="39" r="19" fill="url(#${u}_cn)" stroke="#ffffff" stroke-width="1.6"/>
          <circle cx="45" cy="39" r="14" fill="none" stroke="#92400e" stroke-width="1.2" stroke-dasharray="3 2"/>
          <polygon points="36,44 38,32 42.5,37 45,30 47.5,37 52,32 54,44" fill="#92400e" stroke="#fffbeb" stroke-width="1"/>`;
        break;
    }
  }

  return makeSvgNode(
    `<svg viewBox="0 0 88 88" width="88" height="88" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>${defs}</defs>
      ${art}
    </svg>`,
    className
  );
}

// ============================================================================
// UTILITY & PROGRESSION RESOLVERS
// ============================================================================

function formatTimeMMSS(seconds) {
  const s = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '' && text !== null && text !== undefined) node.textContent = text;
  return node;
}

function hexNumToCss(hexNum, fallback = '#e5b85c') {
  if (typeof hexNum !== 'number' || !Number.isFinite(hexNum)) return fallback;
  return `#${Math.max(0, Math.floor(hexNum)).toString(16).padStart(6, '0')}`;
}

function resolveMaxWeaponShopLevel(storeRef) {
  const fromStore = typeof storeRef?.getWeaponMaxShopLevel === 'function'
    ? Number(storeRef.getWeaponMaxShopLevel())
    : 0;
  return Math.max(WEAPON_MAX_LEVEL || 12, fromStore || 0);
}

function resolveWeaponUnlocked(state, storeRef, wDef) {
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

function resolveWeaponShopLevel(state, storeRef, wId, maxLvl = 12) {
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

function resolveWeaponUpgradeCost(state, storeRef, callbacks, wDef, shopLevel, maxLvl = 12) {
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

function resolveMasteryList(state, storeRef, callbacks, classId, lang) {
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

function isWeaponHighlightChoice(choice) {
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

function normalizeActivePerks(rawPerks) {
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

// ============================================================================
// MAIN UI MANAGER FACTORY
// ============================================================================

export function createUIManager(initialCallbacks = {}) {
  let callbacks = { ...initialCallbacks };
  let lang = 'ru';
  let muted = false;
  let volume = 0.75;
  let lastNonZeroVolume = 0.75;
  let musicVolume = 0.38;
  let autoAim = true;
  let attackEnabled = true;
  let activeHubTab = 'home'; // 'home' | 'heroes' | 'campaign' | 'arsenal' | 'shop' | 'store'
  let renderSeq = 0;

  const root = document.getElementById('ui-root') || document.body;
  root.innerHTML = '';

  // =========================================================================
  // 1. FLOATING 2D COMBAT TEXT POOL (48 Pre-Allocated Slots, Zero DOM Churn)
  // =========================================================================
  const floatingLayer = el('div', 'floating-text-layer');
  const FT_POOL_SIZE = 48;
  const ftPool = [];
  let ftCursor = 0;

  for (let i = 0; i < FT_POOL_SIZE; i++) {
    const slot = el('div', 'ft-slot');
    const inner = el('span', 'ft-inner');
    slot.appendChild(inner);
    floatingLayer.appendChild(slot);
    ftPool.push({ slot, inner, toggle: false });
  }
  root.appendChild(floatingLayer);

  function spawnFloatingText(text, screenX, screenY, color = '#f8fafc') {
    const entry = ftPool[ftCursor];
    ftCursor = (ftCursor + 1) % FT_POOL_SIZE;

    const x = Number.isFinite(screenX) ? Math.round(screenX) : Math.round(window.innerWidth * 0.5);
    const y = Number.isFinite(screenY) ? Math.round(screenY) : Math.round(window.innerHeight * 0.45);

    entry.slot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    entry.inner.textContent = String(text);
    entry.inner.style.color = color || '#f8fafc';

    const isCrit = String(text).includes('!') || String(text).length >= 6;
    entry.toggle = !entry.toggle;
    entry.inner.className = `ft-inner${isCrit ? ' ft-crit' : ''} ${entry.toggle ? 'ft-anim-a' : 'ft-anim-b'}`;
  }

  // =========================================================================
  // 2. IN-GAME COMBAT HUD (Cached DOM Nodes — Zero innerHTML per Frame)
  // =========================================================================
  const hudScreen = el('div', 'hud-screen hidden');
  const hudTopRow = el('div', 'hud-top-row');

  // Top-Left: HP, Block, Beast Seals, Companion
  const hudTopLeft = el('div', 'hud-top-left');
  const hpRowWrap = el('div', 'hp-row-wrap');
  const hpBarFrame = el('div', 'hp-bar-frame');
  const hpBarTrail = el('div', 'hp-bar-trail');
  const hpBarFill = el('div', 'hp-bar-fill');
  const hpBarText = el('div', 'hp-bar-text', '145 / 145');
  hpBarFrame.append(hpBarTrail, hpBarFill, hpBarText);

  const armorPill = el('div', 'armor-pill', 'Блок 26%');
  hpRowWrap.append(hpBarFrame, armorPill);

  const sealSlotsWrap = el('div', 'seal-slots');
  const sealLabel = el('span', 'seal-slots-label', 'Печати Зверя:');
  sealSlotsWrap.appendChild(sealLabel);
  const sealSlotNodes = [0, 1, 2, 3, 4].map(() => {
    const s = el('span', 'seal-slot');
    s.appendChild(
      makeSvgNode(
        `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2 C8 2 12.5 6.8 12.5 10 C12.5 12.5 10.5 14.2 8 14.2 C5.5 14.2 3.5 12.5 3.5 10 C3.5 6.8 8 2 8 2 Z" fill="currentColor"/></svg>`
      )
    );
    sealSlotsWrap.appendChild(s);
    return s;
  });

  const beastActiveBar = el('div', 'beast-active-bar hidden');
  const beastBarHead = el('div', 'beast-bar-head');
  const beastBarTitle = el('span', '', 'РЕЖИМ ЗВЕРЯ');
  const beastBarTimer = el('span', '', '8.0с');
  beastBarHead.append(beastBarTitle, beastBarTimer);
  const beastBarTrack = el('div', 'beast-bar-track');
  const beastBarFill = el('div', 'beast-bar-fill');
  beastBarTrack.appendChild(beastBarFill);
  beastActiveBar.append(beastBarHead, beastBarTrack);

  const companionPill = el('div', 'companion-pill hidden', 'Напарник в строю');
  hudTopLeft.append(hpRowWrap, sealSlotsWrap, beastActiveBar, companionPill);

  // Top-Center: Chapter Wave Timer, Boss Bar, Relic Crate Compass
  const hudTopCenter = el('div', 'hud-top-center');
  const waveBox = el('div', 'wave-box');
  const hudLevelTitle = el('div', 'hud-level-title', LEVELS[0].nameRu);
  const hudWaveTimer = el('div', 'hud-wave-timer', '01:04');
  waveBox.append(hudLevelTitle, hudWaveTimer);

  const bossBarBox = el('div', 'boss-bar-box hidden');
  const bossBarHeader = el('div', 'boss-bar-header');
  const bossBarName = el('span', 'boss-bar-name', 'КОСТЯНОЙ МЯСНИК');
  const bossHpNumbers = el('span', 'boss-hp-numbers', '920 / 920');
  bossBarHeader.append(bossBarName, bossHpNumbers);
  const bossBarFrame = el('div', 'boss-bar-frame');
  const bossBarFill = el('div', 'boss-bar-fill');
  bossBarFrame.appendChild(bossBarFill);
  bossBarBox.append(bossBarHeader, bossBarFrame);

  const relicHintPill = el('div', 'relic-hint-pill hidden');
  const relicCompass = el('span', 'relic-compass');
  const relicArrow = el('span', 'relic-arrow', '↑');
  relicCompass.appendChild(relicArrow);
  const relicHintText = el('span', 'relic-hint-text', 'Рунный Сундук с новым оружием!');
  const relicDistBadge = el('span', 'relic-dist-badge', '15м');
  relicHintPill.append(relicCompass, relicHintText, relicDistBadge);

  hudTopCenter.append(waveBox, bossBarBox, relicHintPill);

  // Top-Right: Gold, Kills, Auto-Aim, Floating Joystick Toggle, Sound, Home
  const hudTopRight = el('div', 'hud-top-right');
  const hudStatsPills = el('div', 'hud-stats-pills');

  const goldPill = el('div', 'hud-stat-pill gold-pill');
  const goldCoinIcon = makeSvgNode(
    `<svg viewBox="0 0 18 18" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="7.2" fill="#facc15" stroke="#fef08a" stroke-width="1.3"/><circle cx="9" cy="9" r="4.4" stroke="#92400e" stroke-width="1"/></svg>`
  );
  const hudGoldVal = el('span', '', '0');
  goldPill.append(goldCoinIcon, hudGoldVal);

  const killsPill = el('div', 'hud-stat-pill kills-pill');
  const killsSkullIcon = makeSvgNode(
    `<svg viewBox="0 0 18 18" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 2.2 C5.4 2.2 3 4.8 3 8.2 C3 10.4 4.1 12 5.5 12.8 V15.2 H12.5 V12.8 C13.9 12 15 10.4 15 8.2 C15 4.8 12.6 2.2 9 2.2 Z" fill="#e2e8f0"/><circle cx="6.8" cy="8.4" r="1.4" fill="#0f172a"/><circle cx="11.2" cy="8.4" r="1.4" fill="#0f172a"/></svg>`
  );
  const hudKillsVal = el('span', '', '0');
  killsPill.append(killsSkullIcon, hudKillsVal);
  hudStatsPills.append(goldPill, killsPill);

  const hudActionsRow = el('div', 'hud-actions-row');
  const autoAimBtn = el('button', 'hud-btn autoaim-btn is-on');
  autoAimBtn.type = 'button';
  autoAimBtn.textContent = 'Автоприцел: ВКЛ [Q]';

  const attackToggleBtn = el('button', 'hud-btn autoaim-btn attack-toggle-btn is-on');
  attackToggleBtn.type = 'button';
  attackToggleBtn.textContent = 'Атака: ВКЛ [E]';

  const touchPreviewBtn = el('button', 'hud-btn icon-btn');
  touchPreviewBtn.type = 'button';
  touchPreviewBtn.title = 'Плавающий джойстик (Вкл/Выкл)';
  touchPreviewBtn.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 20 20" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="7.5" stroke="#fde093" stroke-width="1.4" stroke-dasharray="3 2"/><circle cx="10" cy="10" r="3.2" fill="#e5b85c"/></svg>`
    )
  );

  const hudMuteBtn = el('button', 'hud-btn icon-btn sound-trigger-btn', '🔊');
  hudMuteBtn.type = 'button';
  hudMuteBtn.title = 'Настройки звука';

  const hudHomeBtn = el('button', 'hud-btn icon-btn hud-pause-btn');
  hudHomeBtn.type = 'button';
  hudHomeBtn.title = 'Пауза [Esc]';
  hudHomeBtn.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4" width="3.6" height="12" rx="1.2" fill="#fde093"/><rect x="11.4" y="4" width="3.6" height="12" rx="1.2" fill="#fde093"/></svg>`
    )
  );

  hudActionsRow.append(autoAimBtn, attackToggleBtn, touchPreviewBtn, hudMuteBtn, hudHomeBtn);
  hudTopRight.append(hudStatsPills, hudActionsRow);

  hudTopRow.append(hudTopLeft, hudTopCenter, hudTopRight);

  // =========================================================================
  // 3. SINGLE FLOATING LEFT-BOTTOM VIRTUAL JOYSTICK (iPhone / Touch Controls)
  // =========================================================================
  const isTouchCapable =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));
  let touchPreviewEnabled = false;

  const touchLayer = el('div', `touch-layer${isTouchCapable ? '' : ' hidden'}`);
  const leftZone = el('div', 'touch-zone-left');
  const leftBase = el('div', 'joystick-base left-stick');
  const leftRingSvg = makeSvgNode(
    `<svg viewBox="0 0 112 112" width="112" height="112" fill="none" xmlns="http://www.w3.org/2000/svg" class="joystick-ring-svg">
      <circle cx="56" cy="56" r="52" stroke="rgba(253,224,147,0.42)" stroke-width="1.5" stroke-dasharray="6 5"/>
      <polygon points="56,9 60,16 52,16" fill="rgba(253,224,147,0.55)"/>
      <polygon points="56,103 60,96 52,96" fill="rgba(253,224,147,0.55)"/>
      <polygon points="9,56 16,52 16,60" fill="rgba(253,224,147,0.55)"/>
      <polygon points="103,56 96,52 96,60" fill="rgba(253,224,147,0.55)"/>
    </svg>`
  );
  const leftKnob = el('div', 'joystick-knob');
  const leftCap = el('span', 'joystick-caption', 'ДВИЖЕНИЕ');
  leftBase.append(leftRingSvg, leftKnob, leftCap);
  leftZone.appendChild(leftBase);
  touchLayer.appendChild(leftZone);

  // =========================================================================
  // 4. BOTTOM COMBAT HUD DOCK (Blessing Mini-Badges, Weapon/Shells/Reload, XP)
  // =========================================================================
  const hudBottomDock = el('div', 'hud-bottom-dock');

  // Compact row of collected Blessing mini-badges above Weapon/XP bar
  const hudPerksRow = el('div', 'hud-perks-row hidden');

  // Weapon Bar + Tap-to-Reload [R] Button Row
  const hudWeaponRow = el('div', 'hud-weapon-row');
  const weaponHudBadge = el('div', 'weapon-hud-badge');
  const weaponHudIcon = el('span', 'weapon-hud-icon');
  weaponHudIcon.appendChild(createWeaponSvg('club', 'hud-wpn-svg'));

  const weaponHudCol = el('div', 'weapon-hud-col');
  const weaponHudMain = el('div', 'weapon-hud-main');
  const weaponHudName = el('span', 'weapon-hud-name', WEAPONS.club.nameRu);
  const weaponHudLvl = el('span', 'weapon-hud-lvl', 'Ранг боя 1');
  weaponHudMain.append(weaponHudName, weaponHudLvl);

  // Brass Shotgun Shell / Mana Charge Pips Row (Pre-allocated 20 slots)
  const MAX_AMMO_PIPS = 20;
  const weaponAmmoRow = el('div', 'weapon-ammo-row hidden');
  const ammoPipsWrap = el('div', 'ammo-pips-wrap');
  const ammoPipNodes = [];
  for (let i = 0; i < MAX_AMMO_PIPS; i++) {
    const pip = el('span', 'ammo-pip hidden');
    ammoPipsWrap.appendChild(pip);
    ammoPipNodes.push(pip);
  }
  const ammoNumericLabel = el('span', 'ammo-numeric-label', '5/5');
  weaponAmmoRow.append(ammoPipsWrap, ammoNumericLabel);

  // Animated Glowing Golden Reload Progress Bar (Shotguns) + Continuous Arcane Mana Bar (Mage)
  const reloadBarWrap = el('div', 'hud-reload-wrap hidden');
  const reloadBarHead = el('div', 'hud-reload-head');
  const reloadBarLabel = el('span', 'hud-reload-label', 'ПЕРЕЗАРЯДКА...');
  reloadBarHead.appendChild(reloadBarLabel);
  const reloadBarTrack = el('div', 'hud-reload-track');
  const reloadBarFill = el('div', 'hud-reload-fill');
  reloadBarTrack.appendChild(reloadBarFill);
  reloadBarWrap.append(reloadBarHead, reloadBarTrack);

  const manaBarWrap = el('div', 'hud-mana-wrap hidden');
  const manaBarHead = el('div', 'hud-mana-head');
  const manaBarLabel = el('span', 'hud-mana-label', '💧 МАНА: 120 / 120');
  const manaRegenTag = el('span', 'hud-mana-regen', '+9.5/с');
  manaBarHead.append(manaBarLabel, manaRegenTag);
  const manaBarTrack = el('div', 'hud-mana-track');
  const manaBarFill = el('div', 'hud-mana-fill');
  manaBarTrack.appendChild(manaBarFill);
  manaBarWrap.append(manaBarHead, manaBarTrack);

  weaponHudCol.append(weaponHudMain, weaponAmmoRow, reloadBarWrap, manaBarWrap);

  const overdriveBox = el('div', 'overdrive-box hidden');
  const overdriveLabel = el('span', 'overdrive-label', 'ОВЕРДРАЙВ');
  const overdriveTrack = el('div', 'overdrive-track');
  const overdriveFill = el('div', 'overdrive-fill');
  overdriveTrack.appendChild(overdriveFill);
  overdriveBox.append(overdriveLabel, overdriveTrack);

  weaponHudBadge.append(weaponHudIcon, weaponHudCol, overdriveBox);

  // Tap-to-Reload [R] Button right next to Weapon Bar
  const hudReloadBtn = el('button', 'hud-reload-btn hidden');
  hudReloadBtn.type = 'button';
  hudReloadBtn.title = 'Перезарядить оружие [R]';
  const hudReloadSvg = makeSvgNode(
    `<svg viewBox="0 0 22 22" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" class="reload-spin-icon">
      <path d="M17.2 8.2 A6.8 6.8 0 1 0 18 12.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <polygon points="18.5,4.5 18.8,9.4 13.9,8.6" fill="currentColor"/>
    </svg>`
  );
  const hudReloadKeyTag = el('span', 'hud-reload-key', '[R]');
  hudReloadBtn.append(hudReloadSvg, hudReloadKeyTag);

  hudWeaponRow.append(weaponHudBadge, hudReloadBtn);

  // Soul XP Bar
  const soulXpWrap = el('div', 'soul-xp-wrap');
  const soulXpMeta = el('div', 'soul-xp-meta');
  const soulXpTitle = el('span', 'soul-xp-title', 'Уровень душ 1');
  const soulXpNums = el('span', 'soul-xp-nums', '0 / 45');
  soulXpMeta.append(soulXpTitle, soulXpNums);
  const soulXpTrack = el('div', 'soul-xp-track');
  const soulXpFill = el('div', 'soul-xp-fill');
  soulXpFill.style.transform = 'scaleX(0)';
  soulXpTrack.appendChild(soulXpFill);
  soulXpWrap.append(soulXpMeta, soulXpTrack);

  hudBottomDock.append(hudPerksRow, hudWeaponRow);
  hudScreen.append(hudTopRow, touchLayer, hudBottomDock);
  root.appendChild(hudScreen);

  // =========================================================================
  // FLOATING SINGLE-JOYSTICK INPUT CONTROLLER
  // =========================================================================
  const touchState = {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: 0,
    active: false,
    moveActive: false,
    aimActive: false
  };

  const MAX_STICK_RADIUS = 46;
  const DEADZONE = 0.07;

  function ensureAutoAimForTouch() {
    if (!autoAim) {
      autoAim = true;
      callbacks.onToggleAutoAim?.(true);
      syncAutoAimButton();
    }
  }

  function setupFloatingLeftStick(zoneEl, baseEl, knobEl) {
    let activePointerId = null;
    let activeTouchId = null;
    let originX = 0;
    let originY = 0;

    const mapPt = (cx, cy) =>
      window.__toGameCoords ? window.__toGameCoords(cx, cy) : { x: cx, y: cy };

    const placeBaseAtFinger = (rawClientX, rawClientY) => {
      const pt = mapPt(rawClientX, rawClientY);
      originX = pt.x;
      originY = pt.y;
      baseEl.style.left = `${Math.round(pt.x)}px`;
      baseEl.style.top = `${Math.round(pt.y)}px`;
      baseEl.style.bottom = 'auto';
      baseEl.style.transform = 'translate3d(-50%, -50%, 0)';
      baseEl.classList.add('is-active');
    };

    const updateStickVector = (rawClientX, rawClientY) => {
      const pt = mapPt(rawClientX, rawClientY);
      const dx = pt.x - originX;
      const dy = pt.y - originY;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, MAX_STICK_RADIUS);
      const angle = dist > 0.0001 ? Math.atan2(dy, dx) : 0;

      const kx = Math.cos(angle) * clamped;
      const ky = Math.sin(angle) * clamped;
      knobEl.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;

      const norm = clamped / MAX_STICK_RADIUS;
      touchState.moveX = norm < DEADZONE ? 0 : kx / MAX_STICK_RADIUS;
      touchState.moveZ = norm < DEADZONE ? 0 : ky / MAX_STICK_RADIUS;
    };

    const releaseStick = () => {
      activePointerId = null;
      activeTouchId = null;
      baseEl.classList.remove('is-active');
      baseEl.style.left = '';
      baseEl.style.top = '';
      baseEl.style.bottom = '';
      baseEl.style.transform = '';
      knobEl.style.transform = 'translate3d(0, 0, 0)';
      touchState.moveX = 0;
      touchState.moveZ = 0;
      touchState.moveActive = false;
      touchState.active = false;
    };

    // Prevent iOS Safari scrolling / callouts inside touch zone
    zoneEl.addEventListener(
      'touchstart',
      (e) => {
        if (hudScreen.classList.contains('hidden')) return;
        e.preventDefault();
        if (touchLayer.classList.contains('hidden')) {
          touchLayer.classList.remove('hidden');
        }
        ensureAutoAimForTouch();

        // Fallback if PointerEvent didn't claim it
        if (!window.PointerEvent && activeTouchId === null && e.changedTouches.length > 0) {
          const t = e.changedTouches[0];
          activeTouchId = t.identifier;
          placeBaseAtFinger(t.clientX, t.clientY);
          touchState.moveActive = true;
          touchState.active = true;
          updateStickVector(t.clientX, t.clientY);
        }
      },
      { passive: false }
    );

    zoneEl.addEventListener(
      'touchmove',
      (e) => {
        if (activePointerId !== null || activeTouchId !== null) {
          e.preventDefault();
        }
        if (!window.PointerEvent && activeTouchId !== null) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === activeTouchId) {
              updateStickVector(t.clientX, t.clientY);
              break;
            }
          }
        }
      },
      { passive: false }
    );

    const onTouchEndFallback = (e) => {
      if (!window.PointerEvent && activeTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === activeTouchId) {
            releaseStick();
            break;
          }
        }
      }
    };
    zoneEl.addEventListener('touchend', onTouchEndFallback);
    zoneEl.addEventListener('touchcancel', onTouchEndFallback);

    // Primary PointerEvents handler (iOS 13+ Safari, Android Chrome, Desktop Preview)
    zoneEl.addEventListener('pointerdown', (e) => {
      if (activePointerId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch' && touchLayer.classList.contains('hidden')) {
        touchLayer.classList.remove('hidden');
      }
      ensureAutoAimForTouch();

      activePointerId = e.pointerId;
      try {
        zoneEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure
      }

      placeBaseAtFinger(e.clientX, e.clientY);
      touchState.moveActive = true;
      touchState.active = true;
      updateStickVector(e.clientX, e.clientY);
    });

    zoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activePointerId) return;
      updateStickVector(e.clientX, e.clientY);
    });

    const onPointerEnd = (e) => {
      if (e.pointerId !== activePointerId) return;
      releaseStick();
    };

    zoneEl.addEventListener('pointerup', onPointerEnd);
    zoneEl.addEventListener('pointercancel', onPointerEnd);
    zoneEl.addEventListener('lostpointercapture', () => {
      if (activePointerId !== null) releaseStick();
    });

    return releaseStick;
  }

  const releaseLeftStick = setupFloatingLeftStick(leftZone, leftBase, leftKnob);

  window.addEventListener(
    'touchstart',
    () => {
      if (!hudScreen.classList.contains('hidden')) {
        touchLayer.classList.remove('hidden');
        ensureAutoAimForTouch();
      }
    },
    { passive: true }
  );

  touchPreviewBtn.addEventListener('click', () => {
    touchPreviewEnabled = !touchPreviewEnabled;
    touchPreviewBtn.classList.toggle('is-on', touchPreviewEnabled);
    if (touchPreviewEnabled) {
      touchLayer.classList.remove('hidden');
      ensureAutoAimForTouch();
    } else if (!isTouchCapable) {
      touchLayer.classList.add('hidden');
      releaseLeftStick();
    }
  });

  hudReloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onReload?.();
  });

  // =========================================================================
  // 5. AAA DARK-FANTASY MAIN MENU & 5-DOCK HUB (МАГАЗИН • АРСЕНАЛ • ГЛАВНАЯ • ГЕРОИ • ТАЛАНТЫ)
  // =========================================================================
  const hubScreen = el('div', 'hub-screen');
  const hubShell = el('div', 'hub-shell');

  // --- Top Flanking Plaques (Matches reference Main Menu: Left Avatar/Уровень + Right Золото/Settings Gear) ---
  const hubHeader = el('header', 'hub-topbar hub-topbar-minimal');

  // Top-Left: Hero Avatar Medallion + Level Circle + Beveled «Уровень ♦» Crimson Bar Plaque
  const hubProfilePlaque = el('button', 'hub-topleft-profile');
  hubProfilePlaque.type = 'button';
  hubProfilePlaque.title = 'Выбор героя';

  const hubAvatarMedallion = el('div', 'hub-avatar-medallion');
  const hubAvatarImg = document.createElement('img');
  hubAvatarImg.className = 'hub-avatar-img';
  hubAvatarImg.src = CLASSES.warrior.portrait;
  hubAvatarImg.alt = CLASSES.warrior.nameRu;
  const hubAvatarLvlBadge = el('span', 'hub-avatar-lvl-badge', '1');
  hubAvatarMedallion.append(hubAvatarImg, hubAvatarLvlBadge);

  const hubLevelPlaque = el('div', 'hub-level-plaque');
  const hubLevelTopRow = el('div', 'hub-level-top-row');
  const hubTitle = el('span', 'hub-level-word', 'Уровень');
  const hubRubyGem = makeSvgNode(
    `<svg viewBox="0 0 18 22" width="14" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" class="hub-ruby-gem">
      <polygon points="9,1 16.5,11 9,21 1.5,11" fill="#fb7185" stroke="#ffe4e6" stroke-width="1"/>
      <polygon points="9,3.2 13.8,11 9,18.8 4.2,11" fill="#e11d48"/>
      <polygon points="9,3.2 11.8,10.2 9,11.5 6.2,10.2" fill="#fda4af" opacity="0.85"/>
    </svg>`
  );
  hubLevelTopRow.append(hubTitle, hubRubyGem);

  const hubLevelTrack = el('div', 'hub-level-track');
  const hubLevelFill = el('div', 'hub-level-fill');
  hubLevelTrack.appendChild(hubLevelFill);
  hubLevelPlaque.append(hubLevelTopRow, hubLevelTrack);
  hubProfilePlaque.append(hubAvatarMedallion, hubLevelPlaque);

  // Top-Right: Beveled «Золото 1 000 🪙» Plaque + Circular Settings Gear Button
  const hubTreasury = el('div', 'hub-topright-bar');
  const treasuryGoldPill = el('div', 'treasury-gold-pill hub-gold-plaque');
  const hubGoldLabel = el('span', 'hub-gold-word', 'Золото');
  const hubGoldRight = el('div', 'hub-gold-val-wrap');
  const hubGoldAmount = el('span', 'treasury-gold-val', '60');
  const treasuryCoinSvg = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" xmlns="http://www.w3.org/2000/svg" class="hub-gold-coin-svg">
      <circle cx="12" cy="12" r="10" fill="#eab308" stroke="#fef08a" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="7" fill="#ca8a04" stroke="#fde047" stroke-width="1"/>
      <path d="M10.5 8.5 H13.8 L11.5 15.5" stroke="#fef9c3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );
  hubGoldRight.append(hubGoldAmount, treasuryCoinSvg);
  treasuryGoldPill.append(hubGoldLabel, hubGoldRight);

  const hubResetBtn = el('button', 'sound-reset-progress-btn', '🔄 Сбросить весь прогресс');
  hubResetBtn.type = 'button';
  hubResetBtn.title = 'Сбросить весь прогресс до нуля';

  const hubMuteBtn = el('button', 'hub-gear-btn sound-trigger-btn');
  hubMuteBtn.type = 'button';
  hubMuteBtn.title = 'Настройки звука и игры';
  hubMuteBtn.setAttribute('aria-label', 'Настройки');
  hubMuteBtn.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 8.6 A3.4 3.4 0 1 0 12 15.4 A3.4 3.4 0 1 0 12 8.6 Z" stroke="#e2d9eb" stroke-width="1.8"/>
        <path d="M19.4 13.2 L21 12 L19.4 10.8 L19.6 8.8 L17.8 8 L17 6.2 L15 6.4 L13.8 4.8 L12 5.4 L10.2 4.8 L9 6.4 L7 6.2 L6.2 8 L4.4 8.8 L4.6 10.8 L3 12 L4.6 13.2 L4.4 15.2 L6.2 16 L7 17.8 L9 17.6 L10.2 19.2 L12 18.6 L13.8 19.2 L15 17.6 L17 17.8 L17.8 16 L19.6 15.2 Z" stroke="#cbbce0" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`
    )
  );
  const hubHeaderFiligree = el('div', 'hub-header-filigree');
  const hubFiligreeImg = document.createElement('img');
  hubFiligreeImg.src = './assets/ui/hub_top_filigree.png?v=20261117z22';
  hubFiligreeImg.className = 'hub-filigree-img';
  hubFiligreeImg.alt = '';
  hubFiligreeImg.draggable = false;
  hubHeaderFiligree.appendChild(hubFiligreeImg);
  hubTreasury.append(treasuryGoldPill, hubMuteBtn);
  hubHeader.append(hubProfilePlaque, hubHeaderFiligree, hubTreasury);

  // --- Hub Body Container ---
  const hubBody = el('div', 'hub-body');

  // =========================================================================
  // TAB 0 (DEFAULT): 🏰 ГЛАВНАЯ (Centered Live 3D Hero on Cracked Pedestal + «Кампания» / «В ПУТЬ!»)
  // =========================================================================
  const homePanel = el('section', 'hub-panel hub-panel-home');
  const homeRotateHint = el('div', 'hub-rotate-hint', 'ПКМ — повернуть героя');

  const homeCtaStack = el('div', 'home-cta-stack');
  const homeWeaponWarn = el('button', 'launch-weapon-warn home-weapon-warn hidden');
  homeWeaponWarn.type = 'button';

  const homeJourneyBtn = el('button', 'home-journey-btn');
  homeJourneyBtn.type = 'button';
  const homeJourneyLabel = el('span', 'home-journey-label', 'В ПУТЬ!');
  homeJourneyBtn.appendChild(homeJourneyLabel);

  homeCtaStack.append(homeWeaponWarn, homeJourneyBtn);
  homePanel.append(homeCtaStack);

  // =========================================================================
  // TAB 1: ⚔️ ГЕРОИ (Live 3D Hero on Pedestal + Left Portrait Rail + Right Stats Card)
  // =========================================================================
  const heroesPanel = el('section', 'hub-panel hub-panel-heroes hidden');

  // Column 1: Left Vertical 4-Slot Portrait Rail
  const heroRosterRail = el('aside', 'hero-roster-rail');
  const emblemDotButtons = {};
  for (const cid of CLASS_ORDER) {
    const cDef = CLASSES[cid];
    const dotBtn = el('button', 'stage-emblem-dot roster-portrait-slot');
    dotBtn.type = 'button';
    dotBtn.dataset.classId = cid;
    const dotImg = document.createElement('img');
    dotImg.src = cDef.portrait;
    dotImg.alt = cDef.nameRu;
    dotImg.className = 'stage-dot-portrait';
    dotBtn.appendChild(dotImg);
    heroRosterRail.appendChild(dotBtn);
    emblemDotButtons[cid] = dotBtn;
  }
  // 4th Locked Teaser Hunter Slot (matches reference rail)
  const lockedRosterSlot = el('button', 'roster-portrait-slot is-locked-slot');
  lockedRosterSlot.type = 'button';
  lockedRosterSlot.title = 'Тайный охотник (скоро)';
  lockedRosterSlot.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 28 28" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="12" width="16" height="12" rx="2.5" fill="#231f33" stroke="#9ca3af" stroke-width="1.6"/>
        <path d="M9.5 12 V9 C9.5 6.5 11.5 4.5 14 4.5 C16.5 4.5 18.5 6.5 18.5 9 V12" stroke="#cbd5e1" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="14" cy="17.5" r="1.8" fill="#cbd5e1"/>
      </svg>`
    )
  );
  heroRosterRail.appendChild(lockedRosterSlot);

  // Column 2: Center-Left Full-Height 3D Hero Stage flanked by circular ‹ › arrows
  const heroStageArea = el('div', 'hero-stage-area');
  const heroStageControls = el('div', 'hero-stage-controls');

  const stagePrevBtn = el('button', 'stage-carousel-btn prev');
  stagePrevBtn.type = 'button';
  stagePrevBtn.setAttribute('aria-label', 'Предыдущий класс');
  const stagePrevImg = document.createElement('img');
  stagePrevImg.className = 'switch-arrow-icon is-prev';
  stagePrevImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z22';
  stagePrevImg.alt = '';
  stagePrevImg.draggable = false;
  stagePrevBtn.appendChild(stagePrevImg);

  const stageCenterSpacer = el('div', 'stage-center-window');

  const stageNextBtn = el('button', 'stage-carousel-btn next');
  stageNextBtn.type = 'button';
  stageNextBtn.setAttribute('aria-label', 'Следующий класс');
  const stageNextImg = document.createElement('img');
  stageNextImg.className = 'switch-arrow-icon is-next';
  stageNextImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z22';
  stageNextImg.alt = '';
  stageNextImg.draggable = false;
  stageNextBtn.appendChild(stageNextImg);

  heroStageControls.append(stagePrevBtn, stageCenterSpacer, stageNextBtn);
  heroStageArea.append(heroStageControls);

  // Column 3: Right Dock (Ornate Beveled Hero Info Card + Giant Beveled Crimson-Gold «⚔️ В БОЙ!» Plaque)
  const heroShowcaseDocks = el('div', 'hero-right-dock');

  const heroInfoCard = el('div', 'hero-info-card');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    heroInfoCard.appendChild(el('span', `gothic-card-clasp ${pos}`));
  }

  const heroCardHeader = el('div', 'hero-card-header');
  const heroPortraitFrame = el('div', 'hero-portrait-frame');
  const heroPortraitAura = el('div', 'hero-portrait-aura');
  const heroPortraitImg = document.createElement('img');
  heroPortraitImg.className = 'hero-portrait-img';
  heroPortraitImg.src = CLASSES.warrior.portrait;
  heroPortraitImg.alt = CLASSES.warrior.nameRu;
  const cornerTL = el('span', 'portrait-corner tl');
  const cornerTR = el('span', 'portrait-corner tr');
  const cornerBL = el('span', 'portrait-corner bl');
  const cornerBR = el('span', 'portrait-corner br');
  heroPortraitFrame.append(heroPortraitAura, heroPortraitImg, cornerTL, cornerTR, cornerBL, cornerBR);

  const heroTitleWrap = el('div', 'hero-title-wrap');
  const heroClassName = el('h2', 'hero-class-name', CLASSES.warrior.nameRu);
  const heroPillsRow = el('div', 'hero-role-pills-row');
  const heroRolePill = el('span', 'hero-role-pill', CLASSES.warrior.roleRu);
  const changeChapterBtn = el('button', 'btn-change-chapter', '📖 Глава I ›');
  changeChapterBtn.type = 'button';
  heroPillsRow.append(heroRolePill, changeChapterBtn);
  heroTitleWrap.append(heroClassName, heroPillsRow);
  heroCardHeader.append(heroPortraitFrame, heroTitleWrap);

  const heroLoreLine = el('p', 'hero-lore-line', CLASS_META.warrior.loreShortRu);

  // Stylized RPG 10-Segment Beveled Crystal Rune Bars
  const heroStatsBars = el('div', 'hero-stats-bars');
  function createSegmentedRuneBar(kind, defaultLabel) {
    const row = el('div', `stat-bar-row stat-kind-${kind}`);
    const head = el('div', 'stat-bar-head');
    head.appendChild(createStatRuneSvg(kind));
    const lbl = el('span', 'stat-bar-label', defaultLabel);
    head.appendChild(lbl);

    const gauge = el('div', `rune-gauge gauge-${kind}`);
    const segs = [];
    for (let i = 0; i < 10; i++) {
      const seg = el('span', 'rune-seg');
      gauge.appendChild(seg);
      segs.push(seg);
    }

    const val = el('span', 'stat-bar-val', '0');
    row.append(head, gauge, val);
    heroStatsBars.appendChild(row);
    return { lbl, segs, val };
  }
  const statHpBar = createSegmentedRuneBar('hp', 'Здоровье');
  const statSpdBar = createSegmentedRuneBar('spd', 'Скорость');
  const statBlkBar = createSegmentedRuneBar('blk', 'Блок');

  // Equipped Weapon Card with Custom Vector Weapon Art + Beveled «Арсенал ›» Button
  const heroWeaponChip = el('button', 'hero-weapon-chip');
  heroWeaponChip.type = 'button';
  const heroWeaponChipLeft = el('div', 'hero-weapon-chip-left');
  const heroWeaponChipIcon = el('span', 'hero-weapon-chip-icon');
  heroWeaponChipIcon.appendChild(createWeaponSvg('club'));
  const heroWeaponChipText = el('div', 'hero-weapon-chip-text');
  const heroWeaponChipName = el('span', 'hero-weapon-chip-name', WEAPONS.club.nameRu);
  const heroWeaponChipLvl = el('span', 'hero-weapon-chip-lvl', 'Ур. 1/12');
  heroWeaponChipText.append(heroWeaponChipName, heroWeaponChipLvl);
  heroWeaponChipLeft.append(heroWeaponChipIcon, heroWeaponChipText);

  const heroWeaponChipRight = el('span', 'hero-weapon-chip-cta');
  const heroWeaponChipDot = el('span', 'chip-upg-dot hidden');
  const heroWeaponChipArrow = el('span', '', 'Арсенал ›');
  heroWeaponChipRight.append(heroWeaponChipDot, heroWeaponChipArrow);
  heroWeaponChip.append(heroWeaponChipLeft, heroWeaponChipRight);

  // Mage 4-Element School Selector (visible when Mage is selected)
  const mageElementsBox = el('div', 'mage-elements-box hidden');
  const mageElemHead = el('div', 'mage-elem-head');
  const mageElemTitle = el('span', 'mage-elem-title', '✦ Стихия посоха:');
  const mageElemStatus = el('span', 'mage-elem-status', 'Первая — бесплатно!');
  mageElemHead.append(mageElemTitle, mageElemStatus);
  const mageElemRow = el('div', 'mage-elem-pills-row');
  const mageElemDesc = el('div', 'mage-elem-desc', '');
  mageElementsBox.append(mageElemHead, mageElemRow, mageElemDesc);

  heroInfoCard.append(heroCardHeader, heroLoreLine, heroStatsBars, mageElementsBox, heroWeaponChip);

  // Keep lightweight hidden refs for backward-compatible renderHub updates
  const chapterMiniCard = el('div', 'hidden');
  const chapterMiniImg = document.createElement('img');
  const chapterMiniActBadge = el('span', '');
  const chapterMiniFeature = el('span', '');
  const chapterMiniTitle = el('div', '');

  const launchWeaponWarn = el('button', 'launch-weapon-warn hidden');
  launchWeaponWarn.type = 'button';

  const launchBattleBtn = el('button', 'launch-battle-btn gothic-plaque-battle-btn');
  launchBattleBtn.type = 'button';
  const launchMainText = el('span', 'launch-main-text', '⚔️ В БОЙ!');
  const launchSubText = el('span', 'launch-sub-text', `${LEVELS[0].nameRu}`);
  launchBattleBtn.append(launchMainText, launchSubText);

  heroShowcaseDocks.append(heroInfoCard, launchWeaponWarn, launchBattleBtn);
  heroesPanel.append(heroStageArea, heroShowcaseDocks);

  // =========================================================================
  // TAB 2: 📖 КАМПАНИЯ — СЦЕНА 1: КАРТА МИРА (4 РЕГИОНА) -> ФИОЛЕТОВЫЙ ТУМАН -> СЦЕНА 2: ТУМАННЫЙ ЛЕС (1..25)
  // =========================================================================
  const WORLD_REGION_DEFS = [
    {
      id: 'forest',
      titleRu: 'Туманный лес',
      subRu: '25 этапов • Открыто',
      x: 29,
      y: 26,
      unlocked: true
    }
  ];

  // Exact coordinates of the 25 stone tiles along the serpentine road in forest_stages_loop.mp4!
  const FOREST_PATH_COORDS = [
    [27.2, 82.0], [22.6, 70.8], [19.2, 40.5], [20.8, 23.6], [32.2, 45.2],
    [30.6, 31.2], [37.3, 30.2], [43.4, 36.2], [53.3, 40.8], [58.3, 39.4],
    [62.1, 33.5], [59.3, 26.8], [63.0, 24.4], [78.8, 30.0], [85.8, 27.2],
    [92.8, 31.6], [90.3, 45.6], [85.0, 57.5], [82.0, 71.5], [82.0, 81.2],
    [62.6, 84.8], [56.1, 81.2], [55.0, 70.8], [59.8, 63.2], [64.8, 57.2]
  ];

  let campaignSubView = 'world'; // 'world' | 'forest'
  let mistAnimActive = false;

  const campaignPanel = el('section', 'hub-panel hub-panel-campaign hidden');
  campaignPanel.id = 'campaignPanel';
  const campaignBox = el('div', 'campaign-fullscreen-shell');

  // --- SCENE 2: WORLD REGIONS MAP (Full-Screen Animated Video + Only Close X & Stylized Misty Forest Button!) ---
  const campaignWorldView = el('div', 'campaign-world-view');
  const worldStageFrame = el('div', 'campaign-map-stage-frame is-world-fullscreen');
  const campaignWorldBg = document.createElement('video');
  campaignWorldBg.className = 'campaign-map-bg-img campaign-map-video';
  campaignWorldBg.src = './assets/ui/world_map_loop.mp4?v=20261117z22';
  campaignWorldBg.poster = './assets/ui/world_map_clean_hq.jpg?v=20261117z22';
  campaignWorldBg.autoplay = true;
  campaignWorldBg.loop = true;
  campaignWorldBg.muted = true;
  campaignWorldBg.playsInline = true;
  campaignWorldBg.setAttribute('playsinline', '');
  campaignWorldBg.setAttribute('webkit-playsinline', '');
  const campaignWorldVignette = el('div', 'campaign-map-vignette');

  const worldTopBar = el('div', 'campaign-map-topbar is-world-minimal-bar');
  const worldLeftSpacer = el('div', 'map-topbar-left');
  const worldHeaderTitle = el('h2', 'campaign-map-heading hidden', 'Карта Мира — Выбор региона');
  const worldRightControls = el('div', 'map-topbar-right');
  const worldProgressPill = el('span', 'campaign-map-progress-pill hidden', 'Открыт: Туманный лес');
  const campaignBackHeroBtn = el('button', 'map-close-x-btn', '✕');
  campaignBackHeroBtn.type = 'button';
  campaignBackHeroBtn.title = 'Вернуться в меню';
  campaignBackHeroBtn.setAttribute('aria-label', 'Закрыть карту');
  worldLeftSpacer.appendChild(worldProgressPill);
  worldRightControls.appendChild(campaignBackHeroBtn);
  worldTopBar.append(worldLeftSpacer, worldHeaderTitle, worldRightControls);

  const worldPinsLayer = el('div', 'world-pins-layer');
  let worldForestStarsLabel = null;
  for (const reg of WORLD_REGION_DEFS) {
    const pin = el('button', `world-region-pin${reg.unlocked ? ' is-open' : ' is-locked'}`);
    pin.type = 'button';
    pin.style.left = `${reg.x}%`;
    pin.style.top = `${reg.y}%`;

    const badge = el('div', 'world-pin-crest', reg.unlocked ? '🌲' : '🔒');
    const title = el('div', 'world-pin-title', reg.titleRu);
    const sub = el('div', 'world-pin-sub', reg.subRu);
    pin.append(badge, title, sub);
    if (reg.unlocked) {
      worldForestStarsLabel = sub;
      const enterHint = el('div', 'world-pin-enter-hint', 'Нажмите для входа ›');
      pin.appendChild(enterHint);
    }

    pin.addEventListener('click', () => {
      if (reg.unlocked) {
        triggerVioletMistTransition(() => {
          setActiveTab('campaign_forest');
        });
      } else {
        showToast(`🔒 Регион «${reg.titleRu}» откроется после прохождения Туманного леса!`, 2400);
      }
    });
    worldPinsLayer.appendChild(pin);
  }
  worldStageFrame.append(campaignWorldBg, campaignWorldVignette, worldPinsLayer);
  campaignWorldView.append(worldTopBar, worldStageFrame);

  // --- SCENE 3: MISTY FOREST 25-STAGE WINDING PATH MAP (Animated Video Scene + 25 Stone Tile Nodes!) ---
  const campaignForestView = el('div', 'campaign-forest-view hidden');
  const forestStageFrame = el('div', 'campaign-map-stage-frame is-forest-frame');
  const forestBgImg = document.createElement('video');
  forestBgImg.className = 'campaign-map-bg-img campaign-map-video';
  forestBgImg.src = './assets/ui/forest_stages_loop.mp4?v=20261117z22';
  forestBgImg.poster = './assets/ui/forest_stages_clean_hq.jpg?v=20261117z22';
  forestBgImg.autoplay = true;
  forestBgImg.loop = true;
  forestBgImg.muted = true;
  forestBgImg.playsInline = true;
  forestBgImg.setAttribute('playsinline', '');
  forestBgImg.setAttribute('webkit-playsinline', '');
  const forestVignette = el('div', 'campaign-map-vignette is-forest');

  const forestTopBar = el('div', 'campaign-map-topbar');
  const forestLeftControls = el('div', 'map-topbar-left');
  const forestBackWorldBtn = el('button', 'map-gothic-back-btn', '← Карта мира');
  forestBackWorldBtn.type = 'button';
  forestLeftControls.appendChild(forestBackWorldBtn);

  const campaignHeading = el('h2', 'campaign-map-heading', 'Туманный лес — 25 Глав');
  const campaignProgressHint = el('span', 'campaign-map-progress-pill', '★ 0 / 75 • Глав: 1/25');

  const forestRightControls = el('div', 'map-topbar-right');
  const diffSwitchWrap = el('div', 'forest-diff-switch');
  const diffNormalBtn = el('button', 'forest-diff-btn is-active', 'Обычный');
  diffNormalBtn.type = 'button';
  const diffHardBtn = el('button', 'forest-diff-btn', 'Сложный');
  diffHardBtn.type = 'button';
  diffSwitchWrap.append(diffNormalBtn, diffHardBtn);

  const forestCloseMapBtn = el('button', 'map-close-x-btn', '✕');
  forestCloseMapBtn.type = 'button';
  forestCloseMapBtn.title = 'Вернуться в меню';
  forestCloseMapBtn.setAttribute('aria-label', 'Закрыть карту');

  forestRightControls.append(campaignProgressHint, diffSwitchWrap, forestCloseMapBtn);
  forestTopBar.append(forestLeftControls, campaignHeading, forestRightControls);

  const forestBoard = el('div', 'forest-map-board');
  const forestPathSvg = makeSvgNode(
    `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="forest-path-svg" aria-hidden="true">
      <polyline class="forest-path-shadow" fill="none" points="${FOREST_PATH_COORDS.map(([x, y]) => `${x},${y}`).join(' ')}" />
      <polyline class="forest-path-line" fill="none" points="${FOREST_PATH_COORDS.map(([x, y]) => `${x},${y}`).join(' ')}" />
    </svg>`
  );
  const forestNodesLayer = el('div', 'forest-nodes-layer');
  const forestNodeButtons = [];
  for (let idx = 0; idx < LEVELS.length; idx++) {
    const lvlNum = idx + 1;
    const [px, py] = FOREST_PATH_COORDS[idx] || [50, 50];
    const btn = el('button', 'forest-stage-node');
    btn.type = 'button';
    btn.style.left = `${px}%`;
    btn.style.top = `${py}%`;

    const levBadge = el('span', 'forest-node-lev-tag hidden', `Гл. ${lvlNum}`);
    const coin = el('span', 'forest-node-coin', String(lvlNum));
    const starsRow = el('span', 'forest-node-stars');
    btn.append(levBadge, coin, starsRow);
    btn.addEventListener('click', () => navigateCampaignChapter(lvlNum));
    forestNodesLayer.appendChild(btn);
    forestNodeButtons.push({ btn, levBadge, coin, starsRow, lvlNum });
  }
  forestBoard.append(forestPathSvg, forestNodesLayer);
  forestStageFrame.append(forestBgImg, forestVignette, forestBoard);

  const forestBottomStrip = el('div', 'forest-bottom-strip');
  const forestInfoCol = el('div', 'forest-stage-info-col');
  const campaignActPill = el('span', 'campaign-meta-pill', 'Акт I • Глава I');
  const campaignChapterTitle = el('h3', 'forest-stage-title', LEVELS[0].nameRu);
  const campaignChapterLore = el('p', 'forest-stage-lore', LEVELS[0].subtitleRu);
  const forestGoalsRow = el('div', 'forest-goals-row');
  const forestGoal1 = el('span', 'forest-goal-chip', '★ Победа');
  const forestGoal2 = el('span', 'forest-goal-chip', '★★ ≥ 55% HP');
  const forestGoal3 = el('span', 'forest-goal-chip', '★★★ ≤ 95с');
  forestGoalsRow.append(campaignActPill, forestGoal1, forestGoal2, forestGoal3);
  forestInfoCol.append(campaignChapterTitle, campaignChapterLore, forestGoalsRow);

  const forestActionsCol = el('div', 'forest-stage-actions-col');
  const campaignWpnCheckBtn = el('button', 'campaign-wpn-check is-ready');
  campaignWpnCheckBtn.type = 'button';
  const campaignWpnCheckIcon = el('span', 'campaign-wpn-check-icon');
  const campaignWpnCheckText = el('span', 'campaign-wpn-check-text', 'Оружие готово');
  campaignWpnCheckBtn.append(campaignWpnCheckIcon, campaignWpnCheckText);

  const campaignStartBtn = el('button', 'forest-fight-gothic-btn', 'В БОЙ!');
  campaignStartBtn.type = 'button';
  forestActionsCol.append(campaignWpnCheckBtn, campaignStartBtn);
  forestBottomStrip.append(forestInfoCol, forestActionsCol);

  campaignForestView.append(forestTopBar, forestStageFrame, forestBottomStrip);

  campaignBox.append(campaignWorldView, campaignForestView);
  campaignPanel.appendChild(campaignBox);

  // =========================================================================
  // TAB 3: 🗡️ АРСЕНАЛ (3D Pedestal Floating Weapon Stage + Ruby Arrows + Right Stats Plaque matching media_1794851281081_25811ecd.jpg!)
  // =========================================================================
  const arsenalPanel = el('section', 'hub-panel hub-panel-arsenal-3d hidden');

  // Center-Left Stage with Flanking Ruby-Iron Star Arrows (◀ [3D Floating Weapon] ▶)
  const arsenalStageArea = el('div', 'arsenal-stage-area');
  const arsenalPrevBtn = el('button', 'arsenal-ruby-arrow prev');
  arsenalPrevBtn.type = 'button';
  arsenalPrevBtn.setAttribute('aria-label', 'Предыдущее оружие');
  const arsenalPrevImg = document.createElement('img');
  arsenalPrevImg.className = 'switch-arrow-icon is-prev';
  arsenalPrevImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z22';
  arsenalPrevImg.alt = '';
  arsenalPrevImg.draggable = false;
  arsenalPrevBtn.appendChild(arsenalPrevImg);

  const arsenalStageSpacer = el('div', 'arsenal-stage-spacer');

  const arsenalNextBtn = el('button', 'arsenal-ruby-arrow next');
  arsenalNextBtn.type = 'button';
  arsenalNextBtn.setAttribute('aria-label', 'Следующее оружие');
  const arsenalNextImg = document.createElement('img');
  arsenalNextImg.className = 'switch-arrow-icon is-next';
  arsenalNextImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z22';
  arsenalNextImg.alt = '';
  arsenalNextImg.draggable = false;
  arsenalNextBtn.appendChild(arsenalNextImg);
  arsenalStageArea.append(arsenalPrevBtn, arsenalStageSpacer, arsenalNextBtn);

  // Right Gothic Weapon Plaque (Matches media_1794851281081_25811ecd.jpg!)
  const arsenalRightPlaque = el('div', 'arsenal-right-plaque');
  const arsenalClassSwitch = el('div', 'arsenal-class-switch arsenal-mini-class-row');
  const arsenalClassBtns = {};
  for (const cid of CLASS_ORDER) {
    const cDef = CLASSES[cid];
    const b = el('button', 'arsenal-class-pill');
    b.type = 'button';
    b.dataset.classId = cid;
    const avatarImg = document.createElement('img');
    avatarImg.src = cDef.portrait;
    avatarImg.alt = cDef.nameRu;
    avatarImg.className = 'class-pill-avatar';
    const labelSpan = el('span', 'class-pill-name', cDef.nameRu);
    b.append(avatarImg, labelSpan);
    arsenalClassSwitch.appendChild(b);
    arsenalClassBtns[cid] = b;
  }

  const arsenalPlaqueCard = el('div', 'arsenal-gothic-card');
  const arsenalCrestDiamond = el('div', 'arsenal-crest-diamond');
  arsenalCrestDiamond.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 36 28" width="32" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polygon points="18,2 32,14 18,26 4,14" fill="#2a1d2c" stroke="#c89e5a" stroke-width="1.6"/>
        <polygon points="18,6 26,14 18,22 10,14" fill="#1b3b5a" stroke="#7dd3fc" stroke-width="1"/>
      </svg>`
    )
  );
  const arsenalRibbonHeader = el('div', 'arsenal-ribbon-header');
  const arsenalHeading = el('h2', 'arsenal-ribbon-title', WEAPONS.club.nameRu);
  arsenalRibbonHeader.appendChild(arsenalHeading);

  const arsenalSubhint = el('div', 'arsenal-tier-sub', 'Ранг I • Ур. 1/12');

  // Stat Row 1: ⚔️ Урон
  const arsenalDmgRow = el('div', 'arsenal-stat-block');
  const arsenalDmgTop = el('div', 'arsenal-stat-top');
  const arsenalDmgLbl = el('span', 'arsenal-stat-lbl', '⚔ Урон');
  const arsenalDmgVal = el('span', 'arsenal-stat-num', '50');
  arsenalDmgTop.append(arsenalDmgLbl, arsenalDmgVal);
  const arsenalDmgTrack = el('div', 'hub-level-track arsenal-crimson-track');
  const arsenalDmgFill = el('div', 'hub-level-fill');
  arsenalDmgTrack.appendChild(arsenalDmgFill);
  arsenalDmgRow.append(arsenalDmgTop, arsenalDmgTrack);

  // Stat Row 2: 🛡️ Прочность / Закалка
  const arsenalPwrRow = el('div', 'arsenal-stat-block');
  const arsenalPwrTop = el('div', 'arsenal-stat-top');
  const arsenalPwrLbl = el('span', 'arsenal-stat-lbl', '🛡 Закалка');
  const arsenalPwrVal = el('span', 'arsenal-stat-num', '100');
  arsenalPwrTop.append(arsenalPwrLbl, arsenalPwrVal);
  const arsenalPwrTrack = el('div', 'hub-level-track arsenal-crimson-track');
  const arsenalPwrFill = el('div', 'hub-level-fill');
  arsenalPwrTrack.appendChild(arsenalPwrFill);
  arsenalPwrRow.append(arsenalPwrTop, arsenalPwrTrack);

  const arsenalWeaponMeta = el('div', 'arsenal-weapon-meta');
  const arsenalWeaponDesc = el('p', 'arsenal-weapon-desc');
  const arsenalMageElementsBox = el('div', 'arsenal-mage-elements arsenal-inline-elems hidden');
  const arsenalLockBanner = el('div', 'locked-hint-badge hidden');

  const arsenalActionsStack = el('div', 'arsenal-actions-stack');
  const arsenalEquipStageBtn = el('button', 'btn-equip arsenal-equip-stage-btn', '✓ В руках');
  arsenalEquipStageBtn.type = 'button';

  const arsenalUpgradeStageBtn = el('button', 'arsenal-gothic-upgrade-btn', 'Улучшить');
  arsenalUpgradeStageBtn.type = 'button';

  arsenalActionsStack.append(arsenalUpgradeStageBtn, arsenalEquipStageBtn);
  arsenalPlaqueCard.append(
    arsenalCrestDiamond,
    arsenalRibbonHeader,
    arsenalSubhint,
    arsenalDmgRow,
    arsenalPwrRow,
    arsenalWeaponMeta,
    arsenalWeaponDesc,
    arsenalMageElementsBox,
    arsenalLockBanner,
    arsenalActionsStack
  );

  // Keep lightweight hidden refs for backward compatibility
  const arsenalCardsGrid = el('div', 'hidden');
  const arsenalBackBtn = el('button', 'hidden');
  const arsenalQuickPlayBtn = el('button', 'hidden');

  arsenalRightPlaque.append(arsenalClassSwitch, arsenalPlaqueCard);
  arsenalPanel.append(arsenalStageArea, arsenalRightPlaque);

  // =========================================================================
  // TAB 4: 🧪 МАСТЕРСКАЯ (2-Column Beveled Talent Cards + Bottom Action Bar)
  // =========================================================================
  const shopPanel = el('section', 'hub-panel hub-panel-sub hidden');
  const shopBox = el('div', 'hub-subpanel-card shop-subpanel');

  const shopHeaderRow = el('div', 'subpanel-header-row');
  const shopTitleGroup = el('div', 'subpanel-title-group');
  const masteryHeading = el('h2', 'subpanel-title', '🧪 Мастерская Класса');
  const masteryClassBadge = el('div', 'workshop-class-badge');
  const masteryClassBadgeImg = document.createElement('img');
  masteryClassBadgeImg.className = 'workshop-badge-portrait';
  masteryClassBadgeImg.src = CLASSES.warrior.portrait;
  masteryClassBadgeImg.alt = '';
  const masteryClassBadgeText = el('span', '', '⚔️ Таланты класса: Воин Клятвы');
  masteryClassBadge.append(masteryClassBadgeImg, masteryClassBadgeText);
  shopTitleGroup.append(masteryHeading, masteryClassBadge);

  const shopHeaderControls = el('div', 'workshop-header-controls');
  const shopClassSwitch = el('div', 'arsenal-class-switch');
  const shopClassBtns = {};
  for (const cid of CLASS_ORDER) {
    const cDef = CLASSES[cid];
    const b = el('button', 'arsenal-class-pill');
    b.type = 'button';
    b.dataset.classId = cid;
    const avatarImg = document.createElement('img');
    avatarImg.src = cDef.portrait;
    avatarImg.alt = cDef.nameRu;
    avatarImg.className = 'class-pill-avatar';
    const labelSpan = el('span', 'class-pill-name', cDef.nameRu);
    b.append(avatarImg, labelSpan);
    shopClassSwitch.appendChild(b);
    shopClassBtns[cid] = b;
  }

  const rewardGoldBtn = el('button', 'gothic-btn btn-reward-gold', '🎁 +80 золота (Видео)');
  rewardGoldBtn.type = 'button';
  const talentPointsPill = el('div', 'talent-points-pill', '✨ Очки таланта: 1');
  const talentResetBtn = el('button', 'gothic-btn talent-reset-btn', '↺ Сброс');
  talentResetBtn.type = 'button';
  shopHeaderControls.append(talentPointsPill, talentResetBtn, shopClassSwitch, rewardGoldBtn);
  shopHeaderRow.append(shopTitleGroup, shopHeaderControls);

  const masteryGrid = el('div', 'mastery-grid');
  const selectedTalentByClass = {
    mage: CLASS_TALENT_TREES.mage?.[0]?.id || 'water_pressure',
    warrior: CLASS_TALENT_TREES.warrior?.[0]?.id || 'war_steel_grip',
    gunslinger: CLASS_TALENT_TREES.gunslinger?.[0]?.id || 'gun_heavy_slug'
  };
  let selectedMageTalentId = selectedTalentByClass.mage;

  const shopFooterRow = el('div', 'subpanel-footer-row');
  const shopBackBtn = el('button', 'subpanel-back-btn', '← К герою');
  shopBackBtn.type = 'button';
  const shopQuickPlayBtn = el('button', 'subpanel-battle-btn gothic-plaque-battle-btn', '⚔️ В БОЙ!');
  shopQuickPlayBtn.type = 'button';
  shopFooterRow.append(shopBackBtn, shopQuickPlayBtn);

  shopBox.append(shopHeaderRow, masteryGrid, shopFooterRow);
  shopPanel.appendChild(shopBox);

  // =========================================================================
  // TAB 5: 🛒 МАГАЗИН (Gothic Treasury Supplies, Quick Weapon Forge & Elemental Tomes)
  // =========================================================================
  const storePanel = el('section', 'hub-panel hub-panel-sub hidden');
  const storeBox = el('div', 'hub-subpanel-card store-subpanel');

  const storeHeaderRow = el('div', 'subpanel-header-row');
  const storeTitleGroup = el('div', 'subpanel-title-group');
  const storeHeading = el('h2', 'subpanel-title', '🛒 Магазин Лагеря');
  const storeSubhint = el('p', 'subpanel-hint', 'Припасы похода, ковка экипированного оружия и фолианты стихий.');
  storeTitleGroup.append(storeHeading, storeSubhint);
  storeHeaderRow.appendChild(storeTitleGroup);

  const storeCardsGrid = el('div', 'store-cards-grid');

  const storeFooterRow = el('div', 'subpanel-footer-row');
  const storeBackBtn = el('button', 'subpanel-back-btn', '← На главную');
  storeBackBtn.type = 'button';
  const storeQuickPlayBtn = el('button', 'subpanel-battle-btn gothic-plaque-battle-btn', '⚔️ В ПУТЬ!');
  storeQuickPlayBtn.type = 'button';
  storeFooterRow.append(storeBackBtn, storeQuickPlayBtn);

  storeBox.append(storeHeaderRow, storeCardsGrid, storeFooterRow);
  storePanel.appendChild(storeBox);

  // =========================================================================
  // BOTTOM 5-BUTTON GOTHIC NAVIGATION DOCK (Магазин • Арсенал • Главная • Герои • Таланты)
  // =========================================================================
  const hubNavTabs = el('nav', 'hub-bottom-dock');
  hubNavTabs.setAttribute('aria-label', 'Нижняя панель меню');

  function createBottomDockTab(labelText, svgMarkup, withDot = false) {
    const btn = el('button', 'dock-tab-btn');
    btn.type = 'button';
    const crest = el('span', 'dock-crest-circle');
    const socketImg = document.createElement('img');
    socketImg.src = './assets/ui/dock_crest_socket.png?v=20261117z22';
    socketImg.className = 'dock-socket-ring';
    socketImg.alt = '';
    socketImg.draggable = false;
    crest.append(socketImg, makeSvgNode(svgMarkup));
    let dot = null;
    if (withDot) {
      dot = el('span', 'hub-tab-dot dock-notif-dot hidden');
      crest.appendChild(dot);
    }
    const plaque = el('span', 'dock-plaque-body');
    const runeL = el('span', 'dock-rune', 'ᚱ');
    const lbl = el('span', 'hub-tab-label dock-tab-label', labelText);
    const runeR = el('span', 'dock-rune', 'ᛟ');
    plaque.append(runeL, lbl, runeR);
    btn.append(crest, plaque);
    return { btn, lbl, dot };
  }

  const storeDock = createBottomDockTab(
    'Магазин',
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6 H6.5 L8.8 14.5 H17.5 L19.6 8.5 H7.4" stroke="#f5d0dc" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="9.6" cy="18" r="1.6" fill="#fda4af"/>
      <circle cx="16.6" cy="18" r="1.6" fill="#fda4af"/>
    </svg>`,
    false
  );
  const tabStoreBtn = storeDock.btn;
  const tabStoreLabel = storeDock.lbl;

  const arsenalDock = createBottomDockTab(
    'Арсенал',
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 19 L18.5 5.5 M15 5 H19 V9" stroke="#f5d0dc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 19 L5.5 5.5 M9 5 H5 V9" stroke="#fda4af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    true
  );
  const tabArsenalBtn = arsenalDock.btn;
  const tabArsenalLabel = arsenalDock.lbl;
  const tabArsenalDot = arsenalDock.dot;

  const homeDock = createBottomDockTab(
    'Главная',
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 20 V9 L9 9 V6 H11.5 V9 H12.5 V6 H15 V9 H18 V20 Z" fill="rgba(244,63,94,0.28)" stroke="#ffe4e6" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M10.2 20 V15.2 C10.2 14.2 11 13.5 12 13.5 C13 13.5 13.8 14.2 13.8 15.2 V20" stroke="#fda4af" stroke-width="1.5"/>
    </svg>`,
    false
  );
  const tabHomeBtn = homeDock.btn;
  const tabHomeLabel = homeDock.lbl;
  tabHomeBtn.classList.add('is-center-home', 'is-active');

  const heroesDock = createBottomDockTab(
    'Герои',
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 11 C6.5 7.2 8.9 5 12 5 C15.1 5 17.5 7.2 17.5 11 V18.5 L14.5 17 V13 H9.5 V17 L6.5 18.5 Z" fill="rgba(244,63,94,0.24)" stroke="#f5d0dc" stroke-width="1.6" stroke-linejoin="round"/>
      <line x1="12" y1="5" x2="12" y2="13" stroke="#ffe4e6" stroke-width="1.5"/>
    </svg>`,
    false
  );
  const tabHeroesBtn = heroesDock.btn;
  const tabHeroesLabel = heroesDock.lbl;

  const talentsDock = createBottomDockTab(
    'Таланты',
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="12" y1="19" x2="12" y2="9" stroke="#f5d0dc" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="12" y1="13" x2="7.5" y2="9.5" stroke="#fda4af" stroke-width="1.6" stroke-linecap="round"/>
      <line x1="12" y1="13" x2="16.5" y2="9.5" stroke="#fda4af" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="12" cy="6.5" r="2.1" fill="#fb7185"/>
      <circle cx="6.8" cy="8.5" r="1.8" fill="#fda4af"/>
      <circle cx="17.2" cy="8.5" r="1.8" fill="#fda4af"/>
    </svg>`,
    true
  );
  const tabShopBtn = talentsDock.btn;
  const tabShopLabel = talentsDock.lbl;
  const tabShopDot = talentsDock.dot;

  // Keep lightweight hidden campaign tab ref for backward compatibility
  const tabCampaignBtn = el('button', 'hidden');
  const tabCampaignLabel = el('span', '', 'Кампания');
  tabCampaignBtn.appendChild(tabCampaignLabel);

  hubNavTabs.append(tabStoreBtn, tabArsenalBtn, tabHomeBtn, tabHeroesBtn, tabShopBtn);

  // Violet Mist Cloud Transition Overlay (Scene Switch Curtain matching Clash of Clans Cloud Swipe)
  const mistTransitionOverlay = el('div', 'mist-transition-overlay hidden');
  mistTransitionOverlay.id = 'mist-transition-overlay';
  for (let m = 1; m <= 6; m++) {
    mistTransitionOverlay.appendChild(el('div', `mist-cloud-puff puff-${m}`));
  }

  function triggerVioletMistTransition(onMidpoint) {
    if (mistAnimActive) {
      onMidpoint?.();
      return;
    }
    mistAnimActive = true;
    mistTransitionOverlay.classList.remove('hidden', 'is-parting');
    void mistTransitionOverlay.offsetWidth;
    mistTransitionOverlay.classList.add('is-closing');
    setTimeout(() => {
      try {
        onMidpoint?.();
      } finally {
        mistTransitionOverlay.classList.remove('is-closing');
        mistTransitionOverlay.classList.add('is-parting');
        setTimeout(() => {
          mistTransitionOverlay.classList.add('hidden');
          mistTransitionOverlay.classList.remove('is-parting');
          mistAnimActive = false;
        }, 440);
      }
    }, 340);
  }

  hubBody.append(homePanel, heroesPanel, campaignPanel, arsenalPanel, shopPanel, storePanel);
  hubShell.append(hubHeader, hubBody, hubNavTabs);
  hubScreen.append(hubShell, mistTransitionOverlay);
  root.appendChild(hubScreen);

  // =========================================================================
  // SOUND & GAME SETTINGS POPOVER (Anchored to Top-Right Gear / Combat Sound)
  // =========================================================================
  const soundPopover = el('div', 'sound-popover hidden');
  const musicPopHead = el('div', 'sound-pop-head');
  const musicPopTitle = el('span', 'sound-pop-title', '🎵 Музыка');
  const musicPopVal = el('span', 'sound-pop-val', '38%');
  musicPopHead.append(musicPopTitle, musicPopVal);

  const musicSliderWrap = el('div', 'sound-slider-wrap');
  const musicSlider = document.createElement('input');
  musicSlider.type = 'range';
  musicSlider.className = 'sound-volume-slider';
  musicSlider.min = '0';
  musicSlider.max = '100';
  musicSlider.step = '1';
  musicSlider.value = '38';
  musicSlider.setAttribute('aria-label', 'Громкость музыки');
  musicSliderWrap.appendChild(musicSlider);

  const soundPopHead = el('div', 'sound-pop-head');
  const soundPopTitle = el('span', 'sound-pop-title', '🔫 Выстрелы и эффекты');
  const soundPopVal = el('span', 'sound-pop-val', '75%');
  soundPopHead.append(soundPopTitle, soundPopVal);

  const soundSliderWrap = el('div', 'sound-slider-wrap');
  const soundSlider = document.createElement('input');
  soundSlider.type = 'range';
  soundSlider.className = 'sound-volume-slider';
  soundSlider.min = '0';
  soundSlider.max = '100';
  soundSlider.step = '1';
  soundSlider.value = '75';
  soundSlider.setAttribute('aria-label', 'Громкость выстрелов и эффектов');
  soundSliderWrap.appendChild(soundSlider);

  const soundMuteToggleBtn = el('button', 'sound-mute-toggle-btn', 'Выключить звук');
  soundMuteToggleBtn.type = 'button';

  soundPopover.append(
    musicPopHead,
    musicSliderWrap,
    soundPopHead,
    soundSliderWrap,
    soundMuteToggleBtn,
    hubResetBtn
  );
  root.appendChild(soundPopover);

  let soundAnchorBtn = null;

  function positionSoundPopover(anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popWidth = 248;
    const left = Math.max(10, Math.min(window.innerWidth - popWidth - 10, rect.right - popWidth));
    const top = Math.max(10, Math.min(window.innerHeight - 250, rect.bottom + 8));
    soundPopover.style.left = `${Math.round(left)}px`;
    soundPopover.style.top = `${Math.round(top)}px`;
  }

  function closeSoundPopover() {
    if (soundPopover.classList.contains('hidden')) return;
    soundPopover.classList.add('hidden');
    hubMuteBtn.classList.remove('is-open');
    hudMuteBtn.classList.remove('is-open');
    soundAnchorBtn = null;
  }

  function toggleSoundPopover(anchorBtn) {
    if (!soundPopover.classList.contains('hidden') && soundAnchorBtn === anchorBtn) {
      closeSoundPopover();
      return;
    }
    soundAnchorBtn = anchorBtn;
    hubResetBtn.classList.toggle('hidden', anchorBtn !== hubMuteBtn);
    hubMuteBtn.classList.toggle('is-open', anchorBtn === hubMuteBtn);
    hudMuteBtn.classList.toggle('is-open', anchorBtn === hudMuteBtn);
    soundPopover.classList.remove('hidden');
    positionSoundPopover(anchorBtn);
  }

  // =========================================================================
  // 6. BANNERS, RELIC TAROT LEVEL-UP ALTAR & RESULT MODAL
  // =========================================================================
  const weaponUnlockBanner = el('div', 'weapon-unlock-banner hidden');
  root.appendChild(weaponUnlockBanner);
  let weaponBannerTimer = null;

  const generalToast = el('div', 'general-toast hidden');
  root.appendChild(generalToast);
  let generalToastTimer = null;

  // Spectacular "БЛАГОСЛОВЕНИЕ ДУШ" Tarot / Relic Altar Modal (ZERO Windows emojis!)
  const levelUpModal = el('div', 'modal-backdrop levelup-backdrop hidden');
  const levelUpPanel = el('div', 'modal-panel levelup-panel');

  const altarHeader = el('div', 'altar-header');
  const altarMandalaWrap = el('div', 'altar-mandala-wrap');
  altarMandalaWrap.appendChild(createMandalaSvg());

  const altarSoulPill = el('div', 'altar-soul-pill');
  const altarSoulGemSvg = makeSvgNode(
    `<svg viewBox="0 0 18 18" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="9,1.5 15.5,9 9,16.5 2.5,9" fill="#c084fc" stroke="#faf5ff" stroke-width="1.2"/></svg>`
  );
  const altarSoulLevelText = el('span', '', 'УРОВЕНЬ ДУШ II');
  altarSoulPill.append(altarSoulGemSvg, altarSoulLevelText);

  const levelUpTitle = el('h2', 'modal-title altar-title', 'БЛАГОСЛОВЕНИЕ ДУШ');
  const levelUpSub = el('p', 'modal-subtitle altar-subtitle', 'Выберите древний дар для текущего похода');
  altarHeader.append(altarMandalaWrap, altarSoulPill, levelUpTitle, levelUpSub);

  const blessingCardsGrid = el('div', 'blessing-cards-grid');
  levelUpPanel.append(altarHeader, blessingCardsGrid);
  levelUpModal.appendChild(levelUpPanel);
  root.appendChild(levelUpModal);

  let activeLevelUpHandler = null;

  // Result Modal (Ornate Gothic Victory / Defeat Plaque matching media_1794831700387_b993e413.jpg)
  const resultModal = el('div', 'modal-backdrop result-modal-backdrop hidden');
  const resultPanel = el('div', 'modal-panel result-panel');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    resultPanel.appendChild(el('span', `gothic-card-clasp ${pos}`));
  }
  const resultCrest = el('div', 'result-crest');
  const resultTitle = el('h2', 'modal-title result-main-title', 'Победа! Глава очищена!');

  const resultRibbonWrap = el('div', 'result-chapter-ribbon');
  const resultLevelName = el('span', 'result-chapter-ribbon-text', '');
  resultRibbonWrap.appendChild(resultLevelName);

  const resultStatsGrid = el('div', 'result-stats-grid');

  const resGoldBox = el('div', 'result-stat-box');
  const resGoldIcon = makeSvgNode(
    `<svg viewBox="0 0 38 38" width="34" height="34" fill="none" class="result-stat-svg" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="28" rx="9" ry="4" fill="#d97706" stroke="#fde047" stroke-width="1.2"/>
      <ellipse cx="14" cy="24" rx="9" ry="4" fill="#f59e0b" stroke="#fef08a" stroke-width="1.2"/>
      <ellipse cx="14" cy="20" rx="9" ry="4" fill="#facc15" stroke="#fffbeb" stroke-width="1.2"/>
      <ellipse cx="25" cy="29" rx="8.5" ry="3.8" fill="#b45309" stroke="#fde047" stroke-width="1.2"/>
      <ellipse cx="25" cy="25.2" rx="8.5" ry="3.8" fill="#eab308" stroke="#fef08a" stroke-width="1.2"/>
      <ellipse cx="19" cy="14" rx="8" ry="3.6" fill="#fde047" stroke="#ffffff" stroke-width="1.2"/>
    </svg>`
  );
  const resGoldTextCol = el('div', 'result-stat-col');
  const resGoldLabel = el('div', 'result-stat-label', 'Добыто золота');
  const resGoldVal = el('div', 'result-stat-val', '+0');
  resGoldTextCol.append(resGoldLabel, resGoldVal);
  resGoldBox.append(resGoldIcon, resGoldTextCol);

  const resKillsBox = el('div', 'result-stat-box');
  const resKillsIcon = makeSvgNode(
    `<svg viewBox="0 0 38 38" width="34" height="34" fill="none" class="result-stat-svg" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 6 C11.5 6 7 11.5 7 18.2 C7 22.8 9.2 25.8 12.2 27.6 V32 H25.8 V27.6 C28.8 25.8 31 22.8 31 18.2 C31 11.5 26.5 6 19 6 Z" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.4"/>
      <circle cx="14.5" cy="18.8" r="3.1" fill="#3b0764"/>
      <circle cx="23.5" cy="18.8" r="3.1" fill="#3b0764"/>
      <polygon points="19,21.5 17.3,25 20.7,25" fill="#1e1b4b"/>
      <line x1="15.5" y1="28" x2="15.5" y2="31.5" stroke="#475569" stroke-width="1.3"/>
      <line x1="19" y1="28" x2="19" y2="31.5" stroke="#475569" stroke-width="1.3"/>
      <line x1="22.5" y1="28" x2="22.5" y2="31.5" stroke="#475569" stroke-width="1.3"/>
    </svg>`
  );
  const resKillsTextCol = el('div', 'result-stat-col');
  const resKillsLabel = el('div', 'result-stat-label', 'Истреблено нежити');
  const resKillsVal = el('div', 'result-stat-val', '0');
  resKillsTextCol.append(resKillsLabel, resKillsVal);
  resKillsBox.append(resKillsIcon, resKillsTextCol);

  resultStatsGrid.append(resGoldBox, resKillsBox);
  const resultUnlockedBox = el('div', 'result-unlocked-box hidden');
  const resultActionsCol = el('div', 'result-actions-col');

  const resultBottomSkull = el('div', 'result-bottom-skull');
  resultBottomSkull.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 40 32" width="32" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 14 C3 10 3 4 7 2 C6 7 8 10 13 12 Z" fill="#d97706"/>
        <path d="M31 14 C37 10 37 4 33 2 C34 7 32 10 27 12 Z" fill="#d97706"/>
        <path d="M20 6 C14.5 6 11.5 10.2 11.5 15.5 C11.5 19.2 13.5 21.8 15.5 23.2 L17 29 H23 L24.5 23.2 C26.5 21.8 28.5 19.2 28.5 15.5 C28.5 10.2 25.5 6 20 6 Z" fill="#e5b85c" stroke="#fef08a" stroke-width="1.1"/>
        <circle cx="16.8" cy="16" r="2.2" fill="#1c1917"/>
        <circle cx="23.2" cy="16" r="2.2" fill="#1c1917"/>
      </svg>`
    )
  );

  resultPanel.append(
    resultCrest,
    resultTitle,
    resultRibbonWrap,
    resultStatsGrid,
    resultUnlockedBox,
    resultActionsCol,
    resultBottomSkull
  );
  resultModal.appendChild(resultPanel);
  root.appendChild(resultModal);

  // =========================================================================
  // MAGE STARTER ELEMENT MODAL & FULL PROGRESS RESET CONFIRMATION MODAL
  // =========================================================================
  const mageStarterModal = el('div', 'modal-backdrop mage-elem-backdrop hidden');
  const mageStarterPanel = el('div', 'modal-panel mage-elem-modal-panel');
  const mageStarterTopBar = el('div', 'mage-elem-modal-topbar');
  const mageStarterPill = el('span', 'altar-soul-pill', '✦ ШКОЛА СТИХИЙ МАГА ✦');
  const mageStarterCloseBtn = el('button', 'mage-elem-later-btn', '✕ Позже');
  mageStarterCloseBtn.type = 'button';
  mageStarterTopBar.append(mageStarterPill, mageStarterCloseBtn);

  const mageStarterTitle = el('h2', 'modal-title mage-elem-modal-title', 'ВЫБЕРИ ПЕРВУЮ СТИХИЮ');
  const mageStarterSub = el(
    'p',
    'modal-subtitle mage-elem-modal-sub',
    'Первая стихия открывается бесплатно! Остальные 3 стихии можно будет изучить за золото и переключать в любой момент.'
  );
  const mageStarterGrid = el('div', 'mage-starter-grid');
  mageStarterPanel.append(mageStarterTopBar, mageStarterTitle, mageStarterSub, mageStarterGrid);
  mageStarterModal.appendChild(mageStarterPanel);
  root.appendChild(mageStarterModal);

  let pendingStartAfterStarterChoice = null;

  function hideMageStarterModal() {
    mageStarterModal.classList.add('hidden');
  }

  mageStarterCloseBtn.addEventListener('click', () => {
    pendingStartAfterStarterChoice = null;
    hideMageStarterModal();
  });

  function openMageStarterModal(autoStartLevel = null) {
    closeSoundPopover();
    pendingStartAfterStarterChoice = autoStartLevel;
    mageStarterGrid.innerHTML = '';

    for (const elKey of MAGE_ELEMENT_ORDER) {
      const eDef = MAGE_ELEMENTS[elKey];
      if (!eDef) continue;
      const card = el('button', `mage-starter-card elem-theme-${elKey}`);
      card.type = 'button';
      card.style.setProperty('--elem-color', hexNumToCss(eDef.color, '#c084fc'));

      const head = el('div', 'mage-starter-card-head');
      const iconSpan = el('span', 'mage-starter-icon', eDef.icon);
      const freeBadge = el('span', 'mage-starter-free-tag', 'БЕСПЛАТНО');
      head.append(iconSpan, freeBadge);

      const nameEl = el('h3', 'mage-starter-name', eDef.nameRu);
      const descEl = el('p', 'mage-starter-desc', eDef.descRu);
      const ctaEl = el('div', 'mage-starter-cta', `Выбрать: ${eDef.shortRu}`);

      card.append(head, nameEl, descEl, ctaEl);
      card.addEventListener('click', () => {
        const launchLvl = pendingStartAfterStarterChoice;
        pendingStartAfterStarterChoice = null;
        hideMageStarterModal();
        callbacks.onSelectMageElement?.(elKey);
        if (launchLvl !== null) {
          (callbacks.onStartRun || callbacks.onStartGame || callbacks.onPlay)?.({
            classId: 'mage',
            weaponId: currentEquippedWeaponId,
            level: launchLvl
          });
        }
      });
      mageStarterGrid.appendChild(card);
    }

    mageStarterModal.classList.remove('hidden');
  }

  // Full Reset Progress Confirmation Modal (Mobile & Desktop)
  const resetConfirmModal = el('div', 'modal-backdrop reset-confirm-backdrop hidden');
  const resetConfirmPanel = el('div', 'modal-panel reset-confirm-panel');
  const resetConfirmIcon = el('div', 'reset-confirm-icon', '🔄');
  const resetConfirmTitle = el('h2', 'modal-title reset-confirm-title', 'Сбросить весь прогресс?');
  const resetConfirmSub = el(
    'p',
    'modal-subtitle reset-confirm-sub',
    'Все пройденные главы, золото, открытое оружие, таланты и выбранные стихии мага вернутся к начальному состоянию (Глава I, 0 золота), как при первом заходе в игру.'
  );
  const resetConfirmActions = el('div', 'reset-confirm-actions');
  const resetConfirmYesBtn = el('button', 'result-btn btn-confirm-reset', '🔥 Сбросить всё до нуля');
  resetConfirmYesBtn.type = 'button';
  const resetConfirmNoBtn = el('button', 'result-btn btn-retry', 'Отмена');
  resetConfirmNoBtn.type = 'button';
  resetConfirmActions.append(resetConfirmYesBtn, resetConfirmNoBtn);
  resetConfirmPanel.append(resetConfirmIcon, resetConfirmTitle, resetConfirmSub, resetConfirmActions);
  resetConfirmModal.appendChild(resetConfirmPanel);
  root.appendChild(resetConfirmModal);

  function hideResetConfirmModal() {
    resetConfirmModal.classList.add('hidden');
  }

  hubResetBtn.addEventListener('click', () => {
    closeSoundPopover();
    resetConfirmModal.classList.remove('hidden');
  });

  resetConfirmNoBtn.addEventListener('click', () => {
    hideResetConfirmModal();
  });

  resetConfirmModal.addEventListener('click', (e) => {
    if (e.target === resetConfirmModal) hideResetConfirmModal();
  });

  // In-Game Pause Modal (⏸ Button or Escape Key)
  const pauseModal = el('div', 'modal-backdrop pause-modal-backdrop hidden');
  const pausePanel = el('div', 'modal-panel pause-modal-panel');
  const pauseTitle = el('h2', 'modal-title pause-modal-title', '⏸ ПАУЗА');
  const pauseSub = el('p', 'modal-subtitle pause-modal-sub', 'Охота приостановлена');
  const pauseActions = el('div', 'result-actions-col pause-actions-col');

  const pauseResumeBtn = el('button', 'result-btn btn-arsenal-primary', '▶ Продолжить бой');
  pauseResumeBtn.type = 'button';
  const pauseRestartBtn = el('button', 'result-btn btn-retry', '🔄 Начать главу заново');
  pauseRestartBtn.type = 'button';
  const pauseExitBtn = el('button', 'result-btn btn-confirm-reset', '🏕️ Выйти в главное меню');
  pauseExitBtn.type = 'button';

  pauseActions.append(pauseResumeBtn, pauseRestartBtn, pauseExitBtn);
  pausePanel.append(pauseTitle, pauseSub, pauseActions);
  pauseModal.appendChild(pausePanel);
  root.appendChild(pauseModal);

  let activePauseHandlers = {};

  function hidePauseModal() {
    pauseModal.classList.add('hidden');
    activePauseHandlers = {};
  }

  function showPauseModal(info = {}, handlers = {}) {
    closeSoundPopover();
    activePauseHandlers = handlers || {};
    const chName = info.levelNameRu || `Глава ${info.level || 1}`;
    const phaseStr = info.phaseText || '';
    const goldEarned = Math.floor(Number(info.goldRun) || 0);
    pauseSub.textContent = `${chName}${phaseStr ? ` • ${phaseStr}` : ''} • Добыто: +${goldEarned} зол.`;
    pauseModal.classList.remove('hidden');
  }

  pauseResumeBtn.addEventListener('click', () => {
    const fn = activePauseHandlers.onResume;
    hidePauseModal();
    fn?.();
  });

  pauseRestartBtn.addEventListener('click', () => {
    const fn = activePauseHandlers.onRestart;
    hidePauseModal();
    fn?.();
  });

  pauseExitBtn.addEventListener('click', () => {
    const fn = activePauseHandlers.onExit;
    hidePauseModal();
    setActiveTab('home');
    fn?.();
  });

  // =========================================================================
  // INTERACTIVE SOUND, HUD & HUB TAB HANDLERS
  // =========================================================================
  function syncMuteButtons() {
    const effectiveVol = muted ? 0 : volume;
    const effectiveMusic = muted ? 0 : musicVolume;
    const anyAudio = effectiveVol > 0.001 || effectiveMusic > 0.001;
    const icon = !anyAudio ? '🔇' : effectiveVol < 0.45 ? '🔉' : '🔊';
    hudMuteBtn.textContent = icon;
    hubMuteBtn.classList.toggle('is-muted-gear', !anyAudio);

    const mPct = Math.round(effectiveMusic * 100);
    musicPopTitle.textContent = lang === 'en' ? '🎵 Music' : '🎵 Музыка';
    musicPopVal.textContent = muted ? (lang === 'en' ? 'Muted' : 'Выкл') : `${mPct}%`;
    musicSlider.value = String(mPct);
    musicSlider.style.setProperty('--vol-pct', `${mPct}%`);

    const pct = Math.round(effectiveVol * 100);
    soundPopTitle.textContent = lang === 'en' ? '🔫 Shots & SFX' : '🔫 Выстрелы и эффекты';
    soundPopVal.textContent = muted ? (lang === 'en' ? 'Muted' : 'Выкл') : `${pct}%`;
    soundSlider.value = String(pct);
    soundSlider.style.setProperty('--vol-pct', `${pct}%`);

    soundMuteToggleBtn.classList.toggle('is-muted', muted || !anyAudio);
    if (muted || !anyAudio) {
      soundMuteToggleBtn.textContent = lang === 'en' ? '🔊 Unmute Audio' : '🔊 Включить звук';
    } else {
      soundMuteToggleBtn.textContent = lang === 'en' ? '🔇 Mute Audio' : '🔇 Выключить звук';
    }
  }

  function syncAutoAimButton() {
    autoAimBtn.classList.toggle('is-on', autoAim);
    if (lang === 'en') {
      autoAimBtn.textContent = `Auto-Aim: ${autoAim ? 'ON' : 'OFF'} [Q]`;
    } else {
      autoAimBtn.textContent = `Автоприцел: ${autoAim ? 'ВКЛ' : 'ВЫКЛ'} [Q]`;
    }
  }

  function syncAttackToggleButton() {
    attackToggleBtn.classList.toggle('is-on', attackEnabled);
    attackToggleBtn.classList.toggle('is-off', !attackEnabled);
    if (lang === 'en') {
      attackToggleBtn.textContent = `Attack: ${attackEnabled ? 'ON' : 'OFF'} [E]`;
    } else {
      attackToggleBtn.textContent = `Атака: ${attackEnabled ? 'ВКЛ' : 'ВЫКЛ'} [E]`;
    }
  }

  function syncStaticLabels() {
    const isEn = lang === 'en';
    hubTitle.textContent = isEn ? 'Level' : 'Уровень';
    hubGoldLabel.textContent = isEn ? 'Gold' : 'Золото';
    homeJourneyLabel.textContent = isEn ? 'EMBARK!' : 'В ПУТЬ!';
    homeRotateHint.textContent = isEn ? 'RMB — rotate hero' : 'ПКМ — повернуть героя';

    tabStoreLabel.textContent = isEn ? 'Shop' : 'Магазин';
    tabArsenalLabel.textContent = isEn ? 'Arsenal' : 'Арсенал';
    tabHomeLabel.textContent = isEn ? 'Home' : 'Главная';
    tabHeroesLabel.textContent = isEn ? 'Heroes' : 'Герои';
    tabShopLabel.textContent = isEn ? 'Talents' : 'Таланты';
    tabCampaignLabel.textContent = isEn ? 'Campaign' : 'Кампания';

    heroWeaponChipArrow.textContent = isEn ? 'Arsenal ›' : 'Арсенал ›';
    launchMainText.textContent = isEn ? '⚔️ EMBARK!' : '⚔️ В ПУТЬ!';
    arsenalQuickPlayBtn.textContent = isEn ? '⚔️ EMBARK!' : '⚔️ В ПУТЬ!';
    shopQuickPlayBtn.textContent = isEn ? '⚔️ EMBARK!' : '⚔️ В ПУТЬ!';
    storeQuickPlayBtn.textContent = isEn ? '⚔️ EMBARK!' : '⚔️ В ПУТЬ!';

    campaignBackHeroBtn.textContent = '✕';
    arsenalBackBtn.textContent = isEn ? '← Home' : '← На главную';
    shopBackBtn.textContent = isEn ? '← Home' : '← На главную';
    storeBackBtn.textContent = isEn ? '← Home' : '← На главную';

    campaignHeading.textContent = isEn ? 'Misty Forest — 25 Stages' : 'Туманный лес — 25 Глав';
    masteryHeading.textContent = isEn ? '🌿 Class Talents' : '🌿 Древо Талантов';
    storeHeading.textContent = isEn ? '🛒 Camp Shop' : '🛒 Магазин Лагеря';
    rewardGoldBtn.textContent = isEn ? '🎁 +80 Gold (Video)' : '🎁 +80 золота (Видео)';
    hubResetBtn.textContent = isEn ? '🔄 Reset All Progress' : '🔄 Сбросить весь прогресс';
    leftCap.textContent = isEn ? 'MOVE' : 'ДВИЖЕНИЕ';
    syncMuteButtons();
    syncAutoAimButton();
    syncAttackToggleButton();
  }

  const handleToggleMute = () => {
    const nextMuted = !(muted || volume <= 0.001);
    if (!nextMuted && volume <= 0.001) {
      volume = lastNonZeroVolume > 0.05 ? lastNonZeroVolume : 0.8;
      callbacks.onVolumeChange?.(volume);
    }
    const res = callbacks.onToggleMute?.(nextMuted);
    muted = typeof res === 'boolean' ? res : nextMuted;
    syncMuteButtons();
  };

  hudMuteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSoundPopover(hudMuteBtn);
  });

  hubMuteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSoundPopover(hubMuteBtn);
  });

  hudMuteBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleToggleMute();
  });
  hubMuteBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleToggleMute();
  });

  soundMuteToggleBtn.addEventListener('click', handleToggleMute);

  musicSlider.addEventListener('input', () => {
    const pct = Math.max(0, Math.min(100, Number(musicSlider.value) || 0));
    musicVolume = pct / 100;
    if (musicVolume > 0.01 && muted) {
      muted = false;
      const mRes = callbacks.onToggleMute?.(false);
      if (typeof mRes === 'boolean') muted = mRes;
    }
    callbacks.onMusicVolumeChange?.(musicVolume);
    syncMuteButtons();
  });

  soundSlider.addEventListener('input', () => {
    const pct = Math.max(0, Math.min(100, Number(soundSlider.value) || 0));
    volume = pct / 100;
    if (volume > 0.01) {
      lastNonZeroVolume = volume;
      if (muted) {
        muted = false;
        const mRes = callbacks.onToggleMute?.(false);
        if (typeof mRes === 'boolean') muted = mRes;
      }
    }
    callbacks.onVolumeChange?.(volume);
    syncMuteButtons();
  });

  window.addEventListener('pointerdown', (e) => {
    if (soundPopover.classList.contains('hidden')) return;
    const t = e.target;
    if (soundPopover.contains(t) || hubMuteBtn.contains(t) || hudMuteBtn.contains(t)) return;
    closeSoundPopover();
  });

  window.addEventListener('resize', () => {
    if (!soundPopover.classList.contains('hidden') && soundAnchorBtn) {
      positionSoundPopover(soundAnchorBtn);
    }
  });

  function normalizeTabId(tabId) {
    if (tabId === 'home' || tabId === 'main') return 'home';
    if (tabId === 'heroes') return 'heroes';
    if (tabId === 'campaign_forest' || tabId === 'forest') return 'campaign_forest';
    if (tabId === 'campaign_world' || tabId === 'campaign' || tabId === 'map' || tabId === 'chapters') return 'campaign_world';
    if (tabId === 'arsenal') return 'arsenal';
    if (tabId === 'store' || tabId === 'market') return 'store';
    if (tabId === 'shop' || tabId === 'workshop' || tabId === 'talents') return 'shop';
    return 'home';
  }

  function setActiveTab(tabId) {
    closeSoundPopover();
    const norm = normalizeTabId(tabId);
    const isCampaign = norm === 'campaign_world' || norm === 'campaign_forest';
    if (norm === 'campaign_forest') {
      campaignSubView = 'forest';
    } else if (norm === 'campaign_world') {
      campaignSubView = 'world';
    }
    const valid = isCampaign ? 'campaign' : norm;
    activeHubTab = valid;

    tabStoreBtn.classList.toggle('is-active', valid === 'store');
    tabArsenalBtn.classList.toggle('is-active', valid === 'arsenal');
    tabHomeBtn.classList.toggle('is-active', valid === 'home' || valid === 'campaign');
    tabHeroesBtn.classList.toggle('is-active', valid === 'heroes');
    tabShopBtn.classList.toggle('is-active', valid === 'shop');

    homePanel.classList.toggle('hidden', valid !== 'home');
    heroesPanel.classList.toggle('hidden', valid !== 'heroes');
    campaignPanel.classList.toggle('hidden', valid !== 'campaign');
    arsenalPanel.classList.toggle('hidden', valid !== 'arsenal' && valid !== 'store');
    shopPanel.classList.toggle('hidden', valid !== 'shop');
    storePanel.classList.add('hidden');

    const is3DStageTab = valid === 'home' || valid === 'heroes' || valid === 'arsenal' || valid === 'store';
    hubScreen.classList.toggle('is-subtab', !is3DStageTab && valid !== 'campaign');
    hubScreen.classList.toggle('is-campaign-map', valid === 'campaign');
    hubScreen.scrollTop = 0;

    if (valid === 'campaign') {
      campaignWorldView.classList.toggle('hidden', campaignSubView !== 'world');
      campaignForestView.classList.toggle('hidden', campaignSubView !== 'forest');
      if (campaignSubView === 'world') {
        try { campaignWorldBg.play?.().catch(() => {}); } catch {}
      } else {
        try { forestBgImg.play?.().catch(() => {}); } catch {}
      }
    }

    if (valid === 'arsenal' && lastHubState) {
      viewedArsenalWeaponIdx = -1;
      renderHub(lastHubState);
    } else if (valid === 'store' && lastHubState) {
      viewedShopWeaponIdx = 0;
      renderHub(lastHubState);
    }

    callbacks.onHubTabChange?.(isCampaign ? (campaignSubView === 'forest' ? 'campaign_forest' : 'campaign_world') : valid);

    if (valid === 'campaign' && lastHubState) {
      if (!viewedCampaignLevel || viewedCampaignLevel > cachedMaxUnlockedLevel) {
        viewedCampaignLevel = localSelectedLevel;
      }
      renderHub(lastHubState);
    }
  }

  tabStoreBtn.addEventListener('click', () => setActiveTab('store'));
  tabArsenalBtn.addEventListener('click', () => setActiveTab('arsenal'));
  tabHomeBtn.addEventListener('click', () => setActiveTab('home'));
  tabHeroesBtn.addEventListener('click', () => setActiveTab('heroes'));
  tabShopBtn.addEventListener('click', () => setActiveTab('shop'));
  tabCampaignBtn.addEventListener('click', () => setActiveTab('campaign_world'));

  hubProfilePlaque.addEventListener('click', () => {
    if (activeHubTab === 'heroes') {
      cycleHeroClass(1);
    } else {
      setActiveTab('heroes');
    }
  });

  homeWeaponWarn.addEventListener('click', () => setActiveTab('arsenal'));
  forestBackWorldBtn.addEventListener('click', () => {
    triggerVioletMistTransition(() => setActiveTab('campaign_world'));
  });
  diffNormalBtn.addEventListener('click', () => callbacks.onSetDifficulty?.('normal'));
  diffHardBtn.addEventListener('click', () => callbacks.onSetDifficulty?.('hard'));

  heroWeaponChip.addEventListener('click', () => setActiveTab('arsenal'));
  launchWeaponWarn.addEventListener('click', () => setActiveTab('arsenal'));
  changeChapterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTab('campaign');
  });
  chapterMiniCard.addEventListener('click', () => setActiveTab('campaign'));

  campaignBackHeroBtn.addEventListener('click', () => setActiveTab('home'));
  forestCloseMapBtn.addEventListener('click', () => setActiveTab('home'));
  arsenalBackBtn.addEventListener('click', () => setActiveTab('home'));
  shopBackBtn.addEventListener('click', () => setActiveTab('home'));
  storeBackBtn.addEventListener('click', () => setActiveTab('home'));

  autoAimBtn.addEventListener('click', () => {
    const next = !autoAim;
    const res = callbacks.onToggleAutoAim?.(next);
    autoAim = typeof res === 'boolean' ? res : next;
    syncAutoAimButton();
  });

  attackToggleBtn.addEventListener('click', () => {
    const next = !attackEnabled;
    const res = callbacks.onToggleAttack?.(next);
    attackEnabled = typeof res === 'boolean' ? res : next;
    syncAttackToggleButton();
  });

  hudHomeBtn.addEventListener('click', () => {
    closeSoundPopover();
    if (callbacks.onTogglePause) {
      callbacks.onTogglePause();
    } else {
      setActiveTab('home');
      (callbacks.onExitToHub || callbacks.onReturnToHub || callbacks.onQuitRun)?.();
    }
  });

  rewardGoldBtn.addEventListener('click', () => {
    (callbacks.onRewardGold || callbacks.onWatchAdGold || callbacks.onClaimBonusGold)?.();
  });

  // =========================================================================
  // HUB STATE, HERO CAROUSEL, 25-CHAPTER CAMPAIGN & RENDERING
  // =========================================================================
  let lastHubState = null;
  let localSelectedClass = 'warrior';
  let localSelectedLevel = 1;
  let viewedCampaignLevel = 1;
  let cachedMaxUnlockedLevel = 1;
  let lastSeenMaxUnlockedLevel = null;
  let userPickedLevel = false;
  let currentEquippedWeaponId = 'club';
  let viewedArsenalWeaponIdx = -1;
  let viewedShopWeaponIdx = 0;

  function getOwnedClassWeapons(classId) {
    const cDef = CLASSES[classId] || CLASSES.warrior;
    const allList = cDef.weapons || ['club'];
    if (!lastHubState) return allList;
    const s = typeof lastHubState?.getState === 'function' ? lastHubState.getState() : lastHubState;
    const owned = allList.filter((wId) => WEAPONS[wId] && resolveWeaponUnlocked(s, lastHubState, WEAPONS[wId]));
    return owned.length > 0 ? owned : [cDef.starterWeapon || allList[0]];
  }

  function getUnownedShopWeapons(classId) {
    const cDef = CLASSES[classId] || CLASSES.warrior;
    const allList = cDef.weapons || ['club'];
    if (!lastHubState) return [];
    const s = typeof lastHubState?.getState === 'function' ? lastHubState.getState() : lastHubState;
    return allList.filter((wId) => {
      const wDef = WEAPONS[wId];
      return wDef && !wDef.bossExclusive && !resolveWeaponUnlocked(s, lastHubState, wDef);
    });
  }

  function cycleArsenalWeapon(step) {
    const isShopMode = activeHubTab === 'store';
    const list = isShopMode
      ? getUnownedShopWeapons(localSelectedClass)
      : getOwnedClassWeapons(localSelectedClass);
    if (list.length <= 1) return;
    if (isShopMode) {
      const curIdx = Math.max(0, Math.min(list.length - 1, viewedShopWeaponIdx));
      const nextIdx = Math.max(0, Math.min(list.length - 1, curIdx + step));
      if (nextIdx === curIdx) return;
      viewedShopWeaponIdx = nextIdx;
    } else {
      const curIdx =
        viewedArsenalWeaponIdx >= 0 && viewedArsenalWeaponIdx < list.length
          ? viewedArsenalWeaponIdx
          : Math.max(0, list.indexOf(currentEquippedWeaponId));
      const nextIdx = Math.max(0, Math.min(list.length - 1, curIdx + step));
      if (nextIdx === curIdx) return;
      viewedArsenalWeaponIdx = nextIdx;
    }
    if (lastHubState) renderHub(lastHubState);
  }

  arsenalPrevBtn.addEventListener('click', () => cycleArsenalWeapon(-1));
  arsenalNextBtn.addEventListener('click', () => cycleArsenalWeapon(1));

  function isMageStarterChosen() {
    return true;
  }

  function resetLocalSelection() {
    localSelectedClass = 'warrior';
    localSelectedLevel = 1;
    viewedCampaignLevel = 1;
    cachedMaxUnlockedLevel = 1;
    lastSeenMaxUnlockedLevel = null;
    userPickedLevel = false;
    currentEquippedWeaponId = 'club';
    viewedArsenalWeaponIdx = -1;
    viewedShopWeaponIdx = 0;
    setActiveTab('home');
  }

  resetConfirmYesBtn.addEventListener('click', () => {
    hideResetConfirmModal();
    resetLocalSelection();
    callbacks.onResetProgress?.();
  });

  function selectHeroClass(nextClassId) {
    if (!CLASSES[nextClassId] || nextClassId === localSelectedClass) return;
    localSelectedClass = nextClassId;
    viewedArsenalWeaponIdx = -1;
    viewedShopWeaponIdx = 0;

    heroInfoCard.classList.remove('hero-switch-pulse');
    void heroInfoCard.offsetWidth;
    heroInfoCard.classList.add('hero-switch-pulse');

    const beforeSeq = renderSeq;
    callbacks.onSelectClass?.(nextClassId);
    if (renderSeq === beforeSeq && lastHubState) {
      const base = typeof lastHubState?.getState === 'function' ? lastHubState.getState() : lastHubState;
      renderHub({ ...base, selectedClass: nextClassId });
    }
    if (nextClassId === 'mage' && !isMageStarterChosen()) {
      openMageStarterModal(null);
    }
  }

  function cycleHeroClass(step) {
    const curIdx = Math.max(0, CLASS_ORDER.indexOf(localSelectedClass));
    const nextIdx = (curIdx + step + CLASS_ORDER.length) % CLASS_ORDER.length;
    selectHeroClass(CLASS_ORDER[nextIdx]);
  }

  function navigateCampaignChapter(targetLvl) {
    const clamped = Math.max(1, Math.min(LEVELS.length, Number(targetLvl) || 1));
    viewedCampaignLevel = clamped;
    if (clamped <= cachedMaxUnlockedLevel) {
      userPickedLevel = true;
      localSelectedLevel = clamped;
      callbacks.onSelectLevel?.(clamped);
    }
    if (lastHubState) {
      renderHub(lastHubState);
    }
  }

  stagePrevBtn.addEventListener('click', () => cycleHeroClass(-1));
  stageNextBtn.addEventListener('click', () => cycleHeroClass(1));

  for (const cid of CLASS_ORDER) {
    emblemDotButtons[cid].addEventListener('click', () => selectHeroClass(cid));
    arsenalClassBtns[cid].addEventListener('click', () => selectHeroClass(cid));
    shopClassBtns[cid].addEventListener('click', () => selectHeroClass(cid));
  }

  function triggerStartRun(explicitLevel = null) {
    closeSoundPopover();
    const chosenLvl = explicitLevel || localSelectedLevel;
    if (localSelectedClass === 'mage' && !isMageStarterChosen()) {
      openMageStarterModal(chosenLvl);
      return;
    }
    (callbacks.onStartRun || callbacks.onStartGame || callbacks.onPlay)?.({
      classId: localSelectedClass,
      weaponId: currentEquippedWeaponId,
      level: chosenLvl
    });
  }

  homeJourneyBtn.addEventListener('click', () => setActiveTab('campaign_world'));
  launchBattleBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));
  arsenalQuickPlayBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));
  shopQuickPlayBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));
  storeQuickPlayBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));

  campaignStartBtn.addEventListener('click', () => {
    if (viewedCampaignLevel > cachedMaxUnlockedLevel) return;
    userPickedLevel = true;
    localSelectedLevel = viewedCampaignLevel;
    callbacks.onSelectLevel?.(viewedCampaignLevel);
    triggerStartRun(viewedCampaignLevel);
  });

  campaignWpnCheckBtn.addEventListener('click', () => {
    setActiveTab('arsenal');
  });

  // Keyboard shortcuts: Level-Up [1/2/3], Hub Heroes/Campaign [ArrowLeft/ArrowRight], Sound [Escape]
  window.addEventListener('keydown', (e) => {
    if (!soundPopover.classList.contains('hidden') && e.code === 'Escape') {
      closeSoundPopover();
      return;
    }

    if (activeLevelUpHandler && !levelUpModal.classList.contains('hidden')) {
      if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') {
        e.preventDefault();
        activeLevelUpHandler(0);
      } else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') {
        e.preventDefault();
        activeLevelUpHandler(1);
      } else if (e.code === 'Digit3' || e.code === 'Numpad3' || e.key === '3') {
        e.preventDefault();
        activeLevelUpHandler(2);
      }
      return;
    }

    if (!mageStarterModal.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        e.preventDefault();
        pendingStartAfterStarterChoice = null;
        hideMageStarterModal();
      }
      return;
    }

    if (!resetConfirmModal.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        e.preventDefault();
        hideResetConfirmModal();
      }
      return;
    }

    if (
      !e.repeat &&
      !hubScreen.classList.contains('hidden') &&
      levelUpModal.classList.contains('hidden') &&
      resultModal.classList.contains('hidden')
    ) {
      if (activeHubTab === 'home' || activeHubTab === 'heroes') {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          cycleHeroClass(-1);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          cycleHeroClass(1);
        } else if (e.code === 'Escape' && activeHubTab === 'heroes') {
          e.preventDefault();
          setActiveTab('home');
        }
      } else if (activeHubTab === 'campaign') {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          navigateCampaignChapter(viewedCampaignLevel - 1);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          navigateCampaignChapter(viewedCampaignLevel + 1);
        } else if (e.code === 'Escape') {
          e.preventDefault();
          setActiveTab('home');
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setActiveTab('home');
      }
    }
  });

  function updateRuneSegments(segNodes, ratio0to1) {
    const clamped = Math.max(0, Math.min(1, Number(ratio0to1) || 0));
    const filled = clamped <= 0.001 ? 0 : Math.max(1, Math.min(10, Math.round(clamped * 10)));
    for (let i = 0; i < segNodes.length; i++) {
      const isFilled = i < filled;
      const isTip = i === filled - 1;
      segNodes[i].classList.toggle('is-filled', isFilled);
      segNodes[i].classList.toggle('is-tip', isTip);
    }
  }

  function renderHub(rawState = {}) {
    renderSeq++;
    const storeRef = typeof rawState?.getState === 'function' ? rawState : null;
    const state = storeRef ? storeRef.getState() : rawState || {};
    lastHubState = rawState || state;

    const isEn = lang === 'en';
    const maxWpnLvl = resolveMaxWeaponShopLevel(storeRef);
    const gold = Math.floor(Number(state.gold ?? state.coins ?? 0));
    hubGoldAmount.textContent = String(gold).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    const selectedClassId =
      state.selectedClass ||
      state.selectedClassId ||
      state.currentClass ||
      state.classId ||
      localSelectedClass ||
      'warrior';
    localSelectedClass = CLASSES[selectedClassId] ? selectedClassId : 'warrior';
    const activeClass = CLASSES[localSelectedClass];
    const activeMeta = CLASS_META[localSelectedClass] || CLASS_META.warrior;

    const maxUnlockedLevel = Math.max(
      1,
      Math.min(
        LEVELS.length,
        Number(state.maxUnlockedLevel ?? state.unlockedLevel ?? state.highestUnlockedLevel ?? 1) || 1
      )
    );
    cachedMaxUnlockedLevel = maxUnlockedLevel;

    const heroLvl = Math.max(1, Number(state.heroLevel || 1));
    const heroXp = Math.max(0, Number(state.heroXp || 0));
    const heroXpNext = Math.max(1, Number(state.heroXpNext || 95));

    hubAvatarImg.src = activeClass.portrait;
    hubAvatarImg.alt = isEn ? activeClass.nameEn : activeClass.nameRu;
    hubAvatarLvlBadge.textContent = String(heroLvl);
    const lvlFillPct = Math.max(8, Math.min(100, Math.round((heroXp / heroXpNext) * 100)));
    hubLevelFill.style.width = `${lvlFillPct}%`;

    const explicitLevelLock =
      state.maxUnlockedLevel !== undefined ||
      state.unlockedLevel !== undefined ||
      state.highestUnlockedLevel !== undefined ||
      Array.isArray(state.unlockedLevels);

    if (state.selectedLevel !== undefined || state.currentLevel !== undefined) {
      localSelectedLevel = Number(state.selectedLevel ?? state.currentLevel);
    } else if (explicitLevelLock) {
      if (lastSeenMaxUnlockedLevel === null && !userPickedLevel) {
        localSelectedLevel = maxUnlockedLevel;
      } else if (lastSeenMaxUnlockedLevel !== null && maxUnlockedLevel > lastSeenMaxUnlockedLevel) {
        localSelectedLevel = maxUnlockedLevel;
        viewedCampaignLevel = maxUnlockedLevel;
        userPickedLevel = false;
      }
    }
    lastSeenMaxUnlockedLevel = maxUnlockedLevel;

    localSelectedLevel = Math.max(1, Math.min(LEVELS.length, Number(localSelectedLevel) || 1));
    if (explicitLevelLock && localSelectedLevel > maxUnlockedLevel) {
      localSelectedLevel = Math.max(1, Math.min(LEVELS.length, maxUnlockedLevel));
    }
    if (!viewedCampaignLevel || viewedCampaignLevel < 1 || viewedCampaignLevel > LEVELS.length) {
      viewedCampaignLevel = localSelectedLevel;
    }

    // Determine equipped weapon for active class
    let equippedWeaponId =
      (typeof storeRef?.getEquippedWeaponId === 'function'
        ? storeRef.getEquippedWeaponId(localSelectedClass)
        : null) ||
      state.equippedWeapons?.[localSelectedClass] ||
      state.selectedWeapons?.[localSelectedClass] ||
      (WEAPONS[state.equippedWeapon]?.classId === localSelectedClass ? state.equippedWeapon : null) ||
      activeClass.starterWeapon;

    if (!resolveWeaponUnlocked(state, storeRef, WEAPONS[equippedWeaponId])) {
      equippedWeaponId = activeClass.starterWeapon;
    }
    currentEquippedWeaponId = equippedWeaponId;

    const computedStats = typeof storeRef?.computeCombatStats === 'function'
      ? storeRef.computeCombatStats(localSelectedClass, equippedWeaponId)
      : null;

    const dispHp = computedStats ? computedStats.maxHp : activeClass.maxHp;
    const dispSpd = computedStats ? computedStats.moveSpeed : activeClass.moveSpeed;
    const dispBlk = computedStats ? computedStats.damageBlock : activeClass.damageBlock;

    // --- 1. Update Class Carousel Medallions & Arsenal/Workshop Class Switchers ---
    for (const cid of CLASS_ORDER) {
      const cDef = CLASSES[cid];
      const dot = emblemDotButtons[cid];
      if (dot && cDef) {
        dot.classList.toggle('is-active', cid === localSelectedClass);
        dot.title = isEn ? cDef.nameEn : cDef.nameRu;
      }
      const aBtn = arsenalClassBtns[cid];
      if (aBtn && cDef) {
        aBtn.classList.toggle('is-active', cid === localSelectedClass);
        const nameNode = aBtn.querySelector('.class-pill-name');
        if (nameNode) nameNode.textContent = isEn ? cDef.nameEn : cDef.nameRu;
      }
      const sBtn = shopClassBtns[cid];
      if (sBtn && cDef) {
        sBtn.classList.toggle('is-active', cid === localSelectedClass);
        const nameNode = sBtn.querySelector('.class-pill-name');
        if (nameNode) nameNode.textContent = isEn ? cDef.nameEn : cDef.nameRu;
      }
    }

    // --- 2. Update Hero Info Card (HD Portrait, 10-Seg Rune Bars, Custom SVG Weapon Chip) ---
    heroInfoCard.style.setProperty('--hero-accent', activeMeta.accent);
    heroInfoCard.style.setProperty('--hero-glow', activeMeta.glow);
    heroPortraitFrame.style.setProperty('--portrait-glow', activeMeta.glow);
    heroPortraitFrame.style.setProperty('--portrait-border', activeMeta.border);
    heroPortraitImg.src = activeClass.portrait;
    heroPortraitImg.alt = isEn ? activeClass.nameEn : activeClass.nameRu;

    heroClassName.textContent = isEn ? activeClass.nameEn : activeClass.nameRu;
    heroRolePill.textContent = isEn ? activeClass.roleEn : activeClass.roleRu;
    heroLoreLine.textContent = isEn ? activeClass.descEn : activeClass.descRu;

    statHpBar.lbl.textContent = isEn ? 'Health' : 'Здоровье';
    updateRuneSegments(statHpBar.segs, dispHp / 210);
    statHpBar.val.textContent = String(dispHp);

    statSpdBar.lbl.textContent = isEn ? 'Speed' : 'Скорость';
    updateRuneSegments(statSpdBar.segs, dispSpd / 11.2);
    statSpdBar.val.textContent = Number(dispSpd).toFixed(1);

    statBlkBar.lbl.textContent = isEn ? 'Block' : 'Блок';
    updateRuneSegments(statBlkBar.segs, dispBlk / 0.44);
    statBlkBar.val.textContent = `${Math.round(dispBlk * 100)}%`;

    const eqWpnDef = WEAPONS[equippedWeaponId] || WEAPONS[activeClass.starterWeapon];
    const eqMaxLvl = eqWpnDef?.maxLevel || maxWpnLvl;
    const eqShopLvl = resolveWeaponShopLevel(state, storeRef, eqWpnDef.id, eqMaxLvl);
    const eqUpgCost = resolveWeaponUpgradeCost(state, storeRef, callbacks, eqWpnDef, eqShopLvl, eqMaxLvl);
    const eqCanUpgrade = eqShopLvl < eqMaxLvl && typeof eqUpgCost === 'number' && gold >= eqUpgCost;

    // Pure Water Mage: hide legacy 4-element selector completely!
    mageElementsBox.classList.add('hidden');

    heroWeaponChipIcon.innerHTML = '';
    heroWeaponChipIcon.appendChild(createWeaponSvg(eqWpnDef.id));
    heroWeaponChipName.textContent = isEn ? eqWpnDef.nameEn : eqWpnDef.nameRu;
    heroWeaponChipLvl.textContent = isEn
      ? `Lv. ${eqShopLvl}/${eqMaxLvl}`
      : `Ур. ${eqShopLvl}/${eqMaxLvl}`;
    heroWeaponChipDot.classList.toggle('hidden', !eqCanUpgrade);

    // --- 3. Update Launch Dock (Selected Chapter Mini-Banner + Weapon Warning + Battle CTA) ---
    const selLevelDef = LEVELS[localSelectedLevel - 1] || LEVELS[0];
    const selActDef = ACT_DEFS[(selLevelDef.act || 1) - 1] || ACT_DEFS[0];

    chapterMiniImg.src = selLevelDef.bannerImg;
    chapterMiniImg.alt = selLevelDef.nameRu;
    chapterMiniActBadge.textContent = isEn ? `Act ${selActDef.roman}` : `Акт ${selActDef.roman}`;

    if (selLevelDef.hasBoss) {
      chapterMiniFeature.textContent = isEn ? '💀 ACT BOSS' : '💀 БОСС АКТА';
      chapterMiniFeature.className = 'chapter-mini-feature is-boss';
    } else if (selLevelDef.unlockWeaponTier) {
      chapterMiniFeature.textContent = isEn ? '🗡️ NEW WEAPON' : '🗡️ НОВОЕ ОРУЖИЕ';
      chapterMiniFeature.className = 'chapter-mini-feature is-weapon';
    } else {
      chapterMiniFeature.textContent = `⏱️ ${formatTimeMMSS(selLevelDef.durationSec)}`;
      chapterMiniFeature.className = 'chapter-mini-feature';
    }

    chapterMiniTitle.textContent = isEn ? selLevelDef.nameEn : selLevelDef.nameRu;

    const isUnderleveledForSelected = eqShopLvl < (selLevelDef.recWeaponLevel || 1);
    launchWeaponWarn.classList.toggle('hidden', !isUnderleveledForSelected);
    homeWeaponWarn.classList.toggle('hidden', !isUnderleveledForSelected);
    if (isUnderleveledForSelected) {
      const warnMsg = isEn
        ? `⚠️ Weapon Lv. ${eqShopLvl} / rec. ${selLevelDef.recWeaponLevel}`
        : `⚠️ Оружие Ур. ${eqShopLvl} / рек. ${selLevelDef.recWeaponLevel}`;
      launchWeaponWarn.textContent = warnMsg;
      homeWeaponWarn.textContent = warnMsg;
    }

    changeChapterBtn.textContent = isEn
      ? `📖 Ch. ${selLevelDef.roman} ›`
      : `📖 Глава ${selLevelDef.roman} ›`;

    launchSubText.textContent = isEn
      ? `Ch. ${selLevelDef.roman}: ${selLevelDef.shortTitleRu}`
      : `Глава ${selLevelDef.roman}: ${selLevelDef.shortTitleRu}`;

    // --- 4. Render 2-Scene World Map -> Misty Forest 25-Stage Path & 3-Star Goals ---
    const levelStarsMap = state.levelStars || {};
    const diffMode = state.difficultyMode === 'hard' ? 'hard' : 'normal';
    let earnedStarsTotal = 0;
    for (let l = 1; l <= LEVELS.length; l++) {
      earnedStarsTotal += Math.max(0, Math.min(3, Number(levelStarsMap[l] ?? levelStarsMap[String(l)] ?? 0)));
    }
    const maxStarsTotal = LEVELS.length * 3;

    campaignWorldView.classList.toggle('hidden', campaignSubView !== 'world');
    campaignForestView.classList.toggle('hidden', campaignSubView !== 'forest');

    if (worldForestStarsLabel) {
      worldForestStarsLabel.textContent = isEn
        ? `25 Stages • ★ ${earnedStarsTotal}/${maxStarsTotal}`
        : `25 этапов • ★ ${earnedStarsTotal}/${maxStarsTotal}`;
    }

    diffNormalBtn.classList.toggle('is-active', diffMode === 'normal');
    diffHardBtn.classList.toggle('is-active', diffMode === 'hard');

    const viewDef = LEVELS[viewedCampaignLevel - 1] || selLevelDef;
    const viewAct = viewDef.act || Math.ceil(viewDef.level / 5);
    const isViewLocked = explicitLevelLock && (
      Array.isArray(state.unlockedLevels)
        ? !state.unlockedLevels.includes(viewDef.level)
        : viewDef.level > maxUnlockedLevel
    );

    campaignProgressHint.textContent = isEn
      ? `★ ${earnedStarsTotal}/${maxStarsTotal} • Chapters: ${maxUnlockedLevel}/${LEVELS.length}`
      : `★ ${earnedStarsTotal}/${maxStarsTotal} • Глав: ${maxUnlockedLevel}/${LEVELS.length}`;

    campaignActPill.textContent = isEn
      ? `ACT ${ACT_DEFS[viewAct - 1]?.roman || viewAct} • CH. ${viewDef.roman}`
      : `АКТ ${ACT_DEFS[viewAct - 1]?.roman || viewAct} • ГЛАВА ${viewDef.roman}`;

    campaignChapterTitle.textContent = isEn
      ? `${viewDef.level}. ${viewDef.nameEn}`
      : `${viewDef.level}. ${viewDef.nameRu}`;
    campaignChapterLore.textContent = viewDef.subtitleRu;

    const viewStarsEarned = Math.max(0, Math.min(3, Number(levelStarsMap[viewDef.level] ?? levelStarsMap[String(viewDef.level)] ?? 0)));
    forestGoal1.classList.toggle('is-done', viewStarsEarned >= 1);
    forestGoal2.classList.toggle('is-done', viewStarsEarned >= 2);
    forestGoal3.classList.toggle('is-done', viewStarsEarned >= 3);

    const recLvl = viewDef.recWeaponLevel || 1;
    const wpnReady = eqShopLvl >= recLvl;
    campaignWpnCheckBtn.classList.toggle('is-ready', wpnReady);
    campaignWpnCheckBtn.classList.toggle('is-warn', !wpnReady);
    campaignWpnCheckIcon.innerHTML = '';
    campaignWpnCheckIcon.appendChild(createWeaponSvg(eqWpnDef.id, 'mini-check-wpn-svg'));
    campaignWpnCheckText.textContent = wpnReady
      ? (isEn ? `✓ Weapon Lv.${eqShopLvl}` : `✓ Оружие Ур.${eqShopLvl}`)
      : (isEn ? `⚠️ Rec. Lv.${recLvl}` : `⚠️ Рек. Ур.${recLvl}`);

    campaignStartBtn.disabled = isViewLocked;
    campaignStartBtn.textContent = isViewLocked
      ? (isEn ? '🔒 LOCKED' : '🔒 ЗАКРЫТО')
      : (isEn ? 'FIGHT!' : 'В БОЙ!');

    for (const nodeObj of forestNodeButtons) {
      const l = nodeObj.lvlNum;
      const cDef = LEVELS[l - 1];
      const nodeStars = Math.max(0, Math.min(3, Number(levelStarsMap[l] ?? levelStarsMap[String(l)] ?? 0)));
      const nodeLocked = explicitLevelLock && l > maxUnlockedLevel;
      const nodeCleared = l < maxUnlockedLevel || nodeStars > 0;
      const nodeCurrent = l === viewDef.level;

      nodeObj.btn.classList.toggle('is-active', nodeCurrent);
      nodeObj.btn.classList.toggle('is-cleared', nodeCleared && !nodeLocked);
      nodeObj.btn.classList.toggle('is-locked', nodeLocked);
      nodeObj.btn.classList.toggle('is-boss', Boolean(cDef?.hasBoss));
      nodeObj.btn.disabled = nodeLocked;

      nodeObj.levBadge.classList.toggle('hidden', !nodeCurrent);
      nodeObj.levBadge.textContent = isEn ? `St. ${l}` : `Гл. ${l}`;
      nodeObj.coin.textContent = cDef?.hasBoss ? `💀` : String(l);

      nodeObj.starsRow.innerHTML = '';
      if (!nodeLocked && (nodeCleared || nodeCurrent)) {
        for (let s = 1; s <= 3; s++) {
          nodeObj.starsRow.appendChild(el('span', `node-star${s <= nodeStars ? ' is-lit' : ''}`, '★'));
        }
      }
    }

    // --- 5. Render 🗡️ Арсенал & 🛒 Магазин (Unified Floating 3D Weapon Showcase + Gothic Stats Plaque!) ---
    arsenalMageElementsBox.classList.add('hidden');
    arsenalMageElementsBox.innerHTML = '';
    let anyWeaponUpgradeAffordable = false;
    const allClassWeapons = activeClass.weapons || [activeClass.starterWeapon];
    const ownedClassWeapons = allClassWeapons.filter((wId) => WEAPONS[wId] && resolveWeaponUnlocked(state, storeRef, WEAPONS[wId]));
    const arsenalList = ownedClassWeapons.length > 0 ? ownedClassWeapons : [activeClass.starterWeapon];
    const unownedShopWeapons = allClassWeapons.filter((wId) => {
      const wDef = WEAPONS[wId];
      return wDef && !wDef.bossExclusive && !resolveWeaponUnlocked(state, storeRef, wDef);
    });

    for (const wId of arsenalList) {
      const wDef = WEAPONS[wId];
      if (!wDef) continue;
      const wMax = wDef.maxLevel || maxWpnLvl;
      const sLvl = resolveWeaponShopLevel(state, storeRef, wId, wMax);
      const uCost = resolveWeaponUpgradeCost(state, storeRef, callbacks, wDef, sLvl, wMax);
      if (sLvl < wMax && typeof uCost === 'number' && gold >= uCost) {
        anyWeaponUpgradeAffordable = true;
      }
    }

    const isShopShowcase = activeHubTab === 'store';
    const activeShowcaseList = isShopShowcase ? unownedShopWeapons : arsenalList;
    arsenalPrevBtn.classList.toggle('hidden', activeShowcaseList.length <= 1);
    arsenalNextBtn.classList.toggle('hidden', activeShowcaseList.length <= 1);

    let activeShowcaseIdx = 0;
    if (isShopShowcase) {
      if (viewedShopWeaponIdx < 0 || viewedShopWeaponIdx >= activeShowcaseList.length) {
        viewedShopWeaponIdx = 0;
      }
      activeShowcaseIdx = viewedShopWeaponIdx;
    } else {
      if (viewedArsenalWeaponIdx < 0 || viewedArsenalWeaponIdx >= arsenalList.length) {
        viewedArsenalWeaponIdx = Math.max(0, arsenalList.indexOf(equippedWeaponId));
      }
      activeShowcaseIdx = viewedArsenalWeaponIdx;
    }

    const atStart = activeShowcaseIdx <= 0;
    const atEnd = activeShowcaseIdx >= Math.max(0, activeShowcaseList.length - 1);
    arsenalPrevBtn.disabled = atStart;
    arsenalNextBtn.disabled = atEnd;
    arsenalPrevBtn.classList.toggle('is-disabled', atStart);
    arsenalNextBtn.classList.toggle('is-disabled', atEnd);

    const formatWeaponTag = (wDef) => {
      if (!wDef) return '';
      if (wDef.id === 'spear') return ' • 2 в линию (100%/50%)';
      if (wDef.id === 'zweihander') return ' • 2 цели спереди • Обезоруживание 20% (2 с)';
      if (wDef.id === 'axe') return ' • До 3 целей спереди (100%)';
      if (wDef.id === 'boss_hammer') return ' • 3 спереди + 1 за спиной • Стан 25%';
      if (wDef.id === 'usp_pistol') return ` • ${wDef.magSize} патр. (${wDef.reloadTime} с) • Без пробития`;
      if (wDef.id === 'colt') return ` • ${wDef.magSize} патр. (${wDef.reloadTime} с) • 3 цели (100/50/25%)`;
      if (wDef.id === 'smg') return ` • ${wDef.magSize} патр. (${wDef.reloadTime} с) • Разброс 10–40%`;
      if (wDef.id === 'pistol') return ` • ${wDef.magSize} патр. (0.5 с/патр.) • Разброс 10–80%`;
      if (wDef.id === 'ak47') return ` • ${wDef.magSize} патр. (${wDef.reloadTime} с) • 2 цели • Вся карта`;
      if ((wDef.splashRadius || 0) > 0) return ' • Сплэш';
      return wDef.type === 'melee' ? ' • В 1 цель' : ' • Точечный';
    };

    const setButtonLabel = (btn, labelText) => {
      btn.innerHTML = '';
      btn.append(
        el('span', 'upgrade-btn-rune', 'ᛟ ᚦ ᚱ'),
        el('span', 'upgrade-btn-main', labelText),
        el('span', 'upgrade-btn-rune', 'ᚱ ᚦ ᛟ')
      );
    };

    if (isShopShowcase && activeShowcaseList.length === 0) {
      callbacks.onPreviewArsenalWeapon?.('__NONE__', false);
      arsenalCrestDiamond.innerHTML = '';
      arsenalCrestDiamond.appendChild(createWeaponSvg(equippedWeaponId));
      arsenalHeading.textContent = isEn ? 'All Weapons Owned' : 'Всё оружие куплено';
      arsenalSubhint.textContent = isEn ? activeClass.nameEn : `${activeClass.nameRu} • Магазин`;
      arsenalDmgRow.classList.add('hidden');
      arsenalPwrRow.classList.add('hidden');
      arsenalWeaponMeta.classList.add('hidden');
      arsenalWeaponDesc.textContent = isEn
        ? 'All purchasable weapons for this class are already in your Arsenal.'
        : 'Всё доступное для покупки оружие этого класса уже куплено и находится в Арсенале.';
      arsenalWeaponDesc.classList.remove('hidden');
      arsenalLockBanner.classList.add('hidden');
      arsenalEquipStageBtn.classList.add('hidden');
      arsenalUpgradeStageBtn.classList.remove('hidden');
      arsenalUpgradeStageBtn.disabled = false;
      setButtonLabel(arsenalUpgradeStageBtn, isEn ? 'Open Arsenal ›' : 'ПЕРЕЙТИ В АРСЕНАЛ ›');
      arsenalUpgradeStageBtn.onclick = () => setActiveTab('arsenal');
    } else {
      const inspectedWpnId = activeShowcaseList[activeShowcaseIdx] || equippedWeaponId;
      const inspectedDef = WEAPONS[inspectedWpnId] || eqWpnDef;
      const inspectedMaxLvl = inspectedDef.maxLevel || maxWpnLvl;
      const inspectedUnlocked = resolveWeaponUnlocked(state, storeRef, inspectedDef);
      const inspectedEquipped = inspectedUnlocked && inspectedDef.id === equippedWeaponId;
      const inspectedLvl = isShopShowcase ? 1 : resolveWeaponShopLevel(state, storeRef, inspectedDef.id, inspectedMaxLvl);
      const inspectedCost = resolveWeaponUpgradeCost(state, storeRef, callbacks, inspectedDef, inspectedLvl, inspectedMaxLvl);
      const inspectedMaxed = inspectedLvl >= inspectedMaxLvl || inspectedCost === null;

      callbacks.onPreviewArsenalWeapon?.(inspectedDef.id, false);
      arsenalCrestDiamond.innerHTML = '';
      arsenalCrestDiamond.appendChild(createWeaponSvg(inspectedDef.id));

      arsenalHeading.textContent = isEn ? inspectedDef.nameEn : inspectedDef.nameRu;
      const tierStr = TIER_ROMAN[inspectedDef.tier] || inspectedDef.tier;
      const splashTag = formatWeaponTag(inspectedDef);
      const shopCost = inspectedDef.shopCost || 200;

      arsenalSubhint.textContent = isShopShowcase
        ? `Магазин • Ранг ${tierStr}${splashTag}`
        : activeShowcaseList.length <= 1
          ? `Уровень ${inspectedLvl} / ${inspectedMaxLvl}${splashTag}`
          : `Ранг ${tierStr} • Уровень ${inspectedLvl} / ${inspectedMaxLvl}${splashTag}`;

      const scaledDmg = Math.round(inspectedDef.baseDamage * (1 + (inspectedLvl - 1) * 0.24));
      const totalBurstDmg = scaledDmg * (inspectedDef.pellets > 1 ? inspectedDef.pellets : 1);
      arsenalDmgRow.classList.remove('hidden');
      arsenalPwrRow.classList.remove('hidden');
      arsenalDmgLbl.textContent = isEn ? '⚔ Damage' : '⚔ Урон';
      arsenalDmgVal.textContent = inspectedDef.pellets > 1 ? `${scaledDmg}×${inspectedDef.pellets}` : String(scaledDmg);
      arsenalDmgFill.style.width = `${Math.max(12, Math.min(100, Math.round((totalBurstDmg / 60) * 100)))}%`;

      const piercePct = Math.round((inspectedDef.armorPierce || 0) * 100);
      arsenalPwrLbl.textContent = isEn ? '🛡 Armor Pierce' : '🛡 Пробитие брони';
      arsenalPwrVal.textContent = `${piercePct}%`;
      arsenalPwrFill.style.width = `${Math.max(10, Math.min(100, piercePct))}%`;

      const effMove = +(activeClass.moveSpeed * (inspectedDef.moveSpeedMult ?? 1.0)).toFixed(2);
      arsenalWeaponMeta.textContent = isShopShowcase
        ? `⏱ ${inspectedDef.cooldown} с • 📏 ${inspectedDef.range} м • 💨 ${effMove} м/с • 💰 ${shopCost} 🪙`
        : `⏱ ${inspectedDef.cooldown} с • 📏 ${inspectedDef.range} м • 💨 ${effMove} м/с`;
      arsenalWeaponMeta.classList.remove('hidden');
      arsenalWeaponDesc.textContent = inspectedDef.descRu || '';
      arsenalWeaponDesc.classList.toggle('hidden', !inspectedDef.descRu);

      if (isShopShowcase) {
        const bpFound = Boolean(state.unlockedBlueprints?.[inspectedDef.id]);
        const bossClearOk = !inspectedDef.unlockRequiresBossStage || maxUnlockedLevel > inspectedDef.unlockRequiresBossStage;
        const lvlOk = !inspectedDef.unlockLevel || maxUnlockedLevel >= inspectedDef.unlockLevel;
        const needsBlueprint = Boolean(inspectedDef.blueprintChestChance && !bpFound);

        let lockReason = '';
        let canBuyNow = true;
        if (needsBlueprint) {
          lockReason = `📜 Чертёж из сундуков с ${inspectedDef.unlockLevel || 3}-го этапа (20%) • Цена: ${shopCost} 🪙`;
          canBuyNow = false;
        } else if (!bossClearOk) {
          lockReason = `🔒 Откроется после босса ${inspectedDef.unlockRequiresBossStage}-го этапа • Цена: ${shopCost} 🪙`;
          canBuyNow = false;
        } else if (!lvlOk) {
          lockReason =
            inspectedDef.unlockLevel === 8
              ? `🔒 Откроется после 7-го этапа • Цена: ${shopCost} 🪙`
              : inspectedDef.unlockLevel === 11
                ? `🔒 Откроется после 10-го этапа • Цена: ${shopCost} 🪙`
                : `🔒 Доступно с ${inspectedDef.unlockLevel}-го этапа • Цена: ${shopCost} 🪙`;
          canBuyNow = false;
        } else if (gold < shopCost) {
          canBuyNow = false;
        }

        arsenalLockBanner.classList.toggle('hidden', !lockReason);
        if (lockReason) arsenalLockBanner.textContent = lockReason;

        arsenalEquipStageBtn.classList.add('hidden');
        arsenalUpgradeStageBtn.classList.remove('hidden');
        arsenalUpgradeStageBtn.disabled = !canBuyNow;
        setButtonLabel(
          arsenalUpgradeStageBtn,
          lockReason
            ? `🔒 НЕДОСТУПНО • ${shopCost} 🪙`
            : gold < shopCost
              ? `МАЛО ЗОЛОТА • ${shopCost} 🪙`
              : `🛒 КУПИТЬ • ${shopCost} 🪙`
        );
        arsenalUpgradeStageBtn.onclick = () => {
          callbacks.onBuyWeapon?.(inspectedDef.id);
        };
      } else {
        arsenalLockBanner.classList.add('hidden');
        arsenalEquipStageBtn.classList.toggle('hidden', !inspectedUnlocked || arsenalList.length <= 1);
        arsenalEquipStageBtn.classList.toggle('in-hands', inspectedEquipped);
        arsenalEquipStageBtn.disabled = inspectedEquipped;
        arsenalEquipStageBtn.textContent = inspectedEquipped
          ? isEn
            ? '✓ Equipped'
            : '✓ В руках'
          : isEn
            ? 'Equip Weapon'
            : 'Взять в руки';
        arsenalEquipStageBtn.onclick = () => {
          if (inspectedUnlocked && !inspectedEquipped) {
            (callbacks.onEquipWeapon || callbacks.onSelectWeapon)?.(inspectedDef.id, localSelectedClass);
          }
        };

        arsenalUpgradeStageBtn.classList.toggle('hidden', !inspectedUnlocked);
        arsenalUpgradeStageBtn.disabled =
          !inspectedUnlocked || inspectedMaxed || (typeof inspectedCost === 'number' && gold < inspectedCost);
        setButtonLabel(
          arsenalUpgradeStageBtn,
          inspectedMaxed
            ? `МАКС. ${inspectedMaxLvl}/${inspectedMaxLvl}`
            : inspectedCost
              ? `УЛУЧШИТЬ • ${inspectedCost}`
              : 'УЛУЧШИТЬ'
        );
        arsenalUpgradeStageBtn.onclick = () => {
          if (inspectedUnlocked && !inspectedMaxed) {
            callbacks.onUpgradeWeapon?.(inspectedDef.id);
          }
        };
      }
    }

    tabArsenalDot.classList.toggle('hidden', !anyWeaponUpgradeAffordable);

    // --- 6. Render 🌿 Древо Талантов (Menu-Only Per-Class Talent Tree for Воин, Стрелок, Маг!) ---
    const heroLvlNum = Math.max(1, Number(state.heroLevel || 1));
    const classTree = CLASS_TALENT_TREES[localSelectedClass] || MAGE_TALENT_TREE;
    const clsRanks =
      state.classTalents?.[localSelectedClass] ||
      (localSelectedClass === 'mage' ? state.mageTalents || {} : {});
    const getRank = (id) =>
      typeof storeRef?.getClassTalentRank === 'function'
        ? storeRef.getClassTalentRank(localSelectedClass, id)
        : Math.max(0, Number(clsRanks[id] || 0));
    const ptsSpent = classTree.reduce((acc, n) => acc + getRank(n.id), 0);
    const ptsAvail = Math.max(0, heroLvlNum - ptsSpent);

    masteryClassBadgeImg.src = activeClass.portrait;
    masteryClassBadgeImg.alt = activeClass.nameRu;
    masteryClassBadgeText.textContent = isEn
      ? `${activeClass.nameEn} • Talent Tree (Menu Only)`
      : `${activeClass.nameRu} • Древо талантов (только в меню)`;

    rewardGoldBtn.classList.add('hidden');
    talentPointsPill.textContent = isEn
      ? `✨ Skill Points: ${ptsAvail} (Lv. ${heroLvlNum})`
      : `✨ Очки таланта: ${ptsAvail} (Ур. ${heroLvlNum})`;
    talentResetBtn.classList.toggle('hidden', ptsSpent <= 0);
    talentResetBtn.onclick = () => {
      if (callbacks.onResetTalents) {
        callbacks.onResetTalents(localSelectedClass);
      } else {
        callbacks.onResetMageTalents?.();
      }
    };

    masteryGrid.innerHTML = '';
    masteryGrid.className = 'mastery-grid talent-tree-shell';

    {
      const curSelectedId = selectedTalentByClass[localSelectedClass] || classTree[0]?.id;
      const treeBoard = el('div', 'talent-tree-board');
      const colPct = { 1: 20, 2: 50, 3: 80 };
      const rowPct = { 1: 12, 2: 37, 3: 63, 4: 88 };
      let linesSvg = '';
      for (const b of classTree) {
        for (const r of b.requires || []) {
          const a = classTree.find((n) => n.id === r.id);
          if (!a) continue;
          const bRank = getRank(b.id);
          const reqMet = (b.requires || []).every((req) => getRank(req.id) >= (req.rank || 1));
          const clsEdge = bRank > 0 ? 'is-active' : reqMet ? 'is-ready' : 'is-locked';
          linesSvg += `<line x1="${colPct[a.col]}%" y1="${rowPct[a.row]}%" x2="${colPct[b.col]}%" y2="${rowPct[b.row]}%" class="talent-edge ${clsEdge}" />`;
        }
      }
      const svgCanvas = makeSvgNode(
        `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="talent-edges-svg" xmlns="http://www.w3.org/2000/svg">${linesSvg}</svg>`
      );
      treeBoard.appendChild(svgCanvas);

      for (const node of classTree) {
        const rank = getRank(node.id);
        const reqMet = (node.requires || []).every((r) => getRank(r.id) >= (r.rank || 1));
        const isMaxed = rank >= node.maxRank;
        const canBuy = ptsAvail >= 1 && reqMet && !isMaxed;

        const nodeBtn = el(
          'button',
          `talent-node-btn${curSelectedId === node.id ? ' is-selected' : ''}${
            rank > 0 ? ' is-learned' : ''
          }${canBuy ? ' is-upgradeable' : ''}${!reqMet ? ' is-locked' : ''}`
        );
        nodeBtn.type = 'button';
        nodeBtn.style.gridColumn = String(node.col);
        nodeBtn.style.gridRow = String(node.row);
        nodeBtn.title = `${node.nameRu} (${rank}/${node.maxRank})`;

        const iconWrap = el('div', 'talent-node-icon');
        iconWrap.appendChild(createTalentRuneSvg(node.iconKind));
        const rankBadge = el('span', 'talent-node-rank', `${rank}/${node.maxRank}`);
        const nameLbl = el('span', 'talent-node-name', node.nameRu);
        nodeBtn.append(iconWrap, rankBadge, nameLbl);

        nodeBtn.addEventListener('click', () => {
          if (curSelectedId === node.id && canBuy) {
            if (callbacks.onUpgradeTalent) {
              callbacks.onUpgradeTalent(localSelectedClass, node.id);
            } else {
              callbacks.onUpgradeMageTalent?.(node.id);
            }
          } else {
            selectedTalentByClass[localSelectedClass] = node.id;
            if (localSelectedClass === 'mage') selectedMageTalentId = node.id;
            renderHub(lastHubState || storeRef);
          }
        });
        treeBoard.appendChild(nodeBtn);
      }

      const selNode = classTree.find((n) => n.id === curSelectedId) || classTree[0];
      const selRank = getRank(selNode.id);
      const selReqMet = (selNode.requires || []).every((r) => getRank(r.id) >= (r.rank || 1));
      const selMaxed = selRank >= selNode.maxRank;
      const selCanBuy = ptsAvail >= 1 && selReqMet && !selMaxed;

      const inspector = el('div', 'talent-inspector-card');
      const inspTop = el('div', 'talent-insp-top');
      const inspIconBox = el('div', 'talent-insp-icon');
      inspIconBox.appendChild(createTalentRuneSvg(selNode.iconKind));
      const inspHeadText = el('div', 'talent-insp-headtext');
      inspHeadText.append(
        el('span', 'talent-insp-tier', `Уровень древа ${selNode.tier} • Ранг ${selRank}/${selNode.maxRank}`),
        el('h3', 'talent-insp-title', selNode.nameRu)
      );
      inspTop.append(inspIconBox, inspHeadText);

      const inspStatPill = el('div', 'talent-insp-stat', selNode.statBadgeRu);
      const inspDesc = el('p', 'talent-insp-desc', selNode.descRu);

      let reqText = 'Готов к изучению (только в меню лагеря).';
      if (!selReqMet) {
        const missing = (selNode.requires || [])
          .filter((r) => getRank(r.id) < (r.rank || 1))
          .map((r) => {
            const pNode = classTree.find((x) => x.id === r.id);
            return `«${pNode?.nameRu || r.id}» ур. ${r.rank || 1}`;
          })
          .join(', ');
        reqText = `Требуется: ${missing}`;
      } else if (selMaxed) {
        reqText = '✓ Навык полностью изучен!';
      } else if (ptsAvail <= 0) {
        reqText = 'Повышайте уровень героя в бою, чтобы получить +1 очко таланта.';
      }
      const inspReq = el('div', `talent-insp-req${!selReqMet ? ' is-blocked' : ''}`, reqText);

      const learnBtn = el(
        'button',
        'arsenal-gothic-upgrade-btn talent-learn-btn',
        selMaxed ? '✓ МАКСИМУМ' : selCanBuy ? 'ИЗУЧИТЬ • 1 ОЧКО' : !selReqMet ? '🔒 ЗАБЛОКИРОВАНО' : 'НЕТ ОЧКОВ'
      );
      learnBtn.type = 'button';
      learnBtn.disabled = !selCanBuy;
      learnBtn.addEventListener('click', () => {
        if (selCanBuy) {
          if (callbacks.onUpgradeTalent) {
            callbacks.onUpgradeTalent(localSelectedClass, selNode.id);
          } else {
            callbacks.onUpgradeMageTalent?.(selNode.id);
          }
        }
      });

      inspector.append(inspTop, inspStatPill, inspDesc, inspReq, learnBtn);
      masteryGrid.append(treeBoard, inspector);
    }

    tabShopDot.classList.toggle('hidden', ptsAvail <= 0);

    // --- 7. Clear Legacy Store Grid (Магазин now uses Unified 3D Floating Weapon Showcase above — zero Supply Chest or Hunter Upgrades!) ---
    storeCardsGrid.innerHTML = '';
  }

  // =========================================================================
  // FAST CACHED COMBAT HUD UPDATER (Dirty-Checked Primitives Only)
  // =========================================================================
  const hudCache = {
    hpText: '',
    hpScale: -1,
    blockPct: -1,
    sealsCount: -1,
    beastActive: false,
    beastTimerText: '',
    beastScale: -1,
    companionActive: false,
    companionText: '',
    bossActive: false,
    bossName: '',
    bossNums: '',
    bossScale: -1,
    levelTitle: '',
    timerStr: '',
    relicVisible: false,
    relicAngle: -999,
    relicDist: -1,
    gold: -1,
    kills: -1,
    weaponId: '',
    weaponName: '',
    weaponRunLvl: -1,
    ammo: -1,
    maxAmmo: -1,
    ammoStyle: '',
    isReloading: false,
    reloadQuant: -1,
    overdriveVisible: false,
    overdriveLabel: '',
    overdriveScale: -1,
    perkSig: '',
    soulLevel: -1,
    xpNums: '',
    xpScale: -1
  };

  function updateHud(snapshot) {
    if (!snapshot) return;

    // 1. HP + Block
    const maxHp = Math.max(1, Math.round(Number(snapshot.maxHp ?? snapshot.player?.maxHp ?? 100)));
    const hp = Math.max(0, Math.ceil(Number(snapshot.hp ?? snapshot.currentHp ?? snapshot.player?.hp ?? maxHp)));
    const hpStr = `${hp} / ${maxHp}`;
    if (hpStr !== hudCache.hpText) {
      hudCache.hpText = hpStr;
      hpBarText.textContent = hpStr;
    }

    const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
    const hpQuant = Math.round(hpRatio * 1000);
    if (hpQuant !== hudCache.hpScale) {
      hudCache.hpScale = hpQuant;
      const tf = `scaleX(${hpRatio.toFixed(3)})`;
      hpBarFill.style.transform = tf;
      hpBarTrail.style.transform = tf;
    }

    const rawBlock = Number(snapshot.damageBlock ?? snapshot.block ?? snapshot.armor ?? snapshot.player?.damageBlock ?? 0);
    const blockPct = rawBlock <= 1 ? Math.round(rawBlock * 100) : Math.round(rawBlock);
    if (blockPct !== hudCache.blockPct) {
      hudCache.blockPct = blockPct;
      armorPill.textContent = `Блок ${blockPct}%`;
    }

    // 2. Beast Seals vs Active Beast Mode Bar
    const beastTimer = Number(snapshot.beastTimer ?? snapshot.beastTimeLeft ?? 0);
    const isBeast = Boolean(snapshot.beastActive || snapshot.isBeastMode || beastTimer > 0);

    if (isBeast !== hudCache.beastActive) {
      hudCache.beastActive = isBeast;
      sealSlotsWrap.classList.toggle('hidden', isBeast);
      beastActiveBar.classList.toggle('hidden', !isBeast);
    }

    if (isBeast) {
      const bMax = Math.max(0.1, Number(snapshot.beastDuration ?? snapshot.beastMaxTimer ?? 10));
      const bRatio = Math.max(0, Math.min(1, beastTimer / bMax));
      const bQuant = Math.round(bRatio * 500);
      if (bQuant !== hudCache.beastScale) {
        hudCache.beastScale = bQuant;
        beastBarFill.style.transform = `scaleX(${bRatio.toFixed(3)})`;
      }
      const bTimeStr = `${Math.max(0, beastTimer).toFixed(1)}с`;
      if (bTimeStr !== hudCache.beastTimerText) {
        hudCache.beastTimerText = bTimeStr;
        beastBarTimer.textContent = bTimeStr;
      }
    } else {
      const seals = Math.max(0, Math.min(5, Number(snapshot.beastSeals ?? snapshot.seals ?? snapshot.clovers ?? 0)));
      if (seals !== hudCache.sealsCount) {
        hudCache.sealsCount = seals;
        for (let i = 0; i < 5; i++) {
          sealSlotNodes[i].classList.toggle('filled', i < seals);
        }
      }
    }

    // 3. Companion Active Badge
    const compTimer = Number(snapshot.companionTimer ?? snapshot.companionTimeLeft ?? 0);
    const hasComp = Boolean(snapshot.companionActive || snapshot.hasCompanion || compTimer > 0 || snapshot.companion);
    if (hasComp !== hudCache.companionActive) {
      hudCache.companionActive = hasComp;
      companionPill.classList.toggle('hidden', !hasComp);
    }
    if (hasComp) {
      const cText = compTimer > 0 ? `Напарник в строю (${Math.ceil(compTimer)}с)` : 'Напарник в строю';
      if (cText !== hudCache.companionText) {
        hudCache.companionText = cText;
        companionPill.textContent = cText;
      }
    }

    // 4. Boss Bar vs Wave Countdown Timer
    const boss = snapshot.boss;
    const bossHp = Number(boss?.hp ?? snapshot.bossHp ?? 0);
    const isBossActive = Boolean((boss && boss.active !== false && bossHp > 0) || snapshot.bossActive);

    if (isBossActive !== hudCache.bossActive) {
      hudCache.bossActive = isBossActive;
      bossBarBox.classList.toggle('hidden', !isBossActive);
      waveBox.classList.toggle('hidden', isBossActive);
    }

    if (isBossActive) {
      const bMaxHp = Math.max(1, Number(boss?.maxHp ?? snapshot.bossMaxHp ?? 1450));
      const bPrefix = boss?.isMiniBoss ? '⚔️ МИНИ-БОСС: ' : '💀 ';
      const bName = `${bPrefix}${(boss?.nameRu || 'БОСС АКТА').toUpperCase()}`;
      if (bName !== hudCache.bossName) {
        hudCache.bossName = bName;
        bossBarName.textContent = bName;
      }
      const bNums = `${Math.ceil(bossHp)} / ${Math.round(bMaxHp)}`;
      if (bNums !== hudCache.bossNums) {
        hudCache.bossNums = bNums;
        bossHpNumbers.textContent = bNums;
      }
      const bScale = Math.max(0, Math.min(1, bossHp / bMaxHp));
      const bQuant = Math.round(bScale * 1000);
      if (bQuant !== hudCache.bossScale) {
        hudCache.bossScale = bQuant;
        bossBarFill.style.transform = `scaleX(${bScale.toFixed(3)})`;
      }
    } else {
      const lvlNum = Number(snapshot.level ?? snapshot.levelNumber ?? 1);
      const lTitle =
        snapshot.levelNameRu ||
        snapshot.levelTitle ||
        snapshot.levelName ||
        LEVELS[lvlNum - 1]?.nameRu ||
        `Глава ${lvlNum}`;
      if (lTitle !== hudCache.levelTitle) {
        hudCache.levelTitle = lTitle;
        hudLevelTitle.textContent = lTitle;
      }
      const tStr =
        snapshot.phaseText ||
        formatTimeMMSS(snapshot.timeRemaining ?? snapshot.timeLeft ?? snapshot.waveTimer ?? 0);
      if (tStr !== hudCache.timerStr) {
        hudCache.timerStr = tStr;
        hudWaveTimer.textContent = tStr;
      }
    }

    // 5. Relic Weapon Crate Directional Compass Pill
    const cratePos =
      snapshot.relicCratePos ?? snapshot.weaponCratePos ?? snapshot.relicCrate?.pos ?? snapshot.relicCrate ?? null;
    const hasRelic = Boolean(
      cratePos && cratePos.active !== false && typeof cratePos.x === 'number' && typeof cratePos.z === 'number'
    );

    if (hasRelic !== hudCache.relicVisible) {
      hudCache.relicVisible = hasRelic;
      relicHintPill.classList.toggle('hidden', !hasRelic);
    }

    if (hasRelic) {
      const pPos = snapshot.playerPos ?? snapshot.player?.pos ?? snapshot.player ?? { x: 0, z: 0 };
      const dx = cratePos.x - (Number(pPos.x) || 0);
      const dz = cratePos.z - (Number(pPos.z) || 0);
      const angleDeg = Math.round((Math.atan2(dx, -dz) * 180) / Math.PI);
      const distMeters = Math.max(1, Math.round(Math.hypot(dx, dz)));

      if (angleDeg !== hudCache.relicAngle) {
        hudCache.relicAngle = angleDeg;
        relicArrow.style.transform = `rotate(${angleDeg}deg)`;
      }
      if (distMeters !== hudCache.relicDist) {
        hudCache.relicDist = distMeters;
        relicDistBadge.textContent = `${distMeters}м`;
      }
    }

    // 6. Gold, Kills, Auto-Aim, Volume & Mute
    const goldVal = Math.floor(
      Number(snapshot.gold ?? snapshot.goldTotal ?? snapshot.goldRun ?? snapshot.runGold ?? snapshot.coins ?? 0)
    );
    if (goldVal !== hudCache.gold) {
      hudCache.gold = goldVal;
      hudGoldVal.textContent = String(goldVal);
    }

    const killsVal = Math.floor(Number(snapshot.kills ?? snapshot.killCount ?? 0));
    if (killsVal !== hudCache.kills) {
      hudCache.kills = killsVal;
      hudKillsVal.textContent = String(killsVal);
    }

    if (typeof snapshot.autoAim === 'boolean' && snapshot.autoAim !== autoAim) {
      autoAim = snapshot.autoAim;
      syncAutoAimButton();
    }
    if (typeof snapshot.volume === 'number' && Math.abs(snapshot.volume - volume) > 0.005) {
      volume = Math.max(0, Math.min(1, snapshot.volume));
      if (volume > 0.01) lastNonZeroVolume = volume;
      syncMuteButtons();
    }
    if (typeof snapshot.muted === 'boolean' && snapshot.muted !== muted) {
      muted = snapshot.muted;
      syncMuteButtons();
    }

    // 7. Bottom Weapon SVG + Shotgun Shell / Mana Charge Pips + Golden Reload Bar + [R] Button
    const wId = snapshot.weaponId || snapshot.weaponDef?.id || snapshot.weapon?.id || 'club';
    const wDef = WEAPONS[wId];
    const baseWName =
      snapshot.weaponName || snapshot.weaponDef?.nameRu || snapshot.weapon?.nameRu || wDef?.nameRu || 'Клинок Клятвы';
    const elemDef = snapshot.mageElement ? MAGE_ELEMENTS[snapshot.mageElement] : null;
    const wName = elemDef && snapshot.usesMana ? `${elemDef.icon} ${baseWName}` : baseWName;
    const wRunLvl = Math.max(1, Number(snapshot.weaponRunLevel ?? snapshot.weaponLevel ?? snapshot.weapon?.runLevel ?? 1));

    if (wId !== hudCache.weaponId) {
      hudCache.weaponId = wId;
      weaponHudIcon.innerHTML = '';
      weaponHudIcon.appendChild(createWeaponSvg(wId, 'hud-wpn-svg'));
    }
    if (wName !== hudCache.weaponName) {
      hudCache.weaponName = wName;
      weaponHudName.textContent = wName;
    }
    if (wRunLvl !== hudCache.weaponRunLvl) {
      hudCache.weaponRunLvl = wRunLvl;
      weaponHudLvl.textContent = `Ранг боя ${wRunLvl}`;
    }

    const usesMana = Boolean(snapshot.usesMana && Number(snapshot.maxMana) > 0);
    const rawMaxAmmo = usesMana ? 0 : Number(snapshot.maxAmmo ?? snapshot.magSize ?? snapshot.clipSize ?? wDef?.magSize ?? 0);
    const maxAmmo = Number.isFinite(rawMaxAmmo) && rawMaxAmmo > 0 ? Math.round(rawMaxAmmo) : 0;
    const rawAmmo = Number(snapshot.ammo ?? snapshot.currentAmmo ?? snapshot.clipAmmo ?? maxAmmo);
    const ammo = maxAmmo > 0 ? Math.max(0, Math.min(maxAmmo, Math.round(rawAmmo))) : 0;

    const reloadRem = Number(snapshot.reloadTimer ?? snapshot.reloadTimeLeft ?? 0);
    const isReloading = !usesMana && Boolean(snapshot.isReloading || snapshot.reloading || reloadRem > 0);
    const ammoKind = wDef?.type === 'magic' ? 'mana' : 'shell';

    const hasMagazine = maxAmmo > 0 && !usesMana;
    hudReloadBtn.classList.toggle('hidden', !hasMagazine);
    manaBarWrap.classList.toggle('hidden', !usesMana);
    if (usesMana) {
      const curMana = Math.max(0, Number(snapshot.mana) || 0);
      const maxMana = Math.max(1, Number(snapshot.maxMana) || 120);
      const regen = Number(snapshot.manaRegen) || 9.5;
      const mText = `💧 ${Math.floor(curMana)} / ${Math.round(maxMana)}`;
      if (mText !== hudCache.manaText) {
        hudCache.manaText = mText;
        manaBarLabel.textContent = mText;
      }
      const rText = `+${regen.toFixed(1)}/с`;
      if (rText !== hudCache.manaRegenText) {
        hudCache.manaRegenText = rText;
        manaRegenTag.textContent = rText;
      }
      const mRatio = Math.max(0, Math.min(1, curMana / maxMana));
      const mQuant = Math.round(mRatio * 500);
      if (mQuant !== hudCache.manaQuant) {
        hudCache.manaQuant = mQuant;
        manaBarFill.style.transform = `scaleX(${mRatio.toFixed(3)})`;
      }
    }
    if (hasMagazine) {
      const canManualReload = !isReloading && ammo < maxAmmo;
      hudReloadBtn.disabled = !canManualReload;
      hudReloadBtn.classList.toggle('is-reloading', isReloading);
      hudReloadBtn.classList.toggle('is-low', !isReloading && ammo <= Math.max(1, Math.floor(maxAmmo * 0.25)));
    }

    const showAmmoDuringPartial = isReloading && Number(snapshot.reloadPerShellTime || 0) > 0;
    if (isReloading !== hudCache.isReloading || maxAmmo !== hudCache.maxAmmo || showAmmoDuringPartial) {
      hudCache.isReloading = isReloading;
      reloadBarWrap.classList.toggle('hidden', !isReloading);
      weaponAmmoRow.classList.toggle('hidden', !hasMagazine || (isReloading && !showAmmoDuringPartial));
    }

    if (isReloading) {
      let rProg = 0.5;
      if (typeof snapshot.reloadProgress === 'number') {
        rProg = Math.max(0, Math.min(1, snapshot.reloadProgress));
      } else if (typeof snapshot.reloadRatio === 'number') {
        rProg = Math.max(0, Math.min(1, snapshot.reloadRatio));
      } else if (reloadRem > 0) {
        const totalRel = Math.max(
          0.1,
          Number(snapshot.reloadDuration ?? snapshot.reloadMaxTime ?? wDef?.reloadTime ?? 1.3)
        );
        rProg = Math.max(0, Math.min(1, 1 - reloadRem / totalRel));
      }
      const rQuant = Math.round(rProg * 500);
      if (rQuant !== hudCache.reloadQuant) {
        hudCache.reloadQuant = rQuant;
        reloadBarFill.style.transform = `scaleX(${rProg.toFixed(3)})`;
      }
    }
    if (hasMagazine && (!isReloading || showAmmoDuringPartial)) {
      if (ammo !== hudCache.ammo || maxAmmo !== hudCache.maxAmmo || ammoKind !== hudCache.ammoStyle) {
        hudCache.ammo = ammo;
        hudCache.maxAmmo = maxAmmo;
        hudCache.ammoStyle = ammoKind;

        const visiblePips = Math.min(MAX_AMMO_PIPS, maxAmmo);
        for (let i = 0; i < MAX_AMMO_PIPS; i++) {
          const pNode = ammoPipNodes[i];
          if (i >= visiblePips) {
            pNode.className = 'ammo-pip hidden';
          } else {
            pNode.className = `ammo-pip is-${ammoKind}${i < ammo ? ' is-filled' : ' is-spent'}`;
          }
        }
        ammoNumericLabel.textContent = `${ammo}/${maxAmmo}`;
      }
    }

    // Overdrive Crate Ammo Bar
    const overAmmo = Number(snapshot.overdriveAmmo ?? snapshot.specialAmmo ?? snapshot.crateAmmo ?? 0);
    const overMax = Number(snapshot.overdriveMaxAmmo ?? snapshot.specialMaxAmmo ?? snapshot.crateMaxAmmo ?? 5);
    const overActive = Boolean(
      snapshot.overdriveActive || overAmmo > 0 || (typeof snapshot.overdriveRatio === 'number' && snapshot.overdriveRatio > 0)
    );

    if (overActive !== hudCache.overdriveVisible) {
      hudCache.overdriveVisible = overActive;
      overdriveBox.classList.toggle('hidden', !overActive);
    }

    if (overActive) {
      const oRatio =
        typeof snapshot.overdriveRatio === 'number'
          ? Math.max(0, Math.min(1, snapshot.overdriveRatio))
          : overMax > 0
            ? Math.max(0, Math.min(1, overAmmo / overMax))
            : 1;
      const oQuant = Math.round(oRatio * 500);
      if (oQuant !== hudCache.overdriveScale) {
        hudCache.overdriveScale = oQuant;
        overdriveFill.style.transform = `scaleX(${oRatio.toFixed(3)})`;
      }
      const oLabel = overAmmo > 0 ? `ОВЕРДРАЙВ: ${Math.ceil(overAmmo)}` : 'ОВЕРДРАЙВ';
      if (oLabel !== hudCache.overdriveLabel) {
        hudCache.overdriveLabel = oLabel;
        overdriveLabel.textContent = oLabel;
      }
    }

    // 8. Collected Blessing Mini-Badges above XP Bar
    const perkEntries = normalizeActivePerks(snapshot.activePerks ?? snapshot.perks);
    const perkSig = perkEntries.map(([id, st]) => `${id}:${st}`).join('|');
    if (perkSig !== hudCache.perkSig) {
      hudCache.perkSig = perkSig;
      hudPerksRow.innerHTML = '';
      if (perkEntries.length === 0) {
        hudPerksRow.classList.add('hidden');
      } else {
        hudPerksRow.classList.remove('hidden');
        for (const [perkId, stacks] of perkEntries) {
          const uDef = RUN_UPGRADES.find((u) => u.id === perkId);
          const chip = el('div', 'hud-perk-chip');
          chip.dataset.theme = uDef?.theme || 'violet';
          chip.title = uDef ? `${uDef.nameRu} (${uDef.statBadgeRu})` : perkId;
          chip.appendChild(createBlessingRelicSvg({ id: perkId }, 'hud-perk-svg'));
          const stTxt = el('span', 'hud-perk-stack', RANK_ROMAN[stacks] || `×${stacks}`);
          chip.appendChild(stTxt);
          hudPerksRow.appendChild(chip);
        }
      }
    }

    // 9. Soul XP Bar
    const soulLvl = Math.max(1, Number(snapshot.soulLevel ?? snapshot.xpLevel ?? snapshot.runLevel ?? snapshot.playerLevel ?? 1));
    if (soulLvl !== hudCache.soulLevel) {
      hudCache.soulLevel = soulLvl;
      soulXpTitle.textContent = `Уровень душ ${soulLvl}`;
    }

    const xp = Math.floor(Number(snapshot.xp ?? snapshot.souls ?? 0));
    const xpNext = Math.max(1, Math.floor(Number(snapshot.xpNext ?? snapshot.xpToNext ?? snapshot.maxXp ?? snapshot.nextLevelXp ?? 45)));
    const xpNumsStr = `${xp} / ${xpNext}`;
    if (xpNumsStr !== hudCache.xpNums) {
      hudCache.xpNums = xpNumsStr;
      soulXpNums.textContent = xpNumsStr;
    }

    const xpRatio =
      typeof snapshot.xpRatio === 'number'
        ? Math.max(0, Math.min(1, snapshot.xpRatio))
        : Math.max(0, Math.min(1, xp / xpNext));
    const xpQuant = Math.round(xpRatio * 1000);
    if (xpQuant !== hudCache.xpScale) {
      hudCache.xpScale = xpQuant;
      soulXpFill.style.transform = `scaleX(${xpRatio.toFixed(3)})`;
    }
  }

  // =========================================================================
  // ANIMATED TAROT / RELIC ALTAR ("БЛАГОСЛОВЕНИЕ ДУШ") & RESULT MODAL
  // =========================================================================
  function hideLevelUpModal() {
    levelUpModal.classList.add('hidden');
    activeLevelUpHandler = null;
  }

  function showLevelUpModal(_choices = [], _onSelect) {
    // "Благословение душ" combat modal permanently removed per user design.
    hideLevelUpModal();
  }

  function _unusedLegacyShowLevelUpModal(choices = [], onSelect) {
    closeSoundPopover();
    const list = (Array.isArray(choices) && choices.length > 0 ? choices : RUN_UPGRADES.slice(0, 3)).slice(0, 3);
    blessingCardsGrid.innerHTML = '';

    const soulLvl = Number(list[0]?.soulLevel || hudCache.soulLevel || 2);
    const romanSoul = RANK_ROMAN[soulLvl] || String(soulLvl);
    altarSoulLevelText.textContent = lang === 'en' ? `SOUL LEVEL ${romanSoul}` : `УРОВЕНЬ ДУШ ${romanSoul}`;
    levelUpTitle.textContent = lang === 'en' ? 'BLESSING OF SOULS' : 'БЛАГОСЛОВЕНИЕ ДУШ';
    levelUpSub.textContent =
      lang === 'en'
        ? 'Choose one sacred relic to empower this hunt (Keys 1, 2, 3)'
        : 'Выберите реликвию алтаря для текущего похода (клавиши 1, 2, 3)';

    let picked = false;
    const chooseIndex = (idx) => {
      if (picked || idx < 0 || idx >= list.length) return;
      picked = true;
      const chosen = list[idx];
      hideLevelUpModal();
      onSelect?.(chosen, idx);
    };

    activeLevelUpHandler = chooseIndex;

    list.forEach((choice, idx) => {
      const isGoldWeapon = isWeaponHighlightChoice(choice);
      const baseUpg = RUN_UPGRADES.find((u) => u.id === choice?.id);
      const theme = isGoldWeapon ? 'gold' : choice?.theme || baseUpg?.theme || 'violet';

      const nextRank = Math.max(1, Number(choice?.nextRank ?? choice?.rank ?? 1));
      const maxStacks = Number(choice?.maxStacks ?? baseUpg?.maxStacks ?? 3);
      const rankRoman = RANK_ROMAN[nextRank] || String(nextRank);
      const maxRoman = RANK_ROMAN[maxStacks] || String(maxStacks);

      const categoryStr = isGoldWeapon
        ? choice?.categoryRu || 'МАСТЕРСТВО ОРУЖИЯ'
        : choice?.categoryRu || baseUpg?.categoryRu || 'РЕЛИКВИЯ ДУШ';

      const rankStr = isGoldWeapon ? `РАНГ ${rankRoman}` : `РАНГ ${rankRoman}/${maxRoman}`;

      const statBadgeStr =
        choice?.statBadgeRu ||
        baseUpg?.statBadgeRu ||
        (isGoldWeapon ? '+20% УРОН • +8% ОБЛАСТЬ' : 'УСИЛЕНИЕ ОХОТНИКА');

      const card = el('button', `blessing-card tarot-relic-card${isGoldWeapon ? ' is-weapon-gold' : ''}`);
      card.type = 'button';
      card.dataset.theme = theme;
      card.style.setProperty('--card-idx', String(idx));

      for (const cPos of ['tl', 'tr', 'bl', 'br']) {
        card.appendChild(el('span', `tarot-corner ${cPos}`));
      }

      const foilShimmer = el('span', 'blessing-foil-shimmer');
      const topRibbon = el('div', 'blessing-top-ribbon');
      const catSpan = el('span', 'blessing-cat-label', categoryStr);
      const rankSpan = el('span', 'blessing-rank-label', rankStr);
      topRibbon.append(catSpan, rankSpan);

      const emblemStage = el('div', 'blessing-emblem-stage');
      emblemStage.appendChild(createRuneHaloSvg());
      // Subtle craggy dark-stone altar rocks flanking the base of the relic art (matches reference)
      emblemStage.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 120 34" class="blessing-altar-rocks" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="4,32 14,17 26,23 32,32" fill="rgba(18,14,28,0.88)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
            <polygon points="88,32 96,19 108,15 116,32" fill="rgba(18,14,28,0.88)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
            <ellipse cx="60" cy="31" rx="44" ry="3" fill="rgba(0,0,0,0.48)"/>
          </svg>`
        )
      );
      emblemStage.appendChild(createBlessingRelicSvg(choice, 'blessing-relic-svg'));

      const nameEl = el('h3', 'blessing-name', choice?.nameRu || baseUpg?.nameRu || 'Дар Душ');

      // Ornate pointed hexagonal stat plaque with left/right diamond rivets (matches reference!)
      const statPill = el('div', 'blessing-stat-pill');
      statPill.append(
        el('span', 'stat-plaque-rivet left', '◆'),
        el('span', 'stat-plaque-text', statBadgeStr),
        el('span', 'stat-plaque-rivet right', '◆')
      );

      const descEl = el('p', 'blessing-desc', choice?.descRu || baseUpg?.descRu || '');

      const ctaBar = el(
        'div',
        'blessing-cta-bar',
        lang === 'en' ? `CLAIM RELIC [${idx + 1}]` : `ВЫБРАТЬ ДАР [${idx + 1}]`
      );

      card.append(foilShimmer, topRibbon, emblemStage, nameEl, statPill, descEl, ctaBar);
      card.addEventListener('click', () => chooseIndex(idx));
      blessingCardsGrid.appendChild(card);
    });

    levelUpModal.classList.remove('hidden');
  }

  function showWeaponUnlockBanner(weaponDefOrId) {
    const wDef = typeof weaponDefOrId === 'string' ? WEAPONS[weaponDefOrId] : weaponDefOrId;
    const wName = wDef?.nameRu || wDef?.name || 'Новое оружие';

    weaponUnlockBanner.innerHTML = '';
    if (wDef?.id) {
      weaponUnlockBanner.appendChild(createWeaponSvg(wDef.id, 'banner-wpn-svg'));
    }
    weaponUnlockBanner.appendChild(
      el('span', '', `НОВОЕ ОРУЖИЕ ОТКРЫТО: ${wName}! Доступно в Арсенале!`)
    );
    weaponUnlockBanner.classList.remove('hidden');

    if (weaponBannerTimer) clearTimeout(weaponBannerTimer);
    weaponBannerTimer = setTimeout(() => {
      weaponUnlockBanner.classList.add('hidden');
      weaponBannerTimer = null;
    }, 4000);
  }

  function showToast(message, durationMs = 2600) {
    if (!message) return;
    generalToast.textContent = message;
    generalToast.classList.remove('hidden');
    if (generalToastTimer) clearTimeout(generalToastTimer);
    generalToastTimer = setTimeout(() => {
      generalToast.classList.add('hidden');
      generalToastTimer = null;
    }, durationMs);
  }

  function hideResultModal() {
    resultModal.classList.add('hidden');
  }

  function showResultModal(
    { victory = false, level = 1, goldEarned = 0, kills = 0, unlockedWeapon = null, canRevive = false, stars = 0, elapsedSec = 0 } = {},
    actions = {}
  ) {
    closeSoundPopover();
    resultPanel.classList.toggle('is-victory', Boolean(victory));
    resultPanel.classList.toggle('is-defeat', !victory);

    const lvlDef = LEVELS[(Number(level) || 1) - 1];
    resultCrest.innerHTML = '';
    if (victory) {
      // Ornate Golden Crown + Laurel Wreath + Crimson Ribbon + Sunburst Crest (matches media_1794831700387_b993e413.jpg)
      resultCrest.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 140 76" width="132" height="70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="vicSunGlow" cx="50%" cy="52%" r="50%">
                <stop offset="0%" stop-color="#fef08a" stop-opacity="0.72"/>
                <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.28"/>
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <circle cx="70" cy="40" r="36" fill="url(#vicSunGlow)"/>
            <!-- Crimson Heraldic Ribbons -->
            <path d="M18 56 L38 44 L48 60 L26 64 L24 58 Z" fill="#991b1b" stroke="#fca5a5" stroke-width="0.9"/>
            <path d="M122 56 L102 44 L92 60 L114 64 L116 58 Z" fill="#991b1b" stroke="#fca5a5" stroke-width="0.9"/>
            <!-- Golden Laurel Branches -->
            <path d="M44 58 C33 50 30 34 38 22 C37 32 41 44 50 52 Z" fill="#eab308" stroke="#fef08a" stroke-width="1"/>
            <path d="M96 58 C107 50 110 34 102 22 C103 32 99 44 90 52 Z" fill="#eab308" stroke="#fef08a" stroke-width="1"/>
            <!-- Beveled Medallion Shield -->
            <circle cx="70" cy="41" r="24" fill="#271838" stroke="#facc15" stroke-width="2.6"/>
            <circle cx="70" cy="41" r="19.5" fill="rgba(234,179,8,0.16)" stroke="#fde047" stroke-width="1"/>
            <!-- Royal Crown -->
            <polygon points="54,48 57,30 64,37 70,24 76,37 83,30 86,48" fill="#facc15" stroke="#fffbeb" stroke-width="1.5" stroke-linejoin="round"/>
            <rect x="55" y="50" width="30" height="4.2" rx="1.6" fill="#eab308"/>
          </svg>`
        )
      );
    } else {
      resultCrest.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 120 72" width="114" height="66" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="38" r="26" fill="#28111c" stroke="#ef4444" stroke-width="2.4"/>
            <path d="M60 19 C50.5 19 45 25.5 45 33.5 C45 38.8 47.8 42.5 51.5 44.5 V50 H68.5 V44.5 C72.2 42.5 75 38.8 75 33.5 C75 25.5 69.5 19 60 19 Z" fill="#e2e8f0" stroke="#fca5a5" stroke-width="1.4"/>
            <circle cx="54.5" cy="34" r="3.4" fill="#991b1b"/>
            <circle cx="65.5" cy="34" r="3.4" fill="#991b1b"/>
          </svg>`
        )
      );
    }

    const earnedStarsCount = victory ? Math.max(1, Math.min(3, Number(stars) || 1)) : 0;
    const starDisplay = victory ? ` • ${'★'.repeat(earnedStarsCount)}${'☆'.repeat(3 - earnedStarsCount)}` : '';
    resultTitle.textContent = victory ? `Победа! Глава очищена!${starDisplay}` : 'Охотник пал в бою';
    resultLevelName.textContent = (lvlDef ? lvlDef.nameRu : `Глава ${level}`) + (elapsedSec > 0 ? ` • ${elapsedSec}с` : '');

    let displayedGold = Math.max(0, Math.floor(Number(goldEarned) || 0));
    resGoldVal.textContent = `+${displayedGold}`;
    resKillsVal.textContent = `${Math.max(0, Math.floor(Number(kills) || 0))}`;

    const wDef = typeof unlockedWeapon === 'string' ? WEAPONS[unlockedWeapon] : unlockedWeapon;
    if (wDef && (wDef.nameRu || wDef.name)) {
      resultUnlockedBox.innerHTML = '';
      if (wDef.id) {
        resultUnlockedBox.appendChild(createWeaponSvg(wDef.id, 'result-wpn-svg'));
      }
      resultUnlockedBox.appendChild(
        el('span', '', `Открыто оружие: ${wDef.nameRu || wDef.name} (в Арсенале!)`)
      );
      resultUnlockedBox.classList.remove('hidden');
    } else {
      resultUnlockedBox.classList.add('hidden');
    }

    resultActionsCol.innerHTML = '';

    if (!victory) {
      if (canRevive) {
        const reviveBtn = el('button', 'result-btn btn-revive', '🎬 Воскреснуть с полным HP (Видео)');
        reviveBtn.type = 'button';
        reviveBtn.addEventListener('click', async () => {
          reviveBtn.disabled = true;
          const ok = await (actions.onRevive || callbacks.onRevive)?.();
          if (ok !== false) {
            hideResultModal();
          } else {
            reviveBtn.disabled = false;
          }
        });
        resultActionsCol.appendChild(reviveBtn);
      }

      const arsenalBtn = el('button', 'result-btn btn-arsenal-primary', '⚔️ В Лагерь • Арсенал');
      arsenalBtn.type = 'button';
      arsenalBtn.addEventListener('click', () => {
        hideResultModal();
        setActiveTab('arsenal');
        (actions.onArsenal || actions.onGoToArsenal || actions.onHub || callbacks.onExitToHub)?.();
      });
      resultActionsCol.appendChild(arsenalBtn);

      const retryBtn = el('button', 'result-btn btn-retry', '↻ Повторить главу');
      retryBtn.type = 'button';
      retryBtn.addEventListener('click', () => {
        hideResultModal();
        (actions.onRetry || actions.onRestart || callbacks.onRetry)?.();
      });
      resultActionsCol.appendChild(retryBtn);
    } else {
      if (displayedGold > 0) {
        const doubleBtn = el('button', 'result-btn btn-double-gold', '🎬 Удвоить добычу ×2 (Видео)');
        doubleBtn.type = 'button';
        doubleBtn.addEventListener('click', async () => {
          doubleBtn.disabled = true;
          const res = await (actions.onDoubleGold || callbacks.onDoubleGold)?.();
          if (res !== false) {
            displayedGold *= 2;
            resGoldVal.textContent = `+${displayedGold} (×2!)`;
            doubleBtn.textContent = '✨ Добыча удвоена!';
          } else {
            doubleBtn.disabled = false;
          }
        });
        resultActionsCol.appendChild(doubleBtn);
      }

      const nextArsenalBtn = el('button', 'result-btn btn-arsenal-primary', '🗺️ На карту похода • Далее');
      nextArsenalBtn.type = 'button';
      nextArsenalBtn.addEventListener('click', () => {
        hideResultModal();
        setActiveTab('campaign_forest');
        (
          actions.onNext ||
          actions.onNextLevel ||
          actions.onArsenal ||
          actions.onGoToArsenal ||
          actions.onHub ||
          callbacks.onExitToHub
        )?.();
      });
      resultActionsCol.appendChild(nextArsenalBtn);

      if (actions.onRetry || actions.onRestart) {
        const replayBtn = el('button', 'result-btn btn-retry', '↻ Повторить главу');
        replayBtn.type = 'button';
        replayBtn.addEventListener('click', () => {
          hideResultModal();
          (actions.onRetry || actions.onRestart)?.();
        });
        resultActionsCol.appendChild(replayBtn);
      }
    }

    resultModal.classList.remove('hidden');
  }

  lockedRosterSlot.addEventListener('click', () => {
    showToast('🔒 Тайный охотник пробудится в следующем обновлении!', 2200);
  });

  // Smooth Touch-Drag Scroll Adapter when CSS 90° forced-landscape rotation is active on portrait phones
  (function enableRotatedTouchScroll() {
    let scrollEl = null;
    let lastGameY = 0;
    root.addEventListener(
      'touchstart',
      (e) => {
        const vp = window.__getGameViewportSize?.();
        if (!vp?.forcedRotate || e.touches.length !== 1) {
          scrollEl = null;
          return;
        }
        let node = e.target;
        scrollEl = null;
        while (node && node !== root) {
          if (node.scrollHeight > node.clientHeight + 4) {
            const oy = getComputedStyle(node).overflowY;
            if (oy === 'auto' || oy === 'scroll') {
              scrollEl = node;
              break;
            }
          }
          node = node.parentElement;
        }
        if (scrollEl) {
          const t = e.touches[0];
          lastGameY = window.__toGameCoords(t.clientX, t.clientY).y;
        }
      },
      { passive: true }
    );
    root.addEventListener(
      'touchmove',
      (e) => {
        if (!scrollEl || e.touches.length !== 1) return;
        const t = e.touches[0];
        const gy = window.__toGameCoords(t.clientX, t.clientY).y;
        const dy = lastGameY - gy;
        lastGameY = gy;
        scrollEl.scrollTop += dy;
      },
      { passive: true }
    );
  })();

  // Initialize labels & default tab
  syncStaticLabels();
  setActiveTab('home');

  return {
    setCallbacks(nextCallbacks = {}) {
      callbacks = { ...callbacks, ...nextCallbacks };
    },

    isHeroStageVisible() {
      return (
        !hubScreen.classList.contains('hidden') &&
        (activeHubTab === 'home' || activeHubTab === 'heroes' || activeHubTab === 'arsenal') &&
        mageStarterModal.classList.contains('hidden') &&
        resetConfirmModal.classList.contains('hidden')
      );
    },

    setLang(nextLang) {
      lang = nextLang === 'en' ? 'en' : 'ru';
      syncStaticLabels();
      if (lastHubState) renderHub(lastHubState);
    },

    setHubTab: setActiveTab,

    setSelectedLevel(lvl) {
      const n = Math.max(1, Math.min(LEVELS.length, Number(lvl) || 1));
      localSelectedLevel = n;
      viewedCampaignLevel = n;
    },

    setActiveTab,

    renderHub,

    showHub(visible = true) {
      closeSoundPopover();
      hubScreen.classList.toggle('hidden', !visible);
      if (visible) {
        releaseLeftStick();
      }
    },

    updateHud,

    showHud(visible = true) {
      closeSoundPopover();
      hudScreen.classList.toggle('hidden', !visible);
      if (!visible) {
        releaseLeftStick();
      } else if (isTouchCapable) {
        touchLayer.classList.remove('hidden');
        ensureAutoAimForTouch();
      }
    },

    setMutedState(isMuted) {
      muted = Boolean(isMuted);
      syncMuteButtons();
    },

    setVolumeState(vol0to1) {
      const v = Number(vol0to1);
      if (Number.isFinite(v)) {
        volume = Math.max(0, Math.min(1, v));
        if (volume > 0.01) lastNonZeroVolume = volume;
        syncMuteButtons();
      }
    },

    setMusicVolumeState(vol0to1) {
      const v = Number(vol0to1);
      if (Number.isFinite(v)) {
        musicVolume = Math.max(0, Math.min(1, v));
        syncMuteButtons();
      }
    },

    setAutoAimState(isEnabled) {
      autoAim = Boolean(isEnabled);
      syncAutoAimButton();
    },

    setAttackEnabledState(isEnabled) {
      attackEnabled = Boolean(isEnabled);
      syncAttackToggleButton();
    },

    spawnFloatingText,

    getTouchInput() {
      return touchState;
    },

    showLevelUpModal,
    hideLevelUpModal,

    showWeaponUnlockBanner,
    playPurchaseCelebration(weaponId) {
      const wDef = WEAPONS[weaponId];
      if (wDef) {
        showWeaponUnlockBanner(wDef);
      }
      if (arsenalPlaqueCard) {
        arsenalPlaqueCard.classList.remove('is-purchased-flash');
        void arsenalPlaqueCard.offsetWidth;
        arsenalPlaqueCard.classList.add('is-purchased-flash');
      }
      if (treasuryGoldPill) {
        treasuryGoldPill.classList.remove('is-spent-flash');
        void treasuryGoldPill.offsetWidth;
        treasuryGoldPill.classList.add('is-spent-flash');
      }
    },
    showToast,

    showResultModal,
    hideResultModal,

    showPauseModal,
    hidePauseModal,
    isPauseModalOpen() {
      return !pauseModal.classList.contains('hidden');
    },

    openMageStarterModal,
    resetLocalSelection,

    hideAllModals() {
      closeSoundPopover();
      hideLevelUpModal();
      hideResultModal();
      hidePauseModal();
      hideMageStarterModal();
      hideResetConfirmModal();
    }
  };
}
