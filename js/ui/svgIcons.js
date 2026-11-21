// Custom Gothic Dark-Fantasy Vector SVG Generators
// Extracted from js/ui.js (Wave 1 modularization): weapons, stat runes, talent runes, modal icons, mandala, blessing relics.

import { el, isWeaponHighlightChoice } from './resolvers.js?v=20261121z68';

let svgUidCounter = 0;

export function nextSvgUid(prefix = 'g') {
  svgUidCounter = (svgUidCounter + 1) % 999999;
  return `${prefix}${svgUidCounter}`;
}

export function makeSvgNode(markup, className = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = markup.trim();
  const svg = tpl.content.firstElementChild;
  if (svg && className) {
    svg.setAttribute('class', className);
  }
  return svg;
}

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

export function createStatRuneSvg(kind) {
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

export function createTalentRuneSvg(kind) {
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
  } else if (kind === 'pistol') {
    inner = `
      <path d="M4.5 9.5 H17.5 V12.5 H11.5 L10 18.5 H6.8 L8.1 12.5 H4.5 Z" fill="#334155" stroke="#fde047" stroke-width="1.45" stroke-linejoin="round"/>
      <path d="M17.5 10.3 H20 V11.7 H17.5" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="11.2" cy="13.8" r="1.1" fill="#fde047"/>`;
  } else if (kind === 'smg') {
    inner = `
      <path d="M3 10.5 H17.5 V13 H14.5 V18 H12 V13 H9.5 L8.3 17.5 H5.8 L6.8 13 H3 Z" fill="#1e293b" stroke="#38bdf8" stroke-width="1.45" stroke-linejoin="round"/>
      <path d="M17.5 11.2 H21.2" stroke="#bae6fd" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M7.5 8.2 H13.5" stroke="#fde047" stroke-width="1.3" stroke-linecap="round"/>`;
  } else if (kind === 'rifle') {
    inner = `
      <path d="M2.2 12.2 L6 12.2 L8 10.4 H16.5 L17.5 11.5 H21.8" stroke="#f97316" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8.4 12.2 H13.8 L15.2 17.2 L12.5 17.5 L11.4 13.4 H8.6 L6.2 16.5 H3.6 Z" fill="#7c2d12" stroke="#fdba74" stroke-width="1.3" stroke-linejoin="round"/>`;
  } else if (kind === 'shotgun') {
    inner = `
      <path d="M2.5 13.2 H15.5 L17 11.2 H21.5" stroke="#fb7185" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2.5 15.6 L6.8 15.6 L9 13.6 H16.5" stroke="#fda4af" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="20.5" cy="9.2" r="1.2" fill="#fde047"/>
      <circle cx="21.5" cy="13.8" r="1.1" fill="#f97316"/>`;
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

export function createModalIconSvg(kind, extraClass = 'modal-btn-svg') {
  let inner = '';
  if (kind === 'revive') {
    // Gothic Resurrection Ankh / Winged Soul Sigil (emerald core + burnished gold filigree)
    inner = `
      <path d="M12 2.8 C9.4 2.8 7.8 4.8 7.8 7.1 C7.8 9.3 9.7 11.1 12 12.4 C14.3 11.1 16.2 9.3 16.2 7.1 C16.2 4.8 14.6 2.8 12 2.8 Z" fill="#134e4a" stroke="#fde093" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 5.2 C10.8 5.2 10 6.1 10 7.2 C10 8.3 10.9 9.3 12 10 C13.1 9.3 14 8.3 14 7.2 C14 6.1 13.2 5.2 12 5.2 Z" fill="#6ee7b7"/>
      <path d="M4.6 12.6 L8.2 11.3 H15.8 L19.4 12.6 L15.8 13.9 H8.2 Z" fill="#e5b85c" stroke="#fef3c7" stroke-width="0.9" stroke-linejoin="round"/>
      <path d="M12 12.6 V20.6" stroke="#fde093" stroke-width="2" stroke-linecap="round"/>
      <polygon points="12,19.4 13.6,21.2 12,22.4 10.4,21.2" fill="#fde093"/>
      <path d="M4.2 8.2 L6.4 9.1 M19.8 8.2 L17.6 9.1" stroke="#6ee7b7" stroke-width="1.35" stroke-linecap="round" opacity="0.9"/>`;
  } else if (kind === 'double_gold') {
    // Twin Stamped Gothic Gold Coins + Gleam
    inner = `
      <circle cx="9.2" cy="14" r="6" fill="#92400e" stroke="#f59e0b" stroke-width="1.4"/>
      <circle cx="9.2" cy="14" r="3.8" stroke="#fcd34d" stroke-width="0.9" opacity="0.75"/>
      <circle cx="14.6" cy="11.4" r="6.3" fill="#ca8a04" stroke="#fef08a" stroke-width="1.5"/>
      <circle cx="14.6" cy="11.4" r="4.1" fill="#eab308" stroke="#fef9c3" stroke-width="0.95"/>
      <polygon points="14.6,8.6 16.4,11.4 14.6,14.2 12.8,11.4" fill="#fef9c3"/>
      <path d="M5.4 3.4 L6.1 5.4 L8.1 6.1 L6.1 6.8 L5.4 8.8 L4.7 6.8 L2.7 6.1 L4.7 5.4 Z" fill="#fef08a"/>`;
  } else if (kind === 'sparkle_done') {
    // Gothic 4-Point Seal Star
    inner = `
      <path d="M12 2.4 L14.1 9.6 L21.4 12 L14.1 14.4 L12 21.6 L9.9 14.4 L2.6 12 L9.9 9.6 Z" fill="#eab308" stroke="#fef9c3" stroke-width="1.3" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="2.2" fill="#fffbeb"/>
      <circle cx="18.2" cy="5.8" r="1.1" fill="#fde093"/>
      <circle cx="5.8" cy="18.2" r="1.1" fill="#fde093"/>`;
  } else if (kind === 'arsenal') {
    // Gothic Crossed Longswords
    inner = `
      <path d="M5.2 18.8 L16.8 5.2 L20 3.6 L18.4 6.8 L6.8 18.8 Z" fill="#cbd5e1" stroke="#f8fafc" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M18.8 18.8 L7.2 5.2 L4 3.6 L5.6 6.8 L17.2 18.8 Z" fill="#e2e8f0" stroke="#f8fafc" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M4.2 14.6 L9.4 19.8 M19.8 14.6 L14.6 19.8" stroke="#fde093" stroke-width="2" stroke-linecap="round"/>
      <path d="M4.6 19.4 L6.6 17.4 M19.4 19.4 L17.4 17.4" stroke="#991b1b" stroke-width="2.1" stroke-linecap="round"/>
      <circle cx="4.1" cy="19.9" r="1.35" fill="#fde093"/>
      <circle cx="19.9" cy="19.9" r="1.35" fill="#fde093"/>`;
  } else if (kind === 'campaign_map') {
    // Gothic Campaign Scroll with Compass Star
    inner = `
      <path d="M6.5 4.2 H18.5 C19.6 4.2 20.4 5 20.4 6 V7.6 H18.2 V17.2 C18.2 18.8 17 20 15.4 20 H5.4 C4.3 20 3.6 19.2 3.6 18.2 V16.4 H5.8 V6.8 C5.8 5.4 5.9 4.2 6.5 4.2 Z" fill="#31204a" stroke="#fde093" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M5.8 7.6 H18.2 M5.8 16.4 H15.4" stroke="#e5b85c" stroke-width="1" opacity="0.65"/>
      <polygon points="12,8.8 13.1,11.2 15.5,12.2 13.1,13.2 12,15.6 10.9,13.2 8.5,12.2 10.9,11.2" fill="#fde093"/>`;
  } else if (kind === 'retry') {
    // Crisp Gothic Circular Retry Arrow
    inner = `
      <path d="M18.6 12.6 A6.6 6.6 0 1 1 16.5 7.2" stroke="#e5dcf5" stroke-width="2" stroke-linecap="round"/>
      <polygon points="17.8,3.6 19.3,8.9 13.9,7.9" fill="#fde093" stroke="#fef9c3" stroke-width="0.8" stroke-linejoin="round"/>`;
  } else if (kind === 'pause_title') {
    // Beveled Gothic Pause Sigil
    inner = `
      <polygon points="12,1.8 22.2,12 12,22.2 1.8,12" fill="rgba(229,184,92,0.12)" stroke="rgba(229,184,92,0.58)" stroke-width="1.2"/>
      <rect x="7.8" y="7.2" width="3.1" height="9.6" rx="1" fill="#e5b85c" stroke="#fef3c7" stroke-width="0.95"/>
      <rect x="13.1" y="7.2" width="3.1" height="9.6" rx="1" fill="#e5b85c" stroke="#fef3c7" stroke-width="0.95"/>`;
  } else if (kind === 'play') {
    // Sculpted Gothic Play Arrowhead
    inner = `
      <path d="M7.2 4.6 L19.6 12 L7.2 19.4 L9.8 12 Z" fill="#fde093" stroke="#fffbeb" stroke-width="1.3" stroke-linejoin="round"/>`;
  } else {
    // camp / exit to main menu (Gothic Archway & Hearth Torch)
    inner = `
      <path d="M5 20.2 V11.4 C5 7.2 8.2 4.2 12 3 C15.8 4.2 19 7.2 19 11.4 V20.2 Z" fill="#3a1220" stroke="#fde093" stroke-width="1.45" stroke-linejoin="round"/>
      <path d="M8.8 20.2 V13.6 C8.8 11.4 10.2 9.8 12 9.2 C13.8 9.8 15.2 11.4 15.2 13.6 V20.2" fill="#1a0912" stroke="#fca5a5" stroke-width="1.15"/>
      <polygon points="12,12 13.4,14.6 12,16.8 10.6,14.6" fill="#fde047"/>
      <path d="M3.4 20.2 H20.6" stroke="#fde093" stroke-width="1.6" stroke-linecap="round"/>`;
  }
  return makeSvgNode(
    `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`,
    extraClass
  );
}

export function setModalButtonContent(btn, iconKind, labelText) {
  btn.innerHTML = '';
  btn.append(createModalIconSvg(iconKind), el('span', 'result-btn-label', labelText));
}

export function createMandalaSvg() {
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

export function createRuneHaloSvg() {
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

      // ==================== STAGE 2 SYNERGY PERKS ====================
      case 'dash_fire_trail': // Огненный След — Blazing Winged Dash Leaving Flame Wake
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.56"/><stop offset="100%" stop-color="#431407" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M14 58 Q28 50 38 42 M12 46 Q24 41 34 36 M18 68 Q34 60 46 50" stroke="#fb923c" stroke-width="3.2" stroke-linecap="round"/>
          <path d="M46 18 C52 28 66 32 66 47 C66 59 56 68 45 68 C35 68 28 60 28 50 C28 40 36 33 41 25 C43 22 44 19 46 18 Z" fill="#ea580c" stroke="#fef08a" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M47 33 C51 40 57 44 57 52 C57 58 52 62 46 62 C41 62 37 58 37 52 C37 46 43 41 47 33 Z" fill="#fde047"/>`;
        break;

      case 'shield_thorns_wave': // Волна Шипов — Spiked Gothic Shield Radiating Crimson-Gold Shockwave
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e5b85c" stop-opacity="0.5"/><stop offset="100%" stop-color="#1e1b4b" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <circle cx="44" cy="44" r="30" stroke="#fbbf24" stroke-width="1.6" stroke-dasharray="5 4"/>
          <polygon points="44,8 48,18 40,18" fill="#fde047"/><polygon points="44,80 48,70 40,70" fill="#fde047"/>
          <polygon points="8,44 18,40 18,48" fill="#fde047"/><polygon points="80,44 70,40 70,48" fill="#fde047"/>
          <path d="M44 21 L61 28 V44 C61 55 53 63 44 68 C35 63 27 55 27 44 V28 L44 21 Z" fill="#334155" stroke="#fef3c7" stroke-width="1.9"/>
          <polygon points="44,33 50,44 44,55 38,44" fill="#ef4444" stroke="#fde047" stroke-width="1.2"/>`;
        break;

      case 'crit_chain_lightning': // Цепная Молния Крита — Forking Cyan-Gold Arc Bolt
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.56"/><stop offset="100%" stop-color="#082f49" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polygon points="48,12 24,46 42,46 36,76 64,39 46,39" fill="#38bdf8" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
          <polyline points="22,26 34,34 26,42" fill="none" stroke="#fde047" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="66,54 54,60 64,68" fill="none" stroke="#fde047" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;

      case 'vampiric_harvest': // Кровавая Жатва — Crimson Chalice & Rising Vitality Orb
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#dc2626" stop-opacity="0.56"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M44 14 C44 14 55 27 55 34 C55 40 50 45 44 45 C38 45 33 40 33 34 C33 27 44 14 44 14 Z" fill="#ef4444" stroke="#fecaca" stroke-width="1.6"/>
          <path d="M26 46 H62 L55 60 C53 64 49 66 44 66 C39 66 35 64 33 60 Z" fill="#7f1d1d" stroke="#fde093" stroke-width="1.7" stroke-linejoin="round"/>
          <path d="M44 66 V74 M34 74 H54" stroke="#fde093" stroke-width="2.6" stroke-linecap="round"/>`;
        break;

      case 'rapid_cadence': // Вихревой Темп — Twin Emerald-Gold Chrono Blades & Speed Arcs
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#10b981" stop-opacity="0.52"/><stop offset="100%" stop-color="#064e3b" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M18 30 A28 28 0 0 1 66 26" fill="none" stroke="#6ee7b7" stroke-width="3.2" stroke-linecap="round"/>
          <path d="M70 58 A28 28 0 0 1 22 62" fill="none" stroke="#fde093" stroke-width="3.2" stroke-linecap="round"/>
          <polygon points="32,26 58,44 32,62 39,44" fill="#34d399" stroke="#ecfdf5" stroke-width="1.6" stroke-linejoin="round"/>
          <polygon points="48,30 68,44 48,58 53,44" fill="#fde093" stroke="#fffbeb" stroke-width="1.4" stroke-linejoin="round"/>`;
        break;

      case 'frost_shatter': // Ледяной Раскол — Crystalline Ice Starburst Shattering Shards
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.56"/><stop offset="100%" stop-color="#0c4a6e" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <polygon points="44,12 52,32 72,28 56,44 72,60 52,56 44,76 36,56 16,60 32,44 16,28 36,32" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.7" stroke-linejoin="round"/>
          <polygon points="44,26 51,44 44,62 37,44" fill="#f0f9ff"/>
          <circle cx="22" cy="18" r="2.6" fill="#bae6fd"/><circle cx="67" cy="20" r="2.4" fill="#bae6fd"/>
          <circle cx="66" cy="69" r="2.6" fill="#bae6fd"/>`;
        break;

      case 'executioner_cleave': // Удар Палача — Wide Crimson-Gold Execution Crescent Slash
        defs = `<radialGradient id="${u}_rg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ef4444" stop-opacity="0.54"/><stop offset="100%" stop-color="#450a0a" stop-opacity="0"/></radialGradient>`;
        art = `
          <circle cx="44" cy="44" r="36" fill="url(#${u}_rg)"/>
          <path d="M16 58 C24 22 58 14 74 36 C56 26 32 34 24 62 Z" fill="#fde047" stroke="#fffbeb" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M22 68 L62 24" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>
          <path d="M44 26 L68 38 C64 52 52 60 38 58 Z" fill="#dc2626" stroke="#fecaca" stroke-width="1.6" stroke-linejoin="round"/>`;
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
