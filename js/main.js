// Master game orchestrator: wires Three.js World, 3D Chibi Models, 3-Class Combat,
// Arsenal Progression, Procedural Web Audio, Gothic UI, and Yandex Games SDK v2.

import * as THREE from '../vendor/three.module.js';
import { LEVELS, MAGE_ELEMENTS, WEAPONS } from './config.js?v=20261117z21';
import { createArenaWorld } from './world.js?v=20261117z21';
import * as models from './models.js?v=20261117z21';
import { createProgressionStore } from './progression.js?v=20261117z21';
import { createCombatController } from './combat.js?v=20261117z21';
import { createAudioEngine } from './audio.js?v=20261117z21';
import { initYandexSdk } from './yandexSdk.js?v=20261117z21';
import { createUIManager } from './ui.js?v=20261117z21';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  const audio = createAudioEngine();

  let gameMode = 'hub'; // 'hub' | 'playing' | 'levelup' | 'result'
  let externalPaused = false;
  let activeRunLevel = 1;
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

  // Load saved progression (or initialize clean state)
  const progression = createProgressionStore();
  const savedData = await sdk.loadData(progression.getState());
  if (savedData) {
    progression.loadState(savedData);
  }
  activeRunLevel = Math.min(LEVELS.length, Math.max(1, progression.getState().maxUnlockedLevel || 1));

  let lastSavedGold = progression.getState().gold;
  const persistSave = () => {
    const st = progression.getState();
    lastSavedGold = st.gold;
    sdk.saveData(st);
  };

  // Guaranteed mobile persistence on iPhone Safari / Android tab switch or close
  window.addEventListener('pagehide', persistSave);
  window.addEventListener('beforeunload', persistSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistSave();
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
  const hubBgVideoEl = document.getElementById('hub-bg-video');
  if (hubBgVideoEl) {
    hubBgVideoEl.muted = true;
    hubBgVideoEl.play().catch(() => {});
    document.addEventListener('pointerdown', () => {
      if (gameMode === 'hub' && hubBgVideoEl.paused) {
        hubBgVideoEl.play().catch(() => {});
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

  let hubDioramaGen = 0;
  function refreshArsenalWeaponDiorama(explicitWeaponId = null, isLocked = false) {
    if (hubArsenalWeapon?.root && hubArsenalWeapon.root.parent) {
      hubArsenalWeapon.root.parent.remove(hubArsenalWeapon.root);
    }
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
      const gen = ++hubDioramaGen;
      models.ensureModelKeysLoaded(missing).then(() => {
        if (gen === hubDioramaGen && gameMode === 'hub' && (currentHubTab === 'arsenal' || currentHubTab === 'store')) {
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
    hubPreviewHero = null;
    if (gameMode !== 'hub') return;

    const st = progression.getState();
    const classId = st.selectedClass || 'warrior';
    const weaponId = progression.getEquippedWeaponId(classId);
    const mageElem = st.activeMageElement || 'water';

    const missing = models.getMissingHeroOrWeaponKeys(classId, weaponId);
    if (missing.length > 0) {
      const gen = ++hubDioramaGen;
      models.ensureModelKeysLoaded(missing).then(() => {
        if (gen === hubDioramaGen && gameMode === 'hub') {
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
    hubPreviewHero = null;
    if (hubArsenalWeapon?.root && hubArsenalWeapon.root.parent) {
      hubArsenalWeapon.root.parent.remove(hubArsenalWeapon.root);
    }
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
      onWeaponUnlocked: (weaponDef) => {
        persistSave();
        if (weaponDef) {
          ui.showWeaponUnlockBanner(weaponDef);
        }
      },
      onHeroLevelUp: () => {
        persistSave();
      },
      onRunEnd: ({ victory, level, goldEarned, kills, unlockedWeapon, hpRatio, elapsedSec, stars, starDetails, difficulty }) => {
        gameMode = 'result';
        sdk.GameplayAPI.stop();
        if (victory) {
          progression.unlockNextLevel(level);
          if (typeof stars === 'number') {
            progression.recordLevelStars?.(level, stars);
          }
        }
        persistSave();

        let currentGoldEarned = goldEarned || 0;
        const openResult = () => {
          ui.showResultModal(
            {
              victory,
              level,
              goldEarned: currentGoldEarned,
              kills,
              unlockedWeapon,
              hpRatio,
              elapsedSec,
              stars: victory ? (stars ?? 1) : 0,
              starDetails,
              difficulty,
              canRevive: !victory && !usedReviveThisRun,
              canDoubleGold: currentGoldEarned > 0 && !usedDoubleGoldThisRun
            },
            {
              onRevive: async () => {
                if (usedReviveThisRun) return;
                const rewarded = await sdk.showRewarded('revive_hunter');
                if (rewarded) {
                  usedReviveThisRun = true;
                  ui.hideResultModal();
                  combat.revivePlayer();
                  gameMode = 'playing';
                  sdk.GameplayAPI.start();
                }
              },
              onDoubleGold: async () => {
                if (usedDoubleGoldThisRun || currentGoldEarned <= 0) return;
                const rewarded = await sdk.showRewarded('double_gold');
                if (rewarded) {
                  usedDoubleGoldThisRun = true;
                  progression.addGold(currentGoldEarned);
                  currentGoldEarned *= 2;
                  persistSave();
                  ui.showToast(`Добыча удвоена! Итого: +${currentGoldEarned} золота`);
                  openResult();
                }
              },
              onNext: async () => {
                ui.hideResultModal();
                await sdk.showInterstitial();
                if (victory) {
                  activeRunLevel = Math.min(LEVELS.length, (level || 1) + 1);
                }
                enterHub('campaign_forest');
              },
              onArsenal: async () => {
                ui.hideResultModal();
                await sdk.showInterstitial();
                if (victory) {
                  activeRunLevel = Math.min(LEVELS.length, (level || 1) + 1);
                }
                enterHub('campaign_forest');
              },
              onRetry: async () => {
                ui.hideResultModal();
                await sdk.showInterstitial();
                startBattle(progression.getState().selectedClass, activeRunLevel);
              }
            }
          );
        };

        openResult();
      }
    }
  });

  let reloadRequested = false;
  let lastSyncedMusicMode = '';
  function syncMusicMode(nextMode) {
    if (nextMode !== lastSyncedMusicMode) {
      lastSyncedMusicMode = nextMode;
      audio.setMusicMode?.(nextMode);
    }
  }

  function enterHub(targetTab = null) {
    reloadRequested = false;
    combat.disposeRun();
    if (hubBgPlateEl) hubBgPlateEl.classList.remove('hidden');
    if (hubBgVideoEl) {
      hubBgVideoEl.muted = true;
      hubBgVideoEl.play().catch(() => {});
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
    ui.renderHub(progression);
    ui.showHub(true);
    refreshHubDiorama();
  }

  function togglePauseGame() {
    if (gameMode === 'playing') {
      gameMode = 'paused';
      keysDown.clear();
      pointerFiring = false;
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
          startBattle(progression.getState().selectedClass, activeRunLevel);
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
    usedReviveThisRun = false;
    usedDoubleGoldThisRun = false;
    reloadRequested = false;

    clearHubDiorama();
    if (hubBgPlateEl) hubBgPlateEl.classList.add('hidden');
    if (hubBgVideoEl) hubBgVideoEl.pause();
    world.setCameraMode?.('combat');
    ui.hideAllModals();
    ui.showHub(false);
    ui.showHud(true);
    combat.setAttackEnabled?.(true);
    ui.setAutoAimState(combat.getAutoAim());
    ui.setAttackEnabledState?.(true);

    world.setArenaBiome?.('courtyard');
    syncMusicMode('combat');
    const difficultyMode = progression.getState().difficultyMode || 'normal';
    combat.startRun({ classId: chosenClass, levelNumber: chosenLevel, difficultyMode });
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
  let pointerMovedRecently = 0;

  window.addEventListener('keydown', (e) => {
    keysDown.add(e.code);
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
    reloadRequested = false;
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
    if (e.button === 0) {
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      pointerFiring = true;
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    if (e.button === 2) {
      rmbOrbitingCamera = false;
    }
    if (e.button === 0) {
      pointerFiring = false;
    }
  });

  function gatherInput(dt) {
    let moveX = 0;
    let moveZ = 0;

    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= 1;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += 1;

    const touch = ui.getTouchInput();
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
      const camYaw = world.getCombatOrbitYaw?.() || 0;
      if (Math.abs(camYaw) > 0.0001 && (moveX !== 0 || moveZ !== 0)) {
        const cosY = Math.cos(camYaw);
        const sinY = Math.sin(camYaw);
        const rx = moveX * cosY + moveZ * sinY;
        const rz = -moveX * sinY + moveZ * cosY;
        moveX = rx;
        moveZ = rz;
      }
    }

    if (pointerMovedRecently > 0) {
      pointerMovedRecently = Math.max(0, pointerMovedRecently - dt);
    }

    let aimWorldX = 0;
    let aimWorldZ = 0;
    let hasManualAim = false;
    let firing = false;

    if (!touch?.moveActive && (pointerFiring || (!combat.getAutoAim() && pointerMovedRecently > 0))) {
      const groundPt = world.getAimPointOnGround(pointerClientX, pointerClientY);
      if (groundPt) {
        aimWorldX = groundPt.x;
        aimWorldZ = groundPt.z;
        hasManualAim = true;
      }
      firing = pointerFiring || !combat.getAutoAim();
    }

    const reload = reloadRequested;
    reloadRequested = false;

    return {
      moveX,
      moveZ,
      aimWorldX,
      aimWorldZ,
      hasManualAim,
      firing,
      reload
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
    getHeroRotationY: () => hubHeroRotY,
    setHeroRotationY: (rad) => {
      hubHeroRotY = Number(rad) || 0;
      hubHeroTargetRotY = hubHeroRotY;
      hubHeroRotVel = 0;
      if (hubPreviewHero?.root) hubPreviewHero.root.rotation.y = hubHeroRotY;
    }
  };

  let lowFpsStreak = 0;
  let thermalLowSpecApplied = false;

  // === High-Refresh Render & Simulation Loop (Up to 120 FPS ProMotion / Desktop) ===
  const fpsBadgeEl = document.getElementById('fps-badge');
  let hubParallaxX = 0;
  let hubParallaxY = 0;
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
        if (fpsBadgeEl) {
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
      if (hudSyncAccum >= 0.05 || input.reload) {
        hudSyncAccum = 0;
        const snap = combat.getHudSnapshot();
        ui.updateHud(snap);
        syncMusicMode(snap?.finaleStarted ? 'boss' : 'combat');
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
      if (hubBgPlateEl) {
        const vw = Math.max(window.innerWidth, 1);
        const vh = Math.max(window.innerHeight, 1);
        const nx = Number.isFinite(pointerClientX) ? (pointerClientX / vw - 0.5) : 0;
        const ny = Number.isFinite(pointerClientY) ? (pointerClientY / vh - 0.5) : 0;
        const targetPx = -nx * 11.0 + Math.sin(elapsedTime * 0.45) * 2.2;
        const targetPy = -ny * 6.5 + Math.cos(elapsedTime * 0.38) * 1.4;
        const pLerp = 1 - Math.exp(-6.5 * dt);
        hubParallaxX += (targetPx - hubParallaxX) * pLerp;
        hubParallaxY += (targetPy - hubParallaxY) * pLerp;
        hubBgPlateEl.style.transform = `translate3d(${hubParallaxX.toFixed(2)}px, ${hubParallaxY.toFixed(2)}px, 0) scale(1.035)`;
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
