// UI Modals & Sound/Settings Popover Controller
// Extracted from js/ui.js (Wave 2 modularization):
// - Sound & Game Settings Popover
// - Animated Tarot / Relic Level-Up Modal ("БЛАГОСЛОВЕНИЕ ДУШ", keys [1/2/3])
// - Gothic Victory / Defeat / Endless Result Modal
// - Mage Starter Element Selection Modal
// - Full Progress Reset Confirmation Modal
// - In-Game Pause Modal

import {
  LEVELS,
  getLevelDef,
  WEAPONS,
  RUN_UPGRADES,
  MAGE_ELEMENTS,
  MAGE_ELEMENT_ORDER
} from '../config.js?v=20261123z71';
import {
  RANK_ROMAN,
  el,
  formatTimeMMSS,
  hexNumToCss,
  isWeaponHighlightChoice
} from './resolvers.js?v=20261123z71';
import {
  makeSvgNode,
  createWeaponSvg,
  createModalIconSvg,
  setModalButtonContent,
  createMandalaSvg,
  createRuneHaloSvg,
  createBlessingRelicSvg
} from './svgIcons.js?v=20261123z71';

export function createModalsController({
  root,
  hubMuteBtn,
  hudMuteBtn,
  hubResetBtn,
  autoAimBtn,
  attackToggleBtn,
  touchPreviewBtn,
  getLang,
  getCallbacks,
  getHudSoulLevel,
  getCurrentEquippedWeaponId,
  getAudioState,
  setAudioState,
  syncPauseToggles,
  setActiveTab,
  resetLocalSelection,
  onCloseOtherPopovers
}) {
  // =========================================================================
  // 1. SOUND & GAME SETTINGS POPOVER
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
    onCloseOtherPopovers?.();
    soundAnchorBtn = anchorBtn;
    hubResetBtn.classList.toggle('hidden', anchorBtn !== hubMuteBtn);
    hubMuteBtn.classList.toggle('is-open', anchorBtn === hubMuteBtn);
    hudMuteBtn.classList.toggle('is-open', anchorBtn === hudMuteBtn);
    soundPopover.classList.remove('hidden');
    positionSoundPopover(anchorBtn);
  }

  const makeSpeakerSvg = (level) => {
    // Crisp antique-gold gothic SVG speaker icon (replaces harsh Windows blue emoji!)
    const waves =
      level === 0
        ? '<path d="M15.8 9.2 L20.4 14.8 M20.4 9.2 L15.8 14.8" stroke="#c86b5c" stroke-width="1.8" stroke-linecap="round"/>'
        : level === 1
          ? '<path d="M15.6 9.4 C17 10.7 17 13.3 15.6 14.6" stroke="#e5c787" stroke-width="1.7" stroke-linecap="round"/>'
          : '<path d="M15.4 9.2 C16.9 10.6 16.9 13.4 15.4 14.8 M18.1 6.8 C20.8 9.4 20.8 14.6 18.1 17.2" stroke="#e5c787" stroke-width="1.65" stroke-linecap="round"/>';
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4.5 9.5 H8.2 L12.8 5.5 V18.5 L8.2 14.5 H4.5 Z" fill="rgba(229,184,92,0.22)" stroke="#e5c787" stroke-width="1.6" stroke-linejoin="round"/>${waves}</svg>`;
  };

  function syncMuteButtons() {
    const lang = getLang();
    const { muted, volume, musicVolume } = getAudioState();
    const effectiveVol = muted ? 0 : volume;
    const effectiveMusic = muted ? 0 : musicVolume;
    const anyAudio = effectiveVol > 0.001 || effectiveMusic > 0.001;
    const lvl = !anyAudio ? 0 : effectiveVol < 0.45 ? 1 : 2;
    if (hudMuteBtn.dataset.volLvl !== String(lvl)) {
      hudMuteBtn.dataset.volLvl = String(lvl);
      hudMuteBtn.innerHTML = makeSpeakerSvg(lvl);
    }
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

  const handleToggleMute = () => {
    const callbacks = getCallbacks();
    const st = getAudioState();
    const nextMuted = !st.muted;
    if (!nextMuted && st.volume <= 0.01) {
      const restored = st.lastNonZeroVolume > 0.05 ? st.lastNonZeroVolume : 0.75;
      setAudioState({ volume: restored });
      callbacks.onVolumeChange?.(restored);
    }
    const res = callbacks.onToggleMute?.(nextMuted);
    setAudioState({ muted: typeof res === 'boolean' ? res : nextMuted });
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
    const callbacks = getCallbacks();
    const st = getAudioState();
    const pct = Math.max(0, Math.min(100, Number(musicSlider.value) || 0));
    const nextMusicVol = pct / 100;
    let nextMuted = st.muted;
    if (nextMusicVol > 0.01 && nextMuted) {
      nextMuted = false;
      const mRes = callbacks.onToggleMute?.(false);
      if (typeof mRes === 'boolean') nextMuted = mRes;
    }
    setAudioState({ musicVolume: nextMusicVol, muted: nextMuted });
    callbacks.onMusicVolumeChange?.(nextMusicVol);
    syncMuteButtons();
  });

  soundSlider.addEventListener('input', () => {
    const callbacks = getCallbacks();
    const st = getAudioState();
    const pct = Math.max(0, Math.min(100, Number(soundSlider.value) || 0));
    const nextVol = pct / 100;
    let nextMuted = st.muted;
    const patch = { volume: nextVol };
    if (nextVol > 0.01) {
      patch.lastNonZeroVolume = nextVol;
      if (nextMuted) {
        nextMuted = false;
        const mRes = callbacks.onToggleMute?.(false);
        if (typeof mRes === 'boolean') nextMuted = mRes;
      }
    }
    patch.muted = nextMuted;
    setAudioState(patch);
    callbacks.onVolumeChange?.(nextVol);
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

  // =========================================================================
  // 2. TAROT / RELIC ALTAR LEVEL-UP MODAL ("БЛАГОСЛОВЕНИЕ ДУШ")
  // =========================================================================
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

  function hideLevelUpModal() {
    levelUpModal.classList.add('hidden');
    activeLevelUpHandler = null;
  }

  function showLevelUpModal(choices = [], onSelect) {
    closeSoundPopover();
    const lang = getLang();
    const list = (Array.isArray(choices) && choices.length > 0 ? choices : RUN_UPGRADES.slice(0, 3)).slice(0, 3);
    blessingCardsGrid.innerHTML = '';

    const soulLvl = Number(list[0]?.soulLevel || getHudSoulLevel() || 2);
    const romanSoul = RANK_ROMAN[soulLvl] || String(soulLvl);
    altarSoulLevelText.textContent = lang === 'en' ? `SOUL LEVEL ${romanSoul}` : `УРОВЕНЬ ДУШ ${romanSoul}`;
    levelUpTitle.textContent = lang === 'en' ? 'BLESSING OF SOULS' : 'БЛАГОСЛОВЕНИЕ ДУШ';
    levelUpSub.textContent =
      lang === 'en'
        ? 'Choose one synergy relic for this run (Keys 1, 2, 3)'
        : 'Выберите дар для текущего похода (клавиши 1, 2, 3)';

    let picked = false;
    const chooseIndex = (idx) => {
      if (picked || idx < 0 || idx >= list.length) return;
      picked = true;
      const chosen = list[idx];
      const perkId = typeof chosen === 'string' ? chosen : (chosen?.id || null);
      hideLevelUpModal();
      onSelect?.(perkId, chosen, idx);
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
        : choice?.categoryRu || baseUpg?.categoryRu || 'СИНЕРГИЯ ДУШ';

      const rankStr = isGoldWeapon ? `РАНГ ${rankRoman}` : `РАНГ ${rankRoman}/${maxRoman}`;

      const statBadgeStr =
        choice?.statBadgeRu ||
        baseUpg?.statBadgeRu ||
        (isGoldWeapon ? '+20% УРОН • +8% ОБЛАСТЬ' : 'БОЕВОЙ ДАР');

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
      emblemStage.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 120 34" class="blessing-altar-rocks" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="4,32 14,17 26,23 32,32" fill="rgba(18,14,28,0.88)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
            <polygon points="88,32 96,19 108,15 116,32" fill="rgba(18,14,28,0.88)" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>
            <ellipse cx="60" cy="31" rx="44" ry="3" fill="rgba(0,0,0,0.48)"/>
          </svg>`
        )
      );
      emblemStage.appendChild(createBlessingRelicSvg(choice, 'blessing-relic-svg'));

      const nameEl = el('h3', 'blessing-name', choice?.nameRu || baseUpg?.nameRu || 'Дар Душ');

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

  // =========================================================================
  // 3. GOTHIC VICTORY / DEFEAT / ENDLESS RESULT MODAL
  // =========================================================================
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
    `<svg viewBox="0 0 40 40" width="36" height="36" fill="none" class="result-stat-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="resGoldFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef3c7"/>
          <stop offset="48%" stop-color="#eab308"/>
          <stop offset="100%" stop-color="#a16207"/>
        </linearGradient>
        <linearGradient id="resGoldRim" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
      </defs>
      <path d="M6.5 24.5 V29 C6.5 31.3 10.5 33 15.5 33 C20.5 33 24.5 31.3 24.5 29 V24.5 Z" fill="url(#resGoldRim)" stroke="#fde093" stroke-width="1"/>
      <ellipse cx="15.5" cy="24.5" rx="9" ry="3.8" fill="url(#resGoldFace)" stroke="#fef3c7" stroke-width="1.1"/>
      <path d="M6.5 19.6 V24.1 C6.5 26.4 10.5 28.1 15.5 28.1 C20.5 28.1 24.5 26.4 24.5 24.1 V19.6 Z" fill="url(#resGoldRim)" stroke="#fde093" stroke-width="1"/>
      <ellipse cx="15.5" cy="19.6" rx="9" ry="3.8" fill="url(#resGoldFace)" stroke="#fef9c3" stroke-width="1.15"/>
      <circle cx="25.5" cy="20.5" r="10.2" fill="url(#resGoldRim)" stroke="#fef08a" stroke-width="1.4"/>
      <circle cx="25.5" cy="20.5" r="7.5" fill="url(#resGoldFace)" stroke="#fffbeb" stroke-width="0.95"/>
      <polygon points="25.5,15.6 28.4,20.5 25.5,25.4 22.6,20.5" fill="#92400e" stroke="#fef9c3" stroke-width="0.9"/>
      <path d="M12.5 8.5 L13.4 11.2 L16.1 12.1 L13.4 13 L12.5 15.7 L11.6 13 L8.9 12.1 L11.6 11.2 Z" fill="#fef9c3"/>
    </svg>`
  );
  const resGoldTextCol = el('div', 'result-stat-col');
  const resGoldLabel = el('div', 'result-stat-label', 'Добыто золота');
  const resGoldVal = el('div', 'result-stat-val', '+0');
  resGoldTextCol.append(resGoldLabel, resGoldVal);
  resGoldBox.append(resGoldIcon, resGoldTextCol);

  const resKillsBox = el('div', 'result-stat-box');
  const resKillsIcon = makeSvgNode(
    `<svg viewBox="0 0 40 40" width="36" height="36" fill="none" class="result-stat-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="resSkullBone" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stop-color="#f4f0ff"/>
          <stop offset="65%" stop-color="#c4bdd6"/>
          <stop offset="100%" stop-color="#7c7394"/>
        </linearGradient>
      </defs>
      <path d="M7 31 L33 9 M33 31 L7 9" stroke="#64587e" stroke-width="2" stroke-linecap="round" opacity="0.65"/>
      <path d="M20 5.5 C12.4 5.5 8 10.8 8 17.6 C8 21.4 9.8 23.8 11.8 25.4 L12.8 31.8 L16 33.4 H24 L27.2 31.8 L28.2 25.4 C30.2 23.8 32 21.4 32 17.6 C32 10.8 27.6 5.5 20 5.5 Z" fill="url(#resSkullBone)" stroke="#e5dcf5" stroke-width="1.25" stroke-linejoin="round"/>
      <path d="M23.5 8.2 L21.8 11.4 L23 13.1" stroke="#4c3f63" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11.6 17.6 L17.3 18.8 L16.2 22.4 L12.3 21.4 Z" fill="#1a0b24"/>
      <path d="M28.4 17.6 L22.7 18.8 L23.8 22.4 L27.7 21.4 Z" fill="#1a0b24"/>
      <circle cx="14.9" cy="20.1" r="1.4" fill="#ef4444"/>
      <circle cx="25.1" cy="20.1" r="1.4" fill="#ef4444"/>
      <polygon points="20,21.6 18.3,25.6 21.7,25.6" fill="#231233"/>
      <path d="M14.2 28.4 H25.8 M16.4 28.4 V32.4 M20 28.4 V32.8 M23.6 28.4 V32.4" stroke="#312445" stroke-width="1.35" stroke-linecap="round"/>
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
      `<svg viewBox="0 0 44 34" width="36" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="resBotGold" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="55%" stop-color="#d49b38"/>
            <stop offset="100%" stop-color="#854d0e"/>
          </linearGradient>
        </defs>
        <path d="M11 15 C4 11 4 4.5 8.5 2 C7.2 7 9.5 10.4 14.5 12.2 Z" fill="#b45309" stroke="#fde093" stroke-width="0.8"/>
        <path d="M33 15 C40 11 40 4.5 35.5 2 C36.8 7 34.5 10.4 29.5 12.2 Z" fill="#b45309" stroke="#fde093" stroke-width="0.8"/>
        <path d="M22 6.5 C16.2 6.5 13 10.8 13 16.2 C13 19.6 14.8 22 16.8 23.6 L18.2 29.8 H25.8 L27.2 23.6 C29.2 22 31 19.6 31 16.2 C31 10.8 27.8 6.5 22 6.5 Z" fill="url(#resBotGold)" stroke="#fef3c7" stroke-width="1.05" stroke-linejoin="round"/>
        <path d="M16.2 16 L20.4 17 L19.6 19.4 L16.8 18.8 Z" fill="#180d1f"/>
        <path d="M27.8 16 L23.6 17 L24.4 19.4 L27.2 18.8 Z" fill="#180d1f"/>
        <polygon points="22,19.4 20.8,22.2 23.2,22.2" fill="#180d1f"/>
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

  function hideResultModal() {
    resultModal.classList.add('hidden');
  }

  function showResultModal(
    {
      victory = false,
      level = 1,
      goldEarned = 0,
      kills = 0,
      unlockedWeapon = null,
      canRevive = false,
      canDoubleGold = true,
      canBossRematch = false,
      stars = 0,
      elapsedSec = 0,
      isEndless = false,
      endlessWave = 1,
      bestEndlessKills = 0
    } = {},
    actions = {}
  ) {
    closeSoundPopover();
    const lang = getLang();
    const callbacks = getCallbacks();
    resultPanel.classList.toggle('is-victory', Boolean(victory));
    resultPanel.classList.toggle('is-defeat', !victory);

    const lvlDef = getLevelDef(Number(level) || 1);
    resultCrest.innerHTML = '';
    if (victory) {
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
            <path d="M18 56 L38 44 L48 60 L26 64 L24 58 Z" fill="#991b1b" stroke="#fca5a5" stroke-width="0.9"/>
            <path d="M122 56 L102 44 L92 60 L114 64 L116 58 Z" fill="#991b1b" stroke="#fca5a5" stroke-width="0.9"/>
            <path d="M44 58 C33 50 30 34 38 22 C37 32 41 44 50 52 Z" fill="#eab308" stroke="#fef08a" stroke-width="1"/>
            <path d="M96 58 C107 50 110 34 102 22 C103 32 99 44 90 52 Z" fill="#eab308" stroke="#fef08a" stroke-width="1"/>
            <circle cx="70" cy="41" r="24" fill="#271838" stroke="#facc15" stroke-width="2.6"/>
            <circle cx="70" cy="41" r="19.5" fill="rgba(234,179,8,0.16)" stroke="#fde047" stroke-width="1"/>
            <polygon points="54,48 57,30 64,37 70,24 76,37 83,30 86,48" fill="#facc15" stroke="#fffbeb" stroke-width="1.5" stroke-linejoin="round"/>
            <rect x="55" y="50" width="30" height="4.2" rx="1.6" fill="#eab308"/>
          </svg>`
        )
      );
    } else {
      resultCrest.appendChild(
        makeSvgNode(
          `<svg viewBox="0 0 140 76" width="132" height="70" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <radialGradient id="defBloodGlow" cx="50%" cy="52%" r="50%">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.58"/>
                <stop offset="55%" stop-color="#991b1b" stop-opacity="0.24"/>
                <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="defSkullGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stop-color="#f8f4ff"/>
                <stop offset="65%" stop-color="#cbc3dc"/>
                <stop offset="100%" stop-color="#877d9e"/>
              </linearGradient>
            </defs>
            <circle cx="70" cy="40" r="35" fill="url(#defBloodGlow)"/>
            <path d="M24 58 L54 34 L59 40 L31 61 L26 60 Z" fill="#3f3354" stroke="#e5b85c" stroke-width="0.9"/>
            <path d="M116 58 L86 34 L81 40 L109 61 L114 60 Z" fill="#3f3354" stroke="#e5b85c" stroke-width="0.9"/>
            <path d="M44 55 C33 47 31 33 38 22 C37 32 41 42 49 49 Z" fill="#7f1d1d" stroke="#fca5a5" stroke-width="0.95"/>
            <path d="M96 55 C107 47 109 33 102 22 C103 32 99 42 91 49 Z" fill="#7f1d1d" stroke="#fca5a5" stroke-width="0.95"/>
            <circle cx="70" cy="40" r="24.5" fill="#1c0b16" stroke="#dc2626" stroke-width="2.4"/>
            <circle cx="70" cy="40" r="20.5" fill="rgba(127,29,29,0.22)" stroke="rgba(229,184,92,0.68)" stroke-width="1"/>
            <path d="M70 22.5 C61.2 22.5 56 28.4 56 35.8 C56 40 58 43 60.5 44.8 L61.8 52 H78.2 L79.5 44.8 C82 43 84 40 84 35.8 C84 28.4 78.8 22.5 70 22.5 Z" fill="url(#defSkullGrad)" stroke="#fef2f2" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M74 25.2 L72 29.2 L73.6 31" stroke="#5b3446" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M60.2 35.4 L66.8 36.8 L65.5 40.8 L61.2 39.6 Z" fill="#1c0814"/>
            <path d="M79.8 35.4 L73.2 36.8 L74.5 40.8 L78.8 39.6 Z" fill="#1c0814"/>
            <circle cx="64" cy="38.2" r="1.65" fill="#ef4444"/>
            <circle cx="76" cy="38.2" r="1.65" fill="#ef4444"/>
            <polygon points="70,39.8 68.1,44.4 71.9,44.4" fill="#2b0d1b"/>
            <path d="M63.8 47.4 H76.2 M66.6 47.4 V51.4 M70 47.4 V51.6 M73.4 47.4 V51.4" stroke="#3f2738" stroke-width="1.35" stroke-linecap="round"/>
          </svg>`
        )
      );
    }

    const earnedStarsCount = victory ? Math.max(1, Math.min(3, Number(stars) || 1)) : 0;
    const starDisplay = victory ? ` • ${'★'.repeat(earnedStarsCount)}${'☆'.repeat(3 - earnedStarsCount)}` : '';
    if (isEndless) {
      resultTitle.textContent = lang === 'en' ? 'Endless Horde Ended' : 'Конец Бесконечной Орды';
      resultLevelName.textContent =
        `${lang === 'en' ? 'Wave' : 'Волна'} ${Math.max(1, Number(endlessWave) || 1)} • ${formatTimeMMSS(elapsedSec)}` +
        (bestEndlessKills > 0 ? ` • ${lang === 'en' ? 'Best' : 'Рекорд'}: ${bestEndlessKills}` : '');
    } else {
      resultTitle.textContent = victory ? `Победа! Глава очищена!${starDisplay}` : 'Охотник пал в бою';
      resultLevelName.textContent = (lvlDef ? lvlDef.nameRu : `Глава ${level}`) + (elapsedSec > 0 ? ` • ${elapsedSec}с` : '');
    }

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
      if (canBossRematch) {
        const rematchBtn = el('button', 'result-btn btn-boss-rematch');
        rematchBtn.type = 'button';
        rematchBtn.appendChild(el('span', 'result-btn-label', '⚔️ Снова к боссу (Арена)'));
        rematchBtn.addEventListener('click', async () => {
          rematchBtn.disabled = true;
          hideResultModal();
          await (actions.onBossRematch || callbacks.onBossRematch)?.();
        });
        resultActionsCol.appendChild(rematchBtn);
      }

      if (canRevive) {
        const reviveBtn = el('button', 'result-btn btn-revive');
        reviveBtn.type = 'button';
        setModalButtonContent(reviveBtn, 'revive', 'Воскреснуть с полным HP (Видео)');
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

      const arsenalBtn = el('button', 'result-btn btn-arsenal-primary');
      arsenalBtn.type = 'button';
      setModalButtonContent(arsenalBtn, 'arsenal', 'В Лагерь • Арсенал');
      arsenalBtn.addEventListener('click', () => {
        hideResultModal();
        setActiveTab('arsenal');
        (actions.onArsenal || actions.onGoToArsenal || actions.onHub || callbacks.onExitToHub)?.();
      });
      resultActionsCol.appendChild(arsenalBtn);

      const retryBtn = el('button', 'result-btn btn-retry');
      retryBtn.type = 'button';
      setModalButtonContent(
        retryBtn,
        'retry',
        canBossRematch ? 'С начала главы (Костёр)' : isEndless ? 'Повторить Орду' : 'Повторить главу'
      );
      retryBtn.addEventListener('click', () => {
        hideResultModal();
        (actions.onRetry || actions.onRestart || callbacks.onRetry)?.();
      });
      resultActionsCol.appendChild(retryBtn);
    } else {
      if (canDoubleGold && displayedGold > 0) {
        const doubleBtn = el('button', 'result-btn btn-double-gold');
        doubleBtn.type = 'button';
        setModalButtonContent(doubleBtn, 'double_gold', 'Удвоить добычу ×2 (Видео)');
        doubleBtn.addEventListener('click', async () => {
          doubleBtn.disabled = true;
          const res = await (actions.onDoubleGold || callbacks.onDoubleGold)?.();
          if (res !== false) {
            if (doubleBtn.isConnected) {
              displayedGold *= 2;
              resGoldVal.textContent = `+${displayedGold} (×2!)`;
              setModalButtonContent(doubleBtn, 'sparkle_done', 'Добыча удвоена!');
            }
          } else {
            doubleBtn.disabled = false;
          }
        });
        resultActionsCol.appendChild(doubleBtn);
      }

      const nextArsenalBtn = el('button', 'result-btn btn-arsenal-primary');
      nextArsenalBtn.type = 'button';
      setModalButtonContent(nextArsenalBtn, 'campaign_map', 'На карту похода • Далее');
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
        const replayBtn = el('button', 'result-btn btn-retry');
        replayBtn.type = 'button';
        setModalButtonContent(replayBtn, 'retry', 'Повторить главу');
        replayBtn.addEventListener('click', () => {
          hideResultModal();
          (actions.onRetry || actions.onRestart)?.();
        });
        resultActionsCol.appendChild(replayBtn);
      }
    }

    resultModal.classList.remove('hidden');
  }

  // =========================================================================
  // 4. MAGE STARTER ELEMENT MODAL
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
    const callbacks = getCallbacks();
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
        const equippedWpnId = getCurrentEquippedWeaponId();
        if (launchLvl === '__endless__') {
          callbacks.onStartEndless?.({
            classId: 'mage',
            weaponId: equippedWpnId
          });
        } else if (launchLvl !== null) {
          (callbacks.onStartRun || callbacks.onStartGame || callbacks.onPlay)?.({
            classId: 'mage',
            weaponId: equippedWpnId,
            level: launchLvl
          });
        }
      });
      mageStarterGrid.appendChild(card);
    }

    mageStarterModal.classList.remove('hidden');
  }

  // =========================================================================
  // 5. FULL PROGRESS RESET CONFIRMATION MODAL
  // =========================================================================
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

  resetConfirmYesBtn.addEventListener('click', () => {
    hideResetConfirmModal();
    resetLocalSelection?.();
    getCallbacks().onResetProgress?.();
  });

  resetConfirmModal.addEventListener('click', (e) => {
    if (e.target === resetConfirmModal) hideResetConfirmModal();
  });

  // =========================================================================
  // 6. IN-GAME PAUSE MODAL
  // =========================================================================
  const pauseModal = el('div', 'modal-backdrop pause-modal-backdrop hidden');
  const pausePanel = el('div', 'modal-panel pause-modal-panel');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    pausePanel.appendChild(el('span', `gothic-card-clasp ${pos}`));
  }
  const pauseTitle = el('h2', 'modal-title pause-modal-title');
  pauseTitle.append(createModalIconSvg('pause_title', 'pause-title-svg'), el('span', '', 'ПАУЗА'));
  const pauseSub = el('p', 'modal-subtitle pause-modal-sub', 'Охота приостановлена');
  const pauseTogglesBox = el('div', 'pause-toggles-box');
  pauseTogglesBox.append(autoAimBtn, attackToggleBtn, touchPreviewBtn);
  const pauseActions = el('div', 'result-actions-col pause-actions-col');

  const pauseResumeBtn = el('button', 'result-btn btn-arsenal-primary');
  pauseResumeBtn.type = 'button';
  setModalButtonContent(pauseResumeBtn, 'play', 'Продолжить бой');
  const pauseRestartBtn = el('button', 'result-btn btn-retry');
  pauseRestartBtn.type = 'button';
  setModalButtonContent(pauseRestartBtn, 'retry', 'Начать главу заново');
  const pauseExitBtn = el('button', 'result-btn btn-confirm-reset');
  pauseExitBtn.type = 'button';
  setModalButtonContent(pauseExitBtn, 'camp', 'Выйти в главное меню');

  pauseActions.append(pauseResumeBtn, pauseRestartBtn, pauseExitBtn);
  pausePanel.append(pauseTitle, pauseSub, pauseTogglesBox, pauseActions);
  pauseModal.appendChild(pausePanel);
  root.appendChild(pauseModal);

  let activePauseHandlers = {};

  function hidePauseModal() {
    pauseModal.classList.add('hidden');
    activePauseHandlers = {};
  }

  function showPauseModal(info = {}, handlers = {}) {
    closeSoundPopover();
    const lang = getLang();
    activePauseHandlers = handlers || {};
    syncPauseToggles?.();
    const isSoulsPause = Boolean(info.isSoulslike || Number(info.level) === 26);
    const isEndlessPause = !isSoulsPause && Boolean(info.isEndless);
    pauseSub.innerHTML = '';
    if (isSoulsPause) {
      const zoneTitle = info.souls?.zoneTitleRu || '';
      pauseSub.textContent = zoneTitle ? `Abandoned Knight Rift • ${zoneTitle}` : 'Abandoned Knight Rift';
      setModalButtonContent(pauseResumeBtn, 'play', 'Продолжить');
      setModalButtonContent(pauseRestartBtn, 'retry', 'Сразиться заново (Костёр)');
      setModalButtonContent(pauseExitBtn, 'camp', 'Вернуться в Хаб');
    } else {
      setModalButtonContent(pauseResumeBtn, 'play', 'Продолжить бой');
      setModalButtonContent(pauseRestartBtn, 'retry', 'Начать главу заново');
      setModalButtonContent(pauseExitBtn, 'camp', 'Выйти в главное меню');
      const chName = isEndlessPause
        ? (lang === 'en' ? 'Endless Horde' : 'Бесконечная Орда')
        : (info.levelNameRu || `Глава ${info.level || 1}`);
      const phaseStr = isEndlessPause
        ? `${lang === 'en' ? 'Wave' : 'Волна'} ${Math.max(1, Number(info.endlessWave) || 1)} • ${formatTimeMMSS(info.elapsedSec ?? info.elapsedTime ?? 0)}`
        : (info.phaseText || '');
      const goldEarned = Math.floor(Number(info.goldRun) || 0);
      const prefix = `${chName}${phaseStr ? ` • ${phaseStr}` : ''} • Добыто: `;
      pauseSub.append(
        document.createTextNode(prefix),
        el('span', 'pause-gold-nowrap', `+${goldEarned}\u00A0зол.`)
      );
    }
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

  function handleKeydown(e) {
    if (!soundPopover.classList.contains('hidden') && e.code === 'Escape') {
      closeSoundPopover();
      return true;
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
      return true;
    }

    if (!mageStarterModal.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        e.preventDefault();
        pendingStartAfterStarterChoice = null;
        hideMageStarterModal();
      }
      return true;
    }

    if (!resetConfirmModal.classList.contains('hidden')) {
      if (e.code === 'Escape') {
        e.preventDefault();
        hideResetConfirmModal();
      }
      return true;
    }

    return false;
  }

  function isStageBlockedByModal() {
    return (
      !mageStarterModal.classList.contains('hidden') ||
      !resetConfirmModal.classList.contains('hidden')
    );
  }

  function isRunModalOpen() {
    return (
      !levelUpModal.classList.contains('hidden') ||
      !resultModal.classList.contains('hidden')
    );
  }

  function isPauseModalOpen() {
    return !pauseModal.classList.contains('hidden');
  }

  function hideAllModals() {
    closeSoundPopover();
    hideLevelUpModal();
    hideResultModal();
    hidePauseModal();
    hideMageStarterModal();
    hideResetConfirmModal();
  }

  return {
    closeSoundPopover,
    toggleSoundPopover,
    syncMuteButtons,
    showLevelUpModal,
    hideLevelUpModal,
    showResultModal,
    hideResultModal,
    openMageStarterModal,
    hideMageStarterModal,
    hideResetConfirmModal,
    showPauseModal,
    hidePauseModal,
    isPauseModalOpen,
    isStageBlockedByModal,
    isRunModalOpen,
    handleKeydown,
    hideAllModals
  };
}
