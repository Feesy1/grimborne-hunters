// Pure Gothic Dark-Fantasy Soulslike UI Manager («Охотники Мрака — Замок Пепла»):
// - Minimal Dark Souls / Elden Ring Title Screen (Продолжить / Новая игра / Сложность / Настройки)
//   over live 3D Warrior Knight stage (ZERO customization, shop, tabs, gold, or PvE clutter!)
// - Clean Gothic Combat HUD (Crimson HP, Muted Stamina, Zone Ribbon, Boss HP + Poise Bar,
//   Antique-Gold SVG Action Pills, Chamfered Pointer Plaque)
// - Mobile Landscape Touch Controls (Floating Left Joystick + Right Camera Swipe + 6 Obsidian+Gold SVG Buttons)
// - Cinematic Boss Cutscene Letterbox, Subtitles, Title Card, Interact/Riposte Prompts & Victory/Defeat Overlays

import { WEAPONS } from './config.js?v=20261124z87';
import { el } from './ui/resolvers.js?v=20261124z87';
import { makeSvgNode, createWeaponSvg } from './ui/svgIcons.js?v=20261124z87';
import { createModalsController } from './ui/modals.js?v=20261124z87';

export { createWeaponSvg } from './ui/svgIcons.js?v=20261124z87';

const DIFFICULTY_OPTIONS = [
  { id: 'easy', labelRu: 'Странник', noteRu: 'Мягкий режим (в разработке)' },
  { id: 'normal', labelRu: 'Обычная', noteRu: 'Базовый баланс Замка Пепла' },
  { id: 'hard', labelRu: 'Пепел', noteRu: 'Испытание (в разработке)' }
];

export function createUIManager(initialCallbacks = {}) {
  let callbacks = { ...initialCallbacks };
  let lang = 'ru';
  let muted = false;
  let volume = 0.75;
  let lastNonZeroVolume = 0.75;
  let musicVolume = 0.38;
  let voiceVolume = 1.0;
  let lowSpecEnabled = false;
  let showFpsEnabled = true;
  let showUncappedFpsEnabled = true;
  let selectedDifficulty = 'normal';
  let difficultyDrawerOpen = false;
  let hasSoulsSave = false;
  let savedZoneCaption = '';

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
    if (/контр\s*удар/i.test(String(text ?? ''))) return;
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
  // 2. IN-GAME COMBAT HUD (Pure Gothic Soulslike — Zero PvE Clutter / Emojis)
  // =========================================================================
  const hudScreen = el('div', 'hud-screen is-souls-mode hidden');
  const hudTopRow = el('div', 'hud-top-row');

  // Top-Left: Crimson HP Bar + Muted Olive-Emerald Stamina Bar (NO fake "Блок 0%" pill!)
  const hudTopLeft = el('div', 'hud-top-left');
  const hpRowWrap = el('div', 'hp-row-wrap');
  const hpBarFrame = el('div', 'hp-bar-frame');
  const hpBarTrail = el('div', 'hp-bar-trail');
  const hpBarFill = el('div', 'hp-bar-fill');
  const hpBarText = el('div', 'hp-bar-text', '150 / 150');
  hpBarFrame.append(hpBarTrail, hpBarFill, hpBarText);
  hpRowWrap.appendChild(hpBarFrame);

  const soulsStaminaWrap = el('div', 'souls-stamina-wrap');
  const soulsStaminaFrame = el('div', 'souls-stamina-frame');
  const soulsStaminaFill = el('div', 'souls-stamina-fill');
  const soulsStaminaText = el('div', 'souls-stamina-text', 'ВЫН. 100 / 100');
  soulsStaminaFrame.append(soulsStaminaFill, soulsStaminaText);
  soulsStaminaWrap.appendChild(soulsStaminaFrame);

  hudTopLeft.append(hpRowWrap, soulsStaminaWrap);

  // Top-Center: Compact Gothic Zone Ribbon + Boss HP & Poise/Stagger Bar
  const hudTopCenter = el('div', 'hud-top-center');
  const waveBox = el('div', 'wave-box');
  const hudLevelTitle = el('div', 'hud-level-title', 'Замок Пепла');
  const hudWaveTimer = el('div', 'hud-wave-timer', 'Иди на север');
  waveBox.append(hudLevelTitle, hudWaveTimer);

  const bossBarBox = el('div', 'boss-bar-box hidden');
  const bossBarHeader = el('div', 'boss-bar-header');
  const bossBarName = el('span', 'boss-bar-name', 'СУДИЯ РУИН');
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

  hudTopCenter.append(waveBox, bossBarBox);

  // Top-Right: Monochrome Antique-Gold SVG Sound + Fullscreen + Pause
  const hudTopRight = el('div', 'hud-top-right');
  const hudActionsRow = el('div', 'hud-actions-row');

  const hudMuteBtn = el('button', 'hud-btn icon-btn sound-trigger-btn');
  hudMuteBtn.type = 'button';
  hudMuteBtn.title = 'Настройки звука';
  hudMuteBtn.setAttribute('aria-label', 'Звук');

  const makeFullscreenSvg = (isFs = false) =>
    isFs
      ? `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7.5 3.2 V7.5 H3.2 M12.5 3.2 V7.5 H16.8 M7.5 16.8 V12.5 H3.2 M12.5 16.8 V12.5 H16.8" stroke="#e5c787" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3.2 7.5 V3.2 H7.5 M16.8 7.5 V3.2 H12.5 M3.2 12.5 V16.8 H7.5 M16.8 12.5 V16.8 H12.5" stroke="#e5c787" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const fullscreenBtns = [];
  function syncFullscreenButtons() {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    for (const btn of fullscreenBtns) {
      btn.replaceChildren(makeSvgNode(makeFullscreenSvg(isFs)));
      btn.title = isFs ? 'Выйти из полноэкранного режима' : 'Открыть игру на весь экран';
      btn.setAttribute('aria-pressed', isFs ? 'true' : 'false');
    }
  }
  function toggleAppFullscreen() {
    const doc = document;
    const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (isFs) {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) Promise.resolve(exit.call(doc)).catch(() => {});
    } else {
      const target = doc.documentElement || doc.body;
      const req = target?.requestFullscreen || target?.webkitRequestFullscreen;
      if (req) Promise.resolve(req.call(target)).catch(() => {});
    }
    setTimeout(() => {
      syncFullscreenButtons();
      window.dispatchEvent(new Event('resize'));
    }, 120);
  }
  document.addEventListener('fullscreenchange', () => {
    syncFullscreenButtons();
    window.dispatchEvent(new Event('resize'));
  });
  document.addEventListener('webkitfullscreenchange', () => {
    syncFullscreenButtons();
    window.dispatchEvent(new Event('resize'));
  });

  const hudFullscreenBtn = el('button', 'hud-btn icon-btn hud-fullscreen-btn');
  hudFullscreenBtn.type = 'button';
  hudFullscreenBtn.title = 'Открыть игру на весь экран';
  hudFullscreenBtn.setAttribute('aria-label', 'На весь экран');
  hudFullscreenBtn.addEventListener('click', toggleAppFullscreen);
  fullscreenBtns.push(hudFullscreenBtn);

  const hudHomeBtn = el('button', 'hud-btn icon-btn hud-pause-btn');
  hudHomeBtn.type = 'button';
  hudHomeBtn.title = 'Пауза [Esc]';
  hudHomeBtn.setAttribute('aria-label', 'Пауза');
  hudHomeBtn.appendChild(
    makeSvgNode(
      `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="4" width="3.6" height="12" rx="1.2" fill="#e5c787"/><rect x="11.4" y="4" width="3.6" height="12" rx="1.2" fill="#e5c787"/></svg>`
    )
  );
  hudHomeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onTogglePause?.();
  });

  hudActionsRow.append(hudMuteBtn, hudFullscreenBtn, hudHomeBtn);
  syncFullscreenButtons();
  hudTopRight.appendChild(hudActionsRow);

  hudTopRow.append(hudTopLeft, hudTopCenter, hudTopRight);

  // =========================================================================
  // 3. FLOATING LEFT-BOTTOM VIRTUAL JOYSTICK & 6 OBSIDIAN+GOLD TOUCH BUTTONS
  // =========================================================================
  const isTouchCapable =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));
  let soulsModeActive = true;

  const touchLayer = el('div', `touch-layer is-souls-touch${isTouchCapable ? '' : ' hidden'}`);
  const leftZone = el('div', 'touch-zone-left');
  const rightCamZone = el('div', 'touch-camera-zone');
  const leftBase = el('div', 'joystick-base left-stick');
  const leftSprintRing = el('div', 'joystick-sprint-ring');
  const leftSprintTag = el('span', 'joystick-sprint-tag', 'СПРИНТ');
  const leftRingSvg = makeSvgNode(
    `<svg viewBox="0 0 112 112" width="112" height="112" fill="none" xmlns="http://www.w3.org/2000/svg" class="joystick-ring-svg">
      <circle cx="56" cy="56" r="52" stroke="rgba(229,199,135,0.40)" stroke-width="1.5" stroke-dasharray="6 5"/>
      <polygon points="56,9 60,16 52,16" fill="rgba(229,199,135,0.52)"/>
      <polygon points="56,103 60,96 52,96" fill="rgba(229,199,135,0.52)"/>
      <polygon points="9,56 16,52 16,60" fill="rgba(229,199,135,0.52)"/>
      <polygon points="103,56 96,52 96,60" fill="rgba(229,199,135,0.52)"/>
    </svg>`
  );
  const leftKnob = el('div', 'joystick-knob');
  const leftCap = el('span', 'joystick-caption', 'ДВИЖЕНИЕ');
  leftBase.append(leftSprintRing, leftSprintTag, leftRingSvg, leftKnob, leftCap);

  const TOUCH_DASH_RING_CIRC = 207.35;
  const touchDashBtn = el('button', 'touch-dash-btn is-ready');
  touchDashBtn.type = 'button';
  touchDashBtn.setAttribute('aria-label', 'Перекат');
  const touchDashRingSvg = makeSvgNode(
    `<svg viewBox="0 0 76 76" width="76" height="76" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-dash-ring-svg" aria-hidden="true">
      <circle cx="38" cy="38" r="33" class="touch-dash-ring-track"/>
      <circle cx="38" cy="38" r="33" class="touch-dash-ring-fill" stroke-dasharray="${TOUCH_DASH_RING_CIRC}" stroke-dashoffset="0"/>
    </svg>`
  );
  const touchDashRingFill = touchDashRingSvg.querySelector('.touch-dash-ring-fill');
  const touchDashIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-dash-svg" aria-hidden="true">
      <path d="M3.5 9.2 H11.5 M2.2 13 H9.5 M4.8 16.8 H10.8" stroke="#c8b07a" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10.5 5.2 L20.8 12 L10.5 18.8 L13.4 12 Z" fill="#e5c787" stroke="#f6e7c4" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`
  );
  const touchDashLabel = el('span', 'touch-dash-label', 'ПЕРЕКАТ');
  touchDashBtn.append(touchDashRingSvg, touchDashIcon, touchDashLabel);

  const touchSoulsCluster = el('div', 'touch-souls-cluster');
  const makeSoulsBtnSvg = (innerPath, size = 24) =>
    makeSvgNode(
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" xmlns="http://www.w3.org/2000/svg" class="touch-souls-svg" aria-hidden="true">${innerPath}</svg>`
    );

  const touchAttackBtn = el('button', 'touch-souls-btn touch-souls-r1');
  touchAttackBtn.type = 'button';
  touchAttackBtn.setAttribute('aria-label', 'Удар');
  const touchAttackIco = el('span', 'touch-souls-ico');
  touchAttackIco.appendChild(
    makeSoulsBtnSvg(
      '<path d="M18.8 4.2 L10.2 12.8 L8.4 11 L17 2.4 L19.8 2.2 Z" fill="#f3d69b" stroke="#2c1608" stroke-width="0.9"/><path d="M7.6 10.6 L13.4 16.4 M6.4 17.6 L9.8 14.2 M4.6 19.4 L6.8 17.2" stroke="#e5b85c" stroke-width="2" stroke-linecap="round"/>',
      26
    )
  );
  const touchAttackLbl = el('span', 'touch-souls-lbl', 'УДАР');
  touchAttackBtn.append(touchAttackIco, touchAttackLbl);

  const touchBlockBtn = el('button', 'touch-souls-btn touch-souls-block');
  touchBlockBtn.type = 'button';
  touchBlockBtn.setAttribute('aria-label', 'Щит: удержание — блок, в такт удара — парирование');
  const touchBlockIco = el('span', 'touch-souls-ico');
  touchBlockIco.appendChild(
    makeSoulsBtnSvg(
      '<path d="M12 2.8 L19.4 5.8 V11.4 C19.4 16.2 16.2 19.8 12 21.4 C7.8 19.8 4.6 16.2 4.6 11.4 V5.8 Z" fill="rgba(229,184,92,0.16)" stroke="#e5c787" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 5.6 V18.2 M8 10.6 H16" stroke="#d4b06a" stroke-width="1.4" stroke-linecap="round"/>',
      24
    )
  );
  const touchBlockLbl = el('span', 'touch-souls-lbl', 'ЩИТ');
  touchBlockBtn.append(touchBlockIco, touchBlockLbl);

  const touchFlaskBtn = el('button', 'touch-souls-btn touch-souls-flask');
  touchFlaskBtn.type = 'button';
  touchFlaskBtn.setAttribute('aria-label', 'Фляга');
  const touchFlaskIco = el('span', 'touch-souls-ico');
  touchFlaskIco.appendChild(
    makeSoulsBtnSvg(
      '<path d="M9.6 3 H14.4 M10.6 3 V7.2 L6.2 14.5 C5.4 16 6.4 19.2 8.8 19.2 H15.2 C17.6 19.2 18.6 16 17.8 14.5 L13.4 7.2 V3" stroke="#e8c376" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.8 14.4 H16.2 L16.8 15.8 C17.1 16.6 16.5 17.8 15.2 17.8 H8.8 C7.5 17.8 6.9 16.6 7.2 15.8 Z" fill="#d97706"/>',
      19
    )
  );
  const touchFlaskCountLbl = el('span', 'touch-souls-lbl', '4/4');
  touchFlaskBtn.append(touchFlaskIco, touchFlaskCountLbl);

  const touchAutoFlaskBtn = el('button', 'touch-auto-flask-pill is-enabled');
  touchAutoFlaskBtn.type = 'button';
  touchAutoFlaskBtn.setAttribute('aria-label', 'Автоматическое лечение флягой');
  touchAutoFlaskBtn.setAttribute('aria-pressed', 'true');
  const touchAutoFlaskDot = el('span', 'touch-auto-flask-dot');
  const touchAutoFlaskTxt = el('span', 'touch-auto-flask-txt', 'АВТО-ХИЛ');
  touchAutoFlaskBtn.append(touchAutoFlaskDot, touchAutoFlaskTxt);

  const touchLockBtn = el('button', 'touch-souls-btn touch-souls-lock is-smart-auto');
  touchLockBtn.type = 'button';
  touchLockBtn.setAttribute('aria-label', 'Умный прицел');
  const touchLockIco = el('span', 'touch-souls-ico');
  touchLockIco.appendChild(
    makeSoulsBtnSvg(
      '<circle cx="12" cy="12" r="6.4" stroke="#e5c787" stroke-width="1.6"/><circle cx="12" cy="12" r="2.1" fill="#e5b85c"/><path d="M12 2.5 V5.6 M12 18.4 V21.5 M2.5 12 H5.6 M18.4 12 H21.5" stroke="#e5c787" stroke-width="1.6" stroke-linecap="round"/>',
      18
    )
  );
  const touchLockLbl = el('span', 'touch-souls-lbl', 'АВТО');
  touchLockBtn.append(touchLockIco, touchLockLbl);

  leftBase.dataset.touchId = 'joystick';
  touchAttackBtn.dataset.touchId = 'attack';
  touchDashBtn.dataset.touchId = 'dash';
  touchBlockBtn.dataset.touchId = 'block';
  touchFlaskBtn.dataset.touchId = 'flask';
  touchAutoFlaskBtn.dataset.touchId = 'auto_flask';
  touchLockBtn.dataset.touchId = 'lock';

  touchSoulsCluster.append(
    touchAttackBtn,
    touchBlockBtn,
    touchFlaskBtn,
    touchAutoFlaskBtn,
    touchLockBtn
  );
  touchLayer.append(leftZone, rightCamZone, leftBase, touchDashBtn, touchSoulsCluster);

  // =========================================================================
  // 4. BOTTOM COMBAT HUD DOCK (Desktop Gothic Action Pills — Heavy Attack Removed)
  // =========================================================================
  const hudBottomDock = el('div', 'hud-bottom-dock');
  const hudWeaponRow = el('div', 'hud-weapon-row');

  const weaponHudBadge = el('div', 'weapon-hud-badge');
  const weaponHudIcon = el('span', 'weapon-hud-icon');
  weaponHudIcon.appendChild(createWeaponSvg('club', 'hud-wpn-svg'));
  const weaponHudCol = el('div', 'weapon-hud-col');
  const weaponHudMain = el('div', 'weapon-hud-main');
  const weaponHudName = el('span', 'weapon-hud-name', WEAPONS.club?.nameRu || 'Меч Клятвы');
  weaponHudMain.appendChild(weaponHudName);
  weaponHudCol.appendChild(weaponHudMain);
  weaponHudBadge.append(weaponHudIcon, weaponHudCol);

  const HUD_DASH_RING_CIRC = 87.96;
  const hudDashBtn = el('button', 'hud-dash-btn is-ready');
  hudDashBtn.type = 'button';
  hudDashBtn.title = 'Перекат с неуязвимостью [Space]';
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
      <path d="M3.5 9.2 H11.2 M2.4 13 H9.4 M5 16.8 H10.6" stroke="#c8b07a" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10.4 5.2 L20.6 12 L10.4 18.8 L13.3 12 Z" fill="#e5c787" stroke="#f6e7c4" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`
  );
  hudDashRingWrap.append(hudDashRingSvg, hudDashIcon);
  const hudDashMeta = el('span', 'hud-dash-meta');
  const hudDashStateText = el('span', 'hud-dash-state', 'ПЕРЕКАТ');
  const hudDashKeyTag = el('span', 'hud-dash-key', '[Space]');
  hudDashMeta.append(hudDashStateText, hudDashKeyTag);
  const hudDashBarTrack = el('span', 'hud-dash-bar-track');
  const hudDashBarFill = el('span', 'hud-dash-bar-fill');
  hudDashBarTrack.appendChild(hudDashBarFill);
  hudDashBtn.append(hudDashRingWrap, hudDashMeta, hudDashBarTrack);

  const hudBlockBtn = el('button', 'hud-souls-block-btn');
  hudBlockBtn.type = 'button';
  hudBlockBtn.title = 'Удерживать [ПКМ] — Блок щитом • Точное нажатие — Парирование (×2.2 контрудар)';
  const hudBlockIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2.4 L19.8 5.6 V11.4 C19.8 16.4 16.4 20.1 12 21.8 C7.6 20.1 4.2 16.4 4.2 11.4 V5.6 Z" fill="#1b1815" stroke="#d8b56c" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M12 5.4 V18.6 M7.6 10.6 H16.4" stroke="#c8a862" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  );
  const hudBlockMeta = el('span', 'hud-souls-meta');
  const hudBlockStateText = el('span', 'hud-souls-state', 'БЛОК / ПАРИР.');
  hudBlockMeta.append(hudBlockStateText, el('span', 'hud-souls-key', '[ПКМ]'));
  hudBlockBtn.append(hudBlockIcon, hudBlockMeta);

  const hudFlaskBtn = el('button', 'hud-souls-flask-btn');
  hudFlaskBtn.type = 'button';
  hudFlaskBtn.title = 'Фляга Пепла [R] — восстанавливает здоровье (восполняется у Костра)';
  const hudFlaskIcon = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9.5 3 H14.5 M10.5 3 V7.2 L5.8 14.8 C4.9 16.3 5.9 19.6 8.4 19.6 H15.6 C18.1 19.6 19.1 16.3 18.2 14.8 L13.5 7.2 V3" stroke="#e2be72" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M7.6 14.6 H16.4 L17.1 16 C17.5 16.9 16.9 18.2 15.6 18.2 H8.4 C7.1 18.2 6.5 16.9 6.9 16 Z" fill="#d97706"/>
    </svg>`
  );
  const hudFlaskMeta = el('span', 'hud-souls-meta');
  const hudFlaskStateText = el('span', 'hud-souls-state', 'ФЛЯГА 4/4');
  hudFlaskMeta.append(hudFlaskStateText, el('span', 'hud-souls-key', '[R]'));
  hudFlaskBtn.append(hudFlaskIcon, hudFlaskMeta);

  const hudLockBtn = el('button', 'hud-lock-btn');
  hudLockBtn.type = 'button';
  hudLockBtn.title = 'Захват цели [Q / СКМ] • Сменить цель [Tab]';
  hudLockBtn.setAttribute('aria-pressed', 'false');
  const hudLockGlyph = makeSvgNode(
    `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" xmlns="http://www.w3.org/2000/svg" class="hud-lock-svg" aria-hidden="true">
      <circle cx="12" cy="12" r="6.2" stroke="#e2be72" stroke-width="1.6"/>
      <circle cx="12" cy="12" r="2" fill="#e5b85c"/>
      <path d="M12 2.5 V5.6 M12 18.4 V21.5 M2.5 12 H5.6 M18.4 12 H21.5" stroke="#e2be72" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`
  );
  const hudLockMeta = el('span', 'hud-souls-meta');
  hudLockMeta.append(el('span', 'hud-souls-state hud-lock-state', 'ЦЕЛЬ'), el('span', 'hud-souls-key', '[Q]'));
  hudLockBtn.append(hudLockGlyph, hudLockMeta);

  hudWeaponRow.append(weaponHudBadge, hudDashBtn, hudBlockBtn, hudFlaskBtn, hudLockBtn);
  hudBottomDock.appendChild(hudWeaponRow);
  hudScreen.append(hudTopRow, touchLayer, hudBottomDock);
  root.appendChild(hudScreen);

  // =========================================================================
  // TOUCH & ACTION BUTTON INPUT CONTROLLER + INTERACTIVE LAYOUT CUSTOMIZER
  // =========================================================================
  const TOUCH_LAYOUT_STORAGE_KEY = 'grimborne_touch_layout_v1';
  const TOUCH_EDITABLE_ITEMS = [
    { id: 'attack', el: touchAttackBtn, labelRu: 'Удар' },
    { id: 'dash', el: touchDashBtn, labelRu: 'Перекат' },
    { id: 'block', el: touchBlockBtn, labelRu: 'Щит / Парир.' },
    { id: 'flask', el: touchFlaskBtn, labelRu: 'Фляга' },
    { id: 'auto_flask', el: touchAutoFlaskBtn, labelRu: 'Авто-хил' },
    { id: 'lock', el: touchLockBtn, labelRu: 'Прицел' },
    { id: 'joystick', el: leftBase, labelRu: 'Джойстик' }
  ];
  const TOUCH_ITEM_BY_ID = new Map(TOUCH_EDITABLE_ITEMS.map((it) => [it.id, it]));

  function clampNum(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function sanitizeTouchLayoutMap(raw) {
    const clean = {};
    if (!raw || typeof raw !== 'object') return clean;
    for (const item of TOUCH_EDITABLE_ITEMS) {
      const entry = raw[item.id];
      if (!entry || typeof entry !== 'object') continue;
      const out = {};
      if (Number.isFinite(Number(entry.xPct)) && Number.isFinite(Number(entry.yPct))) {
        out.xPct = Number(clampNum(Number(entry.xPct), item.id === 'joystick' ? 6 : 4, item.id === 'joystick' ? 65 : 96).toFixed(2));
        out.yPct = Number(clampNum(Number(entry.yPct), 7, 93).toFixed(2));
      }
      if (Number.isFinite(Number(entry.scale))) {
        out.scale = Number(clampNum(Number(entry.scale), 0.60, 1.75).toFixed(2));
      }
      if (out.xPct !== undefined || (out.scale !== undefined && Math.abs(out.scale - 1) > 0.01)) {
        clean[item.id] = out;
      }
    }
    return clean;
  }

  function readSavedTouchLayout() {
    try {
      const raw = localStorage.getItem(TOUCH_LAYOUT_STORAGE_KEY);
      if (!raw) return {};
      return sanitizeTouchLayoutMap(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  function writeSavedTouchLayout(mapObj) {
    try {
      const clean = sanitizeTouchLayoutMap(mapObj);
      if (Object.keys(clean).length === 0) {
        localStorage.removeItem(TOUCH_LAYOUT_STORAGE_KEY);
      } else {
        localStorage.setItem(TOUCH_LAYOUT_STORAGE_KEY, JSON.stringify(clean));
      }
    } catch {}
  }

  let customTouchLayout = readSavedTouchLayout();
  let editDraftLayout = null;
  let isTouchEditMode = false;
  let touchEditSelectedId = 'attack';
  let touchEditFinishCb = null;

  function getActiveTouchLayout() {
    return isTouchEditMode && editDraftLayout ? editDraftLayout : customTouchLayout;
  }

  function hasCustomTouchLayout() {
    return Object.keys(customTouchLayout || {}).length > 0;
  }

  function getJoystickCustomCfg() {
    const map = getActiveTouchLayout();
    return map?.joystick || null;
  }

  function applyTouchCustomLayout() {
    const map = getActiveTouchLayout();
    for (const item of TOUCH_EDITABLE_ITEMS) {
      const cfg = map?.[item.id] || null;
      const scale = clampNum(Number(cfg?.scale) || 1, 0.60, 1.75);
      item.el.style.setProperty('--touch-scale', scale.toFixed(3));
      const hasPos = Number.isFinite(cfg?.xPct) && Number.isFinite(cfg?.yPct);
      if (item.id === 'joystick') {
        if (!leftBase.classList.contains('is-active')) {
          if (hasPos) {
            leftBase.classList.add('has-custom-pos');
            leftBase.style.left = `${cfg.xPct.toFixed(2)}%`;
            leftBase.style.top = `${cfg.yPct.toFixed(2)}%`;
            leftBase.style.bottom = 'auto';
            leftBase.style.transform = '';
            leftZone.style.width = `${Math.round(clampNum(Math.max(50, cfg.xPct + 14), 50, 68))}%`;
          } else {
            leftBase.classList.remove('has-custom-pos');
            leftBase.style.left = '';
            leftBase.style.top = '';
            leftBase.style.bottom = '';
            leftBase.style.transform = '';
            leftZone.style.width = '';
          }
        }
      } else if (hasPos) {
        item.el.classList.add('has-custom-pos');
        item.el.style.left = `${cfg.xPct.toFixed(2)}%`;
        item.el.style.top = `${cfg.yPct.toFixed(2)}%`;
        item.el.style.right = 'auto';
        item.el.style.bottom = 'auto';
      } else {
        item.el.classList.remove('has-custom-pos');
        item.el.style.left = '';
        item.el.style.top = '';
        item.el.style.right = '';
        item.el.style.bottom = '';
      }
      item.el.classList.toggle('is-edit-selected', isTouchEditMode && touchEditSelectedId === item.id);
    }
  }
  applyTouchCustomLayout();

  // Interactive Touch Layout Editor Toolbar (top-center inside HUD)
  const touchEditToolbar = el('div', 'touch-edit-toolbar hidden');
  const touchEditHead = el('div', 'touch-edit-head');
  const touchEditTitle = el('span', 'touch-edit-title', 'НАСТРОЙКА КНОПОК');
  const touchEditTargetBadge = el('span', 'touch-edit-target', 'Удар • 100%');
  touchEditHead.append(touchEditTitle, touchEditTargetBadge);
  const touchEditHint = el('div', 'touch-edit-hint', 'Перетащите любую кнопку или джойстик пальцем по экрану');

  const touchEditScaleRow = el('div', 'touch-edit-scale-row');
  const touchEditScaleLbl = el('span', 'touch-edit-scale-lbl', 'Размер');
  const touchEditMinusBtn = el('button', 'touch-edit-step-btn', '−');
  touchEditMinusBtn.type = 'button';
  const touchEditScaleSlider = document.createElement('input');
  touchEditScaleSlider.type = 'range';
  touchEditScaleSlider.className = 'sound-volume-slider touch-edit-slider';
  touchEditScaleSlider.min = '60';
  touchEditScaleSlider.max = '175';
  touchEditScaleSlider.step = '5';
  touchEditScaleSlider.value = '100';
  const touchEditPlusBtn = el('button', 'touch-edit-step-btn', '+');
  touchEditPlusBtn.type = 'button';
  touchEditScaleRow.append(touchEditScaleLbl, touchEditMinusBtn, touchEditScaleSlider, touchEditPlusBtn);

  const touchEditActions = el('div', 'touch-edit-actions');
  const touchEditResetBtn = el('button', 'souls-settings-danger-btn touch-edit-btn', 'Сбросить');
  touchEditResetBtn.type = 'button';
  const touchEditCancelBtn = el('button', 'souls-settings-pill-btn touch-edit-btn', 'Отмена');
  touchEditCancelBtn.type = 'button';
  const touchEditSaveBtn = el('button', 'souls-settings-primary-btn touch-edit-btn', 'Сохранить');
  touchEditSaveBtn.type = 'button';
  touchEditActions.append(touchEditResetBtn, touchEditCancelBtn, touchEditSaveBtn);

  touchEditToolbar.append(touchEditHead, touchEditHint, touchEditScaleRow, touchEditActions);
  hudScreen.appendChild(touchEditToolbar);

  function syncTouchEditToolbar() {
    if (!isTouchEditMode) return;
    const item = TOUCH_ITEM_BY_ID.get(touchEditSelectedId) || TOUCH_EDITABLE_ITEMS[0];
    const cfg = editDraftLayout?.[item.id] || {};
    const pct = Math.round(clampNum(Number(cfg.scale) || 1, 0.60, 1.75) * 100);
    touchEditTargetBadge.textContent = `${item.labelRu} • ${pct}%`;
    touchEditScaleSlider.value = String(pct);
    const fillPct = Math.round(((pct - 60) / (175 - 60)) * 100);
    touchEditScaleSlider.style.setProperty('--vol-pct', `${fillPct}%`);
    for (const it of TOUCH_EDITABLE_ITEMS) {
      it.el.classList.toggle('is-edit-selected', it.id === item.id);
    }
  }

  function setSelectedTouchItemScalePct(rawPct) {
    if (!isTouchEditMode || !editDraftLayout) return;
    const item = TOUCH_ITEM_BY_ID.get(touchEditSelectedId) || TOUCH_EDITABLE_ITEMS[0];
    const pct = Math.round(clampNum(Number(rawPct) || 100, 60, 175));
    const prev = editDraftLayout[item.id] || {};
    editDraftLayout[item.id] = {
      ...prev,
      scale: Number((pct / 100).toFixed(2))
    };
    applyTouchCustomLayout();
    syncTouchEditToolbar();
  }

  touchEditScaleSlider.addEventListener('input', () => {
    setSelectedTouchItemScalePct(touchEditScaleSlider.value);
  });
  touchEditMinusBtn.addEventListener('click', () => {
    setSelectedTouchItemScalePct((Number(touchEditScaleSlider.value) || 100) - 10);
  });
  touchEditPlusBtn.addEventListener('click', () => {
    setSelectedTouchItemScalePct((Number(touchEditScaleSlider.value) || 100) + 10);
  });
  touchEditResetBtn.addEventListener('click', () => {
    if (!isTouchEditMode) return;
    editDraftLayout = {};
    applyTouchCustomLayout();
    syncTouchEditToolbar();
  });
  touchEditCancelBtn.addEventListener('click', () => {
    closeTouchEditMode(false);
  });
  touchEditSaveBtn.addEventListener('click', () => {
    closeTouchEditMode(true);
  });

  // Capture-phase drag & tap-select on touchLayer while in Edit Mode (blocks accidental attacks/actions!)
  let editDragPid = null;
  let editDragItemId = null;
  let editGrabOffX = 0;
  let editGrabOffY = 0;

  const getEditVp = () => {
    const vp = window.__getGameViewportSize?.();
    return { w: Math.max(1, vp?.w || window.innerWidth || 960), h: Math.max(1, vp?.h || window.innerHeight || 540) };
  };
  const mapEditPt = (cx, cy) => (window.__toGameCoords ? window.__toGameCoords(cx, cy) : { x: cx, y: cy });

  touchLayer.addEventListener(
    'pointerdown',
    (e) => {
      if (!isTouchEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      const hitEl = e.target?.closest?.('[data-touch-id]');
      if (!hitEl) return;
      const id = hitEl.dataset.touchId;
      const item = TOUCH_ITEM_BY_ID.get(id);
      if (!item || !editDraftLayout) return;

      touchEditSelectedId = id;
      const rect = item.el.getBoundingClientRect();
      const centerPt = mapEditPt(rect.left + rect.width * 0.5, rect.top + rect.height * 0.5);
      const fingerPt = mapEditPt(e.clientX, e.clientY);
      editGrabOffX = centerPt.x - fingerPt.x;
      editGrabOffY = centerPt.y - fingerPt.y;
      editDragPid = e.pointerId;
      editDragItemId = id;
      try { touchLayer.setPointerCapture(e.pointerId); } catch {}

      const { w, h } = getEditVp();
      const prev = editDraftLayout[id] || {};
      if (!Number.isFinite(prev.xPct) || !Number.isFinite(prev.yPct)) {
        editDraftLayout[id] = {
          ...prev,
          xPct: Number(clampNum((centerPt.x / w) * 100, id === 'joystick' ? 6 : 4, id === 'joystick' ? 65 : 96).toFixed(2)),
          yPct: Number(clampNum((centerPt.y / h) * 100, 7, 93).toFixed(2))
        };
      }
      applyTouchCustomLayout();
      syncTouchEditToolbar();
    },
    { capture: true }
  );

  touchLayer.addEventListener(
    'pointermove',
    (e) => {
      if (!isTouchEditMode || editDragPid === null || e.pointerId !== editDragPid || !editDragItemId || !editDraftLayout) return;
      e.preventDefault();
      e.stopPropagation();
      const fingerPt = mapEditPt(e.clientX, e.clientY);
      const { w, h } = getEditVp();
      const cx = fingerPt.x + editGrabOffX;
      const cy = fingerPt.y + editGrabOffY;
      const minX = editDragItemId === 'joystick' ? 6 : 4;
      const maxX = editDragItemId === 'joystick' ? 65 : 96;
      const prev = editDraftLayout[editDragItemId] || {};
      editDraftLayout[editDragItemId] = {
        ...prev,
        xPct: Number(clampNum((cx / w) * 100, minX, maxX).toFixed(2)),
        yPct: Number(clampNum((cy / h) * 100, 7, 93).toFixed(2))
      };
      applyTouchCustomLayout();
    },
    { capture: true }
  );

  const finishEditDrag = (e) => {
    if (!isTouchEditMode) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (editDragPid !== null && (!e || e.pointerId === undefined || e.pointerId === editDragPid)) {
      try {
        if (touchLayer.hasPointerCapture?.(editDragPid)) touchLayer.releasePointerCapture(editDragPid);
      } catch {}
      editDragPid = null;
      editDragItemId = null;
    }
  };
  touchLayer.addEventListener('pointerup', finishEditDrag, { capture: true });
  touchLayer.addEventListener('pointercancel', finishEditDrag, { capture: true });

  function openTouchEditMode({ fromHub = false, onFinish = null } = {}) {
    releaseLeftStick();
    clearAllTouchActions();
    editDraftLayout = JSON.parse(JSON.stringify(customTouchLayout || {}));
    isTouchEditMode = true;
    touchEditFinishCb = typeof onFinish === 'function' ? onFinish : null;
    if (!TOUCH_ITEM_BY_ID.has(touchEditSelectedId)) touchEditSelectedId = 'attack';
    if (fromHub) {
      hubScreen.classList.add('hidden');
    }
    hudScreen.classList.remove('hidden');
    hudScreen.classList.add('is-touch-editing');
    soulsModeActive = true;
    touchLayer.classList.remove('hidden');
    syncSoulsTouchLayout();
    touchEditToolbar.classList.remove('hidden');
    applyTouchCustomLayout();
    syncTouchEditToolbar();
  }

  function closeTouchEditMode(saveChanges = true) {
    if (!isTouchEditMode) return;
    if (saveChanges && editDraftLayout) {
      customTouchLayout = sanitizeTouchLayoutMap(editDraftLayout);
      writeSavedTouchLayout(customTouchLayout);
    }
    editDraftLayout = null;
    editDragPid = null;
    editDragItemId = null;
    isTouchEditMode = false;
    touchEditToolbar.classList.add('hidden');
    hudScreen.classList.remove('is-touch-editing');
    if (!isTouchCapable) {
      touchLayer.classList.add('hidden');
    }
    applyTouchCustomLayout();
    syncSoulsTouchLayout();
    syncMuteButtons();
    if (saveChanges) {
      showToast('Сенсорное управление сохранено');
    }
    const cb = touchEditFinishCb;
    touchEditFinishCb = null;
    cb?.();
  }

  function resetTouchCustomLayout() {
    customTouchLayout = {};
    writeSavedTouchLayout({});
    if (editDraftLayout) editDraftLayout = {};
    applyTouchCustomLayout();
    syncTouchEditToolbar();
    syncMuteButtons();
  }

  const touchState = {
    moveX: 0,
    moveZ: 0,
    aimX: 0,
    aimZ: 0,
    active: false,
    moveActive: false,
    aimActive: false,
    sprint: false,
    attackSeq: 0,
    attackTrigger: false,
    attackHeld: false,
    heavyTrigger: false,
    heavyHeld: false,
    camDx: 0,
    camDy: 0,
    dash: false,
    ult: false,
    block: false,
    flask: false,
    interact: false
  };

  const MAX_STICK_RADIUS = 54;
  const SPRINT_ENTER_RATIO = 0.92;
  const SPRINT_EXIT_RATIO = 0.76;
  const DEADZONE = 0.07;

  function syncSoulsTouchLayout() {
    const showCluster = soulsModeActive || isTouchEditMode;
    touchLayer.classList.toggle('is-souls-touch', showCluster);
    rightCamZone.classList.toggle('hidden', !showCluster || isTouchEditMode);
    touchSoulsCluster.classList.toggle('hidden', !showCluster);
    const soulsTouchVisible = showCluster && !touchLayer.classList.contains('hidden');
    hudScreen.classList.toggle('is-souls-touch-active', soulsTouchVisible);
  }

  function clearAllTouchActions() {
    touchState.sprint = false;
    touchState.attackTrigger = false;
    touchState.attackHeld = false;
    touchState.heavyTrigger = false;
    touchState.heavyHeld = false;
    touchState.camDx = 0;
    touchState.camDy = 0;
    touchState.dash = false;
    touchState.ult = false;
    touchState.block = false;
    touchState.flask = false;
    touchState.interact = false;
    leftBase.classList.remove('is-sprinting');
    touchAttackBtn.classList.remove('is-pressed');
    touchBlockBtn.classList.remove('is-pressed');
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
      return { w: vp?.w || window.innerWidth || 960, h: vp?.h || window.innerHeight || 540 };
    };
    const getStickScale = () => clampNum(Number(getJoystickCustomCfg()?.scale) || 1, 0.60, 1.75);

    const placeBaseAtFinger = (rawClientX, rawClientY) => {
      if (returnTimer) {
        clearTimeout(returnTimer);
        returnTimer = null;
      }
      baseEl.classList.remove('is-returning');
      const pt = mapPt(rawClientX, rawClientY);
      const { w, h } = getVpSize();
      const jCfg = getJoystickCustomCfg();
      const maxOriginFrac = Number.isFinite(jCfg?.xPct) ? clampNum(Math.max(0.50, (jCfg.xPct + 12) / 100), 0.50, 0.68) : 0.50;
      originX = Math.max(54, Math.min(w * maxOriginFrac, pt.x));
      originY = Math.max(72, Math.min(h - 54, pt.y));
      baseEl.style.left = `${Math.round(originX)}px`;
      baseEl.style.top = `${Math.round(originY)}px`;
      baseEl.style.bottom = 'auto';
      baseEl.style.transform = 'translate3d(-50%, -50%, 0) scale(var(--touch-scale, 1))';
      baseEl.classList.add('is-active');
    };

    const updateStickVector = (rawClientX, rawClientY) => {
      const pt = mapPt(rawClientX, rawClientY);
      const dx = pt.x - originX;
      const dy = pt.y - originY;
      const dist = Math.hypot(dx, dy);
      const effRadius = MAX_STICK_RADIUS * getStickScale();
      const clamped = Math.min(dist, effRadius);
      const angle = dist > 0.0001 ? Math.atan2(dy, dx) : 0;

      const invScale = 1 / getStickScale();
      const kx = Math.cos(angle) * clamped * invScale;
      const ky = Math.sin(angle) * clamped * invScale;
      knobEl.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;

      const norm = clamped / effRadius;
      touchState.moveX = norm < DEADZONE ? 0 : (Math.cos(angle) * clamped) / effRadius;
      touchState.moveZ = norm < DEADZONE ? 0 : (Math.sin(angle) * clamped) / effRadius;

      if (!touchState.sprint && dist > effRadius * SPRINT_ENTER_RATIO) {
        touchState.sprint = true;
        baseEl.classList.add('is-sprinting');
      } else if (touchState.sprint && dist < effRadius * SPRINT_EXIT_RATIO) {
        touchState.sprint = false;
        baseEl.classList.remove('is-sprinting');
      }
    };

    const restoreRestingBasePos = () => {
      const jCfg = getJoystickCustomCfg();
      if (Number.isFinite(jCfg?.xPct) && Number.isFinite(jCfg?.yPct)) {
        baseEl.classList.add('has-custom-pos');
        baseEl.style.left = `${jCfg.xPct.toFixed(2)}%`;
        baseEl.style.top = `${jCfg.yPct.toFixed(2)}%`;
        baseEl.style.bottom = 'auto';
        baseEl.style.transform = '';
      } else {
        baseEl.classList.remove('has-custom-pos');
        baseEl.style.left = '';
        baseEl.style.top = '';
        baseEl.style.bottom = '';
        baseEl.style.transform = '';
      }
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
      touchState.sprint = false;
      baseEl.classList.remove('is-active', 'is-sprinting');

      if (returnTimer) {
        clearTimeout(returnTimer);
        returnTimer = null;
      }
      if (instant || !wasEngaged) {
        baseEl.classList.remove('is-returning');
        restoreRestingBasePos();
        return;
      }

      const { w, h } = getVpSize();
      const jCfg = getJoystickCustomCfg();
      const targetX = Number.isFinite(jCfg?.xPct) ? (jCfg.xPct / 100) * w : 88;
      const targetY = Number.isFinite(jCfg?.yPct) ? (jCfg.yPct / 100) * h : Math.max(88, h - 152);
      baseEl.classList.add('is-returning');
      baseEl.style.left = `${Math.round(targetX)}px`;
      baseEl.style.top = `${Math.round(targetY)}px`;
      baseEl.style.bottom = 'auto';
      baseEl.style.transform = 'translate3d(-50%, -50%, 0) scale(var(--touch-scale, 1))';
      returnTimer = setTimeout(() => {
        returnTimer = null;
        if (activePointerId === null && activeTouchId === null) {
          baseEl.classList.remove('is-returning');
          restoreRestingBasePos();
        }
      }, 210);
    };

    zoneEl.addEventListener(
      'touchstart',
      (e) => {
        if (hudScreen.classList.contains('hidden')) return;
        e.preventDefault();
        if (touchLayer.classList.contains('hidden')) touchLayer.classList.remove('hidden');
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
        if (activePointerId !== null || activeTouchId !== null) e.preventDefault();
        if (!window.PointerEvent && activeTouchId !== null) {
          for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
              updateStickVector(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
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

    zoneEl.addEventListener('pointerdown', (e) => {
      if (hudScreen.classList.contains('hidden') || activePointerId !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.pointerType === 'touch' && touchLayer.classList.contains('hidden')) {
        touchLayer.classList.remove('hidden');
        syncSoulsTouchLayout();
      }
      activePointerId = e.pointerId;
      try { zoneEl.setPointerCapture(e.pointerId); } catch {}
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
        if (zoneEl.hasPointerCapture?.(e.pointerId)) zoneEl.releasePointerCapture(e.pointerId);
      } catch {}
      releaseStick(false);
    };
    zoneEl.addEventListener('pointerup', onPointerEnd);
    zoneEl.addEventListener('pointercancel', onPointerEnd);
    zoneEl.addEventListener('lostpointercapture', () => {
      if (activePointerId !== null) releaseStick(false);
    });
    window.addEventListener('blur', () => {
      if (activePointerId !== null || activeTouchId !== null) releaseStick(true);
      clearAllTouchActions();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (activePointerId !== null || activeTouchId !== null)) {
        releaseStick(true);
        clearAllTouchActions();
      }
    });

    return () => releaseStick(true);
  }

  const releaseLeftStick = setupFloatingLeftStick(leftZone, leftBase, leftKnob);

  const mapTouchPt = (cx, cy) =>
    window.__toGameCoords ? window.__toGameCoords(cx, cy) : { x: cx, y: cy };
  let lastTouchTargetCycleAt = 0;

  function feedSmartTouchCameraDelta(dx, dy, accumState) {
    if (hudCache.isTargetLocked && accumState) {
      accumState.swipeX += dx;
      accumState.swipeY += dy;
      const nowMs = performance.now();
      if (
        Math.abs(accumState.swipeX) >= 44 &&
        Math.abs(accumState.swipeX) > Math.abs(accumState.swipeY) * 1.3 &&
        nowMs - lastTouchTargetCycleAt >= 260
      ) {
        const dir = accumState.swipeX > 0 ? 1 : -1;
        accumState.swipeX = 0;
        accumState.swipeY = 0;
        lastTouchTargetCycleAt = nowMs;
        callbacks.onCycleTargetLock?.(dir);
        return;
      }
      touchState.camDy += dy * 0.95;
      return;
    }
    touchState.camDx += dx * 1.55;
    touchState.camDy += dy * 1.25;
  }

  (function setupTouchCameraSwipe(camZoneEl) {
    let camPointerId = null;
    let lastX = 0;
    let lastY = 0;
    const accumState = { swipeX: 0, swipeY: 0 };

    camZoneEl.addEventListener('pointerdown', (e) => {
      if (hudScreen.classList.contains('hidden') || e.pointerType === 'mouse' || camPointerId !== null) return;
      e.preventDefault();
      camPointerId = e.pointerId;
      try { camZoneEl.setPointerCapture(e.pointerId); } catch {}
      const pt = mapTouchPt(e.clientX, e.clientY);
      lastX = pt.x;
      lastY = pt.y;
      accumState.swipeX = 0;
      accumState.swipeY = 0;
    });
    camZoneEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== camPointerId) return;
      e.preventDefault();
      const pt = mapTouchPt(e.clientX, e.clientY);
      feedSmartTouchCameraDelta(pt.x - lastX, pt.y - lastY, accumState);
      lastX = pt.x;
      lastY = pt.y;
    });
    const releaseCam = (e) => {
      if (e && e.pointerId !== undefined && e.pointerId !== camPointerId) return;
      if (camPointerId !== null) {
        try {
          if (camZoneEl.hasPointerCapture?.(camPointerId)) camZoneEl.releasePointerCapture(camPointerId);
        } catch {}
      }
      camPointerId = null;
      accumState.swipeX = 0;
      accumState.swipeY = 0;
    };
    camZoneEl.addEventListener('pointerup', releaseCam);
    camZoneEl.addEventListener('pointercancel', releaseCam);
    camZoneEl.addEventListener('lostpointercapture', () => { camPointerId = null; });
    window.addEventListener('blur', () => { camPointerId = null; });
  })(rightCamZone);

  window.addEventListener(
    'touchstart',
    () => {
      if (!hudScreen.classList.contains('hidden')) {
        touchLayer.classList.remove('hidden');
        syncSoulsTouchLayout();
      }
    },
    { passive: true }
  );

  const triggerDashInput = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (hudScreen.classList.contains('hidden')) return;
    touchState.dash = true;
    touchDashBtn.classList.add('is-pressed');
    setTimeout(() => touchDashBtn.classList.remove('is-pressed'), 130);
  };
  touchDashBtn.addEventListener('pointerdown', triggerDashInput);
  hudDashBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hudScreen.classList.contains('hidden')) touchState.dash = true;
  });

  function bindCapturedHoldBtn(btnEl, onDown, onUp, { allowCamDrag = false } = {}) {
    let heldPid = null;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let dragEngaged = false;
    const accumState = { swipeX: 0, swipeY: 0 };

    btnEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isTouchEditMode || hudScreen.classList.contains('hidden') || btnEl.classList.contains('hidden')) return;
      if (heldPid !== null && heldPid !== e.pointerId) {
        try {
          if (btnEl.hasPointerCapture?.(heldPid)) btnEl.releasePointerCapture(heldPid);
        } catch {}
      }
      heldPid = e.pointerId;
      try { btnEl.setPointerCapture(e.pointerId); } catch {}
      if (allowCamDrag && e.pointerType !== 'mouse') {
        const pt = mapTouchPt(e.clientX, e.clientY);
        startX = lastX = pt.x;
        startY = lastY = pt.y;
        dragEngaged = false;
        accumState.swipeX = 0;
        accumState.swipeY = 0;
      }
      btnEl.classList.add('is-pressed');
      onDown();
    });
    if (allowCamDrag) {
      btnEl.addEventListener('pointermove', (e) => {
        if (heldPid === null || e.pointerId !== heldPid || e.pointerType === 'mouse') return;
        const pt = mapTouchPt(e.clientX, e.clientY);
        if (!dragEngaged) {
          if (Math.hypot(pt.x - startX, pt.y - startY) < 7) return;
          dragEngaged = true;
          lastX = pt.x;
          lastY = pt.y;
          return;
        }
        feedSmartTouchCameraDelta(pt.x - lastX, pt.y - lastY, accumState);
        lastX = pt.x;
        lastY = pt.y;
      });
    }
    const finish = (e) => {
      if (e && e.pointerId !== undefined && heldPid !== null && e.pointerId !== heldPid) return;
      if (heldPid !== null) {
        try {
          if (btnEl.hasPointerCapture?.(heldPid)) btnEl.releasePointerCapture(heldPid);
        } catch {}
      }
      heldPid = null;
      dragEngaged = false;
      btnEl.classList.remove('is-pressed');
      onUp();
    };
    btnEl.addEventListener('pointerup', finish);
    btnEl.addEventListener('pointercancel', finish);
    btnEl.addEventListener('lostpointercapture', () => {
      if (heldPid !== null) { heldPid = null; dragEngaged = false; btnEl.classList.remove('is-pressed'); onUp(); }
    });
    window.addEventListener('blur', () => {
      if (heldPid !== null) { heldPid = null; dragEngaged = false; btnEl.classList.remove('is-pressed'); onUp(); }
    });
  }

  bindCapturedHoldBtn(hudBlockBtn, () => { touchState.block = true; }, () => { touchState.block = false; });
  bindCapturedHoldBtn(touchBlockBtn, () => { touchState.block = true; }, () => { touchState.block = false; }, { allowCamDrag: true });
  bindCapturedHoldBtn(
    touchAttackBtn,
    () => {
      touchState.attackSeq = (touchState.attackSeq || 0) + 1;
      touchState.attackTrigger = true;
      touchState.attackHeld = true;
    },
    () => {
      touchState.attackHeld = false;
    },
    { allowCamDrag: true }
  );

  touchFlaskBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden')) return;
    touchState.flask = true;
    touchFlaskBtn.classList.add('is-pressed');
    setTimeout(() => touchFlaskBtn.classList.remove('is-pressed'), 130);
  });
  touchAutoFlaskBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden')) return;
    touchAutoFlaskBtn.classList.add('is-pressed');
    setTimeout(() => touchAutoFlaskBtn.classList.remove('is-pressed'), 130);
    callbacks.onToggleMobileAutoFlask?.();
  });
  hudFlaskBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hudScreen.classList.contains('hidden')) touchState.flask = true;
  });

  let touchLockHoldTimer = null;
  let touchLockLongFired = false;
  touchLockBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden')) return;
    touchLockLongFired = false;
    touchLockBtn.classList.add('is-pressed');
    if (touchLockHoldTimer) clearTimeout(touchLockHoldTimer);
    touchLockHoldTimer = setTimeout(() => {
      touchLockHoldTimer = null;
      touchLockLongFired = true;
      callbacks.onToggleMobileSmartLock?.();
    }, 440);
  });
  const finishTouchLockPress = (e) => {
    if (touchLockHoldTimer) {
      clearTimeout(touchLockHoldTimer);
      touchLockHoldTimer = null;
    }
    touchLockBtn.classList.remove('is-pressed');
    if (e && e.type === 'pointerup' && !touchLockLongFired && !hudScreen.classList.contains('hidden')) {
      if (callbacks.onMobileLockTap) {
        callbacks.onMobileLockTap();
      } else {
        callbacks.onToggleTargetLock?.();
      }
    }
    touchLockLongFired = false;
  };
  touchLockBtn.addEventListener('pointerup', finishTouchLockPress);
  touchLockBtn.addEventListener('pointercancel', finishTouchLockPress);
  hudLockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!hudScreen.classList.contains('hidden')) callbacks.onToggleTargetLock?.();
  });

  // =========================================================================
  // 5. PURE DARK SOULS / ELDEN RING GOTHIC MAIN MENU (NO Customization / Shop)
  // =========================================================================
  const hubScreen = el('div', 'souls-title-screen');
  const titleVignette = el('div', 'souls-title-vignette');
  const titleColumn = el('div', 'souls-title-col');

  const titleHeader = el('div', 'souls-title-header');
  const titleEyebrow = el('div', 'souls-title-eyebrow', 'ЗАМОК ПЕПЛА');
  const titleLogo = el('h1', 'souls-title-logo', 'ОХОТНИКИ МРАКА');
  const titleRule = el('div', 'souls-title-rule');
  titleHeader.append(titleEyebrow, titleLogo, titleRule);

  const titleNav = el('nav', 'souls-title-nav');
  titleNav.setAttribute('aria-label', 'Главное меню');

  // 1. ПРОДОЛЖИТЬ
  const btnContinue = el('button', 'souls-menu-item is-disabled');
  btnContinue.type = 'button';
  btnContinue.disabled = true;
  const btnContinueMain = el('span', 'souls-menu-item-label', 'ПРОДОЛЖИТЬ');
  const btnContinueSub = el('span', 'souls-menu-item-sub', 'Нет сохранения');
  btnContinue.append(btnContinueMain, btnContinueSub);

  // 2. НОВАЯ ИГРА
  const btnNewGame = el('button', 'souls-menu-item is-primary');
  btnNewGame.type = 'button';
  const btnNewGameMain = el('span', 'souls-menu-item-label', 'НОВАЯ ИГРА');
  const btnNewGameSub = el('span', 'souls-menu-item-sub', 'Зал Пробуждения');
  btnNewGame.append(btnNewGameMain, btnNewGameSub);

  // 3. СЛОЖНОСТЬ (Clean menu slot — expandable inline selector)
  const diffGroup = el('div', 'souls-menu-diff-group');
  const btnDifficulty = el('button', 'souls-menu-item');
  btnDifficulty.type = 'button';
  btnDifficulty.setAttribute('aria-expanded', 'false');
  const btnDiffMain = el('span', 'souls-menu-item-label', 'СЛОЖНОСТЬ');
  const btnDiffVal = el('span', 'souls-menu-item-tag', 'Обычная');
  btnDifficulty.append(btnDiffMain, btnDiffVal);

  const diffDrawer = el('div', 'souls-diff-drawer hidden');
  const diffPillsRow = el('div', 'souls-diff-pills');
  const diffNote = el('div', 'souls-diff-note', 'Базовый баланс Замка Пепла');
  const diffButtons = new Map();
  for (const opt of DIFFICULTY_OPTIONS) {
    const b = el('button', `souls-diff-pill${opt.id === selectedDifficulty ? ' is-selected' : ''}`, opt.labelRu);
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedDifficulty = opt.id;
      syncDifficultyUI();
      callbacks.onSetDifficulty?.(opt.id);
    });
    diffPillsRow.appendChild(b);
    diffButtons.set(opt.id, b);
  }
  diffDrawer.append(diffPillsRow, diffNote);
  diffGroup.append(btnDifficulty, diffDrawer);

  // 4. НАСТРОЙКИ
  const btnSettings = el('button', 'souls-menu-item');
  btnSettings.type = 'button';
  btnSettings.appendChild(el('span', 'souls-menu-item-label', 'НАСТРОЙКИ'));

  titleNav.append(btnContinue, btnNewGame, diffGroup, btnSettings);

  const titleFootNote = el('div', 'souls-title-footer', 'Тёмное фэнтези • Ближний бой');
  titleColumn.append(titleHeader, titleNav, titleFootNote);

  const titleStageHint = el('div', 'souls-title-stage-hint', 'Поворот рыцаря — ЛКМ / ПКМ');

  // Top-right fullscreen shortcut on Title Screen (helpful on phones!)
  const titleTopTools = el('div', 'souls-title-top-tools');
  const titleFsBtn = el('button', 'hud-btn icon-btn title-fs-btn');
  titleFsBtn.type = 'button';
  titleFsBtn.title = 'На весь экран';
  titleFsBtn.setAttribute('aria-label', 'На весь экран');
  titleFsBtn.addEventListener('click', toggleAppFullscreen);
  fullscreenBtns.push(titleFsBtn);
  syncFullscreenButtons();
  titleTopTools.appendChild(titleFsBtn);

  hubScreen.append(titleVignette, titleColumn, titleStageHint, titleTopTools);
  root.appendChild(hubScreen);

  function syncDifficultyUI() {
    const cur = DIFFICULTY_OPTIONS.find((o) => o.id === selectedDifficulty) || DIFFICULTY_OPTIONS[1];
    btnDiffVal.textContent = cur.labelRu;
    diffNote.textContent = cur.noteRu;
    for (const [id, b] of diffButtons.entries()) {
      b.classList.toggle('is-selected', id === cur.id);
    }
    diffDrawer.classList.toggle('hidden', !difficultyDrawerOpen);
    btnDifficulty.classList.toggle('is-expanded', difficultyDrawerOpen);
    btnDifficulty.setAttribute('aria-expanded', difficultyDrawerOpen ? 'true' : 'false');
  }

  function syncContinueUI() {
    btnContinue.disabled = !hasSoulsSave;
    btnContinue.classList.toggle('is-disabled', !hasSoulsSave);
    btnContinue.classList.toggle('is-primary', hasSoulsSave);
    btnNewGame.classList.toggle('is-primary', !hasSoulsSave);
    btnContinueSub.textContent = hasSoulsSave
      ? (savedZoneCaption || 'Замок Пепла')
      : 'Нет сохранения';
  }

  btnContinue.addEventListener('click', () => {
    if (!hasSoulsSave) return;
    difficultyDrawerOpen = false;
    syncDifficultyUI();
    callbacks.onContinueGame?.();
  });

  btnNewGame.addEventListener('click', () => {
    difficultyDrawerOpen = false;
    syncDifficultyUI();
    callbacks.onNewGame?.();
  });

  btnDifficulty.addEventListener('click', () => {
    difficultyDrawerOpen = !difficultyDrawerOpen;
    syncDifficultyUI();
  });

  btnSettings.addEventListener('click', () => {
    difficultyDrawerOpen = false;
    syncDifficultyUI();
    openSettingsModal();
  });

  // Keyboard navigation on the Gothic Title Screen
  const titleMenuItems = [btnContinue, btnNewGame, btnDifficulty, btnSettings];
  window.addEventListener('keydown', (e) => {
    if (hubScreen.classList.contains('hidden')) return;
    if (modals.isStageBlockedByModal()) return;
    if (e.code === 'Escape' && difficultyDrawerOpen) {
      e.preventDefault();
      difficultyDrawerOpen = false;
      syncDifficultyUI();
      return;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      const enabledItems = titleMenuItems.filter((b) => !b.disabled);
      if (!enabledItems.length) return;
      e.preventDefault();
      const idx = enabledItems.indexOf(document.activeElement);
      const dir = (e.code === 'ArrowDown' || e.code === 'KeyS') ? 1 : -1;
      const next = idx < 0 ? 0 : (idx + dir + enabledItems.length) % enabledItems.length;
      enabledItems[next].focus();
    }
  });

  // =========================================================================
  // 6. TOASTS, CUTSCENE OVERLAYS, PROMPTS, VICTORY & DEFEAT OVERLAYS
  // =========================================================================
  const generalToast = el('div', 'general-toast hidden');
  root.appendChild(generalToast);
  let generalToastTimer = null;

  function showToast(msg, durationMs = 2600) {
    if (!msg) return;
    if (generalToastTimer) clearTimeout(generalToastTimer);
    generalToast.textContent = String(msg);
    generalToast.classList.remove('hidden');
    generalToastTimer = setTimeout(() => {
      generalToast.classList.add('hidden');
      generalToastTimer = null;
    }, durationMs);
  }

  const soulsAtmosphereVignette = el('div', 'souls-atmosphere-vignette hidden');
  hudScreen.insertBefore(soulsAtmosphereVignette, hudScreen.firstChild);

  const soulsLetterboxTop = el('div', 'souls-letterbox-bar souls-letterbox-top');
  const soulsLetterboxBottom = el('div', 'souls-letterbox-bar souls-letterbox-bottom');

  const soulsBossTitleCard = el('div', 'souls-boss-titlecard');
  const soulsTitleCardOrnamentTop = makeSvgNode(
    `<svg viewBox="0 0 360 18" width="360" height="18" fill="none" xmlns="http://www.w3.org/2000/svg" class="souls-titlecard-ornament" aria-hidden="true">
      <defs>
        <linearGradient id="sbOrnGrad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stop-color="#e5b85c" stop-opacity="0"/>
          <stop offset="32%" stop-color="#fde093" stop-opacity="0.72"/>
          <stop offset="50%" stop-color="#fffbeb" stop-opacity="0.95"/>
          <stop offset="68%" stop-color="#fde093" stop-opacity="0.72"/>
          <stop offset="100%" stop-color="#e5b85c" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="12" y1="9" x2="164" y2="9" stroke="url(#sbOrnGrad)" stroke-width="1.25"/>
      <line x1="196" y1="9" x2="348" y2="9" stroke="url(#sbOrnGrad)" stroke-width="1.25"/>
      <polygon points="180,2.5 188,9 180,15.5 172,9" fill="rgba(253,224,147,0.22)" stroke="#fde093" stroke-width="1.35"/>
      <circle cx="180" cy="9" r="2" fill="#fffbeb"/>
      <circle cx="152" cy="9" r="1.4" fill="#fde093" opacity="0.75"/>
      <circle cx="208" cy="9" r="1.4" fill="#fde093" opacity="0.75"/>
    </svg>`
  );
  const soulsTitleCardMain = el('div', 'souls-titlecard-title', 'РЫЦАРЬ ПЕПЛА');
  const soulsTitleCardSub = el('div', 'souls-titlecard-sub', 'СУДИЯ РУИН');
  const soulsTitleCardLineBot = el('div', 'souls-titlecard-line-bot');
  soulsBossTitleCard.append(soulsTitleCardOrnamentTop, soulsTitleCardMain, soulsTitleCardSub, soulsTitleCardLineBot);

  const soulsSubtitleWrap = el('div', 'souls-cutscene-subtitle-wrap');
  const soulsSubtitleSpeaker = el('div', 'souls-cutscene-speaker', 'РЫЦАРЬ ПЕПЛА');
  const soulsSubtitleText = el('div', 'souls-cutscene-subtitle', '');
  soulsSubtitleWrap.append(soulsSubtitleSpeaker, soulsSubtitleText);

  const soulsCutsceneSkipBtn = el('button', 'souls-cutscene-skip', 'Нажмите [Esc] / [Пробел] или тап — пропустить');
  soulsCutsceneSkipBtn.type = 'button';
  soulsCutsceneSkipBtn.setAttribute('aria-label', 'Пропустить кат-сцену');

  root.append(soulsLetterboxTop, soulsLetterboxBottom, soulsBossTitleCard, soulsSubtitleWrap, soulsCutsceneSkipBtn);

  let soulsLetterboxActive = false;
  let soulsTitleCardVisible = false;
  let soulsSubtitleVisible = false;
  let soulsSubtitleSpeakerCache = 'РЫЦАРЬ ПЕПЛА';
  let soulsSubtitleTextCache = '';
  let soulsSubtitleSwapTimer = null;
  let soulsCutsceneCanSkip = false;
  let soulsTitleCardTextCache = 'РЫЦАРЬ ПЕПЛА';
  let soulsTitleCardSubCache = 'СУДИЯ РУИН';
  let lastCutsceneSkipDispatchMs = 0;

  function triggerSkipBossDoorCutscene() {
    if (!soulsLetterboxActive || !soulsCutsceneCanSkip) return;
    const nowMs = performance.now();
    if (nowMs - lastCutsceneSkipDispatchMs < 240) return;
    lastCutsceneSkipDispatchMs = nowMs;
    callbacks.onSkipBossDoorCutscene?.();
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('grimborne-skip-cutscene'));
    }
  }
  soulsCutsceneSkipBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerSkipBossDoorCutscene();
  });
  window.addEventListener(
    'keydown',
    (e) => {
      if (!soulsLetterboxActive || !soulsCutsceneCanSkip || e.repeat) return;
      if (e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation?.();
        triggerSkipBossDoorCutscene();
      }
    },
    { capture: true }
  );

  function setSoulsLetterbox(active, meta = null) {
    const next = Boolean(active);
    if (next !== soulsLetterboxActive) {
      soulsLetterboxActive = next;
      soulsLetterboxTop.classList.toggle('is-active', next);
      soulsLetterboxBottom.classList.toggle('is-active', next);
      hudScreen.classList.toggle('is-cutscene-active', next);
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('is-souls-cutscene', next);
      }
    }
    const showTitle = next && Boolean(meta?.showBossTitleCard);
    if (showTitle !== soulsTitleCardVisible) {
      soulsTitleCardVisible = showTitle;
      soulsBossTitleCard.classList.toggle('is-visible', showTitle);
    }
    if (showTitle) {
      const nextTitle = (meta?.bossTitleRu && String(meta.bossTitleRu).trim()) || 'РЫЦАРЬ ПЕПЛА';
      const nextSub = (meta?.bossSubtitleRu && String(meta.bossSubtitleRu).trim()) || 'СУДИЯ РУИН';
      if (nextTitle !== soulsTitleCardTextCache) {
        soulsTitleCardTextCache = nextTitle;
        soulsTitleCardMain.textContent = nextTitle;
      }
      if (nextSub !== soulsTitleCardSubCache) {
        soulsTitleCardSubCache = nextSub;
        soulsTitleCardSub.textContent = nextSub;
      }
    }
    const canSkip = next && Boolean(meta?.canSkip);
    if (canSkip !== soulsCutsceneCanSkip) {
      soulsCutsceneCanSkip = canSkip;
      soulsCutsceneSkipBtn.classList.toggle('is-visible', canSkip);
    }
    const nextSubText = next && meta?.subtitleText ? String(meta.subtitleText).trim() : '';
    const showSub = Boolean(nextSubText);
    soulsSubtitleWrap.classList.toggle('is-above-title', showSub && showTitle);
    if (showSub) {
      const nextSpeaker =
        meta?.subtitleSpeaker === ''
          ? ''
          : (meta?.subtitleSpeaker && String(meta.subtitleSpeaker).trim()) || 'РЫЦАРЬ ПЕПЛА';
      if (nextSpeaker !== soulsSubtitleSpeakerCache) {
        soulsSubtitleSpeakerCache = nextSpeaker;
        soulsSubtitleSpeaker.textContent = nextSpeaker;
        soulsSubtitleSpeaker.classList.toggle('hidden', !nextSpeaker);
      }
      if (nextSubText !== soulsSubtitleTextCache) {
        soulsSubtitleTextCache = nextSubText;
        if (soulsSubtitleSwapTimer) clearTimeout(soulsSubtitleSwapTimer);
        if (soulsSubtitleVisible) {
          soulsSubtitleText.classList.add('is-swapping');
          soulsSubtitleSwapTimer = setTimeout(() => {
            soulsSubtitleText.textContent = soulsSubtitleTextCache;
            soulsSubtitleText.classList.remove('is-swapping');
            soulsSubtitleSwapTimer = null;
          }, 110);
        } else {
          soulsSubtitleText.textContent = nextSubText;
          soulsSubtitleText.classList.remove('is-swapping');
        }
      }
    } else {
      if (soulsSubtitleSwapTimer) {
        clearTimeout(soulsSubtitleSwapTimer);
        soulsSubtitleSwapTimer = null;
      }
      soulsSubtitleText.classList.remove('is-swapping');
      soulsSubtitleTextCache = '';
    }
    if (showSub !== soulsSubtitleVisible) {
      soulsSubtitleVisible = showSub;
      soulsSubtitleWrap.classList.toggle('is-visible', showSub);
    }
  }

  // Victory Banner
  const soulsBanner = el('div', 'souls-cinematic-banner hidden');
  const soulsBannerTitle = el('div', 'souls-banner-title', 'ВЕЛИКИЙ ВРАГ ПОВЕРЖЕН');
  const soulsBannerSubtitle = el('div', 'souls-banner-subtitle', 'Судия Руин пал');
  soulsBanner.append(el('div', 'souls-banner-line top'), soulsBannerTitle, soulsBannerSubtitle, el('div', 'souls-banner-line bottom'));
  root.appendChild(soulsBanner);
  let soulsBannerFadeTimer = null;
  let soulsBannerHideTimer = null;

  const soulsClearedHint = el('button', 'souls-cleared-hint hidden', 'Локация зачищена • [Esc] Меню');
  soulsClearedHint.type = 'button';
  soulsClearedHint.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onTogglePause?.();
  });
  hudScreen.appendChild(soulsClearedHint);

  const soulsPointerHint = el('div', 'souls-pointer-hint hidden', 'Клик по экрану — обзор мышкой • [Esc] курсор');
  hudScreen.appendChild(soulsPointerHint);

  const soulsCombatCue = el('div', 'souls-combat-cue hidden');
  hudScreen.appendChild(soulsCombatCue);
  let soulsCombatCueTimer = null;

  // Monochrome Antique-Gold SVG Interact Prompt (NO raw OS emojis!)
  const INTERACT_SVG = {
    door: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 17 V8.5 C5 5 7.2 3 10 3 C12.8 3 15 5 15 8.5 V17 H5 Z" stroke="#e5c787" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 3 V17" stroke="#c8a862" stroke-width="1.2"/></svg>',
    bonfire: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M10 2.6 C10 2.6 14.4 6.8 14.4 11.2 C14.4 13.9 12.4 16 10 16 C7.6 16 5.6 13.9 5.6 11.2 C5.6 9.3 6.7 7.6 8 6.4 C7.9 8.2 8.9 9.2 10 9.2 C10.4 7.1 10 2.6 10 2.6 Z" fill="rgba(229,162,72,0.28)" stroke="#e5c787" stroke-width="1.45" stroke-linejoin="round"/><path d="M5.5 17.4 H14.5" stroke="#c8a862" stroke-width="1.5" stroke-linecap="round"/></svg>',
    shrine: '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M7.5 3.2 H12.5 M8.5 3.2 V6.8 L5.6 12.2 C5.1 13.4 5.9 15.6 7.8 15.6 H12.2 C14.1 15.6 14.9 13.4 14.4 12.2 L11.5 6.8 V3.2" stroke="#e5c787" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 17.5 H13" stroke="#c8a862" stroke-width="1.4" stroke-linecap="round"/></svg>'
  };

  const soulsInteractPrompt = el('button', 'souls-interact-prompt hidden');
  soulsInteractPrompt.type = 'button';
  soulsInteractPrompt.setAttribute('aria-label', 'Взаимодействовать [E]');
  const soulsInteractIcon = el('span', 'souls-interact-icon');
  soulsInteractIcon.innerHTML = INTERACT_SVG.door;
  const soulsInteractKey = el('span', 'souls-interact-key', '[E]');
  const soulsInteractText = el('span', 'souls-interact-label', 'Открыть врата');
  soulsInteractPrompt.append(soulsInteractIcon, soulsInteractKey, soulsInteractText);
  soulsInteractPrompt.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden') || soulsInteractPrompt.classList.contains('hidden')) return;
    touchState.interact = true;
    callbacks.onSoulsInteract?.();
    soulsInteractPrompt.classList.add('is-pressed');
    setTimeout(() => soulsInteractPrompt.classList.remove('is-pressed'), 140);
  });
  hudScreen.appendChild(soulsInteractPrompt);

  // Riposte Prompt (Monochrome Gold Crossed-Blades SVG — NO raw ⚔️ emoji!)
  const soulsRipostePrompt = el('button', 'souls-riposte-prompt hidden');
  soulsRipostePrompt.type = 'button';
  soulsRipostePrompt.setAttribute('aria-label', 'Критический удар [ЛКМ / E]');
  const riposteIcon = el('span', 'souls-riposte-icon');
  riposteIcon.innerHTML =
    '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 16 L15.5 3.5 L16.5 4.5 L5 17 Z M16 16 L4.5 3.5 L3.5 4.5 L15 17 Z" fill="#f3d69b" stroke="#c8a862" stroke-width="0.8"/></svg>';
  soulsRipostePrompt.append(
    riposteIcon,
    el('span', 'souls-riposte-key', '[ЛКМ / E]'),
    el('span', 'souls-riposte-label', 'КРИТИЧЕСКИЙ УДАР')
  );
  soulsRipostePrompt.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hudScreen.classList.contains('hidden') || soulsRipostePrompt.classList.contains('hidden')) return;
    touchState.attackTrigger = true;
    touchState.interact = true;
    callbacks.onSoulsInteract?.();
    soulsRipostePrompt.classList.add('is-pressed');
    setTimeout(() => soulsRipostePrompt.classList.remove('is-pressed'), 140);
  });
  hudScreen.appendChild(soulsRipostePrompt);

  let soulsInteractVisible = false;
  let soulsInteractLabel = 'Открыть врата';
  let soulsInteractIconKind = 'door';
  let hudDerivedInteract = null;

  function stripLeadingEmoji(str) {
    return String(str || '').replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\s]+/u, '').trim();
  }

  function applySoulsInteractPromptState(visible, label = 'Открыть врата') {
    const show = Boolean(visible);
    const cleaned = stripLeadingEmoji(label) || 'Открыть врата';
    if (show !== soulsInteractVisible) {
      soulsInteractVisible = show;
      soulsInteractPrompt.classList.toggle('hidden', !show);
    }
    if (cleaned !== soulsInteractLabel) {
      soulsInteractLabel = cleaned;
      soulsInteractText.textContent = cleaned;
      const lower = cleaned.toLowerCase();
      const nextKind = lower.includes('кост')
        ? 'bonfire'
        : (lower.includes('алтар') || lower.includes('реликв') || lower.includes('фляг'))
          ? 'shrine'
          : 'door';
      if (nextKind !== soulsInteractIconKind) {
        soulsInteractIconKind = nextKind;
        soulsInteractIcon.innerHTML = INTERACT_SVG[nextKind];
      }
    }
  }

  function setSoulsInteractPrompt(visible, label = 'Открыть врата') {
    const cleaned = stripLeadingEmoji(label);
    const hasCustom = Boolean(cleaned && cleaned !== 'Открыть врата');
    if (hudDerivedInteract) {
      const mergedVisible = Boolean(visible || hudDerivedInteract.visible);
      const mergedLabel = hasCustom ? cleaned : mergedVisible ? hudDerivedInteract.label : 'Открыть врата';
      applySoulsInteractPromptState(mergedVisible, mergedLabel);
      return;
    }
    applySoulsInteractPromptState(visible, cleaned || 'Открыть врата');
  }

  function showSoulsBannerCue(text, kind = 'guard_counter') {
    if (!text || /контр\s*удар/i.test(String(text))) return;
    if (soulsCombatCueTimer) clearTimeout(soulsCombatCueTimer);
    soulsCombatCue.textContent = stripLeadingEmoji(text) || String(text);
    soulsCombatCue.className = `souls-combat-cue is-${kind}`;
    soulsCombatCue.classList.remove('hidden');
    void soulsCombatCue.offsetWidth;
    soulsCombatCue.classList.add('is-visible');
    soulsCombatCueTimer = setTimeout(() => {
      soulsCombatCue.classList.remove('is-visible');
      soulsCombatCue.classList.add('hidden');
      soulsCombatCueTimer = null;
    }, 1050);
  }

  // Defeat Overlay (Pure Russian Gothic, ZERO raw emojis!)
  const soulsDefeatOverlay = el('div', 'souls-defeat-overlay hidden');
  const soulsDefeatBand = el('div', 'souls-defeat-band');
  soulsDefeatBand.append(
    el('div', 'souls-defeat-line top'),
    el('div', 'souls-defeat-title', 'ВЫ ПОГИБЛИ'),
    el('div', 'souls-defeat-sub', 'ЗАМОК ПЕПЛА'),
    el('div', 'souls-defeat-line bottom')
  );
  const soulsDefeatActions = el('div', 'souls-defeat-actions');
  soulsDefeatOverlay.append(soulsDefeatBand, soulsDefeatActions);
  root.appendChild(soulsDefeatOverlay);

  function clearSoulsBannerTimers() {
    if (soulsBannerFadeTimer) { clearTimeout(soulsBannerFadeTimer); soulsBannerFadeTimer = null; }
    if (soulsBannerHideTimer) { clearTimeout(soulsBannerHideTimer); soulsBannerHideTimer = null; }
  }

  function showSoulsBanner({ type = 'victory', title = 'ВЕЛИКИЙ ВРАГ ПОВЕРЖЕН', subtitle = 'Судия Руин пал', durationMs = 4600 } = {}) {
    clearSoulsBannerTimers();
    soulsBanner.classList.toggle('is-victory', type === 'victory');
    soulsBanner.classList.toggle('is-defeat', type === 'defeat');
    soulsBannerTitle.textContent = title;
    soulsBannerSubtitle.textContent = subtitle || '';
    soulsBannerSubtitle.classList.toggle('hidden', !subtitle);
    soulsBanner.classList.remove('hidden', 'is-fading');
    const totalMs = Math.max(2000, Number(durationMs) || 4600);
    soulsBannerFadeTimer = setTimeout(() => {
      soulsBanner.classList.add('is-fading');
      soulsBannerFadeTimer = null;
    }, Math.max(800, totalMs - 900));
    soulsBannerHideTimer = setTimeout(() => {
      soulsBanner.classList.add('hidden');
      soulsBanner.classList.remove('is-fading');
      soulsBannerHideTimer = null;
    }, totalMs);
  }

  function showSoulsVictoryBanner({ title = 'ВЕЛИКИЙ ВРАГ ПОВЕРЖЕН', subtitle = 'Судия Руин пал', durationMs = 4800 } = {}) {
    soulsDefeatOverlay.classList.add('hidden');
    showSoulsBanner({ type: 'victory', title, subtitle, durationMs });
    soulsClearedHint.classList.remove('hidden');
  }

  function hideSoulsDefeatOverlay() {
    soulsDefeatOverlay.classList.add('hidden');
  }

  function setSoulsPointerLockHintVisible(visible) {
    soulsPointerHint.classList.toggle('hidden', !visible);
  }

  function hideSoulsOverlays() {
    clearSoulsBannerTimers();
    if (soulsCombatCueTimer) { clearTimeout(soulsCombatCueTimer); soulsCombatCueTimer = null; }
    soulsBanner.classList.add('hidden');
    soulsBanner.classList.remove('is-fading');
    soulsClearedHint.classList.add('hidden');
    soulsPointerHint.classList.add('hidden');
    soulsCombatCue.classList.add('hidden');
    soulsInteractVisible = false;
    hudDerivedInteract = null;
    soulsInteractPrompt.classList.add('hidden');
    soulsRipostePrompt.classList.add('hidden');
    touchAttackBtn.classList.remove('is-riposte-ready');
    touchAttackLbl.textContent = 'УДАР';
    setSoulsLetterbox(false);
    soulsAtmosphereVignette.classList.toggle('hidden', !soulsModeActive);
    soulsDefeatOverlay.classList.add('hidden');
  }

  function showSoulsDefeatOverlay({ canBossRematch = false, onBossRematch, onBonfireRestart, onHub } = {}) {
    closeSoundPopover();
    clearSoulsBannerTimers();
    soulsBanner.classList.add('hidden');
    soulsBanner.classList.remove('is-fading');
    soulsClearedHint.classList.add('hidden');
    soulsDefeatActions.innerHTML = '';

    if (canBossRematch) {
      const rematchBtn = el('button', 'souls-defeat-btn btn-boss-rematch', 'Возродиться на арене босса');
      rematchBtn.type = 'button';
      rematchBtn.addEventListener('click', async () => {
        rematchBtn.disabled = true;
        hideSoulsDefeatOverlay();
        await onBossRematch?.();
      });
      soulsDefeatActions.appendChild(rematchBtn);
    }

    const bonfireBtn = el('button', 'souls-defeat-btn btn-bonfire-restart', 'Возродиться у Костра');
    bonfireBtn.type = 'button';
    bonfireBtn.addEventListener('click', async () => {
      bonfireBtn.disabled = true;
      hideSoulsDefeatOverlay();
      await onBonfireRestart?.();
    });
    soulsDefeatActions.appendChild(bonfireBtn);

    const hubBtn = el('button', 'souls-defeat-btn btn-souls-hub', 'В главное меню');
    hubBtn.type = 'button';
    hubBtn.addEventListener('click', () => {
      hubBtn.disabled = true;
      hideSoulsDefeatOverlay();
      onHub?.();
    });
    soulsDefeatActions.appendChild(hubBtn);

    soulsDefeatOverlay.classList.remove('hidden');
  }

  function isSoulsDefeatOpen() {
    return !soulsDefeatOverlay.classList.contains('hidden');
  }

  // Modals Controller (Settings + Sound Popover + Pause + Reset Confirm)
  const modals = createModalsController({
    root,
    hudMuteBtn,
    getLang: () => lang,
    getCallbacks: () => callbacks,
    getAudioState: () => ({ muted, volume, lastNonZeroVolume, musicVolume, voiceVolume }),
    setAudioState: (patch) => {
      if (patch.muted !== undefined) muted = Boolean(patch.muted);
      if (patch.volume !== undefined) volume = patch.volume;
      if (patch.lastNonZeroVolume !== undefined) lastNonZeroVolume = patch.lastNonZeroVolume;
      if (patch.musicVolume !== undefined) musicVolume = patch.musicVolume;
      if (patch.voiceVolume !== undefined) voiceVolume = patch.voiceVolume;
    },
    getLowSpecState: () => lowSpecEnabled,
    setLowSpecState: (v) => { lowSpecEnabled = Boolean(v); },
    getShowFpsState: () => showFpsEnabled,
    setShowFpsState: (v) => { showFpsEnabled = Boolean(v); },
    getShowUncappedFpsState: () => showUncappedFpsEnabled,
    setShowUncappedFpsState: (v) => { showUncappedFpsEnabled = Boolean(v); },
    hasCustomTouchLayout: () => hasCustomTouchLayout()
  });
  const {
    closeSoundPopover,
    syncMuteButtons,
    openSettingsModal,
    closeSettingsModal,
    isSettingsModalOpen,
    showPauseModal,
    hidePauseModal,
    isPauseModalOpen
  } = modals;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && isTouchEditMode) {
      e.preventDefault();
      closeTouchEditMode(true);
      return;
    }
    modals.handleKeydown(e);
  });

  // =========================================================================
  // 7. RENDER TITLE MENU & FAST CACHED SOULS HUD UPDATER
  // =========================================================================
  function renderHub(progressionStore) {
    const st = progressionStore?.getState ? progressionStore.getState() : progressionStore || {};
    selectedDifficulty = DIFFICULTY_OPTIONS.some((o) => o.id === st.difficultyMode) ? st.difficultyMode : 'normal';
    lowSpecEnabled = Boolean(st.lowSpec);
    const save = st.soulsSave || {};
    hasSoulsSave = Boolean(save.hasRun || save.bonfireCheckpointLit);
    savedZoneCaption = save.bonfireCheckpointLit ? 'Костёр • Замок Пепла' : 'Зал Пробуждения';
    syncContinueUI();
    syncDifficultyUI();
    syncMuteButtons();
  }

  const hudCache = {
    hpText: '',
    hpScale: -1,
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
    weaponId: '',
    weaponName: '',
    dashReady: true,
    dashQuant: 1000,
    dashText: '',
    soulsStaminaScale: -1,
    soulsStaminaText: '',
    soulsGuardBroken: false,
    soulsBlockState: '',
    soulsFlaskText: '',
    soulsFlaskEmpty: false,
    soulsFlaskDrinking: false,
    soulsGuardCounterReady: false,
    soulsCanRiposte: false,
    mobileAutoFlaskEnabled: true,
    mobileSmartLockEnabled: true,
    isTargetLocked: false
  };

  function updateHud(snapshot) {
    if (!snapshot) return;

    // 1. HP
    const maxHp = Math.max(1, Math.round(Number(snapshot.maxHp ?? snapshot.player?.maxHp ?? 150)));
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

    // 2. Souls Stamina, Block/Parry, Riposte, Flask, Cutscene & Interact Prompt
    const sData = snapshot.souls;
    if (sData) {
      const nearBonfire = Boolean(sData.canRestAtBonfire || sData.interactKind === 'bonfire');
      const nearShrine = Boolean(sData.canClaimShrine || sData.interactKind === 'shrine');
      const nearDoors = Boolean(sData.canOpenBossDoors || sData.interactKind === 'boss_doors');
      const canInteractNow = Boolean(sData.canInteract || nearBonfire || nearShrine || nearDoors);
      const dynInteractPrompt =
        stripLeadingEmoji(sData.interactPromptRu || sData.interactLabel) ||
        (nearBonfire
          ? 'Отдохнуть у Костра (Чекпоинт • 4/4 Фляги)'
          : nearShrine
            ? 'Принять благословение алтаря'
            : 'Открыть врата');
      hudDerivedInteract = { visible: canInteractNow, label: dynInteractPrompt };
      applySoulsInteractPromptState(canInteractNow, dynInteractPrompt);

      if (typeof sData.doorCutsceneActive === 'boolean') {
        setSoulsLetterbox(sData.doorCutsceneActive, {
          showBossTitleCard: Boolean(sData.showBossTitleCard),
          canSkip: Boolean(sData.canSkip ?? sData.cutsceneCanSkip),
          bossTitleRu: sData.bossTitleRu,
          bossSubtitleRu: sData.bossSubtitleRu,
          subtitleSpeaker: sData.subtitleSpeaker,
          subtitleText: sData.subtitleText,
          letterbox01: sData.letterbox01
        });
      }

      const stMax = Math.max(1, Number(sData.staminaMax ?? 100));
      const stVal = Math.max(0, Math.min(stMax, Math.round(Number(sData.stamina ?? stMax))));
      const stRatio = stVal / stMax;
      const stQuant = Math.round(stRatio * 500);
      if (stQuant !== hudCache.soulsStaminaScale) {
        hudCache.soulsStaminaScale = stQuant;
        soulsStaminaFill.style.transform = `scaleX(${stRatio.toFixed(3)})`;
      }
      const guardBroken = Boolean(sData.guardBroken);
      if (guardBroken !== hudCache.soulsGuardBroken) {
        hudCache.soulsGuardBroken = guardBroken;
        soulsStaminaWrap.classList.toggle('is-guard-broken', guardBroken);
      }
      const stText = guardBroken ? 'ПРОБИТ БЛОК!' : `ВЫН. ${stVal} / ${stMax}`;
      if (stText !== hudCache.soulsStaminaText) {
        hudCache.soulsStaminaText = stText;
        soulsStaminaText.textContent = stText;
      }

      const bState = guardBroken
        ? 'broken'
        : sData.parryActive
          ? 'parry'
          : sData.isBlocking
            ? 'blocking'
            : 'idle';
      if (bState !== hudCache.soulsBlockState) {
        hudCache.soulsBlockState = bState;
        hudBlockBtn.classList.toggle('is-blocking', bState === 'blocking');
        hudBlockBtn.classList.toggle('is-parry', bState === 'parry');
        hudBlockBtn.classList.toggle('is-guard-broken', bState === 'broken');
        touchBlockBtn.classList.toggle('is-blocking', bState === 'blocking');
        touchBlockBtn.classList.toggle('is-parry', bState === 'parry');
        touchBlockBtn.classList.toggle('is-guard-broken', bState === 'broken');
        touchBlockLbl.textContent =
          bState === 'parry' ? 'ПАРИР!' : bState === 'blocking' ? 'БЛОК' : bState === 'broken' ? 'ПРОБИТ' : 'ЩИТ';
        hudBlockStateText.textContent =
          bState === 'parry' ? 'ПАРИР.!' : bState === 'blocking' ? 'БЛОК' : bState === 'broken' ? 'ПРОБИТ' : 'БЛОК / ПАРИР.';
      }

      const guardCounterReady = Boolean(sData.guardCounterReady || Number(sData.guardCounterTimer ?? sData.guardCounterWindow ?? 0) > 0);
      if (guardCounterReady !== hudCache.soulsGuardCounterReady) {
        hudCache.soulsGuardCounterReady = guardCounterReady;
        touchAttackBtn.classList.toggle('is-counter-ready', guardCounterReady);
        hudBlockBtn.classList.toggle('is-counter-ready', guardCounterReady);
      }

      const canRiposte = Boolean(sData.canRiposte);
      if (canRiposte !== hudCache.soulsCanRiposte) {
        hudCache.soulsCanRiposte = canRiposte;
        soulsRipostePrompt.classList.toggle('hidden', !canRiposte);
        touchAttackBtn.classList.toggle('is-riposte-ready', canRiposte);
        touchAttackLbl.textContent = canRiposte ? 'КАЗНЬ!' : 'УДАР';
      }

      const autoFlaskOn = sData.mobileAutoFlaskEnabled !== false;
      if (autoFlaskOn !== hudCache.mobileAutoFlaskEnabled) {
        hudCache.mobileAutoFlaskEnabled = autoFlaskOn;
        touchAutoFlaskBtn.classList.toggle('is-enabled', autoFlaskOn);
        touchAutoFlaskBtn.setAttribute('aria-pressed', autoFlaskOn ? 'true' : 'false');
        touchAutoFlaskTxt.textContent = autoFlaskOn ? 'АВТО-ХИЛ' : 'АВТО: ВЫКЛ';
      }

      const smartLockOn = sData.mobileSmartLockEnabled !== false;
      if (smartLockOn !== hudCache.mobileSmartLockEnabled) {
        hudCache.mobileSmartLockEnabled = smartLockOn;
        touchLockBtn.classList.toggle('is-smart-auto', smartLockOn);
      }

      const fl = Math.max(0, Math.round(Number(sData.flasks ?? 0)));
      const flMax = Math.max(1, Math.round(Number(sData.flasksMax ?? 4)));
      const flEmpty = fl <= 0;
      const flDrink = Boolean(sData.flaskDrinking);
      const flText = flDrink ? 'ПЬЁТ…' : `ФЛЯГА ${fl}/${flMax}`;
      if (flText !== hudCache.soulsFlaskText) {
        hudCache.soulsFlaskText = flText;
        hudFlaskStateText.textContent = flText;
        touchFlaskCountLbl.textContent = `${fl}/${flMax}`;
      }
      if (flEmpty !== hudCache.soulsFlaskEmpty) {
        hudCache.soulsFlaskEmpty = flEmpty;
        hudFlaskBtn.classList.toggle('is-empty', flEmpty);
        touchFlaskBtn.classList.toggle('is-empty', flEmpty);
      }
      if (flDrink !== hudCache.soulsFlaskDrinking) {
        hudCache.soulsFlaskDrinking = flDrink;
        hudFlaskBtn.classList.toggle('is-drinking', flDrink);
        touchFlaskBtn.classList.toggle('is-drinking', flDrink);
      }
    }

    // 3. Target Lock-On
    const isTargetLocked = Boolean(snapshot.isTargetLocked);
    if (isTargetLocked !== hudCache.isTargetLocked) {
      hudCache.isTargetLocked = isTargetLocked;
      hudLockBtn.classList.toggle('is-active', isTargetLocked);
      hudLockBtn.setAttribute('aria-pressed', isTargetLocked ? 'true' : 'false');
      touchLockBtn.classList.toggle('is-active', isTargetLocked);
    }
    const wantLockLbl = isTargetLocked ? 'ЦЕЛЬ' : (hudCache.mobileSmartLockEnabled ? 'АВТО' : 'ПРИЦЕЛ');
    if (touchLockLbl.textContent !== wantLockLbl) {
      touchLockLbl.textContent = wantLockLbl;
    }

    // 4. Zone Ribbon & Boss HP + Stagger Bar
    const boss = snapshot.boss || null;
    const bossHp = Number(boss?.hp ?? snapshot.bossHp ?? 0);
    const isBossActive = Boolean((boss && boss.active !== false && bossHp > 0) || snapshot.bossActive);
    if (isBossActive !== hudCache.bossActive) {
      hudCache.bossActive = isBossActive;
      bossBarBox.classList.toggle('hidden', !isBossActive);
      waveBox.classList.toggle('hidden', isBossActive);
    }
    if (isBossActive) {
      const bName = String(boss?.nameRu ?? boss?.name ?? 'СУДИЯ РУИН').toUpperCase();
      if (bName !== hudCache.bossName) {
        hudCache.bossName = bName;
        bossBarName.textContent = bName;
      }
      const bMaxHp = Math.max(1, Number(boss?.maxHp ?? snapshot.bossMaxHp ?? 920));
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
      if (hudCache.bossStaggerVisible || !bossStaggerWrap.classList.contains('hidden')) {
        hudCache.bossStaggerVisible = false;
        bossStaggerWrap.classList.add('hidden');
        bossStaggerWrap.classList.remove('is-staggered');
      }
    } else {
      const zoneTitle = snapshot.souls?.zoneTitleRu || 'Замок Пепла';
      const lTitle = zoneTitle === 'Замок Пепла' ? 'ЗАМОК ПЕПЛА' : zoneTitle;
      if (lTitle !== hudCache.levelTitle) {
        hudCache.levelTitle = lTitle;
        hudLevelTitle.textContent = lTitle;
      }
      const phase = stripLeadingEmoji(snapshot.phaseText) || 'Иди на север';
      if (phase !== hudCache.timerStr) {
        hudCache.timerStr = phase;
        hudWaveTimer.textContent = phase;
      }
    }

    // 5. Weapon Badge
    const wId = snapshot.weaponId || 'club';
    const wDef = WEAPONS[wId] || WEAPONS.club;
    if (wId !== hudCache.weaponId) {
      hudCache.weaponId = wId;
      weaponHudIcon.innerHTML = '';
      weaponHudIcon.appendChild(createWeaponSvg(wId, 'hud-wpn-svg'));
    }
    const wName = snapshot.weaponNameRu || wDef?.nameRu || 'Меч Клятвы';
    if (wName !== hudCache.weaponName) {
      hudCache.weaponName = wName;
      weaponHudName.textContent = wName;
    }

    // 6. Roll / Dash Cooldown Ring
    const dashCd = Math.max(0, Number(snapshot.dashCooldown ?? 0));
    const dashMax = Math.max(0.1, Number(snapshot.dashCooldownMax ?? 1.0));
    const dashReady = dashCd <= 0.04;
    const dashRatio = dashReady ? 1 : Math.max(0, Math.min(1, 1 - dashCd / dashMax));
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
      hudDashRingFill.style.strokeDashoffset = (HUD_DASH_RING_CIRC * (1 - dashRatio)).toFixed(2);
      hudDashBarFill.style.transform = `scaleX(${dashRatio.toFixed(3)})`;
      touchDashRingFill.style.strokeDashoffset = (TOUCH_DASH_RING_CIRC * (1 - dashRatio)).toFixed(2);
    }
    const dashText = dashReady ? 'ПЕРЕКАТ' : `${dashCd.toFixed(1)}с`;
    if (dashText !== hudCache.dashText) {
      hudCache.dashText = dashText;
      hudDashStateText.textContent = dashText;
    }
  }

  syncMuteButtons();
  syncContinueUI();
  syncDifficultyUI();

  return {
    setCallbacks(next = {}) {
      callbacks = { ...callbacks, ...next };
    },
    setLang(nextLang) {
      lang = nextLang === 'en' ? 'en' : 'ru';
      syncMuteButtons();
    },
    isHeroStageVisible() {
      return !hubScreen.classList.contains('hidden') && !modals.isStageBlockedByModal();
    },
    renderHub,
    showHub(visible = true) {
      closeSoundPopover();
      difficultyDrawerOpen = false;
      syncDifficultyUI();
      hubScreen.classList.toggle('hidden', !visible);
      if (visible) {
        soulsModeActive = false;
        soulsAtmosphereVignette.classList.add('hidden');
        syncSoulsTouchLayout();
        hideSoulsOverlays();
        releaseLeftStick();
        clearAllTouchActions();
      }
    },
    updateHud,
    showHud(visible = true) {
      closeSoundPopover();
      hudScreen.classList.toggle('hidden', !visible);
      soulsModeActive = Boolean(visible);
      soulsAtmosphereVignette.classList.toggle('hidden', !visible);
      if (!visible) {
        hideSoulsOverlays();
        releaseLeftStick();
        clearAllTouchActions();
      } else if (isTouchCapable) {
        touchLayer.classList.remove('hidden');
      }
      syncSoulsTouchLayout();
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
    setVoiceVolumeState(vol0to1) {
      const v = Number(vol0to1);
      if (Number.isFinite(v)) {
        voiceVolume = Math.max(0, Math.min(1.5, v));
        syncMuteButtons();
      }
    },
    setLowSpecState(isLow) {
      lowSpecEnabled = Boolean(isLow);
      syncMuteButtons();
    },
    setShowFpsState(show) {
      showFpsEnabled = Boolean(show);
      syncMuteButtons();
    },
    setShowUncappedFpsState(show) {
      showUncappedFpsEnabled = Boolean(show);
      syncMuteButtons();
    },
    openTouchEditMode,
    closeTouchEditMode,
    isTouchEditModeOpen() {
      return isTouchEditMode;
    },
    resetTouchCustomLayout,
    hasCustomTouchLayout,
    spawnFloatingText,
    getTouchInput() {
      return touchState;
    },
    showToast,
    showSoulsBanner,
    showSoulsVictoryBanner,
    showSoulsBannerCue,
    showSoulsCombatCue: showSoulsBannerCue,
    setSoulsInteractPrompt,
    setSoulsLetterbox,
    showSoulsDefeatOverlay,
    hideSoulsDefeatOverlay,
    hideSoulsOverlays,
    isSoulsDefeatOpen,
    setSoulsPointerLockHintVisible,
    openSettingsModal,
    closeSettingsModal,
    isSettingsModalOpen,
    showPauseModal,
    hidePauseModal,
    isPauseModalOpen,
    hideAllModals() {
      hideSoulsOverlays();
      modals.hideAllModals();
    },
    // Safe compatibility no-ops (prevents any legacy call from ever throwing)
    setAutoAimState() {},
    setAttackEnabledState() {},
    setTelegraphsVisibleState() {},
    setOnboardingDone() {},
    startOnboarding() {},
    setSelectedLevel() {},
    setActiveTab() {},
    resetLocalSelection() {}
  };
}
