// AAA Gothic Dark-Fantasy UI Manager:
// - 4-Tab Hub (⚔️ Герои, 🗺️ Поход 25 Глав, 🗡️ Арсенал 1..12, 🧪 Мастерская классов)
// - HD Character Portraits, 10-Segment RPG Crystal Rune Bars & Custom Vector Weapon Art
// - Illustrated 25-Chapter Campaign Showcase (5 Acts × 5 Chapters)
// - Animated "Благословение Душ" Tarot / Relic Altar Cards (100% Custom SVG, Zero Emojis)
// - Combat HUD with Brass Shotgun Shell / Mana Pips, Golden Reload Bar, [R] Button & Perk Mini-Badges
// - Single Floating Bottom-Left iPhone / Mobile Virtual Joystick with Auto-Aim

import {
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
} from './config.js?v=20261120z35';
import { attachSeamlessLoop } from './ambientVideo.js?v=20261117z25';
import {
  CLASS_ORDER,
  CLASS_META,
  ACT_DEFS,
  TIER_ROMAN,
  RANK_ROMAN,
  formatTimeMMSS,
  el,
  hexNumToCss,
  resolveMaxWeaponShopLevel,
  resolveWeaponUnlocked,
  resolveWeaponShopLevel,
  resolveWeaponUpgradeCost,
  resolveMasteryList,
  normalizeActivePerks
} from './ui/resolvers.js?v=20261120z35';
import {
  makeSvgNode,
  createWeaponSvg,
  createStatRuneSvg,
  createTalentRuneSvg,
  createBlessingRelicSvg
} from './ui/svgIcons.js?v=20261120z35';
import { createModalsController } from './ui/modals.js?v=20261120z35';

// Backward-compatible facade re-exports (Wave 1/2 modularization)
export { createWeaponSvg, createBlessingRelicSvg } from './ui/svgIcons.js?v=20261120z35';

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

  // Compact Gothic Endless Mode Wave & Survival Timer Badge (always visible in Endless even during bosses!)
  const hudEndlessBadge = el('div', 'hud-endless-badge hidden');
  const hudEndlessIcon = makeSvgNode(
    `<svg viewBox="0 0 22 22" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-endless-svg" aria-hidden="true">
      <path d="M6.8 14.5 C4.2 14.5 2.5 12.9 2.5 11 C2.5 9.1 4.2 7.5 6.8 7.5 C9.4 7.5 12.6 14.5 15.2 14.5 C17.8 14.5 19.5 12.9 19.5 11 C19.5 9.1 17.8 7.5 15.2 7.5 C12.6 7.5 9.4 14.5 6.8 14.5 Z" stroke="#fde093" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  );
  const hudEndlessText = el('span', 'hud-endless-text', 'Волна 1 • 00:00');
  hudEndlessBadge.append(hudEndlessIcon, hudEndlessText);

  const bossBarBox = el('div', 'boss-bar-box hidden');
  const bossBarHeader = el('div', 'boss-bar-header');
  const bossBarName = el('span', 'boss-bar-name', 'КОСТЯНОЙ МЯСНИК');
  const bossHpNumbers = el('span', 'boss-hp-numbers', '920 / 920');
  bossBarHeader.append(bossBarName, bossHpNumbers);
  const bossBarFrame = el('div', 'boss-bar-frame');
  const bossBarFill = el('div', 'boss-bar-fill');
  bossBarFrame.appendChild(bossBarFill);
  const bossStaggerWrap = el('div', 'boss-stagger-wrap hidden');
  const bossStaggerRow = el('div', 'boss-stagger-row');
  const bossStaggerTrack = el('div', 'boss-stagger-track');
  const bossStaggerFill = el('div', 'boss-stagger-fill');
  bossStaggerTrack.appendChild(bossStaggerFill);
  const bossStaggerBadge = el('span', 'boss-stagger-badge', 'ОГЛУШЕНИЕ');
  bossStaggerRow.append(bossStaggerTrack, bossStaggerBadge);
  bossStaggerWrap.appendChild(bossStaggerRow);
  bossBarBox.append(bossBarHeader, bossBarFrame, bossStaggerWrap);

  const relicHintPill = el('div', 'relic-hint-pill hidden');
  const relicCompass = el('span', 'relic-compass');
  const relicArrow = el('span', 'relic-arrow', '↑');
  relicCompass.appendChild(relicArrow);
  const relicHintText = el('span', 'relic-hint-text', 'Рунный Сундук с новым оружием!');
  const relicDistBadge = el('span', 'relic-dist-badge', '15м');
  relicHintPill.append(relicCompass, relicHintText, relicDistBadge);

  hudTopCenter.append(hudEndlessBadge, waveBox, bossBarBox, relicHintPill);

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

  // Combat option toggles live cleanly inside the Pause modal (Q / E hotkeys remain active in combat!)
  const makePauseToggleBtn = (svgMarkup, defaultLabel) => {
    const btn = el('button', 'pause-toggle-row is-on');
    btn.type = 'button';
    const left = el('span', 'pause-toggle-left');
    left.appendChild(makeSvgNode(svgMarkup, 'pause-toggle-svg'));
    const labelEl = el('span', 'pause-toggle-label', defaultLabel);
    left.appendChild(labelEl);
    const pillEl = el('span', 'pause-toggle-pill', 'ВКЛ');
    btn.append(left, pillEl);
    return { btn, labelEl, pillEl };
  };

  const autoAimToggle = makePauseToggleBtn(
    `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="10" cy="10" r="6.8" stroke="#fde093" stroke-width="1.4"/><circle cx="10" cy="10" r="2.1" fill="#fde093"/><path d="M10 1.8 V5.2 M10 14.8 V18.2 M1.8 10 H5.2 M14.8 10 H18.2" stroke="#fde093" stroke-width="1.35" stroke-linecap="round"/></svg>`,
    'Автоприцел [Q]'
  );
  const autoAimBtn = autoAimToggle.btn;

  const attackToggle = makePauseToggleBtn(
    `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4.2 15.8 L14.6 4.4 L16.8 3.2 L15.6 5.4 L5.2 15.8 Z" fill="#e2e8f0" stroke="#f8fafc" stroke-width="0.9" stroke-linejoin="round"/><path d="M15.8 15.8 L5.4 4.4 L3.2 3.2 L4.4 5.4 L14.8 15.8 Z" fill="#cbd5e1" stroke="#f8fafc" stroke-width="0.9" stroke-linejoin="round"/><path d="M3.6 12.6 L7.4 16.4 M16.4 12.6 L12.6 16.4" stroke="#fde093" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    'Атака [E]'
  );
  const attackToggleBtn = attackToggle.btn;

  const touchPreviewToggle = makePauseToggleBtn(
    `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="10" cy="10" r="7.2" stroke="#fde093" stroke-width="1.4" stroke-dasharray="3 2"/><circle cx="10" cy="10" r="3.1" fill="#e5b85c"/></svg>`,
    'Плавающий джойстик'
  );
  const touchPreviewBtn = touchPreviewToggle.btn;
  touchPreviewBtn.classList.remove('is-on');
  touchPreviewBtn.title = 'Плавающий джойстик и кнопка рывка (Вкл/Выкл)';

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

  hudActionsRow.append(hudMuteBtn, hudHomeBtn);
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

  // Right-Thumb Gothic Touch Dash Button (shown alongside floating joystick on touch devices / preview)
  const TOUCH_DASH_RING_CIRC = 207.35; // 2 * PI * 33
  const touchDashBtn = el('button', 'touch-dash-btn is-ready');
  touchDashBtn.type = 'button';
  touchDashBtn.setAttribute('aria-label', 'Рывок');
  const touchDashRingSvg = makeSvgNode(
    `<svg viewBox="0 0 76 76" width="76" height="76" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-dash-ring-svg" aria-hidden="true">
      <circle cx="38" cy="38" r="33" class="touch-dash-ring-track"/>
      <circle cx="38" cy="38" r="33" class="touch-dash-ring-fill" stroke-dasharray="${TOUCH_DASH_RING_CIRC}" stroke-dashoffset="0"/>
    </svg>`
  );
  const touchDashRingFill = touchDashRingSvg.querySelector('.touch-dash-ring-fill');
  const touchDashIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-dash-svg" aria-hidden="true">
      <path d="M3.5 9.2 H11.5 M2.2 13 H9.5 M4.8 16.8 H10.8" stroke="#99f6e4" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10.5 5.2 L20.8 12 L10.5 18.8 L13.4 12 Z" fill="#fde093" stroke="#fffbeb" stroke-width="1.25" stroke-linejoin="round"/>
    </svg>`
  );
  const touchDashLabel = el('span', 'touch-dash-label', 'РЫВОК');
  touchDashBtn.append(touchDashRingSvg, touchDashIcon, touchDashLabel);

  // Right-Thumb Round Gothic Touch Ult Button (Ярость Зверя [F])
  const TOUCH_ULT_RING_CIRC = 194.78; // 2 * PI * 31
  const touchUltBtn = el('button', 'touch-ult-btn is-charging');
  touchUltBtn.type = 'button';
  touchUltBtn.setAttribute('aria-label', 'Ярость Зверя');
  const touchUltRingSvg = makeSvgNode(
    `<svg viewBox="0 0 72 72" width="72" height="72" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-ult-ring-svg" aria-hidden="true">
      <circle cx="36" cy="36" r="31" class="touch-ult-ring-track"/>
      <circle cx="36" cy="36" r="31" class="touch-ult-ring-fill" stroke-dasharray="${TOUCH_ULT_RING_CIRC}" stroke-dashoffset="${TOUCH_ULT_RING_CIRC}"/>
    </svg>`
  );
  const touchUltRingFill = touchUltRingSvg.querySelector('.touch-ult-ring-fill');
  const touchUltIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-ult-svg" aria-hidden="true">
      <path d="M5.5 11 C2.6 8.2 3 4.2 6.2 2.8 C5.6 5.8 7 7.8 9.6 8.8 Z" fill="#f59e0b" stroke="#fde093" stroke-width="0.9"/>
      <path d="M18.5 11 C21.4 8.2 21 4.2 17.8 2.8 C18.4 5.8 17 7.8 14.4 8.8 Z" fill="#f59e0b" stroke="#fde093" stroke-width="0.9"/>
      <path d="M12 5.2 C8.2 5.2 6 8.2 6 12 C6 14.8 7.5 16.8 9 18 L10 21 H14 L15 18 C16.5 16.8 18 14.8 18 12 C18 8.2 15.8 5.2 12 5.2 Z" fill="#b91c1c" stroke="#fde093" stroke-width="1.35" stroke-linejoin="round"/>
      <polygon points="8.6,12.2 11.1,13 10.4,14.6 8.8,14" fill="#fef08a"/>
      <polygon points="15.4,12.2 12.9,13 13.6,14.6 15.2,14" fill="#fef08a"/>
    </svg>`
  );
  const touchUltLabel = el('span', 'touch-ult-label', '0/5');
  touchUltBtn.append(touchUltRingSvg, touchUltIcon, touchUltLabel);

  touchLayer.append(leftZone, leftBase, touchUltBtn, touchDashBtn);

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

  // Compact Gothic Dash [Space] Cooldown Indicator & Button right next to Weapon Bar
  const HUD_DASH_RING_CIRC = 87.96; // 2 * PI * 14
  const hudDashBtn = el('button', 'hud-dash-btn is-ready');
  hudDashBtn.type = 'button';
  hudDashBtn.title = 'Рывок с неуязвимостью [Space]';
  const hudDashRingWrap = el('span', 'hud-dash-ring-wrap');
  const hudDashRingSvg = makeSvgNode(
    `<svg viewBox="0 0 34 34" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-dash-ring-svg" aria-hidden="true">
      <circle cx="17" cy="17" r="14" class="hud-dash-ring-track"/>
      <circle cx="17" cy="17" r="14" class="hud-dash-ring-fill" stroke-dasharray="${HUD_DASH_RING_CIRC}" stroke-dashoffset="0"/>
    </svg>`
  );
  const hudDashRingFill = hudDashRingSvg.querySelector('.hud-dash-ring-fill');
  const hudDashIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-dash-icon-svg" aria-hidden="true">
      <path d="M3.5 9.2 H11.2 M2.4 13 H9.4 M5 16.8 H10.6" stroke="#99f6e4" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10.4 5.2 L20.6 12 L10.4 18.8 L13.3 12 Z" fill="#fde093" stroke="#fffbeb" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`
  );
  hudDashRingWrap.append(hudDashRingSvg, hudDashIcon);
  const hudDashMeta = el('span', 'hud-dash-meta');
  const hudDashStateText = el('span', 'hud-dash-state', 'РЫВОК');
  const hudDashKeyTag = el('span', 'hud-dash-key', '[Space]');
  hudDashMeta.append(hudDashStateText, hudDashKeyTag);
  const hudDashBarTrack = el('span', 'hud-dash-bar-track');
  const hudDashBarFill = el('span', 'hud-dash-bar-fill');
  hudDashBarTrack.appendChild(hudDashBarFill);
  hudDashBtn.append(hudDashRingWrap, hudDashMeta, hudDashBarTrack);

  // Compact Gothic Beast Rage Ult [F] Indicator & Button right next to Dash
  const HUD_ULT_RING_CIRC = 87.96; // 2 * PI * 14
  const hudUltBtn = el('button', 'hud-ult-btn is-charging');
  hudUltBtn.type = 'button';
  hudUltBtn.title = 'Ярость Зверя [F] — активируется при 5/5 печатях';
  const hudUltRingWrap = el('span', 'hud-ult-ring-wrap');
  const hudUltRingSvg = makeSvgNode(
    `<svg viewBox="0 0 34 34" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-ult-ring-svg" aria-hidden="true">
      <circle cx="17" cy="17" r="14" class="hud-ult-ring-track"/>
      <circle cx="17" cy="17" r="14" class="hud-ult-ring-fill" stroke-dasharray="${HUD_ULT_RING_CIRC}" stroke-dashoffset="${HUD_ULT_RING_CIRC}"/>
    </svg>`
  );
  const hudUltRingFill = hudUltRingSvg.querySelector('.hud-ult-ring-fill');
  const hudUltIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-ult-icon-svg" aria-hidden="true">
      <path d="M5.5 11 C2.6 8.2 3 4.2 6.2 2.8 C5.6 5.8 7 7.8 9.6 8.8 Z" fill="#f59e0b" stroke="#fde093" stroke-width="0.9"/>
      <path d="M18.5 11 C21.4 8.2 21 4.2 17.8 2.8 C18.4 5.8 17 7.8 14.4 8.8 Z" fill="#f59e0b" stroke="#fde093" stroke-width="0.9"/>
      <path d="M12 5.2 C8.2 5.2 6 8.2 6 12 C6 14.8 7.5 16.8 9 18 L10 21 H14 L15 18 C16.5 16.8 18 14.8 18 12 C18 8.2 15.8 5.2 12 5.2 Z" fill="#b91c1c" stroke="#fde093" stroke-width="1.35" stroke-linejoin="round"/>
      <polygon points="8.6,12.2 11.1,13 10.4,14.6 8.8,14" fill="#fef08a"/>
      <polygon points="15.4,12.2 12.9,13 13.6,14.6 15.2,14" fill="#fef08a"/>
    </svg>`
  );
  hudUltRingWrap.append(hudUltRingSvg, hudUltIcon);
  const hudUltMeta = el('span', 'hud-ult-meta');
  const hudUltStateText = el('span', 'hud-ult-state', 'ЗВЕРЬ 0/5');
  const hudUltKeyTag = el('span', 'hud-ult-key', '[F]');
  hudUltMeta.append(hudUltStateText, hudUltKeyTag);
  const hudUltBarTrack = el('span', 'hud-ult-bar-track');
  const hudUltBarFill = el('span', 'hud-ult-bar-fill');
  hudUltBarFill.style.transform = 'scaleX(0)';
  hudUltBarTrack.appendChild(hudUltBarFill);
  hudUltBtn.append(hudUltRingWrap, hudUltMeta, hudUltBarTrack);

  // Warrior 3-Hit Melee Combo Pop-Up Badge (shown on comboStep >= 2)
  const hudComboBadge = el('div', 'hud-combo-badge hidden');
  const hudComboHead = el('div', 'hud-combo-head');
  const hudComboIcon = makeSvgNode(
    `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-combo-svg" aria-hidden="true">
      <path d="M10 1.8 L12.2 7.8 L18.2 10 L12.2 12.2 L10 18.2 L7.8 12.2 L1.8 10 L7.8 7.8 Z" fill="#f59e0b" stroke="#fef9c3" stroke-width="1.15" stroke-linejoin="round"/>
      <circle cx="10" cy="10" r="2.1" fill="#fffbeb"/>
    </svg>`
  );
  const hudComboText = el('span', 'hud-combo-text', 'КОМБО ×2');
  hudComboHead.append(hudComboIcon, hudComboText);
  const hudComboBarTrack = el('span', 'hud-combo-bar-track');
  const hudComboBarFill = el('span', 'hud-combo-bar-fill');
  hudComboBarTrack.appendChild(hudComboBarFill);
  hudComboBadge.append(hudComboHead, hudComboBarTrack);

  hudWeaponRow.append(weaponHudBadge, hudReloadBtn, hudDashBtn, hudUltBtn, hudComboBadge);

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
  // 3b. Chapter-1 Non-Blocking 20s Onboarding Pill (auto-advances on player actions + Skip)
  const onboardingBar = el('div', 'hud-onboarding-bar hidden');
  const onboardingRow = el('div', 'hud-onboarding-row');
  const onboardingDotsWrap = el('div', 'hud-onboarding-dots');
  const onboardingDots = [0, 1, 2].map(() => {
    const d = el('span', 'hud-onboarding-dot');
    onboardingDotsWrap.appendChild(d);
    return d;
  });
  const onboardingText = el('span', 'hud-onboarding-text', '');
  const onboardingSkipBtn = el('button', 'hud-onboarding-skip', 'Пропустить');
  onboardingSkipBtn.type = 'button';
  onboardingRow.append(onboardingDotsWrap, onboardingText, onboardingSkipBtn);
  const onboardingTimerTrack = el('div', 'hud-onboarding-timer-track');
  const onboardingTimerFill = el('div', 'hud-onboarding-timer-fill');
  onboardingTimerTrack.appendChild(onboardingTimerFill);
  onboardingBar.append(onboardingRow, onboardingTimerTrack);

  hudScreen.append(hudTopRow, touchLayer, onboardingBar, hudBottomDock);
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
    aimActive: false,
    dash: false,
    ult: false
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
    let returnTimer = null;

    const mapPt = (cx, cy) =>
      window.__toGameCoords ? window.__toGameCoords(cx, cy) : { x: cx, y: cy };

    const getVpSize = () => {
      const vp = window.__getGameViewportSize?.();
      return {
        w: vp?.width || window.innerWidth || 960,
        h: vp?.height || window.innerHeight || 540
      };
    };

    const placeBaseAtFinger = (rawClientX, rawClientY) => {
      if (returnTimer) {
        clearTimeout(returnTimer);
        returnTimer = null;
      }
      baseEl.classList.remove('is-returning');
      const pt = mapPt(rawClientX, rawClientY);
      const { w, h } = getVpSize();
      const clampedX = Math.max(58, Math.min(w * 0.50, pt.x));
      const clampedY = Math.max(80, Math.min(h - 58, pt.y));
      originX = clampedX;
      originY = clampedY;
      baseEl.style.left = `${Math.round(clampedX)}px`;
      baseEl.style.top = `${Math.round(clampedY)}px`;
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

    const releaseStick = (instant = false) => {
      const wasEngaged = activePointerId !== null || activeTouchId !== null || baseEl.classList.contains('is-active');
      activePointerId = null;
      activeTouchId = null;
      knobEl.style.transform = 'translate3d(0, 0, 0)';
      touchState.moveX = 0;
      touchState.moveZ = 0;
      touchState.moveActive = false;
      touchState.active = false;
      baseEl.classList.remove('is-active');

      if (returnTimer) {
        clearTimeout(returnTimer);
        returnTimer = null;
      }

      if (instant || !wasEngaged) {
        baseEl.classList.remove('is-returning');
        baseEl.style.left = '';
        baseEl.style.top = '';
        baseEl.style.bottom = '';
        baseEl.style.transform = '';
        return;
      }

      // Smoothly glide floating stick base back to resting bottom-left home position
      const { h } = getVpSize();
      const homeLeft = 88;
      const homeTop = Math.max(88, h - 152);
      baseEl.classList.add('is-returning');
      baseEl.style.left = `${Math.round(homeLeft)}px`;
      baseEl.style.top = `${Math.round(homeTop)}px`;
      baseEl.style.bottom = 'auto';
      baseEl.style.transform = 'translate3d(-50%, -50%, 0)';
      returnTimer = setTimeout(() => {
        returnTimer = null;
        if (activePointerId === null && activeTouchId === null) {
          baseEl.classList.remove('is-returning');
          baseEl.style.left = '';
          baseEl.style.top = '';
          baseEl.style.bottom = '';
          baseEl.style.transform = '';
        }
      }, 210);
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
            releaseStick(false);
            break;
          }
        }
      }
    };
    zoneEl.addEventListener('touchend', onTouchEndFallback);
    zoneEl.addEventListener('touchcancel', onTouchEndFallback);

    // Primary PointerEvents handler (iOS 13+ Safari, Android Chrome, Desktop Preview)
    zoneEl.addEventListener('pointerdown', (e) => {
      if (hudScreen.classList.contains('hidden')) return;
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
      try {
        if (zoneEl.hasPointerCapture?.(e.pointerId)) {
          zoneEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      releaseStick(false);
    };

    zoneEl.addEventListener('pointerup', onPointerEnd);
    zoneEl.addEventListener('pointercancel', onPointerEnd);
    zoneEl.addEventListener('lostpointercapture', () => {
      if (activePointerId !== null) releaseStick(false);
    });

    window.addEventListener('blur', () => {
      if (activePointerId !== null || activeTouchId !== null) {
        releaseStick(true);
      }
      touchState.dash = false;
      touchState.ult = false;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (activePointerId !== null || activeTouchId !== null)) {
        releaseStick(true);
        touchState.dash = false;
        touchState.ult = false;
      }
    });

    return () => releaseStick(true);
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
    const next = touchLayer.classList.contains('hidden');
    touchPreviewEnabled = next;
    if (next) {
      touchLayer.classList.remove('hidden');
      ensureAutoAimForTouch();
    } else {
      touchLayer.classList.add('hidden');
      releaseLeftStick();
      touchState.dash = false;
      touchState.ult = false;
    }
    syncTouchPreviewButton();
  });

  const triggerDashInput = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (hudScreen.classList.contains('hidden')) return;
    touchState.dash = true;
    touchDashBtn.classList.add('is-pressed');
    setTimeout(() => touchDashBtn.classList.remove('is-pressed'), 130);
  };
  touchDashBtn.addEventListener('pointerdown', triggerDashInput);
  touchDashBtn.addEventListener(
    'touchstart',
    (e) => {
      if (!window.PointerEvent) triggerDashInput(e);
      else e.stopPropagation();
    },
    { passive: false }
  );
  hudDashBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden')) return;
    touchState.dash = true;
  });

  const triggerUltInput = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (hudScreen.classList.contains('hidden')) return;
    touchState.ult = true;
    touchUltBtn.classList.add('is-pressed');
    setTimeout(() => touchUltBtn.classList.remove('is-pressed'), 140);
  };
  touchUltBtn.addEventListener('pointerdown', triggerUltInput);
  touchUltBtn.addEventListener(
    'touchstart',
    (e) => {
      if (!window.PointerEvent) triggerUltInput(e);
      else e.stopPropagation();
    },
    { passive: false }
  );
  hudUltBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden')) return;
    touchState.ult = true;
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

  const hubQuestsBtn = el('button', 'hub-quests-btn');
  hubQuestsBtn.type = 'button';
  hubQuestsBtn.title = 'Ежедневные задания';
  hubQuestsBtn.setAttribute('aria-label', 'Ежедневные задания');
  const hubQuestsIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" class="hub-quests-svg" aria-hidden="true">
      <path d="M6.2 3.8 H18.2 C19.3 3.8 20.1 4.6 20.1 5.6 V7.2 H18 V17.2 C18 18.8 16.8 20 15.2 20 H5.4 C4.3 20 3.6 19.2 3.6 18.2 V16.4 H5.8 V6.4 C5.8 5 5.9 3.8 6.2 3.8 Z" fill="#2d1d46" stroke="#fde093" stroke-width="1.45" stroke-linejoin="round"/>
      <path d="M8.4 9.5 H15.4 M8.4 12.6 H14.2 M8.4 15.7 H12.6" stroke="#f5d996" stroke-width="1.35" stroke-linecap="round"/>
    </svg>`
  );
  const hubQuestsLabel = el('span', 'hub-quests-btn-label', 'Задания');
  const hubQuestsDot = el('span', 'hub-quests-dot hidden');
  hubQuestsBtn.append(hubQuestsIcon, hubQuestsLabel, hubQuestsDot);

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
  hubTreasury.append(hubQuestsBtn, treasuryGoldPill, hubMuteBtn);
  hubHeader.append(hubProfilePlaque, hubTreasury);

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

  // Endless Horde Survival CTA Button right below Campaign Launch with Personal Record
  const homeEndlessBtn = el('button', 'home-endless-btn');
  homeEndlessBtn.type = 'button';
  const homeEndlessTop = el('span', 'home-endless-top');
  homeEndlessTop.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 22 22" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" class="home-endless-svg" aria-hidden="true">
        <path d="M6.8 14.5 C4.2 14.5 2.5 12.9 2.5 11 C2.5 9.1 4.2 7.5 6.8 7.5 C9.4 7.5 12.6 14.5 15.2 14.5 C17.8 14.5 19.5 12.9 19.5 11 C19.5 9.1 17.8 7.5 15.2 7.5 C12.6 7.5 9.4 14.5 6.8 14.5 Z" stroke="#fde093" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    )
  );
  const homeEndlessLabel = el('span', 'home-endless-label', 'БЕСКОНЕЧНАЯ ОРДА');
  homeEndlessTop.appendChild(homeEndlessLabel);
  const homeEndlessRecord = el('span', 'home-endless-record', 'Выживание • Таблица лидеров');
  homeEndlessBtn.append(homeEndlessTop, homeEndlessRecord);

  homeCtaStack.append(homeWeaponWarn, homeJourneyBtn, homeEndlessBtn);
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
  stagePrevImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z25';
  stagePrevImg.alt = '';
  stagePrevImg.draggable = false;
  stagePrevBtn.appendChild(stagePrevImg);

  const stageCenterSpacer = el('div', 'stage-center-window');

  const stageNextBtn = el('button', 'stage-carousel-btn next');
  stageNextBtn.type = 'button';
  stageNextBtn.setAttribute('aria-label', 'Следующий класс');
  const stageNextImg = document.createElement('img');
  stageNextImg.className = 'switch-arrow-icon is-next';
  stageNextImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z25';
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
  campaignWorldBg.src = './assets/ui/world_map_loop.mp4?v=20261117z25';
  campaignWorldBg.poster = './assets/ui/world_map_clean_hq.jpg?v=20261117z25';
  campaignWorldBg.autoplay = true;
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
  const worldMapVideoLoop = attachSeamlessLoop(campaignWorldBg, { fadeSec: 1.1 });
  campaignWorldView.append(worldTopBar, worldStageFrame);

  // --- SCENE 3: MISTY FOREST 25-STAGE WINDING PATH MAP (Animated Video Scene + 25 Stone Tile Nodes!) ---
  const campaignForestView = el('div', 'campaign-forest-view hidden');
  const forestStageFrame = el('div', 'campaign-map-stage-frame is-forest-frame');
  const forestBgImg = document.createElement('video');
  forestBgImg.className = 'campaign-map-bg-img campaign-map-video';
  forestBgImg.src = './assets/ui/forest_stages_loop.mp4?v=20261117z25';
  forestBgImg.poster = './assets/ui/forest_stages_clean_hq.jpg?v=20261117z25';
  forestBgImg.autoplay = true;
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
  const forestMapVideoLoop = attachSeamlessLoop(forestBgImg, { fadeSec: 1.1 });

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
  arsenalPrevImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z25';
  arsenalPrevImg.alt = '';
  arsenalPrevImg.draggable = false;
  arsenalPrevBtn.appendChild(arsenalPrevImg);

  const arsenalStageSpacer = el('div', 'arsenal-stage-spacer');

  const arsenalNextBtn = el('button', 'arsenal-ruby-arrow next');
  arsenalNextBtn.type = 'button';
  arsenalNextBtn.setAttribute('aria-label', 'Следующее оружие');
  const arsenalNextImg = document.createElement('img');
  arsenalNextImg.className = 'switch-arrow-icon is-next';
  arsenalNextImg.src = './assets/ui/btn_arrow_switch.png?v=20261117z25';
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
  // TAB 4: 🌿 ДРЕВО ТАЛАНТОВ (Fullscreen Dark-Fantasy Interactive Pan/Hold Canvas)
  // =========================================================================
  const shopPanel = el('section', 'hub-panel hub-panel-sub talent-fullscreen-panel hidden');
  const shopBox = el('div', 'hub-subpanel-card shop-subpanel talent-fs-shell');

  const shopHeaderRow = el('div', 'subpanel-header-row talent-fs-topbar');
  const shopTitleGroup = el('div', 'subpanel-title-group talent-fs-title-group');
  const talentFsCloseBtn = el('button', 'map-close-x-btn talent-fs-close-btn', '✕');
  talentFsCloseBtn.type = 'button';
  talentFsCloseBtn.setAttribute('aria-label', 'Закрыть древо талантов');
  const masteryHeading = el('h2', 'subpanel-title', '🌿 Древо Талантов');
  const masteryClassBadge = el('div', 'workshop-class-badge');
  const masteryClassBadgeImg = document.createElement('img');
  masteryClassBadgeImg.className = 'workshop-badge-portrait';
  masteryClassBadgeImg.src = CLASSES.warrior.portrait;
  masteryClassBadgeImg.alt = '';
  const masteryClassBadgeText = el('span', '', '⚔️ Древо талантов');
  masteryClassBadge.append(masteryClassBadgeImg, masteryClassBadgeText);
  shopTitleGroup.append(talentFsCloseBtn, masteryHeading, masteryClassBadge);

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

  const talentCamControls = el('div', 'talent-cam-controls');
  const talentZoomOutBtn = el('button', 'gothic-btn talent-cam-btn', '−');
  talentZoomOutBtn.type = 'button';
  const talentZoomLabel = el('span', 'talent-zoom-val', '100%');
  const talentZoomInBtn = el('button', 'gothic-btn talent-cam-btn', '+');
  talentZoomInBtn.type = 'button';
  const talentCenterBtn = el('button', 'gothic-btn talent-cam-btn talent-center-btn', '⌖ Центр');
  talentCenterBtn.type = 'button';
  talentCamControls.append(talentZoomOutBtn, talentZoomLabel, talentZoomInBtn, talentCenterBtn);

  shopHeaderControls.append(talentPointsPill, talentResetBtn, shopClassSwitch, talentCamControls, rewardGoldBtn);
  shopHeaderRow.append(shopTitleGroup, shopHeaderControls);

  const talentControlsHint = el(
    'div',
    'talent-controls-hint',
    '🖱️ ПКМ или фон — двигать карту • Колёсико — масштаб • Удерживайте ЛКМ на иконке (0.5 с) — изучить'
  );

  const masteryGrid = el('div', 'mastery-grid talent-fs-body');
  const selectedTalentByClass = {
    mage: CLASS_TALENT_TREES.mage?.[0]?.id || 'water_pressure',
    warrior: CLASS_TALENT_TREES.warrior?.[0]?.id || 'war_steel_grip',
    gunslinger: CLASS_TALENT_TREES.gunslinger?.[0]?.id || 'gun_quicksilver'
  };
  let selectedMageTalentId = selectedTalentByClass.mage;

  const talentCamState = { x: 0, y: 0, zoom: 1, key: '' };
  let activeHoldCancel = null;

  const shopFooterRow = el('div', 'subpanel-footer-row hidden');
  const shopBackBtn = el('button', 'subpanel-back-btn', '← К герою');
  shopBackBtn.type = 'button';
  const shopQuickPlayBtn = el('button', 'subpanel-battle-btn gothic-plaque-battle-btn', '⚔️ В БОЙ!');
  shopQuickPlayBtn.type = 'button';
  shopFooterRow.append(shopBackBtn, shopQuickPlayBtn);

  talentFsCloseBtn.addEventListener('click', () => setActiveTab('home'));
  shopBox.append(shopHeaderRow, talentControlsHint, masteryGrid, shopFooterRow);
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
    socketImg.src = './assets/ui/dock_crest_socket.png?v=20261117z25';
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
  // 6. BANNERS, DAILY QUESTS DRAWER & MODALS CONTROLLER (js/ui/modals.js)
  // =========================================================================
  const weaponUnlockBanner = el('div', 'weapon-unlock-banner hidden');
  root.appendChild(weaponUnlockBanner);
  let weaponBannerTimer = null;

  const generalToast = el('div', 'general-toast hidden');
  root.appendChild(generalToast);
  let generalToastTimer = null;

  // Hub Daily Quests Gothic Drawer
  const hubQuestsDrawer = el('div', 'hub-quests-drawer hidden');
  const hubQuestsHeader = el('div', 'hub-quests-header');
  const hubQuestsTitle = el('span', 'hub-quests-title', 'Ежедневные задания');
  const hubQuestsCloseBtn = el('button', 'hub-quests-close', '✕');
  hubQuestsCloseBtn.type = 'button';
  hubQuestsCloseBtn.setAttribute('aria-label', 'Закрыть');
  hubQuestsHeader.append(hubQuestsTitle, hubQuestsCloseBtn);
  const hubQuestsList = el('div', 'hub-quests-list');
  hubQuestsDrawer.append(hubQuestsHeader, hubQuestsList);
  root.appendChild(hubQuestsDrawer);

  function closeQuestsDrawer() {
    if (hubQuestsDrawer.classList.contains('hidden')) return;
    hubQuestsDrawer.classList.add('hidden');
    hubQuestsBtn.classList.remove('is-open');
  }

  function positionQuestsDrawer() {
    const rect = hubQuestsBtn.getBoundingClientRect();
    const w = Math.min(320, Math.max(256, window.innerWidth - 20));
    const left = Math.max(10, Math.min(window.innerWidth - w - 10, rect.right - w));
    const top = Math.max(10, Math.min(window.innerHeight - 280, rect.bottom + 8));
    hubQuestsDrawer.style.left = `${Math.round(left)}px`;
    hubQuestsDrawer.style.top = `${Math.round(top)}px`;
  }

  function toggleQuestsDrawer() {
    if (!hubQuestsDrawer.classList.contains('hidden')) {
      closeQuestsDrawer();
      return;
    }
    closeSoundPopover();
    hubQuestsDrawer.classList.remove('hidden');
    hubQuestsBtn.classList.add('is-open');
    positionQuestsDrawer();
  }

  hubQuestsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleQuestsDrawer();
  });
  hubQuestsCloseBtn.addEventListener('click', closeQuestsDrawer);
  window.addEventListener('pointerdown', (e) => {
    if (hubQuestsDrawer.classList.contains('hidden')) return;
    const t = e.target;
    if (hubQuestsDrawer.contains(t) || hubQuestsBtn.contains(t)) return;
    closeQuestsDrawer();
  });
  window.addEventListener('resize', () => {
    if (!hubQuestsDrawer.classList.contains('hidden')) positionQuestsDrawer();
  });

  function renderDailyQuests(questsRaw) {
    const isEn = lang === 'en';
    hubQuestsTitle.textContent = isEn ? 'Daily Quests' : 'Ежедневные задания';
    hubQuestsLabel.textContent = isEn ? 'Quests' : 'Задания';
    const list = Array.isArray(questsRaw) ? questsRaw : [];
    hubQuestsList.innerHTML = '';
    let hasClaimable = false;
    if (list.length === 0) {
      hubQuestsList.appendChild(el('div', 'hub-quests-empty', isEn ? 'New contracts arrive daily.' : 'Новые контракты обновляются каждый день.'));
      hubQuestsDot.classList.add('hidden');
      return;
    }
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!q) continue;
      const target = Math.max(1, Math.floor(Number(q.target) || 1));
      const prog = Math.max(0, Math.min(target, Math.floor(Number(q.progress) || 0)));
      const reward = Math.max(0, Math.floor(Number(q.rewardGold) || 0));
      const claimed = Boolean(q.claimed);
      const canClaim = !claimed && prog >= target;
      if (canClaim) hasClaimable = true;

      const item = el('div', `hub-quest-item${claimed ? ' is-claimed' : canClaim ? ' is-ready' : ''}`);
      const topRow = el('div', 'hub-quest-top');
      const titleEl = el('span', 'hub-quest-name', (isEn ? q.titleEn : q.titleRu) || q.titleRu || q.id || 'Задание');
      const fracEl = el('span', 'hub-quest-frac', `${prog} / ${target}`);
      topRow.append(titleEl, fracEl);

      const barTrack = el('div', 'hub-quest-bar-track');
      const barFill = el('div', 'hub-quest-bar-fill');
      barFill.style.transform = `scaleX(${(prog / target).toFixed(3)})`;
      barTrack.appendChild(barFill);

      const footRow = el('div', 'hub-quest-foot');
      if (claimed) {
        footRow.appendChild(el('span', 'hub-quest-claimed-tag', isEn ? 'Claimed ✓' : 'Получено ✓'));
      } else if (canClaim) {
        const claimBtn = el('button', 'hub-quest-claim-btn', isEn ? `Claim +${reward}g` : `Забрать +${reward} зол.`);
        claimBtn.type = 'button';
        claimBtn.addEventListener('click', () => {
          claimBtn.disabled = true;
          callbacks.onClaimDailyQuest?.(q.id);
        });
        footRow.appendChild(claimBtn);
      } else {
        footRow.appendChild(el('span', 'hub-quest-reward-tag', isEn ? `Reward: +${reward}g` : `Награда: +${reward} зол.`));
      }
      item.append(topRow, barTrack, footRow);
      hubQuestsList.appendChild(item);
    }
    hubQuestsDot.classList.toggle('hidden', !hasClaimable);
  }

  const modals = createModalsController({
    root,
    hubMuteBtn,
    hudMuteBtn,
    hubResetBtn,
    autoAimBtn,
    attackToggleBtn,
    touchPreviewBtn,
    getLang: () => lang,
    getCallbacks: () => callbacks,
    getHudSoulLevel: () => hudCache.soulLevel,
    getCurrentEquippedWeaponId: () => currentEquippedWeaponId,
    getAudioState: () => ({ muted, volume, lastNonZeroVolume, musicVolume }),
    setAudioState: (patch) => {
      if (patch.muted !== undefined) muted = Boolean(patch.muted);
      if (patch.volume !== undefined) volume = patch.volume;
      if (patch.lastNonZeroVolume !== undefined) lastNonZeroVolume = patch.lastNonZeroVolume;
      if (patch.musicVolume !== undefined) musicVolume = patch.musicVolume;
    },
    syncPauseToggles: () => {
      syncAutoAimButton();
      syncAttackToggleButton();
      syncTouchPreviewButton();
    },
    setActiveTab: (tab) => setActiveTab(tab),
    resetLocalSelection: () => resetLocalSelection(),
    onCloseOtherPopovers: closeQuestsDrawer
  });
  const {
    closeSoundPopover,
    syncMuteButtons,
    showLevelUpModal,
    hideLevelUpModal,
    showResultModal,
    hideResultModal,
    openMageStarterModal,
    hidePauseModal,
    showPauseModal,
    isPauseModalOpen
  } = modals;

  // =========================================================================
  // 6b. CHAPTER-1 20-SECOND NON-BLOCKING ONBOARDING CONTROLLER
  // =========================================================================
  const ONBOARDING_DURATION_MS = 20000;
  let onboardingDone = false;
  let onboardingActive = false;
  let onboardingSessionDismissed = false;
  let onboardingStep = 0; // 0: move, 1: dash, 2: attack/ult
  let onboardingElapsedMs = 0;
  let onboardingLastTickMs = 0;
  let onboardingOriginPos = null;
  let onboardingStartKills = 0;
  let onboardingStep3DoneAt = 0;
  let onboardingActionFlags = { move: false, dash: false, combat: false };

  function renderOnboardingStep() {
    const isEn = lang === 'en';
    const isTouch = !touchLayer.classList.contains('hidden') || isTouchCapable;
    onboardingSkipBtn.textContent = isEn ? 'Skip' : 'Пропустить';
    for (let i = 0; i < onboardingDots.length; i++) {
      onboardingDots[i].classList.toggle('is-done', i < onboardingStep || onboardingStep3DoneAt > 0);
      onboardingDots[i].classList.toggle('is-current', i === onboardingStep && onboardingStep3DoneAt === 0);
    }
    if (onboardingStep3DoneAt > 0) {
      onboardingText.textContent = isEn ? 'Ready for the hunt!' : 'Готов к охоте!';
      return;
    }
    if (onboardingStep === 0) {
      onboardingText.textContent = isTouch
        ? (isEn ? '1/3 Move: drag left half of screen' : '1/3 Движение: левый стик на экране')
        : (isEn ? '1/3 Move: WASD or Arrow keys' : '1/3 Движение: клавиши WASD');
    } else if (onboardingStep === 1) {
      onboardingText.textContent = isTouch
        ? (isEn ? '2/3 Dash: tap DASH to dodge red zones' : '2/3 Рывок: жми «РЫВОК» — уходи от красных зон')
        : (isEn ? '2/3 Dash: press [Space] to dodge red zones' : '2/3 Рывок: [Space] — уходи от красных зон');
    } else {
      onboardingText.textContent = isTouch
        ? (isEn ? '3/3 Combat: auto-attack + tap ULT at 5 seals' : '3/3 Бой: автоатака + «УЛЬТА» при 5 печатях')
        : (isEn ? '3/3 Combat: [LMB] strike • [F] Ult at 5 seals' : '3/3 Удар [ЛКМ] • Ульта [F] при 5 печатях');
    }
  }

  function hideOnboardingBar() {
    onboardingActive = false;
    onboardingBar.classList.add('hidden');
    onboardingBar.classList.remove('is-complete');
  }

  function finishOnboarding() {
    if (!onboardingDone) {
      onboardingDone = true;
      callbacks.onCompleteOnboarding?.();
    }
    onboardingSessionDismissed = true;
    hideOnboardingBar();
  }

  function setOnboardingDone(done) {
    onboardingDone = Boolean(done);
    if (onboardingDone) {
      onboardingSessionDismissed = true;
      hideOnboardingBar();
    }
  }

  function startOnboarding(levelNumber = 1, isEndlessRun = false) {
    if (onboardingDone || isEndlessRun || Number(levelNumber) !== 1) {
      hideOnboardingBar();
      return;
    }
    onboardingSessionDismissed = false;
    onboardingActive = true;
    onboardingStep = 0;
    onboardingElapsedMs = 0;
    onboardingLastTickMs = performance.now();
    onboardingOriginPos = null;
    onboardingStartKills = 0;
    onboardingStep3DoneAt = 0;
    onboardingActionFlags = { move: false, dash: false, combat: false };
    onboardingTimerFill.style.transform = 'scaleX(1)';
    onboardingBar.classList.remove('hidden', 'is-complete');
    renderOnboardingStep();
  }

  onboardingSkipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    finishOnboarding();
  });

  window.addEventListener('keydown', (e) => {
    if (!onboardingActive || hudScreen.classList.contains('hidden')) return;
    if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code.startsWith('Arrow')) {
      onboardingActionFlags.move = true;
    } else if (e.code === 'Space') {
      onboardingActionFlags.dash = true;
    } else if (e.code === 'KeyF') {
      onboardingActionFlags.combat = true;
    }
  });

  window.addEventListener('pointerdown', (e) => {
    if (!onboardingActive || hudScreen.classList.contains('hidden')) return;
    if (e.pointerType !== 'touch' && e.button === 0 && onboardingStep === 2) {
      if (!e.target?.closest?.('.hud-onboarding-bar, button, .modal-backdrop:not(.hidden)')) {
        onboardingActionFlags.combat = true;
      }
    }
  });

  function updateOnboarding(snapshot) {
    if (snapshot?.onboardingDone) {
      onboardingDone = true;
    }
    const lvlNum = Number(snapshot?.levelNumber ?? snapshot?.level ?? 1);
    const isEnd = Boolean(snapshot?.isEndless);
    if (onboardingDone || isEnd || lvlNum !== 1) {
      if (onboardingActive) hideOnboardingBar();
      return;
    }
    if (!onboardingActive) {
      if (!onboardingSessionDismissed) {
        startOnboarding(lvlNum, isEnd);
      } else {
        return;
      }
    }

    const now = performance.now();
    if (modals.isPauseModalOpen() || modals.isRunModalOpen()) {
      onboardingLastTickMs = now;
      return;
    }
    const deltaMs = Math.max(0, Math.min(250, now - (onboardingLastTickMs || now)));
    onboardingLastTickMs = now;
    onboardingElapsedMs += deltaMs;

    const remRatio = Math.max(0, Math.min(1, 1 - onboardingElapsedMs / ONBOARDING_DURATION_MS));
    onboardingTimerFill.style.transform = `scaleX(${remRatio.toFixed(3)})`;

    if (onboardingElapsedMs >= ONBOARDING_DURATION_MS) {
      finishOnboarding();
      return;
    }

    const pPos = snapshot?.playerPos ?? snapshot?.player?.pos ?? null;
    if (!onboardingOriginPos && pPos && typeof pPos.x === 'number' && typeof pPos.z === 'number') {
      onboardingOriginPos = { x: pPos.x, z: pPos.z };
      onboardingStartKills = Math.floor(Number(snapshot?.kills || 0));
    }

    if (onboardingStep === 0) {
      const movedDist =
        onboardingOriginPos && pPos
          ? Math.hypot((pPos.x || 0) - onboardingOriginPos.x, (pPos.z || 0) - onboardingOriginPos.z)
          : 0;
      if (movedDist > 1.15 || touchState.moveActive || onboardingActionFlags.move) {
        onboardingStep = 1;
        renderOnboardingStep();
      }
    } else if (onboardingStep === 1) {
      if (Number(snapshot?.dashCooldown || 0) > 0.05 || touchState.dash || onboardingActionFlags.dash) {
        onboardingStep = 2;
        onboardingStartKills = Math.floor(Number(snapshot?.kills || 0));
        renderOnboardingStep();
      }
    } else if (onboardingStep === 2) {
      if (onboardingStep3DoneAt === 0) {
        const curKills = Math.floor(Number(snapshot?.kills || 0));
        const beastUsed = Boolean(snapshot?.beastActive || Number(snapshot?.beastTimeLeft || 0) > 0);
        if (curKills > onboardingStartKills || beastUsed || touchState.ult || onboardingActionFlags.combat) {
          onboardingStep3DoneAt = now;
          onboardingBar.classList.add('is-complete');
          renderOnboardingStep();
        }
      } else if (now - onboardingStep3DoneAt >= 900) {
        finishOnboarding();
      }
    }
  }

  function syncAutoAimButton() {
    autoAimBtn.classList.toggle('is-on', autoAim);
    autoAimBtn.classList.toggle('is-off', !autoAim);
    if (lang === 'en') {
      autoAimToggle.labelEl.textContent = 'Auto-Aim [Q]';
      autoAimToggle.pillEl.textContent = autoAim ? 'ON' : 'OFF';
    } else {
      autoAimToggle.labelEl.textContent = 'Автоприцел [Q]';
      autoAimToggle.pillEl.textContent = autoAim ? 'ВКЛ' : 'ВЫКЛ';
    }
  }

  function syncAttackToggleButton() {
    attackToggleBtn.classList.toggle('is-on', attackEnabled);
    attackToggleBtn.classList.toggle('is-off', !attackEnabled);
    if (lang === 'en') {
      attackToggle.labelEl.textContent = 'Attack [E]';
      attackToggle.pillEl.textContent = attackEnabled ? 'ON' : 'OFF';
    } else {
      attackToggle.labelEl.textContent = 'Атака [E]';
      attackToggle.pillEl.textContent = attackEnabled ? 'ВКЛ' : 'ВЫКЛ';
    }
  }

  function syncTouchPreviewButton() {
    const touchOn = !touchLayer.classList.contains('hidden');
    touchPreviewBtn.classList.toggle('is-on', touchOn);
    touchPreviewBtn.classList.toggle('is-off', !touchOn);
    if (lang === 'en') {
      touchPreviewToggle.labelEl.textContent = 'Touch Controls';
      touchPreviewToggle.pillEl.textContent = touchOn ? 'ON' : 'OFF';
    } else {
      touchPreviewToggle.labelEl.textContent = 'Плавающий джойстик';
      touchPreviewToggle.pillEl.textContent = touchOn ? 'ВКЛ' : 'ВЫКЛ';
    }
  }

  function syncStaticLabels() {
    const isEn = lang === 'en';
    hubTitle.textContent = isEn ? 'Level' : 'Уровень';
    hubGoldLabel.textContent = isEn ? 'Gold' : 'Золото';
    homeJourneyLabel.textContent = isEn ? 'EMBARK!' : 'В ПУТЬ!';
    homeEndlessLabel.textContent = isEn ? 'ENDLESS HORDE' : 'БЕСКОНЕЧНАЯ ОРДА';
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
    if (hudCache.dashReady) {
      hudDashStateText.textContent = isEn ? 'DASH' : 'РЫВОК';
      touchDashLabel.textContent = isEn ? 'DASH' : 'РЫВОК';
    }
    syncMuteButtons();
    syncAutoAimButton();
    syncAttackToggleButton();
    syncTouchPreviewButton();
  }


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
    closeQuestsDrawer();
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
    hubScreen.classList.toggle('is-subtab', !is3DStageTab && valid !== 'campaign' && valid !== 'shop');
    hubScreen.classList.toggle('is-campaign-map', valid === 'campaign');
    hubScreen.classList.toggle('is-talent-fullscreen', valid === 'shop');
    hubScreen.scrollTop = 0;

    if (valid !== 'shop') {
      activeHoldCancel?.();
    }

    if (valid === 'campaign') {
      campaignWorldView.classList.toggle('hidden', campaignSubView !== 'world');
      campaignForestView.classList.toggle('hidden', campaignSubView !== 'forest');
      if (campaignSubView === 'world') {
        forestMapVideoLoop?.pause();
        worldMapVideoLoop?.play();
      } else {
        worldMapVideoLoop?.pause();
        forestMapVideoLoop?.play();
      }
    } else {
      // Leaving the campaign screen freezes the clips without rewinding them.
      worldMapVideoLoop?.pause();
      forestMapVideoLoop?.pause();
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
    closeQuestsDrawer();
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

  function triggerStartEndless() {
    closeSoundPopover();
    closeQuestsDrawer();
    if (localSelectedClass === 'mage' && !isMageStarterChosen()) {
      openMageStarterModal('__endless__');
      return;
    }
    callbacks.onStartEndless?.({
      classId: localSelectedClass,
      weaponId: currentEquippedWeaponId
    });
  }

  homeJourneyBtn.addEventListener('click', () => setActiveTab('campaign_world'));
  homeEndlessBtn.addEventListener('click', () => triggerStartEndless());
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

  // Keyboard shortcuts: Level-Up [1/2/3], Hub Heroes/Campaign [ArrowLeft/ArrowRight], Popovers/Modals [Escape]
  window.addEventListener('keydown', (e) => {
    if (!hubQuestsDrawer.classList.contains('hidden') && e.code === 'Escape') {
      closeQuestsDrawer();
      return;
    }
    if (modals.handleKeydown(e)) {
      return;
    }

    if (
      !e.repeat &&
      !hubScreen.classList.contains('hidden') &&
      !modals.isRunModalOpen()
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

    const bestEndKills = Math.max(0, Math.floor(Number(state.bestEndlessKills || 0)));
    const bestEndSec = Math.max(0, Math.floor(Number(state.bestEndlessTimeSec || 0)));
    if (bestEndKills > 0 || bestEndSec > 0) {
      homeEndlessRecord.textContent = isEn
        ? `Best: ${bestEndKills} kills • ${formatTimeMMSS(bestEndSec)}`
        : `Рекорд: ${bestEndKills} уб. • ${formatTimeMMSS(bestEndSec)}`;
    } else {
      homeEndlessRecord.textContent = isEn
        ? 'Survival • Leaderboard'
        : 'Выживание • Таблица лидеров';
    }

    if (typeof state.onboardingDone === 'boolean') {
      setOnboardingDone(state.onboardingDone);
    }
    renderDailyQuests(state.dailyQuests);

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

    // --- 6. Render 🌿 Древо Талантов (Fullscreen Ornate Constellation Canvas • RMB Pan • Hold LMB to Upgrade!) ---
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
      ? `${activeClass.nameEn} • Constellation`
      : `${activeClass.nameRu} • Ветки специализаций`;

    rewardGoldBtn.classList.add('hidden');
    talentPointsPill.textContent = isEn
      ? `✨ Points: ${ptsAvail} (Lv. ${heroLvlNum})`
      : `✨ Очки: ${ptsAvail} (Ур. ${heroLvlNum})`;
    talentResetBtn.classList.toggle('hidden', ptsSpent <= 0);
    talentResetBtn.onclick = () => {
      if (callbacks.onResetTalents) {
        callbacks.onResetTalents(localSelectedClass);
      } else {
        callbacks.onResetMageTalents?.();
      }
    };

    const needsInitialFit = talentCamState.key !== localSelectedClass;
    if (needsInitialFit) {
      talentCamState.key = localSelectedClass;
      talentCamState.x = 0;
      talentCamState.y = 0;
      talentCamState.zoom = 0.72;
    }

    activeHoldCancel?.();
    masteryGrid.innerHTML = '';
    masteryGrid.className = 'mastery-grid talent-fs-body talent-tree-shell';

    {
      if (!classTree.some((n) => n.id === selectedTalentByClass[localSelectedClass])) {
        selectedTalentByClass[localSelectedClass] = classTree[0]?.id;
      }
      let curSelectedId = selectedTalentByClass[localSelectedClass] || classTree[0]?.id;

      const viewport = el('div', 'talent-canvas-viewport');
      viewport.addEventListener('contextmenu', (e) => e.preventDefault());

      const world = el('div', 'talent-canvas-world');
      const WORLD_W = 1280;
      const WORLD_H = 740;
      const colPctFallback = { 1: 22, 2: 50, 3: 78 };
      const rowPctFallback = { 1: 14, 2: 38, 3: 62, 4: 84 };
      const getPos = (n) => ({
        xPct: n.xPct ?? colPctFallback[n.col] ?? 50,
        yPct: n.yPct ?? rowPctFallback[n.row] ?? 50
      });

      const computeFitZoom = () => {
        const vw = viewport.clientWidth || 840;
        const vh = viewport.clientHeight || 520;
        const fit = Math.min((vw - 24) / WORLD_W, (vh - 18) / WORLD_H);
        return Math.max(0.5, Math.min(1.05, +fit.toFixed(3)));
      };

      const applyCamTransform = (fitFirst = false) => {
        const vw = Math.max(viewport.clientWidth || 840, 320);
        const vh = Math.max(viewport.clientHeight || 520, 240);
        if (fitFirst) {
          talentCamState.x = 0;
          talentCamState.y = 0;
          talentCamState.zoom = computeFitZoom();
        }
        talentCamState.zoom = Math.max(0.48, Math.min(1.5, talentCamState.zoom));
        const maxPanX = Math.max(240, (WORLD_W * talentCamState.zoom - vw) * 0.55 + 160);
        const maxPanY = Math.max(180, (WORLD_H * talentCamState.zoom - vh) * 0.55 + 140);
        talentCamState.x = Math.max(-maxPanX, Math.min(maxPanX, talentCamState.x));
        talentCamState.y = Math.max(-maxPanY, Math.min(maxPanY, talentCamState.y));
        world.style.transform = `translate(-50%, -50%) translate3d(${talentCamState.x.toFixed(1)}px, ${talentCamState.y.toFixed(1)}px, 0) scale(${talentCamState.zoom.toFixed(3)})`;
        talentZoomLabel.textContent = `${Math.round(talentCamState.zoom * 100)}%`;
      };

      // Atmospheric Branch Header Banners directly on the Talent Map
      const branchBanners =
        localSelectedClass === 'gunslinger'
          ? [
              { x: 22, y: 23, title: 'ЛЁГКОЕ ОРУЖИЕ', sub: 'Пистолеты (USP / Кольт) и ПП' },
              { x: 11, y: 47, title: 'ПИСТОЛЕТЫ', sub: 'Точечный калибр', mini: true },
              { x: 32, y: 47, title: 'ПИСТОЛЕТЫ-ПУЛЕМЁТЫ', sub: 'Шквал и кучность', mini: true },
              { x: 50, y: 27, title: 'АВТОМАТЫ', sub: 'Штурмовой калибр АК-47' },
              { x: 78, y: 23, title: 'ДРОБОВИКИ', sub: 'Картечь, мины и рикошет' }
            ]
          : localSelectedClass === 'warrior'
            ? [
                { x: 23, y: 27, title: 'БАСТИОН И ЩИТ', sub: 'Броня и стойкость' },
                { x: 50, y: 45, title: 'ДУЭЛЬНЫЙ МЕЧ', sub: 'Точечные выпады' },
                { x: 77, y: 27, title: 'НАТИСК И ЖАТВА', sub: 'Темп, крит и вампиризм' }
              ]
            : [
                { x: 23, y: 27, title: 'РЕЗЕРВ И ЩИТ', sub: 'Мана и водная пелена' },
                { x: 50, y: 45, title: 'ВОДОВОРОТ', sub: 'Двойные сферы и вихри' },
                { x: 77, y: 27, title: 'ШТОРМ ПРИЛИВА', sub: 'Скорость и криты' }
              ];
      for (const bb of branchBanners) {
        const bEl = el('div', `talent-branch-banner${bb.mini ? ' is-mini' : ''}`);
        bEl.style.left = `${bb.x}%`;
        bEl.style.top = `${bb.y}%`;
        bEl.append(
          el('span', 'talent-branch-title', bb.title),
          el('span', 'talent-branch-sub', bb.sub)
        );
        world.appendChild(bEl);
      }

      // Glowing Curved SVG Bezier Paths
      let pathsSvg = '';
      for (const b of classTree) {
        const pB = getPos(b);
        const bx = (pB.xPct / 100) * WORLD_W;
        const by = (pB.yPct / 100) * WORLD_H;
        for (const r of b.requires || []) {
          const a = classTree.find((n) => n.id === r.id);
          if (!a) continue;
          const pA = getPos(a);
          const ax = (pA.xPct / 100) * WORLD_W;
          const ay = (pA.yPct / 100) * WORLD_H;
          const midY = (ay + by) * 0.5;
          const bRank = getRank(b.id);
          const reqMet = (b.requires || []).every((req) => getRank(req.id) >= (req.rank || 1));
          const clsEdge = bRank > 0 ? 'is-active' : reqMet ? 'is-ready' : 'is-locked';
          const d = `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${ax.toFixed(1)} ${midY.toFixed(1)}, ${bx.toFixed(1)} ${midY.toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)}`;
          pathsSvg += `<path d="${d}" class="talent-edge-glow ${clsEdge}" /><path d="${d}" class="talent-edge ${clsEdge}" />`;
        }
      }
      const svgCanvas = makeSvgNode(
        `<svg viewBox="0 0 ${WORLD_W} ${WORLD_H}" class="talent-edges-svg" xmlns="http://www.w3.org/2000/svg">${pathsSvg}</svg>`
      );
      world.appendChild(svgCanvas);

      // Gothic Inspector Card (Right Side Floating/Docked Plaque)
      const inspector = el('div', 'talent-inspector-card');
      const RING_CIRC = 213.63; // 2 * PI * 34
      const nodeButtonMap = new Map();

      const updateInspector = (nodeId) => {
        curSelectedId = nodeId;
        selectedTalentByClass[localSelectedClass] = nodeId;
        if (localSelectedClass === 'mage') selectedMageTalentId = nodeId;
        for (const [id, btn] of nodeButtonMap.entries()) {
          btn.classList.toggle('is-selected', id === nodeId);
        }

        const selNode = classTree.find((n) => n.id === nodeId) || classTree[0];
        const selRank = getRank(selNode.id);
        const selReqMet = (selNode.requires || []).every((r) => getRank(r.id) >= (r.rank || 1));
        const selMaxed = selRank >= selNode.maxRank;
        const selCanBuy = ptsAvail >= 1 && selReqMet && !selMaxed;

        inspector.innerHTML = '';

        const inspBranch = el('div', 'talent-insp-branch-pill', selNode.branchLabelRu || activeClass.nameRu);
        const inspTop = el('div', 'talent-insp-top');
        const inspIconBox = el('div', 'talent-insp-icon');
        inspIconBox.appendChild(createTalentRuneSvg(selNode.iconKind));
        const inspHeadText = el('div', 'talent-insp-headtext');
        inspHeadText.append(
          el('span', 'talent-insp-tier', `Ступень ${selNode.tier} • Ранг ${selRank} / ${selNode.maxRank}`),
          el('h3', 'talent-insp-title', selNode.nameRu)
        );
        inspTop.append(inspIconBox, inspHeadText);

        const rankPipsRow = el('div', 'talent-insp-pips');
        for (let p = 1; p <= selNode.maxRank; p++) {
          rankPipsRow.appendChild(el('span', `talent-insp-pip${p <= selRank ? ' is-lit' : ''}`));
        }

        const inspStatPill = el('div', 'talent-insp-stat', selNode.statBadgeRu);
        const inspDesc = el('p', 'talent-insp-desc', selNode.descRu);

        const statsSummary = el(
          'div',
          'talent-insp-summary',
          `Вложено очков: ${ptsSpent} • Свободно: ${ptsAvail} • Ур. героя: ${heroLvlNum}`
        );

        let reqText = 'Готов к изучению: зажмите ЛКМ на иконке (0.5 с) или нажмите кнопку ниже.';
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
          reqText = 'Получите новый уровень героя в бою для +1 очка таланта.';
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
            if (callbacks.onUpgradeTalent) callbacks.onUpgradeTalent(localSelectedClass, selNode.id);
            else callbacks.onUpgradeMageTalent?.(selNode.id);
          }
        });

        const inspFooter = el('div', 'talent-insp-footer');
        const backCampBtn = el('button', 'subpanel-back-btn', '← В лагерь');
        backCampBtn.type = 'button';
        backCampBtn.addEventListener('click', () => setActiveTab('home'));
        const toBattleBtn = el('button', 'subpanel-battle-btn gothic-plaque-battle-btn', '⚔️ В БОЙ!');
        toBattleBtn.type = 'button';
        toBattleBtn.addEventListener('click', () => {
          setActiveTab('campaign_world');
          renderHub(lastHubState || storeRef);
        });
        inspFooter.append(backCampBtn, toBattleBtn);

        inspector.append(
          inspBranch,
          inspTop,
          rankPipsRow,
          inspStatPill,
          inspDesc,
          statsSummary,
          inspReq,
          learnBtn,
          inspFooter
        );
      };

      // Build Beveled Gothic Medallion Nodes + LMB Hold Progress Rings
      const HOLD_DURATION_MS = 500;

      for (const node of classTree) {
        const pos = getPos(node);
        const rank = getRank(node.id);
        const reqMet = (node.requires || []).every((r) => getRank(r.id) >= (r.rank || 1));
        const isMaxed = rank >= node.maxRank;
        const canBuy = ptsAvail >= 1 && reqMet && !isMaxed;

        const nodeBtn = el(
          'button',
          `talent-node-btn${curSelectedId === node.id ? ' is-selected' : ''}${
            rank > 0 ? ' is-learned' : ''
          }${isMaxed ? ' is-maxed' : ''}${canBuy ? ' is-upgradeable' : ''}${!reqMet ? ' is-locked' : ''}`
        );
        nodeBtn.type = 'button';
        nodeBtn.dataset.talentId = node.id;
        nodeBtn.style.left = `${pos.xPct}%`;
        nodeBtn.style.top = `${pos.yPct}%`;
        nodeBtn.title = `${node.nameRu} (${rank}/${node.maxRank}) — удерживайте ЛКМ 0.5 с для изучения`;

        const medallion = el('div', 'talent-node-medallion');
        const holdSvg = makeSvgNode(
          `<svg class="talent-hold-ring-svg" viewBox="0 0 80 80" aria-hidden="true">
            <circle class="talent-hold-ring-track" cx="40" cy="40" r="34" />
            <circle class="talent-hold-ring-fill" cx="40" cy="40" r="34" stroke-dasharray="${RING_CIRC}" stroke-dashoffset="${RING_CIRC}" />
          </svg>`
        );
        const ringFill = holdSvg.querySelector('.talent-hold-ring-fill');
        const iconWrap = el('div', 'talent-node-icon');
        iconWrap.appendChild(createTalentRuneSvg(node.iconKind));
        medallion.append(holdSvg, iconWrap);

        const rankBadge = el('span', 'talent-node-rank', `${rank}/${node.maxRank}`);
        const nameLbl = el('span', 'talent-node-name', node.nameRu);
        nodeBtn.append(medallion, rankBadge, nameLbl);

        nodeBtn.addEventListener('pointerdown', (e) => {
          // Right mouse button passes cleanly to viewport pan handler
          if (e.button === 2 || e.button === 1) return;
          e.stopPropagation();
          updateInspector(node.id);
          if (!canBuy) return;

          if (activeHoldCancel) activeHoldCancel();
          const startX = e.clientX;
          const startY = e.clientY;
          const startTime = performance.now();
          let rafId = 0;
          let finished = false;
          nodeBtn.classList.add('is-charging');

          const cleanupHold = () => {
            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = 0;
            }
            nodeBtn.classList.remove('is-charging');
            if (ringFill) ringFill.setAttribute('stroke-dashoffset', String(RING_CIRC));
            window.removeEventListener('pointerup', onAbort);
            window.removeEventListener('pointercancel', onAbort);
            window.removeEventListener('pointermove', onMove);
            if (activeHoldCancel === cleanupHold) activeHoldCancel = null;
          };
          const onMove = (ev) => {
            if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 12) cleanupHold();
          };
          const onAbort = () => {
            if (!finished) cleanupHold();
          };
          activeHoldCancel = cleanupHold;
          window.addEventListener('pointerup', onAbort);
          window.addEventListener('pointercancel', onAbort);
          window.addEventListener('pointermove', onMove);

          const tick = (now) => {
            const p = Math.min(1, (now - startTime) / HOLD_DURATION_MS);
            if (ringFill) ringFill.setAttribute('stroke-dashoffset', String((RING_CIRC * (1 - p)).toFixed(2)));
            if (p >= 1) {
              finished = true;
              cleanupHold();
              if (callbacks.onUpgradeTalent) callbacks.onUpgradeTalent(localSelectedClass, node.id);
              else callbacks.onUpgradeMageTalent?.(node.id);
              return;
            }
            rafId = requestAnimationFrame(tick);
          };
          rafId = requestAnimationFrame(tick);
        });

        nodeButtonMap.set(node.id, nodeBtn);
        world.appendChild(nodeBtn);
      }

      // Right-Mouse-Button Drag (and background drag) + Mouse Wheel Zoom
      let isPanning = false;
      let panStartX = 0;
      let panStartY = 0;
      let origCamX = 0;
      let origCamY = 0;

      viewport.addEventListener('pointerdown', (e) => {
        const isRmbOrMmb = e.button === 2 || e.button === 1;
        const onBackground = !e.target.closest('.talent-node-btn');
        if (!isRmbOrMmb && !onBackground) return;
        e.preventDefault();
        if (activeHoldCancel) activeHoldCancel();
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        origCamX = talentCamState.x;
        origCamY = talentCamState.y;
        viewport.classList.add('is-panning');
        try { viewport.setPointerCapture(e.pointerId); } catch {}
      });
      viewport.addEventListener('pointermove', (e) => {
        if (!isPanning) return;
        const pStart = window.__toGameCoords ? window.__toGameCoords(panStartX, panStartY) : { x: panStartX, y: panStartY };
        const pNow = window.__toGameCoords ? window.__toGameCoords(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
        talentCamState.x = origCamX + (pNow.x - pStart.x);
        talentCamState.y = origCamY + (pNow.y - pStart.y);
        applyCamTransform();
      });
      const stopPan = () => {
        if (!isPanning) return;
        isPanning = false;
        viewport.classList.remove('is-panning');
      };
      viewport.addEventListener('pointerup', stopPan);
      viewport.addEventListener('pointercancel', stopPan);
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        talentCamState.zoom += delta;
        applyCamTransform();
      }, { passive: false });

      talentZoomInBtn.onclick = () => {
        talentCamState.zoom += 0.14;
        applyCamTransform();
      };
      talentZoomOutBtn.onclick = () => {
        talentCamState.zoom -= 0.14;
        applyCamTransform();
      };
      talentCenterBtn.onclick = () => {
        applyCamTransform(true);
      };

      viewport.appendChild(world);
      masteryGrid.append(viewport, inspector);
      updateInspector(curSelectedId);
      applyCamTransform(needsInitialFit);
      requestAnimationFrame(() => applyCamTransform(needsInitialFit));
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
    bossStaggerVisible: false,
    bossStaggered: false,
    bossStaggerScale: -1,
    bossStaggerLabel: '',
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
    xpScale: -1,
    dashReady: true,
    dashQuant: 1000,
    dashText: '',
    ultState: '',
    ultQuant: -1,
    ultText: '',
    ultTouchText: '',
    isEndless: false,
    endlessText: '',
    comboStep: 0,
    comboVisible: false,
    comboQuant: -1
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

    // 2. Beast Seals vs Manual Beast Rage Ult [F] vs Active Beast Mode Bar
    const beastTimer = Number(snapshot.beastTimer ?? snapshot.beastTimeLeft ?? 0);
    const isBeast = Boolean(snapshot.beastActive || snapshot.isBeastMode || beastTimer > 0);
    const bMax = Math.max(0.1, Number(snapshot.beastDuration ?? snapshot.beastMaxTimer ?? 10));
    const bRatio = isBeast ? Math.max(0, Math.min(1, beastTimer / bMax)) : 0;
    const seals = Math.max(0, Math.min(5, Number(snapshot.beastSeals ?? snapshot.seals ?? snapshot.clovers ?? 0)));
    const beastReady = Boolean(snapshot.beastReady ?? (!isBeast && seals >= 5));

    if (isBeast !== hudCache.beastActive) {
      hudCache.beastActive = isBeast;
      sealSlotsWrap.classList.toggle('hidden', isBeast);
      beastActiveBar.classList.toggle('hidden', !isBeast);
    }

    if (isBeast) {
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
      if (seals !== hudCache.sealsCount) {
        hudCache.sealsCount = seals;
        for (let i = 0; i < 5; i++) {
          sealSlotNodes[i].classList.toggle('filled', i < seals);
        }
      }
    }

    // Sync Bottom HUD Ult [F] & Right-Thumb Touch Ult Button
    const ultStateKey = isBeast ? 'active' : beastReady ? 'ready' : 'charging';
    const ultRatio = isBeast ? bRatio : (beastReady ? 1 : seals / 5);
    const ultQuant = Math.round(ultRatio * 500);
    if (ultStateKey !== hudCache.ultState) {
      hudCache.ultState = ultStateKey;
      hudUltBtn.classList.toggle('is-active', isBeast);
      hudUltBtn.classList.toggle('is-ready', !isBeast && beastReady);
      hudUltBtn.classList.toggle('is-charging', !isBeast && !beastReady);
      touchUltBtn.classList.toggle('is-active', isBeast);
      touchUltBtn.classList.toggle('is-ready', !isBeast && beastReady);
      touchUltBtn.classList.toggle('is-charging', !isBeast && !beastReady);
    }
    if (ultQuant !== hudCache.ultQuant) {
      hudCache.ultQuant = ultQuant;
      if (hudUltRingFill) {
        hudUltRingFill.setAttribute('stroke-dashoffset', (HUD_ULT_RING_CIRC * (1 - ultRatio)).toFixed(2));
      }
      if (touchUltRingFill) {
        touchUltRingFill.setAttribute('stroke-dashoffset', (TOUCH_ULT_RING_CIRC * (1 - ultRatio)).toFixed(2));
      }
      hudUltBarFill.style.transform = `scaleX(${ultRatio.toFixed(3)})`;
    }
    const ultDesktopStr = isBeast
      ? `${Math.max(0, beastTimer).toFixed(1)}${lang === 'en' ? 's' : 'с'}`
      : beastReady
        ? (lang === 'en' ? 'RAGE!' : 'ЯРОСТЬ!')
        : `${lang === 'en' ? 'BEAST' : 'ЗВЕРЬ'} ${seals}/5`;
    if (ultDesktopStr !== hudCache.ultText) {
      hudCache.ultText = ultDesktopStr;
      hudUltStateText.textContent = ultDesktopStr;
    }
    const ultTouchStr = isBeast
      ? `${Math.max(0, beastTimer).toFixed(1)}${lang === 'en' ? 's' : 'с'}`
      : beastReady
        ? (lang === 'en' ? 'ULT!' : 'УЛЬТА')
        : `${seals}/5`;
    if (ultTouchStr !== hudCache.ultTouchText) {
      hudCache.ultTouchText = ultTouchStr;
      touchUltLabel.textContent = ultTouchStr;
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

    // 4. Boss Bar vs Wave Countdown Timer / Endless Survival Wave Badge
    const isEndlessHud = Boolean(snapshot.isEndless);
    const boss = snapshot.boss;
    const bossHp = Number(boss?.hp ?? snapshot.bossHp ?? 0);
    const isBossActive = Boolean((boss && boss.active !== false && bossHp > 0) || snapshot.bossActive);

    if (isEndlessHud !== hudCache.isEndless) {
      hudCache.isEndless = isEndlessHud;
      hudEndlessBadge.classList.toggle('hidden', !isEndlessHud);
      waveBox.classList.toggle('hidden', isEndlessHud || isBossActive);
    }
    if (isEndlessHud) {
      const endWave = Math.max(1, Math.floor(Number(snapshot.endlessWave ?? 1)));
      const endSec = Math.max(0, Math.floor(Number(snapshot.elapsedSec ?? snapshot.elapsedTime ?? 0)));
      const endStr = `${lang === 'en' ? 'Wave' : 'Волна'} ${endWave} • ${formatTimeMMSS(endSec)}`;
      if (endStr !== hudCache.endlessText) {
        hudCache.endlessText = endStr;
        hudEndlessText.textContent = endStr;
      }
    }

    if (isBossActive !== hudCache.bossActive) {
      hudCache.bossActive = isBossActive;
      bossBarBox.classList.toggle('hidden', !isBossActive);
      waveBox.classList.toggle('hidden', isEndlessHud || isBossActive);
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

      const staggerMax = Number(boss?.staggerMax ?? snapshot.bossStaggerMax ?? 0);
      const hasStagger = Number.isFinite(staggerMax) && staggerMax > 0;
      const isStaggered = hasStagger && Boolean(boss?.staggered ?? snapshot.bossStaggered);
      if (hasStagger !== hudCache.bossStaggerVisible) {
        hudCache.bossStaggerVisible = hasStagger;
        bossStaggerWrap.classList.toggle('hidden', !hasStagger);
      }
      if (isStaggered !== hudCache.bossStaggered) {
        hudCache.bossStaggered = isStaggered;
        bossStaggerWrap.classList.toggle('is-staggered', isStaggered);
        bossBarBox.classList.toggle('is-staggered', isStaggered);
      }
      if (hasStagger) {
        const rawStagger = Math.max(0, Number(boss?.stagger ?? snapshot.bossStagger ?? 0));
        const sRatio =
          isStaggered && rawStagger <= 0.001
            ? 1
            : Math.max(0, Math.min(1, rawStagger / staggerMax));
        const sQuant = Math.round(sRatio * 500);
        if (sQuant !== hudCache.bossStaggerScale) {
          hudCache.bossStaggerScale = sQuant;
          bossStaggerFill.style.transform = `scaleX(${sRatio.toFixed(3)})`;
        }
        const sLabel = isStaggered
          ? (lang === 'en' ? 'STAGGERED (+35% DMG)' : 'ОГЛУШЁН (+35% УРОНА)')
          : (lang === 'en' ? 'STAGGER' : 'ОГЛУШЕНИЕ');
        if (sLabel !== hudCache.bossStaggerLabel) {
          hudCache.bossStaggerLabel = sLabel;
          bossStaggerBadge.textContent = sLabel;
        }
      }
    } else {
      if (hudCache.bossStaggerVisible) {
        hudCache.bossStaggerVisible = false;
        bossStaggerWrap.classList.add('hidden');
      }
      if (hudCache.bossStaggered) {
        hudCache.bossStaggered = false;
        bossStaggerWrap.classList.remove('is-staggered');
        bossBarBox.classList.remove('is-staggered');
      }
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

    // 7b. Active Dash [Space] Cooldown Indicator (Desktop HUD + Touch Right-Thumb Button)
    const dashCdMax = Math.max(0.1, Number(snapshot.dashCooldownMax ?? 2.4));
    const dashCd = Math.max(0, Number(snapshot.dashCooldown ?? 0));
    const dashReady = dashCd <= 0.02;
    const dashRatio = dashReady ? 1 : Math.max(0, Math.min(1, 1 - dashCd / dashCdMax));
    const dashQuant = Math.round(dashRatio * 500);
    if (dashReady !== hudCache.dashReady) {
      hudCache.dashReady = dashReady;
      hudDashBtn.classList.toggle('is-ready', dashReady);
      hudDashBtn.classList.toggle('is-cooling', !dashReady);
      touchDashBtn.classList.toggle('is-ready', dashReady);
      touchDashBtn.classList.toggle('is-cooling', !dashReady);
    }
    if (dashQuant !== hudCache.dashQuant) {
      hudCache.dashQuant = dashQuant;
      if (hudDashRingFill) {
        hudDashRingFill.setAttribute('stroke-dashoffset', (HUD_DASH_RING_CIRC * (1 - dashRatio)).toFixed(2));
      }
      if (touchDashRingFill) {
        touchDashRingFill.setAttribute('stroke-dashoffset', (TOUCH_DASH_RING_CIRC * (1 - dashRatio)).toFixed(2));
      }
      hudDashBarFill.style.transform = `scaleX(${dashRatio.toFixed(3)})`;
    }
    const dashLabelStr = dashReady
      ? (lang === 'en' ? 'DASH' : 'РЫВОК')
      : `${dashCd.toFixed(1)}${lang === 'en' ? 's' : 'с'}`;
    if (dashLabelStr !== hudCache.dashText) {
      hudCache.dashText = dashLabelStr;
      hudDashStateText.textContent = dashLabelStr;
      touchDashLabel.textContent = dashLabelStr;
    }

    // 7c. Warrior 3-Hit Combo Indicator (×2 / ×3)
    const comboStep = Math.max(0, Math.floor(Number(snapshot.comboStep ?? 0)));
    const comboTimer = Math.max(0, Number(snapshot.comboTimer ?? 0));
    const comboVisible = comboStep >= 2 && (snapshot.comboTimer === undefined || comboTimer > 0.01);
    if (comboVisible !== hudCache.comboVisible) {
      hudCache.comboVisible = comboVisible;
      hudComboBadge.classList.toggle('hidden', !comboVisible);
    }
    if (comboVisible) {
      if (comboStep !== hudCache.comboStep) {
        hudCache.comboStep = comboStep;
        const isFinisher = comboStep >= 3;
        hudComboBadge.classList.toggle('is-finisher', isFinisher);
        hudComboText.textContent = isFinisher
          ? (lang === 'en' ? 'COMBO ×3' : 'КОМБО ×3')
          : (lang === 'en' ? 'COMBO ×2' : 'КОМБО ×2');
        hudComboBadge.classList.remove('is-pop');
        void hudComboBadge.offsetWidth;
        hudComboBadge.classList.add('is-pop');
      }
      const cRatio = snapshot.comboTimer === undefined ? 1 : Math.max(0, Math.min(1, comboTimer / 1.35));
      const cQuant = Math.round(cRatio * 200);
      if (cQuant !== hudCache.comboQuant) {
        hudCache.comboQuant = cQuant;
        hudComboBarFill.style.transform = `scaleX(${cRatio.toFixed(3)})`;
      }
    } else if (hudCache.comboStep !== 0) {
      hudCache.comboStep = 0;
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

    // 9. Soul XP Bar (prefer in-run roguelike perk XP when present so bar matches 3-card blessing level-ups)
    const hasRunXp = typeof snapshot.runXpNext === 'number' && snapshot.runXpNext > 0;
    const soulLvl = Math.max(
      1,
      Number(
        (hasRunXp ? snapshot.runPerkLevel : null) ??
          snapshot.soulLevel ??
          snapshot.xpLevel ??
          snapshot.runLevel ??
          snapshot.playerLevel ??
          1
      )
    );
    if (soulLvl !== hudCache.soulLevel) {
      hudCache.soulLevel = soulLvl;
      soulXpTitle.textContent = lang === 'en' ? `Soul Level ${soulLvl}` : `Уровень душ ${soulLvl}`;
    }

    const xp = Math.floor(Number((hasRunXp ? snapshot.runXp : null) ?? snapshot.xp ?? snapshot.souls ?? 0));
    const xpNext = Math.max(
      1,
      Math.floor(
        Number(
          (hasRunXp ? snapshot.runXpNext : null) ??
            snapshot.xpNext ??
            snapshot.xpToNext ??
            snapshot.maxXp ??
            snapshot.nextLevelXp ??
            45
        )
      )
    );
    const xpNumsStr = `${xp} / ${xpNext}`;
    if (xpNumsStr !== hudCache.xpNums) {
      hudCache.xpNums = xpNumsStr;
      soulXpNums.textContent = xpNumsStr;
    }

    const xpRatio =
      !hasRunXp && typeof snapshot.xpRatio === 'number'
        ? Math.max(0, Math.min(1, snapshot.xpRatio))
        : Math.max(0, Math.min(1, xp / xpNext));
    const xpQuant = Math.round(xpRatio * 1000);
    if (xpQuant !== hudCache.xpScale) {
      hudCache.xpScale = xpQuant;
      soulXpFill.style.transform = `scaleX(${xpRatio.toFixed(3)})`;
    }

    // 10. Chapter-1 Non-Blocking 20s Onboarding Auto-Advance
    updateOnboarding(snapshot);
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
        (activeHubTab === 'home' || activeHubTab === 'heroes' || activeHubTab === 'arsenal' || activeHubTab === 'store') &&
        !modals.isStageBlockedByModal()
      );
    },

    setLang(nextLang) {
      lang = nextLang === 'en' ? 'en' : 'ru';
      syncStaticLabels();
      if (onboardingActive) renderOnboardingStep();
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
      closeQuestsDrawer();
      hubScreen.classList.toggle('hidden', !visible);
      if (visible) {
        hideOnboardingBar();
        releaseLeftStick();
        touchState.dash = false;
        touchState.ult = false;
        if (activeHubTab === 'campaign') {
          if (campaignSubView === 'world') {
            forestMapVideoLoop?.pause();
            worldMapVideoLoop?.play();
          } else {
            worldMapVideoLoop?.pause();
            forestMapVideoLoop?.play();
          }
        }
      } else {
        activeHoldCancel?.();
        worldMapVideoLoop?.pause();
        forestMapVideoLoop?.pause();
      }
    },

    updateHud,

    showHud(visible = true) {
      closeSoundPopover();
      closeQuestsDrawer();
      hudScreen.classList.toggle('hidden', !visible);
      if (!visible) {
        hideOnboardingBar();
        releaseLeftStick();
        touchState.dash = false;
        touchState.ult = false;
      } else if (isTouchCapable) {
        touchLayer.classList.remove('hidden');
        ensureAutoAimForTouch();
      }
    },

    setOnboardingDone,
    startOnboarding,

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
    isPauseModalOpen,

    openMageStarterModal,
    resetLocalSelection,

    hideAllModals() {
      closeQuestsDrawer();
      modals.hideAllModals();
    }
  };
}
