// Master game orchestrator: wires Three.js World, 3D Chibi Models, 3-Class Combat,
// Arsenal Progression, Procedural Web Audio, Gothic UI, and Yandex Games SDK v2.

import * as THREE from '../vendor/three.module.js';
import { LEVELS, MAGE_ELEMENTS, WEAPONS } from './config.js?v=20261120z35';
import { createArenaWorld } from './world.js?v=20261120z35';
import * as models from './models.js?v=20261120z40';
import { createProgressionStore, mergeCloudState } from './progression.js?v=20261120z35';
import { createCombatController } from './combat.js?v=20261120z38';
import { createAudioEngine } from './audio.js?v=20261120z35';
import { initYandexSdk } from './yandexSdk.js?v=20261120z35';
import { createUIManager } from './ui.js?v=20261120z35';
import { attachSeamlessLoop } from './ambientVideo.js?v=20261117z25';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  const audio = createAudioEngine();

  let gameMode = 'hub'; // 'hub' | 'playing' | 'levelup' | 'result'
  let externalPaused = false;
  let activeRunLevel = 1;
  let activeRunEndless = false;
  let usedReviveThisRun = false;
  let usedDoubleGoldThisRun = false;

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
  const bootLevelDef = LEVELS[Math.max(0, (activeRunLevel || 1) - 1)];
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

  // Initialize 3-Class Combat Controller
  const handleLevelUpReady = (choices = []) => {
    if (!Array.isArray(choices) || choices.length === 0) return;
    if (gameMode !== 'playing' && gameMode !== 'levelup') return;
    gameMode = 'levelup';
    keysDown.clear();
    pointerFiring = false;
    pointerClickQueued = false;
    dashRequested = false;
    ultRequested = false;
    sdk.GameplayAPI.stop();
    ui.showLevelUpModal(choices, (perkOrId) => {
      const perkId = typeof perkOrId === 'string' ? perkOrId : perkOrId?.id;
      gameMode = 'playing';
      audio.playLevelUp?.();
      combat.applyLevelUpChoice?.(perkId);
      if (gameMode === 'playing') {
        ui.updateHud(combat.getHudSnapshot());
        sdk.GameplayAPI.start();
      }
    });
  };

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
    endlessWave
  } = {}) => {
    if (gameMode === 'result') return;
    gameMode = 'result';
    sdk.GameplayAPI.stop();
    const endlessRun = Boolean(isEndless || activeRunEndless);
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
      progression.unlockNextLevel(level);
      if (typeof stars === 'number') {
        progression.recordLevelStars?.(level, stars);
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
          canDoubleGold: currentGoldEarned > 0 && !usedDoubleGoldThisRun
        },
        {
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
            if (!endlessRun && victory) {
              activeRunLevel = Math.min(LEVELS.length, (level || 1) + 1);
            }
            enterHub(endlessRun ? 'home' : 'campaign_forest');
          },
          onArsenal: async () => {
            ui.hideResultModal();
            await sdk.showInterstitial();
            if (!endlessRun && victory) {
              activeRunLevel = Math.min(LEVELS.length, (level || 1) + 1);
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

  let reloadRequested = false;
  let dashRequested = false;
  let ultRequested = false;
  let lastSyncedMusicMode = '';
  function syncMusicMode(nextMode) {
    if (nextMode !== lastSyncedMusicMode) {
      lastSyncedMusicMode = nextMode;
      audio.setMusicMode?.(nextMode);
    }
  }

  function enterHub(targetTab = null) {
    reloadRequested = false;
    dashRequested = false;
    ultRequested = false;
    activeRunEndless = false;
    pointerFiring = false;
    pointerClickQueued = false;
    rmbOrbitingCamera = false;
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
      keysDown.clear();
      pointerFiring = false;
      pointerClickQueued = false;
      dashRequested = false;
      ultRequested = false;
      syncMusicMode('hub');
      sdk.GameplayAPI.stop();
      const snap = combat.getHudSnapshot?.() || {};
      ui.showPauseModal?.(snap, {
        onResume: () => {
          if (gameMode === 'paused') {
            gameMode = 'playing';
            syncMusicMode(combat.getHudSnapshot?.()?.finaleStarted ? 'boss' : 'combat');
            sdk.GameplayAPI.start();
          }
        },
        onRestart: () => {
          persistSave();
          if (activeRunEndless) {
            startEndlessBattle(progression.getState().selectedClass);
          } else {
            startBattle(progression.getState().selectedClass, activeRunLevel);
          }
        },
        onExit: () => {
          persistSave();
          enterHub();
        }
      });
    } else if (gameMode === 'paused') {
      ui.hidePauseModal?.();
      gameMode = 'playing';
      syncMusicMode(combat.getHudSnapshot?.()?.finaleStarted ? 'boss' : 'combat');
      sdk.GameplayAPI.start();
    }
  }
  let battleLaunchLock = false;
  async function startBattle(classId, levelNum) {
    if (battleLaunchLock) return;
    audio.unlock();
    const chosenClass = classId || progression.getState().selectedClass || 'warrior';
    const maxLvl = progression.getState().maxUnlockedLevel || 1;
    const chosenLevel = Math.min(maxLvl, Math.max(1, Number(levelNum) || activeRunLevel || 1));
    const eqWpnId = progression.getEquippedWeaponId(chosenClass);
    const stageDef = LEVELS[Math.max(0, chosenLevel - 1)];
    const missingKeys = models.getMissingStageModelKeys(chosenClass, eqWpnId, stageDef);
    if (missingKeys.length > 0) {
      battleLaunchLock = true;
      ui.showToast('⏳ Загружаем 3D-модели главы…');
      try {
        await models.ensureModelKeysLoaded(missingKeys);
      } finally {
        battleLaunchLock = false;
      }
    }
    activeRunLevel = chosenLevel;
    activeRunEndless = false;
    usedReviveThisRun = false;
    usedDoubleGoldThisRun = false;
    reloadRequested = false;
    dashRequested = false;
    ultRequested = false;
    pointerFiring = false;
    pointerClickQueued = false;
    rmbOrbitingCamera = false;

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

    const battleBiome =
      chosenLevel >= 21
        ? 'ash_citadel'
        : chosenLevel >= 16
          ? 'frost_ruins'
          : chosenLevel >= 6
            ? 'misty_forest'
            : 'courtyard';
    world.setArenaBiome?.(battleBiome, chosenLevel);
    // Standard free combat camera (RMB orbit + mouse-wheel zoom) across all chapters,
    // including Misty Forest (chapter 6+).
    world.setCameraLock?.(false);
    syncMusicMode('combat');
    const stBeforeRun = progression.getState();
    const difficultyMode = stBeforeRun.difficultyMode || 'normal';
    ui.setOnboardingDone?.(Boolean(stBeforeRun.onboardingDone));
    combat.startRun({ classId: chosenClass, levelNumber: chosenLevel, difficultyMode });
    ui.updateHud(combat.getHudSnapshot());
    if (chosenLevel === 1 && !stBeforeRun.onboardingDone) {
      ui.startOnboarding?.(chosenLevel, false);
    }
    gameMode = 'playing';
    sdk.GameplayAPI.start();
  }

  async function startEndlessBattle(classId) {
    if (battleLaunchLock) return;
    audio.unlock();
    const chosenClass = classId || progression.getState().selectedClass || 'warrior';
    const eqWpnId = progression.getEquippedWeaponId(chosenClass);
    const endlessStageDef = LEVELS[LEVELS.length - 1] || LEVELS[0];
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
    usedReviveThisRun = false;
    usedDoubleGoldThisRun = false;
    reloadRequested = false;
    dashRequested = false;
    ultRequested = false;
    pointerFiring = false;
    pointerClickQueued = false;
    rmbOrbitingCamera = false;

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
      startBattle(classId, level || activeRunLevel);
    },
    onStartEndless: ({ classId } = {}) => {
      startEndlessBattle(classId);
    },
    onReload: () => {
      audio.unlock();
      if (gameMode === 'playing') {
        combat.triggerReload?.();
        reloadRequested = true;
      }
    },
    onToggleAutoAim: (nextBool) => {
      const next = typeof nextBool === 'boolean' ? nextBool : !combat.getAutoAim();
      combat.setAutoAim(next);
      ui.setAutoAimState(next);
    },
    onToggleAttack: (nextBool) => {
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
    onExitToHub: () => {
      persistSave();
      enterHub('campaign_forest');
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

  // === Layout-independent Keyboard & Pointer Input (works on both RU ЙЦУКЕН and EN QWERTY!) ===
  const keysDown = new Set();
  let pointerClientX = window.innerWidth * 0.5;
  let pointerClientY = window.innerHeight * 0.5;
  let pointerFiring = false;
  let pointerClickQueued = false;
  let pointerMovedRecently = 0;

  const isDevEditorEnabled = () => {
    try {
      return window.location.search.includes('dev=1') || localStorage.getItem('grimborne_dev') === '1';
    } catch {
      return window.location.search.includes('dev=1');
    }
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyK' && !e.repeat) {
      if (!isDevEditorEnabled() && !world.isWeaponEditMode?.()) return;
      world.setWeaponEditMode?.(!world.isWeaponEditMode?.());
      return;
    }
    if (e.code === 'KeyG' && !isDevEditorEnabled()) {
      return;
    }
    if (world.isWeaponEditMode?.()) return;
    if (world.isArenaEditMode?.()) {
      if (!world.isArenaEditorHeroMovement?.()) return;
      const moveKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!moveKeys.includes(e.code)) return;
    }
    keysDown.add(e.code);
    if (e.code === 'Space' && gameMode === 'playing' && !e.repeat) {
      e.preventDefault();
      audio.unlock();
      dashRequested = true;
    }
    if (e.code === 'KeyF' && gameMode === 'playing' && !e.repeat) {
      e.preventDefault();
      audio.unlock();
      ultRequested = true;
    }
    if (e.code === 'KeyR' && gameMode === 'playing' && !e.repeat) {
      audio.unlock();
      combat.triggerReload?.();
      reloadRequested = true;
    }
    if (e.code === 'KeyQ' && gameMode === 'playing' && !e.repeat) {
      const next = !combat.getAutoAim();
      combat.setAutoAim(next);
      ui.setAutoAimState(next);
      ui.showToast(next ? '🎯 Автоприцел включён' : '🎯 Ручной прицел курсором');
    }
    if (e.code === 'KeyE' && gameMode === 'playing' && !e.repeat) {
      const next = !(combat.getAttackEnabled ? combat.getAttackEnabled() : true);
      combat.setAttackEnabled?.(next);
      ui.setAttackEnabledState?.(next);
      ui.showToast(next ? '⚔️ Атака ВКЛ [E]' : '👁️ Атака ВЫКЛ [E] — режим наблюдения');
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && (gameMode === 'playing' || gameMode === 'paused') && !e.repeat) {
      e.preventDefault();
      togglePauseGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
  });

  window.addEventListener('blur', () => {
    keysDown.clear();
    pointerFiring = false;
    pointerClickQueued = false;
    reloadRequested = false;
    dashRequested = false;
    ultRequested = false;
    rmbOrbitingCamera = false;
    rmbRotatingHero = false;
    touchRotatingHero = false;
    activeHeroTouchId = null;
    document.body.classList.remove('is-rotating-hero');
  });

  // Suppress browser context menu on Right-Click in Hub so Right-Mouse-Button rotates the 3D Hero cleanly!
  window.addEventListener('contextmenu', (e) => {
    if (gameMode !== 'hub') return;
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('.sound-trigger-btn')) {
      return;
    }
    e.preventDefault();
  });

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

  let rmbOrbitingCamera = false;
  let lastCombatOrbitX = 0;
  let lastCombatOrbitY = 0;

  window.addEventListener('wheel', (e) => {
    if (gameMode !== 'playing') return;
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('.modal-backdrop:not(.hidden), .sound-popover:not(.hidden)')) {
      return;
    }
    e.preventDefault();
    world.zoomCombatOrbit?.(e.deltaY);
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (rmbOrbitingCamera && gameMode === 'playing') {
      if (typeof e.buttons === 'number' && (e.buttons & 2) === 0) {
        rmbOrbitingCamera = false;
      } else {
        const mapped = window.__toGameCoords ? window.__toGameCoords(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
        const dx = mapped.x - lastCombatOrbitX;
        const dy = mapped.y - lastCombatOrbitY;
        lastCombatOrbitX = mapped.x;
        lastCombatOrbitY = mapped.y;
        world.adjustCombatOrbit?.(-dx * 0.0068, dy * 0.0056);
      }
    }
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    pointerMovedRecently = 2.5;
  });

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (e.pointerType === 'touch') return;
    if (e.button === 2 && gameMode === 'playing') {
      e.preventDefault();
      const mapped = window.__toGameCoords ? window.__toGameCoords(e.clientX, e.clientY) : { x: e.clientX, y: e.clientY };
      rmbOrbitingCamera = true;
      lastCombatOrbitX = mapped.x;
      lastCombatOrbitY = mapped.y;
      return;
    }
    if (e.button === 0 && gameMode === 'playing' && !world.isArenaEditMode?.() && !world.isWeaponEditMode?.()) {
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      pointerFiring = true;
      pointerClickQueued = true;
    }
  });

  const endCombatPointer = (e) => {
    if (e.pointerType === 'touch') return;
    if (e.type === 'pointercancel') {
      rmbOrbitingCamera = false;
      pointerFiring = false;
      return;
    }
    if (e.button === 2) {
      rmbOrbitingCamera = false;
    }
    if (e.button === 0) {
      pointerFiring = false;
    }
  };
  window.addEventListener('pointerup', endCombatPointer);
  window.addEventListener('pointercancel', endCombatPointer);

  function gatherInput(dt) {
    const touch = ui.getTouchInput();
    if (world.isWeaponEditMode?.()) {
      dashRequested = false;
      ultRequested = false;
      if (touch && touch.dash) touch.dash = false;
      if (touch && touch.ult) touch.ult = false;
      return { moveX: 0, moveZ: 0, aimWorldX: 0, aimWorldZ: 0, hasManualAim: false, firing: false, reload: false, dash: false, ult: false };
    }
    // While the arena editor is open, firing stays off. Hero movement (WASD)
    // can be enabled from the editor panel so you can reposition while building.
    if (world.isArenaEditMode?.() && !world.isArenaEditorHeroMovement?.()) {
      dashRequested = false;
      ultRequested = false;
      if (touch && touch.dash) touch.dash = false;
      if (touch && touch.ult) touch.ult = false;
      return { moveX: 0, moveZ: 0, aimWorldX: 0, aimWorldZ: 0, hasManualAim: false, firing: false, reload: false, dash: false, ult: false };
    }
    let moveX = 0;
    let moveZ = 0;

    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= 1;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += 1;

    if (touch?.moveActive) {
      moveX = touch.moveX;
      moveZ = touch.moveZ;
      if (!combat.getAutoAim()) {
        combat.setAutoAim(true);
        ui.setAutoAimState(true);
      }
    } else {
      const len = Math.hypot(moveX, moveZ);
      if (len > 1) {
        moveX /= len;
        moveZ /= len;
      }
    }
    const camYaw = world.getCombatOrbitYaw?.() || 0;
    if (Math.abs(camYaw) > 0.0001 && (moveX !== 0 || moveZ !== 0)) {
      const cosY = Math.cos(camYaw);
      const sinY = Math.sin(camYaw);
      const rx = moveX * cosY + moveZ * sinY;
      const rz = -moveX * sinY + moveZ * cosY;
      moveX = rx;
      moveZ = rz;
    }

    if (pointerMovedRecently > 0) {
      pointerMovedRecently = Math.max(0, pointerMovedRecently - dt);
    }

    let aimWorldX = 0;
    let aimWorldZ = 0;
    let hasManualAim = false;
    let firing = false;
    const explicitLmb = !touch?.moveActive && (pointerFiring || pointerClickQueued);
    pointerClickQueued = false;

    if (!touch?.moveActive && (explicitLmb || (!combat.getAutoAim() && pointerMovedRecently > 0))) {
      const groundPt = world.getAimPointOnGround(pointerClientX, pointerClientY);
      if (groundPt) {
        aimWorldX = groundPt.x;
        aimWorldZ = groundPt.z;
        hasManualAim = true;
      }
      firing = explicitLmb || !combat.getAutoAim();
    }

    const reload = reloadRequested;
    reloadRequested = false;
    const touchDash = Boolean(touch?.dash);
    if (touch && touch.dash) touch.dash = false;
    const dash = dashRequested || touchDash;
    dashRequested = false;
    const touchUlt = Boolean(touch?.ult);
    if (touch && touch.ult) touch.ult = false;
    const ult = ultRequested || touchUlt;
    ultRequested = false;
    const sprint = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');

    return {
      moveX,
      moveZ,
      aimWorldX,
      aimWorldZ,
      hasManualAim,
      firing,
      manualTrigger: explicitLmb,
      sprint,
      reload,
      dash,
      ult
    };
  }

  // Sync initial volume/mute UI state & enter Hub behind splash screen
  ui.setVolumeState?.(audio.getSfxVolume ? audio.getSfxVolume() : audio.getVolume());
  ui.setMusicVolumeState?.(audio.getMusicVolume ? audio.getMusicVolume() : 0.38);
  ui.setMutedState?.(audio.isMuted());
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

  // Optional URL param for peaceful map walk-around without mobs: ?freeroam=6&class=warrior
  try {
    const params = new URLSearchParams(window.location.search);
    const frRaw = params.get('freeroam') ?? params.get('nomobs');
    if (frRaw !== null && frRaw !== '0' && frRaw !== 'false') {
      combat.setFreeRoam(true);
      const parsedNum = Number(frRaw);
      const levelParam = Number(params.get('level') || (parsedNum >= 1 && parsedNum <= 25 ? parsedNum : 6));
      const targetLevel = Math.min(25, Math.max(1, Number.isFinite(levelParam) ? levelParam : 6));
      const rawClass = (params.get('class') || '').trim().toLowerCase();
      const targetClass = (rawClass === 'warrior' || rawClass === 'gunslinger' || rawClass === 'mage') ? rawClass : null;
      if (targetClass) progression.selectClass?.(targetClass);
      if (params.get('hub') !== '1') {
        void window.__grimborne.startFreeRoam(targetLevel, targetClass);
      }
    }
  } catch {}

  let lowFpsStreak = 0;
  let thermalLowSpecApplied = false;

  // === High-Refresh Render & Simulation Loop (Up to 120 FPS ProMotion / Desktop) ===
  const fpsBadgeEl = document.getElementById('fps-badge');
  const showDevFps = isDevEditorEnabled();
  if (fpsBadgeEl) {
    fpsBadgeEl.classList.toggle('is-dev-visible', showDevFps);
    fpsBadgeEl.classList.toggle('hidden', !showDevFps);
  }
  let lastNow = performance.now();
  let elapsedTime = 0;
  let fpsAccumTime = 0;
  let fpsFrameCount = 0;
  let smoothedFps = 60;
  let hudSyncAccum = 0;
  let autoSaveAccum = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDeltaSec = (now - lastNow) / 1000;
    lastNow = now;

    if (rawDeltaSec > 0 && rawDeltaSec < 0.5) {
      fpsAccumTime += rawDeltaSec;
      fpsFrameCount += 1;
      if (fpsAccumTime >= 0.25) {
        const instFps = fpsFrameCount / fpsAccumTime;
        smoothedFps = smoothedFps * 0.35 + instFps * 0.65;
        if (fpsBadgeEl && showDevFps) {
          const shownFps = Math.min(120, Math.max(1, Math.round(smoothedFps)));
          fpsBadgeEl.textContent = `${shownFps} FPS`;
        }
        if (gameMode === 'playing' && !externalPaused && !thermalLowSpecApplied) {
          if (instFps < 43) {
            lowFpsStreak += 1;
            if (lowFpsStreak >= 8) {
              thermalLowSpecApplied = true;
              world.setLowSpecMode?.(true);
            }
          } else {
            lowFpsStreak = Math.max(0, lowFpsStreak - 1);
          }
        }
        fpsAccumTime = 0;
        fpsFrameCount = 0;
      }
    }

    const dt = Math.min(0.05, Math.max(0.0005, rawDeltaSec));

    if (externalPaused) {
      if (gameMode === 'hub') {
        world.render();
      }
      return;
    }

    elapsedTime += dt;

    if (gameMode === 'playing') {
      const input = gatherInput(dt);
      combat.update(dt, input, elapsedTime);
      hudSyncAccum = (hudSyncAccum || 0) + dt;
      if (hudSyncAccum >= 0.05 || input.reload || input.dash || input.ult) {
        hudSyncAccum = 0;
        const snap = combat.getHudSnapshot();
        ui.updateHud(snap);
        syncMusicMode(snap?.finaleStarted || (snap?.isEndless && snap?.boss) ? 'boss' : 'combat');
      }
      autoSaveAccum += dt;
      if (autoSaveAccum >= 3.0) {
        autoSaveAccum = 0;
        if (progression.getState().gold !== lastSavedGold) {
          persistSave();
        }
      }
      world.update(dt, elapsedTime);
    } else if (gameMode === 'hub') {
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
