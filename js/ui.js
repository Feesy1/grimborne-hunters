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
  RUN_UPGRADES
} from './config.js?v=20261116f';

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

    case 'cleaver': // Секач Инквизитора — Heavy Crimson Executioner Axe-Blade
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fecaca"/>
          <stop offset="38%" stop-color="#ef4444"/>
          <stop offset="100%" stop-color="#450a0a"/>
        </linearGradient>
        <linearGradient id="${u}_s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#475569"/>
        </linearGradient>`;
      body = `
        <circle cx="33" cy="31" r="25" fill="rgba(239,68,68,0.16)"/>
        <path d="M48 9 L56 19 C54 31 44 41 31 45 L22 36 L38 15 L43 16 Z" fill="url(#${u}_b)" stroke="#fca5a5" stroke-width="1.2"/>
        <path d="M46 13 L52 20 C50 29 42 37 32 41" fill="none" stroke="#fef2f2" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="41" cy="24" r="2.3" fill="#0f172a" stroke="#fca5a5" stroke-width="0.9"/>
        <path d="M27 33 L11 49 L15 53 L31 37 Z" fill="url(#${u}_s)" stroke="#cbd5e1" stroke-width="0.9"/>
        <path d="M19 35 L29 45" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
        <circle cx="11" cy="52" r="3" fill="#fbbf24"/>`;
      break;

    case 'flail': // Клинок Пепельной Бури — Legendary Flame-Serrated Greatsword
      defs = `
        <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fef9c3"/>
          <stop offset="45%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#991b1b"/>
        </linearGradient>`;
      body = `
        <circle cx="32" cy="32" r="26" fill="rgba(245,158,11,0.18)"/>
        <path d="M55 9 L51 22 L45 23 L43 29 L36 31 L27 44 L20 44 L20 37 L33 28 L35 21 L41 19 L42 13 Z" fill="url(#${u}_b)" stroke="#fef08a" stroke-width="1.2"/>
        <line x1="50" y1="14" x2="24" y2="40" stroke="#fffbeb" stroke-width="1.7" stroke-linecap="round"/>
        <path d="M12 31 L23 41 L33 52 L29 54 L20 44 L10 35 Z" fill="#f59e0b" stroke="#fef08a" stroke-width="1"/>
        <path d="M19 45 L10 54" stroke="#78350f" stroke-width="4" stroke-linecap="round"/>
        <circle cx="9.5" cy="54.5" r="3.2" fill="#fde047"/>`;
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
      case 'wpn_power': // Руна Закалки — Molten Forged Blade & Anvil Sparks
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#78350f" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef3c7"/>
            <stop offset="52%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#9a3412"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polygon points="44,13 52,25 52,55 36,55 36,25" fill="url(#${u}_b)" stroke="#fef08a" stroke-width="1.5"/>
          <line x1="44" y1="19" x2="44" y2="52" stroke="#fffbeb" stroke-width="2" stroke-linecap="round"/>
          <rect x="26" y="54" width="36" height="6" rx="2.5" fill="#d97706" stroke="#fef08a" stroke-width="1.2"/>
          <rect x="40" y="60" width="8" height="12" rx="1.5" fill="#78350f" stroke="#fbbf24" stroke-width="1"/>
          <circle cx="44" cy="74" r="3.6" fill="#fde047"/>
          <circle cx="24" cy="30" r="2.2" fill="#fde047"/><circle cx="64" cy="28" r="2.4" fill="#fb923c"/><circle cx="61" cy="42" r="1.8" fill="#fef08a"/>`;
        break;

      case 'wpn_haste': // Хладный Темп — Quicksilver Twin Blades & Lightning Arcs
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#083344" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ecfeff"/>
            <stop offset="55%" stop-color="#22d3ee"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="44" r="29" stroke="#67e8f9" stroke-opacity="0.45" stroke-width="1.3" stroke-dasharray="6 4"/>
          <polygon points="48,12 31,45 43,45 38,76 59,39 46,39" fill="url(#${u}_c)" stroke="#cffafe" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M18 34 C24 22 36 16 48 16 M70 54 C64 66 52 72 40 72" stroke="#a5f3fc" stroke-width="2" stroke-linecap="round"/>`;
        break;

      case 'ammo_pouch': // Патронташ Охотника — Trio of Brass 12-Gauge Buckshot Shells
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#facc15" stop-opacity="0.44"/>
            <stop offset="100%" stop-color="#713f12" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_sh" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#dc2626"/>
            <stop offset="48%" stop-color="#f87171"/>
            <stop offset="100%" stop-color="#7f1d1d"/>
          </linearGradient>
          <linearGradient id="${u}_br" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ca8a04"/>
            <stop offset="50%" stop-color="#fef08a"/>
            <stop offset="100%" stop-color="#854d0e"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <g transform="rotate(-12 26 46)">
            <rect x="20" y="26" width="12" height="25" rx="2" fill="url(#${u}_sh)" stroke="#fca5a5" stroke-width="1"/>
            <rect x="19.5" y="50" width="13" height="12" rx="1.5" fill="url(#${u}_br)" stroke="#fef08a" stroke-width="1"/>
          </g>
          <g transform="rotate(12 62 46)">
            <rect x="56" y="26" width="12" height="25" rx="2" fill="url(#${u}_sh)" stroke="#fca5a5" stroke-width="1"/>
            <rect x="55.5" y="50" width="13" height="12" rx="1.5" fill="url(#${u}_br)" stroke="#fef08a" stroke-width="1"/>
          </g>
          <rect x="36.5" y="19" width="15" height="30" rx="2.4" fill="url(#${u}_sh)" stroke="#fecaca" stroke-width="1.3"/>
          <rect x="35.5" y="48" width="17" height="15" rx="2" fill="url(#${u}_br)" stroke="#fffbeb" stroke-width="1.3"/>
          <line x1="36.5" y1="24" x2="51.5" y2="24" stroke="#fde047" stroke-width="1.4"/>`;
        break;

      case 'crit_fang': // Метка Палача — Executioner Crossed Crimson Daggers & Reticle
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.48"/>
            <stop offset="100%" stop-color="#450a0a" stop-opacity="0"/>
          </radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="44" r="24" stroke="#f87171" stroke-width="1.4" stroke-dasharray="5 4"/>
          <polygon points="18,16 30,22 66,58 62,62 26,26" fill="#fecaca" stroke="#ef4444" stroke-width="1.2"/>
          <polygon points="70,16 58,22 22,58 26,62 62,26" fill="#fecaca" stroke="#ef4444" stroke-width="1.2"/>
          <line x1="58" y1="54" x2="68" y2="64" stroke="#fbbf24" stroke-width="3.2" stroke-linecap="round"/>
          <line x1="30" y1="54" x2="20" y2="64" stroke="#fbbf24" stroke-width="3.2" stroke-linecap="round"/>
          <polygon points="44,32 49,44 44,56 39,44" fill="#ef4444" stroke="#fff1f2" stroke-width="1.3"/>`;
        break;

      case 'frost_touch': // Морозный Пепел — Glacial Six-Pointed Frost Crystal
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#bae6fd" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0"/>
          </radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polygon points="44,12 51,32 72,28 56,44 72,60 51,56 44,76 37,56 16,60 32,44 16,28 37,32" fill="rgba(125,211,252,0.32)" stroke="#e0f2fe" stroke-width="1.5" stroke-linejoin="round"/>
          <polygon points="44,24 52,44 44,64 36,44" fill="#7dd3fc" stroke="#ffffff" stroke-width="1.3"/>
          <circle cx="44" cy="44" r="4.5" fill="#ffffff"/>`;
        break;

      case 'burn_cinder': // Тлеющее Клеймо — Pyromancer Flame Brand
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stop-color="#fb923c" stop-opacity="0.52"/>
            <stop offset="100%" stop-color="#7c2d12" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_fl" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#be123c"/>
            <stop offset="52%" stop-color="#f97316"/>
            <stop offset="100%" stop-color="#fef08a"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 12 C54 24 67 34 65 51 C63 65 53 74 44 74 C35 74 23 65 23 50 C23 38 31 30 35 23 C35 31 40 33 44 12 Z" fill="url(#${u}_fl)" stroke="#fef08a" stroke-width="1.4"/>
          <path d="M44 33 C50 41 54 47 52 56 C50 63 46 67 44 67 C41 67 36 62 36 55 C36 48 40 43 44 33 Z" fill="#fffbeb"/>
          <circle cx="29" cy="24" r="2.2" fill="#fde047"/><circle cx="60" cy="23" r="2" fill="#fb923c"/>`;
        break;

      case 'chain_soul': // Цепная Искра Душ — Astral Forking Lightning Nodes
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#c084fc" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#3b0764" stop-opacity="0"/>
          </radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polyline points="22,64 35,44 29,39 46,20 53,38 67,26" fill="none" stroke="#f3e8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="35,44 52,52 64,66" fill="none" stroke="#d8b4fe" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="22" cy="64" r="5.5" fill="#a855f7" stroke="#faf5ff" stroke-width="1.5"/>
          <circle cx="46" cy="20" r="6" fill="#c084fc" stroke="#ffffff" stroke-width="1.6"/>
          <circle cx="64" cy="66" r="5" fill="#9333ea" stroke="#f3e8ff" stroke-width="1.4"/>
          <circle cx="67" cy="26" r="4.5" fill="#e879f9" stroke="#ffffff" stroke-width="1.3"/>`;
        break;

      case 'soul_nova': // Кольцо Возмездия — Concentric Astral Shockwave Ring
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#e879f9" stop-opacity="0.52"/>
            <stop offset="100%" stop-color="#2e1065" stop-opacity="0"/>
          </radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="44" r="30" stroke="#e9d5ff" stroke-width="2" stroke-dasharray="8 4"/>
          <circle cx="44" cy="44" r="21" stroke="#c084fc" stroke-width="2.4"/>
          <polygon points="44,15 49,39 73,44 49,49 44,73 39,49 15,44 39,39" fill="#d8b4fe" stroke="#ffffff" stroke-width="1.2"/>
          <circle cx="44" cy="44" r="6.5" fill="#ffffff"/>`;
        break;

      case 'vampiric': // Жатва Крови — Ornate Gothic Blood Chalice & Levitating Ruby Drop
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.48"/>
            <stop offset="100%" stop-color="#450a0a" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="100%" stop-color="#b45309"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 13 C44 13 53 24 53 29.5 C53 34.5 49 38.5 44 38.5 C39 38.5 35 34.5 35 29.5 C35 24 44 13 44 13 Z" fill="#dc2626" stroke="#fecaca" stroke-width="1.4"/>
          <path d="M26 40 H62 C61 53 53 59 44 59 C35 59 27 53 26 40 Z" fill="url(#${u}_g)" stroke="#fef08a" stroke-width="1.3"/>
          <path d="M29 42 H59" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
          <rect x="41" y="59" width="6" height="11" fill="#d97706"/>
          <path d="M31 72 H57" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round"/>`;
        break;

      case 'iron_ward': // Костяной Доспех — Horned Gothic Bone & Steel Tower Shield
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#cbd5e1" stop-opacity="0.42"/>
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="${u}_st" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="52%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 14 L67 23 V44 C67 59 57 69 44 75 C31 69 21 59 21 44 V23 L44 14 Z" fill="url(#${u}_st)" stroke="#f1f5f9" stroke-width="1.8"/>
          <path d="M44 20 L61 27 V43 C61 55 53 63 44 68 C35 63 27 55 27 43 V27 L44 20 Z" fill="none" stroke="#fde047" stroke-width="1.3"/>
          <path d="M44 24 V64 M29 41 H59" stroke="#e2e8f0" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="44" cy="41" r="5.5" fill="#fbbf24" stroke="#ffffff" stroke-width="1.2"/>`;
        break;

      case 'swift_boots': // Поступь Призрака — Winged Emerald Spectral Greaves
        defs = `
          <radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#34d399" stop-opacity="0.46"/>
            <stop offset="100%" stop-color="#064e3b" stop-opacity="0"/>
          </radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M35 22 H50 L47 50 L64 56 C67 57 68 62 65 65 H29 L35 22 Z" fill="#10b981" stroke="#d1fae5" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M29 65 H66" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
          <path d="M34 33 C22 30 16 22 18 16 C24 20 30 22 36 25" fill="#6ee7b7" stroke="#ecfdf5" stroke-width="1.2"/>
          <path d="M32 43 C21 42 15 36 16 30 C22 33 28 35 34 37" fill="#34d399" stroke="#ecfdf5" stroke-width="1.2"/>`;
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
  let volume = 0.85;
  let lastNonZeroVolume = 0.85;
  let autoAim = true;
  let activeHubTab = 'heroes'; // 'heroes' | 'campaign' | 'arsenal' | 'shop'
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
  const sealSlotNodes = [0, 1, 2].map(() => {
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

  const hudHomeBtn = el('button', 'hud-btn icon-btn');
  hudHomeBtn.type = 'button';
  hudHomeBtn.title = 'Выйти в лагерь';
  hudHomeBtn.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9.5 L10 3.5 L17 9.5 V16.5 H12.2 V11.8 H7.8 V16.5 H3 V9.5 Z" fill="#f5efe2"/></svg>`
    )
  );

  hudActionsRow.append(autoAimBtn, touchPreviewBtn, hudMuteBtn, hudHomeBtn);
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

  hudBottomDock.append(hudPerksRow, hudWeaponRow, soulXpWrap);
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
  // 5. AAA DARK-FANTASY 4-TAB HUB (ГЕРОИ • ПОХОД • АРСЕНАЛ • МАСТЕРСКАЯ)
  // =========================================================================
  const hubScreen = el('div', 'hub-screen');
  const hubShell = el('div', 'hub-shell');

  // --- Top Navigation Header Bar ---
  const hubHeader = el('header', 'hub-topbar');
  const hubBrand = el('div', 'hub-brand');
  const hubCrest = el('div', 'hub-crest');
  hubCrest.appendChild(createStatRuneSvg('might'));
  const hubTitle = el('h1', 'hub-title', 'ОХОТНИКИ МРАКА');
  hubBrand.append(hubCrest, hubTitle);

  const hubNavTabs = el('nav', 'hub-nav-tabs');
  hubNavTabs.setAttribute('aria-label', 'Навигация лагеря');

  const tabHeroesBtn = el('button', 'hub-tab-btn is-active');
  tabHeroesBtn.type = 'button';
  const tabHeroesLabel = el('span', 'hub-tab-label', '⚔️ Герои');
  tabHeroesBtn.appendChild(tabHeroesLabel);

  const tabCampaignBtn = el('button', 'hub-tab-btn');
  tabCampaignBtn.type = 'button';
  const tabCampaignLabel = el('span', 'hub-tab-label', '🗺️ Поход');
  tabCampaignBtn.appendChild(tabCampaignLabel);

  const tabArsenalBtn = el('button', 'hub-tab-btn');
  tabArsenalBtn.type = 'button';
  const tabArsenalLabel = el('span', 'hub-tab-label', '🗡️ Арсенал');
  const tabArsenalDot = el('span', 'hub-tab-dot hidden');
  tabArsenalBtn.append(tabArsenalLabel, tabArsenalDot);

  const tabShopBtn = el('button', 'hub-tab-btn');
  tabShopBtn.type = 'button';
  const tabShopLabel = el('span', 'hub-tab-label', '🧪 Мастерская');
  const tabShopDot = el('span', 'hub-tab-dot hidden');
  tabShopBtn.append(tabShopLabel, tabShopDot);

  hubNavTabs.append(tabHeroesBtn, tabCampaignBtn, tabArsenalBtn, tabShopBtn);

  const hubTreasury = el('div', 'hub-treasury');
  const treasuryGoldPill = el('div', 'treasury-gold-pill');
  const treasuryCoinSvg = makeSvgNode(
    `<svg viewBox="0 0 18 18" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="7.2" fill="#facc15" stroke="#fef08a" stroke-width="1.3"/><circle cx="9" cy="9" r="4.4" stroke="#92400e" stroke-width="1"/></svg>`
  );
  const hubGoldAmount = el('span', 'treasury-gold-val', '60');
  treasuryGoldPill.append(treasuryCoinSvg, hubGoldAmount);

  const hubResetBtn = el('button', 'hud-btn reset-progress-btn', '🔄 Сброс');
  hubResetBtn.type = 'button';
  hubResetBtn.title = 'Сбросить весь прогресс до нуля';

  const hubMuteBtn = el('button', 'hud-btn icon-btn sound-trigger-btn', '🔊');
  hubMuteBtn.type = 'button';
  hubMuteBtn.title = 'Настройки звука';
  hubTreasury.append(treasuryGoldPill, hubResetBtn, hubMuteBtn);

  hubHeader.append(hubBrand, hubNavTabs, hubTreasury);

  // --- Hub Body Container ---
  const hubBody = el('div', 'hub-body');

  // =========================================================================
  // TAB 1: ⚔️ ГЕРОИ (3D Hero Stage + Portrait Info Card + Mini-Banner Launch Dock)
  // =========================================================================
  const heroesPanel = el('section', 'hub-panel hub-panel-heroes');

  const heroStageArea = el('div', 'hero-stage-area');
  const heroStageControls = el('div', 'hero-stage-controls');

  const stagePrevBtn = el('button', 'stage-carousel-btn prev', '‹');
  stagePrevBtn.type = 'button';
  stagePrevBtn.setAttribute('aria-label', 'Предыдущий класс');

  const stageCenterSpacer = el('div', 'stage-center-window');

  const stageNextBtn = el('button', 'stage-carousel-btn next', '›');
  stageNextBtn.type = 'button';
  stageNextBtn.setAttribute('aria-label', 'Следующий класс');

  heroStageControls.append(stagePrevBtn, stageCenterSpacer, stageNextBtn);

  // 3 Class Portrait Medallion Dots below the 3D Pedestal
  const stageEmblemDots = el('div', 'stage-emblem-dots');
  const emblemDotButtons = {};
  for (const cid of CLASS_ORDER) {
    const cDef = CLASSES[cid];
    const dotBtn = el('button', 'stage-emblem-dot');
    dotBtn.type = 'button';
    dotBtn.dataset.classId = cid;
    const dotImg = document.createElement('img');
    dotImg.src = cDef.portrait;
    dotImg.alt = cDef.nameRu;
    dotImg.className = 'stage-dot-portrait';
    dotBtn.appendChild(dotImg);
    stageEmblemDots.appendChild(dotBtn);
    emblemDotButtons[cid] = dotBtn;
  }

  heroStageArea.append(heroStageControls, stageEmblemDots);

  // Lower Docks: Bottom-Left Hero Info Card + Bottom-Right Launch Dock
  const heroShowcaseDocks = el('div', 'hero-showcase-docks');

  // --- Bottom-Left: Ornate Gothic Hero Info Card ---
  const heroInfoCard = el('div', 'hero-info-card');
  const heroCardHeader = el('div', 'hero-card-header');

  // Real HD Character Portrait in Ornate Golden-Gothic Beveled Frame + Animated Corner Aura
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
  const heroRolePill = el('span', 'hero-role-pill', CLASSES.warrior.roleRu);
  heroTitleWrap.append(heroClassName, heroRolePill);
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

  // Equipped Weapon Card with Custom Vector Weapon Silhouette
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

  // --- Bottom-Right: Sleek Launch Dock with Selected Chapter Mini-Banner Card ---
  const heroLaunchDock = el('div', 'hero-launch-dock');

  const chapterMiniCard = el('div', 'chapter-mini-card');
  const chapterMiniThumbWrap = el('div', 'chapter-mini-thumb-wrap');
  const chapterMiniImg = document.createElement('img');
  chapterMiniImg.className = 'chapter-mini-img';
  chapterMiniImg.src = LEVELS[0].bannerImg;
  chapterMiniImg.alt = LEVELS[0].nameRu;
  const chapterMiniVignette = el('div', 'chapter-mini-vignette');
  chapterMiniThumbWrap.append(chapterMiniImg, chapterMiniVignette);

  const chapterMiniContent = el('div', 'chapter-mini-content');
  const chapterMiniTop = el('div', 'chapter-mini-top');
  const chapterMiniActBadge = el('span', 'chapter-mini-act-badge', 'Акт I');
  const chapterMiniFeature = el('span', 'chapter-mini-feature', '⏱️ 01:04');
  chapterMiniTop.append(chapterMiniActBadge, chapterMiniFeature);

  const chapterMiniTitle = el('div', 'chapter-mini-title', LEVELS[0].nameRu);

  const chapterMiniBottom = el('div', 'chapter-mini-bottom');
  const changeChapterBtn = el('button', 'btn-change-chapter', '🗺️ Сменить главу ›');
  changeChapterBtn.type = 'button';
  chapterMiniBottom.appendChild(changeChapterBtn);

  chapterMiniContent.append(chapterMiniTop, chapterMiniTitle, chapterMiniBottom);
  chapterMiniCard.append(chapterMiniThumbWrap, chapterMiniContent);

  // Per-Class Weapon Readiness Warning Badge
  const launchWeaponWarn = el('button', 'launch-weapon-warn hidden');
  launchWeaponWarn.type = 'button';

  const launchBattleBtn = el('button', 'launch-battle-btn');
  launchBattleBtn.type = 'button';
  const launchMainText = el('span', 'launch-main-text', '⚔️ В БОЙ!');
  const launchSubText = el('span', 'launch-sub-text', `${CLASSES.warrior.nameRu} • ${LEVELS[0].nameRu}`);
  launchBattleBtn.append(launchMainText, launchSubText);

  heroLaunchDock.append(chapterMiniCard, launchWeaponWarn, launchBattleBtn);
  heroShowcaseDocks.append(heroInfoCard, heroLaunchDock);
  heroesPanel.append(heroStageArea, heroShowcaseDocks);

  // =========================================================================
  // TAB 2: 🗺️ ПОХОД — DEDICATED ILLUSTRATED 25-CHAPTER CAMPAIGN SCREEN
  // =========================================================================
  const campaignPanel = el('section', 'hub-panel hub-panel-sub hub-panel-campaign hidden');
  campaignPanel.id = 'campaignPanel';
  const campaignBox = el('div', 'hub-subpanel-card campaign-subpanel');

  const campaignTopBar = el('div', 'campaign-header-row');
  const campaignTitleWrap = el('div', 'subpanel-title-group');
  const campaignHeading = el('h2', 'subpanel-title', '🗺️ Карта Похода — 25 Глав');
  const campaignProgressHint = el('p', 'subpanel-hint', 'Пройдите 5 Актов и сокрушите Владыку Вечного Пепла');
  campaignTitleWrap.append(campaignHeading, campaignProgressHint);

  const campaignBackHeroBtn = el('button', 'subpanel-back-btn', '← К герою');
  campaignBackHeroBtn.type = 'button';
  campaignTopBar.append(campaignTitleWrap, campaignBackHeroBtn);

  // 5 Act Selector Tabs
  const campaignActsBar = el('div', 'campaign-acts-bar');
  const campaignActBtns = {};
  for (const aDef of ACT_DEFS) {
    const aBtn = el('button', 'campaign-act-tab');
    aBtn.type = 'button';
    aBtn.dataset.act = String(aDef.act);
    aBtn.textContent = aDef.titleRu;
    campaignActsBar.appendChild(aBtn);
    campaignActBtns[aDef.act] = aBtn;
  }

  // Center Featured Chapter Showcase Stage (‹ Card ›)
  const campaignShowcaseStage = el('div', 'campaign-showcase-stage');
  const campaignPrevBtn = el('button', 'campaign-nav-arrow prev', '‹');
  campaignPrevBtn.type = 'button';
  campaignPrevBtn.setAttribute('aria-label', 'Предыдущая глава');

  const campaignCard = el('div', 'campaign-showcase-card');

  // Large Panoramic Illustrated Banner
  const campaignBannerWrap = el('div', 'campaign-banner-wrap');
  const campaignBannerImg = document.createElement('img');
  campaignBannerImg.className = 'campaign-banner-img';
  campaignBannerImg.src = LEVELS[0].bannerImg;
  campaignBannerImg.alt = LEVELS[0].nameRu;
  const campaignBannerVignette = el('div', 'campaign-banner-vignette');

  const campaignBannerTopLeft = el('div', 'campaign-banner-badges-left');
  const campaignActPill = el('span', 'campaign-meta-pill', 'АКТ I • ГЛАВА I');
  const campaignDurationPill = el('span', 'campaign-meta-pill', '⏱️ 01:04');
  campaignBannerTopLeft.append(campaignActPill, campaignDurationPill);

  const campaignSpecialBadge = el('div', 'campaign-special-badge hidden');

  const campaignLockOverlay = el('div', 'campaign-lock-overlay hidden');
  const campaignLockSvg = makeSvgNode(
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="21" width="28" height="21" rx="4" fill="#1e1b2e" stroke="#e5b85c" stroke-width="2.2"/>
      <path d="M16 21 V15 C16 10.5 19.6 7 24 7 C28.4 7 32 10.5 32 15 V21" stroke="#fde093" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="24" cy="30" r="3" fill="#fde093"/>
      <line x1="24" y1="32" x2="24" y2="37" stroke="#fde093" stroke-width="2.2" stroke-linecap="round"/>
    </svg>`
  );
  const campaignLockTitle = el('div', 'campaign-lock-title', 'ГЛАВА ЗАКРЫТА');
  const campaignLockSub = el('div', 'campaign-lock-sub', 'Пройдите предыдущую главу похода');
  campaignLockOverlay.append(campaignLockSvg, campaignLockTitle, campaignLockSub);

  campaignBannerWrap.append(
    campaignBannerImg,
    campaignBannerVignette,
    campaignBannerTopLeft,
    campaignSpecialBadge,
    campaignLockOverlay
  );

  // Featured Chapter Details & Controls
  const campaignCardBody = el('div', 'campaign-card-body');
  const campaignChapterTitle = el('h3', 'campaign-chapter-title', LEVELS[0].nameRu);
  const campaignChapterLore = el('p', 'campaign-chapter-lore', LEVELS[0].subtitleRu);

  const campaignThreatsWrap = el('div', 'campaign-threats-wrap');
  const campaignThreatsLabel = el('span', 'campaign-threats-label', 'УГРОЗЫ ГЛАВЫ:');
  const campaignThreatsList = el('div', 'campaign-threats-list');
  campaignThreatsWrap.append(campaignThreatsLabel, campaignThreatsList);

  const campaignActionRow = el('div', 'campaign-action-row');
  const campaignWpnCheckBtn = el('button', 'campaign-wpn-check is-ready');
  campaignWpnCheckBtn.type = 'button';
  const campaignWpnCheckIcon = el('span', 'campaign-wpn-check-icon');
  const campaignWpnCheckText = el('span', 'campaign-wpn-check-text', 'Оружие готово (Ур. 1)');
  campaignWpnCheckBtn.append(campaignWpnCheckIcon, campaignWpnCheckText);

  const campaignStartBtn = el('button', 'campaign-start-btn', '⚔️ НАЧАТЬ ГЛАВУ');
  campaignStartBtn.type = 'button';
  campaignActionRow.append(campaignWpnCheckBtn, campaignStartBtn);

  campaignCardBody.append(
    campaignChapterTitle,
    campaignChapterLore,
    campaignThreatsWrap,
    campaignActionRow
  );
  campaignCard.append(campaignBannerWrap, campaignCardBody);

  const campaignNextBtn = el('button', 'campaign-nav-arrow next', '›');
  campaignNextBtn.type = 'button';
  campaignNextBtn.setAttribute('aria-label', 'Следующая глава');

  campaignShowcaseStage.append(campaignPrevBtn, campaignCard, campaignNextBtn);

  // Bottom 5 Chapter Nodes along the Act
  const campaignNodesStrip = el('div', 'campaign-nodes-strip');

  campaignBox.append(campaignTopBar, campaignActsBar, campaignShowcaseStage, campaignNodesStrip);
  campaignPanel.appendChild(campaignBox);

  // =========================================================================
  // TAB 3: 🗡️ АРСЕНАЛ (Per-Class Weapon Upgrades 1..12 + Custom Vector Art)
  // =========================================================================
  const arsenalPanel = el('section', 'hub-panel hub-panel-sub hidden');
  const arsenalBox = el('div', 'hub-subpanel-card arsenal-subpanel');

  const arsenalHeaderRow = el('div', 'subpanel-header-row');
  const arsenalTitleGroup = el('div', 'subpanel-title-group');
  const arsenalHeading = el('h2', 'subpanel-title', '🗡️ Арсенал Охотника');
  const arsenalSubhint = el('p', 'subpanel-hint', 'Рунные Сундуки в Главах III и VII открывают новое оружие класса навсегда');
  arsenalTitleGroup.append(arsenalHeading, arsenalSubhint);

  const arsenalClassSwitch = el('div', 'arsenal-class-switch');
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
  arsenalHeaderRow.append(arsenalTitleGroup, arsenalClassSwitch);

  const arsenalMageElementsBox = el('div', 'arsenal-mage-elements hidden');
  const arsenalCardsGrid = el('div', 'arsenal-cards-grid');

  const arsenalFooterRow = el('div', 'subpanel-footer-row');
  const arsenalBackBtn = el('button', 'subpanel-back-btn', '← К герою');
  arsenalBackBtn.type = 'button';
  const arsenalQuickPlayBtn = el('button', 'subpanel-battle-btn', '⚔️ В БОЙ!');
  arsenalQuickPlayBtn.type = 'button';
  arsenalFooterRow.append(arsenalBackBtn, arsenalQuickPlayBtn);

  arsenalBox.append(arsenalHeaderRow, arsenalMageElementsBox, arsenalCardsGrid, arsenalFooterRow);
  arsenalPanel.appendChild(arsenalBox);

  // =========================================================================
  // TAB 4: 🧪 МАСТЕРСКАЯ (Per-Class Talents + Class Badge + Reward Gold)
  // =========================================================================
  const shopPanel = el('section', 'hub-panel hub-panel-sub hidden');
  const shopBox = el('div', 'hub-subpanel-card shop-subpanel');

  const shopHeaderRow = el('div', 'subpanel-header-row');
  const shopTitleGroup = el('div', 'subpanel-title-group');
  const masteryHeading = el('h2', 'subpanel-title', '🧪 Мастерская Талантов');
  const masteryClassBadge = el('div', 'workshop-class-badge');
  const masteryClassBadgeImg = document.createElement('img');
  masteryClassBadgeImg.className = 'workshop-badge-portrait';
  masteryClassBadgeImg.src = CLASSES.warrior.portrait;
  masteryClassBadgeImg.alt = '';
  const masteryClassBadgeText = el('span', '', 'Таланты класса: Воин Клятвы');
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

  const rewardGoldBtn = el('button', 'gothic-btn btn-reward-gold', '+80 золота (Видео)');
  rewardGoldBtn.type = 'button';
  shopHeaderControls.append(shopClassSwitch, rewardGoldBtn);
  shopHeaderRow.append(shopTitleGroup, shopHeaderControls);

  const masteryGrid = el('div', 'mastery-grid');

  const shopFooterRow = el('div', 'subpanel-footer-row');
  const shopBackBtn = el('button', 'subpanel-back-btn', '← К герою');
  shopBackBtn.type = 'button';
  const shopQuickPlayBtn = el('button', 'subpanel-battle-btn', '⚔️ В БОЙ!');
  shopQuickPlayBtn.type = 'button';
  shopFooterRow.append(shopBackBtn, shopQuickPlayBtn);

  shopBox.append(shopHeaderRow, masteryGrid, shopFooterRow);
  shopPanel.appendChild(shopBox);

  hubBody.append(heroesPanel, campaignPanel, arsenalPanel, shopPanel);
  hubShell.append(hubHeader, hubBody);
  hubScreen.appendChild(hubShell);
  root.appendChild(hubScreen);

  // =========================================================================
  // SOUND SETTINGS POPOVER
  // =========================================================================
  const soundPopover = el('div', 'sound-popover hidden');
  const soundPopHead = el('div', 'sound-pop-head');
  const soundPopTitle = el('span', 'sound-pop-title', 'Громкость');
  const soundPopVal = el('span', 'sound-pop-val', '85%');
  soundPopHead.append(soundPopTitle, soundPopVal);

  const soundSliderWrap = el('div', 'sound-slider-wrap');
  const soundSlider = document.createElement('input');
  soundSlider.type = 'range';
  soundSlider.className = 'sound-volume-slider';
  soundSlider.min = '0';
  soundSlider.max = '100';
  soundSlider.step = '1';
  soundSlider.value = '85';
  soundSlider.setAttribute('aria-label', 'Громкость');
  soundSliderWrap.appendChild(soundSlider);

  const soundMuteToggleBtn = el('button', 'sound-mute-toggle-btn', 'Выключить звук');
  soundMuteToggleBtn.type = 'button';

  soundPopover.append(soundPopHead, soundSliderWrap, soundMuteToggleBtn);
  root.appendChild(soundPopover);

  let soundAnchorBtn = null;

  function positionSoundPopover(anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popWidth = 232;
    const left = Math.max(10, Math.min(window.innerWidth - popWidth - 10, rect.right - popWidth));
    const top = Math.max(10, Math.min(window.innerHeight - 135, rect.bottom + 8));
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

  // Result Modal (Victory / Defeat)
  const resultModal = el('div', 'modal-backdrop hidden');
  const resultPanel = el('div', 'modal-panel result-panel');
  const resultCrest = el('div', 'result-crest');
  const resultTitle = el('h2', 'modal-title', 'Глава пройдена!');
  const resultLevelName = el('p', 'modal-subtitle', '');
  const resultStatsGrid = el('div', 'result-stats-grid');

  const resGoldBox = el('div', 'result-stat-box');
  const resGoldLabel = el('div', 'result-stat-label', 'Добыто золота');
  const resGoldVal = el('div', 'result-stat-val', '+0');
  resGoldBox.append(resGoldLabel, resGoldVal);

  const resKillsBox = el('div', 'result-stat-box');
  const resKillsLabel = el('div', 'result-stat-label', 'Истреблено нежити');
  const resKillsVal = el('div', 'result-stat-val', '0');
  resKillsBox.append(resKillsLabel, resKillsVal);

  resultStatsGrid.append(resGoldBox, resKillsBox);
  const resultUnlockedBox = el('div', 'result-unlocked-box hidden');
  const resultActionsCol = el('div', 'result-actions-col');
  resultPanel.append(resultCrest, resultTitle, resultLevelName, resultStatsGrid, resultUnlockedBox, resultActionsCol);
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

  // =========================================================================
  // INTERACTIVE SOUND, HUD & HUB TAB HANDLERS
  // =========================================================================
  function syncMuteButtons() {
    const effectiveVol = muted ? 0 : volume;
    const icon = effectiveVol <= 0.001 ? '🔇' : effectiveVol < 0.5 ? '🔉' : '🔊';
    hudMuteBtn.textContent = icon;
    hubMuteBtn.textContent = icon;

    const pct = Math.round(effectiveVol * 100);
    soundPopTitle.textContent = lang === 'en' ? 'Volume' : 'Громкость';
    soundPopVal.textContent = muted ? (lang === 'en' ? 'Muted' : 'Выкл') : `${pct}%`;
    soundSlider.value = String(pct);
    soundSlider.style.setProperty('--vol-pct', `${pct}%`);

    soundMuteToggleBtn.classList.toggle('is-muted', muted || volume <= 0.001);
    if (muted || volume <= 0.001) {
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

  function syncStaticLabels() {
    const isEn = lang === 'en';
    hubTitle.textContent = isEn ? 'GRIMBORNE HUNTERS' : 'ОХОТНИКИ МРАКА';
    tabHeroesLabel.textContent = isEn ? '⚔️ Heroes' : '⚔️ Герои';
    tabCampaignLabel.textContent = isEn ? '🗺️ Campaign' : '🗺️ Поход';
    tabArsenalLabel.textContent = isEn ? '🗡️ Arsenal' : '🗡️ Арсенал';
    tabShopLabel.textContent = isEn ? '🧪 Workshop' : '🧪 Мастерская';
    heroWeaponChipArrow.textContent = isEn ? 'Arsenal ›' : 'Арсенал ›';
    changeChapterBtn.textContent = isEn ? '🗺️ Change Chapter ›' : '🗺️ Сменить главу ›';
    launchMainText.textContent = isEn ? '⚔️ BATTLE!' : '⚔️ В БОЙ!';
    arsenalQuickPlayBtn.textContent = isEn ? '⚔️ BATTLE!' : '⚔️ В БОЙ!';
    shopQuickPlayBtn.textContent = isEn ? '⚔️ BATTLE!' : '⚔️ В БОЙ!';
    campaignBackHeroBtn.textContent = isEn ? '← Hero Stage' : '← К герою';
    arsenalBackBtn.textContent = isEn ? '← Hero Stage' : '← К герою';
    shopBackBtn.textContent = isEn ? '← Hero Stage' : '← К герою';
    campaignHeading.textContent = isEn ? '🗺️ Dark Campaign — 25 Chapters' : '🗺️ Карта Похода — 25 Глав';
    arsenalSubhint.textContent = isEn
      ? 'Relic Chests in Chapters III & VII permanently unlock new class weapons'
      : 'Рунные Сундуки в Главах III и VII открывают новое оружие класса навсегда';
    masteryHeading.textContent = isEn ? '🧪 Class Workshop' : '🧪 Мастерская Класса';
    rewardGoldBtn.textContent = isEn ? '🎁 +80 Gold (Video)' : '🎁 +80 золота (Видео)';
    leftCap.textContent = isEn ? 'MOVE' : 'ДВИЖЕНИЕ';
    syncMuteButtons();
    syncAutoAimButton();
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
    if (tabId === 'campaign' || tabId === 'map' || tabId === 'chapters') return 'campaign';
    if (tabId === 'arsenal') return 'arsenal';
    if (tabId === 'shop' || tabId === 'workshop') return 'shop';
    return 'heroes';
  }

  function setActiveTab(tabId) {
    const valid = normalizeTabId(tabId);
    activeHubTab = valid;

    tabHeroesBtn.classList.toggle('is-active', valid === 'heroes');
    tabCampaignBtn.classList.toggle('is-active', valid === 'campaign');
    tabArsenalBtn.classList.toggle('is-active', valid === 'arsenal');
    tabShopBtn.classList.toggle('is-active', valid === 'shop');

    heroesPanel.classList.toggle('hidden', valid !== 'heroes');
    campaignPanel.classList.toggle('hidden', valid !== 'campaign');
    arsenalPanel.classList.toggle('hidden', valid !== 'arsenal');
    shopPanel.classList.toggle('hidden', valid !== 'shop');

    hubScreen.classList.toggle('is-subtab', valid !== 'heroes');
    hubScreen.scrollTop = 0;

    if (valid === 'campaign' && lastHubState) {
      viewedCampaignLevel = localSelectedLevel;
      renderHub(lastHubState);
    }
  }

  tabHeroesBtn.addEventListener('click', () => setActiveTab('heroes'));
  tabCampaignBtn.addEventListener('click', () => setActiveTab('campaign'));
  tabArsenalBtn.addEventListener('click', () => setActiveTab('arsenal'));
  tabShopBtn.addEventListener('click', () => setActiveTab('shop'));

  heroWeaponChip.addEventListener('click', () => setActiveTab('arsenal'));
  launchWeaponWarn.addEventListener('click', () => setActiveTab('arsenal'));
  changeChapterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setActiveTab('campaign');
  });
  chapterMiniCard.addEventListener('click', () => setActiveTab('campaign'));

  campaignBackHeroBtn.addEventListener('click', () => setActiveTab('heroes'));
  arsenalBackBtn.addEventListener('click', () => setActiveTab('heroes'));
  shopBackBtn.addEventListener('click', () => setActiveTab('heroes'));

  autoAimBtn.addEventListener('click', () => {
    const next = !autoAim;
    const res = callbacks.onToggleAutoAim?.(next);
    autoAim = typeof res === 'boolean' ? res : next;
    syncAutoAimButton();
  });

  hudHomeBtn.addEventListener('click', () => {
    closeSoundPopover();
    setActiveTab('heroes');
    (callbacks.onExitToHub || callbacks.onReturnToHub || callbacks.onQuitRun)?.();
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

  function isMageStarterChosen() {
    if (!lastHubState) return false;
    if (typeof lastHubState?.getMageElementState === 'function') {
      return Boolean(lastHubState.getMageElementState().starterChosen);
    }
    const st = typeof lastHubState?.getState === 'function' ? lastHubState.getState() : lastHubState;
    return Boolean(st?.mageStarterChosen);
  }

  function resetLocalSelection() {
    localSelectedClass = 'warrior';
    localSelectedLevel = 1;
    viewedCampaignLevel = 1;
    cachedMaxUnlockedLevel = 1;
    lastSeenMaxUnlockedLevel = null;
    userPickedLevel = false;
    currentEquippedWeaponId = 'club';
    setActiveTab('heroes');
  }

  resetConfirmYesBtn.addEventListener('click', () => {
    hideResetConfirmModal();
    resetLocalSelection();
    callbacks.onResetProgress?.();
  });

  function selectHeroClass(nextClassId) {
    if (!CLASSES[nextClassId] || nextClassId === localSelectedClass) return;
    localSelectedClass = nextClassId;

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

  campaignPrevBtn.addEventListener('click', () => navigateCampaignChapter(viewedCampaignLevel - 1));
  campaignNextBtn.addEventListener('click', () => navigateCampaignChapter(viewedCampaignLevel + 1));

  for (const aDef of ACT_DEFS) {
    campaignActBtns[aDef.act].addEventListener('click', () => {
      const actStart = (aDef.act - 1) * 5 + 1;
      const actEnd = aDef.act * 5;
      if (localSelectedLevel >= actStart && localSelectedLevel <= actEnd) {
        navigateCampaignChapter(localSelectedLevel);
      } else if (cachedMaxUnlockedLevel >= actStart) {
        navigateCampaignChapter(Math.min(actEnd, cachedMaxUnlockedLevel));
      } else {
        navigateCampaignChapter(actStart);
      }
    });
  }

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

  launchBattleBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));
  arsenalQuickPlayBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));
  shopQuickPlayBtn.addEventListener('click', () => triggerStartRun(localSelectedLevel));

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
      if (activeHubTab === 'heroes') {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          cycleHeroClass(-1);
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          cycleHeroClass(1);
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
          setActiveTab('heroes');
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setActiveTab('heroes');
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
    hubGoldAmount.textContent = String(gold);

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
    const eqShopLvl = resolveWeaponShopLevel(state, storeRef, eqWpnDef.id, maxWpnLvl);
    const eqUpgCost = resolveWeaponUpgradeCost(state, storeRef, callbacks, eqWpnDef, eqShopLvl, maxWpnLvl);
    const eqCanUpgrade = eqShopLvl < maxWpnLvl && typeof eqUpgCost === 'number' && gold >= eqUpgCost;

    // --- 2b. Mage 4-Element Selector inside Hero Card ---
    const mageElemState =
      typeof storeRef?.getMageElementState === 'function'
        ? storeRef.getMageElementState()
        : {
            starterChosen: Boolean(state.mageStarterChosen),
            activeElement: state.activeMageElement || 'fire',
            unlockedElements: { ...(state.unlockedMageElements || {}) },
            nextUnlockCost:
              !state.mageStarterChosen
                ? 0
                : MAGE_ELEMENT_UNLOCK_COSTS[
                    MAGE_ELEMENT_ORDER.filter((k) => state.unlockedMageElements?.[k]).length
                  ] ?? null
          };

    const isMageActive = localSelectedClass === 'mage';
    mageElementsBox.classList.toggle('hidden', !isMageActive);
    if (isMageActive) {
      const curElemId = MAGE_ELEMENTS[mageElemState.activeElement] ? mageElemState.activeElement : 'fire';
      const curElemDef = MAGE_ELEMENTS[curElemId];
      mageElemTitle.textContent = '✦ Стихия посоха:';
      if (!mageElemState.starterChosen) {
        mageElemStatus.textContent = '1-я бесплатно!';
      } else {
        mageElemStatus.textContent = `${curElemDef.icon} ${curElemDef.nameRu}`;
      }

      mageElemRow.innerHTML = '';
      for (const elKey of MAGE_ELEMENT_ORDER) {
        const eDef = MAGE_ELEMENTS[elKey];
        if (!eDef) continue;
        const unlocked = Boolean(mageElemState.unlockedElements?.[elKey]);
        const isCurrent = mageElemState.starterChosen && curElemId === elKey && unlocked;
        const costVal = unlocked ? null : mageElemState.nextUnlockCost;
        const canAffordUnlock = !unlocked && typeof costVal === 'number' && gold >= costVal;

        const pillBtn = el(
          'button',
          `mage-elem-pill elem-theme-${elKey}${isCurrent ? ' is-active' : ''}${unlocked ? ' is-unlocked' : ' is-locked'}${canAffordUnlock ? ' is-affordable' : ''}`
        );
        pillBtn.type = 'button';
        pillBtn.style.setProperty('--elem-color', hexNumToCss(eDef.color, '#c084fc'));

        const topTxt = el('span', 'mage-elem-pill-name', `${eDef.icon} ${eDef.shortRu}`);
        let subLabel = '';
        if (isCurrent) subLabel = '✓ Выбрана';
        else if (unlocked) subLabel = 'Взять';
        else if (costVal === 0) subLabel = 'Бесплатно';
        else subLabel = `🔒 ${costVal}`;
        const subTxt = el('span', 'mage-elem-pill-sub', subLabel);

        pillBtn.append(topTxt, subTxt);
        pillBtn.addEventListener('click', () => {
          callbacks.onSelectMageElement?.(elKey);
        });
        mageElemRow.appendChild(pillBtn);
      }

      mageElemDesc.textContent = mageElemState.starterChosen
        ? curElemDef.descRu
        : 'Нажмите на любую стихию выше, чтобы выбрать первую школу магии бесплатно!';
    }

    heroWeaponChipIcon.innerHTML = '';
    heroWeaponChipIcon.appendChild(createWeaponSvg(eqWpnDef.id));
    heroWeaponChipName.textContent = isEn ? eqWpnDef.nameEn : eqWpnDef.nameRu;
    heroWeaponChipLvl.textContent = isEn
      ? `Lv. ${eqShopLvl}/${maxWpnLvl}`
      : `Ур. ${eqShopLvl}/${maxWpnLvl}`;
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
    if (isUnderleveledForSelected) {
      launchWeaponWarn.textContent = isEn
        ? `⚠️ Weapon below chapter rank! (Lv. ${eqShopLvl} / rec. ${selLevelDef.recWeaponLevel})`
        : `⚠️ Оружие слабее главы! (Ур. ${eqShopLvl} / рек. ${selLevelDef.recWeaponLevel})`;
    }

    launchSubText.textContent = isEn
      ? `${activeClass.nameEn} • ${eqWpnDef.nameEn} • Ch. ${selLevelDef.roman}`
      : `${activeClass.nameRu} • ${eqWpnDef.nameRu} • Глава ${selLevelDef.roman}`;

    // --- 4. Render Dedicated 25-Chapter Campaign Screen (🗺️ Поход) ---
    const viewDef = LEVELS[viewedCampaignLevel - 1] || selLevelDef;
    const viewAct = viewDef.act || Math.ceil(viewDef.level / 5);
    const isViewLocked = explicitLevelLock && (
      Array.isArray(state.unlockedLevels)
        ? !state.unlockedLevels.includes(viewDef.level)
        : viewDef.level > maxUnlockedLevel
    );

    campaignProgressHint.textContent = isEn
      ? `Unlocked Chapters: ${maxUnlockedLevel} / ${LEVELS.length} • Active Hero: ${activeClass.nameEn}`
      : `Открыто глав: ${maxUnlockedLevel} из ${LEVELS.length} • Охотник: ${activeClass.nameRu}`;

    for (const aDef of ACT_DEFS) {
      const btn = campaignActBtns[aDef.act];
      if (!btn) continue;
      const actFirstLvl = (aDef.act - 1) * 5 + 1;
      const actLocked = explicitLevelLock && actFirstLvl > maxUnlockedLevel;
      btn.classList.toggle('is-active', aDef.act === viewAct);
      btn.classList.toggle('is-locked', actLocked);
      const baseTitle = isEn ? aDef.titleEn : aDef.titleRu;
      btn.textContent = actLocked ? `🔒 ${baseTitle}` : baseTitle;
    }

    campaignPrevBtn.disabled = viewDef.level <= 1;
    campaignNextBtn.disabled = viewDef.level >= LEVELS.length;

    campaignBannerImg.src = viewDef.bannerImg;
    campaignBannerImg.alt = viewDef.nameRu;
    campaignCard.classList.toggle('is-boss-chapter', Boolean(viewDef.hasBoss));
    campaignCard.classList.toggle('is-locked-chapter', isViewLocked);

    campaignActPill.textContent = isEn
      ? `ACT ${ACT_DEFS[viewAct - 1]?.roman || viewAct} • CHAPTER ${viewDef.roman}`
      : `АКТ ${ACT_DEFS[viewAct - 1]?.roman || viewAct} • ГЛАВА ${viewDef.roman}`;
    campaignDurationPill.textContent = `⏱️ ${formatTimeMMSS(viewDef.durationSec)}`;

    if (viewDef.hasBoss) {
      const bossName = ENEMY_TYPES[viewDef.bossId]?.nameRu || 'Босс Акта';
      campaignSpecialBadge.textContent = isEn ? '💀 ACT BOSS' : `💀 БОСС АКТА • ${bossName.toUpperCase()}`;
      campaignSpecialBadge.className = 'campaign-special-badge is-boss';
    } else if (viewDef.unlockWeaponTier) {
      const rStr = TIER_ROMAN[viewDef.unlockWeaponTier] || viewDef.unlockWeaponTier;
      campaignSpecialBadge.textContent = isEn
        ? `🗡️ NEW WEAPON (TIER ${rStr})`
        : `🗡️ НОВОЕ ОРУЖИЕ (${rStr} РАНГ)`;
      campaignSpecialBadge.className = 'campaign-special-badge is-weapon';
    } else {
      campaignSpecialBadge.className = 'campaign-special-badge hidden';
    }

    campaignLockOverlay.classList.toggle('hidden', !isViewLocked);
    if (isViewLocked) {
      const prevRoman = LEVELS[Math.max(0, viewDef.level - 2)]?.roman || String(viewDef.level - 1);
      campaignLockTitle.textContent = isEn ? 'CHAPTER SEALED' : 'ГЛАВА ЗАПЕЧАТАНА';
      campaignLockSub.textContent = isEn
        ? `Clear Chapter ${prevRoman} to unlock this battleground`
        : `Одержите победу в Главе ${prevRoman}, чтобы открыть путь`;
    }

    campaignChapterTitle.textContent = isEn ? `${viewDef.nameEn}: ${viewDef.shortTitleRu}` : viewDef.nameRu;
    campaignChapterLore.textContent = viewDef.subtitleRu;

    // Enemy Threat Roster Pills (Boss + Pool)
    campaignThreatsLabel.textContent = isEn ? 'ENEMY THREATS:' : 'БЕСТИАРИЙ ГЛАВЫ:';
    campaignThreatsList.innerHTML = '';

    if (viewDef.hasBoss && viewDef.bossId && ENEMY_TYPES[viewDef.bossId]) {
      const bDef = ENEMY_TYPES[viewDef.bossId];
      const bossPill = el('div', 'threat-pill is-boss-threat');
      const dot = el('span', 'threat-dot');
      dot.style.background = '#ef4444';
      const nameSpan = el('strong', 'threat-name', `💀 ${bDef.nameRu}`);
      const roleSpan = el('span', 'threat-role', bDef.roleHintRu);
      bossPill.append(dot, nameSpan, roleSpan);
      campaignThreatsList.appendChild(bossPill);
    }

    for (const enemyId of viewDef.enemyPool || []) {
      const eDef = ENEMY_TYPES[enemyId];
      if (!eDef) continue;
      const pill = el('div', 'threat-pill');
      const dot = el('span', 'threat-dot');
      dot.style.background = hexNumToCss(eDef.color, '#94a3b8');
      const nameSpan = el('strong', 'threat-name', eDef.nameRu);
      const roleSpan = el('span', 'threat-role', eDef.roleHintRu);
      pill.append(dot, nameSpan, roleSpan);
      campaignThreatsList.appendChild(pill);
    }

    // Recommended Weapon Rank vs Current Class Weapon Rank Pill
    const recLvl = viewDef.recWeaponLevel || 1;
    const wpnReady = eqShopLvl >= recLvl;
    campaignWpnCheckBtn.classList.toggle('is-ready', wpnReady);
    campaignWpnCheckBtn.classList.toggle('is-warn', !wpnReady);
    campaignWpnCheckIcon.innerHTML = '';
    campaignWpnCheckIcon.appendChild(createWeaponSvg(eqWpnDef.id, 'mini-check-wpn-svg'));

    if (wpnReady) {
      campaignWpnCheckText.textContent = isEn
        ? `✓ Weapon Ready (Lv. ${eqShopLvl} / rec. ${recLvl})`
        : `✓ Оружие готово (Ур. ${eqShopLvl} / рек. ${recLvl})`;
    } else {
      campaignWpnCheckText.textContent = isEn
        ? `⚠️ Upgrade Recommended (Lv. ${eqShopLvl} / rec. ${recLvl})`
        : `⚠️ Требуется прокачка оружия (Ур. ${eqShopLvl} / рек. ${recLvl})`;
    }

    campaignStartBtn.disabled = isViewLocked;
    if (isViewLocked) {
      campaignStartBtn.textContent = isEn ? '🔒 LOCKED' : '🔒 ГЛАВА ЗАКРЫТА';
    } else {
      campaignStartBtn.textContent = isEn ? '⚔️ START CHAPTER' : '⚔️ НАЧАТЬ ГЛАВУ';
    }

    // 5 Chapter Nodes along the bottom of the Active Act
    campaignNodesStrip.innerHTML = '';
    const actStartLvl = (viewAct - 1) * 5 + 1;
    for (let l = actStartLvl; l < actStartLvl + 5 && l <= LEVELS.length; l++) {
      const cDef = LEVELS[l - 1];
      const nodeLocked = explicitLevelLock && l > maxUnlockedLevel;
      const nodeCleared = l < maxUnlockedLevel;
      const nodeActive = l === viewDef.level;

      const nodeBtn = el(
        'button',
        `campaign-node-btn${nodeActive ? ' is-active' : ''}${nodeCleared ? ' is-cleared' : ''}${nodeLocked ? ' is-locked' : ''}${cDef.hasBoss ? ' is-boss-node' : ''}`
      );
      nodeBtn.type = 'button';

      const medallion = el('span', 'campaign-node-medallion');
      if (nodeLocked) {
        medallion.textContent = `🔒 ${cDef.roman}`;
      } else if (cDef.hasBoss) {
        medallion.textContent = `💀 ${cDef.roman}`;
      } else if (cDef.unlockWeaponTier) {
        medallion.textContent = `🗡️ ${cDef.roman}`;
      } else if (nodeCleared) {
        medallion.textContent = `✓ ${cDef.roman}`;
      } else {
        medallion.textContent = cDef.roman;
      }

      const shortName = el('span', 'campaign-node-title', cDef.shortTitleRu);
      nodeBtn.append(medallion, shortName);
      nodeBtn.addEventListener('click', () => navigateCampaignChapter(l));
      campaignNodesStrip.appendChild(nodeBtn);
    }

    // --- 5. Render 🗡️ Арсенал Cards (3 Per-Class Weapons, Shop Levels 1..12 + Mage Elements) ---
    arsenalHeading.textContent = isEn
      ? `🗡️ Arsenal — ${activeClass.nameEn}`
      : `🗡️ Арсенал — ${activeClass.nameRu}`;
    arsenalCardsGrid.innerHTML = '';

    arsenalMageElementsBox.classList.toggle('hidden', localSelectedClass !== 'mage');
    arsenalMageElementsBox.innerHTML = '';
    let anyElemUnlockAffordable = false;
    if (localSelectedClass === 'mage') {
      const aHead = el('div', 'arsenal-elem-header');
      aHead.append(
        el('span', 'arsenal-elem-title', '✦ Школы Стихий Посоха (переключаются свободно после открытия)'),
        el(
          'span',
          'arsenal-elem-hint',
          !mageElemState.starterChosen
            ? 'Первая стихия — БЕСПЛАТНО!'
            : mageElemState.nextUnlockCost !== null
              ? `Следующая стихия: ${mageElemState.nextUnlockCost} золота`
              : 'Все 4 стихии открыты!'
        )
      );
      const aGrid = el('div', 'arsenal-elem-grid');
      for (const elKey of MAGE_ELEMENT_ORDER) {
        const eDef = MAGE_ELEMENTS[elKey];
        if (!eDef) continue;
        const unlocked = Boolean(mageElemState.unlockedElements?.[elKey]);
        const isCurrent = mageElemState.starterChosen && mageElemState.activeElement === elKey && unlocked;
        const costVal = unlocked ? null : mageElemState.nextUnlockCost;
        if (!unlocked && typeof costVal === 'number' && gold >= costVal) {
          anyElemUnlockAffordable = true;
        }
        const eCard = el(
          'button',
          `arsenal-elem-card elem-theme-${elKey}${isCurrent ? ' is-active' : ''}${unlocked ? ' is-unlocked' : ' is-locked'}`
        );
        eCard.type = 'button';
        eCard.style.setProperty('--elem-color', hexNumToCss(eDef.color, '#c084fc'));
        const topRow = el('div', 'arsenal-elem-card-top');
        topRow.append(
          el('strong', 'arsenal-elem-name', `${eDef.icon} ${eDef.nameRu}`),
          el(
            'span',
            'arsenal-elem-tag',
            isCurrent
              ? '✓ Активна'
              : unlocked
                ? 'Выбрать'
                : costVal === 0
                  ? 'Бесплатно'
                  : `🔒 ${costVal} зол.`
          )
        );
        const dP = el('p', 'arsenal-elem-desc', eDef.descRu);
        eCard.append(topRow, dP);
        eCard.addEventListener('click', () => {
          callbacks.onSelectMageElement?.(elKey);
        });
        aGrid.appendChild(eCard);
      }
      arsenalMageElementsBox.append(aHead, aGrid);
    }

    let anyWeaponUpgradeAffordable = anyElemUnlockAffordable;

    for (const wId of activeClass.weapons) {
      const wDef = WEAPONS[wId];
      if (!wDef) continue;

      const unlocked = resolveWeaponUnlocked(state, storeRef, wDef);
      const isEquipped = unlocked && wId === equippedWeaponId;
      const tierLabel = isEn
        ? `Tier ${TIER_ROMAN[wDef.tier] || wDef.tier}`
        : `Ранг ${TIER_ROMAN[wDef.tier] || wDef.tier}`;

      if (!unlocked) {
        const lockedCard = el('div', 'weapon-card is-locked');
        const head = el('div', 'weapon-card-head');
        head.append(
          el('span', 'weapon-tier-badge', tierLabel),
          el('span', 'weapon-shop-lvl', isEn ? '🔒 Sealed' : '🔒 Тайна')
        );

        const silWrap = el('div', 'locked-silhouette-wrap');
        const silIcon = el('div', 'locked-silhouette-icon');
        silIcon.appendChild(createWeaponSvg(wId, 'locked-weapon-svg'));
        const mysName = el('h4', 'locked-mystery-name', isEn ? wDef.nameEn : wDef.nameRu);
        const unlockRoman = LEVELS[Math.max(0, (wDef.unlockLevel || 3) - 1)]?.roman || wDef.unlockLevel;
        const lockText = isEn
          ? `🔒 Relic Chest • Chapter ${unlockRoman}`
          : `🔒 Рунный Сундук • Глава ${unlockRoman}`;
        const hintBadge = el('div', 'locked-hint-badge', lockText);

        silWrap.append(silIcon, mysName);
        lockedCard.append(head, silWrap, hintBadge);
        arsenalCardsGrid.appendChild(lockedCard);
        continue;
      }

      const shopLevel = resolveWeaponShopLevel(state, storeRef, wId, maxWpnLvl);
      const upgradeCost = resolveWeaponUpgradeCost(state, storeRef, callbacks, wDef, shopLevel, maxWpnLvl);
      const isMaxed = shopLevel >= maxWpnLvl || upgradeCost === null;
      if (!isMaxed && typeof upgradeCost === 'number' && gold >= upgradeCost) {
        anyWeaponUpgradeAffordable = true;
      }

      const wCard = el('div', `weapon-card${isEquipped ? ' is-equipped' : ''}`);
      const head = el('div', 'weapon-card-head');
      head.append(
        el('span', 'weapon-tier-badge', tierLabel),
        el(
          'span',
          'weapon-shop-lvl',
          isEn ? `Lv. ${shopLevel}/${maxWpnLvl}` : `Ур. ${shopLevel}/${maxWpnLvl}`
        )
      );

      const titleRow = el('div', 'weapon-title-row');
      const iconBox = el('div', 'weapon-icon-box');
      iconBox.appendChild(createWeaponSvg(wId));
      const wName = el('h4', 'weapon-name', isEn ? wDef.nameEn : wDef.nameRu);
      titleRow.append(iconBox, wName);

      const pipsRow = el('div', 'weapon-pips');
      pipsRow.style.setProperty('--wpn-max-pips', String(maxWpnLvl));
      for (let p = 1; p <= maxWpnLvl; p++) {
        pipsRow.appendChild(el('span', `weapon-pip${p <= shopLevel ? ' filled' : ''}`));
      }

      const wDesc = el('p', 'weapon-desc', wDef.descRu);
      const scaledDmg = Math.round(wDef.baseDamage * (1 + (shopLevel - 1) * 0.24));
      const rateStr = (1 / wDef.cooldown).toFixed(1);
      const magInfo = wDef.magSize
        ? isEn
          ? ` • Mag: ${wDef.magSize}`
          : ` • Обойма: ${wDef.magSize}`
        : wDef.manaCost
          ? isEn
            ? ` • Mana: ${wDef.manaCost}`
            : ` • Мана: ${wDef.manaCost}`
          : '';
      const metrics = el(
        'div',
        'weapon-metrics',
        isEn
          ? `Dmg: ${scaledDmg}${wDef.pellets > 1 ? ` ×${wDef.pellets}` : ''} • ${rateStr}/s${magInfo}`
          : `Урон: ${scaledDmg}${wDef.pellets > 1 ? ` ×${wDef.pellets}` : ''} • ${rateStr}/с${magInfo}`
      );

      const actionsRow = el('div', 'weapon-actions');
      const equipBtn = el(
        'button',
        `btn-equip${isEquipped ? ' in-hands' : ''}`,
        isEquipped ? (isEn ? '✓ Equipped' : '✓ В руках') : isEn ? 'Equip' : 'Взять'
      );
      equipBtn.type = 'button';
      equipBtn.disabled = isEquipped;
      equipBtn.addEventListener('click', () => {
        (callbacks.onEquipWeapon || callbacks.onSelectWeapon)?.(wId, localSelectedClass);
      });

      const upgBtn = el(
        'button',
        'btn-upgrade-wpn',
        isMaxed
          ? isEn
            ? `✨ Max ${maxWpnLvl}/${maxWpnLvl}`
            : `✨ Макс. ${maxWpnLvl}/${maxWpnLvl}`
          : isEn
            ? `Upgrade • ${upgradeCost}g`
            : `Улучшить • ${upgradeCost} зол.`
      );
      upgBtn.type = 'button';
      upgBtn.disabled = isMaxed || (typeof upgradeCost === 'number' && gold < upgradeCost);
      upgBtn.addEventListener('click', () => {
        callbacks.onUpgradeWeapon?.(wId);
      });

      actionsRow.append(equipBtn, upgBtn);
      wCard.append(head, titleRow, pipsRow, wDesc, metrics, actionsRow);
      arsenalCardsGrid.appendChild(wCard);
    }

    tabArsenalDot.classList.toggle('hidden', !anyWeaponUpgradeAffordable);

    // --- 6. Render 🧪 Мастерская (Per-Class Talents + Class Badge) ---
    masteryClassBadgeImg.src = activeClass.portrait;
    masteryClassBadgeImg.alt = activeClass.nameRu;
    masteryClassBadgeText.textContent = isEn
      ? `Class Talents: ${activeClass.nameEn}`
      : `Таланты класса: ${activeClass.nameRu}`;

    const masteryItems = resolveMasteryList(state, storeRef, callbacks, localSelectedClass, lang);
    masteryGrid.innerHTML = '';
    let anyMasteryAffordable = false;

    for (const m of masteryItems) {
      const isMax = m.level >= m.maxLevel || m.cost === null;
      if (!isMax && typeof m.cost === 'number' && gold >= m.cost) {
        anyMasteryAffordable = true;
      }

      const btn = el('button', 'mastery-btn');
      btn.type = 'button';
      btn.disabled = isMax || (typeof m.cost === 'number' && gold < m.cost);

      const top = el('div', 'mastery-top');
      const nameWrap = el('div', 'mastery-name-wrap');
      const iconBadge = el('span', 'mastery-icon-badge');
      iconBadge.appendChild(createStatRuneSvg(m.runeType));
      nameWrap.append(iconBadge, el('span', 'mastery-name', m.name));
      top.append(
        nameWrap,
        el('span', 'mastery-lvl', isEn ? `Lv. ${m.level}/${m.maxLevel}` : `Ур. ${m.level}/${m.maxLevel}`)
      );

      const pips = el('div', 'mastery-pips');
      for (let p = 1; p <= m.maxLevel; p++) {
        pips.appendChild(el('span', `mastery-pip${p <= m.level ? ' filled' : ''}`));
      }

      const bottomRow = el('div', 'mastery-bottom-row');
      const bonus = el('span', 'mastery-bonus', m.bonus);
      const costEl = el(
        'span',
        'mastery-cost',
        isMax ? (isEn ? 'MAX' : 'МАКС.') : `${m.cost} зол.`
      );
      bottomRow.append(bonus, costEl);

      btn.append(top, pips, bottomRow);
      btn.addEventListener('click', () => {
        (callbacks.onBuyHeroUpgrade || callbacks.onUpgradeStat || callbacks.onBuyStatUpgrade)?.(
          m.key,
          localSelectedClass
        );
      });
      masteryGrid.appendChild(btn);
    }

    tabShopDot.classList.toggle('hidden', !anyMasteryAffordable);
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
      const seals = Math.max(0, Math.min(3, Number(snapshot.beastSeals ?? snapshot.seals ?? snapshot.clovers ?? 0)));
      if (seals !== hudCache.sealsCount) {
        hudCache.sealsCount = seals;
        for (let i = 0; i < 3; i++) {
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

    if (isReloading !== hudCache.isReloading || maxAmmo !== hudCache.maxAmmo) {
      hudCache.isReloading = isReloading;
      reloadBarWrap.classList.toggle('hidden', !isReloading);
      weaponAmmoRow.classList.toggle('hidden', !hasMagazine || isReloading);
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
    } else if (hasMagazine) {
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
    const overMax = Number(snapshot.overdriveMaxAmmo ?? snapshot.specialMaxAmmo ?? snapshot.crateMaxAmmo ?? 35);
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

  function showLevelUpModal(choices = [], onSelect) {
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

      const foilShimmer = el('span', 'blessing-foil-shimmer');
      const topRibbon = el('div', 'blessing-top-ribbon');
      const catSpan = el('span', 'blessing-cat-label', categoryStr);
      const rankSpan = el('span', 'blessing-rank-label', rankStr);
      topRibbon.append(catSpan, rankSpan);

      const emblemStage = el('div', 'blessing-emblem-stage');
      emblemStage.appendChild(createRuneHaloSvg());
      emblemStage.appendChild(createBlessingRelicSvg(choice, 'blessing-relic-svg'));

      const nameEl = el('h3', 'blessing-name', choice?.nameRu || baseUpg?.nameRu || 'Дар Душ');
      const statPill = el('div', 'blessing-stat-pill', statBadgeStr);
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
    { victory = false, level = 1, goldEarned = 0, kills = 0, unlockedWeapon = null, canRevive = false } = {},
    actions = {}
  ) {
    closeSoundPopover();
    resultPanel.classList.toggle('is-victory', Boolean(victory));
    resultPanel.classList.toggle('is-defeat', !victory);

    const lvlDef = LEVELS[(Number(level) || 1) - 1];
    resultCrest.innerHTML = '';
    if (victory) {
      resultCrest.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 56 56" width="52" height="52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="25" fill="rgba(250,204,21,0.16)" stroke="#fde047" stroke-width="1.8"/>
            <polygon points="14,38 17,20 24,27 28,15 32,27 39,20 42,38" fill="#facc15" stroke="#fffbeb" stroke-width="1.5" stroke-linejoin="round"/>
            <rect x="15" y="40" width="26" height="4" rx="1.5" fill="#eab308"/>
          </svg>`
        )
      );
    } else {
      resultCrest.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 56 56" width="52" height="52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="28" cy="28" r="25" fill="rgba(239,68,68,0.16)" stroke="#f87171" stroke-width="1.8"/>
            <path d="M28 13 C19.5 13 14 19 14 26.5 C14 31.5 16.5 35 20 37 V42 H36 V37 C39.5 35 42 31.5 42 26.5 C42 19 36.5 13 28 13 Z" fill="#e2e8f0" stroke="#fca5a5" stroke-width="1.4"/>
            <circle cx="23" cy="27" r="3.2" fill="#7f1d1d"/>
            <circle cx="33" cy="27" r="3.2" fill="#7f1d1d"/>
          </svg>`
        )
      );
    }

    resultTitle.textContent = victory ? 'Победа! Глава очищена!' : 'Охотник пал в бою';
    resultLevelName.textContent = lvlDef ? lvlDef.nameRu : `Глава ${level}`;

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
        const reviveBtn = el('button', 'result-btn btn-revive', 'Воскреснуть с полным HP (Видео)');
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

      const arsenalBtn = el('button', 'result-btn btn-arsenal-primary', '🗡️ В Арсенал (Улучшить оружие)');
      arsenalBtn.type = 'button';
      arsenalBtn.addEventListener('click', () => {
        hideResultModal();
        setActiveTab('arsenal');
        (actions.onArsenal || actions.onGoToArsenal || actions.onHub || callbacks.onExitToHub)?.();
      });
      resultActionsCol.appendChild(arsenalBtn);

      const retryBtn = el('button', 'result-btn btn-retry', 'Повторить главу');
      retryBtn.type = 'button';
      retryBtn.addEventListener('click', () => {
        hideResultModal();
        (actions.onRetry || actions.onRestart || callbacks.onRetry)?.();
      });
      resultActionsCol.appendChild(retryBtn);
    } else {
      if (displayedGold > 0) {
        const doubleBtn = el('button', 'result-btn btn-double-gold', 'Удвоить добычу ×2 (Видео)');
        doubleBtn.type = 'button';
        doubleBtn.addEventListener('click', async () => {
          doubleBtn.disabled = true;
          const res = await (actions.onDoubleGold || callbacks.onDoubleGold)?.();
          if (res !== false) {
            displayedGold *= 2;
            resGoldVal.textContent = `+${displayedGold} (×2!)`;
            doubleBtn.textContent = 'Добыча удвоена!';
          } else {
            doubleBtn.disabled = false;
          }
        });
        resultActionsCol.appendChild(doubleBtn);
      }

      const nextArsenalBtn = el('button', 'result-btn btn-arsenal-primary', '⚔️ В Лагерь • Следующая глава');
      nextArsenalBtn.type = 'button';
      nextArsenalBtn.addEventListener('click', () => {
        hideResultModal();
        setActiveTab('heroes');
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
        const replayBtn = el('button', 'result-btn btn-retry', 'Повторить главу');
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

  // Initialize labels & default tab
  syncStaticLabels();
  setActiveTab('heroes');

  return {
    setCallbacks(nextCallbacks = {}) {
      callbacks = { ...callbacks, ...nextCallbacks };
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

    setAutoAimState(isEnabled) {
      autoAim = Boolean(isEnabled);
      syncAutoAimButton();
    },

    spawnFloatingText,

    getTouchInput() {
      return touchState;
    },

    showLevelUpModal,
    hideLevelUpModal,

    showWeaponUnlockBanner,
    showToast,

    showResultModal,
    hideResultModal,

    openMageStarterModal,
    resetLocalSelection,

    hideAllModals() {
      closeSoundPopover();
      hideLevelUpModal();
      hideResultModal();
      hideMageStarterModal();
      hideResetConfirmModal();
    }
  };
}
