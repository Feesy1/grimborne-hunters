// Pure Gothic Souls Modals & Sound/Settings Controller
// - In-Game Sound Popover (HUD top-right speaker)
// - Gothic Settings Modal (Audio, Graphics Quality, PC Controls, Save Reset)
// - Save Reset Confirmation Modal
// - In-Game Pause Modal (Resume / Restart at Bonfire / Settings / Main Menu)

import { el } from './resolvers.js?v=20261124z93';
import { createModalIconSvg, setModalButtonContent } from './svgIcons.js?v=20261124z93';

export function createModalsController({
  root,
  hudMuteBtn,
  getLang,
  getCallbacks,
  getAudioState,
  setAudioState,
  getLowSpecState,
  setLowSpecState,
  getShowFpsState,
  setShowFpsState,
  getShowUncappedFpsState,
  setShowUncappedFpsState,
  hasCustomTouchLayout
}) {
  // =========================================================================
  // 1. IN-GAME SOUND POPOVER (Zero raw OS emojis — pure gothic dark iron + gold)
  // =========================================================================
  const soundPopover = el('div', 'sound-popover hidden');

  const musicPopHead = el('div', 'sound-pop-head');
  const musicPopTitle = el('span', 'sound-pop-title', 'Музыка');
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
  const soundPopTitle = el('span', 'sound-pop-title', 'Звуки и эффекты');
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
  soundSlider.setAttribute('aria-label', 'Громкость звуков и эффектов');
  soundSliderWrap.appendChild(soundSlider);

  const voicePopHead = el('div', 'sound-pop-head');
  const voicePopTitle = el('span', 'sound-pop-title', 'Речь в кат-сценах');
  const voicePopVal = el('span', 'sound-pop-val', '100%');
  voicePopHead.append(voicePopTitle, voicePopVal);

  const voiceSliderWrap = el('div', 'sound-slider-wrap');
  const voiceSlider = document.createElement('input');
  voiceSlider.type = 'range';
  voiceSlider.className = 'sound-volume-slider';
  voiceSlider.min = '0';
  voiceSlider.max = '100';
  voiceSlider.step = '1';
  voiceSlider.value = '100';
  voiceSlider.setAttribute('aria-label', 'Громкость речи в кат-сценах');
  voiceSliderWrap.appendChild(voiceSlider);

  const soundMuteToggleBtn = el('button', 'sound-mute-toggle-btn', 'Выключить звук');
  soundMuteToggleBtn.type = 'button';

  soundPopover.append(
    musicPopHead,
    musicSliderWrap,
    soundPopHead,
    soundSliderWrap,
    voicePopHead,
    voiceSliderWrap,
    soundMuteToggleBtn
  );
  root.appendChild(soundPopover);

  let soundAnchorBtn = null;

  function positionSoundPopover(anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popWidth = 248;
    const left = Math.max(10, Math.min(window.innerWidth - popWidth - 10, rect.right - popWidth));
    const top = Math.max(10, Math.min(window.innerHeight - 230, rect.bottom + 8));
    soundPopover.style.left = `${Math.round(left)}px`;
    soundPopover.style.top = `${Math.round(top)}px`;
  }

  function closeSoundPopover() {
    if (soundPopover.classList.contains('hidden')) return;
    soundPopover.classList.add('hidden');
    hudMuteBtn?.classList.remove('is-open');
    soundAnchorBtn = null;
  }

  function toggleSoundPopover(anchorBtn) {
    if (!soundPopover.classList.contains('hidden') && soundAnchorBtn === anchorBtn) {
      closeSoundPopover();
      return;
    }
    soundAnchorBtn = anchorBtn;
    hudMuteBtn?.classList.toggle('is-open', anchorBtn === hudMuteBtn);
    soundPopover.classList.remove('hidden');
    positionSoundPopover(anchorBtn);
  }

  const makeSpeakerSvg = (level) => {
    const waves =
      level === 0
        ? '<path d="M15.8 9.2 L20.4 14.8 M20.4 9.2 L15.8 14.8" stroke="#c86b5c" stroke-width="1.8" stroke-linecap="round"/>'
        : level === 1
          ? '<path d="M15.6 9.4 C17 10.7 17 13.3 15.6 14.6" stroke="#e5c787" stroke-width="1.7" stroke-linecap="round"/>'
          : '<path d="M15.4 9.2 C16.9 10.6 16.9 13.4 15.4 14.8 M18.1 6.8 C20.8 9.4 20.8 14.6 18.1 17.2" stroke="#e5c787" stroke-width="1.65" stroke-linecap="round"/>';
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4.5 9.5 H8.2 L12.8 5.5 V18.5 L8.2 14.5 H4.5 Z" fill="rgba(229,184,92,0.22)" stroke="#e5c787" stroke-width="1.6" stroke-linejoin="round"/>${waves}</svg>`;
  };

  // =========================================================================
  // 2. GOTHIC SETTINGS MODAL (Audio + Graphics + Controls + Save Reset)
  // =========================================================================
  const settingsModal = el('div', 'modal-backdrop souls-settings-backdrop hidden');
  const settingsPanel = el('div', 'modal-panel souls-settings-panel');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    settingsPanel.appendChild(el('span', `gothic-card-clasp ${pos}`));
  }

  const settingsHead = el('div', 'souls-settings-head');
  const settingsTitle = el('h2', 'modal-title souls-settings-title', 'НАСТРОЙКИ');
  const settingsCloseX = el('button', 'souls-settings-x', '×');
  settingsCloseX.type = 'button';
  settingsCloseX.setAttribute('aria-label', 'Закрыть');
  settingsHead.append(settingsTitle, settingsCloseX);

  const settingsBody = el('div', 'souls-settings-body');

  // Audio block
  const audioSection = el('div', 'souls-settings-section');
  audioSection.appendChild(el('div', 'souls-settings-sec-label', 'АУДИО'));

  const setMusicRow = el('div', 'sound-pop-head');
  const setMusicLbl = el('span', 'sound-pop-title', 'Музыка');
  const setMusicVal = el('span', 'sound-pop-val', '38%');
  setMusicRow.append(setMusicLbl, setMusicVal);
  const setMusicSlider = document.createElement('input');
  setMusicSlider.type = 'range';
  setMusicSlider.className = 'sound-volume-slider';
  setMusicSlider.min = '0';
  setMusicSlider.max = '100';
  setMusicSlider.step = '1';
  setMusicSlider.value = '38';

  const setSfxRow = el('div', 'sound-pop-head');
  const setSfxLbl = el('span', 'sound-pop-title', 'Звуки и эффекты');
  const setSfxVal = el('span', 'sound-pop-val', '75%');
  setSfxRow.append(setSfxLbl, setSfxVal);
  const setSfxSlider = document.createElement('input');
  setSfxSlider.type = 'range';
  setSfxSlider.className = 'sound-volume-slider';
  setSfxSlider.min = '0';
  setSfxSlider.max = '100';
  setSfxSlider.step = '1';
  setSfxSlider.value = '75';

  const setVoiceRow = el('div', 'sound-pop-head');
  const setVoiceLbl = el('span', 'sound-pop-title', 'Речь в кат-сценах');
  const setVoiceVal = el('span', 'sound-pop-val', '100%');
  setVoiceRow.append(setVoiceLbl, setVoiceVal);
  const setVoiceSlider = document.createElement('input');
  setVoiceSlider.type = 'range';
  setVoiceSlider.className = 'sound-volume-slider';
  setVoiceSlider.min = '0';
  setVoiceSlider.max = '100';
  setVoiceSlider.step = '1';
  setVoiceSlider.value = '100';

  const setMuteBtn = el('button', 'souls-settings-toggle-btn', 'Звук: ВКЛ');
  setMuteBtn.type = 'button';

  audioSection.append(setMusicRow, setMusicSlider, setSfxRow, setSfxSlider, setVoiceRow, setVoiceSlider, setMuteBtn);

  // Graphics block
  const gfxSection = el('div', 'souls-settings-section');
  gfxSection.appendChild(el('div', 'souls-settings-sec-label', 'ГРАФИКА'));
  const gfxRow = el('div', 'souls-settings-row');
  const gfxLabel = el('span', 'souls-settings-row-lbl', 'Качество рендера');
  const gfxToggleBtn = el('button', 'souls-settings-pill-btn', 'Высокое');
  gfxToggleBtn.type = 'button';
  gfxRow.append(gfxLabel, gfxToggleBtn);

  const fpsRow = el('div', 'souls-settings-row');
  const fpsLabel = el('span', 'souls-settings-row-lbl', 'Счётчик кадров (FPS)');
  const fpsToggleBtn = el('button', 'souls-settings-pill-btn', 'ВКЛ');
  fpsToggleBtn.type = 'button';
  fpsRow.append(fpsLabel, fpsToggleBtn);

  const fpsUncappedRow = el('div', 'souls-settings-row');
  const fpsUncappedLabel = el('span', 'souls-settings-row-lbl', 'FPS без лимита (потенциал MAX)');
  const fpsUncappedToggleBtn = el('button', 'souls-settings-pill-btn', 'ВКЛ');
  fpsUncappedToggleBtn.type = 'button';
  fpsUncappedRow.append(fpsUncappedLabel, fpsUncappedToggleBtn);

  gfxSection.append(gfxRow, fpsRow, fpsUncappedRow);

  // Touch controls customization block
  const touchSection = el('div', 'souls-settings-section');
  touchSection.appendChild(el('div', 'souls-settings-sec-label', 'СЕНСОРНОЕ УПРАВЛЕНИЕ'));
  const touchCustomRow = el('div', 'souls-settings-row');
  const touchCustomLabel = el('span', 'souls-settings-row-lbl', 'Позиция и размер кнопок');
  const touchCustomBtnGroup = el('div', 'souls-settings-btn-pair');
  const touchResetLayoutBtn = el('button', 'souls-settings-pill-btn is-low', 'Сброс');
  touchResetLayoutBtn.type = 'button';
  const touchCustomizeBtn = el('button', 'souls-settings-pill-btn is-accent', 'Настроить');
  touchCustomizeBtn.type = 'button';
  touchCustomBtnGroup.append(touchResetLayoutBtn, touchCustomizeBtn);
  touchCustomRow.append(touchCustomLabel, touchCustomBtnGroup);
  touchSection.appendChild(touchCustomRow);

  // Controls reference block
  const ctrlSection = el('div', 'souls-settings-section');
  ctrlSection.appendChild(el('div', 'souls-settings-sec-label', 'УПРАВЛЕНИЕ (ПК)'));
  const ctrlGrid = el('div', 'souls-controls-grid');
  const controlBindings = [
    ['WASD', 'Движение'],
    ['Shift', 'Бег (спринт)'],
    ['ЛКМ', 'Удар мечом / Казнь'],
    ['ПКМ', 'Блок / Парирование'],
    ['Space', 'Перекат'],
    ['R', 'Фляга Эстуса'],
    ['Q / СКМ', 'Захват цели'],
    ['E', 'Взаимодействие']
  ];
  for (const [k, desc] of controlBindings) {
    const item = el('div', 'souls-ctrl-item');
    item.append(el('span', 'souls-ctrl-key', k), el('span', 'souls-ctrl-desc', desc));
    ctrlGrid.appendChild(item);
  }
  ctrlSection.appendChild(ctrlGrid);

  // Save management block
  const saveSection = el('div', 'souls-settings-section souls-settings-footer-row');
  const resetSaveBtn = el('button', 'souls-settings-danger-btn', 'Сбросить сохранение');
  resetSaveBtn.type = 'button';
  const settingsDoneBtn = el('button', 'souls-settings-primary-btn', 'Готово');
  settingsDoneBtn.type = 'button';
  saveSection.append(resetSaveBtn, settingsDoneBtn);

  settingsBody.append(audioSection, gfxSection, touchSection, ctrlSection, saveSection);
  settingsPanel.append(settingsHead, settingsBody);
  settingsModal.appendChild(settingsPanel);
  root.appendChild(settingsModal);

  function syncGraphicsButton() {
    const isLow = Boolean(getLowSpecState?.());
    gfxToggleBtn.textContent = isLow ? 'Низкое (FPS)' : 'Высокое';
    gfxToggleBtn.classList.toggle('is-low', isLow);
    const showFps = Boolean(getShowFpsState ? getShowFpsState() : true);
    fpsToggleBtn.textContent = showFps ? 'ВКЛ' : 'ВЫКЛ';
    fpsToggleBtn.classList.toggle('is-low', !showFps);
    const showUncapped = Boolean(getShowUncappedFpsState ? getShowUncappedFpsState() : true);
    fpsUncappedToggleBtn.textContent = showUncapped ? 'ВКЛ' : 'ВЫКЛ';
    fpsUncappedToggleBtn.classList.toggle('is-low', !showUncapped);
    fpsUncappedRow.style.opacity = showFps ? '1' : '0.52';
    const hasCustom = Boolean(hasCustomTouchLayout?.());
    touchResetLayoutBtn.disabled = !hasCustom;
    touchResetLayoutBtn.style.opacity = hasCustom ? '1' : '0.45';
  }

  function syncMuteButtons() {
    const lang = getLang();
    const { muted, volume, musicVolume, voiceVolume = 1.0 } = getAudioState();
    const effectiveVol = muted ? 0 : volume;
    const effectiveMusic = muted ? 0 : musicVolume;
    const effectiveVoice = muted ? 0 : voiceVolume;
    const anyAudio = effectiveVol > 0.001 || effectiveMusic > 0.001 || effectiveVoice > 0.001;
    const lvl = !anyAudio ? 0 : effectiveVol < 0.45 ? 1 : 2;
    if (hudMuteBtn && hudMuteBtn.dataset.volLvl !== String(lvl)) {
      hudMuteBtn.dataset.volLvl = String(lvl);
      hudMuteBtn.innerHTML = makeSpeakerSvg(lvl);
    }

    const mPct = Math.round(effectiveMusic * 100);
    const mTitle = lang === 'en' ? 'Music' : 'Музыка';
    const mValText = muted ? (lang === 'en' ? 'Muted' : 'Выкл') : `${mPct}%`;
    musicPopTitle.textContent = mTitle;
    musicPopVal.textContent = mValText;
    musicSlider.value = String(mPct);
    musicSlider.style.setProperty('--vol-pct', `${mPct}%`);
    setMusicLbl.textContent = mTitle;
    setMusicVal.textContent = mValText;
    setMusicSlider.value = String(mPct);
    setMusicSlider.style.setProperty('--vol-pct', `${mPct}%`);

    const pct = Math.round(effectiveVol * 100);
    const sTitle = lang === 'en' ? 'Sound & SFX' : 'Звуки и эффекты';
    const sValText = muted ? (lang === 'en' ? 'Muted' : 'Выкл') : `${pct}%`;
    soundPopTitle.textContent = sTitle;
    soundPopVal.textContent = sValText;
    soundSlider.value = String(pct);
    soundSlider.style.setProperty('--vol-pct', `${pct}%`);
    setSfxLbl.textContent = sTitle;
    setSfxVal.textContent = sValText;
    setSfxSlider.value = String(pct);
    setSfxSlider.style.setProperty('--vol-pct', `${pct}%`);

    const vPct = Math.max(0, Math.min(100, Math.round(effectiveVoice * 100)));
    const vTitle = lang === 'en' ? 'Cutscene Speech' : 'Речь в кат-сценах';
    const vValText = muted ? (lang === 'en' ? 'Muted' : 'Выкл') : `${vPct}%`;
    voicePopTitle.textContent = vTitle;
    voicePopVal.textContent = vValText;
    voiceSlider.value = String(vPct);
    voiceSlider.style.setProperty('--vol-pct', `${vPct}%`);
    setVoiceLbl.textContent = vTitle;
    setVoiceVal.textContent = vValText;
    setVoiceSlider.value = String(vPct);
    setVoiceSlider.style.setProperty('--vol-pct', `${vPct}%`);

    const isMutedNow = muted || !anyAudio;
    soundMuteToggleBtn.classList.toggle('is-muted', isMutedNow);
    soundMuteToggleBtn.textContent = isMutedNow
      ? (lang === 'en' ? 'Unmute Audio' : 'Включить звук')
      : (lang === 'en' ? 'Mute Audio' : 'Выключить звук');
    setMuteBtn.classList.toggle('is-muted', isMutedNow);
    setMuteBtn.textContent = isMutedNow ? 'Звук: ВЫКЛ' : 'Звук: ВКЛ';
    syncGraphicsButton();
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

  const applyMusicSliderVal = (rawVal) => {
    const callbacks = getCallbacks();
    const st = getAudioState();
    const pct = Math.max(0, Math.min(100, Number(rawVal) || 0));
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
  };

  const applySfxSliderVal = (rawVal) => {
    const callbacks = getCallbacks();
    const st = getAudioState();
    const pct = Math.max(0, Math.min(100, Number(rawVal) || 0));
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
  };

  hudMuteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSoundPopover(hudMuteBtn);
  });
  hudMuteBtn?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handleToggleMute();
  });

  soundMuteToggleBtn.addEventListener('click', handleToggleMute);
  setMuteBtn.addEventListener('click', handleToggleMute);
  musicSlider.addEventListener('input', () => applyMusicSliderVal(musicSlider.value));
  setMusicSlider.addEventListener('input', () => applyMusicSliderVal(setMusicSlider.value));
  soundSlider.addEventListener('input', () => applySfxSliderVal(soundSlider.value));
  setSfxSlider.addEventListener('input', () => applySfxSliderVal(setSfxSlider.value));

  const applyVoiceSliderVal = (rawVal) => {
    const callbacks = getCallbacks();
    const st = getAudioState();
    const pct = Math.max(0, Math.min(100, Number(rawVal) || 0));
    const nextVoiceVol = pct / 100;
    let nextMuted = st.muted;
    if (nextVoiceVol > 0.01 && nextMuted) {
      nextMuted = false;
      const mRes = callbacks.onToggleMute?.(false);
      if (typeof mRes === 'boolean') nextMuted = mRes;
    }
    setAudioState({ voiceVolume: nextVoiceVol, muted: nextMuted });
    callbacks.onVoiceVolumeChange?.(nextVoiceVol);
    syncMuteButtons();
  };
  voiceSlider.addEventListener('input', () => applyVoiceSliderVal(voiceSlider.value));
  setVoiceSlider.addEventListener('input', () => applyVoiceSliderVal(setVoiceSlider.value));

  gfxToggleBtn.addEventListener('click', () => {
    const nextLow = !Boolean(getLowSpecState?.());
    setLowSpecState?.(nextLow);
    getCallbacks().onSetLowSpec?.(nextLow);
    syncGraphicsButton();
  });

  fpsToggleBtn.addEventListener('click', () => {
    const nextShow = !Boolean(getShowFpsState ? getShowFpsState() : true);
    setShowFpsState?.(nextShow);
    getCallbacks().onSetShowFps?.(nextShow);
    syncGraphicsButton();
  });

  fpsUncappedToggleBtn.addEventListener('click', () => {
    const nextUncapped = !Boolean(getShowUncappedFpsState ? getShowUncappedFpsState() : true);
    setShowUncappedFpsState?.(nextUncapped);
    if (nextUncapped && !Boolean(getShowFpsState ? getShowFpsState() : true)) {
      setShowFpsState?.(true);
      getCallbacks().onSetShowFps?.(true);
    }
    getCallbacks().onSetShowUncappedFps?.(nextUncapped);
    syncGraphicsButton();
  });

  touchCustomizeBtn.addEventListener('click', () => {
    const wasPaused = !pauseModal.classList.contains('hidden');
    const savedPauseHandlers = { ...activePauseHandlers };
    closeSoundPopover();
    closeSettingsModal();
    pauseModal.classList.add('hidden');
    getCallbacks().onOpenTouchCustomizer?.({ fromPause: wasPaused, pauseHandlers: savedPauseHandlers });
  });

  touchResetLayoutBtn.addEventListener('click', () => {
    getCallbacks().onResetTouchLayout?.();
    syncGraphicsButton();
  });

  function openSettingsModal() {
    closeSoundPopover();
    syncMuteButtons();
    settingsModal.classList.remove('hidden');
  }
  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
  }
  function isSettingsModalOpen() {
    return !settingsModal.classList.contains('hidden');
  }

  settingsCloseX.addEventListener('click', closeSettingsModal);
  settingsDoneBtn.addEventListener('click', closeSettingsModal);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  window.addEventListener('pointerdown', (e) => {
    if (soundPopover.classList.contains('hidden')) return;
    const t = e.target;
    if (soundPopover.contains(t) || hudMuteBtn?.contains(t)) return;
    closeSoundPopover();
  });
  window.addEventListener('resize', () => {
    if (!soundPopover.classList.contains('hidden') && soundAnchorBtn) {
      positionSoundPopover(soundAnchorBtn);
    }
  });

  // =========================================================================
  // 3. SAVE RESET CONFIRMATION MODAL
  // =========================================================================
  const resetConfirmModal = el('div', 'modal-backdrop reset-confirm-backdrop hidden');
  const resetConfirmPanel = el('div', 'modal-panel reset-confirm-panel');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    resetConfirmPanel.appendChild(el('span', `gothic-card-clasp ${pos}`));
  }
  const resetConfirmTitle = el('h2', 'modal-title reset-confirm-title', 'СБРОСИТЬ СОХРАНЕНИЕ?');
  const resetConfirmDesc = el(
    'p',
    'modal-subtitle reset-confirm-desc',
    'Текущий прогресс в Замке Пепла и зажжённый костёр будут удалены. Начать заново можно в любой момент.'
  );
  const resetConfirmActions = el('div', 'reset-confirm-actions');
  const resetCancelBtn = el('button', 'result-btn btn-hub', 'Отмена');
  resetCancelBtn.type = 'button';
  const resetDoBtn = el('button', 'result-btn btn-confirm-reset', 'Сбросить');
  resetDoBtn.type = 'button';
  resetConfirmActions.append(resetCancelBtn, resetDoBtn);
  resetConfirmPanel.append(resetConfirmTitle, resetConfirmDesc, resetConfirmActions);
  resetConfirmModal.appendChild(resetConfirmPanel);
  root.appendChild(resetConfirmModal);

  function openResetConfirmModal() {
    closeSoundPopover();
    closeSettingsModal();
    resetConfirmModal.classList.remove('hidden');
  }
  function hideResetConfirmModal() {
    resetConfirmModal.classList.add('hidden');
  }

  resetSaveBtn.addEventListener('click', openResetConfirmModal);
  resetCancelBtn.addEventListener('click', hideResetConfirmModal);
  resetDoBtn.addEventListener('click', () => {
    hideResetConfirmModal();
    getCallbacks().onResetProgress?.();
  });
  resetConfirmModal.addEventListener('click', (e) => {
    if (e.target === resetConfirmModal) hideResetConfirmModal();
  });

  // =========================================================================
  // 4. IN-GAME PAUSE MODAL (Pure Castle of Ash)
  // =========================================================================
  const pauseModal = el('div', 'modal-backdrop pause-modal-backdrop hidden');
  const pausePanel = el('div', 'modal-panel pause-modal-panel');
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    pausePanel.appendChild(el('span', `gothic-card-clasp ${pos}`));
  }
  const pauseTitle = el('h2', 'modal-title pause-modal-title');
  pauseTitle.append(createModalIconSvg('pause_title', 'pause-title-svg'), el('span', '', 'ПАУЗА'));
  const pauseSub = el('p', 'modal-subtitle pause-modal-sub', 'Замок Пепла');
  const pauseActions = el('div', 'result-actions-col pause-actions-col');

  const pauseResumeBtn = el('button', 'result-btn btn-arsenal-primary');
  pauseResumeBtn.type = 'button';
  setModalButtonContent(pauseResumeBtn, 'play', 'Продолжить');

  const pauseRestartBtn = el('button', 'result-btn btn-retry');
  pauseRestartBtn.type = 'button';
  setModalButtonContent(pauseRestartBtn, 'retry', 'Возродиться у Костра');

  const pauseSettingsBtn = el('button', 'result-btn btn-hub');
  pauseSettingsBtn.type = 'button';
  pauseSettingsBtn.textContent = 'Настройки';

  const pauseExitBtn = el('button', 'result-btn btn-confirm-reset');
  pauseExitBtn.type = 'button';
  setModalButtonContent(pauseExitBtn, 'camp', 'В главное меню');

  pauseActions.append(pauseResumeBtn, pauseRestartBtn, pauseSettingsBtn, pauseExitBtn);
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
    closeSettingsModal();
    activePauseHandlers = handlers || {};
    const zoneTitle = info?.souls?.zoneTitleRu || '';
    pauseSub.textContent = zoneTitle ? `Замок Пепла • ${zoneTitle}` : 'Замок Пепла';
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
  pauseSettingsBtn.addEventListener('click', () => {
    openSettingsModal();
  });
  pauseExitBtn.addEventListener('click', () => {
    const fn = activePauseHandlers.onExit;
    hidePauseModal();
    fn?.();
  });

  function handleKeydown(e) {
    if (e.code !== 'Escape') return false;
    if (!soundPopover.classList.contains('hidden')) {
      closeSoundPopover();
      return true;
    }
    if (!resetConfirmModal.classList.contains('hidden')) {
      e.preventDefault();
      hideResetConfirmModal();
      return true;
    }
    if (!settingsModal.classList.contains('hidden')) {
      e.preventDefault();
      closeSettingsModal();
      return true;
    }
    return false;
  }

  function isStageBlockedByModal() {
    return !settingsModal.classList.contains('hidden') || !resetConfirmModal.classList.contains('hidden');
  }

  function isPauseModalOpen() {
    return !pauseModal.classList.contains('hidden');
  }

  function hideAllModals() {
    closeSoundPopover();
    closeSettingsModal();
    hidePauseModal();
    hideResetConfirmModal();
  }

  return {
    closeSoundPopover,
    toggleSoundPopover,
    syncMuteButtons,
    openSettingsModal,
    closeSettingsModal,
    isSettingsModalOpen,
    hideResetConfirmModal,
    showPauseModal,
    hidePauseModal,
    isPauseModalOpen,
    handleKeydown,
    isStageBlockedByModal,
    isRunModalOpen: () => false,
    hideAllModals
  };
}
