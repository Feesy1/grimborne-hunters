// Master game orchestrator — Pure Soulslike Edition («Охотники Мрака — Замок Пепла»).
// Wires Three.js World, Warrior & Castle of Ash 3D Models, Combat, Souls Save Store,
// Procedural/Sampled Spatial Audio, Gothic Title Screen & HUD.

import * as THREE from '../vendor/three.module.js';
import { SOULS_LEVEL_DEF } from './config.js?v=20261124z85';
import { createArenaWorld } from './world.js?v=20261124z85';
import * as models from './models.js?v=20261124z85';
import { createProgressionStore, mergeCloudState } from './progression.js?v=20261124z85';
import { createCombatController } from './combat.js?v=20261124z85';
import { createAudioEngine } from './audio.js?v=20261124z85';
import { initYandexSdk } from './yandexSdk.js?v=20261124z85';
import { createUIManager } from './ui.js?v=20261124z85';
import { createInputController } from './input.js?v=20261124z85';

const SOULS_LOCAL_SAVE_KEY = 'grimborne_souls_save_v1';

function readSoulsLocalSave() {
  try {
    const raw = localStorage.getItem(SOULS_LOCAL_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeSoulsLocalSave(data) {
  try {
    if (!data) {
      localStorage.removeItem(SOULS_LOCAL_SAVE_KEY);
    } else {
      localStorage.setItem(SOULS_LOCAL_SAVE_KEY, JSON.stringify(data));
    }
  } catch {}
}

async function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  const audio = createAudioEngine();

  let gameMode = 'hub'; // 'hub' | 'playing' | 'paused' | 'result'
  let externalPaused = false;
  let soulsBossCheckpointUnlocked = false;
  let soulsVictoryShownThisRun = false;
  let lowFpsStreak = 0;
  let thermalLowSpecApplied = false;
  let userLowSpecPref = false;
  let userShowFpsPref = true;
  try {
    const savedShowFps = localStorage.getItem('grimborne_show_fps');
    if (savedShowFps === '0') userShowFpsPref = false;
    else if (savedShowFps === '1') userShowFpsPref = true;
  } catch {}
  let lastNow = performance.now();
  let elapsedTime = 0;
  let fpsAccumTime = 0;
  let fpsFrameCount = 0;
  let smoothedFps = 60;
  let lastShownFps = -1;
  let hudSyncAccum = 0;

  let soulsSave = {
    hasRun: false,
    bonfireCheckpointLit: false,
    bossDefeated: false,
    difficultyMode: 'normal',
    lowSpec: false
  };

  function resetFrameLoopTiming() {
    lastNow = performance.now();
    fpsAccumTime = 0;
    fpsFrameCount = 0;
    lowFpsStreak = 0;
  }

  // Initialize local/platform SDK wrapper
  const sdk = await initYandexSdk({
    onPauseAudio: () => {
      externalPaused = true;
      audio.suspend();
    },
    onResumeAudio: () => {
      externalPaused = false;
      if (!audio.isMuted()) audio.resume();
    }
  });

  // Initialize progression store locked cleanly to Warrior (keeps compatibility with combat.js)
  const progression = createProgressionStore();
  const localSavedData = sdk.loadLocalData?.();
  if (localSavedData) progression.loadState(localSavedData);
  const cloudSavedData = await sdk.loadCloudData?.();
  if (cloudSavedData && typeof cloudSavedData === 'object' && Object.keys(cloudSavedData).length > 0) {
    progression.loadState(mergeCloudState(progression.getState(), cloudSavedData));
  }
  progression.selectClass?.('warrior');

  const storedSouls = readSoulsLocalSave();
  if (storedSouls) {
    soulsSave = {
      hasRun: Boolean(storedSouls.hasRun),
      bonfireCheckpointLit: Boolean(storedSouls.bonfireCheckpointLit),
      bossDefeated: Boolean(storedSouls.bossDefeated),
      difficultyMode: ['easy', 'normal', 'hard'].includes(storedSouls.difficultyMode)
        ? storedSouls.difficultyMode
        : (progression.getState().difficultyMode || 'normal'),
      lowSpec: Boolean(storedSouls.lowSpec)
    };
    userLowSpecPref = soulsSave.lowSpec;
    progression.setDifficultyMode?.(soulsSave.difficultyMode);
  } else {
    soulsSave.difficultyMode = progression.getState().difficultyMode || 'normal';
  }

  const getMenuSnapshot = () => ({
    difficultyMode: soulsSave.difficultyMode,
    lowSpec: userLowSpecPref,
    soulsSave: { ...soulsSave }
  });

  const persistSave = (immediate = false) => {
    writeSoulsLocalSave({
      ...soulsSave,
      lowSpec: userLowSpecPref
    });
    const st = progression.getState();
    sdk.saveData(st, immediate);
  };

  window.addEventListener('pagehide', () => persistSave(true));
  window.addEventListener('beforeunload', () => persistSave(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistSave(true);
  });

  // Initialize 3D Arena World
  const world = createArenaWorld(canvas);
  if (userLowSpecPref) {
    world.setLowSpecMode?.(true);
  }
  const handleViewportResize = () => world.resize();
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleViewportResize, 80);
    setTimeout(handleViewportResize, 280);
  });
  window.addEventListener('grimborne-viewport', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);
  handleViewportResize();

  const clearStaleExternalPause = () => {
    if (!document.hidden && externalPaused) {
      externalPaused = false;
      if (!audio.isMuted()) audio.resume();
    }
  };
  window.addEventListener('pointerdown', clearStaleExternalPause, { passive: true });
  window.addEventListener('touchstart', clearStaleExternalPause, { passive: true });
  window.addEventListener('focus', clearStaleExternalPause);

  // Preload ONLY Tier-1 Warrior + Castle of Ash assets
  await world.ready;
  const bootPriorityKeys = models.getBootModelKeys('warrior', 'club', SOULS_LEVEL_DEF);
  await models.preloadModels({
    priorityKeys: bootPriorityKeys,
    onProgress: (loaded, total) => {
      window.__setSplashAssetProgress?.(loaded, total);
    }
  });

  // 3D Warrior Title Screen Diorama + Smooth Turntable Drag
  let hubPreviewHero = null;
  let hubHeroRotY = 0.28; // Heroic 3/4 stance showcasing both Oath Broadsword & Skull Shield!
  let hubHeroTargetRotY = 0.28;
  let hubHeroRotVel = 0;
  let rmbRotatingHero = false;
  let lastRmbCoordX = 0;
  let touchRotatingHero = false;
  let activeHeroTouchId = null;
  let lastHeroTouchX = 0;
  let hubHeroGen = 0;

  function refreshHubDiorama() {
    if (hubPreviewHero?.root && hubPreviewHero.root.parent) {
      hubPreviewHero.root.parent.remove(hubPreviewHero.root);
    }
    hubPreviewHero?.dispose?.();
    hubPreviewHero = null;
    if (gameMode !== 'hub') return;

    const missing = models.getMissingHeroOrWeaponKeys('warrior', 'club');
    if (missing.length > 0) {
      const gen = ++hubHeroGen;
      models.ensureModelKeysLoaded(missing).then(() => {
        if (gen === hubHeroGen && gameMode === 'hub') refreshHubDiorama();
      });
    }

    hubPreviewHero = models.createHeroMesh('warrior', 'club', 'water');
    if (hubPreviewHero?.root) {
      hubPreviewHero.root.position.set(0, world.HUB_PEDESTAL_TOP_Y ?? 0, 0);
      hubPreviewHero.root.scale.setScalar(1.12);
      hubPreviewHero.root.rotation.y = hubHeroRotY;
      hubPreviewHero.root.visible = true;
      world.scene.add(hubPreviewHero.root);
    }
  }

  function clearHubDiorama() {
    if (hubPreviewHero?.root && hubPreviewHero.root.parent) {
      hubPreviewHero.root.parent.remove(hubPreviewHero.root);
    }
    hubPreviewHero?.dispose?.();
    hubPreviewHero = null;
  }

  // Helper: project 3D world position to 2D screen coordinates
  const projVec = new THREE.Vector3();
  function worldToScreen(wx, wz, wy = 1.55) {
    projVec.set(wx, wy, wz);
    projVec.project(world.camera);
    if (projVec.z > 1) return null;
    const vp = window.__getGameViewportSize?.();
    const w = vp?.w || window.innerWidth;
    const h = vp?.h || window.innerHeight;
    return {
      x: (projVec.x * 0.5 + 0.5) * w,
      y: (-projVec.y * 0.5 + 0.5) * h
    };
  }

  // Initialize Pure Gothic Souls UI Manager
  const ui = createUIManager({});
  ui.setLang(sdk.getLang());

  const handleRunEnd = ({ victory, soulsBossReached } = {}) => {
    if (gameMode === 'result') return;
    if (victory) {
      if (soulsVictoryShownThisRun) return;
      soulsVictoryShownThisRun = true;
      soulsBossCheckpointUnlocked = false;
      soulsSave.bossDefeated = true;
      persistSave(true);
      ui.showSoulsVictoryBanner?.({
        title: 'ВЕЛИКИЙ ВРАГ ПОВЕРЖЕН',
        subtitle: 'Судия Руин пал'
      });
      return;
    }

    gameMode = 'result';
    exitSoulsPointerLock();
    sdk.GameplayAPI.stop();
    if (soulsBossReached || combat.isSoulsBossAwakened?.()) {
      soulsBossCheckpointUnlocked = true;
    }
    const snap = combat.getHudSnapshot?.();
    if (snap?.souls?.bonfireCheckpointLit) {
      soulsSave.bonfireCheckpointLit = true;
    }
    persistSave(true);
    ui.showSoulsDefeatOverlay?.({
      canBossRematch: soulsBossCheckpointUnlocked,
      onBossRematch: async () => {
        ui.hideSoulsDefeatOverlay?.();
        await startSoulsRun({ startAtBossArena: true });
        requestSoulsPointerLock();
      },
      onBonfireRestart: async () => {
        ui.hideSoulsDefeatOverlay?.();
        await startSoulsRun({ restoreBonfireCheckpoint: soulsSave.bonfireCheckpointLit });
        requestSoulsPointerLock();
      },
      onHub: () => {
        ui.hideSoulsDefeatOverlay?.();
        enterHub();
      }
    });
    syncSoulsPointerLockHint();
  };

  // Initialize Combat Controller
  const combat = createCombatController({
    world,
    models,
    progression,
    audio,
    ui,
    worldToScreen,
    callbacks: {
      onLevelUpReady: () => {},
      onRunEnd: handleRunEnd,
      onBattleEnd: handleRunEnd,
      onToast: (msg) => ui.showToast(msg)
    }
  });
  if (userLowSpecPref) {
    combat.setLowSpecMode?.(true);
  }

  let activeMusicMode = null;
  const syncMusicMode = (mode) => {
    if (activeMusicMode === mode) return;
    activeMusicMode = mode;
    audio.setMusicMode?.(mode);
  };

  function isSoulsRunActive() {
    return gameMode === 'playing';
  }
  function isTouchOnlyDevice() {
    return (
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || (navigator?.maxTouchPoints || 0) > 0) &&
      !window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches
    );
  }
  function isSoulsPointerLocked() {
    return Boolean(document.pointerLockElement && document.pointerLockElement === canvas);
  }
  function requestSoulsPointerLock() {
    if (!isSoulsRunActive() || isTouchOnlyDevice() || isSoulsPointerLocked()) return;
    if (typeof canvas?.requestPointerLock !== 'function') return;
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {}
  }
  function exitSoulsPointerLock() {
    if (document.pointerLockElement && typeof document.exitPointerLock === 'function') {
      try { document.exitPointerLock(); } catch {}
    }
  }
  function syncSoulsPointerLockHint() {
    const showHint =
      isSoulsRunActive() &&
      !isTouchOnlyDevice() &&
      !isSoulsPointerLocked() &&
      !ui.isPauseModalOpen?.() &&
      !ui.isSoulsDefeatOpen?.();
    ui.setSoulsPointerLockHintVisible?.(showHint);
  }

  function toggleTargetLock() {
    if (gameMode !== 'playing') return false;
    const locked = combat.toggleTargetLock?.() ?? false;
    if (locked) audio.playPickup?.('crate');
    return locked;
  }
  function cycleTargetLock(dir = 1) {
    if (gameMode !== 'playing') return false;
    const ok = combat.cycleTargetLock?.(dir) ?? false;
    if (ok) audio.playPickup?.('crate');
    return ok;
  }

  const inputCtrl = createInputController({
    canvas,
    isPlaying: () => gameMode === 'playing',
    isHub: () => gameMode === 'hub',
    isPaused: () => gameMode === 'paused',
    isSoulsRunActive,
    isPointerLocked: isSoulsPointerLocked,
    requestPointerLock: requestSoulsPointerLock,
    exitPointerLock: exitSoulsPointerLock,
    isDevEditorEnabled: () => false,
    world,
    audio,
    callbacks: {
      onTogglePause: () => togglePauseGame(),
      onToggleTargetLock: () => toggleTargetLock(),
      onCycleTargetLock: (dir = 1) => cycleTargetLock(dir),
      onToggleTelegraphs: () => {},
      onToggleAutoAimHotkey: () => {},
      onToggleAttackHotkey: () => {},
      onManualReload: () => {},
      onWindowBlur: () => {
        rmbRotatingHero = false;
        touchRotatingHero = false;
        activeHeroTouchId = null;
        document.body.classList.remove('is-rotating-hero');
      }
    }
  });

  document.addEventListener('pointerlockchange', () => {
    if (!isSoulsPointerLocked()) inputCtrl.clearBlockingFlags();
    syncSoulsPointerLockHint();
  });

  function enterHub() {
    exitSoulsPointerLock();
    inputCtrl.resetCombatInputs();
    soulsBossCheckpointUnlocked = false;
    soulsVictoryShownThisRun = false;
    combat.setFreeRoam?.(false);
    combat.disposeRun();
    world.setBossAtmosphere(false);
    world.setCameraMode?.('hub');
    syncMusicMode('hub');
    gameMode = 'hub';
    sdk.GameplayAPI.stop();
    ui.hideAllModals();
    ui.showHud(false);
    ui.renderHub(getMenuSnapshot());
    ui.showHub(true);
    hubHeroRotY = 0.28;
    hubHeroTargetRotY = 0.28;
    hubHeroRotVel = 0;
    refreshHubDiorama();
  }

  function togglePauseGame() {
    if (gameMode === 'playing') {
      gameMode = 'paused';
      exitSoulsPointerLock();
      inputCtrl.resetAllInputs();
      syncMusicMode('hub');
      sdk.GameplayAPI.stop();
      const snap = combat.getHudSnapshot?.() || {};
      ui.showPauseModal?.(snap, {
        onResume: () => {
          if (gameMode === 'paused') {
            gameMode = 'playing';
            syncMusicMode(combat.getHudSnapshot?.()?.souls?.bossAwakened ? 'boss' : 'combat');
            sdk.GameplayAPI.start();
            requestSoulsPointerLock();
            syncSoulsPointerLockHint();
          }
        },
        onRestart: async () => {
          persistSave();
          await startSoulsRun({ restoreBonfireCheckpoint: soulsSave.bonfireCheckpointLit });
          requestSoulsPointerLock();
        },
        onExit: () => {
          persistSave(true);
          enterHub();
        }
      });
      syncSoulsPointerLockHint();
    } else if (gameMode === 'paused') {
      if (ui.isSettingsModalOpen?.()) {
        ui.closeSettingsModal?.();
        return;
      }
      ui.hidePauseModal?.();
      gameMode = 'playing';
      syncMusicMode(combat.getHudSnapshot?.()?.souls?.bossAwakened ? 'boss' : 'combat');
      sdk.GameplayAPI.start();
      syncSoulsPointerLockHint();
    }
  }

  let battleLaunchLock = false;
  async function startSoulsRun({
    startAtBossArena = false,
    resetCheckpoint = false,
    restoreBonfireCheckpoint = false
  } = {}) {
    if (battleLaunchLock) return;
    audio.unlock();
    audio?.preloadSoulsAudio?.();

    const missingKeys = models.getMissingStageModelKeys('warrior', 'club', SOULS_LEVEL_DEF);
    if (missingKeys.length > 0) {
      battleLaunchLock = true;
      ui.showToast('Загрузка Замка Пепла…');
      try {
        await models.ensureModelKeysLoaded(missingKeys);
      } finally {
        battleLaunchLock = false;
      }
    }

    soulsVictoryShownThisRun = false;
    if (resetCheckpoint) {
      soulsBossCheckpointUnlocked = false;
      soulsSave.bonfireCheckpointLit = false;
      soulsSave.bossDefeated = false;
    } else if (!startAtBossArena) {
      soulsBossCheckpointUnlocked = false;
    }
    soulsSave.hasRun = true;
    persistSave();

    inputCtrl.resetCombatInputs();
    clearHubDiorama();
    world.setArenaBiome?.('souls_citadel', 26);
    world.setCameraMode?.('combat');
    ui.hideAllModals();
    ui.showHub(false);
    ui.showHud(true);
    combat.setAttackEnabled?.(false);
    world.setCameraLock?.(false);
    syncMusicMode('combat');

    combat.startRun({
      classId: 'warrior',
      levelNumber: 26,
      difficultyMode: soulsSave.difficultyMode || 'normal',
      startAtBossArena,
      resetCheckpoint,
      restoreBonfireCheckpoint
    });
    audio?.preloadSoulsAudio?.();
    world.prewarmSoulsShaders?.();
    ui.updateHud(combat.getHudSnapshot());
    resetFrameLoopTiming();
    gameMode = 'playing';
    syncSoulsPointerLockHint();
    sdk.GameplayAPI.start();
  }

  // Wire Pure Gothic Souls UI callbacks
  ui.setCallbacks({
    onContinueGame: async () => {
      await startSoulsRun({
        restoreBonfireCheckpoint: Boolean(soulsSave.bonfireCheckpointLit)
      });
      requestSoulsPointerLock();
    },
    onNewGame: async () => {
      await startSoulsRun({ resetCheckpoint: true });
      requestSoulsPointerLock();
    },
    onSetDifficulty: (mode) => {
      audio.unlock();
      soulsSave.difficultyMode = ['easy', 'normal', 'hard'].includes(mode) ? mode : 'normal';
      progression.setDifficultyMode?.(soulsSave.difficultyMode);
      persistSave(true);
      ui.renderHub(getMenuSnapshot());
    },
    onSetLowSpec: (isLow) => {
      userLowSpecPref = Boolean(isLow);
      soulsSave.lowSpec = userLowSpecPref;
      world.setLowSpecMode?.(userLowSpecPref);
      combat.setLowSpecMode?.(userLowSpecPref);
      ui.setLowSpecState?.(userLowSpecPref);
      persistSave(true);
    },
    onSetShowFps: (show) => {
      userShowFpsPref = Boolean(show);
      try {
        localStorage.setItem('grimborne_show_fps', userShowFpsPref ? '1' : '0');
      } catch {}
      ui.setShowFpsState?.(userShowFpsPref);
      syncFpsBadgeVisibility();
    },
    onResetProgress: async () => {
      audio.unlock();
      combat.disposeRun();
      soulsBossCheckpointUnlocked = false;
      soulsSave = {
        hasRun: false,
        bonfireCheckpointLit: false,
        bossDefeated: false,
        difficultyMode: 'normal',
        lowSpec: userLowSpecPref
      };
      progression.resetAllProgress?.();
      progression.selectClass?.('warrior');
      writeSoulsLocalSave(null);
      await sdk.clearData?.(progression.getState());
      enterHub();
      ui.showToast('Сохранение сброшено');
    },
    onToggleTargetLock: () => toggleTargetLock(),
    onCycleTargetLock: (dir = 1) => cycleTargetLock(dir),
    onMobileLockTap: () => {
      if (gameMode !== 'playing') return false;
      return combat.handleMobileSmartLockTap?.() ?? toggleTargetLock();
    },
    onToggleMobileAutoFlask: () => {
      audio.unlock();
      const next = combat.toggleMobileAutoFlask?.() ?? true;
      ui.showToast(next ? 'Автохил флягой: ВКЛ' : 'Автохил флягой: ВЫКЛ');
      ui.updateHud(combat.getHudSnapshot());
      return next;
    },
    onToggleMobileSmartLock: () => {
      audio.unlock();
      const next = combat.toggleMobileSmartLock?.() ?? true;
      ui.showToast(next ? 'Умный автозахват цели: ВКЛ' : 'Умный автозахват цели: ВЫКЛ');
      ui.updateHud(combat.getHudSnapshot());
      return next;
    },
    onToggleMute: (nextBool) => {
      const muted = typeof nextBool === 'boolean' ? nextBool : !audio.isMuted();
      audio.setMuted(muted);
      ui.setMutedState?.(muted);
    },
    onVolumeChange: (vol) => {
      audio.unlock();
      const v = audio.setSfxVolume ? audio.setSfxVolume(vol) : audio.setVolume(vol);
      ui.setVolumeState?.(v);
      ui.setMutedState?.(audio.isMuted());
    },
    onMusicVolumeChange: (vol) => {
      audio.unlock();
      const mv = audio.setMusicVolume ? audio.setMusicVolume(vol) : vol;
      ui.setMusicVolumeState?.(mv);
      ui.setMutedState?.(audio.isMuted());
    },
    onVoiceVolumeChange: (vol) => {
      audio.unlock();
      const vv = audio.setVoiceVolume ? audio.setVoiceVolume(vol) : vol;
      ui.setVoiceVolumeState?.(vv);
      ui.setMutedState?.(audio.isMuted());
    },
    onTogglePause: () => togglePauseGame(),
    onSoulsInteract: () => {
      if (gameMode === 'playing') {
        audio.unlock();
        inputCtrl.requestInteract();
      }
    },
    onSkipBossDoorCutscene: () => {
      if (gameMode === 'playing') combat.skipBossDoorCutscene?.();
    }
  });

  // === Title Screen 3D Warrior Knight Gentle Turntable Drag ===
  window.addEventListener('pointerdown', (e) => {
    if (gameMode !== 'hub' || !hubPreviewHero?.root) return;
    if (ui.isHeroStageVisible && !ui.isHeroStageVisible()) return;
    const mapped = window.__toGameCoords ? window.__toGameCoords(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };

    if (e.pointerType !== 'touch' && (e.button === 0 || e.button === 2)) {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, input, a, .souls-title-col, .modal-backdrop, .sound-popover')) {
        return;
      }
      e.preventDefault();
      audio.unlock();
      rmbRotatingHero = true;
      lastRmbCoordX = mapped.x;
      hubHeroRotVel = 0;
      document.body.classList.add('is-rotating-hero');
      return;
    }

    if (e.pointerType === 'touch' && !touchRotatingHero) {
      if (e.target && typeof e.target.closest === 'function' && e.target.closest('button, input, a, .souls-title-col, .modal-backdrop, .sound-popover')) {
        return;
      }
      touchRotatingHero = true;
      activeHeroTouchId = e.pointerId;
      lastHeroTouchX = mapped.x;
      hubHeroRotVel = 0;
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (gameMode !== 'hub') return;
    if (!rmbRotatingHero && !(touchRotatingHero && e.pointerId === activeHeroTouchId)) return;
    const mapped = window.__toGameCoords ? window.__toGameCoords(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };

    if (rmbRotatingHero && e.pointerType !== 'touch') {
      if (typeof e.buttons === 'number' && (e.buttons & 3) === 0) {
        rmbRotatingHero = false;
        document.body.classList.remove('is-rotating-hero');
        return;
      }
      const dx = mapped.x - lastRmbCoordX;
      lastRmbCoordX = mapped.x;
      const dAngle = dx * 0.0125;
      hubHeroTargetRotY += dAngle;
      hubHeroRotVel = Math.max(-10, Math.min(10, dAngle * 42));
    } else if (touchRotatingHero && e.pointerId === activeHeroTouchId) {
      const dx = mapped.x - lastHeroTouchX;
      lastHeroTouchX = mapped.x;
      const dAngle = dx * 0.0125;
      hubHeroTargetRotY += dAngle;
      hubHeroRotVel = Math.max(-10, Math.min(10, dAngle * 42));
    }
  });

  const endHeroRotationDrag = (e) => {
    if (e && e.pointerType !== 'touch' && (e.button === 0 || e.button === 2 || e.type === 'pointercancel')) {
      rmbRotatingHero = false;
      document.body.classList.remove('is-rotating-hero');
    }
    if (e && touchRotatingHero && e.pointerId === activeHeroTouchId) {
      touchRotatingHero = false;
      activeHeroTouchId = null;
    }
  };
  window.addEventListener('pointerup', endHeroRotationDrag);
  window.addEventListener('pointercancel', endHeroRotationDrag);

  function gatherInput(dt) {
    return inputCtrl.gatherFrameInput({
      dt,
      touch: ui.getTouchInput(),
      combat,
      ui
    });
  }

  // Initial state & boot directly into Pure Gothic Title Screen
  ui.setVolumeState?.(audio.getSfxVolume ? audio.getSfxVolume() : audio.getVolume());
  ui.setMusicVolumeState?.(audio.getMusicVolume ? audio.getMusicVolume() : 0.38);
  ui.setVoiceVolumeState?.(audio.getVoiceVolume ? audio.getVoiceVolume() : 1.0);
  ui.setMutedState?.(audio.isMuted());
  ui.setLowSpecState?.(userLowSpecPref);
  ui.setShowFpsState?.(userShowFpsPref);
  world.setTelegraphsVisible?.(false);
  enterHub();
  world.followTarget(0, 0, 0.016);
  world.update(0.016, 0);
  world.render();
  window.__notifyEngineReady?.();
  sdk.markGameReady();

  // QA & debug bridge (100% compatible with existing QA harness)
  window.__grimborne = {
    progression,
    combat,
    world,
    ui,
    audio,
    enterHub,
    startSoulsLevel: () => startSoulsRun({ resetCheckpoint: false }),
    startSoulsBossRematch: () => startSoulsRun({ startAtBossArena: true }),
    toggleTargetLock,
    cycleTargetLock,
    getLockedTarget: () => combat.getLockedTarget?.() || null,
    requestSoulsPointerLock,
    exitSoulsPointerLock,
    isSoulsPointerLocked,
    triggerSoulsInteract: () => inputCtrl.requestInteract(),
    getInputSource: () => inputCtrl.getInputSource(),
    setInputSource: (src) => inputCtrl.setInputSource(src),
    getHeroRotationY: () => hubHeroRotY,
    setHeroRotationY: (rad) => {
      hubHeroRotY = Number(rad) || 0;
      hubHeroTargetRotY = hubHeroRotY;
      hubHeroRotVel = 0;
      if (hubPreviewHero?.root) hubPreviewHero.root.rotation.y = hubHeroRotY;
    }
  };

  // Optional one-shot direct launch (?souls=1 / ?level=26) for testing
  try {
    const params = new URLSearchParams(window.location.search);
    const soulsRaw = params.get('souls');
    const directLvl = Number(params.get('level') || 0);
    const hubOnly = params.get('hub') === '1';
    const navType = performance.getEntriesByType?.('navigation')?.[0]?.type;

    const oneShotKeys = ['souls', 'level', 'hub', 'class'];
    let hadOneShotParam = false;
    for (const k of oneShotKeys) {
      if (params.has(k)) {
        params.delete(k);
        hadOneShotParam = true;
      }
    }
    if (hadOneShotParam && typeof window.history?.replaceState === 'function') {
      const cleanQuery = params.toString();
      const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
      window.history.replaceState(null, '', cleanUrl);
    }

    if ((soulsRaw === '1' || soulsRaw === 'true' || directLvl === 26) && !hubOnly && navType !== 'reload') {
      void startSoulsRun({ resetCheckpoint: true });
    }
  } catch {}

  // === Smooth Hardware-Synced Render Loop (supports 60/144/240/540Hz natively with ZERO input lag!)
  //     + Exact Per-Frame Engine Work Timer showing true Uncapped Potential FPS (e.g. 600-1200+ FPS)! ===
  const forceFpsFromUrl =
    typeof window !== 'undefined' &&
    /(?:^|[?&])(fps=1|debug=1)(?:&|$)/i.test(window.location?.search || '');
  const fpsBadgeEl = document.getElementById('fps-badge');
  function syncFpsBadgeVisibility() {
    const visible = Boolean(userShowFpsPref || forceFpsFromUrl);
    if (fpsBadgeEl) {
      fpsBadgeEl.classList.toggle('hidden', !visible);
      fpsBadgeEl.classList.toggle('is-dev-visible', visible);
    }
  }
  syncFpsBadgeVisibility();

  const FPS_BADGE_UPDATE_INTERVAL_SEC = 0.35;
  let workAccumMs = 0;
  let smoothedMaxFps = 600;
  let lastShownBadgeText = '';
  resetFrameLoopTiming();

  function frame(now) {
    requestAnimationFrame(frame);
    const frameWorkStart = performance.now();
    const rawDeltaSec = (now - lastNow) / 1000;
    lastNow = now;

    const MAX_SIM_STEP = 1 / 60;
    const dt = Math.min(0.05, Math.max(0.0002, rawDeltaSec));

    if (externalPaused) {
      if (gameMode === 'hub') world.render();
      return;
    }

    if (gameMode === 'playing') {
      const subSteps = dt <= 0.025 ? 1 : Math.max(1, Math.min(2, Math.ceil(dt / MAX_SIM_STEP)));
      const stepDt = dt / subSteps;
      const frameInput = gatherInput(dt);
      const urgentHudSync = Boolean(
        frameInput.dash ||
        frameInput.heavyTrigger ||
        frameInput.flask ||
        frameInput.interact
      );
      let stepsExecuted = 0;
      for (let s = 0; s < subSteps; s++) {
        if (gameMode !== 'playing') break;
        elapsedTime += stepDt;
        combat.update(stepDt, frameInput, elapsedTime);
        stepsExecuted += 1;
        if (s === 0 && subSteps > 1) inputCtrl.clearSubStepEdgeTriggers(frameInput);
      }
      if (stepsExecuted > 0) {
        world.update(Math.min(dt, stepDt * stepsExecuted), elapsedTime);
      }
      hudSyncAccum = (hudSyncAccum || 0) + dt;
      if (hudSyncAccum >= 0.05 || urgentHudSync) {
        hudSyncAccum = 0;
        const snap = combat.getHudSnapshot();
        ui.updateHud(snap);
        ui.setSoulsInteractPrompt?.(
          Boolean(snap?.souls?.canOpenBossDoors || snap?.souls?.canInteract),
          snap?.souls?.interactLabel || 'Открыть врата'
        );
        // Auto-persist Bonfire checkpoint as soon as player lights/rests at it!
        if (snap?.souls?.bonfireCheckpointLit && !soulsSave.bonfireCheckpointLit) {
          soulsSave.bonfireCheckpointLit = true;
          persistSave(true);
        }
        const wantBossMusic = Boolean(
          snap?.souls?.bossAwakened && !snap?.souls?.bossDefeated && !snap?.souls?.doorCutsceneActive
        );
        syncMusicMode(wantBossMusic ? 'boss' : 'combat');
      }
    } else if (gameMode === 'hub') {
      elapsedTime += dt;
      world.followTarget(0, 0, dt);
      if (!rmbRotatingHero && !touchRotatingHero && Math.abs(hubHeroRotVel) > 0.001) {
        hubHeroTargetRotY += hubHeroRotVel * dt;
        hubHeroRotVel *= Math.exp(-9.5 * dt);
        if (Math.abs(hubHeroRotVel) < 0.005) hubHeroRotVel = 0;
      }
      const rotLerp = 1 - Math.exp(-22 * dt);
      hubHeroRotY += (hubHeroTargetRotY - hubHeroRotY) * rotLerp;

      if (hubPreviewHero?.root && hubPreviewHero.root.visible) {
        hubPreviewHero.root.rotation.y = hubHeroRotY;
        hubPreviewHero.update?.(dt, false, 1, elapsedTime);
      }
      world.update(dt, elapsedTime);
    } else {
      elapsedTime += dt;
      world.update(dt * 0.25, elapsedTime);
    }

    world.render();

    const frameWorkMs = Math.max(0.15, performance.now() - frameWorkStart);
    if (rawDeltaSec > 0 && rawDeltaSec < 0.5) {
      fpsAccumTime += rawDeltaSec;
      workAccumMs += frameWorkMs;
      fpsFrameCount += 1;
      if (fpsAccumTime >= FPS_BADGE_UPDATE_INTERVAL_SEC) {
        const instFps = fpsFrameCount / fpsAccumTime;
        const avgWorkMs = workAccumMs / fpsFrameCount;
        const instMaxFps = Math.min(2400, 1000 / Math.max(0.25, avgWorkMs));
        smoothedFps = smoothedFps * 0.30 + instFps * 0.70;
        smoothedMaxFps = smoothedMaxFps * 0.35 + instMaxFps * 0.65;
        if (fpsBadgeEl && (userShowFpsPref || forceFpsFromUrl)) {
          const shownFps = Math.max(1, Math.round(smoothedFps));
          const shownMax = Math.max(shownFps, Math.round(smoothedMaxFps / 5) * 5);
          const nextTxt = `${shownFps} FPS • ~${shownMax} MAX`;
          if (nextTxt !== lastShownBadgeText) {
            lastShownBadgeText = nextTxt;
            fpsBadgeEl.textContent = nextTxt;
          }
        }
        if (gameMode === 'playing' && !externalPaused && !thermalLowSpecApplied && !userLowSpecPref) {
          const lowFpsThreshold = isTouchOnlyDevice() ? 34 : 28;
          if (instFps < lowFpsThreshold) {
            lowFpsStreak += 1;
            if (lowFpsStreak >= 10) {
              thermalLowSpecApplied = true;
              world.setLowSpecMode?.(true);
              combat.setLowSpecMode?.(true);
            }
          } else {
            lowFpsStreak = Math.max(0, lowFpsStreak - 1);
          }
        }
        fpsAccumTime = 0;
        workAccumMs = 0;
        fpsFrameCount = 0;
      }
    }
  }

  requestAnimationFrame(frame);
}

bootstrap().catch((err) => {
  console.error('Grimborne bootstrap error:', err);
});
