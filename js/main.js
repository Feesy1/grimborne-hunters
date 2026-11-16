// Master game orchestrator: wires Three.js World, 3D Chibi Models, 3-Class Combat,
// Arsenal Progression, Procedural Web Audio, Gothic UI, and Yandex Games SDK v2.

import * as THREE from '../vendor/three.module.js';
import { LEVELS } from './config.js';
import { createArenaWorld } from './world.js';
import * as models from './models.js';
import { createProgressionStore } from './progression.js';
import { createCombatController } from './combat.js';
import { createAudioEngine } from './audio.js';
import { initYandexSdk } from './yandexSdk.js';
import { createUIManager } from './ui.js';

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

  const persistSave = () => {
    sdk.saveData(progression.getState());
  };

  // Initialize 3D Arena World & preload authentic KayKit GLB characters + 3D environment props
  const world = createArenaWorld(canvas);
  window.addEventListener('resize', () => world.resize());
  await Promise.all([models.preloadModels(), world.ready]);

  // 3D Hero Preview in Hub Diorama
  let hubPreviewHero = null;
  function refreshHubDiorama() {
    if (hubPreviewHero?.root && hubPreviewHero.root.parent) {
      hubPreviewHero.root.parent.remove(hubPreviewHero.root);
    }
    hubPreviewHero = null;
    if (gameMode !== 'hub') return;

    const st = progression.getState();
    const classId = st.selectedClass || 'warrior';
    const weaponId = progression.getEquippedWeaponId(classId);
    hubPreviewHero = models.createHeroMesh(classId, weaponId);
    if (hubPreviewHero?.root) {
      hubPreviewHero.root.position.set(0, 0, 0);
      hubPreviewHero.root.scale.setScalar(1.25);
      world.scene.add(hubPreviewHero.root);
    }
  }

  function clearHubDiorama() {
    if (hubPreviewHero?.root && hubPreviewHero.root.parent) {
      hubPreviewHero.root.parent.remove(hubPreviewHero.root);
    }
    hubPreviewHero = null;
  }

  // Helper: project 3D world position to 2D screen coordinates for floating damage/block numbers
  const projVec = new THREE.Vector3();
  function worldToScreen(wx, wz, wy = 1.55) {
    projVec.set(wx, wy, wz);
    projVec.project(world.camera);
    if (projVec.z > 1) return null;
    const x = (projVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
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
      onLevelUpReady: (choices) => {
        if (gameMode !== 'playing') return;
        gameMode = 'levelup';
        sdk.GameplayAPI.stop();
        audio.playLevelUp();
        ui.showLevelUpModal(choices, (pickedChoice) => {
          const choiceId = typeof pickedChoice === 'string' ? pickedChoice : pickedChoice?.id;
          ui.hideLevelUpModal();
          gameMode = 'playing';
          sdk.GameplayAPI.start();
          combat.applyLevelUpChoice(choiceId);
        });
      },
      onRunEnd: ({ victory, level, goldEarned, kills, unlockedWeapon }) => {
        gameMode = 'result';
        sdk.GameplayAPI.stop();
        if (victory) {
          progression.unlockNextLevel(level);
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
                const nextLvl = Math.min(LEVELS.length, (level || 1) + 1);
                activeRunLevel = nextLvl;
                enterHub();
              },
              onArsenal: async () => {
                ui.hideResultModal();
                await sdk.showInterstitial();
                if (victory) {
                  activeRunLevel = Math.min(LEVELS.length, (level || 1) + 1);
                }
                enterHub();
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

  function enterHub() {
    reloadRequested = false;
    combat.disposeRun();
    world.setBossAtmosphere(false);
    world.setCameraMode?.('hub');
    gameMode = 'hub';
    sdk.GameplayAPI.stop();
    ui.hideAllModals();
    ui.showHud(false);
    ui.setSelectedLevel?.(activeRunLevel);
    ui.renderHub(progression);
    ui.showHub(true);
    refreshHubDiorama();
  }

  function startBattle(classId, levelNum) {
    audio.unlock();
    const chosenClass = classId || progression.getState().selectedClass || 'warrior';
    const maxLvl = progression.getState().maxUnlockedLevel || 1;
    const chosenLevel = Math.min(maxLvl, Math.max(1, Number(levelNum) || activeRunLevel || 1));
    activeRunLevel = chosenLevel;
    usedReviveThisRun = false;
    usedDoubleGoldThisRun = false;
    reloadRequested = false;

    clearHubDiorama();
    world.setCameraMode?.('combat');
    ui.hideAllModals();
    ui.showHub(false);
    ui.showHud(true);
    ui.setAutoAimState(combat.getAutoAim());

    combat.startRun({ classId: chosenClass, levelNumber: chosenLevel });
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
    onBuyHeroUpgrade: handleBuyHeroUpgrade,
    onUpgradeStat: handleBuyHeroUpgrade,
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
    onToggleMute: (nextBool) => {
      const muted = typeof nextBool === 'boolean' ? nextBool : !audio.isMuted();
      audio.setMuted(muted);
      ui.setMutedState?.(muted);
    },
    onVolumeChange: (vol) => {
      audio.unlock();
      const v = audio.setVolume(vol);
      ui.setVolumeState?.(v);
      ui.setMutedState?.(audio.isMuted());
    },
    onExitToHub: () => {
      enterHub();
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
    if (e.code === 'Escape' && gameMode === 'playing' && !e.repeat) {
      enterHub();
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
  });

  window.addEventListener('blur', () => {
    keysDown.clear();
    pointerFiring = false;
    reloadRequested = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointerClientX = e.clientX;
    pointerClientY = e.clientY;
    pointerMovedRecently = 2.5;
  });

  canvas.addEventListener('pointerdown', (e) => {
    audio.unlock();
    if (e.pointerType === 'touch') return;
    if (e.button === 0) {
      pointerClientX = e.clientX;
      pointerClientY = e.clientY;
      pointerFiring = true;
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
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
  ui.setVolumeState?.(audio.getVolume());
  ui.setMutedState?.(audio.isMuted());
  enterHub();
  window.__notifyEngineReady?.();
  sdk.markGameReady();

  // Expose debug helper on window for quick testing
  window.__grimborne = { progression, combat, world, ui, enterHub, startBattle };

  // === Main 60 FPS Render & Simulation Loop ===
  let lastNow = performance.now();
  let elapsedTime = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = (now - lastNow) / 1000;
    lastNow = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));

    if (externalPaused) return;

    elapsedTime += dt;

    if (gameMode === 'playing') {
      const input = gatherInput(dt);
      combat.update(dt, input, elapsedTime);
      ui.updateHud(combat.getHudSnapshot());
      world.update(dt, elapsedTime);
    } else if (gameMode === 'hub') {
      // Close-up Hero Showcase camera centered on (0, 0) pedestal
      world.followTarget(0, 0, dt);
      if (hubPreviewHero?.root) {
        hubPreviewHero.root.rotation.y = Math.sin(elapsedTime * 0.65) * 0.48;
        hubPreviewHero.update?.(dt, false, 1, elapsedTime);
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
