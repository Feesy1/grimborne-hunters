// Master game orchestrator: wires Three.js World, 3D Chibi Models, 3-Class Combat,
// Arsenal Progression, Procedural Web Audio, Gothic UI, and Yandex Games SDK v2.

import * as THREE from '../vendor/three.module.js';
import { LEVELS, SOULS_LEVEL_DEF, getLevelDef, MAGE_ELEMENTS, WEAPONS } from './config.js?v=20261123z71';
import { createArenaWorld } from './world.js?v=20261123z71';
import * as models from './models.js?v=20261123z71';
import { createProgressionStore, mergeCloudState } from './progression.js?v=20261123z71';
import { createCombatController } from './combat.js?v=20261123z71';
import { createAudioEngine } from './audio.js?v=20261123z71';
import { initYandexSdk } from './yandexSdk.js?v=20261123z71';
import { createUIManager } from './ui.js?v=20261123z71';
import { createInputController } from './input.js?v=20261123z71';
import { attachSeamlessLoop } from './ambientVideo.js?v=20261123z71';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  const audio = createAudioEngine();

  let gameMode = 'hub'; // 'hub' | 'playing' | 'levelup' | 'result'
  let externalPaused = false;
  let activeRunLevel = 1;
  let activeRunEndless = false;
  let soulsBossCheckpointUnlocked = false;
  let soulsVictoryShownThisRun = false;
  let usedReviveThisRun = false;
  let usedDoubleGoldThisRun = false;
  let lowFpsStreak = 0;
  let thermalLowSpecApplied = false;
  let lastNow = performance.now();
  let elapsedTime = 0;
  let fpsAccumTime = 0;
  let fpsFrameCount = 0;
  let smoothedFps = 60;
  let lastShownFps = -1;
  let hudSyncAccum = 0;
  let autoSaveAccum = 0;

  function resetFrameLoopTiming() {
    lastNow = performance.now();
    fpsAccumTime = 0;
    fpsFrameCount = 0;
    lowFpsStreak = 0;
  }

  // Initialize Yandex Games SDK v2 (with instant local fallback)
  const sdk = await initYandexSdk({
    onPauseAudio: () => {
      externalPaused = true;
      audio.suspend();
    },
    onResumeAudio: () => {
      externalPaused = false;
      if (!audio.isMuted()) {
        audio.resume();
      }
    }
  });

  // Load local progression immediately, then non-destructively merge Yandex Cloud save
  const progression = createProgressionStore();
  const localSavedData = sdk.loadLocalData?.();
  if (localSavedData) {
    progression.loadState(localSavedData);
  }
  const cloudSavedData = await sdk.loadCloudData?.();
  if (cloudSavedData && typeof cloudSavedData === 'object' && Object.keys(cloudSavedData).length > 0) {
    const mergedState = mergeCloudState(progression.getState(), cloudSavedData);
    progression.loadState(mergedState);
    sdk.saveData(progression.getState(), false);
  } else if (localSavedData) {
    sdk.saveCloudData?.(progression.getState(), false);
  } else {
    const legacyLoaded = await sdk.loadData(progression.getState());
    if (legacyLoaded) progression.loadState(legacyLoaded);
  }
  progression.ensureDailyQuests?.();
  activeRunLevel = Math.min(LEVELS.length, Math.max(1, progression.getState().maxUnlockedLevel || 1));

  let lastSavedGold = progression.getState().gold;
  const persistSave = (immediate = false) => {
    const st = progression.getState();
    lastSavedGold = st.gold;
    sdk.saveData(st, immediate);
  };

  // Guaranteed mobile persistence on iPhone Safari / Android tab switch or close.
  // These events can kill the page before a 250 ms debounce fires, so flush at once.
  window.addEventListener('pagehide', () => persistSave(true));
  window.addEventListener('beforeunload', () => persistSave(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistSave(true);
    }
  });

  // Initialize 3D Arena World & preload authentic KayKit GLB characters + 3D environment props
  const world = createArenaWorld(canvas);
  const handleViewportResize = () => world.resize();
  window.addEventListener('resize', handleViewportResize);
  window.addEventListener('orientationchange', () => {
    setTimeout(handleViewportResize, 80);
    setTimeout(handleViewportResize, 280);
  });
  window.addEventListener('grimborne-viewport', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);
  handleViewportResize();

  // Safety recovery on iOS Safari / mobile WebViews: any touch or focus clears stale pause if tab is visible
  const clearStaleExternalPause = () => {
    if (!document.hidden && externalPaused) {
      externalPaused = false;
      if (!audio.isMuted()) {
        audio.resume();
      }
    }
  };
  window.addEventListener('pointerdown', clearStaleExternalPause, { passive: true });
  window.addEventListener('touchstart', clearStaleExternalPause, { passive: true });
  window.addEventListener('focus', clearStaleExternalPause);

  // Load tiny arena props & floor/sky textures FIRST (~1MB), then load ONLY the Tier-1 active hero/weapon/stage GLBs
  // before opening Hub so iPhone & mobile browsers boot in a few seconds instead of blocking on 290MB!
  await world.ready;
  const bootState = progression.getState();
  const bootClass = bootState.selectedClass || 'warrior';
  const bootWpn = progression.getEquippedWeaponId(bootClass);
  const bootLevelDef = getLevelDef(activeRunLevel || 1);
  const bootPriorityKeys = models.getBootModelKeys(bootClass, bootWpn, bootLevelDef);
  await models.preloadModels({
    priorityKeys: bootPriorityKeys,
    onProgress: (loaded, total) => {
      window.__setSplashAssetProgress?.(loaded, total);
    }
  });

  // 3D Hero & 3D Arsenal Weapon Preview in Hub Diorama + Interactive Right-Mouse-Button 360° Turntable
  const hubBgPlateEl = document.getElementById('hub-bg-plate');
  if (hubBgPlateEl) {
    hubBgPlateEl.style.transform = 'translate3d(0, 0, 0) scale(1.03)';
  }
  const hubBgVideoEl = document.getElementById('hub-bg-video');
  const hubBgVideoLoop = attachSeamlessLoop(hubBgVideoEl, { fadeSec: 1.2 });
  if (hubBgVideoEl) {
    hubBgVideoEl.muted = true;
    hubBgVideoLoop?.play();
    document.addEventListener('pointerdown', () => {
      const activeVideo = hubBgVideoLoop?.active || hubBgVideoEl;
      if (gameMode === 'hub' && activeVideo?.paused) {
        hubBgVideoLoop?.play();
      }
    }, { passive: true });
  }
  let hubPreviewHero = null;
  let hubArsenalWeapon = null;
  let currentHubTab = 'home';
  let previewedArsenalWeaponId = null;
  let previewedArsenalLocked = false;
  let hubHeroRotY = 0;
  let hubHeroTargetRotY = 0;
  let hubHeroRotVel = 0;
  let rmbRotatingHero = false;
  let lastRmbCoordX = 0;
  let touchRotatingHero = false;
  let activeHeroTouchId = null;
  let lastHeroTouchX = 0;

  // Separate generation counters: hero and weapon loads must not invalidate
  // each other (they used to share one counter, so the hero silently stayed
  // a placeholder whenever the Arsenal showcase was opened at the same time).
  let hubHeroGen = 0;
  let hubWeaponGen = 0;
  function refreshArsenalWeaponDiorama(explicitWeaponId = null, isLocked = false) {
    if (hubArsenalWeapon?.root && hubArsenalWeapon.root.parent) {
      hubArsenalWeapon.root.parent.remove(hubArsenalWeapon.root);
    }
    hubArsenalWeapon?.dispose?.();
    hubArsenalWeapon = null;
    const isShowcaseTab = currentHubTab === 'arsenal' || currentHubTab === 'store';
    if (gameMode !== 'hub' || !isShowcaseTab) return;
    if (explicitWeaponId === '__NONE__') {
      previewedArsenalWeaponId = null;
      return;
    }

    const st = progression.getState();
    const classId = st.selectedClass || 'warrior';
    const wId = explicitWeaponId || previewedArsenalWeaponId || progression.getEquippedWeaponId(classId);
    previewedArsenalWeaponId = wId;
    previewedArsenalLocked = Boolean(isLocked);
    const mageElem = st.activeMageElement || 'water';

    const missing = models.getMissingHeroOrWeaponKeys(null, wId);
    if (missing.length > 0) {
      const gen = ++hubWeaponGen;
      models.ensureModelKeysLoaded(missing).then(() => {
        if (gen === hubWeaponGen && gameMode === 'hub' && (currentHubTab === 'arsenal' || currentHubTab === 'store')) {
          refreshArsenalWeaponDiorama(wId, previewedArsenalLocked);
        }
      });
    }

    hubArsenalWeapon = models.createArsenalShowcaseWeapon(wId, mageElem, previewedArsenalLocked);
    if (hubArsenalWeapon?.root) {
      hubArsenalWeapon.root.rotation.y = hubHeroRotY;
      world.scene.add(hubArsenalWeapon.root);
    }
  }

  function refreshHubDiorama() {
    if (hubPreviewHero?.root && hubPreviewHero.root.parent) {
      hubPreviewHero.root.parent.remove(hubPreviewHero.root);
    }
    hubPreviewHero?.dispose?.();
    hubPreviewHero = null;
    if (gameMode !== 'hub') return;

    const st = progression.getState();
    const classId = st.selectedClass || 'warrior';
    const weaponId = progression.getEquippedWeaponId(classId);
    const mageElem = st.activeMageElement || 'water';

    const missing = models.getMissingHeroOrWeaponKeys(classId, weaponId);
    if (missing.length > 0) {
      const gen = ++hubHeroGen;
      models.ensureModelKeysLoaded(missing).then(() => {
        if (gen === hubHeroGen && gameMode === 'hub') {
          refreshHubDiorama();
        }
      });
    }

    hubPreviewHero = models.createHeroMesh(classId, weaponId, mageElem);
    if (hubPreviewHero?.root) {
      hubPreviewHero.root.position.set(0, world.HUB_PEDESTAL_TOP_Y ?? 0, 0);
      hubPreviewHero.root.scale.setScalar(1.10);
      hubPreviewHero.root.rotation.y = hubHeroRotY;
      const isShowcaseTab = currentHubTab === 'arsenal' || currentHubTab === 'store';
      hubPreviewHero.root.visible = !isShowcaseTab;
      world.scene.add(hubPreviewHero.root);
    }
    if (currentHubTab === 'arsenal' || currentHubTab === 'store') {
      refreshArsenalWeaponDiorama(previewedArsenalWeaponId, previewedArsenalLocked);
    }
  }

  function clearHubDiorama() {
    if (hubPreviewHero?.root && hubPreviewHero.root.parent) {
      hubPreviewHero.root.parent.remove(hubPreviewHero.root);
    }
    hubPreviewHero?.dispose?.();
    hubPreviewHero = null;
    if (hubArsenalWeapon?.root && hubArsenalWeapon.root.parent) {
      hubArsenalWeapon.root.parent.remove(hubArsenalWeapon.root);
    }
    hubArsenalWeapon?.dispose?.();
    hubArsenalWeapon = null;
  }

  // Helper: project 3D world position to 2D screen coordinates for floating damage/block numbers
  const projVec = new THREE.Vector3();
  function worldToScreen(wx, wz, wy = 1.55) {
    projVec.set(wx, wy, wz);
    projVec.project(world.camera);
    if (projVec.z > 1) return null;
    const vp = window.__getGameViewportSize?.();
    const w = vp?.w || window.innerWidth;
    const h = vp?.h || window.innerHeight;
    const x = (projVec.x * 0.5 + 0.5) * w;
    const y = (-projVec.y * 0.5 + 0.5) * h;
    return { x, y };
  }

  // Initialize Gothic UI Manager
  const ui = createUIManager({});
  ui.setLang(sdk.getLang());

  // In-run Soul Blessings removed per design focus (Hero Level Talent Points + Arsenal Weapons).
  const handleLevelUpReady = () => {};

  const handleRunEnd = ({
    victory,
    level,
    goldEarned,
    kills,
    unlockedWeapon,
    hpRatio,
    elapsedSec,
    elapsedTime,
    stars,
    starDetails,
    difficulty,
    isEndless,
    endlessWave,
    soulsBossReached
  } = {}) => {
    if (gameMode === 'result') return;
    const endlessRun = Boolean(isEndless || activeRunEndless);
    const isSoulsChapter = !endlessRun && Number(level) === 26;

    // Standalone "Abandoned Knight Rift" mode: no PvE result modal, no gold/stars/ads.
    if (isSoulsChapter) {
      if (victory) {
        if (soulsVictoryShownThisRun) return;
        soulsVictoryShownThisRun = true;
        soulsBossCheckpointUnlocked = false;
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
      persistSave(true);
      ui.showSoulsDefeatOverlay?.({
        canBossRematch: soulsBossCheckpointUnlocked,
        onBossRematch: async () => {
          ui.hideSoulsDefeatOverlay?.();
          await startBattle(progression.getState().selectedClass, 26, { startAtBossArena: true });
          requestSoulsPointerLock();
        },
        onBonfireRestart: async () => {
          ui.hideSoulsDefeatOverlay?.();
          await startBattle(progression.getState().selectedClass, 26);
          requestSoulsPointerLock();
        },
        onHub: () => {
          ui.hideSoulsDefeatOverlay?.();
          enterHub('home');
        }
      });
      syncSoulsPointerLockHint();
      return;
    }

    gameMode = 'result';
    sdk.GameplayAPI.stop();
    const runSec = Math.max(0, Math.round(Number(elapsedSec ?? elapsedTime ?? 0)));
    if (endlessRun) {
      const endlessScore = Math.max(0, Math.floor(Number(kills) || 0));
      progression.recordEndlessRun?.(endlessScore, runSec);
      if (typeof sdk.setLeaderboardScore === 'function') {
        sdk.setLeaderboardScore('endless_kills', endlessScore);
      } else if (endlessScore > 0 && typeof sdk.ysdk?.getLeaderboards === 'function') {
        sdk.ysdk
          .getLeaderboards()
          .then((lb) => lb?.setLeaderboardScore?.('endless_kills', endlessScore))
          .catch(() => {});
      }
    } else if (victory) {
      if (Number(level) < 26) {
        progression.unlockNextLevel(level);
        if (typeof stars === 'number') {
          progression.recordLevelStars?.(level, stars);
        }
      }
    }
    persistSave(true);

    const bestEndlessState = progression.getState();
    let currentGoldEarned = goldEarned || 0;
    const openResult = () => {
      ui.showResultModal(
        {
          victory: endlessRun ? false : victory,
          level,
          goldEarned: currentGoldEarned,
          kills,
          unlockedWeapon,
          hpRatio,
          elapsedSec: runSec,
          stars: !endlessRun && victory ? (stars ?? 1) : 0,
          starDetails,
          difficulty,
          isEndless: endlessRun,
          endlessWave: Math.max(1, Number(endlessWave) || 1),
          bestEndlessKills: bestEndlessState.bestEndlessKills || 0,
          bestEndlessTimeSec: bestEndlessState.bestEndlessTimeSec || 0,
          canRevive: (!victory || endlessRun) && !usedReviveThisRun,
          canDoubleGold: currentGoldEarned > 0 && !usedDoubleGoldThisRun,
          canBossRematch: isSoulsChapter && !victory && soulsBossCheckpointUnlocked
        },
        {
          onBossRematch: async () => {
            ui.hideResultModal();
            await startBattle(progression.getState().selectedClass, 26, { startAtBossArena: true });
          },
          onRevive: async () => {
            if (usedReviveThisRun) return false;
            const rewarded = await sdk.showRewarded('revive_hunter');
            if (rewarded) {
              usedReviveThisRun = true;
              ui.hideResultModal();
              combat.revivePlayer();
              gameMode = 'playing';
              sdk.GameplayAPI.start();
            }
            return Boolean(rewarded);
          },
          onDoubleGold: async () => {
            if (usedDoubleGoldThisRun || currentGoldEarned <= 0) return false;
            const rewarded = await sdk.showRewarded('double_gold');
            if (rewarded) {
              usedDoubleGoldThisRun = true;
              progression.addGold(currentGoldEarned);
              currentGoldEarned *= 2;
              persistSave();
              ui.showToast(`Добыча удвоена! Итого: +${currentGoldEarned} золота`);
              openResult();
            }
            return Boolean(rewarded);
          },
          onNext: async () => {
            ui.hideResultModal();
            await sdk.showInterstitial();
            const isSoulsRun = Number(level) === 26;
            if (!endlessRun && !isSoulsRun && victory) {
              activeRunLevel = Math.min(25, (level || 1) + 1);
            }
            enterHub(endlessRun || isSoulsRun ? 'home' : 'campaign_forest');
          },
          onArsenal: async () => {
            ui.hideResultModal();
            await sdk.showInterstitial();
            const isSoulsRun = Number(level) === 26;
            if (!endlessRun && !isSoulsRun && victory) {
              activeRunLevel = Math.min(25, (level || 1) + 1);
            }
            enterHub('arsenal');
          },
          onRetry: async () => {
            ui.hideResultModal();
            await sdk.showInterstitial();
            if (endlessRun) {
              startEndlessBattle(progression.getState().selectedClass);
            } else {
              startBattle(progression.getState().selectedClass, activeRunLevel);
            }
          }
        }
      );
    };

    openResult();
  };

  const combat = createCombatController({
    world,
    models,
    progression,
    audio,
    callbacks: {
      onFloatingText: (text, wx, wz, color = '#fbbf24') => {
        const pt = worldToScreen(wx, wz, 1.65);
        if (pt) {
          ui.spawnFloatingText(text, pt.x, pt.y, color);
        }
      },
      onToast: (msg, dur) => {
        if (msg) ui.showToast(msg, dur);
      },
      onSoulsCue: (text, kind) => {
        if (text) ui.showSoulsBannerCue?.(text, kind);
      },
      onWeaponUnlocked: (weaponDef) => {
        persistSave();
        if (weaponDef) {
          ui.showWeaponUnlockBanner(weaponDef);
        }
      },
      onHeroLevelUp: () => {
        persistSave();
      },
      onLevelUpReady: handleLevelUpReady,
      onLevelUp: handleLevelUpReady,
      onRunEnd: handleRunEnd,
      onBattleEnd: handleRunEnd
    }
  });

  let lastSyncedMusicMode = '';
  function syncMusicMode(nextMode) {
    if (nextMode !== lastSyncedMusicMode) {
      lastSyncedMusicMode = nextMode;
      audio.setMusicMode?.(nextMode);
    }
  }

  const isSoulsRunActive = () => activeRunLevel === 26 && !activeRunEndless && !combat.getFreeRoam?.();
  const isTouchOnlyDevice = () =>
    Boolean(window.matchMedia?.('(pointer: coarse)')?.matches && !window.matchMedia?.('(any-pointer: fine)')?.matches);

  const isDevEditorEnabled = () => {
    try {
      return window.location.search.includes('dev=1') || localStorage.getItem('grimborne_dev') === '1';
    } catch {
      return window.location.search.includes('dev=1');
    }
  };

  function isSoulsPointerLocked() {
    return Boolean(canvas && document.pointerLockElement === canvas);
  }

  function syncSoulsPointerLockHint() {
    const shouldShow =
      gameMode === 'playing' &&
      isSoulsRunActive() &&
      !isTouchOnlyDevice() &&
      inputCtrl?.getInputSource?.() !== 'touch' &&
      !isSoulsPointerLocked() &&
      !ui.isPauseModalOpen?.() &&
      !ui.isSoulsDefeatOpen?.();
    ui.setSoulsPointerLockHintVisible?.(shouldShow);
  }

  function requestSoulsPointerLock() {
    if (!canvas || !isSoulsRunActive() || isTouchOnlyDevice()) return;
    if (document.pointerLockElement === canvas) return;
    try {
      const req = canvas.requestPointerLock?.();
      if (req && typeof req.then === 'function') {
        Promise.resolve(req).catch(() => {});
      }
    } catch (_) {
      // Ignore Pointer Lock failures in headless/sandboxed environments
    }
  }

  function exitSoulsPointerLock() {
    inputCtrl?.clearBlockingFlags?.();
    try {
      if (document.pointerLockElement) {
        const res = document.exitPointerLock?.();
        if (res && typeof res.then === 'function') {
          Promise.resolve(res).catch(() => {});
        }
      }
    } catch (_) {}
    syncSoulsPointerLockHint();
  }

  function toggleTargetLock() {
    if (gameMode !== 'playing' || !isSoulsRunActive()) {
      return { locked: false, target: null, unsupported: true };
    }
    audio.unlock();
    const hadTarget = Boolean(combat.getLockedTarget?.());
    const res = combat.toggleTargetLock?.();
    if (res?.unsupported) return res;
    if (res?.locked) {
      ui.showToast(`🎯 Захват цели: ${res.target?.nameRu || 'Враг'} [Q / СКМ]`);
    } else if (hadTarget) {
      ui.showToast('🔓 Захват цели снят');
    } else {
      ui.showToast('🎯 Нет врагов рядом для захвата');
    }
    ui.updateHud(combat.getHudSnapshot?.());
    return res || { locked: false, target: null };
  }

  function cycleTargetLock(dir = 1) {
    if (gameMode !== 'playing' || !isSoulsRunActive()) {
      return { locked: false, target: null, unsupported: true };
    }
    audio.unlock();
    const prevTarget = combat.getLockedTarget?.();
    if (!prevTarget) {
      return toggleTargetLock();
    }
    const res = combat.cycleTargetLock?.(dir);
    if (res?.unsupported) return res;
    const nextTarget =
      res?.target ||
      (res && typeof res === 'object' && 'hp' in res ? res : null) ||
      combat.getLockedTarget?.();
    if (nextTarget && nextTarget !== prevTarget) {
      ui.showToast(`🎯 Цель: ${nextTarget.nameRu || 'Враг'} [Tab]`);
    } else if (nextTarget) {
      ui.showToast(`🎯 Цель: ${nextTarget.nameRu || 'Враг'}`);
    }
    ui.updateHud(combat.getHudSnapshot?.());
    return res ?? nextTarget;
  }

  const TELEGRAPH_HIDE_STORAGE_KEY = 'grimborne_hide_telegraphs';
  let hideTelegraphs = false;
  try {
    hideTelegraphs = localStorage.getItem(TELEGRAPH_HIDE_STORAGE_KEY) === '1';
  } catch {}

  function applyTelegraphsVisibility(showCue = false) {
    const visible = !hideTelegraphs;
    world.setTelegraphsVisible?.(visible);
    ui.setTelegraphsVisibleState?.(visible);
    if (showCue) {
      const msg = visible ? '🎯 Индикаторы атак показаны [9]' : '👁️ Индикаторы атак скрыты [9]';
      ui.showSoulsBannerCue?.(msg, visible ? 'guard_counter' : 'partial_parry');
    }
    return visible;
  }

  function toggleTelegraphs(nextVisible = null) {
    hideTelegraphs = typeof nextVisible === 'boolean' ? !nextVisible : !hideTelegraphs;
    try {
      localStorage.setItem(TELEGRAPH_HIDE_STORAGE_KEY, hideTelegraphs ? '1' : '0');
    } catch {}
    return applyTelegraphsVisibility(true);
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
    isDevEditorEnabled,
    world,
    audio,
    callbacks: {
      onManualReload: () => {
        combat.triggerReload?.();
      },
      onToggleTargetLock: () => toggleTargetLock(),
      onCycleTargetLock: (dir = 1) => cycleTargetLock(dir),
      onToggleAutoAimHotkey: () => {
        const next = !combat.getAutoAim();
        combat.setAutoAim(next);
        ui.setAutoAimState(next);
        ui.showToast(next ? '🎯 Автоприцел включён' : '🎯 Ручной прицел курсором');
      },
      onToggleAttackHotkey: () => {
        const next = !(combat.getAttackEnabled ? combat.getAttackEnabled() : true);
        combat.setAttackEnabled?.(next);
        ui.setAttackEnabledState?.(next);
        ui.showToast(next ? '⚔️ Атака ВКЛ [E]' : '👁️ Атака ВЫКЛ [E] — режим наблюдения');
      },
      onTogglePause: () => togglePauseGame(),
      onToggleTelegraphs: () => toggleTelegraphs(),
      onWindowBlur: () => {
        rmbRotatingHero = false;
        touchRotatingHero = false;
        activeHeroTouchId = null;
        document.body.classList.remove('is-rotating-hero');
      }
    }
  });

  document.addEventListener('pointerlockchange', () => {
    if (!isSoulsPointerLocked()) {
      inputCtrl.clearBlockingFlags();
    }
    syncSoulsPointerLockHint();
  });

  function enterHub(targetTab = null) {
    exitSoulsPointerLock();
    inputCtrl.resetCombatInputs();
    activeRunEndless = false;
    soulsBossCheckpointUnlocked = false;
    soulsVictoryShownThisRun = false;
    if (activeRunLevel === 26) {
      activeRunLevel = Math.min(LEVELS.length, Math.max(1, progression.getState().maxUnlockedLevel || 1));
    }
    combat.setFreeRoam?.(false);
    combat.disposeRun();
    if (hubBgPlateEl) {
      hubBgPlateEl.classList.remove('hidden');
      hubBgPlateEl.style.transform = 'translate3d(0, 0, 0) scale(1.03)';
    }
    if (hubBgVideoEl) {
      hubBgVideoEl.muted = true;
      hubBgVideoLoop?.play();
    }
    world.setBossAtmosphere(false);
    world.setCameraMode?.('hub');
    syncMusicMode('hub');
    gameMode = 'hub';
    sdk.GameplayAPI.stop();
    ui.hideAllModals();
    ui.showHud(false);
    ui.setSelectedLevel?.(activeRunLevel);
    if (targetTab) {
      ui.setActiveTab?.(targetTab);
    }
    progression.ensureDailyQuests?.();
    ui.setOnboardingDone?.(Boolean(progression.getState().onboardingDone));
    ui.renderHub(progression);
    ui.showHub(true);
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
            syncMusicMode(combat.getHudSnapshot?.()?.finaleStarted ? 'boss' : 'combat');
            sdk.GameplayAPI.start();
            if (isSoulsRunActive()) {
              requestSoulsPointerLock();
            }
            syncSoulsPointerLockHint();
          }
        },
        onRestart: async () => {
          persistSave();
          if (activeRunEndless) {
            await startEndlessBattle(progression.getState().selectedClass);
          } else {
            const wasSouls = isSoulsRunActive();
            await startBattle(progression.getState().selectedClass, activeRunLevel);
            if (wasSouls) requestSoulsPointerLock();
          }
        },
        onExit: () => {
          persistSave();
          enterHub();
        }
      });
      syncSoulsPointerLockHint();
    } else if (gameMode === 'paused') {
      ui.hidePauseModal?.();
      gameMode = 'playing';
      syncMusicMode(combat.getHudSnapshot?.()?.finaleStarted ? 'boss' : 'combat');
      sdk.GameplayAPI.start();
      syncSoulsPointerLockHint();
    }
  }
  let battleLaunchLock = false;
  async function startBattle(classId, levelNum, opts = {}) {
    if (battleLaunchLock) return;
    audio.unlock();
    const chosenClass = classId || progression.getState().selectedClass || 'warrior';
    const maxLvl = Math.min(LEVELS.length, Math.max(1, progression.getState().maxUnlockedLevel || 1));
    const reqLvl = Number(levelNum) || activeRunLevel || 1;
    const isFreeRoam = Boolean(combat.getFreeRoam?.());
    const chosenLevel = reqLvl === 26 ? 26 : isFreeRoam ? Math.min(LEVELS.length, Math.max(1, reqLvl)) : Math.min(maxLvl, Math.max(1, reqLvl));
    const startAtBossArena = Boolean(chosenLevel === 26 && opts?.startAtBossArena);
    if (chosenLevel === 26) {
      // Begin async Souls WAV fetch & decode upfront so first footsteps/hits never stutter
      audio?.preloadSoulsAudio?.();
    }
    const eqWpnId = progression.getEquippedWeaponId(chosenClass);
    const stageDef = getLevelDef(chosenLevel);
    const missingKeys = models.getMissingStageModelKeys(chosenClass, eqWpnId, stageDef);
    if (missingKeys.length > 0) {
      battleLaunchLock = true;
      ui.showToast('⏳ Загружаем 3D-модели локации…');
      try {
        await models.ensureModelKeysLoaded(missingKeys);
      } finally {
        battleLaunchLock = false;
      }
    }
    activeRunLevel = chosenLevel;
    activeRunEndless = false;
    soulsVictoryShownThisRun = false;
    if (!startAtBossArena) {
      soulsBossCheckpointUnlocked = false;
    }
    usedReviveThisRun = false;
    usedDoubleGoldThisRun = false;
    inputCtrl.resetCombatInputs();

    clearHubDiorama();
    if (hubBgPlateEl) hubBgPlateEl.classList.add('hidden');
    hubBgVideoLoop?.pause();
    const battleBiome =
      chosenLevel === 26
        ? 'souls_citadel'
        : chosenLevel >= 21
          ? 'ash_citadel'
          : chosenLevel >= 16
            ? 'frost_ruins'
            : chosenLevel >= 6
              ? 'misty_forest'
              : 'courtyard';
    world.setArenaBiome?.(battleBiome, chosenLevel);
    world.setCameraMode?.('combat');
    ui.hideAllModals();
    ui.showHub(false);
    ui.showHud(true);
    combat.setAttackEnabled?.(chosenLevel !== 26);
    // Standard free combat camera (RMB orbit + mouse-wheel zoom) across all chapters,
    // including Misty Forest (chapter 6+) and Path of Ash (chapter 26 Souls prototype).
    world.setCameraLock?.(false);
    syncMusicMode('combat');
    const stBeforeRun = progression.getState();
    const difficultyMode = stBeforeRun.difficultyMode || 'normal';
    ui.setOnboardingDone?.(Boolean(stBeforeRun.onboardingDone));
    combat.startRun({ classId: chosenClass, levelNumber: chosenLevel, difficultyMode, startAtBossArena });
    if (battleBiome === 'souls_citadel') {
      audio?.preloadSoulsAudio?.();
      world.prewarmSoulsShaders?.();
    }
    ui.setAutoAimState(combat.getAutoAim());
    ui.setAttackEnabledState?.(combat.getAttackEnabled ? combat.getAttackEnabled() : chosenLevel !== 26);
    ui.updateHud(combat.getHudSnapshot());
    if (chosenLevel === 1 && !stBeforeRun.onboardingDone) {
      ui.startOnboarding?.(chosenLevel, false);
    }
    resetFrameLoopTiming();
    gameMode = 'playing';
    if (!isSoulsRunActive()) {
      exitSoulsPointerLock();
    } else {
      syncSoulsPointerLockHint();
    }
    sdk.GameplayAPI.start();
  }

  async function startSoulsLevel(classId = null) {
    combat.setFreeRoam(false);
    return startBattle(classId || progression.getState().selectedClass || 'warrior', 26);
  }

  async function startTrainingGround(classId = null) {
    combat.setFreeRoam(true);
    await startBattle(classId || progression.getState().selectedClass || 'warrior', 6);
    world.setCameraLock?.(false);
    ui.showToast('🎯 Тренировочный полигон — бей по мишени, тестируй комбо и анимации!');
  }

  async function startEndlessBattle(classId) {
    if (battleLaunchLock) return;
    combat.setFreeRoam(false);
    audio.unlock();
    const chosenClass = classId || progression.getState().selectedClass || 'warrior';
    const eqWpnId = progression.getEquippedWeaponId(chosenClass);
    const endlessStageDef = LEVELS.find((l) => l.level === 25) || LEVELS[LEVELS.length - 1] || LEVELS[0];
    const missingKeys = models.getMissingStageModelKeys(chosenClass, eqWpnId, endlessStageDef);
    if (missingKeys.length > 0) {
      battleLaunchLock = true;
      ui.showToast('⏳ Загружаем 3D-модели Бесконечной Орды…');
      try {
        await models.ensureModelKeysLoaded(missingKeys);
      } finally {
        battleLaunchLock = false;
      }
    }
    activeRunEndless = true;
    soulsBossCheckpointUnlocked = false;
    soulsVictoryShownThisRun = false;
    usedReviveThisRun = false;
    usedDoubleGoldThisRun = false;
    inputCtrl.resetCombatInputs();

    clearHubDiorama();
    if (hubBgPlateEl) hubBgPlateEl.classList.add('hidden');
    hubBgVideoLoop?.pause();
    world.setCameraMode?.('combat');
    ui.hideAllModals();
    ui.showHub(false);
    ui.showHud(true);
    combat.setAttackEnabled?.(true);
    ui.setAutoAimState(combat.getAutoAim());
    ui.setAttackEnabledState?.(true);

    world.setArenaBiome?.('courtyard');
    world.setCameraLock?.(false);
    syncMusicMode('combat');
    const stBeforeEndless = progression.getState();
    const difficultyMode = stBeforeEndless.difficultyMode || 'normal';
    ui.setOnboardingDone?.(Boolean(stBeforeEndless.onboardingDone));
    combat.startRun({ classId: chosenClass, levelNumber: 1, difficultyMode, endless: true });
    ui.updateHud(combat.getHudSnapshot());
    gameMode = 'playing';
    if (!isSoulsRunActive()) {
      exitSoulsPointerLock();
    } else {
      syncSoulsPointerLockHint();
    }
    sdk.GameplayAPI.start();
  }

  const handleBuyHeroUpgrade = (statKey, classId) => {
    audio.unlock();
    const targetClass = classId || progression.getState().selectedClass || 'warrior';
    if (progression.buyHeroUpgrade(statKey, targetClass)) {
      audio.playPickup('gold');
      persistSave();
      ui.renderHub(progression);
    } else {
      ui.showToast('Недостаточно золота для изучения таланта');
    }
  };

  // Wire UI Hub & HUD callbacks
  ui.setCallbacks({
    onSelectClass: (classId) => {
      audio.unlock();
      progression.selectClass(classId);
      persistSave();
      ui.renderHub(progression);
      refreshHubDiorama();
    },
    onSelectMageElement: (elemId) => {
      audio.unlock();
      const res = progression.selectOrUnlockMageElement(elemId);
      if (res.ok) {
        const eName = MAGE_ELEMENTS[elemId]?.nameRu || elemId;
        if (res.action === 'starter_unlocked') {
          audio.playWeaponUnlock();
          ui.showToast(`Стихия «${eName}» выбрана бесплатно!`);
        } else if (res.action === 'purchased') {
          audio.playLevelUp();
          ui.showToast(`Открыта новая стихия: ${eName}!`);
        } else {
          audio.playMagicCast(elemId);
        }
        persistSave();
        ui.renderHub(progression);
        refreshHubDiorama();
      } else if (res.reason === 'gold') {
        ui.showToast(`Нужно ${res.cost} золота для открытия стихии`);
      }
    },
    onResetProgress: async () => {
      audio.unlock();
      combat.disposeRun();
      const freshState = progression.resetAllProgress();
      await sdk.clearData(freshState);
      lastSavedGold = freshState.gold;
      activeRunLevel = 1;
      usedReviveThisRun = false;
      usedDoubleGoldThisRun = false;
      ui.setOnboardingDone?.(false);
      ui.resetLocalSelection?.();
      enterHub();
      audio.playLevelUp();
      ui.showToast('Прогресс полностью сброшен до нуля!');
    },
    onEquipWeapon: (weaponId, classId) => {
      audio.unlock();
      const targetClass = classId || progression.getState().selectedClass;
      if (progression.equipWeapon(targetClass, weaponId)) {
        audio.playPickup('crate');
        persistSave();
        ui.renderHub(progression);
        refreshHubDiorama();
      }
    },
    onUpgradeWeapon: (weaponId) => {
      audio.unlock();
      if (progression.upgradeWeaponInShop(weaponId)) {
        audio.playLevelUp();
        persistSave();
        ui.renderHub(progression);
      } else {
        ui.showToast('Недостаточно золота для улучшения оружия');
      }
    },
    onBuyWeapon: (weaponId) => {
      audio.unlock();
      const check = progression.canBuyWeaponInShop?.(weaponId);
      if (check?.ok && progression.buyWeaponInShop?.(weaponId)) {
        const wName = WEAPONS[weaponId]?.nameRu || weaponId;
        audio.playWeaponUnlock();
        persistSave();
        ui.renderHub(progression);
        refreshHubDiorama();
        ui.playPurchaseCelebration?.(weaponId);
      } else if (check?.reason === 'blueprint') {
        ui.showToast('📜 Сначала найдите чертёж Копья в сундуках (этапы III+, шанс 20%)!');
      } else if (check?.reason === 'boss') {
        const req = WEAPONS[weaponId]?.unlockRequiresBossStage || 5;
        ui.showToast(`🔒 Победите босса ${req}-го этапа, чтобы открыть в Магазине!`);
      } else if (check?.reason === 'level') {
        const req = WEAPONS[weaponId]?.unlockLevel || 3;
        ui.showToast(`🔒 Откроется с ${req}-го этапа кампании!`);
      } else if (check?.reason === 'gold') {
        ui.showToast('Недостаточно золота для покупки!');
      }
    },
    onBuyHeroUpgrade: handleBuyHeroUpgrade,
    onUpgradeStat: handleBuyHeroUpgrade,
    onUpgradeTalent: (classId, talentId) => {
      audio.unlock();
      if (progression.upgradeClassTalent?.(classId, talentId)) {
        audio.playLevelUp();
        persistSave();
        ui.renderHub(progression);
      } else {
        ui.showToast('Нет доступных очков таланта или не открыт предыдущий узел');
      }
    },
    onResetTalents: (classId) => {
      audio.unlock();
      if (progression.resetClassTalents?.(classId)) {
        audio.playPickup('crate');
        persistSave();
        ui.renderHub(progression);
        ui.showToast('Очки талантов сброшены!');
      }
    },
    onUpgradeMageTalent: (talentId) => {
      audio.unlock();
      if (progression.upgradeMageTalent?.(talentId)) {
        audio.playLevelUp();
        persistSave();
        ui.renderHub(progression);
      } else {
        ui.showToast('Нет доступных очков таланта или не открыт предыдущий узел');
      }
    },
    onResetMageTalents: () => {
      audio.unlock();
      if (progression.resetMageTalents?.()) {
        audio.playPickup('crate');
        persistSave();
        ui.renderHub(progression);
        ui.showToast('Очки талантов Мага Воды сброшены!');
      }
    },
    onRewardGold: async () => {
      audio.unlock();
      const ok = await sdk.showRewarded('arsenal_gold_chest');
      if (ok) {
        progression.addGold(80);
        audio.playWeaponUnlock();
        persistSave();
        ui.renderHub(progression);
        ui.showToast('+80 золота получено из сундука снабжения!');
      }
    },
    onClaimDailyQuest: (questId) => {
      audio.unlock();
      const res = progression.claimDailyQuest?.(questId);
      if (res?.ok) {
        audio.playWeaponUnlock?.();
        persistSave(true);
        ui.renderHub(progression);
        ui.showToast(`📜 Награда получена: +${res.rewardGold} золота!`);
      } else if (res?.reason === 'already_claimed') {
        ui.showToast('Награда за это задание уже получена!');
      } else if (res?.reason === 'incomplete') {
        ui.showToast('Задание ещё не выполнено');
      }
    },
    onCompleteOnboarding: () => {
      progression.completeOnboarding?.();
      ui.setOnboardingDone?.(true);
      persistSave(true);
    },
    onSelectLevel: (levelNum) => {
      audio.unlock();
      const maxLvl = progression.getState().maxUnlockedLevel || 1;
      if (levelNum <= maxLvl) {
        activeRunLevel = levelNum;
      }
    },
    onSetDifficulty: (mode) => {
      audio.unlock();
      progression.setDifficultyMode?.(mode);
      persistSave();
      ui.renderHub(progression);
    },
    onStartRun: ({ classId, level } = {}) => {
      combat.setFreeRoam(false);
      startBattle(classId, level || activeRunLevel);
    },
    onStartEndless: ({ classId } = {}) => {
      startEndlessBattle(classId);
    },
    onStartSouls: ({ classId } = {}) => {
      startSoulsLevel(classId);
    },
    onStartTraining: ({ classId } = {}) => {
      startTrainingGround(classId);
    },
    onReload: () => {
      audio.unlock();
      if (gameMode === 'playing' && !isSoulsRunActive()) {
        combat.triggerReload?.();
        inputCtrl.requestReload();
      }
    },
    onToggleAutoAim: (nextBool) => {
      if (isSoulsRunActive()) return false;
      const next = typeof nextBool === 'boolean' ? nextBool : !combat.getAutoAim();
      combat.setAutoAim(next);
      ui.setAutoAimState(next);
    },
    onToggleTargetLock: () => {
      return toggleTargetLock();
    },
    onCycleTargetLock: (dir = 1) => {
      return cycleTargetLock(dir);
    },
    onToggleAttack: (nextBool) => {
      if (isSoulsRunActive()) return false;
      const next = typeof nextBool === 'boolean' ? nextBool : !combat.getAttackEnabled?.();
      combat.setAttackEnabled?.(next);
      ui.setAttackEnabledState?.(next);
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
    onTogglePause: () => {
      togglePauseGame();
    },
    onToggleTelegraphs: () => {
      toggleTelegraphs();
    },
    onSoulsInteract: () => {
      if (gameMode === 'playing' && isSoulsRunActive()) {
        audio.unlock();
        inputCtrl.requestInteract();
      }
    },
    onSkipBossDoorCutscene: () => {
      if (gameMode === 'playing' && isSoulsRunActive()) {
        combat.skipBossDoorCutscene?.();
      }
    },
    onExitToHub: () => {
      const returnHome = Boolean(combat.getFreeRoam?.() || activeRunEndless || activeRunLevel === 26);
      persistSave();
      enterHub(returnHome ? 'home' : 'campaign_forest');
    },
    onHubTabChange: (tabId) => {
      currentHubTab = tabId || 'home';
      if (currentHubTab === 'campaign_world' || currentHubTab === 'campaign') {
        audio.playMapOpenSfx?.();
      } else if (currentHubTab === 'campaign_forest') {
        audio.playPortalEnterSfx?.();
      }
      const isFullscreenCampaign =
        currentHubTab === 'campaign' ||
        currentHubTab === 'campaign_world' ||
        currentHubTab === 'campaign_forest';
      const isShowcaseTab = currentHubTab === 'arsenal' || currentHubTab === 'store';
      world.setHubStageFocus?.(tabId === 'heroes' ? 'heroes' : isShowcaseTab ? 'arsenal' : 'center');
      if (hubPreviewHero?.root) {
        hubPreviewHero.root.visible = !isShowcaseTab && !isFullscreenCampaign;
      }
      if (isShowcaseTab) {
        hubHeroRotY = 0;
        hubHeroTargetRotY = 0;
        hubHeroRotVel = 0;
        refreshArsenalWeaponDiorama(previewedArsenalWeaponId, previewedArsenalLocked);
      } else if (hubArsenalWeapon?.root && hubArsenalWeapon.root.parent) {
        hubArsenalWeapon.root.parent.remove(hubArsenalWeapon.root);
        hubArsenalWeapon?.dispose?.();
        hubArsenalWeapon = null;
      }
    },
    onPreviewArsenalWeapon: (weaponId, isLocked) => {
      previewedArsenalWeaponId = weaponId;
      previewedArsenalLocked = Boolean(isLocked);
      if (currentHubTab === 'arsenal' || currentHubTab === 'store') {
        refreshArsenalWeaponDiorama(weaponId, isLocked);
      }
    }
  });

  // === Hub 3D Hero & Weapon Turntable Drag Listeners ===
  window.addEventListener('pointerdown', (e) => {
    if (gameMode !== 'hub' || (!hubPreviewHero?.root && !hubArsenalWeapon?.root)) return;
    if (ui.isHeroStageVisible && !ui.isHeroStageVisible()) return;
    const mapped = window.__toGameCoords ? window.__toGameCoords(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };

    // Desktop Left OR Right Mouse Button drag on open 3D stage rotates Hero & Shop/Arsenal 3D weapons smoothly!
    if (e.pointerType !== 'touch' && (e.button === 0 || e.button === 2)) {
      if (
        e.target &&
        typeof e.target.closest === 'function' &&
        e.target.closest(
          e.button === 0
            ? 'button, input, a, .hero-info-card, .hero-roster-rail, .arsenal-right-plaque, .arsenal-gothic-card, .hub-subpanel-card, .hub-bottom-dock, .hub-topleft-profile, .hub-topright-bar, .home-cta-stack, .modal-backdrop, .sound-popover'
            : '.modal-backdrop:not(.hidden), .sound-popover:not(.hidden)'
        )
      ) {
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

    // Touch fallback on open 3D stage area (for mobile/tablet where there is no RMB)
    if (e.pointerType === 'touch' && !touchRotatingHero) {
      if (
        e.target &&
        typeof e.target.closest === 'function' &&
        e.target.closest(
          'button, input, a, .hero-info-card, .hero-roster-rail, .hub-subpanel-card, .hub-bottom-dock, .hub-topleft-profile, .hub-topright-bar, .home-cta-stack, .modal-backdrop, .sound-popover'
        )
      ) {
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
      // Safety check: if neither LMB nor RMB is pressed
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

  // Sync initial volume/mute/telegraph UI state & enter Hub behind splash screen
  ui.setVolumeState?.(audio.getSfxVolume ? audio.getSfxVolume() : audio.getVolume());
  ui.setMusicVolumeState?.(audio.getMusicVolume ? audio.getMusicVolume() : 0.38);
  ui.setMutedState?.(audio.isMuted());
  applyTelegraphsVisibility(false);
  enterHub();
  // Render initial 3D Courtyard + Hero Pedestal frame BEFORE dismissing splash so mobile never flashes black!
  world.followTarget(0, 0, 0.016);
  world.update(0.016, 0);
  world.render();
  window.__notifyEngineReady?.();
  sdk.markGameReady();

  // Expose debug helper on window for quick testing
  window.__grimborne = {
    progression,
    combat,
    world,
    ui,
    enterHub,
    startBattle,
    startEndlessBattle,
    startSoulsLevel,
    startSoulsBossRematch: (classId = null) => {
      combat.setFreeRoam(false);
      return startBattle(classId || progression.getState().selectedClass || 'warrior', 26, { startAtBossArena: true });
    },
    startTrainingGround,
    toggleTargetLock,
    cycleTargetLock,
    getLockedTarget: () => combat.getLockedTarget?.() || null,
    requestSoulsPointerLock,
    exitSoulsPointerLock,
    isSoulsPointerLocked,
    toggleTelegraphs,
    getTelegraphsVisible: () => (world.getTelegraphsVisible ? world.getTelegraphsVisible() : !hideTelegraphs),
    triggerSoulsInteract: () => inputCtrl.requestInteract(),
    getInputSource: () => inputCtrl.getInputSource(),
    setInputSource: (src) => inputCtrl.setInputSource(src),
    // Walk the new arena with no enemies and no damage (layout testing).
    startFreeRoam: async (level = 6, classId = null) => {
      combat.setFreeRoam(true);
      await startBattle(classId || progression.getState().selectedClass || 'warrior', level);
      world.setCameraLock?.(false);
    },
    stopFreeRoam: () => combat.setFreeRoam(false),
    getHeroRotationY: () => hubHeroRotY,
    setHeroRotationY: (rad) => {
      hubHeroRotY = Number(rad) || 0;
      hubHeroTargetRotY = hubHeroRotY;
      hubHeroRotVel = 0;
      if (hubPreviewHero?.root) hubPreviewHero.root.rotation.y = hubHeroRotY;
    }
  };

  // Optional one-shot URL params: never auto-launch Training Ground (?freeroam/?nomobs) on load/reload;
  // allow direct fresh navigation to Chapter 26 (?level=26 / ?souls=1) only when not a page reload, and clean URL immediately.
  try {
    const params = new URLSearchParams(window.location.search);
    const rawClass = (params.get('class') || '').trim().toLowerCase();
    const targetClass = (rawClass === 'warrior' || rawClass === 'gunslinger' || rawClass === 'mage') ? rawClass : null;
    if (targetClass) progression.selectClass?.(targetClass);

    const soulsRaw = params.get('souls');
    const directLvl = Number(params.get('level') || 0);
    const hubOnly = params.get('hub') === '1';
    const navType = performance.getEntriesByType?.('navigation')?.[0]?.type;

    const oneShotKeys = ['freeroam', 'nomobs', 'souls', 'level', 'hub'];
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
      void startSoulsLevel(targetClass || 'warrior');
    }
  } catch {}

  // === Uncapped High-Refresh Render & Simulation Loop ===
  const showFpsBadge =
    typeof window !== 'undefined' &&
    /(?:^|[?&])(fps=1|debug=1)(?:&|$)/i.test(window.location?.search || '');
  const fpsBadgeEl = document.getElementById('fps-badge');
  if (fpsBadgeEl) {
    fpsBadgeEl.classList.toggle('hidden', !showFpsBadge);
    fpsBadgeEl.classList.toggle('is-dev-visible', showFpsBadge);
  }
  const FPS_BADGE_UPDATE_INTERVAL_SEC = 0.4; // 2.5x/sec (prevents DOM thrash while staying crisp)
  resetFrameLoopTiming();

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDeltaSec = (now - lastNow) / 1000;
    lastNow = now;

    if (rawDeltaSec > 0 && rawDeltaSec < 0.5) {
      fpsAccumTime += rawDeltaSec;
      fpsFrameCount += 1;
      if (fpsAccumTime >= FPS_BADGE_UPDATE_INTERVAL_SEC) {
        const instFps = fpsFrameCount / fpsAccumTime;
        smoothedFps = smoothedFps * 0.35 + instFps * 0.65;
        if (fpsBadgeEl) {
          const shownFps = Math.max(1, Math.round(smoothedFps));
          if (shownFps !== lastShownFps) {
            lastShownFps = shownFps;
            fpsBadgeEl.textContent = `${shownFps} FPS`;
          }
        }
        if (gameMode === 'playing' && !externalPaused && !thermalLowSpecApplied) {
          // Only drop into lowSpec on genuine sustained severe slowdown (never on brief desktop 35-42 FPS dips
          // that would cause a mid-run shadow/normalMap shader recompile stutter & graphics downgrade).
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
        fpsFrameCount = 0;
      }
    }

    const MAX_SIM_STEP = 1 / 60; // Deterministic <= 16.67ms sub-stepping for 30/60/144 FPS parity
    const dt = Math.min(0.05, Math.max(0.0005, rawDeltaSec));

    if (externalPaused) {
      if (gameMode === 'hub') {
        world.render();
      }
      return;
    }

    if (gameMode === 'playing') {
      // Avoid 3x sub-step CPU death spirals on brief frame dips (cap at 2 substeps max)
      const subSteps = dt <= 0.025 ? 1 : Math.max(1, Math.min(2, Math.ceil(dt / MAX_SIM_STEP)));
      const stepDt = dt / subSteps;
      const frameInput = gatherInput(dt);
      const urgentHudSync = Boolean(
        frameInput.reload ||
        frameInput.dash ||
        frameInput.ult ||
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
        if (s === 0 && subSteps > 1) {
          inputCtrl.clearSubStepEdgeTriggers(frameInput);
        }
      }
      // Run world ambient/arena/VFX update strictly once per rendered frame (never 2-3x on sub-stepped frames!)
      if (stepsExecuted > 0) {
        world.update(Math.min(dt, stepDt * stepsExecuted), elapsedTime);
      }
      hudSyncAccum = (hudSyncAccum || 0) + dt;
      if (hudSyncAccum >= 0.05 || urgentHudSync) {
        hudSyncAccum = 0;
        const snap = combat.getHudSnapshot();
        ui.updateHud(snap);
        ui.setSoulsInteractPrompt?.(
          Boolean(snap?.isSoulslike && (snap?.souls?.canOpenBossDoors || snap?.souls?.canInteract)),
          snap?.souls?.interactLabel || 'Открыть врата'
        );
        const wantBossMusic = Boolean(
          snap?.finaleStarted ||
          (snap?.isEndless && snap?.boss) ||
          (snap?.isSoulslike && snap?.souls?.bossAwakened && !snap?.souls?.bossDefeated && !snap?.souls?.doorCutsceneActive)
        );
        syncMusicMode(wantBossMusic ? 'boss' : 'combat');
      }
      autoSaveAccum += dt;
      if (autoSaveAccum >= 3.0) {
        autoSaveAccum = 0;
        if (progression.getState().gold !== lastSavedGold) {
          persistSave();
        }
      }
    } else if (gameMode === 'hub') {
      elapsedTime += dt;
      // Close-up Hero Showcase camera centered on (0, 0) stone pedestal + RMB 360° Hero Rotation
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
      if (hubArsenalWeapon?.root) {
        if (!rmbRotatingHero && !touchRotatingHero && (currentHubTab === 'arsenal' || currentHubTab === 'store')) {
          hubHeroTargetRotY += dt * 0.36;
        }
        hubArsenalWeapon.root.rotation.y = hubHeroRotY;
        hubArsenalWeapon.update?.(dt, elapsedTime);
      }
      world.update(dt, elapsedTime);
    } else {
      elapsedTime += dt;
      // Paused in Level-Up or Result modal: keep subtle lantern flicker alive
      world.update(dt * 0.25, elapsedTime);
    }

    world.render();
  }

  requestAnimationFrame(frame);
}

bootstrap().catch((err) => {
  console.error('Grimborne bootstrap error:', err);
});
